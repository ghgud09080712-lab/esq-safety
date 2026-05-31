const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const frontendDir = path.join(root, 'frontend');
const srcDir = path.join(frontendDir, 'src');
const dataPath = path.join(root, 'backend', 'data', 'shared-grid-data.json');
const downloadsDir = path.join(process.env.USERPROFILE || root, 'Downloads');
const today = new Date();
const stamp = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0')
].join('');
const outputPath = path.join(downloadsDir, `\uAC1C\uC120\uC81C\uC548\uC815\uB9AC_\uD504\uB85C\uADF8\uB7A8\uBC1C\uD45C\uC6A9_${stamp}.html`);

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function readVendor(relativePath) {
  return read(path.join(root, relativePath));
}

function stripExternalAssets(html) {
  return html
    .replace(/<script src="\/vendor\/ag-grid-community\/dist\/ag-grid-community\.min\.js"><\/script>\s*/g, '')
    .replace(/<script src="\/vendor\/xlsx\/dist\/xlsx\.full\.min\.js"><\/script>\s*/g, '')
    .replace(/<script src="\/vendor\/pdf-lib\/dist\/pdf-lib\.min\.js"><\/script>\s*/g, '')
    .replace(/<script src="\/vendor\/pdfjs-dist\/build\/pdf\.min\.js"><\/script>\s*/g, '')
    .replace(/<script src="\/vendor\/firebase\/firebase-app-compat\.js"><\/script>\s*/g, '')
    .replace(/<script src="\/vendor\/firebase\/firebase-auth-compat\.js"><\/script>\s*/g, '')
    .replace(/<script src="\/vendor\/firebase\/firebase-firestore-compat\.js"><\/script>\s*/g, '')
    .replace(/<script src="\/vendor\/firebase\/firebase-storage-compat\.js"><\/script>\s*/g, '')
    .replace(/<script src="\.\/firebase-config\.js"><\/script>\s*/g, '')
    .replace(/<link rel="stylesheet" href="\/frontend\/src\/styles\.css\?[^"]*">\s*/g, '')
    .replace(/<link rel="stylesheet" href="\/frontend\/src\/styles-professional\.css\?[^"]*">\s*/g, '')
    .replace(/<link rel="stylesheet" href="\/frontend\/src\/styles-data-tune\.css">\s*/g, '')
    .replace(/<script src="\/frontend\/src\/app-state\.js"><\/script>\s*/g, '')
    .replace(/<script src="\/frontend\/src\/grade-grid\.js\?[^"]*"><\/script>\s*/g, '')
    .replace(/<script src="\/frontend\/src\/a-grade\.js\?[^"]*"><\/script>\s*/g, '')
    .replace(/<script src="\/frontend\/src\/share-king\.js\?[^"]*"><\/script>\s*/g, '')
    .replace(/<script src="\/frontend\/src\/puuiseo-excel\.js"><\/script>\s*/g, '')
    .replace(/<script src="\/frontend\/src\/puuiseo-editor\.js"><\/script>\s*/g, '');
}

const shared = JSON.parse(read(dataPath));
function normalizeDepartment(value) {
  const cleaned = String(value || '').replace(/^[a-zA-Z]\s+/, '').trim();
  const compact = cleaned.replace(/[.\s]/g, '').toLowerCase();
  if (!cleaned) return '';
  if (cleaned.includes('공무과')) return cleaned.replace(/공무과/g, '공무팀');
  if (compact === '분산qc') return '품질관리부';
  if (compact === 'sem' || compact === '에스이엠') return 'SEM';
  return cleaned;
}
function normalizeRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(row => ({
    ...row,
    department: normalizeDepartment(row.department)
  }));
}
const snapshot = {
  rows: normalizeRows(shared.rows),
  kingRows: normalizeRows(shared.kingRows),
  aGradeRows: normalizeRows(shared.aGradeRows),
  aGradeRemoteLinks: shared.aGradeRemoteLinks && typeof shared.aGradeRemoteLinks === 'object' ? shared.aGradeRemoteLinks : {},
  sidebarCollapsed: true,
  analysisOpen: false,
  activeMonthFilter: '\uC804\uCCB4',
  globalSearchText: ''
};

let html = stripExternalAssets(read(path.join(frontendDir, 'index.html')));
const styles = [
  read(path.join(srcDir, 'styles.css')),
  read(path.join(srcDir, 'styles-professional.css')),
  read(path.join(srcDir, 'styles-data-tune.css')),
  `
body,
button,
input,
select,
textarea,
.ag-theme-quartz,
.rv-table,
.king-table,
.duplicate-table,
.stats-table {
  font-family: 'IBM Plex Sans KR', 'Malgun Gothic', '맑은 고딕', sans-serif !important;
  -webkit-font-smoothing: antialiased;
}
.ag-theme-quartz {
  --ag-font-family: 'IBM Plex Sans KR', 'Malgun Gothic', '맑은 고딕', sans-serif !important;
  --ag-font-size: 12.5px;
  --ag-header-height: 39px;
  --ag-row-height: 35px;
}
header h1 {
  font-size: 21px;
}
.header-actions .btn,
.toolbar .btn,
.toolbar select,
.search-input {
  font-size: 12px;
}
`
].join('\n\n');
const scripts = [
  readVendor('node_modules/ag-grid-community/dist/ag-grid-community.min.js'),
  readVendor('node_modules/xlsx/dist/xlsx.full.min.js'),
  readVendor('node_modules/pdf-lib/dist/pdf-lib.min.js'),
  readVendor('node_modules/pdfjs-dist/build/pdf.min.js'),
  `window.__PDFJS_WORKER_SOURCE__ = ${JSON.stringify(readVendor('node_modules/pdfjs-dist/build/pdf.worker.min.js'))};`,
  'window.firebase = window.firebase || { initializeApp:function(){return {};}, app:function(){return {};}, apps:[], auth:function(){return {currentUser:null, signInAnonymously:function(){return Promise.resolve();}};}, firestore:function(){return {doc:function(){return {get:function(){return Promise.resolve({exists:false,data:function(){return {};}});},set:function(){return Promise.resolve();}};}};}, storage:function(){return null;}};',
  'window.APP_FIREBASE_CONFIG = null;',
  read(path.join(srcDir, 'app-state.js')),
  `window.__embeddedSnapshot__ = ${JSON.stringify(snapshot)};`,
  read(path.join(srcDir, 'grade-grid.js')),
  read(path.join(srcDir, 'a-grade.js')),
  read(path.join(srcDir, 'share-king.js')),
  read(path.join(srcDir, 'puuiseo-excel.js')),
  read(path.join(srcDir, 'puuiseo-editor.js'))
].join('\n;\n');

html = html
  .replace('</head>', () => `<style>\n${styles}\n</style>\n</head>`)
  .replace('</body>', () => `<script>\n${scripts}\n</script>\n</body>`);

fs.mkdirSync(downloadsDir, { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');

console.log(JSON.stringify({
  outputPath,
  rows: snapshot.rows.length,
  kingRows: snapshot.kingRows.length,
  aGradeRows: snapshot.aGradeRows.length,
  aGradeLinks: Object.keys(snapshot.aGradeRemoteLinks).length
}, null, 2));
