/* 이알피 옆 메뉴는 «이알피 안의 화면»만 — 앱 밖으로 나가지 않는다 (2026-09-21)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-21 「법인대시보드에 푸른캘린더 없애는건 어떤가? 검토해달라」 → 뺀다.

   ★ 왜 뺐나
     ① 형제 앱이 열여섯인데(업무관리·급여관리·기금관리·사진첩 …) 전부 옆 메뉴에 없다.
        「푸른 캘린더」 하나만 예외였다 — 하나만 예외면 규칙이 없는 것과 같다.
     ② 문이 이미 둘 더 있다: 오른쪽 가장자리의 「즐겨찾기」 탭(js/pu-appbar.js 의
        프로그램 이동 — ☆ 를 누르면 맨 위로)과 포털(enter.html)의 타일.
     ③ 메뉴를 눌렀는데 앱이 통째로 바뀌면 돌아올 때 걸음이 꼬인다.

   ★ 이 검사가 지키는 것
     ① 옆 메뉴 어디에도 «다른 앱으로 가는» 항목이 없다
     ② 그 대신 «오른쪽 탭»이 살아 있다 — 둘 다 없으면 달력에 갈 길이 사라진다
     ③ 항목 하나짜리 묶음은 머리(▶ …)를 안 그린다
     ④ 옆줄 머리에 파란 안내 상자를 띄우지 않는다(2026-10-04 대표 「필요없다」 — 달력 안내도 걷었다)

   ⚠ 다시 넣고 싶어지면 먼저 «업무관리도 넣을 것인가»를 답해 볼 것 —
     답이 아니오면 이것도 아니오다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
/* 주석을 걷고 본다 — 「왜 뺐나」를 적어 둔 주석이 「아직 있다」로 잡히면 헛돈다 */
const 알맹이 = ERP.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

function 메뉴덩이() {
  const i = 알맹이.indexOf('var MENUS = [');
  assert.ok(i >= 0, 'MENUS 를 못 찾았습니다');
  return 알맹이.slice(i, 알맹이.indexOf('\n];', i));
}

test('①★★ 옆 메뉴에 «다른 앱으로 가는» 항목이 없다 — 하나만 예외면 규칙이 없는 것이다', () => {
  const 덩이 = 메뉴덩이();
  assert.ok(덩이.indexOf('app:') < 0,
    '★ 메뉴에 app 칸이 다시 생겼습니다. 다른 앱은 오른쪽 「즐겨찾기」 탭으로 갑니다.\n'
    + '  넣고 싶으면 먼저 «업무관리도 넣을 것인가»를 답해 보십시오 — 아니오면 이것도 아니오입니다.');
  assert.ok(덩이.indexOf('pu-cal.html') < 0, '★ 메뉴가 푸른 캘린더를 다시 가리킵니다');
  assert.ok(덩이.indexOf('dash/cal') < 0, '★ dash/cal 이 되살아났습니다');
});

test('①-2 selectMenu 에도 앱으로 새는 갈래가 없다 — 쓰는 데 없는 길은 남기지 않는다', () => {
  const i = 알맹이.indexOf('function selectMenu(id){');
  const 몸 = 알맹이.slice(i, 알맹이.indexOf('\n  function ', i + 10));
  assert.ok(몸.indexOf('goApp') < 0, '★ selectMenu 가 아직 다른 앱을 엽니다');
});

test('②★★ 그 대신 «오른쪽 탭»이 살아 있다 — 둘 다 없으면 달력에 갈 길이 사라진다', () => {
  assert.match(ERP, /<script src="js\/pu-appbar\.js\?v=\d+"><\/script>/,
    '★ 프로그램 이동(앱바)을 안 싣습니다 — 메뉴도 뺐으면 달력에 갈 길이 없습니다');
  const bar = fs.readFileSync(path.join(ROOT, 'js', 'pu-appbar.js'), 'utf8');
  assert.match(bar, /url:\s*'pu-cal\.html'/, '★ 앱바 목록에 푸른 캘린더가 없습니다');
  /* 포털에도 있어야 한다 — 이알피를 안 거치고 바로 가는 사람이 더 많다 */
  const 포털 = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
  assert.match(포털, /url:\s*'pu-cal\.html'/, '★ 포털 타일에 푸른 캘린더가 없습니다');
});

test('③ 항목 하나짜리 묶음은 머리를 안 그린다 — 한 번 더 누르게 할 뿐이다', () => {
  const 덩이 = 메뉴덩이();
  assert.match(덩이, /gid:'dash'[^\]]*flat:true/,
    '대시보드 묶음에 flat 이 없습니다 — 「▶ 대시보드 1」 로 접혀 뜹니다');
  assert.match(알맹이, /!grp\.flat && h\('div', \{ className:'sb-grp-h'/,
    '★ 그리는 쪽이 flat 을 안 봅니다 — 머리가 그대로 뜹니다');
  assert.match(알맹이, /var open = grp\.flat \? true :/,
    '★ flat 묶음이 접힐 수 있습니다 — 접히면 항목이 아예 안 보입니다');
});

test('③-2 대시보드 묶음에 남은 것은 「나의 업무」 하나다', () => {
  const 덩이 = 메뉴덩이();
  const i = 덩이.indexOf("gid:'dash'");
  const 조각 = 덩이.slice(i, 덩이.indexOf(']}', i));
  const 항목수 = (조각.match(/\{ id:'/g) || []).length;
  assert.strictEqual(항목수, 1, '대시보드 묶음의 항목 수가 바뀌었습니다 — flat 이 아직 맞는지 다시 보십시오');
  assert.match(조각, /id:'dash\/my'/);
});

test('④★ 옆줄에 파란 안내 상자를 띄우지 않는다 — 메뉴를 밀어내고 자리만 먹는다', () => {
  /* 대표 지시 2026-10-04 「파란색 네모 박스 뜨는것 안보이게 해라 필요없다」.
     전에는 「🆕 이번 업데이트」(관리자)·「📅 달력이 옮겨졌습니다」(모두) 둘이 옆줄 맨 위에 떴다.
     ★ 글자 하나가 아니라 «옆줄 안에 닫기(✕) 달린 안내 덩이가 있나»를 본다 — 새 이름으로 다시 생겨도 걸리게. */
  const i = 알맹이.indexOf("h('aside', { className: 'sb'");
  assert.ok(i > 0, '옆줄을 못 찾았습니다 — 검사가 헛돕니다');
  const 옆줄 = 알맹이.slice(i, 알맹이.indexOf("h('nav', { className:'sb-nav'", i));
  assert.ok(옆줄.length > 200, '옆줄 머리가 너무 짧습니다 — 자르는 자리가 바뀌었나요?');
  assert.doesNotMatch(옆줄, /이번 업데이트|달력이 옮겨졌습니다/, '★★ 걷은 파란 상자가 돌아왔습니다');
  assert.doesNotMatch(옆줄, /'✕'\)/, '★★ 옆줄 머리에 닫기(✕) 달린 안내 상자가 다시 생겼습니다');
  assert.doesNotMatch(알맹이, /showCalMoved|showBuildPopup/, '걷은 상자의 상태가 남았습니다');
});

test('★ 단축키가 «없는 메뉴»를 가리키지 않는다 — 눌러도 아무 일이 없다', () => {
  /* ⚠ 「var map = {」 만으로 찾으면 앞에 있는 «빈 map» 이 잡혀 검사가 헛돌았다
     (2026-09-21 이빨 확인에서 잡았다 — 없어진 메뉴를 넣어 봐도 안 걸렸다).
     ★ 단축키 표는 '1' 부터 시작한다 — 그것을 물고 늘어진다. */
  const m = 알맹이.match(/var map = \{\s*'1':[\s\S]*?\};/);
  assert.ok(m, '단축키 표를 못 찾았습니다 — 무늬가 바뀌었나요?');
  const 표 = m[0];
  assert.ok(표.indexOf('dash/cal') < 0, '★ 단축키가 없어진 메뉴를 가리킵니다');
  /* 표에 적힌 메뉴가 모두 실제로 있는지 본다 */
  const 있는것 = (메뉴덩이().match(/id:'([a-z]+\/[a-z]+)'/g) || []).map((x) => x.slice(4, -1));
  (표.match(/'([a-z]+\/[a-z]+)'/g) || []).map((x) => x.slice(1, -1)).forEach((id) => {
    assert.ok(있는것.indexOf(id) >= 0, '★ 단축키가 가리키는 ' + id + ' 이 메뉴에 없습니다');
  });
});
