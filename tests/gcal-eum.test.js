/* 🏛 이음센터 근무 → 구글 공용 달력 «거울» (2026-11-02)
   ═════════════════════════════════════════════════════════════════
   대표 질문 「이음센터 근무가 왜 구글 캘린더와 연결이 안되나?」 → 「1」(구글 공용 달력에 새로 넣기).

   ★ 이 검사가 지키는 것
     ① 구글 일정 번호는 기록 번호에서 «정해진 값»이다 — 두 번 넣어도 한 건 · 지울 때도 셈해서 지운다
     ② 넣는 것은 «이름·날짜»뿐 — 이음 근무만 · 지운 것/날짜 없음/이름 없음은 안 넣는다 · 외부 협력자는 스위치가 켜져야
     ③ 만들기 · 이미 있으면(409) 덮어쓰기 · 날짜가 바뀌면 옮기기 · 지우면(지움표·통째로·종류가 바뀜) 구글도 지우기
     ④ 우리 기록에는 «아무것도 안 적는다» — 표를 달지 않으니 순환이 없다. 실패는 gcal_proxy/eumErr 에만
     ⑤ 구글에 보이는 것이 안 바뀌면(시간·메모) DB 도 구글도 안 건드린다 · 이음 근무가 아닌 기록은 읽자마자 돌려보낸다
     ⑥ 한꺼번에 채우기는 기본이 «셈만»(dryRun) · 관리자만
     ⑦ 순환 방지 — 근태관리 「캘린더 연동」(gcalAttClassify)이 이 제목을 근태로 되읽지 않는다(실제 함수로 잰다)
     ⑧ 화면 — 구글 일정이 우리 기록의 거울이면(puEum) 기록이 살아 있을 때 구글 사본은 안 그린다 · 구글만 거르개에서는 그대로
   ⚠ 날짜는 고정 날짜를 박지 않는다(기록 안의 값은 «그 검사 안의 가짜 값»이라 상관없다). */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const E = require(path.join(ROOT, 'functions', 'gcal-eum.js'));
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');
const 이알피 = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const 색인 = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8');

function 함수몸(원문, head) {
  const i = 원문.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = 원문.indexOf('{', i); k < 원문.length; k++) {
    if (원문[k] === '{') d++;
    else if (원문[k] === '}') { d--; if (d === 0) return 원문.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

const 이름 = (sid) => ({ 'P-005': '박한별', 'P-007': '연조희' })[sid] || '';
const 외부이름 = (id) => ({ EX1: '김완재' })[id] || '';
const 기록 = (o) => Object.assign({ id: 'att_1', type: 'eum-work', sid: 'P-005', date: '2030-03-04', hours: 8, note: '' }, o || {});

/* ─ ① 번호 ─ */
test('① 구글 일정 번호 — 기록 번호에서 정해진 값 · 구글이 받는 글자(a-v·0-9, 5자 이상) · 서로 다른 기록은 다른 번호', () => {
  const a = E.eventIdOf('att_1');
  assert.strictEqual(a, E.eventIdOf('att_1'), '같은 기록이 다른 번호가 됐다');
  assert.notStrictEqual(a, E.eventIdOf('att_2'));
  assert.ok(/^[a-v0-9]{5,1024}$/.test(a), '구글이 받지 않는 글자: ' + a);
});

/* ─ ② 넣을 것 ─ */
test('② 넣는 일정 — 「이름 이음센터」 · 종일 하루 · 설명 없음 · 한가함 · shared 에 기록 번호와 사번', () => {
  const ev = E.eumEventOf(기록(), 'att_1', 이름, 외부이름);
  assert.strictEqual(ev.summary, '박한별 이음센터');
  assert.deepStrictEqual(ev.start, { date: '2030-03-04' });
  assert.deepStrictEqual(ev.end, { date: '2030-03-05' }, '종일은 끝이 «다음 날»(구글 규칙)');
  assert.strictEqual(ev.transparency, 'transparent');
  assert.deepStrictEqual(ev.extendedProperties.shared, { puEum: 'att_1', puSid: 'P-005' });
  assert.strictEqual(ev.id, E.eventIdOf('att_1'));
  const 글 = JSON.stringify(ev);
  assert.ok(!('description' in ev) && !('location' in ev) && !('attendees' in ev), '이름·날짜 말고 더 나갔다');
  assert.ok(!/hours|note/.test(글), '근무 시간·메모가 구글로 나갔다');
});

test('② 넣지 않는 것 — 이음 근무가 아닌 기록 · 지운 것 · 날짜 없음 · 이름 없음 · 사번 아닌 것', () => {
  ['leave', 'trip', 'telework', 'halfday-am', 'sick'].forEach((type) =>
    assert.strictEqual(E.eumEventOf(기록({ type }), 'a', 이름, 외부이름), null, type));
  assert.strictEqual(E.eumEventOf(기록({ _deleted: true }), 'a', 이름, 외부이름), null);
  assert.strictEqual(E.eumEventOf(기록({ date: '' }), 'a', 이름, 외부이름), null);
  assert.strictEqual(E.eumEventOf(기록({ date: '내일' }), 'a', 이름, 외부이름), null);
  assert.strictEqual(E.eumEventOf(기록({ sid: 'P-999' }), 'a', 이름, 외부이름), null, '이름을 못 찾으면 이름 없는 일정을 만들지 않는다');
  assert.strictEqual(E.eumEventOf(기록({ sid: '박한별' }), 'a', 이름, 외부이름), null);
  assert.strictEqual(E.eumEventOf(null, 'a', 이름, 외부이름), null);
});

test('② 외부 협력자 — 스위치가 꺼져 있으면 안 넣고(기본), 켜면 이름으로 넣는다(사번 없음)', () => {
  const 외 = 기록({ sid: undefined, externalId: 'EX1' });
  assert.strictEqual(E.INCLUDE_EXTERNAL, false, '기본이 켜져 있다 — 공용 달력은 누구나 읽는다 [대표 결정 전]');   // 검사고정-허용: 공용(공개) 달력에 외부인 이름을 내보내는 스위치 — 대표 결정 전까지 «끔»이 규칙
  assert.strictEqual(E.eumEventOf(외, 'a', 이름, 외부이름), null);
  const ev = E.eumEventOf(외, 'a', 이름, 외부이름, true);
  assert.strictEqual(ev.summary, '김완재 이음센터');
  assert.deepStrictEqual(ev.extendedProperties.shared, { puEum: 'att_1' }, '외부인은 사번이 없다');
  assert.strictEqual(E.eumEventOf(기록({ sid: undefined, externalId: 'NOPE' }), 'a', 이름, 외부이름, true), null, '이름 모름');
});

/* ─ 가짜 환경 ─ */
function 가짜(옵션) {
  const o = 옵션 || {};
  const data = { data: { user_dir: { v: { a: { sid: 'P-005', name: '박한별' }, b: { sid: 'P-007', name: '연조희' } } },
    external_staff: { v: { x: { id: 'EX1', name: '김완재' } } }, attendance_records: { v: o.기록들 || {} } } };
  const get = (p) => p.split('/').reduce((n, k) => (n == null ? undefined : n[k]), data);
  const set = (p, v) => { const ks = p.split('/'); let n = data; ks.slice(0, -1).forEach((k) => { n[k] = n[k] || {}; n = n[k]; }); n[ks[ks.length - 1]] = v; };
  const db = { data, ref: (p) => ({
    once: async () => ({ val: () => get(p) ?? null }),
    set: async (v) => set(p, v),
    update: async (u) => { Object.keys(u).forEach((k) => set(p + '/' + k, u[k])); },
    remove: async () => { const ks = p.split('/'); const n = get(ks.slice(0, -1).join('/')); if (n) delete n[ks[ks.length - 1]]; },
  }) };
  const sent = [];
  const fetch = async (url, opt) => { sent.push({ url, opt }); return o.응답 ? o.응답(url, opt) : { ok: true, status: 200, json: async () => ({}) }; };
  const refs = [];
  let 열쇠불림 = 0, DB불림 = 0;
  const R = E({ functions: { region: () => ({ runWith: () => ({ database: { ref: (p) => { refs.push(p); return { onWrite: (f) => f }; } }, https: { onRequest: (f) => f } }) }) },
    getDatabase: () => { DB불림++; return db; }, fetch, ownerAccess: async () => { 열쇠불림++; return 'AT'; },
    includeExternal: o.외부, verifyIdToken: o.토큰 });
  return { db, sent, R, refs, 불림: () => ({ 열쇠: 열쇠불림, DB: DB불림 }) };
}
const 호출 = (x, 방법) => x.sent.filter((r) => (r.opt.method || 'GET') === 방법);

/* ─ ③ 만들기·덮어쓰기·옮기기·지우기 ─ */
test('③ 새 이음 근무 → 구글에 만든다 (번호 지정 · 보내는 몸은 거울 일정)', async () => {
  const x = 가짜();
  const r = await x.R.syncOne('att_1', null, 기록());
  assert.deepStrictEqual([r.done, r.what], [true, 'created']);
  const post = 호출(x, 'POST')[0];
  assert.match(post.url, /euh07th7tvlco9corqen9lqpts%40group\.calendar\.google\.com\/events\?sendUpdates=none$/);
  assert.strictEqual(post.opt.headers.Authorization, 'Bearer AT');
  const 몸 = JSON.parse(post.opt.body);
  assert.strictEqual(몸.id, E.eventIdOf('att_1'));
  assert.strictEqual(몸.summary, '박한별 이음센터');
});

test('③ 이미 있으면(409) 덮어쓴다 — 지웠던 번호도 되살린다(status:confirmed)', async () => {
  const x = 가짜({ 응답: (url, opt) => ((opt.method || 'GET') === 'POST' ? { ok: false, status: 409, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({}) }) });
  const r = await x.R.syncOne('att_1', null, 기록());
  assert.deepStrictEqual([r.done, r.what], [true, 'updated']);
  const put = 호출(x, 'PUT')[0];
  assert.match(put.url, new RegExp('/events/' + E.eventIdOf('att_1') + '\\?sendUpdates=none$'));
  assert.strictEqual(JSON.parse(put.opt.body).status, 'confirmed');
});

test('③ 날짜(또는 사람)가 바뀌면 같은 번호로 옮긴다', async () => {
  const x = 가짜({ 응답: (url, opt) => ((opt.method || 'GET') === 'POST' ? { ok: false, status: 409, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({}) }) });
  await x.R.syncOne('att_1', 기록(), 기록({ date: '2030-03-11' }));
  const 몸 = JSON.parse(호출(x, 'PUT')[0].opt.body);
  assert.deepStrictEqual(몸.start, { date: '2030-03-11' });
  assert.strictEqual(몸.id, E.eventIdOf('att_1'), '번호가 달라지면 옛 일정이 구글에 남는다');
});

test('③ 사람만 바뀌어도(날짜는 그대로) 구글 일정을 고친다 — 안 그러면 옛 사람 이름이 남는다', async () => {
  const x = 가짜({ 응답: (url, opt) => ((opt.method || 'GET') === 'POST' ? { ok: false, status: 409, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({}) }) });
  const r = await x.R.syncOne('att_1', 기록(), 기록({ sid: 'P-007' }));
  assert.strictEqual(r.done, true);
  assert.strictEqual(JSON.parse(호출(x, 'PUT')[0].opt.body).summary, '연조희 이음센터');
});

test('③ 지우면 구글도 지운다 — 지움표 · 통째로 · 이음 근무가 아니게 바뀜 · 구글에 이미 없음(404)도 끝난 것', async () => {
  for (const 뒤 of [기록({ _deleted: true }), null, 기록({ type: 'leave' })]) {
    const x = 가짜({ 응답: () => ({ ok: true, status: 204, json: async () => null }) });
    const r = await x.R.syncOne('att_1', 기록(), 뒤);
    assert.deepStrictEqual([r.done, r.what], [true, 'removed']);
    assert.match(호출(x, 'DELETE')[0].url, new RegExp('/events/' + E.eventIdOf('att_1') + '\\?sendUpdates=none$'));
  }
  const g = 가짜({ 응답: () => ({ ok: false, status: 404, json: async () => null }) });
  assert.strictEqual((await g.R.syncOne('att_1', 기록(), null)).done, true);
  const h = 가짜({ 응답: () => ({ ok: false, status: 500, json: async () => null }) });
  assert.strictEqual((await h.R.syncOne('att_1', 기록(), null)).done, false, '구글이 못 지웠는데 지웠다고 한다');
});

/* ─ ④ 기록은 안 건드린다 · 실패는 따로 ─ */
test('④ 우리 기록에는 아무것도 안 적는다 — 성공해도 실패해도 attendance_records 는 그대로', async () => {
  const 원 = { att_1: 기록() };
  const ok = 가짜({ 기록들: JSON.parse(JSON.stringify(원)) });
  await ok.R.syncOne('att_1', null, 기록());
  assert.deepStrictEqual(ok.db.data.data.attendance_records.v, 원, '성공했는데 기록이 바뀌었다 — 표를 달면 순환이 시작된다');
  const bad = 가짜({ 기록들: JSON.parse(JSON.stringify(원)), 응답: () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'forbidden' } }) }) });
  const r = await bad.R.syncOne('att_1', null, 기록());
  assert.strictEqual(r.done, false);
  assert.deepStrictEqual(bad.db.data.data.attendance_records.v, 원);
  assert.match(bad.db.data.gcal_proxy.eumErr.att_1.msg, /forbidden/);
});

test('④ 실패를 적었다가 다시 성공하면 실패 표시를 지운다', async () => {
  const x = 가짜();
  x.db.data.gcal_proxy = { eumErr: { att_1: { msg: '옛 실패', at: 1 } } };
  await x.R.syncOne('att_1', null, 기록());
  assert.ok(!x.db.data.gcal_proxy.eumErr.att_1, '성공했는데 실패 표시가 남았다');
});

/* ─ ⑤ 아무것도 안 하는 때 ─ */
test('⑤ 구글에 보이는 것이 안 바뀌면(시간·메모) 구글도 DB 도 안 부른다', async () => {
  const x = 가짜();
  const r = await x.R.syncOne('att_1', 기록(), 기록({ hours: 4, note: '오후 반차 아님' }));
  assert.strictEqual(r.why, 'same');
  assert.strictEqual(x.sent.length, 0);
  assert.deepStrictEqual(x.불림(), { 열쇠: 0, DB: 0 }, '바뀐 것이 없는데 DB·열쇠를 불렀다');
});

test('⑤ 이음 근무가 아닌 기록은 읽자마자 돌려보낸다 — 연차·출장 기록이 구글을 부르면 안 된다', async () => {
  const x = 가짜();
  assert.strictEqual((await x.R.syncOne('a', null, 기록({ type: 'leave' }))).why, 'skip');
  assert.strictEqual((await x.R.syncOne('a', 기록({ type: 'trip' }), 기록({ type: 'trip', date: '2030-04-01' }))).why, 'skip');
  assert.strictEqual(x.sent.length, 0);
  assert.deepStrictEqual(x.불림(), { 열쇠: 0, DB: 0 });
  const 일 = x.R.gcalEum;
  await 일({ before: { exists: () => true, val: () => 기록({ type: 'leave' }) }, after: { exists: () => true, val: () => 기록({ type: 'leave', note: 'x' }) } }, { params: { id: 'a' } });
  assert.deepStrictEqual(x.불림(), { 열쇠: 0, DB: 0 }, '트리거가 이음 근무가 아닌 기록에서 DB 를 불렀다');
});

test('⑤ 트리거가 attendance_records/v/{id} 하나에 걸려 있다', () => {
  const x = 가짜();
  assert.ok(x.refs.indexOf('/data/attendance_records/v/{id}') >= 0, x.refs.join(','));
});

/* ─ ⑥ 한꺼번에 채우기 ─ */
const 여럿 = () => ({
  a1: 기록({ id: 'a1', date: '2030-02-01' }), a2: 기록({ id: 'a2', date: '2030-03-05' }), a3: 기록({ id: 'a3', date: '2030-03-06', sid: 'P-007' }),
  a4: 기록({ id: 'a4', date: '2030-03-07', type: 'leave' }), a5: 기록({ id: 'a5', date: '2030-03-08', _deleted: true }),
  a6: 기록({ id: 'a6', date: '2030-03-09', sid: undefined, externalId: 'EX1' }), a7: 기록({ id: 'a7', date: '2030-03-10', sid: 'P-999' }),
});

test('⑥ 채우기 — 기본은 셈만(구글을 안 부른다) · 어느 날부터인지 없으면 거절 · 지난 것·외부·이름없음은 센다', async () => {
  const x = 가짜({ 기록들: 여럿() });
  const r = await x.R.backfill({ from: '2030-03-01' });
  assert.deepStrictEqual([r.dryRun, r.total, r.외부제외, r.이름없음], [true, 2, 1, 1]);
  assert.strictEqual(x.sent.length, 0, '셈만 한다더니 구글을 불렀다');
  assert.deepStrictEqual(x.불림().열쇠, 0);
  await assert.rejects(() => x.R.backfill({}), /from/);
  assert.strictEqual((await x.R.backfill({ from: '2030-03-01', dryRun: undefined })).dryRun, true, 'dryRun 을 안 적으면 셈만');
});

test('⑥ 채우기 — 정말 넣을 때: 만든 수·덮어쓴 수·실패 수 · 실패한 기록은 eumErr 에', async () => {
  let n = 0;
  const x = 가짜({ 기록들: 여럿(), 응답: (url, opt) => {
    if ((opt.method || 'GET') === 'POST') {
      n++;
      const id = JSON.parse(opt.body).extendedProperties.shared.puEum;
      if (id === 'a3') return { ok: false, status: 409, json: async () => ({}) };
      if (id === 'a2' && n > 100) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  } });
  const r = await x.R.backfill({ from: '2030-01-01', dryRun: false });
  assert.deepStrictEqual([r.total, r.created, r.updated, r.failed], [3, 2, 1, 0]);
  const 몸들 = 호출(x, 'POST').map((p) => JSON.parse(p.opt.body).extendedProperties.shared.puEum).sort();
  assert.deepStrictEqual(몸들, ['a1', 'a2', 'a3']);
  assert.deepStrictEqual(x.db.data.data.attendance_records.v, 여럿(), '채우다가 기록을 건드렸다');
  const y = 가짜({ 기록들: 여럿(), 응답: () => ({ ok: false, status: 500, json: async () => ({}) }) });
  const r2 = await y.R.backfill({ from: '2030-01-01', dryRun: false });
  assert.strictEqual(r2.failed, 3);
  assert.ok(y.db.data.gcal_proxy.eumErr.a1 && y.db.data.gcal_proxy.eumErr.a2);
});

function 가짜응답() {
  const r = { 헤더: {}, 상태: 200, 몸: null };
  const res = { set: (k, v) => { r.헤더[k] = v; return res; }, status: (c) => { r.상태 = c; return res; }, json: (b) => { r.몸 = b; return res; }, send: (b) => { r.몸 = b; return res; } };
  return { res, r };
}
test('⑥ 채우기 길 — 로그인 없으면 401 · 관리자가 아니면 403 · 관리자는 기본 셈만', async () => {
  const x = 가짜({ 기록들: 여럿(), 토큰: async (t) => { if (t === 'GOOD') return { uid: 'U1' }; if (t === 'STAFF') return { uid: 'U2' }; throw new Error('bad'); } });
  x.db.data.uid_roles = { U1: { sid: 'P-001', status: 'active', isAdmin: true }, U2: { sid: 'P-005', status: 'active' } };
  const 부르기 = async (헤더, 몸) => { const g = 가짜응답(); await x.R.gcalEumBackfill({ method: 'POST', headers: 헤더, body: 몸 }, g.res); return g.r; };
  assert.strictEqual((await 부르기({}, {})).상태, 401);
  assert.strictEqual((await 부르기({ authorization: 'Bearer BAD' }, {})).상태, 401);
  assert.strictEqual((await 부르기({ authorization: 'Bearer STAFF' }, { from: '2030-01-01' })).상태, 403);
  assert.strictEqual(x.sent.length, 0);
  const 관 = await 부르기({ authorization: 'Bearer GOOD' }, { from: '2030-01-01' });
  assert.deepStrictEqual([관.몸.ok, 관.몸.dryRun, 관.몸.total], [true, true, 3]);
  assert.strictEqual(x.sent.length, 0, '관리자가 dryRun 을 안 적었는데 구글을 불렀다');
  const g = 가짜응답();
  await x.R.gcalEumBackfill({ method: 'GET', headers: {}, body: {} }, g.res);
  assert.strictEqual(g.r.상태, 405);
});

/* ─ ⑦ 순환 방지 ─ */
test('⑦ 근태관리 「캘린더 연동」이 이음 근무 제목을 근태로 되읽지 않는다 — 실제 분류 함수로', () => {
  const 분류 = new Function(함수몸(이알피, 'function gcalAttClassify(title){') + '\nreturn gcalAttClassify;')();
  ['박한별', '연조희', '김완재', '재현', '오승민', '장한돌', '이상희'].forEach((n) => {
    const 제목 = n + ' 이음센터';
    assert.strictEqual(분류(제목), null, '「' + 제목 + '」이 근태로 읽힌다 — 근무일이 두 배로 센다');
  });
  const 실제 = E.eumEventOf(기록(), 'a', 이름, 외부이름).summary;
  assert.strictEqual(분류(실제), null);
  assert.ok(!/[()（）]/.test(실제), '괄호가 들어가면 출장 알림(titleMarks)이 읽을 수 있다');
  assert.ok(분류('홍길동 연차') !== null, '검사용 분류 함수가 실제로 도는지 확인');
});

/* ─ 연결 ─ */
test('연결 — index.js 가 gcal-proxy 의 대표 연결(ownerAccess)을 넘겨 두 함수를 내보낸다 · gcal-proxy 가 그것을 내놓는다', () => {
  assert.ok(/require\("\.\/gcal-eum"\)\(\{[^}]*ownerAccess: GPROXY\.ownerAccess[^}]*\}\)/.test(색인));
  assert.ok(/exports\.gcalEum = GEUM\.gcalEum;/.test(색인) && /exports\.gcalEumBackfill = GEUM\.gcalEumBackfill;/.test(색인));
  assert.ok(/return \{[^}]*\bownerAccess\b[^}]*\};/.test(fs.readFileSync(path.join(ROOT, 'functions', 'gcal-proxy.js'), 'utf8')));
});

/* ─ ⑧ 화면 ─ */
const 상자 = { String, Array, Object, Date, JSON, RegExp, Math, parseInt, isFinite };
vm.createContext(상자);
vm.runInContext(함수몸(캘린더, 'function arr(v){'), 상자);
vm.runInContext(함수몸(캘린더, 'function eventsOn(ymd, eumOnly){'), 상자);
vm.runInContext(캘린더.match(/var ATT_SHOW = \[[^\]]+\];/)[0], 상자);
const 실행 = (식) => vm.runInContext(식, 상자);

function 화면(필터, 구글, 기록들) {
  상자.D = { my_schedules: [], cal_private: [], attendance_records: 기록들 };
  상자.GCAL = { evs: 구글, err: '' };
  상자.S = { filter: 필터 };
  상자.nameOf = (sid) => ({ 'P-005': '박한별' })[sid] || '';
  상자.externalOf = () => null;
  상자.colorOf = () => '#123456';
  상자.passFilter = () => true;
}
const 거울 = (id, rec) => ({ kind: 'gcal', store: 'gcal', id, date: '2030-03-04', end: '2030-03-04', text: '박한별 이음센터', eumRec: rec });

test('⑧ 거울 구글 사본 — 우리 기록이 살아 있으면 안 그린다(기록 칩 한 개만)', () => {
  화면(null, [거울('g1', 'att_1')], [기록()]);
  const 목록 = JSON.parse(JSON.stringify(실행('eventsOn("2030-03-04", false)')));
  assert.strictEqual(목록.filter((e) => e.kind === 'eum').length, 1);
  assert.strictEqual(목록.filter((e) => e.kind === 'gcal').length, 0, '두 번 뜬다');
});

test('⑧ 기록이 없거나 지워졌으면 구글 사본이 보인다 — 거울이 «혼자 남은 것»을 숨기면 안 된다', () => {
  화면(null, [거울('g1', 'att_1')], []);
  assert.strictEqual(실행('eventsOn("2030-03-04", false).filter(function(e){return e.kind==="gcal";}).length'), 1);
  화면(null, [거울('g1', 'att_1')], [기록({ _deleted: true })]);
  assert.strictEqual(실행('eventsOn("2030-03-04", false).filter(function(e){return e.kind==="gcal";}).length'), 1);
  화면(null, [거울('g1', 'att_9')], [기록()]);
  assert.strictEqual(실행('eventsOn("2030-03-04", false).filter(function(e){return e.kind==="gcal";}).length'), 1, '다른 기록의 거울이다');
});

test('⑧ 같은 번호라도 이음 근무가 아닌 기록(연차 등)은 거울을 숨기지 않는다', () => {
  화면(null, [거울('g1', 'att_1')], [기록({ type: 'leave' })]);
  assert.strictEqual(실행('eventsOn("2030-03-04", false).filter(function(e){return e.kind==="gcal";}).length'), 1);
});

test('⑧ 일반 구글 일정(거울이 아닌 것)은 그대로 · 구글만 거르개에서는 거울도 보인다', () => {
  화면(null, [{ kind: 'gcal', store: 'gcal', id: 'g2', date: '2030-03-04', end: '2030-03-04', text: '평범한 일정', eumRec: '' }], [기록()]);
  assert.strictEqual(실행('eventsOn("2030-03-04", false).filter(function(e){return e.kind==="gcal";}).length'), 1);
  화면('gcal', [거울('g1', 'att_1')], [기록()]);
  assert.strictEqual(실행('eventsOn("2030-03-04", false).filter(function(e){return e.kind==="gcal";}).length'), 1);
});

test('⑧ 구글 일정을 우리 칩으로 바꿀 때 shared.puEum 을 들고 온다 — 안 그러면 거름이 안 먹는다', () => {
  assert.ok(/eumRec:\s*\(ev\.extendedProperties && ev\.extendedProperties\.shared && ev\.extendedProperties\.shared\.puEum\)/.test(캘린더));
});
