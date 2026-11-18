/* 리멤버 → 사진첩·기업정보함 — «이미 한 번 가져온 것은 무조건 막는다» (대표 지시 2026-11-18)
   「리멤버에서 가지고 오더라도 중복 명함·서류를 가지고 오면 안 된다. 이미 한 번 가져왔던 것은 자동으로 차단.
    기업정보함도 중복으로 정리되면 안 된다. 항상 프로그램으로 무조건 거르게」
   ★ 이 시험은 «진짜 코드»(js/pu-remember.js importOne · js/pu-doc-file.js sendToCards·withLock)를 그대로 돌린다.
     바꿔 끼우는 것은 DB(순서가 뒤섞이는 가짜)·그림 올리기(세는 가짜)·지문뿐이다.
   ★ DB 흉내는 «지연»을 둔다 — 읽고 쓰는 사이에 다른 쪽이 끼어드는 일(탭 둘·브라우저 둘·메일 서명 줄)을 실제로 일으켜 본다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const nodeCrypto = require('crypto');

function load(file, sandbox) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox);
  return sandbox;
}

/* 지연이 있는 가짜 DB — tests/fake-rtdb.js (읽고 쓰는 사이에 다른 쪽이 끼어드는 일을 실제로 일으킨다) */
const { makeDb } = require("./fake-rtdb.js");

function layer(extraSeed) {
  const sandbox = { crypto: globalThis.crypto, TextEncoder, Buffer, console, setTimeout, Promise, Date };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  load('js/pu-lockkey.js', sandbox);
  load('js/pu-doc-read.js', sandbox);
  load('js/pu-doc-file.js', sandbox);
  load('js/pu-remember.js', sandbox);
  const db = makeDb(Object.assign({ pucards: { config: { bykeyAt: 1700000000000 } } }, extraSeed || {}));
  sandbox.PuDocFile.init({ db });
  return { F: sandbox.PuDocFile, R: sandbox.PuRemember, db };
}

const ROOT = 'pucards/remember';
const sha = (dataUrl) => Promise.resolve(nodeCrypto.createHash('sha256').update(String(dataUrl)).digest('hex'));
const IMG = (tag) => 'data:image/jpeg;base64,' + Buffer.from('그림-' + tag).toString('base64');
const NOW = Date.UTC(2026, 10, 18, 1, 0, 0);

/* 리멤버 묶음 하나(가짜 사람·가짜 번호) */
function card(rid, over) {
  return Object.assign({ rid: String(rid), cid: 'c' + rid, createdAt: '2026-11-18T09:00:00+09:00', updatedAt: NOW,
    name: '홍길동', company: '가나상사', dept: '', title: '대리', mobile: '010-1234-5678', tel: '', fax: '', email: 'gildong@gana.test',
    address: '', front: 'https://remember-cdn.rememberapp.co.kr/front-' + rid + '.jpg?sig=1', back: '' }, over || {});
}
/* 막대 — 사진 올리기에 둘이 «함께 닿을 때까지» 기다리게 한다(잠금이 있으면 둘째가 못 닿으므로 300ms 뒤 저절로 열린다).
   타이머 운에 기대지 않고 «잠금이 없으면 반드시 사진이 두 장»이 되게 해서, 잠금을 빼는 고장을 시험이 «늘» 잡게 한다. */
function gated() {
  const waiting = [];
  const open = () => waiting.splice(0).forEach((go) => go());
  return () => new Promise((ok) => { waiting.push(ok); if (waiting.length >= 2) open(); else setTimeout(open, 300); });
}
function deps(L, extra, gate) {
  const photos = [];
  const wait = gate ? gated() : () => Promise.resolve();
  const d = Object.assign({
    db: L.db, ROOT,
    withLock: (p, fn) => L.F.withLock(p, fn, { step: 2, maxWait: 4000 }),
    sha,
    addPhoto: (img) => wait().then(() => { photos.push(img); const id = 'ph' + photos.length; return { photo: { owner: 'u1', year: '2026', id }, pic: { full: img, thumb: img } }; }),
    sendToCards: (o) => L.F.sendToCards(o),
  }, extra || {});
  d.photos = photos;
  return d;
}
const itemsOf = (L) => Object.keys((L.db.tree.pucards && L.db.tree.pucards.items) || {});

test('★★★ 같은 묶음을 두 곳이 «동시에» 처리해도 사진은 한 장·기업정보함은 한 명', async () => {
  const L = layer(); const d = deps(L, null, true);
  const c = card(1), img = IMG('a');
  const res = await Promise.all([L.R.importOne(d, c, img, NOW), L.R.importOne(d, c, img, NOW)]);
  assert.strictEqual(d.photos.length, 1, '★★★ 같은 묶음을 동시에 처리했더니 사진이 ' + d.photos.length + '장 올랐습니다 — 이것이 화면에서 본 «두 장씩» 입니다');
  assert.strictEqual(itemsOf(L).length, 1, '★★★ 기업정보함에 같은 사람이 ' + itemsOf(L).length + '명 생겼습니다');
  assert.ok(res.every((r) => !r.err), '둘 다 오류 없이 끝나야 합니다: ' + JSON.stringify(res));
});

test('★★★ 리멤버에 «같은 명함이 두 묶음(rid)»으로 있어도 사진은 한 장·기업정보함은 한 명 — 동시에 와도', async () => {
  const L = layer(); const d = deps(L, null, true);
  const res = await Promise.all([
    L.R.importOne(d, card(1), IMG('a'), NOW),
    L.R.importOne(d, card(2), IMG('b'), NOW),            /* 그림은 다르지만(다시 찍음) 같은 사람 */
  ]);
  assert.strictEqual(d.photos.length, 1, '★★★ 같은 명함 두 묶음이 사진 ' + d.photos.length + '장이 됐습니다');
  assert.strictEqual(itemsOf(L).length, 1, '★★★ 기업정보함에 같은 사람이 ' + itemsOf(L).length + '명 생겼습니다');
  const blocked = res.filter((r) => /안 가져옴/.test(r.what));
  assert.strictEqual(blocked.length, 1, '★ 막은 쪽은 «안 가져옴»이라고 결과 줄에 까닭을 남겨야 합니다: ' + JSON.stringify(res.map((r) => r.what)));
});

test('★★★ 같은 그림(바이트가 같음)이 다른 묶음·다른 이름으로 와도 사진은 한 장', async () => {
  const L = layer(); const d = deps(L);
  const same = IMG('same');
  await L.R.importOne(d, card(1), same, NOW);
  const r = await L.R.importOne(d, card(2, { name: '김철수', mobile: '010-9999-0000', email: '' }), same, NOW);
  assert.strictEqual(d.photos.length, 1, '★★★ 같은 그림이 또 올라갔습니다');
  assert.match(r.what, /같은 그림/);
});

test('★★★ 한 번 가져온 명함은 그림이 «바뀌어도» 사진을 또 올리지 않는다 — 글자는 빈 칸만 채운다', async () => {
  const L = layer(); const d = deps(L);
  await L.R.importOne(d, card(1, { title: '' }), IMG('v1'), NOW);
  assert.strictEqual(d.photos.length, 1);
  const edited = card(1, { title: '과장', updatedAt: NOW + 1000, front: 'https://remember-cdn.rememberapp.co.kr/front-1-new.jpg' });   /* 그림 주소도 바뀜 */
  const r = await L.R.importOne(d, edited, IMG('v2'), NOW + 1000);
  assert.strictEqual(d.photos.length, 1, '★★★ 한 번 가져온 명함이 그림이 바뀌었다고 사진을 또 올렸습니다');
  const rec = L.db.tree.pucards.items[itemsOf(L)[0]];
  assert.strictEqual(rec.title, '과장', '빈 칸이던 직책은 채워져야 합니다(글자 갱신은 그대로)');
  assert.ok(!r.err);
});

test('★★ 동명이인은 막지 않는다 — 이름·회사가 같아도 휴대폰이 «둘 다 있고 다르면» 다른 사람', async () => {
  const L = layer(); const d = deps(L);
  await L.R.importOne(d, card(1), IMG('a'), NOW);
  await L.R.importOne(d, card(2, { mobile: '010-5555-6666', email: 'other@gana.test' }), IMG('b'), NOW);
  assert.strictEqual(d.photos.length, 2, '★★ 번호가 다른 동명이인인데 한 사람으로 막았습니다');
  assert.strictEqual(itemsOf(L).length, 2);
});

test('★★ 한쪽에 휴대폰이 없어도 이름+회사가 같으면 같은 사람으로 본다 — 사진 한 장', async () => {
  const L = layer(); const d = deps(L);
  await L.R.importOne(d, card(1), IMG('a'), NOW);
  await L.R.importOne(d, card(2, { mobile: '', email: '' }), IMG('b'), NOW);
  assert.strictEqual(d.photos.length, 1, '★★ 번호가 비었다고 같은 사람을 또 올렸습니다');
});

test('★★ 사진 올리기가 실패하면 «가져온 것으로 적지 않는다» — 다음 회차에 다시 올릴 수 있다', async () => {
  const L = layer();
  const bad = deps(L, { addPhoto: () => Promise.reject(new Error('올리기 실패')) });
  await assert.rejects(() => L.R.importOne(bad, card(1), IMG('a'), NOW), /올리기 실패/);
  assert.ok(!(L.db.tree.pucards.remember && L.db.tree.pucards.remember.fp), '실패했는데 그림 지문을 «가져옴»으로 적었습니다 — 영영 못 올립니다');
  assert.ok(!(L.db.tree.pucards.remember && L.db.tree.pucards.remember.seen), '실패했는데 묶음을 «가져옴»으로 적었습니다');
  const ok = deps(L);
  await L.R.importOne(ok, card(1), IMG('a'), NOW + 5);
  assert.strictEqual(ok.photos.length, 1, '★ 실패 뒤 다시 올릴 수 있어야 합니다');
});

test('★★★ 지문을 못 만들면(안전하지 않은 환경) 올리지 않고 오류로 돌린다 — 지문 없이 올리면 중복이다', async () => {
  const L = layer();
  const d = deps(L, { sha: () => Promise.reject(new Error('지문 못 만듦')) });
  await assert.rejects(() => L.R.importOne(d, card(1), IMG('a'), NOW), /지문/);
  assert.strictEqual(d.photos.length, 0, '★★★ 지문 없이 사진을 올렸습니다');
});

test('★★ 같은 사람을 다른 곳이 처리 중이면(잠금) 기다리다 «만들지 않고» 오류로 돌린다', async () => {
  const L = layer();
  const lk = 'n' + L.R.hash(L.R.nameKey('홍길동'));
  L.db.tree.pucards.remember = { lock: { [lk]: { t: 'someone-else', at: Date.now() } } };      /* 방금 누가 잡았다 */
  const d = deps(L, { withLock: (p, fn) => L.F.withLock(p, fn, { step: 2, maxWait: 40 }) });
  await assert.rejects(() => L.R.importOne(d, card(1), IMG('a'), NOW), /처리하는 중/);
  assert.strictEqual(d.photos.length, 0, '★★ 잠금을 못 잡았는데 사진을 올렸습니다');
  assert.strictEqual(itemsOf(L).length, 0, '★★ 잠금을 못 잡았는데 기업정보함에 만들었습니다');
});

test('★ 이름·회사가 모두 없으면 기업정보함에는 안 보낸다(사진 지문은 지킨다)', async () => {
  const L = layer(); const d = deps(L);
  const r = await L.R.importOne(d, card(3, { name: '', company: '', mobile: '', email: '' }), IMG('x'), NOW);
  assert.match(r.what, /이름·회사 없음/);
  assert.strictEqual(itemsOf(L).length, 0);
});

test('★★ 사람 열쇠 — 휴대폰이 있으면 휴대폰이 첫째, 이름+회사가 둘째(둘 다 없으면 열쇠 없음)', () => {
  const L = layer();
  const k = L.R.cardKeys(card(1));
  /* ⚠ 모듈은 vm 안에서 돌아 배열의 «나라»가 달라 deepStrictEqual 이 안 맞는다 — 글자로 견준다 */
  assert.strictEqual(k.map((x) => x.k[0]).join(''), 'mn');
  assert.strictEqual(k[0].k, 'm01012345678');
  assert.strictEqual(L.R.cardKeys(card(2, { mobile: '' })).map((x) => x.k[0]).join(''), 'n');
  assert.strictEqual(L.R.cardKeys(card(3, { mobile: '', name: '', company: '' })).length, 0);
  assert.strictEqual(L.R.cardKeys(card(4, { company: '(주)가나상사' }))[1].k, L.R.cardKeys(card(5, { company: '가나상사' }))[1].k,
    '(주) 표시가 달라도 같은 회사로 본다');
});

test('★ 화면은 가져오기를 «이 계산»에 맡기고, 같은 이름은 한 곳씩만(잠금)·그림 지문을 만든다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'remember-intake.html'), 'utf8');
  const one = html.slice(html.indexOf('function one('), html.indexOf('function addPhotoOf('));
  assert.match(one, /PuRemember\.importOne\(/, '★★ 화면의 one() 이 가져오기 계산을 안 부릅니다');
  assert.match(one, /withLock: PuDocFile\.withLock/, '★★★ 잠금을 끼우지 않았습니다 — 동시 처리 때 중복이 생깁니다');
  assert.match(one, /sha: sha256Data/, '★★★ 그림 지문을 끼우지 않았습니다');
  assert.match(html, /crypto\.subtle\.digest\('SHA-256'/, '지문 만드는 부품이 없습니다');
});
