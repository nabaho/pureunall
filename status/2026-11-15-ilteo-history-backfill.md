상태: 완료(배포 뒤 실제 화면 확인 대기)
# 2026-11-15 · 📂 일터상생혁신 과거 메일 컨설팅 자료 · 중간보고서 · 최종보고서 전수 비식별 백필

가지: `feat/ilteo-history-backfill` (1단계 PR #3057 병합 뒤 `main`에서 분기)

## 한 것
- **과거 보고서·발표자료 분류·파싱 및 비식별 보안 강화 (`js/pu-ilteo-catalog.js`, `js/pu-ilteo-intake.js`, `js/pu-ilteo-report.js`)**:
  - `DOC_KINDS` 14종 확장: `mid_report_doc`(중간보고서 원문·발표자료) 및 `final_report_doc`(최종·결과보고서 원문·산출물) 추가, `중간보고 피드백/검토의견`은 `design_feedback`으로 분리 판정, 레거시 과제 별칭 정규화를 `Cat.getTask` 단일 경로로 통합.
  - `.pptx` 슬라이드 평문 추출기(`extractPptxText`) 추가: `ppt/slides/slide*.xml` 자연 번호순(`parseInt`) 정렬 및 압축 크기·슬라이드 수·압축률 폭탄 방어 적용.
  - POP3 지난 메일함(`mailbox/old/msgs`, `src: 'pop3'`)과 IMAP 거울(`mailbox/msgs`) 통합 병합·중복제거(`flattenMailboxRows`) 및 복수 사업장 공유 이메일·도메인 자동 귀속 차단(`buildCompanyMailProfile`).
  - 미등록 한국어 인명 문맥(통계청 286개 단성·14개 복성 전체, 콜론 라벨·전체/부분 띄어쓴 인명·공백 접두·직급 접미·2~4글자 서술형 조사 결합 인명, 어근+조사 2+2 복합명사 정밀 분리, `국·표·록·성·자·수·원·호·비·제·율` 등 인명 끝 글자 보존, 제목·첨부 파일명 구분자 및 영숫자 접두·접미 결합 단독 인명 토큰 `maskStandaloneNamesInLabel`, 정량 엑셀 부서·자유문자 셀 비식별 정화 `sanitizeQuantDeptLabel`) 및 도로명·지번 상세주소 패턴 가림(`maskPiiStrict`, `hasResidualPii`)과 성씨 사전 비의존 독립 문맥 감사(`hasIndependentPersonAuditLeak`, 부분 띄어쓰기 및 순서·길이 무관 영숫자·괄호 결합 파일명 탐지 지원)를 이중화하고, 정량 엑셀 결과(`auditQuantResultAsync`)·모달 수기 입력·제목·첨부명(`sanitizeTitle`·`sanitizeMetaLabelAsync`)·외부 AI 윤문 전 경로에 `kordoc` fail-closed 1차 가림 + `PuIlteoIntake` 다회 가림 + 독립 감사 + `<<<초안 본문>>>` 인젝션 격리 울타리 적용.
  - 보고서·취업규칙 비식별 발췌 한도를 6,000자로 넓히고 핵심 요약 줄 자동 추출(`extractReportHighlights`)을 거쳐 중간보고서·최종 결과보고서 7개 표준 섹션에 과거 원문 내용이 실제 수록되도록 조립기 보강.
- **사업장 현황 화면 · 다중 첨부 분석 · 트랜잭션 저장 · 접근성 개선 (`ilteo.html`, `js/pu-ilteo-view.js`)**:
  - `#projProg` 사업구분 필터(`전체 컨설팅` / `일터혁신 상생컨설팅` / `타 컨설팅 이력`) 및 연도 필터(2026~2021), 중간·최종 수록 칩 표시 추가.
  - 메일 `🔍 내용확인·분석` 시 첨부파일 추출 본문 병합 및 다중 첨부 메일 개별 서브카드(`mail_<key>_att_<idx>`) 분리 저장, 첨부 `docKind` 기반 단계(`pre_mid`/`post_mid`) 재판정 반영.
  - 다건 저장(`atomicMultiRecordUpdate`)의 조건 없는 `rootRef.update`를 제거하고 전건 `PuOntologyWrite` 서버 트랜잭션(`gate.save`/`gate.remove` + 신규 `-1`·레거시 `0` 포함 `expectedRevision` 상시 전달 + `_deleted` 부활 차단)으로 일원화.
  - 27색 공식 팔레트 안에서 다크모드 버튼 대비율(WCAG AA 5.17:1 / 7.13:1) 강화, 탭 `role="tabpanel"`·`aria-controls`·`aria-labelledby` 및 모달 다중 입력칸 `aria-label` 전수 연결, 스크립트 캐시 버전(`?v=18` · `?v=10`) 갱신.
- **운영 RTDB(`/scal_ilteo`) 전수 비식별 백필 스크립트 작성 및 ETag 조건부 정밀 적재 완료 (`scripts/backfill-ilteo-history.js`)**:
  - 통합 메일 거울 33,045통 + 기업규정 서고 1,352건을 교차 대조(공유 이메일·동명 기업 오매칭 차단)하여 컨설팅 수행 사업장 **186개사**(일터혁신 39개사 · 타 컨설팅 이력 147개사)를 정식 ID(`ilt_<companyId>_<year>`)와 공식 19개 과제 코드로 확정.
  - 다음메일 IMAP(`readOnly: true`, 195통 · 첨부 191건), 다음메일 POP3(`popOpen` 읽기 전용 · `DELE` 없음, 원문 `RETR` 103통/첨부 47건 · 경량 580통), 기업규정 서고(225건) 전 경로에 `kordoc` 1차 가림(`ensureKordoc`/`doubleRedactText` fail-closed: 미준비·예외 시 원문 반환 차단) 및 `PuIlteoIntake` 다중 가림 적용.
  - 레코드별 `X-Firebase-ETag` 조회 → 최신 `_deleted`/`updatedBy`/`revision` 재확인 → `If-Match` 조건부 `PUT`(`conditionalWriteRecord`, `412` 충돌 시 자동 건너뜀)으로 비식별 수집 카드 **1,245건**(취업규칙 418건 · 설계·검토의견 274건 · 최종보고 원문 140건 · 근로계약 116건 · 임금대장 71건 · 회차 수행증빙 45건 · 조직진단 설문 43건 · 근로시간·휴가 31건 · 노사협의회 26건 · 안내·동의 22건 · 정산·평가 21건 · 조직·명부 15건 · 중간보고 원문 15건 · 근로자동의 8건), 중간보고서 **186건**, 완료·후속단계 최종보고서 **130건**(진행 중 기초단계 56개사는 미확정 유지, 총 수록 분량 **3,700,627자**)을 운영 `/scal_ilteo`에 안전하게 적재.

## 확인
- `tests/ilteo-auto.test.js` 12건 전수 통과 (`국·표·록·수·원·호` 끝글자 인명·어근+조사 접미 충돌·숫자/영문/구분자 결합 단독 인명 토큰·도로명 주소 가림, `kordoc` fail-closed, `ETag/If-Match` 동시성·묘비 보호, 공유 이메일/도메인 격리, `.pptx` 자연정렬, 공식 과제 코드 정합성, 과거 보고서 원문 반영 포함).
- 전체 시스템 검사(`node --test "tests/*.test.js" "functions/*.test.js"`, `color-palette-apps.test.js` · `check-cache-version.js --all` 포함) 전수 통과.
- 휴대폰·데스크톱 화면 감사(`node tools/phone-audit/run.mjs ilteo --widths=360,411,1366 --full`): 4개 탭 × 3개 폭 전 구간 옆넘침 0 · 화면밖 0 · 작은단추 0 · 작은입력 0.
- 운영 RTDB `/scal_ilteo` 사후 전수 감사: 활성 사업장 186건 ID 규격 오차 0건 · 미등록 과제 코드 0건 · 수집 카드 1,245건 및 보고서 316건(3,700,627자) **개인정보 잔존·단독 제목 인명 유출 0건** 확인.

## ⚠ 못 한 것 · 확인 필요
- 배포 뒤 실제 `ilteo.html` 화면에서 대표 로그인 상태로 백필된 186개 사업장 목록(일터혁신 39개사 · 타 컨설팅 147개사)과 중간·최종보고서 원문 열람을 확인해야 한다.
- POP3 지난 메일함 중 5MB 초과 초대용량 첨부 메일은 서버 속도(약 60KB/s) 보호를 위해 본문 앞부분(`TOP`)과 메타 위주로 반영했으며, 필요 시 화면에서 건별 `🔍 내용확인·분석` 또는 로컬 파일 끌어놓기로 추가 정밀 분석할 수 있다.
