# 2026-11-28 안전보건체계구축 필수서류·서식 22종 업종별 자동체크 및 기존 샘플 자동 치환 스튜디오 추가

## 배경 및 목적
- 안전보건체계구축 컨설팅 착수부터 규정·회의록·점검표·위험성평가·교육·작업중지 해제까지 필요한 실무 서류 22종을 시스템 안에서 누락 없이 관리한다.
- 유통·물류·도소매(예: 작업중지명령 해제 포함 사업장), 일반/고위험 제조, 서비스·시설관리, 의료·복지, 건설 등 8대 업종과 상시 근로자 규모·특이사항에 따라 필요한 서류를 자동 판별하고, 기존 타 사업장 작성본·수집 자료·표준 샘플·PC 파일을 현재 사업장 기준으로 자동 치환·생성한다.

## 주요 변경 사항
1. **실무 서류 22종·최초 착수 6단계 카탈로그 ([js/pu-safety-docs.js](../../js/pu-safety-docs.js))**
   - 1단계 계약·착수 기초파악 → 2단계 방침·조직·규정·예산 → 3단계 노사협의체·의견청취·TBM → 4단계 위험성평가·점검표 → 5단계 교육·물질·업종특화 → 6단계 비상·도급·작업중지 6단계 로드맵 및 22종 서식 정의.
   - `evalDocRequirement()`로 업종(`INDUSTRIES`), 근로자 규모(`5인+`, `30인+`, `50인+`, `100인+`, 도소매·운수 산안위 기준), `작업중지|중대재해|시정명령|감독` 키워드에 따라 `긴급필수`·`업종필수`·`규모필수`·`법정필수`·`권장` 자동 판정.
   - `buildTemplateDraft()` · `collectSamplePool()` · `adaptSampleText()` · `findCrossCompanyResidue()`로 업종 맞춤형 초안 생성 및 상호 변형·대표자·소재지·연도·사용자 지정 키워드 일괄 치환과 비식별 정리 지원.
2. **개별 서류 `.hwpx` / 푸른한글 / A4 미리보기 / `.zip` 묶음 ([js/pu-safety-hwpx.js](../../js/pu-safety-hwpx.js))**
   - `buildSingleDocModel()` · `generateSingleDocHwpxBytes()` · `buildSingleDocPreviewHtml()` · `openSingleDocPrintWindow()` · `downloadDocsBundleZip()` 추가 및 팝업 차단 시 브리지 저장소 즉시 정리.
3. **3번째 탭 `📚 필수서류·서식` 및 작성 스튜디오 ([safety.html](../../safety.html), [js/pu-safety-view.js](../../js/pu-safety-view.js))**
   - `pu-harass` 표준 형태(접이식 6단계 가이드 `.sub-fold`, 분류 알약 + 클릭형 KPI 칩, 필터·일괄 초안/일괄 `.zip` 바, 수직 정렬 `safetyDocs` 테이블, 우측 Sticky A4 미리보기 스튜디오 `#docStudioCard`) 적용.
   - `checkDocOf()`/`projectDocsMap()` 분리 및 `buildFastSnapshot()` 슬림화로 5계층 16대 서류 연동(수동 판정 보존), 미저장 전환 확인, 375px·768px·1280px 반응형 무넘침 처리.
   - [js/pu-safety-catalog.js](../../js/pu-safety-catalog.js) `DOC_KINDS` 중복 `code` 키 정리.
4. **미리보기 씨앗 및 자동화 회귀 시험 ([tools/phone-audit/seeds/safety.js](../../tools/phone-audit/seeds/safety.js), [tests/safety-auto.test.js](../../tests/safety-auto.test.js))**
   - `(주)서해유통물류`(유통·물류·작업중지 해제 맥락) 및 `(주)청솔로지스틱스` 완료 샘플 추가, Test 9(22종 초안·업종 판별·개별 HWPX·샘플 치환·반응형·보호 규칙) 추가.

## 검증
- `node --check js/pu-safety-catalog.js js/pu-safety-docs.js js/pu-safety-hwpx.js js/pu-safety-view.js` 통과
- `node scripts/check-cache-version.js --all` 통과
- `node --test tests/safety-auto.test.js tests/shared-js-cache-version.test.js tests/color-palette-apps.test.js tests/one-line-cells.test.js tests/phone-input-zoom.test.js tests/phone-screen-rules.test.js tests/pu-design.test.js tests/ontology-contract.test.js tests/ontology-write-gate.test.js tests/test-pin-guard.test.js tests/agents-md.test.js` — 182/182 통과 (`tests/safety-auto.test.js` 9/9 통과)
- `node tools/phone-audit/run.mjs safety --widths=360,375,411,768,1280 --design` — 전 해상도·전 탭 옆넘침 0 · 화면밖 0 · 작은단추 0 통과
