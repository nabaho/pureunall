'use strict';
/* 「고를 것」의 단서 — node --test tests/work-autolog-hint.test.js
 *
 * 대표 지시 2026-10-03: 「힌트 띄우는 것」
 *
 * 왜 — 자동 기록이 어느 업무인지 확신 못 한 19건을 사람이 고르게 두었는데, 고르는 창에
 *   ① 유형이 안 보여 한 회사의 후보 셋이 «글자 하나 안 다르게» 나왔고(가야엔지니어링)
 *   ② 왜 그것이 그럴듯한지 아무 단서가 없었다.
 *
 * ⚠⚠ 이 검사가 지키는 가장 큰 것: 단서를 «자동으로 붙이는 잣대»로 쓰지 않는다.
 *   실측 2026-10-03 「📅 1630 일신정밀(일터)」 — 김혜민이 만들었지만 제목의 「(일터)」는
 *   권형하의 일터상생혁신컨설팅을 가리킨다. 만든이로 자동으로 골랐으면 틀렸다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const W = fs.readFileSync(path.join(ROOT, 'work.html'), 'utf8').replace(/\r\n/g, '\n');
const CAL = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');
const CSS = W.slice(W.indexOf('<style>') + 7, W.indexOf('</style>'));

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (; ; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) { j++; break; } } }
  return src.slice(i, j);
}
function konst(re, what) { const m = W.match(re); assert.ok(m, '값 못 찾음: ' + what); return m[0]; }
/* 주석을 걷은 코드 — 잘 쓴 주석이 검사를 통과시키는 것을 막는다 */
function code(t) { return t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 '); }

const FNS = ['_normCo', '_mailAddr', '_cList', 'coFind', 'peRec', 'peLinked', 'isOf', 'isMine',
  'allItems', 'openItems', 'mailKeysOf', '_koOnly', 'briefTrim', 'itemName',
  'alMailKey', 'alSidByMail', 'alHints', 'alItemName', 'alNames'];

function box(o) {
  o = o || {};
  const b = {
    console, Date, String, Number, Object, Array, JSON, isNaN, Math, RegExp,
    items: o.items || {}, coSrc: o.cos || [], peMaster: {},
    mailSrc: o.mail || [], mailchk: {}, maillink: {}, mailaddr: {},
    _peU2N: o.u2n || {}, alMailSid: o.mailSid === undefined ? {} : o.mailSid,
    S: { me: { sid: 'P-001', name: '권형하' } },
    esc: x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    mgrSubNames: it => ((it && it.mgr_subs) || []).map(s => s && s.name).filter(Boolean)
  };
  vm.createContext(b);
  vm.runInContext(konst(/var MAIL_PUBLIC=\{[\s\S]*?\};/, 'MAIL_PUBLIC') + '\n'
    + konst(/var MLK_MIN_MATCH=\d+;/, 'MLK_MIN_MATCH') + '\n'
    + konst(/var _mlkAIdx=null, _mlkAIdxSrc=null;/, '주소 색인') + '\n'
    + konst(/var BRIEF_MAX=\d+;/, 'BRIEF_MAX') + '\n'
    + FNS.map(n => grab(W, n)).join('\n'), b);
  return b;
}

/* ── 흉내 자료 — 실측에서 본 모양 그대로 ── */
const 업무 = {
  /* 한 회사에 유형이 다른 업무 둘 — 유형이 안 보이면 구별이 안 된다 */
  A1: { company: '가나정밀', ptype: '자문', cat: '자문', no: '자문-2026-001', created_at: '2026-01-02T00:00:00Z', state: '', mgr_main: { sid: 'P-004', name: '김보람' } },
  A2: { company: '가나정밀', ptype: '일터상생혁신컨설팅', cat: '컨설팅', no: '컨설팅-2026-001', created_at: '2026-01-03T00:00:00Z', state: '', mgr_main: { sid: 'P-001', name: '권형하' } },
  /* 회사·유형·담당이 모두 같고 번호도 같은 «진짜 중복» */
  B1: { company: '다라재단', ptype: '이음센터', cat: '기타사업', no: '이음-2026-001', created_at: '2026-07-27T00:00:00Z', state: '', mgr_main: { sid: 'P-001', name: '권형하' } },
  B2: { company: '다라재단', ptype: '이음센터', cat: '기타사업', no: '이음-2026-001', created_at: '2026-09-17T00:00:00Z', state: '', mgr_main: { sid: 'P-001', name: '권형하' } },
  /* 번호만 다른 둘 */
  C1: { company: '마바상사', ptype: '급여', cat: '급여', no: '급여-2026-001', state: '', mgr_main: { sid: 'P-001', name: '권형하' } },
  C2: { company: '마바상사', ptype: '급여', cat: '급여', no: '급여-2026-002', state: '', mgr_main: { sid: 'P-001', name: '권형하' } }
};
const U2N = { 'P-001': '권형하', 'P-004': '김보람' };
const 계정표 = { 'hong@gmail,com': 'P-004', 'daepyo@gmail,com': { sid: 'P-001' } };
const 판 = (extra) => box(Object.assign({ items: 업무, u2n: U2N, mailSid: 계정표 }, extra || {}));
const X = (a) => ({ wk: '2026-W39', src: 's', a, ids: [] });

/* 일정 모으기까지 돌려 보는 상자 — 「만든이로 좁히지 않는다」를 글자가 아니라 «돌려서» 본다 */
function calBox() {
  const b = box({ items: { A1: 업무.A1, A2: 업무.A2 }, u2n: U2N, mailSid: 계정표 });
  vm.runInContext(konst(/var AL_CAT_WORDS=\[[\s\S]*?\];/, 'AL_CAT_WORDS') + '\n'
    + ['pad', 'ymd', 'mondayOf', 'addDays', 'safeKey', 'alIn', 'alItems',
       'alNarrow', 'alCatNarrow', 'alCoHits', 'alCalLine', 'alCalRows']
      .map(n => grab(W, n)).join('\n'), b);
  return b;
}

/* ══════ ① 자동으로 안 고른다 ══════ */
test('★★ 단서는 «붙이는 잣대»가 아니다 — 자동 연결 쪽이 단서를 부르지 않는다', () => {
  /* 2026-08-28 에 이름으로 맞추다 남의 회사에 자료가 붙었다. 단서는 사람이 확인하는 것이다. */
  ['mailHit', 'alMailSure', 'alCalRows', 'alWrite', 'mailKeysOf'].forEach(n => {
    assert.doesNotMatch(code(grab(W, n)), /alHints/,
      n + ' 이 단서 셈을 부른다 — 단서가 자동 연결에 쓰이고 있다');
  });
});

test('★★ 만든이로 «후보를 좁히지» 않는다 — 떠서 돌려 본다', () => {
  /* ⚠ 글자로만 보면 못 잡는다. alCalRows 는 만든이를 «담기만» 해야 하는데,
     담는 것과 그것으로 «고르는» 것은 한 줄 차이라 돌려 봐야 안다.
     후보 둘 가운데 하나가 만든이의 업무여도, 후보는 «둘 그대로»여야 한다. */
  const b = calBox();
  const r = b.alCalRows(new Date('2026-09-14T00:00:00'),
    [{ id: 'e1', date: '2026-09-17', allDay: true, time: '', summary: '1630 가나정밀 방문',
       description: '', creator: 'hong@gmail.com' }], []);
  assert.equal(r.length, 1, '일정을 아예 못 모았다 — 이 검사가 헛돈다');
  assert.equal(r[0].cand.length, 2,
    '만든이(김보람)의 업무 하나로 좁혀 버렸다 — 자동으로 고르고 있다: ' + JSON.stringify(r[0].cand));
  assert.equal(r[0].by, 'P-004', '만든이를 담지 않았다 — 단서로 쓸 것이 없다');
});

test('★★ 만든이가 가리키는 것과 제목이 가리키는 것이 달라도 «둘 다» 남는다', () => {
  /* 실측: 「1630 일신정밀(일터)」 — 만든이는 자문(김보람), 제목의 「일터」는 컨설팅(권형하).
     한쪽만 남기면 틀린 쪽으로 사람을 몬다. */
  const b = 판();
  const x = X({ t: '📅 1630 가나정밀(일터상생)', by: 'P-004', sourceKind: 'gcal' });
  const h1 = b.alHints(x, 'A1'), h2 = b.alHints(x, 'A2');
  assert.ok(h1.some(h => /^만든이/.test(h.t)), '만든이 단서가 안 붙었다');
  assert.ok(h2.some(h => /^제목에/.test(h.t)), '제목 단서가 안 붙었다');
  assert.ok(h1.length && h2.length, '한쪽만 단서가 붙어 다른 쪽이 묻힌다');
});

/* ══════ ② 후보를 «구별할 수» 있다 ══════ */
test('★★ 후보 이름에 유형이 보인다 — 안 보이면 셋이 똑같이 나온다', () => {
  const b = 판();
  assert.match(b.alItemName(업무.A1), /자문/);
  assert.match(b.alItemName(업무.A2), /일터상생혁신컨설팅/);
  assert.notEqual(b.alItemName(업무.A1), b.alItemName(업무.A2));
});

test('★ 이름이 같으면 관리번호로 가른다', () => {
  const b = 판();
  const nm = b.alNames(['C1', 'C2']);
  assert.notEqual(nm.C1, nm.C2);
  assert.match(nm.C1, /급여-2026-001/);
});

test('★★ 번호까지 같은 «진짜 중복»은 등록일로 가른다 — 거기서 멈추면 못 고른다', () => {
  /* 실측: 노사발전재단 이음센터 둘 다 이음센터-2026-001 (7/27 · 9/17 등록) */
  const b = 판();
  const nm = b.alNames(['B1', 'B2']);
  assert.notEqual(nm.B1, nm.B2, '번호까지 같은데 이름이 같다 — 고를 수가 없다');
  assert.match(nm.B1, /2026-07-27/);
  assert.match(nm.B2, /2026-09-17/);
});

test('가를 필요가 없으면 번호를 안 붙인다 — 줄만 시끄러워진다', () => {
  const b = 판();
  const nm = b.alNames(['A1', 'A2']);
  assert.doesNotMatch(nm.A1 + nm.A2, /\d{4}-\d{2}-\d{2}/, '안 겹치는데 등록일을 붙였다');
});

/* ══════ ③ 단서가 맞게 붙는다 ══════ */
test('만든이 단서 — 그 일정을 만든 사람이 이 업무 담당일 때만', () => {
  const b = 판();
  const x = X({ t: '📅 가나정밀 방문', by: 'P-004', sourceKind: 'gcal' });
  assert.ok(b.alHints(x, 'A1').some(h => h.t === '만든이 김보람'));
  assert.ok(!b.alHints(x, 'A2').some(h => /^만든이/.test(h.t)), '담당이 아닌데 만든이 단서가 붙었다');
});

test('만든이를 모르면 그 단서는 안 붙는다 — 억지로 짐작하지 않는다', () => {
  const b = 판();
  const x = X({ t: '📅 가나정밀 방문', by: '', sourceKind: 'gcal' });
  assert.ok(!b.alHints(x, 'A1').some(h => /^만든이/.test(h.t)));
});

test('제목 단서 — 업무명과 겹친 «글자»를 그대로 적는다', () => {
  const b = 판();
  const x = X({ t: '✉ 9.14 메일 — 일터상생 컨설팅 관련', sourceKind: 'mail' });
  const h = b.alHints(x, 'A2').filter(h => /^제목에/.test(h.t))[0];
  assert.ok(h, '제목 단서가 없다');
  assert.match(h.t, /일터상생/, '무엇이 겹쳤는지 안 적는다 — 모르면 사람도 잘못 고른다');
});

test('★ 두 글자만 겹치면 제목 단서를 안 붙인다 — 아무 데나 걸린다', () => {
  /* 업무명이 「자문」 두 글자다. 제목에 그 두 글자가 «그대로» 있어도 붙이지 않는다 —
     「자문」은 아무 제목에나 걸린다. 세 글자부터 뜻이 생긴다. */
  const b = box({ items: { Z: { company: '가나', ptype: '자문', cat: '자문', state: '' } }, u2n: {} });
  assert.ok(!b.alHints(X({ t: '✉ 회사 자문 요청드립니다' }), 'Z').some(h => /^제목에/.test(h.t)),
    '두 글자로 제목 단서를 붙였다');
  /* 세 글자면 붙어야 한다 — 이 줄이 있어야 위의 「안 붙는다」가 뜻을 갖는다 */
  const b2 = box({ items: { Z: { company: '가나', ptype: '자문계약', cat: '자문', state: '' } }, u2n: {} });
  assert.ok(b2.alHints(X({ t: '✉ 회사 자문계약 요청드립니다' }), 'Z').some(h => /^제목에/.test(h.t)));
});

test('담당자 이름이 글에 있으면 단서가 된다 — 「가야엔지니어링 오전-최」', () => {
  const b = 판();
  assert.ok(b.alHints(X({ t: '📅 가나정밀 오전 - 김보람' }), 'A1').some(h => /김보람/.test(h.t)));
});

test('단서가 없다고 «없음»을 적지 않는다 — 없는 쪽이 틀린 것처럼 보인다', () => {
  /* ⚠ 상자(vm) 안에서 만든 배열은 deepEqual 로 견주면 튕긴다 — 길이로 본다 */
  const b = 판();
  assert.equal(b.alHints(X({ t: '✉ 아무 말' }), 'C1').length, 0);
});

/* ══════ ④ 계정 표 — 푸른캘린더와 같은 셈 ══════ */
test('★★ 구글 계정 열쇠 셈이 푸른캘린더와 «같다» — 다르면 이어 둔 사람을 못 찾는다', () => {
  const mine = code(grab(W, 'alMailKey')).replace(/alMailKey/, 'X');
  const theirs = code(grab(CAL, 'gcalMailKey')).replace(/gcalMailKey/, 'X');
  const norm = s => s.replace(/\s+/g, '').replace(/"/g, "'");
  assert.equal(norm(mine), norm(theirs),
    '푸른캘린더(pu-cal.html gcalMailKey)와 셈이 갈라졌다 — 한쪽만 고치면 단서가 조용히 안 뜬다');
});

test('점이 쉼표로 담긴 열쇠를 찾는다 — 실시간DB 열쇠에 점을 못 쓴다', () => {
  const b = 판();
  assert.equal(b.alSidByMail('Hong@Gmail.com'), 'P-004', '대소문자·점을 못 맞춘다');
  assert.equal(b.alSidByMail('daepyo@gmail.com'), 'P-001', '{sid:…} 꼴을 못 읽는다');
  assert.equal(b.alSidByMail('nobody@gmail.com'), '');
  assert.equal(b.alSidByMail(''), '');
});

test('계정 표를 못 읽어도 안 넘어진다 — 단서가 하나 줄 뿐이다', () => {
  const b = box({ items: 업무, u2n: U2N, mailSid: null });
  assert.equal(b.alSidByMail('hong@gmail.com'), '');
  assert.deepEqual(b.alHints(X({ t: '📅 가나정밀', by: 'P-004' }), 'A1')
    .filter(h => /^만든이/.test(h.t)).length, 1, '표가 없어도 by 로는 붙어야 한다');
});

/* ══════ ⑤ 만든이를 «담아 둔다» ══════ */
test('★ 일정을 모을 때 만든이를 함께 담는다 — 나중에 단서로 쓴다', () => {
  const c = code(grab(W, 'alCalRows'));
  assert.match(c, /by:alSidByMail\(r\.creator\)/, '구글 일정의 만든이를 안 담는다');
  assert.match(c, /by:String\(x\.sid\|\|''\)/, '우리 표 일정의 만든이를 안 담는다');
  assert.match(code(grab(W, 'alWrite')), /by:String\(r\.by\|\|''\)/, '「고를 것」에 만든이를 안 적는다');
});

/* ══════ ⑥ 화면 ══════ */
test('★ 단서가 붙은 후보가 위로 — 차례만 바꾼다', () => {
  const m = code(grab(W, 'alPickModal'));
  assert.match(m, /alHints\(x,b\)\.length-alHints\(x,a\)\.length/, '단서로 차례를 안 바꾼다');
  assert.match(m, /alPick\(/, '고르는 길이 없다');
  assert.match(m, /업무 아님/, '「업무 아님」 길이 없다');
});

test('단서에 «왜»가 붙는다 — 모르면 사람도 기계처럼 잘못 고른다', () => {
  const b = 판();
  b.alHints(X({ t: '📅 가나정밀', by: 'P-004', sourceKind: 'gcal' }), 'A1')
    .forEach(h => assert.ok(h.why && h.why.length > 4, '까닭이 없다: ' + JSON.stringify(h)));
  assert.match(code(grab(W, 'alPickModal')), /title="'\+esc\(h\.why\)/, '까닭을 화면에 안 단다');
});

test('모양이 CSS 에 있다', () => {
  ['.alpk{', '.alpb{', '.alh{'].forEach(c => assert.ok(CSS.indexOf(c) >= 0, c + ' 없음'));
});
