# 2026-09-29 · 포털 — 카카오 「로그인하는 중…」을 줄인다

- 대표 제보: 「창이 너무 오래 떠있다 로그인 되는데 좀 빨리 넘어가게 해라」
- 잰 것(서버 기록 `firebase functions:log --only kakaoLoginFinish`): 성공한 다섯 번 모두 함수 «안»에서만
  **1.9~2.5초** (+ 식은 함수가 깨어나는 시간). 로그인 간격이 길어 매번 새로 뜬 함수가 카카오 답을 다 받은
  «뒤에야» DB 연결을 맺었다. 차례: 카카오 토큰 → 회원번호 → DB 연결+연결기록 → 재직 → 표 서명.

## 한 것 (돈 드는 «늘 켜 둔 서버»는 안 씀)

- `functions/kakao.js` kakaoLoginFinish — `GET ?warm=1` 이면 DB 연결만 열고 204(아무것도 읽어 주거나 쓰지 않음).
  POST 는 카카오에 묻기 «전에» DB 연결을 연다(동시에). 단계별 시간을 기록에 남긴다(사람 정보 없음).
- `js/pu-kakao.js` — `warm()`(1분에 한 번) · 노란 단추(goLogin)가 카카오로 떠나기 전에 깨운다. 캐시 번호 v=4.
- `enter.html` — 카카오 쓰는 기기면 로그인 화면이 뜰 때 깨운다 · 서버 답을 기다리는 동안 화면 DB 연결을 먼저 연다.
- 검사 `tests/kakao-login-fast.test.js`(5) · `kakao-login.test.js` 한 곳(깨우기 부름은 빼고 센다). 전체 20,620 통과.

## ⚠ 배포해야 돈다

- `firebase deploy --only functions:kakaoLoginFinish --project pureun-erp` (작업방이면 functions/ 에서 npm install 먼저).
- 배포 뒤 확인: 로그에 `[kakaoLoginFinish] 카카오 …ms · 연결기록 …ms · 재직 …ms · 표 …ms` 가 찍히는지.
