/* 로그아웃 화면 — 푸른 통합 안의 «모든» 프로그램이 같은 화면을 쓴다
   (대표 지시 2026-08-28 「같은 화면으로」 · 2026-09-14 「모두 캡쳐1의 모습으로 변경해달라. 찾아서」)

   ★ 2026-09-14 실측으로 훑어 보니 네 갈래였다
     ㉠ 자물쇠 화면(경력관리·취업규칙)        ← 대표가 «이것»으로 정하셨다
     ㉡ 카드 화면(업무관리·기금관리·급여데이터함·홈페이지관리·뉴스레터)
     ㉢ 제각각 글귀(정부사업신청·기업정보함)
     ㉣ 아무것도 없거나 포털로 그냥 튕김(사진첩·취업규칙관리·문서관리·급여관리·푸른이알피)
   ㉣ 가 특히 나쁘다 — 포털로 튕기면 «로그인 창»이 뜨는데, 대표는 자기가 무엇을
   누르다 그리로 갔는지 알 수가 없다. 그 길을 없애고 모두 ㉠ 으로 맞췄다.

   ★★ 이 검사가 앞선 판과 «다른» 점
     앞판은 쓰는 프로그램을 손으로 적어 두었다(다섯 개). 그래서 나머지 열 개가
     빠진 줄 아무도 몰랐다 — 검사는 내내 초록이었다.
     이제 목록을 enter.html 의 APPS 에서 «읽어» 온다. 포털에 새 앱을 넣는 순간
     이 검사가 그 앱을 함께 본다. 손으로 적는 목록은 늘 낡는다. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const gate = fs.readFileSync(path.join(ROOT, 'js', 'pu-gate.js'), 'utf8').split('\r\n').join('\n');
const enter = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');

let fail = 0, total = 0;
function ok(name, cond, hint) {
  total++;
  if (cond) { console.log('ok   ' + name); return; }
  fail++;
  console.log('FAIL ' + name + (hint ? '\n     → ' + hint : ''));
}

/* ── 포털에 등록된 프로그램을 «읽어» 온다 ───────────────────────────── */
const APPS_AT = enter.indexOf('var APPS = [');
const APPS_SRC = APPS_AT > 0 ? enter.slice(APPS_AT, enter.indexOf('\n  ];', APPS_AT)) : '';
const 앱파일 = [];
(APPS_SRC.match(/url:\s*'([^']+)'/g) || []).forEach(function (m) {
  const f = m.replace(/.*'([^']+)'.*/, '$1').split('?')[0];
  if (f && 앱파일.indexOf(f) < 0) 앱파일.push(f);
});

/* ⚠★ 한 곳만 빼 둔다 — 까닭을 적는다. 까닭 없는 예외는 구멍이다.
   정부사업일정은 포털과 «다른 계정»을 쓴다(p_session · 제 아이디/비밀번호 ·
   5회 실패 30초 잠금 · 제 비밀번호 변경). 포털로 보내면 로그인해도 이 앱에는
   못 들어간다 — 고치려면 계정을 먼저 합쳐야 한다(대표 판단 대기, 2026-09-14). */
const 아직 = { 'gov-consulting.html': '포털과 다른 자체 계정(p_session)을 쓴다 — 계정 합치기가 먼저다' };

/* 넣으면 «안 되는» 화면 */
const NEVER = {
  'enter.html': '통합 포털 — 여기가 로그인하는 곳이다',
  'sign.html': '고객이 여는 화면 — 우리 포털 계정이 없다',
  'ieum-view.html': '근로자가 여는 화면 — 우리 포털 계정이 없다'
};

console.log('[① 공용 화면이 «캡쳐1» 모양이다]');
ok('포털에서 앱 목록을 읽었다 (' + 앱파일.length + '개)', 앱파일.length >= 10,
   'enter.html 의 var APPS 를 못 읽으면 아래 검사가 통째로 헛돈다');
ok('자물쇠가 있다', /🔒/.test(gate));
ok('제목이 「통합시스템 로그인이 필요합니다」', /통합시스템 로그인이 필요합니다/.test(gate));
ok('왜 막혔는지 알려 준다', /로그아웃되었거나 세션이 만료되었습니다/.test(gate),
   '까닭을 안 적으면 고장인지 로그아웃인지 모른다');
ok('포털로 가는 단추가 있다', /통합시스템으로 이동/.test(gate));
ok('PuGate.show / hide 가 있다', /show: function/.test(gate) && /hide: function \(\)/.test(gate));
ok('넣는 글자를 막는다', /replace\(\/"\/g, '&quot;'\)/.test(gate));

console.log('\n[⑥ 부르는 화면의 CSS 에 기대지 않는다]');
ok('box-sizing 을 스스로 못 박는다', /box-sizing:border-box/.test(gate),
   '안 박으면 초기화 없는 화면에서 칸이 제 폭보다 커진다 — 재 보고 잡았다');
ok('글꼴도 스스로 정한다', /font-family:"Noto Sans KR"/.test(gate));
ok('맨 위에 뜬다', /z-index:2147483600/.test(gate), '다른 창 밑에 깔리면 안 보인다');
ok('처음 뜨는 splash 를 치운다', /pu-boot-splash/.test(gate), '겹치면 둘 다 안 보인다');

console.log('\n[② 포털의 «모든» 프로그램이 싣고 부른다]');
앱파일.forEach(function (f) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { ok(f.padEnd(22) + ' 파일이 있다', false, 'enter.html 이 없는 파일을 가리킨다'); return; }
  if (아직[f]) { console.log('skip ' + f.padEnd(22) + ' — ' + 아직[f]); return; }
  const s = fs.readFileSync(p, 'utf8');
  ok(f.padEnd(22) + ' 공용 파일을 싣는다', /<script src="js\/pu-gate\.js/.test(s),
     '안 실으면 PuGate 가 없어 그 자리에서 죽는다');
  ok(f.padEnd(22) + ' 공용 화면을 부른다', /PuGate\.show\(/.test(s),
     '싣기만 하고 안 부르면 로그아웃 때 아무것도 안 뜬다');
});

console.log('\n[④ 제 사본이 안 남아 있다]');
앱파일.concat(['chwieop.html']).forEach(function (f) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p) || 아직[f]) return;
  const s = fs.readFileSync(p, 'utf8');
  /* ⚠ 사본이 남으면 한쪽만 고쳐져 또 갈라진다 — 실제로 취업규칙본에는
     「로그아웃되었거나 세션이 만료되었습니다」 한 줄이 빠져 있었다. */
  ok(f.padEnd(22) + ' 제 자물쇠 화면이 없다',
     s.indexOf('통합시스템 로그인이 필요합니다</div>') < 0,
     '공용 화면을 두고 제 사본을 또 그리면 두 화면이 갈라진다');
});

console.log('\n[⑤ 로그아웃 때 포털로 «튕기지» 않는다]');
앱파일.forEach(function (f) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p) || 아직[f]) return;
  const s = fs.readFileSync(p, 'utf8').split('\r\n').join('\n');
  /* 로그아웃을 «누른» 뒤 포털로 보내는 것은 옳다. 막는 것은 «세션이 없어서»
     말없이 튕기는 길이다 — 그 자리에는 자물쇠 화면이 서야 한다. */
  const 튕김 = /location\.replace\('enter\.html\?v=' \+ Math\.floor\(Date\.now\(\)/.test(s)
            || /if \(!u \|\| !u\.email\) \{ location\.href = 'enter\.html'/.test(s);
  ok(f.padEnd(22) + ' 말없이 안 튕긴다', !튕김,
     '튕기면 로그인 창이 뜨는데, 무엇을 누르다 그리로 갔는지 알 수가 없다');
});

console.log('\n[③ 넣으면 안 되는 화면]');
Object.keys(NEVER).forEach(function (f) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) return;
  const s = fs.readFileSync(p, 'utf8');
  ok(f.padEnd(22) + ' 에는 안 넣는다', s.indexOf('PuGate.show(') < 0, NEVER[f]);
});

console.log('\n  === ' + (total - fail) + ' 통과 / ' + fail + ' 실패 ===');
process.exit(fail ? 1 : 0);
