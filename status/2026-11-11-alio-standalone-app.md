# 2026-11-11 — 공공임단협(pu-alio-union.html) 푸른통합시스템 별개 독립 프로그램 전환

## 한 일
1. **포털(`enter.html`)에서 별개 독립 프로그램(`pu-alio-union.html`)으로 바로 열리도록 전환**:
   - `openPortalApp`에서 인라인 모달로 가로채던 분기를 걷어내고, 다른 모든 푸른통합시스템 프로그램(`푸른이알피`, `정부사업일정`, `기업정부지원금`, `정부사업신청` 등)과 똑같이 전용 창 이름(`pureun-aliounion`, `탭 이동 ↗`)으로 `pu-alio-union.html`이 열리도록 통일.
   - `enter.html`의 `APPS` 배열 내 여분 쉼표(`,`) 제거 및 포털 첫 화면의 불필요한 `js/pu-alio-union.js` 스크립트 태그 제거.
2. **독립 프로그램(`pu-alio-union.html` · `js/pu-alio-union.js`) 완성도 강화**:
   - 푸른통합시스템 표준 부품(`pu-gate.js`, `pu-authsync.js`, `pu-appbar.js`, `pu-whoami.js`, `pu-back.js`)을 모두 연결하고, 상단 머리줄(`#head`)에 접속자 배지(`#who`), `[📥 현재 표 엑셀(CSV) 받기]`, `[🔄 새로고침]`, `[🏠 포털 홈]`, `[로그아웃]`(`#outBtn`) 단추 배치.
   - 프로그램 안에서 어느 탭에서든 기관명(또는 `[📋 상세팝업]`)을 누르면 해당 공공기관의 **① 단위노조·타임오프 현황 + ② 단체협약 13대 핵심 쟁점 분석 + ③ ALIO 수시공시·단협·임협·별도합의·내부규정 원문 및 첨부파일(PDF·HWP)**을 한눈에 보여주는 **기관별 종합 상세 팝업창(`openOrganDetailModal`)** 추가.

## 검증
- `node --test tests/alio-union-popup.test.js` 통과
- `node --test tests/appbar-coverage.test.js tests/appbar-every-link.test.js tests/whoami-no-overlap.test.js tests/logout-gate.test.js tests/company-name-normalize.test.js tests/popconfirm-drag-and-badges.test.js` 통과
