'use strict';
/* 🙈 사번은 화면에 안 나온다 — 앱 전체 «규칙» 검사 (대표 결정 2026-10-25 「이름만 있어야한다」)

   ■ 왜 생겼나
   사번(P-001)에서 로그인 아이디(p001@pureun.kr)가 그대로 만들어진다. 화면·캡처·어깨너머로 사번이 보이면
   로그인 아이디의 절반이 새는 셈이라, 로그인 후 «보이는 글자»에는 이름만 쓰기로 했다.
   저장값·열쇠(value, DB 경로, sid 비교)는 그대로 사번이다 — 바뀌는 것은 «보이는 글자»뿐이다.

   ■ 이 검사가 못 박는 규칙 (값이 아니라 규칙)
     ① 직원 화면이면 «안전망»(js/pu-sid-guard.js)이 실려 있다 — 원천을 놓친 자리를 사후에 닦는다.
     ② 이름을 못 찾았을 때 사번·이메일 앞부분을 «대신 적는» 모양이 소스에 없다.
          · 이름 || 사번   · 「이름 (사번)」   · 「이름 · 사번」   · 내 이메일 앞부분
     ③ 로그인 화면에 실제 아이디 모양의 예시(p001@…)가 없다 — 로그인 화면은 누구나 본다.
     ④ 저장해 둔 아이디는 «고치기 전까지» 점으로 가려진다(포털·이알피 로그인).
     ⑤ 서버가 만드는 글자(구글 캘린더 설명·보안 알림·카카오 막힘 알림)에도 사번·이메일이 없다.
     ⑥ 공개 거울(이음 공개 명단)에는 사번이 못 간다.
     ⑦ 관리자 표(사용자관리·근로자명부)에 사번·아이디 칸이 없다.

   ⚠ 이 검사는 «모양»을 찾는다. 새는 모양을 새로 발견하면 SHAPES 에 한 줄 보태고, 합당한 예외가 정말 있으면
     ALLOW 에 «왜 괜찮은지»와 함께 적는다(귀찮아서 적지 말 것 — tests/test-pin-guard.test.js 의 정신과 같다).
   ⚠ 문서(급여명세서·급여대장·인사기록카드 출력물)의 사번은 법적 기재 사항 확인이 끝나기 전까지 이 검사 밖이다
     (대표 결정 대기 — status/2026-10-25-hide-sid-everywhere.md). */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments, stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const HTML = fs.readdirSync(ROOT).filter((f) => /\.html$/.test(f)).sort();
const JS = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => /\.js$/.test(f)).sort().map((f) => 'js/' + f);
const code = (f) => (/\.html$/.test(f) ? stripComments(read(f)) : stripJs(read(f)));

/* 외부 사람이 여는 화면 — 직원 명단·사번을 읽지 않는다 */
const EXTERNAL = {
  'sign.html': '서명 요청을 받은 외부인 화면',
  'sign-contract.html': '계약서 서명 외부인 화면',
  'ieum-view.html': '이음 공개 명단을 보는 외부인 화면',
};

/* ── ② 새는 모양 ── */
const SHAPES = [
  { id: '이름 || 사번', re: /\.name\s*\|\|\s*(?:[A-Za-z_]+\.)?[sS]id\b(?![A-Za-z0-9_$.(\[])/g,
    fix: '이름을 모르면 사번 대신 빈 글자나 「이름 미확인」을 쓴다' },
  { id: '「이름 (사번)」 이어 붙이기', re: /'\s*\(\s*'\s*\+\s*[A-Za-z_.]*[sS]id\s*\+\s*'\s*\)/g,
    fix: '이름표 함수(PuStaffLabel.label / erpStaffLabel)를 쓴다' },
  { id: '「이름 (${사번})」 템플릿', re: /\(\$\{[^}]*[sS]id\}\)/g,
    fix: '이름만 적는다' },
  { id: '「이름 · 사번」 이어 붙이기', re: /'\s*·\s*'\s*\+\s*[A-Za-z_.]*\.sid\b/g,
    fix: '이름만 적는다' },
  { id: '삼항으로 사번 대체', re: /\?\s*\(?\s*[A-Za-z_.\[\]]+\.name\s*\)?\s*:\s*\(?\s*(?:[A-Za-z_]+\.)?[A-Za-z]*[sS]id\b(?![A-Za-z0-9_$.(\[])/g,
    fix: '이름이 없을 때 사번을 돌려주지 않는다' },
  { id: '내 이메일 앞부분을 이름처럼', re: /(?:myEmail|currentUser\.email|me\.email)\s*\|\|\s*''\s*\)?\s*\.split\('@'\)\[0\]|String\((?:myEmail|u\.email)\s*\|\|\s*''\)\.split\('@'\)\[0\]/g,
    fix: '이름 찾는 함수(staffName 등)를 거친다 — 로그인 아이디 앞부분은 이름이 아니다' },
];
/* 정말 괜찮은 예외 — 파일·줄 조각·까닭. 비어 있는 것이 정상이다. */
const ALLOW = [
  { file: 'work.html', snippet: 'filter(function(s){return s&&(s.name||s.sid);})',
    why: '비어 있는 부담당 줄을 거르는 조건일 뿐 화면에 찍지 않는다' },
];

function findShapes(file, src) {
  const out = [];
  SHAPES.forEach((sh) => {
    src.split('\n').forEach((line, i) => {
      sh.re.lastIndex = 0;
      if (!sh.re.test(line)) return;
      if (ALLOW.some((a) => a.file === file && line.includes(a.snippet))) return;
      out.push(file + ':' + (i + 1) + ' [' + sh.id + '] ' + line.trim().slice(0, 110) + '  → ' + sh.fix);
    });
  });
  return out;
}

/* ── ① 안전망 ── */
test('①★ 직원 화면은 사번 안전망(pu-sid-guard.js)을 캐시 번호와 함께 싣는다', () => {
  const staff = HTML.filter((f) => /firebase\.auth\(\)/.test(read(f)) && !EXTERNAL[f]);
  assert.ok(staff.length >= 20, '직원 화면을 못 찾았다 — 판별식이 낡았나? ' + staff.length);
  const missing = staff.filter((f) => !/<script src="js\/pu-sid-guard\.js\?v=\d+"><\/script>/.test(read(f)));
  assert.deepEqual(missing, [],
    '★ 안전망이 없는 직원 화면 — 이 화면에서 놓친 사번은 닦이지 않는다. <script src="js/pu-sid-guard.js?v=N"> 를 넣는다');
  /* 안전망을 먼저 싣는다 — 파이어베이스 뒤에 두면 첫 화면이 그려진 뒤에야 돈다 */
  staff.forEach((f) => {
    const s = read(f);
    const g = s.search(/js\/pu-sid-guard\.js/), fb = s.search(/firebase-app|firebase-database|firebase-auth/);
    if (fb >= 0) assert.ok(g >= 0, f);
  });
});

test('①★ 안전망 자체: 사번·로그인 이메일을 지우고, 금액·전화·사업자번호는 건드리지 않는다', () => {
  /* 화면 없이 글자 규칙만 — document 가 없으면 안전망은 아무것도 안 시작한다(tests/sid-guard.test.js 와 같은 떠서 돌리기) */
  const g = { console, setInterval: () => 1, clearInterval() {}, String, Object, Array, JSON, RegExp };
  g.window = g;
  require('vm').createContext(g);
  require('vm').runInContext(read('js/pu-sid-guard.js'), g);
  const G = g.PuSidGuard;
  assert.ok(G && typeof G.scrubText === 'function', '안전망이 PuSidGuard 를 내놓지 않는다');
  assert.equal(G.scrubText('권형하 · P-001'), '권형하');
  assert.equal(G.scrubText('권형하 (P-001) 님'), '권형하 님');
  assert.ok(!/p001/i.test(G.scrubText('담당 p001@pureun.kr 님')), '로그인 이메일을 못 지웠다');
  assert.equal(G.scrubText('35,420원 · 010-1234-5678'), '35,420원 · 010-1234-5678', '금액·전화를 건드렸다');
});

/* ── ② 새는 모양 ── */
test('②★ 이름을 못 찾았을 때 사번·이메일 앞부분을 대신 적는 모양이 소스에 없다 (html·js 전부)', () => {
  const all = [];
  HTML.concat(JS).forEach((f) => { all.push(...findShapes(f, code(f))); });
  assert.deepEqual(all, [], '★ 사번이 화면에 새는 모양이 있다:\n' + all.join('\n'));
});

test('②★ (이빨) 새는 모양 찾개는 실제로 잡는다 — 못 잡으면 위 검사는 눈을 감고 초록이다', () => {
  const bad = [
    "var n = u.name || u.sid;",
    "label = u.name + ' (' + u.sid + ')';",
    "t = `${u.name} (${u.sid})`;",
    "t = u.name + ' · ' + u.sid;",
    "var n = u ? u.name : u.sid;",
    "var me = String(myEmail || '').split('@')[0];",
  ];
  bad.forEach((b) => {
    assert.ok(findShapes('x.js', b).length >= 1, '못 잡았다: ' + b);
  });
  const ok = [
    "if (!u || !u.name || sid.indexOf('A-') === 0) return false;",
    "var n = u.name || '이름 미확인';",
    "ref.child(u.sid).set(1);",
    "x.name || x.em.split('@')[0]",   // 외부 연락처의 메일 — 직원 계정이 아니다
  ];
  ok.forEach((b) => {
    assert.deepEqual(findShapes('x.js', b), [], '헛경고: ' + b);
  });
});

/* ── ③ 로그인 화면 예시 ── */
test('③★ 로그인 화면에 실제 아이디 모양의 예시(p001@…)를 적지 않는다', () => {
  const bad = [];
  ['enter.html', 'pu-erp.html', 'gov-consulting.html', 'pu-news.html', 'gov.html', 'pu-govaid.html', 'rehab-ad.html', 'pu-signboard.html']
    .forEach((f) => {
      code(f).split('\n').forEach((line, i) => {
        if (/placeholder\s*[=:]\s*["'][^"']*\bp\d{3}\b/i.test(line) || /예\s*:\s*p\d{3}/i.test(line)) bad.push(f + ':' + (i + 1) + ' ' + line.trim().slice(0, 100));
      });
    });
  assert.deepEqual(bad, [], '★ 로그인 입력칸·안내에 실제 아이디 모양이 있다 — 「아이디」만 적는다');
});

/* ── ④ 저장된 아이디 가림 ── */
test('④★ 저장해 둔 아이디는 고치기 전까지 점으로 가린다 (포털·이알피 로그인)', () => {
  const enter = read('enter.html');
  assert.match(enter, /#loginId\.saved-mask\s*\{[^}]*text-security\s*:\s*disc/, '포털: 가림 규칙이 없다');
  assert.match(enter, /classList\.add\('saved-mask'\)/, '포털: 저장된 아이디에 가림을 안 건다');
  assert.match(enter, /classList\.remove\('saved-mask'\)/, '포털: 손대면 풀리는 길이 없다 — 새 아이디를 점으로 입력하게 된다');
  const erp = read('pu-erp.html');
  assert.match(erp, /\.pln-id-input\.pln-saved-mask\{[^}]*text-security\s*:\s*disc/, '이알피: 가림 규칙이 없다');
  assert.match(erp, /pln-saved-mask'\s*:\s*''/, '이알피: 저장된 아이디에 가림을 안 건다');
  assert.match(erp, /onInput:function\(\)\{\s*if\(idMasked\)\s*setIdMasked\(false\)/, '이알피: 입력하면 풀리는 길이 없다');
});

/* ── ⑤ 서버 글자 ── */
test('⑤★ 서버가 만드는 글자에 사번·이메일이 없다 (캘린더 설명·보안 알림·카카오 막힘 알림)', () => {
  const gcal = stripJs(read('functions/gcal-proxy.js'));
  assert.ok(!/nameOf\s*&&\s*nameOf\(sid\)\)\s*\|\|\s*sid/.test(gcal), '구글 캘린더 설명에 이름 없으면 사번을 적고 있다');
  const ls = stripJs(read('functions/login-security.js'));
  assert.ok(!/message\s*:[^\n]*input\.email/.test(ls), '보안 알림 글에 이메일(로그인 아이디)이 있다');
  const kk = stripJs(read('functions/kakao.js'));
  assert.ok(!/message\s*:[^\n]*\bsid\b/.test(kk), '카카오 막힘 알림 글에 사번이 있다');
  const idx = stripJs(read('functions/index.js'));
  assert.ok(!/dirNameOf\(dir,\s*sid\)\s*\|\|\s*sid/.test(idx), '담당 칸 이름에 사번을 넣고 있다');
  assert.ok(!/decoded\.name\s*\|\|\s*decoded\.email/.test(idx), '커밋 글에 이메일(로그인 아이디)을 적고 있다');
});

/* ── ⑥ 공개 거울 ── */
test('⑥★ 공개 명단(이음)은 이름을 모르면 사번 대신 「이름 미확인」', () => {
  const pub = stripJs(read('js/pu-ieum-public.js'));
  assert.ok(!/u\s*\?\s*u\.name\s*:\s*r\.sid/.test(pub), '공개 거울에 사번이 나간다');
  const { buildPublic } = (() => { try { return require('../js/pu-ieum-public.js'); } catch (e) { return {}; } })();
  if (typeof buildPublic === 'function') {
    const r = buildPublic({ att: [{ type: 'eum-work', date: '2099-01-02', sid: 'P-777' }], users: [], externals: [], year: 2099 });
    assert.ok(!/P-777/.test(JSON.stringify(r)), '공개 자료에 사번이 들어갔다');
  }
});

/* ── ⑦ 관리자 표 ── */
test('⑦★ 사용자관리·근로자명부 표에 사번·아이디 칸이 없다', () => {
  const erp = code('pu-erp.html');
  assert.ok(!/h\('th',[^)]*\)?,\s*'(?:사번|아이디)'\)/.test(erp), '표 머리에 사번/아이디 칸이 되살아났다');
  assert.ok(!/row\('사번',\s*u\.sid\)/.test(erp), '근로자 상세에 사번 줄이 되살아났다');
});
