/* ══════ 🏛 국세청 «전체 훑기» — 4,000곳을 한 번에 (대표 지시 2026-09-13) ═══════════
   대표: 「전체 훑기」

   ■⚠⚠ 이것은 «밖으로 나가는 일»이다
   사업자등록번호가 국세청(공공데이터포털)으로 통째로 나간다. 되돌릴 수 없다.
   그래서 이 검사가 지키는 것은 «기능이 되나»보다 «무엇이 나가나·언제 나가나»가 먼저다.

   ★ 못 박는 것
     ①⚠⚠ **묻기 전에 «몇 개가 어디로» 나가는지 숫자로 말한다.** 「아니오」면 한 개도 안 나간다.
     ②⚠ **번호만 나간다.** 상호·대표자·연락처는 안 실어 보낸다.
     ③ **최근에 물어본 곳은 다시 안 묻는다** — 안 그러면 누를 때마다 4,000개가 또 나간다.
     ④ **한 번에 100개**(국세청 규격). 그보다 크게 묶으면 통째로 거절당한다.
     ⑤⚠⚠ **답을 «번호»로 맞춘다.** 차례(index)로 맞추면 하나만 어긋나도 **남의 회사
        상태가 이 회사에 앉는다.**
     ⑥ **쓰기는 200곳씩 한 통**으로 — 2026-08-16 대량 쓰기 사고가 한 장씩 쓴 값이다.
     ⑦ **그만둘 수 있고, 그때까지 받은 것은 남는다.** 그만두는 «단추»가 화면에 있어야 한다.
     ⑧ 한 묶음이 막혀도 나머지는 받는다. 못 받은 것은 **안 적는다**(물어본 척 안 한다).

   node --test tests/cards-co-nts-sweep.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

const 오늘 = '2026-09-13';
const CO = (key, bizno, o) => Object.assign({ key, name:key, bizno, extra:{} }, o || {});

/* 순수 로직을 통째로 떠서 «돌린다» */
function load(list) {
  const ctx = { console, Object, Array, String, Number, Math, Date, JSON, isNaN,
    esc: s => String(s == null ? '' : s),
    digits: s => String(s || '').replace(/\D/g, ''),
    todayYmd: () => 오늘,
    coList: () => list || [],
    BULK_PATCH_CHUNK: 200 };
  vm.createContext(ctx);
  vm.runInContext([
    /* ⚠ 줄 끝에 주석이 붙어 있다 — `;$` 로 찾으면 못 잡는다(한 번 헤맸다) */
    SRC.match(/^const NTS_CHUNK = [^\n]*$/m)[0].replace('const ', 'var '),
    SRC.match(/^const NTS_SKIP_DAYS = [^\n]*$/m)[0].replace('const ', 'var '),
    cutFn(SRC, 'function coVal('), cutFn(SRC, 'function coSmeDays('),
    cutFn(SRC, 'function coNtsWord('), cutFn(SRC, 'function coNtsCls('),
    cutFn(SRC, 'function coNtsTargets('), cutFn(SRC, 'function coNtsChunks('),
    cutFn(SRC, 'function coNtsMatch('), cutFn(SRC, 'function coNtsWrites('),
    cutFn(SRC, 'function coNtsBadList('), cutFn(SRC, 'function coNtsNeeds(')
  ].join('\n'), ctx);
  return ctx;
}

/* ── ③ 무엇을 훑나 ────────────────────────────────────────────────────── */

test('★★★ 사업자번호가 «없는» 곳은 훑지 않는다 — 물어볼 수가 없다', () => {
  const c = load([ CO('a',''), CO('b','1234'), CO('c','1348605772') ]);
  assert.deepEqual(Array.from(c.coNtsTargets(오늘)).map(x => x.key), ['c']);
});

test('★★★ 최근에 물어본 곳은 «다시 안 묻는다» — 누를 때마다 4,000개가 또 나가면 안 된다', () => {
  const c = load([ CO('갓물어봄','1348605772',{ extra:{ ntsAt:'2026-09-10' } }),
                   CO('오래됐다','2208612345',{ extra:{ ntsAt:'2026-01-01' } }),
                   CO('한번도','3128149225') ]);
  assert.deepEqual(Array.from(c.coNtsTargets(오늘)).map(x => x.key), ['오래됐다','한번도']);
});

test('★★ 딱 30일째면 «다시» 묻는다 — 한 달에 한 번이 이 잣대의 뜻이다', () => {
  const c = load([ CO('딱30일','1348605772',{ extra:{ ntsAt:'2026-08-14' } }) ]);
  assert.equal(c.coNtsTargets(오늘).length, 1);
});

test('★ 날짜를 «못 읽은» 것은 다시 묻는다 — 언제 물었는지 모르는 것은 안 물은 것과 같다', () => {
  const c = load([ CO('이상한날','1348605772',{ extra:{ ntsAt:'작년 언젠가' } }) ]);
  assert.equal(c.coNtsTargets(오늘).length, 1);
});

/* ── ④ 자르기 ────────────────────────────────────────────────────────── */

test('★★★ 한 번에 «100개»씩 자른다 — 국세청 규격이다', () => {
  const c = load();
  const many = []; for(let i = 0; i < 250; i++) many.push(CO('k'+i, '13486057'+String(i).padStart(2,'0')));
  const ch = Array.from(c.coNtsChunks(many)).map(x => x.length);
  assert.deepEqual(ch, [100, 100, 50], '★★★ 크게 묶으면 그 묶음이 통째로 거절당한다');
  assert.equal(c.NTS_CHUNK, 100);
});

test('★ 빈 목록이면 묶음도 없다 — 빈 통을 보내지 않는다', () => {
  const c = load();
  assert.equal(c.coNtsChunks([]).length, 0);
  assert.equal(c.coNtsChunks(null).length, 0);
});

/* ── ⑤ 답 맞추기 — 가장 위험한 자리 ──────────────────────────────────── */

test('★★★ 답을 «번호»로 맞춘다 — 차례로 맞추면 남의 상태가 이 회사에 앉는다', () => {
  const c = load();
  const chunk = [ CO('가','1348605772'), CO('나','2208612345'), CO('다','3128149225') ];
  /* 국세청이 차례를 «바꿔» 돌려줬다 */
  const rows = [ { b_no:'3128149225', b_stt:'폐업자' },
                 { b_no:'1348605772', b_stt:'계속사업자' } ];
  const got = Array.from(c.coNtsMatch(chunk, rows));
  assert.deepEqual(got.map(x => x.key + '=' + x.state).sort(),
    ['가=계속사업자','다=폐업자'],
    '★★★ 차례로 맞췄다면 「가=폐업자」가 되어 멀쩡한 거래처를 정리했을 것이다');
});

test('★★ 우리가 «안 물어본» 번호가 섞여 오면 버린다', () => {
  const c = load();
  const got = c.coNtsMatch([ CO('가','1348605772') ],
    [ { b_no:'9999999999', b_stt:'폐업자' } ]);
  assert.equal(got.length, 0, '★★ 남의 답을 우리 줄에 앉히면 안 된다');
});

test('★★ 같은 번호를 가진 줄이 둘이면 «둘 다» 받는다', () => {
  const c = load();
  const got = Array.from(c.coNtsMatch(
    [ CO('가','1348605772'), CO('나','1348605772') ],
    [ { b_no:'134-86-05772', b_stt:'휴업자' } ]));
  assert.deepEqual(got.map(x => x.key).sort(), ['가','나']);
  assert.equal(got[0].state, '휴업자', '★ 하이픈이 있어도 같은 번호다');
});

test('★★ 아무 말도 없는 답은 «안 담는다» — 「확인했는데 모른다」가 남으면 안 된다', () => {
  const c = load();
  assert.equal(c.coNtsMatch([ CO('가','1348605772') ],
    [ { b_no:'1348605772', b_stt:'', tax_type:'' } ]).length, 0);
});

/* ── ⑥ 쓰기 ──────────────────────────────────────────────────────────── */

test('★★★ 200곳씩 «한 통»으로 모아 쓴다 — 한 장씩 쓰면 2026-08-16 사고가 다시 난다', () => {
  const c = load();
  const hits = []; for(let i = 0; i < 450; i++) hits.push({ key:'k'+i, state:'계속사업자' });
  const ups = Array.from(c.coNtsWrites(hits, 오늘, 200));
  assert.deepEqual(ups.map(u => Object.keys(u).length), [400, 400, 100],
    '★★ 곳마다 두 칸(상태·확인일)이라 200곳이면 400칸이다');
});

test('★★★ 상태와 확인일을 «함께» 쓴다 — 날짜 없는 상태는 거짓말이 된다', () => {
  const c = load();
  const u = c.coNtsWrites([{ key:'k1', state:'폐업자' }], 오늘, 200)[0];
  assert.equal(u['coInfo/k1/ntsState'], '폐업자');
  assert.equal(u['coInfo/k1/ntsAt'], 오늘);
  assert.equal(Object.keys(u).length, 2, '★★ 딴 칸을 건드리지 않는다');
});

/* ── 결과 보기 ───────────────────────────────────────────────────────── */

test('★★★ 폐업·휴업만 추린다 — 계속사업자는 챙길 일이 없다', () => {
  const c = load([ CO('폐업','1','',{}), CO('휴업','2'), CO('계속','3'), CO('안물어봄','4') ]);
  c.coList = () => [ CO('폐업','1348605772',{ extra:{ ntsState:'폐업자', ntsAt:오늘 } }),
                     CO('휴업','2208612345',{ extra:{ ntsState:'휴업자', ntsAt:오늘 } }),
                     CO('계속','3128149225',{ extra:{ ntsState:'계속사업자', ntsAt:오늘 } }),
                     CO('안물어봄','4118612345') ];
  const got = Array.from(c.coNtsBadList()).map(x => x.name);
  assert.deepEqual(got, ['폐업','휴업'], '★★★ 폐업이 휴업보다 앞 — 급한 순이다');
});

test('★★ 띠·거르개가 «같은 잣대»(coNtsNeeds)를 본다', () => {
  const filt = cutFn(SRC, 'function coFilteredList(');
  assert.match(filt, /state\.coOnlyNtsBad && !skipTodo\) list = list\.filter\(o=>coNtsNeeds\(o\)\)/,
    '★★★ 거르개가 제 잣대를 따로 두면 「띠는 3곳인데 목록은 5곳」이 된다');
  assert.match(cutFn(SRC, 'function coNtsBadList('), /coNtsCls\(/);
  assert.match(cutFn(SRC, 'function coNtsNeeds('), /coNtsCls\(/);
});

test('★★ 띠를 목록 위에 «실제로» 내보내고, 0곳이면 안 띄운다', () => {
  assert.match(cutFn(SRC, 'function coListHtml('), /coNtsBarHtml\(\)/);
  assert.match(cutFn(SRC, 'function coNtsBarHtml('), /if\(!list\.length\) return '';/);
});

test('★★ 거르개 이름표가 있다 — 걸어 놓고 아무 말이 없으면 되돌릴 길도 안 보인다', () => {
  const lab = SRC.slice(SRC.indexOf('const CO_TODO_LABEL'), SRC.indexOf('function clearCoTodo'));
  assert.match(lab, /coOnlyNtsBad:/);
  assert.match(cutFn(SRC, 'function coFilters('), /k: 'coOnlyNtsBad'/);
});

/* ── ①②⑦⑧ 밖으로 나가는 일 ────────────────────────────────────────── */

/* ⚠⚠ 여기부터는 «실제로 돌린다». 글자로만 보면 `if(false && confirm(…))` 도 통과하고,
   「한 묶음 막히면 통째로 그만두기」도 안 걸린다 — 2026-09-13 이빨 확인에서 셋이 샜다. */
function 훑어보기(over) {
  const o = Object.assign({ 예스:true, 곳수:250, 막힐묶음:-1, 열쇠:'KEY123' }, over || {});
  const list = [];
  for(let i = 0; i < o.곳수; i++) list.push(CO('k'+i, String(1000000000 + i)));
  const calls = { asked:0, msg:'', fetched:[], wrote:[], toast:[] };
  const ctx = { console, Object, Array, String, Number, Math, Date, JSON, isNaN, Promise,
    esc: s => String(s == null ? '' : s),
    digits: s => String(s || '').replace(/\D/g, ''),
    todayYmd: () => 오늘,
    coList: () => list,
    BULK_PATCH_CHUNK: 200,
    PU_CFG: o.열쇠 ? { ntsKey:o.열쇠 } : {},
    confirm: (m) => { calls.asked++; calls.msg = String(m); return !!o.예스; },
    toast: (m) => calls.toast.push(String(m)),
    openCoNts: () => {}, coNtsRepaint: () => {},
    coListBust: () => {}, renderCoSoon: () => {},
    DB_ROOT: 'pucards',
    Store: { db: { ref: () => ({ update: (u) => { calls.wrote.push(u); return Promise.resolve(); } }) } },
    fetch: (url, init) => {
      const i = calls.fetched.length;
      calls.fetched.push({ url, body: init && init.body });
      if(i === o.막힐묶음) return Promise.resolve({ ok:false, status:503, json:() => Promise.resolve({}) });
      const nos = JSON.parse(init.body).b_no;
      return Promise.resolve({ ok:true, json: () => Promise.resolve({
        data: nos.map(n => ({ b_no:n, b_stt: n.slice(-1) === '0' ? '폐업자' : '계속사업자' })) }) });
    } };
  vm.createContext(ctx);
  vm.runInContext([
    SRC.match(/^const NTS_CHUNK = [^\n]*$/m)[0].replace('const ', 'var '),
    SRC.match(/^const NTS_SKIP_DAYS = [^\n]*$/m)[0].replace('const ', 'var '),
    SRC.match(/^const NTS_STATUS_URL = [^\n]*$/m)[0].replace('const ', 'var '),
    'var _coNtsStop = false, _coNtsRun = null;',
    cutFn(SRC, 'function coVal('), cutFn(SRC, 'function coSmeDays('),
    cutFn(SRC, 'function coNtsWord('), cutFn(SRC, 'function coNtsCls('),
    cutFn(SRC, 'function coNtsTargets('), cutFn(SRC, 'function coNtsChunks('),
    cutFn(SRC, 'function coNtsMatch('), cutFn(SRC, 'function coNtsWrites('),
    cutFn(SRC, 'function coNtsBadList('), cutFn(SRC, 'function coNtsBadCount('),
    /* ⚠ async 는 cutFn 이 떼어 버린다 — 도로 붙인다 */
    'async ' + cutFn(SRC, 'function coNtsSweepRun('),
    'async ' + cutFn(SRC, 'function coNtsSweepAsk(')
  ].join('\n'), ctx);
  return ctx.coNtsSweepAsk().then(() => calls);
}

test('★★★ ① 묻기 «전»에 몇 개가 어디로 나가는지 숫자로 말한다', async () => {
  const c = await 훑어보기({ 예스:false });
  assert.equal(c.asked, 1, '★★★ 묻지도 않고 4,000개를 내보내면 안 된다');
  assert.match(c.msg, /250곳/, '★★ 몇 개가 나가는지 안 말한다');
  assert.match(c.msg, /국세청\(공공데이터포털\)/, '★★ 어디로 가는지 안 말한다');
  assert.match(c.msg, /상호·대표자·연락처는 보내지 않습니다/, '★★ 무엇이 «안» 나가는지도 말한다');
  assert.match(c.msg, /최근 30일/, '★ 무엇을 뺐는지 안 말한다');
  assert.match(c.msg, /3번에 나눠/, '★ 몇 번에 나눠 가는지 안 말한다');
});

test('★★★ 「아니오」면 «한 개도» 안 나간다', async () => {
  const c = await 훑어보기({ 예스:false });
  assert.deepEqual(c.fetched, [], '★★★ 「아니오」라고 했는데 이미 나갔다면 되돌릴 수 없다');
  assert.deepEqual(c.wrote, []);
});

test('★★★ 「예」면 100개씩 나눠 묻고, 받은 것을 200곳씩 모아 쓴다', async () => {
  const c = await 훑어보기({ 곳수:250 });
  assert.equal(c.fetched.length, 3, '★★ 250곳이면 100·100·50 세 번이다');
  assert.deepEqual(c.fetched.map(f => JSON.parse(f.body).b_no.length), [100, 100, 50]);
  /* 250곳 × 2칸 = 500칸 → 400 + 100 */
  assert.deepEqual(c.wrote.map(u => Object.keys(u).length), [400, 100]);
});

test('★★★ ⑧ 한 묶음이 막혀도 «나머지는» 받는다 · 못 받은 것은 안 적는다', async () => {
  const c = await 훑어보기({ 곳수:250, 막힐묶음:1 });
  assert.equal(c.fetched.length, 3,
    '★★★ 하나 막혔다고 통째로 그만두면 4,000곳을 처음부터 다시 물어야 한다');
  /* 받은 것은 100+50=150곳 × 2칸 = 300칸 */
  const 칸수 = c.wrote.reduce((n, u) => n + Object.keys(u).length, 0);
  assert.equal(칸수, 300, '★★★ 못 받은 묶음까지 적으면 「물어본 척」이 된다');
  assert.ok(c.toast.some(t => /1묶음 못 받음/.test(t)), '★★ 못 받은 것을 말 안 하면 다 된 줄 안다');
});

test('★★ 열쇠가 없으면 묻지도 «않는다»', async () => {
  const c = await 훑어보기({ 열쇠:'' });
  assert.equal(c.asked, 0, '★★ 물어보고 나서 안 된다고 하면 헛수고를 시킨 것이다');
  assert.deepEqual(c.fetched, []);
  assert.ok(c.toast.some(t => /환경설정/.test(t)));
});

test('★★★ ② 번호만 나간다 — 상호·대표자를 밖으로 실어 보내지 않는다', () => {
  const fn = cutFn(SRC, 'function coNtsSweepRun(');
  assert.match(fn, /b_no: chunks\[i\]\.map\(o => digits\(o\.bizno \|\| ''\)\)/,
    '★★★ 줄을 통째로 보내면 상호·대표자가 함께 나간다');
  assert.ok(!/o\.name/.test(fn), '★★★ 상호가 나가는 자리가 있다');
});

test('★★★ ⑦ 그만둘 수 있고, «그만 단추»가 화면에 있다', () => {
  /* ⚠ 2026-09-13: 그만두는 함수를 만들어 놓고 «누를 자리»를 안 만들었다.
     「아무도 안 부르는 함수」 검사가 그 자리에서 잡았다. */
  assert.match(cutFn(SRC, 'function coNtsSweepRun('), /if\(_coNtsStop\) break;/,
    '★★ 그만 표를 안 보면 눌러도 계속 돈다');
  assert.match(cutFn(SRC, 'function coNtsHtml('), /coNtsSweepStop\(\)/,
    '★★★ 그만둘 «단추»가 없으면 그만둘 길이 아예 없다');
  assert.match(cutFn(SRC, 'function coNtsHtml('), /_coNtsRun/,
    '★★ 도는 동안 진행이 안 보이면 멈춘 줄 안다');
});

test('★★★ ⑧ 한 묶음이 막혀도 나머지는 받는다 · 못 받은 것은 «안 적는다»', () => {
  const fn = cutFn(SRC, 'function coNtsSweepRun(');
  assert.match(fn, /catch\(e\)\{[\s\S]*?실패\+\+;/,
    '★★★ 하나 막혔다고 통째로 그만두면 4,000곳을 다시 물어야 한다');
  /* 실패한 묶음의 줄은 hits 에 안 들어간다 — 적을 것이 없다 */
  assert.match(fn, /const got = coNtsMatch\(chunks\[i\], \(j && j\.data\) \|\| \[\]\);/);
});

test('★★ 열쇠가 없으면 «한 개도» 안 나간다', () => {
  const fn = cutFn(SRC, 'function coNtsSweepAsk(');
  const at = fn.indexOf('const targets');
  const before = fn.slice(0, at);
  assert.match(before, /if\(!svc\)\{[\s\S]*?return;/,
    '★★★ 열쇠도 없이 4,000개를 내보내고 나서 실패하면 이미 나간 것이다');
});

test('★★ 훑기로 들어가는 «문»이 있다 — 띠는 결과가 나온 뒤에야 뜬다', () => {
  assert.match(cutFn(SRC, 'function coFilterMenuPaint('), /openCoNts\(\)/,
    '★★★ 한 곳도 안 물어봤으면 띠가 없어 들어갈 길이 없다');
});
