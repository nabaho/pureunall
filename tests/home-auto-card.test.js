'use strict';
/* 홈페이지 월간 자동 연결 — 왼쪽 기둥의 «자동 연결» 카드 · 멈춤 할 일 · 서버 부르기 (설계 2026-10-05).
   ★ 화면 함수를 떼어 상자(vm)에서 실제로 그려 본다. 글자를 통째로 박지 않는다 —
     «숫자와 말이 갈라져 있는가», «빈 값을 안 그리는가», «묻고 나서 부르는가»를 본다. */
const test = require('node:test');
const assert = require('node:assert');
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
    else if (c === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}
function constLine(name) {
  const m = new RegExp('\\nconst ' + name + ' = [^\\n]*;').exec(html);
  assert.ok(m, 'const ' + name + ' 을 찾지 못했습니다');
  return m[0].replace(/\nconst /, '\nvar ');
}

function 상자(더) {
  const 부른것 = [];
  const ctx = Object.assign({
    console: { warn() {}, log() {} },
    App: { autoRuns: null, autoErr: '', members: {}, partners: {}, companies: [], staff: [], render() {} },
    esc: (s) => String(s == null ? '' : s),
    stampShort: (t) => 'T' + t,
    todayString: () => '2026-10-05',
    toast() {}, say: async () => {}, askYes: async () => true,
    openModal() {}, closeModal() {}, modalHead: (t) => '<h2>' + t + '</h2>', modalFoot: () => '',
    firebase: { auth: () => ({ currentUser: { getIdToken: async () => 'tok' } }) },
    fetch: async (url, opt) => { 부른것.push([url, JSON.parse(opt.body)]); return { ok: true, status: 200, json: async () => ({ ok: true, 내림: [], 못내림: [], 내릴것: [] }) }; },
    db: { ref: () => ({ once: async () => ({ val: () => null }) }) },
    window: {}
  }, 더 || {});
  ctx.부른것 = 부른것;
  vm.createContext(ctx);
  vm.runInContext([constLine('HOME_AUTO_URL'), fnSource('다음자동날'), fnSource('마지막자동'),
    fnSource('자동카드Html'), fnSource('자동부르기'), fnSource('자동지금돌리기'), fnSource('자동승인'),
    fnSource('자동대상이름'), fnSource('자동기록다시읽기'), fnSource('자동줄목록'),
    fnSource('자동결과알리기')].join('\n'), ctx);
  return ctx;
}
const 기록 = (r) => ({ '2026-10': { a: Object.assign({ at: 5, 방식: '돌리기', ok: true, 내림: [], 못내림: [], 멈춤: '', 후보: [] }, r) } });

test('다음 돌 때는 «다음 달 1일» — 해가 바뀌는 달도', () => {
  const ctx = 상자();
  assert.strictEqual(ctx.다음자동날('2026-10-05'), '2026-11-01');
  assert.strictEqual(ctx.다음자동날('2026-12-31'), '2027-01-01');
  assert.strictEqual(ctx.다음자동날('2026-01-01'), '2026-02-01');
});

test('마지막 기록은 «가장 늦은 때»의 것 — 달이 섞여 있어도', () => {
  const ctx = 상자();
  ctx.App.autoRuns = { '2026-09': { x: { at: 9 } }, '2026-10': { y: { at: 3 }, z: { at: 7 } } };
  assert.strictEqual(ctx.마지막자동().at, 9);
  ctx.App.autoRuns = { '2026-09': { x: { at: 2 } }, '2026-10': { y: { at: 3 }, z: { at: 7 } } };
  assert.strictEqual(ctx.마지막자동().at, 7, '처음 본 것을 마지막으로 읽었습니다');
});

test('카드 — 내린 것이 없는 달은 그 줄을 비워 그리지 않는다(빈 숫자 칸 금지)', () => {
  const ctx = 상자();
  ctx.App.autoRuns = 기록({ 내림: [], 못내림: [] });
  const h = ctx.자동카드Html();
  assert.ok(!/<b>\s*<\/b>/.test(h), '빈 숫자 칸을 그렸습니다: ' + h);
});

test('카드 — 아직 돈 적이 없으면 숫자 0 을 그리지 않는다', () => {
  const ctx = 상자();
  const h = ctx.자동카드Html();
  assert.ok(!/>0</.test(h), '0 을 그렸습니다: ' + h);
  assert.ok(h.includes('2026-11-01'), '다음 돌 날이 안 보입니다');
});

test('카드 — 내린 수는 «숫자 칸»이 따로 있다(말과 붙여 쓰지 않는다)', () => {
  const ctx = 상자();
  ctx.App.autoRuns = 기록({ 내림: [{ 종류: '퇴사' }, { 종류: '계약종료' }] });
  const h = ctx.자동카드Html();
  assert.match(h, /<b>2<\/b>/, '내린 수가 숫자 칸으로 안 보입니다: ' + h);
});

test('카드 — 미리 보기·지금 돌리기·기록 단추가 있다', () => {
  const h = 상자().자동카드Html();
  for (const f of ['자동미리보기()', '자동지금돌리기()', '자동기록창()']) assert.ok(h.includes(f), f + ' 가 없습니다');
});

test('지금 돌리기 — «예»를 안 누르면 서버를 안 부른다', async () => {
  const ctx = 상자({ askYes: async () => false });
  await ctx.자동지금돌리기();
  assert.strictEqual(ctx.부른것.length, 0);
});

test('지금 돌리기 — «예»를 누르면 «돌리기»로 부른다', async () => {
  const ctx = 상자();
  await ctx.자동지금돌리기();
  assert.strictEqual(ctx.부른것.length, 1);
  assert.strictEqual(ctx.부른것[0][1].mode, '돌리기');
  assert.strictEqual(ctx.부른것[0][0], ctx.HOME_AUTO_URL);
});

test('승인 — 멈춘 기록의 «지문»을 그대로 들고 «승인»으로 부른다', async () => {
  const ctx = 상자();
  ctx.App.autoRuns = 기록({ 멈춤: '6건', 지문: 'people_board:1,people_board:2', 후보: [{ 종류: '퇴사', srl: 1 }, { 종류: '퇴사', srl: 2 }] });
  await ctx.자동승인();
  assert.strictEqual(ctx.부른것.length, 1);
  assert.strictEqual(ctx.부른것[0][1].mode, '승인');
  assert.strictEqual(ctx.부른것[0][1].지문, 'people_board:1,people_board:2');
});

test('승인 — 멈춘 기록이 없으면 부르지 않는다', async () => {
  const ctx = 상자();
  ctx.App.autoRuns = 기록({});
  await ctx.자동승인();
  assert.strictEqual(ctx.부른것.length, 0);
});

test('승인 — «예»를 안 누르면 부르지 않는다', async () => {
  const ctx = 상자({ askYes: async () => false });
  ctx.App.autoRuns = 기록({ 멈춤: '6건', 지문: 'people_board:1', 후보: [{ srl: 1 }] });
  await ctx.자동승인();
  assert.strictEqual(ctx.부른것.length, 0);
});

test('대상 이름은 화면이 우리 자료에서 붙인다 — sid 는 직원, companyId 는 업체', () => {
  const ctx = 상자();
  ctx.App.staff = [{ sid: 'S1', name: '홍길동' }];
  ctx.App.companies = [{ id: 'C1', name: '가나상사' }];
  assert.ok(ctx.자동대상이름({ sid: 'S1' }).includes('홍길동'));
  assert.ok(ctx.자동대상이름({ companyId: 'C1' }).includes('가나상사'));
  assert.ok(ctx.자동대상이름({ srl: 9 }).includes('9'), '이름을 모르면 글 번호라도 보여야 합니다');
});

test('할 일 — 마지막 자동이 «멈춤»이면 승인으로 가는 할 일이 맨 앞에 뜬다', () => {
  const 몸 = fnSource('jobsOf').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const i = 몸.indexOf('자동승인()');
  assert.ok(i > 0, '멈춤 할 일에서 승인으로 가는 단추가 없습니다');
  /* 「맨 앞」 — 다른 할 일(add 부름) 중 가장 먼저 나와야 한다 */
  const 첫add = 몸.indexOf('add({');
  assert.ok(첫add > 0 && i < 몸.indexOf('add({', 첫add + 5), '멈춤 할 일이 맨 앞이 아닙니다');
});

test('카드 — 올린 수도 숫자 칸으로 보인다(2단계)', () => {
  const ctx = 상자();
  ctx.App.autoRuns = 기록({ 올림: [{ 종류: '새거래처', srl: 9 }] });
  const h = ctx.자동카드Html();
  assert.match(h, /<b>1<\/b>/);
});

test('할 일 — 못 올렸거나 올리는 길이 없으면 알린다(조용히 넘어가지 않는다)', () => {
  const 몸 = fnSource('jobsOf').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(몸, /올리기안됨/);
  assert.match(몸, /못올림/);
});

test('왼쪽 기둥에 자동 연결 카드가 실린다', () => {
  assert.match(fnSource('railHtml'), /자동카드Html\(\)/);
});

test('자동 기록은 화면을 열 때 함께 읽는다 — 못 읽으면 따로 알린다', () => {
  const 몸 = fnSource('loadAll');
  assert.match(몸, /homepage\/auto\/runs/);
  assert.match(몸, /autoErr/);
});
