/* 데이터관리 2D 그림 — «빡빡하게 붙어 확인이 안 되는» 일이 다시 생기지 않게 (대표 2026-11-22)
   ★ 값이 아니라 «규칙»을 본다
   ① B 사람 구슬 2D: 이름표는 서로·원·가로축 숫자·그은 선과 겹치지 않는다. 멀리 둔 이름의 잇는 선은 다른 원·이름을 가로지르지 않는다
      (가로지르면 엉뚱한 원을 가리키는 것처럼 보인다). 자리가 끝내 없으면 «생략»(null)할 뿐, 겹쳐 그리거나 가로질러 잇지 않는다.
   ② E 업체 도시 2D: 업체 목록은 구역·«미수만»으로 거르고, 고른 차례(입금·업무·미수)대로 줄을 세운다. 입금을 못 읽으면 업무 차례로.
   js/pu-datahub-view.js 의 진짜 함수를 떼어 vm 에서 돌린다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-datahub-view.js'), 'utf8').replace(/\r\n/g, '\n');
const fn = (decl) => { const s = cutFn(SRC, decl); assert.ok(s, decl + ' 를 못 찾았다'); return s; };

function labelKit() {
  const ctx = {};
  const names = ['leadFrom', 'segHitsBox', 'lineCrosses', 'boxFree', 'labelSpot', 'edgeSpot'];
  vm.runInNewContext(names.map((nm) => fn('function ' + nm + '(')).join('\n') +
    '\n;globalThis.K={' + names.map((nm) => nm + ':' + nm).join(',') + '};', ctx);
  return ctx.K;
}
const G = { measureText: (t) => ({ width: String(t).length * 7 }) };   /* 글자 폭 흉내 — 한 글자 7px */
const overlap = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];

/* drawBalls2D 와 같은 차례로 놓는다: 원 상자 + 축 숫자 상자 → 큰 원부터 둘레 → 못 놓으면 가장자리 → 그래도 없으면 생략 */
function place(K, pts, plot) {
  pts.forEach((o) => { o.p = { name: o.name }; o.ro = o.ro || o.r; o.box = [o.x - o.ro - 2, o.y - o.ro - 2, o.ro * 2 + 4, o.ro * 2 + 4]; });
  const circleBoxes = pts.map((o) => o.box);
  const ob = { boxes: circleBoxes.slice(), labs: [], lines: [] };
  for (let ti = 0; ti <= 4; ti++) { const tb = [plot.padL + (ti / 4) * plot.pw - 14, plot.padT + plot.ph + 7, 28, 16]; ob.boxes.push(tb); ob.labs.push(tb); }
  const out = [];
  const put = (o, s) => {
    ob.boxes.push(s.box); ob.labs.push(s.box);
    if (s.far) { const a = K.leadFrom(o, s.lx, s.ly); ob.lines.push([a[0], a[1], s.lx, s.ly]); }
    out.push({ o, s });
  };
  const order = pts.slice().sort((a, b) => b.r - a.r), rest = [];
  order.forEach((o) => {
    const s = K.labelSpot(G, o, ob, [plot.padL + 2, plot.padT - 2, plot.W - 2, plot.H - 2], pts);
    if (s) put(o, s); else rest.push(o);
  });
  rest.sort((a, b) => a.y - b.y).forEach((o) => {
    const s = K.edgeSpot(G, o, ob, plot.padL + 4, plot.W - 6, plot.padT + 8, plot.padT + plot.ph - 2, pts);
    if (s) put(o, s); else out.push({ o, s: null });
  });
  return { out, circleBoxes, ob };
}
/* 놓인 이름의 잇는 선이 다른 원·(제 것 말고) 이름을 지나가지 않나 */
function linesClean(K, out, pts, ob) {
  out.filter((x) => x.s && x.s.far).forEach(({ o, s }) => {
    assert.ok(!K.lineCrosses(o, s.lx, s.ly, pts, ob.labs.filter((b) => b !== s.box)), o.name + ' 잇는 선이 다른 원·이름을 가로지른다 — 엉뚱한 원을 가리키는 것처럼 보인다');
  });
}
const PLOT = { W: 520, H: 420, padL: 58, padT: 62, pw: 438, ph: 318 };

test('★★ ① 바닥에 몰린 사람(입금 0 직원 셋)도 이름이 서로·원과 겹치지 않고 모두 붙는다', () => {
  const K = labelKit(), base = PLOT.padT + PLOT.ph;
  const pts = [
    { name: '대표노무사', x: 200, y: 200, r: 14 }, { name: '노무사가', x: 200, y: 262, r: 14 }, { name: '노무사긴이름보기', x: 196, y: 300, r: 13 },
    { name: '노무사나', x: 330, y: 262, r: 14 },
    { name: '직원라', x: 198, y: base, r: 8, ro: 14 }, { name: '직원마', x: 226, y: base, r: 8, ro: 14 }, { name: '직원바', x: 248, y: base, r: 8 },   /* 라·마는 초록 고리(바깥 반지름 ro)까지 원 */
  ];
  const { out, circleBoxes, ob } = place(K, pts, PLOT);
  assert.ok(out.every((x) => x.s), '자리가 있는데 이름을 생략했다: ' + out.filter((x) => !x.s).map((x) => x.o.name).join(','));
  const labs = out.map((x) => x.s.box);
  labs.forEach((a, i) => labs.forEach((b, j) => { if (i < j) assert.ok(!overlap(a, b), out[i].o.name + ' 와 ' + out[j].o.name + ' 이름이 겹친다'); }));
  out.forEach(({ o, s }) => circleBoxes.forEach((cb, ci) => {
    if (pts[ci] === o) return;
    assert.ok(!overlap(s.box, cb), o.name + ' 이름이 ' + pts[ci].name + ' 원을 덮는다');
  }));
  linesClean(K, out, pts, ob);
});

test('★ ① 좁은 그림(폰)에서도 겹치거나 가로질러 잇지 않는다 — 안 되면 생략', () => {
  const K = labelKit(), narrow = { W: 330, H: 300, padL: 58, padT: 62, pw: 248, ph: 198 }, base = narrow.padT + narrow.ph;
  const pts = [
    { name: '대표노무사', x: 140, y: 150, r: 10 }, { name: '노무사가', x: 140, y: 190, r: 10 }, { name: '노무사긴이름보기', x: 137, y: 212, r: 9 },
    { name: '노무사나', x: 215, y: 190, r: 10 },
    { name: '직원라', x: 139, y: base, r: 6 }, { name: '직원마', x: 158, y: base, r: 6 }, { name: '직원바', x: 162, y: base, r: 6 },
  ];
  const { out, ob } = place(K, pts, narrow);
  const placed = out.filter((x) => x.s);
  placed.forEach((a, i) => placed.forEach((b, j) => { if (i < j) assert.ok(!overlap(a.s.box, b.s.box), a.o.name + ' 와 ' + b.o.name + ' 이름이 겹친다'); }));
  linesClean(K, placed, pts, ob);
});

test('★ ① 너무 빽빽하면 «생략»할 뿐 겹쳐 그리지 않는다', () => {
  const K = labelKit(), tiny = { W: 200, H: 160, padL: 40, padT: 30, pw: 150, ph: 100 };
  const pts = [];
  for (let i = 0; i < 30; i++) pts.push({ name: '점검사람' + i, x: 80 + (i % 6) * 4, y: 90 + Math.floor(i / 6) * 3, r: 7 });
  const { out, ob } = place(K, pts, tiny);
  const placed = out.filter((x) => x.s);
  assert.ok(out.some((x) => !x.s), '이 정도로 빽빽하면 일부는 생략돼야 맞다(겹쳐 그렸을 수 있다)');
  placed.forEach((a, i) => placed.forEach((b, j) => { if (i < j) assert.ok(!overlap(a.s.box, b.s.box), '생략 대신 겹쳐 그렸다'); }));
  linesClean(K, placed, pts, ob);
});

test('★★ ② E 업체 목록 — 구역·미수로 거르고 고른 차례대로 줄을 세운다', () => {
  const co = (id, inc12, task, misu, misuAmt) => ({ id, inc12, task, misu, misuAmt });
  const groups = [
    { key: 'P1', list: [co('a', 900, 1, false, 0), co('b', 100, 7, true, 50), co('c', 500, 3, true, 300)] },
    { key: 'P2', list: [co('d', 700, 0, false, 0), co('e', 0, 9, false, 0)] },
  ];
  const ALL = groups.flatMap((g) => g.list);
  function run(eState, sort, FO) {
    const ctx = { cityGroups: () => groups, eState, finOk: () => FO !== false, E2D: { sort, off: 0 } };
    vm.runInNewContext(fn('function e2dList(') + '\n;globalThis.out = e2dList().map(function (x) { return x.co.id; });', ctx);
    return ctx.out;
  }
  const by = (k) => (ids) => ids.map((id) => ALL.find((x) => x.id === id)[k]);
  const desc = (arr) => arr.slice().sort((x, y) => y - x);
  const all = { focus: null, misu: false };
  const inc = run(all, 'inc'), task = run(all, 'task'), misu = run(all, 'misu');
  assert.deepEqual(by('inc12')(inc), desc(by('inc12')(inc)), '입금 큰 차례가 아니다');
  assert.deepEqual(by('task')(task), desc(by('task')(task)), '업무 많은 차례가 아니다');
  const m = by('misu')(misu); assert.ok(m.indexOf(false) > m.lastIndexOf(true), '미수 업체가 먼저 오지 않는다');
  assert.equal(inc.length, ALL.length, '거르지 않으면 모든 업체');
  const p2 = groups[1].list.map((x) => x.id);
  assert.ok(run({ focus: 'P2', misu: false }, 'inc').every((id) => p2.includes(id)), '구역을 고르면 그 구역 업체만');
  assert.ok(run({ focus: null, misu: true }, 'inc').every((id) => ALL.find((x) => x.id === id).misu === true), '«미수만»이면 미수 업체만');
  const noFin = run(all, 'inc', false);
  assert.deepEqual(by('task')(noFin), desc(by('task')(noFin)), '입금을 못 읽으면 업무 차례로');
});

test('② E 2D 는 한 줄에 한 업체(줄 칸 누르기) — 점마다 이름을 다는 옛 점 그림으로 돌아가지 않는다', () => {
  const d = fn('function drawCity2D(');
  assert.match(d, /e2dList\(\)/, '업체 목록 함수로 그려야 한다');
  assert.match(d, /rect: \[/, '줄 하나가 누를 칸이어야 한다');
  assert.ok(!/circle: \[/.test(d), '점(원) 누르기는 옛 점 그림 방식이다');
  assert.match(d, /list\.slice\(E2D\.off, E2D\.off \+ ps\)/, '한 쪽에 들어가는 만큼씩만 그려야 한다(넘겨 보기)');
  assert.match(d, /E2D\.want/, '3D 에서 고른 업체 쪽으로 넘기는 일은 그릴 때 한다(3D 만 볼 때도 잃지 않게)');
});
