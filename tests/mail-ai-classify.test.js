'use strict';
/* 📥 받은메일함 자동분류(Jev) — 대표 지시 2026-09-26
   「메일에 제브를 연결시켜서 자동분류작업을 시킬수 있을까?」
   범위 결정: 「전체 메일을 사람 개입 없이 자동으로 21개 칸에 배치」
   이름 가림 결정: 「우리 직원·업체 이름만 먼저 가려서 보낸다 (이알피와 같은 기준)」

   지키는 것.
   ① 기본은 «꺼짐» — 대표가 config/mailAiClassify.on 을 켜야 돈다
   ② 이름 가림은 js/pu-typesafe.js 의 redactNames 와 «바이트까지 같다»
   ③ 이름 목록을 못 읽으면 «통째로 건너뛴다»(자동 파이프라인은 더 엄하다)
   ④ 이미 사람(또는 이전 회차)이 정한 메일은 다시 안 묻는다
   ⑤ 하루 문 · 한 회차 한도 · 시간 한도를 지킨다 — 넘으면 «부르지 않는다»
   ⑥ 모르는 칸 이름을 답하면 «쓰지 않는다»
   ⑦ 사람 몫(typesafe_tally)과는 «다른 자리»에 센다
   ⑧ 옮기는 자리는 config/mailPut 하나(사람이 쓰는 자리와 같다) + mailPutBy 로 짐작표시
   ⑨ mail-sync.js 는 받은메일함(inbox)·새것(fresh) 방향에서만, 실패해도 던지지 않고 부른다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const AC = require(path.join(ROOT, 'functions', 'mail-ai-classify.js'));
const TSSRC = fs.readFileSync(path.join(ROOT, 'js', 'pu-typesafe.js'), 'utf8');
const MSSRC = fs.readFileSync(path.join(ROOT, 'functions', 'mail-sync.js'), 'utf8').replace(/\r\n/g, '\n');
const TSEVAL_SRC = fs.readFileSync(path.join(ROOT, 'functions', 'typesafe-evaluate.js'), 'utf8');
function code(t){ return t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 '); }
const msCode = code(MSSRC);

/* ── 흉내낸 실시간DB — «진짜처럼 중첩된 나무» 하나를 두고 경로 문자열로 오르내린다 ──
   ⚠ 처음에는 경로 문자열을 그대로 평평한 열쇠로 썼다 — 그러면 db.ref().update({'a/b':1})
     로 적은 값을 db.ref('a').once('value') 가 «영영 못 본다»(실제 RTDB 는 중첩 나무를
     하나로 본다). 자동분류가 «방금 적은 것을 스스로 다시 읽는» 함수라 이 차이가
     검사를 통째로 헛돌게 한다 — 나무로 고쳐야 한다.
   opts.fail — {경로: true} 면 그 경로의 once() 가 거절한다(이름 목록 실패 흉내). */
function get(tree, p){
  const parts = String(p||'').split('/').filter(Boolean);
  let cur = tree;
  for (const k of parts) { if (cur == null || typeof cur !== 'object') return undefined; cur = cur[k]; }
  return cur === undefined ? null : cur;
}
function set(tree, p, v){
  const parts = String(p||'').split('/').filter(Boolean);
  if (!parts.length) return;
  let cur = tree;
  for (let i = 0; i < parts.length - 1; i++) { const k = parts[i]; if (typeof cur[k] !== 'object' || cur[k] == null) cur[k] = {}; cur = cur[k]; }
  const last = parts[parts.length - 1];
  if (v === null) delete cur[last]; else cur[last] = v;
}
function fakeDb(store, opts){
  /* ⚠ store 의 열쇠는 «경로 문자열」이다('data/user_accounts/v') — 그대로 한 칸에
     넣으면 진짜 나무가 아니라 «슬래시가 든 글자 열쇠 하나»가 된다. get()/update() 는
     경로를 «갈라 가며» 내려가므로, 씨앗값부터 한 번 set() 을 거쳐 진짜 나무로 편다. */
  const tree = {};
  Object.keys(store || {}).forEach((p) => set(tree, p, JSON.parse(JSON.stringify(store[p]))));
  const fail = (opts && opts.fail) || {};
  const calls = { onces: [], updates: [], txns: [] };
  function node(p){
    return {
      once(){ calls.onces.push(p);
        if (fail[p]) return Promise.reject(new Error('일부러 못 읽는다: ' + p));
        return Promise.resolve({ val(){ return get(tree, p); } }); },
      update(v){ calls.updates.push([p, v]);
        Object.keys(v||{}).forEach(k=>{ const full = p ? p + '/' + k : k; set(tree, full, v[k]); });
        return Promise.resolve(); },
      transaction(fn){ calls.txns.push(p);
        const next = fn(get(tree, p)); set(tree, p, next);
        return Promise.resolve({ committed:true, snapshot:{ val:()=>get(tree, p) } }); }
    };
  }
  return { ref: (p) => node(p || ''), _tree: tree, _calls: calls };
}

const STAFF = [{ name:'홍길동' }, { name:'가나다' }];
const COS = { c1:{ name:'가나상사' } };
const BINS = { b1:{ n:'1.자문사답변' }, b2:{ n:'2.급여+사무대행' } };

function baseStore(over){
  return Object.assign({
    'pucards/config/mailAiClassify': { on:true, perRunMax:20, dayLimit:100 },
    'data/user_accounts/v': STAFF,
    'data/companies/v': COS,
    'pucards/config/mailBins': BINS,
    'pucards/config/mailPut': {},
  }, over || {});
}

function row(u, s, p){ return { u, e:'nobody@zzz.kr', f:'', s: s||'', p: p||'' }; }

/* 부르면 always 「1.자문사답변」을 고르는 가짜 Jev — 실제 네트워크가 없다 */
function fetchFn(reply){
  const sent = [];
  const fn = async (url, opt) => {
    const body = JSON.parse(opt.body);
    sent.push(body);
    return { ok:true, status:200, json: async () => ({ ok:true,
      answers: { bin: { choice: (reply === undefined ? '1.자문사답변' : reply) } } }) };
  };
  fn.sent = sent;
  return fn;
}

const OLD_ENV = process.env.TYPESAFE_API_KEY;
test.after(() => { process.env.TYPESAFE_API_KEY = OLD_ENV; });
process.env.TYPESAFE_API_KEY = 'test-key-1234';

/* ══════ ① 기본은 꺼짐 ══════ */

test('★★★ config/mailAiClassify.on 이 없으면 «아무 일도 안 한다» — 부르지도 않는다', async () => {
  const db = fakeDb(baseStore({ 'pucards/config/mailAiClassify': {} }));
  const fn = fetchFn();
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, {
    slug:'INBOX', rows:[row(1,'문의')], fetchFn: fn,
  });
  assert.equal(r.ran, false, '꺼져 있는데 돌았습니다');
  assert.equal(fn.sent.length, 0, '꺼져 있는데 Jev 를 불렀습니다');
  assert.equal(db._calls.updates.length, 0, '꺼져 있는데 뭔가 적었습니다');
});

test('설정 자체를 못 읽어도 «꺼진 것으로» 본다(안전한 쪽)', async () => {
  const db = { ref(){ return { once(){ return Promise.reject(new Error('죽음')); } }; } };
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, { slug:'INBOX', rows:[row(1,'a')] });
  assert.equal(r.ran, false);
});

test('★★★ config/mailAiClassify 자리가 «아예 없으면»(첫 배포) 아무 일도 안 한다', async () => {
  /* ⚠ DEFAULTS.on 을 «잰다»가 아니라 «없는 자리에서 실제로 켜지는지»를 잰다.
       DEFAULTS.on 이라는 글자만 바꿔서는 실제 동작이 안 바뀔 수 있다 — 그래서
       classifyNewInbox 를 «자리 자체가 없는» 채로 실제로 돌려 본다. */
  assert.equal(AC.DEFAULTS.on, false, '기본값 글자 자체가 켜짐입니다');
  const store = baseStore();
  delete store['pucards/config/mailAiClassify'];
  const db = fakeDb(store);
  const fn = fetchFn();
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, { slug:'INBOX', rows:[row(1,'문의')], fetchFn: fn });
  assert.equal(fn.sent.length, 0, '설정이 아예 없는데 Jev 를 불렀습니다 — 첫 배포날 바로 돕니다');
  assert.equal(r.ran, false);
});

test('★★★ Jev 열쇠가 서버 금고에 없으면 «부르지 않는다»', async () => {
  const before = process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  try {
    const store = baseStore();
    const db = fakeDb(store);
    const fn = fetchFn();
    const r = await AC.classifyNewInbox({ getDatabase:()=>db }, { slug:'INBOX', rows:[row(1,'문의')], fetchFn: fn });
    assert.equal(fn.sent.length, 0, '열쇠가 없는데 Jev 를 불렀습니다');
    assert.equal(r.ran, false);
  } finally { process.env.TYPESAFE_API_KEY = before; }
});

/* ══════ ② 이름 가림 — pu-typesafe.js 와 «바이트까지 같다» ══════ */

test('★★★ redactNames 가 js/pu-typesafe.js 의 것과 «같은 답»을 낸다', () => {
  const m = TSSRC.match(/function redactNames\(text, staff, companies\) \{[\s\S]*?\n  \}/);
  assert.ok(m, 'js/pu-typesafe.js 에서 redactNames 를 못 찾았습니다 — 견줄 원본이 없습니다');
  const vm = require('vm');
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(m[0] + '\nthis.redactNames = redactNames;', ctx);
  const cases = [
    ['홍길동 님이 계약 마감을 물었습니다.', ['홍길동'], []],
    ['가나상사와 계약이 곧 끝납니다.', [], ['가나상사']],
    ['홍길동이 물었는데 홍길동에게 아직 답장을 못 했습니다.', ['홍길동'], []],
    ['가나상사 소속 가나 대리점 문의입니다.', [], ['가나', '가나상사']],
    ['홍길동과 가나다가 가나상사 건으로 통화했습니다.', ['홍길동','가나다'], ['가나상사']],
    ['외부인 김철수 씨가 문의했습니다.', ['홍길동'], ['가나상사']],
    ['이 문의는 이번 주 안에 처리해야 합니다.', ['이'], []],
  ];
  /* ⚠ ctx 는 vm 상자 안이라 그 배열은 다른 «집」이다 — deepEqual(strict) 이 튕긴다.
     한 번 옮겨 담아 잰다(2026-09-18 보낸 메일 담당자 검사에서 겪은 것과 같은 자리). */
  const plain = (a) => Array.prototype.slice.call(a || []);
  cases.forEach(([text, staff, cos])=>{
    const want = ctx.redactNames(text, staff, cos);
    const got = AC.redactNames(text, staff, cos);
    assert.equal(got.text, want.text, '가리는 결과가 다릅니다: ' + text);
    assert.deepEqual(plain(got.localMaskedKinds), plain(want.localMaskedKinds), '가린 건수 안내가 다릅니다: ' + text);
  });
});

test('★★★ 이름 목록을 못 읽으면 «통째로 건너뛴다» — 사람이 다시 안 보는 자리라 더 엄하다', async () => {
  const store = baseStore();
  const db = fakeDb(store, { fail: { 'data/user_accounts/v': true } });
  const fn = fetchFn();
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, {
    slug:'INBOX', rows:[row(1,'홍길동 문의')], fetchFn: fn,
  });
  assert.equal(fn.sent.length, 0, '이름을 못 가렸는데 그대로 내보냈습니다');
  assert.equal(r.skipped, 1);
});

test('★★★ Jev 에게 실제로 보내는 글에 «가려진» 이름만 있다', async () => {
  const store = baseStore();
  const db = fakeDb(store);
  const fn = fetchFn();
  await AC.classifyNewInbox({ getDatabase:()=>db }, {
    slug:'INBOX', rows:[row(1,'홍길동 님이 가나상사 계약을 물었습니다.')], fetchFn: fn,
  });
  assert.equal(fn.sent.length, 1);
  assert.doesNotMatch(fn.sent[0].state, /홍길동/, '직원 이름이 그대로 나갔습니다');
  assert.doesNotMatch(fn.sent[0].state, /가나상사/, '업체명이 그대로 나갔습니다');
});

/* ══════ ③ 이미 정해진 것은 다시 안 묻는다 ══════ */

test('★★★ 사람이 이미 옮겨 둔 메일은 다시 안 묻는다', async () => {
  const store = baseStore({ 'pucards/config/mailPut': { 'INBOX:1': 'b2' } });
  const db = fakeDb(store);
  const fn = fetchFn();
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, {
    slug:'INBOX', rows:[row(1,'이미 옮김'), row(2,'새 메일')], fetchFn: fn,
  });
  assert.equal(fn.sent.length, 1, '이미 정해진 것까지 물었습니다');
  assert.equal(r.tried, 1);
});

/* ══════ ④ 하루 문 · 회차 한도 · 시간 한도 ══════ */

test('★★★ 하루 문을 넘으면 «부르지 않는다»', async () => {
  const ymd = require(path.join(ROOT, 'functions', 'doc-read.js')).ymdKST();
  const store = baseStore({
    'pucards/config/mailAiClassify': { on:true, dayLimit:2 },
    ['typesafe_tally_mail/' + ymd]: 2,
  });
  const db = fakeDb(store);
  const fn = fetchFn();
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, {
    slug:'INBOX', rows:[row(1,'문의1'), row(2,'문의2')], fetchFn: fn,
  });
  assert.equal(fn.sent.length, 0);
  assert.equal(r.skipped, 2);
});

test('★★ 하루 남은 몫만큼만 부른다 — 넘는 것은 다음 날로 미룬다', async () => {
  const ymd = require(path.join(ROOT, 'functions', 'doc-read.js')).ymdKST();
  const store = baseStore({
    'pucards/config/mailAiClassify': { on:true, dayLimit:3, perRunMax:20 },
    ['typesafe_tally_mail/' + ymd]: 2,
  });
  const db = fakeDb(store);
  const fn = fetchFn();
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, {
    slug:'INBOX', rows:[row(1,'a'), row(2,'b'), row(3,'c')], fetchFn: fn,
  });
  assert.equal(fn.sent.length, 1, '남은 몫(1)보다 많이 불렀습니다');
  assert.equal(r.tried, 1);
});

test('★★ 한 회차 한도(perRunMax)를 넘지 않는다', async () => {
  const store = baseStore({ 'pucards/config/mailAiClassify': { on:true, perRunMax:2, dayLimit:100 } });
  const db = fakeDb(store);
  const fn = fetchFn();
  const rows = [1,2,3,4,5].map(n=>row(n, '문의' + n));
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, { slug:'INBOX', rows, fetchFn: fn });
  assert.equal(fn.sent.length, 2, '회차 한도를 넘어 불렀습니다');
  assert.equal(r.tried, 2);
});

test('★★ 시간 한도(deadline)를 지난 뒤로는 안 부른다', async () => {
  const store = baseStore();
  const db = fakeDb(store);
  const fn = fetchFn();
  const rows = [1,2,3].map(n=>row(n, '문의' + n));
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, {
    slug:'INBOX', rows, fetchFn: fn, deadline: Date.now() - 1000,
  });
  assert.equal(fn.sent.length, 0, '이미 지난 마감인데 불렀습니다');
});

/* ══════ ⑤ 모르는 칸은 안 쓴다 ══════ */

test('★★★ Jev 가 «모르는 칸 이름»을 답하면 쓰지 않는다', async () => {
  const store = baseStore();
  const db = fakeDb(store);
  const fn = fetchFn('9.존재하지않는칸');
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, {
    slug:'INBOX', rows:[row(1,'문의')], fetchFn: fn,
  });
  assert.equal(r.done, 0, '모르는 칸인데 옮겼습니다');
  assert.equal(Object.keys(get(db._tree, 'pucards/config/mailPut') || {}).length, 0);
});

test('빈 칸 목록이면 아무것도 안 한다 — 나눌 곳이 없다', async () => {
  const store = baseStore({ 'pucards/config/mailBins': {} });
  const db = fakeDb(store);
  const fn = fetchFn();
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, { slug:'INBOX', rows:[row(1,'문의')], fetchFn: fn });
  assert.equal(fn.sent.length, 0);
  assert.equal(r.ran, false);
});

/* ══════ ⑥ 옮기는 자리 — mailPut 하나 + mailPutBy 로 짐작 표시 ══════ */

test('★★★ 옮기는 자리는 config/mailPut 하나다 — 사람이 쓰는 자리와 같다', async () => {
  const store = baseStore();
  const db = fakeDb(store);
  const fn = fetchFn('1.자문사답변');
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, { slug:'INBOX', rows:[row(7,'문의')], fetchFn: fn });
  assert.equal(r.done, 1);
  assert.equal(get(db._tree, 'pucards/config/mailPut')['INBOX:7'], 'b1');
});

test('★★★ 「AI가 짚었다」를 «다른 자리»에 적는다 — 사람이 정한 것과 값을 안 섞는다', async () => {
  const store = baseStore();
  const db = fakeDb(store);
  const fn = fetchFn('1.자문사답변');
  await AC.classifyNewInbox({ getDatabase:()=>db }, { slug:'INBOX', rows:[row(7,'문의')], fetchFn: fn });
  assert.equal(get(db._tree, 'pucards/config/mailPutBy')['INBOX:7'], 'ai');
});

/* ══════ ⑦ 하루 문은 사람 몫과 다른 자리다 ══════ */

test('★★★ 사람이 쓰는 typesafe_tally 는 «건드리지 않는다»', async () => {
  const store = baseStore();
  const db = fakeDb(store);
  const fn = fetchFn();
  await AC.classifyNewInbox({ getDatabase:()=>db }, { slug:'INBOX', rows:[row(1,'문의')], fetchFn: fn });
  const touched = db._calls.txns.concat(db._calls.updates.map(([p])=>p));
  assert.ok(!touched.some((p)=>String(p).indexOf('typesafe_tally/') === 0),
    '사람 하루 문(typesafe_tally)을 건드렸습니다 — 자동분류가 사람 몫을 갉아먹습니다');
  assert.ok(touched.some((p)=>String(p).indexOf('typesafe_tally_mail/') === 0),
    '자동분류 하루 문을 안 셌습니다');
});

/* ══════ ⑧ Jev 판단 자체가 실패해도 죽지 않는다 ══════ */

test('★★ Jev 가 «판단할 수 없다»고 답해도(모르는 칸 등) 다음 줄은 이어서 본다', async () => {
  const store = baseStore();
  const db = fakeDb(store);
  let n = 0;
  /* 첫 통은 모르는 칸을 답해 못 쓰고(r.ok 는 참이지만 binId 가 없다), 둘째 통은 제대로 답한다 */
  const fn = async () => { n++; return { ok:true, status:200,
    json: async()=>({ ok:true, answers:{ bin:{ choice: n===1 ? '9.모르는칸' : '1.자문사답변' } } }) }; };
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, {
    slug:'INBOX', rows:[row(1,'a'), row(2,'b')], fetchFn: fn,
  });
  assert.equal(r.tried, 2, '둘 다 물어야 하는데 하나만 물었습니다');
  assert.equal(r.done, 1, '모르는 칸 하나 때문에 나머지도 안 옮겼습니다');
});

test('★★★ Jev 를 부르는 자리가 «진짜로 죽어도»(evaluate 내부 예외) 다음 줄은 이어서 본다', async () => {
  /* ⚠ evaluate() 는 대개 실패를 {ok:false} 로 «돌려줄 뿐» 던지지 않는다 — 그런데
       fetchFn 이 응답 대신 undefined 를 주면 evaluate() 내부의 response.ok 접근이
       «진짜로» 던진다(그 한 줄만은 try 밖이다). 그 드문 경우에도 classifyNewInbox
       는 죽지 않아야 한다 — 여기서 그 경우를 «실제로» 만들어 잰다. */
  const store = baseStore();
  const db = fakeDb(store);
  let n = 0;
  const fn = async () => { n++; if (n === 1) return undefined;
    return { ok:true, status:200, json: async()=>({ ok:true, answers:{ bin:{ choice:'1.자문사답변' } } }) }; };
  const r = await AC.classifyNewInbox({ getDatabase:()=>db }, {
    slug:'INBOX', rows:[row(1,'a'), row(2,'b')], fetchFn: fn,
  });
  assert.equal(r.done, 1, '첫 줄에서 진짜로 죽은 뒤 나머지를 안 봅니다');
});

/* ══════ ⑨ evaluate() 는 questions 를 «바꿔 끼울 수» 있고, 안 주면 예전 그대로다 ══════ */

test('★★ typesafe-evaluate.evaluate 는 qs 를 안 주면 예전 물음(questions())을 그대로 쓴다', () => {
  assert.match(code(TSEVAL_SRC), /questions:\s*qs\s*\|\|\s*questions\(\)/,
    'qs 를 새로 받으면서 이알피가 쓰던 길(questions())을 깼습니다');
});

test('★★ binQuestion 은 실제 칸 이름을 후보로 만든다', () => {
  const bins = [{ id:'b1', name:'1.자문사답변' }, { id:'b2', name:'2.급여+사무대행' }];
  const q = AC.binQuestion(bins);
  assert.ok(q.bin && q.bin.criteria);
  assert.ok('1.자문사답변' in q.bin.criteria);
  assert.ok('2.급여+사무대행' in q.bin.criteria);
});

/* ══════ ⑩ binsOf — pu-cards.html 의 mbBins() 와 같은 잣대 ══════ */

test('★★ config/mailBins + 아직 손 안 댄 custom 폴더를 «함께» 칸으로 본다', () => {
  const bins = AC.binsOf({ b1:{ n:'1.자문사답변' } },
    [{ slug:'3.컨설팅', name:'3.컨설팅(정부사업)' }]);
  const names = bins.map(b=>b.name);
  assert.ok(names.includes('1.자문사답변'));
  assert.ok(names.includes('3.컨설팅(정부사업)'));
});

test('이미 config/mailBins 가 가리키는(link) custom 폴더는 두 번 안 넣는다', () => {
  const bins = AC.binsOf({ b1:{ n:'옮긴이름', l:'원래폴더' } },
    [{ slug:'원래폴더', name:'원래폴더' }]);
  assert.equal(bins.filter(b=>b.name==='원래폴더').length, 0, '이어진 폴더가 따로 또 나옵니다');
  assert.ok(bins.some(b=>b.name==='옮긴이름'));
});

/* ══════════════════════════════════════════════════════════════════════════
   mail-sync.js 이어붙임 — 받은메일함(inbox)·새것(fresh) 방향에서만, 실패해도 안 던진다
   ══════════════════════════════════════════════════════════════════════════ */

function syncBlock(){
  const i = MSSRC.indexOf("if (Object.keys(batch).length) await db.ref().update(batch);");
  const j = MSSRC.indexOf("여기서 «이 칸의 기간»을 재던 자리다", i);
  assert.ok(i > 0 && j > i, '자동분류를 잇는 자리를 못 찾았습니다');
  return code(MSSRC.slice(i, j));
}

test('★★★ mail-ai-classify 를 부른다 — 새것(fresh) 방향·받은메일함(inbox)에서만', () => {
  const b = syncBlock();
  assert.match(b, /AICLASSIFY\.classifyNewInbox\(/, '자동분류를 안 부릅니다');
  assert.match(b, /r\.dir === 'fresh'/, '새것 방향에서만 도는지를 안 봅니다');
  assert.match(b, /MB\.folderKind\(p\.box\) === 'inbox'/, '받은메일함에서만 도는지를 안 봅니다');
});

test('★★★ 실패해도 던지지 않는다 — 메일 동기화 자체를 물고 들어가면 안 된다', () => {
  const b = syncBlock();
  const iCall = b.indexOf('AICLASSIFY.classifyNewInbox');
  const iTry = b.lastIndexOf('try {', iCall);
  const iCatch = b.indexOf('catch (e)', iCall);
  assert.ok(iTry >= 0 && iTry < iCall, 'try 가 부르는 자리보다 앞에 없습니다');
  assert.ok(iCatch > iCall, 'catch 가 없거나 부르는 자리보다 앞에 있습니다');
});

test('★★ 시간 예산(deadline)을 그대로 넘겨준다 — 동기화 마감과 «같은 시계»를 봐야 한다', () => {
  const b = syncBlock();
  assert.match(b, /deadline:\s*deadline/, '동기화 마감을 안 넘깁니다 — 딴 시계로 돌면 예산을 넘게 부릅니다');
});

test('★ syncMailbox·pullMailbox 둘 다 TYPESAFE_API_KEY 비밀을 쓴다', () => {
  assert.match(msCode, /syncMailbox: F[\s\S]{0,300}secrets:\s*\[[^\]]*'TYPESAFE_API_KEY'/,
    'syncMailbox 가 Jev 열쇠를 안 받습니다');
  assert.match(msCode, /pullMailbox: F[\s\S]{0,300}secrets:\s*\[[^\]]*'TYPESAFE_API_KEY'/,
    'pullMailbox 가 Jev 열쇠를 안 받습니다(「새로고침」을 눌러도 안 돕니다)');
});

/* ══════════════════════════════════════════════════════════════════════════
   화면(pu-cards.html) — 「AI가 짚었다」와 「사람이 정했다」를 다르게 보여 준다
   ══════════════════════════════════════════════════════════════════════════ */

const PC = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const pcCode = code(PC);

test('★★★ mbEnsureBins 가 config/mailPutBy 를 «같이» 읽는다', () => {
  const i = pcCode.indexOf('function mbEnsureBins(');
  const seg = pcCode.slice(i, pcCode.indexOf('function mbBins(', i));
  assert.match(seg, /config\/mailPutBy/, '「AI가 짚었다」표를 안 읽습니다');
  assert.match(seg, /_mbPutBy\s*=/, '읽은 값을 담을 자리가 없습니다');
});

test('★★★ mbFromTag 는 AI 표시와 다음메일 표시를 «함께» 그린다', () => {
  const seg = pcCode.slice(pcCode.indexOf('function mbFromTag('), pcCode.indexOf('function mbFromTag(') + 700);
  assert.match(seg, /mbAiPutTag\(/, 'AI 표시를 안 그립니다');
});

test('★★ AI 표시는 «사람이 정한 것과 다른 차림새»다', () => {
  assert.match(PC, /\.dm-ai\{/, 'AI 표시 차림새가 없습니다');
  const who = PC.slice(PC.indexOf('.dm-who{'), PC.indexOf('.dm-who{') + 200);
  const ai = PC.slice(PC.indexOf('.dm-ai{'), PC.indexOf('.dm-ai{') + 200);
  const colorOf = (s) => (s.match(/color:#([0-9a-f]{6})/) || [])[1];
  assert.notEqual(colorOf(who), colorOf(ai), 'AI 표시와 담당자 표시가 같은 색입니다 — 헷갈립니다');
});

test('★★★ 사람이 다시 옮기거나 되돌리면 「AI가 짚었다」표를 «함께» 지운다', () => {
  /* ⚠ .catch(실패 되돌리기) 안에도 「delete _mbPutBy[k]」가 있다 — 그건 «실패해서
       원래대로 되돌리는» 것이지 «사람이 옮겨서 지우는» 것이 아니다. .then/.catch
       «전»(진짜 옮기는 자리)만 잘라 봐야 두 갈래를 안 섞는다. */
  const i = pcCode.indexOf('function mbPutWrite(');
  const j = pcCode.indexOf('.catch(e=>{', i);
  assert.ok(j > i, '.catch 자리를 못 찾았습니다');
  const seg = pcCode.slice(i, j);
  assert.match(seg, /if\(_mbPutBy\[k\]\)\{\s*delete _mbPutBy\[k\];\s*upBy\[k\] = null;/,
    '사람이 손대도 AI 표가 안 지워집니다');
  assert.match(seg, /config\/mailPutBy/, '서버에도 지우러 가지 않습니다');
});
