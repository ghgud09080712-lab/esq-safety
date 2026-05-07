# ESQ 안전사고 통합관리 시스템 Cloudtype 배포

## Cloudtype 설정

- Runtime: Node.js 20
- Install Command: `npm ci --omit=dev`
- Build Command: 비움
- Start Command: `npm start`
- Port: `4173`
- Health Check: `/api/health`
- 접속 경로: `/safety`

## 기본 로그인 계정

- 중앙관리자: `admin / admin1234`
- 부서사용자: `dept / dept1234`
- 생산1부: `생산1부 / 1234`

## 주의

현재 데이터는 서버 로컬 JSON 파일(`backend/data`)에 저장됩니다.
Cloudtype에서는 재배포 또는 컨테이너 재시작 시 로컬 파일 데이터가 유지되지 않을 수 있으므로,
실운영 전에는 Firebase, PostgreSQL, MongoDB 같은 외부 DB로 이전하는 것을 권장합니다.
