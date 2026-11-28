/* 다음메일에서 폴더를 지우거나 이름을 바꾸면 푸른 쪽 옛 칸을 «숨긴다» (대표 지시 2026-11-28 「숨기기로 진행」)

   ★ 무엇이 문제였나 — 서버는 «지금 있는 폴더»만 적고, 없어진 폴더의 기록은 걷지 않았다.
     다음메일에서 폴더를 지우면 푸른 분류에 옛 칸이 계속 보이고, 이름을 바꾸면 «옛 이름 칸»과 «새 이름 칸»에
     같은 메일이 두 번 보였다.
   ★ 어떻게 — 서버(runSync)가 이번 폴더 목록에 없는 폴더에 «숨김 표시(gone)»만 남긴다. 기록·메일은 지우지 않는다.
     화면은 그 표시를 보고 업무별 칸·전체메일·담당자 셈에서 뺀다. 같은 폴더가 다시 생기면 표시가 저절로 사라진다.

   이 검사가 지키는 것
   ① 목록에 «없는» 폴더만 표시한다 · 이미 표시한 것·있는 것·스팸 종류·경로 없는 기록은 안 건드린다
   ② 목록이 수상하면(받은메일함이 없는 응답) 아무것도 숨기지 않는다 — 옆줄이 통째로 사라지면 안 된다
   ③ 서버는 «지우지 않는다» — 기록·담긴 메일·진행 표시가 그대로다 · 다시 생기면 표시가 사라진다
   ④ 같은 것을 회차마다 다시 적지 않는다(시각이 바뀌면 화면이 헛으로 다시 읽는다)
   ⑤ 화면은 표시된 폴더를 업무별 칸·전체메일 셈·담당자 셈에서 뺀다
   ⚠ 글자·개수를 못 박지 않는다 — «숨겨졌는가»·«남아 있는가»만 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const MS = require('../functions/mail-sync.js');
const MB = require('../functions/mail-box.js');
const { sliceFn } = require('./fnslice.js');

/* ══════ ① ② 순수 판단 — MB.vanishedFolders ══════ */
const L = (p, extra) => Object.assign({ path: p, name: p, flags: new Set(), specialUse: '' }, extra || {});
const rec = (p, extra) => Object.assign({ path: p, name: p, kind: 'custom' }, extra || {});
const S = (p) => MB.slugOf(p);

test('★★ 이번 목록에 «없는» 폴더만 골라낸다', () => {
  const known = { [S('INBOX')]: rec('INBOX', { kind: 'inbox' }), [S('1.자문사답변')]: rec('1.자문사답변'), [S('2.급여')]: rec('2.급여') };
  const r = MB.vanishedFolders(known, [L('INBOX'), L('2.급여')]);
  assert.deepEqual(r, [S('1.자문사답변')]);
});

test('★ 이미 숨김 표시가 있는 것은 다시 고르지 않는다 — 회차마다 시각이 바뀌면 안 된다', () => {
  const known = { [S('INBOX')]: rec('INBOX', { kind: 'inbox' }), [S('옛')]: rec('옛', { gone: 123 }) };
  assert.deepEqual(MB.vanishedFolders(known, [L('INBOX')]), []);
});

test('★★ 받은메일함이 없는 목록이면 아무것도 없어졌다고 하지 않는다 — 끊기거나 비어 온 응답', () => {
  const known = { [S('INBOX')]: rec('INBOX', { kind: 'inbox' }), [S('1.자문사답변')]: rec('1.자문사답변') };
  assert.deepEqual(MB.vanishedFolders(known, []), [], '빈 목록으로 칸을 숨겼다');
  assert.deepEqual(MB.vanishedFolders(known, [L('1.자문사답변')]), [], '받은메일함 없는 목록으로 칸을 숨겼다');
  assert.deepEqual(MB.vanishedFolders(known, null), []);
  assert.deepEqual(MB.vanishedFolders(null, [L('INBOX')]), []);
  assert.deepEqual(MB.vanishedFolders(undefined, undefined), []);
});

test('★ 스팸처럼 «안 가져오기로 한» 칸과 경로 없는 기록은 건드리지 않는다', () => {
  const known = { [S('Junk')]: rec('Junk', { kind: 'spam' }), X: { name: '경로 없음', kind: 'custom' } };
  assert.deepEqual(MB.vanishedFolders(known, [L('INBOX')]), []);
});

test('★ 목록에 «있으면» 거르기에 걸리는 폴더(스팸)여도 있는 것이다 — 숨기지 않는다', () => {
  const known = { [S('INBOX')]: rec('INBOX', { kind: 'inbox' }), [S('옛칸')]: rec('옛칸') };
  const noselect = L('옛칸', { flags: new Set(['\\Noselect']) });       // 열 수 없는 껍데기도 «있는» 폴더다
  assert.deepEqual(MB.vanishedFolders(known, [L('INBOX'), noselect]), []);
});

/* ══════ ③ ④ 한 회차를 돌려 본다 — 가짜 실시간DB·가짜 메일함 (mail-sync-run.test.js 와 같은 방식) ══════ */
function fakeDb() {
  const data = {};
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
  function ref(p0) {
    const p = p0 === undefined ? '' : String(p0);
    return {
      /* ⚠ 실제 실시간DB 처럼 «읽은 순간의 사본»을 준다 — 살아 있는 객체를 그대로 주면 읽은 뒤의 쓰기·지우기가
           읽어 둔 값까지 바꿔, «읽은 뒤 도중에 일어나는 일» 시험이 헛것이 된다(이 파일에서 한 번 겪었다). */
      once: async () => ({ val: () => { const v = get(p); return v == null ? null : JSON.parse(JSON.stringify(v)); } }),
      update: async (obj) => { Object.keys(obj).forEach((k) => put(p ? p + '/' + k : k, obj[k])); },
      set: async (v) => put(p, v),
      remove: async () => put(p, null),
      child: (c) => ref(p ? p + '/' + c : c),
    };
  }
  return { ref, __get: get };
}

function fakeMail(folders, hooks) {
  let opened = null;
  return {
    async list() {
      return Object.keys(folders).map((p) => ({ path: p, name: p, flags: new Set(folders[p].flags || []), specialUse: folders[p].specialUse || '' }));
    },
    async status(p) {
      if (hooks && hooks.onStatus) await hooks.onStatus(p);       // 회차 «도중»에 일어나는 일을 흉내 낸다
      const uids = Object.keys(folders[p].msgs).map(Number);
      return { messages: uids.length, unseen: uids.length,
        uidNext: (uids.length ? Math.max.apply(null, uids) : 0) + 1, uidValidity: 1 };
    },
    async getMailboxLock(p) { opened = p; return { release() {} }; },
    async *fetch(range, query) {
      const wantPart = query && Array.isArray(query.bodyParts) && query.bodyParts[0];
      if (wantPart) return;
      const want = {};
      String(range).split(',').forEach((part) => {
        if (part.indexOf(':') >= 0) {
          const [a, b] = part.split(':').map(Number);
          for (const k of Object.keys(folders[opened].msgs)) { const u = Number(k); if (u >= a && u <= b) want[u] = 1; }
        } else if (part) { want[Number(part)] = 1; }
      });
      const uids = Object.keys(folders[opened].msgs).map(Number).filter((u) => want[u]).sort((a, b) => a - b);
      for (const u of uids) {
        yield { uid: u, flags: new Set([]), size: 1000, envelope: folders[opened].msgs[u], bodyStructure: undefined };
      }
    },
    async search() { return Object.keys(folders[opened].msgs).map(Number); },
    async messageFlagsAdd() {},
    async logout() {},
  };
}
const envelope = (i) => ({ from: [{ name: '보낸이' + i, address: 's' + i + '@x.com' }], to: [{ address: 'me@x.com' }],
  subject: '제목 ' + i, date: new Date(1756000000000 + i * 1000).toISOString() });
const box = (n) => { const msgs = {}; for (let i = 1; i <= n; i++) msgs[String(i)] = envelope(i); return { msgs }; };
function deps(db) {
  return {
    getDatabase: () => db, getAuth: () => ({}), MD: { loginIds: () => ['me'] }, MAIL_REGION: 'asia-northeast3',
    setCors: () => {}, requireStaff: async () => ({ uid: 'u' }),
    mailUserAsync: async () => 'me@x.com', mailPass: () => 'pw',
    functions: { region: () => ({ runWith: () => ({ pubsub: { schedule: () => ({ timeZone: () => ({ onRun: () => null }) }) }, https: { onRequest: () => null } }) }) },
  };
}
const run = (db, folders, hooks) => MS.runSync(deps(db), { client: fakeMail(folders, hooks), deadlineMs: 60000 });
const folderRec = (db, p) => db.__get(MS.ROOT + '/folders/' + S(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('★★★ 다음메일에서 이름을 바꾼 폴더 — 옛 이름 기록에 숨김 표시, 새 이름은 보인다', async () => {
  const db = fakeDb();
  const before = { INBOX: box(2), '1.자문사답변': box(3) };
  const r1 = await run(db, before);
  assert.equal(r1.ok, true, r1.err);
  assert.equal(folderRec(db, '1.자문사답변').gone, undefined, '있는 폴더에 숨김 표시가 붙었다');

  const after = { INBOX: box(2), '1.자문사': box(3) };        // 다음메일에서 이름만 바꿨다
  const r2 = await run(db, after);
  assert.equal(r2.ok, true, r2.err);
  assert.ok(Number(folderRec(db, '1.자문사답변').gone) > 0, '이름 바뀐 옛 폴더에 숨김 표시가 없다 — 푸른 쪽에 옛 칸이 남는다');
  assert.equal(folderRec(db, '1.자문사').gone, undefined, '새 이름 폴더가 숨겨졌다');
  assert.ok(folderRec(db, '1.자문사'), '새 이름 폴더 기록이 없다');
  assert.equal(folderRec(db, 'INBOX').gone, undefined, '그대로인 폴더가 숨겨졌다');
});

test('★★★ 숨기기만 한다 — 옛 폴더의 기록·담긴 메일·진행 표시를 지우지 않는다', async () => {
  const db = fakeDb();
  await run(db, { INBOX: box(1), '옛칸': box(3) });
  const msgsBefore = Object.keys(db.__get(MS.ROOT + '/msgs/' + S('옛칸')) || {}).length;
  const syncBefore = db.__get(MS.ROOT + '/sync/' + S('옛칸'));
  assert.ok(msgsBefore > 0, '시험 준비가 틀렸다 — 담긴 메일이 있어야 한다');
  assert.ok(syncBefore, '시험 준비가 틀렸다 — 진행 표시가 있어야 한다');

  await run(db, { INBOX: box(1) });                           // 옛칸을 다음메일에서 지웠다
  assert.ok(Number(folderRec(db, '옛칸').gone) > 0);
  assert.equal(Object.keys(db.__get(MS.ROOT + '/msgs/' + S('옛칸')) || {}).length, msgsBefore, '담긴 메일이 지워졌다 — 숨기기만 해야 한다');
  assert.ok(db.__get(MS.ROOT + '/sync/' + S('옛칸')), '진행 표시가 지워졌다');
  assert.equal(folderRec(db, '옛칸').path, '옛칸', '폴더 기록이 지워지거나 덮였다');
});

test('★★ 같은 폴더가 다시 생기면 숨김 표시가 저절로 사라진다 — 되돌림', async () => {
  const db = fakeDb();
  await run(db, { INBOX: box(1), '옛칸': box(2) });
  await run(db, { INBOX: box(1) });
  assert.ok(Number(folderRec(db, '옛칸').gone) > 0);
  await run(db, { INBOX: box(1), '옛칸': box(2) });           // 되살렸다
  assert.equal(folderRec(db, '옛칸').gone, undefined, '다시 생겼는데 숨김 표시가 남았다 — 영영 안 보인다');
});

test('★★ 같은 폴더를 회차마다 다시 표시하지 않는다 — 시각이 바뀌면 화면이 헛으로 다시 읽는다', async () => {
  const db = fakeDb();
  await run(db, { INBOX: box(1), '옛칸': box(1) });
  await run(db, { INBOX: box(1) });
  const first = folderRec(db, '옛칸').gone;
  assert.ok(Number(first) > 0);
  await sleep(8);
  await run(db, { INBOX: box(1) });
  assert.equal(folderRec(db, '옛칸').gone, first, '이미 표시한 폴더의 표시를 회차마다 다시 적었다');
});

test('★★★ 받은메일함이 없는 목록(끊긴 응답)이면 어떤 칸도 숨기지 않는다', async () => {
  const db = fakeDb();
  await run(db, { INBOX: box(1), '1.자문사답변': box(2), '2.급여': box(2) });
  const r = await run(db, { '2.급여': box(2) });              // 받은메일함이 빠진 수상한 응답
  assert.equal(r.ok, true, r.err);
  assert.equal(folderRec(db, '1.자문사답변').gone, undefined, '수상한 목록으로 칸을 숨겼다');
  assert.equal(folderRec(db, 'INBOX').gone, undefined, '받은메일함이 숨겨졌다');
});

test('★★ 회차 도중에 그 폴더 기록이 이미 지워졌으면(앱에서 지우기·이름 바꾸기) 경로 없는 찌꺼기를 만들지 않는다', async () => {
  const db = fakeDb();
  await run(db, { INBOX: box(1), '옛칸': box(2) });
  /* 두 번째 회차 — 목록에서 옛칸이 사라졌고, 회차 «도중에» 관리자가 앱에서 그 기록을 지웠다(manageMailFolder 가 하는 일) */
  await run(db, { INBOX: box(1) }, {
    onStatus: async () => { await db.ref(MS.ROOT + '/folders/' + S('옛칸')).remove(); },
  });
  const left = folderRec(db, '옛칸');
  assert.ok(left == null, '지워진 기록 자리에 «숨김 표시만 든 찌꺼기»가 생겼다: ' + JSON.stringify(left));
});

test('★★ 목록에는 «있는데» 열 수 없게 된(껍데기) 폴더는 숨기지 않는다 — 거르기 «전» 목록으로 가려야 한다', async () => {
  const db = fakeDb();
  await run(db, { INBOX: box(1), '묶음': box(2) });
  /* 다음메일이 그 폴더를 «열 수 없는 껍데기»로 바꿨다 — 폴더는 여전히 있다(없어진 것이 아니다) */
  await run(db, { INBOX: box(1), '묶음': Object.assign(box(2), { flags: ['\\Noselect'] }) });
  assert.equal(folderRec(db, '묶음').gone, undefined, '목록에 있는 폴더를 «없어졌다»고 숨겼다');
});

test('★ 본문 찾기: 안 정하면 «아는 폴더 전부»에서 숨긴 폴더를 빼고, 정하면 그 폴더만 뒤진다', () => {
  const folders = { A: { path: 'a' }, B: { path: 'b', gone: 1 }, C: { path: 'c' } };
  assert.deepEqual(MB.searchSlugs(folders, undefined), ['A', 'C']);
  assert.deepEqual(MB.searchSlugs(folders, []), ['A', 'C']);
  assert.deepEqual(MB.searchSlugs(folders, ['B', 'Z']), ['B'], '정한 폴더 가운데 아는 것만 — 없는 폴더는 거른다');
  assert.deepEqual(MB.searchSlugs(null, null), []);
});

/* ══════ ⑤ 화면 — 표시된 폴더는 업무별 칸·전체메일 셈·담당자 셈에서 빠진다 ══════ */
const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
function screen(folders) {
  const ctx = {
    Object, String, Number, Array, JSON, RegExp,
    _mbFolders: folders, _mbBins: {}, _mbNoWho: {}, _mbBoxWho: {}, _mbMemo: null,
    mbOrderOf: () => 9999,
    mbWhoLive: (w) => String(w || ''),
    mbFolderBy: (s) => folders[s] || null,
  };
  vm.createContext(ctx);
  ['mbMemoOf', 'mbFolders', 'mbFolderOf', 'mbBins', 'mbSyncFolders', 'mbNoWhoBox', 'mbBoxWhoList', 'mbBoxTodo']
    .forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  ['CO_MAIL_KINDS', 'MB_MINE_KINDS'].forEach((n) => {
    const m = app.match(new RegExp('const ' + n + ' = [^;]*;'));
    assert.ok(m, n + ' 를 앱에서 찾지 못했습니다');
    vm.runInContext('var ' + m[0].slice('const '.length), ctx);
  });
  return ctx;
}
const F = {
  IN: { path: 'INBOX', name: '받은메일함', kind: 'inbox', order: 1 },
  KEEP: { path: '2.급여', name: '2.급여', kind: 'custom', order: 7 },
  OLD: { path: '1.자문사답변', name: '1.자문사답변', kind: 'custom', order: 7, gone: 1700000000000 },
};

test('★★★ 숨김 표시가 붙은 폴더는 푸른 분류 「업무별」 칸에 안 선다 — 있는 폴더는 그대로 선다', () => {
  const c = screen(F);
  const bins = c.mbBins().map((b) => b.id);
  assert.ok(bins.indexOf('KEEP') >= 0, '있는 폴더가 업무별 칸에서 빠졌다');
  assert.equal(bins.indexOf('OLD'), -1, '다음메일에서 없어진 폴더가 업무별 칸에 남았다');
});

test('★★ 폴더 목록(mbFolders·mbFolderOf)에서도 빠진다 — 전체메일·통수 셈이 같은 목록을 쓴다', () => {
  const c = screen(F);
  assert.equal(c.mbFolders().some((f) => f.slug === 'OLD'), false);
  assert.equal(c.mbFolderOf('custom').some((f) => f.slug === 'OLD'), false);
  assert.equal(c.mbFolders().some((f) => f.slug === 'KEEP'), true);
});

test('★★ 표시가 없어지면(다시 생김) 업무별 칸에 도로 선다', () => {
  const back = Object.assign({}, F, { OLD: Object.assign({}, F.OLD, { gone: undefined }) });
  const c = screen(back);
  assert.ok(c.mbBins().some((b) => b.id === 'OLD'));
});

test('★★ 사업장 메일 요약 셈(mbSyncFolders)에서 빠진다 — 이름 바꾼 폴더의 같은 메일을 두 번 세지 않게', () => {
  const c = screen(F);
  const slugs = c.mbSyncFolders().map((f) => f.slug);
  assert.ok(slugs.indexOf('KEEP') >= 0);
  assert.equal(slugs.indexOf('OLD'), -1);
});

test('★★ 담당자 「보는 사람 없는 칸」 점검(mbBoxTodo)에서 빠진다 — 정해 둔 칸·셈에 온 칸도', () => {
  const c = screen(F);
  c._mbBoxWho = { OLD: { who: ['홍길동'] }, KEEP: { who: ['김노무'] } };
  const slugs = c.mbBoxTodo({ OLD: 50 }).map((x) => x.slug);
  assert.equal(slugs.indexOf('OLD'), -1, '없어진 폴더가 점검 목록에 남았다');
  assert.ok(slugs.indexOf('KEEP') >= 0, '있는 폴더가 점검 목록에서 빠졌다');
});

/* ── 읽어 둔 표(_mbMsgs)에 이미 들어 있는 «없어진 폴더»의 메일 — 씨앗·옛 화면 (자동 검토 2026-11-28 지적) ──
   폴더 목록에서 빼도 전체메일·담당자·점검 셈은 읽어 둔 표를 «통째로» 훑는다. 표에서도 걷어야 같은 메일이 두 번 안 보인다. */
function dropCtx(o) {
  const ctx = {
    Object, String, Number, Array, JSON,
    _mbFolders: o.folders, _mbMsgs: o.msgs, _mbBins: o.bins === undefined ? {} : o.bins,
    _mbPut: o.put === undefined ? {} : o.put, _mbFilled: o.filled || {},
    cleared: 0, mbMemoClear() { ctx.cleared++; },
  };
  vm.createContext(ctx);
  vm.runInContext(sliceFn(app, 'function mbDropGoneRows('), ctx);
  return ctx;
}
const rows = () => ({ 1: { s: 'a' }, 2: { s: 'b' } });

test('★★★ 읽어 둔 표에 든 «없어진 폴더»의 메일을 걷는다 — 있는 폴더의 메일은 그대로', () => {
  const c = dropCtx({ folders: F, msgs: { OLD: rows(), KEEP: rows() }, filled: { OLD: 1, KEEP: 1 } });
  c.mbDropGoneRows();
  assert.equal(c._mbMsgs.OLD, undefined, '없어진 폴더의 메일이 읽어 둔 표에 남았다 — 전체메일에 두 번 보인다');
  assert.ok(c._mbMsgs.KEEP && Object.keys(c._mbMsgs.KEEP).length, '있는 폴더의 메일까지 걷었다');
  assert.equal(c._mbFilled.OLD, undefined, '걷은 칸의 «받아 온 표시»가 남았다 — 폴더가 다시 생겨도 도로 안 받아 온다');
  assert.equal(c._mbFilled.KEEP, 1);
  assert.ok(c.cleared >= 1, '걷고도 화면 셈(memo)을 안 비웠다');
});

test('★★★ 사람이 만든 칸이 이은 폴더·손으로 옮긴 쪽지가 가리키는 폴더는 걷지 않는다 — 사용자 자료는 안 건드린다', () => {
  const linked = dropCtx({ folders: F, msgs: { OLD: rows() }, bins: { MY: { n: '내 칸', l: 'OLD' } } });
  linked.mbDropGoneRows();
  assert.ok(linked._mbMsgs.OLD, '사람이 만든 칸이 이은 폴더의 메일을 걷었다');
  const put = dropCtx({ folders: F, msgs: { OLD: rows() }, put: { 'OLD:2': 'MY' } });
  put.mbDropGoneRows();
  assert.ok(put._mbMsgs.OLD, '손으로 옮긴 쪽지가 가리키는 폴더의 메일을 걷었다');
});

test('★★ 칸·쪽지를 아직 못 읽었으면 아무것도 걷지 않는다 — 모르면 안 건드린다', () => {
  const a = dropCtx({ folders: F, msgs: { OLD: rows() }, bins: null });
  a.mbDropGoneRows();
  assert.ok(a._mbMsgs.OLD, '칸을 못 읽었는데 걷었다');
  const b = dropCtx({ folders: F, msgs: { OLD: rows() }, put: null });
  b.mbDropGoneRows();
  assert.ok(b._mbMsgs.OLD, '쪽지를 못 읽었는데 걷었다');
  const c = dropCtx({ folders: null, msgs: { OLD: rows() } });
  assert.doesNotThrow(() => c.mbDropGoneRows());
});

test('★★ 어떤 오류도 던지지 않는다 — 폴더 목록 읽는 길 안에서 불려, 던지면 옆줄이 통째로 사라진다', () => {
  const c = dropCtx({ folders: F, msgs: { OLD: rows() } });
  c._mbPut = { get 'x'() { throw new Error('깨진 쪽지'); } };      // 일부러 깨뜨린다
  Object.defineProperty(c, '_mbBins', { get() { throw new Error('깨진 칸'); } });
  assert.doesNotThrow(() => c.mbDropGoneRows());
});

test('★★ 폴더 목록·씨앗·칸 읽기가 끝날 때마다 걷는다 — 세 길 모두에 이어져 있다', () => {
  ['loadMailFolders', 'mbSeedApply', 'mbEnsureBins'].forEach((n) => {
    assert.match(sliceFn(app, 'function ' + n + '('), /mbDropGoneRows\(\)/,
      n + ' 가 없어진 폴더의 메일을 걷지 않는다 — 그 길로 들어온 옛 메일이 전체메일에 남는다');
  });
});

test('★ 사용자가 직접 만든 푸른 분류 칸(저장된 칸)은 건드리지 않는다 — 옛 폴더에 이어 둔 것도 그대로 선다', () => {
  const c = screen(F);
  c._mbBins = { MY: { n: '내가 만든 칸', l: 'OLD' } };       // 내가 만든 칸이 없어진 폴더에 이어져 있다
  const bins = c.mbBins();
  assert.ok(bins.some((b) => b.id === 'MY'), '내가 만든 칸이 사라졌다 — 사용자 자료를 자동으로 건드렸다');
});
