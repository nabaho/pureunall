'use strict';
/* 정부컨설팅 보고서 — 「양식 서고」(관리자) 를 gov-consulting.html 에서 떠서 돌린다 (2026-10-09)
 *
 * ★ 지키는 것
 *   ① 칸 지도와 안 맞는 양식(missing)은 서고에 쓰지 않는다 — 틀린 양식으로 보고서가 나가면 안 된다.
 *   ② 맞으면 본문 → 색인 차례로 쓴다(기금 tplCloudPut 꼴: 색인이 있으면 본문도 있다).
 *   ③ .hwp 는 받지 않는다 — 한글에서 HWPX 로 바꿔 올려야 한다.
 *   ④ 관리자가 아니면 서고 창이 안 열린다.
 *   ⑤ 그 해 양식이 없으면 그 이전 가장 최근 해 양식을 쓴다.
 *
 * 공개 저장소다 — 실제 양식·업체 자료를 넣지 않는다(합성 바이트만).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert');
const FakeDb = require('./helpers/fake-rtdb.js');
const Pack = require('../js/pu-gov-report-pack.js');
const Rpt = require('../js/pu-gov-report.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
const HTML = SRC.replace(/<!--[\s\S]*?-->/g, ' ');

function grab(n) {
  const i = SRC.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; st = true; }
    else if (SRC[j] === '}') { d--; if (st && !d) return SRC.slice(i, j + 1); }
  }
}

const NAMES = ['grpFormsRef', 'grpFormsIndexRef', 'grpLoadJsZip', 'grpLoadTemplate', 'grpSaveTemplate',
  'grpFormsNote', 'grpOpenForms', 'grpRenderForms'];

function fakeEl() {
  const cls = new Set();
  return { innerHTML: '', textContent: '', style: {}, value: '', files: null,
    classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) },
    click() {}, addEventListener() {} };
}

function world(opts) {
  const o = opts || {};
  const db = FakeDb.만들기(o.seed || {});
  const els = {};
  const ctx = {
    console, Promise, Uint8Array, Date, String, Object, Array, JSON, Math, RegExp, Error,
    FB_READY: true, _fbDB: db,
    isAdmin: () => o.admin !== false,
    getSession: () => ({ name: '관리자', id: 'u1', isAdmin: o.admin !== false }),
    toast: (m, k) => { ctx.__toasts.push({ m: String(m), k: k || '' }); },
    __toasts: [],
    escAttr: (v) => String(v == null ? '' : v),
    todayStr: () => '2026-10-09',
    q: (s) => (els[s] = els[s] || fakeEl()),
    PuGovReportPack: {
      checkTemplate: async () => ({ missing: o.missing || [], sections: 1 }),
      b64ToBytes: Pack.b64ToBytes, bytesToB64: Pack.bytesToB64
    },
    PuGovReport: { FORMS: Rpt.FORMS },
    window: { JSZip: {} },
    document: { createElement: () => fakeEl(), head: { appendChild() {} } }
  };
  vm.createContext(ctx);
  const ko = (SRC.match(/const GRP_FILE_KO=\{[^}]*\};/) || ['var GRP_FILE_KO={};'])[0];
  vm.runInContext('var _grpJsZipP=null, _grpPick=null;\n' + ko + '\n' + NAMES.map(grab).join('\n'), ctx);
  return { ctx, db, els };
}
const hwpx = (name, bytes) => ({ name, size: bytes.length, arrayBuffer: async () => new Uint8Array(bytes).buffer });

test('① missing 이 있으면 서고에 쓰지 않고, 무엇이 안 맞는지 보인다', async () => {
  const w = world({ missing: ['T1.C1.P0', 'T2.C2.P0'] });
  const r = await w.ctx.grpSaveTemplate('cci-north', 'main', '2026', hwpx('양식.hwpx', [1, 2, 3]));
  assert.deepStrictEqual(Array.from(r.missing), ['T1.C1.P0', 'T2.C2.P0']);
  assert.strictEqual(w.db.쓴것.length, 0, '안 맞는 양식을 썼다');
  const shown = w.els['#rfMsg'].innerHTML;
  assert.match(shown, /T1\.C1\.P0/);
  assert.match(shown, /올해 양식이 바뀌었습니다/);
});

test('② 맞으면 본문을 먼저, 색인을 나중에 쓴다', async () => {
  const w = world();
  const r = await w.ctx.grpSaveTemplate('cci-seosan', 'visit', '2026', hwpx('방문.hwpx', [9, 8, 7, 6]));
  assert.deepStrictEqual(Array.from(r.missing), []);
  const at = w.db.쓴것.map((x) => x.자리);
  assert.deepStrictEqual(at, ['scal_rptForms/cci-seosan/visit/2026', 'scal_rptFormsIndex/cci-seosan/visit/2026']);
  const body = w.db.읽기('scal_rptForms/cci-seosan/visit/2026');
  assert.deepStrictEqual(Array.from(Pack.b64ToBytes(body.b64)), [9, 8, 7, 6]);
  const idx = w.db.읽기('scal_rptFormsIndex/cci-seosan/visit/2026');
  assert.strictEqual(idx.size, 4);
  assert.strictEqual(idx.name, '방문.hwpx');
  assert.ok(!('b64' in idx), '색인에 본문을 넣지 않는다');
});

test('③ .hwp 는 거절한다 — 한글에서 HWPX 로 바꿔 올려야 한다', async () => {
  const w = world();
  let checked = false;
  w.ctx.PuGovReportPack.checkTemplate = async () => { checked = true; return { missing: [] }; };
  const r = await w.ctx.grpSaveTemplate('techguard', 'main', '2026', hwpx('양식.hwp', [1]));
  assert.ok(r.error, '거절해야 한다');
  assert.strictEqual(w.db.쓴것.length, 0);
  assert.strictEqual(checked, false);
  assert.ok(w.ctx.__toasts.some((t) => /한글에서 HWPX 로 바꿔 올려 주세요/.test(t.m)));
});

test('③-2 관리자가 아니면 저장도 하지 않는다', async () => {
  const w = world({ admin: false });
  const r = await w.ctx.grpSaveTemplate('techguard', 'main', '2026', hwpx('a.hwpx', [1]));
  assert.ok(r.error);
  assert.strictEqual(w.db.쓴것.length, 0);
});

test('④ 관리자가 아니면 서고 창이 열리지 않는다', async () => {
  const w = world({ admin: false });
  await w.ctx.grpOpenForms();
  assert.ok(!(w.els['#mbRptForms'] && w.els['#mbRptForms'].classList.contains('open')), '관리자 아닌데 열렸다');
  const a = world();
  await a.ctx.grpOpenForms();
  assert.ok(a.els['#mbRptForms'].classList.contains('open'), '관리자에게는 열려야 한다');
});

test('④-2 서고 창은 양식·파일·연도별 등록 상태를 보인다', async () => {
  const a = world({ seed: { scal_rptFormsIndex: { techguard: { main: { 2025: { at: 1, size: 10, name: 'x.hwpx' } } } } } });
  await a.ctx.grpOpenForms();
  const h = a.els['#rfBody'].innerHTML;
  Object.keys(Rpt.FORMS).forEach((k) => assert.ok(h.includes(Rpt.FORMS[k].name), k + ' 양식이 안 보인다'));
  assert.match(h, /2025/);
});

test('⑤ 그 해가 없으면 그 이전 가장 최근 해 양식을 준다(뒤 해는 쓰지 않는다)', async () => {
  const b64 = (a) => Pack.bytesToB64(new Uint8Array(a));
  const seed = {
    scal_rptFormsIndex: { techguard: { main: { 2024: { at: 1 }, 2025: { at: 2 }, 2027: { at: 3 } } } },
    scal_rptForms: { techguard: { main: { 2024: { b64: b64([4]) }, 2025: { b64: b64([5]) }, 2027: { b64: b64([7]) } } } }
  };
  const w = world({ seed });
  assert.deepStrictEqual(Array.from(await w.ctx.grpLoadTemplate('techguard', 'main', '2026')), [5]);
  assert.deepStrictEqual(Array.from(await w.ctx.grpLoadTemplate('techguard', 'main', '2027')), [7]);
  assert.strictEqual(await w.ctx.grpLoadTemplate('techguard', 'main', '2023'), null);
  assert.strictEqual(await w.ctx.grpLoadTemplate('cci-north', 'main', '2026'), null);
});

test('스크립트 줄 — hwpx-fill → gov-report → build → pack 차례, fund 와 같은 hwpx-fill 판', () => {
  const order = ['js/pu-hwpx-fill.js', 'js/pu-gov-report.js', 'js/pu-gov-report-build.js', 'js/pu-gov-report-pack.js'];
  const pos = order.map((f) => HTML.indexOf('<script src="' + f + '?v='));
  pos.forEach((p, i) => assert.ok(p >= 0, order[i] + ' 줄이 없다'));
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i - 1] < pos[i], order[i] + ' 차례가 틀렸다');
  const FUND = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
  const v = (s) => (s.match(/js\/pu-hwpx-fill\.js\?v=(\d+)/) || [])[1];
  assert.strictEqual(v(HTML), v(FUND));
});

test('「크게 보기」 머리에 관리자용 「⚙ 양식 서고」 단추가 있고, 서고 창(.mb)이 있다', () => {
  const zoom = HTML.slice(HTML.indexOf('id="mbTlZoom"'), HTML.indexOf('id="tzSum"'));
  assert.match(zoom, /id="tzFormsBtn"[^>]*onclick="grpOpenForms\(\)"/);
  assert.match(zoom, /⚙ 양식 서고/);
  assert.match(HTML, /<div class="mb" id="mbRptForms">/);
  assert.match(grab('openTlZoom'), /tzFormsBtn[\s\S]*isAdmin\(\)/, '관리자에게만 보여야 한다');
});

test('서고 자리는 FB_NODES·BK_KEYS 에 넣지 않는다', () => {
  const m = SRC.match(/FB_NODES\s*=\s*\{[\s\S]*?\};/);
  if (m) assert.ok(!/scal_rptForms/.test(m[0]));
  const b = SRC.match(/BK_KEYS\s*=\s*\[[\s\S]*?\];/);
  if (b) assert.ok(!/rptForms/.test(b[0]));
});

/* ══ 「📄 보고서 작성」 창 (A안, Task 5) ══════════════════════════════════════
 * ★ 지키는 것
 *   ① 모으기는 그 사업장·그 사업 일정만, 사전진단은 뺀다. 메일·보낸 서류는 사업자번호 열쇠로만 찾는다.
 *   ② [+ 회차 추가] 는 정부사업일정(scal_scheds)에 쓰지 않는다 — fbPush·lsSet·DB 쓰기 0.
 *   ③ [확정] 은 그 사업장 담당·부담당 또는 관리자만.
 *   ④ 임시 저장은 scal_reports/{coId}/{typeId}_{연도} 에 정해진 꼴로.
 *   ⑤ 확정 뒤 임시 저장은 확정본을 덮지 않는다 — [새 판으로 고치기] 뒤에만, 확정본 사본은 남는다.
 *   ⑥ 단추가 부르는 grp* 함수가 모두 이 파일에 있다.
 * 합성 자료만 쓴다(가나상사·홍길동, 검산만 맞춘 가짜 사업자번호). */
const Build = require('../js/pu-gov-report-build.js');
const CoKey = require('../js/pu-cokey.js');

const RPT_NAMES = ['grpRptRef', 'grpRid', 'grpYearOf', 'grpDay', 'grpShift', 'grpConsCompany', 'grpPickCons',
  'grpReadMail', 'grpReadSent', 'grpReadSaved', 'grpStaffName', 'grpCollect', 'grpHintInput', 'grpSetup',
  'grpReadForm', 'grpCanConfirm', 'grpWho', 'grpCleanReport', 'grpRecord', 'grpWriteFail', 'grpNote',
  'grpSaveDraft', 'grpConfirm', 'grpNewVersion', 'grpAddRound', 'grpDelRound', 'grpAsk', 'grpFieldsFor',
  'grpBlankList', 'grpGet', 'grpSetPath', 'grpParseRoundText', 'grpRoundText', 'grpFileName',
  'grpAiSync', 'grpAiFields', 'grpAiDropRound'];

const BIZ = '123-45-67891';   // 검산만 맞춘 가짜 번호
function rptWorld(opts) {
  const o = opts || {};
  const db = FakeDb.만들기(o.seed || {});
  if (o.denyWrites) {
    const ref0 = db.ref;
    db.ref = (p) => {
      const r = ref0(p);
      const deny = async () => { const e = new Error('PERMISSION_DENIED: Permission denied'); e.code = 'PERMISSION_DENIED'; throw e; };
      r.set = deny; r.transaction = deny;
      return r;
    };
  }
  const els = {};
  const calls = { fbPush: 0, lsSet: 0 };
  const cos = [{ id: 'c1', name: '가나상사', defAtt: 's1', defCoAtts: ['s2'], erpId: 'k1' }];
  const types = [{ id: 'bxeyzrxm', name: '인사충남', fullName: '인사노무컨설팅충남북부상의', agency: '충남북부상공회의소' },
    { id: 'tz', name: '일터혁신', fullName: '', agency: '' }];
  const scheds = [
    { id: 'a', coId: 'c1', typeId: 'bxeyzrxm', date: '2025-10-02', round: 2, isField: false, memo: '임금체계 검토' },
    { id: 'b', coId: 'c1', typeId: 'bxeyzrxm', date: '2025-09-04', round: 1, isField: true, memo: '취업규칙 개정 요청' },
    { id: 'p', coId: 'c1', typeId: 'bxeyzrxm', date: '2025-08-20', round: 0, phase: 'pre', isField: true, memo: '사전진단' },
    { id: 'x', coId: 'c1', typeId: 'tz', date: '2025-09-10', round: 1, isField: true, memo: '다른 사업' },
    { id: 'y', coId: 'c9', typeId: 'bxeyzrxm', date: '2025-09-11', round: 1, isField: true, memo: '다른 사업장' },
  ];
  const cons = o.noBiz ? { id: 'k1', companyName: '가나상사', programName: '인사노무컨설팅충남북부상의' }
    : { id: 'k1', companyName: '가나상사', programName: '인사노무컨설팅충남북부상의', bizNo: BIZ, ceo: '김가나',
      address: '충남 천안시 가나로 1', bizType: '제조업',
      contacts: [{ name: '홍길동', role: '총무팀/대리', phone: '041-000-0000', isPrimary: true }] };
  const me = o.me || 's1';
  const ctx = {
    console, Promise, Uint8Array, Date, String, Object, Array, JSON, Math, RegExp, Error, Number, isNaN, parseInt,
    FB_READY: true, _fbDB: db,
    getCos: () => cos, getTypes: () => types, getScheds: () => scheds,
    getStaff: () => [{ id: 's1', name: '이푸른' }, { id: 's2', name: '박부담' }, { id: 's9', name: '남노무' }],
    myId: () => me, isAdmin: () => !!o.admin,
    getSession: () => ({ id: me, name: me === 's1' ? '이푸른' : '남노무', isAdmin: !!o.admin }),
    erpConsByCo: () => ({ c1: [cons] }), getErpTypeMap: () => ({}), erpConsCode: () => '',
    fbPush: () => { calls.fbPush++; }, lsSet: () => { calls.lsSet++; },
    toast: (m, k) => { ctx.__toasts.push({ m: String(m), k: k || '' }); }, __toasts: [],
    escAttr: (v) => String(v == null ? '' : v),
    todayStr: () => '2025-11-20', p2: (n) => String(n).padStart(2, '0'),
    q: (s) => (els[s] = els[s] || fakeEl()), qa: () => [],
    confirm: () => true,
    PuGovReportBuild: Build, PuCoKey: CoKey, PuGovReport: { FORMS: Rpt.FORMS },
    grpRender: () => {}, grpRenderTop: () => {}, grpRenderWarn: () => {},
  };
  vm.createContext(ctx);
  const consts = (SRC.match(/^const GRP_(?:DENIED|HINT|RLAB|FILE_KO|AI_MODELS|AI_WAIT_MS|AI_OK|AI_MSG|AI_PATH)=.*;$/gm) || []).join('\n');
  vm.runInContext('var _grp=null;\n' + consts + '\n' + grab('getCoAtts') + '\n' + RPT_NAMES.map(grab).join('\n'), ctx);
  return { ctx, db, els, calls };
}
const mailSeed = () => ({
  pucards: {
    coMail: { 1234567891: { rows: [
      { d: '2025-09-02', at: 1, io: 'in', s: '취업규칙 검토 요청', w: '홍길동' },
      { d: '2023-01-05', at: 2, io: 'in', s: '아주 옛 메일', w: '홍길동' }] } },
    sentDocs: { 1234567891: {
      n1: { at: Date.UTC(2025, 9, 2, 3), kind: '1:1', names: ['임금체계 검토 의견서.hwp'] },
      n2: { at: Date.UTC(2025, 9, 5, 3), day: '2025-10-05', kind: 'batch', name: '취업규칙 개정안.hwp' } } },
  },
});

test('보고서 ① grpCollect — 그 사업장·그 사업 일정만, 사전진단 뺌, 메일·보낸 서류는 사업자번호 열쇠로', async () => {
  const w = rptWorld({ seed: mailSeed() });
  const input = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  assert.deepStrictEqual(Array.from(input.scheds, (s) => s.id).sort(), ['a', 'b']);
  assert.strictEqual(input.co.id, 'c1');
  assert.deepStrictEqual(Array.from(input.co.defCoAtts), ['s2']);
  assert.strictEqual(input.type.name, '인사충남');
  assert.strictEqual(input.cons.company.bizNo, BIZ);
  assert.strictEqual(input.cons.company.contacts[0].name, '홍길동');
  assert.strictEqual(input.staffName, '이푸른');
  assert.strictEqual(input.today, '2025-11-20');
  assert.strictEqual(input.rid, 'bxeyzrxm_2025');
  assert.deepStrictEqual(Array.from(input.mail, (m) => m.s), ['취업규칙 검토 요청'], '사업 기간 밖 옛 메일은 뺀다');
  assert.deepStrictEqual(Array.from(input.mail[0].att), []);
  assert.deepStrictEqual(Array.from(input.sent, (x) => x.name).sort(), ['임금체계 검토 의견서.hwp', '취업규칙 개정안.hwp']);
  assert.strictEqual(input.saved, null);
  assert.strictEqual(w.db.쓴것.length, 0, '모으기는 읽기만 한다');
});

test('보고서 ①-2 사업자번호가 없으면 메일·서류는 비우고 그렇다고 적는다', async () => {
  const w = rptWorld({ seed: mailSeed(), noBiz: true });
  const input = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  assert.strictEqual(input.mail.length, 0);
  assert.strictEqual(input.sent.length, 0);
  assert.ok(input.notes.some((n) => /사업자번호가 없어 메일을 못 찾았습니다/.test(n)));
});

async function opened(w) {
  const input = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  w.ctx.grpSetup(input, 'cci-north');
  return w.ctx._grp;
}

test('보고서 ② [+ 회차 추가] 는 정부사업일정에 쓰지 않는다', async () => {
  const w = rptWorld({ seed: mailSeed() });
  const st = await opened(w);
  const n0 = st.report.rounds.length;
  w.ctx.grpAddRound();
  assert.strictEqual(st.report.rounds.length, n0 + 1);
  assert.strictEqual(st.meta[n0].added, true, '「보고서에서 추가」 딱지');
  assert.strictEqual(w.calls.fbPush, 0);
  assert.strictEqual(w.calls.lsSet, 0);
  assert.strictEqual(w.db.쓴것.length, 0);
  w.ctx.grpDelRound(0);
  assert.strictEqual(st.report.rounds.length, n0 + 1, '일정에서 온 회차는 지우지 않는다');
  w.ctx.grpDelRound(n0);
  assert.strictEqual(st.report.rounds.length, n0);
});

test('보고서 ③ 확정은 담당·부담당·관리자만 — 아니면 거절하고 쓰지 않는다', async () => {
  const w = rptWorld({ seed: mailSeed(), me: 's9' });
  await opened(w);
  const r = await w.ctx.grpConfirm();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.db.쓴것.length, 0);
  assert.ok(w.ctx.__toasts.some((t) => /담당/.test(t.m)));
  for (const who of [{ me: 's1' }, { me: 's2' }, { me: 's9', admin: true }]) {
    const a = rptWorld(Object.assign({ seed: mailSeed() }, who));
    await opened(a);
    const ok = await a.ctx.grpConfirm();
    assert.strictEqual(ok.ok, true, JSON.stringify(who));
    const rec = a.db.읽기('scal_reports/c1/bxeyzrxm_2025');
    assert.strictEqual(rec.state, '검토완료');
    assert.strictEqual(rec.ver, 1);
    assert.ok(rec.confirmedBy && rec.confirmedAt);
  }
});

test('보고서 ④ 임시 저장 — scal_reports/{coId}/{typeId}_{연도} 에 정해진 꼴로', async () => {
  const w = rptWorld({ seed: mailSeed() });
  await opened(w);
  const r = await w.ctx.grpSaveDraft();
  assert.strictEqual(r.ok, true);
  const writes = w.db.쓴것.filter((x) => !x.update);
  assert.deepStrictEqual(writes.map((x) => x.자리), ['scal_reports/c1/bxeyzrxm_2025']);
  const v = writes[0].값;
  assert.strictEqual(v.formKey, 'cci-north');
  assert.strictEqual(v.typeId, 'bxeyzrxm');
  assert.strictEqual(v.state, '초안');
  assert.strictEqual(v.report.company.name, '가나상사');
  assert.strictEqual(v.report.rounds.length, 2);
  assert.strictEqual(v.rounds.length, 2);
  assert.ok(typeof v.updatedAt === 'number' && v.updatedBy);
  /* 다시 열면 저장한 것이 이긴다 */
  const again = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  assert.strictEqual(again.saved.state, '초안');
});

test('보고서 ⑤ 확정 뒤 임시 저장은 확정본을 덮지 않는다 — 새 판으로만, 확정본 사본은 남는다', async () => {
  const w = rptWorld({ seed: mailSeed() });
  const st = await opened(w);
  assert.strictEqual((await w.ctx.grpConfirm()).ok, true);
  const n = w.db.쓴것.length;
  const r = await w.ctx.grpSaveDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.db.쓴것.length, n, '확정본 위에 썼다');
  assert.strictEqual(w.db.읽기('scal_reports/c1/bxeyzrxm_2025').state, '검토완료');
  w.ctx.grpNewVersion();
  assert.strictEqual(st.locked, false);
  st.report.summary.etc = '새 판 고침';
  assert.strictEqual((await w.ctx.grpSaveDraft()).ok, true);
  assert.strictEqual(w.db.읽기('scal_reports/c1/bxeyzrxm_2025').state, '초안');
  const kept = w.db.읽기('scal_reports/c1/bxeyzrxm_2025_v1');
  assert.strictEqual(kept.state, '검토완료', '확정본 사본이 남아야 한다');
  assert.strictEqual(kept.ver, 1);
  assert.strictEqual((await w.ctx.grpConfirm()).ok, true);
  assert.strictEqual(w.db.읽기('scal_reports/c1/bxeyzrxm_2025').ver, 2);
  assert.strictEqual(w.db.읽기('scal_reports/c1/bxeyzrxm_2025_v1').ver, 1);
});

test('보고서 ⑤-2 규칙 미게시로 쓰기가 막히면 알리고 화면 값은 그대로 둔다', async () => {
  const w = rptWorld({ seed: mailSeed(), denyWrites: true });
  const st = await opened(w);
  st.report.company.workers = '12';
  const r = await w.ctx.grpSaveDraft();
  assert.strictEqual(r.ok, false);
  assert.ok(w.ctx.__toasts.some((t) => /아직 저장 자리가 열리지 않았습니다\(관리자 규칙 게시 필요\) — 내려받기는 됩니다/.test(t.m)));
  assert.strictEqual(st.report.company.workers, '12');
  assert.strictEqual(st.locked, false);
});

test('보고서 — 회차 글 한 칸은 문의·진단·자문·성과·향후로 나뉘어 들어가고 되돌아온다', () => {
  const w = rptWorld();
  const r = {};
  w.ctx.grpParseRoundText('문의: 취업규칙\r\n진단: 연장근로 미비\n둘째 줄\n자문: 개정안', r);
  assert.strictEqual(r.inquiry, '취업규칙');
  assert.strictEqual(r.diagnosis, '연장근로 미비\n둘째 줄');
  assert.strictEqual(r.advice, '개정안');
  assert.strictEqual(r.result, '');
  assert.strictEqual(w.ctx.grpRoundText(r), '문의: 취업규칙\n진단: 연장근로 미비\n둘째 줄\n자문: 개정안');
  const plain = {};
  w.ctx.grpParseRoundText('이름표 없는 글', plain);
  assert.strictEqual(plain.advice, '이름표 없는 글');
});

test('보고서 — 내려받을 파일 이름은 「기관」_「양식」_「사업장」_초안|확정.hwpx, 윈도 금지 글자는 바꾼다', () => {
  const w = rptWorld();
  assert.strictEqual(w.ctx.grpFileName('서산상공회의소', '결과보고서', '가나/상사:1', '초안'), '서산상공회의소_결과보고서_가나_상사_1_초안.hwpx');
  assert.strictEqual(w.ctx.grpFileName('a', 'b', 'c', '검토완료'), 'a_b_c_확정.hwpx');
});

test('보고서 ⑥ 단추가 부르는 grp* 함수가 모두 이 파일에 있다', () => {
  const names = new Set();
  for (const m of HTML.matchAll(/on(?:click|change|input)="(grp\w+)\(/g)) names.add(m[1]);
  const acts = SRC.match(/const GRP_ACTS=\{[^}]*\}/);
  assert.ok(acts, 'GRP_ACTS(위임 단추 표)가 없다');
  for (const m of acts[0].matchAll(/:\s*'?(grp\w+)/g)) names.add(m[1]);
  /* 그리는 쪽이 쓰는 data-grp-act 값이 모두 표에 있다 */
  const used = new Set();
  for (const m of SRC.matchAll(/data-grp-act="(\w+)"/g)) used.add(m[1]);
  assert.ok(used.size >= 5, 'data-grp-act 단추가 너무 적다');
  used.forEach((a) => assert.ok(new RegExp('[{,]\\s*' + a + '\\s*:').test(acts[0]), a + ' 이(가) GRP_ACTS 에 없다'));
  assert.ok(names.size >= 5);
  names.forEach((n) => assert.ok(new RegExp('function ' + n + '\\(').test(SRC), n + ' 함수가 없다'));
});

test('보고서 — 「크게 보기」 날짜 복사 옆에 [📄 보고서 작성], 양식을 못 고르는 사업이면 숨긴다', () => {
  const r = grab('renderTlZoom');
  assert.match(r, /id="tzCopyBtn"[\s\S]*?id="tzRptBtn"/);
  assert.match(r, /📄 보고서 작성/);
  assert.match(r, /tzRptBtn[\s\S]*grpOpenReport/);
  assert.match(r, /tzRptBtn[\s\S]*resolveFormKey/);
  assert.ok(/<div class="mb" id="mbGovRpt">/.test(HTML), 'mbGovRpt 창이 없다');
  assert.ok(HTML.indexOf('id="mbGovRpt"') > HTML.indexOf('id="mbTlZoom"'), '크게 보기보다 뒤(위)에 둔다');
  assert.ok(/<script src="js\/pu-cokey\.js\?v=\d+"><\/script>/.test(HTML), 'pu-cokey 줄이 없다');
});

test('보고서 — 모바일 폭(≤860px)에서는 출처가 아래로 내려간다', () => {
  assert.ok(/@media\s*\(max-width:\s*860px\)\s*\{[^}]*\.grp-lay\{[^}]*grid-template-columns:\s*1fr/.test(SRC), '좁은 폭 규칙이 없다');
});

test('보고서 ⑤-3 남이 먼저 확정했으면 내 확정은 거절하고 덮지 않는다', async () => {
  const w = rptWorld({ seed: mailSeed() });
  const st = await opened(w);                       // 내가 연 판: ver 0, 초안
  const theirs = { formKey: 'cci-north', typeId: 'bxeyzrxm', state: '검토완료', ver: 1, confirmedBy: '박부담',
    report: { company: { name: '가나상사(남의 확정본)' } } };
  await w.db.ref('scal_reports/c1/bxeyzrxm_2025').set(theirs);
  await w.db.ref('scal_reports/c1/bxeyzrxm_2025_v1').set(theirs);
  const r = await w.ctx.grpConfirm();
  assert.strictEqual(r.ok, false);
  assert.match(r.error, /다른 사람이/);
  assert.strictEqual(w.db.읽기('scal_reports/c1/bxeyzrxm_2025').confirmedBy, '박부담');
  assert.strictEqual(w.db.읽기('scal_reports/c1/bxeyzrxm_2025_v1').report.company.name, '가나상사(남의 확정본)');
  assert.strictEqual(st.locked, false);
});

test('보고서 ⑤-4 같은 판 번호의 확정본 사본이 이미 있으면(남이 새 판을 연 뒤) 덮지 않는다', async () => {
  const w = rptWorld({ seed: mailSeed() });
  await opened(w);                                  // ver 0 으로 열었다
  const kept = { state: '검토완료', ver: 1, confirmedBy: '박부담', report: { company: { name: '첫 확정본' } } };
  await w.db.ref('scal_reports/c1/bxeyzrxm_2025_v1').set(kept);
  await w.db.ref('scal_reports/c1/bxeyzrxm_2025').set({ state: '초안', ver: 1, report: { company: { name: '남의 새 판' } } });
  const r = await w.ctx.grpConfirm();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.db.읽기('scal_reports/c1/bxeyzrxm_2025_v1').report.company.name, '첫 확정본');
  assert.strictEqual(w.db.읽기('scal_reports/c1/bxeyzrxm_2025').state, '초안', '본 자리도 건드리지 않는다');
});

test('보고서 ⑤-5 내가 연 뒤 남이 확정했으면 임시 저장은 중단하고 본기록을 되돌리지 않는다(ver 유지)', async () => {
  const w = rptWorld({ seed: mailSeed() });
  await opened(w);                                   // ver 0 으로 열었다
  const done = { state: '검토완료', ver: 1, confirmedBy: '박부담', report: { company: { name: '남의 확정본' } } };
  await w.db.ref('scal_reports/c1/bxeyzrxm_2025').set(done);
  const r = await w.ctx.grpSaveDraft();
  assert.strictEqual(r.ok, false);
  const main = w.db.읽기('scal_reports/c1/bxeyzrxm_2025');
  assert.strictEqual(main.state, '검토완료', '확정 상태가 초안으로 되돌아가지 않는다');
  assert.strictEqual(main.ver, 1);
});

test('보고서 ⑤-6 확정은 본기록 ver 를 낮추지 않는다(큰 쪽 유지)', async () => {
  const w = rptWorld({ seed: mailSeed() });
  await opened(w);
  await w.db.ref('scal_reports/c1/bxeyzrxm_2025').set({ state: '초안', ver: 3, report: { company: { name: '남의 초안' } } });
  const r = await w.ctx.grpConfirm();
  assert.strictEqual(r.ok, true);
  assert.strictEqual(w.db.읽기('scal_reports/c1/bxeyzrxm_2025').ver, 3);
  assert.strictEqual(w.db.읽기('scal_reports/c1/bxeyzrxm_2025').state, '검토완료');
  assert.ok(w.db.읽기('scal_reports/c1/bxeyzrxm_2025_v1'));
});

test('보고서 ①-3 열쇠는 있는데 클라우드 연결 전이면 조용히 비우지 않고 그렇다고 적는다', async () => {
  const w = rptWorld({ seed: mailSeed() });
  w.ctx.FB_READY = false;
  const input = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  assert.strictEqual(input.mail.length, 0);
  assert.ok(input.notes.some((n) => /클라우드 연결 전/.test(n)));
});

/* ══ ✨ AI 초안 (3단계) ══════════════════════════════════════════════════════
 * ★ 지키는 것
 *   ① 밖으로 나가는 글(프록시로 가는 body 전부)에 업체·사람 이름·전화·메일·사업자번호가 없다.
 *   ② 사람이 쓴 칸은 덮지 않는다 — 처음부터 쓴 칸도, AI 칸을 사람이 고친 것도.
 *   ③ 기술보호는 켜기 전엔 아무것도 안 보내고, 켜도 메일·보낸 서류는 안 보낸다.
 *   ④ 확정된 판은 부르지 않는다.
 *   ⑤ 오류 문구는 설계서 §5 그대로, 칸은 그대로.
 * 가짜 프록시(fetch 바꿔치기) — 실제로 밖에 나가지 않는다. 합성 자료만. */
const Ai = require('../js/pu-gov-report-ai.js');
const AI_NAMES = ['grpAiProxyUrl', 'grpAiConsent', 'grpAiFetch', 'grpAiCall', 'grpAiNames', 'grpAiMemos', 'grpAiCan',
  'grpAiDraft', 'grpAiUndo', 'grpAiAllow'];
const SCREEN_NAMES = ['grpRenderTop', 'grpFileLabel', 'grpFieldHtml', 'grpSrcLabel', 'grpWarnings', 'grpAiButtons', 'grpAiFoot'];
const aiBtn = (h) => (h.match(/<button[^>]*data-grp-act="ai"[^>]*>/) || [''])[0];
const aiText = (text) => ({ content: [{ type: 'text', text }] });
const aiReply = (o) => aiText(JSON.stringify(o));
const okReply = () => aiReply({
  rounds: [{ i: 0, inquiry: '[해당 기업] [담당자] 취업규칙 문의', diagnosis: '연장근로 규정 미비', advice: '덮으면 안 됨' }],
  summary: { inquiryDiag: '[해당 기업] 종합', review: '검토 초안', action: 'AI 조치', etc: '없음', overall: '양식이 안 씀' },
});
function aiWorld(opts) {
  const o = opts || {};
  const seed = mailSeed();
  seed.pucards.coMail['1234567891'].rows.push(
    { d: '2025-09-03', at: 3, io: 'in', s: '가나상사 홍길동 대리 연락처 041-000-0000 hong@example.com', w: '홍길동' });
  const w = rptWorld(Object.assign({}, o, { seed }));
  const fetched = [];
  const replies = (o.replies || [okReply()]).slice();
  const store = Object.assign({}, o.ls || { gov_ai_ok: '1' });
  Object.assign(w.ctx, {
    PuGovReportAi: Ai, setTimeout, clearTimeout,
    window: { PU_CFG: { aiProxyUrl: o.noProxy ? '' : 'https://proxy.example.com/ai' } },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    fetch: async (url, init) => {
      fetched.push({ url, body: JSON.parse(init.body) });
      const r = replies.shift();
      if (r instanceof Error) throw r;
      return { json: async () => r };
    },
  });
  vm.runInContext(AI_NAMES.map(grab).join('\n'), w.ctx);
  if (o.screen) vm.runInContext(SCREEN_NAMES.map(grab).join('\n'), w.ctx);
  return Object.assign(w, { fetched, store });
}

test('AI ① 밖으로 나가는 글 전부에 가림 — 업체·사람 이름·전화·메일·사업자번호가 안 나간다', async () => {
  const w = aiWorld();
  w.ctx.getScheds()[1].memo = '홍길동 대리 면담(010-0000-0000) — 취업규칙 개정 요청';
  const st = await opened(w);
  const r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(w.fetched.length, 1);
  assert.strictEqual(w.fetched[0].url, 'https://proxy.example.com/ai');
  const out = JSON.stringify(w.fetched[0].body);
  for (const bad of ['가나상사', '홍길동', '김가나', '041-000-0000', '010-0000-0000', 'hong@example.com', BIZ, '1234567891']) {
    assert.ok(!out.includes(bad), bad + ' 이(가) 나갔다');
  }
  assert.ok(out.includes('[가림]'), '전화·메일 자리는 [가림]');
  assert.strictEqual(w.fetched[0].body.model, 'claude-opus-5');
  assert.strictEqual(w.fetched[0].body.max_tokens, 8000);
  assert.strictEqual(st.report.rounds[0].inquiry, '가나상사 홍길동 취업규칙 문의', '받은 글에서 이름을 되돌린다');
  assert.strictEqual(st.aiSrc['rounds.0.inquiry'], 'ai');
});

test('AI ② 사람이 쓴 칸은 덮지 않는다 — 처음부터 쓴 칸도, AI 칸을 사람이 고친 것도', async () => {
  const w = aiWorld({ replies: [okReply(),
    aiReply({ rounds: [{ i: 0, diagnosis: '두 번째 진단' }], summary: { review: '두 번째 검토', etc: '두 번째 기타' } })] });
  const st = await opened(w);
  st.report.summary.action = '사람이 쓴 조치';
  const memo = st.report.rounds[0].advice;
  assert.ok(memo, '일정 메모가 자문 칸에 들어 있다(2단계)');
  assert.strictEqual((await w.ctx.grpAiDraft()).ok, true);
  assert.strictEqual(st.report.rounds[0].advice, memo, '메모에서 온 자문(사람 기록)을 덮었다');
  assert.strictEqual(st.report.summary.action, '사람이 쓴 조치');
  assert.strictEqual(st.report.summary.review, '검토 초안');
  assert.strictEqual(st.report.summary.overall, '', '충남북부 양식이 안 쓰는 칸');
  st.report.summary.review = '사람이 고친 검토';          // 화면에서 고친 것과 같다
  assert.strictEqual((await w.ctx.grpAiDraft()).ok, true);
  assert.strictEqual(st.report.summary.review, '사람이 고친 검토');
  assert.ok(!st.aiSrc['summary.review'], '사람이 고친 칸은 AI 표시가 빠진다');
  assert.strictEqual(st.report.summary.etc, '두 번째 기타', '사람이 안 고친 AI 칸은 새 초안으로');
  assert.strictEqual(st.report.rounds[0].diagnosis, '두 번째 진단');
});

test('AI ③ 기술보호 — 켜기 전엔 아무것도 안 보내고, 켜도 메일·보낸 서류는 안 보낸다', async () => {
  const w = aiWorld();
  const input = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  const st = w.ctx.grpSetup(input, 'techguard');
  assert.strictEqual(st.techguard, true);
  assert.strictEqual(st.aiAllow, false, '기본은 끔');
  const r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.fetched.length, 0);
  assert.ok(w.ctx.__toasts.some((t) => /이번 건 AI 사용/.test(t.m)));
  assert.strictEqual(w.ctx.grpAiAllow(), true);
  assert.strictEqual(st.aiAllow, true);
  assert.strictEqual((await w.ctx.grpAiDraft()).ok, true);
  const sent = JSON.stringify(w.fetched[0].body);
  for (const bad of ['취업규칙 검토 요청', '임금체계 검토 의견서', '취업규칙 개정안', '연락처']) {
    assert.ok(!sent.includes(bad), bad + ' 이(가) 나갔다');
  }
  assert.ok(sent.includes('2025-09-04') && sent.includes('취업규칙 개정 요청'), '회차 날짜·메모는 보낸다');
});

test('AI ④ 확정된 판은 부르지 않는다', async () => {
  const w = aiWorld();
  await opened(w);
  assert.strictEqual((await w.ctx.grpConfirm()).ok, true);
  const r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.fetched.length, 0);
  assert.strictEqual(w.ctx.grpAiCan(w.ctx._grp).ok, false);
});

test('AI ⑤ 오류 — 프록시 없음·동의 안 함·응답 없음·JSON 못 읽음(한 번 더 물은 뒤), 칸은 그대로', async () => {
  let w = aiWorld({ noProxy: true });
  await opened(w);
  let r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.fetched.length, 0);
  assert.ok(w.ctx.__toasts.some((t) => t.m === 'AI 프록시가 설정되지 않았습니다 — 포털 ⚙ 설정'));

  w = aiWorld({ ls: {} });
  w.ctx.confirm = () => false;
  await opened(w);
  r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.fetched.length, 0, '동의 안 하면 보내지 않는다');
  assert.ok(!('gov_ai_ok' in w.store));

  w = aiWorld({ ls: {} });
  await opened(w);
  assert.strictEqual((await w.ctx.grpAiDraft()).ok, true);
  assert.strictEqual(w.store.gov_ai_ok, '1', '동의는 브라우저에 기억한다');

  w = aiWorld({ replies: [new TypeError('Failed to fetch'), new TypeError('Failed to fetch')] });
  let st = await opened(w);
  let before = JSON.stringify(st.report);
  r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.ok(w.ctx.__toasts.some((t) => t.m === 'AI 응답이 없습니다 — 잠시 뒤 다시'));
  assert.strictEqual(JSON.stringify(st.report), before, '칸은 그대로');

  w = aiWorld({ replies: [aiText('죄송합니다'), aiText('여전히 JSON 아님')] });
  st = await opened(w);
  before = JSON.stringify(st.report);
  r = await w.ctx.grpAiDraft();
  assert.strictEqual(r.ok, false);
  assert.strictEqual(w.fetched.length, 2, '못 읽으면 한 번 더 묻는다');
  assert.ok(w.ctx.__toasts.some((t) => t.m === 'AI 답을 읽지 못했습니다'));
  assert.strictEqual(JSON.stringify(st.report), before);

  w = aiWorld({ replies: [aiText('잠시만요'), okReply()] });
  await opened(w);
  assert.strictEqual((await w.ctx.grpAiDraft()).ok, true, '두 번째 답을 읽으면 된다');
  assert.strictEqual(w.fetched.length, 2);
});

test('AI ⑥ 임시 저장에 AI 칸 목록(aiFields)을 남기고, 다시 열면 「AI 초안」으로 이어 받는다', async () => {
  const w = aiWorld();
  await opened(w);
  await w.ctx.grpAiDraft();
  assert.strictEqual((await w.ctx.grpSaveDraft()).ok, true);
  const rec = w.db.읽기('scal_reports/c1/bxeyzrxm_2025');
  assert.ok(Array.from(rec.aiFields).includes('summary.review'));
  assert.ok(Array.from(rec.aiFields).every((p) => !/\.\./.test(p)));
  const again = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  const st2 = w.ctx.grpSetup(again, 'cci-north');
  assert.strictEqual(st2.aiSrc['summary.review'], 'ai');
  assert.strictEqual(st2.aiVal['summary.review'], '검토 초안');
  assert.strictEqual(st2.aiUndo, null, '되돌리기는 창 안에서만');
});

test('AI ⑦ 되돌리기 — 직전 AI 넣기만 되돌리고, 그 뒤 사람이 고친 칸은 그대로', async () => {
  const w = aiWorld();
  const st = await opened(w);
  await w.ctx.grpAiDraft();
  st.report.summary.etc = '사람이 고친 기타';
  const u = w.ctx.grpAiUndo();
  assert.strictEqual(u.ok, true);
  assert.strictEqual(st.report.summary.review, '');
  assert.strictEqual(st.report.rounds[0].inquiry, '');
  assert.strictEqual(st.report.summary.etc, '사람이 고친 기타');
  assert.strictEqual(st.aiUndo, null);
  assert.ok(!st.aiSrc['summary.review']);
});

test('AI ⑦-2 보고서에서 더한 회차를 빼면 AI 칸 표시도 한 칸씩 당겨진다', async () => {
  const w = aiWorld();
  const st = await opened(w);
  w.ctx.grpAddRound(); w.ctx.grpAddRound();             // 2회·3회(0부터 2·3) 추가
  st.aiSrc = { 'rounds.2.inquiry': 'ai', 'rounds.3.inquiry': 'ai', 'summary.etc': 'ai' };
  st.aiVal = { 'rounds.2.inquiry': 'a', 'rounds.3.inquiry': 'b', 'summary.etc': 'c' };
  w.ctx.grpDelRound(2);
  assert.deepStrictEqual(Object.keys(st.aiSrc).sort(), ['rounds.2.inquiry', 'summary.etc']);
  assert.strictEqual(st.aiVal['rounds.2.inquiry'], 'b');
});

test('AI — 스크립트 줄: pu-gov-report-ai.js 는 pu-gov-report.js 뒤에', () => {
  const g = HTML.indexOf('<script src="js/pu-gov-report.js?v=');
  const a = HTML.indexOf('<script src="js/pu-gov-report-ai.js?v=');
  assert.ok(g >= 0 && a > g, 'pu-gov-report-ai.js 줄이 없거나 차례가 틀렸다');
});

test('AI ⑧ 화면 — ✨ 단추·되돌리기 단추·「AI 초안」 딱지와 경고, 사람이 고치면 딱지가 빠진다, 확정하면 잠긴다', async () => {
  const w = aiWorld({ screen: true });
  const st = await opened(w);
  w.ctx.grpRenderTop();
  let top = w.els['#grpTop'].innerHTML;
  assert.ok(aiBtn(top) && !/disabled/.test(aiBtn(top)), '열린 초안에서는 눌린다');
  assert.ok(!/data-grp-act="aiAllow"/.test(top), '기술보호가 아니면 켜기 단추가 없다');
  assert.ok(!/data-grp-act="aiUndo"/.test(top));
  assert.ok(!/3단계에서 붙습니다/.test(top), '자리만 잡던 단추가 남았다');
  await w.ctx.grpAiDraft();
  w.ctx.grpRenderTop();
  top = w.els['#grpTop'].innerHTML;
  assert.match(top, /data-grp-act="aiUndo"/);
  const f = w.ctx.grpFieldsFor('cci-north').find((x) => x.path === 'summary.review');
  assert.match(w.ctx.grpFieldHtml(st, f), /data-grp-ai="summary\.review"><span class="grp-tag ai">AI 초안/);
  st.aiWarn['summary.review'] = ['확인 필요 — 입력에 없던 날짜·숫자: 2026'];
  assert.match(w.ctx.grpFieldHtml(st, f), /확인 필요 — 입력에 없던 날짜·숫자: 2026/);
  assert.ok(w.ctx.grpWarnings(st).some((x) => /✨ AI 초안 \d+칸/.test(x.t)));
  st.report.summary.review = '사람이 고침';
  w.ctx.grpAiSync(st);
  assert.ok(!/AI 초안/.test(w.ctx.grpFieldHtml(st, f)), '사람이 고치면 딱지가 없어진다');
  assert.strictEqual((await w.ctx.grpConfirm()).ok, true);
  w.ctx.grpRenderTop();
  top = w.els['#grpTop'].innerHTML;
  assert.match(aiBtn(top), /disabled/, '확정된 판은 잠긴다');
  assert.ok(!/data-grp-act="aiUndo"/.test(top));
});

test('AI ⑨ 화면 — 기술보호는 켜기 전 ✨ 가 잠기고 「이번 건 AI 사용」 단추가 있다', async () => {
  const w = aiWorld({ screen: true });
  const input = await w.ctx.grpCollect('c1', 'bxeyzrxm');
  const st = w.ctx.grpSetup(input, 'techguard');
  w.ctx.grpRenderTop();
  let top = w.els['#grpTop'].innerHTML;
  assert.match(aiBtn(top), /disabled/);
  assert.match(top, /data-grp-act="aiAllow"[^>]*>☐ 이번 건 AI 사용/);
  w.ctx.grpAiAllow();                                   // 다시 그린다
  top = w.els['#grpTop'].innerHTML;
  assert.ok(!/disabled/.test(aiBtn(top)));
  assert.match(top, /☑ 이번 건 AI 사용/);
  assert.ok(w.ctx.grpWarnings(st).some((x) => /이번 건 AI 사용 켬/.test(x.t)));
});

test('AI ⑩ 화면 — 칸을 고치면(change) AI 표시를 맞추고 그 딱지만 다시 그린다', () => {
  const b = grab('grpBind');
  assert.match(b, /grpReadForm\(\);[\s\S]*grpAiSync\(_grp\)[\s\S]*data-grp-ai/);
  assert.match(SRC, /\.grp-tag\.ai\{/);
});