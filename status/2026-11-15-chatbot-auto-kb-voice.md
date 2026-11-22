# 2026-11-15 시스템 길잡이 챗봇 신규 프로그램 무보수 자동 업데이트 & 음성 질문·음성 답변 구축

## 한 일
1. **신규 프로그램 무보수 자동 감지·사용법·연결도 엔진 (`Zero-Touch Auto-Sync`)**
   - `enter.html`에 `window.portalAppCatalog()`를 추가해 포털 줄 구성(`APP_ROWS`)과 전체 앱 목록(`APPS`)을 길잡이 챗봇에 실시간 노출하고, `window.portalLaunchApp`이 머리줄 앱(`#headApp_cal`)도 함께 실행하도록 보강했습니다.
   - `js/pu-chatbot-kb.js`에 `syncCatalog()`, `extractHtmlAppDetail()`, `detectMentionedApps()`를 구현해 앞으로 `enter.html`과 `js/pu-ontology.js`(`PROGRAMS`)에 새롭게 추가되는 어떤 프로그램이라도 KB 수동 편집 없이 ① 소속 줄·권한 정책, ② 온톨로지 입출력 연결도(`sharedRoots` / `primaryRoots` / `writeContracts` / `localOnly`), ③ 동일 출처 `<app>.html`의 단계·탭·주요 단추를 자동 분석하여 `[채팅]`, `[연결도]`, `[사전]`, `makePrompt`, 개선요청 분류(`detectImproveIntent`) 전 영역에서 즉시 답변합니다.
   - 최근 추가된 `괴롭힘·성희롱 조사`(`harass`), `일터상생혁신`(`ilteo`), `산업일자리전환`(`jobtrans`), `급여데이터함`(`paydata`)까지 29개 활성 앱 전체 안내를 최신화했습니다.
2. **음성 질문(STT `🎤`) 및 음성 답변(TTS `🔊`) 지원**
   - `js/pu-chatbot.js` 하단 입력줄에 `🎤` 음성 질문 단추(`#puChatMic`), 실시간 음성 인식 바(`#puChatVoiceBar`), `🔊` 음성 답변 설정 단추(`#puChatTtsBtn`), 말풍선별 `[🔊 듣기]` / `[⏹ 멈춤]` 칩을 추가했습니다.
   - 한국어 `SpeechRecognition`(`ko-KR`)으로 기기 내에서 먼저 텍스트로 변환한 뒤 반드시 개인정보 가림(`maskPersonal`)을 거쳐 전송하며(원본 녹음 오디오 외부 서버 직접 전송 차단), 창 닫기·로그아웃 시 진행 중인 음성 세션을 즉시 무효화해 지연 콜백 오작동과 공용 PC 잔류를 막았습니다. 답변은 `speechSynthesis`(`ko-KR`, `cleanTextForSpeech`)로 기호·경로를 정돈한 자연스러운 한국어 음성으로 자동 재생합니다.

## 검증
- `node scripts/check-cache-version.js --all`
- `node --test tests/portal-chatbot.test.js tests/portal-cal-head-button.test.js tests/fund-stock-qa-history.test.js tests/ontology-contract.test.js tests/color-palette-apps.test.js tests/phone-input-zoom.test.js tests/no-real-client-data.test.js tests/dev-tools-not-published.test.js`
- `node --test tests/test-pin-guard.test.js`
