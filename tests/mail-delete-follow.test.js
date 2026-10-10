/* 다음메일에서 지운 메일을 «회차마다» 따라 뺀다 (대표 지시 2026-10-10)
   ═══════════════════════════════════════════════════════════════════════════
   「다음 메일에서 삭제하면 연결해서 자동으로 삭제하고 실시간 연동되게 해 달라」

   ★ 왜 하루씩 늦었나 (실측 2026-10-10 mailbox/sync)
     지운 것을 찾는 정리는 «통수가 줄었을 때»만 돌았다. 그런데 칸 31개 가운데 13개가
     다음메일 창(400통)에 꽉 차 있다 — 한 통을 지우면 창 밖의 옛것 한 통이 «되돌아와»
     통수가 400 그대로다. 그래서 그 칸들은 하루 한 번 그물(PRUNE_GAP_MS)에서만 지워졌다
     (prunedAt 이 모두 18~22시간 전, 지운 것이 모두 같은 시각 16:30 에 몰려 빠졌다).
     게다가 한 회차에 «한 칸»만 정리했다(pruned < 1).

   ★ 이제 칸마다 «지난 회차에 살아 있던 번호 목록»을 적어 두고, 이번 목록과 견준다.
     지난번에 있었는데 이번에 없고 + 지금 창 바닥보다 위에 있으면 = 지웠거나 옮긴 것.
     ⚠ 창 바닥보다 아래로 내려간 것은 «밀려난 것»이라 안 지운다(2026-08-28 규칙 그대로).
     ⚠ 폴더 전체를 읽지 않는다 — 번호 목록 한 줄(수 KB)만 견준다. 그래서 회차마다 해도 싸다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const MS = require('../functions/mail-sync.js');
const MB = require('../functions/mail-box.js');

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
  const reads = [];
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
  return { ref, __get: get, __reads: reads };
}

function envelope(i) {
  return { from: [{ name: '보낸이' + i, address: 's' + i + '@x.com' }],
           to: [{ address: 'hong@example.com' }], subject: '제목 ' + i,
           date: new Date(1756000000000 + i * 1000).toISOString() };
}
/* 다음메일 «창» — 번호 lo~hi 가운데 빠진 것(gone)을 뺀 것이 보인다 */
function win(lo, hi, gone) {
  const msgs = {};
  for (let u = lo; u <= hi; u++) if (!(gone || []).includes(u)) msgs[String(u)] = envelope(u);
  return { msgs: msgs };
}
function fakeMail(folders) {
  let opened = null;
  return {
    async list() { return Object.keys(folders).map((p) => ({ path: p, name: p, flags: new Set(), specialUse: '' })); },
    async status(p) {
      const uids = Object.keys(folders[p].msgs).map(Number);
      return { messages: uids.length, unseen: uids.length,
               uidNext: (uids.length ? Math.max.apply(null, uids) : 0) + 1, uidValidity: 1 };
    },
    async getMailboxLock(p) { opened = p; return { release() {} }; },
    async *fetch(range, query) {
      if (query && query.bodyParts) return;
      const want = {};
      String(range).split(',').forEach((part) => {
        if (part.indexOf(':') >= 0) {
          const [a, b] = part.split(':').map(Number);
          Object.keys(folders[opened].msgs).forEach((k) => { if (+k >= a && +k <= b) want[+k] = 1; });
        } else if (part) want[Number(part)] = 1;
      });
      for (const u of Object.keys(folders[opened].msgs).map(Number).filter((x) => want[x]).sort((a, b) => a - b)) {
        yield { uid: u, flags: new Set(['\\Seen']), size: 1000, envelope: folders[opened].msgs[u] };
      }
    },
    async search() { return Object.keys(folders[opened].msgs).map(Number); },
    async messageFlagsAdd() {},
    async logout() {},
  };
}
function deps(db) {
  return {
    getDatabase: () => db, getAuth: () => ({}), MD: { loginIds: () => ['x'] },
    MAIL_REGION: 'asia-northeast3', setCors: () => {}, requireStaff: async () => ({ uid: 'u' }),
    mailUserAsync: async () => 'hong@example.com', mailPass: () => 'pw',
    functions: { region: () => ({ runWith: () => ({ pubsub: { schedule: () => ({ timeZone: () => ({ onRun: () => null }) }) }, https: { onRequest: () => null } }) }) },
  };
}
const slug = (p) => MB.slugOf(p);
const uidsIn = (db, p) => Object.keys(db.__get(MS.ROOT + '/msgs/' + slug(p)) || {}).map(Number).sort((a, b) => a - b);
const fullReads = (db, p) => db.__reads.filter((x) => x === MS.ROOT + '/msgs/' + slug(p)).length;
const run = (db, folders) => MS.runSync(deps(db), { client: fakeMail(folders), deadlineMs: 60000 });

test('★★ 창이 꽉 찬 칸에서 지워도 «바로 다음 회차»에 빠진다 — 통수가 그대로여도', async () => {
  /* 창 10통(3~12). 사람이 8 을 지우자 창 밖의 2 가 «되돌아와» 여전히 10통이다. */
  const folders = { INBOX: win(3, 12) };
  const db = fakeDb();
  await run(db, folders);
  await run(db, folders);                              // 하루 그물은 첫 회차에 이미 돌았다
  folders.INBOX = win(2, 12, [8]);
  const r = await run(db, folders);
  assert.equal(r.removed, 1, '통수가 그대로라 지운 것을 못 알아챘다 — 하루를 기다린다');
  assert.equal(uidsIn(db, 'INBOX').indexOf(8), -1, '지운 메일이 남아 있다');
  assert.ok(uidsIn(db, 'INBOX').indexOf(3) >= 0, '안 지운 메일이 빠졌다');
});

test('★★ 여러 칸에서 지워도 «한 회차에 모두» 빠진다 — 예전엔 한 회차에 한 칸뿐이었다', async () => {
  const folders = { INBOX: win(1, 10), 업무A: win(101, 110), 업무B: win(201, 210) };
  const db = fakeDb();
  await run(db, folders);
  await run(db, folders);
  folders.INBOX = win(1, 10, [5]);
  folders['업무A'] = win(101, 110, [105]);
  folders['업무B'] = win(201, 210, [205]);
  const r = await run(db, folders);
  assert.equal(r.removed, 3, '한 회차에 한 칸만 정리했다');
  assert.equal(uidsIn(db, '업무B').indexOf(205), -1);
});

test('★ 폴더 전체를 읽지 않고 뺀다 — 회차마다 하므로 이것이 요금을 가른다', async () => {
  const folders = { INBOX: win(3, 12) };
  const db = fakeDb();
  await run(db, folders);
  await run(db, folders);
  const before = fullReads(db, 'INBOX');
  folders.INBOX = win(2, 12, [8]);
  await run(db, folders);
  assert.equal(fullReads(db, 'INBOX'), before, '지운 것 하나를 찾으려고 폴더를 통째로 읽었다');
});

test('★ 바뀐 것이 없으면 번호 목록도 안 읽는다', async () => {
  const folders = { INBOX: win(1, 10) };
  const db = fakeDb();
  await run(db, folders);
  await run(db, folders);
  const n0 = db.__reads.filter((x) => x.indexOf(MS.ROOT + '/alive/') === 0).length;
  await run(db, folders);
  const n1 = db.__reads.filter((x) => x.indexOf(MS.ROOT + '/alive/') === 0).length;
  assert.equal(n1, n0, '아무것도 안 바뀌었는데 지난 목록을 읽었다');
});

test('★★ 창 밖으로 «밀려난» 것은 안 지운다 — 400 을 넘겨 쌓는 규칙(2026-08-28) 그대로', async () => {
  const folders = { INBOX: win(3, 12) };
  const db = fakeDb();
  await run(db, folders);
  await run(db, folders);
  folders.INBOX = win(5, 14);                          // 새 메일 13·14 가 오며 3·4 가 밀려났다
  const r = await run(db, folders);
  assert.equal(r.removed, 0, '밀려난 메일을 지운 것으로 보고 지웠다');
  assert.ok(uidsIn(db, 'INBOX').indexOf(3) >= 0 && uidsIn(db, 'INBOX').indexOf(14) >= 0);
});

test('★★ 번호 목록을 못 받은 회차는 아무것도 안 지우고, 지난 목록도 안 덮는다', async () => {
  const folders = { INBOX: win(1, 10) };
  const db = fakeDb();
  await run(db, folders);
  await run(db, folders);
  folders.INBOX = win(1, 10, [5]);
  const broken = fakeMail(folders);
  broken.search = async () => { throw new Error('접속이 끊겼습니다'); };
  const r1 = await MS.runSync(deps(db), { client: broken, deadlineMs: 60000 });
  assert.equal(r1.removed, 0, '번호 목록을 못 받았는데 지웠다');
  assert.equal(uidsIn(db, 'INBOX').length, 10);
  const r2 = await run(db, folders);
  assert.equal(r2.removed, 1, '실패한 회차가 지난 목록을 덮어 다음 회차가 지운 것을 놓쳤다');
});

test('★ 처음 도는 칸(지난 목록이 없음)은 아무것도 안 지운다', async () => {
  const folders = { INBOX: win(1, 10) };
  const db = fakeDb();
  const r = await run(db, folders);
  assert.equal(r.removed, 0);
  assert.equal(uidsIn(db, 'INBOX').length, 10);
});

test('★ 무엇을 뺐는지 회차 기록(meta.gone)에 남긴다 — 열려 있는 화면이 그것을 보고 바로 지운다', async () => {
  const folders = { INBOX: win(1, 10) };
  const db = fakeDb();
  await run(db, folders);
  await run(db, folders);
  folders.INBOX = win(1, 10, [5]);
  await run(db, folders);
  const meta = db.__get(MS.ROOT + '/meta') || {};
  assert.ok(Array.isArray(meta.gone) && meta.gone.indexOf(slug('INBOX') + ':5') >= 0,
    '뺀 메일을 기록에 안 남겼다 — 화면은 새로고침해야만 안다');
  /* 다음 회차에 뺀 것이 없으면 지난 목록이 남아 있으면 안 된다(화면이 같은 것을 또 지운다) */
  await run(db, folders);
  assert.ok(!(db.__get(MS.ROOT + '/meta') || {}).gone, '지난 회차의 gone 이 남았다');
});

test('번호 목록 줄이기·풀기는 서로 되돌아온다', () => {
  const u = [171876, 3, 99, 100, 100000];
  const enc = MB.aliveEncode(u);
  assert.deepEqual(MB.aliveDecode(enc), [3, 99, 100, 100000, 171876]);
  assert.deepEqual(MB.aliveDecode(''), []);
  assert.deepEqual(MB.aliveDecode(null), []);
  assert.ok(enc.length < u.join(',').length, '줄이지 않았다');
});
