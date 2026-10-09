/* 🚗 출장 출발 알림 (2026-10-09)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-09 「출장장소가 잡히면 한두 시간 이전에 … 폰에 자동으로 이동장소 주소가」
   → 「1시간 30분 전 · 대표님만」.

   ★ 이 검사가 지키는 것
     ① 앞으로 90분 안에 시작하는 «시각 있는·주소 있는» 일정만 — 종일·지난 것·먼 것·온라인 회의는 뺀다
     ② «대표 일정»만 — 만든이·참석자 메일이 대표 사번에 이어졌거나, 제목 괄호 표식, 우리 일정 sid, 나만 보기
     ③ 한 일정에 한 번만 — 보낸 표가 있으면 다시 안 보낸다. 폰이 없으면 «보냈다»고 적지 않는다
     ④ 알림이 누르고 갈 주소에는 «일정 번호»만 — 주소 글을 싣지 않는다
     ⑤ 함수가 배포 목록(functions/index.js)에 걸려 있다
     ⑥ 달력 화면: ?trip= 로 들어오면 출장 카드, 제네시스 앱 열기, 워커는 출장 알림을 새 창으로 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const T = require(path.join(ROOT, 'functions', 'trip-remind.js'));

const now = Date.parse('2026-10-14T08:00:00+09:00');
const mailSid = { 'boss@example,com': 'P-001', 'staff@example,com': 'P-005' };
const ev = (id, hm, o) => Object.assign({
  id, status: 'confirmed', summary: '방문 ' + id, location: '충남 아산시 인주면 인주산단로 123-81',
  start: { dateTime: '2026-10-14T' + hm + ':00+09:00' }, creator: { email: 'boss@example.com' }
}, o || {});

test('① 90분 안·시각 있음·주소 있음만', () => {
  const xs = T.pickTrips({ now, mailSid, gcal: [
    ev('a', '09:15'),                                            /* 75분 뒤 — 들어간다 */
    ev('b', '09:30'),                                            /* 90분 뒤 꼭 — 들어간다 */
    ev('c', '09:45'),                                            /* 105분 뒤 — 아직 */
    ev('d', '07:30'),                                            /* 지났다 */
    ev('e', '08:30', { location: 'https://zoom.us/j/1' }),        /* 온라인 */
    ev('f', '08:30', { location: '' }),                          /* 주소 없음 */
    ev('g', '', { start: { date: '2026-10-14' } }),               /* 종일 */
    ev('h', '08:40', { status: 'cancelled' }),
  ] });
  assert.deepStrictEqual(xs.map((x) => x.id), ['a', 'b']);
  assert.strictEqual(xs[0].time, '09:15');
  assert.strictEqual(xs[0].date, '2026-10-14');
});

test('② 대표 일정만 — 만든이·참석자·제목 표식·우리 일정·나만 보기', () => {
  const xs = T.pickTrips({ now, mailSid,
    gcal: [
      ev('mine', '09:00'),
      ev('other', '09:00', { creator: { email: 'staff@example.com' } }),
      ev('att', '09:00', { creator: { email: 'staff@example.com' }, attendees: [{ email: 'Boss@Example.com' }] }),
      ev('decl', '09:00', { creator: { email: 'staff@example.com' }, attendees: [{ email: 'boss@example.com', responseStatus: 'declined' }] }),
      ev('mark', '09:00', { creator: { email: 'x@y.z' }, summary: '1000 에스에이씨 최종보고 (권별)' }),
      ev('long', '09:00', { creator: { email: 'x@y.z' }, summary: '설명회 (권역별 사업 안내 자료)' }),
    ],
    schedules: {
      s1: { id: 's1', sid: 'P-001', date: '2026-10-14', time: '09:10', title: '내 방문', place: '홍성군청' },
      s2: { id: 's2', sid: 'P-005', date: '2026-10-14', time: '09:10', title: '남 방문', place: '홍성군청' },
    },
    priv: { p1: { id: 'p1', date: '2026-10-14', time: '08:50', title: '비공개 방문', place: '천안시청' } },
  });
  assert.deepStrictEqual(xs.map((x) => x.src + ':' + x.id).sort(),
    ['gcal:att', 'gcal:mark', 'gcal:mine', 'priv:p1', 'sch:s1']);
  assert.ok(T.표식있음('(권)', ['권']));
  assert.ok(!T.표식있음('권형하 대표 일정', ['권']), '괄호 밖은 표식이 아니다');
});

test('설정 — 끄기·앞당김 한도', () => {
  assert.strictEqual(T.설정({ enabled: false }).enabled, false);
  assert.strictEqual(T.설정({}).leadMin, 90);
  assert.strictEqual(T.설정({ leadMin: 9999 }).leadMin, 240);
  assert.strictEqual(T.설정({ leadMin: 1 }).leadMin, 15);
  assert.deepStrictEqual(T.pickTrips({ now, mailSid, cfg: { titleMarks: [] },
    gcal: [ev('m', '09:00', { creator: {}, summary: '(권별)' })] }), []);
});

test('④ 알림 — 누르는 주소에는 일정 번호만, 본문에 시각·주소', () => {
  const [x] = T.pickTrips({ now, mailSid, gcal: [ev('a b/c', '09:30')] });
  const n = T.알림글(x, now);
  assert.match(n.title, /^🚗 09:30 출장 — 1시간 30분 뒤$/);
  assert.match(n.body, /📍 충남 아산시/);
  assert.match(n.url, /^\/pureunall\/pu-cal\.html\?sso=1&trip=gcal%3Aa%20b%2Fc&d=2026-10-14$/);
  assert.ok(!/인주산단로/.test(decodeURIComponent(n.url)), '주소 글이 주소창에 실렸다');
  assert.ok(/^pu-trip-/.test(n.tag));
});

/* 가짜 실시간DB — once/update 만 */
function fakeDb(seed) {
  const data = JSON.parse(JSON.stringify(seed));
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), data);
  const set = (p, v) => {
    const ks = p.split('/'); let o = data;
    ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; });
    if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v;
  };
  return {
    data,
    ref: (p) => ({
      once: async () => ({ val: () => (p ? get(p) : data) ?? null, forEach: (fn) => Object.keys(get(p) || {}).forEach((k) => fn({ key: k })) }),
      update: async (u) => { Object.keys(u).forEach((k) => set(k, u[k])); },
    }),
  };
}
function run(seed, sendOk) {
  const db = fakeDb(seed);
  const calls = [];
  const deps = {
    functions: { region: () => ({ runWith: () => ({ pubsub: { schedule: () => ({ timeZone: () => ({ onRun: (f) => f }) }) } }) }) },
    getDatabase: () => db, MAIL_REGION: 'x',
    fetch: async () => ({ json: async () => ({ items: [ev('a', '09:00')] }) }),
    getMessaging: () => ({ sendEachForMulticast: async (m) => { calls.push(m); return { successCount: sendOk ? m.tokens.length : 0, failureCount: 0, responses: m.tokens.map(() => ({})) }; } }),
  };
  return { db, calls, R: T(deps) };
}
const 바탕 = (tokens) => ({
  uid_roles: { U1: { sid: 'P-001' }, U2: { sid: 'P-005' } },
  fcm_tokens: tokens ? { U1: { TOK: true } } : {},
  data: { gcal_mail_sid: { v: mailSid }, my_schedules: { v: {} } },
});

test('③ 한 번만 보낸다 · 폰이 없으면 보냈다고 적지 않는다', async () => {
  const a = run(바탕(true), true);
  const r1 = await a.R.remindOnce({ now });
  assert.strictEqual(r1.pushed, 1);
  assert.strictEqual(a.calls.length, 1);
  assert.match(a.calls[0].data.title, /09:00 출장/);
  const r2 = await a.R.remindOnce({ now: now + 15 * 60e3 });
  assert.strictEqual(r2.pushed, 0); assert.strictEqual(r2.skipped, 1);
  assert.strictEqual(a.calls.length, 1, '같은 일정을 두 번 보냈다');

  const b = run(바탕(false), true);
  const r3 = await b.R.remindOnce({ now });
  assert.strictEqual(r3.noPhone, 1);
  assert.deepStrictEqual(Object.keys((b.db.data.trip_remind || {}).sent || {}), [], '폰이 없는데 보냈다고 적었다');

  const c = run(Object.assign(바탕(true), { trip_remind: { config: { enabled: false } } }), true);
  assert.strictEqual((await c.R.remindOnce({ now })).ran, false);
  assert.strictEqual(c.calls.length, 0);
});

test('⑤ 배포 목록에 걸려 있다', () => {
  const idx = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  assert.match(idx, /require\("\.\/trip-remind"\)/);
  assert.match(idx, /exports\.tripRemind\s*=/);
});

test('⑥ 화면 — 출장 카드·제네시스 앱·워커', () => {
  const cal = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'firebase-messaging-sw.js'), 'utf8');
  assert.match(cal, /출장받기\(location\.search\)/);
  assert.match(cal, /function tripHtml\(\)/);
  assert.match(cal, /package="\s*\+ GENESIS_PKG/);
  assert.match(cal, /var GENESIS_PKG = "com\.genesis\.apps"/);
  assert.match(cal, /내 차로 전송/);
  assert.match(sw, /indexOf\('trip='\) < 0/);
  assert.match(sw, /requireInteraction: \/\^pu-trip-\//);
});
