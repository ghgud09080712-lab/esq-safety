const ExcelJS = require("exceljs");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

const TEMPLATE_CANDIDATES = [
  path.join(os.homedir(), "Desktop", "부서별제안등록부.xlsx"),
  path.join(os.homedir(), "Desktop", "1.개선제안_제출현황(2026년)111.xlsx"),
  path.join(os.homedir(), "Desktop", "1.개선제안_제출현황(2026년).xlsx")
];

const DEPT_MAP = {
  "생산1부": "a 생산1부",
  "생산 1부": "a 생산1부",
  "생산2부": "b 생산2부",
  "생산 2부": "b 생산2부",
  "S.E.M.": "c SEM",
  "SEM": "c SEM",
  "sem": "c SEM",
  "연구개발팀": "d 연구개발팀",
  "품질관리부": "e 품질관리부",
  "T/S팀": "f T/S팀",
  "ts팀": "f T/S팀",
  "물류관리팀": "g 물류관리팀",
  "공무팀": "h 공무팀",
  "환경관리과": "i 환경관리과",
  "총무과": "j 총무과"
};

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeDept(value) {
  if (!value) return "";
  const text = String(value).replace(/^[a-zA-Z](?:\.|\s+)/, "").trim();
  const compact = text.replace(/[.\s]/g, "").toLowerCase();
  const compactNoSlash = compact.replace(/\//g, "");
  const departmentMap = {
    "생산1부": "a.생산1부",
    "생산2부": "b.생산2부",
    "sem": "c.SEM",
    "에스이엠": "c.SEM",
    "연구개발팀": "d.연구개발팀",
    "품질관리부": "e.품질관리부",
    "분산qc": "e.품질관리부",
    "t/s": "f.T/S팀",
    "t/s팀": "f.T/S팀",
    "t/s부": "f.T/S팀",
    "ts": "f.T/S팀",
    "ts팀": "f.T/S팀",
    "ts부": "f.T/S팀",
    "물류관리팀": "g.물류관리팀",
    "공무팀": "h.공무팀",
    "공무과": "h.공무팀",
    "환경관리과": "i.환경관리과",
    "총무과": "j.총무과"
  };
  if (departmentMap[compact] || departmentMap[compactNoSlash]) return departmentMap[compact] || departmentMap[compactNoSlash];
  for (const [from, to] of Object.entries(DEPT_MAP)) {
    if (text === from || text.toLowerCase() === from.toLowerCase()) return to;
  }
  return text;
}

async function findTemplatePath() {
  for (const candidate of TEMPLATE_CANDIDATES) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next known template name.
    }
  }
  throw new Error("원본 엑셀 양식 파일을 찾지 못했습니다. 바탕화면의 부서별제안등록부.xlsx 파일을 확인해 주세요.");
}

function findTargetSheet(workbook) {
  return workbook.worksheets.find((sheet) => {
    const compact = sheet.name.replace(/\s/g, "");
    return compact.includes("부서별제안등록부") || compact.includes("제안등록부");
  }) || workbook.worksheets[0];
}

function copyCellFormat(sourceCell, targetCell) {
  targetCell.style = clone(sourceCell.style) || {};
  targetCell.numFmt = sourceCell.numFmt;
  targetCell.alignment = clone(sourceCell.alignment);
  targetCell.border = clone(sourceCell.border);
  targetCell.fill = clone(sourceCell.fill);
  targetCell.font = clone(sourceCell.font);
  targetCell.protection = clone(sourceCell.protection);
}

function prepareRow(worksheet, rowNumber, templateRowNumber) {
  const sourceRow = worksheet.getRow(templateRowNumber);
  const targetRow = worksheet.getRow(rowNumber);
  targetRow.height = sourceRow.height;

  for (let col = 2; col <= 11; col += 1) {
    copyCellFormat(sourceRow.getCell(col), targetRow.getCell(col));
    targetRow.getCell(col).value = null;
  }

  return targetRow;
}

function setCell(row, col, value) {
  const cell = row.getCell(col);
  cell.value = value == null ? "" : value;
}

async function buildImprovementWorkbook(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("내보낼 데이터가 없습니다.");
  }

  const templatePath = await findTemplatePath();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);

  const worksheet = findTargetSheet(workbook);
  if (!worksheet) {
    throw new Error("대상 시트를 찾지 못했습니다.");
  }

  const firstDataRow = 5;
  const templateRowNumber = 5;
  const clearUntil = Math.max(worksheet.rowCount, firstDataRow + rows.length + 20);

  for (let rowNumber = firstDataRow; rowNumber <= clearUntil; rowNumber += 1) {
    prepareRow(worksheet, rowNumber, templateRowNumber);
  }

  rows.forEach((item, index) => {
    const rowNumber = firstDataRow + index;
    const row = prepareRow(worksheet, rowNumber, templateRowNumber);
    const no = index + 1;

    setCell(row, 2, no);
    setCell(row, 3, item.month || "");
    setCell(row, 4, item.date || "");
    setCell(row, 5, normalizeDept(item.department));
    setCell(row, 6, item.proposer || "");
    setCell(row, 7, item.title || "");
    setCell(row, 8, {
      formula: `IF(OR(I${rowNumber}="채택",I${rowNumber}="참가",I${rowNumber}="건의"),"아이디어","실시")`
    });
    setCell(row, 9, item.grade || "");
    setCell(row, 10, {
      formula: `IF(I${rowNumber}="채택",5000,IF(I${rowNumber}="참가",2000,IF(I${rowNumber}="건의",0,IF(I${rowNumber}="A",50000,IF(I${rowNumber}="B",20000,IF(I${rowNumber}="C",5000,""))))))`
    });
    setCell(row, 11, item.safety || "");
    row.commit();
  });

  worksheet.autoFilter = worksheet.autoFilter || { from: "B4", to: `K${firstDataRow + rows.length - 1}` };
  workbook.calcProperties.fullCalcOnLoad = true;

  return workbook.xlsx.writeBuffer();
}

module.exports = {
  buildImprovementWorkbook
};
