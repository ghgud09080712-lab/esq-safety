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
  const DEPT_ALIAS = { '분산QC': '품질관리부' };
  function normDept(d) { return DEPT_ALIAS[d] || d; }

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

  // 등급 수가 많아질수록 한 화면에 보이도록 열 폭을 조금 더 촘촘하게 조정
  const compactLevel = activeGrades.length >= 7 ? 'tight' : activeGrades.length >= 5 ? 'compact' : 'regular';
  const widthPreset = compactLevel === 'tight'
    ? { dept: 96, proposer: 68, count: 34, reward: 58, totalCount: 46, totalReward: 72 }
    : compactLevel === 'compact'
      ? { dept: 104, proposer: 72, count: 36, reward: 62, totalCount: 48, totalReward: 76 }
      : { dept: 112, proposer: 76, count: 38, reward: 66, totalCount: 50, totalReward: 78 };
  const gradeColsWidth = activeGrades.map(() =>
    `<col style="width:${widthPreset.count}px"><col style="width:${widthPreset.reward}px">`
  ).join('');

  document.getElementById('rv-body').innerHTML = `
    <div class="rv-table-wrap rv-table-wrap-${compactLevel}">
      <table class="rv-table rv-table-${compactLevel}">
        <colgroup>
          <col style="width:${widthPreset.dept}px">
          <col style="width:${widthPreset.proposer}px">
          ${gradeColsWidth}
          <col style="width:${widthPreset.totalCount}px">
          <col style="width:${widthPreset.totalReward}px">
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

