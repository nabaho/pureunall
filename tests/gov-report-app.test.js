'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 화면 검사 (2026-10-10)
 * ★ 지키는 것: 읽기만 한다 · 숫자 칸을 누르면 거르고 다시 누르면 풀린다 · 내 담당만 · 서고는 읽기만 ·
 *   오류·빈 상태 문구(설계서 §5) · 본문은 그리지 않는다
 * 공개 저장소다 — 합성 자료만(tests/helpers/gov-report-fixture.js). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const FakeDb = require('./helpers/fake-rtdb.js');
const F = require('./helpers/gov-report-fixture.js');
const L = require('../js/pu-gov-report-list.js');
const Rpt = require('../js/pu-gov-report.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-report.html'), 'utf8');
const INLINE = [...SRC.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');

function grab(n) {
  const i = SRC.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; st = true; }
    else if (SRC[j] === '}') { d--; if (st && !d) return SRC.slice(i, j + 1); }
  }
}
function varLine(n) {
  const m = SRC.match(new RegExp('var ' + n + '=\\{[^\\r\\n]*\\};'));
  assert.ok(m, n + ' 한 줄을 못 찾았다');
  return m[0];
}
const NAMES = ['grEsc', 'grToday', 'grFilter', 'grRenderFilters', 'grRenderKpis', 'grSetStatus', 'grRenderRows',
  'grRenderForms', 'grRenderAlerts', 'grRender', 'grReset', 'grLoad'];

function fakeEl() { return { innerHTML: '', textContent: '', value: '', checked: false, disabled: false, style: {} }; }
function world(o) {
  o = o || {};
  const db = FakeDb.만들기(o.seed || F.seed());
  const els = {};
  const ctx = { console: { warn() {} }, Promise, Object, Array, JSON, String, Number, Math, Date, RegExp, Error, isFinite,
    encodeURIComponent, PuGovReportList: L, PuGovReport: { FORMS: Rpt.FORMS },
    $: (id) => (els[id] = els[id] || fakeEl()),
    fbDb: o.db ? o.db(db) : db };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext([varLine('GR_NODES'), varLine('GR_FIELDS'), varLine('GR')].join('\n') + '\n' + NAMES.map(grab).join('\n')
    + "\ngrToday=function(){ return '2026-10-10'; };", ctx);
  if (o.email) vm.runInContext('GR.email=' + JSON.stringify(o.email) + ';', ctx);
  return { ctx, db, els };
}

test('정적 — 공통 머리와 새 모듈을 차례대로 싣는다', () => {
  ['js/pu-gov-report.js', 'js/pu-gov-report-build.js', 'js/pu-gov-report-list.js', 'js/pu-appbar.js', 'js/pu-back.js',
    'js/pu-gate.js', 'js/pu-whoami.js', 'js/pu-ls-guard.js', 'js/pu-logout-why.js', 'js/pu-ontology.js']
    .forEach((f) => assert.match(SRC, new RegExp('src="' + f.replace(/\./g, '\\.') + '\\?v=\\d+"'), f));
  assert.ok(SRC.indexOf('pu-gov-report-build.js') < SRC.indexOf('pu-gov-report-list.js'), 'build 를 먼저 싣는다');
  assert.match(SRC, /pu-ontology-write\.js\?v=\d+" data-mode="observe"/);
  assert.match(SRC, /PuGate\.show\(/);
  assert.match(SRC, /PuBack\.guard\(/);
  assert.match(SRC, /PuWhoami\.mount\('#who'\)/);
});

test('정적 — 아무것도 쓰지 않는다 · 일정 자리는 GR_NODES 로만 부른다', () => {
  assert.doesNotMatch(INLINE, /\.(set|update|remove|transaction)\s*\(/, '쓰기 명령이 있다');
  assert.doesNotMatch(INLINE, /ref\([^)]*\)\.push\(/, '쓰기 명령이 있다');
  assert.doesNotMatch(INLINE, /ref\(\s*['"]scal_(cos|types|scheds|staff)/, 'GR_NODES 를 거치지 않았다');
  assert.match(SRC, /불러오지 못했습니다 — 연결을 확인해 주세요/);
  assert.match(SRC, /올해 걸린 보고서가 없습니다 — 사업 걸기는 정부사업일정에서/);
});

test('① 불러오면 올해 줄 셋 — 단추는 정부사업일정 보고서 창으로, 작성 전은 비활성', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.rows.innerHTML;
  ['마바산업', '가나상사', '다라정밀'].forEach((n) => assert.ok(h.includes(n), n));
  assert.ok(!h.includes('사아테크'), '2025 줄은 올해 목록에 없다');
  assert.ok(!h.includes('본문은 목록에 나오면 안 된다'), '본문을 그렸다');
  assert.ok(h.includes('href="gov-consulting.html#rpt=c3|t4"'));
  assert.ok(h.includes('href="gov-consulting.html#rpt=c1|t1"'));
  assert.match(h, /<button type="button" class="act" disabled title="회차가 남았습니다">📄 작성<\/button>/);
  assert.ok(h.includes('AI 초안'));
  assert.ok(h.includes('양식 고르기'));
  assert.equal(w.db.쓴것.length, 0, '읽기만 해야 한다');
  assert.equal(w.els.empty.style.display, 'none');
});

test('② 숫자 칸 — 올해 기준, 누르면 거르고 다시 누르면 풀린다 · 서명·제출은 비활성', async () => {
  const w = world();
  await w.ctx.grLoad();
  const k = w.els.kpis.innerHTML;
  assert.match(k, /data-st=""[^>]*><b>3<\/b><span>전체/);
  assert.match(k, /data-st="todo"[^>]*><b>1<\/b><span>미작성/);
  assert.match(k, /data-st="signed" disabled/);
  w.ctx.grSetStatus('todo');
  assert.ok(w.els.rows.innerHTML.includes('마바산업'));
  assert.ok(!w.els.rows.innerHTML.includes('가나상사'));
  assert.equal(w.els.fStatus.value, 'todo');
  assert.match(w.els.kpis.innerHTML, /class="kpi on" data-st="todo"/);
  w.ctx.grSetStatus('todo');
  assert.ok(w.els.rows.innerHTML.includes('가나상사'), '다시 누르면 풀린다');
  w.ctx.grSetStatus('signed');
  assert.equal(w.ctx.GR.f.status, '', '서명 칸은 누를 수 없다');
});

test('③ 내 담당만 — 로그인 메일 → 담당자 번호, 주담당·부담당 줄만', async () => {
  const w = world({ email: 'p009@pureun.kr' });
  await w.ctx.grLoad();
  assert.equal(w.ctx.GR.me, 'a1');
  assert.equal(w.els.mineWrap.style.display, '');
  w.ctx.GR.f.mine = true;
  w.ctx.grRender();
  const h = w.els.rows.innerHTML;
  assert.ok(h.includes('가나상사') && h.includes('다라정밀'));
  assert.ok(!h.includes('마바산업'));
  const n = world();
  await n.ctx.grLoad();
  assert.equal(n.els.mineWrap.style.display, 'none', '담당자가 아니면 숨긴다');
});

test('④ 양식 서고 현황 — 읽기만, 등록·바꾸기는 정부사업일정으로', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.forms.innerHTML;
  Object.keys(Rpt.FORMS).forEach((fk) => assert.ok(h.includes(Rpt.FORMS[fk].name), fk));
  assert.ok(h.includes('2024'));
  assert.ok(h.includes('등록된 양식 없음'));
  assert.ok(h.includes('href="gov-consulting.html#forms"'));
});

test('⑤ 챙길 것 — 14일 넘은 미작성 · 7일 넘은 초안 · 서명 기다림 0', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.alerts.innerHTML;
  assert.match(h, /종료 후 14일 넘은 미작성 <b>1<\/b>/);
  assert.ok(h.includes('마바산업') && h.includes('종료 151일'));
  assert.match(h, /초안 7일 넘음 <b>1<\/b>/);
  assert.ok(h.includes('20일 전 고침'));
  assert.match(h, /서명 기다림 <b>0<\/b>/);
});

test('⑥ 못 읽으면 문구와 다시 시도 단추 — 목록은 숨긴다', async () => {
  const w = world({ db: (db) => ({ ref: (p) => (p === 'scal_cos'
    ? { once: async () => { throw new Error('permission_denied'); } } : db.ref(p)) }) });
  await w.ctx.grLoad();
  assert.ok(w.els.err.innerHTML.includes('불러오지 못했습니다 — 연결을 확인해 주세요'));
  assert.ok(w.els.err.innerHTML.includes('onclick="grLoad()"'));
  assert.equal(w.els.err.style.display, '');
  assert.equal(w.els.board.style.display, 'none');
});

test('⑦ 줄이 없으면 「올해 걸린 보고서가 없습니다」 · 거르개로 비면 다른 말', async () => {
  const s = F.seed(); s.scal_scheds = [];
  const w = world({ seed: s });
  await w.ctx.grLoad();
  assert.equal(w.els.empty.style.display, '');
  assert.equal(w.els.empty.textContent, '올해 걸린 보고서가 없습니다 — 사업 걸기는 정부사업일정에서');
  const v = world();
  await v.ctx.grLoad();
  v.ctx.GR.f.co = '없는업체';
  v.ctx.grRender();
  assert.equal(v.els.empty.textContent, '조건에 맞는 보고서가 없습니다.');
});

test('⑧ 연도를 바꾸면 그 해 줄 — 검토완료는 ⬇ HWPX', async () => {
  const w = world();
  await w.ctx.grLoad();
  assert.ok(w.els.fYear.innerHTML.includes('value="2025"'));
  w.ctx.GR.f.year = '2025';
  w.ctx.grRender();
  const h = w.els.rows.innerHTML;
  assert.ok(h.includes('사아테크') && h.includes('검토완료 v2') && h.includes('⬇ HWPX'));
  w.ctx.grReset();
  assert.equal(w.ctx.GR.f.year, '2026');
});

test('⑨ 겹친 불러오기 — 먼저 시작해 늦게 실패한 읽기는 나중 성공을 덮지 못한다', async () => {
  let n = 0;
  const w = world({ db: (db) => ({ ref: (p) => (p === 'scal_cos' && ++n === 1
    ? { once: () => new Promise((_, rej) => setTimeout(() => rej(new Error('slow_fail')), 30)) } : db.ref(p)) }) });
  const a = w.ctx.grLoad();
  const b = w.ctx.grLoad();
  await Promise.all([a, b]);
  assert.equal(w.ctx.GR.err, '');
  assert.equal(w.ctx.GR.rows.length, 4);
  assert.equal(w.els.err.style.display, 'none');
  assert.notEqual(w.els.board.style.display, 'none');
});
