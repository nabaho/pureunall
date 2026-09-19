/* 다음메일함 동기화 — «한 회차를 실제로 돌려 본다».
   ═══════════════════════════════════════════════════════════════════════════
   가짜 메일함과 가짜 실시간DB를 끼워 runSync 를 돌린다. 실제 메일함에는 붙지 않는다.
   (tests/mail-run-scope.test.js 가 급여자료 회차에 쓰는 것과 같은 방식이다.)

   ⚠ 왜 글자만 보는 검사로는 모자라나 — 여기서 틀리는 것은 «창이 움직이는 방식»이다.
     문법은 멀쩡하고, 한 회차 로그도 「ok: true」로 남는다. 그런데 몇 회차 뒤에 보면
     가운데 구간 250통이 조용히 빠져 있다. 그것을 잡으려면 돌려 봐야 한다.
     2026-08-24 에 실제로 그런 구멍이 있었다(옛것 방향이 중간에 끊기면 못 받은 위쪽을
     이미 본 것으로 표시했다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const MS = require('../functions/mail-sync.js');
const MB = require('../functions/mail-box.js');

/* ── 가짜 실시간DB ──
   층을 «실제처럼» 만든다. 납작하게 담으면 mailbox/msgs/<폴더> 를 읽어도 아래에 적은
   것이 안 보여, 검사가 조용히 헛것이 된다(이 저장소에서 한 번 겪었다). */
function fakeDb() {
  const data = {};
  const get = (path) => (path ? String(path).split('/').reduce((o, k) => (o == null ? null : o[k]), data) : data);
  const put = (path, v) => {
    const ks = String(path).split('/');
    let o = data;
    for (let i = 0; i < ks.length - 1; i++) {
      if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {};
      o = o[ks[i]];
    }
    const last = ks[ks.length - 1];
    if (v === null) delete o[last]; else o[last] = v;
  };
  const reads = [];          // once() 로 읽은 자리 — «폴더 전체를 읽었나»를 세려고 둔다
  function ref(path) {
    const p = path === undefined ? '' : String(path);
    return {
      once: async () => { reads.push(p); return { val: () => get(p) }; },
      update: async (obj) => { Object.keys(obj).forEach((k) => put(p ? p + '/' + k : k, obj[k])); },
      set: async (v) => put(p, v),
      remove: async () => put(p, null),
      child: (c) => ref(p ? p + '/' + c : c),
    };
  }
  return { ref, __data: data, __get: get, __reads: reads };
}

/* ── 가짜 메일함 ──
   IMAP 은 번호가 «작은 것부터» 온다 — 그 차례를 지켜야 「중간에 끊기면 아래쪽이
   손에 남는다」는 것이 검사에서도 재현된다. */
function fakeMail(folders, hooks) {
  const h = hooks || {};
  let opened = null;
  let fetches = 0;
  const api = {
    __fetches: () => fetches,
    async list() {
      return Object.keys(folders).map((p) => ({
        path: p, name: folders[p].name || p, flags: new Set(),
        specialUse: folders[p].specialUse || '',
      }));
    },
    async status(p) {
      const uids = Object.keys(folders[p].msgs).map(Number);
      /* ⚠ 안읽음 수는 «표시대로» 센다 — 늘 0 을 주면 실제와 달라,
           「다음에서 읽으면 우리도 따라온다」를 확인할 수가 없다(2026-08-30). */
      const unseen = uids.filter((u) => {
        const f = (folders[p].msgs[String(u)] || {}).flags || [];
        return f.indexOf('\\Seen') < 0;
      }).length;
      return {
        messages: uids.length, unseen: unseen,
        uidNext: (uids.length ? Math.max.apply(null, uids) : 0) + 1,
        uidValidity: folders[p].uv || 1,
      };
    },
    async getMailboxLock(p) { opened = p; return { release() {} }; },
    async *fetch(range, query) {
      fetches++;
      /* 미리보기 — 「조각의 앞부분만」 달라고 하면 그 조각만 돌려준다(실제 IMAP 과 같게) */
      const wantPart = query && Array.isArray(query.bodyParts) && query.bodyParts[0];
      if (wantPart) {
        const key = typeof wantPart === 'string' ? wantPart : wantPart.key;
        const max = (wantPart && wantPart.maxLength) || 800;
        for (const u of String(range).split(',').map(Number)) {
          const m = folders[opened].msgs[String(u)];
          if (!m || !m.__body) continue;
          const buf = Buffer.from(String(m.__body).slice(0, max), 'utf8');
          yield { uid: u, bodyParts: new Map([[key, buf]]) };
        }
        return;
      }
      /* 「10,20,30」(낱개) 과 「10:30」(구간) 둘 다 받는다 — 실제 IMAP 과 같게 */
      const want = {};
      String(range).split(',').forEach((part) => {
        if (part.indexOf(':') >= 0) {
          const [a, b] = part.split(':').map(Number);
          for (const k of Object.keys(folders[opened].msgs)) {
            const u = Number(k);
            if (u >= a && u <= b) want[u] = 1;
          }
        } else if (part) { want[Number(part)] = 1; }
      });
      const uids = Object.keys(folders[opened].msgs).map(Number)
        .filter((u) => want[u]).sort((a, b) => a - b);
      let i = 0;
      for (const u of uids) {
        i++;
        if (h.breakAt && h.breakAt(fetches, i)) throw new Error('가짜 끊김');
        const m = folders[opened].msgs[u];
        /* ⚠ 표시를 «그 메일이 든 대로» 돌려준다 — 늘 빈 것을 주면 「다음에서 읽으면
             우리도 따라온다」를 확인할 수가 없다(2026-08-30). */
        yield { uid: u, flags: new Set(m.flags || []), size: 1000, envelope: m,
                bodyStructure: m.__body
                  ? { part: '1', type: 'text/plain', encoding: '7bit', parameters: { charset: 'utf-8' } }
                  : undefined };
      }
    },
    async search() { return Object.keys(folders[opened].msgs).map(Number); },
    async messageFlagsAdd() {},
    async logout() {},
  };
  return api;
}

function envelope(i) {
  return { from: [{ name: '보낸이' + i, address: 's' + i + '@x.com' }],
           to: [{ address: '370-6@daum.net' }], subject: '제목 ' + i,
           date: new Date(1756000000000 + i * 1000).toISOString() };
}
function box(n, first) {
  const msgs = {};
  const start = first || 1;
  for (let i = 0; i < n; i++) msgs[String(start + i)] = envelope(start + i);
  return { msgs: msgs };
}
/* 실제 대표 계정처럼 «흩어진» 번호 — 계정 전체에서 하나씩 매겨져 17만번대까지 가 있고
   폴더 하나에는 그 가운데 몇백 개만 있다(실측 2026-08-24). */
function sparseBox(n, top, gap) {
  const msgs = {};
  for (let i = 0; i < n; i++) msgs[String(top - i * gap)] = envelope(i);
  return { msgs: msgs };
}

function deps(db) {
  return {
    getDatabase: () => db,
    getAuth: () => ({}),
    MD: { loginIds: () => ['370-6'] },
    MAIL_REGION: 'asia-northeast3',
    setCors: () => {},
    requireStaff: async () => ({ uid: 'u' }),
    mailUserAsync: async () => '370-6@daum.net',
    mailPass: () => 'pw',
    functions: { region: () => ({ runWith: () => ({ pubsub: { schedule: () => ({ timeZone: () => ({ onRun: () => null }) }) }, https: { onRequest: () => null } }) }) },
  };
}

const uidsIn = (db, path) => Object.keys(db.__get(MS.ROOT + '/msgs/' + path) || {}).map(Number).sort((a, b) => a - b);
const slug = (p) => MB.slugOf(p);

/* ══════ 한 회차에 다 가져온다 ══════ */

test('★ 한 뭉치보다 많아도 한 회차에 다 가져온다 — 예산이 남으면 몇 바퀴 돈다', async () => {
  const folders = { INBOX: box(950) };
  const db = fakeDb();
  const r = await MS.runSync(deps(db), { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(r.ok, true, r.err);
  const got = uidsIn(db, slug('INBOX'));
  assert.equal(got.length, 950, '가져온 통수가 다르다 — 빠진 구간이 있다');
  assert.equal(got[0], 1);
  assert.equal(got[got.length - 1], 950);
  assert.ok(r.turns > 1, '한 바퀴만 돌았다 — 예산이 남는데 멈췄다');
});

test('★ 다 찬 폴더는 «끝났다»고 적는다 — 안 적으면 셈이 거짓이 되고 정리가 안 돈다', async () => {
  const folders = { INBOX: box(120) };
  const db = fakeDb();
  const r = await MS.runSync(deps(db), { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(r.ready, 1, '다 찼는데 「기다리는 폴더」로 세고 있다');
  assert.equal(r.waiting, 0);
  assert.equal(db.__get(MS.ROOT + '/sync/' + slug('INBOX')).done, true);
});

test('★ 가져올 것이 «없는» 바퀴에도 표시를 적는다 — 실제로 이 자리에서 done 이 안 적혔다', async () => {
  /* 2026-08-24 실측: INBOX 가 400/400 인데 done 이 false 로 남아 「기다리는 폴더 33개」로
     세어지고, 정리(지워진 메일 빼기)가 한 번도 돌지 않았다. 앞 회차가 다 가져온 뒤
     끝났을 때 그렇게 된다 — 다음 회차의 첫 바퀴는 «가져올 것이 없는» 바퀴다. */
  const folders = { INBOX: box(120) };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  /* 앞 회차가 표시를 못 적고 끝난 상태를 손으로 만든다 */
  await db.ref(MS.ROOT + '/sync/' + slug('INBOX')).update({ done: false });
  const r = await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(db.__get(MS.ROOT + '/sync/' + slug('INBOX')).done, true,
    '가져올 것이 없는 바퀴가 표시를 안 적었다 — 이 폴더는 영원히 「기다리는」 상태로 남는다');
  assert.equal(r.ready, 1);
});

test('★ 번호가 하나도 빠지지 않는다 — 가운데가 조용히 비는 것이 가장 무섭다', async () => {
  const folders = { INBOX: box(1230) };
  const db = fakeDb();
  await MS.runSync(deps(db), { client: fakeMail(folders), deadlineMs: 60000 });
  const got = uidsIn(db, slug('INBOX'));
  const missing = [];
  for (let u = 1; u <= 1230; u++) if (got.indexOf(u) < 0) missing.push(u);
  assert.deepEqual(missing, [], '빠진 번호: ' + missing.slice(0, 10).join(',') + ' …');
});

test('폴더가 여럿이면 돌려 세운다 — 앞 폴더만 채우고 뒤는 0통이면 안 된다', async () => {
  const folders = {
    INBOX: box(900),
    '보낸메일함': Object.assign(box(900), { specialUse: '\\Sent' }),
    'INBOX.1.자문사답변': box(500),
  };
  const db = fakeDb();
  const r = await MS.runSync(deps(db), { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(r.ok, true, r.err);
  assert.equal(uidsIn(db, slug('INBOX')).length, 900);
  assert.equal(uidsIn(db, slug('보낸메일함')).length, 900);
  assert.equal(uidsIn(db, slug('INBOX.1.자문사답변')).length, 500);
});

test('★ 번호가 17만번대에 흩어져 있어도 한 회차에 다 가져온다 — 실제 계정이 그렇다', () => {
  /* 2026-08-24 실측: 33개 폴더가 번호를 171,876번까지 나눠 쓰고 있었다. 훑어 내려가는
     방식으로는 폴더 하나에 430바퀴가 걸렸다(빈 구간을 계속 열었다). */
  const folders = { INBOX: sparseBox(400, 171876, 37) };
  const db = fakeDb();
  return MS.runSync(deps(db), { client: fakeMail(folders), deadlineMs: 60000 }).then((r) => {
    assert.equal(r.ok, true, r.err);
    assert.equal(uidsIn(db, slug('INBOX')).length, 400, '흩어진 번호를 다 못 가져왔다');
    assert.ok(r.turns <= 5, '바퀴가 ' + r.turns + '번이나 걸렸다 — 빈 구간을 열고 있다');
  });
});

test('★ 없는 번호를 달라고 하지 않는다 — 목록에 있는 것만 고른다', async () => {
  const folders = { INBOX: sparseBox(50, 100000, 1000) };
  const db = fakeDb();
  const asked = [];
  const client = fakeMail(folders);
  const realFetch = client.fetch;
  client.fetch = function (range, q, o) { asked.push(String(range)); return realFetch.call(client, range, q, o); };
  await MS.runSync(deps(db), { client: client, deadlineMs: 60000 });
  const live = Object.keys(folders.INBOX.msgs);
  asked.forEach((set) => {
    String(set).split(',').forEach((u) => {
      assert.ok(live.indexOf(u) >= 0, '없는 번호 ' + u + ' 를 달라고 했다');
    });
  });
  assert.ok(asked.length > 0, '아무것도 안 가져왔다');
});

/* ══════ 중간에 끊겼을 때 ══════ */

test('★ 옛것을 받다 끊기면 못 받은 위쪽을 건너뛰지 않는다 — 이 구멍을 2026-08-24 에 막았다', async () => {
  /* 첫 바퀴(새것 방향)는 온전히 받고, 둘째 fetch(옛것 방향)를 100통째에서 끊는다.
     표시를 그때 옮겨 버리면 그 구간의 «위쪽»이 영원히 안 온다. */
  const folders = { INBOX: box(1000) };
  const db = fakeDb();
  const client = fakeMail(folders, { breakAt: (call, i) => call === 2 && i === 100 });
  const r = await MS.runSync(deps(db), { client: client, deadlineMs: 60000 });
  assert.equal(r.ok, true, r.err);
  const got = uidsIn(db, slug('INBOX'));
  const missing = [];
  for (let u = 1; u <= 1000; u++) if (got.indexOf(u) < 0) missing.push(u);
  assert.deepEqual(missing, [],
    '끊긴 구간의 위쪽이 빠졌다(' + missing.length + '통) — 표시를 옮기면 안 되는 자리다');
});

/* ══════ 미리보기 (폰 목록 셋째 줄) ══════ */

test('★ 목록에 미리보기가 함께 담긴다 — 폰 목록의 셋째 줄', () => {
  const folders = { INBOX: box(3) };
  Object.keys(folders.INBOX.msgs).forEach((u, i) => {
    folders.INBOX.msgs[u].__body = '안녕하세요 노무사님, ' + i + '번 자료 보내드립니다.';
  });
  const db = fakeDb();
  return MS.runSync(deps(db), { client: fakeMail(folders), deadlineMs: 60000 }).then(() => {
    const rows = db.__get(MS.ROOT + '/msgs/' + slug('INBOX'));
    const one = rows[Object.keys(rows)[0]];
    assert.ok(one.p, '미리보기가 안 담겼다');
    assert.match(one.p, /안녕하세요 노무사님/);
  });
});

test('★ 본문이 없으면 미리보기 칸을 만들지 않는다 — 빈 글자를 만 줄 적으면 그것도 값이다', async () => {
  const db = fakeDb();
  await MS.runSync(deps(db), { client: fakeMail({ INBOX: box(3) }), deadlineMs: 60000 });
  const rows = db.__get(MS.ROOT + '/msgs/' + slug('INBOX'));
  Object.keys(rows).forEach((k) => {
    assert.ok(!rows[k].p, '본문이 없는데 미리보기 칸이 생겼다');
  });
});

test('★ 줄 판이 옛것인 폴더를 「다 됐다」로 세지 않는다 — 화면에는 반쪽 줄이 남아 있다', async () => {
  /* 2026-08-24 실측: 서른셋 가운데 일곱만 새 판이었는데 회차 기록은 ready 33 이었다.
     지난 회차의 done 이 그대로 남아 있어서다. 숫자가 거짓이면 아무도 안 믿는다. */
  const folders = { INBOX: box(3), '보낸메일함': Object.assign(box(3), { specialUse: '\\Sent' }) };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  await db.ref(MS.ROOT + '/sync/' + slug('보낸메일함')).update({ ver: 1 });   // 옛 판으로 되돌린다

  /* 그 폴더는 이번 회차에 «못 연다»고 해 둔다 — 그래야 옛 판인 채로 셈에 들어온다 */
  const client = fakeMail(folders);
  const realLock = client.getMailboxLock;
  client.getMailboxLock = async (p) => {
    if (p === '보낸메일함') throw new Error('못 엽니다');
    return realLock.call(client, p);
  };
  const r = await MS.runSync(d, { client: client, deadlineMs: 60000 });

  assert.equal(r.ready + r.waiting, 2, '폴더 수가 안 맞는다');
  assert.equal(db.__get(MS.ROOT + '/sync/' + slug('보낸메일함')).ver, 1, '검사 짜임이 틀렸다');
  assert.equal(r.waiting, 1, '옛 판인 폴더를 「다 됐다」로 세고 있다');
  assert.equal(r.ready, 1);
});

test('★ 줄 모양이 바뀌면 그 폴더를 다시 훑는다 — 안 그러면 옛 줄은 영원히 반쪽이다', async () => {
  const folders = { INBOX: box(5) };
  Object.keys(folders.INBOX.msgs).forEach((u) => { folders.INBOX.msgs[u].__body = '본문 ' + u; });
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  /* 미리보기 없이 가져왔던 옛 상태를 손으로 만든다 — 줄에서 p 를 빼고 판 번호를 낮춘다 */
  const base = MS.ROOT + '/msgs/' + slug('INBOX');
  for (const k of Object.keys(db.__get(base))) await db.ref(base + '/' + k + '/p').remove();
  await db.ref(MS.ROOT + '/sync/' + slug('INBOX')).update({ ver: 1 });

  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  const rows = db.__get(base);
  Object.keys(rows).forEach((k) => assert.ok(rows[k].p, k + ' 번 줄이 아직 반쪽이다'));
  assert.equal(db.__get(MS.ROOT + '/sync/' + slug('INBOX')).ver, MB.ROW_VER);
});

/* ══════ 폴더 목록 ══════ */

test('★ 폴더 목록을 먼저 적는다 — 「아무것도 안 보인다」와 「목록만 비었다」는 다른 이야기다', async () => {
  const folders = { INBOX: box(3), '휴지통': box(2) };
  const db = fakeDb();
  await MS.runSync(deps(db), { client: fakeMail(folders), deadlineMs: 60000 });
  const rec = db.__get(MS.ROOT + '/folders/' + slug('INBOX'));
  assert.ok(rec, '폴더가 안 적혔다');
  assert.equal(rec.path, 'INBOX');
  assert.equal(rec.kind, 'inbox');
  assert.equal(rec.total, 3);
  assert.equal(db.__get(MS.ROOT + '/folders/' + slug('휴지통')).kind, 'trash');
});

test('회차 기록(meta)을 남긴다 — 언제 것인지 화면에 보여 줘야 한다', async () => {
  const db = fakeDb();
  await MS.runSync(deps(db), { client: fakeMail({ INBOX: box(5) }), deadlineMs: 60000 });
  const meta = db.__get(MS.ROOT + '/meta');
  assert.equal(meta.ok, true);
  assert.ok(meta.at > 0);
  assert.equal(meta.folders, 1);
});

/* ══════ 지워진 메일 정리 ══════ */

test('★ 다음메일에서 지운 것은 우리 목록에서도 뺀다 — 거울에 없는 것이 남으면 안 된다', async () => {
  const folders = { INBOX: box(10) };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(uidsIn(db, slug('INBOX')).length, 10);

  /* 다음메일에서 셋을 지웠다. 마지막 정리 때를 옛날로 돌려 놓는다(6시간 간격 규칙). */
  delete folders.INBOX.msgs['4'];
  delete folders.INBOX.msgs['5'];
  delete folders.INBOX.msgs['6'];
  await db.ref(MS.ROOT + '/sync/' + slug('INBOX')).update({ prunedAt: 0 });

  const r = await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(r.removed, 3, '지워진 것을 안 뺐다');
  assert.deepEqual(uidsIn(db, slug('INBOX')), [1, 2, 3, 7, 8, 9, 10]);
});

test('지워진 것이 없으면 폴더를 열어 보지 않는다 — 회차마다 전체를 읽으면 그것이 요금이다', async () => {
  const folders = { INBOX: box(10) };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  await db.ref(MS.ROOT + '/sync/' + slug('INBOX')).update({ prunedAt: 0 });
  const r = await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(r.removed, 0);
});

/* 폴더 전체를 몇 번 읽었나 — 이것이 곧 요금이다 */
const fullReads = (db, path) => db.__reads.filter((p) => p === MS.ROOT + '/msgs/' + path).length;

test('★ 통수가 그대로면 폴더를 다시 읽지 않는다 — 예전엔 회차마다 읽었다(요금)', async () => {
  /* 예전 판정은 「셈(n) != 살아 있는 통수」였다. n 은 «적은 줄 수»라 새 메일이 오고 가는
     사이 조금씩 어긋나(실측 7,379 vs 7,376) 판정이 늘 참이 되었고, 회차마다 폴더
     하나를 통째로 읽었다. */
  const folders = { INBOX: box(10) };
  const db = fakeDb();
  const d = deps(db);
  /* ⚠ 처음 두 회차는 «한 번씩 읽을 일»이 있다 — 첫 회차에 정리가 돌고, 폴더를 다 채운
       뒤 한 번 표시를 맞춘다(2026-08-30 「다음에서 읽음이면 같이 동기화」).
       여기서 지키는 것은 «아무것도 안 바뀌었는데 회차마다 읽는 것»을 막는 일이다. */
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });   // 첫 회차 — 정리도 한 번 돈다
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });   // 다 채운 뒤 표시 맞추기 한 번
  const before = fullReads(db, slug('INBOX'));
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(fullReads(db, slug('INBOX')), before,
    '바뀐 것이 없는데 폴더를 또 읽었다 — 회차마다 이러면 그것이 요금이다');
});

/* ★ 다음메일에서 읽으면 우리 줄도 따라와야 한다 (대표 보고 2026-08-30
     「다음에서 읽음이면 푸른메일도 같이 동기화 되어야 하는데 따로 논다」).
   ⚠ 실측 2026-08-30: 받은메일함은 다음이 «안읽음 0» 이라는데 우리 줄에는 34통이
     안읽음이었다 — 한 번 가져온 구간을 다시 안 읽어서다. */
test('★★ 다음메일에서 읽으면 우리 줄의 «안읽음»도 풀린다', async () => {
  const folders = { INBOX: box(3) };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });

  const path = MS.ROOT + '/msgs/' + slug('INBOX');
  const before = db.__get(path) || {};
  const uid = Object.keys(before)[0];
  assert.ok(uid, '줄이 하나도 안 적혔습니다');
  assert.equal(Number((before[uid] || {}).r || 0), 0, '처음부터 읽음이면 이 검사가 뜻이 없습니다');

  /* 다음메일 쪽에서 «읽음»으로 바뀐 것처럼 만든다 */
  const m = folders.INBOX.msgs[uid];
  assert.ok(m, '흉내 낸 메일함에 그 번호가 없습니다');
  m.flags = (m.flags || []).concat(['\\Seen']);

  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  const after = (db.__get(path) || {})[uid] || {};
  assert.equal(Number(after.r || 0), 1,
    '★ 다음에서 읽었는데 우리 줄은 그대로 «안읽음»입니다 — 두 곳이 따로 놉니다');
});

test('★ 통수가 줄면 그 자리에서 정리한다 — 하루를 기다리지 않는다', async () => {
  const folders = { INBOX: box(10) };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  const before = fullReads(db, slug('INBOX'));
  delete folders.INBOX.msgs['5'];          // 다음메일에서 한 통 지웠다
  const r = await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.ok(fullReads(db, slug('INBOX')) > before, '통수가 줄었는데 폴더를 안 읽었다');
  assert.equal(r.removed, 1);
  assert.equal(uidsIn(db, slug('INBOX')).indexOf(5), -1, '지운 메일이 목록에 남아 있다');
});

/* ══════ 번호가 다시 매겨졌을 때 ══════ */

test('★ 서버가 번호를 다시 매기면 옛 목록을 버린다 — 같은 번호가 다른 메일을 가리킨다', async () => {
  const folders = { INBOX: box(20) };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(uidsIn(db, slug('INBOX')).length, 20);

  folders.INBOX = box(5, 100);      // 번호가 100번대로 다시 매겨졌다
  folders.INBOX.uv = 99;
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.deepEqual(uidsIn(db, slug('INBOX')), [100, 101, 102, 103, 104],
    '옛 번호가 남아 있다 — 없는 메일이 목록에 보인다');
});

/* ══════ 붙지 못했을 때 ══════ */

test('메일 계정이 없으면 조용히 실패한다 — 앱에는 까닭이 간다', async () => {
  const db = fakeDb();
  const d = deps(db);
  d.mailUserAsync = async () => '';
  const r = await MS.runSync(d, { client: fakeMail({ INBOX: box(1) }), deadlineMs: 60000 });
  assert.equal(r.ok, false);
  assert.match(r.error, /메일 계정/);
});

test('한 폴더를 못 열어도 나머지는 가져온다 — 하나 때문에 회차가 통째로 죽지 않는다', async () => {
  const folders = { INBOX: box(5), '깨진폴더': box(5) };
  const db = fakeDb();
  const client = fakeMail(folders);
  const realStatus = client.status;
  client.status = async (p) => {
    if (p === '깨진폴더') throw new Error('못 엽니다');
    return realStatus(p);
  };
  const r = await MS.runSync(deps(db), { client: client, deadlineMs: 60000 });
  assert.equal(r.ok, true, r.err);
  assert.equal(r.folders, 1);
  assert.equal(uidsIn(db, slug('INBOX')).length, 5);
});


/* ══════ 400 «창»이 우리 거울을 깎지 않는다 (대표 지시 2026-08-28) ══════ */

test('★ 다음메일이 옛것을 안 보여 줘도 우리 목록에서는 안 사라진다 — 400 을 넘겨 쌓인다', async () => {
  /* 다음메일은 폴더당 정해진 개수까지만 보여 준다. 새 메일이 오면 가장 옛것이 그
     창 밖으로 밀린다 — 지운 것이 아닌데 목록에서 사라진다.
     ⚠ 예전에는 그것을 우리가 지웠다. 그래서 거울이 영영 그 개수를 못 넘었다. */
  const folders = { INBOX: box(10) };            // 지금은 1~10 이 보인다
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(uidsIn(db, slug('INBOX')).length, 10);

  /* 새 메일 다섯 통이 오면서 옛것 다섯 통이 창 밖으로 밀렸다(지운 것이 아니다) */
  folders.INBOX = box(10, 6);                    // 이제 6~15 만 보인다
  await db.ref(MS.ROOT + '/sync/' + slug('INBOX')).update({ prunedAt: 0 });
  const r = await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });

  assert.equal(r.removed, 0, '밀려난 것을 «지운 것»으로 보고 지웠습니다');
  assert.deepEqual(uidsIn(db, slug('INBOX')), [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
    '거울이 다음메일이 보여 주는 개수를 못 넘고 있습니다');
});

test('★ 그러면서도 «정말 지운 것»은 그대로 뺀다 — 둘을 갈라야 거울이 거울이다', async () => {
  const folders = { INBOX: box(10) };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  /* 창은 그대로(1 이 아직 보인다)인데 5 만 없어졌다 = 사람이 지웠다 */
  delete folders.INBOX.msgs['5'];
  await db.ref(MS.ROOT + '/sync/' + slug('INBOX')).update({ prunedAt: 0 });
  const r = await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(r.removed, 1, '지운 것을 안 뺐습니다');
  assert.equal(uidsIn(db, slug('INBOX')).indexOf(5), -1);
});

test('★★ 번호 목록을 못 받은 회차가 폴더를 비우지 않는다', async () => {
  /* 접속이 한 번 흔들려 SEARCH 가 실패하면 번호 목록이 빈 배열로 온다.
     예전 규칙에서는 그것이 「전부 지워졌다」로 읽혀 몇 년치가 한 번에 날아갔다. */
  const folders = { INBOX: box(10) };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  await db.ref(MS.ROOT + '/sync/' + slug('INBOX')).update({ prunedAt: 0 });

  const broken = fakeMail(folders);
  broken.search = async () => { throw new Error('접속이 끊겼습니다'); };
  const r = await MS.runSync(d, { client: broken, deadlineMs: 60000 });
  assert.equal(r.removed, 0, '번호 목록을 못 받았는데 지웠습니다');
  assert.equal(uidsIn(db, slug('INBOX')).length, 10, '폴더가 비었습니다');
});

test('★ 「이 칸에 모두 몇 통」은 우리가 든 수로 적는다 — 400 이라고 적어 놓고 406 을 보여 주면 안 된다', async () => {
  const folders = { INBOX: box(10) };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  folders.INBOX = box(10, 6);                    // 창이 밀려 6~15 만 보인다
  await db.ref(MS.ROOT + '/sync/' + slug('INBOX')).update({ prunedAt: 0 });
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });

  const held = uidsIn(db, slug('INBOX')).length;
  const shown = Number((db.__get(MS.ROOT + '/folders/' + slug('INBOX')) || {}).total || 0);
  assert.equal(held, 15, '검사 밑그림이 틀렸습니다');
  assert.equal(shown, held, '다음메일이 보여 주는 수(10)를 적고 있습니다 — 목록에는 15통이 보입니다');
});

/* ══════ 표시 맞추기가 «영영» 도는 것 (실측 2026-09-19) ══════════════════════
   ★★ 무슨 일이 있었나
     서른두 폴더 가운데 «둘»만 10분마다 폴더를 통째로 다시 읽고 있었다 —
     받은메일함(우리 481통 / 다음이 보여 주는 400, 우리 셈 5 vs 다음 0)과
     보낸편지함(909 / 400, 8 vs 0). 나머지 서른은 하루에 한 번이었다.
     하루 288번 × 수백 KB. 23분을 재 보니 «자동으로 도는» 통신의 절반이 이것이었다.

   ★ 까닭 — 두 수가 «다른 무리»를 셌다
     다음이 말하는 안읽음은 지금 보여 주는 목록(폴더당 400통)을 센다.
     우리 셈은 우리가 든 전부를 셌다 — 창 밖으로 밀려난 옛 줄까지(2026-08-28 로 안 지운다).
     그 옛 줄이 안읽음이면 다음은 영영 그 수를 모른다. 그래서 맞춰도 안 맞고,
     안 맞으니 또 맞추러 들어간다.

   ⚠ 바로 위 「통수가 그대로면 다시 읽지 않는다」 검사로는 못 잡는다 —
     거기서는 우리가 든 것과 다음이 보여 주는 것이 «같은 무리»라 두 수가 애초에 맞는다. */
function 창밖으로밀린폴더() {
  /* 1~3 은 안읽음, 4~6 은 읽음 */
  const msgs = {};
  for (let u = 1; u <= 6; u++) {
    msgs[String(u)] = Object.assign({}, envelope(u));
    if (u >= 4) msgs[String(u)].flags = ['\\Seen'];
  }
  return { msgs: msgs };
}

test('★★ 맞출 수 없는 어긋남 하나가 폴더를 «회차마다» 다시 읽히지 않는다', async () => {
  const folders = { INBOX: 창밖으로밀린폴더() };
  const db = fakeDb();
  const d = deps(db);
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });

  /* 창이 밀렸다 — 다음은 이제 4~6 만 보여 주고 그 셋은 다 읽음이라 「안읽음 0」이다.
     우리 거울에는 1~3 이 «안읽음»인 채 그대로 남는다(창 밖이라 안 지운다). */
  delete folders.INBOX.msgs['1'];
  delete folders.INBOX.msgs['2'];
  delete folders.INBOX.msgs['3'];

  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });  // 줄었다 — 정리·맞추기 한 번씩은 마땅하다
  const kept = uidsIn(db, slug('INBOX'));
  assert.ok(kept.indexOf(1) >= 0, '★ 창 밖으로 밀린 옛 줄을 지웠습니다 — 2026-08-28 결정이 깨졌습니다');

  /* ★ 적어 둔 안읽음 수가 «다음이 말하는 수»와 같은 무리를 세야 한다.
       우리가 든 전부(창 밖 1~3 포함)를 세면 3 이 되어 다음의 0 과 영영 어긋난다 —
       그 어긋남이 곧 회차마다 다시 읽는 길이었다(2026-08-30 에 고치려던 그 어긋남이다). */
  const 적힌것 = db.__get(MS.ROOT + '/sync/' + slug('INBOX')) || {};
  assert.equal(Number(적힌것.unread), 0,
    '★★ 적어 둔 안읽음 수가 다음이 말하는 수(0)와 다릅니다 — 창 밖 옛 줄까지 세고 있습니다: '
    + Number(적힌것.unread));

  const before = fullReads(db, slug('INBOX'));
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.equal(fullReads(db, slug('INBOX')), before,
    '★★ 맞출 수 없는 어긋남 때문에 회차마다 폴더를 통째로 다시 읽습니다 — '
    + '실제로 받은메일함·보낸편지함이 10분마다 그러고 있었습니다(요금). '
    + '읽은 횟수: ' + fullReads(db, slug('INBOX')) + ' (그대로여야 하는 값: ' + before + ')');
});

test('★★ 그래도 «다음이 말하는 수»가 바뀌면 그때는 훑는다 — 조용해지려고 눈을 감으면 안 된다', async () => {
  const folders = { INBOX: 창밖으로밀린폴더() };
  const db = fakeDb();
  const d = deps(db);
  for (let i = 0; i < 3; i++) await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  delete folders.INBOX.msgs['1'];
  delete folders.INBOX.msgs['2'];
  delete folders.INBOX.msgs['3'];
  for (let i = 0; i < 3; i++) await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });

  /* 남은 것 하나가 «안읽음»으로 바뀌었다 — 다음이 말하는 수가 0 에서 1 이 된다 */
  const m = folders.INBOX.msgs['4'];
  assert.ok(m, '흉내 낸 메일함에 4번이 없습니다');
  m.flags = [];
  const before = fullReads(db, slug('INBOX'));
  await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  assert.ok(fullReads(db, slug('INBOX')) > before,
    '★★ 다음에서 안읽음이 생겼는데 훑지 않습니다 — 조용해지려고 눈을 감은 셈입니다');
  const after = (db.__get(MS.ROOT + '/msgs/' + slug('INBOX')) || {})['4'] || {};
  assert.equal(Number(after.r || 0), 0, '★ 훑고도 우리 줄이 «읽음»으로 남아 있습니다');
});

test('★ 셈은 «다음이 보여 주는 무리»만 센다 — 견줄 값이니 같은 무리여야 한다', () => {
  assert.equal(MB.sweepUnread({ 10: { r: 1 }, 11: { r: 0 }, 12: { r: 0 } }), 2);
  assert.equal(MB.sweepUnread({ 10: { r: 1 } }), 0);
  assert.equal(MB.sweepUnread({}), 0);
  assert.equal(MB.sweepUnread(null), 0);
});

test('★★ 훑을까 판정 — 맞으면 조용히, 못 맞추는 수는 한 번만, 하루 지나면 그물', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const 훑나 = (s, unseen, since) => MB.sweepNeeded(s, unseen, since === undefined ? 0 : since, DAY);

  /* ⚠ 「아직 다 안 채웠다」는 두 가지로 걸러야 한다 — 한 번도 안 훑은 것(-1)과
       어긋난 것(3 vs 0). 둘 다 done 을 안 보면 «훑자»가 되어, 받아 오는 중인 폴더를
       회차마다 통째로 읽는다. 값이 우연히 맞는 경우(0 vs 0)로 재면 이 자리가 샌다. */
  assert.equal(훑나({ done: false, unread: -1 }, 0), false, '★ 아직 다 안 채운 폴더를 훑으면 헛일이다');
  assert.equal(훑나({ done: false, unread: 3 }, 0), false,
    '★★ 받아 오는 중인 폴더를 어긋났다고 훑습니다 — 다 채우기도 전에 회차마다 통째로 읽습니다');
  assert.equal(훑나({ done: false, unread: 3 }, 0, 99 * DAY), false, '★ 하루 그물도 done 앞에서는 멈춘다');
  assert.equal(훑나({ done: true, unread: -1 }, 0), true, '★ 한 번도 안 훑었으면 훑어야 한다');
  assert.equal(훑나({ done: true, unread: 3 }, 3), false, '★ 두 수가 맞는데 또 훑으면 그것이 요금이다');
  assert.equal(훑나({ done: true, unread: 3 }, 0), true, '★ 어긋나면 한 번은 맞춰 봐야 한다');
  assert.equal(훑나({ done: true, unread: 3, unseenOk: 0 }, 0), false,
    '★★ 맞춰 봤는데도 안 맞는 수를 또 훑습니다 — 이것이 10분마다 도는 길입니다');
  assert.equal(훑나({ done: true, unread: 3, unseenOk: 0 }, 1), true,
    '★★ 다음이 말하는 수가 바뀌었는데 안 훑습니다 — 누가 뭘 읽었다는 신호를 놓칩니다');
  assert.equal(훑나({ done: true, unread: 3, unseenOk: 0 }, 0, DAY + 1), true,
    '★ 하루가 지나면 그물로 한 번은 훑어야 한다(중요·답장함만 바뀐 경우)');
});

test('★★ 「맞춰 봤다」는 표가 회차 사이에 «살아남는다» — 떨어뜨리면 고친 뜻이 사라진다', () => {
  const s = MB.nextSync({ hi: 500, lo: 1, uv: 7, unread: 3, unseenOk: 0, sweptAt: 99 }, [10], 7, true);
  assert.equal(s.unseenOk, 0,
    '★★ nextSync 가 unseenOk 를 떨어뜨립니다 — 다음 회차에 「맞춰 본 적 없다」가 되어 또 통째로 읽습니다');
  assert.equal(s.unread, 3, '★ unread 도 함께 이어져야 합니다');
  const fresh = MB.nextSync({}, [10], 7, true);
  assert.equal(fresh.unseenOk, -1, '★ 적힌 적 없으면 «모른다»(-1)여야 합니다 — 0 이면 「맞춰 봤다」로 읽힙니다');
});

test('★★ 훑은 뒤 «이 수는 맞춰 봤다»를 실제로 적어 둔다 — 안 적으면 마지막 그물이 없다', async () => {
  /* ⚠ 위 「회차마다 다시 읽지 않는다」만으로는 이 자리를 못 지킨다 — 거기서는 셈을
       같은 무리로 고친 것만으로 두 수가 맞아떨어져, unseenOk 를 안 적어도 조용하다.
     그런데 다음이 목록 밖까지 세는 폴더에서는 그 «맞아떨어짐»이 없다. 그때 남는
     마지막 그물이 이 칸이다 — 적히는지를 여기서 따로 못 박는다. */
  const folders = { INBOX: 창밖으로밀린폴더() };
  const db = fakeDb();
  const d = deps(db);
  for (let i = 0; i < 2; i++) await MS.runSync(d, { client: fakeMail(folders), deadlineMs: 60000 });
  const s = db.__get(MS.ROOT + '/sync/' + slug('INBOX')) || {};
  assert.equal(Number.isFinite(Number(s.unseenOk)) && Number(s.unseenOk) >= 0, true,
    '★★ 훑고도 «맞춰 본 수»를 안 적었습니다 — 못 맞추는 폴더가 10분마다 통째로 읽힙니다: '
    + JSON.stringify({ unread: s.unread, unseenOk: s.unseenOk }));
  assert.equal(Number(s.unseenOk), 3,
    '★ 적은 값이 «다음이 그때 말한 수»가 아닙니다 — 그러면 다음 회차 견주기가 어긋납니다');
});
