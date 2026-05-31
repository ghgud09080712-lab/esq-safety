const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dataPath = path.join(rootDir, "backend", "data", "legal-registry.json");
const indexPath = path.join(rootDir, "frontend", "legal-registry", "index.html");
const cssPath = path.join(rootDir, "frontend", "legal-registry", "legal-registry.css");
const jsPath = path.join(rootDir, "frontend", "legal-registry", "legal-registry.js");
const logoPath = path.join(rootDir, "assets", "ohyoung-legal-logo.png");

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function makeReadonlyScript(appJs) {
  const readonlyRequestJson = `async function requestJson(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const cloneData = () => JSON.parse(JSON.stringify(window.__LEGAL_REGISTRY_EXPORT_DATA__ || {}));
  if (url === "/api/legal-registry" && method === "GET") return cloneData();
  if (url.startsWith("/api/legal-registry/change-content/") && method === "GET") {
    const id = decodeURIComponent(url.split("/").pop() || "");
    const data = cloneData();
    const change = (data.changes || []).find((item) => item.id === id);
    if (!change) throw new Error("변경 항목을 찾지 못했습니다.");
    return { ok: true, change, content: { amendmentLines: change.amendmentLines || [], reasonLines: change.reasonLines || [], articleDiffs: change.articleDiffs || [] } };
  }
  throw new Error("보기 전용 HTML에서는 수정, 저장, 새로고침, AI 조회를 사용할 수 없습니다.");
}`;

  let patched = appJs.replace(
    /async function requestJson\(url, options = \{\}\) \{[\s\S]*?\n\}/,
    readonlyRequestJson
  );

  patched = patched.replace(
    /const VALID_HISTORY_VIEWS = new Set\(\["dashboard", "registry", "detailSheets", "changes", "aiSearch"\]\);/,
    `const VALID_HISTORY_VIEWS = new Set(["dashboard", "registry", "detailSheets", "changes"]);`
  );

  patched = patched.replace(
    /function exportReadonlyHtml\(\) \{[\s\S]*?\n\}/,
    `function exportReadonlyHtml() {
  showToast("이미 보기 전용 HTML 화면입니다.", "success");
}`
  );

  patched = patched
    .replace(`$("#exportBtn").addEventListener("click", exportReadonlyHtml);`, `$("#exportBtn")?.addEventListener("click", exportReadonlyHtml);`)
    .replace(`$("#detailAddBtn").addEventListener("click", () => {`, `$("#detailAddBtn")?.addEventListener("click", () => {`)
    .replace(`$("#aiLawSearchBtn").addEventListener("click", () => renderAiSearchResults($("#aiLawQuery").value, { useGemini: true }));`, `$("#aiLawSearchBtn")?.addEventListener("click", () => renderAiSearchResults($("#aiLawQuery").value, { useGemini: true }));`)
    .replace(`$("#aiLawQuery").addEventListener("keydown", (event) => {`, `$("#aiLawQuery")?.addEventListener("keydown", (event) => {`);

  return patched;
}

function buildReadonlyHtml(data, generatedAt = new Date()) {
  const originalHtml = fs.readFileSync(indexPath, "utf8");
  const appCss = fs.readFileSync(cssPath, "utf8");
  const appJs = fs.readFileSync(jsPath, "utf8");
  const logoDataUrl = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  const readonlyCss = `
body.readonly-export #detailAddBtn,
body.readonly-export [data-detail-edit],
body.readonly-export [data-detail-cancel],
body.readonly-export .detail-edit-actions,
body.readonly-export #exportBtn,
body.readonly-export #webExportBtn,
body.readonly-export #refreshBtn,
body.readonly-export #topRefreshBtn {
  display: none !important;
}
body.readonly-export .tool-status::after {
  content: " · 보기 전용";
}
body.readonly-export input,
body.readonly-export textarea,
body.readonly-export select {
  pointer-events: none;
}
body.readonly-export #registrySearch,
body.readonly-export #changeSearch {
  pointer-events: auto;
}
body.readonly-export #registryView.view.active {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
body.readonly-export #registryView .section-head {
  flex: 0 0 auto;
  z-index: 8;
  background: var(--bg);
}
body.readonly-export #registryView .registry-search-bar {
  flex: 0 0 auto;
}
body.readonly-export #registryView .table-panel {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
@media (max-width: 700px) {
  body.readonly-export {
    font-size: 13px;
  }
  body.readonly-export .app-shell {
    height: 100dvh;
    overflow: hidden;
  }
  body.readonly-export .sidebar {
    position: fixed;
    inset: auto;
    top: 58px;
    left: 0;
    width: 100%;
    height: auto;
    transform: none !important;
    pointer-events: auto !important;
    z-index: 70;
    background: #0f3261;
  }
  body.readonly-export .brand,
  body.readonly-export .side-tools {
    display: none !important;
  }
  body.readonly-export .nav-list {
    display: flex;
    gap: 6px;
    padding: 8px 10px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  body.readonly-export .nav-list::-webkit-scrollbar {
    display: none;
  }
  body.readonly-export .nav-item {
    flex: 0 0 auto;
    min-height: 36px;
    border-radius: 999px;
    padding: 0 13px;
    white-space: nowrap;
    font-size: 12px;
  }
  body.readonly-export .main {
    height: 100dvh;
    min-height: 100dvh;
    margin-left: 0 !important;
    padding-top: 110px;
    overflow: hidden;
  }
  body.readonly-export .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 80;
    min-height: 58px;
    padding: 6px 12px;
    align-items: center;
    justify-content: center;
    gap: 0;
  }
  body.readonly-export .topbar-title {
    display: none !important;
  }
  body.readonly-export .topbar-logo-layer {
    position: static;
    left: auto;
    top: auto;
    transform: none;
  }
  body.readonly-export .topbar-center-logo {
    width: 126px;
    max-width: 42vw;
  }
  body.readonly-export .eyebrow {
    font-size: 10px;
  }
  body.readonly-export h1 {
    font-size: 20px;
  }
  body.readonly-export h2 {
    font-size: 18px;
  }
  body.readonly-export .title-row {
    gap: 8px;
  }
  body.readonly-export .menu-toggle {
    display: none !important;
  }
  body.readonly-export .topbar-actions {
    width: 100%;
    min-width: 0;
    justify-content: flex-start;
    gap: 6px;
  }
  body.readonly-export .topbar-actions .btn {
    min-height: 32px;
    padding: 0 10px;
    font-size: 12px;
  }
  body.readonly-export .view {
    padding: 14px 12px 22px;
  }
  body.readonly-export #registryView.view.active {
    height: calc(100dvh - 110px);
  }
  body.readonly-export .section-head {
    gap: 10px;
    margin-bottom: 12px;
  }
  body.readonly-export .section-head p {
    line-height: 1.55;
    font-size: 12px;
  }
  body.readonly-export .metric {
    min-height: 82px;
    padding: 14px;
  }
  body.readonly-export .metric strong {
    font-size: 24px;
  }
  body.readonly-export .table-panel {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  body.readonly-export table {
    min-width: 680px;
  }
  body.readonly-export th,
  body.readonly-export td {
    padding: 9px 10px;
    font-size: 12px;
  }
  body.readonly-export .change-item {
    padding: 12px;
    gap: 10px;
  }
  body.readonly-export .date-flow {
    grid-template-columns: 1fr;
  }
  body.readonly-export .detail-register-head {
    min-height: 72px;
    padding: 12px;
  }
  body.readonly-export .detail-register-title h3 {
    font-size: 17px;
    line-height: 1.35;
  }
  body.readonly-export .detail-register-actions {
    align-items: flex-end;
    min-width: auto;
  }
  body.readonly-export .detail-meta-bar {
    grid-template-columns: 1fr;
  }
  body.readonly-export .detail-meta-item {
    min-height: 62px;
    border-right: 0;
    border-bottom: 1px solid var(--border);
    padding: 12px;
  }
  body.readonly-export .detail-main-title {
    min-height: 44px;
    padding: 10px 12px;
    align-items: flex-start;
    flex-direction: column;
  }
  body.readonly-export .detail-main-panel pre {
    padding: 14px 12px;
    line-height: 1.75;
    font-size: 12px;
  }
}
`;

  const embeddedData = `<script>
window.__LEGAL_REGISTRY_READONLY__ = true;
window.__LEGAL_REGISTRY_EXPORT_GENERATED_AT__ = ${JSON.stringify(generatedAt.toISOString())};
window.__LEGAL_REGISTRY_EXPORT_DATA__ = ${safeJson(data)};
</script>`;

  const appMeta = `
  <meta name="theme-color" content="#0f3261">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="법규등록부">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <link rel="manifest" href="/manifest.webmanifest">`;

  const readonlyHtml = originalHtml
    .replace(/\s*<button class="nav-item" data-view="aiSearch" type="button">[\s\S]*?<\/button>/, "")
    .replace(/\s*<button class="btn" data-jump="aiSearch" type="button">[\s\S]*?<\/button>/, "")
    .replace(/\s*<button class="btn" id="exportBtn" type="button">[\s\S]*?<\/button>/, "")
    .replace(/\s*<section id="aiSearchView" class="view">[\s\S]*?\n      <\/section>\n\n    <\/main>/, "\n\n    </main>");

  return readonlyHtml
    .replace("</head>", `${appMeta}\n</head>`)
    .replace(/<link rel="stylesheet" href="\/frontend\/legal-registry\/legal-registry\.css\?v=[^"]+">/, `<style>\n${appCss}\n${readonlyCss}\n</style>`)
    .replace(/src="\/assets\/ohyoung-legal-logo\.png"/g, `src="${logoDataUrl}"`)
    .replace(/<body class="([^"]*)">/, (_match, className) => {
      const classes = className.split(/\s+/).filter(Boolean);
      if (!classes.includes("sidebar-collapsed")) classes.push("sidebar-collapsed");
      return `<body class="${[...classes, "readonly-export"].join(" ")}">`;
    })
    .replace(/<script src="\/frontend\/legal-registry\/legal-registry\.js\?v=[^"]+"><\/script>/, () => `${embeddedData}\n<script>\n${makeReadonlyScript(appJs)}\n</script>`);
}

module.exports = { buildReadonlyHtml };

if (require.main === module) {
  const outputPath = process.argv[2] || path.join(rootDir, "법규등록부_보기전용.html");
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const documentHtml = buildReadonlyHtml(data, new Date());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, documentHtml, "utf8");
  console.log(outputPath);
}
