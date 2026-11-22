상태: 코드 끝남(함수 배포·카카오 콘솔 설정·연결은 대표 확인 뒤)
이어하기시도: 0
작업폴더: C:\Users\user\Desktop\github\pureunall\.claude\worktrees\govaid-1a3b2a
가지: claude/gov-digest-kakao-official

# 🎯 정부사업신청 매일 카톡 요약 — 카카오 공식 «나에게 보내기»(서버)

대표 지시 2026-11-22 「카카오톡으로 매일 받고 싶다 — 내 개인톡으로」(앞 PR #3238 = PC 카톡 자동 입력 길) → 보안 검토에서 «창 제목만으로 진짜 나와의 채팅을 가릴 수 없다»가 남아 → 대표 **「공식 방식으로」**.

## 한 것
- [x] 엔진을 서버로: `scripts/gov-digest/digest.js` → `functions/gov-digest.js`(원본) · 공용 모듈 사본 `functions/vendor/gov-{recruit,region,ai,pick}.js`(js/ 와 바이트까지 같음 — 검사가 맞댄다). PC 미리보기(`scripts/gov-digest/`)는 같은 엔진을 불러 쓴다
- [x] `functions/gov-digest-kakao.js` — 글 만들기(갈래마다 한 통·200자·«전체 보기» 단추) · 카카오 호출(`/v2/api/talk/memo/default/send`, 성공은 result_code 0 하나) · 토큰 갱신(client_secret 포함, 새 refresh_token 은 응답에 있을 때만) · 401 이면 한 번 갈아 끼우고 재시도 · 길이로 거절(400)이면 더 짧게 한 번 더 · 한 통이 막히면 멈춤 · 통마다 «보냄» 기록 · 잠금 · 모드 off/dry/live
- [x] 예약 함수 `govDigestKakao`(매일 08:30, 서버 수집 07:20·07:40·08:10 뒤) — `functions/index.js`
- [x] 연결 `functions/kakao-memo.js`(+핵심 `kakao-memo-core.js`) — `kakaoMemoStart`(서명한 state 달고 카카오 동의 화면으로) · `kakaoMemoCallback`(state 한 번만 쓰게 확인 → 토큰 교환 → **동의한 카카오가 ERP 에 연결된 총괄 관리자인지 확인** → 서버 전용 자리에 저장 → 확인 글 «나에게» → 모드가 비어 있으면 live). 로그인용 `functions/kakao.js` 는 안쪽 도구 내보내기 한 줄만 더함
- [x] 화면 `gov.html?digest=1` «📮 오늘의 요약» 팝업(읽기만, 이스케이프·https 링크만) — 카톡 «전체 보기» 단추가 연다. `pickAuto` 는 ?digest=1 이면 물러난다
- [x] 보안규칙 `gov_digest`(읽기 재직 직원·쓰기 아무도) — **2026-11-22 콘솔에 올림**: 새로 생긴 규칙 1개(/gov_digest), 바뀜 0·사라짐 0, 다시 읽어 같음. 새 기준 `docs/firebase-rules-콘솔원문-2026-11-22.json`
  · 누가 보게 됐나: `gov_digest` 는 재직 직원(gov_feed·gov_watch 와 같은 사람)이 «읽기만». `gov_digest_secret`(카카오 토큰)·`gov_digest_state`·`gov_digest_cfg` 는 규칙에 없어 화면에서 읽기·쓰기 모두 닫힘(서버만)
- [x] 구조 검사 맞춤: 사용액 창 자동 일정 문구·하루 횟수 572·스케줄 34개(billing-auto-truth) · 온톨로지 저장 자리 주인(govbid.primaryRoots) · 성능 규칙 허용 최상위
- [x] 검사: `functions/gov-digest-kakao.test.js` 38건 · `tests/gov-digest-view.test.js` 4건 · 엔진 `tests/gov-digest.test.js` 40건. 서버 코드를 39곳 망가뜨려 봐 모두 잡힘(임시 복사본)
- [x] 폰 화면 점검(가짜 파이어베이스, `node tools/phone-audit/run.mjs govbid --view=digest`): 360·411px 에서 «📮 오늘의 요약» 팝업 옆넘침·짓눌림·작은 단추 0, 눈으로도 확인(경고·갈래·새/마감 임박 표시·위험 주소는 글자로만). 점검 자료 `tools/phone-audit/seeds/govbid.js` 에 지어낸 요약 더함
- [x] 자동 검증(제미나이)·보안 검토(코덱스) 1차 → 반영 → 재검증 1회차 → 반영 → 재검증 2회차(마지막). 고친 것: 보내기 직전마다 자격 재확인(총괄 관리자·재직·대표 표지·ERP 카카오 연결 지문) · 연결 때 대표 표지 확인 + 확인 글이 간 뒤에만 토큰 저장 · 보내기 직전 inflight 기록(갔는지 모르면 자동 재발송 안 함, 5xx·잘린 응답도 «모름») · 갈아 낀 토큰은 조건부 한 번에 저장(다시 연결한 토큰·지운 기록을 안 덮음) · 오래된 기록 덜어 내기가 방금 쓴 기록을 안 지움 · 연결표 옛 열쇠 폴백
  **고치지 않은 것(사람이 판단)**: 시작 주소(kakaoMemoStart)가 공개이고 state 를 브라우저에 묶지 않음 — 콜백이 «동의한 카카오가 대표 표지의 총괄 관리자인가»를 확인해 다른 카카오는 토큰을 못 맡기고 로그인용(kakaoLoginFinish)과 같은 설계라서 · state 사용 기록이 쌓이는 것은 로그인용과 같은 수준

## 아직 (대표 확인 뒤)
- [ ] 카카오 개발자 콘솔 설정 세 곳(README «대표가 한 번 하실 일») — 동의항목 talk_message · Redirect URI `https://asia-northeast3-pureun-erp.cloudfunctions.net/kakaoMemoCallback` · 웹 도메인 `https://erp.pureunlabor.co.kr`
- [ ] 함수 배포(`govDigestKakao`·`kakaoMemoStart`·`kakaoMemoCallback`) — 이 PR 이 합쳐진 뒤 GitHub 작업 「Firebase 배포」
- [ ] 대표가 `kakaoMemoStart` 주소를 열어 동의 한 번 → 확인 글 도착 → 다음 날 08:30 부터 매일
- ⚠ 확인 못 한 것: 카카오 «나에게 보내기»의 하루 한도(문서에 발신자 100·pair 20 이 나에게 보내기에도 걸리는지 불분명 — 하루 세 통 안쪽으로 보냄) · 텍스트 200자가 글자 수인지 바이트인지(어기면 짧은 글로 한 번 더) · 실제 카카오 호출은 아직 한 번도 안 했다(토큰이 없어서)
