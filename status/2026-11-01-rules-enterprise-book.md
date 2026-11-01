상태: 완료

# 2026-11-01 — 기업규정집(취업규칙 · 노사협의회 · 단체협약 분류 및 메일 수집 확대)

## 1. 작업 요약
- **프로그램 이름 변경 (`취업규칙` → `기업규정집`)**
  - 포털(`enter.html`), 공용 앱바(`js/pu-appbar.js`), 두 화면(`rules-v2.html`, `rules.html`), 온톨로지 등록부(`js/pu-ontology.js`)에서 이름을 `기업규정집`(`취업규칙·노사협의회·단체협약`)으로 통일했습니다.
- **분류 부품(`js/rules-v2/lib-set.js` · `functions/rules-daily-core/lib-set.js`) 신설 및 서식 갈래 분리**
  - 문서를 세 분류(`취업규칙`, `노사협의회`, `단체협약`)로 가르고, 취업규칙은 기존 갈래(`규칙본문`, `신구대조표`, `신고서`, `동의서`, `의견청취`, `기타`)를 그대로 유지했습니다.
  - 노사협의회(`노사협의회(규정 본문)`, `신구대조표`, `회의록`, `위원·고충`, `신고서`, `기타`)와 단체협약(`단체협약(협약 본문)`, `신구대조표`, `합의·교섭`, `신고서`, `기타`)은 각 서식을 따로 분류하고 관리할 수 있도록 `lib-order.js`, `view-library.js`, `store.js`(`setSet`)에 연결했습니다.
  - `🏢 사업장`(`lib-sites.js`)과 `🧹 정리하기` 회차 셈(`lib-order.js` `companyGroups`)에는 노사협의회·단체협약 서류가 섞이지 않도록 취업규칙(`set === '취업규칙'`)만 세도록 지켰습니다.
- **푸른메일함 노사협의회 · 단체협약 자료 수집 확대 (`functions/rules-collect-pick.js` · `functions/rules-collect.js`)**
  - `RULES_RE` 와 `BROAD_RE` 에 `노사협의회`, `단체협약`, `임금협약`, `단협`, `단체교섭` 등을 넣어 푸른메일함(`mailbox/msgs`, `mailbox/old/msgs`)에서 관련 메일을 모두 가져오도록 넓혔습니다.
  - 본문·신구대조표·회의록·합의·교섭은 가린 글과 파일을 담고, 근로자 이름이 들어가는 `위원·고충` 서류는 `동의서`·`신고서`·`의견청취`와 같이 보류 줄만 남기도록 했습니다.
  - 옛 회차에서 `갈래: 기타` + `PDF — 아직 못 읽음`으로 보류되어 있던 단체협약·노사협의회 PDF 도 `pdfTargets` 가 다시 찾아 읽도록 고쳤습니다.

## 2. 검사
- `tests/rules-set.test.js` 신설 및 `tests/rules-*.test.js`, `tests/test-pin-guard.test.js`, `tests/color-palette-apps.test.js`, `tests/ontology-*.test.js`, `tests/appbar*.test.js`, `tests/portal*.test.js` 모두 통과.
- `node scripts/sync-rules-daily-core.js` 및 `node scripts/check-cache-version.js --all` 통과.
