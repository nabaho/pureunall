/* 👥 직원 일정 → 구글 공용 달력 «서버가 대신 넣기» (2026-10-10)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-10 「직원구글연결되게 해라」 → 「서버가 대신 넣기」.

   ★ 이 검사가 지키는 것
     ① 새로 생긴 직원 일정만 보낸다 — 외부 협력자·이미 이어진 것·지운 것·제목 없는 것은 안 보낸다
     ② 구글에 보내는 몸은 화면(js/pu-gcal-auth.js 몸만들기)과 «같은 셈»이다
     ③ 담당 번호를 남긴다(shared.puSid + 설명 「푸른 담당: 이름 (P-005)」)
     ④ 성공하면 movedToGcal·gcalEventId 표를 달고 «지우지 않는다»(이알피가 이 표만 읽는다)
     ⑤ 실패하면 우리 기록을 그대로 두고 gcalProxyErr 만 적는다
     ⑥ 화면: 옮긴 줄은 안 그리고(구글 것이 뜬다), 구글 일정의 담당 번호가 만든이 메일을 이긴다
     ⑦ 출장 알림: 대표 계정이 대신 넣은 직원 일정을 대표 것으로 보지 않는다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const P = require(path.join(ROOT, 'functions', 'gcal-proxy.js'));
const AUTH = require(path.join(ROOT, 'js', 'pu-gcal-auth.js'));
const T = require(path.join(ROOT, 'functions', 'trip-remind.js'));
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

const 이름 = (sid) => ({ 'P-005': '박한별', 'P-001': '권형하' })[sid] || '';
const 줄 = (o) => Object.assign({ id: 'sch_1', sid: 'P-005', date: '2026-10-12', time: '10:00', endTime: '11:30',
  title: '에스에이씨 최종보고', place: '충남 아산시 인주면 인주산단로 123-81', contact: '김과장 010', note: '자료 지참' }, o || {});

test('① 보낼 것만 고른다', () => {
  assert.ok(P.eventOf(줄(), 'sch_1', 이름));
  assert.strictEqual(P.eventOf(줄({ externalId: 'X1' }), 'a', 이름), null, '외부 협력자');
  assert.strictEqual(P.eventOf(줄({ gcalEventId: 'g' }), 'a', 이름), null, '이미 이어짐');
  assert.strictEqual(P.eventOf(줄({ _deleted: true }), 'a', 이름), null, '지움');
  assert.strictEqual(P.eventOf(줄({ title: ' ' }), 'a', 이름), null, '제목 없음');
  assert.strictEqual(P.eventOf(줄({ date: '' }), 'a', 이름), null, '날짜 없음');
  const 종일 = P.eventOf(줄({ time: '00:00', endTime: '' }), 'a', 이름);
  assert.strictEqual(종일.time, '');
});

test('② 몸은 화면과 같은 셈 · ③ 담당 번호', () => {
  const ev = P.eventOf(줄(), 'sch_1', 이름);
  assert.match(ev.description, /담당자: 김과장 010\n자료 지참\n푸른 담당: 박한별 \(P-005\)$/);
  const 서버 = P.bodyOf(ev), 화면 = AUTH.bodyOf(ev);
  assert.deepStrictEqual(서버, 화면);
  assert.deepStrictEqual(서버.extendedProperties.shared, { puSid: 'P-005' });
  assert.strictEqual(서버.start.dateTime, '2026-10-12T10:00:00');
  for (const e of [P.eventOf(줄({ time: '', endTime: '' }), 'a', 이름), P.eventOf(줄({ time: '23:30', endTime: '' }), 'a', 이름),
                   P.eventOf(줄({ time: '22:00', endTime: '01:00' }), 'a', 이름)]) {
    assert.deepStrictEqual(P.bodyOf(e), AUTH.bodyOf(e));
  }
});

/* 가짜 DB */
function fakeDb(seed) {
  const data = JSON.parse(JSON.stringify(seed));
  const get = (p) => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), data);
  const set = (p, v) => { const ks = p.split('/'); let o = data; ks.slice(0, -1).forEach((k) => { o[k] = o[k] || {}; o = o[k]; }); o[ks[ks.length - 1]] = v; };
  return { data, ref: (p) => ({
    once: async () => ({ val: () => get(p) ?? null }),
    update: async (u) => { Object.keys(u).forEach((k) => set(p + '/' + k, u[k])); },
    set: async (v) => set(p, v),
    transaction: async (fn) => { set(p, fn(get(p))); },
  }) };
}
function run(fetchImpl) {
  const db = fakeDb({ uid_roles: { U1: { sid: 'P-001', status: 'active' } }, gcal_tokens: { U1: { rt: 'RT' } },
    data: { user_dir: { v: { a: { sid: 'P-005', name: '박한별' } } }, my_schedules: { v: { sch_1: 줄() } } } });
  const sent = [];
  const fetch = async (url, opt) => { sent.push({ url, opt }); return fetchImpl(url, opt); };
  const R = P({ functions: { region: () => ({ runWith: () => ({ database: { ref: () => ({ onWrite: (f) => f }) } }) }) },
    getDatabase: () => db, fetch, secretOf: () => 'GOCSPX-xxxxxxxxxxxxxxxxxxxx', clientId: 'CID' });
  return { db, sent, R };
}
const ok = (j) => ({ ok: true, status: 200, json: async () => j });

test('④ 성공 — 구글에 넣고 movedToGcal 표, 지우지 않는다', async () => {
  const { db, sent, R } = run((url) => /oauth2/.test(url) ? ok({ access_token: 'AT' }) : ok({ id: 'GEV1' }));
  const r = await R.proxyOne('sch_1', 줄());
  assert.strictEqual(r.done, true);
  const rec = db.data.data.my_schedules.v.sch_1;
  assert.strictEqual(rec.movedToGcal, true);
  assert.strictEqual(rec.gcalEventId, 'GEV1');
  assert.ok(!rec._deleted, '지웠다 — 이알피에서 사라진다');
  assert.strictEqual(rec.revision, 1);
  const post = sent.find((x) => /calendar\/v3/.test(x.url));
  assert.match(post.url, /euh07th7tvlco9corqen9lqpts%40group\.calendar\.google\.com\/events\?sendUpdates=none$/);
  assert.strictEqual(post.opt.headers.Authorization, 'Bearer AT');
  assert.deepStrictEqual(JSON.parse(post.opt.body).extendedProperties.shared, { puSid: 'P-005' });
  /* 갱신 열쇠가 구글 토큰 창구 말고 다른 데로 안 갔다 */
  assert.ok(sent.filter((x) => String(x.opt.body || '').includes('RT')).every((x) => /oauth2\.googleapis\.com\/token/.test(x.url)));
});

test('⑤ 실패 — 기록은 그대로, 까닭만 적는다', async () => {
  const { db, R } = run((url) => /oauth2/.test(url) ? ok({ access_token: 'AT' }) : { ok: false, status: 403, json: async () => ({ error: { message: 'forbidden' } }) });
  const r = await R.proxyOne('sch_1', 줄());
  assert.strictEqual(r.done, false);
  const rec = db.data.data.my_schedules.v.sch_1;
  assert.ok(!rec.movedToGcal && !rec.gcalEventId);
  assert.match(rec.gcalProxyErr, /forbidden/);
  assert.strictEqual(rec.title, '에스에이씨 최종보고');
});

test('지우면 구글 쪽도 지운다 — 옮긴 줄만, 처음 지울 때만', async () => {
  const moved = 줄({ movedToGcal: true, gcalEventId: 'GEV1' });
  const a = run((url, opt) => /oauth2/.test(url) ? ok({ access_token: 'AT' }) : { ok: true, status: 204, json: async () => null });
  assert.strictEqual((await a.R.removeOne('sch_1', moved, Object.assign({}, moved, { _deleted: true }))).done, true);
  const del = a.sent.find((x) => x.opt.method === 'DELETE');
  assert.match(del.url, /\/events\/GEV1\?sendUpdates=none$/);
  assert.strictEqual((await a.R.removeOne('sch_1', moved, null)).done, true, '통째로 지움');
  assert.strictEqual((await a.R.removeOne('sch_1', 줄(), Object.assign(줄(), { _deleted: true }))).why, 'skip', '안 옮긴 줄');
  assert.strictEqual((await a.R.removeOne('sch_1', moved, Object.assign({}, moved, { title: '고침' }))).why, 'skip', '고치기');
  const b = run((url) => /oauth2/.test(url) ? ok({ access_token: 'AT' }) : { ok: false, status: 404, json: async () => null });
  assert.strictEqual((await b.R.removeOne('sch_1', moved, null)).done, true, '구글에 이미 없음');
  const c = run((url) => /oauth2/.test(url) ? ok({ access_token: 'AT' }) : { ok: false, status: 500, json: async () => null });
  assert.strictEqual((await c.R.removeOne('sch_1', moved, Object.assign({}, moved, { _deleted: true }))).done, false);
  assert.match(c.db.data.data.my_schedules.v.sch_1.gcalProxyErr, /지우기 실패/);
});

test('⑥ 화면 — 옮긴 줄은 안 그리고, 담당 번호가 이긴다', () => {
  assert.match(캘린더, /if\(s\.movedToGcal && s\.gcalEventId && !GCAL\.err\) return;/);
  assert.match(캘린더, /var mailSid = 담당 \|\| gcalSidByMail\(mail\);/);
  assert.match(캘린더, /function 일정담당\(ev\)/);
  assert.match(캘린더, /puSid: String\(m\.sid\|\|""\)/);
  assert.match(캘린더, /js\/pu-gcal-auth\.js\?v=\d+/);
  const idx = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  assert.match(idx, /exports\.gcalProxy\s*=/);
});

test('⑦ 출장 알림 — 대표 계정이 대신 넣은 직원 일정은 대표 것이 아니다', () => {
  const now = Date.parse('2026-10-12T09:00:00+09:00');
  const mailSid = { 'boss@x,com': 'P-001' };
  const ev = (id, sid, desc) => ({ id, summary: '방문 ' + id, location: '아산시 인주면', creator: { email: 'boss@x.com' },
    start: { dateTime: '2026-10-12T10:00:00+09:00' }, description: desc || '',
    extendedProperties: sid ? { shared: { puSid: sid } } : undefined });
  const xs = T.pickTrips({ now, mailSid, gcal: [ev('staff', 'P-005'), ev('boss', 'P-001'), ev('plain'),
    ev('desc', '', '푸른 담당: 박한별 (P-005)')] });
  assert.deepStrictEqual(xs.map((x) => x.id).sort(), ['boss', 'plain']);
  assert.deepStrictEqual(T.pickTrips({ now, mailSid, schedules: { a: { id: 'a', sid: 'P-001', date: '2026-10-12', time: '10:00',
    title: 't', place: '아산', movedToGcal: true, gcalEventId: 'g' } } }), [], '옮긴 줄은 구글 쪽으로 한 번만');
});
