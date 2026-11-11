# 2026-11-11 — 푸른포털 통합 AI 챗봇 (`enter.html` 머리줄 `#chatFab` · `js/pu-chatbot-kb.js` · `js/pu-chatbot.js`)

## 요청 및 결정 사항
- 포털(`enter.html`) 첫 화면에서 **① 푸른통합시스템 전체 앱 사용법 안내 + ② 노동법·기업정부지원금·근로복지기금 법령/유권해석 통합 AI 질의응답 + ③ 기존 전문 챗봇(`fund.html` 등) 연동**을 모두 아우르는 통합 챗봇 구축.
- 위치 및 형태: 포털 상단 머리줄(`.pbar`)의 `💬 건의하기`(`#sgFab`) 바로 왼쪽에 파란 `🤖 챗봇`(`#chatFab`) 단추를 두고, 클릭 시 드래그 이동형 플로팅 메신저 창(`#puChatWin`)으로 열기.

## 주요 구현 내용
1. **통합 지식베이스 및 RAG·보안 엔진 (`js/pu-chatbot-kb.js`)**:
   - `system`(푸른포털 4대 영역 전체 앱 안내, 서류 촬영→판독→내보내기 흐름, 정부사업일정·컨설팅보고서·정부사업신청·기업정부지원금 구분 등), `labor`(연차·사용촉진, 주52시간·가산수당, 2024.12 대법원 전원합의체 통상임금 법리, 퇴직급여·IRP, 해고·구제신청, 근로계약서·기간제, 직장 내 괴롭힘, 모성보호, 취업규칙 불이익변경, 주휴수당·최저임금, 산재), `govaid`(청년일자리도약, 고령자 계속고용, 출산육아기, 정규직 전환·고용촉진, 워라밸·유연근무, 고용유지, 정부지원 컨설팅) 내장 사전 수록 및 `fund_kb.js`(`FUND_KB`) 유권해석 전체 자동 병합.
   - `maskPersonal()`: AI 호출 전 주민등록번호(하이픈 유무 모두), 사업자번호, 전화번호, 이메일, 계좌번호, 사건번호, 업체명, 성명+직함 자동 마스킹 및 프롬프트 펜스(`<<< >>>`) 탈출 기호 제거.
   - `parseReply()`: 근거자료(`picked`)에 없는 환각 인용 ID 와 현재 사용자에게 허용되지 않은 앱 키(빈 배열 `[]` 포함) 자동 제거.
2. **플로팅 메신저 창 및 사전·원문 보기 (`js/pu-chatbot.js`)**:
   - `backdrop-filter` 좌표 틀어짐을 피하기 위해 `#puChatWin`·`#puChatDocModal`을 `document.body` 직계 자식으로 부착하고, 푸른 27색 팔레트만 사용해 스타일 구성(모바일 입력칸 `16px` 자동 확대 방지 포함).
   - 챗봇을 열 때만 `fund_kb.js`를 지연 로드(1.5초 안전 타임아웃 포함)해 포털 초기 진입 속도를 그대로 유지.
   - 서버 AI 대리인 `PuAiCall.ask`(`app: 'portal'`, `manual: true`) 우선 호출 및 내장 근거 답변 즉시 표시(한도 초과·네트워크 오류 시에도 근거 답변 유지), `[📚 통합사전]` 키워드 검색, 근거 원문 열람 모달(`#puChatDocModal`) 제공.
   - 로그아웃 시(`resetOnLogout`) 대화 내역 즉시 삭제, 창 닫기, `STATE.epoch` 증가로 진행 중이던 이전 세션의 지연 AI 응답 오염 차단.
3. **포털(`enter.html`) 및 기금관리(`fund.html`) 연동**:
   - `enter.html`: `.pbar` 내 `#sgFab` 왼쪽에 `#chatFab` 배치(380px 이하 초소형 화면에서는 아이콘 알약으로 축소해 머리줄 1줄 고정 유지), `window.portalLaunchApp`으로 타일의 표시 여부·`aria-disabled`(`준비중`)·`href="#"`(`PC 전용`)·권한을 검증한 뒤 앱 실행, 로그아웃(`broadcastLogout`·`onAuthStateChanged`) 시 챗봇 초기화 연동.
   - `fund.html`: 포털 챗봇의 `[💬 기금 전문 챗봇으로 열기]`(`fund.html?sso=1&chat=1`) 진입 시 `openFundChat()` 자동 실행 후 `history.replaceState`로 주소창에서 `chat=1`을 제거해 새로고침 갇힘 방지.

## 검증
- 신규 테스트 `tests/portal-chatbot.test.js` (8개 시나리오) 통과 + 뮤테이션 테스트 **8/8 전수 포착 확인**.
- 기존 파수꾼(`color-palette-apps`, `portal-header-compact`, `portal-bar-tidy`, `portal-phone-landing`, `portal-phone-edge`, `phone-input-zoom`, `phone-screen-rules`, `dead-code`, `html-inline-script-syntax`, `enter-security`, `ai-key-vault-only`, `test-pin-guard`, `fund-chatbot`, `pair-guards`) 및 전체 저장소 테스트 통과.
