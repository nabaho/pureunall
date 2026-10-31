# 컨설팅정산 앱 (PR ①) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 포털 «내부관리»에 `컨설팅정산`(pu-settle.html)을 더해, 비용지급 안내 엑셀을 읽고 사업장별 지급월 정산표·송금 목록·카톡 문구(복사)를 만들고 확정·기록한다.

**Architecture:** 계산·읽기·문구는 순수 모듈 `js/pu-settle-core.js`(브라우저·Node 겸용 UMD), 표 그리기는 `js/pu-settle-view.js`, 화면·저장은 `pu-settle.html`(전광판 `pu-signboard.html` 틀). 저장은 새 최상위 `settle/*` 에 공용 관문(`PuOntologyWrite.createGateway` enforce)으로만.

**Tech Stack:** 순수 JS(ES5 문법 + async), Firebase compat 9.23.0 RTDB, `vendor/xlsx.full.min.js`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-31-consult-settle-design.md` (PR ①은 §2~§6·§9·§10-1. 카톡 심부름꾼 §7 은 PR ②, 재무관리 §8 은 PR ③ — 따로 계획서)

## Global Constraints

- 공개 저장소 — 코드·검사·문서·status 에 실제 고객사명·사람 이름·요율을 쓰지 않는다. 지어낸 것만(가나상사·홍길동 등).
- 사번(sid)·로그인 이메일은 화면에 안 낸다 — 이름만(`data/user_dir` 로 바꿔 보인다).
- 모든 `js/` 참조에 `?v=N`. js 를 고치면 부르는 HTML 전부의 번호를 올린다(`node scripts/check-cache-version.js`).
- 표: 맨 왼쪽 ☐ + 번호, 한 칸 한 줄(`<br>` 금지, 넘치면 `…` + `title`), 폰(`@media (max-width:640px)`)에서 두 줄 카드, 입력칸 16px 이상, 27색 팔레트(`tests/color-palette-apps.test.js`).
- 노무 용어(급여→임금). 한국어 주석.
- 저장은 `gate.save(ref, fn(prev)→record, {entityType, expectedRevision?})` 만. 지우기 금지 — `_deleted` 표식.
- 볼 사람: `uid_roles/{uid}` 의 `isAdmin || isSubAdmin || fin === true` 이고 `status==='active'`·`sid` 있음. 아니면 잠금.
- 금액은 정수 원. 요율은 퍼센트 숫자(예 25 = 25%), 계산 때 만분율 정수 `Math.round(pct*100)`.
- 원천징수: 소득세 = `Math.floor(pre*3/1000)*10`, 지방소득세 = `Math.floor(inc/100)*10`.
- 2026년만: 업체 연결 후보는 `typeCode` 가 규칙의 사업 종류이고 수행기간(`startDate`~`endDate`)이 2026년에 걸친 `data/consultings` 만.

## Review Focus

1. 누적 안내 파일을 다음 달에 또 올림 → 같은 지급월이 다시 계산돼도 확정된 정산표는 덮이지 않고, 금액이 다르면 «바뀜» 딱지만 붙는다. (Task 1 `diffRun`, Task 3 저장 흐름)
2. 같은 사업장인데 주관·담당이 서로 다른 달에 입금 → 그 달 0원인 명단 사람도 0원 줄로 들어가고, 두 달 정산액의 합이 «합친 한 번 정산»과 끝수 범위 안에서 같다. (Task 1 검사)
3. 확정을 풀면 그 달에 붙었던 이월·조정이 «안 붙음»으로 돌아가고 송금 «보냄» 표시가 사라진다 — 반쯤 풀린 상태가 남지 않는다(한 번에 저장). (Task 1 `unapplyAdjusts`, Task 3)
4. 업체·사람 이름 표기가 조금 다름(괄호·공백·`\xa0`) → 이름으로 자동 확정하지 않고 «후보»로만 보이며, 한 번 확정한 연결은 다음 파일에서 저절로 쓰인다. (Task 1 `linkKey`, Task 3)
5. 읽을 수 없는 엑셀(머리줄·지급월 없음, 시트 비었음) → 아무것도 저장하지 않고 까닭을 보인다. (Task 1 `parseNotice` 실패 검사)

---

### Task 1: 계산 모듈 `js/pu-settle-core.js`

**Files:**
- Create: `js/pu-settle-core.js`
- Test: `tests/settle-core.test.js`

**Interfaces:**
- Produces (전역 `SettleCore` / `module.exports`):
  - `won(x) → number` 원 단위 반올림(숫자·쉼표 든 글자 받음, 못 읽으면 0)
  - `withholding(pre:number) → {inc, loc, total}`
  - `linkKey(text:string) → string` 앞뒤 공백 걷기, `\xa0`·연속 공백 → 공백 하나, RTDB 금지 글자 `. # $ [ ] /` → `_`
  - `monthKeyOf(label:string, receivedAt:number) → {key:'YYYY-MM', year, month} | null` (KST 기준, 받은 달보다 크면 전년)
  - `parseNotice(grid:any[][], merges:{s:{r,c},e:{r,c}}[], meta:{fileName, receivedAt}) → {ok:true, months:[{key,label,col}], rows:[{line, name, company, totalPre, amounts:{[key]:number}}]} | {ok:false, error:string}`
  - `settleMonth(notice, monthKey, rule, ctx) → {sites:Site[], issues:string[]}`
    - `rule = {typeCode, title, mode:'pool', leadSid, rates:{[sid]:pct}, siteRates:{[consultingId]:{[sid]:pct}}}`
    - `ctx = {companyLinks:{[linkKey]:{consultingId, companyId}}, personLinks:{[linkKey]:sid}, actuals:{[consultingId+'|'+sid]:number}, adjusts:[{id, consultingId, sid, amount, memo}], names:{[sid]:name}}`
    - `Site = {company, key, consultingId, companyId, round, members:Member[], totalNet, issues:string[]}`
    - `Member = {name, sid, role:'lead'|'staff', pre, inc, loc, net, actual, used, rate, share, diff, adjust, adjustIds:string[], settle, final}`
  - `transfersOf(sites, leadSid) → [{consultingId, company, fromSid, toSid, amount}]`
  - `checkRun(sites) → {ok:boolean, issues:string[]}`
  - `runId(typeCode, monthKey) → string` (`typeCode+'_'+monthKey`)
  - `diffRun(oldSites, newSites) → boolean` (사람별 세전·실입금이 달라졌는가)
  - `appliedAdjustIds(sites) → string[]` · `unapplyAdjusts(adjusts:{[id]:Adjust}, runId) → string[]`(그 정산표에 붙었던 id 목록)
  - `buildMessages(run:{label, sites}, rule, names) → [{sid, name, text}]`
  - `noticeHash(rows) → string`(같은 내용 다시 올림 막기 — 줄 내용 정렬 후 간단 해시)

- [ ] **Step 1: 실패하는 검사를 쓴다** — `tests/settle-core.test.js` (`node:test` + `assert/strict`, `require('../js/pu-settle-core.js')`). 지어낸 자료: 주관 sid `T-LEAD`(홍길동), 담당 `T-A`(김가나) 25%, `T-B`(이다라) 30%, 업체 `가나상사`·`다라산업`.

```js
test('원천징수는 10원 아래를 버린다', () => {
  assert.deepEqual(C.withholding(2568182), { inc: 77040, loc: 7700, total: 84740 });
  assert.deepEqual(C.withholding(977273), { inc: 29310, loc: 2930, total: 32240 });
});
test('원 단위 반올림', () => { assert.equal(C.won(2568181.818181818), 2568182); assert.equal(C.won('977,272.73'), 977273); assert.equal(C.won('—'), 0); });
test('지급월 열쇠 — 이름 앞 N월, 받은 달보다 크면 전년', () => {
  const t = Date.UTC(2026, 9, 31, 3); // 2026-10-31 KST
  assert.equal(C.monthKeyOf('9월 (10/2 지급)', t).key, '2026-09');
  assert.equal(C.monthKeyOf('12월', t).key, '2025-12');
  assert.equal(C.monthKeyOf('합계', t), null);
});
test('안내 파일 읽기 — 지급월 병합 칸·0원/빈 줄·합계 세전', () => { /* grid: 5행 머리(컨설턴트·기업명·합계(부가세 제외, 세전)·지급월 U5:W5), 6행 7월·9월 (10/2 지급)·10월, 이하 줄 */
  // months 키 ['2026-07','2026-09','2026-10'], 합계 0 인 줄은 totalPre 0, amounts 는 0 보다 큰 달만
});
test('읽지 못하는 파일은 ok:false', () => { assert.equal(C.parseNotice([['a','b']], [], {}).ok, false); });
test('pool — 1차분 사업장 하나', () => {
  // 가나상사: 홍길동 2,568,182 / 김가나 977,273 (10월)
  // 기대: totalNet 3,428,475 · 김가나 share 857,118 · diff/settle -87,915 · final 857,118 · 홍길동 settle +87,915 · final 2,571,357
});
test('pool — 30% 담당, 정산액이 + 면 주관 → 담당', () => { /* 다라산업 같은 금액, T-B 30% → share 1,028,542, settle +83,509 */ });
test('그 달 0원인 명단 사람도 넣는다 — 두 달 합 = 한 번 정산(±10원)', () => {
  // 7월: 홍길동만 2,000,000, 8월: 김가나만 1,000,000 (둘 다 totalPre > 0)
  // 두 달 김가나 final 합 ≈ floor((net홍+net김)×25%) 차이 ≤ 10
});
test('명단에 없는 사람(합계 0·금액 없음)은 빠진다', () => {});
test('사업장별 예외 요율이 사람별 요율보다 먼저', () => {});
test('요율 없음·업체 연결 없음·사람 연결 없음은 issues 로', () => {});
test('실입금이 세후를 대신한다', () => { /* actuals['C-1|T-A']=945000 → used 945000, T 에 반영 */ });
test('이월·조정은 settle 에 더해지고 주관이 반대로 받는다, 합은 0', () => {});
test('송금 목록 방향', () => { /* settle<0 → from T-A to T-LEAD, >0 → from T-LEAD to T-B */ });
test('checkRun — 사업장 최종 합 = 세후 합, 정산액 합 0', () => {});
test('diffRun — 세전이 바뀌면 true', () => {});
test('문구 — 담당마다 한 통, 그 사람 사업장만, 금액 쉼표', () => {
  // msgs.length 2, T-A 글에 '가나상사'·'87,915' 있고 '다라산업' 없음, 첫 줄 '[<title> 10월 입금분 정산 안내]'
});
```
각 검사 본문은 위 주석의 숫자를 `assert.equal` 로 박는다(금액은 규칙 값이라 `// 검사고정-허용: 원천징수·요율 식의 결과` 를 같은 줄에 적는다 — `tests/test-pin-guard.test.js` 가 요구하면).

- [ ] **Step 2: 돌려서 실패를 본다**
Run: `node --test tests/settle-core.test.js`
Expected: FAIL — `Cannot find module '../js/pu-settle-core.js'`

- [ ] **Step 3: `js/pu-settle-core.js` 를 만든다** — UMD 머리는 `js/pu-signboard-core.js` 와 같은 꼴(`root.SettleCore`). 머리말 주석에 설계서 경로와 «순수 함수 — 화면·저장·네트워크 없음». 핵심 셈:

```
parseNotice: 머리줄 = 앞 20줄 안에서 trim 값이 '컨설턴트' 인 칸과 '기업명' 인 칸이 함께 있는 첫 줄(hr).
  합계열 = hr 또는 hr+1 줄에서 /합계/ 와 /세전/ 이 함께 든 칸. 지급월 = hr 줄에서 trim '지급월' 칸 → 그 칸에서 시작하는 merge 범위의 열들(없으면 그 열 하나),
  각 열 이름 = hr+1 줄 값. monthKeyOf 가 null 인 열은 버린다. 남은 지급월이 0개면 ok:false('지급월 열을 찾지 못했습니다').
  줄 = hr+2 부터, 이름·업체 둘 다 비면 건너뛰고 빈 줄 3번 연속이면 끝. amounts 는 won 값 > 0 인 달만.
settleMonth: notice.rows 를 linkKey(company) 로 묶는다. 사업장 명단 = totalPre>0 또는 amounts 가 하나라도 있는 줄.
  그 달 명단 누구도 금액이 없으면 그 사업장은 빼고, 있으면 명단 전원을 그 달 금액(없으면 0)으로 넣는다.
  주관 = personLinks 로 찾은 sid 가 rule.leadSid 인 줄. 없으면 {name:names[leadSid]||'주관', sid:leadSid, pre:0} 줄을 더한다.
  round = 그 달보다 앞선 notice.months 에 그 사업장 누군가의 금액이 있으면 2, 아니면 1.
  rate = siteRates[consultingId][sid] ?? rates[sid]. share = Math.floor(T*Math.round(rate*100)/10000).
```

- [ ] **Step 4: 돌려서 통과를 본다**
Run: `node --test tests/settle-core.test.js`
Expected: PASS (검사 전부)

- [ ] **Step 5: 커밋**
```bash
git add js/pu-settle-core.js tests/settle-core.test.js
git commit -m "feat(컨설팅정산): 계산 모듈 — 안내 파일 읽기·지급월 pool 정산·송금·문구"
```

### Task 2: 표 그리기 `js/pu-settle-view.js`

**Files:**
- Create: `js/pu-settle-view.js`
- Test: `tests/settle-view.test.js`

**Interfaces:**
- Consumes: Task 1 의 `Site`·`Member`·`transfersOf` 결과, `SettleCore.won` 등
- Produces (전역 `SettleView`): 모두 HTML 글자를 돌려준다(이름·업체는 `esc` 로 막는다). 표에는 `data-name`, 칸에는 `data-k`(폰 카드용).
  - `runsTable(runs:Run[], sel:{[id]:1}) → string` — ☐·№·지급월·사업 종류·사업장 수·상태·송금 남은 건
  - `runDetail(run:Run, names) → string` — 숫자 상자 넷 + 사업장 묶음 표(☐·№·사업장·구분·이름·세전·원천징수·세후·실입금 입력칸 `data-actual="<consultingId>|<sid>"`·요율·몫·차액·조정·정산액·최종) + 송금 목록(☐ `data-paid="<i>"`)
  - `noticesTable(notices, sel) → string` · `linkBox(unlinked:{companies:[{key,text,candidates:[{consultingId, companyId, label}]}], people:[{key,text,candidates:[{sid,label}]}]}) → string`
  - `rulesBox(rules, bizTypes, names) → string` · `adjustsTable(adjusts, names, sel) → string`
  - `messagesBox(msgs:[{sid,name,text}]) → string` — 사람마다 글 상자 + «복사» 단추 `data-copy="<i>"`
  - `STATUS_KO = {draft:'계산만', confirmed:'확정', manual:'기록만'}`
  - `Run = {id, typeCode, monthKey, label, status, sites, transfers:[{...,paid, paidAt, paidBy}], changed, noticeId}`

- [ ] **Step 1: 실패하는 검사** — `tests/settle-view.test.js`: 지어낸 Run 하나로
  - `runsTable` 결과의 첫 `<th>` 가 고르기 칸(`input[data-all]`), 둘째가 번호
  - `runDetail` 에 `<br` 가 없다(한 칸 한 줄)
  - 이름 `<b>홍길동</b>` 이 `&lt;b&gt;` 로 막힌다
  - 사번 `T-LEAD` 글자가 결과 화면 글자(`>…<` 사이)에 없다
  - 정산액 음수가 `−87,915` 꼴(쉼표, 빼기표)
- [ ] **Step 2:** `node --test tests/settle-view.test.js` → FAIL(모듈 없음)
- [ ] **Step 3:** `js/pu-settle-view.js` 를 만든다 — `js/pu-signboard-view.js` 의 `esc`·표 꼴을 따른다. 금액 쓰기 `fmt(n)` = 쉼표 + 음수는 `−`.
- [ ] **Step 4:** `node --test tests/settle-view.test.js` → PASS
- [ ] **Step 5:** 커밋 `feat(컨설팅정산): 표 그리기 모듈`

### Task 3: 화면 `pu-settle.html`

**Files:**
- Create: `pu-settle.html`
- Test: `tests/settle-html.test.js` (꼴은 `tests/signboard-html.test.js`)

**Interfaces:**
- Consumes: `SettleCore`(Task 1), `SettleView`(Task 2), `XLSX`(`vendor/xlsx.full.min.js?v=1`), `PuOntologyWrite`, `PuGate`, `PuWhoami`, `PuBack`
- Produces: 저장 자리와 개체 종류(Task 4 의 온톨로지 writeContracts 와 같아야 한다)
  - `settle/rules/{typeCode}` → `SettleRule` · `settle/links/company/{key}`·`settle/links/person/{key}` → `SettleLink`
  - `settle/notices/{id}` → `SettleNotice` · `settle/runs/{id}` → `SettleRun` · `settle/adjusts/{id}` → `SettleAdjust`

- [ ] **Step 1: 실패하는 검사** — `tests/settle-html.test.js` 가 파일을 읽어 본다:
  - 스크립트 순서가 전광판과 같다(pu-sid-guard → firebase 9.23.0 app·auth·database → pu-ontology → pu-ls-guard → pu-ontology-write → pu-gate → pu-appbar → pu-whoami → pu-back → xlsx → pu-settle-core → pu-settle-view), 모든 `js/` 에 `?v=`
  - `createGateway({ mode:'enforce'` 가 있고, `.set(`·`.update(`·`.remove(` 를 `settle/` 에 직접 쓰지 않는다
  - 잠금 판정 함수 `canOpen(role)` 를 떠서 돌린다: `{status:'active',sid:'X',fin:true}` → true, `{status:'active',sid:'X',isAdmin:true}` → true, `{status:'active',sid:'X'}` → false, `{status:'left',sid:'X',fin:true}` → false
  - 탭 넷 `data-tab="runs|notices|rules|msgs"` 이 한 줄(`.tabs` 폰 구간 `nowrap`)
  - 입력칸 폰 16px(`@media (max-width:768px){ input,select,textarea{font-size:16px} }`)
- [ ] **Step 2:** `node --test tests/settle-html.test.js` → FAIL(파일 없음)
- [ ] **Step 3:** `pu-settle.html` 을 만든다 — `pu-signboard.html` 의 머리·색 변수·폰 구간·boot/lock 틀을 그대로 옮기고 이 앱 몫만 바꾼다:
  - 머리 `🧾 컨설팅정산`, 탭: `🧮 정산` · `📥 안내 파일` · `⚙️ 규칙·요율` · `💬 카톡 문구`
  - 읽기(`reload`): `settle/rules`·`links`·`notices`·`runs`·`adjusts`, `data/user_dir`(이름), `data/biz_cons_types`(사업 이름), `data/consultings`(업체 연결 후보 — 2026년 필터). `data/*` 는 `{v, u}` 꼴이면 `v` 를 쓴다(전광판 `loadNames` 와 같은 풀기).
  - 안내 올리기: 끌어 놓기/파일 고르기 → `XLSX.read(buf,{type:'array'})` 첫 시트 → `sheet_to_json(ws,{header:1,raw:true,defval:null})` + `ws['!merges']` → `SettleCore.parseNotice` → 실패면 까닭 토스트, 성공이면 `noticeHash` 가 같은 안내가 있으면 «이미 올린 파일», 아니면 `settle/notices/{id}` 저장(`expectedRevision:-1`, `source:'upload'`, `typeCode` 는 규칙 고르기 값).
  - 연결 확정: 안내 줄의 업체·사람 가운데 `links` 에 없는 것을 `linkBox` 로 보이고, 고른 값을 `settle/links/...` 에 저장. 후보는 이름이 비슷한 것을 위에 놓을 뿐 미리 골라 두지 않는다.
  - 정산표 만들기: 안내를 고르면 지급월마다 `runId` 로 찾아 — 없으면 `draft` 로 계산해 저장, `draft` 면 다시 계산해 덮기, `confirmed`/`manual` 이면 덮지 않고 `diffRun` 이 true 면 `changed:true` 만 저장.
  - «확정»: `checkRun` ok 일 때만. 정산표 `status:'confirmed'`·`confirmedAt/By`·`transfers` 와, 붙은 이월·조정의 `appliedRunId` 를 함께 저장(Review Focus 3 — 둘 다 성공해야 «확정됐습니다», 하나라도 실패하면 다시 불러와 알린다). «기록만»: `status:'manual'`(조정 안 붙임). «확정 풀기»: `status:'draft'`, `transfers` 의 `paid` 지움, `unapplyAdjusts` 의 id 들 `appliedRunId:null`.
  - 실입금 칸 바꿈 → `draft` 에서만, 정산표의 `actuals` 에 저장하고 다시 계산.
  - 송금 «보냄» ☐ → 그 줄 `paid/paidAt/paidBy` 저장.
  - 규칙·요율: 규칙 하나 편집 상자(사업 종류 고르기·주관 사람·사람별 요율·사업장 예외·제목·머리말·맺음말·켜짐). 요율 칸은 퍼센트 숫자.
  - 이월·조정: 목록 + 더하기(사업장·사람·금액·내용), 지우기는 `_deleted`.
  - 카톡 문구 탭: 확정된 정산표 고르기 → `buildMessages` → `messagesBox`, «복사»는 `navigator.clipboard.writeText`.
  - 엑셀 내려받기: 정산표를 `XLSX.utils.aoa_to_sheet` → `XLSX.writeFile(wb, '컨설팅정산_<label>.xlsx')`.
  - 잠금: `canOpen(role)` = `role.status==='active' && !!role.sid && (role.isAdmin===true || role.isSubAdmin===true || role.fin===true)`. 잠금 글 «재무관리 권한이 있는 분만 열 수 있습니다.»
- [ ] **Step 4:** `node --test tests/settle-html.test.js` → PASS
- [ ] **Step 5:** 커밋 `feat(컨설팅정산): 화면 — 안내 올리기·연결 확정·정산표·송금·규칙·이월·문구`

### Task 4: 포털 등록·온톨로지·점검 자료

**Files:**
- Modify: `enter.html`(APPS, `fin` 줄 아래), `js/pu-appbar.js`(APPS), `js/pu-ontology.js`(TERMS.entityTypes·PROGRAMS·READ_ADAPTERS), 이 js 를 싣는 모든 HTML 의 `?v=`
- Modify: `tests/color-palette-apps.test.js`(DONE `['pu-settle.html','컨설팅정산']`, EXCEPT `'pu-settle.html': new Set([])`)
- Create: `tools/phone-audit/seeds/settle.js`, `tests/settle-ontology.test.js`

**Interfaces:**
- Consumes: Task 3 의 저장 자리·개체 종류
- Produces:
  - APPS: `{ key:'settle', name:'컨설팅정산', desc:'개인입금 사업 정산', icon:'🧾', url:'pu-settle.html', roles:null, perm:'fin', row:'inside' }`
  - `PROGRAMS.settle = { name:'컨설팅정산', file:'pu-settle.html', primaryRoots:['settle'], sharedRoots:['uid_roles','data'], writeContracts:[{path:'settle/rules/{typeCode}',entityType:'SettleRule'},{path:'settle/links/{kind}/{key}',entityType:'SettleLink'},{path:'settle/notices/{id}',entityType:'SettleNotice'},{path:'settle/runs/{id}',entityType:'SettleRun'},{path:'settle/adjusts/{id}',entityType:'SettleAdjust'}], entityTypes:['SettleRule','SettleLink','SettleNotice','SettleRun','SettleAdjust'] }`
  - `READ_ADAPTERS.settle_core = { program:'settle', strategy:'in_app', path:'settle', parser:'coverage', gives:'…(앱 안에서만 — 통합 진단에서 읽지 않는다)' }`

- [ ] **Step 1: 실패하는 검사** — `tests/settle-ontology.test.js`: `PROGRAMS.settle` 이 있고 writeContracts 의 entityType 이 모두 `TERMS.entityTypes` 에 있다 · `pu-settle.html` 이 쓰는 `gate.save(...{entityType:'X'})` 의 X 가 모두 entityTypes 에 든다 · `enter.html` APPS 의 settle 이 `perm:'fin'`·`row:'inside'`.
- [ ] **Step 2:** `node --test tests/settle-ontology.test.js` → FAIL
- [ ] **Step 3:** 위 등록을 넣고 `node scripts/check-cache-version.js` 가 말하는 HTML 의 `?v=` 를 올린다. 점검 자료는 `tools/phone-audit/seeds/signboard.js` 꼴로 지어낸 규칙 1·안내 1·정산표 3(사업장 6·사람 12)·이월 2.
- [ ] **Step 4:** `node --test tests/settle-ontology.test.js tests/ontology-contract.test.js tests/shared-js-cache-version.test.js tests/color-palette-apps.test.js tests/phone-screen-rules.test.js` → PASS
- [ ] **Step 5:** 커밋 `feat(컨설팅정산): 포털 내부관리 타일·온톨로지 등록·폰 점검 자료`

### Task 5: 보안 규칙 `settle`

**Files:**
- Modify: `scripts/make-firebase-rules.js`(전광판 절 아래 새 절), `tests/perf-rules.test.js`(allowTop 에 `'settle' /* 컨설팅정산 — 관리자·위임관리인·재무권한 읽기·쓰기(지우기 금지), agent 는 서버 CLI 전용 2026-10-31 */`)
- Regenerate: `docs/firebase-rules-전체-적용본.json`(만들개 출력 그대로 — `tests/firebase-rules-apply.test.js`)
- Test: `tests/settle-rules.test.js`

**Interfaces:**
- Produces: `rules.settle = { '.read': SETTLE_R, rules:{$t:{'.write':W,'.validate':id===$t}}, links:{$kind:{$key:{'.write':W}}}, notices:{$id:{...}}, runs:{$id:{...}}, adjusts:{$id:{...}} }`
  - `SETTLE_R = LOGIN && (ADMIN || SUB || FIN)`, `W = SETTLE_R && newData.exists()`, 레코드 자리는 `newData.child('id').val() === $id`
  - `kakaoQueue`·`rooms`·`agent` 는 PR ② 에서 더한다(지금은 없음 — 기본 닫힘)

- [ ] **Step 1: 실패하는 검사** — `tests/settle-rules.test.js`: 만들개를 돌려 얻은 규칙에서 `settle['.read']` 에 FIN·ADMIN·SUB 가 다 들고, 모든 쓰기에 `newData.exists()` 가 들며, `settle` 아래 `.write` 가 최상위에 없다(자리별로만).
- [ ] **Step 2:** `node --test tests/settle-rules.test.js` → FAIL
- [ ] **Step 3:** 만들개에 절을 넣고 `node scripts/make-firebase-rules.js` 로 적용본을 다시 만든다.
- [ ] **Step 4:** `node --test tests/settle-rules.test.js tests/perf-rules.test.js tests/firebase-rules-apply.test.js tests/rules-data-named.test.js` → PASS
- [ ] **Step 5:** 커밋 `feat(컨설팅정산): 보안 규칙 settle — 재무 권한과 같은 사람만`
- [ ] **Step 6 (배포 — 대표 확인 뒤):** `node scripts/rules-deploy.js`(보여만 줌)로 새 것·바뀐 것·사라질 것을 보고 → 대표 «올려라» → `node scripts/rules-deploy.js --deploy`. 사라질 규칙이 있으면 멈추고 알린다.

### Task 6: 기록·전체 검사·PR

**Files:**
- Create: `status/2026-10-31-feat-consult-settle.md`
- Modify: `STATUS.md` 「2. 지금 손이 필요한 것」에 `### 대표 확인 대기 — 컨설팅정산 첫 자료 (2026-10-31)` 체크상자(요율·지난 달 기록만·규칙 게시)
- Commit: 설계서·이 계획서도 같은 가지에

- [ ] **Step 1:** `$env:PATH = "C:\Program Files\Git\bin;" + $env:PATH; node --test tests/*.test.js functions/*.test.js` → 실패 0 (실패가 있으면 origin/main 같은 시점과 견줘 내 것만 고친다)
- [ ] **Step 2:** `node tools/phone-audit/run.mjs settle` → 옆넘침 0·두 줄 단추 0·작은 입력칸 0, 갈무리 확인
- [ ] **Step 3:** 커밋 `docs(컨설팅정산): 설계서·계획서·상태 기록`
- [ ] **Step 4:** `git fetch origin; git rebase origin/main` → 충돌 나면 STATUS 는 둘 다 살리고 `?v=` 는 큰 번호로 → Step 1 다시
- [ ] **Step 5:** `git push -u origin feat/consult-settle` → `gh pr create --base main --title "feat(컨설팅정산): 내부관리 컨설팅정산 앱 — 개인입금 사업 지급월 정산 (PR ①)"` (본문: 무엇·검사·남은 일·규칙 게시 대기)
