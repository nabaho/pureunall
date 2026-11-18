'use strict';
/* 자동 로그아웃 시간은 «어떻게 로그인했나» 로 갈린다 (대표 지시 2026-11-18)
   「단순 비번·아이디로 로그인할 경우 1시간 제한 걸리고 계속 작업 시에는 시간이 연장되지만,
    카카오톡 로그인의 경우 3시간으로 하고 계속 작업 중인 경우 안 끊기게 해 달라」

   못 박는 것(규칙 — 화면 «개수»·이름을 박지 않는다):
   ① 판정은 공용 부품 한 곳(js/pu-active.js PuActive.limitMs)이다
      · 아이디·비번(그 밖 모두) → 포털 설정 시간(비우면 60분)
      · 카카오 → 3시간, 포털 설정이 더 길면 설정을 따른다(더 짧게 하지 않는다)
      · 다른 사람이 남긴 «카카오» 표시는 믿지 않는다 · 더 새 로그인의 표시를 옛 것이 덮지 않는다
      · 인증표(서버가 서명)의 kakao 표시로 바로잡는다
   ② 카카오 사용자는 1시간이 지나도 «움직였다» 가 적힌다 — 다른 앱에서 일해도 안 끊긴다
   ③ 자동 로그아웃을 거는 화면은 모두 그 판정을 묻는다 — 제 LIMIT 를 그대로 쓰지 않는다
   ④ 포털은 로그인 직후 어떻게 들어왔나를 적는다(비번 → password · 카카오 → kakao) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');

const MIN = 60 * 1000;
const KAKAO_MS = 180 * MIN;   // 검사고정-허용: 대표 지시 2026-11-18 「카카오톡 로그인의 경우 3시간」 — 값 자체가 규칙
const PW_MS = 60 * MIN;       // 검사고정-허용: 포털 설정을 비웠을 때의 기본 1시간(설정 화면 안내 「비워두면 60분」)

/* 공용 부품을 떼어 돌린다 — 파이어베이스 사람(user)은 있을 수도 없을 수도 있다 */
function 부품상자(저장, opt) {
  opt = opt || {};
  const 들은 = {};
  const g = {
    Date, parseInt, String, Number, JSON, Math, Promise,
    localStorage: { getItem: (k) => (k in 저장 ? 저장[k] : null), setItem: (k, v) => { 저장[k] = String(v); } },
    addEventListener: (ev, fn) => { 들은[ev] = fn; },
    PU_CFG: opt.cfg || null
  };
  if (opt.user) {
    g.firebase = { apps: [{}], auth: () => ({ currentUser: opt.user }) };
  }
  g.window = g; g.globalThis = g;
  vm.createContext(g);
  vm.runInContext(read('js/pu-active.js'), g);
  return { g, 들은, 저장 };
}
const via = (uid, v, at) => JSON.stringify({ uid, via: v, at: at || Date.now() });
const 사람 = (uid, claims, extra) => Object.assign({
  uid,
  metadata: { lastSignInTime: 'Wed, 18 Nov 2026 01:00:00 GMT' },
  getIdTokenResult: () => Promise.resolve({ claims: claims || {}, authTime: 'Wed, 18 Nov 2026 01:00:00 GMT', signInProvider: (claims && claims.kakao) ? 'custom' : 'password' })
}, extra || {});

test('① ★★ 아이디·비번은 1시간(포털 설정), 카카오는 3시간', () => {
  const pw = 부품상자({ pu_login_via: via('u1', 'password') }, { user: 사람('u1') });
  assert.equal(pw.g.PuActive.limitMs(), PW_MS, '아이디·비번 로그인이 기본 1시간이 아닙니다');
  const kk = 부품상자({ pu_login_via: via('u1', 'kakao') }, { user: 사람('u1', { kakao: true }) });
  assert.equal(kk.g.PuActive.limitMs(), KAKAO_MS, '★★ 카카오 로그인이 3시간이 아닙니다');
  // 아무 표시가 없으면 1시간(옛 기기·처음 쓰는 기기)
  const none = 부품상자({}, {});
  assert.equal(none.g.PuActive.limitMs(), PW_MS);
});

test('① 포털 설정 시간 — 비번은 설정을 따르고, 카카오는 설정이 더 길 때만 따른다', () => {
  const pw15 = 부품상자({ pu_login_via: via('u1', 'password') }, { user: 사람('u1'), cfg: { idleMinutes: '15' } });
  assert.equal(pw15.g.PuActive.limitMs(), 15 * MIN);
  const kk15 = 부품상자({ pu_login_via: via('u1', 'kakao') }, { user: 사람('u1', { kakao: true }), cfg: { idleMinutes: '15' } });
  assert.equal(kk15.g.PuActive.limitMs(), KAKAO_MS, '설정이 짧다고 카카오 3시간을 줄였습니다');
  const kk480 = 부품상자({ pu_login_via: via('u1', 'kakao') }, { user: 사람('u1', { kakao: true }), cfg: { idleMinutes: '480' } });
  assert.equal(kk480.g.PuActive.limitMs(), 480 * MIN, '설정이 3시간보다 긴데 카카오만 짧게 끊습니다');
  // 화면이 제 기본값(설정 반영)을 넘기면 그것을 기준으로 한다
  const base = 부품상자({ pu_login_via: via('u1', 'password') }, { user: 사람('u1') });
  assert.equal(base.g.PuActive.limitMs(30 * MIN), 30 * MIN);
});

test('① ★★ 다른 사람이 남긴 «카카오» 표시는 믿지 않는다', () => {
  const a = 부품상자({ pu_login_via: via('someone-else', 'kakao') }, { user: 사람('u1') });
  assert.equal(a.g.PuActive.limitMs(), PW_MS, '★★ 앞사람의 카카오 표시로 내 자동 로그아웃이 3시간이 됐습니다(공용 PC)');
  // 파이어베이스가 아직 사람을 못 띄운 첫 순간에는 적힌 표시를 따른다 — 막 연 화면에서 1시간으로 끊지 않는다
  const b = 부품상자({ pu_login_via: via('u1', 'kakao') }, {});
  assert.equal(b.g.PuActive.limitMs(), KAKAO_MS);
});

test('① 더 새 로그인의 표시를 옛 것이 덮지 않는다', () => {
  const t0 = Date.now();
  const s = { pu_login_via: via('u1', 'password', t0) };
  const { g } = 부품상자(s, {});
  assert.equal(g.PuActive.noteVia('u1', 'kakao', t0 - 60 * MIN), false, '옛 로그인이 새 기록을 덮었습니다');
  assert.equal(JSON.parse(s.pu_login_via).via, 'password');
  assert.equal(g.PuActive.noteVia('u1', 'kakao', t0 + 1000), true);
  assert.equal(JSON.parse(s.pu_login_via).via, 'kakao');
  // 다른 사람이면 시각과 상관없이 새로 적는다
  assert.equal(g.PuActive.noteVia('u2', 'password', 1), true);
  assert.equal(JSON.parse(s.pu_login_via).uid, 'u2');
});

test('① ★★ 인증표(서버 서명)의 kakao 표시로 바로잡는다', async () => {
  // 표시가 없던 기기에서 카카오로 들어온 사람 — 인증표를 읽으면 3시간이 된다
  const s1 = {};
  const a = 부품상자(s1, { user: 사람('u1', { kakao: true }) });
  a.g.PuActive.limitMs();
  await new Promise((r) => setImmediate(r));
  assert.equal(JSON.parse(s1.pu_login_via || 'null')?.via, 'kakao', '★★ 인증표의 카카오 표시를 안 읽습니다');
  assert.equal(a.g.PuActive.limitMs(), KAKAO_MS);
  // 브라우저에 «카카오» 가 잘못 남아 있어도(같은 사람, 더 옛 시각) 비번 인증표가 바로잡는다
  const s2 = { pu_login_via: via('u1', 'kakao', 1) };
  const b = 부품상자(s2, { user: 사람('u1', {}) });
  b.g.PuActive.limitMs();
  await new Promise((r) => setImmediate(r));
  assert.equal(JSON.parse(s2.pu_login_via).via, 'password', '★ 옛 카카오 표시가 비번 로그인에 남았습니다');
  assert.equal(b.g.PuActive.limitMs(), PW_MS);
});

test('② ★★ 카카오 사용자는 1시간이 넘어도 «움직였다» 가 적힌다 — 다른 앱에서 일해도 안 끊긴다', () => {
  const 옛 = String(Date.now() - 90 * MIN);
  const kk = 부품상자({ pu_last_active: 옛, pu_login_via: via('u1', 'kakao') }, { user: 사람('u1', { kakao: true }) });
  kk.들은.pointerdown();
  assert.notEqual(kk.저장.pu_last_active, 옛, '★★ 카카오 사용자가 90분째에 움직였는데 안 적었습니다 — 일하는 중에 끊깁니다');
  // 비번 사용자는 그대로 — 시간이 다 된 시계는 되살리지 않는다(공용 PC)
  const pw = 부품상자({ pu_last_active: 옛, pu_login_via: via('u1', 'password') }, { user: 사람('u1') });
  pw.들은.pointerdown();
  assert.equal(pw.저장.pu_last_active, 옛, '비번 사용자의 다 된 시계를 되살렸습니다');
  // 카카오라도 3시간이 지난 시계는 되살리지 않는다
  const 아주옛 = String(Date.now() - 181 * MIN);
  const kk2 = 부품상자({ pu_last_active: 아주옛, pu_login_via: via('u1', 'kakao') }, { user: 사람('u1', { kakao: true }) });
  kk2.들은.pointerdown();
  assert.equal(kk2.저장.pu_last_active, 아주옛, '카카오 3시간이 지난 시계를 되살렸습니다');
});

/* 자동 로그아웃을 거는 화면 — 포털 설정 시간을 받아 쓰는 곳(_applyIdleCfg)이 곧 제 시계를 가진 곳이다 */
function timerPages() {
  return fs.readdirSync(R).filter((f) => f.endsWith('.html'))
    .filter((f) => /function _applyIdleCfg\(/.test(stripJs(read(f))));
}

test('③ ★★ 자동 로그아웃을 거는 화면은 모두 공용 판정을 묻는다', () => {
  const pages = timerPages();
  assert.ok(pages.length >= 2, '자동 로그아웃 화면을 못 찾았습니다(' + pages.length + ') — 검사가 헛돕니다');
  const bad = [];
  for (const f of pages) {
    const s = stripJs(read(f));
    const why = [];
    if (!/<script src="js\/pu-active\.js\?v=\d+"><\/script>/.test(s)) why.push('공용 부품을 안 싣는다');
    // 시계 덩어리 — 설정 반영 함수 앞의 «var LIMIT» 부터 그 묶음이 닫히는 «})();» 까지
    //   (⚠ 화면 전체를 보면 이름만 같은 다른 LIMIT(느린 타이머 감시 등)에 헛걸린다)
    const at = s.search(/function _applyIdleCfg\(/);
    const from = s.lastIndexOf('var LIMIT', at);
    const endRel = s.slice(at).search(/\n\s*\}\)\(\);/);
    if (from < 0 || endRel < 0) { bad.push(f + '(시계 덩어리를 못 찾음)'); continue; }
    const blk = s.slice(from, at + endRel);
    if (!/PuActive\.limitMs\(\s*LIMIT\s*\)/.test(blk)) why.push('PuActive.limitMs 를 안 묻는다');
    // 남은 시간·지난 시간을 제 LIMIT 로 바로 재면 카카오도 1시간에 끊긴다
    if (/LIMIT\s*-\s*\(/.test(blk) || />=\s*LIMIT\b/.test(blk)) why.push('제 LIMIT 로 바로 잰다');
    // 판정을 묻는 함수를 «실제로» 쓴다
    if (!/idleLimit\(\)/.test(blk.replace(/function idleLimit\(\)/, ''))) why.push('idleLimit 를 만들기만 하고 안 쓴다');
    if (why.length) bad.push(f + '(' + why.join('·') + ')');
  }
  assert.deepEqual(bad, [], '★★ 이 화면은 카카오 사용자도 1시간에 끊습니다: ' + bad.join(', '));
});

test('④ ★ 포털은 로그인 직후 «어떻게 들어왔나» 를 적는다', () => {
  const s = stripJs(read('enter.html'));
  const pw = s.indexOf('signInWithEmailAndPassword(email, pw)');
  assert.ok(pw > 0, '비번 로그인 자리를 못 찾았습니다');
  assert.match(s.slice(pw, pw + 800), /PuActive\.noteVia\([^)]*'password'/, '비번 로그인 뒤에 password 를 안 적습니다');
  const kk = s.indexOf('signInWithCustomToken(');
  assert.ok(kk > 0, '카카오 로그인 자리를 못 찾았습니다');
  assert.match(s.slice(kk, kk + 800), /PuActive\.noteVia\([^)]*'kakao'/, '★ 카카오 로그인 뒤에 kakao 를 안 적습니다');
});
