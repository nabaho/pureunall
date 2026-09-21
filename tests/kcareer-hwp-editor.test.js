'use strict';
/* ✏️ 한글 편집기 붙이기 (대표 지시 2026-09-21 「붙여라」)
   ─────────────────────────────────────────────────────────────
   저장소에 넣어 둔 한글 편집기(vendor/rhwp-studio)를 서류 만들기 화면에 띄운다.

   ■ 여기서 못 박는 것은 «값»이 아니라 «규칙»이다 — 그리고 첫째가 가장 무겁다
     ①★★ 서류가 «남의 서버»로 가지 않는다 — studioUrl 을 우리 것으로 준다.
        이음쇠(@rhwp/editor)의 기본값은 https://edwardkim.github.io/rhwp/ 다.
        그 한 줄을 빠뜨리면 주민번호·도장이 든 서류가 통째로 넘어간다
        (2026-09-05 에 바로 그 구조를 막았다).
     ②★ 그림 엔진(canvaskit)을 «안 넣었다» — renderer 를 canvas2d 로 줘야 한다
     ③★ 넣어 둔 편집기 안에 «바깥으로 나가는 길»이 없다
     ④ 고친 것은 한글 왕복과 «같은 길»(rhAdoptBase)로 되받는다 — 두 길이면 어긋난다
     ⑤ 서식을 닫거나 새로 올리면 편집기도 닫는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const CODE = stripComments(fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8'));
const 스튜디오 = path.join(R, 'vendor', 'rhwp-studio');
const 이음 = path.join(R, 'vendor', 'rhwp-editor');

function cutFn(s, decl) {
  const head = s.indexOf(decl);
  assert.notEqual(head, -1, decl + ' 을 찾지 못했습니다');
  let i = s.indexOf('{', head + decl.length), depth = 0;
  for (; i < s.length; i++) { if (s[i] === '{') depth++; else if (s[i] === '}') { depth--; if (!depth) break; } }
  return s.slice(head, i + 1);
}
function 모든파일(d) {
  const out = [];
  (function 돌기(x) {
    fs.readdirSync(x, { withFileTypes: true }).forEach((e) => {
      const p = path.join(x, e.name);
      if (e.isDirectory()) return 돌기(p);
      out.push(p);
    });
  })(d);
  return out;
}

test('①★★ 서류가 «남의 서버»로 가지 않는다 — studioUrl 을 우리 것으로 준다', () => {
  const fn = cutFn(CODE, 'async function _hwpEdCreate(');
  assert.match(fn, /studioUrl\s*:\s*'vendor\/rhwp-studio\/index\.html'/,
    '★ studioUrl 을 우리 것으로 안 줍니다 — 이음쇠의 기본값은 남의 서버입니다.\n'
    + '  그 한 줄이 없으면 주민번호·도장이 든 서류가 통째로 넘어갑니다.');
  /* 우리 코드 어디에도 그 기본 주소가 «살아서» 들어가면 안 된다 */
  assert.ok(CODE.indexOf('edwardkim.github.io') < 0,
    '★ 우리 코드에 남의 편집기 주소가 들어 있습니다');
});

test('①-2★★ 설정에 적힌 주소를 «편집기가 쓰지 않는다»', () => {
  /* 설정 칸(rhwp_url·PU_CFG.rhwpStudioUrl)은 2026-09-21 부터 아무 데서도 안 쓴다.
     ⚠ 이것을 편집기에 도로 물리면, 그 칸에 적힌 주소로 서류가 통째로 나간다 —
     설정은 한 사람이 채우고 온 식구가 쓰는 자리라 ① 보다 더 조용히 샌다. */
  const fn = cutFn(CODE, 'async function _hwpEdCreate(');
  assert.ok(!/rhwpStudioUrl|rhwp_url|PU_CFG/.test(fn),
    '★ 편집기가 설정 주소를 끌어다 씁니다 — 거기 적힌 곳으로 서류가 나갑니다.\n'
    + '  studioUrl 은 «우리 것 한 곳»으로 굳혀 두세요(vendor/rhwp-studio/index.html).');
});

test('①-3★★ 편집기를 짓는 자리가 «한 곳»뿐이다', () => {
  /* 부르는 화면은 둘(서류 만들기·한글 보기 큰 창)이고 앞으로 더 늘 수 있다.
     ⚠ 짓는 자리가 둘이 되면 빗장(studioUrl)도 둘이 된다 — 한쪽만 고치면
       그 화면에서만 서류가 남의 서버로 나가고, 아무도 모른다. */
  /* ⚠ 이름이 같은 «내장 편집기»(createEditor, 겹치기 입력판)가 따로 있다 —
     그것은 바깥과 무관하다. 우리가 세는 것은 «이음쇠를 통해 짓는» 자리다. */
  const 짓는곳 = (CODE.match(/\.createEditor\s*\(/g) || []).length;
  assert.equal(짓는곳, 1,
    '★ 이음쇠로 편집기를 짓는 자리가 ' + 짓는곳 + '곳입니다 — _hwpEdCreate 한 곳으로 모으세요.\n'
    + '  빗장(studioUrl)이 여러 곳에 흩어지면 한쪽만 고쳐져 조용히 샙니다.');
  /* 이음쇠를 들여오는 곳도 한 곳 — 들여온 자리마다 짓고 싶어진다 */
  const 들여옴 = (CODE.match(/vendor\/rhwp-editor\/index\.js/g) || []).length;
  assert.equal(들여옴, 1,
    '★ 이음쇠를 들여오는 자리가 ' + 들여옴 + '곳입니다 — _hwpEdCreate 한 곳에서만 들여오세요.');
});

test('②★ 그림 엔진을 안 넣었으므로 renderer 를 canvas2d 로 준다', () => {
  const fn = cutFn(CODE, 'async function _hwpEdCreate(');
  assert.match(fn, /renderer\s*:\s*'canvas2d'/, 'renderer 를 안 주면 없는 canvaskit 을 찾습니다');
  /* 정말 안 넣었는지 — 넣어 놓고 canvas2d 를 주면 7.4MB 가 헛되이 실린다 */
  const 있나 = 모든파일(스튜디오).some((p) => /canvaskit/i.test(p));
  assert.equal(있나, false, 'canvaskit 을 넣어 두고 canvas2d 를 쓰고 있습니다 — 7.4MB 가 헛돕니다');
});

test('③★ 넣어 둔 편집기 안에 «바깥으로 나가는 길»이 없다', () => {
  const 나쁜길 = ['WebSocket', 'sendBeacon', 'importScripts', 'new Worker'];
  const 집 = {};
  모든파일(스튜디오).concat(모든파일(이음))
    .filter((p) => /\.(js|mjs|html|css|json)$/.test(p))
    .forEach((p) => {
      const s = fs.readFileSync(p, 'utf8');
      const 짧은 = p.slice(R.length + 1).replace(/\\/g, '/');
      나쁜길.forEach((k) => {
        assert.ok(s.indexOf(k) < 0, '★ ' + 짧은 + ' 에 ' + k + ' 가 있습니다');
      });
      (s.match(/https?:\/\/[A-Za-z0-9._~:/?#@!$&'()*+,;=%-]+/g) || []).forEach((u) => {
        const h = u.replace(/^https?:\/\//, '').split(/[/?#]/)[0];
        (집[h] = 집[h] || []).push(짧은);
      });
    });
  /* 봐줄 것 — 셋뿐이고 저마다 까닭이 다르다:
     · 이름표로만 쓰이는 주소(XML 네임스페이스·문서 링크)
     · edwardkim.github.io — 이음쇠가 «기본값으로만» 들고 있다. 우리가 늘 덮어쓴다(① 검사가 지킨다)
     · cdn.jsdelivr.net — 글꼴 «목록에 적힌 주소»다. 부르지는 않는다(③-2 검사가 지킨다).
       ⚠ 주소 글자를 지우면 만든 쪽이 「비면 안 된다」고 멈춘다 — 그래서 남겨 두고 «부르나»를 본다. */
  const 봐줄것 = /^(www\.w3\.org|schemas\.|purl\.org|ns\.adobe\.com|creativecommons\.org|www\.inkscape\.org|sodipodi\.|github\.com|www\.npmjs\.com|opensource\.org|img\.shields\.io|bit\.ly|your-domain\.com|edwardkim\.github\.io|cdn\.jsdelivr\.net)/;
  const 남은것 = Object.keys(집).filter((h) => !봐줄것.test(h));
  assert.deepEqual(남은것, [],
    '★ 넣어 둔 편집기가 바깥 주소를 부릅니다: ' + 남은것.map((h) => h + '(' + 집[h][0] + ')').join(', '));
});

test('③-2★★ 바깥 글꼴 끄기가 «켜진 채로 굳어» 있다 — 넣은 파일에서 증명한다', () => {
  /* ⚠ 주소 글자는 자료로 남아 있다(만든 쪽이 「비면 안 된다」고 검사한다).
     중요한 것은 «부르느냐»이고, 빌드가 그 스위치를 «켜짐으로 굳혀» 넣었는지로 증명한다:
         disableExternalWebFonts: <이름>()   +   function <이름>(){return!0}
     그리고 켜져 있으면 https:// 로 시작하는 글꼴은 걸러진다.
     ⚠ 이름은 짧게 뭉개지므로(ih, ah …) 이름을 «못 박지 말고» 잡아서 따라간다. */
  const bundle = 모든파일(스튜디오).filter((p) => /assets[\\/]index-.*\.js$/.test(p))[0];
  assert.ok(bundle, '편집기 묶음 파일을 못 찾았습니다');
  const s = fs.readFileSync(bundle, 'utf8');

  const m = /disableExternalWebFonts:\s*([A-Za-z_$][\w$]*)\(\)/.exec(s);
  assert.ok(m, '★ 바깥 글꼴 스위치를 읽는 자리를 못 찾았습니다 — 스위치를 켜고 지었는지 확인하세요');
  const 켜짐 = new RegExp('function\\s+' + m[1] + '\\s*\\(\\)\\s*\\{\\s*return\\s*!0\\s*\\}').test(s);
  assert.ok(켜짐,
    '★★ 바깥 글꼴 끄기가 «꺼진 채로» 들어갔습니다 — 서류를 열면 남의 서버로 글꼴을 받으러 갑니다.\n'
    + '  RHWP_DISABLE_EXTERNAL_WEBFONTS=1 을 주고 다시 지으세요(vendor/rhwp-studio/푸른-메모.md).');

  /* 켜지면 https:// 글꼴을 걸러 내는 코드가 함께 있어야 뜻이 있다 */
  assert.match(s, /\/\^https\?:\\\/\\\/\/i/,
    '바깥 주소를 걸러 내는 자리가 안 보입니다 — 스위치만 켜고 거르지 않으면 소용없습니다');

  /* 다시 지을 사람을 위한 기록 */
  const 메모 = path.join(스튜디오, '푸른-메모.md');
  assert.ok(fs.existsSync(메모), '어떻게 지었는지 적어 둔 메모가 없습니다 — 다음 사람이 다시 못 짓습니다');
  const 글 = fs.readFileSync(메모, 'utf8');
  ['RHWP_DISABLE_EXTERNAL_WEBFONTS=1', 'RHWP_WITHOUT_HWPCTRL=1', 'studioUrl']
    .forEach((k) => assert.ok(글.indexOf(k) >= 0, '메모에 ' + k + ' 가 없습니다'));
  assert.ok(fs.existsSync(path.join(스튜디오, 'LICENSE')), '라이선스를 함께 넣지 않았습니다');
});

test('③-3★ 편집기가 «상대 경로»로 지어져 있다 — 아니면 하위 폴더에서 아예 안 뜬다', () => {
  /* ⚠ 실측 2026-09-21: `--base=./` 없이 지으면 index.html 이 `/assets/…` 로 «맨 위부터» 찾는다.
     우리는 vendor/rhwp-studio 하위에 두므로 404 가 나고, 틀만 뜬 채 속이 빈다.
     화면에서는 「열리는 중…」에서 멈춘 것처럼 보여 까닭을 짚기 어렵다. */
  const html = fs.readFileSync(path.join(스튜디오, 'index.html'), 'utf8');
  const 맨위부터 = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(맨위부터, [],
    '★ 편집기가 «맨 위부터» 찾는 길로 지어졌습니다: ' + 맨위부터.slice(0, 4).join(', ') + '\n'
    + '  `npx vite build --base=./` 로 다시 지으세요(vendor/rhwp-studio/푸른-메모.md).');
  assert.match(html, /(?:src|href)="\.\//, '상대 경로로 지어진 흔적이 없습니다');
});

test('④ 고친 것은 한글 왕복과 «같은 길»로 되받는다', () => {
  const fn = cutFn(CODE, 'async function rhHwpEdSave(');
  assert.match(fn, /exportHwpx\(\)/, '편집기에서 받아오지 않습니다');
  assert.match(fn, /rhAdoptBase\(/,
    '되받는 길을 따로 만들었습니다 — 한글 왕복(rhAdoptBase)과 같은 길을 써야 어긋나지 않습니다');
});

test('⑤ 서식을 닫거나 새로 올리면 편집기도 닫는다', () => {
  assert.match(CODE, /function rhHwpEdClose\(/, '닫는 길이 없습니다');
  const n = (CODE.match(/rhHwpEdClose\(\)/g) || []).length;
  assert.ok(n >= 3, '닫는 자리가 모자랍니다 (지금 ' + n + '군데) — 새 서식·치우기에서 모두 닫아야 합니다');
});

test('⑥ 화면에 단추와 자리가 있다', () => {
  assert.match(CODE, /id="kfM5"/, '단추가 없습니다');
  assert.match(CODE, /id="rhHwpEdBox"/, '편집기가 들어갈 자리가 없습니다');
  assert.match(CODE, /onclick="rhHwpEdSave\(\)"/, '되받기 단추가 없습니다');
  /* 모드 줄에 새 단추가 들어갔나 — 안 들어가면 켜도 꺼진 것처럼 보인다 */
  assert.match(CODE, /\['kfM5','edit'\]/, '모드 표시에 새 단추가 빠졌습니다');
});

test('⑨★ 회의·비용관리에서도 고칠 수 있다 — 큰 창에 편집기가 달렸다', () => {
  /* 대표 지시 2026-09-21 「회의관리비용도 같이」.
     ⚠ 회의·비용관리에는 «서식 채우기» 화면이 없다. 문서가 나오는 자리는
       「📨 동의서」(feeConsentDoc) 하나이고 그것은 한글 보기 큰 창으로 열린다.
       그래서 큰 창에 편집기가 달려 있어야 비용관리도 고칠 수 있다 —
       이 줄이 «회의·비용관리도 함께»를 지키는 유일한 고리다. */
  const 동의서 = cutFn(CODE, 'function feeConsentDoc(');
  assert.match(동의서, /openHwpViewer\(/,
    '동의서가 큰 창으로 안 열립니다 — 그러면 아래 고리가 끊깁니다');
  assert.match(CODE, /onclick="hwpViewEdit\(\)"/,
    '★ 큰 창에 「✏️ 한글로 고치기」 단추가 없습니다 — 회의·비용관리에서 못 고칩니다');
  assert.match(CODE, /id="hwpViewEdBox"/, '큰 창에 편집기가 들어갈 자리가 없습니다');
  assert.match(CODE, /onclick="hwpViewEditDone\(\)"/, '고친 것을 받아오는 단추가 없습니다');

  /* 고친 것을 «실제로» 받아와 이 창의 문서로 삼는가 — 단추만 있고 안 받아오면 헛것이다 */
  const 받기 = cutFn(CODE, 'async function hwpViewEditDone(');
  assert.match(받기, /exportHwpx\(\)/, '편집기에서 받아오지 않습니다');
  assert.match(받기, /openHwpViewer\(/,
    '받아온 것으로 다시 그리지 않습니다 — ⬇ 저장·🖨 인쇄가 옛 문서를 뽑습니다');

  /* 창을 닫으면 편집기도 거둔다 — 숨은 채로 계속 돌면 메모리를 문다 */
  const 닫기 = cutFn(CODE, 'function closeHwpView(');
  assert.match(닫기, /hwpViewEdClose\(\)/, '큰 창을 닫아도 편집기가 남습니다');
});

test('⑩★★ 편집기가 브라우저에 남긴 서류를 지운다 — 다음 사람이 남의 이력서를 못 본다', () => {
  /* 2026-09-21 실측: 편집기를 닫았다 열자 «지난번 서류를 되살리겠느냐»는 창이 떴다.
     우리 저장공간에 두 자리를 만들어 두고 있었다 —
       rhwpStudioAutosave/drafts : 서류 원본 바이트 통째(109,568바이트를 실제로 봤다)
       rhwpStudioRecent/recent   : 연 파일 이름(이름만으로도 누구 것인지 드러난다)
     ⚠ 이 집 서류에는 주민등록번호·도장·계좌가 있고 사무실 PC 는 여럿이 쓴다.
       그대로 두면 다음 사람이 앞사람 것을 복구창으로 받는다. */
  assert.match(CODE, /function _hwpEdForget\(/, '★ 지우는 길이 없습니다');
  const fn = cutFn(CODE, 'function _hwpEdForget(');
  ['rhwpStudioAutosave', 'rhwpStudioRecent'].forEach((n) => {
    assert.ok(fn.indexOf(n) >= 0, '★ ' + n + ' 을 안 지웁니다 — 서류가 이 PC 에 남습니다');
  });
  assert.match(fn, /deleteDatabase\(/, '★ 지우지 않고 읽기만 합니다');

  /* 열 때와 닫을 때 «둘 다» 불러야 한다 —
     열 때만 부르면 닫은 뒤 그대로 남고, 닫을 때만 부르면 브라우저가 꺼진 뒤 남는다. */
  const 짓기 = cutFn(CODE, 'async function _hwpEdCreate(');
  assert.match(짓기, /_hwpEdForget\(\)/, '★ 열 때 안 지웁니다 — 앞사람 것이 복구창에 뜹니다');
  ['function rhHwpEdClose(', 'function hwpViewEdClose('].forEach((d) => {
    assert.match(cutFn(CODE, d), /_hwpEdForget\(\)/,
      '★ ' + d + ' 에서 안 지웁니다 — 닫아도 서류가 남습니다');
  });
});

test('⑪★ 고친 서식이 보관함에 «새 줄»로 담긴다 — 원본을 덮지 않는다', () => {
  /* 대표 결정 2026-09-21 「새 줄로 담는다」.
     ⚠ 보관함에는 «판(버전)» 개념이 아예 없다. 파일 담개(saveFileUnified)는 같은 번호를
       주면 그냥 덮어써서, 기관이 준 옛 양식이 그 자리에서 사라지고 되돌릴 길이 없다.
       그래서 «새 번호 · 새 줄»이어야 한다. */
  const fn = cutFn(CODE, 'function hwpViewSaveToLib(');

  /* 새 번호를 짓는가 — 온곳의 번호를 그대로 쓰면 원본이 덮인다 */
  assert.match(fn, /saveFileUnified\(\s*id\s*,/, '파일을 담지 않습니다');
  assert.match(fn, /id\s*=\s*'CVFORM'\s*\+/,
    '★ 새 번호를 안 짓습니다 — 원본 양식이 그 자리에서 사라집니다');
  assert.ok(!/_hwpView\.from\.id/.test(fn),
    '★ 온곳의 번호로 담고 있습니다 — 그것이 곧 «덮어쓰기»입니다');

  /* 목록에도 한 줄 더한다 — 빼는 코드가 있으면 안 된다 */
  assert.match(fn, /set\(\s*'cvforms'/, '보관함 목록에 안 넣습니다');
  assert.match(fn, /unshift\(/, '목록에 «더하지» 않습니다');
  assert.ok(!/filter\(/.test(fn), '★ 목록에서 무언가를 빼고 있습니다 — 담기만 해야 합니다');

  /* 보관함에서 온 것일 때만 담는다 */
  assert.match(fn, /kind\s*===\s*'cvform'/,
    '★ 아무 문서나 기관 양식으로 담깁니다 — 그 자리에서 만든 동의서까지 목록에 들어갑니다');
});

test('⑪-2★ 온곳은 «받은 것만» 쓴다 — 앞 문서 것을 물려받지 않는다', () => {
  /* 이 큰 창은 여러 곳이 함께 쓴다. 앞 문서의 온곳이 남아 있으면,
     보관함 서식을 본 «뒤에» 만든 동의서가 「보관함에서 온 것」이 되어 엉뚱한 줄이 담긴다. */
  const fn = cutFn(CODE, 'async function openHwpViewer(');
  assert.match(fn, /from\s*:\s*온곳\s*\|\|\s*null/,
    '★ 온곳을 받은 그대로 쓰지 않습니다 — 앞 문서 것이 물려집니다');
  assert.ok(!/_hwpView\s*(&&|\.)\s*[^\n]*from[^\n]*:/.test(fn.split('_hwpView =')[0] || ''),
    '★ 새 문서를 만들기 전에 옛 온곳을 읽고 있습니다');

  /* 고쳐서 다시 그릴 때는 온곳을 «명시로» 넘긴다 — 안 넘기면 단추가 사라진다 */
  const 받기 = cutFn(CODE, 'async function hwpViewEditDone(');
  assert.match(받기, /openHwpViewer\([\s\S]*?,\s*온곳\s*\)/,
    '★ 고친 뒤 다시 그릴 때 온곳을 안 넘깁니다 — 「보관함에 담기」가 사라집니다');

  /* 보관함에서 열 때는 온곳을 준다 — 이 한 줄이 전체를 잇는다 */
  const 보기 = cutFn(CODE, 'async function cvFormHwpView(');
  assert.match(보기, /kind\s*:\s*'cvform'/,
    '★ 보관함이 온곳을 안 줍니다 — 고쳐도 담을 길이 없습니다');
});

test('⑪-3 이름에 «(고침)»을 겹쳐 붙이지 않는다', () => {
  /* 세 번 고치면 「(고침) (고침) (고침).hwpx」가 된다 — 목록에서 어느 것이 최근인지 못 읽는다 */
  const fn = cutFn(CODE, 'function _cvFixedName(');
  assert.match(fn, /replace\(\s*\/\\s\*\\\(고침/,
    '★ 이미 붙은 (고침)을 떼지 않습니다 — 고칠수록 이름이 길어집니다');
  assert.match(fn, /indexOf\(이름\)\s*<\s*0|some\(/,
    '★ 같은 이름이 이미 있는지 안 봅니다 — 목록에 같은 이름이 둘 생깁니다');
});

test('⑦ 편집기가 배포에서 지워지지 않는다 — 지워지면 화면에서 안 열린다', () => {
  const wf = fs.readFileSync(path.join(R, '.github', 'workflows', 'deploy-pages.yml'), 'utf8');
  const 지움 = wf.match(/for d in ([\s\S]*?)do/);
  assert.ok(지움, '배포에서 지우는 목록을 찾지 못했습니다');
  assert.ok(!/\bvendor\b/.test(지움[1]), '★ vendor 가 배포에서 지워집니다 — 편집기가 안 열립니다');
});

test('⑧ 넣은 크기를 기록해 둔다 — 말없이 불어나지 않게', () => {
  const 합 = 모든파일(스튜디오).concat(모든파일(이음))
    .reduce((a, p) => a + fs.statSync(p).size, 0);
  const MB = 합 / 1024 / 1024;
  assert.ok(MB < 14,
    '★ 편집기가 ' + Math.round(MB * 10) / 10 + 'MB 입니다 — 14MB 를 넘었습니다.\n'
    + '  견본·PWA·그림 엔진을 다시 넣은 것은 아닌지 보세요(vendor/rhwp-studio/푸른-메모.md).');
  assert.ok(MB > 5, '편집기가 ' + Math.round(MB * 10) / 10 + 'MB 뿐입니다 — 엔진(wasm)이 빠진 것 같습니다');
});
