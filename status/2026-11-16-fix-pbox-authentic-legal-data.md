상태: 완료(코드) · 배포 확인 진행
작업폴더: E:\pu-wt-pbox (가지 fix/pbox-authentic-legal-data)

# 2026-11-16 · P박스 전 수록 판례·행정해석·조례·조례해석·결정례 법제처(law.go.kr) 실존 원문 전면 교체 및 무인증 실시간 수집 연동

대표 지시(「판례·행정해석·조례·조례해석 등 모든 데이터는 반드시 진짜 실존하는 유권해석 원문이어야 하며, 만들거나 짜깁기한 자료는 절대 있으면 안 된다」)를 반영한 전면 개편.

## 무엇을 고쳤나
- `js/pu-pbox-corpus.js` — 내장 코퍼스 전량을 법제처 국가법령정보센터(`https://www.law.go.kr`)에서 검증·수집한 **100% 실존 공식 공공저작물(저작권법 제7조) 원문 108선**으로 교체했다.
  - 대법원·헌법재판소 판례 41선 + 서울행정법원·고등법원·지방법원 하급심 판례 6선 (총 47선)
  - 고용노동부 질의회시·고시·예규·훈령 28선 (`근기68207-694`, `임금근로시간과-2972`, `근로개선정책과-5687`, `고용노동부예규 제212호` 등 실존 회시·발령번호 원문)
  - 법제처 법령해석례(`법제처 18-0687`, `법제처 17-0191` 등) 및 **법제처 자치법규(조례) 의견제시(`법제처 의견25-0389`, `법제처 의견21-0027` 등)** 16선
  - 전국 지자체 현행 조례(`서울특별시조례 제9867호` 생활임금 조례, `서울특별시조례 제8993호` 감정노동 종사자 권리보호 조례, 이동노동자·산업재해 예방 조례 등) 6선
  - 중앙노동위원회·산재재심사위원회·중앙행정심판위원회·개인정보보호위원회·국가인권위원회 실존 결정·재결례 11선
  - `DOC_TYPES` 8종(`ordinance` 자치조례·자치법규 신설), `ISSUE_FINDER_TREE` 7개 대분류(조례·자치법규·조례해석 추가), `KOREA_LEGAL_SITES` 37곳(`law_go_ordc` 법제처 자치법규 의견제시 직행 추가) 확장.
- `js/pu-pbox-engine.js` · `js/pu-pbox-store.js` — 옛 가공 의사코드·요약 시드(`DEPRECATED_SYNTHETIC_DOC_IDS` · `DEPRECATED_SYNTHETIC_CASE_NOS` · `DEPRECATED_PSEUDO_CODE_RE`) 판별기를 두고, `PuPBoxStore.init()` 실행 시 기존 브라우저 IndexedDB(`pu_pbox_corpus_v1.docs` 및 `pu_pbox_workspace_v1_<uid>.recents`)에 남아 있던 옛 가공 항목까지 **영구 삭제**하며 `public` 영역 재유입을 차단했다.
- `js/pu-pbox-engine.js` — 법제처 법령해석(`법제처 YY-NNNN`), 자치법규 의견제시(`법제처 의견YY-NNNN`), 지자체 조례(`○○조례 제NNNN호`), 고용노동부 고시·예규·훈령 번호의 공백 정규화·인용 검증기(`verifyCitations`)·안전 공식 검색어 추출기를 보강하고, 쟁점 규칙(`FACT_ISSUE_RULES`)의 모든 참조 번호를 실존 원문 번호로 맞추었다.
- `functions/pbox-sync.js` — `LAW_OC` 인증키가 없는 환경에서도 법제처 공식 웹(`https://www.law.go.kr`) SSR 목록·상세 엔드포인트 10종(대법원·하급심·헌재·노동위·고용노동부해석·법제처해석·자치법규의견제시 `ordc`·지자체조례 `ordin`·중앙행심위·행정규칙)에서 실존 공식 원문과 `officialUrl`을 실시간 수집하도록 연동했다.
- `js/pu-pbox-app.js` · `pu-pbox.html` — 모든 내장·수집 문서의 우측 원문 리더에 `🏛️ 법제처 공식원문 ↗` 바로가기 단추와 공식 URL 표시를 추가하고, 자치조례 배지·필터·초기 추천 자료를 실존 원문 기준으로 갱신했다.

## 무엇을 막았나 (보안·안정성 방어)
- 공식 원문 링크 허용목록(`sanitizeOfficialLawUrl` / `sanitizeOfficialLawUrlClient`)으로 `https://(www.|open.)law.go.kr/LSW/...` 경로만 허용하고 다른 스킴·외부 도메인은 원천 차단한다.
- 당사자 실명 비식별화에서 법률 일반명사(`노동조합`·`근로자`·`생활임금` 등) 오탐을 막으면서 희귀·귀화·4글자 성명 당사자까지 서버·클라이언트·공식 검색어 전 구간에서 마스킹하며, 조례 공포번호·법제처 의견번호·원문 일련번호는 보존하고 실제 주민등록번호·전화번호·계좌번호는 차단한다.
- 무인증 SSR 수집기에 요청별 제한시간(`AbortController` 시간 제한), 단일 응답 바이트 상한, 누적 응답 바이트 상한, 전체 수집 기한을 두어 외부 응답 지연·과대 페이지로부터 함수 실행시간과 메모리를 보호한다.

## 검사
- `node scripts/check-cache-version.js` — 통과.
- `node --test tests/pbox.test.js tests/test-pin-guard.test.js tests/one-line-cells.test.js` — 26개 전체 통과(새 ⑭번 전수 실존 원문 무결성·구 IndexedDB 캐시 영구 삭제·조례/의견제시 인용검증·무인증 SSR 8종 수집·희귀 성명 마스킹·SSR 시간/용량 상한 검사 포함).
- `node tools/phone-audit/run.mjs pbox --widths=360,375,411,768,1280,1920` — 11개 화면 × 6개 해상도 모두 옆넘침 0 · 화면밖 0 · 세로깨짐 0 · 짓눌림 0 · 두줄단추 0 · 작은단추 0 · 작은입력 0.
- 전체 `node --test "tests/*.test.js" "functions/*.test.js"` — 30,468개 통과 · 실패 0.
- 자동 검토(`ow review`, 기능·UI 검증 `antigravity:gemini-4-argon-high` 통과 · 보안 `codex` 재검증 발견 사항 0건 통과).
