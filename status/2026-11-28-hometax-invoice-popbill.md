상태: 진행 중(시험 단계)
가지: feat/hometax-invoice-popbill

# 홈택스 매출 세금계산서 자동 수집 — 팝빌 홈택스수집(세금) (2026-11-28 대표 「테스트로 시작」)

## 왜
- 이카운트 오픈API 에는 세금계산서 «조회»가 없다(입력만). 국세청도 홈택스 조회 API 를 열지 않았다.
- 이카운트 발행분도 국세청으로 전송되므로, 홈택스에서 받으면 이카운트 발행분과 다른 곳 발행분이 모두 들어온다.
- 팝빌이 홈택스 «부서사용자»(조회 전용 아이디)로 대신 수집 → 매일 자동, 대표 로그인 불필요.

## 한 것
- `functions/hometax-invoice.js` — 매일 07:10 `hometaxInvoicePull`, 「지금 받기」 `hometaxInvoicePullNow`(재무 권한자). 지난 7일(전송일자) 매출 계산서를 받아 `invoice_arc/h` 에 더한다.
  - 같은 승인번호는 두 번 안 쌓임. 엑셀·이카운트로 이미 있는 같은 계산서(같은 작성일·공급가액·사업자번호)는 그 줄에 승인번호만 붙임.
  - 주민번호·외국인 번호·대표자 이름·메일·비고는 담지 않음.
  - **시험 모드(처음 값)는 보관함에 쓰지 않는다** — 읽은 건수만 상태에 적음.
- 이알피 세금계산서 › 업체별 아카이브 맨 위 한 줄 띠(`HometaxPullStrip`) — 상태·지금 받기·⚙ 설정(관리자: 매일 자동·시험/운영·법인 사업자번호).
- 규칙 `hometax_pull` — 읽기 재무, cfg 쓰기 관리자, status·lock 은 서버만. 적용본·붙여넣기 파일 재생성. 온톨로지 fin primaryRoots 에 등록.
- `functions/package.json` 에 `popbill@1.64.2`(공식 SDK, 부를 때만 싣는다). ⚠ 이 꾸러미는 자기 자신을 `file:` 로 가리키는 의존성이 있다 — `npm ci` 는 정상 확인함.
- 검사 `tests/hometax-invoice-pull.test.js` 16개 통과 · 변이 15종 모두 잡힘. 규칙·온톨로지·성능규칙 검사 통과.
- 팝빌 시험 서버 실제 연결 확인 — 공개 예제 열쇠는 «자기 연동 열쇠를 쓰라»(-99010013)로 거절됨. 실제 시험은 대표 연동 열쇠가 있어야 한다.

## 못 한 것 (사용 한도로 멈춤)
- 전체 검사(`node --test tests/*.test.js functions/*.test.js`) 미실행 · Orca 자동 점검(ow pipeline) 미실행 · 화면 갈무리 확인 미완(점검 도구 `fin` 씨앗에 상태 자료만 넣음).
- 설정 안내 문서 `docs/재무/홈택스-자동수집.md` 아직 없음(코드 주석이 그 이름을 가리킨다).
- 규칙 콘솔 배포(`node scripts/rules-deploy.js --deploy`)는 합친 뒤.

## 대표가 할 일
1. 홈택스 부서사용자(수집 전용, 세금계산서 조회 권한) 만들기·승인.
2. 팝빌 연동 신청·정액제 → LinkID·SecretKey 받기, 팝빌에 부서사용자 직접 등록.
3. 비밀값 넣기: `firebase functions:secrets:set POPBILL_LINK_ID` · `firebase functions:secrets:set POPBILL_SECRET_KEY` (값은 대표가 직접 입력).
4. 그 «뒤에» 함수 배포: `hometaxInvoicePull,hometaxInvoicePullNow` — 비밀값 없이 배포하면 멈춘다.
5. 이알피 ⚙ 에서 법인 사업자번호·매일 자동 켜기 → 시험 결과 확인 → 운영으로 전환.
