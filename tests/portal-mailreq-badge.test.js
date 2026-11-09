/* 포털 경력관리 타일의 «요청 N» 딱지 — enter.html 안의 portalMr* 코드를 «그대로 꺼내» 가짜 환경에서 돌린다 (2026-11-09)
   약속: 대표 본인만 · 창을 띄우지 않고 딱지만 · 경력관리와 같은 모듈·같은 저장 자리 · 로그아웃하면 멈춘다. 합성 자료만. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 만들기 } = require('./helpers/fake-rtdb.js');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
const Q = require('../js/kcareer-mailreq.js');

const START = html.indexOf('// ── 📬 경력관리 «요청 메일» 딱지');
const END = html.indexOf('// 로그인 직후 바로 찍기');
const BLOCK = html.slice(START, END);

test('자리가 있다 — 모듈 불러오기 · 로그인 뒤 시작 · 타일 다시 그릴 때 다시 붙이기 · 로그아웃에 멈춤', () => {
  assert.ok(START > 0 && END > START, '포털 딱지 코드 덩어리를 못 찾았다');
  assert.match(html, /<script src="js\/kcareer-mailreq\.js\?v=\d+"><\/script>/);
  assert.match(html, /portalHanaPaintBadge\(\);\s*initPortalMrAlerts\(role, acct\);/, '타일을 새로 그린 직후 시작(이미 돌고 있으면 딱지만 다시 붙인다)');
  assert.match(html, /stopPortalHanaAlerts\(\);\s*stopPortalMrAlerts\(\);/, '로그아웃하면 멈춘다');
});
test('자주 쓰는 앱 줄(복제본)의 딱지도 키보드로 열린다 — 복제본은 리스너가 없어 줄 위임이 «딱지»도 받아야 한다 · 포커스 표시', () => {
  /* ⚠ 큰 파일(enter.html)에 assert.match 를 쓰면 실패할 때 파일 전체가 쏟아진다 — ok(test) 로 */
  assert.ok(/pt\.addEventListener\('keydown', function\(e\)\{[\s\S]{0,300}contains\('tile-alert'\)\)\) onPinCloneClick\(e\);/.test(html), '복제본 딱지에 키보드 위임이 없다');
  assert.ok(/\.tile-alert:focus-visible\{[^}]*outline:/.test(html), '키보드로 닿았을 때 보이는 표시가 없다');
  assert.ok(/var badge = e\.target\.closest\('\.nl-warn, \.tile-alert'\);[\s\S]{0,200}ob\.click\(\)/.test(html), '복제본 딱지를 누르면 원본 딱지를 누르는 길이 없다(키보드도 이 길을 탄다)');
});
test('★ 창을 띄우지 않는다 — 모달·alert·confirm 없이 딱지만(하던 일을 가로막지 않는다)', () => {
  assert.ok(!/alert\(|confirm\(|showPortal|modal|\.style\.display\s*=\s*'flex'/i.test(BLOCK), '창을 띄우는 코드가 없어야 한다');
  assert.match(BLOCK, /className = 'tile-alert'/);
});
test('★ 폰 푸시는 건드리지 않는다', () => {
  assert.ok(!/fcm_tokens|messaging\(|pushListen|push-admins|sendTo\(|mailPush/.test(BLOCK));
});

/* ── 가짜 환경 ── */
function liveDb(init) {
  const db = 만들기(init); const ls = []; let writes = 0;
  const norm = (p) => String(p || '').split('/').filter(Boolean).join('/');
  const tell = () => ls.forEach((l) => l.cb({ val: () => db.읽기(l.p) }));
  const wrap = (p) => {
    const r = db.ref(p), w = Object.assign({}, r);
    ['set', 'update', 'transaction'].forEach((k) => { w[k] = async (...a) => { writes++; const out = await r[k](...a); tell(); return out; }; });
    w.child = (k) => wrap(norm(p) + '/' + k);
    w.on = (ev, cb) => { ls.push({ p: norm(p), cb }); cb({ val: () => db.읽기(p) }); };
    w.off = (ev, cb) => { const i = ls.findIndex((l) => l.cb === cb); if (i >= 0) ls.splice(i, 1); };
    return w;
  };
  return { ref: wrap, 읽기: db.읽기, writes: () => writes, listeners: () => ls.length };
}
const NOW = Date.now(), IN = 'INBOX-a1b2c3d4';
const mail = (o) => Object.assign({ s: '[가나연구원] 참여 사전동의서', an: ['동의서(양식).hwp'], p: '안녕하세요', f: '가나연구원', e: 'req@example.org', a: 1, d: NOW - 60000, r: 0, w: 0 }, o || {});
function world(o) {
  o = o || {};
  const db = liveDb({ mailbox: { folders: { [IN]: { kind: 'inbox' } }, msgs: { [IN]: Object.assign({ '101': mail() }, o.msgs || {}) } } });
  const tile = { children: [], appendChild(c) { this.children.push(c); c.parent = this; } };
  const els = {}, opened = [], intervals = [], listeners = {}, bodyCalls = [];
  const mkBadge = () => ({ id: '', className: '', textContent: '', title: '', onclick: null, attrs: {}, tabIndex: -1, keys: null,
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(ev, fn) { if (ev === 'keydown') this.keys = fn; },
    remove() { tile.children = tile.children.filter((c) => c !== this); } });
  let pins = 0;
  const ctx = {
    KcareerMailReq: Q, console, Date, Math, JSON, Object, Array, String, Number, Promise,
    db, auth: { currentUser: { uid: 'U1', getIdToken: async () => 'tok' } },
    $: (id) => tile.children.find((c) => c.id === id) || null,
    APPS: [{ key: 'career', name: '경력관리', url: 'kcareer.html' }], isMobile: () => !!o.mobile,
    openPortalApp: (app, url) => opened.push(url),
    fetch: async (url, init) => { bodyCalls.push({ url, body: JSON.parse(init.body), auth: init.headers.Authorization }); return { json: async () => ({ ok: true, text: '사전동의서를 보내 주세요.' }) }; },
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; }, clearInterval: (id) => { if (intervals[id - 1]) intervals[id - 1].fn = null; },
    location: { href: '' }, paintPins: () => { pins++; },
    document: { hidden: !!o.hidden, createElement: () => mkBadge(), querySelector: (q) => (/data-key="career"/.test(q) && !o.noTile ? tile : null),
      addEventListener: (ev, fn) => { listeners[ev] = fn; }, removeEventListener: (ev) => { delete listeners[ev]; } },
  };
  vm.createContext(ctx); vm.runInContext(BLOCK, ctx);
  return { ctx, db, tile, opened, intervals, listeners, bodyCalls, pins: () => pins, badge: () => tile.children.find((c) => c.id === 'portalMrBadge') || null,
    items: () => db.읽기('kcareer/U1/mailreq/items') || {} };
}
const settle = () => new Promise((r) => setImmediate(r));
const OWNER = { sid: 'P-001', name: '권형하' };
async function started(o, role, acct) { const w = world(o); w.ctx.initPortalMrAlerts(role || 'admin', acct === undefined ? OWNER : acct); for (let i = 0; i < 6; i++) await settle(); return w; }

test('대표 본인이면 새 요청을 알아보고 경력관리 타일에 「요청 N」 딱지를 붙인다 · 올린 곳은 경력관리와 같은 자리', async () => {
  const w = await started();
  assert.deepEqual(Object.keys(w.items()), [IN + '~101']);
  const b = w.badge(); assert.ok(b, '딱지가 붙어야 한다');
  assert.equal(b.textContent, '요청 1'); assert.equal(b.className, 'tile-alert');
  assert.match(b.title, /확인할 요청 메일 1건/); assert.match(b.title, /참여 사전동의서/);
  assert.ok(w.bodyCalls.length >= 1 && /readMailMessage$/.test(w.bodyCalls[0].url) && w.bodyCalls[0].auth === 'Bearer tok', '본문은 푸른메일함과 같은 함수로, 로그인 토큰을 붙여');
});
test('★ 대표 본인이 아니면(다른 관리자·직원) 훑지도 듣지도 쓰지도 않는다', async () => {
  for (const [role, acct] of [['admin', { sid: 'P-002', name: '김관리' }], ['staff', OWNER], ['admin', null]]) {
    const w = await started({}, role, acct);
    assert.equal(w.db.writes(), 0, role + '/' + (acct && acct.name) + ' — 아무 데도 쓰지 않았다');
    assert.equal(w.db.listeners(), 0); assert.equal(w.intervals.length, 0); assert.equal(w.badge(), null);
  }
});
test('알릴 것이 없으면 딱지를 안 만든다 · 경력관리에서 처리하면 딱지가 같이 줄어든다', async () => {
  const w = await started(); assert.ok(w.badge());
  await w.db.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~101'], 'done', Date.now()));
  await settle(); assert.equal(w.badge(), null, '처리 완료로 바꾸면 딱지가 사라진다');
  await w.db.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~101'], 'doing', Date.now()));
  await settle(); assert.equal(w.badge(), null, '확인함이고 기한이 멀면 알리지 않는다');
});
test('딱지는 키보드로도 누른다(role=button · tabindex · Enter·Space) · 자주 쓰는 앱 줄(복제본)에도 보이게 딱지가 «바뀐 때만» 다시 그린다', async () => {
  const w = await started(); const b = w.badge();
  assert.equal(b.attrs.role, 'button'); assert.equal(b.tabIndex, 0); assert.ok(b.keys, 'keydown 이 걸려 있어야 한다');
  let stopped = 0; b.keys({ key: 'Enter', preventDefault() {}, stopPropagation() { stopped++; } }); b.keys({ key: ' ', preventDefault() {}, stopPropagation() {} });
  b.keys({ key: 'a', preventDefault() {}, stopPropagation() {} });
  assert.equal(w.opened.length, 2, 'Enter·Space 만 연다'); assert.equal(stopped, 1);
  const n = w.pins(); assert.ok(n >= 1, '딱지가 붙으면 복제본을 다시 만든다');
  w.ctx.portalMrPaint(); w.ctx.portalMrPaint();
  assert.equal(w.pins(), n, '그대로면 복제본을 또 만들지 않는다(그릴 때마다 줄이 다시 지어지면 깜박인다)');
  await w.db.ref('kcareer/U1/mailreq/items').update(Q.stateUpdate([IN + '~101'], 'done', Date.now())); await settle();
  assert.equal(w.badge(), null); assert.ok(w.pins() > n, '딱지가 사라질 때도 복제본에서 지운다');
});
test('타일만 다시 그려졌다면(init 을 또 불러도) 껐다 켜지 않는다 — 듣기·시계가 겹치지 않고 딱지만 다시 붙는다', async () => {
  const w = await started();
  assert.equal(w.db.listeners(), 1); assert.equal(w.intervals.length, 1);
  w.tile.children = [];                                     // 타일이 새로 그려져 딱지가 사라진 상황
  w.ctx.initPortalMrAlerts('admin', OWNER); await settle();
  assert.equal(w.db.listeners(), 1, '듣기를 또 달지 않는다'); assert.equal(w.intervals.length, 1, '시계를 또 달지 않는다');
  assert.ok(w.badge(), '딱지는 다시 붙는다');
  w.ctx.initPortalMrAlerts('admin', { sid: 'P-002', name: '김관리' });   // 사람이 바뀌면 멈춘다
  assert.equal(w.db.listeners(), 0); assert.equal(w.badge(), null);
});
test('타일이 아직 없으면 조용히 건너뛴다(다음 조회·다시 그릴 때 붙는다)', async () => {
  const w = await started({ noTile: true }); assert.equal(w.badge(), null);
  w.ctx.document.querySelector = (q) => w.tile; w.ctx.portalMrPaint();
  assert.ok(w.badge(), '타일이 생긴 뒤 다시 그리면 붙는다');
});
test('딱지를 누르면 경력관리 「요청 메일」로 간다(타일 클릭으로 번지지 않게 끊는다) · 폰은 같은 창으로', async () => {
  const w = await started(); let stopped = 0, prevented = 0;
  w.badge().onclick({ preventDefault() { prevented++; }, stopPropagation() { stopped++; } });
  assert.equal(stopped, 1); assert.equal(prevented, 1);
  assert.equal(w.opened.length, 1); assert.match(w.opened[0], /^kcareer\.html\?sso=1&go=mailreq&v=\d+$/);
  const m = await started({ mobile: true }); m.badge().onclick({ preventDefault() {}, stopPropagation() {} });
  assert.match(m.ctx.location.href, /go=mailreq/); assert.equal(m.opened.length, 0);
  assert.match(fs.readFileSync(path.join(ROOT, 'kcareer.html'), 'utf8'), /go=mailreq\(\?:&\|\$\)\/\.test\(location\.search\)[\s\S]{0,400}navTile\('page-mailreq'\)/, '경력관리가 go=mailreq 를 받는다');
});
test('조회는 5분마다 · 화면을 보고 있을 때만 · 겹쳐 돌지 않는다', async () => {
  const w = await started(); assert.equal(w.intervals[0].ms, Q.POLL_MS);
  const hidden = world({ hidden: true }); hidden.ctx.initPortalMrAlerts('admin', OWNER); for (let i = 0; i < 4; i++) await settle();
  assert.equal(hidden.db.writes(), 0, '숨은 탭은 훑지 않는다');
  assert.ok(w.listeners.visibilitychange, '다시 보이면 한 번 확인한다');
});
test('멈추면(로그아웃) 듣던 것·시계·딱지를 모두 치운다', async () => {
  const w = await started(); assert.equal(w.db.listeners(), 1); assert.ok(w.badge());
  w.ctx.stopPortalMrAlerts();
  assert.equal(w.db.listeners(), 0); assert.equal(w.badge(), null); assert.equal(w.listeners.visibilitychange, undefined);
  assert.equal(w.intervals[0].fn, null, '시계를 껐다');
});
