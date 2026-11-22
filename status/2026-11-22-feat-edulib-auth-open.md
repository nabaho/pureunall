# 2026-11-22 · feat/edulib-auth-open — 강의자료 원본 열기를 «권한 확인» 길로

대표가 고른 일(제안 카드 「강의자료 원본 열기를 권한 확인 방식으로 바꾸기」 → «여기서»).

## 바꾼 것
- `js/pu-edulib-app.js` — 원본 미리보기·내려받기·영상/그림 보기가 모두 `fetchOriginal` 한 길을 탄다.
  - 창고 내려받기 토큰 주소(`getDownloadURL`)를 만들지 않는다. 지금 로그인한 사람의 ID 토큰을 `Authorization: Firebase …` 머리글에 실어
    `firebasestorage.googleapis.com/v0/b/…/o/…?alt=media` 에 직접 묻는다 → 창고 규칙 `isStaff()`(재직 직원)를 «열 때마다» 거친다.
  - 쿠키·리퍼러를 안 보내고(`credentials:'omit'`·`no-referrer`), 받은 바이트는 이 창의 `blob:` 주소로만 쓴다(칸·창을 닫으면 풀어 줌).
  - 칸을 닫으면 그 칸이 받던 것만 멈춘다(`stopFetches(root)` — `closeFrames` 가 부른다). 내려받기는 창을 닫아도 끝까지 받는다.
  - 내려받기: 받는 동안 단추에 % 표시·두 번 눌러도 한 번만, 받은 뒤 `blob:` 로 저장(새 탭에 창고 주소를 띄우지 않는다).
  - 영상·소리는 «다 받은 뒤» 재생한다(머리글을 실은 채 흘려 보기는 브라우저가 못 한다). 150MB 넘는 것은 «▶ 받아서 보기»를 눌러야 받는다.
- `scripts/edulib-revoke-download-tokens.js` — 창고 `edulib/` 파일의 `firebaseStorageDownloadTokens` 하나만 지우는 도구. 기본은 «보기만»(개수),
  `--apply` 때만 바꾸고 `ifMetagenerationMatch` 로 그 사이 바뀐 것은 건너뛴다. 토큰 값은 출력하지 않는다. **아직 돌리지 않았다**(대표 허락 필요 · STATUS.md 2절).
- `tests/edulib-auth-open.test.js` — 7개(토큰 주소 금지·증표 머리글·권한 실패·칸별 멈춤·blob 저장·큰 영상은 눌러야·스크립트 범위).
- `pu-edulib.html` — `pu-edulib-app.js?v=7`.
- 창고 규칙은 그대로(`edulib/{id}/{file}` 읽기 `isStaff()`) — 바꿀 것 없음.

## 확인한 것
- 창고 CORS 사전 요청(OPTIONS)이 `Authorization`·`Range` 머리글을 받는다(2026-11-22).
- 실제 주소(크롬, 로그인된 직원 화면 — 읽기만): 증표를 실으면 200·받은 바이트 = 기록의 크기, 증표 없음·가짜 증표는 403.
- 관련 검사 62건, 전체 검사 30,855건 실패 0. 폰 점검 375px 10개 화면 문제 0.

## 못 한 것
- 1GB 넘는 강의 영상(3건)을 새 길로 «받아서 보기» 끝까지는 해 보지 않았다(받는 시간이 길다 — 사무실 망에서 처음 열 때 확인).
- 토큰 정리 스크립트는 보기만도 돌리지 않았다(창고 목록 읽기는 살아 있는 자료 읽기라 배포 뒤 허락과 함께).
