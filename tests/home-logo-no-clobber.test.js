'use strict';
/* 자문사 로고 목록을 «통째로» 덮지 않는다 — node --test tests/home-logo-no-clobber.test.js
 *
 * 2026-10-03 검토 ⑧. 화면을 열 때 읽은 사본(App.partnerLogos)을 homepage/partnerLogos 에
 * 통째로 set 했다. 탭 둘·관리자 둘이면 한쪽이 담은 로고가 목록에서 빠졌다(파일만 남는다).
 * 올린 뒤에는 「새로 넣은 것」을 통째로 비워, 올리는 동안 남이 담은 로고·숨겨 둔 로고까지 사라졌다.
 *
 * ★ 지키는 것
 *   ① 담기는 서버 목록에 «붙인다» — 다른 탭이 방금 담은 것이 남는다
 *   ② 숨김은 그 로고 한 칸만 쓴다
 *   ③ 올린 뒤에는 «쪽에 실린 것»만 뺀다 — 통째로 비우지 않는다
 *   ④ partnerLogos 를 통째로 set 하는 곳이 없다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const HOME = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8').replace(/\r\n/g, '\n');

/* 가짜 서버 — 트랜잭션은 «서버가 지금 들고 있는 값»으로 몸통을 부른다 */
function 상자(서버) {
  const 쓴것 = [];
  const ctx = {
    console, Object, Array, String, Math, JSON, Promise, Error,
    App: { isAdmin: true, partnerLogos: { 숨김: {}, 차례: [], 추가: [] } },
    firebase: { auth: () => ({ currentUser: { getIdToken: () => Promise.resolve('t') } }) },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }),
    PUBLISH_URL: 'x', PARTNER_LOGO_PATH: 'homepage/partnerLogos', drawPartnerLogos() {},
    db: { ref(p) { return {
      set(v) { 쓴것.push({ 방식: 'set', p, v }); return Promise.resolve(); },
      transaction(fn) {
        const 칸 = p.split('/').pop();
        const out = fn(JSON.parse(JSON.stringify(서버[칸] === undefined ? null : 서버[칸])));
        if (out !== undefined) 서버[칸] = out;
        쓴것.push({ 방식: 'transaction', p, v: out });
        return Promise.resolve({ committed: out !== undefined, snapshot: { val: () => out } });
      }
    }; } }
  };
  vm.createContext(ctx);
  vm.runInContext(['function 로고칸(', 'function 로고목록(', 'function 로고열쇠(',
    'async function 로고담기(', 'async function hidePartnerLogo('].map(s => cutFn(HOME, s)).join('\n'), ctx);
  return { ctx, 쓴것 };
}

test('★★★ ① 담기가 다른 탭이 «방금 담은» 로고를 지우지 않는다', async () => {
  /* 이 화면의 사본은 비어 있지만, 서버에는 다른 탭이 담은 한 장이 이미 있다 */
  const 서버 = { 추가: [{ srl: 'n1', 그림: '../files/logo/n1.png' }] };
  const { ctx, 쓴것 } = 상자(서버);
  await ctx.로고담기('QUJD', 'png', '');
  assert.equal(서버.추가.length, 2, '★★★ 다른 탭이 담은 로고가 목록에서 빠졌습니다 — 파일만 남고 쪽에 안 실립니다');
  assert.ok(서버.추가.some(x => x.srl === 'n1'), '★★★ 남이 담은 로고가 사라졌습니다');
  assert.ok(!쓴것.some(x => x.방식 === 'set' && x.p === 'homepage/partnerLogos'),
    '★★ partnerLogos 를 통째로 썼습니다');
  assert.equal(ctx.App.partnerLogos.추가.length, 2, '★ 화면 사본이 서버와 어긋납니다');
});

test('★★ ② 숨김은 그 로고 «한 칸»만 쓴다', async () => {
  const { ctx, 쓴것 } = 상자({});
  await ctx.hidePartnerLogo('77', true);
  assert.deepEqual(쓴것.map(x => [x.방식, x.p, x.v]), [['set', 'homepage/partnerLogos/숨김/77', true]],
    '★★ 숨김 하나를 바꾸며 다른 칸까지 썼습니다');
  await ctx.hidePartnerLogo('77', false);
  assert.equal(쓴것[1].v, null, '★ 숨김을 풀었는데 칸이 안 지워졌습니다');
});

test('★★★ ③ 올린 뒤에는 «쪽에 실린 것»만 뺀다 — 통째로 비우지 않는다', () => {
  const s = stripJs(cutFn(HOME, 'async function publishPartner('));
  assert.ok(!/partnerLogos\.추가\s*=\s*\[\s*\]/.test(s),
    '★★★ 올린 뒤 「새로 넣은 것」을 통째로 비웁니다 — 올리는 동안 남이 담은 로고·숨긴 로고가 사라집니다');
  assert.match(s, /로고칸\('추가'\)\.transaction\(/, '★★ 서버 목록에서 빼지 않고 사본으로 덮습니다');
  assert.match(s, /고른것\.갈것/, '★★ 무엇이 «쪽에 실렸는지»를 보지 않고 뺍니다');
});

test('★★ ④ partnerLogos 를 통째로 set 하는 곳이 없다', () => {
  const s = stripJs(HOME);
  assert.ok(!/ref\(PARTNER_LOGO_PATH\)\.set\(/.test(s), '★★ 자문사 로고 자료를 통째로 덮는 곳이 남아 있습니다');
  assert.ok(!/function savePartnerLogos\(/.test(s), '★ 통째로 쓰던 옛 저장 함수가 남아 있습니다');
});
