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
