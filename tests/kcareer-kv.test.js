'use strict';
/* 경력관리 자기 저장소(IndexedDB) — js/kcareer-kv.js (2026-10-07 대표 결정 「뿌리도」)
   까닭: 공용 localStorage 5MB 가 다른 앱 자료로 차서, 5번 폴더 40개를 넣고도 목록 줄이 새로고침에 사라졌다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const KV = require('../js/kcareer-kv.js');
const CODE = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const bare = CODE.replace(/\/\*[\s\S]*?\*\//g, ' ');

function 로컬(init) {
  const m = new Map(Object.entries(init || {}));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); },
    key: (i) => Array.from(m.keys())[i] || null, get length() { return m.size; } };
}
function 디비(init, o) {
  o = o || {};
  const m = new Map(Object.entries(init || {}));
  return { m,
    getAll: async () => { if (o.failOpen) throw new Error('열기 실패'); const out = {}; m.forEach((v, k) => { out[k] = (o.corrupt && k === o.corrupt) ? v + '!' : v; }); return out; },
    put: async (k, v) => { if (o.failPut) throw new Error('쓰기 실패'); m.set(k, v); }, del: async (k) => { m.delete(k); } };
}
const 만들기 = (ls, idb, extra) => KV.create(Object.assign({ ns: 'cm3_', ls, idb, mirror: ['wiccok', 'cert', 'edu'] }, extra || {}));

test('★★★ 처음 켤 때 옮겨 담고, 다시 읽어 같은 것을 본 뒤에만 옛 자리를 비운다 — 사본 셋은 남긴다', async () => {
  const ls = 로컬({ cm3_bizapp: '[1]', cm3_wiccok: '[2]', cm3__fbbase: '9', 'pureun_v6_x': 'ERP', cm3_pf_meta_a: '{}' });
  const idb = 디비();
  const kv = 만들기(ls, idb);
  const r = await kv.boot();
  assert.equal(kv.state, 'ready'); assert.equal(r.first, true); assert.equal(r.verified, true);
  assert.equal(kv.get('cm3_bizapp'), '[1]'); assert.equal(kv.get('cm3__fbbase'), '9');
  assert.equal(idb.m.get('cm3_bizapp'), '[1]'); assert.ok(idb.m.has(KV.MARK));
  assert.equal(ls.getItem('cm3_bizapp'), null, '★ 옮긴 뒤엔 공용 5MB 를 돌려준다');
  assert.equal(ls.getItem('cm3_wiccok'), '[2]', '포털 홈이 읽는 사본은 남긴다');
  assert.equal(ls.getItem('pureun_v6_x'), 'ERP', '★ 남의 앱 자료는 건드리지 않는다');
  assert.equal(ls.getItem('cm3_pf_meta_a'), '{}', '옛 첨부 조각은 옮기지 않는다');
  assert.ok(!idb.m.has('cm3_pf_meta_a'));
  assert.equal(ls.getItem('cm3__kv_moved'), '1');
});

test('★★ 견주기가 틀리면 옛 자리를 비우지 않는다', async () => {
  const ls = 로컬({ cm3_bizapp: '[1]' });
  const kv = 만들기(ls, 디비({}, { corrupt: 'cm3_bizapp' }));
  const r = await kv.boot();
  assert.equal(r.verified, false);
  assert.equal(ls.getItem('cm3_bizapp'), '[1]', '★ 잘못 옮겼는데 옛 자리를 비우면 되돌릴 데가 없다');
});

test('★★ 열리기 전에 들어온 쓰기는 열린 뒤 그 위에 얹는다(나중 것이 이긴다)', async () => {
  const ls = 로컬({ cm3_consult: '[old]' });
  const idb = 디비();
  const kv = 만들기(ls, idb);
  assert.equal(kv.set('cm3_consult', '[new]'), true);
  assert.equal(kv.get('cm3_consult'), '[new]', '열리기 전에도 방금 쓴 것을 읽는다');
  kv.remove('cm3_tmp');
  await kv.boot();
  assert.equal(kv.get('cm3_consult'), '[new]'); assert.equal(idb.m.get('cm3_consult'), '[new]');
  /* 열린 뒤 쓰기는 저장소로 — 공용 localStorage 는 다시 채우지 않는다(사본 셋만) */
  kv.set('cm3_bizapp', '[b]'); kv.set('cm3_wiccok', '[w]'); await kv.flush();
  assert.equal(idb.m.get('cm3_bizapp'), '[b]'); assert.equal(ls.getItem('cm3_bizapp'), null);
  assert.equal(ls.getItem('cm3_wiccok'), '[w]');
  assert.equal(kv.set('pureun_v6_x', 'z'), null, '남의 열쇠는 맡지 않는다(예전 길로)');
  /* 이미 옮긴 기기 — 열리기 전 쓰기가 localStorage 에만 남으면 열린 뒤 비우면서 사라진다 */
  const idb2 = 디비({ [KV.MARK]: '1', cm3_consult: '[저장소]' });
  const kv2 = 만들기(로컬({ cm3__kv_moved: '1' }), idb2);
  kv2.set('cm3_consult', '[열기 전 고침]');
  await kv2.boot();
  assert.equal(kv2.get('cm3_consult'), '[열기 전 고침]', '★ 열리기 전에 고친 것이 저장소의 옛 값에 덮였다');
  assert.equal(idb2.m.get('cm3_consult'), '[열기 전 고침]');
});

test('★★ 이미 옮긴 기기에서 저장소가 비어 보이면 broken — 저장을 막는다(빈 것으로 덮지 않게)', async () => {
  const kv = 만들기(로컬({ cm3__kv_moved: '1', cm3_wiccok: '[2]' }), 디비());
  const r = await kv.boot();
  assert.equal(kv.state, 'broken'); assert.equal(r.state, 'broken');
  assert.throws(() => kv.set('cm3_bizapp', '[]'), /열지 못했습니다/);
  assert.match(bare, /function fbAutoOn\(\)\{[^}]*KV\.state==='broken'\) return false;/, '★ 깨졌으면 클라우드로 오가지도 않는다');
});

test('못 여는 브라우저(사생활 창 등) — 예전처럼 localStorage 로 돈다', async () => {
  const ls = 로컬({ cm3_bizapp: '[1]' });
  const kv = 만들기(ls, 디비({}, { failOpen: true }));
  await kv.boot();
  assert.equal(kv.state, 'fail'); assert.equal(kv.set('cm3_bizapp', '[2]'), null, 'null 이면 부르는 쪽(LS)이 예전 길로 쓴다');
  assert.equal(ls.getItem('cm3_bizapp'), '[1]');
});

test('★ 같은 PC 의 다른 탭에 알린다 — 안 알리면 옛 목록으로 덮는다 · 못 쓰면 알린다', async () => {
  const 듣는이 = []; const bc = () => ({ postMessage(m) { 듣는이.forEach((x) => { if (x !== this && x.onmessage) x.onmessage({ data: m }); }); }, onmessage: null });
  const b1 = bc(), b2 = bc(); 듣는이.push(b1, b2);
  const idb = 디비({ [KV.MARK]: '1' });
  const A = 만들기(로컬(), idb, { bc: b1 }), B = 만들기(로컬(), idb, { bc: b2 });
  await A.boot(); await B.boot();
  A.set('cm3_resume', '[42]');
  assert.equal(B.get('cm3_resume'), '[42]');
  A.remove('cm3_resume'); assert.equal(B.get('cm3_resume'), null);
  const 알림 = [];
  const C = 만들기(로컬(), 디비({ [KV.MARK]: '1' }, { failPut: true }), { onError: (e, k) => 알림.push(k) });
  await C.boot(); C.set('cm3_x', '1'); await C.flush();
  assert.deepEqual(알림, ['cm3_x'], '★ 저장소에 못 썼으면 조용히 넘기지 않는다');
});

test('★★ 화면 배선 — LS 가 자기 저장소를 쓰고, 시작은 열린 뒤 · 모으기·되살리기·지움 표·동기화 표시도 LS 로', () => {
  assert.match(bare, /get\(k\)\{ if\(Object\.prototype\.hasOwnProperty\.call\(_mem,k\)\) return _mem\[k\]; if\(KV && KV\.mine\(k\)\) return KV\.get\(k\);/);
  assert.match(bare, /set\(k,v\)\{ if\(KV && KV\.set\(k,v\)===true\)/);
  assert.match(CODE, /\(KV \? KV\.boot\(\) : Promise\.resolve\(null\)\)\.then\(function\(_kvr\)\{[\s\S]*_safe\(loadSeed\)[\s\S]*\}\);   \/\* ← 저장소가 열린 뒤 시작 \*\//, '★ 열리기 전에 목록을 읽으면 옛 자리를 본다');
  const 앞 = CODE.slice(0, CODE.indexOf('(KV ? KV.boot()'));
  assert.doesNotMatch(앞.slice(앞.lastIndexOf('<script')), /^_safe\(loadSeed\)/m, '시작 구간이 열기 «앞»에 남아 있으면 안 된다');
  assert.ok(CODE.indexOf('js/kcareer-kv.js') < CODE.indexOf('var KV=null;'), '모듈을 먼저 싣는다');
  /* ★ 공용 5MB 가 꽉 차면 쓰기 시험(STORAGE_OK)이 실패한다 — 그것으로 가르면 자기 저장소를 안 열어 빈 화면이 된다(미리보기 실측) */
  const 여는곳 = bare.slice(bare.indexOf('var KV=null;'), bare.indexOf('const LS={'));
  assert.doesNotMatch(여는곳, /STORAGE_OK/, '★ 꽉 찼을 때 자기 저장소를 안 열면 옮겨 둔 자료가 안 보인다');
  /* 경력관리 열쇠를 localStorage 로 곧장 만지는 곳이 없어야 한다(옛 첨부 조각 pf_ 와 화면 설정은 예외) */
  const 곧장 = (bare.match(/localStorage\.(getItem|setItem|removeItem)\(NS\+(?!'pf_)[^)]*\)/g) || []);
  assert.deepEqual(곧장, [], '★ 곧장 쓰면 자기 저장소를 건너뛴다');
  assert.match(bare, /function fbGatherLS\(\)\{ var o=\{\}; LS\.keys\(\)\.forEach/);
  assert.match(bare, /var 열쇠들 = LS\.keys\(\);/, '지움 표의 «다른 통에 살아 있나»도');
  /* 긴 넣기 동안 «저장 중» — 배포 새로고침이 넣기를 끊었다 */
  assert.match(bare, /function kcBusy\(on\)\{[\s\S]*pu:save-state[\s\S]*'saving'/);
  assert.match(bare, /function kcReload\(ms\)\{ Promise\.resolve\(KV&&KV\.flush\(\)\)/);
  assert.ok((bare.match(/kcReload\(/g) || []).length >= 5, '받아 온 뒤 새로고침은 쓰기가 끝난 뒤');
  assert.doesNotMatch(bare, /setTimeout\(function\(\)\{ location\.reload\(\); \}, (900|1500)\)/);
});
