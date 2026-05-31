  let gridApi;
  let isUpdating = false;
  let activeMonthFilter = '전체';  // 현재 선택된 월 전역 추적
  let embeddedSnapshotApplied = false;
  let kingRows = [];
  let aGradeRows = [];
  let aGradePdfLinks = {};
  let aGradeRemoteLinks = {};
  let firebaseApp = null;
  let firebaseDb = null;
  let firebaseAuthReady = false;
  const isEmbeddedShareFile = () => !!window.__embeddedSnapshot__;
  const A_GRADE_FILE_KEY = 'aGradeExternalFilePath';
  const A_GRADE_FOLDER_KEY = 'aGradePdfFolderPath';
  const A_GRADE_ROWS_KEY = 'aGradeRegistryRows';
  const A_GRADE_LINKS_KEY = 'aGradePdfLinks';
  const A_GRADE_REMOTE_KEY = 'aGradePdfRemoteLinks';
  const A_GRADE_SYNC_DOC_PATH = (window.APP_FIREBASE_DATA_DOC_PATH || 'shared/improvement-app') + '/aGrade/pdfLinks';

  // 등급 정규화 및 시상금 매핑
  const GRADE_REWARD = { 'A': 50000, 'B': 20000, 'C': 5000, '채택': 5000, '건의': 0, '참가': 2000, '5S': 0, '단순': 0, '중복': 0 };
  const DEFAULT_GEMINI_API_KEY = '';
  const KING_FORMULA = { label: '기본 점수', subtitle: 'A×10 + B×5 + C×3 + 채택×3 + 참가×2 + 건의×1', weights: { A: 10, B: 5, C: 3, 채택: 3, 참가: 2, 건의: 1 } };
  const CHART_GRADE_ORDER = ['채택', '참가', '5S', '건의', 'A', 'B', 'C'];
  const CHART_GRADE_COLORS = {
    '채택': '#ff2d20',
    '참가': '#0ea5e9',
    '5S': '#f97316',
    '건의': '#4f79b3',
    'A': '#fff200',
    'B': '#4b97a8',
    'C': '#8fd14f'
  };
  let gradeChartMode = 'month';
  let gradeChartPeriod = '전체';
  function normalizeGrade(raw) {
    const s = String(raw || '').trim();
    // 한글 먼저 (영문 C와 혼동 방지)
    if (s.includes('채택') || s.includes('채핵')) return '채택';
    if (s.includes('건의') || s.includes('견의')) return '건의';
    if (s.includes('참가') || s.includes('참카')) return '참가';
    if (/5\s*s/i.test(s)) return '5S';
    if (s.includes('단순')) return '단순';
    if (s.includes('중복')) return '중복';
    if (/^a$/i.test(s)) return 'A';
    if (/^b$/i.test(s)) return 'B';
    if (/^c$/i.test(s)) return 'C';
    return s;
  }
  function rewardFromGrade(g) { return GRADE_REWARD[g] !== undefined ? GRADE_REWARD[g] : 0; }
  function inferSafetyMark(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.includes('○') || text.toLowerCase() === 'o' || text.includes('위험') || text.includes('아차')) return '○';
    const normalized = text.toLowerCase();
    const safetyKeywords = [
      '안전', '위험', '아차', '사고', '재해', '예방', '방지', '보호', 'guard', '가드레일', '가드',
      '낙하', '추락', '전도', '미끄', '충돌', '끼임', '협착', '감전', '누전', '누출', '화재', '폭발',
      '화상', '질식', '중독', '보안경', '안전화', '보호구', '반사경', '안전개선', '위험요소'
    ];
    return safetyKeywords.some(keyword => normalized.includes(String(keyword).toLowerCase())) ? '○' : '';
  }
  // 직급 제거 함수
  function stripRank(n) {
    return String(n||'').replace(/(팀장|대리|과장|차장|부장|사원|주임|선임|책임|이사|전무|상무|수석|파트장|계장|반장|소장|본부장|실장|매니저)$/g, '').trim();
  }
  function compactProposalSummary(value, fallbackParts = []) {
    const fallback = fallbackParts.filter(Boolean).join(' ');
    const source = String(value || fallback || '').replace(/\s+/g, ' ').trim();
    if (!source) return '';
    const cleaned = source
      .replace(/하기\s*위해/g, '')
      .replace(/할\s*수\s*있도록/g, '')
      .replace(/가능하도록/g, '')
      .replace(/하도록\s*한\s*제안/g, '')
      .replace(/개선한\s*제안/g, '개선')
      .replace(/한\s*제안/g, '')
      .replace(/[,\s]+$/g, '')
      .trim();
    if (cleaned.length <= 54) return cleaned;
    return cleaned.slice(0, 54).replace(/[,\s/·-]+$/g, '');
  }
  function deriveKingRowsFromGrid() {
    if (!gridApi) return [];
    const grouped = new Map();
    gridApi.forEachNode(node => {
      const row = node.data || {};
      const proposer = stripRank(row.proposer || '');
      if (!proposer) return;
      const department = String(row.department || '').trim() || '-';
      const key = department + '||' + proposer;
      if (!grouped.has(key)) {
        const yearMatch = String(row.date || '').match(/20\d{2}/);
        grouped.set(key, {
          originalRank: 0,
          department,
          proposer,
          year: yearMatch ? yearMatch[0] : '',
          A: 0,
          B: 0,
          C: 0,
          adopted: 0,
          joined: 0,
          suggested: 0,
          count: 0
        });
      }
      const target = grouped.get(key);
      const grade = normalizeGrade(row.grade);
      target.count += 1;
      if (!target.year) {
        const yearMatch = String(row.date || '').match(/20\d{2}/);
        if (yearMatch) target.year = yearMatch[0];
      }
      if (grade === 'A') target.A += 1;
      else if (grade === 'B') target.B += 1;
      else if (grade === 'C') target.C += 1;
      else if (grade === '채택') target.adopted += 1;
      else if (grade === '참가') target.joined += 1;
      else if (grade === '건의' || grade === '5S') target.suggested += 1;
    });
    return Array.from(grouped.values());
  }
  function computeKingScore(row) {
    const weights = KING_FORMULA.weights;
    return (
      (Number(row.A) || 0) * weights.A +
      (Number(row.B) || 0) * weights.B +
      (Number(row.C) || 0) * weights.C +
      (Number(row.adopted) || 0) * weights.채택 +
      (Number(row.joined) || 0) * weights.참가 +
      (Number(row.suggested) || 0) * weights.건의
    );
  }
  function getSortedKingRows() {
    return kingRows
      .map(row => ({ ...row, score: computeKingScore(row) }))
      .sort((a, b) => (
        b.score - a.score ||
        (b.count || 0) - (a.count || 0) ||
        (b.A || 0) - (a.A || 0) ||
        String(a.proposer || '').localeCompare(String(b.proposer || ''), 'ko')
      ))
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }
  function getRowYear(row) {
    const match = String(row.date || '').match(/20\d{2}/);
    return match ? match[0] : '';
  }
  function getChartPeriods(mode) {
    const values = new Set();
    if (!gridApi) return ['전체'];
    gridApi.forEachNode(node => {
      const row = node.data || {};
      const value = mode === 'year' ? getRowYear(row) : String(row.month || '').trim();
      if (value) values.add(value);
    });
    if (mode === 'year') return ['전체', ...Array.from(values).sort()];
    const monthOrder = ["12월","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월"];
    return ['전체', ...Array.from(values).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b))];
  }
  function getDepartmentGradeRows() {
    if (!gridApi) return [];
    const map = new Map();
    gridApi.forEachNode(node => {
      const row = node.data || {};
      const periodValue = gradeChartMode === 'year' ? getRowYear(row) : String(row.month || '').trim();
      if (gradeChartPeriod !== '전체' && periodValue !== gradeChartPeriod) return;
      const department = String(row.department || '').trim();
      if (!department) return;
      if (!map.has(department)) {
        map.set(department, { department, total: 0, 채택: 0, 참가: 0, '5S': 0, 건의: 0, A: 0, B: 0, C: 0 });
      }
      const target = map.get(department);
      const grade = normalizeGrade(row.grade);
      target.total += 1;
      if (CHART_GRADE_ORDER.includes(grade)) target[grade] += 1;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total || a.department.localeCompare(b.department, 'ko'));
  }
  function setGradeChartMode(mode) {
    gradeChartMode = mode === 'year' ? 'year' : 'month';
    const periods = getChartPeriods(gradeChartMode);
    gradeChartPeriod = periods.includes(gradeChartPeriod) ? gradeChartPeriod : '전체';
    renderGradeChart();
  }
  function setGradeChartPeriod(value) {
    gradeChartPeriod = value || '전체';
    renderGradeChart();
  }
  function splitChartLabel(text) {
    const raw = String(text || '');
    if (raw.length <= 6) return [raw];
    if (raw.includes(' ')) {
      const parts = raw.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) return [parts.slice(0, -1).join(' '), parts.slice(-1).join(' ')];
    }
    const mid = Math.ceil(raw.length / 2);
    return [raw.slice(0, mid), raw.slice(mid)];
  }
  function openGradeChart() {
    renderGradeChart();
    document.getElementById('gradeChartModal').style.display = 'block';
  }
  function renderGradeChart() {
    const rows = getDepartmentGradeRows();
    const summaryEl = document.getElementById('gradeChartSummary');
    const bodyEl = document.getElementById('gradeChartBody');
    const periodEl = document.getElementById('gradeChartPeriod');
    const monthBtn = document.getElementById('chartModeMonthBtn');
    const yearBtn = document.getElementById('chartModeYearBtn');
    if (!summaryEl || !bodyEl) return;
    const periods = getChartPeriods(gradeChartMode);
    if (!periods.includes(gradeChartPeriod)) gradeChartPeriod = '전체';
    if (periodEl) {
      periodEl.innerHTML = periods.map(v => `<option value="${escapeHtml(v)}" ${v === gradeChartPeriod ? 'selected' : ''}>${escapeHtml(v === '전체' ? (gradeChartMode === 'year' ? '전체 연도' : '전체 월') : v)}</option>`).join('');
    }
    if (monthBtn) monthBtn.classList.toggle('on', gradeChartMode === 'month');
    if (yearBtn) yearBtn.classList.toggle('on', gradeChartMode === 'year');
    if (!rows.length) {
      summaryEl.innerHTML = '';
      bodyEl.innerHTML = '<div class="chart-empty">등급표를 그릴 데이터가 없습니다. 먼저 제안 데이터를 불러오거나 입력해 주세요.</div>';
      return;
    }

    const topDept = rows[0];
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const maxValue = Math.max(...rows.map(row => row.total), 1);
    const chartMax = Math.max(5, Math.ceil(maxValue / 5) * 5);
    const tickStep = chartMax <= 10 ? 2 : 5;
    const ticks = [];
    for (let value = 0; value <= chartMax; value += tickStep) ticks.push(value);

    summaryEl.innerHTML = [
      { label: '집계 기준', value: gradeChartMode === 'year' ? '연 통계' : '월 통계' },
      { label: '선택 기간', value: gradeChartPeriod },
      { label: '최다 부서', value: topDept.department },
      { label: '최다 건수', value: topDept.total.toLocaleString() + '건' }
    ].map(card => `<div class="chart-sc"><div class="sl">${card.label}</div><div class="sv">${card.value}</div></div>`).join('');

    const width = Math.max(1100, rows.length * 120 + 180);
    const height = 512;
    const left = 70;
    const right = 30;
    const top = 54;
    const bottom = 106;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const barSlot = plotWidth / rows.length;
    const barWidth = Math.min(72, Math.max(42, barSlot * 0.52));

    const gridLines = ticks.map(value => {
      const y = top + plotHeight - (value / chartMax) * plotHeight;
      return `
        <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#111827" stroke-width="1.4" stroke-dasharray="2 3" />
        <text x="${left - 14}" y="${y + 5}" text-anchor="end" font-size="12" fill="#111827">${value === 0 ? '0건' : value + '건'}</text>
      `;
    }).join('');

    const bars = rows.map((row, index) => {
      const x = left + barSlot * index + (barSlot - barWidth) / 2;
      let stacked = 0;
      const segments = CHART_GRADE_ORDER.map(grade => {
        const value = row[grade] || 0;
        if (!value) return '';
        const segmentHeight = (value / chartMax) * plotHeight;
        const y = top + plotHeight - stacked - segmentHeight;
        stacked += segmentHeight;
        const labelY = y + segmentHeight / 2 + 5;
        return `
          <rect x="${x}" y="${y}" width="${barWidth}" height="${segmentHeight}" fill="${CHART_GRADE_COLORS[grade]}" rx="0" />
          ${segmentHeight > 22 ? `<text x="${x + barWidth / 2}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="800" fill="${grade === 'A' ? '#111827' : '#ffffff'}">${value}</text>` : ''}
        `;
      }).join('');
      const labelLines = splitChartLabel(row.department).map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      return `
        ${segments}
        <text x="${x + barWidth / 2}" y="${height - 56}" text-anchor="middle" font-size="12" font-weight="800" fill="#111827" style="font-family:'Noto Sans KR','Malgun Gothic',sans-serif;">
          ${labelLines.map((line, idx) => `<tspan x="${x + barWidth / 2}" dy="${idx === 0 ? 0 : 14}">${line}</tspan>`).join('')}
        </text>
        <text x="${x + barWidth / 2}" y="${height - 22}" text-anchor="middle" font-size="11" font-weight="700" fill="#6b7280">${row.total}건</text>
      `;
    }).join('');

    const legend = ['C', 'B', 'A', '건의', '5S', '참가', '채택'].map(grade => `
      <div class="chart-legend-item">
        <span class="chart-legend-swatch" style="background:${CHART_GRADE_COLORS[grade]};"></span>
        <span>${grade}</span>
      </div>
    `).join('');

    bodyEl.innerHTML = `
      <div class="chart-toolbar">
        <div class="chart-note">현재 프로그램 데이터 기준으로 ${gradeChartMode === 'year' ? '연도별' : '월별'} 부서 등급 건수를 누적해서 보여줍니다.</div>
        <div class="chart-legend">${legend}</div>
      </div>
      <div style="overflow-x:auto;">
        <div class="chart-wrap">
          <svg id="gradeChartSvg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMinYMin meet" aria-label="부서별 제안건수 등급표">
            <text x="${width / 2}" y="18" dominant-baseline="hanging" text-anchor="middle" font-size="22" font-weight="900" fill="#111827" style="font-family:'Noto Sans KR','Malgun Gothic',sans-serif;">${gradeChartMode === 'year' ? '부서별 제안건수 연 등급표' : '부서별 제안건수 월 등급표'}</text>
            <line x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}" stroke="#666" stroke-width="1.3" />
            <line x1="${left}" y1="${top + plotHeight}" x2="${width - right}" y2="${top + plotHeight}" stroke="#666" stroke-width="1.3" />
            ${gridLines}
            ${bars}
          </svg>
        </div>
      </div>
    `;
  }

  const columnDefs = [
    {
      headerName: "NO",
      valueGetter: (params) => {
        return (params.node && params.node.rowIndex !== null) ? params.node.rowIndex + 1 : "";
      },
      width: 72,
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true,
      pinned: 'left',
      lockPosition: true,
      sortable: false,
      suppressMovable: true,
      cellStyle: { color: 'var(--text-dim)', textAlign: 'center', fontWeight: 'bold' }
    },
    { headerName: "월", field: "month", width: 56, editable: true },
    { headerName: "접수일", field: "date", width: 96, editable: true },
    { headerName: "부서명", field: "department", width: 112, editable: true, filter: true },
    { headerName: "제안자", field: "proposer", width: 84, editable: true, filter: true },
    {
      headerName: "제안명",
      field: "title",
      flex: 1,
      editable: true,
      filter: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: {
        fontWeight: '500',
        whiteSpace: 'normal',
        lineHeight: '1.45',
        wordBreak: 'break-word',
        paddingTop: '8px',
        paddingBottom: '8px'
      }
    },
    { headerName: "등급", field: "grade", width: 80, editable: true },
    { headerName: "시상금", field: "reward", width: 110, editable: true,
      valueFormatter: params => params.value ? Number(params.value).toLocaleString() + '원' : '0원'
    },
    { headerName: "안전", field: "safety", width: 80, editable: true, cellStyle: { textAlign: 'center' },
      cellRenderer: params => params.value === '○' ? '<span style="color:var(--danger); font-weight:bold; font-size:16px;">○</span>' : ''
    }
  ];

  document.addEventListener('DOMContentLoaded', () => {
    const gridDiv = document.querySelector('#myGrid');
    const gridOptions = {
      columnDefs: columnDefs,
      rowData: [],
      defaultColDef: { sortable: true, resizable: true, filter: true, editable: true },
      rowSelection: 'multiple',
      stopEditingWhenCellsLoseFocus: true,
      onCellValueChanged: (params) => {
        if (isUpdating) return;
        if (params.column.getColId() === 'department') {
          const val = String(params.newValue || "");
          const cleaned = val.replace(/^[a-zA-Z]\s+/, '').trim();
          if (val !== cleaned) {
            isUpdating = true;
            params.node.setDataValue('department', cleaned);
            isUpdating = false;
          }
        }
        // 등급 변경 시 시상금 자동 업데이트
        if (params.column.getColId() === 'grade') {
          const normalized = normalizeGrade(String(params.newValue || ''));
          const reward = rewardFromGrade(normalized);
          isUpdating = true;
          params.node.setDataValue('grade', normalized);
          params.node.setDataValue('reward', reward);
          isUpdating = false;
        }
        saveToLocal();
        updateStats();
      },
      onFilterChanged: () => { updateStats(); },
      onSortChanged: () => { gridApi.refreshCells({ columns: ['no'] }); }
    };

    gridApi = agGrid.createGrid(gridDiv, gridOptions);
    loadFromLocal();
    syncAGradeFileButtons();
    toggleAnalysisPanel(false);

    const dz = document.getElementById('dropZone');
    const analysisPanel = document.getElementById('analysisToolsPanel');
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes('Files') && analysisPanel && analysisPanel.classList.contains('open')) {
        dz.classList.add('active');
      }
    });
    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null || !document.body.contains(e.relatedTarget)) dz.classList.remove('active');
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('active');
      if (analysisPanel && analysisPanel.classList.contains('open') && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0]);
      }
    });
    window.addEventListener('resize', () => {
      if (gridApi) gridApi.sizeColumnsToFit();
    });
  });

  function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('collapsed');
    setTimeout(() => { if (gridApi) gridApi.sizeColumnsToFit(); }, 300);
  }

  function toggleAnalysisPanel(forceOpen) {
    const panel = document.getElementById('analysisToolsPanel');
    const icon = document.getElementById('analysisToggleIcon');
    const btn = document.getElementById('analysisToggleBtn');
    if (!panel) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
    panel.classList.toggle('open', shouldOpen);
    if (icon) icon.textContent = shouldOpen ? '−' : '+';
    if (btn) btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  }

  function handleFileChange(e) { if (e.target.files[0]) processFile(e.target.files[0]); }

  function processFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') processPDF(file);
    else if (['xlsx', 'xls'].includes(ext)) processExcel(file);
    else showToast('❌ 지원하지 않는 파일 형식입니다.', true);
  }

  // ── 엑셀 처리 ──
  function processExcel(file) {
    setLoading(true, '엑셀 데이터를 읽고 있습니다...', '');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const importedAGradeRows = parseAGradeSheet(wb);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        let headerIdx = raw.findIndex(row => row && row.some(v => String(v).includes('NO') || String(v).includes('제안명')));
        if (headerIdx === -1) throw new Error('서식을 찾을 수 없습니다.');

        const headers = raw[headerIdx].map(v => String(v).trim().replace(/\s/g, ''));
        const map = { month: ['월'], date: ['접수일'], department: ['부서명'], proposer: ['제안자'], title: ['제안명'], grade: ['등급'], reward: ['시상금'], safety: ['안전'] };
        const colIdx = {};
        Object.keys(map).forEach(key => colIdx[key] = headers.findIndex(h => map[key].some(t => h.includes(t))));

        const records = [];
        for (let i = headerIdx + 1; i < raw.length; i++) {
          const row = raw[i];
          if (!row || !row.some(v => v !== "")) continue;
          const title = String(row[colIdx.title] || "");
          const rawSafety = String(row[colIdx.safety] || "");
          records.push({
            month: String(row[colIdx.month] || ""),
            date: String(row[colIdx.date] || ""),
            department: String(row[colIdx.department] || "").replace(/^[a-zA-Z]\s+/, '').trim(),
            proposer: stripRank(row[colIdx.proposer]),
            title,
            grade: normalizeGrade(row[colIdx.grade]),
            reward: rewardFromGrade(normalizeGrade(row[colIdx.grade])),
            safety: rawSafety.includes('○') ? '○' : inferSafetyMark(title)
          });
        }
        gridApi.applyTransaction({ add: records });
        kingRows = deriveKingRowsFromGrid();
        if (importedAGradeRows.length) {
          aGradeRows = importedAGradeRows;
          saveAGradeRowsToLocal();
          syncAGradeFileButtons();
        }
        saveKingToLocal();
        updateStats();
        showToast(`✅ 엑셀 ${records.length}건 추가 완료 · A급제안 ${importedAGradeRows.length}건 저장`);
      } catch (err) { showToast('❌ 엑셀 오류: ' + err.message, true); }
      finally { setLoading(false); }
    };
    reader.readAsArrayBuffer(file);
  }

  function formatExcelCellDate(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      if (value > 20000 && window.XLSX && XLSX.SSF) {
        return XLSX.SSF.format('yyyy.mm.dd', value);
      }
      return String(value);
    }
    return String(value).trim();
  }

  function parseAGradeSheet(wb) {
    const sheetName = wb.SheetNames.find(name => String(name).replace(/\s/g, '').includes('A급제안')) || wb.SheetNames[3];
    if (!sheetName || !wb.Sheets[sheetName]) return [];

    const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
    const headerIdx = raw.findIndex(row => row && row.some(v => String(v).replace(/\s/g, '').includes('제안명')) && row.some(v => String(v).replace(/\s/g, '').includes('등급')));
    if (headerIdx === -1) return [];

    const headers = raw[headerIdx].map(v => String(v).trim().replace(/\s/g, ''));
    const map = {
      no: ['NO', 'No', '번호'],
      year: ['접수년', '년도', '연도'],
      date: ['접수일자', '접수일'],
      department: ['부서명', '부서'],
      proposer: ['제안자', '성명'],
      title: ['제안명'],
      type: ['구분', '제안구분'],
      grade: ['등급'],
      reward: ['시상금']
    };
    const colIdx = {};
    Object.keys(map).forEach(key => colIdx[key] = headers.findIndex(h => map[key].some(t => h.includes(t))));

    const rows = [];
    for (let i = headerIdx + 1; i < raw.length; i++) {
      const row = raw[i];
      if (!row || !row.some(v => v !== "")) continue;
      const title = String(row[colIdx.title] || '').trim();
      if (!title) continue;
      const grade = normalizeGrade(row[colIdx.grade]);
      if (grade && grade !== 'A') continue;
      rows.push({
        no: String(row[colIdx.no] || '').trim(),
        year: String(row[colIdx.year] || '').trim(),
        date: formatExcelCellDate(row[colIdx.date]),
        department: String(row[colIdx.department] || '').replace(/^[a-zA-Z]\s+/, '').trim(),
        proposer: stripRank(row[colIdx.proposer]),
        title,
        type: String(row[colIdx.type] || '').trim(),
        grade: 'A',
        reward: Number(row[colIdx.reward]) || rewardFromGrade('A')
      });
    }

    return rows;
  }

  // ── [핵심] Gemini API로 PDF 분석 ──
  async function processPDF(file) {
    const key = (document.getElementById('apiKey')?.value || DEFAULT_GEMINI_API_KEY).trim();
    if (!key) { showToast('❌ Gemini API Key를 입력해주세요.', true); return; }

    setLoading(true, 'PDF를 Gemini AI가 분석 중...', '표 데이터를 추출하고 있습니다');

    try {
      // PDF → base64 변환
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error('파일 읽기 실패'));
        reader.readAsDataURL(file);
      });

      setLoading(true, 'Gemini 사용 가능 모델 확인 중...', '');

      // 실제 사용 가능한 모델 목록 조회 후 자동 선택
      let targetModel = null;
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models`, {
          headers: { 'x-goog-api-key': key }
        });
        const listData = await listRes.json();
        if (!listRes.ok) throw new Error(listData.error?.message || '모델 목록 조회 실패');

        // generateContent 지원 + flash/pro 계열 우선순위
        const priority = [
          'gemini-2.5-flash', 'gemini-2.5-flash-lite',
          'gemini-2.5-pro',
          'gemini-2.0-flash', 'gemini-2.0-flash-001',
          'gemini-flash-latest', 'gemini-pro-latest',
          'gemini-3-flash-preview', 'gemini-3-pro-preview'
        ];
        const available = (listData.models || [])
          .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
          .map(m => m.name.replace('models/', ''));

        for (const p of priority) {
          if (available.includes(p)) { targetModel = p; break; }
        }
        // 우선순위에 없으면 첫 번째 가용 모델 사용
        if (!targetModel && available.length > 0) targetModel = available[0];
        if (!targetModel) throw new Error('사용 가능한 모델이 없습니다.');
      } catch (e) {
        throw new Error('모델 목록 조회 실패: ' + e.message);
      }

      setLoading(true, `Gemini(${targetModel}) 분석 중...`, '잠시만 기다려주세요');

      const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent`;

      const prompt = `이 PDF는 개선제안서 모음입니다. 각 페이지가 제안서 1건입니다.
[양식1] 또는 제안서 형식의 페이지만 추출하세요. 裏議書(품의서), 구매요청서 등 제안서가 아닌 페이지는 완전히 제외하세요.

각 제안서에서 다음 필드를 추출하여 JSON 배열로만 응답하세요:
- month: 접수일에서 월 추출 (예: "2월")
- date: 접수일 (예: "2026.02.26")
- department: 부서명 (손글씨라도 최대한 정확히. 단, "분산QC"는 "품질관리부"로, "에스이엠", "S.E.M.", "SEM"은 "SEM"으로 표준화. 예: "생산 1부"→"생산 1부", "품질관리부"→"품질관리부", "S.E.M."→"SEM", "분산QC"→"품질관리부", "물류관리팀"→"물류관리팀", "환경관리과"→"환경관리과", "생산 2부"→"생산 2부", "총무과"→"총무과")
- proposer: 제안자 이름만 (직급 제외. "오진영 대리"→"오진영", "신은식 과장"→"신은식", "김경수"→"김경수")
- rawTitle: 제안명 원문 전체
- currentState: 현재상태 원문 핵심
- improvement: 개선안 원문 핵심
- title: 제안명 + 현재상태 + 개선안을 함께 반영한 42~50자 요약문. 제안 의도와 개선 효과가 보이게 자연스럽게 요약할 것
- grade: 반드시 아래 7가지 중 정확히 하나만. 절대 다른 값 사용 금지.
  * 영문 대문자: A, B, C (실시 등급. C는 절대로 '채택'이 아님. 영문 알파벳 C)
  * 한글: 채택, 건의, 참가, 단순, 중복 (아이디어 등급. '채택'은 절대로 C가 아님. 두 글자 한글)
  * 구분 기준: 문서에 "실시(A급)"→A, "실시(B급)"→B, "실시(C급)"→C, "아이디어(채택)"→채택, "아이디어(건의)"→건의, "아이디어(참가)"→참가, "단순제안"→단순, "중복"→중복
- reward: 0
- safety: 아래 조건 중 하나라도 해당하면 "○", 아니면 ""
  1. 검토의견란에 "■ 아차사고·위험요소발굴" 또는 "■ 위험요소 발굴/개선"에 ■(검게 채워진 네모) 체크
  2. 제안유형에 "■ 안전개선" 체크
  3. 제안내용이 낙하·추락·충돌·화재·폭발·감전·끼임·화상·누출·안전사고 예방 등 안전과 직접 관련된 경우

반드시 순수 JSON 배열만 출력. 마크다운, 코드블록, 설명 없이.
예: [
{"month":"2월","date":"2026.02.26","department":"생산 1부","proposer":"공대영","rawTitle":"S.D 전 호기 집진노즐 확인용 클램프타입 간이 점검구 설치 건","currentState":"집진노즐 상태를 확인하려면 설비를 분해해야 해서 점검이 불편함","improvement":"클램프타입 간이 점검구를 설치해 분해 없이 확인 가능하도록 개선","title":"집진노즐 분해 점검 불편을 줄이고 확인 시간을 단축한 간이 점검구 설치","grade":"채택","reward":0,"safety":"○"},
{"month":"2월","date":"2026.02.23","department":"T/S","proposer":"오진영","rawTitle":"소핑제 사용 규격 표시","currentState":"현장에서 소핑제 사용 기준이 명확하지 않아 혼선이 있음","improvement":"규격을 눈에 띄게 표시해 누구나 바로 확인 가능하도록 개선","title":"소핑제 사용 기준을 표시해 작업자 확인성과 현장 사용 혼선을 개선","grade":"C","reward":0,"safety":""},
{"month":"2월","date":"2026.02.26","department":"생산 2부","proposer":"정강민","rawTitle":"DO2~DO3 색소 저장탱크 H빔 충돌방지 개선 건","currentState":"저장탱크 주변 H빔과 작업 동선 충돌 위험이 있음","improvement":"충돌방지 구조를 보강해 작업 중 접촉 위험을 줄임","title":"저장탱크 주변 H빔 충돌 위험을 줄이기 위한 방지 구조 보강","grade":"C","reward":0,"safety":""}
]`;

      const body = {
        contents: [{
          parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64 } },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: 'application/json'
        }
      };

      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const msg = errData.error?.message || `HTTP ${response.status}`;
        // 메시지 내용 우선 판단 (상태코드보다 정확)
        if (msg.toLowerCase().includes('api key not valid') || msg.toLowerCase().includes('invalid api key')) {
          throw new Error('API 키가 올바르지 않습니다. aistudio.google.com에서 새 키를 발급해주세요.');
        }
        if (response.status === 429 || msg.includes('quota') || msg.includes('limit')) {
          throw new Error('요청 한도 초과. 1~2분 후 다시 시도하세요.');
        }
        if (response.status === 403) throw new Error('API 키 권한 없음: ' + msg);
        throw new Error(msg);
      }

      const result = await response.json();
      const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log('Gemini 원본응답:', rawText);
      console.log('Gemini 원본 응답:', rawText);
      if (!rawText) throw new Error('AI 응답이 비어 있습니다. PDF 내용을 확인하세요.');

      // JSON 파싱 (마크다운 코드블록 포함 처리)
      let records;
      try {
        const stripped = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const match = stripped.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('배열 없음');
        records = JSON.parse(match[0]);
      } catch {
        throw new Error('AI 응답을 파싱할 수 없습니다. PDF 형식을 확인하세요.');
      }

      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('추출된 데이터가 없습니다. PDF에 표 데이터가 있는지 확인하세요.');
      }

      // 데이터 정제
      const cleaned = records.map(r => ({
        month: String(r.month || ''),
        date: String(r.date || ''),
        department: String(r.department || '').replace(/^[a-zA-Z]\s+/, '').trim(),
        proposer: stripRank(r.proposer),
        title: compactProposalSummary(r.title, [r.rawTitle, r.currentState, r.improvement]),
        grade: normalizeGrade(r.grade),
        reward: rewardFromGrade(normalizeGrade(r.grade)),
        safety: (r.safety === '○' || r.safety === 'O' || r.safety === 'o' || r.safety === true || r.safety === 1 || String(r.safety||'').includes('○') || String(r.safety||'').includes('위험') || String(r.safety||'').includes('아차')) ? '○' : ''
      }));

      gridApi.applyTransaction({ add: cleaned });
      updateStats();
      showToast(`✅ Gemini 분석 완료: ${cleaned.length}건 추가됨`);

    } catch (err) {
      console.error('PDF 분석 오류:', err);
      showToast(`❌ 분석 실패: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  }

  function addNewRow() {
    const activeTab = document.getElementById('monthSelect').value;
    const row = {
      month: activeTab === '전체' ? "" : activeTab,
      title: '새 제안',
      date: new Date().toISOString().slice(0,10).replace(/-/g,'.')
    };
    gridApi.applyTransaction({ add: [row] });
    updateStats();
  }

  function deleteSelected() {
    const selected = gridApi.getSelectedRows();
    const currentMonth = document.getElementById('monthSelect').value;

    // 체크된 행이 있으면 체크된 것만, 없으면 현재 필터 보이는 행만
    let toDelete = [];
    if (selected.length > 0) {
      toDelete = selected;
    } else {
      gridApi.forEachNodeAfterFilterAndSort(node => toDelete.push(node.data));
    }

    if (toDelete.length === 0) return;

    const label = selected.length > 0
      ? `선택한 ${toDelete.length}건`
      : currentMonth === '전체' ? `전체 ${toDelete.length}건` : `[${currentMonth}] ${toDelete.length}건`;

    if (confirm(`${label}을 삭제하시겠습니까?`)) {
      gridApi.applyTransaction({ remove: toDelete });
      updateStats();
    }
  }

  function updateStats() {
    let t = 0, r = 0, s = 0;
    const allMonths = new Set();
    const currentActive = activeMonthFilter;

    gridApi.forEachNode(node => {
      if (node.data.month) allMonths.add(String(node.data.month).trim());
    });

    gridApi.forEachNodeAfterFilterAndSort(node => {
      t++;
      r += (Number(node.data.reward) || 0);
      if (node.data.safety === '○') s++;
    });

    document.getElementById('currentViewMode').textContent = `[${currentActive} 통계]`;
    document.getElementById('stat-total').textContent = t;
    document.getElementById('stat-reward').textContent = r.toLocaleString();
    document.getElementById('stat-safety').textContent = s;

    updateMonthDropdown(Array.from(allMonths), currentActive);
    syncAGradeFileButtons();
    saveToLocal();
  }

  function updateMonthDropdown(monthList, current) {
    const select = document.getElementById('monthSelect');
    const monthOrder = ["12월","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월"];
    monthList.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));

    let html = `<option value="전체" ${current === '전체' ? 'selected' : ''}>전체 보기</option>`;
    monthList.forEach(m => {
      if (m) html += `<option value="${m}" ${current === m ? 'selected' : ''}>${m} (${m === '12월' ? '2025' : '2026'})</option>`;
    });
    select.innerHTML = html;
    select.value = current;
  }

  function filterByMonth(month) {
    activeMonthFilter = month;
    if (month === '전체') gridApi.setColumnFilterModel('month', null).then(() => gridApi.onFilterChanged());
    else gridApi.setColumnFilterModel('month', { filterType: 'text', type: 'equals', filter: month }).then(() => gridApi.onFilterChanged());
  }

  function getAGradeFolderPath() {
    return localStorage.getItem(A_GRADE_FOLDER_KEY) || '';
  }

  function getAGradeFolderName() {
    const folderPath = getAGradeFolderPath();
    if (!folderPath) return '';
    const parts = folderPath.split(/[\\/]/);
    return parts[parts.length - 1] || folderPath;
  }

  function syncAGradeFileButtons() {
    const openBtn = document.getElementById('aGradeViewBtn');
    const folderName = getAGradeFolderName();
    if (openBtn) {
      const savedRows = aGradeRows.length ? `A급제안 ${aGradeRows.length}건` : 'A급제안 등록부 없음';
      openBtn.title = folderName ? `${savedRows} · PDF 폴더: ${folderName}` : `${savedRows} · PDF 폴더를 등록하면 더블클릭으로 원본을 열 수 있습니다.`;
      openBtn.style.opacity = (folderName || aGradeRows.length) ? '1' : '0.92';
    }
  }

  async function registerAGradeFile() {
    await chooseAGradePdfFolder();
  }

  function ensureAGradePdfModal() {
    let modal = document.getElementById('aGradePdfModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'aGradePdfModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(20,28,44,0.55);z-index:9800;padding:30px;overflow:auto;';
    modal.innerHTML = `
      <div style="max-width:980px;margin:0 auto;background:#fff;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,0.22);overflow:hidden;border:1px solid #d8e1f0;">
        <div style="display:flex;align-items:center;gap:12px;padding:18px 22px;background:#fff6db;border-bottom:1px solid #ead59c;">
          <div style="font-size:24px;">⭐</div>
          <div style="flex:1;">
            <div style="font-size:18px;font-weight:800;color:#6d4900;">A급 개선제안</div>
            <div id="aGradePdfFolderLabel" style="font-size:12px;color:#87621b;margin-top:3px;"></div>
          </div>
          <button class="btn" style="background:#fff;border-color:#e5cf91;color:#6d4900;font-weight:700;" onclick="chooseAGradePdfFolder(true)">폴더 다시 선택</button>
          <button class="btn" onclick="closeAGradePdfModal()">닫기</button>
        </div>
        <div id="aGradePdfList" style="padding:18px 22px;display:grid;gap:10px;background:#f8fafd;max-height:70vh;overflow:auto;"></div>
      </div>`;
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeAGradePdfModal();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function closeAGradePdfModal() {
    const modal = document.getElementById('aGradePdfModal');
    if (modal) modal.style.display = 'none';
  }

  async function chooseAGradePdfFolder(forceOpenAfterPick = false) {
    if (!(window.desktopApp && window.desktopApp.isElectron && window.desktopApp.pickExternalDirectory)) {
      showToast('❌ 데스크톱 앱에서만 A급 PDF 폴더 선택을 사용할 수 있습니다.', true);
      return '';
    }

    const picked = await window.desktopApp.pickExternalDirectory({
      title: 'A급 제안 PDF만 모아둔 폴더 선택'
    });
    if (!picked || picked.canceled || !picked.folderPath) return '';

    localStorage.setItem(A_GRADE_FOLDER_KEY, picked.folderPath);
    localStorage.removeItem(A_GRADE_FILE_KEY);
    syncAGradeFileButtons();
    showToast(`✅ A급 PDF 폴더 등록 완료: ${getAGradeFolderName()}`);
    if (forceOpenAfterPick) await openAGradeFile();
    return picked.folderPath;
  }

  async function importAGradePdfFiles() {
    if (!(window.desktopApp && window.desktopApp.isElectron && window.desktopApp.importAGradePdfFiles)) {
      showToast('❌ 데스크톱 앱에서만 PDF 파일 등록을 사용할 수 있습니다.', true);
      return;
    }

    try {
      const result = await window.desktopApp.importAGradePdfFiles({ multi: true, title: 'A급 제안 실물 PDF 등록' });
      if (!result || result.canceled) return;
      if (result.folderPath) {
        localStorage.setItem(A_GRADE_FOLDER_KEY, result.folderPath);
        syncAGradeFileButtons();
        renderAGradeRegistry();
      }
      const count = Array.isArray(result.files) ? result.files.length : 0;
      showToast(`✅ A급 실물 PDF ${count}개 등록 완료`);
    } catch (error) {
      showToast('❌ PDF 파일 등록 실패: ' + error.message, true);
    }
  }

  async function importAGradePdfForRow(index) {
    const row = aGradeRows[index];
    if (!row) return null;
    if (!(window.desktopApp && window.desktopApp.isElectron && window.desktopApp.importAGradePdfFiles)) {
      showToast('❌ 데스크톱 앱에서만 항목별 PDF 등록을 사용할 수 있습니다.', true);
      return null;
    }

    const result = await window.desktopApp.importAGradePdfFiles({
      multi: false,
      title: `이 항목에 연결할 PDF 선택 - ${row.proposer || ''} ${row.title || ''}`.trim()
    });
    if (!result || result.canceled || !Array.isArray(result.files) || !result.files[0]) return null;

    if (result.folderPath) {
      localStorage.setItem(A_GRADE_FOLDER_KEY, result.folderPath);
      syncAGradeFileButtons();
    }

    const file = result.files[0];
    aGradePdfLinks[getAGradeRowKey(row)] = file.path;
    saveAGradePdfLinksToLocal();
    renderAGradeRegistry();
    showToast(`✅ 이 항목에 PDF 연결 완료: ${file.name}`);
    return file;
  }

  function formatFileSize(bytes) {
    const size = Number(bytes) || 0;
    if (size >= 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + 'MB';
    if (size >= 1024) return Math.round(size / 1024) + 'KB';
    return size + 'B';
  }

  function renderAGradePdfList(folderPath, files) {
    const modal = ensureAGradePdfModal();
    const labelEl = document.getElementById('aGradePdfFolderLabel');
    const listEl = document.getElementById('aGradePdfList');
    labelEl.textContent = folderPath ? `폴더: ${folderPath}` : 'A급 제안 PDF 폴더가 선택되지 않았습니다.';

    if (!files.length) {
      listEl.innerHTML = `
        <div style="background:#fff;border:1px dashed #d7b75f;border-radius:14px;padding:26px;text-align:center;color:#7b5a12;">
          선택한 폴더 안에 PDF가 없습니다.<br>
          A급 제안 스캔 PDF만 따로 모아둔 폴더를 다시 선택해 주세요.
        </div>`;
      modal.style.display = 'block';
      return;
    }

    listEl.innerHTML = files.map((file, index) => `
      <button type="button" onclick="openAGradePdfAt(${index})" style="display:flex;align-items:center;gap:14px;text-align:left;width:100%;border:1px solid #dde6f3;background:#fff;border-radius:14px;padding:14px 16px;cursor:pointer;box-shadow:0 4px 14px rgba(25,48,85,0.06);font-family:'Noto Sans KR',sans-serif;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:12px;background:#fff1c6;color:#8a5a00;font-weight:900;">PDF</span>
        <span style="flex:1;min-width:0;">
          <span style="display:block;font-weight:800;color:#24324a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(file.name)}</span>
          <span style="display:block;margin-top:3px;font-size:12px;color:#68758a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(file.path)}</span>
        </span>
        <span style="font-size:12px;color:#7c8798;">${formatFileSize(file.size)}</span>
      </button>
    `).join('');
    window.__aGradePdfFiles = files;
    modal.style.display = 'block';
  }

  async function openAGradePdfAt(index) {
    const files = window.__aGradePdfFiles || [];
    const file = files[index];
    if (!file) return;

    try {
      const result = await window.desktopApp.openExternalPath(file.path);
      if (!result || !result.ok) throw new Error(result?.error || 'PDF를 열 수 없습니다.');
      showToast(`✅ PDF 원본 열기: ${file.name}`);
    } catch (error) {
      showToast('❌ PDF 열기 실패: ' + error.message, true);
    }
  }

  function saveAGradeRowsToLocal() {
    localStorage.setItem(A_GRADE_ROWS_KEY, JSON.stringify(aGradeRows || []));
  }

  function loadAGradeRowsFromLocal() {
    try {
      const saved = localStorage.getItem(A_GRADE_ROWS_KEY);
      if (saved) aGradeRows = JSON.parse(saved) || [];
    } catch (e) {}
  }

  function saveAGradePdfLinksToLocal() {
    localStorage.setItem(A_GRADE_LINKS_KEY, JSON.stringify(aGradePdfLinks || {}));
  }

  function loadAGradePdfLinksFromLocal() {
    try {
      const saved = localStorage.getItem(A_GRADE_LINKS_KEY);
      if (saved) aGradePdfLinks = JSON.parse(saved) || {};
    } catch (e) {}
  }

  function getAGradeRowKey(row) {
    return [
      row.no || '',
      row.year || '',
      row.date || '',
      row.proposer || '',
      row.title || ''
    ].map(value => normalizeMatchText(value)).join('|');
  }

  function getLinkedAGradePdfPath(row) {
    return aGradePdfLinks[getAGradeRowKey(row)] || '';
  }

  function saveAGradeRemoteLinksToLocal() {
    localStorage.setItem(A_GRADE_REMOTE_KEY, JSON.stringify(aGradeRemoteLinks || {}));
  }

  function loadAGradeRemoteLinksFromLocal() {
    try {
      const saved = localStorage.getItem(A_GRADE_REMOTE_KEY);
      if (saved) aGradeRemoteLinks = JSON.parse(saved) || {};
    } catch (e) {}
  }

  function getRemoteAGradePdf(row) {
    return aGradeRemoteLinks[getAGradeRowKey(row)] || null;
  }

  function getRelativePdfPath(filePath) {
    const folderPath = getAGradeFolderPath();
    const normalizedFile = String(filePath || '').replace(/\\/g, '/');
    const normalizedFolder = String(folderPath || '').replace(/\\/g, '/').replace(/\/+$/, '');
    if (normalizedFolder && normalizedFile.toLowerCase().startsWith((normalizedFolder + '/').toLowerCase())) {
      return normalizedFile.slice(normalizedFolder.length + 1);
    }
    return normalizedFile.split('/').pop() || '';
  }

  function joinPath(basePath, relativePath) {
    const base = String(basePath || '').replace(/[\\/]+$/, '');
    const rel = String(relativePath || '').replace(/^[\\/]+/, '');
    if (!base) return rel;
    return base + '\\' + rel.replace(/\//g, '\\');
  }

  async function ensureFirebaseReady() {
    if (!window.APP_FIREBASE_CONFIG) {
      throw new Error('Firebase 설정이 없습니다. firebase-config.js에 프로젝트 정보를 입력해 주세요.');
    }
    if (!window.firebase) {
      throw new Error('Firebase SDK를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.');
    }
    if (!firebaseApp) {
      firebaseApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.APP_FIREBASE_CONFIG);
      firebaseDb = firebase.firestore();
    }
    if (!firebaseAuthReady) {
      try {
        const auth = firebase.auth();
        if (!auth.currentUser) {
          await auth.signInAnonymously();
        }
      } catch (error) {
        console.warn('Firebase anonymous auth skipped:', error);
      }
      firebaseAuthReady = true;
    }
    return { db: firebaseDb };
  }

  async function syncAGradeFromServer() {
    try {
      const { db } = await ensureFirebaseReady();
      const snap = await db.doc(A_GRADE_SYNC_DOC_PATH).get();
      if (!snap.exists) {
        showToast('서버에 저장된 A급 연결정보가 아직 없습니다.', true);
        return;
      }
      const data = snap.data() || {};
      if (Array.isArray(data.rows) && data.rows.length) {
        aGradeRows = data.rows;
        saveAGradeRowsToLocal();
      }
      aGradeRemoteLinks = data.links || {};
      saveAGradeRemoteLinksToLocal();
      renderAGradeRegistry();
      showToast(`✅ 서버에서 A급 자료 동기화 완료`);
    } catch (error) {
      showToast('❌ 서버 동기화 실패: ' + error.message, true);
    }
  }

  async function openRemoteAGradePdf(row) {
    const remote = getRemoteAGradePdf(row);
    if (!remote || !remote.relativePath) return false;
    if (!getAGradeFolderPath()) {
      const folderPath = await chooseAGradePdfFolder(false);
      if (!folderPath) return false;
    }

    const localPath = joinPath(getAGradeFolderPath(), remote.relativePath);
    const result = await window.desktopApp.openExternalPath(localPath);
    if (!result || !result.ok) {
      showToast('❌ 공유 PDF 폴더에서 파일을 찾지 못했습니다. 기존 폴더 연결을 다시 지정해 주세요.', true);
      return false;
    }
    aGradePdfLinks[getAGradeRowKey(row)] = localPath;
    saveAGradePdfLinksToLocal();
    renderAGradeRegistry();
    return true;
  }

  async function uploadAGradeToServer() {
    try {
      const { db } = await ensureFirebaseReady();
      const rowsWithLocalPdf = aGradeRows.filter(row => getLinkedAGradePdfPath(row));
      if (!rowsWithLocalPdf.length) {
        showToast('❌ 저장할 연결된 PDF 정보가 없습니다.', true);
        return;
      }

      setLoading(true, 'A급 연결정보 서버 저장 중...', 'PDF 파일명/상대경로만 Firestore에 저장합니다');
      const links = { ...aGradeRemoteLinks };
      let savedCount = 0;
      for (const row of rowsWithLocalPdf) {
        const key = getAGradeRowKey(row);
        const pdfPath = getLinkedAGradePdfPath(row);
        links[key] = {
          relativePath: getRelativePdfPath(pdfPath),
          name: pdfPath.split(/[\\/]/).pop() || 'proposal.pdf',
          row
        };
        savedCount += 1;
      }

      await db.doc(A_GRADE_SYNC_DOC_PATH).set({
        rows: aGradeRows,
        links,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      aGradeRemoteLinks = links;
      saveAGradeRemoteLinksToLocal();
      renderAGradeRegistry();
      showToast(`✅ 서버 저장 완료: PDF 연결정보 ${savedCount}개`);
    } catch (error) {
      showToast('❌ 서버 저장 실패: ' + error.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function exportAGradePackage() {
    if (!(window.desktopApp && window.desktopApp.isElectron && window.desktopApp.exportAGradePackage)) {
      showToast('❌ 데스크톱 앱에서만 자료 내보내기를 사용할 수 있습니다.', true);
      return;
    }

    const items = aGradeRows.map(row => ({
      key: getAGradeRowKey(row),
      row,
      pdfPath: getLinkedAGradePdfPath(row)
    })).filter(item => item.pdfPath);

    if (!items.length) {
      showToast('❌ 내보낼 연결된 PDF가 없습니다. 먼저 항목별 PDF를 연결해 주세요.', true);
      return;
    }

    try {
      const result = await window.desktopApp.exportAGradePackage({ rows: aGradeRows, items });
      if (!result || result.canceled) return;
      showToast(`✅ A급 자료 내보내기 완료: PDF ${result.exportedCount || 0}개`);
    } catch (error) {
      showToast('❌ A급 자료 내보내기 실패: ' + error.message, true);
    }
  }

  async function importAGradePackage() {
    if (!(window.desktopApp && window.desktopApp.isElectron && window.desktopApp.importAGradePackage)) {
      showToast('❌ 데스크톱 앱에서만 자료 가져오기를 사용할 수 있습니다.', true);
      return;
    }

    try {
      const result = await window.desktopApp.importAGradePackage();
      if (!result || result.canceled) return;

      if (Array.isArray(result.rows) && result.rows.length) {
        aGradeRows = result.rows;
        saveAGradeRowsToLocal();
      }
      aGradePdfLinks = { ...aGradePdfLinks, ...(result.links || {}) };
      saveAGradePdfLinksToLocal();
      if (result.folderPath) localStorage.setItem(A_GRADE_FOLDER_KEY, result.folderPath);
      syncAGradeFileButtons();
      renderAGradeRegistry();
      showToast(`✅ A급 자료 가져오기 완료: PDF ${result.importedCount || 0}개 연결`);
    } catch (error) {
      showToast('❌ A급 자료 가져오기 실패: ' + error.message, true);
    }
  }

  function ensureAGradeRegistryModal() {
    let modal = document.getElementById('aGradeRegistryModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'aGradeRegistryModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(20,28,44,0.55);z-index:9790;padding:28px;overflow:auto;';
    modal.innerHTML = `
      <div style="max-width:1280px;margin:0 auto;background:#fff;border-radius:18px;box-shadow:0 18px 50px rgba(0,0,0,0.22);overflow:hidden;border:1px solid #d8e1f0;">
        <div style="display:flex;align-items:center;gap:12px;padding:18px 22px;background:#fff6db;border-bottom:1px solid #ead59c;">
          <div style="font-size:24px;">⭐</div>
          <div style="flex:1;">
            <div style="font-size:18px;font-weight:800;color:#6d4900;">A급제안 등록부</div>
            <div id="aGradeRegistrySub" style="font-size:12px;color:#87621b;margin-top:3px;"></div>
          </div>
          <button class="btn" style="background:#fff;border-color:#e5cf91;color:#6d4900;font-weight:700;" onclick="importAGradePdfFiles()">PDF 파일 등록</button>
          <button class="btn" style="background:#fff;border-color:#e5cf91;color:#6d4900;font-weight:700;" onclick="chooseAGradePdfFolder(false)">기존 폴더 연결</button>
          <button class="btn" style="background:#fff;border-color:#e5cf91;color:#6d4900;font-weight:700;" onclick="openAGradePdfFolderList()">PDF 목록 보기</button>
          <button class="btn" style="background:#eaf4ff;border-color:#b8d8ff;color:#205083;font-weight:700;" onclick="exportAGradePackage()">자료 내보내기</button>
          <button class="btn" style="background:#e9f8ef;border-color:#bde5c9;color:#1f6a3d;font-weight:700;" onclick="importAGradePackage()">자료 가져오기</button>
          <button class="btn" style="background:#e7f0ff;border-color:#b9cdf8;color:#204f9a;font-weight:700;" onclick="uploadAGradeToServer()">서버 저장</button>
          <button class="btn" style="background:#eefbf6;border-color:#bce9d6;color:#146046;font-weight:700;" onclick="syncAGradeFromServer()">서버 동기화</button>
          <button class="btn" onclick="closeAGradeRegistryModal()">닫기</button>
        </div>
        <div style="padding:14px 18px;background:#f8fafd;border-bottom:1px solid #e1e9f5;font-size:12px;color:#59677d;">
          <b>PDF 파일 등록</b> 또는 <b>기존 폴더 연결</b> 후 <b>서버 저장</b>을 누르면 PDF 파일명/상대경로만 저장됩니다. 다른 컴퓨터는 같은 공유폴더를 연결한 뒤 <b>서버 동기화</b>를 누르면 됩니다.
        </div>
        <div id="aGradeRegistryBody" style="padding:18px 22px;background:#f8fafd;max-height:70vh;overflow:auto;"></div>
      </div>`;
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeAGradeRegistryModal();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function closeAGradeRegistryModal() {
    const modal = document.getElementById('aGradeRegistryModal');
    if (modal) modal.style.display = 'none';
  }

  function renderAGradeRegistry() {
    const modal = ensureAGradeRegistryModal();
    const subEl = document.getElementById('aGradeRegistrySub');
    const bodyEl = document.getElementById('aGradeRegistryBody');
    const folderName = getAGradeFolderName();
    subEl.textContent = `${aGradeRows.length}건 저장됨` + (folderName ? ` · PDF 폴더: ${folderName}` : ' · PDF 폴더 미등록');

    if (!aGradeRows.length) {
      bodyEl.innerHTML = `
        <div style="background:#fff;border:1px dashed #d7b75f;border-radius:14px;padding:28px;text-align:center;color:#7b5a12;line-height:1.7;">
          아직 A급제안 등록부가 없습니다.<br>
          4번 시트에 <b>A급제안</b>이 들어있는 엑셀 파일을 먼저 업로드하면 이곳에 그대로 저장됩니다.
        </div>`;
      modal.style.display = 'block';
      return;
    }

    bodyEl.innerHTML = `
      <table style="width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #dde6f3;border-radius:14px;overflow:hidden;font-size:13px;">
        <thead>
          <tr style="background:#fff1c6;color:#674500;">
            <th style="padding:10px;border-bottom:1px solid #e6d39b;text-align:center;width:52px;">NO</th>
            <th style="padding:10px;border-bottom:1px solid #e6d39b;text-align:center;width:76px;">접수년</th>
            <th style="padding:10px;border-bottom:1px solid #e6d39b;text-align:center;width:96px;">접수일자</th>
            <th style="padding:10px;border-bottom:1px solid #e6d39b;text-align:left;width:120px;">부서명</th>
            <th style="padding:10px;border-bottom:1px solid #e6d39b;text-align:left;width:90px;">제안자</th>
            <th style="padding:10px;border-bottom:1px solid #e6d39b;text-align:left;">제안명</th>
            <th style="padding:10px;border-bottom:1px solid #e6d39b;text-align:center;width:72px;">구분</th>
            <th style="padding:10px;border-bottom:1px solid #e6d39b;text-align:right;width:90px;">시상금</th>
            <th style="padding:10px;border-bottom:1px solid #e6d39b;text-align:center;width:96px;">PDF</th>
          </tr>
        </thead>
        <tbody>
          ${aGradeRows.map((row, index) => `
            <tr ondblclick="openAGradePdfForRow(${index})" title="더블클릭하면 실물 PDF를 엽니다" style="cursor:pointer;">
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;color:#7a8799;font-weight:700;">${escapeHtml(row.no)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;">${escapeHtml(row.year)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;">${escapeHtml(row.date)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;">${escapeHtml(row.department)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;font-weight:700;">${escapeHtml(row.proposer)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;line-height:1.45;">${escapeHtml(row.title)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;">${escapeHtml(row.type || '실시')}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:right;font-weight:700;color:#8a5a00;">${formatCurrency(row.reward)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;color:${(getLinkedAGradePdfPath(row) || getRemoteAGradePdf(row)) ? '#16794c' : '#9aa4b2'};font-weight:800;">${getLinkedAGradePdfPath(row) ? 'PC연결' : (getRemoteAGradePdf(row) ? '서버연결' : '미연결')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    modal.style.display = 'block';
  }

  function normalizeMatchText(value) {
    return String(value || '').toLowerCase().replace(/\.[^.\\/]+$/g, '').replace(/[\s\-_()[\]{}.,#~·"'“”‘’]/g, '');
  }

  function getMatchTokens(value) {
    return String(value || '')
      .split(/[\s\-_()[\]{}.,#~·"'“”‘’/\\]+/)
      .map(token => token.trim())
      .filter(token => token.length >= 2);
  }

  function findMatchingAGradePdf(row, files) {
    const titleNorm = normalizeMatchText(row.title);
    const proposerNorm = normalizeMatchText(row.proposer);
    const yearNorm = normalizeMatchText(row.year).replace(/년/g, '');
    const dateNorm = normalizeMatchText(row.date).replace(/\./g, '');
    const tokens = getMatchTokens(row.title);
    const significantTokens = tokens
      .map(token => normalizeMatchText(token))
      .filter(token => token.length >= 2);

    const matches = files.filter(file => {
      const haystack = normalizeMatchText(file.name + ' ' + file.path);
      const hasFullTitle = titleNorm.length >= 6 && haystack.includes(titleNorm);
      const hasProposer = proposerNorm.length >= 2 && haystack.includes(proposerNorm);
      const hasYear = yearNorm.length >= 4 && haystack.includes(yearNorm);
      const hasDate = dateNorm.length >= 6 && haystack.includes(dateNorm);
      const matchedTokenCount = significantTokens.filter(token => haystack.includes(token)).length;
      const enoughTitleTokens = matchedTokenCount >= Math.min(3, significantTokens.length);

      // Open automatically only when the file is clearly the same item.
      return hasFullTitle || (hasProposer && (hasDate || hasYear) && enoughTitleTokens);
    });

    return matches.length === 1 ? matches[0] : null;
  }

  async function getAGradePdfFilesFromFolder() {
    let folderPath = getAGradeFolderPath();
    if (!folderPath) {
      folderPath = await chooseAGradePdfFolder(false);
      if (!folderPath) return { folderPath: '', files: [] };
    }

    const result = await window.desktopApp.listPdfFiles(folderPath);
    return { folderPath, files: Array.isArray(result?.files) ? result.files : [] };
  }

  async function openAGradePdfForRow(index) {
    const row = aGradeRows[index];
    if (!row) return;
    if (!(window.desktopApp && window.desktopApp.isElectron && window.desktopApp.openExternalPath)) {
      showToast('❌ 데스크톱 앱에서만 실물 PDF 열기를 사용할 수 있습니다.', true);
      return;
    }

    try {
      const linkedPath = getLinkedAGradePdfPath(row);
      if (linkedPath) {
        const linkedResult = await window.desktopApp.openExternalPath(linkedPath);
        if (linkedResult && linkedResult.ok) {
          showToast(`✅ 연결된 실물 PDF 열기`);
          return;
        }
        delete aGradePdfLinks[getAGradeRowKey(row)];
        saveAGradePdfLinksToLocal();
        renderAGradeRegistry();
      }

      if (getRemoteAGradePdf(row)) {
        await openRemoteAGradePdf(row);
        showToast('✅ 서버 PDF 열기');
        return;
      }

      setLoading(true, 'A급 실물 PDF 찾는 중...', row.title);
      if (!getAGradeFolderPath()) {
        setLoading(false);
        showToast('이 항목에 맞는 PDF를 직접 선택해 주세요.', true);
        const selected = await importAGradePdfForRow(index);
        if (selected) await window.desktopApp.openExternalPath(selected.path);
        return;
      }

      const { folderPath, files } = await getAGradePdfFilesFromFolder();
      if (!folderPath) return;
      if (!files.length) {
        setLoading(false);
        const selected = await importAGradePdfForRow(index);
        if (selected) await window.desktopApp.openExternalPath(selected.path);
        return;
      }

      const matchedFile = findMatchingAGradePdf(row, files);
      if (matchedFile) {
        aGradePdfLinks[getAGradeRowKey(row)] = matchedFile.path;
        saveAGradePdfLinksToLocal();
        renderAGradeRegistry();
        const result = await window.desktopApp.openExternalPath(matchedFile.path);
        if (!result || !result.ok) throw new Error(result?.error || 'PDF를 열 수 없습니다.');
        showToast(`✅ 일치 항목 PDF 열기: ${matchedFile.name}`);
        return;
      }

      setLoading(false);
      showToast('일치하는 PDF를 찾지 못했습니다. 이 항목에 맞는 PDF를 직접 선택해 주세요.', true);
      const selected = await importAGradePdfForRow(index);
      if (selected) await window.desktopApp.openExternalPath(selected.path);
    } catch (error) {
      showToast('❌ 실물 PDF 열기 실패: ' + error.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function openAGradePdfFolderList() {
    if (!(window.desktopApp && window.desktopApp.isElectron && window.desktopApp.listPdfFiles && window.desktopApp.openExternalPath)) {
      showToast('❌ 데스크톱 앱에서만 A급 PDF 원본 보기를 사용할 수 있습니다.', true);
      return;
    }

    try {
      let folderPath = getAGradeFolderPath();
      if (!folderPath) {
        folderPath = await chooseAGradePdfFolder(false);
        if (!folderPath) return;
      }

      setLoading(true, 'A급 PDF 목록을 불러오는 중...', '스캔 원본 PDF를 찾고 있습니다');
      const result = await window.desktopApp.listPdfFiles(folderPath);
      const files = Array.isArray(result?.files) ? result.files : [];
      renderAGradePdfList(folderPath, files);
      showToast(`✅ A급 PDF ${files.length}건 불러오기 완료`);
    } catch (error) {
      localStorage.removeItem(A_GRADE_FOLDER_KEY);
      syncAGradeFileButtons();
      showToast('❌ A급 PDF 폴더를 열 수 없습니다: ' + error.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function openAGradeFile() {
    renderAGradeRegistry();
  }

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

    const rows = Array.isArray(snapshot.rows) ? snapshot.rows : [];
    gridApi.setGridOption('rowData', rows);

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
        gridApi.sizeColumnsToFit();
        setTimeout(() => gridApi && gridApi.sizeColumnsToFit(), 120);
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
  }

  function saveKingToLocal() {
    localStorage.setItem('kingData', JSON.stringify(kingRows || []));
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
    const top = allRows[0];
    const totalScore = allRows.reduce((sum, row) => sum + row.score, 0);
    const avgScore = allRows.length ? Math.round(totalScore / allRows.length) : 0;
    const highlighted = rows[0];

    summaryEl.innerHTML = [
      { label: '점수식', value: KING_FORMULA.label, color: '#6d28d9' },
      { label: '전체 참여 인원', value: allRows.length.toLocaleString() + '명', color: '#111827' },
      { label: '1위 점수', value: (top?.score || 0).toLocaleString() + '점', color: '#2563eb' },
      { label: nameSearch ? '검색 결과 최고 순위' : '평균 점수', value: nameSearch ? (highlighted ? highlighted.rank + '위' : '없음') : avgScore.toLocaleString() + '점', color: '#16a34a' }
    ].map(card => `<div class="king-sc"><div class="sl">${card.label}</div><div class="sv" style="color:${card.color}">${card.value}</div></div>`).join('');

    podiumEl.innerHTML = rows.slice(0, 3).map((row, index) => `
      <div class="king-card rank-${index + 1}">
        <div class="king-rank">${row.rank}위</div>
        <div class="king-name">${escapeHtml(row.proposer || '-')}</div>
        <div class="king-dept">${escapeHtml(row.department || '-')}</div>
        <div class="king-score">${row.score.toLocaleString()}점</div>
        <div class="king-breakdown">A ${row.A} · B ${row.B} · C ${row.C} · 채택 ${row.adopted} · 참가 ${row.joined} · 건의 ${row.suggested}</div>
        <div class="king-meta">
          <div>제안수<b>${(row.count || 0).toLocaleString()}</b></div>
          <div>년도<b>${escapeHtml(row.year || '-')}</b></div>
          <div>기존 순위<b>${row.originalRank ? row.originalRank + '위' : '-'}</b></div>
        </div>
      </div>
    `).join('');
    if (!rows.length) {
      podiumEl.innerHTML = `<div class="king-empty" style="grid-column:1/-1;">조건에 맞는 제안왕 데이터가 없습니다.</div>`;
    }

    bodyEl.innerHTML = `
      <div style="margin-bottom:12px;font-size:12px;color:#6b7280;">점수 기준: <b style="color:#6d28d9;">${KING_FORMULA.subtitle}</b></div>
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
    if (isEmbeddedShareFile()) {
      exportAsHTML();
      showToast('✅ 수정본 공유 파일이 다시 저장되었습니다.');
      return;
    }
    showToast('✅ 안전하게 저장되었습니다.');
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

  function buildStandaloneShareHtml(fileTitle, rows, sharedKingRows) {
      const safeTitle = escapeHtml(fileTitle);
      const dataJson = JSON.stringify(rows);
      const kingJson = JSON.stringify(sharedKingRows || []);
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
    --bg: #eaf2fb;
    --surface: #ffffff;
    --border: #c5d6ee;
    --accent: #2967e3;
    --text: #15243b;
    --text-dim: #5f718d;
    --success: #2563eb;
    --danger: #dc2626;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: linear-gradient(180deg, #edf4fd 0%, #dfeaf8 100%);
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
    background: #eef4fb;
  }
  .share-main {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-width: 0;
    background: #eef4fb;
  }
  .hero {
    padding: 15px 25px;
    background: linear-gradient(180deg, #d7e6fb 0%, #e5effc 100%);
    border-bottom: 1px solid var(--border);
  }
  .hero-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .hero-title {
    font-size: 24px;
    font-weight: 800;
    margin: 0;
  }
  .hero-desc {
    margin: 6px 0 0;
    color: var(--text-dim);
    font-size: 13px;
  }
  .toolbar {
    padding: 12px 25px;
    background: linear-gradient(180deg, #dce9fa 0%, #e7f0fb 100%);
    border-bottom: 1px solid var(--border);
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: center;
  }
  select, input {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #f6faff;
    color: var(--text);
    padding: 10px 14px;
    font-size: 13px;
    outline: none;
  }
  input {
    min-width: 280px;
    flex: 1;
  }
  .table-wrap {
    background: #f6faff;
    border: 1px solid var(--border);
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
  }
  .table-section {
    flex: 1;
    padding: 14px 18px;
    background: #eef4fb;
    min-height: 0;
    padding-bottom: 62px;
  }
  .share-btn {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: linear-gradient(135deg, #2967e3 0%, #1d4fb7 100%);
    color: #fff;
    padding: 11px 16px;
    font-size: 13px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 14px 30px rgba(29, 79, 183, 0.24);
  }
  .share-btn.chart {
    background: linear-gradient(135deg, #4c85f2 0%, #2967e3 100%);
    box-shadow: 0 14px 30px rgba(41, 103, 227, 0.22);
  }
  .share-btn.goal {
    background: linear-gradient(135deg, #dbe8ff 0%, #bfd4fb 100%);
    color: #214a92;
    box-shadow: 0 14px 30px rgba(41, 103, 227, 0.14);
  }
  .king-modal {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.58);
    z-index: 9999;
    padding: 24px;
  }
  .king-modal.open { display: block; }
  .king-shell {
    height: calc(100vh - 48px);
    background: #eef4fb;
    border-radius: 26px;
    overflow: hidden;
    border: 1px solid rgba(217, 223, 235, 0.9);
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
    display: flex;
    flex-direction: column;
  }
  .king-modal-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 22px;
    background: linear-gradient(180deg, #d7e6fb 0%, #e5effc 100%);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .king-modal-copy h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 900;
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
    border-radius: 12px;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-dim);
  }
  .king-modal-body {
    padding: 20px 22px 24px;
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
    border-radius: 12px;
    padding: 10px 12px;
    font-size: 12px;
    color: var(--text);
    outline: none;
  }
  .king-filter-row input { min-width: 220px; flex: 1; }
  .king-stats { margin-bottom: 18px; }
  .king-card, .king-mini {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 16px 18px;
    box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
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
    background: rgba(15, 23, 42, 0.58);
    z-index: 9998;
    padding: 24px;
  }
  .chart-modal.open { display: block; }
  .chart-shell {
    height: calc(100vh - 48px);
    background: #f8fafc;
    border-radius: 26px;
    overflow: hidden;
    border: 1px solid rgba(217, 223, 235, 0.9);
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
    display: flex;
    flex-direction: column;
  }
  .chart-modal-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 22px;
    background: #ffffff;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .chart-modal-copy h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 900;
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
    border-radius: 12px;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-dim);
  }
  .chart-modal-body {
    padding: 18px 22px 24px;
    overflow: auto;
    flex: 1;
  }
  .chart-filter-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .chart-filter-row button {
    padding: 9px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
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
  }
  .chart-note {
    font-size: 12px;
    color: var(--text-dim);
    margin-bottom: 10px;
  }
  .chart-legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }
  .chart-legend-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12px;
    font-weight: 700;
    color: #374151;
  }
  .chart-legend-swatch {
    width: 12px;
    height: 12px;
    border-radius: 2px;
  }
  .chart-canvas {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 10px 18px 12px;
    box-shadow: 0 14px 40px rgba(15, 23, 42, 0.06);
    min-width: 100%;
  }
  #shareGradeChartSvg {
    width: 100%;
    height: 500px;
    display: block;
  }
  .goal-modal {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.58);
    z-index: 9997;
    padding: 24px;
  }
  .goal-modal.open { display: block; }
  .goal-shell {
    height: calc(100vh - 48px);
    background: #f8fafc;
    border-radius: 26px;
    overflow: hidden;
    border: 1px solid rgba(217, 223, 235, 0.9);
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
    display: flex;
    flex-direction: column;
  }
  .goal-head {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px 22px;
    background: #ffffff;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .goal-copy h2 { margin: 0; font-size: 24px; font-weight: 900; }
  .goal-copy p { margin: 5px 0 0; color: var(--text-dim); font-size: 13px; }
  .goal-close {
    margin-left: auto;
    border: 1px solid var(--border);
    background: #fff;
    border-radius: 12px;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-dim);
  }
  .goal-body { padding: 18px 22px 24px; overflow: auto; flex: 1; }
  .goal-filter-row { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:10px; }
  .goal-filter-row select {
    min-width: 160px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: #fff;
    color: var(--text);
    padding: 10px 12px;
    font-size: 13px;
    outline: none;
  }
  .goal-canvas { background: var(--surface); border:1px solid var(--border); border-radius:20px; padding:16px; box-shadow:0 14px 40px rgba(15,23,42,0.06); min-width:100%; }
  .goal-items { display:grid; gap:10px; }
  .goal-item { display:grid; grid-template-columns:160px 1fr 90px; gap:14px; align-items:center; padding:14px 16px; background:#fff; border:1px solid #dde7f3; border-radius:16px; }
  .goal-item.state-good { background:#fbfefc; }
  .goal-item.state-mid { background:#fffdf8; }
  .goal-item.state-low { background:#fffafa; }
  .goal-dept { font-size:16px; line-height:1.2; font-weight:800; color:#162033; }
  .goal-meta { margin-top:4px; color:var(--text-dim); font-size:12px; font-weight:700; }
  .goal-track { position:relative; height:14px; border-radius:999px; background:#edf2f7; overflow:visible; }
  .goal-track::after { content:""; position:absolute; left:var(--goal-pos, 71.43%); top:-6px; bottom:-6px; border-left:2px dashed rgba(220,38,38,0.65); }
  .goal-goal-label { position:absolute; left:var(--goal-pos, 71.43%); top:-24px; transform:translateX(-50%); font-size:10px; font-weight:900; letter-spacing:0.08em; color:#b91c1c; background:#fff; padding:1px 6px; border-radius:999px; border:1px solid #fecaca; }
  .goal-track-fill { position:absolute; inset:0; border-radius:999px; overflow:hidden; }
  .goal-fill { position:absolute; inset:0 auto 0 0; height:14px; border-radius:999px; }
  .goal-fill.good { background:#22c55e; }
  .goal-fill.mid { background:#f59e0b; }
  .goal-fill.low { background:#ef4444; }
  .goal-rate { text-align:right; font-size:28px; line-height:1; font-weight:900; letter-spacing:-0.03em; color:#162033; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  thead th {
    background: #dfeafb;
    font-size: 12px;
    font-weight: 800;
    text-align: left;
    padding: 14px 12px;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  tbody td {
    padding: 12px;
    font-size: 12px;
    border-bottom: 1px solid #dbe5f2;
    vertical-align: top;
    word-break: break-word;
  }
  tbody tr:hover { background: #f3f8ff; }
  .col-no { width: 56px; text-align: center; }
  .col-month { width: 72px; }
  .col-date { width: 110px; }
  .col-dept { width: 110px; }
  .col-proposer { width: 86px; }
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
    padding: 10px 25px;
    background: linear-gradient(180deg, #f3f8ff 0%, #e9f1fb 100%);
    border-top: 1px solid var(--border);
    box-shadow: 0 -10px 24px rgba(15, 23, 42, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
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
  .share-footer .mode { color: var(--accent); }
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
            <div>
              <h1 class="hero-title">${safeTitle}</h1>
              <p class="hero-desc">공유 전용 읽기 페이지입니다. 메인 화면과 비슷한 구성으로 확인하되 수정은 불가합니다.</p>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button id="openKingModalBtn" class="share-btn" style="display:none;">👑 제안왕</button>
              <button id="openChartModalBtn" class="share-btn chart" style="display:none;">📈 통계</button>
              <button id="openGoalModalBtn" class="share-btn goal" style="display:none;">🎯 목표달성률</button>
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
  <div id="chartModalShare" class="chart-modal">
    <div class="chart-shell">
      <div class="chart-modal-head">
        <div class="chart-modal-copy">
          <h2>등급표</h2>
          <p>현재 공유 데이터 기준으로 부서별 등급 건수를 누적해서 보여줍니다.</p>
        </div>
        <button id="closeChartModalBtn" class="chart-close">✕ 닫기</button>
      </div>
      <div class="chart-modal-body">
        <div class="chart-filter-row">
          <button id="shareMonthModeBtn" class="on" type="button">월 통계</button>
          <button id="shareYearModeBtn" type="button">연 통계</button>
          <select id="shareChartPeriod"></select>
          <select id="shareChartGrade"></select>
        </div>
        <div class="chart-note" id="chartNote"></div>
        <div class="chart-legend" id="chartLegend"></div>
        <div style="overflow-x:auto;">
          <div class="chart-canvas" id="chartCanvasWrap"></div>
        </div>
      </div>
    </div>
  </div>
  <div id="goalModalShare" class="goal-modal">
    <div class="goal-shell">
      <div class="goal-head">
        <div class="goal-copy">
          <h2>목표달성률</h2>
          <p>부서별 월 할당량 대비 실제 제안 건수 달성률입니다. 실적이 없어도 모든 부서가 포함됩니다.</p>
        </div>
        <button id="closeGoalModalBtn" class="goal-close">✕ 닫기</button>
      </div>
      <div class="goal-body">
        <div class="goal-filter-row">
          <select id="goalMonthSelect"></select>
        </div>
        <div style="overflow-x:auto;">
          <div class="goal-canvas" id="goalCanvasWrap"></div>
        </div>
      </div>
    </div>
  </div>
<script>
  const allRows = ${dataJson};
  const allKingRows = ${kingJson};
  let activeMonth = '전체';
  let activeGrade = '전체';
  let searchText = '';
  let kingDept = '전체';
  let kingNameSearch = '';
  let shareChartMode = 'month';
  let shareChartPeriod = '전체';
  let shareChartGrade = '전체';
  let shareGoalMonth = '전체';
  const kingFormula = { label: '기본 점수', subtitle: 'A×10 + B×5 + C×3 + 채택×3 + 참가×2 + 건의×1', weights: { A: 10, B: 5, C: 3, adopted: 3, joined: 2, suggested: 1 } };
  const chartGradeOrder = ['채택', '참가', '5S', '건의', 'A', 'B', 'C'];
  const chartGradeColors = { '채택':'#ff2d20', '참가':'#0ea5e9', '5S':'#f97316', '건의':'#4f79b3', 'A':'#fff200', 'B':'#4b97a8', 'C':'#8fd14f' };
  const goalDeptOrder = ['생산1부','생산2부','SEM','연구개발팀','품질관리부','T/S팀','물류관리팀','공무팀','환경관리과','총무과'];
  const goalDeptTargets = { '생산1부':32, '생산2부':5, 'SEM':10, '연구개발팀':11, '품질관리부':16, 'T/S팀':9, '물류관리팀':9, '공무팀':8, '환경관리과':5, '총무과':1 };
  const goalBarColors = ['#ff2d20','#ff3b30','#fbbf24','#9ca3af','#8fd14f','#22c55e','#20b2e6','#2f80ed','#3959a8','#6d28d9'];

  function formatCurrency(value) {
    return (Number(value) || 0).toLocaleString() + '원';
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
    if (s.includes('채택') || s.includes('채핵')) return '채택';
    if (s.includes('건의') || s.includes('견의')) return '건의';
    if (s.includes('참가') || s.includes('참카')) return '참가';
    if (/5\\s*s/i.test(s)) return '5S';
    if (/^a$/i.test(s)) return 'A';
    if (/^b$/i.test(s)) return 'B';
    if (/^c$/i.test(s)) return 'C';
    return s;
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
      const department = String(row.department || '').trim();
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
    const noteEl = document.getElementById('chartNote');
    const legendEl = document.getElementById('chartLegend');
    const canvasEl = document.getElementById('chartCanvasWrap');
    const monthBtn = document.getElementById('shareMonthModeBtn');
    const yearBtn = document.getElementById('shareYearModeBtn');
    if (!periodEl || !gradeEl || !noteEl || !legendEl || !canvasEl || !openBtn) return;
    openBtn.style.display = allRows.length ? 'inline-flex' : 'none';
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
      legendEl.innerHTML = '';
      noteEl.textContent = '등급표를 그릴 데이터가 없습니다.';
      canvasEl.innerHTML = '<div class="empty">등급표를 그릴 데이터가 없습니다.</div>';
      return;
    }
    noteEl.textContent = '현재 공유 데이터 기준으로 ' + (shareChartMode === 'year' ? '연도별' : '월별') + ' 부서 등급 건수를 누적해서 보여줍니다.' + (shareChartGrade !== '전체' ? ' 현재는 ' + shareChartGrade + ' 등급만 집계 중입니다.' : '');
    legendEl.innerHTML = ['C','B','A','건의','5S','참가','채택'].map(grade => '<div class="chart-legend-item"><span class="chart-legend-swatch" style="background:' + chartGradeColors[grade] + ';"></span><span>' + grade + '</span></div>').join('');
    const width = Math.max(1450, rows.length * 150 + 260);
    const height = 512;
    const left = 92;
    const right = 92;
    const top = 54;
    const bottom = 106;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const maxValue = Math.max.apply(null, rows.map(row => row.total).concat([1]));
    const chartMax = Math.max(5, Math.ceil(maxValue / 5) * 5);
    const tickStep = chartMax <= 10 ? 2 : 5;
    const ticks = [];
    for (let value = 0; value <= chartMax; value += tickStep) ticks.push(value);
    const barSlot = plotWidth / rows.length;
    const barWidth = Math.min(72, Math.max(42, barSlot * 0.52));
    const gridLines = ticks.map(value => {
      const y = top + plotHeight - (value / chartMax) * plotHeight;
      return '<line x1="' + left + '" y1="' + y + '" x2="' + (width - right) + '" y2="' + y + '" stroke="#111827" stroke-width="1.4" stroke-dasharray="2 3" />' +
        '<text x="' + (left - 14) + '" y="' + (y + 5) + '" text-anchor="end" font-size="12" fill="#111827">' + (value === 0 ? '0건' : value + '건') + '</text>';
    }).join('');
    const bars = rows.map((row, index) => {
      const x = left + barSlot * index + (barSlot - barWidth) / 2;
      let stacked = 0;
      const segments = chartGradeOrder.map(grade => {
        const value = row[grade] || 0;
        if (!value) return '';
        const segmentHeight = (value / chartMax) * plotHeight;
        const y = top + plotHeight - stacked - segmentHeight;
        stacked += segmentHeight;
        const labelY = y + segmentHeight / 2 + 5;
        return '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + segmentHeight + '" fill="' + chartGradeColors[grade] + '" />' +
          (segmentHeight > 22 ? '<text x="' + (x + barWidth / 2) + '" y="' + labelY + '" text-anchor="middle" font-size="11" font-weight="800" fill="' + (grade === 'A' ? '#111827' : '#ffffff') + '">' + value + '</text>' : '');
      }).join('');
      const labelLines = splitChartLabel(row.department).map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      return segments +
        '<text x="' + (x + barWidth / 2) + '" y="' + (height - 56) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#111827" style="font-family:\\'Noto Sans KR\\',\\'Malgun Gothic\\',sans-serif;">' +
          labelLines.map((line, idx) => '<tspan x="' + (x + barWidth / 2) + '" dy="' + (idx === 0 ? 0 : 14) + '">' + line + '</tspan>').join('') +
        '</text>' +
        '<text x="' + (x + barWidth / 2) + '" y="' + (height - 22) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#6b7280">' + row.total + '건</text>';
    }).join('');
    canvasEl.innerHTML = '<svg id="shareGradeChartSvg" viewBox="0 0 ' + width + ' ' + height + '" preserveAspectRatio="xMidYMid meet" aria-label="부서별 제안건수 등급표">' +
      '<text x="' + (width / 2) + '" y="18" dominant-baseline="hanging" text-anchor="middle" font-size="22" font-weight="900" fill="#111827" style="font-family:\\'Noto Sans KR\\',\\'Malgun Gothic\\',sans-serif;">' + (shareChartMode === 'year' ? '부서별 제안건수 연 등급표' : '부서별 제안건수 월 등급표') + '</text>' +
      '<line x1="' + left + '" y1="' + top + '" x2="' + left + '" y2="' + (top + plotHeight) + '" stroke="#666" stroke-width="1.3" />' +
      '<line x1="' + left + '" y1="' + (top + plotHeight) + '" x2="' + (width - right) + '" y2="' + (top + plotHeight) + '" stroke="#666" stroke-width="1.3" />' +
      gridLines + bars +
      '</svg>';
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
      const dept = String(row.department || '').trim();
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
      const openBtn = document.getElementById('openGoalModalBtn');
      const monthEl = document.getElementById('goalMonthSelect');
    const canvasEl = document.getElementById('goalCanvasWrap');
    if (!openBtn || !monthEl || !canvasEl) return;
    openBtn.style.display = 'inline-flex';
    const months = getGoalMonths();
    if (!months.includes(shareGoalMonth)) shareGoalMonth = '전체';
    monthEl.innerHTML = months.map(m => '<option value="' + m + '"' + (m === shareGoalMonth ? ' selected' : '') + '>' + (m === '전체' ? '전체 월' : m) + '</option>').join('');
    const rows = getGoalRows();
      const sortedRows = rows.slice().sort((a, b) => b.rate - a.rate || b.actual - a.actual || a.department.localeCompare(b.department, 'ko'));
      const escapeHtml = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const getState = (rate) => rate >= 100 ? 'good' : (rate >= 80 ? 'mid' : 'low');
      const visualMax = 140;
      const goalPos = (100 / visualMax) * 100;
      const items = sortedRows.map((row) => {
        const state = getState(row.rate);
        const width = Math.max(0, Math.min((row.rate / visualMax) * 100, 100));
        return '<div class="goal-item state-' + state + '">' +
          '<div><div class="goal-dept">' + escapeHtml(row.department) + '</div><div class="goal-meta">실적 ' + row.actual + ' / 목표 ' + row.target + '</div></div>' +
          '<div class="goal-track" style="--goal-pos:' + goalPos + '%;"><div class="goal-goal-label">GOAL</div><div class="goal-track-fill"><div class="goal-fill ' + state + '" style="width:' + width + '%;"></div></div></div>' +
          '<div class="goal-rate">' + row.rate + '%</div>' +
        '</div>';
      }).join('');
      canvasEl.innerHTML = '<div class="goal-items">' + items + '</div>';
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
      const haystack = [row.month, row.date, row.department, row.proposer, row.title, row.grade, row.reward, row.safety]
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
        '<td class="col-dept">' + (row.department || '') + '</td>' +
        '<td class="col-proposer">' + (row.proposer || '') + '</td>' +
        '<td>' + (row.title || '') + '</td>' +
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
        openBtn.style.display = 'none';
        deptSelect.innerHTML = '<option value="전체">전체 부서</option>';
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
      }
    openBtn.style.display = 'inline-flex';
    empty.style.display = 'none';
    const allRows = getKingRows();
    const departments = ['전체'].concat(Array.from(new Set(allRows.map(row => row.department).filter(Boolean))));
    deptSelect.innerHTML = departments.map(dept => '<option value="' + dept + '"' + (dept === kingDept ? ' selected' : '') + '>' + dept + '</option>').join('');
      const rows = allRows.filter(row => {
        const byDept = kingDept === '전체' || row.department === kingDept;
        const byName = !kingNameSearch || String(row.proposer || '').toLowerCase().includes(kingNameSearch);
        return byDept && byName;
      });
    tbody.innerHTML = rows.map(row =>
      '<tr class="' + (row.rank <= 3 ? 'top3-row rank-' + row.rank : '') + '"' + (kingNameSearch && String(row.proposer || '').toLowerCase().includes(kingNameSearch) ? ' style="background:#f4f8ff;"' : '') + '>' +
        '<td class="rank">' + row.rank + '위</td>' +
        '<td class="score">' + row.score.toLocaleString() + '</td>' +
        '<td>' + (row.department || '') + '</td>' +
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
  renderShareChart();
  renderGoalChart();

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
    shareChartMode = 'month';
    renderShareChart();
  });
  document.getElementById('shareYearModeBtn').addEventListener('click', () => {
    shareChartMode = 'year';
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
  document.getElementById('openGoalModalBtn').addEventListener('click', () => {
    document.getElementById('goalModalShare').classList.add('open');
    renderGoalChart();
  });
  document.getElementById('closeGoalModalBtn').addEventListener('click', () => {
    document.getElementById('goalModalShare').classList.remove('open');
  });
  document.getElementById('goalModalShare').addEventListener('click', (event) => {
    if (event.target.id === 'goalModalShare') {
      document.getElementById('goalModalShare').classList.remove('open');
    }
  });
  document.getElementById('goalMonthSelect').addEventListener('change', (event) => {
    shareGoalMonth = event.target.value || '전체';
    renderGoalChart();
  });
<\/script>
</body>
</html>`;
  }

  async function saveShareSnapshot() {
    const rows = collectGridRows();
    const sharedKingRows = getSortedKingRows().map(({ rank, score, ...row }) => row);
    const rawName = document.getElementById('shareFileName').value.trim() || '개선제안정리_공유';
    const fileBase = rawName.replace(/[\\/:*?"<>|]/g, '_');
    const fileTitle = fileBase;
    const html = buildStandaloneShareHtml(fileTitle, rows, sharedKingRows);
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

  function loadFromLocal() {
    try {
      if (window.__embeddedSnapshot__) {
        applyEmbeddedSnapshot(window.__embeddedSnapshot__);
        return;
      }
      loadAGradeRowsFromLocal();
      loadAGradePdfLinksFromLocal();
      loadAGradeRemoteLinksFromLocal();
      syncAGradeFileButtons();
      const saved = localStorage.getItem('impData');
      if (saved) {
        gridApi.setGridOption('rowData', JSON.parse(saved));
        kingRows = deriveKingRowsFromGrid();
        setTimeout(() => {
          updateStats();
          if (gridApi) {
            gridApi.sizeColumnsToFit();
            setTimeout(() => gridApi && gridApi.sizeColumnsToFit(), 120);
          }
        }, 200);
      }
    } catch(e) {}
  }


  function openPuuiseo() {
    showToast('품의서 기능은 제거되었습니다.', true);
  }

  // 열 정의
  // 엑셀 B~BA 52열 (col index 2~53) 각각의 기본 px
  // ── 드래그 리사이즈 (열/행) ──────────────────────────────
  function initTableResize() {
    const table = document.getElementById('xlsTable');
    if (!table) return;

    const wrapper = table.closest('#puuiseoContent') || table.parentElement;
    wrapper.style.position = 'relative';

    const cols = table.querySelectorAll('col');
    const rows = table.querySelectorAll('tr');

    // getBoundingClientRect 기준으로 wrapper 상대 좌표 계산 (스크롤 포함)
    function getRelRect(el) {
      const wr = wrapper.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      // 실제 스크롤은 puuiseoScrollArea에서 발생
      const sc = document.getElementById('puuiseoScrollArea') || wrapper;
      return {
        top:    er.top    - wr.top    + sc.scrollTop,
        left:   er.left   - wr.left   + sc.scrollLeft,
        right:  er.right  - wr.left   + sc.scrollLeft,
        bottom: er.bottom - wr.top    + sc.scrollTop,
        width:  er.width,
        height: er.height
      };
    }

    // ── 열 핸들: 실제 셀 BoundingRect 기준 ──
    function placeColHandles() {
      wrapper.querySelectorAll('.xls-col-handle').forEach(h => h.remove());

      // 첫 번째 행의 셀들을 기준으로 각 열 경계 파악
      const firstRow = table.querySelector('tr');
      if (!firstRow) return;
      const cells = Array.from(firstRow.querySelectorAll('td, th'));

      // colspan 고려: 실제 열 경계 위치를 셀 right 기준으로 누적
      const tableRel = getRelRect(table);
      let colBoundaries = [];
      let accCols = 0;

      cells.forEach(cell => {
        const span = cell.colSpan || 1;
        accCols += span;
        // 마지막 셀은 핸들 불필요
        if (accCols >= cols.length) return;
        const cellRel = getRelRect(cell);
        colBoundaries.push({ x: cellRel.right, colIdx: accCols - 1 });
      });

      // col 27 이상(0-based index 26~)은 결재란 → 드래그 잠금
      const KEJAIRAN_COL_START = 26;

      colBoundaries.forEach(({ x, colIdx }) => {
        const h = document.createElement('div');
        h.className = 'xls-col-handle';
        h.style.cssText = `position:absolute;top:${tableRel.top}px;left:${x - 2}px;width:4px;height:${tableRel.height}px;cursor:col-resize;z-index:20;background:transparent;`;
        h.addEventListener('mouseenter', () => h.style.background = 'rgba(37,99,235,0.4)');
        h.addEventListener('mouseleave', () => { if (!h._dragging) h.style.background = 'transparent'; });

        h.addEventListener('mousedown', ev => {
          ev.preventDefault();
          h._dragging = true;
          h.style.background = 'rgba(37,99,235,0.6)';
          const startX = ev.clientX;
          const tableW = table.getBoundingClientRect().width;
          const col     = cols[colIdx];
          const nextCol = cols[colIdx + 1];
          const startPct     = parseFloat(col?.style.width)     || (100 / cols.length);
          const nextStartPct = parseFloat(nextCol?.style.width) || (100 / cols.length);

          const onMove = ev2 => {
            const dx   = ev2.clientX - startX;
            const dpct = (dx / tableW) * 100;
            const newPct  = Math.max(0.3, startPct     + dpct);
            if (col) col.style.width = newPct.toFixed(3) + '%';
            if (nextCol) {
              const newNext = Math.max(0.3, nextStartPct - dpct);
              nextCol.style.width = newNext.toFixed(3) + '%';
            }
            // 핸들 위치 실시간 업데이트
            const cellRel2 = getRelRect(cells[cells.findIndex((c, i) => {
              let acc = 0;
              for (let j = 0; j <= i; j++) acc += (cells[j].colSpan || 1);
              return acc - 1 >= colIdx;
            })]);
            h.style.left = (cellRel2.right - 3) + 'px';
          };
          const onUp = () => {
            h._dragging = false;
            h.style.background = 'transparent';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            placeColHandles();
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
        wrapper.appendChild(h);
      });
    }

    // ── 행 핸들: getBoundingClientRect 기준 정확 배치 ──
    function placeAllRowHandles() {
      wrapper.querySelectorAll('.xls-row-handle').forEach(h => h.remove());
      const tableRel = getRelRect(table);

      rows.forEach((row, ri) => {
        if (ri >= rows.length - 1) return;
        const rowRel = getRelRect(row);

        const h = document.createElement('div');
        h.className = 'xls-row-handle';
        h.style.cssText = `position:absolute;left:${tableRel.left}px;top:${rowRel.bottom - 2}px;width:${tableRel.width}px;height:4px;cursor:row-resize;z-index:20;background:transparent;`;

        h.addEventListener('mousedown', ev => {
          ev.preventDefault();
          h._dragging = true;
          h.classList.add('dragging');
          const startY = ev.clientY;
          const startH = row.getBoundingClientRect().height;

          const onMove = ev2 => {
            // 행마다 최소 높이 다르게: 기본 20px, 첫 번째 셀 텍스트 있는 행은 더 크게
            const firstCell = row.querySelector('td');
            const minH = (firstCell && firstCell.textContent.trim()) ? 20 : 20;
            const newH = Math.max(minH, startH + ev2.clientY - startY);
            row.style.height = newH + 'px';
            const rr = getRelRect(row);
            h.style.top = (rr.bottom - 3) + 'px';
          };
          const onUp = () => {
            h._dragging = false;
            h.classList.remove('dragging');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            placeAllRowHandles();
          };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        });
        wrapper.appendChild(h);
      });
    }

    placeAllRowHandles();
    placeColHandles();
  }

    function renderPuuiseo() {
    const susin   = document.getElementById('pe_susin').value;
    const balsin  = document.getElementById('pe_balsin').value;
    const writer  = document.getElementById('pe_writer').value;
    const date    = document.getElementById('pe_date').value;
    const title   = document.getElementById('pe_title').value;
    const reason  = document.getElementById('pe_reason').value;
    const cA      = parseInt(document.getElementById('pe_A').value)||0;
    const cB      = parseInt(document.getElementById('pe_B').value)||0;
    const cC      = parseInt(document.getElementById('pe_C').value)||0;
    const cChaet  = parseInt(document.getElementById('pe_chaetaek').value)||0;
    const cChamga = parseInt(document.getElementById('pe_chamga').value)||0;
    const cGeonui = parseInt(document.getElementById('pe_geonui').value)||0;

    const totalAmt = cA*50000 + cB*20000 + cC*5000 + cChaet*5000 + cChamga*2000;
    const totalCnt = cA+cB+cC+cChaet+cChamga+cGeonui;
    const fmt  = n => n.toLocaleString();
    const fmtW = n => n ? '\u20a9'+n.toLocaleString() : '';

    document.getElementById('puuiseoContent').innerHTML = `<table id="xlsTable" style="border-collapse:collapse;table-layout:fixed;font-family:'맑은 고딕','Malgun Gothic',sans-serif;width:100%;letter-spacing:0.05em;">
<colgroup>
<col id="xlscol_1" style="width:0.418%">
<col id="xlscol_2" style="width:1.771%">
<col id="xlscol_3" style="width:1.771%">
<col id="xlscol_4" style="width:1.771%">
<col id="xlscol_5" style="width:1.771%">
<col id="xlscol_6" style="width:1.771%">
<col id="xlscol_7" style="width:1.771%">
<col id="xlscol_8" style="width:1.771%">
<col id="xlscol_9" style="width:1.771%">
<col id="xlscol_10" style="width:1.771%">
<col id="xlscol_11" style="width:1.771%">
<col id="xlscol_12" style="width:1.771%">
<col id="xlscol_13" style="width:1.771%">
<col id="xlscol_14" style="width:1.771%">
<col id="xlscol_15" style="width:1.771%">
<col id="xlscol_16" style="width:1.771%">
<col id="xlscol_17" style="width:1.771%">
<col id="xlscol_18" style="width:1.771%">
<col id="xlscol_19" style="width:0.627%">
<col id="xlscol_20" style="width:0.418%">
<col id="xlscol_21" style="width:1.771%">
<col id="xlscol_22" style="width:1.771%">
<col id="xlscol_23" style="width:1.771%">
<col id="xlscol_24" style="width:1.771%">
<col id="xlscol_25" style="width:1.771%">
<col id="xlscol_26" style="width:1.771%">
<col id="xlscol_27" style="width:1.771%">
<col id="xlscol_28" style="width:1.771%">
<col id="xlscol_29" style="width:2.2%">
<col id="xlscol_30" style="width:0.448%">
<col id="xlscol_31" style="width:2.2%">
<col id="xlscol_32" style="width:2.2%">
<col id="xlscol_33" style="width:2.2%">
<col id="xlscol_34" style="width:2.2%">
<col id="xlscol_35" style="width:2.2%">
<col id="xlscol_36" style="width:2.2%">
<col id="xlscol_37" style="width:2.2%">
<col id="xlscol_38" style="width:2.2%">
<col id="xlscol_39" style="width:2.2%">
<col id="xlscol_40" style="width:2.2%">
<col id="xlscol_41" style="width:2.2%">
<col id="xlscol_42" style="width:2.2%">
<col id="xlscol_43" style="width:2.2%">
<col id="xlscol_44" style="width:2.2%">
<col id="xlscol_45" style="width:2.2%">
<col id="xlscol_46" style="width:2.2%">
<col id="xlscol_47" style="width:2.2%">
<col id="xlscol_48" style="width:2.002%">
<col id="xlscol_49" style="width:2.002%">
<col id="xlscol_50" style="width:2.002%">
<col id="xlscol_51" style="width:2.002%">
<col id="xlscol_52" style="width:2.002%">
<col id="xlscol_53" style="width:2.002%">
</colgroup>
<tr style="height:13px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
</tr>
<tr style="height:13px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td rowspan="2" colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center"></td>
<td rowspan="2" colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center"></td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
</tr>
<tr style="height:20px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center">(   /   )</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center">(   /   )</td>
</tr>
<tr style="height:23px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td rowspan="4" colspan="23" style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-weight:bold;font-size:45px;text-align:center"><span style="text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:2px;">稟&nbsp;&nbsp;議&nbsp;&nbsp;書</span></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-weight:bold;font-size:45px;text-align:center"></td>
<td rowspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-weight:bold;font-size:14px;text-align:center;white-space:pre-wrap;word-break:break-all"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-right:0.3px solid #000;font-weight:bold;font-size:14px"></td>
<td rowspan="4" colspan="2" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center;white-space:pre-wrap;word-break:break-all">決<br><br>裁</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center">擔當</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center">課長</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center">部長</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center">理事</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center">工場長</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center">社 長</td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-weight:bold;font-size:45px;text-align:center"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-right:0.3px solid #000;font-weight:bold;font-size:14px"></td>
<td rowspan="2" colspan="4" data-kejairan="담당" style="padding:0;overflow:hidden;position:relative;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;cursor:pointer;"><div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;"></div></td>
<td rowspan="2" colspan="4" data-kejairan="과장" style="padding:0;overflow:hidden;position:relative;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;cursor:pointer;"><div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;">이승재</div></td>
<td rowspan="2" colspan="4" data-kejairan="부장" style="padding:0;overflow:hidden;position:relative;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;cursor:pointer;"><div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;"></div></td>
<td rowspan="2" colspan="4" data-kejairan="이사" style="padding:0;overflow:hidden;position:relative;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;cursor:pointer;"><div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;">김연범</div></td>
<td rowspan="2" colspan="4" data-kejairan="공장장" style="padding:0;overflow:hidden;position:relative;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;cursor:pointer;"><div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;">이재철</div></td>
<td rowspan="2" colspan="4" data-kejairan="사장" style="padding:0;overflow:hidden;position:relative;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;cursor:pointer;"><div style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.4;">전자<br>결재</div></td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-weight:bold;font-size:45px;text-align:center"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-right:0.3px solid #000;font-weight:bold;font-size:14px"></td>
</tr>
<tr style="height:17px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-weight:bold;font-size:45px;text-align:center"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-right:0.3px solid #000;font-weight:bold;font-size:14px"></td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center">(   /   )</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center">(   /   )</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center">(   /   )</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center">(   /   )</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center">(   /   )</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center">(   /   )</td>
</tr>
<tr style="height:23px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td id="xls_docno_anchor" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:12px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:14px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-weight:bold;font-size:14px"></td>
<td colspan="26" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px">  협 의 부 서  :                            印</td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px">수　　신</td>
<td colspan="18" id="xls_susin" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">경리부</td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px">작 성 자</td>
<td colspan="18" id="xls_writer" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">이 승 재 과장</td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px">참　　조</td>
<td colspan="18" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px">작 성 일</td>
<td colspan="18" id="xls_date" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"></td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px">발　　신</td>
<td colspan="18" id="xls_balsin" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">ESQ본부</td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px">합 계 금 액</td>
<td colspan="10" id="xls_totalamt" style="text-align:left;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;font-weight:bold;font-size:13px">=AB22</td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"></td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" id="xls_title" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px">   제       목  : 2025년 1월 개선제안 포상금 지급 건</td>
</tr>
<tr style="height:23px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="8" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:12px;text-align:center">품 명</td>
<td colspan="10" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:12px;text-align:center">규 격</td>
<td colspan="3" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:12px;text-align:center;white-space:nowrap">수 량</td>
<td colspan="5" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:12px;text-align:center">단 가</td>
<td colspan="7" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:12px;text-align:center">금 액</td>
<td colspan="4" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:12px;text-align:center;white-space:nowrap">전구입일</td>
<td colspan="4" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:12px;text-align:center;white-space:nowrap">수 량</td>
<td colspan="3" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:12px;text-align:center">단 가</td>
<td colspan="8" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:12px;text-align:center">금 액</td>
</tr>
<tr style="height:33px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td rowspan="7" colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:14px;text-align:center;white-space:pre-wrap;word-break:break-all">개선제안 <br>포상금</td>
<td colspan="10" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">실시(A급) 제안</td>
<td colspan="3" id="xls_cnt_A" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right"></td>
<td colspan="5" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right">50000</td>
<td colspan="7" id="xls_amt_A" style="text-align:right;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">=T16*W16</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="3" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
</tr>
<tr style="height:33px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="10" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">실시(B급) 제안</td>
<td colspan="3" id="xls_cnt_B" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right"></td>
<td colspan="5" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right">20000</td>
<td colspan="7" id="xls_amt_B" style="text-align:right;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">=T17*W17</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="3" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
</tr>
<tr style="height:33px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="10" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">실시(C급) 제안</td>
<td colspan="3" id="xls_cnt_C" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right"></td>
<td colspan="5" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right">5000</td>
<td colspan="7" id="xls_amt_C" style="text-align:right;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">=T18*W18</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="3" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
</tr>
<tr style="height:33px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="10" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">아이디어(채택) 제안</td>
<td colspan="3" id="xls_cnt_chaet" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right"></td>
<td colspan="5" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right">5000</td>
<td colspan="7" id="xls_amt_chaet" style="text-align:right;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">=T19*W19</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="3" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
</tr>
<tr style="height:33px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="10" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">아이디어(참가) 제안</td>
<td colspan="3" id="xls_cnt_chamga" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right"></td>
<td colspan="5" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right">2000</td>
<td colspan="7" id="xls_amt_chamga" style="text-align:right;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">=T20*W20</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="3" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
</tr>
<tr style="height:33px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="10" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">아이디어(건의) 제안</td>
<td colspan="3" id="xls_cnt_geonui" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right"></td>
<td colspan="5" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px;text-align:right">0</td>
<td colspan="7" id="xls_amt_geonui" style="text-align:right;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">=T21*W21</td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="3" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
</tr>
<tr style="height:33px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="10" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px;text-align:center">합계</td>
<td colspan="3" id="xls_total_cnt" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px;text-align:right">=SUM(T16:T21)</td>
<td colspan="5" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px;text-align:center"></td>
<td colspan="7" id="xls_total_amt" style="text-align:right;background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px">=SUM(AB16:AB21)</td>
<td colspan="4" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
<td colspan="4" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="3" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
<td colspan="8" style="background-color:#e8e8e8;padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
</tr>
<tr style="height:33px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="10" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"></td>
<td colspan="3" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px;text-align:center"></td>
<td colspan="5" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-weight:bold;font-size:13px;text-align:center"></td>
<td colspan="7" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"></td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
<td colspan="4" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="3" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px;text-align:center"></td>
<td colspan="8" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:12px"></td>
</tr>
<tr style="height:29px;min-height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:visible;vertical-align:middle;border-bottom:0.3px solid #000;border-left:0.3px solid #000;font-weight:bold;font-size:13px;white-space:nowrap"> 품의사유 :</td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"></td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" id="xls_reason1" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"> 1. 2026년 1월 진행된 개선제안 건에 대한 포상금액을 상기와 같이 품의합니다.</td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"> 2. 개선제안제도(OYS-AP-3050) 활동은 PSM 공정안전관리 이행상태+등급 평가 및 ISO 통합경영시스템</td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">   (품질, 환경, 안전보건, 에너지) 인증 심사 시 근로자 참여+의사소통 및 조직의 지속적 개선 요구조건에 </td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">   관한 중요 활동 근거로 활용되고 있음.</td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"> 3. 1차 2차 개선제안제도 활성화 교육 실시 및 제안금 인상 등을 통해 근로자 참여를 독려하고 있으며,</td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">    인력평가 및 안전관리 모범상 선정 시 중요 지표로 활용 예정</td>
</tr>
<tr style="height:29px;min-height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td style="padding:1px 3px;overflow:visible;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;font-size:13px;white-space:nowrap"> ※ 첨부</td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;font-size:13px"></td>
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"></td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">   (1) 부서/인원별 개선제안 실적표 1부  </td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px">   (2) 부서/인원별 개선제안 등록부 1부  &lt;끝&gt;</td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"></td>
</tr>
<tr style="height:29px;">
<td style="padding:1px 3px;overflow:hidden;vertical-align:middle;font-size:14px"></td>
<td colspan="52" style="padding:1px 3px;overflow:hidden;vertical-align:middle;border-top:0.3px solid #000;border-bottom:0.3px solid #000;border-left:0.3px solid #000;border-right:0.3px solid #000;font-size:13px"></td>
</tr>
</table>`;

    

    const set = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
    set('xls_susin',    susin);
    set('xls_writer',   writer);
    set('xls_date',     date);
    set('xls_balsin',   balsin);
    set('xls_totalamt', fmtW(totalAmt));
    set('xls_title',    '   제       목  : '+title);
    set('xls_cnt_A',      cA||'');
    set('xls_cnt_B',      cB||'');
    set('xls_cnt_C',      cC||'');
    set('xls_cnt_chaet',  cChaet||'');
    set('xls_cnt_chamga', cChamga||'');
    set('xls_cnt_geonui', cGeonui||'');
    set('xls_amt_A',      fmt(cA*50000));
    set('xls_amt_B',      fmt(cB*20000));
    set('xls_amt_C',      fmt(cC*5000));
    set('xls_amt_chaet',  fmt(cChaet*5000));
    set('xls_amt_chamga', fmt(cChamga*2000));
    set('xls_amt_geonui', '0');
    set('xls_total_cnt',  fmt(totalCnt));
    set('xls_total_amt',  fmt(totalAmt));
    set('xls_reason1',    ' 1. '+title+'에 대한 포상금액을 상기와 같이 품의합니다.');

    document.getElementById('puuiseoEditModal').style.display='none';
    document.getElementById('puuiseoModal').style.display='flex';
    setTimeout(()=>{
      initTableResize();
      const content = document.getElementById('puuiseoContent');
      const scrollArea = document.getElementById('puuiseoScrollArea');
      if(content) enableCellEdit(content);
      if (scrollArea) {
        scrollArea._resizeScrollHandler && scrollArea.removeEventListener('scroll', scrollArea._resizeScrollHandler);
        scrollArea._resizeScrollHandler = () => {
          initTableResize(); syncHeaders();
          // 선 편집 중이면 리사이즈 핸들 즉시 재숨기기
          if (borderEditMode) {
            document.querySelectorAll('.xls-col-handle, .xls-row-handle').forEach(function(h){ h.style.display='none'; });
            var tbl2=document.getElementById('xlsTable'); if(tbl2) { removeLineHandles(); createLineHandles(tbl2); }
          }
        };
        scrollArea.addEventListener('scroll', scrollArea._resizeScrollHandler);
      }
      renderExcelHeaders();
      initDocnoBox();
      // 모든 셀 border를 0.2px로 강제 초기화 (localStorage 잔재 제거)
    var _allCells = document.querySelectorAll('#xlsTable td, #xlsTable th');
    _allCells.forEach(function(c) {
      ['Top','Bottom','Left','Right'].forEach(function(d) {
        var v = c.style['border'+d];
        if (v && v !== 'none' && v !== '') {
          c.style['border'+d] = '0.3px solid #000';
        }
      });
    });
    restoreBorderState();
      // restoreBorderState가 셀 텍스트를 덮어쓰므로 수치를 다시 주입
      set('xls_susin',    susin);
      set('xls_writer',   writer);
      set('xls_date',     date);
      set('xls_balsin',   balsin);
      set('xls_totalamt', fmtW(totalAmt));
      set('xls_title',    '   제       목  : '+title);
      set('xls_cnt_A',      cA||'');
      set('xls_cnt_B',      cB||'');
      set('xls_cnt_C',      cC||'');
      set('xls_cnt_chaet',  cChaet||'');
      set('xls_cnt_chamga', cChamga||'');
      set('xls_cnt_geonui', cGeonui||'');
      set('xls_amt_A',      fmt(cA*50000));
      set('xls_amt_B',      fmt(cB*20000));
      set('xls_amt_C',      fmt(cC*5000));
      set('xls_amt_chaet',  fmt(cChaet*5000));
      set('xls_amt_chamga', fmt(cChamga*2000));
      set('xls_amt_geonui', '0');
      set('xls_total_cnt',  fmt(totalCnt));
      set('xls_total_amt',  fmt(totalAmt));
                    set('xls_reason1',    ' 1. '+title+'에 대한 포상금액을 상기와 같이 품의합니다.');
      // 레이아웃 완전히 잡힌 후 한번 더
      setTimeout(initDocnoBox, 200);
    },80);
  }

  // 원본 엑셀 템플릿 Base64
  const _XLSX_TEMPLATE_B64 = "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";

  function exportToExcel() {
    const TEMPLATE_XLSX_PATH = 'C:\\Users\\zxcas\\Desktop\\부서별제안등록부.xlsx';

    // 부서명 정규화 (HTML → 엑셀 형식)
    const deptMap = {
      '생산1부':'a 생산1부','생산 1부':'a 생산1부',
      '생산2부':'b 생산2부','생산 2부':'b 생산2부',
      'S.E.M.':'c SEM','SEM':'c SEM','sem':'c SEM',
      '연구개발팀':'d 연구개발팀',
      '품질관리부':'e 품질관리부',
      'T/S팀':'f T/S팀','ts팀':'f T/S팀',
      '물류관리팀':'g 물류관리팀',
      '공무팀':'h 공무팀',
      '환경관리과':'i 환경관리과',
      '총무과':'j 총무과'
    };
    function normDept(d) {
      if (!d) return d;
      const s = String(d).trim();
      for (const [k, v] of Object.entries(deptMap)) {
        if (s === k || s.toLowerCase() === k.toLowerCase()) return v;
      }
      return s;
    }

    const runExport = async () => {
      setLoading(true, '엑셀 저장 중...', '지정한 제출현황 파일에 현재 화면 데이터를 추가하는 중입니다.');
      try {
        let wb;
        if (window.desktopApp && window.desktopApp.isElectron && window.desktopApp.readBinaryFile && window.desktopApp.writeBinaryFile) {
          const readResult = await window.desktopApp.readBinaryFile(TEMPLATE_XLSX_PATH);
          if (!readResult || !readResult.data) throw new Error('템플릿 엑셀 파일을 읽지 못했습니다. 경로 확인: ' + TEMPLATE_XLSX_PATH);
          const binStr = atob(readResult.data);
          const bytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
          wb = XLSX.read(bytes, { type: 'array', cellStyles: true, cellFormulas: true });
        } else {
          const binStr = atob(_XLSX_TEMPLATE_B64);
          const bytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
          wb = XLSX.read(bytes, { type: 'array', cellStyles: true, cellFormulas: true });
        }

        // 시트명 유연하게 탐색
        const targetSheetName = wb.SheetNames.find(n => n.replace(/\s/g,'').includes('부서별제안등록부') || n.replace(/\s/g,'').includes('제안등록부')) || wb.SheetNames[0];
        const ws = wb.Sheets[targetSheetName];
        if (!ws) { throw new Error('대상 시트를 찾을 수 없습니다. 시트 목록: ' + wb.SheetNames.join(', ')); }

        let lastRow = 4;
        for (let r = 5; r <= 5000; r++) {
          if (ws['B' + r] && ws['B' + r].v !== undefined && ws['B' + r].v !== '') lastRow = r;
          else if (r > lastRow + 2) break;
        }

        const rows = [];
        gridApi.forEachNodeAfterFilterAndSort(node => rows.push(node.data));
        if (!rows.length) {
          showToast('추가할 데이터가 없습니다.', true);
          return;
        }

        rows.forEach((d, idx) => {
          const r = lastRow + 1 + idx;
          const no = lastRow - 4 + 1 + idx;

          // 윗 행 스타일 복사 (양식 유지)
          const copyStyle = (col) => {
            const prev = ws[col + (r - 1)];
            return (prev && prev.s) ? { s: JSON.parse(JSON.stringify(prev.s)) } : {};
          };

          const setCellVal = (col, val) => {
            const addr = col + r;
            ws[addr] = copyStyle(col);
            ws[addr].v = val;
            ws[addr].t = typeof val === 'number' ? 'n' : 's';
          };

          setCellVal('B', no);
          setCellVal('C', d.month || '');
          setCellVal('D', d.date || '');
          setCellVal('E', normDept(d.department));
          setCellVal('F', d.proposer || '');
          setCellVal('G', d.title || '');
          ws['H' + r] = { ...copyStyle('H'), f: 'IF(OR(I'+r+'="채택",I'+r+'="참가",I'+r+'="건의"),"아이디어","실시")', t: 'f' };
          setCellVal('I', d.grade || '');
          ws['J' + r] = { ...copyStyle('J'), f: 'IF(I'+r+'="채택",5000,IF(I'+r+'="참가",2000,IF(I'+r+'="건의",0,IF(I'+r+'="A",50000,IF(I'+r+'="B",20000,IF(I'+r+'="C",5000,""))))))', t: 'f' };
          setCellVal('K', d.safety || '');
        });

        const endRow = lastRow + rows.length;
        const ref = ws['!ref'] || 'A1:K5';
        const refEnd = ref.split(':')[1];
        const refEndRow = parseInt(refEnd.replace(/[A-Z]/g, '')) || 5;
        if (endRow > refEndRow) {
          ws['!ref'] = ref.replace(/:\w+\d+$/, ':K' + endRow);
        }

        const fname = '개선제안_제출현황_' + new Date().toISOString().slice(0,10) + '.xlsx';
        if (window.desktopApp && window.desktopApp.isElectron && window.desktopApp.writeBinaryFile) {
          const savePath = TEMPLATE_XLSX_PATH.replace('부서별제안등록부.xlsx', fname);
          const outArray = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
          let binary = '';
          const bytes = new Uint8Array(outArray);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          await window.desktopApp.writeBinaryFile({ filePath: savePath, base64 });
          showToast('✅ 엑셀 저장 완료! (' + rows.length + '건) → ' + fname);
          return;
        }

        XLSX.writeFile(wb, fname);
        showToast('✅ 엑셀 저장 완료! (' + rows.length + '건 추가)');
      } catch (err) {
        console.error(err);
        showToast('❌ 엑셀 저장 실패: ' + err.message, true);
      } finally {
        setLoading(false);
      }
    };

    runExport();
  }

  function setLoading(active, text, sub) {
    document.getElementById('loadingText').textContent = text || '';
    document.getElementById('loadingSub').textContent = sub || '';
    document.getElementById('loading').classList.toggle('active', active);
  }

  function showToast(m, isError) {
    const el = document.getElementById('toast');
    el.textContent = m;
    el.className = 'show' + (isError ? ' error' : '');
    setTimeout(() => el.className = '', 3000);
  }

  function deleteSelected() {
    const selected = gridApi.getSelectedRows();
    if (selected.length > 0) {
      if (!confirm(selected.length + '건을 삭제하시겠습니까?')) return;
      gridApi.applyTransaction({ remove: selected });
    } else {
      const filtered = [];
      gridApi.forEachNodeAfterFilterAndSort(n => filtered.push(n.data));
      if (filtered.length === 0) return;
      const month = activeMonthFilter;
      const label = month === '전체' ? '전체' : '[' + month + ']';
      if (!confirm(label + ' ' + filtered.length + '건을 삭제하시겠습니까?')) return;
      gridApi.applyTransaction({ remove: filtered });
    }
    updateStats();
  }

// 미리보기 모달 상단 슬라이더 초기화
function initPreviewSliders() {
  const wrap = document.getElementById('previewSliders');
  if (!wrap || typeof COL_GROUPS==='undefined') return;
  wrap.innerHTML = '';
  COL_GROUPS.forEach(grp => {
    let rows = '';
    grp.cols.forEach(col => {
      const saved = parseInt(localStorage.getItem('xlscol_'+col.id)) || col.def;
      rows += `
        <div style="display:grid;grid-template-columns:24px 1fr 30px;align-items:center;gap:4px;">
          <span style="color:#94a3b8;font-size:10px;">${col.label}</span>
          <input type="range" min="1" max="200" value="${saved}"
            oninput="onPreviewSlider('${col.id}', this.value)"
            style="accent-color:#2563eb;cursor:pointer;height:12px;" />
          <span id="prev_${col.id}_val" style="color:#e2e8f0;font-size:10px;text-align:right;">${saved}</span>
        </div>`;
    });
    wrap.innerHTML += `
      <div style="background:#f0f2f7;border:1px solid #dde1ea;border-radius:5px;padding:6px 8px;">
        <div style="color:#60a5fa;font-size:10px;font-weight:700;margin-bottom:4px;">${grp.label}</div>
        <div style="display:grid;gap:3px;">${rows}</div>
      </div>`;
  });
  updatePreviewTotal();
}

function onPreviewSlider(id, val) {
  const mainSlider = document.getElementById(id);
  if (mainSlider) mainSlider.value = val;
  const previewVal = document.getElementById('prev_'+id+'_val');
  if (previewVal) previewVal.textContent = val;
  const mainVal = document.getElementById(id+'_val');
  if (mainVal) mainVal.textContent = val;
  localStorage.setItem('xlscol_'+id, val);
  updatePreviewTotal();
  
}

function updatePreviewTotal() {
  const el = document.getElementById('previewColTotal');
  if (!el || typeof COL_GROUPS==='undefined') return;
  let total = 0;
  COL_GROUPS.forEach(grp => grp.cols.forEach(col => {
    total += parseInt(localStorage.getItem('xlscol_'+col.id)) || col.def;
  }));
  el.textContent = '합계: '+total+'px';
  el.style.color = '#4ade80';
}

function resetColWidths() {
  ;
}
function resetColWidthsAll() {
  if(typeof COL_GROUPS==='undefined') return;
  COL_GROUPS.forEach(grp => grp.cols.forEach(col => {
    localStorage.setItem('xlscol_'+col.id, col.def);
    const sl = document.getElementById(col.id);
    if(sl) sl.value = col.def;
    const vl = document.getElementById(col.id+'_val');
    if(vl) vl.textContent = col.def;
  }));
  if(typeof updateColTotal==='function') updateColTotal();
  if(typeof applyColWidthsToXlsTable==='function') applyColWidthsToXlsTable();
  if(typeof initPreviewSliders==='function') initPreviewSliders();
}

// 엑셀 템플릿 base64
const PUUISEO_TEMPLATE_B64 = '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';

function copyPuuiseoToClipboard() {
  const fp = document.getElementById('pe_filepath');
  const data = {
    filepath: fp ? fp.value.trim() : '',
    susin:   document.getElementById('pe_susin').value,
    balsin:  document.getElementById('pe_balsin').value,
    writer:  document.getElementById('pe_writer').value,
    date:    document.getElementById('pe_date').value,
    title:   document.getElementById('pe_title').value,
    reason:  document.getElementById('pe_reason').value,
    cA:      parseInt(document.getElementById('pe_A').value)||0,
    cB:      parseInt(document.getElementById('pe_B').value)||0,
    cC:      parseInt(document.getElementById('pe_C').value)||0,
    cChaet:  parseInt(document.getElementById('pe_chaetaek').value)||0,
    cChamga: parseInt(document.getElementById('pe_chamga').value)||0,
    cGeonui: parseInt(document.getElementById('pe_geonui').value)||0,
  };
  navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
    alert('✅ 클립보드에 복사됐어요!\n이제 품의서_자동입력.py 파일을 더블클릭하세요.');
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = JSON.stringify(data);
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    alert('✅ 클립보드에 복사됐어요!\n이제 품의서_자동입력.py 파일을 더블클릭하세요.');
  });
}


function savePuuiseoExcel() {
  const susin   = document.getElementById('pe_susin').value;
  const balsin  = document.getElementById('pe_balsin').value;
  const writer  = document.getElementById('pe_writer').value;
  const date    = document.getElementById('pe_date').value;
  const title   = document.getElementById('pe_title').value;
  const reason  = document.getElementById('pe_reason').value;
  const cA      = parseInt(document.getElementById('pe_A').value)||0;
  const cB      = parseInt(document.getElementById('pe_B').value)||0;
  const cC      = parseInt(document.getElementById('pe_C').value)||0;
  const cChaet  = parseInt(document.getElementById('pe_chaetaek').value)||0;
  const cChamga = parseInt(document.getElementById('pe_chamga').value)||0;
  const cGeonui = parseInt(document.getElementById('pe_geonui').value)||0;

  // base64 -> ArrayBuffer
  const bin = atob(PUUISEO_TEMPLATE_B64);
  const buf = new Uint8Array(bin.length);
  for (let i=0; i<bin.length; i++) buf[i] = bin.charCodeAt(i);

  const wb = XLSX.read(buf, {type:'array', cellStyles:true, cellFormulas:true});
  const ws = wb.Sheets[wb.SheetNames[0]];

  const sc = (cell, val) => {
    if (!ws[cell]) ws[cell] = {};
    ws[cell].v = val;
    ws[cell].t = typeof val==='number' ? 'n' : 's';
    delete ws[cell].f; // 수식 제거하고 값으로
  };

  // 데이터 채우기
  sc('J11', susin);
  sc('AJ11', writer);
  sc('AJ12', date);
  sc('J13', balsin);
  sc('B14', '   제       목  : ' + title);

  // 수량
  sc('T16', cA);
  sc('T17', cB);
  sc('T18', cC);
  sc('T19', cChaet);
  sc('T20', cChamga);
  sc('T21', cGeonui);

  // 금액 (수식 대신 계산값)
  sc('AB16', cA*50000);
  sc('AB17', cB*20000);
  sc('AB18', cC*5000);
  sc('AB19', cChaet*5000);
  sc('AB20', cChamga*2000);
  sc('AB21', 0);

  // 우측 금액
  sc('AT16', cA*50000);
  sc('AT17', cB*20000);
  sc('AT18', cC*5000);
  sc('AT19', cChaet*5000);
  sc('AT20', cChamga*2000);
  sc('AT21', 0);

  // 합계
  const totalCnt = cA+cB+cC+cChaet+cChamga+cGeonui;
  const totalAmt = cA*50000+cB*20000+cC*5000+cChaet*5000+cChamga*2000;
  sc('T22', totalCnt);
  sc('AB22', totalAmt);
  sc('AT22', totalAmt);
  sc('AJ13', totalAmt);

  // 품의사유
  sc('B25', ' 1. ' + title + '에 대한 포상금액을 상기와 같이 품의합니다.');
  if (reason) sc('B26', ' 2. ' + reason);

  // 파일명: 제목 기반
  const fname = (title||'품의서').replace(/[\\/:*?"<>|]/g,'_') + '.xlsx';
  XLSX.writeFile(wb, fname);
}


// ── 테두리 편집 모드 (선 클릭 방식) ─────────────────────────
var borderEditMode = false;

function toggleBorderMode() {
  borderEditMode = !borderEditMode;
  var btn = document.getElementById('borderModeBtn');
  var saveBtn = document.getElementById('borderSaveBtn');
  var tbl = document.getElementById('xlsTable');
  if (!tbl) return;

  if (borderEditMode) {
    btn.style.background = '#dc2626';
    btn.textContent = '✏️ 선 편집 ON';
    if (saveBtn) saveBtn.style.display = '';
    showBorderToast('🟠 주황=점선  🔵 파랑=실선  — 선을 클릭하면 점선↔실선으로 전환됩니다.');
    // 행/열 리사이즈 핸들 숨기기
    document.querySelectorAll('.xls-col-handle, .xls-row-handle').forEach(function(h){ h.style.display='none'; });
    // 열/행 헤더 클릭 비활성화
    var colBar = document.getElementById('colHeaderBar');
    var rowPanel = document.getElementById('rowHeaderPanel');
    if (colBar) colBar.style.pointerEvents = 'none';
    if (rowPanel) rowPanel.style.pointerEvents = 'none';
    createLineHandles(tbl);
  } else {
    btn.style.background = '#7c3aed';
    btn.textContent = '✏️ 선 편집';
    if (saveBtn) saveBtn.style.display = 'none';
    removeLineHandles();
    // 행/열 리사이즈 핸들 복원
    document.querySelectorAll('.xls-col-handle, .xls-row-handle').forEach(function(h){ h.style.display=''; });
    var colBar = document.getElementById('colHeaderBar');
    var rowPanel = document.getElementById('rowHeaderPanel');
    if (colBar) colBar.style.pointerEvents = '';
    if (rowPanel) rowPanel.style.pointerEvents = '';
  }
}

// ── 품의서 전체 상태 저장 (선 + 셀 텍스트) ──────────────────
function savePuuiseoState(showMsg) {
  var tbl = document.getElementById('xlsTable');
  if (!tbl) return;
  var cells = Array.from(tbl.querySelectorAll('td, th'));
  var data = cells.map(function(cell, i) {
    return {
      i: i,
      bT: cell.style.borderTop    || '',
      bB: cell.style.borderBottom || '',
      bL: cell.style.borderLeft   || '',
      bR: cell.style.borderRight  || '',
      txt: (!cell.querySelector('span, div, table, br, input'))
             ? (cell.innerHTML || '')
             : (cell.innerText || '')
    };
  });
  try {
    localStorage.setItem('puuiseoFullState', JSON.stringify(data));
    if (showMsg) showBorderToast('✅ 저장되었습니다. (선 + 텍스트)');
  } catch(e) {
    if (showMsg) showBorderToast('❌ 저장 실패: ' + e.message);
  }
}

// 선 저장 버튼용 래퍼
function saveBorderState() { savePuuiseoState(true); }

// 저장된 전체 상태 복원

// ── 기본값(하드코딩) ─────────────────────────────────────────
var DEFAULT_FULL_STATE = [{"i": 0, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 1, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 2, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 3, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 4, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 5, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 6, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 7, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 8, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 9, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 10, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 11, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 12, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 13, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 14, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 15, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 16, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 17, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 18, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 19, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 20, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 21, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 22, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 23, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 24, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 25, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 26, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 27, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 28, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 29, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 30, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 31, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 32, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 33, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 34, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 35, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 36, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 37, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 38, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 39, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 40, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 41, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 42, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 43, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 44, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 45, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 46, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 47, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 48, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 49, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 50, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 51, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 52, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 53, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 54, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 55, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 56, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 57, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 58, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 59, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 60, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 61, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 62, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 63, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 64, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 65, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 66, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 67, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 68, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 69, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 70, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 71, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 72, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 73, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 74, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 75, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 76, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 77, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 78, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 79, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 80, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 81, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 82, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 83, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 84, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 85, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 86, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 87, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 88, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 89, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 90, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 91, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 92, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 93, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 94, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 95, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 96, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 97, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 98, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 99, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 100, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 101, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 102, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 103, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 104, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 105, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 106, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 107, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 108, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 109, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 110, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 111, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 112, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 113, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 114, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 115, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 116, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 117, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 118, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 119, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 120, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 121, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 122, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 123, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 124, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 125, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 126, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 127, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 128, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 129, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 130, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 131, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 132, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 133, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 134, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 135, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 136, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 137, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 138, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 139, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 140, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 141, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 142, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 143, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 144, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 145, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 146, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 147, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 148, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 149, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 150, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 151, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 152, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 153, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 154, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 155, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 156, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 157, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 158, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 159, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 160, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 161, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 162, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 163, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 164, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 165, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 166, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 167, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 168, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 169, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 170, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 171, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 172, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 173, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 174, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 175, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 176, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 177, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 178, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 179, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 180, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 181, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 182, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 183, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 184, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 185, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 186, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 187, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 188, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 189, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 190, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 191, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 192, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 193, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 194, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 195, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 196, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 197, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 198, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 199, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 200, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 201, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 202, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 203, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 204, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 205, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 206, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 207, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 208, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 209, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 210, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 211, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 212, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 213, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 214, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 215, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 216, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 217, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 218, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 219, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 220, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 221, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 222, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 223, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 224, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 225, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 226, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 227, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 228, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 229, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 230, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 231, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 232, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 233, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 234, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 235, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 236, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 237, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 238, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 239, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 240, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 241, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 242, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 243, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "( / )"}, {"i": 244, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "( / )"}, {"i": 245, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 246, "bT": "", "bB": "", "bL": "", "bR": "", "txt": "稟 議 書"}, {"i": 247, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 248, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 249, "bT": "", "bB": "", "bL": "", "bR": "0.3px solid #000", "txt": ""}, {"i": 250, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "決\n\n裁"}, {"i": 251, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "擔當"}, {"i": 252, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "課長"}, {"i": 253, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "部長"}, {"i": 254, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "理事"}, {"i": 255, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "工場長"}, {"i": 256, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "社 長"}, {"i": 257, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 258, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 259, "bT": "", "bB": "", "bL": "", "bR": "0.3px solid #000", "txt": ""}, {"i": 260, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 261, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "이승재"}, {"i": 262, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 263, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "김연범"}, {"i": 264, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "이재철"}, {"i": 265, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "전자\n결재"}, {"i": 266, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 267, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 268, "bT": "", "bB": "", "bL": "", "bR": "0.3px solid #000", "txt": ""}, {"i": 269, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 270, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 271, "bT": "", "bB": "", "bL": "", "bR": "0.3px solid #000", "txt": ""}, {"i": 272, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "( / )"}, {"i": 273, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "( / )"}, {"i": 274, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "( / )"}, {"i": 275, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "( / )"}, {"i": 276, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "( / )"}, {"i": 277, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "( / )"}, {"i": 278, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 279, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 280, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 281, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 282, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 283, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 284, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 285, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 286, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 287, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 288, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 289, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 290, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 291, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 292, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 293, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 294, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 295, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 296, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 297, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 298, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 299, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 300, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 301, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 302, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 303, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 304, "bT": "", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 305, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "협 의 부 서  :                            印"}, {"i": 306, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 307, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "수　　신"}, {"i": 308, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "경리부"}, {"i": 309, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "작 성 자"}, {"i": 310, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 311, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 312, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "참　　조"}, {"i": 313, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 314, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "작 성 일"}, {"i": 315, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "2026년 3월 12일"}, {"i": 316, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 317, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "발　　신"}, {"i": 318, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "ESQ본부"}, {"i": 319, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "합 계 금 액"}, {"i": 320, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "", "txt": "₩675,000"}, {"i": 321, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 322, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 323, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 324, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 325, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 326, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 327, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "", "bR": "", "txt": ""}, {"i": 328, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "", "bR": "0.3px solid #000", "txt": ""}, {"i": 329, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 330, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "제 목 : 전체 개선제안 포상금 지급 건"}, {"i": 331, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 332, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "품 명"}, {"i": 333, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "규 격"}, {"i": 334, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "수 량"}, {"i": 335, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "단 가"}, {"i": 336, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "금 액"}, {"i": 337, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "전구입일"}, {"i": 338, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "수 량"}, {"i": 339, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "단 가"}, {"i": 340, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "금 액"}, {"i": 341, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 342, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "개선제안 \n포상금"}, {"i": 343, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "실시(A급) 제안"}, {"i": 344, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 345, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "50000"}, {"i": 346, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "0"}, {"i": 347, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "25.02.02"}, {"i": 348, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "45"}, {"i": 349, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "-"}, {"i": 350, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 351, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 352, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "실시(B급) 제안"}, {"i": 353, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "6"}, {"i": 354, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "20000"}, {"i": 355, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "120,000"}, {"i": 356, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 357, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 358, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 359, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "₩120,000"}, {"i": 360, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 361, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "실시(C급) 제안"}, {"i": 362, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "97"}, {"i": 363, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "5000"}, {"i": 364, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "485,000"}, {"i": 365, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 366, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 367, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 368, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "₩485,000"}, {"i": 369, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 370, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "아이디어(채택) 제안"}, {"i": 371, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "14"}, {"i": 372, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "5000"}, {"i": 373, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "70,000"}, {"i": 374, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 375, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 376, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 377, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "₩70,000"}, {"i": 378, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 379, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "아이디어(참가) 제안"}, {"i": 380, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 381, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "2000"}, {"i": 382, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "0"}, {"i": 383, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 384, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 385, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 386, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 387, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 388, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "아이디어(건의) 제안"}, {"i": 389, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "5"}, {"i": 390, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "0"}, {"i": 391, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "0"}, {"i": 392, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 393, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 394, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 395, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 396, "bT": "", "bB": "", "bL": "", "bR": "", "txt": ""}, {"i": 397, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "합계"}, {"i": 398, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "122"}, {"i": 399, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 400, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "675,000"}, {"i": 401, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 402, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 403, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": ""}, {"i": 404, "bT": "0.3px solid #000", "bB": "0.3px solid #000", "bL": "0.3px solid #000", "bR": "0.3px solid #000", "txt": "₩675,000"}];
var DEFAULT_COL_WIDTHS = {"xlscol_xc40": "1", "xlscol_xc4": "1", "xlscol_xc12": "1", "xlscol_xc15": "1", "xlscol_xc52": "1", "xlscol_xc27": "1", "xlscol_xc30": "1", "xlscol_xc3": "1", "xlscol_xc8": "1", "xlscol_xc9": "1", "xlscol_xc32": "1", "xlscol_xc45": "1", "xlscol_xc20": "1", "xlscol_xc47": "1", "xlscol_xc49": "1", "xlscol_xc14": "1", "xlscol_xc10": "1", "xlscol_xc53": "2", "xlscol_xc29": "1", "xlscol_xc17": "1", "xlscol_xc26": "1", "xlscol_xc21": "1", "xlscol_xc46": "1", "xlscol_xc37": "1", "xlscol_xc43": "1", "xlscol_xc44": "1", "xlscol_xc7": "1", "xlscol_xc41": "1", "xlscol_xc34": "2", "xlscol_xc5": "1", "xlscol_xc51": "1", "xlscol_xc11": "1", "xlscol_xc50": "1", "xlscol_xc39": "1", "xlscol_xc48": "1", "xlscol_xc31": "1", "xlscol_xc16": "1", "xlscol_xc42": "1", "xlscol_xc6": "1", "xlscol_xc33": "1", "xlscol_xc2": "1", "xlscol_xc35": "1", "xlscol_xc18": "1", "xlscol_xc19": "2", "xlscol_xc38": "1", "xlscol_xc13": "1", "xlscol_xc23": "1", "xlscol_xc28": "1", "xlscol_xc36": "1", "xlscol_xc24": "1", "xlscol_xc25": "1", "xlscol_xc22": "1"};
var DEFAULT_ROW_HEIGHTS = [{"i": 0, "h": "13px"}, {"i": 1, "h": "13px"}, {"i": 2, "h": "29px"}, {"i": 3, "h": "29px"}, {"i": 4, "h": "20px"}, {"i": 5, "h": "23px"}, {"i": 6, "h": "29px"}, {"i": 7, "h": "29px"}, {"i": 8, "h": "17px"}, {"i": 9, "h": "23px"}, {"i": 10, "h": "29px"}, {"i": 11, "h": "29px"}, {"i": 12, "h": "29px"}, {"i": 13, "h": "29px"}, {"i": 14, "h": "23px"}, {"i": 15, "h": "33px"}, {"i": 16, "h": "33px"}, {"i": 17, "h": "33px"}, {"i": 18, "h": "33px"}, {"i": 19, "h": "33px"}, {"i": 20, "h": "33px"}, {"i": 21, "h": "33px"}, {"i": 22, "h": "33px"}, {"i": 23, "h": "29px"}, {"i": 24, "h": "29px"}, {"i": 25, "h": "29px"}, {"i": 26, "h": "29px"}, {"i": 27, "h": "29px"}, {"i": 28, "h": "29px"}, {"i": 29, "h": "29px"}, {"i": 30, "h": "29px"}, {"i": 31, "h": "29px"}, {"i": 32, "h": "29px"}, {"i": 33, "h": "29px"}, {"i": 34, "h": "29px"}];

function restoreBorderState() {
  // localStorage 완전 초기화
  try { localStorage.removeItem('puuiseoFullState'); } catch(e){}
  var tbl = document.getElementById('xlsTable');
  if (!tbl) return;
  try {
    localStorage.removeItem('puuiseoFullState');
    var data = DEFAULT_FULL_STATE;
    if (!data) return;
    var cells = Array.from(tbl.querySelectorAll('td, th'));
    // data-thick 전부 초기화 (이전 토글 상태 리셋)
    cells.forEach(function(c) {
      c.removeAttribute('data-thick-top');
      c.removeAttribute('data-thick-bottom');
      c.removeAttribute('data-thick-left');
      c.removeAttribute('data-thick-right');
    });
    data.forEach(function(d) {
      var cell = cells[d.i];
      if (!cell) return;
      // border값 무조건 0.2px로 강제 (저장된 값 무시)
      if (d.bT) cell.style.borderTop    = '0.3px solid #000';
      if (d.bB) cell.style.borderBottom = '0.3px solid #000';
      if (d.bL) cell.style.borderLeft   = '0.3px solid #000';
      if (d.bR) cell.style.borderRight  = '0.3px solid #000';
      // 고정 라벨 셀은 텍스트 복원 제외 (HTML에 직접 하드코딩된 셀)
      var FIXED_LABEL_IDX = [305, 307, 309, 312, 314, 317, 319];
      if (FIXED_LABEL_IDX.indexOf(d.i) === -1) {
        if (d.txt !== undefined && d.txt !== '' && !cell.querySelector('input')) {
          if (!cell.querySelector('span, div, table, br')) {
            // innerHTML로 저장됐으므로 innerHTML로 복원 (공백 보존)
            if (cell.innerHTML !== d.txt) {
              cell.innerHTML = d.txt;
            }
          }
        }
      }
    });
    // 고정 라벨 셀 텍스트 강제 적용 (localStorage 값 무시)
    var FIXED_LABELS = {
      305: '협 의 부 서  :                            印',
      307: '수　　신',
      309: '작 성 자',
      312: '참　　조',
      314: '작 성 일',
      317: '발　　신',
      319: '합 계 금 액'
    };
    // 가운데 정렬할 셀 (협의부서 305 제외)
    var CENTER_IDX = [307, 309, 312, 314, 317, 319];
    Object.keys(FIXED_LABELS).forEach(function(idx) {
      var cell = cells[parseInt(idx)];
      if (cell) {
        cell.innerHTML = FIXED_LABELS[idx];
        if (CENTER_IDX.indexOf(parseInt(idx)) !== -1) {
          cell.style.textAlign = 'center';
        }
      }
    });

    // 행 높이 복원
    var rows = Array.from(tbl.querySelectorAll('tr'));
    DEFAULT_ROW_HEIGHTS.forEach(function(r) {
      if (rows[r.i]) rows[r.i].style.height = r.h;
    });
    // 열 너비 복원 (localStorage 우선, 없으면 기본값)
    Object.keys(DEFAULT_COL_WIDTHS).forEach(function(id) {
      var saved = localStorage.getItem(id);
      if (!saved) localStorage.setItem(id, DEFAULT_COL_WIDTHS[id]);
    });
  } catch(e) { console.error('restoreBorderState error:', e); }
}

// ── 선 클릭 핸들 생성 ──────────────────────────────────────
function createLineHandles(tbl) {
  removeLineHandles();
  var content = document.getElementById('puuiseoContent');
  if (!content) return;
  content.style.position = 'relative';

  var THICKNESS = 8; // 클릭 가능 두께(px)

  var cells = Array.from(tbl.querySelectorAll('td, th'));
  var contentRect = content.getBoundingClientRect();
  var scrollArea  = document.getElementById('puuiseoScrollArea');
  var stX = scrollArea ? scrollArea.scrollLeft : 0;
  var stY = scrollArea ? scrollArea.scrollTop  : 0;

  // 이미 추가된 핸들 중복 방지를 위해 세그먼트 키 집합 사용
  var placed = new Set();

  cells.forEach(function(cell) {
    var cr = cell.getBoundingClientRect();
    var left   = cr.left   - contentRect.left + stX;
    var top    = cr.top    - contentRect.top  + stY;
    var right  = cr.right  - contentRect.left + stX;
    var bottom = cr.bottom - contentRect.top  + stY;
    var w = cr.width, h = cr.height;

    // cell의 border 값을 inline style 우선, 없으면 computedStyle 에서 읽기
    function getCellBorder(c, dir) {
      // data-thick-{dir} 속성 우선 (computedStyle은 px 반올림해서 못 믿음)
      var thick = c.getAttribute('data-thick-' + dir.toLowerCase());
      if (thick) return thick === '0.5' ? '1px solid #000' : '0.3px solid #000';
      var v = c.style['border' + dir] || '';
      if (!v || v === 'none' || v === '') {
        // border inline style 없으면 선 있다고 간주 (HTML에 border 있는 셀)
        var cs = window.getComputedStyle(c);
        var dl = dir.toLowerCase();
        var bw = parseFloat(cs.getPropertyValue('border-' + dl + '-width') || '0');
        var bs = cs.getPropertyValue('border-' + dl + '-style');
        if (bs && bs !== 'none' && bw > 0) {
          v = '0.3px solid #000'; // 기본 얇은선으로 간주
        }
      }
      return v || '';
    }
    function hasBorderDir(dir) {
      // inline style에 border가 명시된 경우 우선 체크
      var inlineVal = cell.style['border' + dir] || '';
      if (inlineVal && inlineVal !== 'none' && inlineVal !== '') return true;
      // computedStyle로 인접셀 공유선 체크
      var cs = window.getComputedStyle(cell);
      var dl = dir.toLowerCase();
      var bw = parseFloat(cs.getPropertyValue('border-' + dl + '-width') || '0');
      var bs = cs.getPropertyValue('border-' + dl + '-style');
      return bw > 0 && bs !== 'none';
    }

    // 방향별 핸들 생성
    var borders = [
      { dir: 'Top',    key: top.toFixed(1)+'_'+left.toFixed(1)+'_'+right.toFixed(1)+'_H',
        css: `left:${left}px;top:${top - THICKNESS/2}px;width:${w}px;height:${THICKNESS}px;cursor:row-resize;` },
      { dir: 'Bottom', key: bottom.toFixed(1)+'_'+left.toFixed(1)+'_'+right.toFixed(1)+'_H',
        css: `left:${left}px;top:${bottom - THICKNESS/2}px;width:${w}px;height:${THICKNESS}px;cursor:row-resize;` },
      { dir: 'Left',   key: left.toFixed(1)+'_'+top.toFixed(1)+'_'+bottom.toFixed(1)+'_V',
        css: `left:${left - THICKNESS/2}px;top:${top}px;width:${THICKNESS}px;height:${h}px;cursor:col-resize;` },
      { dir: 'Right',  key: right.toFixed(1)+'_'+top.toFixed(1)+'_'+bottom.toFixed(1)+'_V',
        css: `left:${right - THICKNESS/2}px;top:${top}px;width:${THICKNESS}px;height:${h}px;cursor:col-resize;` },
    ];

    borders.forEach(function(b) {
      if (!hasBorderDir(b.dir)) return;
      if (placed.has(b.key)) return;
      placed.add(b.key);

      // 클로저 문제 방지: 변수 즉시 캡처
      (function(capturedCell, capturedDir, capturedCss) {
        // 굵은선=#000(불투명), 얇은선=rgba(0,0,0,0.25)
        // 굵은선 판단: 정확히 '0.3px'로 시작하는지 체크
        function isThickBorder(cell, dir) {
          var v = cell.style['border' + dir] || '';
          return /^0\.3px/.test(v);
        }
        var isThick = isThickBorder(capturedCell, capturedDir);
        var baseColor = isThick ? 'rgba(59,130,246,0.5)' : 'rgba(251,146,60,0.4)';

        var handle = document.createElement('div');
        handle.className = '_borderLineHandle';
        handle.style.cssText = 'position:absolute;z-index:200;transition:background 0.12s;' + capturedCss;
        handle.style.background = baseColor;
        handle.title = isThick ? '굵은선 → 클릭하면 얇게' : '얇은선 → 클릭하면 굵게';

        handle.addEventListener('mouseenter', function() {
          handle.style.background = isThickBorder(capturedCell, capturedDir) ? 'rgba(59,130,246,0.9)' : 'rgba(251,146,60,0.9)';
        });
        handle.addEventListener('mouseleave', function() {
          handle.style.background = isThickBorder(capturedCell, capturedDir) ? 'rgba(59,130,246,0.5)' : 'rgba(251,146,60,0.4)';
        });

        handle.addEventListener('click', function(e) {
          e.stopPropagation();
          var cur = capturedCell.style['border' + capturedDir] || '';
          var nowThick = isThickBorder(capturedCell, capturedDir);
          var newVal = nowThick ? '0.1px solid #000' : '0.3px solid #000';
          capturedCell.style['border' + capturedDir] = newVal;

          // 인접 셀의 반대쪽 border도 같이 바꿔줌 (colspan/rowspan 결재란 대응)
          var oppositeDir = { Top:'Bottom', Bottom:'Top', Left:'Right', Right:'Left' }[capturedDir];
          var allCells = Array.from(tbl.querySelectorAll('td, th'));
          var capturedRect = capturedCell.getBoundingClientRect();
          allCells.forEach(function(neighbor) {
            if (neighbor === capturedCell) return;
            var nr = neighbor.getBoundingClientRect();
            var isAdjacent = false;
            if (capturedDir === 'Top'    && Math.abs(nr.bottom - capturedRect.top)   < 2 && nr.left < capturedRect.right - 1 && nr.right > capturedRect.left + 1) isAdjacent = true;
            if (capturedDir === 'Bottom' && Math.abs(nr.top    - capturedRect.bottom) < 2 && nr.left < capturedRect.right - 1 && nr.right > capturedRect.left + 1) isAdjacent = true;
            if (capturedDir === 'Left'   && Math.abs(nr.right  - capturedRect.left)  < 2 && nr.top  < capturedRect.bottom - 1 && nr.bottom > capturedRect.top + 1) isAdjacent = true;
            if (capturedDir === 'Right'  && Math.abs(nr.left   - capturedRect.right) < 2 && nr.top  < capturedRect.bottom - 1 && nr.bottom > capturedRect.top + 1) isAdjacent = true;
            if (isAdjacent) neighbor.style['border' + oppositeDir] = newVal;
          });

          capturedCell.style.outline = '2px solid #a78bfa';
          setTimeout(function(){ capturedCell.style.outline = ''; }, 200);
          setTimeout(function() {
            if (borderEditMode) { removeLineHandles(); createLineHandles(tbl); }
          }, 60);
        });

        content.appendChild(handle);
      })(cell, b.dir, b.css);
    });
  });
}

function removeLineHandles() {
  document.querySelectorAll('._borderLineHandle').forEach(function(h){ h.remove(); });
}

// 선 토글: 현재 style 값이 0.5px면 굵은선→0.2px, 아니면 얇은선→0.5px
function applyLineBorderToggle(tbl, lineKey, dir, refCell) {
  var cur = refCell.style['border' + dir] || '';
  var isThick = (cur.indexOf('0.5px') !== -1); // 현재 굵은선이면 true
  var next = isThick ? '0.3px solid #000' : '1px solid #000';
  refCell.style['border' + dir] = next;

  // 피드백 플래시
  refCell.style.outline = '2px solid #a78bfa';
  setTimeout(function(){ refCell.style.outline = ''; }, 250);
}

function showBorderToast(msg) {
  var t = document.getElementById('_borderToast');
  if (t) t.remove();
  t = document.createElement('div');
  t.id = '_borderToast';
  t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e2330;border:1px solid #7c3aed;border-radius:10px;padding:10px 20px;color:white;font-size:13px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.5);pointer-events:none;';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(function(){ if(t.parentNode) t.remove(); }, 5000);
}

function printPuuiseo() {
  const content = document.getElementById('puuiseoContent');
  if (!content) { alert('품의서를 먼저 열어주세요.'); return; }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page { size:A4 portrait; margin:0; }
* { box-sizing:border-box; }
html, body {
  margin:0; padding:0;
  width:210mm; height:297mm;
  overflow:hidden;
  font-family:'Malgun Gothic','맑은 고딕',sans-serif;
  background:white; color:#000;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
#puuiseoContent {
  transform-origin: top left;
}
table { border-collapse:collapse; }
td, th { overflow:hidden; }
</style>
<style>#king-podium { display: none !important; }</style></head>
<body>
${content.outerHTML}
<script>window.onload = function(){
  var el = document.getElementById('puuiseoContent') || document.body.firstElementChild;
  if (!el) { window.print(); return; }

  // 96dpi 기준 A4: 794px x 1123px
  var A4W = 794, A4H = 1123;
  var elW = el.scrollWidth  || el.offsetWidth;
  var elH = el.scrollHeight || el.offsetHeight;
  var scale = Math.min(A4W / elW, A4H / elH);

  el.style.transform = 'scale(' + scale + ')';
  el.style.transformOrigin = 'top left';
  document.body.style.width  = A4W + 'px';
  document.body.style.height = A4H + 'px';
  document.body.style.overflow = 'hidden';

  setTimeout(function(){ window.print(); }, 400);
}<\/script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    alert('팝업이 차단되었습니다.\n주소창 오른쪽 팝업 허용을 클릭해주세요.');
  }
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ── 품의서 실시간 편집 모드 ──
var editModeOn = false;

function toggleEditMode() {
  editModeOn = !editModeOn;
  var content = document.getElementById('puuiseoContent');
  var btn = document.getElementById('editModeBtn');
  if (editModeOn) {
    content.classList.add('edit-mode');
    btn.style.background = '#dc2626';
    btn.textContent = '🔒 편집 OFF';
    enableCellEdit(content);
    enableResizeHandles(content);
  } else {
    content.classList.remove('edit-mode');
    btn.style.background = '#2563eb';
    btn.textContent = '✏️ 편집 ON';
    disableResizeHandles(content);
  }
}

function enableCellEdit(root) {
  if (root._cellEditEnabled) return;
  root._cellEditEnabled = true;
  root.addEventListener('click', function(e) {
    if (e.target.classList.contains('xls-col-handle') || e.target.classList.contains('xls-row-handle')) return;
    if (e.target.getAttribute('contenteditable') === 'true') return;
    var cell = e.target.closest('td, th');
    if (!cell) return;
    if (cell.getAttribute('contenteditable') === 'true') return;
    var orig = cell.innerHTML;
    var origBg = cell.style.backgroundColor;
    cell.setAttribute('contenteditable', 'true');
    cell.style.outline = '2px solid #2563eb';
    cell.style.backgroundColor = '#ffffff';
    cell.style.color = '#000000';
    cell.style.whiteSpace = 'pre';
    cell.focus();
    try {
      var range = document.createRange();
      var sel = window.getSelection();
      range.selectNodeContents(cell);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch(err) {}
    function finishEdit() {
      cell.removeAttribute('contenteditable');
      cell.style.outline = '';
      cell.style.backgroundColor = origBg;
      cell.style.color = '';
      savePuuiseoState(false);
    }
    cell.addEventListener('blur', finishEdit, {once: true});
    cell.addEventListener('keydown', function onKey(ev) {
      if (ev.key === 'Escape') {
        cell.removeEventListener('blur', finishEdit);
        cell.removeEventListener('keydown', onKey);
        cell.innerHTML = orig;
        cell.removeAttribute('contenteditable');
        cell.style.outline = '';
        cell.style.backgroundColor = origBg;
        cell.style.color = '';
      }
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); cell.blur(); }
    });
    e.stopPropagation();
  });
}

function onCellClick(e) {
  // enableCellEdit의 contenteditable 방식으로 통합 처리됨
}



// ── 결재란 이름 셀 클릭 편집 기능 ──────────────────────────────
(function initKejairanEdit() {
  function setupKejairanEdit() {
    var cells = document.querySelectorAll('[data-kejairan]');
    cells.forEach(function(cell) {
      cell.addEventListener('click', function(e) {
        if (cell.getAttribute('contenteditable') === 'true') return;
        var key = cell.getAttribute('data-kejairan');
        // 현재 텍스트 (br 태그 → 줄바꿈 변환)
        var currentText = cell.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
        var modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
        var box = document.createElement('div');
        box.style.cssText = 'background:#1e2330;border:1px solid #4f8ef7;border-radius:12px;padding:24px;min-width:280px;color:#e8eaf0;font-family:\'Noto Sans KR\',sans-serif;';
        box.innerHTML = '<div style="font-size:14px;font-weight:700;margin-bottom:12px;color:#4f8ef7">결재란 편집 — ' + key + '</div>' +
          '<textarea id="kejairanInput" style="width:100%;height:80px;background:#111;border:1px solid #3d4a6a;border-radius:6px;color:#e2e8f0;font-size:13px;padding:8px;resize:none;outline:none;box-sizing:border-box;">' + currentText + '</textarea>' +
          '<div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;">' +
          '<button id="kejairanCancel" style="padding:6px 16px;background:#374151;border:none;border-radius:6px;color:#9ca3af;cursor:pointer;font-size:13px;">취소</button>' +
          '<button id="kejairanSave" style="padding:6px 16px;background:#2563eb;border:none;border-radius:6px;color:white;cursor:pointer;font-size:13px;font-weight:700;">저장</button>' +
          '</div>';
        modal.appendChild(box);
        document.body.appendChild(modal);
        var inp = document.getElementById('kejairanInput');
        inp.focus();
        inp.select();
        document.getElementById('kejairanSave').addEventListener('click', function() {
          var newText = inp.value.replace(/\n/g, '<br>');
          cell.innerHTML = newText;
          // localStorage에 결재란 상태 별도 저장
          saveKejairanState();
          document.body.removeChild(modal);
        });
        document.getElementById('kejairanCancel').addEventListener('click', function() {
          document.body.removeChild(modal);
        });
        modal.addEventListener('click', function(ev) {
          if (ev.target === modal) document.body.removeChild(modal);
        });
        e.stopPropagation();
      });
    });
  }

  function saveKejairanState() {
    var cells = document.querySelectorAll('[data-kejairan]');
    var state = {};
    cells.forEach(function(cell) {
      state[cell.getAttribute('data-kejairan')] = cell.innerHTML;
    });
    try { localStorage.setItem('kejairanState', JSON.stringify(state)); } catch(e) {}
  }

  function loadKejairanState() {
    try {
      var saved = localStorage.getItem('kejairanState');
      if (!saved) return;
      var state = JSON.parse(saved);
      var cells = document.querySelectorAll('[data-kejairan]');
      cells.forEach(function(cell) {
        var key = cell.getAttribute('data-kejairan');
        if (state[key] !== undefined) cell.innerHTML = state[key];
      });
    } catch(e) {}
  }

  // DOM 준비 후 실행
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setupKejairanEdit(); loadKejairanState(); });
  } else {
    setTimeout(function() { setupKejairanEdit(); loadKejairanState(); }, 300);
  }
})();

function enableResizeHandles(root) {
  // 행 높이 핸들
  root.querySelectorAll('tr').forEach(function(tr) {
    if (tr.querySelector('.row-handle')) return;
    var firstCell = tr.querySelector('td,th');
    if (!firstCell) return;
    var handle = document.createElement('div');
    handle.className = 'row-handle';
    handle.title = '드래그: 행 높이 조절';
    firstCell.style.position = 'relative';
    firstCell.appendChild(handle);
    var startY, startH;
    handle.addEventListener('mousedown', function(e) {
      e.preventDefault(); e.stopPropagation();
      startY = e.clientY; startH = tr.offsetHeight;
      handle.classList.add('dragging');
      function move(e2) { tr.style.height = Math.max(10, startH + e2.clientY - startY) + 'px'; }
      function up() { handle.classList.remove('dragging'); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  });

  // 열 너비 핸들
  root.querySelectorAll('table').forEach(function(table) {
    var cols = Array.from(table.querySelectorAll('col'));
    if (!cols.length) return;
    var firstRow = table.querySelector('thead tr, tbody tr');
    if (!firstRow) return;
    var cells = Array.from(firstRow.querySelectorAll('td,th'));
    cells.forEach(function(cell, i) {
      if (i >= cols.length - 1) return;
      if (cell.querySelector('.col-handle')) return;
      var handle = document.createElement('div');
      handle.className = 'col-handle';
      handle.title = '드래그: 열 너비 조절';
      cell.style.position = 'relative';
      cell.style.overflow = 'visible';
      cell.appendChild(handle);
      var startX, w1, w2;
      handle.addEventListener('mousedown', function(e) {
        e.preventDefault(); e.stopPropagation();
        startX = e.clientX;
        var tw = table.offsetWidth;
        w1 = parseFloat(cols[i].style.width) || (cell.offsetWidth / tw * 100);
        w2 = parseFloat(cols[i+1].style.width) || ((cells[i+1] ? cells[i+1].offsetWidth : 50) / tw * 100);
        handle.classList.add('dragging');
        function move(e2) {
          var dx = (e2.clientX - startX) / table.offsetWidth * 100;
          cols[i].style.width = Math.max(1, w1 + dx) + '%';
          cols[i+1].style.width = Math.max(1, w2 - dx) + '%';
        }
        function up() { handle.classList.remove('dragging'); document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); }
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      });
    });
  });
}

function disableResizeHandles(root) {
  if (!root) return;
  root.querySelectorAll('.row-handle, .col-handle').forEach(function(h) { h.remove(); });
}
var _headerSizeTarget = null; // { type:'col'|'row', index:N }

// ── 문서번호 독립 플로팅 박스 ──────────────────────────────
function initDocnoBox() {
  const anchor     = document.getElementById('xls_docno_anchor');
  const content    = document.getElementById('puuiseoContent');
  const scrollArea = document.getElementById('puuiseoScrollArea');
  if (!anchor || !content) return;

  // 기존 박스 제거 (텍스트 보존)
  const old = document.getElementById('docnoFloatBox');
  let savedText = '문 서 번 호\n:  ESQ-26';
  let savedW = null, savedH = null;
  if (old) {
    const oldText = old.querySelector('[contenteditable]');
    if (oldText) savedText = oldText.textContent;
    savedW = old.offsetWidth;
    savedH = old.offsetHeight;
    old.remove();
  }

  // content 기준 좌표 (scrollArea 스크롤 포함)
  const cr = content.getBoundingClientRect();
  const ar = anchor.getBoundingClientRect();
  const scrollTop  = scrollArea ? scrollArea.scrollTop  : 0;
  const scrollLeft = scrollArea ? scrollArea.scrollLeft : 0;

  const initLeft   = ar.left - cr.left + scrollLeft;
  const initTop    = ar.top  - cr.top  + scrollTop;
  const initWidth  = savedW || Math.max(ar.width * 6, 160);
  const initHeight = savedH || Math.max(ar.height * 2, 36);

  const box = document.createElement('div');
  box.id = 'docnoFloatBox';
  box.style.cssText = `
    position:absolute;
    left:${initLeft}px;
    top:${initTop}px;
    width:${initWidth}px;
    min-height:${initHeight}px;
    background:white;
    border:none;
    padding:2px 4px;
    box-sizing:border-box;
    font-family:'맑은 고딕','Malgun Gothic',sans-serif;
    font-size:12px;
    font-weight:bold;
    color:#000;
    z-index:30;
    cursor:default;
    user-select:none;
    overflow:hidden;
  `;

  // 텍스트 영역 (편집 가능)
  const textEl = document.createElement('div');
  textEl.contentEditable = 'true';
  textEl.style.cssText = 'outline:none;cursor:text;white-space:pre-wrap;word-break:break-all;user-select:text;min-height:100%;';
  textEl.textContent = savedText;
  box.appendChild(textEl);

  // 오른쪽 리사이즈 핸들
  const rHandle = document.createElement('div');
  rHandle.style.cssText = 'position:absolute;right:0;top:0;width:6px;height:100%;cursor:ew-resize;z-index:2;';
  rHandle.title = '좌우 크기 조절';
  box.appendChild(rHandle);

  // 아래쪽 리사이즈 핸들
  const bHandle = document.createElement('div');
  bHandle.style.cssText = 'position:absolute;bottom:0;left:0;width:100%;height:6px;cursor:ns-resize;z-index:2;';
  bHandle.title = '상하 크기 조절';
  box.appendChild(bHandle);

  // 이동 핸들 (박스 상단 드래그)
  const mHandle = document.createElement('div');
  mHandle.style.cssText = 'position:absolute;top:0;left:0;width:calc(100% - 6px);height:10px;cursor:move;z-index:3;';
  mHandle.title = '드래그해서 이동';
  box.appendChild(mHandle);

  content.appendChild(box);

  // ── 이동 드래그 ──
  mHandle.addEventListener('mousedown', e => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startL = parseInt(box.style.left), startT = parseInt(box.style.top);
    const onMove = e2 => {
      box.style.left = (startL + e2.clientX - startX) + 'px';
      box.style.top  = (startT + e2.clientY - startY) + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ── 오른쪽 리사이즈 ──
  rHandle.addEventListener('mousedown', e => {
    e.preventDefault();
    const startX = e.clientX, startW = box.offsetWidth;
    const onMove = e2 => {
      box.style.width = Math.max(80, startW + e2.clientX - startX) + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // ── 아래쪽 리사이즈 ──
  bHandle.addEventListener('mousedown', e => {
    e.preventDefault();
    const startY = e.clientY, startH = box.offsetHeight;
    const onMove = e2 => {
      box.style.minHeight = Math.max(20, startH + e2.clientY - startY) + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // 호버 시 테두리 강조
  box.addEventListener('mouseenter', () => { box.style.outline = '2px solid #2563eb'; });
  box.addEventListener('mouseleave', () => { box.style.outline = 'none'; });
}

// ══════════════════════════════════════════════
// 시상금 조회 모달
// ══════════════════════════════════════════════
const RV_MONTHS = ["12월","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월"];
const RV_GRADES = ['A','B','C','채택','건의','참가','단순','중복'];
const RV_GRADE_REWARD = { 'A':50000,'B':20000,'C':5000,'채택':5000,'건의':0,'참가':2000,'단순':0,'중복':0 };
const RV_GRADE_COLOR = { 'A':'#f5c842','B':'#b0bec5','C':'#cd7f32','채택':'#38d9a9','건의':'#4f8ef7','참가':'#8890a4' };
let rvMonth = '전체';

function openRewardViewer() {
  rvRender();
  document.getElementById('rvModal').style.display = 'block';
}

function rvAllRows() {
  const rows = [];
  gridApi.forEachNode(n => { if (n.data) rows.push(n.data); });
  return rows;
}

function rvFiltered(all) {
  if (rvMonth === '전체') return all;
  return all.filter(r => String(r.month||'').trim() === rvMonth);
}

function rvRender() {
  const all = rvAllRows();
  const months = ['전체', ...RV_MONTHS.filter(m => all.some(r => String(r.month||'').trim() === m))];
  if (!months.includes(rvMonth)) rvMonth = '전체';
  const rows = rvFiltered(all);

  // ── 탭
  document.getElementById('rv-tabs').innerHTML = months.map(m => {
    const cnt = m === '전체' ? all.length : all.filter(r => String(r.month||'').trim() === m).length;
    return `<button class="rv-tab ${m===rvMonth?'on':''}" onclick="rvSetMonth('${m}')">
      ${m}<span class="tc">${cnt}</span>
    </button>`;
  }).join('');

  // ── 요약 카드
  const totalReward = rows.reduce((s,r)=>s+(Number(r.reward)||0),0);
  const totalPeople = rows.filter(r=>(Number(r.reward)||0)>0).length;
  const totalSafety = rows.filter(r=>r.safety==='○').length;
  document.getElementById('rv-sum').innerHTML = [
    {l:'총 건수',   v:rows.length+'건',              c:'#4f8ef7'},
    {l:'총 시상금', v:totalReward.toLocaleString()+'원', c:'#111827'},
    {l:'시상 인원', v:totalPeople+'명',               c:'#38d9a9'},
    {l:'안전 제안', v:totalSafety+'건',               c:'#ff6b6b'},
  ].map(c=>`<div class="rv-sc"><div class="sl">${c.l}</div><div class="sv" style="color:${c.c}">${c.v}</div></div>`).join('');

  // ── 테이블 데이터 조립
  // 등급별로 어떤 것이 실제로 있는지 파악
  const activeGrades = RV_GRADES.filter(g => rows.some(r => r.grade === g));
  if (activeGrades.length === 0) activeGrades.push('C','채택','건의','참가');

  // 부서명 정규화 (별칭 → 대표명)
  const DEPT_ALIAS = { '분산QC': '품질관리부', '에스이엠': 'SEM', 'S.E.M.': 'SEM' };
  function normDept(d) {
    const compact = String(d || '').replace(/[.\s]/g, '').toLowerCase();
    if (compact === '분산qc') return '품질관리부';
    if (compact === 'sem' || compact === '에스이엠') return 'SEM';
    return DEPT_ALIAS[d] || d;
  }

  // 부서별 → 제안자별 집계
  const deptMap = {};
  rows.forEach(r => {
    const dept = normDept(r.department || '(부서없음)');
    const proposer = r.proposer || '-';
    if (!deptMap[dept]) deptMap[dept] = {};
    if (!deptMap[dept][proposer]) deptMap[dept][proposer] = {};
    const g = r.grade || '-';
    if (!deptMap[dept][proposer][g]) deptMap[dept][proposer][g] = { cnt:0, reward:0 };
    deptMap[dept][proposer][g].cnt++;
    deptMap[dept][proposer][g].reward += Number(r.reward)||0;
  });

  // 부서 정렬: 시상금 합계 내림차순
  const deptList = Object.keys(deptMap).sort((a,b)=>{
    const sa = Object.values(deptMap[a]).reduce((s,pg)=>s+Object.values(pg).reduce((s2,v)=>s2+v.reward,0),0);
    const sb = Object.values(deptMap[b]).reduce((s,pg)=>s+Object.values(pg).reduce((s2,v)=>s2+v.reward,0),0);
    return sb-sa;
  });

  // ── 헤더 생성
  const gradeHeaders = activeGrades.map(g =>
    `<th colspan="2" style="color:${RV_GRADE_COLOR[g]||'#8890a4'}">${g}</th>`
  ).join('');
  const gradeSubHeaders = activeGrades.map(() =>
    `<th>건수</th><th>시상금</th>`
  ).join('');

  // ── 행 생성
  let bodyRows = '';
  let grandTotal = { cnt:0, reward:0 };
  let grandByGrade = {};

  deptList.forEach(dept => {
    const proposers = Object.keys(deptMap[dept]);
    let deptTotal = { cnt:0, reward:0, byGrade:{} };

    proposers.forEach((proposer, pi) => {
      const data = deptMap[dept][proposer];
      let rowCnt = 0, rowReward = 0;
      const cells = activeGrades.map(g => {
        const v = data[g] || {cnt:0,reward:0};
        rowCnt += v.cnt; rowReward += v.reward;
        deptTotal.cnt += v.cnt; deptTotal.reward += v.reward;
        if (!deptTotal.byGrade[g]) deptTotal.byGrade[g] = {cnt:0,reward:0};
        deptTotal.byGrade[g].cnt += v.cnt;
        deptTotal.byGrade[g].reward += v.reward;
        if (!grandByGrade[g]) grandByGrade[g] = {cnt:0,reward:0};
        grandByGrade[g].cnt += v.cnt;
        grandByGrade[g].reward += v.reward;
        return `<td class="${v.cnt?'':'zero'}">${v.cnt||''}</td>
                <td class="money ${v.reward?'':'zero'}">${v.reward?v.reward.toLocaleString():''}</td>`;
      }).join('');

      const deptCell = pi === 0
        ? `<td class="lft dept-cell" rowspan="${proposers.length}" style="font-weight:700;color:#111827;">${dept}</td>`
        : '';

      bodyRows += `<tr>
        ${deptCell}
        <td class="lft">${proposer}</td>
        ${cells}
        <td style="font-weight:700;text-align:center;">${rowCnt}</td>
        <td class="money" style="font-weight:700;">${rowReward?rowReward.toLocaleString():''}</td>
      </tr>`;
    });

    grandTotal.cnt += deptTotal.cnt;
    grandTotal.reward += deptTotal.reward;

    // 부서 합계 행
    const deptGradeCells = activeGrades.map(g => {
      const v = deptTotal.byGrade[g] || {cnt:0,reward:0};
      return `<td class="${v.cnt?'':'zero'}" style="font-weight:700;">${v.cnt||''}</td>
              <td class="money ${v.reward?'':'zero'}" style="font-weight:700;">${v.reward?v.reward.toLocaleString():''}</td>`;
    }).join('');
    bodyRows += `<tr class="dept-total">
      <td class="lft dept-cell" colspan="2" style="color:#4f8ef7;letter-spacing:0.5px;">합계</td>
      ${deptGradeCells}
      <td style="font-weight:900;text-align:center;color:#4f8ef7;">${deptTotal.cnt}</td>
      <td class="money" style="font-weight:900;color:#111827;">${deptTotal.reward?deptTotal.reward.toLocaleString():''}</td>
    </tr>`;
  });

  // 총합계 행
  const grandGradeCells = activeGrades.map(g => {
    const v = grandByGrade[g] || {cnt:0,reward:0};
    return `<td>${v.cnt||''}</td><td class="money">${v.reward?v.reward.toLocaleString():''}</td>`;
  }).join('');
  bodyRows += `<tr class="grand-total">
    <td class="lft" colspan="2">총합계</td>
    ${grandGradeCells}
    <td style="text-align:center;">${grandTotal.cnt}</td>
    <td class="money">${grandTotal.reward.toLocaleString()}</td>
  </tr>`;

  // 컬럼 너비
  const gradeColsWidth = activeGrades.map(() => `<col style="width:45px"><col style="width:75px">`).join('');

  document.getElementById('rv-body').innerHTML = `
    <div style="overflow-x:auto;">
      <table class="rv-table">
        <colgroup>
          <col style="width:120px">
          <col style="width:80px">
          ${gradeColsWidth}
          <col style="width:55px">
          <col style="width:85px">
        </colgroup>
        <thead>
          <tr>
            <th class="lft" rowspan="2">부서명</th>
            <th class="lft" rowspan="2">제안자</th>
            ${gradeHeaders}
            <th rowspan="2">제안건수<br>합계</th>
            <th rowspan="2">시상금<br>합계</th>
          </tr>
          <tr>${gradeSubHeaders}</tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
}

function rvSetMonth(m) {
  rvMonth = m;
  rvRender();
}
// ══════════════════════════════════════════════

function colLabel(n) {
  // 0-based → A, B, ..., Z, AA, AB, ...
  let s = '';
  n++;
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

function renderExcelHeaders() {
  const table    = document.getElementById('xlsTable');
  const colInner = document.getElementById('colHeaderInner');
  const rowInner = document.getElementById('rowHeaderInner');
  if (!table || !colInner || !rowInner) return;

  const cols = Array.from(table.querySelectorAll('col'));
  const rows = Array.from(table.querySelectorAll('tr'));

  // ── 열 헤더: 각 col의 실제 px 너비 기준 flex ──
  colInner.innerHTML = '';
  colInner.style.cssText = 'display:flex;';
  const tableW = table.getBoundingClientRect().width;

  cols.forEach((col, ci) => {
    const pct = parseFloat(col.style.width) || 0;
    const w   = Math.round(tableW * pct / 100);
    const lbl = colLabel(ci);
    const div = document.createElement('div');
    div.style.cssText = `width:${w}px;min-width:${w}px;height:22px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#6b7280;cursor:pointer;border-right:1px solid #dde1ea;box-sizing:border-box;user-select:none;flex-shrink:0;`;
    div.textContent = lbl;
    div.title = `${lbl}열 너비 조절`;
    div.addEventListener('mouseenter', () => div.style.background = 'rgba(79,142,247,0.25)');
    div.addEventListener('mouseleave', () => div.style.background = '');
    div.addEventListener('click', e => openHeaderPopup(e, 'col', ci, w, `${lbl}열 너비 (px)`));
    colInner.appendChild(div);
  });

  // ── 행 헤더: 각 tr의 실제 px 높이 기준 ──
  rowInner.innerHTML = '';
  rowInner.style.cssText = 'display:flex;flex-direction:column;';

  rows.forEach((row, ri) => {
    const h = Math.round(row.getBoundingClientRect().height);
    const div = document.createElement('div');
    div.style.cssText = `width:36px;height:${h}px;min-height:${h}px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#6b7280;cursor:pointer;border-bottom:1px solid #dde1ea;box-sizing:border-box;user-select:none;flex-shrink:0;`;
    div.textContent = ri + 1;
    div.title = `${ri+1}행 높이 조절`;
    div.addEventListener('mouseenter', () => div.style.background = 'rgba(79,142,247,0.25)');
    div.addEventListener('mouseleave', () => div.style.background = '');
    div.addEventListener('click', e => openHeaderPopup(e, 'row', ri, h, `${ri+1}행 높이 (px)`));
    rowInner.appendChild(div);
  });
}

function syncHeaders() { renderExcelHeaders(); }

function openHeaderPopup(e, type, index, currentPx, label) {
  e.stopPropagation();
  _headerSizeTarget = { type, index };
  const popup = document.getElementById('headerSizePopup');
  const input = document.getElementById('headerSizeInput');
  document.getElementById('headerSizeLabel').textContent = label;
  input.value = currentPx;
  // 팝업 위치
  const px = Math.min(e.clientX, window.innerWidth - 230);
  const py = Math.min(e.clientY + 8, window.innerHeight - 120);
  popup.style.left = px + 'px';
  popup.style.top  = py + 'px';
  popup.style.display = 'block';
  setTimeout(() => { input.focus(); input.select(); }, 30);
}

function closeHeaderPopup() {
  document.getElementById('headerSizePopup').style.display = 'none';
  _headerSizeTarget = null;
}

function applyHeaderSize() {
  if (!_headerSizeTarget) return;
  const px  = parseInt(document.getElementById('headerSizeInput').value) || 0;
  if (px < 4) return;
  const table = document.getElementById('xlsTable');
  if (!table) return;

  if (_headerSizeTarget.type === 'col') {
    const cols  = Array.from(table.querySelectorAll('col'));
    const col   = cols[_headerSizeTarget.index];
    if (!col) return;
    // px → % 변환
    const tableW = table.offsetWidth;
    const newPct = (px / tableW * 100).toFixed(3);
    col.style.width = newPct + '%';
  } else {
    const rows = Array.from(table.querySelectorAll('tr'));
    const row  = rows[_headerSizeTarget.index];
    if (!row) return;
    row.style.height = px + 'px';
  }

  closeHeaderPopup();
  setTimeout(() => { initTableResize(); renderExcelHeaders(); }, 30);
}

// 팝업 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  const popup = document.getElementById('headerSizePopup');
  if (popup && popup.style.display !== 'none' && !popup.contains(e.target)) closeHeaderPopup();
});

