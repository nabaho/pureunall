/* 「정부컨설팅 일정관리에서 종료하면 푸른이알피에도 종료」 (대표 2026-10-24 「추천대로」)
 *
 * ★ «묻고» 쓴다 — 자동으로 쓰지 않는다.
 * ★ 이알피의 종료 권한을 따른다 — 관리자이거나 그 건의 주담당일 때만.
 * ★ 이알피 「종료」 단추와 «같은 칸» (status:'closed'·closedAt·endDate·closedReason). closedDate 는 안 적는다.
 * ★ 「재개」는 이알피를 되살리지 않는다 (더하기만).
 * 못 박는 것은 «지금 값»이 아니라 규칙이다 (CLAUDE.md).
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const test = require('node:test');
const assert = require('node:assert');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
const LINES = SRC.split(/\r?\n/);
function grab(n) {
  const i = SRC.search(new RegExp('(?:async\\s+)?function ' + n + '\\('));
  assert.ok(i >= 0, n + ' 을(를) 못 찾았다');
  let d = 0, st = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; st = true; }
    else if (SRC[j] === '}') { d--; if (st && !d) return SRC.slice(i, j + 1); }
  }
}
function grabLine(prefix) {
  const l = LINES.find((x) => x.trim().startsWith(prefix));
  assert.ok(l, prefix + ' 을(를) 못 찾았다');
  return l;
}

const TODAY = '2026-10-24';
/* 이알피 건 — 이알피가 실제로 갖는 모습 */
const E = (o) => Object.assign({ id: 'e1', no: '산업-2026-001', companyName: '다우테크놀로지', typeCode: 'CODE1', status: 'progress', managerMain: 'P-002' }, o);
const CO = (o) => Object.assign({ id: 'c1', name: '다우테크놀로지', types: ['t1'], endedTypes: {} }, o);

function world(opt) {
  opt = opt || {};
  const writes = [];
  const store = { ['pureun_v6_consultings']: JSON.stringify(opt.local || []) };
  const ctx = {
    ERP: { loaded: opt.loaded !== false, stale: !!opt.stale, consultings: opt.cons || [E()], types: [] },
    getErpTypeMap: () => ({ CODE1: 't1' }),
    getCos: () => opt.cos || [CO()],
    getStaff: () => opt.staff || [{ id: 's1', name: '박한별', erpSid: 'P-002' }],
    myId: () => (opt.me === undefined ? 's1' : opt.me),
    isAdmin: () => !!opt.admin,
    todayStr: () => TODAY,
    escAttr: (s) => String(s),
    FB_READY: opt.fb !== false,
    _fbDB: opt.fb === false ? null : { ref: () => ({ update: async (up) => { if (opt.cloudFail) throw new Error('x'); writes.push(up); } }) },
    erpConsObjForm: async () => opt.form !== false,
    ERP_LS_PREFIX: 'pureun_v6_',
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    toast: (m, k) => { ctx.__toast = m; ctx.__kind = k; },
    showConfirm: (m, y) => { ctx.__confirm = m; ctx.__yes = y; },
    console, String, Array, Object, JSON, Date,
    __store: store,
  };
  vm.createContext(ctx);
  vm.runInContext([
    grabLine('const CO_CORP_RE='), grabLine('const _en='),
    grab('coKey'), grab('coKeyLoose'), grab('findCoForErp'),
    grab('erpConsCode'), grab('erpIsClosed'),
    grab('erpOpenFor'), grab('erpCanCloseUp'), grab('erpLocalPatch'), grab('erpWriteClosed'), grab('erpAskCloseUp'),
  ].join('\n'), ctx);
  ctx.__writes = writes;
  return ctx;
}

test('★★ 이어진 «안 끝난» 이알피 건만 찾는다 — 끝난 건·다른 사업·다른 사업장은 뺀다', () => {
  const w = world({ cons: [E(), E({ id: 'e2', status: 'closed', closedAt: '2026-08-01' }), E({ id: 'e3', typeCode: 'OTHER' }), E({ id: 'e4', companyName: '남의회사' })], cos: [CO(), CO({ id: 'c2', name: '남의회사' })] });
  assert.deepStrictEqual(Array.from(w.erpOpenFor('c1', 't1')).map((c) => c.id), ['e1']);
  assert.deepStrictEqual(Array.from(w.erpOpenFor('c2', 't1')).map((c) => c.id), ['e4']);
});

test('★★ 이알피를 못 읽었거나 이어진 건이 없으면 묻지도 않는다 (예전 그대로 「종료 처리됨」)', () => {
  const w = world({ loaded: false });
  assert.strictEqual(w.erpAskCloseUp('c1', 't1'), false);
  assert.strictEqual(w.__confirm, undefined);
  const w2 = world({ cons: [E({ companyName: '아무도모름' })] });
  assert.strictEqual(w2.erpAskCloseUp('c1', 't1'), false);
});

test('★★★ 관리자이거나 그 건의 주담당일 때만 쓴다 — 아니면 «쓰지 않고» 이알피에서 하라고 말한다', () => {
  const w = world({ me: 's9', staff: [{ id: 's9', name: '타인', erpSid: 'P-009' }] });
  assert.strictEqual(w.erpAskCloseUp('c1', 't1'), true);
  assert.strictEqual(w.__confirm, undefined, '권한이 없는데 «종료할까요?»를 묻는다');
  assert.match(w.__toast, /담당자·관리자만/);
  assert.match(w.__toast, /이알피에서 종료/);
  const adm = world({ me: 's9', admin: true, staff: [{ id: 's9', name: '대표', erpSid: '' }] });
  adm.erpAskCloseUp('c1', 't1'); assert.ok(adm.__confirm, '관리자는 묻는다');
  const main = world({}); main.erpAskCloseUp('c1', 't1'); assert.ok(main.__confirm, '주담당은 묻는다');
});

test('★★★ 묻기만 한다 — 「확인」을 누르기 전에는 이알피에 한 글자도 안 쓴다', () => {
  const w = world({});
  assert.strictEqual(w.erpAskCloseUp('c1', 't1'), true);
  assert.match(w.__confirm, /푸른이알피의 같은 사업 1건/);
  assert.match(w.__confirm, /산업-2026-001/);
  assert.strictEqual(w.__writes.length, 0);
});

test('★★★ 「확인」을 누르면 이알피 종료 단추와 «같은 칸»을 칸 단위로 쓴다 — closedDate 는 안 적는다', async () => {
  const w = world({ local: [E()] });
  w.erpAskCloseUp('c1', 't1');
  await w.__yes();
  assert.strictEqual(w.__writes.length, 1);
  const up = w.__writes[0], P = 'data/consultings/v/e1/';
  assert.strictEqual(up[P + 'status'], 'closed');
  assert.strictEqual(up[P + 'closedAt'], TODAY);
  assert.strictEqual(up[P + 'endDate'], TODAY);
  assert.strictEqual(up[P + 'closedReason'], '정상 종료');
  assert.strictEqual(up[P + 'permanentArchived'], true);
  assert.ok(!(P + 'closedDate' in up), 'closedDate 는 이알피가 안 적는 칸이다');
  assert.ok('data/consultings/u' in up, '이알피가 변경을 알아차리는 시각 칸');
  assert.ok(Object.keys(up).every((k) => k === 'data/consultings/u' || k.startsWith(P)), '레코드를 통째로 보내면 남이 고친 칸이 되돌아간다');
  /* 사본과 메모리도 맞춘다 — 안 맞추면 다음에 읽을 때 「아직 안 끝났다」며 또 묻는다 */
  assert.strictEqual(JSON.parse(w.__store['pureun_v6_consultings'])[0].status, 'closed');
  assert.strictEqual(w.ERP.consultings[0].status, 'closed');
  assert.match(w.__toast, /1건을 종료했습니다/);
});

test('★★ 이알피에 이미 endDate 가 있으면 그 날을 지킨다 (사람이 고른 날)', async () => {
  const w = world({ cons: [E({ endDate: '2026-12-31', closedReason: '계약 만료' })] });
  w.erpAskCloseUp('c1', 't1'); await w.__yes();
  assert.strictEqual(w.__writes[0]['data/consultings/v/e1/endDate'], '2026-12-31');
  assert.strictEqual(w.__writes[0]['data/consultings/v/e1/closedReason'], '계약 만료');
});

test('★★★ 못 올리면 «올렸다»고 하지 않는다 — 사본도 안 고친다 · 이알피에서 직접 하라고 말한다', async () => {
  for (const o of [{ cloudFail: true }, { form: false }, { fb: false }]) {
    const w = world(Object.assign({ local: [E()] }, o));
    w.erpAskCloseUp('c1', 't1'); await w.__yes();
    assert.match(w.__toast, /못 올린 1건/, JSON.stringify(o));
    assert.strictEqual(JSON.parse(w.__store['pureun_v6_consultings'])[0].status, 'progress', '못 올렸는데 사본만 끝으로 바뀐다 — 이 기기에서만 끝난 것처럼 보인다');
    assert.strictEqual(w.ERP.consultings[0].status, 'progress');
  }
});

test('★★ 옛 사본으로 읽은 판이면 쓰지 않는다 — 몇 달 전 사본을 믿고 도는 건을 끝내면 안 된다', () => {
  const w = world({ stale: true });
  assert.strictEqual(w.erpAskCloseUp('c1', 't1'), true);
  assert.strictEqual(w.__confirm, undefined);
  assert.match(w.__toast, /옛 사본/);
});

test('★★ 건이 여럿이면 권한 있는 건만 묻고 나머지 수를 말한다', async () => {
  const w = world({ cons: [E(), E({ id: 'e2', no: '산업-2026-002', managerMain: 'P-009' })] });
  w.erpAskCloseUp('c1', 't1');
  assert.match(w.__confirm, /같은 사업 1건/);
  assert.match(w.__confirm, /권한 없는 1건은 제외/);
  await w.__yes();
  assert.deepStrictEqual(w.__writes.map((u) => Object.keys(u).some((k) => k.includes('/e1/'))), [true]);
});

/* ══ 규칙 (소스) ═══════════════════════════════════════════════ */

test('★★ 종료 단추는 일정관리 종료와 사업장 잠금 해제를 «먼저» 하고 그 뒤에 이알피를 묻는다', () => {
  const f = grab('endConsulting');
  const a = f.indexOf('setCos(cos)'), r = f.indexOf('releaseCompanyEditLock()', a), q2 = f.indexOf('erpAskCloseUp(coId,typeId)');
  assert.ok(a > 0 && r > a && q2 > r, '일정 종료 → 잠금 해제 → 이알피 묻기 순서여야 한다 (이알피를 묻는 동안 잠금을 쥐면 남이 못 고친다)');
  assert.match(f, /if\(!erpAskCloseUp\(coId,typeId\)\)toast\('종료 처리됨'\)/, '이알피에 안 묻는 경우에는 예전 알림 그대로');
});

test('★ 「재개」는 이알피를 되살리지 않는다 — 더하기만 한다', () => {
  const f = grab('restoreConsulting');
  assert.ok(!/erp|_fbDB|data\/consultings/i.test(f), '재개가 이알피를 건드린다 — 이알피에서 끝낸 일이 일정관리 재개 한 번에 되돌아온다');
});

test('★ 이알피에 쓰는 종료 칸에 closedDate 를 적지 않는다 (소스)', () => {
  assert.ok(!/closedDate\s*:/.test(grab('erpWriteClosed')));
});
