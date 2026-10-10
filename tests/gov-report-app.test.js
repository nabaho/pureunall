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
const D = require('../js/pu-gov-report-docs.js');
const O = require('../js/pu-ontology.js');

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
  'grRenderForms', 'grRenderAlerts', 'grRender', 'grReset', 'grLoad',
  'grBizType', 'grErp', 'grSetBiz', 'grLoadDocs', 'grRetryDocs', 'grRenderBiz',
  'grRenderDocs', 'grOpenToc', 'grRenderToc', 'grCopyToc', 'grCloseToc'];

function fakeEl() { return { innerHTML: '', textContent: '', value: '', checked: false, disabled: false, style: {} }; }
function world(o) {
  o = o || {};
  const db = FakeDb.만들기(o.seed || F.seed());
  const els = {};
  const ctx = { console: { warn() {} }, Promise, Object, Array, JSON, String, Number, Math, Date, RegExp, Error, isFinite,
    encodeURIComponent, PuGovReportList: L, PuGovReport: { FORMS: Rpt.FORMS }, PuGovReportDocs: D,
    $: (id) => (els[id] = els[id] || fakeEl()),
    fbDb: o.db ? o.db(db) : db };
  ctx.window = ctx;
  ctx.navigator = o.nav || { clipboard: { writeText: async (t) => { ctx.copied = t; } } };
  vm.createContext(ctx);
  vm.runInContext([varLine('GR_NODES'), varLine('GR_FIELDS'), varLine('GR_DOC_NODES'), varLine('GR')].join('\n') + '\n' + NAMES.map(grab).join('\n')
    + "\ngrToday=function(){ return '2026-10-10'; };", ctx);
  if (o.email) vm.runInContext('GR.email=' + JSON.stringify(o.email) + ';', ctx);
  return { ctx, db, els };
}

test('정적 — 공통 머리와 새 모듈을 차례대로 싣는다', () => {
  ['js/pu-gov-report.js', 'js/pu-gov-report-build.js', 'js/pu-gov-report-list.js', 'js/pu-gov-report-docs.js', 'js/pu-appbar.js', 'js/pu-back.js',
    'js/pu-gate.js', 'js/pu-whoami.js', 'js/pu-ls-guard.js', 'js/pu-logout-why.js', 'js/pu-ontology.js']
    .forEach((f) => assert.match(SRC, new RegExp('src="' + f.replace(/\./g, '\\.') + '\\?v=\\d+"'), f));
  assert.ok(SRC.indexOf('pu-gov-report-build.js') < SRC.indexOf('pu-gov-report-list.js'), 'build 를 먼저 싣는다');
  assert.ok(SRC.indexOf('pu-gov-report-list.js') < SRC.indexOf('pu-gov-report-docs.js'), '목록 모듈 다음에 싣는다');
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

/* ═══ 서류 관리(왼쪽 패널) — 설계 2026-10-10-gov-report-docs-design.md ═══ */

test('정적 — 새 읽기 넷은 GR_DOC_NODES 로만 · 등록부가 빌려 읽기로 적는다', () => {
  assert.match(SRC, /var GR_DOC_NODES=\{biz:'data\/biz_cons_types',cons:'data\/consultings',tmap:'scal_erpTypeMap',dir:'data\/user_dir'\};/);
  /* data/user_dir 은 앞 기능의 「내 담당」 읽기가 글자 그대로 부른다 — 새 셋만 본다 */
  assert.doesNotMatch(INLINE, /ref\(\s*['"](data\/biz_cons_types|data\/consultings|scal_erpTypeMap)/, 'GR_DOC_NODES 를 거치지 않았다');
  assert.match(SRC, /\$\('biz'\)\.addEventListener\('click'/);
  const g = O.PROGRAMS.govreport;
  ['data/biz_cons_types', 'data/consultings', 'scal_erpTypeMap'].forEach((r) => assert.ok(g.sharedRoots.includes(r), r));
  assert.deepEqual(g.writeContracts.map((w) => w.path), ['activeWriter/gov_report'], '쓰는 자리는 늘지 않는다');
  assert.match(SRC, /컨설팅 사업 목록을 불러오지 못했습니다/);
  assert.match(SRC, /환경설정 → 컨설팅관리에 컨설팅 사업이 없습니다/);
});

test('⑩ 왼쪽 패널 — 기관별 묶음(첫 sortOrder 순) · 숨김·합친 사업 없음 · 연결 없는 것은 맨 끝 · 읽기만', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.biz.innerHTML;
  const at = (s) => { const i = h.indexOf(s); assert.ok(i >= 0, s); return i; };
  assert.ok(at('기관 미지정') < at('비즈니스지원단(중기청)'));
  assert.ok(at('비즈니스지원단(중기청)') < at('충남북부상공회의소'));
  assert.ok(at('충남북부상공회의소') < at('서산상공회의소'));
  assert.ok(at('서산상공회의소') < at('정부사업일정에 사업 없음'));
  assert.ok(!h.includes('일터혁신상생컨설팅'), '숨긴 사업');
  assert.ok(!h.includes('혁신바우처컨설팅'), '합친 사업');
  assert.match(h, /data-biz="consulting-03"[^>]*>.*?통합기술보호지원단.*?간단형.*?<b>1<\/b>/);
  assert.match(h, /data-biz="consulting-01"[^>]*>.*?현장클리닉.*?<b>0<\/b>/);
  assert.equal(w.db.쓴것.length, 0, '읽기만 해야 한다');
});

test('⑪ 사업을 누르면 그 사업 업체로 거르고, 다시 누르면 풀린다 · 연결 없는 사업은 빈 목록 · 거르개 풀기', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-03');
  let h = w.els.rows.innerHTML;
  assert.ok(h.includes('가나상사') && !h.includes('다라정밀') && !h.includes('마바산업'));
  assert.match(w.els.biz.innerHTML, /class="bz on" data-biz="consulting-03"/);
  assert.equal(w.els.fType.disabled, true, '사업 거르개는 왼쪽이 맡는다');
  assert.match(w.els.kpis.innerHTML, /data-st=""[^>]*><b>1<\/b>/, '숫자 칸도 함께 걸러진다');
  w.ctx.grSetBiz('consulting-03');
  h = w.els.rows.innerHTML;
  assert.ok(h.includes('가나상사') && h.includes('다라정밀') && h.includes('마바산업'), '다시 누르면 풀린다');
  assert.equal(w.els.fType.disabled, false);
  w.ctx.grSetBiz('consulting-06');
  assert.equal(w.els.rows.innerHTML, '');
  assert.equal(w.els.empty.textContent, '조건에 맞는 보고서가 없습니다.');
  w.ctx.grReset();
  assert.equal(w.ctx.GR.f.biz, '');
  assert.equal(w.db.쓴것.length, 0);
});

test('⑫ 컨설팅 사업을 못 읽으면 왼쪽만 오류 + 다시 시도 — 오른쪽 목록은 그대로', async () => {
  let n = 0;
  const w = world({ db: (db) => ({ ref: (p) => (p === 'data/biz_cons_types' && ++n === 1
    ? { once: async () => { throw new Error('permission_denied'); } } : db.ref(p)) }) });
  await w.ctx.grLoad();
  assert.ok(w.els.biz.innerHTML.includes('컨설팅 사업 목록을 불러오지 못했습니다'));
  assert.ok(w.els.biz.innerHTML.includes('onclick="grRetryDocs()"'));
  assert.notEqual(w.els.board.style.display, 'none');
  assert.ok(w.els.rows.innerHTML.includes('마바산업'), '오른쪽은 왼쪽 없이도 쓴다');
  await w.ctx.grRetryDocs();
  assert.ok(w.els.biz.innerHTML.includes('통합기술보호지원단'));
});

test('⑬ 사업 목록이 비면 「환경설정 → 컨설팅관리에 컨설팅 사업이 없습니다」 · 이름은 이스케이프', async () => {
  const s = F.seed(); s.data.biz_cons_types = { u: 1, v: [] };
  const w = world({ seed: s });
  await w.ctx.grLoad();
  assert.ok(w.els.biz.innerHTML.includes('환경설정 → 컨설팅관리에 컨설팅 사업이 없습니다'));
  const x = F.seed();
  x.data.biz_cons_types.v.push({ code: 'consulting-x', name: '<img src=x>', agency: '<b>', sortOrder: 20 });
  x.scal_erpTypeMap['consulting-x'] = 't1';   // 이어 둬야 기관 묶음 머리에 나온다
  const v = world({ seed: x });
  await v.ctx.grLoad();
  assert.ok(!v.els.biz.innerHTML.includes('<img'), '이스케이프 안 됨');
  assert.ok(v.els.biz.innerHTML.includes('&#60;img src=x&#62;'));
  assert.ok(v.els.biz.innerHTML.includes('<div class="bz-h">&#60;b&#62;</div>'), '기관 이름도 이스케이프');
});

test('정적 — 목록·체크표의 「목차」 단추와 창 닫기 · 창은 PuBack 이 닫을 수 있게 data-close', () => {
  assert.match(SRC, /\['rows','docs'\]\.forEach\(function\(id\)\{ \$\(id\)\.addEventListener\('click'/);
  assert.match(SRC, /<div id="toc" class="toc" style="display:none"><\/div>/);
  assert.match(SRC, /data-close onclick="grCloseToc\(\)">닫기<\/button>/);
});

test('⑭ 서류 체크표 — 간단형은 ①~⑤ 열(①② 자동, ③④⑤ 「—」)·기한·목차 단추', async () => {
  const w = world();
  await w.ctx.grLoad();
  assert.equal(w.els.docs.style.display, 'none', '사업을 안 고르면 체크표가 없다');
  w.ctx.grSetBiz('consulting-03');
  const h = w.els.docs.innerHTML;
  assert.equal(w.els.docs.style.display, '');
  ['①초안', '②확정', '③서명본', '④별첨', '⑤제출', '기한', '통합기술보호지원단', '간단형', '가나상사', '2026-09-30'].forEach((s) => assert.ok(h.includes(s), s));
  assert.ok(h.includes('<span class="st st-draft">초안</span>'));
  assert.equal((h.match(/<td>—<\/td>/g) || []).length, 4, '② ③ ④ ⑤ 는 「—」');
  assert.ok(h.includes('data-toc="1" data-co="c1" data-ty="t1"'));
  w.ctx.grSetBiz('consulting-05');
  assert.ok(w.els.docs.innerHTML.includes('<span class="st st-todo">미작성</span>'));
  assert.equal(w.db.쓴것.length, 0);
});

test('⑮ 대형·틀 없음은 «서류 목차 보기» 줄만 · 연결 없는 사업은 안내 · [확인 필요] 틀 딱지', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-02');
  let h = w.els.docs.innerHTML;
  assert.ok(h.includes('대형') && h.includes('서류 목차 보기') && h.includes('가나상사'));
  assert.ok(!h.includes('①초안'), '대형은 체크표를 그리지 않는다');
  w.ctx.grSetBiz('consulting-01');
  h = w.els.docs.innerHTML;
  assert.ok(h.includes('정부사업일정에 사업 없음'));
  assert.ok(h.includes('[확인 필요: 운영지침]'));
  w.ctx.grSetBiz('consulting-01');
  assert.equal(w.els.docs.style.display, 'none', '다시 누르면 체크표도 닫힌다');
});

test('⑯ 목록 줄마다 「목차」 — 목차 창: 머리말·번호 줄·회차 펼침·상태 딱지, 연락처·금액은 없다 · 닫기', async () => {
  const w = world();
  await w.ctx.grLoad();
  assert.ok(w.els.rows.innerHTML.includes('class="act tocb" data-toc="1" data-co="c1" data-ty="t1">목차</button>'));
  w.ctx.grOpenToc('c1', 't1');
  const h = w.els.toc.innerHTML;
  assert.equal(w.els.toc.style.display, '');
  ['목차 — 가나상사', '통합기술보호지원단', '(비즈니스지원단(중기청))', '2026-05-01 ~ 2026-09-30', '담당: 홍길동', '회차 3',
    '별지11 완료보고서', '<li>1회차</li>', '<li>3회차</li>', '<span class="st st-draft">초안</span>', '복사'].forEach((s) => assert.ok(h.includes(s), s));
  assert.ok(h.indexOf('별지11 완료보고서') < h.indexOf('법률 자문 일지'), '틀 차례대로');
  ['010-0000-0000', '연락담당', '9900000'].forEach((s) => assert.ok(!h.includes(s), s + ' 가 목차에 나왔다'));
  w.ctx.grCloseToc();
  assert.equal(w.els.toc.style.display, 'none');
  assert.equal(w.db.쓴것.length, 0);
});

test('⑰ 이알피 계약을 못 맞추면 머리말에 [확인 필요] — 목차는 그대로 만든다', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grOpenToc('c3', 't4');
  const h = w.els.toc.innerHTML;
  assert.ok(h.includes('[확인 필요] 푸른이알피 계약 못 찾음'));
  assert.ok(h.includes('2026-03-03 ~ 2026-05-12 (회차 날짜)'));
  assert.ok(h.includes('방문확인서') && h.includes('<span class="st st-todo">미작성</span>'));
});

test('⑱ 「복사」 — 목차 글(tocText)을 그대로 · 못 하면 안내 + 고를 수 있는 글 상자', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grOpenToc('c1', 't1');
  await w.ctx.grCopyToc();
  assert.equal(w.ctx.copied, D.tocText(w.ctx.GR.toc));
  assert.ok(w.ctx.copied.startsWith('목차 — 가나상사'));
  assert.ok(w.els.toc.innerHTML.includes('복사했습니다'));
  const f = world({ nav: { clipboard: { writeText: async () => { throw new Error('denied'); } } } });
  await f.ctx.grLoad();
  f.ctx.grOpenToc('c1', 't1');
  await f.ctx.grCopyToc();
  assert.ok(f.els.toc.innerHTML.includes('복사하지 못했습니다'));
  assert.ok(f.els.toc.innerHTML.includes('<textarea class="toc-t" readonly>목차 — 가나상사'));
});

test('⑲ 목차 창의 바깥 값은 이스케이프', async () => {
  const s = F.seed(); s.scal_cos[0].name = '가나<상사>';
  const w = world({ seed: s });
  await w.ctx.grLoad();
  w.ctx.grOpenToc('c1', 't1');
  assert.ok(!w.els.toc.innerHTML.includes('<상사>'));
  assert.ok(w.els.toc.innerHTML.includes('가나&#60;상사&#62;'));
});
