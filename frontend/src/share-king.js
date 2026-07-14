  // ── 전체 검색 ──────────────────────────────────────────
  let globalSearchText = '';
  function applyGlobalSearch(val) {
    globalSearchText = val.trim();
    gridApi.setGridOption('quickFilterText', globalSearchText);
    updateStats();
  }
  function clearSearch() {
    document.getElementById('globalSearch').value = '';
    applyGlobalSearch('');
  }
  // ─────────────────────────────────────────────────────

  function applyEmbeddedSnapshot(snapshot) {
    if (!snapshot || embeddedSnapshotApplied) return;
    embeddedSnapshotApplied = true;

    const rows = Array.isArray(snapshot.rows)
      ? snapshot.rows.map(row => ({
        ...row,
        department: row.department || ''
      }))
      : [];
    gridApi.setGridOption('rowData', rows);
    kingRows = Array.isArray(snapshot.kingRows) ? snapshot.kingRows : [];
    aGradeRows = Array.isArray(snapshot.aGradeRows) ? snapshot.aGradeRows : [];
    aGradeRemoteLinks = snapshot.aGradeRemoteLinks && typeof snapshot.aGradeRemoteLinks === 'object' ? snapshot.aGradeRemoteLinks : {};
    syncAGradeFileButtons();

    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      const collapsed = snapshot.sidebarCollapsed !== false;
      sidebar.classList.toggle('collapsed', collapsed);
    }

    toggleAnalysisPanel(!!snapshot.analysisOpen);

    setTimeout(() => {
      if (snapshot.globalSearchText) {
        const input = document.getElementById('globalSearch');
        if (input) input.value = snapshot.globalSearchText;
        applyGlobalSearch(snapshot.globalSearchText);
      }
      if (snapshot.activeMonthFilter) {
        filterByMonth(snapshot.activeMonthFilter);
      } else {
        updateStats();
      }
      if (gridApi) {
        gridApi.refreshHeader();
        gridApi.refreshCells({ force: true });
      }
    }, 120);
  }

  function saveToLocal() {
    const rows = []; gridApi.forEachNode(n => rows.push(n.data));
    kingRows = deriveKingRowsFromGrid();
    localStorage.setItem('impData', JSON.stringify(rows));
    saveKingToLocal();
    saveAGradeRowsToLocal();
    saveAGradePdfLinksToLocal();
    saveAGradeRemoteLinksToLocal();
    document.getElementById('saveStatus').textContent = `💾 저장 완료 (${new Date().toLocaleTimeString()})`;
    if (isEmbeddedShareFile()) return;
    saveSharedData(rows, kingRows);
  }

  async function saveSharedData(rows, sharedKingRows) {
    try {
      const currentShared = await loadSharedData();
      const currentAGradeRows = Array.isArray(currentShared?.aGradeRows) ? currentShared.aGradeRows : [];
      const currentAGradeLinks = currentShared?.aGradeRemoteLinks && typeof currentShared.aGradeRemoteLinks === 'object'
        ? currentShared.aGradeRemoteLinks
        : {};
      const nextAGradeRows = Array.isArray(aGradeRows) ? aGradeRows : currentAGradeRows;
      const nextAGradeLinks = aGradeRemoteLinks && typeof aGradeRemoteLinks === 'object' && Object.keys(aGradeRemoteLinks).length
        ? aGradeRemoteLinks
        : currentAGradeLinks;
      await fetch('/api/shared-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: Array.isArray(rows) ? rows : [],
          kingRows: Array.isArray(sharedKingRows) ? sharedKingRows : [],
          aGradeRows: nextAGradeRows,
          aGradeRemoteLinks: nextAGradeLinks
        })
      });
    } catch (error) {
      console.warn('shared save failed', error);
    }
  }

  async function loadSharedData() {
    try {
      const response = await fetch('/api/shared-data');
      if (!response.ok) return null;
      const data = await response.json();
      return {
        rows: Array.isArray(data?.rows) ? data.rows : [],
        kingRows: Array.isArray(data?.kingRows) ? data.kingRows : [],
        aGradeRows: Array.isArray(data?.aGradeRows) ? data.aGradeRows : [],
        aGradeRemoteLinks: data?.aGradeRemoteLinks && typeof data.aGradeRemoteLinks === 'object' ? data.aGradeRemoteLinks : {}
      };
    } catch (error) {
      console.warn('shared load failed', error);
      return null;
    }
  }

  function saveKingToLocal() {
    localStorage.setItem('kingData', JSON.stringify(kingRows || []));
  }

  function mergeEmbeddedAGradeSnapshot() {
    const snapshot = window.__embeddedSnapshot__;
    if (!snapshot) return;

    const hasSavedAGradeRows = localStorage.getItem(A_GRADE_ROWS_KEY) !== null;
    if (!hasSavedAGradeRows && (!Array.isArray(aGradeRows) || !aGradeRows.length) && Array.isArray(snapshot.aGradeRows)) {
      aGradeRows = snapshot.aGradeRows;
      saveAGradeRowsToLocal();
    }

    const embeddedLinks = snapshot.aGradeRemoteLinks && typeof snapshot.aGradeRemoteLinks === 'object'
      ? snapshot.aGradeRemoteLinks
      : {};
    if (Object.keys(embeddedLinks).length) {
      aGradeRemoteLinks = {
        ...embeddedLinks,
        ...(aGradeRemoteLinks && typeof aGradeRemoteLinks === 'object' ? aGradeRemoteLinks : {})
      };
      saveAGradeRemoteLinksToLocal();
    }
  }

  function loadKingFromLocal() {
    try {
      const saved = localStorage.getItem('kingData');
      if (saved) kingRows = JSON.parse(saved) || [];
    } catch (e) {}
  }

  function openKingViewer() {
    renderKingViewer();
    document.getElementById('kingModal').style.display = 'block';
  }

  function renderKingViewer() {
    const summaryEl = document.getElementById('king-summary');
    const podiumEl = document.getElementById('king-podium');
    const bodyEl = document.getElementById('king-body');
    const deptEl = document.getElementById('kingDeptFilter');
    const nameEl = document.getElementById('kingNameSearch');
    if (!summaryEl || !podiumEl || !bodyEl || !deptEl || !nameEl) return;

    if (!kingRows.length) {
      summaryEl.innerHTML = '';
      deptEl.innerHTML = '<option value="전체">전체 부서</option>';
      podiumEl.innerHTML = '';
      bodyEl.innerHTML = `<div class="king-empty">제안왕 데이터가 아직 없습니다. 제안왕 시트가 포함된 엑셀 파일을 다시 업로드하면 자동으로 반영됩니다.</div>`;
      return;
    }

    const allRows = getSortedKingRows();
    const departments = ['전체', ...Array.from(new Set(allRows.map(row => row.department).filter(Boolean)))];
    const currentDept = deptEl.value || '전체';
    deptEl.innerHTML = departments.map(dept => `<option value="${escapeHtml(dept)}" ${dept === currentDept ? 'selected' : ''}>${escapeHtml(dept)}</option>`).join('');

    const nameSearch = nameEl.value.trim().toLowerCase();
    const selectedDept = deptEl.value || '전체';
    const rows = allRows.filter(row => {
      const byDept = selectedDept === '전체' || row.department === selectedDept;
      const byName = !nameSearch || String(row.proposer || '').toLowerCase().includes(nameSearch);
      return byDept && byName;
    });
    summaryEl.innerHTML = '';
    podiumEl.innerHTML = '';

    bodyEl.innerHTML = `
      <div style="margin-bottom:12px;font-size:12px;color:#6b7280;">${rows.length.toLocaleString()}명 표시 / 전체 ${allRows.length.toLocaleString()}명 · 점수 기준: <b style="color:#184e9e;">${KING_FORMULA.subtitle}</b></div>
      <div style="overflow-x:auto;">
        <table class="king-table">
          <colgroup>
            <col style="width:70px">
            <col style="width:90px">
            <col style="width:120px">
            <col style="width:90px">
            <col style="width:70px">
            <col style="width:60px">
            <col style="width:60px">
            <col style="width:60px">
            <col style="width:60px">
            <col style="width:60px">
            <col style="width:60px">
            <col style="width:80px">
          </colgroup>
          <thead>
            <tr>
              <th>현재 순위</th>
              <th>총점</th>
              <th class="lft">부서</th>
              <th class="lft">제안자</th>
              <th>제안수</th>
              <th>A</th>
              <th>B</th>
              <th>C</th>
              <th>채택</th>
              <th>참가</th>
              <th>건의</th>
              <th>기존 순위</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr class="${row.rank <= 3 ? 'top3-row rank-' + row.rank : ''}" ${nameSearch && String(row.proposer || '').toLowerCase().includes(nameSearch) ? 'style="background:rgba(37,99,235,0.08);"' : ''}>
                <td class="rank-col">${row.rank}위</td>
                <td class="score">${row.score.toLocaleString()}</td>
                <td class="lft">${escapeHtml(row.department || '')}</td>
                <td class="lft">${escapeHtml(row.proposer || '')}</td>
                <td>${(row.count || 0).toLocaleString()}</td>
                <td>${row.A}</td>
                <td>${row.B}</td>
                <td>${row.C}</td>
                <td>${row.adopted}</td>
                <td>${row.joined}</td>
                <td>${row.suggested}</td>
                <td>${row.originalRank ? row.originalRank + '위' : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${rows.length ? '' : '<div class="king-empty" style="margin-top:12px;">조건에 맞는 제안왕 데이터가 없습니다.</div>'}`;
  }

  function manualSave() {
    saveToLocal();
    showToast('✅ 안전하게 저장되었습니다.');
  }

  function clearAll() {
    if (!confirm('제안 목록 데이터를 모두 초기화하시겠습니까?\nA급 개선제안 등록부와 Google Drive PDF 링크는 유지됩니다.')) return;
    const keepAGradeRows = Array.isArray(aGradeRows) ? [...aGradeRows] : [];
    const keepAGradePdfLinks = aGradePdfLinks && typeof aGradePdfLinks === 'object' ? { ...aGradePdfLinks } : {};
    const keepAGradeRemoteLinks = aGradeRemoteLinks && typeof aGradeRemoteLinks === 'object' ? { ...aGradeRemoteLinks } : {};

    if (gridApi) gridApi.setGridOption('rowData', []);
    kingRows = [];
    aGradeRows = keepAGradeRows;
    aGradePdfLinks = keepAGradePdfLinks;
    aGradeRemoteLinks = keepAGradeRemoteLinks;

    localStorage.setItem('impData', JSON.stringify([]));
    localStorage.setItem('kingData', JSON.stringify([]));
    saveAGradeRowsToLocal();
    saveAGradePdfLinksToLocal();
    saveAGradeRemoteLinksToLocal();
    syncAGradeFileButtons();
    updateStats();
    document.getElementById('saveStatus').textContent = `💾 초기화 저장 완료 (${new Date().toLocaleTimeString()})`;
    showToast('✅ 제안 목록만 초기화했습니다. A급 개선제안과 Google Drive 링크는 유지됩니다.');
  }

  function collectGridRows() {
    const rows = [];
    gridApi.forEachNode(n => rows.push(n.data));
    return rows;
  }

  function formatCurrency(value) {
    return (Number(value) || 0).toLocaleString() + '원';
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function openShareDialog() {
    const rows = collectGridRows();
    const now = new Date();
    const defaultName = '개선제안정리_공유_' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
    document.getElementById('shareFileName').value = defaultName;
    document.getElementById('shareStatTotal').textContent = String(rows.length);
    document.getElementById('shareStatMonth').textContent = activeMonthFilter || '전체';
    document.getElementById('shareStatSearch').textContent = globalSearchText || '없음';
    document.getElementById('shareModal').classList.add('open');
  }

  function closeShareDialog() {
    document.getElementById('shareModal').classList.remove('open');
  }

  function getShareServerOrigin() {
    const origin = window.location.origin || '';
    if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)) {
      return 'https://port-0-esq-safety-mouynctw40245c77.sel3.cloudtype.app';
    }
    return origin;
  }

  function buildStandaloneShareHtml(fileTitle, rows, sharedKingRows, sharedAGradeRows, sharedAGradeLinks) {
      const safeTitle = escapeHtml(fileTitle);
      const dataJson = JSON.stringify(rows);
      const kingJson = JSON.stringify(sharedKingRows || []);
      const aGradeJson = JSON.stringify(sharedAGradeRows || []);
      const aGradeLinksJson = JSON.stringify(sharedAGradeLinks || {});
      const serverOriginJson = JSON.stringify(getShareServerOrigin());
      const kingFormulaText = 'A×10 + B×5 + C×3 + 채택×3 + 참가×2 + 건의×1';
      return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --bg: #f4f8fd;
    --surface: #ffffff;
    --panel: #f8fafc;
    --border: #cfdbeb;
    --accent: #2f6fed;
    --accent-dark: #1f5fcf;
    --text: #172539;
    --text-dim: #5f6f82;
    --success: #0f766e;
    --danger: #c24141;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: 'Noto Sans KR', sans-serif;
  }
  .page {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 0;
  }
  .app-shell {
    min-height: 100vh;
    display: block;
    background: var(--bg);
  }
  .share-main {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-width: 0;
    background: var(--bg);
  }
  .hero {
    padding: 13px 24px;
    background: #184e9e;
    color: #f8fbff;
    border-bottom: 1px solid rgba(12, 40, 82, 0.12);
  }
  .hero-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .share-brand-left {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }
  .share-title-stack {
    min-width: 0;
  }
  .hero-title {
    font-size: 19px;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.02em;
  }
  .hero-desc {
    margin: 4px 0 0;
    color: rgba(236, 244, 255, 0.76);
    font-size: 12px;
  }
  .toolbar {
    padding: 12px 18px;
    background: #ffffff;
    border-bottom: 1px solid var(--border);
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  select, input {
    border: 1px solid var(--border);
    border-radius: 4px;
    background: #ffffff;
    color: var(--text);
    padding: 9px 10px;
    font-size: 13px;
    outline: none;
  }
  select:focus, input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(24, 78, 158, 0.10);
  }
  input {
    min-width: 280px;
    flex: 1;
  }
  .table-wrap {
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
    box-shadow: none;
  }
  .table-section {
    flex: 1;
    padding: 12px 14px;
    background: var(--bg);
    min-height: 0;
    padding-bottom: 58px;
  }
  .share-btn {
    border: 1px solid #b7c7dd;
    border-radius: 4px;
    background: #ffffff;
    color: #1f477a;
    padding: 9px 13px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    box-shadow: none;
  }
  .share-btn.chart {
    background: #eef5ff;
    color: #1f5fcf;
    border-color: #adc5ec;
    box-shadow: none;
  }
  .share-btn.goal {
    background: #fffaf0;
    color: #8a5a00;
    border-color: #cfd9e6;
    box-shadow: none;
  }
  .share-btn:hover {
    background: #f6f9ff;
    border-color: #8fb2e6;
  }
  .king-modal {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(32, 52, 82, 0.24);
    z-index: 9999;
    padding: 14px;
  }
  .king-modal.open { display: block; }
  .king-shell {
    height: calc(100vh - 28px);
    background: var(--bg);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
    box-shadow: 0 12px 28px rgba(47, 111, 237, 0.10);
    display: flex;
    flex-direction: column;
  }
  .king-modal-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    background: #f8fbff;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .king-modal-copy h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
  }
  .king-modal-copy p {
    margin: 5px 0 0;
    color: var(--text-dim);
    font-size: 13px;
  }
  .king-close {
    margin-left: auto;
    border: 1px solid var(--border);
    background: #fff;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-dim);
  }
  .king-modal-body {
    padding: 14px 18px 18px;
    overflow: auto;
    flex: 1;
  }
  .king-filter-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .king-filter-row select, .king-filter-row input {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 4px;
    padding: 9px 10px;
    font-size: 12px;
    color: var(--text);
    outline: none;
  }
  .king-filter-row input { min-width: 220px; flex: 1; }
  .king-stats { margin-bottom: 18px; }
  .king-card, .king-mini {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 14px 16px;
    box-shadow: none;
  }
    .king-table tr.top3-row { background: rgba(47,111,237,0.04); }
    .king-table tr.top3-row td { position: relative; }
    .king-table tr.top3-row td:first-child { font-weight: 900; }
    .king-table tr.top3-row.rank-1 td:first-child::before,
    .king-table tr.top3-row.rank-2 td:first-child::before,
    .king-table tr.top3-row.rank-3 td:first-child::before {
      content: "";
      position: absolute;
      left: -1px;
      top: -1px;
      bottom: -1px;
      width: 4px;
      border-radius: 0 4px 4px 0;
    }
    .king-table tr.top3-row.rank-1 td:first-child::before { background: #d4af37; }
    .king-table tr.top3-row.rank-2 td:first-child::before { background: #aeb7c2; }
    .king-table tr.top3-row.rank-3 td:first-child::before { background: #b8824f; }
    .king-table td.score { color: #6d28d9; font-weight: 900; }
    .king-table td.rank { font-weight: 800; }
    .king-formula-inline { font-size: 12px; color: var(--text-dim); font-weight: 700; margin-left: 8px; }
  .chart-modal {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(32, 52, 82, 0.24);
    z-index: 9998;
    padding: 14px;
  }
  .chart-modal.open { display: block; }
  .chart-shell {
    height: calc(100vh - 28px);
    background: #f7f9fc;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #d8e1f0;
    box-shadow: 0 12px 28px rgba(47, 111, 237, 0.10);
    display: flex;
    flex-direction: column;
  }
  .chart-modal-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    background: #f8fbff;
    border-bottom: 1px solid #d8e1f0;
    flex-shrink: 0;
  }
  .chart-modal-copy h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
  }
  .chart-modal-copy p {
    margin: 5px 0 0;
    color: var(--text-dim);
    font-size: 13px;
  }
  .chart-close {
    margin-left: auto;
    border: 1px solid var(--border);
    background: #fff;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-dim);
  }
  .chart-modal-body {
    padding: 0;
    overflow: hidden;
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .chart-filter-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 0;
    padding: 14px 18px 10px;
    background: #f7f9fc;
    border-bottom: 0;
    flex-shrink: 0;
  }
  .chart-filter-row button {
    padding: 9px 14px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: #fff;
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
  }
  .chart-filter-row button.on {
    color: #0369a1;
    border-color: #7dd3fc;
    background: #e0f2fe;
  }
  .chart-filter-row select {
    min-width: 160px;
    border: 1px solid #c8d2de;
    border-radius: 4px;
    background: #ffffff;
    color: #162033;
    padding: 9px 12px;
    font-size: 13px;
    outline: none;
    font-family: 'IBM Plex Sans KR', 'Malgun Gothic', sans-serif;
  }
  .chart-filter-row.goal-mode #shareChartPeriod,
  .chart-filter-row.goal-mode #shareChartGrade {
    display: none;
  }
  .chart-filter-row:not(.goal-mode) #goalMonthSelect {
    display: none;
  }
  #chartSummaryShare {
    padding: 0 18px;
    flex-shrink: 0;
  }
  #chartSummaryShare:empty {
    display: none;
  }
  .chart-summary-line {
    padding: 0 0 10px;
    font-size: 12px;
    font-weight: 700;
    color: #64748b;
  }
  #chartBodyShare {
    padding: 0 0 18px;
    overflow: auto;
    flex: 1;
  }
  .chart-note {
    font-size: 12px;
    color: #64748b;
    font-weight: 700;
  }
  .chart-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .chart-legend {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    align-items: center;
  }
  .chart-legend-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 700;
    color: #31435f;
  }
  .chart-legend-swatch {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }
  .chart-canvas-like {
    background: #ffffff;
    border: 1px solid #d7e2f0;
    border-radius: 4px;
    box-shadow: none;
  }
  .chart-empty {
    padding: 80px 20px;
    text-align: center;
    color: #64748b;
    font-size: 14px;
    border: 1px dashed #d7e2f0;
    border-radius: 18px;
    background: #f7faff;
  }
  .chart-sc {
    background: linear-gradient(180deg, #ffffff 0%, #f1f6ff 100%);
    border: 1px solid rgba(114, 143, 192, 0.16);
    border-radius: 18px;
    padding: 14px 16px;
    box-shadow: 0 10px 22px rgba(18, 44, 88, 0.05);
  }
  .chart-sc .sl {
    font-size: 10px;
    font-weight: 700;
    color: #7c8da6;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .chart-sc .sv {
    font-size: 20px;
    font-weight: 900;
    color: #162033;
  }
  .stats-board {
    overflow: hidden;
    background: #ffffff;
  }
  .stats-board-head {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    align-items: flex-end;
    padding: 18px 20px;
    background: linear-gradient(180deg, #f8fbff 0%, #eef5ff 100%);
    border-bottom: 1px solid #d7e2f0;
  }
  .stats-board-kicker {
    font-size: 11px;
    font-weight: 900;
    letter-spacing: 0.12em;
    color: #2f62ad;
  }
  .stats-board-title {
    margin-top: 4px;
    font-size: 22px;
    font-weight: 900;
    color: #10213c;
    letter-spacing: -0.04em;
  }
  .stats-card-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(118px, 1fr));
    gap: 10px;
    min-width: 520px;
  }
  .stats-board .chart-sc {
    border-radius: 8px;
    padding: 10px 12px;
    background: #ffffff;
    border-color: #cfdbeb;
    box-shadow: none;
  }
  .stats-table-wrap {
    overflow: auto;
    max-height: calc(100vh - 315px);
  }
  .stats-table {
    width: 100%;
    min-width: 1120px;
    table-layout: fixed !important;
    border-collapse: separate;
    border-spacing: 0;
  }
  .stats-table th:nth-child(1),
  .stats-table td:nth-child(1) {
    width: 64px !important;
  }
  .stats-table th:nth-child(2),
  .stats-table td:nth-child(2) {
    width: 160px !important;
  }
  .stats-table th:nth-child(3),
  .stats-table td:nth-child(3) {
    width: 95px !important;
  }
  .stats-table th:nth-child(4),
  .stats-table td:nth-child(4) {
    width: 525px !important;
  }
  .stats-table th:nth-child(5),
  .stats-table td:nth-child(5) {
    width: auto !important;
  }
  .stats-table th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #f1f6fd;
    border-bottom: 1px solid #d7e2f0;
    color: #42526d;
    font-size: 12px;
    font-weight: 900;
    text-align: left;
    padding: 12px 14px;
  }
  .stats-table td {
    border-bottom: 1px solid #edf2f8;
    padding: 12px 14px;
    color: #162033;
    font-size: 13px;
    font-weight: 700;
    vertical-align: middle;
  }
  .stats-table tbody tr:nth-child(even) {
    background: #fbfdff;
  }
  .stats-table tbody tr:hover {
    background: #eef6ff;
  }
  .stats-rank {
    width: 54px;
    color: #6b7c93;
    text-align: center;
  }
  .stats-dept {
    width: 180px;
    font-size: 15px;
    font-weight: 900;
  }
  .stats-total {
    width: 100px;
    font-size: 15px;
    font-weight: 900;
    color: #244f91;
    white-space: nowrap;
  }
  .stats-bar-track {
    position: relative;
    height: 28px;
    width: 500px;
    max-width: 100%;
    min-width: 260px;
    border-radius: 4px;
    background: #e8eef7;
    overflow: hidden;
  }
  .stats-bar-fill {
    position: absolute;
    inset: 0 auto 0 0;
    display: flex;
    border-radius: 4px;
    overflow: hidden;
    background: #2f6fed;
  }
  .stats-bar-segment {
    height: 100%;
    min-width: 2px;
    box-shadow: inset -1px 0 rgba(255,255,255,0.32);
  }
  .stats-grade-cell {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    min-width: 310px;
  }
  .stats-grade-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 8px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--pill-color) 14%, #ffffff);
    border: 1px solid color-mix(in srgb, var(--pill-color) 42%, #d7e2f0);
    color: #162033;
    font-size: 12px;
    font-weight: 800;
  }
  .stats-grade-pill b {
    color: var(--pill-color);
    font-size: 11px;
    font-weight: 900;
  }
  .goal-filter-row select {
    min-width: 160px;
    border: 1px solid var(--border);
    border-radius: 4px;
    background: #fff;
    color: var(--text);
    padding: 10px 12px;
    font-size: 13px;
    outline: none;
  }
  .goal-canvas { background:linear-gradient(180deg,#ffffff 0%,#f7faff 100%); border:1px solid #d7e2f0; border-radius:10px; padding:16px; box-shadow:none; min-width:100%; }
  .goal-items { display:grid; gap:10px; }
  .goal-item { display:grid; grid-template-columns:160px 1fr 90px; gap:14px; align-items:center; padding:14px 16px; background:#fff; border:1px solid #dde7f3; border-radius:8px; box-shadow:0 4px 12px rgba(15,23,42,0.03); }
  .a-grade-modal {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(32, 52, 82, 0.24);
    z-index: 9996;
    padding: 14px;
  }
  .a-grade-modal.open { display: block; }
  .a-grade-shell {
    height: calc(100vh - 28px);
    background: var(--bg);
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border);
    box-shadow: 0 12px 28px rgba(47, 111, 237, 0.10);
    display: flex;
    flex-direction: column;
  }
  .a-grade-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 18px;
    background: #f8fbff;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .a-grade-copy h2 { margin: 0; font-size: 18px; font-weight: 800; }
  .a-grade-copy p { margin: 5px 0 0; color: var(--text-dim); font-size: 13px; }
  .a-grade-close {
    margin-left: auto;
    border: 1px solid var(--border);
    background: #fff;
    border-radius: 4px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-dim);
  }
  .a-grade-body { padding: 14px 18px 18px; overflow: auto; flex: 1; }
  .a-grade-filter-row { display:flex; gap:8px; margin-bottom:10px; }
  .a-grade-filter-row input { min-width:0; }
  .a-grade-table th,
  .a-grade-table td { font-size:12px; }
  .a-grade-pdf-btn {
    border: 1px solid #b8c7da;
    background: #f8fafc;
    color: #123863;
    border-radius: 4px;
    padding: 6px 9px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .a-grade-pdf-missing { color: #8a96a8; font-size: 12px; font-weight: 700; }
  .goal-item.state-good { background:linear-gradient(90deg,#f2fff7 0%,#ffffff 55%); }
  .goal-item.state-mid { background:linear-gradient(90deg,#fffbeb 0%,#ffffff 55%); }
  .goal-item.state-low { background:linear-gradient(90deg,#fff5f5 0%,#ffffff 55%); }
  .goal-dept { font-size:16px; line-height:1.2; font-weight:800; color:#162033; }
  .goal-meta { margin-top:4px; color:var(--text-dim); font-size:12px; font-weight:700; }
  .goal-track { position:relative; height:14px; border-radius:999px; background:#e7edf5; overflow:visible; box-shadow:inset 0 1px 2px rgba(15,23,42,0.08); }
  .goal-track::after { content:""; position:absolute; left:var(--goal-pos, 71.43%); top:-6px; bottom:-6px; border-left:2px dashed rgba(220,38,38,0.65); }
  .goal-goal-label { position:absolute; left:var(--goal-pos, 71.43%); top:-24px; transform:translateX(-50%); font-size:10px; font-weight:900; letter-spacing:0.08em; color:#b91c1c; background:#fff; padding:1px 6px; border-radius:999px; border:1px solid #fecaca; }
  .goal-track-fill { position:absolute; inset:0; border-radius:999px; overflow:hidden; }
  .goal-fill { position:absolute; inset:0 auto 0 0; height:14px; border-radius:999px; }
  .goal-fill.good { background:linear-gradient(90deg,#16a34a,#4ade80); }
  .goal-fill.mid { background:linear-gradient(90deg,#d97706,#fbbf24); }
  .goal-fill.low { background:linear-gradient(90deg,#dc2626,#fb7185); }
  .goal-rate { text-align:right; font-size:28px; line-height:1; font-weight:900; letter-spacing:-0.03em; color:#162033; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  thead th {
    background: #f5f7fa;
    font-size: 12px;
    font-weight: 700;
    text-align: left;
    padding: 11px 10px;
    border-bottom: 1px solid var(--border);
    color: #31465f;
    white-space: nowrap;
  }
  tbody td {
    padding: 10px;
    font-size: 13px;
    border-bottom: 1px solid #ebf0f5;
    vertical-align: top;
    word-break: break-word;
  }
  tbody tr:hover { background: #f7faff; }
  .col-no { width: 56px; text-align: center; }
  .col-month { width: 72px; }
  .col-date { width: 110px; }
  .col-dept { width: 110px; }
  .col-proposer { width: 86px; }
  .col-type { width: 84px; text-align: center; }
  .col-grade { width: 70px; text-align: center; }
  .col-reward { width: 92px; text-align: right; }
  .col-safety { width: 70px; text-align: center; }
  .empty {
    padding: 70px 20px;
    text-align: center;
    color: var(--text-dim);
    font-size: 14px;
  }
  .share-footer {
    position: sticky;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 20;
    padding: 10px 18px;
    background: #f8fbff;
    border-top: 1px solid var(--border);
    box-shadow: 0 -4px 14px rgba(15, 23, 42, 0.04);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    font-weight: 600;
  }
  .share-footer-stats {
    display:flex;
    gap:18px;
    align-items:center;
    flex-wrap:wrap;
    flex:1;
  }
  .share-footer-sep {
    width:1px;
    height:12px;
    background:var(--border);
  }
  .share-footer .mode { color: var(--accent); font-weight: 800; }
  .share-footer .reward { color: var(--success); }
  .share-footer .safety { color: var(--danger); }
  .safety-mark { color: var(--danger); font-weight: 800; }
  @media (max-width: 900px) {
      .page { padding: 0; }
      .app-shell { min-height: 100vh; }
      .stats { width: 100%; }
      .toolbar { flex-direction: column; align-items: stretch; }
    input { min-width: 0; width: 100%; }
    .table-wrap { overflow: auto; }
    .king-modal { padding: 12px; }
    .king-shell { height: calc(100vh - 24px); }
      .chart-modal { padding: 12px; }
      .chart-shell { height: calc(100vh - 24px); }
      .goal-modal { padding: 12px; }
      .goal-shell { height: calc(100vh - 24px); }
      .goal-item { grid-template-columns: 1fr; }
      .goal-rate { text-align: left; }
      table { min-width: 980px; }
    }
</style></head>
<body>
  <div class="page">
    <div class="app-shell">
      <main class="share-main">
        <section class="hero">
          <div class="hero-top">
            <div class="share-brand-left">
              <div class="share-title-stack">
              <h1 class="hero-title">ESQ본부 개선제안 관리시스템</h1>
              <p class="hero-desc">${safeTitle} · 읽기 전용 공유 화면</p>
              </div>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button id="openKingModalBtn" class="share-btn">👑 제안왕</button>
              <button id="openAGradeModalBtn" class="share-btn goal">⭐ A급 개선제안</button>
              <button id="openChartModalBtn" class="share-btn chart">📈 통계</button>
            </div>
          </div>
        </section>
        <div class="toolbar">
          <select id="monthSelect"></select>
          <select id="gradeSelect"></select>
          <input id="searchInput" type="text" placeholder="이름, 부서, 제안명 검색..." />
        </div>
        <section class="table-section">
          <section class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="col-no">NO</th>
                  <th class="col-month">월</th>
                  <th class="col-date">접수일</th>
                  <th class="col-dept">부서명</th>
                  <th class="col-proposer">제안자</th>
                  <th>제안명</th>
                  <th class="col-type">제안구분</th>
                  <th class="col-grade">등급</th>
                  <th class="col-reward">시상금</th>
                  <th class="col-safety">안전</th>
                </tr>
              </thead>
              <tbody id="tableBody"></tbody>
            </table>
            <div id="emptyState" class="empty" style="display:none;">조건에 맞는 데이터가 없습니다.</div>
          </section>
        </section>
        <footer class="share-footer">
          <div class="share-footer-stats">
            <span class="mode">[전체 통계]</span>
            <div>건수: <b id="statTotal">0</b></div>
            <div class="share-footer-sep"></div>
            <div>시상금: <b id="statReward" class="reward">0</b>원</div>
            <div class="share-footer-sep"></div>
            <div>안전: <b id="statSafety" class="safety">0</b>건</div>
          </div>
          <div style="font-size:11px;color:var(--text-dim);">읽기 전용 공유</div>
        </footer>
      </main>
    </div>
  </div>
  <div id="kingModalShare" class="king-modal">
    <div class="king-shell">
        <div class="king-modal-head">
          <div class="king-modal-copy">
            <h2>제안왕 <span class="king-formula-inline">(${kingFormulaText})</span></h2>
            <p>현재 공유 데이터 기준으로 집계한 랭킹입니다. 이름 검색과 부서 선택으로 바로 순위를 찾을 수 있습니다.</p>
          </div>
          <button id="closeKingModalBtn" class="king-close">✕ 닫기</button>
        </div>
        <div class="king-modal-body">
          <div class="king-filter-row">
            <select id="kingDeptSelect"></select>
            <input id="kingNameInput" type="text" placeholder="이름 검색으로 순위 찾기..." />
          </div>
          <section class="table-wrap">
            <table class="king-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>총점</th>
                <th>부서</th>
                <th>제안자</th>
                <th>제안수</th>
                <th>A</th>
                <th>B</th>
                <th>C</th>
                <th>채택</th>
                <th>참가</th>
                <th>건의</th>
              </tr>
            </thead>
            <tbody id="kingTableBody"></tbody>
          </table>
          <div id="kingEmpty" class="empty" style="display:none;">제안왕 데이터가 포함되지 않았습니다.</div>
        </section>
      </div>
    </div>
  </div>
  <div id="aGradeModalShare" class="a-grade-modal">
    <div class="a-grade-shell">
      <div class="a-grade-head">
        <div class="a-grade-copy">
          <h2>A급 개선제안</h2>
          <p id="aGradeSubText">공유 파일에 포함된 A급 개선제안 등록부입니다.</p>
        </div>
        <button id="closeAGradeModalBtn" class="a-grade-close">✕ 닫기</button>
      </div>
      <div class="a-grade-body">
        <div class="a-grade-filter-row">
          <input id="aGradeSearchInput" type="text" placeholder="부서명, 제안자, 제안명 검색..." />
        </div>
        <section class="table-wrap">
          <table class="a-grade-table">
            <thead>
              <tr>
                <th class="col-no">NO</th>
                <th class="col-date">접수년</th>
                <th class="col-date">접수일</th>
                <th class="col-dept">부서명</th>
                <th class="col-proposer">제안자</th>
                <th>제안명</th>
                <th class="col-grade">유형</th>
                <th class="col-grade">PDF</th>
              </tr>
            </thead>
            <tbody id="aGradeTableBody"></tbody>
          </table>
          <div id="aGradeEmpty" class="empty" style="display:none;">A급 개선제안 데이터가 없습니다.</div>
        </section>
      </div>
    </div>
  </div>
  <div id="chartModalShare" class="chart-modal">
    <div class="chart-shell">
      <div class="chart-modal-head">
        <div class="chart-modal-copy">
          <h2>통계</h2>
          <p>현재 공유 데이터 기준으로 부서별 등급 건수를 누적해서 보여줍니다.</p>
        </div>
        <button id="closeChartModalBtn" class="chart-close">✕ 닫기</button>
      </div>
      <div class="chart-modal-body">
        <div class="chart-filter-row">
          <button id="shareMonthModeBtn" class="on" type="button">월 통계</button>
          <button id="shareYearModeBtn" type="button">연 통계</button>
          <button id="shareGoalModeBtn" type="button">목표달성률</button>
          <select id="shareChartPeriod"></select>
          <select id="shareChartGrade"></select>
          <select id="goalMonthSelect"></select>
        </div>
        <div id="chartSummaryShare"></div>
        <div id="chartBodyShare"></div>
      </div>
    </div>
  </div>
<script>
  const allRows = ${dataJson};
  const allKingRows = ${kingJson};
  let allAGradeRows = ${aGradeJson};
  let allAGradeLinks = ${aGradeLinksJson};
  const shareServerOrigin = ${serverOriginJson};
  let activeMonth = '전체';
  let activeGrade = '전체';
  let searchText = '';
  let kingDept = '전체';
  let kingNameSearch = '';
  let shareChartMode = 'month';
  let shareChartPeriod = '전체';
  let shareChartGrade = '전체';
  let shareStatsView = 'chart';
  let shareGoalMonth = '전체';
  let aGradeSearch = '';
  const kingFormula = { label: '기본 점수', subtitle: 'A×10 + B×5 + C×3 + 채택×3 + 참가×2 + 건의×1', weights: { A: 10, B: 5, C: 3, adopted: 3, joined: 2, suggested: 1 } };
  const chartGradeOrder = ['채택', '참가', '5S', '건의', 'A', 'B', 'C'];
  const chartGradeColors = { '채택':'#ff2d20', '참가':'#0ea5e9', '5S':'#f97316', '건의':'#4f79b3', 'A':'#fff200', 'B':'#4b97a8', 'C':'#8fd14f' };
  const goalDeptOrder = ['생산1부','생산2부','SEM','연구개발팀','품질관리부','T/S팀','물류관리팀','공무팀','환경관리과','총무과'];
  const goalDeptTargets = { '생산1부':32, '생산2부':5, 'SEM':10, '연구개발팀':11, '품질관리부':16, 'T/S팀':9, '물류관리팀':9, '공무팀':8, '환경관리과':5, '총무과':1 };
  const goalBarColors = ['#ff2d20','#ff3b30','#fbbf24','#9ca3af','#8fd14f','#22c55e','#20b2e6','#2f80ed','#3959a8','#6d28d9'];

  function formatCurrency(value) {
    return (Number(value) || 0).toLocaleString() + '원';
  }
  function htmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function normalizeDepartmentName(value) {
    const cleaned = String(value || '').replace(/^[a-zA-Z](?:\.|\s+)/, '').trim();
    const compact = cleaned.replace(/[.\s]/g, '').toLowerCase();
    if (!cleaned) return '';
    if (cleaned.includes('공무과')) return cleaned.replace(/공무과/g, '공무팀');
    if (['공무', '공무팀', '공무부', '공무과', '공므', '공뮤', '궁무', '궁무팀', '공무텀', '공무딤', '공부팀'].includes(compact)) return '공무팀';
    if (compact === '분산qc') return '품질관리부';
    if (compact === 'sem' || compact === '에스이엠') return 'SEM';
    if (compact === 'ts' || compact === 'ts팀' || compact === 't/s' || compact === 't/s팀') return 'T/S팀';
    return cleaned;
  }
  function normalizeAGradeMatchText(value) {
    return String(value || '').toLowerCase().replace(/\\.[^.\\\\/]+$/g, '').replace(/[\\s_\\-()[\\]{}.,#~·"'“”‘’]/g, '');
  }
  function formatStandaloneAGradeYear(value) {
    const match = String(value || '').match(/20\\d{2}/);
    return match ? match[0] + '년' : String(value || '');
  }
  function getAGradeRowKey(row) {
    return [
      row.no || '',
      formatStandaloneAGradeYear(row.year || row.date || ''),
      row.date || '',
      row.proposer || '',
      row.title || ''
    ].map(value => normalizeAGradeMatchText(value)).join('|');
  }
  function getAGradeRowKeyCandidates(row) {
    const formattedYear = formatStandaloneAGradeYear(row.year || row.date || '');
    const rawYear = String(row.year || '').trim();
    const yearWithoutSuffix = formattedYear.replace(/년/g, '');
    const years = Array.from(new Set([formattedYear, rawYear, yearWithoutSuffix, yearWithoutSuffix + '?'].filter(Boolean)));
    return years.map(year => [
      row.no || '',
      year,
      row.date || '',
      row.proposer || '',
      row.title || ''
    ].map(value => normalizeAGradeMatchText(value)).join('|'));
  }
  function getAGradePdfByRow(row) {
    for (const key of getAGradeRowKeyCandidates(row)) {
      if (allAGradeLinks[key]) return { key, pdf: allAGradeLinks[key] };
    }
    return { key: getAGradeRowKey(row), pdf: null };
  }
  function getAGradeDedupKey(row) {
    const title = normalizeAGradeMatchText(row.title);
    const proposer = normalizeAGradeMatchText(row.proposer);
    const department = normalizeAGradeMatchText(normalizeDepartmentName(row.department));
    if (!title) return '';
    if (proposer) return 'proposer-title|' + proposer + '|' + title;
    if (department) return 'department-title|' + department + '|' + title;
    return 'title|' + title;
  }
  function dedupeStandaloneAGradeRows(rows) {
    const seen = new Map();
    (Array.isArray(rows) ? rows : []).forEach(row => {
      if (!row || !String(row.title || '').trim()) return;
      const key = getAGradeDedupKey(row);
      if (!key) return;
      const current = seen.get(key);
      if (!current) {
        seen.set(key, row);
        return;
      }
      const currentHasPdf = !!getAGradePdfByRow(current).pdf;
      const nextHasPdf = !!getAGradePdfByRow(row).pdf;
      if (!currentHasPdf && nextHasPdf) seen.set(key, row);
    });
    return Array.from(seen.values());
  }
  function getAGradePdf(row) {
    return getAGradePdfByRow(row).pdf;
  }
  async function loadLiveAGradeDataIfNeeded() {
    if (allAGradeRows.length) return;
    if (!shareServerOrigin || shareServerOrigin === 'null') return;
    try {
      const response = await fetch(shareServerOrigin + '/api/shared-data');
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.aGradeRows)) allAGradeRows = data.aGradeRows;
      if (data.aGradeRemoteLinks && typeof data.aGradeRemoteLinks === 'object') {
        allAGradeLinks = data.aGradeRemoteLinks;
        Object.values(allAGradeLinks).forEach(item => {
          if (item && item.url && /^\\/[^/]/.test(item.url)) item.url = shareServerOrigin + item.url;
        });
      }
    } catch (error) {
      console.warn('live a-grade load failed', error);
    }
  }
  function renderAGrade() {
    const openBtn = document.getElementById('openAGradeModalBtn');
    const tbody = document.getElementById('aGradeTableBody');
    const empty = document.getElementById('aGradeEmpty');
    const subText = document.getElementById('aGradeSubText');
    if (!openBtn || !tbody || !empty || !subText) return;
    openBtn.style.display = 'inline-flex';
    allAGradeRows = dedupeStandaloneAGradeRows(allAGradeRows);
    const search = aGradeSearch.trim().toLowerCase();
    const rows = allAGradeRows.filter(row => {
      if (!search) return true;
      return [row.no, row.year, row.date, normalizeDepartmentName(row.department), row.proposer, row.title, row.type]
        .join(' ')
        .toLowerCase()
        .includes(search);
    });
    subText.textContent = rows.length + '건 표시 / 전체 ' + allAGradeRows.length + '건 · PDF 칸에서 바로 열기';
    tbody.innerHTML = rows.map(row => {
      const pdfMatch = getAGradePdfByRow(row);
      const key = pdfMatch.key;
      const pdf = pdfMatch.pdf;
      const pdfCell = pdf && pdf.url
        ? '<button class="a-grade-pdf-btn" data-a-grade-key="' + htmlEscape(key) + '">보기</button>'
        : '<span class="a-grade-pdf-missing">없음</span>';
      return '<tr>' +
        '<td class="col-no">' + htmlEscape(row.no || '') + '</td>' +
        '<td class="col-date">' + htmlEscape(formatStandaloneAGradeYear(row.year || row.date || '')) + '</td>' +
        '<td class="col-date">' + htmlEscape(row.date || '') + '</td>' +
        '<td class="col-dept">' + htmlEscape(normalizeDepartmentName(row.department)) + '</td>' +
        '<td class="col-proposer">' + htmlEscape(row.proposer || '') + '</td>' +
        '<td>' + htmlEscape(row.title || '') + '</td>' +
        '<td class="col-grade">' + htmlEscape(row.type || '') + '</td>' +
        '<td class="col-grade">' + pdfCell + '</td>' +
      '</tr>';
    }).join('');
    empty.style.display = rows.length ? 'none' : 'block';
  }
  function computeKingScore(row, mode) {
    const weights = kingFormula.weights;
    return (Number(row.A) || 0) * weights.A +
      (Number(row.B) || 0) * weights.B +
      (Number(row.C) || 0) * weights.C +
      (Number(row.adopted) || 0) * weights.adopted +
      (Number(row.joined) || 0) * weights.joined +
      (Number(row.suggested) || 0) * weights.suggested;
  }
  function getKingRows() {
    return allKingRows
      .map(row => ({ ...row, score: computeKingScore(row) }))
      .sort((a, b) => b.score - a.score || (b.count || 0) - (a.count || 0))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }
  function normalizeGrade(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const compact = s.replace(/[\\s._\\-(){}\\[\\],#~·"'“”‘’]/g, '').toUpperCase();
    if (s.includes('채택') || s.includes('채핵') || s.includes('체택') || s.includes('재택') || s.includes('채댁') || s.includes('채턱') || s.includes('채텩')) return '채택';
    if (s.includes('건의') || s.includes('견의') || s.includes('건이') || s.includes('건외') || s.includes('권의') || s.includes('전의')) return '건의';
    if (s.includes('참가') || s.includes('참카')) return '참가';
    if (/5\\s*s/i.test(s)) return '5S';
    if (s.includes('단순')) return '단순';
    if (s.includes('중복')) return '중복';
    if (s.includes('보류')) return '보류';
    if (/^A(?:급)?$/i.test(compact)) return 'A';
    if (/^B(?:급)?$/i.test(compact)) return 'B';
    if (/^C(?:급)?$/i.test(compact)) return 'C';
    if (['O', '0', '○', '〇', 'ㄷ', 'ᄃ'].includes(compact)) return 'C';
    return s;
  }
  function normalizeProposalType(raw, grade) {
    const normalizedGrade = normalizeGrade(grade);
    return ['A', 'B', 'C'].includes(normalizedGrade) ? '실시' : '아이디어';
  }
  function getRowYear(row) {
    const match = String(row.date || '').match(/20\\d{2}/);
    return match ? match[0] : '';
  }
  function getChartPeriods(mode) {
    const values = new Set();
    allRows.forEach(row => {
      const value = mode === 'year' ? getRowYear(row) : String(row.month || '').trim();
      if (value) values.add(value);
    });
    if (mode === 'year') return ['전체'].concat(Array.from(values).sort());
    const monthOrder = ['12월','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월'];
    return ['전체'].concat(Array.from(values).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b)));
  }
  function getDepartmentChartRows() {
    const map = new Map();
    allRows.forEach(row => {
      const periodValue = shareChartMode === 'year' ? getRowYear(row) : String(row.month || '').trim();
      if (shareChartPeriod !== '전체' && periodValue !== shareChartPeriod) return;
      const grade = normalizeGrade(row.grade);
      if (shareChartGrade !== '전체' && grade !== shareChartGrade) return;
      const department = normalizeDepartmentName(row.department);
      if (!department) return;
      if (!map.has(department)) map.set(department, { department, total: 0, 채택: 0, 참가: 0, '5S': 0, 건의: 0, A: 0, B: 0, C: 0 });
      const target = map.get(department);
      target.total += 1;
      if (chartGradeOrder.includes(grade)) target[grade] += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.department.localeCompare(b.department, 'ko'));
  }
  function splitChartLabel(text) {
    const raw = String(text || '');
    if (raw.length <= 6) return [raw];
    if (raw.includes(' ')) {
      const parts = raw.split(/\\s+/).filter(Boolean);
      if (parts.length >= 2) return [parts.slice(0, -1).join(' '), parts.slice(-1).join(' ')];
    }
    const mid = Math.ceil(raw.length / 2);
    return [raw.slice(0, mid), raw.slice(mid)];
  }
  function renderShareChart() {
    const openBtn = document.getElementById('openChartModalBtn');
    const periodEl = document.getElementById('shareChartPeriod');
    const gradeEl = document.getElementById('shareChartGrade');
    const summaryEl = document.getElementById('chartSummaryShare');
    const bodyEl = document.getElementById('chartBodyShare');
    const monthBtn = document.getElementById('shareMonthModeBtn');
    const yearBtn = document.getElementById('shareYearModeBtn');
    const goalBtn = document.getElementById('shareGoalModeBtn');
    const filterRow = monthBtn ? monthBtn.closest('.chart-filter-row') : null;
    if (!periodEl || !gradeEl || !summaryEl || !bodyEl || !openBtn) return;
    openBtn.style.display = 'inline-flex';
    if (shareStatsView === 'goal') {
      filterRow?.classList.add('goal-mode');
      monthBtn.classList.remove('on');
      yearBtn.classList.remove('on');
      goalBtn?.classList.add('on');
      renderGoalChart();
      return;
    }
    filterRow?.classList.remove('goal-mode');
    goalBtn?.classList.remove('on');
    const periods = getChartPeriods(shareChartMode);
    const gradeOptions = ['전체', 'C', 'B', 'A', '건의', '5S', '참가', '채택'];
    if (!periods.includes(shareChartPeriod)) shareChartPeriod = '전체';
    periodEl.innerHTML = periods.map(v => '<option value="' + v + '"' + (v === shareChartPeriod ? ' selected' : '') + '>' + (v === '전체' ? (shareChartMode === 'year' ? '전체 연도' : '전체 월') : v) + '</option>').join('');
    if (!gradeOptions.includes(shareChartGrade)) shareChartGrade = '전체';
    gradeEl.innerHTML = gradeOptions.map(v => '<option value="' + v + '"' + (v === shareChartGrade ? ' selected' : '') + '>' + (v === '전체' ? '전체 등급' : v + '만 보기') + '</option>').join('');
    monthBtn.classList.toggle('on', shareChartMode === 'month');
    yearBtn.classList.toggle('on', shareChartMode === 'year');
    const rows = getDepartmentChartRows();
    if (!rows.length) {
      summaryEl.innerHTML = '<div class="chart-summary-line">통계 데이터가 없습니다.</div>';
      bodyEl.innerHTML = '<div class="chart-empty">통계를 그릴 데이터가 없습니다.</div>';
      return;
    }
    const topDept = rows[0];
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const maxValue = Math.max.apply(null, rows.map(row => row.total).concat([1]));
    const adoptedTotal = rows.reduce((sum, row) => sum + (row['채택'] || 0), 0);
    const aTotal = rows.reduce((sum, row) => sum + (row.A || 0), 0);

    summaryEl.innerHTML = '';

    const summaryCards = [
      ['전체 건수', total.toLocaleString()],
      ['채택', adoptedTotal.toLocaleString()],
      ['A급', aTotal.toLocaleString()],
      ['최다 부서', topDept.department + ' ' + topDept.total.toLocaleString()]
    ].map(function(card) {
      return '<div class="chart-sc"><div class="sl">' + htmlEscape(card[0]) + '</div><div class="sv">' + htmlEscape(card[1]) + '</div></div>';
    }).join('');

    const tableRows = rows.map(function(row, index) {
      const percent = Math.max(4, Math.round((row.total / maxValue) * 100));
      const barSegments = chartGradeOrder.map(function(grade) {
        const value = row[grade] || 0;
        if (!value || !row.total) return '';
        const width = Math.max(3, (value / row.total) * 100);
        return '<span class="stats-bar-segment" title="' + htmlEscape(grade) + ' ' + value.toLocaleString() + '" style="width:' + width + '%;background:' + chartGradeColors[grade] + ';"></span>';
      }).join('');
      const gradeCells = chartGradeOrder.map(function(grade) {
        return '<span class="stats-grade-pill" style="--pill-color:' + chartGradeColors[grade] + ';"><b>' + grade + '</b>' + (row[grade] || 0).toLocaleString() + '</span>';
      }).join('');
      return '<tr>' +
        '<td class="stats-rank">' + (index + 1) + '</td>' +
        '<td class="stats-dept">' + htmlEscape(row.department) + '</td>' +
        '<td class="stats-total">' + row.total.toLocaleString() + '</td>' +
        '<td><div class="stats-bar-track"><div class="stats-bar-fill" style="width:' + percent + '%;">' + barSegments + '</div></div></td>' +
        '<td class="stats-grade-cell">' + gradeCells + '</td>' +
      '</tr>';
    }).join('');

    bodyEl.innerHTML = '<div class="stats-board chart-canvas-like">' +
        '<div class="stats-board-head">' +
          '<div><div class="stats-board-kicker">' + (shareChartMode === 'year' ? 'YEARLY SUMMARY' : 'MONTHLY SUMMARY') + '</div><div class="stats-board-title">' + (shareChartMode === 'year' ? '부서별 제안건수 연 통계' : '부서별 제안건수 월 통계') + '</div></div>' +
          '<div class="stats-card-grid">' + summaryCards + '</div>' +
        '</div>' +
        '<div class="stats-table-wrap">' +
          '<table class="stats-table">' +
            '<colgroup><col style="width:64px"><col style="width:160px"><col style="width:95px"><col style="width:525px"><col></colgroup>' +
            '<thead><tr><th>No</th><th>부서</th><th>총 건수</th><th>실적 비교</th><th>등급별 세부</th></tr></thead>' +
            '<tbody>' + tableRows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }
  function getGoalMonths() {
    const monthOrder = ['12월','1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월'];
    const months = Array.from(new Set(allRows.map(row => String(row.month || '').trim()).filter(Boolean)));
    return ['전체'].concat(months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b)));
  }
  function getGoalRows() {
    const activeMonths = shareGoalMonth === '전체'
      ? getGoalMonths().filter(month => month !== '전체')
      : [shareGoalMonth];
    const monthCount = Math.max(activeMonths.length, 1);
    const counts = {};
    goalDeptOrder.forEach(dept => { counts[dept] = 0; });
    allRows.forEach(row => {
      const month = String(row.month || '').trim();
      if (shareGoalMonth !== '전체' && month !== shareGoalMonth) return;
      const dept = normalizeDepartmentName(row.department);
      if (counts[dept] === undefined) return;
      counts[dept] += 1;
    });
    return goalDeptOrder.map(dept => {
      const monthlyTarget = goalDeptTargets[dept] || 0;
      const target = monthlyTarget * monthCount;
      const actual = counts[dept] || 0;
      const rate = target > 0 ? Math.round((actual / target) * 100) : 0;
      return { department: dept, target, actual, rate, monthCount };
    });
  }
  function renderGoalChart() {
    const monthEl = document.getElementById('goalMonthSelect');
    const summaryEl = document.getElementById('chartSummaryShare');
    const bodyEl = document.getElementById('chartBodyShare');
    if (!monthEl || !summaryEl || !bodyEl) return;
    const months = getGoalMonths();
    if (!months.includes(shareGoalMonth)) shareGoalMonth = '전체';
    monthEl.innerHTML = months.map(m => '<option value="' + m + '"' + (m === shareGoalMonth ? ' selected' : '') + '>' + (m === '전체' ? '전체 월' : m) + '</option>').join('');
    const rows = getGoalRows();
    const sortedRows = rows.slice().sort((a, b) => b.rate - a.rate || b.actual - a.actual || a.department.localeCompare(b.department, 'ko'));
    const totalTarget = sortedRows.reduce((sum, row) => sum + row.target, 0);
    const totalActual = sortedRows.reduce((sum, row) => sum + row.actual, 0);
    const totalRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
    const getState = function(rate) { return rate >= 100 ? 'good' : (rate >= 80 ? 'mid' : 'low'); };
    const visualMax = 140;
    const goalPos = (100 / visualMax) * 100;

    summaryEl.innerHTML = '<div class="chart-summary-line">목표달성률 · ' + htmlEscape(shareGoalMonth === '전체' ? '전체 월' : shareGoalMonth) + ' · 전체 ' + totalRate + '% · 실적 ' + totalActual.toLocaleString() + '건 / 목표 ' + totalTarget.toLocaleString() + '건</div>';

    const items = sortedRows.map(function(row) {
      const state = getState(row.rate);
      const width = Math.max(0, Math.min((row.rate / visualMax) * 100, 100));
      return '<div class="goal-item state-' + state + '">' +
        '<div><div class="goal-dept">' + htmlEscape(row.department) + '</div><div class="goal-meta">실적 ' + row.actual + ' / 목표 ' + row.target + '</div></div>' +
        '<div class="goal-track" style="--goal-pos:' + goalPos + '%;"><div class="goal-goal-label">GOAL</div><div class="goal-track-fill"><div class="goal-fill ' + state + '" style="width:' + width + '%;"></div></div></div>' +
        '<div class="goal-rate">' + row.rate + '%</div>' +
      '</div>';
    }).join('');

    bodyEl.innerHTML = '<div class="chart-toolbar"><div class="chart-note">부서별 월 할당량 대비 실제 제안 건수 달성률입니다. 실적이 없어도 모든 부서가 포함됩니다.</div></div>' +
      '<div class="goal-canvas chart-canvas-like"><div class="goal-items">' + items + '</div></div>';
  }

  function buildMonthOptions() {
    const months = ['전체', ...Array.from(new Set(allRows.map(row => row.month).filter(Boolean)))];
    const select = document.getElementById('monthSelect');
    select.innerHTML = months.map(month => '<option value="' + month + '">' + month + '</option>').join('');
  }
  function buildGradeOptions() {
    const order = ['전체', 'A', 'B', 'C', '채택', '참가', '건의', '5S', '단순', '중복', '보류'];
    const grades = Array.from(new Set(allRows.map(row => String(row.grade || '').trim()).filter(Boolean)));
    const sorted = order.filter(grade => grades.includes(grade));
    const extras = grades.filter(grade => !order.includes(grade)).sort((a, b) => a.localeCompare(b, 'ko'));
    const select = document.getElementById('gradeSelect');
    select.innerHTML = ['전체'].concat(sorted, extras).filter((value, index, arr) => arr.indexOf(value) === index).map(grade =>
      '<option value="' + grade + '">' + (grade === '전체' ? '전체 등급' : grade) + '</option>'
    ).join('');
  }

  function getVisibleRows() {
    return allRows.filter(row => {
      const byMonth = activeMonth === '전체' || row.month === activeMonth;
      const byGrade = activeGrade === '전체' || String(row.grade || '').trim() === activeGrade;
      const haystack = [row.month, row.date, normalizeDepartmentName(row.department), row.proposer, row.title, normalizeProposalType(row.type, row.grade), row.grade, row.reward, row.safety]
        .join(' ')
        .toLowerCase();
      const bySearch = !searchText || haystack.includes(searchText);
      return byMonth && byGrade && bySearch;
    });
  }

  function render() {
    const rows = getVisibleRows();
    const tbody = document.getElementById('tableBody');
    const empty = document.getElementById('emptyState');
    tbody.innerHTML = rows.map((row, index) => {
      const safety = row.safety ? '<span class="safety-mark">' + row.safety + '</span>' : '';
      return '<tr>' +
        '<td class="col-no">' + (index + 1) + '</td>' +
        '<td class="col-month">' + (row.month || '') + '</td>' +
        '<td class="col-date">' + (row.date || '') + '</td>' +
        '<td class="col-dept">' + normalizeDepartmentName(row.department) + '</td>' +
        '<td class="col-proposer">' + (row.proposer || '') + '</td>' +
        '<td>' + (row.title || '') + '</td>' +
        '<td class="col-type">' + normalizeProposalType(row.type, row.grade) + '</td>' +
        '<td class="col-grade">' + (row.grade || '') + '</td>' +
        '<td class="col-reward">' + formatCurrency(row.reward) + '</td>' +
        '<td class="col-safety">' + safety + '</td>' +
      '</tr>';
    }).join('');
    empty.style.display = rows.length ? 'none' : 'block';

    document.getElementById('statTotal').textContent = rows.length.toLocaleString();
    document.getElementById('statReward').textContent = formatCurrency(rows.reduce((sum, row) => sum + (Number(row.reward) || 0), 0));
    document.getElementById('statSafety').textContent = rows.filter(row => !!row.safety).length.toLocaleString();
  }
    function renderKing() {
      const openBtn = document.getElementById('openKingModalBtn');
      const deptSelect = document.getElementById('kingDeptSelect');
      const nameInput = document.getElementById('kingNameInput');
      const tbody = document.getElementById('kingTableBody');
      const empty = document.getElementById('kingEmpty');
      if (!allKingRows.length) {
        openBtn.style.display = 'inline-flex';
        deptSelect.innerHTML = '<option value="전체">전체 부서</option>';
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
      }
    openBtn.style.display = 'inline-flex';
    empty.style.display = 'none';
    const allRows = getKingRows();
    const departments = ['전체'].concat(Array.from(new Set(allRows.map(row => normalizeDepartmentName(row.department)).filter(Boolean))));
    deptSelect.innerHTML = departments.map(dept => '<option value="' + dept + '"' + (dept === kingDept ? ' selected' : '') + '>' + dept + '</option>').join('');
      const rows = allRows.filter(row => {
        const byDept = kingDept === '전체' || normalizeDepartmentName(row.department) === kingDept;
        const byName = !kingNameSearch || String(row.proposer || '').toLowerCase().includes(kingNameSearch);
        return byDept && byName;
      });
    tbody.innerHTML = rows.map(row =>
      '<tr class="' + (row.rank <= 3 ? 'top3-row rank-' + row.rank : '') + '"' + (kingNameSearch && String(row.proposer || '').toLowerCase().includes(kingNameSearch) ? ' style="background:#f4f8ff;"' : '') + '>' +
        '<td class="rank">' + row.rank + '위</td>' +
        '<td class="score">' + row.score.toLocaleString() + '</td>' +
        '<td>' + normalizeDepartmentName(row.department) + '</td>' +
        '<td>' + (row.proposer || '') + '</td>' +
        '<td>' + ((row.count || 0).toLocaleString()) + '</td>' +
        '<td>' + row.A + '</td>' +
        '<td>' + row.B + '</td>' +
        '<td>' + row.C + '</td>' +
        '<td>' + row.adopted + '</td>' +
        '<td>' + row.joined + '</td>' +
        '<td>' + row.suggested + '</td>' +
      '</tr>'
    ).join('');
    if (!rows.length) {
      tbody.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
  }

  buildMonthOptions();
  buildGradeOptions();
  render();
  renderKing();
  renderAGrade();
  renderShareChart();

  document.getElementById('monthSelect').addEventListener('change', (event) => {
    activeMonth = event.target.value;
    render();
  });
  document.getElementById('gradeSelect').addEventListener('change', (event) => {
    activeGrade = event.target.value;
    render();
  });

  document.getElementById('searchInput').addEventListener('input', (event) => {
    searchText = event.target.value.trim().toLowerCase();
    render();
  });
  document.getElementById('kingDeptSelect').addEventListener('change', (event) => {
    kingDept = event.target.value;
    renderKing();
  });
  document.getElementById('kingNameInput').addEventListener('input', (event) => {
    kingNameSearch = event.target.value.trim().toLowerCase();
    renderKing();
  });
  document.getElementById('aGradeSearchInput').addEventListener('input', (event) => {
    aGradeSearch = event.target.value.trim().toLowerCase();
    renderAGrade();
  });
  document.getElementById('openAGradeModalBtn').addEventListener('click', () => {
    document.getElementById('aGradeModalShare').classList.add('open');
    loadLiveAGradeDataIfNeeded().then(renderAGrade);
  });
  document.getElementById('closeAGradeModalBtn').addEventListener('click', () => {
    document.getElementById('aGradeModalShare').classList.remove('open');
  });
  document.getElementById('aGradeModalShare').addEventListener('click', (event) => {
    if (event.target.id === 'aGradeModalShare') {
      document.getElementById('aGradeModalShare').classList.remove('open');
    }
  });
  document.getElementById('aGradeTableBody').addEventListener('click', (event) => {
    const button = event.target.closest('[data-a-grade-key]');
    if (!button) return;
    const pdf = allAGradeLinks[button.dataset.aGradeKey];
    if (pdf && pdf.url) window.open(pdf.url, '_blank', 'noopener,noreferrer');
  });
  document.getElementById('openKingModalBtn').addEventListener('click', () => {
    document.getElementById('kingModalShare').classList.add('open');
    renderKing();
  });
  document.getElementById('closeKingModalBtn').addEventListener('click', () => {
    document.getElementById('kingModalShare').classList.remove('open');
  });
  document.getElementById('kingModalShare').addEventListener('click', (event) => {
    if (event.target.id === 'kingModalShare') {
      document.getElementById('kingModalShare').classList.remove('open');
    }
  });
  document.getElementById('openChartModalBtn').addEventListener('click', () => {
    document.getElementById('chartModalShare').classList.add('open');
    renderShareChart();
  });
  document.getElementById('closeChartModalBtn').addEventListener('click', () => {
    document.getElementById('chartModalShare').classList.remove('open');
  });
  document.getElementById('chartModalShare').addEventListener('click', (event) => {
    if (event.target.id === 'chartModalShare') {
      document.getElementById('chartModalShare').classList.remove('open');
    }
  });
  document.getElementById('shareMonthModeBtn').addEventListener('click', () => {
    shareStatsView = 'chart';
    shareChartMode = 'month';
    renderShareChart();
  });
  document.getElementById('shareYearModeBtn').addEventListener('click', () => {
    shareStatsView = 'chart';
    shareChartMode = 'year';
    renderShareChart();
  });
  document.getElementById('shareGoalModeBtn').addEventListener('click', () => {
    shareStatsView = 'goal';
    renderShareChart();
  });
  document.getElementById('shareChartPeriod').addEventListener('change', (event) => {
    shareChartPeriod = event.target.value || '전체';
    renderShareChart();
  });
  document.getElementById('shareChartGrade').addEventListener('change', (event) => {
    shareChartGrade = event.target.value || '전체';
    renderShareChart();
  });
  document.getElementById('goalMonthSelect').addEventListener('change', (event) => {
    shareGoalMonth = event.target.value || '전체';
    renderShareChart();
  });
<\/script>
</body>
</html>`;
  }

  async function saveShareSnapshot() {
    const rows = collectGridRows();
    const sharedKingRows = getSortedKingRows().map(({ rank, score, ...row }) => row);
    let shareAGradeRows = typeof dedupeAGradeRows === 'function'
      ? dedupeAGradeRows(aGradeRows)
      : (Array.isArray(aGradeRows) ? aGradeRows : []);
    let shareAGradeRemoteLinks = aGradeRemoteLinks && typeof aGradeRemoteLinks === 'object' ? aGradeRemoteLinks : {};
    try {
      const latestShared = await loadSharedData();
      if (latestShared) {
        if (Array.isArray(latestShared.aGradeRows) && latestShared.aGradeRows.length) {
          shareAGradeRows = typeof dedupeAGradeRows === 'function'
            ? dedupeAGradeRows(latestShared.aGradeRows)
            : latestShared.aGradeRows;
          aGradeRows = shareAGradeRows;
          saveAGradeRowsToLocal();
        }
        if (latestShared.aGradeRemoteLinks && typeof latestShared.aGradeRemoteLinks === 'object') {
          shareAGradeRemoteLinks = latestShared.aGradeRemoteLinks;
          aGradeRemoteLinks = latestShared.aGradeRemoteLinks;
          saveAGradeRemoteLinksToLocal();
        }
      }
    } catch (error) {
      console.warn('share a-grade latest load failed', error);
    }
    const sharedAGradeLinks = {};
    Object.entries(shareAGradeRemoteLinks || {}).forEach(([key, value]) => {
      const item = value && typeof value === 'object' ? { ...value } : {};
      if (item.firebaseUrl) {
        item.url = item.firebaseUrl;
      } else if (item.url && /^\/[^/]/.test(item.url)) {
        item.url = getShareServerOrigin() + item.url;
      }
      sharedAGradeLinks[key] = item;
    });
    const rawName = document.getElementById('shareFileName').value.trim() || '개선제안정리_공유';
    const fileBase = rawName.replace(/[\\/:*?"<>|]/g, '_');
    const fileTitle = fileBase;
    const html = buildStandaloneShareHtml(fileTitle, rows, sharedKingRows, shareAGradeRows || [], sharedAGradeLinks);
    const defaultName = fileBase.endsWith('.html') ? fileBase : fileBase + '.html';

    if (window.desktopApp && window.desktopApp.isElectron && window.desktopApp.saveHtmlSnapshot) {
      try {
        const result = await window.desktopApp.saveHtmlSnapshot({ html, defaultName });
        if (!result || result.canceled) {
          showToast('저장이 취소되었습니다.', true);
          return;
        }
        closeShareDialog();
        showToast('📤 공유 파일이 저장되었습니다!');
      } catch (error) {
        showToast('❌ 파일 저장 실패: ' + error.message, true);
      }
      return;
    }

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = defaultName;
    a.click();
    closeShareDialog();
    showToast('📤 공유 파일이 저장되었습니다!');
  }

  function exportAsHTML() {
    openShareDialog();
  }

  async function loadFromLocal() {
    try {
      loadAGradeRowsFromLocal();
      loadAGradePdfLinksFromLocal();
      loadAGradeRemoteLinksFromLocal();
      mergeEmbeddedAGradeSnapshot();
      syncAGradeFileButtons();
      const saved = localStorage.getItem('impData');
      let rows = [];
      if (saved !== null) {
        rows = (JSON.parse(saved) || []).map(row => ({
          ...row,
          department: row.department || ''
        }));
        loadKingFromLocal();
      } else if (window.__embeddedSnapshot__) {
        applyEmbeddedSnapshot(window.__embeddedSnapshot__);
        return;
      } else {
        const shared = await loadSharedData();
        if (shared && Array.isArray(shared.rows) && shared.rows.length) {
          rows = shared.rows.map(row => ({
            ...row,
            department: row.department || ''
          }));
          kingRows = Array.isArray(shared.kingRows) ? shared.kingRows : [];
          aGradeRows = Array.isArray(shared.aGradeRows) ? shared.aGradeRows : aGradeRows;
          aGradeRemoteLinks = shared.aGradeRemoteLinks && typeof shared.aGradeRemoteLinks === 'object' ? shared.aGradeRemoteLinks : aGradeRemoteLinks;
          localStorage.setItem('impData', JSON.stringify(rows));
          localStorage.setItem('kingData', JSON.stringify(kingRows || []));
          saveAGradeRowsToLocal();
          saveAGradeRemoteLinksToLocal();
          document.getElementById('saveStatus').textContent = '공용 데이터 불러옴';
        }
      }
      const latestShared = window.__embeddedSnapshot__ ? null : await loadSharedData();
      if (latestShared) {
        if (Array.isArray(latestShared.aGradeRows) && latestShared.aGradeRows.length) {
          aGradeRows = latestShared.aGradeRows;
          saveAGradeRowsToLocal();
        }
        if (latestShared.aGradeRemoteLinks && typeof latestShared.aGradeRemoteLinks === 'object') {
          aGradeRemoteLinks = latestShared.aGradeRemoteLinks;
          saveAGradeRemoteLinksToLocal();
        }
        syncAGradeFileButtons();
      }
      gridApi.setGridOption('rowData', rows);
      if (!kingRows.length) kingRows = deriveKingRowsFromGrid();
      setTimeout(() => {
        updateStats();
        if (gridApi) {
          gridApi.refreshHeader();
          gridApi.refreshCells({ force: true });
        }
      }, 200);
    } catch(e) {}
  }


  function openPuuiseo() {
    showToast('품의서 기능은 제거되었습니다.', true);
  }

