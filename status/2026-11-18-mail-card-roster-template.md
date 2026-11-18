# 2026-11-18 feat/mail-card-roster-template

## 변경 요약
- **확정 메일 명함 양식(`① 품격 골드·네이비 카드형`) 전 직원 적용** (`pu-cards.html`, `functions/mail-send.js`, `functions/mail-deliver.js`):
  - 대표 확정 `메일명함.html` 1번 양식(상단 네이비 68%·골드 32% 바, 무궁화 휘장·법인명·홈페이지 링크, 우측 직책·성명·담당분야·근로자명부 휴대폰/대표번호·이메일, 투톤 구분선, 하단 천안본사·서산지사 2단 표)을 `signCardHtml` 및 캔버스 명함 생성기(`renderPureunCardDataUrl`)에 적용.
  - 서버 HTML 세척기(`functions/mail-send.js`)에서 안전한 전화 걸기 링크(`tel:+?[0-9-]{7,20}`)와 여백 속성을 허용해 수신 측 메일함에서도 디지털 명함 표와 전화 연결이 깨지지 않도록 보강.
  - 개인 메일 발송 시 보내는사람 표시명을 `푸른노무법인 {이름} {직책} <발송주소>` 형태로 자동 표기(단체 묶음 발송 제외).
- **푸른노무법인 근로자 명부(`user_accounts`) 연락처·직책 자동 연동** (`pu-erp.html`, `pu-cards.html`, `functions/mail-deliver.js`):
  - 일반 직원이 `data/user_accounts` 전체(민감정보 포함)를 직접 읽지 못하고 동료 연락처를 임의 수정하지 못하도록, HRW(관리자·위임관리인·재무) 전용 쓰기 경로인 `data/company_info/v/staffCards` 에 현직(`active`) 직원의 명함 표시용 항목(`이름·직책·연락처·지사`)만 원자적으로 동기화(퇴직·입사예정·삭제·사번변환 항목 자동 제외, 슬림 `user_dir` 오덮어쓰기 차단).
  - 메일함(`pu-cards.html?view=mail`) 진입 시 로그인 직원의 근로자 명부 이름·직책·연락처를 자동으로 읽어 디지털 명함 서명(`mode: 'card'`)과 첨부 명함 이미지에 반영하고, 비동시 로딩 시 `grabCompose` 선행으로 작성 중인 글 유실을 막으면서 초기 대표번호(`Tel.`)를 휴대폰(`Mobile.`)으로 자동 갱신.

## 검증
- `node --test tests/mail-card-roster-template.test.js tests/cards-sign-digital.test.js tests/cards-mail-security-note.test.js tests/cards-my-sign.test.js tests/mail-auto-mycard.test.js` 통과
