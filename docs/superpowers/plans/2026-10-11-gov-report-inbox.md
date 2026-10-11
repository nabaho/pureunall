# 컨설팅보고서 앱 — 받은 서류함(메일 첨부 후보 · 서류 줄 연결 · 열어 보기) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서류 칸 창(③ 서명본 · ④ 별첨 · ⑤ 제출)에 「📥 받은 서류 후보」(그 업체 «주소»로 오간 첨부 메일)를 보이고, 사람이 누른 후보 하나를 서류 줄에 「연결」(`scal_docs` 줄 안의 `link` 한 칸)하며, 「열어 보기」로 그 첨부를 서버에서 한 건씩 받아 앱 안에서만 본다(저장·업로드·내려받기 없음).

**Architecture:** 후보 만들기·주소 귀속·연결 열쇠·첨부 받기 순서·실패 문구는 새 순수 모듈 `js/pu-gov-report-inbox.js`(UMD, `window.PuGovReportInbox` / `module.exports`)에 둔다 — 주소는 `PuCoThread.addrsOf`, 개인 자료 식은 `PuGovReportBuild.PRIV_RE`, 서버 부르기는 `PuRulesMailOrig.makeCall` 을 그대로 가져다 쓴다.
- 서류 줄의 `link` 다듬기·검사·이어 받기는 기존 `js/pu-gov-report-track.js` 에 더한다(`normLink`·`nextLink`·`LINK_*`).
- `gov-report.html` 은 «칸 창을 처음 열 때 메일함 거울을 한 번 읽고(`GR_INBOX_NODES`) → 모듈에 넣고 → 칸 창 안 `#cwInbox` 만 그린다». 「연결」·「연결 지우기」는 **기존 쓰기 한 곳**(`grSaveCell` 의 줄 키 하나 `.set`)에 `link` 를 실어 보낸다. 「열어 보기」는 페이지 잠금(`GR.avBusy`)으로 한 번에 하나만, 한글은 `PuHwpPreview.open`, PDF·그림·표는 새 보기 창 `#attv`.
- 규칙은 생성기(`scripts/make-firebase-rules.js`)의 `scal_docs` 줄에 `link` 가지를 더하고 JSON 둘을 다시 만든다. **게시하지 않는다** — 게시 전에는 줄의 `$other:false` 때문에 `link` 가 든 저장만 거절되고 화면은 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」을 띄운다(다른 저장은 그대로 된다).

**Tech Stack:** 빌드 없는 정적 HTML + Firebase RTDB compat 9.23.0 · 브라우저/Node 겸용 UMD js · `node --test` + `vm` · 가짜 RTDB `tests/helpers/fake-rtdb.js`(`쓴것` 쓰기 기록, `orderByKey().limitToLast(n)` 흉내) · 합성 자료 `tests/helpers/gov-report-fixture.js` · 판독기 `vendor/pdf.min.js`·`vendor/pdf.worker.min.js`·`vendor/xlsx.full.min.js`(저장소 안, 누를 때 싣기) · 서버 함수 `readMailMessage`(peek)·`readMailAttachment`·`readOldMail`(functions/mail-sync.js, 고치지 않는다)

**Spec:** `docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md` (상위 `docs/superpowers/specs/2026-10-10-gov-report-track-design.md` · `docs/superpowers/specs/2026-10-11-gov-report-hwp-preview-design.md`, 모델 계획 `docs/superpowers/plans/2026-10-10-gov-report-track.md`)

## Global Constraints

- 이 화면의 쓰기는 **여전히 하나** — `fbDb.ref(GR_TRACK_NODES.docs+'/'+c.coId+'/'+c.rid+'/items/'+c.key).set(rec)`(grSaveCell). `link` 는 그 줄 레코드 안에 실린다. `update`·`remove`·`transaction`·`push` 금지(화면 검사 `INLINE.match(/\.(set|update|remove|transaction)\s*\(/g)` 가 `['.set(']` 하나여야 한다 — `classList.remove(`·`Map.set(` 같은 것도 쓰지 않는다).
- `link: { src:'mail', key:<문자열 1~80>, name?:<문자열 ≤100>, date?:'YYYY-MM-DD' }` — 규칙: `hasChildren(['src','key'])`, `src === 'mail'`, `key` 1~80자, `name` ≤100자, `date` = 기존 `SCAL_DOCS_DAY`, 그 아래 `$other:false`.
- **규칙 게시 금지.** `scripts/rules-deploy.js` 를 어떤 인자로도 돌리지 않는다(인자 없이도 콘솔을 읽고 JSON 을 다시 쓴다). 생성기 고침 + `docs/firebase-rules-전체-적용본.json`·`docs/rules-paste.json` 다시 만들기까지만. 게시 승인 요청은 컨트롤러가 한다.
- 게시 전 동작: `link` 가 든 저장이 거절되면 정확히 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」(`PuGovReportTrack.SAVE_FAIL`), 표·로컬 기록(`GR.track`)·칸 창 값은 그대로. `link` 없는 저장은 지금처럼 된다.
- 상태만 고치는 저장이 기존 `link` 를 지우지 않는다 — `entry.link = T.nextLink(옛 줄, op)` 로 이어 받아 같이 쓴다(검사로 고정).
- 「연결」·「열어 보기」는 **사람이 누를 때만**. 자동 연결 없음. 개인 자료(`PRIV_RE` — 제목 또는 첨부 이름)는 줄은 보이되 「개인 자료 · 목록에만」 딱지 + 연결·열어 보기 단추 없음. 기술보호 사업 줄은 「기술보호 자료」 딱지(연결·열기는 허용).
- 「열어 보기」는 **한 번에 하나** — 페이지 잠금 `GR.avBusy`. 받는 동안 다른 「열어 보기」 단추는 `disabled`, 눌러도 서버를 부르지 않는다(`{ok:false,busy:true}`). 지난 메일(POP3)은 「불러오는 중… (지난 메일은 1분쯤 걸립니다)」.
- 받은 바이트는 **어디에도 저장·업로드하지 않는다**(DB·localStorage·sessionStorage·IndexedDB·Cache·FormData·내려받기 없음). 그림은 blob URL — 닫으면 `URL.revokeObjectURL`. PDF 는 닫으면 `destroy()`. 받은 바이트는 함수 지역 변수로만.
- 판독기는 저장소 `vendor/` 에서만, «누를 때» 싣는다(`grLib`). 외부 주소·CDN 금지(서버 함수 주소 `GR_MAIL.fn` 은 취업규칙 화면 `rules.html` 의 `MAIL_FN_BASE` 와 같은 값 — 검사가 맞춰 본다). PDF 는 `isEvalSupported:false`, 그림 종류는 확장자로 «우리가» 정한다(메일이 적어 보낸 mime 을 믿지 않는다 — `tests/mail-att-preview.test.js` 와 같은 원칙).
- 실패 문구(정확히): 시간 초과·끊김 「메일 서버 응답이 없습니다 — 잠시 뒤 다시」 · 권한/로그인 「로그인을 확인해 주세요」 · 첨부 없음 「메일에서 그 첨부를 찾지 못했습니다(지워졌을 수 있습니다)」 · 20MB 넘음 「20MB 가 넘어 앱에서 열 수 없습니다 — 메일함에서 받아 주세요」 · 그 밖 형식 「이 형식은 앱에서 열 수 없습니다 — 메일함에서 받아 주세요」 · 메일함 못 읽음 「메일함을 불러오지 못했습니다」+다시 시도 · 주소 없음 「메일 주소가 등록돼 있지 않아 후보를 못 찾았습니다 — 업체관리에서 주소를 넣어 주세요」 · 50건 넘음 「50건만 보입니다」. 어느 실패든 칸 창(`GR.cw`·`cellw`)은 다시 그리지 않는다.
- 후보 기간: 첫 회차 −30일 ~ 마지막 회차 +90일(보고서 창 `grpCollect` 와 같다), 날짜는 KST 하루. 최대 50건, 날짜 내림차순.
- innerHTML 에 넣는 바깥 값(보낸이·제목·첨부 이름·시트 칸·연결 이름)은 모두 `grEsc`. vm 으로 떠 오는 함수(`grab`) 글자열 안에 짝 없는 `{`·`}` 금지. 정규식에 «글자 뒤 `\n`» 금지(`\r?\n`).
- 색은 저장소 팔레트만 — `gov-report.html` 의 변수(`--blue*`·`--line`·`--mute`·`--bg`·`--card`)와 기존 `.st-*`·`.act`·`.err-s`·`.days` 만. 새 hex 금지(`tests/color-palette-apps.test.js`). 새 입력칸 없음.
- 공개 저장소 — 검사·문서에는 합성 이름만(가나상사·다라정밀·마바산업·먼저상사·홍길동·김가나, 주소는 `example.com`·`example.org`, 우리 주소 자리 `office@pureun.kr`).
- 캐시 번호: 새 `js/pu-gov-report-inbox.js` 는 `gov-report.html` 에서 `?v=1`. `js/pu-gov-report-track.js` 를 고치므로 `gov-report.html` 의 `?v=2 → 3`(그 파일을 싣는 화면은 이것뿐 — `git grep` 으로 확인). 공용 `js/pu-co-thread.js`·`js/rules-v2/mail-orig.js` 는 고치지 않고 **지금 다른 화면이 쓰는 번호 그대로** 싣는다. `js/pu-ontology.js` 를 고치면 부르는 **모든** html(지금 24곳, `?v=62`)을 같은 커밋에서 `?v=63` 으로 — 바이트 보존 바꾸기 스크립트로, 끝나고 `git grep` 으로 한 값인지 본다. pre-commit 훅 `scripts/check-cache-version.js` · `--no-verify` 금지.
- 작업트리는 CRLF(`core.autocrlf=true`). 기존 파일 줄 끝을 바꾸지 않는다(Edit 도구는 그대로 둔다). 새 파일은 LF 로 써도 된다. PowerShell 5.1 의 `>` 는 UTF-16 으로 쓰므로 파일 만들기에 쓰지 않는다. 이 방의 Bash 는 따옴표를 씹는다 — `node -e` 대신 스크립트 파일(저장소 밖 `$env:TEMP`)로.
- 커밋 메시지는 한국어, 끝에 빈 줄 + `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. 커밋은 PowerShell here-string 으로.
- 실행: `node --test tests/<파일>.test.js`. 전체: `node --test "tests/**/*.test.js"`. 통과하는 검사 안의 `✖ 올리지 않았습니다 — 기준이 N일 된 것입니다` 는 날짜 잡음이다. `tests/tests-no-local-path.test.js`(드라이브 문자 금지)·`tests/test-pin-guard.test.js`(단언 줄에 `?v=숫자` 금지 — `\?v=\d+` 정규식으로)도 통과해야 한다.
- push·PR·규칙 게시 승인 요청은 컨트롤러가 한다.

## 실제 코드와 설계서가 다른 곳(이 계획이 따르는 쪽)

| 설계서 | 실제 코드 | 이 계획 |
|---|---|---|
| §2 읽는 곳 `pucards/mailbox/msgs/…` | 거울은 뿌리 `mailbox/msgs/{폴더 slug}/{uid}`(functions/mail-sync.js `ROOT='mailbox'`, 규칙 `rules.mailbox` 읽기 STAFF = `uid_roles` 사번·재직), 폴더 표 `mailbox/folders/{slug}` = `{path,name,kind,nomsg?}`, 주인은 등록부 `mail` | `mailbox/folders` 한 번 + 폴더마다 `mailbox/msgs/{slug}` `orderByKey().limitToLast(GR_MAIL.per)` |
| 지난 메일 거울 `…/old/msgs` 머리글도 후보 | `mailbox/old/msgs/{popKey}` 줄은 `a:0` 이고 `an` 이 없다(runBackfill) — 첨부 후보가 될 수 없다 | 읽지 않는다. 열쇠 `o:<popKey>` 는 풀기·열기만 지원(나중 대비) |
| 열쇠 `i:<slug>:<uid>:<part>`·`o:<popKey>:<index>` | 거울에 조각 번호·첨부 번호가 없다(`an` 은 이름 최대 5개, 60자) | `i:<slug>:<uid>` · `o:<popKey>` — 첨부는 `link.name` 으로 집는다(`readMailMessage` peek 의 `atts` 에서 같은 이름 → 그 `i`·`part` 로 받기). slug 가 길어 80자를 넘으면 열쇠를 안 만들고 「연결」을 잠근다 |
| `PuRulesMailOrig.fetchOriginal` 을 가져다 쓴다 | `fetchOriginal` 은 `doc.sha`(모을 때 지문)가 없으면 바로 실패하고, 안내 문구가 취업규칙용(「📥 에서 가린 파일…」) | `makeCall`·`b64ToBytes` 만 가져다 쓰고, 같은 순서(목록 peek → 같은 이름 받기)를 `PuGovReportInbox.fetchAtt(call 주입)` 로 둔다 |
| 「20MB 넘으면 확인창」 | 서버 `ATT_MAX = 20MB` 를 넘으면 무조건 413 | 확인창 대신 받지 않고 「20MB 가 넘어 앱에서 열 수 없습니다 — 메일함에서 받아 주세요」 |
| `addrsOf(co)`(업체관리 주소 + 이알피 연락처) | 이 앱은 업체관리(`data/companies`)를 읽지 않았다. `scal_cos` 에는 주소가 없다 | 칸 창을 처음 열 때 `data/companies`(규칙 LOGIN)를 함께 한 번 읽는다(못 읽으면 계약 연락처만). 이알피 계약(`consFor`)과 그 `company` 의 주소도 더한다. 등록부 `govreport.sharedRoots` 에 `mailbox`·`data/companies` |
| 한글 미리보기 «지연 불러오기 추가» | `js/pu-hwp-engine.js`·`js/pu-hwp-preview.js` 는 이미 `gov-report.html` 에 실려 있다(엔진 코어는 엔진이 지연) | 그대로 쓴다 |
| — | `readMailMessage`(peek)는 첨부 목록과 함께 본문도 돌려준다 | 본문은 받자마자 버린다(그리지도 담지도 않는다). 서버는 고치지 않는다 |

## 파일 구조

| 파일 | 할 일 |
|---|---|
| `js/pu-gov-report-inbox.js` (새) | 순수 함수: `windowOf` · `addrsFor` · `boxesOf` · `mailRows` · `candidates` · `badges` · `kindOf` · `imgType` · `linkKey.make/parse` · `linkFrom` · `errText` · `fetchAtt` + 상수 `MAX`·`KEY_MAX`·`ATT_MAX`·`BEFORE`·`AFTER`·`SHEET_ROWS`·`BOX_KINDS`·`PRIV_RE`·`MSG` |
| `tests/gov-report-inbox.test.js` (새) | 모듈 검사 |
| `js/pu-gov-report-track.js` (고침) | `link` 가지: `normLink` · `nextLink` · `normRec`·`validate`·`patchFor` · 상수 `LINK_SRC`·`LINK_KEY_MAX`·`LINK_NAME_MAX`·`LINK_BAD` |
| `tests/gov-report-track.test.js` (고침) | link 검사 다섯 |
| `tests/helpers/gov-report-fixture.js` (고침) | `seed().mailbox`(폴더 넷·메일 아홉) · `seed().data.companies`(업체관리 셋) |
| `scripts/make-firebase-rules.js` (고침) + `docs/firebase-rules-전체-적용본.json`·`docs/rules-paste.json` (다시 만듦) | `scal_docs` 줄의 `link` 규칙 |
| `tests/gov-report-rules.test.js` (고침) · `tests/photos-staff-share.test.js` (PENDING) | 규칙·한계 맞추기 검사 · 게시 대기 |
| `js/pu-ontology.js` (고침) + html 24개 `?v` | `govreport.sharedRoots` 에 `mailbox`·`data/companies` |
| `gov-report.html` (고침) | 싣기(T1) · 읽기·칸 창 후보·연결·열어 보기·보기 창(T3) |
| `tests/gov-report-app.test.js` (고침) | 싣기 차례(T1) · 등록부(T2) · 새 화면 검사 ㊲~㊽(T3) |
| `STATUS.md` (고침) · `status/2026-10-11-gov-report-inbox.md` (새) | 기록 + 「게시 승인 대기」 |

## 자료 꼴 (모든 작업 공통)

```js
/* 메일함 거울 (functions/mail-box.js msgRow — 짧은 칸) */
mailbox/folders/{slug} = { path, name, kind:'inbox'|'sent'|'archive'|'custom'|'drafts'|'trash'|'spam'|'tome'|'sched', nomsg?:1 }
mailbox/msgs/{slug}/{uid} = { u, f:보낸이 이름, e:보낸이 주소, t:'받는 주소,쉼표', tn:첫 받는이 이름, s:제목, d:epoch ms, a:첨부 수, an?:['첨부 이름'(≤5개)], … }
/* mailRows 뒤 — 평평한 줄 */
{ slug, uid:'101', out:boolean(보낸메일함), from:'소문자 주소', to:['소문자 주소'], who:'보낸이 또는 받는이', s, d, day:'YYYY-MM-DD'(KST), a, an:[] }
/* candidates(rows, { addrs, win, tech }) */
→ { list:[{ slug, uid, out, who, s, d, day, a, key:'i:<slug>:<uid>'|'', priv:boolean, tech:boolean, atts:[{ name, kind:'hwp'|'pdf'|'img'|'xls'|'' }] }], total, more, noAddr }
/* 서류 줄(DB) — 기존 칸 + link */
scal_docs/{co}/{rid}/items/{key} = { st, at, by?, sentAt?, gotAt?, how?, ack?, note?, link?:{ src:'mail', key:'i:INBOX-0a1b2c3d:101', name?:'서명본.hwpx', date?:'2026-09-25' } }
/* 열기 */
linkKey.parse('i:INBOX-0a1b2c3d:101') → { kind:'imap', slug:'INBOX-0a1b2c3d', uid:'101' } · linkKey.parse('o:AB12_x') → { kind:'pop', key:'AB12_x' }
fetchAtt({ call, ref, name }) → { name, b64 }   // call = PuRulesMailOrig.makeCall({ base, getToken, fetch })
```

합성 자료(오늘 2026-10-10) — `seed().mailbox` · `seed().data.companies`
- 업체관리: m1 (주)가나상사(사업자 000-00-00001 · `gana@example.com` · 담당 `gana.hong@example.com`) · m9 먼저상사(`shared@example.com`) · m2 다라정밀(대표담당 `dara@example.com` · 담당 줄 `shared@example.com`(먼저상사가 임자) · `office@pureun.kr`(우리 주소)).
- c2 다라정밀 t3(회차 08-10·09-14 → 기간 2026-07-11 ~ 2026-12-13) 후보 = 201 보낸(10-01, 보고서 초안.pdf·점검표.xlsx) · 107(09-29, 현장.jpg·압축.zip) · 102(09-26, 9월 급여대장.xlsx → 개인 자료) · 101(09-25, 서명본.hwpx·확인서.pdf). 빠지는 것: 103(첨부 0) · 104(06-01 기간 밖) · 105(shared@ — 먼저상사 것) · 301(스팸함).
- c1 가나상사 t1(기술보호, 06-02~08-04 → 2026-05-03 ~ 2026-11-02) 후보 = 106(07-20, 자문일지.pdf) + 「기술보호 자료」.
- c3 마바산업 — 업체관리·계약 어디에도 주소가 없다 → 「메일 주소가 등록돼 있지 않아 …」.

---

### Task 1: 순수 모듈 `js/pu-gov-report-inbox.js` + 기록 모듈의 `link` 가지 + 싣기

**Files:**
- Create: `js/pu-gov-report-inbox.js`
- Create: `tests/gov-report-inbox.test.js`
- Modify: `js/pu-gov-report-track.js` (머리 주석 · 상수 · `normLink`·`nextLink` · `normRec` · `validate` · `patchFor` · `api`)
- Modify: `tests/gov-report-track.test.js` (끝에 검사 다섯)
- Modify: `tests/helpers/gov-report-fixture.js` (머리 주석 · `data.companies` · `mailbox`)
- Modify: `gov-report.html` (스크립트 싣기 — `pu-gov-report-track.js?v=2 → 3` + 새 세 줄)
- Modify: `tests/gov-report-app.test.js` (싣기 차례 정적 검사 하나)

**Interfaces:**
- Consumes: `PuCoThread.addrsOf(co) → { 주소:1 }`·`norm(name)`·`mailOf(v)`(js/pu-co-thread.js, Node 에서는 `require` 하면 `globalThis.PuCoThread`) · `PuGovReportBuild.PRIV_RE`(js/pu-gov-report-build.js) · 서버 응답 꼴 `readMailMessage → { ok, atts:[{ i, part, name, mime, size }] }` · `readMailAttachment / readOldMail(index) → { ok, name, mime, b64 }`(functions/mail-sync.js)
- Produces (`window.PuGovReportInbox` / `module.exports`):
  - `windowOf(first:'YYYY-MM-DD', last:'YYYY-MM-DD') → { from, to } | null`
  - `addrsFor({ companies, cons, name, bizNo }) → { 주소:1 }`
  - `boxesOf(folders) → [slug]` · `mailRows(folders, msgsBySlug) → [줄]`
  - `candidates(rows, { addrs, win, tech }) → { list, total, more, noAddr }` · `badges(cand) → [{ txt, key }]`
  - `kindOf(name) → 'hwp'|'pdf'|'img'|'xls'|''` · `imgType(name) → 'image/…'|''`
  - `linkKey.make({ slug, uid } | { pop }) → 'i:…'|'o:…'|''` · `linkKey.parse(k) → { kind:'imap', slug, uid } | { kind:'pop', key } | null`
  - `linkFrom(cand, attName) → { src:'mail', key, name, date } | null`
  - `errText(e) → 문구` · `fetchAtt({ call, ref, name }) → Promise<{ name, b64 }>`(실패는 `e.status` 를 단 Error)
  - 상수 `MAX`(50) · `KEY_MAX`(80) · `ATT_MAX`(20MB) · `BEFORE`(30) · `AFTER`(90) · `SHEET_ROWS`(200) · `BOX_KINDS` · `PRIV_RE` · `MSG`
- Produces (`PuGovReportTrack` 추가): `normLink(l) → link|null` · `nextLink(prevRec, op) → link|null` · `LINK_SRC`('mail') · `LINK_KEY_MAX`(80) · `LINK_NAME_MAX`(100) · `LINK_BAD` · `normalize`/`put`/`patchFor` 가 `link` 를 싣는다 · `validate` 가 틀린 `link` 를 막는다

- [ ] **Step 1: 합성 자료 넓히기** — `tests/helpers/gov-report-fixture.js`

머리 주석 끝 줄 ` *   c1 가나상사 t1_2026 은 기록 없음(기한 09-30 지남) */` 을 다음으로 바꾼다.

```js
 *   c1 가나상사 t1_2026 은 기록 없음(기한 09-30 지남)
 * 받은 서류함(2026-10-11, 설계 2026-10-11-gov-report-inbox-design.md) — 업체관리 data/companies · 메일함 거울 mailbox
 *   m1 (주)가나상사(gana@·gana.hong@) · m9 먼저상사(shared@) · m2 다라정밀(dara@ · shared@ 는 먼저상사 것 · office@pureun.kr 은 우리 주소)
 *   다라정밀 후보 = 201 보낸(10-01) · 107(09-29) · 102(09-26 급여대장 → 개인 자료) · 101(09-25 서명본) — 103 첨부 0 · 104 기간 밖 · 105 남의 주소 · 301 스팸 */
```

`data: {` 안 `user_dir: […],` 줄 바로 다음에 더한다.

```js
      companies: { u: 1, v: [
        { id: 'm1', name: '(주)가나상사', bizNo: '000-00-00001', email: 'gana@example.com', contacts: [{ name: '홍길동', email: 'gana.hong@example.com' }] },
        { id: 'm9', name: '먼저상사', email: 'shared@example.com' },
        { id: 'm2', name: '다라정밀', primaryContactEmail: 'dara@example.com',
          contacts: [{ name: '김가나', email: 'shared@example.com' }, { name: '우리 담당', email: 'office@pureun.kr' }] },
      ] },
```

`scal_docs: { … },` 덩어리(맨 끝 `},` 뒤, `};` 앞)에 이어서 더한다.

```js
    mailbox: {
      folders: {
        'INBOX-0a1b2c3d': { path: 'INBOX', name: '받은메일함', kind: 'inbox' },
        'Sent-1b2c3d4e': { path: 'Sent', name: '보낸메일함', kind: 'sent' },
        'Spam-2c3d4e5f': { path: 'Spam', name: '스팸편지함', kind: 'spam' },
        'Trash-3d4e5f6a': { path: 'Trash', name: '휴지통', kind: 'trash', nomsg: 1 },
      },
      msgs: {
        'INBOX-0a1b2c3d': {
          101: { u: 101, f: '다라정밀 담당', e: 'dara@example.com', t: 'office@pureun.kr', s: '서명본 보내드립니다', d: Date.UTC(2026, 8, 25, 1), a: 2, an: ['서명본.hwpx', '확인서.pdf'] },
          102: { u: 102, f: '다라정밀 담당', e: 'DARA@example.com', t: 'office@pureun.kr', s: '자료 보냅니다', d: Date.UTC(2026, 8, 26, 1), a: 1, an: ['9월 급여대장.xlsx'] },
          103: { u: 103, f: '다라정밀 담당', e: 'dara@example.com', t: 'office@pureun.kr', s: '첨부 없음', d: Date.UTC(2026, 8, 27, 1), a: 0 },
          104: { u: 104, f: '다라정밀 담당', e: 'dara@example.com', t: 'office@pureun.kr', s: '기간 밖', d: Date.UTC(2026, 5, 1, 1), a: 1, an: ['옛것.pdf'] },
          105: { u: 105, f: '먼저상사', e: 'shared@example.com', t: 'office@pureun.kr', s: '다른 업체 주소', d: Date.UTC(2026, 8, 28, 1), a: 1, an: ['남의것.pdf'] },
          106: { u: 106, f: '가나상사 홍길동', e: 'gana.hong@example.com', t: 'office@pureun.kr', s: '자문 일지 회신', d: Date.UTC(2026, 6, 20, 1), a: 1, an: ['자문일지.pdf'] },
          107: { u: 107, f: '다라정밀 담당', e: 'dara@example.com', t: 'office@pureun.kr', s: '현장 사진', d: Date.UTC(2026, 8, 29, 1), a: 2, an: ['현장.jpg', '압축.zip'] },
        },
        'Sent-1b2c3d4e': {
          201: { u: 201, f: '푸른노무법인', e: 'office@pureun.kr', t: 'x@example.org,dara@example.com', tn: '외부', s: '보고서 초안 보내드립니다', d: Date.UTC(2026, 9, 1, 1), a: 2, an: ['보고서 초안.pdf', '점검표.xlsx'] },
        },
        'Spam-2c3d4e5f': {
          301: { u: 301, f: '스팸', e: 'dara@example.com', t: 'office@pureun.kr', s: '스팸', d: Date.UTC(2026, 8, 30, 1), a: 1, an: ['스팸.pdf'] },
        },
      },
    },
```

(`102` 의 제목은 개인 자료 식에 안 걸리게 「자료 보냅니다」 — 첨부 이름 「9월 급여대장.xlsx」 로만 걸리는지 본다.)

- [ ] **Step 2: 실패하는 모듈 검사** — `tests/gov-report-inbox.test.js` (새)

```js
'use strict';
/* 컨설팅보고서 앱 — 받은 서류함 순수 함수 (2026-10-11, 설계 2026-10-11-gov-report-inbox-design.md)
 * ★ 지키는 것: 주소로만 업체 귀속(먼저 적힌 업체가 임자 · 우리 주소 뺌) · 첨부 있는 메일·기간 안·날짜 내림차순·50건 ·
 *   개인 자료 딱지(PRIV_RE 그대로) · 연결 열쇠 만들기/풀기(80자) · 첨부는 이름으로 집고 20MB 넘으면 받지 않는다
 * 공개 저장소다 — 합성 자료만. */
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../js/pu-gov-report-inbox.js');
const B = require('../js/pu-gov-report-build.js');
const Tr = require('../js/pu-gov-report-track.js');
const F = require('./helpers/gov-report-fixture.js');

const S = F.seed();
const ROWS = I.mailRows(S.mailbox.folders, S.mailbox.msgs);
const DARA = I.addrsFor({ companies: S.data.companies, cons: S.data.consultings.v.k2, name: '다라정밀' });
const WIN = I.windowOf('2026-08-10', '2026-09-14');

test('상수 — 50건 · 열쇠 80자(기록 모듈과 같다) · 20MB · 기간 −30/+90일 · 개인 자료 식은 보고서 모듈 것 그대로 · 문구', () => {
  assert.equal(I.MAX, 50);
  assert.equal(I.KEY_MAX, 80);
  assert.equal(I.KEY_MAX, Tr.LINK_KEY_MAX, '열쇠 한도는 규칙·기록 모듈과 같다');
  assert.equal(I.ATT_MAX, 20 * 1024 * 1024);
  assert.deepEqual([I.BEFORE, I.AFTER, I.SHEET_ROWS], [30, 90, 200]);
  assert.equal(I.PRIV_RE, B.PRIV_RE, 'PRIV_RE 를 복제하지 말고 가져다 쓴다');
  assert.deepEqual(I.BOX_KINDS, ['inbox', 'sent', 'archive', 'custom']);
  assert.equal(I.MSG.NO_ADDR, '메일 주소가 등록돼 있지 않아 후보를 못 찾았습니다 — 업체관리에서 주소를 넣어 주세요');
  assert.equal(I.MSG.LOAD_FAIL, '메일함을 불러오지 못했습니다');
  assert.equal(I.MSG.MORE, '50건만 보입니다');
  assert.equal(I.MSG.PRIV, '개인 자료 · 목록에만');
  assert.equal(I.MSG.TECH, '기술보호 자료');
  assert.equal(I.MSG.CANT, '이 형식은 앱에서 열 수 없습니다 — 메일함에서 받아 주세요');
  assert.equal(I.MSG.NO_REPLY, '메일 서버 응답이 없습니다 — 잠시 뒤 다시');
  assert.equal(I.MSG.LOGIN, '로그인을 확인해 주세요');
  assert.equal(I.MSG.GONE, '메일에서 그 첨부를 찾지 못했습니다(지워졌을 수 있습니다)');
  assert.equal(I.MSG.TOO_BIG, '20MB 가 넘어 앱에서 열 수 없습니다 — 메일함에서 받아 주세요');
  assert.equal(I.MSG.WAIT_OLD, '불러오는 중… (지난 메일은 1분쯤 걸립니다)');
});

test('windowOf — 첫 회차 30일 전 ~ 마지막 회차 90일 뒤 (보고서 창 grpCollect 와 같다)', () => {
  assert.deepEqual(WIN, { from: '2026-07-11', to: '2026-12-13' });
  assert.deepEqual(I.windowOf('2026-01-15', ''), { from: '2025-12-16', to: '2026-04-15' }, '마지막이 없으면 첫 회차 기준');
  assert.equal(I.windowOf('', ''), null);
  assert.equal(I.windowOf('2026/01/15', '2026-02-01'), null);
});

test('addrsFor — 업체관리 세 칸 + 이알피 계약 연락처 · 먼저 적힌 업체가 임자 · 우리 주소 뺌', () => {
  assert.deepEqual(Object.keys(DARA).sort(), ['dara@example.com'], 'shared@ 는 먼저상사 것 · office@pureun.kr 은 우리 주소');
  const gana = I.addrsFor({ companies: S.data.companies, cons: S.data.consultings.v.k1, name: '가나상사' });
  assert.deepEqual(Object.keys(gana).sort(), ['gana.hong@example.com', 'gana@example.com'], '사업자번호로 업체관리 줄을 찾는다');
  const withErp = I.addrsFor({ companies: S.data.companies, name: '다라정밀',
    cons: { companyName: '다라정밀', contacts: [{ name: '김가나', email: 'dara.kim@example.com' }], company: { email: 'Dara.Office@Example.com' } } });
  assert.deepEqual(Object.keys(withErp).sort(), ['dara.kim@example.com', 'dara.office@example.com', 'dara@example.com']);
  assert.deepEqual(I.addrsFor({ companies: S.data.companies, cons: null, name: '마바산업' }), {}, '주소가 없는 업체');
  assert.deepEqual(Object.keys(I.addrsFor({ companies: null, cons: { contacts: [{ email: 'only@example.com' }] }, name: 'x' })), ['only@example.com'],
    '업체관리를 못 읽어도 계약 연락처로');
  assert.deepEqual(I.addrsFor({ companies: S.data.companies, cons: { contacts: [{ email: 'shared@example.com' }] }, name: '없는업체' }), {},
    '업체관리에서 다른 업체가 먼저 적은 주소는 뺀다');
  assert.deepEqual(I.addrsFor(null), {});
});

test('boxesOf · mailRows — 받은·보낸·보관·손 폴더만(스팸·휴지통 뺌) · 짧은 칸을 풀어 둔다 · 보낸 메일은 받는 주소 전부', () => {
  assert.deepEqual(I.boxesOf(S.mailbox.folders), ['INBOX-0a1b2c3d', 'Sent-1b2c3d4e']);
  assert.equal(ROWS.length, 8);
  const s = ROWS.filter((r) => r.uid === '201')[0];
  assert.deepEqual([s.out, s.from, s.to, s.who, s.day, s.a], [true, 'office@pureun.kr', ['x@example.org', 'dara@example.com'], '외부', '2026-10-01', 2]);
  const r = ROWS.filter((x) => x.uid === '101')[0];
  assert.deepEqual([r.slug, r.out, r.from, r.who, r.s, r.day, r.an],
    ['INBOX-0a1b2c3d', false, 'dara@example.com', '다라정밀 담당', '서명본 보내드립니다', '2026-09-25', ['서명본.hwpx', '확인서.pdf']]);
  assert.deepEqual(I.mailRows(null, null), []);
  assert.deepEqual(I.mailRows(JSON.parse('{"__proto__":{"kind":"inbox"}}'), JSON.parse('{"__proto__":{"1":{"d":1,"a":1}}}')), []);
  assert.deepEqual(I.mailRows({ X: { kind: 'inbox' } }, { X: { abc: { d: 1, a: 1 }, 12: 'x' } }), [], '열쇠가 숫자가 아니거나 줄이 아니면 버린다');
});

test('candidates — 주소 일치 · 첨부 있음 · 기간 안 · 날짜 내림차순 · 개인 자료 딱지 · 기술보호 딱지', () => {
  const r = I.candidates(ROWS, { addrs: DARA, win: WIN });
  assert.deepEqual(r.list.map((m) => m.uid), ['201', '107', '102', '101']);
  assert.deepEqual([r.total, r.more, r.noAddr], [4, false, false]);
  const m = r.list[3];
  assert.equal(m.key, 'i:INBOX-0a1b2c3d:101');
  assert.deepEqual(m.atts, [{ name: '서명본.hwpx', kind: 'hwp' }, { name: '확인서.pdf', kind: 'pdf' }]);
  assert.equal(m.priv, false);
  assert.equal(r.list[2].priv, true, '첨부 이름 「9월 급여대장.xlsx」');
  assert.deepEqual(I.badges(r.list[2]), [{ txt: '개인 자료 · 목록에만', key: 'todo' }]);
  assert.deepEqual(I.badges(r.list[3]), []);
  assert.equal(r.list[0].out, true);
  const t = I.candidates(ROWS, { addrs: DARA, win: WIN, tech: true });
  assert.deepEqual(I.badges(t.list[2]), [{ txt: '개인 자료 · 목록에만', key: 'todo' }, { txt: '기술보호 자료', key: 'draft' }]);
  const subj = I.candidates([{ slug: 'B', uid: '1', out: false, from: 'dara@example.com', to: [], who: '', s: '4대보험 명부', d: 1,
    day: '2026-09-01', a: 1, an: ['a.pdf'] }], { addrs: DARA, win: WIN });
  assert.equal(subj.list[0].priv, true, '제목으로도 가린다');
  assert.deepEqual(I.candidates(ROWS, { addrs: {}, win: WIN }), { list: [], total: 0, more: false, noAddr: true });
  assert.equal(I.candidates(ROWS, { addrs: DARA }).list.length, 5, '기간을 안 주면 기간으로 거르지 않는다(104 옛것 포함)');
});

test('candidates — 50건까지 · 넘으면 more · 늦은 것이 위', () => {
  const many = [];
  for (let i = 1; i <= 55; i++) many.push({ slug: 'B', uid: String(i), out: false, from: 'dara@example.com', to: [], who: '', s: '서류 ' + i,
    d: Date.UTC(2026, 8, 1) + i * 60000, day: '2026-09-01', a: 1, an: ['a' + i + '.pdf'] });
  const r = I.candidates(many, { addrs: DARA, win: WIN });
  assert.deepEqual([r.list.length, r.total, r.more], [50, 55, true]);
  assert.equal(r.list[0].uid, '55');
});

test('kindOf · imgType — 확장자로 우리가 정한다(메일이 적어 보낸 종류는 안 믿는다)', () => {
  assert.equal(I.kindOf('서명본.HWPX'), 'hwp');
  assert.equal(I.kindOf('a.hwp'), 'hwp');
  assert.equal(I.kindOf('a.pdf'), 'pdf');
  assert.equal(I.kindOf('사진.JPG'), 'img');
  assert.equal(I.kindOf('표.xlsx'), 'xls');
  assert.equal(I.kindOf('표.xls'), 'xls');
  assert.equal(I.kindOf('압축.zip'), '');
  assert.equal(I.kindOf('이름만.pdf.exe'), '');
  assert.equal(I.kindOf(''), '');
  assert.equal(I.imgType('a.jpg'), 'image/jpeg');
  assert.equal(I.imgType('a.png'), 'image/png');
  assert.equal(I.imgType('a.pdf'), '');
});

test('linkKey — 만들기·풀기 · 80자 · 경로 글자·프로토타입 이름 거절', () => {
  const k = I.linkKey.make({ slug: 'INBOX-0a1b2c3d', uid: '101' });
  assert.equal(k, 'i:INBOX-0a1b2c3d:101');
  assert.deepEqual(I.linkKey.parse(k), { kind: 'imap', slug: 'INBOX-0a1b2c3d', uid: '101' });
  assert.deepEqual(I.linkKey.parse('i:INBOX_1_자문사답변-abcd1234:7'), { kind: 'imap', slug: 'INBOX_1_자문사답변-abcd1234', uid: '7' });
  assert.equal(I.linkKey.make({ pop: 'AB12_x' }), 'o:AB12_x');
  assert.deepEqual(I.linkKey.parse('o:AB12_x'), { kind: 'pop', key: 'AB12_x' });
  assert.equal(I.linkKey.make({ slug: 'a'.repeat(80), uid: '1' }), '', '80자가 넘으면 만들지 않는다');
  assert.equal(I.linkKey.make({ slug: 'a/b', uid: '1' }), '');
  assert.equal(I.linkKey.make({ slug: '__proto__', uid: '1' }), '');
  assert.equal(I.linkKey.make({ slug: 'X', uid: '1a' }), '');
  assert.equal(I.linkKey.make({ pop: 'a b' }), '');
  assert.equal(I.linkKey.make(null), '');
  ['', 'x', 'i:', 'i:X:', 'i:X:abc', 'i:a/b:1', 'i:__proto__:1', 'o:', 'o:a b', 'q:X:1', 'i:' + 'a'.repeat(80) + ':1', null, 7]
    .forEach((bad) => assert.equal(I.linkKey.parse(bad), null, String(bad)));
});

test('linkFrom — 연결 꼴(src·key·name·date) · 열쇠를 못 만들었거나 이름이 없으면 null · 이름 100자', () => {
  const r = I.candidates(ROWS, { addrs: DARA, win: WIN });
  assert.deepEqual(I.linkFrom(r.list[3], '서명본.hwpx'), { src: 'mail', key: 'i:INBOX-0a1b2c3d:101', name: '서명본.hwpx', date: '2026-09-25' });
  assert.equal(I.linkFrom(r.list[3], ''), null);
  assert.equal(I.linkFrom({ key: '', day: '2026-09-25' }, 'a.pdf'), null);
  assert.equal(I.linkFrom(r.list[3], '가'.repeat(150)).name.length, 100);
  assert.deepEqual(Tr.normLink(I.linkFrom(r.list[3], '서명본.hwpx')), I.linkFrom(r.list[3], '서명본.hwpx'), '기록 모듈이 그대로 받는다');
});

test('errText — 시간 초과·끊김 / 로그인 / 없음 / 너무 큼 / 그 밖', () => {
  const e = (status, name, message) => Object.assign(new Error(message || ''), { status, name: name || 'Error' });
  assert.equal(I.errText(e(0, 'TimeoutError')), I.MSG.NO_REPLY);
  assert.equal(I.errText(new TypeError('Failed to fetch')), I.MSG.NO_REPLY);
  assert.equal(I.errText(e(504)), I.MSG.NO_REPLY);
  assert.equal(I.errText(e(401)), I.MSG.LOGIN);
  assert.equal(I.errText(e(403)), I.MSG.LOGIN);
  assert.equal(I.errText(e(404)), I.MSG.GONE);
  assert.equal(I.errText(e(413)), I.MSG.TOO_BIG);
  assert.equal(I.errText(e(500, '', '메일 계정이 설정되지 않았습니다.')), '열지 못했습니다 — 메일 계정이 설정되지 않았습니다.');
  assert.equal(I.errText(null), '열지 못했습니다 — 알 수 없는 오류');
});

/* 가짜 서버 부르기 — 화면이 makeCall 로 만드는 call(fn, body) 와 같은 꼴 */
function fakeCall(atts, o) {
  o = o || {};
  const calls = [];
  const call = async (fn, body) => {
    calls.push([fn, body]);
    if (o.fail) throw Object.assign(new Error('거절'), { status: o.fail });
    if (fn === 'readMailMessage' || (fn === 'readOldMail' && body.index == null)) return { ok: true, html: '<p>본문</p>', text: '본문', atts };
    const a = atts.filter((x) => x.i === body.index)[0];
    if (!a) throw Object.assign(new Error('그 첨부가 없습니다'), { status: 404 });
    return { ok: true, name: a.name, mime: 'text/html', b64: o.noB64 ? '' : 'UEsDBA==' };
  };
  return { call, calls };
}

test('fetchAtt — 일반 폴더: 첨부 목록(peek, 읽음 표시 안 함) → 같은 이름 하나를 조각 이름으로 받는다', async () => {
  const f = fakeCall([{ i: 0, part: '2', name: '확인서.pdf', size: 10 }, { i: 1, part: '3', name: '서명본.hwpx', size: 10 }]);
  const got = await I.fetchAtt({ call: f.call, ref: { kind: 'imap', slug: 'INBOX-0a1b2c3d', uid: '101' }, name: '서명본.hwpx' });
  assert.deepEqual(got, { name: '서명본.hwpx', b64: 'UEsDBA==' });
  assert.deepEqual(f.calls, [['readMailMessage', { slug: 'INBOX-0a1b2c3d', uid: '101', peek: true }],
    ['readMailAttachment', { slug: 'INBOX-0a1b2c3d', uid: '101', index: 1, part: '3' }]]);
});

test('fetchAtt — 지난 메일: readOldMail 두 번(목록 → 번호)', async () => {
  const f = fakeCall([{ i: 0, part: '', name: '자료.pdf', size: 10 }]);
  const got = await I.fetchAtt({ call: f.call, ref: { kind: 'pop', key: 'AB12_x' }, name: '자료.pdf' });
  assert.equal(got.b64, 'UEsDBA==');
  assert.deepEqual(f.calls, [['readOldMail', { key: 'AB12_x' }], ['readOldMail', { key: 'AB12_x', index: 0 }]]);
});

test('fetchAtt — 이름이 없으면 404(받기는 안 부름) · 20MB 넘으면 413(받지 않는다) · 서버 거절은 그 상태 · 빈 바이트는 404', async () => {
  const ref = { kind: 'imap', slug: 'X', uid: '1' };
  const f = fakeCall([{ i: 0, part: '2', name: '다른.pdf', size: 10 }]);
  await assert.rejects(I.fetchAtt({ call: f.call, ref, name: '서명본.hwpx' }), (e) => e.status === 404);
  assert.equal(f.calls.length, 1, '첨부 받기는 부르지 않는다');
  const big = fakeCall([{ i: 0, part: '2', name: '큰.pdf', size: 21 * 1024 * 1024 }]);
  await assert.rejects(I.fetchAtt({ call: big.call, ref, name: '큰.pdf' }), (e) => e.status === 413);
  assert.equal(big.calls.length, 1);
  const no = fakeCall([], { fail: 401 });
  await assert.rejects(I.fetchAtt({ call: no.call, ref, name: 'a.pdf' }), (e) => e.status === 401);
  await assert.rejects(I.fetchAtt({ call: f.call, ref: null, name: 'a.pdf' }), (e) => e.status === 404);
  const empty = fakeCall([{ i: 0, part: '2', name: 'a.pdf', size: 1 }], { noB64: true });
  await assert.rejects(I.fetchAtt({ call: empty.call, ref, name: 'a.pdf' }), (e) => e.status === 404);
});
```

- [ ] **Step 3: 실패 확인**

Run: `node --test tests/gov-report-inbox.test.js`
Expected: FAIL — `Cannot find module '../js/pu-gov-report-inbox.js'`

- [ ] **Step 4: 구현** — `js/pu-gov-report-inbox.js` (새)

```js
'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 받은 서류함: 메일 첨부 후보 · 서류 줄 연결 열쇠 · 첨부 받기 순서
   (브라우저 window.PuGovReportInbox / Node 겸용 · 대표 지시 2026-10-11 「남은 일 순서대로 진행」
    · 설계 docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md · 계획 docs/superpowers/plans/2026-10-11-gov-report-inbox.md)
   무엇을 지키나
     · 읽기만 — 메일함 거울(mailbox/msgs/{폴더}/{uid}, functions/mail-box.js msgRow 의 짧은 칸 f·e·t·tn·s·d·a·an)의 머리글만 본다.
       본문·첨부 바이트는 후보 단계에서 읽지 않는다. 지난 메일 거울(mailbox/old/msgs)은 첨부 정보(a·an)가 없어 후보가 될 수 없다.
     · 업체 귀속은 «주소»로만 — PuCoThread.addrsOf(업체관리 email·primaryContactEmail·contacts[].email)와 이알피 계약 연락처.
       한 주소가 여러 업체에 적혀 있으면 업체관리에 먼저 적힌 쪽 것(functions/mail-owner.js 와 같은 규칙). 우리 주소(@pureun.kr)는 안 본다.
     · 개인 자료(PuGovReportBuild.PRIV_RE — 복제하지 않고 가져다 쓴다)는 목록에만: 딱지를 달고 연결·열어 보기를 막는다(화면 몫).
     · 연결 열쇠: 일반 폴더 'i:<폴더 slug>:<uid>' · 지난 메일 'o:<popKey>' — 80자 이내(규칙·기록 모듈 LINK_KEY_MAX 와 같다).
       거울에 조각 번호가 없어 첨부는 «이름»으로 집는다(fetchAtt: 목록 peek → 같은 이름의 i·part 로 받기).
     · 첨부 받기는 «부르는 함수(call)»를 받아서만 한다 — 화면이 js/rules-v2/mail-orig.js 의 makeCall 로 만든다.
       받은 것(b64)은 돌려주기만 하고 어디에도 담지 않는다. 20MB(서버 ATT_MAX) 넘으면 받지 않는다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var Build = isNode ? require('./pu-gov-report-build.js') : root.PuGovReportBuild;
  if (isNode && !root.PuCoThread) require('./pu-co-thread.js');
  function CT() { return root.PuCoThread; }

  var MAX = 50, KEY_MAX = 80, ATT_MAX = 20 * 1024 * 1024, BEFORE = 30, AFTER = 90, SHEET_ROWS = 200;
  /* 받은·보낸·보관·손으로 만든 폴더만 — 임시·예약·내게쓴·스팸·휴지통은 서류가 오간 자리가 아니다 */
  var BOX_KINDS = ['inbox', 'sent', 'archive', 'custom'];
  var PRIV_RE = Build.PRIV_RE;
  var OWN_RE = /@pureun\.kr$/i;
  var IMG = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  var MSG = {
    NAME_NOTE: '첨부 파일 이름에 사람 이름이 들어 있을 수 있습니다 — 연결하면 그 이름이 기록에 남습니다',
    NO_ADDR: '메일 주소가 등록돼 있지 않아 후보를 못 찾았습니다 — 업체관리에서 주소를 넣어 주세요',
    NONE: '이 기간에 이 업체 주소로 오간 첨부 메일이 없습니다',
    LOAD_FAIL: '메일함을 불러오지 못했습니다',
    MORE: '50건만 보입니다',
    CLIPPED: '메일함 폴더마다 최근 메일만 봅니다 — 오래된 메일은 메일함에서 찾아 주세요',
    PRIV: '개인 자료 · 목록에만',
    TECH: '기술보호 자료',
    WAIT: '불러오는 중…',
    WAIT_OLD: '불러오는 중… (지난 메일은 1분쯤 걸립니다)',
    CANT: '이 형식은 앱에서 열 수 없습니다 — 메일함에서 받아 주세요',
    NO_REPLY: '메일 서버 응답이 없습니다 — 잠시 뒤 다시',
    LOGIN: '로그인을 확인해 주세요',
    GONE: '메일에서 그 첨부를 찾지 못했습니다(지워졌을 수 있습니다)',
    TOO_BIG: '20MB 가 넘어 앱에서 열 수 없습니다 — 메일함에서 받아 주세요',
    FAIL: '열지 못했습니다 — '
  };

  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function okId(k) { return typeof k === 'string' && !!k && k !== '__proto__' && k !== 'constructor' && k !== 'prototype'; }
  function digits(v) { return str(v).replace(/\D/g, ''); }
  /* 이알피 표({u,v:[…]})·배열·객체 모두 줄 목록으로 (functions/mail-owner.js arr 와 같은 꼴) */
  function rowsOf(v) {
    var x = obj(v) && v.v !== undefined ? v.v : v;
    if (Array.isArray(x)) return x.filter(obj);
    if (obj(x)) return Object.keys(x).map(function (k) { return x[k]; }).filter(obj);
    return [];
  }
  function dayOf(ms) { var n = Number(ms); return (isFinite(n) && n > 0) ? new Date(n + 9 * 3600e3).toISOString().slice(0, 10) : ''; }
  function shift(day, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(day));
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)).toISOString().slice(0, 10) : '';
  }
  function windowOf(first, last) {
    var a = shift(first, -BEFORE), b = shift(str(last) || first, AFTER);
    return (a && b) ? { from: a, to: b } : null;
  }

  /* ── 업체 주소 ── 주소 → 업체관리에 «먼저» 적은 업체의 자리 */
  function ownerIndex(list) {
    var ix = {};
    list.forEach(function (c, i) { Object.keys(CT().addrsOf(c)).forEach(function (e) { if (!has(ix, e)) ix[e] = i; }); });
    return ix;
  }
  function coIndexFor(list, bizNo, name) {
    var b = digits(bizNo), n = CT().norm(name), i;
    if (b.length >= 10) for (i = 0; i < list.length; i++) if (digits(list[i].bizNo) === b) return i;
    if (n) for (i = 0; i < list.length; i++) if (CT().norm(list[i].name) === n) return i;
    return -1;
  }
  function addrsFor(o) {
    o = o || {};
    var list = rowsOf(o.companies), cons = obj(o.cons) ? o.cons : null;
    var cc = (cons && obj(cons.company)) ? cons.company : {};
    var at = coIndexFor(list, str(cc.bizNo) || str(cons && cons.bizNo) || str(o.bizNo),
      str(cc.name) || str(cons && cons.companyName) || str(o.name));
    var owner = ownerIndex(list), out = {};
    function add(src) {
      Object.keys(CT().addrsOf(src)).forEach(function (e) {
        if (OWN_RE.test(e)) return;                       // 우리 주소
        if (has(owner, e) && owner[e] !== at) return;      // 업체관리에 다른 업체가 먼저 적은 주소
        out[e] = 1;
      });
    }
    if (at >= 0) add(list[at]);
    if (cons) { add(cons); add(cc); }
    return out;
  }

  /* ── 거울 → 평평한 줄 ── */
  function boxesOf(folders) {
    if (!obj(folders)) return [];
    return Object.keys(folders).filter(function (slug) {
      var f = folders[slug];
      return okId(slug) && obj(f) && !f.nomsg && BOX_KINDS.indexOf(f.kind) >= 0;
    });
  }
  function mailRows(folders, msgs) {
    var out = [];
    if (!obj(msgs)) return out;
    boxesOf(folders).forEach(function (slug) {
      var box = has(msgs, slug) ? msgs[slug] : null, sent = folders[slug].kind === 'sent';
      if (!obj(box)) return;
      Object.keys(box).forEach(function (k) {
        var r = box[k];
        if (!obj(r) || !/^[0-9]{1,12}$/.test(k)) return;
        out.push({ slug: slug, uid: k, out: sent, from: CT().mailOf(r.e),
          to: str(r.t).split(',').map(function (x) { return CT().mailOf(x); }).filter(Boolean),
          who: sent ? (str(r.tn) || str(r.t)) : (str(r.f) || str(r.e)), s: str(r.s), d: Number(r.d) || 0, day: dayOf(r.d),
          a: Number(r.a) || 0, an: Array.isArray(r.an) ? r.an.map(str).filter(Boolean).slice(0, 5) : [] });
      });
    });
    return out;
  }

  function kindOf(name) {
    var m = /\.([a-z0-9]+)$/.exec(str(name).toLowerCase()), e = m ? m[1] : '';
    if (e === 'hwp' || e === 'hwpx') return 'hwp';
    if (e === 'pdf') return 'pdf';
    if (has(IMG, e)) return 'img';
    if (e === 'xlsx' || e === 'xls') return 'xls';
    return '';
  }
  function imgType(name) { var m = /\.([a-z0-9]+)$/.exec(str(name).toLowerCase()); return (m && has(IMG, m[1])) ? IMG[m[1]] : ''; }
  function privOf(m) { return PRIV_RE.test(m.s) || m.an.some(function (n) { return PRIV_RE.test(n); }); }

  /* ── 연결 열쇠 ── */
  var POP_RE = /^[A-Za-z0-9_+=@:~-]{1,120}$/;   // 서버 readOldMail 이 받는 열쇠 꼴
  function okSlug(s) { return okId(s) && !/[\/.#$\[\]]/.test(s); }
  var linkKey = {
    make: function (p) {
      p = p || {};
      var k = '';
      if (p.pop != null) { if (POP_RE.test(str(p.pop))) k = 'o:' + str(p.pop); }
      else if (okSlug(str(p.slug)) && /^[0-9]{1,12}$/.test(str(p.uid))) k = 'i:' + str(p.slug) + ':' + str(p.uid);
      return k.length <= KEY_MAX ? k : '';
    },
    parse: function (k) {
      if (typeof k !== 'string' || !k || k.length > KEY_MAX) return null;
      var m = /^i:(.+):([0-9]{1,12})$/.exec(k);
      if (m) return okSlug(m[1]) ? { kind: 'imap', slug: m[1], uid: m[2] } : null;
      m = /^o:(.+)$/.exec(k);
      return (m && POP_RE.test(m[1])) ? { kind: 'pop', key: m[1] } : null;
    }
  };

  function candidates(rows, o) {
    o = o || {};
    var addrs = obj(o.addrs) ? o.addrs : {}, win = o.win, out = [];
    if (!Object.keys(addrs).length) return { list: [], total: 0, more: false, noAddr: true };
    (rows || []).forEach(function (m) {
      if (!m || !(m.a > 0) || !m.day) return;
      if (win && (m.day < win.from || m.day > win.to)) return;
      var hit = m.out ? m.to.some(function (e) { return has(addrs, e); }) : has(addrs, m.from);
      if (!hit) return;
      out.push({ slug: m.slug, uid: m.uid, out: m.out, who: m.who, s: m.s, d: m.d, day: m.day, a: m.a,
        key: linkKey.make({ slug: m.slug, uid: m.uid }), priv: privOf(m), tech: !!o.tech,
        atts: m.an.map(function (n) { return { name: n, kind: kindOf(n) }; }) });
    });
    out.sort(function (a, b) { return (b.d - a.d) || (a.key < b.key ? -1 : (a.key > b.key ? 1 : 0)); });
    return { list: out.slice(0, MAX), total: out.length, more: out.length > MAX, noAddr: false };
  }
  /* 화면 딱지(.st-*) — 개인 자료 빨강 · 기술보호 노랑 */
  function badges(c) {
    var b = [];
    if (c && c.priv) b.push({ txt: MSG.PRIV, key: 'todo' });
    if (c && c.tech) b.push({ txt: MSG.TECH, key: 'draft' });
    return b;
  }
  function linkFrom(c, name) {
    var nm = str(name);
    if (!c || !c.key || !nm) return null;
    var o = { src: 'mail', key: c.key, name: nm.slice(0, 100) };
    if (/^\d{4}-\d{2}-\d{2}$/.test(str(c.day))) o.date = c.day;
    return o;
  }

  /* ── 열기 ── */
  function fail(status, msg) { var e = new Error(msg || ''); e.status = status; return e; }
  function errText(e) {
    var st = Number(e && e.status) || 0, nm = str(e && e.name), msg = str(e && e.message);
    if (nm === 'TimeoutError' || st === 408 || st === 503 || st === 504 || /Failed to fetch|NetworkError|network/i.test(msg)) return MSG.NO_REPLY;
    if (st === 401 || st === 403) return MSG.LOGIN;
    if (st === 404) return MSG.GONE;
    if (st === 413) return MSG.TOO_BIG;
    return MSG.FAIL + (msg || '알 수 없는 오류');
  }
  /* 첨부 하나 — 목록(peek: 읽음 표시를 건드리지 않는다)에서 같은 이름을 찾아 그 번호·조각 이름으로 받는다.
     ⚠ readMailMessage 는 본문도 함께 돌려준다 — 여기서 버린다(돌려주지 않는다). */
  async function fetchAtt(o) {
    o = o || {};
    var ref = o.ref, call = o.call, name = str(o.name);
    if (!ref || !name || typeof call !== 'function') throw fail(404, '그 첨부가 없습니다');
    var imap = ref.kind === 'imap';
    var head = imap ? await call('readMailMessage', { slug: ref.slug, uid: ref.uid, peek: true })
                    : await call('readOldMail', { key: ref.key });
    var atts = (head && Array.isArray(head.atts)) ? head.atts : [], a = null, idx = -1;
    for (var i = 0; i < atts.length; i++) {
      if (atts[i] && atts[i].name === name) { a = atts[i]; idx = a.i == null ? i : a.i; break; }
    }
    if (!a) throw fail(404, '그 첨부가 없습니다');
    if (Number(a.size || 0) > ATT_MAX) throw fail(413, '너무 큽니다');
    var got = imap ? await call('readMailAttachment', { slug: ref.slug, uid: ref.uid, index: idx, part: String(a.part || '') })
                   : await call('readOldMail', { key: ref.key, index: idx });
    if (!got || !got.b64) throw fail(404, '그 첨부가 없습니다');
    return { name: name, b64: got.b64 };
  }

  var api = { windowOf: windowOf, addrsFor: addrsFor, boxesOf: boxesOf, mailRows: mailRows, candidates: candidates, badges: badges,
    kindOf: kindOf, imgType: imgType, linkKey: linkKey, linkFrom: linkFrom, errText: errText, fetchAtt: fetchAtt,
    MAX: MAX, KEY_MAX: KEY_MAX, ATT_MAX: ATT_MAX, BEFORE: BEFORE, AFTER: AFTER, SHEET_ROWS: SHEET_ROWS,
    BOX_KINDS: BOX_KINDS, PRIV_RE: PRIV_RE, MSG: MSG };
  if (isNode) module.exports = api;
  else root.PuGovReportInbox = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
```

- [ ] **Step 5: 모듈 검사 통과 확인**

Run: `node --test tests/gov-report-inbox.test.js`
Expected: 13 셋 가운데 둘(「상수」 — `Tr.LINK_KEY_MAX` · 「linkFrom」 — `Tr.normLink`)만 FAIL, 나머지 11 PASS — 기록 모듈은 다음 단계에서 고친다.

- [ ] **Step 6: 기록 모듈 검사(실패) 더하기** — `tests/gov-report-track.test.js` 끝에 더한다.

```js
/* ═══ 받은 서류 연결(link) — 설계 2026-10-11-gov-report-inbox-design.md §3 ═══ */

test('link 상수 — 규칙과 같은 값(src mail · 열쇠 80자 · 이름 100자)', () => {
  assert.equal(Tr.LINK_SRC, 'mail');
  assert.equal(Tr.LINK_KEY_MAX, 80);
  assert.equal(Tr.LINK_NAME_MAX, 100);
  assert.equal(Tr.LINK_BAD, '연결 값이 올바르지 않습니다');
});

test('normLink · normalize — 틀린 link 는 버리고(줄은 남긴다) 이름은 100자로 자른다', () => {
  const L = { src: 'mail', key: 'i:INBOX-0a1b2c3d:101', name: '서명본.hwpx', date: '2026-09-25' };
  assert.deepEqual(Tr.normLink(L), L);
  assert.deepEqual(Tr.normLink({ src: 'mail', key: 'o:AB', name: '', date: '2026/09/25', extra: 1 }), { src: 'mail', key: 'o:AB' });
  [null, 'x', { src: 'file', key: 'k' }, { src: 'mail' }, { src: 'mail', key: '' }, { src: 'mail', key: 7 },
    { src: 'mail', key: 'k'.repeat(81) }].forEach((bad) => assert.equal(Tr.normLink(bad), null, JSON.stringify(bad)));
  assert.equal(Tr.normLink({ src: 'mail', key: 'k', name: '가'.repeat(150) }).name.length, 100);
  const raw = { c2: { t3_2026: { items: {
    sign: { st: 'doing', at: 1, link: L },
    submit: { st: 'done', at: 2, link: { src: 'file', key: 'x' } },
  } } } };
  assert.deepEqual(Tr.normalize(raw), { c2: { t3_2026: { sign: { st: 'doing', at: 1, link: L }, submit: { st: 'done', at: 2 } } } });
});

test('patchFor · validate — link 를 실어 쓰고, 틀린 link 는 저장 전에 막는다', () => {
  const L = { src: 'mail', key: 'i:INBOX-0a1b2c3d:101', name: '서명본.hwpx', date: '2026-09-25' };
  const p = Tr.patchFor({ st: 'doing', sentAt: '2026-09-20', link: L }, '홍길동', 5);
  assert.deepEqual(p, { st: 'doing', at: 5, by: '홍길동', sentAt: '2026-09-20', link: L });
  assert.deepEqual(Tr.normalize({ c: { r: { items: { k: p } } } }).c.r.k, p);
  assert.deepEqual(Tr.patchFor({ st: 'doing', link: null }, '', 5), { st: 'doing', at: 5 });
  assert.equal(Tr.validate({ st: 'doing', link: L }, 'sign'), '');
  assert.equal(Tr.validate({ st: 'doing', link: null }, 'sign'), '');
  assert.equal(Tr.validate({ st: 'doing', link: { src: 'mail', key: '' } }, 'sign'), '연결 값이 올바르지 않습니다');
});

test('nextLink — 상태만 고치는 저장은 옛 link 를 이어 받고, 요청(op.link)이 있으면 그것(null 이면 지움)', () => {
  const L = { src: 'mail', key: 'i:X:1', name: 'a.pdf' };
  const M = { src: 'mail', key: 'i:X:2', name: 'b.pdf' };
  assert.deepEqual(Tr.nextLink({ st: 'doing', at: 1, link: L }, undefined), L);
  assert.deepEqual(Tr.nextLink({ st: 'doing', at: 1, link: L }, {}), L);
  assert.deepEqual(Tr.nextLink({ st: 'doing', at: 1, link: L }, { link: M }), M);
  assert.equal(Tr.nextLink({ st: 'doing', at: 1, link: L }, { link: null }), null);
  assert.equal(Tr.nextLink(null, undefined), null);
  assert.equal(Tr.nextLink({ st: 'doing', at: 1 }, undefined), null);
  const carried = Tr.patchFor({ st: 'done', gotAt: '2026-10-08', link: Tr.nextLink({ st: 'doing', at: 1, link: L }, undefined) }, '홍길동', 9);
  assert.deepEqual(carried.link, L, '상태만 고쳐도 link 가 남는다');
});

test('put — link 가 든 줄을 로컬 표에 그대로 · 저장 관문은 link 가 든 줄 .set 도 통과', () => {
  const L = { src: 'mail', key: 'i:X:1', name: 'a.pdf' };
  assert.deepEqual(Tr.put({}, 'c2', 't3_2026', 'sign', { st: 'doing', at: 1, link: L }).c2.t3_2026.sign.link, L);
  const p = Tr.patchFor({ st: 'doing', link: L }, '홍길동', 1);
  assert.equal(W.inspectWrite({ kind: 'set', path: 'scal_docs/c2/t3_2026/items/sign', value: p, mode: 'enforce' }).ok, true);
});
```

- [ ] **Step 7: 실패 확인**

Run: `node --test tests/gov-report-track.test.js`
Expected: 새 다섯 셋 FAIL(`Tr.normLink is not a function` 등), 앞 13 셋 PASS.

- [ ] **Step 8: 기록 모듈 고치기** — `js/pu-gov-report-track.js`

(a) 머리 주석의 `     한쪽만 바꾸면 화면이 «된다»고 보인 것을 서버가 거절한다(tests/gov-report-rules.test.js 가 맞춰 본다).` 줄 다음에 더한다.

```js
   ★ 받은 서류 연결(2026-10-11, 설계 docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md §3) — 줄에 선택 칸 link 하나:
     { src:'mail', key:1~80자, name?:≤100자, date?:'YYYY-MM-DD' }. 읽을 때 틀린 link 는 버리고(줄은 남긴다) 이름은 자른다.
     화면 grSaveCell 은 줄 전체를 .set 하므로, 상태만 고치는 저장이 link 를 지우지 않게 nextLink(옛 줄, 요청)로 이어 받는다.
```

(b) `  var LOAD_FAIL = '기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인';` 줄 다음에 더한다.

```js
  /* 받은 서류 연결 — 규칙(scal_docs …/$key/link)과 같은 값 */
  var LINK_SRC = 'mail', LINK_KEY_MAX = 80, LINK_NAME_MAX = 100;
  var LINK_BAD = '연결 값이 올바르지 않습니다';
```

(c) `  function normRec(r) {` 줄 «앞»에 더한다.

```js
  /* 연결 하나 — 틀리면 null(그 줄은 남긴다). 이름은 자르고 날짜 꼴이 아니면 뺀다 */
  function normLink(l) {
    if (!obj(l) || l.src !== LINK_SRC || typeof l.key !== 'string' || !l.key || l.key.length > LINK_KEY_MAX) return null;
    var o = { src: LINK_SRC, key: l.key };
    if (str(l.name)) o.name = str(l.name).slice(0, LINK_NAME_MAX);
    if (isDay(l.date)) o.date = l.date;
    return o;
  }
  /* 저장할 때 실을 연결 — 요청(op)에 link 칸이 있으면 그것(null 이면 지움), 없으면 옛 줄의 것을 이어 받는다 */
  function nextLink(prev, op) {
    if (obj(op) && has(op, 'link')) return normLink(op.link);
    return obj(prev) ? normLink(prev.link) : null;
  }
```

(d) `normRec` 안의 `    if (r.ack === true) o.ack = true;` 줄 다음에 더한다(그 함수의 `return o;` 바로 앞).

```js
    var lk = normLink(r.link);
    if (lk) o.link = lk;
```

(e) `validate` 안의 `    if (str(e.note).length > NOTE_MAX) return '메모는 ' + NOTE_MAX + '자까지입니다';` 줄 다음에 더한다.

```js
    if (e.link != null && !normLink(e.link)) return LINK_BAD;
```

(f) `patchFor` 안의 `    if (str(e.note)) o.note = str(e.note);` 줄 다음에 더한다.

```js
    var lk = normLink(e.link);
    if (lk) o.link = lk;
```

(g) `var api = { … }` 의 `    alertsExtra: alertsExtra, validate: validate, patchFor: patchFor,` 줄을 다음으로 바꾸고, `    NOTE_MAX: NOTE_MAX, BY_MAX: BY_MAX, WAIT_SIGN_DAYS: WAIT_SIGN_DAYS, KEY_RE: KEY_RE, SAVE_FAIL: SAVE_FAIL, LOAD_FAIL: LOAD_FAIL };` 줄을 그 다음 것으로 바꾼다.

```js
    alertsExtra: alertsExtra, validate: validate, patchFor: patchFor, normLink: normLink, nextLink: nextLink,
```

```js
    NOTE_MAX: NOTE_MAX, BY_MAX: BY_MAX, WAIT_SIGN_DAYS: WAIT_SIGN_DAYS, KEY_RE: KEY_RE, SAVE_FAIL: SAVE_FAIL, LOAD_FAIL: LOAD_FAIL,
    LINK_SRC: LINK_SRC, LINK_KEY_MAX: LINK_KEY_MAX, LINK_NAME_MAX: LINK_NAME_MAX, LINK_BAD: LINK_BAD };
```

- [ ] **Step 9: 두 모듈 검사 통과 확인**

Run: `node --test tests/gov-report-track.test.js tests/gov-report-inbox.test.js`
Expected: PASS (track 18 · inbox 13)

- [ ] **Step 10: 화면에 싣기** — `gov-report.html`

번호부터 본다(다른 화면이 쓰는 번호를 그대로 쓴다).

Run: `git grep -h -o "pu-co-thread.js?v=[0-9]*\|mail-orig.js?v=[0-9]*\|pu-gov-report-track.js?v=[0-9]*" -- "*.html" | sort | uniq -c`
Expected: `1 mail-orig.js?v=2` · `1 pu-co-thread.js?v=3` · `1 pu-gov-report-track.js?v=2` (다르면 아래 번호를 그 값으로 — track 은 그 값 +1)

`<script src="js/pu-gov-report-track.js?v=2"></script>` 와 `<script src="js/pu-gov-report-docs.js?v=3"></script>` 두 줄을 다음으로 바꾼다.

```html
<script src="js/pu-gov-report-track.js?v=3"></script>
<script src="js/pu-gov-report-docs.js?v=3"></script>
<!-- 받은 서류함 — 주소 맞추기(pu-co-thread) · 서버 부르기(rules-v2/mail-orig 의 makeCall) · 후보·연결 열쇠·첨부 받기 순서(순수 함수)
     설계 docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md. 판독기(pdf·xlsx)는 누를 때 vendor/ 에서 싣는다 -->
<script src="js/pu-co-thread.js?v=3"></script>
<script src="js/rules-v2/mail-orig.js?v=2"></script>
<script src="js/pu-gov-report-inbox.js?v=1"></script>
```

- [ ] **Step 11: 싣기 차례 정적 검사** — `tests/gov-report-app.test.js` 의 `test('정적 — 쓰기는 한 곳뿐(서류 진행 기록 줄 하나 .set) · 일정 자리는 GR_NODES 로만 부른다', …);` 덩어리 «앞»에 더한다.

```js
test('정적 — 받은 서류함 모듈을 차례대로 싣는다(주소 맞추기·서버 부르기 → 후보 모듈) · 서버 부르기 번호는 취업규칙 화면과 같다', () => {
  ['js/pu-co-thread.js', 'js/rules-v2/mail-orig.js', 'js/pu-gov-report-inbox.js'].forEach((f) =>
    assert.match(SRC, new RegExp('<script src="' + f.replace(/\./g, '\\.') + '\\?v=\\d+"></script>'), f));
  const at = (f) => SRC.indexOf(f);
  assert.ok(at('pu-co-thread.js') < at('pu-gov-report-inbox.js'));
  assert.ok(at('rules-v2/mail-orig.js') < at('pu-gov-report-inbox.js'));
  assert.ok(at('pu-gov-report-build.js') < at('pu-gov-report-inbox.js'), 'PRIV_RE 를 build 에서 가져온다');
  const RULES = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
  const v = (s) => (s.match(/js\/rules-v2\/mail-orig\.js\?v=(\d+)/) || [])[1];
  assert.ok(v(SRC) && v(SRC) === v(RULES), '서버 부르기 모듈 ?v 가 취업규칙 화면과 같아야 한다');
});
```

- [ ] **Step 12: 통과 확인**

Run: `node --test tests/gov-report-inbox.test.js tests/gov-report-track.test.js tests/gov-report-docs.test.js tests/gov-report-list.test.js tests/gov-report-app.test.js tests/co-thread.test.js tests/rules-v2-mail-orig.test.js tests/html-inline-script-syntax.test.js tests/test-pin-guard.test.js tests/tests-no-local-path.test.js`
그리고: `node tests/shared-js-cache-version.test.js` · `node scripts/check-cache-version.js --all`
Expected: 모두 PASS. `check-cache-version --all` 은 아무것도 안 찍는다. 화면은 아직 메일함을 읽지 않는다.

- [ ] **Step 13: 커밋** (PowerShell)

```powershell
git add js/pu-gov-report-inbox.js tests/gov-report-inbox.test.js js/pu-gov-report-track.js tests/gov-report-track.test.js tests/helpers/gov-report-fixture.js gov-report.html tests/gov-report-app.test.js
git commit -m @'
feat(gov-report): 받은 서류함 순수 모듈 — 메일 첨부 후보·연결 열쇠·첨부 받기 순서 + 서류 줄 link

- js/pu-gov-report-inbox.js(새): 주소로만 업체 귀속(업체관리 먼저 적은 쪽·우리 주소 뺌) · 첨부 있는 메일·기간(−30/+90일)·
  날짜 내림차순·50건 · 개인 자료 딱지(PRIV_RE 그대로) · 기술보호 딱지 · 열쇠 i:<폴더>:<uid>/o:<popKey>(80자) ·
  첨부는 이름으로 집어 한 건 받기(peek → 받기, 20MB 넘으면 안 받음) · 실패 문구
- pu-gov-report-track: link 가지(normLink·nextLink·LINK_*) — 읽기 다듬기·검사·저장 꼴, 상태만 고쳐도 link 이어 받기
- gov-report.html 싣기(track ?v=3 · co-thread · mail-orig · inbox ?v=1). 아직 메일함을 읽지 않는다

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 2: 규칙 `scal_docs` 줄의 `link`(생성만 — 게시하지 않는다) · 등록부 빌려 읽기 · 검사 목록

**Files:**
- Modify: `scripts/make-firebase-rules.js` (`rules.scal_docs` 의 `$key` 안, `ack:` 줄 다음)
- Regenerate: `docs/firebase-rules-전체-적용본.json` · `docs/rules-paste.json`
- Modify: `tests/gov-report-rules.test.js` (줄 모양 검사의 칸 목록 한 줄 + 새 검사 둘)
- Modify: `tests/photos-staff-share.test.js` (`PENDING`)
- Modify: `js/pu-ontology.js` (`govreport` 주석·`sharedRoots`)
- Modify: html 24개 (`js/pu-ontology.js?v=62 → 63`, 바이트 보존)
- Modify: `tests/gov-report-app.test.js` (등록부 단언 한 줄)

**Interfaces:**
- Consumes (T1): `PuGovReportTrack.LINK_SRC`('mail') · `LINK_KEY_MAX`(80) · `LINK_NAME_MAX`(100) — 규칙과 같은 값인지 맞춰 본다
- Produces: 규칙 `rules.scal_docs.$co.$rid.items.$key.link`(생성기 출력·JSON 두 개) · 등록부 `PROGRAMS.govreport.sharedRoots` 에 `'mailbox'`·`'data/companies'`(쓰기 계약은 그대로) · `pu-ontology.js?v=63`
- ⚠ **게시 금지**: `scripts/rules-deploy.js` 를 어떤 인자로도 돌리지 않는다. JSON 은 아래 Step 4 의 스크립트로만 만든다.
- ⚠ `perf-rules` 의 `allowTop` 은 고치지 않는다 — `scal_docs` 는 이미 있다(새 뿌리가 없다).

- [ ] **Step 1: 실패하는 규칙 검사** — `tests/gov-report-rules.test.js`

(a) 줄 모양 검사의 칸 목록 한 줄

```js
  assert.deepEqual(Object.keys(k).sort(), ['$other', '.validate', '.write', 'ack', 'at', 'by', 'gotAt', 'how', 'note', 'sentAt', 'st']);
```

을 다음으로 바꾼다.

```js
  assert.deepEqual(Object.keys(k).sort(), ['$other', '.validate', '.write', 'ack', 'at', 'by', 'gotAt', 'how', 'link', 'note', 'sentAt', 'st']);
```

(b) 파일 끝에 더한다.

```js
/* ═══ 받은 서류 연결 (2026-10-11, 설계 2026-10-11-gov-report-inbox-design.md §3) ═══ */

test('scal_docs 줄의 link — src·key 필수 · src 는 mail 만 · key 1~80자 · name ≤100자 · date 꼴 · 다른 칸 거절 · 따로 쓰기 문 없음', () => {
  const k = rules.scal_docs.$co.$rid.items.$key;
  const l = k.link;
  assert.ok(l, 'link 가지가 없습니다');
  assert.equal(l['.validate'], "newData.hasChildren(['src','key'])");
  assert.equal(l.src['.validate'], "newData.isString() && newData.val() === 'mail'");
  assert.equal(l.key['.validate'], 'newData.isString() && newData.val().length >= 1 && newData.val().length <= 80');
  assert.equal(l.name['.validate'], 'newData.isString() && newData.val().length <= 100');
  assert.equal(l.date['.validate'], k.sentAt['.validate'], '날짜 꼴은 sentAt·gotAt 과 같은 식');
  assert.equal(l.$other['.validate'], false);
  assert.deepEqual(Object.keys(l).sort(), ['$other', '.validate', 'date', 'key', 'name', 'src']);
  assert.equal(l['.write'], undefined, 'link 에 따로 쓰기 문을 열지 않는다(줄 쓰기 규칙을 따른다)');
});

test('link 한계 — 규칙과 화면 모듈(js/pu-gov-report-track.js)이 같은 값', () => {
  const l = rules.scal_docs.$co.$rid.items.$key.link;
  assert.ok(l.src['.validate'].includes("'" + Tr.LINK_SRC + "'"), '연결 갈래');
  assert.ok(l.key['.validate'].endsWith('<= ' + Tr.LINK_KEY_MAX), '열쇠 길이');
  assert.ok(l.name['.validate'].endsWith('<= ' + Tr.LINK_NAME_MAX), '이름 길이');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-rules.test.js`
Expected: FAIL — 줄 모양 검사(칸 목록에 `link` 없음)와 새 둘(`link 가지가 없습니다`). 나머지 다섯은 PASS.

- [ ] **Step 3: 생성기에 규칙** — `scripts/make-firebase-rules.js` 의 `rules.scal_docs` 안

```js
          ack:    { '.validate': 'newData.isBoolean()' },
          $other: { '.validate': false }
```

두 줄을 다음으로 바꾼다(`$other` 는 그대로 맨 끝).

```js
          ack:    { '.validate': 'newData.isBoolean()' },
          /* 받은 서류 연결 (2026-10-11, 설계 docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md §3)
             메일 첨부 하나를 가리키는 열쇠 — 'i:<폴더>:<uid>'(일반) · 'o:<popKey>'(지난 메일). 바이트는 담지 않는다.
             ★ 따로 쓰기 문을 열지 않는다 — 줄($key) 쓰기 규칙을 그대로 따른다(줄 하나 .set 안에 실린다).
             ★ 화면 모듈 LINK_SRC·LINK_KEY_MAX·LINK_NAME_MAX(js/pu-gov-report-track.js)와 같은 값 — tests/gov-report-rules.test.js.
             ⚠ 게시는 대표 승인 뒤에만. 게시 전에는 줄의 $other:false 때문에 link 가 든 저장이 통째로 거절된다
               (컨설팅보고서 앱 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」, link 없는 저장은 그대로 된다). */
          link: {
            '.validate': "newData.hasChildren(['src','key'])",
            src:    { '.validate': "newData.isString() && newData.val() === 'mail'" },
            key:    { '.validate': 'newData.isString() && newData.val().length >= 1 && newData.val().length <= 80' },
            name:   { '.validate': 'newData.isString() && newData.val().length <= 100' },
            date:   { '.validate': SCAL_DOCS_DAY },
            $other: { '.validate': false }
          },
          $other: { '.validate': false }
```

그리고 같은 덩어리 머리 주석의 `     (tests/gov-report-rules.test.js 가 둘을 맞춰 본다). rid 아래에는 items 말고 아무것도 못 쓴다.` 줄 다음에 한 줄 더한다.

```js
   ★ 2026-10-11 — 줄에 선택 칸 link(받은 서류 연결) 하나를 더했다(아래 link 가지). 게시 대기.
```

Run: `node --test tests/gov-report-rules.test.js`
Expected: PASS (8 tests)

- [ ] **Step 4: JSON 두 개 다시 만들기(게시 아님)** — 생성기 출력을 CRLF 로 두 파일에 똑같이 쓴다. 스크립트는 저장소 «밖»(`$env:TEMP`), 글자는 ASCII 만(파일 이름의 한글은 `\u` — 「전체-적용본」 = `전체-적용본`).

```powershell
@'
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = process.argv[2];
const out = cp.execFileSync('node', [path.join(root, 'scripts', 'make-firebase-rules.js')], { encoding: 'utf8' }).replace(/\r?\n/g, '\r\n');
const alt = 'firebase-rules-전체-적용본.json';
for (const f of [alt, 'rules-paste.json']) { fs.writeFileSync(path.join(root, 'docs', f), out); console.log('wrote', f); }
'@ | Out-File -Encoding ascii "$env:TEMP\gr-inbox-rules.js"
node "$env:TEMP\gr-inbox-rules.js" (Get-Location).Path
git diff --stat -- docs/rules-paste.json docs/firebase-rules-*.json
```

Expected: `wrote firebase-rules-전체-적용본.json` · `wrote rules-paste.json`, 그리고 `git diff --stat` 에 두 파일만, 각각 **늘어난 줄만**(18줄 — `"link": {` 덩어리, 지운 줄 0). 지운 줄이 보이면 멈추고 까닭(줄 끝·다른 변경)을 찾는다.

- [ ] **Step 5: 검사 목록 — 게시 대기** — `tests/photos-staff-share.test.js` 의 `  const PENDING = [];` 한 줄을 다음으로 바꾼다.

```js
  /* ★ 2026-10-11 — 받은 서류 연결(scal_docs 줄의 link 가지)을 만들개에 넣었다(설계 2026-10-11-gov-report-inbox-design.md §3).
       규칙 게시 대기 — 대표 승인 뒤 rules-deploy.js 로 게시하고, 콘솔 원문을 새 판으로 갱신한 뒤 이 줄을 지울 것.
       게시 전에는 컨설팅보고서 앱의 「연결」만 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」으로 거절된다(다른 저장은 그대로). */
  const PENDING = ['/scal_docs/$co/$rid/items/$key/link'];
```

Run: `node --test tests/photos-staff-share.test.js tests/rules-paste-copy.test.js tests/rules-deploy-guards.test.js`
Expected: PASS — 「콘솔과 한 곳도 다르지 않다」의 차이가 `/scal_docs/$co/$rid/items/$key/link` 하나뿐이다(콘솔 원문 `docs/firebase-rules-콘솔원문-2026-10-11.json` 에는 `scal_docs` 가 이미 있다). 다른 차이가 보이면 멈춘다.

- [ ] **Step 6: 등록부** — `js/pu-ontology.js`

(a) `govreport` 머리 주석 끝 줄 `         게시 전에는 읽기·쓰기가 거절되고 화면은 읽기 전용으로 돈다. */` 를 다음으로 바꾼다(그 글줄은 파일에 하나뿐 — Edit 전에 `grep -n` 으로 확인).

```js
         게시 전에는 읽기·쓰기가 거절되고 화면은 읽기 전용으로 돈다.
       ★ 받은 서류함(2026-10-11, 설계 2026-10-11-gov-report-inbox-design.md) — 칸 창 「📥 받은 서류 후보」가 메일함 거울
         (mailbox/folders · mailbox/msgs 머리글, 주인은 푸른 메일 mail)과 업체관리(data/companies, 주소 세 칸)를 빌려 읽는다
         (이름 표 GR_INBOX_NODES, 칸 창을 처음 열 때 한 번). 첨부는 서버 함수로 한 건씩 받아 화면에서만 보고 버린다.
         연결은 scal_docs 줄 안의 link 한 칸 — 쓰기 계약은 그대로다. */
```

(b) `govreport` 의 `                   'data/biz_cons_types','data/consultings','scal_erpTypeMap'],` 줄을 다음으로 바꾼다.

```js
                   'data/biz_cons_types','data/consultings','scal_erpTypeMap','mailbox','data/companies'],
```

- [ ] **Step 7: 화면 검사의 등록부 단언** — `tests/gov-report-app.test.js` 의 다음 줄

```js
  ['data/biz_cons_types', 'data/consultings', 'scal_erpTypeMap'].forEach((r) => assert.ok(g.sharedRoots.includes(r), r));
```

을 다음으로 바꾼다(쓰기 계약 단언 `['activeWriter/gov_report', 'scal_docs/{co}/{rid}/items/{key}']` 은 그대로 둔다 — 쓰는 곳은 늘지 않는다).

```js
  ['data/biz_cons_types', 'data/consultings', 'scal_erpTypeMap', 'mailbox', 'data/companies'].forEach((r) => assert.ok(g.sharedRoots.includes(r), r));
```

- [ ] **Step 8: 공용 js 번호 올리기(바이트 보존)** — 지금 번호부터 본다(main 이 움직였으면 아래 62/63 을 그 번호로).

Run: `git grep -h -o "pu-ontology.js?v=[0-9]*" -- "*.html" | Group-Object | Select-Object Count,Name`
Expected: `24 pu-ontology.js?v=62` 한 줄

latin1 로 읽고 써서 BOM·CRLF·섞인 줄 끝을 바이트 그대로 둔다. 스크립트는 저장소 «밖».

```powershell
@'
const fs = require('fs'), path = require('path');
const root = process.argv[2];
for (const f of fs.readdirSync(root).filter((x) => x.endsWith('.html'))) {
  const p = path.join(root, f); const s = fs.readFileSync(p, 'latin1');
  const t = s.split('js/pu-ontology.js?v=62"').join('js/pu-ontology.js?v=63"');
  if (t !== s) { fs.writeFileSync(p, t, 'latin1'); console.log('bumped', f); }
}
'@ | Out-File -Encoding ascii "$env:TEMP\gr-inbox-bump.js"
node "$env:TEMP\gr-inbox-bump.js" (Get-Location).Path
git grep -h -o "pu-ontology.js?v=[0-9]*" -- "*.html" | Group-Object | Select-Object Count,Name
git diff --stat -- "*.html"
```

Expected: `bumped …` 24줄 · `git grep` 결과 `24 pu-ontology.js?v=63` 한 줄 · `git diff --stat` 의 html 마다 `1 +-`(줄 끝이 바뀌었다면 수가 커진다 — 그러면 멈춘다).

- [ ] **Step 9: 통과 확인**

Run: `node --test tests/gov-report-rules.test.js tests/rules-paste-copy.test.js tests/photos-staff-share.test.js tests/rules-deploy-guards.test.js tests/gov-report-app.test.js tests/gov-report-track.test.js tests/ontology-registry.test.js tests/ontology-contract.test.js tests/ontology-write-gate.test.js`
그리고: `node tests/perf-rules.test.js` · `node tests/shared-js-cache-version.test.js` · `node scripts/check-cache-version.js --all`
Expected: 모두 PASS(`perf-rules` 는 `=== N 통과 / 0 실패 ===`).

- [ ] **Step 10: 커밋** (PowerShell) — 고친 html 이 많으므로 `git status --short` 로 고친 것만 보이는지 먼저 본다.

```powershell
git status --short
git add scripts/make-firebase-rules.js docs/rules-paste.json docs/firebase-rules-*.json tests/gov-report-rules.test.js tests/photos-staff-share.test.js js/pu-ontology.js tests/gov-report-app.test.js
git add -u -- "*.html"
git commit -m @'
feat(rules): 서류 줄에 받은 서류 연결 link 가지 — 게시 대기

- scal_docs/{업체}/{rid}/items/{키}/link: src·key 필수 · src 'mail' · key 1~80자 · name ≤100자 · date 꼴 · 다른 칸 거절
  (따로 쓰기 문 없음 — 줄 하나 .set 안에 실린다). 화면 모듈 LINK_* 와 같은 값을 검사가 맞춰 본다
- 규칙 JSON 두 개 다시 만듦. ★ 게시하지 않았다 — 대표 승인 뒤 rules-deploy.js (photos-staff-share PENDING 에 올림).
  게시 전에는 「연결」만 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」, 다른 저장은 그대로
- 등록부 govreport: 빌려 읽기 mailbox · data/companies(쓰기 계약은 그대로) · pu-ontology.js ?v=63 (부르는 화면 모두)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 3: 화면 — 칸 창 「📥 받은 서류 후보」 · 「연결」/「연결 지우기」(기존 한 곳 저장) · 「열어 보기」(한 번에 하나) · 보기 창

**Files:**
- Modify: `gov-report.html` (머리 주석 · CSS · 몸통 한 줄 · 맨 아래 `<script>`: 이름 표 둘 · `GR` · `grOpenCell` · `grRenderCell` · `grSaveCell` · 새 함수들 · `grBoot`)
- Modify: `tests/gov-report-app.test.js` (머리 주석 · 불러오기 · `NAMES` · `world()` · 새 도우미 · 새 검사 ㊲~㊽)

**Interfaces:**
- Consumes (T1): `PuGovReportInbox.windowOf` · `addrsFor` · `boxesOf` · `mailRows` · `candidates` · `badges` · `kindOf` · `imgType` · `linkKey.parse` · `linkFrom` · `errText` · `fetchAtt` · `MSG` · `SHEET_ROWS` · `PuGovReportTrack.nextLink` · `recOf` · `SAVE_FAIL` · `PuRulesMailOrig.makeCall({ base, getToken, fetch }) → call(fn, body)` · `PuRulesMailOrig.b64ToBytes(b64) → Uint8Array` · `PuHwpPreview.open(ArrayBuffer, name) → Promise`(취소는 `e.cancelled`) · `PuGovReportDocs.consFor` · `planFor` · `pairs`(`firstDate`·`lastDate`·`co`)
- Consumes (T2): 규칙 `link` 가지(검사만 — 화면은 게시 전에도 돈다)
- Produces: `GR_INBOX_NODES={folders:'mailbox/folders',msgs:'mailbox/msgs',cos:'data/companies'}` · `GR_MAIL={fn,per,wait}` · `GR.inbox`·`GR.inboxP`·`GR.iseq`·`GR.av`·`GR.avBusy`·`GR.avMsg`·`GR.avErr` · `GR.cw.win`·`cons`·`tech`·`cands` · `grLoadInbox(force) → Promise` · `grReadInbox(seq)` · `grRetryInbox()` · `grRenderInbox()` · `grLinkCand(i,j) → Promise` · `grUnlink() → Promise` · `grSaveCell(op)`(op 없음 = link 이어 받기 · `{link:L}` 연결 · `{link:null}` 지우기) · `grMailFetch(url,init)` · `grMailCall()` · `grOpenCand(i,j)` · `grOpenLinked()` · `grOpenAtt(ref,name) → Promise<{ok, busy?, cancelled?}>` · `grLib(src,ready)` · `grShowAtt(kind,bytes,name)` · `grRenderAv()` · `grPdfDraw()` · `grPdfPage(step)` · `grCloseAv()` · 화면 칸 `#cwInbox`(칸 창 안) · `#attv`(보기 창) · `#avCanvas`
- ⚠ 이 작업은 `js/*.js` 를 고치지 않는다. 고쳐야 하면 그 파일의 `?v` 를 같은 커밋에서 올린다.
- ⚠ 받은 서류함은 칸 창을 «다시 그리지 않는다» — 후보·잠금·안내는 `#cwInbox` 만 고친다(칸 창에 적던 값이 날아가지 않게, `grOpenHwp` 와 같은 원칙). 칸 창을 다시 그리는 것은 저장이 끝났을 때(기존 그대로)뿐이다.

- [ ] **Step 1: 화면 검사 고치기·더하기(실패)** — `tests/gov-report-app.test.js`

(a) 머리 주석의 ` *   오류·빈 상태 문구(설계서 §5) · 본문은 그리지 않는다` 줄 다음에 한 줄 더한다.

```js
 *   받은 서류함(2026-10-11): 메일함은 읽기만 · 「연결」은 같은 줄 하나 .set 안의 link · 「열어 보기」는 한 번에 하나, 받은 것은 담지 않는다
```

(b) `const Tr = require('../js/pu-gov-report-track.js');` 줄 다음에 더한다.

```js
const I = require('../js/pu-gov-report-inbox.js');
const MO = require('../js/rules-v2/mail-orig.js');
require('../js/pu-co-thread.js');
const CT = globalThis.PuCoThread;
```

(c) `NAMES` 의 마지막 줄

```js
  'grView', 'grLoadTrack', 'grApplyTrack', 'grOpenCell', 'grPickCell', 'grRenderCell', 'grSaveCell', 'grCloseCell', 'grOkId', 'grPickHwp', 'grOpenHwp'];
```

을 다음으로 바꾼다.

```js
  'grView', 'grLoadTrack', 'grApplyTrack', 'grOpenCell', 'grPickCell', 'grRenderCell', 'grSaveCell', 'grCloseCell', 'grOkId', 'grPickHwp', 'grOpenHwp',
  'grLoadInbox', 'grReadInbox', 'grRetryInbox', 'grRenderInbox', 'grLinkCand', 'grUnlink', 'grMailFetch', 'grMailCall',
  'grOpenCand', 'grOpenLinked', 'grOpenAtt', 'grLib', 'grShowAtt', 'grRenderAv', 'grPdfDraw', 'grPdfPage', 'grCloseAv'];
```

(d) `function world(o) { … }` 전체를 다음으로 바꾼다.

```js
function world(o) {
  o = o || {};
  const db = FakeDb.만들기(o.seed || F.seed());
  const els = {};
  ['cwKey', 'cwSt', 'cwSent', 'cwGot', 'cwHow', 'cwAck', 'cwNote', 'cwHwpMsg'].forEach((id) => { els[id] = fakeEl(); }); // 칸 창 입력 — 진짜 DOM 에서는 innerHTML 이 만든다
  const urls = { made: [], revoked: [] };   // 보기 창이 만든·버린 blob 주소
  const ctx = { console: { warn() {} }, Promise, Object, Array, JSON, String, Number, Math, Date, RegExp, Error, isFinite,
    encodeURIComponent, PuGovReportList: L, PuGovReport: { FORMS: Rpt.FORMS }, PuGovReportDocs: D, PuGovReportTrack: Tr,
    PuGovReportInbox: I, PuRulesMailOrig: MO, PuCoThread: CT, setTimeout, clearTimeout,
    /* 받은 서류함 — 가짜 서버(mailServer)·로그인·blob 주소. 서버를 안 주면 부르는 순간 실패한다 */
    fetch: (o.mail && o.mail.fetch) || (async () => { throw new Error('이 검사는 서버를 부르면 안 된다'); }),
    firebase: { auth: () => ({ currentUser: o.noUser ? null : { getIdToken: async () => 'tok' } }) },
    URL: { createObjectURL: (b) => { urls.made.push(b); return 'blob:' + urls.made.length; }, revokeObjectURL: (u) => { urls.revoked.push(u); } },
    Blob: function (parts, opt) { this.parts = parts; this.type = opt && opt.type; },
    $: (id) => (els[id] = els[id] || fakeEl()),
    fbDb: o.db ? o.db(db) : db };
  if (o.preview) ctx.PuHwpPreview = o.preview;
  if (o.pdfjs) ctx.pdfjsLib = o.pdfjs;
  if (o.xlsx) ctx.XLSX = o.xlsx;
  ctx.window = ctx;
  ctx.navigator = o.nav || { clipboard: { writeText: async (t) => { ctx.copied = t; } } };
  vm.createContext(ctx);
  vm.runInContext([varLine('GR_NODES'), varLine('GR_FIELDS'), varLine('GR_DOC_NODES'), varLine('GR_TRACK_NODES'), varLine('GR_INBOX_NODES'),
    varLine('GR_MAIL'), varLine('GR')].join('\n') + '\n' + NAMES.map(grab).join('\n')
    + "\ngrToday=function(){ return '2026-10-10'; };", ctx);
  if (o.email) vm.runInContext('GR.email=' + JSON.stringify(o.email) + ';', ctx);
  return { ctx, db, els, urls };
}
```

(e) 파일 끝에 더한다. (`gate`·`tick`·`pvPreview` 는 이 파일 위쪽에 이미 있다. vm 안에서 만든 객체는 `deepEqual` 하지 않는다 — 프로토타입이 달라 엄격 비교가 틀린다. 칸 하나씩 `equal` 로 본다.)

```js
/* ══ 받은 서류함(📥 받은 서류 후보 · 연결 · 열어 보기) — 설계 2026-10-11-gov-report-inbox-design.md ══ */

/* 가짜 서버 함수 — readMailMessage(peek)·readOldMail(목록)은 첨부 목록을, readMailAttachment·readOldMail(index)은 그 첨부를 준다 */
const ATTS = [{ i: 0, part: '2', name: '서명본.hwpx', size: 4 }, { i: 1, part: '3', name: '확인서.pdf', size: 4 },
  { i: 2, part: '4', name: '현장.jpg', size: 4 }, { i: 3, part: '5', name: '보고서 초안.pdf', size: 4 },
  { i: 4, part: '6', name: '점검표.xlsx', size: 4 }, { i: 5, part: '', name: '자료.pdf', size: 4 }];
function mailServer(o) {
  o = o || {};
  const calls = [];
  const atts = o.atts || ATTS;
  const reply = (status, j) => ({ status, json: async () => j });
  const fetch = async (url, init) => {
    const fn = url.slice(url.lastIndexOf('/') + 1), body = JSON.parse(init.body);
    calls.push({ url, fn, body, auth: init.headers.Authorization, method: init.method });
    if (o.hold) await o.hold;
    if (o.never) return new Promise(() => {});
    if (o.status) return reply(o.status, { ok: false, error: '거절' });
    if (fn === 'readMailMessage' || (fn === 'readOldMail' && body.index == null)) return reply(200, { ok: true, html: '<p>본문</p>', text: '본문', atts });
    if (fn !== 'readMailAttachment' && fn !== 'readOldMail') return reply(400, { ok: false, error: '?' });
    const a = atts.filter((x) => x.i === body.index)[0];
    return a ? reply(200, { ok: true, name: a.name, mime: 'text/html', b64: 'UEsDBA==' }) : reply(404, { ok: false, error: '그 첨부가 없습니다' });
  };
  return { fetch, calls };
}
/* 가짜 pdf.js — 받은 인자와 닫기(destroy)를 센다 */
function fakePdf() {
  const st = { got: null, destroyed: 0 };
  const lib = { GlobalWorkerOptions: {}, getDocument: (o) => { st.got = o; return { promise: Promise.resolve({ numPages: 3,
    getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }), render: () => ({ promise: Promise.resolve() }) }),
    destroy: () => { st.destroyed++; } }) }; } };
  return { lib, st };
}
/* 불러오고 → 사업 고르고 → 칸 창 열고 → 메일함 읽기가 끝날 때까지 */
async function cellOf(w, biz, co, ty, step) {
  await w.ctx.grLoad();
  w.ctx.grSetBiz(biz);
  w.ctx.grOpenCell(co, ty, step);
  await w.ctx.grLoadInbox();
}

test('㊲ 칸 창 「📥 받은 서류 후보」 — 그 업체 주소로 오간 첨부 메일만, 날짜 내림차순 · 받음/보냄 · 첨부 이름 · 개인 자료는 목록에만', async () => {
  const w = world();
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  assert.ok(w.els.cellw.innerHTML.includes('<div id="cwInbox"></div>'));
  const h = w.els.cwInbox.innerHTML;
  ['📥 받은 서류 후보', '보냄 → 외부 · 2026-10-01', '받음 ← 다라정밀 담당 · 2026-09-25', '서명본 보내드립니다', '📎 서명본.hwpx', '📎 확인서.pdf',
    '<span class="st st-todo">개인 자료 · 목록에만</span>', I.MSG.NAME_NOTE].forEach((s) => assert.ok(h.includes(s), s));
  const at = (s) => h.indexOf(s);
  assert.ok(at('보고서 초안') < at('현장 사진') && at('현장 사진') < at('자료 보냅니다') && at('자료 보냅니다') < at('서명본 보내드립니다'), '날짜 내림차순');
  ['첨부 없음', '기간 밖', '다른 업체 주소', '스팸'].forEach((s) => assert.ok(!h.includes(s), s + ' 가 후보에 나왔다'));
  const priv = h.split('<li>').filter((x) => x.includes('9월 급여대장.xlsx'))[0];
  assert.ok(priv && !priv.includes('grOpenCand') && !priv.includes('grLinkCand'), '개인 자료는 연결·열어 보기를 막는다');
  assert.match(h, /onclick="grOpenCand\(3,0\)">열어 보기/);
  assert.match(h, /onclick="grLinkCand\(3,0\)">연결/);
  assert.equal(w.db.쓴것.length, 0, '목록은 읽기만');
});

test('㊳ 주소가 없는 업체는 안내 · 기술보호 사업은 딱지(열기는 된다) · 메일함은 한 번만 읽는다', async () => {
  let n = 0;
  const w = world({ db: (db) => ({ ref: (p) => { if (p === 'mailbox/folders') n++; return db.ref(p); } }) });
  await cellOf(w, 'consulting-05', 'c3', 't4', 'sign');
  assert.ok(w.els.cwInbox.innerHTML.includes(I.MSG.NO_ADDR));
  w.ctx.grCloseCell();
  w.ctx.grSetBiz('consulting-03');
  w.ctx.grOpenCell('c1', 't1', 'attach');
  await w.ctx.grLoadInbox();
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes('자문 일지 회신') && h.includes('<span class="st st-draft">기술보호 자료</span>'));
  assert.match(h, /onclick="grOpenCand\(0,0\)">열어 보기/, '기술보호 자료도 열어 볼 수 있다');
  assert.equal(n, 1, '메일함 폴더 표는 한 번만 읽는다');
});

test('㊴ 메일함을 못 읽으면 「메일함을 불러오지 못했습니다」 + 다시 시도 — 칸 창의 다른 기능은 그대로', async () => {
  let deny = true;
  const w = world({ db: (db) => ({ ref: (p) => (deny && p.indexOf('mailbox') === 0
    ? { once: async () => { throw new Error('permission_denied'); } } : db.ref(p)) }) });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes('메일함을 불러오지 못했습니다') && h.includes('onclick="grRetryInbox()"'));
  assert.ok(w.els.cellw.innerHTML.includes('onclick="grSaveCell()"'), '저장은 그대로');
  deny = false;
  await w.ctx.grRetryInbox();
  assert.ok(w.els.cwInbox.innerHTML.includes('서명본 보내드립니다'));
});

test('㊵ 「연결」 — 그 서류 줄 하나만 .set, link 는 줄 안에 · 상태만 고친 저장도 link 를 이어 받는다 · 「연결 지우기」는 link 만 뺀다', async () => {
  const w = world({ email: 'p009@pureun.kr' });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  w.els.cwSt.value = 'doing'; w.els.cwSent.value = '2026-09-20';   // 칸 창에 보이는 값(진짜 DOM 에서는 그려진 값)
  await w.ctx.grLinkCand(3, 0);
  onlyTrackWrites(w.db);
  assert.equal(w.db.쓴것.length, 1);
  const v = w.db.쓴것[0];
  assert.equal(v.자리, 'scal_docs/c2/t3_2026/items/sign');
  assert.deepEqual(v.값.link, { src: 'mail', key: 'i:INBOX-0a1b2c3d:101', name: '서명본.hwpx', date: '2026-09-25' });
  assert.deepEqual([v.값.st, v.값.sentAt, v.값.by], ['doing', '2026-09-20', '홍길동'], '칸 창 값과 함께 쓴다');
  assert.ok(w.els.cellw.innerHTML.includes('연결했습니다'));
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes('연결된 서류') && h.includes('서명본.hwpx · 2026-09-25') && h.includes('onclick="grOpenLinked()"') && h.includes('onclick="grUnlink()"'));
  w.els.cwSt.value = 'done'; w.els.cwGot.value = '2026-10-08';
  await w.ctx.grSaveCell();
  assert.deepEqual(w.db.쓴것[1].값.link, v.값.link, '상태만 고쳐도 link 가 남는다');
  assert.equal(w.db.쓴것[1].값.st, 'done');
  await w.ctx.grUnlink();
  onlyTrackWrites(w.db);
  const u = w.db.쓴것[2].값;
  assert.equal(u.link, undefined);
  assert.deepEqual([u.st, u.gotAt], ['done', '2026-10-08'], '서류 줄 상태는 그대로');
  assert.ok(w.els.cellw.innerHTML.includes('연결을 지웠습니다'));
  assert.ok(!w.els.cwInbox.innerHTML.includes('연결된 서류'));
});

test('㊶ 규칙 게시 전 — link 가 든 저장이 거절되면 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」, 표·값은 그대로 · link 없는 저장은 된다', async () => {
  const w = world({ db: (db) => ({ ref: (p) => (p.indexOf('scal_docs/') === 0
    ? { set: async (v) => { if (v && v.link) throw new Error('PERMISSION_DENIED'); return db.ref(p).set(v); } } : db.ref(p)) }) });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  w.els.cwSt.value = 'doing'; w.els.cwSent.value = '2026-09-20';
  await w.ctx.grLinkCand(3, 0);
  assert.ok(w.els.cellw.innerHTML.includes('저장하지 못했습니다 — 규칙 게시 또는 권한 확인'));
  assert.equal(w.ctx.GR.track.c2.t3_2026.sign.link, undefined);
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(!w.els.cwInbox.innerHTML.includes('연결된 서류'));
  w.els.cwSt.value = 'done'; w.els.cwGot.value = '2026-10-08';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 1, 'link 가 없는 저장은 게시 전에도 된다');
  assert.equal(w.db.쓴것[0].값.link, undefined);
});

test('㊷ 「열어 보기」(한글) — 서버에서 그 한 건만(peek) 받아 한글 미리보기로 · 로그인 증표 · 아무것도 쓰지·담지 않는다', async () => {
  const mail = mailServer();
  const pv = pvPreview();
  const w = world({ mail, preview: pv });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  const r = await w.ctx.grOpenCand(3, 0);
  assert.equal(r.ok, true);
  assert.deepEqual(mail.calls.map((c) => c.fn), ['readMailMessage', 'readMailAttachment']);
  assert.deepEqual(mail.calls[0].body, { slug: 'INBOX-0a1b2c3d', uid: '101', peek: true }, '읽음 표시를 건드리지 않는다(peek)');
  assert.deepEqual(mail.calls[1].body, { slug: 'INBOX-0a1b2c3d', uid: '101', index: 0, part: '2' });
  mail.calls.forEach((c) => {
    assert.equal(c.auth, 'Bearer tok');
    assert.equal(c.method, 'POST');
    assert.ok(c.url.startsWith(w.ctx.GR_MAIL.fn), c.url);
  });
  assert.equal(pv.calls.length, 1);
  assert.equal(pv.calls[0].name, '서명본.hwpx');
  assert.deepEqual([...new Uint8Array(pv.calls[0].buf)], [80, 75, 3, 4]);
  assert.ok(w.els.cwInbox.innerHTML.includes('열었습니다 — 서명본.hwpx'));
  assert.equal(w.db.쓴것.length, 0, '받은 것을 어디에도 쓰지 않는다');
});

test('㊸ 한 번에 하나 — 받는 동안 다른 「열어 보기」는 잠기고 눌러도 서버를 부르지 않는다 · 지난 메일은 1분 안내', async () => {
  const g = gate();
  const mail = mailServer({ hold: g.p });
  const w = world({ mail, preview: pvPreview() });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  const first = w.ctx.grOpenCand(3, 0);
  await tick();
  assert.equal(w.ctx.GR.avBusy, true);
  assert.match(w.els.cwInbox.innerHTML, /onclick="grOpenCand\(3,1\)" disabled/, '다른 단추가 잠긴다');
  assert.ok(w.els.cwInbox.innerHTML.includes(I.MSG.WAIT));
  const second = await w.ctx.grOpenCand(3, 1);
  assert.equal(second.ok, false);
  assert.equal(second.busy, true);
  assert.equal(mail.calls.length, 1, '두 번째는 서버를 부르지 않았다');
  g.go(); await first;
  assert.equal(w.ctx.GR.avBusy, false);
  assert.doesNotMatch(w.els.cwInbox.innerHTML, /onclick="grOpenCand\(3,1\)" disabled/);
  /* 지난 메일(POP3) 연결 — 안내가 다르고 readOldMail 로 간다 */
  const s = F.seed();
  s.scal_docs.c2.t3_2026.items.sign.link = { src: 'mail', key: 'o:AB12_x', name: '자료.pdf' };
  const g2 = gate();
  const m2 = mailServer({ hold: g2.p });
  const v = world({ seed: s, mail: m2, pdfjs: fakePdf().lib });
  await cellOf(v, 'consulting-04', 'c2', 't3', 'sign');
  const p = v.ctx.grOpenLinked();
  await tick();
  assert.ok(v.els.cwInbox.innerHTML.includes('불러오는 중… (지난 메일은 1분쯤 걸립니다)'));
  g2.go(); await p;
  assert.deepEqual(m2.calls.map((c) => [c.fn, c.body]), [['readOldMail', { key: 'AB12_x' }], ['readOldMail', { key: 'AB12_x', index: 5 }]]);
});

test('㊹ PDF·그림·표는 앱 안 보기 창 — 판독기는 저장소 vendor 에서, 닫으면 blob 주소·PDF 를 버린다', async () => {
  const mail = mailServer();
  const pdf = fakePdf();
  const xs = { read: (b, o) => { xs.got = [b, o]; return { SheetNames: ['점검', '둘째'], Sheets: { 점검: {} } }; },
    utils: { sheet_to_json: () => { const rows = [['<b>칸</b>', '둘']]; for (let i = 0; i < 250; i++) rows.push([i, '값']); return rows; } } };
  const w = world({ mail, pdfjs: pdf.lib, xlsx: xs });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  /* PDF — 그림처럼 그린다(PDF 속 스크립트가 돌지 않게) */
  await w.ctx.grOpenCand(3, 1);
  assert.equal(pdf.st.got.isEvalSupported, false);
  assert.ok(pdf.st.got.data instanceof Uint8Array);
  assert.match(pdf.lib.GlobalWorkerOptions.workerSrc, /^vendor\/pdf\.worker\.min\.js\?v=\d+$/);
  let h = w.els.attv.innerHTML;
  assert.equal(w.els.attv.style.display, '');
  assert.ok(h.includes('<canvas id="avCanvas" class="av-pdf"></canvas>') && h.includes('<b>1</b> / 3') && h.includes('data-close'));
  w.ctx.grPdfPage(1);
  assert.equal(w.ctx.GR.av.page, 2);
  w.ctx.grCloseAv();
  assert.equal(pdf.st.destroyed, 1);
  assert.equal(w.els.attv.style.display, 'none');
  /* 그림 — 종류는 확장자로 우리가 정한다 */
  await w.ctx.grOpenCand(1, 0);
  assert.equal(w.urls.made[0].type, 'image/jpeg');
  assert.ok(w.els.attv.innerHTML.includes('<img class="av-img" src="blob:1" alt="현장.jpg">'));
  w.ctx.grCloseAv();
  assert.deepEqual(w.urls.revoked, ['blob:1'], '닫으면 그 파일은 사라진다');
  assert.equal(w.ctx.GR.av, null);
  /* 표 — 첫 시트 앞 200행, 칸은 이스케이프 */
  await w.ctx.grOpenCand(0, 1);
  h = w.els.attv.innerHTML;
  assert.equal((h.match(/<tr>/g) || []).length, 200);
  assert.ok(h.includes('<th>&#60;b&#62;칸&#60;/b&#62;</th>') && !h.includes('<b>칸'));
  assert.ok(h.includes('「점검」 등 2장 중 첫 장'));
  assert.equal(xs.got[1].type, 'array');
  assert.equal(w.db.쓴것.length, 0);
});

test('㊺ 실패 문구 — 첨부 없음 · 로그인 · 응답 없음 · 너무 큼 · 열 수 없는 형식 — 칸 창은 그대로, 잠금은 풀린다', async () => {
  const cases = [
    [{ atts: [{ i: 0, part: '2', name: '다른.pdf', size: 4 }] }, {}, I.MSG.GONE],
    [{ status: 401 }, {}, I.MSG.LOGIN],
    [{}, { noUser: true }, I.MSG.LOGIN],
    [{ never: true }, { wait: 5 }, I.MSG.NO_REPLY],
    [{ atts: [{ i: 0, part: '2', name: '서명본.hwpx', size: 21 * 1024 * 1024 }] }, {}, I.MSG.TOO_BIG],
  ];
  for (const [srv, opt, want] of cases) {
    const mail = mailServer(srv);
    const w = world(Object.assign({ mail, preview: pvPreview() }, opt));
    if (opt.wait) vm.runInContext('GR_MAIL.wait=' + opt.wait + ';', w.ctx);
    await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
    const cw = w.ctx.GR.cw, msg = cw.msg, cell = w.els.cellw.innerHTML;
    const r = await w.ctx.grOpenCand(3, 0);
    assert.equal(r.ok, false, want);
    assert.ok(w.els.cwInbox.innerHTML.includes(want), want);
    assert.match(w.els.cwInbox.innerHTML, /class="err-s"/);
    assert.strictEqual(w.ctx.GR.cw, cw);
    assert.equal(cw.msg, msg);
    assert.equal(w.els.cellw.innerHTML, cell, '칸 창을 다시 그리지 않는다');
    assert.equal(w.ctx.GR.avBusy, false, '실패해도 잠금은 풀린다');
    assert.equal(w.db.쓴것.length, 0);
  }
  const mail = mailServer();
  const w = world({ mail });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  await w.ctx.grOpenCand(1, 1);
  assert.ok(w.els.cwInbox.innerHTML.includes(I.MSG.CANT));
  assert.equal(mail.calls.length, 0, '열 수 없는 형식은 서버를 부르지 않는다');
});

test('㊻ 연결된 서류 「열어 보기」 — 연결 열쇠로 그 메일·그 이름 · 후보 줄의 바깥 값은 이스케이프', async () => {
  const s = F.seed();
  s.scal_docs.c2.t3_2026.items.sign.link = { src: 'mail', key: 'i:INBOX-0a1b2c3d:101', name: '확인서.pdf', date: '2026-09-25' };
  const m = s.mailbox.msgs['INBOX-0a1b2c3d']['101'];
  m.s = '<img src=x>'; m.f = '<b>보낸이</b>'; m.an = ['<i>.pdf'];
  const mail = mailServer();
  const w = world({ seed: s, mail, pdfjs: fakePdf().lib });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes('연결된 서류') && h.includes('확인서.pdf · 2026-09-25'));
  assert.ok(!h.includes('<img') && !h.includes('<b>보낸이') && !h.includes('<i>.pdf'), '이스케이프 안 됨');
  assert.ok(h.includes('&#60;img src=x&#62;') && h.includes('&#60;b&#62;보낸이'));
  await w.ctx.grOpenLinked();
  assert.deepEqual(mail.calls.map((c) => c.fn + ':' + (c.body.part || '')), ['readMailMessage:', 'readMailAttachment:3']);
});

test('㊼ 정적 — 메일함은 GR_INBOX_NODES 로만 · 받은 바이트는 저장·업로드·내려받기 없음 · 외부 주소 없음 · 판독기는 누를 때 vendor 에서', () => {
  assert.match(SRC, /var GR_INBOX_NODES=\{folders:'mailbox\/folders',msgs:'mailbox\/msgs',cos:'data\/companies'\};/);
  assert.doesNotMatch(INLINE, /ref\(\s*['"](mailbox|data\/companies)/, 'GR_INBOX_NODES 를 거치지 않았다');
  const RULES = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
  const base = (RULES.match(/const MAIL_FN_BASE="([^"]+)"/) || [])[1];
  assert.ok(base && SRC.includes("fn:'" + base + "'"), '서버 함수 주소는 취업규칙 화면과 같은 곳');
  const body = ['grOpenAtt', 'grShowAtt', 'grRenderAv', 'grCloseAv', 'grOpenCand', 'grOpenLinked', 'grLib'].map(grab).join('\n');
  assert.doesNotMatch(body, /localStorage|sessionStorage|indexedDB|caches\.|FormData|download|\.set\(|\.update\(|\.push\(|\.put\(|window\.open|https?:\/\//);
  const libs = [...INLINE.matchAll(/grLib\('([^']+)'/g)].map((x) => x[1]);
  assert.ok(libs.length >= 2 && libs.every((x) => /^vendor\/[\w.-]+\.js\?v=\d+$/.test(x)), '판독기는 저장소 vendor 에서만: ' + libs.join(', '));
  assert.match(grab('grShowAtt'), /workerSrc='vendor\/pdf\.worker\.min\.js\?v=\d+'/);
  assert.match(grab('grShowAtt'), /isEvalSupported:false/);
  assert.match(SRC, /<div id="attv" class="toc" style="display:none"><\/div>/);
  assert.doesNotMatch(SRC.slice(0, SRC.indexOf('</head>')), /vendor\/(pdf|xlsx)/, '판독기는 누를 때 싣는다');
});

test('㊽ 폴더마다 최근 메일만 읽는다(GR_MAIL.per) — 넘치면 안내', async () => {
  const w = world();
  vm.runInContext('GR_MAIL.per=2;', w.ctx);
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  assert.equal(w.ctx.GR.inbox.clipped, true);
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes(I.MSG.CLIPPED));
  assert.ok(h.includes('현장 사진') && !h.includes('서명본 보내드립니다'), '열쇠 순 뒤에서 둘(106·107)만 읽었다');
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test tests/gov-report-app.test.js`
Expected: FAIL — `grLoadInbox 을(를) 못 찾았다` (또는 `GR_INBOX_NODES 한 줄을 못 찾았다`)

- [ ] **Step 3: 머리 주석·CSS·몸통** — `gov-report.html`

(a) 머리 주석의 `       규칙 게시 전에는 읽기·쓰기가 거절되어 읽기 전용으로 돈다(「기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인」).` 줄 다음에 더한다.

```html
     ★ 받은 서류함(2026-10-11, 설계 docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md) — 칸 창에 그 업체 «주소»로 오간
       첨부 메일 후보(메일함 거울 mailbox/* 머리글만 읽음). 「연결」은 위 줄 하나 .set 안의 link 한 칸 — 쓰는 곳은 여전히 하나.
       「열어 보기」는 서버 함수로 한 번에 한 건씩 받아 이 화면에서만 보고 버린다(저장·업로드·내려받기 없음).
```

(b) CSS — `.cw-b{display:flex;justify-content:flex-end;margin-top:10px}` 줄 다음에 더한다(새 색 없음 · 입력칸 없음).

```css
.ib{list-style:none;margin:6px 0 0;padding:0;max-height:320px;overflow:auto}
.ib>li{padding:6px 0;border-bottom:1px solid var(--line)}
.ib-h{font-size:12px;color:var(--mute)}
.ib-s{font-size:13px;margin:2px 0}
.ib-a{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;margin-top:3px}
.ib-a>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ib-l{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:13px;background:var(--blue-bg);border:1px solid var(--blue-line);border-radius:8px;padding:6px 8px;margin:4px 0}
.av-box{max-width:980px}
.av-stage{max-height:75vh;overflow:auto;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px;margin-top:8px}
.av-img,.av-pdf{display:block;max-width:100%;margin:0 auto;background:var(--card)}
.av-stage table{font-size:12px}
.av-stage td,.av-stage th{max-width:220px;overflow:hidden;text-overflow:ellipsis}
```

(c) `<div id="cellw" class="toc" style="display:none"></div>` 줄 다음에 더한다.

```html
<div id="attv" class="toc" style="display:none"></div>
```

- [ ] **Step 4: 스크립트** — 맨 아래 `<script>`

(a) `var GR_TRACK_NODES={docs:'scal_docs'};` 줄 다음에 더하고, `var GR={…};` 한 줄을 그 다음 것으로 바꾼다.

```js
/* 받은 서류함 — 메일함 거울(주인 푸른 메일)·업체관리를 빌려 읽는 자리. 칸 창을 처음 열 때 한 번(grLoadInbox)
   ⚠ 이름 표로 부른다 — 글자 그대로 ref('mailbox…')·ref('data/companies') 를 쓰지 않는다(화면 검사가 막는다) */
var GR_INBOX_NODES={folders:'mailbox/folders',msgs:'mailbox/msgs',cos:'data/companies'};
/* 서버 함수 자리(취업규칙 화면 MAIL_FN_BASE 와 같은 곳) · 폴더마다 읽을 최근 통 수 · 응답 기다림(ms, 지난 메일은 1분쯤) */
var GR_MAIL={fn:'https://asia-northeast3-pureun-erp.cloudfunctions.net/',per:3000,wait:180000};
```

```js
var GR={seq:0,dseq:0,rows:[],input:null,staffMap:{},index:null,indexErr:false,err:'',loaded:false,me:'',email:'',today:'',docs:{loaded:false,err:false},toc:null,tocMsg:'',tocFail:false,track:null,trackErr:false,tseq:0,saving:{},cw:null,inbox:{st:'',rows:[],cos:null,clipped:false},inboxP:null,iseq:0,av:null,avBusy:false,avMsg:'',avErr:false,f:{year:'',type:'',att:'',status:'',co:'',mine:false,biz:''}};
```

(`GR.f.att` 는 담당 거르개다 — 보기 창은 헷갈리지 않게 `GR.av` 로 부른다.)

(b) `function grOpenCell(coId,typeId,step){ … }` 전체를 다음으로 바꾼다(주석은 그대로 둔다).

```js
function grOpenCell(coId,typeId,step){
  var D=PuGovReportDocs, T=PuGovReportTrack, d=GR.docs||{};
  if(!GR.track||GR.trackErr) return;
  var p=D.pairs(GR.input,typeId,GR.f.year).filter(function(x){ return x.coId===coId; })[0];
  var erp=grErp(GR.f.biz);
  if(!p||!erp) return;
  var keys=T.keysFor(D.planFor(erp.name),step,Math.max(+p.rounds||0,+p.planned||0));
  if(!keys.length) return;
  var cons=D.consFor({consultings:d.cons,co:p.co,code:erp.code,typeId:typeId,tmap:d.tmap,biz:d.biz});
  GR.cw={coId:coId,coName:p.coName,typeId:typeId,rid:p.rid,step:step,keys:keys,key:keys[0].key,draft:null,msg:'',err:false,busy:false,
    win:PuGovReportInbox.windowOf(p.firstDate,p.lastDate),cons:cons,tech:D.planFor(erp.name).key==='techguard',cands:[]};
  GR.avMsg=''; GR.avErr=false;
  grRenderCell();
  grLoadInbox();
}
```

(c) `grRenderCell` 의 끝 두 줄

```js
    +'<div class="cw-b"><button type="button" onclick="grSaveCell()"'+(c.busy?' disabled':'')+'>저장</button></div></div>';
  el.innerHTML=h; el.style.display='';
```

을 다음으로 바꾼다(칸 창 맨 아래에 후보 자리 — 그 안은 grRenderInbox 만 그린다).

```js
    +'<div class="cw-b"><button type="button" onclick="grSaveCell()"'+(c.busy?' disabled':'')+'>저장</button></div><div id="cwInbox"></div></div>';
  el.innerHTML=h; el.style.display='';
  grRenderInbox();
```

(d) `grSaveCell` — 세 곳을 고친다.
- 주석 첫 줄 `/* 저장 — 그 줄 키 하나만 .set(scal_docs/{업체}/{rid}/items/{키}). update 는 저장 관문이 «부분 update» 로 막는다.` 다음에 한 줄 더한다:

```js
   op 없음(「저장」) = 옛 link 를 이어 받는다 · op.link 가 있으면 그것(「연결」) · op.link 가 null 이면 뺀다(「연결 지우기」) — 받은 서류함 2026-10-11.
```

- `async function grSaveCell(){` 를 `async function grSaveCell(op){` 로.
- `  c.draft=entry;` 줄 «앞»에 한 줄 더한다:

```js
  entry.link=T.nextLink(T.recOf(GR.track||{},c.coId,c.rid)[c.key]||null,op);
```

- `    c.busy=false; c.draft=null; c.msg='저장했습니다'; c.err=false;` 줄을 다음으로 바꾼다:

```js
    c.busy=false; c.draft=null; c.msg=!op?'저장했습니다':(op.link?'연결했습니다':'연결을 지웠습니다'); c.err=false;
```

(e) `/* 양식 서고 — 읽기만. 등록·바꾸기는 정부사업일정의 ⚙ 양식 서고(#forms, 관리자) */` 줄 «앞»에 더한다.

```js
/* ═══ 받은 서류함 — 칸 창 「📥 받은 서류 후보」·「연결」·「열어 보기」 (설계 docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md) ═══
   ★ 칸 창을 다시 그리지 않는다 — #cwInbox 만 고친다(적던 값 보존). 쓰기는 grSaveCell 한 곳뿐(link 를 실어 보낸다).
   ★ 열어 보기는 한 번에 하나(GR.avBusy) — 지난 메일 POP3 가 동시 호출에 막힌다. 받은 바이트는 지역 변수로만, 저장·업로드 없음. */

/* 메일함 거울(폴더 표 + 폴더마다 최근 GR_MAIL.per 통의 머리글)과 업체관리를 «한 번» 읽는다. 본문·첨부는 읽지 않는다.
   업체관리를 못 읽은 것은 실패로 치지 않는다(이알피 계약 연락처로만 찾는다). 폴더를 못 읽으면 칸 창 안에 다시 시도 */
function grLoadInbox(force){
  if(!force&&GR.inboxP) return GR.inboxP;
  var seq=++GR.iseq;
  GR.inbox={st:'loading',rows:[],cos:null,clipped:false}; grRenderInbox();
  GR.inboxP=grReadInbox(seq);
  return GR.inboxP;
}
async function grReadInbox(seq){
  var I=PuGovReportInbox, N=GR_INBOX_NODES;
  try{
    var got=await Promise.all([fbDb.ref(N.folders).once('value').then(function(s){ return s.val(); }),
      fbDb.ref(N.cos).once('value').then(function(s){ return s.val(); },function(e){ console.warn('[컨설팅보고서] 못 읽음 '+N.cos,e); return null; })]);
    var folders=got[0]||{}, slugs=I.boxesOf(folders);
    var boxes=await Promise.all(slugs.map(function(s){
      return fbDb.ref(N.msgs+'/'+s).orderByKey().limitToLast(GR_MAIL.per).once('value').then(function(x){ return x.val()||{}; });
    }));
    if(seq!==GR.iseq) return;
    var msgs={}, clipped=false;
    slugs.forEach(function(s,i){ msgs[s]=boxes[i]; if(Object.keys(boxes[i]).length>=GR_MAIL.per) clipped=true; });
    GR.inbox={st:'ok',rows:I.mailRows(folders,msgs),cos:got[1],clipped:clipped};
  }catch(e){
    if(seq!==GR.iseq) return;
    console.warn('[컨설팅보고서] 메일함 못 읽음',e);
    GR.inbox={st:'err',rows:[],cos:null,clipped:false}; GR.inboxP=null;
  }
  grRenderInbox();
}
function grRetryInbox(){ return grLoadInbox(true); }
/* 칸 창 안 후보 자리 — 연결된 서류 · 후보 줄(받음/보냄·날짜·제목·딱지·첨부마다 열어 보기/연결) · 안내 */
function grRenderInbox(){
  var I=PuGovReportInbox, T=PuGovReportTrack, c=GR.cw, el=$('cwInbox'), ib=GR.inbox||{};
  if(!el) return;
  if(!c){ el.innerHTML=''; return; }
  var rec=T.recOf(GR.track||{},c.coId,c.rid)[c.key]||null, lk=rec&&rec.link, busy=!!GR.avBusy;
  var h='<div class="cw-f"><span>📥 받은 서류 후보</span><div class="days">'+grEsc(I.MSG.NAME_NOTE)+'</div>';
  if(lk) h+='<div class="ib-l"><b>연결된 서류</b><span>'+grEsc(lk.name||'(이름 없음)')+(lk.date?' · '+grEsc(lk.date):'')+'</span>'
    +'<button type="button" class="act" onclick="grOpenLinked()"'+(busy?' disabled':'')+'>열어 보기</button>'
    +'<button type="button" class="act" onclick="grUnlink()"'+(c.busy?' disabled':'')+'>연결 지우기</button></div>';
  if(ib.st==='err') h+='<div class="err-s">'+grEsc(I.MSG.LOAD_FAIL)+'</div><button type="button" onclick="grRetryInbox()">다시 시도</button>';
  else if(ib.st!=='ok') h+='<div class="days">메일함을 불러오는 중…</div>';
  else{
    var r=I.candidates(ib.rows,{addrs:I.addrsFor({companies:ib.cos,cons:c.cons,name:c.coName}),win:c.win,tech:c.tech});
    c.cands=r.list;
    if(r.noAddr) h+='<div class="days">'+grEsc(I.MSG.NO_ADDR)+'</div>';
    else if(!r.list.length) h+='<div class="days">'+grEsc(I.MSG.NONE)+'</div>';
    else h+='<ul class="ib">'+r.list.map(function(m,i){
      var tags=I.badges(m).map(function(b){ return ' <span class="st st-'+b.key+'">'+grEsc(b.txt)+'</span>'; }).join('');
      var atts=m.atts.length?m.atts.map(function(a,j){
        return '<div class="ib-a"><span>📎 '+grEsc(a.name)+'</span>'+(m.priv?'':
          '<button type="button" class="act" onclick="grOpenCand('+i+','+j+')"'+(busy?' disabled':'')+(a.kind?'':' title="'+grEsc(I.MSG.CANT)+'"')+'>열어 보기</button>'
          +'<button type="button" class="act" onclick="grLinkCand('+i+','+j+')"'+(c.busy||!m.key?' disabled':'')+'>연결</button>')+'</div>';
      }).join(''):'<div class="days">첨부 '+grEsc(m.a)+'개 — 이름이 없어 메일함에서 받아 주세요</div>';
      return '<li><div class="ib-h">'+(m.out?'보냄 → ':'받음 ← ')+grEsc(m.who)+' · '+grEsc(m.day)+tags+'</div>'
        +'<div class="ib-s">'+grEsc(m.s||'(제목 없음)')+'</div>'+atts+'</li>';
    }).join('')+'</ul>'+(r.more?'<div class="days">'+grEsc(I.MSG.MORE)+'</div>':'');
    if(ib.clipped) h+='<div class="days">'+grEsc(I.MSG.CLIPPED)+'</div>';
  }
  if(GR.avMsg) h+='<div class="'+(GR.avErr?'err-s':'days')+'">'+grEsc(GR.avMsg)+'</div>';
  el.innerHTML=h+'</div>';
}
/* 「연결」 — 고른 후보의 첨부 하나를 지금 칸 창의 서류 줄에. 저장은 기존 한 곳(grSaveCell)이 칸 창 값과 함께 줄 하나 .set.
   규칙 게시 전에는 거절되어 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」(값은 그대로) */
function grLinkCand(i,j){
  var c=GR.cw, m=c&&c.cands?c.cands[i]:null, a=m?m.atts[j]:null;
  if(!m||!a||m.priv) return Promise.resolve();
  var lk=PuGovReportInbox.linkFrom(m,a.name);
  return lk?grSaveCell({link:lk}):Promise.resolve();
}
/* 「연결 지우기」 — link 만 뺀 줄을 같은 길로 다시 쓴다(서류 줄 상태는 칸 창 값 그대로) */
function grUnlink(){ return GR.cw?grSaveCell({link:null}):Promise.resolve(); }
/* 서버 부르기 — 취업규칙 화면과 같은 손(PuRulesMailOrig.makeCall: POST · Bearer 로그인 증표 · ok 가 아니면 status 를 단 오류).
   GR_MAIL.wait 안에 답이 없으면 TimeoutError(「메일 서버 응답이 없습니다」) */
function grMailFetch(url,init){
  return new Promise(function(ok,no){
    var t=setTimeout(function(){ var e=new Error('응답이 없습니다'); e.name='TimeoutError'; no(e); },GR_MAIL.wait);
    fetch(url,init).then(function(r){ clearTimeout(t); ok(r); },function(e){ clearTimeout(t); no(e); });
  });
}
function grMailCall(){
  return PuRulesMailOrig.makeCall({base:GR_MAIL.fn,fetch:grMailFetch,getToken:function(){
    var u=firebase.auth().currentUser;
    if(!u){ var e=new Error('로그인이 필요합니다'); e.status=401; throw e; }
    return u.getIdToken();
  }});
}
/* 「열어 보기」 — 후보 줄의 첨부 / 연결된 서류. 개인 자료는 열지 않는다 */
function grOpenCand(i,j){
  var c=GR.cw, m=c&&c.cands?c.cands[i]:null, a=m?m.atts[j]:null;
  if(!m||!a||m.priv) return Promise.resolve({ok:false});
  return grOpenAtt({kind:'imap',slug:m.slug,uid:m.uid},a.name);
}
function grOpenLinked(){
  var c=GR.cw, rec=c?PuGovReportTrack.recOf(GR.track||{},c.coId,c.rid)[c.key]:null, lk=rec&&rec.link;
  if(!lk) return Promise.resolve({ok:false});
  return grOpenAtt(PuGovReportInbox.linkKey.parse(lk.key),lk.name||'');
}
/* 한 건 받아 연다 — 한 번에 하나(GR.avBusy). 실패해도 칸 창은 그대로, 안내는 #cwInbox 에만.
   창이 닫혀 취소된 것(e.cancelled — 한글 미리보기)은 실패가 아니다 */
async function grOpenAtt(ref,name){
  var I=PuGovReportInbox, kind=I.kindOf(name);
  var say=function(m,bad){ GR.avMsg=m; GR.avErr=!!bad; grRenderInbox(); };
  if(GR.avBusy) return {ok:false,busy:true};
  if(!ref||!name){ say(I.MSG.GONE,true); return {ok:false}; }
  if(!kind){ say(I.MSG.CANT,true); return {ok:false}; }
  if(kind==='hwp'&&!window.PuHwpPreview){ say('한글 미리보기를 불러오지 못했습니다 — 새로 고친 뒤 다시 눌러 주세요',true); return {ok:false}; }
  GR.avBusy=true; say(ref.kind==='pop'?I.MSG.WAIT_OLD:I.MSG.WAIT);
  try{
    var got=await I.fetchAtt({call:grMailCall(),ref:ref,name:name});
    await grShowAtt(kind,PuRulesMailOrig.b64ToBytes(got.b64),name);
    GR.avBusy=false; say('열었습니다 — '+name);
    return {ok:true};
  }catch(e){
    GR.avBusy=false;
    if(e&&e.cancelled){ say(''); return {ok:false,cancelled:true}; }
    console.warn('[컨설팅보고서] 받은 서류 열기 실패',e);
    say(I.errText(e),true);
    return {ok:false};
  }
}
/* 판독기를 «그때» 저장소 vendor/ 에서 싣는다 — 화면을 열 때 싣지 않는다 */
function grLib(src,ready){
  if(ready()) return Promise.resolve();
  return new Promise(function(ok,no){
    var s=document.createElement('script'); s.src=src;
    s.onload=function(){ if(ready()) ok(); else no(new Error('판독기를 쓸 수 없습니다')); };
    s.onerror=function(){ no(new Error('판독기를 불러오지 못했습니다')); };
    document.head.appendChild(s);
  });
}
/* 받은 바이트를 보여 준다 — 한글은 한글 미리보기 창, PDF 는 캔버스 그림(스크립트가 돌지 않게), 그림은 확장자로 정한 종류의 blob, 표는 첫 시트 앞 줄 */
async function grShowAtt(kind,bytes,name){
  var I=PuGovReportInbox;
  if(kind==='hwp'){ await window.PuHwpPreview.open(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),name); return; }
  grCloseAv();
  var a={kind:kind,name:name,url:'',pdf:null,page:1,pages:0,grid:null,sheet:'',sheets:0};
  if(kind==='img') a.url=URL.createObjectURL(new Blob([bytes],{type:I.imgType(name)}));
  else if(kind==='pdf'){
    await grLib('vendor/pdf.min.js?v=1',function(){ return !!window.pdfjsLib; });
    try{ window.pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js?v=1'; }catch(e){}
    a.pdf=await window.pdfjsLib.getDocument({data:bytes,isEvalSupported:false}).promise;
    a.pages=Number(a.pdf.numPages||1);
  }else{
    await grLib('vendor/xlsx.full.min.js?v=1',function(){ return !!window.XLSX; });
    var wb=window.XLSX.read(bytes,{type:'array'}), sh=wb.Sheets[wb.SheetNames[0]];
    a.grid=window.XLSX.utils.sheet_to_json(sh,{header:1,defval:''}).slice(0,I.SHEET_ROWS);
    a.sheet=String(wb.SheetNames[0]||''); a.sheets=wb.SheetNames.length;
  }
  GR.av=a; grRenderAv();
}
function grRenderAv(){
  var a=GR.av, el=$('attv');
  if(!a){ el.style.display='none'; el.innerHTML=''; return; }
  var stage;
  if(a.kind==='img') stage='<img class="av-img" src="'+grEsc(a.url)+'" alt="'+grEsc(a.name)+'">';
  else if(a.kind==='pdf') stage='<canvas id="avCanvas" class="av-pdf"></canvas>';
  else stage='<table>'+(a.grid||[]).map(function(r,ri){
    return '<tr>'+(r||[]).slice(0,40).map(function(x){ var t=ri?'td':'th'; return '<'+t+'>'+grEsc(String(x==null?'':x).slice(0,120))+'</'+t+'>'; }).join('')+'</tr>';
  }).join('')+'</table>';
  var pager=(a.kind==='pdf'&&a.pages>1)?'<button type="button" onclick="grPdfPage(-1)"'+(a.page<=1?' disabled':'')+'>◀</button> <b>'+a.page+'</b> / '+a.pages
    +' <button type="button" onclick="grPdfPage(1)"'+(a.page>=a.pages?' disabled':'')+'>▶</button>':'';
  var sub=(a.kind==='xls'&&a.sheets>1)?' · 「'+grEsc(a.sheet)+'」 등 '+a.sheets+'장 중 첫 장':'';
  el.innerHTML='<div class="toc-box av-box" role="dialog" aria-label="받은 서류 보기">'
    +'<div class="toc-top"><b>👁 '+grEsc(a.name)+'</b><span class="days">'+sub+'</span><span class="sp"></span>'+pager
    +'<button type="button" data-close onclick="grCloseAv()">닫기</button></div>'
    +'<div class="av-stage">'+stage+'</div>'
    +'<div class="days">받은 파일은 이 화면에서만 봅니다 — 저장·올리기를 하지 않고, 닫으면 버립니다</div></div>';
  el.style.display='';
  if(a.kind==='pdf') setTimeout(grPdfDraw,0);
}
/* PDF 한 쪽을 캔버스에 — 그린 «뒤»에 부른다. 그사이 창이 바뀌었으면 그리지 않는다 */
function grPdfDraw(){
  var a=GR.av, cv=$('avCanvas');
  if(!a||a.kind!=='pdf'||!a.pdf||!cv||!cv.getContext) return Promise.resolve();
  var want=a.page;
  return a.pdf.getPage(want).then(function(pg){
    if(GR.av!==a||a.page!==want) return;
    var box=((cv.parentNode&&cv.parentNode.clientWidth)||900)-28, v0=pg.getViewport({scale:1});
    var vp=pg.getViewport({scale:Math.min(2.2,Math.max(0.5,box/(v0.width||600)))});
    cv.width=Math.floor(vp.width); cv.height=Math.floor(vp.height);
    return pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
  }).catch(function(e){ console.warn('[컨설팅보고서] PDF 쪽 그리기 실패',e); });
}
function grPdfPage(step){
  var a=GR.av;
  if(!a||!a.pages) return;
  var n=Math.min(a.pages,Math.max(1,a.page+step));
  if(n===a.page) return;
  a.page=n; grRenderAv();
}
/* 닫으면 그 파일은 사라진다 — blob 주소를 버리고 PDF 를 닫는다 */
function grCloseAv(){
  var a=GR.av; GR.av=null;
  if(a&&a.url){ try{ URL.revokeObjectURL(a.url); }catch(e){} }
  if(a&&a.pdf&&a.pdf.destroy){ try{ a.pdf.destroy(); }catch(e){} }
  grRenderAv();
}
```

(f) `grBoot` 의 `  $('cellw').addEventListener('click',function(e){ if(e.target===this) grCloseCell(); });` 줄 다음에 더한다.

```js
  $('attv').addEventListener('click',function(e){ if(e.target===this) grCloseAv(); });
```

- [ ] **Step 5: 통과 확인**

Run: `node --test tests/gov-report-app.test.js tests/gov-report-inbox.test.js tests/gov-report-track.test.js tests/gov-report-docs.test.js tests/gov-report-list.test.js tests/color-palette-apps.test.js tests/html-inline-script-syntax.test.js tests/back-button.test.js tests/phone-input-zoom.test.js tests/ontology-registry.test.js tests/ontology-write-gate.test.js tests/test-pin-guard.test.js tests/tests-no-local-path.test.js`
그리고: `node tests/shared-js-cache-version.test.js` · `node scripts/check-cache-version.js --all`
Expected: 모두 PASS(`gov-report-app` 은 앞 검사 + ㊲~㊽). `check-cache-version --all` 은 아무것도 안 찍는다(이 작업은 js 를 고치지 않았다). 정적 검사 「쓰기 명령은 grSaveCell 의 .set 하나뿐」이 그대로 통과해야 한다 — 실패하면 새 코드에 `.set(`·`.update(`·`.remove(`·`.transaction(` 이 들어간 것이다.

- [ ] **Step 6: 눈으로 확인(로그인 없이 되는 만큼)** — `gov-report.html` 을 file:// 로 열면 「file:// 로 열면 로그인할 수 없습니다」 잠금이 스크립트 오류 없이 보여야 한다. 콘솔에서 `PuGovReportInbox.MAX` 가 50, `PuRulesMailOrig.makeCall` 이 함수로 보인다. 실제 메일함 후보·열어 보기는 배포 뒤 로그인해서 본다(기록 「확인 필요」). 「연결」은 규칙 게시 전이라 거절되는 것이 맞다.

- [ ] **Step 7: 커밋** (PowerShell)

```powershell
git add gov-report.html tests/gov-report-app.test.js
git commit -m @'
feat(gov-report): 칸 창 「📥 받은 서류 후보」 — 연결은 같은 줄 하나 .set 안의 link · 열어 보기는 한 건씩

- 칸 창(③④⑤)을 처음 열 때 메일함 거울(mailbox/folders·msgs 머리글)과 업체관리를 한 번 읽어(GR_INBOX_NODES)
  그 업체 주소로 오간 첨부 메일 후보(기간 −30/+90일 · 50건 · 날짜 내림차순 · 개인 자료는 목록에만 · 기술보호 딱지)
- 「연결」·「연결 지우기」: grSaveCell 한 곳으로 줄 하나 .set(link 를 실어). 상태만 고친 저장도 link 를 이어 받는다.
  규칙 게시 전에는 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」(값 그대로), link 없는 저장은 그대로 된다
- 「열어 보기」: 서버 함수(readMailMessage peek → readMailAttachment / readOldMail)로 한 번에 한 건(GR.avBusy),
  한글은 한글 미리보기, PDF(캔버스·isEvalSupported:false)·그림(blob, 닫으면 버림)·표(첫 시트 200행)는 새 보기 창.
  판독기는 누를 때 vendor/ 에서. 받은 바이트는 저장·업로드·내려받기 없음. 실패 문구 다섯(칸 창은 그대로)
- 화면 검사 ㊲~㊽(가짜 메일 서버·가짜 pdf.js·xlsx)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

### Task 4: 기록 — STATUS.md · 상태 노트 · 전체 검사

**Files:**
- Modify: `STATUS.md` (「정부컨설팅 보고서 자동화」 덩어리, `- [ ] 한글 미리보기 확인 필요 — …` 줄 다음)
- Create: `status/2026-10-11-gov-report-inbox.md`

**Interfaces:**
- Consumes (T1~T3): 만든 것 이름(모듈·함수·문구)과 「게시 대기」 상태
- Produces: 다음 사람이 읽을 기록 — 「규칙 게시 승인 대기」 한 줄(게시 뒤 PENDING 비우기까지)

- [ ] **Step 1: STATUS.md** — `- [ ] 한글 미리보기 확인 필요 — 배포 뒤 실제 양식·받은 서명본(.hwp·.hwpx)으로 …` 줄 다음에 세 줄을 더한다.

```markdown
- [x] 컨설팅보고서 앱 받은 서류함(메일 첨부 후보·서류 줄 연결·열어 보기) — 구현 (PR 예정). 설계 `docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md` · 계획 `docs/superpowers/plans/2026-10-11-gov-report-inbox.md` · 노트 `status/2026-10-11-gov-report-inbox.md`. 칸 창(③④⑤) 「📥 받은 서류 후보」(그 업체 «주소»로 오간 첨부 메일 · 첫 회차 −30일~마지막 +90일 · 50건 · 개인 자료는 목록에만 · 기술보호 딱지) · 「연결」(scal_docs 줄 안 `link`, 쓰는 곳은 그대로 줄 하나 .set) · 「열어 보기」(서버에서 한 번에 한 건, 한글·PDF·그림·표, 저장·업로드 없음). 순수 모듈 `js/pu-gov-report-inbox.js`
- [ ] 받은 서류 연결 규칙 게시 대기 — `scal_docs` 줄의 `link` 가지(생성기·JSON 두 개만 고침, **게시 안 함**). 대표 승인 뒤 `scripts/rules-deploy.js` → 콘솔 원문 새 판 → `tests/photos-staff-share.test.js` PENDING 비우기. 그 전에는 「연결」만 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」(다른 저장은 그대로)
- [ ] 받은 서류함 확인 필요 — 배포 뒤 실제 업체로 후보가 맞는지(로그인·재직 직원 필요) · 기간 −30/+90일은 노무사 확인 사항 · 업체관리·계약에 주소가 없는 업체 수 · 지난 메일(POP3) 거울은 첨부 정보가 없어 후보에 안 나온다(2차) · 폴더마다 최근 3,000통만 읽는다(넘치면 안내)
```

- [ ] **Step 2: 상태 노트** — `status/2026-10-11-gov-report-inbox.md` (새)

```markdown
# 2026-10-11 · 컨설팅보고서 — 받은 서류함(메일 첨부 후보 · 서류 줄 연결 · 열어 보기)

설계 `docs/superpowers/specs/2026-10-11-gov-report-inbox-design.md` · 계획 `docs/superpowers/plans/2026-10-11-gov-report-inbox.md`

## 한 것

- 새 순수 모듈 `js/pu-gov-report-inbox.js`(`PuGovReportInbox`): 거울 줄 풀기(`mailRows`) · 주소 귀속(`addrsFor` — `PuCoThread.addrsOf`, 업체관리에 먼저 적힌 업체가 임자, 우리 주소 뺌) · 후보(`candidates` — 첨부 있음·기간·날짜 내림차순·50건) · 딱지(`badges` — 개인 자료는 `PuGovReportBuild.PRIV_RE` 그대로) · 연결 열쇠(`linkKey` — `i:<폴더>:<uid>` · `o:<popKey>`, 80자) · 첨부 받기 순서(`fetchAtt` — peek 목록 → 같은 이름 받기, 20MB 넘으면 안 받음) · 실패 문구(`errText`).
- `js/pu-gov-report-track.js`: 서류 줄의 `link` 가지(`normLink`·`nextLink`·`LINK_*`). 상태만 고치는 저장도 `link` 를 이어 받는다.
- 규칙 생성기 `scal_docs` 줄에 `link`(src·key 필수, 'mail', key 1~80, name ≤100, date 꼴). JSON 두 개 다시 만듦. **게시하지 않았다.**
- `gov-report.html` 칸 창: 「📥 받은 서류 후보」(칸 창을 처음 열 때 `mailbox/folders`·`mailbox/msgs`(폴더마다 최근 3,000통 머리글)·`data/companies` 를 한 번) · 「연결」/「연결 지우기」(기존 `grSaveCell` 한 곳) · 「열어 보기」(한 번에 하나, 한글은 `PuHwpPreview`, PDF·그림·표는 새 보기 창 `#attv`, 판독기는 누를 때 `vendor/`).
- 등록부 `govreport.sharedRoots` 에 `mailbox`·`data/companies`(쓰기 계약 그대로) · `pu-ontology.js` `?v` 올림.

## 왜

- 대표 지시(2026-10-11 「남은 일 순서대로 진행」) — 서명본·별첨이 메일로 오는데 서류 줄과 이어지지 않았다.
- 업체 귀속을 이름이 아니라 «주소»로 — 동명 업체 오연결을 막는다(`status/2026-10-05-mail-owner-erp-addr.md` 와 같은 규칙).

## 남긴 함정

- **규칙 게시 전에는 「연결」이 거절된다** — 줄의 `$other:false` 때문. 화면은 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」을 띄우고 값은 그대로다. 게시 뒤 `tests/photos-staff-share.test.js` 의 PENDING(`/scal_docs/$co/$rid/items/$key/link`)을 비운다.
- 설계서 §2 의 `pucards/mailbox/…` 는 실제로는 뿌리 `mailbox/…` 다(규칙 STAFF — 사번·재직 직원만). 읽기가 거절되면 칸 창 안에 「메일함을 불러오지 못했습니다」+다시 시도, 다른 칸 기능은 그대로.
- 지난 메일(POP3) 거울 `mailbox/old/msgs` 는 `a:0`·`an` 없음 — 후보가 될 수 없다. 열쇠 `o:` 는 열기만 지원한다(2차에서 거울에 첨부 이름이 생기면 후보로).
- 거울에 조각 번호가 없어 첨부는 «이름»으로 집는다. 같은 이름 첨부가 둘이면 첫 것이 열린다(지문 확인 없음 — `fetchOriginal` 의 sha 관문은 여기 없다).
- `readMailMessage`(peek)는 첨부 목록과 함께 본문도 돌려준다 — 화면은 받자마자 버린다(서버는 고치지 않았다).
- 폴더 slug 가 길어 열쇠가 80자를 넘으면 「연결」이 잠긴다(열어 보기는 된다).
- 받은 서류함은 칸 창을 다시 그리지 않는다(`#cwInbox` 만) — 적던 값이 날아가지 않게. 저장이 끝날 때만 칸 창 전체를 다시 그린다.
- 실제 메일·첨부는 가짜 서버로만 시험했다 — 배포 뒤 로그인해 확인해야 한다(STATUS 「확인 필요」).
```

- [ ] **Step 3: 전체 검사**

Run: `node --test "tests/**/*.test.js"`
Expected: 실패 0. (통과하는 검사 안의 `✖ 올리지 않았습니다 — 기준이 N일 된 것입니다` 줄은 날짜 잡음이다.) 그리고 `node scripts/check-cache-version.js --all` 이 아무것도 안 찍는다. 실패가 있으면 그 파일만 다시 돌려 까닭을 찾고, 이 계획의 파일이 원인이면 고친 뒤 해당 작업의 검사를 다시 돌린다.

- [ ] **Step 4: 커밋** (PowerShell)

```powershell
git add STATUS.md status/2026-10-11-gov-report-inbox.md
git commit -m @'
docs(gov-report): 받은 서류함 기록 — STATUS · 상태 노트 · 규칙 게시 승인 대기

- STATUS: 받은 서류함 구현 · scal_docs 줄 link 규칙 «게시 대기»(그 전엔 「연결」만 거절) · 배포 뒤 확인할 것
- status/2026-10-11-gov-report-inbox.md: 한 것 · 왜 · 남긴 함정(실제 거울 자리 mailbox/… · 지난 메일은 후보 아님 · 이름으로 집기)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
'@
```

---

## Self-Review (계획을 쓴 뒤 설계서와 맞춰 본 것)

| 설계서 | 맡은 곳 |
|---|---|
| §1 칸 창 ③④⑤ 「📥 받은 서류 후보」 · 기간 −30/+90 · 날짜 내림차순 · 보낸이(받음/보냄)·날짜·제목·첨부 이름·딱지 | T1 `windowOf`·`candidates`·`badges` · T3 `grRenderInbox` · ㊲ |
| §1 「연결」(사람이 눌러야만) · `by`·`at` 은 줄이 남긴다 | T1 `linkFrom`·`nextLink` · T3 `grLinkCand`→`grSaveCell` · ㊵ |
| §1 「열어 보기」 한 건씩 · 한글/PDF/그림/표 · 바이트 저장 안 함 | T1 `fetchAtt`·`kindOf` · T3 `grOpenAtt`·`grShowAtt`·`grCloseAv` · ㊷㊸㊹㊼ |
| §1 「연결 지우기」(link 만, 상태 그대로) | T3 `grUnlink` · ㊵ |
| §2 거울 머리글만 · 읽기 실패 문구+다시 시도 | T3 `grReadInbox`·`grRetryInbox` · ㊴ |
| §2 주소 귀속 · 먼저 등록된 업체 · 주소 없음 문구 | T1 `addrsFor` · ㊳ |
| §2 첨부 0 · 기간 밖 뺌 · PRIV 딱지·막기(PRIV_RE 가져다 쓰기) · 기술보호 딱지 · 50건·「50건만 보입니다」 | T1 검사 · ㊲㊳ |
| §3 `link` 꼴 · 규칙 · 게시 전 거절 문구 · 이어 받기 · `normRec`·`patchFor`·`validate`·`LINK_*`·`__proto__` 방어 | T1(기록 모듈) · T2(규칙·PENDING) · ㊶ · `linkKey` 의 `__proto__` 거절 |
| §4 서버 함수·Bearer · makeCall 가져다 쓰기 · 20MB · 동시 호출 금지 · 지난 메일 1분 안내 · 실패 문구 셋 | T1 `fetchAtt`·`errText` · T3 `grMailCall`·`grMailFetch` · ㊷㊸㊺ |
| §4 다운로드 안 함 · revokeObjectURL | T3 `grCloseAv` · ㊹㊼ |
| §5 개인정보 — 본문 안 읽음 · 파일 이름 안내 한 줄 · AI 없음 · 합성 이름 | `MSG.NAME_NOTE` · 검사 자료 example.com |
| §6 만들 것(모듈·검사·생성기·JSON·화면·등록부 `?v`·STATUS·노트) | T1~T4 |

- 빈칸 검사: 「TBD·나중에·알맞게」 없음. 모든 코드 단계에 실제 코드, 모든 실행 단계에 명령과 기대 결과.
- 이름 맞춤: `GR.av`(보기 창 — `GR.f.att` 와 헷갈리지 않게) · `grRenderAv`·`grCloseAv` · `GR.avBusy`·`GR.avMsg`·`GR.avErr` · `PuGovReportInbox.MSG.*` · `PuGovReportTrack.nextLink(prev, op)` 을 T1·T3·검사가 같은 이름으로 쓴다.
