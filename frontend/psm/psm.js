const state = {
  documents: [],
  logs: [],
  missingChecklist: [],
  changes: { newFiles: [], modifiedFiles: [], removedFiles: [], baselineAt: null },
  rootPath: "",
  view: "dashboard",
  selected: null,
  search: "",
  selectedFolder: "",
  folderPanelOpen: false,
  expandedFolders: new Set([""]),
  insightCollapsed: true,
  latestOnly: false,
  smartFilter: "",
  filters: { company: "", category: "", status: "", extension: "" }
};

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
const formatDate = (value) => value ? new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : "-";
const formatSize = (bytes) => bytes >= 1073741824 ? `${(bytes / 1073741824).toFixed(1)}GB` : bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)}MB` : bytes >= 1024 ? `${(bytes / 1024).toFixed(0)}KB` : `${bytes}B`;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
}

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "요청을 처리하지 못했습니다.");
  return data;
}

function statusBadge(status) {
  const cls = status === "최신" ? "latest" : status === "검토필요" ? "review" : "old";
  return `<span class="badge ${cls}">${esc(status)}</span>`;
}

function canPreview(document) {
  return ["PDF", "JPG", "JPEG", "PNG", "GIF", "TXT"].includes(document?.extension);
}

function previewControl(document) {
  return canPreview(document)
    ? `<button class="btn small preview-file" data-id="${document.id}" type="button">미리보기</button>`
    : `<span class="unsupported-preview" title="${esc(document.extension)} 파일은 앱 미리보기를 지원하지 않습니다.">미리보기 미지원</span>`;
}

function documentNumberParts(name) {
  const match = String(name || "").match(/^\s*(\d+(?:[.-]\d+)*)/);
  return match ? match[1].split(/[.-]/).map(Number) : null;
}

function compareDocumentNumber(a, b) {
  const aParts = documentNumberParts(a.name);
  const bParts = documentNumberParts(b.name);
  if (aParts && !bParts) return -1;
  if (!aParts && bParts) return 1;
  if (aParts && bParts) {
    const length = Math.max(aParts.length, bParts.length);
    for (let i = 0; i < length; i += 1) {
      const difference = (aParts[i] ?? -1) - (bParts[i] ?? -1);
      if (difference) return difference;
    }
  }
  const nameOrder = a.name.localeCompare(b.name, "ko", { numeric: true, sensitivity: "base" });
  return nameOrder || a.relativePath.localeCompare(b.relativePath, "ko", { numeric: true, sensitivity: "base" });
}

function switchView(view) {
  state.view = view;
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === `${view}View`));
  if (view === "documents") renderDocuments();
  if (view === "favorites") renderFavorites();
  if (view === "reviews") renderReviews();
  if (view === "missing") renderMissing();
  if (view === "changes") renderChangeDetection();
  if (view === "history") renderHistory();
}

async function loadData(force = false) {
  $("statusBox").textContent = "공유폴더 문서를 읽는 중입니다.";
  try {
    const [docs, logs] = await Promise.all([
      api(`/api/psm/documents${force ? "?force=1" : ""}`),
      api("/api/psm/audit-logs")
    ]);
    state.documents = docs.documents.map((doc) => ({
      ...doc,
      searchText: `${doc.name} ${doc.relativePath} ${doc.owner} ${doc.tags.join(" ")} ${doc.note}`.toLowerCase()
    }));
    state.logs = logs.auditLogs;
    state.missingChecklist = docs.missingChecklist || [];
    state.changes = docs.changes || state.changes;
    state.rootPath = docs.rootPath;
    $("statusBox").textContent = `연결됨\n${docs.rootPath}\n${formatDate(docs.scannedAt)} 스캔`;
    buildFilters();
    renderAll();
    toast(`${state.documents.length.toLocaleString()}개 문서를 불러왔습니다.`);
  } catch (error) {
    $("statusBox").textContent = `연결 실패\n${error.message}`;
    toast(error.message);
  }
}

function buildFilters() {
  const fill = (id, values, label) => {
    const el = $(id);
    const current = el.value;
    el.innerHTML = `<option value="">${label}</option>` + [...new Set(values)].sort().map((v) => `<option>${esc(v)}</option>`).join("");
    el.value = current;
  };
  fill("companyFilter", state.documents.map((d) => d.company), "전체 회사");
  fill("categoryFilter", state.documents.map((d) => d.category), "전체 분류");
  fill("extensionFilter", state.documents.map((d) => d.extension), "전체 형식");
}

function renderAll() {
  renderDashboard();
  renderFolderTree();
  renderFolderInsight();
  renderDocuments();
  renderFavorites();
  renderReviews();
  renderMissing();
  renderChangeDetection();
  renderHistory();
}

function documentsInSelectedFolder() {
  return state.documents.filter((d) => !state.selectedFolder || d.relativePath === state.selectedFolder || d.relativePath.startsWith(`${state.selectedFolder}/`));
}

function folderFileCounts() {
  const counts = { "": state.documents.length };
  state.documents.forEach((doc) => {
    const parts = String(doc.directory || "").split("/").filter(Boolean);
    let current = "";
    parts.forEach((part) => {
      current = current ? `${current}/${part}` : part;
      counts[current] = (counts[current] || 0) + 1;
    });
  });
  return counts;
}

function buildFolderTree() {
  const root = { name: "전체 공유폴더", path: "", children: new Map() };
  state.documents.forEach((doc) => {
    let node = root;
    String(doc.directory || "").split("/").filter(Boolean).forEach((part) => {
      const nextPath = node.path ? `${node.path}/${part}` : part;
      if (!node.children.has(part)) node.children.set(part, { name: part, path: nextPath, children: new Map() });
      node = node.children.get(part);
    });
  });
  return root;
}

function renderFolderTree() {
  const rootEl = $("folderTree");
  if (!rootEl) return;
  document.querySelector(".folder-layout")?.classList.toggle("folder-open", state.folderPanelOpen);
  $("toggleFolderPanelBtn").textContent = state.folderPanelOpen ? "폴더 닫기" : "폴더 열기";
  const counts = folderFileCounts();
  const shouldShowChildren = (path) => state.expandedFolders.has(path) || state.selectedFolder.startsWith(`${path}/`);
  const renderNode = (node, depth = 0) => [...node.children.values()]
    .sort((a, b) => a.name.localeCompare(b.name, "ko", { numeric: true, sensitivity: "base" }))
    .map((child) => {
      const hasChildren = child.children.size > 0;
      const expanded = hasChildren && shouldShowChildren(child.path);
      return `<div>
        <button class="folder-node ${state.selectedFolder === child.path ? "active" : ""}" data-folder-path="${esc(child.path)}" type="button" style="--depth:${depth}">
          <span class="folder-arrow ${hasChildren ? (expanded ? "open" : "closed") : "empty"}">${hasChildren ? "▸" : ""}</span>
          <span class="folder-label">${esc(child.name)}</span><em>${(counts[child.path] || 0).toLocaleString()}</em>
        </button>
        ${expanded ? renderNode(child, depth + 1) : ""}
      </div>`;
    }).join("");
  rootEl.innerHTML = `<button class="folder-node ${state.selectedFolder === "" ? "active" : ""}" data-folder-path="" type="button" style="--depth:0"><span class="folder-arrow open">▸</span><span class="folder-label">전체 공유폴더</span><em>${counts[""].toLocaleString()}</em></button>${renderNode(buildFolderTree(), 1)}`;
}

function groupCount(items, key) {
  return items.reduce((acc, item) => {
    const name = item[key] || "미분류";
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
}

function folderStats(folderPath) {
  const now = Date.now();
  const month = 30 * 86400000;
  const docs = state.documents.filter((doc) => !folderPath || doc.relativePath === folderPath || doc.relativePath.startsWith(`${folderPath}/`));
  const total = docs.length;
  const ownerMissing = docs.filter((doc) => !doc.owner).length;
  const reviewUnset = docs.filter((doc) => !doc.reviewDueDate).length;
  const latest = docs.filter((doc) => doc.latestCandidate).length;
  const recent = docs.filter((doc) => now - new Date(doc.modifiedAt).getTime() <= month).length;
  const risk = Math.min(100, Math.round((ownerMissing / Math.max(1, total)) * 35 + (reviewUnset / Math.max(1, total)) * 25 + (latest / Math.max(1, total)) * 25 + (recent / Math.max(1, total)) * 15));
  return { docs, total, ownerMissing, reviewUnset, latest, recent, risk, health: Math.max(0, 100 - risk) };
}

function topFolders(limit = 10) {
  const folders = new Map();
  state.documents.forEach((doc) => {
    const top = String(doc.relativePath || "").split("/").filter(Boolean)[0] || "전체 공유폴더";
    folders.set(top, (folders.get(top) || 0) + 1);
  });
  return [...folders.entries()]
    .map(([path, count]) => ({ path, count, ...folderStats(path) }))
    .sort((a, b) => a.path.localeCompare(b.path, "ko", { numeric: true, sensitivity: "base" }))
    .slice(0, limit);
}

function renderCommandCenter() {
  const all = folderStats("");
  const tasks = [
    ["담당자 지정 필요", all.ownerMissing, "ownerMissing", "문서 책임자를 등록하면 감사 대응이 쉬워집니다."],
    ["검토일 미등록", all.reviewUnset, "reviewUnset", "개정일 기준 다음 검토일을 잡아두면 놓치지 않습니다."],
    ["최신본 후보 정리", all.latest, "latest", "같은 이름의 여러 버전 중 대표본을 확인하세요."],
    ["최근 30일 수정", all.recent, "recent", "변경된 문서만 먼저 확인할 수 있습니다."]
  ];
  $("todayActions").innerHTML = tasks.map(([label, count, filter, hint]) => `
    <button class="today-card" data-smart-filter="${filter}" data-jump="documents" type="button">
      <span>${label}</span>
      <strong>${count.toLocaleString()}</strong>
      <em>${hint}</em>
    </button>`).join("");
}

function renderBinderShelf() {
  const max = Math.max(1, ...topFolders(12).map((item) => item.count));
  $("binderShelf").innerHTML = topFolders(12).map((item) => {
    const height = 118 + Math.round((item.count / max) * 82);
    const tone = item.risk >= 70 ? "danger" : item.risk >= 40 ? "warning" : "good";
    return `<button class="binder ${tone}" data-folder-path="${esc(item.path)}" data-jump="documents" type="button" style="--binder-height:${height}px">
      <span>${esc(item.path)}</span>
      <strong>${item.count.toLocaleString()}</strong>
      <em>건강 ${item.health}점</em>
    </button>`;
  }).join("") || `<div class="empty">표시할 폴더가 없습니다.</div>`;
}

function renderDashboard() {
  const now = Date.now();
  const month = 30 * 86400000;
  const due = state.documents.filter((d) => d.reviewDueDate && new Date(d.reviewDueDate).getTime() <= now + month).length;
  renderCommandCenter();
  renderBinderShelf();
  $("totalCount").textContent = state.documents.length.toLocaleString();
  $("favoriteCount").textContent = state.documents.filter((d) => d.favorite).length.toLocaleString();
  $("dueCount").textContent = due.toLocaleString();
  $("missingCount").textContent = state.missingChecklist.filter((item) => item.status === "누락").length.toLocaleString();

  const groups = groupCount(state.documents, "company");
  const max = Math.max(1, ...Object.values(groups));
  $("companySummary").innerHTML = Object.entries(groups).map(([name, count]) => `<div class="summary-row"><span>${esc(name)}</span><div class="bar"><i style="width:${count / max * 100}%"></i></div><strong>${count.toLocaleString()}</strong></div>`).join("");
  $("recentDocuments").innerHTML = state.documents.slice(0, 8).map((d) => docListItem(d, formatDate(d.modifiedAt))).join("") || empty("문서가 없습니다.");

  const categories = groupCount(state.documents, "category");
  $("categoryCards").innerHTML = Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([name, count]) => `<div class="category-card" data-category="${esc(name)}"><span>${esc(name)}</span><strong>${count.toLocaleString()}</strong></div>`).join("");
}

function filteredDocuments() {
  const q = state.search.trim().toLowerCase();
  return state.documents
    .filter((d) => (!q || d.searchText.includes(q))
      && (!state.selectedFolder || d.relativePath === state.selectedFolder || d.relativePath.startsWith(`${state.selectedFolder}/`))
      && (!state.filters.company || d.company === state.filters.company)
      && (!state.filters.category || d.category === state.filters.category)
      && (!state.filters.status || d.status === state.filters.status)
      && (!state.filters.extension || d.extension === state.filters.extension)
      && (!state.smartFilter || smartFilterMatch(d, state.smartFilter))
      && (!state.latestOnly || d.latestCandidate))
    .sort(compareDocumentNumber);
}

function smartFilterMatch(doc, filter) {
  const now = Date.now();
  const month = 30 * 86400000;
  if (filter === "ownerMissing") return !doc.owner;
  if (filter === "due") return doc.reviewDueDate && new Date(doc.reviewDueDate).getTime() <= now + month;
  if (filter === "latest") return Boolean(doc.latestCandidate);
  if (filter === "recent") return now - new Date(doc.modifiedAt).getTime() <= month;
  if (filter === "preview") return canPreview(doc);
  if (filter === "managed") return Boolean(doc.owner || doc.reviewDueDate || doc.note || doc.version || doc.favorite);
  if (filter === "reviewUnset") return !doc.reviewDueDate;
  return true;
}

function renderFolderInsight() {
  const docs = documentsInSelectedFolder();
  const now = Date.now();
  const month = 30 * 86400000;
  const stats = {
    total: docs.length,
    managed: docs.filter((d) => d.owner || d.reviewDueDate || d.note || d.version || d.favorite).length,
    ownerMissing: docs.filter((d) => !d.owner).length,
    due: docs.filter((d) => d.reviewDueDate && new Date(d.reviewDueDate).getTime() <= now + month).length,
    latest: docs.filter((d) => d.latestCandidate).length,
    recent: docs.filter((d) => now - new Date(d.modifiedAt).getTime() <= month).length,
    preview: docs.filter(canPreview).length
  };
  const riskScore = Math.min(100, Math.round((stats.ownerMissing / Math.max(1, stats.total)) * 45 + (stats.due / Math.max(1, stats.total)) * 35 + (stats.latest / Math.max(1, stats.total)) * 20));
  document.querySelector(".folder-insight")?.classList.toggle("collapsed", state.insightCollapsed);
  $("toggleInsightBtn").textContent = state.insightCollapsed ? "요약 펼치기" : "요약 접기";
  $("folderInsightTitle").textContent = state.selectedFolder || "전체 공유폴더";
  $("folderInsightCards").innerHTML = [
    ["total", "전체 문서", stats.total, ""],
    ["managed", "관리정보 있음", stats.managed, "managed"],
    ["ownerMissing", "담당자 없음", stats.ownerMissing, "ownerMissing"],
    ["due", "검토 예정·지연", stats.due, "due"],
    ["latest", "최신본 후보", stats.latest, "latest"],
    ["recent", "최근 30일 수정", stats.recent, "recent"],
    ["preview", "미리보기 가능", stats.preview, "preview"],
    ["risk", "관리주의도", `${riskScore}점`, ""]
  ].map(([key, label, value, filter]) => `<button class="insight-card ${state.smartFilter === filter ? "active" : ""} ${key === "ownerMissing" || key === "due" || key === "risk" ? "warn" : ""}" ${filter ? `data-smart-filter="${filter}"` : ""} type="button"><span>${label}</span><strong>${typeof value === "number" ? value.toLocaleString() : value}</strong></button>`).join("");

  const extensions = Object.entries(groupCount(docs, "extension")).sort((a, b) => b[1] - a[1]).slice(0, 8);
  $("folderExtensionChips").innerHTML = extensions.map(([name, count]) => `<button class="chip" data-extension-chip="${esc(name)}" type="button">${esc(name)} ${count.toLocaleString()}</button>`).join("") || `<span class="meta">파일 없음</span>`;
  $("folderRecentList").innerHTML = [...docs].sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt)).slice(0, 5).map((d) => `<button class="mini-link" data-id="${d.id}" type="button"><strong>${esc(d.name)}</strong><span>${formatDate(d.modifiedAt)} · ${esc(d.directory || "전체 공유폴더")}</span></button>`).join("") || `<span class="meta">최근 문서 없음</span>`;
}

function renderDocuments() {
  const docs = filteredDocuments();
  const limit = state.search.trim() ? 200 : 500;
  const smartLabel = state.smartFilter ? " · 빠른필터 적용" : "";
  $("resultCount").textContent = (docs.length > limit ? `${docs.length.toLocaleString()}개 중 ${limit}개 표시` : `${docs.length.toLocaleString()}개`) + smartLabel;
  $("folderBreadcrumb").textContent = state.selectedFolder || "전체 공유폴더";
  renderFolderInsight();
  $("latestOnlyBtn").classList.toggle("active", state.latestOnly);
  $("documentRows").innerHTML = docs.slice(0, limit).map((d) => `<tr>
    <td><button class="star-btn ${d.favorite ? "on" : ""}" data-favorite-id="${d.id}" type="button">${d.favorite ? "★" : "☆"}</button></td>
    <td>${statusBadge(d.status)}</td>
    <td><span class="document-name" data-id="${d.id}">${esc(d.name)}</span>${d.latestCandidate ? `<span class="mini-badge">최신후보</span>` : ""}${d.relatedVersions ? `<span class="path-line">관련 버전 ${d.relatedVersions}개 · ${esc(d.directory)}</span>` : `<span class="path-line" title="${esc(d.relativePath)}">${esc(d.directory)}</span>`}</td>
    <td>${esc(d.company)}</td>
    <td>${esc(d.category)}</td>
    <td>${esc(d.owner || "-")}</td>
    <td>${formatDate(d.revisionDate)}</td>
    <td>${dueText(d.reviewDueDate)}</td>
    <td><span class="badge">${esc(d.extension)}</span><div class="meta">${formatSize(d.size)}</div></td>
    <td>${previewControl(d)} <button class="btn small download-file" data-id="${d.id}" type="button">다운로드</button></td>
  </tr>`).join("") || `<tr><td colspan="10">${empty("조건에 맞는 문서가 없습니다.")}</td></tr>`;
}

function dueText(value) {
  if (!value) return "-";
  const days = Math.ceil((new Date(value).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const cls = days < 0 ? "due-over" : days <= 30 ? "due-soon" : "";
  return `<span class="${cls}">${formatDate(value)}${days < 0 ? ` (${Math.abs(days)}일 지연)` : days <= 30 ? ` (D-${days})` : ""}</span>`;
}

function docListItem(doc, rightText = "") {
  return `<article class="review-item"><div><strong data-id="${doc.id}">${esc(doc.name)}</strong><div class="meta">${esc(doc.company)} · ${esc(doc.category)} · ${esc(doc.owner || "담당 미지정")}</div><div class="meta">${esc(doc.relativePath)}</div></div><div class="review-actions">${rightText ? `<span class="meta">${esc(rightText)}</span>` : ""}${previewControl(doc)}<button class="btn small detail-btn" data-id="${doc.id}" type="button">관리</button></div></article>`;
}

function renderFavorites() {
  const docs = state.documents.filter((d) => d.favorite).sort(compareDocumentNumber);
  $("favoriteRows").innerHTML = docs.map((d) => docListItem(d, d.reviewDueDate ? `검토 ${formatDate(d.reviewDueDate)}` : "")).join("") || empty("즐겨찾기 문서가 없습니다. 문서함에서 별표를 눌러 추가하세요.");
}

function renderReviews() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const docs = state.documents.filter((d) => d.reviewDueDate).sort((a, b) => new Date(a.reviewDueDate) - new Date(b.reviewDueDate));
  const overdue = docs.filter((d) => new Date(d.reviewDueDate) < now);
  const soon = docs.filter((d) => new Date(d.reviewDueDate) >= now && new Date(d.reviewDueDate) - now <= 30 * 86400000);
  $("overdueCount").textContent = overdue.length;
  $("soonCount").textContent = soon.length;
  $("unsetCount").textContent = state.documents.filter((d) => !d.reviewDueDate).length.toLocaleString();
  $("reviewRows").innerHTML = docs.map((d) => docListItem(d, dueText(d.reviewDueDate).replace(/<[^>]+>/g, ""))).join("") || empty("검토일이 등록된 문서가 없습니다.");
}

function renderMissing() {
  $("missingRows").innerHTML = state.missingChecklist.map((item) => `<article class="check-item ${item.status === "누락" ? "missing" : ""}">
    <div><strong>${esc(item.title)}</strong><div class="meta">${esc(item.id)} · 키워드: ${esc(item.keywords.join(", "))}</div>${item.examples?.length ? `<div class="meta">예: ${esc(item.examples.map((x) => x.name).join(" / "))}</div>` : ""}</div>
    <div><span class="badge ${item.status === "누락" ? "review" : "latest"}">${esc(item.status)}</span><strong>${item.count}</strong></div>
  </article>`).join("") || empty("체크리스트가 없습니다.");
}

function renderChangeDetection() {
  $("newFileCount").textContent = state.changes.newFiles?.length || 0;
  $("modifiedFileCount").textContent = state.changes.modifiedFiles?.length || 0;
  $("removedFileCount").textContent = state.changes.removedFiles?.length || 0;
  const rows = [
    ...(state.changes.newFiles || []).slice(0, 30).map((d) => ({ ...d, label: "신규" })),
    ...(state.changes.modifiedFiles || []).slice(0, 30).map((d) => ({ ...d, label: "수정" }))
  ];
  $("changeDetectRows").innerHTML = rows.map((d) => docListItem(d, d.label)).join("") || empty(state.changes.baselineAt ? "기준 저장 이후 변경된 파일이 없습니다." : "아직 기준 상태가 없습니다. 현재 상태를 기준으로 저장하세요.");
}

function renderHistory() {
  const q = $("historySearch")?.value.trim().toLowerCase() || "";
  const logs = state.logs.filter((l) => !q || `${l.documentName} ${l.actor} ${l.action}`.toLowerCase().includes(q));
  $("historyRows").innerHTML = logs.map((l) => `<article class="change-item"><div><strong>${esc(l.documentName)}</strong><div class="meta">${esc(l.action)} · ${esc(l.actor)}</div><div class="meta">${esc(l.relativePath)}</div></div><span class="meta">${formatDate(l.createdAt)}</span></article>`).join("") || empty("변경 이력이 없습니다.");
}

function empty(message) {
  return `<div class="empty">${esc(message)}</div>`;
}

function openModal(id) {
  const d = state.documents.find((item) => item.id === id);
  if (!d) return;
  state.selected = d;
  $("modalTitle").textContent = d.name;
  $("modalExtension").textContent = d.extension;
  $("modalPath").textContent = d.relativePath;
  $("metaFavorite").checked = d.favorite;
  $("metaStatus").value = d.status;
  $("metaOwner").value = d.owner;
  $("metaVersion").value = d.version;
  $("metaRevisionDate").value = d.revisionDate || "";
  $("metaReviewCycle").value = String(d.reviewCycleMonths || 12);
  $("metaReviewDueDate").value = d.reviewDueDate || "";
  $("metaTags").value = d.tags.join(", ");
  $("metaNote").value = d.note;
  $("latestHint").textContent = d.latestCandidate ? `최신본 후보 · 관련 버전 ${d.relatedVersions || 1}개` : d.relatedVersions ? `관련 버전 ${d.relatedVersions}개` : "";
  $("previewBtn").textContent = canPreview(d) ? "미리보기" : "미리보기 미지원";
  $("previewBtn").disabled = !canPreview(d);
  $("documentModal").hidden = false;
}

function addMonths(dateText, months) {
  const date = dateText ? new Date(dateText) : new Date();
  date.setMonth(date.getMonth() + Number(months || 12));
  return date.toISOString().slice(0, 10);
}

async function saveMetadata(extra = {}) {
  if (!state.selected) return;
  const payload = {
    status: $("metaStatus").value,
    owner: $("metaOwner").value,
    version: $("metaVersion").value,
    revisionDate: $("metaRevisionDate").value,
    reviewCycleMonths: Number($("metaReviewCycle").value || 12),
    reviewDueDate: $("metaReviewDueDate").value,
    favorite: $("metaFavorite").checked,
    tags: $("metaTags").value.split(",").map((v) => v.trim()).filter(Boolean),
    note: $("metaNote").value,
    actor: "PSM 사용자",
    ...extra
  };
  try {
    const data = await api(`/api/psm/documents/${state.selected.id}`, { method: "PUT", body: JSON.stringify(payload) });
    const index = state.documents.findIndex((d) => d.id === data.document.id);
    state.documents[index] = { ...data.document, searchText: `${data.document.name} ${data.document.relativePath} ${data.document.owner} ${data.document.tags.join(" ")} ${data.document.note}`.toLowerCase() };
    state.selected = state.documents[index];
    await loadLogs();
    renderAll();
    toast("관리정보를 저장했습니다.");
  } catch (error) {
    toast(error.message);
  }
}

async function loadLogs() {
  const data = await api("/api/psm/audit-logs");
  state.logs = data.auditLogs;
}

async function logView(document, action) {
  if (!document) return;
  await api(`/api/psm/documents/${document.id}/view`, { method: "POST", body: JSON.stringify({ action, actor: "PSM 사용자" }) }).catch(() => {});
  await loadLogs().catch(() => {});
  renderHistory();
}

function downloadDocument(document = state.selected) {
  if (!document) return;
  logView(document, "문서 다운로드");
  window.location.href = `/api/psm/download?relativePath=${encodeURIComponent(document.relativePath)}`;
}

async function copyDocumentPath() {
  if (!state.selected) return;
  const fullPath = `${state.rootPath}\\${state.selected.relativePath.replace(/\//g, "\\")}`;
  try {
    await navigator.clipboard.writeText(fullPath);
    toast("공유폴더 경로를 복사했습니다.");
  } catch {
    toast(fullPath);
  }
}

function previewDocument(document = state.selected) {
  if (!document) return;
  if (!canPreview(document)) {
    toast(`${document.extension} 파일은 미리보기를 지원하지 않습니다. 다운로드를 사용하세요.`);
    return;
  }
  logView(document, "문서 미리보기");
  $("previewTitle").textContent = document.name;
  const url = `/api/psm/preview?relativePath=${encodeURIComponent(document.relativePath)}`;
  $("previewBody").innerHTML = document.extension === "PDF" || document.extension === "TXT"
    ? `<iframe src="${url}" title="${esc(document.name)}"></iframe>`
    : `<img src="${url}" alt="${esc(document.name)}">`;
  $("previewModal").hidden = false;
}

async function toggleFavorite(id) {
  const doc = state.documents.find((item) => item.id === id);
  if (!doc) return;
  state.selected = doc;
  $("metaFavorite").checked = !doc.favorite;
  $("metaStatus").value = doc.status;
  $("metaOwner").value = doc.owner;
  $("metaVersion").value = doc.version;
  $("metaRevisionDate").value = doc.revisionDate || "";
  $("metaReviewCycle").value = String(doc.reviewCycleMonths || 12);
  $("metaReviewDueDate").value = doc.reviewDueDate || "";
  $("metaTags").value = doc.tags.join(", ");
  $("metaNote").value = doc.note;
  await saveMetadata();
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-view]");
  if (nav) switchView(nav.dataset.view);
  const jump = event.target.closest("[data-jump]");
  if (jump?.dataset.smartFilter) {
    state.smartFilter = state.smartFilter === jump.dataset.smartFilter ? "" : jump.dataset.smartFilter;
    switchView(jump.dataset.jump);
    return;
  }
  if (jump) switchView(jump.dataset.jump);
  const item = event.target.closest("[data-id], .detail-btn");
  if (item && !item.classList.contains("download-file") && !item.classList.contains("preview-file")) openModal(item.dataset.id);
  const favorite = event.target.closest("[data-favorite-id]");
  if (favorite) toggleFavorite(favorite.dataset.favoriteId);
  const preview = event.target.closest(".preview-file");
  if (preview) previewDocument(state.documents.find((x) => x.id === preview.dataset.id));
  const download = event.target.closest(".download-file");
  if (download) downloadDocument(state.documents.find((x) => x.id === download.dataset.id));
  const card = event.target.closest("[data-category]");
  if (card) {
    state.selectedFolder = "";
    state.smartFilter = "";
    state.filters.category = card.dataset.category;
    $("categoryFilter").value = state.filters.category;
    renderFolderTree();
    switchView("documents");
  }
  const folderNode = event.target.closest("[data-folder-path]");
  if (folderNode) {
    const nextFolder = folderNode.dataset.folderPath || "";
    const wasExpanded = state.expandedFolders.has(nextFolder);
    state.selectedFolder = nextFolder;
    state.smartFilter = "";
    state.folderPanelOpen = false;
    if (nextFolder) {
      if (wasExpanded) state.expandedFolders.delete(nextFolder);
      else state.expandedFolders.add(nextFolder);
    }
    const parts = nextFolder.split("/").filter(Boolean);
    parts.reduce((acc, part) => {
      const next = acc ? `${acc}/${part}` : part;
      if (next !== nextFolder) state.expandedFolders.add(next);
      return next;
    }, "");
    renderFolderTree();
    renderDocuments();
    switchView("documents");
  }
  const smart = event.target.closest("[data-smart-filter]");
  if (smart) {
    state.smartFilter = state.smartFilter === smart.dataset.smartFilter ? "" : smart.dataset.smartFilter;
    renderDocuments();
  }
  const extChip = event.target.closest("[data-extension-chip]");
  if (extChip) {
    state.filters.extension = extChip.dataset.extensionChip;
    $("extensionFilter").value = state.filters.extension;
    renderDocuments();
  }
});

document.querySelectorAll("#companyFilter,#categoryFilter,#statusFilter,#extensionFilter").forEach((el) => el.addEventListener("change", () => {
  state.filters.company = $("companyFilter").value;
  state.filters.category = $("categoryFilter").value;
  state.filters.status = $("statusFilter").value;
  state.filters.extension = $("extensionFilter").value;
  state.smartFilter = "";
  renderDocuments();
}));

let searchTimer = null;
$("globalSearch").addEventListener("input", (event) => {
  state.search = event.target.value;
  if (state.view !== "documents") {
    switchView("documents");
    return;
  }
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderDocuments, 120);
});

$("historySearch").addEventListener("input", renderHistory);
$("sidebarToggleBtn").addEventListener("click", () => document.body.classList.toggle("sidebar-collapsed"));
$("scanBtn").addEventListener("click", () => loadData(true));
$("topScanBtn").addEventListener("click", () => loadData(true));
$("exportExcelBtn").addEventListener("click", () => { window.location.href = "/api/psm/export.xlsx"; });
$("latestOnlyBtn").addEventListener("click", () => { state.latestOnly = !state.latestOnly; renderDocuments(); });
$("folderAllBtn").addEventListener("click", () => { state.selectedFolder = ""; state.smartFilter = ""; renderFolderTree(); renderDocuments(); });
$("toggleFolderPanelBtn").addEventListener("click", () => { state.folderPanelOpen = !state.folderPanelOpen; renderFolderTree(); });
$("toggleInsightBtn").addEventListener("click", () => { state.insightCollapsed = !state.insightCollapsed; renderFolderInsight(); });
$("clearSmartFilterBtn").addEventListener("click", () => { state.smartFilter = ""; renderDocuments(); });
$("saveSnapshotBtn").addEventListener("click", async () => {
  try {
    const result = await api("/api/psm/snapshot", { method: "POST", body: "{}" });
    toast(`${result.files.toLocaleString()}개 파일을 변경감지 기준으로 저장했습니다.`);
    await loadData(true);
  } catch (error) {
    toast(error.message);
  }
});
$("autoReviewBtn").addEventListener("click", () => {
  $("metaReviewDueDate").value = addMonths($("metaRevisionDate").value, $("metaReviewCycle").value);
});
$("modalCloseBtn").addEventListener("click", () => { $("documentModal").hidden = true; });
$("documentModal").addEventListener("click", (event) => { if (event.target === $("documentModal")) $("documentModal").hidden = true; });
$("previewCloseBtn").addEventListener("click", () => { $("previewModal").hidden = true; $("previewBody").innerHTML = ""; });
$("previewModal").addEventListener("click", (event) => { if (event.target === $("previewModal")) { $("previewModal").hidden = true; $("previewBody").innerHTML = ""; } });
$("saveMetadataBtn").addEventListener("click", () => saveMetadata().then(() => { $("documentModal").hidden = true; }));
$("downloadFileBtn").addEventListener("click", () => downloadDocument());
$("previewBtn").addEventListener("click", () => previewDocument());
$("copyPathBtn").addEventListener("click", copyDocumentPath);

loadData();
