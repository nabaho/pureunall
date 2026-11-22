# 포털 오케스트레이션 진입점 단일화 (내부관리 타일 1개로 통합 · 2026-11-22)

## 배경 및 대표님 지시
- 대표님 지시: *"오케스트레이션이 2개인데 불필요하다 하나만 있으면 된다"* → **`내부관리` 줄의 `오케스트레이션` 타일 하나만 남기고, 위쪽(`업무 시스템` 줄 오른쪽) 알약 단추(`#orchFab`) 제거**로 결정.

## 주요 변경 사항
1. **상단 중복 알약 단추(`#orchFab` · `#orchFabBadge`) 제거 (`enter.html`)**
   - `업무 시스템` 줄 오른쪽에 중복으로 떠 있던 `#orchFab` 마크업·스타일·배선 코드를 모두 걷어내고, 포털 진입점을 `오케스트레이션` 앱 타일 하나로 단일화함.
   - 타일(또는 `바통 N` 배지)을 클릭하면 기존과 동일하게 현재 화면 위 컴팩트 팝업(`#orchModal`)이 열림.
2. **오케스트레이션 기본 소속 줄을 `내부관리`(`inside`)로 일원화 (`enter.html`, `js/pu-appbar.js`, `js/pu-chatbot-kb.js`)**
   - `APPS` 등록 `row`를 `'store'`에서 `'inside'`로 맞추고 `ROW_MOVED_FROM.orch = 'store'`를 추가하여 초기·복원 시에도 `내부관리` 줄에 일관되게 자리잡도록 정리함.
   - 공용 앱바(`js/pu-appbar.js`) 및 길잡이 챗봇(`js/pu-chatbot-kb.js`)의 영역 안내도 `내부관리` 줄과 동기화함.
3. **타일 알림 배지(`.tile .tile-alert`) 명암비 및 키보드 접근성 보완 (`enter.html`)**
   - `.tile span` 규칙(`color: var(--mute)`)이 `<span class="tile-alert">`의 흰 글자를 덮어써 붉은 바탕 위 회색 글자로 흐려 보이던 문제를 `.tile .tile-alert{color:#ffffff;}`로 바로잡음.
   - `#portalOrchBadge`에 `role="button"`, `tabIndex=0`, `Enter`/`Space` 키 처리를 추가함.
