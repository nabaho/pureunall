const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { 함수몸 } = require('./strip-comments');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'enter.html'), 'utf8');
const mfa = fs.readFileSync(path.join(root, 'js', 'pu-mfa.js'), 'utf8');

test('포털이 인증 앱 모듈을 판 번호와 함께 불러온다', () => {
  assert.match(html, /js\/pu-mfa\.js\?v=\d+/);
  assert.doesNotMatch(html, /<script[^>]+src="js\/pu-mfa\.js/,
    '카카오 로그인 중 2단계 인증의 별도 Firebase Auth를 미리 초기화하면 안 됩니다');
  assert.match(html, /function puLoadMFA\(\)/);
  assert.match(html, /script\.type = 'module'/);
  assert.match(html, /if\(_puMfaLoad\) return _puMfaLoad/,
    '동시 요청은 인증 모듈을 한 번만 불러와야 합니다');
  assert.match(html, /puLoadMFA\(\)\.then\(function\(mfa\)\{ return mfa\.beginLogin/,
    '2단계 로그인이 필요한 계정은 모듈을 그때 불러올 수 있어야 합니다');
});
test('2단계 인증 모듈 요청이 겹쳐도 스크립트 한 개를 쓰고 로드 후 같은 모듈을 돌려준다', async () => {
  const scripts = [];
  const ctx = {
    Promise, Error, _puMfaLoad: null, window: {},
    document: {
      createElement: () => ({}),
      head: { appendChild: (script) => { scripts.push(script); } },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(함수몸(html, 'puLoadMFA'), ctx);
  const first = ctx.puLoadMFA();
  const second = ctx.puLoadMFA();
  assert.equal(first, second);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].type, 'module');
  ctx.window.PuMFA = { status: () => Promise.resolve({ enrolled:false }) };
  scripts[0].onload();
  assert.equal(await first, ctx.window.PuMFA);
  assert.equal(await ctx.puLoadMFA(), ctx.window.PuMFA);
});
test('등록된 계정만 2단계 로그인 창으로 이어진다', () => {
  assert.match(html, /auth\/multi-factor-auth-required/);
  assert.match(html, /mfaLoginModal/);
  assert.match(mfa, /getMultiFactorResolver/);
  assert.match(mfa, /assertionForSignIn/);
});
test('내 정보에서 TOTP를 등록하고 비밀키를 서버 DB에 따로 저장하지 않는다', () => {
  assert.match(html, /인증 앱 2단계 인증/);
  assert.match(mfa, /generateSecret/);
  assert.match(mfa, /assertionForEnrollment/);
  assert.doesNotMatch(mfa, /getDatabase|firebase\.database|\.ref\(|fetch\(/);
});
test('SMS가 아니라 요금 없는 인증 앱 방식만 쓴다', () => {
  assert.match(mfa, /TotpMultiFactorGenerator/);
  assert.doesNotMatch(mfa, /PhoneMultiFactorGenerator|verifyPhoneNumber|recaptcha/i);
});
test('이메일 미인증 계정은 인증 메일부터 보내고 등록을 멈춘다', () => {
  assert.match(mfa, /if\(!u\.emailVerified\)/);
  assert.match(mfa, /sendEmailVerification\(u\)/);
});
test('직원이 직접 로그인하면 미등록 인증 앱 등록을 자동으로 요청한다', () => {
  assert.match(html, /function mfaOfferAfterLogin\(role, via\)/);
  assert.match(html, /via !== 'login' \|\| role === 'admin'/);
  assert.match(html, /mfaOfferAfterLogin\(role, info\.via\)/);
  assert.match(html, /로그인 보호 등록 요청/);
});
test('카카오 로그인은 지원되지 않는 TOTP 등록을 억지로 시도하지 않는다', () => {
  assert.match(html, /claims\.kakao===true/);
  assert.match(html, /아이디·비밀번호로 로그인한 뒤 등록/);
  assert.match(html, /if\(kakao\) kkOpenProfile\(\); else mfaBeginEnrollment\(\)/);
});
