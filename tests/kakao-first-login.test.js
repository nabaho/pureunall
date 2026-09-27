'use strict';
/* 카카오 먼저 — 로그인 화면·직원 연결 권유 (대표 지시 2026-09-27)
   「아이디 비번을 계속 보이는게 좋은가 … 폰에서도 로그인 카카오로 하게 하고
    다른직원도 카카오로 가능하게 모두 바꿔라」 → 목업 승인 「네」

   ★ 화면에 실린 그 코드를 «실제로 돌려» 본다 — 가짜 문서·저장소·DB 위에서.

   못 박는 것(규칙):
   ① 카카오 단추는 아이디 칸보다 «위» 에 있고, 접히는 칸 «밖» 이다.
   ② 이 기기에서 카카오를 쓴 적이 있으면 아이디·비밀번호 칸을 접는다. 처음이면 펼친다.
   ③ 저장소가 막힌 창에서는 «펼친 채» 둔다 — 들어올 길이 사라지면 안 된다.
   ④ 카카오 로그인이 실패하면 접힌 칸을 편다.
   ⑤ 카카오를 안 이은 직원에게 노란 줄을 띄우고, 이었으면 안 띄운다.
   ⑥ 「나중에」 는 7일 동안만 가린다 — 그 뒤에는 다시 뜬다. 사번마다 따로다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const { stripComments, 함수몸 } = require('./strip-comments');

const 원본 = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');
const 화면 = stripComments(원본);

/* ── 가짜 세상 ───────────────────────────────────────────────── */
function 요소(id) {
  const 손 = {};
  const 속성 = {};
  return {
    id, style: {}, _손: 손,
    setAttribute(k, v) { 속성[k] = String(v); },
    getAttribute(k) { return k in 속성 ? 속성[k] : null; },
    addEventListener(ev, fn) { (손[ev] = 손[ev] || []).push(fn); },
    click() { (손.click || []).forEach((f) => f()); },
    focus() {},
  };
}
function 저장소(초기, 막힘) {
  const m = Object.assign({}, 초기 || {});
  const 막아 = () => { if (막힘) throw new Error('SecurityError'); };
  return {
    _m: m,
    getItem(k) { 막아(); return k in m ? m[k] : null; },
    setItem(k, v) { 막아(); m[k] = String(v); },
    removeItem(k) { 막아(); delete m[k]; },
  };
}
function 세상(opt) {
  opt = opt || {};
  const els = {};
  ['pwFold', 'pwFoldBtn', 'kkRegRow', 'kkRegBtn', 'kkRegLater', 'loginId', 'errMsg', 'kkToast', 'kkModal']
    .forEach((id) => { els[id] = 요소(id); });
  els.kkModal.style.display = 'none';
  const 기록 = { 연결시작: 0, 오류: [] };
  const ctx = {
    console, Date, Number, String, Promise, JSON,
    localStorage: 저장소(opt.저장, opt.막힘),
    sessionStorage: 저장소({}, opt.막힘),
    document: { getElementById: (id) => els[id] || null },
    window: { PuKakao: {}, __myKakaoSid: opt.sid || 'p001' },
    auth: { currentUser: opt.로그인 === false ? null : { uid: 'U1' } },
    db: {
      ref: (p) => ({
        once: () => (opt.DB실패 ? Promise.reject(new Error('denied'))
          : Promise.resolve({ val: () => ((opt.DB || {})[p] || null) })),
      }),
    },
    confirm: () => false,
    alert: () => {},
    setTimeout, clearTimeout,
  };
  ctx.$ = (id) => els[id] || null;
  ctx.showErr = (m) => { if (m) 기록.오류.push(m); };
  ctx.kkStartLink = () => { 기록.연결시작++; };
  vm.createContext(ctx);
  return { ctx, els, 기록 };
}
/* 화면의 «그» 함수·상수를 가짜 세상에 싣는다 */
function 싣기(w, 이름들) {
  const 상수 = 화면.match(/var KK_USED_KEY[\s\S]*?var KK_LATER_MS[^;]*;/);
  assert.ok(상수, 'KK_USED_KEY·KK_LATER_KEY·KK_LATER_MS 를 못 찾았습니다');
  vm.runInContext(상수[0], w.ctx);
  vm.runInContext("var KK_WANT = 'pu_kakao_want_link';", w.ctx);
  이름들.forEach((n) => {
    const 몸 = 함수몸(화면, n);
    assert.ok(몸, 'enter.html 에서 ' + n + ' 을 못 찾았습니다');
    vm.runInContext(몸, w.ctx);
  });
}
/* 로그인 화면 속 «접기 결정» 짧은 줄 — 그리기 전에 도는 그것 */
function 접기줄() {
  const 덩이 = [...화면.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
    .filter((s) => s.includes("getElementById('pwFold')") && s.includes('pu_kakao_used'));
  assert.equal(덩이.length, 1, '로그인 화면의 접기 결정 줄이 한 곳에 있어야 합니다');
  return 덩이[0];
}
const 틈 = () => new Promise((r) => setImmediate(r));

/* ── ① 자리 ─────────────────────────────────────────────────── */
test('① ★★ 카카오 단추가 아이디 칸보다 위에 있고, 접히는 칸 밖이다', () => {
  const 폼 = 화면.slice(화면.indexOf('id="loginForm"'), 화면.indexOf('</form>', 화면.indexOf('id="loginForm"')));
  const 카카오 = 폼.indexOf('id="kkLoginBtn"');
  const 접힘 = 폼.indexOf('id="pwFold"');
  assert.ok(카카오 >= 0 && 접힘 >= 0, '로그인 폼에 카카오 단추·접히는 칸이 있어야 합니다');
  assert.ok(카카오 < 폼.indexOf('id="loginId"'),
    '★★ 카카오 단추가 아이디 칸 아래로 내려갔습니다 — 비밀번호 칸 아래에 있으면 아무도 안 누릅니다');
  assert.ok(카카오 < 접힘, '★ 카카오 단추가 접히는 칸 안에 들어갔습니다 — 접으면 카카오도 사라집니다');
  const 접힌몸 = 폼.slice(접힘);
  ['id="loginId"', 'id="loginPw"', 'id="loginBtn"'].forEach((k) => {
    assert.ok(접힌몸.includes(k), k + ' 가 접히는 칸 안에 있어야 합니다');
  });
});

/* ── ②③ 접기 ────────────────────────────────────────────────── */
test('② ★★ 카카오를 쓴 기기면 아이디·비밀번호 칸을 접고 펼치기 단추를 보인다', () => {
  const w = 세상({ 저장: { pu_kakao_used: '1' } });
  vm.runInContext(접기줄(), w.ctx);
  assert.equal(w.els.pwFold.style.display, 'none', '★★ 카카오를 쓴 기기인데 비밀번호 칸이 그대로 펼쳐져 있습니다');
  assert.equal(w.els.pwFoldBtn.style.display, 'block', '★ 접었는데 펼칠 단추가 안 보입니다 — 비밀번호로 들어올 길이 사라졌습니다');
  assert.equal(w.els.pwFoldBtn.getAttribute('aria-expanded'), 'false');
});

test('② ★ 처음 쓰는 기기는 펼친 채 둔다 — 처음 한 번은 아이디로 들어와야 카카오를 잇는다', () => {
  const w = 세상({});
  vm.runInContext(접기줄(), w.ctx);
  assert.notEqual(w.els.pwFold.style.display, 'none', '★ 처음 쓰는 기기인데 비밀번호 칸을 접었습니다');
});

test('③ ★★ 저장소가 막힌 창에서는 펼친 채 둔다', () => {
  const w = 세상({ 막힘: true });
  assert.doesNotThrow(() => vm.runInContext(접기줄(), w.ctx), '저장소가 막혔다고 로그인 화면이 멎으면 안 됩니다');
  assert.notEqual(w.els.pwFold.style.display, 'none', '★★ 저장소를 못 읽었는데 칸을 접었습니다');
});

test('② 펼치기 단추를 누르면 칸이 펼쳐지고 단추는 사라진다', () => {
  const w = 세상({ 저장: { pu_kakao_used: '1' } });
  vm.runInContext(접기줄(), w.ctx);
  싣기(w, ['kkUnfoldPw']);
  w.ctx.kkUnfoldPw();
  assert.notEqual(w.els.pwFold.style.display, 'none');
  assert.equal(w.els.pwFoldBtn.style.display, 'none');
  assert.equal(w.els.pwFoldBtn.getAttribute('aria-expanded'), 'true');
  assert.match(화면, /\$\('pwFoldBtn'\)\.addEventListener\('click'/, '펼치기 단추에 손이 안 달렸습니다');
});

/* ── ④ 카카오 복귀 ───────────────────────────────────────────── */
function 복귀세상(성공) {
  const w = 세상({ 저장: { pu_kakao_used: '1' } });
  vm.runInContext(접기줄(), w.ctx);
  w.ctx.window.PuKakao = {
    pending: () => ({ mode: 'login', code: 'C' }),
    loginFinish: () => (성공 ? Promise.resolve('CT')
      : Promise.reject(Object.assign(new Error('연결되지 않은 카카오 계정입니다'), { needLink: true }))),
  };
  w.ctx.PuKakao = w.ctx.window.PuKakao;
  w.ctx.auth.signInWithCustomToken = () => Promise.resolve({ user: { email: '', getIdToken: () => Promise.resolve('t') } });
  w.ctx.reportLogin = () => {};
  w.ctx._freshLogin = false;
  싣기(w, ['kkMarkUsed', 'kkUnfoldPw', 'kkHandleReturn']);
  return w;
}

test('④ ★★ 카카오 로그인이 실패하면 접힌 비밀번호 칸을 편다', async () => {
  const w = 복귀세상(false);
  w.ctx.kkHandleReturn();
  await 틈(); await 틈();
  assert.ok(w.기록.오류.length, '실패를 알리지 않았습니다');
  assert.notEqual(w.els.pwFold.style.display, 'none',
    '★★ 카카오가 실패했는데 비밀번호 칸이 접힌 채입니다 — 새 직원은 들어올 길이 없습니다');
});

test('④ ★ 카카오로 들어오면 이 기기에 «카카오 씀» 표시를 남긴다', async () => {
  const w = 복귀세상(true);
  delete w.ctx.localStorage._m.pu_kakao_used;
  w.ctx.kkHandleReturn();
  await 틈(); await 틈(); await 틈();
  assert.equal(w.ctx.localStorage._m.pu_kakao_used, '1', '★ 카카오로 들어왔는데 다음 로그인 화면이 여전히 비밀번호를 앞세웁니다');
});

/* ── ⑤⑥ 연결 권유 줄 ─────────────────────────────────────────── */
function 권유세상(opt) {
  const w = 세상(opt);
  싣기(w, ['kkMarkUsed', 'kkLaterActive', 'kkSetupRegRow']);
  return w;
}

test('⑤ ★★ 카카오를 안 이은 직원에게 노란 줄을 띄운다', async () => {
  const w = 권유세상({});
  w.ctx.kkSetupRegRow('p001');
  await 틈();
  assert.equal(w.els.kkRegRow.style.display, 'flex', '★★ 안 이은 직원인데 연결 권유가 안 뜹니다 — 「내 정보」는 아무도 못 찾았습니다');
  w.els.kkRegBtn.click();
  assert.equal(w.기록.연결시작, 1, '「카카오 연결」 을 눌렀는데 연결이 시작되지 않았습니다');
});

test('⑤ ★ 이미 이은 직원에겐 안 띄우고, 이 기기도 «카카오 먼저» 로 바꾼다', async () => {
  const w = 권유세상({ DB: { 'uid_kakao/U1': { kakaoId: 'k1', sid: 'p001', at: 1 } } });
  w.ctx.kkSetupRegRow('p001');
  await 틈();
  assert.notEqual(w.els.kkRegRow.style.display, 'flex', '★ 이미 이었는데 또 권합니다');
  assert.equal(w.ctx.localStorage._m.pu_kakao_used, '1');
});

test('⑤ 못 읽으면 조용히 안 띄운다 — 권유일 뿐이다', async () => {
  const w = 권유세상({ DB실패: true });
  w.ctx.kkSetupRegRow('p001');
  await 틈();
  assert.notEqual(w.els.kkRegRow.style.display, 'flex');
});

test('⑥ ★★ 「나중에」 는 7일 동안만 가린다', async () => {
  const w = 권유세상({});
  w.ctx.kkSetupRegRow('p001');
  await 틈();
  w.els.kkRegLater.click();
  assert.notEqual(w.els.kkRegRow.style.display, 'flex', '「나중에」 를 눌렀는데 줄이 그대로입니다');
  const 누른때 = Number(w.ctx.localStorage._m['pu_kakao_later:p001']);
  assert.ok(누른때 > 0, '「나중에」 가 사번 자리에 남지 않았습니다');
  const 하루 = 86400000;
  assert.equal(w.ctx.kkLaterActive('p001', 누른때 + 6 * 하루), true, '6일째인데 다시 떴습니다');
  assert.equal(w.ctx.kkLaterActive('p001', 누른때 + 8 * 하루), false,
    '★★ 8일이 지났는데도 안 뜹니다 — 「나중에」 가 «영영» 이 되면 아무도 안 잇습니다');
});

test('⑥ ★ 「나중에」 는 사번마다 따로다 — 여럿이 쓰는 PC 에서 남의 것이 내 것을 가리지 않는다', async () => {
  const w = 권유세상({ 저장: { 'pu_kakao_later:p002': String(Date.now()) } });
  w.ctx.kkSetupRegRow('p001');
  await 틈();
  assert.equal(w.els.kkRegRow.style.display, 'flex', '★ 옆 사람의 「나중에」 가 내 권유를 가렸습니다');
});

test('⑤ 포털이 그릴 때 권유 줄을 부른다', () => {
  assert.match(화면, /kkSetupRegRow\(mySid\)/, '★ renderPortal 이 kkSetupRegRow 를 안 부릅니다 — 줄이 영영 안 뜹니다');
});

/* ── ⑦⑧ 공용 PC (대표 「제3의 장소에서 로그인할 경우 어떻게하나?」 → 「추천대로」 2026-09-28) ──
   ⑦ 처음 쓰는 기기면 노란 단추가 카카오에게 «다시 묻게» 한다(앞 사람 카카오로 안 들어가게).
   ⑧ 카카오로 들어온 사람의 로그아웃은 파이어베이스를 «먼저» 끊고, 카카오도 끊으러 간다. */
function 단추세상(opt) {
  const w = 세상(opt);
  const 부탁 = [];
  w.ctx._persistenceReady = Promise.resolve();
  w.ctx.firebase = { auth: { Auth: { Persistence: { LOCAL: 'local' } } } };
  w.ctx.auth.setPersistence = () => Promise.resolve();
  w.ctx.window.PuKakao = { goLogin: (o) => { 부탁.push(o || {}); return Promise.resolve(); } };
  w.ctx.PuKakao = w.ctx.window.PuKakao;
  w.els.kkLoginBtn = 요소('kkLoginBtn');
  싣기(w, ['kkLogin']);
  return { w, 부탁 };
}

test('⑦ ★★ 처음 쓰는 기기면 카카오가 다시 묻게 하고, 카카오를 쓴 기기면 안 묻는다', async () => {
  const 처음 = 단추세상({});
  처음.w.ctx.kkLogin(); await 틈(); await 틈(); await 틈();
  assert.equal(처음.부탁[0] && 처음.부탁[0].ask, true,
    '★★ 처음 쓰는 기기인데 안 묻습니다 — 공용 PC 에 남은 앞 사람 카카오로 들어갑니다');
  const 내것 = 단추세상({ 저장: { pu_kakao_used: '1' } });
  내것.w.ctx.kkLogin(); await 틈(); await 틈(); await 틈();
  assert.equal(내것.부탁[0] && 내것.부탁[0].ask, false, '★ 내 기기에서도 매번 카카오 비밀번호를 묻습니다');
  const 막힘 = 단추세상({ 막힘: true });
  막힘.w.ctx.kkLogin(); await 틈(); await 틈(); await 틈();
  assert.equal(막힘.부탁[0] && 막힘.부탁[0].ask, true, '★ 저장소를 못 읽으면 «묻는 쪽» 이어야 합니다');
});

function 나가기세상(kakao, 주소실패) {
  const w = 세상({});
  const 일 = [];
  w.ctx.auth.currentUser = { getIdTokenResult: () => Promise.resolve({ claims: kakao ? { kakao: true } : {} }) };
  w.ctx.auth.signOut = () => { 일.push('signOut'); return Promise.resolve(); };
  w.ctx.location = {
    reload: () => 일.push('reload'),
    set href(v) { 일.push('go:' + v); },
  };
  w.ctx.window.PuKakao = {
    logoutUrl: () => { 일.push('ask'); return 주소실패 ? Promise.reject(new Error('x')) : Promise.resolve('https://kauth.kakao.com/oauth/logout?x'); },
  };
  w.ctx.PuKakao = w.ctx.window.PuKakao;
  싣기(w, ['kkLogoutFlow']);
  return { w, 일 };
}

test('⑧ ★★ 카카오로 들어온 사람은 파이어베이스를 먼저 끊고 카카오도 끊으러 간다', async () => {
  const k = 나가기세상(true);
  k.w.ctx.kkLogoutFlow();
  for (let i = 0; i < 6; i++) await 틈();
  const 끊기 = k.일.indexOf('signOut');
  const 가기 = k.일.findIndex((x) => x.startsWith('go:https://kauth.kakao.com/oauth/logout'));
  assert.ok(가기 >= 0, '★★ 카카오 로그인이 브라우저에 남습니다 — 다음 사람이 노란 단추로 «앞 사람으로» 들어갑니다');
  assert.ok(끊기 >= 0 && 끊기 < 가기, '★ 카카오로 떠나기 전에 포털부터 끊어야 합니다 — 카카오가 멎으면 로그인된 채 남습니다');
});

test('⑧ ★ 비밀번호로 들어온 사람은 예전 그대로 — 카카오를 건드리지 않는다', async () => {
  const p = 나가기세상(false);
  p.w.ctx.kkLogoutFlow();
  for (let i = 0; i < 6; i++) await 틈();
  assert.deepEqual([...p.일], ['signOut', 'reload'], '비밀번호 로그인의 로그아웃이 달라졌습니다');
});

test('⑧ ★ 카카오 주소를 못 받아도 로그아웃은 끝난다(멎어 보이지 않는다)', async () => {
  const k = 나가기세상(true, true);
  k.w.ctx.kkLogoutFlow();
  for (let i = 0; i < 6; i++) await 틈();
  assert.deepEqual([...k.일], ['signOut', 'ask', 'reload']);
});

test('⑧ 로그아웃 단추가 이 흐름을 부른다', () => {
  const at = 화면.indexOf("$('logoutBtn').addEventListener('click'");
  assert.ok(at > 0);
  assert.match(화면.slice(at, 화면.indexOf('});', at)), /kkLogoutFlow\(\)/, '★ 로그아웃 단추가 카카오 끊기를 안 부릅니다');
});
