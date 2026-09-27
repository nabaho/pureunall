'use strict';
// 📥 받은 자료 (급여데이터함 도착 칸) — node --test tests/work-paydata-arrivals.test.js
//
// 대표 지시 2026-09-27 — 「업무관리 연결 지도」(docs/업무관리-연결현황-2026-09-10.md) ①
//
// 이 검사가 지키는 것
//   ①★ 자리 «수»로 센다 — 숫자를 더하면 같은 자료를 두 번 담았을 때 장수가 어긋난다
//   ②★ 열쇠는 co_id 하나다 — 상호를 다듬어 맞추면 조용히 어긋난다
//   ③  종류 이름이 급여데이터함과 «같다» — 두 화면이 다른 말로 부르면 같은 것인지 모른다
//   ④  「아직 안 읽었다」와 「읽었는데 없다」를 섞지 않는다
//   ⑤  읽기만 한다 — 적지도 지우지도 않는다
//   ⑥  양 끝 — 미리 받기와 그리기가 둘 다 있다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
const STORE = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-paydata-store.js'), 'utf8');

function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}
function line(re) { const m = W.match(re); assert.ok(m, '못 찾음: ' + re); return m[0]; }

function box(src) {
  const b = { console, String, Object, Array, Number, Date, isNaN, RegExp };
  vm.createContext(b);
  vm.runInContext(
    line(/var PD_KINDS=[\s\S]*?\];/) + '\n'
    + line(/var PD_MONTHS=\d+;/) + '\n'
    + 'var pdSrc=' + JSON.stringify(src || {}) + ';\n'
    + [grab('pdSlotName'), grab('pdRows')].join('\n'), b);
  return b;
}

const 올해 = new Date().getFullYear();
const 이번달 = String(올해) + '09';

/* ── ① 세는 법 ── */

test('★ 자리 «수»로 센다 — 숫자를 더하지 않는다', () => {
  const b = box({ C1: { [이번달]: {
    attend: { a: 1757000000000, b: 1757000001000, c: 1757000002000 },
    ledger: { d: 1757000003000 }, last: 1757000003000 } } });
  const r = b.pdRows({ co_id: 'C1' });
  assert.equal(r.length, 1);
  assert.equal(r[0].n, 4, '장수가 틀립니다: ' + JSON.stringify(r[0]));
  assert.deepEqual(Array.from(r[0].kinds), ['근태 3장', '급여대장 1장']);
});

test('세는 코드가 «더하기»를 안 쓴다 — 시각을 더하면 천문학적 숫자가 나온다', () => {
  const src = grab('pdRows').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.ok(/Object\.keys\([^)]*\)\.length/.test(src), '자리 수로 세지 않습니다');
});

test('빈 종류는 줄에 안 넣는다 — 「근태 0장」은 읽는 사람을 헷갈리게 한다', () => {
  const b = box({ C1: { [이번달]: { attend: {}, ledger: { a: 1 } } } });
  assert.deepEqual(Array.from(b.pdRows({ co_id: 'C1' })[0].kinds), ['급여대장 1장']);
});

test('한 장도 없는 달은 아예 안 보인다', () => {
  const b = box({ C1: { [이번달]: { last: 1757000000000 }, '202608': { attend: { a: 1 } } } });
  const r = b.pdRows({ co_id: 'C1' });
  assert.equal(r.length, 1);
  assert.equal(r[0].slot, '202608');
});

/* ── 차례와 개수 ── */

test('최근 달부터 보이고 세 달까지만 본다', () => {
  const b = box({ C1: {
    '202606': { attend: { a: 1 } }, '202607': { attend: { a: 1 } },
    '202608': { attend: { a: 1 } }, '202609': { attend: { a: 1 } } } });
  assert.deepEqual(b.pdRows({ co_id: 'C1' }).map(r => r.slot), ['202609', '202608', '202607']);
});

test('「늘 두는 것」(근로계약서)은 달과 상관없이 맨 뒤에 붙는다', () => {
  const b = box({ C1: {
    '202609': { attend: { a: 1 } }, keep: { contract: { a: 1, b: 1 } } } });
  const r = b.pdRows({ co_id: 'C1' });
  assert.deepEqual(r.map(x => x.slot), ['202609', 'keep']);
  assert.equal(r[1].name, '늘 두는 것');
  assert.deepEqual(Array.from(r[1].kinds), ['근로계약서 2장']);
});

test('올해면 해를 안 적고, 지난해면 적는다', () => {
  const b = box({});
  assert.equal(b.pdSlotName(String(올해) + '09'), '9월');
  assert.equal(b.pdSlotName(String(올해 - 1) + '12'), (올해 - 1) + '년 12월');
  assert.equal(b.pdSlotName('keep'), '늘 두는 것');
});

test('모르는 칸 이름은 그대로 둔다 — 억지로 달로 읽지 않는다', () => {
  const b = box({});
  ['', 'abc', '20269', '2026091'].forEach(v => {
    assert.equal(b.pdSlotName(v), String(v), v);
  });
});

/* ── ④ 안 읽음 vs 없음 ── */

test('★ 「아직 안 읽었다」와 「읽었는데 없다」를 섞지 않는다', () => {
  assert.equal(box({}).pdRows({ co_id: 'C1' }), null, '안 읽었는데 빈 배열을 줬습니다');
  assert.deepEqual(Array.from(box({ C1: {} }).pdRows({ co_id: 'C1' })), []);
});

test('업체 번호가 없는 업무는 아예 안 묻는다', () => {
  assert.equal(box({}).pdRows({}), null);
  assert.equal(box({}).pdRows(null), null);
});

/* ── ② 열쇠 ── */

test('★★ 열쇠는 co_id 하나다 — 상호를 다듬어 맞추지 않는다', () => {
  const src = grab('pdRows') + grab('dPayDataHTML');
  assert.ok(src.indexOf('co_id') >= 0, 'co_id 를 안 씁니다');
  ['coKeysOf', '_coNorm', '_normCo', 'company'].forEach(k => {
    assert.equal(src.replace(/\/\*[\s\S]*?\*\//g, ' ').indexOf(k), -1,
      '상호로 맞추고 있습니다: ' + k);
  });
});

test('읽는 자리가 급여데이터함이 «적는» 자리와 같다', () => {
  assert.ok(/var PD_ROOT='paydata\/arrivals';/.test(W), '읽는 자리가 다릅니다');
  assert.ok(STORE.indexOf("DB_ROOT + '/arrivals/'") >= 0,
    '급여데이터함이 적는 자리가 바뀌었습니다 — 읽는 쪽도 함께 고쳐야 합니다');
});

/* ── ③ 이름이 같은가 ── */

test('★ 종류와 이름이 급여데이터함과 «글자 그대로» 같다', () => {
  const b = box({});
  const mine = {};
  b.PD_KINDS.forEach(p => { mine[p[0]] = p[1]; });
  const seg = STORE.slice(STORE.indexOf('var KINDS = ['), STORE.indexOf('];', STORE.indexOf('var KINDS = [')));
  const theirs = {};
  seg.replace(/key:\s*'([^']+)',\s*label:\s*'([^']+)'/g, (m, k, l) => { theirs[k] = l; return m; });
  assert.ok(Object.keys(theirs).length >= 5, '급여데이터함 종류를 못 읽었습니다');
  Object.keys(theirs).forEach(k => {
    assert.equal(mine[k], theirs[k],
      '종류 이름이 다릅니다: ' + k + ' — 여기는 「' + mine[k] + '」, 급여데이터함은 「' + theirs[k] + '」');
  });
});

/* ── ⑤ 읽기만 ── */

test('★ 적지도 지우지도 않는다', () => {
  const i = W.indexOf('급여데이터함에 「자료가 왔나」');
  const j = W.indexOf("var CO_MAIL_ROOT='pucards/coMail';");
  assert.ok(i >= 0 && j > i, '토막을 못 찾았습니다');
  const blk = W.slice(W.lastIndexOf('/*', i), j).replace(/\/\*[\s\S]*?\*\//g, ' ');
  ['.set(', '.update(', '.remove(', 'addLog('].forEach(k => {
    assert.equal(blk.indexOf(k), -1, '쓰고 있습니다: ' + k);
  });
  /* ⚠ 배열의 push 는 쓰기가 아니다(kinds.push). 데이터베이스를 만지는 곳만 본다 —
     이 토막의 fbDb.ref 는 «모두» once 로 끝나야 한다. */
  const refs = blk.match(/fbDb\.ref\([\s\S]{0,80}/g) || [];
  assert.ok(refs.length, 'fbDb.ref 를 하나도 안 씁니다 — 검사가 헛돌고 있습니다');
  refs.forEach(r => {
    assert.ok(r.indexOf('.once(') >= 0, '읽기가 아닌 데이터베이스 호출이 있습니다: ' + r.slice(0, 60));
  });
});

test('그 업체 «한 칸»만 읽는다 — 업체가 사천 곳이다', () => {
  const src = grab('pdLoad').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.ok(/ref\(PD_ROOT\s*\+\s*'\/'\s*\+/.test(src), '도착 칸을 통째로 읽습니다');
});

test('못 읽어도 조용히 넘어간다 — 권한이나 통신 탓으로 서랍이 멈추면 안 된다', () => {
  const src = grab('pdLoad');
  assert.ok(/pdSrc\[i\]=\{\};\s*_pdT\[i\]=0;\s*\}\)/.test(src.replace(/\s+/g, ' ').replace(/ /g, '')) ||
    src.indexOf('function(){ pdSrc[i]={}; _pdT[i]=0; }') >= 0,
    '읽기 실패를 안 받아 줍니다');
});

/* ── ⑥ 양 끝 ── */

test('★ 미리 받기와 그리기가 «둘 다» 있다', () => {
  assert.ok(W.indexOf('pdLoad(_pk)') >= 0, '서랍을 열 때 안 받아 옵니다 — 늘 비어 보입니다');
  assert.ok(W.indexOf('h+=dPayDataHTML(it);') >= 0, '상자를 안 그립니다');
  assert.ok(W.indexOf('function dPayDataHTML(') >= 0, '그리는 함수가 없습니다');
});

test('설명(ⓘ)이 붙어 있다 — 급여관리 한 줄과 헷갈리지 않게', () => {
  assert.ok(W.indexOf("hlp('pd')") >= 0, 'ⓘ 를 안 붙였습니다');
  assert.ok(/\n\s*pd:'/.test(W), 'HELP 에 설명이 없습니다');
});

test('메일 바로 아래에 있다 — 둘 다 「무엇이 들어왔나」다', () => {
  const a = W.indexOf('h+=dMailHTML(it,id);');
  const b = W.indexOf('h+=dPayDataHTML(it);');
  assert.ok(a >= 0 && b > a && b - a < 400, '메일 상자 바로 아래가 아닙니다');
});
