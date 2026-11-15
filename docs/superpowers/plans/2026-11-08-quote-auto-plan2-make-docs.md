# 견적·계약 자동화 — 계획 2: 서류 만들기 (한 화면 입력 → 세트 채우기 → 초안 PDF → 카톡 검토 → 메일) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 직원이 계약서등관리에서 사업장·업무 종류·금액·기간을 **한 번만** 적으면 그 업무에 맞는 견적서·계약서가 세트로 채워지고, 금액이 비어 있어도 «초안 PDF»를 만들어 단톡방에 올려 검토를 받고, 검토가 끝나면 받는 사람·제목·첨부가 채워진 메일 창이 열리게 한다. 메일은 담당자가 «보내기»를 한 번 누른다.

**Architecture:** 이미 있는 부품을 잇는다 — 채워서 받기 창(`PuContractForms.openFill`), 서식 세트(`data/contract_form_sets`), 채우기(`fillFormOnce`/`formHwpFill`), PDF 조각(`formHwpPdf`), 메일 확인 창(`openSend`), 작업 기록(`PuWorklog`의 `review_request`·`review_done`은 이미 있음). 새로 만드는 것은 ① 한 화면 입력 창과 «업무 종류 → 서류 짝» 표(순수 모듈 `js/pu-doc-make.js`) ② 초안 PDF 만들기 ③ 검토 기록 `pu_review` ④ 단톡방의 «OK 검토번호»를 읽는 서버 훅 ⑤ 검토 전 발송 문 하나이다.

**Tech Stack:** 바닐라 JS(IIFE + `window.Pu*`), Firebase RTDB, Cloud Functions(node 22), 한글(.hwpx)은 rhwp WASM 그림 → jsPDF 이미지 PDF, 테스트 `node:test` + `vm`(함수를 떠서 «돌려» 본다 — STATUS 되풀이된 실수 2).

**Spec:** `docs/superpowers/specs/2026-11-07-quote-contract-auto-design.md` §4 단계 2, 단계 4b, §7. 계획 3(`2026-11-08-quote-auto-plan3-erp-queue.md`)의 신호 (나)(계약서등관리에서 계약서를 만들어 보냄)가 이 계획의 «메일 보낸 뒤»에 붙는다.

## 대표가 말씀하신 것 (지키는 선)

- 직원이 계약서등관리에 들어가 **사업장·금액·기간 등을 그냥 넣고**, 자문·급여·기금 같은 업무 종류를 말하면 거기에 맞춰 **견적서 또는 자문·컨설팅·사건·기금 계약서를 맞춤형으로** 만든다. (2026-11-08)
- 담당자가 메일로 보내기 전에 **푸른 단톡방에 PDF 로 한 번 올려 검증받고**, 그 뒤에 메일로 보낸다. 가능한 한 자동으로.
- **금액 등이 정해지지 않아도 카톡에 올릴 수 있어야** 한다.
- 이전 결정(2026-11-07): 메일은 담당자가 확인하고 보낸다(자동 발송 없음). 견적 금액은 대표·총괄관리자·재무·확정 담당자만 본다.

## 먼저 알아 둘 한계 (사실)

- **프로그램이 카톡 단톡방에 파일을 저절로 올리는 것은 안 된다.** 카카오가 막아 두었고 비공식 자동 조작은 약관 위반이다(설계 §2 «안 할 것»). 올리는 마지막 한 번은 사람이 누른다. 이 계획은 «누르는 한 번»을 가장 쉽게 만든다 — 폰은 공유 창, PC는 PDF 받기·이미지 복사.
- **금액 비공개와 단톡방은 부딪힌다.** 모든 직원이 있는 방에 금액이 든 PDF 를 올리면 금액 잠금이 뚫린다. 그래서 단톡방용 «검토본»은 **금액 칸을 비운 채**(밑줄) 만들고, 금액이 든 PDF 는 권한자만 받는다 — **[대표 결정 필요]** 금액을 가린 검토본으로 갈지, 금액이 든 PDF 는 권한자만 있는 방에서만 올릴지.
- 카톡정리가 읽는 단톡방 글은 서버만 읽을 수 있다(`kakaoWork/notes`, 총괄관리자 화면으로만 열람, 30일 보관, 글은 가림 처리 후 2,000자). 보낸 사람은 «표시 이름»뿐이라 속일 수 있다 → 「OK」 인식은 **승인자로 정한 이름**일 때만, 그리고 되돌릴 수 있게 한다.

## 지금 코드에서 확인한 사실 (main 5e5113d5 이후 + 조사 2026-11-08)

- **채워서 받기 창**: `openFill(fms, host, title)`(`js/pu-contract-forms.js` 1542). 양식을 여럿 넘기면 «📦 묶음 채우기»가 되어 zip 받기·한꺼번에 메일이 된다(`doDownload` 2058, `doMailAll` 2026). 값은 창 안 `values()`가 모은다 — `CF.valuesFrom` → 이알피 계약 값 → `proposalValues` → `caseValues` → 사람이 고친 값 `st.edits`. **창 밖에서 처음 값을 넣는 길이 없다**(이 계획이 `opts.initial` 을 더한다).
- 창 없이 쓸 수 있는 함수: `contractValues(info)`, `makePlan(forms, v, sets)`, `contractPick(forms, info)`, `fillFormOnce(fm, V, host)`. 단, `fillFormOnce` 는 한글 채움의 `preview` 를 버려 PDF 로 쓰면 모양이 조금 달라질 수 있다 — PDF 는 `formHwpFill` 의 `r.preview` 를 쓴다(`docs-esign.html` 2254 가 그렇게 한다).
- **세트**: `CONTRACT_SETS`(404), `TYPE_SET`(407)은 `company`(자문·급여·노조·사무대행)·`fund` 만 있다. 이알피 쪽 `ERP_TYPE_SET`(`pu-erp.html` 42953)과 글자가 같아야 해서 건드리면 `tests/erp-contract-fill.test.js` 가 걸린다. **견적서 `fm-pq-01~09` 는 코드에 정의가 없고**(RTDB `data/contract_forms` 에만 있다) `fm-pq-07` 만 기금 세트에 들어 있다. `contractPick` 은 «제안서·견적서» 묶음을 일부러 뺀다(418).
- **PDF**: 한 방 함수는 없다. 조각 — `formHwpPdf(bytes, name)`(`docs-esign.html` 778, 채운 한글 → 화면 밖 canvas → jsPDF A4 이미지 PDF, `host.hwpPdf` 로 연결됨), `_esignHwpMergedPdf(list)`(2086, 여러 벌 → 한 PDF), `signRender`(`pu-contract-forms.js` 819, 엑셀은 건너뜀), `EsignDocs.htmlPagesToPdf`(`esign-docs.js` 148). 엑셀 양식은 PDF 길이 약하다.
- **카톡 공유**: 지금 `navigator.share` 는 글·링크만 보낸다(`pu-contract-forms.js` 907, `docs-esign.html` 1449). **파일 공유(`navigator.canShare({files})`)는 없다.**
- **단톡방**: 방 목록은 상수가 아니라 데이터(`kakaoWork/rooms`)다. 코드로는 «법인 단톡방»이 목록에 있는지 확인되지 않는다(문서가 가리키는 이름은 「푸른노무법인 업무채팅방」). 글은 하나문자 앱 → `hanaMessageBridge` `kakaoIngest` → `kakaoWork/notes/{날짜}/{해시}`(`room`·`sender`·`text`·`sentAt`)에 쌓인다. 규칙에 `kakaoWork` 가 없어 서버(Admin SDK)만 접근하고, 화면은 `kakaoList`(총괄관리자만)로만 읽는다.
- **메일**: 확인 창 `openSend(o, host)`(`pu-contract-forms.js` 2196, **밖으로 내보내지 않는 안쪽 함수**)가 받는 사람·참조·제목·본문·첨부 목록·«PDF도 붙이기»·«보낸 사본 보관»을 보여 주고 «보내기를 누르기 전엔 아무것도 나가지 않습니다»라고 적는다. 발송은 `formMailSend` → `PuDocFile.putMailFile`/`sendMail`, 기록은 `formMailRecord`.
- **작업 기록**: `review_request`·`review_done` 이 이미 `PuWorklog.KINDS` 에 있다(12종). 새 종류를 더하면 `entry()` 가 던지니 `KINDS`·개수 시험(`tests/worklog.test.js` 41~43)을 같이 고친다. 규칙은 kind 를 열거하지 않고 20자 이하만 본다.
- **새 저장 자리 관례**: 주인 등록(`js/pu-ontology.js` `primaryRoots`, `tests/ontology-registry.test.js`), 규칙은 `pu_quotes` 모양(`.read`·`.indexOn`·`$id` 쓰기·`hasChildren`·길이 검사·`id === $key`·`entityType`·`createdAt`·`$other:false`), 게시 전 `tests/photos-staff-share.test.js` 의 `PENDING` 에 경로를 적고 게시 뒤 비운다.

## Global Constraints

- **v1 은 AI 를 쓰지 않는다.** 입력 칸을 직접 적는 한 화면이다. 글·음성으로 설명하면 AI 가 칸을 채우는 것(spec §4 단계 2 처음 설계)은 이 계획 뒤 «v2» 로 둔다 — 비용·한도·잘못 읽음 위험 없이 효율의 대부분을 얻는다.
- 금액·기간·인원은 **선택**이다. 비워 두면 서식의 «밑줄»로 남는다(`채울 자리` 표가 이미 «비워 두면 밑줄»). 비었다고 0원이나 기본값을 넣지 않는다(STATUS·조직 규칙: 누락값을 0으로 처리하지 않는다).
- 검토본 PDF 에는 금액·직원 개인정보를 넣지 않는다(위 한계). 워터마크 «초안·검토용» 과 검토번호 `Q-MMDD-N` 을 첫 쪽·파일 이름에 찍는다.
- 공용 서식 원본은 고치지 않는다 — 채운 사본만 만든다(spec §5).
- 새 저장 자리 `pu_review` 의 주인은 계약서등관리(`primaryRoots`)에 등록한다. 검토 기록에 금액을 담지 않는다.
- 기록은 모두 `PuWorklog` 에 남긴다(`review_request`·`review_done`·`mail_send`). 기록 실패가 본래 일을 막지 않는다.
- 규칙은 `scripts/make-firebase-rules.js` 에만 고친다. 게시는 미리보기 → 대표 승인 → `--deploy`.
- 켜는 길과 푸는 길을 함께 만든다(되풀이된 실수 4): 「OK 자동 인식」은 기본 꺼짐, 수동 「검토완료」 단추는 늘 있다.
- 바꾼 화면은 캐시 번호(`?v=`)를 올린다. 같은 줄을 다른 방도 올리면 «큰 쪽 +1».
- 화면 글은 쉬운 우리말, 노무 용어(급여→임금, 직원→근로자). 폰에서도 한 화면에(CLAUDE.md 폰 화면 규칙) — 새 창은 폰 구간 규칙(`tests/phone-screen-rules.test.js`)을 지킨다.
- 테스트: `node --test tests/<파일>.test.js`, 전체 `node --test "tests/*.test.js" "functions/*.test.js"`.

## Review Focus

1. **금액이 단톡방 PDF 에 새지 않는다** — 검토본 만들기가 금액 칸을 비운다는 것을 «PDF 로 보내는 값»에서 시험으로 지킨다. → Task 3.
2. **금액·기간이 비어도 만들어진다** — 빈 값이 0·`undefined`·`{{…}}` 글자로 새지 않는다. → Task 1·2.
3. **업무 종류에 맞는 서류만 고른다** — 짝 표가 틀려 엉뚱한 계약서가 채워지지 않는다(자문 ↔ 컨설팅 ↔ 사건 ↔ 기금). 사람이 체크로 빼고 더할 수 있다. → Task 1·2.
4. **「OK」 한 줄이 검토를 끝내지 않는다** — 승인자가 아닌 이름·검토번호가 없는 글·이미 끝난 건은 무시, 인식은 기록으로 남고 되돌릴 수 있다. → Task 5.
5. **검토 전 발송 문** — 검토가 필요한 서류는 검토완료 전에는 일반 직원이 «보내기»를 못 누른다. 대표·총괄관리자는 열려 있다(결정 필요). → Task 6.
6. **같은 서류를 두 번 올리지 않는다** — 같은 검토번호로 PDF 를 다시 만들면 새 번호가 아니라 «다시 올림»으로 이어진다. → Task 4.
7. **엑셀 서식** — PDF 길이 약하다. 빠지는 서식은 «엑셀 양식은 PDF 에서 빠집니다» 로 알리고 조용히 빼지 않는다. → Task 3.

---

### Task 1: 업무 종류 → 서류 짝 표 (순수 모듈)

**Files:**
- Create: `js/pu-doc-make.js` (UMD, `window.PuDocMake`)
- Test: `tests/doc-make.test.js`

- [ ] 모듈이 내놓는 것: `KINDS`(업무 종류 목록), `pairsFor(kind)`(견적서·계약서 서식 id 목록 + 이름), `intakeToValues(intake)`(입력 → `{칸이름: 문자열}`; 빈 값은 칸을 «빼서» 밑줄이 되게), `reviewNo(date, seq)`(`Q-MMDD-N`).
- [ ] 업무 종류 목록은 spec §4 단계 1 표를 따른다 — 노무자문, 인사노무 컨설팅(직무분석·규정정비·진단·원가산출), 산업안전 컨설팅, 직장 내 괴롭힘·성희롱 조사, 교육·강의, 임금·단체교섭, 사내·공동근로복지기금, 의견서, 사건 대리(위임), 급여(대행). **[확인 필요]** 급여·노조·사무대행도 넣을지(이미 `TYPE_SET` 에 있다).
- [ ] 짝 표의 저장: **코드에 서식 id 를 박지 않는다.** 서식 정의가 RTDB `data/contract_forms` 에만 있으므로, 업무 종류 → 서식 id 짝은 `data/contract_form_sets` 에 «견적 세트»(`fs-quote-…`)로 둔다(`SET_SEED` 와 같은 통표, 화면에서 고칠 수 있음). `ERP_TYPE_SET`·`TYPE_SET` 은 건드리지 않는다(이알피와 글자 맞춤 시험을 지킨다). 이 Task 가 실제 서식 목록을 읽어 어느 서식이 «견적서»인지 정한다 **[확인 필요]** — 제안 공문 `fm-pq-08`·비용 청구서 `fm-pq-09` 는 견적서가 아닐 수 있다.
- [ ] 시험: 짝 표 모양 · 빈 금액/기간/인원 → 값에 칸이 없음(0·«undefined» 글자 없음) · 검토번호 모양 · 없는 업무 종류 → 빈 목록(던지지 않음).

### Task 2: 「서류 만들기」 한 화면 입력 창

**Files:**
- Create: `js/pu-doc-make-view.js`
- Modify: `js/pu-contract-forms.js` (`openFill(fms, host, title, opts)` 에 `opts.initial` 을 더해 처음 값을 넣는다 — 기본은 지금과 같다), `docs-esign.html`(들어가는 단추·스크립트), 캐시 번호
- Test: `tests/doc-make-view.test.js`, `tests/contract-forms-initial.test.js`

- [ ] 입력 칸: 사업장(이름 찾기 — 이알피 업체·기업정보함, 이름으로 업체 ID 를 채우지 않는다) · 업무 종류(고르기) · 금액(선택) · 부가세 별도/포함(선택) · 기간 시작·종료(선택) · 인원(선택). 이알피 계약을 골라서 시작하는 길도 둔다(`formContract`).
- [ ] 입력하면 짝 표로 «견적서 + 계약서» 목록이 체크로 뜨고, 사람이 빼거나 더한다. 「채우기」를 누르면 `openFill(선택한 서식들, host, 제목, {initial: intakeToValues(...)})` 를 연다 — 묶음 채우기 창이 그대로 나온다(칸 고치기·한글로 열기·인쇄·한글 내려받기·서명 받기 포함).
- [ ] 금액이 빈 채로도 «다음»이 된다. 빈 칸 수를 화면에 알려 준다(「금액·기간 2곳 비었습니다 — 밑줄로 남습니다」).
- [ ] 폰 화면: 입력 창은 폰에서 한 열, 입력칸 16px 이상.
- [ ] `opts.initial` 시험 — 창을 열기 전 값이 `values()` 에 들어가고, 사람이 고친 값(`st.edits`)이 이긴다.

### Task 3: 초안 PDF 만들기 (검토본)

**Files:**
- Modify: `docs-esign.html` 의 `formHwpPdf`(워터마크·쪽 번호 옵션), 새 `js/pu-doc-review-pdf.js` (순수: 검토본 값 만들기 · 워터마크 글 · 파일 이름)
- Test: `tests/doc-review-pdf.test.js`

- [ ] **검토본 값**: `reviewValues(V)` 는 금액 계열 칸(`계약금액`·`부가세`·`보수` 등)을 «빼서» 밑줄로 만든다. 어느 칸이 금액 계열인지는 한 곳(표)에 적고 시험이 지킨다.
- [ ] 한글 서식은 `formHwpFill` 의 `preview` → `formHwpPdf` 로 A4 이미지 PDF. 워터마크 «초안·검토용 · 검토번호» 를 쪽마다 비스듬히 얹는다(원본 글자는 가리지 않게 옅게). 여러 서식은 `_esignHwpMergedPdf` 로 한 PDF.
- [ ] 엑셀 서식은 PDF 에서 빠지고, 빠진 이름을 알린다(조용히 빼지 않는다 — Review Focus 7).
- [ ] 파일 이름 `검토용_{업무}_{사업장}_{Q-번호}.pdf`. 한글 이름·60자 한도.
- [ ] 시험: 금액 칸이 검토본 값에 없다 · 비워도 던지지 않는다 · 워터마크 글에 검토번호가 있다 · 엑셀 서식은 빠지고 이름이 돌아온다(가짜 렌더러로 «돌려» 본다).

### Task 4: 카톡 올리기 — 사람이 누르는 마지막 한 번을 쉽게

**Files:**
- Modify: `js/pu-doc-make-view.js`, `docs-esign.html`
- Test: `tests/doc-share-pdf.test.js`

- [ ] **폰**: `navigator.canShare({files:[File]})` 가 되면 «📤 카톡에 올리기» 단추가 PDF 파일을 공유 창에 싣는다. 공유 창에서 단톡방을 고른다(사람이 누름). 안 되면 아래 PC 길로.
- [ ] **PC**: «PDF 받기»(파일 저장 + 폴더 열기 안내). **[확인 필요]** «이미지로 복사»(첫 쪽을 클립보드에 넣어 카톡 PC 에서 Ctrl+V)가 실제로 붙는지 한 번 시험한다 — 되면 검토용 한 쪽짜리에 편하다. 여러 쪽은 PDF.
- [ ] 올릴 때 보낼 글을 함께 복사한다: `[검토 요청 Q-1108-1] ○○ 견적서 — 확인 부탁드립니다. 승인은 「OK Q-1108-1」`.
- [ ] 같은 검토번호로 다시 만들면 «다시 올림»(수정 N차)으로 잇는다(Review Focus 6).
- [ ] 시험: 공유 가능 여부 분기(가짜 `navigator`) · 보낼 글 모양 · 다시 올림 번호.

### Task 5: 검토 기록 `pu_review` + 「OK 검토번호」 인식

**Files:**
- Create: `js/pu-review.js`(저장 층: `request`·`approve`·`list`), `functions/kakao-review-watch.js`(서버 훅), 시험 `tests/review.test.js`·`tests/review-rules.test.js`·`functions/kakao-review-watch.test.js`
- Modify: `scripts/make-firebase-rules.js`(새 `rules.pu_review`), `js/pu-ontology.js`(`primaryRoots` 에 `pu_review`), `functions/kakao-work-server.js`(`ingest` 뒤에서 훅 호출 — 던지지 않음), `tests/photos-staff-share.test.js`(`PENDING`), 규칙 적용본·캐시 번호

- [ ] 한 건 = `{id, entityType:'Document', no(Q-번호), kind('견적서'|'계약서'…), co(사업장 이름만), by(uid), byName, state('요청'|'검토완료'|'반려'), draftAt, okAt, okBy, createdAt, updatedAt}`. 금액·서식 본문·주소를 담지 않는다. 쓰기: 요청은 본인 uid, `검토완료`·`반려`는 승인자·총괄관리자만(규칙으로).
- [ ] 「요청」은 PDF 를 만들 때 자동으로 한 줄 만들고 `review_request` 를 남긴다.
- [ ] **수동 「검토완료」 단추**는 늘 있다(승인자·총괄관리자). `review_done` 기록.
- [ ] **서버 훅(기본 꺼짐, 켜는 길·푸는 길 함께)**: `kakao-work-server.js` 의 `ingest` 가 글을 쌓은 뒤, 설정한 방의 글에서 `/(OK|오케이|승인|확인).{0,10}(Q-\d{4}-\d+)/i` 를 찾아 승인자 이름 목록(설정 `pucards/config/reviewWatch`)에 있는 «보낸 사람»일 때만 `검토완료`(`okBy`=그 이름, 기록은 `review_done` + 「카톡 자동 인식」)로 바꾼다. 검토번호가 없거나 승인자가 아니거나 이미 끝난 건은 무시한다. 실패해도 던지지 않는다(수집은 계속).
- [ ] **[확인 필요]** 어느 방(방 이름)을 읽을지, 승인자 이름 목록, 법인 단톡방이 카톡정리 방 목록에 들어 있는지.
- [ ] 시험: 규칙 모양(`pu_quotes` 본보기) · 승인자가 아니면 못 바꿈 · 훅이 «OK Q-번호» 만 짚고 다른 글은 안 건드림 · 같은 글을 두 번 받아도 한 번 · 되돌릴 수 있음.

### Task 6: 메일 보내기 연결 — 검토 문

**Files:**
- Modify: `js/pu-contract-forms.js`(`openSend` 에 `o.review`·`o.gate` 를 받는다 — 밖으로 내보내지 않는 함수라 `openFill` 의 호스트 경로로 부른다), `docs-esign.html`(`formMailRecord` — 계획 3 신호 (나) 연결)
- Test: `tests/doc-send-gate.test.js`

- [ ] 서류를 검토번호와 함께 만든 경우, 메일 확인 창이 `pu_review` 상태를 읽어 `검토완료`면 «✔ 검토 끝났어요 (OK 한 사람 이름)» 를 보여 준다. 아니면 «검토 전입니다» 를 보여 주고 일반 직원은 «보내기»가 막힌다.
- [ ] **[대표 결정 필요]** 검토완료 전에도 대표·총괄관리자는 보낼 수 있게 할지(설계 §4 단계 2 처음 판단: 가능).
- [ ] 발송 후 `formMailRecord` 가 이미 하는 일(보낸 서류 기록·서명본 대기·작업 기록)에 더해, **계획 3 의 신호 (나)** 를 대기열에 남긴다(계획 3 Task 4 와 한 길로 — 이 계획에서는 훅만 둔다).
- [ ] 시험: 검토 전 일반 직원 막힘 · 대표/총괄 허용(결정에 따라) · 검토번호 없는 서류는 문 없음(지금처럼 발송) · 발송 실패가 검토 상태를 바꾸지 않음.

### Task 7: 마무리 — 문서·기록·PR

- [ ] 설계 문서 «계획 2 반영» 에 실제로 만든 것·바뀐 것을 적는다.
- [ ] `status/2026-11-08-quote-plan2.md` 새 파일 한 개, `STATUS.md` 「2. 지금 손이 필요한 것」 갱신.
- [ ] 전체 시험, 폰·PC 화면 확인(가짜 파이어베이스와 지어낸 자료), 규칙은 미리보기 → 승인 → 게시, 서버 훅은 GitHub 「Firebase 배포」(functions)로 올리고 보고에 적는다.
- [ ] 이 계획의 «카톡 자동 인식»을 켜기 전 한 달 뒤 확인할 날짜를 STATUS 에 적는다(되풀이된 실수 10 — 아무도 안 켜는 칸).

## 효율 순서 (먼저 만들면 가장 큰 효과)

1. **Task 1 + 2** — 한 화면 입력 → 세트 채우기. 가장 시간이 많이 줄고 위험이 낮다(기존 부품, AI·서버 없음).
2. **Task 3 + 4** — 초안 PDF 와 카톡 올리기. 금액이 비어도 검토를 시작할 수 있다.
3. **Task 5 + 6** — 검토 기록, «OK» 인식, 검토 전 발송 문. 손이 가장 많이 드는 «검토 확인»을 줄인다.
4. 계획 3 — 메일 보낸 뒤 이알피 «상담접수» 자동 등록.

## 이 계획 밖 (남는 것)

- **v2: 글·음성으로 설명하면 AI 가 칸을 채우는 것**(spec §4 단계 2 처음 설계), 지난 견적 곁보기(금액은 권한자만).
- 카톡 알림톡(사업자 채널·건당 요금, 별도 승인 사안).
- 계획 3(이알피 자동 등록·확정)·4(이알피 금액 잠금).

## 대표에게 확인할 것

1. **금액이 든 PDF 와 단톡방** — 금액을 가린 «검토본»을 모든 직원이 있는 방에 올리고, 금액이 든 PDF 는 권한자만 받는 것으로 갈지.
2. **검토 전 발송** — 검토완료 전에도 대표·총괄관리자는 바로 보낼 수 있게 할지.
3. **승인자** — 「OK」 로 검토를 끝낼 수 있는 사람(이름 목록)과 읽을 단톡방 이름.
4. **업무 종류와 서류 짝** — 업무 종류 목록(급여·노조·사무대행 포함 여부)과 어느 서식이 «견적서»인지(`fm-pq-08` 제안 공문·`fm-pq-09` 비용 청구서 포함 여부).
5. **PC 에서 카톡에 올리는 방법** — PDF 받아 끌어다 놓기로 충분한지, «이미지로 복사»도 시험해 볼지.
