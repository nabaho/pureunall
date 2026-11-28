# 2026-11-28 괴롭힘·성희롱 조사 상단 레이아웃 슬림화 (통합 트랙 바 + 초소형 KPI 배지)

## 배경 및 목적
- 기존 `pu-harass.html` 상단은 대형 4열 KPI 카드와 별도 알약 필터 줄, 통합 카드 안 필터 바가 세로 공간을 과도하게 차지하여 한눈에 사건 목록이 들어오지 않았다.
- 안전보건(`safety.html`) 상단 규격과 동일하게 **① 통합 상단 스트립 카드(`.hi-top-strip`: 수행 트랙 알약 바 + 초소형 1줄 KPI 배지)** → **② 독립 필터 바 카드(`.card > .bar`)** → **③ 사건 목록 표 카드** 3단 슬림 구조로 통일했다.

## 주요 변경 사항
1. **[pu-harass.html](../../pu-harass.html)**
   - `#head` 상단 패딩·글자 크기·버튼 높이를 슬림하게 정돈.
   - `.hi-top-strip`, `.scope-bar`, `.scope-btn`(`.on`, `.ok`), 초소형 가로형 `.kpi`(`flex-direction: row`, `padding: 3px 9px`, `11.5px / 12.5px`) CSS 적용 및 모바일(`<=768px`) 36px 터치 높이 보장.
   - `#p-cases`, `#p-inbox`, `#p-yearly` 상단을 `.card.hi-top-strip` + 독립 필터 `.card` + 목록 `.card` 구조로 분리하고 `#caseYrSel`(연도 드롭다운)과 `📋 6대 빈 양식·견본` 바로가기 버튼을 배치.
   - `js/pu-harass-view.js?v=22` 캐시 버전 갱신.
2. **[js/pu-harass-view.js](../../js/pu-harass-view.js)**
   - `renderCaseTrackBarHtml()` 및 `fillCaseYearSelect()` 추가: `수행 트랙: [전체] [직접수행·보고완료] [직접조사 진행] [대리·자문·검토] [외부위원·협업]` 원클릭 필터 제공.
   - `drawCasesPane()`, `drawInboxPane()`, `drawYearlyPane()`의 KPI를 초소형 1줄 인라인 배지로 경량화하고 연도·수행 트랙 필터 상태 동기화 보강.
