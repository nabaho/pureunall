/* 담당자 따라가기 — 푸른이알피 → 정부컨설팅 일정관리 (대표 지시 2026-10-24)

   「푸른이알피에서 담당자 등이 변경되면 정부컨설팅 일정관리에서도 자동으로 바뀌어야 한다.
     다우테크놀로지가 다르다 — 이유 찾아 정리해라 · 앞으로도 문제없게」

   실측 2026-10-24 — 이어진 30곳 중 10곳이 어긋나 있었다. 뿌리 셋:
   ① 주담당은 아예 따라가지 않았다(주석에 「건드리지 않는다」).
   ② 사번이 비어 있는 직원(권형하·박한별·박재원)은 부담당 맞추기에서 통째로 빠졌고,
      올리기는 그 사람을 뺀 채 «통째로» 써서 이알피 부담당을 지울 수도 있었다.
   ③ 한 사업장에 사업이 둘인데 건마다 주담당이 다르면(다우·에이치비씨솔루션) 한 칸에 못 담는다.

   ★ 이 검사는 「글자가 있나」가 아니라 **실제로 함수를 돌려서** 본다.
   여기서 못 박는 것은 «규칙» 이지 «지금 값» 이 아니다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'gov-consulting.html'), 'utf8');
/* 주석을 먼저 걷는다 — 잘 쓴 주석이 검사를 통과시키면 안 된다 */
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const S = bare(SRC);

function loadEngine(over) {
  const a = S.indexOf('const CO_CORP_RE');
  const b = S.indexOf('let _erpPlan');
  assert.ok(a > 0 && b > a, '맞추기 엔진을 찾지 못했다 — 자리가 바뀌었으면 이 검사도 함께 고칠 것');

  const enLine = S.split(/\r?\n/).find((x) => x.trim().startsWith('const _en=')) || '';
  assert.ok(enLine, '_en 을 찾지 못했다');
  const cc = S.indexOf('function erpConsCode(');
  const ccEnd = S.indexOf('\nfunction ', cc + 10);
  assert.ok(cc > 0 && ccEnd > cc, 'erpConsCode 를 찾지 못했다');
  const g = S.indexOf('function getCoAtts');
  const gEnd = S.indexOf('\nfunction coAttStaffList', g);
  assert.ok(g > 0 && gEnd > g, 'getCoAtts 를 찾지 못했다');

  const st = {
    cos: [], scheds: [], staff: [], ls: {},
    toasts: [], cloud: [], today: '2026-08-29', me: 'a1', uidN: 0,
  };
  const ctx = {
    console, JSON, Object, Array, String, Number, Date, Set, Math, Promise, RegExp,
    ERP: { loaded: true, consultings: [], dir: [], types: [] },
    FB_READY: true,
    ERP_LS_PREFIX: 'pureun_v6_',
    localStorage: {
      getItem: (k) => (k in st.ls ? st.ls[k] : null),
      setItem: (k, v) => { st.ls[k] = String(v); },
    },
    _fbDB: {
      ref: () => ({
        once: () => (ctx._onceFail ? Promise.reject(new Error('offline')) : Promise.resolve({ val: () => ctx._formVal })),
        update: (u) => { st.cloud.push(u); return Promise.resolve(); },
      }),
    },
    _formVal: undefined,
    getCos: () => JSON.parse(JSON.stringify(st.cos)),
    setCos: (v) => { st.cos = JSON.parse(JSON.stringify(v)); },
    getScheds: () => JSON.parse(JSON.stringify(st.scheds)),
    setScheds: (v) => { st.scheds = JSON.parse(JSON.stringify(v)); },
    getStaff: () => JSON.parse(JSON.stringify(st.staff)),
    setStaff: (v) => { st.staff = JSON.parse(JSON.stringify(v)); },
    uid: () => 'n' + (++st.uidN),
    STAFF_COLORS: ['#d97706', '#2563eb', '#16a34a'],
    refreshStaffDropdowns: () => {},
    getErpTypeMap: () => ({}),
    todayStr: () => st.today,
    myId: () => st.me,
    toast: (m) => { st.toasts.push(String(m)); },
    lsSet: (k, v) => { st.ls[k] = String(v); },
    renderDash: () => {}, renderCal: () => {},
    erpSidName: (sid) => (ctx.ERP.dir.find((u) => u.sid === sid) || {}).name || '',
    govStaffIdByErp: (sid, name) => {
      const bySid = st.staff.find((a) => a.erpSid === sid);
      if (bySid) return bySid.id;
      const byName = st.staff.find((a) => a.name === name);
      return byName ? byName.id : '';
    },
  };
  Object.assign(ctx, over || {});
  vm.createContext(ctx);
  vm.runInContext(enLine + '\n' + S.slice(cc, ccEnd) + '\n' + S.slice(g, gEnd) + '\n' + S.slice(a, b), ctx);
  ctx._st = st;
  return ctx;
}

/* 흔히 쓰는 판 하나 — 사업장 1곳, 이알피 컨설팅 1건, 직원 셋(사번 있음) */
function board(over) {
  const ctx = loadEngine(over);
  const st = ctx._st;
  st.staff = [
    { id: 'a1', name: '권형하', erpSid: 'S1' },
    { id: 'a2', name: '박한별', erpSid: 'S2' },
    { id: 'a3', name: '김동현', erpSid: 'S3' },
  ];
  ctx.ERP.dir = [
    { sid: 'S1', name: '권형하' }, { sid: 'S2', name: '박한별' }, { sid: 'S3', name: '김동현' },
  ];
  st.cos = [{ id: 'c1', name: '마바텍라인', defAtt: 'a1', defCoAtts: ['a2', 'a3'], types: ['t1'], erpId: 'E1' }];
  ctx.ERP.consultings = [
    { id: 'E1', companyName: '마바텍라인', managerMain: 'S1', managerSubs: ['S2', 'S3'] },
  ];
  st.ls['pureun_v6_consultings'] = JSON.stringify(ctx.ERP.consultings);
  st.ls['p_subSyncSeeded'] = '2026-08-01';           // 첫 판은 지났다
  ctx._formVal = 'E1';
  return ctx;
}

/* ══════ ① 주담당 따라가기 ══════ */

test('★ 이알피에서 주담당이 바뀌면 사업장 주담당도 따라 바뀐다', () => {
  const ctx = board(); const st = ctx._st;
  ctx.ERP.consultings[0].managerMain = 'S2';         // 박한별로 바뀌었다 (그는 부담당이었다)
  ctx.ERP.consultings[0].managerSubs = ['S3'];

  ctx.erpSyncSubsDown();

  assert.strictEqual(st.cos[0].defAtt, 'a2', '★ 이알피 주담당이 바뀌어도 일정관리는 옛 사람 그대로입니다');
  assert.deepStrictEqual(st.cos[0].defCoAtts, ['a3'], '주담당이 된 사람은 부담당에서 빠져야 한다');
  assert.ok(st.toasts.join(' ').includes('주담당'), '사람이 바뀌는 일이니 말해 줘야 한다');
  assert.strictEqual(st.cloud.length, 0, '내려받기는 이알피에 아무것도 쓰지 않는다');
});

test('★ 앞으로 올 방문은 «옛 주담당이 맡던 것만» 새 주담당으로 — 지난 방문·남이 맡은 방문은 그대로', () => {
  const ctx = board(); const st = ctx._st;
  st.scheds = [
    { id: 'past', coId: 'c1', typeId: 't1', date: '2026-08-04', attId: 'a1', coAttIds: ['a2'] },
    { id: 'f1', coId: 'c1', typeId: 't1', date: '2026-09-10', attId: 'a1', coAttIds: ['a2', 'a3'] },
    { id: 'f2', coId: 'c1', typeId: 't1', date: '2026-09-12', attId: 'a3', coAttIds: [] },
  ];
  ctx.ERP.consultings[0].managerMain = 'S2';
  ctx.erpSyncSubsDown();

  const by = (id) => st.scheds.find((s) => s.id === id);
  assert.strictEqual(by('past').attId, 'a1', '지난 방문은 «그 날 누가 갔다» 는 증빙 기록이다 — 바꾸면 안 된다');
  assert.strictEqual(by('f1').attId, 'a2', '★ 앞으로 올 방문이 옛 주담당에게 남아 있습니다');
  assert.ok(!(by('f1').coAttIds || []).includes('a2'), '주담당이 된 사람이 같은 방문의 부담당에도 남으면 안 된다');
  assert.strictEqual(by('f2').attId, 'a3', '일부러 다른 사람에게 맡긴 방문은 건드리지 않는다');
});

test('건마다 주담당이 갈리면 사업장 주담당 칸은 «안 바꾼다» — 대신 다른 건 주담당은 부담당으로 남아 권한이 안 사라진다', () => {
  const ctx = board(); const st = ctx._st;
  ctx.ERP.consultings = [
    { id: 'E1', companyName: '마바텍라인', managerMain: 'S1', managerSubs: ['S2'] },
    { id: 'E2', companyName: '마바텍라인', managerMain: 'S3', managerSubs: [] },
  ];
  st.cos[0].defCoAtts = [];
  ctx.erpSyncSubsDown();

  assert.strictEqual(st.cos[0].defAtt, 'a1', '한 칸에 둘을 담을 수 없다 — 어느 쪽이 맞는지 앱이 정하면 안 된다');
  assert.ok(st.cos[0].defCoAtts.includes('a3'),
    '★ 다른 건의 주담당(김동현)이 이 사업장에서 조용히 빠집니다 — 자기 컨설팅인데 일정이 안 보이게 된다');
  assert.ok(st.cos[0].defCoAtts.includes('a2'), '부담당은 그대로 따라온다');
});

test('★ 건마다 주담당이 갈리고 사업장 주담당이 그 둘 중 누구도 아니어도 «첫 번째 건 주담당으로» 덮지 않는다', () => {
  const ctx = board(); const st = ctx._st;
  ctx.ERP.consultings = [
    { id: 'E1', companyName: '마바텍라인', managerMain: 'S2', managerSubs: [] },
    { id: 'E2', companyName: '마바텍라인', managerMain: 'S3', managerSubs: [] },
  ];
  st.cos[0].defCoAtts = [];
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].defAtt, 'a1',
    '★ 둘 중 어느 쪽이 사업장 주담당인지는 앱이 정할 수 없다 — 목록 첫 건으로 덮으면 나머지 건 담당이 밀려난다');
  assert.ok(st.cos[0].defCoAtts.includes('a2') && st.cos[0].defCoAtts.includes('a3'), '둘 다 이 사업장 사람이다');
});

test('처음 맞추는 판(합치기)에서도 새 주담당이 부담당 줄에 남지 않는다', () => {
  const ctx = board(); const st = ctx._st;
  delete st.ls['p_subSyncSeeded'];                   // 아직 한 번도 안 맞췄다 — 지우지 않고 «합치는» 판
  ctx.ERP.consultings[0].managerMain = 'S2';
  ctx.ERP.consultings[0].managerSubs = ['S3'];
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].defAtt, 'a2', '첫 판에서도 주담당은 따라간다(한 칸이라 합칠 것이 없다)');
  assert.ok(!st.cos[0].defCoAtts.includes('a2'),
    '★ 합치는 판이 옛 부담당 줄을 도로 얹어서, 주담당이 같은 사업장 부담당에도 올라간다');
});

test('명단에 없는 사람이 주담당이면 새로 만들지 않고 주담당 칸을 그대로 둔다', () => {
  const ctx = board(); const st = ctx._st;
  ctx.ERP.dir.push({ sid: 'Z9', name: '모르는사람' });
  ctx.ERP.consultings[0].managerMain = 'Z9';
  const before = st.staff.length;
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].defAtt, 'a1', '찾을 수 없는 사람으로 바꾸면 사업장이 «담당 없음» 이 된다');
  assert.strictEqual(st.staff.length, before, '주담당 자리로 사람을 지어내지 않는다');
});

test('같은 이름이 둘이면 이름으로 주담당을 정하지 않는다 (사번으로만)', () => {
  const ctx = board(); const st = ctx._st;
  st.staff.push({ id: 'a8', name: '김동현' });       // 사번 없는 동명이인
  st.staff.find((s) => s.id === 'a3').erpSid = undefined;
  ctx.ERP.dir.push({ sid: 'S8', name: '김동현' });
  ctx.ERP.consultings[0].managerMain = 'S8';
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].defAtt, 'a1', '동명이인 둘 중 누구인지 앱이 정할 수 없다');
});

test('종료된 컨설팅의 주담당은 따라가지 않는다', () => {
  const ctx = board(); const st = ctx._st;
  ctx.ERP.consultings[0].managerMain = 'S2';
  ctx.ERP.consultings[0].status = 'closed';
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].defAtt, 'a1');
});

/* ══════ ② 사번 자동 잇기 ══════ */

function boardNoSid(over) {
  const ctx = board(over); const st = ctx._st;
  st.staff.forEach((s) => { delete s.erpSid; });      // 「사번 잇기」 단추를 한 번도 안 눌렀다
  return ctx;
}

test('★ 이알피 명부에 같은 이름이 «딱 한 명»이면 사번을 저절로 이어 준다', () => {
  const ctx = boardNoSid(); const st = ctx._st;
  const linked = ctx.erpAutoLinkStaff();
  assert.strictEqual(linked.length, 3);
  assert.deepStrictEqual(st.staff.map((s) => s.erpSid), ['S1', 'S2', 'S3'],
    '★ 사번이 비어 있으면 이 사람은 이알피와 영영 안 맞습니다');
  assert.ok(st.toasts.join(' ').includes('사번'), '사람 명단을 고쳤으면 말해 줘야 한다');
});

test('같은 이름이 둘이거나 이미 다른 직원이 쓰는 사번이면 잇지 않는다', () => {
  const ctx = boardNoSid(); const st = ctx._st;
  ctx.ERP.dir.push({ sid: 'S9', name: '권형하' });    // 동명이인
  st.staff.push({ id: 'a7', name: '박한별', erpSid: 'S2' });   // 이미 S2 를 쓰는 사람
  st.staff.find((s) => s.id === 'a2').erpSid = undefined;
  const linked = ctx.erpAutoLinkStaff();
  assert.ok(!linked.includes('a1'), '★ 동명이인 둘 중 하나로 정하면 남의 컨설팅이 붙는다');
  assert.ok(!linked.includes('a2'), '한 사번을 두 직원에게 이으면 안 된다');
});

test('옛 사본으로 읽은 판이거나 이알피를 못 읽었으면 잇지 않는다', () => {
  for (const patch of [{ stale: true }, { loaded: false }]) {
    const ctx = boardNoSid(); const st = ctx._st;
    Object.assign(ctx.ERP, patch);
    assert.strictEqual(ctx.erpAutoLinkStaff().length, 0);
    assert.ok(st.staff.every((s) => !s.erpSid), '못 믿을 명부로 사람을 잇지 않는다');
  }
});

/* ══════ ③ 새로 이은 사람 — 지우지 않고 합쳐서 올린다 ══════ */

test('★ 새로 이은 사람의 부담당은 내려받기가 지우지 않는다 — 이알피가 모르던 것이지 «빠진 것» 이 아니다', () => {
  const ctx = boardNoSid(); const st = ctx._st;
  st.cos[0].defCoAtts = ['a2', 'a3'];
  ctx.ERP.consultings[0].managerSubs = [];            // 이알피에는 부담당이 없다
  ctx.erpAutoLinkStaff();
  ctx.erpSyncSubsDown();
  assert.deepStrictEqual(st.cos[0].defCoAtts.slice().sort(), ['a2', 'a3'],
    '★ 사번을 잇자마자 이알피를 잣대로 삼으면, 여기서 손으로 넣어 둔 부담당이 한꺼번에 지워진다');
});

test('★ 합친 것을 이알피에 올리고, 올라가야 «새로 이음» 표시를 뗀다', async () => {
  const ctx = boardNoSid(); const st = ctx._st;
  st.cos[0].defCoAtts = ['a2', 'a3'];
  ctx.ERP.consultings[0].managerSubs = [];
  ctx.erpAutoLinkStaff();
  ctx.erpSyncSubsDown();

  const n = await ctx.erpPushNewLinks();

  assert.strictEqual((ctx.ERP.consultings[0].managerSubs || []).slice().sort().join(','), 'S2,S3',
    '일정관리에만 있던 부담당이 이알피로 올라가야 둘이 맞는다');
  assert.ok(n > 0);
  assert.ok(st.staff.every((s) => !s.erpLinkPending), '올라갔으면 표시를 뗀다');
});

test('올리기가 막히면 «새로 이음» 표시를 떼지 않는다 — 다음에 또 지우지 않고 다시 올린다', async () => {
  const ctx = boardNoSid(); const st = ctx._st;
  st.cos[0].defCoAtts = ['a2', 'a3'];
  ctx.ERP.consultings[0].managerSubs = [];
  ctx._onceFail = true;                               // 끊겨서 이알피 저장 형식을 확인하지 못함 → 못 올린다
  ctx.erpAutoLinkStaff();
  ctx.erpSyncSubsDown();
  await ctx.erpPushNewLinks();
  assert.ok(st.staff.some((s) => s.erpLinkPending),
    '★ 못 올렸는데 표시를 떼면, 다음 내려받기가 이알피를 잣대로 삼아 이 사람들을 지운다');

  /* 다음에 접속해서 형식을 확인하고 나면 올라가고 표시가 떨어진다 */
  ctx._onceFail = false;
  ctx.erpSyncSubsDown();
  assert.deepStrictEqual(st.cos[0].defCoAtts.slice().sort(), ['a2', 'a3'], '그 사이에도 지워지면 안 된다');
  await ctx.erpPushNewLinks();
  assert.ok(st.staff.every((s) => !s.erpLinkPending));
});

/* ══════ ④ 올리기는 이알피 부담당을 지우지 않는다 ══════ */

test('★ 일정관리가 모르는 사람의 이알피 부담당 칸은 올리기가 건드리지 않는다', async () => {
  const ctx = board(); const st = ctx._st;
  ctx.ERP.dir.push({ sid: 'Z9', name: '퇴사한사람', status: 'retired' });
  ctx.ERP.consultings[0].managerSubs = ['S2', 'Z9'];  // Z9 는 일정관리 명단에 없다
  st.cos[0].defCoAtts = ['a2'];
  await ctx.erpSyncSubsUp('c1');
  assert.ok(ctx.ERP.consultings[0].managerSubs.includes('Z9'),
    '★ 모르는 사람의 칸까지 지우면 이알피의 부담당(성과 분배 기준)이 조용히 바뀐다');
});

test('일정관리에서 뺀 «아는 사람»은 이알피에서도 빠진다', async () => {
  const ctx = board(); const st = ctx._st;
  st.cos[0].defCoAtts = ['a2'];                       // 김동현(S3)을 뺐다
  await ctx.erpSyncSubsUp('c1');
  assert.strictEqual(ctx.ERP.consultings[0].managerSubs.join(','), 'S2');
});

test('다른 건의 주담당을 이 건의 부담당으로 «새로» 밀어 넣지 않는다', async () => {
  const ctx = board(); const st = ctx._st;
  ctx.ERP.consultings = [
    { id: 'E1', companyName: '마바텍라인', managerMain: 'S1', managerSubs: [] },
    { id: 'E2', companyName: '마바텍라인', managerMain: 'S3', managerSubs: [] },
  ];
  st.cos[0].defCoAtts = ['a3'];                       // 김동현은 E2 의 주담당이라서 여기 있다
  st.cloud.length = 0;
  await ctx.erpSyncSubsUp('c1');
  assert.deepStrictEqual(ctx.ERP.consultings[0].managerSubs || [], [],
    '★ E1 에서 김동현은 부담당이 아니다 — 올리기가 그를 E1 부담당(성과 분배 기준)으로 만들어 버린다');
  assert.strictEqual(st.cloud.length, 0, '바뀔 것이 없으면 쓰지 않는다');
});

/* ══════ ⑤ 진동 없음 — 되풀이해도 같은 자리에 선다 ══════ */

test('내려받기 → 올리기 → 내려받기를 되풀이해도 더는 아무것도 안 바뀐다', async () => {
  const ctx = board(); const st = ctx._st;
  ctx.ERP.consultings[0].managerMain = 'S2';
  ctx.ERP.consultings[0].managerSubs = ['S3'];
  ctx.erpSyncSubsDown();
  await ctx.erpSyncSubsUp('c1');
  const snap = JSON.stringify([st.cos, st.scheds, ctx.ERP.consultings]);
  st.cloud.length = 0; st.toasts.length = 0;
  ctx.erpSyncSubsDown();
  await ctx.erpSyncSubsUp('c1');
  assert.strictEqual(JSON.stringify([st.cos, st.scheds, ctx.ERP.consultings]), snap,
    '★ 두 앱이 서로 되돌리고 있다 — 한 판 돌고 나면 멈춰야 한다');
  assert.strictEqual(st.cloud.length, 0, '맞은 뒤에는 클라우드에 쓰지 않는다');
  assert.strictEqual(st.toasts.length, 0, '맞은 뒤에는 알림도 없다');
  assert.ok(!st.cloud.some((u) => Object.keys(u).some((p) => /managerMain/.test(p))), '주담당은 이알피에 쓰지 않는다');
});

/* ══════ ⑥ 다우테크놀로지 그대로 — 2026-10-24 서버에서 읽은 모양 ══════ */

test('★ 다우테크놀로지: 사번 없음 + 부담당 박한별·박재원 + 건마다 주담당이 다름 — 한 판 돌고 나면 서로 맞는다', async () => {
  const ctx = loadEngine(); const st = ctx._st;
  st.me = 'a1';
  st.staff = [
    { id: 'a1', name: '권형하' }, { id: 'a3', name: '박한별' }, { id: 'a5', name: '박재원' },   // 셋 다 사번 없음
  ];
  ctx.ERP.dir = [
    { sid: 'P-001', name: '권형하' }, { sid: 'P-003', name: '박한별' }, { sid: 'P-005', name: '박재원' },
  ];
  st.cos = [{ id: 'co1', name: '다우테크놀로지', defAtt: 'a1', defCoAtts: ['a3', 'a5'], types: ['t4', 't2'] }];
  ctx.ERP.consultings = [
    { id: 'E-tech', companyName: '(주)다우테크놀로지', managerMain: 'P-001', managerSubs: [] },
    { id: 'E-chung', companyName: '(주)다우테크놀로지', managerMain: 'P-005', managerSubs: [] },
  ];
  st.ls['pureun_v6_consultings'] = JSON.stringify(ctx.ERP.consultings);
  st.ls['p_subSyncSeeded'] = '2026-08-01';
  ctx._formVal = 'E-tech';

  /* 이알피를 읽은 뒤의 순서 그대로 */
  ctx.erpAutoLinkStaff();
  ctx.erpSyncSubsDown();
  await ctx.erpPushNewLinks();

  assert.deepStrictEqual(st.staff.map((s) => s.erpSid), ['P-001', 'P-003', 'P-005'], '사번이 이어져야 한다');
  assert.strictEqual(st.cos[0].defAtt, 'a1', '건마다 주담당이 달라 사업장 주담당 칸은 그대로');
  assert.ok(st.cos[0].defCoAtts.includes('a5'), '★ 산일충남 주담당 박재원이 이 사업장에서 빠지면 자기 컨설팅이 안 보인다');
  assert.ok(st.cos[0].defCoAtts.includes('a3'), '일정관리에만 있던 박한별은 지우지 않고 이알피에 올린다');
  assert.ok(ctx.ERP.consultings[0].managerSubs.includes('P-003'), '박한별이 이알피 부담당으로 올라갔다');
  assert.ok(!ctx.ERP.consultings[0].managerSubs.includes('P-005'),
    '박재원은 기술보호 건의 부담당이 아니다 — 주담당인 건이 따로 있다');
  assert.ok(st.staff.every((s) => !s.erpLinkPending));

  /* 두 번째 판은 조용하다 */
  st.cloud.length = 0; st.toasts.length = 0;
  ctx.erpSyncSubsDown();
  await ctx.erpSyncSubsUp('co1', { silent: true });
  assert.strictEqual(st.cloud.length, 0, '맞은 뒤에도 계속 쓰면 두 앱이 서로 되돌리는 것이다');
});

/* ══════ ⑦ 부르는 순서 — 이 순서가 뜻이다 ══════ */

test('이알피를 읽은 뒤 «사번 잇기 → 내려받기 → 올리기» 순서로 부른다', () => {
  const a = S.indexOf('async function erpLoadAll');
  const body = S.slice(a, S.indexOf('\nfunction erpSidName', a));
  const i1 = body.indexOf('erpAutoLinkStaff(');
  const i2 = body.indexOf('erpSyncSubsDown(');
  const i3 = body.indexOf('erpPushNewLinks(');
  assert.ok(i1 > 0 && i2 > 0 && i3 > 0, '세 함수를 모두 불러야 한다');
  assert.ok(i1 < i2, '사번을 잇기 «전에» 내려받으면 사번 없는 사람이 또 건너뛰어진다');
  assert.ok(i2 < i3, '내려받아 합친 «뒤에» 올려야 한다');
  assert.ok(/ERP\.stale/.test(body.slice(0, i1)), '옛 사본으로 읽은 판에서는 하지 않는다는 막이 앞에 있어야 한다');
});
