# 공유 설정

1. `firebase-config.sample.js`를 참고해서 `firebase-config.js`에 실제 Firebase 프로젝트 값을 넣습니다.
2. `window.APP_FIREBASE_ADMIN_EMAILS`에 수정 권한을 줄 Google 계정 이메일만 남깁니다.
3. `firestore.rules`의 이메일 목록도 같은 값으로 바꿉니다.
4. Firebase Console에서 Authentication의 Google 로그인을 켭니다.
5. Firestore Database를 만들고 `firestore.rules`를 배포합니다.
6. 이 폴더를 Firebase Hosting 또는 정적 웹 호스팅에 배포합니다.

동작 방식:

- 로그인한 사용자는 모두 조회 가능
- `APP_FIREBASE_ADMIN_EMAILS`에 있는 계정만 추가/수정/삭제/저장 가능
- 나머지는 읽기 전용으로 동일한 데이터를 봅니다
