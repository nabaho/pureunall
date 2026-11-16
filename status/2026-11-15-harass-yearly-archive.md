# 2026-11-15 — 괴롭힘·성희롱 조사 지난메일(POP3) 통합 수집 및 연도별 전체 자료함

## 배경
- 기존 `pu-harass.html` 은 최근 IMAP 미러(`mailbox/msgs`)만 기본 스캔하여 2021~2025년 지난메일 보관함(`mailbox/old/msgs`)에 있는 과거 직장 내 괴롭힘·성희롱 사건 공문·진술서·조사결과보고서가 자동 목록에서 누락되었다.
- 또한 업체 마스터에 담당자 이메일이 등록되지 않았거나 사업장 약칭(`[가나점검]` ↔ `(주) 가나점검장항공장`, `푸른어린이집` ↔ `국공립푸른어린이집`)으로 메일이 오간 기등록 사건의 수집 건수가 `0건`으로 표시되는 문제가 있었다.

## 주요 변경
1. **`js/pu-harass-core.js` (`?v=7`)**:
   - `flattenMailbox(folders, msgsBySlug, oldMsgsMap)`: 최근 IMAP(`inbox`·`sent`·`archive`·`custom`·`tome`·`sched`)과 지난메일 POP3(`mailbox/old/msgs`)를 통합 평탄화하되 발신자·수신자·2초 단위 시각·제목·첨부 지문으로 IMAP↔POP3 중복만 정밀 제거하고 POP3 간 오병합을 방지하며, `370-6@daum.net` 발신 메일을 `out`으로 정확히 분류.
   - `EDU_ONLY_RE` / `CASE_OVERRIDE_RE`: 단순 법정의무 예방교육 일지·강의안·자율점검 증빙은 조사 사건 발굴에서 제외하고 실제 조사·문답·보고서 건만 정밀 수집.
   - `inspectMailForHarass`: 공유 원장(`harass_invest/cases`)에 메일 본문 조각(`preview`)이 남지 않도록 머리글·첨부 서지 정보만 반환.
   - `coCoreNorm` 및 2차 상대방 주소 확장(`scanMailsForCaseInternal`): 지점·공장 접미어 및 국공립 접두어를 정규화해 1차 매칭 후 동일 사건기간 내 의뢰인 이메일로 오간 후속 문답서·소명서·결과보고서(`INFERRED_STEP_RE`)를 자동 연결.
   - `discoverUnregisteredBundles` & `buildYearlyArchive`: 기등록 사건과 기간이 겹치지 않는 과거 연도 사건을 보존하고, 모든 후보 묶음 열쇠(`bundleKey`)에 연도 접미어를 부여하여 특정 연도 후보 제외가 향후 신규 사건을 가리지 않도록 격리하며 연도별 통합 아카이브 집계를 생성.
2. **`pu-harass.html` · `js/pu-harass-view.js` (`?v=10`) · `pu-erp.html` · `sign-harass.html`**:
   - `sanitizeMailLinkForSave` 허용목록으로 공유 원장 저장 시 `preview`를 원천 제거하고, `openMailViewerModal()`에서 `slug === '*old'` 지난메일 본문·첨부파일(`.hwpx`·`.hwp`·`.docx`·`.pdf`) `readOldMail` 열람·내려받기·보고서/녹취 추출 및 `outOfWindow` 메모리 요약(주민번호 마스킹) 폴백 지원.
   - 상단 **📅 연도별 전체 자료함** 탭(`#p-yearly`), 연도별 알약 필터(`aria-pressed`·초점 복원 지원), 말줄임 제목 `title` 툴팁, 일괄 사건 등록·동기화 및 화면 필터 반영·수식주입 방어 CSV 내보내기(`exportYearlyCsv`) 추가.
3. **검증**:
   - `tests/harass-invest.test.js` 12개 합성 시나리오 및 저장소 품질·보안 검사 전체 통과, `tools/phone-audit/seeds/harass.js` `yearly` 뷰 추가 및 375/768/1366px 레이아웃 점검 통과.
