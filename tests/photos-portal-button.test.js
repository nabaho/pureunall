/* 사진첩 윗줄 🏠 — 한 번에 푸른통합 시작화면(포털)으로 (대표 지시 2026-09-27 · 목업 「이대로」)
 *
 *   「이화면에서 푸른통합 앱 있는곳으로 한번에 가는 버튼 만들어줘」
 *
 * ★ 지키는 것: ① 윗줄에 단추가 있고 누르면 포털로 간다 ② 같은 창에서 간다(한 앱 한 창)
 *              ③ 앱이 건 onNavigate(「저장하고 갈까요?」)를 건너뛰지 않는다 ④ 윗줄은 한 줄이다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8');
const CSS = (RAW.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

function run(appBar) {
  const loc = { href: '' };
  const opened = [];
  const ctx = { Math, Date, location: loc, window: {}, open: function (u) { opened.push(u); } };
  if (appBar) ctx.window.PuAppBar = appBar;
  ctx.PuAppBar = appBar;
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function goPortal(') + '\ngoPortal();', ctx);
  return { loc: loc, opened: opened };
}

test('★★ 윗줄에 🏠 단추가 있고 goPortal 을 부른다', () => {
  const a = RAW.indexOf('<div id="top">');
  const b = RAW.indexOf('</div>', RAW.indexOf('id="setIc"'));
  const top = RAW.slice(a, b);
  assert.match(top, /id="portalIc"[^>]*onclick="goPortal\(\)"|onclick="goPortal\(\)"[^>]*id="portalIc"/,
    '★★ 윗줄에 포털 단추가 없거나 눌러도 아무것도 안 부릅니다');
});

test('★★★ 누르면 포털(enter.html)로 «같은 창»에서 간다 — 새 창을 열면 앱 창이 쌓인다', () => {
  const r = run(null);
  assert.match(r.loc.href, /^enter\.html\?v=\d+$/, '★★★ 포털로 안 갑니다: ' + r.loc.href);
  assert.deepEqual(r.opened, [], '★★ 새 창을 엽니다 — 푸른통합 창은 하나만(대표 지시 2026-09-08)');
  assert.ok(!/_blank/.test(stripJs(cutFn(RAW, 'function goPortal('))), '★★ _blank 가 들어왔습니다');
});

test('★★ 앱이 걸어 둔 onNavigate 를 거친다 — 「저장하고 갈까요?」를 건너뛰지 않게', () => {
  const got = [];
  const r = run({ onNavigate: function (u) { got.push(u); } });
  assert.equal(got.length, 1, '★★ onNavigate 를 건너뛰고 곧장 갑니다');
  assert.match(got[0], /^enter\.html/);
  assert.equal(r.loc.href, '', '★ onNavigate 에 맡겼는데 스스로도 옮깁니다(두 번 간다)');
});

test('★★ 윗줄은 한 줄이다 — 🏠 를 넣자 412px 폰에서 제목이 두 줄로 접혔다', () => {
  const brand = (CSS.match(/#top \.brand\{[^}]*white-space:nowrap[^}]*\}/) || [''])[0];
  assert.ok(brand, '★★ 「푸른사진첩」 제목이 좁은 폰에서 두 줄로 접힙니다(윗줄 46→62px)');
  const who = (CSS.match(/#top \.who\{[^}]*min-width:0[^}]*\}/) || [''])[0];
  assert.ok(who, '★ 자리가 모자랄 때 줄어들 칸(이름)이 없습니다 — 단추가 밀려납니다');
});
