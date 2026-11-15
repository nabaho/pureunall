상태: 끝남(화면·정적 번들 파일만 — 서버 함수·보안규칙 변경 없음)
이어하기시도: 0
작업폴더: C:\Users\user\Desktop\github\pureunall
가지: feat/alio-union-popup

# 🤝 공공기관 단협(ALIO 노조·단체협약 비교분석) — 포털 자료함 타일 + 모달 레이어 팝업 + 단독 창 (대표 지시 2026-11-10)

지시 원문:
1. 「대한민국 알리오에 들어가서 공공기관의 노동조합의 단체협약 등에 대하여 모두 정리하고 비교 분석하는 프로그램 만들고 싶다. 어떻게 해야하는지 계획세워달라」
2. 「여기에 프로그램 만들어서 팝업창 나오게 할 수 있나?」
   - 팝업 동작: 포털(`enter.html`)에서 타일 클릭 시 화면 중앙 대형 모달 레이어 팝업(`PuAlioUnion.openModal()`)으로 뜨고, 안에서 `[↗ 새 창으로 크게 열기]` 단추로 단독 창(`pu-alio-union.html`)으로도 열 수 있게 구성
   - 배치 위치: **자료함(`row: 'store'`)** 줄 (기업정보함·계약서등관리 옆)
   - 타일 이름·권한: **`🤝 공공기관 단협`** (`key: 'aliounion'`), 전 근로자 공개(`roles: null`)

## 구현 내용
- **`enter.html`**:
  - `APPS` 목록의 `store`(자료함) 줄에 `{ key:'aliounion', name:'공공기관 단협', desc:'알리오 노조·단체협약 비교분석', icon:'🤝', url:'pu-alio-union.html', roles:null, row:'store' }` 등록 및 건의함 분류(`SG_CATS`) 추가.
  - 타일 클릭(`openPortalApp` 및 모바일 클릭) 시 포털을 벗어나지 않고 `PuAlioUnion.openModal()`을 호출하여 화면 중앙 대형 레이어 팝업창(`94vw × 90vh`)을 띄우도록 연결.
- **`js/pu-alio-union.js` & `pu-alio-union.html`**:
  - 4대 탭 구현:
    1. `📊 1. 전 기관 노조·타임오프 현황` (기관유형·상급단체·노조형태·키워드 검색, KPI 요약, 체크박스 일괄 비교 추가)
    2. `⚖️ 2. 13대 핵심 쟁점 기관간 비교·원문 대조` (유니온숍, 타임오프, 인사·징계위 참여, 휴가·병가, 임금·복리후생, 정년·임금피크, 자동연장 등 13대 핵심 쟁점 매트릭스 및 조문 원문 Side-by-Side 카드 대조)
    3. `🔍 3. 단체협약 조문 통합 검색` (13대 쟁점 분류 칩·키워드 검색 및 선택 조문 나란히 비교)
    4. `📂 4. 기관별 공시·별도합의·첨부원문` (기관별 단체협약·임금협약·노사협의회·별도합의 수시공시 내역 및 ALIO 원문 파일 직접 다운로드)
  - 모든 목록 표 왼쪽 `☐` 고르기 칸(28px) + `№` 일련번호(36px, `tabular-nums`), 한 칸 한 줄(`white-space: nowrap; text-overflow: ellipsis` + `title`), 폰 화면 입력칸 `16px` 규칙 준수.
- **`js/pu-alio-data.js`**:
  - ALIO 공공기관 경영정보 공개시스템에서 수집·파싱한 전체 중앙공공기관(355곳), 단위노동조합(452개), 수시공시(437건·원문 다운로드 링크 포함), 13대 핵심 쟁점 지표, 주요 단협 조문 데이터를 내장.
- **`js/pu-ontology.js` · `js/pu-appbar.js` · `tools/phone-audit/seeds/aliounion.js`**:
  - 온톨로지 `PROGRAMS.aliounion`(`localOnly: true`), 공용 즐겨찾기 앱바(`pu-appbar.js`), 폰 화면 점검 시드 등록 및 전 화면 공용 스크립트 캐시 버전(`pu-ontology.js?v=92`, `pu-appbar.js?v=41`) 일괄 갱신.

## 검증
- `tests/alio-union-popup.test.js` 4건 통과.
- `tests/ontology-contract.test.js`, `tests/ontology-registry.test.js`, `tests/ontology-write-gate.test.js`, `tests/appbar-coverage.test.js`, `tests/appbar-every-link.test.js`, `tests/app-icons.test.js`, `tests/back-button.test.js`, `tests/logout-gate.test.js`, `tests/phone-screen-rules.test.js`, `tests/phone-input-zoom.test.js`, `tests/portal-layout-admin.test.js`, `tests/portal-rows-inout.test.js`, `tests/portal-soon-locked.test.js`, `tests/shared-js-cache-version.test.js`, `tests/test-pin-guard.test.js`, `scripts/check-cache-version.js --all` 전부 통과(실패 0).
