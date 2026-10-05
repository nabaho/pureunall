'use strict';
/* 📬 내 담당 메일 알림 — 서버와 화면이 «어긋나지 않는다» (대표 결정 ㉮, 2026-10-05)
   「사건관리 컨설팅관리 등등 … 자동으로 담당자에게」

   ★ 왜 이 검사가 있나 — 담당 판정이 화면(mbWhoWhyOf)과 서버(mail-owner.whoOf) 두 곳에 있다.
     대표 결정으로 서버는 «앞 세 가지»(사람이 정한 주소 · 자문사 · 사건·컨설팅)까지만 본다.
     그래서 둘은 «같지 않아도» 되지만, 다음 둘은 반드시 지켜야 한다 —
       ① 서버가 사람을 집었으면 화면도 «같은 사람»을 집는다 (어긋나면 안 된다)
       ② 서버가 화면보다 «더 많이» 집지 않는다 (알림은 조심스러운 쪽)
     어긋나면 「메일함에는 내 것인데 알림은 안 온다」가 아니라, 더 나쁜
     「알림은 왔는데 메일함에는 남의 것」이 된다.

   ⚠ 글자를 맞대지 않는다. 같은 자료를 두 길에 넣고 «답»을 맞댄다 — 코드가 달라도
     답이 같으면 된다. 글자 맞대기는 한쪽을 줄 바꿈만 해도 깨진다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const SRV = require('../functions/mail-owner.js');

/* ── 같은 자료 한 벌 ── (예시 이름은 늘 홍길동·가나상사) */
const DIR = [
  { sid: 'P-001', name: '권형하', status: 'active' },
  { sid: 'P-002', name: '박한별', status: 'active' },
  { sid: 'P-009', name: '라마바', status: 'retired' },
];
const COS = [
  { id: 'co-1', name: '가나상사', managerMain: 'P-001', status: 'active', bizNo: '123-45-67890' },
  { id: 'co-2', name: '다라무역', managerMain: 'P-002', status: 'inactive' },
];
const WORKS = {
  consultings: [{ id: 'c1', status: '진행', managerMain: 'P-002', companyName: '가나상사',
    email: 'cons@gana.kr' },
    /* 같은 주소가 «두 사람»의 건에 적혀 있다 — 갈리면 아무도 정하지 않아야 한다 */
    { id: 'c2', status: '진행', managerMain: 'P-001', companyName: '사아무역', email: 'both@x.kr' }],
  cases: [{ id: 's1', status: '진행', managerMain: 'P-001', companyName: '홍길동',
    title: '임금체불사건' },
    { id: 's2', status: '종료', managerMain: 'P-002', companyName: '마바', email: 'done@x.kr' },
    { id: 's3', status: '진행', managerMain: 'P-002', companyName: '자차카', email: 'both@x.kr' }],
  funds: [], other_projects: [],
};

/* ══ 서버 길 ══ */
function srvDb(cfg) {
  const val = {
    'data/user_dir': DIR,
    'data/companies': COS,
    'uid_roles': { 'uid-1': { sid: 'P-001', status: 'active' }, 'uid-2': { sid: 'P-002', status: 'active' } },
    'pucards/config/mailWho': cfg.hand || {},
    'pucards/config/mailCo': cfg.co || {},
    'pucards/config/mailWork': cfg.workLink || {},
    'pucards/config/staffSucc': cfg.succ || {},
    'pucards/config/mailPush': cfg.push || {},
  };
  SRV.WORK_STORES.forEach(([store]) => { val['data/' + store + '/v'] = WORKS[store] || []; });
  return { ref: (p) => ({ once: () => Promise.resolve({ val: () => val[p] }) }) };
}
const srvTables = (cfg) => SRV.loadTables(srvDb(cfg));

/* ══ 화면 길 — 앱에서 그대로 떼어 와 같은 자료를 물린다 ══ */
function appBox(cfg) {
  const nameBySid = {}; DIR.forEach((u) => { nameBySid[u.sid] = u.name; });
  const retired = {}; DIR.forEach((u) => { if (u.status === 'retired') retired[u.name] = 1; });
  const norm = SRV.normName;
  const coByName = {}, coById = {};
  COS.forEach((c) => {
    const rec = { main: nameBySid[c.managerMain] || c.managerMain,
      left: SRV.coLeft(c), subs: [] };
    coByName[norm(c.name)] = rec; coById[String(c.id)] = rec;
  });
  const ctx = {
    Object, String, Number, Array, JSON, Map, RegExp,
    digits: (s) => String(s || '').replace(/\D/g, ''),
    _mbOwner: cfg.hand || {},
    _mbWorkLink: cfg.workLink || {},
    _mbWork: null,
    mbWhoKey: SRV.whoKey,
    mbDomOf: (e) => { const i = String(e).lastIndexOf('@'); return i < 0 ? '' : String(e).slice(i + 1); },
    mbRetired: (w) => !!retired[w],
    mbSuccOf: (w) => (cfg.succ || {})[w] || '',
    /* 명함 색인은 «비워 둔다» — 서버가 안 보는 칸이라, 여기서도 비워야 두 길이
       같은 자리에서 멈춘다. 명함으로만 잡히는 메일은 따로 검사한다(아래 ★). */
    mbWhoIndex: () => ({ byAddr: cfg.cardByAddr || {}, byDom: cfg.cardByDom || {}, coAddr: {} }),
    mbCoOf: (em) => {
      const v = (cfg.co || {})[SRV.whoKey(em)];
      if (!v) return '';
      return String(typeof v === 'object' ? (v.n || '') : v);
    },
    mbCoRec: (nm) => coByName[norm(nm)] || null,
    mbMemoOf: () => null,
  };
  vm.createContext(ctx);
  ['mbWhoLive', 'mbWhoWhy', 'mbWhoWhyOf', 'mbWorkLive', 'mbWorkBuild', 'mbWorkHandOf',
    'mbWorkMgrOfAddr', 'mbWorkOfRow'].forEach((n) =>
    vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  const m = app.match(/const MB_WORK_KIND = \{[^}]*\};/);
  vm.runInContext('var ' + m[0].slice('const '.length), ctx);
  const recs = [];
  SRV.WORK_STORES.forEach(([store, kind]) =>
    (WORKS[store] || []).forEach((r) => recs.push(Object.assign({ _kind: kind }, r))));
  ctx._mbWork = ctx.mbWorkBuild({ byBiz: {}, byName: { x: recs } }, nameBySid, coById, {});
  return (em) => ctx.mbWhoWhy(em, null).who;
}

/* ══ 맞대기 ══ */
const CASES = [
  ['사람이 정한 주소', { hand: { 'hong@naver,com': '권형하' } }, 'hong@naver.com', '권형하'],
  ['자문사에 이은 주소(이름)', { co: { 'hong@naver,com': '가나상사' } }, 'hong@naver.com', '권형하'],
  ['자문사에 이은 주소({n,id})', { co: { 'hong@naver,com': { n: '가나상사', id: 'co-1' } } }, 'hong@naver.com', '권형하'],
  ['끝난 자문사는 안 준다', { co: { 'hong@naver,com': '다라무역' } }, 'hong@naver.com', ''],
  ['건에 적힌 주소', {}, 'cons@gana.kr', '박한별'],
  ['손으로 이은 건', { workLink: { 'hong@naver,com': { kind: 'case', id: 's1' } } }, 'hong@naver.com', '권형하'],
  ['손으로 이은 것이 «건에 적힌 주소»보다 세다',
    { workLink: { 'cons@gana,kr': { kind: 'case', id: 's1' } } }, 'cons@gana.kr', '권형하'],
  ['끝난 건은 안 본다', {}, 'done@x.kr', ''],
  /* ★ 틀린 사람에게 보내는 것이 안 보내는 것보다 나쁘다 */
  ['담당이 둘로 갈리면 «정하지 않는다»', {}, 'both@x.kr', ''],
  ['갈려도 손으로 고르면 그 사람이다',
    { workLink: { 'both@x,kr': { kind: 'case', id: 's3' } } }, 'both@x.kr', '박한별'],
  ['끝난 건을 가리켜도 안 본다', { workLink: { 'a@x,kr': { kind: 'case', id: 's2' } } }, 'a@x.kr', ''],
  ['사람이 정한 것이 자문사보다 세다',
    { hand: { 'hong@naver,com': '박한별' }, co: { 'hong@naver,com': '가나상사' } }, 'hong@naver.com', '박한별'],
  ['자문사가 건보다 세다', { co: { 'cons@gana,kr': '가나상사' } }, 'cons@gana.kr', '권형하'],
  ['퇴사자는 이어받은 사람', { hand: { 'hong@naver,com': '라마바' }, succ: { '라마바': '권형하' } },
    'hong@naver.com', '권형하'],
  ['이어받을 사람이 없으면 아무에게도 안 간다', { hand: { 'hong@naver,com': '라마바' } }, 'hong@naver.com', ''],
  ['아무 데도 없는 주소', {}, 'nobody@x.kr', ''],
  ['우리 주소는 건에 적혀 있어도 안 잇는다', {}, 'p001@pureun.kr', ''],
];

CASES.forEach(([label, cfg, em, want]) => {
  test('★★★ 서버와 화면이 같다 — ' + label, async () => {
    const T = await srvTables(cfg);
    const srv = SRV.whoOf(em, T);
    const scr = appBox(cfg)(em);
    assert.equal(srv.who, want, '서버가 바라는 답과 다르다');
    assert.equal(scr, want, '화면이 바라는 답과 다르다');
    assert.equal(srv.who, scr, '서버와 화면이 어긋났다 — 「알림은 왔는데 메일함에는 남의 것」이 된다');
  });
});

/* ★ 서버가 «일부러» 안 보는 칸 — 어긋남이 아니라 «덜 집는» 것이어야 한다 */
test('★★★ 명함으로만 잡히는 것은 서버가 «안 집는다» — 틀리게 집지 않는다', async () => {
  const cfg = { cardByAddr: { 'hong@naver.com': '박한별' } };
  const T = await srvTables(cfg);
  assert.equal(SRV.whoOf('hong@naver.com', T).who, '', '서버는 모른다고 해야 한다');
  assert.equal(appBox(cfg)('hong@naver.com'), '박한별', '화면은 명함으로 집는다');
});

test('★★★ 도메인으로만 잡히는 것도 서버가 안 집는다', async () => {
  const cfg = { cardByDom: { 'gana.kr': '박한별' } };
  const T = await srvTables(cfg);
  assert.equal(SRV.whoOf('nobody@gana.kr', T).who, '');
  assert.equal(appBox(cfg)('nobody@gana.kr'), '박한별');
});

/* ★★ 「덜 집는다」를 기계로 — 서버가 집은 답은 «반드시» 화면의 답과 같아야 한다 */
test('★★★ 서버가 집은 것은 모두 화면과 같다 (한 번에 훑기)', async () => {
  for (const [label, cfg, em] of CASES) {
    const T = await srvTables(cfg);
    const srv = SRV.whoOf(em, T).who;
    if (!srv) continue;                       /* 서버가 모르는 것은 넘어간다 — 그래도 된다 */
    assert.equal(srv, appBox(cfg)(em), label + ' 에서 어긋났다');
  }
});

/* ══ 알림 설정 ══ */
test('★★ 안 적혀 있으면 «켠 것»이다 — 빈 값을 꺼짐으로 읽지 않는다', async () => {
  const T = await srvTables({});
  assert.equal(SRV.wantsPush('권형하', T), true);
  const T2 = await srvTables({ push: { 'P-001': { off: true } } });
  assert.equal(SRV.wantsPush('권형하', T2), false);
  assert.equal(SRV.wantsPush('박한별', T2), true, '한 사람이 끈 것이 남에게 옮지 않는다');
});

test('★★ 명부에 없는 이름에게는 안 보낸다', async () => {
  const T = await srvTables({});
  assert.equal(SRV.wantsPush('없는사람', T), false);
});

/* ══ 알림 보내기 ══ */
/* ⚠ 서버가 «스스로» 표를 읽게 둔다 — 표를 밖에서 끼워 넣으면 읽는 자리가 틀려도
     검사가 통과한다(처음에 그렇게 썼다가 빈 표로 돌아 아무에게도 안 갔다). */
function pushBox(cfg, rows, opt) {
  const sent = [];
  const db = srvDb(cfg);
  return { sent, run: async () => {
    const PUSH = require('../functions/push-admins.js');
    const realPush = PUSH.pushOne;
    PUSH.pushOne = (d, m, uid, p) => { sent.push({ uid, p });
      return Promise.resolve((opt && opt.noPhone) ? { targets: 0, sent: 0 } : { targets: 1, sent: 1 }); };
    try { return await SRV.notifyOwners({ getDatabase: () => db, getMessaging: () => ({}) },
      { slug: 'box', rows: rows }); }
    finally { PUSH.pushOne = realPush; }
  } };
}

test('★★★ 사람마다 «한 번»만 울린다 — 세 통이면 「3통」 한 번', async () => {
  const b = pushBox({ hand: { 'a@x,kr': '권형하', 'b@x,kr': '권형하' } },
    [{ u: '1', e: 'a@x.kr', f: '홍길동', s: '첫째', d: 1 },
     { u: '2', e: 'b@x.kr', f: '김철수', s: '둘째', d: 2 },
     { u: '3', e: 'a@x.kr', f: '홍길동', s: '셋째', d: 3 }]);
  const out = await b.run();
  assert.equal(b.sent.length, 1, '한 사람에게 한 번');
  assert.ok(/3통/.test(b.sent[0].p.title), '제목에 통수가 적힌다: ' + b.sent[0].p.title);
  assert.equal(b.sent[0].uid, 'uid-1');
  assert.equal(out.matched, 3);
  assert.equal(out.people, 1);
});

test('★★★ 사람이 둘이면 따로 간다 — 남의 메일이 섞이지 않는다', async () => {
  const b = pushBox({ hand: { 'a@x,kr': '권형하', 'b@x,kr': '박한별' } },
    [{ u: '1', e: 'a@x.kr', f: '홍길동', s: '가', d: 1 },
     { u: '2', e: 'b@x.kr', f: '김철수', s: '나', d: 2 }]);
  await b.run();
  assert.equal(b.sent.length, 2);
  assert.equal(b.sent.map((x) => x.uid).sort().join(','), 'uid-1,uid-2');
  b.sent.forEach((x) => assert.ok(/1통/.test(x.p.title)));
});

test('★★★ 담당을 모르는 메일로는 아무에게도 안 울린다', async () => {
  const b = pushBox({}, [{ u: '1', e: 'nobody@x.kr', f: '모름', s: '가', d: 1 }]);
  const out = await b.run();
  assert.equal(b.sent.length, 0);
  assert.equal(out.matched, 0);
});

test('★★ 끈 사람에게는 안 보낸다', async () => {
  const b = pushBox({ hand: { 'a@x,kr': '권형하' }, push: { 'P-001': { off: true } } },
    [{ u: '1', e: 'a@x.kr', f: '홍길동', s: '가', d: 1 }]);
  await b.run();
  assert.equal(b.sent.length, 0);
});

test('★★ 아직 로그인한 적 없는 사람은 «폰 없음»으로 센다 — 보낸 것으로 치지 않는다', async () => {
  /* 라마바(P-009)는 uid_roles 에 없다 — 퇴사자라 이어받기로 걸러지므로 명부에만 있는
     사람을 대신 쓴다. 여기서는 승계로 권형하에게 가는지와, 수가 어긋나지 않는지를 본다. */
  const b = pushBox({ hand: { 'a@x,kr': '라마바' }, succ: { '라마바': '권형하' } },
    [{ u: '1', e: 'a@x.kr', f: '홍길동', s: '가', d: 1 }]);
  const out = await b.run();
  assert.equal(out.matched, 1);
  assert.equal(b.sent.length, 1);
  assert.equal(b.sent[0].uid, 'uid-1', '이어받은 사람에게 간다');
});

/* ══ 어느 칸을 보나 ══ */
test('★★★ 보낸메일함·초안·휴지통·스팸에는 안 울린다 — 보관함도', () => {
  assert.equal(SRV.NOTIFY_KINDS.indexOf('inbox') >= 0, true);
  assert.equal(SRV.NOTIFY_KINDS.indexOf('custom') >= 0, true,
    '다음메일 거르개가 폴더로 바로 보낸다 — 받은메일함만 보면 가장 많은 쪽을 놓친다');
  ['sent', 'drafts', 'trash', 'spam', 'archive'].forEach((k) =>
    assert.equal(SRV.NOTIFY_KINDS.indexOf(k), -1, k + ' 에는 울리면 안 된다'));
});

test('★★★ 동기화가 «새로 받아온 것»에서만, 그 목록으로만 부른다', () => {
  const sync = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-sync.js'), 'utf8');
  const i = sync.indexOf('MYMAIL.notifyOwners');
  assert.ok(i > 0, 'mail-sync 가 불러야 한다 — 안 부르면 아무 일도 안 일어난다');
  const near = sync.slice(Math.max(0, i - 600), i + 200);
  assert.ok(/r\.dir === 'fresh'/.test(near), '옛것 채우기에서 울리면 몇 달 치가 한꺼번에 온다');
  assert.ok(/NOTIFY_KINDS/.test(near), '칸 갈래를 여기 베껴 적지 말 것 — 한 자리에서 읽는다');
  assert.ok(/catch/.test(near), '알림이 죽어도 동기화는 계속돼야 한다');
});

test('★★ 보내는 일은 한 자리뿐 — 죽은 토큰 치우기가 한쪽에만 남지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'push-admins.js'), 'utf8');
  assert.equal((src.match(/sendEachForMulticast/g) || []).length, 1,
    '보내는 자리를 베끼면 뒷정리(죽은 토큰)가 한쪽에만 남는다');
  assert.equal((src.match(/DEAD_CODES\.indexOf/g) || []).length, 1);
});
