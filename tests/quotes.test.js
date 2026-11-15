'use strict';
/* 견적 기록 저장 층 — 글은 pu_quotes, 금액은 pu_quote_amt 로 «따로» 둔다(규칙이 금액만 잠근다)
   ■ 지키는 것
     ⓐ 견적 기록(pu_quotes)에는 금액 칸이 없다 — 금액은 pu_quote_amt/{qid} 에만.
     ⓑ 순서: 기록 먼저, 금액 나중. RTDB 에 undefined 를 안 넣는다.
     ⓒ 전체 금액 읽기가 거절되면(재무·관리자가 아님) 건마다 읽고 거절은 건너뛴다. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');

const R = path.join(__dirname, '..');
function load() {
  const box = { console, Date, Math, JSON, Promise, Object, Array, String, Number, Error };
  box.window = box;
  vm.createContext(box);
  ['js/pu-office-store.js', 'js/pu-worklog.js', 'js/pu-quotes.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(R, f), 'utf8'), box));
  return box;
}
const out = (v) => JSON.parse(JSON.stringify(v));

/* 가짜 실시간DB — 경로별 통짜 값. deny 에 든 경로를 읽으면 PERMISSION_DENIED */
function fakeDb(opts) {
  opts = opts || {};
  const store = {}; const order = []; let seq = 0;
  const deny = opts.deny || [];
  function noUndef(v, p) {
    if (v === undefined) throw new Error('undefined at ' + p);
    if (v && typeof v === 'object') Object.keys(v).forEach((k) => noUndef(v[k], p + '/' + k));
  }
  function get(p) {
    const pre = p + '/'; let found = false; const o = {};
    Object.keys(store).forEach((k) => {
      if (k.indexOf(pre) === 0) { found = true; o[k.slice(pre.length)] = store[k]; }
    });
    if (store[p] !== undefined) return JSON.parse(JSON.stringify(store[p]));
    return found ? JSON.parse(JSON.stringify(o)) : null;
  }
  const db = {
    store, order, updates: [],
    ref(p) {
      /* 뿌리 ref() — 여러 자리 한 번에 쓰기(update)만 흉내 낸다 */
      if (!p) {
        return { update(up) {
          db.updates.push(up);
          Object.keys(up).forEach((k) => { noUndef(up[k], k); store[k] = JSON.parse(JSON.stringify(up[k])); });
          return Promise.resolve();
        } };
      }
      return {
        key: p.split('/').pop(),
        push(v) { seq++; const r = db.ref(p + '/q' + seq); if (v !== undefined) { noUndef(v, p); store[p + '/q' + seq] = JSON.parse(JSON.stringify(v)); } return r; },
        once() {
          if (deny.indexOf(p) >= 0) return Promise.reject(Object.assign(new Error('permission_denied at /' + p), { code: 'PERMISSION_DENIED' }));
          return Promise.resolve({ val: () => get(p), exists: () => get(p) != null });
        },
        set(v) { noUndef(v, p); order.push(p); store[p] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); },
        orderByChild(c) {
          return { equalTo(val) {
            return { limitToFirst() { return this; }, once() {
              const all = get(p) || {}; const hit = {};
              Object.keys(all).forEach((id) => { if (all[id] && all[id][c] === val) hit[id] = all[id]; });
              return Promise.resolve({ val: () => (Object.keys(hit).length ? hit : null), exists: () => Object.keys(hit).length > 0 });
            } };
          } };
        }
      };
    }
  };
  return db;
}
function worklog(db) {
  return Object.keys(db.store).filter((k) => k.indexOf('pu_worklog/') === 0).map((k) => db.store[k]);
}

test('typeOf — 실제 제목들', () => {
  const t = load().PuQuotes.typeOf;
  assert.strictEqual(t('직무분석 컨설팅 견적서'), 'hr_consult');
  assert.strictEqual(t('현대제철(주) 직장 내 괴롭힘 및 성희롱 조사 용역 견적서'), 'investigation');
  assert.strictEqual(t('성희롱예방교육 견적서'), 'education');
  assert.strictEqual(t('산업안전 컨설팅 견적서'), 'safety');
  assert.strictEqual(t('인건비 원가산출에 관한 견적서'), 'hr_consult');
  assert.strictEqual(t("'27년 월 자문 견적서"), 'advice');
  assert.strictEqual(t('위임계약서_서산시청'), 'case');
  assert.strictEqual(t('견적서 등'), 'other');
  assert.strictEqual(t(undefined), 'other');
});
test('TYPES — 순서와 이름', () => {
  const T = out(load().PuQuotes.TYPES);
  assert.deepStrictEqual(T.map((x) => x.code),
    ['education', 'investigation', 'safety', 'hr_consult', 'bargaining', 'fund', 'opinion', 'advice', 'case', 'other']);
  assert.strictEqual(T[0].label, '교육·강의'); assert.strictEqual(T[8].label, '사건 대리');
});

test('save — 금액은 따로, undefined 없음, 기록 먼저', async () => {
  const b = load(); const db = fakeDb();
  b.PuQuotes.init({ db, uid: 'u1', name: '김노무' });
  b.PuWorklog.init({ db, uid: 'u1', name: '김노무' });
  const qid = await b.PuQuotes.save(
    { doc: 'quote', type: 'hr_consult', co: '(주)가나상사', date: '2026-11-01', scope: undefined, src: { how: 'upload' }, review: 'ok' },
    { amount: 4000000, vat: 'excl' });
  const rec = db.store['pu_quotes/' + qid]; const amt = db.store['pu_quote_amt/' + qid];
  assert.ok(rec, '기록이 없다');
  assert.ok(!('amount' in rec) && !('amt' in rec), '기록에 금액 칸이 있다');
  assert.strictEqual(rec.coKey, b.PuOfficeStore.coKey('(주)가나상사'));
  assert.strictEqual(rec.by, 'u1'); assert.strictEqual(typeof rec.createdAt, 'number');
  assert.strictEqual(rec.updatedAt, rec.createdAt);
  assert.strictEqual(rec.id, qid, '온톨로지 — id 는 열쇠와 같다');
  assert.strictEqual(rec.entityType, 'Document');
  assert.ok(!('at' in rec), '옛 칸(at) 대신 createdAt·updatedAt');
  assert.ok(!('scope' in rec));
  assert.strictEqual(amt.amount, 4000000); assert.strictEqual(amt.vat, 'excl');
  assert.strictEqual(amt.owner, ''); assert.strictEqual(amt.by, 'u1'); assert.strictEqual(typeof amt.at, 'number');
  assert.ok(db.order.indexOf('pu_quotes/' + qid) < db.order.indexOf('pu_quote_amt/' + qid));
  assert.ok(worklog(db).some((e) => e.kind === 'quote_save'));
});
test('save — 금액 없으면 금액 칸을 안 만든다', async () => {
  const b = load(); const db = fakeDb();
  b.PuQuotes.init({ db, uid: 'u1', name: '' });
  const qid = await b.PuQuotes.save({ doc: 'contract', type: 'case', co: '나다', date: '2026-11-02', src: { how: 'mail' }, review: 'check' });
  assert.ok(db.store['pu_quotes/' + qid]);
  assert.ok(!db.store['pu_quote_amt/' + qid]);
});

test('list — 날짜 내림차순, id 포함', async () => {
  const b = load(); const db = fakeDb();
  b.PuQuotes.init({ db, uid: 'u1' });
  db.store['pu_quotes/a'] = { date: '2026-01-01', co: 'A' };
  db.store['pu_quotes/b'] = { date: '2026-03-01', co: 'B' };
  const l = await b.PuQuotes.list();
  assert.deepStrictEqual(l.map((x) => x.id), ['b', 'a']);
});

test('amounts — 전체가 거절되면 하나씩, 거절은 건너뛴다', async () => {
  const b = load();
  const db = fakeDb({ deny: ['pu_quote_amt', 'pu_quote_amt/q2'] });
  db.store['pu_quote_amt/q1'] = { amount: 1, vat: '', owner: 'u1' };
  db.store['pu_quote_amt/q2'] = { amount: 2, vat: '', owner: 'x' };
  b.PuQuotes.init({ db, uid: 'u1' });
  const r = await b.PuQuotes.amounts(['q1', 'q2']);
  assert.deepStrictEqual(out(r), { q1: { amount: 1, vat: '', owner: 'u1' } });
});
test('amounts — 전체를 읽을 수 있으면 요청한 id 만 돌려준다', async () => {
  const b = load(); const db = fakeDb();
  db.store['pu_quote_amt/q1'] = { amount: 1 }; db.store['pu_quote_amt/q9'] = { amount: 9 };
  b.PuQuotes.init({ db, uid: 'u1' });
  const r = await b.PuQuotes.amounts(['q1', 'q2']);
  assert.deepStrictEqual(out(r), { q1: { amount: 1 } });
});
test('amounts — 거절이 아닌 오류는 그대로 던진다', async () => {
  const b = load(); const db = fakeDb();
  db.ref = () => ({ once: () => Promise.reject(new Error('network down')) });
  b.PuQuotes.init({ db, uid: 'u1' });
  await assert.rejects(() => b.PuQuotes.amounts(['q1']), /network down/);
});

test('confirmOwner — 금액 칸이 있으면 owner 칸만 쓰고, 기록에는 uid 대신 이름', async () => {
  const b = load(); const db = fakeDb();
  db.store['pu_quote_amt/q1'] = { amount: 5, vat: '', owner: '', by: 'adm', at: 1 };
  b.PuQuotes.init({ db, uid: 'adm' }); b.PuWorklog.init({ db, uid: 'adm' });
  await b.PuQuotes.confirmOwner('q1', 'u7', '박한별');
  assert.strictEqual(db.store['pu_quote_amt/q1/owner'], 'u7');
  const e = worklog(db).find((x) => x.kind === 'owner_confirm');
  assert.ok(e && e.target === 'q1');
  assert.ok(e.note.includes('박한별') && !e.note.includes('u7'), '작업 기록에 아이디(uid)를 적지 않는다');
});
test('confirmOwners — 금액 칸이 없는 건은 담당만 있는 칸을 만들고, 여러 건을 한 번에 쓴다', async () => {
  const b = load(); const db = fakeDb();
  db.store['pu_quote_amt/q1'] = { amount: 5, vat: '', owner: '', by: 'adm', at: 1 };
  b.PuQuotes.init({ db, uid: 'adm' });
  await b.PuQuotes.confirmOwners(['q1', 'q2'], 'u7', '박한별');
  assert.strictEqual(db.updates.length, 1, '한 번에(원자적으로) 써야 한다');
  assert.strictEqual(db.store['pu_quote_amt/q1/owner'], 'u7');
  const n = db.store['pu_quote_amt/q2'];
  assert.strictEqual(n.owner, 'u7'); assert.strictEqual(n.by, 'adm'); assert.strictEqual(typeof n.at, 'number');
  assert.ok(!('amount' in n), '모르는 금액을 0 으로 채우지 않는다');
});
test('confirmOwners — 번호나 담당이 없으면 거절', async () => {
  const b = load(); b.PuQuotes.init({ db: fakeDb(), uid: 'adm' });
  await assert.rejects(() => b.PuQuotes.confirmOwners([], 'u7'));
  await assert.rejects(() => b.PuQuotes.confirmOwner('q1', ''));
});
test('dateOf — 여러 모양을 YYYY-MM-DD 로, 숫자(ms)는 한국 시간', () => {
  const d = load().PuQuotes.dateOf;
  assert.strictEqual(d('2026-11-07'), '2026-11-07');
  assert.strictEqual(d('2026.3.5'), '2026-03-05');
  assert.strictEqual(d('2026년 3월 5일'), '2026-03-05');
  assert.strictEqual(d(Date.UTC(2026, 9, 31, 16, 0)), '2026-11-01');
  assert.strictEqual(d('어제'), ''); assert.strictEqual(d('2026-13-01'), ''); assert.strictEqual(d(undefined), '');
});
test('save — 날짜를 모르면 아무것도 안 쓰고 거절', async () => {
  const b = load(); const db = fakeDb();
  b.PuQuotes.init({ db, uid: 'u1' });
  await assert.rejects(() => b.PuQuotes.save({ co: 'A', date: '', src: { how: 'mail' } }), /날짜/);
  assert.deepStrictEqual(Object.keys(db.store).filter((k) => k.indexOf('pu_quotes/') === 0), []);
});
test('save — 금액은 모르고 담당만 있으면 담당 칸만(금액 칸 없이) 만든다', async () => {
  const b = load(); const db = fakeDb();
  b.PuQuotes.init({ db, uid: 'u1' });
  const qid = await b.PuQuotes.save({ co: 'A', date: '2026-11-01', src: { how: 'window' } }, { owner: 'u1' });
  const a = db.store['pu_quote_amt/' + qid];
  assert.strictEqual(a.owner, 'u1'); assert.ok(!('amount' in a));
});
test('save — 음수·글자 금액은 거절', async () => {
  const b = load(); b.PuQuotes.init({ db: fakeDb(), uid: 'u1' });
  await assert.rejects(() => b.PuQuotes.save({ co: 'A', date: '2026-11-01' }, { amount: -1 }));
  await assert.rejects(() => b.PuQuotes.save({ co: 'A', date: '2026-11-01' }, { amount: '사백만' }));
});

test('findBySrc — 있으면 id, 없으면 null', async () => {
  const b = load(); const db = fakeDb();
  b.PuQuotes.init({ db, uid: 'u1' });
  db.store['pu_quotes/q5'] = { srcKey: 'mail:abc', date: '2026-01-01' };
  assert.strictEqual(await b.PuQuotes.findBySrc('mail:abc'), 'q5');
  assert.strictEqual(await b.PuQuotes.findBySrc('nope'), null);
  assert.strictEqual(await b.PuQuotes.findBySrc(''), null);
});
