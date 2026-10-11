'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 화면 검사 (2026-10-10)
 * ★ 지키는 것: 쓰기는 서류 진행 기록 줄 하나(scal_docs/{업체}/{rid}/items/{키} .set)뿐 · 숫자 칸을 누르면 거르고 다시 누르면 풀린다 · 내 담당만 · 서고는 읽기만 ·
 *   오류·빈 상태 문구(설계서 §5) · 본문은 그리지 않는다
 *   받은 서류함(2026-10-11): 메일함은 읽기만 · 「연결」은 같은 줄 하나 .set 안의 link · 「열어 보기」는 한 번에 하나, 받은 것은 담지 않는다
 *   대형 사업 단계 열 표(2026-10-11, 설계 2-A): 69~80번 — 칸 창이 항목(data-item)을 받고, 체크 글·안내·「막힌 단계」 알림
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
const I = require('../js/pu-gov-report-inbox.js');
const MO = require('../js/rules-v2/mail-orig.js');
require('../js/pu-co-thread.js');
const CT = globalThis.PuCoThread;
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
  'grView', 'grLoadTrack', 'grApplyTrack', 'grOpenCell', 'grPickCell', 'grRenderCell', 'grSaveCell', 'grCloseCell', 'grOkId', 'grPickHwp', 'grOpenHwp',
  'grLoadInbox', 'grReadInbox', 'grRetryInbox', 'grRenderInbox', 'grLinkCand', 'grUnlink',
  'grSendCtx', 'grSay', 'grRenderSend', 'grApplyFields', 'grMarkSent', 'grLinkReply', 'grCopy', 'grOpenMail', 'grWriteMail', 'grWriteSubmit',
  'grMailFetch', 'grMailCall', 'grRdHtml', 'grReadRd', 'grRenderCrit',
  'grOpenCand', 'grOpenLinked', 'grOpenAtt', 'grLib', 'grShowAtt', 'grRenderAv', 'grPdfDraw', 'grPdfPage', 'grCloseAv'];

function fakeEl() { return { innerHTML: '', textContent: '', value: '', checked: false, disabled: false, style: {} }; }
function world(o) {
  o = o || {};
  const db = FakeDb.만들기(o.seed || F.seed());
  const els = {};
  ['cwKey', 'cwSt', 'cwSent', 'cwGot', 'cwHow', 'cwAck', 'cwNote', 'cwHwpMsg'].forEach((id) => { els[id] = fakeEl(); }); // 칸 창 입력 — 진짜 DOM 에서는 innerHTML 이 만든다
  const urls = { made: [], revoked: [] };   // 보기 창이 만든·버린 blob 주소
  const ctx = { console: { warn() {} }, Promise, Object, Array, JSON, String, Number, Math, Date, RegExp, Error, isFinite,
    encodeURIComponent, PuGovReportList: L, PuGovReport: { FORMS: Rpt.FORMS }, PuGovReportDocs: D, PuGovReportTrack: Tr,
    PuGovReportInbox: I, PuGovReportSend: require('../js/pu-gov-report-send.js'), PuGovReportCriteria: require('../js/pu-gov-report-criteria.js'), PuRulesMailOrig: MO, PuCoThread: CT, setTimeout, clearTimeout, AbortController,
    /* 받은 서류함 — 가짜 서버(mailServer)·로그인·blob 주소. 서버를 안 주면 부르는 순간 실패한다 */
    fetch: (o.mail && o.mail.fetch) || (async () => { throw new Error('이 검사는 서버를 부르면 안 된다'); }),
    firebase: { auth: () => ({ currentUser: o.noUser ? null : { getIdToken: async () => 'tok' } }) },
    URL: { createObjectURL: (b) => { urls.made.push(b); return 'blob:' + urls.made.length; }, revokeObjectURL: (u) => { urls.revoked.push(u); } },
    Blob: function (parts, opt) { this.parts = parts; this.type = opt && opt.type; },
    $: (id) => (els[id] = els[id] || fakeEl()),
    fbDb: o.db ? o.db(db) : db };
  if (o.preview) ctx.PuHwpPreview = o.preview;
  if (o.pdfjs) ctx.pdfjsLib = o.pdfjs;
  if (o.xlsx) ctx.XLSX = o.xlsx;
  if (o.document) ctx.document = o.document;
  ctx.window = ctx;
  ctx.navigator = o.nav || { clipboard: { writeText: async (t) => { ctx.copied = t; } } };
  vm.createContext(ctx);
  vm.runInContext([varLine('GR_NODES'), varLine('GR_FIELDS'), varLine('GR_DOC_NODES'), varLine('GR_TRACK_NODES'), varLine('GR_INBOX_NODES'),
    varLine('GR_MAIL'), varLine('GR')].join('\n') + '\n' + NAMES.map(grab).join('\n')
    + "\ngrToday=function(){ return '2026-10-10'; };", ctx);
  if (o.email) vm.runInContext('GR.email=' + JSON.stringify(o.email) + ';', ctx);
  return { ctx, db, els, urls };
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

test('⑮ 대형은 단계 표(목차 단추 유지) · 틀 없음은 «서류 목차 보기» 줄만 · 연결 없는 사업은 안내 · [확인 필요] 틀 딱지', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-02');
  let h = w.els.docs.innerHTML;
  assert.ok(h.includes('대형') && h.includes('가나상사') && h.includes('data-toc="1"'));
  assert.ok(!h.includes('①초안') && !h.includes('서류 목차 보기'), '대형은 간단형 열이 아니라 단계 열 표(설계 2-A) — 「목차」 단추는 남는다');
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
  assert.doesNotMatch(INLINE, /esm\.sh|edwardkim\.github\.io|createEditor/);
  /* window.open 은 푸른메일함 쓰기 창(이름 puMailWrite — 같은 앱)을 여는 grOpenMail 안에서만 */
  assert.doesNotMatch(INLINE.replace(grab('grOpenMail'), ''), /window\.open/);
  assert.doesNotMatch(grab('grOpenMail'), /window\.open\(\s*['"]https?:/);
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

/* ══ 받은 서류함(📥 받은 서류 후보 · 연결 · 열어 보기) — 설계 2026-10-11-gov-report-inbox-design.md ══ */

/* 가짜 서버 함수 — readMailMessage(peek)·readOldMail(목록)은 첨부 목록을, readMailAttachment·readOldMail(index)은 그 첨부를 준다 */
const ATTS = [{ i: 0, part: '2', name: '서명본.hwpx', size: 4 }, { i: 1, part: '3', name: '확인서.pdf', size: 4 },
  { i: 2, part: '4', name: '현장.jpg', size: 4 }, { i: 3, part: '5', name: '보고서 초안.pdf', size: 4 },
  { i: 4, part: '6', name: '점검표.xlsx', size: 4 }, { i: 5, part: '', name: '자료.pdf', size: 4 }];
function mailServer(o) {
  o = o || {};
  const calls = [];
  const atts = o.atts || ATTS;
  const reply = (status, j) => ({ status, json: async () => j });
  const fetch = async (url, init) => {
    const fn = url.slice(url.lastIndexOf('/') + 1), body = JSON.parse(init.body);
    calls.push({ url, fn, body, auth: init.headers.Authorization, method: init.method });
    if (o.hold) await o.hold;
    if (o.never) return new Promise(() => {});
    if (o.status) return reply(o.status, { ok: false, error: 'error' in o ? o.error : '거절' });
    if (fn === 'readMailMessage' || (fn === 'readOldMail' && body.index == null)) return reply(200, { ok: true, html: '<p>본문</p>', text: '본문', atts });
    if (fn !== 'readMailAttachment' && fn !== 'readOldMail') return reply(400, { ok: false, error: '?' });
    const a = atts.filter((x) => x.i === body.index)[0];
    return a ? reply(200, { ok: true, name: a.name, mime: 'text/html', b64: 'UEsDBA==' }) : reply(404, { ok: false, error: '그 첨부가 없습니다' });
  };
  return { fetch, calls };
}
/* 가짜 pdf.js — 받은 인자와 닫기(destroy)를 센다 */
function fakePdf() {
  const st = { got: null, destroyed: 0 };
  const lib = { GlobalWorkerOptions: {}, getDocument: (o) => { st.got = o; return { promise: Promise.resolve({ numPages: 3,
    getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }), render: () => ({ promise: Promise.resolve() }) }),
    destroy: () => { st.destroyed++; } }) }; } };
  return { lib, st };
}
/* 불러오고 → 사업 고르고 → 칸 창 열고 → 메일함 읽기가 끝날 때까지 */
async function cellOf(w, biz, co, ty, step, item) {
  await w.ctx.grLoad();
  w.ctx.grSetBiz(biz);
  w.ctx.grOpenCell(co, ty, step, item);
  await w.ctx.grLoadInbox();
}
/* 발송일이 없는 다라정밀 서명 줄 — 서명 칸은 «저장된 발송일»이 있으면 회신 후보를 앞으로 올린다(2026-10-11 서명 요청).
   아래 받은 서류함 검사는 날짜 내림차순 목록·그 번호를 보는 것이라 발송일 없는 씨앗으로 돌린다(회신 순서는 60·61번 검사가 본다) */
function inboxSeed() { const s = F.seed(); delete s.scal_docs.c2.t3_2026.items.sign.sentAt; return s; }

test('㊲ 칸 창 「📥 받은 서류 후보」 — 그 업체 주소로 오간 첨부 메일만, 날짜 내림차순 · 받음/보냄 · 첨부 이름 · 개인 자료는 목록에만', async () => {
  const w = world({ seed: inboxSeed() });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  assert.ok(w.els.cellw.innerHTML.includes('<div id="cwInbox"></div>'));
  const h = w.els.cwInbox.innerHTML;
  ['📥 받은 서류 후보', '보냄 → 외부 · 2026-10-01', '받음 ← 다라정밀 담당 · 2026-09-25', '서명본 보내드립니다', '📎 서명본.hwpx', '📎 확인서.pdf',
    '<span class="st st-todo">개인 자료 · 목록에만</span>', I.MSG.NAME_NOTE].forEach((s) => assert.ok(h.includes(s), s));
  const at = (s) => h.indexOf(s);
  assert.ok(at('보고서 초안') < at('현장 사진') && at('현장 사진') < at('자료 보냅니다') && at('자료 보냅니다') < at('서명본 보내드립니다'), '날짜 내림차순');
  ['첨부 없음', '기간 밖', '다른 업체 주소', '스팸'].forEach((s) => assert.ok(!h.includes(s), s + ' 가 후보에 나왔다'));
  const priv = h.split('<li>').filter((x) => x.includes('9월 급여대장.xlsx'))[0];
  assert.ok(priv && !priv.includes('grOpenCand') && !priv.includes('grLinkCand'), '개인 자료는 연결·열어 보기를 막는다');
  assert.match(h, /onclick="grOpenCand\(3,0\)">열어 보기/);
  assert.match(h, /onclick="grLinkCand\(3,0\)">연결/);
  assert.equal(w.db.쓴것.length, 0, '목록은 읽기만');
});

test('㊳ 주소가 없는 업체는 안내 · 기술보호 사업은 딱지(열기는 된다) · 메일함은 한 번만 읽는다', async () => {
  let n = 0;
  const w = world({ db: (db) => ({ ref: (p) => { if (p === 'mailbox/folders') n++; return db.ref(p); } }) });
  await cellOf(w, 'consulting-05', 'c3', 't4', 'sign');
  assert.ok(w.els.cwInbox.innerHTML.includes(I.MSG.NO_ADDR));
  w.ctx.grCloseCell();
  w.ctx.grSetBiz('consulting-03');
  w.ctx.grOpenCell('c1', 't1', 'attach');
  await w.ctx.grLoadInbox();
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes('자문 일지 회신') && h.includes('<span class="st st-draft">기술보호 자료</span>'));
  assert.match(h, /onclick="grOpenCand\(0,0\)">열어 보기/, '기술보호 자료도 열어 볼 수 있다');
  assert.equal(n, 1, '메일함 폴더 표는 한 번만 읽는다');
});

test('㊴ 메일함을 못 읽으면 「메일함을 불러오지 못했습니다」 + 다시 시도 — 칸 창의 다른 기능은 그대로', async () => {
  let deny = true;
  const w = world({ db: (db) => ({ ref: (p) => (deny && p.indexOf('mailbox') === 0
    ? { once: async () => { throw new Error('permission_denied'); } } : db.ref(p)) }) });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes('메일함을 불러오지 못했습니다') && h.includes('onclick="grRetryInbox()"'));
  assert.ok(w.els.cellw.innerHTML.includes('onclick="grSaveCell()"'), '저장은 그대로');
  deny = false;
  await w.ctx.grRetryInbox();
  assert.ok(w.els.cwInbox.innerHTML.includes('서명본 보내드립니다'));
});

test('㊵ 「연결」 — 그 서류 줄 하나만 .set, link 는 줄 안에 · 상태만 고친 저장도 link 를 이어 받는다 · 「연결 지우기」는 link 만 뺀다', async () => {
  const w = world({ email: 'p009@pureun.kr', seed: inboxSeed() });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  w.els.cwSt.value = 'doing'; w.els.cwSent.value = '2026-09-20';   // 칸 창에 보이는 값(진짜 DOM 에서는 그려진 값)
  await w.ctx.grLinkCand(3, 0);
  onlyTrackWrites(w.db);
  assert.equal(w.db.쓴것.length, 1);
  const v = w.db.쓴것[0];
  assert.equal(v.자리, 'scal_docs/c2/t3_2026/items/sign');
  assert.deepEqual(v.값.link, { src: 'mail', key: 'i:INBOX-0a1b2c3d:101', name: '서명본.hwpx', date: '2026-09-25' });
  assert.deepEqual([v.값.st, v.값.sentAt, v.값.by], ['doing', '2026-09-20', '홍길동'], '칸 창 값과 함께 쓴다');
  assert.ok(w.els.cellw.innerHTML.includes('연결했습니다'));
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes('연결된 서류') && h.includes('서명본.hwpx · 2026-09-25') && h.includes('onclick="grOpenLinked()"') && h.includes('onclick="grUnlink()"'));
  w.els.cwSt.value = 'done'; w.els.cwGot.value = '2026-10-08';
  await w.ctx.grSaveCell();
  assert.deepEqual(w.db.쓴것[1].값.link, v.값.link, '상태만 고쳐도 link 가 남는다');
  assert.equal(w.db.쓴것[1].값.st, 'done');
  await w.ctx.grUnlink();
  onlyTrackWrites(w.db);
  const u = w.db.쓴것[2].값;
  assert.equal(u.link, undefined);
  assert.deepEqual([u.st, u.gotAt], ['done', '2026-10-08'], '서류 줄 상태는 그대로');
  assert.ok(w.els.cellw.innerHTML.includes('연결을 지웠습니다'));
  assert.ok(!w.els.cwInbox.innerHTML.includes('연결된 서류'));
});

test('㊶ 규칙 게시 전 — link 가 든 저장이 거절되면 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」, 표·값은 그대로 · link 없는 저장은 된다', async () => {
  const w = world({ db: (db) => ({ ref: (p) => (p.indexOf('scal_docs/') === 0
    ? { set: async (v) => { if (v && v.link) throw new Error('PERMISSION_DENIED'); return db.ref(p).set(v); } } : db.ref(p)) }) });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  w.els.cwSt.value = 'doing'; w.els.cwSent.value = '2026-09-20';
  await w.ctx.grLinkCand(3, 0);
  assert.ok(w.els.cellw.innerHTML.includes('저장하지 못했습니다 — 규칙 게시 또는 권한 확인'));
  assert.equal(w.ctx.GR.track.c2.t3_2026.sign.link, undefined);
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(!w.els.cwInbox.innerHTML.includes('연결된 서류'));
  w.els.cwSt.value = 'done'; w.els.cwGot.value = '2026-10-08';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 1, 'link 가 없는 저장은 게시 전에도 된다');
  assert.equal(w.db.쓴것[0].값.link, undefined);
});

test('㊷ 「열어 보기」(한글) — 서버에서 그 한 건만(peek) 받아 한글 미리보기로 · 로그인 증표 · 아무것도 쓰지·담지 않는다', async () => {
  const mail = mailServer();
  const pv = pvPreview();
  const w = world({ mail, preview: pv, seed: inboxSeed() });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  const r = await w.ctx.grOpenCand(3, 0);
  assert.equal(r.ok, true);
  assert.deepEqual(mail.calls.map((c) => c.fn), ['readMailMessage', 'readMailAttachment']);
  assert.deepEqual(mail.calls[0].body, { slug: 'INBOX-0a1b2c3d', uid: '101', peek: true }, '읽음 표시를 건드리지 않는다(peek)');
  assert.deepEqual(mail.calls[1].body, { slug: 'INBOX-0a1b2c3d', uid: '101', index: 0, part: '2' });
  mail.calls.forEach((c) => {
    assert.equal(c.auth, 'Bearer tok');
    assert.equal(c.method, 'POST');
    assert.ok(c.url.startsWith(w.ctx.GR_MAIL.fn), c.url);
  });
  assert.equal(pv.calls.length, 1);
  assert.equal(pv.calls[0].name, '서명본.hwpx');
  assert.deepEqual([...new Uint8Array(pv.calls[0].buf)], [80, 75, 3, 4]);
  assert.ok(w.els.cwInbox.innerHTML.includes('열었습니다 — 서명본.hwpx'));
  assert.equal(w.db.쓴것.length, 0, '받은 것을 어디에도 쓰지 않는다');
});

test('㊸ 한 번에 하나 — 받는 동안 다른 「열어 보기」는 잠기고 눌러도 서버를 부르지 않는다 · 지난 메일은 1분 안내', async () => {
  const g = gate();
  const mail = mailServer({ hold: g.p });
  const w = world({ mail, preview: pvPreview() });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  const first = w.ctx.grOpenCand(3, 0);
  await tick();
  assert.equal(w.ctx.GR.avBusy, true);
  assert.match(w.els.cwInbox.innerHTML, /onclick="grOpenCand\(3,1\)" disabled/, '다른 단추가 잠긴다');
  assert.ok(w.els.cwInbox.innerHTML.includes(I.MSG.WAIT));
  const second = await w.ctx.grOpenCand(3, 1);
  assert.equal(second.ok, false);
  assert.equal(second.busy, true);
  assert.equal(mail.calls.length, 1, '두 번째는 서버를 부르지 않았다');
  g.go(); await first;
  assert.equal(w.ctx.GR.avBusy, false);
  assert.doesNotMatch(w.els.cwInbox.innerHTML, /onclick="grOpenCand\(3,1\)" disabled/);
  /* 지난 메일(POP3) 연결 — 안내가 다르고 readOldMail 로 간다 */
  const s = F.seed();
  s.scal_docs.c2.t3_2026.items.sign.link = { src: 'mail', key: 'o:AB12_x', name: '자료.pdf' };
  const g2 = gate();
  const m2 = mailServer({ hold: g2.p });
  const v = world({ seed: s, mail: m2, pdfjs: fakePdf().lib });
  await cellOf(v, 'consulting-04', 'c2', 't3', 'sign');
  const p = v.ctx.grOpenLinked();
  await tick();
  assert.ok(v.els.cwInbox.innerHTML.includes('불러오는 중… (지난 메일은 1분쯤 걸립니다)'));
  g2.go(); await p;
  assert.deepEqual(m2.calls.map((c) => [c.fn, c.body]), [['readOldMail', { key: 'AB12_x' }], ['readOldMail', { key: 'AB12_x', index: 5 }]]);
});

test('㊹ PDF·그림·표는 앱 안 보기 창 — 판독기는 저장소 vendor 에서, 닫으면 blob 주소·PDF 를 버린다', async () => {
  const mail = mailServer();
  const pdf = fakePdf();
  const xs = { read: (b, o) => { xs.got = [b, o]; return { SheetNames: ['점검', '둘째'], Sheets: { 점검: {} } }; },
    utils: { sheet_to_json: () => { const rows = [['<b>칸</b>', '둘']]; for (let i = 0; i < 250; i++) rows.push([i, '값']); return rows; } } };
  const w = world({ mail, pdfjs: pdf.lib, xlsx: xs, seed: inboxSeed() });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  /* PDF — 그림처럼 그린다(PDF 속 스크립트가 돌지 않게) */
  await w.ctx.grOpenCand(3, 1);
  assert.equal(pdf.st.got.isEvalSupported, false);
  assert.ok(pdf.st.got.data instanceof Uint8Array);
  assert.match(pdf.lib.GlobalWorkerOptions.workerSrc, /^vendor\/pdf\.worker\.min\.js\?v=\d+$/);
  let h = w.els.attv.innerHTML;
  assert.equal(w.els.attv.style.display, '');
  assert.ok(h.includes('<canvas id="avCanvas" class="av-pdf"></canvas>') && h.includes('<b>1</b> / 3') && h.includes('data-close'));
  w.ctx.grPdfPage(1);
  assert.equal(w.ctx.GR.av.page, 2);
  w.ctx.grCloseAv();
  assert.equal(pdf.st.destroyed, 1);
  assert.equal(w.els.attv.style.display, 'none');
  /* 그림 — 종류는 확장자로 우리가 정한다 */
  await w.ctx.grOpenCand(1, 0);
  assert.equal(w.urls.made[0].type, 'image/jpeg');
  assert.ok(w.els.attv.innerHTML.includes('<img class="av-img" src="blob:1" alt="현장.jpg">'));
  w.ctx.grCloseAv();
  assert.deepEqual(w.urls.revoked, ['blob:1'], '닫으면 그 파일은 사라진다');
  assert.equal(w.ctx.GR.av, null);
  /* 표 — 첫 시트 앞 200행, 칸은 이스케이프 */
  await w.ctx.grOpenCand(0, 1);
  h = w.els.attv.innerHTML;
  assert.equal((h.match(/<tr>/g) || []).length, 200);
  assert.ok(h.includes('<th>&#60;b&#62;칸&#60;/b&#62;</th>') && !h.includes('<b>칸'));
  assert.ok(h.includes('「점검」 등 2장 중 첫 장'));
  assert.equal(xs.got[1].type, 'array');
  assert.equal(xs.got[1].sheetRows, I.SHEET_ROWS + 1, '읽기부터 앞 줄만 푼다(SheetJS sheetRows)');
  assert.equal(w.db.쓴것.length, 0);
});

test('㊺ 실패 문구 — 첨부 없음 · 로그인 · 응답 없음 · 너무 큼 · 열 수 없는 형식 — 칸 창은 그대로, 잠금은 풀린다', async () => {
  const cases = [
    [{ atts: [{ i: 0, part: '2', name: '다른.pdf', size: 4 }] }, {}, I.MSG.GONE],
    [{ status: 401 }, {}, I.MSG.LOGIN],
    [{}, { noUser: true }, I.MSG.LOGIN],
    [{ never: true }, { wait: 5 }, I.MSG.NO_REPLY],
    [{ atts: [{ i: 0, part: '2', name: '서명본.hwpx', size: 21 * 1024 * 1024 }] }, {}, I.MSG.TOO_BIG],
  ];
  for (const [srv, opt, want] of cases) {
    const mail = mailServer(srv);
    const w = world(Object.assign({ mail, preview: pvPreview(), seed: inboxSeed() }, opt));
    if (opt.wait) vm.runInContext('GR_MAIL.wait=' + opt.wait + ';', w.ctx);
    await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
    const cw = w.ctx.GR.cw, msg = cw.msg, cell = w.els.cellw.innerHTML;
    const r = await w.ctx.grOpenCand(3, 0);
    assert.equal(r.ok, false, want);
    assert.ok(w.els.cwInbox.innerHTML.includes(want), want);
    assert.match(w.els.cwInbox.innerHTML, /class="err-s"/);
    assert.strictEqual(w.ctx.GR.cw, cw);
    assert.equal(cw.msg, msg);
    assert.equal(w.els.cellw.innerHTML, cell, '칸 창을 다시 그리지 않는다');
    assert.equal(w.ctx.GR.avBusy, false, '실패해도 잠금은 풀린다');
    assert.equal(w.db.쓴것.length, 0);
  }
  const mail = mailServer();
  const w = world({ mail, seed: inboxSeed() });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  await w.ctx.grOpenCand(1, 1);
  assert.ok(w.els.cwInbox.innerHTML.includes(I.MSG.CANT));
  assert.equal(mail.calls.length, 0, '열 수 없는 형식은 서버를 부르지 않는다');
});

test('㊻ 연결된 서류 「열어 보기」 — 연결 열쇠로 그 메일·그 이름 · 후보 줄의 바깥 값은 이스케이프', async () => {
  const s = F.seed();
  s.scal_docs.c2.t3_2026.items.sign.link = { src: 'mail', key: 'i:INBOX-0a1b2c3d:101', name: '확인서.pdf', date: '2026-09-25' };
  const m = s.mailbox.msgs['INBOX-0a1b2c3d']['101'];
  m.s = '<img src=x>'; m.f = '<b>보낸이</b>'; m.an = ['<i>.pdf'];
  const mail = mailServer();
  const w = world({ seed: s, mail, pdfjs: fakePdf().lib });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes('연결된 서류') && h.includes('확인서.pdf · 2026-09-25'));
  assert.ok(!h.includes('<img') && !h.includes('<b>보낸이') && !h.includes('<i>.pdf'), '이스케이프 안 됨');
  assert.ok(h.includes('&#60;img src=x&#62;') && h.includes('&#60;b&#62;보낸이'));
  await w.ctx.grOpenLinked();
  assert.deepEqual(mail.calls.map((c) => c.fn + ':' + (c.body.part || '')), ['readMailMessage:', 'readMailAttachment:3']);
});

test('㊼ 정적 — 메일함은 GR_INBOX_NODES 로만 · 받은 바이트는 저장·업로드·내려받기 없음 · 외부 주소 없음 · 판독기는 누를 때 vendor 에서', () => {
  assert.match(SRC, /var GR_INBOX_NODES=\{folders:'mailbox\/folders',msgs:'mailbox\/msgs',cos:'data\/companies'\};/);
  assert.doesNotMatch(INLINE, /ref\(\s*['"](mailbox|data\/companies)/, 'GR_INBOX_NODES 를 거치지 않았다');
  const RULES = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8');
  const base = (RULES.match(/const MAIL_FN_BASE="([^"]+)"/) || [])[1];
  assert.ok(base && SRC.includes("fn:'" + base + "'"), '서버 함수 주소는 취업규칙 화면과 같은 곳');
  const body = ['grOpenAtt', 'grShowAtt', 'grRenderAv', 'grCloseAv', 'grOpenCand', 'grOpenLinked', 'grLib'].map(grab).join('\n');
  assert.doesNotMatch(body, /localStorage|sessionStorage|indexedDB|caches\.|FormData|download|\.set\(|\.update\(|\.push\(|\.put\(|window\.open|https?:\/\//);
  const libs = [...INLINE.matchAll(/grLib\('([^']+)'/g)].map((x) => x[1]);
  assert.ok(libs.length >= 2 && libs.every((x) => /^vendor\/[\w.-]+\.js\?v=\d+$/.test(x)), '판독기는 저장소 vendor 에서만: ' + libs.join(', '));
  assert.match(grab('grShowAtt'), /workerSrc='vendor\/pdf\.worker\.min\.js\?v=\d+'/);
  assert.match(grab('grShowAtt'), /isEvalSupported:false/);
  assert.match(SRC, /<div id="attv" class="toc" style="display:none"><\/div>/);
  assert.doesNotMatch(SRC.slice(0, SRC.indexOf('</head>')), /vendor\/(pdf|xlsx)/, '판독기는 누를 때 싣는다');
});

test('㊽ 폴더마다 최근 메일만 읽는다(GR_MAIL.per) — 넘치면 안내', async () => {
  const w = world();
  vm.runInContext('GR_MAIL.per=2;', w.ctx);
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  assert.equal(w.ctx.GR.inbox.clipped, true);
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes(I.MSG.CLIPPED));
  assert.ok(h.includes('현장 사진') && !h.includes('서명본 보내드립니다'), '열쇠 순 뒤에서 둘(106·107)만 읽었다');
});

/* ══ 최종 검토 고침(2026-10-11) ══ */
const LONG_PDF = '가'.repeat(66) + '.pdf';   // 거울에는 앞 60자만 남는다(확장자 잘림)

test('㊾ 긴 첨부 이름 — 거울의 잘린 이름으로도 서버에 물어 온 이름으로 형식을 정해 연다(「열 수 없는 형식」으로 막지 않는다)', async () => {
  const s = inboxSeed();
  const cut = I.mirrorName(LONG_PDF);
  s.mailbox.msgs['INBOX-0a1b2c3d']['101'].an = [cut, '확인서.pdf'];
  const mail = mailServer({ atts: [{ i: 0, part: '2', name: LONG_PDF, size: 4 }, { i: 1, part: '3', name: '확인서.pdf', size: 4 }] });
  const pdf = fakePdf();
  const w = world({ seed: s, mail, pdfjs: pdf.lib });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  assert.doesNotMatch(w.els.cwInbox.innerHTML, /grOpenCand\(3,0\)"[^>]*title=/, '잘린 이름에 「열 수 없는 형식」 풍선을 달지 않는다');
  const r = await w.ctx.grOpenCand(3, 0);
  assert.equal(r.ok, true);
  assert.deepEqual(mail.calls.map((c) => c.fn), ['readMailMessage', 'readMailAttachment']);
  assert.deepEqual(mail.calls[1].body, { slug: 'INBOX-0a1b2c3d', uid: '101', index: 0, part: '2' });
  assert.ok(pdf.st.got && pdf.st.got.data instanceof Uint8Array, 'PDF 로 열었다');
  assert.ok(w.els.attv.innerHTML.includes(LONG_PDF), '보기 창에는 온 이름');
  assert.ok(w.els.cwInbox.innerHTML.includes('열었습니다 — ' + LONG_PDF));
  /* 앞 60자가 같은 첨부가 둘이면 고르지 않는다 — 바이트를 받지 않고 알린다 */
  const amb = mailServer({ atts: [{ i: 0, part: '2', name: LONG_PDF, size: 4 }, { i: 1, part: '3', name: '가'.repeat(66) + '.hwpx', size: 4 }] });
  const v = world({ seed: s, mail: amb, pdfjs: fakePdf().lib });
  await cellOf(v, 'consulting-04', 'c2', 't3', 'sign');
  assert.equal((await v.ctx.grOpenCand(3, 0)).ok, false);
  assert.deepEqual(amb.calls.map((c) => c.fn), ['readMailMessage']);
  assert.ok(v.els.cwInbox.innerHTML.includes(I.MSG.AMBIG));
  assert.equal(v.ctx.GR.avBusy, false);
});

test('㊾-2 60자 첨부 X 와 줄이면 X 가 되는 70자 첨부 — 거울에 X 가 두 번 · 어느 줄을 눌러도 거절(바이트 안 받음)', async () => {
  const X = '가'.repeat(60), Y = X + '나머지 열 글자.pdf';
  const s = inboxSeed();
  s.mailbox.msgs['INBOX-0a1b2c3d']['101'].an = [X, I.mirrorName(Y)];
  const mail = mailServer({ atts: [{ i: 0, part: '2', name: X, size: 4 }, { i: 1, part: '3', name: Y, size: 4 }] });
  const w = world({ seed: s, mail, pdfjs: fakePdf().lib });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  for (const j of [0, 1]) {
    assert.equal((await w.ctx.grOpenCand(3, j)).ok, false);
    assert.ok(w.els.cwInbox.innerHTML.includes(I.MSG.AMBIG), 'row ' + j);
    assert.equal(w.ctx.GR.avBusy, false);
  }
  assert.deepEqual(mail.calls.map((c) => c.fn), ['readMailMessage', 'readMailMessage'], '받기는 부르지 않는다');
  assert.equal(w.ctx.GR.av, null);
});

test('㊿ 404 에 서버가 적은 까닭(최근 400통 밖 등)을 그대로 — 이스케이프해서', async () => {
  const why = '이 칸에서는 최근 400통만 열어 줍니다 — <b>그 밖</b>';
  const mail = mailServer({ status: 404, error: why });
  const w = world({ mail, preview: pvPreview() });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  await w.ctx.grOpenCand(3, 0);
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes('이 칸에서는 최근 400통만 열어 줍니다 — &#60;b&#62;그 밖&#60;/b&#62;'), h);
  assert.ok(!h.includes('<b>그 밖') && !h.includes(I.MSG.GONE));
  const plain = mailServer({ status: 404, error: '' });
  const v = world({ mail: plain, preview: pvPreview() });
  await cellOf(v, 'consulting-04', 'c2', 't3', 'sign');
  await v.ctx.grOpenCand(3, 0);
  assert.ok(v.els.cwInbox.innerHTML.includes(I.MSG.GONE), '까닭이 없으면 그대로 「지워졌을 수 있습니다」');
});

test('51 업체 주소 — 업체관리 이름이 달라도 사업자번호로 그 업체 줄을 찾는다(칸 창이 bizNo 를 넘긴다)', async () => {
  const s = F.seed();
  const list = Array.isArray(s.scal_cos) ? s.scal_cos : Object.keys(s.scal_cos).map((k) => s.scal_cos[k]);
  list.filter((c) => c.id === 'c2')[0].bizNo = '123-00-00777';
  const m2 = s.data.companies.v.filter((c) => c.id === 'm2')[0];
  m2.name = '다라정밀 본사(이름 다름)'; m2.bizNo = '123-00-00777';
  const w = world({ seed: s });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  assert.equal(w.ctx.GR.cw.bizNo, '123-00-00777');
  const h = w.els.cwInbox.innerHTML;
  assert.ok(!h.includes(I.MSG.NO_ADDR), '사업자번호로 찾지 못했다');
  assert.ok(h.includes('서명본 보내드립니다'));
});

test('52 받는 사이 다른 칸 창을 열면 결과 안내는 그 창에 적지 않는다(성공·실패 모두) · 잠금은 풀린다', async () => {
  for (const srv of [{}, { status: 401 }]) {
    const g = gate();
    const mail = mailServer(Object.assign({ hold: g.p }, srv));
    const w = world({ mail, pdfjs: fakePdf().lib });
    await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
    const p = w.ctx.grOpenCand(3, 1);
    await tick();
    w.ctx.grCloseCell();
    w.ctx.grOpenCell('c2', 't3', 'submit');
    const other = w.ctx.GR.cw;
    assert.ok(other && other.step === 'submit');
    g.go(); await p;
    assert.strictEqual(w.ctx.GR.cw, other);
    assert.equal(w.ctx.GR.avMsg, '', '다른 창에 안내가 넘어왔다');
    assert.ok(!w.els.cwInbox.innerHTML.includes('열었습니다') && !w.els.cwInbox.innerHTML.includes(I.MSG.LOGIN));
    assert.equal(w.ctx.GR.avBusy, false);
  }
});

test('53 연결·연결 지우기가 목록 다시 읽기와 겹쳐도 문구는 「연결했습니다」/「연결을 지웠습니다」(「저장했습니다」 아님)', async () => {
  let W = null;
  const w = world({ email: 'p009@pureun.kr', db: (db) => ({ ref: (p) => (p.indexOf('scal_docs/') === 0
    ? { set: async (v) => { await db.ref(p).set(v); W.ctx.GR.track = Object.assign({}, W.ctx.GR.track); } } : db.ref(p)) }) });
  W = w;
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  w.els.cwSt.value = 'doing'; w.els.cwSent.value = '2026-09-20';
  await w.ctx.grLinkCand(3, 0);
  assert.equal(w.db.쓴것.length, 1);
  assert.ok(w.els.cellw.innerHTML.includes('연결했습니다 — 목록을 다시 불러온 뒤 확인해 주세요'), w.ctx.GR.cw.msg);
  await w.ctx.grUnlink();
  assert.ok(w.els.cellw.innerHTML.includes('연결을 지웠습니다 — 목록을 다시 불러온 뒤 확인해 주세요'), w.ctx.GR.cw.msg);
  assert.ok(!w.els.cellw.innerHTML.includes('저장했습니다'));
  await w.ctx.grSaveCell();
  assert.ok(w.els.cellw.innerHTML.includes('저장했습니다 — 목록을 다시 불러온 뒤 확인해 주세요'), '그냥 저장은 그대로');
});

test('54 응답 시간 제한 — 나간 요청을 끊는다(AbortController) · 「응답 없음」 · 잠금이 풀려 다시 누를 수 있다', async () => {
  const seen = [];
  const mail = { fetch: (url, init) => new Promise((ok, no) => {
    seen.push(init.signal);
    if (init.signal) init.signal.addEventListener('abort', () => no(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }) };
  const w = world({ mail, preview: pvPreview() });
  vm.runInContext('GR_MAIL.wait=5;', w.ctx);
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  const r = await w.ctx.grOpenCand(3, 0);
  assert.equal(r.ok, false);
  assert.equal(seen.length, 1);
  assert.ok(seen[0] && seen[0].aborted, '시간이 지나면 요청을 끊어야 한다');
  assert.ok(w.els.cwInbox.innerHTML.includes(I.MSG.NO_REPLY));
  assert.equal(w.ctx.GR.avBusy, false);
  await w.ctx.grOpenCand(3, 0);
  assert.equal(seen.length, 2, '잠금이 풀려 다시 서버를 부른다');
  assert.ok(seen[1].aborted && seen[1] !== seen[0], '요청마다 새로 끊는다');
});

test('55 보여 주기(grShowAtt)가 실패해도 잠금이 풀린다 — 판독기를 못 실음 · 깨진 PDF', async () => {
  /* 판독기(pdf.js)가 없고 vendor 스크립트도 못 실음 */
  const doc = { createElement: () => ({}), head: { appendChild: (s) => { setImmediate(() => s.onerror()); } } };
  const mail = mailServer();
  const w = world({ mail, document: doc, seed: inboxSeed() });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
  const r = await w.ctx.grOpenCand(3, 1);
  assert.equal(r.ok, false);
  assert.equal(w.ctx.GR.avBusy, false, '판독기를 못 실어도 잠금은 풀린다');
  assert.ok(w.els.cwInbox.innerHTML.includes('판독기를 불러오지 못했습니다'));
  assert.doesNotMatch(w.els.cwInbox.innerHTML, /grOpenCand\(3,0\)" disabled/);
  await w.ctx.grOpenCand(3, 1);
  assert.equal(mail.calls.length, 4, '다시 누르면 다시 부른다');
  /* 깨진 PDF */
  const bad = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.reject(new Error('Invalid PDF structure')) }) };
  const v = world({ mail: mailServer(), pdfjs: bad, seed: inboxSeed() });
  await cellOf(v, 'consulting-04', 'c2', 't3', 'sign');
  assert.equal((await v.ctx.grOpenCand(3, 1)).ok, false);
  assert.equal(v.ctx.GR.avBusy, false, '깨진 PDF 여도 잠금은 풀린다');
  assert.ok(v.els.cwInbox.innerHTML.includes('Invalid PDF structure'));
  assert.equal(v.ctx.GR.av, null);
});
/* ══ 서명 요청·보냄 기록·회신 후보·서명본 연결(칸 창 ③ #cwSend) — 설계 2026-10-11-gov-report-sign-submit-design.md ══ */

const S = require('../js/pu-gov-report-send.js');
const SENT_SLUG = 'Sent-1b2c3d4e';
const SIGN_LINK = { src: 'mail', key: 'i:INBOX-0a1b2c3d:107', name: '현장.jpg', date: '2026-09-29' };

/* 합성 씨앗 — 다라정밀 서명 줄(sign)을 마음대로 · 보낸편지함에 꼬리표 달린 메일을 더하고 싶으면 sentTags */
function signSeed(sign, o) {
  o = o || {};
  const s = F.seed();
  if (sign === null) delete s.scal_docs.c2;
  else if (sign) s.scal_docs.c2.t3_2026.items.sign = Object.assign({ by: '홍길동', at: Date.UTC(2026, 8, 20, 3) }, sign);
  (o.sentDays || []).forEach((d, i) => {
    s.mailbox.msgs[SENT_SLUG][202 + i] = { u: 202 + i, f: '푸른노무법인', e: 'office@pureun.kr', t: 'dara@example.com', tn: '다라정밀',
      s: '[서명요청:t3_2026] 인사노무 서명·날인 요청 (다라정밀)', d: Date.UTC(2026, 8, d, 1), a: 0 };
  });
  if (o.cc) s.data.companies.v.filter((c) => c.id === 'm2')[0].contacts.push({ name: '부담당', email: 'dara.sub@example.com' });
  return s;
}
/* 칸 창 입력값 — 진짜 DOM 에서는 그려진 값이다(저장 줄을 그대로 보여 준다) */
function showRec(w, r) {
  w.els.cwSt.value = r.st || 'none'; w.els.cwSent.value = r.sentAt || ''; w.els.cwGot.value = r.gotAt || ''; w.els.cwNote.value = r.note || '';
}
const signCell = (w) => cellOf(w, 'consulting-04', 'c2', 't3', 'sign');
const liOf = (html, s) => html.split('<li>').filter((x) => x.includes(s))[0] || '';

test('56 정적 — 서명 요청 모듈을 inbox 다음에 싣는다 · 쓰기는 여전히 .set 한 곳 · 메일 보내기 호출·mailto 없음', () => {
  assert.match(SRC, /<script src="js\/pu-gov-report-inbox\.js\?v=\d+"><\/script>\r?\n<script src="js\/pu-gov-report-send\.js\?v=\d+"><\/script>/,
    'send 모듈은 inbox 바로 뒤');
  assert.match(INLINE, /PuGovReportSend\./);
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], ['.set('], '쓰기 명령은 grSaveCell 의 .set 하나뿐');
  assert.doesNotMatch(INLINE, /ref\([^)]*\)\.push\(/);
  assert.doesNotMatch(INLINE, /sendMaterialMail|mailto:|\.send\s*\(|sendMail|httpsCallable/, '자동 발송 호출이 있다');
  ['grMarkSent', 'grLinkReply', 'grApplyFields', 'grWriteMail', 'grOpenMail', 'grRenderSend', 'grSendCtx'].forEach((n) =>
    assert.doesNotMatch(grab(n), /fbDb|\.set\(|\.update\(|fetch\(/, n + ' 이 직접 쓰거나 부른다'));
  assert.match(grab('grMarkSent'), /grSaveCell\(\)/);
  assert.match(grab('grLinkReply'), /grSaveCell\(\{link:lk\}\)/);
});

test('57 grRenderSend — 서명 칸: 주소 있으면 「서명 요청 메일 쓰기」 · 주소 없으면 안내만 · 완료면 단추 없음 · 불러오는 중엔 잠금', async () => {
  let w = world({ seed: signSeed() });
  await w.ctx.grLoad(); w.ctx.grSetBiz('consulting-04'); w.ctx.grOpenCell('c2', 't3', 'sign');
  assert.ok(w.els.cellw.innerHTML.includes('<div id="cwSend"></div>'), '서명 칸에 자리');
  assert.match(w.els.cwSend.innerHTML, /<button type="button" onclick="grWriteMail\(\)" disabled>✉ 서명 요청 메일 쓰기/, '메일함을 읽는 동안은 잠긴다');
  await w.ctx.grLoadInbox();
  let h = w.els.cwSend.innerHTML;
  assert.match(h, /<button type="button" onclick="grWriteMail\(\)">✉ 서명 요청 메일 쓰기<\/button>/);
  assert.ok(h.includes(S.MSG.ATTACH) && h.includes(S.MSG.DL_NOTE));
  assert.ok(h.includes('href="gov-consulting.html#rpt=c2|t3"'), '보고서 창 열기');
  assert.ok(!h.includes('보냈음 기록') && !h.includes('보낸 메일을 찾았습니다'), '이미 발송일이 있으면 보냄 기록 단추 없음');
  assert.equal(w.db.쓴것.length, 0, '그리기는 읽기만');
  /* 제출 칸 — 자리만 있다(제출 메일은 다음 일) · 기술보호 첨부 칸에는 자리 없음 */
  w.ctx.grCloseCell(); w.ctx.grOpenCell('c2', 't3', 'submit');
  assert.ok(w.els.cellw.innerHTML.includes('<div id="cwSend"></div>'));
  assert.ok(!w.els.cwSend.innerHTML.includes('서명 요청 메일 쓰기'));
  w.ctx.grCloseCell(); w.ctx.grSetBiz('consulting-03'); w.ctx.grOpenCell('c1', 't1', 'attach');
  assert.ok(!w.els.cellw.innerHTML.includes('id="cwSend"'));
  /* 주소 없는 업체 */
  const s = signSeed(); s.scal_docs.c3.t4_2026.items.sign.st = 'doing';
  w = world({ seed: s });
  await cellOf(w, 'consulting-05', 'c3', 't4', 'sign');
  h = w.els.cwSend.innerHTML;
  assert.ok(h.includes(S.MSG.NO_ADDR) && !h.includes('서명 요청 메일 쓰기'));
  /* 완료면 단추 없음 */
  w = world({ seed: signSeed({ st: 'done', sentAt: '2026-09-20', gotAt: '2026-09-30' }) });
  await signCell(w);
  h = w.els.cwSend.innerHTML;
  assert.ok(!h.includes('서명 요청 메일 쓰기') && !h.includes('보냈음 기록') && !h.includes('보낸 메일을 찾았습니다'));
  assert.ok(h.includes(S.MSG.ATTACH), '안내 글은 그대로');
});

test('58 grWriteMail — 쓰기 창(puMailComposeTo)에 {받는이·참조·꼬리표 제목·본문} 한 번 · 안 되면 주소만 싣고 본문은 클립보드 · 팝업 막힘은 안내', async () => {
  const calls = [];
  const win = (ret) => ({ puMailComposeTo(o) { calls.push(o); return ret; }, focus() { win.focused = (win.focused || 0) + 1; }, location: { href: '' } });
  let w = world({ seed: signSeed(null, { cc: true }) });
  await signCell(w);
  let fake = win(true);
  w.ctx.open = (u, n) => { assert.equal(n, 'puMailWrite'); return fake; };
  assert.equal(await w.ctx.grWriteMail(), true);
  assert.equal(calls.length, 1, '한 번만 부른다');
  const o = calls[0];
  assert.deepEqual(Object.keys(o).sort(), ['body', 'card', 'cc', 'subject', 'to']);
  assert.equal(o.card, '');
  assert.deepEqual([o.to, o.cc].sort(), ['dara.sub@example.com', 'dara@example.com'], '받는이 하나 + 참조(업체 다른 주소)');
  assert.ok(o.subject.startsWith('[서명요청:t3_2026] ') && o.subject.includes('다라정밀'), o.subject);
  assert.ok(o.body.includes('서명') && !o.body.includes('@'), '본문에 주소·연락처를 넣지 않는다');
  assert.ok(w.els.cwSendMsg.textContent.includes('쓰기 창을 열었습니다'));
  assert.equal(w.db.쓴것.length, 0, '메일을 열기만 한다 — 아무것도 쓰지 않는다');
  assert.ok(/서명\(날인\)하여 스캔본/.test(w.ctx.copied), '복사는 창을 열기 전에 해 둔다 — 열면 초점을 잃어 크롬이 거절한다(값 채우기가 되어도 본문이 복사돼 있다)');

  /* 주소 하나뿐 — 참조 없음 */
  calls.length = 0;
  w = world({ seed: signSeed(null) }); await signCell(w);
  w.ctx.open = () => win(true);
  await w.ctx.grWriteMail();
  assert.equal(calls[0].to, 'dara@example.com'); assert.equal(calls[0].cc, '');

  /* 쓰기 창이 값 채우기를 거절(로그인 전) · 함수가 없는 창 — 주소(본문 없이)로 + 본문은 클립보드 */
  for (const kind of ['false', 'none']) {
    calls.length = 0;
    w = world({ seed: signSeed(null) }); await signCell(w);
    fake = kind === 'false' ? win(false) : { focus() {}, location: { href: '' } };
    w.ctx.open = () => fake;
    assert.equal(await w.ctx.grWriteMail(), true);
    const body = S.draft('sign', { rid: 't3_2026', co: '다라정밀', biz: w.ctx.GR.cw.biz, reportName: w.ctx.GR.cw.keys[0].name }).body;
    const url = S.composeUrl('pu-cards.html', { to: 'dara@example.com', cc: '', subject: S.draft('sign', { rid: 't3_2026', co: '다라정밀', biz: w.ctx.GR.cw.biz, reportName: w.ctx.GR.cw.keys[0].name }).subject });
    assert.equal(fake.location.href, url, kind);
    assert.ok(url.startsWith('pu-cards.html?view=mail&to=dara%40example.com&subject='));
    assert.ok(!fake.location.href.includes(encodeURIComponent('서명(날인)')), '본문은 주소에 싣지 않는다');
    assert.equal(w.ctx.copied, body, '본문은 클립보드로');
    assert.ok(w.els.cwSendMsg.textContent.includes(S.MSG.BODY_COPIED));
    assert.equal(w.db.쓴것.length, 0);
  }

  /* 클립보드도 안 되면 알린다 */
  w = world({ seed: signSeed(null), nav: { clipboard: { writeText: async () => { throw new Error('denied'); } } } }); await signCell(w);
  w.ctx.open = () => win(false);
  await w.ctx.grWriteMail();
  assert.ok(w.els.cwSendMsg.textContent.includes('본문은 복사하지 못했습니다') && w.els.cwSendMsg.className === 'err-s');

  /* 팝업이 막혔다 — 조용히 실패하지 않는다 */
  w = world({ seed: signSeed(null) }); await signCell(w);
  w.ctx.open = () => null;
  assert.equal(await w.ctx.grWriteMail(), false);
  assert.ok(w.els.cwSendMsg.textContent.includes('쓰기 창이 막혔습니다') && w.els.cwSendMsg.className === 'err-s');
  w.ctx.open = () => { throw new Error('blocked'); };
  assert.equal(await w.ctx.grWriteMail(), false);
  assert.ok(w.els.cwSendMsg.textContent.includes('쓰기 창이 막혔습니다'));

  /* 받는이가 없으면 열지 않고 안내 */
  const s = signSeed(null); s.data.companies.v.filter((c) => c.id === 'm2')[0].primaryContactEmail = '';
  s.data.companies.v.filter((c) => c.id === 'm2')[0].contacts = [];
  w = world({ seed: s }); await signCell(w);
  let opened = 0; w.ctx.open = () => { opened++; return win(true); };
  assert.equal(await w.ctx.grWriteMail(), false);
  assert.equal(opened, 0);
  assert.ok(w.els.cwSendMsg.textContent.includes(S.MSG.NO_ADDR));
});

test('59 보낸 메일 찾기 — 꼬리표 메일이 있으면 «찾았습니다 + 날짜» · 「보낸 날로 기록」은 상태·발송일만 고쳐 note·link·gotAt 을 지키며 한 줄 .set · 못 찾으면 「보냈음 기록(오늘)」', async () => {
  const rec = { st: 'doing', sentAt: '2026-09-20', gotAt: '2026-09-30', note: '메모 그대로', link: SIGN_LINK };
  let w = world({ email: 'p009@pureun.kr', seed: signSeed(rec, { sentDays: [19, 18] }) });
  await signCell(w);
  let h = w.els.cwSend.innerHTML;
  assert.ok(h.includes('보낸 메일을 찾았습니다 — 2026-09-18') && h.includes('(2건 중 가장 이른 것)'), h);
  assert.ok(h.includes("onclick=\"grMarkSent('2026-09-18')\"") && !h.includes('보냈음 기록(오늘)'));
  showRec(w, rec);
  await w.ctx.grMarkSent('2026-09-18');
  onlyTrackWrites(w.db);
  assert.equal(w.db.쓴것.length, 1);
  const v = w.db.쓴것[0];
  assert.equal(v.자리, 'scal_docs/c2/t3_2026/items/sign');
  assert.deepEqual([v.값.st, v.값.sentAt, v.값.by], ['doing', '2026-09-18', '홍길동']);
  assert.ok(v.값.at > 0);
  assert.equal(v.값.gotAt, '2026-09-30', 'gotAt 보존'); assert.equal(v.값.note, '메모 그대로', 'note 보존');
  assert.deepEqual(v.값.link, SIGN_LINK, '기존 link 보존');
  assert.ok(w.els.cellw.innerHTML.includes('저장했습니다'));
  assert.ok(!w.els.cwSend.innerHTML.includes('보낸 메일을 찾았습니다'), '기록한 뒤에는 단추가 사라진다');

  /* 못 찾으면 — 오늘(GR.today) */
  w = world({ email: 'p009@pureun.kr', seed: signSeed(null) });
  await signCell(w);
  h = w.els.cwSend.innerHTML;
  assert.ok(h.includes("onclick=\"grMarkSent('')\">보냈음 기록(오늘)") && !h.includes('보낸 메일을 찾았습니다'));
  assert.equal(w.ctx.GR.today, '2026-10-10');
  await w.ctx.grMarkSent('');
  assert.equal(w.db.쓴것.length, 1);
  assert.deepEqual([w.db.쓴것[0].값.st, w.db.쓴것[0].값.sentAt], ['doing', '2026-10-10']);
  assert.equal(w.db.쓴것[0].값.gotAt, undefined);
  onlyTrackWrites(w.db);

  /* 이미 같은 날로 기록돼 있으면 단추 없음 · 저장 중에는 또 쓰지 않는다 */
  w = world({ seed: signSeed({ st: 'doing', sentAt: '2026-09-18' }, { sentDays: [18] }) });
  await signCell(w);
  assert.ok(!w.els.cwSend.innerHTML.includes('보낸 메일을 찾았습니다'));
  w.ctx.GR.cw.busy = true;
  await w.ctx.grMarkSent('2026-09-19');
  assert.equal(w.db.쓴것.length, 0);
});

test('60 회신 후보 — 저장된 발송일 이후 «받은» 메일에만 「회신 도착?」·「서명본으로 연결」 · 보낸 날 이전·보낸 메일·개인 자료에는 없다 · 서명 칸에서만', async () => {
  let w = world({ seed: signSeed({ st: 'doing', sentAt: '2026-09-27' }) });
  await signCell(w);
  let h = w.els.cwInbox.innerHTML;
  assert.equal(h.split(S.MSG.REPLY).length - 1, 1, '9/27 이후 받은 메일은 현장 사진(9/29) 하나');
  assert.ok(liOf(h, '현장 사진').includes(S.MSG.REPLY) && /onclick="grLinkReply\(0,0\)"[^>]*>서명본으로 연결/.test(h));
  assert.equal(w.ctx.GR.cw.cands[0].s, '현장 사진', '회신이 맨 앞');
  ['보고서 초안', '서명본 보내드립니다', '자료 보냅니다'].forEach((s) => {
    const li = liOf(h, s);
    assert.ok(li && !li.includes(S.MSG.REPLY) && !li.includes('grLinkReply'), s);
  });
  assert.ok(liOf(h, '현장 사진').includes('grLinkCand(0,0)'), '「연결」은 그대로');

  /* 발송일이 더 이르면 개인 자료도 회신 «후보» 딱지는 받지만 연결 단추는 없다 */
  w = world({ seed: signSeed({ st: 'doing', sentAt: '2026-09-20' }) });
  await signCell(w);
  h = w.els.cwInbox.innerHTML;
  const priv = liOf(h, '9월 급여대장.xlsx');
  assert.ok(priv && !priv.includes('grLinkReply') && !priv.includes('grLinkCand') && !priv.includes('grOpenCand'), '개인 자료는 연결을 막는다');
  assert.ok(liOf(h, '서명본 보내드립니다').includes('grLinkReply'), '서명본 메일(힌트)은 앞');
  assert.equal(w.ctx.GR.cw.cands[0].s, '서명본 보내드립니다', '서명·날인 낱말이 든 회신이 맨 앞');
  assert.ok(!liOf(h, '보고서 초안').includes('grLinkReply') && !liOf(h, '보고서 초안').includes(S.MSG.REPLY), '보낸 메일은 회신이 아니다');
  assert.equal(w.db.쓴것.length, 0);

  /* 발송일이 아직 없으면 순서도 딱지도 없다 · 제출 칸에도 없다 */
  w = world({ seed: signSeed(null) });
  await signCell(w);
  assert.ok(!w.els.cwInbox.innerHTML.includes(S.MSG.REPLY) && !w.els.cwInbox.innerHTML.includes('grLinkReply'));
  w = world({ seed: signSeed({ st: 'doing', sentAt: '2026-09-20' }) });
  await cellOf(w, 'consulting-04', 'c2', 't3', 'submit');
  assert.ok(!w.els.cwInbox.innerHTML.includes(S.MSG.REPLY) && !w.els.cwInbox.innerHTML.includes('grLinkReply'));
});

test('61 grLinkReply — 한 번의 .set 으로 {done · 발송일 유지 · 회신일 = 그 메일 날짜 · link} · 회신일이 발송일보다 앞서면 쓰지 않고 안내 · 막힌 후보는 무시', async () => {
  const rec = { st: 'doing', sentAt: '2026-09-20', note: '메모 그대로' };
  let w = world({ email: 'p009@pureun.kr', seed: signSeed(Object.assign({ link: SIGN_LINK }, rec)) });
  await signCell(w);
  showRec(w, rec);
  const c = w.ctx.GR.cw;
  assert.equal(c.cands[0].key, 'i:INBOX-0a1b2c3d:101');
  await w.ctx.grLinkReply(0, 0);
  onlyTrackWrites(w.db);
  assert.equal(w.db.쓴것.length, 1, '한 번의 저장');
  const v = w.db.쓴것[0].값;
  assert.equal(w.db.쓴것[0].자리, 'scal_docs/c2/t3_2026/items/sign');
  assert.deepEqual([v.st, v.sentAt, v.gotAt, v.note, v.by], ['done', '2026-09-20', '2026-09-25', '메모 그대로', '홍길동']);
  assert.deepEqual(v.link, { src: 'mail', key: 'i:INBOX-0a1b2c3d:101', name: '서명본.hwpx', date: '2026-09-25' }, '새 서명본이 link 를 갈아 낀다');
  assert.ok(w.els.cellw.innerHTML.includes('연결했습니다'));
  assert.ok(!w.els.cwSend.innerHTML.includes('서명 요청 메일 쓰기'), '완료가 되면 서명 요청 단추가 사라진다');

  /* 개인 자료·보낸 메일·없는 첨부는 무시 */
  w = world({ seed: signSeed(rec) }); await signCell(w); showRec(w, rec);
  const L = w.ctx.GR.cw.cands;
  await w.ctx.grLinkReply(L.findIndex((m) => m.priv), 0);
  await w.ctx.grLinkReply(L.findIndex((m) => m.out), 0);
  await w.ctx.grLinkReply(0, 9);
  await w.ctx.grLinkReply(99, 0);
  assert.equal(w.db.쓴것.length, 0);

  /* 칸 창에 적힌 발송일이 메일 날짜보다 늦으면(강제) — 쓰지 않고 안내, 적던 값은 남는다 */
  w = world({ seed: signSeed(rec) }); await signCell(w); showRec(w, rec);
  w.els.cwSent.value = '2026-10-05';
  await w.ctx.grLinkReply(0, 0);
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(w.els.cellw.innerHTML.includes('회신일이 발송일보다 앞섭니다'));
  assert.equal(w.ctx.GR.cw.draft.sentAt, '2026-10-05');

  /* 서명 칸이 아니면 무시 */
  w = world({ seed: signSeed(rec) }); await cellOf(w, 'consulting-04', 'c2', 't3', 'submit');
  await w.ctx.grLinkReply(0, 0);
  assert.equal(w.db.쓴것.length, 0);
});

test('62 쓰기 거절(규칙 게시 전·권한 없음) — 「보냈음 기록」·「서명본으로 연결」 모두 「저장하지 못했습니다 — 규칙 게시 또는 권한 확인」, 표는 그대로', async () => {
  const rec = { st: 'doing', sentAt: '2026-09-20', note: '메모 그대로' };
  const w = world({ seed: signSeed(rec), db: (db) => ({ ref: (p) => (p.indexOf('scal_docs/') === 0
    ? { set: async () => { throw new Error('PERMISSION_DENIED'); } } : db.ref(p)) }) });
  await signCell(w); showRec(w, rec);
  const before = w.ctx.GR.track;
  await w.ctx.grMarkSent('2026-09-18');
  assert.ok(w.els.cellw.innerHTML.includes('저장하지 못했습니다 — 규칙 게시 또는 권한 확인'));
  assert.strictEqual(w.ctx.GR.track, before, '표는 그대로');
  assert.equal(w.ctx.GR.track.c2.t3_2026.sign.sentAt, '2026-09-20');
  assert.equal(w.ctx.GR.cw.busy, false, '잠금은 풀린다');
  assert.equal(w.ctx.GR.cw.draft.sentAt, '2026-09-18', '적던 값은 창에 남는다');
  await w.ctx.grLinkReply(0, 0);
  assert.ok(w.els.cellw.innerHTML.includes('저장하지 못했습니다 — 규칙 게시 또는 권한 확인'));
  assert.strictEqual(w.ctx.GR.track, before);
  assert.equal(w.db.쓴것.length, 0);
});

/* ══ 기관 제출 칸(⑤) — 제출 메일 쓰기 · 제출 보냄 기록 · 플랫폼 체크 글 ══ */

/* 합성 씨앗 — 다라정밀 제출 줄(submit) 을 마음대로, 보낸편지함에 메일을 더한다(공용 씨앗은 건드리지 않는다)
   rows: [{ u, at: Date.UTC(...), s: 제목, t: 받는이(쉼표) }] */
function submitSeed(rec, o) {
  o = o || {};
  const s = signSeed(undefined, o);
  if (rec) s.scal_docs.c2.t3_2026.items.submit = Object.assign({ by: '홍길동', at: Date.UTC(2026, 8, 20, 3) }, rec);
  (o.rows || []).forEach((r) => {
    s.mailbox.msgs[SENT_SLUG][r.u] = { u: r.u, f: '푸른노무법인', e: 'office@pureun.kr', t: r.t, tn: '', s: r.s, d: r.at, a: 1, an: ['제출본.pdf'] };
  });
  return s;
}
const submitCell = (w) => cellOf(w, 'consulting-04', 'c2', 't3', 'submit');
const submitPlanOf = (w) => D.planFor(w.ctx.GR.cw.biz).items.filter((i) => i.step === 'submit')[0];
/* 쓰기 창 가짜 — 받는이가 비면 진짜처럼 거절(false) */
function mailWin(ret, calls) {
  const win = { puMailComposeTo(o) { calls.push(o); return o.to ? ret : false; }, focus() {}, location: { href: '' } };
  return win;
}
const AGENCY_ROWS = [
  { u: 210, at: Date.UTC(2026, 7, 1, 1), s: '충남북부 인사노무 중간보고 제출', t: 'old@example.org' },
  { u: 211, at: Date.UTC(2026, 8, 29, 1), s: '충남북부 인사노무 결과보고서 제출', t: 'agency@example.org,agency2@example.org,dara@example.com,office@pureun.kr' },
  { u: 212, at: Date.UTC(2026, 9, 2, 1), s: '다른 사업 안내', t: 'other@example.org' }
];

test('63 grRenderSend — 제출 칸: 메일 사업은 「제출 메일 쓰기」 · 플랫폼은 순서 글(<ol>)만 · 방식 모르면 안내 한 줄 · 아무것도 쓰지 않는다', async () => {
  /* 충남북부(mail) */
  let w = world({ seed: submitSeed(null) });
  await w.ctx.grLoad(); w.ctx.grSetBiz('consulting-04'); w.ctx.grOpenCell('c2', 't3', 'submit');
  assert.match(w.els.cwSend.innerHTML, /<button type="button" onclick="grWriteSubmit\(\)" disabled>✉ 제출 메일 쓰기/, '메일함을 읽는 동안은 잠긴다');
  await w.ctx.grLoadInbox();
  let h = w.els.cwSend.innerHTML;
  assert.match(h, /<button type="button" onclick="grWriteSubmit\(\)">✉ 제출 메일 쓰기<\/button>/);
  assert.ok(!h.includes('서명 요청 메일 쓰기') && !h.includes('<ol'));
  assert.ok(h.includes("onclick=\"grMarkSent('')\">제출 보냄 기록(오늘)"), '보낸 메일을 못 찾으면 오늘로 기록');
  assert.ok(h.includes(S.MSG.ATTACH) && h.includes(S.MSG.DL_NOTE));
  assert.equal(w.db.쓴것.length, 0, '그리기는 읽기만');
  /* 완료면 단추 없음 */
  w = world({ seed: submitSeed({ st: 'done', gotAt: '2026-09-30', how: 'mail' }) });
  await submitCell(w);
  h = w.els.cwSend.innerHTML;
  assert.ok(!h.includes('제출 메일 쓰기') && !h.includes('제출 보냄 기록') && !h.includes('보낸 메일을 찾았습니다'), '완료면 단추 숨김');
  assert.ok(h.includes(S.MSG.ATTACH), '안내 글은 그대로');

  /* 기술보호(platform) — 순서 글 li 수 = steps 수, 메일 단추 없음, 저장 없음 */
  w = world({ seed: submitSeed(null) });
  await cellOf(w, 'consulting-03', 'c1', 't1', 'submit');
  const plan = submitPlanOf(w);
  assert.equal(plan.how, 'platform');
  h = w.els.cwSend.innerHTML;
  assert.equal(h.split('<li>').length - 1, plan.steps.length, 'li 개수');
  assert.ok(h.includes('<ol class="days">') && h.includes('로그인과 «제출» 단추는 사람이 합니다 — 접수 화면을 캡처해 두고 «접수 확인»에 표시하세요'));
  assert.ok(!h.includes('제출 메일 쓰기') && !h.includes('grWriteSubmit') && !h.includes('grMarkSent') && !h.includes('<button'), '메일 단추 없음');
  assert.equal(w.db.쓴것.length, 0, '체크는 저장하지 않는다');
  assert.equal(await w.ctx.grWriteSubmit(), false, '플랫폼 사업은 메일 길이 없다');

  /* 제출 방식을 모르는 사업(현장클리닉 꼴) — 안내 한 줄만 */
  w = world({ seed: submitSeed(null) });
  await w.ctx.grLoad(); w.ctx.grSetBiz('consulting-04');
  const noHow = (n) => { const p = D.planFor(n); return Object.assign({}, p, { items: p.items.map((i) => (i.step === 'submit' ? { id: i.id, name: i.name, per: i.per, step: i.step } : i)) }); };
  w.ctx.PuGovReportDocs = Object.assign({}, D, { planFor: noHow });
  w.ctx.grOpenCell('c2', 't3', 'submit'); await w.ctx.grLoadInbox();
  h = w.els.cwSend.innerHTML;
  assert.ok(h.includes('<div class="days">제출 방식 확인 필요 — 운영지침 도착 뒤 정합니다</div>'));
  assert.ok(!h.includes('<button') && !h.includes('<ol') && !h.includes('grWriteSubmit'));
  assert.equal(await w.ctx.grWriteSubmit(), false);
  assert.equal(D.planFor('현장클리닉').items.filter((i) => i.step === 'submit')[0].how, undefined, '진짜 현장클리닉 줄도 방식이 없다');
  assert.equal(w.db.쓴것.length, 0);
});

test('64 제출 보낸 메일 찾기 — 꼬리표는 [제출:rid] · 서명 요청 메일은 안 섞인다 · 단추는 날짜 모양이 맞을 때만(서명 칸도)', async () => {
  assert.equal(S.tagOf('submit', 't3_2026'), '[제출:t3_2026]');
  const sent = { u: 220, at: Date.UTC(2026, 8, 30, 1), s: '[제출:t3_2026] 인사노무 충남북부 결과보고서 제출 (다라정밀)', t: 'agency@example.org' };
  const sent2 = { u: 221, at: Date.UTC(2026, 9, 2, 1), s: '[제출:t3_2026] 재제출', t: 'agency@example.org' };
  let w = world({ email: 'p009@pureun.kr', seed: submitSeed(null, { rows: [sent2, sent] }) });
  await submitCell(w);
  assert.equal(w.ctx.grSendCtx().tag, '[제출:t3_2026]', '제출 칸의 꼬리표');
  let h = w.els.cwSend.innerHTML;
  assert.ok(h.includes('보낸 메일을 찾았습니다 — 2026-09-30') && h.includes('(2건 중 가장 이른 것)') && h.includes('제출일로 기록'), h);
  assert.ok(h.includes("onclick=\"grMarkSent('2026-09-30')\"") && !h.includes('제출 보냄 기록(오늘)'));
  /* 같은 날로 이미 기록돼 있으면 단추 없음 */
  w = world({ seed: submitSeed({ st: 'doing', gotAt: '2026-09-30' }, { rows: [sent] }) });
  await submitCell(w);
  assert.ok(!w.els.cwSend.innerHTML.includes('보낸 메일을 찾았습니다') && !w.els.cwSend.innerHTML.includes('제출 보냄 기록(오늘)'));
  /* 서명 요청 꼬리표 메일은 제출 칸에서 «찾았습니다» 가 되지 않는다 */
  w = world({ seed: submitSeed(null, { sentDays: [18] }) });
  await submitCell(w);
  assert.ok(!w.els.cwSend.innerHTML.includes('보낸 메일을 찾았습니다') && w.els.cwSend.innerHTML.includes('제출 보냄 기록(오늘)'));

  /* 날짜 모양이 어긋난 줄 — 단추를 만들지 않는다(제출 칸·서명 칸 모두) */
  const odd = (tag) => ({ out: true, day: "2026-09-30');alert(1);('", slug: SENT_SLUG, uid: 999, d: 1, s: tag + ' 이상한 날짜', to: ['agency@example.org'], atts: [] });
  w = world({ seed: submitSeed(null) });
  await submitCell(w);
  w.ctx.GR.inbox.rows = w.ctx.GR.inbox.rows.concat([odd('[제출:t3_2026]')]);
  w.ctx.grRenderSend();
  h = w.els.cwSend.innerHTML;
  assert.ok(!h.includes('alert(1)') && !h.includes('제출일로 기록') && !h.includes('제출 보냄 기록(오늘)') && !h.includes('grMarkSent'), '제출 칸: ' + h);
  w = world({ seed: signSeed(null) });
  await signCell(w);
  w.ctx.GR.inbox.rows = w.ctx.GR.inbox.rows.concat([odd('[서명요청:t3_2026]')]);
  w.ctx.grRenderSend();
  h = w.els.cwSend.innerHTML;
  assert.ok(!h.includes('alert(1)') && !h.includes('보낸 날로 기록') && !h.includes('보냈음 기록(오늘)') && !h.includes('grMarkSent'), '서명 칸: ' + h);
  assert.equal(w.db.쓴것.length, 0);
});

test('65 grMarkSent(제출 칸) — 한 줄 .set {done · 제출일 · how:mail} · 기존 ack·note·link 보존 · 서명 칸 값은 건드리지 않는다', async () => {
  const rec = { st: 'doing', how: '', ack: true, note: '접수 메일 기다림', link: SIGN_LINK };
  const w = world({ email: 'p009@pureun.kr', seed: submitSeed(rec) });
  await submitCell(w);
  showRec(w, rec); w.els.cwAck.checked = true; w.els.cwHow.value = '';
  await w.ctx.grMarkSent('2026-09-30');
  onlyTrackWrites(w.db);
  assert.equal(w.db.쓴것.length, 1);
  const v = w.db.쓴것[0];
  assert.equal(v.자리, 'scal_docs/c2/t3_2026/items/submit');
  assert.deepEqual([v.값.st, v.값.gotAt, v.값.how, v.값.by], ['done', '2026-09-30', 'mail', '홍길동']);
  assert.equal(v.값.ack, true, 'ack 보존'); assert.equal(v.값.note, '접수 메일 기다림', 'note 보존');
  assert.deepEqual(v.값.link, SIGN_LINK, 'link 보존');
  assert.ok(w.els.cellw.innerHTML.includes('저장했습니다'));
  assert.ok(!w.els.cwSend.innerHTML.includes('제출 메일 쓰기'), '완료가 되면 메일 단추가 사라진다');
  /* 오늘 날짜(빈 값) */
  const w2 = world({ email: 'p009@pureun.kr', seed: submitSeed(null) });
  await submitCell(w2);
  await w2.ctx.grMarkSent('');
  assert.deepEqual([w2.db.쓴것[0].값.st, w2.db.쓴것[0].값.gotAt, w2.db.쓴것[0].값.how], ['done', '2026-10-10', 'mail']);
  onlyTrackWrites(w2.db);
});

test('66 grWriteSubmit — 지난 제출 메일에서 받는이를 따라 쓰기 창에 한 번 · 안내는 열린 뒤에도 남는다 · 못 찾으면 빈 창 + 제목·본문 복사', async () => {
  const calls = [];
  /* 찾음 — 가장 최근 «사업 낱말» 보낸 메일 · 우리·업체 주소는 뺀다 */
  let w = world({ seed: submitSeed(null, { rows: AGENCY_ROWS }) });
  await submitCell(w);
  w.ctx.open = (u, n) => { assert.equal(n, 'puMailWrite'); return mailWin(true, calls); };
  assert.equal(await w.ctx.grWriteSubmit(), true);
  assert.equal(calls.length, 1, '한 번만 부른다');
  const o = calls[0];
  assert.deepEqual(Object.keys(o).sort(), ['body', 'card', 'cc', 'subject', 'to']);
  assert.equal(o.to, 'agency@example.org'); assert.equal(o.cc, 'agency2@example.org');
  assert.ok(o.subject.startsWith('[제출:t3_2026] ') && o.subject.includes('다라정밀'), o.subject);
  assert.ok(o.body.includes('제출합니다') && !o.body.includes('@'));
  const msg = w.els.cwSendMsg;
  assert.ok(msg.textContent.includes('지난 제출 메일(2026-09-29)에서 받는 사람을 따라 왔습니다 — 확인하세요'), 'grOpenMail 이 덮은 뒤 다시 쓴다: ' + msg.textContent);
  assert.ok(msg.textContent.includes('쓰기 창을 열었습니다') && msg.className === 'days');
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(/제출합니다/.test(w.ctx.copied), '복사는 창을 열기 전에 해 둔다');

  /* 쓰기 창이 값 채우기를 거절 — 받는이·참조·제목만 주소로, 본문은 클립보드 · 안내는 그대로 */
  calls.length = 0;
  w = world({ seed: submitSeed(null, { rows: AGENCY_ROWS }) }); await submitCell(w);
  let fake = mailWin(false, calls); w.ctx.open = () => fake;
  assert.equal(await w.ctx.grWriteSubmit(), true);
  const d = S.draft('submit', { rid: 't3_2026', co: '다라정밀', biz: w.ctx.GR.cw.biz, reportName: w.ctx.GR.cw.keys[0].name });
  assert.equal(fake.location.href, S.composeUrl('pu-cards.html', { to: 'agency@example.org', cc: 'agency2@example.org', subject: d.subject }));
  assert.equal(w.ctx.copied, d.body);
  assert.ok(w.els.cwSendMsg.textContent.includes('지난 제출 메일(2026-09-29)') && w.els.cwSendMsg.textContent.includes(S.MSG.BODY_COPIED));

  /* 못 찾음(우리·업체 주소뿐이거나 보낸 메일 없음) — 빈 쓰기 창 + 제목·본문 복사 */
  for (const rows of [[], [{ u: 230, at: Date.UTC(2026, 8, 29, 1), s: '충남북부 제출', t: 'dara@example.com,office@pureun.kr' }]]) {
    calls.length = 0;
    w = world({ seed: submitSeed(null, { rows }) }); await submitCell(w);
    fake = mailWin(true, calls); w.ctx.open = () => fake;
    assert.equal(await w.ctx.grWriteSubmit(), true);
    assert.equal(calls.length, 1); assert.equal(calls[0].to, '', '받는이 없이');
    assert.equal(fake.location.href, 'pu-cards.html?view=mail', '빈 쓰기 창');
    const dd = S.draft('submit', { rid: 't3_2026', co: '다라정밀', biz: w.ctx.GR.cw.biz, reportName: w.ctx.GR.cw.keys[0].name });
    assert.equal(w.ctx.copied, dd.subject + '\n\n' + dd.body, '제목\\n\\n본문');
    const m = w.els.cwSendMsg;
    assert.ok(m.textContent.includes(S.MSG.NO_SUBMIT_TO) && m.textContent.includes(S.MSG.COPIED_ALL), m.textContent);
    assert.equal(m.className, 'err-s');
    assert.equal(w.db.쓴것.length, 0);
  }

  /* 팝업이 막혔다 — 안내를 덮어쓰지 않고 막힘을 알린다 */
  w = world({ seed: submitSeed(null, { rows: AGENCY_ROWS }) }); await submitCell(w);
  w.ctx.open = () => null;
  assert.equal(await w.ctx.grWriteSubmit(), false);
  assert.ok(w.els.cwSendMsg.textContent.includes('쓰기 창이 막혔습니다') && w.els.cwSendMsg.className === 'err-s');
  /* 서명 칸에서는 아무 일도 하지 않는다 */
  w = world({ seed: submitSeed(null, { rows: AGENCY_ROWS }) }); await signCell(w);
  w.ctx.open = () => { throw new Error('열면 안 된다'); };
  assert.equal(await w.ctx.grWriteSubmit(), false);
});

test('67 플랫폼 체크 글 — 값은 글자로만(이스케이프) · 상수 배열을 바꾸지 않는다', async () => {
  const evil = Object.freeze(['<script>alert(1)</script>', 'x" onerror="alert(2)', '<img src=x onerror=alert(3)>']);
  const w = world({ seed: submitSeed(null) });
  await w.ctx.grLoad(); w.ctx.grSetBiz('consulting-04');
  w.ctx.PuGovReportDocs = Object.assign({}, D, { planFor: (n) => { const p = D.planFor(n); return Object.assign({}, p, { items: p.items.map((i) => (i.step === 'submit' ? { id: i.id, name: i.name, per: i.per, step: i.step, how: 'platform', steps: evil } : i)) }); } });
  w.ctx.grOpenCell('c2', 't3', 'submit'); await w.ctx.grLoadInbox();
  const h = w.els.cwSend.innerHTML;
  assert.equal(h.split('<li>').length - 1, 3);
  assert.ok(!/<script|<img/i.test(h), '태그가 그대로 들어갔다');
  assert.ok(h.includes('&#60;script&#62;alert(1)&#60;/script&#62;') && h.includes('x&#34; onerror=&#34;alert(2)'), h);
  assert.equal(evil.length, 3, '상수 배열은 그대로(읽기만)');
  assert.doesNotMatch(grab('grRenderSend'), /\.(push|pop|shift|unshift|splice|sort|reverse)\(/, 'steps 를 바꾸는 호출이 없다');
});

test('68 정적 — 제출 메일도 쓰기 길은 grSaveCell 한 곳 · 자동 발송 호출 없음', () => {
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], ['.set(']);
  ['grWriteSubmit', 'grRenderSend', 'grMarkSent'].forEach((n) => assert.doesNotMatch(grab(n), /fbDb|\.set\(|\.update\(|fetch\(|mailto:|\.send\s*\(|sendMail|httpsCallable/, n));
  assert.match(grab('grWriteSubmit'), /grOpenMail\(S\.composeParts\(d,to,cc\)\)/);
  assert.match(grab('grWriteSubmit'), /\.then\(function\(r\)/, '안내는 grOpenMail 이 끝난 뒤 다시 쓴다');
});

/* ══ 대형 사업 단계 열 표·칸 창·체크 글·막힌 단계 알림 — 설계 docs/superpowers/specs/2026-10-11-gov-report-big-stages-design.md §4 ══
   합성 씨앗(bigSeed)은 이 검사 안에서만 쓴다 — 공용 씨앗은 건드리지 않는다.
   다라정밀(c2)에 대형 둘을 더 건다: 일터상생혁신컨설팅(consulting-02 → t2, 회차 2) · 산업일자리전환컨설팅충남(consulting-06 → t5, 회차 2, 계약 2026-08~10).
   이음: 이알피 사업 코드 → scal_erpTypeMap → 일정 사업(t2·t5), 업체 → scal_cos(c2 types), 이알피 계약(k3, 다라정밀 이름) */
const BIG_LINK = { src: 'mail', key: 'i:INBOX-0a1b2c3d:107', name: '현장.jpg', date: '2026-09-29' };
function bigSeed(o) {
  o = o || {};
  const s = F.seed();
  s.scal_types.push({ id: 't5', name: '산업일자리충남', fullName: '산업일자리전환 컨설팅(충남)', agency: '', rounds: 2 });
  const c2 = s.scal_cos.filter((c) => c.id === 'c2')[0];
  c2.types.push('t2', 't5');
  c2.customRounds = { t2: 2, t5: 2 };
  s.scal_scheds.push(
    { id: 'b1', coId: 'c2', typeId: 't2', date: '2026-08-20', round: 1, isField: true },
    { id: 'b2', coId: 'c2', typeId: 't2', date: '2026-09-17', round: 2, isField: true },
    { id: 'b3', coId: 'c2', typeId: 't5', date: '2026-08-25', round: 1, isField: true },
    { id: 'b4', coId: 'c2', typeId: 't5', date: '2026-09-22', round: 2, isField: true });
  s.scal_erpTypeMap['consulting-06'] = 't5';
  s.data.consultings.v.k3 = { id: 'k3', companyName: '다라정밀', typeCodes: { consulting: 'consulting-06' },
    startDate: o.start || '2026-08-01', endDate: o.end || '2026-10-31', status: 'active', managerMain: 'P-009' };
  /* 기록: { t2: { plan: {...} }, t5: { log: {...} } } — 줄 하나씩 */
  Object.keys(o.track || {}).forEach((tid) => {
    s.scal_docs.c2[tid + '_2026'] = { items: {} };
    Object.keys(o.track[tid]).forEach((k) => {
      s.scal_docs.c2[tid + '_2026'].items[k] = Object.assign({ by: '홍길동', at: Date.UTC(2026, 8, 20, 3) }, o.track[tid][k]);
    });
  });
  return s;
}
/* 대형 사업(t2·t5)은 현황판 줄이 없다 — 막힌 단계 알림은 줄이 아니라 기록에서 만든다(검사 76·78·79 가 이 전제를 직접 확인한다) */
const hasRow = (w, co, ty) => w.ctx.GR.rows.some((r) => r.coId === co && r.typeId === ty);
const planItem = (biz, id) => D.planFor(biz).items.filter((i) => i.id === id)[0];
const WP = '일터상생혁신컨설팅';
const countOf = (h, re) => (h.match(re) || []).length;

test('69 정적 — 단계 칸의 data-item 이 칸 창 네 번째 인자로 간다 · 쓰기는 여전히 .set 한 곳 · 새 쓰기 길이 없다', () => {
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], ['.set(']);
  assert.doesNotMatch(INLINE, /ref\([^)]*\)\.push\(/);
  assert.match(SRC, /grOpenCell\(c\.getAttribute\('data-co'\),c\.getAttribute\('data-ty'\),c\.getAttribute\('data-step'\),c\.getAttribute\('data-item'\)\|\|''\)/);
  assert.match(grab('grOpenCell'), /^function grOpenCell\(coId,typeId,step,itemId\)/);
  assert.match(grab('grOpenCell'), /itemId\?T\.keysForItem\(plan,itemId,n,D\.monthsFor\(cons,p\)\):T\.keysFor\(plan,step,n\)/);
  assert.match(grab('grOpenCell'), /item:itemId\|\|''/);
  assert.match(grab('grRenderDocs'), /data-item="'\+grEsc\(c\.id\)/);
  ['grRenderDocs', 'grOpenCell', 'grRenderCell', 'grRenderSend', 'grRenderAlerts'].forEach((n) =>
    assert.doesNotMatch(grab(n), /fbDb|\.set\(|\.update\(|fetch\(|mailto:|\.send\s*\(/, n + ' 이 직접 쓰거나 부른다'));
  assert.match(SRC, /\.dc-wide\{overflow-x:auto\}/);
});

test('70 대형 사업 체크표 — 단계 열 머리·「다음 단계」·기한·목차 · 칩 단추는 data-item · 간단형은 그대로 5열(data-item 없음)', async () => {
  const w = world({ seed: bigSeed() });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-02');
  let h = w.els.docs.innerHTML;
  assert.equal(w.els.docs.style.display, '');
  assert.ok(h.includes('<div class="dc-wide"><table>'));
  ['<th>업체</th>', '<th>참여 안내서(서명)</th>', '<th>수행계획서</th>', '<th>회차별 수행보고서+사진2장+서명지</th>', '<th>이행결과표</th>', '<th>다음 단계</th>', '<th>기한</th>',
    '가나상사', '다라정밀', '대형', 'data-toc="1" data-co="c2" data-ty="t2"'].forEach((s) => assert.ok(h.includes(s), s));
  assert.ok(!h.includes('①초안') && !h.includes('서류 목차 보기'), '대형은 간단형 열이 아니다');
  assert.equal(countOf(h, /data-item="/g), 16, '두 줄 × 단계 8칸 모두 칩 단추');
  assert.ok(h.includes('data-cell="1" data-co="c2" data-ty="t2" data-step="sign" data-item="guide"'));
  assert.ok(h.includes('data-cell="1" data-co="c2" data-ty="t2" data-step="plat" data-item="plan"'));
  assert.ok(h.includes('data-cell="1" data-co="c2" data-ty="t2" data-step="report" data-item="kickoff"'));
  assert.ok(h.includes('<span class="st st-wait">○ 없음 0/2</span>'), '회차 서류는 0/2 (회차 둘)');
  const line = h.split('<tr>').filter((x) => x.includes('다라정밀'))[0];
  assert.ok(line.includes('<td>참여 안내서(서명)</td>'), '기록이 없으면 다음 단계는 첫 단계');
  assert.equal(w.db.쓴것.length, 0);
  /* 간단형 — 지금과 같은 5열 */
  w.ctx.grSetBiz('consulting-04');
  h = w.els.docs.innerHTML;
  ['①초안', '②확정', '③서명본', '④별첨', '⑤제출', '기한'].forEach((s) => assert.ok(h.includes(s), s));
  assert.ok(!h.includes('data-item') && !h.includes('dc-wide') && !h.includes('다음 단계'));
  assert.ok(h.includes('data-cell="1" data-co="c2" data-ty="t3" data-step="sign"'));
});

test('71 대형 표 — 충남: 수행일지·월별 열 · 다 끝나면 「모두 끝」 · 달이 없으면(계약 기간이 거꾸로) 그 칸만 「—」이고 눌러도 안 열린다', async () => {
  let w = world({ seed: bigSeed() });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-06');
  let h = w.els.docs.innerHTML;
  ['<th>수행일지</th>', '<th>월별 수행실적보고서</th>', '<th>결과보고서</th>', '<th>사후관리 결과보고서</th>', '2026-10-31'].forEach((s) => assert.ok(h.includes(s), s));
  assert.ok(h.includes('data-step="report" data-item="monthly"') && h.includes('○ 없음 0/3'), '계약 2026-08~10 → 달 셋');
  assert.ok(h.includes('<td>수행일지</td>'));
  w = world({ seed: bigSeed({ track: { t5: { log: { st: 'done' }, 'monthly:1': { st: 'done' }, 'monthly:2': { st: 'done' }, 'monthly:3': { st: 'na' }, result: { st: 'done' }, after: { st: 'na' } } } }) });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-06');
  h = w.els.docs.innerHTML;
  assert.ok(h.includes('<td>모두 끝</td>'), h);
  /* 달이 없는 월별 — 칩이 없다 */
  w = world({ seed: bigSeed({ start: '2026-12-01', end: '2026-08-31' }) });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-06');
  h = w.els.docs.innerHTML;
  assert.equal(countOf(h, /<td>—<\/td>/g), 1, '월별 한 칸만 「—」');
  assert.ok(!h.includes('data-item="monthly"') && h.includes('data-item="log"') && h.includes('data-item="result"'));
  w.ctx.grOpenCell('c2', 't5', 'report', 'monthly');
  assert.equal(w.ctx.GR.cw, null, '키가 없으면 열리지 않는다');
  assert.equal(w.db.쓴것.length, 0);
});

test('72 기록을 못 읽으면(GR.trackErr) 대형 단계 칸은 단추 없이 「?」 · 다음 단계도 「?」 · 안내 · 칸 창은 안 열린다', async () => {
  const denied = { once: async () => { throw new Error('permission_denied'); } };
  const w = world({ seed: bigSeed(), db: (db) => ({ ref: (p) => (p === 'scal_docs' ? denied : db.ref(p)) }) });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-02');
  const h = w.els.docs.innerHTML;
  assert.equal(w.ctx.GR.trackErr, true);
  assert.ok(h.includes('기록을 못 불러왔습니다 — 규칙 게시 또는 권한 확인'));
  assert.ok(!h.includes('data-cell') && !h.includes('data-item'), '누를 수 없다');
  assert.equal(countOf(h, /<td>\?<\/td>/g), 2 * (8 + 1), '두 줄 × (단계 8칸 + 다음 단계)');
  assert.ok(h.includes('data-toc="1"'), '목차 단추는 남는다');
  w.ctx.grOpenCell('c2', 't2', 'plat', 'plan');
  assert.equal(w.ctx.GR.cw, null);
  assert.equal(w.db.쓴것.length, 0);
});

test('73 칸 창 — 플랫폼 단계(plan): 키 [plan]·item · 「완료일」 한 칸(발송일·제출 방식 없음) · 입력 순서 <li> = steps 수 · 사람이 하는 일 안내 · 열기만으로는 안 쓴다', async () => {
  const w = world({ seed: bigSeed() });
  await cellOf(w, 'consulting-02', 'c2', 't2', 'plat', 'plan');
  const cw = w.ctx.GR.cw;
  assert.ok(cw, '열렸다');
  assert.deepEqual(cw.keys.map((k) => k.key), ['plan']);
  assert.equal(cw.keys[0].id, 'plan');
  assert.equal(cw.item, 'plan');
  assert.equal(cw.step, 'plat');
  const c = w.els.cellw.innerHTML;
  assert.ok(c.includes('플랫폼 입력 · 수행계획서 — 다라정밀'), '제목에 단계 이름·항목 이름');
  assert.ok(c.includes('id="cwGot"') && c.includes('<span>완료일</span>'));
  assert.ok(!c.includes('id="cwSent"') && !c.includes('발송일') && !c.includes('id="cwHow"') && !c.includes('제출 방식') && !c.includes('id="cwAck"'));
  assert.ok(!c.includes('cwHwp'), '한글 파일 열기는 서명 칸만');
  assert.ok(c.includes('<div id="cwSend"></div>'));
  ['value="none"', 'value="doing"', 'value="done"', 'value="blocked"', 'value="na"'].forEach((s) => assert.ok(c.includes(s), s));
  const steps = planItem(w.ctx.GR.cw.biz, 'plan').steps;
  assert.ok(steps.length >= 4);
  const h = w.els.cwSend.innerHTML;
  assert.equal(countOf(h, /<li>/g), steps.length);
  assert.ok(h.includes('<div class="days">입력 순서</div><ol class="days">'));
  steps.forEach((t) => assert.ok(h.includes(t.replace(/&/g, '&#38;').replace(/</g, '&#60;').replace(/>/g, '&#62;').replace(/"/g, '&#34;').replace(/'/g, '&#39;')), t));
  assert.ok(h.includes('로그인과 최종 제출은 사람이 합니다 — 접수 화면을 캡처해 두세요'));
  assert.ok(!h.includes('<button') && !h.includes('grWriteMail'), '메일 단추 없음');
  assert.ok(h.includes('📝 단계 안내'));
  assert.equal(w.db.쓴것.length, 0);
});

test('74 회차 서류(round) — 키 round:1..n(회차 수) · 서류 고르기 <select> · 안내 글 · 고르면 그 줄 키로', async () => {
  const w = world({ seed: bigSeed() });
  await cellOf(w, 'consulting-02', 'c2', 't2', 'plat', 'round');
  assert.deepEqual(w.ctx.GR.cw.keys.map((k) => k.key), ['round:1', 'round:2'], '합성 회차 둘');
  assert.equal(w.ctx.GR.cw.key, 'round:1');
  const c = w.els.cellw.innerHTML;
  assert.ok(c.includes('<select id="cwKey" onchange="grPickCell(this.value)">'));
  assert.ok(c.includes('회차별 수행보고서+사진2장+서명지 1회차') && c.includes('회차별 수행보고서+사진2장+서명지 2회차'));
  const h = w.els.cwSend.innerHTML;
  assert.ok(h.includes('안내: ') && h.includes('회의 2시간 이상'));
  assert.equal(countOf(h, /<li>/g), planItem(w.ctx.GR.cw.biz, 'round').steps.length);
  w.ctx.grPickCell('round:2');
  assert.equal(w.ctx.GR.cw.key, 'round:2');
  assert.ok(w.els.cwSend.innerHTML.includes('입력 순서'), '고르면 다시 그린다 — 같은 항목 안내');
  /* 다른 항목의 키로는 못 바꾼다 */
  w.ctx.grPickCell('plan');
  assert.equal(w.ctx.GR.cw.key, 'round:2');
});

test('75 월별(monthly) — 키 monthly:1..m · 이름에 YYYY-MM · 보고서 단계는 완료일 한 칸 · 안내 글만(입력 순서 없음)', async () => {
  const w = world({ seed: bigSeed() });
  await cellOf(w, 'consulting-06', 'c2', 't5', 'report', 'monthly');
  const cw = w.ctx.GR.cw;
  assert.deepEqual(cw.keys.map((k) => k.key), ['monthly:1', 'monthly:2', 'monthly:3']);
  assert.deepEqual(cw.keys.map((k) => k.name), ['2026-08 월별 수행실적보고서', '2026-09 월별 수행실적보고서', '2026-10 월별 수행실적보고서']);
  const c = w.els.cellw.innerHTML;
  assert.ok(c.includes('보고서 · 2026-08 월별 수행실적보고서 — 다라정밀'));
  assert.ok(c.includes('2026-09 월별 수행실적보고서') && c.includes('id="cwGot"') && !c.includes('id="cwSent"'));
  const h = w.els.cwSend.innerHTML;
  assert.ok(h.includes('안내: 달마다 한 부'));
  assert.ok(!h.includes('입력 순서') && !h.includes('<ol'));
  assert.ok(h.includes('📝 단계 안내'));
  /* 안내가 없는 보고서 항목 — 안내 칸이 비어 있다(헛 머리글을 그리지 않는다) */
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't5', 'report', 'after');
  assert.deepEqual(w.ctx.GR.cw.keys.map((k) => k.key), ['after']);
  assert.equal(w.els.cwSend.innerHTML, '');
});

test('76 저장 — 대형 단계 칸: scal_docs/<co>/<rid>/items/plan 한 줄만 · {st:done, gotAt, note, by, at} · 옛 link 를 지킨다 · 표·다음 단계가 바뀐다', async () => {
  const w = world({ email: 'p009@pureun.kr', seed: bigSeed({ track: { t2: { plan: { st: 'doing', link: BIG_LINK } } } }) });
  await cellOf(w, 'consulting-02', 'c2', 't2', 'plat', 'plan');
  assert.ok(w.ctx.GR.cw.keys.length === 1);
  w.els.cwSt.value = 'done'; w.els.cwGot.value = '2026-10-09'; w.els.cwNote.value = ' 플랫폼 입력 마침 ';
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  assert.deepEqual(w.db.쓴것.map((x) => x.자리), ['scal_docs/c2/t2_2026/items/plan'], '한 줄만');
  const v = w.db.쓴것[0].값;
  assert.deepEqual(Object.keys(v).sort(), ['at', 'by', 'gotAt', 'link', 'note', 'st'], '규칙 밖 필드 없음');
  assert.deepEqual([v.st, v.gotAt, v.note, v.by, typeof v.at, v.link], ['done', '2026-10-09', '플랫폼 입력 마침', '홍길동', 'number', BIG_LINK]);
  assert.ok(w.els.cellw.innerHTML.includes('저장했습니다'));
  const row = w.els.docs.innerHTML.split('<tr>').filter((x) => x.includes('다라정밀'))[0];
  assert.ok(row.includes('<span class="st st-done">● 등록함</span>'), row);
  assert.ok(row.includes('<td>참여 안내서(서명)</td>'), '다음 단계는 아직 첫 단계');
  /* 회차 칸 — 고른 줄 키 하나만 */
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't2', 'plat', 'round');
  w.ctx.grPickCell('round:2');
  w.els.cwSt.value = 'blocked'; w.els.cwGot.value = ''; w.els.cwNote.value = '서명지 못 받음';
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  assert.deepEqual(w.db.쓴것.map((x) => x.자리), ['scal_docs/c2/t2_2026/items/plan', 'scal_docs/c2/t2_2026/items/round:2']);
  assert.deepEqual(w.db.쓴것[1].값, { st: 'blocked', note: '서명지 못 받음', by: '홍길동', at: w.db.쓴것[1].값.at });
  assert.ok(!hasRow(w, 'c2', 't2'), '전제: 일터 사업은 현황판 줄이 없다');
  const al = w.els.alerts.innerHTML;
  assert.match(al, /막힌 단계 <b>1<\/b>/, '줄이 없어도 방금 저장한 막힘이 알림에 나온다');
  assert.ok(al.includes('다라정밀 · 일터혁신 컨설팅') && al.includes('회차별 수행보고서+사진2장+서명지 2회차 (서명지 못 받음)'), al);
  /* 잘못 적으면 쓰지 않는다 — 대형 단계에도 같은 점검 */
  const n = w.db.쓴것.length;
  w.els.cwSt.value = 'doing'; w.els.cwGot.value = '10/09';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, n);
  assert.ok(w.els.cellw.innerHTML.includes('날짜는 YYYY-MM-DD 꼴로 적어 주세요'));
});

test('77 서명 단계(guide) — 설계 1 의 「서명 요청 메일 쓰기」가 나오고 grWriteMail 이 [서명요청:rid] 꼬리표로 쓰기 창을 연다 · 안내 글', async () => {
  const calls = [];
  const w = world({ seed: bigSeed() });
  await cellOf(w, 'consulting-02', 'c2', 't2', 'sign', 'guide');
  assert.deepEqual(w.ctx.GR.cw.keys.map((k) => k.key), ['guide']);
  let h = w.els.cwSend.innerHTML;
  assert.ok(w.els.cellw.innerHTML.includes('<div id="cwSend"></div>'));
  assert.ok(w.els.cellw.innerHTML.includes('③ 업체 서명본 · 참여 안내서(서명) — 다라정밀'));
  assert.match(h, /<button type="button" onclick="grWriteMail\(\)">✉ 서명 요청 메일 쓰기<\/button>/);
  assert.ok(h.includes('✉ 서명 요청') && h.includes('안내: 담당자 서명 후 플랫폼에 업로드'));
  assert.ok(w.els.cellw.innerHTML.includes('id="cwSent"') && w.els.cellw.innerHTML.includes('id="cwGot"'), '서명 칸은 발송일·회신일 둘');
  w.ctx.open = () => ({ puMailComposeTo(o) { calls.push(o); return true; }, focus() {}, location: { href: '' } });
  assert.equal(await w.ctx.grWriteMail(), true);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].subject.startsWith('[서명요청:t2_2026] ') && calls[0].subject.includes('다라정밀'), calls[0].subject);
  assert.equal(calls[0].to, 'dara@example.com');
  assert.equal(w.db.쓴것.length, 0, '메일을 열기만 한다');
  /* 보냈음 기록 — 같은 한 줄 .set, 키는 guide */
  w.ctx.GR.cw.draft = null;
  showRec(w, { st: 'none' });
  await w.ctx.grMarkSent('');
  onlyTrackWrites(w.db);
  assert.deepEqual(w.db.쓴것.map((x) => x.자리), ['scal_docs/c2/t2_2026/items/guide']);
  assert.equal(w.db.쓴것[0].값.st, 'doing');
});

test('78 대형 칸의 바깥 값은 이스케이프 — 체크 글·안내 글(DOC_PLANS 사본)·메모·알림', async () => {
  const bad = '<script>alert(1)</script>"\'';
  const esc = '&#60;script&#62;alert(1)&#60;/script&#62;&#34;&#39;';
  const evil = Object.freeze([bad, 'x" onerror="alert(2)', '<img src=x onerror=alert(3)>']);
  const w = world({ seed: bigSeed({ track: { t2: { plan: { st: 'blocked', note: bad } } } }) });
  await w.ctx.grLoad();
  assert.ok(!hasRow(w, 'c2', 't2'), '전제: 줄 없이 기록만으로 알림');
  w.ctx.grSetBiz('consulting-02');
  const hostile = (n) => { const p = D.planFor(n); return Object.assign({}, p, { items: p.items.map((i) => (i.id === 'plan' || i.id === 'round' || i.id === 'guide' || i.id === 'kickoff'
    ? Object.assign({}, i, { steps: i.step === 'plat' ? evil : i.steps, note: bad }) : i)) }); };
  w.ctx.PuGovReportDocs = Object.assign({}, D, { planFor: hostile });
  w.ctx.grOpenCell('c2', 't2', 'plat', 'plan');
  await w.ctx.grLoadInbox();
  let h = w.els.cwSend.innerHTML;
  assert.equal(countOf(h, /<li>/g), 3);
  assert.ok(!/<script|<img/i.test(h), '태그가 그대로 들어갔다: ' + h);
  assert.ok(h.includes('<li>' + esc + '</li>') && h.includes('x&#34; onerror=&#34;alert(2)'), h);
  assert.ok(h.includes('안내: ' + esc), h);
  assert.equal(evil.length, 3, '상수 배열은 그대로(읽기만)');
  assert.ok(w.els.cellw.innerHTML.includes('<textarea id="cwNote" maxlength="200" rows="3">' + esc + '</textarea>'), '메모 칸도 글자로');
  assert.ok(!/<script/i.test(w.els.cellw.innerHTML));
  /* 서명·보고서 단계의 안내 글 */
  w.ctx.grCloseCell(); w.ctx.grOpenCell('c2', 't2', 'sign', 'guide'); await w.ctx.grLoadInbox();
  assert.ok(w.els.cwSend.innerHTML.includes('안내: ' + esc) && !/<script/i.test(w.els.cwSend.innerHTML));
  w.ctx.grCloseCell(); w.ctx.grOpenCell('c2', 't2', 'report', 'kickoff');
  assert.ok(w.els.cwSend.innerHTML.includes('안내: ' + esc) && !/<script/i.test(w.els.cwSend.innerHTML));
  /* 알림의 메모 */
  w.ctx.grRender();
  const a = w.els.alerts.innerHTML;
  assert.match(a, /막힌 단계 <b>1<\/b>/);
  assert.ok(a.includes('수행계획서 (' + esc + ')'), a);
  assert.ok(!/<script/i.test(a));
  assert.equal(w.db.쓴것.length, 0);
});

test('79 알림 「막힌 단계」 — 막힘 기록이 있는 대형 줄이 있으면 N · 업체·사업·단계 이름·메모 · 없으면 0 · 막힘이 풀리면 사라진다', async () => {
  const w = world({ email: 'p009@pureun.kr', seed: bigSeed({ track: { t2: { plan: { st: 'blocked', note: '인증서 만료' }, 'round:2': { st: 'blocked' }, kickoff: { st: 'doing' } } } }) });
  await w.ctx.grLoad();
  assert.ok(!hasRow(w, 'c2', 't2') && !hasRow(w, 'c2', 't5'), '전제: 대형 사업은 현황판 줄이 없다 — 저장본을 심지 않았다');
  let a = w.els.alerts.innerHTML;
  assert.match(a, /막힌 단계 <b>1<\/b>/);
  const li = liOf(a.slice(a.indexOf('막힌 단계')), '다라정밀');
  assert.ok(li.includes('다라정밀 · 일터혁신 컨설팅'), li);
  assert.ok(li.includes('수행계획서 (인증서 만료)') && li.includes('회차별 수행보고서+사진2장+서명지 2회차'), li);
  assert.ok(li.includes(' · '), '여럿이면 가운뎃점으로');
  assert.ok(li.includes('href="gov-consulting.html#rpt=c2|t2"'));
  assert.ok(a.indexOf('제출 기한 지남') < a.indexOf('막힌 단계'), '제출 기한 지남 뒤에');
  /* 칸 창에서 풀면 알림이 줄어든다(다시 읽지 않고) */
  w.ctx.grSetBiz('consulting-02');
  w.ctx.grOpenCell('c2', 't2', 'plat', 'plan');
  w.els.cwSt.value = 'done'; w.els.cwGot.value = '2026-10-10'; w.els.cwNote.value = '';
  await w.ctx.grSaveCell();
  w.ctx.grOpenCell('c2', 't2', 'plat', 'round');
  w.ctx.grPickCell('round:2');
  w.els.cwSt.value = 'doing'; w.els.cwGot.value = ''; w.els.cwNote.value = '';
  await w.ctx.grSaveCell();
  assert.match(w.els.alerts.innerHTML, /막힌 단계 <b>0<\/b>/);
  /* 막힘 기록이 없다 */
  const n = world({ seed: bigSeed({ track: { t2: { plan: { st: 'doing' } } } }) });
  await n.ctx.grLoad();
  assert.match(n.els.alerts.innerHTML, /막힌 단계 <b>0<\/b>/);
  const base = world();
  await base.ctx.grLoad();
  assert.match(base.els.alerts.innerHTML, /막힌 단계 <b>0<\/b>/, '간단형만 있는 공용 씨앗도 0');
  /* 기록을 못 읽으면 0 이 아니라 「?」 — 목록은 없다(못 읽음 문구가 함께 나온다) */
  const denied = { once: async () => { throw new Error('permission_denied'); } };
  const r = world({ seed: bigSeed({ track: { t2: { plan: { st: 'blocked', note: '못 읽으면 안 보임' } } } }), db: (db) => ({ ref: (p) => (p === 'scal_docs' ? denied : db.ref(p)) }) });
  await r.ctx.grLoad();
  assert.equal(r.ctx.GR.trackErr, true);
  const ra = r.els.alerts.innerHTML;
  assert.ok(ra.includes('기록을 못 불러왔습니다'));
  assert.match(ra, /막힌 단계 <b>\?<\/b><\/div><ul><\/ul>/, '개수 「?」 · 목록 없음');
  assert.ok(!ra.includes('못 읽으면 안 보임'));
  /* 사업 목록을 아직 못 읽었으면(GR.docs 안 불러옴) 비어 있다 — 던지지 않는다 */
  r.ctx.GR.docs = { loaded: false, err: false };
  r.ctx.GR.trackErr = false;
  r.ctx.grRenderAlerts();
  assert.match(r.els.alerts.innerHTML, /막힌 단계 <b>0<\/b>/);
});

test('80 회귀 — 첨부(attach) 칸 창에는 #cwSend 가 없다 · 간단형 ⑤ 제출·③ 서명 칸 동작은 그대로(기존 57·63 검사) · 간단형 칸 창에는 항목 이름이 안 붙는다', async () => {
  const w = world({ seed: bigSeed() });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-03');
  w.ctx.grOpenCell('c1', 't1', 'attach');
  assert.ok(!w.els.cellw.innerHTML.includes('id="cwSend"'));
  assert.equal(w.ctx.GR.cw.item, '', '간단형은 item 이 빈 글자');
  assert.ok(w.els.cellw.innerHTML.includes('④ 산출물 별첨 — 가나상사'));
  assert.ok(!w.els.cellw.innerHTML.includes('완료일'));
  w.ctx.grCloseCell();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  assert.ok(w.els.cellw.innerHTML.includes('③ 업체 서명본 — 다라정밀') && w.els.cellw.innerHTML.includes('발송일') && w.els.cellw.innerHTML.includes('id="cwHwp"'));
  assert.ok(w.els.cwSend.innerHTML.includes('✉ 서명 요청') && !w.els.cwSend.innerHTML.includes('📝'));
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't3', 'submit');
  assert.ok(w.els.cwSend.innerHTML.includes('✉ 제출 메일') && w.els.cellw.innerHTML.includes('제출 방식'));
  assert.equal(w.db.쓴것.length, 0);
});

/* ══ 회차 기록·기준 점검(칸 창 «회차 기록» · «기준») — 설계 2026-10-12-gov-report-rounds-design.md §5~§7 ══
   합성 일터혁신(t2 · consulting-02 · 다라정밀)·산업일자리(t5 · consulting-06) 씨앗은 위 bigSeed 를 쓴다(회차 수만 더 키운다).
   칸 창의 입력은 진짜 DOM 에서는 그려진 값이다 — liveDom 이 그려진 글(cellw.innerHTML)에서 값을 읽어 입력칸에 채운다(그려지지 않은 칸은 비운다).
   그래서 «그리는 쪽 id» 와 «읽는 쪽 id» 가 어긋나면 이 검사가 깨진다(침묵 우회 없음). */

function rdSeed(o) {
  o = o || {};
  const s = bigSeed({ track: o.track });
  const c2 = s.scal_cos.filter((c) => c.id === 'c2')[0];
  if (o.n) c2.customRounds.t2 = o.n;
  if (o.m || o.ind) {   // 산업일자리(plan industry) = 이알피 consulting-07(능률) — 충남(consulting-06)은 다른 틀(industry-cn)이다
    const m = o.m || 2;
    s.scal_types.push({ id: 't6', name: '산업일자리능률', fullName: '산업일자리전환 컨설팅(능률)', agency: '', rounds: m });
    c2.types.push('t6');
    c2.customRounds.t6 = m;
    s.scal_scheds.push({ id: 'b5', coId: 'c2', typeId: 't6', date: '2026-08-27', round: 1, isField: true },
      { id: 'b6', coId: 'c2', typeId: 't6', date: '2026-09-24', round: 2, isField: true });
    s.scal_erpTypeMap['consulting-07'] = 't6';
    s.data.consultings.v.k4 = { id: 'k4', companyName: '다라정밀', typeCodes: { consulting: 'consulting-07' },
      startDate: '2026-08-01', endDate: '2026-10-31', status: 'active', managerMain: 'P-009' };
    if (o.ind) {
      s.scal_docs.c2.t6_2026 = { items: {} };
      Object.keys(o.ind).forEach((k) => { s.scal_docs.c2.t6_2026.items[k] = Object.assign({ by: '홍길동', at: Date.UTC(2026, 8, 20, 3) }, o.ind[k]); });
    }
  }
  return s;
}
const RD_IDS = ['cwRdMode', 'cwRdMins', 'cwRdPeople', 'cwRdPhoto', 'cwRdSign', 'cwRdMd', 'cwRdKind'];
const unEsc = (t) => t.replace(/&#60;/g, '<').replace(/&#62;/g, '>').replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&#38;/g, '&');
function domFill(w, h) {
  const g = (id) => w.ctx.$(id);
  RD_IDS.forEach((id) => { g(id).value = ''; g(id).checked = false; });
  for (const m of h.matchAll(/<input type="(?:number|date)" id="(\w+)"[^>]*?value="([^"]*)"/g)) g(m[1]).value = unEsc(m[2]);
  for (const m of h.matchAll(/<input type="checkbox" id="(\w+)"( checked)?/g)) g(m[1]).checked = !!m[2];
  for (const m of h.matchAll(/<select id="(\w+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const sel = m[2].match(/<option value="([^"]*)" selected>/) || m[2].match(/<option value="([^"]*)"/);
    g(m[1]).value = sel ? unEsc(sel[1]) : '';
  }
  for (const m of h.matchAll(/<textarea id="(\w+)"[^>]*>([\s\S]*?)<\/textarea>/g)) g(m[1]).value = unEsc(m[2]);
}
function liveDom(w) {
  const el = w.ctx.$('cellw');
  let html = '';
  Object.defineProperty(el, 'innerHTML', { get: () => html, set: (v) => { html = v; domFill(w, v); }, configurable: true });
  return w;
}
const rdWorld = (o) => liveDom(world(o));
const roundCell = (w) => cellOf(w, 'consulting-02', 'c2', 't2', 'plat', 'round');
const mdCell = (w) => cellOf(w, 'consulting-07', 'c2', 't6', 'report', 'mdlog');
const WPR = { mode: 'face', mins: 130, people: 4, photo: true, sign: true };
const rdOf = (n, rd) => ({ ['round:' + n]: { st: 'done', rd } });
/* 사람이 입력칸을 고친 것 — 값은 글(DOM 값)·체크는 boolean, 그리고 oninput 이 부르는 grRenderCrit */
function typeRd(w, o) {
  const g = (id) => w.ctx.$(id), map = { mode: 'cwRdMode', mins: 'cwRdMins', people: 'cwRdPeople', md: 'cwRdMd', kind: 'cwRdKind' };
  Object.keys(o).forEach((k) => { if (map[k]) g(map[k]).value = String(o[k]); });
  if ('photo' in o) g('cwRdPhoto').checked = !!o.photo;
  if ('sign' in o) g('cwRdSign').checked = !!o.sign;
  w.ctx.grRenderCrit();
}
const critHtml = (w) => w.ctx.$('cwCrit').innerHTML;
const hasId = (h, id) => h.includes('id="' + id + '"');

test('81 정적 — 기준 모듈은 send 바로 뒤 · 쓰기는 여전히 .set 한 곳 · 새 함수는 직접 쓰거나 부르지 않는다 · 읽는 id 는 그리는 id 와 같다', () => {
  assert.match(SRC, /<script src="js\/pu-gov-report-send\.js\?v=\d+"><\/script>\r?\n<script src="js\/pu-gov-report-criteria\.js\?v=\d+"><\/script>/);
  assert.ok(SRC.indexOf('pu-gov-report-track.js') < SRC.indexOf('pu-gov-report-criteria.js'));
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], ['.set(']);
  assert.doesNotMatch(INLINE, /ref\([^)]*\)\.push\(/);
  ['grRdHtml', 'grReadRd', 'grRenderCrit'].forEach((n) => assert.doesNotMatch(grab(n), /fbDb|\.set\(|\.update\(|fetch\(|mailto:|\.send\s*\(/, n));
  assert.match(grab('grSaveCell'), /fbDb\.ref\(GR_TRACK_NODES\.docs\+'\/'\+c\.coId\+'\/'\+c\.rid\+'\/items\/'\+c\.key\)\.set\(rec\)/);
  assert.match(grab('grSaveCell'), /T\.nextRd\(/);
  /* grReadRd 가 읽는 id 는 모두 grRdHtml 이 그린다 */
  const read = [...new Set([...grab('grReadRd').matchAll(/'(cwRd\w+)'/g)].map((m) => m[1]))].sort();
  assert.deepEqual(read, RD_IDS.slice().sort());
  read.forEach((id) => assert.ok(grab('grRdHtml').includes('"' + id + '"') || grab('grRdHtml').includes("'" + id + "'"), id + ' 을 그리지 않는다'));
});

test('82 합성 씨앗이 실제로 이어진다 — 일터혁신 round·산업일자리 mdlog 칸 창이 열리고 rd·crit 가 담긴다(열리지 않으면 이 검사가 깨진다)', async () => {
  let w = rdWorld({ seed: rdSeed({ n: 3 }) });
  await roundCell(w);
  assert.ok(w.ctx.GR.cw, '일터혁신 round 칸 창이 열렸다');
  assert.deepEqual(w.ctx.GR.cw.keys.map((k) => k.key), ['round:1', 'round:2', 'round:3']);
  assert.equal(w.ctx.GR.cw.rd, true);
  assert.equal(w.ctx.GR.cw.crit, 'workplace');
  w = rdWorld({ seed: rdSeed({ m: 2 }) });
  await mdCell(w);
  assert.ok(w.ctx.GR.cw, '산업일자리 mdlog 칸 창이 열렸다');
  assert.deepEqual(w.ctx.GR.cw.keys.map((k) => k.key), ['mdlog:1', 'mdlog:2']);
  assert.equal(w.ctx.GR.cw.rd, true);
  assert.equal(w.ctx.GR.cw.crit, 'industry');
  assert.equal(w.db.쓴것.length, 0);
});

test('83 칸 창 — rd 항목(일터혁신 round·산업일자리 mdlog)에만 «회차 기록»·#cwCrit · 산업일자리는 MD·종류 더 · 다른 항목·간단형에는 없다', async () => {
  let w = rdWorld({ seed: rdSeed({ n: 2 }) });
  await roundCell(w);
  let h = w.els.cellw.innerHTML;
  ['cwRdMode', 'cwRdMins', 'cwRdPeople', 'cwRdPhoto', 'cwRdSign', 'cwCrit'].forEach((id) => assert.ok(hasId(h, id), id));
  assert.ok(!hasId(h, 'cwRdMd') && !hasId(h, 'cwRdKind'), '일터혁신에는 MD·종류가 없다');
  assert.ok(h.includes('회차 기록') && h.includes('<option value="face">대면</option>') && h.includes('<option value="remote">비대면</option>'));
  assert.ok(h.indexOf('id="cwRdMode"') < h.indexOf('id="cwNote"'), '«메모» 앞에');
  assert.ok(h.indexOf('id="cwRdMode"') < h.indexOf('id="cwCrit"'));
  assert.equal(countOf(h, /id="cwCrit"/g), 1);
  w.ctx.grCloseCell();
  w = rdWorld({ seed: rdSeed({ m: 2 }) });
  await mdCell(w);
  h = w.els.cellw.innerHTML;
  RD_IDS.concat(['cwCrit']).forEach((id) => assert.ok(hasId(h, id), id));
  /* 입력이 바뀌면 «기준» 구역이 바로 따라간다 — 산업일자리 한도는 종류(방문·보고서·자료조사)에 달렸다 */
  RD_IDS.forEach((id) => {
    const tag = (h.match(new RegExp('<(?:input|select)[^>]*id="' + id + '"[^>]*>')) || [''])[0];
    assert.ok(/on(?:input|change)="grRenderCrit\(\)"/.test(tag), id + ' 에 grRenderCrit 연결이 있다: ' + tag);
  });
  assert.ok(h.includes('<option value="visit">방문</option>') && h.includes('<option value="report">보고서</option>') && h.includes('<option value="research">자료조사</option>'));
  /* rd 가 아닌 항목 — 같은 사업의 plan·kickoff·guide · 산업일자리 plan/final · 간단형 */
  const none = (html) => RD_IDS.concat(['cwCrit']).forEach((id) => assert.ok(!hasId(html, id) && !html.includes('회차 기록'), id));
  w = rdWorld({ seed: rdSeed({ n: 2, m: 2 }) });
  await w.ctx.grLoad(); w.ctx.grSetBiz('consulting-02');
  [['plat', 'plan'], ['report', 'kickoff'], ['sign', 'guide'], ['plat', 'follow']].forEach(([st, it]) => {
    w.ctx.grOpenCell('c2', 't2', st, it);
    assert.ok(w.ctx.GR.cw, it + ' 이 열렸다');
    assert.equal(w.ctx.GR.cw.rd, false, it); assert.equal(w.ctx.GR.cw.crit, '', it);
    none(w.els.cellw.innerHTML);
    w.ctx.grCloseCell();
  });
  w.ctx.grSetBiz('consulting-07');
  ['kickoff', 'plan', 'final'].forEach((it) => {
    w.ctx.grOpenCell('c2', 't6', 'report', it);
    assert.ok(w.ctx.GR.cw, it); assert.equal(w.ctx.GR.cw.rd, false, it);
    none(w.els.cellw.innerHTML);
    w.ctx.grCloseCell();
  });
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  assert.ok(w.ctx.GR.cw && w.ctx.GR.cw.rd === false);
  none(w.els.cellw.innerHTML);
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't3', 'submit');
  none(w.els.cellw.innerHTML);
  assert.equal(w.db.쓴것.length, 0, '열기만으로는 안 쓴다');
});

test('84 저장 — 형태 대면·130분·4명·사진·서명지: round:1 한 줄에 rd 가 실린다 · 미리 넣어 둔 note·link 는 그대로', async () => {
  const w = rdWorld({ email: 'p009@pureun.kr', seed: rdSeed({ n: 2, track: { t2: { 'round:1': { st: 'doing', note: '기존 메모', link: BIG_LINK } } } }) });
  await roundCell(w);
  assert.equal(w.ctx.$('cwNote').value, '기존 메모', '그려진 값이 입력칸에 있다');
  w.ctx.$('cwSt').value = 'done';
  typeRd(w, { mode: 'face', mins: '130', people: '4', photo: true, sign: true });
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  assert.deepEqual(w.db.쓴것.map((x) => x.자리), ['scal_docs/c2/t2_2026/items/round:1'], '한 줄만');
  const v = w.db.쓴것[0].값;
  assert.deepEqual(v.rd, { mode: 'face', mins: 130, people: 4, photo: true, sign: true });
  assert.deepEqual(Object.keys(v).sort(), ['at', 'by', 'link', 'note', 'rd', 'st']);
  assert.deepEqual([v.st, v.note, v.link, v.by], ['done', '기존 메모', BIG_LINK, '홍길동']);
  assert.deepEqual(w.ctx.GR.track.c2['t2_2026']['round:1'].rd, v.rd, '로컬 표도 같은 값');
  assert.ok(w.els.cellw.innerHTML.includes('저장했습니다'));
  /* 저장 뒤 다시 그려도 값이 그대로 보인다 */
  assert.ok(w.els.cellw.innerHTML.includes('value="130"') && w.els.cellw.innerHTML.includes('value="4"'));
  assert.equal(w.ctx.$('cwRdMode').value, 'face');
  assert.equal(w.ctx.$('cwRdPhoto').checked, true);
  /* 경계값(600분·99명)은 된다 · 비대면 · 사진·서명지 빼기 */
  w.ctx.grPickCell('round:2');
  w.ctx.$('cwSt').value = 'doing';
  typeRd(w, { mode: 'remote', mins: '600', people: '99', photo: false, sign: false });
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  assert.deepEqual(w.db.쓴것[1].값.rd, { mode: 'remote', mins: 600, people: 99, photo: false, sign: false });
  assert.deepEqual(w.db.쓴것.map((x) => x.자리), ['scal_docs/c2/t2_2026/items/round:1', 'scal_docs/c2/t2_2026/items/round:2']);
});

test('85 산업일자리 — mdlog:1 에 MD(0.5 단위)·종류가 rd 로 실린다 · 숫자 칸이 비면 그 키가 없다 · 일터혁신에는 md·kind 키가 없다', async () => {
  const w = rdWorld({ email: 'p009@pureun.kr', seed: rdSeed({ m: 2 }) });
  await mdCell(w);
  w.ctx.$('cwSt').value = 'done';
  typeRd(w, { mode: 'remote', md: '1.5', kind: 'report' });
  await w.ctx.grSaveCell();
  onlyTrackWrites(w.db);
  assert.equal(w.db.쓴것[0].자리, 'scal_docs/c2/t6_2026/items/mdlog:1');
  assert.deepEqual(w.db.쓴것[0].값.rd, { mode: 'remote', photo: false, sign: false, md: 1.5, kind: 'report' }, '빈 시간·인원은 키가 없다(0 으로 두지 않는다)');
  /* 일터혁신 — md·kind 칸이 없으니 입력칸에 값이 남아 있어도 읽지 않는다 */
  const x = rdWorld({ email: 'p009@pureun.kr', seed: rdSeed({ n: 2 }) });
  await roundCell(x);
  x.ctx.$('cwRdMd').value = '3'; x.ctx.$('cwRdKind').value = 'report';
  typeRd(x, { mode: 'face', mins: '120' });
  await x.ctx.grSaveCell();
  assert.deepEqual(x.db.쓴것[0].값.rd, { mode: 'face', mins: 120, photo: false, sign: false });
});

test('86 입력이 비어 있어도 기존 rd 는 지워지지 않는다(옛 rd 이어받기) · rd 가 아닌 항목 저장은 rd 키를 만들지 않는다(옛 rd 가 있을 때만 이어받음)', async () => {
  const OLD = { mode: 'face', mins: 150, people: 5, photo: true, sign: false };
  const w = rdWorld({ email: 'p009@pureun.kr', seed: rdSeed({ n: 2, track: { t2: { 'round:1': { st: 'doing', rd: OLD, note: '메모' }, plan: { st: 'doing' }, follow: { st: 'doing', rd: { mode: 'remote' } } } } }) });
  await roundCell(w);
  assert.equal(w.ctx.$('cwRdMode').value, 'face', '저장된 rd 가 그려진다');
  /* 사람이 형태·숫자·체크를 모두 비웠다 */
  w.ctx.$('cwRdMode').value = ''; w.ctx.$('cwRdMins').value = ''; w.ctx.$('cwRdPeople').value = '';
  w.ctx.$('cwRdPhoto').checked = false; w.ctx.$('cwRdSign').checked = false;
  w.ctx.$('cwSt').value = 'done';
  await w.ctx.grSaveCell();
  assert.deepEqual(w.db.쓴것.map((x) => x.자리), ['scal_docs/c2/t2_2026/items/round:1']);
  assert.deepEqual(w.db.쓴것[0].값.rd, OLD, '옛 rd 가 이어졌다');
  assert.equal(w.db.쓴것[0].값.st, 'done', '다른 칸은 고쳐졌다');
  /* rd 가 아닌 항목(plan) — 입력칸에 값이 남아 있어도 읽지 않고, rd 키도 만들지 않는다 */
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't2', 'plat', 'plan');
  assert.equal(w.ctx.GR.cw.rd, false);
  w.ctx.$('cwRdMode').value = 'remote'; w.ctx.$('cwRdMins').value = '999';
  w.ctx.$('cwSt').value = 'done'; w.ctx.$('cwGot').value = '2026-10-10';
  await w.ctx.grSaveCell();
  const p = w.db.쓴것[1];
  assert.equal(p.자리, 'scal_docs/c2/t2_2026/items/plan');
  assert.ok(!('rd' in p.값), 'rd 키가 없다: ' + JSON.stringify(p.값));
  assert.equal(p.값.st, 'done');
  /* 옛 rd 가 이미 있는 rd 아닌 줄(follow) — 이어받기만 한다(입력칸 값은 무시) */
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't2', 'plat', 'follow');
  w.ctx.$('cwRdMode').value = 'face'; w.ctx.$('cwRdMins').value = '500';
  w.ctx.$('cwSt').value = 'done';
  await w.ctx.grSaveCell();
  assert.deepEqual(w.db.쓴것[2].값.rd, { mode: 'remote' }, '옛 rd 이어받기');
  onlyTrackWrites(w.db);
  /* 간단형 저장도 rd 키가 없다 */
  w.ctx.grCloseCell();
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'attach');
  w.ctx.$('cwSt').value = 'done';
  await w.ctx.grSaveCell();
  assert.ok(!('rd' in w.db.쓴것[3].값));
});

test('87 범위 밖(시간 601·인원 100·MD 0.3·소수 시간)이면 쓰기 없이 «회차 기록 값이 올바르지 않습니다» · 적던 값은 창에 남는다 · 형태 없이 숫자만 적으면 형태를 고르라고 안내', async () => {
  const w = rdWorld({ email: 'p009@pureun.kr', seed: rdSeed({ n: 2, track: { t2: { 'round:1': { st: 'doing', rd: WPR } } } }) });
  await roundCell(w);
  const tryBad = async (o, show) => {
    w.ctx.$('cwSt').value = 'done';
    typeRd(w, o);
    await w.ctx.grSaveCell();
    assert.equal(w.db.쓴것.length, 0, JSON.stringify(o) + ' — 쓰지 않는다');
    const h = w.els.cellw.innerHTML;
    assert.ok(h.includes('<div class="err-s">' + Tr.RD_BAD + '</div>'), h.slice(-400));
    assert.ok(h.includes(show), '적던 값이 남는다: ' + show);
    assert.equal(w.ctx.GR.track.c2['t2_2026']['round:1'].rd.mins, 130, '로컬 표는 그대로');
  };
  await tryBad({ mode: 'face', mins: '601' }, 'value="601"');
  await tryBad({ mode: 'face', mins: '130', people: '100' }, 'value="100"');
  await tryBad({ mode: 'face', mins: '1.5', people: '4' }, 'value="1.5"');
  await tryBad({ mode: 'face', mins: '-1', people: '4' }, 'value="-1"');
  /* 형태 없이 숫자·체크만 */
  w.ctx.$('cwRdMode').value = ''; w.ctx.$('cwRdMins').value = '90'; w.ctx.$('cwRdPeople').value = ''; w.ctx.$('cwRdPhoto').checked = false; w.ctx.$('cwRdSign').checked = false;
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(w.els.cellw.innerHTML.includes('회차 기록의 형태(대면·비대면)를 먼저 골라 주세요') && w.els.cellw.innerHTML.includes('value="90"'));
  /* 산업일자리 MD 0.3 */
  const m = rdWorld({ email: 'p009@pureun.kr', seed: rdSeed({ m: 2 }) });
  await mdCell(m);
  m.ctx.$('cwSt').value = 'done';
  typeRd(m, { mode: 'face', md: '0.3', kind: 'visit' });
  await m.ctx.grSaveCell();
  assert.equal(m.db.쓴것.length, 0);
  assert.ok(m.els.cellw.innerHTML.includes(Tr.RD_BAD));
  /* 고쳐서 다시 저장하면 된다 */
  typeRd(m, { md: '0.5' });
  await m.ctx.grSaveCell();
  assert.deepEqual(m.db.쓴것.map((x) => x.값.rd.md), [0.5]);
});

test('88 «기준» 구역(일터혁신) — 3회차 중 2개 기록: 인정 2 · 대면 2/2 (100%, 기준 70% 이상) · 계획 3 · 기록 없는 회차·rd 없는 줄은 건너뛴다 · 미달 사유 · 입력이 바뀌면 #cwCrit 만 다시 그린다', async () => {
  const w = rdWorld({ seed: rdSeed({ n: 3, track: { t2: Object.assign({}, rdOf(1, WPR), rdOf(2, WPR), { plan: { st: 'done' } }) } }) });
  await roundCell(w);
  let h = critHtml(w);
  assert.ok(h.includes('기준 점검 — 알림일 뿐입니다'), h);
  assert.ok(h.includes('이 회차: 인정') && h.includes('기록 2회차 · 인정 2 · 계획 3회차'), h);
  assert.ok(h.includes('대면 2/2 (100%, 기준 70% 이상)'), h);
  assert.ok(!h.includes('err-s'), '모두 맞으면 빨간 줄 없음');
  /* 세 번째 회차(기록 없음) — 그 회차는 «아직 기록 없음», 합계는 그대로 */
  w.ctx.grPickCell('round:3');
  h = critHtml(w);
  assert.ok(h.includes('이 회차: 아직 기록 없음') && h.includes('기록 2회차 · 인정 2'), h);
  assert.equal(w.ctx.$('cwRdMode').value, '', '기록 없는 회차는 빈 입력');
  /* 입력 중 값으로 바꿔 센다 — 시간 90분이면 미달·사유 · 그 회차 입력으로 합계가 늘어난다(저장 전) */
  const before = w.els.cellw.innerHTML;
  typeRd(w, { mode: 'face', mins: '90', people: '4', photo: true, sign: true });
  h = critHtml(w);
  assert.ok(h.includes('<div class="err-s">이 회차: 미달 — 회의 2시간 미만(90분)</div>'), h);
  assert.ok(h.includes('기록 3회차 · 인정 2 · 계획 3회차') && h.includes('대면 3/3 (100%, 기준 70% 이상)'), h);
  assert.equal(w.els.cellw.innerHTML, before, '칸 창 전체는 다시 그리지 않는다');
  assert.equal(w.db.쓴것.length, 0, '점검은 쓰지 않는다');
  /* 사유가 여럿이면 모두 */
  typeRd(w, { mode: 'face', mins: '', people: '2', photo: false, sign: false });
  h = critHtml(w);
  ['회의 시간 없음', '참석 3명 미만(2명)', '시작·종료 사진 없음', '서명지 없음'].forEach((t) => assert.ok(h.includes(t), t));
  /* 미달이어도 저장은 막지 않는다 — 알림일 뿐 */
  w.ctx.$('cwSt').value = 'doing';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 1);
  assert.deepEqual(w.db.쓴것[0].값.rd, { mode: 'face', people: 2, photo: false, sign: false });
});

test('89 «기준» 구역 — 대면 70% 경계(7/10 인정 · 6/4 «대면 6/10 (60%…)» 빨간 줄) · 기록 0건은 «점검할 기록이 없습니다»', async () => {
  const mk = (face) => {
    const t = {};
    for (let i = 1; i <= 10; i++) Object.assign(t, rdOf(i, Object.assign({}, WPR, { mode: i <= face ? 'face' : 'remote' })));
    return t;
  };
  let w = rdWorld({ seed: rdSeed({ n: 10, track: { t2: mk(7) } }) });
  await roundCell(w);
  assert.equal(w.ctx.GR.cw.keys.length, 10, '전제: 회차 10개');
  let h = critHtml(w);
  assert.ok(h.includes('<div class="days">대면 7/10 (70%, 기준 70% 이상)</div>'), h);
  assert.ok(!h.includes('err-s'));
  w = rdWorld({ seed: rdSeed({ n: 10, track: { t2: mk(6) } }) });
  await roundCell(w);
  h = critHtml(w);
  assert.ok(h.includes('<div class="err-s">대면 6/10 (60%, 기준 70% 이상)</div>'), h);
  /* 기록 0건 — 줄이 있어도 rd 가 없으면 센 것이 아니다 */
  w = rdWorld({ seed: rdSeed({ n: 3, track: { t2: { plan: { st: 'done' }, 'round:1': { st: 'doing', note: 'rd 없음' } } } }) });
  await roundCell(w);
  h = critHtml(w);
  assert.ok(h.includes('점검할 기록이 없습니다'), h);
  assert.ok(!h.includes('NaN') && !h.includes('undefined') && !h.includes('err-s') && !h.includes('대면'), h);
  /* 입력 중이던 회차가 그 첫 기록이면 곧바로 센다 */
  typeRd(w, { mode: 'remote', mins: '130', people: '4', photo: true, sign: true });
  assert.ok(critHtml(w).includes('기록 1회차') && critHtml(w).includes('대면 0/1 (0%, 기준 70% 이상)'), critHtml(w));
  assert.ok(critHtml(w).includes('class="err-s">대면 0/1'));
});

test('90 «기준» 구역(산업일자리) — 비대면 보고서 MD 4.5 는 한도 초과(빨간 줄) · 4 는 아니다 · 자료조사 한도 2 · MD 합계', async () => {
  const mk = (a, b) => ({ 'mdlog:1': { st: 'done', rd: { mode: 'remote', md: a, kind: 'report' } }, 'mdlog:2': { st: 'done', rd: { mode: 'remote', md: b, kind: 'report' } } });
  let w = rdWorld({ seed: rdSeed({ m: 2, ind: mk(2.5, 2) }) });
  await mdCell(w);
  let h = critHtml(w);
  assert.ok(h.includes('기록 2회차 · MD 합계 4.5 · 계획 2회차'), h);
  assert.ok(h.includes('<div class="err-s">비대면 보고서 4.5 MD(한도 4)</div>'), h);
  assert.ok(h.includes('<div class="days">비대면 자료조사 0 MD(한도 2)</div>'), h);
  assert.ok(h.includes('이 회차: 인정'), h);
  w = rdWorld({ seed: rdSeed({ m: 2, ind: mk(2, 2) }) });
  await mdCell(w);
  h = critHtml(w);
  assert.ok(h.includes('<div class="days">비대면 보고서 4 MD(한도 4)</div>') && !h.includes('err-s'), h);
  /* 입력 중 값으로 — 이 회차를 자료조사 2.5MD 로 바꾸면 자료조사 초과 */
  typeRd(w, { mode: 'remote', md: '2.5', kind: 'research' });
  h = critHtml(w);
  assert.ok(h.includes('<div class="err-s">비대면 자료조사 2.5 MD(한도 2)</div>'), h);
  assert.ok(h.includes('<div class="days">비대면 보고서 2 MD(한도 4)</div>') && h.includes('MD 합계 4.5'), h);
  /* MD·종류가 없으면 미달(알림) */
  typeRd(w, { mode: 'face', md: '', kind: '' });
  assert.ok(critHtml(w).includes('<div class="err-s">이 회차: 미달 — MD 없음 · 종류 없음</div>'), critHtml(w));
  assert.equal(w.db.쓴것.length, 0);
});

test('91 «기준» 구역의 바깥 값은 이스케이프 — 사업장 이름·메모·서류 이름·안내 글·점검 사유에 <script>', async () => {
  const bad = '<script>alert(1)</script>"\'';
  const esc = '&#60;script&#62;alert(1)&#60;/script&#62;&#34;&#39;';
  const w = rdWorld({ email: 'p009@pureun.kr', seed: rdSeed({ n: 2, track: { t2: { 'round:1': { st: 'doing', note: bad, rd: WPR } } } }) });
  await w.ctx.grLoad(); w.ctx.grSetBiz('consulting-02');
  const hostile = (n) => { const p = D.planFor(n); return Object.assign({}, p, { items: p.items.map((i) => (i.id === 'round'
    ? Object.assign({}, i, { name: bad, note: bad, steps: [bad] }) : i)) }); };
  w.ctx.PuGovReportDocs = Object.assign({}, D, { planFor: hostile });
  const C = require('../js/pu-gov-report-criteria.js');
  w.ctx.PuGovReportCriteria = Object.assign({}, C, { roundCheck: () => ({ state: 'miss', miss: [bad, '<img src=x onerror=alert(3)>'] }) });
  w.ctx.grOpenCell('c2', 't2', 'plat', 'round');
  w.ctx.GR.cw.coName = bad;
  w.ctx.grRenderCell();
  const h = w.els.cellw.innerHTML;
  assert.ok(w.ctx.GR.cw.rd, '전제: 칸 창이 rd 항목으로 열렸다');
  assert.ok(hasId(h, 'cwRdMode') && hasId(h, 'cwCrit'));
  assert.ok(!/<script|<img/i.test(h), '태그가 그대로 들어갔다');
  assert.ok(h.includes('<textarea id="cwNote" maxlength="200" rows="3">' + esc + '</textarea>'), '메모 칸도 글자로');
  assert.ok(h.includes(esc + ' 1회차') || h.includes(esc), '서류 이름·사업장 이름은 글자로');
  const c = critHtml(w);
  assert.ok(c.includes('이 회차: 미달 — ' + esc + ' · &#60;img src=x onerror=alert(3)&#62;'), c);
  assert.ok(!/<script|<img/i.test(c), c);
  assert.equal(w.db.쓴것.length, 0);
});

test('92 기록을 못 읽으면(GR.trackErr) rd 칸 창도 열리지 않는다 — 기준 구역도 그려지지 않는다', async () => {
  const denied = { once: async () => { throw new Error('permission_denied'); } };
  const w = rdWorld({ seed: rdSeed({ n: 2 }), db: (db) => ({ ref: (p) => (p === 'scal_docs' ? denied : db.ref(p)) }) });
  await w.ctx.grLoad(); w.ctx.grSetBiz('consulting-02');
  assert.equal(w.ctx.GR.trackErr, true);
  w.ctx.grOpenCell('c2', 't2', 'plat', 'round');
  assert.equal(w.ctx.GR.cw, null);
  assert.ok(!hasId(w.els.cellw.innerHTML, 'cwRdMode') && !hasId(w.els.cellw.innerHTML, 'cwCrit'));
  w.ctx.grRenderCrit();   // 칸 창이 없으면 아무것도 안 한다(던지지 않는다)
  assert.equal(w.db.쓴것.length, 0);
});
