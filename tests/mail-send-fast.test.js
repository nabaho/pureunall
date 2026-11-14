'use strict';
/* 메일 보내기 속도 — «겹쳐서 일하기» (대표 지시 2026-11-14 「메일 보내는 속도가 너무 늦다」)
 *
 * ■ 무슨 일이었나
 *   서버 로그(2026-11-09 6.1초 · 11-02 4.2초)에서 한 통 보내는 데 4~6초가 걸렸다. 서버는 배달(SMTP)이 «끝난 뒤에야»
 *   다음메일 IMAP 에 새로 접속·로그인·폴더 목록을 읽고, 그다음 사본을 올리고, 그다음 창고 정리·기록 쓰기를 차례로 했다.
 *
 * ■ 무엇을 지키나 — 시간이 아니라 «차례»를 잰다(시간은 기계마다 달라 검사를 흔든다)
 *   ① 다음메일 접속·로그인·목록은 배달이 «끝나기 전에» 이미 끝나 있다 — 배달과 겹친다. 올리기만 배달 뒤에 한다.
 *   ② 미리 접속해 둔 연결을 «다시 접속하지 않고» 쓴다. 미리 접속이 실패하면 예전처럼 새로 붙는다.
 *   ③ 배달이 실패하면 미리 열어 둔 연결을 닫고, 실패 응답을 그것 때문에 늦추지 않는다.
 *   ④ 사본 올리기 · sendLog · sentBox · 임시 파일 치우기가 «서로 기다리지 않고» 같이 시작한다 —
 *      그러면서 응답은 «넷이 다 끝난 뒤에» 한다(먼저 답하면 함수가 멈춰 사본·기록이 사라진다).
 *   ⑤ 어느 하나가 실패해도 배달 결과는 그대로(성공)이고 나머지는 끝까지 한다.
 *   ⑥ 묵은 임시 파일 훑기는 배달과 «같이» 시작하되, 응답 전에 끝을 기다린다.
 *   ⑦ 곳별 사본이 «아닌» 길(대량 발송)·다음메일이 «아닌» 우체국·사본 한도를 넘는 첨부·끄는 스위치에서는 미리 접속하지 않는다.
 *   ⑧ 단계별 시간 한 줄(`[mail-timing]`)을 남기되 주소·제목·글은 안 적는다.
 *
 * ⚠ nodemailer·imapflow 는 이 PC·CI 에 없다 — 가짜를 꽂는다(opts.nodemailer · opts.imapOpen · MA.buildRaw 대역).
 */
const test = require('node:test');
const { beforeEach } = test;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const F = path.join(__dirname, '..', 'functions');
const MD = require(path.join(F, 'mail-deliver.js'));
const MA = require(path.join(F, 'mail-archive.js'));

/* 로그인이 거절된 적이 있으면 서버가 한동안 미리 접속을 쉰다(접속막힘) — 그 기억이 검사끼리 번지지 않게 매번 비운다 */
beforeEach(() => { MD.resetPrefetchBreaker(); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = () => new Promise((r) => setImmediate(r));
/* 조건이 될 때까지 기다린다 — «시간 한도»가 있는 반복 확인이다.
   ⚠ 예전에는 «순서만 양보하며 200번»이었는데, 가짜 안에 타이머(느린 닫기)가 생기자 타이머보다 먼저 끝나 «가끔» 실패했다
     (2026-11-14, 여섯 번 중 한 번). 몇 번이 아니라 «얼마 동안»으로 기다린다. */
async function until(cond, label, ms) {
  const end = Date.now() + (ms || 2000);
  while (Date.now() < end) { if (cond()) return; await sleep(1); }
  if (cond()) return;
  throw new Error('기다리던 일이 안 일어났습니다: ' + label);
}
const settle = () => sleep(40);                 /* «더 일어날 일이 없다»를 보려고 타이머까지 흘려 보낸다 */
async function quiet(fn) {                      /* 경고 소음을 삼킨다 */
  const w = console.warn, l = console.log;
  console.warn = () => {}; console.log = () => {};
  try { return await fn(); } finally { console.warn = w; console.log = l; }
}

/* 일어난 일의 «자리»를 찾는다 — 안 일어났으면 -1 로 두지 않고 «바로 실패»한다.
   ⚠ indexOf 를 그대로 견주면 «안 일어난 일»(-1)이 «먼저 일어난 일»로 읽혀 순서 검사가 거짓으로 통과한다(2026-11-14 망가뜨려 보기에서 걸림). */
const at = (log, k) => { const i = log.indexOf(k); assert.ok(i >= 0, '★ ' + k + ' 이 안 일어났습니다: ' + log.join(',')); return i; };

const BOXES = [{ path: '보낸메일함', name: '보낸메일함' }];

/* 가짜 다음메일 IMAP — 일어난 일을 log 에 차례로 적는다 */
function fakeImap(log, o) {
  const x = o || {};
  const st = { opens: 0, openOpts: [], logouts: 0 };
  const client = {
    list: async () => {
      log.push('imap-list'); if (x.listGate) await x.listGate;
      if (x.listThrows) throw new Error('목록 실패'); return x.boxes || BOXES;
    },
    append: async () => {
      log.push('append-start'); await sleep(x.appendMs || 0);
      if (x.appendThrows) { log.push('append-fail'); throw new Error(x.appendMsg || '넣기 실패'); }
      log.push('append-end'); return { uid: 1 };
    },
    /* 닫는 데 시간이 걸린다(logoutMs) — 기다리는지 안 기다리는지가 겉으로 갈린다. 끝나야 «닫혔다»고 센다. */
    logout: async () => { if (x.logoutMs) await sleep(x.logoutMs); st.logouts++; log.push('imap-logout'); },
    close: () => { log.push('imap-close'); },
  };
  const open = async (opt) => {
    st.opens++; st.openOpts.push(opt); log.push('imap-open');
    if (x.openGate) await x.openGate;
    if (x.openThrows) throw new Error('접속 실패');
    /* 로그인이 거절되는 접속 — 처음 몇 번만(authFailTimes) 거절하고 그 뒤는 열어 준다. imapflow 는 authenticationFailed 를 단다. */
    if (x.authFailTimes && st.opens <= x.authFailTimes) throw Object.assign(new Error('Invalid credentials'), { authenticationFailed: true });
    return client;
  };
  return { open, client, st };
}

/* 가짜 발송기 — gate 가 있으면 «열릴 때까지» 배달이 안 끝난다.
   authFailUsers — 이 아이디로 로그인하면 EAUTH(로그인 거절)로 실패한다(다른 아이디는 성공). usedUsers 에 성공한 아이디가 쌓인다. */
function fakeSmtp(log, o) {
  const x = o || {};
  const used = [];
  return { usedUsers: used, createTransport: (cfg) => ({ sendMail: async (m) => {
    log.push('smtp-start');
    if (x.gate) await x.gate;
    if (x.authFailUsers && cfg && cfg.auth && x.authFailUsers.includes(cfg.auth.user)) {
      throw Object.assign(new Error('535 5.7.8 authentication failed'), { code: 'EAUTH' });
    }
    if (x.fail) throw x.fail;
    if (cfg && cfg.auth) used.push(cfg.auth.user);
    log.push('smtp-done');
  } }) };
}

/* 가짜 DB — 쓰는 줄을 log 에 적고(느리게 할 수도 있다) 던지게 할 수도 있다 */
function fakeDb(log, o) {
  const x = o || {};
  return { ref: (p) => ({
    once: async () => ({ val: () => null }),
    set: async () => {},
    push: async () => {
      const tag = /sendLog/.test(p) ? 'sendlog' : /sentBox/.test(p) ? 'sentbox' : 'db';
      log.push(tag + '-start'); await sleep(x.writeMs || 0);
      if (x.fail && x.fail === tag) { log.push(tag + '-fail'); throw new Error(tag + ' 실패'); }
      log.push(tag + '-end');
    },
  }) };
}
/* 가짜 창고 — 묵은 임시 파일 훑기(getFiles)를 log 에 적는다 */
function fakeStorage(log, ms) {
  return { getStorage: () => ({ bucket: () => ({
    getFiles: async () => { log.push('sweep-start'); await sleep(ms || 0); log.push('sweep-end'); return [[]]; },
    file: () => ({ delete: async () => { log.push('mailout-delete'); } }),
  }) }) };
}

const 편지 = { to: 'rcpt@example.invalid', subject: '속도 시험 제목입니다', body: '보냅니다', cardId: 'c1' };
async function run(over) {
  const orig = MA.buildRaw;                     /* nodemailer 가 없어 편지 굽기를 대역으로 */
  MA.buildRaw = async () => Buffer.from('raw');
  try {
    return await quiet(() => MD.deliver(Object.assign({ body: 편지, from: 'me@daum.net', pass: 'pw', envId: '370-6', byEmail: 'staff@example.invalid' }, over)));
  } finally { MA.buildRaw = orig; }
}

/* ════════════════════ 미리 접속(mail-archive) ════════════════════ */

test('① 미리 접속한 연결로 «다시 접속하지 않고» 올린다', async () => {
  const log = [], im = fakeImap(log);
  const pre = MA.prefetchSent({ loginIds: ['370-6', 'x'], pass: 'pw', openClient: im.open });
  const r = await MA.archiveSent({ raws: [Buffer.from('r')], prefetch: pre, openClient: im.open });
  assert.equal(r.ok, true); assert.equal(r.put, 1); assert.equal(r.viaPrefetch, true);
  assert.equal(im.st.opens, 1, '★ 미리 접속해 놓고 또 접속했습니다 — 속도를 못 줄입니다');
  assert.equal(im.st.logouts, 1, '쓴 연결은 닫아야 합니다(안 닫으면 함수가 안 끝난다)');
  assert.deepEqual(log.filter((x) => x === 'imap-list'), ['imap-list'], '폴더 목록을 두 번 읽었습니다');
});

test('② 미리 접속이 실패하면 예전처럼 «새로 붙어서» 올린다', async () => {
  const log = [];
  let n = 0;
  const im = fakeImap(log);
  const open = async (opt) => { n++; if (n === 1) { log.push('imap-open'); throw new Error('첫 접속 실패'); } return im.open(opt); };
  const pre = MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: open });
  const r = await MA.archiveSent({ raws: [Buffer.from('r')], prefetch: pre, openClient: open });
  assert.equal(r.ok, true, '★ 미리 접속 실패가 사본을 잃게 만듭니다');
  assert.equal(r.put, 1); assert.equal(r.viaPrefetch, false); assert.equal(n, 2);
});

test('② 미리 접속은 됐지만 보낸함을 못 찾으면 «다시 접속하지 않고» 아무 데도 안 넣는다', async () => {
  const log = [], im = fakeImap(log, { boxes: [{ path: 'INBOX', name: '받은메일함' }] });
  const pre = MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: im.open });
  const r = await MA.archiveSent({ raws: [Buffer.from('r')], prefetch: pre, openClient: im.open });
  assert.equal(r.ok, false); assert.equal(r.put, 0);
  assert.match(r.why, /보낸메일함/);
  assert.ok(!log.includes('append-start'), '엉뚱한 곳에 넣었습니다');
  assert.equal(im.st.opens, 1); assert.equal(im.st.logouts, 1);
});

test('④ 미리 접속의 아이디는 «첫 후보 하나»만 — 틀린 로그인을 배로 늘리지 않는다', async () => {
  const log = [], im = fakeImap(log);
  const pre = MA.prefetchSent({ loginIds: ['first', 'second', 'third'], pass: 'pw', openClient: im.open });
  await pre.done;
  assert.deepEqual(im.st.openOpts[0].loginIds, ['first'], '★ 여러 아이디로 두드립니다 — 자격이 틀리면 계정이 잠길 수 있습니다');
  await pre.release();
});

test('③ 쓰지 않은 미리 접속은 release 로 닫고, 다시 불러도 두 번 닫지 않는다', async () => {
  const log = [], im = fakeImap(log);
  const pre = MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: im.open });
  await pre.release(); await pre.release();
  assert.equal(im.st.logouts, 1, '연결이 남았거나 두 번 닫혔습니다');
});

test('③ 이미 쓴 연결은 release 가 건드리지 않는다 — 올리기 쪽이 이미 닫았다', async () => {
  const log = [], im = fakeImap(log);
  const pre = MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: im.open });
  await MA.archiveSent({ raws: [Buffer.from('r')], prefetch: pre, openClient: im.open });
  await pre.release();
  assert.equal(im.st.logouts, 1, '쓴 연결을 또 닫았습니다');
});

test('③ 사본을 건너뛰는 길(넣을 것 없음)에서도 미리 열어 둔 연결은 release 로 닫힌다', async () => {
  const log = [], im = fakeImap(log);
  const pre = MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: im.open });
  const r = await MA.archiveSent({ raws: [], prefetch: pre, openClient: im.open });
  assert.equal(r.put, 0);
  await pre.release();
  assert.equal(im.st.logouts, 1, '쓰지 않은 연결이 남았습니다');
});

test('⑤ 미리 접속은 «절대 던지지 않는다» — 접속·목록 실패도 값으로, 목록에서 막히면 연결을 닫는다', async () => {
  const a = fakeImap([], { openThrows: true });
  const r1 = await MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: a.open }).done;
  assert.equal(r1.client, null); assert.match(r1.why, /접속 실패/);
  const log = [], b = fakeImap(log, { listThrows: true });
  const r2 = await MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: b.open }).done;
  assert.equal(r2.client, null); assert.match(r2.why, /목록 실패/);
  assert.equal(b.st.logouts, 1, '접속은 됐는데 목록에서 막힌 연결이 남았습니다');
});

test('⑦ 끄는 스위치(MAIL_ARCHIVE_OFF)가 켜져 있으면 접속하지 않는다', async () => {
  const old = process.env.MAIL_ARCHIVE_OFF; process.env.MAIL_ARCHIVE_OFF = '1';
  try {
    const log = [], im = fakeImap(log);
    const r = await MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: im.open }).done;
    assert.equal(im.st.opens, 0, '스위치를 껐는데 접속했습니다');
    assert.equal(r.client, null);
  } finally { if (old === undefined) delete process.env.MAIL_ARCHIVE_OFF; else process.env.MAIL_ARCHIVE_OFF = old; }
});

/* ════════════════════ 배달 본체(mail-deliver) ════════════════════ */

test('① 다음메일 접속·로그인·목록이 배달이 «끝나기 전에» 끝나 있다 — 올리기만 배달 뒤에 한다', async () => {
  const log = [], im = fakeImap(log);
  let open; const gate = new Promise((r) => { open = r; });
  const p = run({ db: fakeDb(log), nodemailer: fakeSmtp(log, { gate }), imapOpen: im.open });
  await until(() => log.includes('smtp-start'), '배달 시작');
  await until(() => log.includes('imap-list'), '배달이 끝나기 전에 미리 접속·목록');
  assert.ok(!log.includes('smtp-done'), '배달이 아직 안 끝난 상태여야 한다(검사 전제)');
  assert.ok(!log.includes('append-start'), '배달 전에 올렸습니다 — 안 나간 메일이 보낸함에 남을 수 있다');
  open();
  const r = await p;
  assert.equal(r.ok, true);
  assert.ok(at(log, 'smtp-done') < at(log, 'append-start'), '올리기는 배달 «뒤»에 한다');
  assert.equal(im.st.opens, 1, '★ 미리 접속해 놓고 또 접속했습니다');
  assert.equal(im.st.logouts, 1);
});

test('③ 배달이 실패하면 미리 열어 둔 연결을 닫는다 — 실패 응답을 그것 때문에 늦추지 않는다', async () => {
  const log = [];
  let release; const openGate = new Promise((r) => { release = r; });
  const im = fakeImap(log, { openGate });                 /* 접속이 아직 안 끝난 채로 */
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log, { fail: new Error('boom') }), imapOpen: im.open, prefetchReleaseMs: 20 });
  assert.equal(r.ok, false, '배달 실패가 성공으로 보입니다');
  assert.ok(!log.includes('append-start'), '못 보낸 메일의 사본을 올렸습니다');
  assert.ok(!log.includes('imap-logout'), '(검사 전제) 접속이 아직 안 끝났다');
  release();                                               /* 이제 접속이 끝난다 */
  await until(() => log.includes('imap-logout'), '쓰이지 않은 연결 닫기');
  assert.equal(im.st.logouts, 1);
  assert.ok(!log.includes('sentbox-start'), '못 보낸 메일이 보낸 기록에 남았습니다');
});

test('④ 사본 올리기·sendLog·sentBox 가 «기다리지 않고» 같이 시작한다 — 응답은 넷이 다 끝난 뒤', async () => {
  const log = [], im = fakeImap(log, { appendMs: 60 });
  const p = run({ db: fakeDb(log, { writeMs: 60 }), nodemailer: fakeSmtp(log), imapOpen: im.open });
  const r = await p;
  log.push('resolved');
  assert.equal(r.ok, true);
  const first = (k) => log.indexOf(k);
  const ends = ['append-end', 'sendlog-end', 'sentbox-end'].map(first);
  ['append-start', 'sendlog-start', 'sentbox-start'].forEach((s) => {
    assert.ok(first(s) > 0, s + ' 이 안 일어났습니다');
    assert.ok(first(s) < Math.min.apply(null, ends), '★ ' + s + ' 이 앞 일이 끝나길 기다렸다 시작합니다 — 합이 응답에 얹힙니다: ' + log.join(','));
  });
  ends.forEach((e) => assert.ok(e > 0 && e < first('resolved'), '★ 응답이 끝나기 전에 답했습니다 — 함수가 멈추면 사본·기록이 사라집니다'));
});

test('⑤ 사본 올리기가 실패해도 배달은 성공이고 기록은 끝까지 쓴다', async () => {
  const log = [], im = fakeImap(log, { appendThrows: true });
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log), imapOpen: im.open });
  assert.equal(r.ok, true, '★ 사본 실패가 「안 나갔다」로 보고됩니다 — 대표가 두 번 보냅니다');
  assert.ok(log.includes('sentbox-end') && log.includes('sendlog-end'));
  assert.equal(im.st.logouts, 1, '실패해도 연결은 닫아야 합니다');
});

test('⑤ 기록(sentBox)이 실패해도 배달은 성공이고 사본은 끝까지 올린다', async () => {
  const log = [], im = fakeImap(log);
  const r = await run({ db: fakeDb(log, { fail: 'sentbox' }), nodemailer: fakeSmtp(log), imapOpen: im.open });
  assert.equal(r.ok, true);
  assert.ok(log.includes('append-end'), '기록 실패가 사본을 막았습니다');
  assert.ok(log.includes('sendlog-end'), '기록 실패가 명함 기록을 막았습니다');
});

test('④ 쓴 임시 파일 치우기도 같이 시작한다(창고 첨부가 있을 때) — 응답 전에 끝난다', async () => {
  const log = [], im = fakeImap(log, { appendMs: 40 });
  const storage = { getStorage: () => ({ bucket: () => ({
    file: () => ({ getMetadata: async () => [{ size: 100 }], download: async () => [Buffer.alloc(100)], delete: async () => { log.push('mailout-delete-start'); await sleep(40); log.push('mailout-delete-end'); } }),
    getFiles: async () => [[]],
  }) }) };
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log), imapOpen: im.open, deps: storage, uid: 'u1',
    body: Object.assign({}, 편지, { files: [{ path: 'pucards/mailout/u1/a', name: 'a.pdf' }] }) });
  log.push('resolved');
  assert.equal(r.ok, true);
  assert.ok(at(log, 'mailout-delete-start') < at(log, 'append-end'), '임시 파일 치우기가 사본 올리기가 끝나길 기다렸습니다');
  /* 치우기가 «기록 쓰기»를 막으면 안 된다 — 치우기가 끝나기 «전에» 기록 쓰기가 이미 시작했다 */
  assert.ok(at(log, 'sentbox-start') < at(log, 'mailout-delete-end'), '★ 임시 파일 치우기가 끝나길 기다렸다 기록을 씁니다 — 합이 응답에 얹힙니다');
  assert.ok(at(log, 'sendlog-start') < at(log, 'mailout-delete-end'));
  assert.ok(at(log, 'mailout-delete-end') < at(log, 'resolved'), '치우기가 끝나기 전에 답했습니다');
});

test('③ 편지 굽기(사본 만들기)가 실패해도 — 미리 열어 둔 연결을 닫고 배달은 성공이다', async () => {
  const log = [], im = fakeImap(log);
  const orig = MA.buildRaw; MA.buildRaw = async () => { throw new Error('굽기 실패'); };
  let r;
  try {
    r = await quiet(() => MD.deliver({ body: 편지, from: 'me@daum.net', pass: 'pw', envId: '370-6', byEmail: 'staff@example.invalid',
      db: fakeDb(log), nodemailer: fakeSmtp(log), imapOpen: im.open }));
  } finally { MA.buildRaw = orig; }
  assert.equal(r.ok, true, '사본 굽기 실패가 「안 나갔다」로 보고됩니다');
  assert.ok(!log.includes('append-start'), '굽지도 못했는데 올렸습니다');
  assert.equal(im.st.logouts, 1, '★ 쓰이지 않은 미리 접속이 남았습니다 — 연결이 샙니다');
  assert.ok(log.includes('sentbox-end'));
});

test('⑥ 묵은 임시 파일 훑기는 배달과 «같이» 시작하고, 응답 전에 끝을 기다린다', async () => {
  const log = [], im = fakeImap(log);
  let open; const gate = new Promise((r) => { open = r; });
  const p = run({ db: fakeDb(log), nodemailer: fakeSmtp(log, { gate }), imapOpen: im.open, deps: fakeStorage(log, 30), uid: 'u1' });
  await until(() => log.includes('smtp-start'), '배달 시작');
  assert.ok(log.includes('sweep-start'), '★ 훑기가 배달 뒤에야 시작합니다 — 그 시간이 응답에 얹힙니다');
  assert.ok(!log.includes('smtp-done'), '(검사 전제) 배달이 아직 안 끝났다');
  open();
  await p; log.push('resolved');
  assert.ok(at(log, 'sweep-end') < at(log, 'resolved'), '훑기가 끝나기 전에 답했습니다');
});

test('⑥ 배달이 실패해도 훑기는 돌고 끝을 기다린다 — 예전 약속 그대로', async () => {
  const log = [];
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log, { fail: new Error('x') }), imapOpen: fakeImap(log).open, deps: fakeStorage(log, 20), uid: 'u1' });
  log.push('resolved');
  assert.equal(r.ok, false);
  assert.ok(at(log, 'sweep-end') < at(log, 'resolved'), '배달이 실패하면 훑기를 안 기다리고 답합니다');
});

test('⑦ 대량 발송(사본 건너뜀)에서는 미리 접속하지 않는다', async () => {
  const log = [], im = fakeImap(log);
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log), imapOpen: im.open, copy: { mode: 'skip' } });
  assert.equal(r.ok, true);
  assert.equal(im.st.opens, 0, '★ 사본을 안 넣는 줄이 다음메일에 접속했습니다 — 대량 발송 한 줄마다 접속이 한 번씩 는다');
});

test('⑦ 다음메일이 아닌 우체국(구글)에서는 «배달 전에» 접속하지 않는다', async () => {
  const log = [], im = fakeImap(log);
  await run({ db: fakeDb(log), nodemailer: fakeSmtp(log), imapOpen: im.open, from: 'news@fairrunlabor.com' });
  const smtpDone = log.indexOf('smtp-done'), imapOpen = log.indexOf('imap-open');
  assert.ok(smtpDone > 0);
  assert.ok(imapOpen < 0 || imapOpen > smtpDone, '구글 우체국인데 다음메일 접속을 배달과 겹쳐 시작했습니다');
});

test('⑦ 사본 한도를 넘는 첨부는 미리 접속하지 않는다 — 어차피 사본을 건너뛴다', async () => {
  const log = [], im = fakeImap(log);
  const big = 'data:application/pdf;base64,' + Buffer.alloc(11 * 1024 * 1024).toString('base64');
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log), imapOpen: im.open,
    body: Object.assign({}, 편지, { files: [{ name: 'big.pdf', dataUrl: big }] }) });
  assert.equal(r.ok, true, '(검사 전제) 큰 첨부도 배달은 된다');
  assert.equal(im.st.opens, 0, '★ 어차피 건너뛸 사본인데 접속했습니다');
});

test('⑦ 끄는 스위치가 켜져 있으면 접속하지 않는다 — 배달은 그대로 된다', async () => {
  const old = process.env.MAIL_ARCHIVE_OFF; process.env.MAIL_ARCHIVE_OFF = '1';
  try {
    const log = [], im = fakeImap(log);
    const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log), imapOpen: im.open });
    assert.equal(r.ok, true);
    assert.equal(im.st.opens, 0);
    assert.ok(log.includes('sentbox-end'), '스위치가 기록 쓰기까지 막았습니다');
  } finally { if (old === undefined) delete process.env.MAIL_ARCHIVE_OFF; else process.env.MAIL_ARCHIVE_OFF = old; }
});

test('⑧ 단계별 시간 한 줄을 남긴다 — 숫자와 짧은 말뿐, 주소·제목·글은 없다', async () => {
  const lines = [];
  const orig = MA.buildRaw; MA.buildRaw = async () => Buffer.from('raw');
  const w = console.warn, l = console.log; console.warn = () => {}; console.log = (...a) => lines.push(a.join(' '));
  try {
    await MD.deliver({ db: fakeDb([]), body: 편지, from: 'me@daum.net', pass: 'pw', envId: '370-6', byEmail: 'staff@example.invalid',
      nodemailer: fakeSmtp([]), imapOpen: fakeImap([]).open });
  } finally { console.warn = w; console.log = l; MA.buildRaw = orig; }
  const line = lines.find((x) => x.indexOf('[mail-timing]') === 0);
  assert.ok(line, '★ 단계별 시간 줄이 없습니다 — 어디가 느린지 못 잽니다');
  const j = JSON.parse(line.slice('[mail-timing]'.length));
  ['총', '첨부모으기', '서명열람준비', '배달', '배달뒤'].forEach((k) => assert.equal(typeof j[k], 'number', k + ' 이 숫자가 아닙니다'));
  assert.ok(j.미리접속 === '썼음' && j.사본 === '올림·미리접속', '미리 접속 여부와 사본 결과가 안 적혔습니다: ' + line);
  ['rcpt@example.invalid', '속도 시험 제목', '보냅니다', 'staff@example.invalid', 'me@daum.net'].forEach((s) =>
    assert.ok(line.indexOf(s) < 0, '★ 로그에 개인정보(' + s + ')가 찍혔습니다'));
});

/* ════════════════════ 2026-11-14 보안 검토 지적 4건 ════════════════════ */

test('★★ 지적1 — 묵은 훑기가 «이번 요청이 붙이려는» 하루 넘은 첨부를 지우지 않는다(첨부가 조용히 빠지던 길)', async () => {
  const log = [], im = fakeImap(log);
  const 이틀 = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const storage = { getStorage: () => ({ bucket: () => ({
    getFiles: async () => [[
      { name: 'pucards/mailout/u1/a', metadata: { timeCreated: 이틀 }, delete: async () => { log.push('stale-delete:a'); } },
      { name: 'pucards/mailout/u1/b', metadata: { timeCreated: 이틀 }, delete: async () => { log.push('stale-delete:b'); } },
    ]],
    file: (p) => ({ getMetadata: async () => [{ size: 100 }], download: async () => [Buffer.alloc(100)], delete: async () => { log.push('used-delete:' + p); } }),
  }) }) };
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log), imapOpen: im.open, deps: storage, uid: 'u1',
    body: Object.assign({}, 편지, { files: [{ path: 'pucards/mailout/u1/a', name: 'a.pdf' }] }) });
  assert.equal(r.ok, true);
  assert.equal(r.files, 1, '★ 하루 넘은 첨부가 훑기에 지워져 첨부 없이 나갔습니다');
  assert.ok(!log.includes('stale-delete:a'), '★ 지금 붙이려는 파일을 묵은 것으로 지웠습니다');
  assert.ok(log.includes('stale-delete:b'), '붙이려는 것이 «아닌» 묵은 파일은 예전처럼 치워야 합니다');
  assert.ok(log.includes('used-delete:pucards/mailout/u1/a'), '쓴 파일은 보낸 뒤 치워야 합니다');
});

test('★★ 지적2 — 배달이 실패하면 «닫을 때까지» 기다리고 응답한다(응답 뒤 멈춰도 연결이 안 남는다)', async () => {
  const log = [], im = fakeImap(log, { logoutMs: 40 });         /* 닫는 데 시간이 걸린다 — 안 기다리면 응답 때 아직 안 닫혀 있다 */
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log, { fail: new Error('boom') }), imapOpen: im.open });
  assert.equal(r.ok, false);
  assert.equal(im.st.logouts, 1, '★ 응답할 때 미리 연 연결이 아직 열려 있습니다 — 응답 뒤 함수가 멈추면 샙니다');
});

test('지적2 — 접속이 «아직 안 끝났어도» 응답은 정해진 시간 이상 안 늦고, 늦게 끝난 접속은 스스로 닫힌다', async () => {
  const log = [];
  let release; const openGate = new Promise((r) => { release = r; });
  const im = fakeImap(log, { openGate });
  const t0 = Date.now();
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log, { fail: new Error('boom') }), imapOpen: im.open, prefetchReleaseMs: 50 });
  assert.equal(r.ok, false);
  assert.ok(Date.now() - t0 < 800, '★ 실패 응답이 미리 접속 때문에 한참 늦어졌습니다');
  assert.equal(im.st.logouts, 0, '(검사 전제) 접속이 아직 안 끝났다');
  release();
  await until(() => im.st.logouts === 1, '늦게 끝난 접속이 스스로 닫힘');
  assert.ok(!log.includes('imap-list'), '★ 쓸 일이 없어진 연결로 폴더 목록을 읽었습니다 — 닫히기 전에 헛일을 합니다');
});

test('지적2 — 접속은 끝났는데 «목록을 읽는 사이» 쓸 일이 없어지면 release 가 «바로» 닫는다 — 목록이 끝나길 기다리지 않고, 두 번 닫지도 않는다', async () => {
  const log = [];
  let release; const listGate = new Promise((r) => { release = r; });
  const im = fakeImap(log, { listGate });
  const pre = MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: im.open });
  await until(() => log.includes('imap-list'), '목록 읽기 시작');
  await pre.release(10);                                  /* 배달이 실패했다 — 목록은 아직 안 끝났다 */
  assert.equal(im.st.logouts, 1, '★ 접속된 연결을 목록이 끝나길 기다리며 열어 둡니다 — 응답 뒤 함수가 멈추면 샙니다');
  assert.equal(pre.state.client, null, '닫은 연결을 그대로 들고 있습니다');
  release();                                              /* 늦게 목록이 끝난다 */
  await settle();
  assert.equal(im.st.logouts, 1, '★ 같은 연결을 두 번 닫았습니다');
});

test('★★ 지적3 — 시간 로그에는 서버 오류 문구(주소가 섞일 수 있다)를 적지 않는다', async () => {
  const lines = [];
  const orig = MA.buildRaw; MA.buildRaw = async () => Buffer.from('raw');
  const w = console.warn, l = console.log; console.warn = () => {}; console.log = (...a) => lines.push(a.join(' '));
  try {
    await MD.deliver({ db: fakeDb([]), body: 편지, from: 'me@daum.net', pass: 'pw', envId: '370-6', byEmail: 'staff@example.invalid',
      nodemailer: fakeSmtp([]), imapOpen: fakeImap([], { appendThrows: true, appendMsg: 'private@example.invalid 로 가는 사본을 서버가 거절' }).open });
  } finally { console.warn = w; console.log = l; MA.buildRaw = orig; }
  const line = lines.find((x) => x.indexOf('[mail-timing]') === 0);
  assert.ok(line, '시간 줄이 없습니다');
  assert.ok(line.indexOf('private@example.invalid') < 0, '★ 서버 오류 문구가 시간 로그에 찍혔습니다(개인정보)');
  assert.equal(JSON.parse(line.slice('[mail-timing]'.length)).사본, '못함', '실패는 고정된 말(못함)로만 적어야 합니다');
});

test('지적3 — 사본을 «건너뛴» 것(스위치)은 못함이 아니라 건너뜀으로 적는다', async () => {
  const old = process.env.MAIL_ARCHIVE_OFF; process.env.MAIL_ARCHIVE_OFF = '1';
  const lines = [];
  const orig = MA.buildRaw; MA.buildRaw = async () => Buffer.from('raw');     /* nodemailer 가 없어 굽기를 대역으로 */
  const w = console.warn, l = console.log; console.warn = () => {}; console.log = (...a) => lines.push(a.join(' '));
  try {
    await MD.deliver({ db: fakeDb([]), body: 편지, from: 'me@daum.net', pass: 'pw', envId: '370-6', byEmail: 'staff@example.invalid',
      nodemailer: fakeSmtp([]), imapOpen: fakeImap([]).open });
  } finally { console.warn = w; console.log = l; MA.buildRaw = orig; if (old === undefined) delete process.env.MAIL_ARCHIVE_OFF; else process.env.MAIL_ARCHIVE_OFF = old; }
  const j = JSON.parse(lines.find((x) => x.indexOf('[mail-timing]') === 0).slice('[mail-timing]'.length));
  assert.equal(j.사본, '건너뜀', '스위치로 건너뛴 것이 «' + j.사본 + '»으로 찍혔습니다 — 로그가 거짓말을 합니다');
});

test('★★ 지적4 — 미리 접속에서 로그인이 거절된 아이디를 사본 단계에서 «다시 두드리지 않는다»', async () => {
  const log = [], im = fakeImap(log, { authFailTimes: 1 });
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log), imapOpen: im.open });
  assert.equal(r.ok, true, '사본 로그인 거절이 배달 결과를 흔듭니다');
  assert.equal(im.st.opens, 2, '(검사 전제) 미리 접속 1회 + 사본 단계 새 접속 1회');
  assert.deepEqual(im.st.openOpts[0].loginIds, ['370-6'], '미리 접속은 첫 후보 하나만');
  assert.ok(im.st.openOpts[1].loginIds.length >= 1 && !im.st.openOpts[1].loginIds.includes('370-6'),
    '★ 거절된 아이디(370-6)를 사본 단계에서 또 두드립니다 — 같은 틀린 로그인이 두 번이라 계정이 잠길 수 있습니다: ' + JSON.stringify(im.st.openOpts[1].loginIds));
});

test('지적4 — 거절된 아이디밖에 없으면 사본 단계에서 «아예 다시 시도하지 않고» 건너뛴다', async () => {
  const log = [], im = fakeImap(log, { authFailTimes: 5 });
  const pre = MA.prefetchSent({ loginIds: ['only'], pass: 'pw', openClient: im.open });
  const r = await MA.archiveSent({ raws: [Buffer.from('r')], loginIds: ['only'], prefetch: pre, openClient: im.open });
  assert.equal(r.ok, false); assert.equal(r.put, 0);
  assert.match(r.why, /거절/);
  assert.equal(im.st.opens, 1, '★ 거절된 아이디를 한 번 더 두드렸습니다');
});

test('★★ 지적4 — SMTP 로그인이 거절되면 서버가 한동안 미리 접속을 쉰다 — 틀린 로그인을 하나 더 얹지 않는다', async () => {
  const log1 = [];
  const bad = Object.assign(new Error('535 5.7.8 authentication failed'), { code: 'EAUTH' });
  const r1 = await run({ db: fakeDb(log1), nodemailer: fakeSmtp(log1, { fail: bad }), imapOpen: fakeImap(log1).open });
  assert.equal(r1.ok, false);
  const log2 = [], im2 = fakeImap(log2);
  const r2 = await run({ db: fakeDb(log2), nodemailer: fakeSmtp(log2), imapOpen: im2.open });
  assert.equal(r2.ok, true);
  assert.ok(at(log2, 'smtp-done') < at(log2, 'imap-open'), '★ 로그인이 거절된 직후인데 미리 접속을 또 했습니다');
  assert.equal(im2.st.opens, 1, '사본은 예전처럼 «배달 뒤에» 새 접속 하나로 올려야 합니다');
  assert.ok(log2.includes('append-end'));
  MD.resetPrefetchBreaker();                              /* 쉼이 풀리면 다시 미리 접속한다 */
  const log3 = [], im3 = fakeImap(log3);
  await run({ db: fakeDb(log3), nodemailer: fakeSmtp(log3), imapOpen: im3.open });
  assert.ok(at(log3, 'imap-open') < at(log3, 'smtp-done'), '쉼이 풀렸는데 미리 접속을 안 합니다');
});

test('지적4 — 미리 접속에서 로그인이 거절돼도 한동안 미리 접속을 쉰다', async () => {
  const log1 = [], im1 = fakeImap(log1, { authFailTimes: 1 });
  await run({ db: fakeDb(log1), nodemailer: fakeSmtp(log1), imapOpen: im1.open });
  const log2 = [], im2 = fakeImap(log2);
  await run({ db: fakeDb(log2), nodemailer: fakeSmtp(log2), imapOpen: im2.open });
  assert.ok(at(log2, 'smtp-done') < at(log2, 'imap-open'), '★ 미리 접속이 로그인 거절을 당한 직후인데 또 미리 접속했습니다');
});

test('★★ 재검증 — 목록을 읽는 사이 release 가 닫은 뒤 목록이 «거절»돼도 같은 연결을 두 번 닫지 않는다', async () => {
  const log = [];
  let reject; const listGate = new Promise((r) => { reject = r; });
  const im = fakeImap(log, { listGate, listThrows: true });
  const pre = MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: im.open });
  await until(() => log.includes('imap-list'), '목록 읽기 시작');
  await pre.release(10);
  assert.equal(im.st.logouts, 1);
  reject();                                               /* 이제 목록이 거절된다 — 오류 처리가 또 닫으려 한다 */
  await settle();
  assert.equal(im.st.logouts, 1, '★ release 가 닫은 연결을 목록 오류 처리가 또 닫았습니다(이중 닫기 경합)');
});

test('★★ 재검증 — 목록 오류 처리가 «닫는 중»일 때 release 가 겹쳐도 같은 연결을 두 번 닫지 않는다', async () => {
  const log = [], im = fakeImap(log, { listThrows: true, logoutMs: 40 });   /* 닫는 데 40ms — 그 사이 release 의 기다림(10ms)이 끝난다 */
  const pre = MA.prefetchSent({ loginIds: ['a'], pass: 'pw', openClient: im.open });
  await until(() => log.includes('imap-list'), '목록 읽기 시작(곧 거절)');
  await pre.release(10);
  /* ★ release 가 «돌아온 순간» 연결이 이미 닫혀 있어야 한다 — 오류 처리가 닫는 중이었으면 그 끝을 기다린다(재검증 2회차 지적).
       안 기다리면 «release 는 돌아왔는데 logout 은 아직 안 끝남» 이라 응답 뒤 함수가 멈추면 연결이 남는다. */
  assert.equal(im.st.logouts, 1, '★ release 가 돌아왔는데 연결은 아직 안 닫혔습니다 — 닫는 중인 것을 기다려야 합니다');
  await sleep(120);
  assert.equal(im.st.logouts, 1, '★ 오류 처리가 닫는 사이 release 가 같은 연결을 또 닫았습니다');
});

test('★★ 재검증 2회차 — 배달이 실패했을 때 목록 오류 처리가 «닫는 중»이어도 응답 전에 연결이 닫혀 있다', async () => {
  const log = [], im = fakeImap(log, { listThrows: true, logoutMs: 60 });
  const r = await run({ db: fakeDb(log), nodemailer: fakeSmtp(log, { fail: new Error('boom') }), imapOpen: im.open, prefetchReleaseMs: 10 });
  assert.equal(r.ok, false);
  assert.equal(im.st.logouts, 1, '★ 실패 응답이 나갔는데 연결은 아직 닫히는 중입니다 — 응답 뒤 함수가 멈추면 샙니다');
});

test('★★ 재검증 — 배달이 «로그인 아닌 오류»(연결 끊김 등)로 실패해도 미리 접속의 로그인 거절을 기억한다', async () => {
  const log1 = [], im1 = fakeImap(log1, { authFailTimes: 1 });
  const r1 = await run({ db: fakeDb(log1), nodemailer: fakeSmtp(log1, { fail: Object.assign(new Error('connect ECONNRESET'), { code: 'ECONNECTION' }) }), imapOpen: im1.open });
  assert.equal(r1.ok, false);
  const log2 = [], im2 = fakeImap(log2);
  const r2 = await run({ db: fakeDb(log2), nodemailer: fakeSmtp(log2), imapOpen: im2.open });
  assert.equal(r2.ok, true);
  assert.ok(at(log2, 'smtp-done') < at(log2, 'imap-open'), '★ 배달이 연결 끊김으로 실패한 경우 로그인 거절이 기억되지 않아 다음에도 틀린 로그인을 합니다');
});

test('재검증 — 미리 접속의 로그인 거절이 «응답 뒤에 늦게» 밝혀져도 기억한다', async () => {
  const log1 = [];
  let release; const openGate = new Promise((r) => { release = r; });
  const im1 = fakeImap(log1, { openGate, authFailTimes: 1 });
  const r1 = await run({ db: fakeDb(log1), nodemailer: fakeSmtp(log1, { fail: new Error('boom') }), imapOpen: im1.open, prefetchReleaseMs: 20 });
  assert.equal(r1.ok, false);
  release();                                              /* 응답이 나간 뒤에야 접속이 끝나고 «거절»이 밝혀진다 */
  await settle();
  const log2 = [], im2 = fakeImap(log2);
  await run({ db: fakeDb(log2), nodemailer: fakeSmtp(log2), imapOpen: im2.open });
  assert.ok(at(log2, 'smtp-done') < at(log2, 'imap-open'), '늦게 밝혀진 로그인 거절을 기억하지 못합니다');
});

test('★ 재검증 — 사본 접속은 «배달에 성공한» 아이디를 맨 앞에 둔다 — 이미 거절된 아이디를 먼저 두드리지 않는다', async () => {
  /* 쉬는 중(미리 접속 없음)에 SMTP 가 첫 후보(370-6)에서 거절당하고 둘째(me)로 성공한 경우 */
  const bad = Object.assign(new Error('535 authentication failed'), { code: 'EAUTH' });
  const logA = [];
  await run({ db: fakeDb(logA), nodemailer: fakeSmtp(logA, { fail: bad }), imapOpen: fakeImap(logA).open });   /* 쉬는 중으로 만든다 */
  const log = [], im = fakeImap(log);
  const smtp = fakeSmtp(log, { authFailUsers: ['370-6'] });
  const r = await run({ db: fakeDb(log), nodemailer: smtp, imapOpen: im.open });
  assert.equal(r.ok, true);
  assert.deepEqual(smtp.usedUsers, ['me'], '(검사 전제) 첫 후보는 거절되고 둘째로 배달됐다');
  assert.equal(im.st.opens, 1);
  assert.equal(im.st.openOpts[0].loginIds[0], 'me', '★ 사본 접속이 SMTP 에서 거절된 아이디(370-6)를 먼저 두드립니다: ' + JSON.stringify(im.st.openOpts[0].loginIds));
});

test('재검증 — 사본을 끄는 스위치가 켜져 있으면 미리 접속을 «아예 만들지 않아» 시간 로그가 끔으로 찍힌다', async () => {
  const old = process.env.MAIL_ARCHIVE_OFF; process.env.MAIL_ARCHIVE_OFF = '1';
  const lines = [];
  const orig = MA.buildRaw; MA.buildRaw = async () => Buffer.from('raw');
  const w = console.warn, l = console.log; console.warn = () => {}; console.log = (...a) => lines.push(a.join(' '));
  try {
    await MD.deliver({ db: fakeDb([]), body: 편지, from: 'me@daum.net', pass: 'pw', envId: '370-6', byEmail: 'staff@example.invalid',
      nodemailer: fakeSmtp([]), imapOpen: fakeImap([]).open });
  } finally { console.warn = w; console.log = l; MA.buildRaw = orig; if (old === undefined) delete process.env.MAIL_ARCHIVE_OFF; else process.env.MAIL_ARCHIVE_OFF = old; }
  const j = JSON.parse(lines.find((x) => x.indexOf('[mail-timing]') === 0).slice('[mail-timing]'.length));
  assert.equal(j.미리접속, '끔', '스위치를 껐는데 미리 접속을 «시도했다가 못 썼다»고 찍힙니다');
});

test('로그인 거절 판별 — imapflow 표시와 말, 그리고 거절이 «아닌» 오류는 거절로 보지 않는다', () => {
  assert.equal(MA.isAuthFailure(Object.assign(new Error('x'), { authenticationFailed: true })), true);
  assert.equal(MA.isAuthFailure(new Error('Command failed: AUTHENTICATIONFAILED')), true);
  assert.equal(MA.isAuthFailure(new Error('Invalid credentials')), true);
  assert.equal(MA.isAuthFailure(new Error('connect ETIMEDOUT')), false, '시간 초과를 로그인 거절로 보면 멀쩡한 사본이 막힙니다');
  assert.equal(MA.isAuthFailure(new Error('목록 실패')), false);
  assert.equal(MA.isAuthFailure(null), false);
});

/* ── 소스 지킴 ── */
test('미리 접속은 «배달 호출보다 앞에» 시작한다 — 겹치려면 앞이어야 한다', () => {
  const src = fs.readFileSync(path.join(F, 'mail-deliver.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const pre = src.indexOf('MA.prefetchSent('), send = src.indexOf('tx.sendMail(');
  assert.ok(pre > 0 && send > 0 && pre < send, '미리 접속이 배달 뒤에 있으면 겹치지 않습니다');
});

test('응답은 사본·치우기·기록을 모두 «기다린 뒤에» 한다 — 먼저 답하고 뒤에서 하는 길을 만들지 않는다', () => {
  const src = fs.readFileSync(path.join(F, 'mail-deliver.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
  const i = src.indexOf('await Promise.all([사본일, 치우기, 명함기록, 보낸기록])');
  assert.ok(i > 0, '넷을 함께 기다리는 줄이 없습니다');
  const ret = src.slice(i).search(/return \{\s*ok: true/);       /* 줄끝(LF·CRLF)에 안 매인다 */
  assert.ok(ret > 0, '기다린 뒤에 돌려줘야 합니다');
});
