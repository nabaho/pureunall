'use strict';
// 🚩 서랍에 현장 방문 — node --test tests/work-drawer-visits.test.js
//
// 대표 지시 2026-10-03 「다음」 → 목업 → 「진행」 (연결 지도 ②)
//
// 이 검사가 지키는 것
//   ①★ 번호로 맞으면 번호만 — 확실한 것 옆에 이름 짐작을 섞지 않는다
//   ②★ 이름으로는 «통째로 같은» 상호만, 그리고 그렇다고 상자에 적는다
//   ③  사진 셈은 「내 현장 방문」과 같은 잣대 — 「기록 없음」과 「증빙 없음」을 가른다
//   ④  아직 안 읽었으면 «없음»이라 하지 않는다 · 못 읽어도 다시 조르지 않는다
//   ⑤  보기만 한다 — 적는 곳이 없다 · 줄은 정부사업일정으로 보낸다
//   ⑥  양 끝 — 받는 곳(renderDrawer)과 그리는 곳이 다 있다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');
function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}
const nocom = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

const COS = [
  { id: 'c1', name: '가나정밀', erpId: 'CS-1' },                 // 컨설팅 번호로
  { id: 'c2', name: '(주)다라물산', co_id: 'co-9' },              // 업체 번호로
  { id: 'c3', name: '마바건설' },                                 // 이름뿐
  { id: 'c4', name: '마바건설공업' },                             // 비슷한 이름 — 안 붙어야 한다
  { id: 'c5', name: '가나정밀', deleted: true }                   // 같은 이름의 지운 것
];
const SCH = {
  s1: { id: 's1', coId: 'c1', date: '2026-08-21', round: 1, typeId: 't1', attId: 'g1', isField: true },
  s2: { id: 's2', coId: 'c1', date: '2026-09-10', round: 2, typeId: 't1', attId: 'g1', isField: true },
  s3: { id: 's3', coId: 'c1', date: '2026-09-28', round: 3, typeId: 't1', attId: 'g1', coAttIds: ['g2'], isField: true },
  s4: { id: 's4', coId: 'c1', date: '2099-10-15', round: 4, typeId: 't1', attId: 'g1', isField: true },
  s5: { id: 's5', coId: 'c1', date: '2026-09-29', round: 3, typeId: 't1', attId: 'g1', isField: false },
  s6: { id: 's6', coId: 'c3', date: '2026-09-01', round: 1, typeId: 't1', attId: 'g1', isField: true },
  s7: { id: 's7', coId: 'c4', date: '2026-09-02', round: 1, typeId: 't1', attId: 'g1', isField: true },
  s8: { id: 's8', coId: 'c5', date: '2026-09-03', round: 1, typeId: 't1', attId: 'g1', isField: true }
};
const LOG = { a: { sid: 's1', t: '2026-08-10T09:00', slot: 0 },   // 사진 이력이 이때부터
              b: { sid: 's3', t: '2026-09-28T15:00', slot: 0 }, c: { sid: 's3', t: '2026-09-28T15:01', slot: 1 } };

function box(o) {
  o = o || {};
  const b = {
    console, String, Object, Array, Number, Date, isNaN, RegExp, Math, JSON, Promise,
    S: { me: { sid: 'S1', name: '박한별' } },
    VIS: o.empty ? { scheds: null, log: null } : { scheds: SCH, cos: COS, types: [{ id: 't1', name: '일터혁신' }],
      gstaff: [{ id: 'g1', name: '박한별' }, { id: 'g2', name: '장한돌' }], log: LOG },
    esc: (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])),
    escJ: (x) => String(x == null ? '' : x).replace(/\\/g, '\\\\').replace(/'/g, "\\'"),
    loads: 0
  };
  vm.createContext(b);
  vm.runInContext(
    'var VD_MAX=6, _vdTried=false;\n'
    + 'function md(s){var p=String(s).split("-");return p.length===3?(+p[1])+"/"+(+p[2]):s;}\n'
    + 'function hlp(){ return ""; }\n'
    + 'function dFoldHead(i,t,r){ return "<H>"+t+"|"+r+"</H>"; }\n'
    + 'function dFold(k,head,full,empty){ return empty ? head : full; }\n'
    + 'function visToday(){ return "2026-10-03"; }\n'
    + 'function visLoad(){ loads++; return Promise.resolve(); }\n'
    + ['_normCo', 'visRows', 'visName', 'visMine', 'visPhotoMap', 'visSince', 'visCoOf', 'visAttIds',
       'vdNeed', 'vdLoad', 'vdCosFor', 'vdRows', 'vdPill', 'vdRowHTML', 'dVisitsHTML'].map(grab).join('\n'), b);
  return b;
}

test('★ 컨설팅 번호(erpId)로 맞으면 그 사업장 — 같은 이름의 지운 사업장은 안 섞는다', () => {
  const b = box();
  const m = b.vdCosFor({ company: '가나정밀', ref: { type: 'consulting', id: 'CS-1' } });
  assert.deepEqual(Array.from(m.ids), ['c1']);
  assert.equal(m.guess, false);
});

test('업체 번호(co_id)로도 맞는다 — 자문 업무에서도 그 사업장 방문이 보인다', () => {
  const b = box();
  const m = b.vdCosFor({ company: '다라물산', co_id: 'co-9', ref: { type: 'companies', id: 'co-9' } });
  assert.deepEqual(Array.from(m.ids), ['c2']);
  assert.equal(m.guess, false);
});

test('★ 이름으로는 «통째로 같은» 상호만 — 「마바건설공업」은 「마바건설」이 아니다', () => {
  const b = box();
  const m = b.vdCosFor({ company: '㈜ 마바건설' });
  assert.deepEqual(Array.from(m.ids), ['c3']);
  assert.equal(m.guess, true, '이름으로 이은 것이라고 적지 않습니다');
  const h = b.dVisitsHTML({ company: '마바건설' });
  assert.match(h, /회사 이름으로 이은 것/);
  assert.equal(b.vdCosFor({ company: '가' }).ids.length, 0, '한 글자 상호로 맞췄습니다');
  /* 같은 이름의 «지운» 사업장은 이름으로 잇지 않는다 */
  assert.deepEqual(Array.from(b.vdCosFor({ company: '가나정밀' }).ids), ['c1'], '지운 사업장을 이름으로 이었습니다');
});

test('★ 번호로 맞은 것이 있으면 이름으로는 더 찾지 않는다', () => {
  const b = box();
  /* 이 업무의 상호는 「마바건설」인데 번호는 c1(가나정밀) 쪽에 걸려 있다 — 번호가 이긴다 */
  const m = b.vdCosFor({ company: '마바건설', ref: { type: 'consulting', id: 'CS-1' } });
  assert.deepEqual(Array.from(m.ids), ['c1']);
});

test('짝이 없으면 상자를 안 그린다', () => {
  const b = box();
  assert.equal(b.dVisitsHTML({ company: '없는회사' }), '');
});

test('★ 줄 — 최근 것부터 · 예정 · 사무실 · 사진 n장 · 증빙 없음 · 기록 없음을 가른다', () => {
  const b = box();
  const h = b.dVisitsHTML({ company: '가나정밀', ref: { type: 'consulting', id: 'CS-1' } });
  const at = (s) => h.indexOf("visGo('" + s + "')");
  assert.ok(at('s4') < at('s5') && at('s5') < at('s3') && at('s3') < at('s2') && at('s2') < at('s1'), '최근 것부터가 아닙니다');
  const row = (s) => h.slice(at(s), h.indexOf('</div>', at(s)));
  assert.match(row('s4'), /예정/);
  assert.match(row('s5'), /사무실/);
  assert.match(row('s3'), /사진 2장/);
  assert.match(row('s3'), /박한별·장한돌/, '같이 간 사람이 안 나옵니다');
  assert.match(row('s2'), /증빙 없음/);
  assert.match(row('s1'), /사진 1장/);
  /* 머리 — 「최근」은 «지난» 방문이다(예정은 최근이 아니다) */
  assert.match(h, /최근 9\/29 · 3회차/);
});

test('사진 이력을 보기 «전» 방문은 「기록 없음」 — 「증빙 없음」이라 하면 넣은 것을 안 넣었다고 읽는다', () => {
  const b = box();
  b.VIS.scheds = Object.assign({}, SCH, { s0: { id: 's0', coId: 'c1', date: '2026-07-01', round: 0, typeId: 't1', isField: true } });
  const h = b.dVisitsHTML({ company: '가나정밀', ref: { type: 'consulting', id: 'CS-1' } });
  const i = h.indexOf("visGo('s0')");
  assert.ok(i < 0 || /기록 없음/.test(h.slice(i, h.indexOf('</div>', i))));
  b.VIS.scheds = { s0: b.VIS.scheds.s0 };
  assert.match(b.dVisitsHTML({ company: '가나정밀', ref: { type: 'consulting', id: 'CS-1' } }), /기록 없음/);
});

test('여섯 줄까지만 — 나머지는 몇 번인지만', () => {
  const b = box();
  const many = {};
  for (let k = 1; k <= 9; k++) many['m' + k] = { id: 'm' + k, coId: 'c1', date: '2026-09-0' + k, round: k, typeId: 't1', isField: true };
  b.VIS.scheds = many;
  const h = b.dVisitsHTML({ company: '가나정밀', ref: { type: 'consulting', id: 'CS-1' } });
  assert.equal((h.match(/visGo\(/g) || []).length, 6);
  assert.match(h, /3번 더/);
});

test('★ 아직 안 읽었으면 「없음」이라 하지 않는다 · 못 읽어도 다시 조르지 않는다', async () => {
  const b = box({ empty: true });
  assert.equal(b.dVisitsHTML({ company: '가나정밀' }), '', '읽기 전에 빈 상자를 그렸습니다');
  /* 사업장 명단만 오고 일정은 못 받았을 때(한 칸만 권한 실패) — 「아직 없음」이라 하면 거짓이다 */
  b.VIS.cos = COS;
  assert.equal(b.dVisitsHTML({ company: '가나정밀', ref: { type: 'consulting', id: 'CS-1' } }), '', '일정을 못 받았는데 「없음」을 그렸습니다');
  assert.equal(b.vdNeed(), true);
  await b.vdLoad();
  assert.equal(b.vdNeed(), false, '못 읽었는데 또 받으려 합니다 — 서랍이 끝없이 다시 그려집니다');
  assert.equal(b.loads, 1);
});

/* ── ⑤⑥ ── */

test('보기만 한다 — 적는 곳이 없고, 줄은 정부사업일정으로 보낸다', () => {
  const src = nocom(['vdNeed', 'vdLoad', 'vdCosFor', 'vdRows', 'vdRowHTML', 'dVisitsHTML'].map(grab).join('\n'));
  assert.doesNotMatch(src, /\.(set|update|push|remove|transaction)\(/, '적는 곳이 있습니다');
  assert.match(grab('vdRowHTML'), /onclick="visGo\(/);
});

test('양 끝 — 서랍이 받고(renderDrawer) 그린다, ⓘ 설명이 있다', () => {
  const rd = nocom(grab('renderDrawer'));
  assert.match(rd, /if\(vdNeed\(\)\) vdLoad\(\)/, '받는 곳이 없습니다');
  assert.match(rd, /h\+=dVisitsHTML\(it\);/, '그리는 곳이 없습니다');
  assert.match(W.slice(W.indexOf('var HELP={'), W.indexOf('function hlp(')), /vd:'/);
});
