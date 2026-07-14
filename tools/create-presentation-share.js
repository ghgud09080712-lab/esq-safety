const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const shareScriptPath = path.join(root, 'frontend', 'src', 'share-king.js');
const dataPath = path.join(root, 'backend', 'data', 'shared-grid-data.json');
const downloadsDir = path.join(process.env.USERPROFILE || root, 'Downloads');
const today = new Date();
const stamp = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getDate()).padStart(2, '0')
].join('');
const fileTitle = `개선제안정리_발표용_${stamp}`;
const outputPath = path.join(downloadsDir, `${fileTitle}.html`);

const context = {
  console,
  window: { location: { origin: 'https://port-0-esq-safety-mouynctw40245c77.sel3.cloudtype.app' } },
  document: {},
  localStorage: {}
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(shareScriptPath, 'utf8'), context, { filename: shareScriptPath });

const shared = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
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
const rows = normalizeRows(shared.rows);
const kingRows = normalizeRows(shared.kingRows);
const aGradeRows = normalizeRows(shared.aGradeRows);
const aGradeLinks = {};

Object.entries(shared.aGradeRemoteLinks || {}).forEach(([key, value]) => {
  const item = value && typeof value === 'object' ? { ...value } : {};
  if (item.firebaseUrl) {
    item.url = item.firebaseUrl;
  } else if (item.url && /^\/[^/]/.test(item.url)) {
    item.url = context.window.location.origin + item.url;
  }
  aGradeLinks[key] = item;
});

const html = context.buildStandaloneShareHtml(fileTitle, rows, kingRows, aGradeRows, aGradeLinks);
fs.mkdirSync(downloadsDir, { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');

console.log(JSON.stringify({
  outputPath,
  rows: rows.length,
  kingRows: kingRows.length,
  aGradeRows: aGradeRows.length,
  aGradeLinks: Object.keys(aGradeLinks).length
}, null, 2));
