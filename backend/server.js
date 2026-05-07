const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { buildImprovementWorkbook } = require("./excel-export");

const app = express();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(__dirname, "data");
const aGradeLinksPath = path.join(dataDir, "a-grade-links.json");
const aGradePdfMetaPath = path.join(dataDir, "a-grade-pdf-meta.json");
const aGradePdfDir = path.join(dataDir, "a-grade-pdfs");
const sharedGridDataPath = path.join(dataDir, "shared-grid-data.json");
const safetyDataPath = path.join(dataDir, "safety-data.json");
const safetyUsersPath = path.join(dataDir, "safety-users.json");
const safetyConfigPath = path.join(__dirname, "safety-local-config.json");
const accessLogPath = path.join(dataDir, "access.log");
const frontendHtmlPath = path.join(rootDir, "frontend", "index.html");
const safetyHtmlPath = path.join(rootDir, "frontend", "safety", "index.html");
const oyoungSafetyHtmlPath = path.join(rootDir, "통합안전점검_오영.html");
const firebaseConfigPath = path.join(rootDir, "firebase-config.js");

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(async (req, _res, next) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || req.socket.remoteAddress;
  const line = `${new Date().toISOString()} ${ip} ${req.method} ${req.originalUrl}\n`;
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.appendFile(accessLogPath, line, "utf8");
  } catch {
    // Logging must never block the app.
  }
  next();
});

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

async function readSafetyConfig() {
  return readJson(safetyConfigPath, {});
}

function defaultSafetyUsers() {
  return [
    { id: "admin", password: "admin1234", name: "중앙관리자", role: "admin", department: "ESQ" },
    { id: "dept", password: "dept1234", name: "부서사용자", role: "department", department: "부서" },
    { id: "생산1부", password: "1234", name: "생산1부", role: "department", department: "생산1부" }
  ];
}

async function readSafetyUsers() {
  const data = await readJson(safetyUsersPath, null);
  const users = Array.isArray(data?.users) ? data.users : null;
  if (users && users.length) return users;
  const fallback = defaultSafetyUsers();
  await writeJson(safetyUsersPath, { users: fallback, updatedAt: new Date().toISOString() });
  return fallback;
}

function publicSafetyUser(user) {
  return {
    id: String(user.id || ""),
    name: String(user.name || user.id || ""),
    role: String(user.role || "department"),
    department: String(user.department || "")
  };
}

function getSafetyGeminiApiKey(config = {}) {
  return String(config.geminiApiKey || process.env.GEMINI_API_KEY || "").trim();
}

async function listSafetyGeminiModels(apiKey) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
    headers: { "x-goog-api-key": apiKey }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "Gemini model lookup failed");
  const priority = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-2.0-flash"];
  const available = (payload.models || [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => String(model.name || "").replace("models/", "").trim())
    .filter(Boolean);
  return [...priority.filter((name) => available.includes(name)), ...available.filter((name) => !priority.includes(name))];
}

async function pickSafetyGeminiModel(apiKey) {
  const models = await listSafetyGeminiModels(apiKey);
  return models[0] || "";
}

function isRetryableGeminiError(message) {
  return /high demand|try again later|temporar|timeout|429|503|overloaded/i.test(String(message || ""));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestSafetyGeminiPdf(apiKey, base64, prompt) {
  let lastError;
  const models = (await listSafetyGeminiModels(apiKey)).slice(0, 3);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const model = models[attempt - 1] || models[0] || await pickSafetyGeminiModel(apiKey);
      if (!model) throw new Error("사용 가능한 Gemini 모델을 찾지 못했습니다.");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: "application/pdf", data: base64 } }, { text: prompt }] }],
          generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);
      return { text: payload.candidates?.[0]?.content?.parts?.[0]?.text || "", model };
    } catch (error) {
      lastError = error;
      if (attempt >= 3 || !isRetryableGeminiError(error?.message)) break;
      await wait(attempt * 3000);
    }
  }
  throw lastError || new Error("Gemini PDF 분석 실패");
}

function sanitizeFilename(name) {
  return String(name || "proposal.pdf").replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
}

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.[^.\\/]+$/g, "")
    .replace(/[\s\-_()[\]{}.,#~·"'“”‘’/\\:;]/g, "");
}

function getMatchTokens(value) {
  return String(value || "")
    .split(/[\s\-_()[\]{}.,#~·"'“”‘’/\\:;]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function getAGradeRowKey(row) {
  return [
    row?.no || "",
    row?.year || "",
    row?.date || "",
    row?.proposer || "",
    row?.title || ""
  ].map((value) => normalizeMatchText(value)).join("|");
}

function normalizeDateDisplay(value) {
  const match = String(value || "").match(/(20\d{2}|19\d{2})[.\-/년\s]*(\d{1,2})[.\-/월\s]*(\d{1,2})/);
  if (!match) return "";
  const [, year, month, day] = match;
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

function extractFieldByLabels(text, labels) {
  for (const label of labels) {
    const sameLine = new RegExp(`${label}\\s*[:：]?\\s*([^\\n]{2,80})`, "i");
    const sameLineMatch = text.match(sameLine);
    if (sameLineMatch?.[1]) return sameLineMatch[1].trim();

    const nextLine = new RegExp(`${label}\\s*[:：]?\\s*\\n\\s*([^\\n]{2,80})`, "i");
    const nextLineMatch = text.match(nextLine);
    if (nextLineMatch?.[1]) return nextLineMatch[1].trim();
  }
  return "";
}

function cleanExtractedValue(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[|]+/g, " ")
    .trim();
}

function guessTitleFromLines(text, fileName) {
  const labeled = cleanExtractedValue(extractFieldByLabels(text, ["제안명", "제목", "개선명", "건명", "과제명", "안건명"]));
  if (labeled) return labeled;

  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => cleanExtractedValue(line))
    .filter(Boolean);

  const candidate = lines.find((line) => {
    if (line.length < 8 || line.length > 120) return false;
    if (/^(개선제안|제안서|결재|품의|문서번호|페이지|page|\d+)$/i.test(line)) return false;
    if (/^(제안자|작성자|부서|소속|접수일|접수년|시상금|등급)/.test(line)) return false;
    return true;
  });

  return candidate || String(fileName || "").replace(/\.[^.]+$/, "").trim();
}

function guessDepartment(text) {
  return cleanExtractedValue(extractFieldByLabels(text, ["부서명", "부서", "소속", "팀명", "담당부서"]));
}

function guessProposer(text) {
  const labeled = cleanExtractedValue(extractFieldByLabels(text, ["제안자", "작성자", "성명", "이름", "기안자", "제출자"]));
  if (labeled) return labeled.split(/\s{2,}|[|/]/)[0].trim();

  const loose = text.match(/(?:제안자|작성자|성명|이름)\s*[:：]?\s*([가-힣A-Za-z]{2,12})/i);
  return loose?.[1]?.trim() || "";
}

function extractPdfFields(text, fileName) {
  const flatText = String(text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ");
  const date = normalizeDateDisplay(flatText);
  const year = (date.match(/(19|20)\d{2}/)?.[0] || flatText.match(/(19|20)\d{2}/)?.[0] || "").trim();
  return {
    title: guessTitleFromLines(flatText, fileName),
    proposer: guessProposer(flatText),
    department: guessDepartment(flatText),
    date,
    year
  };
}

function scoreRowMatch(row, fields, fileName, pdfText) {
  const haystack = normalizeMatchText([
    fileName,
    pdfText,
    fields.title,
    fields.proposer,
    fields.department,
    fields.date,
    fields.year
  ].join(" "));
  if (!haystack) return 0;

  const titleNorm = normalizeMatchText(row?.title);
  const proposerNorm = normalizeMatchText(row?.proposer);
  const departmentNorm = normalizeMatchText(row?.department);
  const yearNorm = normalizeMatchText(row?.year).replace(/년/g, "");
  const dateNorm = normalizeMatchText(row?.date).replace(/\./g, "");
  const titleTokens = getMatchTokens(row?.title)
    .map((token) => normalizeMatchText(token))
    .filter((token) => token.length >= 2);

  let score = 0;
  if (titleNorm.length >= 6 && haystack.includes(titleNorm)) score += 10;
  if (proposerNorm.length >= 2 && haystack.includes(proposerNorm)) score += 4;
  if (departmentNorm.length >= 2 && haystack.includes(departmentNorm)) score += 2;
  if (yearNorm.length >= 4 && haystack.includes(yearNorm)) score += 2;
  if (dateNorm.length >= 6 && haystack.includes(dateNorm)) score += 5;

  const tokenMatches = titleTokens.filter((token) => haystack.includes(token)).length;
  if (tokenMatches) score += Math.min(6, tokenMatches * 2);
  if (proposerNorm.length >= 2 && dateNorm.length >= 6 && haystack.includes(proposerNorm) && haystack.includes(dateNorm)) score += 3;
  return score;
}

async function extractPdfTextFromBase64(base64) {
  const { PDFParse } = require("pdf-parse");
  const parser = new PDFParse({ data: Buffer.from(base64, "base64") });
  try {
    const result = await parser.getText({ first: 3 });
    return String(result?.text || "").trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}

function getNextAGradeNo(rows) {
  const nums = rows
    .map((row) => Number(String(row?.no || "").replace(/[^\d]/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

async function savePdfMetaItem(meta, item) {
  const key = String(item?.key || "").trim();
  const name = sanitizeFilename(item?.name || "proposal.pdf");
  const base64 = String(item?.base64 || "");
  if (!key || !base64) return null;

  const ext = path.extname(name) || ".pdf";
  const fileId = crypto.randomUUID();
  const storedName = `${fileId}${ext}`;
  const filePath = path.join(aGradePdfDir, storedName);
  await fs.writeFile(filePath, Buffer.from(base64, "base64"));

  const record = {
    key,
    name,
    fileId,
    storedName,
    url: `/api/a-grade/pdf/${fileId}`,
    uploadedAt: new Date().toISOString()
  };
  meta.items[key] = record;
  return record;
}

app.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>개선제안정리 서버</title></head>
<body style="font-family:Arial,sans-serif;padding:32px;line-height:1.6">
  <h1>개선제안정리 서버 정상</h1>
  <p>이 화면이 보이면 다른 컴퓨터에서 서버 접속은 성공입니다.</p>
  <p><a href="/app">앱 열기</a></p>
  <p><a href="/api/health">상태 확인</a></p>
</body>
</html>`);
});

app.get("/test", (_req, res) => {
  res.type("text/plain").send("OK - improvement organizer server is reachable");
});

app.get("/app", (_req, res) => {
  res.sendFile(frontendHtmlPath);
});

app.get("/safety", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.sendFile(safetyHtmlPath);
});

app.get("/safety-dept", (_req, res) => {
  res.redirect(302, "/safety");
});

app.get("/oyoung-safety", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.sendFile(oyoungSafetyHtmlPath);
});

app.get("/firebase-config.js", (_req, res) => {
  res.type("application/javascript").sendFile(firebaseConfigPath);
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "improvement-organizer-backend",
    time: new Date().toISOString()
  });
});

app.post("/api/safety-auth/login", async (req, res) => {
  const id = String(req.body?.id || "").trim();
  const password = String(req.body?.password || "");
  if (!id || !password) {
    return res.status(400).json({ ok: false, message: "아이디와 비밀번호를 입력하세요." });
  }
  const users = await readSafetyUsers();
  const user = users.find((item) => String(item.id || "").toLowerCase() === id.toLowerCase() && String(item.password || "") === password);
  if (!user) {
    return res.status(401).json({ ok: false, message: "아이디 또는 비밀번호가 맞지 않습니다." });
  }
  return res.json({ ok: true, user: publicSafetyUser(user) });
});

app.get("/api/safety-gemini/status", async (_req, res) => {
  const config = await readSafetyConfig();
  res.json({ configured: Boolean(getSafetyGeminiApiKey(config)) });
});

app.post("/api/safety-gemini/analyze-pdf", async (req, res) => {
  try {
    const config = await readSafetyConfig();
    const apiKey = getSafetyGeminiApiKey(config);
    if (!apiKey) {
      return res.status(503).json({ error: { message: "Gemini API 키가 서버 로컬 설정에 없습니다." } });
    }

    const base64 = String(req.body?.base64 || "").trim();
    const prompt = String(req.body?.prompt || "").trim();
    if (!base64 || !prompt) {
      return res.status(400).json({ error: { message: "PDF 데이터와 프롬프트가 필요합니다." } });
    }

    const result = await requestSafetyGeminiPdf(apiKey, base64, prompt);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: { message: error.message || "Gemini PDF 분석 실패" } });
  }
});

app.get("/api/access-log", async (_req, res) => {
  try {
    const content = await fs.readFile(accessLogPath, "utf8");
    res.type("text/plain").send(content.split(/\r?\n/).slice(-80).join("\n"));
  } catch {
    res.type("text/plain").send("");
  }
});

app.get("/api/a-grade/links", async (_req, res) => {
  const data = await readJson(aGradeLinksPath, { rows: [], links: {}, updatedAt: null });
  res.json(data);
});

app.put("/api/a-grade/links", async (req, res) => {
  const payload = {
    rows: Array.isArray(req.body?.rows) ? req.body.rows : [],
    links: req.body?.links && typeof req.body.links === "object" ? req.body.links : {},
    updatedAt: new Date().toISOString()
  };
  await writeJson(aGradeLinksPath, payload);
  res.json({ ok: true, saved: Object.keys(payload.links).length, updatedAt: payload.updatedAt });
});

app.get("/api/a-grade/pdf-meta", async (_req, res) => {
  const data = await readJson(aGradePdfMetaPath, { items: {}, updatedAt: null });
  res.json(data);
});

app.get("/api/a-grade/pdf/:fileId", async (req, res) => {
  const fileId = String(req.params.fileId || "");
  const meta = await readJson(aGradePdfMetaPath, { items: {}, updatedAt: null });
  const item = Object.values(meta.items || {}).find((entry) => entry && entry.fileId === fileId);
  if (!item || !item.storedName) {
    res.status(404).type("text/plain").send("PDF not found");
    return;
  }

  const filePath = path.join(aGradePdfDir, item.storedName);
  res.type("application/pdf").sendFile(filePath);
});

app.post("/api/a-grade/pdf-upload", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      res.status(400).json({ ok: false, message: "업로드할 PDF가 없습니다." });
      return;
    }

    await fs.mkdir(aGradePdfDir, { recursive: true });
    const meta = await readJson(aGradePdfMetaPath, { items: {}, updatedAt: null });
    const saved = [];

    for (const item of items) {
      const record = await savePdfMetaItem(meta, item);
      if (record) saved.push(record);
    }

    meta.updatedAt = new Date().toISOString();
    await writeJson(aGradePdfMetaPath, meta);
    res.json({ ok: true, items: saved, updatedAt: meta.updatedAt });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "PDF 업로드에 실패했습니다." });
  }
});

app.post("/api/a-grade/pdf-auto-register", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const sourceRows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!items.length) {
      res.status(400).json({ ok: false, message: "등록할 PDF가 없습니다." });
      return;
    }

    await fs.mkdir(aGradePdfDir, { recursive: true });
    const meta = await readJson(aGradePdfMetaPath, { items: {}, updatedAt: null });
    const rows = sourceRows.map((row) => ({ ...row }));
    const saved = [];
    const matched = [];
    const created = [];
    const skipped = [];

    for (const item of items) {
      const name = sanitizeFilename(item?.name || "proposal.pdf");
      const base64 = String(item?.base64 || "");
      if (!base64) {
        skipped.push({ name, reason: "base64-missing" });
        continue;
      }

      let pdfText = "";
      try {
        pdfText = await extractPdfTextFromBase64(base64);
      } catch {
        pdfText = "";
      }

      const fields = extractPdfFields(pdfText, name);
      let targetRow = null;
      let bestScore = 0;

      for (const row of rows) {
        const score = scoreRowMatch(row, fields, name, pdfText);
        if (score > bestScore) {
          bestScore = score;
          targetRow = row;
        }
      }

      if (bestScore < 8 || !targetRow) {
        targetRow = {
          no: String(getNextAGradeNo(rows)),
          year: fields.year || String(new Date().getFullYear()),
          date: fields.date || "",
          department: fields.department || "",
          proposer: fields.proposer || "",
          title: fields.title || name.replace(/\.[^.]+$/, ""),
          type: "실시",
          reward: ""
        };
        rows.push(targetRow);
        created.push({
          key: getAGradeRowKey(targetRow),
          name,
          title: targetRow.title
        });
      } else {
        matched.push({
          key: getAGradeRowKey(targetRow),
          name,
          title: targetRow.title
        });
      }

      const record = await savePdfMetaItem(meta, {
        key: getAGradeRowKey(targetRow),
        name,
        base64
      });
      if (record) saved.push(record);
    }

    meta.updatedAt = new Date().toISOString();
    await writeJson(aGradePdfMetaPath, meta);
    res.json({
      ok: true,
      rows,
      items: saved,
      matchedCount: matched.length,
      createdCount: created.length,
      skippedCount: skipped.length,
      matched,
      created,
      skipped,
      updatedAt: meta.updatedAt
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "A급 자동 등록에 실패했습니다." });
  }
});

app.get("/api/shared-data", async (_req, res) => {
  const data = await readJson(sharedGridDataPath, {
    rows: [],
    kingRows: [],
    aGradeRows: [],
    aGradeRemoteLinks: {},
    updatedAt: null
  });
  res.json(data);
});

app.put("/api/shared-data", async (req, res) => {
  const current = await readJson(sharedGridDataPath, {
    rows: [],
    kingRows: [],
    aGradeRows: [],
    aGradeRemoteLinks: {},
    updatedAt: null
  });
  const requestedAGradeRows = Array.isArray(req.body?.aGradeRows) ? req.body.aGradeRows : [];
  const requestedAGradeLinks = req.body?.aGradeRemoteLinks && typeof req.body.aGradeRemoteLinks === "object" ? req.body.aGradeRemoteLinks : {};
  const payload = {
    rows: Array.isArray(req.body?.rows) ? req.body.rows : [],
    kingRows: Array.isArray(req.body?.kingRows) ? req.body.kingRows : [],
    aGradeRows: requestedAGradeRows.length ? requestedAGradeRows : (Array.isArray(current.aGradeRows) ? current.aGradeRows : []),
    aGradeRemoteLinks: Object.keys(requestedAGradeLinks).length ? requestedAGradeLinks : (current.aGradeRemoteLinks && typeof current.aGradeRemoteLinks === "object" ? current.aGradeRemoteLinks : {}),
    updatedAt: new Date().toISOString()
  };
  await writeJson(sharedGridDataPath, payload);
  res.json({
    ok: true,
    rows: payload.rows.length,
    kingRows: payload.kingRows.length,
    updatedAt: payload.updatedAt
  });
});

app.get("/api/safety-data", async (_req, res) => {
  const data = await readJson(safetyDataPath, { records: [], updatedAt: null });
  res.json(data);
});

app.put("/api/safety-data", async (req, res) => {
  const payload = {
    records: Array.isArray(req.body?.records) ? req.body.records : [],
    updatedAt: new Date().toISOString()
  };
  await writeJson(safetyDataPath, payload);
  res.json({ ok: true, records: payload.records.length, updatedAt: payload.updatedAt });
});

app.post("/api/safety-data", async (req, res) => {
  const payload = {
    records: Array.isArray(req.body?.records) ? req.body.records : [],
    updatedAt: new Date().toISOString()
  };
  await writeJson(safetyDataPath, payload);
  res.json({ ok: true, records: payload.records.length, updatedAt: payload.updatedAt });
});

app.post("/api/export/excel", async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const buffer = await buildImprovementWorkbook(rows);
    const filename = `개선제안_제출현황_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(Buffer.from(buffer));
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "엑셀 내보내기에 실패했습니다." });
  }
});

app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use("/frontend", express.static(path.join(rootDir, "frontend")));
app.use("/vendor", express.static(path.join(rootDir, "node_modules")));

function listenOnPort(targetPort) {
  const server = app.listen(targetPort, host, () => {
    console.log(`Improvement organizer running at http://127.0.0.1:${targetPort}/app`);
    console.log(`Safety app available at http://127.0.0.1:${targetPort}/safety`);
  });

  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      console.warn(`Port ${targetPort} is already in use; skipping secondary listener.`);
      return;
    }
    throw error;
  });
}

const listenPorts = [...new Set([port, 4173, 3000].filter((value) => Number.isFinite(value) && value > 0))];
listenPorts.forEach(listenOnPort);

