const STORAGE_KEY = "esqSafetyRegistry.v1";
const SIDEBAR_COLLAPSED_KEY = "esqSafetyRegistry.sidebarCollapsed";
const ACTIVE_VIEW_KEY = "esqSafetyRegistry.activeView";
const NEAR_MISS_FORM_DRAFT_KEY = "esqSafetyRegistry.nearMissFormDraft";
const AUTH_SESSION_KEY = "esqSafetyRegistry.authSession";
const STAMP_FIELD_TO_SLOT = {
  approvalWriteStamp: "write",
  approvalReviewStamp: "review",
  approvalApproveStamp: "approve"
};
let IS_DEPARTMENT_MODE = false;
const VALID_VIEWS = ["dashboard", "nearMiss", "incident", "nearMissForm", "risk", "reports", "settings"];
const DASHBOARD_YEARS = Array.from({ length: 11 }, (_, index) => String(2016 + index));

const K = {
  all: "\uC804\uCCB4",
  oyoung: "\uC624\uC601",
  sem: "SEM",
  received: "\uC811\uC218",
  inProgress: "\uC870\uCE58\uC911",
  review: "\uAC80\uD1A0\uC911",
  done: "\uC644\uB8CC",
  delayed: "\uC9C0\uC5F0",
  critical: "\uC911\uB300",
  high: "\uB192\uC74C",
  medium: "\uBCF4\uD1B5",
  low: "\uB0AE\uC74C",
  none: "\uC5C6\uC74C",
  noData: "\uB370\uC774\uD130 \uC5C6\uC74C",
  unclassified: "\uBBF8\uBD84\uB958",
  reportable: "\uB300\uC0C1",
  notReportable: "\uBE44\uB300\uC0C1",
  reflected: "\uBC18\uC601",
  notReflected: "\uBBF8\uBC18\uC601",
  riskLevel: "\uC704\uD5D8\uB4F1\uAE09",
  company: "\uBC95\uC778",
  department: "\uBD80\uC11C",
  action: "\uC870\uCE58",
  dashboard: "\uB300\uC2DC\uBCF4\uB4DC",
  nearMiss: "\uC544\uCC28\uC0AC\uACE0",
  incident: "\uC0AC\uAC74\uC0AC\uACE0 \uC870\uC0AC",
  nearMissForm: "\uC591\uC2DD\uC2DC\uC548",
  risk: "\uC704\uD5D8\uC131\uD3C9\uAC00",
  reports: "\uD1B5\uACC4",
  settings: "\uAE30\uC900\uC815\uBCF4",
  close: "\uB2EB\uAE30",
  openMenu: "\uBA54\uB274 \uD3BC\uCE58\uAE30",
  hideMenu: "\uBA54\uB274 \uC228\uAE30\uAE30"
};

const TYPES = [
  "\uAE54\uB9BC",
  "\uB07C\uC784",
  "\uB118\uC5B4\uC9D0",
  "\uB204\uC804",
  "\uB5A8\uC5B4\uC9D0",
  "\uB9DE\uC74C",
  "\uBCA0\uC784",
  "\uCC14\uB9BC",
  "\uBD80\uB52A\uD798",
  "\uBD88\uADE0\uD615 \uBC0F \uBB34\uB9AC\uD55C",
  "\uC774\uC0C1\uC628\uB3C4 \uC811\uCD09",
  "\uD654\uD559\uBB3C\uC9C8 \uB204\uCD9C",
  "\uD654\uD559\uBB3C\uC9C8 \uC811\uCD09",
  "\uD654\uC7AC \uD3ED\uBC1C",
  "\uAE30\uD0C0"
];

const CAUSES = [
  "\uBD88\uC548\uC804\uD55C \uD589\uB3D9",
  "\uC548\uC804\uC791\uC5C5\uC808\uCC28 \uBBF8\uC900\uC218",
  "\uBD88\uC548\uC804\uD55C \uC0C1\uD0DC",
  "\uC124\uBE44\uC720\uC9C0 \uAD00\uB9AC\uBD88\uB7C9",
  "\uBCF4\uD638\uAD6C \uBBF8\uCC29\uC6A9",
  "\uAD50\uC721\u00B7\uAC10\uB3C5 \uBBF8\uD761",
  "\uC791\uC5C5\uD658\uACBD \uBBF8\uD761",
  "\uAE30\uD0C0"
];

let records = [];
let loadedLocalRecordCount = 0;
let activeView = "dashboard";
let editingId = null;
let editDelegationBound = false;
let sidebarCollapsed = true;

let nearMissCompanyFilter = "all";
let incidentCompanyFilter = "all";
let dashboardCompanyFilter = "all";
let dashboardTrendYear = "all";
let deptReportCompanyFilter = "all";
let deptReportYearFilter = "all";
let deptReportMonthFilter = "all";
let typeReportCompanyFilter = "all";
let typeReportYearFilter = "all";
let typeReportMonthFilter = "all";
let nearMissRiskPickYear = "";
let nearMissRiskPickMonth = "";
let nearMissRiskPickCount = 2;
let nearMissRiskPickVisible = false;
let nearMissFormMode = "form";
let nearMissFormDraft = null;
let safetySettings = { departmentStamps: {} };
let formSubmissions = [];
let activeFormSubmissionId = "";
let activeRiskActionPickerIndex = null;
let activeSupervisorActionPickerKey = "";
let activeSheetField = "";
let currentSafetyUser = null;
let appToastTimer = null;

function $(selector) {
  return document.querySelector(selector);
}

function $$(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function safeText(value) {
  return String(value ?? "");
}

function escapeHtml(value) {
  return safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadAuthSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || "null");
    if (!session || !session.user || !session.user.id) return null;
    return session;
  } catch {
    return null;
  }
}

function saveAuthSession(user) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({
    user,
    loginAt: new Date().toISOString()
  }));
}

function clearAuthSession() {
  clearNearMissFormDraftStorage();
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function getNearMissFormDraftStorageKey() {
  const userId = String(currentSafetyUser?.id || loadAuthSession()?.user?.id || "").trim();
  return userId ? `${NEAR_MISS_FORM_DRAFT_KEY}.${userId}` : NEAR_MISS_FORM_DRAFT_KEY;
}

function clearNearMissFormDraftStorage() {
  const userId = String(currentSafetyUser?.id || loadAuthSession()?.user?.id || "").trim();
  localStorage.removeItem(NEAR_MISS_FORM_DRAFT_KEY);
  if (userId) localStorage.removeItem(`${NEAR_MISS_FORM_DRAFT_KEY}.${userId}`);
}

function showLogin(message = "") {
  document.body.classList.add("auth-locked");
  const login = $("#safetyLogin");
  const error = $("#safetyLoginError");
  if (login) login.hidden = false;
  if (error) error.textContent = message;
  setTimeout(() => $("#safetyLoginId")?.focus(), 0);
}

function hideLogin() {
  document.body.classList.remove("auth-locked");
  const login = $("#safetyLogin");
  if (login) login.hidden = true;
}

function applyAuthUser(user) {
  currentSafetyUser = user;
  const role = safeText(user?.role || "department");
  IS_DEPARTMENT_MODE = role !== "admin";
  document.body.classList.toggle("department-mode", IS_DEPARTMENT_MODE);
  document.body.classList.toggle("admin-mode", !IS_DEPARTMENT_MODE);
  updateRoleLabels();
  const badge = $("#safetyUserBadge");
  if (badge) {
    badge.textContent = `${safeText(user?.name || user?.id)} · ${role === "admin" ? "중앙관리" : "부서용"}`;
  }
}

function updateRoleLabels() {
  const nav = document.querySelector('[data-view="nearMissForm"]');
  if (nav) nav.textContent = IS_DEPARTMENT_MODE ? "양식시안" : "제출양식 확인";
  const title = $("#nearMissFormTitle");
  if (title) title.textContent = IS_DEPARTMENT_MODE ? "아차사고 양식 시안" : "제출양식 확인";
}

function getCurrentUserDepartment() {
  return cleanDepartment(currentSafetyUser?.department || currentSafetyUser?.id || "");
}

function bindAuthHandlers() {
  $("#safetyLoginForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = $("#safetyLoginError");
    const button = form.querySelector("button[type='submit']");
    const id = form.elements.id?.value?.trim() || "";
    const password = form.elements.password?.value || "";
    if (error) error.textContent = "";
    if (button) button.disabled = true;
    try {
      const response = await fetch("/api/safety-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.ok || !payload.user) {
        throw new Error(payload.message || "로그인에 실패했습니다.");
      }
      saveAuthSession(payload.user);
      window.location.reload();
    } catch (loginError) {
      if (error) error.textContent = loginError.message || "로그인에 실패했습니다.";
    } finally {
      if (button) button.disabled = false;
    }
  });

  $("#safetyLogoutBtn")?.addEventListener("click", () => {
    clearAuthSession();
    window.location.reload();
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(value) {
  const date = safeText(value).trim();
  const match = date.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2}))?/);
  if (!match) return date || "-";
  const [, year, month, day, hour, minute] = match;
  const datePart = `${year}년 ${Number(month)}월 ${Number(day)}일`;
  if (hour && minute) return `${datePart} ${hour.padStart(2, "0")}시 ${minute.padStart(2, "0")}분경`;
  return datePart;
}

function formatShortDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safeText(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function compactSummary(text, fallback = "-") {
  const cleaned = safeText(text).replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  return cleaned.length > 80 ? `${cleaned.slice(0, 80)}...` : cleaned;
}

function buildFormTitle(record) {
  const source = safeText(record.summary || record.description || "").replace(/\s+/g, " ").trim();
  if (!source) return record.type || "-";
  const match = source.match(/^(.+?)(?:위험이 있음|발생|우려)/);
  const title = match ? match[1].trim() : source;
  return title.length > 48 ? `${title.slice(0, 48)}...` : title;
}

function escapeMultiline(value) {
  return escapeHtml(safeText(value)).replace(/\n/g, "<br>");
}

function getDefaultNearMissFormDraft() {
  return {
    department: "",
    author: "",
    owner: "",
    date: today(),
    process: "",
    location: "",
    summary: "",
    type: "기타",
    completedDate: "",
    description: "",
    cause: "",
    action: "",
    adminAction: "",
    techAction: "",
    eduAction: "",
    participants: "",
    trainingDate: "",
    trainingContent: "",
    riskRows: [],
    effectivenessStatus: "적합",
    effectivenessDate: "",
    effectivenessNextDate: "",
    approvalWriteStamp: "",
    approvalReviewStamp: "",
    approvalApproveStamp: "",
    beforePhoto: "",
    afterPhoto: "",
    beforePhotoScale: "1",
    afterPhotoScale: "1",
    beforePhotoX: "50",
    beforePhotoY: "50",
    afterPhotoX: "50",
    afterPhotoY: "50",
    beforePhotoFit: "contain",
    afterPhotoFit: "contain",
    beforePhotoWidth: "100",
    beforePhotoHeight: "100",
    beforePhotoLeft: "0",
    beforePhotoTop: "0",
    afterPhotoWidth: "100",
    afterPhotoHeight: "100",
    afterPhotoLeft: "0",
    afterPhotoTop: "0",
    fontSizes: {}
  };
}

function loadNearMissFormDraft() {
  try {
    localStorage.removeItem(NEAR_MISS_FORM_DRAFT_KEY);
    const saved = JSON.parse(localStorage.getItem(getNearMissFormDraftStorageKey()) || "{}");
    nearMissFormDraft = {
      ...getDefaultNearMissFormDraft(),
      ...(saved && typeof saved === "object" ? saved : {})
    };
  } catch {
    nearMissFormDraft = getDefaultNearMissFormDraft();
  }
  if (!nearMissFormDraft.date) nearMissFormDraft.date = today();
  if (!normalizeAccidentType(nearMissFormDraft.type)) nearMissFormDraft.type = "기타";
  applyDepartmentStampToDraft({ force: false });
}

function saveNearMissFormDraft() {
  if (!nearMissFormDraft) return;
  localStorage.setItem(getNearMissFormDraftStorageKey(), JSON.stringify(nearMissFormDraft));
}

function getDepartmentStampSet(department) {
  const key = cleanDepartment(department);
  if (!key) return null;
  const stamps = safetySettings?.departmentStamps || {};
  if (stamps[key]) return stamps[key];
  const compactKey = key.replace(/\s/g, "").toUpperCase();
  const matched = Object.entries(stamps).find(([departmentName]) => {
    const normalized = cleanDepartment(departmentName);
    return normalized === key || normalized.replace(/\s/g, "").toUpperCase() === compactKey;
  });
  return matched?.[1] || null;
}

function applyDepartmentStampToDraft(options = {}) {
  if (!nearMissFormDraft) return;
  const department = cleanDepartment(nearMissFormDraft.department || getCurrentUserDepartment());
  const stamps = getDepartmentStampSet(department);
  if (!stamps) return;
  const force = Boolean(options.force);
  if (force || !nearMissFormDraft.approvalWriteStamp) nearMissFormDraft.approvalWriteStamp = stamps.write || "";
  if (force || !nearMissFormDraft.approvalReviewStamp) nearMissFormDraft.approvalReviewStamp = stamps.review || "";
  if (force || !nearMissFormDraft.approvalApproveStamp) nearMissFormDraft.approvalApproveStamp = stamps.approve || "";
}

async function loadSafetySettings() {
  try {
    const response = await fetch("/api/safety-settings", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json().catch(() => ({}));
    safetySettings = {
      departmentStamps: payload.departmentStamps && typeof payload.departmentStamps === "object" ? payload.departmentStamps : {}
    };
  } catch (error) {
    console.warn("safety settings load failed:", error);
  }
}

async function saveSafetySettings() {
  const response = await fetch("/api/safety-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safetySettings)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
}

async function loadFormSubmissions() {
  if (IS_DEPARTMENT_MODE) return;
  try {
    const response = await fetch("/api/safety-form-submissions", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json().catch(() => ({}));
    formSubmissions = Array.isArray(payload.submissions) ? payload.submissions : [];
    renderFormSubmissions();
    renderDashboardSubmissions();
  } catch (error) {
    console.warn("form submissions load failed:", error);
  }
}

async function submitNearMissFormDraft() {
  if (!IS_DEPARTMENT_MODE) return;
  if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
  const record = getNearMissFormDraftRecord();
  if (!safeText(record.department).trim() || !safeText(record.summary || record.description).trim()) {
    showAppToast("입력 확인 필요", "부서명과 사고명 또는 사고개요를 입력한 뒤 보내주세요.", "error");
    return;
  }
  try {
    const response = await fetch("/api/safety-form-submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: currentSafetyUser,
        draft: {
          ...nearMissFormDraft,
          submittedRecord: record
        }
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) throw new Error(payload.message || "제출에 실패했습니다.");
    setAiStatus("관리자에게 양식시안을 보냈습니다.", "success");
    showAppToast("저장 및 전송 완료", "관리자에게 양식시안을 보냈습니다.", "success");
  } catch (error) {
    showAppToast("전송 실패", error.message || "전송에 실패했습니다.", "error");
  }
}

function renderFormSubmissions() {
  const list = $("#formSubmissionList");
  if (!list) return;
  if (!formSubmissions.length) {
    list.innerHTML = `<tr><td colspan="7" class="empty-table-cell">제출된 양식이 없습니다.</td></tr>`;
    syncSubmissionReviewVisibility();
    return;
  }
  const sorted = formSubmissions
    .slice()
    .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  list.innerHTML = sorted.map((item, index) => {
    const data = getSubmissionDisplayData(item);
    return `
      <tr class="form-submission-row ${data.reviewed ? "reviewed" : "pending"} ${activeFormSubmissionId === item.id ? "selected" : ""}" data-load-form-submission="${escapeHtml(item.id)}" title="클릭해서 양식 불러오기">
        <td>${index + 1}</td>
        <td>${escapeHtml(data.department)}</td>
        <td>${escapeHtml(data.sender)}</td>
        <td>${escapeHtml(data.submittedAt || "-")}</td>
        <td class="form-submission-title-cell">${escapeHtml(data.title)}</td>
        <td><span class="form-submission-state ${data.reviewed ? "reviewed" : "pending"}">${data.reviewed ? "확인완료" : "미확인"}</span></td>
        <td><button class="btn small ghost" data-review-form-submission="${escapeHtml(item.id)}" type="button">${data.reviewed ? "확인됨" : "확인처리"}</button></td>
      </tr>
    `;
  }).join("");
  syncSubmissionReviewVisibility();
}

function getSubmissionDisplayData(item) {
  const draft = item?.draft || {};
  const record = draft.submittedRecord || {};
  const title = record.summary || draft.summary || record.description || draft.description || "제목 없음";
  const department = item?.user?.department || draft.department || record.department || "-";
  const sender = item?.user?.name || item?.user?.id || draft.author || record.author || "-";
  return {
    title,
    department,
    sender,
    submittedAt: formatShortDateTime(item?.submittedAt || ""),
    reviewed: item?.status === "reviewed"
  };
}

function getSubmissionMonthKey(item) {
  const submittedAt = String(item?.submittedAt || "");
  const match = submittedAt.match(/^(\d{4})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}`;
  const date = new Date(submittedAt);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }
  return "";
}

function formatSubmissionMonthLabel(monthKey) {
  const match = String(monthKey || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "-";
  return `${match[1].slice(2)}.${Number(match[2])}월`;
}

function getSubmissionMonthlyStats(items, limit = 6) {
  const monthKeys = Array.from(new Set(items.map(getSubmissionMonthKey).filter(Boolean)))
    .sort()
    .slice(-limit);
  const rows = new Map();

  items.forEach((item) => {
    const monthKey = getSubmissionMonthKey(item);
    if (!monthKeys.includes(monthKey)) return;
    const data = getSubmissionDisplayData(item);
    const department = data.department && data.department !== "-" ? data.department : "미지정";
    if (!rows.has(department)) {
      rows.set(department, {
        department,
        total: 0,
        months: Object.fromEntries(monthKeys.map((key) => [key, 0]))
      });
    }
    const row = rows.get(department);
    row.months[monthKey] += 1;
    row.total += 1;
  });

  return {
    monthKeys,
    rows: Array.from(rows.values()).sort((a, b) => b.total - a.total || a.department.localeCompare(b.department, "ko"))
  };
}

function renderDashboardSubmissionMonthlyStats() {
  const head = $("#dashboardSubmissionMonthlyHead");
  const body = $("#dashboardSubmissionMonthlyBody");
  const range = $("#dashboardSubmissionMonthlyRange");
  if (!head || !body) return;

  const stats = getSubmissionMonthlyStats(formSubmissions);
  if (!stats.monthKeys.length) {
    head.innerHTML = "";
    body.innerHTML = `<tr><td class="empty-table-cell">월별 제출 데이터가 없습니다.</td></tr>`;
    if (range) range.textContent = "제출 데이터 없음";
    return;
  }

  if (range) {
    const first = formatSubmissionMonthLabel(stats.monthKeys[0]);
    const last = formatSubmissionMonthLabel(stats.monthKeys[stats.monthKeys.length - 1]);
    range.textContent = first === last ? first : `${first} - ${last}`;
  }

  head.innerHTML = `
    <tr>
      <th>부서</th>
      ${stats.monthKeys.map((key) => `<th>${escapeHtml(formatSubmissionMonthLabel(key))}</th>`).join("")}
      <th>합계</th>
    </tr>
  `;

  const monthTotals = Object.fromEntries(stats.monthKeys.map((key) => [key, 0]));
  let grandTotal = 0;
  stats.rows.forEach((row) => {
    stats.monthKeys.forEach((key) => {
      monthTotals[key] += row.months[key] || 0;
    });
    grandTotal += row.total;
  });

  body.innerHTML = [
    ...stats.rows.map((row) => `
      <tr>
        <th>${escapeHtml(row.department)}</th>
        ${stats.monthKeys.map((key) => `<td>${row.months[key] || ""}</td>`).join("")}
        <td class="total">${row.total}</td>
      </tr>
    `),
    `<tr class="summary">
      <th>합계</th>
      ${stats.monthKeys.map((key) => `<td>${monthTotals[key] || ""}</td>`).join("")}
      <td class="total">${grandTotal}</td>
    </tr>`
  ].join("");
}

function renderDashboardSubmissions() {
  if (IS_DEPARTMENT_MODE) return;
  const total = formSubmissions.length;
  const pending = formSubmissions.filter((item) => item.status !== "reviewed").length;
  const reviewed = total - pending;
  const title = $("#dashboardSubmissionTitle");
  const caption = $("#dashboardSubmissionCaption");
  const totalEl = $("#dashboardSubmissionTotal");
  const pendingEl = $("#dashboardSubmissionPending");
  const reviewedEl = $("#dashboardSubmissionReviewed");
  const recent = $("#dashboardSubmissionRecent");
  const alertPanel = document.querySelector(".admin-dashboard-alert");

  if (title) title.textContent = pending ? `미확인 제출 ${pending}건` : "미확인 제출 없음";
  if (caption) caption.textContent = pending ? "먼저 확인해야 할 부서 제출 양식이 있습니다." : "현재 대기 중인 제출 양식은 없습니다.";
  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (reviewedEl) reviewedEl.textContent = reviewed;
  if (alertPanel) alertPanel.classList.toggle("has-pending", pending > 0);
  renderDashboardSubmissionMonthlyStats();
  if (!recent) return;

  const sorted = formSubmissions
    .slice()
    .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

  if (!sorted.length) {
    recent.innerHTML = `<div class="dashboard-submission-empty">아직 부서에서 보낸 양식이 없습니다.</div>`;
    return;
  }

  recent.innerHTML = sorted.slice(0, 5).map((item) => {
    const data = getSubmissionDisplayData(item);
    return `
      <button class="dashboard-submission-item ${data.reviewed ? "reviewed" : "pending"}" data-load-form-submission="${escapeHtml(item.id)}" type="button">
        <span class="submission-status-dot"></span>
        <span class="submission-main">
          <strong>${escapeHtml(data.title)}</strong>
          <em>${escapeHtml(data.department)} · ${escapeHtml(data.sender)} · ${escapeHtml(data.submittedAt)}</em>
        </span>
        <span class="submission-state">${data.reviewed ? "확인완료" : "미확인"}</span>
      </button>
    `;
  }).join("");
}

function syncSubmissionReviewVisibility() {
  const view = $("#nearMissFormView");
  if (!view) return;
  view.classList.toggle("awaiting-submission-selection", !IS_DEPARTMENT_MODE && !activeFormSubmissionId);
  view.classList.toggle("submission-preview-open", !IS_DEPARTMENT_MODE && Boolean(activeFormSubmissionId));
}

function closeSubmissionPreview() {
  activeFormSubmissionId = "";
  renderFormSubmissions();
  syncSubmissionReviewVisibility();
}

async function loadFormSubmissionToDraft(id) {
  const item = formSubmissions.find((entry) => entry.id === id);
  if (!item?.draft) return;
  activeFormSubmissionId = id;
  nearMissFormDraft = {
    ...getDefaultNearMissFormDraft(),
    ...item.draft
  };
  delete nearMissFormDraft.submittedRecord;
  saveNearMissFormDraft();
  nearMissFormMode = "preview";
  switchView("nearMissForm", { keepSubmissionSelection: true });
  renderFormSubmissions();
  renderNearMissForm();
  openNearMissFormPreviewWindow();
  setAiStatus("제출 양식을 불러왔습니다.", "success");
}

function getRecordFromFormSubmission(item) {
  const draft = item?.draft || {};
  const submitted = draft.submittedRecord || {};
  const sourceId = safeText(item?.id || "");
  const compactId = sourceId.replace(/^FORM-/, "").replace(/[^\dA-Za-z]/g, "").slice(0, 22) || Date.now();
  return normalizeRecord({
    ...submitted,
    id: `NM-SUB-${compactId}`,
    kind: "nearMiss",
    company: cleanDepartment(submitted.department || draft.department) === "SEM" ? K.sem : K.oyoung,
    date: submitted.date || draft.date || today(),
    department: submitted.department || draft.department || item?.user?.department || "",
    author: submitted.author || draft.author || item?.user?.name || item?.user?.id || "",
    owner: submitted.owner || draft.owner || submitted.author || draft.author || item?.user?.name || "",
    location: submitted.location || draft.location || "",
    process: submitted.process || draft.process || submitted.location || draft.location || "",
    type: submitted.type || draft.type || "기타",
    cause: submitted.cause || draft.cause || "",
    summary: submitted.summary || draft.summary || "",
    description: submitted.description || draft.description || submitted.summary || draft.summary || "",
    action: submitted.action || draft.action || "",
    completedDate: submitted.completedDate || draft.completedDate || "",
    status: K.received,
    likelihood: submitted.likelihood || 3,
    severity: submitted.severity || 3,
    updatedAt: new Date().toISOString()
  });
}

async function addSubmissionToNearMissRecords(id) {
  const item = formSubmissions.find((entry) => entry.id === id);
  if (!item) return null;
  const record = getRecordFromFormSubmission(item);
  const existingIndex = records.findIndex((row) => row.id === record.id);
  if (existingIndex >= 0) {
    records[existingIndex] = {
      ...records[existingIndex],
      ...record,
      updatedAt: new Date().toISOString()
    };
  } else {
    records.unshift(record);
  }
  await saveRecords();
  return record;
}

async function markFormSubmissionReviewed(id) {
  try {
    const record = await addSubmissionToNearMissRecords(id);
    const response = await fetch(`/api/safety-form-submissions/${encodeURIComponent(id)}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reviewed" })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await loadFormSubmissions();
    renderAll();
    if (record) setAiStatus(`${record.department} 아차사고 발굴대장에 자동 등록했습니다.`, "success");
  } catch (error) {
    alert(error.message || "확인처리 또는 아차사고 등록에 실패했습니다.");
  }
}

function setNearMissDraftValue(key, value) {
  if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
  const riskMatch = safeText(key).match(/^riskRows\.(\d+)\.(hazard|action|estimate|dueDate|doneDate|owner|actionOptions)$/);
  if (riskMatch) {
    const index = Number(riskMatch[1]);
    const field = riskMatch[2];
    nearMissFormDraft.riskRows = Array.isArray(nearMissFormDraft.riskRows) ? nearMissFormDraft.riskRows : [];
    nearMissFormDraft.riskRows[index] = {
      ...(nearMissFormDraft.riskRows[index] || {}),
      [field]: value
    };
    return;
  }
  nearMissFormDraft[key] = value;
}

function syncNearMissDraftInputs() {
  if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
  if (IS_DEPARTMENT_MODE) {
    const department = getCurrentUserDepartment();
    if (department) nearMissFormDraft.department = department;
    applyDepartmentStampToDraft({ force: true });
    saveNearMissFormDraft();
  }
  $$("[data-near-miss-draft]").forEach((field) => {
    const key = field.dataset.nearMissDraft;
    if (!key) return;
    field.value = nearMissFormDraft[key] ?? "";
  });
  syncSheetFontControl();
}

function syncSheetFontControl() {
  const select = $("#sheetFontSizeSelect");
  if (!select) return;
  const size = activeSheetField ? nearMissFormDraft?.fontSizes?.[activeSheetField] || "" : "";
  select.value = size;
  select.disabled = !activeSheetField;
}

function isVisibleNearMissField(field) {
  if (!field || field.disabled) return false;
  const rect = field.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && getComputedStyle(field).visibility !== "hidden";
}

function focusNearMissField(field) {
  field.focus({ preventScroll: true });
  field.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (field.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  } else if (typeof field.select === "function" && field.tagName !== "SELECT") {
    field.select();
  }
}

function moveNearMissFormFocus(currentField, direction = 1) {
  const fields = $$("#nearMissFormSheet [data-near-miss-draft]")
    .filter(isVisibleNearMissField);
  if (!fields.length) return;
  const currentIndex = fields.indexOf(currentField);
  const nextIndex = currentIndex >= 0
    ? (currentIndex + direction + fields.length) % fields.length
    : (direction > 0 ? 0 : fields.length - 1);
  focusNearMissField(fields[nextIndex]);
}

function getNearMissFormDraftRecord() {
  if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
  return normalizeRecord({
    id: "FORM-DRAFT",
    kind: "nearMiss",
    company: cleanDepartment(nearMissFormDraft.department) === "SEM" ? K.sem : K.oyoung,
    date: nearMissFormDraft.date || today(),
    department: nearMissFormDraft.department,
    author: nearMissFormDraft.author,
    owner: nearMissFormDraft.owner || nearMissFormDraft.author,
    location: nearMissFormDraft.location,
    process: nearMissFormDraft.location || nearMissFormDraft.process,
    type: nearMissFormDraft.type || "기타",
    cause: nearMissFormDraft.cause,
    summary: nearMissFormDraft.summary,
    description: nearMissFormDraft.description,
    action: nearMissFormDraft.action,
    adminAction: nearMissFormDraft.adminAction,
    techAction: nearMissFormDraft.techAction,
    eduAction: nearMissFormDraft.eduAction,
    participants: nearMissFormDraft.participants,
    trainingDate: nearMissFormDraft.trainingDate,
    trainingContent: nearMissFormDraft.trainingContent,
    completedDate: nearMissFormDraft.completedDate,
    status: K.received,
    likelihood: 3,
    severity: 3
  });
}

function draftField(field, value, options = {}) {
  const tag = options.multiline ? "textarea" : "input";
  const classes = ["sheet-input"];
  if (options.multiline) classes.push("sheet-textarea");
  if (options.compact) classes.push("compact");
  const placeholder = escapeHtml(options.placeholder || "");
  const escapedValue = escapeHtml(value || "");
  const style = nearMissFormDraft?.fontSizes?.[field] ? ` style="font-size:${escapeHtml(nearMissFormDraft.fontSizes[field])}"` : "";
  if (options.type === "select") {
    return `<select class="${classes.join(" ")}" data-near-miss-draft="${escapeHtml(field)}" title="${placeholder}"${style}>
      ${TYPES.map((type) => `<option value="${escapeHtml(type)}" ${type === value ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
    </select>`;
  }
  if (tag === "textarea") {
    return `<textarea class="${classes.join(" ")}" data-near-miss-draft="${escapeHtml(field)}" placeholder="${placeholder}" rows="${options.rows || 2}"${style}>${escapedValue}</textarea>`;
  }
  return `<input class="${classes.join(" ")}" data-near-miss-draft="${escapeHtml(field)}" type="${options.type || "text"}" value="${escapedValue}" placeholder="${placeholder}"${style}>`;
}

function stampField(field, label) {
  const value = nearMissFormDraft?.[field] || "";
  const slot = STAMP_FIELD_TO_SLOT[field] || "";
  const savedStamp = getDepartmentStampSet(nearMissFormDraft?.department || getCurrentUserDepartment())?.[slot] || "";
  return `
    <div class="stamp-cell">
      ${value ? `<img class="stamp-image" src="${escapeHtml(value)}" alt="${escapeHtml(label)} 도장">` : `<span class="stamp-placeholder">도장</span>`}
      <div class="stamp-actions">
        ${savedStamp ? `<button class="stamp-approve-btn" data-stamp-approve="${escapeHtml(field)}" type="button">확인</button>` : ""}
        <label class="stamp-upload-btn">
          등록
          <input data-stamp-upload="${escapeHtml(field)}" type="file" accept="image/*">
        </label>
        ${value ? `<button class="stamp-remove-btn" data-stamp-remove="${escapeHtml(field)}" type="button">삭제</button>` : ""}
      </div>
    </div>
  `;
}

function riskDraftField(index, field, value, options = {}) {
  const classes = ["sheet-input"];
  if (options.multiline) classes.push("sheet-risk-text");
  const key = `riskRows.${index}.${field}`;
  const style = nearMissFormDraft?.fontSizes?.[key] ? ` style="font-size:${escapeHtml(nearMissFormDraft.fontSizes[key])}"` : "";
  const placeholder = escapeHtml(options.placeholder || "");
  const escapedValue = escapeHtml(value || "");
  if (options.multiline) {
    return `<div class="${classes.join(" ")}" data-risk-draft-index="${index}" data-risk-draft-field="${escapeHtml(field)}" data-near-miss-draft="${escapeHtml(key)}" contenteditable="true" role="textbox" tabindex="0" aria-label="${placeholder}"${style}>${escapedValue}</div>`;
  }
  return `<input class="${classes.join(" ")}" data-risk-draft-index="${index}" data-risk-draft-field="${escapeHtml(field)}" data-near-miss-draft="${escapeHtml(key)}" type="${options.type || "text"}" value="${escapedValue}" placeholder="${placeholder}"${style}>`;
}

function splitActionItems(value) {
  return safeText(value)
    .split(/\n|ㆍ|·|;/)
    .map((item) => item.replace(/^[\s\-•]+/, "").trim())
    .filter(Boolean);
}

function uniqueTextItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = safeText(item).replace(/\s+/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function riskActionField(index, value, options = []) {
  const selected = splitActionItems(value);
  return `
    <div class="risk-action-editor">
      ${riskDraftField(index, "action", selected.join("\n"), { multiline: true, rows: 2, placeholder: "선택한 감소대책" })}
      <button class="risk-action-suggest" type="button" data-risk-action-open="${index}">추천</button>
    </div>
  `;
}

function supervisorActionField(field, value, label, options = []) {
  return `
    <div class="supervisor-action-cell" data-supervisor-action-cell="${escapeHtml(field)}">
      ${draftField(field, value, { multiline: true, rows: 1, placeholder: `${label} 개선대책` })}
      <button class="supervisor-action-suggest" type="button" data-supervisor-action-open="${escapeHtml(field)}">추천</button>
      ${renderSupervisorActionPopup(field, label, value, options)}
    </div>
  `;
}

function riskDateField(index, field, value, label) {
  const key = `riskRows.${index}.${field}`;
  const display = safeText(value || "").trim();
  return `
    <div class="risk-date-picker">
      <div class="risk-date-value">${escapeHtml(display || "-")}</div>
      <button class="risk-date-button" type="button" data-risk-date-button="${escapeHtml(key)}">달력</button>
      <input class="risk-date-native" data-near-miss-draft="${escapeHtml(key)}" type="date" value="${escapeHtml(display)}" aria-label="${escapeHtml(label)}">
    </div>
  `;
}

function renderRiskActionPopup(index, draft) {
  if (nearMissFormMode !== "assessment" || activeRiskActionPickerIndex !== index) return "";
  const savedDraft = Array.isArray(nearMissFormDraft.riskRows) ? nearMissFormDraft.riskRows[index] || {} : {};
  const hazard = savedDraft.hazard || draft.hazard || `유해위험요인 ${index + 1}`;
  const selectedAction = Object.prototype.hasOwnProperty.call(savedDraft, "action") ? savedDraft.action : draft.action;
  const selected = splitActionItems(selectedAction || "");
  const options = uniqueTextItems(Array.isArray(savedDraft.actionOptions) && savedDraft.actionOptions.length ? savedDraft.actionOptions : (draft.actionOptions || []));
  const manualValue = selected.join("\n");
  const buttons = options.map((option) => {
    const active = selected.some((item) => item.replace(/\s+/g, "") === option.replace(/\s+/g, ""));
    return `<button class="risk-action-panel-option${active ? " active" : ""}" type="button" data-risk-action-index="${index}" data-risk-action-option="${escapeHtml(option)}">${escapeHtml(option)}</button>`;
  }).join("");
  return `
    <div class="risk-action-popup">
      <div class="risk-action-popup-head">
        <strong>감소대책 선택</strong>
        <button type="button" data-close-risk-action-picker>닫기</button>
      </div>
      <p>${escapeHtml(hazard)}</p>
      <div class="risk-action-panel-options">${buttons || `<span class="risk-action-panel-empty">추천 대책 없음</span>`}</div>
      <div class="risk-action-manual">
        <label for="riskActionManual${index}">직접 입력</label>
        <textarea id="riskActionManual${index}" data-risk-action-manual="${index}" rows="3" placeholder="현장 상황에 맞는 감소대책을 직접 입력하세요.">${escapeHtml(manualValue)}</textarea>
        <button type="button" data-risk-action-apply-manual="${index}">직접 입력 적용</button>
      </div>
    </div>
  `;
}

function renderSupervisorActionPopup(field, label, value, options = []) {
  if (activeSupervisorActionPickerKey !== field) return "";
  const selectedKey = safeText(value).replace(/\s+/g, "");
  const manualId = `supervisorActionManual${field}`;
  const buttons = uniqueTextItems(options).map((option) => {
    const active = option.replace(/\s+/g, "") === selectedKey;
    return `<button class="risk-action-panel-option${active ? " active" : ""}" type="button" data-supervisor-action-option="${escapeHtml(field)}" data-supervisor-action-value="${escapeHtml(option)}">${escapeHtml(option)}</button>`;
  }).join("");
  return `
    <div class="risk-action-popup supervisor-action-popup">
      <div class="risk-action-popup-head">
        <strong>${escapeHtml(label)} 개선대책 선택</strong>
        <button type="button" data-close-risk-action-picker>닫기</button>
      </div>
      <p>사고개요·위험요인·개선대책을 기준으로 관련 있는 후보만 표시합니다.</p>
      <div class="risk-action-panel-options">${buttons || `<span class="risk-action-panel-empty">추천 대책 없음</span>`}</div>
      <div class="risk-action-manual">
        <label for="${escapeHtml(manualId)}">직접 입력</label>
        <textarea id="${escapeHtml(manualId)}" data-supervisor-action-manual="${escapeHtml(field)}" rows="3" placeholder="${escapeHtml(label)} 개선대책을 직접 입력하세요.">${escapeHtml(value || "")}</textarea>
        <button type="button" data-supervisor-action-apply-manual="${escapeHtml(field)}">직접 입력 적용</button>
      </div>
    </div>
  `;
}

function riskEstimateCell(index, value, target) {
  const active = safeText(value || "보완") === target;
  return `<button class="risk-check-btn${active ? " active" : ""}" type="button" data-risk-estimate-index="${index}" data-risk-estimate-value="${escapeHtml(target)}" aria-label="${escapeHtml(target)}">${active ? "√" : ""}</button>`;
}

function effectivenessCheckCell(value, target) {
  const active = safeText(value || "적합") === target;
  return `<button class="effectiveness-check-btn${active ? " active" : ""}" type="button" data-effectiveness-status="${escapeHtml(target)}" aria-label="${escapeHtml(target)}">${active ? "√" : ""}</button>`;
}

function effectivenessDateField(field, value) {
  return `<input class="effectiveness-date-input" data-near-miss-draft="${escapeHtml(field)}" type="date" value="${escapeHtml(value || "")}">`;
}

function photoField(field, label) {
  const value = nearMissFormDraft?.[field] || "";
  const xField = field === "beforePhoto" ? "beforePhotoX" : "afterPhotoX";
  const yField = field === "beforePhoto" ? "beforePhotoY" : "afterPhotoY";
  const fitField = field === "beforePhoto" ? "beforePhotoFit" : "afterPhotoFit";
  const cropPrefix = field === "beforePhoto" ? "beforePhoto" : "afterPhoto";
  const width = Number(nearMissFormDraft?.[`${cropPrefix}Width`] || 100);
  const height = Number(nearMissFormDraft?.[`${cropPrefix}Height`] || 100);
  const left = Number(nearMissFormDraft?.[`${cropPrefix}Left`] || 0);
  const top = Number(nearMissFormDraft?.[`${cropPrefix}Top`] || 0);
  const fit = nearMissFormDraft?.[fitField] || "contain";
  return `
    <div class="photo-upload-field" data-photo-frame="${escapeHtml(field)}">
      ${value ? `
        <div class="photo-layer" data-photo-layer="${escapeHtml(cropPrefix)}" style="left:${escapeHtml(left)}%; top:${escapeHtml(top)}%; width:${escapeHtml(width)}%; height:${escapeHtml(height)}%">
          <img class="photo-preview" src="${escapeHtml(value)}" alt="${escapeHtml(label)}" data-photo-x-field="${escapeHtml(xField)}" data-photo-y-field="${escapeHtml(yField)}" style="object-fit:${escapeHtml(fit)}">
          <button class="photo-layer-handle handle-nw" data-photo-layer-resize="${escapeHtml(cropPrefix)}" data-resize-dir="nw" type="button" aria-label="왼쪽 위 크기 조정"></button>
          <button class="photo-layer-handle handle-n" data-photo-layer-resize="${escapeHtml(cropPrefix)}" data-resize-dir="n" type="button" aria-label="위쪽 크기 조정"></button>
          <button class="photo-layer-handle handle-ne" data-photo-layer-resize="${escapeHtml(cropPrefix)}" data-resize-dir="ne" type="button" aria-label="오른쪽 위 크기 조정"></button>
          <button class="photo-layer-handle handle-e" data-photo-layer-resize="${escapeHtml(cropPrefix)}" data-resize-dir="e" type="button" aria-label="오른쪽 크기 조정"></button>
          <button class="photo-layer-handle handle-se" data-photo-layer-resize="${escapeHtml(cropPrefix)}" data-resize-dir="se" type="button" aria-label="오른쪽 아래 크기 조정"></button>
          <button class="photo-layer-handle handle-s" data-photo-layer-resize="${escapeHtml(cropPrefix)}" data-resize-dir="s" type="button" aria-label="아래쪽 크기 조정"></button>
          <button class="photo-layer-handle handle-sw" data-photo-layer-resize="${escapeHtml(cropPrefix)}" data-resize-dir="sw" type="button" aria-label="왼쪽 아래 크기 조정"></button>
          <button class="photo-layer-handle handle-w" data-photo-layer-resize="${escapeHtml(cropPrefix)}" data-resize-dir="w" type="button" aria-label="왼쪽 크기 조정"></button>
        </div>
      ` : `<span class="photo-placeholder">${escapeHtml(label)}</span>`}
      <div class="photo-actions">
        <label class="photo-upload-btn">
          사진 등록
          <input data-photo-upload="${escapeHtml(field)}" type="file" accept="image/*">
        </label>
        ${value ? `<button class="photo-remove-btn" data-photo-remove="${escapeHtml(field)}" type="button">삭제</button>` : ""}
      </div>
      ${value ? `
        <button class="photo-fit-toggle" data-photo-fit="${escapeHtml(fitField)}" type="button">${fit === "cover" ? "전체보기" : "채우기"}</button>
      ` : ""}
    </div>
  `;
}

function getPrintFieldText(control) {
  if (!control) return "";
  const draftKey = control.dataset?.nearMissDraft || "";
  const riskMatch = draftKey.match(/^riskRows\.(\d+)\.(hazard|action|estimate|dueDate|doneDate|owner|actionOptions)$/);
  if (riskMatch) {
    const index = Number(riskMatch[1]);
    const field = riskMatch[2];
    const row = Array.isArray(nearMissFormDraft?.riskRows) ? nearMissFormDraft.riskRows[index] || {} : {};
    if (field in row) return Array.isArray(row[field]) ? row[field].join("\n") : safeText(row[field]);
  } else if (draftKey && Object.prototype.hasOwnProperty.call(nearMissFormDraft || {}, draftKey)) {
    return safeText(nearMissFormDraft[draftKey]);
  }
  if (control.tagName === "SELECT") {
    return control.options[control.selectedIndex]?.textContent || control.value || "";
  }
  return control.value || control.textContent || "";
}

function buildNearMissPrintHtml() {
  const sheet = $("#nearMissFormSheet");
  if (!sheet) return "";
  const clone = sheet.cloneNode(true);
  clone.querySelectorAll("input, textarea, select").forEach((control) => {
    if (control.type === "file") {
      control.remove();
      return;
    }
    const text = getPrintFieldText(control);
    const replacement = document.createElement("div");
    replacement.className = "print-field-text";
    replacement.textContent = text;
    replacement.style.fontSize = control.style.fontSize || "";
    replacement.style.whiteSpace = "pre-wrap";
    replacement.style.lineHeight = "1.35";
    replacement.style.fontWeight = "700";
    replacement.style.width = "100%";
    replacement.style.height = "100%";
    replacement.style.boxSizing = "border-box";
    replacement.style.padding = "2px 4px";
    control.replaceWith(replacement);
  });
  clone.querySelectorAll(".photo-actions, .photo-drag-hint, .photo-fit-toggle, .photo-layer-handle, .risk-action-popup, .risk-action-suggest, .supervisor-action-suggest").forEach((item) => item.remove());
  clone.querySelectorAll(".risk-date-picker").forEach((picker) => {
    const text = picker.querySelector(".risk-date-value")?.textContent || "";
    const replacement = document.createElement("div");
    replacement.className = "print-field-text";
    replacement.textContent = text;
    replacement.style.display = "flex";
    replacement.style.alignItems = "center";
    replacement.style.justifyContent = "center";
    replacement.style.width = "100%";
    replacement.style.height = "100%";
    replacement.style.fontWeight = "700";
    replacement.style.fontSize = "8.5px";
    replacement.style.whiteSpace = "nowrap";
    picker.replaceWith(replacement);
  });

  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => `<link rel="stylesheet" href="${escapeHtml(link.href)}">`)
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <title>아차사고 양식 인쇄</title>
  ${styleLinks}
  <style>
    @page { size: A4 portrait; margin: 8mm; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-root { width: 190mm; margin: 0 auto; }
    .preview-toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 190mm;
      box-sizing: border-box;
      margin: 0 auto 12px;
      padding: 10px 14px;
      background: #143a67;
      color: #fff;
      font-family: "IBM Plex Sans KR", Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(15, 23, 42, .16);
    }
    .preview-toolbar strong { font-size: 15px; }
    .preview-toolbar div { display: flex; gap: 6px; }
    .preview-toolbar button {
      min-height: 30px;
      padding: 0 12px;
      border: 1px solid rgba(255,255,255,.35);
      border-radius: 4px;
      background: #fff;
      color: #143a67;
      font-weight: 800;
      cursor: pointer;
    }
    .preview-toolbar button.active {
      background: #fffbeb;
      color: #9a5a00;
      border-color: #f5c76b;
    }
    .near-miss-form-wrap { display: block !important; }
    body.preview-page-1 .draft-paper:nth-child(2),
    body.preview-page-2 .draft-paper:nth-child(1) {
      display: none !important;
    }
    .draft-paper {
      width: 190mm !important;
      height: 277mm !important;
      padding: 0 !important;
      border: 0 !important;
      box-shadow: none !important;
      page-break-after: always;
      break-after: page;
      overflow: hidden !important;
      box-sizing: border-box !important;
    }
    .draft-paper:last-child { page-break-after: auto; break-after: auto; }
    .draft-paper + .draft-paper { margin-top: 0 !important; }
    .a4-sheet,
    .risk-annex-sheet {
      width: 100% !important;
      height: 277mm !important;
      box-sizing: border-box !important;
      border: .6px solid #000 !important;
    }
    .a4-sheet header,
    .a4-sheet section,
    .a4-sheet div,
    .risk-annex-table,
    .risk-annex-measures,
    .risk-annex-table th,
    .risk-annex-table td,
    .risk-annex-measures th,
    .risk-annex-measures td,
    .risk-annex-meta,
    .risk-annex-meta div {
      border-width: .6px !important;
    }
    .a4-sheet *,
    .risk-annex-sheet * {
      background-color: #ffffff !important;
      box-shadow: none !important;
    }
    .photo-placeholder,
    .photo-upload-field,
    .photo-layer,
    .photo-preview {
      background-color: transparent !important;
    }
    .print-field-text { color: #000; overflow: hidden; word-break: keep-all; overflow-wrap: anywhere; }
    .photo-actions, .photo-drag-hint, .photo-fit-toggle, .photo-layer-handle,
    .stamp-actions, .stamp-placeholder { display: none !important; }
    .photo-upload-field { min-height: 100% !important; }
    .photo-preview { width: 100% !important; height: 100% !important; }
    .stamp-cell { min-height: 100% !important; display: grid !important; place-items: center !important; }
    .stamp-image { max-width: 42px !important; max-height: 42px !important; object-fit: contain !important; }
    .info-item strong:has(.print-field-text),
    .narrative-item div:has(.print-field-text),
    .risk-row div:has(.print-field-text),
    .risk-annex-table td:has(.print-field-text) { padding: 0 !important; }
    .risk-annex-table tbody td:nth-child(7):has(.print-field-text),
    .risk-annex-table tbody td:nth-child(8):has(.print-field-text),
    .risk-annex-table tbody td:nth-child(9):has(.print-field-text) {
      vertical-align: middle !important;
      text-align: center !important;
    }
    .risk-annex-table tbody td:nth-child(7) .print-field-text,
    .risk-annex-table tbody td:nth-child(8) .print-field-text,
    .risk-annex-table tbody td:nth-child(9) .print-field-text {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      height: 100% !important;
      min-height: 100% !important;
      white-space: nowrap !important;
      word-break: normal !important;
      overflow-wrap: normal !important;
      font-size: 8.5px !important;
      line-height: 1 !important;
    }
    @media print {
      .preview-toolbar { display: none !important; }
      body.preview-page-1 .draft-paper:nth-child(2),
      body.preview-page-2 .draft-paper:nth-child(1) { display: block !important; }
      .print-root { margin: 0; }
    }
  </style>
  <script>
    function showPreviewPage(page) {
      document.body.classList.toggle("preview-page-1", page === 1);
      document.body.classList.toggle("preview-page-2", page === 2);
      document.querySelectorAll("[data-preview-page]").forEach(function(button) {
        button.classList.toggle("active", Number(button.dataset.previewPage) === page);
      });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    window.addEventListener("DOMContentLoaded", function() { showPreviewPage(1); });
  </script>
</head>
<body class="preview-page-1">
  <div class="preview-toolbar">
    <strong>제출 양식 미리보기</strong>
    <div>
      <button type="button" class="active" data-preview-page="1" onclick="showPreviewPage(1)">발굴개선표</button>
      <button type="button" data-preview-page="2" onclick="showPreviewPage(2)">위험성평가</button>
    </div>
    <div>
      <button type="button" onclick="window.print()">프린트</button>
      <button type="button" onclick="window.close()">닫기</button>
    </div>
  </div>
  <div class="print-root">${clone.innerHTML}</div>
</body>
</html>`;
}

function openNearMissFormPreviewWindow() {
  const html = buildNearMissPrintHtml();
  if (!html) return false;
  const width = 980;
  const height = 1050;
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  const previewWindow = window.open("", "_blank", `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
  if (!previewWindow) return false;
  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
  previewWindow.focus();
  return true;
}

function printNearMissForm() {
  if (IS_DEPARTMENT_MODE) {
    alert("프린트는 관리자만 사용할 수 있습니다.");
    return;
  }
  const html = buildNearMissPrintHtml();
  if (!html) return;
  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    window.print();
    return;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 450);
}

function parseGeminiJsonObject(rawText) {
  const stripped = safeText(rawText).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI response did not contain a JSON object.");
  return JSON.parse(match[0]);
}

function buildExpertRiskPrompt(record) {
  const payload = {
    department: record.department,
    date: record.date,
    author: record.author,
    owner: record.owner,
    location: record.location,
    process: record.process,
    type: record.type,
    summary: record.summary,
    description: record.description,
    cause: record.cause,
    currentAction: record.action,
    adminAction: record.adminAction,
    techAction: record.techAction,
    eduAction: record.eduAction
  };
  return [
    "너는 제조업 현장 산업안전보건 전문가이며, 대책 수준을 엄격하게 평가하는 안전관리자다.",
    "아래 아차사고 발굴개선표 입력값을 읽고, 이 상황에만 맞는 위험성평가 초안을 작성한다.",
    "절대 범용 문구만 쓰지 말고, 입력값의 장소/설비/작업대상/원인/위험행동을 문장에 직접 반영한다.",
    "위험성 감소대책(action)은 반드시 해당 위험을 직접 낮추는 물리적·공학적·작업방법 개선이어야 한다.",
    "action에는 입력값에 있는 실제 장소명, 설비명, 작업대상, 위험원 중 최소 1개 이상을 그대로 포함한다.",
    "action이 '해당 구간', '작업 장소', '위험 부위', '설비 주변'처럼 대상을 흐리게 쓰면 실패다.",
    "좋은 action 예: 방치 자재를 지정 보관대로 이동, 통행로 구획선 표시, 돌출부 완충재 설치, 끼임부 방호덮개 설치, 배관 체결부 보수, 누출받이 설치, 개구부 덮개 설치, 작업동선 분리, 잠금표시 적용.",
    "나쁜 action 예: 교육한다, 주의한다, 점검한다, 공유한다, 확인한다, 관리한다. 이런 말만 단독으로 쓰면 안 된다.",
    "점검이 필요한 경우에도 반드시 후속 조치를 같이 쓴다. 예: 점검하고 불량부를 보수한다, 체결 상태를 확인하고 누출부를 교체한다.",
    "교육은 eduAction에만 쓴다. riskRows.action에는 교육만 쓰지 않는다.",
    "eduAction은 교육적 예방대책이므로 TBM 공유, 작업 전 위험요인 교육, 주의사항 전파처럼 간단하고 자연스럽게 작성해도 된다.",
    "actionOptions도 전부 현장 조치 중심으로 작성한다. 교육/주의/공유만 있는 선택지는 금지한다.",
    "감소대책은 '무엇을', '어디에', '어떻게 조치할지'가 보이게 작성한다.",
    "각 action은 한 문장으로 작성하되, 조치 대상과 조치 방법이 동시에 보여야 한다.",
    "가능하면 위험원 제거 → 접근 차단/방호 → 작업동선·보관위치 개선 → 관리기준 순서로 제시한다.",
    "관련 없는 보호구, 장갑, 교육 문구를 억지로 넣지 않는다.",
    "재해유형이 애매하면 사고개요와 위험요인을 읽고 가장 타당한 관점으로 판단한다.",
    "한국어로만 작성한다.",
    "JSON object만 반환한다. markdown 금지.",
    "형식:",
    "{",
    "  \"riskRows\": [",
    "    {\"hazard\":\"구체 유해위험요인\", \"estimate\":\"적정|보완|해당없음\", \"action\":\"구체 위험성 감소대책\", \"actionOptions\":[\"선택 가능한 대책 1\", \"선택 가능한 대책 2\"], \"dueDate\":\"YYYY-MM-DD 또는 빈 문자열\", \"doneDate\":\"YYYY-MM-DD 또는 빈 문자열\", \"owner\":\"담당자\"}",
    "  ],",
    "  \"adminAction\":\"관리적 예방대책 1문장\",",
    "  \"techAction\":\"기술적 예방대책 1문장\",",
    "  \"eduAction\":\"교육적 예방대책 1문장\"",
    "}",
    "riskRows는 2~5개만 작성한다. 각각 서로 다른 위험요인으로 작성한다.",
    "estimate는 개선이 필요한 항목이면 보완으로 한다.",
    "actionOptions는 해당 hazard에 바로 맞는 현장 조치 대안만 2~4개 작성한다.",
    `입력값: ${JSON.stringify(payload, null, 2)}`
  ].join("\n");
}

function getRecordSpecificTerms(record) {
  const text = [
    record.location,
    record.process,
    record.summary,
    record.description,
    record.cause,
    record.action
  ].map(safeText).join(" ");
  const terms = new Set();
  const phraseMatches = text.match(/[가-힣A-Za-z0-9()\-·\/]{2,}(?:\s*[가-힣A-Za-z0-9()\-·\/]{1,}){0,4}/g) || [];
  phraseMatches.forEach((phrase) => {
    const clean = cleanExpertPhrase(phrase);
    if (clean.length >= 3 && !/(작업자|위험|사고|발생|개선|대책|조치|관련|가능|미흡|확인|교육|점검|관리|주의|공유|실시|작업|이동|사용|상태)$/.test(clean)) {
      terms.add(clean);
    }
  });
  const situation = getExpertSituation(record);
  [situation.location, situation.target, situation.cause, situation.material, situation.task]
    .map((item) => cleanExpertPhrase(item))
    .filter((item) => item.length >= 3)
    .forEach((item) => terms.add(item));
  return Array.from(terms)
    .flatMap((term) => [term, ...term.split(/\s+/).filter((part) => part.length >= 3)])
    .map((term) => term.replace(/[^\w가-힣()\-·\/]/g, ""))
    .filter((term) => term.length >= 3)
    .slice(0, 30);
}

function hasRecordSpecificTerm(action, record) {
  const compactAction = safeText(action).replace(/\s+/g, "");
  return getRecordSpecificTerms(record).some((term) => {
    const compactTerm = term.replace(/\s+/g, "");
    return compactTerm.length >= 3 && compactAction.includes(compactTerm);
  });
}

function isWeakRiskReductionAction(action) {
  const text = safeText(action).replace(/\s+/g, " ").trim();
  if (!text) return true;
  const compact = text.replace(/\s+/g, "");
  const controlWords = /(설치|제거|보수|교체|차단|분리|구획|지정|이동|고정|덮개|커버|난간|방호|보호재|완충재|잠금|체결|비치|보완|조정|표시|제한|확보|개선|재정리|마감|격리|받침|방유|흡착재|보관대)/;
  const weakOnlyWords = /(교육|주의|공유|점검|확인|관리|전파|TBM|순찰)/g;
  const hasControl = controlWords.test(compact);
  if (hasControl) return false;
  const weakMatches = compact.match(weakOnlyWords) || [];
  if (weakMatches.length) return true;
  return text.length < 18;
}

function isPoorRiskReductionAction(action, record) {
  const text = safeText(action).replace(/\s+/g, " ").trim();
  if (isWeakRiskReductionAction(text)) return true;
  if (/(해당\s*(구간|장소|설비|부위)|위험\s*(부위|요인)|작업\s*(장소|구간)|관련\s*(작업|설비))/.test(text) && !hasRecordSpecificTerm(text, record)) return true;
  return !hasRecordSpecificTerm(text, record);
}

function getStrongRiskFallbackAction(record, index = 0) {
  const profile = getExpertSafetyProfile(record);
  const contextual = getContextualExpertItems(profile, record);
  const candidates = uniqueTextItems([
    ...(contextual.actions || []),
    ...profile.actions.map((item) => materializeExpertText(item, record))
  ]);
  return candidates.find((item) => !isPoorRiskReductionAction(item, record))
    || candidates.find((item) => !isWeakRiskReductionAction(item))
    || candidates[index]
    || `${getExpertSituation(record).target}를 현장 확인 후 제거·차단·보호재 설치 등 물리적 개선을 실시한다.`;
}

function normalizeExpertRiskRows(payload, record) {
  const rows = Array.isArray(payload?.riskRows) ? payload.riskRows : [];
  const fallbackRows = buildRiskDrafts(record).slice(0, 5);
  const sourceRows = rows.length ? rows : fallbackRows;
  const dueDate = safeText(record.dueDate || record.date || "");
  const doneDate = safeText(record.completedDate || record.dueDate || record.date || "");
  const owner = safeText(record.owner || record.author || "-");
  return sourceRows
    .map((row, index) => {
      const fallbackAction = fallbackRows[index]?.action || getStrongRiskFallbackAction(record, index);
      const rawAction = compactSummary(row.action || fallbackAction, "");
      const action = isPoorRiskReductionAction(rawAction, record) ? fallbackAction : rawAction;
      const rawOptions = Array.isArray(row.actionOptions) ? row.actionOptions.map(safeText) : [];
      const actionOptions = uniqueTextItems([action, ...rawOptions, fallbackAction, ...(fallbackRows[index]?.actionOptions || [])])
        .filter((item) => !isPoorRiskReductionAction(item, record))
        .slice(0, 4);
      return {
        hazard: compactSummary(row.hazard || row.description || fallbackRows[index]?.hazard || "", ""),
        estimate: ["적정", "보완", "해당없음"].includes(safeText(row.estimate)) ? safeText(row.estimate) : "보완",
        action,
        actionOptions: actionOptions.length ? actionOptions : [action],
        dueDate: safeText(row.dueDate || dueDate),
        doneDate: safeText(row.doneDate || doneDate),
        owner: safeText(row.owner || owner)
      };
    })
    .filter((row) => row.hazard && row.action)
    .slice(0, 5);
}

async function requestExpertRiskAssessment(record) {
  if (!await hasServerGeminiConfig()) throw new Error("Gemini API 키가 설정되지 않았습니다.");
  const response = await fetch("/api/safety-gemini/recommend-risk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: buildExpertRiskPrompt(record) })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || `HTTP ${response.status}`);
  return parseGeminiJsonObject(result.text);
}

async function generateNearMissRiskAssessment() {
  if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
  const record = getNearMissFormDraftRecord();
  let payload = null;
  try {
    setAiStatus("AI가 현장 상황에 맞는 위험성평가를 작성하는 중...");
    payload = await requestExpertRiskAssessment(record);
  } catch (error) {
    console.warn("expert risk recommendation failed:", error);
    setAiStatus(`AI 추천 실패: ${error.message || "로컬 추천으로 전환합니다."}`, "warning");
  }

  if (payload) {
    nearMissFormDraft.riskRows = normalizeExpertRiskRows(payload, record);
    if (payload.adminAction) nearMissFormDraft.adminAction = compactSummary(payload.adminAction, "");
    if (payload.techAction) nearMissFormDraft.techAction = compactSummary(payload.techAction, "");
    if (payload.eduAction) nearMissFormDraft.eduAction = compactSummary(payload.eduAction, "");
  } else {
    const drafts = buildRiskDrafts(record).slice(0, 8);
    nearMissFormDraft.riskRows = drafts.map((draft) => ({
      hazard: draft.hazard,
      estimate: draft.estimate,
      action: draft.action,
      actionOptions: draft.actionOptions || [],
      dueDate: draft.dueDate,
      doneDate: draft.doneDate,
      owner: draft.owner
    }));
  }
  saveNearMissFormDraft();
  nearMissFormMode = "assessment";
  renderNearMissForm();
  if (payload) setAiStatus("상황 맞춤 위험성평가 작성 완료", "success");
}

function readPhotoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("사진을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function getImageSize(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 });
    image.onerror = () => resolve({ width: 1, height: 1 });
    image.src = dataUrl;
  });
}

function normalizePhotoToFrame(dataUrl, targetRatio) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvasWidth = 1200;
      const canvasHeight = Math.round(canvasWidth / Math.max(0.2, targetRatio || 1.6));
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);

      const imageRatio = image.naturalWidth / image.naturalHeight;
      let drawWidth = canvas.width;
      let drawHeight = canvas.height;
      if (imageRatio > targetRatio) {
        drawWidth = canvas.width;
        drawHeight = canvas.width / imageRatio;
      } else {
        drawHeight = canvas.height;
        drawWidth = canvas.height * imageRatio;
      }
      const drawX = (canvas.width - drawWidth) / 2;
      const drawY = (canvas.height - drawHeight) / 2;
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function fitPhotoLayerToFrame(imageSize) {
  const frameRatio = 1;
  const imageRatio = imageSize.width / imageSize.height;
  if (imageRatio >= frameRatio) {
    return {
      width: 100,
      height: Math.max(15, 100 / imageRatio),
      left: 0,
      top: (100 - Math.max(15, 100 / imageRatio)) / 2
    };
  }
  return {
    width: Math.max(15, imageRatio * 100),
    height: 100,
    left: (100 - Math.max(15, imageRatio * 100)) / 2,
    top: 0
  };
}

async function handleNearMissPhotoUpload(input) {
  const field = input?.dataset?.photoUpload;
  const file = input?.files?.[0];
  if (!field || !file) return;
  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 등록할 수 있습니다.");
    input.value = "";
    return;
  }
  try {
    const rawDataUrl = await readPhotoFile(file);
    const photoBody = input.closest(".photo-box-body");
    const rect = photoBody?.getBoundingClientRect();
    const targetRatio = rect?.width && rect?.height ? rect.width / rect.height : 1.6;
    const dataUrl = await normalizePhotoToFrame(rawDataUrl, targetRatio);
    if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
    nearMissFormDraft[field] = dataUrl;
    if (field === "beforePhoto") {
      nearMissFormDraft.beforePhotoScale = "1";
      nearMissFormDraft.beforePhotoX = "50";
      nearMissFormDraft.beforePhotoY = "50";
      nearMissFormDraft.beforePhotoFit = "contain";
      nearMissFormDraft.beforePhotoWidth = "100";
      nearMissFormDraft.beforePhotoHeight = "100";
      nearMissFormDraft.beforePhotoLeft = "0";
      nearMissFormDraft.beforePhotoTop = "0";
    } else {
      nearMissFormDraft.afterPhotoScale = "1";
      nearMissFormDraft.afterPhotoX = "50";
      nearMissFormDraft.afterPhotoY = "50";
      nearMissFormDraft.afterPhotoFit = "contain";
      nearMissFormDraft.afterPhotoWidth = "100";
      nearMissFormDraft.afterPhotoHeight = "100";
      nearMissFormDraft.afterPhotoLeft = "0";
      nearMissFormDraft.afterPhotoTop = "0";
    }
    saveNearMissFormDraft();
    renderNearMissForm();
  } catch (error) {
    alert(error.message || "사진 등록에 실패했습니다.");
  } finally {
    input.value = "";
  }
}

async function handleStampUpload(input) {
  const field = input?.dataset?.stampUpload;
  const file = input?.files?.[0];
  const slot = STAMP_FIELD_TO_SLOT[field];
  if (!field || !file) return;
  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 등록할 수 있습니다.");
    input.value = "";
    return;
  }
  try {
    if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
    const dataUrl = await readPhotoFile(file);
    nearMissFormDraft[field] = dataUrl;
    if (slot) {
      const department = cleanDepartment(nearMissFormDraft.department || getCurrentUserDepartment());
      if (department && department !== K.unclassified) {
        safetySettings.departmentStamps = safetySettings.departmentStamps || {};
        safetySettings.departmentStamps[department] = {
          ...(safetySettings.departmentStamps[department] || {}),
          [slot]: dataUrl
        };
        await saveSafetySettings();
        renderDepartmentStampList();
        setAiStatus(`${department} 도장을 저장했습니다.`, "success");
      }
    }
    saveNearMissFormDraft();
    renderNearMissForm();
  } catch (error) {
    alert(error.message || "도장 등록에 실패했습니다.");
  } finally {
    input.value = "";
  }
}

async function handleDepartmentStampUpload(input) {
  if (IS_DEPARTMENT_MODE) return;
  const slot = input?.dataset?.departmentStampUpload;
  const file = input?.files?.[0];
  const department = cleanDepartment($("#stampDepartmentInput")?.value || "");
  if (!slot || !file) return;
  if (!department) {
    alert("부서명을 먼저 입력하세요.");
    input.value = "";
    return;
  }
  if (!file.type.startsWith("image/")) {
    alert("이미지 파일만 등록할 수 있습니다.");
    input.value = "";
    return;
  }
  try {
    safetySettings.departmentStamps = safetySettings.departmentStamps || {};
    safetySettings.departmentStamps[department] = {
      ...(safetySettings.departmentStamps[department] || {}),
      [slot]: await readPhotoFile(file)
    };
    await saveSafetySettings();
    renderDepartmentStampList();
    if (cleanDepartment(nearMissFormDraft?.department) === department) {
      applyDepartmentStampToDraft({ force: true });
      saveNearMissFormDraft();
      renderNearMissForm();
    }
    setAiStatus(`${department} 도장 저장 완료`, "success");
  } catch (error) {
    alert(error.message || "부서 도장 저장에 실패했습니다.");
  } finally {
    input.value = "";
  }
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function startPhotoDrag(event) {
  const layer = event.target.closest(".photo-layer");
  if (event.target.closest("[data-photo-layer-resize]")) return;
  if (!layer) return;
  const frame = layer.closest(".photo-upload-field");
  const prefix = layer.dataset.photoLayer;
  if (!frame || !prefix) return;
  event.preventDefault();
  const startX = event.clientX;
  const startY = event.clientY;
  const initialLeft = Number(nearMissFormDraft?.[`${prefix}Left`] || 0);
  const initialTop = Number(nearMissFormDraft?.[`${prefix}Top`] || 0);
  const rect = frame.getBoundingClientRect();
  const onMove = (moveEvent) => {
    const nextLeft = initialLeft + ((moveEvent.clientX - startX) / rect.width) * 100;
    const nextTop = initialTop + ((moveEvent.clientY - startY) / rect.height) * 100;
    layer.style.left = `${nextLeft}%`;
    layer.style.top = `${nextTop}%`;
    if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
    nearMissFormDraft[`${prefix}Left`] = nextLeft.toFixed(1);
    nearMissFormDraft[`${prefix}Top`] = nextTop.toFixed(1);
  };
  const onUp = () => {
    saveNearMissFormDraft();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function startPhotoResize(event) {
  const handle = event.target.closest("[data-photo-layer-resize]");
  if (!handle) return;
  const layer = handle.closest(".photo-layer");
  const frame = handle.closest(".photo-upload-field");
  const prefix = handle.dataset.photoLayerResize;
  if (!layer || !frame || !prefix) return;
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startY = event.clientY;
  const rect = frame.getBoundingClientRect();
  const dir = handle.dataset.resizeDir || "se";
  const initial = {
    left: Number(nearMissFormDraft?.[`${prefix}Left`] || 0),
    top: Number(nearMissFormDraft?.[`${prefix}Top`] || 0),
    width: Number(nearMissFormDraft?.[`${prefix}Width`] || 100),
    height: Number(nearMissFormDraft?.[`${prefix}Height`] || 100)
  };
  const onMove = (moveEvent) => {
    const dx = ((moveEvent.clientX - startX) / rect.width) * 100;
    const dy = ((moveEvent.clientY - startY) / rect.height) * 100;
    let left = initial.left;
    let top = initial.top;
    let width = initial.width;
    let height = initial.height;
    if (dir.includes("e")) width = initial.width + dx;
    if (dir.includes("s")) height = initial.height + dy;
    if (dir.includes("w")) {
      left = initial.left + dx;
      width = initial.width - dx;
    }
    if (dir.includes("n")) {
      top = initial.top + dy;
      height = initial.height - dy;
    }
    width = Math.max(15, Math.min(250, width));
    height = Math.max(15, Math.min(250, height));
    layer.style.left = `${left}%`;
    layer.style.top = `${top}%`;
    layer.style.width = `${width}%`;
    layer.style.height = `${height}%`;
    if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
    nearMissFormDraft[`${prefix}Left`] = left.toFixed(1);
    nearMissFormDraft[`${prefix}Top`] = top.toFixed(1);
    nearMissFormDraft[`${prefix}Width`] = width.toFixed(1);
    nearMissFormDraft[`${prefix}Height`] = height.toFixed(1);
  };
  const onUp = () => {
    saveNearMissFormDraft();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function setAiStatus(message, type = "") {
  const el = $("#aiStatus");
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("error", type === "error");
  el.classList.toggle("success", type === "success");
}

function showAppToast(title, message = "", type = "success") {
  let toast = $("#appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  clearTimeout(appToastTimer);
  toast.className = `app-toast ${type || "success"} show`;
  toast.innerHTML = `
    <span class="app-toast-icon">${type === "error" ? "!" : "✓"}</span>
    <span class="app-toast-copy">
      <strong>${escapeHtml(title)}</strong>
      ${message ? `<em>${escapeHtml(message)}</em>` : ""}
    </span>
  `;
  appToastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, type === "error" ? 4200 : 2600);
}

function badge(text, extra = "") {
  return `<span class="badge ${extra || text}">${escapeHtml(text)}</span>`;
}

function clampRiskValue(value) {
  return Math.max(1, Math.min(5, Number(value) || 1));
}

function getRecordYear(record) {
  const match = safeText(record.date).match(/(19|20)\d{2}/);
  return match ? match[0] : "";
}

function normalizeRecordYear(value) {
  const match = safeText(value).match(/(19|20)\d{2}/);
  return match ? match[0] : "";
}

function normalizeRecordMonth(value) {
  const month = Number(safeText(value).match(/\d{1,2}/)?.[0] || 0);
  return month >= 1 && month <= 12 ? `${month}월` : "";
}

function getCurrentReportMonth() {
  return `${new Date().getMonth() + 1}월`;
}

function getCurrentReportYear() {
  return String(new Date().getFullYear());
}

function getRecordMonth(record) {
  const match = safeText(record.date).match(/(?:19|20)\d{2}[-./\uB144\s]*(\d{1,2})/);
  if (!match) return "";
  const month = Number(match[1]);
  return month >= 1 && month <= 12 ? `${month}\uC6D4` : "";
}

function getRecordReportMonth(record) {
  return normalizeRecordMonth(record.reportMonth) || getRecordMonth(record);
}

function getRecordReportYear(record) {
  return normalizeRecordYear(record.reportYear) || normalizeRecordYear(record.updatedAt) || getRecordYear(record);
}

function ensureUniqueRecordIds(items) {
  const yearCounters = new Map();
  items.forEach((item) => {
    const kind = item.kind === "incident" ? "incident" : "nearMiss";
    const prefix = kind === "incident" ? "IC" : "NM";
    const year = getRecordYear(item) || String(new Date().getFullYear());
    const match = safeText(item.id).match(new RegExp(`^${prefix}-${year}-(\\d+)$`));
    if (!match) return;
    const key = `${prefix}-${year}`;
    yearCounters.set(key, Math.max(yearCounters.get(key) || 0, Number(match[1]) || 0));
  });

  const seen = new Set();
  return items.map((item) => {
    const kind = item.kind === "incident" ? "incident" : "nearMiss";
    const prefix = kind === "incident" ? "IC" : "NM";
    const year = getRecordYear(item) || String(new Date().getFullYear());
    const currentId = safeText(item.id).trim();
    if (currentId && !seen.has(currentId)) {
      seen.add(currentId);
      return item;
    }
    const key = `${prefix}-${year}`;
    const next = (yearCounters.get(key) || 0) + 1;
    yearCounters.set(key, next);
    const id = `${prefix}-${year}-${String(next).padStart(3, "0")}`;
    seen.add(id);
    return { ...item, id };
  });
}

function includesAny(text, list) {
  return list.some((item) => text.includes(item));
}

function cleanDepartment(value) {
  const cleaned = safeText(value)
    .trim()
    .replace(/^[a-zA-Z]\s+/, "")
    .replace(/^[a-zA-Z][.)-]\s*/, "");
  if (!cleaned) return K.unclassified;
  const compact = cleaned.replace(/\s/g, "").toUpperCase();
  const rules = [
    [/^\uBB3C\uB958\uAD00\uB9AC(\uD300)?$/, "\uBB3C\uB958\uAD00\uB9AC\uD300"],
    [/^\uC0DD\uC0B01(\uBD80|\uD300)?$/, "\uC0DD\uC0B01\uBD80"],
    [/^\uC0DD\uC0B02(\uBD80|\uD300)?$/, "\uC0DD\uC0B02\uBD80"],
    [/^\uD488\uC9C8\uAD00\uB9AC(\uBD80|\uD300)?$/, "\uD488\uC9C8\uAD00\uB9AC\uBD80"],
    [/^\uD658\uACBD\uAD00\uB9AC(\uD300|\uBD80|\uACFC)?$/, "\uD658\uACBD\uAD00\uB9AC\uD300"],
    [/^\uACF5\uBB34(\uD300|\uBD80|\uACFC)?$/, "\uACF5\uBB34\uD300"],
    [/^\uCD1D\uBB34(\uD300|\uBD80|\uACFC)?$/, "\uCD1D\uBB34\uACFC"],
    [/^\uC5F0\uAD6C\uAC1C\uBC1C(\uD300|\uBD80)?$/, "\uC5F0\uAD6C\uAC1C\uBC1C\uD300"],
    [/^ESQ(\uD300|\uBD80|\uBCF8\uBD80)?$/i, "ESQ"],
    [/^T\/?S(\uD300)?$/i, "T/S\uD300"],
    [/^SEM$/i, "SEM"]
  ];
  for (const [pattern, label] of rules) {
    if (pattern.test(cleaned) || pattern.test(compact)) return label;
  }
  return cleaned;
}

function normalizeAccidentType(value) {
  const text = safeText(value).trim();
  const compact = text.replace(/\s/g, "").replace(/[\u00B7\u318D./,_-]/g, "");
  if (!compact) return "";
  if (compact.includes("\uAE30\uD0C0")) return "\uAE30\uD0C0";
  if (compact.includes("\uAE54\uB9BC")) return TYPES[0];
  if (compact.includes("\uB07C\uC784") || compact.includes("\uB084")) return TYPES[1];
  if (compact.includes("\uB118\uC5B4")) return TYPES[2];
  if (compact.includes("\uB204\uC804") || compact.includes("\uAC10\uC804")) return TYPES[3];
  if (compact.includes("\uB5A8\uC5B4")) return TYPES[4];
  if (compact.includes("\uB9DE") || compact.includes("\uB0D9\uD558\uBB3C") || compact.includes("\uBE44\uB798")) return TYPES[5];
  if (compact.includes("\uBCA0\uC784") || compact.includes("\uC808\uB2E8")) return TYPES[6];
  if (compact.includes("\uCC14") || compact.includes("\uC790\uC0C1")) return TYPES[7];
  if (compact.includes("\uBD80\uB52A") || compact.includes("\uCDA9\uB3CC")) return TYPES[8];
  if (compact.includes("\uBD88\uADE0\uD615") || compact.includes("\uBB34\uB9AC\uD55C")) return TYPES[9];
  if (compact.includes("\uC774\uC0C1\uC628\uB3C4") || compact.includes("\uACE0\uC628") || compact.includes("\uC800\uC628")) return TYPES[10];
  if (compact.includes("\uD654\uD559\uBB3C\uC9C8\uB204\uCD9C") || compact.includes("\uB204\uCD9C")) return TYPES[11];
  if (compact.includes("\uD654\uD559\uBB3C\uC9C8\uC811\uCD09") || compact.includes("\uC57D\uD488") || compact.includes("\uD654\uC0C1")) return TYPES[12];
  if (compact.includes("\uD654\uC7AC") || compact.includes("\uD3ED\uBC1C")) return TYPES[13];
  return "\uAE30\uD0C0";
}

function resolveAccidentType(recordLike) {
  const direct = normalizeAccidentType(recordLike?.type);
  if (direct) return direct;

  const context = [
    recordLike?.description,
    recordLike?.cause,
    recordLike?.action,
    recordLike?.location,
    recordLike?.process,
    recordLike?.victim
  ].map(safeText).join(" ");

  const inferred = normalizeAccidentType(context);
  if (inferred) return inferred;
  return "\uAE30\uD0C0";
}
function getCompany(record) {
  const saved = safeText(record.company).trim();
  const department = cleanDepartment(record.department);
  if (department === "SEM") return K.sem;
  const savedUpper = saved.toUpperCase();
  if (saved && (savedUpper.includes("SEM") || saved.includes("\uC5D0\uC2A4\uC774\uC5E0"))) return K.sem;
  if (saved && (saved.includes("\uC624\uC601") || savedUpper.includes("OYOUNG"))) return K.oyoung;
  return K.oyoung;
}

function companyKey(record) {
  return getCompany(record) === K.sem ? "sem" : "oyoung";
}

function normalizeStatus(value) {
  const text = safeText(value).trim();
  if ([K.received, K.inProgress, K.review, K.done].includes(text)) return text;
  return K.received;
}

function resolveRecordKind(record) {
  const rawKind = record.kind === "incident" ? "incident" : "nearMiss";
  const context = [record.claimType, record.description, record.cause, record.action, record.victim, record.location, record.process].map(safeText).join(" ");
  if (context.includes("????") || context.includes("?????") || context.includes("??-???") || context.toLowerCase().includes("near miss")) return "nearMiss";
  if (context.includes("?????????") || context.includes("?????") || context.includes("??") || Number(record.lostDays || 0) >= 1) return "incident";
  return rawKind;
}

function normalizeRecord(record) {
  const owner = sanitizeImportedAuthor(record.owner);
  const author = sanitizeImportedAuthor(record.author);
  const kind = resolveRecordKind(record);
  const normalized = {
    id: safeText(record.id).trim(),
    kind,
    company: getCompany(record),
    date: cleanDate(record.date || today()),
    department: cleanDepartment(record.department),
    author,
    location: safeText(record.location).trim(),
    process: safeText(record.process).trim(),
    type: resolveAccidentType(record),
    cause: safeText(record.cause).trim(),
    victim: safeText(record.victim).trim(),
    claimType: safeText(record.claimType).trim(),
    lostDays: Number(record.lostDays || 0),
    likelihood: clampRiskValue(record.likelihood || 3),
    severity: clampRiskValue(record.severity || 3),
    status: normalizeStatus(record.status),
    dueDate: safeText(record.dueDate).trim(),
    owner,
    summary: safeText(record.summary).trim(),
    description: safeText(record.description).trim(),
    action: safeText(record.action).trim(),
    completedDate: safeText(record.completedDate).trim(),
    reportYear: normalizeRecordYear(record.reportYear) || normalizeRecordYear(record.updatedAt) || getRecordYear(record) || getCurrentReportYear(),
    reportMonth: normalizeRecordMonth(record.reportMonth),
    updatedAt: record.updatedAt || new Date().toISOString()
  };
  if (!normalized.id) normalized.id = nextId(normalized.kind);
  return normalized;
}
function assessRisk(record) {
  let likelihood = clampRiskValue(record.likelihood || 3);
  let severity = clampRiskValue(record.severity || 3);
  const type = normalizeAccidentType(record.type);
  const compact = [
    type,
    record.description,
    record.location,
    record.process,
    record.cause,
    record.action
  ].join(" ").replace(/\s/g, "");

  if (record.kind === "incident") likelihood = Math.max(likelihood, 3);
  if (includesAny(compact, ["\uC0C1\uC2DC", "\uBC18\uBCF5", "\uB9E4\uC77C", "\uC218\uC2DC", "\uD1B5\uB85C", "\uCD9C\uC785\uAD6C", "\uC6B4\uBC18", "\uC774\uB3D9", "\uC9C0\uAC8C\uCC28", "\uC218\uB3D9", "\uC801\uC7AC", "\uD558\uC5ED"])) {
    likelihood = Math.max(likelihood, 4);
  }
  if (includesAny(compact, ["\uBBF8\uC900\uC218", "\uBD88\uC548\uC804", "\uAD00\uB9AC\uBD88\uB7C9", "\uC791\uC5C5\uD658\uACBD", "\uAD50\uC721", "\uAC10\uB3C5", "\uBCF4\uD638\uAD6C\uBBF8\uCC29\uC6A9", "\uD45C\uC900\uC5C6", "\uC808\uCC28\uC5C6"])) {
    likelihood = Math.max(likelihood, 4);
  }

  const typeSeverity = {
    [TYPES[0]]: 4,
    [TYPES[1]]: 4,
    [TYPES[2]]: 3,
    [TYPES[3]]: 4,
    [TYPES[4]]: 4,
    [TYPES[5]]: 3,
    [TYPES[6]]: 3,
    [TYPES[7]]: 3,
    [TYPES[8]]: 3,
    [TYPES[9]]: 3,
    [TYPES[10]]: 3,
    [TYPES[11]]: 4,
    [TYPES[12]]: 3,
    [TYPES[13]]: 4
  };
  severity = Math.max(severity, typeSeverity[type] || 3);

  if (includesAny(compact, ["\uC0AC\uB9DD", "\uD3ED\uBC1C", "\uAC10\uC804", "\uCD94\uB77D", "\uD611\uCC29", "\uB07C\uC784", "\uAE54\uB9BC", "\uC911\uB7C9\uBB3C", "1\uD1A4", "\uC9C0\uAC8C\uCC28", "\uACE0\uC18C", "\uBC00\uD3D0", "\uD654\uD559\uBB3C\uC9C8\uB204\uCD9C"])) {
    severity = Math.max(severity, 5);
  } else if (includesAny(compact, ["\uD654\uD559", "\uC57D\uD488", "\uACE0\uC628", "\uD654\uC0C1", "\uC808\uB2E8", "\uCC14\uB9BC", "\uBCA0\uC784", "\uACE8\uC808", "\uB204\uCD9C"])) {
    severity = Math.max(severity, 4);
  }

  if (Number(record.lostDays || 0) >= 3 || safeText(record.claimType).includes("\uC0B0\uC7AC")) {
    severity = Math.max(severity, 4);
  }

  return { likelihood: clampRiskValue(likelihood), severity: clampRiskValue(severity) };
}

function getRiskScore(record) {
  const assessed = assessRisk(record);
  return assessed.likelihood * assessed.severity;
}

function getRiskLevel(record) {
  const score = getRiskScore(record);
  if (score >= 20) return K.critical;
  if (score >= 12) return K.high;
  if (score >= 6) return K.medium;
  return K.low;
}

function getRiskAssessmentRecommendationReason(record, monthRows = []) {
  const type = normalizeAccidentType(record.type) || record.type || "기타";
  const text = [
    type,
    record.description,
    record.location,
    record.process,
    record.cause,
    record.action
  ].map(safeText).join(" ");
  const compact = text.replace(/\s/g, "");
  const reasons = [];
  const score = getRiskScore(record);
  const highType = ["끼임", "깔림", "떨어짐", "누전", "화학물질 누출", "화재 폭발"].includes(type);
  const severeKeywords = [
    "감전", "누전", "추락", "끼임", "협착", "깔림", "중량물", "지게차", "고소",
    "화학물질", "누출", "폭발", "화재", "화상", "절단", "개구부", "밀폐", "탱크"
  ];
  const repeatTypeCount = monthRows.filter((row) => normalizeAccidentType(row.type) === type).length;
  const repeatDepartmentCount = monthRows.filter((row) => cleanDepartment(row.department) === cleanDepartment(record.department)).length;

  if (score >= 16) reasons.push(`위험점수 ${score}점`);
  else if (score >= 12) reasons.push(`위험도 ${getRiskLevel(record)}`);
  if (highType) reasons.push(`${type} 유형은 중대재해로 이어질 가능성이 큼`);
  if (severeKeywords.some((keyword) => compact.includes(keyword))) reasons.push("중대 위험 키워드 포함");
  if (repeatTypeCount >= 2) reasons.push(`동일 유형 ${repeatTypeCount}건 반복`);
  if (repeatDepartmentCount >= 2) reasons.push(`${cleanDepartment(record.department)} ${repeatDepartmentCount}건 집중`);
  if (!safeText(record.action).trim()) reasons.push("감소대책 미작성");

  return reasons.slice(0, 3);
}

function getRiskAssessmentRecommendationScore(record, monthRows = []) {
  const type = normalizeAccidentType(record.type) || record.type || "";
  const baseScore = getRiskScore(record);
  const reasons = getRiskAssessmentRecommendationReason(record, monthRows);
  let bonus = reasons.length * 3;
  if (["끼임", "깔림", "떨어짐", "누전", "화학물질 누출", "화재 폭발"].includes(type)) bonus += 6;
  if (!safeText(record.action).trim()) bonus += 4;
  if (record.kind === "incident") bonus += 6;
  return baseScore + bonus;
}

function getMonthlyRiskAssessmentPicks(sourceRows, limit = 2, monthOverride = "", yearOverride = "", allowFallback = true) {
  const month = normalizeRecordMonth(monthOverride) || getCurrentReportMonth();
  const year = normalizeRecordYear(yearOverride) || getCurrentReportYear();
  const reportableRows = sourceRows.filter((row) => row.kind === "nearMiss" || row.kind === "incident");
  const monthRows = reportableRows.filter((row) => getRecordReportYear(row) === year && getRecordReportMonth(row) === month);
  const targetRows = monthRows.length || !allowFallback ? monthRows : reportableRows;
  const candidates = targetRows
    .filter((row) => safeText(row.description || row.action).trim())
    .map((row) => ({
      row,
      score: getRiskAssessmentRecommendationScore(row, monthRows),
      reasons: getRiskAssessmentRecommendationReason(row, monthRows)
    }))
    .sort((a, b) => b.score - a.score || getRiskScore(b.row) - getRiskScore(a.row));
  return {
    year,
    month,
    sourceCount: monthRows.length,
    items: candidates.slice(0, limit)
  };
}

function riskPickFilteredRows() {
  const query = safeText($("#searchInput")?.value).trim().toLowerCase();
  const department = safeText($("#departmentFilter")?.value || "all");
  const year = safeText($("#yearFilter")?.value || "all");
  const risk = safeText($("#riskFilter")?.value || "all");

  return records.filter((record) => {
    const haystack = [
      record.id,
      cleanDepartment(record.department),
      record.author,
      record.location,
      record.process,
      record.type,
      record.description,
      record.action,
      record.owner,
      record.victim
    ].join(" ").toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (department !== "all" && cleanDepartment(record.department) !== department) return false;
    if (year !== "all" && getRecordYear(record) !== year) return false;
    if (risk !== "all" && getRiskLevel(record) !== risk) return false;
    return true;
  });
}

function getDefaultRiskPickPeriod(sourceRows) {
  const currentYear = getCurrentReportYear();
  const currentMonth = getCurrentReportMonth();
  if (sourceRows.some((row) => getRecordReportYear(row) === currentYear && getRecordReportMonth(row) === currentMonth)) {
    return { year: currentYear, month: currentMonth };
  }
  const periods = sourceRows
    .map((row) => ({ year: getRecordReportYear(row), month: getRecordReportMonth(row) }))
    .filter((period) => period.year && period.month)
    .sort((a, b) => Number(b.year) - Number(a.year) || Number(b.month.replace(/\D/g, "")) - Number(a.month.replace(/\D/g, "")));
  return periods[0] || { year: currentYear, month: currentMonth };
}

function getRiskPickYearOptions(sourceRows) {
  return Array.from(new Set(sourceRows.map(getRecordReportYear).filter(Boolean)))
    .sort((a, b) => Number(b) - Number(a));
}

function getRiskPickMonthOptions(sourceRows, year = "") {
  const targetYear = normalizeRecordYear(year);
  const filteredRows = targetYear ? sourceRows.filter((row) => getRecordReportYear(row) === targetYear) : sourceRows;
  return Array.from(new Set(filteredRows.map(getRecordReportMonth).filter(Boolean)))
    .sort((a, b) => Number(b.replace(/\D/g, "")) - Number(a.replace(/\D/g, "")));
}

function isLate(record) {
  if (!record.dueDate || record.status === K.done) return false;
  return record.dueDate < today();
}

function displayStatus(record) {
  return isLate(record) ? K.delayed : record.status;
}

function isReportable(record) {
  return record.kind === "incident" && Number(record.lostDays || 0) >= 3;
}

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(parsed)) {
      records = ensureUniqueRecordIds(parsed.map(normalizeRecord));
      loadedLocalRecordCount = records.length;
    }
  } catch {
    records = [];
  }
}

async function loadRecordsFromServer() {
  try {
    const response = await fetch("/api/safety-data", { cache: "no-store" });
    if (!response.ok) return false;
    const payload = await response.json();
    if (!Array.isArray(payload.records)) return false;
    records = ensureUniqueRecordIds(payload.records.map(normalizeRecord));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    renderAll();
    return true;
  } catch (error) {
    console.warn("safety server load failed:", error);
    return false;
  }
}

async function saveRecordsToServer() {
  if (IS_DEPARTMENT_MODE) {
    setAiStatus("부서용은 관리 데이터 저장이 제한됩니다.", "error");
    return false;
  }
  try {
    const response = await fetch("/api/safety-data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.message || `HTTP ${response.status}`);
    if (Number(payload.records) !== records.length) {
      throw new Error(`저장 건수 불일치: 서버 ${payload.records ?? "?"}건 / 화면 ${records.length}건`);
    }
    console.info("safety server save ok:", {
      records: payload.records,
      previousRecords: payload.previousRecords,
      updatedAt: payload.updatedAt,
      dataDir: payload.dataDir,
      safetyDataPath: payload.safetyDataPath
    });
    setAiStatus("\uC800\uC7A5 \uC644\uB8CC", "success");
    return true;
  } catch (error) {
    console.warn("safety server save failed:", error);
    setAiStatus(`서버 저장 실패: ${error.message || "원인 확인 필요"}`, "error");
    return false;
  }
}

function saveRecords(options = {}) {
  if (IS_DEPARTMENT_MODE) {
    setAiStatus("부서용은 관리 데이터 수정이 제한됩니다.", "error");
    return Promise.resolve(false);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.warn("local safety save failed:", error);
    setAiStatus("브라우저 저장 실패: 서버 저장을 시도합니다.", "warning");
  }
  if (options.skipServer) return Promise.resolve(true);
  return saveRecordsToServer();
}

function flushRecordsBeforeUnload() {
  if (IS_DEPARTMENT_MODE) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/safety-data", new Blob([JSON.stringify({ records })], { type: "application/json" }));
    }
  } catch {
    // ignore
  }
}

function loadSidebarState() {
  const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
  sidebarCollapsed = saved == null ? true : saved === "true";
  applySidebarState();
}

async function getDesktopGeminiApiKey() {
  try {
    return safeText(await window.desktopApp?.getGeminiApiKey?.()).trim();
  } catch (error) {
    console.warn("desktop gemini key load failed:", error);
    return "";
  }
}

async function hasServerGeminiConfig() {
  if (window.desktopApp?.isElectron) return false;
  try {
    const response = await fetch("/api/safety-gemini/status", { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    return Boolean(response.ok && payload.configured);
  } catch (error) {
    console.warn("server gemini status failed:", error);
    return false;
  }
}

async function syncGeminiApiKeyUi() {
  const input = $("#apiKey");
  if (!input) return;

  input.disabled = false;
  input.placeholder = "AIzaSy...";

  const desktopKey = await getDesktopGeminiApiKey();
  if (desktopKey) {
    input.value = "";
    input.disabled = true;
    input.placeholder = "로컬 설정 사용 중";
    return;
  }

  if (await hasServerGeminiConfig()) {
    input.value = "";
    input.disabled = true;
    input.placeholder = "서버 설정 사용 중";
  }
}

function applySidebarState() {
  document.body.classList.toggle("sidebar-collapsed", sidebarCollapsed);
  const button = $("#sidebarToggleBtn");
  if (!button) return;
  button.setAttribute("aria-expanded", String(!sidebarCollapsed));
  button.title = sidebarCollapsed ? K.openMenu : K.hideMenu;
}

function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  applySidebarState();
}

function loadActiveView() {
  const saved = localStorage.getItem(ACTIVE_VIEW_KEY);
  activeView = VALID_VIEWS.includes(saved) ? saved : "dashboard";
}

function switchView(viewName, options = {}) {
  const nextView = VALID_VIEWS.includes(viewName) ? viewName : "dashboard";
  if (nextView === "nearMissForm" && !IS_DEPARTMENT_MODE && !options.keepSubmissionSelection) {
    activeFormSubmissionId = "";
  }
  activeView = nextView;
  if (!options.skipSave) localStorage.setItem(ACTIVE_VIEW_KEY, nextView);
  $$(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === nextView);
  });
  $$(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `${nextView}View`);
  });
  placeFiltersForView();
  syncSubmissionReviewVisibility();
}

function placeFiltersForView() {
  const filters = $(".filters");
  const incidentSlot = $("#incidentView .filter-slot");
  const nearMissWrap = $("#nearMissView .table-wrap");
  if (!filters || !incidentSlot || !nearMissWrap) return;
  if (activeView === "incident") {
    incidentSlot.replaceChildren(filters);
  } else if (filters.parentElement !== $("#nearMissView")) {
    nearMissWrap.before(filters);
  }
}

function riskLinkBadge(record) {
  return `<button class="badge risk-link ${getRiskLevel(record)}" type="button" data-risk-target="${escapeHtml(record.id)}">${escapeHtml(getRiskLevel(record))}</button>`;
}

function openRiskAssessment(recordId) {
  switchView("risk");
  renderRisk();
  requestAnimationFrame(() => {
    const row = $(`[data-risk-row="${CSS.escape(recordId)}"]`);
    if (!row) return;
    $$(".risk-row-highlight").forEach((item) => item.classList.remove("risk-row-highlight"));
    row.classList.add("risk-row-highlight");
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function filteredRecords() {
  const query = safeText($("#searchInput")?.value).trim().toLowerCase();
  const department = safeText($("#departmentFilter")?.value || "all");
  const year = safeText($("#yearFilter")?.value || "all");
  const month = safeText($("#monthFilter")?.value || "all");
  const risk = safeText($("#riskFilter")?.value || "all");

  return records.filter((record) => {
    const haystack = [
      record.id,
      cleanDepartment(record.department),
      record.author,
      record.location,
      record.process,
      record.type,
      record.description,
      record.action,
      record.owner,
      record.victim
    ].join(" ").toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (department !== "all" && cleanDepartment(record.department) !== department) return false;
    if (year !== "all" && getRecordYear(record) !== year) return false;
    if (month !== "all" && getRecordMonth(record) !== month) return false;
    if (risk !== "all" && getRiskLevel(record) !== risk) return false;
    return true;
  });
}

function countBy(items, getter) {
  return items.reduce((map, item) => {
    const key = getter(item) || K.unclassified;
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());
}

function countFixedAccidentTypes(items) {
  return items.reduce((map, row) => {
    const type = normalizeAccidentType(row.type);
    if (type && TYPES.includes(type)) map.set(type, (map.get(type) || 0) + 1);
    return map;
  }, new Map(TYPES.map((type) => [type, 0])));
}

function buildDonutChart(items, options = {}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const colors = options.colors || ["#184e9e", "#0f766e", "#b7791f", "#7c3aed", "#c2410c", "#9bb9df", "#5f6f82"];
  if (!total) return `<div class="donut-empty">${K.noData}</div>`;
  let cursor = 0;
  const segments = items.map((item, index) => {
    const portion = item.value / total;
    const percent = portion * 100;
    const offset = cursor * 100;
    cursor += portion;
    const label = safeText(item.label || K.noData);
    const count = Number(item.value || 0);
    const percentText = `${percent.toFixed(percent >= 10 ? 1 : 2)}%`;
    return `
      <circle
        class="donut-segment"
        cx="60"
        cy="60"
        r="44"
        pathLength="100"
        fill="none"
        stroke="${colors[index % colors.length]}"
        stroke-width="22"
        stroke-dasharray="${percent} ${100 - percent}"
        stroke-dashoffset="${-offset}"
        transform="rotate(-90 60 60)"
        data-tooltip="${escapeHtml(`${label}: ${count}건 (${percentText})`)}"
      >
        <title>${escapeHtml(label)}: ${count}건 (${percentText})</title>
      </circle>
    `;
  }).join("");
  const variantClass = options.variant === "mini" ? "is-mini" : "is-main";
  const wrapperClass = options.className ? ` ${options.className}` : "";
  return `
    <div class="donut-figure ${variantClass}${wrapperClass}">
      <div class="donut-ring">
        <svg class="donut-svg" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(options.label || K.all)} 구성비">
          ${segments}
        </svg>
      </div>
      <div class="donut-center">
        <span>${escapeHtml(options.label || K.all)}</span>
        <strong data-count-up="${total}">${total}</strong>
      </div>
    </div>
  `;
}

function animateCountUp(element, target) {
  if (!element || element.dataset.countAnimated === "true") return;
  const end = Number(target);
  if (!Number.isFinite(end)) return;
  element.dataset.countAnimated = "true";
  if (end <= 0) {
    element.textContent = "0";
    return;
  }
  const duration = Math.min(900, Math.max(420, end * 3));
  const startTime = performance.now();
  const formatter = new Intl.NumberFormat("ko-KR");
  const step = (now) => {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatter.format(Math.round(end * eased));
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function animateDashboardNumbers() {
  $$("#dashboardView [data-count-up]").forEach((element) => {
    animateCountUp(element, element.dataset.countUp);
  });
}

function getDashboardTooltip() {
  let tooltip = $("#dashboardTooltip");
  if (tooltip) return tooltip;
  tooltip = document.createElement("div");
  tooltip.id = "dashboardTooltip";
  tooltip.className = "dashboard-tooltip";
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  return tooltip;
}

function showDashboardTooltip(text, event) {
  const tooltip = getDashboardTooltip();
  tooltip.textContent = text;
  tooltip.hidden = false;
  moveDashboardTooltip(event);
}

function moveDashboardTooltip(event) {
  const tooltip = $("#dashboardTooltip");
  if (!tooltip || tooltip.hidden) return;
  const offset = 14;
  const rect = tooltip.getBoundingClientRect();
  let left = event.clientX + offset;
  let top = event.clientY + offset;
  if (left + rect.width > window.innerWidth - 8) left = event.clientX - rect.width - offset;
  if (top + rect.height > window.innerHeight - 8) top = event.clientY - rect.height - offset;
  tooltip.style.left = `${Math.max(8, left)}px`;
  tooltip.style.top = `${Math.max(8, top)}px`;
}

function hideDashboardTooltip() {
  const tooltip = $("#dashboardTooltip");
  if (tooltip) tooltip.hidden = true;
}

function renderBars(container, map) {
  if (!container) return;
  const rows = Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
  const max = Math.max(1, ...rows.map(([, value]) => value));
  container.innerHTML = rows.length ? rows.map(([label, value]) => `
    <div class="bar-row">
      <div class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((value / max) * 100)}%"></div></div>
      <strong>${value}</strong>
    </div>
  `).join("") : `<p class="work-meta">${K.noData}</p>`;
}

function getDashboardRows(items, year = dashboardTrendYear, company = dashboardCompanyFilter) {
  return items.filter((row) => {
    const matchesYear = year === "all" ? DASHBOARD_YEARS.includes(getRecordYear(row)) : getRecordYear(row) === year;
    const matchesCompany = company === "all" || companyKey(row) === company;
    return matchesYear && matchesCompany;
  });
}

function renderTypeTrendLine(container, items, year = dashboardTrendYear, company = dashboardCompanyFilter) {
  if (!container) return;
  const yearRows = getDashboardRows(items, year, company).filter((row) => row.type);
  const summaryLabel = year === "all" ? "2016~2026" : `${year}`;
  const companyLabel = company === "all" ? K.all : company === "sem" ? K.sem : K.oyoung;
  const summary = $("#typeTrendSummary");
  if (summary) summary.textContent = `${summaryLabel} 쨌 ${companyLabel} ${yearRows.length}`;

  if (!yearRows.length) {
    container.innerHTML = `<div class="donut-empty">${K.noData}</div>`;
    $("#typeTrendLegend").innerHTML = "";
    $("#riskDonut").innerHTML = `<div class="donut-empty">${K.noData}</div>`;
    $("#companyDonut").innerHTML = `<div class="donut-empty">${K.noData}</div>`;
    $("#departmentDonut").innerHTML = `<div class="donut-empty">${K.noData}</div>`;
    $("#actionDonut").innerHTML = `<div class="donut-empty">${K.noData}</div>`;
    $("#riskDonutList").innerHTML = "";
    $("#companyDonutList").innerHTML = "";
    $("#departmentDonutList").innerHTML = "";
    $("#actionDonutList").innerHTML = "";
    return;
  }

  const topTypeItems = Array.from(countFixedAccidentTypes(yearRows).entries())
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  const featuredTypeItems = topTypeItems.slice(0, 6);
  const otherValue = topTypeItems.slice(6).reduce((sum, item) => sum + item.value, 0);
  const displayedTypeItems = otherValue > 0
    ? [...featuredTypeItems, { label: "\uAE30\uD0C0", value: otherValue }]
    : featuredTypeItems;

  container.innerHTML = buildDonutChart(displayedTypeItems, {
    label: `${companyLabel} ${year === "all" ? K.all : `${year}\uB144`}`
  });
  $("#typeTrendLegend").innerHTML = displayedTypeItems.map((item, index) => `
    <div class="legend-row">
      <i class="legend-dot legend-${index + 1}"></i>
      <span class="legend-label">${escapeHtml(item.label)}</span>
      <strong class="legend-value" data-count-up="${item.value}">${item.value}</strong>
    </div>
  `).join("");

  const riskCounts = [K.critical, K.high, K.medium, K.low].map((label) => ({
    label,
    value: yearRows.filter((row) => getRiskLevel(row) === label).length
  }));
  $("#riskDonut").innerHTML = buildDonutChart(riskCounts.filter((item) => item.value > 0), { label: K.riskLevel, className: "risk", variant: "mini" });
  $("#riskDonutList").innerHTML = riskCounts.map((item) => `<div class="mini-list-row"><span>${item.label}</span><strong data-count-up="${item.value}">${item.value}</strong></div>`).join("");

  const companyCounts = [K.oyoung, K.sem].map((label) => ({
    label,
    value: yearRows.filter((row) => getCompany(row) === label).length
  }));
  $("#companyDonut").innerHTML = buildDonutChart(companyCounts.filter((item) => item.value > 0), { label: K.company, className: "company", variant: "mini" });
  $("#companyDonutList").innerHTML = companyCounts.map((item) => `<div class="mini-list-row"><span>${item.label}</span><strong data-count-up="${item.value}">${item.value}</strong></div>`).join("");

  const departmentItems = Array.from(countBy(yearRows, (row) => cleanDepartment(row.department)).entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([label, value]) => ({ label, value }));
  $("#departmentDonut").innerHTML = buildDonutChart(departmentItems, { label: K.department, className: "department", variant: "mini" });
  $("#departmentDonutList").innerHTML = departmentItems.map((item) => `<div class="mini-list-row"><span>${escapeHtml(item.label)}</span><strong data-count-up="${item.value}">${item.value}</strong></div>`).join("");

  const actionItems = [
    { label: K.reflected, value: yearRows.filter((row) => row.action).length },
    { label: K.notReflected, value: yearRows.filter((row) => !row.action).length }
  ];
  $("#actionDonut").innerHTML = buildDonutChart(actionItems.filter((item) => item.value > 0), { label: K.action, className: "action", variant: "mini" });
  $("#actionDonutList").innerHTML = actionItems.map((item) => `<div class="mini-list-row"><span>${item.label}</span><strong data-count-up="${item.value}">${item.value}</strong></div>`).join("");
  animateDashboardNumbers();
}

function renderDashboard() {
  dashboardTrendYear = "all";
  dashboardCompanyFilter = "all";
  renderDashboardSubmissions();
  renderTypeTrendLine($("#typeTrendChart"), records, "all", "all");
}

function getReportRows(companyFilter, yearFilter, monthFilter) {
  return records.filter((row) => {
    const matchesCompany = companyFilter === "all" || companyKey(row) === companyFilter;
    const matchesYear = yearFilter === "all" || getRecordYear(row) === yearFilter;
    const matchesMonth = monthFilter === "all" || getRecordReportMonth(row) === monthFilter;
    return matchesCompany && matchesYear && matchesMonth;
  });
}

function renderReports() {
  renderBars($("#deptBars"), countBy(getReportRows(deptReportCompanyFilter, deptReportYearFilter, deptReportMonthFilter), (row) => cleanDepartment(row.department)));
  renderBars($("#reportTypeBars"), countFixedAccidentTypes(getReportRows(typeReportCompanyFilter, typeReportYearFilter, typeReportMonthFilter)));
}

function renderNearMissRiskPicks(sourceRows) {
  const list = $("#nearMissRiskPickList");
  const caption = $("#nearMissRiskPickCaption");
  const yearSelect = $("#nearMissRiskPickYearSelect");
  const monthSelect = $("#nearMissRiskPickMonthSelect");
  const countSelect = $("#nearMissRiskPickCountSelect");
  if (!list || !caption) return;

  const nearMissSourceRows = sourceRows.filter((row) => row.kind === "nearMiss");
  const yearOptions = getRiskPickYearOptions(nearMissSourceRows);
  const defaultPeriod = getDefaultRiskPickPeriod(nearMissSourceRows);
  const selectedYear = nearMissRiskPickYear && yearOptions.includes(nearMissRiskPickYear)
    ? nearMissRiskPickYear
    : defaultPeriod.year;
  const monthOptions = getRiskPickMonthOptions(nearMissSourceRows, selectedYear);
  const selectedMonth = nearMissRiskPickMonth && monthOptions.includes(nearMissRiskPickMonth)
    ? nearMissRiskPickMonth
    : (monthOptions.includes(defaultPeriod.month) ? defaultPeriod.month : monthOptions[0] || defaultPeriod.month);
  const pickCount = Math.max(1, Math.min(5, Number(nearMissRiskPickCount) || 2));

  if (yearSelect) {
    yearSelect.innerHTML = [
      `<option value="">자동</option>`,
      ...yearOptions.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}년</option>`)
    ].join("");
    yearSelect.value = nearMissRiskPickYear && yearOptions.includes(nearMissRiskPickYear)
      ? nearMissRiskPickYear
      : "";
  }
  if (monthSelect) {
    monthSelect.innerHTML = [
      `<option value="">자동</option>`,
      ...monthOptions.map((month) => `<option value="${escapeHtml(month)}">${escapeHtml(month)}</option>`)
    ].join("");
    monthSelect.value = nearMissRiskPickMonth && monthOptions.includes(nearMissRiskPickMonth)
      ? nearMissRiskPickMonth
      : "";
  }
  if (countSelect) countSelect.value = String(pickCount);

  if (!nearMissRiskPickVisible) {
    caption.textContent = "등록연도, 등록월, 갯수를 선택한 뒤 추천보기를 누르세요.";
    list.innerHTML = `<div class="risk-pick-empty">조건을 선택하고 추천보기를 누르면 별도 위험성평가 등록 추천 항목이 표시됩니다.</div>`;
    return;
  }

  const picks = getMonthlyRiskAssessmentPicks(nearMissSourceRows, pickCount, selectedMonth, selectedYear, false);
  const monthHint = picks.sourceCount
    ? `${picks.year}년 ${picks.month} 등록 기준 ${picks.sourceCount}건 중 별도 위험성평가 추천`
    : `${picks.year}년 ${picks.month} 등록 자료가 없습니다`;
  caption.textContent = `${monthHint} · 상위 ${picks.items.length}건`;

  if (!picks.items.length) {
    list.innerHTML = `<div class="risk-pick-empty">추천할 위험성평가 대상이 없습니다.</div>`;
    return;
  }

  list.innerHTML = picks.items.map(({ row, score, reasons }, index) => {
    const riskScore = getRiskScore(row);
    const reasonChips = (reasons.length ? reasons : ["월별 위험성평가 등록 후보"])
      .map((reason) => `<span>${escapeHtml(reason)}</span>`)
      .join("");
    return `
      <article class="risk-pick-card rank-${index + 1}">
        <div class="risk-pick-head">
          <span class="risk-pick-rank">${index + 1}</span>
          <div>
            <strong>${escapeHtml(cleanDepartment(row.department))} · ${escapeHtml(normalizeAccidentType(row.type) || "기타")}</strong>
            <p>${escapeHtml(row.location || row.process || "-")}</p>
          </div>
          ${badge(`${getRiskLevel(row)} ${riskScore}`)}
        </div>
        <p class="risk-pick-desc">${escapeHtml(row.description || row.action || "-")}</p>
        <div class="risk-pick-reasons">${reasonChips}</div>
        <div class="risk-pick-foot">
          <span>추천점수 ${escapeHtml(score)} · 등록 ${escapeHtml(getRecordReportYear(row) || "-")}년 ${escapeHtml(getRecordReportMonth(row) || "-")}</span>
          <div class="risk-pick-actions">
            <button class="btn small ghost" type="button" data-edit="${escapeHtml(row.id)}">아차사고 보기</button>
            <button class="btn small" type="button" data-risk-target="${escapeHtml(row.id)}">위험성평가 보기</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderNearMiss() {
  const allNearMissRows = records.filter((row) => row.kind === "nearMiss");
  const filteredNearMissRows = filteredRecords().filter((row) => row.kind === "nearMiss");
  const rows = filteredNearMissRows.filter((row) => nearMissCompanyFilter === "all" || companyKey(row) === nearMissCompanyFilter);
  $("#nearMissSummary").innerHTML = [
    [K.all, allNearMissRows.length],
    [K.oyoung, allNearMissRows.filter((row) => companyKey(row) === "oyoung").length],
    [K.sem, allNearMissRows.filter((row) => companyKey(row) === "sem").length],
    ["\uD604\uC7AC \uD45C\uC2DC", rows.length],
    ["\uAC80\uC0C9/\uD544\uD130 \uACB0\uACFC", filteredNearMissRows.length]
  ].map(([label, value]) => `<span class="mini-summary-item">${label} <strong>${value}</strong></span>`).join("");
  renderNearMissRiskPicks(riskPickFilteredRows().filter((row) => row.kind === "nearMiss" && (nearMissCompanyFilter === "all" || companyKey(row) === nearMissCompanyFilter)));
  $("#nearMissRows").innerHTML = rows.map((row, index) => `
    <tr class="openable-row" data-edit="${row.id}" title="\uB354\uBE14\uD074\uB9AD\uD574\uC11C \uBCF4\uAE30">
      <td>${index + 1}</td>
      <td>${escapeHtml(getRecordMonth(row))}</td>
      <td>${escapeHtml(row.date || "-")}</td>
      <td>${escapeHtml(cleanDepartment(row.department))}</td>
      <td>${escapeHtml(row.author || "-")}</td>
      <td>${escapeHtml(row.location || "-")}</td>
      <td class="description-cell" title="${escapeHtml(row.description || "")}">${escapeHtml(row.description || "-")}</td>
      <td>${escapeHtml(row.type || "-")}</td>
      <td>${riskLinkBadge(row)}</td>
    </tr>
  `).join("");
}

function renderIncident() {
  const allIncidentRows = records.filter((row) => row.kind === "incident");
  const filteredIncidentRows = filteredRecords().filter((row) => row.kind === "incident");
  const rows = filteredIncidentRows.filter((row) => incidentCompanyFilter === "all" || companyKey(row) === incidentCompanyFilter);
  const dateCounters = new Map();
  $("#incidentSummary").innerHTML = [
    [K.all, allIncidentRows.length],
    [K.oyoung, allIncidentRows.filter((row) => companyKey(row) === "oyoung").length],
    [K.sem, allIncidentRows.filter((row) => companyKey(row) === "sem").length],
    ["\uC7AC\uD574\uC870\uC0AC\uD45C \uB300\uC0C1", allIncidentRows.filter(isReportable).length],
    ["\uD604\uC7AC \uD45C\uC2DC", rows.length],
    ["\uAC80\uC0C9/\uD544\uD130 \uACB0\uACFC", filteredIncidentRows.length]
  ].map(([label, value]) => `<span class="mini-summary-item">${label} <strong>${value}</strong></span>`).join("");
  $("#incidentRows").innerHTML = rows.map((row) => {
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(safeText(row.date)) ? row.date : today();
    const next = (dateCounters.get(dateKey) || 0) + 1;
    dateCounters.set(dateKey, next);
    const displayNo = `${dateKey}-${String(next).padStart(2, "0")}`;
    return `
    <tr>
      <td>${displayNo}</td>
      <td>${escapeHtml(row.date)}</td>
      <td>${escapeHtml(cleanDepartment(row.department))}</td>
      <td>${escapeHtml(row.type || "-")}</td>
      <td class="description-cell" title="${escapeHtml(row.summary || row.description || "")}">${escapeHtml(row.summary || row.description || "-")}</td>
      <td>${escapeHtml(row.claimType || "-")}</td>
      <td><button class="btn small" data-edit="${row.id}" type="button">\uBCF4\uAE30</button></td>
    </tr>
  `;
  }).join("");
}

function uniqDrafts(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = safeText(item.hazard).replace(/\s+/g, "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function buildRiskDrafts(record) {
  const assessed = assessRisk(record);
  const score = assessed.likelihood * assessed.severity;
  const text = [
    record.type,
    record.location,
    record.process,
    record.description,
    record.cause,
    record.action
  ].map(safeText).join(" ");
  const compact = text.replace(/\s+/g, "");
  const location = safeText(record.location || record.process || "해당 장소");
  const action = compactSummary(record.action || "위험요인을 제거하고 작업 전 점검 및 주의사항을 공유한다.");
  const owner = safeText(record.owner || record.author || "-");
  const doneDate = safeText(record.completedDate || record.dueDate || record.date || "");
  const makeOptions = (...items) => uniqueTextItems([action, ...items].filter(Boolean)).slice(0, 5);
  const defaultOptions = makeOptions(
    "해당 위험요인을 직접 제거하거나 차단 조치한다.",
    "위험 발생 위치를 현장 확인 후 즉시 보완한다.",
    "작업 전 관련 작업자에게 개선사항을 공유한다."
  );
  const drafts = [];

  drafts.push({
    hazard: compactSummary(record.description || record.cause || `${location}에서 작업 중 사고 위험이 있음`),
    estimate: score >= 12 ? "보완" : "적정",
    action,
    actionOptions: getRelevantActionOptions(text, action, defaultOptions),
    dueDate: safeText(record.dueDate || record.date || ""),
    doneDate,
    owner
  });

  if (/통로|이동|보행|계단|발판|바닥|걸림|넘어짐|정리|방치/.test(text)) {
    drafts.push({
      hazard: `${location} 주변 통행구간의 장애물 또는 정리정돈 미흡으로 작업자 이동 중 걸림·넘어짐 위험`,
      estimate: "보완",
      action: "통행구간 장애물을 제거하고 자재 보관 위치를 지정하여 작업 동선을 확보한다.",
      actionOptions: makeOptions(
        "통행구간 장애물을 제거한다.",
        "자재 보관 위치를 지정한다.",
        "작업 동선을 확보하고 통로 구획을 표시한다.",
        "정리정돈 점검 주기를 정해 관리한다."
      ),
      dueDate: safeText(record.dueDate || record.date || ""),
      doneDate,
      owner
    });
  }

  if (/kg|중량|용기|운반|이동|적재|기자재|자재/.test(text)) {
    drafts.push({
      hazard: `${location}에서 용기 및 기자재 정리·이동 중 중량물 취급에 따른 허리 부담 또는 협착 위험`,
      estimate: "보완",
      action: "중량물은 지정 장소에 보관하고 운반 보조도구 사용 및 2인 작업 기준을 적용한다.",
      actionOptions: makeOptions(
        "중량물은 지정 장소에 보관한다.",
        "운반 보조도구 사용 기준을 적용한다.",
        "중량물 취급 시 2인 작업 기준을 적용한다.",
        "중량물 보관 높이와 적재 상태를 점검한다."
      ),
      dueDate: safeText(record.dueDate || record.date || ""),
      doneDate,
      owner
    });
  }

  if (/머리|부딪|충돌|간섭|돌출|개구부|배관|탱크|TANK|구조물/.test(text)) {
    drafts.push({
      hazard: `${location}의 구조물 또는 설비 간섭으로 작업자 신체가 부딪힐 위험`,
      estimate: "보완",
      action: "간섭 부위에 보호재와 경고표지를 설치하고 통행 동선을 조정한다.",
      actionOptions: makeOptions(
        "간섭 부위에 보호재를 설치한다.",
        "위험부에 경고표지를 부착한다.",
        "통행 동선을 조정한다.",
        "돌출부 또는 간섭부를 개선한다."
      ),
      dueDate: safeText(record.dueDate || record.date || ""),
      doneDate,
      owner
    });
  }

  if (/화학|약품|원액|누출|밸브|배관|호스|플랜지|접촉|비산/.test(text)) {
    drafts.push({
      hazard: `${location}에서 화학물질 누출 또는 접촉으로 피부·안구 손상 위험`,
      estimate: "보완",
      action: "배관·밸브 연결부를 점검하고 보호구 착용, 누출 대응물품 비치 상태를 확인한다.",
      actionOptions: makeOptions(
        "배관·밸브 연결부 누출 여부를 점검한다.",
        "보호구 착용 상태를 확인한다.",
        "누출 대응물품 비치 상태를 점검한다.",
        "비산 또는 접촉 가능 부위에 차단 조치를 실시한다."
      ),
      dueDate: safeText(record.dueDate || record.date || ""),
      doneDate,
      owner
    });
  }

  if (/교육|주의|TBM|작업표준|안내|표지|관리/.test(text)) {
    drafts.push({
      hazard: `${location} 작업 전 위험요인 공유가 부족하여 동일 위험이 반복될 가능성`,
      estimate: "보완",
      action: "TBM을 통해 위험요인과 개선사항을 공유하고 유사 장소 수평전개 점검을 실시한다.",
      actionOptions: makeOptions(
        "TBM을 통해 위험요인과 개선사항을 공유한다.",
        "유사 장소 수평전개 점검을 실시한다.",
        "작업표준 또는 주의사항을 재교육한다.",
        "관리감독자가 개선사항 이행 여부를 확인한다."
      ),
      dueDate: safeText(record.dueDate || record.date || ""),
      doneDate,
      owner
    });
  }

  return uniqDrafts(drafts);
}

function getRelevantActionOptions(text, action, fallbackOptions) {
  const makeOptions = (...items) => uniqueTextItems([action, ...items].filter(Boolean)).slice(0, 5);
  if (/화상|고온|뜨거|열|스팀|증기|보온|단열|내열|장갑/.test(text)) {
    return makeOptions(
      "내열장갑 등 열 접촉 보호구를 지급하고 착용 상태를 확인한다.",
      "고온부 또는 열원 접촉부에 단열재와 보호커버를 설치한다.",
      "고온 접촉 위험 위치에 식별표시를 부착한다.",
      "작업 전 고온부 냉각 또는 차단 상태를 확인한다."
    );
  }
  if (/끼임|협착|롤러|회전|벨트|체인|구동부/.test(text)) {
    return makeOptions(
      "끼임 위험부에 방호덮개 또는 가드를 설치한다.",
      "정비 전 전원 차단 및 잠금표시 절차를 적용한다.",
      "회전체 접근 가능 구간을 차단한다.",
      "손 끼임 위험 작업은 전용 공구를 사용한다."
    );
  }
  if (/넘어짐|미끄|걸림|통로|계단|바닥|방치|정리/.test(text)) {
    return makeOptions(
      "통행구간 장애물을 제거한다.",
      "미끄럼 또는 걸림 발생 위치를 보수한다.",
      "자재 보관 위치를 지정하고 통로를 확보한다.",
      "바닥 상태와 정리정돈을 주기적으로 점검한다."
    );
  }
  if (/부딪|충돌|머리|돌출|간섭|개구부|구조물/.test(text)) {
    return makeOptions(
      "간섭 부위에 완충 보호재를 설치한다.",
      "돌출부 또는 낮은 구조물을 개선한다.",
      "접촉 위험 위치에 식별표시를 부착한다.",
      "작업자 통행 동선을 조정한다."
    );
  }
  if (/화학|약품|원액|누출|접촉|비산|밸브|배관|호스|플랜지/.test(text)) {
    return makeOptions(
      "누출 가능 부위를 점검하고 체결 상태를 보완한다.",
      "화학물질용 보호구 착용 상태를 확인한다.",
      "비산 또는 접촉 가능 부위에 차단 조치를 실시한다.",
      "세안·세척 및 누출 대응물품 비치 상태를 확인한다."
    );
  }
  if (/베임|절단|칼|날카|철판|커터|모서리/.test(text)) {
    return makeOptions(
      "날카로운 모서리에 보호캡 또는 보호재를 설치한다.",
      "절단 방지 장갑을 착용한다.",
      "베임 위험 공구의 보관 및 사용 기준을 정한다.",
      "작업 전 날카로운 부위 상태를 점검한다."
    );
  }
  return fallbackOptions;
}

function isIrrelevantSupervisorActionOption(kind, option, contextText) {
  if (kind !== "eduAction") return false;
  const optionText = safeText(option).replace(/\s+/g, "");
  const context = safeText(contextText);
  const doorRelated = /문|도어|개폐|게이트|셔터|출입문|문짝/.test(context);
  if (/문개폐.*손|개폐.*손|손.*넣/.test(optionText) && !doorRelated) return true;
  return false;
}

function getSupervisorActionOptions(kind, record, currentAction) {
  const text = [
    record.type,
    record.location,
    record.process,
    record.summary,
    record.description,
    record.cause,
    record.action,
    currentAction
  ].map(safeText).join(" ");
  const location = safeText(record.location || record.process || "해당 작업구간");
  const type = safeText(record.type || "위험요인");
  const baseAction = compactSummary(record.action || currentAction || "");
  const withBase = (...items) => uniqueTextItems([baseAction, ...items].filter(Boolean))
    .filter((item) => !isIrrelevantSupervisorActionOption(kind, item, text))
    .slice(0, 5);

  if (kind === "adminAction") {
    if (/화상|고온|뜨거|열|스팀|증기|보온|단열|내열|장갑/.test(text)) {
      return withBase(
        `${location} 고온부 작업 전 보호구 적합성 확인 절차를 운영한다.`,
        "내열 보호구 지급 및 착용 상태를 관리감독자가 작업 전 확인한다.",
        "고온 접촉 위험 작업은 작업허가 또는 사전점검 후 진행한다.",
        "고온부 식별표시와 출입·접근 관리 상태를 주기적으로 점검한다."
      );
    }
    if (/넘어짐|미끄|걸림|통로|계단|바닥|방치|정리/.test(text)) {
      return withBase(
        `${location} 통행로 정리정돈 점검 기준을 지정하고 주기적으로 확인한다.`,
        "자재 임시보관 위치와 통행로 확보 기준을 정해 관리한다.",
        "작업 전 통행 장애물 제거 여부를 관리감독자가 확인한다.",
        "동일 위험구간을 점검표에 반영해 반복 점검한다."
      );
    }
    if (/화학|약품|원액|누출|접촉|비산|밸브|배관|호스|플랜지/.test(text)) {
      return withBase(
        "화학물질 취급 전 보호구와 비상대응물품 비치 상태를 확인한다.",
        "배관·밸브 연결부 누출 점검 주기를 지정해 관리한다.",
        "취급 작업 전 MSDS 및 작업절차 확인을 실시한다.",
        "누출 또는 접촉 우려 작업은 관리감독자 확인 후 진행한다."
      );
    }
    return withBase(
      `${type} 위험요인을 작업 전 점검항목에 반영한다.`,
      "관리감독자가 개선사항 이행 여부를 확인한다.",
      "동일·유사 장소에 수평전개 점검을 실시한다.",
      "작업 전 TBM에서 해당 위험요인을 공유한다."
    );
  }

  if (kind === "techAction") {
    if (/화상|고온|뜨거|열|스팀|증기|보온|단열|내열|장갑/.test(text)) {
      return withBase(
        "고온부 또는 열원 접촉부에 단열재와 보호커버를 설치한다.",
        "작업자가 접촉 가능한 고온 표면에 방호덮개를 설치한다.",
        "고온부 식별표지와 접근 제한 표시를 부착한다.",
        "작업 전 냉각 또는 차단 상태를 확인할 수 있도록 표시한다."
      );
    }
    if (/끼임|협착|롤러|회전|벨트|체인|구동부/.test(text)) {
      return withBase(
        "끼임 위험부에 방호덮개 또는 가드를 설치한다.",
        "정비 중 전원 차단 및 잠금표시 장치를 사용한다.",
        "회전체 접근 가능 구간에 차단 커버를 설치한다.",
        "협착 위험 위치에 비상정지 접근성을 확보한다."
      );
    }
    if (/부딪|충돌|머리|돌출|간섭|개구부|구조물/.test(text)) {
      return withBase(
        "간섭 부위에 완충 보호재를 설치한다.",
        "돌출부 또는 낮은 구조물을 개선한다.",
        "작업자 통행 동선을 조정하고 위험부를 분리한다.",
        "접촉 위험 위치에 식별표시를 부착한다."
      );
    }
    if (/넘어짐|미끄|걸림|통로|계단|바닥|방치|정리/.test(text)) {
      return withBase(
        "통행구간 장애물을 제거하고 바닥 상태를 보수한다.",
        "미끄럼 방지 조치 또는 통로 구획 표시를 적용한다.",
        "자재 보관대를 설치해 통로 침범을 방지한다.",
        "계단·발판 손상부를 보수하고 고정 상태를 확인한다."
      );
    }
    return withBase(
      "위험 발생 부위에 물리적 방호조치를 적용한다.",
      "작업 동선과 설비 간섭부를 개선한다.",
      "위험 위치에 식별표시 또는 보호재를 설치한다.",
      "개선 후 설비 상태와 작업성을 재확인한다."
    );
  }

  if (/화상|고온|뜨거|열|스팀|증기|보온|단열|내열|장갑/.test(text)) {
    return withBase(
      "고온부 접촉 위험과 내열 보호구 착용 기준을 교육한다.",
      "작업 전 고온부 확인 및 접근 금지 사항을 TBM으로 공유한다.",
      "부적합 보호구 사용 사례와 화상 예방수칙을 교육한다.",
      "개선 전후 사진을 활용해 동일 위험 재발방지 교육을 실시한다."
    );
  }
  if (/화학|약품|원액|누출|접촉|비산/.test(text)) {
    return withBase(
      "화학물질 취급 보호구와 비상조치 절차를 교육한다.",
      "MSDS 주요 위험성과 세안·세척 절차를 공유한다.",
      "누출 발생 시 초기 대응 및 보고 절차를 교육한다.",
      "비산·접촉 위험 작업 전 주의사항을 TBM으로 공유한다."
    );
  }
  if (/끼임|협착|롤러|회전|벨트|체인|구동부/.test(text)) {
    return withBase(
      "가동부 주변 작업 전 전원 차단 및 접근금지 사항을 교육한다.",
      "끼임 위험부 접근 금지와 전용 공구 사용 기준을 TBM으로 공유한다.",
      "정비·청소 작업 시 잠금표시 절차와 확인사항을 교육한다.",
      "회전체 주변 작업 전 위험구간 확인 및 작업자 간 신호 기준을 공유한다."
    );
  }
  if (/부딪|충돌|머리|돌출|간섭|개구부|구조물/.test(text)) {
    return withBase(
      "작업 전 설비 간섭부와 머리 부딪힘 위험 위치를 공유한다.",
      "통행 시 시야 확보와 위험표지 확인 사항을 TBM으로 교육한다.",
      "돌출부·개구부 주변 이동 시 주의사항을 관련 작업자에게 전파한다.",
      "개선 전후 사진으로 동일 위험구간 재발방지 교육을 실시한다."
    );
  }
  if (/넘어짐|미끄|걸림|통로|계단|바닥|방치|정리/.test(text)) {
    return withBase(
      "작업 전 통행로 장애물과 미끄럼·걸림 위험요인을 공유한다.",
      "자재 정리정돈 기준과 보행 동선 확보 사항을 교육한다.",
      "계단·발판 이용 시 손잡이 사용과 전방 주시 사항을 전파한다.",
      "TBM에서 통로 확보 및 작업 후 정리정돈 상태를 확인한다."
    );
  }
  return withBase(
    `${type} 관련 위험요인과 개선사항을 작업 전 교육한다.`,
    "개선 전후 사진을 활용해 사례교육을 실시한다.",
    "동일 위험 재발방지를 위한 TBM 공유를 실시한다.",
    "작업표준 및 주의사항을 관련 작업자에게 재교육한다."
  );
}

function getExpertRecommendationContext(record, currentAction = "", includeActionText = false) {
  const fields = [
    record.type,
    record.location,
    record.process,
    record.summary,
    record.description,
    record.cause
  ];
  if (includeActionText) fields.push(record.action, currentAction);
  return fields.map(safeText).join(" ");
}

function includesSafetyKeyword(text, keywords) {
  const source = safeText(text);
  return keywords.some((keyword) => source.includes(keyword));
}

function getExpertSafetyProfile(record, currentAction = "") {
  const type = safeText(record.type);
  const text = getExpertRecommendationContext(record, currentAction);
  const compact = text.replace(/\s+/g, "");
  const profiles = [
    {
      id: "chemical",
      typeKeywords: ["화학물질 누출", "화학물질 접촉"],
      keywords: ["화학", "약품", "원액", "누출", "비산", "MSDS", "세안", "세척", "배관", "밸브", "호스", "플랜지"],
      hazards: [
        "{location}에서 화학물질 누출 또는 비산으로 작업자 피부·안구에 접촉될 위험",
        "{location} 배관·밸브·호스 연결부 관리 미흡으로 화학물질이 누출될 위험",
        "화학물질 취급 중 보호구 또는 비상세척 체계 미흡으로 피해가 확대될 위험"
      ],
      actions: [
        "배관·밸브·호스 연결부의 누출 여부와 체결 상태를 점검하고 노후 부품을 교체한다.",
        "비산 가능 부위에 차단커버를 설치하고 화학물질용 보호구 착용 상태를 확인한다.",
        "세안·세척설비와 누출 대응물품 비치 상태를 확인하고 MSDS 주요 위험성을 교육한다."
      ],
      admin: [
        "화학물질 취급 전 보호구, MSDS, 비상대응물품 확인 절차를 작업 전 점검항목에 반영한다.",
        "배관·밸브 연결부 누출 점검 주기를 지정하고 관리감독자가 이행 여부를 확인한다.",
        "누출 또는 접촉 우려 작업은 관리감독자 확인 후 진행하도록 작업관리 기준을 정한다."
      ],
      tech: [
        "누출 가능 연결부를 보수하고 체결 상태를 보완한다.",
        "비산 또는 접촉 가능 부위에 차단커버와 받침·방유 조치를 적용한다.",
        "세안·세척설비와 누출 대응물품을 작업장 가까운 위치에 확보한다."
      ],
      edu: [
        "MSDS 주요 위험성과 보호구 착용 기준을 작업 전 교육한다.",
        "화학물질 누출 시 초기 대응, 세안·세척, 보고 절차를 TBM으로 공유한다.",
        "비산·접촉 위험 작업 전 금지행동과 대피 동선을 교육한다."
      ]
    },
    {
      id: "thermal",
      typeKeywords: ["이상온도 접촉"],
      keywords: ["화상", "고온", "뜨거", "열원", "스팀", "증기", "보온", "단열", "냉동", "저온", "내열"],
      hazards: [
        "{location} 고온·저온부에 작업자 신체가 접촉되어 화상 또는 동상 피해가 발생할 위험",
        "고온 배관·설비 표면의 식별표시 또는 단열 조치 미흡으로 접촉 사고가 발생할 위험",
        "열원 주변 작업 중 보호구 부적합 또는 착용 미흡으로 이상온도 접촉 피해가 발생할 위험"
      ],
      actions: [
        "고온·저온 접촉부에 단열재 또는 보호커버를 설치한다.",
        "접촉 위험 위치에 식별표시와 접근 제한 표시를 부착한다.",
        "내열·방한 보호구 지급 및 착용 상태를 작업 전 확인한다."
      ],
      admin: [
        "이상온도 접촉 작업 전 보호구 적합성 확인 절차를 운영한다.",
        "고온·저온부 식별표시와 접근관리 상태를 관리감독자가 주기적으로 확인한다.",
        "접촉 위험 작업은 작업 전 온도, 차단, 냉각 상태 확인 후 진행하도록 관리한다."
      ],
      tech: [
        "고온·저온 접촉부에 단열재와 보호커버를 설치한다.",
        "접촉 가능한 표면에 방호덮개 또는 접근 제한 조치를 적용한다.",
        "위험 위치에 식별표시를 부착하고 작업 동선을 분리한다."
      ],
      edu: [
        "고온·저온 접촉 위험과 보호구 착용 기준을 교육한다.",
        "작업 전 열원 위치와 접근 금지 구역을 TBM으로 공유한다.",
        "화상·동상 발생 시 응급조치와 보고 절차를 교육한다."
      ]
    },
    {
      id: "pinch",
      typeKeywords: ["끼임"],
      keywords: ["끼임", "협착", "롤러", "회전", "벨트", "체인", "구동부", "프레스", "실린더", "컨베이어"],
      hazards: [
        "{location}의 회전체 또는 구동부에 손·팔이 접근하여 끼임·협착될 위험",
        "정비·청소 중 전원 차단 및 잠금표시 미흡으로 설비가 갑자기 작동할 위험",
        "방호덮개 또는 가드 미설치로 작업자가 위험부에 직접 접촉할 위험"
      ],
      actions: [
        "끼임 위험부에 방호덮개 또는 가드를 설치한다.",
        "정비·청소 전 전원 차단 및 잠금표시 절차를 적용한다.",
        "위험부 접근 금지 표시와 전용 공구 사용 기준을 운영한다."
      ],
      admin: [
        "정비·청소 작업 전 전원 차단 및 잠금표시 확인 절차를 관리한다.",
        "끼임 위험부 방호장치 임의 해체 금지 기준을 작업표준에 반영한다.",
        "관리감독자가 작업 전 방호덮개 설치 상태와 비상정지 접근성을 확인한다."
      ],
      tech: [
        "끼임 위험부에 방호덮개 또는 가드를 설치한다.",
        "회전체 접근 가능 구간을 차단하고 비상정지 접근성을 확보한다.",
        "작업자가 손을 넣지 않도록 전용 공구와 작업 보조장치를 사용한다."
      ],
      edu: [
        "가동부 주변 작업 전 전원 차단 및 접근금지 사항을 교육한다.",
        "끼임 위험부 접근 금지와 전용 공구 사용 기준을 TBM으로 공유한다.",
        "정비·청소 작업 시 잠금표시 절차와 확인사항을 교육한다."
      ]
    },
    {
      id: "slip",
      typeKeywords: ["넘어짐"],
      keywords: ["넘어짐", "미끄", "걸림", "통로", "계단", "발판", "바닥", "방치", "정리", "보행", "이동", "장애물"],
      hazards: [
        "{location} 통행구간의 장애물 또는 정리정돈 미흡으로 작업자가 걸려 넘어질 위험",
        "{location} 바닥·계단·발판 상태 불량으로 이동 중 미끄러지거나 균형을 잃을 위험",
        "자재 임시 적치 또는 작업동선 미확보로 보행 중 충돌·전도 사고가 발생할 위험"
      ],
      actions: [
        "통행구간 장애물을 제거하고 자재 보관 위치를 지정한다.",
        "바닥·계단·발판 손상부를 보수하고 미끄럼 방지 조치를 적용한다.",
        "작업 동선을 구획 표시하고 정리정돈 점검 주기를 운영한다."
      ],
      admin: [
        "통행로 확보와 정리정돈 기준을 정하고 관리감독자가 작업 전 확인한다.",
        "자재 임시보관 위치를 지정해 통로 침범을 방지한다.",
        "동일 위험구간을 점검표에 반영하고 주기적으로 확인한다."
      ],
      tech: [
        "통행구간 장애물을 제거하고 작업 동선을 구획 표시한다.",
        "미끄럼 발생 위치에 미끄럼 방지 조치를 적용한다.",
        "계단·발판 손상부를 보수하고 고정 상태를 확인한다."
      ],
      edu: [
        "작업 전 통행로 장애물과 미끄럼·걸림 위험요인을 공유한다.",
        "자재 정리정돈 기준과 보행 동선 확보 사항을 교육한다.",
        "계단·발판 이용 시 전방 주시와 손잡이 사용 사항을 전파한다."
      ]
    },
    {
      id: "strike",
      typeKeywords: ["부딪힘", "맞음"],
      keywords: ["부딪", "충돌", "머리", "돌출", "간섭", "개구부", "구조물", "낙하", "비래", "맞음", "적재"],
      hazards: [
        "{location}의 돌출부 또는 낮은 구조물에 작업자 신체가 부딪힐 위험",
        "설비·배관·탱크 주변 작업동선과 구조물 간섭으로 충돌 사고가 발생할 위험",
        "자재 적재 또는 낙하·비래 위험 관리 미흡으로 작업자가 맞을 위험"
      ],
      actions: [
        "간섭 부위에 완충 보호재를 설치하고 위험 위치에 식별표시를 부착한다.",
        "작업자 통행 동선을 조정하고 돌출부 또는 낮은 구조물을 개선한다.",
        "자재 적재 상태와 낙하 방지 조치를 점검한다."
      ],
      admin: [
        "설비 간섭부와 충돌 위험 위치를 작업 전 점검항목에 반영한다.",
        "동일 구조물 주변에 수평전개 점검을 실시하고 개선 여부를 확인한다.",
        "자재 적재 기준과 통행동선 관리 기준을 정해 관리한다."
      ],
      tech: [
        "간섭 부위에 완충 보호재를 설치한다.",
        "돌출부 또는 낮은 구조물을 개선하고 위험 위치에 식별표시를 부착한다.",
        "작업자 통행 동선을 조정하고 위험부를 분리한다."
      ],
      edu: [
        "작업 전 설비 간섭부와 머리 부딪힘 위험 위치를 공유한다.",
        "통행 시 시야 확보와 위험표지 확인 사항을 TBM으로 교육한다.",
        "개선 전후 사진을 활용해 동일 위험구간 재발방지 교육을 실시한다."
      ]
    },
    {
      id: "cut",
      typeKeywords: ["베임", "찔림"],
      keywords: ["베임", "찔림", "절단", "칼", "커터", "날카", "철판", "모서리", "돌출핀", "파손"],
      hazards: [
        "{location}의 날카로운 모서리 또는 절단면에 손이 베이거나 찔릴 위험",
        "공구·자재 보관상태 미흡으로 작업 중 예리한 부위에 접촉할 위험",
        "절단·정리 작업 중 보호구 미착용 또는 부적합 공구 사용으로 손상 위험"
      ],
      actions: [
        "날카로운 모서리에 보호캡 또는 보호재를 설치한다.",
        "절단 방지 장갑을 착용하고 예리한 자재 보관 기준을 정한다.",
        "파손·돌출 부위를 제거하고 안전한 공구 사용 기준을 교육한다."
      ],
      admin: [
        "예리한 자재와 절단 공구 보관 기준을 정하고 관리상태를 점검한다.",
        "절단·정리 작업 전 보호구 착용 여부를 관리감독자가 확인한다.",
        "베임·찔림 위험부를 점검표에 반영해 주기적으로 확인한다."
      ],
      tech: [
        "날카로운 모서리에 보호캡 또는 보호재를 설치한다.",
        "파손·돌출 부위를 제거하거나 마감 처리한다.",
        "절단 작업에는 적합한 공구와 고정 장치를 사용한다."
      ],
      edu: [
        "베임·찔림 위험부 확인과 절단 방지 장갑 착용 기준을 교육한다.",
        "예리한 자재 취급 및 보관 방법을 TBM으로 공유한다.",
        "절단 공구 사용 전 점검사항과 금지행동을 교육한다."
      ]
    },
    {
      id: "electric",
      typeKeywords: ["누전"],
      keywords: ["누전", "감전", "전기", "전선", "콘센트", "차단기", "분전반", "접지", "절연"],
      hazards: [
        "{location} 전기설비 절연 또는 접지 상태 불량으로 감전 위험",
        "전선·콘센트·분전반 관리 미흡으로 누전 또는 전기화재가 발생할 위험",
        "습윤 환경에서 전기기기 사용 중 감전 사고가 발생할 위험"
      ],
      actions: [
        "전기설비 절연·접지 상태와 누전차단기 작동 여부를 점검한다.",
        "손상 전선과 콘센트를 교체하고 습윤 구간 사용을 제한한다.",
        "전기작업 전 차단·검전 절차와 접근금지 표시를 적용한다."
      ],
      admin: [
        "전기설비 정기점검과 누전차단기 시험 주기를 지정해 관리한다.",
        "전기작업 전 차단·검전 확인 절차를 작업표준에 반영한다.",
        "습윤구간 전기기기 사용 제한 기준을 관리감독자가 확인한다."
      ],
      tech: [
        "손상 전선과 콘센트를 교체하고 절연상태를 보완한다.",
        "누전차단기 작동 상태와 접지 상태를 점검한다.",
        "습윤 구간에는 방수형 전기기기 또는 차단 조치를 적용한다."
      ],
      edu: [
        "전기작업 전 차단·검전 절차와 감전 위험을 교육한다.",
        "손상 전선 발견 시 사용중지 및 보고 기준을 공유한다.",
        "습윤 환경 전기기기 사용 금지사항을 TBM으로 전파한다."
      ]
    },
    {
      id: "fire",
      typeKeywords: ["화재 폭발"],
      keywords: ["화재", "폭발", "점화", "인화", "가연", "용접", "스파크", "정전기", "환기"],
      hazards: [
        "{location}의 점화원 관리 미흡으로 화재 또는 폭발이 발생할 위험",
        "가연물·인화성 물질 주변 작업 중 스파크 또는 정전기로 화재가 발생할 위험",
        "환기 및 소화설비 관리 미흡으로 초기 대응이 지연될 위험"
      ],
      actions: [
        "점화원을 제거하고 가연물·인화성 물질을 격리 보관한다.",
        "용접·화기 작업 전 작업허가와 소화기 비치 상태를 확인한다.",
        "환기 상태와 정전기 방지 조치를 점검한다."
      ],
      admin: [
        "화기작업 허가와 작업 전 가연물 제거 확인 절차를 운영한다.",
        "인화성 물질 보관기준과 점화원 관리 상태를 주기적으로 점검한다.",
        "비상대응 및 소화설비 점검 결과를 관리감독자가 확인한다."
      ],
      tech: [
        "가연물과 점화원을 분리하고 방화포 또는 차단막을 설치한다.",
        "환기설비와 정전기 방지 조치를 점검한다.",
        "소화기와 비상대응물품을 작업장 가까운 위치에 배치한다."
      ],
      edu: [
        "화기작업 전 가연물 제거와 소화기 위치를 교육한다.",
        "화재·폭발 위험물 취급 기준과 비상대응 절차를 TBM으로 공유한다.",
        "정전기·스파크 발생 위험과 금지행동을 교육한다."
      ]
    },
    {
      id: "fall",
      typeKeywords: ["떨어짐"],
      keywords: ["떨어짐", "추락", "고소", "사다리", "작업대", "난간", "개구부", "발판", "승강", "상부"],
      hazards: [
        "{location}에서 고소작업 또는 승강 중 작업자가 떨어질 위험",
        "작업발판·사다리·난간 상태 미흡으로 추락 사고가 발생할 위험",
        "개구부 또는 단차 구간의 방호조치 미흡으로 작업자가 떨어질 위험"
      ],
      actions: [
        "작업발판, 사다리, 난간의 고정 상태를 점검하고 불량부를 보수한다.",
        "개구부와 단차 구간에 덮개, 난간, 출입제한 표시를 설치한다.",
        "고소작업 전 추락방지 보호구 착용과 작업허가 확인을 실시한다."
      ],
      admin: [
        "고소작업 전 작업발판, 사다리, 난간 상태를 관리감독자가 확인한다.",
        "추락 위험 작업은 작업허가와 보호구 착용 확인 후 진행하도록 관리한다.",
        "개구부와 단차 구간을 점검표에 반영해 정기적으로 확인한다."
      ],
      tech: [
        "개구부와 단차 구간에 덮개 또는 안전난간을 설치한다.",
        "작업발판과 사다리 고정 상태를 보완하고 미끄럼 방지 조치를 적용한다.",
        "추락 위험구간에 출입제한 표시와 안전대 걸이설비를 확보한다."
      ],
      edu: [
        "고소작업 전 추락 위험구간과 보호구 착용 기준을 교육한다.",
        "사다리·작업발판 사용 전 점검사항과 금지행동을 TBM으로 공유한다.",
        "개구부와 단차 구간 이동 시 접근금지 및 우회 동선을 전파한다."
      ]
    },
    {
      id: "crush",
      typeKeywords: ["깔림"],
      keywords: ["깔림", "전도", "적재물", "중량물", "지게차", "크레인", "하역", "적치", "붕괴", "고정"],
      hazards: [
        "{location}에서 적재물 또는 중량물이 전도되어 작업자가 깔릴 위험",
        "자재 적치 상태와 고정 조치 미흡으로 하역·운반 중 깔림 사고가 발생할 위험",
        "장비 이동 또는 하역 작업 반경 내 작업자 출입으로 충돌·깔림 위험"
      ],
      actions: [
        "적재물 높이와 고정 상태를 점검하고 불안정한 적치를 재정리한다.",
        "하역·운반 작업 반경을 구획하고 작업자 접근을 제한한다.",
        "중량물 운반 시 신호수 배치와 장비 이동 동선 분리를 실시한다."
      ],
      admin: [
        "자재 적재 기준과 하역 작업 반경 출입통제 기준을 정해 관리한다.",
        "중량물 운반 전 장비, 신호수, 작업동선 확인 절차를 운영한다.",
        "관리감독자가 적재물 고정 상태와 작업자 위치를 작업 전 확인한다."
      ],
      tech: [
        "적재물 고정장치 또는 받침대를 사용해 전도를 방지한다.",
        "하역구간에 바리케이드와 출입제한 표시를 설치한다.",
        "장비 이동 동선과 보행자 동선을 분리한다."
      ],
      edu: [
        "하역·운반 작업 반경 접근금지와 신호수 지시 준수사항을 교육한다.",
        "적재물 전도 위험과 안전한 적치 기준을 TBM으로 공유한다.",
        "장비 이동 중 사각지대와 작업자 위치 확인 방법을 교육한다."
      ]
    },
    {
      id: "manual",
      typeKeywords: ["불균형 및 무리한"],
      keywords: ["중량", "무리", "허리", "운반", "들기", "밀기", "당기기", "반복", "자세", "kg"],
      hazards: [
        "{location}에서 중량물 취급 또는 무리한 자세로 근골격계 부담이 발생할 위험",
        "운반 보조도구 또는 2인 작업 기준 미적용으로 허리·어깨 부상 위험",
        "반복작업 및 작업높이 부적정으로 작업자 피로와 불균형 위험"
      ],
      actions: [
        "중량물 운반 보조도구를 사용하고 2인 작업 기준을 적용한다.",
        "작업높이와 보관 위치를 조정해 무리한 자세를 줄인다.",
        "반복작업 휴식 기준과 작업자 교대 기준을 운영한다."
      ],
      admin: [
        "중량물 취급 기준과 2인 작업 기준을 작업표준에 반영한다.",
        "반복·무리작업에 대한 작업자 교대와 휴식 기준을 운영한다.",
        "관리감독자가 작업 전 중량물 보관위치와 운반방법을 확인한다."
      ],
      tech: [
        "운반 보조도구를 사용하고 보관 높이를 작업자 허리 높이에 맞춘다.",
        "작업대를 조정해 허리 굽힘과 비틀림 자세를 줄인다.",
        "중량물 적재 상태와 운반동선을 개선한다."
      ],
      edu: [
        "중량물 올바른 취급 자세와 2인 작업 기준을 교육한다.",
        "무리한 자세 발생 시 작업중지 및 보조도구 사용 기준을 공유한다.",
        "반복작업 피로 누적과 스트레칭 방법을 TBM으로 전파한다."
      ]
    }
  ];

  const exactTypeProfile = profiles.find((profile) => (
    profile.typeKeywords.some((keyword) => type === keyword || type.includes(keyword))
  ));
  if (exactTypeProfile) return { ...exactTypeProfile, matchScore: 99 };

  let best = null;
  let bestScore = 0;
  for (const profile of profiles) {
    let score = 0;
    for (const keyword of profile.keywords) {
      if (compact.includes(keyword.replace(/\s+/g, ""))) score += 1;
    }
    if (score > bestScore) {
      best = profile;
      bestScore = score;
    }
  }

  if (best && bestScore >= 2) return { ...best, matchScore: bestScore };

  return {
    id: "general",
    matchScore: 0,
    hazards: [
      "{location}에서 확인된 위험요인이 제거되지 않아 유사 사고가 반복될 위험",
      "개선조치 후에도 작업자에게 위험정보가 충분히 공유되지 않아 동일 위험에 노출될 위험",
      "동일·유사 장소에 같은 위험요인이 남아 있어 재발 가능성"
    ],
    actions: [
      "위험 발생 위치를 현장 확인 후 제거·차단·표시 조치를 실시한다.",
      "개선사항을 작업표준과 점검항목에 반영하고 관리감독자가 이행 여부를 확인한다.",
      "작업 전 TBM으로 위험요인과 개선사항을 공유하고 유사 장소 수평전개 점검을 실시한다."
    ],
    admin: [
      "위험요인을 작업 전 점검항목에 반영하고 관리감독자가 이행 여부를 확인한다.",
      "동일·유사 장소에 수평전개 점검을 실시한다.",
      "개선사항을 작업표준 또는 관리기준에 반영한다."
    ],
    tech: [
      "위험 발생 부위에 제거·차단·보호재 설치 등 물리적 개선을 실시한다.",
      "작업 동선과 설비 간섭부를 현장 확인 후 개선한다.",
      "위험 위치에 식별표시와 접근 제한 조치를 적용한다."
    ],
    edu: [
      "작업 전 위험요인과 개선사항을 TBM으로 공유한다.",
      "개선 전후 사진을 활용해 동일 위험 재발방지 교육을 실시한다.",
      "작업표준과 주의사항을 관련 작업자에게 재교육한다."
    ]
  };
}

function cleanExpertPhrase(value, fallback = "") {
  return safeText(value)
    .replace(/\s+/g, " ")
    .replace(/^[,.\s·:;/-]+|[,.\s·:;/-]+$/g, "")
    .trim() || fallback;
}

function shortenExpertPhrase(value, max = 42) {
  const text = cleanExpertPhrase(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")} 등`;
}

function getExpertSituation(record) {
  const location = cleanExpertPhrase(record.location || record.process, "해당 작업구간");
  const rawText = [
    record.location,
    record.process,
    record.summary,
    record.description,
    record.cause,
    record.action
  ].map(safeText).join(" ");
  const text = rawText.replace(/\s+/g, " ").trim();
  const compact = text.replace(/\s+/g, "");
  const sentence = cleanExpertPhrase(record.summary || record.description || record.cause || record.action, `${location} 위험요인`);

  const targetPatterns = [
    /([가-힣A-Za-z0-9()\-·\/\s]{2,45}?(?:펌프|커플링|핀|탱크|TANK|계단|발판|통로|배관|밸브|호스|플랜지|용기|기자재|자재|개구부|구조물|난간|사다리|전선|콘센트|분전반|롤러|벨트|체인|컨베이어|모서리|철판|공구|문|도어)[가-힣A-Za-z0-9()\-·\/\s]{0,18})/,
    /([가-힣A-Za-z0-9()\-·\/\s]{2,45}?(?:방치|파손|누출|돌출|협착|미끄럼|걸림|유출|흘러|장애물)[가-힣A-Za-z0-9()\-·\/\s]{0,18})/
  ];
  const targetMatch = targetPatterns.map((pattern) => text.match(pattern)).find(Boolean);
  const target = shortenExpertPhrase(targetMatch?.[1] || location, 36);

  const causePatterns = [
    /([^.!?\n]{2,55}?(?:때문에|인해|미흡|부족|방치|파손|낮아|없어|않아|노후|누출|돌출|협착|걸림|미끄럼|유출)[^.!?\n]{0,34})/,
    /([^.!?\n]{2,55}?(?:위치|상태|장애물|정리정돈|보관|고정|체결|방호|보호구)[^.!?\n]{0,34})/
  ];
  const causeMatch = causePatterns.map((pattern) => text.match(pattern)).find(Boolean);
  const cause = shortenExpertPhrase(causeMatch?.[1] || sentence, 58);

  const bodyPart = compact.match(/(머리|손가락|손|팔|발|다리|허리|어깨|피부|안구|눈)/)?.[1] || "작업자";
  const material = compact.match(/([가-힣A-Za-z0-9()\-·\/]{2,24}(?:원액|약품|유류|용제|가스|스팀|증기|분진))/)?.[1] || "";
  const task = shortenExpertPhrase((text.match(/([가-힣A-Za-z0-9()\-·\/\s]{2,36}?(?:작업|이동|점검|정비|청소|탈착|운반|적재|보관|교체|조작))/)?.[1] || ""), 32);

  return { location, target, cause, bodyPart, material, task, sentence, text };
}

function getContextualExpertItems(profile, record) {
  const situation = getExpertSituation(record);
  const location = situation.location;
  const target = situation.target;
  const cause = situation.cause;
  const bodyPart = situation.bodyPart;
  const material = situation.material;
  const task = situation.task;

  const items = {
    hazards: [],
    actions: [],
    admin: [],
    tech: [],
    edu: []
  };

  if (profile.id === "slip") {
    items.hazards = [
      `${target} 정리정돈 또는 보관상태 미흡으로 작업자가 이동 중 걸려 넘어질 위험`,
      `${location} 통행동선에 장애물이 남아 작업자 보행 중 충돌·전도 위험`
    ];
    items.actions = [
      `${target}를 통행구간 밖 지정 위치로 이동 보관하고 보행 동선을 표시한다.`,
      `${location} 통행로의 장애물을 제거하고 작업 전·후 정리정돈 점검을 실시한다.`
    ];
    items.admin = [
      `${location} 통행로 확보 기준과 자재 임시보관 위치를 작업 전 점검항목에 반영한다.`,
      `관리감독자가 ${target} 정리상태와 통행동선 확보 여부를 작업 전 확인한다.`
    ];
    items.tech = [
      `${target} 주변 통행구간을 구획 표시하고 보관 위치를 분리한다.`,
      `${location} 바닥 걸림·미끄럼 요인을 제거하고 필요한 경우 미끄럼 방지 조치를 적용한다.`
    ];
    items.edu = [
      `${location} 이동 전 ${target} 주변 장애물 확인과 정리정돈 기준을 TBM으로 공유한다.`,
      `작업 후 ${target}를 지정 위치에 보관하도록 관련 작업자에게 교육한다.`
    ];
  } else if (profile.id === "strike") {
    items.hazards = [
      `${cause} 작업자가 ${bodyPart} 부위를 부딪힐 위험`,
      `${target} 주변 이동·작업 중 설비 간섭으로 충돌 사고가 발생할 위험`
    ];
    items.actions = [
      `${target} 접촉 부위에 완충 보호재와 식별표시를 설치하고 통행 동선을 조정한다.`,
      `${cause} 발생 구간을 현장 확인하여 돌출·간섭부를 제거하거나 보호 조치한다.`
    ];
    items.admin = [
      `${target} 간섭부를 작업 전 점검항목에 반영하고 개선 전까지 관리감독자가 확인한다.`,
      `${location} 유사 구조물에 대해 수평전개 점검을 실시한다.`
    ];
    items.tech = [
      `${target} 접촉 예상 부위에 보호커버 또는 완충재를 설치한다.`,
      `${location} 작업자 이동 동선을 조정해 ${target}와의 간섭을 줄인다.`
    ];
    items.edu = [
      `${target} 주변 이동 시 ${bodyPart} 부딪힘 위험 위치를 작업 전 공유한다.`,
      `개선 전까지 ${location} 이동·작업 시 시야확보와 위험표지 확인 사항을 교육한다.`
    ];
  } else if (profile.id === "chemical") {
    const materialText = material || "화학물질";
    items.hazards = [
      `${target}에서 ${materialText} 누출·비산으로 작업자 피부 또는 안구에 접촉될 위험`,
      `${cause} ${materialText} 유출 시 주변 작업자에게 노출될 위험`
    ];
    items.actions = [
      `${target} 연결부와 체결 상태를 점검하고 누출 가능 부위를 보수한다.`,
      `${materialText} 취급 위치에 비산 차단조치, 보호구, 누출 대응물품을 확보한다.`
    ];
    items.admin = [
      `${target} 누출 점검 주기와 보호구 착용 확인을 작업 전 점검항목에 반영한다.`,
      `${materialText} 취급 작업은 MSDS와 비상대응물품 확인 후 진행하도록 관리한다.`
    ];
    items.tech = [
      `${target} 누출 가능 부위에 차단커버 또는 받침·방유 조치를 적용한다.`,
      `${materialText} 접촉 가능 구간 가까이에 세안·세척 및 흡착재를 비치한다.`
    ];
    items.edu = [
      `${materialText} 누출 시 초기 차단, 세안·세척, 보고 절차를 작업 전 공유한다.`,
      `${target} 취급 시 보호구 착용 기준과 비산 주의사항을 교육한다.`
    ];
  } else if (profile.id === "thermal") {
    items.hazards = [
      `${target} 고온·저온부에 작업자가 접촉되어 화상 또는 동상 피해가 발생할 위험`,
      `${cause} 이상온도 접촉 위험을 작업자가 인지하지 못할 위험`
    ];
    items.actions = [
      `${target} 접촉 가능 부위에 단열재 또는 보호커버를 설치한다.`,
      `${location} 이상온도 위험 위치에 식별표시를 부착하고 보호구 착용을 확인한다.`
    ];
    items.admin = [
      `${target} 온도·차단·냉각 상태 확인을 작업 전 점검항목에 반영한다.`,
      `관리감독자가 ${location} 이상온도 접촉 위험 표시와 보호구 착용 상태를 확인한다.`
    ];
    items.tech = [
      `${target} 접촉면에 단열재, 보호커버 또는 접근 제한 조치를 적용한다.`,
      `${location} 작업동선을 조정해 이상온도 부위와 작업자 접촉 가능성을 줄인다.`
    ];
    items.edu = [
      `${target} 접촉 위험과 내열·방한 보호구 착용 기준을 교육한다.`,
      `작업 전 ${location}의 고온·저온 위험 위치를 TBM으로 공유한다.`
    ];
  } else if (profile.id === "pinch") {
    items.hazards = [
      `${target} 작동 또는 ${task || "정비·청소 작업"} 중 손·팔 끼임 위험`,
      `${cause} 작업자가 위험부에 접근하여 협착될 위험`
    ];
    items.actions = [
      `${target} 끼임 위험부에 방호덮개 또는 가드를 설치한다.`,
      `${task || "정비·청소"} 전 전원 차단 및 잠금표시 절차를 적용한다.`
    ];
    items.admin = [
      `${target} 방호장치 설치 상태와 전원 차단 확인을 작업 전 점검항목에 반영한다.`,
      `${task || "정비·청소"} 작업은 관리감독자 확인 후 진행하도록 기준을 정한다.`
    ];
    items.tech = [
      `${target} 접근 가능 구간에 가드와 비상정지 접근성을 확보한다.`,
      `손 접근이 필요한 작업은 전용 공구 또는 보조장치를 사용하도록 개선한다.`
    ];
    items.edu = [
      `${target} 주변 끼임 위험부 접근 금지와 잠금표시 절차를 TBM으로 공유한다.`,
      `${task || "설비 작업"} 중 손을 넣지 않도록 전용 공구 사용 기준을 교육한다.`
    ];
  } else if (profile.id === "cut") {
    items.hazards = [
      `${target}의 날카로운 부위에 작업자 손이 베이거나 찔릴 위험`,
      `${cause} 예리한 부위 접촉으로 절상 사고가 발생할 위험`
    ];
    items.actions = [
      `${target} 날카로운 부위에 보호캡 또는 마감 처리를 실시한다.`,
      `${task || "취급 작업"} 시 절단 방지 장갑과 안전한 공구 사용 기준을 적용한다.`
    ];
    items.admin = [
      `${target} 예리한 부위 점검과 보호구 착용 확인을 작업 전 점검항목에 반영한다.`,
      `파손·돌출 부위 발견 시 사용중지와 보수 요청 기준을 정한다.`
    ];
    items.tech = [
      `${target} 모서리와 돌출부를 제거하거나 보호재로 마감한다.`,
      `절단·정리 작업에는 적합한 고정장치와 전용 공구를 사용한다.`
    ];
    items.edu = [
      `${target} 취급 시 베임·찔림 위험 위치와 보호구 착용 기준을 교육한다.`,
      `예리한 자재 보관 및 이동 시 손 위치와 잡는 방법을 TBM으로 공유한다.`
    ];
  } else if (profile.id === "electric") {
    items.hazards = [
      `${target} 절연·접지 상태 불량으로 작업자가 감전될 위험`,
      `${cause} 누전 또는 전기화재가 발생할 위험`
    ];
    items.actions = [
      `${target} 절연·접지 상태와 누전차단기 작동 여부를 점검한다.`,
      `손상된 전선·콘센트를 교체하고 ${location} 습윤 구간 전기 사용을 제한한다.`
    ];
    items.admin = [
      `${target} 전기설비 점검 주기와 차단·검전 확인 절차를 관리기준에 반영한다.`,
      `전기작업은 관리감독자 확인 후 차단·검전 완료 상태에서 진행하도록 한다.`
    ];
    items.tech = [
      `${target} 손상부를 교체하고 절연·접지 상태를 보완한다.`,
      `${location} 습윤 구간에는 방수형 전기기기 또는 차단 조치를 적용한다.`
    ];
    items.edu = [
      `${target} 사용 전 손상 전선 확인과 감전 위험 신고 기준을 교육한다.`,
      `전기작업 전 차단·검전 절차와 젖은 손 사용금지 사항을 TBM으로 공유한다.`
    ];
  } else if (profile.id === "fall") {
    items.hazards = [
      `${target} 이용 또는 ${task || "고소작업"} 중 작업자가 떨어질 위험`,
      `${cause} 추락방지 조치가 부족해 작업자 추락 위험`
    ];
    items.actions = [
      `${target} 고정 상태를 점검하고 난간·덮개·미끄럼 방지 조치를 보완한다.`,
      `${task || "고소작업"} 전 추락방지 보호구 착용과 작업허가 확인을 실시한다.`
    ];
    items.admin = [
      `${target} 사용 전 점검항목과 추락방지 보호구 확인 절차를 운영한다.`,
      `${location} 추락 위험구간을 관리감독자가 작업 전 확인한다.`
    ];
    items.tech = [
      `${target}에 안전난간, 덮개 또는 미끄럼 방지 조치를 설치한다.`,
      `${location} 추락 위험구간에 출입제한 표시와 안전대 걸이설비를 확보한다.`
    ];
    items.edu = [
      `${target} 사용 전 점검사항과 추락위험 위치를 작업자에게 교육한다.`,
      `${task || "고소작업"} 시 보호구 착용과 접근금지 구역을 TBM으로 공유한다.`
    ];
  } else if (profile.id === "crush") {
    items.hazards = [
      `${target} 전도 또는 낙하로 작업자가 깔릴 위험`,
      `${cause} 하역·운반 중 작업자가 장비 또는 적재물에 노출될 위험`
    ];
    items.actions = [
      `${target} 적재 높이와 고정 상태를 점검하고 불안정한 적치를 재정리한다.`,
      `${location} 하역·운반 작업 반경을 구획하고 작업자 접근을 제한한다.`
    ];
    items.admin = [
      `${target} 적재 기준과 하역 작업 반경 출입통제 기준을 정해 관리한다.`,
      `중량물 운반 전 장비, 신호수, 작업동선 확인 절차를 운영한다.`
    ];
    items.tech = [
      `${target} 고정장치 또는 받침대를 사용해 전도를 방지한다.`,
      `${location} 장비 이동 동선과 보행자 동선을 분리한다.`
    ];
    items.edu = [
      `${target} 전도 위험과 안전한 적치 기준을 작업 전 공유한다.`,
      `하역·운반 작업 반경 접근금지와 신호수 지시 준수사항을 교육한다.`
    ];
  } else if (profile.id === "manual") {
    items.hazards = [
      `${target} 취급 중 무리한 자세 또는 중량물 부담으로 근골격계 손상 위험`,
      `${cause} 반복·운반 작업으로 허리와 어깨 부담이 누적될 위험`
    ];
    items.actions = [
      `${target} 운반 시 보조도구를 사용하고 2인 작업 기준을 적용한다.`,
      `${location} 보관 높이와 작업 위치를 조정해 허리 굽힘·비틀림 자세를 줄인다.`
    ];
    items.admin = [
      `${target} 중량물 취급 기준과 2인 작업 기준을 작업표준에 반영한다.`,
      `반복·무리작업에 대한 작업자 교대와 휴식 기준을 운영한다.`
    ];
    items.tech = [
      `${target} 보관 높이를 허리 높이에 맞추고 운반 보조도구를 비치한다.`,
      `${location} 운반동선을 정리해 들기·비틀기 동작을 줄인다.`
    ];
    items.edu = [
      `${target} 취급 시 올바른 들기 자세와 2인 작업 기준을 교육한다.`,
      `무리한 자세 발생 시 작업중지와 보조도구 사용 기준을 공유한다.`
    ];
  } else {
    items.hazards = [
      `${cause} 작업자가 ${location}에서 사고 위험에 노출될 가능성`,
      `${target} 관련 위험요인이 제거되지 않아 유사 사고가 반복될 위험`
    ];
    items.actions = [
      `${target}를 현장 확인 후 제거·차단·표시 조치한다.`,
      `${location} 유사 구간을 점검하고 개선사항을 작업 전 공유한다.`
    ];
    items.admin = [
      `${target} 위험요인을 작업 전 점검항목에 반영하고 관리감독자가 확인한다.`,
      `${location} 유사 장소에 수평전개 점검을 실시한다.`
    ];
    items.tech = [
      `${target} 위험 발생 부위에 제거·차단·보호재 설치 등 물리적 개선을 실시한다.`,
      `${location} 작업 동선과 설비 간섭부를 현장 확인 후 개선한다.`
    ];
    items.edu = [
      `${target} 관련 위험요인과 개선사항을 작업 전 TBM으로 공유한다.`,
      `${location} 개선 전후 사진을 활용해 동일 위험 재발방지 교육을 실시한다.`
    ];
  }

  return items;
}

function materializeExpertText(template, record) {
  const situation = getExpertSituation(record);
  return safeText(template)
    .replaceAll("{location}", situation.location)
    .replaceAll("{target}", situation.target)
    .replaceAll("{cause}", situation.cause)
    .replaceAll("{bodyPart}", situation.bodyPart)
    .replaceAll("{material}", situation.material || "화학물질")
    .replaceAll("{task}", situation.task || "해당 작업");
}

function getRelevantActionOptions(text, action, fallbackOptions) {
  const profile = getExpertSafetyProfile({
    type: text,
    location: "",
    process: "",
    summary: text,
    description: text,
    cause: text,
    action
  }, action);
  const options = profile.actions.map((item) => materializeExpertText(item, { location: "", process: "" }));
  const expertOptions = profile.matchScore ? options : [];
  return uniqueTextItems([...expertOptions, ...(fallbackOptions || [])]).slice(0, 4);
}

function buildRiskDrafts(record) {
  const assessed = assessRisk(record);
  const score = assessed.likelihood * assessed.severity;
  const profile = getExpertSafetyProfile(record);
  const owner = safeText(record.owner || record.author || "-");
  const dueDate = safeText(record.dueDate || record.date || "");
  const doneDate = safeText(record.completedDate || record.dueDate || record.date || "");
  const estimate = score >= 10 ? "보완" : "적정";
  const contextual = getContextualExpertItems(profile, record);
  const hazards = uniqueTextItems([...contextual.hazards, ...profile.hazards.map((item) => materializeExpertText(item, record))]);
  const actions = uniqueTextItems([...contextual.actions, ...profile.actions.map((item) => materializeExpertText(item, record))]);
  const draftLimit = profile.matchScore >= 99 ? 3 : profile.matchScore >= 3 ? 3 : 2;
  return uniqDrafts(hazards.map((hazard, index) => ({
    hazard,
    estimate,
    action: actions[index] || actions[0] || "현장 확인 후 위험요인을 제거하고 개선사항을 공유한다.",
    actionOptions: uniqueTextItems(actions).slice(0, 4),
    dueDate,
    doneDate,
    owner
  }))).slice(0, draftLimit);
}

function getSupervisorActionOptions(kind, record, currentAction) {
  const profile = getExpertSafetyProfile(record);
  const contextual = getContextualExpertItems(profile, record);
  const source = kind === "techAction" ? profile.tech : kind === "eduAction" ? profile.edu : profile.admin;
  const contextualSource = kind === "techAction" ? contextual.tech : kind === "eduAction" ? contextual.edu : contextual.admin;
  const options = [...contextualSource, ...source.map((item) => materializeExpertText(item, record))];
  return uniqueTextItems(options).slice(0, 4);
}

function getRiskGradeFromScore(score) {
  if (score >= 17) return "매우 높음";
  if (score >= 10) return "높음";
  if (score >= 5) return "보통";
  return "낮음";
}

function getReducedRiskScore(likelihood, severity) {
  const reducedLikelihood = Math.max(1, Number(likelihood || 1) - 1);
  const reducedSeverity = Math.max(1, Number(severity || 1) - (severity >= 4 ? 1 : 0));
  return reducedLikelihood * reducedSeverity;
}

function renderNearMissForm() {
  const summary = $("#nearMissFormSummary");
  const sheet = $("#nearMissFormSheet");
  syncSubmissionReviewVisibility();
  $$("#nearMissFormModeTabs button").forEach((button) => {
    button.classList.toggle("active", button.dataset.formMode === nearMissFormMode);
  });

  const record = getNearMissFormDraftRecord();
  if (!sheet) return;

  const adminAction = nearMissFormDraft.adminAction || compactSummary(record.action || "TBM 및 작업 전 위험요인 공유, 유사설비 수평전개를 실시한다.");
  const techAction = nearMissFormDraft.techAction || compactSummary(record.action || "위험부에 보호재 설치 또는 구조 변경을 검토하고 설비 상태를 보완한다.");
  const eduAction = nearMissFormDraft.eduAction || compactSummary(`작업 전 ${record.type || "위험요인"} 관련 교육 및 주의사항을 전파한다.`);
  const adminActionOptions = getSupervisorActionOptions("adminAction", record, adminAction);
  const techActionOptions = getSupervisorActionOptions("techAction", record, techAction);
  const eduActionOptions = getSupervisorActionOptions("eduAction", record, eduAction);
  const photoBefore = photoField("beforePhoto", "조치전 사진");
  const photoAfter = photoField("afterPhoto", "조치후 사진");
  const participants = nearMissFormDraft.participants || [record.author, record.owner].filter(Boolean).join(", ");
  const trainingDate = nearMissFormDraft.trainingDate || record.completedDate || record.date || "";
  const trainingContent = nearMissFormDraft.trainingContent || compactSummary(record.action || record.description || "-");
  const processLocation = draftField("location", nearMissFormDraft.location || nearMissFormDraft.process, { placeholder: "공정/장소/설비" });
  const riskDrafts = buildRiskDrafts(record).slice(0, 8);
  const annexDoneDate = record.completedDate || record.dueDate || record.date || "-";
  const effectivenessStatus = nearMissFormDraft.effectivenessStatus || "적합";
  const effectivenessDate = nearMissFormDraft.effectivenessDate || record.completedDate || record.date || "";
  const effectivenessNextDate = nearMissFormDraft.effectivenessNextDate || "";
  const riskRows = riskDrafts.map((draft, index) => {
    const savedDraft = Array.isArray(nearMissFormDraft.riskRows) ? nearMissFormDraft.riskRows[index] || {} : {};
    const hazard = savedDraft.hazard || draft.hazard;
    const estimate = savedDraft.estimate || draft.estimate || "보완";
    const action = Object.prototype.hasOwnProperty.call(savedDraft, "action") ? savedDraft.action : draft.action;
    const actionOptions = Array.isArray(savedDraft.actionOptions) && savedDraft.actionOptions.length ? savedDraft.actionOptions : (draft.actionOptions || []);
    const dueDate = savedDraft.dueDate || draft.dueDate || record.dueDate || record.date || "";
    const doneDate = savedDraft.doneDate || draft.doneDate || record.completedDate || record.date || "";
    const owner = savedDraft.owner || draft.owner;
    return `
    <tr>
      <td>${index + 1}</td>
      <td>${riskDraftField(index, "hazard", hazard, { multiline: true, rows: 2, placeholder: "유해위험요인" })}</td>
      <td>${riskEstimateCell(index, estimate, "적정")}</td>
      <td>${riskEstimateCell(index, estimate, "보완")}</td>
      <td>${riskEstimateCell(index, estimate, "해당없음")}</td>
      <td colspan="2" class="risk-action-cell" data-risk-action-cell="${index}">${riskActionField(index, action, actionOptions)}${renderRiskActionPopup(index, { ...draft, actionOptions })}</td>
      <td>${riskDateField(index, "dueDate", dueDate, "개선예정일")}</td>
      <td>${riskDateField(index, "doneDate", doneDate, "개선완료일")}</td>
      <td>${riskDraftField(index, "owner", owner, { placeholder: "담당자" })}</td>
    </tr>
  `;
  }).join("");

  if (summary) {
    const modeLabel = nearMissFormMode === "assessment" ? "자동 위험성평가" : nearMissFormMode === "preview" ? "출력 미리보기" : "발굴개선표";
    summary.innerHTML = [
      ["입력방식", "직접작성"],
      ["보기", modeLabel],
      ["부서", cleanDepartment(record.department)],
      ["사고유형", record.type || "-"],
      ["위험도", getRiskLevel(record)]
    ].map(([label, value]) => `<span class="mini-summary-item">${escapeHtml(label)} <strong>${escapeHtml(value)}</strong></span>`).join("");
  }

  sheet.innerHTML = `
    <div class="draft-paper">
      <div class="a4-sheet">
        <header class="a4-header">
          <div class="a4-title">아차사고 발굴·개선표</div>
          <div class="a4-approvals">
            <div class="approval-col"><span>작성</span>${stampField("approvalWriteStamp", "작성")}</div>
            <div class="approval-col"><span>검토</span>${stampField("approvalReviewStamp", "검토")}</div>
            <div class="approval-col"><span>승인</span>${stampField("approvalApproveStamp", "승인")}</div>
          </div>
        </header>

        <section class="a4-block">
          <div class="section-band">발굴자</div>
          <div class="section-main">
            <div class="info-grid two-col">
              <div class="info-item"><span>부서명</span><strong>${draftField("department", nearMissFormDraft.department, { placeholder: "부서명" })}</strong></div>
              <div class="info-item"><span>발굴자</span><strong>${draftField("author", nearMissFormDraft.author, { placeholder: "발굴자" })}</strong></div>
              <div class="info-item title-field"><span>사고명</span><strong>${draftField("summary", nearMissFormDraft.summary, { multiline: true, rows: 2, placeholder: "사고명" })}</strong></div>
              <div class="info-item"><span>작성자</span><strong>${draftField("owner", nearMissFormDraft.owner, { placeholder: "작성자" })}</strong></div>
              <div class="info-item"><span>일시</span><strong>${draftField("date", nearMissFormDraft.date, { type: "date" })}</strong></div>
              <div class="info-item"><span>공정·장소·설비</span><strong>${processLocation}</strong></div>
            </div>

            <div class="narrative-list">
              <div class="narrative-item">
                <label>사고개요<br><span>(원인)</span></label>
                <div>${draftField("description", nearMissFormDraft.description, { multiline: true, rows: 2, placeholder: "사고개요를 입력" })}</div>
              </div>
              <div class="narrative-item">
                <label>위험요인<br><span>(예상피해)</span></label>
                <div>${draftField("cause", nearMissFormDraft.cause, { multiline: true, rows: 2, placeholder: "위험요인 또는 예상피해" })}</div>
              </div>
              <div class="narrative-item">
                <label>개선대책<br><span>(의견)</span></label>
                <div>${draftField("action", nearMissFormDraft.action, { multiline: true, rows: 2, placeholder: "개선대책 또는 조치내용" })}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="a4-block">
          <div class="section-band">관리감독자</div>
          <div class="section-main">
            <div class="risk-plan">
              <div class="risk-plan-title">개선대책<br><span>(위험성 평가)</span></div>
              <div class="risk-plan-rows">
                <div class="risk-row"><span>관리적</span><div>${supervisorActionField("adminAction", adminAction, "관리적", adminActionOptions)}</div></div>
                <div class="risk-row"><span>기술적</span><div>${supervisorActionField("techAction", techAction, "기술적", techActionOptions)}</div></div>
                <div class="risk-row"><span>교육적</span><div>${supervisorActionField("eduAction", eduAction, "교육적", eduActionOptions)}</div></div>
              </div>
            </div>
            <div class="owner-row">
              <div class="info-item"><span>담당자</span><strong>${draftField("owner", nearMissFormDraft.owner || nearMissFormDraft.author, { placeholder: "담당자" })}</strong></div>
              <div class="info-item"><span>완료일</span><strong>${draftField("completedDate", nearMissFormDraft.completedDate, { type: "date" })}</strong></div>
            </div>
          </div>
        </section>

        <section class="a4-block photo-block">
          <div class="section-band">개선사진</div>
          <div class="section-main">
            <div class="photo-grid">
              <div class="photo-box">
                <div class="photo-box-head">조치전</div>
                <div class="photo-box-body">${photoBefore}</div>
              </div>
              <div class="photo-box">
                <div class="photo-box-head">조치후</div>
                <div class="photo-box-body">${photoAfter}</div>
              </div>
            </div>
          </div>
        </section>

        <section class="a4-block edu-block">
          <div class="section-band">전달교육</div>
          <div class="section-main">
            <div class="info-grid edu-grid">
              <div class="info-item"><span>교육일시</span><strong>${draftField("trainingDate", trainingDate, { placeholder: "교육일시" })}</strong></div>
              <div class="info-item wide"><span>교육내용</span><strong>${draftField("trainingContent", trainingContent, { multiline: true, rows: 1, placeholder: "교육내용" })}</strong></div>
              <div class="info-item wide full"><span>참석자<br><small>(서명)</small></span><strong>${draftField("participants", participants, { multiline: true, rows: 2, placeholder: "참석자 또는 서명자" })}</strong></div>
            </div>
          </div>
        </section>
      </div>
    </div>
    <div class="draft-paper annex-paper">
      <div class="risk-annex-sheet">
        <header class="risk-annex-header">
          <h3>체크리스트 위험성평가표</h3>
          <div class="risk-annex-meta">
            <div><span>평가공정</span><strong>${escapeHtml(record.process || record.location || "-")}</strong></div>
            <div><span>평가일시</span><strong>${escapeHtml(record.completedDate || record.date || "-")}</strong></div>
            <div><span>평가자</span><strong>${escapeHtml(record.owner || record.author || "-")}</strong></div>
          </div>
        </header>

        <table class="risk-annex-table">
          <colgroup>
            <col class="annex-no">
            <col class="annex-hazard">
            <col class="annex-check">
            <col class="annex-check">
            <col class="annex-check">
            <col class="annex-action-main">
            <col class="annex-action-side">
            <col class="annex-date">
            <col class="annex-date">
            <col class="annex-owner">
          </colgroup>
          <thead>
            <tr>
              <th colspan="2">유해위험요인 조사</th>
              <th colspan="5">위험성 추정결정 및 감소대책 수립</th>
              <th colspan="3">이행확인</th>
            </tr>
            <tr>
              <th>번호</th>
              <th>유해위험요인</th>
              <th>적정</th>
              <th>보완</th>
              <th>해당<br>없음</th>
              <th colspan="2">위험성 감소대책</th>
              <th>개선<br>예정일</th>
              <th>개선<br>완료일</th>
              <th>담당자</th>
            </tr>
          </thead>
          <tbody>
            ${riskRows}
            ${Array.from({ length: Math.max(0, 8 - riskDrafts.length) }, () => `
              <tr class="blank-row"><td></td><td></td><td></td><td></td><td></td><td colspan="2"></td><td></td><td></td><td></td></tr>
            `).join("")}
          </tbody>
        </table>

        <table class="risk-annex-measures">
          <colgroup>
            <col class="annex-no">
            <col class="annex-hazard">
            <col class="annex-check">
            <col class="annex-check">
            <col class="annex-check">
            <col class="annex-action-main">
            <col class="annex-action-side">
            <col class="annex-date">
            <col class="annex-date">
            <col class="annex-owner">
          </colgroup>
          <tbody>
            <tr><th rowspan="3">개선대책</th><td class="measure-label" colspan="2">관리적 예방대책</td><td class="measure-body" colspan="7">${escapeHtml(adminAction)}</td></tr>
            <tr><td class="measure-label" colspan="2">기술적 예방대책</td><td class="measure-body" colspan="7">${escapeHtml(techAction)}</td></tr>
            <tr><td class="measure-label" colspan="2">교육적 예방대책</td><td class="measure-body" colspan="7">${escapeHtml(eduAction)}</td></tr>
            <tr>
              <th class="effectiveness-label" colspan="3">유효성 평가</th>
              <td class="effectiveness-body" colspan="7">
                <div class="effectiveness-controls">
                  <span class="effectiveness-option">${effectivenessCheckCell(effectivenessStatus, "적합")} 적합</span>
                  <span class="effectiveness-date-group">확인일 ${effectivenessDateField("effectivenessDate", effectivenessDate)}</span>
                  <span class="effectiveness-option">${effectivenessCheckCell(effectivenessStatus, "부적합")} 부적합</span>
                  <span class="effectiveness-date-group">차기확인일 ${effectivenessDateField("effectivenessNextDate", effectivenessNextDate)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  if (nearMissFormMode === "form") {
    sheet.querySelector(".annex-paper")?.remove();
  } else if (nearMissFormMode === "assessment") {
    sheet.querySelector(".draft-paper:not(.annex-paper)")?.remove();
  }
}

function renderActions() {
  const statuses = [K.received, K.inProgress, K.review, K.done];
  const board = $("#actionBoard");
  if (!board) return;
  board.innerHTML = statuses.map((status) => {
    const rows = filteredRecords().filter((row) => row.status === status || (status === K.inProgress && isLate(row)));
    return `
      <section class="action-column">
        <h3>${status} ${rows.length}</h3>
        ${rows.map((row) => `
          <button class="action-card" type="button" data-edit="${row.id}">
            <strong>${escapeHtml(row.action || row.description)}</strong>
            <span class="work-meta">${escapeHtml(row.id)} 쨌 ${escapeHtml(row.owner || "\uB2F4\uB2F9 \uBBF8\uC9C0\uC815")}</span>
            <span class="work-meta">\uAE30\uD55C ${escapeHtml(row.dueDate || "-")} 쨌 ${badge(displayStatus(row), displayStatus(row) === K.delayed ? "late" : "")}</span>
          </button>
        `).join("") || `<p class="work-meta">${K.none}</p>`}
      </section>
    `;
  }).join("");
}

function renderRiskPicks() {
  const list = $("#riskPickList");
  const caption = $("#riskPickCaption");
  if (!list || !caption) return;

  const selectedMonth = safeText($("#monthFilter")?.value || "all");
  const sourceRows = riskPickFilteredRows();
  const defaultPeriod = getDefaultRiskPickPeriod(sourceRows);
  const targetMonth = selectedMonth === "all" ? defaultPeriod.month : selectedMonth;
  const picks = getMonthlyRiskAssessmentPicks(sourceRows, 2, targetMonth, defaultPeriod.year);
  const monthHint = picks.sourceCount
    ? `${picks.year}년 ${picks.month} 제출 기준 ${picks.sourceCount}건 중 별도 등록 추천`
    : `${picks.year}년 ${picks.month} 제출 자료가 없어 현재 조건의 고위험 항목 기준으로 추천`;
  caption.textContent = `${monthHint} · 상위 ${picks.items.length}건`;

  if (!picks.items.length) {
    list.innerHTML = `<div class="risk-pick-empty">추천할 위험성평가 대상이 없습니다.</div>`;
    return;
  }

  list.innerHTML = picks.items.map(({ row, score, reasons }, index) => {
    const assessed = assessRisk(row);
    const riskScore = assessed.likelihood * assessed.severity;
    const reasonChips = (reasons.length ? reasons : ["월별 위험성평가 등록 후보"])
      .map((reason) => `<span>${escapeHtml(reason)}</span>`)
      .join("");
    return `
      <article class="risk-pick-card rank-${index + 1}">
        <div class="risk-pick-head">
          <span class="risk-pick-rank">${index + 1}</span>
          <div>
            <strong>${escapeHtml(cleanDepartment(row.department))} · ${escapeHtml(normalizeAccidentType(row.type) || "기타")}</strong>
            <p>${escapeHtml(row.location || row.process || "-")}</p>
          </div>
          ${badge(`${getRiskLevel(row)} ${riskScore}`)}
        </div>
        <p class="risk-pick-desc">${escapeHtml(row.description || row.action || "-")}</p>
        <div class="risk-pick-reasons">${reasonChips}</div>
        <div class="risk-pick-foot">
          <span>추천점수 ${escapeHtml(score)} · 제출 ${escapeHtml(getRecordReportYear(row) || "-")}년 ${escapeHtml(getRecordReportMonth(row) || "-")}</span>
          <button class="btn small" type="button" data-risk-target="${escapeHtml(row.id)}">위험성평가 보기</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderRisk() {
  const rows = filteredRecords();
  $("#riskSummary").innerHTML = [
    [K.all, rows.length],
    [K.critical, rows.filter((row) => getRiskLevel(row) === K.critical).length],
    [K.high, rows.filter((row) => getRiskLevel(row) === K.high).length],
    [K.medium, rows.filter((row) => getRiskLevel(row) === K.medium).length],
    [K.low, rows.filter((row) => getRiskLevel(row) === K.low).length]
  ].map(([label, value]) => `<span class="mini-summary-item">${label} <strong>${value}</strong></span>`).join("");
  renderRiskPicks();
  $("#riskRows").innerHTML = rows.map((row, index) => {
    const assessed = assessRisk(row);
    const score = assessed.likelihood * assessed.severity;
    return `
      <tr data-risk-row="${escapeHtml(row.id)}">
        <td>${index + 1}</td>
        <td>${escapeHtml(row.process || row.location)}</td>
        <td>${escapeHtml(row.description)}</td>
        <td>${escapeHtml(row.action || "-")}</td>
        <td>${escapeHtml(assessed.likelihood)}</td>
        <td>${escapeHtml(assessed.severity)}</td>
        <td>${badge(`${getRiskLevel(row)} ${score}`)}</td>
      </tr>
    `;
  }).join("");
}

function renderSettings() {
  $("#typeChips").innerHTML = TYPES.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  $("#causeChips").innerHTML = CAUSES.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
  renderDepartmentStampList();
}

function renderDepartmentStampList() {
  const list = $("#departmentStampList");
  if (!list) return;
  const entries = Object.entries(safetySettings.departmentStamps || {}).sort(([a], [b]) => a.localeCompare(b, "ko"));
  if (!entries.length) {
    list.innerHTML = `<div class="empty-state">등록된 부서 도장이 없습니다.</div>`;
    return;
  }
  list.innerHTML = entries.map(([department, stamps]) => `
    <div class="department-stamp-row">
      <strong>${escapeHtml(department)}</strong>
      <div class="department-stamp-preview"><span>작성</span>${stamps.write ? `<img src="${escapeHtml(stamps.write)}" alt="작성 도장">` : "<em>-</em>"}</div>
      <div class="department-stamp-preview"><span>검토</span>${stamps.review ? `<img src="${escapeHtml(stamps.review)}" alt="검토 도장">` : "<em>-</em>"}</div>
      <div class="department-stamp-preview"><span>승인</span>${stamps.approve ? `<img src="${escapeHtml(stamps.approve)}" alt="승인 도장">` : "<em>-</em>"}</div>
      <button class="btn small ghost" data-department-stamp-remove="${escapeHtml(department)}" type="button">삭제</button>
    </div>
  `).join("");
}

function updateDepartmentFilter() {
  const select = $("#departmentFilter");
  if (!select) return;
  const current = select.value || "all";
  const departments = Array.from(new Set(records.map((row) => cleanDepartment(row.department)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"));
  select.innerHTML = [`<option value="all">${K.all}</option>`, ...departments.map((department) => `<option value="${escapeHtml(department)}">${escapeHtml(department)}</option>`)].join("");
  select.value = departments.includes(current) ? current : "all";
}

function updateYearFilter() {
  const select = $("#yearFilter");
  if (!select) return;
  const current = select.value || "all";
  const years = Array.from(new Set(records.map(getRecordYear).filter(Boolean))).sort((a, b) => b.localeCompare(a));
  select.innerHTML = [`<option value="all">${K.all}</option>`, ...years.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`)].join("");
  select.value = years.includes(current) ? current : "all";
}

function updateMonthFilter() {
  const select = $("#monthFilter");
  if (!select) return;
  const current = select.value || "all";
  const months = Array.from(new Set(records.map(getRecordMonth).filter(Boolean))).sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
  select.innerHTML = [`<option value="all">${K.all}</option>`, ...months.map((month) => `<option value="${escapeHtml(month)}">${escapeHtml(month)}</option>`)].join("");
  select.value = months.includes(current) ? current : "all";
}

function populateReportFilters() {
  const fillYear = (selector, value) => {
    const select = $(selector);
    if (!select) return;
    select.innerHTML = [`<option value="all">${K.all}</option>`, ...DASHBOARD_YEARS.slice().reverse().map((year) => `<option value="${year}">${year}\uB144</option>`)].join("");
    select.value = value;
  };
  const fillMonth = (selector, value) => {
    const select = $(selector);
    if (!select) return;
    select.innerHTML = [`<option value="all">${K.all}</option>`, ...Array.from({ length: 12 }, (_, index) => {
      const month = `${index + 1}\uC6D4`;
      return `<option value="${month}">${month}</option>`;
    })].join("");
    select.value = value;
  };
  fillYear("#deptReportYearSelect", deptReportYearFilter);
  fillMonth("#deptReportMonthSelect", deptReportMonthFilter);
  fillYear("#typeReportYearSelect", typeReportYearFilter);
  fillMonth("#typeReportMonthSelect", typeReportMonthFilter);
}

function renderAll() {
  try {
    records = records.map(normalizeRecord);
    updateDepartmentFilter();
    updateYearFilter();
    updateMonthFilter();
      populateReportFilters();
      renderDashboard();
      renderReports();
      renderNearMiss();
      renderIncident();
      renderNearMissForm();
      renderActions();
      renderRisk();
      renderSettings();
    bindEditButtons();
  } catch (error) {
    console.error("renderAll failed:", error);
    setAiStatus(`render error: ${error.message}`, "error");
  }
}

function nextId(kind) {
  const prefix = kind === "incident" ? "IC" : "NM";
  const year = new Date().getFullYear();
  const max = records
    .filter((row) => safeText(row.id).startsWith(`${prefix}-${year}-`))
    .map((row) => Number(safeText(row.id).split("-").pop()))
    .filter(Number.isFinite)
    .reduce((value, current) => Math.max(value, current), 0);
  return `${prefix}-${year}-${String(max + 1).padStart(3, "0")}`;
}

function populateSelects() {
  const typeSelect = $('[name="type"]');
  const causeSelect = $('[name="cause"]');
  const draftTypeSelect = $('[data-near-miss-draft="type"]');
  if (typeSelect) typeSelect.innerHTML = TYPES.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  if (causeSelect) causeSelect.innerHTML = CAUSES.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  if (draftTypeSelect) draftTypeSelect.innerHTML = TYPES.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
  const dashboardYearSelect = $("#dashboardYearSelect");
  if (dashboardYearSelect) {
    dashboardYearSelect.innerHTML = [`<option value="all">${K.all}</option>`, ...DASHBOARD_YEARS.slice().reverse().map((year) => `<option value="${year}">${year}\uB144</option>`)].join("");
    dashboardYearSelect.value = dashboardTrendYear;
  }
}

function updateDialogLabels() {
  const form = $("#recordForm");
  const kind = form && form.elements.kind ? form.elements.kind.value : "nearMiss";
  const actionLabel = $("#actionLabel");
  const summaryLabel = $("#summaryLabel");
  const summaryInput = $("#summaryInput");
  if (actionLabel) {
    actionLabel.textContent = kind === "incident"
      ? "\uC7AC\uBC1C\uBC29\uC9C0 \uB300\uCC45 / \uAC1C\uC120\uC870\uCE58"
      : "\uAC1C\uC120\uC870\uCE58";
  }
  if (summaryLabel && summaryInput) {
    const isIncident = kind === "incident";
    summaryLabel.hidden = !isIncident;
    summaryInput.hidden = !isIncident;
    summaryInput.required = false;
  }
}

function openDialog(record = null) {
  editingId = record && record.id ? record.id : null;
  const form = $("#recordForm");
  if (!form) return;
  form.reset();
  $("#dialogTitle").textContent = record ? "\uC548\uC804 \uAE30\uB85D \uC0C1\uC138" : "\uC548\uC804 \uAE30\uB85D \uB4F1\uB85D";
  $("#deleteRecordBtn").style.display = record ? "" : "none";
  const values = record || {
    kind: "nearMiss",
    company: K.oyoung,
    date: today(),
    likelihood: 3,
    severity: 3,
    reportYear: getCurrentReportYear(),
    reportMonth: getCurrentReportMonth(),
    status: K.received
  };
  values.reportYear = getRecordReportYear(values) || getCurrentReportYear();
  values.reportMonth = getRecordReportMonth(values) || getCurrentReportMonth();
  Object.entries(values).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value ?? "";
  });
  updateDialogLabels();
  setRecordDialogReadonly(IS_DEPARTMENT_MODE);
  $("#recordDialog").showModal();
}

function setRecordDialogReadonly(readonly) {
  const form = $("#recordForm");
  if (!form) return;
  form.querySelectorAll("input, select, textarea").forEach((field) => {
    field.disabled = Boolean(readonly);
  });
  $("#saveRecordBtn") && ($("#saveRecordBtn").disabled = Boolean(readonly));
  $("#deleteRecordBtn") && ($("#deleteRecordBtn").disabled = Boolean(readonly));
}

function formToRecord() {
  const form = $("#recordForm");
  const data = Object.fromEntries(new FormData(form).entries());
  const existing = records.find((row) => row.id === editingId);
  return normalizeRecord({
    ...(existing || {}),
    ...data,
    id: editingId || nextId(data.kind),
    reportYear: normalizeRecordYear(data.reportYear) || getCurrentReportYear(),
    reportMonth: normalizeRecordMonth(data.reportMonth) || getCurrentReportMonth(),
    likelihood: Number(data.likelihood || 3),
    severity: Number(data.severity || 3),
    updatedAt: new Date().toISOString()
  });
}

async function saveFromDialog() {
  if (IS_DEPARTMENT_MODE) {
    alert("부서용에서는 관리 데이터를 수정할 수 없습니다. 양식시안 입력만 가능합니다.");
    return;
  }
  const form = $("#recordForm");
  if (!form || !form.reportValidity()) return;
  const record = formToRecord();
  const index = records.findIndex((row) => row.id === record.id);
  if (index >= 0) records[index] = record;
  else records.unshift(record);
  await saveRecords();
  $("#recordDialog").close();
  renderAll();
  switchView(record.kind === "incident" ? "incident" : "nearMiss");
}

async function deleteCurrentRecord() {
  if (IS_DEPARTMENT_MODE) {
    alert("부서용에서는 관리 데이터를 삭제할 수 없습니다.");
    return;
  }
  if (!editingId) return;
  const record = records.find((row) => row.id === editingId);
  if (!record) return;
  const label = `${record.id} ${record.department || ""} ${record.type || ""}`.trim();
  if (!confirm(`${label} \uAE30\uB85D\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?`)) return;
  records = records.filter((row) => row.id !== editingId);
  await saveRecords();
  $("#recordDialog").close();
  editingId = null;
  renderAll();
}

function getVisibleRecordsForActiveView() {
  const rows = filteredRecords();
  if (activeView === "nearMiss") {
    return rows.filter((row) => row.kind === "nearMiss" && (nearMissCompanyFilter === "all" || companyKey(row) === nearMissCompanyFilter));
  }
  if (activeView === "incident") {
    return rows.filter((row) => row.kind === "incident" && (incidentCompanyFilter === "all" || companyKey(row) === incidentCompanyFilter));
  }
  return rows;
}

  function getActiveViewLabel() {
    const labels = {
      dashboard: K.dashboard,
      nearMiss: nearMissCompanyFilter === "all" ? `${K.nearMiss} ${K.all}` : `${K.nearMiss} ${nearMissCompanyFilter === "sem" ? K.sem : K.oyoung}`,
      incident: incidentCompanyFilter === "all" ? `${K.incident} ${K.all}` : `${K.incident} ${incidentCompanyFilter === "sem" ? K.sem : K.oyoung}`,
      nearMissForm: K.nearMissForm,
      risk: K.risk,
      reports: K.reports,
      settings: K.settings
  };
  return labels[activeView] || "\uD604\uC7AC \uD654\uBA74";
}

async function bulkDeleteVisibleRecords() {
  if (IS_DEPARTMENT_MODE) {
    alert("부서용에서는 관리 데이터를 삭제할 수 없습니다.");
    return;
  }
  const targets = getVisibleRecordsForActiveView();
  if (!targets.length) {
    alert("\uC0AD\uC81C\uD560 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
    return;
  }
  const message = `${getActiveViewLabel()}\uC5D0 \uD45C\uC2DC\uB418\uB294 ${targets.length}\uAC74\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?\n\n\uD604\uC7AC \uAC80\uC0C9/\uD544\uD130 \uACB0\uACFC\uB9CC \uC0AD\uC81C\uB429\uB2C8\uB2E4.`;
  if (!confirm(message)) return;
  const targetIds = new Set(targets.map((row) => row.id));
  records = records.filter((row) => !targetIds.has(row.id));
  await saveRecords();
  renderAll();
}

function toCsv(rows) {
  const headers = ["id", "kind", "company", "date", "reportYear", "reportMonth", "department", "author", "location", "process", "type", "cause", "victim", "claimType", "riskLevel", "riskScore", "status", "dueDate", "owner", "description", "action"];
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    const enriched = { ...row, riskLevel: getRiskLevel(row), riskScore: getRiskScore(row) };
    lines.push(headers.map((key) => `"${safeText(enriched[key]).replaceAll('"', '""')}"`).join(","));
  });
  return "\uFEFF" + lines.join("\n");
}

function download(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function openShareDialog() {
  const now = new Date();
  const defaultName = `안전사고통합관리_공유_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const nameInput = $("#shareFileName");
  if (nameInput) nameInput.value = defaultName;
  const normalized = records.map(normalizeRecord);
  $("#shareStatTotal").textContent = normalized.length;
  $("#shareStatNearMiss").textContent = normalized.filter((row) => row.kind === "nearMiss").length;
  $("#shareStatIncident").textContent = normalized.filter((row) => row.kind === "incident").length;
  $("#shareModal")?.classList.add("open");
}

function closeShareDialog() {
  $("#shareModal")?.classList.remove("open");
}

function buildStandaloneSafetyShareHtml(fileTitle, rows) {
  const safeTitle = escapeHtml(fileTitle || "아차사고 발굴대장 공유");
  const dataJson = JSON.stringify(rows.map(normalizeRecord).filter((row) => row.kind === "nearMiss")).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    :root { --bg:#f2f5f9; --surface:#fff; --soft:#f7f9fc; --border:#dbe3ec; --accent:#184e9e; --accent-strong:#143f80; --text:#172539; --muted:#64748b; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:"Malgun Gothic","Segoe UI",sans-serif; font-size:14px; }
    header { background:#2d55a0; color:#fff; padding:16px 20px; }
    header p { margin:0 0 4px; font-size:11px; color:rgba(255,255,255,.72); font-weight:700; }
    header h1 { margin:0; font-size:22px; }
    main { position:relative; padding:18px 20px 28px; }
    .section-head { display:block; margin-bottom:10px; padding-right:330px; }
    h2 { margin:0 0 10px; font-size:18px; }
    .segmented { display:inline-flex; border:1px solid #cbd6e2; border-radius:4px; overflow:hidden; background:#fff; margin:0 0 8px; }
    .segmented button { min-width:68px; min-height:30px; border:0; border-right:1px solid #cbd6e2; background:#fff; color:#18304d; font-weight:800; cursor:pointer; }
    .segmented button:last-child { border-right:0; }
    .segmented button.active { background:#1f4f9f; color:#fff; }
    .summary { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:6px; }
    .chip { border:1px solid var(--border); background:#fff; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:700; }
    .chip strong { color:var(--accent); }
    .toolbar { display:grid; grid-template-columns: 360px 180px 130px 120px; align-items:end; justify-content:start; gap:10px; margin-bottom:12px; padding:12px; border:1px solid var(--border); border-radius:6px; background:#eaf0f7; }
    label { display:grid; gap:5px; color:#30445f; font-size:12px; font-weight:700; }
    input, select { width:100%; min-height:38px; border:1px solid #cbd6e2; border-radius:6px; padding:0 10px; background:#fff; color:var(--text); }
    .table-wrap { border:1px solid var(--border); border-radius:8px; overflow:auto; background:#fff; }
    table { width:100%; min-width:1320px; border-collapse:collapse; table-layout:fixed; }
    th, td { border-bottom:1px solid #e5ebf2; padding:9px 10px; text-align:left; vertical-align:middle; }
    th { background:#f4f7fb; font-size:12px; white-space:nowrap; }
    td { font-size:13px; line-height:1.45; word-break:keep-all; overflow-wrap:normal; }
    th:nth-child(1), td:nth-child(1) { width:52px; white-space:nowrap; text-align:center; }
    th:nth-child(2), td:nth-child(2) { width:70px; white-space:nowrap; }
    th:nth-child(3), td:nth-child(3) { width:108px; white-space:nowrap; }
    th:nth-child(4), td:nth-child(4) { width:104px; white-space:nowrap; }
    th:nth-child(5), td:nth-child(5) { width:82px; white-space:nowrap; }
    th:nth-child(6), td:nth-child(6) { width:124px; white-space:normal; overflow-wrap:anywhere; }
    th:nth-child(7), td:nth-child(7) { width:628px; white-space:normal; word-break:keep-all; overflow-wrap:anywhere; }
    th:nth-child(8), td:nth-child(8) { width:96px; white-space:nowrap; }
    th:nth-child(9), td:nth-child(9) { width:56px; white-space:nowrap; text-align:center; }
    .badge { display:inline-flex; align-items:center; justify-content:center; min-width:44px; border-radius:999px; padding:4px 8px; font-size:12px; font-weight:800; background:#e9f0fb; color:#143f80; }
    .detail-cell { cursor:pointer; }
    .detail-cell:hover { background:#eef5ff; color:#143f80; }
    .높음, .중대 { background:#f5ebd6; color:#9c4f14; }
    .보통 { background:#e8f5f4; color:#0f766e; }
    .낮음 { background:#eef4ff; color:#184e9e; }
    .share-actions { position:absolute; top:18px; right:20px; display:flex; align-items:end; justify-content:flex-end; gap:8px; white-space:nowrap; }
    .share-tool-btn { min-height:36px; border:1px solid #0f766e; border-radius:6px; background:#0f766e; color:#fff; padding:0 14px; font-weight:800; cursor:pointer; box-shadow:0 2px 7px rgba(15,118,110,.18); }
    .share-tool-btn:hover, .share-tool-btn.active { background:#0b5f59; border-color:#0b5f59; }
    .stats-modal { position:fixed; inset:0; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(15,23,42,.45); z-index:50; }
    .stats-modal.open { display:flex; }
    .stats-panel { width:min(720px, 100%); max-height:min(720px, 86vh); overflow:auto; padding:18px; border:1px solid var(--border); border-radius:8px; background:#fff; box-shadow:0 24px 70px rgba(15,23,42,.22); }
    .stats-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
    .stats-head h3 { margin:0; font-size:16px; }
    .stats-head span { color:var(--muted); font-size:12px; font-weight:700; }
    .stats-close { min-width:32px; min-height:32px; border:1px solid #cbd6e2; border-radius:6px; background:#fff; color:#17345b; font-weight:900; cursor:pointer; }
    .detail-modal { position:fixed; inset:0; display:none; align-items:center; justify-content:center; padding:20px; background:rgba(15,23,42,.45); z-index:60; }
    .detail-modal.open { display:flex; }
    .detail-panel { width:min(760px, 100%); max-height:min(760px, 88vh); overflow:auto; padding:18px; border:1px solid var(--border); border-radius:8px; background:#fff; box-shadow:0 24px 70px rgba(15,23,42,.22); }
    .detail-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding-bottom:12px; border-bottom:1px solid var(--border); }
    .detail-head h3 { margin:0; font-size:17px; }
    .detail-head p { margin:5px 0 0; color:var(--muted); font-size:12px; font-weight:700; }
    .detail-grid { display:grid; gap:12px; margin-top:14px; }
    .detail-block { border:1px solid var(--border); border-radius:8px; background:#f8fafc; padding:12px; }
    .detail-block strong { display:block; margin-bottom:7px; color:#17345b; font-size:13px; }
    .detail-block p { margin:0; line-height:1.65; white-space:pre-wrap; word-break:keep-all; overflow-wrap:anywhere; }
    .detail-list { margin:0; padding-left:20px; display:grid; gap:7px; line-height:1.55; word-break:keep-all; overflow-wrap:anywhere; }
    .stats-filters { display:grid; grid-template-columns:150px 130px; gap:10px; margin:0 0 12px; padding:10px; border:1px solid var(--border); border-radius:6px; background:#f4f7fb; }
    .bar-list { display:grid; gap:7px; }
    .bar-row { display:grid; grid-template-columns:44px 140px 1fr 46px; align-items:center; gap:10px; min-height:28px; padding:2px 0; }
    .rank-badge { display:inline-flex; align-items:center; justify-content:center; min-width:34px; min-height:22px; border-radius:999px; border:1px solid #d8e1ec; background:#f8fafc; color:#64748b; font-size:11px; font-weight:900; }
    .bar-row.rank-1 .rank-badge { border-color:#f0c35a; background:#fff4c7; color:#8a5b00; }
    .bar-row.rank-2 .rank-badge { border-color:#c8d3df; background:#eef2f7; color:#40546b; }
    .bar-row.rank-3 .rank-badge { border-color:#d7a06b; background:#fbe7d2; color:#854d16; }
    .bar-row.rank-1 .bar-fill { background:#d79a17; }
    .bar-row.rank-2 .bar-fill { background:#64748b; }
    .bar-row.rank-3 .bar-fill { background:#c56a28; }
    .bar-label { font-size:13px; font-weight:700; white-space:nowrap; }
    .bar-track { height:12px; border-radius:999px; background:#edf2f7; overflow:hidden; }
    .bar-fill { height:100%; border-radius:999px; background:#0f766e; }
    .bar-count { text-align:right; font-size:13px; font-weight:800; }
    .empty { padding:36px; text-align:center; color:var(--muted); }
    @media (max-width:900px) { .section-head { padding-right:0; } .share-actions { position:static; justify-content:flex-start; margin:8px 0 10px; } .toolbar { grid-template-columns:1fr 1fr; } main { padding:12px; } }
  </style>
</head>
<body>
  <header>
    <p>ESQ Safety Registry · 공유 전용</p>
    <h1>안전사고 통합관리</h1>
  </header>
  <main>
    <div class="section-head">
      <div>
      <h2>아차사고 발굴대장</h2>
      <div class="segmented" id="companyTabs">
        <button class="active" data-company="all" type="button">전체</button>
        <button data-company="오영" type="button">오영</button>
        <button data-company="SEM" type="button">SEM</button>
      </div>
      <div class="summary">
        <span class="chip">전체 <strong id="totalCount">0</strong></span>
        <span class="chip">오영 <strong id="oyoungCount">0</strong></span>
        <span class="chip">SEM <strong id="semCount">0</strong></span>
        <span class="chip">현재 표시 <strong id="visibleCount">0</strong></span>
        <span class="chip">검색/필터 결과 <strong id="filteredCount">0</strong></span>
      </div>
      </div>
    <div class="share-actions">
      <button class="share-tool-btn" data-stats="type" type="button" aria-expanded="false">재해유형별 통계</button>
      <button class="share-tool-btn" data-stats="department" type="button" aria-expanded="false">부서별 통계</button>
    </div>
    </div>
    <div class="toolbar">
      <label><span>검색</span><input id="searchInput" placeholder="부서, 장소, 유형, 내용"></label>
      <label><span>부서별</span><select id="departmentFilter"><option value="all">전체</option></select></label>
      <label><span>연도별</span><select id="yearFilter"><option value="all">전체</option></select></label>
      <label><span>월별</span><select id="monthFilter"><option value="all">전체</option></select></label>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>NO.</th>
            <th>발생월</th>
            <th>발생일</th>
            <th>발생부서</th>
            <th>발굴자</th>
            <th>장소/설비</th>
            <th>재해내용</th>
            <th>사고유형</th>
            <th>위험도</th>
          </tr>
        </thead>
        <tbody id="rowsBody"></tbody>
      </table>
    </div>
  </main>
  <div class="stats-modal" id="statsModal" role="dialog" aria-modal="true" aria-labelledby="statsTitle">
    <section class="stats-panel">
      <div class="stats-head">
        <div>
          <h3 id="statsTitle">재해유형별 통계</h3>
          <span>현재 조건 기준</span>
        </div>
        <button class="stats-close" id="statsCloseBtn" type="button" aria-label="닫기">X</button>
      </div>
      <div class="stats-filters">
        <label><span>연도</span><select id="statsYearFilter"><option value="all">전체</option></select></label>
        <label><span>월</span><select id="statsMonthFilter"><option value="all">전체</option></select></label>
      </div>
      <div class="bar-list" id="typeStats"></div>
    </section>
  </div>
  <div class="detail-modal" id="detailModal" role="dialog" aria-modal="true" aria-labelledby="detailTitle">
    <section class="detail-panel">
      <div class="detail-head">
        <div>
          <h3 id="detailTitle">아차사고 상세</h3>
          <p id="detailMeta">재해내용을 더블클릭하면 상세정보를 확인할 수 있습니다.</p>
        </div>
        <button class="stats-close" id="detailCloseBtn" type="button" aria-label="닫기">X</button>
      </div>
      <div class="detail-grid">
        <div class="detail-block">
          <strong>재해내용</strong>
          <p id="detailDescription">-</p>
        </div>
        <div class="detail-block">
          <strong>유해위험요인</strong>
          <ol class="detail-list" id="detailHazard"></ol>
        </div>
        <div class="detail-block">
          <strong>위험성 감소대책</strong>
          <ol class="detail-list" id="detailAction"></ol>
        </div>
      </div>
    </section>
  </div>
  <script>
    const rows = ${dataJson};
    const esc = (value) => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
    const riskLevel = (row) => {
      const score = Math.max(1, Math.min(5, Number(row.likelihood) || 1)) * Math.max(1, Math.min(5, Number(row.severity) || 1));
      if (score >= 20) return "중대";
      if (score >= 12) return "높음";
      if (score >= 6) return "보통";
      return "낮음";
    };
    const yearOf = (row) => (String(row.date || "").match(/(19|20)\\d{2}/) || [""])[0];
    const monthOf = (row) => {
      const match = String(row.date || "").match(/(?:19|20)\\d{2}[-./년\\s]*(\\d{1,2})/);
      const month = Number(match && match[1]);
      return month >= 1 && month <= 12 ? month + "월" : "";
    };
    const reportMonthOf = (row) => {
      const savedMonth = String(row.reportMonth || "").match(/\\d{1,2}/);
      if (savedMonth) {
        const month = Number(savedMonth[0]);
        if (month >= 1 && month <= 12) return month + "월";
      }
      return monthOf(row);
    };
    const dateParts = (row) => {
      const match = String(row.date || "").match(/(19|20)\\d{2}[-./년\\s]*(\\d{1,2})?[-./월\\s]*(\\d{1,2})?/);
      return {
        year: Number(match && match[0].match(/(19|20)\\d{2}/)?.[0]) || 0,
        month: Number(match && match[2]) || 0,
        day: Number(match && match[3]) || 0
      };
    };
    const compareSharedRows = (a, b) => {
      const left = dateParts(a);
      const right = dateParts(b);
      if (right.year !== left.year) return right.year - left.year;
      if (right.month !== left.month) return right.month - left.month;
      if (left.day !== right.day) return left.day - right.day;
      return cleanDept(a.department).localeCompare(cleanDept(b.department), "ko");
    };
    const cleanDept = (value) => String(value || "").trim().replace(/^[a-zA-Z]\\s+/, "").replace(/^[a-zA-Z][.)-]\\s*/, "");
    const companyOf = (row) => {
      const department = cleanDept(row.department);
      if (department === "SEM") return "SEM";
      return "오영";
    };
    let activeCompany = "all";
    let currentFilteredRows = rows.slice();
    let activeStatsMode = "type";
    let statsYear = "all";
    let statsMonth = "all";
    const typeOrder = ["깔림", "끼임", "넘어짐", "누전", "떨어짐", "맞음", "베임", "찔림", "부딪힘", "불균형 및 무리한", "이상온도 접촉", "화학물질 누출", "화학물질 접촉", "화재 폭발", "기타"];
    const fillYears = () => {
      const years = [...new Set(rows.map(yearOf).filter(Boolean))].sort((a, b) => b.localeCompare(a));
      document.getElementById("yearFilter").insertAdjacentHTML("beforeend", years.map((year) => '<option>' + esc(year) + '</option>').join(""));
    };
    const fillDepartments = () => {
      const departments = [...new Set(rows.map((row) => cleanDept(row.department)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));
      document.getElementById("departmentFilter").insertAdjacentHTML("beforeend", departments.map((dept) => '<option>' + esc(dept) + '</option>').join(""));
    };
    const fillMonths = () => {
      const months = [...new Set(rows.map(monthOf).filter(Boolean))].sort((a, b) => Number(a.replace(/\\D/g, "")) - Number(b.replace(/\\D/g, "")));
      document.getElementById("monthFilter").insertAdjacentHTML("beforeend", months.map((month) => '<option>' + esc(month) + '</option>').join(""));
    };
    const fillStatsFilters = () => {
      const years = [...new Set(rows.map(yearOf).filter(Boolean))].sort((a, b) => b.localeCompare(a));
      const months = [...new Set(rows.map(reportMonthOf).filter(Boolean))].sort((a, b) => Number(a.replace(/\\D/g, "")) - Number(b.replace(/\\D/g, "")));
      document.getElementById("statsYearFilter").insertAdjacentHTML("beforeend", years.map((year) => '<option>' + esc(year) + '</option>').join(""));
      document.getElementById("statsMonthFilter").insertAdjacentHTML("beforeend", months.map((month) => '<option>' + esc(month) + '</option>').join(""));
    };
    const getStatsRows = (items) => items.filter((row) => {
      if (statsYear !== "all" && yearOf(row) !== statsYear) return false;
      if (statsMonth !== "all" && reportMonthOf(row) !== statsMonth) return false;
      return true;
    });
    const render = () => {
      const query = document.getElementById("searchInput").value.trim().toLowerCase();
      const department = document.getElementById("departmentFilter").value;
      const year = document.getElementById("yearFilter").value;
      const month = document.getElementById("monthFilter").value;
      const filtered = rows.filter((row) => {
        const rowRisk = riskLevel(row);
        const text = [row.kind, row.company, row.date, row.department, row.author, row.victim, row.location, row.process, row.type, row.description, row.summary, row.action].join(" ").toLowerCase();
        if (query && !text.includes(query)) return false;
        if (activeCompany !== "all" && companyOf(row) !== activeCompany) return false;
        if (department !== "all" && cleanDept(row.department) !== department) return false;
        if (year !== "all" && yearOf(row) !== year) return false;
        if (month !== "all" && monthOf(row) !== month) return false;
        return true;
      });
      const sorted = filtered.slice().sort(compareSharedRows);
      document.getElementById("totalCount").textContent = rows.length;
      document.getElementById("oyoungCount").textContent = rows.filter((row) => companyOf(row) === "오영").length;
      document.getElementById("semCount").textContent = rows.filter((row) => companyOf(row) === "SEM").length;
      document.getElementById("visibleCount").textContent = filtered.length;
      document.getElementById("filteredCount").textContent = filtered.length;
      currentFilteredRows = sorted;
      renderStats(activeStatsMode, getStatsRows(sorted));
      document.getElementById("rowsBody").innerHTML = sorted.length ? sorted.map((row, index) => {
        const rowRisk = riskLevel(row);
        return '<tr>' +
          '<td>' + (index + 1) + '</td>' +
          '<td>' + esc(monthOf(row) || "-") + '</td>' +
          '<td>' + esc(row.date || "-") + '</td>' +
          '<td>' + esc(cleanDept(row.department) || "-") + '</td>' +
          '<td>' + esc(row.author || "-") + '</td>' +
          '<td>' + esc(row.location || row.process || "-") + '</td>' +
          '<td class="detail-cell" data-detail-index="' + index + '" title="더블클릭해서 유해위험요인과 감소대책 보기">' + esc(row.summary || row.description || "-") + '</td>' +
          '<td>' + esc(row.type || "-") + '</td>' +
          '<td><span class="badge ' + rowRisk + '">' + rowRisk + '</span></td>' +
        '</tr>';
      }).join("") : '<tr><td colspan="9"><div class="empty">표시할 데이터가 없습니다.</div></td></tr>';
    };
    const renderStats = (mode, items) => {
      const title = mode === "department" ? "부서별 통계" : "재해유형별 통계";
      document.getElementById("statsTitle").textContent = title;
      let rowsForChart;
      if (mode === "department") {
        const counts = new Map();
        items.forEach((row) => {
          const dept = cleanDept(row.department) || "미분류";
          counts.set(dept, (counts.get(dept) || 0) + 1);
        });
        rowsForChart = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
      } else {
        const counts = new Map(typeOrder.map((type) => [type, 0]));
        items.forEach((row) => {
          const type = typeOrder.includes(row.type) ? row.type : "기타";
          counts.set(type, (counts.get(type) || 0) + 1);
        });
        rowsForChart = [...counts.entries()].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1] || typeOrder.indexOf(a[0]) - typeOrder.indexOf(b[0]));
      }
      const max = Math.max(1, ...rowsForChart.map(([, count]) => count));
      document.getElementById("typeStats").innerHTML = rowsForChart.length ? rowsForChart.map(([type, count], index) => {
        const width = Math.max(6, Math.round((count / max) * 100));
        const rank = index + 1;
        const rankClass = rank <= 3 ? ' rank-' + rank : "";
        const rankText = rank <= 3 ? rank + "위" : rank;
        return '<div class="bar-row' + rankClass + '">' +
          '<div class="rank-badge">' + rankText + '</div>' +
          '<div class="bar-label">' + esc(type) + '</div>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + width + '%"></div></div>' +
          '<div class="bar-count">' + count + '</div>' +
        '</div>';
      }).join("") : '<div class="empty">통계 데이터가 없습니다.</div>';
    };
    const splitDetailItems = (value) => String(value || "")
      .split(/\\n+|(?:^|\\s)(?:\\d+[\\).]|[-*ㆍ·])\\s+|[;；]/)
      .map((item) => item.replace(/^\\d+[\\).]\\s*/, "").trim())
      .filter((item) => item && item !== "-");
    const uniqueItems = (items) => {
      const seen = new Set();
      return items.filter((item) => {
        const key = item.replace(/\\s/g, "");
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };
    const buildHazardItems = (row) => {
      const direct = splitDetailItems(row.cause);
      if (direct.length > 1) return uniqueItems(direct).slice(0, 5);
      const location = row.location || row.process || "해당 작업구간";
      const description = row.description || row.summary || "";
      const type = row.type || "기타";
      return uniqueItems([
        direct[0] || description || location + "에서 작업 중 사고 위험이 있음",
        location + "에서 " + type + " 사고로 이어질 수 있는 작업환경 또는 동선 위험",
        description && description.replace(/[.。]\\s*$/, "") + " 상황이 반복될 가능성"
      ].filter(Boolean)).slice(0, 5);
    };
    const buildActionItems = (row) => {
      const direct = splitDetailItems(row.action);
      if (direct.length > 1) return uniqueItems(direct).slice(0, 5);
      const location = row.location || row.process || "해당 작업구간";
      const action = direct[0] || row.action || "위험요인을 제거하고 작업 전 점검 및 교육을 실시한다.";
      return uniqueItems([
        action,
        location + "의 위험요인을 제거하거나 표시하고 작업동선을 확보한다.",
        "작업 전 위험요인 공유 및 재발방지 교육을 실시한다."
      ]).slice(0, 5);
    };
    const renderDetailList = (id, items) => {
      document.getElementById(id).innerHTML = items.length
        ? items.map((item) => '<li>' + esc(item) + '</li>').join("")
        : '<li>-</li>';
    };
    const openDetail = (index) => {
      const row = currentFilteredRows[index];
      if (!row) return;
      const meta = [row.date, cleanDept(row.department), row.author, row.type].filter(Boolean).join(" · ");
      document.getElementById("detailTitle").textContent = row.summary || row.description || "아차사고 상세";
      document.getElementById("detailMeta").textContent = meta || "현재 표시 조건 기준";
      document.getElementById("detailDescription").textContent = row.summary || row.description || "-";
      renderDetailList("detailHazard", buildHazardItems(row));
      renderDetailList("detailAction", buildActionItems(row));
      document.getElementById("detailModal").classList.add("open");
    };
    const closeDetailModal = () => {
      document.getElementById("detailModal").classList.remove("open");
    };
    fillYears();
    fillDepartments();
    fillMonths();
    fillStatsFilters();
    document.querySelectorAll("#companyTabs button").forEach((button) => {
      button.addEventListener("click", () => {
        activeCompany = button.dataset.company || "all";
        document.querySelectorAll("#companyTabs button").forEach((item) => item.classList.toggle("active", item === button));
        render();
      });
    });
    document.querySelectorAll("[data-stats]").forEach((button) => {
      button.addEventListener("click", () => {
        activeStatsMode = button.dataset.stats || "type";
        renderStats(activeStatsMode, getStatsRows(currentFilteredRows));
        document.querySelectorAll("[data-stats]").forEach((item) => {
          item.classList.toggle("active", item === button);
          item.setAttribute("aria-expanded", String(item === button));
        });
        document.getElementById("statsModal").classList.add("open");
      });
    });
    document.getElementById("statsYearFilter").addEventListener("change", (event) => {
      statsYear = event.target.value;
      renderStats(activeStatsMode, getStatsRows(currentFilteredRows));
    });
    document.getElementById("statsMonthFilter").addEventListener("change", (event) => {
      statsMonth = event.target.value;
      renderStats(activeStatsMode, getStatsRows(currentFilteredRows));
    });
    const closeStatsModal = () => {
      document.getElementById("statsModal").classList.remove("open");
      document.querySelectorAll("[data-stats]").forEach((item) => {
        item.classList.remove("active");
        item.setAttribute("aria-expanded", "false");
      });
    };
    document.getElementById("statsCloseBtn").addEventListener("click", () => {
      closeStatsModal();
    });
    document.getElementById("statsModal").addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      closeStatsModal();
    });
    document.getElementById("rowsBody").addEventListener("dblclick", (event) => {
      const cell = event.target.closest(".detail-cell");
      if (!cell) return;
      openDetail(Number(cell.dataset.detailIndex));
    });
    document.getElementById("detailCloseBtn").addEventListener("click", () => {
      closeDetailModal();
    });
    document.getElementById("detailModal").addEventListener("click", (event) => {
      if (event.target !== event.currentTarget) return;
      closeDetailModal();
    });
    ["searchInput","departmentFilter","yearFilter","monthFilter"].forEach((id) => document.getElementById(id).addEventListener("input", render));
    render();
  <\/script>
</body>
</html>`;
}

async function saveShareSnapshot() {
  const rawName = safeText($("#shareFileName")?.value).trim() || `안전사고통합관리_공유_${today().replaceAll("-", "")}`;
  const fileBase = rawName.replace(/[\\/:*?"<>|]/g, "_");
  const defaultName = fileBase.endsWith(".html") ? fileBase : `${fileBase}.html`;
  const html = buildStandaloneSafetyShareHtml(fileBase.replace(/\.html$/i, ""), records);
  if (window.desktopApp?.isElectron && window.desktopApp.saveHtmlSnapshot) {
    try {
      const result = await window.desktopApp.saveHtmlSnapshot({ html, defaultName });
      if (result?.canceled) return;
      closeShareDialog();
      setAiStatus("공유 파일 저장 완료", "success");
      return;
    } catch (error) {
      setAiStatus(`공유 파일 저장 실패: ${error.message}`, "error");
    }
  }
  download(defaultName, html, "text/html;charset=utf-8");
  closeShareDialog();
  setAiStatus("공유 파일 저장 완료", "success");
}

function exportCsv(scope) {
  let rows = filteredRecords();
  if (scope === "nearMiss") rows = rows.filter((row) => row.kind === "nearMiss");
  if (scope === "incident") rows = rows.filter((row) => row.kind === "incident");
  download(`ESQ_safety_${scope}_${today().replaceAll("-", "")}.csv`, toCsv(rows), "text/csv;charset=utf-8");
}

function exportJson() {
  download(`ESQ_safety_backup_${today()}.json`, JSON.stringify(records, null, 2), "application/json;charset=utf-8");
}

function normalizeHeader(value) {
  return safeText(value).replace(/\s/g, "").toLowerCase();
}

function findColumn(headers, names) {
  const targets = names.map(normalizeHeader);
  return headers.findIndex((header) => targets.some((target) => header.includes(target)));
}

function readCell(row, index) {
  return index < 0 ? "" : row[index] ?? "";
}

function cleanDate(value) {
  const raw = safeText(value).trim();
  if (typeof value === "number" && window.XLSX && window.XLSX.SSF) {
    return cleanDate(window.XLSX.SSF.format("yyyy-mm-dd", value));
  }
  const match = raw.match(/(20\d{2}|19\d{2})[.\-/\uB144\s]*(\d{1,2})[.\-/\uB144\s]*(\d{1,2})/);
  if (!match) return today();
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return today();
  return `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getSheetImportKind(sheetName) {
  const name = normalizeHeader(sheetName).replace(/[()[\]{}_\-./~쨌??]/g, "");
  if ((name.includes("\uC624\uC601\uC548\uC804\uBCF4\uAC74") || name.includes("sem\uC548\uC804\uBCF4\uAC74")) && !name.includes("\uC544\uCC28")) return "incident";
  if (name.includes("\uC544\uCC28") || name.includes("nearmiss")) return "nearMiss";
  return "";
}

function mapExcelRowToImported(sheetName, row, col, sheetKind) {
  const kind = sheetKind || "nearMiss";
  const description = readCell(row, col.description);
  const action = readCell(row, col.action);
  if (!description && !action) return null;
  return normalizeRecord({
    id: nextId(kind),
    kind,
    company: readCell(row, col.company) || (safeText(sheetName).toUpperCase().includes("SEM") ? K.sem : K.oyoung),
    date: cleanDate(readCell(row, col.date)),
    department: cleanDepartment(readCell(row, col.department)),
    author: readCell(row, col.author),
    location: readCell(row, col.location),
    process: readCell(row, col.process),
    type: readCell(row, col.type),
    cause: readCell(row, col.cause),
    victim: readCell(row, col.victim),
    claimType: readCell(row, col.claimType),
    lostDays: Number(readCell(row, col.lostDays) || 0),
    reportYear: normalizeRecordYear(readCell(row, col.reportYear)) || getCurrentReportYear(),
    reportMonth: normalizeRecordMonth(readCell(row, col.reportMonth)) || getCurrentReportMonth(),
    likelihood: Number(readCell(row, col.likelihood) || 3),
    severity: Number(readCell(row, col.severity) || 3),
    status: readCell(row, col.status) || (readCell(row, col.completedDate) ? K.done : K.received),
    dueDate: readCell(row, col.dueDate) ? cleanDate(readCell(row, col.dueDate)) : "",
    owner: readCell(row, col.owner),
    summary: readCell(row, col.summary) || description,
    description,
    action: action || generateAutoCountermeasure({
      type: readCell(row, col.type),
      description,
      location: readCell(row, col.location) || readCell(row, col.process),
      cause: readCell(row, col.cause)
    }),
    completedDate: readCell(row, col.completedDate) ? cleanDate(readCell(row, col.completedDate)) : ""
  });
}

function parseSafetyWorkbook(workbook) {
  const imported = [];
  workbook.SheetNames.forEach((sheetName) => {
    const sheetKind = getSheetImportKind(sheetName);
    if (!sheetKind) return;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;
    const raw = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const headerIndex = raw.findIndex((row) => {
      const joined = row.map(normalizeHeader).join("|");
      return (joined.includes("\uBC1C\uC0DD\uC77C") || joined.includes("\uC0AC\uACE0\uC77C") || joined.includes("\uC77C\uC790"))
        && (joined.includes("\uBD80\uC11C") || joined.includes("\uBC1C\uC0DD\uC7A5\uC18C") || joined.includes("\uC7AC\uD574\uB0B4\uC6A9") || joined.includes("\uC0AC\uACE0\uC720\uD615"));
    });
    if (headerIndex < 0) return;
    const headers = raw[headerIndex].map(normalizeHeader);
    const col = {
      company: findColumn(headers, ["\uC0AC\uC5C5\uC7A5", "\uD68C\uC0AC", "\uBC95\uC778"]),
      date: findColumn(headers, ["\uBC1C\uC0DD\uC77C", "\uC0AC\uACE0\uC77C\uC790", "\uC77C\uC790", "\uBC1C\uC0DD\uC77C\uC2DC"]),
      department: findColumn(headers, ["\uBD80\uC11C", "\uBD80\uC11C\uBA85"]),
      author: findColumn(headers, ["\uBC1C\uAD74\uC790"]),
      location: findColumn(headers, ["\uBC1C\uC0DD\uC7A5\uC18C", "\uC7A5\uC18C"]),
      process: findColumn(headers, ["\uC124\uBE44", "\uACF5\uC815", "\uC791\uC5C5\uBA85", "\uAE30\uC778\uBB3C"]),
      type: findColumn(headers, ["\uC0AC\uACE0\uC720\uD615", "\uC7AC\uD574\uC720\uD615", "\uC720\uD615"]),
      cause: findColumn(headers, ["\uC7AC\uD574\uC6D0\uC778", "\uC0AC\uACE0\uC6D0\uC778", "\uC6D0\uC778"]),
      victim: findColumn(headers, ["\uC0AC\uACE0\uC790", "\uC7AC\uD574\uC790", "\uD53C\uD574\uC790"]),
      claimType: findColumn(headers, ["\uC0B0\uC7AC", "\uBE44\uACE0", "\uCC98\uB9AC\uAD6C\uBD84"]),
      lostDays: findColumn(headers, ["\uD734\uC5C5", "\uD734\uC5C5\uC77C\uC218", "\uD734\uC5C5\uC608\uC0C1\uC77C\uC218"]),
      reportYear: findColumn(headers, ["\uC81C\uCD9C\uC5F0\uB3C4", "\uC9D1\uACC4\uC5F0\uB3C4", "\uBCF4\uACE0\uC5F0\uB3C4", "\uB4F1\uB85D\uC5F0\uB3C4"]),
      reportMonth: findColumn(headers, ["\uC81C\uCD9C\uC6D4", "\uC9D1\uACC4\uC6D4", "\uBCF4\uACE0\uC6D4", "\uB4F1\uB85D\uC6D4"]),
      likelihood: findColumn(headers, ["\uAC00\uB2A5\uC131", "\uBC1C\uC0DD\uAC00\uB2A5\uC131"]),
      severity: findColumn(headers, ["\uC911\uB300\uC131", "\uAC15\uB3C4"]),
      status: findColumn(headers, ["\uC0C1\uD0DC", "\uC9C4\uD589\uC0C1\uD0DC"]),
      dueDate: findColumn(headers, ["\uAC1C\uC120\uC608\uC815\uC77C", "\uC608\uC815\uC77C", "\uC870\uCE58\uC608\uC815\uC77C"]),
      completedDate: findColumn(headers, ["\uAC1C\uC120\uC644\uB8CC\uC77C", "\uC644\uB8CC\uC77C", "\uC870\uCE58\uC644\uB8CC\uC77C"]),
      owner: findColumn(headers, ["\uB2F4\uB2F9\uC790", "\uC870\uCE58\uC790", "\uB2F4\uB2F9\uBD80\uC11C"]),
      summary: findColumn(headers, ["\uC0AC\uACE0\uBA85", "\uC0AC\uAC74\uC0AC\uACE0\uC694\uC57D", "\uC694\uC57D"]),
      description: findColumn(headers, ["\uC7AC\uD574\uB0B4\uC6A9", "\uC0AC\uACE0\uB0B4\uC6A9", "\uBC1C\uC0DD\uB0B4\uC6A9", "\uB0B4\uC6A9"]),
      action: findColumn(headers, ["\uC870\uCE58\uB0B4\uC6A9", "\uAC1C\uC120\uB0B4\uC6A9", "\uAC1C\uC120\uC870\uCE58", "\uC7AC\uBC1C\uBC29\uC9C0", "\uB300\uCC45"])
    };
    for (let index = headerIndex + 1; index < raw.length; index += 1) {
      const row = raw[index];
      if (!row || !row.some((value) => safeText(value).trim())) continue;
      const mapped = mapExcelRowToImported(sheetName, row, col, sheetKind);
      if (mapped) imported.push(mapped);
    }
  });
  return imported;
}

function processSafetyExcel(file) {
  if (IS_DEPARTMENT_MODE) {
    setAiStatus("부서용에서는 Excel/PDF로 관리 데이터를 등록할 수 없습니다.", "error");
    return;
  }
  if (!window.XLSX) {
    setAiStatus("\uC5D1\uC140 \uB77C\uC774\uBE0C\uB7EC\uB9AC\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.", "error");
    return;
  }
  setAiStatus("\uC5D1\uC140 \uB370\uC774\uD130\uB97C \uC77D\uB294 \uC911...");
  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const workbook = window.XLSX.read(new Uint8Array(event.target.result), { type: "array" });
      const imported = parseSafetyWorkbook(workbook);
      if (!imported.length) {
        throw new Error("\uC624\uC601 \uC548\uC804\u00B7\uBCF4\uAC74, SEM \uC548\uC804\u00B7\uBCF4\uAC74, \uC544\uCC28\uC0AC\uACE0 \uC2DC\uD2B8\uB9CC \uAC00\uC838\uC62C \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      }
      records = [...imported, ...records];
      await saveRecords();
      renderAll();
      switchView(imported.some((row) => row.kind === "incident") ? "incident" : "nearMiss");
      setAiStatus(`\uC5D1\uC140 \uC77D\uAE30 \uC644\uB8CC: ${imported.length}\uAC74 \uB4F1\uB85D`, "success");
    } catch (error) {
      setAiStatus(`\uC5D1\uC140 \uC624\uB958: ${error.message}`, "error");
    }
  };
  reader.onerror = () => setAiStatus("\uC5D1\uC140 \uD30C\uC77C \uC77D\uAE30\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.", "error");
  reader.readAsArrayBuffer(file);
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(safeText(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("\uD30C\uC77C \uC77D\uAE30 \uC2E4\uD328"));
    reader.readAsDataURL(file);
  });
}

async function listGeminiModels(apiKey) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
    headers: { "x-goog-api-key": apiKey }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "Gemini model lookup failed");
  const priority = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro", "gemini-2.0-flash"];
  const available = (payload.models || [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => safeText(model.name).replace("models/", ""))
    .filter(Boolean);
  return [...priority.filter((name) => available.includes(name)), ...available.filter((name) => !priority.includes(name))];
}

async function pickGeminiModel(apiKey) {
  const models = await listGeminiModels(apiKey);
  return models[0] || "";
}

function buildSafetyPdfPrompt() {
  return [
    "Extract only near-miss or incident investigation records from this PDF.",
    "Return JSON array only. Do not wrap in markdown.",
    "All string values must be returned in Korean.",
    "author means 발굴자 only. Use only the value printed in the 발굴자 cell/field.",
    "작성자 is not 발굴자. If the PDF has 작성자 and 발굴자 separately, author must be 발굴자, never 작성자.",
    "owner means 작성자, 담당자, or 조치 담당자 when those fields exist.",
    "Never use 작성자, 검토, 승인, 담당자, 조사자, 교육참석자, or signature names as author.",
    "If 발굴자 is missing or unreadable, return an empty string for author.",
    "author must contain only the person's name and exclude all job titles.",
    "location must contain only the occurrence place text.",
    "process must be empty unless the PDF clearly has a separate process or equipment field.",
    "description must be a short Korean one-sentence summary based on 사고개요 and 위험요인.",
    "Use only the direct safety hazard. Do not add extra explanation, trust impact, hygiene reputation impact, or broad business commentary.",
    "Do not write generic phrases such as '아차사고가 일어날 위험이 있음'.",
    "Do not concatenate two source sentences with slash.",
    "action must be a concrete Korean countermeasure sentence. If the PDF has no explicit action, generate a practical preventive action from the hazard and type.",
    "Summarize into one sentence such as '농축1번탱크 외벽 개구부 높이가 낮아 작업자가 머리를 부딪힐 위험이 있음'.",
    "kind must be nearMiss if the document is an 아차사고 발굴개선표 or any 아차사고 form.",
    "kind must be incident only for 사건사고 조사보고서 or actual incident investigation documents.",
    "type must be selected by reading the full context of the PDF, not by one keyword only.",
    "type must be exactly one of: 깔림, 끼임, 넘어짐, 누전, 떨어짐, 맞음, 베임, 찔림, 부딪힘, 불균형 및 무리한, 이상온도 접촉, 화학물질 누출, 화학물질 접촉, 화재 폭발.",
    "If the case does not fit those types clearly, use 기타.",
    "Fields:",
    "kind(nearMiss or incident), company(오영 or SEM), date, department, author, location, process, type, cause, victim, claimType, lostDays, likelihood, severity, status, dueDate, owner, description, action"
  ].join("\n");
}

async function requestGeminiPdfAnalysis(base64, prompt) {
  const retryableError = (message) => /high demand|try again later|temporar|timeout|429|503|overloaded/i.test(safeText(message));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const withRetry = async (task, sourceLabel, models = []) => {
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        if (attempt > 1) {
          const modelHint = models[attempt - 1] ? ` / ${models[attempt - 1]}` : "";
          setAiStatus(`PDF 분석 재시도 중... (${attempt}/3)${modelHint}`, "warning");
        }
        return await task(attempt);
      } catch (error) {
        lastError = error;
        if (attempt >= 3 || !retryableError(error?.message)) break;
        await wait(attempt * 3000);
      }
    }
    throw lastError || new Error(`${sourceLabel} PDF 분석 실패`);
  };

  const desktopKey = await getDesktopGeminiApiKey();
  if (desktopKey) {
    const models = (await listGeminiModels(desktopKey)).slice(0, 3);
    return withRetry(async (attempt) => {
      const model = models[attempt - 1] || models[0] || await pickGeminiModel(desktopKey);
      if (!model) throw new Error("No usable Gemini model.");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": desktopKey },
        body: JSON.stringify({
          contents: [{ parts: [{ inline_data: { mime_type: "application/pdf", data: base64 } }, { text: prompt }] }],
          generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || `HTTP ${response.status}`);
      return { text: result.candidates?.[0]?.content?.parts?.[0]?.text || "", model };
    }, "desktop", models);
  }

  if (await hasServerGeminiConfig()) {
    return withRetry(async () => {
      const response = await fetch("/api/safety-gemini/analyze-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, prompt })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error?.message || `HTTP ${response.status}`);
      return { text: safeText(result.text), model: safeText(result.model) };
    }, "server");
  }

  const manualKey = safeText($("#apiKey")?.value).trim();
  if (!manualKey) {
    throw new Error("Gemini API 키가 설정되지 않았습니다.");
  }

  const models = (await listGeminiModels(manualKey)).slice(0, 3);
  return withRetry(async (attempt) => {
    const model = models[attempt - 1] || models[0] || await pickGeminiModel(manualKey);
    if (!model) throw new Error("No usable Gemini model.");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": manualKey },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: "application/pdf", data: base64 } }, { text: prompt }] }],
        generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || `HTTP ${response.status}`);
    return { text: result.candidates?.[0]?.content?.parts?.[0]?.text || "", model };
  }, "manual", models);
}

function parseGeminiJsonArray(rawText) {
  const stripped = safeText(rawText).replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("AI response did not contain a JSON array.");
  return JSON.parse(match[0]);
}

function sanitizeImportedAuthor(value) {
  const text = safeText(value)
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const titles = ["사원", "주임", "대리", "과장", "차장", "부장", "팀장", "반장", "직장", "선임", "책임", "수석", "파트장", "매니저", "기사", "주무", "연구원", "프로", "님", "pl", "pm"];
  const parts = text
    .replace(/^\uAE30\uD0C0\s*/u, "")
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => !titles.includes(part.toLowerCase()));
  const cleaned = parts.join(" ").trim();
  if (!cleaned) return "";
  return cleaned;
}

function normalizePersonName(value) {
  return sanitizeImportedAuthor(value).replace(/\s/g, "");
}

function pickImportedDiscoverer(item) {
  const author = sanitizeImportedAuthor(item?.author);
  return author;
}

function stripFieldLabel(value, labels) {
  let text = safeText(value).trim();
  labels.forEach((label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`^${escaped}\\s*[:竊?]?\\s*`, "i"), "");
  });
  return text.trim();
}

function sanitizeImportedDescription(...values) {
  const labels = ["피해내용", "사고개요", "위험요인", "이상재해", "내용", "요약"];
  const cleaned = values
    .map((value) => stripFieldLabel(value, labels))
    .map((value) => safeText(value).replace(/\s+/g, " ").replace(/[.?:;]+$/g, "").trim())
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
  if (!cleaned.length) return "";

  let summary = cleaned[0]
    .replace(/\s*\/\s*.*/u, "")
    .replace(/\s*아차사고\s*발생/gu, "")
    .replace(/\s*아차사고/gu, "")
    .replace(/\s+/g, " ")
    .trim();

  summary = summary
    .replace(/\s*(?:및|그리고)\s*(?:해당\s*위생\s*관리|위생\s*관리|신뢰도|이미지|민원|불만)[^.]*$/u, "")
    .replace(/\s*(?:우려|문제)\s*(?:가 있음|있음)?\.?$/u, "")
    .trim();

  if (!/[가-힣]$/.test(summary)) {
    summary = summary.replace(/[^\p{L}\p{N})\]]+$/u, "").trim();
  }

  summary = summary
    .replace(/머리\s*부딪힘/gu, "작업자가 머리를 부딪힐")
    .replace(/부딪힘/gu, "작업자가 부딪힐")
    .replace(/끼임/gu, "작업자가 끼일")
    .replace(/떨어짐/gu, "작업자가 떨어질")
    .replace(/넘어짐/gu, "작업자가 넘어질")
    .replace(/베임/gu, "작업자가 베일")
    .replace(/찔림/gu, "작업자가 찔릴")
    .replace(/맞음/gu, "작업자가 맞을")
    .replace(/누출/gu, "작업자가 누출에 노출될")
    .replace(/접촉/gu, "작업자가 접촉할")
    .replace(/화재\s*폭발/gu, "화재·폭발이 발생할")
    .replace(/\s+/g, " ")
    .trim();

  if (!/위험이 있음$/.test(summary)) {
    if (/할$|될$|질$|릴$/.test(summary)) {
      summary = `${summary} 위험이 있음`;
    } else if (!/[.。]$/.test(summary)) {
      summary = `${summary}`;
    }
  }

  return summary.replace(/\s+/g, " ").trim();
}

function sanitizeImportedLocation(location) {
  return stripFieldLabel(location, ["?μ냼/?ㅻ퉬", "?μ냼", "?ㅻ퉬", "諛쒖깮?μ냼", "?묒뾽?μ냼", "location"])
    .replace(/\s+/g, " ")
    .trim();
}



function generateAutoCountermeasure(recordLike) {
  const type = normalizeAccidentType(recordLike?.type);
  const description = safeText(recordLike?.description).replace(/\s+/g, " ").trim();
  const location = safeText(recordLike?.location || recordLike?.process).replace(/\s+/g, " ").trim();
  const compact = [type, description, location, safeText(recordLike?.cause)].join(" ").replace(/\s/g, "");
  const baseActions = {
    "깔림": "중량물과 설비 작업구간을 분리하고 지지·고정 상태를 점검하며 출입통제를 실시한다.",
    "끼임": "가동부와 협착부에 방호장치를 설치하고 정비·청소 시 전원 차단 후 작업하도록 관리한다.",
    "넘어짐": "통로와 작업바닥의 미끄럼·걸림 요소를 제거하고 정리정돈 및 보행 주의를 교육한다.",
    "누전": "전기설비 절연 상태와 누전차단기를 점검하고 임시배선 사용을 제한한다.",
    "떨어짐": "추락 위험 구간에 안전난간·덮개를 설치하고 발판 및 계단 상태를 정비한다.",
    "맞음": "낙하·비래 위험 구간에 적재기준을 준수하고 보호구 착용과 출입통제를 시행한다.",
    "베임": "날붙이와 예리한 모서리에 보호커버를 설치하고 절단 작업 표준을 준수한다.",
    "찔림": "돌출부와 뾰족한 부위를 보호처리하고 자재 보관상태를 정비한다.",
    "부딪힘": "작업 동선과 머리 높이 간섭 구간을 식별 표시하고 모서리 보호재를 설치한다.",
    "불균형 및 무리한": "작업 자세와 중량물 취급방법을 개선하고 반복·무리 작업을 줄이도록 작업방법을 조정한다.",
    "이상온도 접촉": "고온·저온 설비에 보온·차열 조치를 하고 접촉부 경고표시를 부착한다.",
    "화학물질 누출": "배관·밸브·용기 상태를 점검하고 누출 방지 조치 및 비상대응 절차를 교육한다.",
    "화학물질 접촉": "화학물질 취급구간의 차단·밀폐를 강화하고 보호구 착용 및 세안·세척체계를 확보한다.",
    "화재 폭발": "점화원 관리와 가연물 격리를 강화하고 환기·정전기 방지 및 비상조치를 점검한다.",
    "기타": "위험요인을 제거하거나 노출을 줄일 수 있도록 작업환경과 작업방법을 개선하고 교육을 실시한다."
  };

  let action = baseActions[type] || baseActions["기타"];
  if (includesAny(compact, ["계단", "발판", "통로"])) {
    action = "계단·통로·발판 상태를 정비하고 걸림·미끄럼·머리 간섭 요소를 제거하며 위험표시를 실시한다.";
  } else if (includesAny(compact, ["배관", "밸브", "호스", "플랜지"])) {
    action = "배관·밸브·호스 연결부 상태를 점검하고 노후 부품을 교체하며 누출 여부를 수시 확인한다.";
  } else if (includesAny(compact, ["탱크", "개구부", "모서리"])) {
    action = "탱크 주변 개구부와 모서리에 보호재를 설치하고 작업 동선상 간섭 요소를 개선한다.";
  } else if (includesAny(compact, ["식당", "이물", "혼입", "급식", "조리"])) {
    action = "급식 제조·배식 전 이물 혼입 여부를 재점검하고 식재·조리도구 관리기준을 강화한다.";
  }

  return location ? `${location} 구간에 대해 ${action}` : action;
}
function mapImportedSafetyRecords(items, options = {}) {
  const reportYear = normalizeRecordYear(options.reportYear) || getCurrentReportYear();
  const reportMonth = normalizeRecordMonth(options.reportMonth);
  return ensureUniqueRecordIds(items.map((item) => normalizeRecord({
    id: nextId(item.kind === "incident" ? "incident" : "nearMiss"),
    kind: item.kind === "incident" ? "incident" : "nearMiss",
    company: safeText(item.company).toUpperCase() === "SEM" ? K.sem : K.oyoung,
    date: cleanDate(item.date || today()),
    department: cleanDepartment(item.department),
    author: pickImportedDiscoverer(item),
    location: sanitizeImportedLocation(item.location),
    process: "",
    type: item.type || "",
    cause: item.cause || CAUSES[CAUSES.length - 1],
    victim: item.victim || "",
    claimType: item.claimType || "",
    lostDays: Number(item.lostDays || 0),
    likelihood: Number(item.likelihood || 3),
    severity: Number(item.severity || 3),
    status: normalizeStatus(item.status),
    dueDate: item.dueDate ? cleanDate(item.dueDate) : "",
    owner: sanitizeImportedAuthor(item.owner || item.writer || item.작성자) || "",
    summary: item.summary || item.description || "",
    description: sanitizeImportedDescription(item.description, item.cause),
    action: item.action || generateAutoCountermeasure({
      type: item.type,
      description: sanitizeImportedDescription(item.description, item.cause),
      location: sanitizeImportedLocation(item.location),
      cause: item.cause
    }),
    reportYear,
    reportMonth
  })).filter((item) => item.description || item.action));
}

async function processSafetyPdf(file) {
  if (IS_DEPARTMENT_MODE) {
    setAiStatus("부서용에서는 PDF/Excel로 관리 데이터를 등록할 수 없습니다.", "error");
    return;
  }
  try {
    setAiStatus("PDF\uB97C \uC77D\uB294 \uC911...");
    const base64 = await readFileAsBase64(file);
    const prompt = buildSafetyPdfPrompt();
    const analysis = await requestGeminiPdfAnalysis(base64, prompt);
    const rawText = analysis.text || "";
    const imported = mapImportedSafetyRecords(parseGeminiJsonArray(rawText), { reportYear: getCurrentReportYear(), reportMonth: getCurrentReportMonth() });
    if (!imported.length) throw new Error("No importable items found.");
    records = [...imported, ...records];
    const saved = await saveRecords();
    renderAll();
    switchView(imported.some((row) => row.kind === "incident") ? "incident" : "nearMiss");
    if (!saved && !window.desktopApp?.isElectron) {
      showAppToast("서버 저장 실패", "PDF 분석 결과가 화면에는 있지만 새로고침하면 사라질 수 있습니다.", "error");
      setAiStatus(`PDF 분석은 완료됐지만 서버 저장 실패: ${imported.length}건`, "error");
      return;
    }
    setAiStatus(`PDF \uBD84\uC11D \uC644\uB8CC: ${imported.length}\uAC74 \uB4F1\uB85D`, "success");
  } catch (error) {
    console.error("PDF parse failed:", error);
    setAiStatus(`\uBD84\uC11D \uC2E4\uD328: ${error.message}`, "error");
  }
}

function handleSafetyFile(file) {
  if (IS_DEPARTMENT_MODE) {
    setAiStatus("부서용에서는 파일 분석 등록이 제한됩니다.", "error");
    return;
  }
  if (!file) return;
  const ext = safeText(file.name).split(".").pop().toLowerCase();
  if (ext === "pdf") return processSafetyPdf(file);
  if (["xlsx", "xls"].includes(ext)) return processSafetyExcel(file);
  setAiStatus("PDF \uB610\uB294 Excel \uD30C\uC77C\uB9CC \uC9C0\uC6D0\uD569\uB2C8\uB2E4.", "error");
}

function bindEditButtons() {
  if (editDelegationBound) return;
  editDelegationBound = true;

  document.addEventListener("click", (event) => {
    const riskButton = event.target.closest("[data-risk-target]");
    if (riskButton) {
      event.preventDefault();
      event.stopPropagation();
      openRiskAssessment(riskButton.dataset.riskTarget);
      return;
    }

    const button = event.target.closest("[data-edit]");
    if (!button || button.closest(".openable-row")) return;
    const record = records.find((row) => row.id === button.dataset.edit);
    if (record) openDialog(record);
  });

  document.addEventListener("dblclick", (event) => {
    const row = event.target.closest(".openable-row[data-edit]");
    if (!row) return;
    const record = records.find((item) => item.id === row.dataset.edit);
    if (record) openDialog(record);
  });
}

function bindUiHandlers() {
  $$(".nav-item").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  ["searchInput", "departmentFilter", "yearFilter", "monthFilter", "riskFilter"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", renderAll);
    el.addEventListener("change", renderAll);
  });

  $("#nearMissRiskPickMonthSelect")?.addEventListener("change", (event) => {
    nearMissRiskPickMonth = event.target.value || "";
    nearMissRiskPickVisible = false;
    renderNearMiss();
  });

  $("#nearMissRiskPickYearSelect")?.addEventListener("change", (event) => {
    nearMissRiskPickYear = event.target.value || "";
    nearMissRiskPickMonth = "";
    nearMissRiskPickVisible = false;
    renderNearMiss();
  });

  $("#nearMissRiskPickCountSelect")?.addEventListener("change", (event) => {
    nearMissRiskPickCount = Math.max(1, Math.min(5, Number(event.target.value) || 2));
    nearMissRiskPickVisible = false;
    renderNearMiss();
  });

  $("#nearMissRiskPickShowBtn")?.addEventListener("click", () => {
    nearMissRiskPickYear = $("#nearMissRiskPickYearSelect")?.value || "";
    nearMissRiskPickMonth = $("#nearMissRiskPickMonthSelect")?.value || "";
    nearMissRiskPickCount = Math.max(1, Math.min(5, Number($("#nearMissRiskPickCountSelect")?.value) || 2));
    nearMissRiskPickVisible = true;
    renderNearMiss();
  });

  const dashboardYearSelect = $("#dashboardYearSelect");
  if (dashboardYearSelect) {
    dashboardYearSelect.addEventListener("change", (event) => {
      dashboardTrendYear = event.target.value;
      renderDashboard();
    });
  }

  $$("#dashboardCompanyTabs button").forEach((button) => {
    button.addEventListener("click", () => {
      dashboardCompanyFilter = button.dataset.company || "all";
      $$("#dashboardCompanyTabs button").forEach((item) => item.classList.toggle("active", item === button));
      renderDashboard();
    });
  });

  $("#dashboardView")?.addEventListener("pointerover", (event) => {
    const segment = event.target.closest("[data-tooltip]");
    if (!segment) return;
    showDashboardTooltip(segment.dataset.tooltip || "", event);
  });

  $("#dashboardView")?.addEventListener("pointermove", (event) => {
    if (!event.target.closest("[data-tooltip]")) return;
    moveDashboardTooltip(event);
  });

  $("#dashboardView")?.addEventListener("pointerout", (event) => {
    if (!event.target.closest("[data-tooltip]")) return;
    hideDashboardTooltip();
  });

  $("#openSubmissionReviewBtn")?.addEventListener("click", async () => {
    switchView("nearMissForm");
    await loadFormSubmissions();
  });

  $("#dashboardSubmissionRecent")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-load-form-submission]");
    if (!button) return;
    await loadFormSubmissionToDraft(button.dataset.loadFormSubmission || "");
  });

  [["#deptReportYearSelect", "year"], ["#deptReportMonthSelect", "month"], ["#typeReportYearSelect", "year"], ["#typeReportMonthSelect", "month"]].forEach(([selector, kind]) => {
    const el = $(selector);
    if (!el) return;
    el.addEventListener("change", (event) => {
      if (selector === "#deptReportYearSelect") deptReportYearFilter = event.target.value;
      if (selector === "#deptReportMonthSelect") deptReportMonthFilter = event.target.value;
      if (selector === "#typeReportYearSelect") typeReportYearFilter = event.target.value;
      if (selector === "#typeReportMonthSelect") typeReportMonthFilter = event.target.value;
      renderReports();
    });
  });

  $$("#deptReportCompanyTabs button").forEach((button) => {
    button.addEventListener("click", () => {
      deptReportCompanyFilter = button.dataset.company || "all";
      $$("#deptReportCompanyTabs button").forEach((item) => item.classList.toggle("active", item === button));
      renderReports();
    });
  });
    $$("#typeReportCompanyTabs button").forEach((button) => {
      button.addEventListener("click", () => {
        typeReportCompanyFilter = button.dataset.company || "all";
        $$("#typeReportCompanyTabs button").forEach((item) => item.classList.toggle("active", item === button));
        renderReports();
      });
    });

    $("#nearMissFormView")?.addEventListener("input", (event) => {
      const field = event.target.closest("[data-near-miss-draft]");
      if (!field) return;
      if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
      activeSheetField = field.dataset.nearMissDraft;
      syncSheetFontControl();
      setNearMissDraftValue(field.dataset.nearMissDraft, field.value ?? field.textContent ?? "");
      saveNearMissFormDraft();
    });

    $("#nearMissFormView")?.addEventListener("change", (event) => {
      const photoInput = event.target.closest("[data-photo-upload]");
      if (photoInput) {
        handleNearMissPhotoUpload(photoInput);
        return;
      }
      const stampInput = event.target.closest("[data-stamp-upload]");
      if (stampInput) {
        handleStampUpload(stampInput);
        return;
      }
      const field = event.target.closest("[data-near-miss-draft]");
      if (!field) return;
      if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
      activeSheetField = field.dataset.nearMissDraft;
      setNearMissDraftValue(field.dataset.nearMissDraft, field.value ?? field.textContent ?? "");
      saveNearMissFormDraft();
      renderNearMissForm();
      syncSheetFontControl();
    });

    $("#settingsView")?.addEventListener("change", (event) => {
      const input = event.target.closest("[data-department-stamp-upload]");
      if (!input) return;
      handleDepartmentStampUpload(input);
    });

    $("#settingsView")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-department-stamp-remove]");
      if (!button || IS_DEPARTMENT_MODE) return;
      const department = button.dataset.departmentStampRemove;
      if (!department || !confirm(`${department} 도장을 삭제할까요?`)) return;
      delete safetySettings.departmentStamps[department];
      await saveSafetySettings();
      renderDepartmentStampList();
      setAiStatus(`${department} 도장 삭제 완료`, "success");
    });

    $("#nearMissFormView")?.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-photo-remove]");
      if (!removeButton) return;
      const field = removeButton.dataset.photoRemove;
      if (!field) return;
      if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
      nearMissFormDraft[field] = "";
      saveNearMissFormDraft();
      renderNearMissForm();
    });

    $("#nearMissFormView")?.addEventListener("click", (event) => {
      const approveButton = event.target.closest("[data-stamp-approve]");
      if (approveButton) {
        const field = approveButton.dataset.stampApprove;
        const slot = STAMP_FIELD_TO_SLOT[field];
        const stamp = getDepartmentStampSet(nearMissFormDraft?.department || getCurrentUserDepartment())?.[slot] || "";
        if (!field || !stamp) {
          alert("등록된 도장이 없습니다. 먼저 도장을 등록해주세요.");
          return;
        }
        if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
        nearMissFormDraft[field] = stamp;
        saveNearMissFormDraft();
        renderNearMissForm();
        setAiStatus(`${approveButton.textContent.trim()} 도장을 찍었습니다.`, "success");
        return;
      }

      const removeButton = event.target.closest("[data-stamp-remove]");
      if (!removeButton) return;
      const field = removeButton.dataset.stampRemove;
      if (!field) return;
      if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
      nearMissFormDraft[field] = "";
      const slot = STAMP_FIELD_TO_SLOT[field];
      const department = cleanDepartment(nearMissFormDraft.department || getCurrentUserDepartment());
      if (slot && department && department !== K.unclassified && safetySettings.departmentStamps?.[department]) {
        delete safetySettings.departmentStamps[department][slot];
        saveSafetySettings().catch((error) => console.warn("stamp setting delete failed:", error));
      }
      saveNearMissFormDraft();
      renderNearMissForm();
    });

    $("#nearMissFormView")?.addEventListener("click", (event) => {
      const fitButton = event.target.closest("[data-photo-fit]");
      if (!fitButton) return;
      const field = fitButton.dataset.photoFit;
      if (!field) return;
      if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
      nearMissFormDraft[field] = nearMissFormDraft[field] === "cover" ? "contain" : "cover";
      saveNearMissFormDraft();
      renderNearMissForm();
    });

    $("#nearMissFormView")?.addEventListener("pointerdown", startPhotoDrag);
    $("#nearMissFormView")?.addEventListener("pointerdown", startPhotoResize);

    $("#nearMissFormView")?.addEventListener("focusin", (event) => {
      const field = event.target.closest("[data-near-miss-draft]");
      if (!field) return;
      activeSheetField = field.dataset.nearMissDraft;
      syncSheetFontControl();
    });

    $("#nearMissFormView")?.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return;
      const field = event.target.closest("[data-near-miss-draft]");
      if (!field || !$("#nearMissFormSheet")?.contains(field)) return;
      setNearMissDraftValue(field.dataset.nearMissDraft, field.value ?? field.textContent ?? "");
      saveNearMissFormDraft();
      event.preventDefault();
      moveNearMissFormFocus(field, event.shiftKey ? -1 : 1);
    });

    $("#sheetFontSizeSelect")?.addEventListener("change", (event) => {
      if (!activeSheetField) return;
      if (!nearMissFormDraft) nearMissFormDraft = getDefaultNearMissFormDraft();
      nearMissFormDraft.fontSizes = nearMissFormDraft.fontSizes && typeof nearMissFormDraft.fontSizes === "object" ? nearMissFormDraft.fontSizes : {};
      const size = event.target.value;
      if (size) nearMissFormDraft.fontSizes[activeSheetField] = size;
      else delete nearMissFormDraft.fontSizes[activeSheetField];
      saveNearMissFormDraft();
      renderNearMissForm();
      syncSheetFontControl();
    });

    $("#printNearMissFormBtn")?.addEventListener("click", () => {
      printNearMissForm();
    });

    $("#printSubmissionPreviewBtn")?.addEventListener("click", () => {
      printNearMissForm();
    });

    $("#closeSubmissionPreviewBtn")?.addEventListener("click", () => {
      closeSubmissionPreview();
    });

    $("#submitNearMissFormBtn")?.addEventListener("click", () => {
      submitNearMissFormDraft();
    });

    $("#reloadFormSubmissionsBtn")?.addEventListener("click", () => {
      loadFormSubmissions();
    });

    $("#formSubmissionList")?.addEventListener("click", (event) => {
      const reviewButton = event.target.closest("[data-review-form-submission]");
      if (reviewButton) {
        markFormSubmissionReviewed(reviewButton.dataset.reviewFormSubmission);
        event.stopPropagation();
        return;
      }
      const row = event.target.closest("[data-load-form-submission]");
      if (row) {
        loadFormSubmissionToDraft(row.dataset.loadFormSubmission);
      }
    });

    $("#generateRiskAssessmentBtn")?.addEventListener("click", () => {
      generateNearMissRiskAssessment();
    });

    $("#nearMissFormSheet")?.addEventListener("click", (event) => {
      const dateButton = event.target.closest("[data-risk-date-button]");
      if (dateButton) {
        const picker = dateButton.closest(".risk-date-picker")?.querySelector(".risk-date-native");
        if (picker) {
          if (typeof picker.showPicker === "function") picker.showPicker();
          else picker.focus();
        }
        return;
      }

      const closePicker = event.target.closest("[data-close-risk-action-picker]");
      if (closePicker) {
        activeRiskActionPickerIndex = null;
        activeSupervisorActionPickerKey = "";
        renderNearMissForm();
        return;
      }

      const supervisorOption = event.target.closest("[data-supervisor-action-option]");
      if (supervisorOption) {
        const field = supervisorOption.dataset.supervisorActionOption || "";
        const value = supervisorOption.dataset.supervisorActionValue || "";
        if (!field || !value) return;
        const currentField = $(`[data-near-miss-draft="${field}"]`);
        const current = safeText(nearMissFormDraft?.[field] || currentField?.value || currentField?.textContent || "").replace(/\s+/g, "");
        const nextValue = current === value.replace(/\s+/g, "") ? "" : value;
        setNearMissDraftValue(field, nextValue);
        activeSupervisorActionPickerKey = "";
        saveNearMissFormDraft();
        renderNearMissForm();
        return;
      }

      const supervisorManualApply = event.target.closest("[data-supervisor-action-apply-manual]");
      if (supervisorManualApply) {
        const field = supervisorManualApply.dataset.supervisorActionApplyManual || "";
        const input = field ? $(`[data-supervisor-action-manual="${field}"]`) : null;
        const value = safeText(input?.value).trim();
        if (!field) return;
        setNearMissDraftValue(field, value);
        activeSupervisorActionPickerKey = "";
        saveNearMissFormDraft();
        renderNearMissForm();
        return;
      }

      const supervisorOpen = event.target.closest("[data-supervisor-action-open]");
      if (supervisorOpen) {
        const field = supervisorOpen.dataset.supervisorActionOpen || "";
        if (!field) return;
        activeRiskActionPickerIndex = null;
        activeSupervisorActionPickerKey = activeSupervisorActionPickerKey === field ? "" : field;
        renderNearMissForm();
        return;
      }

      const actionOption = event.target.closest("[data-risk-action-index]");
      if (actionOption) {
        const index = Number(actionOption.dataset.riskActionIndex);
        const option = actionOption.dataset.riskActionOption || "";
        if (!Number.isFinite(index) || !option) return;
        nearMissFormDraft.riskRows = Array.isArray(nearMissFormDraft.riskRows) ? nearMissFormDraft.riskRows : [];
        const row = nearMissFormDraft.riskRows[index] || {};
        const currentField = $(`[data-near-miss-draft="riskRows.${index}.action"]`);
        const displayedAction = currentField?.value ?? currentField?.textContent ?? "";
        const current = splitActionItems(row.action || displayedAction || "");
        const optionKey = option.replace(/\s+/g, "");
        const exists = current.some((item) => item.replace(/\s+/g, "") === optionKey);
        const next = exists ? current.filter((item) => item.replace(/\s+/g, "") !== optionKey) : [...current, option];
        nearMissFormDraft.riskRows[index] = {
          ...row,
          action: next.join("\n")
        };
        saveNearMissFormDraft();
        activeRiskActionPickerIndex = index;
        renderNearMissForm();
        return;
      }

      const riskManualApply = event.target.closest("[data-risk-action-apply-manual]");
      if (riskManualApply) {
        const index = Number(riskManualApply.dataset.riskActionApplyManual);
        const input = Number.isFinite(index) ? $(`[data-risk-action-manual="${index}"]`) : null;
        const value = safeText(input?.value).trim();
        if (!Number.isFinite(index)) return;
        nearMissFormDraft.riskRows = Array.isArray(nearMissFormDraft.riskRows) ? nearMissFormDraft.riskRows : [];
        nearMissFormDraft.riskRows[index] = {
          ...(nearMissFormDraft.riskRows[index] || {}),
          action: value
        };
        saveNearMissFormDraft();
        activeRiskActionPickerIndex = null;
        renderNearMissForm();
        return;
      }

      const actionOpen = event.target.closest("[data-risk-action-open]");
      if (actionOpen) {
        const index = Number(actionOpen.dataset.riskActionOpen);
        if (!Number.isFinite(index)) return;
        activeSupervisorActionPickerKey = "";
        activeRiskActionPickerIndex = activeRiskActionPickerIndex === index ? null : index;
        renderNearMissForm();
        return;
      }

      const effectivenessButton = event.target.closest("[data-effectiveness-status]");
      if (effectivenessButton) {
        setNearMissDraftValue("effectivenessStatus", effectivenessButton.dataset.effectivenessStatus || "적합");
        saveNearMissFormDraft();
        renderNearMissForm();
        return;
      }

      const button = event.target.closest("[data-risk-estimate-index]");
      if (!button) return;
      const index = Number(button.dataset.riskEstimateIndex);
      const value = button.dataset.riskEstimateValue || "보완";
      if (!Number.isFinite(index)) return;
      setNearMissDraftValue(`riskRows.${index}.estimate`, value);
      saveNearMissFormDraft();
      renderNearMissForm();
    });

    $("#resetNearMissDraftBtn")?.addEventListener("click", () => {
      if (!confirm("입력 중인 발굴개선표 내용을 초기화할까요?")) return;
      nearMissFormDraft = getDefaultNearMissFormDraft();
      saveNearMissFormDraft();
      syncNearMissDraftInputs();
      renderNearMissForm();
    });

    $$("#nearMissFormModeTabs button").forEach((button) => {
      button.addEventListener("click", () => {
        nearMissFormMode = button.dataset.formMode || "form";
        renderNearMissForm();
      });
    });

  const fileToolToggle = $("#fileToolToggle");
  const fileToolPanel = $("#fileToolPanel");
  if (fileToolToggle && fileToolPanel) {
    fileToolToggle.addEventListener("click", () => {
      const isOpening = fileToolPanel.hidden;
      fileToolPanel.hidden = !isOpening;
      fileToolToggle.setAttribute("aria-expanded", String(isOpening));
    });
  }

  $("#addRecordBtn")?.addEventListener("click", () => openDialog());
  $("#sidebarToggleBtn")?.addEventListener("click", toggleSidebar);
  $("#saveRecordBtn")?.addEventListener("click", saveFromDialog);
  $("#closeDialogBtn")?.addEventListener("click", () => $("#recordDialog").close());
  $("#cancelDialogBtn")?.addEventListener("click", () => $("#recordDialog").close());
  $("#deleteRecordBtn")?.addEventListener("click", deleteCurrentRecord);
  $("#exportJsonBtn")?.addEventListener("click", exportJson);
  $("#shareHtmlBtn")?.addEventListener("click", openShareDialog);
  $("#closeShareBtn")?.addEventListener("click", closeShareDialog);
  $("#saveShareBtn")?.addEventListener("click", saveShareSnapshot);
  $("#shareModal")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeShareDialog();
  });
  $("#bulkDeleteBtn")?.addEventListener("click", bulkDeleteVisibleRecords);

  const recordForm = $("#recordForm");
  if (recordForm && recordForm.elements.kind) {
    recordForm.elements.kind.addEventListener("change", updateDialogLabels);
  }

  $$("#nearMissCompanyTabs button").forEach((button) => {
    button.addEventListener("click", () => {
      nearMissCompanyFilter = button.dataset.company || "all";
      $$("#nearMissCompanyTabs button").forEach((item) => item.classList.toggle("active", item === button));
      renderNearMiss();
    });
  });
  $$("#incidentCompanyTabs button").forEach((button) => {
    button.addEventListener("click", () => {
      incidentCompanyFilter = button.dataset.company || "all";
      $$("#incidentCompanyTabs button").forEach((item) => item.classList.toggle("active", item === button));
      renderIncident();
    });
  });

  const dropZone = $("#safetyDropZone");
  const fileInput = $("#safetyFileInput");
  if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") fileInput.click();
    });
    dropZone.addEventListener("dragover", (event) => {
      event.preventDefault();
      dropZone.classList.add("active");
    });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("active"));
    dropZone.addEventListener("drop", (event) => {
      event.preventDefault();
      dropZone.classList.remove("active");
      handleSafetyFile(event.dataTransfer.files?.[0]);
    });
    fileInput.addEventListener("change", (event) => {
      handleSafetyFile(event.target.files?.[0]);
      event.target.value = "";
    });
  }

  $$("[data-export]").forEach((button) => {
    button.addEventListener("click", () => exportCsv(button.dataset.export));
  });

  window.addEventListener("beforeunload", flushRecordsBeforeUnload);
  applyDepartmentPermissions();
}

function applyDepartmentPermissions() {
  if (!IS_DEPARTMENT_MODE) return;
  [
    "addRecordBtn",
    "bulkDeleteBtn",
    "saveRecordBtn",
    "deleteRecordBtn"
  ].forEach((id) => {
    const button = $(`#${id}`);
    if (!button) return;
    button.disabled = true;
    button.title = "부서용에서는 관리 데이터 수정이 제한됩니다.";
  });

  const fileInput = $("#safetyFileInput");
  const dropZone = $("#safetyDropZone");
  if (fileInput) fileInput.disabled = true;
  if (dropZone) {
    dropZone.classList.add("readonly");
    dropZone.title = "부서용에서는 PDF/Excel 등록이 제한됩니다.";
  }
}

async function init() {
  try {
    bindAuthHandlers();
    const session = loadAuthSession();
    if (!session) {
      showLogin();
      return;
    }
    applyAuthUser(session.user);
    hideLogin();
    await loadSafetySettings();
    await syncGeminiApiKeyUi();
    loadRecords();
    loadSidebarState();
    loadActiveView();
    loadNearMissFormDraft();
    if (IS_DEPARTMENT_MODE) applyDepartmentStampToDraft({ force: true });
    populateSelects();
    syncNearMissDraftInputs();
    bindUiHandlers();
    switchView(activeView, { skipSave: true });
    renderAll();

    const loadedFromServer = await loadRecordsFromServer();
    if (!IS_DEPARTMENT_MODE) await loadFormSubmissions();
    switchView(activeView, { skipSave: true });
    if (!loadedFromServer && loadedLocalRecordCount > 0) {
      setAiStatus("서버 데이터 불러오기 실패: 로컬 임시 데이터만 표시 중입니다.", "error");
    }
  } catch (error) {
    console.error("init failed:", error);
    setAiStatus(`init error: ${error.message}`, "error");
  }
}

init();
