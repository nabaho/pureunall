/* 전달함 — 고친 뒤 «넣은 사람»에게 무엇을 해야 하는지 알린다
   ─────────────────────────────────────────────────────────────────────────
   대표 지시 2026-09-16 「내가 고치고 난 이후에 데이터 입력자가 수정·변경 등이
   필요한 경우 로그인 때 이 부분 어떻게 해야 되는지 자동으로 알림 만들어줘」

   ★ 못 박는 것 — 어기면 «조용히» 망가지는 것들만 담았다
     ① 쪽지는 data 아래에 담는다 — 최상위에 담으면 서버가 거부한다(규칙에 $other 가 없다)
     ② 받는 사람별로 자리를 나눈다 — 한 자리에 몰면 색인이 필요하고, 색인 없는 고르기는
        온 직원이 남의 쪽지를 «전부» 내려받는다
     ③ 부팅 계획에서 빠진다 — data 아래 이름은 전부 «표»로 보고 받아 가기 때문
     ④ 시각을 찍기 «전»에 본다 — 찍고 나면 updatedBy 가 나라서 누가 넣었는지 사라진다
     ⑤ 내가 넣은 것은 나에게 안 알린다
     ⑥ 같은 이름이 둘이거나 퇴직자면 안 보낸다
     ⑦ 한마디가 비면 안 보낸다 — 「고쳤습니다」만 가는 알림은 아무도 안 읽는다
     ⑧ 관리자가 아니면 아무 일도 안 한다
     ⑨ 이름표에 돈 칸을 쓰지 않는다 — 쪽지 자리는 직원 누구나 읽는다
     ⑩ 띠는 body 에 띄운다 — Preact 나무 안에 끼우면 헤더가 깜빡인다(#1374)
     ⑪ 확인 전에는 목록에서 안 빠진다
     ⑫ 모르는 표는 「가기」 단추를 안 만든다 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const S = stripJs(SRC);

function varLine(name) {
  /* ⚠ 줄끝을 가정하지 않는다 — 이 PC 는 CRLF, CI 는 LF 다(둘 중 하나만 받으면 배포가 막힌다) */
  const re = new RegExp('var ' + name + ' = [\\s\\S]*?;\\r?\\n');
  const m = re.exec(S);
  assert.ok(m, '★ ' + name + ' 선언을 못 찾았습니다');
  return m[0];
}

/* ── ① 어디에 담는가 ── */

test('① 쪽지는 data 아래에 담는다 — 최상위는 서버가 거부한다', () => {
  const p = /var HANDOFF_PATH = '([^']+)'/.exec(S);
  assert.ok(p, '★ HANDOFF_PATH 가 없습니다');
  assert.match(p[1], /^data\//,
    '★★ 최상위에 담으면 저장이 통째로 거부됩니다 — 살아 있는 규칙의 최상위에는 이름 없는 자리($other)가 없습니다');
});

test('② 받는 사람별로 자리를 나눈다 — 색인 없는 고르기를 쓰지 않는다', () => {
  const send = cutFn(S, 'function handoffSend(');
  assert.match(send, /HANDOFF_PATH \+ '\/' \+ cand\.toSid/,
    '★ 보낼 때 받는 사람 자리로 나눠 담아야 합니다');
  const all = cutFn(S, 'function handoffSend(') + cutFn(S, 'function handoffSeen(');
  assert.ok(!/orderByChild/.test(all),
    '★★ orderByChild 는 .indexOn 이 있어야 합니다. 규칙을 못 올리는 지금은 색인이 없어, 온 직원이 남의 쪽지를 전부 내려받습니다');
  /* 받는 쪽 구독도 자기 자리만 봐야 한다 */
  const sub = S.slice(S.indexOf("fbDb.ref(HANDOFF_PATH + '/' + _hoSid)") - 200, S.indexOf("fbDb.ref(HANDOFF_PATH + '/' + _hoSid)") + 200);
  assert.match(sub, /HANDOFF_PATH \+ '\/' \+ _hoSid/, '★ 받는 쪽도 «자기 자리»만 구독해야 합니다');
});

test('③ 부팅 때 «표»로 오해하지 않는다 — 안 그러면 온 직원이 매번 내려받는다', () => {
  const ex = varLine('FB_EXCLUDE');
  assert.match(ex, /'handoff_notes'/,
    '★★ FB_EXCLUDE 에 없으면 부팅 계획(data 이름 훑기)이 이것을 표로 보고 통째로 받아 갑니다');
});

/* ── ② 저장 층에서 언제 보는가 ── */

test('④ 시각을 찍기 «전»에 본다 — 찍고 나면 누가 넣었는지 사라진다', () => {
  ['function dbUpsert(', 'function dbPatch('].forEach(fn => {
    const f = cutFn(S, fn);
    const iSpot = f.indexOf('_handoffSpot(');
    const iStamp = f.indexOf('_recStamp(');
    assert.ok(iSpot >= 0, '★ ' + fn + ' 에 전달함 그물이 없습니다');
    assert.ok(iStamp >= 0, '★ ' + fn + ' 에 _recStamp 가 없습니다');
    assert.ok(iSpot < iStamp,
      '★★ ' + fn + ': _recStamp 가 updatedBy 를 «나»로 바꿉니다. 그 뒤에 보면 늘 내 것이 되어 아무에게도 안 갑니다');
  });
});

test('⑤ 통째 저장에서도 본다 — 다만 관리자일 때만, 한 건에서 멈춘다', () => {
  const f = cutFn(S, 'function dbSet(');
  assert.match(f, /_handoffCanSpot\(\)/,
    '★ 관리자인지 먼저 보지 않으면 2천 줄짜리 표에서 저장마다 전부 견주게 됩니다');
  assert.match(f, /_handoffSpot\(k, it, _cPrev\[it\.id\]\)/, '★ 통째 저장 경로에 그물이 없습니다');
});

/* ── ③ 진짜로 돌려 본다 ── */

function world(opts) {
  opts = opts || {};
  const pushed = [];
  const ctx = {
    console: { warn(){}, log(){}, error(){} },
    JSON, Object, Array, String, Number, Date, Math, Promise, RegExp, setTimeout,
    CURRENT_USER: opts.me || { sid:'p001', name:'대표', isAdmin:true, isOwner:true },
    dbGet: () => (opts.users !== undefined ? opts.users : [
      { sid:'p001', name:'대표',   status:'active' },
      { sid:'p003', name:'김보람', status:'active' },
      { sid:'p009', name:'퇴사자', status:'retired' }
    ]),
    conflictWhat: k => ({ finance_income:'수입', cases:'사건' }[k] || '자료'),
    fbDb: { ref: p => ({ push: o => { pushed.push({ path:p, note:o }); return Promise.resolve(); },
                         update: o => { pushed.push({ path:p, update:o }); return Promise.resolve(); } }) },
    showToast(){},
    window: { _erpErrLog:null },
    _handoffStrip(c){ ctx.__strip = c; }          /* 띠는 따로 잰다 */
  };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  const code = varLine('HANDOFF_PATH') + varLine('HANDOFF_NAME_FIELDS') + varLine('HANDOFF_SCREEN')
    + cutFn(S, 'function _handoffLabel(') + cutFn(S, 'function _handoffSidByName(')
    + cutFn(S, 'function _handoffCanSpot(') + cutFn(S, 'function _handoffSpot(')
    + cutFn(S, 'function handoffSend(') + cutFn(S, 'function handoffSeen(')
    + cutFn(S, 'function handoffScreen(');
  vm.runInContext(code, ctx);
  return { ctx, pushed };
}

test('⑤ 내가 넣은 것은 나에게 안 알린다', () => {
  const w = world();
  assert.equal(w.ctx._handoffSpot('cases', { id:'c1' }, { id:'c1', updatedBy:'대표' }), false);
  assert.equal(w.ctx.__strip, undefined, '★ 자기 자신에게 가는 알림을 만들면 안 됩니다');
});

/* ⚠ 위 검사만으로는 이빨이 없었다 — 이름 검사를 빼도 «사번 검사»가 대신 막아 통과했다.
   이름 검사가 진짜로 막는 것은 «내 이름이 다른 사번에 붙어 있을 때»다.
   실제로 있는 일이다: 새 PC 에서는 이 기기의 직원 명단이 낡아 있을 수 있고
   (로그인은 명단 없이도 된다), 사람이 옛 계정을 갖고 있기도 하다. */
test('⑤-3 이름이 나와 같으면 사번이 달라도 안 알린다 — 내 옛 계정 앞으로 쪽지가 쌓인다', () => {
  const w = world({
    me: { sid:'p001', name:'대표', isAdmin:true },
    users: [{ sid:'p055', name:'대표', status:'active' }]
  });
  assert.equal(w.ctx._handoffSpot('cases', { id:'c1' }, { id:'c1', updatedBy:'대표' }), false,
    '★★ 이름으로 «먼저» 걸러야 합니다 — 사번 검사만 믿으면 내가 고친 것이 내 옛 계정으로 갑니다');
  assert.equal(w.ctx.__strip, undefined);
});

test('⑤-2 남이 넣은 것은 알린다 — 대상·자리를 스스로 찾는다', () => {
  const w = world();
  const ok = w.ctx._handoffSpot('cases', { id:'c1', companyName:'가나상사' }, { id:'c1', updatedBy:'김보람' });
  assert.equal(ok, true);
  assert.equal(w.ctx.__strip.toSid, 'p003', '★ 이름으로 사번을 찾아야 합니다');
  assert.equal(w.ctx.__strip.toName, '김보람');
  assert.equal(w.ctx.__strip.label, '사건 · 가나상사');
});

test('⑥ 같은 이름이 둘이면 «안 보낸다» — 엉뚱한 사람에게 가느니 안 가는 것이 낫다', () => {
  const w = world({ users:[
    { sid:'p003', name:'김보람', status:'active' },
    { sid:'p007', name:'김보람', status:'active' }
  ]});
  assert.equal(w.ctx._handoffSpot('cases', { id:'c1' }, { id:'c1', updatedBy:'김보람' }), false);
});

test('⑥-2 퇴직한 사람에게는 안 보낸다', () => {
  const w = world();
  assert.equal(w.ctx._handoffSpot('cases', { id:'c1' }, { id:'c1', updatedBy:'퇴사자' }), false);
});

test('⑧ 관리자가 아니면 아무 일도 안 한다', () => {
  const w = world({ me:{ sid:'p003', name:'김보람', isAdmin:false } });
  assert.equal(w.ctx._handoffSpot('cases', { id:'c1' }, { id:'c1', updatedBy:'대표' }), false);
  assert.equal(w.ctx._handoffCanSpot(), false);
});

test('⑦ 한마디가 비면 안 보낸다 — 「고쳤습니다」만 가는 알림은 아무도 안 읽는다', async () => {
  const w = world();
  const cand = { k:'cases', id:'c1', toSid:'p003', toName:'김보람', label:'사건 · 가나상사' };
  assert.equal(await w.ctx.handoffSend(cand, '   '), false);
  assert.equal(w.pushed.length, 0);
  assert.equal(await w.ctx.handoffSend(cand, '부가세 칸도 넣어 주세요'), true);
  assert.equal(w.pushed.length, 1);
  assert.equal(w.pushed[0].path, 'data/handoff_notes/p003', '★ 받는 사람 자리에 담겨야 합니다');
  assert.equal(w.pushed[0].note.seen, false, '★ 처음에는 «안 읽음»이어야 합니다');
  assert.equal(w.pushed[0].note.srcId, 'c1');
});

test('⑨ 이름표에 «돈 칸»을 쓰지 않는다 — 이 자리는 직원 누구나 읽는다', () => {
  const w = world();
  const label = w.ctx._handoffLabel('finance_income', { id:'fi1', amount:5500000, totalPay:120000, companyName:'가나상사' });
  assert.equal(label, '수입 · 가나상사');
  assert.ok(!/5500000|120000/.test(label), '★★ 쪽지는 서버에 남고 백업에도 들어갑니다 — 금액을 담지 마세요');
  /* 이름표 칸 목록 자체에 돈 칸이 끼어들지 않게 */
  const fields = varLine('HANDOFF_NAME_FIELDS');
  ['amount', 'totalPay', 'pay', 'price', 'rrn', 'ssn'].forEach(bad => {
    assert.ok(!new RegExp("'" + bad + "'").test(fields), '★★ 이름표 칸에 ' + bad + ' 이 들어 있습니다');
  });
});

test('⑨-2 이름표에 쓸 것이 없으면 종류만 적는다 — 빈 이름을 지어내지 않는다', () => {
  const w = world();
  assert.equal(w.ctx._handoffLabel('cases', { id:'c1' }), '사건');
});

test('⑫ 모르는 표는 「가기」 단추를 안 만든다', () => {
  const w = world();
  assert.equal(w.ctx.handoffScreen('cases'), 'biz/case');
  assert.equal(w.ctx.handoffScreen('무슨표인지모름'), '', '★ 모르면 빈 값 — 엉뚱한 화면으로 보내면 안 됩니다');
});

/* ── ④ 화면 쪽 규칙 ── */

test('⑩ 띠는 body 에 띄운다 — Preact 나무 안에 끼우면 헤더가 깜빡인다(#1374)', () => {
  const f = cutFn(S, 'function _handoffStrip(');
  assert.match(f, /document\.body\.appendChild/, '★ 띠는 body 에 떠 있어야 합니다');
  assert.ok(!/insertBefore\(/.test(f),
    '★★ 헤더 안에 끼우면 다시 그려질 때 밀려나고 다음에 또 끼워집니다 — 그것이 깜빡임입니다');
  assert.match(f, /position:fixed/);
});

test('⑪ 확인 전에는 목록에서 안 빠진다 — 그리고 확인은 서버에 남는다', () => {
  assert.match(S, /filter\(function\(n\)\{ return n && !n\.seen && n\.text; \}\)/,
    '★ 「확인 안 한 것」만 골라야 합니다');
  const f = cutFn(S, 'function handoffSeen(');
  assert.match(f, /seen:\s*true/, '★ 확인은 서버에 적혀야 다른 기기에서도 사라집니다');
  assert.match(f, /seenAt:/, '★ 언제 확인했는지도 남겨야 보낸 사람이 압니다');
});

test('⑭ 보낸 것 보기는 관리자만, «내가 보낸 것»만 — 남의 쪽지 목록이 아니다', () => {
  const i = S.indexOf('var q4 = fbDb.ref(HANDOFF_PATH);');
  assert.ok(i > 0, '★ 보낸 것 구독을 못 찾았습니다');
  const blk = S.slice(i - 200, i + 800);
  assert.match(blk, /CURRENT_USER && CURRENT_USER\.isAdmin/,
    '★★ 관리자만 통째로 봐야 합니다 — 직원이 통째로 보면 남의 쪽지가 다 보입니다');
  assert.match(blk, /n\.fromSid === CURRENT_USER\.sid/,
    '★★ «내가 보낸 것»만 골라야 합니다 — 안 그러면 다른 관리자가 보낸 것까지 내 목록에 섞입니다');
});

test('⑮ 안 읽힌 것이 없으면 「보낸 것」 단추가 아예 안 보인다', () => {
  assert.match(S, /var un = hoSent\.filter\(function\(n\)\{ return !n\.seen; \}\)\.length;/,
    '★ 안 읽힌 것만 세야 합니다');
  assert.match(S, /return un > 0 && h\('button'/,
    '★ 늘 떠 있는 단추는 며칠 만에 «배경»이 되어 아무도 안 누릅니다');
});

test('⑬ 로그인마다 «한 번만» 저절로 열린다 — 화면 옮길 때마다 뜨면 일을 못 한다', () => {
  const i = S.indexOf("fbDb.ref(HANDOFF_PATH + '/' + _hoSid)");
  assert.ok(i > 0, '★ 전달함 구독을 못 찾았습니다');
  const blk = S.slice(i, i + 900);
  assert.match(blk, /sessionStorage\.getItem\('pu_handoff_opened'\)/,
    '★ 이 한 번을 기억하지 않으면 자료가 올 때마다 창이 다시 뜹니다');
  assert.match(blk, /sessionStorage\.setItem\('pu_handoff_opened'/);
  /* sessionStorage 라야 «다음 로그인»에는 다시 열린다 — localStorage 면 영영 안 열린다 */
  assert.ok(!/localStorage\.(get|set)Item\('pu_handoff_opened'/.test(blk),
    '★★ localStorage 에 기억하면 한 번 보고 나서 영영 다시 안 열립니다');
});
