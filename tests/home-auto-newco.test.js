'use strict';
/* 홈페이지 월간 자동 연결 2단계 — 새 거래처에 «로고»와 «공개 동의»를 넣는 화면 (설계 2026-10-05).
   ★ 넣어 두면 다음 달 1일에 서버가 자문사현황에 올린다. 공개 동의가 없으면 안 올린다.
   ★ 화면 함수를 떼어 상자(vm)에서 실제로 돌린다. 이름은 예시(가나상사)만. */
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
  const 쓴것 = [];
  const ctx = Object.assign({
    console: { warn() {}, log() {} },
    PARTNER_PATH: 'homepage/partners',
    App: { partners: {}, companies: [], render() {}, isAdmin: true },
    db: { ref: (p) => ({
      set: async (v) => { 쓴것.push(['set', p, v]); },
      update: async (v) => { 쓴것.push(['update', p, v]); }
    }) },
    esc: (s) => String(s == null ? '' : s),
    toast() {}, say: async () => {}, askYes: async () => true,
    currentUserName: () => '관리자', todayString: () => '2026-10-05',
    로고그림다루기: async () => ({ dataUrl: 'data:image/png;base64,QUJD', w: 300, h: 80, 바이트: 3, 흰테두리: false }),
    window: {}
  }, 더 || {});
  ctx.쓴것 = 쓴것;
  vm.createContext(ctx);
  vm.runInContext([constLine('새거래처기준일'), constLine('로고파일한도'),
    fnSource('새거래처목록'), fnSource('새로고넣기'), fnSource('공개동의저장'),
    fnSource('새로올리기칸Html'), fnSource('partnerMark')].join('\n'), ctx);
  return ctx;
}
const 회사 = (id, 더) => Object.assign({ id, name: '가나상사', status: 'active', monthlyAdvisoryFee: '300000',
  contractStartDate: '2026-10-02' }, 더 || {});

test('새 거래처 = 기준일 뒤 계약·거래 중·자문료 있음·사무대행 아님·아직 안 이은 것', () => {
  const ctx = 상자();
  ctx.App.companies = [
    회사('A'),                                                   // 든다
    회사('B', { contractStartDate: '2025-01-01' }),              // 옛 거래처
    회사('C', { status: 'closed' }),                             // 끝남
    회사('D', { status: 'suboffice' }),                          // 사무대행
    회사('E', { monthlyAdvisoryFee: '0' }),                      // 자문료 없음
    회사('F'),                                                   // 이미 이음
    회사('G')                                                    // 안 올림으로 정함
  ];
  ctx.App.partners = { F: { boardSrl: 9 }, G: { posted: false } };
  const r = JSON.parse(JSON.stringify(ctx.새거래처목록()));
  assert.deepStrictEqual(r.map(x => x.id), ['A']);
});

test('새 거래처 — 로고·동의를 다 넣었으면 «할 것»이 아니라 «올라갈 것»이다', () => {
  const ctx = 상자();
  ctx.App.companies = [회사('A'), 회사('B')];
  ctx.App.partners = { B: { posted: true, consent: { date: '2026-10-05' }, logo: { bytes: 9 } } };
  const r = JSON.parse(JSON.stringify(ctx.새거래처목록()));
  assert.strictEqual(r.find(x => x.id === 'A').준비, false);
  assert.strictEqual(r.find(x => x.id === 'B').준비, true);
});

test('로고 넣기 — 그림은 로고 자리에, 표시는 그 회사 «로고 칸 하나»에만 쓴다', async () => {
  const ctx = 상자();
  ctx.App.partners = { A: { posted: true, boardSrl: undefined, keep: { why: 'x' } } };
  assert.strictEqual(await ctx.새로고넣기('A', { type: 'image/png' }), true);
  const 자리 = ctx.쓴것.map(x => x[0] + ' ' + x[1]);
  assert.ok(자리.includes('set homepage/logoFiles/A'), 자리.join(' | '));
  assert.ok(자리.includes('set homepage/partners/A/logo'), 자리.join(' | '));
  assert.ok(!자리.includes('set homepage/partners/A'), '회사 자리를 통째로 덮었습니다');
  const 파일 = ctx.쓴것.find(x => x[1] === 'homepage/logoFiles/A')[2];
  assert.strictEqual(파일.b64, 'QUJD');
  assert.strictEqual(ctx.App.partners.A.keep.why, 'x', '남기기 표시가 사라졌습니다');
});

test('로고 넣기 — 너무 큰 그림은 안 받는다', async () => {
  const ctx = 상자({ 로고그림다루기: async () => ({ dataUrl: 'data:image/png;base64,QUJD', w: 600, h: 300, 바이트: 10 * 1024 * 1024, 흰테두리: false }) });
  assert.strictEqual(await ctx.새로고넣기('A', {}), false);
  assert.strictEqual(ctx.쓴것.length, 0);
});

test('로고 넣기 — 흰 배경이 딸려 왔으면 묻고, «아니오»면 안 넣는다', async () => {
  const ctx = 상자({ askYes: async () => false,
    로고그림다루기: async () => ({ dataUrl: 'data:image/png;base64,QUJD', w: 300, h: 80, 바이트: 3, 흰테두리: true }) });
  assert.strictEqual(await ctx.새로고넣기('A', {}), false);
  assert.strictEqual(ctx.쓴것.length, 0);
});

test('공개 동의 — 날짜가 있어야 하고, 저장하면 «올림»도 함께 표시한다', async () => {
  const ctx = 상자();
  assert.strictEqual(await ctx.공개동의저장('A', ''), false);
  assert.strictEqual(await ctx.공개동의저장('A', '2026/10/5'), false, '날짜 모양을 안 봅니다');
  assert.strictEqual(ctx.쓴것.length, 0);
  assert.strictEqual(await ctx.공개동의저장('A', '2026-10-05'), true);
  const w = ctx.쓴것[0];
  assert.strictEqual(w[0], 'update', '회사 자리를 통째로 덮으면 안 됩니다');
  assert.strictEqual(w[1], 'homepage/partners/A');
  assert.strictEqual(w[2]['consent/date'], '2026-10-05');
  assert.strictEqual(w[2].posted, true);
});

test('편집칸 — 다 넣었으면 «다음 달 1일에 올라간다», 빠졌으면 무엇이 빠졌는지', () => {
  const ctx = 상자();
  ctx.App.partners = { A: { posted: true, consent: { date: '2026-10-05' }, logo: { bytes: 9, w: 300, h: 80 } } };
  const 다 = ctx.새로올리기칸Html({ key: 'A' });
  assert.match(다, /다음 달 1일/);
  ctx.App.partners = { A: {} };
  const 빠짐 = ctx.새로올리기칸Html({ key: 'A' });
  assert.match(빠짐, /type="file"/, '로고 넣는 칸이 없습니다');
  assert.match(빠짐, /type="date"/, '동의 날짜 칸이 없습니다');
  assert.ok(!/다음 달 1일에 저절로 올라갑니다/.test(빠짐), '빠진 것이 있는데 올라간다고 합니다');
});

test('편집칸 — 이미 로고와 이었으면 «새로 올리기» 칸을 안 그린다', () => {
  const ctx = 상자();
  ctx.App.partners = { A: { boardSrl: 185 } };
  assert.strictEqual(ctx.새로올리기칸Html({ key: 'A' }), '');
});

test('할 일·자문사 편집칸이 새 부품을 쓴다', () => {
  assert.match(fnSource('jobsOf'), /새거래처목록/);
  assert.match(fnSource('partnerEdit'), /새로올리기칸Html\(/);
});
