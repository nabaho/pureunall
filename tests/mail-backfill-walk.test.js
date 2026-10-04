/* 📦 지난 메일 채우기 — «한 회차를 실제로 돌려 본다» (2026-10-04 검토)
   ═══════════════════════════════════════════════════════════════════════════
   가짜 POP3 와 가짜 실시간DB를 끼워 runBackfill 을 돌린다. 다음메일에는 붙지 않는다.

   ⚠ 왜 글자만 보는 검사(mail-backfill-pop)로는 모자라나 — 여기서 틀리는 것은
     «이어 갈 자리(curId)가 어디에 적히나»다. 한 회차 로그는 멀쩡하고(ok: true),
     다음 회차에 「가장 옛 메일까지 다 받았습니다」가 뜨는데, 실제로는 몇 천 통이 빠져 있다.
   잡는 구멍 둘.
   ① 연결이 중간에 끊기면 남은 통을 «한 통 실패»로 세고 다 지나가 바닥을 curId 로 적었다
   ② 목표를 넓힐 때(1년→3년→10년) 문턱 언저리의 옛것 예순 통을 다시 안 봤다

   예시는 가짜다 — 가나상사 · 홍길동 · test@example.com. */
const test = require('node:test');
const assert = require('node:assert/strict');
const MS = require('../functions/mail-sync.js');

const DAY = 86400000;
const NOW = Date.now();

/* ── 가짜 실시간DB ── (tests/mail-sync-run.test.js 와 같은 결 — 층을 실제처럼 만든다) */
function fakeDb(seed) {
  const data = seed || {};
  const get = (p) => (p ? String(p).split('/').reduce((o, k) => (o == null ? null : o[k]), data) : data);
  const put = (p, v) => {
    const ks = String(p).split('/');
    let o = data;
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {};
      o = o[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (v === null) delete o[last]; else o[last] = v;
  };
  function ref(path) {
    const p = path === undefined ? '' : String(path);
    return {
      once: async () => ({ val: () => { const v = get(p); return v == null ? null : JSON.parse(JSON.stringify(v)); } }),
      update: async (obj) => { Object.keys(obj).forEach((k) => put(p ? p + '/' + k : k, obj[k])); },
    };
  }
  return { ref, get };
}

/* ── 가짜 메일 ── 앞(0)이 옛것, 뒤가 새것 — 다음메일 POP3 번호 차례와 같다 */
function mails(n, ageDays) {
  const out = [];
  for (let k = 0; k < n; k++) {
    out.push({ id: 'UID' + String(k).padStart(5, '0'),
      date: NOW - ageDays(k) * DAY,
      from: 'test@example.com', name: '홍길동',
      subject: '가나상사 급여자료 ' + k, mid: '<m' + k + '@example.com>' });
  }
  return out;
}

/* ── 가짜 POP3 ──
   o.dieAfterTop — TOP 을 이만큼 답한 뒤 연결이 끊긴다. 끊긴 뒤에는 popOpen 처럼
                   «모든» 명령을 그 자리에서 거절한다(답이 아니라 연결이 없으므로 pop 표시 없음).
   o.errIds      — 이 이름표는 -ERR 로 답한다(연결은 살아 있다 — pop 표시가 붙는다). */
function fakePop(list, o) {
  const opt = o || {};
  let tops = 0, dead = false;
  const err = new Set(opt.errIds || []);
  const stats = { tops: 0 };
  async function cmd(text) {
    if (dead) throw new Error('연결이 끊겼습니다');
    if (text === 'STAT') return { head: '+OK ' + list.length + ' 999', body: '' };
    if (text === 'UIDL') return { head: '+OK', body: list.map((m, k) => (k + 1) + ' ' + m.id).join('\r\n') + '\r\n' };
    const t = String(text).match(/^TOP (\d+) 20$/);
    if (t) {
      if (opt.dieAfterTop != null && tops >= opt.dieAfterTop) { dead = true; throw new Error('다음메일(POP3)이 연결을 끊었습니다'); }
      tops++; stats.tops++;
      const m = list[Number(t[1]) - 1];
      if (err.has(m.id)) throw Object.assign(new Error('-ERR no such message'), { pop: true });
      return { head: '+OK', body: Buffer.from(JSON.stringify(m), 'utf8').toString('base64') };
    }
    throw new Error('검사가 모르는 명령: ' + text);
  }
  return { cmd, stats };
}
/* mailparser 대신 — 가짜 TOP 이 준 것을 그대로 푼다 */
async function parse(buf) {
  const m = JSON.parse(Buffer.from(buf.toString('binary'), 'base64').toString('utf8'));
  if (m.broken) throw new Error('깨진 머리글');
  return { date: new Date(m.date), subject: m.subject, messageId: m.mid, text: '본문 ' + m.subject,
    from: { value: [{ address: m.from, name: m.name }] }, to: { value: [{ address: 'test@example.com', name: '' }] } };
}

async function run(db, list, days, popOpt, body) {
  const st = (await db.ref('mailbox/old/state').once()).val() || {};
  const out = await MS.runBackfill({ db, pop: fakePop(list, popOpt), body: body || { again: true },
    state: st, days, cutoff: NOW - days * DAY, deadline: (popOpt && popOpt.deadline != null) ? popOpt.deadline : Infinity,
    parse });
  return out;
}
const stored = (db) => Object.keys(db.get('mailbox/old/msgs') || {});
const isFloor = (o) => Number(o.uidl) > 0 && !o.seen && !o.already && !o.got;

test('runBackfill 을 밖으로 내놓는다 — 돌려 볼 수 있어야 한다', () => {
  assert.equal(typeof MS.runBackfill, 'function');
});

/* ══════ ① 연결이 끊기면 «멈추고», 끝난 데까지만 적는다 ══════ */

test('★★★ 중간에 연결이 끊겨도 남은 메일을 건너뛰지 않는다', async () => {
  const list = mails(100, (k) => 100 - k);           /* 다 1년 안 */
  const db = fakeDb();
  const a = await run(db, list, 365, { dieAfterTop: 30 });
  assert.equal(a.lost, true, '끊긴 것을 모릅니다');
  assert.equal(a.got, 30);
  assert.ok(!a.bad, '끊긴 뒤의 통을 «못 읽은 것»으로 셉니다 — 그 통들은 건너뛴 채 지나갑니다');
  assert.ok(!a.bottom, '끊겼는데 바닥이라고 합니다');
  assert.equal(db.get('mailbox/old/state/curId'), list[70].id,
    '이어 갈 자리를 «끝난 데» 아닌 곳에 적었습니다');

  const b = await run(db, list, 365, null);
  assert.equal(b.got, 70, '다음 회차가 나머지 70통을 못 받습니다 — 영영 빠집니다');
  assert.equal(b.bottom, true);
  assert.equal(stored(db).length, 100);
  /* 그 다음은 진짜 바닥 */
  const c = await run(db, list, 365, null);
  assert.ok(isFloor(c) && c.bottom, '다 받은 뒤에 바닥이라고 안 합니다');
});

test('★★★ 맨 첫 통에서 끊겨도 자리를 «안 옮긴다»', async () => {
  const list = mails(20, (k) => 20 - k);
  const db = fakeDb({ mailbox: { old: { state: { curId: list[15].id } } } });
  const a = await run(db, list, 365, { dieAfterTop: 0 });
  assert.equal(a.lost, true);
  assert.equal(db.get('mailbox/old/state/curId'), list[15].id, '아무것도 못 했는데 자리가 옮겨졌습니다');
});

test('★★ 예산이 다해 끊겨도 자리는 그대로다', async () => {
  const list = mails(20, (k) => 20 - k);
  const db = fakeDb({ mailbox: { old: { state: { curId: list[15].id } } } });
  const a = await run(db, list, 365, { deadline: 0 });
  assert.equal(a.seen, 0);
  assert.equal(db.get('mailbox/old/state/curId'), list[15].id);
});

test('★★ 한 통 -ERR 은 지나가되 «이름표를 적어 두고», 다시 훑으면 받는다', async () => {
  const list = mails(50, (k) => 50 - k);
  const db = fakeDb();
  const a = await run(db, list, 365, { errIds: [list[20].id] });
  assert.equal(a.bad, 1);
  assert.equal(a.got, 49);
  assert.equal(a.bottom, true, '한 통 못 읽었다고 멈췄습니다');
  const bad = db.get('mailbox/old/bad') || {};
  assert.deepEqual(Object.keys(bad), [MS.popKey(list[20].id)], '못 읽은 통의 이름표를 안 적었습니다');
  /* 다시 훑기(fresh) — 이미 담은 것은 TOP 없이 지나가고 빠진 하나만 받는다 */
  const pop2 = { };
  const b = await run(db, list, 365, pop2, { again: true, fresh: true });
  assert.equal(b.got, 1, '다시 훑었는데 빠진 통을 못 받습니다');
  assert.equal(b.already, 49);
  assert.ok(!db.get('mailbox/old/bad/' + MS.popKey(list[20].id)), '받은 뒤에도 «못 읽음»이 남아 있습니다');
});

test('★★ 못 읽는 통이 «연달아» 오면 서버 탈로 보고 멈춘다 — 그 줄 첫 통부터 다시 본다', async () => {
  const list = mails(100, (k) => 100 - k);
  const errs = list.slice(40, 80).map((m) => m.id);  /* 79 → 40 이 연달아 -ERR */
  const db = fakeDb();
  const a = await run(db, list, 365, { errIds: errs });
  assert.equal(a.stalled, true, '연달아 못 읽는데 끝까지 지나갑니다');
  assert.equal(db.get('mailbox/old/state/curId'), list[80].id, '못 읽은 줄 너머에 자리를 적었습니다');
  const b = await run(db, list, 365, null);
  assert.equal(stored(db).length, 100, '못 읽던 줄을 다시 안 봅니다');
});

/* ══════ ② 목표를 넓혀도 문턱 언저리를 건너뛰지 않는다 ══════ */

test('★★★ 1년 → 3년 → 10년으로 넓혀도 «한 통도» 안 빠진다', async () => {
  /* 0~99 는 400~499일 전(1년 밖) · 100~199 는 1년 안.
     150 하나는 날짜가 엉뚱하게 옛것(800일) — 번호가 늘 시간 차례는 아니다. */
  const list = mails(200, (k) => (k === 150 ? 800 : k < 100 ? 499 - k : 200 - k));
  const db = fakeDb();
  const y1 = await run(db, list, 365, null);
  assert.equal(y1.done, true, '1년 목표에 닿았는데 done 이 아닙니다');
  const y3 = await run(db, list, 1095, null);
  const y10 = await run(db, list, 3650, null);
  const have = new Set(stored(db));
  const miss = list.filter((m) => !have.has(MS.popKey(m.id))).map((m) => m.id);
  assert.deepEqual(miss, [], '목표를 넓혔는데 빠진 메일이 있습니다: ' + miss.slice(0, 5).join(','));
  assert.ok(y3.bottom || y10.bottom, '바닥까지 갔는데 모릅니다');
});

test('★★ 목표에 닿아 멈춘 자리는 «담은 마지막 통»이다', async () => {
  const list = mails(200, (k) => (k < 100 ? 499 - k : 200 - k));
  const db = fakeDb();
  const y1 = await run(db, list, 365, null);
  assert.equal(y1.done, true);
  const cur = db.get('mailbox/old/state/curId');
  assert.ok(stored(db).includes(MS.popKey(cur)), '이어 갈 자리가 아직 안 담은 통입니다 — 넓힐 때 그 앞을 건너뜁니다');
});

/* ══════ ③ 이미 잃은 것 되찾기 — 다시 훑기(fresh) ══════ */

test('★★★ 옛 버그로 «바닥»이 적혀 있어도 다시 훑으면 빠진 것만 받는다', async () => {
  const list = mails(100, (k) => 100 - k);
  const msgs = {};
  list.slice(50).forEach((m) => { msgs[MS.popKey(m.id)] = { s: m.subject, d: m.date, o: 1 }; });
  /* 2026-10-04 이전 버그의 흔적 — 반만 담겼는데 curId 는 바닥(list[0]) */
  const db = fakeDb({ mailbox: { old: { msgs, state: { curId: list[0].id, got: 50 } } } });
  const a = await run(db, list, 3650, null);
  assert.ok(isFloor(a), '버그 흔적 상태가 재현되지 않았습니다');
  const b = await run(db, list, 3650, null, { again: true, fresh: true });
  assert.equal(b.got, 50, '다시 훑었는데 빠진 것을 못 받습니다');
  assert.equal(b.already, 50, '이미 담은 것을 또 받습니다');
  assert.equal(stored(db).length, 100);
});

/* ══════ ④ 겹침 ══════ */

test('★★ 같은 사람·같은 분·같은 제목이라도 «다른 메일»이면 둘 다 담는다', async () => {
  const list = mails(3, () => 10);
  list.forEach((m) => { m.date = NOW - 10 * DAY; m.subject = '가나상사 세금계산서 발행 알림'; });
  list[2].mid = list[1].mid;                           /* 2 는 1 과 같은 메일(두 칸에 든 것) */
  const db = fakeDb();
  const a = await run(db, list, 365, null);
  assert.equal(a.got, 2, '다른 메일을 지문만 보고 하나로 합쳤거나, 같은 메일을 두 번 담았습니다');
  assert.equal(a.skip, 1);
});

test('★★ IMAP 으로 이미 든 메일은 담지 않는다', async () => {
  const list = mails(3, (k) => 10 + k);
  const m = list[1];
  const db = fakeDb({ mailbox: { msgs: { INBOX: { x: { e: m.from, d: m.date, s: m.subject } } } } });
  const a = await run(db, list, 365, null);
  assert.equal(a.got, 2);
  assert.equal(a.skip, 1);
  assert.ok(!stored(db).includes(MS.popKey(m.id)));
});
