const state = {
  data: { records: [], detailCards: [], changes: [], refreshLogs: [] },
  activeView: "dashboard",
  search: "",
  changeSearch: "",
  addingDetail: false,
  editingDetailId: "",
  expandedDetailIds: new Set(),
  selectedChangeId: ""
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const VALID_HISTORY_VIEWS = new Set(["dashboard", "registry", "detailSheets", "changes", "aiSearch"]);
let restoringHistory = false;

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

function pendingChanges() {
  return (state.data.changes || []).filter((item) => item.status !== "applied");
}

const CATEGORY_OPTIONS = ["안전", "환경", "에너지"];
const APPLICABILITY_OPTIONS = ["해당", "해당무"];

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

function renderDashboard() {
  const records = state.data.records || [];
  const changes = pendingChanges();
  const lastLog = (state.data.refreshLogs || [])[0];
  $("#totalCount").textContent = records.length;
  $("#changeCount").textContent = Number(lastLog?.changed || 0);
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
        </div>
        <div class="detail-form-textareas">
          <label>법규 적용내용<textarea name="mainContent" rows="10">${inputValue(card.mainContent)}</textarea></label>
          <label>당사 적용사항<textarea name="companyAction" rows="10">${inputValue(card.companyAction)}</textarea></label>
        </div>
      </form>
    </article>
  `;

  $("#detailSheetRows").innerHTML = `${state.addingDetail ? detailForm({}, "add") : ""}${cards.map((card, index) => {
    if (state.editingDetailId === card.id) return detailForm(card, "edit");
    const isOpen = state.expandedDetailIds.has(card.id);
    return `
    <article class="detail-sheet-card ${isOpen ? "open" : "collapsed"}">
      <button class="detail-register-head" data-detail-toggle="${escapeHtml(card.id || "")}" type="button" aria-expanded="${isOpen ? "true" : "false"}">
        <div class="detail-register-title">
          <span>법규등록부 ${index + 1}</span>
          <h3>${escapeHtml(card.lawName || card.sheetName || "")}</h3>
        </div>
        <div class="detail-register-actions">
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

function scrollAiChatToBottom() {
  const chat = $("#aiChatLog");
  if (chat) chat.scrollTop = chat.scrollHeight;
}

function appendAiMessage(role, html, extraClass = "") {
  const chat = $("#aiChatLog");
  if (!chat) return null;
  const message = document.createElement("div");
  message.className = `ai-message ${role} ${extraClass}`.trim();
  message.innerHTML = html;
  chat.appendChild(message);
  scrollAiChatToBottom();
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

async function renderAiSearchResults(query, options = {}) {
  const results = $("#aiLawResults");
  const cleanQuery = String(query || "").trim();
  if (!cleanQuery) {
    if (results) results.innerHTML = "";
    return;
  }

  if (options.useGemini) {
    appendAiMessage("user", `<strong>질문</strong><p>${escapeHtml(cleanQuery)}</p>`);
  }

  const matches = findAiLawMatches(cleanQuery);
  if (!matches.length) {
    if (results) results.innerHTML = "";
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
  }

  if (!options.useGemini) return;

  const loadingText = matches.length
    ? `관련 법령 후보 ${matches.length}건과 등록부 전체를 함께 참고해서 답변을 작성 중입니다.`
    : "키워드가 딱 맞지 않아도 질문 의도를 먼저 해석해서 관련 법규와 현장 조치를 찾는 중입니다.";
  const loading = appendAiMessage("assistant", `<strong>Gemini 법규 도우미</strong><p>${escapeHtml(loadingText)}</p>`, "loading");
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
        }))
      })
    });
    loading.classList.remove("loading");
    loading.innerHTML = `
      <strong>Gemini 답변</strong>
      <p>${escapeHtml(payload.answer || "답변을 생성하지 못했습니다.")}</p>
      ${(payload.recommendedLaws || []).length ? `<p><b>관련 법령</b></p><ul>${(payload.recommendedLaws || []).map((item) => `<li>${escapeHtml(item.lawName || "")}${item.reason ? `: ${escapeHtml(item.reason)}` : ""}</li>`).join("")}</ul>` : renderLawMiniList(matches)}
      ${(payload.siteRisks || []).length ? `<p><b>오영 염료 제조업 기준 위험요인</b></p><ul>${(payload.siteRisks || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${(payload.actionPlan || []).length ? `<p><b>현장 조치</b></p><ul>${(payload.actionPlan || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${(payload.checkpoints || []).length ? `<p><b>확인 포인트</b></p><ul>${(payload.checkpoints || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
      ${payload.caution ? `<p><b>주의:</b> ${escapeHtml(payload.caution)}</p>` : ""}
    `;
  } catch (error) {
    loading.classList.remove("loading");
    loading.innerHTML = `
      <strong>Gemini 답변 생성 실패</strong>
      <p>${escapeHtml(error.message)}</p>
      <p>대신 관련 법령 후보를 먼저 보여드립니다.</p>
      ${renderLawMiniList(matches)}
    `;
  }
  scrollAiChatToBottom();
}

function render() {
  renderDashboard();
  renderRegistry();
  renderDetailSheets();
  renderChanges();
  renderAiSearchResults($("#aiLawQuery")?.value || "");
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
    companyAction: String(formData.get("companyAction") || "").trim()
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
    state.data.detailCards = result.detailCards || state.data.detailCards;
    state.data.updatedAt = result.updatedAt || state.data.updatedAt;
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
  $("#aiLawSearchBtn").addEventListener("click", () => renderAiSearchResults($("#aiLawQuery").value, { useGemini: true }));
  $("#aiLawQuery").addEventListener("keydown", (event) => {
    if (event.key === "Enter") renderAiSearchResults(event.target.value, { useGemini: true });
  });
  $$(".ai-example").forEach((button) => {
    button.addEventListener("click", () => {
      $("#aiLawQuery").value = button.dataset.query || "";
      renderAiSearchResults($("#aiLawQuery").value, { useGemini: true });
    });
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
}

bindEvents();
setupAppHistory();
loadData().catch((error) => {
  setStatus(error.message);
  showToast(error.message);
});
