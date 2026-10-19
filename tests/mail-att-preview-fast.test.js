/* ⚡ 첨부 미리보기를 빨리 (대표 지시 2026-10-19 「미리보기 화면이 너무 늦게 읽힌다」)
   ═══════════════════════════════════════════════════════════════════════════
   재 보니 늦은 곳은 둘이었다.
   ① 서버 — 첨부는 메일 열기와 «다른 함수=다른 그릇»이라 따뜻하게 두기가 안 닿아, 매번 새로 붙었다
      (readMailAttachment MB_TIME connect 428~542ms · reused:false · 전체 약 2초).
   ② 화면 — 파일을 다 받은 «뒤에야» 판독기(pako → hwp_extract → 옛 한글이면 xlsx 900KB)를 차례로 불렀다.
   그래서 서버도 따뜻하게 두고, 받기와 판독기 싣기를 나란히 하고, 단추에 «올려놓는» 순간부터 미리 받는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { sliceFn } = require('./fnslice');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const fnSrc = (n) => sliceFn(HTML, 'function ' + n + '(');

/* ── 화면 쪽: 실제 함수를 떠 와서 가짜 서버로 돌린다 ── */
function make(o) {
  const opt = o || {};
  const calls = { fetch: 0, scripts: [], bodies: [] };
  const b64 = (n) => Buffer.alloc(n, 7).toString('base64');
  const box = {
    console, Promise, Object, Array, Number, String, Math, JSON, Uint8Array, setTimeout, clearTimeout,
    MB_FN: 'https://fn/', MB_OLD_ID: '*old',
    state: { mbOpen: opt.open || { slug: 'INBOX-a', uid: '77', atts: [
      { name: '공고.hwp', mime: '', size: 250000 },
      { name: '큰파일.pdf', mime: 'application/pdf', size: 9 * 1024 * 1024 },
      { name: '압축.zip', mime: 'application/zip', size: 1000 },
    ] } },
    firebase: { auth: () => ({ currentUser: { getIdToken: async () => 'tok' } }) },
    fetch: async (url, init) => {
      calls.fetch++; calls.bodies.push(JSON.parse(init.body));
      const idx = JSON.parse(init.body).index;
      return { json: async () => ({ ok: true, name: 'x', mime: '', b64: b64(opt.size || 100 + idx) }) };
    },
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    mbAttReq: (oo, i) => ({ fn: 'readMailAttachment', body: { slug: oo.slug, uid: oo.uid, index: i } }),
    mbPvExt: (n) => (String(n).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '',
    mbPvKind: (n, m) => (/\.hwp$/i.test(n) ? 'doc' : /pdf/i.test(n + m) ? 'pdf' : ''),
    window: {}, document: {
      head: { appendChild: (s) => { calls.scripts.push(s.src); } },
      createElement: () => ({}),
    },
  };
  vm.createContext(box);
  vm.runInContext(
    ['const MB_ATT_KEEP = 4;', 'const MB_ATT_KEEP_MAX = 8 * 1024 * 1024;', 'const MB_ATT_HOVER_MAX = 3 * 1024 * 1024;', 'const MB_ATT_HOVER_MS = 150;',
     'let _mbAttBuf = {}, _mbAttOrder = [], _mbAttWait = {}, _mbAttHoverT = 0;', 'const _mbPvLibWait = {};',
     fnSrc('mbAttKey'), fnSrc('mbPvLib'), fnSrc('mbPvLibsFor'), fnSrc('mbAttBytes'), fnSrc('mbAttPeekHover'), fnSrc('mbAttPeekHoverCancel'),
     ';this.mbAttBytes = mbAttBytes; this.mbAttPeekHover = mbAttPeekHover; this.mbAttPeekHoverCancel = mbAttPeekHoverCancel;',
     'this.mbPvLib = mbPvLib; this.mbPvLibsFor = mbPvLibsFor; this.__cached = () => Object.keys(_mbAttBuf).length;'].join('\n'), box);
  box.__calls = calls;
  return box;
}
const att = (b, i) => b.state.mbOpen.atts[i];

test('★★ 같은 첨부를 두 번 눌러도(또는 올려놓고 누르면) 서버는 «한 번»만 부른다', async () => {
  const b = make();
  const o = b.state.mbOpen;
  const [x, y] = await Promise.all([b.mbAttBytes(o, 0, att(b, 0)), b.mbAttBytes(o, 0, att(b, 0))]);
  assert.equal(b.__calls.fetch, 1, '받는 중인데 또 불렀다');
  await b.mbAttBytes(o, 0, att(b, 0));
  assert.equal(b.__calls.fetch, 1, '받아 둔 것이 있는데 또 불렀다');
  assert.equal(x.length, y.length);
});

test('★★ 받아 둔 것은 네 개까지만 — 메모리를 먹지 않는다', async () => {
  const b = make();
  const o = b.state.mbOpen;
  for (let i = 0; i < 6; i++) await b.mbAttBytes(Object.assign({}, o, { uid: String(i) }), 0, att(b, 0));
  assert.equal(b.__cached(), 4);
});

test('★ 8MB 넘는 것은 담아 두지 않는다', async () => {
  const b = make({ size: 9 * 1024 * 1024 });
  await b.mbAttBytes(b.state.mbOpen, 0, att(b, 0));
  assert.equal(b.__cached(), 0);
});

test('★★ 올려놓고 150ms 머물러야 미리 받는다 — 스쳐 지나가면 안 받는다', async () => {
  const b = make();
  b.mbAttPeekHover(0); b.mbAttPeekHoverCancel();
  await new Promise((r) => setTimeout(r, 220));
  assert.equal(b.__calls.fetch, 0, '스치기만 했는데 받았다');
  b.mbAttPeekHover(0);
  await new Promise((r) => setTimeout(r, 260));
  assert.equal(b.__calls.fetch, 1, '머물렀는데 미리 안 받았다');
});

test('★★ 미리 받지 않는 것 — 3MB 넘는 것 · 미리보기 없는 종류 · 지난 메일(POP3)', async () => {
  const b = make();
  /* ⚠ 한 번에 하나씩 — 올려놓기는 앞의 것을 취소하고 새로 시작하므로 둘을 잇달아 부르면 첫째가 사라진다 */
  b.mbAttPeekHover(1);                                            // 9MB pdf
  await new Promise((r) => setTimeout(r, 260));
  assert.equal(b.__calls.fetch, 0, '3MB 넘는 것을 미리 받았다');
  b.mbAttPeekHover(2);                                            // zip — 미리보기 없는 종류
  await new Promise((r) => setTimeout(r, 260));
  assert.equal(b.__calls.fetch, 0, '못 그리는 종류를 미리 받았다');
  const old = make({ open: { slug: '*old', uid: 'K1', atts: [{ name: '공고.hwp', size: 1000 }] } });
  old.mbAttPeekHover(0);
  await new Promise((r) => setTimeout(r, 260));
  assert.equal(old.__calls.fetch, 0, '지난 메일은 한 첨부에 메일 통째라 미리 받으면 헛일이다');
});

test('★★ 판독기는 «한 번만» 싣는다 — 올려놓기와 누르기가 겹쳐도', async () => {
  const b = make();
  const p1 = b.mbPvLib('vendor/pako.min.js?v=1', () => false);
  const p2 = b.mbPvLib('vendor/pako.min.js?v=1', () => false);
  assert.equal(b.__calls.scripts.length, 1, '같은 판독기를 두 번 실었다');
  assert.equal(p1, p2);
  p1.catch(() => {}); p2.catch(() => {});
});

test('★ 종류별로 «필요한 판독기만» 싣는다 — 옛 한글(.hwp)만 xlsx(큰 것)까지', () => {
  const b = make();
  b.mbPvLibsFor('doc', '공고.hwp').catch(() => {});
  const hwp = b.__calls.scripts.slice();
  assert.ok(hwp.some((s) => /pako/.test(s)) && hwp.some((s) => /xlsx/.test(s)), '옛 한글에 필요한 판독기가 안 실린다');
  const c = make();
  c.mbPvLibsFor('doc', '계약서.docx').catch(() => {});
  assert.ok(!c.__calls.scripts.some((s) => /xlsx/.test(s)), 'docx 에 xlsx 900KB 를 싣는다');
});

/* ── 소스 쪽: 연결이 붙어 있는가 ── */
test('★★ 미리보기는 받기와 판독기 싣기를 «나란히» 한다 — 차례로 하면 그만큼 늦다', () => {
  const f = fnSrc('mbAttPeek').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(f, /Promise\.all\(\[\s*mbAttBytes\(o, i, a\),\s*mbPvLibsFor\(kind, a\.name\)\s*\]\)/, '받기와 판독기가 나란히가 아니다');
  assert.doesNotMatch(f, /fetch\(MB_FN/, '미리보기가 직접 서버를 불러 받아 둔 것을 못 쓴다');
});

test('★★ pdf.js 에는 «사본»을 건넨다 — 받아 둔 바이트를 떼어 가면 두 번째 미리보기가 빈다', () => {
  assert.match(fnSrc('mbPvDraw'), /data: buf\.slice\(\)/);
});

test('★ 「미리보기」 단추에 올려놓기·터치가 달려 있다', () => {
  assert.match(HTML, /class="peek" onclick="mbAttPeek\(\$\{i\}\)" onmouseenter="mbAttPeekHover\(\$\{i\}\)" onmouseleave="mbAttPeekHoverCancel\(\)" ontouchstart="mbAttPeekHover\(\$\{i\}\)"/);
});

/* ── 서버 쪽 ── */
const MS_PATH = require.resolve('../functions/mail-sync.js');
function build() {
  delete require.cache[MS_PATH];
  const build = require(MS_PATH);
  const db = { ref: () => ({ once: async () => ({ val: () => ({}) }) }) };
  const handlers = {};
  const reg = {
    runWith: () => ({
      https: { onRequest: (h) => h },
      pubsub: { schedule: () => ({ timeZone: () => ({ onRun: (h) => h }) }) },
    }),
  };
  const deps = {
    getDatabase: () => db, getAuth: () => ({}), MD: { loginIds: () => ['x'] }, MAIL_REGION: 'asia-northeast3',
    setCors: () => {}, requireStaff: async () => ({ uid: 'u' }),
    mailUserAsync: async () => 'hong@example.com', mailPass: () => 'pw',
    functions: { region: () => reg },
  };
  return build(deps);
}
const warmSig = () => crypto.createHmac('sha256', 'pw').update('pu-mail-warm-v1').digest('hex');
function fakeRes() { const r = { code: 0, body: null, status(c) { r.code = c; return r; }, json(b) { r.body = b; }, send(b) { r.body = b; }, set() { return r; }, setHeader() {} }; return r; }

test('★★ 첨부 받기 함수도 서명 붙은 두드림을 «문지기 앞에서» 받는다 — 서명이 틀리면 403', async () => {
  const h = build();
  const res = fakeRes();
  await h.readMailAttachment({ method: 'POST', headers: { 'x-pu-warm': 'x'.repeat(64) }, body: { warm: 1 } }, res);
  assert.equal(res.code, 403);
  /* ⚠ 문지기도 403 을 낸다 — 코드만 보면 두드림 길과 구별이 안 된다. 두드림 길만 warm:true 를 붙인다. */
  assert.equal(res.body && res.body.warm, true, '두드림을 못 알아보고 일반 길(문지기)로 보냈다');
});

test('★★ 따뜻하게 두기가 «메일 열기와 첨부 받기 둘 다» 두드린다 — 둘은 다른 그릇이다', async () => {
  const h = build();
  const seen = [];
  const realFetch = global.fetch;
  global.fetch = async (url, init) => { seen.push({ url: String(url), sig: init.headers['x-pu-warm'] }); return { status: 200, json: async () => ({ ok: true }) }; };
  try { await h.mailKeepWarm(); } finally { global.fetch = realFetch; }
  assert.equal(seen.length, 2, '두드린 곳이 둘이 아니다');
  assert.ok(seen.some((s) => /\/readMailMessage$/.test(s.url)));
  assert.ok(seen.some((s) => /\/readMailAttachment$/.test(s.url)), '첨부 받기를 안 두드린다 — 매번 새로 붙는다');
  assert.ok(seen.every((s) => s.sig === warmSig()), '서명이 다르다');
});
