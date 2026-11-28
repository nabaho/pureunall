# 2026-11-28 컨설팅 전용 앱 12종(6차산업 포함) · 카톡/문자 자료수집 허브 · 수습 RAG 실무코치 구현

## 변경 내용
- **신규 12개 컨설팅 전용 앱(`row: 'client'`)**:
  - `techprotect.html` (`scal_techprotect`) — 기술보호컨설팅
  - `clinic.html` (`scal_clinic`) — 현장클리닉
  - `chamber.html` (`scal_chamber`) — 상공회의소컨설팅
  - `hrconsult.html` (`scal_hrconsult`) — 기초인사노무
  - `evalcomp.html` (`scal_evalcomp`) — 평가보상·임금체계
  - `pubconsult.html` (`scal_pubconsult`) — 공공기관컨설팅
  - `familywork.html` (`scal_familywork`) — 출산육아·유연근무
  - `socialent.html` (`scal_socialent`) — 사회적기업·씨앗
  - `sixthind.html` (`scal_sixthind`) — 6차산업컨설팅 (농촌융복합 현장코칭·인증)
  - `laboraudit.html` (`scal_laboraudit`) — 자율점검·근로감독
  - `unionneg.html` (`scal_unionneg`) — 민간노조·단체교섭
  - `specialcons.html` (`scal_specialcons`) — 특화·위탁컨설팅
- **신규 2개 자료함 통합 허브(`row: 'store'`)**:
  - `pu-msg-intake.html` (`msg_intake`) — 카카오톡 대화(`.txt`)·문자(SMS)·웹훅(`consultMsgIngest`) 2중 비식별 자동분류·배정 허브
  - `pu-coach.html` (`coach_rag`) — 수습·주니어 노무사 하이브리드 RAG 검색·플레이북·수행사례·학습노트 허브
- **공통 모듈 & 서버 연동**:
  - `js/pu-consult-catalogs-*.js`, `js/pu-consult-intake.js`, `js/pu-consult-rag.js`, `js/pu-consult-hwpx.js`, `js/pu-consult-view.js`
  - `functions/msg-intake-server.js`, `functions/index.js` (`consultMsgIngest`), `functions/doc-read.js` (14종 앱 엄격 PII 가림)
  - `scripts/make-firebase-rules.js` & `scripts/backfill-consult-suite.js` (`--dry-run` 검증)
