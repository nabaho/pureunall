# 2026-11-11 — 보낸 견적서 전수 수집·참고·수정 & 확정 계약서 통합 관리 (`docs-esign.html` · `pu-quotes*` · `pu-office-docs.js` · `pu-contract-forms.js` · `pu-quote-detect.js` · `pu-co-roster.js`)

## 요청 및 결정 사항
- **계약서등관리(`docs-esign.html`)**에서 푸른메일로 보낸 모든 견적서 등을 빠짐없이 가져와 참고·수정할 수 있게 하고, 확정된 계약서 등도 모두 가져와 필요시마다 수정·변경(변경·갱신 계약서, 새 사본 작성, 공용 양식화)을 아주 쉽게 관리할 수 있도록 구축.
- `직장 내 괴롭힘 조사` 등 기존 분류·표준 양식에 빠져 있던 모든 계약·견적 갈래를 전수 재정리.
- **확정 설계(대표 결정)**:
  1. 왼쪽 메뉴를 **`💼 보낸 견적서 관리`**(`#navQuotes`, `data-pane="quotes"`)와 **`📑 확정 계약서 관리`**(`data-pane="co"`)로 명확히 분리.
  2. 참고·수정 두 방식 동시 지원: ① 한글(`.hwp`/`.hwpx`) 내장 편집기(`✏ 한글처럼 손보기`)로 바로 손봐 **새 사본**으로 저장·내려받기·PDF 변환·메일 발송(보관함 원본은 영구 보존), ② 스캔본/PDF이거나 표준 양식으로 재작성할 때 `찾아서 채우기`(`PuContractForms.openFill`)에 의뢰처·금액·부가세·기간·인원·과업 자동 채움 + 목록 정보·금액 즉시 수정 및 복제 저장.
  3. 보안 규칙 100% 호환(재배포 불필요): 목록(업체·업무·과업·기간)은 재직 직원 모두 참고 가능하되, **금액과 원본 열람·수정은 대표·총괄관리자(`isAdmin`)·재무(`fin`)·확정 담당자(`owner` / 작성자)**만 허용.

## 주요 구현 내용
1. **계약·견적 감지 및 16종 갈래 재정리 (`js/pu-quote-detect.js`, `functions/quote-detect-core/pu-quote-detect.js`, `js/pu-co-roster.js`)**:
   - `QUOTE_RE`(`견적`·`수임료/비용/보수/수수료 안내`), `CONTRACT`(직장내괴롭힘·성희롱·진상조사, 산업안전·중대재해·안전보건, 노무진단·조직진단, 단체교섭·임금교섭, 법률의견·의견서, 기금설립, 급여관리·사무위탁, 변경·갱신·연장 합의서 등 전수 반영), `NOT_CONTRACT`(근로·연봉·급여·촉탁계약서 차단), `isSignedContract`(체결·서명·날인·직인·확정·회신 단서 판별) 추가 및 서버 사본 동기화.
   - `PuCoRoster.KINDS`를 16종(`급여관리`, `자문`, `컨설팅`, `괴롭힘·성희롱조사`, `산업안전`, `노무진단·규정`, `사건`, `단체교섭`, `의견서`, `기금`, `교육·강의`, `변경·갱신`, `CMS`, `EDI`, `제안서`, `기타` — 모두 20자 이내 RTDB 규칙 호환)으로 확장하고 `guessKind` 정교화.
2. **표준 계약서·견적서 양식 시드 7종 추가 및 자동 채움·양식 등록 (`js/pu-contract-forms.js`)**:
   - `CONTRACT_FORM_VARS`에 `{{과업내용}}`, `{{대상인원}}` 추가.
   - 신규 표준 양식 7종(`fm-pr-harass`, `fm-pr-safety`, `fm-pr-opinion`, `fm-pr-bargain`, `fm-pr-amend`, `fm-pr-harass-quote`, `fm-pr-consulting-quote`) 시드 수록.
   - `openFill`에서 지난 견적서·확정 계약서 초기값(`initial`) 및 업체(`coName`·`bizNo`) 자동 매칭 지원(DB 미접촉 원칙 유지), `registerForm` 트랜잭션 공용 양식 등록 함수 추가.
3. **보낸 견적서 전수 수집 및 참고·수정 워크벤치 (`js/pu-quote-import.js`, `js/pu-quotes.js`, `js/pu-quotes-view.js`)**:
   - 한 메일 내 복수 견적·계약 첨부 전량 수집(`allAtts: true`, `#idx` 키), 파일명에 견적·계약이 명시된 엑셀·워드 허용, AI 한도와 무관하게 원본을 일괄 수집하는 `⚡ 파일만 빠르게 모두 가져오기(AI 없이)`(`skipAi: true`) 추가.
   - `PuQuotes.update(qid, recPatch, amtPatch)`(원본 `createdAt`·`by`·확정 `owner` 보존 부분 수정) 추가.
   - `PuQuotesView`: 업무 갈래별 건수 칩, `확인 필요` 필터, `+ 새 견적서 작성·올리기`, 행별 `✏ 참고·수정` 및 상세 모달(실시간 원본 미리보기, 한글 편집기로 새 견적서 만들기, 표준 양식 채우기, 확정 계약서 전환, 공용 양식 등록, 정보·금액 수정 및 복제 저장) 구현. 무권한 직원 금액 0글자 보안 유지.
4. **확정 계약서 일괄 수집 및 원클릭 변경·수정 관리 (`js/pu-office-docs.js`, `docs-esign.html`)**:
   - `📨 확정 계약서 가져오기` 모달 추가: ① 푸른메일(받은메일함·보낸메일함)의 체결·서명·확정 계약서 스캔·선택·일괄 수집(`🔒 서명본` + 기업별 파일·기록), ② 푸른이알피 확정 계약 스캔·일괄 동기화.
   - 기업별 계약서 머리줄·계약 기록 상세·파일 상세 창에 `✏ 한글로 수정·변경`, `📝 양식으로 변경·갱신`, `📑 변경합의서`, `📄 양식 등록` 및 한글/엑셀 미리보기 연결.
   - 캐시 버전 동기화(`docs-esign.html`, `pu-erp.html`, `pu-cards.html`, `pu-photos.html`).

## 검증 및 Orca 다중 에이전트 리뷰 반영
- 신규 통합 테스트 `tests/quotes-contracts-manage.test.js` 작성 및 통과.
- 기존 테스트 스위트(`quote-detect*`, `co-roster`, `quotes*`, `office-*`, `docs-*`, `form-cardfill`, `erp-contract-fill`, `color-palette-apps`, `one-line-cells`, `phone-screen-rules`, `phone-input-zoom`, `read-fence-apps`, `hide-sid-apps-b`, `dead-code`, `html-inline-script-syntax`, `pair-guards`, `functions/*.test.js` 411건 등) 전수 통과.
- Orca 기능·UI 검증 및 보안 검토(`ow.bat review --ui`) 지적 사항 전량 수정 반영:
  - 공용 양식(`data/contract_forms`) 등록 시 `PuRrnMask.maskRrnInText` 주민번호 가림 + 고객사명·사업자번호·금액 `{{변수}}` 자동 치환 및 본문 검수 편집창 추가, 비밀 원본 첨부 기본 비활성화(`registerDocBytesAsForm`, `PuContractForms.registerForm` 인라인 `attachments`/`docRole` 정합성 일치).
  - 비작성자(`fin`·확정 `owner`) 복제 저장 시 RTDB `pu_quotes/$q/fileId`·`puDocSecret` 보안 규칙과 정확히 일치하도록 직접 덮어쓰기 숨김 및 타인 `fileId` 분리 처리(`PuQuotesView`, `quotesUpdate`, `quotesEditHwp`).
  - 상세 모달 `aria-modal="true"` 및 `Escape` 닫기, 모바일 행(`.c-co`) `role="button"`·`tabindex="0"` 키보드 접근성, 새 견적서 모달 전환 시 이전 모달 닫기 반영.
