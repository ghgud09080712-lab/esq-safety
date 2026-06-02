const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { promisify } = require("util");
const XLSX = require("xlsx");

const app = express();
const execFileAsync = promisify(execFile);
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const rootDir = path.resolve(__dirname, "..");
const { buildReadonlyHtml } = require(path.join(rootDir, "tools", "export-legal-registry-readonly.js"));
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, "data"));
const seedDir = path.join(__dirname, "seeds");
const aGradeLinksPath = path.join(dataDir, "a-grade-links.json");
const aGradePdfMetaPath = path.join(dataDir, "a-grade-pdf-meta.json");
const aGradePdfDir = path.join(dataDir, "a-grade-pdfs");
const sharedGridDataPath = path.join(dataDir, "shared-grid-data.json");
const safetyDataPath = path.join(dataDir, "safety-data.json");
const safetyDataSeedPath = path.join(seedDir, "safety-data.seed.json");
const sharedGridDataSeedPath = path.join(seedDir, "shared-grid-data.seed.json");
const safetyUsersPath = path.join(dataDir, "safety-users.json");
const safetySettingsPath = path.join(dataDir, "safety-settings.json");
const safetyFormSubmissionsPath = path.join(dataDir, "safety-form-submissions.json");
const safetyConfigPath = path.join(__dirname, "safety-local-config.json");
const accessLogPath = path.join(dataDir, "access.log");
const safetyHtmlPath = path.join(rootDir, "frontend", "safety", "index.html");
const legalRegistryHtmlPath = path.join(rootDir, "frontend", "legal-registry", "index.html");
const firebaseConfigPath = path.join(rootDir, "firebase-config.js");
const legalRegistryDataPath = path.join(dataDir, "legal-registry.json");
const legalRegistryDataSeedPath = path.join(seedDir, "legal-registry.seed.json");
const publicOyoungDir = path.join(rootDir, "public-oyoung");
const publicLegalRegistryFileName = "legal-registry.html";
const firebaseProjectId = "esq-aiproject";
const firebaseDeployEnabled = process.env.FIREBASE_DEPLOY_ENABLED !== "false" && process.env.NODE_ENV !== "production";
const defaultLegalRegistrySourcePath = process.env.LEGAL_REGISTER_PATH || "C:\\Users\\zxcas\\Desktop\\김호형\\새 폴더\\법규등록부(2026.02.25).xlsx";
const defaultLawOpenApiOc = process.env.LAW_OPEN_API_OC || "esq";
const legalRegistryCompanyProfile = {
  companyName: "(주)오영",
  englishName: "OHYOUNG",
  founded: "1981",
  industry: "섬유용 합성염료 전문 제조업",
  answerStandard: "(주)오영 섬유용 합성염료 제조공정 기준",
  businessSummary: [
    "1981년 설립된 섬유용 합성염료 전문 제조 회사",
    "색을 창조하는 것을 업으로 하며 염료 품질은 원료 구매 단계부터 관리",
    "반응성염료 분야 중심의 기술 개발 이력이 강함",
    "글로벌 염색 시장과 섬유 고객사를 대상으로 제품을 공급"
  ],
  productFamilies: [
    "반응성염료",
    "분산염료",
    "산성염료",
    "카치온염료",
    "디지털 텍스타일프린트 잉크(DTP)",
    "형광증백제",
    "텍스타일 케미컬"
  ],
  likelyWorkplaces: ["원료 창고", "계량실", "혼합실", "반응실", "여과/정제 구역", "건조실", "분쇄/분급 구역", "포장실", "제품 창고", "연구소", "폐수처리장", "대기방지시설", "위험물/화학물질 보관장"],
  typicalProcesses: ["원료 구매/입고", "원료 보관", "분쇄/계량", "혼합", "반응", "여과/정제", "배합", "건조", "분급", "포장", "DTP 잉크 배합", "제품 보관/출하", "폐수/폐기물 처리", "방지시설 운영"],
  typicalRisks: ["유해화학물질 취급", "염료 분말 분진 노출", "분진 비산/퇴적", "VOC/악취 배출", "폐수 및 색도 관리", "지정폐기물", "인화성 용제/위험물", "화재/폭발", "정전기", "국소배기 및 집진", "보호구", "작업환경측정", "특수건강진단", "MSDS/GHS 관리", "화학물질 누출", "연구실 안전"],
  priorityLawAreas: ["산업안전보건", "화학물질관리", "화학물질 등록평가", "위험물안전관리", "대기환경", "악취", "물환경/폐수", "폐기물", "소방시설", "연구실안전"],
  responseStyle: [
    "질문을 (주)오영의 섬유용 합성염료 제조, DTP 잉크, 텍스타일 케미컬 현장 상황으로 해석한다.",
    "법령명만 나열하지 말고 계량, 반응, 건조, 포장, 폐수처리, 방지시설, 연구소 중 어느 현장에 적용되는지 설명한다.",
    "현장에서 바로 확인할 관리 포인트와 개선 조치를 제시한다.",
    "해당 법령 후보에 없는 내용은 단정하지 않고 원문 확인 필요로 표시한다."
  ]
};

app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
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
  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), "utf8");
  await fs.rename(tempPath, filePath);
}

function compactText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function preserveText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function pickInputValue(input, existing, key) {
  return Object.prototype.hasOwnProperty.call(input || {}, key) ? input[key] : existing?.[key];
}

function normalizeLawDate(value) {
  const text = compactText(value);
  if (!text) return "";
  const compactDate = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactDate) return `${compactDate[1]}-${compactDate[2]}-${compactDate[3]}`;
  const date = text.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (!date) return text;
  return `${date[1]}-${String(date[2]).padStart(2, "0")}-${String(date[3]).padStart(2, "0")}`;
}

function displayLawDate(value) {
  const normalized = normalizeLawDate(value);
  const date = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return date ? `${date[1]}. ${Number(date[2])}. ${Number(date[3])}` : normalized.replace(/(\d)\.$/, "$1");
}

function fileTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function normalizeLawName(value) {
  return compactText(value)
    .replace(/\s+/g, "")
    .replace(/[「」『』\[\]()]/g, "")
    .replace(/법률$/g, "법")
    .trim();
}

function makeLawKey(name) {
  return normalizeLawName(name).toLowerCase();
}

function cellText(row, index) {
  return compactText(row?.[index]);
}

function pickLawDate(item, keys) {
  for (const key of keys) {
    const value = item?.[key];
    if (value !== undefined && value !== null && compactText(value)) return displayLawDate(value);
  }
  return "";
}

function extractLawItems(payload) {
  const law = payload?.LawSearch?.law;
  if (Array.isArray(law)) return law;
  if (law && typeof law === "object") return [law];
  return [];
}

function parseLegalRegistryWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const records = [];
  const detailCards = [];
  const sheet = workbook.Sheets["법규등록부"];
  if (sheet) {
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false, blankrows: false });
    let parentLaw = "";
    let currentNo = "";
    for (const row of rows) {
      const first = cellText(row, 0);
      const second = cellText(row, 1);
      const third = cellText(row, 2);
      if (/^No$/i.test(first) || !third || third === "개정일자") continue;
      if (first && /^\d+/.test(first)) currentNo = first;
      if (second) parentLaw = second;
      const lawName = third || parentLaw;
      if (!lawName || !cellText(row, 3)) continue;
      records.push({
        id: `LAW-${String(records.length + 1).padStart(4, "0")}`,
        no: currentNo,
        group: parentLaw || lawName,
        lawName,
        registeredEffectiveDate: displayLawDate(cellText(row, 3)),
        officialEffectiveDate: "",
        promulgationDate: "",
        status: "등록",
        source: "workbook",
        note: cellText(row, 4),
        updatedAt: null
      });
    }
  }

  for (const sheetName of workbook.SheetNames.filter((name) => /^법규등록부\d+/.test(name))) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: false, blankrows: false });
    const displayRows = rows
      .map((row) => row.map((cell) => compactText(cell)))
      .filter((row) => row.some(Boolean));
    const findValue = (label, offset = 1) => {
      for (const row of rows) {
        const index = row.findIndex((cell) => compactText(cell).includes(label));
        if (index >= 0) return cellText(row, index + offset);
      }
      return "";
    };
    const contentRow = rows[7] || [];
    const applyRow = rows[8] || [];
    const lawName = findValue("법규명");
    if (!lawName) continue;
    detailCards.push({
      id: sheetName,
      sheetName,
      category: findValue("구 분"),
      lawName,
      issuer: findValue("발행기관"),
      channel: findValue("입수경로", 3) || findValue("입수경로"),
      revisionDate: displayLawDate(findValue("제,개정일")),
      registeredDate: displayLawDate(findValue("등록일", 3) || findValue("등록일")),
      team: findValue("작성팀"),
      author: findValue("작성자", 3) || findValue("작성자"),
      applicability: cellText(applyRow, 1) || findValue("당사해당 유무"),
      mainContent: cellText(contentRow, 1),
      companyAction: cellText(applyRow, 2) || findValue("당사 적용사항", 3) || findValue("당사 적용사항"),
      rows: displayRows
    });
  }

  return { records, detailCards, sheetNames: workbook.SheetNames };
}

async function readLegalRegistry() {
  const current = await readJson(legalRegistryDataPath, null);
  if (current?.records) return current;
  const seed = await readJson(legalRegistryDataSeedPath, null);
  if (seed?.records) {
    const payload = {
      ...seed,
      sourcePath: seed.sourcePath || defaultLegalRegistrySourcePath,
      changes: Array.isArray(seed.changes) ? seed.changes : [],
      refreshLogs: Array.isArray(seed.refreshLogs) ? seed.refreshLogs : [],
      createdAt: seed.createdAt || new Date().toISOString(),
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
    await writeJson(legalRegistryDataPath, payload);
    return payload;
  }
  try {
    const parsed = parseLegalRegistryWorkbook(defaultLegalRegistrySourcePath);
    const payload = {
      sourcePath: defaultLegalRegistrySourcePath,
      records: parsed.records,
      detailCards: parsed.detailCards,
      changes: [],
      refreshLogs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await writeJson(legalRegistryDataPath, payload);
    return payload;
  } catch (error) {
    return {
      sourcePath: defaultLegalRegistrySourcePath,
      records: [],
      detailCards: [],
      changes: [],
      refreshLogs: [{ at: new Date().toISOString(), ok: false, message: error.message }],
      createdAt: new Date().toISOString(),
      updatedAt: null
    };
  }
}

async function searchOfficialLaw(lawName, oc) {
  const params = new URLSearchParams({
    OC: oc,
    target: "law",
    type: "JSON",
    display: "10",
    search: "1",
    query: lawName
  });
  const response = await fetch(`https://www.law.go.kr/DRF/lawSearch.do?${params}`);
  const text = await response.text();
  let payload = {};
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`법제처 응답을 해석하지 못했습니다: ${text.slice(0, 80)}`);
  }
  if (!response.ok || payload?.result) {
    throw new Error(payload?.msg || payload?.result || `법제처 HTTP ${response.status}`);
  }
  const items = extractLawItems(payload);
  const requested = makeLawKey(lawName);
  return items.find((item) => makeLawKey(item["법령명한글"] || item.lsNm || item["법령명"]) === requested)
    || items.find((item) => makeLawKey(item["법령명한글"] || item.lsNm || item["법령명"]).includes(requested))
    || items[0]
    || null;
}

function buildChange(record, official) {
  const lawName = official?.["법령명한글"] || official?.lsNm || official?.["법령명"] || record.lawName;
  const officialEffectiveDate = pickLawDate(official, ["시행일자", "efYd", "시행일", "시행일자문자열"]);
  const promulgationDate = pickLawDate(official, ["공포일자", "ancYd", "공포일"]);
  const lawId = compactText(official?.["법령ID"] || official?.lawId || official?.ID || official?.id);
  const mst = compactText(official?.["법령일련번호"] || official?.MST || official?.mst);
  const currentDate = normalizeLawDate(record.officialEffectiveDate || record.registeredEffectiveDate);
  const nextDate = normalizeLawDate(officialEffectiveDate);
  const changed = Boolean(nextDate && nextDate !== currentDate);
  return {
    id: `CHG-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    recordId: record.id,
    lawName,
    previousEffectiveDate: record.officialEffectiveDate || record.registeredEffectiveDate || "",
    effectiveDate: officialEffectiveDate,
    promulgationDate,
    lawId,
    mst,
    status: changed ? "new" : "same",
    summary: changed ? "시행일자가 변경되어 등록 검토가 필요합니다." : "등록부와 최신 시행일자가 같습니다.",
    checkedAt: new Date().toISOString()
  };
}

function flattenLawText(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) flattenLawText(item, output);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) flattenLawText(item, output);
  } else if (value !== undefined && value !== null) {
    const text = compactText(value);
    if (text) output.push(text);
  }
  return output;
}

function summarizeAmendmentLines(lines) {
  const clean = lines
    .map((line) => compactText(line))
    .filter(Boolean)
    .filter((line) => !/^\[?본문 생략\]?$/.test(line))
    .filter((line, index, array) => array.indexOf(line) === index);
  return clean.slice(0, 80);
}

function lawDateParam(value) {
  return normalizeLawDate(value).replace(/\D/g, "");
}

function collectLawContentValues(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectLawContentValues(item, output);
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (/내용$/.test(key)) {
        const text = compactText(item);
        if (text) output.push(text);
      } else if (typeof item === "object") {
        collectLawContentValues(item, output);
      }
    }
  }
  return output;
}

function extractArticles(law) {
  const units = law?.["조문"]?.["조문단위"];
  const items = Array.isArray(units) ? units : units ? [units] : [];
  return items
    .filter((item) => item?.["조문여부"] === "조문")
    .map((item) => {
      const number = compactText(item["조문번호"]);
      const branch = compactText(item["조문가지번호"]);
      const title = compactText(item["조문제목"]);
      const key = compactText(item["조문키"]) || `${number}-${branch}`;
      const heading = `제${number}${branch ? `의${branch}` : ""}조${title ? `(${title})` : ""}`;
      const lines = collectLawContentValues(item)
        .filter((line, index, array) => array.indexOf(line) === index);
      return {
        key,
        heading,
        changed: compactText(item["조문변경여부"]) === "Y",
        text: lines.join("\n")
      };
    });
}

function normalizeArticleText(value) {
  return compactText(value).replace(/\s+/g, " ");
}

function diffArticles(previousArticles, currentArticles) {
  const previousMap = new Map(previousArticles.map((item) => [item.key, item]));
  const currentMap = new Map(currentArticles.map((item) => [item.key, item]));
  const diffs = [];
  for (const [key, current] of currentMap) {
    const previous = previousMap.get(key);
    if (!previous) {
      diffs.push({ type: "added", heading: current.heading, after: current.text });
    } else if (normalizeArticleText(previous.text) !== normalizeArticleText(current.text)) {
      diffs.push({ type: "changed", heading: current.heading, before: previous.text, after: current.text });
    }
  }
  for (const [key, previous] of previousMap) {
    if (!currentMap.has(key)) {
      diffs.push({ type: "removed", heading: previous.heading, before: previous.text });
    }
  }
  return diffs.slice(0, 120);
}

async function fetchOfficialLawContent({ lawName, mst, lawId, oc, effectiveDate }) {
  let selectedMst = compactText(mst);
  let selectedLawId = compactText(lawId);
  let official = null;
  if (!selectedMst && !selectedLawId && lawName) {
    official = await searchOfficialLaw(lawName, oc);
    selectedMst = compactText(official?.["법령일련번호"] || official?.MST || official?.mst);
    selectedLawId = compactText(official?.["법령ID"] || official?.lawId || official?.ID || official?.id);
  }
  const queryKey = selectedMst ? `MST=${encodeURIComponent(selectedMst)}` : `ID=${encodeURIComponent(selectedLawId)}`;
  if (!selectedMst && !selectedLawId) throw new Error("법령 본문 조회에 필요한 법령 식별값을 찾지 못했습니다.");
  const efYd = lawDateParam(effectiveDate);
  const target = efYd ? "eflaw" : "law";
  const response = await fetch(`https://www.law.go.kr/DRF/lawService.do?OC=${encodeURIComponent(oc)}&target=${target}&type=JSON&${queryKey}${efYd ? `&efYd=${encodeURIComponent(efYd)}` : ""}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.result) throw new Error(payload?.msg || payload?.result || `법령 본문 HTTP ${response.status}`);
  const law = payload?.["법령"] || {};
  const basic = law["기본정보"] || {};
  const amendmentLines = summarizeAmendmentLines(flattenLawText(law["개정문"]?.["개정문내용"] || law["개정문"]));
  const reasonLines = summarizeAmendmentLines(flattenLawText(law["제개정이유"]));
  return {
    lawName: compactText(basic["법령명_한글"] || basic["법령명한글"] || lawName || official?.["법령명한글"]),
    mst: selectedMst,
    lawId: selectedLawId,
    amendmentLines,
    reasonLines,
    articles: extractArticles(law)
  };
}

async function readRuntimeJsonWithSeed(filePath, seedPath, fallback) {
  const data = await readJson(filePath, null);
  if (data) return data;
  const seed = await readJson(seedPath, null);
  if (seed) {
    await writeJson(filePath, seed);
    return seed;
  }
  return fallback;
}

async function readSafetyConfig() {
  return readJson(safetyConfigPath, {});
}

function defaultSafetyUsers() {
  return [
    { id: "ESQ", password: "5749", name: "중앙관리자", role: "admin", department: "ESQ" },
    { id: "dept", password: "dept1234", name: "부서사용자", role: "department", department: "부서" },
    { id: "생산1부", password: "1234", name: "생산1부", role: "department", department: "생산1부" },
    { id: "TS", password: "1234", name: "T/S팀", role: "department", department: "T/S팀" }
  ];
}

async function readSafetyUsers() {
  const data = await readJson(safetyUsersPath, null);
  const users = Array.isArray(data?.users) ? data.users : null;
  const fallback = defaultSafetyUsers();
  if (users && users.length) {
    const merged = users.filter((item) => String(item.role || "") !== "admin");
    for (const user of fallback) {
      const existing = merged.find((item) => String(item.id || "").toLowerCase() === String(user.id || "").toLowerCase());
      if (existing) {
        if (Array.isArray(user.passwords)) existing.passwords = Array.from(new Set([...(Array.isArray(existing.passwords) ? existing.passwords : []), ...user.passwords]));
        existing.name = existing.name || user.name;
        existing.role = existing.role || user.role;
        existing.department = existing.department || user.department;
      } else {
        merged.push(user);
      }
    }
    await writeJson(safetyUsersPath, { users: merged, updatedAt: new Date().toISOString() });
    return merged;
  }
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
  return /not found|404|high demand|try again later|temporar|timeout|429|500|502|503|504|overloaded|unavailable|internal error|internal server error/i.test(String(message || ""));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getProposalGeminiModels(apiKey, preferredModel) {
  let available = [];
  try {
    available = await listSafetyGeminiModels(apiKey);
  } catch {
    available = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"];
  }
  return [...new Set([preferredModel, ...available, "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash", "gemini-1.5-flash"].filter(Boolean))].slice(0, 5);
}

async function requestProposalGeminiWithFallback(apiKey, preferredModel, buildBody) {
  const models = await getProposalGeminiModels(apiKey, preferredModel);
  let lastError;
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          body: JSON.stringify(buildBody(model))
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result?.error?.message || result?.message || `Gemini HTTP ${response.status}`);
        return result;
      } catch (error) {
        lastError = error;
        if (!isRetryableGeminiError(error?.message)) throw error;
        if (attempt < 2) await wait(attempt * 2500);
      }
    }
  }
  throw lastError || new Error("Gemini 분석 실패");
}

async function requestProposalOpenAIResponses(apiKey, body) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.message || result?.message || `OpenAI HTTP ${response.status}`);
  }
  return result;
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

async function requestSafetyGeminiText(apiKey, prompt) {
  let lastError;
  let available = [];
  try {
    available = await listSafetyGeminiModels(apiKey);
  } catch {
    available = [];
  }
  const models = [...new Set([
    ...available,
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-pro"
  ].filter(Boolean))].slice(0, 8);
  for (let attempt = 1; attempt <= models.length; attempt += 1) {
    try {
      const model = models[attempt - 1] || models[0] || await pickSafetyGeminiModel(apiKey);
      if (!model) throw new Error("사용 가능한 Gemini 모델을 찾지 못했습니다.");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.15, response_mime_type: "application/json" }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message || `HTTP ${response.status}`);
      return { text: payload.candidates?.[0]?.content?.parts?.[0]?.text || "", model };
    } catch (error) {
      lastError = error;
      if (attempt >= models.length || !isRetryableGeminiError(error?.message)) break;
      await wait(attempt * 3000);
    }
  }
  throw lastError || new Error("Gemini 분석 실패");
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
  return "";
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
  res.redirect(302, "/legal-registry");
});

app.get("/test", (_req, res) => {
  res.type("text/plain").send("OK - ESQ safety server is reachable");
});

app.get("/app", (_req, res) => {
  res.redirect(302, "/legal-registry");
});

app.get("/safety", (_req, res) => {
  res.redirect(302, "/legal-registry");
});

app.get("/legal-registry", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.sendFile(legalRegistryHtmlPath);
});

app.get("/safety-dept", (_req, res) => {
  res.redirect(302, "/safety");
});

app.get("/oyoung-safety", (_req, res) => {
  res.redirect(302, "/safety");
});

app.get("/firebase-config.js", (_req, res) => {
  res.type("application/javascript").sendFile(firebaseConfigPath);
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "esq-safety-backend",
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
  const user = users.find((item) => {
    const sameId = String(item.id || "").toLowerCase() === id.toLowerCase();
    const validPasswords = [item.password, ...(Array.isArray(item.passwords) ? item.passwords : [])].map((value) => String(value || ""));
    return sameId && validPasswords.includes(password);
  });
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

app.post("/api/safety-gemini/recommend-risk", async (req, res) => {
  try {
    const config = await readSafetyConfig();
    const apiKey = getSafetyGeminiApiKey(config);
    if (!apiKey) {
      return res.status(503).json({ error: { message: "Gemini API 키가 서버 로컬 설정에 없습니다." } });
    }

    const prompt = String(req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ error: { message: "위험성평가 프롬프트가 필요합니다." } });
    }

    const result = await requestSafetyGeminiText(apiKey, prompt);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: { message: error.message || "Gemini 위험성평가 추천 실패" } });
  }
});

app.post("/api/proposal-gpt/analyze", async (req, res) => {
  try {
    const apiKey = String(req.body?.apiKey || "").trim();
    const base64 = String(req.body?.base64 || "").trim();
    const prompt = String(req.body?.prompt || "").trim();
    const model = String(req.body?.model || "gemini-2.5-flash").trim();
    const provider = String(req.body?.provider || "gemini").trim().toLowerCase();
    const fileName = String(req.body?.fileName || "proposal.pdf").trim();

    if (!apiKey) {
      return res.status(400).json({ error: { message: `${provider === "openai" ? "OpenAI" : "Gemini"} API 키가 필요합니다.` } });
    }
    if (!base64 || !prompt) {
      return res.status(400).json({ error: { message: "PDF 데이터와 프롬프트가 필요합니다." } });
    }

    if (provider === "openai") {
      const result = await requestProposalOpenAIResponses(apiKey, {
        model: model || "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_file",
              filename: fileName || "proposal.pdf",
              file_data: `data:application/pdf;base64,${base64}`
            }
          ]
        }],
        temperature: 0.1,
        max_output_tokens: 16000
      });
      return res.json(result);
    }

    const result = await requestProposalGeminiWithFallback(apiKey, model, () => ({
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: base64 } },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16000
        }
      }));
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: { message: error.message || "PDF 분석 실패" } });
  }
});

app.post("/api/proposal-gpt/analyze-image", async (req, res) => {
  try {
    const apiKey = String(req.body?.apiKey || "").trim();
    const prompt = String(req.body?.prompt || "").trim();
    const model = String(req.body?.model || "gemini-2.5-flash").trim();
    const provider = String(req.body?.provider || "gemini").trim().toLowerCase();
    const images = Array.isArray(req.body?.images) ? req.body.images : [];

    if (!apiKey) {
      return res.status(400).json({ error: { message: `${provider === "openai" ? "OpenAI" : "Gemini"} API 키가 필요합니다.` } });
    }
    if (!prompt || !images.length) {
      return res.status(400).json({ error: { message: "이미지 데이터와 프롬프트가 필요합니다." } });
    }

    if (provider === "openai") {
      const result = await requestProposalOpenAIResponses(apiKey, {
        model: model || "gpt-4.1-mini",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            ...images.flatMap((image) => ([
              { type: "input_text", text: `[후보 ${image.candidateNo}] pageNo=${image.pageNo}, absolutePageNo=${image.absolutePageNo}, title=${image.title || ""}` },
              { type: "input_image", image_url: image.imageDataUrl }
            ]))
          ]
        }],
        temperature: 0,
        max_output_tokens: 4000
      });
      return res.json(result);
    }

    const parts = [{ text: prompt }];
    for (const image of images) {
      const imageData = String(image?.imageDataUrl || "").replace(/^data:image\/\w+;base64,/, "").trim();
      if (!imageData) continue;
      parts.push({ text: `[후보 ${image.candidateNo}] pageNo=${image.pageNo}, absolutePageNo=${image.absolutePageNo}, title=${image.title || ""}` });
      parts.push({ inlineData: { mimeType: "image/png", data: imageData } });
    }

    const result = await requestProposalGeminiWithFallback(apiKey, model, () => ({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4000
        }
      }));
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: { message: error.message || "이미지 분석 실패" } });
  }
});

app.get("/api/legal-registry", async (_req, res) => {
  const data = await readLegalRegistry();
  res.json(data);
});

app.get("/api/legal-registry/export-readonly", async (_req, res) => {
  const data = await readLegalRegistry();
  const html = buildReadonlyHtml(data, new Date());
  const date = new Date().toISOString().slice(0, 10);
  const filename = `법규등록부_보기전용_${date}.html`;
  const safeFilename = `legal-registry-readonly-${date}.html`;
  const body = Buffer.from(html, "utf8");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  const disposition = _req.query?.inline === "1" ? "inline" : "attachment";
  res.setHeader("Content-Disposition", `${disposition}; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader("Content-Length", String(body.length));
  res.setHeader("Cache-Control", "no-store");
  res.send(body);
});

app.post("/api/legal-registry/export-web", async (req, res) => {
  try {
    const exportedAt = new Date();
    const versionStamp = exportedAt
      .toISOString()
      .replace(/\D/g, "")
      .slice(0, 14);
    const data = await readLegalRegistry();
    const exportData = { ...data, exportedAt: exportedAt.toISOString(), exportType: "public-web" };
    const html = buildReadonlyHtml(exportData, exportedAt);
    const htmlPath = path.join(publicOyoungDir, publicLegalRegistryFileName);
    const versionedFileName = `legal-registry-${versionStamp}.html`;
    const versionedHtmlPath = path.join(publicOyoungDir, versionedFileName);

    await fs.mkdir(publicOyoungDir, { recursive: true });
    await fs.writeFile(htmlPath, html, "utf8");
    await fs.writeFile(versionedHtmlPath, html, "utf8");

    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const protocol = forwardedProto || req.protocol || "http";
    const baseUrl = `${protocol}://${req.get("host")}`;
    const hostedUrl = `${baseUrl}/exports/${versionedFileName}`;
    const latestUrl = `${baseUrl}/exports/${publicLegalRegistryFileName}`;
    const deployCommand = "npx firebase-tools deploy --only hosting --config firebase.oyoung.json";
    if (firebaseDeployEnabled) {
      await execFileAsync("cmd.exe", [
        "/c",
        "npx",
        "firebase-tools",
        "deploy",
        "--only",
        "hosting",
        "--config",
        "firebase.oyoung.json"
      ], {
        cwd: rootDir,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 10
      });
    }

    res.json({
      ok: true,
      deployed: firebaseDeployEnabled,
      exportedAt: exportedAt.toISOString(),
      html: htmlPath,
      publicPath: publicLegalRegistryFileName,
      versionedHtml: versionedHtmlPath,
      versionedPublicPath: versionedFileName,
      firebaseUrl: firebaseDeployEnabled ? `https://${firebaseProjectId}.web.app/${versionedFileName}` : hostedUrl,
      latestUrl: firebaseDeployEnabled ? `https://${firebaseProjectId}.web.app/${publicLegalRegistryFileName}` : latestUrl,
      firebaseAltUrl: `https://${firebaseProjectId}.firebaseapp.com/${versionedFileName}`,
      deployCommand: firebaseDeployEnabled ? deployCommand : ""
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "웹 보기용 HTML 생성에 실패했습니다." });
  }
});

app.post("/api/legal-registry/import-source", async (req, res) => {
  try {
    const sourcePath = compactText(req.body?.sourcePath) || defaultLegalRegistrySourcePath;
    const parsed = parseLegalRegistryWorkbook(sourcePath);
    const current = await readLegalRegistry();
    const payload = {
      ...current,
      sourcePath,
      records: parsed.records,
      detailCards: parsed.detailCards,
      updatedAt: new Date().toISOString()
    };
    await writeJson(legalRegistryDataPath, payload);
    res.json({ ok: true, records: payload.records.length, detailCards: payload.detailCards.length, data: payload });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "법규등록부 원본을 불러오지 못했습니다." });
  }
});

function normalizeDetailCardInput(input, existing = {}, index = 0) {
  const card = {
    ...existing,
    id: existing.id || input.id || `DETAIL-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    sheetName: compactText(input.sheetName || existing.sheetName || `사용자추가${index + 1}`),
    category: compactText(input.category || existing.category),
    lawName: compactText(input.lawName || existing.lawName),
    issuer: compactText(input.issuer || existing.issuer || "법제처"),
    channel: compactText(input.channel || existing.channel || "https://www.moleg.go.kr/"),
    revisionDate: displayLawDate(input.revisionDate || existing.revisionDate),
    registeredDate: displayLawDate(input.registeredDate || existing.registeredDate),
    team: compactText(input.team || existing.team || "ESQ"),
    author: compactText(input.author || existing.author),
    applicability: compactText(input.applicability || existing.applicability || "■해당 □해당무"),
    mainContent: preserveText(pickInputValue(input, existing, "mainContent")),
    companyAction: preserveText(pickInputValue(input, existing, "companyAction")),
    updatedAt: new Date().toISOString()
  };
  card.rows = [
    ["법규등록부"],
    ["구 분", card.category],
    ["법규명", card.lawName],
    ["발행처", "발행기관", card.issuer, "입수경로", card.channel],
    ["제,개정이력", "제,개정일", card.revisionDate, "등록일", card.registeredDate],
    ["등록자", "작성팀", card.team, "작성자", card.author],
    ["", "조항", "법규 적용내용"],
    ["", card.mainContent],
    ["당사해당 유무", card.applicability, `당사 적용사항\n${card.companyAction}`]
  ];
  return card;
}

app.post("/api/legal-registry/detail-cards", async (req, res) => {
  try {
    const data = await readLegalRegistry();
    const detailCards = Array.isArray(data.detailCards) ? data.detailCards : [];
    const card = normalizeDetailCardInput(req.body || {}, {}, detailCards.length);
    if (!card.lawName) return res.status(400).json({ ok: false, message: "법규명을 입력하세요." });
    const payload = {
      ...data,
      detailCards: [...detailCards, card],
      updatedAt: new Date().toISOString()
    };
    await writeJson(legalRegistryDataPath, payload);
    res.json({ ok: true, card, detailCards: payload.detailCards, updatedAt: payload.updatedAt });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "상세 법규를 추가하지 못했습니다." });
  }
});

app.put("/api/legal-registry/detail-cards/:id", async (req, res) => {
  try {
    const data = await readLegalRegistry();
    const detailCards = Array.isArray(data.detailCards) ? data.detailCards : [];
    const index = detailCards.findIndex((card) => card.id === req.params.id);
    if (index < 0) return res.status(404).json({ ok: false, message: "상세 법규를 찾지 못했습니다." });
    const card = normalizeDetailCardInput(req.body || {}, detailCards[index], index);
    if (!card.lawName) return res.status(400).json({ ok: false, message: "법규명을 입력하세요." });
    const nextCards = detailCards.slice();
    nextCards[index] = card;
    const payload = {
      ...data,
      detailCards: nextCards,
      updatedAt: new Date().toISOString()
    };
    await writeJson(legalRegistryDataPath, payload);
    res.json({ ok: true, card, detailCards: payload.detailCards, updatedAt: payload.updatedAt });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "상세 법규를 수정하지 못했습니다." });
  }
});

app.post("/api/legal-registry/refresh", async (req, res) => {
  try {
    const oc = compactText(req.body?.oc || defaultLawOpenApiOc);
    if (!oc) {
      return res.status(400).json({ ok: false, message: "법제처 Open API 인증값(OC)을 입력하세요." });
    }
    const data = await readLegalRegistry();
    const uniqueRecords = [];
    const seen = new Set();
    for (const record of data.records || []) {
      const key = makeLawKey(record.lawName);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniqueRecords.push(record);
    }

    const checked = [];
    const errors = [];
    for (const record of uniqueRecords) {
      try {
        const official = await searchOfficialLaw(record.lawName, oc);
        if (!official) {
          errors.push({ lawName: record.lawName, message: "검색 결과 없음" });
          continue;
        }
        checked.push(buildChange(record, official));
      } catch (error) {
        errors.push({ lawName: record.lawName, message: error.message || "조회 실패" });
      }
      await wait(120);
    }

    const autoAppliedAt = new Date().toISOString();
    const byLaw = new Map(checked.map((item) => [makeLawKey(item.lawName), item]));
    const records = (data.records || []).map((record) => {
      const change = byLaw.get(makeLawKey(record.lawName));
      if (!change) return record;
      const changed = change.status === "new";
      return {
        ...record,
        registeredEffectiveDate: changed ? (change.effectiveDate || record.registeredEffectiveDate) : record.registeredEffectiveDate,
        officialEffectiveDate: change.effectiveDate || record.officialEffectiveDate || "",
        promulgationDate: change.promulgationDate || record.promulgationDate || "",
        lawId: change.lawId || record.lawId || "",
        status: changed ? "자동등록" : "최신",
        updatedAt: change.checkedAt
      };
    });
    const pendingChanges = checked
      .filter((item) => item.status === "new")
      .map((item) => ({
        ...item,
        status: "auto-applied",
        summary: "새로고침으로 변경 법규를 자동 등록했습니다.",
        appliedAt: autoAppliedAt
      }));
    const existingChangeKeys = new Set((data.changes || []).map((item) => `${makeLawKey(item.lawName)}|${normalizeLawDate(item.effectiveDate)}`));
    const newChanges = pendingChanges.filter((item) => !existingChangeKeys.has(`${makeLawKey(item.lawName)}|${normalizeLawDate(item.effectiveDate)}`));
    const changes = [
      ...newChanges,
      ...(data.changes || [])
    ];
    const log = {
      at: new Date().toISOString(),
      ok: errors.length === 0,
      checked: checked.length,
      changed: newChanges.length,
      errors
    };
    const payload = {
      ...data,
      records,
      changes,
      refreshLogs: [log, ...(Array.isArray(data.refreshLogs) ? data.refreshLogs : [])].slice(0, 20),
      updatedAt: log.at
    };
    await writeJson(legalRegistryDataPath, payload);
    res.json({ ok: true, log, records, changes, checked, errors, updatedAt: payload.updatedAt });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "법규 새로고침에 실패했습니다." });
  }
});

app.post("/api/legal-registry/changes/:id/apply", async (req, res) => {
  const data = await readLegalRegistry();
  const changes = Array.isArray(data.changes) ? data.changes : [];
  const change = changes.find((item) => item.id === req.params.id);
  if (!change) return res.status(404).json({ ok: false, message: "변경 항목을 찾지 못했습니다." });
  const records = (data.records || []).map((record) => {
    if (record.id !== change.recordId) return record;
    return {
      ...record,
      registeredEffectiveDate: change.effectiveDate || record.registeredEffectiveDate,
      officialEffectiveDate: change.effectiveDate || record.officialEffectiveDate,
      promulgationDate: change.promulgationDate || record.promulgationDate,
      lawId: change.lawId || record.lawId,
      status: "등록완료",
      updatedAt: new Date().toISOString()
    };
  });
  change.status = "applied";
  change.appliedAt = new Date().toISOString();
  const payload = { ...data, records, changes, updatedAt: change.appliedAt };
  await writeJson(legalRegistryDataPath, payload);
  res.json({ ok: true, change, records, changes });
});

app.get("/api/legal-registry/change-content/:id", async (req, res) => {
  try {
    const data = await readLegalRegistry();
    const change = (Array.isArray(data.changes) ? data.changes : []).find((item) => item.id === req.params.id);
    if (!change) return res.status(404).json({ ok: false, message: "변경 항목을 찾지 못했습니다." });
    const oc = compactText(req.query?.oc || defaultLawOpenApiOc);
    const content = await fetchOfficialLawContent({
      lawName: change.lawName,
      mst: change.mst,
      lawId: change.lawId,
      oc,
      effectiveDate: change.effectiveDate
    });
    let articleDiffs = [];
    try {
      const previousContent = await fetchOfficialLawContent({
        lawName: change.lawName,
        lawId: content.lawId || change.lawId,
        oc,
        effectiveDate: change.previousEffectiveDate
      });
      articleDiffs = diffArticles(previousContent.articles || [], content.articles || []);
      if (!articleDiffs.length) {
        articleDiffs = (content.articles || [])
          .filter((item) => item.changed)
          .slice(0, 80)
          .map((item) => ({
            type: "current-only",
            heading: item.heading,
            notice: "이전 시행본 원문 비교 대신 법제처가 변경 표시한 최신 조문입니다.",
            after: item.text
          }));
      }
    } catch (error) {
      articleDiffs = [{ type: "notice", heading: "이전 시행본 비교 불가", notice: error.message || "이전 시행본을 불러오지 못했습니다." }];
    }
    if (!articleDiffs.length && content.amendmentLines?.length) {
      articleDiffs = content.amendmentLines.slice(0, 60).map((line, index) => ({
        type: "amendment",
        heading: `개정문 ${index + 1}`,
        notice: "법제처 개정문에 포함된 변경 내용입니다.",
        before: line
      }));
    }
    change.contentCheckedAt = new Date().toISOString();
    change.amendmentLines = content.amendmentLines;
    change.reasonLines = content.reasonLines;
    change.articleDiffs = articleDiffs;
    change.mst = change.mst || content.mst;
    change.lawId = change.lawId || content.lawId;
    await writeJson(legalRegistryDataPath, { ...data, updatedAt: change.contentCheckedAt });
    res.json({ ok: true, change, content });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "변경 내용을 불러오지 못했습니다." });
  }
});

function isRefreshUpdateQuestion(question) {
  const normalized = normalizeLawName(question);
  const refreshWords = ["새로고침", "업데이트", "오늘", "방금", "이번", "최근", "현재", "수정", "변경", "바뀐", "변경이력"];
  const targetWords = ["법규", "법령", "등록부", "업데이트", "변경", "수정", "바뀐"];
  return refreshWords.some((word) => normalized.includes(normalizeLawName(word)))
    && targetWords.some((word) => normalized.includes(normalizeLawName(word)));
}

function displayRefreshDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return compactText(value);
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildRefreshUpdateAiAnswer(refreshChanges, lastRefreshLog) {
  const changes = Array.isArray(refreshChanges) ? refreshChanges : [];
  const checked = Number(lastRefreshLog?.checked || 0);
  const changed = Number(lastRefreshLog?.changed ?? changes.length);
  const refreshedAt = displayRefreshDateTime(lastRefreshLog?.at);

  if (!changes.length) {
    return {
      ok: true,
      model: "refresh-log",
      answer: `${refreshedAt ? `${refreshedAt} 새로고침 기준으로 ` : "이번 새로고침 기준으로 "}새로 잡힌 변경 법규는 없습니다.${checked ? ` 총 ${checked}건을 확인했고 변경이력 신규 등록은 0건입니다.` : ""}`,
      recommendedLaws: [],
      siteRisks: [],
      actionPlan: ["필요하면 상단 새로고침을 다시 눌러 최신 법제처 시행일을 확인하세요."],
      checkpoints: ["이 답변은 현재 화면에서 마지막으로 실행한 새로고침 결과만 기준으로 합니다."],
      caution: "법규 일반 검색이 아니라 이번 새로고침 변경이력을 기준으로 답변했습니다."
    };
  }

  return {
    ok: true,
    model: "refresh-log",
    answer: `${refreshedAt ? `${refreshedAt} 새로고침 기준으로 ` : "이번 새로고침 기준으로 "}수정/업데이트된 법규는 ${changed || changes.length}건입니다. 아래 법규들이 법제처 최신 시행일과 등록부 시행일이 달라 자동 변경이력으로 잡혔습니다.`,
    recommendedLaws: changes.map((change) => ({
      lawName: compactText(change.lawName),
      reason: `등록 시행일 ${displayLawDate(change.previousEffectiveDate) || "-"} -> 최신 시행일 ${displayLawDate(change.effectiveDate) || "-"}${change.promulgationDate ? `, 공포일 ${displayLawDate(change.promulgationDate)}` : ""}`
    })),
    siteRisks: [],
    actionPlan: [
      "변경이력 탭에서 각 법규의 상세 버튼을 눌러 변경 조문을 확인하세요.",
      "당사 적용사항에 영향이 있는 법규는 법규등록부 1~5 내용과 작업표준, 허가/신고, 교육자료 반영 여부를 확인하세요."
    ],
    checkpoints: [
      "이 목록은 현재 화면에서 마지막으로 누른 새로고침에서 새로 감지된 변경분입니다.",
      "이미 과거에 등록된 같은 시행일 변경분은 중복 집계하지 않습니다."
    ],
    caution: "법규 일반 검색이 아니라 이번 새로고침 변경이력을 기준으로 답변했습니다."
  };
}

function buildLocalLegalAiAnswer(question, candidates, registryRecords, reason = "") {
  const normalizedQuestion = compactText(question).toLowerCase();
  const fallbackKeywords = [
    { words: ["분진", "먼지", "분말", "호흡", "마스크", "노출"], laws: ["산업안전보건법", "화학물질관리법"] },
    { words: ["폐수", "방류", "색도", "수질"], laws: ["물환경보전법", "하수도법"] },
    { words: ["대기", "배출", "방지시설", "집진", "먼지", "voc", "악취"], laws: ["대기환경보전법", "악취방지법"] },
    { words: ["화학", "유해화학", "msds", "누출", "보관", "취급"], laws: ["화학물질관리법", "화학물질의 등록 및 평가 등에 관한 법률", "산업안전보건법"] },
    { words: ["위험물", "인화", "화재", "폭발", "소방"], laws: ["위험물안전관리법", "소방시설 설치 및 관리에 관한 법률"] },
    { words: ["폐기물", "지정폐기물", "보관", "처리"], laws: ["폐기물관리법", "자원의 절약과 재활용촉진에 관한 법률"] },
    { words: ["연구실", "실험실", "시약"], laws: ["연구실 안전환경 조성에 관한 법률"] },
    { words: ["소음", "진동", "청력"], laws: ["산업안전보건법", "소음ㆍ진동관리법"] },
    { words: ["온열", "폭염", "더위", "열사병"], laws: ["산업안전보건법"] }
  ];
  const records = Array.isArray(registryRecords) ? registryRecords : [];
  const candidateLaws = Array.isArray(candidates) ? candidates : [];
  const pickedNames = [];

  for (const candidate of candidateLaws) {
    if (candidate?.lawName) pickedNames.push(candidate.lawName);
  }
  for (const rule of fallbackKeywords) {
    if (!rule.words.some((word) => normalizedQuestion.includes(word))) continue;
    pickedNames.push(...rule.laws);
  }

  const recommended = [];
  for (const lawName of Array.from(new Set(pickedNames.filter(Boolean)))) {
    const matchedRecord = records.find((record) => normalizeLawName(record.lawName).includes(normalizeLawName(lawName)))
      || records.find((record) => normalizeLawName(lawName).includes(normalizeLawName(record.lawName)));
    if (!matchedRecord && !lawName) continue;
    recommended.push({
      lawName: matchedRecord?.lawName || lawName,
      reason: "(주)오영 염료 제조업 현장 질문과 관련성이 높아 우선 확인할 법규입니다."
    });
    if (recommended.length >= 6) break;
  }

  return {
    ok: true,
    model: "local-fallback",
    answer: `오영 법규등록부 기준으로 답변합니다. "${question}"은 (주)오영의 염료 제조, 화학물질 취급, 작업환경 또는 환경 배출 관리와 연결될 수 있으므로 아래 법규와 현장 조치를 우선 확인하세요.`,
    recommendedLaws: recommended,
    siteRisks: [
      "염료 분말, 화학물질, 용제, 폐수, 대기배출시설 등 현장 위험요인과 연결되는지 확인",
      "작업 장소, 취급 물질, 배출 또는 노출 경로를 기준으로 적용 법규 분류"
    ],
    actionPlan: [
      "관련 작업의 MSDS, 작업표준, 보호구, 교육기록을 먼저 확인",
      "해당 설비 또는 공정의 점검기록, 측정기록, 인허가 조건과 법규등록부 적용사항을 대조",
      "법규 원문과 시행규칙 세부 기준을 확인한 뒤 당사 적용사항에 반영"
    ],
    checkpoints: [
      "질문한 작업이 어떤 공정인지: 계량, 혼합, 반응, 건조, 포장, 보관, 폐수처리, 방지시설",
      "사람 노출인지, 환경 배출인지, 인허가/신고 사항인지 구분",
      "최근 새로고침으로 시행일 변경이 잡혔는지 확인"
    ],
    caution: reason ? `오영 기본 답변을 표시했습니다. 사유: ${reason}` : "AI API 키가 없어서 오영 기본 답변을 표시했습니다."
  };
}

app.post("/api/legal-registry/ai-answer", async (req, res) => {
  try {
    const question = compactText(req.body?.question);
    if (!question) return res.status(400).json({ ok: false, message: "질문을 입력하세요." });

    const registry = await readLegalRegistry();
    const refreshChanges = Array.isArray(req.body?.refreshChanges) ? req.body.refreshChanges : [];
    const lastRefreshLog = req.body?.lastRefreshLog && typeof req.body.lastRefreshLog === "object" ? req.body.lastRefreshLog : null;
    if (req.body?.refreshQuestion || isRefreshUpdateQuestion(question)) {
      return res.json(buildRefreshUpdateAiAnswer(refreshChanges, lastRefreshLog));
    }

    const requestedCandidates = Array.isArray(req.body?.candidates) ? req.body.candidates : [];
    const registryRecords = Array.isArray(registry.records) ? registry.records : [];
    const candidates = requestedCandidates.length
      ? requestedCandidates
      : registryRecords.slice(0, 80).map((record) => ({
          lawName: record.lawName,
          group: record.group,
          no: record.no,
          effectiveDate: record.officialEffectiveDate || record.registeredEffectiveDate
        }));
    const registryIndex = registryRecords.slice(0, 120).map((record) => ({
      lawName: record.lawName,
      group: record.group,
      no: record.no,
      effectiveDate: record.officialEffectiveDate || record.registeredEffectiveDate
    }));

    const config = await readSafetyConfig();
    const apiKey = getSafetyGeminiApiKey(config);
    if (!apiKey) {
      return res.json(buildLocalLegalAiAnswer(question, candidates, registryRecords, "AI API 키가 서버에 설정되지 않았습니다."));
    }

    const prompt = [
      "당신은 제조업 사업장의 법규등록부를 도와주는 한국어 법규 상담형 검색 보조자입니다.",
      "아래 회사 프로필을 항상 기준으로 삼아 답하세요.",
      JSON.stringify(legalRegistryCompanyProfile, null, 2),
      "사용자 질문의 표현이 등록부 키워드와 정확히 일치하지 않아도, 작업 상황ㆍ위험요인ㆍ설비ㆍ물질ㆍ환경영향을 추론해 관련 법규 분야를 넓게 찾아주세요.",
      "후보 법령은 참고자료입니다. 후보가 부족하면 등록부 전체 목록과 회사 프로필을 바탕으로 가능한 관련 법령을 추천하되, 확정이 필요한 부분은 원문 확인 필요로 표시하세요.",
      "등록부에 없는 법령명을 새로 만들지 마세요. 다만 질문상 확인해야 할 법 분야는 answer/caution에 설명할 수 있습니다.",
      "답변은 (주)오영의 염료 제조공정에서 실제로 확인할 조치 중심으로 작성하세요.",
      "법률 자문이 아니라 내부 준수 검토용 안내입니다.",
      "반드시 JSON으로만 답하세요. 형식: {\"answer\":\"...\", \"recommendedLaws\":[{\"lawName\":\"...\",\"reason\":\"...\"}], \"siteRisks\":[\"...\"], \"actionPlan\":[\"...\"], \"checkpoints\":[\"...\"], \"caution\":\"...\"}",
      "",
      `질문: ${question}`,
      "",
      "후보 법령:",
      JSON.stringify(candidates.slice(0, 20), null, 2),
      "",
      "등록부 전체 목록:",
      JSON.stringify(registryIndex, null, 2)
    ].join("\n");

    const result = await requestSafetyGeminiText(apiKey, prompt).catch((error) => null);
    if (!result) {
      return res.json(buildLocalLegalAiAnswer(question, candidates, registryRecords, "AI 답변 생성에 실패했습니다."));
    }
    let parsed = null;
    try {
      parsed = JSON.parse(result.text || "{}");
    } catch {
      parsed = { answer: result.text || "", recommendedLaws: [], checkpoints: [], caution: "AI 응답을 JSON으로 해석하지 못했습니다." };
    }

    res.json({ ok: true, model: result.model, ...parsed });
  } catch (error) {
    res.status(500).json({ ok: false, message: error.message || "AI 답변 생성에 실패했습니다." });
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
  const data = await readRuntimeJsonWithSeed(sharedGridDataPath, sharedGridDataSeedPath, {
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
  const data = await readRuntimeJsonWithSeed(safetyDataPath, safetyDataSeedPath, { records: [], updatedAt: null });
  res.json(data);
});

app.get("/api/safety-data/status", async (_req, res) => {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    const probePath = path.join(dataDir, `.write-check-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.tmp`);
    await fs.writeFile(probePath, "ok", "utf8");
    await fs.unlink(probePath);
    const data = await readRuntimeJsonWithSeed(safetyDataPath, safetyDataSeedPath, { records: [], updatedAt: null });
    let stat = null;
    try {
      stat = await fs.stat(safetyDataPath);
    } catch {
      stat = null;
    }
    res.json({
      ok: true,
      dataDir,
      safetyDataPath,
      writable: true,
      records: Array.isArray(data.records) ? data.records.length : 0,
      updatedAt: data.updatedAt || null,
      fileUpdatedAt: stat ? stat.mtime.toISOString() : null,
      fileSize: stat ? stat.size : 0
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      dataDir,
      safetyDataPath,
      writable: false,
      message: error.message || "safety data status failed"
    });
  }
});

app.get("/api/safety-settings", async (_req, res) => {
  const data = await readJson(safetySettingsPath, { departmentStamps: {}, updatedAt: null });
  res.json(data);
});

app.put("/api/safety-settings", async (req, res) => {
  const payload = {
    departmentStamps: req.body?.departmentStamps && typeof req.body.departmentStamps === "object" ? req.body.departmentStamps : {},
    updatedAt: new Date().toISOString()
  };
  await writeJson(safetySettingsPath, payload);
  res.json({ ok: true, departments: Object.keys(payload.departmentStamps).length, updatedAt: payload.updatedAt });
});

app.get("/api/safety-form-submissions", async (_req, res) => {
  const data = await readJson(safetyFormSubmissionsPath, { submissions: [], updatedAt: null });
  res.json(data);
});

app.post("/api/safety-form-submissions", async (req, res) => {
  const current = await readJson(safetyFormSubmissionsPath, { submissions: [], updatedAt: null });
  const draft = req.body?.draft && typeof req.body.draft === "object" ? req.body.draft : {};
  const user = req.body?.user && typeof req.body.user === "object" ? req.body.user : {};
  const submittedAt = new Date().toISOString();
  const submission = {
    id: `FORM-${submittedAt.replace(/\D/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`,
    submittedAt,
    status: "submitted",
    user: {
      id: String(user.id || ""),
      name: String(user.name || user.id || ""),
      role: String(user.role || ""),
      department: String(user.department || "")
    },
    draft
  };
  const submissions = Array.isArray(current.submissions) ? current.submissions : [];
  submissions.unshift(submission);
  const payload = { submissions, updatedAt: submittedAt };
  await writeJson(safetyFormSubmissionsPath, payload);
  res.json({ ok: true, submission });
});

app.put("/api/safety-form-submissions/:id/status", async (req, res) => {
  const current = await readJson(safetyFormSubmissionsPath, { submissions: [], updatedAt: null });
  const submissions = Array.isArray(current.submissions) ? current.submissions : [];
  const item = submissions.find((entry) => entry.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, message: "제출 데이터를 찾지 못했습니다." });
  item.status = String(req.body?.status || item.status || "submitted");
  item.reviewedAt = new Date().toISOString();
  const payload = { submissions, updatedAt: item.reviewedAt };
  await writeJson(safetyFormSubmissionsPath, payload);
  res.json({ ok: true, submission: item });
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

app.use("/assets", express.static(path.join(rootDir, "assets")));
app.use("/frontend", express.static(path.join(rootDir, "frontend")));
app.use("/exports", express.static(publicOyoungDir, {
  setHeaders(res) {
    res.setHeader("Cache-Control", "no-store");
  }
}));
app.use("/vendor", express.static(path.join(rootDir, "node_modules")));

function listenOnPort(targetPort) {
  const server = app.listen(targetPort, host, () => {
    console.log(`ESQ safety app running at http://127.0.0.1:${targetPort}/safety`);
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

