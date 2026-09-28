# 2026-09-28 · 공용 PC 카카오 막이 — 서버 배포 (chore/kakao-shared-pc-deployed)

- 대표 「올려라」 → `kakaoAuthUrl`(asia-northeast3) 손 배포 완료.
- 살아 있는 서버로 확인: `kind=logout` → /oauth/logout · `prompt=login` → prompt=login · 기본 → prompt 없음. 돌아올 곳 모두 enter.html.
- 남은 것: 카카오 콘솔 「로그아웃 리다이렉트 URI」 등록(대표 손). 등록 전엔 카카오로 들어온 사람이 로그아웃하면 카카오 오류 화면이 뜬다.
