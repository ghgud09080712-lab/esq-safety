  // 등급 정규화 및 시상금 매핑
  const GRADE_REWARD = { 'A': 50000, 'B': 20000, 'C': 5000, '채택': 5000, '건의': 0, '참가': 2000, '공무': 0, '5S': 0, '단순': 0, '보류': 0, '중복': 0 };
  const KING_FORMULA = { label: '기본 점수', subtitle: 'A×10 + B×5 + C×3 + 채택×3 + 참가×2 + 건의×1', weights: { A: 10, B: 5, C: 3, 채택: 3, 참가: 2, 건의: 1 } };
  const CHART_GRADE_ORDER = ['채택', '참가', '5S', '공무', '건의', '단순', '보류', 'A', 'B', 'C'];
  const CHART_GRADE_COLORS = {
    '채택': '#ff2d20',
    '참가': '#0ea5e9',
    '5S': '#f97316',
    '공무': '#d97706',
    '건의': '#4f79b3',
    '단순': '#94a3b8',
    '보류': '#64748b',
    'A': '#fff200',
    'B': '#4b97a8',
    'C': '#8fd14f'
  };
  let gradeChartMode = 'month';
  let gradeChartPeriod = '전체';
  let gradeStatsView = 'chart';
  let goalChartMonth = '전체';
  let pendingPdfFile = null;
  let isPdfAnalysisRunning = false;
  const PDF_REGION_STORAGE_KEYS = {
    redCheck: 'proposalPdfRegion:redCheck',
    gradeCell: 'proposalPdfRegion:gradeCell'
  };
  const DEFAULT_PDF_REGIONS = {
    redCheck: [
      { x: 0.49, y: 0.245, w: 0.43, h: 0.265 },
      { x: 0.46, y: 0.225, w: 0.48, h: 0.305 }
    ],
    gradeCell: { x: 0.305, y: 0.162, w: 0.19, h: 0.048 }
  };
  let regionPickerState = {
    kind: 'redCheck',
    selection: null,
    dragging: false,
    startX: 0,
    startY: 0
  };
  const ANALYSIS_GRADE_CANDIDATES = ['A', 'B', 'C', '참가', '건의'];
  const GOAL_DEPT_ORDER = ['생산1부','생산2부','SEM','연구개발팀','품질관리부','T/S팀','물류관리팀','공무팀','환경관리과','총무과'];
  const GOAL_DEPT_TARGETS = { '생산1부':32, '생산2부':5, 'SEM':10, '연구개발팀':11, '품질관리부':16, 'T/S팀':9, '물류관리팀':9, '공무팀':8, '환경관리과':5, '총무과':1 };
  const GEMINI_MODEL = 'gemini-2.5-flash';
  const OPENAI_MODEL = 'gpt-4.1-mini';
  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function normalizeGrade(raw, options = {}) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const compact = s.replace(/[\s._\-(){}\[\],#~·"'“”‘’]/g, '').toUpperCase();
    const hangulCompact = s.replace(/[^가-힣]/g, '');
    const alnumCompact = s.replace(/[^0-9A-Za-z가-힣]/g, '').toUpperCase();
    const editDistance = (left, right) => {
      const prev = Array.from({ length: right.length + 1 }, (_, index) => index);
      for (let i = 1; i <= left.length; i += 1) {
        let last = prev[0];
        prev[0] = i;
        for (let j = 1; j <= right.length; j += 1) {
          const old = prev[j];
          prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (left[i - 1] === right[j - 1] ? 0 : 1));
          last = old;
        }
      }
      return prev[right.length];
    };
    // 한글 먼저 (영문 C와 혼동 방지)
    const knownKoreanGrades = {
      '채택': ['채택', '채핵', '체택', '재택', '재댁', '채댁', '채턱', '채텩', '치택', '차택', '채텍', '채태', '채탁', '채덱', '체댁', '재텍', '재턱', '최택'],
      '건의': ['건의', '견의', '건이', '건외', '권의', '전의', '건으', '건익', '건위', '긴의'],
      '참가': ['참가', '참카', '참기', '참갸', '참각'],
      '공무': ['공무', '궁무', '공므', '공뮤', '공문', '궁문', '공믄', '공문대', '공무대', '공무팀', '공무과'],
      '단순': ['단순', '단수', '딘순', '단숭', '단술', '단슨']
    };
    for (const [grade, aliases] of Object.entries(knownKoreanGrades)) {
      if (aliases.some(alias => s.includes(alias) || hangulCompact.includes(alias))) return grade;
      if (hangulCompact.length >= 2 && hangulCompact.length <= 3 && aliases.some(alias => editDistance(hangulCompact.slice(0, 2), alias.slice(0, 2)) <= 1)) return grade;
    }
    if (/5\s*s/i.test(s) || /S$/i.test(alnumCompact) || ['오에스', '오S', '5에스', '오이에스'].some(v => s.includes(v))) return '5S';
    if (s.includes('중복')) return '중복';
    if (s.includes('보류')) return '보류';
    if (/^A(?:급)?$/i.test(compact)) return 'A';
    if (/^B(?:급)?$/i.test(compact)) return 'B';
    if (/^(C|C급|씨|씨급|실시C|실시C급)$/i.test(compact) || /^실시씨급?$/.test(hangulCompact)) return 'C';
    if (options.allowCAlias && ['O', '0', '○', '〇', 'ㄷ', 'ᄃ'].includes(compact)) return 'C';
    if (hangulCompact.length >= 2) return '';
    return s;
  }
  function normalizeProposalType(raw, grade) {
    const normalizedGrade = normalizeGrade(grade);
    return ['A', 'B', 'C'].includes(normalizedGrade) ? '실시' : '아이디어';
  }
  function isAllowedAnalysisGrade(raw) {
    return ANALYSIS_GRADE_CANDIDATES.includes(normalizeGrade(raw));
  }
  function coerceAnalysisGrade(raw) {
    const grade = normalizeGrade(raw);
    return ANALYSIS_GRADE_CANDIDATES.includes(grade) ? grade : 'C';
  }
  function shouldAuditGrade(raw) {
    return true;
  }
  function getAbsolutePageNoForRecord(row, index, chunk) {
    const pageStart = Number(chunk?.pageStart || 1);
    const pageEnd = Number(chunk?.pageEnd || pageStart);
    const pageNo = Number(row?.pageNo || 0);
    const fallbackPageNo = Number.isFinite(index) ? index + 1 : 0;
    const chunkRelativeMax = Number.isFinite(pageEnd) && pageEnd >= pageStart ? pageEnd - pageStart + 1 : Infinity;
    const hasValidPageNo = Number.isFinite(pageNo) && pageNo > 0 && pageNo <= chunkRelativeMax;
    const relativePageNo = hasValidPageNo ? pageNo : fallbackPageNo;
    return Number.isFinite(relativePageNo) && relativePageNo > 0 ? pageStart + relativePageNo - 1 : 0;
  }
  function getAbsolutePagesForChunk(chunk) {
    const start = Number(chunk?.pageStart || 1);
    const end = Number(chunk?.pageEnd || start);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end < start) return [1];
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }
  function configurePdfJsWorker() {
    if (!window.pdfjsLib) return;
    if (window.pdfjsLib.GlobalWorkerOptions?.workerSrc) return;
    if (window.__PDFJS_WORKER_SOURCE__) {
      try {
        const blob = new Blob([window.__PDFJS_WORKER_SOURCE__], { type: 'text/javascript' });
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
        return;
      } catch (error) {
        console.warn('PDF worker blob 설정 실패:', error);
      }
    }
    if (window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs-dist/build/pdf.worker.min.js';
    }
  }
  async function getPdfPageCountForAnalysis(arrayBuffer) {
    if (!window.pdfjsLib?.getDocument) return 0;
    configurePdfJsWorker();
    try {
      const pdf = await window.pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer.slice(0)),
        disableWorker: true
      }).promise;
      return Number(pdf.numPages || 0);
    } catch (error) {
      console.warn('PDF 페이지 수 확인 실패:', error);
      return 0;
    }
  }
  function rewardFromGrade(g) { return GRADE_REWARD[g] !== undefined ? GRADE_REWARD[g] : 0; }
  function normalizeRewardByGrade(grade) {
    return rewardFromGrade(normalizeGrade(grade));
  }
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
    const cleaned = String(raw || '').replace(/^[a-zA-Z](?:\.|\s+)/, '').trim();
    const compact = cleaned.replace(/[.\s/·_\-]/g, '').toLowerCase();
    if (!cleaned) return '';
    if (cleaned.includes('공무과')) return cleaned.replace(/공무과/g, '공무팀');
    if (['공무', '공무팀', '공무부', '공무과', '공므', '공뮤', '궁무', '궁무팀', '공무텀', '공무딤', '공부팀', '궁므', '궁뮤', '공무딥', '공무팀부', '공무파트'].includes(compact)) return '공무팀';
    if (compact.includes('공무') || compact.includes('궁무')) return '공무팀';
    if (compact === '분산qc') return '품질관리부';
    if (['sem', 'em', 'slem', 'seem', 'sɛm', '에스이엠', '이에스엠', '이엠'].includes(compact)) return 'SEM';
    if (compact === 'ts' || compact === 'ts팀' || compact === 't/s' || compact === 't/s팀') return 'T/S팀';
    return cleaned;
  }
  function getDepartmentForStats(raw) {
    return normalizeDepartment(raw);
  }
  function formatDepartmentWithCode(raw) {
    const base = normalizeDepartment(raw);
    const compact = String(base || '').replace(/[.\s]/g, '').toLowerCase();
    const departmentMap = {
      '생산1부': 'a.생산1부',
      '생산2부': 'b.생산2부',
      'sem': 'c.SEM',
      '연구개발팀': 'd.연구개발팀',
      '품질관리부': 'e.품질관리부',
      't/s팀': 'f.T/S팀',
      '물류관리팀': 'g.물류관리팀',
      '공무팀': 'h.공무팀',
      '환경관리과': 'i.환경관리과',
      '총무과': 'j.총무과'
    };
    return departmentMap[compact] || base;
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
      const department = getDepartmentForStats(row.department) || '-';
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
      else if (grade === '건의' || grade === '공무') target.suggested += 1;
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
      const department = getDepartmentForStats(row.department);
      if (!department) return;
      if (!map.has(department)) {
        map.set(department, { department, total: 0, 채택: 0, 참가: 0, '5S': 0, 공무: 0, 건의: 0, 단순: 0, 보류: 0, A: 0, B: 0, C: 0 });
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
        const dept = getDepartmentForStats(row.department);
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

    const legend = ['C', 'B', 'A', '보류', '단순', '건의', '공무', '5S', '참가', '채택'].map(grade => `
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
    {
      headerName: "제안구분",
      field: "type",
      width: 92,
      editable: true,
      filter: true,
      valueFormatter: params => normalizeProposalType(params.value, params.data?.grade),
      cellStyle: { textAlign: 'center', fontWeight: '700', color: 'var(--accent)' }
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
          const cleaned = formatDepartmentWithCode(val);
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
          params.node.setDataValue('type', normalizeProposalType('', normalized));
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
    initOpenAIApiKeyPersistence();
    toggleAnalysisPanel(false);

    const dz = document.getElementById('dropZone');
    const analysisPanel = document.getElementById('analysisToolsPanel');
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes('Files') && analysisPanel && analysisPanel.classList.contains('open')) {
        dz?.classList.add('active');
      }
    });
    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null || !document.body.contains(e.relatedTarget)) dz?.classList.remove('active');
    });
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      dz?.classList.remove('active');
      if (analysisPanel && analysisPanel.classList.contains('open') && e.dataTransfer.files[0]) {
        processFile(e.dataTransfer.files[0]);
      }
    });
    window.addEventListener('resize', () => {
      if (gridApi) gridApi.refreshCells({ force: true });
    });
    initPdfRegionPicker();
    bindPdfRegionPickerButtons();
    updatePdfRegionStatus();
  });

  function initOpenAIApiKeyPersistence() {
    const input = document.getElementById('apiKey');
    const providerSelect = document.getElementById('aiProvider');
    if (!input) return;
    if (providerSelect) providerSelect.value = localStorage.getItem('aiProvider') || 'gemini';
    updateAiProviderUi();
    const savedKey = localStorage.getItem(`aiApiKey:${getAnalysisProvider()}`) || localStorage.getItem('openaiApiKey') || '';
    if (savedKey && !input.value) input.value = savedKey;
    providerSelect?.addEventListener('change', () => {
      localStorage.setItem('aiProvider', getAnalysisProvider());
      input.value = localStorage.getItem(`aiApiKey:${getAnalysisProvider()}`) || '';
      updateAiProviderUi();
    });
    input.addEventListener('input', () => {
      const value = input.value.trim();
      const storageKey = `aiApiKey:${getAnalysisProvider()}`;
      if (value) {
        localStorage.setItem(storageKey, value);
        localStorage.setItem('openaiApiKey', value);
      } else {
        localStorage.removeItem(storageKey);
        localStorage.removeItem('openaiApiKey');
      }
    });
    input.addEventListener('change', () => {
      const value = input.value.trim();
      if (value && pendingPdfFile && !isPdfAnalysisRunning) {
        showToast('🔁 API 키 입력 확인됨. 방금 선택한 PDF를 다시 분석합니다.');
        processPDF(pendingPdfFile);
      }
    });
  }

  function getAnalysisProvider() {
    return document.getElementById('aiProvider')?.value === 'openai' ? 'openai' : 'gemini';
  }

  function updateAiProviderUi() {
    const provider = getAnalysisProvider();
    const badge = document.getElementById('apiProviderBadge');
    const name = document.getElementById('apiProviderName');
    const link = document.getElementById('apiProviderLink');
    const input = document.getElementById('apiKey');
    if (badge) badge.textContent = provider === 'openai' ? 'OpenAI API' : 'Gemini API';
    if (name) name.textContent = provider === 'openai' ? `GPT-4.1 mini (${OPENAI_MODEL})` : `Gemini 2.5 Flash (${GEMINI_MODEL})`;
    if (link) {
      link.href = provider === 'openai' ? 'https://platform.openai.com/api-keys' : 'https://aistudio.google.com/app/apikey';
      link.textContent = provider === 'openai' ? 'platform.openai.com/api-keys' : 'aistudio.google.com/app/apikey';
    }
    if (input) input.placeholder = provider === 'openai' ? 'sk-...' : 'AIzaSy...';
  }

  function toggleAnalysisPanel(forceOpen) {
    const panel = document.getElementById('analysisToolsPanel');
    const btn = document.getElementById('analysisToggleBtn');
    if (!panel) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !panel.classList.contains('open');
    panel.classList.toggle('open', shouldOpen);
    if (btn) btn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
  }

  function handleFileChange(e) { if (e.target.files[0]) processFile(e.target.files[0]); }

  function processFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') processPDF(file);
    else if (['xlsx', 'xls'].includes(ext)) processExcel(file);
    else showToast('❌ 지원하지 않는 파일 형식입니다.', true);
  }

  function clampPdfRegion(region) {
    const x = Math.max(0, Math.min(0.98, Number(region?.x) || 0));
    const y = Math.max(0, Math.min(0.98, Number(region?.y) || 0));
    const w = Math.max(0.02, Math.min(1 - x, Number(region?.w) || 0));
    const h = Math.max(0.02, Math.min(1 - y, Number(region?.h) || 0));
    return { x, y, w, h };
  }

  function getStoredPdfRegion(kind) {
    const key = PDF_REGION_STORAGE_KEYS[kind];
    if (!key) return null;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (!parsed || typeof parsed !== 'object') return null;
      return clampPdfRegion(parsed);
    } catch {
      return null;
    }
  }

  function saveStoredPdfRegion(kind, region) {
    const key = PDF_REGION_STORAGE_KEYS[kind];
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(clampPdfRegion(region)));
    updatePdfRegionStatus();
  }

  function getPdfRegions(kind) {
    const stored = getStoredPdfRegion(kind);
    if (stored) return [stored];
    const fallback = DEFAULT_PDF_REGIONS[kind];
    return Array.isArray(fallback) ? fallback : [fallback];
  }

  function getDefaultPdfRegion(kind) {
    const fallback = DEFAULT_PDF_REGIONS[kind];
    return clampPdfRegion(Array.isArray(fallback) ? fallback[0] : fallback);
  }

  function updatePdfRegionStatus() {
    const el = document.getElementById('regionSettingStatus');
    if (!el) return;
    const red = getStoredPdfRegion('redCheck');
    const grade = getStoredPdfRegion('gradeCell');
    const redText = red ? '건의 체크: 직접 지정됨' : '건의 체크: 기본 영역';
    const gradeText = grade ? '등급칸: 직접 지정됨' : '등급칸: 기본 영역';
    el.textContent = `${redText} / ${gradeText}`;
  }

  function bindPdfRegionPickerButtons() {
    document.getElementById('redCheckRegionBtn')?.addEventListener('click', () => openPdfRegionPicker('redCheck'));
    document.getElementById('gradeCellRegionBtn')?.addEventListener('click', () => openPdfRegionPicker('gradeCell'));
    document.getElementById('resetPdfRegionBtn')?.addEventListener('click', resetPdfRegionSettings);
    document.getElementById('regionPickerFileInput')?.addEventListener('change', handleRegionPickerFile);
    document.getElementById('closeRegionPickerBtn')?.addEventListener('click', closePdfRegionPicker);
    document.getElementById('defaultPdfRegionBtn')?.addEventListener('click', useDefaultPdfRegion);
    document.getElementById('savePdfRegionBtn')?.addEventListener('click', savePdfRegionSelection);
  }

  function openPdfRegionPicker(kind = 'redCheck') {
    regionPickerState.kind = kind === 'gradeCell' ? 'gradeCell' : 'redCheck';
    const input = document.getElementById('regionPickerFileInput');
    if (!input) return;
    input.value = '';
    input.click();
  }

  async function handleRegionPickerFile(event) {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      showToast('❌ PDF 파일을 선택해주세요.', true);
      return;
    }
    try {
      const arrayBuffer = await file.arrayBuffer();
      await renderPdfRegionPicker(arrayBuffer);
    } catch (error) {
      showToast(`❌ 영역 설정용 PDF를 열 수 없습니다: ${error.message}`, true);
    }
  }

  async function renderPdfRegionPicker(arrayBuffer) {
    if (!window.pdfjsLib?.getDocument) {
      showToast('❌ PDF 렌더러가 준비되지 않았습니다.', true);
      return;
    }
    configurePdfJsWorker();
    const modal = document.getElementById('regionPickerModal');
    const canvas = document.getElementById('regionPickerCanvas');
    const guide = document.getElementById('regionPickerGuide');
    if (!modal || !canvas) return;
    const pdf = await window.pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer.slice(0)),
      disableWorker: true
    }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.55 });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: context, viewport }).promise;
    const kindLabel = regionPickerState.kind === 'gradeCell' ? '등급칸' : '건의 빨간 체크';
    if (guide) guide.textContent = `첫 페이지에서 ${kindLabel}이 들어가는 위치를 마우스로 드래그하세요. 저장하면 다음 분석부터 이 영역만 봅니다.`;
    regionPickerState.selection = getStoredPdfRegion(regionPickerState.kind) || getDefaultPdfRegion(regionPickerState.kind);
    modal.classList.add('open');
    requestAnimationFrame(() => drawRegionSelection());
  }

  function initPdfRegionPicker() {
    const wrap = document.getElementById('regionCanvasWrap');
    const canvas = document.getElementById('regionPickerCanvas');
    if (!wrap || !canvas) return;
    const getPoint = (event) => {
      const rect = canvas.getBoundingClientRect();
      const source = event.touches?.[0] || event;
      const x = Math.max(0, Math.min(1, (source.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (source.clientY - rect.top) / rect.height));
      return { x, y };
    };
    const start = (event) => {
      event.preventDefault();
      const point = getPoint(event);
      regionPickerState.dragging = true;
      regionPickerState.startX = point.x;
      regionPickerState.startY = point.y;
      regionPickerState.selection = { x: point.x, y: point.y, w: 0.01, h: 0.01 };
      drawRegionSelection();
    };
    const move = (event) => {
      if (!regionPickerState.dragging) return;
      event.preventDefault();
      const point = getPoint(event);
      const x = Math.min(regionPickerState.startX, point.x);
      const y = Math.min(regionPickerState.startY, point.y);
      const w = Math.abs(point.x - regionPickerState.startX);
      const h = Math.abs(point.y - regionPickerState.startY);
      regionPickerState.selection = clampPdfRegion({ x, y, w, h });
      drawRegionSelection();
    };
    const end = () => {
      regionPickerState.dragging = false;
      drawRegionSelection();
    };
    wrap.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    wrap.addEventListener('touchstart', start, { passive: false });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);
  }

  function drawRegionSelection() {
    const canvas = document.getElementById('regionPickerCanvas');
    const box = document.getElementById('regionSelectionBox');
    if (!canvas || !box || !regionPickerState.selection) return;
    const rect = canvas.getBoundingClientRect();
    const selected = clampPdfRegion(regionPickerState.selection);
    box.style.display = 'block';
    box.classList.toggle('grade', regionPickerState.kind === 'gradeCell');
    box.style.left = `${selected.x * rect.width}px`;
    box.style.top = `${selected.y * rect.height}px`;
    box.style.width = `${selected.w * rect.width}px`;
    box.style.height = `${selected.h * rect.height}px`;
  }

  function savePdfRegionSelection() {
    const selected = clampPdfRegion(regionPickerState.selection || {});
    if (selected.w < 0.03 || selected.h < 0.03) {
      showToast('❌ 영역이 너무 작습니다. 조금 더 크게 드래그해주세요.', true);
      return;
    }
    saveStoredPdfRegion(regionPickerState.kind, selected);
    closePdfRegionPicker();
    showToast(`✅ ${regionPickerState.kind === 'gradeCell' ? '등급칸' : '건의 체크'} 영역을 저장했습니다.`);
  }

  function useDefaultPdfRegion() {
    regionPickerState.selection = getDefaultPdfRegion(regionPickerState.kind);
    drawRegionSelection();
  }

  function closePdfRegionPicker() {
    document.getElementById('regionPickerModal')?.classList.remove('open');
  }

  function resetPdfRegionSettings() {
    localStorage.removeItem(PDF_REGION_STORAGE_KEYS.redCheck);
    localStorage.removeItem(PDF_REGION_STORAGE_KEYS.gradeCell);
    updatePdfRegionStatus();
    showToast('✅ 판독 영역을 기본값으로 되돌렸습니다.');
  }

  window.openPdfRegionPicker = openPdfRegionPicker;
  window.handleRegionPickerFile = handleRegionPickerFile;
  window.closePdfRegionPicker = closePdfRegionPicker;
  window.useDefaultPdfRegion = useDefaultPdfRegion;
  window.savePdfRegionSelection = savePdfRegionSelection;
  window.resetPdfRegionSettings = resetPdfRegionSettings;

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
        const map = { month: ['월'], date: ['접수일'], department: ['부서명'], proposer: ['제안자'], title: ['제안명'], type: ['제안구분', '구분'], grade: ['등급'], reward: ['시상금'], safety: ['안전'] };
        const colIdx = {};
        Object.keys(map).forEach(key => colIdx[key] = headers.findIndex(h => map[key].some(t => h.includes(t))));

        const records = [];
        for (let i = headerIdx + 1; i < raw.length; i++) {
          const row = raw[i];
          if (!row || !row.some(v => v !== "")) continue;
          const title = String(row[colIdx.title] || "");
          const rawSafety = String(row[colIdx.safety] || "");
          const grade = normalizeGrade(row[colIdx.grade]);
          records.push({
            month: String(row[colIdx.month] || ""),
            date: String(row[colIdx.date] || ""),
            department: formatDepartmentWithCode(row[colIdx.department]),
            proposer: stripRank(row[colIdx.proposer]),
            title,
            type: normalizeProposalType('', grade),
            grade,
            reward: rewardFromGrade(grade),
            safety: rawSafety.includes('○') ? '○' : inferSafetyMark(title)
          });
        }
        gridApi.applyTransaction({ add: records });
        kingRows = deriveKingRowsFromGrid();
        const addedAGradeCount = mergeAGradeRowsFromRecords([
          ...importedAGradeRows,
          ...records
        ]);
        saveKingToLocal();
        updateStats();
        showToast(`✅ 엑셀 ${records.length}건 추가 완료 · A급제안 ${addedAGradeCount}건 추가 저장`);
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

  function getAGradeImportKey(row) {
    const clean = value => String(value || '').toLowerCase()
      .replace(/\.[^.\\/]+$/g, '')
      .replace(/[\s\-_()[\]{}.,#~·"'“”‘’]/g, '');
    const title = clean(row.title);
    const proposer = clean(row.proposer);
    const department = clean(typeof normalizeDepartment === 'function' ? normalizeDepartment(row.department) : row.department || '');
    if (!title) return '';
    if (proposer) return `proposer-title|${proposer}|${title}`;
    if (department) return `department-title|${department}|${title}`;
    return `title|${title}`;
  }

  function getYearFromRowDate(dateValue) {
    const match = String(dateValue || '').match(/20\d{2}/);
    return match ? match[0] : String(new Date().getFullYear());
  }

  function toAGradeRegistryRow(row, no) {
    const yearText = typeof formatAGradeYear === 'function'
      ? formatAGradeYear(row.year || getYearFromRowDate(row.date))
      : `${getYearFromRowDate(row.date)}년`;
    return {
      no: String(row.no || no || ''),
      year: yearText,
      date: String(row.date || ''),
      department: normalizeDepartment(row.department),
      proposer: stripRank(row.proposer),
      title: String(row.title || '').trim(),
      type: String(row.type || '실시'),
      grade: 'A',
      reward: Number(row.reward) || rewardFromGrade('A')
    };
  }

  function mergeAGradeRowsFromRecords(records) {
    const candidates = (Array.isArray(records) ? records : [])
      .filter(row => normalizeGrade(row.grade) === 'A' && String(row.title || '').trim())
      .map(row => toAGradeRegistryRow(row));
    if (!candidates.length) return 0;

    if (!Array.isArray(aGradeRows)) aGradeRows = [];
    if (typeof dedupeAGradeRows === 'function') {
      aGradeRows = dedupeAGradeRows(aGradeRows);
    }
    const seen = new Set(aGradeRows.map(getAGradeImportKey));
    const startNo = aGradeRows.length + 1;
    let added = 0;

    candidates.forEach(row => {
      const key = getAGradeImportKey(row);
      if (!key || seen.has(key)) return;
      row.no = row.no || String(startNo + added);
      aGradeRows.push(row);
      seen.add(key);
      added += 1;
    });

    if (added > 0) {
      saveAGradeRowsToLocal();
      syncAGradeFileButtons();
    }
    return added;
  }

  function extractOpenAIResponseText(result) {
    const geminiText = (result?.candidates || [])
      .flatMap(candidate => candidate?.content?.parts || [])
      .map(part => part?.text || '')
      .filter(Boolean)
      .join('\n')
      .trim();
    if (geminiText) return geminiText;

    if (typeof result?.output_text === 'string' && result.output_text.trim()) {
      return result.output_text;
    }

    const parts = [];
    (result?.output || []).forEach(item => {
      (item?.content || []).forEach(content => {
        if (typeof content?.text === 'string') parts.push(content.text);
        if (typeof content?.output_text === 'string') parts.push(content.output_text);
      });
    });
    return parts.join('\n').trim();
  }

  function arrayBufferToBase64(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  function parseOpenAIJsonObject(rawText) {
    const stripped = String(rawText || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
      return JSON.parse(stripped);
    } catch {
      const parsedArray = extractFirstJsonValue(stripped, '[', ']');
      if (parsedArray) return parsedArray;
      const parsedObject = extractFirstJsonValue(stripped, '{', '}');
      if (parsedObject) return parsedObject;
    }
    throw new Error('AI 응답을 파싱할 수 없습니다.');
  }

  function parseOpenAIJsonRecords(rawText) {
    const stripped = String(rawText || '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
      const parsed = JSON.parse(stripped);
      const records = Array.isArray(parsed) ? parsed : parsed.records;
      if (Array.isArray(records)) return records;
    } catch {
      const parsedArray = extractFirstJsonValue(stripped, '[', ']');
      if (Array.isArray(parsedArray)) return parsedArray;
      const parsedObject = extractFirstJsonValue(stripped, '{', '}');
      if (parsedObject && Array.isArray(parsedObject.records)) return parsedObject.records;
    }
    throw new Error('AI 응답을 파싱할 수 없습니다. PDF 형식을 확인하세요.');
  }

  function extractFirstJsonValue(text, openChar, closeChar) {
    const source = String(text || '');
    let start = source.indexOf(openChar);
    while (start !== -1) {
      let depth = 0;
      let inString = false;
      let escaped = false;
      for (let i = start; i < source.length; i += 1) {
        const ch = source[i];
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === '\\') escaped = true;
          else if (ch === '"') inString = false;
          continue;
        }
        if (ch === '"') {
          inString = true;
          continue;
        }
        if (ch === openChar) depth += 1;
        if (ch === closeChar) {
          depth -= 1;
          if (depth === 0) {
            try {
              return JSON.parse(source.slice(start, i + 1));
            } catch {
              break;
            }
          }
        }
      }
      start = source.indexOf(openChar, start + 1);
    }
    return null;
  }

  async function createPdfAnalysisChunks(file, arrayBuffer) {
    const fallback = [{
      base64: arrayBufferToBase64(arrayBuffer),
      fileName: file.name || 'proposal.pdf',
      label: '전체 PDF',
      pageStart: 1
    }];

    if (!window.PDFLib?.PDFDocument) return fallback;

    try {
      const sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer);
      const pageCount = sourcePdf.getPageCount();
      const chunkSize = 10;
      if (pageCount <= chunkSize + 2) {
        return [{ ...fallback[0], label: `전체 ${pageCount}페이지`, pageStart: 1, pageEnd: pageCount, pageCount }];
      }

      const chunks = [];
      for (let start = 0; start < pageCount; start += chunkSize) {
        const end = Math.min(start + chunkSize, pageCount);
        const nextPdf = await PDFLib.PDFDocument.create();
        const copiedPages = await nextPdf.copyPages(sourcePdf, Array.from({ length: end - start }, (_, idx) => start + idx));
        copiedPages.forEach(page => nextPdf.addPage(page));
        const bytes = await nextPdf.save();
        chunks.push({
          base64: arrayBufferToBase64(bytes),
          fileName: `${(file.name || 'proposal.pdf').replace(/\.pdf$/i, '')}_${start + 1}-${end}.pdf`,
          label: `${start + 1}~${end}페이지`,
          pageStart: start + 1,
          pageEnd: end,
          pageCount
        });
      }
      return chunks;
    } catch (error) {
      console.warn('PDF 분할 실패, 전체 파일로 분석합니다:', error);
      return fallback;
    }
  }

  function dedupeImportedRecords(records) {
    const seen = new Set();
    return (Array.isArray(records) ? records : []).filter(row => {
      const key = [
        String(row.date || '').replace(/\D/g, ''),
        normalizeDepartment(row.department),
        stripRank(row.proposer),
        String(row.rawTitle || row.title || '').replace(/\s/g, '').toLowerCase()
      ].join('|');
      if (!String(row.rawTitle || row.title || '').trim()) return false;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getRecordMatchKey(row) {
    return [
      String(row.pageNo || '').trim(),
      String(row.date || '').replace(/\D/g, ''),
      String(row.rawTitle || row.title || '').replace(/\s/g, '').toLowerCase()
    ].join('|');
  }

  async function renderGradeRegionImagesForPages(arrayBuffer, pageNumbers, options = {}) {
    if (!window.pdfjsLib?.getDocument) return new Map();

    const wanted = [...new Set((pageNumbers || []).map(Number).filter(pageNo => Number.isFinite(pageNo) && pageNo > 0))];
    if (!wanted.length) return new Map();

    configurePdfJsWorker();

    const pdf = await window.pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer.slice(0)),
      disableWorker: true
    }).promise;
    const imageMap = new Map();

    for (const pageNo of wanted) {
      if (pageNo > pdf.numPages) continue;
      const page = await pdf.getPage(pageNo);
      const viewport = page.getViewport({ scale: 3 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;

      // 사용자가 지정한 등급칸 영역이 있으면 그 박스만, 없으면 기본 상단 행을 확대합니다.
      const region = getPdfRegions('gradeCell')[0];
      const sx = Math.floor(canvas.width * region.x);
      const sy = Math.floor(canvas.height * region.y);
      const sw = Math.floor(canvas.width * region.w);
      const sh = Math.floor(canvas.height * region.h);
      const crop = document.createElement('canvas');
      crop.width = sw * 2;
      crop.height = sh * 2;
      const cropContext = crop.getContext('2d');
      cropContext.imageSmoothingEnabled = false;
      cropContext.fillStyle = '#fff';
      cropContext.fillRect(0, 0, crop.width, crop.height);
      cropContext.drawImage(canvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
      imageMap.set(pageNo, options.includeCanvas ? { dataUrl: crop.toDataURL('image/png'), canvas: crop } : crop.toDataURL('image/png'));
    }

    return imageMap;
  }

  function hasRedPixelsInCanvas(canvas, options = {}) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    let redCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r >= 120 && r - g >= 25 && r - b >= 25 && r > g * 1.12 && r > b * 1.12) {
        redCount += 1;
      }
    }
    const minPixels = options.minPixels ?? 18;
    const minRatio = options.minRatio ?? 0.00025;
    return redCount >= minPixels && redCount / (canvas.width * canvas.height) >= minRatio;
  }
  function hasRedCheckMarkInCanvas(canvas, options = {}) {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    const { width, height } = canvas;
    const image = context.getImageData(0, 0, width, height);
    const data = image.data;
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        if (r >= 170 && g <= 105 && b <= 105 && r - g >= 60 && r - b >= 60 && r > g * 1.45 && r > b * 1.45) {
          mask[y * width + x] = 1;
        }
      }
    }

    const visited = new Uint8Array(width * height);
    const stack = [];
    const minPixels = options.minPixels ?? 70;
    const minBoxWidth = options.minBoxWidth ?? 18;
    const minBoxHeight = options.minBoxHeight ?? 18;
    const maxBoxRatio = options.maxBoxRatio ?? 7;

    for (let start = 0; start < mask.length; start += 1) {
      if (!mask[start] || visited[start]) continue;
      visited[start] = 1;
      stack.length = 0;
      stack.push(start);
      let count = 0;
      let minX = width;
      let maxX = 0;
      let minY = height;
      let maxY = 0;
      while (stack.length) {
        const current = stack.pop();
        const x = current % width;
        const y = Math.floor(current / width);
        count += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        const neighbors = [current - 1, current + 1, current - width, current + width];
        for (const next of neighbors) {
          if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
          const nx = next % width;
          if (Math.abs(nx - x) > 1) continue;
          visited[next] = 1;
          stack.push(next);
        }
      }
      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const ratio = Math.max(boxWidth / Math.max(boxHeight, 1), boxHeight / Math.max(boxWidth, 1));
      if (count >= minPixels && boxWidth >= minBoxWidth && boxHeight >= minBoxHeight && ratio <= maxBoxRatio) {
        return true;
      }
    }
    return false;
  }

  function inferGradeFromCropCanvas(canvas) {
    const context = canvas?.getContext?.('2d', { willReadFrequently: true });
    if (!context) return '';
    const { width, height } = canvas;
    const image = context.getImageData(0, 0, width, height);
    const data = image.data;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let darkCount = 0;
    const columnDark = new Array(width).fill(0);
    const rowDark = new Array(height).fill(0);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const luminance = (r * 0.299) + (g * 0.587) + (b * 0.114);
        if (luminance < 120) {
          darkCount += 1;
          columnDark[x] += 1;
          rowDark[y] += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (darkCount < 35) return '';
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    if (boxWidth <= 0 || boxHeight <= 0) return '';
    const density = darkCount / (boxWidth * boxHeight);
    const leftLimit = minX + Math.max(2, Math.floor(boxWidth * 0.28));
    let leftStroke = 0;
    for (let x = minX; x <= leftLimit; x += 1) {
      leftStroke = Math.max(leftStroke, columnDark[x] || 0);
    }
    let topBowl = 0;
    let bottomBowl = 0;
    const midY = minY + Math.floor(boxHeight * 0.5);
    const rightStart = minX + Math.floor(boxWidth * 0.42);
    for (let y = minY; y <= maxY; y += 1) {
      let rightPixels = 0;
      for (let x = rightStart; x <= maxX; x += 1) {
        const offset = (y * width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const luminance = (r * 0.299) + (g * 0.587) + (b * 0.114);
        if (luminance < 120) rightPixels += 1;
      }
      if (y < midY) topBowl = Math.max(topBowl, rightPixels);
      else bottomBowl = Math.max(bottomBowl, rightPixels);
    }
    const strongLeftStroke = leftStroke >= boxHeight * 0.38;
    const twoRightLobes = topBowl >= boxWidth * 0.18 && bottomBowl >= boxWidth * 0.18;
    const looksLikeB = boxHeight >= 18 && boxWidth >= 12 && density >= 0.08 && strongLeftStroke && twoRightLobes;
    return looksLikeB ? 'B' : '';
  }

  async function detectRedGradeMarksForPages(arrayBuffer, pageNumbers) {
    if (!window.pdfjsLib?.getDocument) return new Map();

    const wanted = [...new Set((pageNumbers || []).map(Number).filter(pageNo => Number.isFinite(pageNo) && pageNo > 0))];
    if (!wanted.length) return new Map();

    configurePdfJsWorker();

    const pdf = await window.pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer.slice(0)),
      disableWorker: true
    }).promise;
    const redMap = new Map();

    for (const pageNo of wanted) {
      if (pageNo > pdf.numPages) continue;
      const page = await pdf.getPage(pageNo);
      const viewport = page.getViewport({ scale: 3 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;

      // 건의 제안은 사용자가 "개선안" 영역에 빨간 체크를 표시해 둔 문서입니다.
      // 넓은 영역의 빨간 잡색/도장까지 건의로 오인하지 않도록, 개선안 영역의 체크 덩어리만 봅니다.
      const regions = getPdfRegions('redCheck');
      const hasRedMark = regions.some(region => {
        const sx = Math.floor(canvas.width * region.x);
        const sy = Math.floor(canvas.height * region.y);
        const sw = Math.floor(canvas.width * region.w);
        const sh = Math.floor(canvas.height * region.h);
        const crop = document.createElement('canvas');
        crop.width = sw;
        crop.height = sh;
        const cropContext = crop.getContext('2d', { willReadFrequently: true });
        cropContext.fillStyle = '#fff';
        cropContext.fillRect(0, 0, crop.width, crop.height);
        cropContext.drawImage(canvas, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
        return hasRedCheckMarkInCanvas(crop, {
          minPixels: 90,
          minBoxWidth: 16,
          minBoxHeight: 10,
          maxBoxRatio: 8
        });
      });
      redMap.set(pageNo, hasRedMark);
    }

    return redMap;
  }

  function shouldAcceptGradeAudit(originalGrade, auditedGrade, confidence = '') {
    const original = normalizeGrade(originalGrade);
    const audited = normalizeGrade(auditedGrade);
    if (!audited && original === 'C') return true;
    if (!audited || audited === original) return false;
    if (!ANALYSIS_GRADE_CANDIDATES.includes(audited)) return false;
    if (original && !ANALYSIS_GRADE_CANDIDATES.includes(original)) return true;
    if (!original) return ['high', 'medium'].includes(String(confidence || '').toLowerCase());
    if (['A', 'B'].includes(audited)) return String(confidence || '').toLowerCase() === 'high';
    if (original !== 'C') return true;
    if (audited === 'C') return false;
    if (['A', 'B'].includes(audited)) return false;
    return String(confidence || '').toLowerCase() === 'high';
  }

  async function auditAmbiguousGrades({ key, arrayBuffer, chunk, records, provider = getAnalysisProvider() }) {
    const targets = (Array.isArray(records) ? records : [])
      .filter(row => shouldAuditGrade(row.grade))
      .map(row => ({
        pageNo: Number(row.pageNo || 0),
        absolutePageNo: Number(chunk?.pageStart || 1) + Number(row.pageNo || 0) - 1,
        date: row.date || '',
        proposer: row.proposer || '',
        title: row.rawTitle || row.title || ''
      }))
      .filter(row => Number.isFinite(row.pageNo) && row.pageNo > 0 && Number.isFinite(row.absolutePageNo) && row.absolutePageNo > 0);
    if (!targets.length) return records;

    const imageMap = await renderGradeRegionImagesForPages(arrayBuffer, targets.map(row => row.absolutePageNo), { includeCanvas: true });
    const images = targets
      .map((row, index) => {
        const rendered = imageMap.get(row.absolutePageNo);
        return {
          candidateNo: index + 1,
          pageNo: row.pageNo,
          absolutePageNo: row.absolutePageNo,
          title: row.title,
          imageDataUrl: typeof rendered === 'string' ? rendered : rendered?.dataUrl,
          ruleGrade: typeof rendered === 'string' ? '' : inferGradeFromCropCanvas(rendered?.canvas)
        };
      })
      .filter(row => row.imageDataUrl);
    if (!images.length) return records;

    const auditPrompt = `아래 이미지는 제안서 상단의 "등급값 칸"만 최대한 좁게 잘라 확대한 것입니다.
목표는 오직 이 작은 칸 안의 등급 문자만 다시 읽는 것입니다. 다른 항목은 읽지 마세요.

판정 순서:
1. 이 재확인 단계에서는 건의를 판정하지 마세요. 건의는 별도의 빨간 체크 감지 로직이 최종으로 덮어씁니다.
2. 여기서는 등급칸 안의 A, B, 참가, C만 판단하세요.
3. 이미지에 주변 글자나 선이 조금 들어와도, 등급값 칸 안의 가장 큰 손글씨/인쇄 등급 문자만 읽으세요.
4. 등급칸 안에 영문 A 한 글자가 명확하게 보일 때만 "A"입니다. 비슷한 선/체크/한글 일부를 A로 추정하지 마세요.
5. 등급칸 안에 영문 B 한 글자가 명확하게 보이면 "B"입니다. 손글씨 B가 굵거나 기울어져도 세로획과 오른쪽 둥근 획이 보이면 B로 인정하세요.
6. "참가"라는 한글 두 글자가 명확하게 보이면 "참가"입니다.
7. 등급칸 안에 C처럼 열린 둥근 영문 한 글자가 보이면 반드시 "C"입니다.
8. 등급칸 중앙에 B처럼 보이는 굵은 손글씨가 있으면 C로 낮추지 말고 B로 입력하세요.
9. A/B/참가가 확실하지 않으면 "C"로 입력하세요.
10. 등급 후보는 반드시 A, B, 참가, C 중 하나입니다. 건의, 채택, 숫자 5, 5S, 공무, 단순, 보류, 중복은 이번 재확인에서 사용하지 마세요.
11. "채택일"이라는 인쇄 글자는 날짜 라벨이므로 등급이 아닙니다.

[다시 확인할 후보]
${JSON.stringify(images.map(({ imageDataUrl, ...row }) => row), null, 2)}

등급 후보는 A, B, 참가, C 중 하나입니다.
응답은 JSON 배열만:
[{"candidateNo":1,"pageNo":1,"absolutePageNo":11,"grade":"C","confidence":"high","evidence":"등급 칸 값"}]`;

    const result = await requestOpenAIGradeImageAudit({
      key,
      prompt: auditPrompt,
      images,
      provider
    });
    const parsed = parseOpenAIJsonObject(extractOpenAIResponseText(result));
    const auditRows = Array.isArray(parsed) ? parsed : parsed.records;
    const auditMap = new Map();
    images.forEach(image => {
      if (image.ruleGrade) {
        auditMap.set(image.candidateNo, { grade: image.ruleGrade, confidence: 'high' });
      }
    });
    (Array.isArray(auditRows) ? auditRows : []).forEach(row => {
      const grade = normalizeGrade(row.grade);
      if (![...ANALYSIS_GRADE_CANDIDATES, ''].includes(grade)) return;
      const candidateNo = Number(row.candidateNo);
      if (!Number.isFinite(candidateNo)) return;
      if (auditMap.get(candidateNo)?.grade === 'B') return;
      auditMap.set(candidateNo, {
        grade,
        confidence: String(row.confidence || '').toLowerCase()
      });
    });

    return records.map(row => {
      const pageNo = Number(row.pageNo || 0);
      const foundTargetIndex = targets.findIndex(target => target.pageNo === pageNo && String(target.title || '').replace(/\s/g, '') === String(row.rawTitle || row.title || '').replace(/\s/g, ''));
      const fallbackTargetIndex = foundTargetIndex >= 0 ? foundTargetIndex : targets.findIndex(target => target.pageNo === pageNo);
      const audit = auditMap.get(fallbackTargetIndex + 1);
      if (!audit || !shouldAcceptGradeAudit(row.grade, audit.grade, audit.confidence)) return row;
      return { ...row, grade: audit.grade };
    });
  }

  async function requestOpenAIResponses({ key, body }) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error?.message || result.message || `OpenAI HTTP ${response.status}`);
    }
    return result;
  }

  async function requestOpenAIGradeImageAudit({ key, prompt, images, provider = getAnalysisProvider() }) {
    const payload = {
      apiKey: key,
      provider,
      prompt,
      images: (images || []).map(image => ({
        candidateNo: image.candidateNo,
        pageNo: image.pageNo,
        absolutePageNo: image.absolutePageNo,
        title: image.title,
        imageDataUrl: image.imageDataUrl
      })),
      model: provider === 'openai' ? OPENAI_MODEL : GEMINI_MODEL
    };

    if (window.desktopApp?.analyzeProposalImageWithGPT) {
      return window.desktopApp.analyzeProposalImageWithGPT(payload);
    }

    if (location.protocol === 'http:' || location.protocol === 'https:') {
      const serverResponse = await fetch('/api/proposal-gpt/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const serverResult = await serverResponse.json().catch(() => ({}));
      if (!serverResponse.ok) {
        throw new Error(serverResult.error?.message || serverResult.message || `HTTP ${serverResponse.status}`);
      }
      return serverResult;
    }

    if (provider === 'openai') {
      return requestOpenAIResponses({
        key,
        body: {
          model: OPENAI_MODEL,
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              ...(images || []).flatMap(image => ([
                { type: 'input_text', text: `[후보 ${image.candidateNo}] pageNo=${image.pageNo}, absolutePageNo=${image.absolutePageNo}, title=${image.title || ''}` },
                { type: 'input_image', image_url: image.imageDataUrl }
              ]))
            ]
          }],
          temperature: 0,
          max_output_tokens: 4000
        }
      });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            ...(images || []).flatMap(image => {
              const base64 = String(image.imageDataUrl || '').replace(/^data:image\/\w+;base64,/, '');
              return [
                { text: `[후보 ${image.candidateNo}] pageNo=${image.pageNo}, absolutePageNo=${image.absolutePageNo}, title=${image.title || ''}` },
                { inlineData: { mimeType: 'image/png', data: base64 } }
              ];
            })
          ]
        }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 4000
        }
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error?.message || result.message || `HTTP ${response.status}`);
    }
    return result;
  }

  async function requestOpenAIPdfAnalysis({ key, base64, prompt, fileName, provider = getAnalysisProvider() }) {
    const payload = {
      apiKey: key,
      provider,
      base64,
      prompt,
      model: provider === 'openai' ? OPENAI_MODEL : GEMINI_MODEL,
      fileName: fileName || 'proposal.pdf'
    };

    if (window.desktopApp?.analyzeProposalPdfWithGPT) {
      return window.desktopApp.analyzeProposalPdfWithGPT(payload);
    }

    if (location.protocol === 'http:' || location.protocol === 'https:') {
      const serverResponse = await fetch('/api/proposal-gpt/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const serverResult = await serverResponse.json().catch(() => ({}));
      if (!serverResponse.ok) {
        throw new Error(serverResult.error?.message || serverResult.message || `HTTP ${serverResponse.status}`);
      }
      return serverResult;
    }

    if (provider === 'openai') {
      return requestOpenAIResponses({
        key,
        body: {
          model: OPENAI_MODEL,
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              {
                type: 'input_file',
                filename: fileName || 'proposal.pdf',
                file_data: `data:application/pdf;base64,${base64}`
              }
            ]
          }],
          temperature: 0.1,
          max_output_tokens: 16000
        }
      });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: base64 } },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16000
        }
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error?.message || result.message || `HTTP ${response.status}`);
    }
    return result;
  }

  // ── [핵심] Gemini API로 PDF 분석 ──
  async function processPDF(file) {
    const key = (document.getElementById('apiKey')?.value || '').trim();
    const provider = getAnalysisProvider();
    const providerLabel = provider === 'openai' ? `GPT(${OPENAI_MODEL})` : `Gemini(${GEMINI_MODEL})`;
    pendingPdfFile = file;
    if (!key) {
      toggleAnalysisPanel(true);
      const input = document.getElementById('apiKey');
      if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast(`❌ ${provider === 'openai' ? 'OpenAI' : 'Gemini'} API Key를 먼저 입력해주세요. 입력 후 Enter나 바깥 클릭을 하면 방금 PDF를 바로 다시 분석합니다.`, true);
      return;
    }

    setLoading(true, `PDF를 ${providerLabel} AI가 분석 중...`, '표 데이터를 추출하고 있습니다');
    isPdfAnalysisRunning = true;

    try {
      // PDF → 페이지 묶음으로 분할해서 대량 PDF 누락을 줄입니다.
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('파일 읽기 실패'));
        reader.readAsArrayBuffer(file);
      });
      let chunks = await createPdfAnalysisChunks(file, arrayBuffer);
      const pdfPageCount = await getPdfPageCountForAnalysis(arrayBuffer);
      if (pdfPageCount > 0 && chunks.length === 1 && !chunks[0].pageEnd) {
        chunks = [{ ...chunks[0], pageStart: 1, pageEnd: pdfPageCount, pageCount: pdfPageCount, label: `전체 ${pdfPageCount}페이지` }];
      }

      setLoading(true, `${providerLabel} 분석 준비 중...`, chunks.length > 1 ? `${chunks.length}개 묶음으로 나눠 분석합니다` : '잠시만 기다려주세요');

      const prompt = `이 PDF는 개선제안서 모음입니다. 각 페이지가 보통 제안서 1건입니다.
중요: 이번 묶음의 모든 페이지를 처음부터 끝까지 확인하세요. 앞쪽 페이지를 건너뛰지 마세요.
제목이 "제안서"이고 접수일/부서/제안자/제안명/검토부서/등급 칸이 보이면 반드시 1건으로 추출하세요.
완전히 다른 문서(裏議書/품의서, 구매요청서 등)만 제외하세요. 스캔 품질이 낮아 일부 필드가 안 보여도 제안서이면 빈칸으로라도 1건을 출력하세요.

각 제안서에서 다음 필드를 추출하여 JSON 배열로만 응답하세요:
- pageNo: 이번 PDF 묶음 안에서 보이는 페이지 순서. 정확히 모르겠으면 0
- month: 접수일에서 월 추출 (예: "2월")
- date: 접수일 (예: "2026.02.26")
- department: 부서명 (손글씨라도 최대한 정확히. 단, "공무", "공무팀", "공무과", "공무부" 및 비슷하게 보이는 "궁무", "공므", "공뮤"는 반드시 "공무팀"으로, "분산QC"는 반드시 "품질관리부"로, "에스이엠", "S.E.M.", "SEM"은 반드시 "SEM"으로 표준화. 예: "생산 1부"→"생산 1부", "분산QC"→"품질관리부", "품질관리부"→"품질관리부", "S.E.M."→"SEM", "에스이엠"→"SEM", "공무과"→"공무팀", "궁무"→"공무팀", "물류관리팀"→"물류관리팀", "환경관리과"→"환경관리과", "생산 2부"→"생산 2부", "총무과"→"총무과")
- proposer: 제안자 이름만 (직급 제외. "오진영 대리"→"오진영", "신은식 과장"→"신은식", "김경수"→"김경수")
- type: 문서의 제안구분 체크박스는 읽지 말고, grade 기준으로만 판단. grade가 A/B/C이면 반드시 "실시", 건의는 반드시 "아이디어".
- rawTitle: 제안명 원문 전체
- currentState: 현재상태 원문 핵심
- improvement: 개선안 원문 핵심
- redCheck: 참고값입니다. 앱이 별도 감지한 빨간 체크 페이지가 최종 기준입니다.
- title: 아래 규칙으로 만든 짧은 요약문
  * 반드시 제안명 + 현재상태 + 개선안을 함께 반영
  * 길이 42~50자 정도
  * 제안 의도와 개선 효과가 보이게, 너무 성의 없이 줄이지 말 것
  * 불필요한 배경 설명은 빼고 한 문장으로 자연스럽게 요약
  * 단순히 제안명만 그대로 쓰지 말 것
  * 예시: "원자재 폐기 분진 노출 예방 마스크 비치"
- grade: 아래 순서 그대로만 판단하세요. 추측 금지.
  1. 앱이 이번 요청 아래에 제공한 "빨간 체크 감지 페이지" 목록에 현재 페이지가 있으면 grade="건의"입니다.
  2. 그 목록에 없는 페이지는 AI가 빨간색을 봤다고 추측하지 말고, 상단 표의 "등급" 칸 하나만 읽습니다.
  3. 빨간색 도장, 빨간 잡색, 사진 속 색, 하단 표시, 서명은 grade 판단에 사용하지 않습니다.
  4. 등급칸 안에 영문 A 한 글자가 명확하면 "A"입니다.
  5. 등급칸 안에 영문 B 한 글자가 명확하면 "B"입니다. T/S, S.E.M, 부서명, 서명, 도장 모양을 B로 보지 마세요.
  6. 등급칸 안에 한글 "참가" 두 글자가 명확하면 "참가"입니다.
  7. 빨간 펜 체크가 없고 A/B/참가가 아니면 전부 "C"입니다.
  8. "채택일"은 날짜 라벨입니다. "채택"을 grade로 쓰지 마세요.
  9. 가능한 grade 값은 A, B, 참가, 건의, C만 허용합니다. 5, 5S, 공무, 단순, 보류, 중복, 채택은 쓰지 마세요.
- reward: grade 기준으로 계산. A=50000, B=20000, C=5000, 참가=2000, 건의=0.
- safety: 아래 조건 중 하나라도 해당하면 "○", 아니면 ""
  1. 검토의견란에 "■ 아차사고·위험요소발굴" 또는 "■ 위험요소 발굴/개선"에 ■(검게 채워진 네모) 체크
  2. 제안유형에 "■ 안전개선" 체크
  3. 제안내용이 낙하·추락·충돌·화재·폭발·감전·끼임·화상·누출·안전사고 예방 등 안전과 직접 관련된 경우

반드시 순수 JSON 배열만 출력. 마크다운, 코드블록, 설명 없이.
예: [
{"pageNo":1,"month":"2월","date":"2026.02.26","department":"생산 1부","proposer":"공대영","type":"아이디어","rawTitle":"S.D 전 호기 집진노즐 확인용 클램프타입 간이 점검구 설치 건","currentState":"집진노즐 상태를 확인하려면 설비를 분해해야 해서 점검이 불편함","improvement":"클램프타입 간이 점검구를 설치해 분해 없이 확인 가능하도록 개선","redCheck":true,"title":"집진노즐 분해 점검 불편을 줄이고 확인 시간을 단축한 간이 점검구 설치","grade":"건의","reward":0,"safety":"○"},
{"pageNo":2,"month":"2월","date":"2026.02.23","department":"SEM","proposer":"오진영","type":"실시","rawTitle":"소핑제 사용 규격 표시","currentState":"현장에서 소핑제 사용 기준이 명확하지 않아 혼선이 있음","improvement":"규격을 눈에 띄게 표시해 누구나 바로 확인 가능하도록 개선","redCheck":false,"title":"소핑제 사용 기준을 표시해 작업자 확인성과 현장 사용 혼선을 개선","grade":"C","reward":5000,"safety":""},
{"pageNo":3,"month":"2월","date":"2026.02.26","department":"생산 2부","proposer":"정강민","type":"실시","rawTitle":"DO2~DO3 색소 저장탱크 H빔 충돌방지 개선 건","currentState":"저장탱크 주변 H빔과 작업 동선 충돌 위험이 있음","improvement":"충돌방지 구조를 보강해 작업 중 접촉 위험을 줄임","redCheck":false,"title":"저장탱크 주변 H빔 충돌 위험을 줄이기 위한 방지 구조 보강","grade":"C","reward":5000,"safety":""}
]`;

      let records = [];
      let fullRedGradeMap = new Map();
      try {
        const allPages = pdfPageCount > 0
          ? Array.from({ length: pdfPageCount }, (_, pageIndex) => pageIndex + 1)
          : chunks.flatMap(chunk => getAbsolutePagesForChunk(chunk));
        fullRedGradeMap = await detectRedGradeMarksForPages(arrayBuffer, allPages);
        const redPages = [...fullRedGradeMap.entries()]
          .filter(([, hasRed]) => hasRed)
          .map(([pageNo]) => pageNo);
        if (redPages.length) {
          console.log('개선안 빨간 체크 감지 페이지:', redPages);
        }
      } catch (redPreDetectError) {
        console.warn('전체 빨간 체크 사전 감지 실패:', redPreDetectError);
      }

      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index];
        const chunkPages = getAbsolutePagesForChunk(chunk);
        const redPagesInChunk = chunkPages.filter(pageNo => fullRedGradeMap.get(pageNo));
        setLoading(
          true,
          `${providerLabel} 분석 중... ${index + 1}/${chunks.length}`,
          `${chunk.label} 처리 중${chunk.pageCount ? ` · 전체 ${chunk.pageCount}페이지` : ''}${redPagesInChunk.length ? ` · 빨간체크 ${redPagesInChunk.length}페이지 먼저 건의 확정` : ''}`
        );
        let result;
        try {
          result = await requestOpenAIPdfAnalysis({
            key,
            base64: chunk.base64,
            provider,
            prompt: `${prompt}\n\n[이번 요청의 분석 범위]\n- ${chunk.label}만 분석하세요.\n- 이 묶음은 최대 10페이지이며, 마지막 묶음은 남은 페이지만 포함될 수 있습니다.\n- 각 페이지를 순서대로 확인하고, 제안서 페이지는 빠짐없이 모두 JSON 배열에 넣으세요.\n- 특히 이 묶음의 첫 번째 페이지를 절대 건너뛰지 마세요.\n- 앞/뒤 묶음의 페이지는 추측해서 추가하지 마세요.\n- 아래 절대 페이지 번호는 앱이 개선안 빨간 체크를 먼저 감지한 페이지입니다: ${redPagesInChunk.length ? redPagesInChunk.join(', ') : '없음'}\n- 위 빨간 체크 감지 페이지에 해당하는 제안서는 등급칸을 판단하지 말고 grade를 반드시 "건의"로 입력하세요.`,
            fileName: chunk.fileName
          });
        } catch (apiError) {
          const msg = apiError?.message || 'Gemini API 요청 실패';
          // 메시지 내용 우선 판단 (상태코드보다 정확)
          if (msg.toLowerCase().includes('invalid api key') || msg.toLowerCase().includes('incorrect api key') || msg.toLowerCase().includes('unauthorized')) {
            throw new Error(`${provider === 'openai' ? 'OpenAI' : 'Gemini'} API 키가 올바르지 않습니다. 새 키를 확인해주세요.`);
          }
          const lowerMsg = msg.toLowerCase();
          if (
            lowerMsg.includes('insufficient_quota') ||
            lowerMsg.includes('exceeded your current quota') ||
            lowerMsg.includes('billing') ||
            lowerMsg.includes('credit')
          ) {
            throw new Error(`${provider === 'openai' ? 'OpenAI' : 'Gemini'} API 사용량 한도가 부족합니다. 결제/할당량을 확인해주세요.`);
          }
          if (lowerMsg.includes('rate limit') || lowerMsg.includes('too many requests') || lowerMsg.includes('requests per')) {
            throw new Error(`${provider === 'openai' ? 'OpenAI' : 'Gemini'} 요청이 잠시 몰렸습니다. 1~2분 후 다시 시도하세요.`);
          }
          if (msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('cors')) {
            throw new Error(`브라우저에서 ${provider === 'openai' ? 'OpenAI' : 'Gemini'} 직접 호출이 막혔습니다. 설치형 앱으로 실행하거나 로컬 서버 주소에서 다시 시도해주세요.`);
          }
          throw new Error(msg);
        }

        const rawText = extractOpenAIResponseText(result);
        console.log(`${providerLabel} 원본응답 ${index + 1}/${chunks.length}:`, rawText);
        if (!rawText) throw new Error(`${chunk.label} AI 응답이 비어 있습니다. PDF 내용을 확인하세요.`);
        let chunkRecords = parseOpenAIJsonRecords(rawText);
        chunkRecords = chunkRecords.map((row, rowIndex) => {
          const absolutePageNo = getAbsolutePageNoForRecord(row, rowIndex, chunk);
          return fullRedGradeMap.get(absolutePageNo)
            ? { ...row, _absolutePageNo: absolutePageNo, _redGradeDetected: true, grade: '건의' }
            : { ...row, _absolutePageNo: absolutePageNo };
        });
        const needsGradeAudit = chunkRecords.some(row => !row._redGradeDetected && shouldAuditGrade(row.grade));
        if (needsGradeAudit) {
          setLoading(true, `등급칸 확대 재확인 중... ${index + 1}/${chunks.length}`, `${chunk.label}의 A/B/참가/C 등급칸만 잘라서 다시 봅니다`);
          try {
            const auditTargets = chunkRecords.filter(row => !row._redGradeDetected);
            const auditedRecords = await auditAmbiguousGrades({ key, arrayBuffer, chunk, records: auditTargets, provider });
            let auditIndex = 0;
            chunkRecords = chunkRecords.map(row => row._redGradeDetected ? row : auditedRecords[auditIndex++] || row);
          } catch (auditError) {
            console.warn('등급 재확인 실패, 1차 결과를 사용합니다:', auditError);
          }
        }
        try {
          const redCheckPages = [
            ...getAbsolutePagesForChunk(chunk),
            ...chunkRecords.map((row, rowIndex) => getAbsolutePageNoForRecord(row, rowIndex, chunk))
          ].filter(pageNo => Number.isFinite(pageNo) && pageNo > 0);
          const redGradeMap = await detectRedGradeMarksForPages(arrayBuffer, redCheckPages);
          redGradeMap.forEach((hasRed, pageNo) => {
            if (hasRed) fullRedGradeMap.set(pageNo, true);
          });
          chunkRecords = chunkRecords.map((row, rowIndex) => {
            const absolutePageNo = getAbsolutePageNoForRecord(row, rowIndex, chunk);
            const redGradeDetected = redGradeMap.get(absolutePageNo) || fullRedGradeMap.get(absolutePageNo);
            return redGradeDetected
              ? { ...row, _absolutePageNo: absolutePageNo, _redGradeDetected: true, grade: '건의' }
              : { ...row, _absolutePageNo: absolutePageNo };
          });
        } catch (redDetectError) {
          console.warn('빨간 체크 감지 실패, AI 결과를 사용합니다:', redDetectError);
        }
        records = records.concat(chunkRecords);
      }
      records = dedupeImportedRecords(records);

      if (!Array.isArray(records) || records.length === 0) {
        throw new Error('추출된 데이터가 없습니다. PDF에 표 데이터가 있는지 확인하세요.');
      }

      // 데이터 정제
      const cleaned = records.map((r, recordIndex) => {
        const rawTitle = String(r.rawTitle || r.title || '');
        const currentState = String(r.currentState || '').trim();
        const improvement = String(r.improvement || '').trim();
        const summary = String(r.title || '').trim();
        const fallbackSummary = [rawTitle, currentState, improvement]
          .filter(Boolean)
          .join(' / ');
        const absolutePageNo = Number(r._absolutePageNo || r.pageNo || 0);
        const orderPageNo = recordIndex + 1;
        const redGradeDetected = r._redGradeDetected || fullRedGradeMap.get(absolutePageNo) || fullRedGradeMap.get(orderPageNo);
        const grade = redGradeDetected ? '건의' : coerceAnalysisGrade(r.grade);

        return ({
        month: String(r.month || ''),
        date: String(r.date || ''),
        department: formatDepartmentWithCode(r.department),
        proposer: stripRank(r.proposer),
        title: compactProposalSummary(summary, [rawTitle, currentState, improvement]),
        type: normalizeProposalType('', grade),
        grade,
        reward: normalizeRewardByGrade(grade),
        safety: (r.safety === '○' || r.safety === 'O' || r.safety === 'o' || r.safety === true || r.safety === 1 || String(r.safety||'').includes('○') || String(r.safety||'').includes('위험') || String(r.safety||'').includes('아차')) ? '○' : ''
      })});

      gridApi.applyTransaction({ add: cleaned });
      const addedAGradeCount = mergeAGradeRowsFromRecords(cleaned);
      const redGradeCount = [...fullRedGradeMap.values()].filter(Boolean).length;
      updateStats();
      pendingPdfFile = null;
      showToast(`✅ 분석 완료: ${cleaned.length}건 추가됨 · 빨간체크 ${redGradeCount}페이지 건의 고정 · A급제안 ${addedAGradeCount}건 저장`);

    } catch (err) {
      console.error('PDF 분석 오류:', err);
      showToast(`❌ 분석 실패: ${err.message}`, true);
    } finally {
      isPdfAnalysisRunning = false;
      setLoading(false);
    }
  }

  function addNewRow() {
    const activeTab = document.getElementById('monthSelect').value;
    const row = {
      month: activeTab === '전체' ? "" : activeTab,
      title: '새 제안',
      type: '실시',
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

