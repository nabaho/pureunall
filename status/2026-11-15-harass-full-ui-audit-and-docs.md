# 괴롭힘·성희롱 조사 전 화면·버튼 실행 검증, 반응형 UI 정밀 정비 및 실무 필수 공문 4종(.hwpx) 구축 (2026-11-15)

## 배경 및 핵심 발견 사항
- `pu-harass.html` 전 탭·모달·내려받기·전자서명 흐름을 실제 Chromium 브라우저(360·375·411·768·1366px)와 단위 검사로 전수 점검했습니다.
- 실브라우저 검증 과정에서 다음과 같은 중요한 동작·UI 문제를 포착하여 근본 해결했습니다.
  1. **`PuRrnMask.maskRrnInText` 반환형 호환 결함(`scrubRrn`)**: 실브라우저에서 로드되는 `js/pu-rrn-mask.js`의 `maskRrnInText(v)`는 문자열이 아닌 `{ text, count }` 객체를 반환하므로, `js/pu-harass-view.js`의 `scrubRrn`에서 문자열 대신 `"[object Object]"`로 치환되던 문제를 수정했습니다(`C.maskRrnText`의 동명이인 식별용 `YYMMDD-G******` 규약을 먼저 적용한 뒤 잔여 숫자열 가림 `.text` 언래핑).
  2. **1366px 노트북 표 우측 잘림 및 버튼 말줄임(`...`) 차단**: `table.t td`의 일괄 `max-width`·`overflow:hidden` 때문에 작업 단추 열(`td[data-k="act"]`)이 잘리거나 우측 `즐겨찾기` 탭과 겹치던 현상을 `td[data-k="act"]{max-width:none;overflow:visible}`, 해상도별 폭 최적화, `main` 우측 여백 확보로 해결했습니다.
  3. **375px 모바일 2줄 카드 상호 찌부러짐 해결**: 좁은 폰 폭(`<=560px`)에서 제목 셀(`td.ti`)과 다중 배지가 첫 줄을 나눠 쓰며 상호가 `(주)...`로 잘리던 문제를 수정해 첫 줄 전체 폭에 사업장·사건명이 선명히 표시되도록 개선했습니다.
  4. **실시간 DB 갱신 중 한글 조합(IME)·미저장 판정 보호**: `#reportBox` 입력칸 포커스 중 백그라운드 실시간 재렌더링을 지연시키고, 종합 판단(`#rVerdict`) 변경값(`DIRTY_RPT.verdict`) 보존 및 미저장 이탈 확인 가드를 추가했습니다.

## 추가 구축된 실무 기능
- **`js/pu-harass-hwpx.js` (`?v=6`)**:
  - `OFFICIAL_DOC_TYPES` 및 `buildOfficialDocHwpx(docType, caseRec, opts)` 추가: ① 조사계획 및 기초자료 협조 요청 공문, ② 당사자·참고인 출석·면담 안내문(신고인·피신고인·참고인별 법정 권리·의무 차등 안내), ③ 현장 자필서명용 비밀유지서약서 양식, ④ 피해근로자 보호조치 및 후속조치 권고 공문을 정식 OWPML `.hwpx` 파일로 즉시 생성합니다.
- **`pu-harass.html` · `js/pu-harass-view.js` (`?v=17`)**:
  - 상단·상세 작업줄 `📄 공문·서식(.hwpx)` 발급 모달 탑재 (면담자 프리셋 자동 채움 + 발급 시 공문함 `mailLinks` 및 8단계 자동 반영 선택 지원).
  - `조사 사건 현황` 탭 현재 필터 목록 `📥 현황 CSV` 내려받기(`#caseCsvBtn`), 탭별 검색·연도·필터 조건 `↺ 초기화` 단추(`#caseResetBtn`, `#inResetBtn`, `#yrResetBtn`), 연도별 자료함 `#yrPerf`의 `direct_active` 선택지 동기화.
  - 미종결 사건 `보고 기한` 임박(`⏰ D-N`, `⏰ 오늘마감`) 및 기한 경과(`⚠ 기한+N일`) 배지 표시.
  - 자동분류 원천 프로그램(`docs-esign.html`, `work.html`, `pu-erp.html`, `pu-cal.html`, `gov-consulting.html`) 원클릭 바로가기 칩 및 자동분류 진행과정(`extlogs`) 단건·일괄 보고서 본문 인용·복사 기능 추가.
  - 8단계(`steps`), 공문(`mails`), 3요건 검토표(`issues`), 자동분류 진행기록(`extlogs`) 행 클릭 즉시 열람·편집 지원.
- **`tests/harass-invest.test.js`**:
  - 모든 VM 검사 컨텍스트에 실제 `js/pu-rrn-mask.js`를 함께 로드하여 실브라우저 동등성을 확보하고, 4종 `.hwpx` 공문 왕복 추출·기한 배지·CSV·필터 초기화·진행기록 인용·판정 미저장 보존·행 클릭을 검증하는 테스트 ⑯을 추가했습니다.
