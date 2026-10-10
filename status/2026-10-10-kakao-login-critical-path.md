# 2026-10-10 · 카카오 휴대전화 로그인 마지막 명부 대기 제거

대표 제보: 폰에서 카카오 로그인까지 여전히 10초 이상 걸린다.

- 운영 기록에서는 카카오 인증 서버 자체가 대체로 1초 안팎이었다. 인증 뒤 포털은 `data/user_dir` 읽기에 최대 3.5초, 실패하면 관리자 명부에 또 최대 3.5초를 기다릴 수 있었다.
- `kakaoLoginFinish`가 이미 확인한 로그인 계정의 최소 포털 정보(사번·이름·직책·역할·재직 상태)만 인증표와 함께 돌려준다. 명부의 다른 사람이나 민감 필드는 응답에 싣지 않는다.
- 화면은 Firebase 인증 계정 이메일과 서버 정보의 사번이 같을 때만 이 정보로 바로 타일을 그린다. 정보가 없거나 어긋나면 종전 명부 조회를 쓴다.
- 서버 명부 조회는 최대 0.7초로 제한한다. 포털 표시까지 단계별 시간을 탭 저장소에 남겨 다음 휴대전화 제보에서 어느 단계가 남았는지 구별한다.
- 확인: `tests/kakao-login.test.js`, `tests/kakao-first-login.test.js`, `tests/kakao-login-fast.test.js`, 전체 `node --test tests/*.test.js`, `node scripts/check-cache-version.js`.
- 배포: GitHub Pages 화면 + `kakaoLoginFinish` 함수만 별도 배포. 실제 휴대전화 카카오·네트워크 왕복 시간은 배포 뒤 다시 재야 한다.
