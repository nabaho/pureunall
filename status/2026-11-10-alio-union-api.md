# 작업 일지 — 2026-11-10

## 무엇을
- 포털(`enter.html`) 자료함 줄의 타일 및 프로그램 제목을 **「🤝 공공임단협」** 으로 변경하고, 캐시된 배치(`portalLayout`)를 다시 그릴 때 줄 묶음 개수 배지(`자료함 8개`)도 즉시 갱신되도록 보강.
- **「공공임단협」** 안에 **5대 공공·법령·노사 API**를 모두 연결하고 **「🔌 5. 공공·법령 API 실시간 연동 센터」** 탭 및 실시간 법조문 대조 기능을 탑재:
  1. **기획재정부 알리오(ALIO) 9대 노사·임단협·내부규정 공시 API** (`itemReportListSusi.json`, `itemOrganListJung.json`, `itemReportRight.do`, `itemBoard21110.do`, `download/file.json`, `download/rulefiledown.json`)
  2. **현행 노동관계법령 실시간 조문 API** (`legalize-kr` GitHub Raw — CORS 허용·인증키 불필요, 노동조합법·근로기준법·근로자참여법·남녀고용평등법·고령자고용법·퇴직급여법·산업안전보건법 실시간 조문 호출 및 13대 쟁점 Side-by-Side 대조)
  3. **공공데이터포털 기획재정부 알리오(ALIO) Open API** (`apis.data.go.kr/1051000/recruitment/list` — 푸른포털 `gov/{uid}/key_data` 또는 브라우저 인증키 자동 연동)
  4. **한국천문연구원 특일(법정공휴일)·공용 공공데이터 API** (`pubdata/common/holidays/{연도}` 자동 연동)
  5. **행정안전부 지방공기업(클린아이)·고용노동부 전국 노동조합 표준데이터 Open API** (`apis.data.go.kr/B551982/openApiUnion`)
- 내장 데이터 번들(`js/pu-alio-data.js`)을 준정부기관 61곳 수시공시 및 주요 기관 내부규정(`21110` 취업규칙·인사규정·보수규정)까지 확장(전체 355개 기관, 452개 단위노조, 1,091건 공시·내부규정, 42개 주요 공기업·준정부기관 원문 파싱 지표 143건·조문 985건).

## 왜
- 대표님 지시: *"공공임단협 으로 제목을 만들고 프로그램 넣어달라 확인할 수 있게 그리고 api 찾아 모두 연결시켜달라"*

## 바뀐 파일
- `enter.html`, `pu-alio-union.html`, `js/pu-alio-union.js`, `js/pu-alio-data.js`
- `js/pu-appbar.js`, `js/pu-ontology.js` (+ 캐시 버전 동기화 `.html` 파일들)
- `tests/alio-union-popup.test.js`

## 검증
- `node --test tests/alio-union-popup.test.js` 외 17개 테스트 스위트 (166개 항목 전부 통과)
- `node scripts/check-cache-version.js --all` 통과
