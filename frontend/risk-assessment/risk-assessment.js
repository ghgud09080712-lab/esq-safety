const STORAGE_KEY = "esqRiskAssessment.v1";
const SIDEBAR_KEY = "esqRiskAssessment.sidebarCollapsed";
const ACTIVE_VIEW_KEY = "esqRiskAssessment.activeView";

const TYPES = ["떨어짐", "넘어짐", "끼임", "부딪힘", "맞음", "베임", "화재/폭발", "감전", "질식", "화학물질 노출", "근골격계", "기타"];

const LIBRARY = [
  {
    key: "forklift",
    title: "지게차 / 자재 운반",
    keywords: ["지게차", "운반", "상하차", "팔레트", "창고"],
    hazards: [
      ["보행자와 지게차 충돌", "부딪힘", "보행통로 구획, 경광등/후진경보 확인", "보행자 통로 분리, 교차로 정지선 표시, 신호수 배치"],
      ["화물 낙하 또는 전도", "맞음", "적재상태 확인, 과속 금지", "적재높이 제한, 랩핑/고정 기준 게시, 운전자 교육"],
      ["사각지대 접촉 사고", "부딪힘", "작업 전 주변 확인", "반사경 설치, 제한속도 표지, 블라인드존 접근통제"]
    ]
  },
  {
    key: "height",
    title: "고소작업 / 사다리",
    keywords: ["고소", "사다리", "고소작업대", "지붕", "발판"],
    hazards: [
      ["작업자 추락", "떨어짐", "안전모, 안전대 착용", "작업발판 난간 확인, 안전대 걸이점 지정, 하부 출입통제"],
      ["공구 및 자재 낙하", "맞음", "공구 정리", "낙하물 방지망, 공구걸이 사용, 하부 감시자 배치"],
      ["사다리 전도", "넘어짐", "2인 1조 작업", "아웃트리거/미끄럼방지 확인, 사다리 단독 고소작업 제한"]
    ]
  },
  {
    key: "chemical",
    title: "화학물질 / 용제 취급",
    keywords: ["화학", "용제", "msds", "염료", "분말", "원료", "시약"],
    hazards: [
      ["화학물질 피부 접촉", "화학물질 노출", "보호장갑, 보안경 착용", "MSDS 보호구 재확인, 세안설비 접근성 점검, 누출키트 비치"],
      ["분진 흡입 노출", "화학물질 노출", "방진마스크 착용, 국소배기 가동", "국소배기 풍속 점검, 밀폐 이송 검토, 작업환경측정 반영"],
      ["인화성 증기 점화", "화재/폭발", "화기 금지, 환기", "방폭 전기기기 확인, 정전기 접지, 위험물 보관량 관리"]
    ]
  },
  {
    key: "confined",
    title: "밀폐공간 / 탱크 내부",
    keywords: ["밀폐", "탱크", "맨홀", "반응기", "조 내부", "저장조"],
    hazards: [
      ["산소결핍 또는 유해가스 중독", "질식", "작업 전 환기", "산소/가스 농도 측정, 감시인 배치, 밀폐공간 작업허가서 운영"],
      ["내부 작업 중 구조 지연", "질식", "연락수단 준비", "구조장비 비치, 비상대응훈련, 단독작업 금지"],
      ["잔류물 접촉", "화학물질 노출", "세척 후 작업", "잔류물 제거 확인, 보호복 착용, 폐액 처리 기준 확인"]
    ]
  },
  {
    key: "machine",
    title: "회전체 / 설비 정비",
    keywords: ["정비", "회전체", "컨베이어", "펌프", "모터", "분쇄", "혼합"],
    hazards: [
      ["회전체 끼임", "끼임", "방호덮개 설치", "정비 전 전원차단, LOTO 적용, 시운전 전 인원 확인"],
      ["불시 기동", "끼임", "작업 전 정지 확인", "잠금장치와 표지 부착, 담당자 승인 후 재가동"],
      ["날카로운 부품 베임", "베임", "보호장갑 착용", "절단면 보호캡, 정비공구 전용화, 작업 전 TBM"]
    ]
  },
  {
    key: "hotwork",
    title: "용접 / 화기 작업",
    keywords: ["용접", "절단", "그라인더", "화기", "불꽃"],
    hazards: [
      ["불티 비산으로 화재 발생", "화재/폭발", "소화기 비치, 주변 가연물 제거", "화기작업허가서, 방화포 설치, 작업 후 잔화 확인"],
      ["용접 흄 흡입", "화학물질 노출", "환기, 방진마스크 착용", "국소배기 사용, 차광면/호흡보호구 적합성 확인"],
      ["감전", "감전", "용접기 접지 확인", "케이블 피복 손상 점검, 습윤장소 작업 제한"]
    ]
  }
];

let assessments = [];
let activeView = "dashboard";
let editingId = "";

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid() {
  return `RA-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function normalize(value) {
  return String(value ?? "").trim();
}

function riskScore(likelihood, severity) {
  return Math.max(1, Number(likelihood || 1)) * Math.max(1, Number(severity || 1));
}

function riskLevel(score) {
  if (score >= 20) return { label: "중대", className: "critical" };
  if (score >= 12) return { label: "높음", className: "high" };
  if (score >= 6) return { label: "보통", className: "medium" };
  return { label: "낮음", className: "low" };
}

function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    assessments = Array.isArray(parsed.assessments) ? parsed.assessments : seedData();
  } catch {
    assessments = seedData();
  }
}

function seedData() {
  return [
    {
      id: uid(),
      date: today(),
      site: "오영",
      department: "생산1부",
      assessor: "관리자",
      task: "지게차 원료 운반",
      location: "원료창고",
      frequency: "매일",
      description: "원료 팔레트를 입고장부터 보관구역까지 운반",
      hazards: [
        {
          hazard: "보행자와 지게차 충돌",
          type: "부딪힘",
          currentControl: "보행통로 구획, 운전자 전방 확인",
          improvement: "교차로 정지선 표시와 반사경 설치",
          likelihood: 3,
          severity: 4,
          afterLikelihood: 2,
          afterSeverity: 3,
          owner: "창고장",
          dueDate: today(),
          status: "진행"
        }
      ],
      updatedAt: new Date().toISOString()
    }
  ];
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ assessments, updatedAt: new Date().toISOString() }, null, 2));
  $("#storageStatus").textContent = `저장됨 ${new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
}

function setView(view) {
  activeView = view;
  localStorage.setItem(ACTIVE_VIEW_KEY, view);
  $$(".view").forEach((el) => el.classList.toggle("active", el.id === `${view}View`));
  $$(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  render();
}

function setSidebar(collapsed) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  $("#sidebarToggleBtn").setAttribute("aria-expanded", String(!collapsed));
  localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
}

function populateTemplates() {
  $("#templateSelect").innerHTML = LIBRARY.map((item) => `<option value="${item.key}">${escapeHtml(item.title)}</option>`).join("");
}

function initForm() {
  const form = $("#riskForm");
  form.elements.date.value = today();
  addHazardRow();
}

function clearForm() {
  editingId = "";
  $("#riskForm").reset();
  $("#riskForm").elements.date.value = today();
  $("#hazardRows").innerHTML = "";
  addHazardRow();
}

function addHazardRow(data = {}) {
  const template = $("#hazardRowTemplate").content.cloneNode(true);
  const row = $(".hazard-row", template);
  const typeSelect = $('[data-field="type"]', row);
  typeSelect.innerHTML = TYPES.map((type) => `<option${type === data.type ? " selected" : ""}>${escapeHtml(type)}</option>`).join("");

  for (const field of $$("[data-field]", row)) {
    const key = field.dataset.field;
    if (data[key] !== undefined) field.value = data[key];
  }
  $$('input[type="number"]', row).forEach((input) => {
    input.addEventListener("input", () => updateRowScore(row));
  });
  $('[data-action="remove-hazard"]', row).addEventListener("click", () => {
    row.remove();
    if (!$("#hazardRows").children.length) addHazardRow();
  });
  $("#hazardRows").appendChild(row);
  updateRowScore(row);
}

function updateRowScore(row) {
  const before = riskScore($('[data-field="likelihood"]', row).value, $('[data-field="severity"]', row).value);
  const after = riskScore($('[data-field="afterLikelihood"]', row).value, $('[data-field="afterSeverity"]', row).value);
  $('[data-score="before"]', row).textContent = before;
  $('[data-score="after"]', row).textContent = after;
}

function getSuggestedTemplates(text) {
  const haystack = normalize(text).toLowerCase();
  const matched = LIBRARY.filter((item) => item.keywords.some((word) => haystack.includes(word.toLowerCase())));
  return matched.length ? matched : LIBRARY.slice(0, 2);
}

function suggestHazards() {
  const task = $("#riskForm").elements.task.value;
  const matched = getSuggestedTemplates(task);
  $("#hazardRows").innerHTML = "";
  matched.flatMap((item) => item.hazards).slice(0, 5).forEach((hazard) => {
    addHazardRow({
      hazard: hazard[0],
      type: hazard[1],
      currentControl: hazard[2],
      improvement: hazard[3],
      likelihood: 3,
      severity: hazard[1] === "질식" || hazard[1] === "화재/폭발" ? 5 : 4,
      afterLikelihood: 2,
      afterSeverity: 3,
      status: "계획"
    });
  });
}

function applyTemplate() {
  const selected = LIBRARY.find((item) => item.key === $("#templateSelect").value);
  if (!selected) return;
  $("#riskForm").elements.task.value = selected.title;
  suggestHazards();
  setView("assessment");
}

function collectForm() {
  const form = $("#riskForm");
  const hazards = $$(".hazard-row").map((row) => {
    const item = {};
    $$("[data-field]", row).forEach((field) => {
      item[field.dataset.field] = field.type === "number" ? Number(field.value || 1) : normalize(field.value);
    });
    return item;
  }).filter((item) => item.hazard || item.improvement);

  return {
    id: editingId || uid(),
    date: form.elements.date.value || today(),
    site: form.elements.site.value,
    department: normalize(form.elements.department.value),
    assessor: normalize(form.elements.assessor.value),
    task: normalize(form.elements.task.value),
    location: normalize(form.elements.location.value),
    frequency: form.elements.frequency.value,
    description: normalize(form.elements.description.value),
    hazards,
    updatedAt: new Date().toISOString()
  };
}

function saveAssessment(event) {
  event.preventDefault();
  const item = collectForm();
  if (!item.hazards.length) {
    addHazardRow();
    return;
  }
  const index = assessments.findIndex((entry) => entry.id === item.id);
  if (index >= 0) assessments[index] = item;
  else assessments.unshift(item);
  saveData();
  clearForm();
  setView("dashboard");
}

function flattenHazards() {
  return assessments.flatMap((assessment) => assessment.hazards.map((hazard, hazardIndex) => ({
    ...hazard,
    assessment,
    hazardIndex,
    beforeScore: riskScore(hazard.likelihood, hazard.severity),
    afterScore: riskScore(hazard.afterLikelihood, hazard.afterSeverity)
  })));
}

function renderMetrics() {
  const hazards = flattenHazards();
  const high = hazards.filter((item) => item.beforeScore >= 12).length;
  const open = hazards.filter((item) => item.status !== "완료").length;
  const done = hazards.length ? Math.round((hazards.filter((item) => item.status === "완료").length / hazards.length) * 100) : 0;
  $("#metricTotal").textContent = assessments.length;
  $("#metricHigh").textContent = high;
  $("#metricOpen").textContent = open;
  $("#metricDone").textContent = `${done}%`;
}

function renderRiskBars() {
  const counts = { 중대: 0, 높음: 0, 보통: 0, 낮음: 0 };
  flattenHazards().forEach((item) => {
    counts[riskLevel(item.beforeScore).label] += 1;
  });
  const max = Math.max(1, ...Object.values(counts));
  $("#riskBars").innerHTML = Object.entries(counts).map(([label, count]) => {
    const level = riskLevel(label === "중대" ? 20 : label === "높음" ? 12 : label === "보통" ? 6 : 1);
    return `
      <div class="risk-bar-row">
        <span>${label}</span>
        <div class="risk-bar-track"><div class="risk-bar-fill ${level.className}" style="width:${Math.max(4, (count / max) * 100)}%"></div></div>
        <strong>${count}</strong>
      </div>
    `;
  }).join("");
}

function renderRecentRows() {
  const rows = flattenHazards().slice(0, 12);
  $("#recentRows").innerHTML = rows.length ? rows.map((item) => {
    const before = riskLevel(item.beforeScore);
    const after = riskLevel(item.afterScore);
    return `
      <tr data-edit="${item.assessment.id}">
        <td>${escapeHtml(item.assessment.date)}</td>
        <td>${escapeHtml(item.assessment.department)}</td>
        <td><strong>${escapeHtml(item.assessment.task)}</strong><br><span>${escapeHtml(item.assessment.location || "-")}</span></td>
        <td>${escapeHtml(item.hazard)}</td>
        <td><span class="tag ${before.className}">${before.label} ${item.beforeScore}</span></td>
        <td><span class="tag ${after.className}">${after.label} ${item.afterScore}</span></td>
        <td>${escapeHtml(item.status || "계획")}</td>
      </tr>
    `;
  }).join("") : `<tr><td colspan="7"><div class="empty">등록된 평가가 없습니다</div></td></tr>`;
}

function isOverdue(item) {
  return item.dueDate && item.status !== "완료" && item.dueDate < today();
}

function renderUrgentActions() {
  const urgent = flattenHazards()
    .filter((item) => item.status !== "완료" && (item.beforeScore >= 12 || isOverdue(item)))
    .slice(0, 5);
  $("#urgentActions").innerHTML = urgent.length ? urgent.map(renderActionCard).join("") : `<div class="empty">긴급 조치가 없습니다</div>`;
}

function renderActionCard(item) {
  const level = riskLevel(item.beforeScore);
  const overdue = isOverdue(item);
  return `
    <article class="action-card" data-assessment="${item.assessment.id}" data-hazard="${item.hazardIndex}">
      <div class="action-card-head">
        <div>
          <h3>${escapeHtml(item.assessment.task)}</h3>
          <p>${escapeHtml(item.assessment.department)} · ${escapeHtml(item.hazard)}</p>
        </div>
        <span class="tag ${level.className}">${level.label} ${item.beforeScore}</span>
      </div>
      <p>${escapeHtml(item.improvement || "개선대책 미입력")}</p>
      <div class="tag-row">
        <span class="tag">${escapeHtml(item.owner || "담당자 미정")}</span>
        <span class="tag ${overdue ? "critical" : ""}">${escapeHtml(item.dueDate || "기한 미정")}</span>
      </div>
      <select data-action-status>
        ${["계획", "진행", "완료"].map((status) => `<option${status === item.status ? " selected" : ""}>${status}</option>`).join("")}
      </select>
    </article>
  `;
}

function renderActions() {
  const status = $("#statusFilter").value;
  const query = normalize($("#actionSearch").value).toLowerCase();
  let rows = flattenHazards();
  if (status !== "all") rows = rows.filter((item) => item.status === status);
  if (query) {
    rows = rows.filter((item) => [item.assessment.task, item.assessment.department, item.owner, item.hazard].join(" ").toLowerCase().includes(query));
  }
  $("#actionSummary").textContent = `${rows.length}건 표시`;
  $("#actionBoard").innerHTML = rows.length ? rows.map(renderActionCard).join("") : `<div class="empty">조건에 맞는 조치가 없습니다</div>`;
}

function updateActionStatus(card, status) {
  const assessment = assessments.find((item) => item.id === card.dataset.assessment);
  const hazard = assessment?.hazards[Number(card.dataset.hazard)];
  if (!hazard) return;
  hazard.status = status;
  assessment.updatedAt = new Date().toISOString();
  saveData();
  render();
}

function renderLibrary() {
  $("#libraryGrid").innerHTML = LIBRARY.map((item) => `
    <article class="library-card">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${item.hazards.map((hazard) => escapeHtml(hazard[0])).join(" · ")}</p>
      <div class="tag-row">${item.keywords.map((word) => `<span class="tag">${escapeHtml(word)}</span>`).join("")}</div>
      <button class="btn small" data-template="${item.key}" type="button">이 작업으로 작성</button>
    </article>
  `).join("");
}

function renderMatrix() {
  $("#riskMatrix").innerHTML = "";
  for (let severity = 5; severity >= 1; severity -= 1) {
    for (let likelihood = 1; likelihood <= 5; likelihood += 1) {
      const score = likelihood * severity;
      const level = riskLevel(score);
      const cell = document.createElement("div");
      cell.className = `matrix-cell ${level.className}`;
      cell.style.background = level.className === "critical" ? "#fed7d7" : level.className === "high" ? "#ffedd5" : level.className === "medium" ? "#fef3c7" : "#dcfce7";
      cell.textContent = score;
      $("#riskMatrix").appendChild(cell);
    }
  }
}

function fillForm(item) {
  editingId = item.id;
  const form = $("#riskForm");
  for (const key of ["date", "site", "department", "assessor", "task", "location", "frequency", "description"]) {
    if (form.elements[key]) form.elements[key].value = item[key] || "";
  }
  $("#hazardRows").innerHTML = "";
  item.hazards.forEach(addHazardRow);
  setView("assessment");
}

function exportCsv() {
  const header = ["평가일", "사업장", "부서", "평가자", "작업", "장소", "위험요인", "사고유형", "현재조치", "개선대책", "가능성", "중대성", "위험도", "개선후가능성", "개선후중대성", "개선후위험도", "담당자", "기한", "상태"];
  const rows = flattenHazards().map((item) => [
    item.assessment.date,
    item.assessment.site,
    item.assessment.department,
    item.assessment.assessor,
    item.assessment.task,
    item.assessment.location,
    item.hazard,
    item.type,
    item.currentControl,
    item.improvement,
    item.likelihood,
    item.severity,
    item.beforeScore,
    item.afterLikelihood,
    item.afterSeverity,
    item.afterScore,
    item.owner,
    item.dueDate,
    item.status
  ]);
  const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `위험성평가_${today()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function resetAll() {
  if (!confirm("저장된 위험성평가 데이터를 모두 초기화할까요?")) return;
  assessments = [];
  saveData();
  clearForm();
  render();
}

function render() {
  renderMetrics();
  renderRiskBars();
  renderRecentRows();
  renderUrgentActions();
  renderActions();
  renderLibrary();
}

function bindEvents() {
  $("#sidebarToggleBtn").addEventListener("click", () => setSidebar(!document.body.classList.contains("sidebar-collapsed")));
  $("#sidebarCloseBtn").addEventListener("click", () => setSidebar(true));
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  $$("[data-jump]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.jump)));
  $("#newAssessmentBtn").addEventListener("click", () => {
    clearForm();
    setView("assessment");
  });
  $("#applyTemplateBtn").addEventListener("click", applyTemplate);
  $("#suggestBtn").addEventListener("click", suggestHazards);
  $("#addHazardBtn").addEventListener("click", () => addHazardRow());
  $("#clearFormBtn").addEventListener("click", clearForm);
  $("#riskForm").addEventListener("submit", saveAssessment);
  $("#exportCsvBtn").addEventListener("click", exportCsv);
  $("#printBtn").addEventListener("click", () => window.print());
  $("#resetBtn").addEventListener("click", resetAll);
  $("#statusFilter").addEventListener("change", renderActions);
  $("#actionSearch").addEventListener("input", renderActions);
  $("#recentRows").addEventListener("click", (event) => {
    const row = event.target.closest("[data-edit]");
    if (!row) return;
    const item = assessments.find((entry) => entry.id === row.dataset.edit);
    if (item) fillForm(item);
  });
  document.addEventListener("change", (event) => {
    const status = event.target.closest("[data-action-status]");
    if (status) updateActionStatus(status.closest(".action-card"), status.value);
  });
  document.addEventListener("click", (event) => {
    const template = event.target.closest("[data-template]");
    if (!template) return;
    $("#templateSelect").value = template.dataset.template;
    applyTemplate();
  });
}

function boot() {
  loadData();
  populateTemplates();
  initForm();
  renderMatrix();
  bindEvents();
  setSidebar(localStorage.getItem(SIDEBAR_KEY) !== "0");
  setView(localStorage.getItem(ACTIVE_VIEW_KEY) || "dashboard");
  saveData();
}

boot();
