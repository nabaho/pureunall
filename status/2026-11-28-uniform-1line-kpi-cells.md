# 2026-11-28 괴롭힘·안전보건·일터·산업전환 및 신규 프로그램 KPI·검토 바 1줄 균등 셀 일렬 통일

## 배경 및 목적
- 기존 `pu-harass.html` 및 `safety.html` 상단 스트립은 수행 트랙 알약 줄과 KPI 배지 줄이 2줄로 나뉘고, 셀 폭이 글자 길이에 따라 들쭉날쭉하여 우측 여백이 남고 시선이 분산되었다.
- 모든 프로그램의 KPI 및 진행·검토 바를 **단일 1행(한 줄)** + **동일 가로 폭·동일 높이 균등 셀(`flex: 1 1 0; min-height: 32px`, 좌측 라벨 · 우측 수치 1줄 배치)**로 일렬 통일했다.

## 주요 변경 사항
1. **괴롭힘·성희롱 조사 ([pu-harass.html](../../pu-harass.html), [js/pu-harass-view.js](../../js/pu-harass-view.js))**
   - `.hi-top-strip`을 1행 균등 셀 바로 전환하고 `전체 사건` · `직접·보고완료` · `직접조사 진행` · `대리·자문` · `외부위원·협업` · `진행 / 종결` · `수집공문` · `이알피연동` 8개 동일 폭 셀을 1줄 배치.
   - `미등록 후보`(4개 균등 셀) · `연도별 자료함`(5개 균등 셀) 및 보고서 양식 점검 알약(`.tpl-pills`)도 1줄 균등 셀로 통일하고 연도·수행트랙 `<select>`를 필터 바에 배치.
2. **안전보건체계구축 ([safety.html](../../safety.html), [js/pu-safety-view.js](../../js/pu-safety-view.js))**
   - `.sf-top-strip`을 1행 7개 균등 셀(`전체 사업장` · `과거 완료` · `진행 사업장` · `공단 트랙` · `업종 범위` · `진행 충족률` · `자료 · 후보`)로 통일하고 필터 바에 `#projTrack`(`트랙 전체`) 추가, 점검 계층 탭(`.pill-row.uniform-row`) 1줄 균등 셀화.
3. **일터상생혁신 · 산업일자리전환 ([ilteo.html](../../ilteo.html), [js/pu-ilteo-view.js](../../js/pu-ilteo-view.js), [jobtrans.html](../../jobtrans.html), [js/pu-jobtrans-view.js](../../js/pu-jobtrans-view.js))**
   - `.kpis`, `.yr-bar`, `.rv-subtabs`, `.agency-scope-bar`를 1줄 균등 셀(`flex: 1 1 0`)로 통일하고, 2줄로 쌓이던 `.ws-steps > .ws-step` 단계 카드를 1줄 균등 셀(부가 설명은 `title` 이동)로 정리.
4. **표준 형태 규칙 갱신 ([docs/규칙/서류-목록-표준형태.md](../../docs/규칙/서류-목록-표준형태.md), [AGENTS.md](../../AGENTS.md), [CLAUDE.md](../../CLAUDE.md))**
   - 향후 제작·개선되는 모든 프로그램이 상단 KPI·검토 바를 **1줄 동일 폭 균등 셀**로 구성하도록 표준 규칙 명문화.
