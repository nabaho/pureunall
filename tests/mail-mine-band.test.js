'use strict';
/* 📬 내 담당 메일 띠 (대표 승인 목업 2026-10-05, ㉡)

   지키는 것
   ① 읽으면 띠에서 빠진다 · 0통이면 띠 자체가 없다 — 늘 켜진 등은 아무것도 못 알린다
   ② 내가 누구인지 모르면 아무것도 안 띄운다(남의 것을 내 것처럼 보이면 안 된다)
   ③ 오래된 것은 「새로 왔다」가 아니다
   ④ 날짜로 «먼저» 거른다 — 메일 통수만큼 담당을 따지면 그것이 곧 느림이다
   ⑤ 보낸메일함·휴지통은 안 센다. 보는 칸 갈래가 «서버와 같다»
      (다르면 「폰은 울렸는데 띠에는 없다」가 된다)
   ⑥ 폰 알림 끄기는 사람마다 — 안 적혀 있으면 «켠 것», 한 사람이 꺼도 남에게 안 옮는다
   ⑦ 못 적으면 화면도 되돌린다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const SRV = require('../functions/mail-owner.js');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

const NOW = Date.parse('2026-10-05T09:00:00Z');
const AGO = (d) => NOW - d * 86400000;

function box(o) {
  o = o || {};
  const sent = [];
  const ctx = {
    Object, String, Number, Array, JSON, Date, Math, RegExp,
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'),
    DB_ROOT: 'pucards',
    _mbMsgs: o.msgs || {},
    _mbPush: o.push || {},
    state: {},
    mbMyName: () => (o.me === undefined ? '권형하' : o.me),
    mbStaffOf: (n) => ({ '권형하': { sid: 'P-001' }, '박한별': { sid: 'P-002' } })[n] || null,
    mbWhoOfRow: (v) => String((o.whoOf || {})[String(v && v.e)] || ''),
    mbSentBox: () => !!o.sentBox,
    mbFolderBy: (s) => (o.folders || { IN: { kind: 'inbox' }, F1: { kind: 'custom' },
      SENT: { kind: 'sent' }, TRASH: { kind: 'trash' } })[s] || null,
    mbOpenMsg() {},
    renderMailPage() { ctx._drew = (ctx._drew || 0) + 1; },
    toast: (s) => { ctx._toasts = (ctx._toasts || []).concat(String(s)); },
    Store: { mode: o.offline ? 'local' : 'firebase' },
  };
  ctx.firebase = { database: () => ({ ref: (p) => ({
    set: (v) => { sent.push({ p: String(p), v: v });
      return o.failWrite ? Promise.reject(new Error('막힘')) : Promise.resolve(); },
  }) }) };
  vm.createContext(ctx);
  ['mbMineBox', 'mbMineRows', 'mbMySid', 'mbMinePushOn', 'mbMinePushSet', 'mbMineLineHtml']
    .forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  ['MB_MINE_DAYS', 'MB_MINE_NAMES', 'MB_MINE_KINDS'].forEach((n) => {
    const m = app.match(new RegExp('const ' + n + ' = [^;]*;'));
    assert.ok(m, n + ' 를 앱에서 찾지 못했습니다');
    vm.runInContext('var ' + m[0].slice('const '.length), ctx);
  });
  return { ctx, sent };
}

const ROW = (e, d, extra) => Object.assign({ e: e, f: '홍길동', s: '제목', d: d }, extra || {});

/* ══ ①②③ ══ */
test('★★★ 내 담당이면서 안 읽은 것만 센다', () => {
  const b = box({
    whoOf: { 'a@x.kr': '권형하', 'b@x.kr': '박한별', 'c@x.kr': '권형하' },
    msgs: { IN: { 1: ROW('a@x.kr', AGO(0)), 2: ROW('b@x.kr', AGO(0)),
                  3: ROW('c@x.kr', AGO(0), { r: 1 }) } },
  });
  const rows = b.ctx.mbMineRows(NOW);
  assert.equal(rows.length, 1, '남의 것과 읽은 것은 빠진다');
  assert.equal(rows[0].u, '1');
});

test('★★★ 0통이면 띠 자체가 없다 — 늘 켜진 등은 아무것도 못 알린다', () => {
  const b = box({ whoOf: {}, msgs: { IN: { 1: ROW('a@x.kr', AGO(0)) } } });
  assert.equal(b.ctx.mbMineLineHtml(), '');
});

test('★★★ 내가 누구인지 모르면 아무것도 안 띄운다 — «담당 모름»이 내 것이 되면 안 된다', () => {
  /* ⚠ 내 이름이 빈칸인데 막음이 없으면, 담당이 «없는»(빈칸) 메일이 나와 같다고 잡힌다.
       그러면 담당 모름 수십 통이 통째로 「내 담당 메일」로 뜬다. */
  const b = box({ me: '', whoOf: { 'a@x.kr': '권형하', 'b@x.kr': '' },
    msgs: { IN: { 1: ROW('a@x.kr', AGO(0)), 2: ROW('b@x.kr', AGO(0)) } } });
  assert.equal(b.ctx.mbMineRows(NOW).length, 0);
  assert.equal(b.ctx.mbMineLineHtml(), '');
});

test('★★★ 오래된 것은 「새로 왔다」가 아니다', () => {
  const b = box({ whoOf: { 'a@x.kr': '권형하' },
    msgs: { IN: { 1: ROW('a@x.kr', AGO(0)), 2: ROW('a@x.kr', AGO(99)) } } });
  assert.equal(b.ctx.mbMineRows(NOW).length, 1);
});

test('★★★ 날짜로 «먼저» 거른다 — 메일 통수만큼 담당을 따지지 않는다', () => {
  let asked = 0;
  const msgs = { IN: {} };
  for (let i = 0; i < 300; i++) msgs.IN[i] = ROW('a@x.kr', AGO(99));   /* 다 오래된 것 */
  msgs.IN[999] = ROW('a@x.kr', AGO(0));
  const b = box({ msgs: msgs });
  b.ctx.mbWhoOfRow = () => { asked++; return '권형하'; };
  assert.equal(b.ctx.mbMineRows(NOW).length, 1);
  assert.equal(asked, 1, '오래된 300통에는 담당을 묻지 않아야 한다 — 물은 횟수 ' + asked);
});

/* ══ ⑤ 어느 칸을 보나 ══ */
test('★★★ 보낸메일함·휴지통은 안 센다', () => {
  const b = box({ whoOf: { 'a@x.kr': '권형하' },
    msgs: { IN: { 1: ROW('a@x.kr', AGO(0)) }, F1: { 2: ROW('a@x.kr', AGO(0)) },
            SENT: { 3: ROW('a@x.kr', AGO(0)) }, TRASH: { 4: ROW('a@x.kr', AGO(0)) } } });
  assert.equal(b.ctx.mbMineRows(NOW).map((x) => x.u).sort().join(','), '1,2',
    '받은메일함과 폴더만 센다');
});

test('★★★ 띠가 보는 칸 갈래가 «서버와 같다» — 다르면 「폰은 울렸는데 띠에는 없다」', () => {
  const m = app.match(/const MB_MINE_KINDS = (\[[^\]]*\]);/);
  assert.ok(m, 'MB_MINE_KINDS 를 찾지 못했습니다');
  const screen = JSON.parse(m[1].replace(/'/g, '"'));
  assert.deepEqual(screen.slice().sort(), SRV.NOTIFY_KINDS.slice().sort(),
    '화면 ' + JSON.stringify(screen) + ' · 서버 ' + JSON.stringify(SRV.NOTIFY_KINDS));
});

test('★★ 모르는 칸은 안 센다 — 폴더 목록을 아직 못 받았을 때', () => {
  const b = box({ whoOf: { 'a@x.kr': '권형하' }, folders: {},
    msgs: { IN: { 1: ROW('a@x.kr', AGO(0)) } } });
  assert.equal(b.ctx.mbMineRows(NOW).length, 0);
});

test('★★ 우리가 낸 칸을 보고 있을 때는 띠를 안 띄운다', () => {
  const b = box({ sentBox: true, whoOf: { 'a@x.kr': '권형하' },
    msgs: { IN: { 1: ROW('a@x.kr', AGO(0)) } } });
  assert.equal(b.ctx.mbMineLineHtml(), '');
});

/* ══ 띠 글 ══ */
test('★★ 통수와 이름이 적히고, 많으면 「외 n통」으로 줄인다', () => {
  const msgs = { IN: {} };
  for (let i = 1; i <= 5; i++) msgs.IN[i] = ROW('a@x.kr', AGO(0) - i, { f: '보낸이' + i });
  const b = box({ whoOf: { 'a@x.kr': '권형하' }, msgs: msgs });
  const h = b.ctx.mbMineLineHtml();
  assert.ok(h.indexOf('내 담당 메일 5통') >= 0, h.slice(0, 160));
  assert.ok(/외 2통/.test(h), '세 사람까지만 적고 나머지는 「외 n통」: ' + h.slice(0, 220));
});

test('★★★ 새로 온 순서다 — 「보기」가 가장 최근 것을 연다', () => {
  const b = box({ whoOf: { 'a@x.kr': '권형하' },
    msgs: { IN: { 1: ROW('a@x.kr', AGO(2)), 2: ROW('a@x.kr', AGO(0)) } } });
  assert.equal(b.ctx.mbMineRows(NOW)[0].u, '2');
  assert.ok(b.ctx.mbMineLineHtml().indexOf("mbOpenMsg('IN','2')") >= 0);
});

/* ══ ⑥⑦ 폰 알림 설정 ══ */
test('★★★ 안 적혀 있으면 «켠 것»이다 — 빈 값을 꺼짐으로 읽지 않는다', () => {
  assert.equal(box({}).ctx.mbMinePushOn(), true);
  assert.equal(box({ push: { 'P-001': { off: true } } }).ctx.mbMinePushOn(), false);
  assert.equal(box({ push: { 'P-002': { off: true } } }).ctx.mbMinePushOn(), true,
    '한 사람이 꺼도 남에게 옮지 않는다');
});

test('★★★ 사람마다 «사번»으로 담는다 — 이름으로 담지 않는다', async () => {
  const b = box({});
  b.ctx.mbMinePushSet(false);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.sent.length, 1);
  assert.equal(b.sent[0].p, 'pucards/config/mailPush/P-001');
  assert.equal(b.sent[0].v.off, true);
});

test('★★★ 못 적으면 화면도 되돌린다 — 이 기기에서만 꺼진 것처럼 보이면 안 된다', async () => {
  const b = box({ failWrite: true });
  b.ctx.mbMinePushSet(false);
  await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.ctx.mbMinePushOn(), true, '못 껐으면 켜진 채로 남아야 한다');
  assert.ok((b.ctx._toasts || []).some((t) => /바꾸지 못했습니다/.test(t)));
});

test('★★ 사번을 모르면 적지 않고 알린다 — 엉뚱한 칸에 쓰지 않는다', async () => {
  const b = box({ me: '없는사람' });
  b.ctx.mbMinePushSet(false);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(b.sent.length, 0);
  assert.ok((b.ctx._toasts || []).some((t) => /사번/.test(t)));
});

test('★★★ 켤 때 «기기 등록이 따로 필요하다»고 말한다 — 「켰는데 왜 안 와요」를 막는다', async () => {
  const b = box({ push: { 'P-001': { off: true } } });
  b.ctx.mbMinePushSet(true);
  await new Promise((r) => setTimeout(r, 0));
  assert.ok((b.ctx._toasts || []).some((t) => /등록/.test(t)),
    '알린 말: ' + JSON.stringify(b.ctx._toasts));
});

test('★★ 꺼도 띠는 그대로 보인다 — 끄는 것은 «폰»이다', () => {
  const b = box({ push: { 'P-001': { off: true } }, whoOf: { 'a@x.kr': '권형하' },
    msgs: { IN: { 1: ROW('a@x.kr', AGO(0)) } } });
  const h = b.ctx.mbMineLineHtml();
  assert.ok(h.indexOf('내 담당 메일 1통') >= 0, '띠는 남아야 한다');
  assert.ok(/폰 알림 켜기/.test(h), '꺼져 있으면 「켜기」로 보여야 한다');
});

/* ══ 화면에 달려 있나 ══ */
test('★★★ 띠가 실제로 그려지는 자리에 달려 있다 — 안 달면 아무 데도 안 보인다', () => {
  const src = strip(app);
  assert.ok(/\$\{mbMineLineHtml\(\)\}/.test(src), '목록 머리에 달아야 한다');
  assert.ok(src.indexOf('${mbInqLineHtml()}') < src.indexOf('${mbMineLineHtml()}'),
    '새 문의 띠 바로 아래에 둔다 — 두 띠가 같은 자리에 모여야 눈이 한 곳만 본다');
});

test('★★★ 설정 표를 서버에서 읽는다 — 안 읽으면 끈 사람에게도 켜진 것으로 보인다', () => {
  const src = strip(app);
  assert.ok(/config\/mailPush'\)\.once\('value'\)/.test(src));
  assert.ok(/_mbPush = pu\.val\(\)/.test(src));
});
