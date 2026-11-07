# 사건 관할기관 «메일에서 가져오기» (A안) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사건 수정창의 «🏛️ 관할기관» 상자에서 푸른메일함의 공문 메일을 골라 기관·담당자·연락처·이메일 네 칸을 미리 채우고, 노무사가 💾 저장을 눌러야 반영되게 한다.

**Architecture:** 순수 함수 모듈 `js/pu-case-jur-mail.js`(메일 줄 모으기·노동 쪽 거르기·네 칸 뽑기·현재값과 견주기·합치기)와, `pu-erp.html` 의 `CaseJurMailPanel` 컴포넌트(메일함 거울을 한 번 읽고, 고른 메일 한 통의 본문만 기존 `readMailMessage` 로 받는다)로 나눈다. 서버 함수·보안규칙·새 DB 자리는 만들지 않는다.

**Tech Stack:** Preact(`h`, 단일 파일 `pu-erp.html`, 작업트리 CRLF), 브라우저·Node 겸용 순수 모듈, `node:test`, 기존 `js/rules-v2/mail-orig.js` 의 `makeCall`.

**Spec:** 대표 승인 목업 «A안»(2026-11-07, 저장소 밖 — 목업은 저장소에 두지 않는다) + 실측 메모 `gongmun-to-case-measure-2026-11-05`. 아래 «설계 요약»이 그 내용이다.

## 설계 요약 (대표가 «A안으로» 승인한 것)

- 위치: 사건 수정창 «🏛️ 관할기관» 상자 머리줄의 「📬 메일에서 가져오기」 단추 → 상자 안에서 펼쳐지는 고르기 패널.
- 패널: 최근 60일 받은 메일 목록(칩: 🏛️ 노동 쪽 / 📬 전체, 보낸 사람·제목 찾기) → 메일 한 통 고르면 네 칸을 뽑아 «출처 딱지»(본문·서명·보낸 주소·보낸 사람 이름·보낸 사람 표시)와 함께 보여 준다.
- 「이 값으로 채우기」는 **수정창 입력칸만** 채운다. 사건 기록은 💾 저장을 눌러야 바뀐다.
- 빈 칸 → 새 값으로 채움(기본). 이미 적힌 칸이 다르면 «현재 → 새 값» 으로 보이고 칸마다 「새 값 쓰기 / 그대로 두기」를 고른다(기본 그대로 두기). 같으면 건드리지 않는다.
- 못 찾은 칸은 비워 둔다 — 빈 값으로 기존 값을 덮지 않는다.

## Global Constraints

- AI 판독 없음 — 규칙(정규식)으로만 뽑는다.
- 서버 함수 새로 배포 안 함 · `scripts/make-firebase-rules.js` 변경 없음 · 새 RTDB 경로 없음. 읽는 자리는 `mailbox/folders`·`mailbox/msgs`(재직 직원 읽기, 기존 규칙)뿐.
- 메일 본문·첨부를 어디에도 저장하지 않는다. 사건에 들어가는 것은 네 칸뿐이다. 메일 위치(slug/uid)도 이번 판에서는 저장하지 않는다.
- 이름만 같다고 사건에 자동 연결하지 않는다 — 어느 메일인지는 사람이 고른다.
- 화면에 넣는 글은 Preact 텍스트로만(`dangerouslySetInnerHTML` 금지). 메일 html 은 글자로만 바꿔 쓴다.
- 표의 한 칸은 «한 줄» — 목록 줄은 한 줄 + `…` + `title` 에 전문.
- 색은 `CaseEditModal` 안에 이미 있는 색만 쓴다(27색 팔레트 밖 금지).
- 새 스크립트는 캐시 번호를 붙인다(`?v=1`). `pu-erp.html` 은 작업트리 CRLF — 고칠 때 한 줄 앵커를 쓴다.
- 검사는 «지금 값»이 아니라 «규칙»을 본다(`CLAUDE.md` 검사 규칙). 합성 자료만 쓴다 — 실제 기관 직원 이름·번호 금지.
- `pu-erp.html` 을 읽는 검사는 `assert.match` 대신 `assert.ok(re.test(src))` (실패 때 4MB 가 쏟아진다).

## Review Focus

- 본문이 html 만 있는 메일(`text` 가 빔) → html 을 글자로 바꿔 뽑는다. (Task 1 `extract`)
- 인용된 답장(`>` 줄 · 「Original Message」 아래)에 들어 있는 우리 사무소 전화·주소를 관할 연락처로 뽑지 않는다. (Task 1 `extract`)
- 보낸 주소가 noreply·자동발송이면 이메일 칸을 비운다. 팩스 번호를 전화로 뽑지 않는다. (Task 1 `extract`)
- 다음메일 400통 창 밖이라 본문을 못 열면(404) 보낸 사람 이름·주소만 채우고 까닭을 한 줄로 알린다 — 창은 멈추지 않는다. (Task 2)
- 메일함 읽기 실패(오프라인·권한)면 안내 한 줄만 — 사건 수정창은 그대로 쓸 수 있다. 입력 중이던 값은 «채우기» 전에는 안 바뀐다. (Task 2)

---

### Task 1: 순수 함수 모듈 `PuCaseJurMail`

**Files:**
- Create: `js/pu-case-jur-mail.js`
- Test: `tests/case-jur-mail.test.js`

**Interfaces:**
- Produces (`window.PuCaseJurMail` / `module.exports`):
  - `DAYS = 60`, `MAX_ROWS = 30`, `FIELDS = ['org','officer','phone','email']`, `LABELS = {org:'기관', officer:'담당자', phone:'연락처', email:'이메일'}`
  - `mailRows(folders: object, msgs: object) -> Row[]` — `Row = {slug, uid, from, who, s, d, a}`; 받은 칸만(`kind` 가 inbox·archive·custom, `nomsg` 아님). 거울의 짧은 칸 `f`(보낸 사람 이름)·`e`(주소)·`s`(제목)·`d`(ms)·`a`(첨부 수). 번호가 촘촘해 배열로 돌아온 폴더도 읽는다(null 칸 건너뜀). 우리 주소(`@pureun.kr`) 발신은 뺀다.
  - `isLabor(row: Row) -> boolean` — 보낸 주소 도메인이 노동 직통(moel.go.kr·nlrc.go.kr·comwel.or.kr·kcomwel.or.kr·kosha.or.kr)이면 참. 정부 도메인(`*.go.kr`·korea.kr)은 이름·제목에 노동 낱말(노동·근로·고용·임금·체불·해고·진정·신고·산재·감독·조정·구제)이 있을 때만 참. 그 밖은 거짓.
  - `candidates(rows: Row[], o: {now:number, chip:'labor'|'all', query?:string, days?:number}) -> {list: Row[], total: number, more: boolean}` — `now - days일` 이후만, 날짜 내림차순(같으면 slug·uid 순), 칩이 labor 면 `isLabor` 만, `query` 는 보낸 사람·제목에 부분 일치(대소문자 무시), 최대 `MAX_ROWS`.
  - `htmlToText(html: string) -> string` — 태그 제거(`<br>`·`</p>`·`</tr>`·`</div>`·`</li>` 는 줄바꿈으로), `&nbsp; &amp; &lt; &gt; &quot; &#39;` 풀기, 연속 빈 줄 하나로.
  - `extract(m: {who:string, from:string, subject:string, text:string, html:string}) -> {org, officer, phone, email, src:{org,officer,phone,email}}` — 못 찾은 칸은 `''`, `src` 값은 `''|'본문'|'서명'|'보낸 주소'|'보낸 사람 이름'|'보낸 사람 표시'`.
  - `diff(cur: object, next: object) -> Array<{k, label, cur, next, state}>` — `state` 는 `'fill'`(현재 빔·새 값 있음) · `'same'`(견주어 같음: 전화는 숫자만, 이메일은 소문자, 나머지는 공백 정리) · `'change'`(둘 다 있고 다름) · `'miss'`(새 값 없음).
  - `merge(cur: object, next: object, picks?: {[k]: 'new'|'keep'}) -> object` — 기본 선택은 fill→`'new'`, change→`'keep'`. `cur` 의 네 칸 밖 키는 그대로 가져가고, 새 값이 빈 칸으로 기존 값을 덮지 않는다. `cur` 를 바꾸지 않고 새 객체를 돌려준다.

- [ ] **Step 1: Write the failing tests** — `tests/case-jur-mail.test.js` (합성 자료만)
  - `mailRows`: 받은·보관·손으로 만든 폴더만 나오고 sent·spam·trash·`nomsg` 는 안 나온다 / 배열로 온 폴더의 null 칸을 건너뛴다 / `@pureun.kr` 발신은 빠진다.
  - `isLabor`: `x@moel.go.kr` 참 · `x@korea.kr` 인데 제목에 「체불 진정」 참 · `x@korea.kr` 인데 제목 「행사 안내」 거짓 · `x@gmail.com` 거짓.
  - `candidates`: 61일 전 메일은 빠지고 59일 전은 든다(`days` 경계는 `DAYS` 상수 기준으로 계산) / 날짜 내림차순 / `chip:'all'` 은 노동 아닌 메일도 포함 / `query` 는 보낸 사람·제목 / 35통이면 `list.length === MAX_ROWS`, `more === true`.
  - `extract` 본문 단서: 「담당자 : 가나다」·전화 `041-123-4567`·기관 「천안고용노동지청」 가 본문 끝 서명에 있으면 `src` 가 `'서명'`, 본문 가운데에 있으면 `'본문'`.
  - `extract` 머리글 대체: 본문에 담당자 단서가 없고 보낸 사람 이름이 `가나다/천안지청` 꼴이면 `officer==='가나다'`(`src:'보낸 사람 이름'`), `org` 는 `천안지청`(`src:'보낸 사람 표시'`). 이메일은 늘 `from`(`src:'보낸 주소'`).
  - `extract` 거절: `from` 이 `noreply@…`·`no-reply@…`·`donotreply@…` 면 `email===''` / 팩스 줄(`팩스 041-123-4568`)의 번호는 전화가 아니다 / 인용(`> 푸른 041-000-0000`, 「-----Original Message-----」 아래)의 번호는 뽑지 않는다 / `text` 가 빈데 `html` 에만 단서가 있으면 뽑는다 / 보낸 사람 이름이 `고용노동부`·`근로개선과` 같은 부서꼴이면 담당자로 쓰지 않는다 / 아무 단서도 없으면 네 칸 모두 `''`(전화에 `0`·`-` 같은 채움 글자를 넣지 않는다).
  - `diff`/`merge`: fill·same·change·miss 네 상태 / 전화 `041-123-4567` 와 `0411234567` 는 `same` / `merge` 기본값은 change 를 안 쓴다 / `picks.officer==='new'` 면 쓴다 / 새 값이 빈 칸이 기존 값을 안 지운다 / `cur` 의 다른 키(`extra`)가 남는다 / `cur` 원본이 안 바뀐다.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/case-jur-mail.test.js`
Expected: FAIL — `Cannot find module '../js/pu-case-jur-mail.js'`

- [ ] **Step 3: Implement `js/pu-case-jur-mail.js`** — `js/pu-gov-report-inbox.js` 와 같은 겉틀(`(function(root){…})(globalThis|window)`, Node 겸용 `module.exports`, ES5 문법, 한국어 주석). 뽑는 순서: ① 인용 자르기(`>` 줄, `Original Message`·`원본 메일`·`wrote:` 아래 버림) → ② 서명 칸 = 남은 줄 중 끝의 비지 않은 15줄 → ③ 서명에서 먼저, 없으면 본문 전체에서 찾기. 담당자 = 「담당자·담당·근로감독관·조사관·심판관·주무관·사무관·감독관」 라벨 뒤 한글 2~4자. 전화 = 한국 전화번호 식(지역번호·휴대폰, `)`·`.`·공백 구분 허용)을 `0xx-xxx(x)-xxxx` 로 정규화, 「팩스·FAX·F.」가 든 줄은 제외, 「전화·연락처·TEL·☎·문의」 라벨 줄을 먼저. 기관 = `…지방고용노동청|…고용노동지청|…고용노동청|…지방노동위원회|…노동위원회|근로복지공단 …지사|…지청|…지사` 식. 머리글 대체는 `who` 에서 괄호·`/`·공백으로 쪼갠 첫 토큰이 한글 2~4자이고 부서 끝말(부·청·과·팀·국·실·처·센터·위원회·지청·공단·본부·지사)로 끝나지 않을 때만.

- [ ] **Step 4: Run to verify it passes**

Run: `node --test tests/case-jur-mail.test.js`
Expected: PASS (전부)

- [ ] **Step 5: Commit** (경로 지정 — `git commit -m … -- js/pu-case-jur-mail.js tests/case-jur-mail.test.js`, 커밋 뒤 `git show --stat HEAD` 로 내 파일만 들어갔는지 확인)

---

### Task 2: 관할기관 상자의 단추와 고르기 패널

**Files:**
- Modify: `pu-erp.html` — ① 스크립트 태그 둘(`js/pu-case-jur-mail.js?v=1`, 이미 없으면 `js/rules-v2/mail-orig.js?v=<그 파일의 현재 번호>`), ② 이름 표 `CASE_JUR_NODES`·`CASE_JUR_FN`, ③ `CaseJurMailPanel` 컴포넌트(`CaseEditModal` 바로 위), ④ `CaseEditModal` 의 «관할기관» 상자 머리줄에 단추와 패널 자리.
- Test: `tests/case-jur-mail-screen.test.js`

**Interfaces:**
- Consumes: Task 1 의 `PuCaseJurMail.*` · 기존 `fbDb`(전역) · `firebase.auth().currentUser.getIdToken()` · `PuRulesMailOrig.makeCall({base, getToken, fetch})`.
- Produces: `CaseJurMailPanel(props: {cur: judgment, onFill: (next: judgment) => void, onClose: () => void})` — `onFill` 은 `PuCaseJurMail.merge` 결과를 `CaseEditModal` 의 `setF(prev => ({...prev, judgment: next}))` 로 넘긴다. 사건 저장은 기존 `submit` 길 그대로.

- [ ] **Step 1: Write the failing screen test** — `tests/case-jur-mail-screen.test.js` (`pu-erp.html` 을 읽되 주석을 걷고 `assert.ok(re.test(src))` 만 쓴다)
  - 규칙 1: `CaseEditModal` 안에 `PuCaseJurMail` 을 쓰는 패널 컴포넌트가 걸려 있다(손잡이 이름이 아니라 «`CaseEditModal` 몸체에서 `CaseJurMailPanel` 을 부른다»).
  - 규칙 2: 메일함 자리는 글자 그대로 `ref('mailbox…')` 가 아니라 이름 표(`CASE_JUR_NODES`)로 부른다.
  - 규칙 3: 패널 안에서 `dangerouslySetInnerHTML` 을 쓰지 않는다.
  - 규칙 4: 패널은 `onFill` 만 부르고 사건 저장(`props.onSave`·`dbSet`·`dbPatch`)을 직접 부르지 않는다 — 저장은 💾 만.
  - 규칙 5: 읽기는 `readMailMessage` 에 `peek: true` 를 넘긴다(읽음 표시를 건드리지 않는다).
  - 규칙 6: `js/pu-case-jur-mail.js` 가 `pu-erp.html` 에 캐시 번호(`\?v=\d+`)와 함께 실려 있다.
  - 규칙 7: 목록 줄에 한 줄 규칙 — `whiteSpace:'nowrap'` 과 `textOverflow:'ellipsis'` 와 `title` 이 같은 줄 컴포넌트에 있다.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/case-jur-mail-screen.test.js`
Expected: FAIL (패널이 아직 없다)

- [ ] **Step 3: Implement `CaseJurMailPanel`** — 열릴 때 `mailbox/folders` 를 한 번 읽고, 받은 칸마다 `orderByChild('d').startAt(now - DAYS일)` 로 최근 60일 줄만 읽는다(인덱스 `d` 는 기존 규칙에 있다). 상태: `loading | ok | error(한 줄 안내)`. 칩·찾기 입력·목록(한 줄). 한 줄을 고르면 `readMailMessage({slug, uid, peek:true})` 로 본문을 받고 `extract` — 받기 실패(404 「최근 400통만」·네트워크)면 `text:''`, `html:''` 로 `extract` 해 머리글 대체만 쓰고 까닭을 한 줄로 보인다. 결과는 네 칸마다 `diff` 상태에 따라: fill 은 초록 칸, change 는 «현재 → 새 값» + 「새 값 쓰기 / 그대로 두기」 라디오, same·miss 는 흐리게. 「이 값으로 채우기」→ `onFill(merge(cur, next, picks))` 후 패널을 닫고 «입력칸만 채웠습니다 — 💾 저장을 눌러야 반영됩니다» 를 보인다. 같은 메일을 다시 고르면 다시 받지 않게 지역 변수로 한 번만 담는다(저장·업로드 없음).

- [ ] **Step 4: 단추 연결** — «관할기관» 상자 머리줄을 `display:flex; justify-content:space-between` 로 하고 오른쪽에 「📬 메일에서 가져오기」(눌러 열고 닫음). 패널은 상자 안, 입력칸 아래.

- [ ] **Step 5: Run to verify it passes**

Run: `node --test tests/case-jur-mail-screen.test.js tests/case-jur-mail.test.js`
Expected: PASS

- [ ] **Step 6: Commit** (경로 지정, 커밋 뒤 `git show --stat HEAD` 확인)

---

### Task 3: 화면에서 확인 · 전체 검사 · 기록 · PR

**Files:**
- Create: `status/2026-11-07-case-jur-mail.md` (먼저 `상태: 이어하기 대기` 로 시작해 일이 끝나면 `상태: 완료`)
- Modify: 없음(앱 줄은 `status/` 새 파일에만 적는다 — `STATUS.md` 표에 덧붙이지 않는다)

- [ ] **Step 1: 화면 확인** — 가짜 firebase 로 사건 수정창을 띄워(메모 `photos-harness-fake-firebase` 방식) PC 폭(1580px)과 폰 폭에서: ① 단추가 열고 닫는다 ② 노동 쪽 칩·전체 칩이 목록을 바꾼다 ③ 빈 사건은 초록 칸으로 채워진다 ④ 담당자가 다른 사건은 «현재 → 새 값» 이 보이고 기본이 «그대로 두기» ⑤ 채운 뒤 💾 전에는 사건 값이 안 바뀐다 ⑥ 본문을 못 열 때 한 줄 안내가 뜨고 창이 멈추지 않는다. 안 해 본 것은 보고에서 «안 해 봄»으로 적는다.

- [ ] **Step 2: 전체 검사** — 묶어 돌리면 깨지는 알려진 문제가 있으므로(메모 `local-full-suite-runner-flaky`·`full-test-run-windows-chunks`) 묶음으로 나눠 돌리고, `tests/test-pin-guard.test.js`·`tests/one-line-cells.test.js`·`tests/ontology-contract.test.js`·`tests/dev-tools-not-published.test.js`·사건 화면 검사(`tests/case-*.test.js`)를 반드시 포함한다. 실패하면 출력을 그대로 보고한다.

- [ ] **Step 3: 푸시 전** — `git fetch origin main` → `git rebase origin/main`(충돌이 여러 파일이면 «남이 같은 일을 했다»는 신호 — 합치기 전에 내 것이 필요한지부터) → 푸시 → PR(「사건 관할기관: 메일에서 가져오기」). 배포는 하지 않는다 — 합친 뒤 사이트가 푸시로 스스로 배포된다(함수·규칙 배포 없음).

- [ ] **Step 4: 기록** — `status/2026-11-07-case-jur-mail.md` 에 한 일·못 한 일·다음 일, 메모 `gongmun-to-case-measure-2026-11-05` 갱신.

## 이번 판에서 일부러 빼는 것 (대표에게 알림)

- 「보낸 주소를 이 사건 담당으로 기억」 — 지금 메일함은 사건의 관할 이메일 칸을 읽지 않아 저장만으로는 안 되고, 메일함 쪽 설정(`config/mailWork`)에 따로 써야 한다. 대표가 정하지 않은 항목이라 뺀다.
- PDF 첨부 안의 내용 읽기 — 브라우저 묶음에 PDF 부품이 없다.
- 도착할 때 서버가 미리 뽑아 두기 — 다음메일은 폴더마다 최근 400통만 열어 주므로 오래된 메일은 본문이 안 열린다(그때는 머리글만으로 채운다). 불편이 실제로 크면 다음 판에서 서버 쪽을 더한다.
