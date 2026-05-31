# 법규등록부 GitHub / Cloudtype 배포 메모

## GitHub에 올릴 때

이 저장소는 로컬 실행 데이터와 API 키가 올라가지 않도록 설정되어 있습니다.

- 제외됨: `backend/data/`, `backend/safety-local-config.json`, `.env`, 임시 파일, 생성된 보기전용 HTML
- 포함됨: 앱 코드, Cloudtype 설정, 기본 법규등록부 시드 데이터

기본 명령:

```bash
npm ci
npm start
```

로컬 접속:

```text
http://127.0.0.1:4173/frontend/legal-registry/index.html
```

## Cloudtype 설정

Cloudtype은 `.cloudtype/app.yaml`을 사용합니다.

- Runtime: Node.js 20
- Start: `npm start`
- Port: `4173`
- Health Check: `/api/health`
- 법규등록부 주소: `/frontend/legal-registry/index.html`

권장 환경변수:

```text
NODE_ENV=production
PORT=4173
DATA_DIR=/data
FIREBASE_DEPLOY_ENABLED=false
LAW_OPEN_API_OC=공동활용법령정보_OC값
GEMINI_API_KEY=Gemini_API_키
```

`LAW_OPEN_API_OC`, `GEMINI_API_KEY`는 GitHub에 올리지 말고 Cloudtype 환경변수에만 넣으세요.

## 데이터

Cloudtype 최초 실행 시 `backend/seeds/legal-registry.seed.json`을 기준으로 법규등록부가 생성됩니다.
실행 후 수정 데이터는 `DATA_DIR` 위치에 저장됩니다.

## 웹 링크 생성

Cloudtype에서는 `웹 링크 생성` 버튼이 Firebase 배포를 실행하지 않고, 현재 Cloudtype 서버의 `/exports/...html` 주소를 생성합니다.
로컬에서 Firebase 배포까지 하고 싶으면 환경변수로 아래를 설정합니다.

```text
FIREBASE_DEPLOY_ENABLED=true
```
