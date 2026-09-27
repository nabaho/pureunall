# 2026-09-27 · feat/kakao-login — 카카오로 로그인

대표 지시 「로그인기능을 카카오톡과 연결시킬수 있나?」 → 「추천대로」. 다른 방에서 짜다 커밋 없이 멈춘 것을 이어받아 마무리.

## 한 것
- 서버 `functions/kakao.js` — 창구 넷(kakaoAuthUrl·kakaoLink·kakaoUnlink·kakaoLoginFinish), 서울 리전, 지문 로그인과 같은 짜임.
  카카오에서는 **회원번호 하나만** 받는다(동의항목 없음).
- 화면 `js/pu-kakao.js` + `enter.html` — 로그인 화면 「💬 카카오로 로그인」, 이름·아바타를 누르면 「내 정보 › 카카오 연결/끊기」,
  관리자 설정 「💬 카카오 로그인 현황」(누가 연결했나·대신 끊기).
- 규칙 — 로그인 인정에 `auth.token.kakao === true` 추가, `uid_kakao`(본인·관리자 읽기, 쓰기 없음). `kakao_links` 는 서버 전용(규칙 없음).

## 이어받으며 막은 구멍
1. 다른 카카오로 «바꿔» 연결하면 옛 카카오로 계속 들어오던 것 → 옛 길을 지운다.
2. state 가 'login'/'link' 뻔한 값 → 탭마다 만든 무작위 값으로, 돌아올 때 같은지 본다(남의 인가코드를 내 계정에 붙이는 CSRF).
3. 위임관리인(isSubAdmin)이 「관리자는 비밀번호로만」에서 빠져 있던 것 → 규칙 MGR 과 같은 잣대.
4. 퇴사자·익명 로그인 증표로 연결·로그인 되던 것 → 재직자(status active)만.
5. 관리자 현황 표의 사번을 화면이 보낸 값으로 적던 것 → 명부(uid_roles)에서.

## 규칙 올릴 때 멈춘 것
- 안전장치가 `/data/staff_colors/v/$sid`(담당자가 제 색을 고르는 칸)가 사라진다고 멈췄다.
  `staff-pick-color` 가지(pu-wt-calfill, 커밋 전)가 콘솔에 먼저 올린 것이었다 → 그 가지의 만들개 글자를
  **그대로** 옮겨 넣고 올렸다(그 가지가 합쳐질 때 같은 내용이라 충돌 없음). 콘솔 대조: 카카오 한 마디 + uid_kakao 외 차이 0.

## 검사
- `tests/kakao-login.test.js` — 서버 함수를 가짜 DB·가짜 카카오로 «실제로 돌려» 본다. 돌연변이 9개 모두 걸림.

## 남은 일
- 대표님: 카카오 Developers 에 Redirect URI `https://nabaho.github.io/pureunall/enter.html` 등록 여부 확인(서버 비밀키 둘은 이미 등록돼 있음).
- 실제 폰·PC 로 연결 → 로그아웃 → 카카오 로그인 한 번(직원 계정으로).
