'use strict';
/* 영업관리 다섯 앱을 «재직 직원 모두»에게 연다 (대표 지시 2026-10-30)

   「영업관리 자료함 의뢰인업무는 모든 직원들에게 공개한다. 그렇게 정리해라」
   → 어디까지냐 물으니 «완전 공개 (직원도 사용)» — 타일·앱 안의 잠금·서버 자료 권한 모두.

   대상: 홈페이지(home) · 뉴스레터(news) · 정부사업신청(govbid) · 회생광고(rehabad) · 전광판(signboard).
   «모든 직원» = 재직 직원 — 규칙의 LOGIN(비번 로그인 + uid_roles 의 status==='active').

   ★ 지키는 것 두 갈래:
     ① 열렸다 — 타일에 adminOnly·perm 이 없고, 앱이 관리자 잣대로 잠그지 않고, 규칙이 재직 직원에게 읽기·쓰기를 준다.
     ② 그래도 «아무나»는 아니다 — 로그인 안 함·익명·퇴직자·남은 여전히 막힌다(앱도 규칙도 서버도 «모르면 닫는다»).
   ⚠ 경력관리(내부관리 줄)는 이 지시에 들지 않는다 — 그대로 관리자 전용이다.

   실행: node --test tests/sales-row-open-to-staff.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const R = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(R, p), 'utf8');
const SALES = ['home', 'news', 'govbid', 'rehabad', 'signboard'];

/* ═══ ① 포털 타일 · 앱 막대 ═══ */
const enter = read('enter.html');
const appbar = read('js/pu-appbar.js');
const 타일 = (src, k) => src.split(/\r?\n/).find((l) => (l.includes("key:'" + k + "'") || l.includes("key: '" + k + "'")) && /url\s*:/.test(l)) || '';

test('영업관리 다섯 타일에 관리자 전용 표시(adminOnly·perm)가 없다 — 포털과 앱 막대 둘 다', () => {
  SALES.forEach((k) => {
    const e = 타일(enter, k), a = 타일(appbar, k);
    assert.ok(e, 'enter.html 에 ' + k + ' 타일이 없다');
    assert.ok(a, 'pu-appbar.js 에 ' + k + ' 줄이 없다');
    assert.match(e, /row\s*:\s*'sales'/, k + ' 가 영업관리 줄을 떠났다');
    assert.doesNotMatch(e, /adminOnly|perm\s*:|off\s*:\s*true/, k + ' 포털 타일이 다시 닫혔다');
    assert.doesNotMatch(a, /adminOnly|perm\s*:|off\s*:\s*true/, k + ' 앱 막대가 포털과 어긋난다');
  });
});

test('경력관리는 그대로 관리자 전용이다 — 내부관리 줄은 이 지시에 들지 않는다', () => {
  assert.match(타일(enter, 'career'), /adminOnly\s*:\s*true/);
  assert.match(타일(appbar, 'career'), /adminOnly\s*:\s*true/);
});

/* ═══ ① 앱 안의 잠금 — 재직 + 사번을 보고, 관리자 잣대로 잠그지 않는다 ═══ */
const 앱 = {
  home: 'pu-home.html', news: 'pu-news.html', govbid: 'gov.html', rehabad: 'rehab-ad.html', signboard: 'pu-signboard.html',
};

test('다섯 앱이 «재직(status active) + 사번(sid)»으로 연다', () => {
  Object.keys(앱).forEach((k) => {
    const h = read(앱[k]);
    assert.match(h, /status\s*===\s*'active'\s*&&\s*!{0,2}(?:r|v)\.sid/, 앱[k] + ' 가 재직·사번을 함께 안 본다');
  });
});

test('다섯 앱 어디에도 «관리자만» 잣대가 남지 않았다(isAdmin·isSubAdmin 판정)', () => {
  Object.keys(앱).forEach((k) => {
    const 코드 = read(앱[k]).replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(코드, /\.isAdmin\s*===?\s*true|\.isSubAdmin\s*===?\s*true|App\.isAdmin/, 앱[k] + ' 에 관리자 잣대가 남았다');
  });
});

test('앱 잠금 화면 글이 «대표 전용·총괄관리자만»이 아니다', () => {
  Object.keys(앱).forEach((k) => {
    const 코드 = read(앱[k]).replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.doesNotMatch(코드, /대표 전용 화면|대표 전용입니다|총괄관리자만 (쓸|할|올릴|넣을|누를|표시할|허락할)|총괄관리자에게만 열려|관리자·위임관리인이 아니거나/, 앱[k] + ' 에 옛 잠금 글이 남았다');
  });
});

/* ═══ ①② 규칙 — 재직 직원은 되고, 퇴직자·익명·남·로그인 안 함은 안 된다 ═══ */
const rules = JSON.parse(execFileSync(process.execPath, [path.join(R, 'scripts', 'make-firebase-rules.js')],
  { encoding: 'utf8', maxBuffer: 1e8 })).rules;
class Snap {
  constructor(v) { this.v = v; }
  child(p) { let c = this.v; for (const k of String(p).split('/')) c = c && typeof c === 'object' ? c[k] : undefined; return new Snap(c); }
  val() { return this.v === undefined ? null : this.v; }
  exists() { return this.v !== undefined && this.v !== null; }
}
const root = new Snap({ uid_roles: {
  staff: { status: 'active', sid: 'T-001' },
  retired: { status: 'resigned', sid: 'T-002' },
} });
const who = {
  재직직원: { uid: 'staff', token: { firebase: { sign_in_provider: 'password' } } },
  퇴직자: { uid: 'retired', token: { firebase: { sign_in_provider: 'password' } } },
  익명: { uid: 'staff', token: { firebase: { sign_in_provider: 'anonymous' } } },
  남: { uid: 'outsider', token: { firebase: { sign_in_provider: 'password' } } },
  로그인안함: null,
};
function ev(expr, auth, newData) {
  const f = Function('auth', 'root', 'data', 'newData', '$id', '$v', '"use strict"; return Boolean(' + expr + ');');
  return f(auth, root, new Snap(undefined), new Snap(newData === undefined ? { id: 'x' } : newData), 'x', 'x');
}
const 열린칸 = [
  ['homepage', '.read'], ['homepage', '.write'],
  ['newsletter', '.read'], ['newsletter', '.write'],
  ['ilabor', '.read'], ['gov_watch', '.read'], ['gov_feed', '.read'],
  ['rehab_ad', '.read'], ['rehab_ad/marks', '.write'],
  ['signboard', '.read'], ['signboard/ads/$id', '.write'], ['signboard/published', '.write'],
  ['signboard/history/$v', '.write'], ['signboard/control', '.write'], ['signboard/log/$id', '.write'],
];
const 칸 = (p) => p.split('/').reduce((o, k) => o && o[k], rules);

test('규칙 — 열린 칸마다 재직 직원은 되고, 퇴직자·익명·남·로그인 안 함은 안 된다', () => {
  열린칸.forEach(([p, k]) => {
    const expr = (칸(p) || {})[k];
    assert.equal(typeof expr, 'string', p + '/' + k + ' 규칙이 없다');
    assert.equal(ev(expr, who.재직직원), true, p + '/' + k + ' — 재직 직원이 막힌다');
    ['퇴직자', '익명', '남', '로그인안함'].forEach((n) =>
      assert.equal(ev(expr, who[n]), false, p + '/' + k + ' — ' + n + ' 이(가) 들어온다'));
  });
});

test('규칙 — 그래도 지키던 것은 그대로: 서버 전용 칸은 아무도 못 쓰고, 전광판은 지우기 금지', () => {
  assert.equal(rules.ilabor['.write'], false);
  assert.equal(rules.gov_watch['.write'], false);
  assert.equal(rules.gov_feed['.write'], false);
  assert.equal(rules.rehab_ad.notices['.write'], false);
  assert.equal(rules.rehab_ad.runs['.write'], false);
  assert.equal(rules.signboard.state['.write'], false);
  assert.equal(ev(rules.signboard.ads.$id['.write'], who.재직직원, null), false, '전광판 광고를 지울 수 있다');
});

test('규칙 — 정부사업신청의 개인 자리(gov/{uid})는 여전히 «본인만»이다(인증키가 있다)', () => {
  assert.match(rules.gov.$uid['.read'], /auth\.uid === \$uid/);
  assert.match(rules.gov.$uid['.write'], /auth\.uid === \$uid/);
});

/* ═══ ①② 서버 함수 — 관리자 확인을 걷고, 재직 직원 문(STAFF_GATE / requireStaff)을 지난다 ═══ */
const idx = read('functions/index.js');
const 덩이 = (name) => {
  /* 함수 몸 하나만 — onRequest 를 닫는 «\n  });» 까지(뒤에 붙은 다른 도우미를 섞지 않는다) */
  const m = new RegExp('exports\\.' + name + ' =[\\s\\S]*?\\n  \\}\\);').exec(idx);
  assert.ok(m, name + ' 함수가 없다');
  return m[0];
};
const 바꾼함수 = ['sendBulkMail', 'rehabAuto', 'rehabEnrich', 'readHomepage', 'homepageWrite',
  'homepageAuto', 'newsDocsPull', 'ilaborPull', 'publishSite'];

test('영업관리 다섯 앱이 부르는 서버 함수는 «총괄관리자만»으로 막지 않는다', () => {
  바꾼함수.forEach((n) => {
    const b = 덩이(n);
    assert.doesNotMatch(b, /isAdmin\s*!==\s*true/, n + ' 가 아직 총괄관리자만 받는다');
  });
});

test('그 함수들은 재직 직원 문을 지난다 — 모르면 막는다', () => {
  바꾼함수.forEach((n) => {
    const b = 덩이(n);
    assert.match(b, /STAFF_GATE\.assertActive\(decoded\.uid\)|requireStaff\(req\)/, n + ' 가 재직 직원인지 안 본다');
  });
  const gate = read('functions/staff-gate.js');
  assert.match(gate, /v\.status !== 'active'/, '공용 문이 재직 여부를 안 본다');
});
