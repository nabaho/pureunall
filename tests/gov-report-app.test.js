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
const Nav = require('../js/pu-gov-report-nav.js');
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
  'grLoadInbox', 'grReadInbox', 'grRetryInbox', 'grRenderInbox', 'grLinkCand', 'grUnlink', 'grGlobalInbox', 'grRenderGlobalInbox', 'grOpenFromInbox', 'grGlobalCompute', 'grGlobalRefresh', 'grGiReset',
  'grClosedTypes', 'grLive', 'grRenderYearBar', 'grSetYear', 'grClosedText', 'grBizState', 'grBizBtn', 'grToggleBizGrp', 'grClosedBanner',
  'grLoadBizState', 'grOkBizCode', 'grCloseOpen', 'grCloseCm', 'grRenderCm', 'grCloseBiz', 'grReopenBiz',
  'grSendCtx', 'grSay', 'grRenderSend', 'grApplyFields', 'grMarkSent', 'grLinkReply', 'grCopy', 'grOpenMail', 'grWriteMail', 'grWriteSubmit',
  'grMailFetch', 'grMailCall', 'grRdHtml', 'grReadRd', 'grRenderCrit',
  'grOkChapKey', 'grChapAsk', 'grChapConsent', 'grChapCall', 'grChapErrMsg', 'grChapNames', 'grChapLinked', 'grChapInput', 'grChapSay', 'grRenderChap', 'grChapEdit',
  'grChapCopyText', 'grChapCopy', 'grChapCopyAll', 'grChapAi',
  'grOpenCand', 'grOpenLinked', 'grOpenAtt', 'grLib', 'grShowAtt', 'grRenderAv', 'grPdfDraw', 'grPdfPage', 'grCloseAv',
  'grDashHtml', 'grBoardHtml', 'grLoadDashView', 'grSetDashView', 'grBizBlocked', 'grBarHtml',
  'grLoadTab', 'grSetTab', 'grGoHome', 'grTodayCalc', 'grRenderToday', 'grTodayTask', 'grTodayStrip', 'grTodayInboxHtml', 'grRenderTodayInbox', 'grTodayMore', 'grOpenTask', 'grErpFor', 'grApplyTodayView',
  'grLoadBizOrder', 'grSaveBizOrder', 'grDragBiz', 'grDragMark', 'grDropAfter', 'grByBiz', 'grDragEnd', 'grHasDragType',
  'grPutCell', 'grAutoLog', 'grAutoCo', 'grAutoBiz', 'grAutoSkip', 'grAutoUnmatched', 'grAutoToggle', 'grAutoMore', 'grLoadAuto', 'grAutoList', 'grAutoMode', 'grAutoTime', 'grAutoRows', 'grAutoName', 'grAutoHtml', 'grRenderAuto', 'grSetAutoMode', 'grUndoAuto', 'grOpenAutoMail', 'grAutoBadge'];

function fakeEl() { return { innerHTML: '', textContent: '', value: '', checked: false, disabled: false, style: {} }; }
function world(o) {
  o = o || {};
  const db = FakeDb.만들기(o.seed || F.seed());
  const els = {};
  ['cwKey', 'cwSt', 'cwSent', 'cwGot', 'cwHow', 'cwAck', 'cwNote', 'cwHwpMsg'].forEach((id) => { els[id] = fakeEl(); }); // 칸 창 입력 — 진짜 DOM 에서는 innerHTML 이 만든다
  const urls = { made: [], revoked: [] };   // 보기 창이 만든·버린 blob 주소
  const ctx = { console: { warn() {} }, Promise, Object, Array, JSON, String, Number, Math, Date, RegExp, Error, isFinite,
    encodeURIComponent, PuGovReportList: L, PuGovReport: { FORMS: Rpt.FORMS }, PuGovReportDocs: D, PuGovReportNav: Nav, PuGovReportTrack: Tr, PuGovReportDash: require('../js/pu-gov-report-dash.js'), PuGovReportToday: require('../js/pu-gov-report-today.js'), PuGovReportAuto: require('../js/pu-gov-report-auto.js'),
    PuGovReportInbox: I, PuGovReportSend: require('../js/pu-gov-report-send.js'), PuGovReportCriteria: require('../js/pu-gov-report-criteria.js'), PuGovReportAi: require('../js/pu-gov-report-ai.js'), PuGovReportChapters: require('../js/pu-gov-report-chapters.js'), PuRulesMailOrig: MO, PuCoThread: CT, setTimeout, clearTimeout, AbortController,
    /* 받은 서류함 — 가짜 서버(mailServer)·로그인·blob 주소. 서버를 안 주면 부르는 순간 실패한다 */
    fetch: (o.mail && o.mail.fetch) || (async () => { throw new Error('이 검사는 서버를 부르면 안 된다'); }),
    firebase: { auth: () => ({ currentUser: o.noUser ? null : { getIdToken: async () => 'tok' } }) },
    PuAiCall: o.ai, localStorage: o.ls, confirm: o.confirm,   // 장별 AI 초안 검사용 가짜들(안 주면 없는 것으로)
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
    varLine('GR_MAIL'), varLine('GR_BIZ'), varLine('GR_AUTO'), varLine('GR_AUTO_SKIP'), varLine('GR_AI'), varLine('GR')].join('\n') + '\n' + NAMES.map(grab).join('\n')
    + "\ngrToday=function(){ return '2026-10-10'; };", ctx);
  if (o.email) vm.runInContext('GR.email=' + JSON.stringify(o.email) + ';', ctx);
  return { ctx, db, els, urls };
}

/* 쓰기는 서류 진행 기록 줄 하나뿐 — 자리 꼴 scal_docs/{업체}/{rid}/items/{키}, set 만 */
/* 이 화면의 쓰기 명령 목록(인라인 스크립트 속 차례) — 서류 줄 grSaveCell .set · 사업 종결 grCloseBiz .set · 되돌리기 grReopenBiz .set(closedFrom 9999 표시) (2026-10-12).
   .remove 는 어디에도 없다 — 저장 관문(pu-ontology-write.js)이 물리적 삭제를 막는다(조정관 판정: 지우지 않고 표시로) */
const WRITES = ['.set(', '.set(', '.set(', '.set(', '.set('];   // 넷째 = 사업 순서 grSaveBizOrder .set (2026-10-12, UI 4단계 — scal_bizOrder/main 한 문서) · 다섯째 = 메일 자동 처리 모드 grSetAutoMode .set (2026-10-22 — scal_autoRun/cfg 한 칸)
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
  assert.match(SRC, /<script src="js\/pu-gov-report-nav\.js\?v=\d+"><\/script>/, '사업 목록 모델(종결 판정)');
  assert.ok(SRC.indexOf('pu-gov-report-docs.js') < SRC.indexOf('pu-gov-report-nav.js'), '새 모듈은 서류 모듈 다음에 싣는다(옆 모듈을 불러 쓴다)');
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
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES, '쓰기 명령은 grSaveCell 의 .set · grCloseBiz 의 .set · grReopenBiz 의 .set(되돌림 표시) 뿐 — .remove 는 없다');
  assert.doesNotMatch(INLINE, /ref\([^)]*\)\.push\(/, '쓰기 명령이 있다');
  assert.match(grab('grPutCell'), /fbDb\.ref\(GR_TRACK_NODES\.docs\+'\/'\+coId\+'\/'\+rid\+'\/items\/'\+key\)\.set\(rec\)/, '서류 줄 쓰기는 grPutCell 한 곳 — 칸 창 저장(grSaveCell)과 자동 처리 되돌리기(grUndoAuto)가 같이 쓴다');
  assert.match(grab('grSaveCell'), /grPutCell\(c\.coId,c\.rid,c\.key,rec\)/);
  assert.doesNotMatch(grab('grSaveCell'), /\.set\(/);
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
  assert.deepEqual(g.writeContracts.map((w) => w.path), ['activeWriter/gov_report', 'scal_docs/{co}/{rid}/items/{key}', 'scal_bizState/{code}', 'scal_bizOrder/main', 'scal_autoRun/cfg'],
    '쓰는 자리는 서류 진행 기록 줄 하나 + 사업 종결 표시 하나 + 사업 순서 문서 하나(2026-10-12) + 메일 자동 처리 모드 한 칸(2026-10-22)');
  assert.ok(g.primaryRoots.includes('scal_docs'), '서류 진행 기록의 주인은 이 앱');
  assert.ok(g.primaryRoots.includes('scal_bizState'), '사업 종결 표시의 주인도 이 앱');
  assert.ok(g.primaryRoots.includes('scal_bizOrder'), '사업 순서의 주인도 이 앱');
  assert.ok(g.primaryRoots.includes('scal_autoRun'), '메일 자동 처리 기록(모드·마지막 실행·자동 처리 목록)의 주인도 이 앱');
  assert.match(SRC, /컨설팅 사업 목록을 불러오지 못했습니다/);
  assert.match(SRC, /환경설정 → 컨설팅관리에 컨설팅 사업이 없습니다/);
});

test('⑩ 왼쪽 패널 — «사업 이름 (수행기관)» 두 줄(진행 사업 sortOrder 순) · 숨김·합친 사업 없음 · 연결 없는 것은 접는 묶음으로 맨 끝 · 읽기만', async () => {
  const w = world();
  await w.ctx.grLoad();
  const h = w.els.biz.innerHTML;
  const at = (s) => { const i = h.indexOf(s); assert.ok(i >= 0, s); return i; };
  /* 옛 검사는 «기관 이름 머리» 순서를 봤다 — 이제 기관 머리가 없고 사업 이름 아래 (기관) 이 붙는다. 같은 차례(사업 sortOrder 순)를 이름·기관 두 줄로 */
  /* 4단계 Task 3 — 진행 사업은 사업 카드(이름 .bz-cn · (기관) .bz-ca 가 따로 줄을 이룬다). 같은 차례를 카드 이름으로 */
  assert.ok(at('<span class="bz-cn">일터상생혁신컨설팅</span>') < at('<span class="bz-cn">통합기술보호지원단</span>'));
  assert.ok(at('<span class="bz-cn">통합기술보호지원단</span>') < at('<span class="bz-cn">인사노무컨설팅충남북부상의</span>'));
  assert.ok(at('<span class="bz-cn">인사노무컨설팅충남북부상의</span>') < at('<span class="bz-cn">인사노무컨설팅서산</span>'));
  assert.ok(at('<span class="bz-cn">인사노무컨설팅서산</span>') < at('정부사업일정에 사업 없음'));
  ['(기관 미지정)', '(비즈니스지원단(중기청))', '(충남북부상공회의소)', '(서산상공회의소)'].forEach((a) => assert.ok(h.includes('<span class="bz-ca">' + a + '</span>'), a + ' 수행기관 줄'));
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
  assert.match(w.els.biz.innerHTML, /class="bz bz-card on" data-biz="consulting-03"/);
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
  assert.ok(v.els.biz.innerHTML.includes('<span class="bz-ca">(&#60;b&#62;)</span>'), '기관 이름도 이스케이프(사업 이름 아래 (기관) 줄 — 사업 카드)');
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
  assert.ok(h.includes('[확인 필요: 2026-04 개정 지침 대조(별지 24)]'));
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
  assert.ok(h.includes('자문 일지 회신') && h.includes('<span class="st st-draft">기술보호 자료 · 상담 완료 후 반납·삭제 대상</span>'));
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
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES, '쓰기 명령은 서류 줄 .set · 종결 .set · 되돌림 표시 .set 뿐 — .remove 는 없다');
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
  assert.equal(D.planFor('현장클리닉').items.filter((i) => i.step === 'submit')[0].how, 'platform', '현장클리닉은 2026-10-12 부터 플랫폼 제출(방식 모르는 꼴은 위 합성 틀로 본다)');
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
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES);
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
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES);
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
  const line = h.split('<tr>').filter((x) => x.includes('<td class="co"') && x.includes('다라정밀'))[0];   // 대시보드 점 줄에도 이름이 있다 — 표의 줄만
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
  const row = w.els.docs.innerHTML.split('<tr>').filter((x) => x.includes('<td class="co"') && x.includes('다라정밀'))[0];   // 대시보드 점 줄에도 이름이 있다 — 표의 줄만
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
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES);
  assert.doesNotMatch(INLINE, /ref\([^)]*\)\.push\(/);
  ['grRdHtml', 'grReadRd', 'grRenderCrit'].forEach((n) => assert.doesNotMatch(grab(n), /fbDb|\.set\(|\.update\(|fetch\(|mailto:|\.send\s*\(/, n));
  assert.match(grab('grPutCell'), /fbDb\.ref\(GR_TRACK_NODES\.docs\+'\/'\+coId\+'\/'\+rid\+'\/items\/'\+key\)\.set\(rec\)/, '서류 줄 쓰기는 grPutCell 한 곳 — 칸 창 저장(grSaveCell)과 자동 처리 되돌리기(grUndoAuto)가 같이 쓴다');
  assert.match(grab('grSaveCell'), /grPutCell\(c\.coId,c\.rid,c\.key,rec\)/);
  assert.doesNotMatch(grab('grSaveCell'), /\.set\(/);
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
/* ══ 장별 AI 초안(칸 창 「✨ 장별 AI 초안」) — 계획 docs/superpowers/plans/2026-10-12-gov-report-chapters.md Task 2 (2026-10-12) ══
   합성 일터혁신(t2 · consulting-02)·산업일자리(t6 · consulting-07)·충남(t5 · consulting-06) 씨앗은 위 rdSeed·bigSeed 를 쓴다 — 회차 메모·계약 업체 정보만 더한다.
   PuAiCall·firebase.auth·navigator.clipboard·localStorage·confirm 은 모두 가짜다(진짜 AI·로그인 화면은 못 본다). 칸 창은 liveDom 으로 그려진 값이 입력칸에 들어간다. */
const CHM = require('../js/pu-gov-report-chapters.js');
const CH_NAME = '다라정밀', CH_DIGIT_NAME = '3S정밀';
const CH_MEMO1 = (n) => n + ' 박대표 면담 — 010-1234-5678 / choi@example.com 로 연락. 주 52시간 점검';
const CH_MEMO2 = (n) => n + ' 정부담당 동석, 최담당이 서류 준비. 취업규칙 개정 논의';
function chapSeed(o) {
  o = o || {};
  const nm = o.name || CH_NAME;
  const s = rdSeed({ n: 2, m: 2, ind: o.ind, track: o.track });
  const sc = (id) => s.scal_scheds.filter((x) => x.id === id)[0];
  if (o.memo !== false) {
    sc('b1').memo = CH_MEMO1(nm); sc('b2').memo = CH_MEMO2(nm);
    sc('b5').memo = '산업 ' + CH_MEMO1(nm); sc('b6').memo = '산업 ' + CH_MEMO2(nm);
    sc('b3').memo = '충남 ' + CH_MEMO1(nm);
  }
  if (o.name) {
    s.scal_cos.filter((c) => c.id === 'c2')[0].name = nm;
    ['k3', 'k4'].forEach((k) => { s.data.consultings.v[k].companyName = nm; });   // k5 는 아래에서 nm 으로 만든다
  }
  /* 이알피 계약 — 일터혁신(consulting-02)은 이 검사가 더한다(k5). 산업일자리(k4)·충남(k3)은 위 씨앗에 이미 있다 */
  s.data.consultings.v.k5 = { id: 'k5', companyName: nm, typeCodes: { consulting: 'consulting-02' }, startDate: '2026-08-01', endDate: '2026-10-31', status: 'active', managerMain: 'P-009' };
  ['k3', 'k4', 'k5'].forEach((k) => {
    s.data.consultings.v[k].company = { name: nm, ceo: '박대표', bizType: '금속가공',
      contacts: [{ name: '정부담당', phone: '010-0000-0000' }, { name: '최담당', isPrimary: true, email: 'choi@example.com' }] };
  });
  return s;
}
/* 가짜 AI — replies 는 차례로(마지막은 되풀이), Error 면 던진다. 답은 {text} · textOf 는 text 를 그대로 */
function fakeAi(replies) {
  const calls = [], q = (replies || []).slice();
  return { calls, textOf: (r) => r.text,
    ask: async (parts, opts) => { calls.push({ parts, opts }); const r = q.length > 1 ? q.shift() : q[0]; if (r instanceof Error) throw r; return r; } };
}
const jr = (o) => ({ text: JSON.stringify(o) });
/* 세계 — o.say: 동의창 답(기본 yes · 함수면 그 글을 보고) · o.consented: 이미 동의한 브라우저 · o.noLs: localStorage 없음 */
function chapW(o) {
  o = o || {};
  const asked = [], store = o.consented ? { gov_ai_ok: '1' } : {}, copies = [], ai = o.ai || fakeAi(o.replies || []);
  const nav = { clipboard: { writeText: async (t) => { if (o.copyFail) throw new Error('denied'); copies.push(t); } } };
  const w = rdWorld({ seed: o.seed || chapSeed(o), email: 'p009@pureun.kr', ai, nav,
    confirm: (m) => { asked.push(m); return o.say === undefined ? true : (typeof o.say === 'function' ? o.say(m) : o.say); },
    ls: o.noLs ? undefined : { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    noUser: o.noUser });
  liveChap(w);
  return Object.assign(w, { asked, store, copies, ai });
}
const kickCell = (w) => cellOf(w, 'consulting-02', 'c2', 't2', 'report', 'kickoff');
const chapHtml = (w) => w.els.cwChap.innerHTML;
const taOf = (w, k) => { const m = chapHtml(w).match(new RegExp('<textarea id="cwChapK_' + k + '"[^>]*>([\\s\\S]*?)</textarea>')); return m ? unEsc(m[1]) : null; };
const warnOf = (w, k) => ({ cls: w.ctx.$('cwChapW_' + k).className, text: w.ctx.$('cwChapW_' + k).textContent });
const msgOf = (w) => ({ cls: w.ctx.$('cwChapMsg').className, text: w.ctx.$('cwChapMsg').textContent });
const sentOf = (w, i) => w.ai.calls[i || 0].parts[1].text;
/* 입력칸을 사람이 고친 것 — 글칸 값만 바꾸고 oninput 이 부르는 grChapEdit */
function typeChap(w, k, v) { w.ctx.$('cwChapK_' + k).value = v; w.ctx.grChapEdit(k); }
/* #cwChap 이 «그려질 때» — 진짜 DOM 이 하는 일을 흉내 낸다: 글칸 값·경고 줄·안내 줄이 그 요소에 들어가고, 그린 횟수(w.sets)를 센다 */
function liveChap(w) {
  const el = w.ctx.$('cwChap');
  let html = '';
  w.sets = 0;
  Object.defineProperty(el, 'innerHTML', { configurable: true, get: () => html, set: (v) => {
    html = v; w.sets++;
    for (const m of v.matchAll(/<textarea id="(cwChapK_\w+)"[^>]*>([\s\S]*?)<\/textarea>/g)) w.ctx.$(m[1]).value = unEsc(m[2]);
    for (const m of v.matchAll(/<div id="(cwChapW_\w+|cwChapMsg)" class="([^"]*)">([\s\S]*?)<\/div>/g)) { const e = w.ctx.$(m[1]); e.className = m[2]; e.textContent = unEsc(m[3]); }
  } });
}
const J = (x) => JSON.parse(JSON.stringify(x));   // vm 안 객체는 prototype 이 달라 deepEqual 전에 걸러 낸다
const OK = jr({ chapters: { overview: '[해당 기업] 은(는) 2026-08-20 에 착수함. [대표자] 면담함.', analysis: '[해당 기업] 점검 결과 777건 확인함.' } });
const THREE = { overview: '[해당 기업] 은(는) 2026-08-20 에 착수함. [대표자] 면담함.', analysis: '[해당 기업] 점검 결과 777건 확인함.' };

test('93 정적 — 스크립트 셋은 ai → ai-call → chapters 차례 · ?v 는 보고서 창과 같은 번호 · 쓰기는 여전히 .set 한 곳 · AI 는 PuAiCall 로만 · 새 함수는 쓰지 않는다', () => {
  const tag = (f) => (SRC.match(new RegExp('<script src="js/' + f.replace(/\./g, '\\.') + '\\?v=(\\d+)"></script>')) || [])[1];
  ['pu-gov-report-ai.js', 'pu-ai-call.js', 'pu-gov-report-chapters.js'].forEach((f) => assert.ok(tag(f), f + ' 을(를) 싣는다'));
  assert.ok(SRC.indexOf('pu-gov-report-ai.js') < SRC.indexOf('pu-gov-report-chapters.js'), 'ai 를 chapters 보다 먼저');
  assert.ok(SRC.indexOf('pu-gov-report.js') < SRC.indexOf('pu-gov-report-ai.js'), 'ai 는 양식 표 모듈 다음');
  const CONS = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
  ['pu-gov-report-ai.js', 'pu-ai-call.js'].forEach((f) => {
    const v = (CONS.match(new RegExp('js/' + f.replace(/\./g, '\\.') + '\\?v=(\\d+)')) || [])[1];
    assert.ok(v && v === tag(f), f + ' ?v 가 정부사업일정 보고서 창과 같아야 한다');
  });
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES);
  assert.doesNotMatch(INLINE, /ref\([^)]*\)\.push\(/);
  const NEW = ['grOkChapKey', 'grChapAsk', 'grChapConsent', 'grChapCall', 'grChapErrMsg', 'grChapNames', 'grChapLinked', 'grChapInput', 'grChapSay', 'grRenderChap',
    'grChapEdit', 'grChapCopyText', 'grChapCopy', 'grChapCopyAll', 'grChapAi'];
  NEW.forEach((n) => assert.doesNotMatch(grab(n), /grSaveCell|fbDb|\.set\(|\.update\(|fetch\(|XMLHttpRequest|mailto:|\.send\s*\(/, n + ' 이 쓰거나 직접 부른다'));
  assert.match(grab('grChapCall'), /PuAiCall\.ask\(parts,\{auth:auth,app:'erp',generationConfig:/);
  assert.match(grab('grChapCall'), /90000|GR_AI\.wait/);
  assert.match(SRC, /var GR_AI=\{ok:'gov_ai_ok',wait:90000,/);
  assert.match(CONS, /const GRP_AI_OK='gov_ai_ok';/, '보고서 창과 같은 동의 열쇠');
});

test('94 장이 있는 항목 칸 창(일터혁신 착수·산업일자리 최종·충남 결과)에는 #cwChap 와 「AI 초안 만들기」 — 없는 항목·간단형·서명·제출에는 없다', async () => {
  const w = chapW();
  await w.ctx.grLoad(); w.ctx.grSetBiz('consulting-02');
  const has = (st, it) => { w.ctx.grOpenCell('c2', 't2', st, it); const h = w.els.cellw.innerHTML; return hasId(h, 'cwChap') ? chapHtml(w) : null; };
  [['report', 'kickoff'], ['report', 'mid'], ['report', 'final']].forEach(([st, it]) => {
    const h = has(st, it);
    assert.ok(h && h.includes('✨ 장별 AI 초안') && h.includes('AI 초안 만들기') && h.includes(CHM.MSG.NOT_SAVED) && h.includes('가려진 뒤 외부 AI 로 전송됩니다') && h.includes('이알피 계약이 연결된 경우에만'), it);
    assert.deepEqual(J(w.ctx.GR.cw.chaps), CHM.chaptersOf(planItem(WP, it)), it);
    assert.deepEqual(J(w.ctx.GR.cw.chap), { busy: false, msg: '', err: false, draft: {}, warn: {}, sent: '' });
    assert.ok(w.els.cellw.innerHTML.indexOf('id="cwChap"') < w.els.cellw.innerHTML.indexOf('id="cwNote"'), '«메모» 앞에');
    assert.equal(countOf(w.els.cellw.innerHTML, /id="cwChap"/g), 1);
    w.ctx.grCloseCell();
  });
  [['plat', 'plan'], ['plat', 'round'], ['sign', 'guide'], ['plat', 'follow'], ['report', 'outcome']].forEach(([st, it]) => {
    assert.equal(has(st, it), null, it + ' 에는 없다');
    assert.deepEqual(J(w.ctx.GR.cw.chaps), []); assert.equal(w.ctx.GR.cw.chap, null);
    w.ctx.grCloseCell();
  });
  w.ctx.grSetBiz('consulting-07');
  w.ctx.grOpenCell('c2', 't6', 'report', 'final');
  assert.ok(hasId(w.els.cellw.innerHTML, 'cwChap') && chapHtml(w).includes('AI 초안 만들기'), '산업일자리 최종결과보고서');
  assert.deepEqual(w.ctx.GR.cw.chaps.map((c) => c.k), ['summary', 'overview', 'status', 'issues', 'results', 'support']);
  w.ctx.grCloseCell();
  ['kickoff'].forEach((it) => { w.ctx.grOpenCell('c2', 't6', 'report', it); assert.ok(hasId(w.els.cellw.innerHTML, 'cwChap'), '산업일자리 ' + it); w.ctx.grCloseCell(); });
  ['plan', 'mdlog', 'meeting', 'done'].forEach((it) => {
    w.ctx.grOpenCell('c2', 't6', 'report', it);
    assert.ok(w.ctx.GR.cw, it + ' 이 열렸다'); assert.ok(!hasId(w.els.cellw.innerHTML, 'cwChap'), '산업일자리 ' + it);
    w.ctx.grCloseCell();
  });
  w.ctx.grSetBiz('consulting-06');
  w.ctx.grOpenCell('c2', 't5', 'report', 'result');
  assert.ok(hasId(w.els.cellw.innerHTML, 'cwChap') && chapHtml(w).includes('AI 초안 만들기'), '충남 결과보고서');
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't5', 'report', 'after');
  assert.ok(hasId(w.els.cellw.innerHTML, 'cwChap'), '충남 사후관리');
  w.ctx.grCloseCell();
  ['monthly'].forEach((it) => { w.ctx.grOpenCell('c2', 't5', 'report', it); assert.ok(w.ctx.GR.cw, it); assert.ok(!hasId(w.els.cellw.innerHTML, 'cwChap'), '충남 ' + it); w.ctx.grCloseCell(); });
  w.ctx.grSetBiz('consulting-04');
  ['sign', 'submit', 'attach'].forEach((st) => { w.ctx.grOpenCell('c2', 't3', st); assert.ok(w.ctx.GR.cw, st); assert.ok(!hasId(w.els.cellw.innerHTML, 'cwChap'), '간단형 ' + st); assert.equal(w.ctx.GR.cw.chap, null); w.ctx.grCloseCell(); });
  assert.equal(w.db.쓴것.length, 0, '열기만으로는 안 쓴다');
  assert.equal(w.ai.calls.length, 0, '열기만으로는 AI 를 부르지 않는다');
});

test('95 재료가 없으면(회차 메모·서류 메모 모두 비어 있음 · 공백뿐도) 안내만 — PuAiCall.ask 0회 · 동의 창 0회 · 저장 0', async () => {
  const w = chapW({ memo: false });
  await kickCell(w);
  assert.ok(w.ctx.GR.cw && w.ctx.GR.cw.chap, '전제: 장 칸 창이 열렸다');
  w.ctx.GR.input.scheds.filter((s) => s.typeId === 't2').forEach((s) => { s.memo = '   '; });
  await w.ctx.grChapAi();
  assert.equal(w.ai.calls.length, 0); assert.equal(w.asked.length, 0, '동의도 묻지 않는다');
  assert.equal(w.ctx.GR.cw.chap.msg, CHM.MSG.NO_MATERIAL);
  assert.equal(w.ctx.GR.cw.chap.busy, false);
  assert.deepEqual(msgOf(w), { cls: 'days', text: CHM.MSG.NO_MATERIAL });
  assert.ok(!chapHtml(w).includes('<textarea'), '초안 글칸 없음');
  assert.equal(w.db.쓴것.length, 0); assert.deepEqual(w.store, {});
  /* 장 목록이 비면(항목에 장이 없을 때) 재료가 있어도 «채울 장이 없습니다» — 역시 부르지 않는다 */
  const w2 = chapW();
  await kickCell(w2);
  w2.ctx.GR.cw.chaps = [];
  await w2.ctx.grChapAi();
  assert.equal(w2.ai.calls.length, 0); assert.equal(w2.asked.length, 0);
  assert.equal(w2.ctx.GR.cw.chap.msg, '이 서류에는 AI 가 채울 장이 없습니다');
});

test('96 동의 — 안 하면 호출 0회 · 하면 한 번만 부르고 열쇠 gov_ai_ok · 보낸 글에는 업체 이름·대표자·담당자·전화·메일이 없고 자리 표시와 [가림]이 있으며 회차 날짜·메모는 있다', async () => {
  let w = chapW({ say: false, replies: [OK] });
  await kickCell(w);
  await w.ctx.grChapAi();
  assert.equal(w.asked.length, 1); assert.ok(w.asked[0].includes('외부 AI') && w.asked[0].includes('[가림]'));
  assert.equal(w.ai.calls.length, 0, '동의 안 하면 아무것도 보내지 않는다');
  assert.deepEqual(w.store, {}); assert.equal(w.ctx.GR.cw.chap.busy, false);
  assert.deepEqual(J(w.ctx.GR.cw.chap.draft), {});

  w = chapW({ replies: [OK], track: { t2: { 'round:1': { st: 'done', rd: WPR }, 'round:2': { st: 'done', rd: { mode: 'remote', mins: 100, people: 6 } },
    kickoff: { st: 'doing', note: '착수 메모 주 40시간 ' + CH_NAME } } } });
  await kickCell(w);
  await w.ctx.grChapAi();
  assert.equal(w.ai.calls.length, 1, 'PuAiCall.ask 한 번');
  assert.equal(w.asked.length, 1); assert.equal(w.store.gov_ai_ok, '1', '같은 열쇠');
  const call = w.ai.calls[0];
  assert.equal(call.parts.length, 2);
  assert.ok(call.parts[0].text.includes('채울 장') && call.parts[0].text.includes('overview') && call.parts[0].text.includes('입력에 없는 숫자'), '시스템 글');
  assert.equal(call.opts.app, 'erp'); assert.ok(call.opts.auth && call.opts.auth.currentUser); assert.ok(call.opts.generationConfig);
  const sent = sentOf(w);
  ['다라정밀', '박대표', '최담당', '정부담당', '010-1234-5678', 'choi@example.com', 'example.com'].forEach((x) => assert.ok(!sent.includes(x) && !call.parts[0].text.includes(x), '나가면 안 되는 글: ' + x));
  ['[해당 기업]', '[대표자]', '[담당자]', '[담당자2]', '[가림]'].forEach((x) => assert.ok(sent.includes(x), x + ' 이 있다'));
  ['2026-08-20', '2026-09-17', '주 52시간 점검', '취업규칙 개정 논의', '착수 메모 주 40시간', '대면 130분 4명', '비대면 100분 6명', '금속가공'].forEach((x) => assert.ok(sent.includes(x), x + ' 이 있다'));
  assert.ok(sent.includes('"방식": "방문"'), '방문 여부');
  /* 이미 동의한 브라우저는 다시 묻지 않는다(보고서 창과 같은 열쇠) */
  const w3 = chapW({ consented: true, replies: [OK] });
  await kickCell(w3); await w3.ctx.grChapAi();
  assert.equal(w3.asked.length, 0); assert.equal(w3.ai.calls.length, 1);
  assert.equal(w.db.쓴것.length, 0);
});

test('97 가짜 답 — 일부 장만(숫자 경고는 그 장에만 err-s) · 값은 되돌린 업체 이름(이름 속 숫자는 경고 아님) · 글칸 고치면 경고만 다시 계산하고 글칸은 다시 그리지 않는다 · 복사', async () => {
  const w = chapW({ name: CH_DIGIT_NAME, replies: [OK] });
  await kickCell(w);
  assert.equal(w.ctx.GR.cw.coName, CH_DIGIT_NAME, '전제: 업체 이름에 숫자');
  await w.ctx.grChapAi();
  const sent = sentOf(w);
  assert.ok(!sent.includes(CH_DIGIT_NAME) && sent.includes('[해당 기업]'));
  assert.ok(!/(?<![\d])3(?![\d])/.test(sent), '전제: 보낸 글에는 숫자 3 이 이름 밖에 없다(가린 글만 견주면 «3» 이 경고로 잡힌다)');
  const ch = w.ctx.GR.cw.chap;
  assert.deepEqual(Object.keys(ch.draft).sort(), ['analysis', 'overview'], '일부 장만');
  assert.equal(ch.draft.overview, '3S정밀 은(는) 2026-08-20 에 착수함. 박대표 면담함.', 'unmask');
  assert.equal(taOf(w, 'overview'), ch.draft.overview);
  assert.equal(taOf(w, 'tasks'), null, '못 받은 장은 글칸이 없다'); assert.equal(taOf(w, 'org'), null);
  assert.deepEqual(J(ch.warn), { analysis: ['777'] }, '이름 속 3 은 경고가 아니다');
  assert.deepEqual(warnOf(w, 'analysis'), { cls: 'err-s', text: CHM.MSG.CHECK + '777' });
  assert.equal(warnOf(w, 'overview').cls, 'days'); assert.equal(warnOf(w, 'overview').text, '');
  assert.ok(msgOf(w).text.includes('초안을 만들었습니다') && msgOf(w).text.includes('채우지 못한 장'), msgOf(w).text);
  const titles = CHM.chaptersOf(planItem(WP, 'kickoff'));
  assert.ok(chapHtml(w).includes('<span>' + titles[0].t + '</span>') && chapHtml(w).includes('<span>' + titles[1].t + '</span>'));
  assert.equal((chapHtml(w).match(/>이 장 복사</g) || []).length, 2); assert.ok(chapHtml(w).includes('>전체 복사<'));
  assert.ok(chapHtml(w).includes('oninput="grChapEdit(\'overview\')"'));
  /* 고치기 — 경고만 다시 계산, 글칸은 다시 그리지 않는다 */
  const before = w.sets;
  typeChap(w, 'analysis', '고친 글 888건 과 777건');
  assert.equal(w.sets, before, '#cwChap 을 다시 그리지 않았다(입력·초점 보존)');
  assert.equal(w.ctx.$('cwChapK_analysis').value, '고친 글 888건 과 777건', '글칸 값 그대로');
  assert.equal(ch.draft.analysis, '고친 글 888건 과 777건');
  assert.deepEqual(J(ch.warn.analysis), ['888', '777']);
  assert.equal(w.ctx.$('cwChapW_analysis').className, 'err-s'); assert.equal(w.ctx.$('cwChapW_analysis').textContent, CHM.MSG.CHECK + '888, 777');
  typeChap(w, 'overview', '20 장 52 개');   // 보낸 글에 있던 숫자(20·52)만
  assert.ok(!('overview' in ch.warn)); assert.equal(w.ctx.$('cwChapW_overview').className, 'days'); assert.equal(w.ctx.$('cwChapW_overview').textContent, '');
  typeChap(w, 'analysis', '숫자 없음');
  assert.deepEqual(J(ch.warn), {}); assert.equal(w.ctx.$('cwChapW_analysis').className, 'days');
  assert.equal(w.sets, before);
  typeChap(w, 'analysis', '다시 999');
  /* 복사 — 「이 장 복사」 = 그 장 글, 「전체 복사」 = 제목\n글 을 장 순서대로 빈 줄로 */
  assert.equal(await w.ctx.grChapCopy('analysis'), true);
  assert.deepEqual(w.copies, ['다시 999']);
  assert.equal(w.ctx.GR.cw.chap.msg, '이 장을 복사했습니다 — 붙여 넣으세요'); assert.equal(w.ctx.$('cwChapMsg').textContent, '이 장을 복사했습니다 — 붙여 넣으세요');
  assert.equal(await w.ctx.grChapCopyAll(), true);
  assert.equal(w.copies[1], titles[0].t + '\n20 장 52 개\n\n' + titles[1].t + '\n다시 999');
  assert.equal(w.sets, before, '복사해도 글칸을 다시 그리지 않는다');
  assert.equal(await w.ctx.grChapCopy('tasks'), false, '초안 없는 장'); assert.equal(await w.ctx.grChapCopy('bad key'), false);
  assert.equal(w.copies.length, 2);
  assert.equal(w.db.쓴것.length, 0, '초안·복사는 아무것도 쓰지 않는다');
  /* 복사가 거절되면 안내(빨간 줄) */
  const f = chapW({ name: CH_DIGIT_NAME, replies: [OK], copyFail: true });
  await kickCell(f); await f.ctx.grChapAi();
  assert.equal(await f.ctx.grChapCopy('overview'), false);
  assert.equal(f.ctx.GR.cw.chap.msg, '복사하지 못했습니다 — 글을 골라 직접 복사해 주세요'); assert.equal(f.ctx.GR.cw.chap.err, true);
  assert.equal(f.ctx.$('cwChapMsg').className, 'err-s');
});

test('98 오류 — 못 읽는 답은 한 번 더 묻고 둘 다 실패면 문구 · 한 번 실패 뒤 성공 · 로그인 없음 · 시간 초과 · 월 한도 · 401 — 기존 GRP_AI_MSG 와 같은 글, 초안은 그대로', async () => {
  const MSG = { login: '로그인을 확인해 주세요', budget: '이번 달 AI 사용 한도를 넘었습니다 — 대표에게 문의', net: 'AI 응답이 없습니다 — 잠시 뒤 다시', parse: 'AI 답을 읽지 못했습니다' };
  const CONS = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
  Object.keys(MSG).forEach((k) => assert.ok(CONS.includes(k + ":'" + MSG[k] + "'"), '보고서 창 문구와 같다: ' + k));
  let w = chapW({ replies: [{ text: '답이 아닙니다' }, { text: '{"chapters":{"zzz":"모르는 장"}}' }] });
  await kickCell(w); await w.ctx.grChapAi();
  assert.equal(w.ai.calls.length, 2, '못 읽으면 한 번 더');
  assert.equal(w.ctx.GR.cw.chap.msg, MSG.parse); assert.equal(w.ctx.GR.cw.chap.err, true);
  assert.deepEqual(msgOf(w), { cls: 'err-s', text: MSG.parse }); assert.equal(w.ctx.GR.cw.chap.busy, false);
  assert.ok(chapHtml(w).includes('AI 초안 만들기') && !chapHtml(w).includes('disabled'), '다시 누를 수 있다');
  w = chapW({ replies: [{ text: '앞잡글' }, OK] });
  await kickCell(w); await w.ctx.grChapAi();
  assert.equal(w.ai.calls.length, 2); assert.deepEqual(Object.keys(w.ctx.GR.cw.chap.draft).sort(), ['analysis', 'overview']);
  assert.equal(w.ctx.GR.cw.chap.err, false);
  w = chapW({ noUser: true, replies: [OK] });
  await kickCell(w); await w.ctx.grChapAi();
  assert.equal(w.ai.calls.length, 0, '로그인이 없으면 부르지 않는다'); assert.equal(w.ctx.GR.cw.chap.msg, MSG.login);
  const budget = Object.assign(new Error('한도'), { overBudget: true });
  w = chapW({ replies: [budget] });
  await kickCell(w); await w.ctx.grChapAi();
  assert.equal(w.ai.calls.length, 1, '한도·망 오류는 되풀이하지 않는다'); assert.equal(w.ctx.GR.cw.chap.msg, MSG.budget);
  w = chapW({ replies: [Object.assign(new Error('x'), { status: 401 })] });
  await kickCell(w); await w.ctx.grChapAi();
  assert.equal(w.ctx.GR.cw.chap.msg, MSG.login);
  w = chapW({ replies: [Object.assign(new Error('x'), { status: 500 })] });
  await kickCell(w); await w.ctx.grChapAi();
  assert.equal(w.ctx.GR.cw.chap.msg, MSG.net);
  /* 90초 — 가짜 시계로 그 타이머만 바로 울린다(끝나지 않는 부름) */
  const never = { calls: [], textOf: () => '', ask: (p, o) => { never.calls.push(p); return new Promise(() => {}); } };
  w = chapW({ ai: never });
  await kickCell(w);
  const waits = [], real = setTimeout;
  w.ctx.setTimeout = (fn, ms) => { waits.push(ms); return real(fn, ms >= 90000 ? 0 : ms); };
  await w.ctx.grChapAi();
  assert.deepEqual(waits, [90000], '90초 제한'); assert.equal(never.calls.length, 1);
  assert.equal(w.ctx.GR.cw.chap.msg, MSG.net); assert.equal(w.ctx.GR.cw.chap.busy, false);
  assert.equal(w.db.쓴것.length, 0);
});

test('99 부르는 사이 칸 창을 닫거나 다른 칸을 열면 결과는 버려지고 새 칸 창은 깨끗하다 · 부르는 중엔 단추가 잠긴다 · 겹쳐 눌러도 한 번만', async () => {
  let go;
  const gate = new Promise((r) => { go = r; });
  const ai = { calls: [], textOf: (r) => r.text, ask: async (p) => { ai.calls.push(p); await gate; return OK; } };
  const w = chapW({ ai });
  await kickCell(w);
  const c = w.ctx.GR.cw;
  const p = w.ctx.grChapAi();
  assert.equal(c.chap.busy, true);
  assert.ok(chapHtml(w).includes('쓰는 중…') && /id="cwChapGo"[^>]*disabled/.test(chapHtml(w)), '잠김');
  await w.ctx.grChapAi();                  // 겹쳐 눌러도 무시
  assert.equal(ai.calls.length, 1);
  w.ctx.grCloseCell();
  const htmlAtClose = chapHtml(w);
  go(); await p;
  assert.equal(w.ctx.GR.cw, null);
  assert.deepEqual(J(c.chap.draft), {}, '닫은 창에는 초안이 들어가지 않는다');
  assert.equal(chapHtml(w), htmlAtClose, '닫은 뒤 화면을 건드리지 않는다');
  /* 다른 칸으로 바뀐 경우 */
  let go2;
  const gate2 = new Promise((r) => { go2 = r; });
  /* 답은 보낸 장 목록을 보고 — 착수(overview·analysis)와 중간(progress·results)에 각각 맞는 글 */
  const ai2 = { calls: [], textOf: (r) => r.text, ask: async (p2) => { ai2.calls.push(p2); await gate2; return p2[1].text.includes('"키": "progress"') ? jr({ chapters: { progress: '경과 글', results: '성과 글' } }) : OK; } };
  const v = chapW({ ai: ai2 });
  await kickCell(v);
  const old = v.ctx.GR.cw, p2 = v.ctx.grChapAi();
  v.ctx.grOpenCell('c2', 't2', 'report', 'mid');
  const fresh = v.ctx.GR.cw;
  assert.notEqual(fresh, old); assert.equal(fresh.item, 'mid');
  go2(); await p2;
  assert.equal(v.ctx.GR.cw, fresh);
  assert.deepEqual(J(fresh.chap), { busy: false, msg: '', err: false, draft: {}, warn: {}, sent: '' }, '새 칸 창이 오염되지 않았다');
  assert.ok(!chapHtml(v).includes('<textarea') && !chapHtml(v).includes('쓰는 중…'), '새 칸 창 화면도 깨끗하다');
  assert.deepEqual(J(old.chap.draft), {});
  /* 새 칸 창은 바로 쓸 수 있다 */
  await v.ctx.grChapAi();
  assert.deepEqual(Object.keys(v.ctx.GR.cw.chap.draft).sort(), ['progress', 'results'], '새 칸 창 자기 장만');
  assert.equal(v.db.쓴것.length, 0);
});

test('100 쓰기 0 — 초안을 만들고 고치고 복사해도 아무것도 안 쓴다 · 저장은 grSaveCell 한 줄뿐이고 저장해도 초안은 그대로(칸 창만 다시 그려진다) · 다른 칸 창 회귀 없음', async () => {
  const w = chapW({ replies: [OK] });
  await kickCell(w);
  await w.ctx.grChapAi(); typeChap(w, 'overview', '손으로 고친 글'); await w.ctx.grChapCopyAll();
  assert.equal(w.db.쓴것.length, 0);
  w.ctx.$('cwSt').value = 'doing';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 1, '저장은 서류 진행 기록 한 줄'); onlyTrackWrites(w.db);
  assert.equal(w.db.쓴것[0].자리, 'scal_docs/c2/t2_2026/items/kickoff');
  const rec = w.db.쓴것[0].값;
  assert.ok(!JSON.stringify(w.db.쓴것).includes('손으로 고친 글') && !JSON.stringify(w.db.쓴것).includes('점검 결과 777건'), '초안은 저장되지 않는다');   // 시각(Date.now())에 «777» 이 들어 있어도 흔들리지 않게 문장째로 본다
  assert.ok(!('chap' in rec) && !('draft' in rec));
  assert.equal(w.ctx.GR.cw.chap.draft.overview, '손으로 고친 글', '저장해도 초안은 화면에 남는다');
  assert.equal(taOf(w, 'overview'), '손으로 고친 글', '칸 창을 다시 그려도 장 구역이 다시 채워진다');
  assert.ok(hasId(w.els.cellw.innerHTML, 'cwChap'));
  /* 회귀 — 다른 칸 창 */
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't2', 'plat', 'round');
  let h = w.els.cellw.innerHTML;
  assert.ok(hasId(h, 'cwRdMode') && hasId(h, 'cwCrit') && !hasId(h, 'cwChap'), '회차 기록·기준 점검');
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't2', 'sign', 'guide');
  assert.ok(hasId(w.els.cellw.innerHTML, 'cwSend') && !hasId(w.els.cellw.innerHTML, 'cwChap'), '서명 요청');
  w.ctx.grSetBiz('consulting-04'); w.ctx.grCloseCell();
  w.ctx.grOpenCell('c2', 't3', 'sign');
  assert.ok(hasId(w.els.cellw.innerHTML, 'cwSend') && !hasId(w.els.cellw.innerHTML, 'cwChap'), '간단형 서명');
  assert.equal(w.db.쓴것.length, 1);
});

test('101 이미 만든 초안이 있으면 다시 만들기 전에 한 번 묻는다 — 거절하면 호출 없이 그대로 · 동의 창과 별개', async () => {
  let say = true;
  const w = chapW({ replies: [OK], say: () => say, consented: true });
  await kickCell(w);
  await w.ctx.grChapAi();
  assert.equal(w.asked.length, 0, '처음엔 묻지 않는다(이미 동의)');
  typeChap(w, 'overview', '고친 글');
  say = false;
  await w.ctx.grChapAi();
  assert.equal(w.asked.length, 1); assert.ok(w.asked[0].includes('이미 만든 초안'));
  assert.equal(w.ai.calls.length, 1, '거절하면 다시 부르지 않는다'); assert.equal(w.ctx.GR.cw.chap.draft.overview, '고친 글');
  say = true;
  await w.ctx.grChapAi();
  assert.equal(w.ai.calls.length, 2);
  assert.equal(w.ctx.GR.cw.chap.draft.overview.includes('고친 글'), false, '새 초안으로 바뀐다');
});

test('102 이름 점검 — 계약 업체명 두 곳·대표자·주담당·다른 담당자는 자리 표시로, 회차는 목록이 보는 그 회차(사전진단 제외·날짜순)·회차 기록은 round:N 순서대로, 서류 메모는 저장된 것만', async () => {
  const s = chapSeed({ track: { t2: { 'round:2': { st: 'done', rd: { mode: 'face', mins: 90, people: 5 } }, kickoff: { st: 'doing', note: '저장된 메모' } } } });
  s.scal_scheds.push({ id: 'zz1', coId: 'c2', typeId: 't2', date: '2026-07-01', round: 0, phase: 'pre', isField: true, memo: '사전진단 메모' },
    { id: 'zz2', coId: 'c2', typeId: 't2', date: '2026-10-01', round: 3, isField: null, memo: '' },
    { id: 'zz3', coId: 'c1', typeId: 't2', date: '2026-08-21', round: 1, isField: true, memo: '남의 업체 메모' },
    { id: 'zz4', coId: 'c2', typeId: 't2', date: '날짜아님', isField: true, memo: '날짜 없는 메모' });
  s.data.consultings.v.k5.company.contacts.push({ name: '셋째담당' });
  s.data.consultings.v.k5.companyName = '계약표기상사';
  const w = chapW({ seed: s, replies: [OK] });
  await kickCell(w);
  const names = w.ctx.grChapNames(w.ctx.GR.cw);
  assert.deepEqual(J(names.map((n) => n.as + ':' + n.v)), ['[해당 기업]:다라정밀', '[해당 기업]:계약표기상사', '[대표자]:박대표', '[담당자]:최담당', '[담당자2]:정부담당', '[담당자3]:셋째담당']);
  const inp = w.ctx.grChapInput(w.ctx.GR.cw);
  assert.deepEqual(inp.rounds.map((r) => r.date), ['2026-08-20', '2026-09-17', '2026-10-01'], '사전진단·남의 업체·날짜 없는 일정은 빠진다(목록 pairs 와 같은 거름)');
  assert.deepEqual(inp.rounds.map((r) => r.visit), [true, true, null]);
  assert.deepEqual(inp.rounds.map((r) => !!r.rd), [false, true, false], 'rd 는 round:N 줄이 있는 회차에만');
  assert.deepEqual(J(inp.rounds[1].rd), { mode: 'face', mins: 90, people: 5 });
  assert.deepEqual(J(inp.notes), [{ label: inp.itemName, text: '저장된 메모' }]);
  assert.deepEqual(J(inp.company), { name: '다라정밀', bizType: '금속가공' }, '근로자수는 보내지 않는다(없는 값을 0 으로 쓰지 않는다)');
  w.ctx.$('cwNote').value = '저장 안 한 입력';   // 칸 창에 적고 아직 저장하지 않은 메모는 «지금 값» 이 재료다(저장된 것보다 우선)
  assert.deepEqual(J(w.ctx.grChapInput(w.ctx.GR.cw).notes), [{ label: inp.itemName, text: '저장 안 한 입력' }]);
  w.ctx.$('cwNote').value = '저장된 메모';
  await w.ctx.grChapAi();
  const sent = sentOf(w);
  ['다라정밀', '계약표기상사', '박대표', '최담당', '정부담당', '셋째담당', '사전진단 메모', '남의 업체 메모', '날짜 없는 메모'].forEach((x) => assert.ok(!sent.includes(x), x));
  assert.ok(sent.includes('저장된 메모') && sent.includes('2026-10-01') && sent.includes('"방식": "모름"'));
});

test('103 바깥 값은 이스케이프 — 장 제목·글칸·경고·안내·사업장 이름·메모·AI 답에 <script>·따옴표', async () => {
  const bad = '<script>alert(1)</script>"\'';
  const esc = '&#60;script&#62;alert(1)&#60;/script&#62;&#34;&#39;';
  const w = chapW({ seed: chapSeed({ track: { t2: { kickoff: { st: 'doing', note: bad } } } }), replies: [jr({ chapters: { overview: bad + ' 4444', analysis: '<img src=x onerror=alert(2)>' } })] });
  await w.ctx.grLoad(); w.ctx.grSetBiz('consulting-02');
  const hostile = (n) => { const p = D.planFor(n); return Object.assign({}, p, { items: p.items.map((i) => (i.id === 'kickoff'
    ? Object.assign({}, i, { chapters: [{ k: 'overview', t: bad }, { k: 'analysis', t: '<b>' + bad + '</b>' }] }) : i)) }); };
  w.ctx.PuGovReportDocs = Object.assign({}, D, { planFor: hostile });
  w.ctx.PuGovReportChapters = Object.assign({}, CHM, { MSG: Object.assign({}, CHM.MSG, { CHECK: bad + ' 숫자: ' }) });
  w.ctx.GR.input.scheds.filter((s) => s.id === 'b1')[0].memo = bad;
  w.ctx.grOpenCell('c2', 't2', 'report', 'kickoff');
  w.ctx.GR.cw.coName = bad;
  w.ctx.grRenderCell();
  assert.ok(w.ctx.GR.cw.chaps.length === 2, '전제: 장이 열렸다');
  await w.ctx.grChapAi();
  const h = chapHtml(w);
  assert.ok(Object.keys(w.ctx.GR.cw.chap.draft).length === 2, '전제: 초안이 그려졌다');
  assert.ok(!/<script|<img|<b>/i.test(h), '태그가 그대로 들어갔다: ' + h);
  assert.ok(h.includes('<span>' + esc + '</span>'), '장 제목은 글자로');
  assert.ok(h.includes('rows="8" oninput="grChapEdit(\'overview\')">' + esc + ' 4444</textarea>'), '글칸 값은 글자로');
  assert.ok(h.includes('&#60;img src=x onerror=alert(2)&#62;'));
  assert.ok(h.includes(esc + ' 숫자: 4444'), '경고는 글자로: ' + h);
  assert.ok(!/<script|<img/i.test(w.els.cellw.innerHTML), '칸 창 머리·메모도 글자로');
  assert.equal(w.db.쓴것.length, 0);
});

/* ══ 최종 검토 반영 (2026-10-12) ══ */
/* 이알피 계약이 안 이어진 세계 — k5 를 지운다(계약 없음) 또는 대표자·담당자 없는 계약만 둔다 */
function noConsSeed(o) {
  const s = chapSeed(o);
  if (o && o.bare) s.data.consultings.v.k5.company = { name: CH_NAME };
  else delete s.data.consultings.v.k5;
  return s;
}
const NOCONS = '이알피 계약이 연결되지 않아 대표자·담당자 이름은 가려지지 않습니다 — 회차 메모에 사람 이름이 있으면 그대로 전송됩니다';

test('104 이알피 계약 연결 안내 — 연결됐으면 경고 줄도 추가 확인도 없다 · 안 됐으면 경고 줄(err-s)·추가 확인, 거절하면 0회, 수락하면 1회(사업장 이름·전화·메일은 여전히 가림)', async () => {
  /* 연결됨 */
  let w = chapW({ consented: true, replies: [OK] });
  await kickCell(w);
  assert.ok(w.ctx.GR.cw.cons, '전제: 계약이 이어졌다'); assert.equal(w.ctx.grChapLinked(w.ctx.GR.cw), true);
  assert.ok(!chapHtml(w).includes('cwChapNoCons') && !chapHtml(w).includes(NOCONS), '경고 줄 없음');
  await w.ctx.grChapAi();
  assert.equal(w.asked.length, 0, '추가 확인 없음'); assert.equal(w.ai.calls.length, 1);
  /* 안 이어짐(계약 없음)·대표자·담당자 없는 계약 — 둘 다 같다 */
  for (const bare of [false, true]) {
    w = chapW({ seed: noConsSeed({ bare }), consented: true, say: false, replies: [OK] });
    await kickCell(w);
    assert.equal(w.ctx.grChapLinked(w.ctx.GR.cw), false, 'bare=' + bare);
    assert.equal(!!w.ctx.GR.cw.cons, bare, '전제');
    assert.ok(chapHtml(w).includes('<div id="cwChapNoCons" class="err-s">' + NOCONS + '</div>'), '경고 줄(err-s) bare=' + bare);
    await w.ctx.grChapAi();
    assert.equal(w.asked.length, 1); assert.ok(w.asked[0].includes('대표자·담당자 이름은 가려지지 않습니다') && w.asked[0].includes('그래도 보낼까요?'), w.asked[0]);
    assert.equal(w.ai.calls.length, 0, '거절하면 보내지 않는다'); assert.equal(w.ctx.GR.cw.chap.busy, false);
    w = chapW({ seed: noConsSeed({ bare }), consented: true, replies: [OK] });
    await kickCell(w);
    await w.ctx.grChapAi();
    assert.equal(w.asked.length, 1); assert.equal(w.ai.calls.length, 1, '수락하면 한 번');
    const sent = sentOf(w);
    ['다라정밀', '010-1234-5678', 'choi@example.com'].forEach((x) => assert.ok(!sent.includes(x), '여전히 가린다: ' + x));
    assert.ok(sent.includes('[해당 기업]') && sent.includes('[가림]'));
    assert.ok(sent.includes('박대표'), '알 수 없는 사람 이름은 못 가린다(그래서 묻는다)');
  }
  /* 재료가 없으면 경고 확인도 묻지 않는다 */
  w = chapW({ seed: noConsSeed({ memo: false }), consented: true });
  await kickCell(w); await w.ctx.grChapAi();
  assert.equal(w.asked.length, 0); assert.equal(w.ai.calls.length, 0); assert.equal(w.ctx.GR.cw.chap.msg, CHM.MSG.NO_MATERIAL);
  /* 처음 동의 글은 없는 가림을 약속하지 않는다 */
  w = chapW({ replies: [OK] });
  await kickCell(w); await w.ctx.grChapAi();
  assert.ok(w.asked[0].includes('이알피 계약이 연결된 업체는 대표자·담당자 이름도 자리 표시로'), w.asked[0]);
  assert.ok(!w.asked[0].includes('업체·대표자·담당자 이름은 자리 표시로 바꾸고'));
  assert.equal(w.db.쓴것.length, 0);
});

test('105 서류 메모 재료는 입력칸의 «지금 값» — 저장 전 메모만으로도 부른다(가려서) · 입력칸이 비고 저장 메모·회차 메모도 없으면 부르지 않는다', async () => {
  let w = chapW({ memo: false, consented: true, replies: [OK] });
  await kickCell(w);
  w.ctx.$('cwNote').value = '새 메모 주 40시간 010-9999-8888 ' + CH_NAME;
  await w.ctx.grChapAi();
  assert.equal(w.ai.calls.length, 1, '저장 안 한 메모로 부른다');
  const sent = sentOf(w);
  assert.ok(sent.includes('새 메모 주 40시간') && !sent.includes('010-9999-8888') && !sent.includes(CH_NAME) && sent.includes('[해당 기업]') && sent.includes('[가림]'));
  assert.equal(w.db.쓴것.length, 0, '메모는 저장되지 않는다');
  /* 비어 있음 */
  w = chapW({ memo: false, consented: true });
  await kickCell(w);
  w.ctx.$('cwNote').value = '  ';
  await w.ctx.grChapAi();
  assert.equal(w.ai.calls.length, 0); assert.equal(w.asked.length, 0); assert.equal(w.ctx.GR.cw.chap.msg, CHM.MSG.NO_MATERIAL);
  /* 저장된 메모가 있어도 입력칸을 비웠으면 지금 값(빈 칸)이 이긴다 */
  w = chapW({ memo: false, consented: true, track: { t2: { kickoff: { st: 'doing', note: '저장된 메모' } } } });
  await kickCell(w);
  assert.equal(w.ctx.$('cwNote').value, '저장된 메모', '전제: 입력칸에 저장된 메모가 그려졌다');
  w.ctx.$('cwNote').value = '';
  await w.ctx.grChapAi();
  assert.equal(w.ai.calls.length, 0); assert.equal(w.ctx.GR.cw.chap.msg, CHM.MSG.NO_MATERIAL);
});

test('106 회차 거름은 D.pairs 와 같다 — id 없는 일정은 버리고 날짜는 공백을 뗀 뒤 본다(번호·rd 가 밀리지 않는다)', async () => {
  const s = chapSeed({ track: { t2: { 'round:1': { st: 'done', rd: WPR }, 'round:2': { st: 'done', rd: { mode: 'remote', mins: 100, people: 6 } }, 'round:3': { st: 'done', rd: { mode: 'face', mins: 70, people: 2 } } } } });
  s.scal_scheds.push({ coId: 'c2', typeId: 't2', date: '2026-08-01', isField: true, memo: 'id 없는 일정 메모' },          // 첫 회차를 밀어낼 수 있는 일정 — pairs 는 센 적이 없다
    { id: 'sp', coId: 'c2', typeId: 't2', date: ' 2026-09-30 ', isField: true, memo: '공백 낀 날짜 메모' });
  const w = chapW({ seed: s, replies: [OK], consented: true });
  await kickCell(w);
  const pair = D.pairs(w.ctx.GR.input, 't2', '2026').filter((p) => p.coId === 'c2')[0];
  const inp = w.ctx.grChapInput(w.ctx.GR.cw);
  assert.equal(pair.rounds, 3, '전제: 목록은 세 회차를 본다');
  assert.equal(inp.rounds.length, pair.rounds, '화면이 센 회차 = 목록이 센 회차');
  assert.deepEqual(inp.rounds.map((r) => r.date), ['2026-08-20', '2026-09-17', '2026-09-30'], '날짜는 공백이 떼어진다 · id 없는 일정은 없다');
  assert.deepEqual(inp.rounds.map((r) => r.rd && r.rd.mins), [130, 100, 70], 'rd 가 회차 번호 순서대로 붙는다(밀리지 않는다)');
  await w.ctx.grChapAi();
  const sent = sentOf(w);
  assert.ok(sent.includes('공백 낀 날짜 메모') && sent.includes('"날짜": "2026-09-30"') && !sent.includes('id 없는 일정 메모'));
});

test('107 모듈을 못 불렀으면(PuGovReportAi·PuGovReportChapters 없음) 「AI 모듈을 불러오지 못했습니다」 — 던지지 않고 부르지도 묻지도 않는다', async () => {
  for (const name of ['PuGovReportAi', 'PuGovReportChapters']) {
    const w = chapW({ replies: [OK] });
    await kickCell(w);
    w.ctx[name] = undefined;
    await w.ctx.grChapAi();   // 던지면 이 검사가 깨진다
    assert.equal(w.ctx.GR.cw.chap.msg, 'AI 모듈을 불러오지 못했습니다 — 새로 고친 뒤 다시', name);
    assert.equal(w.ctx.GR.cw.chap.err, true); assert.equal(w.ctx.GR.cw.chap.busy, false);
    assert.equal(w.ai.calls.length, 0); assert.equal(w.asked.length, 0);
    assert.deepEqual(msgOf(w), { cls: 'err-s', text: 'AI 모듈을 불러오지 못했습니다 — 새로 고친 뒤 다시' }, name);
    w.ctx.grChapEdit('overview'); w.ctx.grRenderChap();   // 이것들도 던지지 않는다
    assert.equal(w.db.쓴것.length, 0);
  }
});

/* ══ 전역 「📥 받은 서류 확인」(2026-10-12) — 계획 docs/superpowers/plans/2026-10-12-gov-report-global-inbox.md Task 2 ══
   world 의 오늘 = 2026-10-10 → 창은 2026-08-26 ~ 2026-10-10(45일). 합성 씨앗은 «진짜로 이어지게» 짠다 — 아래 검사가 이음을 직접 확인한다.
   읽기 전용: 메일함 읽기는 기존 grLoadInbox 뿐, 쓰기 0. */
const GI_SLUG = 'INBOX-0a1b2c3d';
const kst = (m, d) => Date.UTC(2026, m - 1, d, 1);   // 한국 시간 그날 10시
const giHtml = (w) => w.els.ginbox.innerHTML;
const giList = (w) => J(w.ctx.GR.gi.list);
const mailReads = (w) => w.paths.filter((p) => p.indexOf('mailbox') === 0 || p === 'data/companies');
/* 읽는 자리를 적어 두는 세계 — fail(자리) 이 참이면 그 자리 읽기는 거절 */
function giWorld(o) {
  o = o || {};
  const paths = [];
  const w = world({ seed: o.seed || giSeed(), email: o.email, db: (db) => ({ ref: (p) => {
    paths.push(p);
    return (o.fail && o.fail(p)) ? { once: async () => { throw new Error('permission_denied'); } } : db.ref(p);
  } }) });
  w.paths = paths;
  return w;
}
/* 다라정밀(c2·t3) dara@ 메일 + 가나상사(c1·t1)·마바산업(c3·t4) 둘에 걸린 both@ 메일 하나.
   기간 안: 111(10-07 both@) 108(10-05) 107(09-29 — 마바산업 줄의 link 로 이미 연결) 102(09-26 개인 자료) 101(09-25) 110(08-26 = 45일째)
   빠지는 것: 109(08-25 = 46일 전) 103(첨부 없음) 104(06-01) 105(먼저상사 주소) 106(07-20) 201(보낸 메일) 301(스팸 폴더) */
function giSeed(o) {
  o = o || {};
  const s = F.seed();
  const box = s.mailbox.msgs[GI_SLUG];
  const mail = (uid, from, subject, d, names, e) => { box[uid] = { u: uid, f: from, e: e || 'dara@example.com', t: 'office@pureun.kr', s: subject, d, a: names.length, an: names }; };
  mail(108, '다라정밀 담당', '최신 점검표', kst(10, 5), ['점검표.pdf']);
  mail(109, '다라정밀 담당', '46일 전 자료', kst(8, 25), ['옛날자료.pdf']);
  mail(110, '다라정밀 담당', '45일째 자료', kst(8, 26), ['경계.pdf']);
  mail(111, '공동 발신', '두 업체 자료', kst(10, 7), ['공동자료.pdf'], 'both@example.com');
  s.data.consultings.v.k1.contacts.push({ name: '공동', email: 'both@example.com' });
  s.data.consultings.v.k5 = { id: 'k5', companyName: '마바산업', typeCodes: { consulting: 'consulting-05' },
    startDate: '2026-03-01', endDate: '2026-09-30', status: 'active', managerMain: 'P-009', contacts: [{ name: '공동', email: 'both@example.com' }] };
  if (!o.noLink) s.scal_docs.c3.t4_2026.items.submit.link = { src: 'mail', key: 'i:' + GI_SLUG + ':107', name: '현장.jpg', date: '2026-09-29' };
  return s;
}

test('108 정적 — 새 구역 #ginbox 는 「챙길 것」 아래 · 쓰기는 여전히 .set 한 곳 · 새 세 함수에는 fbDb·.set(·fetch(·grSaveCell 이 없고 단추에는 번호만 끼운다', () => {
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES, '쓰기 명령은 서류 줄 .set · 종결 .set · 되돌림 표시 .set 뿐 — .remove 는 없다');
  assert.match(SRC, /<section><h2>📥 받은 서류 확인<\/h2><div id="ginbox"><\/div><\/section>/);
  assert.ok(SRC.indexOf('id="alerts"') > 0 && SRC.indexOf('id="alerts"') < SRC.indexOf('id="ginbox"'), '챙길 것 구역 아래');
  ['grGlobalInbox', 'grGlobalCompute', 'grGlobalRefresh', 'grGiReset', 'grRenderGlobalInbox', 'grOpenFromInbox'].forEach((n) => {
    assert.doesNotMatch(grab(n), /fbDb|\.set\(|\.update\(|\.remove\(|\.transaction\(|fetch\(|grSaveCell|localStorage|https?:\/\//, n + ' 에 쓰기·서버 부르기가 있다');
  });
  assert.match(grab('grRender'), /grRenderGlobalInbox\(\)/, '처음 그릴 때·바뀔 때 구역도 그린다');
  assert.match(grab('grSaveCell'), /grGlobalRefresh\(\); grApplyTrack\(\); grRender\(\);/, '저장 뒤 목록 다시 계산(메일함은 안 읽는다)');
  assert.match(SRC, /var y0=GR\.f\.year; GR\.f\[GR_FIELDS\[id\]\]=this\.value; if\(GR\.f\.year!==y0\) grGiReset\(\);/, '연도 거르개가 바뀌면 목록을 처음 상태로');
  const render = grab('grRenderGlobalInbox');
  assert.match(render, /onclick="grOpenFromInbox\('\+i\+'\)"/, '단추에는 번호만 끼운다');
  assert.match(grab('grOpenFromInbox'), /grSetBiz\(/);
  assert.match(grab('grOpenFromInbox'), /grOpenCell\(/);
});

test('109 처음 그릴 때는 설명 한 줄과 「📥 확인」 단추뿐 — 메일함·업체관리를 읽지 않는다', async () => {
  const w = giWorld();
  await w.ctx.grLoad();
  const h = giHtml(w);
  assert.ok(h.includes('최근 45일 안에 받은 첨부 메일 가운데 아직 서류 줄에 연결하지 않은 것을 찾습니다'));
  assert.match(h, /<button type="button" onclick="grGlobalInbox\(\)">📥 확인<\/button>/);
  assert.doesNotMatch(h, /<li>|disabled|err-s/);
  assert.deepEqual(mailReads(w), [], '단추를 누르기 전에는 메일함을 읽지 않는다');
  assert.equal(w.ctx.GR.gi.st, 'idle');
  assert.equal(w.db.쓴것.length, 0);
});

test('110 「📥 확인」 — 연결 안 된 최근 45일 받은 메일만 · 두 업체에 걸린 메일은 한 번(먼저 적힌 업체) · 날짜 내림차순 · 첨부·딱지 · 메일함은 한 번만', async () => {
  const s = giSeed();
  const w = giWorld({ seed: s });
  await w.ctx.grLoad();
  /* 합성 자료가 진짜로 겹친다 — 마바산업 사업에도 같은 주소가 걸려 있어야 «한 번만» 검사가 헛돌지 않는다 */
  const cos = s.data.companies.v, ks = s.data.consultings.v;
  assert.ok(I.addrsFor({ companies: cos, cons: ks.k1, name: '가나상사' })['both@example.com'], '가나상사 기술보호에 걸린다');
  assert.ok(I.addrsFor({ companies: cos, cons: ks.k5, name: '마바산업' })['both@example.com'], '마바산업 사업에도 걸린다');
  assert.equal(w.ctx.GR.gi.st, 'idle');
  const p1 = w.ctx.grGlobalInbox(), p2 = w.ctx.grGlobalInbox();   // 겹쳐 눌러도 한 번
  assert.equal(w.ctx.GR.gi.st, 'loading');
  assert.ok(giHtml(w).includes('불러오는 중…'));
  await Promise.all([p1, p2]);
  const g = J(w.ctx.GR.gi);
  assert.equal(g.st, 'ok');
  assert.deepEqual(g.list.map((m) => m.uid), ['111', '108', '102', '101', '110'], '날짜 내림차순 · 연결(107)·46일 전(109)·보낸·첨부 없음·스팸·남의 주소 제외');
  assert.deepEqual(g.list.map((m) => m.coName), ['가나상사', '다라정밀', '다라정밀', '다라정밀', '다라정밀'], '두 업체에 걸린 111 은 먼저 적힌 가나상사 한 곳');
  assert.deepEqual(g.list.map((m) => m.typeName).slice(0, 2), ['기술보호 컨설팅', '충남북부 인사노무 컨설팅']);
  assert.deepEqual([g.more, g.noAddr, g.clipped], [false, 0, false]);
  const h = giHtml(w);
  assert.equal(countOf(h, /<li>/g), 5);
  assert.equal(countOf(h, /공동자료\.pdf/g), 1, '두 업체에 걸린 메일은 한 번만 나온다');
  ['받음 ← 공동 발신 · 2026-10-07 · 가나상사 · 기술보호 컨설팅', '받음 ← 다라정밀 담당 · 2026-10-05 · 다라정밀 · 충남북부 인사노무 컨설팅',
    '📎 공동자료.pdf', '📎 점검표.pdf', '📎 서명본.hwpx', '📎 확인서.pdf', '📎 경계.pdf', '두 업체 자료', '최신 점검표', '서명본 보내드립니다'].forEach((x) => assert.ok(h.includes(x), x));
  ['첨부 없음', '46일 전 자료', '기간 밖', '현장 사진', '다른 업체 주소', '자문 일지 회신', '보고서 초안 보내드립니다', '스팸'].forEach((x) => assert.ok(!h.includes(x), x + ' 가 나왔다'));
  const priv = liOf(h, '9월 급여대장.xlsx');
  assert.ok(priv.includes('<span class="st st-todo">개인 자료 · 목록에만</span>'), '개인 자료 딱지');
  assert.ok(priv.includes('서류 칸 열기'), '개인 자료도 칸 창으로 가는 단추는 낸다');
  assert.ok(!priv.includes('grOpenCand') && !priv.includes('grLinkCand'), '목록에서 연결·열어 보기는 하지 않는다');
  assert.ok(!h.includes('@'), '메일 주소는 그리지 않는다');
  assert.deepEqual(mailReads(w).slice().sort(), ['data/companies', 'mailbox/folders', 'mailbox/msgs/' + GI_SLUG, 'mailbox/msgs/Sent-1b2c3d4e'], '폴더 표 한 번 · 폴더마다 한 번 · 업체관리 한 번');
  assert.ok(h.includes('· 2026년 사업 기준</div>'), '어느 해 기준인지 머리에 적는다');
  assert.ok(h.includes('onclick="grGlobalInbox(true)">다시 확인</button>'), '「다시 확인」은 메일함을 새로 읽는 단추');
  const before = mailReads(w).length;
  await w.ctx.grGlobalInbox(); await w.ctx.grGlobalInbox();
  assert.equal(mailReads(w).length, before, '단추를 다시 눌러(인자 없음) 계산만 해서는 메일함을 다시 읽지 않는다');
  assert.equal(w.ctx.GR.gi.st, 'ok');
  assert.equal(w.db.쓴것.length, 0, '읽기만');
  /* 대조 — 107 의 link 가 없으면 107 도 나온다(위 목록에서 빠진 것은 «연결됨» 때문) */
  const w2 = giWorld({ seed: giSeed({ noLink: true }) });
  await w2.ctx.grLoad(); await w2.ctx.grGlobalInbox();
  assert.deepEqual(giList(w2).map((m) => m.uid), ['111', '108', '107', '102', '101', '110']);
});

test('111 안내 — 주소 없는 업체 N곳 · 31건 이상이면 30건만 · 폴더마다 최근 메일만(clipped)', async () => {
  const s = F.seed();   // 마바산업은 주소가 없다 + 아자공업을 더해 둘
  s.scal_cos.push({ id: 'c6', name: '아자공업', types: ['t4'], defAtt: 'a1' });
  s.scal_scheds.push({ id: 's20', coId: 'c6', typeId: 't4', date: '2026-09-01', round: 1, isField: true });
  for (let i = 0; i < 35; i++) {
    const n = String(i).padStart(3, '0');
    s.mailbox.msgs[GI_SLUG][400 + i] = { u: 400 + i, f: '다라정밀 담당', e: 'dara@example.com', t: 'office@pureun.kr', s: '일괄 ' + n, d: kst(10, 1) + i * 3600e3, a: 1, an: ['일괄' + n + '.pdf'] };
  }
  const w = giWorld({ seed: s });
  await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
  const g = J(w.ctx.GR.gi), h = giHtml(w);
  assert.equal(g.st, 'ok');
  assert.equal(g.list.length, 30);
  assert.equal(g.more, true);
  assert.equal(g.noAddr, 2, '마바산업·아자공업');
  assert.equal(countOf(h, /<li>/g), 30);
  assert.ok(h.includes('30건만 보입니다'));
  assert.ok(h.includes('메일 주소가 없는 업체 2곳은 건너뛰었습니다'));
  assert.ok(h.includes('일괄 034') && h.includes('일괄 005') && !h.includes('일괄 004'), '날짜 내림차순으로 위 30건');
  assert.ok(!h.includes(I.MSG.CLIPPED));
  /* 폴더마다 최근 메일만 읽는 한계에 닿으면 기존 안내 */
  const w2 = giWorld({ seed: giSeed() });
  vm.runInContext('GR_MAIL.per=2;', w2.ctx);
  await w2.ctx.grLoad(); await w2.ctx.grGlobalInbox();
  assert.equal(w2.ctx.GR.gi.clipped, true);
  assert.ok(giHtml(w2).includes(I.MSG.CLIPPED));
  /* 대조 — 안내가 없는 경우 */
  const w3 = giWorld({ seed: giSeed() });
  await w3.ctx.grLoad(); await w3.ctx.grGlobalInbox();
  assert.ok(!giHtml(w3).includes('30건만') && !giHtml(w3).includes('건너뛰었습니다') && !giHtml(w3).includes(I.MSG.CLIPPED));
});

test('112 비면 「연결할 새 받은 서류가 없습니다」 · 기록을 못 읽었으면 안내만(메일함 0회) · 메일함을 못 읽으면 오류 문구 + 「다시 시도」', async () => {
  const s = giSeed();
  Object.keys(s.mailbox.msgs).forEach((k) => { delete s.mailbox.msgs[k]; });
  s.mailbox.msgs[GI_SLUG] = { 1: { u: 1, f: '다라정밀 담당', e: 'dara@example.com', t: 'office@pureun.kr', s: '첨부 없음', d: kst(10, 5), a: 0 } };
  const w0 = giWorld({ seed: s });
  await w0.ctx.grLoad(); await w0.ctx.grGlobalInbox();
  assert.equal(w0.ctx.GR.gi.st, 'ok');
  assert.ok(giHtml(w0).includes('연결할 새 받은 서류가 없습니다') && !giHtml(w0).includes('<li>'));

  const w = giWorld({ fail: (p) => p.indexOf('scal_docs') === 0 });
  await w.ctx.grLoad();
  assert.equal(w.ctx.GR.trackErr, true, '준비 — 기록을 못 읽었다');
  await w.ctx.grGlobalInbox();
  assert.equal(w.ctx.GR.gi.st, 'err');
  const h = giHtml(w);
  assert.ok(h.includes('기록을 못 불러와 연결 여부를 알 수 없습니다'));
  assert.ok(!h.includes('연결할 새 받은 서류가 없습니다') && !h.includes('<li>'), '연결 여부를 모른 채 «새로 온 서류»라고 하지 않는다');
  assert.deepEqual(mailReads(w), [], '기록을 못 읽었으면 메일함도 읽지 않는다');
  assert.equal(w.db.쓴것.length, 0);

  let deny = true;
  const w2 = giWorld({ fail: (p) => deny && p.indexOf('mailbox') === 0 });
  await w2.ctx.grLoad(); await w2.ctx.grGlobalInbox();
  assert.equal(w2.ctx.GR.gi.st, 'err');
  assert.ok(giHtml(w2).includes(I.MSG.LOAD_FAIL) && giHtml(w2).includes('onclick="grGlobalInbox()">다시 시도'));
  deny = false;
  await w2.ctx.grGlobalInbox();
  assert.equal(w2.ctx.GR.gi.st, 'ok', '다시 시도하면 메일함을 다시 읽는다');
  assert.ok(giHtml(w2).includes('서명본 보내드립니다'));
});

test('113 「서류 칸 열기」 — 그 업체·사업의 칸 창이 열리고 받은 서류 후보에 같은 메일 · 사업을 대신 골라 준다(이미 고른 사업은 풀지 않는다)', async () => {
  const w = giWorld();
  await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
  const list = giList(w), at = (uid) => list.findIndex((m) => m.uid === uid);
  const i = at('108');
  assert.deepEqual([list[i].coId, list[i].typeId, list[i].step, list[i].erpCode], ['c2', 't3', 'sign', 'consulting-04']);
  assert.ok(giHtml(w).includes('onclick="grOpenFromInbox(' + i + ')">서류 칸 열기</button>'));
  assert.equal(w.ctx.GR.f.biz, '');
  w.ctx.grOpenFromInbox(i);
  let c = w.ctx.GR.cw;
  assert.deepEqual([c.coId, c.typeId, c.step, w.ctx.GR.f.biz], ['c2', 't3', 'sign', 'consulting-04']);
  await w.ctx.grLoadInbox();
  assert.ok(w.els.cwInbox.innerHTML.includes('최신 점검표'), '칸 창 받은 서류 후보에 같은 메일');
  w.ctx.grCloseCell();
  /* 이미 그 사업을 골랐으면 다시 눌러 풀어 버리지 않는다(grSetBiz 는 같은 사업을 다시 누르면 푼다) */
  assert.equal(w.ctx.GR.f.biz, 'consulting-04');
  w.ctx.grOpenFromInbox(i);
  assert.equal(w.ctx.GR.f.biz, 'consulting-04');
  assert.equal(w.ctx.GR.cw.coId, 'c2');
  w.ctx.grCloseCell();
  /* 다른 사업이 골라져 있으면 이 사업으로 바꾼다 — 기술보호(가나상사·기술보호 컨설팅)는 서명이 없어 제출 칸 */
  const j = at('111');
  assert.deepEqual([list[j].coId, list[j].typeId, list[j].step, list[j].erpCode], ['c1', 't1', 'submit', 'consulting-03']);
  w.ctx.grOpenFromInbox(j);
  c = w.ctx.GR.cw;
  assert.deepEqual([c.coId, c.typeId, c.step, w.ctx.GR.f.biz], ['c1', 't1', 'submit', 'consulting-03']);
  assert.ok(w.els.cwInbox.innerHTML.includes('두 업체 자료'), '칸 창 후보에 같은 메일(주소는 그 업체 계약 연락처로)');
  assert.ok(!w.els.cwInbox.innerHTML.includes('@'));
  assert.equal(w.db.쓴것.length, 0, '열기만으로는 쓰지 않는다');
  w.ctx.grOpenFromInbox(99); w.ctx.grOpenFromInbox(-1); w.ctx.grOpenFromInbox('x');   // 없는 번호는 아무 일도 없다
  assert.equal(w.ctx.GR.cw.coId, 'c1');
});

test('114 서류 틀에 서명·제출·별첨이 모두 없는 사업은 단추가 없다(업체·사업 이름만) · 같은 업체의 다른 사업은 먼저 적힌 쪽 하나에 붙는다 · 대형(일터혁신)도 열린다', async () => {
  const s = bigSeed();   // 다라정밀(c2)에 t3 충남북부(sign) · t2 일터혁신(대형, 참여 안내서 sign) · t5 산업일자리충남(대형, plat·report 뿐)
  const planNone = D.planFor('산업일자리전환컨설팅충남');
  ['sign', 'submit', 'attach'].forEach((st) => assert.equal(Tr.keysFor(planNone, st, 2).length, 0, '준비 — 충남 산업일자리 틀에는 ' + st + ' 가 없다'));
  assert.ok(Tr.keysFor(D.planFor(WP), 'sign', 2).length > 0, '준비 — 일터혁신 틀에는 서명(참여 안내서)이 있다');
  const w = giWorld({ seed: s });
  await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
  const list = giList(w);
  assert.deepEqual(list.map((m) => m.uid), ['107', '102', '101'], '준비 — 다라정밀 메일 셋이 진짜로 이어졌다');
  assert.ok(list.length >= 3 && list.every((m) => m.coId === 'c2'));
  assert.equal(new Set(list.map((m) => m.uid)).size, list.length, '같은 메일은 한 번씩');
  assert.ok(list.every((m) => m.typeId === 't5' && m.step === '' && m.erpCode === 'consulting-06'), '한글 순서로 먼저인 산업일자리 쪽 하나에만 붙고 단추 없는 사업이다');
  const h = giHtml(w);
  assert.ok(!h.includes('grOpenFromInbox') && !h.includes('서류 칸 열기'), '단추 없음');
  assert.ok(h.includes('다라정밀 · 산업일자리전환 컨설팅(충남)'), '업체·사업 이름은 보인다');
  w.ctx.grOpenFromInbox(0);
  assert.equal(w.ctx.GR.cw, null, '단추가 없으니 눌러도 열리지 않는다');
  /* 산업일자리를 빼면 일터혁신(대형) 쪽 하나에 붙고 서명 칸으로 열린다 */
  const s2 = bigSeed();
  s2.scal_cos.filter((c) => c.id === 'c2')[0].types = ['t3', 't2'];
  const w2 = giWorld({ seed: s2 });
  await w2.ctx.grLoad(); await w2.ctx.grGlobalInbox();
  const l2 = giList(w2);
  assert.ok(l2.length >= 3 && l2.every((m) => m.typeId === 't2' && m.step === 'sign' && m.erpCode === 'consulting-02'));
  w2.ctx.grOpenFromInbox(0);
  const c = w2.ctx.GR.cw;
  assert.deepEqual([c.coId, c.typeId, c.step, w2.ctx.GR.f.biz], ['c2', 't2', 'sign', 'consulting-02']);
  assert.equal(w2.db.쓴것.length, 0);
});

test('115 바깥 값은 이스케이프 — 업체·사업·보낸이·메일 제목·첨부 이름에 <script>·따옴표 · 쓰기 0', async () => {
  const CO = '다라<img src=x onerror=alert(1)>"\'&정밀', TY = '충남<b>북부</b>"\'&', FROM = '<i>보낸이</i>"\'', SUBJ = '<script>alert("s")</script>\'', ATT = '<svg onload=alert(1)>"\'.pdf';
  const s = giSeed();
  s.scal_cos.filter((c) => c.id === 'c2')[0].name = CO;
  s.scal_types.filter((t) => t.id === 't3')[0].fullName = TY;
  s.data.companies.v.filter((c) => c.id === 'm2')[0].name = CO;
  Object.assign(s.mailbox.msgs[GI_SLUG][108], { f: FROM, s: SUBJ, a: 1, an: [ATT] });
  const w = giWorld({ seed: s });
  await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
  const list = giList(w), m = list.filter((x) => x.uid === '108')[0];
  assert.ok(m, '준비 — 위험한 이름의 업체가 진짜로 이어졌다');
  assert.deepEqual([m.coName, m.typeName, m.who, m.s, m.atts[0].name], [CO, TY, FROM, SUBJ, ATT]);
  const h = giHtml(w), e = w.ctx.grEsc;
  [CO, TY, FROM, SUBJ, ATT].forEach((x) => assert.ok(h.includes(e(x)), '이스케이프된 글이 보인다: ' + x));
  assert.doesNotMatch(h, /<(script|img|b|i|svg)\b/, '꺼낸 태그가 없다');
  assert.ok(!h.includes('onerror=alert(1)>') && !h.includes('onload=alert(1)>'));
  assert.equal(countOf(h, /"/g) % 2, 0, '속성 따옴표가 짝지어 있다');
  w.ctx.grOpenFromInbox(list.findIndex((x) => x.uid === '108'));
  assert.equal(w.ctx.GR.cw.coName, CO);
  assert.equal(w.db.쓴것.length, 0, '쓰기 0');
});

test('116 목록에서 연 칸 창은 그 메일이 쌍의 기본 기간 밖이어도 보이게 기간을 넓힌다 · 보통 열기는 기본 기간 그대로 · 창 안 다른 메일은 그대로', async () => {
  const s = giSeed();
  s.data.companies.v.push({ id: 'm3', name: '마바산업', email: 'mava@example.com' });
  const box = s.mailbox.msgs[GI_SLUG];
  box[120] = { u: 120, f: '마바 담당', e: 'mava@example.com', t: 'office@pureun.kr', s: '늦게 온 자료', d: kst(10, 1), a: 1, an: ['늦은자료.pdf'] };
  box[121] = { u: 121, f: '마바 담당', e: 'mava@example.com', t: 'office@pureun.kr', s: '6월 자료', d: kst(6, 1), a: 1, an: ['유월.pdf'] };
  const base = I.windowOf('2026-03-03', '2026-05-12');   // 마바산업 t4 의 첫·끝 회차
  assert.equal(base.to, '2026-08-10');
  assert.ok(Math.round((Date.UTC(2026, 9, 1) - Date.UTC(2026, 4, 12)) / 864e5) >= 120, '준비 — 끝 회차 120일 뒤 메일');
  const w = giWorld({ seed: s });
  await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
  const list = giList(w), i = list.findIndex((m) => m.uid === '120');
  assert.ok(i >= 0, '준비 — 전역 목록에 올라 있다(45일 안)');
  assert.deepEqual([list[i].coId, list[i].typeId, list[i].step], ['c3', 't4', 'sign']);
  assert.ok(!list.some((m) => m.uid === '121'), '준비 — 6월 메일은 45일 밖이라 목록에 없다');
  w.ctx.grOpenFromInbox(i);
  const c = w.ctx.GR.cw;
  assert.deepEqual([c.coId, c.typeId, J(c.win)], ['c3', 't4', { from: base.from, to: '2026-10-01' }], '기간 끝만 메일 날짜로 넓힌다');
  const h = w.els.cwInbox.innerHTML;
  assert.ok(h.includes('늦게 온 자료') && h.includes('📎 늦은자료.pdf'), '칸 창 후보에 그 메일');
  assert.ok(h.includes('6월 자료'), '창 안의 다른 메일은 그대로');
  assert.equal(w.db.쓴것.length, 0);
  /* 보통 열기(목록 밖) — 기본 기간 그대로, 기간 밖 메일은 안 보인다 */
  w.ctx.grCloseCell();
  w.ctx.grOpenCell('c3', 't4', 'sign', '');
  assert.deepEqual(J(w.ctx.GR.cw.win), base);
  const h2 = w.els.cwInbox.innerHTML;
  assert.ok(!h2.includes('늦게 온 자료') && h2.includes('6월 자료'));
  /* 기간 안 메일(다라정밀 108)은 기간을 건드리지 않는다 */
  const j = list.findIndex((m) => m.uid === '108');
  w.ctx.grCloseCell(); w.ctx.grOpenFromInbox(j);
  assert.deepEqual(J(w.ctx.GR.cw.win), J(I.windowOf('2026-08-10', '2026-09-14')));
  assert.equal(w.db.쓴것.length, 0);
});

/* ══ 전역 「📥 받은 서류 확인」 검토 반영(2026-10-12) — 연도·연결 뒤 다시 계산·계산 중 오류·다시 확인·보낸이 주소 ══ */
test('117 연도를 바꾸면 목록은 처음 상태로 돌아가고, 옛 연도 항목은 눌러도 열리지 않는다(엉뚱한 해의 칸 창 없음)', async () => {
  const w = giWorld();
  await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
  const list = giList(w), i = list.findIndex((m) => m.uid === '108');
  assert.ok(i >= 0, '준비 — 목록에 올라 있다');
  assert.equal(w.ctx.GR.gi.year, '2026');
  assert.ok(list.every((m) => m.year === '2026'), '항목마다 계산한 연도를 담는다');
  /* 연도 거르개만 바뀐 채(처음 상태로 돌리기 전) 눌러도 — 거절하고 안내 */
  w.ctx.GR.f.year = '2025';
  w.ctx.grOpenFromInbox(i);
  assert.equal(w.ctx.GR.cw, null, '칸 창이 열리지 않는다');
  assert.equal(w.ctx.GR.f.biz, '', '사업도 고르지 않는다');
  assert.equal(w.ctx.GR.gi.st, 'idle');
  const h = giHtml(w);
  assert.ok(h.includes('연도를 바꿨습니다 — 다시 확인해 주세요') && !h.includes('<li>'));
  assert.match(h, /onclick="grGlobalInbox\(\)">📥 확인<\/button>/);
  /* 그 해로 다시 확인하면 그 해 기준 */
  await w.ctx.grGlobalInbox();
  assert.equal(w.ctx.GR.gi.st, 'ok');
  assert.equal(w.ctx.GR.gi.year, '2025');
  assert.ok(giHtml(w).includes('2025년 사업 기준') && !giHtml(w).includes('최신 점검표'), '2026년 쌍의 메일은 2025년 기준에 없다');
  assert.equal(w.db.쓴것.length, 0);
  /* 거르개 풀기(grReset)로 해가 바뀌어도 처음 상태 · 해가 그대로면 목록을 지키지 않고 지우지도 않는다 */
  const w2 = giWorld();
  await w2.ctx.grLoad(); await w2.ctx.grGlobalInbox();
  w2.ctx.grReset();
  assert.equal(w2.ctx.GR.gi.st, 'ok', '해가 같으면 그대로');
  w2.ctx.GR.f.year = '2025'; w2.ctx.grReset();
  assert.equal(w2.ctx.GR.gi.st, 'idle', '해가 바뀌면 처음 상태');
});

test('118 칸 창에서 「연결」하면 메일함을 다시 읽지 않고 목록이 다시 계산된다 — 연결한 메일은 빠지고, 「연결 지우기」하면 돌아온다', async () => {
  const w = giWorld({ email: 'p009@pureun.kr' });
  await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
  const reads = mailReads(w).length;
  let list = giList(w);
  const i = list.findIndex((m) => m.uid === '108');
  assert.ok(i >= 0 && giHtml(w).includes('최신 점검표'), '준비 — 목록에 M(108)이 있다');
  w.ctx.grOpenFromInbox(i);
  const k = w.ctx.GR.cw.cands.findIndex((m) => m.uid === '108');
  assert.ok(k >= 0, '준비 — 칸 창 후보에도 같은 메일');
  w.els.cwSt.value = 'doing'; w.els.cwSent.value = '2026-09-20';
  await w.ctx.grLinkCand(k, 0);
  assert.equal(w.db.쓴것.length, 1); onlyTrackWrites(w.db);
  assert.equal(w.db.쓴것[0].값.link.key, 'i:' + GI_SLUG + ':108');
  list = giList(w);
  assert.deepEqual(list.map((m) => m.uid), ['111', '102', '101', '110'], '연결한 108 만 빠진다');
  assert.ok(!giHtml(w).includes('최신 점검표') && giHtml(w).includes('두 업체 자료'));
  assert.equal(w.ctx.GR.gi.st, 'ok');
  assert.equal(mailReads(w).length, reads, '메일함을 다시 읽지 않았다');
  await w.ctx.grUnlink();
  assert.deepEqual(giList(w).map((m) => m.uid), ['111', '108', '102', '101', '110'], '연결을 지우면 다시 나온다');
  assert.equal(mailReads(w).length, reads);
  /* 목록을 만들기 전(idle)에 저장해도 목록을 만들지 않는다 */
  const w2 = giWorld({ email: 'p009@pureun.kr' });
  await w2.ctx.grLoad();
  w2.ctx.grSetBiz('consulting-04'); w2.ctx.grOpenCell('c2', 't3', 'sign');
  w2.els.cwSt.value = 'doing'; w2.els.cwSent.value = '2026-09-20';
  await w2.ctx.grSaveCell();
  assert.equal(w2.ctx.GR.gi.st, 'idle', '칸 창을 직접 열어 저장해도 전역 목록은 만들어지지 않는다');
});

test('119 계산 중 예상 밖 오류가 나도 «불러오는 중»에 멈추지 않는다 — 오류 문구 + 「다시 시도」 · 고치면 다시 된다 · 연결 뒤 다시 계산이 던져도 오류 상태', async () => {
  const w = giWorld();
  await w.ctx.grLoad();
  const orig = D.pairs;
  D.pairs = () => { throw new Error('boom'); };
  try { await w.ctx.grGlobalInbox(); } finally { D.pairs = orig; }
  assert.equal(w.ctx.GR.gi.st, 'err');
  assert.ok(giHtml(w).includes('받은 서류를 확인하지 못했습니다') && giHtml(w).includes('onclick="grGlobalInbox()">다시 시도'));
  assert.ok(!giHtml(w).includes('불러오는 중'));
  await w.ctx.grGlobalInbox();
  assert.equal(w.ctx.GR.gi.st, 'ok', '다시 시도하면 된다');
  D.pairs = () => { throw new Error('boom'); };
  try { w.ctx.grGlobalRefresh(); } finally { D.pairs = orig; }
  assert.equal(w.ctx.GR.gi.st, 'err');
  assert.equal(w.db.쓴것.length, 0);
});

test('120 「다시 확인」은 메일함을 새로 읽는다 — 그 사이 새로 온 메일이 나온다(그냥 단추는 읽은 것을 쓴다)', async () => {
  const w = giWorld();
  await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
  assert.ok(!giList(w).some((m) => m.uid === '112'));
  await w.db.ref('mailbox/msgs/' + GI_SLUG + '/112').set({ u: 112, f: '다라정밀 담당', e: 'dara@example.com', t: 'office@pureun.kr', s: '새로 온 자료', d: kst(10, 9), a: 1, an: ['새것.pdf'] });
  w.db.쓴것.length = 0;   // 검사 준비로 넣은 메일 — 화면의 쓰기가 아니다
  await w.ctx.grGlobalInbox();
  assert.ok(!giList(w).some((m) => m.uid === '112'), '읽은 것을 다시 쓸 뿐이다');
  const before = mailReads(w).length;
  await w.ctx.grGlobalInbox(true);
  assert.equal(giList(w)[0].uid, '112', '새로 읽어 맨 위에 나온다');
  assert.equal(mailReads(w).length - before, 4, '폴더 표·폴더 둘·업체관리를 다시 읽는다');
  assert.equal(w.db.쓴것.length, 0);
});

test('121 보낸이 표시이름이 없으면(거울이 주소를 대신 넣는다) 주소를 그리지 않고 「(보낸이 이름 없음)」', async () => {
  const s = giSeed();
  s.mailbox.msgs[GI_SLUG][112] = { u: 112, f: '', e: 'dara@example.com', t: 'office@pureun.kr', s: '이름 없는 보낸이', d: kst(10, 9), a: 1, an: ['익명.pdf'] };
  const w = giWorld({ seed: s });
  await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
  const m = giList(w).filter((x) => x.uid === '112')[0];
  assert.ok(m && m.who === 'dara@example.com', '준비 — 거울이 주소를 표시이름 자리에 넣었다');
  const h = giHtml(w);
  assert.ok(h.includes('받음 ← (보낸이 이름 없음) · 2026-10-09 · 다라정밀'));
  assert.ok(!h.includes('@'), '주소는 그리지 않는다');
});

/* ══ 연도 막대 · 사업이름 (수행기관) 목록 · 사업 종결 (2026-10-12) — 계획 docs/superpowers/plans/2026-10-12-gov-report-nav-closed.md Task 3 ══
   합성 씨앗(navSeed)은 «진짜로 이어지게» 짠다 — 아래 122·123 이 묶음 배정과 업체 수를 직접 확인한다(이어지지 않으면 그 검사가 깨진다).
   오늘 = 2026-10-10 · 2026년 업체: 02(가나상사 1)·03(가나상사 1)·04(다라정밀 1)·05(마바산업 1)·14(자차금속 1)·15(자차금속 1) — 2025년은 03(사아테크 1) 뿐
   01 현장클리닉(일정 사업 t9 = 없음)·06·07·09·10 은 연결 없음 · 12 농촌융복합시험사업(서류 틀 있음, 업체 없음) · 13 가나기획자문(서류 틀 없음)
   14·15 는 이름이 같고 기관만 다르다(가기관·나기관) */
function navSeed(o) {
  o = o || {};
  const s = F.seed();
  s.scal_types.push({ id: 't5', name: '농촌 시험', fullName: '', agency: '', rounds: 1 }, { id: 't6', name: '기획 시험', fullName: '', agency: '', rounds: 1 },
    { id: 't7', name: '혁신 시험 가', fullName: '', agency: '', rounds: 1 }, { id: 't8', name: '혁신 시험 나', fullName: '', agency: '', rounds: 1 });
  s.scal_cos.push({ id: 'c7', name: '자차금속', types: ['t7', 't8'], defAtt: 'a1' });
  s.scal_scheds.push({ id: 's30', coId: 'c7', typeId: 't7', date: '2026-06-01', round: 1, isField: true },
    { id: 's31', coId: 'c7', typeId: 't8', date: '2026-06-08', round: 1, isField: true });
  const nm = (code, name, agency) => ({ code, name, short: '', agency, sortOrder: +code.slice(-2) });
  s.data.biz_cons_types.v.push(nm('consulting-12', '농촌융복합시험사업', '가기관'), nm('consulting-13', '가나기획자문', ''),
    nm('consulting-14', o.hostile ? '<script>alert(1)</script>가' : '일터혁신 같은이름', o.hostile ? '"><img src=x onerror=1>' : '가기관'),
    nm('consulting-15', o.hostile ? '<img src=x onerror=2>나' : '일터혁신 같은이름', o.hostile ? "'><svg onload=3>" : '나기관'));
  Object.assign(s.scal_erpTypeMap, { 'consulting-12': o.twin ? 't1' : 't5', 'consulting-13': 't6', 'consulting-14': 't7', 'consulting-15': 't8' });
  return s;
}
const CLOSED05 = { 'consulting-05': { closedFrom: '2026', closedAt: '2026-09-30', reason: '사업 기간 끝남', by: '홍길동', at: 1760000000000 } };
/* o.state = 처음부터 DB 에 있는 종결 표시 · o.denyRead / o.denyWrite = 규칙 거절 흉내 · 쓰기·지우기는 w.db.쓴것 에 남는다 */
function navWorld(o) {
  o = o || {};
  const s = o.seed || navSeed(o.seedOpt);
  if (o.state !== undefined) s.scal_bizState = o.state;
  const paths = [];
  const w = world({ seed: s, email: o.email === undefined ? 'p009@pureun.kr' : o.email, db: (db) => ({ ref: (p) => {
    paths.push(p);
    const r = db.ref(p);
    if (p.indexOf('scal_bizState') !== 0) return r;
    if (o.denyRead && p === 'scal_bizState') return { once: async () => { throw new Error('permission_denied'); } };
    if (o.denyWrite) return { once: r.once, set: async () => { throw new Error('permission_denied'); }, remove: async () => { throw new Error('permission_denied'); } };
    return r;
  } }) });
  w.paths = paths;
  ['cm', 'cmDay', 'cmWhy', 'cmFromY', 'cmFromA'].forEach((id) => w.ctx.$(id));   // 진짜 DOM 에서는 종결 창 입력이 그리는 대로 생긴다(칸 창 입력과 같은 흉내)
  return w;
}
const grpOf = (h, k) => { const i = h.indexOf('data-grp="' + k + '"'); if (i < 0) return ''; return h.slice(i, h.indexOf('</details>', i)); };
const openSec = (h) => h.slice(0, h.indexOf('<details'));
const kpiN = (w, st) => (w.els.kpis.innerHTML.match(new RegExp('data-st="' + st + '"[^>]*><b>([^<]*)</b>')) || [])[1];
const alertN = (w, head) => (w.els.alerts.innerHTML.match(new RegExp(head + ' <b>([^<]*)</b>')) || [])[1];
const bizBtn = (h, code) => { const i = h.indexOf('data-biz="' + code + '"'); return i < 0 ? '' : h.slice(i, h.indexOf('</button>', i)); };
const FAIL = '저장하지 못했습니다 — 관리자만 종결할 수 있습니다(규칙 게시 또는 권한 확인)';

test('122 정적 — 새 쓰기 길은 scal_bizState 한 곳(종결 .set · 되돌림 표시 .set — .remove 없음) · 나머지 쓰기 명령은 없다 · 연도 막대는 숫자 칸 위 · 종결 창 자리 · 보이지 않는 #fYear', () => {
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES, '서류 줄 .set · 종결 .set · 되돌림 표시 .set · 사업 순서 .set · 자동 처리 모드 .set — 이 차례 그대로');
  assert.doesNotMatch(SRC, /\.remove\s*\(/, 'gov-report.html 어디에도 .remove( 가 없다(저장 관문이 물리적 삭제를 막는다)');
  assert.doesNotMatch(INLINE, /\.(update|transaction)\s*\(|ref\([^)]*\)\.push\(/, '그 밖의 쓰기 명령이 있다');
  assert.match(SRC, /var GR_BIZ=\{node:'scal_bizState',code:\/\^\[A-Za-z0-9_-\]\{1,40\}\$\/,/, '규칙의 열쇠 꼴과 같은 점검');
  const c = grab('grCloseBiz'), r = grab('grReopenBiz');
  assert.match(c, /fbDb\.ref\(GR_BIZ\.node\+'\/'\+code\)\.set\(entry\)/);
  assert.match(r, /fbDb\.ref\(GR_BIZ\.node\+'\/'\+code\)\.set\(entry\)/);
  assert.match(r, /closeEntry\(\{from:N\.NEVER_FROM,/, '되돌림 표시는 Nav.closeEntry 로 만든다');
  [c, r].forEach((src, i) => assert.equal((src.match(/ref\(/g) || []).length, 1, ['grCloseBiz', 'grReopenBiz'][i] + ' 은 scal_bizState 한 길만 쓴다'));
  assert.doesNotMatch(c + r, /scal_docs|GR_TRACK_NODES|GR_NODES|GR_DOC_NODES/, '다른 자리를 쓰지 않는다');
  assert.match(grab('grLoadBizState'), /fbDb\.ref\(GR_BIZ\.node\)\.once\('value'\)/, '읽기는 통째 한 번');
  assert.ok(SRC.indexOf('id="yrbar"') > 0 && SRC.indexOf('id="yrbar"') < SRC.indexOf('id="kpis"'), '연도 막대는 숫자 칸 위(가운데 열 맨 위)');
  assert.match(SRC, /<select id="fYear" aria-label="연도" style="display:none"><\/select>/, '기존 거르개는 보이지 않게 두고 값만 맞춘다');
  assert.match(SRC, /<div id="cm" class="toc" style="display:none"><\/div>/);
  assert.match(grab('grRender'), /grRenderYearBar\(\)/);
  assert.match(grab('grRenderKpis'), /grLive\(/); assert.match(grab('grView'), /grLive\(/);
  assert.match(grab('grRenderAlerts'), /grClosedTypes\(/); assert.match(grab('grGlobalCompute'), /grClosedTypes\(/);
  assert.match(grab('grLoad'), /await grLoadDocs\(\);[\s\S]*await grLoadBizState\(\);[\s\S]*await grLoadTrack\(\);/, '왼쪽 자료 다음 · 서류 기록 앞에서 한 번');
  ['grClosedTypes', 'grLive', 'grRenderYearBar', 'grRenderBiz', 'grBizBtn', 'grRenderCm', 'grClosedBanner', 'grLoadBizState'].forEach((n) =>
    assert.doesNotMatch(grab(n).replace(/fbDb\.ref\(GR_BIZ\.node\)\.once\('value'\)/, ''), /fbDb|\.set\(|\.update\(|\.remove\(|\.transaction\(|fetch\(/, n + ' 에 쓰기가 있다'));
  assert.match(SRC, /\$\('yrbar'\)\.addEventListener\('click'/);
  assert.match(SRC, /data-close onclick="grCloseCm\(\)">닫기<\/button>/, '창은 PuBack 이 닫을 수 있게 data-close');
});

test('123 왼쪽 목록 — 진행 사업 · 접는 묶음(업체 없음·서류 틀 없음·연결 없음·종결) · «이름 (기관)» 두 줄 · 기관 없음은 「기관 미지정」 · 이름 같고 기관 다른 두 사업이 구분된다 · 업체 수', async () => {
  const w = navWorld({ state: CLOSED05 });
  await w.ctx.grLoad();
  const h = w.els.biz.innerHTML, op = openSec(h);
  /* 전제 — 합성 씨앗이 진짜로 이어진다(Nav.build 가 같은 묶음을 낸다) */
  const m = J(Nav.build({ biz: w.ctx.GR.docs.biz, tmap: w.ctx.GR.docs.tmap, input: w.ctx.GR.input, year: '2026', state: w.ctx.GR.bizState }));
  assert.deepEqual(m.open.map((x) => x.code), ['consulting-02', 'consulting-03', 'consulting-04', 'consulting-14', 'consulting-15']);
  assert.deepEqual([m.quiet.map((x) => x.code), m.noPlan.map((x) => x.code), m.closed.map((x) => x.code)],
    [['consulting-12'], ['consulting-13'], ['consulting-05']]);
  assert.ok(m.unlinked.length >= 5 && m.unlinked.every((x) => !x.typeId));
  /* 묶음과 차례 */
  const at = (s) => { const i = h.indexOf(s); assert.ok(i >= 0, s); return i; };
  assert.ok(at('진행 사업') < at('data-grp="quiet"') && at('data-grp="quiet"') < at('data-grp="noPlan"') && at('data-grp="noPlan"') < at('data-grp="unlinked"') && at('data-grp="unlinked"') < at('data-grp="closed"'));
  ['업체 없음 <span class="bz-k">1</span>', '서류 틀 없음 <span class="bz-k">1</span>', '정부사업일정에 사업 없음 <span class="bz-k">', '🗄 종결 사업 <span class="bz-k">1</span>']
    .forEach((x) => assert.ok(h.includes(x), x));
  assert.ok(op.includes('<span>진행 사업 <b>5</b></span><span>업체 <b>5</b></span>'), '요약 줄(진행 사업 N · 업체 M) — 이전의 «진행 사업 <bz-k>5» 머리를 대신한다');
  /* 항목 두 줄 */
  assert.match(bizBtn(h, 'consulting-02'), /^data-biz="consulting-02"[^>]*>.*?<span class="bz-cn">일터상생혁신컨설팅<\/span>.*?<span class="bz-ca">\(기관 미지정\)<\/span>.*?<b>1<\/b>/, '기관이 비면 (기관 미지정)');
  assert.match(bizBtn(h, 'consulting-03'), /<span class="bz-cn">통합기술보호지원단<\/span><span class="bz-k">간단형<\/span><\/span><span class="bz-ca">\(비즈니스지원단\(중기청\)\)<\/span><span class="bz-row"><span class="bz-co">업체 <b>1<\/b>곳<\/span>/);
  ['consulting-02', 'consulting-03', 'consulting-04', 'consulting-14', 'consulting-15'].forEach((c) => assert.ok(op.includes('data-biz="' + c + '"'), c + ' 는 진행 사업'));
  assert.ok(!op.includes('data-biz="consulting-05"'), '종결 사업은 진행 사업에 없다');
  assert.ok(grpOf(h, 'quiet').includes('data-biz="consulting-12"') && bizBtn(h, 'consulting-12').includes('<b>0</b>'), '업체 없음 묶음 · 업체 수 0');
  assert.ok(grpOf(h, 'noPlan').includes('data-biz="consulting-13"') && bizBtn(h, 'consulting-13').includes('<span class="bz-k">' + D.NO_PLAN + '</span><b>0</b>'), '서류 틀 없음 묶음');
  assert.ok(grpOf(h, 'unlinked').includes('data-biz="consulting-01"') && bizBtn(h, 'consulting-01').includes('ERP 연결에 이 사업이 없습니다'), '연결 없음 묶음 · 안내 title');
  /* 이름이 같고 기관만 다른 두 사업 */
  const same = '<span class="bz-cn">일터혁신 같은이름</span>';
  assert.equal(countOf(h, new RegExp(same, 'g')), 2, '같은 이름이 두 카드');
  assert.ok(bizBtn(h, 'consulting-14').includes(same + '<span class="bz-k">') && bizBtn(h, 'consulting-14').includes('<span class="bz-ca">(가기관)</span>')
    && bizBtn(h, 'consulting-15').includes(same) && bizBtn(h, 'consulting-15').includes('<span class="bz-ca">(나기관)</span>'));
  assert.notEqual(bizBtn(h, 'consulting-14').match(/title="[^"]*"/)[0], bizBtn(h, 'consulting-15').match(/title="[^"]*"/)[0], 'title 도 다르다');
  /* 종결 사업 — 눌러 고를 수 있는 단추 · 흐린 글 · YYYY-MM 종결 */
  assert.match(grpOf(h, 'closed'), /<button type="button" class="bz cl" data-biz="consulting-05"[^>]*>.*?<span class="bz-nm">인사노무컨설팅서산<\/span><span class="bz-ag">\(서산상공회의소\)<\/span>.*?<span class="bz-d">2026-09 종결<\/span>/);
  assert.ok(!/<details[^>]* open/.test(h), '묶음은 접혀 있다');
  assert.equal(w.db.쓴것.length, 0, '읽기만');
  assert.equal(w.paths.filter((p) => p === 'scal_bizState').length, 1, '종결 표시는 한 번만 읽는다');
});

test('123-2 목록에서 사업을 누르면 거르고(고른 사업이 든 묶음은 펼친다) 다시 누르면 풀린다 · 묶음 머리는 펼침·접힘을 기억한다 · 이상한 묶음 이름은 무시', async () => {
  const w = navWorld({ state: CLOSED05 });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-03');
  let h = w.els.biz.innerHTML;
  assert.ok(w.els.rows.innerHTML.includes('가나상사') && !w.els.rows.innerHTML.includes('다라정밀') && !w.els.rows.innerHTML.includes('마바산업'));
  assert.match(h, /class="bz bz-card on" data-biz="consulting-03"/);
  w.ctx.grSetBiz('consulting-03');
  assert.ok(w.els.rows.innerHTML.includes('다라정밀'), '다시 누르면 풀린다');
  /* 종결 사업을 고르면 그 묶음이 펼쳐지고 행이 보인다 */
  w.ctx.grSetBiz('consulting-05');
  h = w.els.biz.innerHTML;
  assert.match(h, /<details class="bz-g off" open><summary class="bz-t" data-grp="closed">/);
  assert.match(grpOf(h, 'closed'), /class="bz on cl" data-biz="consulting-05"/);
  assert.ok(w.els.rows.innerHTML.includes('마바산업'), '종결 사업을 골랐을 때는 그 행이 보인다');
  w.ctx.grSetBiz('consulting-05');
  /* 묶음 머리 */
  w.ctx.grToggleBizGrp('quiet');
  assert.match(w.els.biz.innerHTML, /<details class="bz-g off" open><summary class="bz-t" data-grp="quiet">/);
  w.ctx.grSetBiz('consulting-03'); w.ctx.grSetBiz('consulting-03');   // 다시 그려도 기억한다
  assert.match(w.els.biz.innerHTML, /<details class="bz-g off" open><summary class="bz-t" data-grp="quiet">/);
  w.ctx.grToggleBizGrp('quiet');
  assert.doesNotMatch(w.els.biz.innerHTML, /<details class="bz-g off" open><summary class="bz-t" data-grp="quiet">/);
  const before = JSON.stringify(w.ctx.GR.bzOpen);
  ['__proto__', 'constructor', 'open', '', undefined].forEach((k) => w.ctx.grToggleBizGrp(k));
  assert.equal(JSON.stringify(w.ctx.GR.bzOpen), before, '목록에 없는 묶음 이름은 무시');
  assert.equal(w.db.쓴것.length, 0);
});

test('124 연도 막대 — 연도 버튼이 보이지 않는 #fYear 와 같은 상태 · 누르면 그 해 기준(왼쪽 목록·숫자 칸·표) · 작은 글 = 그 해 업체 수(종결 사업 제외)', async () => {
  const w = navWorld({ state: CLOSED05 });
  await w.ctx.grLoad();
  let y = w.els.yrbar.innerHTML;
  assert.match(y, /<button type="button" class="on" data-yr="2026" aria-pressed="true" title="[^"]*">2026<small>5곳<\/small><\/button>/, '종결(05)을 뺀 5곳');
  assert.match(y, /<button type="button" class="" data-yr="2025" aria-pressed="false" title="[^"]*">2025<small>1곳<\/small><\/button>/, '2025 는 05 가 아직 진행 — 03 한 곳');
  assert.ok(y.indexOf('data-yr="2026"') < y.indexOf('data-yr="2025"'), '최신 연도가 앞');
  assert.equal(w.els.fYear.value, '2026');
  /* 대조 — 종결 표시가 없으면 2026 은 6곳(05 포함) */
  const n = navWorld({ state: {} });
  await n.ctx.grLoad();
  assert.match(n.els.yrbar.innerHTML, /data-yr="2026"[^>]*>2026<small>6곳<\/small>/);
  /* 누르면 */
  w.ctx.grSetYear('2025');
  assert.equal(w.ctx.GR.f.year, '2025');
  assert.equal(w.els.fYear.value, '2025', '보이지 않는 거르개도 같은 값');
  assert.ok(w.els.fYear.innerHTML.includes('<option value="2025" selected>2025년</option>'));
  assert.match(w.els.yrbar.innerHTML, /class="on" data-yr="2025"/);
  assert.match(w.els.yrbar.innerHTML, /class="" data-yr="2026"/);
  assert.equal(kpiN(w, ''), '1', '숫자 칸이 2025 기준');
  assert.ok(w.els.rows.innerHTML.includes('사아테크') && !w.els.rows.innerHTML.includes('가나상사'));
  const h = w.els.biz.innerHTML;
  assert.deepEqual([...openSec(h).matchAll(/data-biz="([^"]+)"/g)].map((x) => x[1]), ['consulting-03'], '2025 에 업체가 있는 사업은 03 하나');
  assert.ok(grpOf(h, 'quiet').includes('data-biz="consulting-02"') && grpOf(h, 'quiet').includes('data-biz="consulting-05"'), '나머지는 업체 없음으로');
  assert.ok(!grpOf(h, 'closed'), '05 의 종결은 2026 부터 — 2025 에는 종결 묶음이 없다');
  w.ctx.grSetYear('2025');   // 같은 해는 그대로
  assert.equal(w.ctx.GR.f.year, '2025');
  w.ctx.grSetYear('');   // 이상한 값은 무시
  assert.equal(w.ctx.GR.f.year, '2025');
  /* 옛 거르개(#fYear 의 change)와 같은 상태 — 고치는 길이 둘이어도 어긋나지 않는다 */
  w.ctx.GR.f.year = '2026'; w.ctx.grRender();
  assert.equal(w.els.fYear.value, '2026');
  assert.match(w.els.yrbar.innerHTML, /class="on" data-yr="2026"/);
  assert.equal(w.db.쓴것.length, 0);
});

test('124-2 종결 사업은 숫자 칸·현황판 줄에서 빠진다(고른 사업이 종결이면 보인다) · 연도 막대·상태를 못 읽었을 때·연도가 비었을 때도 던지지 않는다', async () => {
  const base = navWorld({ state: {} });
  await base.ctx.grLoad();
  assert.deepEqual([kpiN(base, ''), kpiN(base, 'todo')], ['3', '1']);
  assert.ok(base.els.rows.innerHTML.includes('마바산업'));
  const w = navWorld({ state: CLOSED05 });
  await w.ctx.grLoad();
  assert.deepEqual([kpiN(w, ''), kpiN(w, 'todo')], ['2', '0'], '05 의 마바산업(미작성)이 숫자에서 빠진다');
  assert.ok(!w.els.rows.innerHTML.includes('마바산업') && w.els.rows.innerHTML.includes('가나상사') && w.els.rows.innerHTML.includes('다라정밀'));
  w.ctx.grSetStatus('submitted');   // 서명·제출 거름도 같은 길
  assert.ok(!w.els.rows.innerHTML.includes('마바산업'), '제출 완료 = 마바산업 하나였다 — 종결이라 빠진다');
  w.ctx.grSetStatus('submitted');
  /* 종결 사업을 골랐을 때 */
  w.ctx.grSetBiz('consulting-05');
  assert.deepEqual([kpiN(w, ''), kpiN(w, 'todo')], ['1', '1'], '고른 종결 사업의 숫자는 보인다');
  assert.ok(w.els.rows.innerHTML.includes('마바산업') && !w.els.rows.innerHTML.includes('가나상사'));
  /* 연도가 비면 종결로 보지 않는다 — 던지지 않는다 */
  w.ctx.grSetBiz('consulting-05');
  w.ctx.GR.f.year = ''; w.ctx.grRender();
  assert.doesNotMatch(w.els.yrbar.innerHTML, /class="on"/, '고른 연도가 없다');
  assert.equal(kpiN(w, ''), '4', '연도 없이 보면 종결 판정이 없다(전체 연도 줄)');
});

test('125 「⋯ 사업 종결」 — 창(종결일 기본 오늘·사유·이 연도부터/사업 전체·업체 수 안내) → 확인하면 scal_bizState/<코드> 한 번 쓰기 · 목록이 종결로 옮겨지고 숫자·챙길 것에서 빠진다', async () => {
  const w = navWorld();
  await w.ctx.grLoad();
  assert.equal(w.els.docs.style.display, 'none');
  w.ctx.grSetBiz('consulting-05');
  assert.match(w.els.docs.innerHTML, /<button type="button" class="act cm-b" data-cm="open">⋯ 사업 종결<\/button>/, '서류 패널 머리에 단추');
  assert.ok(!w.els.docs.innerHTML.includes('종결된 사업입니다'));
  assert.equal(w.els.cm.innerHTML, '', '단추를 누르기 전에는 창이 없다');
  w.ctx.grCloseOpen();
  const c = w.els.cm.innerHTML;
  assert.equal(w.els.cm.style.display, '');
  ['role="dialog" aria-label="사업 종결"', '인사노무컨설팅서산 (서산상공회의소) 을(를) 종결 사업으로 옮깁니다', 'id="cmDay" value="2026-10-10"', '<b>2026년</b>부터 종결', '사업 전체 — 모든 연도에서 종결',
    '2026년 업체 1곳이 걸려 있습니다', 'data-close onclick="grCloseCm()">닫기', 'onclick="grCloseBiz()">종결 사업으로 옮기기'].forEach((x) => assert.ok(c.includes(x), x));
  Nav.REASONS.forEach((r) => assert.ok(c.includes('<option value="' + r + '"'), r));
  assert.ok(c.includes('id="cmFromY" checked>') && c.includes('id="cmFromA">'), '기본은 «이 연도부터»');
  assert.equal(w.db.쓴것.length, 0, '창을 여는 것만으로는 쓰지 않는다');
  /* 확인 */
  w.els.cmDay.value = '2026-12-31'; w.els.cmWhy.value = '계약 종료';
  await w.ctx.grCloseBiz();
  assert.equal(w.db.쓴것.length, 1, '쓰기는 한 번');
  const wr = J(w.db.쓴것[0]);
  assert.equal(wr.자리, 'scal_bizState/consulting-05');
  assert.ok(!wr.update && !wr.transaction && !wr.remove);
  assert.deepEqual(Object.keys(wr.값).sort(), ['at', 'by', 'closedAt', 'closedFrom', 'reason']);
  assert.deepEqual([wr.값.closedFrom, wr.값.closedAt, wr.값.reason, wr.값.by], ['2026', '2026-12-31', '계약 종료', '홍길동']);
  assert.equal(typeof wr.값.at, 'number');
  assert.deepEqual(J(w.db.읽기('scal_bizState/consulting-05')), wr.값, '진짜로 저장됐다');
  assert.deepEqual(J(w.ctx.GR.bizState['consulting-05']), wr.값);
  assert.equal(w.ctx.GR.cm, null); assert.equal(w.els.cm.style.display, 'none', '창이 닫힌다');
  /* 목록·숫자·챙길 것 */
  const h = w.els.biz.innerHTML;
  assert.ok(grpOf(h, 'closed').includes('data-biz="consulting-05"') && grpOf(h, 'closed').includes('2026-12 종결'));
  assert.ok(!openSec(h).includes('consulting-05'));
  assert.match(w.els.yrbar.innerHTML, /data-yr="2026"[^>]*>2026<small>5곳<\/small>/);
  assert.match(w.els.docs.innerHTML, /종결된 사업입니다\./, '고른 채라 배너가 바로 선다');
  assert.ok(!w.els.docs.innerHTML.includes('data-cm="open"'));
  w.ctx.grSetBiz('consulting-05');   // 고름 풀기
  assert.deepEqual([kpiN(w, ''), kpiN(w, 'todo')], ['2', '0']);
  assert.equal(alertN(w, '종료 후 14일 넘은 미작성'), '0', '⏰ 알림에서도 빠진다(마바산업 미작성이었다)');
  assert.ok(!w.els.alerts.innerHTML.includes('마바산업'));
  assert.equal(w.db.쓴것.length, 1, '다시 그리기만으로는 더 쓰지 않는다');
});

test('125-2 「사업 전체」 → closedFrom 2000(모든 연도 종결) · 종결 전 해로 바꿔도 종결로 남는다 · 이 연도부터는 그 앞 해가 진행으로 보인다', async () => {
  const w = navWorld();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-03');
  w.ctx.grCloseOpen();
  w.els.cmDay.value = '2026-10-10'; w.els.cmWhy.value = '기타'; w.els.cmFromA.checked = true;
  await w.ctx.grCloseBiz();
  assert.equal(w.db.쓴것.length, 1);
  assert.equal(J(w.db.쓴것[0].값).closedFrom, '2000');
  assert.match(w.els.docs.innerHTML, /사업 전체 종결 \(2026-10-10\)/);
  w.ctx.grSetYear('2025');
  assert.ok(grpOf(w.els.biz.innerHTML, 'closed').includes('data-biz="consulting-03"'), '2025 에도 종결 — 사업 전체');
  assert.match(w.els.docs.innerHTML, /종결된 사업입니다\./);
  /* 이 연도부터(2026) 로 종결한 사업은 2025 에서 진행으로 보인다 */
  const v = navWorld();
  await v.ctx.grLoad();
  v.ctx.grSetBiz('consulting-03'); v.ctx.grCloseOpen();
  v.els.cmDay.value = '2026-10-10'; v.els.cmWhy.value = '계약 종료'; v.els.cmFromA.checked = false;
  await v.ctx.grCloseBiz();
  assert.equal(J(v.db.쓴것[0].값).closedFrom, '2026');
  v.ctx.grSetYear('2025');
  assert.ok(openSec(v.els.biz.innerHTML).includes('data-biz="consulting-03"'), '종결 전 연도(2025)에서는 진행 사업');
  assert.ok(!v.els.docs.innerHTML.includes('종결된 사업입니다') && v.els.docs.innerHTML.includes('data-cm="open"'));
  assert.equal(kpiN(v, ''), '1', '2025 숫자에 사아테크 한 곳');
  v.ctx.grSetYear('2027');   // 연도 막대에는 없는 해 — 직접 넣어도 던지지 않는다(종결 판정은 closedFrom <= 연도)
  v.ctx.grRender();
  assert.equal(v.ctx.GR.f.year, '2027');
});

test('125-3 쓰기 거절(관리자가 아님·규칙 게시 전) — 창에 「저장하지 못했습니다 — 관리자만 종결할 수 있습니다(…)」 · 목록·숫자·상태는 그대로 · 다시 눌러 볼 수 있다', async () => {
  const w = navWorld({ denyWrite: true });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-05');
  assert.ok(w.els.docs.innerHTML.includes('data-cm="open"'), '직원에게도 단추는 보인다');
  w.ctx.grCloseOpen();
  w.els.cmDay.value = '2026-10-10'; w.els.cmWhy.value = Nav.REASONS[0];
  await w.ctx.grCloseBiz();
  assert.ok(w.els.cm.innerHTML.includes('<div class="err-s">' + FAIL + '</div>'), w.els.cm.innerHTML);
  assert.equal(w.els.cm.style.display, '', '창은 열려 있다');
  assert.equal(w.ctx.GR.cm.busy, false);
  assert.deepEqual(J(w.ctx.GR.bizState), {}, '상태는 그대로');
  assert.ok(openSec(w.els.biz.innerHTML).includes('data-biz="consulting-05"') && !grpOf(w.els.biz.innerHTML, 'closed'), '목록은 그대로');
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(!w.els.cm.innerHTML.includes('onclick="grCloseBiz()" disabled'), '다시 누를 수 있다');
  w.ctx.grCloseCm();
  assert.equal(w.els.cm.style.display, 'none');
});

test('125-4 막는 것 — 연도가 비었을 때 「이 연도부터」는 못 쓴다(사업 전체만) · 규칙 열쇠 꼴이 아닌 사업 코드·프로토타입 이름은 쓰지 않는다 · 창을 두 번 눌러도 쓰기는 한 번', async () => {
  const w = navWorld();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-05');
  w.ctx.GR.f.year = ''; w.ctx.grRender();
  w.ctx.grCloseOpen();
  const c = w.els.cm.innerHTML;
  assert.ok(c.includes('id="cmFromY" disabled>') && c.includes('id="cmFromA" checked>'), '이 연도부터는 쓸 수 없고 사업 전체가 골라져 있다');
  assert.ok(c.includes('연도를 고르지 않아 쓸 수 없습니다'));
  w.els.cmFromA.checked = false;   // (눌러 풀 수는 없지만) 강제로 풀어도 쓰지 않는다
  await w.ctx.grCloseBiz();
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(w.els.cm.innerHTML.includes('종결 연도를 정할 수 없습니다 — 연도를 고르거나 「사업 전체」를 골라 주세요'));
  /* 사업 코드 점검 */
  for (const bad of ['a/b', '__proto__', 'constructor', 'prototype', 'x'.repeat(41), '가나', 'a b', 'consulting-99']) {
    w.ctx.GR.cm = { code: bad, day: '2026-10-10', reason: '기타', from: 'all', msg: '', err: false, busy: false };
    w.els.cmFromA.checked = true;
    await w.ctx.grCloseBiz();
    assert.equal(w.db.쓴것.length, 0, '쓰면 안 되는 코드: ' + bad);
    assert.ok(w.ctx.GR.cm.msg.includes('사업 코드를 확인할 수 없어 종결하지 않았습니다'), bad);
  }
  assert.deepEqual(J(w.ctx.GR.bizState), {});
  assert.equal(w.ctx.grOkBizCode('consulting-05'), true);
  assert.equal(w.ctx.grOkBizCode('A_b-9'), true);
  /* 겹쳐 눌러도 한 번 */
  const v = navWorld();
  await v.ctx.grLoad();
  v.ctx.grSetBiz('consulting-04'); v.ctx.grCloseOpen();
  v.els.cmDay.value = '2026-10-10'; v.els.cmWhy.value = '기타'; v.els.cmFromA.checked = false;
  await Promise.all([v.ctx.grCloseBiz(), v.ctx.grCloseBiz()]);
  assert.equal(v.db.쓴것.length, 1, '두 번 눌러도 한 번');
});

test('126 종결 사업을 고르면 배너(종결일·사유·처리자)와 그 행·서류 패널이 보인다 · 「↩ 되돌리기」→ 되돌림 표시 .set 한 번(노드는 남는다) → 진행 사업으로 · 종결 전 연도로 바꾸면 진행 사업으로 보인다', async () => {
  const w = navWorld({ state: CLOSED05 });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-05');
  const d = w.els.docs.innerHTML;
  assert.equal(w.els.docs.style.display, '');
  ['종결된 사업입니다.', '2026년부터 종결 (2026-09-30)', '사유: 사업 기간 끝남', '종결 처리: 홍길동', '다른 사업의 숫자·알림에서는 빠져 있습니다',
    '<button type="button" class="act" data-cm="reopen">↩ 진행 사업으로 되돌리기</button>', '📋 서류 — 인사노무컨설팅서산', '마바산업'].forEach((x) => assert.ok(d.includes(x), x));
  assert.ok(!d.includes('data-cm="open"'), '종결된 사업에는 «종결» 단추가 없다');
  assert.ok(w.els.rows.innerHTML.includes('마바산업'), '그 사업 행이 보인다');
  assert.ok(d.indexOf('종결된 사업입니다') < d.indexOf('📋 서류'), '배너는 서류 패널 위');
  assert.equal(w.db.쓴것.length, 0, '읽기만');
  /* 종결 전 연도로 */
  w.ctx.grSetYear('2025');
  assert.ok(!w.els.docs.innerHTML.includes('종결된 사업입니다') && w.els.docs.innerHTML.includes('data-cm="open"'), '2025 에는 진행 사업');
  assert.ok(grpOf(w.els.biz.innerHTML, 'quiet').includes('consulting-05') && !grpOf(w.els.biz.innerHTML, 'closed'));
  w.ctx.grSetYear('2026');
  /* 되돌리기 */
  await w.ctx.grReopenBiz();
  assert.equal(w.db.쓴것.length, 1, '되돌리기도 쓰기는 한 번');
  const rw = J(w.db.쓴것[0]);
  assert.equal(rw.자리, 'scal_bizState/consulting-05');
  assert.ok(!rw.remove && !rw.update && !rw.transaction, '지우지 않는다');
  assert.deepEqual(Object.keys(rw.값).sort(), ['at', 'by', 'closedAt', 'closedFrom', 'reason']);
  assert.deepEqual([rw.값.closedFrom, rw.값.closedAt, rw.값.reason, rw.값.by], ['9999', '2026-10-10', '되돌림', '홍길동'], '누가 언제 되돌렸는지 남는다');
  assert.equal(typeof rw.값.at, 'number');
  assert.deepEqual(J(w.db.읽기('scal_bizState/consulting-05')), rw.값, '노드는 남고 되돌림 표시가 됐다');
  assert.deepEqual(J(w.ctx.GR.bizState['consulting-05']), rw.값);
  assert.equal(w.ctx.PuGovReportNav.isReopened(w.ctx.GR.bizState, 'consulting-05'), true);
  assert.ok(!w.els.docs.innerHTML.includes('종결된 사업입니다') && w.els.docs.innerHTML.includes('data-cm="open"'));
  const h = w.els.biz.innerHTML;
  assert.ok(openSec(h).includes('data-biz="consulting-05"') && !grpOf(h, 'closed'), '진행 사업으로 돌아왔다');
  assert.match(w.els.yrbar.innerHTML, /data-yr="2026"[^>]*>2026<small>6곳<\/small>/, '막대 숫자도 돌아왔다');
  w.ctx.grSetBiz('consulting-05');
  assert.deepEqual([kpiN(w, ''), kpiN(w, 'todo')], ['3', '1'], '숫자·행에 다시 들어온다');
  assert.ok(w.els.rows.innerHTML.includes('마바산업'));
  await w.ctx.grReopenBiz();   // 이미 진행 — 쓸 것이 없다
  assert.equal(w.db.쓴것.length, 1);
});

test('126-2 되돌리기 거절 — 배너에 같은 안내 문구 · 상태·목록 그대로 · 잠금은 풀린다 · 모든 연도 종결(closedFrom 2000)도 되돌리면 전부 진행', async () => {
  const w = navWorld({ state: CLOSED05, denyWrite: true });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-05');
  await w.ctx.grReopenBiz();
  assert.ok(w.els.docs.innerHTML.includes('<div class="err-s">' + FAIL + '</div>'));
  assert.equal(w.ctx.GR.bbusy, false);
  assert.ok('consulting-05' in J(w.ctx.GR.bizState), '상태는 그대로');
  assert.ok(grpOf(w.els.biz.innerHTML, 'closed').includes('consulting-05'));
  assert.equal(w.db.쓴것.length, 0);
  w.ctx.grSetBiz('consulting-05'); w.ctx.grSetBiz('consulting-05');
  assert.ok(!w.els.docs.innerHTML.includes(FAIL), '다른 사업을 거쳐 오면 옛 오류는 지워진다');
  const a = navWorld({ state: { 'consulting-05': { closedFrom: '2000', at: 1 } } });
  await a.ctx.grLoad();
  a.ctx.grSetYear('2025'); a.ctx.grSetBiz('consulting-05');
  assert.match(a.els.docs.innerHTML, /사업 전체 종결/);
  await a.ctx.grReopenBiz();
  assert.equal(J(a.db.쓴것[0].값).closedFrom, '9999');
  ['2025', '2026'].forEach((y) => { a.ctx.grSetYear(y); assert.ok(!grpOf(a.els.biz.innerHTML, 'closed'), y); });
});

test('126-3 종결 → 되돌리기 → 종결 → 되돌리기 → 종결 — 마지막 종결이 이긴다 · 되돌린 사업의 종결 창은 처음 닫는 사업과 같다 · 쓰기는 전부 .set(노드는 한 번도 지워지지 않는다)', async () => {
  const w = navWorld();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-05');
  const node = () => J(w.db.읽기('scal_bizState/consulting-05'));
  const close = async (from, day, why) => {
    assert.ok(w.els.docs.innerHTML.includes('data-cm="open"') && !w.els.docs.innerHTML.includes('종결된 사업입니다'), '진행 사업 — 종결 단추가 있다');
    w.ctx.grCloseOpen();
    assert.ok(w.els.cm.innerHTML.includes('id="cmDay" value="2026-10-10"') && w.els.cm.innerHTML.includes('<b>2026년</b>부터 종결'), '처음 닫을 때와 같은 창');
    w.els.cmDay.value = day; w.els.cmWhy.value = why; w.els.cmFromA.checked = from === 'all';
    await w.ctx.grCloseBiz();
  };
  const isClosedUi = () => grpOf(w.els.biz.innerHTML, 'closed').includes('consulting-05') && w.els.docs.innerHTML.includes('종결된 사업입니다');
  await close('year', '2026-11-01', '계약 종료');
  assert.deepEqual([node().closedFrom, node().closedAt, node().reason], ['2026', '2026-11-01', '계약 종료']);
  assert.ok(isClosedUi());
  await w.ctx.grReopenBiz();
  assert.deepEqual([node().closedFrom, node().reason, node().by], ['9999', '되돌림', '홍길동']);
  assert.ok(!isClosedUi() && openSec(w.els.biz.innerHTML).includes('consulting-05'), '되돌림 — 진행 사업');
  assert.ok(!w.els.docs.innerHTML.includes('종결된 사업입니다'), '되돌린 사업에는 배너가 없다(다시 진행 중)');
  await close('all', '2026-12-31', '기타');
  assert.deepEqual([node().closedFrom, node().closedAt, node().reason], ['2000', '2026-12-31', '기타'], '표시를 새 종결이 덮는다');
  assert.ok(isClosedUi() && w.els.docs.innerHTML.includes('사업 전체 종결 (2026-12-31)'));
  await w.ctx.grReopenBiz();
  assert.equal(node().closedFrom, '9999');
  await close('year', '2027-01-05', '사업 기간 끝남');
  assert.deepEqual([node().closedFrom, node().closedAt, node().reason, node().by], ['2026', '2027-01-05', '사업 기간 끝남', '홍길동'], '마지막 종결이 최종 상태');
  assert.ok(isClosedUi());
  assert.deepEqual(J(w.ctx.GR.bizState['consulting-05']), node(), '화면 상태 = DB');
  assert.equal(w.db.쓴것.length, 5, '종결·되돌림·종결·되돌림·종결 = 쓰기 다섯 번');
  w.db.쓴것.forEach((x) => { assert.equal(x.자리, 'scal_bizState/consulting-05'); assert.ok(!x.remove && !x.update && !x.transaction, '모두 .set'); });
  assert.deepEqual(w.db.쓴것.map((x) => x.값.closedFrom), ['2026', '9999', '2000', '9999', '2026']);
  assert.match(w.els.yrbar.innerHTML, /data-yr="2026"[^>]*>2026<small>5곳<\/small>/);
});

test('127 종결 사업은 ⏰ 챙길 것(미작성·초안·서명 회신·제출 기한)·막힌 단계에서 빠진다 — 사업마다 자기 알림만 빠진다', async () => {
  const base = navWorld({ state: {} });
  await base.ctx.grLoad();
  const heads = ['종료 후 14일 넘은 미작성', '초안 7일 넘음', '서명 회신 기다림 \\(7일 넘음\\)', '제출 기한 지남'];
  assert.deepEqual(heads.map((x) => alertN(base, x)), ['1', '1', '1', '1'], '대조 — 종결이 없으면 각 하나');
  /* 사업 코드 → 어느 알림이 빠지나 (05 마바산업 미작성 · 03 가나상사 초안·제출 기한 · 04 다라정밀 서명 회신) */
  const cases = [['consulting-05', ['0', '1', '1', '1']], ['consulting-03', ['1', '0', '1', '0']], ['consulting-04', ['1', '1', '0', '1']]];
  for (const [code, want] of cases) {
    const w = navWorld({ state: { [code]: { closedFrom: '2026', at: 1 } } });
    await w.ctx.grLoad();
    assert.deepEqual(heads.map((x) => alertN(w, x)), want, code + ' 종결');
  }
  /* 고른 사업이 종결이어도 알림에서는 빠진 채다 */
  const s = navWorld({ state: CLOSED05 });
  await s.ctx.grLoad();
  s.ctx.grSetBiz('consulting-05');
  assert.equal(alertN(s, '종료 후 14일 넘은 미작성'), '0');
  /* 막힌 단계 — 대형 사업 기록(일터혁신 plan 막힘) */
  const track = { t2: { plan: { st: 'blocked', note: '인증서 만료' } } };
  const b0 = navWorld({ seed: bigSeed({ track }) });
  await b0.ctx.grLoad();
  assert.equal(alertN(b0, '막힌 단계'), '1', '대조 — 막힌 단계 하나');
  const seed = bigSeed({ track }); seed.scal_bizState = { 'consulting-02': { closedFrom: '2026', at: 1 } };
  const b1 = navWorld({ seed });
  await b1.ctx.grLoad();
  assert.equal(alertN(b1, '막힌 단계'), '0', '종결 사업의 막힌 단계는 알림에서 빠진다');
  assert.ok(!b1.els.alerts.innerHTML.includes('인증서 만료'));
  const seed2 = bigSeed({ track }); seed2.scal_bizState = { 'consulting-02': { closedFrom: '2027', at: 1 } };
  const b2 = navWorld({ seed: seed2 });
  await b2.ctx.grLoad();
  assert.equal(alertN(b2, '막힌 단계'), '1', '2027 부터 종결이면 2026 알림은 그대로');
});

test('128 종결 사업은 전역 「📥 받은 서류 확인」 쌍 모으기에서 빠진다 — 그 업체 메일이 목록에서 사라진다(다른 쌍에 이어지면 그쪽으로)', async () => {
  const run = async (state) => {
    const s = giSeed(); if (state) s.scal_bizState = state;
    const w = giWorld({ seed: s });
    await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
    assert.equal(w.ctx.GR.gi.st, 'ok');
    return giList(w);
  };
  const all = await run(null);
  assert.deepEqual(all.map((m) => m.uid), ['111', '108', '102', '101', '110'], '대조 — 종결이 없을 때(기존 검사 110 과 같다)');
  /* 04 = 다라정밀 충남북부(t3) 종결 → 다라정밀 메일이 모두 빠지고 두 업체에 걸린 111 만 남는다 */
  const c4 = await run({ 'consulting-04': { closedFrom: '2026', at: 1 } });
  assert.deepEqual(c4.map((m) => m.uid), ['111']);
  assert.ok(c4.every((m) => m.coName !== '다라정밀'));
  /* 03 = 가나상사 기술보호(t1) 종결 → 111 은 «다음 쌍»(마바산업)으로 이어진다 */
  const c3 = await run({ 'consulting-03': { closedFrom: '2026', at: 1 } });
  assert.deepEqual(c3.map((m) => m.uid), ['111', '108', '102', '101', '110']);
  assert.equal(c3.filter((m) => m.uid === '111')[0].coName, '마바산업', '종결 사업의 쌍은 모으지 않는다 — 111 이 다음 쌍으로');
  /* 종결이 2027 부터면(고른 해 2026) 그대로 */
  assert.deepEqual((await run({ 'consulting-04': { closedFrom: '2027', at: 1 } })).map((m) => m.uid), all.map((m) => m.uid));
  /* 종결 → 되돌리기 뒤 목록이 메일함을 다시 읽지 않고 다시 계산된다 */
  const s = giSeed();
  const w = giWorld({ seed: s });
  await w.ctx.grLoad(); await w.ctx.grGlobalInbox();
  const reads = mailReads(w).length;
  w.ctx.grSetBiz('consulting-04'); w.ctx.grCloseOpen();
  w.ctx.$('cmDay').value = '2026-10-10'; w.ctx.$('cmWhy').value = '기타'; w.ctx.$('cmFromA').checked = false;
  await w.ctx.grCloseBiz();
  assert.deepEqual(giList(w).map((m) => m.uid), ['111'], '종결하자 바로 줄어든다');
  await w.ctx.grReopenBiz();
  assert.deepEqual(giList(w).map((m) => m.uid), ['111', '108', '102', '101', '110'], '되돌리면 돌아온다');
  assert.equal(mailReads(w).length, reads, '메일함은 다시 읽지 않았다');
});

test('129 상태를 못 읽으면(규칙 게시 전·권한 거절) 평소처럼 돈다 — 종결 없음 · 오류 줄 없음 · 모양이 이상한 값도 종결이 아니다', async () => {
  const w = navWorld({ state: CLOSED05, denyRead: true });
  await w.ctx.grLoad();
  assert.deepEqual(J(w.ctx.GR.bizState), {});
  assert.equal(w.els.err.style.display, 'none', '오류 줄 없음');
  assert.notEqual(w.els.board.style.display, 'none');
  assert.ok(w.els.rows.innerHTML.includes('마바산업'), '종결로 보지 않으니 05 행도 그대로');
  assert.ok(openSec(w.els.biz.innerHTML).includes('data-biz="consulting-05"'));
  assert.ok(!w.els.biz.innerHTML.includes('불러오지 못했습니다'));
  assert.match(w.els.yrbar.innerHTML, /data-yr="2026"[^>]*>2026<small>6곳<\/small>/);
  assert.equal(w.ctx.GR.loaded, true);
  assert.equal(alertN(w, '종료 후 14일 넘은 미작성'), '1');
  /* 모양이 이상한 값 — 노드가 배열·글자·값 없음 */
  for (const [bad, want] of [[['x'], {}], ['x', {}], [5, {}], [{ 'consulting-05': 'x' }, { 'consulting-05': 'x' }], [{ 'consulting-05': { closedFrom: '26' } }, { 'consulting-05': { closedFrom: '26' } }]]) {
    const v = navWorld({ state: bad });
    await v.ctx.grLoad();
    assert.deepEqual(J(v.ctx.GR.bizState), want, '읽은 값 정리: ' + JSON.stringify(bad));
    assert.ok(openSec(v.els.biz.innerHTML).includes('data-biz="consulting-05"'), JSON.stringify(bad) + ' 는 종결이 아니다');
  }
  /* 상태를 못 읽어도 종결 창은 열리고 거절은 안내로 — 목록은 그대로 */
  w.ctx.grSetBiz('consulting-05'); w.ctx.grCloseOpen();
  assert.equal(w.els.cm.style.display, '');
});

test('130 같은 일정 사업에 아직 진행인 이알피 사업이 이어져 있으면(두 사업이 같은 일정 사업) 종결로 그 업체를 가리지 않는다 · 종결 사업만 목록에서 옮겨진다', async () => {
  const w = navWorld({ seedOpt: { twin: true }, state: { 'consulting-03': { closedFrom: '2026', at: 1 } } });
  await w.ctx.grLoad();
  const m = J(Nav.build({ biz: w.ctx.GR.docs.biz, tmap: w.ctx.GR.docs.tmap, input: w.ctx.GR.input, year: '2026', state: w.ctx.GR.bizState }));
  assert.deepEqual(m.closed.map((x) => x.code), ['consulting-03']);
  assert.ok(m.open.some((x) => x.code === 'consulting-12' && x.typeId === 't1'), '전제: 12 가 같은 일정 사업(t1)에 이어져 진행 중');
  assert.deepEqual(J(w.ctx.grClosedTypes('2026', false)), {}, '진행 사업이 같은 종류를 쓰므로 거르지 않는다');
  assert.equal(kpiN(w, ''), '3', '가나상사 기술보호 줄이 숫자에 남는다');
  assert.ok(w.els.rows.innerHTML.includes('가나상사'));
  assert.equal(alertN(w, '초안 7일 넘음'), '1');
  assert.ok(grpOf(w.els.biz.innerHTML, 'closed').includes('consulting-03'), '목록에서는 03 이 종결로 간다');
  /* 대조 — 둘로 나뉘지 않은 씨앗은 종류가 걸러진다 */
  const n = navWorld({ state: { 'consulting-03': { closedFrom: '2026', at: 1 } } });
  await n.ctx.grLoad();
  assert.deepEqual(J(n.ctx.grClosedTypes('2026', false)), { t1: 1 });
  assert.deepEqual(J(n.ctx.grClosedTypes('2025', false)), {}, '2025 는 종결 전');
  assert.equal(kpiN(n, ''), '2');
  n.ctx.grSetBiz('consulting-03');
  assert.deepEqual(J(n.ctx.grClosedTypes('2026', true)), {}, '고른 사업이면 거르지 않는다');
  /* 사업 목록·일정을 못 읽었으면 아무것도 거르지 않는다 */
  n.ctx.GR.docs = { loaded: false, err: false };
  assert.deepEqual(J(n.ctx.grClosedTypes('2026', false)), {});
});

test('131 바깥 값은 이스케이프 — 사업 이름·기관·사유·종결 처리자·종결 창 · <script>·따옴표', async () => {
  const hostile = { 'consulting-14': { closedFrom: '2026', closedAt: '2026-10-01', reason: '<script>r</script>"', by: '<b>x</b>\'', at: 1 } };
  const w = navWorld({ seedOpt: { hostile: true }, state: hostile });
  await w.ctx.grLoad();
  const bad = /<script|<img|<svg|<b>x/;
  const biz = w.els.biz.innerHTML;
  assert.doesNotMatch(biz, bad, '목록(이름·기관·title)');
  assert.ok(biz.includes('&#60;script&#62;alert(1)&#60;/script&#62;가') && biz.includes('(&#34;&#62;&#60;img src=x onerror=1&#62;)'), '이름·기관이 글자로 나온다');
  assert.doesNotMatch(w.els.yrbar.innerHTML, bad);
  w.ctx.grSetBiz('consulting-14');
  const d = w.els.docs.innerHTML;
  assert.doesNotMatch(d, bad, '배너·서류 패널 머리');
  ['사유: &#60;script&#62;r&#60;/script&#62;&#34;', '종결 처리: &#60;b&#62;x&#60;/b&#62;&#39;'].forEach((x) => assert.ok(d.includes(x), x));
  assert.doesNotMatch(w.els.rows.innerHTML, bad);
  /* 종결 창 — 이름이 위험한 사업 */
  w.ctx.grSetBiz('consulting-15');
  w.ctx.grCloseOpen();
  assert.doesNotMatch(w.els.cm.innerHTML, bad, '종결 창');
  assert.ok(w.els.cm.innerHTML.includes('&#60;img src=x onerror=2&#62;나 (&#39;&#62;&#60;svg onload=3&#62;) 을(를) 종결 사업으로'));
  /* 거절 문구·돌려받은 값도 글자로 */
  assert.doesNotMatch(w.els.docs.innerHTML + w.els.alerts.innerHTML + w.els.ginbox.innerHTML, bad);
});

/* 실제 저장 관문 — gov-report.html 이 싣는 pu-ontology-write.js 를 ontology-write-gate 검사와 같은 방식(installFirebaseCompat + 가짜 firebase)으로 통과시킨다.
   이 앱은 유예 목록(LEGACY_OBSERVE_PROGRAMS)에 없어 화면 태그가 observe 여도 «강제» — 그래서 되돌리기는 .remove 가 아니라 표시 .set 이다(조정관 판정 2026-10-12) */
test('132 실제 관문(강제 모드) — 종결 .set·되돌림 표시 .set 은 통과하고 .remove 는 막힌다(그래서 지우지 않는다)', async () => {
  const W = require('../js/pu-ontology-write.js');
  assert.equal(W.runtimeMode('govreport', 'observe'), 'enforce', '컨설팅보고서는 관찰 유예 앱이 아니다 — 태그의 observe 는 표시일 뿐');
  assert.match(SRC, /pu-ontology-write\.js\?v=\d+" data-mode="observe"/);
  const calls = [];
  const ref = (p) => ({
    child: (c) => ref((p ? p + '/' : '') + c),
    set: (v) => { calls.push({ kind: 'set', path: p, value: v }); return Promise.resolve(); },
    remove: () => { calls.push({ kind: 'remove', path: p }); return Promise.resolve(); },
    update: (v) => { calls.push({ kind: 'update', path: p, value: v }); return Promise.resolve(); },
    transaction: () => { calls.push({ kind: 'transaction', path: p }); return Promise.resolve({ committed: true }); },
  });
  const database = function () { return { ref }; };
  const fb = { database };
  W.clearIssues();
  assert.equal(W.installFirebaseCompat(fb, { mode: W.runtimeMode('govreport', 'observe'), program: 'govreport', reporter: () => {} }), true);
  const close = Nav.closeEntry({ from: '2026', at: '2026-10-12', reason: '계약 종료', by: '홍길동', now: 1760000000000 });
  const reopen = Nav.closeEntry({ from: Nav.NEVER_FROM, at: '2026-10-12', reason: '되돌림', by: '홍길동', now: 1760000000001 });
  await fb.database().ref('scal_bizState/' + 'consulting-05').set(close);
  await fb.database().ref('scal_bizState/' + 'consulting-05').set(reopen);
  assert.deepEqual(calls.map((c) => [c.kind, c.path, c.value.closedFrom]), [['set', 'scal_bizState/consulting-05', '2026'], ['set', 'scal_bizState/consulting-05', '9999']],
    '종결·되돌림 표시 둘 다 관문을 통과해 쓰인다');
  assert.deepEqual(W.getIssues(), [], '관문이 아무 위반도 적지 않는다');
  await assert.rejects(() => fb.database().ref('scal_bizState/consulting-05').remove(), /삭제 표식/, '.remove 는 관문이 막는다');
  assert.equal(calls.length, 2, '막힌 .remove 는 나가지 않았다');
  /* 대조 — 화면 코드에는 .remove 가 없으므로 이 막힘이 운영에서 되돌리기를 깨지 않는다 */
  assert.doesNotMatch(INLINE, /\.remove\s*\(/);
});

/* ═══ 사업별 대시보드(UI 재정리 2단계, 2026-10-12) — 순수 모듈 PuGovReportDash 를 화면에 잇는다. 읽기만 — 새 쓰기·새 DB 칸 없음 ═══ */
test('133 정적 — 대시보드 모듈은 서류 모듈 다음 · 화면이 요약·보드·막힌 수를 부른다 · 쓰기는 여전히 .set 셋 · 보기 저장은 try/catch 안의 localStorage 뿐 · 색을 직접 지정하지 않는다', () => {
  assert.match(SRC, /<script src="js\/pu-gov-report-dash\.js\?v=\d+"><\/script>/);
  assert.ok(SRC.indexOf('pu-gov-report-docs.js') < SRC.indexOf('pu-gov-report-dash.js'), '서류 모듈 다음에 싣는다');
  ['PuGovReportDash.summarize(', 'PuGovReportDash.board(', 'PuGovReportDash.blockedCounts(', 'data-dv=', 'dsh', 'bd-card', 'bz-al'].forEach((s) => assert.ok(SRC.includes(s), s));
  assert.ok(SRC.includes('단계 현황을 알 수 없습니다'), '기록을 못 읽었을 때 안내 문구');
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES, '새 쓰기 명령이 없다');
  ['grDashHtml', 'grBoardHtml'].forEach((n) => assert.doesNotMatch(grab(n), /fbDb|\.set\(|\.update\(|fetch\(|localStorage/, n + ' 은 읽어 그리기만'));
  const ls = INLINE.match(/localStorage\.[a-zA-Z]+\([^)]*gov_dash_view[^)]*\)/g) || [];
  assert.ok(ls.length >= 2, '보기 선택 읽기·쓰기');
  assert.match(grab('grLoadDashView'), /try\s*\{[^}]*localStorage\.getItem[^}]*\}\s*catch/);
  assert.match(grab('grSetDashView'), /try\s*\{[^}]*localStorage\.setItem[^}]*\}\s*catch/);
  const css = SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>'));
  const dshCss = css.split(/\r?\n/).filter((l) => /\.dsh|\.dp-|\.bd-|\.bz-al/.test(l)).join('\n');
  assert.ok(dshCss.length > 0);
  assert.doesNotMatch(dshCss, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, '새 CSS 는 기존 변수만');
  assert.match(grab('grRenderDocs'), /\[data-dv\]|PuGovReportDash\.summarize/);
  assert.match(SRC, /closest\('\[data-dv\]'\)/);
});

test('134 대형 대시보드 — 숫자 4칸(막힌 업체 .bad)·단계 막대·업체 점(title)·회차·표/보드 단추 · 기본은 표 · 값은 이스케이프 · 읽기만', async () => {
  const w = world({ seed: bigSeed({ track: { t2: { plan: { st: 'blocked', note: '<b>x</b>' } } } }) });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-02');
  const h = w.els.docs.innerHTML;
  assert.match(h, /<div class="dsh">/);
  assert.equal(countOf(h, /class="dsh-k[ "]/g), 4, '숫자 4칸');
  ['진행 업체', '막힌 업체', '기한 14일 안', '모두 끝'].forEach((s) => assert.ok(h.includes(s), s));
  assert.match(h, /class="dsh-k bad"><b>1<\/b>/, '막힌 업체 1 — 붉은 칸');
  assert.ok(h.includes('class="dsh-p"') && h.includes('class="dsh-l"'));
  ['참여 안내서(서명)', '수행계획서', '이행결과표'].forEach((s) => assert.ok(new RegExp('class="dsh-pn">' + s.replace(/[()]/g, '\\$&')).test(h), s + ' 막대 이름'));
  assert.match(h, /완료 \d+ · 진행 \d+ · 막힘 1/, '막대 글줄');
  assert.match(h, /title="수행계획서: 막힘"/, '점마다 단계: 상태');
  assert.ok(h.includes('data-dv="table"') && h.includes('data-dv="board"'), '대형은 표·보드 단추');
  assert.ok(h.includes('<div class="dc-wide"><table>') && !h.includes('bd-col'), '기본은 표');
  assert.ok(h.indexOf('class="dsh"') < h.indexOf('<div class="dc-wide">') && h.indexOf('class="dc-h"') < h.indexOf('class="dsh"'), '머리줄 아래 · 표 위');
  assert.ok(!h.includes('<b>x</b>'), '값은 글자로');
  assert.equal(w.db.쓴것.length, 0);
});

test('135 간단형 대시보드 — 숫자·막대·점은 있고 표/보드 단추는 없다 · 서류 틀 없는 사업·연결 없는 사업에는 대시보드가 없다', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-03');
  let h = w.els.docs.innerHTML;
  assert.match(h, /<div class="dsh">/);
  assert.equal(countOf(h, /class="dsh-k[ "]/g), 4);
  assert.ok(!h.includes('data-dv='), '표/보드 전환은 대형만');
  assert.ok(h.includes('class="dsh-pn">①초안'), '간단형 열 ①~⑤');
  assert.ok(!h.includes('data-item') && !h.includes('dc-wide') && !h.includes('다음 단계'), '기존 간단형 표 검사와 같다');
  w.ctx.grSetBiz('consulting-01');
  assert.ok(!w.els.docs.innerHTML.includes('dsh'), '연결 없는 사업');
  w.ctx.grSetBiz('consulting-01');
  w.ctx.GR.f.year = '1999'; w.ctx.grSetBiz('consulting-03');
  assert.ok(w.els.docs.innerHTML.includes('이 사업 업체가 없습니다') && !w.els.docs.innerHTML.includes('dsh'), '업체 0곳이면 안 그린다');
});

test('136 보드 — 단추를 누르면 열(단계)·카드(button.cellb.bd-card, 막힘은 딱지) · 선택은 localStorage 에 저장되고 다음 번에도 · 「표」로 돌아온다 · 읽기 거절이어도 던지지 않는다', async () => {
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const w = world({ seed: bigSeed({ track: { t2: { plan: { st: 'blocked' } } } }), ls });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-02');
  assert.equal(w.ctx.GR.dashView, 'table');
  w.ctx.grSetDashView('board');
  let h = w.els.docs.innerHTML;
  assert.equal(store.gov_dash_view, 'board');
  assert.ok(h.includes('class="bd"') && h.includes('bd-col') && !h.includes('<table>'), '표 대신 보드');
  assert.equal(countOf(h, /<button[^>]*class="[^"]*bd-card/g), 2, '업체 둘 = 카드 둘');
  assert.match(h, /<button type="button" class="cellb bd-card bd-blk" data-cell="1" data-co="c2" data-ty="t2" data-step="sign" data-item="guide"/, '막힌 업체(다라정밀)의 카드는 다음 단계(첫 단계) 열에서 그 칸 창을 연다');
  assert.ok(h.includes('bd-blk') && h.includes('막힘'), '막힘 딱지');
  assert.ok(h.includes('모두 끝') && h.includes('수행계획서'), '열 이름');
  assert.ok(h.includes('data-dv="board"') && h.includes('aria-pressed="true"'));
  w.ctx.grSetDashView('table');
  assert.ok(w.els.docs.innerHTML.includes('<div class="dc-wide"><table>'));
  assert.equal(store.gov_dash_view, 'table');
  /* 시작 때 읽기 — board 만 인정 */
  store.gov_dash_view = 'board'; w.ctx.grLoadDashView(); assert.equal(w.ctx.GR.dashView, 'board');
  store.gov_dash_view = 'zzz'; w.ctx.grLoadDashView(); assert.equal(w.ctx.GR.dashView, 'table');
  /* 저장소가 막혀도(없음·던짐) 던지지 않는다 */
  const bad = world({ seed: bigSeed(), ls: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } });
  await bad.ctx.grLoad();
  bad.ctx.grSetBiz('consulting-02');
  bad.ctx.grLoadDashView();
  bad.ctx.grSetDashView('board');
  assert.ok(bad.els.docs.innerHTML.includes('bd-col'), '저장은 못 해도 이번 보기는 바뀐다');
  const none = world({ seed: bigSeed() });
  await none.ctx.grLoad();
  none.ctx.grLoadDashView();
  assert.equal(none.ctx.GR.dashView, 'table');
  assert.equal(w.db.쓴것.length, 0);
});

test('137 보드 카드 — 칸 칩이 없는 단계 카드는 «목차» 단추(data-toc) · 이름은 이스케이프', async () => {
  /* docsTable 은 칩 없는 단계를 «다음 단계» 로 고르지 않는다 — 그래도 칩 없는 칸이 다음 단계로 들어오면(손으로 만든 합성 표) 칸 창이 아니라 목차 단추다 */
  const w = world();
  const table = { big: true, cols: ['가단계', '나단계'], plan: { items: [{ id: 'a' }, { id: 'b' }] }, lines: [
    { coId: 'c1', typeId: 't1', coName: '합성<b>상사</b>', due: '', rounds: 0, planned: 0, next: { id: 'a', name: '가단계' },
      cells: [{ id: 'a', step: 'sign', chip: null }, { id: 'b', step: 'sign', chip: { key: 'wait', txt: '없음' }, st: 'none' }] }] };
  const S = require('../js/pu-gov-report-dash.js').summarize(table, { trackKnown: true, today: '2026-10-10' });
  const h = w.ctx.grBoardHtml(table, S);
  assert.match(h, /<button type="button" class="bd-card" data-toc="1" data-co="c1" data-ty="t1"/);
  assert.ok(!h.includes('data-cell') && !h.includes('<b>상사'), '칸 창 없음 · 이름은 글자로');
  const s = bigSeed(); s.scal_cos.filter((c) => c.id === 'c2')[0].name = '<img src=x onerror=1>';
  const x = world({ seed: s });
  await x.ctx.grLoad();
  x.ctx.grSetBiz('consulting-02');
  x.ctx.GR.dashView = 'board'; x.ctx.grRenderDocs();
  assert.ok(!x.els.docs.innerHTML.includes('<img') && x.els.docs.innerHTML.includes('&#60;img src=x'), '카드·점 줄 이름');
});

test('138 기록을 못 읽으면 — 숫자 4칸·막대 없이 «단계 현황을 알 수 없습니다» 한 줄 + 업체 수만 · 가짜 0%·100% 없음 · 보드 단추는 남고 카드는 모두 «기록 미확인»', async () => {
  const denied = { once: async () => { throw new Error('permission_denied'); } };
  const w = world({ seed: bigSeed(), db: (db) => ({ ref: (p) => (p === 'scal_docs' ? denied : db.ref(p)) }) });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-02');
  const h = w.els.docs.innerHTML;
  assert.equal(w.ctx.GR.trackErr, true);
  assert.ok(h.includes('기록을 못 불러와 단계 현황을 알 수 없습니다'));
  assert.ok(/업체 2곳/.test(h));
  assert.ok(!h.includes('dsh-k') && !h.includes('dsh-p') && !h.includes('dsh-seg') && !h.includes('%'), '숫자 칸·막대 없음');
  assert.ok(h.includes('data-dv="board"'));
  w.ctx.grSetDashView('board');
  const b = w.els.docs.innerHTML;
  assert.ok(b.includes('기록 미확인') && !b.includes('data-cell'), '못 읽었으니 칸 창을 열지 않고 목차 단추로');
  assert.equal(countOf(b, /<button[^>]*bd-card/g), 2);
  assert.equal(w.db.쓴것.length, 0);
});

test('139 막대 — 해당 없음 열은 «해당 없음» · 나눗셈·% 없음 · 간단형 기술보호 ③ 열', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-03');
  const h = w.els.docs.innerHTML;
  assert.ok(h.includes('해당 없음'), '기술보호는 ③ 서명본이 없다');
  assert.ok(!/NaN|Infinity/.test(h));
  assert.ok(/class="dsh-pn">③서명본<\/span>[^]*?해당 없음/.test(h));
});

test('140 종결 사업을 골라도 종결 배너 아래에 대시보드가 보인다', async () => {
  const s = bigSeed({ track: { t2: { plan: { st: 'blocked' } } } }); s.scal_bizState = { 'consulting-02': { closedFrom: '2026', at: 1 } };
  const w = world({ seed: s });
  await w.ctx.grLoad();
  w.ctx.grSetBiz('consulting-02');
  const h = w.els.docs.innerHTML;
  assert.ok(h.includes('class="cl-bn"') && h.includes('class="dsh"'));
  assert.ok(h.indexOf('class="cl-bn"') < h.indexOf('class="dsh"'));
});

test('141 왼쪽 붉은 숫자 — 막힌 단계가 있는 업체 수를 항목에 · 0·종결·기록 못 읽음에는 안 단다', async () => {
  const track = { t2: { plan: { st: 'blocked' }, 'round:1': { st: 'blocked' } } };
  const w = world({ seed: bigSeed({ track }) });
  await w.ctx.grLoad();
  const item = (ww, code) => { const m = ww.els.biz.innerHTML.match(new RegExp('<button[^>]*data-biz="' + code + '"[^>]*>[\\s\\S]*?</button>')); assert.ok(m, code); return m[0]; };
  assert.ok(item(w, 'consulting-02').includes('<span class="bz-al" title="막힌 단계가 있는 업체 1곳">1</span>'), '같은 업체의 막힌 단계가 둘이어도 업체 1곳');
  assert.ok(!item(w, 'consulting-03').includes('bz-al'), '0 은 안 단다');
  /* 종결 사업 */
  const s = bigSeed({ track }); s.scal_bizState = { 'consulting-02': { closedFrom: '2026', at: 1 } };
  const c = world({ seed: s });
  await c.ctx.grLoad();
  assert.ok(!item(c, 'consulting-02').includes('bz-al'), '종결 항목');
  /* 기록을 못 읽음 */
  const denied = { once: async () => { throw new Error('permission_denied'); } };
  const r = world({ seed: bigSeed({ track }), db: (db) => ({ ref: (p) => (p === 'scal_docs' ? denied : db.ref(p)) }) });
  await r.ctx.grLoad();
  assert.ok(!r.els.biz.innerHTML.includes('bz-al'));
  assert.equal(w.db.쓴것.length, 0);
});

/* ═══ 오늘 할 일 첫 화면(UI 재정리 3단계, 2026-10-12) — 순수 모듈 PuGovReportToday 를 화면에 잇는다. 읽기만 — 새 쓰기·새 DB 칸·새 규칙 없음 ═══ */
const tdSec = (h, lv) => {   // 묶음 하나의 글 — 「td-sec lv」 부터 다음 묶음·받은 서류 묶음 앞까지
  const i = h.indexOf('td-sec ' + lv);
  if (i < 0) return '';
  const rest = h.slice(i + 8);
  const j = rest.search(/td-sec |id="tdInbox"/);
  return j < 0 ? rest : rest.slice(0, j);
};

test('142 정적 — 오늘 할 일 모듈은 대시보드 모듈 다음 · 화면이 build·stripOf·more 를 부른다 · 쓰기는 여전히 .set 셋 · 첫 화면은 메일함을 읽지 않는다 · 탭 저장은 try/catch 안의 localStorage 뿐 · 색을 직접 지정하지 않는다', () => {
  assert.match(SRC, /<script src="js\/pu-gov-report-today\.js\?v=\d+"><\/script>/);
  assert.ok(SRC.indexOf('pu-gov-report-dash.js') < SRC.indexOf('pu-gov-report-today.js'), '대시보드 모듈 다음에 싣는다');
  ['PuGovReportToday.build(', 'PuGovReportToday.stripOf(', 'PuGovReportToday.more(', 'data-tab=', 'data-td-open', 'data-td-more', 'data-home', 'tdTabs', 'id="today"', 'id="alertsSec"', 'id="filters"', 'id="tbl"']
    .forEach((s) => assert.ok(SRC.includes(s), s));
  assert.ok(SRC.includes('일부 할 일을 알 수 없습니다'), '기록을 못 읽었을 때 안내 문구');
  assert.ok(SRC.includes('오늘 급한 일이 없습니다'), '할 일이 없을 때 문구');
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES, '새 쓰기 명령이 없다');
  /* 첫 화면 그리기는 메일함을 자동으로 읽지 않는다 — 단추의 onclick 글자만 있다 */
  ['grRenderToday', 'grTodayCalc', 'grTodayTask', 'grTodayStrip', 'grTodayInboxHtml', 'grRenderTodayInbox', 'grApplyTodayView', 'grOpenTask', 'grErpFor'].forEach((n) => {
    const body = grab(n).replace(/onclick="grGlobalInbox\([^"]*"/g, '').replace(/onclick="grOpenFromInbox\([^"]*"/g, '');
    assert.doesNotMatch(body, /grLoadInbox\(|grGlobalInbox\(|fbDb|\.set\(|\.update\(|\.remove\(|fetch\(|localStorage|grSaveCell|https?:\/\//, n + ' 은 읽어 그리기만 한다(메일함은 단추로만)');
  });
  assert.match(grab('grTodayInboxHtml'), /onclick="grGlobalInbox\(\)"/, '메일함 확인은 단추를 눌렀을 때만');
  assert.match(grab('grTodayInboxHtml'), /GR\.gi/, '받은 서류 묶음은 전역 받은 서류 확인 상태를 따른다');
  assert.match(grab('grRender'), /grRenderToday\(\)/, '처음·바뀔 때 그린다');
  assert.match(grab('grRenderGlobalInbox'), /grRenderTodayInbox\(\)/, '받은 서류 확인이 바뀌면 첫 화면 묶음도 따라 바뀐다');
  assert.match(grab('grLoadTab'), /try\s*\{[^}]*localStorage\.getItem\('gov_home_tab'\)[^}]*\}\s*catch/);
  assert.match(grab('grSetTab'), /try\s*\{[^}]*localStorage\.setItem\('gov_home_tab'[^}]*\}\s*catch/);
  assert.equal((INLINE.match(/localStorage\.[a-zA-Z]+\([^)]*gov_home_tab[^)]*\)/g) || []).length, 2, '탭 읽기·쓰기 두 곳뿐');
  assert.match(SRC, /closest\('\[data-tab\]'\)/);
  assert.match(SRC, /closest\('\[data-td-open\]'\)/);
  assert.match(SRC, /closest\('\[data-td-more\]'\)/);
  assert.match(SRC, /closest\('\[data-home\]'\)/);
  ['grLoad', 'grLoadDocs', 'grRetryDocs', 'grLoadTrack', 'grLoadBizState', 'grSaveCell', 'grCloseBiz', 'grReopenBiz'].forEach((n) => assert.match(grab(n), /GR\.dver\+\+/, n + ' 이 자료 버전을 올린다(계산 캐시 열쇠)'));
  assert.match(grab('grTodayCalc'), /GR\.tdKey===key/, '캐시 열쇠');
  const css = SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>'));
  const tdCss = css.split(/\r?\n/).filter((l) => /\.td-/.test(l)).join('\n');
  assert.ok(tdCss.length > 0);
  assert.doesNotMatch(tdCss, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, '새 CSS 는 기존 변수만');
  assert.match(css, /@media \(max-width:760px\)\{[^}]*\.td-task/, '좁은 화면 규칙');
});

test('143 첫 화면 — 탭 둘 · 오늘 할 일(급함·챙기기)이 먼저 · 숫자 칸·거르개·표·오른쪽 챙길 것은 숨김(렌더는 그대로) · 사업 카드 띠 · 쓰기 0', async () => {
  const w = world({ email: 'p009@pureun.kr' });
  await w.ctx.grLoad();
  const tabs = w.els.tdTabs.innerHTML, h = w.els.today.innerHTML;
  assert.match(tabs, /<button type="button"[^>]*data-tab="today"[^>]*aria-selected="true"[^>]*>🎯 오늘 할 일 <b>\d+<\/b><\/button>/);
  assert.match(tabs, /data-tab="all"[^>]*aria-selected="false"[^>]*>📋 전체 현황/);
  assert.equal(w.els.tdTabs.style.display, '');
  assert.equal(w.els.today.style.display, '');
  ['kpis', 'filters', 'tbl'].forEach((id) => assert.equal(w.els[id].style.display, 'none', id + ' 숨김'));
  assert.equal(w.els.alertsSec.style.display, 'none', '오른쪽 챙길 것은 오늘 할 일 탭에서만 숨는다');
  assert.ok(w.els.alerts.innerHTML.includes('종료 후 14일 넘은 미작성') && w.els.kpis.innerHTML.includes('data-st='), '기존 렌더는 그대로 — 표시만 바뀐다');
  assert.ok(w.els.rows.innerHTML.includes('가나상사'));
  assert.ok(h.includes('오늘 2026-10-10 · 홍길동 — 급한 것부터'), '리드 줄');
  assert.ok(h.includes('class="td-sec hot"') && h.includes('🔥 급함'));
  assert.ok(h.indexOf('td-sec hot') < h.indexOf('td-sec mid'), '급함이 먼저');
  const hot = tdSec(h, 'hot'), mid = tdSec(h, 'mid');
  assert.ok(hot.includes('마바산업 · 보고서를 아직 안 썼습니다'), '종료 후 미작성은 급함');
  assert.ok(mid.includes('다라정밀 · 서명 회신을 기다리는 중입니다'), '서명 회신 대기는 챙기기');
  assert.match(hot, /<button type="button" class="act" data-td-open="1" data-co="c3" data-ty="t4">서류 열기<\/button>/);
  assert.ok(hot.includes('종료 후 151일'), '근거 한 줄');
  assert.equal(countOf(h, /class="td-task/g), tdModel(w).total, '한 줄 = 한 가지 일');
  assert.ok(h.includes('class="td-strip"'));
  const biz = [...h.matchAll(/<button type="button" class="td-biz [^"]*" data-biz="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(biz.includes('consulting-04') && biz.includes('consulting-05'), '올해 업체가 있는 진행 사업 카드');
  assert.ok(!biz.includes('consulting-01'), '업체 없는 사업은 카드가 없다');
  assert.ok(h.includes('dsh-bar'), '기록을 읽었고 서류 틀이 있으면 단계 막대');
  assert.equal(w.db.쓴것.length, 0);
  assert.ok(w.ctx.GR.gi.st === 'idle', '메일함은 읽지 않았다');
});
function tdModel(w) { return J(w.ctx.GR.td.model); }

test('144 전환 — 사업을 고르면 탭이 사라지고 사업 대시보드 · 같은 사업 다시 누르면 첫 화면 · 「🎯 오늘 할 일」로 돌아온다 · 「📋 전체 현황」은 기존 화면 · 연도를 바꿔도 탭 유지', async () => {
  const w = world();
  await w.ctx.grLoad();
  w.ctx.grSetTab('all');
  assert.equal(w.ctx.GR.tab, 'all');
  assert.equal(w.els.today.style.display, 'none');
  ['kpis', 'filters', 'tbl'].forEach((id) => assert.equal(w.els[id].style.display, '', id + ' 그대로'));
  assert.equal(w.els.alertsSec.style.display, '', '전체 현황에서는 오른쪽 챙길 것이 보인다');
  assert.equal(w.els.tdTabs.style.display, '');
  assert.match(w.els.tdTabs.innerHTML, /data-tab="all"[^>]*aria-selected="true"/);
  w.ctx.grSetYear('2025');
  assert.equal(w.ctx.GR.tab, 'all', '연도를 바꿔도 탭 유지');
  w.ctx.grSetYear('2026');
  w.ctx.grSetTab('today');
  w.ctx.grSetYear('2025');
  assert.equal(w.els.today.style.display, '');
  assert.equal(w.ctx.GR.f.year, '2025');
  w.ctx.grSetYear('2026');
  /* 사업을 고르면 탭 줄·첫 화면이 숨고 지금 동작(2단계 대시보드) */
  w.ctx.grSetBiz('consulting-03');
  assert.equal(w.els.tdTabs.style.display, 'none');
  assert.equal(w.els.today.style.display, 'none');
  ['kpis', 'filters', 'tbl'].forEach((id) => assert.equal(w.els[id].style.display, '', id));
  assert.equal(w.els.alertsSec.style.display, '', '사업을 고르면 오른쪽 챙길 것이 보인다');
  assert.equal(w.els.docs.style.display, '');
  assert.ok(w.els.docs.innerHTML.includes('class="dsh"'));
  assert.match(w.els.biz.innerHTML, /data-home="1"/, '왼쪽 머리 단추');
  assert.doesNotMatch(w.els.biz.innerHTML.match(/<button[^>]*data-home[^>]*>/)[0], /class="[^"]*\bon\b/, '사업을 골랐으면 켜져 있지 않다');
  /* 같은 사업을 다시 누르면 풀려 첫 화면으로 */
  w.ctx.grSetBiz('consulting-03');
  assert.equal(w.ctx.GR.f.biz, '');
  assert.equal(w.els.today.style.display, '');
  /* 「🎯 오늘 할 일」 — 사업을 풀고 탭 today(전체 현황이었어도) */
  w.ctx.grSetTab('all');
  w.ctx.grSetBiz('consulting-03');
  w.ctx.grGoHome();
  assert.equal(w.ctx.GR.f.biz, '');
  assert.equal(w.ctx.GR.tab, 'today');
  assert.equal(w.els.today.style.display, '');
  assert.equal(w.els.kpis.style.display, 'none');
  assert.match(w.els.biz.innerHTML.match(/<button[^>]*data-home[^>]*>/)[0], /class="bz td-home on"/, '첫 화면이 켜져 있으면 on');
  assert.match(w.els.biz.innerHTML, /data-home="1"[^>]*>[\s\S]*?🎯 오늘 할 일[\s\S]*?<b>\d+<\/b>/, '개수');
  /* 사업이 이미 비어 있어도 그대로 다시 그린다 */
  w.ctx.grGoHome();
  assert.equal(w.ctx.GR.f.biz, '');
  assert.equal(w.db.쓴것.length, 0);
  /* 첫 화면 줄 → 서류 열기: 그 사업을 고르고 목차 창 — 이미 고른 사업은 풀지 않는다 */
  w.ctx.grOpenTask('c2', 't3');
  assert.equal(w.ctx.GR.f.biz, 'consulting-04');
  assert.ok(w.ctx.GR.toc && w.ctx.GR.toc.head.coName === '다라정밀', '목차 창이 열렸다');
  assert.equal(w.els.today.style.display, 'none');
  w.ctx.grOpenTask('c2', 't3');
  assert.equal(w.ctx.GR.f.biz, 'consulting-04', '이미 고른 사업은 다시 눌러 풀리지 않는다');
});

test('145 받은 서류 묶음 — idle 은 안내 + 「📥 확인」(메일함 0회) · loading 은 불러오는 중 · ok 는 건수 + 처음 5건 + 서류 칸 열기 · err 는 문구 + 다시 시도', async () => {
  const w = giWorld();
  await w.ctx.grLoad();
  let h = w.els.today.innerHTML;
  assert.match(h, /<button type="button" onclick="grGlobalInbox\(\)">📥 확인<\/button>/);
  assert.ok(h.includes('받은 서류') && h.includes('📬'));
  assert.deepEqual(mailReads(w), [], '첫 화면을 그리는 것만으로는 메일함을 읽지 않는다(연도·탭을 바꿔도)');
  w.ctx.grSetTab('all'); w.ctx.grSetTab('today'); w.ctx.grSetYear('2025'); w.ctx.grSetYear('2026'); w.ctx.grSetBiz('consulting-04'); w.ctx.grGoHome();
  assert.deepEqual(mailReads(w), [], '탭·연도·사업을 바꿔도 읽지 않는다');
  const p = w.ctx.grGlobalInbox();
  assert.ok(w.els.tdInbox.innerHTML.includes('불러오는 중…'), 'loading');
  await p;
  h = w.els.tdInbox.innerHTML;
  assert.ok(/연결 안 된 받은 서류 5건/.test(h), '건수');
  assert.equal(countOf(h, /onclick="grOpenFromInbox\(\d+\)"/g), 5);
  assert.ok(h.includes('onclick="grOpenFromInbox(0)"') && h.includes('서류 칸 열기'));
  assert.ok(!h.includes('전체는 오른쪽'), '5건이면 전부 보인다');
  assert.ok(!h.includes('@'), '주소는 그리지 않는다');
  /* 6건 이상이면 처음 5건 + 안내 */
  const w6 = giWorld({ seed: giSeed({ noLink: true }) });
  await w6.ctx.grLoad(); await w6.ctx.grGlobalInbox();
  const h6 = w6.els.tdInbox.innerHTML;
  assert.equal(countOf(h6, /onclick="grOpenFromInbox\(\d+\)"/g), 5, '처음 5건만');
  assert.ok(h6.includes('연결 안 된 받은 서류 6건') && h6.includes('전체는 오른쪽 📥 받은 서류 확인'));
  /* 연도를 바꾸면 처음 상태 */
  w6.ctx.grSetYear('2025');
  assert.ok(w6.els.today.innerHTML.includes('📥 확인'));
  /* err */
  const we = giWorld({ fail: (p) => p === 'mailbox/folders' });
  await we.ctx.grLoad(); await we.ctx.grGlobalInbox();
  assert.equal(we.ctx.GR.gi.st, 'err');
  assert.match(we.els.tdInbox.innerHTML, /err-s[^]*onclick="grGlobalInbox\(\)">📥 확인<\/button>/, '안내 + 단추(다시 누르면 다시 읽는다)');
  assert.equal(w.db.쓴것.length, 0);
});

test('146 기록을 못 읽으면 — 서명·막힘·기한 줄 0개 + 「일부 할 일을 알 수 없습니다」 · 사업 카드는 막대 없이 업체 수만(가짜 «정상» 없음) · 할 일이 0이어도 «없습니다»라고 하지 않는다', async () => {
  const denied = { once: async () => { throw new Error('permission_denied'); } };
  const w = world({ seed: bigSeed({ track: { t2: { plan: { st: 'blocked' } } } }), db: (db) => ({ ref: (p) => (p === 'scal_docs' ? denied : db.ref(p)) }) });
  await w.ctx.grLoad();
  assert.equal(w.ctx.GR.trackErr, true);
  const h = w.els.today.innerHTML;
  assert.ok(h.includes('기록을 못 불러와 일부 할 일을 알 수 없습니다'));
  assert.ok(!/막혀 있습니다|서명 회신을 기다리는|제출 기한이 지났습니다|기한이 가깝습니다/.test(h), '기록이 있어야 아는 줄은 없다');
  assert.ok(h.includes('보고서를 아직 안 썼습니다'), '현황판 줄만으로 아는 것은 그대로');
  assert.ok(!h.includes('dsh-bar') && !h.includes('정상'), '막대·«정상» 없음');
  assert.match(h, /class="td-biz td-idle"[^>]*>[^]*?업체 \d+곳/, '업체 수만');
  assert.equal(w.ctx.GR.td.known, false);
  /* 할 일이 0 — 기록을 읽었으면 «없습니다», 못 읽었으면 안내만 */
  w.ctx.GR.f.year = '1999'; w.ctx.grRender();
  assert.ok(!w.els.today.innerHTML.includes('오늘 급한 일이 없습니다') && w.els.today.innerHTML.includes('일부 할 일을 알 수 없습니다'));
  const ok = world();
  await ok.ctx.grLoad();
  ok.ctx.GR.f.year = '1999'; ok.ctx.grRender();
  assert.ok(ok.els.today.innerHTML.includes('오늘 급한 일이 없습니다') && !ok.els.today.innerHTML.includes('일부 할 일을 알 수 없습니다'));
  assert.equal(ok.els.today.style.display, '');
  assert.equal(w.db.쓴것.length, 0);
});

test('147 막힘·더 보기·종결·바깥 값 — 막힌 단계는 급함(사업 이름 딱지) · 종결 사업은 줄·카드에서 빠진다 · 묶음마다 8줄 + 더 보기 · 이름은 이스케이프 · 이알피 연결이 없으면 단추 대신 링크', async () => {
  const track = { t2: { plan: { st: 'blocked', note: '<b>메모</b>' } } };
  const w = world({ seed: bigSeed({ track }) });
  await w.ctx.grLoad();
  let h = w.els.today.innerHTML;
  const hot = tdSec(h, 'hot');
  assert.ok(hot.includes('다라정밀 · 수행계획서이(가) 막혀 있습니다'), '막힌 단계 줄');
  assert.ok(hot.includes('일터상생혁신컨설팅'), '딱지에 사업 이름(알림 행에는 없던 것)');
  assert.ok(!h.includes('<b>메모</b>') && h.includes('&#60;b&#62;메모'), '메모는 글자로');
  /* 종결 사업은 줄·카드에서 빠진다 */
  const s = bigSeed({ track }); s.scal_bizState = { 'consulting-02': { closedFrom: '2026', at: 1 } };
  const c = world({ seed: s });
  await c.ctx.grLoad();
  assert.ok(!c.els.today.innerHTML.includes('막혀 있습니다') && !c.els.today.innerHTML.includes('data-biz="consulting-02"'));
  /* 이름은 이스케이프 */
  const x = bigSeed({ track }); x.scal_cos.filter((k) => k.id === 'c2')[0].name = '<img src=x onerror=1>';
  const xw = world({ seed: x });
  await xw.ctx.grLoad();
  assert.ok(!xw.els.today.innerHTML.includes('<img') && xw.els.today.innerHTML.includes('&#60;img src=x'));
  /* 더 보기 — 한 묶음 8줄까지, 나머지는 단추 */
  const many = world();
  await many.ctx.grLoad();
  const g = many.ctx.GR;
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ id: 'overdue|k' + i + '|t1', kind: 'overdue', level: 'hot', coId: 'k' + i, typeId: 't1', coName: '합성' + i, typeName: '가', title: '합성' + i + ' · 제출 기한이 지났습니다', meta: '가', tags: ['가', '제출'], days: 20 - i }));
  g.td = { model: { hot: mk(11), mid: [], low: [], total: 11 }, strip: [], known: true };
  many.ctx.grRenderToday();
  h = many.els.today.innerHTML;
  assert.equal(countOf(h, /class="td-task/g), 8, '처음 8줄');
  assert.match(h, /<button type="button" class="act" data-td-more="hot">더 보기 \(\+3\)<\/button>/);
  g.todayMore = { hot: 9999 };
  many.ctx.grRenderToday();
  assert.equal(countOf(many.els.today.innerHTML, /class="td-task/g), 11);
  assert.ok(!many.els.today.innerHTML.includes('data-td-more'));
  /* 이알피 연결이 없으면(이음표 없음) 단추 대신 정부사업일정 링크 */
  const nm = F.seed(); delete nm.scal_erpTypeMap['consulting-04'];
  const nw = world({ seed: nm });
  await nw.ctx.grLoad();
  const nh = nw.els.today.innerHTML;
  assert.ok(nh.includes('<a class="act" href="gov-consulting.html#rpt=c2|t3"'), '링크');
  assert.ok(!nh.includes('data-td-open="1" data-co="c2" data-ty="t3"'));
});

test('148 탭 저장 — localStorage gov_home_tab 은 all 만 인정 · 막혀도 던지지 않는다 · 읽기 거절이어도 이번 탭은 바뀐다', async () => {
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  const w = world({ ls });
  await w.ctx.grLoad();
  assert.equal(w.ctx.GR.tab, 'today');
  w.ctx.grSetTab('all');
  assert.equal(store.gov_home_tab, 'all');
  store.gov_home_tab = 'all'; w.ctx.grLoadTab(); assert.equal(w.ctx.GR.tab, 'all');
  store.gov_home_tab = 'zzz'; w.ctx.grLoadTab(); assert.equal(w.ctx.GR.tab, 'today');
  store.gov_home_tab = 'today'; w.ctx.grLoadTab(); assert.equal(w.ctx.GR.tab, 'today');
  w.ctx.grSetTab('이상한'); assert.equal(w.ctx.GR.tab, 'today');
  const bad = world({ ls: { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } } });
  await bad.ctx.grLoad();
  bad.ctx.grLoadTab();
  assert.equal(bad.ctx.GR.tab, 'today');
  bad.ctx.grSetTab('all');
  assert.equal(bad.ctx.GR.tab, 'all', '저장은 못 해도 이번 탭은 바뀐다');
  assert.equal(bad.els.today.style.display, 'none');
  const none = world();
  await none.ctx.grLoad();
  none.ctx.grLoadTab(); none.ctx.grSetTab('all');
  assert.equal(none.ctx.GR.tab, 'all');
  assert.equal(w.db.쓴것.length, 0);
});

/* ═══ 수정 라운드 1 — 못 읽은 자료를 «정상»으로 말하지 않는다 · 계산 캐시 · 종결된 이알피 사업을 고르지 않는다 · 대형 지난 기한 · «기한 14일 안» · 더 보기 되돌리기 ═══ */
const deniedAt = (path) => (db) => ({ ref: (p) => (p === path ? { once: async () => { throw new Error('permission_denied'); } } : db.ref(p)) });
const TD_REAL = require('../js/pu-gov-report-today.js');

test('149 사업 목록·이음표·계약을 못 읽으면 첫 화면이 원인별로 알린다 — 가짜 «진행 사업이 없습니다»·«오늘 급한 일이 없습니다» 없음 · 다시 시도는 grRetryDocs', async () => {
  /* 사업 목록(data/biz_cons_types) */
  const a = world({ db: deniedAt('data/biz_cons_types') });
  await a.ctx.grLoad();
  assert.equal(a.ctx.GR.docs.err, true);
  assert.equal(a.ctx.GR.td.known, false);
  let h = a.els.today.innerHTML;
  assert.ok(h.includes('사업 목록을 못 불러왔습니다'), '카드 띠 자리');
  assert.match(h, /<button type="button" onclick="grRetryDocs\(\)">다시 시도<\/button>/);
  assert.ok(h.includes('사업 목록을 못 불러와 일부 할 일을 알 수 없습니다'));
  assert.ok(!h.includes('진행 사업이 없습니다') && !h.includes('data-biz='), '가짜 «없음» 없음');
  assert.ok(!h.includes('서명 회신을 기다리는'), '기록·사업 목록이 있어야 아는 줄은 없다');
  assert.ok(h.includes('보고서를 아직 안 썼습니다'), '현황판 줄만으로 아는 것은 그대로');
  a.ctx.GR.f.year = '1999'; a.ctx.grRender();
  assert.ok(!a.els.today.innerHTML.includes('오늘 급한 일이 없습니다'), '못 읽었으면 «없습니다» 라고 하지 않는다');
  /* 이음표(scal_erpTypeMap) */
  const b = world({ db: deniedAt('scal_erpTypeMap') });
  await b.ctx.grLoad();
  assert.equal(b.ctx.GR.docs.err, false);
  assert.equal(b.ctx.GR.docs.bad.tmap, true);
  assert.equal(b.ctx.GR.td.known, false);
  assert.equal(b.ctx.GR.td.stripErr, 'tmap');
  h = b.els.today.innerHTML;
  assert.ok(h.includes('푸른이알피 사업 연결을 못 불러와 사업 카드를 만들 수 없습니다') && h.includes('푸른이알피 사업 연결(이음표)을 못 불러와 일부 할 일을 알 수 없습니다'));
  assert.ok(h.includes('grRetryDocs()') && !h.includes('진행 사업이 없습니다'));
  b.ctx.GR.f.year = '1999'; b.ctx.grRender();
  assert.ok(!b.els.today.innerHTML.includes('오늘 급한 일이 없습니다'));
  /* 계약(data/consultings) — 기한을 모른다 */
  const c = world({ db: deniedAt('data/consultings') });
  await c.ctx.grLoad();
  assert.equal(c.ctx.GR.td.known, false);
  assert.ok(c.els.today.innerHTML.includes('계약 정보를 못 불러와 일부 할 일을 알 수 없습니다'));
  /* 대조 — 읽었는데 비어 있는 이음표({})는 «못 읽음» 이 아니다 */
  const s = F.seed(); s.scal_erpTypeMap = {};
  const e = world({ seed: s });
  await e.ctx.grLoad();
  assert.ok(!e.ctx.GR.docs.bad.tmap, '읽은 빈 노드');
  assert.equal(e.ctx.GR.td.known, true);
  assert.equal(e.ctx.GR.td.stripErr, '');
  assert.ok(!e.els.today.innerHTML.includes('일부 할 일을 알 수 없습니다'));
  /* 다시 시도 — 읽을 수 있게 되면 안내가 사라진다 */
  const flaky = { fail: true };
  const r = world({ db: (db) => ({ ref: (p) => (p === 'data/biz_cons_types' && flaky.fail ? { once: async () => { throw new Error('permission_denied'); } } : db.ref(p)) }) });
  await r.ctx.grLoad();
  assert.ok(r.els.today.innerHTML.includes('사업 목록을 못 불러왔습니다'));
  flaky.fail = false;
  await r.ctx.grRetryDocs();
  assert.ok(!r.els.today.innerHTML.includes('사업 목록을 못 불러왔습니다') && r.els.today.innerHTML.includes('data-biz="consulting-04"'), '다시 읽으면 카드 띠가 돌아온다');
  assert.equal(a.db.쓴것.length, 0);
});

test('149-2 사업 하나가 docsTable 에서 던지면 그 사업만 건너뛴다 — known 은 그대로 · «일부 사업을 읽지 못했습니다» 한 줄 · 건너뛴 게 있으면 «없습니다» 라고 하지 않는다', async () => {
  const w = world();
  w.ctx.PuGovReportDocs = Object.assign({}, D, { docsTable() { throw new Error('boom'); } });
  await w.ctx.grLoad();
  const td = w.ctx.GR.td;
  assert.equal(td.known, true, 'known 을 낮추지 않는다');
  assert.ok(td.skipped >= 3);
  const h = w.els.today.innerHTML;
  assert.ok(h.includes('일부 사업을 읽지 못했습니다'));
  assert.ok(h.includes('보고서를 아직 안 썼습니다'), '나머지 줄은 그대로');
  assert.match(h, /class="td-biz td-idle"/, '건너뛴 사업도 카드는 업체 수만으로');
  w.ctx.GR.td = { model: { hot: [], mid: [], low: [], total: 0 }, strip: [], known: true, why: [], stripErr: '', skipped: 2 };
  w.ctx.grRenderToday();
  assert.ok(!w.els.today.innerHTML.includes('오늘 급한 일이 없습니다'), '건너뛴 사업이 있으면 없다고 하지 않는다');
  w.ctx.GR.td.skipped = 0; w.ctx.grRenderToday();
  assert.ok(w.els.today.innerHTML.includes('오늘 급한 일이 없습니다'), '모두 읽었고 줄이 0 일 때만');
});

test('150 계산 캐시 — 거르개·탭·사업 선택·검색으로는 다시 세지 않고, 연도·오늘·자료(불러오기·기록 저장)가 바뀌면 다시 센다', async () => {
  const w = world({ email: 'p009@pureun.kr' });
  let n = 0;
  w.ctx.PuGovReportToday = Object.assign({}, TD_REAL, { build(o) { n++; return TD_REAL.build(o); } });
  await w.ctx.grLoad();
  const n0 = n;
  assert.ok(n0 >= 1);
  const tabN = w.els.tdTabs.innerHTML.match(/<b>(\d+)<\/b>/)[1];
  for (let i = 0; i < 3; i++) w.ctx.grRender();
  w.ctx.GR.f.co = '가'; w.ctx.grRender();
  w.ctx.GR.f.status = 'todo'; w.ctx.GR.f.att = 'a1'; w.ctx.GR.f.mine = true; w.ctx.GR.f.type = 't1'; w.ctx.grRender();
  w.ctx.grSetTab('all'); w.ctx.grSetBiz('consulting-03'); w.ctx.grSetBiz('consulting-03'); w.ctx.grGoHome();
  assert.equal(n, n0, '같은 열쇠로 그리기 여러 번 — 계산은 한 번');
  assert.equal(w.els.tdTabs.innerHTML.match(/<b>(\d+)<\/b>/)[1], tabN, '탭 숫자는 캐시 결과');
  /* 연도 */
  w.ctx.grSetYear('2025'); assert.equal(n, n0 + 1, '연도를 바꾸면 다시');
  w.ctx.grSetYear('2025'); w.ctx.grRender(); assert.equal(n, n0 + 1);
  w.ctx.grSetYear('2026'); assert.equal(n, n0 + 2);
  /* 오늘 날짜 */
  w.ctx.GR.today = '2026-10-11'; w.ctx.grRender(); assert.equal(n, n0 + 3, '날짜가 바뀌면 다시');
  w.ctx.GR.today = '2026-10-10'; w.ctx.grRender(); assert.equal(n, n0 + 4);
  /* 기록 저장 — 서명이 끝나면 «서명 회신 대기» 줄이 사라진다 */
  assert.ok(w.els.today.innerHTML.includes('서명 회신을 기다리는 중입니다'));
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'done'; w.els.cwSent.value = '2026-09-20'; w.els.cwGot.value = '2026-10-08'; w.els.cwNote.value = '';
  const before = n;
  await w.ctx.grSaveCell();
  assert.equal(n, before + 1, '저장 뒤 다시');
  w.ctx.grGoHome();
  assert.ok(!w.els.today.innerHTML.includes('서명 회신을 기다리는 중입니다'), '저장한 기록이 첫 화면에 반영');
  assert.equal(n, before + 1, '돌아와도 다시 세지 않는다');
  /* 기록을 다시 읽으면 */
  await w.ctx.grLoadTrack(); w.ctx.grRender();
  assert.equal(n, before + 2, '기록을 다시 읽으면 다시');
  /* 종결 — 상태가 바뀌면 */
  const bs = n;
  w.ctx.GR.bizState = { 'consulting-05': { closedFrom: '2026', at: 1 } }; w.ctx.GR.dver++; w.ctx.grRender();
  assert.equal(n, bs + 1);
  assert.ok(!w.els.today.innerHTML.includes('data-biz="consulting-05"'), '종결 사업은 카드·줄에서 빠진다');
  assert.equal(w.db.쓴것.length, 1, '쓰기는 기록 저장 한 번뿐');
});

test('151 서류 열기 — 같은 일정 사업에 종결된 이알피 사업이 앞 순서로 이어져 있어도 종결되지 않은 첫째를 고른다 · 모두 종결이면 erpTypeFor 결과', async () => {
  const s = F.seed();
  s.data.biz_cons_types.v.push({ code: 'consulting-12', name: '인사노무컨설팅충남북부상의(옛)', short: '', agency: '', sortOrder: 0 });
  s.scal_erpTypeMap['consulting-12'] = 't3';
  s.scal_bizState = { 'consulting-12': { closedFrom: '2026', at: 1 } };
  const w = world({ seed: s });
  await w.ctx.grLoad();
  const d = w.ctx.GR.docs;
  assert.equal(w.ctx.PuGovReportDocs.erpTypeFor('t3', d.biz, d.tmap).code, 'consulting-12', '전제 — erpTypeFor 는 종결된 사업이 먼저');
  assert.equal(w.ctx.grErpFor('t3').code, 'consulting-04', '종결되지 않은 첫째');
  assert.equal(w.ctx.grErpFor('t1').code, 'consulting-03', '이어진 사업이 하나면 그대로');
  assert.equal(w.ctx.grErpFor('없는사업'), null);
  assert.ok(w.els.today.innerHTML.includes('data-td-open="1" data-co="c2" data-ty="t3"'), '줄 그리기도 같은 판정(단추가 있다)');
  w.ctx.grOpenTask('c2', 't3');
  assert.equal(w.ctx.GR.f.biz, 'consulting-04', '서류 열기가 종결 사업을 고르지 않는다');
  assert.ok(w.ctx.GR.toc && w.ctx.GR.toc.head.coName === '다라정밀');
  /* 이 해에 종결이 아닌(다른 해부터 종결) 사업은 진행으로 본다 */
  s.scal_bizState['consulting-12'] = { closedFrom: '2027', at: 1 };
  const y = world({ seed: s });
  await y.ctx.grLoad();
  assert.equal(y.ctx.grErpFor('t3').code, 'consulting-12', '2026년에는 종결이 아니다 — 첫째 그대로');
  /* 모두 종결 — erpTypeFor 의 첫째(종결 배너가 정상으로 뜬다) */
  s.scal_bizState = { 'consulting-12': { closedFrom: '2026', at: 1 }, 'consulting-04': { closedFrom: '2026', at: 1 } };
  const z = world({ seed: s });
  await z.ctx.grLoad();
  assert.equal(z.ctx.grErpFor('t3').code, 'consulting-12');
  z.ctx.grOpenTask('c2', 't3');
  assert.equal(z.ctx.GR.f.biz, 'consulting-12');
  assert.equal(w.db.쓴것.length, 0);
});

test('152 대형 사업의 지난 기한 — 계약 종료일이 지났고 안 끝난 업체는 급함 줄 · 기록을 못 읽으면 만들지 않는다', async () => {
  const w = world({ seed: bigSeed({ end: '2026-10-05' }) });
  await w.ctx.grLoad();
  const hot = tdSec(w.els.today.innerHTML, 'hot');
  assert.ok(hot.includes('다라정밀 · 제출 기한이 지났습니다'), '대형(산업일자리충남) — 현황판 줄이 없어도');
  assert.ok(hot.includes('기한 2026-10-05 (5일 지남)'));
  assert.ok(hot.includes('data-co="c2" data-ty="t5"'));
  assert.equal(countOf(hot, /다라정밀 · 제출 기한이 지났습니다/g), 1, '한 줄');
  const off = world({ seed: bigSeed({ end: '2026-10-05' }), db: deniedAt('scal_docs') });
  await off.ctx.grLoad();
  assert.ok(!off.els.today.innerHTML.includes('제출 기한이 지났습니다'));
  assert.equal(w.db.쓴것.length, 0);
});

test('153 사업 카드 문구 «기한 14일 안 n» · 「더 보기」 펼침은 연도 변경·「🎯 오늘 할 일」·거르개 풀기에서 되돌아간다', async () => {
  const w = world();
  await w.ctx.grLoad();
  const card = w.els.today.innerHTML.match(/<button type="button" class="td-biz [^"]*" data-biz="consulting-03"[^>]*>[\s\S]*?<\/button>/)[0];
  assert.ok(card.includes('업체 1곳 · 기한 14일 안 1'), '2단계 기준(지난 것 포함)임이 문구에 보인다');
  const open = () => { w.ctx.grTodayMore('hot'); assert.equal(w.ctx.GR.todayMore.hot, 9999); };
  open(); w.ctx.grSetYear('2025'); assert.equal(Object.keys(J(w.ctx.GR.todayMore)).length, 0, '연도 변경');
  open(); w.ctx.grGoHome(); assert.equal(Object.keys(J(w.ctx.GR.todayMore)).length, 0, '「🎯 오늘 할 일」');
  open(); w.ctx.grSetTab('all'); w.ctx.grSetTab('today'); assert.equal(w.ctx.GR.todayMore.hot, 9999, '탭을 오가는 것만으로는 그대로');
  open(); w.ctx.grReset(); assert.equal(Object.keys(J(w.ctx.GR.todayMore)).length, 0, '거르개 풀기');
});

/* ══ 사업 순서 — 이알피 순서 · 끌어서 바꾸기 · 현황판 사업 묶음 정렬 (2026-10-12, UI 4단계 Task 2) — 계획 docs/superpowers/plans/2026-10-12-gov-report-order.md ══
   쓰기 자리 = scal_bizOrder/main 한 문서(GR_BIZ.orderNode·orderKey) — 읽기는 통째 한 번, 쓰기는 grSaveBizOrder 의 .set 하나.
   끌기는 브라우저 이벤트를 흉내 낸다: grDragBiz(e) 를 직접 부른다(e.type · e.target.closest · e.clientY · e.dataTransfer · e.preventDefault) */
const ORDER_FAIL = '저장하지 못했습니다 — 관리자만 사업 순서를 바꿀 수 있습니다';
function ordSeed(o) {
  o = o || {};
  const s = navSeed(o.seedOpt);
  if (o.more) {   // 04 충남북부에 업체 하나 더(업체 수가 가장 많아진다) + 이알피에 이어지지 않은 일정 사업 t10 한 줄
    s.scal_cos.push({ id: 'c8', name: '차카공업', types: ['t3'], defAtt: 'a1' }, { id: 'c9', name: '카타상회', types: ['t10'], defAtt: 'a1' }, { id: 'c10', name: '파하물산', types: ['t11'], defAtt: 'a1' });
    s.scal_types.push({ id: 't10', name: '기술보호', fullName: '기술보호 컨설팅(연결 없음 가)', agency: '', rounds: 3 }, { id: 't11', name: '기술보호', fullName: '기술보호 컨설팅(연결 없음 나)', agency: '', rounds: 3 });   // 이름이 기술보호라 현황판 줄은 생기지만 scal_erpTypeMap 에는 없다
    s.scal_scheds.push({ id: 's40', coId: 'c8', typeId: 't3', date: '2026-03-02', round: 1, isField: true },
      { id: 's41', coId: 'c9', typeId: 't10', date: '2026-02-02', round: 1, isField: true }, { id: 's42', coId: 'c10', typeId: 't11', date: '2026-02-03', round: 1, isField: true }, { id: 's43', coId: 'c9', typeId: 't10', date: '2026-03-03', round: 2, isField: true });
  }
  s.scal_bizState = CLOSED05;   // 05 서산은 종결 — 2026 진행 사업은 02·03·04·14·15 다섯(123번과 같은 전제)
  if (o.order !== undefined) s.scal_bizOrder = { main: o.order };
  return s;
}
/* o.order = 처음부터 DB 에 있는 순서 문서 · o.denyRead / o.denyWrite = 규칙 거절 흉내 · o.gate = 쓰기를 붙잡아 두는 약속({p}) */
function ordWorld(o) {
  o = o || {};
  const paths = [];
  const w = world({ seed: o.seed || ordSeed(o), email: o.email === undefined ? 'p009@pureun.kr' : o.email, db: (db) => ({ ref: (p) => {
    paths.push(p);
    const r = db.ref(p);
    if (p.indexOf('scal_bizOrder') !== 0) return r;
    if (o.denyRead && p === 'scal_bizOrder') return { once: async () => { throw new Error('permission_denied'); } };
    if (o.denyWrite) return { once: r.once, set: async () => { if (o.gate) await o.gate.p; throw new Error('permission_denied'); } };
    if (o.gate) return { once: r.once, set: async (v) => { await o.gate.p; return r.set(v); } };
    return r;
  } }) });
  w.paths = paths;
  return w;
}
/* 가짜 항목(.bz) — 속성·classList·위치(위쪽 100, 높이 20 → 가운데 110)만 */
function bzEl(code, grp) {
  const cls = new Set();
  return { cls, getAttribute: (k) => ({ 'data-biz': code, 'data-grp': grp })[k],
    classList: { add: (...c) => c.forEach((x) => cls.add(x)), toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); } },
    getBoundingClientRect: () => ({ top: 100, height: 20 }) };
}
const DRAG_TYPE = 'application/x-gr-biz';   // 우리 항목을 끌 때만 dataTransfer 에 실리는 전용 형식(값 = 사업 코드)
let LAST_DRAG = '';
/* 브라우저는 dragstart 에서 실은 데이터를 같은 끌기의 dragover·drop 에 그대로 준다 — 마지막 dragstart 의 코드를 흉내. o.external = 다른 앱에서 끌어온 글자(전용 형식 없음) */
function dragEv(type, el, y, o) {
  o = o || {};
  if (type === 'dragstart' && el && el.getAttribute('data-biz')) LAST_DRAG = el.getAttribute('data-biz');
  const data = o.external ? { 'text/plain': '외부 글자' } : ((type === 'dragover' || type === 'drop') ? { [DRAG_TYPE]: LAST_DRAG } : {});
  return { type, clientY: y, relatedTarget: o.related || null, prevented: false, data, preventDefault() { this.prevented = true; },
    target: { closest: (sel) => (el && sel.indexOf('.bz') >= 0 ? el : null) },
    dataTransfer: { effectAllowed: '', dropEffect: '', get types() { return Object.keys(data); }, setData: (k, v) => { data[k] = v; }, getData: (k) => data[k] } };
}
const BEFORE = 105, AFTER = 115;   // 항목 위쪽 절반 · 아래쪽 절반
const bizCodes = (h) => [...h.matchAll(/data-biz="([^"]+)"/g)].map((m) => m[1]);
const rowTypes = (w) => [...w.els.rows.innerHTML.matchAll(/data-toc="1" data-co="[^"]*" data-ty="([^"]+)"/g)].map((m) => m[1]);

test('154 정적 — 순서 쓰기는 GR_BIZ.orderNode·orderKey 한 자리 .set 하나(grSaveBizOrder) · 읽기는 통째 한 번 · 이름 표로 부른다 · 끌기 위임 다섯 · 항목 draggable·data-grp · N.build 는 모두 order · 묶음 머리만 펼침·접힘', () => {
  [...SRC.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach((m, i) => assert.doesNotThrow(() => new vm.Script(m[1]), '인라인 스크립트 ' + i + ' 번이 문법 오류 없이 읽힌다(닫히지 않은 주석 등)'));
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES, '쓰기 명령은 .set 넷 — 서류 줄 · 종결 · 되돌림 · 순서');
  assert.doesNotMatch(INLINE, /\.(update|transaction|remove)\s*\(|ref\([^)]*\)\.push\(/, '그 밖의 쓰기 명령이 있다');
  assert.doesNotMatch(SRC, /\.remove\s*\(/, '.remove( 는 없다');
  assert.match(SRC, /orderNode:'scal_bizOrder',orderKey:'main'/);
  assert.equal(Nav.ORDER_NODE_KEY, 'main', '모듈의 문서 이름과 같다');
  assert.doesNotMatch(INLINE, /ref\(\s*['"]scal_bizOrder/, 'GR_BIZ 를 거치지 않았다');
  const sv = grab('grSaveBizOrder');
  assert.match(sv, /fbDb\.ref\(GR_BIZ\.orderNode\+'\/'\+GR_BIZ\.orderKey\)\.set\(entry\)/);
  assert.equal((sv.match(/ref\(/g) || []).length, 1, '순서 문서 한 길만 쓴다');
  assert.match(sv, /Nav\.orderEntry\(|N\.orderEntry\(/, '기록은 Nav.orderEntry 로 만든다');
  assert.doesNotMatch(sv, /scal_docs|GR_TRACK_NODES|GR_NODES|GR_DOC_NODES|GR_BIZ\.node\b/, '다른 자리를 쓰지 않는다');
  assert.match(grab('grLoadBizOrder'), /fbDb\.ref\(GR_BIZ\.orderNode\)\.once\('value'\)/, '읽기는 통째 한 번');
  assert.match(grab('grLoadBizOrder'), /parseOrder\(/);
  assert.match(grab('grLoadBizState'), /grLoadBizOrder\(\)/, '종결 표시를 읽을 때 같이 읽는다');
  ['grRenderBiz', 'grBizBtn', 'grDragBiz', 'grDragMark', 'grDropAfter', 'grLoadBizState', 'grView', 'grByBiz', 'grRenderRows'].forEach((n) =>
    assert.doesNotMatch(grab(n).replace(/fbDb\.ref\(GR_BIZ\.node\)\.once\('value'\)/, ''), /fbDb|\.set\(|\.update\(|\.remove\(|\.transaction\(|fetch\(/, n + ' 이 직접 읽고 쓴다'));
  /* 항목 · 위임 */
  assert.match(grab('grBizBtn'), /draggable="true"/);
  assert.match(grab('grBizBtn'), /data-grp="'\+grEsc\(grp\)\+'"/, '묶음 키는 이스케이프');
  assert.ok(SRC.includes("['dragstart','dragover','dragleave','drop','dragend'].forEach(function(t){ $('biz').addEventListener(t,grDragBiz); });"), '끌기 이벤트 다섯을 #biz 한 곳에서 위임');
  assert.match(SRC, /closest\('\.bz-t\[data-grp\]'\)/, '묶음 머리(summary)만 펼침·접힘 — 항목의 data-grp 는 눌러도 접히지 않는다');
  assert.doesNotMatch(SRC, /closest\('\[data-grp\]'\)/);
  assert.ok(SRC.includes('⇅ 끌어서 순서를 바꿉니다'));
  /* PuGovReportNav.build 를 부르는 곳은 모두 order 를 넘긴다 */
  const calls = INLINE.match(/(?:PuGovReportNav|N)\.build\(\{[^}]*\}\)/g) || [];
  assert.ok(calls.length >= 3, 'build 호출 — 왼쪽 목록 · 연도 막대 · 오늘 할 일');
  calls.forEach((c) => assert.ok(c.includes('order:GR.bizOrder'), c));
  /* 새 CSS 는 색을 직접 지정하지 않는다 */
  const css = SRC.match(/\.bz\.drop-before[^}]*\}|\.bz\.drop-after[^}]*\}|\.bz-hint[^}]*\}/g) || [];
  /* ≥ 3 — 폰 덩이가 안내 줄을 숨기는 규칙(.bz-hint{display:none})을 더할 수 있다(2026-10-18 폰화면관리). 개수가 아니라 «셋이 다 있고 색을 안 쓴다»를 본다 */
  assert.ok(css.length >= 3, '놓을 자리 표시 둘 · 안내 한 줄');
  css.forEach((c) => assert.doesNotMatch(c, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, c));
});

test('155 순서 — 정한 순서가 없으면 이알피 순서(업체 수와 무관) · 있으면 그 목록이 앞, 없는 사업이 뒤 · 안내 한 줄 · 읽기만', async () => {
  const w = ordWorld({ more: true });
  await w.ctx.grLoad();
  assert.deepEqual(J(w.ctx.GR.bizOrder), [], '정한 순서 없음');
  const h = w.els.biz.innerHTML;
  assert.deepEqual(bizCodes(openSec(h)), ['consulting-02', 'consulting-03', 'consulting-04', 'consulting-14', 'consulting-15'], '이알피 순서 — 업체가 둘인 04 가 앞서지 않는다');
  assert.ok(bizBtn(h, 'consulting-04').includes('<b>2</b>'), '준비 — 04 는 업체가 둘이다');
  assert.ok(h.includes('<div class="bz-hint">⇅ 끌어서 순서를 바꿉니다</div>'));
  assert.ok(h.indexOf('bz-hint') < h.indexOf('진행 사업'), '안내는 목록 머리');
  assert.ok(!h.includes('class="err-s"'), '오류 줄 없음');
  assert.equal(w.paths.filter((p) => p === 'scal_bizOrder').length, 1, '통째 한 번');
  assert.equal(w.db.쓴것.length, 0, '읽기만');
  const o = ordWorld({ more: true, order: { list: 'consulting-15,consulting-04,consulting-99,consulting-02', by: '홍길동', at: 1 } });
  await o.ctx.grLoad();
  assert.deepEqual(J(o.ctx.GR.bizOrder), ['consulting-15', 'consulting-04', 'consulting-99', 'consulting-02'], '읽은 값은 parseOrder 로 걸러 담는다(사라진 코드도 그대로 담지만 그리지는 않는다)');
  const oh = o.els.biz.innerHTML;
  assert.deepEqual(bizCodes(openSec(oh)), ['consulting-15', 'consulting-04', 'consulting-02', 'consulting-03', 'consulting-14'], '목록의 사업이 그 순서로 앞 · 나머지는 이알피 순서');
  assert.ok(!oh.includes('consulting-99'), '지워진 사업은 그리지 않는다');
  assert.deepEqual(bizCodes(grpOf(oh, 'unlinked')).slice(0, 3), ['consulting-01', 'consulting-06', 'consulting-07'], '다른 묶음은 이알피 순서 그대로');
  /* 이상한 값 — 던지지 않고 순서 없음 */
  for (const bad of ['list', { list: 5 }, { list: '__proto__,<b>,,x y' }, [1, 2], null]) {
    const v = ordWorld({ order: bad });
    await v.ctx.grLoad();
    assert.equal(v.ctx.GR.loaded, true);
    assert.deepEqual(bizCodes(openSec(v.els.biz.innerHTML)), ['consulting-02', 'consulting-03', 'consulting-04', 'consulting-14', 'consulting-15']);
  }
});

test('156 순서를 못 읽으면(규칙 게시 전·권한) «정한 순서 없음» 으로 돈다 — 오류 줄 없음 · 종결 표시 읽기와 따로', async () => {
  const w = ordWorld({ denyRead: true, order: { list: 'consulting-15,consulting-02' } });
  await w.ctx.grLoad();
  assert.equal(w.ctx.GR.loaded, true); assert.equal(w.ctx.GR.err, '');
  assert.deepEqual(J(w.ctx.GR.bizOrder), []);
  const h = w.els.biz.innerHTML;
  assert.deepEqual(bizCodes(openSec(h)), ['consulting-02', 'consulting-03', 'consulting-04', 'consulting-14', 'consulting-15']);
  assert.ok(!h.includes('class="err-s"') && !h.includes('불러오지 못했습니다'));
  assert.equal(w.els.err.style.display, 'none');
  assert.equal(w.db.쓴것.length, 0);
});

test('157 끌어서 놓기 — 같은 묶음 항목 위·아래 절반 표시 · 놓으면 새 전체 순서를 .set 한 번(scal_bizOrder/main) · 화면이 바뀐다 · 다른 묶음·자기 자신·바뀐 게 없는 놓기는 무시', async () => {
  const w = ordWorld();
  await w.ctx.grLoad();
  const g = w.ctx.GR, d = g.docs;
  const src = bzEl('consulting-15', 'open'), t02 = bzEl('consulting-02', 'open'), t03 = bzEl('consulting-03', 'open'), q12 = bzEl('consulting-12', 'quiet');
  /* 시작 */
  const s = dragEv('dragstart', src, 0);
  w.ctx.grDragBiz(s);
  assert.deepEqual(J(g.drag), { code: 'consulting-15', grp: 'open' });
  assert.equal(s.data[DRAG_TYPE], 'consulting-15'); assert.ok(!('text/plain' in s.data), '다른 앱에 글자로 붙지 않는다'); assert.equal(s.dataTransfer.effectAllowed, 'move');
  /* 위로 지나가기 — 같은 묶음만 허락, 위/아래 절반 표시 */
  let ev = dragEv('dragover', t02, BEFORE); w.ctx.grDragBiz(ev);
  assert.ok(ev.prevented && ev.dataTransfer.dropEffect === 'move'); assert.ok(t02.cls.has('drop-before') && !t02.cls.has('drop-after'));
  ev = dragEv('dragover', t03, AFTER); w.ctx.grDragBiz(ev);
  assert.ok(ev.prevented && t03.cls.has('drop-after')); assert.ok(!t02.cls.has('drop-before') && !t02.cls.has('drop-after'), '표시는 한 곳에만 — 다른 항목에서는 지워진다(실제 DOM 은 grDragMark 가 querySelectorAll 로 지운다)');
  ev = dragEv('dragover', q12, BEFORE); w.ctx.grDragBiz(ev);
  assert.ok(!ev.prevented, '다른 묶음 항목 위에서는 놓을 수 없다(표시 없음)'); assert.equal(q12.cls.size, 0);
  ev = dragEv('dragover', src, BEFORE); w.ctx.grDragBiz(ev);
  assert.ok(!ev.prevented, '자기 자신 위에도 놓을 수 없다');
  ev = dragEv('dragleave', t03, 0); w.ctx.grDragBiz(ev); assert.ok(!ev.prevented);
  /* 무시되는 놓기 — 쓰기 없음, 상태 그대로 */
  w.ctx.grDragBiz(dragEv('drop', q12, BEFORE));
  assert.equal(g.drag, null, '놓으면(어디든) 끌기 상태는 끝난다');
  w.ctx.grDragBiz(dragEv('dragstart', src, 0)); w.ctx.grDragBiz(dragEv('drop', src, BEFORE));
  w.ctx.grDragBiz(dragEv('dragstart', t02, 0)); w.ctx.grDragBiz(dragEv('drop', t03, BEFORE));   // 02 는 이미 03 앞 — 바뀐 게 없다
  w.ctx.grDragBiz(dragEv('drop', t03, BEFORE));   // 끌기 시작 없이 놓기
  w.ctx.grDragBiz(dragEv('dragstart', { getAttribute: () => null }, 0)); assert.equal(g.drag, null, '항목이 아닌 곳에서 시작한 끌기는 무시');
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(w.db.쓴것.length, 0); assert.deepEqual(J(g.bizOrder), []);
  /* 진짜 놓기 — 15 를 02 앞으로 */
  const expect = Nav.reorder({ biz: d.biz, order: [] }, 'consulting-15', 'consulting-02', false);
  assert.deepEqual(expect.slice(0, 3), ['consulting-01', 'consulting-15', 'consulting-02'], '준비 — 전체 순서에서 02 바로 앞');
  const dver = g.dver;
  w.ctx.grDragBiz(dragEv('dragstart', src, 0));
  const drop = dragEv('drop', t02, BEFORE);
  const p = w.ctx.grDragBiz(drop);
  assert.ok(drop.prevented, '놓기는 동기로 막는다(브라우저 기본 동작 없음)');
  assert.deepEqual(J(g.bizOrder), expect, '낙관적 갱신 — 저장을 기다리지 않고 바뀐다');
  assert.deepEqual(bizCodes(openSec(w.els.biz.innerHTML)), ['consulting-15', 'consulting-02', 'consulting-03', 'consulting-04', 'consulting-14']);
  assert.ok(g.dver > dver, '자료 버전이 오른다(오늘 할 일 캐시)');
  await p;
  assert.equal(w.db.쓴것.length, 1, '쓰기는 한 번'); const wr = J(w.db.쓴것[0]);
  assert.equal(wr.자리, 'scal_bizOrder/main'); assert.ok(!wr.update && !wr.transaction);
  assert.deepEqual(Object.keys(wr.값).sort(), ['at', 'by', 'list']);
  assert.equal(wr.값.list, expect.join(',')); assert.equal(wr.값.by, '홍길동'); assert.equal(typeof wr.값.at, 'number');
  assert.deepEqual(Nav.parseOrder(J(w.db.읽기('scal_bizOrder/main'))), expect, '진짜로 저장됐다');
  assert.equal(g.bbmsg, ''); assert.equal(g.obusy, false);
  assert.ok(!w.els.biz.innerHTML.includes('class="err-s"'));
  /* 다시 — 02 를 15 앞으로(= 15,02 가 02,15 로) */
  w.ctx.grDragBiz(dragEv('dragstart', t02, 0));
  await w.ctx.grDragBiz(dragEv('drop', bzEl('consulting-15', 'open'), BEFORE));
  assert.equal(w.db.쓴것.length, 2);
  assert.deepEqual(bizCodes(openSec(w.els.biz.innerHTML)), ['consulting-02', 'consulting-15', 'consulting-03', 'consulting-04', 'consulting-14']);
  assert.deepEqual(J(g.bizOrder), Nav.reorder({ biz: d.biz, order: expect }, 'consulting-02', 'consulting-15', false));
  /* 새로 열어도 그 순서 */
  const w2 = ordWorld({ order: J(w.db.읽기('scal_bizOrder/main')) });
  await w2.ctx.grLoad();
  assert.deepEqual(bizCodes(openSec(w2.els.biz.innerHTML)), ['consulting-02', 'consulting-15', 'consulting-03', 'consulting-04', 'consulting-14']);
  /* 다른 묶음 안(연결 없음 묶음)에서도 된다 */
  const u = ordWorld();
  await u.ctx.grLoad();
  u.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-01', 'unlinked'), 0));
  await u.ctx.grDragBiz(dragEv('drop', bzEl('consulting-06', 'unlinked'), AFTER));
  assert.equal(u.db.쓴것.length, 1);
  const ub = bizCodes(grpOf(u.els.biz.innerHTML, 'unlinked'));
  assert.ok(ub.indexOf('consulting-06') < ub.indexOf('consulting-01') && ub.indexOf('consulting-01') < ub.indexOf('consulting-07'), '06 뒤 · 07 앞');
});

test('158 저장이 거절되면(직원 계정·규칙 게시 전) 원래 순서로 돌아가고 안내가 보인다 · 저장하는 동안에는 새 끌기를 받지 않는다 · 다시 끌어 볼 수 있다', async () => {
  let release; const gate = { p: new Promise((r) => { release = r; }) };
  const w = ordWorld({ denyWrite: true, gate });
  await w.ctx.grLoad();
  const g = w.ctx.GR, before = bizCodes(openSec(w.els.biz.innerHTML));
  w.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-15', 'open'), 0));
  const p = w.ctx.grDragBiz(dragEv('drop', bzEl('consulting-02', 'open'), BEFORE));
  assert.equal(g.obusy, true);
  assert.deepEqual(bizCodes(openSec(w.els.biz.innerHTML)).slice(0, 2), ['consulting-15', 'consulting-02'], '저장을 기다리는 동안은 새 순서');
  const s2 = dragEv('dragstart', bzEl('consulting-04', 'open'), 0); w.ctx.grDragBiz(s2);
  assert.ok(s2.prevented && g.drag === null, '저장하는 동안에는 새 끌기를 막는다');
  release(); await p;
  assert.deepEqual(J(g.bizOrder), [], '이전 목록으로 복원');
  assert.deepEqual(bizCodes(openSec(w.els.biz.innerHTML)), before);
  assert.equal(g.bbmsg, ORDER_FAIL); assert.equal(g.obusy, false);
  assert.ok(w.els.biz.innerHTML.includes('<div class="err-s">' + ORDER_FAIL + '</div>'), '안내 줄이 목록 위에 보인다');
  assert.ok(w.els.biz.innerHTML.indexOf('err-s') < w.els.biz.innerHTML.indexOf('진행 사업'));
  assert.equal(w.db.쓴것.length, 0);
  /* 안내는 다음 끌기가 성공하면 사라진다 · 다시 끌 수 있다(잠금이 풀렸다) */
  const ok = ordWorld();
  await ok.ctx.grLoad();
  ok.ctx.GR.bbmsg = ORDER_FAIL;
  ok.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-15', 'open'), 0));
  await ok.ctx.grDragBiz(dragEv('drop', bzEl('consulting-02', 'open'), BEFORE));
  assert.equal(ok.ctx.GR.bbmsg, ''); assert.ok(!ok.els.biz.innerHTML.includes('class="err-s"'));
  /* 거절 뒤 복원은 그 사이 바뀐 목록을 덮지 않는다 */
  const w3 = ordWorld({ denyWrite: true });
  await w3.ctx.grLoad();
  w3.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-15', 'open'), 0));
  await w3.ctx.grDragBiz(dragEv('drop', bzEl('consulting-02', 'open'), BEFORE));
  assert.deepEqual(J(w3.ctx.GR.bizOrder), [], '원래대로'); assert.equal(w3.ctx.GR.obusy, false);
  w3.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-14', 'open'), 0)); assert.equal(w3.ctx.GR.drag.code, 'consulting-14', '다시 끌 수 있다');
});

test('159 저장할 수 없는 목록(순서 기록을 못 만듦)은 쓰지 않고 되돌린다 · 목록이 비면 쓰지 않는다(Nav.orderEntry 가 null)', async () => {
  const s = ordSeed();
  s.data.biz_cons_types.v.push({ code: 'consulting 16', name: '코드에 공백', short: '', agency: '', sortOrder: 16 });   // 규칙 열쇠 꼴이 아닌 코드
  const w = ordWorld({ seed: s });
  await w.ctx.grLoad();
  assert.ok(bizCodes(w.els.biz.innerHTML).includes('consulting 16'), '준비 — 목록에는 보인다');
  w.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-15', 'open'), 0));
  await w.ctx.grDragBiz(dragEv('drop', bzEl('consulting-02', 'open'), BEFORE));
  assert.equal(w.db.쓴것.length, 0, '쓰기 없음'); assert.deepEqual(J(w.ctx.GR.bizOrder), [], '되돌렸다');
  assert.ok(w.ctx.GR.bbmsg && w.ctx.GR.bbmsg !== ORDER_FAIL, '관리자 탓이 아닌 다른 안내'); assert.equal(w.ctx.GR.obusy, false);
  assert.equal(await w.ctx.grSaveBizOrder([]), null); assert.equal(await w.ctx.grSaveBizOrder(undefined), null);
  assert.equal(w.db.쓴것.length, 0);
  assert.equal(await w.ctx.grSaveBizOrder(['consulting-02']), true);
  assert.equal(w.db.쓴것.length, 1); assert.equal(J(w.db.쓴것[0]).자리, 'scal_bizOrder/main');
});

test('160 순서가 바뀌면 오늘 할 일의 사업 카드 띠 순서도 따라간다(캐시가 낡은 값을 보이지 않는다) · 연도 막대·숫자는 그대로', async () => {
  const w = ordWorld();
  await w.ctx.grLoad();
  const strip = () => [...w.els.today.innerHTML.matchAll(/class="td-biz [^"]*" data-biz="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(strip(), ['consulting-02', 'consulting-03', 'consulting-04', 'consulting-14', 'consulting-15']);
  const yr = w.els.yrbar.innerHTML;
  w.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-15', 'open'), 0));
  await w.ctx.grDragBiz(dragEv('drop', bzEl('consulting-02', 'open'), BEFORE));
  assert.deepEqual(strip(), ['consulting-15', 'consulting-02', 'consulting-03', 'consulting-04', 'consulting-14']);
  assert.equal(w.els.yrbar.innerHTML, yr);
  assert.ok(w.ctx.GR.tdKey.endsWith('|' + w.ctx.GR.dver), '캐시 열쇠는 자료 버전을 담는다');
});

test('161 현황판 표 — 사업 묶음 순서로 정렬(같은 사업 안 순서는 그대로 · 이알피에 안 이어진 사업은 맨 뒤) · 사업이 바뀌는 첫 줄만 class="ng" · 순서를 바꾸면 표도 따라간다', async () => {
  const w = ordWorld({ more: true });
  await w.ctx.grLoad();
  const types = rowTypes(w);
  /* 현황판 줄이 생기는 일정 사업은 기술보호 꼴 t1(03 에 이어짐) · 인사노무 t3(04) · 연결 없는 t10·t11(이름만 기술보호) — 02(t2)는 대형이라 줄이 없다 */
  assert.deepEqual([...new Set(types)].slice(0, 2), ['t1', 't3'], '이알피 순서: 03(t1) → 04(t3)');
  assert.deepEqual([...new Set(types)].slice(2).sort(), ['t10', 't11'], '이알피에 이어지지 않은 일정 사업은 맨 뒤');
  assert.equal(countOf(w.els.rows.innerHTML, /<tr>/g) + countOf(w.els.rows.innerHTML, /<tr class="ng">/g), types.length);
  const runs = types.filter((t, i) => i === 0 || t !== types[i - 1]);
  assert.equal(runs.length, new Set(types).size, '한 사업의 줄은 이어져 있다(두 번 나오지 않는다)');
  const trs = [...w.els.rows.innerHTML.matchAll(/<tr( class="ng")?>/g)].map((m) => !!m[1]);
  assert.deepEqual(trs, types.map((t, i) => i > 0 && t !== types[i - 1]), '사업이 바뀌는 첫 줄만 ng(맨 위 줄은 #rows 의 카운터가 1 로 시작한다)');
  assert.equal(trs.filter(Boolean).length, 3, '사업 넷 — 바뀌는 곳 셋');
  assert.ok(types.filter((t) => t === 't3').length === 2, '준비 — 04 는 업체가 둘');
  /* 같은 사업 안 순서는 정렬 전 그대로 */
  const raw = L.filterRows(w.ctx.GR.rows, { year: '2026' }).filter((r) => r.typeId === 't3').map((r) => r.coId);
  const got = [...w.els.rows.innerHTML.matchAll(/data-toc="1" data-co="([^"]*)" data-ty="t3"/g)].map((m) => m[1]);
  assert.equal(got.length, 2); assert.deepEqual(got, raw, '같은 사업 안 순서 그대로');
  /* 끌어서 정한 순서가 표 순서가 된다 */
  const o = ordWorld({ more: true, order: { list: 'consulting-15,consulting-04', at: 1 } });
  await o.ctx.grLoad();
  assert.deepEqual([...new Set(rowTypes(o))].slice(0, 2), ['t3', 't1'], '정한 순서가 이알피 순서보다 먼저(04 → 03)');
  o.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-03', 'open'), 0));
  await o.ctx.grDragBiz(dragEv('drop', bzEl('consulting-04', 'open'), BEFORE));
  assert.deepEqual([...new Set(rowTypes(o))].slice(0, 2), ['t1', 't3'], '놓자마자 표도 다시 그려진다');
  assert.equal(o.db.쓴것.length, 1);
  /* 이알피 목록을 못 읽었거나 연결을 못 읽으면 정렬하지 않고 던지지도 않는다 */
  w.ctx.GR.docs = { loaded: true, err: true };
  assert.doesNotThrow(() => w.ctx.grRenderRows());
  assert.ok(rowTypes(w).length >= types.length, '못 읽었으면 종결 거르기도 못 하니 줄이 더 보일 수 있다');
  w.ctx.GR.docs = { loaded: false, err: false };
  assert.doesNotThrow(() => w.ctx.grRenderRows());
  assert.equal(w.db.쓴것.length, 0);
});

test('162 값은 이스케이프 — 순서 안내·묶음 키 · 이상한 순서 문서로는 던지지 않는다 · 끌기 이벤트가 이상해도(대상 없음·값 없음) 던지지 않는다', async () => {
  const w = ordWorld({ order: { list: 'consulting-02,<img src=x onerror=1>,consulting-15' } });
  await w.ctx.grLoad();
  assert.ok(!w.els.biz.innerHTML.includes('<img'));
  assert.deepEqual(bizCodes(openSec(w.els.biz.innerHTML)).slice(0, 2), ['consulting-02', 'consulting-15'], '이상한 코드는 걸러지고 나머지는 그 순서');
  for (const e of [{ type: 'dragstart' }, { type: 'dragover', target: {} }, { type: 'drop', target: { closest: () => null } }, { type: 'dragend' }, { type: 'dragleave', target: null }, { type: 'nope' }, {}]) {
    assert.doesNotThrow(() => w.ctx.grDragBiz(e), JSON.stringify(e));
  }
  assert.equal(w.ctx.GR.drag, null);
  const ev = dragEv('dragend', bzEl('consulting-02', 'open'), 0);
  w.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-02', 'open'), 0)); w.ctx.grDragBiz(ev);
  assert.equal(w.ctx.GR.drag, null, '끌기가 끝나면(놓지 않고 끝나도) 상태가 비워진다');
  assert.equal(w.db.쓴것.length, 0);
});

test('163 실제 관문(강제 모드) — 사업 순서 .set(scal_bizOrder/main · Nav.orderEntry 모양)은 통과하고 .remove 는 막힌다 · 순서 쓰기는 이 화면에서 한 자리뿐', async () => {
  const W = require('../js/pu-ontology-write.js');
  const calls = [];
  const ref = (p) => ({
    child: (c) => ref((p ? p + '/' : '') + c),
    set: (v) => { calls.push({ kind: 'set', path: p, value: v }); return Promise.resolve(); },
    remove: () => { calls.push({ kind: 'remove', path: p }); return Promise.resolve(); },
    update: (v) => { calls.push({ kind: 'update', path: p, value: v }); return Promise.resolve(); },
    transaction: () => { calls.push({ kind: 'transaction', path: p }); return Promise.resolve({ committed: true }); },
  });
  const fb = { database: function () { return { ref }; } };
  W.clearIssues();
  assert.equal(W.installFirebaseCompat(fb, { mode: W.runtimeMode('govreport', 'observe'), program: 'govreport', reporter: () => {} }), true);
  const entry = Nav.orderEntry(['consulting-15', 'consulting-02', 'consulting-03'], '홍길동', 1760000000000);
  await fb.database().ref('scal_bizOrder/' + Nav.ORDER_NODE_KEY).set(entry);
  assert.deepEqual(calls.map((c) => [c.kind, c.path, c.value.list]), [['set', 'scal_bizOrder/main', 'consulting-15,consulting-02,consulting-03']], '관문을 통과해 쓰인다');
  assert.deepEqual(W.getIssues(), [], '관문이 아무 위반도 적지 않는다');
  await assert.rejects(() => fb.database().ref('scal_bizOrder/main').remove(), /삭제 표식/, '.remove 는 관문이 막는다 — 화면에는 없다');
  assert.equal(calls.length, 1);
  assert.equal((INLINE.match(/fbDb\.ref\(GR_BIZ\.orderNode/g) || []).length, 2, '순서 자리를 부르는 곳은 읽기 하나 · 쓰기 하나');
});

/* ═══ UI 4단계 Task 3 — 업체 □ 번호(CSS 카운터) · 화면 전체 폭 · 왼쪽 사업 대시보드 (2026-10-12) — 계획 docs/superpowers/plans/2026-10-12-gov-report-order.md ═══
   번호는 CSS 카운터뿐(글자 노드는 그대로 — 위 검사들이 `>가나상사<` 꼴을 읽는다). 왼쪽 패널의 막대·딱지는 3단계 grTodayCalc 캐시(GR.td.strip)를 읽을 뿐 다시 계산하지 않는다. 읽기만 — 새 쓰기 없음 */
const CSS = SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>'));
const noColor = (s, why) => assert.doesNotMatch(s, /#[0-9a-fA-F]{3,8}\b|rgba?\(/, why);
function cssBlock(head) {   // 「head{ … }」 한 덩어리(@media 처럼 중괄호가 겹쳐도)
  const m = new RegExp('(^|[\\s}])' + head.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{', 'm').exec(CSS);
  assert.ok(m, head + ' 규칙을 못 찾았다');
  const i = m.index + m[1].length;
  let d = 0;
  for (let j = i; j < CSS.length; j++) { if (CSS[j] === '{') d++; else if (CSS[j] === '}') { d--; if (!d) return CSS.slice(i, j + 1); } }
  assert.fail(head + ' 규칙이 닫히지 않았다');
}
const cssLines = (re) => CSS.split(/\r?\n/).filter((l) => re.test(l));

test('164 업체 □ 번호 — 현황판 #rows(사업이 바뀌는 ng 줄에서 1로) · 서류 체크표 · 사업 대시보드 업체 줄이 각자 카운터 · 글자 노드는 그대로 · 색 직접 지정 없음 · 오늘 할 일·보드 카드는 번호 없음', async () => {
  const has = (head, re, what) => assert.match(cssBlock(head), re, what);
  const NUM = /content:\s*"□ "\s*counter\(co\)\s*" "/;
  /* 현황판 */
  has('#rows', /counter-reset:\s*co\b/, '#rows 가 카운터를 시작');
  has('#rows tr td.co::before', /counter-increment:\s*co\b/, '업체 칸마다 하나 올린다');
  has('#rows tr td.co::before', NUM, '□ 번호 ');
  has('#rows tr.ng', /counter-reset:\s*co\b/, '사업이 바뀌는 줄에서 1 로 되돌린다');
  /* 서류 체크표(간단형·대형 표) · 표가 아닌 줄 목록 */
  has('.docs table tbody', /counter-reset:\s*co\b/);
  has('.docs table td.co::before', /counter-increment:\s*co\b/);
  has('.docs table td.co::before', NUM);
  has('.docs', /counter-reset:\s*co\b/, '표가 아닌 «서류 목차 보기» 줄 목록도 .docs 안에서 센다');
  has('.dc-l>span:first-child::before', /counter-increment:\s*co\b/);
  has('.dc-l>span:first-child::before', NUM);
  /* 사업 대시보드 업체 줄 — .dsh-l 이 시작, .dsh-c(줄마다 하나)가 올린다 */
  has('.dsh-l', /counter-reset:\s*co\b/);
  has('.dsh-c::before', /counter-increment:\s*co\b/);
  has('.dsh-c::before', NUM);
  /* 번호 CSS 는 기존 변수만 · 글자가 아니라 CSS — 스크립트에는 □ 가 없다 */
  cssLines(/counter/).forEach((l) => noColor(l, l));
  assert.ok(cssLines(/counter/).length >= 9);
  assert.ok(!INLINE.includes('□'), '번호는 CSS 카운터로만 — 글자 노드를 바꾸지 않는다');
  /* 오늘 할 일 줄·보드 카드는 번호 없음 */
  assert.equal(cssLines(/counter/).filter((l) => /\.td-|\.bd-|\.kpi|\.dsh-k/.test(l)).length, 0);
  /* 글자 노드 그대로 */
  const w = world();
  await w.ctx.grLoad();
  assert.ok(w.els.rows.innerHTML.includes('<td class="co" title="가나상사">가나상사</td>'), '현황판 업체 칸');
  w.ctx.grSetBiz('consulting-03');
  const d = w.els.docs.innerHTML;
  assert.ok(d.includes('<td class="co" title="가나상사">가나상사</td>'), '서류 체크표 업체 칸');
  assert.ok(d.includes('<span class="dsh-c" title="가나상사">가나상사</span>'), '사업 대시보드 업체 줄');
  assert.ok(!/<td class="co"[^>]*>[^<]*□/.test(w.els.rows.innerHTML + d) && !(w.els.rows.innerHTML + d).includes('□'), '번호는 HTML 에 없다');
  assert.equal(w.db.쓴것.length, 0);
});

test('165 화면 전체 폭 — main 폭 제한 없음 · 3열 격자는 clamp · 1500px 이하 2열 + 오른쪽 패널은 아래 전체 폭(1100·900px 규칙보다 앞) · 왼쪽 패널은 따라온다(sticky) · 로그인 창 폭은 그대로 · 색 직접 지정 없음', () => {
  assert.ok(!CSS.includes('max-width:1280px'), '가운데 칸을 누르던 1280px 제한이 없다');
  const main = cssBlock('main');
  assert.match(main, /max-width:\s*none/); assert.match(main, /margin:\s*0[;}]/); assert.match(main, /padding:\s*14px clamp\(12px,\s*1\.5vw,\s*28px\) 60px/);
  const grid = cssBlock('.grid');
  assert.match(grid, /grid-template-columns:\s*clamp\(300px,\s*23vw,\s*420px\) minmax\(0,\s*1fr\) clamp\(280px,\s*18vw,\s*340px\)/, '3열은 clamp 로 정한다');
  assert.match(cssBlock('#lock'), /max-width:\s*460px/, '로그인 창 폭은 그대로');
  /* 1500px 이하 */
  const m1500 = cssBlock('@media (max-width:1500px)');
  assert.match(m1500, /\.grid\{grid-template-columns:\s*clamp\(280px,\s*24vw,\s*360px\) minmax\(0,\s*1fr\)\}/, '2열');
  assert.match(m1500, /\.side\{[^}]*grid-column:\s*1 \/ -1/, '오른쪽 패널은 아래 전체 폭');
  assert.match(m1500, /\.side\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(280px,\s*100%\),\s*1fr\)\)/, '패널은 격자로 나란히 — 아주 좁은 화면에서는 한 칸이 100% 라 가로로 넘치지 않는다');
  const at = (s) => { const i = CSS.indexOf(s); assert.ok(i >= 0, s); return i; };
  assert.ok(at('@media (max-width:1500px)') < at('@media (max-width:1100px)') && at('@media (max-width:1100px)') < at('@media (max-width:900px)'), '1500 → 1100 → 900 차례(뒤 규칙이 앞 규칙을 덮는다)');
  assert.ok(at('.grid{') < at('@media (max-width:1500px)'), '기본 격자가 먼저');
  assert.match(cssBlock('@media (max-width:1100px)'), /\.grid\{grid-template-columns:\s*220px minmax\(0,\s*1fr\)\}/, '1100px 규칙은 그대로');
  /* 900px 이하는 한 칸 — minmax(0,1fr) 이어야 한다. 그냥 1fr 은 «가장 넓은 표만큼» 늘어나 폰(360px)에서 칸이 1052px 이 되고 페이지가 옆으로 밀렸다(2026-10-18 폰화면관리) */
  assert.match(cssBlock('@media (max-width:900px)'), /\.grid\{grid-template-columns:\s*minmax\(0,\s*1fr\)\}/, '900px 이하는 한 칸(minmax(0,1fr))');
  /* 왼쪽 패널 — 머리 아래에 붙어 따라온다 */
  const bizp = cssBlock('.bizp');
  assert.match(bizp, /position:\s*sticky/); assert.match(bizp, /top:\s*calc\(var\(--head-h\)/); assert.match(bizp, /max-height:\s*calc\(100vh - var\(--head-h\)/); assert.match(bizp, /overflow:\s*auto/);
  assert.match(cssBlock(':root'), /--head-h:\s*64px/, '머리 높이는 고정값(JS 로 읽지 않는다)');
  assert.doesNotMatch(INLINE, /getBoundingClientRect\(\)[^;]*head|offsetHeight/, '머리 높이를 JS 로 읽지 않는다');
  /* 좁은 화면 — 900px 이하에서 왼쪽 패널은 붙지 않고 흐른다 */
  assert.match(cssBlock('@media (max-width:900px)'), /\.bizp\{[^}]*position:\s*static/);
  /* 새 규칙에는 색을 직접 쓰지 않는다 */
  [main, grid, m1500, bizp, cssBlock('@media (max-width:900px)')].forEach((b) => noColor(b, b));
  cssLines(/\.bz-sum|\.bz-card|\.bz-top|\.bz-cn|\.bz-ca|\.bz-row|\.bz-co\b|\.bz-tg|\.bz-sb/).forEach((l) => noColor(l, l));
});

test('166 왼쪽 사업 대시보드 — 요약 줄(진행 사업 N · 업체 M · 막힘 K) · 사업 카드(이름 전체 · (수행기관) · 종류 · 업체 N곳 · 단계 막대 · 막힘/기한 딱지) · 접는 묶음은 작은 줄 그대로 · 끌기·고르기·종결·붉은 숫자·오늘 할 일 단추 그대로', async () => {
  const w = navWorld({ state: CLOSED05 });
  await w.ctx.grLoad();
  const h = w.els.biz.innerHTML, op = openSec(h), strip = J(w.ctx.GR.td.strip);
  assert.ok(SRC.includes('<h2>📂 사업 대시보드</h2>') && !SRC.includes('<h2>📂 컨설팅 사업</h2>'));
  assert.ok(op.includes('data-home="1"'), '「🎯 오늘 할 일」 단추');
  /* 요약 줄 — 고른 연도·종결 제외 */
  const al = [...op.matchAll(/class="bz-al"[^>]*>(\d+)</g)].reduce((s, m) => s + Number(m[1]), 0);
  assert.ok(op.includes('<div class="bz-sum" title="'), '요약 줄');
  assert.ok(op.includes('<span>진행 사업 <b>5</b></span><span>업체 <b>5</b></span>'), '2026: 02·03·04·14·15 — 종결 05 는 빠진다');
  assert.ok(op.includes('<span class="bz-sb' + (al > 0 ? ' bad' : '') + '">막힘 <b>' + al + '</b></span>'), '막힘 = 항목의 붉은 숫자 합');
  assert.ok(h.indexOf('class="bz-sum"') < h.indexOf('data-biz="consulting-02"'), '요약이 카드 위');
  /* 카드 — 이름은 본문에 전체로(말줄임 없음) */
  const c3 = bizBtn(h, 'consulting-03');
  assert.match(c3, /^data-biz="consulting-03" data-grp="open" draggable="true" title="[^"]*">/, '끌기·묶음 키가 그대로');
  assert.ok(h.includes('<button type="button" class="bz bz-card" data-biz="consulting-03"'));
  ['<span class="bz-cn">통합기술보호지원단</span>', '<span class="bz-ca">(비즈니스지원단(중기청))</span>', '<span class="bz-k">간단형</span>', '<span class="bz-co">업체 <b>1</b>곳</span>']
    .forEach((s) => assert.ok(c3.includes(s), s));
  assert.ok(bizBtn(h, 'consulting-02').includes('<span class="bz-ca">(기관 미지정)</span>'), '기관이 비면 (기관 미지정)');
  const same = '<span class="bz-cn">일터혁신 같은이름</span>';
  assert.ok(bizBtn(h, 'consulting-14').includes(same) && bizBtn(h, 'consulting-14').includes('<span class="bz-ca">(가기관)</span>') && bizBtn(h, 'consulting-15').includes(same) && bizBtn(h, 'consulting-15').includes('<span class="bz-ca">(나기관)</span>'), '같은 이름·다른 기관은 구분된다');
  cssLines(/\.bz-cn|\.bz-ca|\.bz-card/).forEach((l) => assert.doesNotMatch(l, /text-overflow|nowrap/, '카드 이름은 줄바꿈 — 말줄임 없음: ' + l));
  /* 막대·딱지 = 3단계 캐시(GR.td.strip) 그대로 */
  assert.ok(strip.length === 5 && strip.every((s) => s.bar) && strip.some((s) => s.tone === 'warn') && strip.some((s) => s.tone === 'ok'), '준비 — 캐시에 다섯 사업의 막대가 있고 딱지 색이 섞여 있다');
  strip.forEach((s) => {
    const c = bizBtn(h, s.code);
    assert.ok(c, s.code + ' 카드');
    if (s.bar) {
      assert.ok(c.includes('<span class="dsh-bar" title="단계 칸 — 완료 ' + s.bar.done + '% · 진행 ' + s.bar.doing + '% · 막힘 ' + s.bar.blocked + '% · 미착수 ' + s.bar.none + '%">'), s.code + ' 막대(dsh-bar 재사용)');
      ['done:dsh-sd', 'doing:dsh-sg', 'blocked:dsh-sb', 'none:dsh-sn'].forEach((p) => { const [k, cl] = p.split(':'); assert.equal(c.includes('<i class="' + cl + '" style="flex:' + s.bar[k] + '">'), s.bar[k] > 0, s.code + ' ' + k); });
      if (s.tone !== 'idle') assert.ok(c.includes(s.note), s.code + ' 딱지 «' + s.note + '»');
    } else assert.ok(!c.includes('dsh-bar') && !c.includes('bz-tg'), s.code + ' 막대 없이 업체 수만');
    assert.ok(c.includes('<span class="bz-co">업체 <b>' + s.n + '</b>곳</span>'), s.code + ' 업체 수');
  });
  /* 접는 묶음 — 지금 모양 그대로(작은 줄) */
  ['quiet', 'noPlan', 'unlinked', 'closed'].forEach((k) => assert.ok(!grpOf(h, k).includes('bz-card'), k + ' 은 카드가 아니다'));
  assert.match(bizBtn(h, 'consulting-12'), /^data-biz="consulting-12"[^>]*>.*?<span class="bz-n"><span class="bz-nm">농촌융복합시험사업<\/span><span class="bz-ag">\(가기관\)<\/span><\/span><span class="bz-k">[^<]*<\/span><b>0<\/b>/);
  assert.match(grpOf(h, 'closed'), /<button type="button" class="bz cl" data-biz="consulting-05"[^>]*>.*?<span class="bz-d">2026-09 종결<\/span>/, '종결 사업 표시');
  assert.ok(!op.includes('data-biz="consulting-05"'), '종결 사업은 진행 사업에 없다');
  /* 끌기용 속성이 모든 항목에 */
  const btns = h.match(/<button[^>]*data-biz="[^"]*"[^>]*>/g);
  assert.ok(btns.length >= 10);
  btns.forEach((b) => assert.ok(b.includes('draggable="true"') && /data-grp="[a-zA-Z]+"/.test(b), b));
  /* 고르기·풀기 */
  w.ctx.grSetBiz('consulting-03');
  assert.ok(w.els.biz.innerHTML.includes('<button type="button" class="bz bz-card on" data-biz="consulting-03"'), '골랐다');
  assert.ok(w.els.rows.innerHTML.includes('가나상사') && !w.els.rows.innerHTML.includes('다라정밀'));
  w.ctx.grSetBiz('consulting-03');
  assert.ok(!w.els.biz.innerHTML.includes('bz-card on') && w.els.rows.innerHTML.includes('다라정밀'), '같은 사업을 다시 누르면 풀린다');
  /* 끌어 놓기 — 카드도 .bz[data-grp][data-biz] */
  w.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-15', 'open'), 0));
  await w.ctx.grDragBiz(dragEv('drop', bzEl('consulting-02', 'open'), BEFORE));
  assert.deepEqual(bizCodes(openSec(w.els.biz.innerHTML)).slice(0, 2), ['consulting-15', 'consulting-02'], '카드도 끌어 순서가 바뀐다');
  assert.ok(w.els.biz.innerHTML.includes('class="bz-sum"'), '다시 그려도 요약이 있다');
  assert.equal(w.db.쓴것.length, 1, '쓰기는 순서 한 번뿐');
});

test('167 막대 없는 경우 — 기록 못 읽음 · 오늘 할 일 계산 없음(GR.td 없음) · 서류 틀 없음/업체 없음은 막대 없이 업체 수만 · 막힘 칸은 «0» 이 아니라 생략 · 막힌 사업은 붉은 숫자·딱지가 같이 · 값은 이스케이프', async () => {
  const denied = { once: async () => { throw new Error('permission_denied'); } };
  const track = { t2: { plan: { st: 'blocked' }, 'round:1': { st: 'blocked' } } };
  /* 기록을 못 읽었다 */
  const r = world({ seed: bigSeed({ track }), db: (db) => ({ ref: (p) => (p === 'scal_docs' ? denied : db.ref(p)) }) });
  await r.ctx.grLoad();
  const rh = r.els.biz.innerHTML, rop = openSec(rh);
  assert.equal(r.ctx.GR.trackErr, true);
  assert.ok(rop.includes('class="bz-sum"') && /진행 사업 <b>\d+<\/b>/.test(rop) && /업체 <b>\d+<\/b>/.test(rop), '요약 줄은 있다');
  assert.ok(!rop.includes('막힘') && !rop.includes('bz-sb'), '기록을 못 읽었으면 막힘 칸을 «0» 으로 그리지 않고 뺀다');
  assert.ok(!rh.includes('dsh-bar') && !rh.includes('bz-tg') && !rh.includes('bz-al'), '막대·딱지·붉은 숫자 없음');
  assert.match(bizBtn(rh, 'consulting-02'), /<span class="bz-co">업체 <b>\d+<\/b>곳<\/span>/, '업체 수만');
  /* 계산 모듈이 없다(GR.td 없음) */
  const n = navWorld({ state: CLOSED05 });
  await n.ctx.grLoad();
  assert.ok(n.els.biz.innerHTML.includes('dsh-bar'), '준비 — 평소에는 막대가 있다');
  n.ctx.PuGovReportToday = undefined; n.ctx.grRender();
  assert.equal(n.ctx.GR.td, null);
  const nh = n.els.biz.innerHTML;
  assert.ok(!nh.includes('dsh-bar') && !nh.includes('bz-tg'), 'GR.td 가 없으면 막대 없이');
  assert.ok(openSec(nh).includes('<span>진행 사업 <b>5</b></span><span>업체 <b>5</b></span>') && bizBtn(nh, 'consulting-03').includes('<span class="bz-co">업체 <b>1</b>곳</span>'), '업체 수는 그대로');
  /* 막힌 사업 — 붉은 숫자와 딱지·요약의 막힘 칸이 같이 */
  const b = world({ seed: bigSeed({ track }) });
  await b.ctx.grLoad();
  const bh = b.els.biz.innerHTML, c2 = bizBtn(bh, 'consulting-02');
  assert.ok(c2.includes('<span class="bz-al" title="막힌 단계가 있는 업체 1곳">1</span>'));
  assert.ok(c2.includes('dsh-bar') && c2.includes('<span class="bz-tg bad">막힘 1</span>'), '막힘 딱지');
  assert.ok(openSec(bh).includes('<span class="bz-sb bad">막힘 <b>1</b></span>'));
  assert.ok(!bizBtn(bh, 'consulting-03').includes('bz-al'), '0 은 안 단다');
  /* 이스케이프 */
  const x = navWorld({ seedOpt: { hostile: true }, state: CLOSED05 });
  await x.ctx.grLoad();
  assert.ok(!x.els.biz.innerHTML.includes('<script>') && !x.els.biz.innerHTML.includes('<img') && !x.els.biz.innerHTML.includes('<svg'), '이름·기관은 이스케이프');
  assert.ok(x.els.biz.innerHTML.includes('<span class="bz-cn">&#60;script&#62;alert(1)&#60;/script&#62;가</span>'));
  /* 낡은 캐시 항목(업체 수가 다름)은 막대를 그리지 않는다 · 막대가 없는 항목(bar:null)도 */
  const it = { code: 'consulting-03', label: { name: '가', agency: '나', text: '가 (나)' }, kind: 'auto', count: 1 };
  const sd = { code: 'consulting-03', n: 1, bar: { done: 100, doing: 0, blocked: 0, none: 0 }, tone: 'ok', note: '정상' };
  assert.ok(n.ctx.grBizBtn(it, 'open', 0, sd).includes('dsh-bar'), '준비 — 같은 업체 수면 그린다');
  [Object.assign({}, sd, { n: 9 }), Object.assign({}, sd, { bar: null }), undefined, null].forEach((o) => assert.ok(!n.ctx.grBizBtn(it, 'open', 0, o).includes('dsh-bar') && n.ctx.grBizBtn(it, 'open', 0, o).includes('<span class="bz-co">업체 <b>1</b>곳</span>')));
  assert.equal(r.db.쓴것.length + n.db.쓴것.length + b.db.쓴것.length + x.db.쓴것.length, 0);
});

test('168 왼쪽 그리기는 새 계산을 만들지 않는다 — 막대는 grTodayCalc 캐시(연도·오늘·자료 버전)를 읽을 뿐 · 거르개 입력·접기·고르기·다시 그리기에 stripOf 가 다시 불리지 않는다 · 연도가 바뀌면 한 번', async () => {
  const w = navWorld({ state: CLOSED05 });
  let n = 0; const T = w.ctx.PuGovReportToday;
  w.ctx.PuGovReportToday = Object.assign({}, T, { stripOf: (s) => { n++; return T.stripOf(s); } });
  await w.ctx.grLoad();
  const n0 = n, td0 = w.ctx.GR.td, k0 = w.ctx.GR.tdKey;
  assert.ok(n0 >= 1 && td0 && td0.strip.some((s) => s.bar), '준비 — 불러온 뒤 캐시가 차 있고 막대 자료가 있다');
  assert.ok(w.els.biz.innerHTML.includes('dsh-bar'), '첫 그림 뒤 grRender 가 다시 돌며 막대가 채워진다(캐시가 비어 있던 첫 그림에서 계산을 따로 부르지 않는다)');
  w.ctx.GR.f.co = '가'; w.ctx.grRender();
  w.ctx.grToggleBizGrp('quiet'); w.ctx.grSetBiz('consulting-03'); w.ctx.grSetBiz('consulting-03'); w.ctx.grRenderBiz(); w.ctx.grRenderBiz();
  assert.equal(n, n0, '거르개·접기·고르기·왼쪽 다시 그리기는 재계산이 없다');
  assert.strictEqual(w.ctx.GR.td, td0); assert.equal(w.ctx.GR.tdKey, k0);
  w.ctx.grSetYear('2025');
  assert.equal(n, n0 + 1, '연도가 바뀌면 열쇠가 달라져 한 번만 다시 센다');
  w.ctx.grRenderBiz(); w.ctx.grRender();
  assert.equal(n, n0 + 1);
  /* 정적 — 왼쪽 그리기는 캐시만 읽는다 */
  const g = grab('grRenderBiz') + grab('grBizBtn');
  assert.match(g, /GR\.td\b/, '캐시를 읽는다');
  assert.doesNotMatch(g, /summarize\(|docsTable\(|stripOf\(|PuGovReportToday|PuGovReportDash/, '자체 계산이 없다');
  assert.equal(w.db.쓴것.length, 0);
});

test('164 끌기 안전 — 전용 형식 없는 놓기(다른 앱의 글자·파일)는 무시 · GR.drag 가 남아 있어도 외부 놓기는 쓰기 0 · document 의 dragend·drop 이 끌기 상태를 비운다 · 코드가 끌던 항목과 다르면 무시', async () => {
  const w = ordWorld();
  await w.ctx.grLoad();
  const g = w.ctx.GR;
  assert.match(SRC, /dragType:'application\/x-gr-biz'/);
  assert.ok(SRC.includes("document.addEventListener('dragend',grDragEnd,true); document.addEventListener('drop',grDragEnd);"), 'document 단위 끝 처리(drop 은 #biz 가 먼저 읽도록 거품 단계)');
  const src = bzEl('consulting-15', 'open'), t02 = bzEl('consulting-02', 'open');
  /* 끌기는 시작됐고(GR.drag 가 남았고) 외부 것이 같은 묶음 항목 위로 온다 */
  w.ctx.grDragBiz(dragEv('dragstart', src, 0));
  let ev = dragEv('dragover', t02, BEFORE, { external: true }); w.ctx.grDragBiz(ev);
  assert.ok(!ev.prevented && t02.cls.size === 0, '전용 형식이 없으면 놓을 자리로 받지 않는다');
  ev = dragEv('drop', t02, BEFORE, { external: true });
  await w.ctx.grDragBiz(ev);
  assert.ok(!ev.prevented); assert.equal(w.db.쓴것.length, 0, '외부 놓기는 쓰기 0'); assert.deepEqual(J(g.bizOrder), []);
  assert.equal(g.drag, null, '놓았으니 끌기는 끝난다');
  /* 전용 형식은 있는데 코드가 끌던 항목과 다르다(남의 형식 흉내) */
  w.ctx.grDragBiz(dragEv('dragstart', src, 0));
  const fake = dragEv('drop', t02, BEFORE); fake.data[DRAG_TYPE] = 'consulting-04';
  await w.ctx.grDragBiz(fake);
  assert.equal(w.db.쓴것.length, 0, '코드가 다르면 무시');
  /* dragstart 없이(GR.drag 없음) 전용 형식만 오는 놓기 */
  await w.ctx.grDragBiz(dragEv('drop', t02, BEFORE));
  assert.equal(w.db.쓴것.length, 0);
  /* 정상 끌기는 그대로 된다 */
  w.ctx.grDragBiz(dragEv('dragstart', src, 0));
  await w.ctx.grDragBiz(dragEv('drop', t02, BEFORE));
  assert.equal(w.db.쓴것.length, 1);
  /* document 단위 끝 처리 — 끌던 항목이 다시 그려져 dragend 가 #biz 까지 안 와도 비운다 */
  g.drag = { code: 'consulting-15', grp: 'open' }; g.dmark = bzEl('consulting-02', 'open'); g.dmark.cls.add('drop-after');
  w.ctx.grDragEnd();
  assert.equal(g.drag, null); assert.equal(g.dmark, null);
  assert.equal(w.ctx.grHasDragType({}), false); assert.equal(w.ctx.grHasDragType({ dataTransfer: {} }), false);
  assert.equal(w.ctx.grHasDragType({ dataTransfer: { types: ['Files'] } }), false);
  assert.equal(w.ctx.grHasDragType({ dataTransfer: { types: ['text/plain', DRAG_TYPE] } }), true);
});

test('165 저장 잠금은 항상 풀린다 — 그리다 던져도 obusy 가 풀리고 순서는 되돌아가며 다음 끌기가 된다', async () => {
  const w = ordWorld();
  await w.ctx.grLoad();
  const g = w.ctx.GR, real = w.ctx.grRender;
  let n = 0;
  w.ctx.grRender = () => { if (++n === 1) throw new Error('그리기 실패'); return real(); };   // 첫 그리기(낙관적 갱신)만 던진다
  w.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-15', 'open'), 0));
  await w.ctx.grDragBiz(dragEv('drop', bzEl('consulting-02', 'open'), BEFORE));
  assert.equal(g.obusy, false, '잠금이 풀렸다');
  assert.deepEqual(J(g.bizOrder), [], '순서는 이전으로'); assert.equal(w.db.쓴것.length, 0, '그리다 던졌으니 저장하지 않았다');
  assert.ok(g.bbmsg, '안내가 있다');
  w.ctx.grRender = real;
  w.ctx.grDragBiz(dragEv('dragstart', bzEl('consulting-15', 'open'), 0));
  assert.equal(g.drag && g.drag.code, 'consulting-15', '다음 끌기가 된다');
  await w.ctx.grDragBiz(dragEv('drop', bzEl('consulting-02', 'open'), BEFORE));
  assert.equal(w.db.쓴것.length, 1);
});

test('166 dragleave — 같은 항목 안쪽으로 옮겨 간 것(relatedTarget 이 항목 안)은 표시를 지우지 않는다 · 밖으로 나가면 지운다', async () => {
  const w = ordWorld();
  await w.ctx.grLoad();
  const src = bzEl('consulting-15', 'open'), t02 = bzEl('consulting-02', 'open'), inner = {};
  t02.contains = (n) => n === inner;
  w.ctx.grDragBiz(dragEv('dragstart', src, 0));
  w.ctx.grDragBiz(dragEv('dragover', t02, BEFORE));
  assert.ok(t02.cls.has('drop-before'));
  w.ctx.grDragBiz(dragEv('dragleave', t02, 0, { related: inner }));
  assert.ok(t02.cls.has('drop-before'), '안쪽 이동은 깜박이지 않는다');
  w.ctx.grDragBiz(dragEv('dragleave', t02, 0, { related: {} }));
  assert.equal(t02.cls.size, 0, '밖으로 나가면 지운다');
  w.ctx.grDragBiz(dragEv('dragover', t02, BEFORE)); w.ctx.grDragBiz(dragEv('dragleave', t02, 0));
  assert.equal(t02.cls.size, 0, 'relatedTarget 을 모르면 지운다(dragover 가 다시 단다)');
});

/* ═══ 메일 자동 처리 구역 (2026-10-22, 계획 docs/superpowers/plans/2026-10-22-gov-report-auto.md Task 3) ═══
   «오늘 할 일» 에 «🤖 메일 자동 처리» — 모드 딱지·마지막 실행·처리/미배정·목록(≤10)·모드 스위치(관리자)·되돌리기 · 서류 체크표·칸 창의 «자동» 딱지.
   읽기는 scal_autoRun 의 cfg·last·log/{오늘} 셋(이름 표 GR_AUTO), 새 쓰기는 cfg 한 칸 .set 뿐 — 되돌리기는 기존 서류 줄 쓰기 길(grPutCell). 합성 자료만 */
const AUTO_AT = Date.UTC(2026, 9, 10, 5, 30);   // 2026-10-10 14:30 (서울)
const AUTO_M1 = 'i:INBOX-0a1b2c3d:101', AUTO_M2 = 'i:INBOX-0a1b2c3d:106';
const AUTO_PREV = { st: 'doing', sentAt: '2026-09-20', by: '홍길동', at: Date.UTC(2026, 8, 20, 3) };
function autoSeed(o) {
  o = o || {};
  const s = F.seed();
  const mode = o.mode === undefined ? 'live' : o.mode;
  s.scal_cos.push({ id: 'c6', name: '<i>북</i>상사', types: ['t3'], defAtt: 'a1' });
  if (o.written !== false) {   // 서버가 live 로 쓴 줄 — 처리자 «자동» + 메일 연결
    s.scal_docs.c2.t3_2026.items.sign = { st: 'done', sentAt: '2026-09-20', gotAt: '2026-09-25', by: '자동', at: AUTO_AT, note: '자동 처리 — 메일 «서명본.hwpx»',
      link: { src: 'mail', key: AUTO_M1, name: '서명본.hwpx', date: '2026-09-25' } };
    s.scal_docs.c6 = { t3_2026: { items: { attach: { st: 'done', gotAt: '2026-10-09', how: 'mail', by: '자동', at: AUTO_AT, note: '자동 처리 — 메일 «사진»',
      link: { src: 'mail', key: AUTO_M2, name: '<b>사진</b>.png', date: '2026-10-09' } } } } };
  }
  const it1 = { co: 'c2', rid: 't3_2026', type: 't3', key: 'sign', step: 'sign', mail: AUTO_M1, name: '서명본.hwpx', day: '2026-09-25', why: '쓸 수 있는 줄이 하나 · 발송함 줄 회신' };
  const it2 = { co: 'c6', rid: 't3_2026', type: 't3', key: 'attach', step: 'attach', mail: AUTO_M2, name: '<b>사진</b>.png', day: '2026-10-09', why: '쓸 수 있는 줄이 하나' };
  const run = {};
  if (mode) run.cfg = { mode, by: '홍길동', at: AUTO_AT };
  const lastMode = o.lastMode || (mode === 'dry' ? 'dry' : 'live'), live = lastMode === 'live';
  if (o.last !== 'none') {
    run.last = { at: AUTO_AT, mode: lastMode, n: 2, nDone: live ? 2 : 0, nUnmatched: 1 };
    if (o.last !== 'noItems') {
      const li = [Object.assign({}, it1, { did: live }), Object.assign({}, it2, { did: live })];
      run.last.items = o.last === 'objItems' ? { 0: li[0], 1: li[1] } : li;
    }
    if (o.note) run.last.note = o.note;
    if (o.planN) run.last.items = Array.from({ length: o.planN }, (_, i) => ({ co: 'c2', rid: 't3_2026', type: 't3', key: 'attach', step: 'attach', mail: 'i:INBOX-0a1b2c3d:' + (700 + i), name: '예정' + i + '.pdf', day: '2026-10-0' + (1 + (i % 8)), why: '쓸 수 있는 줄이 하나', did: false }));
    if (o.unmatched) {
      run.last.unmatched = [];
      for (let i = 0; i < o.unmatched; i++) run.last.unmatched.push({ co: i % 2 ? 'c6' : 'c2', rid: i === 2 ? '' : 't3_2026', mail: 'i:INBOX-0a1b2c3d:' + (500 + i), name: (i === 0 ? '<u>미배정</u>' : '미배정' + i) + '.pdf', day: '2026-10-0' + (1 + (i % 8)), why: i === 0 ? '<s>알 수 없는 까닭</s>' : '줄을 하나로 정할 수 없습니다' });
      run.last.nUnmatched = Math.max(o.unmatchedTotal || 0, o.unmatched);
    }
    if (o.skipped) run.last.skipped = o.skipped;
  }
  if (o.log !== false && mode !== 'dry') {
    const items = [{ co: 'c2', rid: 't3_2026', key: 'sign', step: 'sign', mail: AUTO_M1, name: '서명본.hwpx', day: '2026-09-25', act: 'done', prev: AUTO_PREV },
      { co: 'c6', rid: 't3_2026', key: 'attach', step: 'attach', mail: AUTO_M2, name: '<b>사진</b>.png', day: '2026-10-09', act: 'done' }];
    for (let i = 0; i < (o.extra || 0); i++) items.push({ co: 'c2', rid: 't3_2026', key: 'attach', step: 'attach', mail: 'i:INBOX-0a1b2c3d:' + (300 + i), name: '더미' + i + '.pdf', day: '2026-10-0' + (1 + (i % 8)), act: 'done' });
    items.forEach((x) => { x.at = AUTO_AT; });
    run.log = { '2026-10-10': { at: AUTO_AT, mode: 'live', items } };
    if (o.yesterday) {   // 어제 저녁 20시 실행이 처리한 줄 — 서류 줄도 자동이 쓴 그대로
      s.scal_docs.c2.t3_2026.items.attach = { st: 'done', gotAt: '2026-10-08', how: 'mail', by: '자동', at: AUTO_AT - 18 * 3600e3, note: '자동 처리 — 메일 «어제것»', link: { src: 'mail', key: 'i:INBOX-0a1b2c3d:401', name: '어제것.pdf', date: '2026-10-08' } };
      run.log['2026-10-09'] = { at: AUTO_AT - 18 * 3600e3, mode: 'live', items: [{ co: 'c2', rid: 't3_2026', key: 'attach', step: 'attach', mail: 'i:INBOX-0a1b2c3d:401', name: '어제것.pdf', day: '2026-10-08', act: 'done', at: AUTO_AT - 18 * 3600e3 }] };
    }
    if (o.days8) for (let d = 3; d <= 9; d++) run.log['2026-10-0' + d] = { at: AUTO_AT, mode: 'live', items: [{ co: 'c2', rid: 't3_2026', key: 'attach', step: 'attach', mail: 'i:INBOX-0a1b2c3d:60' + d, name: (d === 3 ? '여드레전' : '일' + d) + '.pdf', day: '2026-10-0' + d, act: 'done' }] };
  }
  if (Object.keys(run).length) s.scal_autoRun = run;
  return s;
}
function autoWorld(o) {
  o = o || {};
  const paths = [];
  const w = world({ seed: o.seed || autoSeed(o), email: 'p009@pureun.kr', confirm: o.confirm, db: (db) => ({ ref: (p) => {
    paths.push(p);
    const r = db.ref(p);
    if (o.failRead && p.indexOf('scal_autoRun') === 0) return { once: async () => { throw new Error('permission_denied'); }, orderByKey: () => ({ limitToLast: () => ({ once: async () => { throw new Error('permission_denied'); } }) }) };
    if (p === 'scal_autoRun/log') return { once: r.once, orderByKey: () => ({ limitToLast: (n) => { w.limits.push(n); return o.gate ? { once: () => o.gate.then(() => r.orderByKey().limitToLast(n).once()) } : r.orderByKey().limitToLast(n); } }) };
    if (o.gate && p.indexOf('scal_autoRun') === 0) return { once: () => o.gate.then(() => r.once()) };
    if (o.denyCfg && p === 'scal_autoRun/cfg') return { once: r.once, set: async () => { throw new Error('permission_denied'); } };
    if (o.denyDocs && p.indexOf('scal_docs/') === 0) return { once: r.once, set: async () => { throw new Error('permission_denied'); } };
    return r;
  } }) });
  w.paths = paths;
  w.limits = [];
  w.opened = [];
  w.ctx.grOpenAtt = async (ref, name) => { w.opened.push([J(ref), name]); return { ok: true }; };   // 메일 열기 길은 따로 검사한다 — 여기서는 부른 값만 본다
  return w;
}
/* grLoad 는 자동 처리 읽기를 기다리지 않는다 — 값이 오는 것은 따로 기다린다 */
const autoLoad = async (w) => { await w.ctx.grLoad(); await w.ctx.grLoadAuto(); };
const autoSec = (w) => { const h = w.els.today.innerHTML, i = h.indexOf('id="tdAuto"'); return i < 0 ? '' : h.slice(i, h.indexOf('td-sec inbox', i)); };
const autoRows = (h) => countOf(h, /class="td-au( dim)?"/g);   // 흐린 줄(적용 안 됨)도 한 줄

test('170 정적 — 자동 처리 모듈을 inbox·send·nav 다음에 싣는다 · 쓰기는 .set 다섯(서류 줄·종결·되돌림 표시·순서·cfg) · 모드 쓰기는 상수 표 이름으로만 · 읽기도 이름 표 · 새 쓰기 길은 없다 · 색 직접 지정 없음', () => {
  assert.match(SRC, /<script src="js\/pu-gov-report-auto\.js\?v=\d+"><\/script>/);
  ['pu-gov-report-track.js', 'pu-gov-report-docs.js', 'pu-gov-report-nav.js', 'pu-gov-report-inbox.js', 'pu-gov-report-send.js'].forEach((f) =>
    assert.ok(SRC.indexOf(f) < SRC.indexOf('pu-gov-report-auto.js'), f + ' 다음에 싣는다(모듈이 읽는 옆 모듈)'));
  assert.deepEqual(INLINE.match(/\.(set|update|remove|transaction)\s*\(/g) || [], WRITES, '쓰기 명령은 .set 다섯뿐');
  assert.equal(WRITES.length, 5);
  assert.doesNotMatch(INLINE, /\.(update|transaction|remove)\s*\(|ref\([^)]*\)\.push\(/);
  assert.match(SRC, /var GR_AUTO=\{node:'scal_autoRun',/);
  assert.doesNotMatch(INLINE, /ref\(\s*['"]scal_autoRun/, 'GR_AUTO 를 거치지 않았다');
  assert.match(grab('grSetAutoMode'), /fbDb\.ref\(GR_AUTO\.node\+'\/'\+GR_AUTO\.cfg\)\.set\(/, '모드는 cfg 한 칸 .set');
  ['grAutoHtml', 'grAutoRows', 'grAutoName', 'grAutoList', 'grAutoMode', 'grAutoTime', 'grRenderAuto', 'grAutoBadge', 'grAutoLog', 'grAutoCo', 'grAutoBiz', 'grAutoSkip', 'grAutoUnmatched', 'grAutoToggle'].forEach((n) =>
    assert.doesNotMatch(grab(n), /fbDb|\.set\(|\.update\(|fetch\(|localStorage|grSaveCell|grPutCell/, n + ' 은 읽어 그리기만'));
  assert.doesNotMatch(grab('grUndoAuto'), /\.set\(|grSaveCell/, '되돌리기는 서류 줄 쓰기 길 grPutCell 로만');
  assert.match(grab('grUndoAuto'), /grPutCell\(/);
  assert.doesNotMatch(INLINE, /===\s*'자동'|==\s*'자동'/, '«자동» 글자를 화면에 두지 않는다 — PuGovReportAuto.AUTO_BY');
  assert.match(grab('grRenderToday'), /id="tdAuto"/);
  assert.ok(grab('grRenderToday').indexOf('id="tdAuto"') < grab('grRenderToday').indexOf('td-sec inbox'), '받은 서류 묶음 앞');
  assert.match(grab('grLoad'), /grLoadAuto\(\)/, 'grLoad 가 한 번 읽는다');
  assert.doesNotMatch(grab('grLoad'), /await\s+grLoadAuto/, '기다리지 않는다 — 첫 화면이 왕복 하나 늦어지지 않게');
  assert.match(grab('grLoadAuto'), /fbDb\.ref\(G\.node\+'\/'\+G\.log\)\.orderByKey\(\)\.limitToLast\(G\.logN\)\.once\('value'\)/, '기록은 날짜 키 마지막 몇 개만(이름 표 GR_AUTO)');
  assert.match(SRC, /var GR_AUTO=\{[^\r\n]*logN:7,/, '7일');
  const css = SRC.slice(SRC.indexOf('<style>'), SRC.indexOf('</style>')).split(/\r?\n/).filter((l) => /\.td-au|\.td-am/.test(l)).join('\n');
  assert.ok(css.length > 0);
  noColor(css, '새 CSS 는 기존 변수만');
});

test('171 live — 모드 딱지 «켜짐» · 마지막 실행 시각 · 처리/미배정 수 · 오늘 기록 + 마지막 실행의 처리분이 합쳐져 한 줄씩(중복 없음) · 업체·서류 줄 이름·첨부·날짜 · 메일 열기 · 되돌리기 · 값은 이스케이프 · 쓰기 0', async () => {
  const w = autoWorld();
  await autoLoad(w);
  const h = autoSec(w);
  assert.ok(h.includes('🤖 메일 자동 처리'));
  assert.match(h, /<span class="st st-done">켜짐<\/span>/);
  assert.ok(h.includes('마지막 실행 2026-10-10 14:30 · 처리 2건 · 미배정 1건'), h);
  assert.equal(autoRows(h), 2, '오늘 기록 둘 + 마지막 실행 둘은 같은 줄이라 합쳐진다');
  assert.equal(countOf(h, /onclick="grOpenAutoMail\(\d+\)"/g), 2);
  assert.equal(countOf(h, /onclick="grUndoAuto\(\d+\)"/g), 2);
  assert.ok(h.includes('다라정밀') && h.includes('업체 서명본') && h.includes('서명본.hwpx') && h.includes('2026-09-25'), '업체 · 서류 줄 이름 · 첨부 · 날짜');
  assert.ok(h.includes('&#60;i&#62;북&#60;/i&#62;상사') && h.includes('&#60;b&#62;사진&#60;/b&#62;.png'), '업체·첨부 이름은 이스케이프');
  assert.ok(!h.includes('<i>') && !h.includes('<b>사진'), '바깥 값을 그대로 넣지 않았다');
  assert.ok(h.includes('산출물 별첨'), '이름을 못 찾는 쌍(일정 없는 업체)도 줄 이름은 서류 틀에서 — 못 찾으면 줄 키');
  assert.deepEqual([...new Set(w.paths.filter((p) => p.indexOf('scal_autoRun') === 0))].sort(), ['scal_autoRun/cfg', 'scal_autoRun/last', 'scal_autoRun/log'], '읽기는 셋 — 기록은 날짜 칸 하나가 아니라 «마지막 7개»');
  assert.ok(w.limits.length >= 1 && w.limits.every((n) => n === 7), '기록은 orderByKey().limitToLast(7) 로 읽는다: ' + w.limits);
  assert.equal(w.db.쓴것.length, 0, '읽기만');
  assert.equal(w.ctx.GR.auto.mode, 'live');
});

test('172 시범 운행 — cfg 가 없으면 dry · 목록 «이렇게 처리할 예정» · 메일 열기만(되돌리기 없음) · 서류 줄은 안 쓴다', async () => {
  const w = autoWorld({ mode: null, lastMode: 'dry', written: false, log: false });
  await autoLoad(w);
  const h = autoSec(w);
  assert.match(h, /<span class="st st-draft">시범 운행<\/span>/);
  assert.ok(h.includes('이렇게 처리할 예정'), h);
  assert.ok(h.includes('처리 2건 · 미배정 1건'), '시범 운행의 처리 수는 «할 예정»인 건수');
  assert.equal(autoRows(h), 2);
  assert.equal(countOf(h, /grOpenAutoMail\(/g), 2);
  assert.equal(countOf(h, /grUndoAuto\(/g), 0, '시범 운행에는 되돌릴 것이 없다');
  assert.ok(h.includes('쓸 수 있는 줄이 하나'), '근거');
  assert.equal(w.ctx.GR.auto.mode, 'dry');
  assert.equal(w.db.쓴것.length, 0);
});

test('173 꺼짐 — 모드 딱지 «꺼짐» · 목록은 오늘 처리분(되돌리기용)만 · last 가 시범 기록이면 예정 목록을 보이지 않는다', async () => {
  const w = autoWorld({ mode: 'off', lastMode: 'dry' });
  await autoLoad(w);
  const h = autoSec(w);
  assert.match(h, /<span class="st st-wait">꺼짐<\/span>/);
  assert.ok(!h.includes('이렇게 처리할 예정'));
  assert.equal(autoRows(h), 2, '오늘 기록(log)의 두 줄');
  assert.equal(countOf(h, /grUndoAuto\(/g), 2);
});

test('174 읽지 못하면(규칙 게시 전·권한) «자동 처리 상태를 읽지 못했습니다» 한 줄만 — 모드 버튼·목록 없음 · 앱은 그대로 · 던지지 않는다', async () => {
  const w = autoWorld({ failRead: true });
  await autoLoad(w);
  const h = autoSec(w);
  assert.ok(h.includes('<div class="err-s">자동 처리 상태를 읽지 못했습니다</div>'), h);
  assert.equal(countOf(h, /<button/g), 0, '버튼 없음');
  assert.equal(autoRows(h), 0);
  assert.equal(w.ctx.GR.loaded, true, '앱은 그대로 돈다');
  assert.ok(w.els.rows.innerHTML.includes('가나상사') && w.els.today.innerHTML.includes('📬'));
  assert.equal(w.db.쓴것.length, 0);
});

test('175 처리 0건 — last 에 items 가 없어도(DB 가 빈 칸을 버린다) · 번호 객체로 와도 · 오늘 기록이 없어도 던지지 않는다 · last 가 없으면 «아직 실행 기록이 없습니다»', async () => {
  const w = autoWorld({ last: 'noItems', log: false });
  await autoLoad(w);
  let h = autoSec(w);
  assert.ok(h.includes('처리 2건 · 미배정 1건'), h);
  assert.equal(autoRows(h), 0);
  assert.ok(h.includes('최근 자동 처리한 서류가 없습니다'), h);
  const wd = autoWorld({ mode: 'dry', last: 'noItems' });
  await autoLoad(wd);
  assert.ok(autoSec(wd).includes('처리할 예정인 메일이 없습니다'));
  const wo = autoWorld({ last: 'objItems', log: false });
  await autoLoad(wo);
  assert.equal(autoRows(autoSec(wo)), 2, '번호 객체로 와도 평평하게 읽는다');
  const wn = autoWorld({ last: 'none', log: false });
  await autoLoad(wn);
  h = autoSec(wn);
  assert.ok(h.includes('아직 실행 기록이 없습니다'), h);
  assert.equal(wn.ctx.GR.loaded, true);
  const we = autoWorld({ seed: F.seed() });   // scal_autoRun 자체가 없다
  await autoLoad(we);
  assert.match(autoSec(we), /st-draft">시범 운행/, 'cfg 없음 = 시범 운행');
});

test('176 마지막 실행 알림 — last.note 가 있으면 한 줄(실패는 붉게) · 시각은 서울 시각 · 목록은 최대 10줄(+ 나머지 안내)', async () => {
  const w = autoWorld({ note: '실패: 입력 확인 실패', extra: 12 });
  await autoLoad(w);
  const h = autoSec(w);
  assert.ok(h.includes('<div class="err-s">실패: 입력 확인 실패</div>'), h);
  assert.equal(autoRows(h), 10, '최대 10줄');
  assert.ok(h.includes('더 보기 (+4)') && h.includes('전체 14건'), '나머지는 「더 보기」');
  const w2 = autoWorld({ note: '오늘 기록 칸(200)이 차서 3건은 다음 날로 미룸' });
  await autoLoad(w2);
  assert.ok(autoSec(w2).includes('<div class="days">오늘 기록 칸(200)이 차서 3건은 다음 날로 미룸</div>'));
});

test('177 모드 스위치 — 버튼 셋(꺼짐·시범·켜짐) · 시범·꺼짐은 바로 cfg 한 칸 .set {mode, by(내 이름), at} · 켜짐은 확인 창(«서류 상태를 자동으로 완료로 바꿉니다») 뒤에만 · 모르는 값은 쓰지 않는다', async () => {
  const asked = [];
  const w = autoWorld({ confirm: (m) => { asked.push(m); return asked.length !== 2; } });   // 첫 확인은 예, 둘째는 아니오
  await autoLoad(w);
  const h = autoSec(w);
  ['off', 'dry', 'live'].forEach((m) => assert.ok(h.includes('onclick="grSetAutoMode(\'' + m + '\')"'), m));
  assert.match(h, /class="act on"[^>]*onclick="grSetAutoMode\('live'\)"[^>]*aria-pressed="true"/, '지금 모드 표시');
  await w.ctx.grSetAutoMode('dry');
  assert.equal(asked.length, 0, '시범으로 바꿀 때는 묻지 않는다');
  assert.deepEqual(J(w.db.쓴것.map((x) => [x.자리, x.값.mode, x.값.by, typeof x.값.at, Object.keys(x.값).sort()])), [['scal_autoRun/cfg', 'dry', '홍길동', 'number', ['at', 'by', 'mode']]]);
  assert.equal(w.ctx.GR.auto.mode, 'dry');
  assert.match(w.els.tdAuto.innerHTML, /st-draft">시범 운행/, '딱지가 바뀐다');
  await w.ctx.grSetAutoMode('live');   // 확인 1 = 예
  assert.equal(asked.length, 1);
  assert.ok(asked[0].includes('서류 상태를 자동으로 완료로 바꿉니다'), asked[0]);
  assert.equal(w.db.쓴것.length, 2);
  assert.equal(J(w.db.쓴것[1].값).mode, 'live');
  assert.equal(w.ctx.GR.auto.mode, 'live');
  await w.ctx.grSetAutoMode('off');
  await w.ctx.grSetAutoMode('live');   // 확인 2 = 아니오 → 쓰지 않는다
  assert.equal(asked.length, 2);
  assert.equal(w.db.쓴것.length, 3, '아니오 — 켜지 않는다');
  assert.equal(w.ctx.GR.auto.mode, 'off');
  await w.ctx.grSetAutoMode('weird'); await w.ctx.grSetAutoMode('__proto__'); await w.ctx.grSetAutoMode(undefined);
  assert.equal(w.db.쓴것.length, 3, '모르는 값은 쓰지 않는다');
  w.db.쓴것.forEach((x) => assert.equal(x.자리, 'scal_autoRun/cfg'));
  const wn = autoWorld({});   // 확인 창이 없는 환경 — 켜지 않는다
  await autoLoad(wn); await wn.ctx.grSetAutoMode('off');
  await wn.ctx.grSetAutoMode('live');
  assert.equal(wn.db.쓴것.length, 1, '확인 창이 없으면 켜지 않는다');
});

test('178 직원(규칙 거절) — 눌러도 «관리자만 바꿀 수 있습니다» · 값·딱지 그대로 · 쓰기 0 · 잠금은 풀려 다시 눌러 볼 수 있다', async () => {
  const w = autoWorld({ denyCfg: true, confirm: () => true });
  await autoLoad(w);
  await w.ctx.grSetAutoMode('off');
  const h = w.els.tdAuto.innerHTML;
  assert.equal(w.ctx.GR.auto.msg, '저장하지 못했습니다 — 관리자만 바꿀 수 있습니다(규칙 게시 또는 권한 확인)');
  assert.ok(h.includes('<div class="err-s">저장하지 못했습니다 — 관리자만 바꿀 수 있습니다'), h);
  assert.equal(w.ctx.GR.auto.mode, 'live', '값 불변');
  assert.match(h, /st-done">켜짐/, '딱지 불변');
  assert.equal(w.ctx.GR.auto.busy, false);
  assert.equal(w.db.쓴것.length, 0);
  await w.ctx.grSetAutoMode('dry');
  assert.equal(w.db.쓴것.length, 0);
});

test('179 되돌리기(prev 있음) — 옛 줄(발송함) 그대로 + 그 메일 link · 처리자는 내 이름(자동 아님) · 서류 줄 쓰기 길로 한 번 · 로컬 기록·딱지·목록이 바뀐다 · 다시 자동 처리되지 않는다', async () => {
  const w = autoWorld();
  await autoLoad(w);
  const i = w.ctx.GR.auto.rows.findIndex((r) => r.key === 'sign');
  assert.ok(i >= 0 && w.ctx.GR.auto.rows[i].undo, '되돌릴 수 있는 줄');
  await w.ctx.grUndoAuto(i);
  assert.equal(w.db.쓴것.length, 1);
  const x = w.db.쓴것[0];
  assert.equal(x.자리, 'scal_docs/c2/t3_2026/items/sign');
  assert.ok(onlyTrackWrites(w.db) === undefined);
  const v = J(x.값);
  assert.deepEqual(v.link, { src: 'mail', key: AUTO_M1, name: '서명본.hwpx', date: '2026-09-25' }, 'link 를 남긴다');
  assert.equal(v.st, 'doing'); assert.equal(v.sentAt, '2026-09-20');
  assert.ok(!('gotAt' in v), '회신일은 옛 줄에 없었다');
  assert.equal(v.by, '홍길동', '처리자는 사람 이름');
  assert.notEqual(v.by, require('../js/pu-gov-report-auto.js').AUTO_BY);
  assert.equal(typeof v.at, 'number');
  assert.equal(Tr.validate(v, 'sign'), '');
  /* 이 줄은 다시 자동 대상이 아니다 — 연결(link)이 있고 처리자가 사람이다 */
  const Auto = require('../js/pu-gov-report-auto.js');
  assert.equal(Auto.usable(v, 'sign'), false);
  assert.equal(Auto.usable(Object.assign({}, v, { link: undefined }), 'sign'), true, 'link 가 없으면 발송함 줄은 다시 자동 대상이 된다 — 그래서 link 를 남긴다');
  assert.equal(w.ctx.GR.track.c2.t3_2026.sign.by, '홍길동', '로컬 기록이 바뀐다');
  const h = autoSec(w);
  assert.equal(countOf(h, /grUndoAuto\(/g), 1, '되돌린 줄에는 단추가 없다 — 다른 한 줄만');
  assert.ok(h.includes('되돌렸습니다'), h);
  assert.equal(autoRows(h), 2, '줄은 남는다(기록)');
  await w.ctx.grUndoAuto(i);
  assert.equal(w.db.쓴것.length, 1, '다시 눌러도 쓰지 않는다');
});

test('180 되돌리기(prev 없음) — {st:none} + link · 처리자는 사람 · 이 줄에도 메일 연결이 남아 «연결됨» 으로 둔다', async () => {
  const w = autoWorld();
  await autoLoad(w);
  const i = w.ctx.GR.auto.rows.findIndex((r) => r.key === 'attach');
  await w.ctx.grUndoAuto(i);
  assert.equal(w.db.쓴것.length, 1);
  assert.equal(w.db.쓴것[0].자리, 'scal_docs/c6/t3_2026/items/attach');
  const v = J(w.db.쓴것[0].값);
  assert.deepEqual(Object.keys(v).sort(), ['at', 'by', 'link', 'st']);
  assert.equal(v.st, 'none'); assert.equal(v.by, '홍길동');
  assert.deepEqual(v.link, { src: 'mail', key: AUTO_M2, name: '<b>사진</b>.png', date: '2026-10-09' });
  assert.equal(require('../js/pu-gov-report-auto.js').usable(v, 'attach'), false);
  assert.equal(Tr.validate(v, 'attach'), '');
});

test('181 되돌리기를 막는 것 — 그 사이 사람이 고친 줄 · 저장 거절 · 기록을 못 읽은 상태 · 시범 운행 줄 · 이상한 이름 — 안내만 하고 값은 그대로', async () => {
  /* 사람이 고친 줄 */
  const w1 = autoWorld();
  await autoLoad(w1);
  const line = w1.db.읽기('scal_docs/c2/t3_2026/items/sign');
  await w1.db.ref('scal_docs/c2/t3_2026/items/sign').set(Object.assign({}, line, { by: '김가나' }));   // 화면을 연 뒤 다른 사람이 고쳤다(화면의 기록은 아직 낡았다)
  const n0 = w1.db.쓴것.length;
  await w1.ctx.grUndoAuto(w1.ctx.GR.auto.rows.findIndex((r) => r.key === 'sign'));
  assert.equal(w1.db.쓴것.length, n0, '사람이 고친 줄은 덮지 않는다(눌렀을 때 줄을 다시 읽어 본다)');
  assert.ok(w1.ctx.GR.auto.msg.includes('사람이 고쳤'), w1.ctx.GR.auto.msg);
  assert.equal(w1.ctx.GR.auto.err, true);
  assert.equal(w1.ctx.GR.auto.busy, false);
  /* 저장 거절 */
  const w2 = autoWorld({ denyDocs: true });
  await autoLoad(w2);
  const before = JSON.stringify(w2.ctx.GR.track);
  await w2.ctx.grUndoAuto(w2.ctx.GR.auto.rows.findIndex((r) => r.key === 'sign'));
  assert.equal(JSON.stringify(w2.ctx.GR.track), before, '값 불변');
  assert.ok(w2.ctx.GR.auto.msg.includes(Tr.SAVE_FAIL), w2.ctx.GR.auto.msg);
  assert.equal(w2.ctx.GR.auto.busy, false);
  assert.equal(w2.db.쓴것.length, 0);
  assert.equal(w2.ctx.GR.saving['c2/t3_2026/sign'], undefined, '잠금이 풀린다');
  /* 기록을 못 읽은 상태 */
  const w3 = autoWorld({ denyDocs: false });
  await autoLoad(w3);
  w3.ctx.GR.track = null; w3.ctx.GR.trackErr = true;
  await w3.ctx.grUndoAuto(0);
  assert.equal(w3.db.쓴것.length, 0);
  assert.ok(w3.ctx.GR.auto.msg.includes('기록'), w3.ctx.GR.auto.msg);
  /* 시범 운행의 예정 줄 · 범위 밖 번호 */
  const w4 = autoWorld({ mode: 'dry', written: false });
  await autoLoad(w4);
  await w4.ctx.grUndoAuto(0); await w4.ctx.grUndoAuto(99); await w4.ctx.grUndoAuto(-1); await w4.ctx.grUndoAuto('x');
  assert.equal(w4.db.쓴것.length, 0);
  /* 이상한 이름 */
  const bad = autoSeed(); bad.scal_autoRun.log['2026-10-10'].items[0].key = 'a/b'; bad.scal_autoRun.log['2026-10-10'].items[1].rid = 'x.y';
  const w5 = autoWorld({ seed: bad });
  await autoLoad(w5);
  await w5.ctx.grUndoAuto(0); await w5.ctx.grUndoAuto(1);
  assert.equal(w5.db.쓴것.length, 0, '규칙 열쇠 꼴이 아니면 쓰지 않는다');
});

test('182 메일 열기 — 기존 grOpenAtt 길(연결 열쇠 parse + 첨부 이름) · 개인 자료 거름은 서버가 이미 했다 · 범위 밖 번호는 무시', async () => {
  const w = autoWorld();
  await autoLoad(w);
  const i = w.ctx.GR.auto.rows.findIndex((r) => r.key === 'sign');
  await w.ctx.grOpenAutoMail(i);
  assert.deepEqual(w.opened, [[{ kind: 'imap', slug: 'INBOX-0a1b2c3d', uid: '101' }, '서명본.hwpx']]);
  await w.ctx.grOpenAutoMail(99); await w.ctx.grOpenAutoMail(-1);
  assert.equal(w.opened.length, 1);
  assert.equal(w.db.쓴것.length, 0);
});

test('183 «자동» 딱지 — 서류 체크표 칸·칸 창 머리에 처리자가 자동인 줄이 있을 때만 · 사람 줄에는 없다', async () => {
  const w = autoWorld();
  await autoLoad(w);
  w.ctx.grSetBiz('consulting-04');
  const d = w.els.docs.innerHTML;
  assert.match(d, /data-step="sign"[^>]*>[^]*?<\/button> <span class="tag-ai"[^>]*>자동<\/span>/, '다라정밀 ③ 칸');
  assert.equal(countOf(d, />자동<\/span>/g), 1, '④ 칸(기록 없음)에는 없다');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  assert.match(w.els.cellw.innerHTML, /<span class="tag-ai"[^>]*>자동<\/span>/, '칸 창 머리');
  assert.ok(w.els.cellw.innerHTML.includes('고친 사람 자동'), '기존 «고친 사람» 줄은 그대로');
  /* 사람이 고친 줄 */
  const s = autoSeed(); s.scal_docs.c2.t3_2026.items.sign.by = '김가나';
  const w2 = autoWorld({ seed: s });
  await autoLoad(w2);
  w2.ctx.grSetBiz('consulting-04');
  assert.ok(!w2.els.docs.innerHTML.includes('>자동</span>'));
  w2.ctx.grOpenCell('c2', 't3', 'sign');
  assert.ok(!w2.els.cellw.innerHTML.includes('>자동</span>'));
  /* 기록을 못 읽으면 딱지도 없다(던지지 않는다) */
  const w3 = autoWorld();
  await autoLoad(w3);
  w3.ctx.GR.track = null; w3.ctx.GR.trackErr = true;
  w3.ctx.grSetBiz('consulting-04');
  assert.ok(!w3.els.docs.innerHTML.includes('>자동</span>'));
});

test('184 칸 창 저장은 그대로 — grPutCell 을 거쳐 같은 한 줄 .set · 기존 오늘 할 일·첫 화면 구성은 그대로(급함·챙기기·사업 카드 띠·받은 서류 묶음) · 구역은 받은 서류 묶음 앞', async () => {
  const w = autoWorld();
  await autoLoad(w);
  w.ctx.grSetBiz('consulting-04');
  w.ctx.grOpenCell('c2', 't3', 'sign');
  w.els.cwSt.value = 'done'; w.els.cwSent.value = '2026-09-20'; w.els.cwGot.value = '2026-09-26'; w.els.cwNote.value = '메모';
  await w.ctx.grSaveCell();
  assert.equal(w.db.쓴것.length, 1);
  assert.equal(w.db.쓴것[0].자리, 'scal_docs/c2/t3_2026/items/sign');
  assert.equal(J(w.db.쓴것[0].값).by, '홍길동');
  w.ctx.grGoHome();
  const h = w.els.today.innerHTML;
  assert.ok(h.includes('class="td-sec hot"') && h.includes('class="td-strip"') && h.includes('📬'));
  assert.ok(h.indexOf('id="tdAuto"') > 0 && h.indexOf('id="tdAuto"') < h.indexOf('td-sec inbox'), '구역은 받은 서류 묶음 앞');
  assert.equal(countOf(h, /class="td-task/g), tdModel(w).total, '한 줄 = 한 가지 일 — 자동 처리 줄은 할 일로 세지 않는다');
});

/* ── 수정 라운드 1 (독립 검토 I4·I5·Minor) ── */
test('185 기록은 날짜 키 마지막 7개 — 어제 저녁에 처리된 줄도 목록에 나오고 되돌릴 수 있다(다음 실행이 0건이어도) · 8일 전은 읽지 않는다 · 최근 순 · 처리 날짜가 보인다', async () => {
  const w = autoWorld({ yesterday: true, last: 'noItems' });   // 다음 실행이 0건이라 last 에 items 가 없다
  await autoLoad(w);
  const h = autoSec(w);
  assert.equal(autoRows(h), 3, '오늘 둘 + 어제 하나');
  assert.ok(h.includes('어제것.pdf') && h.includes('처리 2026-10-09 20:30'), '처리 날짜·시각');
  assert.ok(h.indexOf('서명본.hwpx') < h.indexOf('어제것.pdf'), '최근 순');
  assert.equal(countOf(h, /grUndoAuto\(/g), 3, '7일 안 줄은 모두 되돌릴 수 있다');
  assert.ok(w.limits.length >= 1 && w.limits.every((n) => n === 7), 'limitToLast(7): ' + w.limits);
  const i = w.ctx.GR.auto.rows.findIndex((r) => r.name === '어제것.pdf');
  assert.ok(w.ctx.GR.auto.rows[i].undo);
  await w.ctx.grUndoAuto(i);
  assert.equal(w.db.쓴것.length, 1);
  assert.equal(w.db.쓴것[0].자리, 'scal_docs/c2/t3_2026/items/attach');
  const v = J(w.db.쓴것[0].값);
  assert.equal(v.st, 'none'); assert.equal(v.by, '홍길동'); assert.equal(v.link.key, 'i:INBOX-0a1b2c3d:401');
  /* 날짜 키가 여덟이면 가장 오래된 날은 읽지 않는다 */
  const w8 = autoWorld({ days8: true });
  await autoLoad(w8);
  const h8 = autoSec(w8);
  assert.ok(!h8.includes('여드레전.pdf'), '8번째로 오래된 날은 읽지 않았다');
  assert.ok(h8.includes('일4.pdf') && h8.includes('일9.pdf'), '나머지 일곱 날은 읽었다');
  assert.ok(w8.limits.every((n) => n === 7));
  assert.equal(w8.db.쓴것.length, 0);
});

test('186 grLoad 는 자동 처리 읽기를 기다리지 않는다 — 읽기가 늦어도 판은 먼저 그려지고, 값이 오면 첫 화면만 다시 그린다', async () => {
  let open; const gate = new Promise((r) => { open = r; });
  const w = autoWorld({ gate });
  let timer;
  await Promise.race([w.ctx.grLoad(), new Promise((_, no) => { timer = setTimeout(() => no(new Error('grLoad 가 자동 처리 읽기를 기다린다')), 1500); })]);
  clearTimeout(timer);
  assert.equal(w.ctx.GR.loaded, true, '판은 그려졌다');
  assert.ok(w.els.rows.innerHTML.includes('가나상사') && w.els.today.innerHTML.includes('📬'));
  assert.ok(autoSec(w).includes('불러오는 중…'), '구역은 기다리는 중 표시');
  open();
  await new Promise((r) => setTimeout(r, 30));
  assert.match(autoSec(w), /st-done">켜짐/, '값이 오면 첫 화면이 다시 그려진다');
  assert.equal(autoRows(autoSec(w)), 2);
  /* 읽기가 아예 안 와도(영영 대기) 앱은 그대로 */
  const w2 = autoWorld({ gate: new Promise(() => {}) });
  let t2;
  await Promise.race([w2.ctx.grLoad(), new Promise((_, no) => { t2 = setTimeout(() => no(new Error('멈췄다')), 1500); })]);
  clearTimeout(t2);
  assert.equal(w2.ctx.GR.loaded, true);
  assert.ok(w2.els.rows.innerHTML.includes('가나상사'));
});

test('187 미배정 — last.unmatched 가 있으면 접이식 목록(≤10줄 + «외 n건» · 업체·서류(사업 이름)·첨부·날짜·까닭 그대로 · 메일 열기) · 수동 확인에도 남는다는 한 줄 · 없으면 접이식을 안 그린다', async () => {
  const w = autoWorld({ unmatched: 12, unmatchedTotal: 15 });
  await autoLoad(w);
  const h = autoSec(w);
  assert.match(h, /<details class="td-un"[^>]*><summary>미배정 15건 — 사람이 확인하세요<\/summary>/);
  const d = h.slice(h.indexOf('<details'), h.indexOf('</details>'));
  assert.equal(countOf(d, /class="td-au"/g), 10, '최대 10줄');
  assert.ok(d.includes('외 5건'), '15 − 10');
  assert.ok(d.includes('&#60;u&#62;미배정&#60;/u&#62;.pdf') && d.includes('&#60;s&#62;알 수 없는 까닭&#60;/s&#62;'), '첨부 이름·까닭은 이스케이프');
  assert.ok(!d.includes('<u>') && !d.includes('<s>'));
  assert.ok(d.includes('줄을 하나로 정할 수 없습니다'), '서버 까닭 그대로');
  assert.ok(d.includes('다라정밀') && d.includes('&#60;i&#62;북&#60;/i&#62;상사'), '업체');
  assert.ok(d.includes('인사노무컨설팅충남북부상의'), '서류 = rid → 일정 사업 → 사업 이름');
  assert.ok(d.includes('(서류 미정)'), 'rid 가 비면');
  assert.ok(d.includes('수동 「받은 서류 확인」'), '수동 후보에도 남는다');
  assert.equal(countOf(d, /onclick="grOpenAutoMail\(\d+,1\)"/g), 10);
  assert.equal(countOf(d, /grUndoAuto\(/g), 0, '미배정 줄에는 되돌릴 것이 없다');
  await w.ctx.grOpenAutoMail(0, 1);
  assert.deepEqual(w.opened, [[{ kind: 'imap', slug: 'INBOX-0a1b2c3d', uid: '500' }, '<u>미배정</u>.pdf']]);
  await w.ctx.grOpenAutoMail(99, 1);
  assert.equal(w.opened.length, 1);
  /* 접어 두면 접힌 채, 펼쳤다면 다시 그려도 펼친 채 */
  assert.ok(!/<details class="td-un" open/.test(h));
  w.ctx.GR.auto.unOpen = true; w.ctx.grRenderAuto();
  assert.match(w.els.tdAuto.innerHTML, /<details class="td-un" open/);
  /* 없으면(옛 기록·0건) 안 그린다 */
  const w0 = autoWorld({});
  await autoLoad(w0);
  assert.ok(!autoSec(w0).includes('<details'));
  const w1 = autoWorld({ unmatched: 2 });
  await autoLoad(w1);
  assert.ok(!autoSec(w1).includes('외 '), '10줄 이하면 «외» 없음');
  assert.ok(autoSec(w1).includes('미배정 2건 — 사람이 확인하세요'));
  assert.equal(w.db.쓴것.length, 0);
});

test('188 모름·건너뜀 — last.mode 가 unknown 이면 «모름» 딱지 · cfg 값이 이상해도 «모름»(cfg 가 없을 때의 «시범 운행» 과 구분) · last.skipped 는 한국어 한 줄(많은 순 · 모르는 키는 키 그대로 · 숫자 아닌 것·0 은 뺀다)', async () => {
  const w = autoWorld({ lastMode: 'unknown', skipped: { sharedAddr: 2, priv: 1, weirdKey: 3, zero: 0, bad: 'x' } });
  await autoLoad(w);
  const h = autoSec(w);
  assert.ok(h.includes('실행 모드 <span class="st st-wait">모름</span>'), h);
  assert.match(h, /st-done">켜짐/, '맨 위 딱지는 cfg(스위치)');
  assert.ok(h.includes('<div class="days">이번 실행 건너뜀: weirdKey 3 · 공유 주소 2 · 개인 자료 1</div>'), h);
  assert.equal(autoRows(h), 2, '모름인 마지막 실행의 items 는 처리분이 아니다 — 오늘 기록만');
  const ws = autoWorld({ mode: 'weird' });
  await autoLoad(ws);
  assert.match(autoSec(ws), /<span class="st st-wait">모름<\/span><\/div>/, '이상한 cfg 값은 «모름»');
  assert.equal(ws.ctx.GR.auto.mode, 'unknown');
  assert.ok(!autoSec(ws).includes('onclick="grSetAutoMode(\'weird\')"'));
  assert.equal(countOf(autoSec(ws), /grSetAutoMode\('/g), 3, '버튼은 그대로 셋 — 어느 것도 눌린 표시가 아니다');
  assert.ok(!/class="act on"/.test(autoSec(ws)));
  const wn = autoWorld({ mode: null, lastMode: 'dry', written: false, log: false });
  await autoLoad(wn);
  assert.match(autoSec(wn), /st-draft">시범 운행/, 'cfg 가 없으면 시범 운행');
  const wk = autoWorld({});
  await autoLoad(wk);
  assert.ok(!autoSec(wk).includes('이번 실행 건너뜀') && !autoSec(wk).includes('실행 모드'), '없으면 한 줄도 없다');
  const wd = autoWorld({ mode: 'dry', lastMode: 'live', written: false });   // cfg 는 시범인데 마지막 실행은 켜짐 — 다름을 보인다
  await autoLoad(wd);
  assert.ok(autoSec(wd).includes('실행 모드 <span class="st st-done">켜짐</span>'));
});

test('189 되돌리기 보호 — 줄이 «자동이 쓴 그대로»가 아니면(처리자가 사람·연결한 메일이 로그의 메일과 다름·줄이 없음) 쓰지 않는다 · 같을 때만 쓴다', async () => {
  for (const [why, edit] of [['연결한 메일이 다르다', (l) => { l.link.key = 'i:INBOX-0a1b2c3d:999'; }], ['처리자가 사람이다', (l) => { l.by = '김가나'; }]]) {
    const s = autoSeed();
    const w = autoWorld({ seed: s });
    await autoLoad(w);
    const path = 'scal_docs/c2/t3_2026/items/sign';
    const line = w.db.읽기(path);
    edit(line);
    await w.db.ref(path).set(line);   // 화면을 연 뒤 줄이 바뀌었다(화면의 기록은 아직 낡았다)
    const n0 = w.db.쓴것.length;
    await w.ctx.grUndoAuto(w.ctx.GR.auto.rows.findIndex((r) => r.key === 'sign'));
    assert.equal(w.db.쓴것.length, n0, why + ' — 쓰지 않는다');
    assert.ok(w.ctx.GR.auto.msg.includes('그대로 두었습니다'), why + ': ' + w.ctx.GR.auto.msg);
  }
  const wn = autoWorld({});
  await autoLoad(wn);
  await wn.db.ref('scal_docs/c2/t3_2026/items/sign').set({ st: 'done', by: '자동', at: 1, link: { src: 'mail', key: AUTO_M1 } });
  await wn.ctx.grUndoAuto(wn.ctx.GR.auto.rows.findIndex((r) => r.key === 'sign'));
  assert.equal(wn.db.쓴것.length, 2, '자동이 쓴 그대로이고 메일이 같으면 쓴다(처음 한 번은 이 검사의 흉내 쓰기)');
});

/* ── 수정 라운드 2 (재검토) ── */
test('190 세 목록 더 보기 — 시범 예정 25건: 10줄 + 「더 보기(+15)」 → 25줄 · 미배정 15건 · 되돌리기 목록(live) · 다시 그려도 유지 · 상한 200줄 · 제목에 전체 건수', async () => {
  /* 시범 운행 예정 */
  const autoAll = (x) => countOf(x, /class="td-au( dim)?"/g);
  const w = autoWorld({ mode: 'dry', written: false, planN: 25 });
  await autoLoad(w);
  let h = autoSec(w);
  assert.ok(h.includes('시범 운행 — 전체 25건 · 이렇게 처리할 예정'), h);
  assert.equal(autoRows(h), 10);
  assert.ok(h.includes('<button type="button" class="act" onclick="grAutoMore(\'run\')">더 보기 (+15)</button>'), h);
  assert.deepEqual(J(w.ctx.GR.autoMore), { run: false, undo: false, unmatched: false });
  w.ctx.grAutoMore('run');
  h = w.els.tdAuto.innerHTML;
  assert.equal(autoRows(h), 25, '전부');
  assert.ok(!h.includes('더 보기'), '더 보기 단추는 사라진다');
  assert.equal(w.ctx.GR.autoMore.run, true);
  assert.equal(countOf(h, /grOpenAutoMail\(\d+\)/g), 25, '메일 열기 단추도 모두');
  w.ctx.grRender();
  assert.equal(autoRows(autoSec(w)), 25, '다시 그려도 유지');
  assert.equal(countOf(autoSec(w), /grUndoAuto\(/g), 0);
  w.ctx.grAutoMore('weird'); w.ctx.grAutoMore('__proto__');
  assert.deepEqual(J(w.ctx.GR.autoMore), { run: true, undo: false, unmatched: false }, '모르는 이름은 무시');
  /* 되돌리기 목록(live) */
  const wl = autoWorld({ extra: 25 });
  await autoLoad(wl);
  h = autoSec(wl);
  assert.ok(h.includes('최근 자동 처리 — 전체 27건 · 최근 기록(최대 7일치)의 줄은 되돌릴 수 있습니다'), h);
  assert.ok(!h.includes('7일 안 줄'));
  assert.equal(autoAll(h), 10);
  assert.ok(h.includes('grAutoMore(\'undo\')">더 보기 (+17)</button>'), h);
  wl.ctx.grAutoMore('undo');
  h = wl.els.tdAuto.innerHTML;
  assert.equal(autoAll(h), 27);
  assert.equal(countOf(h, /grUndoAuto\(\d+\)/g), 2 + 0, '더미 줄은 서류 줄이 없어(적용 안 됨) 단추가 없다 — 실제로 쓴 둘만');
  assert.ok(wl.ctx.GR.autoMore.undo && !wl.ctx.GR.autoMore.run);
  /* 상한 200줄 */
  const wc = autoWorld({ extra: 210 });
  await autoLoad(wc);
  wc.ctx.grAutoMore('undo');
  h = wc.els.tdAuto.innerHTML;
  assert.equal(autoAll(h), 200, '최대 200줄');
  assert.ok(h.includes('전체 212건 중 200건까지 보입니다'), h);
  /* 미배정 */
  const wu = autoWorld({ unmatched: 15 });
  await autoLoad(wu);
  let d = autoSec(wu); d = d.slice(d.indexOf('<details'), d.indexOf('</details>'));
  assert.equal(countOf(d, /class="td-au"/g), 10);
  assert.ok(d.includes('grAutoMore(\'unmatched\')">더 보기 (+5)</button>') && d.includes('외 5건'), d);
  wu.ctx.grAutoMore('unmatched');
  d = wu.els.tdAuto.innerHTML; d = d.slice(d.indexOf('<details'), d.indexOf('</details>'));
  assert.equal(countOf(d, /class="td-au"/g), 15);
  assert.ok(!d.includes('더 보기') && !d.includes('외 '), d);
  assert.equal(countOf(d, /onclick="grOpenAutoMail\(\d+,1\)"/g), 15);
  await wu.ctx.grOpenAutoMail(14, 1);
  assert.equal(wu.opened.length, 1, '열 번째 뒤 줄의 메일도 연다');
  assert.equal(wu.db.쓴것.length, 0);
});

test('191 기록은 있는데 줄이 안 쓰인 경우(그 사이 사람이 저장) — «처리됨» 으로 믿지 않는다: 흐리게 + 「자동 처리가 적용되지 않음」 + 되돌리기 단추 없음 · 화면의 기록이 낡았거나 기록을 못 읽었으면 기존대로', async () => {
  const s = autoSeed();
  s.scal_docs.c2.t3_2026.items.sign = { st: 'doing', sentAt: '2026-09-20', by: '김가나', at: 1 };   // 서버가 기록(log)만 남기고 줄은 사람이 먼저 저장했다
  const w = autoWorld({ seed: s });
  await autoLoad(w);
  let h = autoSec(w);
  assert.equal(countOf(h, /class="td-au dim"/g), 1);
  assert.equal(countOf(h, /grUndoAuto\(/g), 1, '실제로 쓴 한 줄만');
  assert.ok(h.includes('자동 처리가 적용되지 않음'));
  let dim = h.slice(h.indexOf('<div class="td-au dim">'));
  const nx = dim.indexOf('<div class="td-au">', 5);
  if (nx > 0) dim = dim.slice(0, nx);
  assert.ok(dim.includes('서명본.hwpx') && !dim.includes('grUndoAuto'), dim);
  assert.ok(dim.includes('grOpenAutoMail('), '메일 열기는 그대로');
  const i = w.ctx.GR.auto.rows.findIndex((r) => r.key === 'sign');
  assert.equal(w.ctx.GR.auto.rows[i].undo, false);
  await w.ctx.grUndoAuto(i);
  assert.equal(w.db.쓴것.length, 0);
  /* 화면의 기록이 그 처리보다 낡았다(처리가 화면을 연 뒤) — 판단하지 않고 단추를 낸다(누르면 줄을 다시 읽는다) */
  const s2 = autoSeed();
  s2.scal_docs.c2.t3_2026.items.sign = { st: 'doing', sentAt: '2026-09-20', by: '김가나', at: 1 };
  s2.scal_autoRun.log['2026-10-10'].items[0].at = Date.now() + 3600e3;
  const w2 = autoWorld({ seed: s2 });
  await autoLoad(w2);
  h = autoSec(w2);
  assert.equal(countOf(h, /class="td-au dim"/g), 0);
  assert.equal(countOf(h, /grUndoAuto\(/g), 2);
  /* 기록을 못 읽었으면 기존대로 */
  const w3 = autoWorld({ seed: s });
  await autoLoad(w3);
  w3.ctx.GR.track = null; w3.ctx.GR.trackErr = true; w3.ctx.grRenderAuto();
  h = w3.els.tdAuto.innerHTML;
  assert.equal(countOf(h, /class="td-au dim"/g), 0);
  assert.equal(countOf(h, /grUndoAuto\(/g), 2);
  /* 자동이 쓴 그대로면 평소처럼 */
  const w4 = autoWorld({});
  await autoLoad(w4);
  assert.equal(countOf(autoSec(w4), /class="td-au dim"/g), 0);
  assert.equal(countOf(autoSec(w4), /grUndoAuto\(/g), 2);
});

test('192 미배정 why 가 «[기술보호] » 로 시작하면 딱지 «기술보호 — 수동 확인» · why 원문은 그대로(이스케이프)', async () => {
  const s = autoSeed({ unmatched: 3 });
  s.scal_autoRun.last.unmatched[1].why = '[기술보호] 줄 이름이 맞아야 합니다 <b>x</b>';
  const w = autoWorld({ seed: s });
  await autoLoad(w);
  let d = autoSec(w); d = d.slice(d.indexOf('<details'), d.indexOf('</details>'));
  assert.equal(countOf(d, /기술보호 — 수동 확인/g), 1);
  assert.ok(d.includes('<span class="tag-chk">기술보호 — 수동 확인</span>'));
  assert.ok(d.includes('[기술보호] 줄 이름이 맞아야 합니다 &#60;b&#62;x&#60;/b&#62;'), '원문 그대로 + 이스케이프');
  assert.ok(!d.includes('<b>x</b>'));
});
