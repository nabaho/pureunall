/* 기금 백업 — 결산 파일 본문 때문에 기금 자료 «전체»가 백업에서 빠지던 것.
   실행: node --test tests/backup-fund-blobs.test.js

   2026-11-18 실측: 기금 자료(fund_erp)가 결산 파일 본문(closing_blobs)으로 66MB 가 되어,
   한 칸이 한도(MAX_ENTRY_CHARS)를 넘으면 그 칸을 통째로 건너뛰는 백업이 기금 자료 전체를 건너뛰었다.
   11-16·11-18 백업 기록에 건너뜀이 남았고, 마지막으로 온전한 기금 백업은 11-11 이었다.

   여기서 못 박는 것:
     ① 기금 백업은 «본문 두 칸만» 빼고 나머지를 아랫칸 단위로 담는다 — 통째로 건너뛰지 않는다
     ② 뺀 본문 칸은 서버에서 받지도 않는다(범위 질의) — 내려받기도 준다
     ③ 되돌릴 때 부모 칸(fund_erp)을 쓰지 않는다 — 뺀 본문 칸이 지워지지 않는다
     ④ 키 순서 경계(이름이 비슷한 칸·숫자 칸·한글 칸)도 빠뜨리지 않는다
     ⑤ 다른 앱 설정은 그대로다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-backup.js'), 'utf8');

function loadBackup(pageName) {
  const window = {
    document: {},
    location: { pathname: '/' + pageName },
    navigator: {},
    localStorage: (function () { const m = {}; return {
      getItem: (k) => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: (k) => { delete m[k]; } }; })(),
    addEventListener() {}
  };
  const sandbox = { window, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return window.PUBackup;
}

/* 실시간DB 의 키 순서를 흉내 낸 가짜 — 정수 모양 키가 먼저, 나머지는 글자 순.
   받은 아랫칸 이름을 기록해 «뺀 칸을 받지 않았는가»를 본다. */
const isIntKey = (k) => /^(0|-?[1-9][0-9]*)$/.test(k) && Number(k) >= -2147483648 && Number(k) <= 2147483647;
const cmpKeys = (a, b) => {
  const ia = isIntKey(a), ib = isIntKey(b);
  if (ia && ib) return Number(a) - Number(b);
  if (ia) return -1;
  if (ib) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
};
function makeDb(tree) {
  const reads = [];
  const nodeAt = (p) => p.split('/').reduce((n, k) => (n && typeof n === 'object' ? n[k] : undefined), tree);
  const snapOf = (key, value, entries) => ({
    key,
    exists: () => value !== undefined && value !== null,
    val: () => value,
    forEach(cb) { for (const [k, v] of entries) { if (cb({ key: k, val: () => v }) === true) return true; } return false; }
  });
  return {
    reads,
    ref(p) {
      const node = nodeAt(p);
      const sorted = () => (node && typeof node === 'object' ? Object.entries(node).sort((a, b) => cmpKeys(a[0], b[0])) : []);
      return {
        once() { reads.push({ path: p, whole: true }); return Promise.resolve(snapOf(p.split('/').pop(), node, sorted())); },
        orderByKey() {
          const q = {
            lo: null,
            hi: null,
            startAfter(k) { this.lo = k; return this; },
            endBefore(k) { this.hi = k; return this; },
            once() {
              const picked = sorted().filter(([k]) => (this.lo === null || cmpKeys(k, this.lo) > 0) && (this.hi === null || cmpKeys(k, this.hi) < 0));
              reads.push({ path: p, keys: picked.map((e) => e[0]) });
              return Promise.resolve(snapOf(p.split('/').pop(), picked.length ? Object.fromEntries(picked) : null, picked));
            }
          };
          return q;
        }
      };
    }
  };
}

const B = loadBackup('fund.html');
const cfg = B._config({ uid: 'U1' });
const HEAVY = ['closing_blobs', 'stock_blobs'];

/* 기금 자료 모양 — 본문 두 칸은 한도를 넘는 크기, 나머지는 작다.
   이름 경계를 보려고 뺀 칸과 이름이 비슷한 칸·숫자 칸·한글 칸도 둔다. */
function fundTree() {
  const big = 'B'.repeat(B._limits.entry + 100);
  return {
    fund_erp: {
      '0': { n: 1 },
      '가나': '한글 이름 칸',
      aaa: { x: 1 },
      closing_blob: { near: 'before' },
      closing_blobs: big,
      closing_blobs2: { near: 'after' },
      hwp_tpl: { t: 1 },
      sites: { s: 1 },
      stock_blobs: big,
      zzz: 5
    }
  };
}
const INCLUDED = ['0', '가나', 'aaa', 'closing_blob', 'closing_blobs2', 'hwp_tpl', 'sites', 'zzz'].map((k) => 'fund_erp/' + k);

/* ══════ ① 본문 두 칸만 빼고 담는다 ══════ */

test('기금 백업 설정: fund_erp 는 그대로 읽되 무거운 본문 칸은 except 로 뺀다', () => {
  assert.deepEqual([...cfg.paths], ['fund_erp']); /* 가짜 실행 환경(vm)의 배열은 prototype 이 달라 펼쳐서 견준다 */
  HEAVY.forEach((name) => assert.ok(cfg.except['fund_erp'].includes(name), name + ' 이 except 에 없다'));
});

test('원인 재현 — 본문 칸을 빼지 않으면 fund_erp 한 칸이 통째로 건너뛰어진다', async () => {
  const db = makeDb(fundTree());
  const entries = await B._read(db, ['fund_erp'], {}, {});
  const trimmed = B._trim(entries);
  assert.equal(trimmed.skipped.length, 1);
  assert.equal(trimmed.skipped[0].path, 'fund_erp', '옛 방식이면 기금 자료 전체가 빠진다');
});

test('본문 두 칸만 빼고 나머지 아랫칸은 모두 자기 경로로 담긴다', async () => {
  const db = makeDb(fundTree());
  const entries = await B._read(db, cfg.paths, cfg.strip, cfg.except);
  const got = entries.filter((e) => !e.skipped).map((e) => e.path).sort();
  assert.deepEqual([...got], INCLUDED.slice().sort());
  const trimmed = B._trim(entries);
  assert.equal(trimmed.skipped.length, 0, '이제는 한도에 걸려 건너뛰는 칸이 없어야 한다');
  const sample = entries.find((e) => e.path === 'fund_erp/sites');
  assert.deepEqual(sample.value, { s: 1 });
});

test('뺀 본문 칸은 백업 기록에 «뺐다»고 남는다 — 값은 없다', async () => {
  const db = makeDb(fundTree());
  const entries = await B._read(db, cfg.paths, cfg.strip, cfg.except);
  HEAVY.forEach((name) => {
    const e = entries.find((x) => x.path === 'fund_erp/' + name);
    assert.ok(e, name + ' 표시가 없다');
    assert.equal(e.skipped, 'excluded');
    assert.ok(!('value' in e), '뺀 칸에 값이 들어 있다');
  });
});

/* ══════ ② 뺀 칸은 받지도 않는다 ══════ */

test('범위 질의로 읽어 뺀 본문 칸은 서버에서 받지 않는다', async () => {
  const db = makeDb(fundTree());
  await B._read(db, cfg.paths, cfg.strip, cfg.except);
  assert.ok(db.reads.length >= 1);
  assert.ok(!db.reads.some((r) => r.whole), 'fund_erp 를 통째로 받았다');
  db.reads.forEach((r) => HEAVY.forEach((name) => assert.ok(!r.keys.includes(name), name + ' 을 받았다')));
});

/* ══════ ③ 되돌릴 때 뺀 칸이 지워지지 않는다 ══════ */

test('복원 계획에 부모 칸·뺀 본문 칸이 없다 — 본문 칸을 덮어쓰거나 지우지 않는다', async () => {
  const db = makeDb(fundTree());
  const entries = await B._read(db, cfg.paths, cfg.strip, cfg.except);
  const plan = B._restorePlan({ paths: entries });
  assert.ok(!('fund_erp' in plan), '부모 칸을 통째로 쓰려 한다');
  HEAVY.forEach((name) => assert.ok(!(('fund_erp/' + name) in plan), name + ' 을 건드리려 한다'));
  assert.deepEqual(Object.keys(plan).sort(), INCLUDED.slice().sort());
});

test('본문 칸만 있는 경우에도 부모 칸 항목을 만들지 않는다', async () => {
  const only = { fund_erp: { closing_blobs: 'x', stock_blobs: 'y' } };
  const entries = await B._read(makeDb(only), cfg.paths, cfg.strip, cfg.except);
  assert.ok(!entries.some((e) => e.path === 'fund_erp'), '부모 칸 항목이 생겼다 — 복원이 본문 칸을 지울 수 있다');
  assert.deepEqual(Object.keys(B._restorePlan({ paths: entries })), []);
});

/* ══════ ④ 키 순서 경계 ══════ */

test('뺀 칸과 이름이 비슷한 칸·숫자 칸·한글 칸이 범위 사이로 빠지지 않는다', async () => {
  const entries = await B._read(makeDb(fundTree()), cfg.paths, cfg.strip, cfg.except);
  ['fund_erp/closing_blob', 'fund_erp/closing_blobs2', 'fund_erp/0', 'fund_erp/가나', 'fund_erp/zzz'].forEach((p) => {
    assert.ok(entries.some((e) => e.path === p && !e.skipped), p + ' 이 빠졌다');
  });
});

/* ══════ ④-2 옛 통째 백업(부모 칸 한 항목)으로 되돌려도 뺀 본문 칸은 그대로 ══════ */

test('옛 통째 백업(fund_erp 한 항목)을 되돌려도 뺀 본문 칸을 쓰지 않는다 — 부모를 덮어쓰지 않는다', () => {
  const old = { paths: [{ path: 'fund_erp', exists: true, value: { sites: { s: 1 }, hwp_tpl: { t: 1 }, closing_blobs: '옛 사본', stock_blobs: '옛 사본' } }] };
  const plan = B._restorePlan(old, cfg.except);
  assert.ok(!('fund_erp' in plan), '부모 칸을 통째로 쓰려 한다 — 지금 DB 의 본문 칸이 지워진다');
  HEAVY.forEach((name) => assert.ok(!(('fund_erp/' + name) in plan), name + ' 을 옛 사본으로 바꾸려 한다'));
  assert.deepEqual(Object.keys(plan).sort(), ['fund_erp/hwp_tpl', 'fund_erp/sites']);
  assert.deepEqual(plan['fund_erp/sites'], { s: 1 });
});

test('옛 통째 백업이 «당시 비어 있었다»고 적혀 있어도 부모 칸을 비우지 않는다', () => {
  const plan = B._restorePlan({ paths: [{ path: 'fund_erp', exists: false }] }, cfg.except);
  assert.deepEqual(Object.keys(plan), []);
});

test('except 를 넘기지 않으면(다른 앱) 옛 방식 그대로 — 부모 칸 통째 복원', () => {
  const plan = B._restorePlan({ paths: [{ path: 'fund_erp', exists: true, value: { a: 1 } }] });
  assert.deepEqual(Object.keys(plan), ['fund_erp']);
  const plan2 = B._restorePlan({ paths: [{ path: 'work_erp', exists: true, value: { a: 1 } }] }, { fund_erp: HEAVY });
  assert.deepEqual(Object.keys(plan2), ['work_erp'], 'except 가 없는 칸은 건드리지 않는다');
});

test('복원 화면은 지금 설정의 except 를 복원 계획에 넘긴다 — 빠지면 옛 백업 복원이 본문 칸을 덮어쓴다', () => {
  assert.ok(src.includes('restorePlan(backup, config.except)'), 'restore() 가 restorePlan 에 config.except 를 넘기지 않는다');
});

/* ══════ ④-3 뺀 칸 이름에 숫자 모양 키가 섞여도 범위가 뒤집히지 않는다 ══════ */

test('뺀 칸 이름이 정수 모양이어도 키 순서(정수 먼저·수치 순)대로 범위를 만든다', async () => {
  const tree = { p: { '1': 'a', '2': 'x', '3': 'c', '9': 'd', '10': 'x', '11': 'e', '100': 'f', aaa: 'g', zzz: 'h' } };
  const entries = await B._read(makeDb(tree), ['p'], {}, { p: ['10', '2'] });
  const got = entries.filter((e) => !e.skipped).map((e) => e.path).sort();
  assert.deepEqual([...got], ['p/1', 'p/100', 'p/11', 'p/3', 'p/9', 'p/aaa', 'p/zzz'].sort());
  assert.deepEqual([...entries.filter((e) => e.skipped).map((e) => e.path).sort()], ['p/10', 'p/2']);
});

/* ══════ ⑤ 다른 앱 설정은 그대로 ══════ */

test('except 는 기금 한 곳에만 있다 — 다른 앱은 옛 방식 그대로', () => {
  ['enter.html', 'chwieop.html', 'docs-esign.html', 'gov-consulting.html', 'kcareer.html', 'payroll-os.html', 'pu-cards.html', 'rules.html', 'work.html']
    .forEach((page) => {
      const c = loadBackup(page)._config({ uid: 'U1' });
      assert.deepEqual(Object.keys(c.except), [], page + ' 에 except 가 생겼다');
    });
});
