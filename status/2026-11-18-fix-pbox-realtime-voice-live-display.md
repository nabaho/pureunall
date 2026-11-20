# P박스(pu-pbox) 실시간 음성인식 복구 및 발화 즉시 표시 모니터 추가

## 원인 및 해결
- **원인**: Windows Chrome에서 실험적 `SpeechRecognition.processLocally = true` 옵션이 한국어(`ko-KR`) 음성에 대해 오류 없이 무음 상태로 멈추는 브라우저 호환성 한계가 있었습니다.
- **해결**:
  1. 포털 타 앱(`pu-chatbot`, `pu-harass-view`, `pu-cal-capture`)과 동일한 브라우저 표준 실시간 `SpeechRecognition`(`ko-KR`, `interimResults: true`, `continuous: true`)을 클릭 즉시 동기로 시작하도록 수정했습니다.
  2. 마이크 대기(`🟢 마이크 켜짐`) → 발화 감지(`🔵 음성 인식됨 · 실시간 받아쓰기 중`) → 문장 완료(`✓ 음성 인식 완료`) 단계별 상태 배지와 파형 애니메이션을 추가했습니다.
  3. 발화 중인 미확정 음절(`interim`)까지 상단 **실시간 음성 인식 화면**(`#pboxVoiceLiveScreen`)과 아래 **입력창**(`#pboxPromptInput`)에 동시에 즉시 렌더링하고, 무음 구간 후에도 세션이 끊기지 않고 이어지도록 보완했습니다.
