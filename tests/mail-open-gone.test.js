'use strict';
/* 연 메일이 다음메일 그 칸에 «없을» 때 (대표 지시 2026-10-10 「다음 메일에서 삭제하면 자동으로 삭제」)
   ═══════════════════════════════════════════════════════════════════════════
   실측: 메일 열기 2,110번 중 65번(3%)이 「없다」였다. 두 가지가 같은 «없다»로 온다.
   ① 지웠거나 옮겼다(번호가 창 바닥보다 위) — 그 자리에서 우리 목록에서도 뺀다.
   ② 400통 창 밖으로 밀려났다(번호가 창 바닥보다 아래) — 지운 것이 아니므로 절대 안 뺀다.
   이 검사는 notHere 를 «실제로» 돌려 둘을 가르는지, 그리고 «없다»를 새 연결로 또 묻지
   않는지(withFolder) 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const MS_PATH = path.join(__dirname, '..', 'functions', 'mail-sync.js');
function fresh() { delete require.cache[require.resolve(MS_PATH)]; return require(MS_PATH); }

function depsWith(removed) {
  return {
    getDatabase: () => ({ ref: (p) => ({
      remove: async () => { removed.push(p); },
      once: async () => ({ val: () => 'INBOX' }),
    }) }),
  };
}
const clientWith = (uids) => ({ search: async () => uids });

test('★★ 창 바닥보다 위인데 없으면 — 지운(옮긴) 것이라 우리 목록에서도 뺀다', async () => {
  const MS = fresh();
  const removed = [];
  const e = await MS.notHere(depsWith(removed), clientWith([100, 101, 103]), 'INBOX-x', '102', false);
  assert.equal(e.status, 404);
  assert.equal(e.noRetry, true, '«없다»를 새 연결로 또 묻는다');
  assert.equal(e.extra.gone, true, '화면에 「뺐다」를 안 알린다 — 화면 목록에 그대로 남는다');
  assert.deepEqual(removed, [MS.ROOT + '/msgs/INBOX-x/102'], '지운 메일을 우리 목록에서 안 뺐다');
  assert.match(e.message, /지웠거나 다른 칸으로 옮긴/);
});

test('★★ 창 바닥보다 아래면 — 밀려난 것이라 «절대» 안 뺀다(400 을 넘겨 쌓는 규칙)', async () => {
  const MS = fresh();
  const removed = [];
  const e = await MS.notHere(depsWith(removed), clientWith([100, 101, 103]), 'INBOX-x', '50', false);
  assert.deepEqual(removed, [], '창 밖으로 밀려난 메일을 지웠다');
  assert.equal(e.extra.gone, false);
  assert.equal(e.extra.below, true);
  assert.match(e.message, /400통/, '왜 못 여는지 말하지 않는다');
});

test('★★ 번호 목록을 못 받으면 아무것도 안 뺀다', async () => {
  const MS = fresh();
  const removed = [];
  const bad = { search: async () => { throw new Error('끊김'); } };
  const e = await MS.notHere(depsWith(removed), bad, 'INBOX-x', '102', false);
  assert.deepEqual(removed, []);
  assert.equal(e.extra.gone, false);
});

test('★ 「없다」는 연결 탓이 아니다 — 붙어 둔 연결로 받은 «없다»를 새로 붙어 또 묻지 않는다', async () => {
  const MS = fresh();
  let 붙음 = 0;
  const deps = {
    getDatabase: () => ({ ref: () => ({ once: async () => ({ val: () => 'INBOX' }), remove: async () => {} }) }),
    mailUserAsync: async () => '370-6', mailPass: () => 'pw', MD: { loginIds: () => ['370-6'] },
    imapConnect: async () => { 붙음++; return { usable: true, async getMailboxLock() { return { release() {} }; }, logout: async () => {} }; },
  };
  await MS.withFolder(deps, 'inbox', async () => 1);                 /* 붙여서 살려 둔다 */
  await assert.rejects(MS.withFolder(deps, 'inbox', async () => {
    throw Object.assign(new Error('없다'), { status: 404, noRetry: true });
  }));
  assert.equal(붙음, 1, '«없다»를 받고 새로 붙어 한 번 더 물었다 — 그만큼 늦게 「없다」가 온다');
});

test('★★ 메일 열기가 «없다»를 notHere 로 가른다', () => {
  const src = require('node:fs').readFileSync(MS_PATH, 'utf8');
  const rd = src.slice(src.indexOf('readMailMessage: F'), src.indexOf('readOldMail: F'));
  assert.match(rd, /if \(!head\) throw await notHere\(/, '열 때 «없다»를 가르지 않는다');
  assert.match(src, /reply\(res, e && e\.status \? e\.status : 500, Object\.assign\([\s\S]{0,120}e\.extra/,
    '문지기가 화면에 gone 을 안 싣는다');
});
