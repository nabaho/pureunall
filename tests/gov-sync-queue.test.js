'use strict';
/* 정부사업 컨설팅(gov-consulting.html) — 기기 사이 자료가 «갈라지지 않게» (대표 지시 2026-10-05)
   「다른모든 프로그램에서도 데이터가 분리되지 않게 처리해라」

   ■ 고친 셋
     ① 클라우드가 붙기 전에 저장하면 «이 기기에만» 넣고 「다시 저장하세요」로 끝났다 — 아무도 다시 안 누른다.
        붙는 순간 fbSyncDown 이 클라우드 옛 값으로 덮어 그 저장은 사라졌다.
        → 밀린 저장 줄(p_fbDirty)에 «올릴 값»을 적고, 붙는 순간·재연결 때 자동으로 올린다.
     ② 증빙 사진 창고 올리기 실패가 콘솔 한 줄뿐이었다 → 못 올린 사진 줄(p_evQueue), 켤 때·재연결 때 다시.
        「이 PC 것 공용으로 올리기」 단추를 안 누른 PC 의 사진 → 켤 때 저절로(evAutoBacklog).
     ③ 클라우드가 비정상적으로 적으면 안 받는 안전장치 — 그대로 두되, 2초 토스트 대신 건수가 든 띠를 남긴다.

   ⚠ 이 검사는 «진짜 함수»를 vm 에서 돌린다 — 글자만 찾는 검사는 고장 난 채로도 통과한다.

   node --test tests/gov-sync-queue.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const src = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8').replace(/\r\n/g, '\n');
function between(a, b) {
  const i = src.indexOf(a);
  assert.ok(i >= 0, '원본에서 「' + a + '」 을 못 찾았습니다 — 이름이 바뀌었나요?');
  const j = src.indexOf(b, i);
  assert.ok(j > i, '「' + b + '」 을 못 찾았습니다');
  return src.slice(i, j);
}

/* ── 가짜 저장소·가짜 DB ───────────────────────────── */
function fakeLS() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    key: (i) => Array.from(m.keys())[i],
    get length() { return m.size; },
    _m: m
  };
}
function fakeDB(opt) {
  const data = {};
  const log = [];
  const o = opt || {};
  function ref(p) {
    return {
      set: (v) => { log.push(['set', p]); if (o.fail) return Promise.reject(o.fail); data[p] = JSON.parse(JSON.stringify(v)); return Promise.resolve(); },
      transaction: (fn) => {
        log.push(['tx', p]);
        if (o.fail) return Promise.reject(o.fail);
        const gate = o.gate ? o.gate : Promise.resolve();
        return gate.then(() => { const nv = fn(data[p] == null ? null : JSON.parse(JSON.stringify(data[p]))); data[p] = nv; return { committed: true }; });
      },
      once: () => Promise.resolve({ val: () => (data[p] == null ? null : JSON.parse(JSON.stringify(data[p]))) })
    };
  }
  return { ref, data, log };
}

/* ── ① 밀린 저장 ─────────────────────────────────────── */
function loadPush() {
  const ls = fakeLS();
  const states = [];
  const toasts = [];
  const ctx = {
    console: { warn() {}, info() {}, log() {} },
    localStorage: ls, JSON, Map, Promise, Date, Math, Object, Array, String, Error,
    FB_NODES: { p_cos: 'scal_cos', p_scheds: 'scal_scheds', p_env: 'scal_env' },
    FB_READY: false, _fbDB: null, _fbSuppress: false,
    _recordWriteQueue: {}, _recordWritePending: {}, _heldSnap: {},
    setSaveState: (k, t, title) => states.push({ k, t, title }),
    _saveStart() {}, _saveFinish() {},
    _saveFailMsg: () => '실패', toast: (m, k) => toasts.push([m, k]),
    lsKeyValid: () => true
  };
  vm.createContext(ctx);
  const code = [
    'const _lsMem=Object.create(null);let _lsFullTold=false;',
    cutFn(src, 'function lsGet('),
    cutFn(src, 'function lsSet('),
    cutFn(src, 'function _isDeniedErr('),
    cutFn(src, 'function _noUndef('),
    cutFn(src, 'function _idRows('),
    cutFn(src, 'function _idMap('),
    between('const FB_DIRTY_KEY=', 'function updateFbStatus('),
    ';({fbPush,fbPushRecordDelta,fbFlushDirty,fbDirtyCount,_fbDirtyGet})'
  ].join('\n');
  const api = vm.runInContext(code, ctx);
  return { ctx, ls, api, states, toasts };
}

test('★★★ 연결 전 저장은 «잊지 않는다» — 줄에 적고, 붙는 순간 자동으로 올린다(사업장·일정)', async () => {
  const t = loadPush();
  const before = [{ id: 'a', n: 1 }, { id: 'b', n: 1 }];
  const after = [{ id: 'a', n: 2 }, { id: 'c', n: 1 }];          // a 고침 · b 지움 · c 새로
  const r = await t.api.fbPushRecordDelta('p_cos', before, after);
  assert.equal(r, false, '연결 전에는 올라가지 않았다');
  const q = t.api._fbDirtyGet();
  assert.ok(q.p_cos && q.p_cos.ids, '★ 밀린 저장 줄에 안 적혔다 — 붙어도 아무것도 안 올라간다');
  assert.deepEqual(Object.keys(q.p_cos.ids).sort(), ['a', 'b', 'c']);
  assert.equal(q.p_cos.ids.b.row, null, '지운 줄은 row:null 로 적는다(지운 것도 올라가야 한다)');
  assert.equal(q.p_cos.ids.a.row.n, 2, '줄에는 «올릴 값 그 자체»를 담는다 — 이 기기 사본은 내려받기가 덮을 수 있다');
  const last = t.states[t.states.length - 1];
  assert.match(last.t + last.title, /자동/, '「다시 저장하세요」가 아니라 «자동으로 올린다»고 알려야 한다');
  assert.doesNotMatch(last.title, /다시 저장하세요/);

  /* 클라우드에는 다른 기기가 넣은 줄 b·x 가 있다 */
  const db = fakeDB();
  db.data.scal_cos = [{ id: 'b', n: 1 }, { id: 'x', n: 9 }];
  t.ctx.FB_READY = true; t.ctx._fbDB = db;
  const n = await t.api.fbFlushDirty();
  assert.equal(n, 1);
  const ids = db.data.scal_cos.map((x) => x.id).sort();
  assert.deepEqual(ids, ['a', 'c', 'x'], '내 고침(a·c)과 지움(b)이 올라가고, 남의 줄(x)은 그대로');
  assert.equal(t.api.fbDirtyCount(), 0, '올라간 뒤에는 줄에서 지운다');
  assert.equal(t.ls.getItem('p_fbDirty'), null);
});

test('★★ 통째 칸(환경설정 등)도 같은 줄로 — 붙으면 자동으로 set', async () => {
  const t = loadPush();
  await t.api.fbPush('p_env', { a: 1 });
  await t.api.fbPush('p_env', { a: 2 });                            // 연결 전에 두 번 — 마지막 것만
  assert.equal(t.api.fbDirtyCount(), 1);
  const db = fakeDB();
  t.ctx.FB_READY = true; t.ctx._fbDB = db;
  await t.api.fbFlushDirty();
  assert.deepEqual(db.data.scal_env, { a: 2 });
  assert.equal(t.api.fbDirtyCount(), 0);
});

test('★★ 올리는 사이에 또 고친 것은 남는다 — 표(tok)가 같을 때만 지운다', async () => {
  const t = loadPush();
  let open; const gate = new Promise((r) => { open = r; });
  const db = fakeDB({ gate });
  t.ctx.FB_READY = true; t.ctx._fbDB = db;
  const p1 = t.api.fbPushRecordDelta('p_scheds', [], [{ id: 's1', v: 1 }]);
  /* 첫 저장이 아직 서버에서 안 돌아왔는데 같은 줄을 또 고쳤다(이번엔 연결이 잠깐 끊겨 줄에만) */
  t.ctx.FB_READY = false;
  await t.api.fbPushRecordDelta('p_scheds', [{ id: 's1', v: 1 }], [{ id: 's1', v: 2 }]);
  open();
  await p1;
  const q = t.api._fbDirtyGet();
  assert.ok(q.p_scheds && q.p_scheds.ids.s1, '★ 뒤에 고친 것이 앞 저장의 성공으로 지워졌다 — 그 고침이 사라진다');
  assert.equal(q.p_scheds.ids.s1.row.v, 2);
});

test('★★ 끊김으로 실패하면 남기고, 권한에 막히면 뺀다(다시 보내도 안 들어간다)', async () => {
  const t = loadPush();
  t.ctx.FB_READY = true;
  t.ctx._fbDB = fakeDB({ fail: Object.assign(new Error('disconnected'), { code: 'disconnect' }) });
  await t.api.fbPush('p_env', { a: 1 });
  assert.equal(t.api.fbDirtyCount(), 1, '끊겨 실패한 것은 다음에 다시 올라가야 한다');
  t.ctx._fbDB = fakeDB({ fail: Object.assign(new Error('PERMISSION_DENIED'), { code: 'PERMISSION_DENIED' }) });
  await t.api.fbFlushDirty();
  assert.equal(t.api.fbDirtyCount(), 0, '권한 거절은 줄에서 뺀다 — 켤 때마다 같은 실패를 되풀이하지 않게');
});

test('★★★ 붙는 순간 «먼저» 올리고 그다음 내려받는다 — 순서가 바뀌면 연결 전 저장이 덮인다', () => {
  const fbInit = cutFn(src, 'function fbInit(');
  /* «붙는 자리»(FB_READY=true 로 바꾸는 곳) 뒤에서 본다 — 재연결 손잡이에도 fbFlushDirty 가 있다 */
  const ready = fbInit.indexOf('FB_READY=true');
  assert.ok(ready > 0, '붙는 자리(FB_READY=true)를 못 찾았습니다');
  const flush = fbInit.indexOf('fbFlushDirty()', ready);
  const down = fbInit.indexOf('fbSyncDown()', ready);
  assert.ok(flush > 0, '★ 붙는 자리에서 밀린 저장을 안 올린다');
  assert.ok(flush < down, '★ 내려받기(fbSyncDown)가 밀린 저장보다 먼저 돈다 — 이 기기 저장이 클라우드 옛 값으로 덮인다');
  assert.match(fbInit, /\.info\/connected[\s\S]{0,200}fbFlushDirty\(\)/, '★ 다시 붙을 때(와이파이 복구) 밀린 저장을 안 올린다');
});

test('★★ 밀린 저장·못 올린 사진 줄은 «청소»에서 빠진다 — 안 빠지면 켤 때마다 지워진다', () => {
  const m = /const LS_VALID_KEYS=\[([^\]]*)\]/.exec(src);
  assert.ok(m, 'LS_VALID_KEYS 를 못 찾았습니다');
  ['p_fbDirty', 'p_evQueue', 'p_evBacklogAt'].forEach((k) =>
    assert.ok(m[1].includes("'" + k + "'"), '★ ' + k + ' 가 LS_VALID_KEYS 에 없다 — cleanupLS 가 켤 때마다 지운다'));
});

/* ── ③ 비정상 축소 띠 ───────────────────────────────── */
function fakeDoc() {
  const els = {};
  return {
    els,
    getElementById: (id) => els[id] || null,
    createElement: () => {
      const el = { style: {}, innerHTML: '', setAttribute() {}, remove() { delete els[el.id]; } };
      return el;
    },
    body: { appendChild: (el) => { els[el.id] = el; } }
  };
}
test('★★ 클라우드가 비정상적으로 적으면 — 막되, 건수가 든 띠를 «남긴다»(토스트 한 줄로 끝내지 않는다)', () => {
  const ls = fakeLS();
  ls.setItem('p_cos', JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ id: 'c' + i }))));
  const document = fakeDoc();
  const ctx = { document, localStorage: ls, JSON, Object, Array, console };
  vm.createContext(ctx);
  const api = vm.runInContext([
    cutFn(src, 'function _cnt('),
    between('const _shrinkHeld={};', 'function shrinkAcceptCloud('),
    ';({shrinkHold,shrinkClear})'
  ].join('\n'), ctx);
  api.shrinkHold('p_cos', [{ id: 'c1' }, { id: 'c2' }]);
  const el = document.els.shrinkBanner;
  assert.ok(el, '★ 띠가 안 뜬다 — 이 기기는 말없이 클라우드와 다른 채로 남는다');
  assert.match(el.innerHTML, /40건/, '이 기기 건수');
  assert.match(el.innerHTML, /2건/, '클라우드 건수');
  assert.match(el.innerHTML, /shrinkAcceptCloud\(\)/, '사람이 고를 길(클라우드 기준으로 맞추기)이 있어야 한다');
  api.shrinkClear('p_cos');
  assert.equal(document.els.shrinkBanner, undefined, '맞춰지면 띠를 거둔다');
});

test('★★ 안전장치는 그대로 — 내려받기·구독 둘 다 축소면 «안 받고» 띠를 띄운다', () => {
  const down = cutFn(src, 'async function fbSyncDown(');
  const sub = cutFn(src, 'function fbSubscribe(');
  [['fbSyncDown', down], ['fbSubscribe', sub]].forEach(([n, f]) => {
    assert.match(f, /_isBulkShrink\([\s\S]{0,200}shrinkHold\(lsKey/, '★ ' + n + ' 이 축소를 띠로 알리지 않는다');
    assert.match(f, /shrinkClear\(lsKey\)/, n + ' — 정상 값이 오면 띠를 거둬야 한다');
  });
  const acc = cutFn(src, 'function shrinkAcceptCloud(');
  assert.match(acc, /confirm\(/, '클라우드로 맞추기는 사람이 확인한 뒤에만');
  assert.ok(acc.indexOf('takeSnapshot(') < acc.indexOf('lsSet('), '★ 이 기기 자료를 자동백업에 먼저 남기지 않고 덮는다');
});

/* ── ② 증빙 사진 ─────────────────────────────────────── */
function loadEv(opt) {
  const ls = fakeLS();
  const o = opt || {};
  const idb = new Map(o.idb || []);
  const uploads = [];
  const ctx = {
    console: { warn() {}, info() {}, log() {} },
    localStorage: ls, JSON, Promise, Date, Object, Array, String,
    window: { addEventListener() {} }, setInterval() {}, setTimeout() {}, clearTimeout() {},
    document: fakeDoc(), toast() {}, FB_READY: true,
    lsSet: (k, v) => { ls.setItem(k, v); return true; },
    photoStorage: () => ({}),
    evRef: (sid, key) => ({
      putString: async () => { if (o.fail) throw Object.assign(new Error('net'), { code: 'storage/retry-limit-exceeded' }); uploads.push(sid + '/' + key); }
    }),
    getPhotoFromDB: async (sid, key) => idb.get(sid + '/' + key) || null,
    getScheds: () => []
  };
  vm.createContext(ctx);
  const api = vm.runInContext([
    'let evNeedRule=false; let _evBacklogRunning=false;',
    between('async function evUpload(', '/* 창고에서 받아 온다.'),
    ';({evUpload,evQueueGet,evQueueRetry})'
  ].join('\n'), ctx);
  return { ctx, ls, api, uploads, idb };
}

test('★★★ 증빙 사진 올리기가 실패하면 줄에 남고, 다음에 저절로 다시 올라간다', async () => {
  const t = loadEv({ fail: true, idb: [['s1/c0', 'data:image/jpeg;base64,AA']] });
  const ok = await t.api.evUpload('s1', 'c0', 'data:image/jpeg;base64,AA', { shotAt: '10:00', plain: '0' });
  assert.equal(ok, false);
  const q = t.api.evQueueGet();
  assert.equal(q.length, 1, '★ 실패한 사진이 줄에 없다 — 그 사진은 이 PC 안에만 남는다');
  assert.deepEqual(q[0].meta, { shotAt: '10:00', plain: '0' }, '찍은 시각 쪽지도 같이 적어야 다시 올릴 때 붙는다');
  assert.ok(!JSON.stringify(q).includes('base64'), '줄에는 사진 자체를 넣지 않는다(브라우저 저장소 5MB 를 모든 앱이 나눠 쓴다)');
  /* 인터넷이 돌아왔다 */
  t.ctx.evRef = (sid, key) => ({ putString: async () => { t.uploads.push(sid + '/' + key); } });
  await t.api.evQueueRetry();
  assert.deepEqual(t.uploads, ['s1/c0']);
  assert.equal(t.api.evQueueGet().length, 0, '올라간 뒤에는 줄에서 지운다');
});

test('★★ 이 기기에서도 지운 사진은 다시 안 올리고 줄에서 뺀다', async () => {
  const t = loadEv({ fail: true });
  await t.api.evUpload('s9', 'c1', 'data:x');
  assert.equal(t.api.evQueueGet().length, 1);
  t.ctx.evRef = () => ({ putString: async () => { t.uploads.push('x'); } });
  await t.api.evQueueRetry();
  assert.equal(t.uploads.length, 0, '지운 사진을 올렸다');
  assert.equal(t.api.evQueueGet().length, 0);
});

test('★★ 단추를 안 눌러도 — 켤 때·다시 붙을 때·인터넷이 돌아올 때 저절로 돈다', () => {
  const fbInit = cutFn(src, 'function fbInit(');
  assert.match(fbInit, /evQueueRetry/, '★ 붙을 때 못 올린 사진을 다시 올리지 않는다');
  assert.match(fbInit, /evAutoBacklog/, '★ 이 기기에만 있는 옛 증빙을 저절로 올리지 않는다 — 단추를 안 누른 PC 의 사진은 영영 갈라진다');
  assert.match(src, /addEventListener\('online',[\s\S]{0,120}evQueueRetry/, '인터넷이 돌아오면 다시 올려야 한다');
  const auto = cutFn(src, 'function evAutoBacklog(');
  assert.match(auto, /evUploadBacklog\(\{\s*auto:\s*true\s*\}\)/);
  const bk = cutFn(src, 'async function evUploadBacklog(');
  assert.match(bk, /if\(!fail && !lg\.fail && !evNeedRule\)[\s\S]{0,80}p_evBacklogAt/,
    '★ 실패가 있어도 「다 했다」를 남기면 다음에 다시 안 돈다');
  assert.match(bk, /evStatus\(/, '저절로 돌 때도 작은 표시는 보여야 한다(사람이 모르게 올리지 않는다)');
  assert.match(cutFn(src, 'async function evRemove('), /evQueueDrop\(/, '지운 사진이 줄에 남아 다시 올라가면 안 된다');
});
