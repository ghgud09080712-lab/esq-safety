  function getAGradeFolderPath() {
    return localStorage.getItem(A_GRADE_FOLDER_KEY) || '';
  }

  function hasDesktopPdfAccess() {
    return !!(window.desktopApp && window.desktopApp.isElectron);
  }

  function pickBrowserPdfFiles({ multi = true } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pdf,application/pdf';
      input.multiple = !!multi;
      input.style.display = 'none';
      input.onchange = () => {
        const files = Array.from(input.files || []);
        input.remove();
        resolve(files);
      };
      document.body.appendChild(input);
      input.click();
    });
  }

  function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error || new Error('파일 읽기 실패'));
      reader.readAsDataURL(file);
    });
  }

  async function fetchRemoteAGradeLinks() {
    try {
      const response = await fetch('/api/a-grade/pdf-meta');
      if (!response.ok) return {};
      const data = await response.json();
      const mapped = {};
      Object.entries(data?.items || {}).forEach(([key, item]) => {
        mapped[key] = item;
      });
      aGradeRemoteLinks = {
        ...(aGradeRemoteLinks && typeof aGradeRemoteLinks === 'object' ? aGradeRemoteLinks : {}),
        ...mapped
      };
      saveAGradeRemoteLinksToLocal();
      return aGradeRemoteLinks;
    } catch (error) {
      console.warn('a-grade remote link load failed', error);
      return {};
    }
  }

  async function uploadPdfFilesForRows(items) {
    const payloadItems = [];
    const fileByKey = {};
    for (const item of items) {
      fileByKey[item.key] = item.file;
      payloadItems.push({
        key: item.key,
        name: item.file.name,
        base64: await readFileAsBase64(item.file)
      });
    }

    const response = await fetch('/api/a-grade/pdf-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payloadItems })
    });
    if (!response.ok) {
      let message = 'PDF 업로드 실패';
      try {
        const body = await response.json();
        if (body?.message) message = body.message;
      } catch (_) {}
      throw new Error(message);
    }

    const data = await response.json();
    for (const item of data.items || []) {
      const firebaseItem = await uploadAGradePdfToFirebase(item.key, fileByKey[item.key], item);
      aGradeRemoteLinks[item.key] = firebaseItem || item;
    }
    saveAGradeRemoteLinksToLocal();
    if (typeof saveSharedData === 'function') {
      const rows = [];
      if (typeof gridApi !== 'undefined' && gridApi) gridApi.forEachNode(n => rows.push(n.data));
      saveSharedData(rows, kingRows || []);
    }
    return data.items || [];
  }

  async function autoRegisterAGradePdfFiles(files) {
    const payloadItems = [];
    const fileByName = {};
    for (const file of files) {
      fileByName[file.name] = file;
      payloadItems.push({
        name: file.name,
        base64: await readFileAsBase64(file)
      });
    }

    const response = await fetch('/api/a-grade/pdf-auto-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: Array.isArray(aGradeRows) ? aGradeRows : [],
        items: payloadItems
      })
    });
    if (!response.ok) {
      let message = 'A급 자동 등록 실패';
      try {
        const body = await response.json();
        if (body?.message) message = body.message;
      } catch (_) {}
      throw new Error(message);
    }

    const data = await response.json();
    if (Array.isArray(data.rows)) {
      aGradeRows = data.rows;
      saveAGradeRowsToLocal();
    }
    for (const item of data.items || []) {
      const sourceFile = fileByName[item.name];
      const firebaseItem = await uploadAGradePdfToFirebase(item.key, sourceFile, item);
      aGradeRemoteLinks[item.key] = firebaseItem || item;
    }
    saveAGradeRemoteLinksToLocal();
    if (typeof saveSharedData === 'function') {
      const rows = [];
      if (typeof gridApi !== 'undefined' && gridApi) gridApi.forEachNode(n => rows.push(n.data));
      saveSharedData(rows, kingRows || []);
    }
    return data;
  }

  function sanitizeFirebasePathPart(value) {
    return String(value || 'file')
      .replace(/[\\/:*?"<>|#%{}[\]^~`]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 120) || 'file';
  }

  async function uploadAGradePdfToFirebase(key, file, baseRecord) {
    if (!file || !key) return baseRecord;
    try {
      const { storage } = await ensureFirebaseReady();
      if (!storage) return baseRecord;
      const safeKey = sanitizeFirebasePathPart(key);
      const safeName = sanitizeFirebasePathPart(file.name || baseRecord?.name || 'proposal.pdf');
      const storagePath = `a-grade-pdfs/${safeKey}/${Date.now()}_${safeName}`;
      const ref = storage.ref(storagePath);
      const snapshot = await ref.put(file, { contentType: file.type || 'application/pdf' });
      const firebaseUrl = await snapshot.ref.getDownloadURL();
      return {
        ...(baseRecord || {}),
        key,
        name: file.name || baseRecord?.name || 'proposal.pdf',
        firebasePath: storagePath,
        firebaseUrl,
        localUrl: baseRecord?.url || '',
        url: firebaseUrl,
        storage: 'firebase',
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      console.warn('firebase a-grade pdf upload failed', error);
      return baseRecord;
    }
  }

  function getAGradeFolderName() {
    const folderPath = getAGradeFolderPath();
    if (!folderPath) return '';
    const parts = folderPath.split(/[\\/]/);
    return parts[parts.length - 1] || folderPath;
  }

  function syncAGradeFileButtons() {
    const openBtn = document.getElementById('aGradeViewBtn');
    if (openBtn) {
      const savedRows = aGradeRows.length ? `A급제안 ${aGradeRows.length}건` : 'A급제안 등록부 없음';
      openBtn.title = `${savedRows} · PDF 칸에서 바로 열 수 있습니다.`;
      openBtn.style.opacity = aGradeRows.length ? '1' : '0.92';
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
    if (!hasDesktopPdfAccess() || !window.desktopApp.pickExternalDirectory) {
      showToast('브라우저에서는 폴더 대신 PDF 파일을 직접 업로드해 주세요.', true);
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
    try {
      if (hasDesktopPdfAccess() && window.desktopApp.importAGradePdfFiles) {
        const result = await window.desktopApp.importAGradePdfFiles({ multi: true, title: 'A급 제안 실물 PDF 등록' });
        if (!result || result.canceled) return;
        if (result.folderPath) {
          localStorage.setItem(A_GRADE_FOLDER_KEY, result.folderPath);
          syncAGradeFileButtons();
          renderAGradeRegistry();
        }
        const count = Array.isArray(result.files) ? result.files.length : 0;
        showToast(`✅ A급 실물 PDF ${count}개 등록 완료`);
        return;
      }

      const files = await pickBrowserPdfFiles({ multi: true });
      if (!files.length) return;
      setLoading(true, 'A급 PDF 자동 등록 중...', 'PDF 내용에서 제목/제안자/날짜를 읽어 등록부와 연결합니다');
      const result = await autoRegisterAGradePdfFiles(files);
      renderAGradeRegistry();
      const matchedCount = Number(result?.matchedCount || 0);
      const createdCount = Number(result?.createdCount || 0);
      const skippedCount = Number(result?.skippedCount || 0);
      showToast(`✅ 자동 등록 완료: 기존연결 ${matchedCount}건, 신규등록 ${createdCount}건${skippedCount ? `, 제외 ${skippedCount}건` : ''}`);
    } catch (error) {
      showToast('❌ PDF 파일 등록 실패: ' + error.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function importAGradePdfForRow(index) {
    const row = aGradeRows[index];
    if (!row) return null;
    if (hasDesktopPdfAccess() && window.desktopApp.importAGradePdfFiles) {
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

    const files = await pickBrowserPdfFiles({ multi: false });
    const file = files[0];
    if (!file) return null;
    await uploadPdfFilesForRows([{ key: getAGradeRowKey(row), file }]);
    renderAGradeRegistry();
    showToast(`✅ 이 항목에 PDF 업로드 완료: ${file.name}`);
    return { name: file.name, url: aGradeRemoteLinks[getAGradeRowKey(row)]?.url };
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
      if (file.url) {
        window.open(file.url, '_blank', 'noopener,noreferrer');
        showToast(`✅ PDF 원본 열기: ${file.name}`);
        return;
      }
      const result = await window.desktopApp.openExternalPath(file.path);
      if (!result || !result.ok) throw new Error(result?.error || 'PDF를 열 수 없습니다.');
      showToast(`✅ PDF 원본 열기: ${file.name}`);
    } catch (error) {
      showToast('❌ PDF 열기 실패: ' + error.message, true);
    }
  }

  function getAGradeDedupKey(row) {
    const department = typeof normalizeDepartment === 'function'
      ? normalizeDepartment(row.department)
      : String(row.department || '').replace(/^[a-zA-Z](?:\.|\s+)/, '').trim();
    const title = normalizeMatchText(row.title);
    const proposer = normalizeMatchText(row.proposer);
    const dept = normalizeMatchText(department);
    if (!title) return '';
    if (proposer) return `proposer-title|${proposer}|${title}`;
    if (dept) return `department-title|${dept}|${title}`;
    return `title|${title}`;
  }

  function dedupeAGradeRows(rows) {
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
      const currentHasLink = !!(getLinkedAGradePdfPath(current) || getRemoteAGradePdf(current));
      const nextHasLink = !!(getLinkedAGradePdfPath(row) || getRemoteAGradePdf(row));
      const preferredDepartment = normalizeAGradeDepartment(row.department || current.department);
      if (!currentHasLink && nextHasLink) {
        seen.set(key, { ...current, ...row, department: preferredDepartment });
        return;
      }
      seen.set(key, { ...row, ...current, department: preferredDepartment });
    });
    return Array.from(seen.values());
  }

  function normalizeAGradeDepartment(value) {
    const stripped = String(value || '').replace(/^[a-zA-Z](?:\.|\s+)/, '').trim();
    return typeof normalizeDepartment === 'function' ? normalizeDepartment(stripped) : stripped;
  }

  function formatAGradeYear(value) {
    const match = String(value || '').match(/20\d{2}/);
    return match ? `${match[0]}년` : String(value || '').trim();
  }

  function normalizeAGradeRegistryRow(row) {
    return {
      ...row,
      year: formatAGradeYear(row?.year || row?.date || ''),
      department: normalizeAGradeDepartment(row?.department || '')
    };
  }

  function saveAGradeRowsToLocal() {
    aGradeRows = dedupeAGradeRows((aGradeRows || []).map(normalizeAGradeRegistryRow));
    localStorage.setItem(A_GRADE_ROWS_KEY, JSON.stringify(aGradeRows || []));
  }

  function loadAGradeRowsFromLocal() {
    try {
      const saved = localStorage.getItem(A_GRADE_ROWS_KEY);
      if (saved) {
        aGradeRows = dedupeAGradeRows((JSON.parse(saved) || []).map(row => ({
          ...row,
          department: row.department || ''
        })));
        saveAGradeRowsToLocal();
      }
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
      formatAGradeYear(row.year || row.date || ''),
      row.date || '',
      row.proposer || '',
      row.title || ''
    ].map(value => normalizeMatchText(value)).join('|');
  }

  function getAGradeRowKeyCandidates(row) {
    const baseYear = String(row?.year || row?.date || '');
    const formattedYear = formatAGradeYear(baseYear);
    const rawYear = String(row?.year || '').trim();
    const yearWithoutSuffix = formattedYear.replace(/년/g, '');
    const years = Array.from(new Set([formattedYear, rawYear, yearWithoutSuffix, `${yearWithoutSuffix}?`].filter(Boolean)));
    return years.map(year => [
      row.no || '',
      year,
      row.date || '',
      row.proposer || '',
      row.title || ''
    ].map(value => normalizeMatchText(value)).join('|'));
  }

  function getFirstAGradeMapValue(map, row) {
    if (!map || typeof map !== 'object') return null;
    for (const key of getAGradeRowKeyCandidates(row)) {
      if (map[key]) return map[key];
    }
    return null;
  }

  function deleteAGradeMapValues(map, row) {
    if (!map || typeof map !== 'object') return;
    getAGradeRowKeyCandidates(row).forEach(key => delete map[key]);
  }

  function getLinkedAGradePdfPath(row) {
    return getFirstAGradeMapValue(aGradePdfLinks, row) || '';
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
    return getFirstAGradeMapValue(aGradeRemoteLinks, row);
  }

  function normalizeGoogleDriveUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const fileMatch = raw.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    const idMatch = raw.match(/[?&]id=([^&]+)/);
    if (idMatch) return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
    return raw;
  }

  function ensureAGradeDriveLinkModal() {
    let modal = document.getElementById('aGradeDriveLinkModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'aGradeDriveLinkModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(15,23,42,0.34);z-index:9830;padding:20px;overflow:auto;';
    modal.innerHTML = `
      <div style="max-width:640px;margin:10vh auto 0;background:#fff;border:1px solid #dbe3ef;border-radius:14px;box-shadow:0 20px 45px rgba(15,23,42,0.18);overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid #e6ecf4;background:#fffdf5;">
          <div style="font-size:17px;font-weight:800;color:#172539;">Google Drive 주소 등록</div>
          <div id="aGradeDriveLinkHelp" style="margin-top:6px;font-size:12px;color:#64748b;line-height:1.6;"></div>
        </div>
        <div style="padding:18px;display:grid;gap:12px;">
          <input
            id="aGradeDriveLinkInput"
            type="text"
            placeholder="https://drive.google.com/file/d/... 또는 공유 링크 붙여넣기"
            style="width:100%;min-height:42px;padding:0 12px;background:#fff;border:1px solid #d8e0ea;border-radius:10px;color:#24324a;font-size:13px;outline:none;"
          />
          <div style="font-size:12px;color:#7c8798;line-height:1.6;">
            Drive에서 링크 권한은 <b>"링크가 있는 모든 사용자 보기"</b>로 설정해야 합니다.
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="btn" onclick="resolveAGradeDriveLinkInput('cancel')" style="background:#fff;border-color:#d8e0ea;color:#475569;">취소</button>
            <button class="btn" onclick="resolveAGradeDriveLinkInput('submit')" style="background:#fff8e5;border-color:#ecd39a;color:#8a5a00;font-weight:800;">저장</button>
          </div>
        </div>
      </div>`;
    modal.addEventListener('click', (event) => {
      if (event.target === modal) resolveAGradeDriveLinkInput('cancel');
    });
    document.body.appendChild(modal);
    return modal;
  }

  function resolveAGradeDriveLinkInput(action) {
    const modal = document.getElementById('aGradeDriveLinkModal');
    const inputEl = document.getElementById('aGradeDriveLinkInput');
    if (modal) modal.style.display = 'none';
    if (typeof window.__resolveAGradeDriveLinkInput === 'function') {
      const resolve = window.__resolveAGradeDriveLinkInput;
      window.__resolveAGradeDriveLinkInput = null;
      resolve(action === 'submit' ? String(inputEl?.value || '') : null);
    }
  }

  function requestAGradeDriveLinkInput(row, current) {
    const modal = ensureAGradeDriveLinkModal();
    const helpEl = document.getElementById('aGradeDriveLinkHelp');
    const inputEl = document.getElementById('aGradeDriveLinkInput');
    if (helpEl) {
      helpEl.textContent = `${row?.proposer || ''} ${row?.title || ''}`.trim();
    }
    if (inputEl) {
      inputEl.value = current || '';
    }
    modal.style.display = 'block';
    requestAnimationFrame(() => {
      const nextInput = document.getElementById('aGradeDriveLinkInput');
      if (nextInput) {
        nextInput.focus();
        if (typeof nextInput.setSelectionRange === 'function') {
          const end = nextInput.value.length;
          nextInput.setSelectionRange(end, end);
        }
      }
    });
    return new Promise((resolve) => {
      window.__resolveAGradeDriveLinkInput = resolve;
    });
  }

  async function registerAGradeDriveLinkForRow(index) {
    const row = aGradeRows[index];
    if (!row) return null;
    const current = getRemoteAGradePdf(row)?.url || '';
    const input = await requestAGradeDriveLinkInput(row, current);
    if (input === null) return null;
    const url = normalizeGoogleDriveUrl(input);
    if (!url) {
      showToast('Drive 링크가 입력되지 않았습니다.', true);
      return null;
    }
    const key = getAGradeRowKey(row);
    deleteAGradeMapValues(aGradeRemoteLinks, row);
    const record = {
      key,
      name: row.title || 'A급 개선제안 PDF',
      url,
      driveUrl: url,
      storage: 'google-drive',
      row,
      uploadedAt: new Date().toISOString()
    };
    aGradeRemoteLinks[key] = record;
    saveAGradeRemoteLinksToLocal();
    if (typeof saveSharedData === 'function') {
      const rows = [];
      if (typeof gridApi !== 'undefined' && gridApi) gridApi.forEachNode(n => rows.push(n.data));
      saveSharedData(rows, kingRows || []);
    }
    renderAGradeRegistry();
    showToast('✅ Google Drive 링크가 등록되었습니다.');
    return record;
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
    return {
      db: firebaseDb,
      storage: firebase.storage ? firebase.storage() : null
    };
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
        aGradeRows = data.rows.map(row => ({
          ...row,
          department: row.department || ''
        }));
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
    if (!remote) return false;
    if (remote.url) {
      window.open(remote.url, '_blank', 'noopener,noreferrer');
      return true;
    }
    if (!remote.relativePath) return false;
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
        aGradeRows = result.rows.map(row => ({
          ...row,
          department: row.department || ''
        }));
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
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(32,52,82,0.24);z-index:9790;padding:14px;overflow:hidden;';
    modal.innerHTML = `
      <div style="height:calc(100vh - 28px);max-width:none;margin:0;background:#f7f9fc;border-radius:8px;box-shadow:0 12px 28px rgba(47,111,237,0.10);overflow:hidden;border:1px solid #d8e1f0;display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;background:#f8fbff;border-bottom:1px solid #d8e1f0;flex-shrink:0;">
          <div style="flex:1;">
            <div style="font-size:18px;font-weight:800;color:#172539;">A급 개선제안</div>
            <div id="aGradeRegistrySub" style="font-size:12px;color:#64748b;margin-top:3px;"></div>
          </div>
          <button class="btn" style="background:#fff;border-color:#d7c58b;color:#8a5a00;font-weight:700;" onclick="openAGradeLinkManager()">주소관리</button>
          <button class="btn" style="background:#fff;border-color:#c8d2de;color:#184e9e;font-weight:700;" onclick="importAGradePdfFiles()">PDF 일괄 업로드</button>
          <button class="btn" onclick="closeAGradeRegistryModal()">닫기</button>
        </div>
        <div id="aGradeRegistryBody" style="padding:14px 18px 18px;background:#f7f9fc;overflow:auto;flex:1;"></div>
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

  function ensureAGradeLinkManagerModal() {
    let modal = document.getElementById('aGradeLinkManagerModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'aGradeLinkManagerModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(20,30,50,0.28);z-index:9810;padding:20px;overflow:auto;';
    modal.innerHTML = `
      <div style="max-width:980px;margin:0 auto;background:#f7f9fc;border:1px solid #d8e1f0;border-radius:10px;box-shadow:0 18px 40px rgba(15,23,42,0.15);overflow:hidden;">
        <div style="display:flex;align-items:center;gap:12px;padding:16px 18px;background:#fffdf5;border-bottom:1px solid #eadfb8;">
          <div style="flex:1;">
            <div style="font-size:17px;font-weight:800;color:#5f4300;">A급 주소관리</div>
            <div id="aGradeLinkManagerSub" style="font-size:12px;color:#7c6a36;margin-top:3px;"></div>
          </div>
          <button class="btn" onclick="closeAGradeLinkManager()" style="background:#fff;">닫기</button>
        </div>
        <div id="aGradeLinkManagerBody" style="padding:16px 18px 18px;background:#f7f9fc;"></div>
      </div>`;
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeAGradeLinkManager();
    });
    document.body.appendChild(modal);
    return modal;
  }

  function closeAGradeLinkManager() {
    const modal = document.getElementById('aGradeLinkManagerModal');
    if (modal) modal.style.display = 'none';
  }

  function ensureAGradeRegisterChoiceModal() {
    let modal = document.getElementById('aGradeRegisterChoiceModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'aGradeRegisterChoiceModal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(15,23,42,0.32);z-index:9820;padding:20px;overflow:auto;';
    modal.innerHTML = `
      <div style="max-width:460px;margin:8vh auto 0;background:#fff;border:1px solid #dbe3ef;border-radius:14px;box-shadow:0 20px 45px rgba(15,23,42,0.18);overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid #e6ecf4;background:#f8fbff;">
          <div style="font-size:17px;font-weight:800;color:#172539;">A급 연결 방식 선택</div>
          <div id="aGradeRegisterChoiceText" style="margin-top:6px;font-size:12px;color:#64748b;line-height:1.55;"></div>
        </div>
        <div style="padding:18px;display:grid;gap:10px;">
          <button class="btn" onclick="resolveAGradeRegisterChoice('drive')" style="justify-content:flex-start;min-height:44px;background:#fff8e5;border-color:#ecd39a;color:#8a5a00;font-weight:800;">주소 등록</button>
          <button class="btn" onclick="resolveAGradeRegisterChoice('pdf')" style="justify-content:flex-start;min-height:44px;background:#eef6ff;border-color:#cddff7;color:#184e9e;font-weight:800;">PDF 연결</button>
          <button class="btn" onclick="resolveAGradeRegisterChoice('cancel')" style="justify-content:flex-start;min-height:40px;background:#fff;border-color:#d8e0ea;color:#475569;">취소</button>
        </div>
      </div>`;
    modal.addEventListener('click', (event) => {
      if (event.target === modal) resolveAGradeRegisterChoice('cancel');
    });
    document.body.appendChild(modal);
    return modal;
  }

  function resolveAGradeRegisterChoice(choice) {
    const modal = document.getElementById('aGradeRegisterChoiceModal');
    if (modal) modal.style.display = 'none';
    if (typeof window.__resolveAGradeRegisterChoice === 'function') {
      const resolve = window.__resolveAGradeRegisterChoice;
      window.__resolveAGradeRegisterChoice = null;
      resolve(choice);
    }
  }

  function requestAGradeRegisterChoice(row) {
    const modal = ensureAGradeRegisterChoiceModal();
    const textEl = document.getElementById('aGradeRegisterChoiceText');
    if (textEl) {
      textEl.textContent = `${row?.proposer || ''} ${row?.title || ''}`.trim();
    }
    modal.style.display = 'block';
    return new Promise((resolve) => {
      window.__resolveAGradeRegisterChoice = resolve;
    });
  }

  function openAGradeLinkManager() {
    renderAGradeLinkManager();
    const modal = ensureAGradeLinkManagerModal();
    modal.style.display = 'block';
  }

  function renderAGradeLinkManager() {
    const modal = ensureAGradeLinkManagerModal();
    const subEl = document.getElementById('aGradeLinkManagerSub');
    const bodyEl = document.getElementById('aGradeLinkManagerBody');
    const linkedRows = (aGradeRows || []).map((row, index) => ({ row, index, remote: getRemoteAGradePdf(row) }))
      .filter(item => item.remote && item.remote.url);

    subEl.textContent = `현재 등록된 Google Drive 주소 ${linkedRows.length}건`;

    if (!linkedRows.length) {
      bodyEl.innerHTML = `
        <div style="background:#fff;border:1px dashed #d8c892;border-radius:12px;padding:26px;text-align:center;color:#7b6427;line-height:1.7;">
          아직 등록된 A급 주소가 없습니다.<br>
          등록부에서 PDF를 열 때 주소를 먼저 넣으면 여기서 나중에 수정할 수 있습니다.
        </div>`;
      return modal;
    }

    bodyEl.innerHTML = `
      <table style="width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #e3e8f0;border-radius:6px;overflow:hidden;font-size:13px;">
        <thead>
          <tr style="background:#f6f8fb;color:#334155;">
            <th style="padding:10px;border-bottom:1px solid #e5eaf1;text-align:center;width:60px;">NO</th>
            <th style="padding:10px;border-bottom:1px solid #e5eaf1;text-align:left;width:110px;">제안자</th>
            <th style="padding:10px;border-bottom:1px solid #e5eaf1;text-align:left;">제안명</th>
            <th style="padding:10px;border-bottom:1px solid #e5eaf1;text-align:left;width:250px;">현재 주소</th>
            <th style="padding:10px;border-bottom:1px solid #e5eaf1;text-align:center;width:90px;">수정</th>
          </tr>
        </thead>
        <tbody>
          ${linkedRows.map(({ row, index, remote }) => `
            <tr>
              <td style="padding:10px;border-bottom:1px solid #eef2f7;text-align:center;color:#64748b;font-weight:700;">${escapeHtml(row.no)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f7;font-weight:700;">${escapeHtml(row.proposer)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f7;line-height:1.5;">${escapeHtml(row.title)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f7;color:#64748b;word-break:break-all;">${escapeHtml(remote.url || '')}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f7;text-align:center;">
                <button
                  class="btn"
                  onclick="registerAGradeDriveLinkForRow(${index}); setTimeout(renderAGradeLinkManager, 80);"
                  style="min-width:58px;padding:7px 10px;border-radius:999px;font-size:12px;font-weight:800;background:#fff8e5;border-color:#ecd39a;color:#8a5a00;"
                >수정</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
    return modal;
  }

  function getAGradeSearchText() {
    return window.__aGradeSearchText || '';
  }

  function startAGradeSearchComposition() {
    window.__aGradeSearchComposing = true;
  }

  function endAGradeSearchComposition(value) {
    window.__aGradeSearchComposing = false;
    setAGradeSearchText(value);
  }

  function setAGradeSearchText(value) {
    if (window.__aGradeSearchComposing) {
      window.__aGradeSearchText = String(value || '');
      return;
    }
    const activeEl = document.activeElement;
    const shouldRestoreFocus = activeEl && activeEl.id === 'aGradeRegistrySearch';
    const cursorPos = shouldRestoreFocus && typeof activeEl.selectionStart === 'number'
      ? activeEl.selectionStart
      : String(value || '').length;
    window.__aGradeSearchText = String(value || '');
    renderAGradeRegistry();
    if (shouldRestoreFocus) {
      requestAnimationFrame(() => {
        const searchEl = document.getElementById('aGradeRegistrySearch');
        if (!searchEl) return;
        searchEl.focus();
        const nextPos = Math.min(cursorPos, searchEl.value.length);
        if (typeof searchEl.setSelectionRange === 'function') {
          searchEl.setSelectionRange(nextPos, nextPos);
        }
      });
    }
  }

  function renderAGradeRegistry() {
    const modal = ensureAGradeRegistryModal();
    const subEl = document.getElementById('aGradeRegistrySub');
    const bodyEl = document.getElementById('aGradeRegistryBody');
    const dedupedRows = dedupeAGradeRows(aGradeRows);
    if (dedupedRows.length !== (aGradeRows || []).length) {
      aGradeRows = dedupedRows;
      saveAGradeRowsToLocal();
      syncAGradeFileButtons();
    }
    const searchText = getAGradeSearchText().trim().toLowerCase();
    const filteredRows = aGradeRows.filter((row) => {
      if (!searchText) return true;
      const haystack = [
        row.no,
        row.year,
        row.date,
        row.department,
        row.proposer,
        row.title,
        row.type
      ].map(value => String(value || '').toLowerCase()).join(' ');
      return haystack.includes(searchText);
    });
    subEl.textContent = `${filteredRows.length}건 표시 / 전체 ${aGradeRows.length}건 · PDF 칸에서 바로 열기`;

    if (!aGradeRows.length) {
      bodyEl.innerHTML = `
        <div style="background:#fff;border:1px dashed #d7b75f;border-radius:14px;padding:28px;text-align:center;color:#7b5a12;line-height:1.7;">
          아직 A급제안 등록부가 없습니다.<br>
          4번 시트에 <b>A급제안</b>이 들어있는 엑셀 파일을 먼저 업로드하면 이곳에 그대로 저장됩니다.
        </div>`;
      modal.style.display = 'block';
      return;
    }

    if (!document.getElementById('aGradeRegistrySearch')) {
      bodyEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <input
            id="aGradeRegistrySearch"
            type="text"
            value="${escapeHtml(getAGradeSearchText())}"
            oncompositionstart="startAGradeSearchComposition()"
            oncompositionend="endAGradeSearchComposition(this.value)"
            oninput="setAGradeSearchText(this.value)"
            placeholder="부서명, 제안자, 제안명 검색..."
            style="flex:1;min-height:38px;padding:0 12px;background:#fff;border:1px solid #d8e0ea;border-radius:10px;color:#24324a;font-size:13px;outline:none;"
          />
          <button
            class="btn"
            onclick="setAGradeSearchText('')"
            style="min-width:68px;"
          >초기화</button>
        </div>
        <div id="aGradeRegistryTableWrap"></div>`;
    }

    const searchEl = document.getElementById('aGradeRegistrySearch');
    if (searchEl && document.activeElement !== searchEl && searchEl.value !== getAGradeSearchText()) {
      searchEl.value = getAGradeSearchText();
    }

    const tableWrapEl = document.getElementById('aGradeRegistryTableWrap');
    tableWrapEl.innerHTML = `
      <table style="width:100%;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #dde6f3;border-radius:4px;overflow:hidden;font-size:13px;">
        <thead>
          <tr style="background:#eef4fb;color:#31465f;">
            <th style="padding:10px;border-bottom:1px solid #d7e2f0;text-align:center;width:52px;">NO</th>
            <th style="padding:10px;border-bottom:1px solid #d7e2f0;text-align:center;width:76px;">접수년</th>
            <th style="padding:10px;border-bottom:1px solid #d7e2f0;text-align:center;width:96px;">접수일자</th>
            <th style="padding:10px;border-bottom:1px solid #d7e2f0;text-align:left;width:120px;">부서명</th>
            <th style="padding:10px;border-bottom:1px solid #d7e2f0;text-align:left;width:90px;">제안자</th>
            <th style="padding:10px;border-bottom:1px solid #d7e2f0;text-align:left;">제안명</th>
            <th style="padding:10px;border-bottom:1px solid #d7e2f0;text-align:center;width:72px;">구분</th>
            <th style="padding:10px;border-bottom:1px solid #d7e2f0;text-align:right;width:90px;">시상금</th>
            <th style="padding:10px;border-bottom:1px solid #d7e2f0;text-align:center;width:90px;">PDF</th>
            <th style="padding:10px;border-bottom:1px solid #d7e2f0;text-align:center;width:78px;">삭제</th>
          </tr>
        </thead>
        <tbody>
          ${filteredRows.length ? filteredRows.map((row) => {
            const index = aGradeRows.indexOf(row);
            const remotePdf = getRemoteAGradePdf(row);
            const hasLinkedPdf = !!(getLinkedAGradePdfPath(row) || remotePdf);
            return `
            <tr>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;color:#7a8799;font-weight:700;">${escapeHtml(row.no)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;">${escapeHtml(row.year)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;">${escapeHtml(row.date)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;">${escapeHtml(row.department || '')}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;font-weight:700;">${escapeHtml(row.proposer)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;line-height:1.45;">${escapeHtml(row.title)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;">${escapeHtml(row.type || '실시')}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:right;font-weight:700;color:#8a5a00;">${formatCurrency(row.reward)}</td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;">
                <button
                  class="btn"
                  onclick="openAGradePdfForRow(${index})"
                  style="min-width:58px;padding:7px 10px;border-radius:999px;font-size:12px;font-weight:800;background:${hasLinkedPdf ? '#eaf4ee' : '#f5f7fb'};border-color:${hasLinkedPdf ? '#b7dcc5' : '#d8e0ea'};color:${hasLinkedPdf ? '#16794c' : '#5f6f82'};"
                  title="${hasLinkedPdf ? 'PDF 열기' : 'PDF 등록'}"
                >${hasLinkedPdf ? '보기' : '등록'}</button>
              </td>
              <td style="padding:10px;border-bottom:1px solid #eef2f8;text-align:center;">
                <button
                  class="btn"
                  onclick="deleteAGradeRow(${index})"
                  style="min-width:54px;padding:7px 10px;border-radius:999px;font-size:12px;font-weight:800;background:#fff1f2;border-color:#fecdd3;color:#be123c;"
                  title="A급 등록부에서 삭제"
                >삭제</button>
              </td>
            </tr>
          `;
          }).join('') : `
            <tr>
              <td colspan="10" style="padding:26px 16px;text-align:center;color:#6b778c;background:#fff;">검색 결과가 없습니다.</td>
            </tr>
          `}
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

  async function deleteAGradeRow(index) {
    const row = aGradeRows[index];
    if (!row) return;

    const message = `"${row.title || '선택한 A급 제안'}"\nA급 개선제안 등록부에서 삭제할까요?`;
    if (typeof confirm === 'function' && !confirm(message)) return;

    const rowKey = getAGradeRowKey(row);
    aGradeRows.splice(index, 1);
    deleteAGradeMapValues(aGradePdfLinks, row);
    deleteAGradeMapValues(aGradeRemoteLinks, row);
    saveAGradeRowsToLocal();
    saveAGradePdfLinksToLocal();
    saveAGradeRemoteLinksToLocal();
    syncAGradeFileButtons();

    if (typeof saveSharedData === 'function' && !(typeof isEmbeddedShareFile === 'function' && isEmbeddedShareFile())) {
      const rows = typeof collectGridRows === 'function' ? collectGridRows() : [];
      saveSharedData(rows, kingRows || []);
    }

    renderAGradeRegistry();
    showToast('✅ A급 개선제안에서 삭제했습니다.');
  }

  async function getAGradePdfFilesFromFolder() {
    if (!hasDesktopPdfAccess() || !window.desktopApp.listPdfFiles) {
      const remoteLinks = await fetchRemoteAGradeLinks();
      const files = Object.values(remoteLinks).map(item => ({
        name: item.name || 'proposal.pdf',
        path: item.url || '',
        url: item.url || ''
      }));
      return { folderPath: '서버 업로드 파일', files };
    }
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

    try {
      const linkedPath = getLinkedAGradePdfPath(row);
      if (linkedPath && hasDesktopPdfAccess() && window.desktopApp.openExternalPath) {
        const linkedResult = await window.desktopApp.openExternalPath(linkedPath);
        if (linkedResult && linkedResult.ok) {
          showToast(`✅ 연결된 실물 PDF 열기`);
          return;
        }
        deleteAGradeMapValues(aGradePdfLinks, row);
        saveAGradePdfLinksToLocal();
        renderAGradeRegistry();
      }

      if (getRemoteAGradePdf(row)) {
        await openRemoteAGradePdf(row);
        showToast('✅ PDF 열기');
        return;
      }

      const registerChoice = await requestAGradeRegisterChoice(row);
      if (registerChoice === 'cancel' || !registerChoice) return;

      if (registerChoice === 'drive') {
        const driveLink = await registerAGradeDriveLinkForRow(index);
        if (driveLink?.url) {
          window.open(driveLink.url, '_blank', 'noopener,noreferrer');
        }
        return;
      }

      if (hasDesktopPdfAccess() && window.desktopApp.importAGradePdfFiles) {
        showToast('이 항목에 연결할 PDF를 선택해 주세요.', true);
        const selected = await importAGradePdfForRow(index);
        if (selected && hasDesktopPdfAccess() && window.desktopApp.openExternalPath) {
          await window.desktopApp.openExternalPath(selected.path);
        }
        return;
      }

      setLoading(true, 'A급 실물 PDF 찾는 중...', row.title);
      if (!getAGradeFolderPath()) {
        setLoading(false);
        showToast('이 항목에 맞는 PDF를 직접 선택해 주세요.', true);
        const selected = await importAGradePdfForRow(index);
        if (selected?.url) window.open(selected.url, '_blank', 'noopener,noreferrer');
        else if (selected && hasDesktopPdfAccess() && window.desktopApp.openExternalPath) await window.desktopApp.openExternalPath(selected.path);
        return;
      }

      const { folderPath, files } = await getAGradePdfFilesFromFolder();
      if (!folderPath) return;
      if (!files.length) {
        setLoading(false);
        const selected = await importAGradePdfForRow(index);
        if (selected?.url) window.open(selected.url, '_blank', 'noopener,noreferrer');
        else if (selected && hasDesktopPdfAccess() && window.desktopApp.openExternalPath) await window.desktopApp.openExternalPath(selected.path);
        return;
      }

      const matchedFile = findMatchingAGradePdf(row, files);
      if (matchedFile) {
        if (matchedFile.url) {
          aGradeRemoteLinks[getAGradeRowKey(row)] = matchedFile;
          saveAGradeRemoteLinksToLocal();
          renderAGradeRegistry();
          window.open(matchedFile.url, '_blank', 'noopener,noreferrer');
        } else {
          aGradePdfLinks[getAGradeRowKey(row)] = matchedFile.path;
          saveAGradePdfLinksToLocal();
          renderAGradeRegistry();
          const result = await window.desktopApp.openExternalPath(matchedFile.path);
          if (!result || !result.ok) throw new Error(result?.error || 'PDF를 열 수 없습니다.');
        }
        showToast(`✅ 일치 항목 PDF 열기: ${matchedFile.name}`);
        return;
      }

      setLoading(false);
      showToast('일치하는 PDF를 찾지 못했습니다. 이 항목에 맞는 PDF를 직접 선택해 주세요.', true);
      const selected = await importAGradePdfForRow(index);
      if (selected?.url) window.open(selected.url, '_blank', 'noopener,noreferrer');
      else if (selected && hasDesktopPdfAccess() && window.desktopApp.openExternalPath) await window.desktopApp.openExternalPath(selected.path);
    } catch (error) {
      showToast('❌ 실물 PDF 열기 실패: ' + error.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function openAGradePdfFolderList() {
    try {
      setLoading(true, 'A급 PDF 목록을 불러오는 중...', '스캔 원본 PDF를 찾고 있습니다');
      const { folderPath, files } = await getAGradePdfFilesFromFolder();
      renderAGradePdfList(folderPath, files);
      showToast(`✅ A급 PDF ${files.length}건 불러오기 완료`);
    } catch (error) {
      if (hasDesktopPdfAccess()) {
        localStorage.removeItem(A_GRADE_FOLDER_KEY);
        syncAGradeFileButtons();
      }
      showToast('❌ A급 PDF 폴더를 열 수 없습니다: ' + error.message, true);
    } finally {
      setLoading(false);
    }
  }

  async function openAGradeFile() {
    try {
      if (typeof loadSharedData === 'function') {
        const shared = await loadSharedData();
        if (shared) {
          if (Array.isArray(shared.aGradeRows)) {
            aGradeRows = shared.aGradeRows.map(row => ({
              ...row,
              department: row.department || ''
            }));
            saveAGradeRowsToLocal();
          }
          if (shared.aGradeRemoteLinks && typeof shared.aGradeRemoteLinks === 'object') {
            aGradeRemoteLinks = shared.aGradeRemoteLinks;
            saveAGradeRemoteLinksToLocal();
          }
        }
      }
      await fetchRemoteAGradeLinks();
      syncAGradeFileButtons();
    } catch (error) {
      console.warn('a-grade latest load failed', error);
    }
    renderAGradeRegistry();
  }

