/* 📦 지난 메일 «지금 열 수 있는 것이 얼마인가» — 부탁했을 때 한 번만 센다 (2026-10-31)
   ═══════════════════════════════════════════════════════════════════════════
   「지난 메일」 한 통이 «다음메일에 없습니다»로 나오는 일이 있었다. 다음메일 POP3 는 최근 3만 통만 목록(UIDL)에
   올리므로, 새 메일이 오면 우리가 담아 둔 옛 줄이 «목록에서 밀려나» 열 수 없게 될 수 있다. 얼마나 되는지 모른다.
   mailbox/old/probeAsk 를 true 로 적으면 다음 동기화 회차가 센다 → mailbox/old/probe 에 수만 남긴다.
   이 검사는 가짜 POP3 로 «실제로 돌려» 센 값이 맞는지, 부탁이 없으면 아무것도 안 하는지 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MS = require('../functions/mail-sync.js');
const ROOT = MS.ROOT;

function fakeDb(seed) {
  const data = JSON.parse(JSON.stringify(seed || {}));
  const get = (p) => String(p).split('/').reduce((o, k) => (o == null ? null : o[k]), data);
  const reads = [];
  const set = (p, v) => {
    const ks = String(p).split('/'); let o = data;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
    if (v === null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = v;
  };
  return { data, reads, get, ref: (p) => ({
    once: async () => { reads.push(String(p)); const v = get(p); return { val: () => (v === undefined ? null : v) }; },
    set: async (v) => set(p, v), remove: async () => set(p, null),
  }) };
}
function fakePop(ids, stats) {
  return async () => {
    if (stats) stats.opened = (stats.opened || 0) + 1;
    return {
      cmd: async (t) => {
        if (t !== 'UIDL') throw new Error('모르는 명령 ' + t);
        return { head: '+OK', body: ids.map((id, i) => (i + 1) + ' ' + id).join('\r\n') + '\r\n' };
      },
      close: async () => { if (stats) stats.closed = (stats.closed || 0) + 1; },
    };
  };
}
const deps = (db, pop) => ({ mailUserAsync: async () => 'u@example.com', mailPass: () => 'pw', openPop: pop });
const D = (y, m) => Date.UTC(y, m - 1, 15);

function seed(extra) {
  const old = {
    A1: { d: D(2024, 5), s: '비밀 제목1', e: 'x@example.com' },
    A2: { d: D(2024, 5), s: '비밀 제목2', e: 'y@example.com' },
    B1: { d: D(2025, 1), s: '비밀 제목3', e: 'z@example.com' },
    C1: { d: D(2025, 1), s: '비밀 제목4', e: 'w@example.com' },
  };
  const d = { mailbox: { old: { msgs: old } } };
  Object.assign(d.mailbox.old, extra || {});
  return d;
}

test('★★★ 부탁이 없으면 «아무것도 안 읽고 안 붙는다» — 3분마다 도는 자리라 값이 싸야 한다', async () => {
  const db = fakeDb(seed());
  const stats = {};
  const r = await MS.oldProbe(deps(db, fakePop(['A1'], stats)), db, Date.now() + 400000);
  assert.equal(r, null);
  assert.equal(stats.opened || 0, 0, '부탁이 없는데 다음메일에 붙었다');
  assert.deepEqual(db.reads, [ROOT + '/old/probeAsk'], '부탁이 없는데 작은 값 하나 말고 더 읽었다(옛 메일 9MB?): ' + db.reads.join(', '));
  assert.equal(db.get(ROOT + '/old/probe'), undefined);
});

test('★★★ 부탁하면 목록과 담아 둔 줄을 견주어 «수»를 적고, 부탁 표시를 지운다', async () => {
  const db = fakeDb(seed({ probeAsk: true }));
  const stats = {};
  /* 목록에는 A1·B1 만 있다(A2·C1 은 밀려났다) + 우리가 안 담은 다른 이름표 둘 */
  const r = await MS.oldProbe(deps(db, fakePop(['A1', 'B1', 'ZZ1', 'ZZ2'], stats)), db, Date.now() + 400000);
  assert.equal(r.listed, 4);
  assert.equal(r.stored, 4);
  assert.equal(r.found, 2, '열 수 있는 수가 다르다');
  assert.equal(r.missing, 2, '못 여는 수가 다르다');
  assert.equal(db.get(ROOT + '/old/probeAsk'), undefined, '부탁 표시를 안 지웠다 — 3분마다 되풀이한다');
  assert.equal(db.get(ROOT + '/old/probe/found'), 2, '결과를 안 적었다');
  assert.equal(stats.closed, 1, '다음메일 연결을 안 닫았다 — POP3 는 붙어 있는 동안 메일함을 잠근다');
});

test('★★ 달마다 «열 수 있는 것/없는 것»을 나눈다 — 어느 달부터 밀려났는지 보이게', async () => {
  const db = fakeDb(seed({ probeAsk: true }));
  const r = await MS.oldProbe(deps(db, fakePop(['A1', 'B1'])), db, Date.now() + 400000);
  assert.deepEqual(JSON.parse(JSON.stringify(r.byMonth)), {
    '2024-05': { found: 1, missing: 1 },
    '2025-01': { found: 1, missing: 1 },
  });
});

test('★★★ 사람 눈에 남기는 것은 «수»뿐이다 — 제목·주소·열쇠가 결과에 안 들어간다', async () => {
  const db = fakeDb(seed({ probeAsk: true }));
  await MS.oldProbe(deps(db, fakePop(['A1'])), db, Date.now() + 400000);
  const txt = JSON.stringify(db.get(ROOT + '/old/probe'));
  ['비밀 제목', 'example.com', 'A1', 'A2', 'B1', 'C1'].forEach((w) => assert.ok(txt.indexOf(w) < 0, '결과에 ' + w + ' 가 들어 있다'));
});

test('★★ 예산이 모자라면 «부탁 표시를 남긴 채» 물러난다 — 다음 회차에 한다', async () => {
  const db = fakeDb(seed({ probeAsk: true }));
  const stats = {};
  const r = await MS.oldProbe(deps(db, fakePop(['A1'], stats)), db, Date.now() + 30000);   // 90초 안 남았다
  assert.equal(r, null);
  assert.equal(db.get(ROOT + '/old/probeAsk'), true, '못 했는데 부탁 표시를 지웠다 — 영영 안 센다');
  assert.equal(stats.opened || 0, 0);
});

test('★ 동기화 회차가 «진짜 길(client 를 안 끼운 길)에서만» 부른다 · 못 세도 회차는 멀쩡하다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-sync.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(src, /if \(!o\.client\) \{\s*try \{ await oldProbe\(deps, db, deadline\); \} catch/, '회차가 센 것을 부르지 않거나 실패를 삼키지 않는다');
});
