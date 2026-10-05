'use strict';
/* 어느 PC·어느 브라우저에서 열어도 «같은 자료»다 (대표 지시 2026-10-05)

   「다른모든 프로그램에서도 데이터가 분리되지 않게 처리해라」
   — 크롬과 엣지, 사무실 PC 와 집 PC 가 서로 다른 것을 보면 안 된다.

   ── 무엇이 갈라져 있었나 (이알피 감사 2026-10-05) ──
   ① 그림 — 레코드의 base64 그림을 이 PC 의 IndexedDB 로 옮기고 'idb:img_…' 참조만 서버로 보냈다.
      다른 PC 는 참조만 받고 그림이 없어 빈칸을 그렸다.
   ② 사건 업무 메모 — localStorage 에 «바로» 써서 서버로 안 갔다.
   ③ 홈택스 세금계산서 아카이브 — IndexedDB 에만 있었다(입금 매칭 색인이 이것을 쓴다).
   ④ 못 보낸 변경 — 메모리에만 적혀, 탭을 닫으면 사라졌다.

   ── 여기서 못 박는 것 (값이 아니라 «규칙») ──
   ⓐ 창고에 못 올린 그림은 참조로 바꾸지 않는다 — 비상 정리(저장 실패) 한 곳만 예외
   ⓑ 이 PC 에 그림이 없으면 창고에서 찾는다 — 올리는 자리와 찾는 자리가 같은 함수다
   ⓒ 업무 메모는 동기화 표(dbSet)로만 저장한다 — 옛 메모는 «덮지 않고» 합친다
   ⓓ 홈택스 줄은 담은 뒤 서버에 올리고, 읽기 전에 받는다 — data 밑이 아니다
   ⓔ 못 보낸 변경은 디스크에 적히고, 서버 값을 받기 «전»에 되읽힌다

   실행: node --test tests/data-same-every-device.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const SRC = read('pu-erp.html');
const fn = (decl) => cutFn(SRC, decl);
const RULES_RTDB = read('scripts/make-firebase-rules.js');
const RULES_ST = read('docs/firebase-storage-전체(붙여넣기용).txt');
const ST_DEPLOY = read('scripts/storage-rules-deploy.js');

/* 이름 붙은 목록(var X = [ … ];)을 뽑아 배열로 */
function list(name) {
  const m = SRC.match(new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\];'));
  assert.ok(m, name + ' 목록을 찾지 못했습니다');
  return (m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
}

/* 기다리기 */
const tick = () => new Promise((r) => setTimeout(r, 0));
/* 상자 안의 console 은 조용히 — 검사 실행기는 표준 출력을 보고 통로로 쓴다(뒤늦은 출력이 통로를 깬다) */
const quiet = { log() {}, warn() {}, info() {}, error() {} };
async function settle() { for (let i = 0; i < 20; i++) await tick(); }

/* ══════ ⓐ ⓑ 그림 ══════ */
function imgBox(opts) {
  const idb = Object.assign({}, opts.idb || {});
  const calls = { put: 0, del: [], uploaded: [], fetched: 0 };
  const ctx = {
    Promise, Date, Math, String, Object, Error, JSON, console: quiet,
    localStorage: { removeItem() {}, setItem() {}, getItem() { return null; } },
    idbBulkPut(store, recs) { recs.forEach((r) => { idb[r.id] = Object.assign({}, r); }); calls.put++; return Promise.resolve(recs.length); },
    idbDelete(store, id) { calls.del.push(id); delete idb[id]; return Promise.resolve(); },
    idbGet(store, id) { return Promise.resolve(idb[id] ? Object.assign({}, idb[id]) : null); },
    erpImgStorage() {
      if (opts.storageDown) return Promise.reject(new Error('창고 막힘'));
      return Promise.resolve({ ref(p) { return {
        putString() { calls.uploaded.push(p); return Promise.resolve(); },
        getMetadata() { return Promise.reject(new Error('없음')); },
        getDownloadURL() { return opts.cloudHas && opts.cloudHas(p) ? Promise.resolve('https://x/' + p) : Promise.reject(new Error('없음')); }
      }; } });
    },
    fetchT() { calls.fetched++; return Promise.resolve({ ok: true, blob() { return Promise.resolve('BLOB'); } }); },
    _imgBlobToDataUrl() { return Promise.resolve('data:image/jpeg;base64,FROMCLOUD'); },
    _imgCloudDownUntil: 0, _imgUploading: {},
    ERP_IMG_CLEAN_FLAG: 'flag', ERP_IMG_DIR: 'erp_img'
  };
  vm.createContext(ctx);
  vm.runInContext(fn('function erpImgCloudPath(') + '\n' + fn('var ImgStore =') + '\nthis.ImgStore = ImgStore;', ctx);
  return { ctx, idb, calls };
}
const BIG = 'data:image/jpeg;base64,' + 'A'.repeat(3000);

test('ⓐ★★ 창고에 못 올리면 «참조로 바꾸지 않는다» — 이 PC 에만 있는 그림을 만들지 않는다', async () => {
  const { ctx, idb, calls } = imgBox({ storageDown: true });
  const ref = await ctx.ImgStore.save(BIG, { ownerType: 'companies', ownerId: 'co-1' }, { requireCloud: true });
  assert.equal(ref, '', '★★ 창고에 못 올렸는데 참조를 돌려줬습니다 — 다른 PC 에서는 빈칸이 됩니다');
  assert.equal(Object.keys(idb).length, 0, '★ 못 쓴 참조의 그림이 이 PC 에 남았습니다');
  assert.equal(calls.del.length, 1);
});

test('ⓐ★ 창고에 올렸으면 참조를 주고, 그 그림이 «올라갔다»고 적힌다', async () => {
  const { ctx, idb, calls } = imgBox({});
  const ref = await ctx.ImgStore.save(BIG, {}, { requireCloud: true });
  assert.match(ref, /^idb:img_/);
  const id = ref.slice(4);
  assert.deepEqual(calls.uploaded, ['erp_img/' + id], '★ 올린 자리가 그림 id 로 계산되지 않았습니다 — 다른 PC 가 못 찾습니다');
  assert.equal(idb[id].cloud, true, '★ 올렸다는 표시가 없으면 접속할 때마다 다시 올립니다');
});

test('ⓐ★★ «창고 먼저»를 끄는 곳은 저장 실패 비상 정리 «한 곳»뿐이다', () => {
  const offs = SRC.split('\n').filter((l) => /requireCloud\s*:\s*false/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.equal(offs.length, 1, '★★ 창고를 건너뛰는 정리가 늘었습니다:\n' + offs.join('\n'));
  assert.match(fn('function dbSet('), /erpMigrateImagesToIdb\(\{ requireCloud:false \}\)/,
    '★ 예외는 dbSet 의 저장공간 초과(QuotaExceeded) 자리여야 합니다');
  assert.match(fn('async function erpMigrateImagesToIdb('), /requireCloud:true/, '★ 정리 단추·접속 정리의 기본이 «창고 먼저»가 아닙니다');
  assert.match(fn('async function _slimKeyImages('), /requireCloud:true/, '★★ 저장 직후 자동 정리가 창고를 안 기다립니다');
  assert.match(fn('async function _imgMigrateObj('), /ImgStore\.save\([^)]*,\s*opts\)/, '★ 정리가 옵션을 ImgStore.save 에 넘기지 않습니다');
});

test('ⓐ★ 비상 정리로 만든 참조는 뒤에서 다시 올린다 — 그림을 가진 PC 가 접속할 때', async () => {
  const sweep = fn('function erpImgCloudSweep(');
  assert.match(sweep, /ImgStore\.upload\(/, '★ 옛 참조를 창고로 올리는 일꾼이 올리지 않습니다');
  assert.match(sweep, /IMG_MIGRATE_STORES/, '★ 레코드가 가리키는 그림만 골라야 합니다');
  assert.match(SRC, /addEventListener\('fb_initial_done', function\(\)\{ setTimeout\(function\(\)\{ erpImgCloudSweep\(\)/,
    '★★ 접속할 때 옛 참조를 올리지 않습니다 — 그림을 가진 PC 만 올릴 수 있습니다');
  /* 보이는 순간에도 올린다 */
  const { ctx, calls } = imgBox({ idb: { img_old_1: { id: 'img_old_1', data: BIG } } });
  const d = await ctx.ImgStore.load('idb:img_old_1');
  assert.equal(d, BIG);
  await settle();
  assert.deepEqual(calls.uploaded, ['erp_img/img_old_1'], '★ 이 PC 에만 있는 옛 그림을 보면서도 창고에 안 올립니다');
});

test('ⓑ★★ 이 PC 에 그림이 없으면 창고에서 찾는다 — 다른 PC 가 넣은 그림이 보인다', async () => {
  const { ctx, idb } = imgBox({ cloudHas: (p) => p === 'erp_img/img_from_other' });
  const d = await ctx.ImgStore.load('idb:img_from_other');
  assert.equal(d, 'data:image/jpeg;base64,FROMCLOUD', '★★ 다른 PC 에서 넣은 그림이 빈칸입니다');
  assert.equal(idb.img_from_other.cloud, true, '★ 받은 그림을 이 PC 에 두지 않으면 볼 때마다 받습니다');
  const none = await ctx.ImgStore.load('idb:img_nowhere');
  assert.equal(none, null, '어디에도 없으면 null');
});

test('ⓑ★ 그림 그리는 부품(AsyncImg)이 ImgStore.load 를 거친다 — 창고 찾기를 건너뛰지 않는다', () => {
  assert.match(fn('function AsyncImg('), /ImgStore\.load\(src\)/);
  const store = fn('var ImgStore =');
  assert.ok((store.match(/erpImgCloudPath\(/g) || []).length >= 2, '★ 올리는 자리와 찾는 자리가 같은 함수로 계산돼야 합니다');
});

test('ⓑ★★ 창고 규칙이 그 자리를 «직원 읽기 · 새로 쓰기만»으로 덮고, 배포 검사가 그 자리를 안다', () => {
  const dir = SRC.match(/var ERP_IMG_DIR = '([^']+)'/);
  assert.ok(dir, 'ERP_IMG_DIR 를 찾지 못했습니다');
  const m = RULES_ST.match(new RegExp('match /' + dir[1] + '/\\{\\w+\\} \\{([\\s\\S]*?)\\n    \\}'));
  assert.ok(m, '★★ 창고 규칙에 ' + dir[1] + ' 칸이 없습니다 — 그림이 올라가지 않고 레코드에 그대로 남습니다');
  assert.match(m[1], /allow read:\s+if isStaff\(\)/);
  assert.match(m[1], /allow create:\s+if isStaff\(\) && okImage\(\)/);
  assert.match(m[1], /allow update, delete: if false/, '★ 지울 수 있으면 휴지통에서 되살린 레코드의 그림이 사라집니다');
  assert.ok(ST_DEPLOY.indexOf("'" + dir[1] + '/') >= 0, '★ 배포 검사(쓰는자리)에 이 자리가 없어 규칙이 빠져도 모릅니다');
  const bucket = SRC.match(/var ERP_IMG_BUCKET = 'gs:\/\/([^']+)'/);
  assert.ok(bucket && ST_DEPLOY.indexOf("name: '" + bucket[1] + "'") >= 0, '★ 그림 창고가 규칙을 올리는 창고 목록에 없습니다');
});

/* ══════ ⓒ 업무 메모 ══════ */
test('ⓒ★★ 업무 메모는 동기화 표로만 저장한다 — localStorage 에 바로 쓰지 않는다', () => {
  const panel = fn('function CaseMemoPanel(');
  assert.doesNotMatch(panel, /localStorage\.(setItem|getItem)/, '★★ 메모를 이 PC 에만 씁니다 — 다른 PC 에서 0건이 됩니다');
  assert.match(panel, /dbSet\(CASE_MEMO_KEY,/, '★ 메모가 dbSet(동기화) 길을 안 탑니다');
  const key = SRC.match(/var CASE_MEMO_KEY = '([^']+)'/)[1];
  assert.ok(list('DIFF_KEYS').includes(key), '★ 건별 저장 표가 아니면 두 사람이 동시에 단 메모가 서로를 지웁니다');
  assert.ok(list('FB_ALL_SYNC_KEYS').includes(key), '★★ 굳은 명단에 없으면 재무 권한 없는 직원 PC 가 부팅 때 메모를 안 받습니다');
  assert.match(RULES_RTDB, new RegExp('\\n  ' + key + ':\\s+\\{'), '★ 실시간DB 규칙에 이름이 없습니다');
  assert.ok(fbShouldSyncSays(key), '★ 동기화 제외 목록에 걸려 서버로 안 갑니다');
});
function fbShouldSyncSays(k) {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext('var FB_EXCLUDE = ' + JSON.stringify(list('FB_EXCLUDE')) + ';\n' + fn('function fbShouldSync(') + '\nthis.f = fbShouldSync;', ctx);
  return ctx.f(k);
}

function memoBox(state) {
  const ls = Object.assign({}, state.ls);
  const db = { case_memos: state.cloud ? state.cloud.slice() : [] };
  const calls = { dbSet: 0 };
  let n = 0;
  const ctx = {
    JSON, Object, Array, String, Date, console: quiet, window: {},
    KEY: 'pureun_v6_', _fbSynced: state.synced !== false,
    localStorage: {
      get length() { return Object.keys(ls).length; },
      key(i) { return Object.keys(ls)[i]; },
      getItem(k) { return k in ls ? ls[k] : null; },
      removeItem(k) { delete ls[k]; }
    },
    safeParse(raw, d) { try { return raw == null ? d : JSON.parse(raw); } catch (_) { return d; } },
    uid(p) { return p + '-new' + (n++); },
    dbGet(k, d) { return k in db ? db[k] : d; },
    dbSet(k, v) { calls.dbSet++; if (state.saveFails) return false; db[k] = v; return true; }
  };
  vm.createContext(ctx);
  vm.runInContext("var CASE_MEMO_KEY = 'case_memos';\nvar CASE_MEMO_OLD_PREFIX = KEY + 'case_memos_';\n" + fn('function erpCaseMemoMigrate(') + '\nthis.f = erpCaseMemoMigrate;', ctx);
  return { ctx, ls, db, calls };
}

test('ⓒ★★ 옛 메모는 «합친다» — 표에 이미 있는 것(다른 PC 가 먼저 옮겼거나 고친 것)을 덮지 않는다', () => {
  const cloudMemo = { id: 'memo-a', caseId: 'case-1', text: '고친 글 (최신)', at: '2026-10-05T01:00:00Z' };
  const { ctx, ls, db } = memoBox({
    cloud: [cloudMemo],
    ls: {
      'pureun_v6_case_memos_case-1': JSON.stringify([
        { id: 'memo-a', text: '옛 글', at: '2026-09-01T00:00:00Z' },
        { id: 'memo-b', text: '이 PC 에만 있던 메모', author: '홍길동', at: '2026-09-02T00:00:00Z' }
      ]),
      'pureun_v6_case_memos_case-2': JSON.stringify([{ id: 'memo-a', text: '다른 사건의 같은 번호', at: '2026-09-03T00:00:00Z' }]),
      'pureun_v6_companies': '[]'
    }
  });
  const added = ctx.f();
  assert.equal(added, 2);
  const byText = Object.fromEntries(db.case_memos.map((m) => [m.text, m]));
  assert.equal(byText['고친 글 (최신)'].id, 'memo-a', '★★ 표의 최신 메모가 옛 PC 사본에 덮였습니다');
  assert.ok(!byText['옛 글'], '★★ 같은 메모를 두 번 담았습니다');
  assert.equal(byText['이 PC 에만 있던 메모'].caseId, 'case-1', '★ 옮긴 메모가 어느 사건 것인지 잃었습니다');
  assert.equal(byText['다른 사건의 같은 번호'].caseId, 'case-2');
  assert.notEqual(byText['다른 사건의 같은 번호'].id, 'memo-a', '★ 다른 사건의 같은 번호가 메모를 덮었습니다');
  assert.ok(!('pureun_v6_case_memos_case-1' in ls) && !('pureun_v6_case_memos_case-2' in ls), '옮긴 옛 열쇠는 지운다');
  assert.ok('pureun_v6_companies' in ls, '★★ 다른 표 열쇠를 지웠습니다');
  assert.equal(ctx.f(), 0, '두 번째에는 할 일이 없다');
});

test('ⓒ★ 저장이 안 되면 옛 메모를 지우지 않는다 · 서버 값을 받기 전에는 옮기지 않는다', () => {
  const old = { 'pureun_v6_case_memos_case-1': JSON.stringify([{ id: 'memo-x', text: '남겨야 할 메모' }]) };
  const a = memoBox({ ls: old, saveFails: true });
  assert.equal(a.ctx.f(), 0);
  assert.ok('pureun_v6_case_memos_case-1' in a.ls, '★★ 담지 못했는데 옛 메모를 지웠습니다 — 메모가 사라집니다');
  const b = memoBox({ ls: old, synced: false });
  assert.equal(b.ctx.f(), 0);
  assert.equal(b.calls.dbSet, 0, '★ 서버 값을 받기 전에 옮기면 표의 최신 메모와 견줄 수가 없습니다');
});

/* ══════ ⓓ 홈택스 아카이브 ══════ */
test('ⓓ★★ 홈택스 줄은 담은 뒤 서버에 올린다 · 읽는 곳은 먼저 받는다', () => {
  const up = fn('async function handleInvoiceUpload(');
  const iPut = up.lastIndexOf("idbBulkPut('invoice_history'");
  const iPush = up.indexOf('erpInvArcPush()');
  assert.ok(iPut > 0 && iPush > iPut, '★★ 홈택스에서 올린 줄이 이 PC 에만 남습니다');
  assert.ok(up.indexOf('erpInvArcPull()') > 0 && up.indexOf('erpInvArcPull()') < up.indexOf("idbGetByIndex('invoice_history'"),
    '★ 다른 PC 가 먼저 올린 줄과 견주지 않으면 같은 줄을 두 번 담습니다');
  assert.match(fn('function _erpInvArchLoad('), /erpInvArcPull\(\)[\s\S]*?idbGetAll\('invoice_history'\)/,
    '★★ 입금 매칭 색인이 다른 PC 의 홈택스분을 모릅니다 — PC 마다 맞춤이 달라집니다');
  /* 화면 둘(아카이브·발행관리)도 받은 뒤 읽는다 */
  const reads = SRC.match(/erpInvArcPull\(\)\.catch\(function\(\)\{ return 0; \}\)\.then\(function\(\)\{\s*return idb(GetAll|GetRange)\('invoice_/g) || [];
  assert.ok(reads.length >= 2, '★ 아카이브·발행관리 화면이 받기 전에 이 PC 사본만 읽습니다');
  assert.match(fn('async function clearInvoiceArchive('), /erpInvArcClearAll\(\)/, '★ 이 PC 만 지우면 다음 받기 때 도로 내려옵니다');
});

test('ⓓ★★ 홈택스 아카이브는 data 밑이 아니고 재무 권한자만 — 부팅마다 수만 건을 안 받는다', () => {
  const root = SRC.match(/var INV_ARC_ROOT = '([^']+)'/)[1];
  assert.ok(!/^data\//.test(root), '★★ data 밑이면 부팅 계획이 표로 보고 통째로 받습니다');
  const m = RULES_RTDB.match(new RegExp('rules\\.' + root + ' = \\{([\\s\\S]*?)\\n\\};'));
  assert.ok(m, '★ 실시간DB 규칙에 ' + root + ' 이 없습니다 — 올리기가 막힙니다(뿌리는 기본이 닫힘)');
  assert.match(m[1], /'\.read': `\(\$\{LOGIN\}\) && \$\{FIN\}`/, '★★ 매출 자료를 재무 권한 없는 사람이 읽습니다');
  assert.match(m[1], /'\.write': `\(\$\{LOGIN\}\) && \$\{FIN\}`/);
  assert.match(m[1], /h: \{ '\.indexOn': \['t'\] \}/, '★ t 색인이 없으면 «지난번 이후 줄만» 받기가 통째 받기로 떨어집니다');
  assert.match(fn('function _invArcCan('), /_erpCanFin\(\)/, '★ 권한 없는 PC 가 헛되이 두드립니다');
});

test('ⓓ★ 줄 열쇠는 실시간DB 에 쓸 수 있고, 같은 줄이면 PC 가 달라도 같은 열쇠다', () => {
  const ctx = { String, Math }; vm.createContext(ctx);
  vm.runInContext(fn('function _invArcKey(') + '\nthis.f = _invArcKey;', ctx);
  const id = '(주)가나.다라/마바$사|2026-09-01|1,000,000|자문료 [9월] #1#1';
  assert.equal(ctx.f(id), ctx.f(id), '★★ 같은 줄인데 열쇠가 달라 PC 마다 두 줄로 쌓입니다');
  assert.doesNotMatch(ctx.f(id), /[.#$\[\]\/]/, '★★ 실시간DB 금지문자가 열쇠에 들어갔습니다');
  assert.ok(ctx.f('가'.repeat(2000)).length < 100, '★ 열쇠가 길면(768바이트↑) 쓰기가 거절됩니다');
  const seen = new Set();
  for (let i = 0; i < 20000; i++) seen.add(ctx.f('업체' + (i % 300) + '|2026-' + (i % 12) + '|' + i * 1100 + '|#1'));
  assert.equal(seen.size, 20000, '★ 다른 줄이 같은 열쇠로 겹쳐 서로를 덮습니다');
});

test('ⓓ★ 업체별 집계는 올리지 않고 «줄로부터 다시 센다» — 두 PC 가 따로 더하면 부푼다', () => {
  const pull = fn('function erpInvArcPull(');
  assert.match(pull, /_invArcRebuildCompanies\(\)/);
  assert.doesNotMatch(fn('function erpInvArcPush('), /invoice_companies/, '★ 집계를 올리면 두 PC 의 합이 겹쳐 셉니다');
});

/* ══════ ⓔ 못 보낸 변경 ══════ */
function pendBox(store, who) {
  const ctx = {
    JSON, Object, Array, String, Date, console: quiet,
    window: {},
    DIFF_KEYS: ['cases', 'case_memos'],
    FB_PEND_LS: 'pu_erp_fb_pending_v1',
    getSessionSid() { return who || 'S001'; },
    localStorage: {
      getItem(k) { return k in store ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; }
    },
    safeParse(raw, d) { try { return raw == null ? d : JSON.parse(raw); } catch (_) { return d; } },
    fbShouldSync() { return true; },
    erpObjIsMap(x) { return !!(x && typeof x === 'object' && !Array.isArray(x)); },
    _fbMapOpsAdd(ops) { return ops; }
  };
  vm.createContext(ctx);
  ['function _fbOpsAdd(', 'function _fbOpsEmpty(', 'function _fbPendRecord(', 'function _fbPendLsKey(',
   'function _fbPendPick(', 'function _fbPendSave(', 'function _fbPendFlight(', 'function _fbPendLand(',
   'function _fbPendRestore(', 'function _fbOpsPutBack(', 'function _fbWalOpen(', 'function _fbWalClose(']
    .forEach((d) => vm.runInContext(fn(d), ctx));
  vm.runInContext('var _fbWalSeq = 0;', ctx);
  return ctx;
}
const row = (id, t) => ({ id, title: t });

test('ⓔ★★★ 못 보낸 줄은 디스크에 적히고, 탭을 닫았다 다시 열어도 되읽힌다', () => {
  const disk = {};
  const a = pendBox(disk);
  a._fbPendRecord('cases', [row('c1', '가')], [row('c1', '가'), row('c2', '오프라인에서 넣음')]);
  assert.ok(Object.keys(disk).length === 1, '★★★ 못 보낸 변경이 메모리에만 있습니다 — 탭을 닫으면 사라집니다');

  const b = pendBox(disk);                       // 새 탭 — 메모리는 비었다
  assert.equal(b.window._fbPendingOps, undefined);
  const n = b._fbPendRestore();
  assert.equal(n, 1);
  assert.deepEqual(Object.keys(b.window._fbPendingOps.cases.up), ['c2'], '★★ 되읽은 것이 «바꾼 줄»이 아닙니다');
  assert.equal(b.window._fbPendingKeys.cases, true, '★ 되읽고도 «못 보낸 표» 표시가 없으면 서버 값이 덮습니다');
});

test('ⓔ★★ 보내는 중이던 저장도 «못 보낸 것»이다 — 서버가 받았다고 답해야 지운다', () => {
  const disk = {};
  const a = pendBox(disk);
  const id = a._fbWalOpen('cases', [row('c1', '가')], [row('c1', '나')]);
  assert.ok(id, '★★ 보내기 시작한 저장을 적지 않았습니다 — 끊긴 채 보내면 실시간DB 는 실패 없이 «기다리다» 탭과 함께 사라집니다');
  const b = pendBox(disk);
  b._fbPendRestore();
  assert.deepEqual(Object.keys(b.window._fbPendingOps.cases.up), ['c1']);
  a._fbWalClose(id);
  assert.equal(Object.keys(disk).length, 0, '★ 서버가 받은 저장을 계속 «못 보낸 것»으로 남깁니다');
  assert.equal(a._fbWalOpen('cases', null, [row('c1', '나')]), null,
    '★★ 이전 값을 모르는 저장을 적으면 표 전체가 «바꾼 줄»이 되어 되읽을 때 남의 줄을 덮습니다');
});

test('ⓔ★★ 사람마다 따로 적는다 — 같은 PC 의 다른 직원이 남의 변경을 보내지 않는다', () => {
  const disk = {};
  pendBox(disk, 'S001')._fbPendRecord('cases', [], [row('c9', '홍길동이 넣음')]);
  assert.equal(pendBox(disk, 'S002')._fbPendRestore(), 0, '★★ 다른 직원 로그인에서 남의 못 보낸 변경을 보냅니다');
  assert.equal(pendBox(disk, 'S001')._fbPendRestore(), 1, '본인이 다시 들어오면 되읽는다');
});

test('ⓔ★★ 되읽기는 서버 값을 받기 «전»이다 · dbSet 이 보내기를 적고 닫는다', () => {
  const boot = SRC.slice(SRC.indexOf('var _startFbSync = function(){'));
  const iRestore = boot.indexOf('_fbPendRestore()'), iSync = boot.indexOf('fbInitialSync()');
  assert.ok(iRestore > 0 && iRestore < iSync, '★★ 서버 값이 먼저 덮으면 지켜 줄 줄이 무엇인지 모릅니다');
  const set = fn('function dbSet(');
  assert.match(set, /var _walId = _fbWalOpen\(k, prev, v\)/, '★★ dbSet 이 보내기 시작한 저장을 적지 않습니다');
  assert.match(set, /var _metaRollback = function\(\)\{[^\n]*_walDone\(\);/, '★ 실패·막힘에서 «보내는 중» 표시를 닫지 않습니다(그다음은 _markPending 이 적는다)');
  assert.ok((set.match(/_walDone\(\)/g) || []).length >= 6, '★ 성공 길에서 «보내는 중» 표시를 닫지 않아 다음 접속 때 헛되이 다시 보냅니다');
  /* 다시 보내는 길도 서버가 답한 뒤에야 지운다 */
  ['function _fbReplayOps(', 'function _fbReplayOpsTxn(', 'function _fbReplayMapOps('].forEach((d) => {
    const f = fn(d);
    assert.match(f, /_fbPendFlight\(k, ops\)/, '★ ' + d + ' 가 보내는 동안 디스크에서 지웁니다');
    assert.match(f, /_fbPendLand\(k\)/, '★ ' + d + ' 가 다 보낸 뒤에도 디스크에 남깁니다');
  });
});
