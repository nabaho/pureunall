/* 사건·계약 근로자 주민번호·계좌·예금주 — 담당자 칸으로 떼어 내기 (대표 결정 2026-10-15)
 *
 * ■ 무엇을 지키나
 *   ① 저장할 때 셋이 공개 덩어리에서 «빠지고» 「있다」 표시만 남는다
 *   ② 칸이 «없는» 근로자는 손대지 않는다 — 담당이 아닌 직원이 저장해도 주민번호가 안 지워진다
 *   ③ 빈칸은 «지우기» — 담당자가 지운 것은 담당자 칸에서도 지운다
 *   ④ 새 건은 서버에 먼저 닿아야 규칙이 담당자를 안다 → 거절되면 다시 해 본다
 *   ⑤ 이관할 때 출발 건을 못 읽으면 «조용히» 빠뜨리지 않고 알린다
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const W = require(path.join(__dirname, '..', 'js', 'pu-worker-secret.js'));

const 사건 = () => ({
  id: 'c-1', managerMain: 'P-001',
  workers: [
    { id: 'w1', name: '김예시', rrn: '900101-1000000', phone: '010-0000-1111' },
    { id: 'w2', name: '박샘플', phone: '010-0000-2222' },                  /* 칸 없음 = 모름 */
    { id: 'w3', name: '이보기', rrn: '', account: '', holder: '' }            /* 빈칸 = 지웠다 */
  ]
});

test('★★ ① 저장 모양에서 셋이 빠지고 「있다」 표시만 남는다', () => {
  const s = W.split('cases', 사건());
  assert.equal(s.any, true);
  const ws = s.record.workers;
  assert.ok(ws.every((w) => !('rrn' in w) && !('account' in w) && !('holder' in w)), '★★ 공개 덩어리에 주민번호·계좌가 남았습니다');
  assert.equal(ws[0].hasRrn, true);
  assert.equal(ws[2].hasRrn, false);
  assert.equal(ws[2].hasAccount, false);
  assert.deepEqual(s.secrets.w1, { rrn: '900101-1000000' });
});

test('★★ ② 칸이 없는 근로자는 손대지 않는다 — 표시도, 담당자 칸도', () => {
  const s = W.split('cases', 사건());
  assert.equal('hasRrn' in s.record.workers[1], false, '모르는 사람의 표시를 내렸습니다');
  assert.equal('w2' in s.secrets, false, '★★ 모르는 사람의 담당자 칸을 건드립니다 — 담당이 아닌 직원이 저장하면 지워집니다');
  const paths = W.updatePaths('cases', 'c-1', s.secrets);
  assert.ok(Object.keys(paths).every((p) => p.indexOf('/w2/') < 0));
});

test('★ ③ 빈칸은 «지우기»(null)로 보낸다', () => {
  const s = W.split('cases', 사건());
  const p = W.updatePaths('cases', 'c-1', s.secrets);
  assert.equal(p['worker_secret/cases/c-1/w3/rrn'], null);
  assert.equal(p['worker_secret/cases/c-1/w3/account'], null);
  assert.equal(p['worker_secret/cases/c-1/w1/rrn'], '900101-1000000');
});

test('계약은 company.workers — 다른 칸은 그대로 둔다', () => {
  const ct = { id: 'ct-1', company: { name: '가나상사', workers: [{ id: 'w9', name: '최예시', rrn: '800202-2000000' }] }, managerMain: 'P-002' };
  const s = W.split('contracts', ct);
  assert.equal(s.record.company.name, '가나상사');
  assert.equal('rrn' in s.record.company.workers[0], false);
  assert.deepEqual(s.secrets, { w9: { rrn: '800202-2000000' } });
  assert.equal('rrn' in ct.company.workers[0], true, '원본을 고쳐 버렸습니다 — 부르는 쪽 상태가 망가집니다');
});

test('열쇠 없는 근로자는 열쇠를 지어 준다 — 담당자 칸에 둘 자리가 있어야 한다', () => {
  const s = W.split('cases', { id: 'c-2', workers: [{ name: '무열쇠', rrn: '700303-1000000' }] });
  const wid = s.record.workers[0].id;
  assert.ok(wid && s.secrets[wid] && s.secrets[wid].rrn === '700303-1000000');
});

test('담당자 칸을 쓰지 않는 표·근로자 없는 건은 그대로 돌려준다', () => {
  const r = { id: 'x', workers: [{ id: 'w', rrn: '1' }] };
  assert.equal(W.split('companies', r).record, r);
  assert.equal(W.split('cases', { id: 'c' }).any, false);
});

test('★ dbPatch 모양 — fields 안의 workers 만 뗀다', () => {
  const p = W.splitPatch('cases', { workers: 사건().workers, status: '진행' });
  assert.equal(p.fields.status, '진행');
  assert.ok(p.fields.workers.every((w) => !('rrn' in w)));
  const p2 = W.splitPatch('contracts', { company: { name: 'A', workers: [{ id: 'w', rrn: '1' }] } });
  assert.equal(p2.fields.company.name, 'A');
  assert.equal('rrn' in p2.fields.company.workers[0], false);
  assert.equal(W.splitPatch('cases', { status: 'x' }).any, false);
});

test('붙이기(merge) — 창 상태에만, 원본은 안 바꾼다, 창에서 이미 고친 값은 안 덮는다', () => {
  const rec = W.split('cases', 사건()).record;
  const m = W.merge('cases', rec, { w1: { rrn: '900101-1000000' }, w2: { rrn: '850715-2000000' } });
  assert.equal(m.workers[0].rrn, '900101-1000000');
  assert.equal(m.workers[1].rrn, '850715-2000000');
  assert.equal('rrn' in rec.workers[0], false);
});

test('칸 길이 한도 — 규칙과 같은 자리에서 자른다', () => {
  const p = W.updatePaths('cases', 'c', { w: { rrn: '1'.repeat(50), holder: '가'.repeat(60) } });
  assert.equal(p['worker_secret/cases/c/w/rrn'].length, 20);
  assert.equal(p['worker_secret/cases/c/w/holder'].length, 40);
});

/* ── 서버 흉내 ── */
function fakeDb(opts) {
  const o = Object.assign({ denyTimes: 0, readDenied: false, data: {} }, opts);
  const db = {
    writes: [], tries: 0,
    ref(p) {
      return {
        once: async () => {
          if (o.readDenied) { const e = new Error('permission_denied'); e.code = 'PERMISSION_DENIED'; throw e; }
          const parts = String(p).split('/'); let v = o.data;
          for (const k of parts) v = v == null ? v : v[k];
          return { val: () => (v === undefined ? null : v) };
        },
        update: async (paths) => {
          db.tries++;
          if (db.tries <= o.denyTimes) { const e = new Error('PERMISSION_DENIED: Permission denied'); throw e; }
          db.writes.push(paths);
        }
      };
    }
  };
  return db;
}

test('★ ④ 새 건이 서버에 아직 안 닿아 거절되면 다시 해 본다 — 그래도 안 되면 알린다', async () => {
  const db = fakeDb({ denyTimes: 1 });
  const r = await W.write(db, 'cases', 'c-new', { w1: { rrn: '900101-1000000' } }, { waits: [1, 1] });
  assert.equal(r.ok, true);
  assert.equal(db.tries, 2);
  const db2 = fakeDb({ denyTimes: 9 });
  const r2 = await W.write(db2, 'cases', 'c-new', { w1: { rrn: 'x' } }, { waits: [1, 1] });
  assert.equal(r2.ok, false); assert.equal(r2.denied, true);
  assert.equal(db2.tries, 3, '두 번까지만 다시 해 본다');
});

test('읽기 — 거절은 {denied}, 아니면 값', async () => {
  W._cache['cases/c-9'] && delete W._cache['cases/c-9'];
  const no = await W.read(fakeDb({ readDenied: true }), 'cases', 'c-9');
  assert.deepEqual(no, { ok: false, denied: true });
  const yes = await W.read(fakeDb({ data: { worker_secret: { cases: { 'c-9': { w1: { rrn: '1' } } } } } }), 'cases', 'c-9');
  assert.equal(yes.ok, true); assert.equal(yes.map.w1.rrn, '1');
});

test('★★ ⑤ 이관 — 출발을 못 읽으면 조용히 넘기지 않는다 · 읽으면 고른 사람만 옮긴다', async () => {
  delete W._cache['contracts/ct-a'];
  const no = await W.carry(fakeDb({ readDenied: true }), 'contracts', 'ct-a', 'cases', 'c-a');
  assert.equal(no.ok, false); assert.equal(no.denied, true);
  delete W._cache['contracts/ct-b'];
  const db = fakeDb({ data: { worker_secret: { contracts: { 'ct-b': { w1: { rrn: '1' }, w2: { rrn: '2' } } } } } });
  const r = await W.carry(db, 'contracts', 'ct-b', 'cases', 'c-b', ['w2']);
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(db.writes[0]), ['worker_secret/cases/c-b/w2/rrn']);
});

test('가림 글자 — 앞 7자리만', () => {
  assert.equal(W.maskRrn('900101-1234567'), '900101-1●●●●●●');
  assert.equal(W.maskRrn(''), '');
});
