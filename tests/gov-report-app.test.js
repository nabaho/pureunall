'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 화면 검사 (2026-10-10)
 * ★ 지키는 것: 쓰기는 서류 진행 기록 줄 하나(scal_docs/{업체}/{rid}/items/{키} .set)뿐 · 숫자 칸을 누르면 거르고 다시 누르면 풀린다 · 내 담당만 · 서고는 읽기만 ·
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
const Tr = require('../js/pu-gov-report-track.js');
const O = require('../js/pu-ontology.js');
const { fakeDoc } = require('./helpers/fake-preview-dom.js');

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
  'grRenderDocs', 'grOpenToc', 'grRenderToc', 'grCopyToc', 'grCloseToc',
  'grView', 'grLoadTrack', 'grApplyTrack', 'grOpenCell', 'grPickCell', 'grRenderCell', 'grSaveCell', 'grCloseCell', 'grOkId', 'grPickHwp', 'grOpenHwp'];

function fakeEl() { return { innerHTML: '', textContent: '', value: '', checked: false, disabled: false, style: {} }; }
function world(o) {
  o = o || {};
  const db = FakeDb.만들기(o.seed || F.seed());
  const els = {};
  ['cwKey', 'cwSt', 'cwSent', 'cwGot', 'cwHow', 'cwAck', 'cwNote', 'cwHwpMsg'].forEach((id) => { els[id] = fakeEl(); }); // 칸 창 입력 — 진짜 DOM 에서는 innerHTML 이 만든다
  const ctx = { console: { warn() {} }, Promise, Object, Array, JSON, String, Number, Math, Date, RegExp, Error, isFinite,
    encodeURIComponent, PuGovReportList: L, PuGovReport: { FORMS: Rpt.FORMS }, PuGovReportDocs: D, PuGovReportTrack: Tr,
    $: (id) => (els[id] = els[id] || fakeEl()),
    fbDb: o.db ? o.db(db) : db };
  if (o.preview) ctx.PuHwpPreview = o.preview;
  ctx.window = ctx;
  ctx.navigator = o.nav || { clipboard: { writeText: async (t) => { ctx.copied = t; } } };
  vm.createContext(ctx);
  vm.runInContext([varLine('GR_NODES'), varLine('GR_FIELDS'), varLine('GR_DOC_NODES'), varLine('GR_TRACK_NODES'), varLine('GR')].join('\n') + '\n' + NAMES.map(grab).join('\n')
    + "\ngrToday=function(){ return '2026-10-10'; };", ctx);
  if (o.email) vm.runInContext('GR.email=' + JSON.stringify(o.email) + ';', ctx);
  return { ctx, db, els };
}

/* 쓰기는 서류 진행 기록 줄 하나뿐 — 자리 꼴 scal_docs/{업체}/{rid}/items/{키}, set 만 */
const TRACK_PATH = /^scal_docs\/[^/]+\/[^/]+\/items\/[a-z]+(:[0-9]+)?$/;
function onlyTrackWrites(db) {
  db.쓴것.forEach((x) => assert.ok(TRACK_PATH.test(x.자리) && !x.update && !x.transaction, '허락 밖 쓰기: ' + x.자리));
}

test('정적 — 공통 머리와 새 모듈을 차례대로 싣는다', () => {
  ['js/pu-gov-report.js', 'js/pu-gov-report-build.js', 'js/pu-gov-report-list.js', 'js/pu-gov-report-track.js', 'js/pu-gov-report-docs.js', 'js/pu-appbar.js', 'js/pu-back.js',
    'js/pu-gate.js', 'js/pu-whoami.js', 'js/pu-ls-guard.js', 'js/pu-logout-why.js', 'js/pu-ontology.js']
    .forEach((f) => assert.match(SRC, new RegExp('src="' + f.replace(/\./g, '\\.') + '\\?v=\\d+"'), f));
  assert.ok(SRC.indexOf('pu-gov-report-build.js') < SRC.indexOf('pu-gov-report-list.js'), 'build 를 먼저 싣는다');
  assert.ok(SRC.indexOf('pu-gov-report-list.js') < SRC.indexOf('pu-gov-report-docs.js'), '목록 모듈 다음에 싣는다');
  assert.ok(SRC.indexOf('pu-gov-report-track.js') < SRC.indexOf('pu-gov-report-docs.js'), '기록 모듈을 서류 모듈보다 먼저 싣는다');
  assert.match(SRC, /pu-ontology-write\.js\?v=\d+" data-mode="observe"/);
  assert.match(SRC, /PuGate\.show\(/);
  assert.match(SRC, /PuBack\.guard\(/);
  assert.match(SRC, /PuWhoami\.mount\('#who'\)/);
});

test('정적 — 받은 서류함 모듈을 차례대로 싣는다(주소 맞추기·서버 부르기 → 후보 모듈) · 서버 부르기 번호는 취업규칙 화면과 같다', () => {
  ['js/pu-co-thread.js', 'js/rules-v2/mail-orig.js', 'js/pu-gov-report-inbox.js'].forEach((f) =>
    assert.match(SRC, new RegExp('<script src="' + f.replace(/\./g, '\\.') + '\\?v=\\d+"></script>'), f));
  const at = (f) => SRC.indexOf(f);
  assert.ok(at('pu-co-thread.js') < at('pu-gov-report-inbox.js'));
  assert.ok(at('rules-v2/mail-orig.js') < at('pu-gov-report-inbox.js'));
  assert.ok(at('pu-gov-report-build.js') < at('pu-gov-report-inbox.js'), 'PRIV_RE 를 build 에서 가져온다');
  const RULES = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
  const v = (s) => (s.match(/js\/rules-v2\/mail-orig\.js\?v=(\d+)/) || [])[1];
  assert.ok(v(SRC) && v(SRC) === v(RULES), '서버 부르기 모듈 ?v 가 취업규칙 화면과 같아야 한다');
});

test('정적 — 쓰기는 한 곳뿐(서류 진행 기록 줄 하나 .set) · 일정 자리는 GR_NODES 로만 부른다', () => {
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], ['.set('], '쓰기 명령은 grSaveCell 의 .set 하나뿐');
  assert.doesNotMatch(INLINE, /ref\([^)]*\)\.push\(/, '쓰기 명령이 있다');
  assert.match(grab('grSaveCell'), /fbDb\.ref\(GR_TRACK_NODES\.docs\+'\/'\+c\.coId\+'\/'\+c\.rid\+'\/items\/'\+c\.key\)\.set\(rec\)/);
  assert.match(SRC, /var GR_TRACK_NODES=\{docs:'scal_docs'\};/);
  assert.doesNotMatch(INLINE, /ref\(\s*['"]scal_docs/, 'GR_TRACK_NODES 를 거치지 않았다');
  assert.doesNotMatch(INLINE, /ref\(\s*['"]scal_(cos|types|scheds|staff)/, 'GR_NODES 를 거치지 않았다');
  assert.match(SRC, /불러오지 못했습니다 — 연결을 확인해 주세요/);
  assert.match(SRC, /올해 걸린 보고서가 없습니다 — 사업 걸기는 정부사업일정에서/);
  assert.match(SRC, /<div id="cellw" class="toc" style="display:none"><\/div>/);
  assert.match(SRC, /<option value="signed">서명 진행<\/option><option value="submitted">제출 완료<\/option>/);
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

test('② 숫자 칸 — 올해 기준, 누르면 거르고 다시 누르면 풀린다 · 서명·제출은 서류 진행 기록으로 센다', async () => {
  const w = world();
  await w.ctx.grLoad();
  const k = w.els.kpis.innerHTML;
  assert.match(k, /data-st=""[^>]*><b>3<\/b><span>전체/);
  assert.match(k, /data-st="todo"[^>]*><b>1<\/b><span>미작성/);
  assert.match(k, /data-st="signed"[^>]*><b>2<\/b><span>서명/);
  assert.match(k, /data-st="submitted"[^>]*><b>1<\/b><span>제출/);
  assert.ok(!k.includes('disabled'), '서명·제출 칸도 누를 수 있다');
  w.ctx.grSetStatus('todo');
  assert.ok(w.els.rows.innerHTML.includes('마바산업'));
  assert.ok(!w.els.rows.innerHTML.includes('가나상사'));
  assert.equal(w.els.fStatus.value, 'todo');
  assert.match(w.els.kpis.innerHTML, /class="kpi on" data-st="todo"/);
  w.ctx.grSetStatus('todo');
  assert.ok(w.els.rows.innerHTML.includes('가나상사'), '다시 누르면 풀린다');
  w.ctx.grSetStatus('signed');
  let h = w.els.rows.innerHTML;
  assert.ok(h.includes('다라정밀') && h.includes('마바산업') && !h.includes('가나상사'), '서명 = ③ 진행·완료');
  assert.match(w.els.kpis.innerHTML, /class="kpi on" data-st="signed"/);
  w.ctx.grSetStatus('submitted');
  h = w.els.rows.innerHTML;
  assert.ok(h.includes('마바산업') && !h.includes('다라정밀'), '제출 = ⑤ 완료');
  w.ctx.grSetStatus('submitted');
  assert.equal(w.ctx.GR.f.status, '', '다시 누르면 풀린다');
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

test('⑤ 챙길 것 — 14일 넘은 미작성 · 7일 넘은 초안 · 서명 회신 7일 넘게 기다림 · 제출 기한 지남', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.alerts.innerHTML;
  assert.match(h, /종료 후 14일 넘은 미작성 <b>1<\/b>/);
  assert.ok(h.includes('마바산업') && h.includes('종료 151일'));
  assert.match(h, /초안 7일 넘음 <b>1<\/b>/);
  assert.ok(h.includes('20일 전 고침'));
  assert.match(h, /서명 회신 기다림 \(7일 넘음\) <b>1<\/b>/);
  assert.ok(h.includes('다라정밀') && h.includes('회신 20일째'));
  assert.match(h, /제출 기한 지남 <b>1<\/b>/);
  assert.ok(h.includes('기한 2026-09-30'));
  assert.ok(!h.includes('서명 단계가 생기면 셉니다'));
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
  ['data/biz_cons_types', 'data/consultings', 'scal_erpTypeMap', 'mailbox', 'data/companies'].forEach((r) => assert.ok(g.sharedRoots.includes(r), r));
  assert.deepEqual(g.writeContracts.map((w) => w.path), ['activeWriter/gov_report', 'scal_docs/{co}/{rid}/items/{key}'],
    '쓰는 자리는 서류 진행 기록 줄 하나뿐');
  assert.ok(g.primaryRoots.includes('scal_docs'), '서류 진행 기록의 주인은 이 앱');
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

test('⑭ 서류 체크표 — 간단형은 ①~⑤ 열(①② 자동, ③④⑤ 기록 칸)·기한·목차 단추', async () => {
  const w = world();
  await w.ctx.grLoad();
  assert.equal(w.els.docs.style.display, 'none', '사업을 안 고르면 체크표가 없다');
  w.ctx.grSetBiz('consulting-03');
  const h = w.els.docs.innerHTML;
  assert.equal(w.els.docs.style.display, '');
  ['①초안', '②확정', '③서명본', '④별첨', '⑤제출', '기한', '통합기술보호지원단', '간단형', '가나상사', '2026-09-30'].forEach((s) => assert.ok(h.includes(s), s));
  assert.ok(h.includes('<span class="st st-draft">초안</span>'));
  assert.equal((h.match(/<td>—<\/td>/g) || []).length, 2, '② 와 ③ 은 「—」 — 기술보호에는 ③ 서명본 줄이 없다');
  assert.ok(h.includes('data-cell="1" data-co="c1" data-ty="t1" data-step="attach"'));
  assert.ok(h.includes('<span class="st st-wait">○ 없음 0/6</span>'));
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

/* ═══ 서류 진행 기록(③서명본·④별첨·⑤제출) — 설계 2026-10-10-gov-report-track-design.md ═══ */

test('⑳ 체크표 ③④⑤ — 기록을 읽어 칸으로, 누르면 칸 창 · 기술보호는 ③ 이 없다 · 여는 것만으로는 안 쓴다', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  const h = w.els.docs.innerHTML;
  assert.ok(h.includes('data-cell="1" data-co="c2" data-ty="t3" data-step="sign"'));
  assert.ok(h.includes('<span class="st st-draft">◐ 발송함 · 회신 20일째</span>'));
  w.ctx.grOpenCell('c2', 't3', 'sign');
  const c = w.els.cellw.innerHTML;
  assert.equal(w.els.cellw.style.display, '');
  ['③ 업체 서명본 — 다라정밀', '서류: 업체 서명본', '발송일', '회신(스캔 받음)일', 'value="2026-09-20"',
    '개인정보를 적지 마세요', '고친 사람 홍길동 · 2026-09-20', 'data-close', 'onclick="grSaveCell()"'].forEach((s) => assert.ok(c.includes(s), s));
  assert.match(c, /<option value="doing" selected>◐ 발송함<\/option>/);
  assert.ok(!c.includes('value="na"'), '서명본에는 해당없음이 없다');
  w.ctx.grCloseCell();
  assert.equal(w.els.cellw.style.display, 'none');
  w.ctx.grSetBiz('consulting-03');
  const g = w.els.docs.innerHTML;
  assert.ok(!g.includes('data-step="sign"'));
  assert.ok(g.includes('data-step="attach"') && g.includes('data-step="submit"'));
  assert.equal(w.db.쓴것.length, 0, '여는 것만으로는 쓰지 않는다');
});

test('㉑ 저장 — 줄 키 하나만 .set · 다시 읽지 않고 표·숫자 칸·챙길 것·목차가 바뀐다', async () => {
  const w = world({ email: 'p009@pureun.kr' });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'done'; w.els.cwSent.value = '2026-09-20'; w.els.cwGot.value = '2026-10-08'; w.els.cwNote.value = ' 스캔 회신 ';
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  assert.deepEqual(w.db.쓴것.map((x) => x.자리), ['scal_docs/c2/t3_2026/items/sign']);
  const v = w.db.쓴것[0].값;
  assert.deepEqual([v.st, v.sentAt, v.gotAt, v.note, v.by, typeof v.at], ['done', '2026-09-20', '2026-10-08', '스캔 회신', '홍길동', 'number']);
  assert.equal(w.db.읽기('scal_docs/c2/t3_2026/items/sign').st, 'done');
  assert.ok(w.els.cellw.innerHTML.includes('저장했습니다'));
  assert.ok(w.els.docs.innerHTML.includes('<span class="st st-done">● 회신 받음</span>'));
  assert.match(w.els.alerts.innerHTML, /서명 회신 기다림 \(7일 넘음\) <b>0<\/b>/);
  assert.match(w.els.kpis.innerHTML, /data-st="submitted"[^>]*><b>0<\/b>/);
  w.ctx.grOpenCell('c2', 't3', 'submit');
  const c = w.els.cellw.innerHTML;
  ['제출일', '제출 방식', '접수 확인', '<option value="platform">플랫폼</option>'].forEach((s) => assert.ok(c.includes(s), s));
  w.els.cwSt.value = 'done'; w.els.cwGot.value = '2026-10-09'; w.els.cwHow.value = 'platform'; w.els.cwAck.checked = true; w.els.cwNote.value = '';
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  const s = w.db.쓴것[1];
  assert.equal(s.자리, 'scal_docs/c2/t3_2026/items/submit');
  assert.deepEqual(s.값, { st: 'done', at: s.값.at, by: '홍길동', gotAt: '2026-10-09', how: 'platform', ack: true });
  assert.match(w.els.kpis.innerHTML, /data-st="submitted"[^>]*><b>1<\/b>/, '사업 거르개 안(다라정밀 하나)에서 제출 1');
  w.ctx.grOpenToc('c2', 't3');
  assert.ok(w.els.toc.innerHTML.includes('<span class="st st-done">● 제출함</span>'));
});

test('㉒ 규칙 게시 전 — 읽기 거절: 칸은 「—」·누를 수 없고 안내 · 쓰기 거절: 창에 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」, 값은 그대로', async () => {
  const denied = { once: async () => { throw new Error('permission_denied'); }, set: async () => { throw new Error('PERMISSION_DENIED'); } };
  const r = world({ db: (db) => ({ ref: (p) => (p === 'scal_docs' ? denied : db.ref(p)) }) });
  await r.ctx.grLoad();
  r.ctx.grSetBiz('consulting-04');
  assert.ok(r.els.docs.innerHTML.includes('기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인'));
  assert.ok(!r.els.docs.innerHTML.includes('data-cell'), '못 읽었으면 누를 수 없다(남의 기록을 모르고 덮지 않게)');
  assert.ok(r.els.rows.innerHTML.includes('다라정밀'), '목록은 그대로');
  assert.match(r.els.kpis.innerHTML, /data-st="signed" title="기록을 못 불러왔습니다"><b>\?<\/b>/, '못 읽었으면 0 이 아니라 ?');
  assert.match(r.els.kpis.innerHTML, /data-st="submitted" title="기록을 못 불러왔습니다"><b>\?<\/b>/);
  assert.ok(r.els.alerts.innerHTML.includes('기록을 못 불러왔습니다'));
  r.ctx.grOpenCell('c2', 't3', 'sign');
  assert.equal(r.ctx.GR.cw, null);
  const w = world({ db: (db) => ({ ref: (p) => (p.indexOf('scal_docs/') === 0 ? denied : db.ref(p)) }) });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'done';
  await w.ctx.grSaveCell();
  const c = w.els.cellw.innerHTML;
  assert.ok(c.includes('저장하지 못했습니다 — 규칙 게시 또는 권한 확인'));
  assert.match(c, /<option value="done" selected>● 회신 받음<\/option>/, '고르던 값은 창에 남는다');
  assert.ok(w.els.docs.innerHTML.includes('◐ 발송함'), '표 값은 그대로');
  assert.equal(w.ctx.GR.track.c2.t3_2026.sign.st, 'doing');
  assert.equal(w.db.쓴것.length, 0);
});

test('㉓ 잘못 적으면 쓰지 않는다 — 회신일 < 발송일 · 적던 값은 창에 남는다', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'done'; w.els.cwSent.value = '2026-09-20'; w.els.cwGot.value = '2026-09-01'; w.els.cwNote.value = '메모';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(w.els.cellw.innerHTML.includes('회신일이 발송일보다 앞섭니다'));
  assert.ok(w.els.cellw.innerHTML.includes('value="2026-09-01"'), '적던 값이 남는다');
});

test('㉔ 여러 서류가 한 칸이면(기술보호 ④) 서류를 골라 그 줄만 저장 · 해당없음은 세지 않는다', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-03');
  w.ctx.grOpenCell('c1', 't1', 'attach');
  const c = w.els.cellw.innerHTML;
  assert.ok(c.includes('<select id="cwKey" onchange="grPickCell(this.value)">'));
  ['법률 자문 일지 1회차', '법률 자문 일지 3회차', '보안서약서', '별지8 여비지급신청서', '만족도조사', 'value="na"'].forEach((s) => assert.ok(c.includes(s), s));
  w.ctx.grPickCell('pledge');
  assert.equal(w.ctx.GR.cw.key, 'pledge');
  w.els.cwSt.value = 'na';
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  assert.deepEqual(w.db.쓴것.map((x) => x.자리), ['scal_docs/c1/t1_2026/items/pledge']);
  assert.ok(w.els.docs.innerHTML.includes('<span class="st st-wait">○ 없음 0/5</span>'));
});

test('㉕ 진행 막대 ③④ · 목차 딱지도 기록을 따른다 · 칸 창의 바깥 값은 이스케이프', async () => {
  const w = world();
  await w.ctx.grLoad();
  const row = w.els.rows.innerHTML.split('<tr>').filter((x) => x.includes('마바산업'))[0];
  assert.ok(row.includes('<span class="stp on" title="③ 서명"></span>') && row.includes('<span class="stp on" title="④ 제출"></span>'));
  w.ctx.grOpenToc('c3', 't4');
  assert.ok(w.els.toc.innerHTML.includes('<span class="st st-done">● 제출함</span>'));
  assert.ok(w.els.toc.innerHTML.includes('<span class="days">— 해당없음</span>'));
  const s = F.seed();
  s.scal_docs.c2.t3_2026.items.sign.note = '<img src=x>';
  s.scal_docs.c2.t3_2026.items.sign.by = '<b>홍</b>';
  s.scal_cos[1].name = '다라<정밀>';
  const v = world({ seed: s });
  await v.ctx.grLoad();
  v.ctx.grSetBiz('consulting-04');
  v.ctx.grOpenCell('c2', 't3', 'sign');
  const c = v.els.cellw.innerHTML;
  assert.ok(!c.includes('<img') && !c.includes('<b>홍') && !c.includes('<정밀>'), '이스케이프 안 됨');
  assert.ok(c.includes('&#60;img src=x&#62;') && c.includes('다라&#60;정밀&#62;'));
});

/* ═══ 고침 1 — 저장·다시 읽기 겹침 · 키 점검 · 겹친 저장 ═══ */

function gate() { let go; const p = new Promise((r) => { go = r; }); return { p, go }; }
const snap = (v) => ({ val: () => v });

test('㉖ 저장하는 사이 다시 읽기가 실패해도 저장이 끝난 뒤 칸은 잠긴 채 — 일부만 든 기록이 되살아나지 않는다', async () => {
  const g = gate(); let mode = 'pass'; const sets = [];
  const w = world({ db: (db) => ({ ref: (p) => {
    if (p === 'scal_docs' && mode === 'fail') return { once: async () => { throw new Error('permission_denied'); } };
    if (p.indexOf('scal_docs/') === 0) return { set: async (v) => { await g.p; sets.push([p, v]); return db.ref(p).set(v); } };
    return db.ref(p);
  } }) });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'done'; w.els.cwGot.value = '2026-10-08';
  const saving = w.ctx.grSaveCell();
  mode = 'fail';
  await w.ctx.grLoadTrack();
  assert.equal(w.ctx.GR.track, null);
  assert.equal(w.ctx.GR.trackErr, true);
  g.go();
  await saving;
  assert.equal(sets.length, 1, '저장 자체는 한 줄');
  assert.equal(w.ctx.GR.track, null, '일부만 든 기록이 생기면 안 된다');
  assert.equal(w.ctx.GR.trackErr, true);
  assert.ok(w.els.cellw.innerHTML.includes('목록을 다시 불러온 뒤 확인해 주세요'));
  w.ctx.grRender();
  assert.ok(!w.els.docs.innerHTML.includes('data-cell'), '칸은 다시 잠겨 있다');
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't3', 'sign');
  assert.equal(w.ctx.GR.cw, null, '못 읽은 동안은 열리지 않는다');
});

test('㉖-2 먼저 시작한 다시 읽기가 늦게 끝나도 나중 것을 덮지 못한다', async () => {
  const q = []; let mode = 'pass';
  const w = world({ db: (db) => ({ ref: (p) => (p === 'scal_docs' && mode === 'gated'
    ? { once: () => new Promise((r) => q.push(r)) } : db.ref(p)) }) });
  await w.ctx.grLoad();
  mode = 'gated';
  const a = w.ctx.grLoadTrack(), b = w.ctx.grLoadTrack();
  const val = (st) => snap({ c2: { t3_2026: { items: { sign: { st, at: 1 } } } } });
  q[1](val('done')); await b;
  q[0](val('doing')); await a;
  assert.equal(w.ctx.GR.track.c2.t3_2026.sign.st, 'done', '옛 읽기가 나중 읽기를 덮었다');
});

test('㉗ 줄 키·업체·rid 점검 — 고른 서류가 목록에 없으면 안 바뀌고, 이상한 이름은 쓰지 않는다', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-03');
  w.ctx.grOpenCell('c1', 't1', 'attach');
  const k0 = w.ctx.GR.cw.key;
  w.ctx.grPickCell('nope/x');
  assert.equal(w.ctx.GR.cw.key, k0, '목록에 없는 키는 고를 수 없다');
  w.ctx.GR.cw.key = 'a/b';
  w.els.cwSt.value = 'done';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(w.els.cellw.innerHTML.includes('저장하지 못했습니다'));
  w.ctx.GR.cw.key = k0; w.ctx.GR.cw.rid = 'x/../y';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 0);
  w.ctx.GR.cw.rid = 't1_2026'; w.ctx.GR.cw.coId = '__proto__';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 0);
});

test('㉘ 겹친 저장 — 같은 칸 저장이 끝나기 전에 다시 열어 저장해도 .set 은 한 번', async () => {
  const g = gate(); let n = 0;
  const w = world({ db: (db) => ({ ref: (p) => (p.indexOf('scal_docs/') === 0
    ? { set: async (v) => { n++; await g.p; return db.ref(p).set(v); } } : db.ref(p)) }) });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'done'; w.els.cwGot.value = '2026-10-08';
  const first = w.ctx.grSaveCell();
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'blocked';
  await w.ctx.grSaveCell();
  assert.equal(n, 1, '두 번째 .set 이 나갔다');
  assert.ok(w.els.cellw.innerHTML.includes('저장하는 중'));
  g.go(); await first;
  assert.equal(n, 1);
  w.ctx.grCloseCell(); w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'blocked';
  await w.ctx.grSaveCell();
  assert.equal(n, 2, '끝난 뒤에는 다시 저장할 수 있다');
});

/* ══ 「📂 받은 한글 파일 열어 보기」 (2026-10-11) — ③ 서명본 칸 창에서만, 브라우저 안에서만 읽는다 ══ */
function pvFile(name, bytes) { return { name, size: bytes.length, arrayBuffer: async () => new Uint8Array(bytes).buffer }; }
/* 가짜 PuHwpPreview — hold: 끝나기를 붙잡아 둔다 · cancel: 진짜 창이 닫힘·밀림 때 내는 «취소»(cancelled·AbortError) · fail: 진짜 실패 */
function pvCancel(msg) { const e = new Error(msg); e.name = 'AbortError'; e.cancelled = true; return e; }
function pvPreview(o) {
  o = o || {};
  const calls = [];
  return { calls, open: (buf, name) => {
    const c = { buf, name };
    calls.push(c);
    if (o.hold) return new Promise((res, rej) => { c.resolve = () => res({ pageCount: 2 }); c.reject = rej; });
    if (o.cancel) return Promise.reject(pvCancel(o.cancel));
    if (o.fail) return Promise.reject(new Error(o.fail));
    return Promise.resolve({ pageCount: 2 });
  } };
}
/* 진짜 미리보기 창(js/pu-hwp-preview.js)을 그 화면 안에 싣는다 — 엔진은 끝나기를 붙잡아 둔다(≈10MB 코어를 불러오는 사이) */
const PV_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-hwp-preview.js'), 'utf8');
function realPreview(ctx) {
  const doc = fakeDoc();
  const held = [];
  ctx.document = doc;
  ctx.PureunHwp = { renderPreview: () => new Promise((res, rej) => { held.push({ res, rej }); }) };
  vm.runInContext(PV_SRC, ctx);
  return { doc, held };
}
const tick = async (n) => { for (let i = 0; i < (n || 5); i++) await new Promise((r) => setImmediate(r)); };

test('㉙ 파일 열기 단추 — ③ 서명본 칸 창에만, 숨은 파일 고르기(.hwp·.hwpx)와 안내 줄', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  const c = w.els.cellw.innerHTML;
  assert.ok(c.includes('📂 받은 한글 파일 열어 보기'));
  assert.match(c, /<input type="file" id="cwHwp" accept="\.hwp,\.hwpx" style="display:none" onchange="grOpenHwp\(this\)">/);
  assert.ok(c.includes('onclick="grPickHwp()"'));
  assert.ok(c.includes('id="cwHwpMsg"'));
  assert.ok(c.includes('올리지'), '올리지·저장하지 않는다는 안내');
  w.ctx.grCloseCell();
  w.ctx.grSetBiz('consulting-03');
  w.ctx.grOpenCell('c2', 't3', 'attach');   // ④ 칸에는 없다 (기술보호 ③ 은 칸 자체가 없다)
  assert.ok(!w.els.cellw.innerHTML.includes('📂'), '③ 이 아닌 칸에 단추가 있다');
  assert.equal(w.db.쓴것.length, 0);
});
test('㉚ 한글 파일을 고르면 PuHwpPreview.open(바이트, 이름) — 아무것도 쓰지 않는다', async () => {
  const pv = pvPreview();
  const w = world({ preview: pv });
  const inp = { files: [pvFile('서명본.HWPX', [80, 75, 3, 4])], value: '서명본.HWPX' };
  const p = w.ctx.grOpenHwp(inp);
  assert.equal(inp.value, '', '파일을 잡자마자(읽기·열기 전에) 비워야 같은 파일을 다시 고를 수 있다');
  const r = await p;
  assert.equal(r.ok, true);
  assert.equal(w.els.cwHwpMsg.textContent, '열었습니다 — 서명본.HWPX');
  assert.equal(pv.calls.length, 1);
  assert.equal(pv.calls[0].name, '서명본.HWPX');
  assert.ok(pv.calls[0].buf instanceof ArrayBuffer || Object.prototype.toString.call(pv.calls[0].buf) === '[object ArrayBuffer]');
  assert.equal(inp.value, '', '같은 파일을 다시 고를 수 있게 비운다');
  assert.equal(w.db.쓴것.length, 0, '파일을 어디에도 쓰지 않는다');
  onlyTrackWrites(w.db);
});
test('㉛ 한글이 아니면 「한글(.hwp·.hwpx) 파일만 열 수 있습니다」 — 열지도 읽지도 않는다', async () => {
  const pv = pvPreview();
  const w = world({ preview: pv });
  let read = 0;
  const f = { name: '서명본.pdf', size: 3, arrayBuffer: async () => { read++; return new ArrayBuffer(3); } };
  const inp = { files: [f], value: 'x' };
  const r = await w.ctx.grOpenHwp(inp);
  assert.equal(r.ok, false);
  assert.equal(inp.value, '', '한글이 아니어도 고르기 칸은 비운다');
  assert.equal(pv.calls.length, 0);
  assert.equal(read, 0, '한글이 아닌 파일을 읽었다');
  assert.equal(w.els.cwHwpMsg.textContent, '한글(.hwp·.hwpx) 파일만 열 수 있습니다');
  const r2 = await w.ctx.grOpenHwp({ files: [pvFile('이름만.hwp.exe', [1])], value: '' });
  assert.equal(r2.ok, false);
  assert.equal(pv.calls.length, 0);
});
test('㉜ 파일을 열어도(성공·실패·취소·창 없음·한글 아님) 열린 칸 창은 그대로 — 다시 그리지·저장하지·닫지 않는다', async () => {
  const kinds = [
    ['성공', pvPreview()],
    ['실패', pvPreview({ fail: '미리보기를 열지 못했습니다 — 깨진 파일' })],
    ['취소', pvPreview({ cancel: '미리보기가 닫혀 취소되었습니다' })],
    ['창 없음', null]
  ];
  for (const [kind, pv] of kinds) {
    const w = world(pv ? { preview: pv } : {});
    await w.ctx.grLoad();
    w.ctx.grSetBiz('consulting-04');
    w.ctx.grOpenCell('c2', 't3', 'sign');
    const cw = w.ctx.GR.cw;
    assert.ok(cw && w.els.cellw.innerHTML.includes('id="cwHwp"'), kind + ': ③ 서명본 칸 창이 안 열렸다');
    /* 사람이 칸 창에 적던 자리 — 다시 그리면(grRenderCell) 이 표가 사라진다 */
    const SENT = '<!--적던 칸 창-->';
    w.els.cellw.innerHTML = SENT;
    w.els.cwNote.value = '적던 메모';
    w.els.cwSent.value = '2026-10-01';
    const msgBefore = cw.msg;
    for (const busy of [false, true]) {
      cw.busy = busy;
      w.ctx.GR.saving = busy ? { x: true } : {};
      const savingBefore = JSON.stringify(w.ctx.GR.saving);
      for (const f of [pvFile('서명본.hwpx', [1]), pvFile('서명본.pdf', [1])]) {
        await w.ctx.grOpenHwp({ files: [f], value: f.name });
        const at = kind + ' · ' + f.name + (busy ? ' · 저장 중' : '');
        assert.equal(w.els.cellw.innerHTML, SENT, at + ': 칸 창을 다시 그렸다 — 적던 값이 날아간다');
        assert.equal(w.els.cwNote.value, '적던 메모', at);
        assert.equal(w.els.cwSent.value, '2026-10-01', at);
        assert.strictEqual(w.ctx.GR.cw, cw, at + ': 칸 창이 바뀌거나 닫혔다');
        assert.equal(cw.busy, busy, at + ': 저장 중 표시를 건드렸다');
        assert.equal(cw.msg, msgBefore, at + ': 칸 창 안내를 바꿨다');
        assert.equal(JSON.stringify(w.ctx.GR.saving), savingBefore, at + ': GR.saving 을 건드렸다');
      }
    }
    assert.equal(w.db.쓴것.length, 0, kind + ': 무언가 썼다');
  }
});
test('㉝ 정적 — 스크립트 줄, 파일은 글자로만 안내하고 올리지·저장하지 않는다', () => {
  const FUND = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
  const GC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
  const ev = (s) => (s.match(/js\/pu-hwp-engine\.js\?v=(\d+)/) || [])[1];
  assert.ok(ev(SRC) && ev(SRC) === ev(FUND), '엔진 ?v 가 다른 앱과 같아야 한다');
  const pvv = (s) => (s.match(/js\/pu-hwp-preview\.js\?v=(\d+)/) || [])[1];
  assert.ok(pvv(SRC) && pvv(SRC) === pvv(GC), '미리보기 창 ?v 가 두 화면(컨설팅보고서·정부사업일정)에서 같아야 한다');
  const e = SRC.indexOf('<script src="js/pu-hwp-engine.js?v='), p = SRC.search(/<script src="js\/pu-hwp-preview\.js\?v=\d+"><\/script>/);
  assert.ok(e >= 0 && p > e && p < SRC.indexOf('<script>', p), '엔진 → 미리보기 순서');
  const fn = grab('grOpenHwp');
  assert.doesNotMatch(fn, /innerHTML/, '파일 이름을 innerHTML 로 넣었다');
  assert.doesNotMatch(fn, /fetch\(|XMLHttpRequest|FormData|localStorage|\.set\(|\.update\(|\.push\(|\.put\(/);
  assert.doesNotMatch(INLINE, /esm\.sh|edwardkim\.github\.io|createEditor|window\.open/);
});
test('㉞ 미리보기 실패·창 없음·파일 없음 — 안내 줄에 글자로 알린다(빨간 줄)', async () => {
  const w1 = world({ preview: pvPreview({ fail: '미리보기를 열지 못했습니다 — 깨진 파일' }) });
  const r1 = await w1.ctx.grOpenHwp({ files: [pvFile('a.hwp', [1])], value: '' });
  assert.equal(r1.ok, false);
  assert.match(w1.els.cwHwpMsg.textContent, /깨진 파일/);
  assert.equal(w1.els.cwHwpMsg.className, 'err-s');
  const w2 = world();
  const r2 = await w2.ctx.grOpenHwp({ files: [pvFile('a.hwp', [1])], value: '' });
  assert.equal(r2.ok, false);
  assert.match(w2.els.cwHwpMsg.textContent, /한글 미리보기를 불러오지 못했습니다/);
  const r3 = await w2.ctx.grOpenHwp({ files: [], value: '' });
  assert.equal(r3.ok, false);
});
test('㉟ 취소는 실패가 아니다 — 불러오는 사이 미리보기를 닫으면(진짜 창·Esc) 안내 줄을 건드리지 않는다', async () => {
  /* ① 가짜 창이 «취소»를 내면 */
  const w0 = world({ preview: pvPreview({ cancel: '다른 파일을 열어 이 미리보기는 취소되었습니다' }) });
  w0.els.cwHwpMsg.textContent = '고른 파일은 이 화면에서만 읽습니다'; w0.els.cwHwpMsg.className = 'days';
  const r0 = await w0.ctx.grOpenHwp({ files: [pvFile('a.hwpx', [1])], value: '' });
  assert.equal(r0.ok, false);
  assert.equal(r0.cancelled, true);
  assert.equal(w0.els.cwHwpMsg.textContent, '고른 파일은 이 화면에서만 읽습니다', '취소를 안내 줄에 적었다');
  assert.equal(w0.els.cwHwpMsg.className, 'days', '취소를 빨간 실패로 보였다');
  /* ② 진짜 미리보기 창 — 엔진 코어를 불러오는 사이 사람이 Esc 로 닫는다 */
  const w = world();
  const real = realPreview(w.ctx);
  w.els.cwHwpMsg.textContent = '고른 파일은 이 화면에서만 읽습니다'; w.els.cwHwpMsg.className = 'days';
  const p = w.ctx.grOpenHwp({ files: [pvFile('서명본.hwpx', [80, 75])], value: '' });
  await tick();
  assert.equal(real.held.length, 1, '진짜 창이 엔진을 부르지 않았다');
  assert.equal(w.ctx.PuHwpPreview.isOpen(), true);
  real.doc.key('Escape');
  assert.equal(w.ctx.PuHwpPreview.isOpen(), false);
  real.held[0].res({ pageCount: 1 });
  const r = await p;
  assert.equal(r.ok, false);
  assert.equal(r.cancelled, true, '진짜 창의 취소 표시를 못 알아봤다');
  assert.equal(w.els.cwHwpMsg.textContent, '고른 파일은 이 화면에서만 읽습니다', '「다른 파일을 열어 …」 같은 엉뚱한 말이 떴다');
  assert.equal(w.els.cwHwpMsg.className, 'days');
});
test('㊱ 불러오는 사이 창을 닫고 같은 파일을 다시 골라도 다시 열린다 — 고르기 칸은 이미 비어 있다', async () => {
  const pv = pvPreview({ hold: true });
  const w = world({ preview: pv });
  const inp = { files: [pvFile('서명본.hwpx', [1])], value: '서명본.hwpx' };
  const p1 = w.ctx.grOpenHwp(inp);
  assert.equal(inp.value, '', '불러오기가 끝나야 비운다 — 그사이 같은 파일을 고르면 브라우저가 change 를 안 띄운다');
  await tick();
  assert.equal(pv.calls.length, 1);
  /* 사람이 창을 닫고 📂 를 다시 눌러 같은 파일을 고른다 — 칸이 비어 있으니 change 가 뜬다 */
  inp.value = '서명본.hwpx';
  const p2 = w.ctx.grOpenHwp(inp);
  assert.equal(inp.value, '');
  await tick();
  assert.equal(pv.calls.length, 2, '다시 고른 파일을 열지 않았다');
  pv.calls[0].reject(pvCancel('미리보기가 닫혀 취소되었습니다'));   /* 옛 요청은 진짜 창에서 «취소»로 끝난다 */
  const r1 = await p1;
  assert.equal(r1.cancelled, true);
  assert.notEqual(w.els.cwHwpMsg.className, 'err-s', '옛 요청의 취소가 빨간 줄로 떴다');
  pv.calls[1].resolve();
  const r2 = await p2;
  assert.equal(r2.ok, true);
  assert.equal(w.els.cwHwpMsg.textContent, '열었습니다 — 서명본.hwpx');
});