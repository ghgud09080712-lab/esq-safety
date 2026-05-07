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

  function getExcelExportFilename() {
    const today = new Date().toISOString().slice(0, 10);
    return '개선제안_제출현황_' + today + '.xlsx';
  }

  function downloadExcelBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function buildClientExcelBlob(rows) {
    if (!window.XLSX) throw new Error('엑셀 라이브러리를 불러오지 못했습니다.');

    const headers = ['NO', '월', '접수일', '부서명', '제안자', '제안명', '등급', '시상금', '안전'];
    const exportRows = rows.map((row, index) => ({
      NO: index + 1,
      월: row.month || '',
      접수일: row.date || '',
      부서명: row.department || '',
      제안자: row.proposer || '',
      제안명: row.title || '',
      등급: typeof normalizeGrade === 'function' ? normalizeGrade(row.grade) : (row.grade || ''),
      시상금: Number(row.reward) || 0,
      안전: row.safety === '○' ? '○' : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows, { header: headers });
    ws['!cols'] = [
      { wch: 6 },
      { wch: 8 },
      { wch: 12 },
      { wch: 16 },
      { wch: 12 },
      { wch: 70 },
      { wch: 8 },
      { wch: 12 },
      { wch: 8 }
    ];

    const rewardCol = 'H';
    for (let rowIndex = 2; rowIndex <= exportRows.length + 1; rowIndex++) {
      const cell = ws[rewardCol + rowIndex];
      if (cell) cell.z = '#,##0"원"';
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '제출현황');
    const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function shouldUseServerExcelExport() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  async function exportToExcel() {
    const rows = [];
    gridApi.forEachNodeAfterFilterAndSort(node => rows.push(node.data));

    if (!rows.length) {
      showToast('내보낼 데이터가 없습니다.', true);
      return;
    }

    const filename = getExcelExportFilename();
    setLoading(true, '엑셀 저장 중...', '파일을 만드는 중입니다.');
    try {
      if (shouldUseServerExcelExport()) {
        try {
          const response = await fetch('/api/export/excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows })
          });

          if (!response.ok) {
            let message = '엑셀 서버 저장 실패';
            try {
              const errorBody = await response.json();
              if (errorBody && errorBody.message) message = errorBody.message;
            } catch (_) {}
            throw new Error(message);
          }

          const blob = await response.blob();
          downloadExcelBlob(blob, filename);
          showToast('✅ 엑셀 저장 완료! 원본 양식으로 ' + rows.length + '건 내보냈습니다.');
          return;
        } catch (serverErr) {
          console.warn('서버 엑셀 내보내기 실패, 내부 내보내기로 전환합니다.', serverErr);
        }
      }

      const blob = buildClientExcelBlob(rows);
      downloadExcelBlob(blob, filename);
      showToast('✅ 엑셀 저장 완료! ' + rows.length + '건 내보냈습니다.');
    } catch (err) {
      console.error(err);
      showToast('❌ 엑셀 저장 실패: ' + err.message, true);
    } finally {
      setLoading(false);
    }
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


