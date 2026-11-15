'use strict';
/* 서비스워커 «자리 다툼» 막기 — scope 를 좁히지 않은 일꾼 등록은 어느 화면이든 pu-sw.js 하나 (2026-11-15)

   ■ 무슨 일이 있었나
   서비스워커는 한 scope 에 하나만 산다. /pureunall/ 의 앱들은 통합 일꾼 pu-sw.js 를 «함께»
   등록하기로 약속했는데(pu-sw.js 머리말), 이알피(pu-erp.html)만 자기 일꾼 pu-erp-sw.js 를
   같은 자리에 등록하고 있었다. 나중에 연 앱의 일꾼이 앞의 것을 밀어내므로 —
     · 이알피를 연 뒤   → 기업정보함·사진첩·급여데이터함·문서뷰어의 폰 «공유 받기»가 죽고
     · 다른 앱을 연 뒤  → 이알피 공유가 죽었다.
   지키던 검사(portal-install-app 의 rootWorkersOf)는 포털·설치·기업정보함 «세 화면»만 보아
   이알피를 몰랐다. 2026-11-15 푸른캘린더 공유(PR #3079)를 만들다 발견했다.

   ■ 이 검사가 못 박는 규칙 — 지금 파일 목록이 아니라
     ① 저장소의 모든 html·js 에서 일꾼 등록을 «하나도 빠짐없이» 읽는다. 못 읽는 꼴이면 실패한다
        (못 읽고 넘어가면 그 등록은 아무도 안 지킨다).
     ② scope 가 앱 뿌리(/pureunall/)를 덮는 등록 — scope 를 안 주었거나 './' 처럼 뿌리를 준 것 —
        은 모두 pu-sw.js 다. 좁힌 등록(웹푸시 /push/ · 캘린더 /cal-share/)은 «더 긴 주소가 이긴다»
        규칙으로 따로 살아 다툼이 없으므로 예외다.
     ③ 공유를 받는 앱(manifest 의 share_target)마다, 그 주소를 맡게 될 일꾼을 vm 으로 켜고 공유
        POST 를 보내 보면 «받는다». 한 자리에 서로 다른 일꾼이 등록돼 있으면 어느 쪽이 살아남든
        받아야 하므로 «모두» 돌려 본다 — 이알피 일꾼이 따로 있던 때는 여기서 바로 걸린다.

   ⚠ 이 검사는 «등록 줄»을 본다. 일꾼 파일 자체(pu-erp-sw.js 같은 옛 껍데기)가 남아 있는 것은
     괜찮다 — 이미 그 일꾼이 깔린 폰을 위해 남긴다(pu-erp-sw.js 머리말 · erp-share-target 검사). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { 일꾼켜기, 공유요청, 사진, 보내기 } = require('./lib-sw-boot');

const R = path.join(__dirname, '..');
const 뿌리 = 'https://x.io/pureunall/';          // 배포 자리(깃허브 페이지의 /pureunall/)
const 통합일꾼 = new URL('pu-sw.js', 뿌리).href;

/* ── 훑을 파일 ──
   ⚠ `git ls-files` 는 한글 이름을 따옴표로 감싸 내놓는다 — 끄고 읽는다(no-real-client-data 와 같은 까닭).
   검사·남의 참고본·작업 사본(.claude/worktrees)은 화면이 아니므로 뺀다.
   ⚠ 아직 git add 안 한 새 화면도 본다(--others) — 내 컴퓨터에서 먼저 걸려야 한다. */
function 훑을파일() {
  return execSync('git -c core.quotepath=false ls-files --cached --others --exclude-standard', { cwd: R, encoding: 'utf8', maxBuffer: 1 << 28 })
    .split(/\r?\n/).filter(Boolean)
    .filter((f) => /\.(html|js|mjs)$/.test(f))
    .filter((f) => !/^(tests|node_modules|reference|\.claude)\//.test(f));
}

/* ── 한 파일의 일꾼 등록을 모두 읽는다 ──
   돌려주는 것: [{ 파일, 일꾼(주소), scope(주소), 좁힘(scope 를 주었나) }] 와 못 읽은 자리.
   ⚠ 상대 주소는 «그 화면» 기준으로 풀린다. html 은 제 폴더, js 는 그것을 싣는 화면(최상위)이 기준이다. */
const 부름 = /serviceWorker\s*\.\s*register\s*\(/g;
const 꼴 = /^serviceWorker\s*\.\s*register\s*\(\s*(['"])([^'"]+)\1\s*(?:,\s*\{\s*scope\s*:\s*(?:(['"])([^'"]*)\3|([A-Za-z_$][\w$]*))\s*\}\s*)?\)/;

function 등록읽기(src, 파일) {
  const 기준 = new URL(/\.html$/.test(파일) ? path.posix.dirname(파일) + '/' : './', 뿌리).href;
  const 읽은것 = [], 못읽음 = [];
  let m;
  부름.lastIndex = 0;
  /* ⚠ 다른 이름으로 부른 등록(const sw = navigator.serviceWorker; sw.register(…) · navigator['serviceWorker'])은
     위 꼴에 안 걸려 «조용히» 빠진다 — serviceWorker 가 든 파일의 .register( 수가 읽은 수보다 많으면 못 읽은 것으로 센다.
     (2026-11-15 지금 그런 파일에는 일꾼 등록 말고 다른 .register( 가 없다. 생기면 아래 문구대로 이 검사를 넓힌다) */
  if (/serviceWorker/.test(src)) {
    const 모든부름 = (src.match(/\.register\s*\(/g) || []).length;
    const 일꾼부름 = (src.match(부름) || []).length;
    if (모든부름 > 일꾼부름) 못읽음.push(파일 + ' (serviceWorker 를 다른 이름으로 불러 등록한 듯한 .register( ' + (모든부름 - 일꾼부름) + '곳)');
  }
  while ((m = 부름.exec(src))) {
    const 줄 = src.slice(0, m.index).split('\n').length;
    const k = 꼴.exec(src.slice(m.index));
    if (!k) { 못읽음.push(파일 + ':' + 줄); continue; }
    const 일꾼 = new URL(k[2], 기준).href;
    let scope = null;
    if (k[3]) scope = k[4];
    else if (k[5]) {
      const 값 = new RegExp('(?:var|let|const)\\s+' + k[5] + '\\s*=\\s*([\'"])([^\'"]*)\\1').exec(src);
      if (!값) { 못읽음.push(파일 + ':' + 줄 + ' (scope 변수 ' + k[5] + ' 의 값을 못 찾음)'); continue; }
      scope = 값[2];
    }
    읽은것.push({
      파일: 파일 + ':' + 줄,
      일꾼: 일꾼,
      scope: scope === null ? new URL('./', 일꾼).href : new URL(scope, 기준).href,
      좁힘: scope !== null
    });
  }
  return { 읽은것, 못읽음 };
}

/* scope 가 앱 뿌리를 덮는가 — 뿌리 주소가 scope 로 «시작»하면 뿌리 아래 모든 화면을 잡는다 */
function 뿌리를덮나(r) { return 뿌리.startsWith(r.scope); }

function 규칙어긴것(등록들) {
  return 등록들.filter((r) => 뿌리를덮나(r) && r.일꾼 !== 통합일꾼);
}

const 모두 = (function () {
  const 읽은것 = [], 못읽음 = [];
  for (const f of 훑을파일()) {
    const src = fs.readFileSync(path.join(R, f), 'utf8');
    if (!/serviceWorker/.test(src)) continue;
    const r = 등록읽기(src, f);
    읽은것.push(...r.읽은것);
    못읽음.push(...r.못읽음);
  }
  return { 읽은것, 못읽음 };
})();

/* ══════ ① 하나도 빠짐없이 읽는다 ══════ */

test('① 저장소의 일꾼 등록을 모두 읽는다 — 못 읽는 꼴이 있으면 그 등록은 아무도 안 지킨다', () => {
  assert.deepEqual(모두.못읽음, [],
    '★ 이 자리의 serviceWorker.register 를 못 읽었습니다: ' + 모두.못읽음.join(' · ') + '\n' +
    "  일꾼 주소는 글자 그대로('pu-sw.js'), scope 는 { scope: '...' } 이나 같은 파일의 var 상수로 주세요.\n" +
    '  꼴을 새로 써야 한다면 이 검사의 «꼴» 정규식을 함께 넓혀 주세요.');
  assert.ok(모두.읽은것.length >= 2, '등록을 거의 못 찾았습니다 — 훑는 범위가 틀어졌나요? (' + 모두.읽은것.length + '곳)');
});

/* ══════ ② 뿌리를 덮는 등록은 모두 같은 파일 ══════ */

test('★ ② scope 를 좁히지 않은 등록은 어느 화면이든 통합 일꾼(pu-sw.js)이다', () => {
  const 뿌리등록 = 모두.읽은것.filter(뿌리를덮나);
  assert.ok(뿌리등록.length >= 2, '뿌리 자리 등록이 거의 없습니다 — 읽기가 틀어졌나요?');
  const 어긴것 = 규칙어긴것(모두.읽은것);
  assert.deepEqual(어긴것.map((r) => r.파일 + ' → ' + r.일꾼), [],
    '★ /pureunall/ 전체를 잡는 자리에 통합 일꾼이 아닌 것을 등록합니다.\n' +
    '  서비스워커는 한 scope 에 하나만 삽니다 — 나중에 연 앱이 앞의 것을 밀어내\n' +
    '  다른 앱들의 폰 «공유 받기»가 죽습니다(2026-11-15 이알피가 그랬다).\n' +
    '  고치는 길: 그 앱의 몫을 pu-sw.js 의 fetch 갈래로 옮기고 pu-sw.js 를 등록하거나,\n' +
    "  받는 주소가 따로 있으면 { scope: './그-폴더/' } 로 좁혀 등록하세요(푸른캘린더처럼).");
});

test('② 좁힌 등록은 정말 «뿌리보다 깊은» 자리다 — 좁힌 척 뿌리를 주면 같은 다툼이다', () => {
  const 좁힌것 = 모두.읽은것.filter((r) => r.좁힘);
  assert.ok(좁힌것.length >= 1, '좁힌 등록(웹푸시 등)을 하나도 못 읽었습니다 — scope 읽기가 틀어졌나요?');
  좁힌것.forEach((r) => {
    if (r.일꾼 === 통합일꾼) return;
    assert.ok(r.scope.startsWith(뿌리) && r.scope.length > 뿌리.length,
      '★ ' + r.파일 + ' 이 scope 를 ' + r.scope + ' 로 줍니다 — 뿌리와 같거나 더 넓으면 통합 일꾼과 다툽니다.');
  });
});

test('② 이 검사의 «잣대»가 진짜로 잡는다 — 일부러 틀린 등록을 넣어 본다', () => {
  /* 잣대가 헛돌면 위 검사도 헛돈다(되풀이된 실수 ②). 고장을 넣어 «걸리는지» 본다. */
  const 어김 = (src, f) => 규칙어긴것(등록읽기(src, f || 'x.html').읽은것).length;
  const 못읽음 = (src) => 등록읽기(src, 'x.html').못읽음.length;
  assert.equal(어김("navigator.serviceWorker.register('pu-erp-sw.js')"), 1, '옛 이알피 꼴을 못 잡습니다');
  assert.equal(어김("navigator.serviceWorker.register('x-sw.js', { scope: './' })"), 1, "scope './' 를 좁힌 것으로 봅니다");
  assert.equal(어김("var S = './';\nnavigator.serviceWorker.register('x-sw.js', { scope: S })"), 1, '상수로 준 뿌리 scope 를 못 잡습니다');
  assert.equal(어김("navigator.serviceWorker\n  .register('/pureunall/x-sw.js')"), 1, '줄을 나눈 등록을 못 잡습니다');
  assert.equal(어김("navigator.serviceWorker.register('pu-sw.js')"), 0, '통합 일꾼을 어긴 것으로 봅니다');
  assert.equal(어김("navigator.serviceWorker.register('/pureunall/pu-sw.js')"), 0, '절대 주소로 쓴 통합 일꾼을 어긴 것으로 봅니다');
  assert.equal(어김("navigator.serviceWorker.register('pu-cal-share-sw.js', { scope: './cal-share/' })"), 0, '좁힌 등록을 어긴 것으로 봅니다');
  assert.equal(어김("var P = 'push/';\nnavigator.serviceWorker.register('firebase-messaging-sw.js', { scope: P })"), 0, '상수로 좁힌 등록을 어긴 것으로 봅니다');
  /* 하위 폴더 화면은 제 폴더 기준으로 풀린다 — 그 폴더 일꾼은 기본 scope 가 그 폴더라 뿌리를 안 덮는다 */
  assert.equal(어김("navigator.serviceWorker.register('a-sw.js')", 'sub/page.html'), 0, '하위 폴더 등록을 뿌리로 봅니다');
  assert.equal(못읽음('navigator.serviceWorker.register(swUrl)'), 1, '변수로 준 일꾼 주소를 «읽었다»고 넘어갑니다');
  assert.equal(못읽음("navigator.serviceWorker.register('x.js', { scope: NOPE })"), 1, '값을 모르는 scope 상수를 «읽었다»고 넘어갑니다');
  assert.equal(못읽음("const sw = navigator.serviceWorker;\nsw.register('x-sw.js')"), 1, '다른 이름으로 부른 등록이 조용히 빠집니다');
  assert.equal(못읽음("navigator['serviceWorker'].register('x-sw.js')"), 1, "navigator['serviceWorker'] 꼴의 등록이 조용히 빠집니다");
  assert.equal(못읽음("navigator.serviceWorker.register('pu-sw.js')"), 0, '옳은 등록을 못 읽었다고 합니다');
});

/* ══════ ③ 공유 받는 앱마다, 그 주소를 맡는 일꾼이 실제로 받는다 ══════ */

const 공유앱들 = fs.readdirSync(R)
  .filter((f) => /manifest.*\.json$/.test(f))
  .map((f) => ({ f, mf: JSON.parse(fs.readFileSync(path.join(R, f), 'utf8')) }))
  .filter((x) => x.mf.share_target);

/* 그 주소를 «맡게 될» 일꾼들 — 주소를 덮는 scope 가운데 가장 긴 것(브라우저 규칙)에 등록된 일꾼 전부 */
function 맡는일꾼들(받는주소) {
  const 덮는것 = 모두.읽은것.filter((r) => 받는주소.startsWith(r.scope));
  if (!덮는것.length) return [];
  const 가장긴 = Math.max(...덮는것.map((r) => r.scope.length));
  return [...new Set(덮는것.filter((r) => r.scope.length === 가장긴).map((r) => r.일꾼))];
}

test('③ 공유 받는 앱을 찾았다 — 못 찾으면 아래 검사가 헛돈다', () => {
  assert.ok(공유앱들.length >= 2, 'share_target 이 있는 manifest 를 거의 못 찾았습니다(' + 공유앱들.length + ')');
});

for (const { f, mf } of 공유앱들) {
  test('★ ③ ' + f + ' 의 공유 POST 를, 그 주소를 맡는 일꾼이 실제로 받는다', async () => {
    const st = mf.share_target;
    const 받는주소 = new URL(st.action, new URL(f, 뿌리)).href;
    const 칸 = st.params && st.params.files && st.params.files[0] && st.params.files[0].name;
    assert.ok(칸, f + ' 의 share_target 에 파일 칸 이름이 없습니다 — 사진을 못 받습니다');
    const 일꾼들 = 맡는일꾼들(받는주소);
    assert.ok(일꾼들.length, '★ ' + 받는주소 + ' 를 맡는 일꾼 등록이 없습니다 — 공유 POST 가 서버(깃허브)로 가 오류가 납니다');
    for (const 일꾼 of 일꾼들) {
      assert.ok(일꾼.startsWith(뿌리), '저장소 밖 일꾼입니다: ' + 일꾼);
      const 파일 = 일꾼.slice(뿌리.length);
      const w = 일꾼켜기(파일, 일꾼);
      const res = await 보내기(w.handlers, 공유요청(받는주소, 칸, [사진('명함.jpg')]));
      assert.ok(res, '★ ' + 파일 + ' 이 ' + 받는주소 + ' 로 온 공유를 안 받습니다.\n' +
        (일꾼들.length > 1 ? '  이 자리에 일꾼이 ' + 일꾼들.length + '개 등록됩니다(' + 일꾼들.join(' · ') + ') — 어느 쪽이 살아남든 받아야 합니다.\n' : '') +
        '  받는 갈래가 없으면 «공유했는데 아무 일도 없다»가 됩니다.');
      assert.equal(res.status, 303, '303 이어야 새로고침해도 다시 안 보냅니다');
      assert.ok(String(res.headers.get('location')).startsWith(뿌리), '받은 뒤 앱 밖으로 보냅니다: ' + res.headers.get('location'));
      const 담긴수 = Object.values(w.담긴것).reduce((n, a) => n + a.length, 0) + Object.values(w.캐시).reduce((n, a) => n + a.length, 0);
      assert.ok(담긴수 > 0, '★ ' + 파일 + ' 이 받았다고 답하면서 아무 데도 안 담았습니다 — 파일 칸 이름(' + 칸 + ')이 어긋났나요?');
    }
  });
}
