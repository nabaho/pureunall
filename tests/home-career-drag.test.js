/* 경력 줄 끌어다 놓기 + 번호 자동 저장 — 대표 지시 2026-09-14
   「번호가 자동 저장되게 해라. 순서를 마우스 드래그로 위아래로 이동 가능하게 해라」

   ★ 지켜야 할 것
     ① 끌어다 놓으면 «끼워 넣는다» — 맞바꾸면 스무 줄짜리에서 엉뚱한 줄이 튄다
     ② 옮기고 나면 «스스로 저장»한다 (끌기·화살표 둘 다)
     ③ 글자를 고칠 때는 저장하지 않는다 — 한 글자마다 서버를 두드리면 안 된다
     ④ 글 칸(input)은 끌기에서 뺀다 — 안 빼면 글자를 고르려다 줄이 끌려간다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8');

function fnSource(name) {
  const re = new RegExp('(?:^|\\n)(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(html);
  assert.ok(m, name + ' 를 화면에서 찾지 못했습니다');
  const start = m.index + (m[0][0] === '\n' ? 1 : 0);
  let mode = null, depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    const c = html[i], n = html[i + 1];
    if (mode === '/*') { if (c === '*' && n === '/') { mode = null; i++; } continue; }
    if (mode === '//') { if (c === '\n') mode = null; continue; }
    if (mode) { if (c === '\\') { i++; continue; } if (c === mode) mode = null; continue; }
    if (c === '/' && n === '*') { mode = '/*'; i++; continue; }
    if (c === '/' && n === '/') { mode = '//'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { mode = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}
const constLine = (name) => {
  const m = new RegExp('\\nconst ' + name + ' = [^\\n]*;').exec(html);
  assert.ok(m, 'const ' + name + ' 을 찾지 못했습니다');
  return m[0].replace(/\nconst /, '\nvar ');
};

function 상자(줄들) {
  const 한것 = [];
  const ctx = {
    console: { warn() {}, log() {} },
    App: { draft: { kind: 'member', key: '190', careers: (줄들 || []).slice() },
           dirty: false, render() { 한것.push('render'); } },
    saveDraft() { 한것.push('save'); return Promise.resolve(); },
    $: () => null
  };
  vm.createContext(ctx);
  vm.runInContext([constLine('경력끌기'), fnSource('careerMove'), fnSource('careerMoveTo'),
    fnSource('careerDragStart'), fnSource('careerDragEnd'),
    fnSource('careerDragOver'), fnSource('careerDragLeave'), fnSource('careerDrop')].join('\n'), ctx);
  return { ctx, 한것 };
}
const 다섯 = ['가', '나', '다', '라', '마'];

test('★★ 끌어다 놓으면 «끼워 넣는다» — 맞바꾸지 않는다', () => {
  const { ctx } = 상자(다섯);
  assert.equal(ctx.careerMoveTo(0, 3), true);
  assert.deepEqual(Array.from(ctx.App.draft.careers), ['나', '다', '라', '가', '마'],
    '★★ 맞바꿨습니다 — 스무 줄짜리에서 엉뚱한 줄이 위로 튑니다');
});

test('★ 아래에서 위로도 끼워 넣는다', () => {
  const { ctx } = 상자(다섯);
  ctx.careerMoveTo(4, 1);
  assert.deepEqual(Array.from(ctx.App.draft.careers), ['가', '마', '나', '다', '라']);
});

test('★★ 옮기고 나면 «스스로 저장»한다 — 끌기', () => {
  const { ctx, 한것 } = 상자(다섯);
  ctx.careerMoveTo(0, 2);
  assert.ok(한것.indexOf('save') >= 0, '★★ 옮기고 저장을 안 했습니다 — 수고가 사라집니다');
  assert.ok(한것.indexOf('render') >= 0);
});

test('★★ 화살표로 옮겨도 «스스로 저장»한다 — 두 길이 같아야 한다', () => {
  const { ctx, 한것 } = 상자(다섯);
  ctx.careerMove(1, 1);
  assert.deepEqual(Array.from(ctx.App.draft.careers), ['가', '다', '나', '라', '마']);
  assert.ok(한것.indexOf('save') >= 0,
    '★★ 화살표는 저장이 안 됩니다 — 어느 것이 저장됐는지 알 수 없습니다');
});

test('제자리에 놓거나 끝을 넘으면 아무 일도 안 한다', () => {
  const a = 상자(다섯); assert.equal(a.ctx.careerMoveTo(2, 2), false);
  assert.deepEqual(a.한것, [], '제자리인데 저장했습니다');
  const b = 상자(다섯); assert.equal(b.ctx.careerMoveTo(0, 9), false);
  assert.deepEqual(b.한것, []);
  const c = 상자(다섯); assert.equal(c.ctx.careerMoveTo(-1, 2), false);
  const d = 상자(다섯); d.ctx.careerMove(0, -1);
  assert.deepEqual(d.한것, [], '맨 위에서 위로 눌렀는데 저장했습니다');
});

test('초안이 없으면 아무 일도 안 한다', () => {
  const { ctx, 한것 } = 상자(다섯);
  ctx.App.draft = null;
  assert.equal(ctx.careerMoveTo(0, 1), false);
  ctx.careerMove(0, 1);
  assert.deepEqual(한것, []);
});

test('★ 끌던 줄과 놓은 줄이 같으면 안 옮긴다', () => {
  const { ctx, 한것 } = 상자(다섯);
  ctx.careerDragStart({ dataTransfer: {}, target: {} }, 2);
  ctx.careerDrop({ preventDefault() {}, target: {} }, 2);
  assert.deepEqual(Array.from(ctx.App.draft.careers), 다섯);
  assert.deepEqual(한것, []);
});

test('★ 끌기가 시작되지 않았으면 놓아도 안 옮긴다', () => {
  const { ctx } = 상자(다섯);
  ctx.careerDrop({ preventDefault() {}, target: {} }, 1);
  assert.deepEqual(Array.from(ctx.App.draft.careers), 다섯);
});

test('★★ 끌어서 놓으면 그 자리로 간다 (시작 → 놓기 한 벌)', () => {
  const { ctx } = 상자(다섯);
  ctx.careerDragStart({ dataTransfer: {}, target: {} }, 0);
  ctx.careerDrop({ preventDefault() {}, target: {} }, 3);
  assert.deepEqual(Array.from(ctx.App.draft.careers), ['나', '다', '라', '가', '마']);
});

/* ── 화면에 붙어 있나 ── */
test('★★ 줄마다 «손잡이»가 있고, 글 칸은 끌리지 않는다', () => {
  const s = fnSource('memberEdit');
  assert.match(s, /class="grip" draggable="true"/,
    '★★ 끌 손잡이가 없습니다');
  assert.match(s, /ondrop="careerDrop\(event,' \+ i \+ '\)"/);
  /* 글 칸에 draggable 을 걸면 글자를 고르려다 줄이 끌려간다 */
  const 줄 = /<input value="' \+ esc\(PuHomeCareer\.eraBody\(line\)\)[^']*'/.exec(s);
  assert.ok(줄, '경력 글 칸을 못 찾았습니다');
  assert.ok(줄[0].indexOf('draggable') < 0, '★★ 글 칸이 끌립니다 — 글자를 못 고릅니다');
});

test('★ ▲▼ 를 «없애지 않았다» — 끌기가 안 되는 자리가 있다', () => {
  const s = fnSource('memberEdit');
  assert.match(s, /careerMove\(' \+ i \+ ',-1\)/, '★ 위로 화살표가 사라졌습니다');
  assert.match(s, /careerMove\(' \+ i \+ ',1\)/, '★ 아래로 화살표가 사라졌습니다');
});

test('★ 놓을 자리가 «보인다» — 안 보이면 끌기가 도박이다', () => {
  assert.match(html, /(?:^|\n)\.car \.l\.over\{/, '놓을 자리 표시가 없습니다');
  assert.match(html, /(?:^|\n)\.car \.grip\{/, '손잡이 꾸밈이 없습니다');
  assert.match(html, /(?:^|\n)\.car \.l\.dragging\{/, '끌리는 줄 표시가 없습니다');
});

test('★★ 옮긴 뒤 「前 아래로 모으기」를 다시 돌리지 않는다', () => {
  /* 사람이 일부러 옮긴 자리를 기계가 도로 흩뜨리면 끌어다 놓은 뜻이 없다 */
  const s = fnSource('careerMoveTo');
  assert.ok(s.indexOf('careerSortEra') < 0,
    '★★ 옮기자마자 다시 줄을 세웁니다 — 끌어다 놓은 자리가 사라집니다');
});
