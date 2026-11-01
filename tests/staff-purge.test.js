// 퇴직자 파기·열람 기록·발급대장 취소 (개인정보 3단계, 2026-11-01)
// 대표 지시: 「퇴사하고 3년(연락처 등)·5년(주민번호·계좌 등). 재직 중이면 3년이 지나도 지우면 안 된다」
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

require(path.join(__dirname, '..', 'js', 'pu-rrn-seal.js'));
const S = require(path.join(__dirname, '..', 'js', 'pu-staff-secret.js'));
const Seal = globalThis.PuRrnSeal;

const TODAY = '2026-11-01';

test('★★ 재직·휴직·입사예정·퇴직예정은 몇 년이 지나도 기한이 오지 않는다', () => {
  ['active', 'leave', 'scheduled', undefined, ''].forEach((st) => {
    const i = S.purgeInfo({ status: st, retireDate: '2010-01-01', hireDate: '2000-01-01' }, '2010-02', TODAY);
    assert.strictEqual(i.eligible, false, '상태 ' + st + ' 가 파기 대상이 됩니다');
    assert.strictEqual(i.contactDue, false);
    assert.strictEqual(i.secretDue, false);
  });
  // 퇴직 «예정»(아직 재직)도 아니다 — 상태가 active 이고 retirePending 만 켜져 있다
  assert.strictEqual(S.purgeInfo({ status: 'active', retirePending: true, retireDate: '2026-12-31' }, '', TODAY).eligible, false);
});

test('퇴직일을 모르면 셈하지 않는다', () => {
  assert.strictEqual(S.purgeInfo({ status: 'retired' }, '2020-01', TODAY).eligible, false);
});

test('연락처 등 3년 · 주민번호·계좌 등 5년 — 퇴직일 기준', () => {
  const i = S.purgeInfo({ status: 'retired', retireDate: '2021-06-30' }, '', TODAY);
  assert.strictEqual(i.contactDate, '2024-06-30');
  assert.strictEqual(i.secretDate, '2026-06-30');
  assert.strictEqual(i.contactDue, true);
  assert.strictEqual(i.secretDue, true);
  const j = S.purgeInfo({ status: 'retired', retireDate: '2023-10-31' }, '', TODAY);
  assert.strictEqual(j.contactDue, true, '3년 지남');
  assert.strictEqual(j.secretDue, false, '5년은 아직');
});

test('기산일은 퇴직일과 «마지막 급여 기재월 다음 달» 중 늦은 날', () => {
  const i = S.purgeInfo({ status: 'retired', retireDate: '2023-05-31' }, '2023-06', TODAY);
  assert.strictEqual(i.base, '2023-07-28');
  const j = S.purgeInfo({ status: 'retired', retireDate: '2023-05-31' }, '2022-01', TODAY);
  assert.strictEqual(j.base, '2023-05-31', '급여 기록이 더 이르면 퇴직일');
});

test('기한 당일부터 지울 수 있고, 하루 전에는 못 지운다', () => {
  const u = { status: 'retired', retireDate: '2023-11-01' };
  assert.strictEqual(S.purgeInfo(u, '', '2026-11-01').contactDue, true);
  assert.strictEqual(S.purgeInfo(u, '', '2026-10-31').contactDue, false);
});

test('파기 패치: 연락처류만 비우고 이름·직책·생년월일은 안 건드린다', () => {
  const p = S.contactPatch('2026-11-01', '대표');
  S.CONTACT_FIELDS.forEach((f) => assert.strictEqual(p[f], ''));
  ['name', 'title', 'birthDate', 'hireDate', 'retireDate', 'sid', 'baseSalary'].forEach((f) => assert.ok(!(f in p), f + ' 를 건드립니다'));
  assert.strictEqual(p.piiPurgedAt, '2026-11-01');
  const q = S.secretPatch('2026-11-01', '대표');
  assert.strictEqual(q.hasRrn, false);
  assert.strictEqual(q.foreignerRegNo, '');
  assert.ok(!('rrn' in q) && !('accountNo' in q), '금고 칸 이름이 명부 패치에 섞였습니다');
});

// 가짜 DB (staff-secret.test.js 와 같은 모양)
function fakeDb(initial) {
  const store = Object.assign({}, initial || {});
  function tree(p) {
    const t = {};
    Object.keys(store).forEach((k) => {
      if (!(k === p || k.startsWith(p + '/'))) return;
      const rest = k.slice(p.length).split('/').filter(Boolean);
      if (!rest.length) return;
      let o = t; rest.forEach((r, i) => { if (i === rest.length - 1) o[r] = store[k]; else o = (o[r] = o[r] || {}); });
    });
    return Object.keys(t).length ? t : null;
  }
  return { store, ref: (p) => ({ once: () => Promise.resolve({ val: () => tree(p || '') }),
    update: (paths) => { Object.keys(paths).forEach((k) => { if (paths[k] === null) delete store[k]; else store[k] = paths[k]; }); return Promise.resolve(); } }) };
}

test('금고 파기: 값이 있던 칸만 지우고 «지움» 기록이 남는다(값은 안 남는다)', async () => {
  const key = await Seal.importKey(Seal.newKeyB64());
  S.setKeyProvider(() => Promise.resolve(key));
  S._resetCache();
  const db = fakeDb();
  await S.write(db, { 'A-001': { rrn: '900101-1234567', account: '110-123-456789' } }, { sid: 'P-001', name: '대표' });
  const r = await S.purgeSecrets(db, 'A-001', { sid: 'P-001', name: '대표' });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(db.store['staff_secret/A-001/rrn'], undefined);
  assert.strictEqual(db.store['staff_secret/A-001/account'], undefined);
  const clears = Object.keys(db.store).filter((k) => k.includes('/_log/') && db.store[k].act === 'clear');
  assert.strictEqual(clears.length, 2);
  // 값이 없는 사람은 아무것도 쓰지 않는다
  const none = await S.purgeSecrets(db, 'A-009', { sid: 'P-001', name: '대표' });
  assert.deepStrictEqual(none, { ok: true, n: 0 });
});

test('열람 기록 요약: 범위·횟수·하루 열람 10번 초과 표시', () => {
  const now = new Date(2026, 10, 15, 12, 0).getTime();
  const day = (d, h) => new Date(2026, 10, d, h, 0).getTime();
  const rows = [];
  for (let i = 0; i < 11; i++) rows.push({ sid: 'A-001', at: day(10, 9) + i * 1000, by: 'P-001', byName: '대표', act: 'view', field: 'rrn' });
  rows.push({ sid: 'A-001', at: day(12, 9), by: 'P-001', byName: '대표', act: 'save', field: 'rrn' });
  rows.push({ sid: 'A-002', at: new Date(2026, 8, 1).getTime(), by: 'P-001', byName: '대표', act: 'clear', field: 'rrn' });
  const all = S.summarize(rows, now, 'all');
  assert.deepStrictEqual(all.counts, { view: 11, save: 1, clear: 1 });
  assert.strictEqual(all.flagged.length, 1);
  const m = S.summarize(rows, now, 'month');
  assert.strictEqual(m.counts.clear, 0, '이번 달만');
  const d30 = S.summarize(rows, now, '30');
  assert.strictEqual(d30.counts.clear, 0, '30일 밖');
  assert.strictEqual(S.summarize(rows.slice(0, 10), now, 'all').flagged.length, 0, '10번까지는 정상');
});

test('열람 기록 읽기: 금고 전체에서 모아 최근 것이 앞', async () => {
  const db = fakeDb({
    'staff_secret/A-001/_log/l1': { by: 'P-001', byName: '대표', at: 100, act: 'view', field: 'rrn' },
    'staff_secret/A-002/_log/l2': { by: 'P-001', byName: '대표', at: 300, act: 'save', field: 'account' }
  });
  const r = await S.readLogs(db);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.rows.map((x) => x.at), [300, 100]);
});

// ── 화면: 껍데기를 «실제로 그려 본다» (글자 찾기로는 못 잡는 ReferenceError 를 잡는다)
const html = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
function pull(name) {
  const i = html.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 없음');
  const j = html.indexOf('\n}', i);
  return html.slice(i, j + 2);
}
function render(name, props, extra) {
  const hooks = [];
  const ctx = {
    h: (t, p, ...c) => ({ t, p, c: c.flat(Infinity) }),
    useState: (v) => [v, () => {}], useEffect: () => {}, useEscClose: () => {},
    todayYMD: () => TODAY, dbGet: () => [], dbPatch: () => true, showToast: () => {}, popConfirm: async () => true,
    CURRENT_USER: { sid: 'P-001', name: '대표', isAdmin: true }, fbDb: null, console, Date, Object, Array, String, Math,
    PuStaffSecret: S, window: { PuStaffSecret: S }
  };
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  vm.runInContext(pull(name) + '\nthis.__fn = ' + name + ';', ctx);
  return ctx.__fn(props);
}
function textOf(n) { return n == null || n === false ? '' : typeof n !== 'object' ? String(n) : (n.c || []).map(textOf).join(' '); }

test('파기 창을 그려 본다 — 재직자는 목록에 없고, 기한 지난 퇴직자는 체크할 수 있다', () => {
  const users = [
    { sid: 'A-001', name: '재직자', status: 'active', hireDate: '2000-01-01', phone: '010-1200-0001' },
    { sid: 'A-002', name: '옛퇴직자', status: 'retired', retireDate: '2018-06-30', phone: '010-1200-0002', hasRrn: true },
    { sid: 'A-003', name: '최근퇴직자', status: 'retired', retireDate: '2026-05-31', phone: '010-1200-0003' }
  ];
  const tree = render('StaffPurgeModal', { users, onClose() {} });
  const txt = textOf(tree);
  assert.ok(txt.includes('옛퇴직자') && txt.includes('최근퇴직자'));
  assert.ok(!txt.includes('재직자 '), '재직자가 파기 목록에 나옵니다');
  assert.ok(txt.includes('기한 지남'));
  assert.ok(!/A-00\d/.test(txt), '사번이 화면에 찍힙니다');
});

test('열람 기록 창을 그려 본다', () => {
  const tree = render('StaffAccessLogModal', { users: [{ sid: 'A-001', name: '가' }], onClose() {} });
  assert.ok(textOf(tree).includes('개인정보 열람 기록'));
});

test('명부의 파기·열람 버튼은 대표에게만 보인다', () => {
  const code = html.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(code, /_ssAdminR && h\('button', \{ onClick:function\(\)\{ setAccLogOpen\(true\)/);
  assert.match(code, /_ssAdminR && h\('button', \{ onClick:function\(\)\{ setPurgeOpen\(true\)/);
  assert.match(code, /purgeOpen && _ssAdminR && h\(StaffPurgeModal/);
});

test('파기는 자동이 아니다 — 확인창을 거치고, 퇴직 상태가 아닌 사람은 대상이 못 된다', () => {
  const body = pull('StaffPurgeModal');
  assert.match(body, /await popConfirm\(/);
  assert.match(body, /canContact: info\.contactDue && hasContact/);
  assert.match(body, /picked = doable\.filter/);
  // 파기를 «스스로» 부르는 길(setInterval·useEffect 안의 doPurge)이 없다
  assert.doesNotMatch(body, /setInterval|useEffect\(function\(\)\{[^}]*doPurge/);
});

test('발급대장은 지우지 않고 «취소» 표시만 한다', () => {
  const code = html.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = code.indexOf('async function delLog(');
  const body = code.slice(i, i + 900);
  assert.match(body, /canceled:true/);
  assert.doesNotMatch(body, /log\.filter\(function\(r\)\{return r\.id!==id;\}\)/, '줄을 지우고 있습니다');
});
