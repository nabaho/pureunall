/* 목록 정리 — 대표 지시 2026-09-14
   ① 「퇴사 내려가면 모든 이름 다 보일 필요 없을 것 같다」 → 내려간 사람은 기본에서 뺀다
   ② 「주요업무 순서를 바꿀 수 있게 해달라. 쉽게 변경할 수 있어야 한다」 → 줄마다 ▲▼

   ★ ①에서 가장 중요한 것은 «세는 곳과 보이는 곳이 같은 규칙을 쓰는가»다.
     「전체 9」라 적혀 있는데 눌러 보니 7줄이면 사람은 목록이 고장 났다고 여긴다
     (자문사에서 실제로 겪었다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8');
const H = html.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

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

/* ══════ ① 내려간 사람은 기본에서 뺀다 ══════ */
function 줄상자(줄들) {
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    App: { group: 'members', filter: '', q: '', coType: '', check: { members: {} },
           pageConfig: {}, pages: {} },
    rowsOf: () => 줄들.map(r => Object.assign({}, r)),
    feeMatch: () => true,
    직원줄: () => ({ key: 'people', name: '일반직원' }),
    needsAttentionRow: (r) => !!r.status && r.status !== 'same' && r.status !== 'done',
    statOf: () => ({ hot: 0, own: {}, kept: 0 }),
    pillShort: (s) => String(s),
    postedNames: () => [],
    MEMBER_KINDS: [{ key: 'nomu', label: '노무사' }],
    OWN_LABEL: {}, STATUS_TEXT: { done: '내려감 (퇴사 완료)', toRemove: '내릴 것 (퇴사)' },
    직원쪽: 'people'
  };
  vm.createContext(ctx);
  vm.runInContext([fnSource('visibleRows'), fnSource('chipsHtml'),
    fnSource('listCountHtml')].join('\n'), ctx);
  return ctx;
}
const 아홉 = [
  { key: '190', name: '권형하', status: 'same', mkind: 'nomu' },
  { key: '193', name: '홍길동', status: 'done', mkind: 'nomu', roster: { kind: 'left', label: '퇴사' } },
  { key: '195', name: '김서방', status: 'same', mkind: 'nomu' },
  { key: '281', name: '이몽룡', status: 'done', mkind: 'nomu', roster: { kind: 'left', label: '퇴사' } },
  { key: '304', name: '성춘향', status: 'toRemove', mkind: 'nomu', roster: { kind: 'left', label: '퇴사' } }
];

test('★★ 내려간 사람은 기본 목록에서 빠진다 — 할 일이 끝난 줄이다', () => {
  const ctx = 줄상자(아홉);
  const 보임 = ctx.visibleRows('members').map(r => r.name);
  assert.ok(!보임.includes('홍길동') && !보임.includes('이몽룡'),
    '★★ 내려간 사람이 아직 목록에 있습니다: ' + 보임.join(', '));
  assert.ok(보임.includes('권형하') && 보임.includes('김서방'));
});

test('★★ «내릴 것»은 남는다 — 아직 할 일이다', () => {
  const 보임 = 줄상자(아홉).visibleRows('members').map(r => r.name);
  assert.ok(보임.includes('성춘향'),
    '★★ 아직 안 내린 퇴사자까지 감췄습니다 — 그러면 영영 안 내려갑니다');
});

test('★★ 감추는 것이 아니다 — 「내려감」 딱지를 누르면 다 나온다', () => {
  const ctx = 줄상자(아홉);
  ctx.App.filter = 'done';
  const 보임 = ctx.visibleRows('members').map(r => r.name);
  assert.deepEqual(보임.slice().sort(), ['이몽룡', '홍길동'].sort());
});

test('★★★ 세는 곳과 보이는 곳이 «같은 규칙»을 쓴다 — 첫 딱지 수 = 실제 줄 수', () => {
  const ctx = 줄상자(아홉);
  const 보이는수 = ctx.visibleRows('members').length;
  const 첫딱지 = /onclick="App\.filt\(''\)">([^<]*)<span class="c">(\d+)<\/span>/.exec(ctx.chipsHtml());
  assert.ok(첫딱지, '걸러 보기를 푸는 딱지가 없습니다');
  assert.equal(Number(첫딱지[2]), 보이는수,
    '★★★ 「' + 첫딱지[1] + '」에 적힌 수와 실제 줄 수가 다릅니다');
  assert.ok(첫딱지[1].indexOf('전체') < 0,
    '★★ 뺀 것이 있는데 「전체」라고 적습니다 — 거짓말입니다: ' + 첫딱지[1]);
});

test('뺀 것이 없으면 첫 딱지는 그대로 「전체」다', () => {
  const ctx = 줄상자(아홉.filter(r => r.status !== 'done'));
  const 첫딱지 = /onclick="App\.filt\(''\)">([^<]*)<span/.exec(ctx.chipsHtml());
  assert.match(첫딱지[1], /전체/);
});

test('★ 목록 머리가 «뺐다»고 말한다 — 조용히 빼면 목록을 의심한다', () => {
  const ctx = 줄상자(아홉);
  const 머리 = ctx.listCountHtml();
  assert.match(머리, /내려간 2명은 뺐음/, '뺀 것을 안 알립니다: ' + 머리);
  assert.match(머리, /구성원 <b>5명<\/b>/, '전체 사람 수는 그대로 말해야 합니다');
});

/* ══════ ② 주요업무 차례 바꾸기 ══════ */
function 차례상자(옵) {
  const o = Object.assign({ 못읽음: false, 저장탈: null }, 옵 || {});
  const 한것 = [];
  const cfg = {
    work1: { label: '자문서비스', order: 1 },
    work2: { label: '인사노무컨설팅', order: 2 },
    work3: { label: '노동사건대리', order: 3 },
    inquiry: { label: '오시는길', order: 8 },
    greeting: { label: '인사말', order: 9 }
  };
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    App: { pageConfig: cfg, render() { 한것.push({ 무엇: 'render' }); } },
    PAGE_IDS: ['work1', 'work2', 'work3', 'inquiry', 'greeting'],
    직원쪽: 'people',
    refuseIfPageConfigUnread: () => o.못읽음,
    savePageConfig(next) {
      한것.push({ 무엇: 'save', next: JSON.parse(JSON.stringify(next)) });
      return o.저장탈 ? Promise.reject(new Error(o.저장탈)) : Promise.resolve();
    },
    said: [],
    say(t) { ctx.said.push(String(t)); return Promise.resolve(); }
  };
  vm.createContext(ctx);
  vm.runInContext([fnSource('pageIdsOf'), fnSource('쪽차례'),
    fnSource('쪽위로'), fnSource('쪽아래로')].join('\n'), ctx);
  return { ctx, 한것 };
}

test('★★ 아래로 한 칸 — 차례가 자료에 저장된다', async () => {
  const { ctx, 한것 } = 차례상자();
  assert.equal(await ctx.쪽아래로('work1'), true);
  const 담김 = 한것.find(x => x.무엇 === 'save');
  assert.ok(담김, '★★ 저장하지 않았습니다 — 새로 고치면 되돌아갑니다');
  assert.equal(담김.next.work2.order, 1);
  assert.equal(담김.next.work1.order, 2);
  assert.equal(담김.next.work3.order, 3);
});

test('★★ 위로 한 칸', async () => {
  const { 한것 } = 차례상자();
  const ctx = 차례상자().ctx;
  assert.equal(await ctx.쪽위로('work3'), true);
});

test('★★ 차례를 «보이는 순서 그대로» 1,2,3… 으로 다시 매긴다', async () => {
  const { ctx, 한것 } = 차례상자();
  await ctx.쪽아래로('work1');
  const n = 한것.find(x => x.무엇 === 'save').next;
  const 주요 = ['work1', 'work2', 'work3'].map(k => n[k].order).sort((a, b) => a - b);
  assert.deepEqual(주요, [1, 2, 3], '차례가 비거나 겹칩니다 — 다음에 엉뚱하게 튑니다');
});

test('★★ 주요업무가 아닌 쪽(오시는길·인사말)은 «안 건드린다»', async () => {
  const { ctx, 한것 } = 차례상자();
  await ctx.쪽아래로('work1');
  const n = 한것.find(x => x.무엇 === 'save').next;
  assert.ok(n.inquiry && n.greeting, '★★ 딴 쪽을 목록에서 지웠습니다');
  assert.ok(n.inquiry.order > 3 && n.greeting.order > 3,
    '★ 주요업무 뒤에 있어야 합니다');
});

test('맨 위에서 위로 · 맨 아래에서 아래로는 아무 일도 안 한다', async () => {
  const a = 차례상자(); assert.equal(await a.ctx.쪽위로('work1'), false);
  assert.ok(!a.한것.some(x => x.무엇 === 'save'), '끝에서 움직여 저장했습니다');
  const b = 차례상자(); assert.equal(await b.ctx.쪽아래로('work3'), false);
  assert.ok(!b.한것.some(x => x.무엇 === 'save'));
});

test('목록에 없는 쪽 이름은 아무 일도 안 한다', async () => {
  const { ctx, 한것 } = 차례상자();
  assert.equal(await ctx.쪽아래로('없는쪽'), false);
  assert.deepEqual(한것, []);
});

test('쪽 목록을 «못 읽은» 채로는 차례를 저장하지 않는다', async () => {
  const { ctx, 한것 } = 차례상자({ 못읽음: true });
  assert.equal(await ctx.쪽아래로('work1'), false);
  assert.deepEqual(한것, []);
});

test('저장이 실패하면 «됐다»고 하지 않는다', async () => {
  const { ctx } = 차례상자({ 저장탈: '권한이 없습니다' });
  assert.equal(await ctx.쪽아래로('work1'), false);
  assert.ok(ctx.said.some(t => /저장하지 못했습니다/.test(t)));
});

test('★★ 줄마다 ▲▼ 가 있고, 줄 고르기와 섞이지 않는다', () => {
  const s = fnSource('rowsHtml');
  assert.match(s, /쪽위로\(/, '★★ 차례를 올리는 단추가 줄에 없습니다');
  assert.match(s, /쪽아래로\(/);
  assert.match(s, /event\.stopPropagation\(\);쪽위로/,
    '★★ 화살표를 누르면 그 줄이 함께 골라집니다 — 멈춰야 합니다');
  assert.match(s, /App\.group === 'work'/, '주요업무 갈래에서만 나와야 합니다');
  /* 끝 줄에서는 눌러도 소용없으므로 꺼 둔다 */
  assert.match(s, /i === 0 \? ' disabled'/);
  assert.match(s, /i === rows\.length - 1 \? ' disabled'/);
});

test('★ 화살표 꾸밈이 있다 — 없으면 글자만 둘 떠 있다', () => {
  assert.match(html, /(?:^|\n)\.ob\{/, '.ob 꾸밈이 없습니다');
  assert.match(html, /(?:^|\n)\.ord\{/, '.ord 꾸밈이 없습니다');
});
