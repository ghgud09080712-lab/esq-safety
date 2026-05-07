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

