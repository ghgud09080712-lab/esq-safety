const state = {
  data: { records: [], detailCards: [], changes: [], refreshLogs: [] },
  activeView: "dashboard",
  search: "",
  changeSearch: "",
  qcFilter: "전체",
  addingDetail: false,
  editingDetailId: "",
  expandedDetailIds: new Set(),
  currentRefreshChanged: 0,
  selectedChangeId: "",
  selectedPreviewLaw: ""
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const VALID_HISTORY_VIEWS = new Set(["dashboard", "registry", "detailSheets", "changes"]);
let restoringHistory = false;
const FLOATING_AI_POSITION_KEY = "ohyoungLegalFloatingAiPosition";
const DATA_SYNC_INTERVAL_MS = 8000;
const floatingAiDrag = {
  active: false,
  moved: false,
  pointerId: null,
  startX: 0,
  startY: 0,
  originLeft: 0,
  originTop: 0,
  suppressClick: false
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function tokenizeDiffText(value) {
  return String(value || "")
    .split(/(\s+|[,.!?;:()"'“”‘’「」『』<>\[\]{}ㆍ·\-]+)/)
    .filter((token) => token !== "");
}

function buildInlineDiff(before, after) {
  const a = tokenizeDiffText(before);
  const b = tokenizeDiffText(after);
  const maxCells = 120000;
  if (!a.length || !b.length || a.length * b.length > maxCells) {
    return {
      beforeHtml: escapeHtml(before),
      afterHtml: escapeHtml(after)
    };
  }
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const beforeParts = [];
  const afterParts = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      beforeParts.push(escapeHtml(a[i]));
      afterParts.push(escapeHtml(b[j]));
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      beforeParts.push(`<span class="diff-removed">${escapeHtml(a[i])}</span>`);
      i += 1;
    } else {
      afterParts.push(`<span class="diff-added">${escapeHtml(b[j])}</span>`);
      j += 1;
    }
  }
  while (i < a.length) {
    beforeParts.push(`<span class="diff-removed">${escapeHtml(a[i])}</span>`);
    i += 1;
  }
  while (j < b.length) {
    afterParts.push(`<span class="diff-added">${escapeHtml(b[j])}</span>`);
    j += 1;
  }
  return {
    beforeHtml: beforeParts.join(""),
    afterHtml: afterParts.join("")
  };
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatLawDate(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}. ${Number(compact[2])}. ${Number(compact[3])}`;
  const normal = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (normal) return `${normal[1]}. ${Number(normal[2])}. ${Number(normal[3])}`;
  const dotted = text.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  if (dotted) return `${dotted[1]}. ${Number(dotted[2])}. ${Number(dotted[3])}`;
  return text.replace(/(\d)\.$/, "$1");
}

function parseLawDateValue(value) {
  const text = String(value || "").trim();
  if (!text || text === "-") return null;
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  const normal = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dotted = text.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
  const match = compact || normal || dotted;
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function qcToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function showToast(message, type = "") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast ${type}`.trim();
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, type === "success" ? 5200 : 3600);
}

function showResult(message, type = "success") {
  const alert = $("#resultAlert");
  if (!alert) return;
  alert.textContent = message;
  alert.className = `result-alert ${type === "error" ? "error" : ""}`.trim();
  alert.hidden = false;
}

function setStatus(message) {
  $("#statusBox").textContent = message;
}

function setRefreshBusy(isBusy) {
  const refreshOverlay = $("#refreshOverlay");
  const refreshBtn = $("#refreshBtn");
  const topRefreshBtn = $("#topRefreshBtn");
  const mobileRefreshBtn = $("#mobileRefreshBtn");
  document.body.classList.toggle("is-refreshing", isBusy);
  if (refreshOverlay) refreshOverlay.hidden = !isBusy;
  if (refreshBtn) {
    refreshBtn.disabled = isBusy;
    refreshBtn.textContent = isBusy ? "확인 중..." : "새로고침";
  }
  if (topRefreshBtn) {
    topRefreshBtn.disabled = isBusy;
    topRefreshBtn.textContent = isBusy ? "확인 중..." : "새로고침";
  }
  if (mobileRefreshBtn) {
    mobileRefreshBtn.disabled = isBusy;
    mobileRefreshBtn.textContent = isBusy ? "확인 중..." : "새로고침";
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.message || payload.error?.message || `HTTP ${response.status}`);
  return payload;
}

async function loadData() {
  state.data = await requestJson("/api/legal-registry");
  const sourceInput = $("#sourcePathInput");
  if (sourceInput) sourceInput.value = state.data.sourcePath || "";
  render();
}

async function syncLatestData(options = {}) {
  if (state.addingDetail || state.editingDetailId) return;
  try {
    const latest = await requestJson("/api/legal-registry");
    const previousVersion = JSON.stringify({
      updatedAt: state.data.updatedAt || "",
      detailCards: state.data.detailCards || [],
      records: state.data.records || [],
      changes: state.data.changes || []
    });
    const latestVersion = JSON.stringify({
      updatedAt: latest.updatedAt || "",
      detailCards: latest.detailCards || [],
      records: latest.records || [],
      changes: latest.changes || []
    });
    if (previousVersion === latestVersion) return;
    state.data = latest;
    render();
    if (!options.silent) showToast("최신 법규등록부 내용을 반영했습니다.", "success");
  } catch (error) {
    if (!options.silent) showToast(error.message, "error");
  }
}

function switchView(view, options = {}) {
  if (!VALID_HISTORY_VIEWS.has(view)) view = "dashboard";
  state.activeView = view;
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((section) => section.classList.toggle("active", section.id === `${view}View`));
  requestAnimationFrame(fitRegistryTable);
  if (!options.skipHistory && !restoringHistory) {
    const url = new URL(window.location.href);
    url.hash = view;
    history.pushState({ legalRegistryApp: true, view }, "", url);
  }
}

function fitRegistryTable() {
  const view = $("#registryView");
  const panel = $("#registryView .table-panel");
  if (!view?.classList.contains("active") || !panel) return;
  const rect = panel.getBoundingClientRect();
  const bottomPadding = 28;
  const available = Math.max(220, window.innerHeight - rect.top - bottomPadding);
  panel.style.height = `${available}px`;
  panel.style.maxHeight = `${available}px`;
}

function viewFromLocation() {
  const hashView = window.location.hash.replace(/^#/, "");
  return VALID_HISTORY_VIEWS.has(hashView) ? hashView : "dashboard";
}

function setupAppHistory() {
  const initialView = viewFromLocation();
  history.replaceState({ legalRegistryApp: true, view: initialView }, "", window.location.href);
  history.pushState({ legalRegistryApp: true, view: initialView, guard: true }, "", window.location.href);
  if (initialView !== state.activeView) switchView(initialView, { skipHistory: true });

  window.addEventListener("popstate", (event) => {
    const view = event.state?.view || viewFromLocation();
    restoringHistory = true;
    switchView(view, { skipHistory: true });
    restoringHistory = false;
    if (!event.state?.legalRegistryApp) {
      history.pushState({ legalRegistryApp: true, view: state.activeView, guard: true }, "", window.location.href);
    }
  });
}

function statusBadge(status) {
  const text = status || "등록";
  const cls = /변경|new/.test(text) ? "changed" : /완료|최신|자동|applied/.test(text) ? "done" : "";
  return `<span class="badge ${cls}">${escapeHtml(text)}</span>`;
}

function lawUrl(lawName) {
  const name = String(lawName || "").trim();
  if (!name) return "";
  return `https://www.law.go.kr/법령/${encodeURIComponent(name)}`;
}

function openLaw(lawName) {
  const url = lawUrl(lawName);
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function closeLawPreview() {
  const modal = $("#lawPreviewModal");
  if (modal) modal.hidden = true;
  state.selectedPreviewLaw = "";
}

async function loadLawPreviewContent(lawName) {
  const container = $("#lawPreviewOfficialContent");
  if (!container) return;
  container.innerHTML = `<div class="law-preview-loading"><span class="refresh-spinner" aria-hidden="true"></span><p>법제처 최신 법령 원문을 불러오고 있습니다.</p></div>`;
  try {
    const payload = await requestJson(`/api/legal-registry/law-content?lawName=${encodeURIComponent(lawName)}`);
    const content = payload.content || {};
    const articles = Array.isArray(content.articles) ? content.articles : [];
    container.innerHTML = articles.length ? `
      <div class="law-article-list">
        ${articles.map((article) => `
          <article class="law-article ${article.changed ? "changed" : ""}">
            <h4>${escapeHtml(article.heading || "조문")}${article.changed ? `<span>변경</span>` : ""}</h4>
            <p>${escapeHtml(article.text || "내용 없음")}</p>
          </article>
        `).join("")}
      </div>
    ` : `<div class="empty">법제처에서 표시할 조문을 찾지 못했습니다.</div>`;
  } catch (error) {
    container.innerHTML = `<div class="law-preview-error"><p>${escapeHtml(error.message || "법령 원문을 불러오지 못했습니다.")}</p><button class="btn small" data-law-preview-retry type="button">다시 불러오기</button></div>`;
  }
}

function renderLawPreviewSection(title, key, content) {
  return `
    <section class="law-preview-section" data-law-preview-section="${escapeHtml(key)}">
      <button class="law-preview-section-toggle" data-law-preview-toggle="${escapeHtml(key)}" type="button" aria-expanded="true">
        <span>${escapeHtml(title)}</span>
        <i aria-hidden="true"></i>
      </button>
      <div class="law-preview-section-body">${content}</div>
    </section>
  `;
}

function openLawPreview(lawName) {
  const name = String(lawName || "").trim();
  if (!name) return;
  const normalized = normalizeSearchText(name);
  const records = (state.data.records || []).filter((record) => {
    const candidate = normalizeSearchText(record.lawName || "");
    return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
  });
  const cards = (state.data.detailCards || []).filter((card) => {
    const candidate = normalizeSearchText(card.lawName || card.sheetName || "");
    return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
  });
  state.selectedPreviewLaw = records[0]?.lawName || cards[0]?.lawName || name;
  $("#lawPreviewTitle").textContent = state.selectedPreviewLaw;

  const recordHtml = records.length ? records.map((record) => `
    <div class="law-preview-record">
      <span>No ${escapeHtml(record.no || "-")}</span>
      <strong>${escapeHtml(record.group || record.lawName || "-")}</strong>
      <dl>
        <dt>등록 시행일</dt><dd>${escapeHtml(formatLawDate(record.registeredEffectiveDate))}</dd>
        <dt>최신 시행일</dt><dd>${escapeHtml(formatLawDate(record.officialEffectiveDate))}</dd>
        <dt>상태</dt><dd>${escapeHtml(record.status || "-")}</dd>
      </dl>
    </div>
  `).join("") : `<div class="empty">법규등록부 기본 행은 찾지 못했습니다.</div>`;

  const cardHtml = cards.length ? cards.map((card) => `
    <article class="law-preview-card">
      <div class="law-preview-meta">
        <span>${escapeHtml(card.category || "법규 검토")}</span>
        <span>재개정일 ${escapeHtml(formatLawDate(card.revisionDate))}</span>
        <span>등록일 ${escapeHtml(formatLawDate(card.registeredDate))}</span>
        <span>${escapeHtml(card.qcStatus || "")}</span>
      </div>
      <section>
        <h3>법규 적용내용</h3>
        <p>${escapeHtml(card.mainContent || "등록된 내용이 없습니다.")}</p>
      </section>
      <section>
        <h3>당사 적용사항</h3>
        <p>${escapeHtml(card.companyAction || "등록된 내용이 없습니다.")}</p>
      </section>
      ${card.qcMemo || card.qcEvidence ? `<section><h3>정도관리</h3><p>${escapeHtml([card.qcMemo, card.qcEvidence].filter(Boolean).join("\n"))}</p></section>` : ""}
    </article>
  `).join("") : `<div class="empty">법규검토에 등록된 상세 내용이 없습니다.</div>`;

  $("#lawPreviewContent").innerHTML = [
    renderLawPreviewSection("\uBC95\uADDC\uB4F1\uB85D\uBD80", "registry", recordHtml),
    renderLawPreviewSection("\uBC95\uADDC\uAC80\uD1A0", "review", cardHtml),
    renderLawPreviewSection("\uBC95\uB839 \uC6D0\uBB38", "original", '<div id="lawPreviewOfficialContent"></div>')
  ].join("");
  $("#lawPreviewModal").hidden = false;
  loadLawPreviewContent(state.selectedPreviewLaw);
}

function pendingChanges() {
  return (state.data.changes || []).filter((item) => item.status !== "applied");
}

const CATEGORY_OPTIONS = ["안전", "환경", "에너지"];
const APPLICABILITY_OPTIONS = ["해당", "해당무"];
const QC_STATUS_OPTIONS = ["미착수", "진행중", "완료", "보류", "해당없음"];
const QC_FILTERS = ["전체", "진행중", "완료", "지연", "증빙누락"];
const QC_VALIDITY_OPTIONS = ["보완필요", "차기확인", "적합"];

function markedOptionValue(options, selected) {
  return options.map((option) => `${option === selected ? "■" : "□"}${option}`).join(" ");
}

function selectedCategory(value) {
  const text = String(value || "");
  const marked = text.match(/■\s*(안전|환경|에너지)/);
  if (marked) return marked[1];
  return CATEGORY_OPTIONS.find((option) => text.includes(option)) || "";
}

function selectedApplicability(value) {
  const text = String(value || "");
  const marked = text.match(/■\s*(해당무|해당)/);
  if (marked) return marked[1];
  if (/해당무|해당\s*없음|미해당/.test(text)) return "해당무";
  if (/해당/.test(text)) return "해당";
  return "해당";
}

function renderCategorySelect(value) {
  const selected = selectedCategory(value);
  return `
    <label>구분
      <select name="category" required>
        <option value="" ${selected ? "" : "selected"}>선택</option>
        ${CATEGORY_OPTIONS.map((option) => {
          const optionValue = markedOptionValue(CATEGORY_OPTIONS, option);
          return `<option value="${escapeHtml(optionValue)}" ${selected === option ? "selected" : ""}>${escapeHtml(option)}</option>`;
        }).join("")}
      </select>
    </label>
  `;
}

function renderApplicabilityChecks(value) {
  const selected = selectedApplicability(value);
  return `
    <fieldset class="choice-field">
      <legend>당사해당 유무</legend>
      <div class="choice-row">
        ${APPLICABILITY_OPTIONS.map((option) => {
          const optionValue = markedOptionValue(APPLICABILITY_OPTIONS, option);
          return `
            <label class="choice-pill">
              <input type="radio" name="applicability" value="${escapeHtml(optionValue)}" ${selected === option ? "checked" : ""}>
              <span>${escapeHtml(option)}</span>
            </label>
          `;
        }).join("")}
      </div>
    </fieldset>
  `;
}

function renderMarkedPills(options, value) {
  const selected = options === CATEGORY_OPTIONS ? selectedCategory(value) : selectedApplicability(value);
  return `
    <div class="marked-pill-row">
      ${options.map((option) => `<span class="marked-pill ${selected === option ? "active" : ""}">${escapeHtml(option)}</span>`).join("")}
    </div>
  `;
}

function qcBaseStatus(card) {
  return QC_STATUS_OPTIONS.includes(card.qcStatus) ? card.qcStatus : "미착수";
}

function qcComputedStatus(card) {
  const status = qcBaseStatus(card);
  if (status === "완료" || status === "해당없음") return status;
  const due = parseLawDateValue(card.qcDueDate);
  if (due && due < qcToday() && !parseLawDateValue(card.qcDoneDate)) return "지연";
  return status;
}

function qcHasMissingEvidence(card) {
  return qcComputedStatus(card) !== "해당없음" && !String(card.qcEvidence || "").trim();
}

function qcProgress(card) {
  const status = qcComputedStatus(card);
  if (status === "완료" || status === "해당없음") return 100;
  if (status === "지연") return 35;
  if (status === "진행중") return 55;
  if (status === "보류") return 20;
  return 0;
}

function qcStatusClass(status) {
  if (status === "완료") return "done";
  if (status === "진행중") return "doing";
  if (status === "지연") return "late";
  if (status === "보류") return "hold";
  if (status === "해당없음") return "none";
  return "todo";
}

function renderQcSummary(cards) {
  const counts = {
    전체: cards.length,
    진행중: cards.filter((card) => qcComputedStatus(card) === "진행중").length,
    완료: cards.filter((card) => qcComputedStatus(card) === "완료").length,
    지연: cards.filter((card) => qcComputedStatus(card) === "지연").length,
    증빙누락: cards.filter(qcHasMissingEvidence).length
  };
  const target = $("#qcSummary");
  if (target) {
    target.innerHTML = QC_FILTERS.map((label) => `
      <article class="qc-summary-card ${state.qcFilter === label ? "active" : ""}">
        <span>${escapeHtml(label)}</span>
        <strong>${counts[label] || 0}건</strong>
      </article>
    `).join("");
  }
  $$("#qcFilterRow [data-qc-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.qcFilter === state.qcFilter);
  });
}

function matchesQcFilter(card) {
  if (state.qcFilter === "전체") return true;
  if (state.qcFilter === "증빙누락") return qcHasMissingEvidence(card);
  return qcComputedStatus(card) === state.qcFilter;
}

function renderQcStatusOptions(value) {
  const selected = QC_STATUS_OPTIONS.includes(value) ? value : "미착수";
  return `
    <label>관리상태
      <select name="qcStatus">
        ${QC_STATUS_OPTIONS.map((option) => `<option value="${escapeHtml(option)}" ${selected === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function qcValidity(value) {
  return QC_VALIDITY_OPTIONS.includes(value) ? value : "차기확인";
}

function qcValidityClass(value) {
  const status = qcValidity(value);
  if (status === "적합") return "fit";
  if (status === "보완필요") return "need";
  return "next";
}

function renderQcValidityOptions(value) {
  const selected = qcValidity(value);
  return `
    <label>유효성평가
      <select name="qcValidity">
        ${QC_VALIDITY_OPTIONS.map((option) => `<option value="${escapeHtml(option)}" ${selected === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderDashboard() {
  const records = state.data.records || [];
  const changes = pendingChanges();
  const lastLog = (state.data.refreshLogs || [])[0];
  $("#totalCount").textContent = records.length;
  $("#changeCount").textContent = Number(state.currentRefreshChanged || 0);
  $("#lastChecked").textContent = formatDateTime(lastLog?.at || state.data.updatedAt);

  $("#recentChanges").innerHTML = changes.slice(0, 5).map(renderChangeItem).join("") || `<div class="empty">아직 검토할 변경 법규가 없습니다.</div>`;
}

function renderRegistry() {
  const query = state.search.trim().toLowerCase();
  const records = (state.data.records || []).filter((record) => {
    if (!query) return true;
    return `${record.group} ${record.lawName}`.toLowerCase().includes(query);
  });
  const groups = [];
  for (const record of records) {
    const key = `${record.no || ""}|${record.group || record.lawName || ""}`;
    let group = groups.find((item) => item.key === key);
    if (!group) {
      group = { key, no: record.no || "", name: record.group || record.lawName || "", records: [] };
      groups.push(group);
    }
    group.records.push(record);
  }

  $("#registryRows").innerHTML = groups.map((group) => {
    const first = group.records[0] || {};
    return `
      <tr class="group-row">
        <td rowspan="${group.records.length}">No ${escapeHtml(group.no || "-")}</td>
        <td rowspan="${group.records.length}">
          <strong>${escapeHtml(group.name || "-")}</strong>
          <span>${group.records.length}개 법령</span>
        </td>
        <td class="law-row law-name-cell" data-law-name="${escapeHtml(first.lawName || "")}" title="${escapeHtml(first.lawName || "")}">
          <strong>${escapeHtml(first.lawName || "")}</strong>
        </td>
        <td>${escapeHtml(formatLawDate(first.registeredEffectiveDate))}</td>
        <td>${escapeHtml(formatLawDate(first.officialEffectiveDate))}</td>
        <td>${statusBadge(first.status)}</td>
      </tr>
      ${group.records.slice(1).map((record) => `
        <tr class="group-child-row">
          <td class="law-row law-name-cell" data-law-name="${escapeHtml(record.lawName || "")}" title="${escapeHtml(record.lawName || "")}">
            <strong>${escapeHtml(record.lawName || "")}</strong>
          </td>
          <td>${escapeHtml(formatLawDate(record.registeredEffectiveDate))}</td>
          <td>${escapeHtml(formatLawDate(record.officialEffectiveDate))}</td>
          <td>${statusBadge(record.status)}</td>
        </tr>
      `).join("")}
    `;
  }).join("") || `<tr><td colspan="6" class="empty">표시할 법규가 없습니다.</td></tr>`;
  requestAnimationFrame(fitRegistryTable);
}

function renderDetailSheets() {
  const cards = state.data.detailCards || [];
  renderQcSummary(cards);
  const visibleCards = cards.filter(matchesQcFilter);

  const metaItem = (label, value) => `
    <div class="detail-meta-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
  const inputValue = (value) => escapeHtml(value || "");
  const detailForm = (card = {}, mode = "add") => `
    <article class="detail-sheet-card open editing">
      <form class="detail-edit-form" data-detail-form data-mode="${mode}" data-detail-id="${escapeHtml(card.id || "")}">
        <div class="detail-register-head">
          <div class="detail-register-title">
            <span>${mode === "add" ? "새 법규 검토" : "법규 검토 수정"}</span>
            <h3>${mode === "add" ? "내용 추가" : escapeHtml(card.lawName || card.sheetName || "")}</h3>
          </div>
          <div class="detail-edit-actions">
            <button class="btn small" data-detail-cancel type="button">취소</button>
            <button class="btn primary small" type="submit">저장</button>
          </div>
        </div>
        <div class="detail-form-grid">
          ${renderCategorySelect(card.category)}
          <label>법규명<input name="lawName" value="${inputValue(card.lawName)}" required></label>
          <label>발행기관<input name="issuer" value="${inputValue(card.issuer || "법제처")}"></label>
          <label>입수경로<input name="channel" value="${inputValue(card.channel || "https://www.moleg.go.kr/")}"></label>
          <label>제·개정일<input name="revisionDate" value="${inputValue(formatLawDate(card.revisionDate))}" placeholder="2026. 5. 25"></label>
          <label>등록일<input name="registeredDate" value="${inputValue(formatLawDate(card.registeredDate))}" placeholder="2026. 5. 25"></label>
          <label>작성팀<input name="team" value="${inputValue(card.team || "ESQ")}"></label>
          <label>작성자<input name="author" value="${inputValue(card.author)}"></label>
          ${renderApplicabilityChecks(card.applicability)}
          ${renderQcStatusOptions(card.qcStatus)}
          ${renderQcValidityOptions(card.qcValidity)}
          <label>담당자<input name="qcOwner" value="${inputValue(card.qcOwner)}" placeholder="예: 김호형"></label>
          <label>예정일<input name="qcDueDate" value="${inputValue(card.qcDueDate ? formatLawDate(card.qcDueDate) : "")}" placeholder="2026. 7. 1"></label>
          <label>완료일<input name="qcDoneDate" value="${inputValue(card.qcDoneDate ? formatLawDate(card.qcDoneDate) : "")}" placeholder="완료 시 입력"></label>
          <label>증빙자료<input name="qcEvidence" value="${inputValue(card.qcEvidence)}" placeholder="품의서, 허가증, 사진, 보관경로"></label>
        </div>
        <div class="detail-form-textareas">
          <label>법규 적용내용<textarea name="mainContent" rows="10">${inputValue(card.mainContent)}</textarea></label>
          <label>당사 적용사항<textarea name="companyAction" rows="10">${inputValue(card.companyAction)}</textarea></label>
          <label class="detail-form-wide">정도관리 메모<textarea name="qcMemo" rows="5" placeholder="예: 품의서 작성 완료 / 화학사고예방관리계획서 작성 중">${inputValue(card.qcMemo)}</textarea></label>
        </div>
      </form>
    </article>
  `;

  $("#detailSheetRows").innerHTML = `${state.addingDetail ? detailForm({}, "add") : ""}${visibleCards.map((card) => {
    const index = cards.findIndex((item) => item.id === card.id);
    if (state.editingDetailId === card.id) return detailForm(card, "edit");
    const isOpen = state.expandedDetailIds.has(card.id);
    const qcStatus = qcComputedStatus(card);
    const progress = qcProgress(card);
    return `
    <article class="detail-sheet-card ${isOpen ? "open" : "collapsed"}">
      <button class="detail-register-head" data-detail-toggle="${escapeHtml(card.id || "")}" type="button" aria-expanded="${isOpen ? "true" : "false"}">
        <div class="detail-register-title">
          <span>법규등록부 ${index + 1}</span>
          <h3>${escapeHtml(card.lawName || card.sheetName || "")}</h3>
        </div>
        <div class="detail-register-actions">
          <span class="qc-status-badge ${qcStatusClass(qcStatus)}">${escapeHtml(qcStatus)}</span>
          <span>${escapeHtml(formatLawDate(card.revisionDate))}</span>
          <i aria-hidden="true"></i>
        </div>
      </button>
      <div class="detail-card-body">
        <div class="detail-card-tools">
          <button class="btn small" data-detail-edit="${escapeHtml(card.id || "")}" type="button">수정</button>
          <button class="btn small" data-ai-open="${escapeHtml(card.lawName || "")}" type="button">원문</button>
        </div>
        <div class="detail-meta-bar">
          <div class="detail-meta-item">
            <span>구분</span>
            ${renderMarkedPills(CATEGORY_OPTIONS, card.category)}
          </div>
          ${metaItem("발행기관", card.issuer)}
          ${metaItem("제·개정일", formatLawDate(card.revisionDate))}
          ${metaItem("등록일", formatLawDate(card.registeredDate))}
          ${metaItem("작성", [card.team, card.author].filter(Boolean).join(" / "))}
          ${metaItem("입수경로", card.channel)}
        </div>
        <div class="qc-meta-bar">
          <div class="qc-meta-item">
            <span>관리상태</span>
            <strong><em class="qc-status-badge ${qcStatusClass(qcStatus)}">${escapeHtml(qcStatus)}</em></strong>
          </div>
          <div class="qc-meta-item">
            <span>유효성평가</span>
            <strong><em class="qc-validity-badge ${qcValidityClass(card.qcValidity)}">${escapeHtml(qcValidity(card.qcValidity))}</em></strong>
          </div>
          ${metaItem("담당자", card.qcOwner)}
          ${metaItem("예정일", formatLawDate(card.qcDueDate))}
          ${metaItem("완료일", formatLawDate(card.qcDoneDate))}
          ${metaItem("증빙", card.qcEvidence || (qcHasMissingEvidence(card) ? "증빙누락" : ""))}
          <div class="qc-meta-item qc-progress-item">
            <span>진행률</span>
            <strong>${progress}%</strong>
            <div class="qc-progress"><i style="width:${progress}%"></i></div>
          </div>
        </div>
        <div class="detail-main-grid">
          <section class="detail-main-panel">
            <div class="detail-main-title">
              <strong>법규 적용내용</strong>
            </div>
            <pre>${escapeHtml(card.mainContent || "-")}</pre>
          </section>
          <section class="detail-main-panel emphasis">
            <div class="detail-main-title">
              <strong>당사 적용사항</strong>
              <div class="detail-main-title-status">${renderMarkedPills(APPLICABILITY_OPTIONS, card.applicability)}</div>
            </div>
            <pre>${escapeHtml(card.companyAction || "-")}</pre>
          </section>
        </div>
        <div class="qc-note-panel">
          <strong>정도관리 메모</strong>
          <pre>${escapeHtml(card.qcMemo || "-")}</pre>
        </div>
      </div>
    </article>
  `;
  }).join("")}` || `<div class="empty">표시할 법규 검토 항목이 없습니다.</div>`;
}

function renderChangeItem(change) {
  const applied = change.status === "applied" || change.status === "auto-applied";
  const appliedText = change.status === "auto-applied" ? "자동등록" : "등록완료";
  return `
    <article class="change-item">
      <div>
        <strong>${escapeHtml(change.lawName || "")}</strong>
        <div class="change-meta">
          등록 시행일 ${escapeHtml(formatLawDate(change.previousEffectiveDate))} -> 최신 시행일 ${escapeHtml(formatLawDate(change.effectiveDate))}
          ${change.promulgationDate ? ` · 공포일 ${escapeHtml(formatLawDate(change.promulgationDate))}` : ""}
        </div>
        <div class="diff-strip" aria-label="변경 전후">
          <span class="diff-value">${escapeHtml(formatLawDate(change.previousEffectiveDate))}</span>
          <span class="diff-arrow">→</span>
          <span class="diff-value">${escapeHtml(formatLawDate(change.effectiveDate))}</span>
        </div>
        <div class="change-meta">${escapeHtml(change.summary || "")}</div>
      </div>
      <div class="change-actions">
        <button class="btn small" data-detail="${escapeHtml(change.id)}" type="button">상세</button>
        ${applied ? statusBadge(appliedText) : `<button class="btn primary small" data-apply="${escapeHtml(change.id)}" type="button">등록 처리</button>`}
      </div>
    </article>
  `;
}

function renderChanges() {
  const query = state.changeSearch.trim().toLowerCase();
  const changes = (state.data.changes || []).filter((change) => {
    if (!query) return true;
    return [
      change.lawName,
      change.summary,
      change.previousEffectiveDate,
      change.effectiveDate,
      change.promulgationDate,
      change.status
    ].join(" ").toLowerCase().includes(query);
  });
  $("#changeRows").innerHTML = changes.map(renderChangeItem).join("") || `<div class="empty">새로고침에서 발견된 변경 항목이 없습니다.</div>`;
}

const AI_TOPIC_RULES = [
  {
    topic: "염료 제조업",
    keywords: ["오영", "OHYOUNG", "염료", "합성염료", "섬유", "염색", "반응성염료", "분산염료", "산성염료", "카치온염료", "형광증백제", "텍스타일", "DTP", "디지털날염", "잉크", "안료", "분말", "분진", "계량", "혼합", "반응", "여과", "정제", "배합", "건조", "분급", "포장", "용제", "VOC", "악취", "색도", "폐수", "유해화학", "위험물"],
    laws: ["화학물질관리법", "화학물질의 등록 및 평가 등에 관한 법률", "산업안전보건법", "대기환경보전법", "물환경보전법", "폐기물관리법", "위험물안전관리법", "소방시설 설치 및 관리에 관한 법률"]
  },
  {
    topic: "온열질환/폭염",
    keywords: ["온열", "폭염", "고열", "열사병", "열탈진", "더위", "한랭", "건강장해", "휴식", "그늘"],
    laws: ["산업안전보건법", "산업안전보건기준에 관한 규칙"]
  },
  {
    topic: "소음/작업환경",
    keywords: ["소음", "진동", "작업환경", "측정", "청력", "난청", "보호구", "건강진단"],
    laws: ["산업안전보건법", "산업안전보건기준에 관한 규칙"]
  },
  {
    topic: "화학물질",
    keywords: ["화학", "유해화학", "화관법", "화평법", "누출", "취급", "저장", "MSDS", "물질안전보건자료", "등록", "평가"],
    laws: ["화학물질관리법", "화학물질의 등록 및 평가 등에 관한 법률", "산업안전보건법"]
  },
  {
    topic: "화재/소방",
    keywords: ["화재", "소방", "폭발", "인화성", "위험물", "소화", "경보", "피난"],
    laws: ["소방시설 설치 및 관리에 관한 법률", "위험물안전관리법", "산업안전보건기준에 관한 규칙"]
  },
  {
    topic: "폐기물/환경",
    keywords: ["폐기물", "지정폐기물", "보관", "처리", "재활용", "배출"],
    laws: ["폐기물관리법", "자원의 절약과 재활용촉진에 관한 법률"]
  },
  {
    topic: "대기/배출시설",
    keywords: ["대기", "배출시설", "방지시설", "먼지", "악취", "오염물질", "배출허용"],
    laws: ["대기환경보전법", "악취방지법", "대기관리권역의 대기환경개선에 관한 특별법"]
  },
  {
    topic: "수질/폐수",
    keywords: ["수질", "폐수", "방류", "수생태", "배출허용", "오염"],
    laws: ["물환경보전법", "환경오염시설의 통합관리에 관한 법률"]
  },
  {
    topic: "연구실",
    keywords: ["연구실", "실험실", "연구활동", "사전유해인자", "연구실책임자"],
    laws: ["연구실 안전환경 조성에 관한 법률"]
  }
];

function normalizeSearchText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function scoreLawRecord(record, query) {
  const normalizedQuery = normalizeSearchText(query);
  const haystack = normalizeSearchText(`${record.no} ${record.group} ${record.lawName} ${record.note || ""}`);
  let score = 0;
  const reasons = [];

  for (const token of uniqueValues(String(query || "").split(/[\s,./·]+/).map((item) => item.trim()).filter((item) => item.length >= 2))) {
    if (haystack.includes(normalizeSearchText(token))) {
      score += 8;
      reasons.push(token);
    }
  }

  for (const rule of AI_TOPIC_RULES) {
    const matchedKeywords = rule.keywords.filter((keyword) => normalizedQuery.includes(normalizeSearchText(keyword)));
    if (!matchedKeywords.length) continue;
    const lawMatched = rule.laws.some((law) => haystack.includes(normalizeSearchText(law)));
    const topicMatched = haystack.includes(normalizeSearchText(rule.topic));
    if (lawMatched || topicMatched) {
      score += 20 + matchedKeywords.length * 4;
      reasons.push(rule.topic, ...matchedKeywords);
    }
  }

  return { score, reasons: uniqueValues(reasons).slice(0, 8) };
}

function findAiLawMatches(query) {
  const records = state.data.records || [];
  return records
    .map((record) => ({ record, ...scoreLawRecord(record, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.record.lawName).localeCompare(String(b.record.lawName), "ko"))
    .slice(0, 8);
}

function isRefreshUpdateQuestion(query) {
  const text = normalizeSearchText(query);
  const refreshWords = ["새로고침", "업데이트", "오늘", "방금", "이번", "최근", "현재", "수정", "변경", "바뀐", "변경이력"];
  const targetWords = ["법규", "법령", "등록부", "업데이트", "변경", "수정", "바뀐"];
  return refreshWords.some((word) => text.includes(normalizeSearchText(word)))
    && targetWords.some((word) => text.includes(normalizeSearchText(word)));
}

function currentRefreshChanges() {
  const count = Math.max(0, Number(state.currentRefreshChanged || 0));
  if (!count) return [];
  return (state.data.changes || []).slice(0, count);
}

function renderAiRefreshChangeResults(changes) {
  if (!changes.length) {
    return `<div class="empty">이번 새로고침에서 새로 잡힌 변경 법규가 없습니다.</div>`;
  }
  return changes.map((change) => `
    <article class="ai-result-card">
      <div>
        <h3>${escapeHtml(change.lawName || "")}</h3>
        <p>등록 시행일 ${escapeHtml(formatLawDate(change.previousEffectiveDate))} -> 최신 시행일 ${escapeHtml(formatLawDate(change.effectiveDate))}${change.promulgationDate ? ` · 공포일 ${escapeHtml(formatLawDate(change.promulgationDate))}` : ""}</p>
        <div class="ai-result-tags">
          <span>이번 새로고침</span>
          <span>${escapeHtml(change.summary || "변경 법규")}</span>
        </div>
      </div>
      <div class="change-actions">
        <button class="btn small" data-detail="${escapeHtml(change.id)}" type="button">상세</button>
        <button class="btn small" data-ai-open="${escapeHtml(change.lawName || "")}" type="button">원문</button>
      </div>
    </article>
  `).join("");
}

function aiSurfaceSelector(options, name) {
  const isFloating = options?.surface === "floating";
  const selectors = {
    chat: isFloating ? "#floatingAiChatLog" : "#aiChatLog",
    input: isFloating ? "#floatingAiLawQuery" : "#aiLawQuery",
    results: isFloating ? "" : "#aiLawResults"
  };
  return selectors[name] || "";
}

function scrollAiChatToBottom(options = {}) {
  const chat = $(aiSurfaceSelector(options, "chat"));
  if (chat) chat.scrollTop = chat.scrollHeight;
}

function appendAiMessage(role, html, extraClass = "", options = {}) {
  const chat = $(aiSurfaceSelector(options, "chat"));
  if (!chat) return null;
  const message = document.createElement("div");
  message.className = `ai-message ${role} ${extraClass}`.trim();
  message.innerHTML = html;
  chat.appendChild(message);
  scrollAiChatToBottom(options);
  return message;
}

function renderLawMiniList(matches) {
  if (!matches.length) return "";
  return `
    <div class="ai-law-mini-list">
      ${matches.slice(0, 5).map(({ record }) => `
        <div class="ai-law-mini">
          <span>${escapeHtml(record.lawName || "")}</span>
          <button class="btn small" data-ai-open="${escapeHtml(record.lawName || "")}" type="button">원문</button>
        </div>
      `).join("")}
    </div>
  `;
}

function formatAiAnswerText(text) {
  return escapeHtml(text || "")
    .replace(/\r?\n{2,}/g, "</p><p>")
    .replace(/\r?\n/g, "<br>");
}

function renderAiReferenceList(title, items, renderItem) {
  if (!Array.isArray(items) || !items.length) return "";
  return `
    <details class="ai-reference">
      <summary>${escapeHtml(title)}</summary>
      <ul>${items.map(renderItem).join("")}</ul>
    </details>
  `;
}

function renderConversationalAiAnswer(payload, matches) {
  const answer = payload.answer || "답변을 생성하지 못했습니다.";
  const recommended = Array.isArray(payload.recommendedLaws) ? payload.recommendedLaws : [];
  const siteRisks = Array.isArray(payload.siteRisks) ? payload.siteRisks : [];
  const actionPlan = Array.isArray(payload.actionPlan) ? payload.actionPlan : [];
  const checkpoints = Array.isArray(payload.checkpoints) ? payload.checkpoints : [];
  const references = [
    renderAiReferenceList("관련 법규", recommended, (item) => `<li class="ai-law-reference"><div><b>${escapeHtml(item.lawName || "")}</b>${item.reason ? ` - ${escapeHtml(item.reason)}` : ""}</div><div class="ai-law-reference-actions"><button class="btn small" data-ai-preview="${escapeHtml(item.lawName || "")}" type="button">앱에서 보기</button><button class="btn small" data-ai-open="${escapeHtml(item.lawName || "")}" type="button">원문</button></div></li>`),
    renderAiReferenceList("참고 확인사항", [...siteRisks, ...actionPlan, ...checkpoints], (item) => `<li>${escapeHtml(item)}</li>`)
  ].join("");
  const fallback = !recommended.length && !references ? renderLawMiniList(matches) : "";

  return `
    <div class="ai-answer-main">
      <p>${formatAiAnswerText(answer)}</p>
    </div>
    ${references || fallback ? `<div class="ai-answer-references">${references || fallback}</div>` : ""}
    ${payload.caution ? `<p class="ai-answer-note">${escapeHtml(payload.caution)}</p>` : ""}
  `;
}

function renderAiAnswerSupportingContent(payload, matches) {
  const recommended = Array.isArray(payload.recommendedLaws) ? payload.recommendedLaws : [];
  const siteRisks = Array.isArray(payload.siteRisks) ? payload.siteRisks : [];
  const actionPlan = Array.isArray(payload.actionPlan) ? payload.actionPlan : [];
  const checkpoints = Array.isArray(payload.checkpoints) ? payload.checkpoints : [];
  const lawActions = recommended.length ? `
    <div class="ai-law-action-list">
      ${recommended.map((item) => `
        <article class="ai-law-action-card">
          <div>
            <strong>${escapeHtml(item.lawName || "")}</strong>
            ${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ""}
          </div>
          <div class="ai-law-reference-actions">
            <button class="btn primary small" data-ai-preview="${escapeHtml(item.lawName || "")}" type="button">\uC571\uC5D0\uC11C \uBCF4\uAE30</button>
            <button class="btn small" data-ai-filter="${escapeHtml(item.lawName || "")}" type="button">\uB4F1\uB85D\uBD80\uC5D0\uC11C \uBCF4\uAE30</button>
            <button class="btn small" data-ai-open="${escapeHtml(item.lawName || "")}" type="button">\uBC95\uC81C\uCC98 \uC6D0\uBB38</button>
          </div>
        </article>
      `).join("")}
    </div>
  ` : "";
  const references = renderAiReferenceList("\uCC38\uACE0 \uD655\uC778\uC0AC\uD56D", [...siteRisks, ...actionPlan, ...checkpoints], (item) => `<li>${escapeHtml(item)}</li>`);
  const fallback = !recommended.length && !references ? renderLawMiniList(matches) : "";
  return `
    ${lawActions}
    ${references || fallback ? `<div class="ai-answer-references">${references || fallback}</div>` : ""}
    ${payload.caution ? `<p class="ai-answer-note">${escapeHtml(payload.caution)}</p>` : ""}
  `;
}

async function typeConversationalAiAnswer(message, payload, matches, options = {}) {
  const answer = String(payload.answer || "답변을 생성하지 못했습니다.");
  message.innerHTML = `
    <div class="ai-answer-main">
      <p><span class="ai-typing-text"></span><span class="ai-typing-cursor" aria-hidden="true"></span></p>
    </div>
  `;
  const target = message.querySelector(".ai-typing-text");
  const cursor = message.querySelector(".ai-typing-cursor");
  const characters = Array.from(answer);

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    target.textContent += character;
    if (index % 4 === 0 || /[.!?。！？\n]/.test(character)) scrollAiChatToBottom(options);
    const delay = /[.!?。！？]/.test(character) ? 90 : /[,，:;\n]/.test(character) ? 45 : 16;
    await new Promise((resolve) => window.setTimeout(resolve, delay));
  }

  cursor?.remove();
  message.insertAdjacentHTML("beforeend", renderAiAnswerSupportingContent(payload, matches));
  scrollAiChatToBottom(options);
}

async function renderAiSearchResults(query, options = {}) {
  const surfaceOptions = { surface: options.surface };
  const resultsSelector = aiSurfaceSelector(options, "results");
  const results = resultsSelector ? $(resultsSelector) : null;
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) {
    if (results) {
      results.innerHTML = "";
      results.hidden = true;
    }
    return;
  }

  if (options.useGemini) {
    appendAiMessage("user", `<strong>질문</strong><p>${escapeHtml(cleanQuery)}</p>`, "", surfaceOptions);
    const input = $(aiSurfaceSelector(options, "input"));
    if (input) input.value = "";
  }

  const wantsRefreshUpdates = isRefreshUpdateQuestion(cleanQuery);
  const refreshChanges = currentRefreshChanges();
  const matches = wantsRefreshUpdates
    ? refreshChanges.map((change) => ({
        record: {
          lawName: change.lawName,
          group: "이번 새로고침",
          no: "",
          officialEffectiveDate: change.effectiveDate,
          registeredEffectiveDate: change.previousEffectiveDate
        },
        reasons: ["이번 새로고침", "변경 법규"],
        score: 999
      }))
    : findAiLawMatches(cleanQuery);
  if (wantsRefreshUpdates && results) {
    results.innerHTML = renderAiRefreshChangeResults(refreshChanges);
    results.hidden = false;
  } else if (!matches.length) {
    if (results) {
      results.innerHTML = "";
      results.hidden = true;
    }
  } else if (results) {
    results.innerHTML = matches.map(({ record, reasons, score }) => `
    <article class="ai-result-card">
      <div>
        <h3>${escapeHtml(record.lawName || "")}</h3>
        <p>No ${escapeHtml(record.no || "-")} · ${escapeHtml(record.group || "-")} · 시행일 ${escapeHtml(formatLawDate(record.officialEffectiveDate || record.registeredEffectiveDate))}</p>
        <div class="ai-result-tags">
          <span>관련도 ${score}</span>
          ${reasons.map((reason) => `<span>${escapeHtml(reason)}</span>`).join("")}
        </div>
      </div>
      <div class="change-actions">
        <button class="btn small" data-ai-open="${escapeHtml(record.lawName || "")}" type="button">원문</button>
        <button class="btn primary small" data-ai-filter="${escapeHtml(record.lawName || "")}" type="button">등록부에서 보기</button>
      </div>
    </article>
  `).join("");
    results.hidden = false;
  }

  if (!options.useGemini) return;

  const loading = appendAiMessage("assistant", `<div class="ai-thinking" aria-label="오영 법규 도우미 답변 생성 중"><span></span><span></span><span></span></div>`, "loading", surfaceOptions);
  try {
    const payload = await requestJson("/api/legal-registry/ai-answer", {
      method: "POST",
      body: JSON.stringify({
        question: cleanQuery,
        candidates: matches.map(({ record, reasons, score }) => ({
          lawName: record.lawName,
          group: record.group,
          no: record.no,
          effectiveDate: record.officialEffectiveDate || record.registeredEffectiveDate,
          reasons,
          score
        })),
        lastRefreshLog: (state.data.refreshLogs || [])[0] || null,
        refreshChanges: refreshChanges.map((change) => ({
          lawName: change.lawName,
          previousEffectiveDate: change.previousEffectiveDate,
          effectiveDate: change.effectiveDate,
          promulgationDate: change.promulgationDate,
          checkedAt: change.checkedAt,
          appliedAt: change.appliedAt,
          summary: change.summary,
          status: change.status
        })),
        refreshQuestion: wantsRefreshUpdates
      })
    });
    loading.classList.remove("loading");
    loading.classList.add("conversational");
    await typeConversationalAiAnswer(loading, payload, matches, surfaceOptions);
  } catch (error) {
    loading.classList.remove("loading");
    loading.innerHTML = `
      <strong>오영 법규 답변 생성 실패</strong>
      <p>${escapeHtml(error.message)}</p>
      <p>대신 관련 법령 후보를 먼저 보여드립니다.</p>
      ${renderLawMiniList(matches)}
    `;
  }
  scrollAiChatToBottom(surfaceOptions);
}

function render() {
  renderDashboard();
  renderRegistry();
  renderDetailSheets();
  renderChanges();
}

async function refreshLaws() {
  const oc = $("#ocInput").value.trim();
  setStatus(oc ? "법제처 최신 정보를 확인 중입니다." : "저장된 API 인증값으로 법제처 최신 정보를 확인 중입니다.");
  showResult("법규 새로고침 중입니다. 법제처 최신 시행일과 변경 이력을 확인하고 있습니다.", "success");
  showToast("법규 새로고침을 시작했습니다.", "success");
  setRefreshBusy(true);
  try {
    const result = await requestJson("/api/legal-registry/refresh", {
      method: "POST",
      body: JSON.stringify({ oc })
    });
    state.currentRefreshChanged = Number(result.log?.changed || 0);
    state.data = { ...state.data, records: result.records, changes: result.changes, updatedAt: result.updatedAt, refreshLogs: [result.log, ...(state.data.refreshLogs || [])] };
    render();
    const message = `새로고침 성공: 확인 ${result.log.checked}건 · 자동등록 ${result.log.changed}건 · 오류 ${result.log.errors.length}건`;
    setStatus(message);
    showResult(message, "success");
    showToast(message, "success");
  } catch (error) {
    setStatus(error.message);
    showResult(`새로고침 실패: ${error.message}`, "error");
    showToast(error.message, "error");
  } finally {
    setRefreshBusy(false);
  }
}

async function importSource() {
  const sourcePath = $("#sourcePathInput").value.trim();
  setStatus("엑셀 원본을 다시 읽는 중입니다.");
  try {
    const result = await requestJson("/api/legal-registry/import-source", {
      method: "POST",
      body: JSON.stringify({ sourcePath })
    });
    state.data = result.data;
    render();
    setStatus(`원본 ${result.records}건, 카드 ${result.detailCards}건을 불러왔습니다.`);
    showResult(`원본 불러오기 성공: 법령 ${result.records}건`, "success");
    showToast("원본 엑셀을 불러왔습니다.", "success");
  } catch (error) {
    setStatus(error.message);
    showResult(`원본 불러오기 실패: ${error.message}`, "error");
    showToast(error.message, "error");
  }
}

function getDetailFormPayload(form) {
  const formData = new FormData(form);
  return {
    category: String(formData.get("category") || "").trim(),
    lawName: String(formData.get("lawName") || "").trim(),
    issuer: String(formData.get("issuer") || "").trim(),
    channel: String(formData.get("channel") || "").trim(),
    revisionDate: String(formData.get("revisionDate") || "").trim(),
    registeredDate: String(formData.get("registeredDate") || "").trim(),
    team: String(formData.get("team") || "").trim(),
    author: String(formData.get("author") || "").trim(),
    applicability: String(formData.get("applicability") || "").trim(),
    mainContent: String(formData.get("mainContent") || "").trim(),
    companyAction: String(formData.get("companyAction") || "").trim(),
    qcStatus: String(formData.get("qcStatus") || "").trim(),
    qcValidity: String(formData.get("qcValidity") || "").trim(),
    qcOwner: String(formData.get("qcOwner") || "").trim(),
    qcDueDate: String(formData.get("qcDueDate") || "").trim(),
    qcDoneDate: String(formData.get("qcDoneDate") || "").trim(),
    qcEvidence: String(formData.get("qcEvidence") || "").trim(),
    qcMemo: String(formData.get("qcMemo") || "").trim()
  };
}

async function saveDetailForm(form) {
  const mode = form.dataset.mode || "add";
  const id = form.dataset.detailId || "";
  const payload = getDetailFormPayload(form);
  if (!payload.lawName) {
    showToast("법규명을 입력하세요.", "error");
    return;
  }
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    const result = await requestJson(mode === "edit"
      ? `/api/legal-registry/detail-cards/${encodeURIComponent(id)}`
      : "/api/legal-registry/detail-cards", {
        method: mode === "edit" ? "PUT" : "POST",
        body: JSON.stringify(payload)
      });
    const latest = await requestJson("/api/legal-registry");
    state.data = {
      ...state.data,
      ...latest,
      detailCards: result.detailCards || latest.detailCards || state.data.detailCards,
      updatedAt: result.updatedAt || latest.updatedAt || state.data.updatedAt
    };
    state.addingDetail = false;
    state.editingDetailId = "";
    if (result.card?.id) state.expandedDetailIds = new Set([result.card.id]);
    renderDetailSheets();
    showToast(mode === "edit" ? "법규 검토를 수정했습니다." : "법규 검토를 추가했습니다.", "success");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

async function applyChange(id) {
  try {
    const result = await requestJson(`/api/legal-registry/changes/${encodeURIComponent(id)}/apply`, { method: "POST" });
    state.data.records = result.records;
    state.data.changes = result.changes;
    render();
    showToast("변경 법규를 등록 처리했습니다.", "success");
  } catch (error) {
    showToast(error.message, "error");
  }
}

function exportReadonlyHtml() {
  window.location.assign(`/api/legal-registry/export-readonly?t=${Date.now()}`);
  showToast("보기 전용 HTML 파일을 다운로드합니다. 다운로드 폴더를 확인하세요.", "success");
}

async function exportWebReadonlyHtml() {
  const button = $("#webExportBtn");
  if (button) {
    button.disabled = true;
    button.textContent = "배포 중";
  }
  try {
    const result = await requestJson("/api/legal-registry/export-web", { method: "POST" });
    const url = result.firebaseUrl || "";
    if (url && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
    showToast(url ? `웹 보기 링크 생성 완료: ${url}` : "웹 보기용 HTML을 생성했습니다.", "success");
    setStatus(url ? `배포 후 모바일에서 접속: ${url}` : "public-oyoung 폴더에 보기전용 HTML을 생성했습니다.");
  } catch (error) {
    showToast(error.message, "error");
    setStatus(error.message);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "웹 링크 생성";
    }
  }
}

function findChange(id) {
  return (state.data.changes || []).find((item) => item.id === id);
}

function openChangeDetail(id) {
  const change = findChange(id);
  if (!change) return;
  state.selectedChangeId = id;
  $("#changeModalStatus").textContent = change.status === "auto-applied" ? "자동등록" : change.status === "applied" ? "등록완료" : "변경";
  $("#changeModalTitle").textContent = change.lawName || "변경 상세";
  $("#detailLawName").textContent = change.lawName || "-";
  $("#detailBefore").textContent = formatLawDate(change.previousEffectiveDate);
  $("#detailAfter").textContent = formatLawDate(change.effectiveDate);
  $("#detailPromulgation").textContent = formatLawDate(change.promulgationDate);
  $("#detailCheckedAt").textContent = formatDateTime(change.checkedAt);
  $("#detailAppliedAt").textContent = formatDateTime(change.appliedAt);
  $("#detailSummary").textContent = change.summary || "변경 전후 시행일자를 확인했습니다.";
  renderChangeContent(change);
  $("#changeModal").hidden = false;
  loadSelectedChangeContent();
}

function renderChangeContent(change) {
  const articleDiffs = Array.isArray(change?.articleDiffs) ? change.articleDiffs : [];
  if (articleDiffs.length) {
    const visibleDiffs = articleDiffs.filter((diff) => diff.before || diff.after || diff.notice);
    $("#detailContentRows").innerHTML = visibleDiffs.map((diff) => {
      const typeLabel = diff.type === "added" ? "추가" : diff.type === "removed" ? "삭제" : diff.type === "current-only" ? "최신 조문" : "수정";
      const inline = diff.before && diff.after ? buildInlineDiff(diff.before, diff.after) : null;
      return `
        <section class="plain-diff-card">
          <strong class="plain-diff-title">[${escapeHtml(typeLabel)}] ${escapeHtml(diff.heading || "변경 조문")}</strong>
          ${diff.notice ? `<div class="diff-notice">${escapeHtml(diff.notice)}</div>` : ""}
          ${diff.before ? `<div class="plain-before">변경 전\n${inline ? inline.beforeHtml : escapeHtml(diff.before)}</div>` : ""}
          ${diff.after ? `<div class="plain-after">변경 후\n${inline ? inline.afterHtml : escapeHtml(diff.after)}</div>` : ""}
        </section>
        <article class="article-diff ${escapeHtml(diff.type || "changed")}" hidden>
          <h4><span>${escapeHtml(typeLabel)}</span>${escapeHtml(diff.heading || "변경 조문")}</h4>
          <div class="diff-block ${diff.before && diff.after ? "" : "single"}">
            ${diff.notice ? `<div class="diff-notice">${escapeHtml(diff.notice)}</div>` : ""}
            ${diff.before ? `<div class="diff-before">${inline ? inline.beforeHtml : escapeHtml(diff.before)}</div>` : ""}
            ${diff.after ? `<div class="diff-after">${inline ? inline.afterHtml : escapeHtml(diff.after)}</div>` : ""}
          </div>
        </article>
      `;
    }).join("") || "표시할 변경 문장이 없습니다.";
    return;
  }
  const amendmentLines = Array.isArray(change?.amendmentLines) ? change.amendmentLines : [];
  const reasonLines = Array.isArray(change?.reasonLines) ? change.reasonLines : [];
  const rows = [
    ...amendmentLines.map((line) => ({ type: "", text: line })),
    ...reasonLines.map((line) => ({ type: "reason", text: line }))
  ];
  $("#detailContentRows").innerHTML = rows.length
    ? rows.map((row) => `<div class="content-line ${row.type}">${escapeHtml(row.text)}</div>`).join("")
    : "비교를 불러오면 이전 시행본과 최신 시행본의 차이가 표시됩니다.";
}

async function loadSelectedChangeContent() {
  const change = findChange(state.selectedChangeId);
  if (!change) return;
  const target = $("#detailContentRows");
  const button = $("#detailLoadContentBtn");
  target.textContent = "이전 시행본과 최신 시행본을 비교하는 중입니다.";
  if (button) {
    button.disabled = true;
    button.textContent = "불러오는 중";
  }
  try {
    const result = await requestJson(`/api/legal-registry/change-content/${encodeURIComponent(change.id)}`);
    Object.assign(change, result.change);
    renderChangeContent(change);
    showToast("전 법 대비 변경 내용을 불러왔습니다.", "success");
  } catch (error) {
    target.textContent = error.message;
    showToast(error.message, "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "다시 불러오기";
    }
  }
}

function closeChangeDetail() {
  $("#changeModal").hidden = true;
}

function openSelectedChangeLaw() {
  const change = findChange(state.selectedChangeId);
  if (change) openLaw(change.lawName);
}

function floatingAiBounds(element) {
  const rect = element.getBoundingClientRect();
  const margin = window.innerWidth <= 700 ? 12 : 18;
  return {
    maxLeft: Math.max(margin, window.innerWidth - rect.width - margin),
    maxTop: Math.max(margin, window.innerHeight - rect.height - margin),
    margin
  };
}

function moveFloatingAi(left, top, save = true) {
  const floating = $("#floatingAi");
  if (!floating) return;
  const bounds = floatingAiBounds(floating);
  const nextLeft = Math.min(Math.max(bounds.margin, left), bounds.maxLeft);
  const nextTop = Math.min(Math.max(bounds.margin, top), bounds.maxTop);
  floating.style.left = `${nextLeft}px`;
  floating.style.top = `${nextTop}px`;
  floating.style.right = "auto";
  floating.style.bottom = "auto";
  if (save) {
    localStorage.setItem(FLOATING_AI_POSITION_KEY, JSON.stringify({ left: nextLeft, top: nextTop }));
  }
}

function restoreFloatingAiPosition() {
  const floating = $("#floatingAi");
  if (!floating) return;
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(FLOATING_AI_POSITION_KEY) || "null");
  } catch {
    saved = null;
  }
  if (!saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return;
  requestAnimationFrame(() => moveFloatingAi(saved.left, saved.top, false));
}

function startFloatingAiDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  if (event.target.closest("button, textarea, input") && !event.target.closest("#floatingAiToggle")) return;
  const floating = $("#floatingAi");
  if (!floating) return;
  const rect = floating.getBoundingClientRect();
  floatingAiDrag.active = true;
  floatingAiDrag.moved = false;
  floatingAiDrag.pointerId = event.pointerId;
  floatingAiDrag.startX = event.clientX;
  floatingAiDrag.startY = event.clientY;
  floatingAiDrag.originLeft = rect.left;
  floatingAiDrag.originTop = rect.top;
  floating.classList.add("dragging");
  event.currentTarget.setPointerCapture?.(event.pointerId);
}

function moveFloatingAiDrag(event) {
  if (!floatingAiDrag.active || floatingAiDrag.pointerId !== event.pointerId) return;
  const dx = event.clientX - floatingAiDrag.startX;
  const dy = event.clientY - floatingAiDrag.startY;
  if (Math.abs(dx) + Math.abs(dy) > 5) floatingAiDrag.moved = true;
  if (!floatingAiDrag.moved) return;
  event.preventDefault();
  moveFloatingAi(floatingAiDrag.originLeft + dx, floatingAiDrag.originTop + dy);
}

function endFloatingAiDrag(event) {
  if (!floatingAiDrag.active || floatingAiDrag.pointerId !== event.pointerId) return;
  $("#floatingAi")?.classList.remove("dragging");
  floatingAiDrag.active = false;
  floatingAiDrag.pointerId = null;
  floatingAiDrag.suppressClick = floatingAiDrag.moved;
  window.setTimeout(() => {
    floatingAiDrag.suppressClick = false;
  }, 0);
}

function bindFloatingAiDrag() {
  const toggle = $("#floatingAiToggle");
  const head = $(".floating-ai-head");
  [toggle, head].filter(Boolean).forEach((handle) => {
    handle.addEventListener("pointerdown", startFloatingAiDrag);
    handle.addEventListener("pointermove", moveFloatingAiDrag);
    handle.addEventListener("pointerup", endFloatingAiDrag);
    handle.addEventListener("pointercancel", endFloatingAiDrag);
  });
  window.addEventListener("resize", () => {
    const floating = $("#floatingAi");
    if (!floating || floating.style.left === "") return;
    const rect = floating.getBoundingClientRect();
    moveFloatingAi(rect.left, rect.top);
  });
  restoreFloatingAiPosition();
}

function resetFloatingAiPosition() {
  localStorage.removeItem(FLOATING_AI_POSITION_KEY);
  const floating = $("#floatingAi");
  if (!floating) return;
  floating.style.left = "";
  floating.style.top = "";
  floating.style.right = "";
  floating.style.bottom = "";
}

function setFloatingAiOpen(isOpen) {
  const panel = $("#floatingAiPanel");
  const toggle = $("#floatingAiToggle");
  if (!panel || !toggle) return;
  panel.hidden = !isOpen;
  toggle.setAttribute("aria-expanded", String(isOpen));
  $("#floatingAi")?.classList.toggle("open", isOpen);
  if (isOpen) {
    restoreFloatingAiPosition();
    window.setTimeout(() => $("#floatingAiLawQuery")?.focus(), 50);
    scrollAiChatToBottom({ surface: "floating" });
  }
}

function submitAiQuestion(inputSelector, surface = "") {
  const input = $(inputSelector);
  renderAiSearchResults(input?.value, { useGemini: true, surface });
}

function bindEvents() {
  $("#sidebarToggleBtn").addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));
  $$("[data-jump]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.jump)));
  $("#refreshBtn").addEventListener("click", refreshLaws);
  $("#topRefreshBtn").addEventListener("click", refreshLaws);
  $("#mobileRefreshBtn")?.addEventListener("click", refreshLaws);
  const importBtn = $("#importBtn");
  if (importBtn) importBtn.addEventListener("click", importSource);
  $("#exportBtn").addEventListener("click", exportReadonlyHtml);
  $("#webExportBtn")?.addEventListener("click", exportWebReadonlyHtml);
  $("#registrySearch").addEventListener("input", (event) => {
    state.search = event.target.value;
    renderRegistry();
  });
  $("#changeSearch").addEventListener("input", (event) => {
    state.changeSearch = event.target.value;
    renderChanges();
  });
  $("#detailAddBtn").addEventListener("click", () => {
    state.addingDetail = true;
    state.editingDetailId = "";
    renderDetailSheets();
    $("#detailSheetRows")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $$("#qcFilterRow [data-qc-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.qcFilter = button.dataset.qcFilter || "전체";
      renderDetailSheets();
    });
  });
  bindFloatingAiDrag();
  $("#floatingAiToggle")?.addEventListener("click", () => {
    if (floatingAiDrag.suppressClick) return;
    setFloatingAiOpen($("#floatingAiPanel")?.hidden);
  });
  $("#floatingAiClose")?.addEventListener("click", () => {
    resetFloatingAiPosition();
    setFloatingAiOpen(false);
  });
  $("#floatingAiLawSearchBtn")?.addEventListener("click", () => submitAiQuestion("#floatingAiLawQuery", "floating"));
  $("#floatingAiLawQuery")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      renderAiSearchResults(event.target.value, { useGemini: true, surface: "floating" });
    }
  });
  document.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-detail-edit]");
    if (editButton) {
      state.editingDetailId = editButton.dataset.detailEdit || "";
      if (state.editingDetailId) state.expandedDetailIds = new Set([state.editingDetailId]);
      state.addingDetail = false;
      renderDetailSheets();
      return;
    }
    const cancelButton = event.target.closest("[data-detail-cancel]");
    if (cancelButton) {
      state.addingDetail = false;
      state.editingDetailId = "";
      renderDetailSheets();
      return;
    }
    const detailToggle = event.target.closest("[data-detail-toggle]");
    if (detailToggle) {
      const card = detailToggle.closest(".detail-sheet-card");
      const detailId = detailToggle.dataset.detailToggle || "";
      const isOpen = card.classList.toggle("open");
      card.classList.toggle("collapsed", !isOpen);
      detailToggle.setAttribute("aria-expanded", String(isOpen));
      if (detailId) {
        if (isOpen) state.expandedDetailIds.add(detailId);
        else state.expandedDetailIds.delete(detailId);
      }
      return;
    }
    const button = event.target.closest("[data-apply]");
    if (button) applyChange(button.dataset.apply);
    const detailButton = event.target.closest("[data-detail]");
    if (detailButton) openChangeDetail(detailButton.dataset.detail);
    const aiOpenButton = event.target.closest("[data-ai-open]");
    if (aiOpenButton) openLaw(aiOpenButton.dataset.aiOpen);
    const aiPreviewButton = event.target.closest("[data-ai-preview]");
    if (aiPreviewButton) openLawPreview(aiPreviewButton.dataset.aiPreview);
    const lawPreviewRetry = event.target.closest("[data-law-preview-retry]");
    if (lawPreviewRetry) loadLawPreviewContent(state.selectedPreviewLaw);
    const lawPreviewToggle = event.target.closest("[data-law-preview-toggle]");
    if (lawPreviewToggle) {
      const section = lawPreviewToggle.closest("[data-law-preview-section]");
      const collapsed = section?.classList.toggle("collapsed");
      lawPreviewToggle.setAttribute("aria-expanded", String(!collapsed));
      return;
    }
    const aiFilterButton = event.target.closest("[data-ai-filter]");
    if (aiFilterButton) {
      state.search = aiFilterButton.dataset.aiFilter || "";
      $("#registrySearch").value = state.search;
      switchView("registry");
      renderRegistry();
    }
    const lawNameTarget = event.target.closest("[data-law-name]");
    if (lawNameTarget && window.matchMedia("(max-width: 700px)").matches) {
      openLaw(lawNameTarget.dataset.lawName);
    }
  });
  $("#lawPreviewClose")?.addEventListener("click", closeLawPreview);
  $("#lawPreviewConfirmBtn")?.addEventListener("click", closeLawPreview);
  $("#lawPreviewOriginalBtn")?.addEventListener("click", () => openLaw(state.selectedPreviewLaw));
  $("#lawPreviewRegistryBtn")?.addEventListener("click", () => {
    const lawName = state.selectedPreviewLaw;
    closeLawPreview();
    state.search = lawName;
    $("#registrySearch").value = lawName;
    switchView("registry");
    renderRegistry();
  });
  $("#lawPreviewModal")?.addEventListener("click", (event) => {
    if (event.target.id === "lawPreviewModal") closeLawPreview();
  });
  document.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-detail-form]");
    if (!form) return;
    event.preventDefault();
    saveDetailForm(form);
  });
  document.addEventListener("dblclick", (event) => {
    const target = event.target.closest("[data-law-name]");
    if (target) openLaw(target.dataset.lawName);
  });
  $("#changeModalClose").addEventListener("click", closeChangeDetail);
  $("#detailCloseBtn").addEventListener("click", closeChangeDetail);
  $("#detailOpenLawBtn").addEventListener("click", openSelectedChangeLaw);
  $("#detailLoadContentBtn").addEventListener("click", loadSelectedChangeContent);
  $("#changeModal").addEventListener("click", (event) => {
    if (event.target.id === "changeModal") closeChangeDetail();
  });
  window.addEventListener("resize", fitRegistryTable);
  window.addEventListener("focus", () => syncLatestData({ silent: true }));
}

bindEvents();
setupAppHistory();
loadData().catch((error) => {
  setStatus(error.message);
  showToast(error.message);
});
window.setInterval(() => syncLatestData({ silent: true }), DATA_SYNC_INTERVAL_MS);
