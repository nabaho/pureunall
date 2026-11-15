상태: 완료(배포 뒤 실제 화면 확인 대기)
# 2026-11-15 · 📂 노사발전재단 일터혁신 컨설팅(2015~2026년 45건) 단독 정본 수록 · 타 컨설팅 전수 배제 · 비식별 백필

가지: `feat/ilteo-history-backfill` (1단계 PR #3057 병합 뒤 `main`에서 분기)

## 한 것
- **노사발전재단 일터혁신 컨설팅 단독 필터링 및 타 컨설팅 100% 원천 배제 (`ilteo.html`, `js/pu-ilteo-intake.js`, `js/pu-ilteo-view.js`, `scripts/backfill-ilteo-history.js`)**:
  - 푸른이알피 마스터(`/data/consultings` 일터혁신 계약 및 `/scal_cos` 활성 `t1` 일터혁신 사업장 — 2026년 8건)와 과거 컨설팅 정본 대장(`사업구분 === '일터혁신'`, 2015~2025년 수진사업장 37건, 주관기관 행정 행 제외)만 정본으로 채택하여 **총 45건(고유 기업 40개사, 복수 연도 수행 5건 포함)**만 `ilt_<companyId>_<year>` 규격으로 수록.
  - 화면(`ilteo.html` · `js/pu-ilteo-view.js`)에서 `타 컨설팅 이력` 선택지(`#projProg`)를 완전 제거하고 연도 필터(`#projYear` · `#npYear`)를 **2015~2026년 전 구간**으로 확장했으며, `isIlteoProject` · `scanProjectMails` · `rebuildScanAndDiscover`에서 타 컨설팅 사업 키워드(`isNonIlteoText`: 현장클리닉·산업일자리전환·고용안정선제대응·기술보호·청년도약·체불청산 등) 및 수행연도 범위 밖(`±1년` 초과) 메일이 섞이지 않도록 이중 차단.
  - 운영 RTDB `/scal_ilteo`에 남아 있던 기존 타 컨설팅·구 규격 프로젝트 및 잔여 카드를 `PuOntologyWrite` + `ETag/If-Match` 조건부 쓰기로 전수 `_deleted: true` 묘비 정리 완료(활성 비일터 레코드 **0건**, 고아 보고서·카드 **0건**).
- **일터혁신 전용 보관소·발표자료(`.pptx`·`.pptm`·`.ppsx`·`통합진단보고서`) 파싱 및 비식별 보안 강화 (`js/pu-ilteo-catalog.js`, `js/pu-ilteo-intake.js`, `js/pu-ilteo-report.js`)**:
  - `DOC_KINDS` 14종 확장(`mid_report_doc` 중간·통합진단보고서 원문, `final_report_doc` 최종·결과보고서 원문) 및 `.pptx`/`.pptm`/`.ppsx` 슬라이드 본문 자연 정렬 추출기(`extractPptxText`, 최대 300슬라이드 · 메타 위변조 압축폭탄까지 즉시 중단하는 `internalStream` 스트리밍 바이트·압축률 상한 방어 포함), CP949/UTF-8 ZIP 인메모리 읽기 전용 해제(`decodeZipFileName` + 해제 전 메타 검사 + 스트리밍 실시간 바이트·압축률 상한 차단) 구현.
  - 별도 최종보고서 파일 없이 `통합진단보고서` 단일 통합본으로 수행 완료된 과거 연도 사업장에 대해 `buildFinalReport` 원문 발췌 폴백 연결 및 한글 어절 중간 절단 방지(`safeSliceHead` · `safeSliceTail`), 상호 정규화 함수(`normalizeCorpName`, 합자회사 포함) 공용 노출 적용.
  - 미등록 한국어 인명 문맥(통계청 286개 단성·14개 복성, 콜론 라벨·전체/부분 띄어쓴 인명·직함 접두/접미·서술형 조사 결합 인명·파일명 단독 인명 토큰 `maskStandaloneNamesInLabel`), 법인격 제거 약칭·구 상호 별칭(`aliasNames`), 도로명·지번 상세주소, 로컬 파일 경로 문자열(`passesIndependentAudit`)까지 `kordoc` fail-closed 1차 가림 + `PuIlteoIntake` 다회 가림 + 성씨 사전 비의존 독립 문맥 감사로 원천 차단.
- **사업장 화면 · 다중 첨부 분석 · 트랜잭션 동시성 보호 · 접근성 정비 (`ilteo.html`, `js/pu-ilteo-view.js`)**:
  - 메일 `🔍 내용확인·분석` 및 파일 끌어놓기(`.pptm`·`.ppsx` 포함, 슬라이드 발표자료 40MB 상한 통일) 시 다중 첨부 서브카드 분리 저장, 전건 `PuOntologyWrite` 서버 트랜잭션(`expectedRevision` 상시 전달 + `_deleted` 부활 차단) 일원화.
  - 27색 공식 팔레트 준수, 다크모드 대비율(WCAG AA) 강화, 소형 단추·행동 링크 최소 터치 높이(`min-height: 36px`) 보강, 탭 `role="tabpanel"`·`aria-controls`·`aria-labelledby` 및 모달 입력칸 `aria-label` 전수 연결, 스크립트 캐시 버전(`pu-ilteo-intake.js?v=23`, `pu-ilteo-report.js?v=11`, `pu-ilteo-view.js?v=12`) 갱신.
- **운영 RTDB(`/scal_ilteo`) 순수 일터혁신 45건 ETag 조건부 적재 완료 (`scripts/backfill-ilteo-history.js`)**:
  - 연도별 분포(총 **45건**): 2015년 1건 · 2016년 2건 · 2017년 1건 · 2018년 1건 · 2019년 4건 · 2020년 2건 · 2021년 6건 · 2022년 3건 · 2023년 4건 · 2024년 7건 · 2025년 6건 · 2026년 8건.
  - 일터혁신 전용 보관 폴더(읽기 전용 · CP949 ZIP 포함 2,616개 엔트리 색인 · 42개 프로젝트 매칭 · 카드 191건), 다음메일 IMAP(`readOnly: true`, 메일·첨부 카드 288건 중 원문·첨부 결합 반영), 다음메일 POP3(`popOpen` 읽기 전용 · `DELE` 없음), 기업규정 서고(50건)에서 순수 일터혁신 비식별 수집 카드 **529건**(설계·검토의견 127건 · 최종보고 원문 87건 · 취업규칙 84건 · 중간·통합진단보고 원문 45건 · 조직진단 설문 42건 · 회차 수행증빙 27건 · 안내·동의 21건 · 근로시간·휴가 20건 · 정산·평가 19건 · 조직·명부 14건 · 임금대장 12건 · 노사협의회 12건 · 근로자동의 11건 · 근로계약 8건), 중간보고서 **45건**, 최종 결과보고서 **44건**(2026년 기초단계 진행 중 1건은 미확정 유지, 총 보고서 본문 **805,637자**)을 `ETag/If-Match` 조건부 쓰기로 안전하게 적재.

## 확인
- `tests/ilteo-auto.test.js` 14건 전수 통과 (`isNonIlteoText` 타 컨설팅 배제, 동일 거래처 타 컨설팅·타 연도 메일 배제, `.pptm`/`.ppsx`/`통합진단보고서` 분류·추출·최종보고 폴백, `normalizeCorpName` 공용 노출, CP949 ZIP 색인/추출 및 고압축 폭탄 스트리밍 차단, 로컬 경로 차단, CLI 인자 검증, 인명 가림·독립 감사 회귀, `ETag/If-Match` 동시성 보호, UI 타 컨설팅 필터 제거 확인 포함).
- 전체 시스템 검사(`node --test "tests/*.test.js" "functions/*.test.js"`, `color-palette-apps.test.js` · `tests-no-local-path.test.js` · `check-cache-version.js --all` 포함) 전수 통과.
- 휴대폰·데스크톱 화면 감사(`node tools/phone-audit/run.mjs ilteo --widths=360,375,411,768,1366 --full`): 4개 탭 × 5개 폭 전 구간 옆넘침 0 · 화면밖 0 · 작은단추 0 · 작은입력 0.
- 운영 RTDB `/scal_ilteo` 사후 전수 감사: 활성 일터혁신 프로젝트 **45건**(비일터 활성 **0건** · ID 규격 오차 **0건** · 미등록 과제 코드 **0건** · 고아 보고서/카드 **0건**) 및 수집 카드 **529건** · 보고서 **89건(805,637자)** 전 구간 **개인정보 잔존·로컬 경로 유출 0건** 확인.

## ⚠ 못 한 것 · 확인 필요
- 배포 뒤 실제 `ilteo.html` 화면에서 대표 로그인 상태로 2015~2026년 순수 일터혁신 컨설팅 사업장 45건 목록과 중간·최종보고서 원문 열람을 확인해야 한다.
