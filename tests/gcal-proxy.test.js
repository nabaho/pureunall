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
    once: async () => ({ val: () => get(p) ?? null, forEach: (fn) => Object.keys(get(p) || {}).forEach((k) => fn({ key: k })) }),
    update: async (u) => { Object.keys(u).forEach((k) => set(p + '/' + k, u[k])); },
    set: async (v) => set(p, v),
    transaction: async (fn) => { set(p, fn(get(p))); },
    remove: async () => { const ks = p.split('/'); const o = get(ks.slice(0, -1).join('/')); if (o) delete o[ks[ks.length - 1]]; },
  }) };
}
function run(fetchImpl) {
  const db = fakeDb({ uid_roles: { U1: { sid: 'P-001', status: 'active' } }, gcal_tokens: { U1: { rt: 'RT' } },
    data: { user_dir: { v: { a: { sid: 'P-005', name: '박한별' } } }, my_schedules: { v: { sch_1: 줄() } } } });
  const sent = [];
  const fetch = async (url, opt) => { sent.push({ url, opt }); return fetchImpl(url, opt); };
  const R = P({ functions: { region: () => ({ runWith: () => ({ database: { ref: () => ({ onWrite: (f) => f }) }, https: { onRequest: (f) => f } }) }) },
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

/* ══ 고치기·지우기 연동 (2026-10-10 「23 연동」) ══════════════════════════════
   ⑧ 설명 꼴 왕복 · 주인 찾기 · 나머지(참석자·알림)는 그대로 두고 고친다
   ⑨ 본인 일정만 — 남의 것은 거절, 관리자는 모두, 담당 바꾸기는 관리자만
   ⑩ 이어진 우리 줄(이알피)도 함께 맞춘다 — 고치면 같은 칸, 지우면 삭제표시
   ⑪ 이알피에서 옮긴 줄을 고치면 구글도 고친다 — 화면 고치기가 맞춘 것은 다시 안 보낸다
   ⑫ 화면: 상세 창 ✏️·🗑, 고치는 창은 서버(gcalEdit)로 */

test('⑧ 설명 왕복 · 주인 · 나머지 보존', () => {
  const d = P.descOf('김과장 010', '자료 지참\n둘째 줄', 'P-005', 이름);
  assert.strictEqual(d, '담당자: 김과장 010\n자료 지참\n둘째 줄\n푸른 담당: 박한별 (P-005)');
  assert.deepStrictEqual(P.splitDesc(d), { contact: '김과장 010', note: '자료 지참\n둘째 줄' });
  assert.strictEqual(P.ownerOf({ extendedProperties: { shared: { puSid: 'P-003' } }, creator: { email: 'boss@x.com' } }, { 'boss@x,com': 'P-001' }), 'P-003');
  assert.strictEqual(P.ownerOf({ description: '푸른 담당: 홍 (A-002)' }, {}), 'A-002');
  assert.strictEqual(P.ownerOf({ creator: { email: 'Boss@X.com' } }, { 'boss@x,com': 'P-001' }), 'P-001');
  assert.strictEqual(P.ownerOf({ creator: { email: 'who@x.com' } }, {}), '');
  const cur = { id: 'G', summary: '옛', location: '옛곳', attendees: [{ email: 'a@b.c' }], reminders: { useDefault: false },
    extendedProperties: { private: { puSourceKind: 'card', puSourceId: 'k1' }, shared: { puSid: 'P-005', other: 'x' } } };
  const f = P.cleanFields({ date: '2026-10-20', time: '14:00', endTime: '15:00', title: '새 제목', place: '', contact: '', note: '메모', sid: 'P-003' });
  const out = P.mergedEvent(cur, f, 이름);
  assert.strictEqual(out.summary, '새 제목');
  assert.ok(!('location' in out), '빈 장소는 지운다');
  assert.deepStrictEqual(out.attendees, cur.attendees);
  assert.deepStrictEqual(out.reminders, cur.reminders);
  assert.deepStrictEqual(out.extendedProperties, { private: { puSourceKind: 'card', puSourceId: 'k1' }, shared: { puSid: 'P-003', other: 'x' } });
  assert.strictEqual(out.start.dateTime, '2026-10-20T14:00:00');
  assert.throws(() => P.cleanFields({ date: 'x', title: 't' }), /날짜/);
  assert.throws(() => P.cleanFields({ date: '2026-10-20', title: ' ' }), /무슨 일/);
  assert.strictEqual(P.cleanFields({ date: '2026-10-20', title: 't', time: '', endTime: '10:00' }).endTime, '', '시각 없이 끝만은 버린다');
});

function editRig(opts) {
  const o = opts || {};
  const db = fakeDb({
    uid_roles: { U1: { sid: 'P-001', status: 'active', isAdmin: true }, U5: { sid: 'P-005', status: 'active' }, U3: { sid: 'P-003', status: 'active' } },
    gcal_tokens: { U1: { rt: 'RT' } },
    data: { user_dir: { v: { a: { sid: 'P-005', name: '박한별' } } }, gcal_mail_sid: { v: { 'boss@x,com': 'P-001' } },
      my_schedules: { v: o.linked ? { s9: 줄({ id: 's9', movedToGcal: true, gcalEventId: 'GEV9', revision: 2 }) } : {} } },
  });
  const sent = [];
  const cur = Object.assign({ id: 'GEV9', summary: '옛', creator: { email: 'boss@x.com' }, attendees: [{ email: 'a@b.c' }],
    start: { dateTime: '2026-10-12T10:00:00+09:00' }, end: { dateTime: '2026-10-12T11:00:00+09:00' },
    extendedProperties: { shared: { puSid: 'P-005' } } }, o.cur || {});
  const fetch = async (url, opt) => {
    sent.push({ url, opt: opt || {} });
    if (/oauth2/.test(url)) return ok({ access_token: 'AT' });
    const m = (opt && opt.method) || 'GET';
    if (m === 'GET') return ok(cur);
    if (m === 'PUT') return ok(Object.assign({}, JSON.parse(opt.body), { id: 'GEV9' }));
    if (m === 'DELETE') return { ok: true, status: 204, json: async () => null };
    return { ok: false, status: 500, json: async () => null };
  };
  const R = P({ functions: { region: () => ({ runWith: () => ({ database: { ref: () => ({ onWrite: (f) => f }) }, https: { onRequest: (f) => f } }) }) },
    getDatabase: () => db, fetch, secretOf: () => 'GOCSPX-xxxxxxxxxxxxxxxxxxxx', clientId: 'CID' });
  return { db, sent, R };
}
const 고칠칸 = { date: '2026-10-13', time: '15:00', endTime: '16:00', title: '고친 제목', place: '천안시청', contact: '', note: '새 메모', sid: 'P-005' };

test('⑨ 본인 일정만 · 관리자는 모두 · 담당 바꾸기는 관리자만', async () => {
  const a = editRig();
  assert.strictEqual((await a.R.editOne('U5', { action: 'update', eventId: 'GEV9', fields: 고칠칸 })).ok, true, '본인');
  await assert.rejects(a.R.editOne('U3', { action: 'update', eventId: 'GEV9', fields: 고칠칸 }), /본인 일정만/);
  await assert.rejects(a.R.editOne('U3', { action: 'delete', eventId: 'GEV9' }), /본인 일정만/);
  assert.strictEqual((await a.R.editOne('U1', { action: 'delete', eventId: 'GEV9' })).ok, true, '관리자');
  await assert.rejects(a.R.editOne('U5', { action: 'update', eventId: 'GEV9', fields: Object.assign({}, 고칠칸, { sid: 'P-003' }) }), /관리자만/);
  await assert.rejects(a.R.editOne('U5', { action: 'update', eventId: '../x', fields: 고칠칸 }), /번호가 이상/);
  const b = editRig({ cur: { extendedProperties: undefined, creator: { email: 'nobody@x.com' } } });
  await assert.rejects(b.R.editOne('U5', { action: 'update', eventId: 'GEV9', fields: 고칠칸 }), /관리자만 고칠 수/);
  const put = a.sent.find((x) => x.opt.method === 'PUT');
  const body = JSON.parse(put.opt.body);
  assert.deepStrictEqual(body.attendees, [{ email: 'a@b.c' }], '참석자가 날아갔다');
  assert.match(body.description, /새 메모\n푸른 담당: 박한별 \(P-005\)/);
});

test('⑩ 이어진 이알피 줄도 함께 — 고치면 같은 칸, 지우면 삭제표시', async () => {
  const a = editRig({ linked: true });
  const r = await a.R.editOne('U5', { action: 'update', eventId: 'GEV9', fields: 고칠칸 });
  assert.strictEqual(r.linked, true);
  const rec = a.db.data.data.my_schedules.v.s9;
  assert.strictEqual(rec.title, '고친 제목'); assert.strictEqual(rec.date, '2026-10-13'); assert.strictEqual(rec.place, '천안시청');
  assert.strictEqual(rec.gcalEditAt, rec.updatedAt, '서버가 맞춘 표');
  assert.strictEqual(rec.revision, 3);
  const b = editRig({ linked: true });
  await b.R.editOne('U5', { action: 'delete', eventId: 'GEV9' });
  const del = b.db.data.data.my_schedules.v.s9;
  assert.strictEqual(del._deleted, true); assert.match(del.deletedBy, /^gcal-edit:P-005$/);
  assert.ok(b.sent.some((x) => x.opt.method === 'DELETE' && /\/events\/GEV9\?/.test(x.url)));
});

test('⑪ 이알피에서 고치면 구글도 — 화면 고치기가 맞춘 것은 다시 안 보낸다', async () => {
  const a = editRig({ linked: true });
  const before = a.db.data.data.my_schedules.v.s9;
  const after = Object.assign({}, before, { title: '이알피에서 고침', updatedAt: 5 });
  assert.strictEqual((await a.R.syncEdit('s9', before, after)).done, true);
  assert.strictEqual(JSON.parse(a.sent.find((x) => x.opt.method === 'PUT').opt.body).summary, '이알피에서 고침');
  const n = a.sent.length;
  assert.strictEqual((await a.R.syncEdit('s9', before, Object.assign({}, after, { gcalEditAt: 5 }))).why, 'from-edit');
  assert.strictEqual((await a.R.syncEdit('s9', before, Object.assign({}, before, { gcalSyncedAt: 9 }))).why, 'same', '내용 안 바뀜');
  assert.strictEqual((await a.R.syncEdit('s9', 줄(), Object.assign(줄(), { title: 'x' }))).why, 'skip', '안 옮긴 줄');
  assert.strictEqual(a.sent.length, n, '보내지 말아야 할 때 보냈다');
});

test('⑫ 화면 — 상세 ✏️·🗑, 고치는 창은 서버로', () => {
  assert.match(캘린더, /data-gedit="1"/);
  assert.match(캘린더, /data-gdel="1"/);
  assert.match(캘린더, /if\(m\.store === "gcal"\)\{ 구글고치기\(m\); return; \}/);
  assert.match(캘린더, /if\(m\.store === "gcal"\)\{ 구글지우기\(m\.gid, m\.title\); return; \}/);
  assert.match(캘린더, /callServer\("gcalEdit"/);
  assert.match(캘린더, /gStart: ev\.start\.dateTime/);
  const idx = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');
  assert.match(idx, /exports\.gcalEdit\s*=/);
});

/* ══ 여러 날 일정 · 연결 끊김 알림 (2026-10-10 「추천대로」) ══════════════════ */

test('⑬ 여러 날 — 화면과 서버가 같은 셈, 끝나는 날 검사', () => {
  const 경우 = [
    { date: '2026-10-12', endDate: '2026-10-14', time: '', endTime: '', summary: '종일 사흘' },
    { date: '2026-10-12', endDate: '2026-10-14', time: '14:00', endTime: '10:00', summary: '시각 여러 날(끝이 더 이른 시각)' },
    { date: '2026-10-12', endDate: '2026-10-13', time: '09:00', endTime: '', summary: '끝 시각 없음' },
    { date: '2026-10-12', endDate: '2026-10-12', time: '09:00', endTime: '10:00', summary: '같은 날' },
  ];
  for (const e of 경우) assert.deepStrictEqual(P.bodyOf(e), AUTH.bodyOf(e), e.summary);
  assert.deepStrictEqual(P.bodyOf(경우[0]).end, { date: '2026-10-15' }, '종일은 다음 날(끝 안 듦)');
  assert.strictEqual(P.bodyOf(경우[1]).end.dateTime, '2026-10-14T10:00:00');
  assert.strictEqual(P.cleanFields({ date: '2026-10-12', endDate: '2026-10-14', title: 't' }).endDate, '2026-10-14');
  assert.strictEqual(P.cleanFields({ date: '2026-10-12', endDate: '2026-10-12', title: 't' }).endDate, '', '같은 날은 하루짜리');
  assert.throws(() => P.cleanFields({ date: '2026-10-12', endDate: '2026-10-11', title: 't' }), /끝나는 날이 시작보다 앞/);
  assert.match(캘린더, /data-m=\\"endDate\\"/);
  assert.match(캘린더, /\["kind","date","endDate",/);
  assert.match(캘린더, /끝나는 날이 시작보다 앞입니다/);
});

test('⑭ 대표 구글 연결이 끊기면 대표 폰으로 — 12시간에 한 번, 버린 열쇠는 지운다', async () => {
  const pushes = [];
  function rig(tokens, tokenReply) {
    const db = fakeDb({ uid_roles: { U1: { sid: 'P-001', status: 'active', isAdmin: true } }, gcal_tokens: tokens,
      fcm_tokens: { U1: { PHONE: true } }, data: { user_dir: { v: {} }, my_schedules: { v: { sch_1: 줄() } } } });
    const R = P({ functions: { region: () => ({ runWith: () => ({ database: { ref: () => ({ onWrite: (f) => f }) }, https: { onRequest: (f) => f } }) }) },
      getDatabase: () => db, secretOf: () => 'GOCSPX-xxxxxxxxxxxxxxxxxxxx', clientId: 'CID',
      fetch: async (url) => /oauth2/.test(url) ? tokenReply() : ok({ id: 'G' }),
      getMessaging: () => ({ sendEachForMulticast: async (m) => { pushes.push(m); return { successCount: 1, failureCount: 0, responses: [{}] }; } }) });
    return { db, R };
  }
  const 버림 = () => ({ ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) });
  const a = rig({ U1: { rt: 'RT' } }, 버림);
  const r = await a.R.proxyOne('sch_1', 줄());
  assert.strictEqual(r.done, false);
  assert.match(a.db.data.data.my_schedules.v.sch_1.gcalProxyErr, /구글 연결을 다시/);
  assert.ok(!a.db.data.gcal_tokens.U1, '버린 열쇠를 안 지웠다');
  assert.strictEqual(pushes.length, 1);
  assert.match(pushes[0].data.title, /구글 연결이 끊겼습니다/);
  await a.R.proxyOne('sch_1', 줄());
  assert.strictEqual(pushes.length, 1, '12시간 안에 또 울렸다');
  const b = rig({}, 버림);                       /* 처음부터 연결 없음 */
  await b.R.proxyOne('sch_1', 줄());
  assert.strictEqual(pushes.length, 2);
  const c = rig({ U1: { rt: 'RT' } }, () => ({ ok: false, status: 503, json: async () => ({ error: 'backend' }) }));
  await c.R.proxyOne('sch_1', 줄());
  assert.strictEqual(pushes.length, 2, '잠깐 고장(503)에 끊김 알림을 보냈다');
  assert.ok(c.db.data.gcal_tokens.U1, '잠깐 고장에 열쇠를 지웠다');
});
