'use strict';
// 서류는 원본 토큰 주소를 «안 적는다» · node --test tests/photos-doc-no-token.test.js
//
// 대표 지시 2026-09-27 「나머지 해라」 — 사진첩 점검 ② 뒤 절반(화면 쪽)
//   앞 절반(서버 문지기가 서류를 받는다)은 #1650 에서 먼저 넓히고 배포했다.
//
// 이 검사가 지키는 것
//   ①★★ 올릴 때 서류면 fullUrl 을 안 적는다 — 판독 전 신분증에 평생 가는 주소가 안 남는다
//   ②★★ 돌릴 때도 안 되살아난다 — 한 번 돌리는 것만으로 주소가 돌아오면 ①이 무효다
//   ③★  사진(회의사진)은 예전 그대로 주소를 적는다 — 2026-08-17 「회색 46장」을 되풀이하지 않는다
//   ④   미리보기 주소는 서류도 그대로 — 격자가 서버를 거치면 통째로 느려진다
//   ⑤★  서버 문지기가 서류를 받는다 — 화면이 주소를 안 적는데 서버가 돌려보내면 아무도 못 연다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const STORE_SRC = fs.readFileSync(path.join(R, 'js', 'pu-photo-store.js'), 'utf8');
const PV = require(path.join(R, 'functions', 'photo-view.js'));

function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (src[j] === '{') d++; else if (src[j] === '}') { d--; if (!d) { j++; break; } } }
  return src.slice(i, j);
}

/* ── 저장 층을 가짜 세상에 올린다 (photo-signed-url.test.js 와 같은 모양) ── */
function loadStore() {
  const ctx = {
    console, Promise, JSON, Math, Date, String, Number, Array, Object, Error, Boolean,
    setTimeout, clearTimeout, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  /* 창고에서 되받기 — 되받은 그림은 무엇이든 괜찮다(있기만 하면 된다) */
  ctx.fetch = function () { return Promise.resolve({ ok: true, blob: function () { return Promise.resolve({}); } }); };
  ctx.FileReader = function () {
    this.readAsDataURL = function () { const s = this; setTimeout(function () { s.onload && s.onload(); }, 0); };
    this.result = 'data:image/jpeg;base64,RkFLRQ==';
  };
  vm.createContext(ctx);
  vm.runInContext(STORE_SRC, ctx);
  return ctx.PuPhotoStore;
}
function fakeDb(tree) {
  const writes = [];
  const get = p => String(p).split('/').filter(Boolean)
    .reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, tree);
  return {
    writes,
    ref: p => ({
      once: () => Promise.resolve({ val: () => { const v = get(p); return v === undefined ? null : v; } }),
      update: u => { writes.push(u); return Promise.resolve(); }
    })
  };
}
/* 창고 흉내 — 올리면 받고, 주소를 물으면 토큰 주소를 준다 */
function fakeStorage() {
  return { ref: p => ({
    putString: () => Promise.resolve(),
    getDownloadURL: () => Promise.resolve('https://firebasestorage.googleapis.com/v0/b/x/o/'
      + encodeURIComponent(p) + '?alt=media&token=TOKEN')
  }) };
}
const META = 'puphotos/u/me/items/2026/p1';

/* ══════════ ① 올릴 때 ══════════ */

/* saveMetaOnly 는 안쪽 함수라 «원문 그대로» 꺼내 가짜 이웃 위에서 돌린다 */
function uploadWrites(kind) {
  const writes = [];
  const b = {
    Object, String, Date, Promise,
    deps: { uid: 'me', name: '홍길동', db: { ref: () => ({ update: u => { writes.push(u); return Promise.resolve(); } }) } },
    metaPath: (y, id) => 'puphotos/u/me/items/' + y + '/' + id,
    textPath: (y, id) => 'puphotos/u/me/text/' + y + '/' + id,
    ownerPath: uid => 'puphotos/owners/' + uid
  };
  vm.createContext(b);
  vm.runInContext(grab(STORE_SRC, 'isDocKind') + '\n' + grab(STORE_SRC, 'saveMetaOnly'), b);
  return b.saveMetaOnly({ id: 'p1', meta: { kind: kind, byName: '홍길동' } }, '2026',
    'https://firebasestorage.googleapis.com/full?token=T', 'https://firebasestorage.googleapis.com/thumb?token=T')
    .then(() => writes[0][META]);
}

test('★★ 올릴 때 «서류»면 원본 주소를 안 적는다', async () => {
  const m = await uploadWrites('doc');
  assert.equal('fullUrl' in m, false,
    '서류에 원본 주소를 적었습니다 — 판독 전 신분증에 만료 없는 주소가 평생 남습니다');
});

test('★ 올릴 때 «사진»은 예전 그대로 원본 주소를 적는다 — 회색 46장을 되풀이하지 않는다', async () => {
  const m = await uploadWrites('photo');
  assert.equal(typeof m.fullUrl, 'string', '사진 주소까지 막았습니다 — 공유받은 사람 화면이 회색이 됩니다');
  const m2 = await uploadWrites(undefined);
  assert.equal(typeof m2.fullUrl, 'string', '갈래가 없는 옛 사진의 주소까지 막았습니다');
});

test('미리보기 주소는 서류도 그대로 적는다 — 격자가 서버를 거치면 느려진다', async () => {
  const m = await uploadWrites('doc');
  assert.equal(typeof m.thumbUrl, 'string');
  assert.equal(m.loc, 'storage', '창고에 있다는 표시가 빠지면 지우기·복원이 없는 자리를 헤맵니다');
});

/* ══════════ ② 돌릴 때 ══════════ */

async function rotate(item) {
  const tree = { puphotos: { u: { me: { items: { 2026: { p1: item } } } } } };
  const db = fakeDb(tree);
  const S = loadStore();
  S.init({ db: db, uid: 'me', storage: fakeStorage(), mode: 'storage' });
  await S.replaceImage('2026', 'p1', 'data:image/jpeg;base64,AA', 'data:image/jpeg;base64,BB', 'me');
  const w = db.writes.filter(u => (META + '/fullUrl') in u)[0];
  assert.ok(w, '돌린 뒤 정보를 안 적었습니다');
  return w;
}

test('★★ 서류를 «돌려도» 원본 주소가 되살아나지 않는다 — 판독 전', async () => {
  const w = await rotate({ kind: 'doc' });
  assert.equal(w[META + '/fullUrl'], null, '서류를 한 번 돌렸더니 주소가 되살아났습니다');
});

test('★★ 서류를 «돌려도» 안 되살아난다 — 판독 뒤 민감 아닌 서류(사업자등록증)도', async () => {
  const w = await rotate({ kind: 'doc', read: { kind: 'bizreg', fields: {} } });
  assert.equal(w[META + '/fullUrl'], null);
});

test('민감 서류는 예전처럼 돌려도 안 되살아난다(옛 약속 그대로)', async () => {
  const w = await rotate({ read: { kind: 'idcard', fields: {} } });
  assert.equal(w[META + '/fullUrl'], null);
});

test('★ 사진은 돌리면 «새» 주소를 적는다 — 안 적으면 남들 눈에 안 돌린 사진이 보인다', async () => {
  const w = await rotate({ kind: 'photo', read: { kind: 'meeting', fields: {} } });
  assert.match(String(w[META + '/fullUrl']), /^https:\/\/firebasestorage/,
    '사진을 돌렸는데 새 주소를 안 적었습니다');
});

test('돌려도 미리보기 주소는 새로 적는다', async () => {
  const w = await rotate({ kind: 'doc' });
  assert.match(String(w[META + '/thumbUrl']), /^https:\/\/firebasestorage/);
});

/* ══════════ ⑤ 서버와 짝 ══════════ */

test('★ 서버 문지기가 서류를 받는다 — 화면이 주소를 안 적는데 서버가 돌려보내면 아무도 못 연다', () => {
  assert.equal(PV.decide({ kind: 'doc' }).ok, true, '판독 전 서류를 서버가 돌려보냅니다');
  assert.equal(PV.decide({ kind: 'doc', read: { kind: 'bizreg' } }).ok, true, '판독 뒤 서류를 돌려보냅니다');
});

test('★ 화면과 서버가 «서류»를 같은 말로 부른다 — 한쪽만 바뀌면 조용히 어긋난다', () => {
  const S = loadStore();
  ['doc', 'photo', '', undefined, null].forEach(k => {
    assert.equal(S.isDocKind(k), PV.isDocItem({ kind: k }),
      '「' + k + '」를 화면과 서버가 다르게 봅니다');
  });
});

test('저장 층을 싣는 화면이 모두 «같은 판»을 부른다 — 한 화면만 옛 저장 층이면 거기서 샌다', () => {
  const pages = fs.readdirSync(R).filter(f => f.endsWith('.html'));
  const vs = {};
  pages.forEach(f => {
    const m = fs.readFileSync(path.join(R, f), 'utf8').match(/js\/pu-photo-store\.js\?v=(\d+)/);
    if (m) vs[f] = m[1];
  });
  const uniq = Array.from(new Set(Object.values(vs)));
  assert.ok(Object.keys(vs).length >= 2, '저장 층을 싣는 화면을 못 찾았습니다');
  assert.equal(uniq.length, 1, '판이 갈렸습니다: ' + JSON.stringify(vs));
});
