'use strict';
/* 중복 업체 — 확실한 중복 한꺼번에 합치기 + 지운 명단(되살림 막기)
   (대표 「추천대로」 2026-09-29, 목업 co-bulk-merge)

   ■ 무엇이 있었나 (2026-09-29 실측)
     서버 백업을 날짜별로 세니 9/16~9/21 은 업체 376건이었는데 9/23 에 707건 —
     예전에 정리한 옛 업체 330여 건이 «되살아났다». 그 뒤 190건이 다시 지워졌다 되살렸다.
     대표: 「왜 이렇게 계속 사라졌던게 계속 나타나서 문제가 되는지」.
   ■ 못 박는 것(규칙)
     ① 확실한 쌍 = 두 줄 · 사업자번호(종사업장 포함)·대표자·주소·전화가 «모두 같고 비어 있지 않음»
     ② 남길 쪽: 살아 있는 것 > 연결 많은 것 > 정보 많이 채워진 것 > … > 먼저 등록된 것
     ③ 한꺼번에 합쳐도 한 쌍 합치기와 같은 일 — 빈 칸 채우기 · 연결 옮기기 · 없앤 쪽 빼기
     ④ 한 업체가 두 쌍에 걸리면 한 번만 손댄다
     ⑤ 없앤 업체는 지운 명단에 오른다 — 저장·받기·못 보낸 변경 어디로도 되살아나지 않는다
     ⑥ 되돌리기는 명단에서 먼저 빼고 다 되살린다(연결도 원래대로)
     ⑦ 사무대행과 섞인 쌍은 안 합친다(대표 결정 2026-08-31) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

const FNS = ['coFieldLabel', 'coIsAuto', 'coHead', 'coGroupScore', 'coSubNo', 'coDupGroups', 'coIsSub', 'coSubRoleFill',
  'coWageMoves', 'coWageApply', 'coMergePreview', 'coMergeApply', '_coLogPush', 'coMergeUndo', '_coUndoOne',
  'coTombMap', 'coIsTomb', 'coTombAdd', 'coTombDel', '_coTombStrip', 'coSureSame', 'coRefCounts', 'coFilledCount',
  'coBulkKeepCmp', 'coBulkWhy', 'coBulkCandidates', 'coMergeApplyMany'];

function 세상(seed) {
  const store = JSON.parse(JSON.stringify(seed));
  const ctx = {
    console: { warn() {}, log() {} }, JSON, Object, Array, String, Number, Date, Math,
    window: {}, CURRENT_USER: { sid: 'P-001', name: '홍길동' }, 알림: [],
    CompanyRef: {
      _norm: (s) => String(s || '').replace(/[\s()㈜（）]|\(주\)|주식회사/g, '').toLowerCase(),
      _normBiz: (s) => { const d = String(s || '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(0, 10) : ''; },
    },
    coRefStores: () => ['contracts'],
  };
  ctx.showToast = (m) => ctx.알림.push(m);
  ctx.dbGet = (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d);
  ctx.dbSet = (k, v) => { if (k === 'companies' && ctx._coTombStrip) v = ctx._coTombStrip(k, v); store[k] = JSON.parse(JSON.stringify(v)); return true; };
  ctx.dbPatch = (k, id, f) => {
    if (k === 'companies' && ctx.coIsTomb(id)) return false;
    const a = store[k] || []; const i = a.findIndex((x) => x && x.id === id); if (i < 0) return false;
    a[i] = Object.assign({}, a[i], f); return true;
  };
  ctx.dbRemove = (k, id) => { store[k] = (store[k] || []).filter((x) => !(x && x.id === id)); return true; };
  ctx.dbUpsert = (k, item) => {
    if (k === 'companies' && ctx.coIsTomb(item.id)) return false;
    const a = store[k] || (store[k] = []); const i = a.findIndex((x) => x && x.id === item.id);
    if (i >= 0) a[i] = item; else a.push(item); return true;
  };
  vm.createContext(ctx);
  vm.runInContext(['var CO_MERGE_SKIP = "co_merge_skip";', 'var CO_MERGE_LOG = "co_merge_log";', 'var CO_TOMB = "co_tombstones";',
    (src.match(/var CO_FIELD_LABEL = \{[\s\S]*?\n\};/) || [''])[0]].concat(FNS.map((n) => {
    const f = cutFn(src, 'function ' + n + '(');
    assert.ok(f, n + ' 를 못 찾았습니다');
    return f;
  })).join('\n'), ctx);
  return { ctx, store };
}
const CO = (o) => Object.assign({ status: 'active', typeCode: '자문', ceo: '홍길동', address: '충남 천안시 가나로 1',
  phone: '041-000-0000', bizNo: '123-81-00001', createdAt: '2024-01-01' }, o);

test('① ★★ 확실한 쌍만 — 넷 중 하나라도 다르거나 비면 한꺼번에 합치기에 안 들어간다', () => {
  const { ctx } = 세상({ companies: [] });
  const a = CO({ id: 'a', name: '가나상사' }), b = CO({ id: 'b', name: '(주)가나상사' });
  assert.equal(ctx.coSureSame([a, b]), true);
  assert.equal(ctx.coSureSame([a, CO({ id: 'b', phone: '041-111-1111' })]), false, '전화가 다른데 확실하다고 봤습니다');
  assert.equal(ctx.coSureSame([a, CO({ id: 'b', ceo: '임꺽정' })]), false, '대표자가 다른데 확실하다고 봤습니다');
  assert.equal(ctx.coSureSame([a, CO({ id: 'b', address: '서울 가나구 1' })]), false);
  assert.equal(ctx.coSureSame([CO({ id: 'a', phone: '' }), CO({ id: 'b', phone: '' })]), false, '★ 둘 다 비었는데 «같다» 로 봤습니다');
  assert.equal(ctx.coSureSame([a, CO({ id: 'b', bizNo: '123-81-00001-6' })]), false, '다른 사업장(-6)을 같다고 봤습니다');
  assert.equal(ctx.coSureSame([a, b, CO({ id: 'c' })]), false, '세 줄 묶음은 한 쌍씩 보아야 합니다');
});

test('② ★★ 남길 쪽 — 살아 있는 것 > 연결 많은 것 > 정보 많이 채워진 것', () => {
  const { ctx } = 세상({ companies: [], contracts: [{ id: 'k1', companyId: 'b' }] });
  const ref = ctx.coRefCounts();
  const cmp = ctx.coBulkKeepCmp(ref);
  const pick = (x, y) => [x, y].sort(cmp)[0].id;
  assert.equal(pick(CO({ id: 'a', status: 'closed' }), CO({ id: 'b2' })), 'b2', '★★ 닫힌 업체로 합쳐 살아 있는 사업장이 사라집니다');
  assert.equal(pick(CO({ id: 'a' }), CO({ id: 'b' })), 'b', '★ 계약이 걸린 쪽을 없애려 합니다');
  assert.equal(pick(CO({ id: 'a', fax: '041-9' , email: 'x@가나.kr' }), CO({ id: 'c' })), 'a', '정보가 더 많은 쪽을 안 남깁니다');
  assert.equal(pick(CO({ id: 'a', createdAt: '2025-01-01' }), CO({ id: 'c', createdAt: '2019-01-01' })), 'c', '먼저 등록된 쪽을 안 남깁니다');
});

function 쌍세상() {
  return 세상({
    companies: [
      CO({ id: 'real-1', name: '가나상사', fax: '041-9' }),
      CO({ id: 'co-c1', name: '(주)가나상사', email: 'ga@가나.kr' }),
      CO({ id: 'real-2', name: '홍길동상사', bizNo: '123-81-00002', ceo: '임꺽정', phone: '041-222-2222', address: '충남 서산시 나로 2' }),
      CO({ id: 'co-p2', name: '홍길동상사', bizNo: '123-81-00002', ceo: '임꺽정', phone: '041-222-2222', address: '충남 서산시 나로 2', fax: '041-7', email: 'h@h.kr' }),
      CO({ id: 'solo', name: '다른회사', bizNo: '999-81-00009', ceo: '홍길동', phone: '041-999-9999' }),
    ],
    contracts: [{ id: 'k1', companyId: 'co-c1' }],
  });
}

test('③ ★★ 한꺼번에 합치면 — 빈 칸을 채우고, 연결을 옮기고, 없앤 쪽만 빠진다', () => {
  const { ctx, store } = 쌍세상();
  const cands = ctx.coBulkCandidates();
  assert.equal(cands.length, 2);
  const res = ctx.coMergeApplyMany(cands.map((p) => ({ keepId: p.keep.id, dropId: p.drop.id })));
  assert.ok(res && res.batch.length === 2, '합치기가 실패했습니다: ' + ctx.알림.join(' / '));
  const ids = store.companies.map((c) => c.id).sort();
  assert.equal(ids.length, 3, '없앤 쪽 둘만 빠져야 합니다: ' + ids.join(','));
  assert.ok(ids.includes('solo'), '짝 없는 업체가 사라졌습니다');
  // 연결이 걸린 co-c1 이 남는다(연결 많은 쪽) — 그러니 계약은 그대로 co-c1
  assert.equal(store.contracts[0].companyId, ids.includes('co-c1') ? 'co-c1' : ids.find((i) => i.startsWith('real-1')));
  const 남은가나 = store.companies.find((c) => /가나상사/.test(c.name));
  assert.ok(남은가나.fax && 남은가나.email, '★ 빈 칸을 상대 값으로 안 채웠습니다');
});

test('④ ★ 한 업체가 두 쌍(이름·번호)에 걸려도 한 번만 손댄다', () => {
  /* 지금 자료로는 잘 안 생기지만(이름 묶음·번호 묶음이 같은 둘이면 한 번만 잡힌다) 묶는 규칙이 바뀌면
     생길 수 있다 — 묶음을 직접 넣어 본다: x1 이 두 쌍에 걸려 있다. */
  const x1 = CO({ id: 'x1', name: '가나상사' }), x2 = CO({ id: 'x2', name: '가나상사' }), x3 = CO({ id: 'x3', name: '가나상사' });
  const { ctx } = 세상({ companies: [x1, x2, x3] });
  const cands = ctx.coBulkCandidates([{ key: 'g1', list: [x1, x2], conflict: false }, { key: 'g2', list: [x1, x3], conflict: false }]);
  assert.equal(cands.length, 1, '★ 두 쌍에 걸린 업체를 두 번 합치려 합니다');
  const 손댄 = [];
  cands.forEach((p) => { 손댄.push(p.keep.id, p.drop.id); });
  assert.equal(new Set(손댄).size, 손댄.length, '★ 같은 업체를 두 쌍에서 손댑니다: ' + 손댄.join(','));
});

test('⑤ ★★ 없앤 업체는 지운 명단에 오르고, 다시 올리려 해도 안 들어간다', () => {
  const { ctx, store } = 쌍세상();
  const cands = ctx.coBulkCandidates();
  const res = ctx.coMergeApplyMany(cands.map((p) => ({ keepId: p.keep.id, dropId: p.drop.id })));
  const 없앤 = res.batch.map((it) => it.dropRecords[0].id);
  없앤.forEach((id) => assert.ok(store.co_tombstones[id], '★★ ' + id + ' 가 지운 명단에 없습니다 — 옛 사본 기기가 다시 올리면 되살아납니다'));
  // 옛 사본을 가진 기기처럼 통째로 다시 저장해 본다
  const 옛목록 = store.companies.concat(res.batch.map((it) => it.dropRecords[0]));
  ctx.dbSet('companies', 옛목록);
  assert.equal(store.companies.filter((c) => 없앤.includes(c.id)).length, 0, '★★ 통째 저장으로 되살아났습니다');
  assert.equal(ctx.dbUpsert('companies', res.batch[0].dropRecords[0]), false, '★ 한 건 저장으로 되살아났습니다');
});

test('⑥ ★★ 한꺼번에 합친 것은 한 번에 되돌린다 — 명단에서 빼고, 업체·연결 모두 원래대로', () => {
  const { ctx, store } = 쌍세상();
  const before = JSON.parse(JSON.stringify(store.companies)).map((c) => c.id).sort();
  const cands = ctx.coBulkCandidates();
  const res = ctx.coMergeApplyMany(cands.map((p) => ({ keepId: p.keep.id, dropId: p.drop.id })));
  assert.equal(ctx.coMergeUndo(res.id), true);
  assert.deepEqual(store.companies.map((c) => c.id).sort(), before, '★★ 되돌렸는데 업체가 다 안 돌아왔습니다');
  assert.equal(Object.keys(store.co_tombstones || {}).length, 0, '★ 되돌렸는데 지운 명단에 남아 다음 저장에서 또 사라집니다');
  assert.equal(store.contracts[0].companyId, 'co-c1', '연결이 원래대로 안 돌아왔습니다');
  assert.equal((store.co_merge_log || []).length, 0, '되돌린 기록이 남아 있습니다');
});

test('⑥ 한 쌍 합치기(기존 단추)도 지운 명단에 올리고, 되돌리면 뺀다', () => {
  const { ctx, store } = 쌍세상();
  const u = ctx.coMergeApply('real-1', ['co-c1']);
  assert.ok(store.co_tombstones['co-c1'], '★ 한 쌍 합치기로 없앤 업체가 명단에 없습니다 — 그것도 되살아납니다');
  ctx.coMergeUndo(u.id);
  assert.ok(!store.co_tombstones['co-c1']);
  assert.ok(store.companies.some((c) => c.id === 'co-c1'), '되돌렸는데 업체가 안 돌아왔습니다');
});

test('⑦ ★ 사무대행과 섞인 쌍은 한꺼번에 합치기에도 안 들어간다', () => {
  const { ctx } = 세상({ companies: [CO({ id: 's1', name: '가나상사', status: 'suboffice' }), CO({ id: 'g1', name: '가나상사' })] });
  assert.equal(ctx.coBulkCandidates().length, 0, '★ 사무대행과 업체관리를 합치려 합니다(대표 결정 2026-08-31)');
});

test('⑤ ★★ 받을 때·못 보낸 변경을 다시 보낼 때도 지운 명단 업체는 걸러진다', () => {
  const bare = stripJs(src);
  const one = cutFn(bare, 'function _fbApplyOne(');
  assert.match(one, /k === 'companies' && typeof coIsTomb === 'function' && coIsTomb\(id\)/, '★★ 서버에서 받은 되살아난 업체를 이 기기에 들입니다');
  const many = cutFn(bare, 'function _fbApplyMany(');
  assert.match(many, /coTombMap\(\)/, '★★ 한꺼번에 받을 때 걸러지지 않습니다');
  const ops = cutFn(bare, 'function _fbOpsUpdates(');
  assert.match(ops, /_tomb\s*&&\s*_tomb\[String\(id\)\]\) return;/, '★★ 못 보낸 변경을 다시 보낼 때 되살립니다(9/23 핑퐁의 길)');
  for (const [fn, pat] of [['dbSet(k, v){', /_coTombStrip\(k, v\)/], ['dbUpsert(k, item){', /coIsTomb\(item\.id\)/],
    ['dbPatch(k, id, fields){', /coIsTomb\(id\)/], ['dbUpsertMany(k, items){', /_coTombStrip\(k, items\)/]]) {
    const i = bare.indexOf('function ' + fn);
    assert.ok(i > 0, fn + ' 를 못 찾았습니다');
    assert.match(bare.slice(i, i + 2500), pat, '★★ ' + fn + ' 가 지운 명단을 안 봅니다');
  }
  // 지운 명단은 서버에 올라가야 다른 기기도 본다
  const ex = (bare.match(/var FB_EXCLUDE = \[([^\]]*)\]/) || [])[1] || '';
  assert.ok(!/co_tomb/.test(ex), '★★ 지운 명단이 이 PC 에만 남습니다 — 다른 기기는 모릅니다');
});
