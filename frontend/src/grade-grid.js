  // 등급 정규화 및 시상금 매핑
  const GRADE_REWARD = { 'A': 50000, 'B': 20000, 'C': 5000, '채택': 5000, '건의': 0, '참가': 2000, '5S': 0, '단순': 0, '중복': 0 };
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
  let gradeStatsView = 'chart';
  let goalChartMonth = '전체';
  const GOAL_DEPT_ORDER = ['생산1부','생산2부','에스이엠','연구개발팀','품질관리부','T/S팀','물류관리팀','공무팀','환경관리과','총무과'];
  const GOAL_DEPT_TARGETS = { '생산1부':32, '생산2부':5, '에스이엠':10, '연구개발팀':11, '품질관리부':16, 'T/S팀':9, '물류관리팀':9, '공무팀':8, '환경관리과':5, '총무과':1 };
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
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
  function normalizeDepartment(raw) {
    const cleaned = String(raw || '').replace(/^[a-zA-Z]\s+/, '').trim();
    const compact = cleaned.replace(/[.\s]/g, '').toLowerCase();
    if (!cleaned) return '';
    if (cleaned.includes('공무과')) return cleaned.replace(/공무과/g, '공무팀');
    if (compact === 'sem' || compact === '에스이엠') return '에스이엠';
    return cleaned;
  }
  function deriveKingRowsFromGrid() {
    if (!gridApi) return [];
    const grouped = new Map();
    gridApi.forEachNode(node => {
      const row = node.data || {};
      const proposer = stripRank(row.proposer || '');
      if (!proposer) return;
      const department = normalizeDepartment(row.department) || '-';
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
      const department = normalizeDepartment(row.department);
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
    if (mode === 'goal') {
      gradeStatsView = 'goal';
      renderGradeChart();
      return;
    }
    gradeStatsView = 'chart';
    gradeChartMode = mode === 'year' ? 'year' : 'month';
    const periods = getChartPeriods(gradeChartMode);
    gradeChartPeriod = periods.includes(gradeChartPeriod) ? gradeChartPeriod : '전체';
    renderGradeChart();
  }
  function setGradeChartPeriod(value) {
    gradeChartPeriod = value || '전체';
    renderGradeChart();
  }
  function getGoalChartMonths() {
    const values = new Set();
    if (gridApi) {
      gridApi.forEachNode(node => {
        const month = String(node.data?.month || '').trim();
        if (month) values.add(month);
      });
    }
    const monthOrder = ["12월","1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월"];
    return ['전체', ...Array.from(values).sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b))];
  }
  function getGoalChartRows() {
    const months = goalChartMonth === '전체' ? getGoalChartMonths().filter(month => month !== '전체') : [goalChartMonth];
    const monthCount = Math.max(months.length, 1);
    const counts = {};
    GOAL_DEPT_ORDER.forEach(dept => { counts[dept] = 0; });
    if (gridApi) {
      gridApi.forEachNode(node => {
        const row = node.data || {};
        const month = String(row.month || '').trim();
        if (goalChartMonth !== '전체' && month !== goalChartMonth) return;
        const dept = normalizeDepartment(row.department);
        if (counts[dept] === undefined) return;
        counts[dept] += 1;
      });
    }
    return GOAL_DEPT_ORDER.map(dept => {
      const target = (GOAL_DEPT_TARGETS[dept] || 0) * monthCount;
      const actual = counts[dept] || 0;
      const rate = target > 0 ? Math.round((actual / target) * 100) : 0;
      return { department: dept, target, actual, rate };
    }).sort((a, b) => b.rate - a.rate || b.actual - a.actual || a.department.localeCompare(b.department, 'ko'));
  }
  function setGoalChartMonth(value) {
    goalChartMonth = value || '전체';
    renderGradeChart();
  }
  function renderGoalChartInStats() {
    const summaryEl = document.getElementById('gradeChartSummary');
    const bodyEl = document.getElementById('gradeChartBody');
    const periodEl = document.getElementById('gradeChartPeriod');
    const goalMonthEl = document.getElementById('goalChartMonth');
    const monthBtn = document.getElementById('chartModeMonthBtn');
    const yearBtn = document.getElementById('chartModeYearBtn');
    const goalBtn = document.getElementById('chartModeGoalBtn');
    if (!summaryEl || !bodyEl) return;
    if (periodEl) periodEl.style.display = 'none';
    if (goalMonthEl) {
      goalMonthEl.style.display = '';
      const months = getGoalChartMonths();
      if (!months.includes(goalChartMonth)) goalChartMonth = '전체';
      goalMonthEl.innerHTML = months.map(month => `<option value="${escapeHtml(month)}" ${month === goalChartMonth ? 'selected' : ''}>${escapeHtml(month === '전체' ? '전체 월' : month)}</option>`).join('');
    }
    monthBtn?.classList.remove('on');
    yearBtn?.classList.remove('on');
    goalBtn?.classList.add('on');
    const rows = getGoalChartRows();
    const totalTarget = rows.reduce((sum, row) => sum + row.target, 0);
    const totalActual = rows.reduce((sum, row) => sum + row.actual, 0);
    const totalRate = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;
    summaryEl.innerHTML = `<div class="chart-summary-line">목표달성률 · ${escapeHtml(goalChartMonth === '전체' ? '전체 월' : goalChartMonth)} · 전체 ${totalRate}% · 실적 ${totalActual.toLocaleString()}건 / 목표 ${totalTarget.toLocaleString()}건</div>`;
    const visualMax = 140;
    const goalPos = (100 / visualMax) * 100;
    const getState = (rate) => rate >= 100 ? 'good' : (rate >= 80 ? 'mid' : 'low');
    bodyEl.innerHTML = `
      <div class="chart-toolbar">
        <div class="chart-note">부서별 월 할당량 대비 실제 제안 건수 달성률입니다. 실적이 없어도 모든 부서가 포함됩니다.</div>
      </div>
      <div class="goal-canvas chart-canvas-like">
        <div class="goal-items">
          ${rows.map(row => {
            const state = getState(row.rate);
            const width = Math.max(0, Math.min((row.rate / visualMax) * 100, 100));
            return `
              <div class="goal-item state-${state}">
                <div><div class="goal-dept">${escapeHtml(row.department)}</div><div class="goal-meta">실적 ${row.actual} / 목표 ${row.target}</div></div>
                <div class="goal-track" style="--goal-pos:${goalPos}%;"><div class="goal-goal-label">GOAL</div><div class="goal-track-fill"><div class="goal-fill ${state}" style="width:${width}%;"></div></div></div>
                <div class="goal-rate">${row.rate}%</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
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
  let duplicateRowLookup = {};
  function normalizeDuplicateText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function getDuplicateTokens(value) {
    const stopWords = new Set(['개선', '제안', '설치', '작업', '사용', '위한', '대한', '관련', '방지', '확인', '관리', '건']);
    return normalizeDuplicateText(value)
      .split(/\s+/)
      .map(token => token.trim())
      .filter(token => token.length >= 2 && !stopWords.has(token));
  }
  function getDuplicateScore(a, b) {
    const aNorm = normalizeDuplicateText(a.title).replace(/\s/g, '');
    const bNorm = normalizeDuplicateText(b.title).replace(/\s/g, '');
    if (!aNorm || !bNorm) return { score: 0, common: [] };
    if (aNorm === bNorm && aNorm.length >= 6) return { score: 1, common: getDuplicateTokens(a.title).slice(0, 6) };
    const aTokens = new Set(getDuplicateTokens(a.title));
    const bTokens = new Set(getDuplicateTokens(b.title));
    const common = [...aTokens].filter(token => bTokens.has(token));
    const unionSize = new Set([...aTokens, ...bTokens]).size || 1;
    const tokenScore = common.length / unionSize;
    const containsScore = aNorm.length >= 8 && bNorm.length >= 8 && (aNorm.includes(bNorm) || bNorm.includes(aNorm)) ? 0.72 : 0;
    const samePersonBoost = a.proposer && b.proposer && normalizeDuplicateText(a.proposer) === normalizeDuplicateText(b.proposer) ? 0.08 : 0;
    return { score: Math.max(tokenScore + samePersonBoost, containsScore), common };
  }
  function findDuplicateGroups() {
    if (!gridApi) return [];
    const items = [];
    gridApi.forEachNode(node => {
      const title = String(node.data?.title || '').trim();
      if (title.length >= 6) {
        const id = `dup-${items.length}`;
        items.push({ id, node, row: node.data, title, proposer: node.data?.proposer || '', department: node.data?.department || '', date: node.data?.date || '' });
      }
    });
    const parent = items.map((_, index) => index);
    const groupMeta = new Map();
    const find = index => parent[index] === index ? index : (parent[index] = find(parent[index]));
    const union = (a, b, meta) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent[rootB] = rootA;
      const root = find(a);
      const current = groupMeta.get(root) || { maxScore: 0, common: [] };
      if (meta.score > current.maxScore) groupMeta.set(root, { maxScore: meta.score, common: meta.common || [] });
    };
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const result = getDuplicateScore(items[i], items[j]);
        const enoughTokens = result.common.length >= 2 && result.score >= 0.34;
        if (result.score >= 0.7 || enoughTokens) union(i, j, result);
      }
    }
    const grouped = new Map();
    items.forEach((item, index) => {
      const root = find(index);
      if (!grouped.has(root)) grouped.set(root, []);
      grouped.get(root).push(item);
    });
    return [...grouped.entries()]
      .map(([root, group]) => ({ items: group, meta: groupMeta.get(root) || { maxScore: 0, common: [] } }))
      .filter(group => group.items.length > 1)
      .sort((a, b) => b.meta.maxScore - a.meta.maxScore || b.items.length - a.items.length);
  }
  function openDuplicateViewer() {
    const modal = document.getElementById('duplicateModal');
    const summaryEl = document.getElementById('duplicateSummary');
    const bodyEl = document.getElementById('duplicateBody');
    if (!modal || !summaryEl || !bodyEl) return;
    const groups = findDuplicateGroups();
    duplicateRowLookup = {};
    const rowCount = groups.reduce((sum, group) => sum + group.items.length, 0);
    const highCount = groups.filter(group => group.meta.maxScore >= 0.7).length;
    summaryEl.innerHTML = `
      <div class="duplicate-card"><div class="label">의심 묶음</div><div class="value">${groups.length}</div></div>
      <div class="duplicate-card"><div class="label">확률 높음</div><div class="value">${highCount}</div></div>
      <div class="duplicate-card"><div class="label">검토 항목</div><div class="value">${rowCount}</div></div>
    `;
    if (!groups.length) {
      bodyEl.innerHTML = '<div class="duplicate-empty">현재 데이터에서는 중복으로 의심되는 제안이 없습니다.</div>';
      modal.style.display = 'block';
      return;
    }
    bodyEl.innerHTML = groups.map((group, groupIndex) => {
      const isHigh = group.meta.maxScore >= 0.7;
      const keywords = (group.meta.common || []).slice(0, 5).join(', ');
      const rows = group.items.map(item => {
        duplicateRowLookup[item.id] = item.node;
        return `
          <tr>
            <td>${escapeHtml(item.row.month || '')}</td>
            <td>${escapeHtml(item.date || '')}</td>
            <td>${escapeHtml(item.department || '')}</td>
            <td>${escapeHtml(item.proposer || '')}</td>
            <td class="duplicate-title-cell">${escapeHtml(item.title)}</td>
            <td><button class="duplicate-jump-btn" onclick="jumpToDuplicateRow('${item.id}')">표에서 보기</button></td>
          </tr>
        `;
      }).join('');
      return `
        <section class="duplicate-group">
          <div class="duplicate-group-head">
            <div class="duplicate-group-title">중복의심 ${groupIndex + 1} · ${group.items.length}개 항목${keywords ? ` · 공통어: ${escapeHtml(keywords)}` : ''}</div>
            <span class="duplicate-badge ${isHigh ? 'high' : 'mid'}">${isHigh ? '유사도 높음' : '검토 필요'}</span>
          </div>
          <table class="duplicate-table">
            <colgroup>
              <col style="width:60px"><col style="width:96px"><col style="width:110px"><col style="width:90px"><col><col style="width:92px">
            </colgroup>
            <thead><tr><th>월</th><th>접수일</th><th>부서</th><th>제안자</th><th>제안명</th><th>이동</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>
      `;
    }).join('');
    modal.style.display = 'block';
  }
  function jumpToDuplicateRow(id) {
    const node = duplicateRowLookup[id];
    if (!node || !gridApi) return;
    document.getElementById('duplicateModal').style.display = 'none';
    gridApi.deselectAll();
    node.setSelected(true);
    gridApi.ensureIndexVisible(node.rowIndex, 'middle');
    gridApi.ensureColumnVisible('title');
    gridApi.flashCells({ rowNodes: [node], columns: ['title', 'proposer', 'department'] });
  }
  function openGradeChart() {
    renderGradeChart();
    document.getElementById('gradeChartModal').style.display = 'block';
  }
  function renderGradeChart() {
    if (gradeStatsView === 'goal') {
      renderGoalChartInStats();
      return;
    }
    const rows = getDepartmentGradeRows();
    const summaryEl = document.getElementById('gradeChartSummary');
    const bodyEl = document.getElementById('gradeChartBody');
    const periodEl = document.getElementById('gradeChartPeriod');
    const goalMonthEl = document.getElementById('goalChartMonth');
    const monthBtn = document.getElementById('chartModeMonthBtn');
    const yearBtn = document.getElementById('chartModeYearBtn');
    const goalBtn = document.getElementById('chartModeGoalBtn');
    if (!summaryEl || !bodyEl) return;
    if (periodEl) periodEl.style.display = '';
    if (goalMonthEl) goalMonthEl.style.display = 'none';
    const periods = getChartPeriods(gradeChartMode);
    if (!periods.includes(gradeChartPeriod)) gradeChartPeriod = '전체';
    if (periodEl) {
      periodEl.innerHTML = periods.map(v => `<option value="${escapeHtml(v)}" ${v === gradeChartPeriod ? 'selected' : ''}>${escapeHtml(v === '전체' ? (gradeChartMode === 'year' ? '전체 연도' : '전체 월') : v)}</option>`).join('');
    }
    if (monthBtn) monthBtn.classList.toggle('on', gradeChartMode === 'month');
    if (yearBtn) yearBtn.classList.toggle('on', gradeChartMode === 'year');
    if (goalBtn) goalBtn.classList.remove('on');
    if (!rows.length) {
      summaryEl.innerHTML = '';
      bodyEl.innerHTML = '<div class="chart-empty">통계를 그릴 데이터가 없습니다. 먼저 제안 데이터를 불러오거나 입력해 주세요.</div>';
      return;
    }

    const topDept = rows[0];
    const total = rows.reduce((sum, row) => sum + row.total, 0);
    const maxValue = Math.max(...rows.map(row => row.total), 1);
    const adoptedTotal = rows.reduce((sum, row) => sum + (row['채택'] || 0), 0);
    const aTotal = rows.reduce((sum, row) => sum + (row.A || 0), 0);

    summaryEl.innerHTML = `<div class="chart-summary-line">${gradeChartMode === 'year' ? '연 통계' : '월 통계'} · ${escapeHtml(gradeChartPeriod)} · 전체 ${total.toLocaleString()} · 최다 ${escapeHtml(topDept.department)} ${topDept.total.toLocaleString()}</div>`;

    const summaryCards = [
      ['전체 건수', total.toLocaleString()],
      ['채택', adoptedTotal.toLocaleString()],
      ['A급', aTotal.toLocaleString()],
      ['최다 부서', `${topDept.department} ${topDept.total.toLocaleString()}`]
    ].map(([label, value]) => `
      <div class="chart-sc">
        <div class="sl">${escapeHtml(label)}</div>
        <div class="sv">${escapeHtml(value)}</div>
      </div>
    `).join('');

    const tableRows = rows.map((row, index) => {
      const percent = Math.max(4, Math.round((row.total / maxValue) * 100));
      const barSegments = CHART_GRADE_ORDER.map(grade => {
        const value = row[grade] || 0;
        if (!value || !row.total) return '';
        const width = Math.max(3, (value / row.total) * 100);
        return `<span class="stats-bar-segment" title="${escapeHtml(grade)} ${value.toLocaleString()}" style="width:${width}%;background:${CHART_GRADE_COLORS[grade]};"></span>`;
      }).join('');
      const gradeCells = CHART_GRADE_ORDER.map(grade => `
        <span class="stats-grade-pill" style="--pill-color:${CHART_GRADE_COLORS[grade]};">
          <b>${grade}</b>${(row[grade] || 0).toLocaleString()}
        </span>
      `).join('');
      return `
        <tr>
          <td class="stats-rank">${index + 1}</td>
          <td class="stats-dept">${escapeHtml(row.department)}</td>
          <td class="stats-total">${row.total.toLocaleString()}</td>
          <td>
            <div class="stats-bar-track">
              <div class="stats-bar-fill" style="width:${percent}%;">${barSegments}</div>
            </div>
          </td>
          <td class="stats-grade-cell">${gradeCells}</td>
        </tr>
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
        <div class="chart-note">현재 프로그램 데이터 기준으로 ${gradeChartMode === 'year' ? '연도별' : '월별'} 부서별 실적을 표와 막대로 함께 보여줍니다.</div>
        <div class="chart-legend">${legend}</div>
      </div>
      <div class="stats-board chart-canvas-like">
        <div class="stats-board-head">
          <div>
            <div class="stats-board-kicker">${gradeChartMode === 'year' ? 'YEARLY SUMMARY' : 'MONTHLY SUMMARY'}</div>
            <div class="stats-board-title">${gradeChartMode === 'year' ? '부서별 제안건수 연 통계' : '부서별 제안건수 월 통계'}</div>
          </div>
          <div class="stats-card-grid">${summaryCards}</div>
        </div>
        <div class="stats-table-wrap">
          <table class="stats-table">
            <thead>
              <tr>
                <th>No</th>
                <th>부서</th>
                <th>총 건수</th>
                <th>실적 비교</th>
                <th>등급별 세부</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
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
    window.toggleSidebar = toggleSidebar;
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
          const cleaned = normalizeDepartment(val);
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
      if (gridApi) gridApi.refreshCells({ force: true });
    });
  });

  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
  }

  window.toggleSidebar = toggleSidebar;

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
            department: normalizeDepartment(row[colIdx.department]),
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
        department: normalizeDepartment(row[colIdx.department]),
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
    const key = document.getElementById('apiKey').value.trim();
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
- department: 부서명 (손글씨라도 최대한 정확히. 단, "공무과"는 반드시 "공무팀"으로, "SEM", "S.E.M.", "에스이엠"은 반드시 "에스이엠"으로 표준화. 예: "생산 1부"→"생산 1부", "품질관리부"→"품질관리부", "S.E.M."→"에스이엠", "SEM"→"에스이엠", "공무과"→"공무팀", "물류관리팀"→"물류관리팀", "환경관리과"→"환경관리과", "생산 2부"→"생산 2부", "총무과"→"총무과")
- proposer: 제안자 이름만 (직급 제외. "오진영 대리"→"오진영", "신은식 과장"→"신은식", "김경수"→"김경수")
- rawTitle: 제안명 원문 전체
- currentState: 현재상태 원문 핵심
- improvement: 개선안 원문 핵심
- title: 아래 규칙으로 만든 짧은 요약문
  * 반드시 제안명 + 현재상태 + 개선안을 함께 반영
  * 길이 45~110자 정도
  * 한 문장 또는 두 문장으로 자연스럽게 요약
  * 단순히 제안명만 그대로 쓰지 말 것
  * 예시: "원자재 폐기 작업자의 호흡기 안전을 위해, 기존 오너툴 폐기 중 분진 노출 문제를 개선하고 전 호기 폐기통 마스크 공급함으로 즉시 착용 가능하게 한 제안"
- grade: 반드시 아래 9가지 중 정확히 하나만. 절대 다른 값 사용 금지.
  * 영문 대문자: A, B, C (실시 등급. C는 절대로 '채택'이 아님. 영문 알파벳 C)
  * 영문+숫자: 5S (정리·정돈·청소·청결·습관화, 표시/라벨/규격/위치관리 개선 등 5S 성격)
  * 한글: 채택, 건의, 참가, 단순, 중복 (아이디어 등급. '채택'은 절대로 C가 아님. 두 글자 한글)
  * 반드시 문서 상단 "검토부서" 행의 "등급" 칸을 우선 판독하세요. "제안유형" 체크박스(설비관련/공정개선/작업방법/업무개선/환경개선/안전개선/자재 외 기타)는 등급이 아닙니다.
  * 구분 기준: 문서에 "실시(A급)"→A, "실시(B급)"→B, "실시(C급)"→C, "아이디어(채택)"→채택, "아이디어(건의)"→건의, "아이디어(참가)"→참가, "5S"→5S, "단순제안"→단순, "중복"→중복
  * B와 5S 구분 규칙:
    - B: 등급 칸에 한 글자 영문 B처럼 보이는 손글씨가 있고, 세로획 또는 두 개의 둥근 굴곡이 이어진 단일 문자이면 B로 판정하세요. 원가절감, 대체품 개발, 구매단가 인하, 비용 절감액 등 개선 효과가 큰 실시 제안은 B 가능성이 높습니다.
    - 5S: 등급 칸에 숫자 5와 영문 S가 함께 보이거나, "5 S", "5S", "오에스"처럼 두 글자/두 요소로 보이면 5S로 판정하세요. 소모품 사용량 표시, 규격 표시, 위치 표시, 라벨 부착, 정리·정돈·눈으로 보는 관리처럼 현장 표시/표준화 개선이면 5S 가능성이 높습니다.
    - B와 5S가 애매하면 등급 칸 모양을 다시 확인하세요. 하나의 붙은 문자면 B, 숫자 5와 S가 분리되어 보이면 5S입니다.
- reward: 0
- safety: 아래 조건 중 하나라도 해당하면 "○", 아니면 ""
  1. 검토의견란에 "■ 아차사고·위험요소발굴" 또는 "■ 위험요소 발굴/개선"에 ■(검게 채워진 네모) 체크
  2. 제안유형에 "■ 안전개선" 체크
  3. 제안내용이 낙하·추락·충돌·화재·폭발·감전·끼임·화상·누출·안전사고 예방 등 안전과 직접 관련된 경우

반드시 순수 JSON 배열만 출력. 마크다운, 코드블록, 설명 없이.
예: [
{"month":"2월","date":"2026.02.26","department":"생산 1부","proposer":"공대영","rawTitle":"S.D 전 호기 집진노즐 확인용 클램프타입 간이 점검구 설치 건","currentState":"집진노즐 상태를 확인하려면 설비를 분해해야 해서 점검이 불편함","improvement":"클램프타입 간이 점검구를 설치해 분해 없이 확인 가능하도록 개선","title":"S.D 전 호기 집진노즐 점검 시 설비 분해가 필요하던 불편을 줄이기 위해, 클램프타입 간이 점검구를 설치해 신속하게 상태 확인이 가능하도록 한 제안","grade":"채택","reward":0,"safety":"○"},
{"month":"2월","date":"2026.02.23","department":"에스이엠","proposer":"오진영","rawTitle":"소핑제 사용 규격 표시","currentState":"현장에서 소핑제 사용 기준이 명확하지 않아 혼선이 있음","improvement":"규격을 눈에 띄게 표시해 누구나 바로 확인 가능하도록 개선","title":"소핑제 사용 기준이 현장에서 바로 보이지 않던 문제를 개선하기 위해, 사용 규격을 명확히 표시해 작업자 혼선을 줄이도록 한 제안","grade":"C","reward":0,"safety":""},
{"month":"2월","date":"2026.02.26","department":"생산 2부","proposer":"정강민","rawTitle":"DO2~DO3 색소 저장탱크 H빔 충돌방지 개선 건","currentState":"저장탱크 주변 H빔과 작업 동선 충돌 위험이 있음","improvement":"충돌방지 구조를 보강해 작업 중 접촉 위험을 줄임","title":"DO2~DO3 색소 저장탱크 주변 H빔과 작업 동선의 충돌 위험을 줄이기 위해, 충돌방지 구조를 보강해 안전하게 작업할 수 있도록 개선한 제안","grade":"C","reward":0,"safety":""}
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
      const cleaned = records.map(r => {
        const rawTitle = String(r.rawTitle || r.title || '');
        const currentState = String(r.currentState || '').trim();
        const improvement = String(r.improvement || '').trim();
        const summary = String(r.title || '').trim();
        const fallbackSummary = [rawTitle, currentState, improvement]
          .filter(Boolean)
          .join(' / ');

        return ({
        month: String(r.month || ''),
        date: String(r.date || ''),
        department: normalizeDepartment(r.department),
        proposer: stripRank(r.proposer),
        title: summary || fallbackSummary || rawTitle,
        grade: normalizeGrade(r.grade),
        reward: rewardFromGrade(normalizeGrade(r.grade)),
        safety: (r.safety === '○' || r.safety === 'O' || r.safety === 'o' || r.safety === true || r.safety === 1 || String(r.safety||'').includes('○') || String(r.safety||'').includes('위험') || String(r.safety||'').includes('아차')) ? '○' : ''
      })});

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

