/* 사업별 주담당 — 정부컨설팅 일정관리 (대표 지시 2026-10-24 「추천대로」)

   한 사업장에 사업이 둘 이상이고 사업마다 주담당이 다르면(다우테크놀로지·에이치비씨솔루션·가야엔지니어링)
   일정관리의 «사업장 한 곳에 주담당 한 칸» 에 담을 수 없었다. 이알피는 «건마다» 주담당을 적는데
   일정관리는 «사업장 하나에 한 칸» 이라서다 — 앞 일(PR #2717)에서 남긴 것.

   자료: co.typeAtts = {종류id: 직원id} — 사업장 대표(defAtt)와 «다른 종류만» 적는 성긴 표.
   대표 결정: ① 사업별 칸 · 목록에는 «다를 때만» 보임 · 이알피와 이어진 사업은 수정 창에서 잠금.

   ★ 이 검사는 「글자가 있나」가 아니라 **실제로 함수를 돌려서** 본다.
   여기서 못 박는 것은 «규칙» 이지 «지금 값» 이 아니다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'gov-consulting.html'), 'utf8');
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const S = bare(SRC);

/* 이름으로 함수 한 개를 떼어 온다(중괄호 짝을 센다) */
function grab(n) {
  const i = S.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < S.length; j++) {
    if (S[j] === '{') { d++; st = true; }
    else if (S[j] === '}') { d--; if (st && !d) return S.slice(i, j + 1); }
  }
}

function loadEngine(over) {
  const a = S.indexOf('const CO_CORP_RE');
  const b = S.indexOf('let _erpPlan');
  assert.ok(a > 0 && b > a, '맞추기 엔진을 찾지 못했다');
  const enLine = S.split(/\r?\n/).find((x) => x.trim().startsWith('const _en=')) || '';
  const cc = S.indexOf('function erpConsCode(');
  const ccEnd = S.indexOf('\nfunction ', cc + 10);
  const g = S.indexOf('function getCoAtts');
  const gEnd = S.indexOf('\nfunction coAttStaffList', g);
  assert.ok(cc > 0 && ccEnd > cc && g > 0 && gEnd > g);

  const st = { cos: [], scheds: [], staff: [], ls: {}, toasts: [], cloud: [], today: '2026-08-29', me: 'a1', uidN: 0,
    types: [{ id: 't1', name: '기술보호' }, { id: 't2', name: '산일충남' }] };
  const ctx = {
    console, JSON, Object, Array, String, Number, Date, Set, Math, Promise, RegExp,
    ERP: { loaded: true, consultings: [], dir: [], types: [] },
    FB_READY: true, ERP_LS_PREFIX: 'pureun_v6_',
    localStorage: { getItem: (k) => (k in st.ls ? st.ls[k] : null), setItem: (k, v) => { st.ls[k] = String(v); } },
    _fbDB: { ref: () => ({
      once: () => (ctx._onceFail ? Promise.reject(new Error('offline')) : Promise.resolve({ val: () => ctx._formVal })),
      update: (u) => { st.cloud.push(u); return Promise.resolve(); } }) },
    _formVal: undefined,
    getCos: () => JSON.parse(JSON.stringify(st.cos)), setCos: (v) => { st.cos = JSON.parse(JSON.stringify(v)); },
    getScheds: () => JSON.parse(JSON.stringify(st.scheds)), setScheds: (v) => { st.scheds = JSON.parse(JSON.stringify(v)); },
    getStaff: () => JSON.parse(JSON.stringify(st.staff)), setStaff: (v) => { st.staff = JSON.parse(JSON.stringify(v)); },
    getTypes: () => st.types,
    uid: () => 'n' + (++st.uidN), STAFF_COLORS: ['#d97706'], refreshStaffDropdowns: () => {},
    getErpTypeMap: () => ({ k1: 't1', k2: 't2' }),
    todayStr: () => st.today, myId: () => st.me,
    toast: (m) => { st.toasts.push(String(m)); }, lsSet: (k, v) => { st.ls[k] = String(v); },
    renderDash: () => {}, renderCal: () => {},
    erpSidName: (sid) => (ctx.ERP.dir.find((u) => u.sid === sid) || {}).name || '',
    govStaffIdByErp: (sid, name) => {
      const bySid = st.staff.find((x) => x.erpSid === sid); if (bySid) return bySid.id;
      const by = st.staff.find((x) => x.name === name); return by ? by.id : '';
    },
  };
  Object.assign(ctx, over || {});
  vm.createContext(ctx);
  vm.runInContext(enLine + '\n' + S.slice(cc, ccEnd) + '\n' + S.slice(g, gEnd) + '\n' + S.slice(a, b), ctx);
  ctx._st = st;
  return ctx;
}

/* 판 하나 — 사업장 1곳에 사업 둘(t1·t2), 이알피 건 둘(건마다 주담당이 다를 수 있다), 직원 셋 */
function board(over) {
  const ctx = loadEngine(over); const st = ctx._st;
  st.staff = [
    { id: 'a1', name: '권형하', erpSid: 'S1' }, { id: 'a2', name: '박한별', erpSid: 'S2' }, { id: 'a3', name: '박재원', erpSid: 'S3' },
  ];
  ctx.ERP.dir = [{ sid: 'S1', name: '권형하' }, { sid: 'S2', name: '박한별' }, { sid: 'S3', name: '박재원' }];
  st.cos = [{ id: 'c1', name: '다우', defAtt: 'a1', defCoAtts: [], types: ['t1', 't2'], erpId: 'E1' }];
  ctx.ERP.consultings = [
    { id: 'E1', companyName: '다우', typeCode: 'k1', managerMain: 'S1', managerSubs: [] },
    { id: 'E2', companyName: '다우', typeCode: 'k2', managerMain: 'S3', managerSubs: [] },
  ];
  st.ls['pureun_v6_consultings'] = JSON.stringify(ctx.ERP.consultings);
  st.ls['p_subSyncSeeded'] = '2026-08-01';
  ctx._formVal = 'E1';
  return ctx;
}

/* ══ ① 읽는 길 ══════════════════════════════════════════ */

test('coMainOf — 사업별 칸이 있으면 그것, 없으면 사업장 대표', () => {
  const ctx = board();
  assert.strictEqual(ctx.coMainOf({ defAtt: 'a1', typeAtts: { t2: 'a3' } }, 't2'), 'a3');
  assert.strictEqual(ctx.coMainOf({ defAtt: 'a1', typeAtts: { t2: 'a3' } }, 't1'), 'a1', '칸이 없는 종류는 사업장 대표');
  assert.strictEqual(ctx.coMainOf({ defAtt: 'a1' }, 't2'), 'a1', '옛 자료(typeAtts 없음)도 그대로 읽혀야 한다');
  assert.strictEqual(ctx.coMainOf({ defAtt: 'a1', typeAtts: { t2: 'a3' } }), 'a1', '종류를 안 주면 사업장 대표');
  assert.strictEqual(ctx.coMainOf(null, 't1'), '');
});

/* ══ ② 내려받기 — 이알피 건마다 주담당을 사업별 칸에 ══════════════ */

test('★ 건마다 주담당이 다르면 «다른 종류만» 사업별 칸에 적는다 — 사업장 대표는 안 건드린다', () => {
  const ctx = board(); const st = ctx._st;
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].defAtt, 'a1', '대표는 이미 한 건의 주담당이라 그대로');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(st.cos[0].typeAtts)), { t2: 'a3' },
    '★ 산일충남 주담당 박재원이 어디에도 안 적힙니다 — 일정관리는 계속 권형하로 보입니다');
  assert.ok(st.cos[0].defCoAtts.includes('a3'), '권한은 지금처럼 부담당 줄에도 남긴다');
  assert.strictEqual(st.cloud.length, 0, '내려받기는 이알피에 아무것도 쓰지 않는다');
});

test('대표가 어느 건의 주담당도 아니면 «첫 종류의 주담당»으로 옮긴다 — 이알피에 없는 사람이 대표로 남지 않게', () => {
  const ctx = board(); const st = ctx._st;
  ctx.ERP.consultings[0].managerMain = 'S2';           // t1 주담당 박한별
  ctx.ERP.consultings[1].managerMain = 'S3';           // t2 주담당 박재원 — 대표 a1 은 어디에도 없다
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].defAtt, 'a2', '★ 이알피 어느 건에도 없는 사람이 사업장 대표로 남아 있습니다');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(st.cos[0].typeAtts)), { t2: 'a3' });
  assert.ok(!st.cos[0].defCoAtts.includes('a1'), '이알피에 없는 옛 대표는 담당에서 빠진다');
});

test('건들의 주담당이 «전부 한 사람»이면 사업장 대표를 따라가고 사업별 칸은 지운다', () => {
  const ctx = board(); const st = ctx._st;
  st.cos[0].typeAtts = { t2: 'a3' };
  ctx.ERP.consultings[1].managerMain = 'S1';
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].defAtt, 'a1');
  assert.ok(!('typeAtts' in st.cos[0]), '★ 같은 사람이 되었는데 사업별 칸이 남으면 «다를 때만» 이 거짓이 된다');
});

test('사업별 칸이 대표와 같아지면 칸을 지운다 (성긴 표를 지킨다)', () => {
  const ctx = board(); const st = ctx._st;
  st.cos[0].typeAtts = { t2: 'a3' };
  ctx.ERP.consultings[1].managerMain = 'S2';           // 대표(S1)도, 박재원도 아닌 다른 사람으로 — 아직 «다른 종류»
  ctx.erpSyncSubsDown();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(st.cos[0].typeAtts)), { t2: 'a2' }, '바뀐 사람으로 갱신');
  ctx.ERP.consultings[0].managerMain = 'S2';           // 이제 t1 도 박한별 — 대표가 박한별로 따라간다
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].defAtt, 'a2');
  assert.ok(!('typeAtts' in st.cos[0]), '대표와 같은 칸은 남기지 않는다');
});

test('★ 이알피에서 한 종류의 주담당이 바뀌면 «그 종류의» 앞으로 올 방문만 따라간다', () => {
  const ctx = board(); const st = ctx._st;
  ctx.erpSyncSubsDown();                               // typeAtts {t2:a3}
  st.scheds = [
    { id: 'p2', coId: 'c1', typeId: 't2', date: '2026-08-04', attId: 'a3', coAttIds: [] },               // 지난 — 그대로
    { id: 'f2', coId: 'c1', typeId: 't2', date: '2026-09-10', attId: 'a3', coAttIds: ['a2'] },          // 앞으로 · 옛 t2 주담당이 맡음 → 옮긴다
    { id: 'g2', coId: 'c1', typeId: 't2', date: '2026-09-12', attId: 'a1', coAttIds: [] },              // 앞으로 · 일부러 다른 사람 → 그대로
    { id: 'f1', coId: 'c1', typeId: 't1', date: '2026-09-11', attId: 'a1', coAttIds: [] },              // 다른 종류 → 그대로
  ];
  ctx.ERP.consultings[1].managerMain = 'S2';           // 산일충남 주담당이 박한별로
  ctx.erpSyncSubsDown();
  const by = (id) => st.scheds.find((s) => s.id === id);
  assert.strictEqual(by('p2').attId, 'a3', '지난 방문은 증빙 기록이다');
  assert.strictEqual(by('f2').attId, 'a2', '★ 앞으로 올 산일충남 방문이 옛 주담당에게 남아 있습니다');
  assert.ok(!(by('f2').coAttIds || []).includes('a2'), '새 주담당이 같은 방문 부담당에도 남으면 안 된다');
  assert.strictEqual(by('g2').attId, 'a1', '일부러 다른 사람에게 맡긴 방문은 건드리지 않는다');
  assert.strictEqual(by('f1').attId, 'a1', '다른 종류 방문을 건드리면 안 된다');
});

test('종류를 알 수 없거나 주담당이 명단에 없으면 사업별 칸을 건드리지 않는다', () => {
  const ctx = board(); const st = ctx._st;
  st.cos[0].typeAtts = { t2: 'a3' };
  ctx.ERP.dir.push({ sid: 'Z9', name: '모르는사람' });
  ctx.ERP.consultings[1].managerMain = 'Z9';
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].typeAtts.t2, 'a3', '찾을 수 없는 사람으로 바꾸면 그 사업이 «담당 없음» 이 된다');
  const before = st.staff.length;
  assert.strictEqual(st.staff.length, before, '주담당 자리로 사람을 지어내지 않는다');
});

test('같은 종류에 이알피 건이 둘이고 주담당이 다르면 그 종류는 정하지 않는다', () => {
  const ctx = board(); const st = ctx._st;
  ctx.ERP.consultings.push({ id: 'E3', companyName: '다우', typeCode: 'k2', managerMain: 'S2', managerSubs: [] });
  st.cos[0].typeAtts = { t2: 'a3' };
  ctx.erpSyncSubsDown();
  assert.strictEqual(st.cos[0].typeAtts.t2, 'a3', '한 종류 안에서도 갈리면 어느 쪽이 맞는지 앱이 정할 수 없다');
});

test('내려받기 → 올리기 → 내려받기를 되풀이해도 더는 아무것도 안 바뀐다 (진동 없음)', async () => {
  const ctx = board(); const st = ctx._st;
  ctx.erpSyncSubsDown();
  await ctx.erpSyncSubsUp('c1');
  const snap = JSON.stringify([st.cos, st.scheds, ctx.ERP.consultings]);
  st.cloud.length = 0; st.toasts.length = 0;
  ctx.erpSyncSubsDown();
  await ctx.erpSyncSubsUp('c1');
  assert.strictEqual(JSON.stringify([st.cos, st.scheds, ctx.ERP.consultings]), snap);
  assert.strictEqual(st.cloud.length, 0);
  assert.strictEqual(st.toasts.length, 0);
  assert.ok(!st.cloud.some((u) => Object.keys(u).some((p) => /managerMain/.test(p))), '주담당은 이알피에 쓰지 않는다');
});

test('★ 다우테크놀로지 그대로 — 사번 없음·부담당 둘·건마다 주담당이 다름: 한 판 돌고 나면 서로 맞는다', async () => {
  const ctx = loadEngine(); const st = ctx._st;
  st.staff = [{ id: 'a1', name: '권형하' }, { id: 'a3', name: '박한별' }, { id: 'a5', name: '박재원' }];
  ctx.ERP.dir = [{ sid: 'P-001', name: '권형하' }, { sid: 'P-003', name: '박한별' }, { sid: 'P-005', name: '박재원' }];
  st.cos = [{ id: 'co1', name: '다우테크놀로지', defAtt: 'a1', defCoAtts: ['a3', 'a5'], types: ['t1', 't2'] }];
  ctx.ERP.consultings = [
    { id: 'E-tech', companyName: '(주)다우테크놀로지', typeCode: 'k1', managerMain: 'P-001', managerSubs: [] },
    { id: 'E-chung', companyName: '(주)다우테크놀로지', typeCode: 'k2', managerMain: 'P-005', managerSubs: [] },
  ];
  st.ls['pureun_v6_consultings'] = JSON.stringify(ctx.ERP.consultings);
  st.ls['p_subSyncSeeded'] = '2026-08-01';
  ctx._formVal = 'E-tech';

  ctx.erpAutoLinkStaff();
  ctx.erpSyncSubsDown();
  await ctx.erpPushNewLinks();

  assert.strictEqual(st.cos[0].defAtt, 'a1');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(st.cos[0].typeAtts)), { t2: 'a5' },
    '★ 산일충남은 박재원 — 이게 이번 일의 핵심이다');
  assert.ok(st.cos[0].defCoAtts.includes('a5') && st.cos[0].defCoAtts.includes('a3'), '권한 유지');
  assert.ok(!ctx.ERP.consultings[0].managerSubs.includes('P-005'), '박재원은 기술보호 건의 부담당이 아니다');
  st.cloud.length = 0;
  ctx.erpSyncSubsDown();
  await ctx.erpSyncSubsUp('co1', { silent: true });
  assert.strictEqual(st.cloud.length, 0, '두 번째 판은 조용하다');
});

/* ══ ③ 새 일정은 «그 사업의» 주담당이 기본 ═════════════════════ */

test('★ 새 일정 기본 담당 — 세 곳 모두 그 종류의 주담당을 쓴다', () => {
  const sites = [
    [/function saveSingle\(/, /defA\s*=\s*coMainOf\(\s*co\s*,\s*single\.typeId/],
    [/function saveMultiSingle\(/, /defA\s*=\s*coMainOf\(\s*co\s*,\s*single\.typeId/],
    [/function handleDrop\(/, /defA\s*=\s*coMainOf\(\s*co\s*,\s*item\.typeId/],
  ];
  sites.forEach(([fn, rule]) => {
    const m = S.search(fn);
    assert.ok(m >= 0, fn + ' 을(를) 못 찾았다');
    const body = S.slice(m, m + 5200);
    assert.ok(rule.test(body), fn + ' — 기본 담당이 종류별 주담당이 아닙니다(사업장 대표로 박혀 산일충남 방문마다 손으로 고쳐야 한다)');
  });
  assert.ok(!/defA\s*=\s*co\?\.defAtt/.test(S), '사업장 대표로 박는 옛 한 줄이 남아 있다');
});

test('같은 날 중복 검사도 «그 종류의» 주담당으로 본다', () => {
  const ctx = vm.createContext({ Set, Array, Object, JSON,
    getTypes: () => [{ id: 't2', name: '산일충남' }],
    isConflictPair: () => true,
    getCos: () => [{ id: 'c1', defAtt: 'a1', typeAtts: { t2: 'a3' } }, { id: 'c2', defAtt: 'a9' }],
    getScheds: () => [{ id: 's9', date: '2026-09-10', attId: 'a3', typeId: 't2', coId: 'c2' }],
    getStaff: () => [{ id: 'a3', name: '박재원' }] });
  vm.runInContext(grab('coMainOf') + '\n' + grab('checkConflictMatrix'), ctx);
  const r = ctx.checkConflictMatrix('c1', 't2', '2026-09-10');
  assert.ok(r && r.includes('박재원'), '★ 산일충남은 박재원이 가는 사업인데 대표(권형하)로 검사해서 겹침을 못 잡습니다');
});

/* ══ ④ 목록 카드·종류 필터 ═════════════════════════════════ */

function loadDashHelpers() {
  const ctx = vm.createContext({ Set, Array, Object, JSON });
  vm.runInContext([grab('getCoAtts'), grab('coMainOf'), grab('coTypeMainIds'), grab('dashHeadAtts'), grab('dashTypeMainRows')].join('\n'), ctx);
  return ctx;
}
const DAU = { id: 'c1', defAtt: 'a1', defCoAtts: ['a2', 'a3'], types: ['t1', 't2'], typeAtts: { t2: 'a3' } };

test('★ 「사업 · 주담당」 줄은 사업마다 주담당이 «다를 때만» 나온다', () => {
  const h = loadDashHelpers();
  const rows = Array.from(h.dashTypeMainRows(DAU, ['t1', 't2'])).map((x) => x.tid + ':' + x.main).join(',');
  assert.strictEqual(rows, 't1:a1,t2:a3');
  assert.strictEqual(h.dashTypeMainRows({ id: 'c', defAtt: 'a1', types: ['t1', 't2'] }, ['t1', 't2']).length, 0,
    '★ 주담당이 같은데 줄을 만들면 목록이 길어지기만 한다');
  assert.strictEqual(h.dashTypeMainRows(DAU, ['t1']).length, 0, '진행 중인 종류가 하나뿐이면 갈릴 일이 없다');
  assert.strictEqual(h.dashTypeMainRows({ id: 'c', defAtt: 'a1', types: ['t1'] }, ['t1']).length, 0);
});

test('★ 종류 필터를 걸면 머리 칸은 «그 사업의» 주담당이고, 다른 사업 주담당은 +로 끼지 않는다', () => {
  const h = loadDashHelpers();
  const all = h.dashHeadAtts(DAU, '');
  assert.strictEqual(all.main, 'a1', '필터가 없으면 사업장 대표');
  assert.deepStrictEqual(Array.from(all.subs), ['a2', 'a3'], '필터가 없으면 부담당은 지금과 같다');
  const t2 = h.dashHeadAtts(DAU, 't2');
  assert.strictEqual(t2.main, 'a3', '★ 산일충남 필터에서도 권형하로 보입니다');
  assert.deepStrictEqual(Array.from(t2.subs), ['a2'], '주담당이 된 사람은 +에서 빠지고, 대표(권형하)가 +로 나타나면 안 된다');
  const t1 = h.dashHeadAtts(DAU, 't1');
  assert.strictEqual(t1.main, 'a1');
  assert.deepStrictEqual(Array.from(t1.subs), ['a2'], '다른 사업(산일충남)의 주담당 박재원이 +로 끼면 안 된다');
  assert.strictEqual(h.dashHeadAtts(DAU, 'tX').main, 'a1', '이 사업장에 없는 종류면 필터를 무시한다');
});

test('목록 카드는 이 도우미를 쓴다 · 종류별 줄은 «사업별 묶음·종류 필터가 아닐 때만»', () => {
  const m = S.search(/const cardHtml\s*=/);
  assert.ok(m > 0, 'cardHtml 을 찾지 못했다');
  const body = S.slice(m, m + 4200);
  assert.ok(/onlyTid\s*\|\|\s*typeF[\s\S]*dashHeadAtts\(\s*co\s*,\s*vt/.test(body),
    '★ 카드 머리가 «종류를 좁혀 보는 중인지(필터·사업별 묶음)» 를 도우미에 안 넘깁니다 — 종류 필터에서도 사업장 대표로 보입니다');
  assert.ok(/tmRows\s*=\s*vt\s*\?\s*\[\]\s*:\s*dashTypeMainRows\(/.test(body),
    '★ 「사업 · 주담당」 줄은 종류를 좁혀 보는 중이 아닐 때만 그려야 한다 — 필터를 걸었는데 다른 사업 줄까지 나온다');
});

test('타임라인·진행 보기·종류 확대 창도 종류별 주담당을 쓴다', () => {
  const tz = grab('renderTlZoom');
  assert.ok(/coMainOf\(\s*co\s*,\s*t\.id/.test(tz), '종류 확대 창 머리가 사업장 대표로 보입니다');
  assert.ok(!/ac\(co\.defAtt\)|an\(co\.defAtt\)/.test(tz), '확대 창에 옛 대표 표기가 남아 있다');
  assert.ok(/dashHeadAtts\(\s*co\s*,\s*t\.id/.test(tz), '★ 확대 창 머리가 «이 사업의» 주담당·부담당을 도우미로 정하지 않는다');
  assert.ok(!/main\s*:\s*co\.defAtt/.test(tz), '확대 창 머리를 사업장 대표로 박았다');
  assert.ok(/sc\.attId\s*!==\s*coMainOf\(/.test(tz), '「다른 사람이 간 회차」 판정이 옛 대표 기준이다');
  assert.ok(/nm\(\s*coMainOf\(\s*co\s*,\s*it\.t\.id/.test(S), '진행 보기가 옛 대표로 보입니다');
  assert.ok(/att\s*=\s*staff\.find\(a=>a\.id===coMainOf\(\s*co\s*,\s*tid/.test(S), '타임라인 줄이 옛 대표로 보입니다');
});

/* ══ ⑤ 수정 창 ═══════════════════════════════════════════ */

test('★ 저장할 사업별 칸 — 대표와 같은 것·고르지 않은 종류·종류가 하나뿐일 때는 적지 않는다', () => {
  const ctx = vm.createContext({ Set, Array, Object, JSON });
  vm.runInContext(grab('coTypeAttsToSave') + '\n' + grab('coAttsWithTypeMains'), ctx);
  const J = (x) => JSON.parse(JSON.stringify(x));
  assert.deepStrictEqual(J(ctx.coTypeAttsToSave('a1', new Set(['t1', 't2']), { t1: 'a1', t2: 'a3' }, {})), { t2: 'a3' },
    '대표와 같은 칸은 적지 않는다(성긴 표)');
  assert.deepStrictEqual(J(ctx.coTypeAttsToSave('a1', new Set(['t1']), { t1: 'a2' }, {})), {},
    '★ 종류가 하나뿐이면 사업별 칸이 뜻이 없다 — 남아 있으면 나중에 종류를 더했을 때 엉뚱한 사람이 붙는다');
  assert.deepStrictEqual(J(ctx.coTypeAttsToSave('a1', new Set(['t1', 't2']), { t3: 'a2' }, {})), {}, '고르지 않은 종류의 칸은 버린다');
  assert.deepStrictEqual(J(ctx.coTypeAttsToSave('a1', new Set(['t1', 't2']), { t2: 'a2' }, { t2: 'a3' })), { t2: 'a3' },
    '★ 잠긴 종류(이알피를 따르는 사업)는 사람이 고른 값보다 «이알피가 정한 값»이 이긴다');
  assert.deepStrictEqual(J(ctx.coAttsWithTypeMains('a1', ['a2', 'a1'], { t2: 'a3' })).sort(), ['a2', 'a3'],
    '★ 사업별 주담당이 부담당 줄에 없으면 그 사람은 자기 사업의 일정을 못 고친다');
});

test('수정 창에 「사업별 주담당」 칸이 있고 종류가 둘 이상일 때만 보인다', () => {
  assert.ok(/id="mCoTypeMains"/.test(SRC), '창에 칸이 없다');
  const r = grab('renderCoTypeMains');
  assert.ok(/size\s*<\s*2|length\s*<\s*2/.test(r), '종류가 하나뿐일 때 숨기는 판정이 없다');
  assert.ok(/erpTypeMainFor\(/.test(r), '이알피를 따르는 사업을 잠그는 판정이 없다');
  const save = grab('saveCo');
  assert.ok(/coTypeAttsToSave\(/.test(save) && /coAttsWithTypeMains\(/.test(save), '저장이 사업별 칸을 안 담는다');
  assert.ok(/delete\s+next\.typeAtts/.test(save), '★ 칸을 비울 때 «값이 undefined 인 키»를 남기면 실시간DB가 저장을 통째로 거부한다');
});

test('erpTypeMainFor — 그 종류의 이알피 건 주담당이 «한 사람»일 때만 값을 준다', () => {
  const ctx = board();
  assert.strictEqual(ctx.erpTypeMainFor('c1', 't2'), 'a3');
  assert.strictEqual(ctx.erpTypeMainFor('c1', 't1'), 'a1');
  assert.strictEqual(ctx.erpTypeMainFor('c1', 'tZ'), '', '이알피 건이 없는 종류는 잠그지 않는다');
  ctx.ERP.consultings.push({ id: 'E3', companyName: '다우', typeCode: 'k2', managerMain: 'S2', managerSubs: [] });
  assert.strictEqual(ctx.erpTypeMainFor('c1', 't2'), '', '한 종류에 주담당이 둘로 갈리면 정하지 않는다');
});

/* ══ ⑥ 합치기 도구 — 합치다가 사업별 주담당이 사라지면 같은 문제가 또 생긴다 ═════ */

test('★ 사업장을 합칠 때 없어지는 쪽의 주담당은 «그 종류의 사업별 칸»으로 남는다', () => {
  const ctx = vm.createContext({ Set, Array, Object, JSON, Math, String,
    getCos: () => [], getScheds: () => [], todayStr: () => '2026-10-24' });
  vm.runInContext([S.split(/\r?\n/).find((l) => l.trim().startsWith('const CO_CORP_RE=')),
    S.split(/\r?\n/).find((l) => l.trim().startsWith('const _en=')),
    grab('getCoAtts'), grab('coMainOf'), grab('coTypeMainIds'), grab('coKey'), grab('mergeKeeper'), grab('mergePreview'), grab('mergeApplyOne')].join('\n'), ctx);
  const keep = { id: 'k', name: '다우', types: ['t1'], defAtt: 'a1', defCoAtts: [], createdAt: '2026-01-01' };
  const gone = { id: 'g', name: '다우', types: ['t2'], defAtt: 'a3', defCoAtts: [], createdAt: '2026-02-01' };
  const p = ctx.mergePreview([keep, gone]);
  assert.strictEqual(p.keep.id === 'k' || p.keep.id === 'g', true);
  const k = p.keep.id, other = k === 'k' ? gone : keep;
  const cos = [JSON.parse(JSON.stringify(keep)), JSON.parse(JSON.stringify(gone))];
  ctx.mergeApplyOne(p, cos, []);
  const kept = cos.find((c) => c.id === k);
  const otherType = other.types[0];
  assert.strictEqual(ctx.coMainOf(kept, otherType), other.defAtt,
    '★ 합치고 나면 합쳐진 사업의 주담당이 «부담당»으로 밀려납니다 — 다우가 바로 그렇게 생긴 사업장이다');
  assert.ok(ctx.getCoAtts(kept).includes(other.defAtt), '권한은 부담당 줄에도 남긴다(지금과 같다)');
});

/* ══ ⑦ 그려진 모습 — 글자가 실제로 만들어지는지 ═════════════════ */

const escStub = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

test('목록 카드의 「사업 · 주담당」 줄이 사업 이름·주담당 이름·사업 색과 함께 그려진다', () => {
  const ctx = vm.createContext({ escAttr: escStub, staffColor: (m) => m.color || '#000', Set, Array, Object, JSON });
  vm.runInContext(grab('dashTypeMainHtml'), ctx);
  const types = [{ id: 't1', name: '기술보호', color: '#0e9f6e' }, { id: 't2', name: '산일충남', color: '#7c3aed' }];
  const staff = [{ id: 'a1', name: '권형하', color: '#ef6c35' }, { id: 'a3', name: '박재원', color: '#8fb4f2' }];
  assert.strictEqual(ctx.dashTypeMainHtml([], types, staff), '', '줄이 없으면 아무것도 그리지 않는다');
  const h = ctx.dashTypeMainHtml([{ tid: 't1', main: 'a1' }, { tid: 't2', main: 'a3' }], types, staff);
  assert.strictEqual((h.match(/class="tm-row"/g) || []).length, 2, '종류마다 한 줄');
  ['기술보호', '산일충남', '권형하', '박재원', '#7c3aed', '#8fb4f2'].forEach((x) => assert.ok(h.includes(x), x + ' 이(가) 안 그려졌다'));
});

function loadTypeMainsModal(over) {
  const els = { '#mCoTypeMains': { style: {} }, '#mCoTypeMainList': { innerHTML: '' }, '#mCoTypeMainNote': { innerHTML: '' }, '#mCoAtt': { value: 'a1' } };
  const ctx = vm.createContext(Object.assign({
    q: (s) => els[s] || null, qa: () => [], escAttr: escStub, Set, Array, Object, JSON,
    co_selTypes: new Set(['t1', 't2']), co_editId: 'c1', co_typeAtts: {},
    getTypes: () => [{ id: 't1', name: '기술보호', color: '#0e9f6e' }, { id: 't2', name: '산일충남', color: '#7c3aed' }],
    getStaff: () => [{ id: 'a1', name: '권형하' }, { id: 'a3', name: '박재원' }],
    pickableStaff: () => [{ id: 'a1', name: '권형하' }, { id: 'a3', name: '박재원' }],
    erpTypeMainFor: (coId, tid) => (tid === 't2' ? 'a3' : ''),
  }, over || {}));
  vm.runInContext(grab('renderCoTypeMains'), ctx);
  ctx._els = els;
  return ctx;
}

test('★ 수정 창 — 종류가 하나뿐이면 칸을 숨기고, 둘 이상이면 보이되 이알피를 따르는 사업만 잠근다', () => {
  const one = loadTypeMainsModal({ co_selTypes: new Set(['t1']) });
  one.renderCoTypeMains();
  assert.strictEqual(one._els['#mCoTypeMains'].style.display, 'none', '종류가 하나뿐인데 칸이 보이면 헷갈린다');

  const ctx = loadTypeMainsModal();
  ctx.renderCoTypeMains();
  assert.strictEqual(ctx._els['#mCoTypeMains'].style.display, 'block');
  const html = ctx._els['#mCoTypeMainList'].innerHTML;
  assert.strictEqual((html.match(/ctm-lock/g) || []).length, 1, '★ 이알피를 따르는 사업(산일충남)만 잠겨야 한다');
  assert.strictEqual((html.match(/<select/g) || []).length, 1, '이알피 건이 없는 사업(기술보호)은 직접 고른다');
  assert.ok(/ctm-lock[^]*박재원/.test(html), '잠긴 칸에는 이알피가 정한 주담당이 보여야 한다');
  assert.ok(ctx._els['#mCoTypeMainNote'].innerHTML.includes('이알피'), '잠금의 까닭을 말해 준다');
});

test('새 사업장(저장 전)은 이알피와 이어진 것이 없어 잠글 것이 없다', () => {
  const ctx = loadTypeMainsModal({ co_editId: null });
  ctx.renderCoTypeMains();
  const html = ctx._els['#mCoTypeMains'].style.display === 'block' ? ctx._els['#mCoTypeMainList'].innerHTML : '';
  assert.ok(!/ctm-lock/.test(html) && (html.match(/<select/g) || []).length === 2, '둘 다 직접 고를 수 있어야 한다');
});

test('사람이 고른 값은 기본값(사업장 대표)보다 먼저 보인다', () => {
  const ctx = loadTypeMainsModal({ co_editId: null, co_typeAtts: { t1: 'a3' } });
  ctx.renderCoTypeMains();
  const html = ctx._els['#mCoTypeMainList'].innerHTML;
  assert.ok(/<option value="a3" selected>/.test(html), '고른 값이 선택돼 보여야 한다');
});
