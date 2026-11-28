/* 🔄 메일 화면이 다음메일을 «저절로» 따라온다 (대표 지시 2026-10-10)
   「다음 메일에서 삭제하면 연결해서 자동으로 삭제하고 실시간 연동되게 해 달라」

   ★ 예전에는 칸을 열 때 한 번 읽고 끝이라, 서버가 지운 것을 빼도 떠 있는 화면에는 그대로 남았다.
     이제 서버 회차 기록(mailbox/meta) 하나를 듣고, 바뀌면 ①뺀 것을 빼고 ②새 번호만 받아 붙인다.
   이 검사는 그것을 «실제로 돌려» 본다 — 가짜 실시간DB 를 끼운다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sliceFn } = require('./fnslice');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const fn = (name) => sliceFn(HTML, 'function ' + name + '(');

function makeBox(o) {
  const opt = o || {};
  const calls = { side: 0, page: 0, toast: [], folders: 0, asks: [], listeners: 0 };
  let listener = null;
  /* 서버에 있는 줄 — startAt 으로 물으면 그 번호 이상만 준다 */
  const server = opt.server || {};
  const db = {
    ref(p) {
      return {
        on(ev, cb) { calls.listeners++; listener = cb; },
        orderByKey() {
          return {
            startAt(k) {
              return { once: async () => {
                calls.asks.push(p + '>=' + k);
                const slug = p.split('/').pop();
                const all = server[slug] || {};
                const got = {};
                Object.keys(all).forEach((u) => { if (Number(u) >= Number(k)) got[u] = all[u]; });
                return { val: () => (Object.keys(got).length ? got : null) };
              } };
            },
          };
        },
      };
    },
  };
  const box = {
    console, Promise, Object, Array, Number, String, Math, Date,
    MB_ROOT: 'mailbox', MB_OLD_ID: '*old',
    Store: { mode: 'firebase' },
    firebase: { database: () => db },
    state: Object.assign({ view: 'mail', mailSent: 'box', mbOpen: null }, opt.state || {}),
    _mbMsgs: opt.msgs || {},
    _mbMeta: opt.meta || {},
    document: { activeElement: opt.active || null },
    mbAuthOk: () => true,
    mbMemoClear: () => {},
    /* 폴더 목록 읽기 — 실제처럼 끝나면 _mbErr 를 비우거나(성공) 채운다(실패). opt.foldersFail() 이 참이면 실패 */
    loadMailFolders: (cb) => {
      calls.folders++;
      box._mbErr = (opt.foldersFail && opt.foldersFail()) ? '읽지 못했습니다' : '';
      cb && cb();
    },
    _mbErr: '',
    renderPCSide: () => { calls.side++; },
    renderMailPage: () => { calls.page++; },
    toast: (m) => { calls.toast.push(m); },
  };
  vm.createContext(box);
  vm.runInContext(['mbDropRow', 'mbLiveStart', 'mbLiveApply'].map(fn).join('\n') +
    '\n;let _mbLiveOn = false, _mbLiveAt = 0;' +
    '\n;this.mbDropRow = mbDropRow; this.mbLiveStart = mbLiveStart; this.mbLiveApply = mbLiveApply;', box);
  box.__calls = calls;
  box.__fire = (val) => listener && listener({ val: () => val });
  return box;
}
const row = (s) => ({ s: s, d: 1 });

test('★★ 서버가 뺀 메일(meta.gone)을 화면에서도 뺀다 — 새로고침 없이', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a'), 6: row('b') }, 업무: { 9: row('c') } } });
  await b.mbLiveApply({ at: 2, rows: 0, gone: ['INBOX:5', '업무:9'] });
  assert.deepEqual(Object.keys(b._mbMsgs.INBOX), ['6'], '지운 메일이 화면에 남았다');
  assert.deepEqual(Object.keys(b._mbMsgs['업무']), []);
  assert.ok(b.__calls.page >= 1, '목록을 다시 안 그렸다');
});

test('★ 실시간DB 가 배열을 {0:…} 꼴로 줘도 뺀다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } } });
  await b.mbLiveApply({ at: 2, gone: { 0: 'INBOX:5' } });
  assert.equal(b._mbMsgs.INBOX['5'], undefined);
});

test('★★ 새 메일은 «새 번호만» 받는다 — 칸을 통째로 다시 읽지 않는다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a'), 6: row('b') }, '*old': { K: row('옛') } },
                      server: { INBOX: { 5: row('a'), 6: row('b'), 7: row('새것') } } });
  await b.mbLiveApply({ at: 2, rows: 1 });
  assert.deepEqual(b.__calls.asks, ['mailbox/msgs/INBOX>=7'], '새 번호만 묻지 않았거나 지난 메일 칸까지 물었다');
  assert.equal(b._mbMsgs.INBOX['7'].s, '새것', '새 메일이 화면에 안 붙었다');
});

test('★ 바뀐 것이 없는 회차에는 아무것도 안 묻고 안 그린다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } } });
  await b.mbLiveApply({ at: 2, rows: 0 });
  assert.equal(b.__calls.asks.length, 0);
  assert.equal(b.__calls.folders, 0);
  assert.equal(b.__calls.page, 0);
});

/* ── 다음메일에 새 폴더가 «생기면» 열려 있는 화면 옆줄에도 저절로 나타난다 (대표 지시 2026-11-22) ──
   새 폴더는 mbBins 가 업무별 칸으로 바로 세운다. 그런데 화면이 폴더 목록을 «다시 읽어야» 보인다.
   빈 새 폴더만 생긴 회차(새 메일 0 · 뺀 메일 없음)에도 다시 읽는지를 «돌려서» 본다. */
test('★★ 빈 새 폴더만 생긴 회차에도 폴더 목록을 다시 읽고 옆줄을 새로 그린다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } }, meta: { at: 1, folders: 12 } });
  await b.mbLiveApply({ at: 2, rows: 0, folders: 13 });
  assert.ok(b.__calls.folders >= 1, '새 폴더가 생겼는데 폴더 목록을 다시 읽지 않았다 — 새로고침 전에는 안 보인다');
  assert.ok(b.__calls.side >= 1, '폴더 목록을 읽고도 옆줄을 안 그렸다');
});

test('★ 폴더가 없어진 회차에도 다시 읽는다 — 없는 칸이 옆줄에 남지 않게', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } }, meta: { at: 1, folders: 13 } });
  await b.mbLiveApply({ at: 2, rows: 0, folders: 12 });
  assert.ok(b.__calls.folders >= 1, '폴더가 없어졌는데 폴더 목록을 다시 읽지 않았다');
});

test('★ 폴더 수가 그대로면 다시 읽지 않는다 — 회차마다 읽으면 요금만 는다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } }, meta: { at: 1, folders: 12 } });
  await b.mbLiveApply({ at: 2, rows: 0, folders: 12 });
  assert.equal(b.__calls.folders, 0, '폴더가 그대로인데 목록을 다시 읽었다');
  assert.equal(b.__calls.side, 0);
  assert.equal(b.__calls.page, 0);
});

test('★ 견줄 옛 값이 없으면(처음·옛 기록) 다시 읽지 않는다 — 있는 것을 «새 폴더»로 착각하지 않는다', async () => {
  const none = makeBox({ msgs: { INBOX: { 5: row('a') } }, meta: {} });
  await none.mbLiveApply({ at: 2, rows: 0, folders: 13 });
  assert.equal(none.__calls.folders, 0, '견줄 값이 없는데 다시 읽었다');
  const bad = makeBox({ msgs: { INBOX: { 5: row('a') } }, meta: { at: 1, folders: '12' } });
  await bad.mbLiveApply({ at: 2, rows: 0, folders: 13 });
  assert.equal(bad.__calls.folders, 0, '숫자가 아닌 옛 값을 견줬다');
});

test('★★ 폴더 수가 달라진 것은 «한 번만» 알아챈다 — 다음 회차에 또 읽지 않는다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } }, meta: { at: 1, folders: 12 } });
  await b.mbLiveApply({ at: 2, rows: 0, folders: 13 });
  const first = b.__calls.folders;
  await b.mbLiveApply({ at: 3, rows: 0, folders: 13 });
  assert.equal(b.__calls.folders, first, '이미 알아챈 폴더 수로 또 다시 읽었다');
});

test('★ 메일을 읽는 중이면 옆줄만 새로 그리고 목록은 건드리지 않는다 — 새 폴더 때문에 읽던 자리가 튀지 않게', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } }, meta: { at: 1, folders: 12 },
                      state: { mbOpen: { slug: 'INBOX', uid: '5' } } });
  await b.mbLiveApply({ at: 2, rows: 0, folders: 13 });
  assert.ok(b.__calls.side >= 1, '옆줄을 새로 안 그렸다');
  assert.equal(b.__calls.page, 0, '읽는 중에 목록을 다시 그렸다');
});

test('★★ 폴더 목록을 못 읽었으면 다음 회차에 «다시» 읽는다 — 조용한 메일함에서도 새 폴더가 결국 나타난다', async () => {
  let fail = true;
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } }, meta: { at: 1, folders: 12 }, foldersFail: () => fail });
  await b.mbLiveApply({ at: 2, rows: 0, folders: 13 });
  assert.equal(b.__calls.folders, 1);
  fail = false;
  await b.mbLiveApply({ at: 3, rows: 0, folders: 13 });
  assert.equal(b.__calls.folders, 2, '못 읽은 뒤 같은 폴더 수라고 다시 안 읽었다 — 새 폴더가 새로고침 전까지 안 나타난다');
  await b.mbLiveApply({ at: 4, rows: 0, folders: 13 });
  assert.equal(b.__calls.folders, 2, '읽은 뒤에도 또 읽었다');
});

/* ── 새 폴더에 «처음» 옮긴 메일이 따라온다 (자동 검토 2026-11-22 지적) ──
   새 폴더가 옆줄에 서면 화면이 그 칸을 한 번 읽어 «빈 칸»으로 담아 둔다(스스로 받아 오기·칸 열기).
   그 뒤 거기에 처음 옮긴 메일이 안 나타나면 「옮기면 자동으로 연결」이 반쪽이다. */
test('★★ 이미 읽어 둔 «빈» 새 폴더에 처음 옮긴 메일도 새로고침 없이 나타난다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') }, '새폴더': {} },
                      server: { '새폴더': { 3: row('옮겨 온 첫 메일') } } });
  await b.mbLiveApply({ at: 2, rows: 1, gone: ['INBOX:5'] });
  assert.ok(b.__calls.asks.some((a) => /새폴더/.test(a)), '빈 칸이라고 새 번호를 안 물었다');
  assert.ok(b._mbMsgs['새폴더']['3'], '옮긴 첫 메일이 화면에 안 붙었다');
  assert.equal(b._mbMsgs['새폴더']['3'].s, '옮겨 온 첫 메일');
});

test('★ 빈 칸이라도 새 메일이 없는 회차에는 안 묻는다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') }, '새폴더': {} } });
  await b.mbLiveApply({ at: 2, rows: 0 });
  assert.equal(b.__calls.asks.length, 0);
});

test('★ 아직 읽지 않은 칸은 묻지 않는다 — 열 때 읽는다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } },
                      server: { '안읽은칸': { 1: row('x') }, INBOX: { 5: row('a'), 6: row('b') } } });
  await b.mbLiveApply({ at: 2, rows: 1 });
  assert.ok(!b.__calls.asks.some((a) => /안읽은칸/.test(a)), '읽은 적 없는 칸을 물었다');
  assert.equal(b._mbMsgs['안읽은칸'], undefined);
});

test('★★ 열린 듣기 길로도 이어진다 — 회차 기록의 폴더 수가 바뀌면 옆줄이 따라온다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } }, meta: { at: 1, folders: 12 } });
  b.mbLiveStart();
  b.__fire({ at: 100, rows: 0, folders: 12 });     /* 첫 값은 이미 받은 것 */
  b.__fire({ at: 200, rows: 0, folders: 13 });
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(b.__calls.folders >= 1, '듣기 길로 온 폴더 수 변화를 놓쳤다');
});

test('★★ 메일을 읽는 중에는 목록을 다시 그리지 않는다 — 읽던 자리가 튄다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a'), 6: row('b') } },
                      state: { mbOpen: { slug: 'INBOX', uid: '6' } } });
  await b.mbLiveApply({ at: 2, gone: ['INBOX:5'] });
  assert.equal(b.__calls.page, 0, '읽는 중에 목록을 다시 그렸다');
  assert.ok(b.__calls.side >= 1, '옆줄 수는 고쳐야 한다');
});

test('★ 지금 읽는 메일이 지워졌으면 알려 준다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } }, state: { mbOpen: { slug: 'INBOX', uid: '5' } } });
  await b.mbLiveApply({ at: 2, gone: ['INBOX:5'] });
  assert.ok(b.__calls.toast.some((t) => /지웠거나/.test(t)), '보던 메일이 사라진 것을 말하지 않았다');
});

test('★★ 글을 치는 중에는 목록을 다시 그리지 않는다 — 치던 글자가 날아간다', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a'), 6: row('b') } }, active: { tagName: 'INPUT' } });
  await b.mbLiveApply({ at: 2, gone: ['INBOX:5'] });
  assert.equal(b.__calls.page, 0);
});

test('★ 듣기는 한 번만 붙고, 첫 값은 건너뛴다(이미 받은 것)', async () => {
  const b = makeBox({ msgs: { INBOX: { 5: row('a') } } });
  b.mbLiveStart(); b.mbLiveStart();
  assert.equal(b.__calls.listeners, 1, '듣기가 두 번 붙었다 — 회차마다 두 번씩 받는다');
  b.__fire({ at: 100, gone: ['INBOX:5'] });
  await new Promise((r) => setTimeout(r, 0));
  assert.ok(b._mbMsgs.INBOX['5'], '첫 값(이미 받은 것)을 새 소식으로 읽었다');
  b.__fire({ at: 200, gone: ['INBOX:5'] });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(b._mbMsgs.INBOX['5'], undefined, '다음 회차 소식을 안 받았다');
});

test('★★ 메일 칸을 열면 듣기를 붙인다', () => {
  assert.match(fn('openMailBox'), /mbLiveStart\(\)/, '칸을 열어도 서버 회차를 안 듣는다');
});

test('★★ 연 메일이 「지워졌다」고 오면 그 자리에서 목록에서 뺀다', () => {
  const f = fn('mbFetchBodyNow');
  assert.match(f, /j\.gone\)\s*mbDropRow\(slug, uid\)/, '지운 메일을 열었는데 목록에 그대로 둔다');
});
