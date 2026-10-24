const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const enter = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');

function phoneBlock() {
  const at = enter.indexOf('/* ── 머리 카드는 작을수록 좋다');
  assert.ok(at >= 0, '머리 카드 폰 블록을 찾지 못했습니다.');
  /* 이 규칙들이 든 @media 를 거슬러 찾는다 */
  const mq = enter.lastIndexOf('@media', at);
  const open = enter.indexOf('{', mq);
  let depth = 0, i = open;
  for (; i < enter.length; i++) {
    if (enter[i] === '{') depth++;
    else if (enter[i] === '}' && --depth === 0) break;
  }
  return enter.slice(mq, i + 1);
}

/* 2026-10-24 대표 머리 카드 1안 「아바타 하나」 — 카드를 걷고 한 줄. 사용액·로그아웃은 «내 메뉴» 안으로.
   (그 앞: 2026-08-20 「너무 많은 부분 차지」→ 네 줄을 두 줄로 — 사용액이 둘째 줄 둘째 자리에 앉았다) */
test('폰: 내 메뉴 단추(이름·사번)는 «줄어들지 않는다» — 사번이 잘리지 않게', () => {
  const b = phoneBlock();
  /* 줄어들면 「권형하 · P-0…」 처럼 사번이 잘린다 — 자리가 모자라면 제 줄로 내려가야 한다 */
  assert.match(b, /\.pbar \.pmeta\{[^}]*flex:0 0 auto/,
    '★ 이름·사번 단추가 줄어들 수 있다 — 사번이 말줄임(…)으로 잘린다');
  assert.doesNotMatch(b, /#userName\{[^}]*text-overflow:ellipsis/,
    '★ 폰에서 이름 칸을 말줄임으로 자른다 — 사번이 사라진다');
});

test('한 줄로 몰면서 접은 것은 «다른 데 같은 말이 있는 것» 뿐이다', () => {
  const b = phoneBlock();
  /* 대표 지시 2026-08-20 「권형하와 아이디만 있으면 된다」 — 직책·역할을 접는다 */
  assert.match(b, /\.pbar \.pmeta \.un-role,\.pbar \.pmeta \.un-title\{display:none;\}/);
  assert.match(enter, /<span class="un-title">/, '직책을 감싸지 않으면 접을 수가 없습니다.');
  assert.match(b, /\.pbar #billChip \.lb,\.pbar #billChip \.ago\{display:none;\}/);
  /* ★ 사번은 «절대» 접지 않는다 — P005·A005 처럼 숫자가 같은 사번이 있어,
     사번이 안 보이면 엉뚱한 계정으로 들어간 것을 알아챌 길이 없다(2026-08-10 고침). */
  assert.doesNotMatch(b, /#userName\{[^}]*display:none/,
    '★ 사번이 사라지면 남의 계정으로 들어간 것을 못 알아챕니다.');
  assert.match(enter, /mySid \? ' · ' \+ _e\(mySid\.toUpperCase\(\)\)/);
  /* 감춘 말은 «명부 값»과 섞이지 않게 감싸서 넣는다 */
  assert.match(enter, /<span class="un-role">/);
  assert.match(enter, /var _e = function\(v\)/, 'innerHTML 로 넣으면서 감싸지 않으면 위험합니다.');
});

/* 2026-10-24 대표 「사용액등은 어디 사라지고 로그아웃 기능도 어디로 사라졌나」 → 윗줄 정리 안 1:
   메뉴 속에만 두니 «없어진 것»으로 보였다. 사용액은 내 메뉴 단추 «안»에 늘 보이고(관리자만),
   로그아웃은 PC 머리줄 맨 오른쪽에 늘 보인다(폰은 좁아 메뉴 맨 아래). 자세한 사용액·AI 판독은 메뉴 안. */
test('사용액·로그아웃은 «사라져 보이지» 않는다 — 단추 안 사용액 · PC 머리줄 로그아웃 · 폰은 메뉴 맨 아래', () => {
  const 메뉴 = enter.indexOf('id="meMenu"');
  const 메뉴끝 = enter.indexOf('<button class="logout" id="logoutBtn"');
  const 단추 = enter.indexOf('id="meBtn"');
  assert.ok(메뉴 > 0 && 메뉴끝 > 메뉴 && 단추 > 메뉴끝, '★ 내 메뉴 · 머리줄 로그아웃 · 내 메뉴 단추 차례가 틀렸다');
  const 안 = enter.slice(메뉴, 메뉴끝);
  ['moneyBox', 'billChip', 'aiChip', 'meLogout'].forEach((id) =>
    assert.ok(안.indexOf('id="' + id + '"') > 0, '★ ' + id + ' 가 내 메뉴 안에 없다'));
  /* 사용액은 내 메뉴 단추 안에도 — 값·켜고 끄기를 사용액 딱지와 «같이» 맞춘다 */
  const 단추안 = enter.slice(단추, enter.indexOf('me-caret', 단추));
  assert.ok(단추안.indexOf('id="meMoney"') > 0, '★ 내 메뉴 단추에 사용액이 없다 — 또 «사라진 것»으로 보인다');
  assert.match(enter, /var mm = \$\('meMoney'\); if\(mm\) mm\.hidden = !bOn;/,
    '★ 단추 안 사용액을 사용액 딱지와 같이 켜고 끄지 않는다 — 직원에게 새거나 관리자에게 안 보인다');
  assert.match(enter, /\$\('meMoneyAmt'\)\.textContent = \$\('billAmt'\)\.textContent/, '★ 단추 안 사용액이 값을 안 따라간다');
  /* 폰: 머리줄 로그아웃은 숨기고 메뉴 맨 아래 것이 대신 누른다 */
  const b = phoneBlock();
  assert.match(b, /\.pbar > #logoutBtn\{display:none;\}/, '★ 폰 머리줄에 로그아웃이 남아 자리를 먹는다');
  assert.match(b, /\.pbar \.me-menu \.me-logout\{display:block;\}/, '★ 폰에서 로그아웃할 길이 없다');
  assert.match(enter, /\$\('meLogout'\)[\s\S]{0,120}\$\('logoutBtn'\)\.click\(\)/, '★ 메뉴의 로그아웃이 진짜 로그아웃을 안 누른다');
  /* 닫힌 메뉴는 정말 닫혀 있어야 한다 — display 규칙이 hidden 을 이기면 늘 펼쳐진다 */
  assert.match(enter, /\.me-menu\[hidden\]\{display:none;\}/, '★ 닫아도 내 메뉴가 그대로 떠 있다');
});

test('연결 상태는 «잘 될 때만» 점으로 줄인다 — 끊기면 말이 그대로 나온다', () => {
  /* 「서버 연결됨」 여섯 글자가 이름 자리를 먹는데, 정작 읽어야 할 때는
     «끊겼을 때»다. 그때는 글자를 남긴다. */
  /* 2026-09-12: 머리줄에서는 «잘 될 때만» 「연결됨」으로 줄여 넣는다(barLabel) —
     끊겼거나 확인 중이면 긴 말(label) 그대로다. 감싸는 것 자체는 그대로여야 한다. */
  assert.match(enter, /<span class="cs-lb">' \+ (barLabel|label) \+ '<\/span>/,
    '말을 감싸지 않으면 점만 남길 수가 없습니다.');
  const b = phoneBlock();
  assert.match(b, /\.connection-status\[data-state="online"\] \.cs-lb\{display:none;\}/);
  assert.doesNotMatch(b, /\.connection-status \.cs-lb\{display:none/,
    '★ 상태를 가리지 않고 무조건 감추면 「서버 연결 끊김」을 못 봅니다.');
});

test('PC 머리 카드는 그대로 한 줄이다', () => {
  /* 컴팩트는 폰 이야기다 — 넓은 화면은 한 줄에 다 들어간다. */
  assert.match(enter, /\.pbar\{display:flex;align-items:center;gap:13px/);
  assert.match(enter, /\.pbar #sgFab\{order:4;\}/, 'PC 에서 건의하기는 오른쪽이다');
  /* 내 메뉴 단추(이름·사번)는 건의하기보다 오른쪽 끝 */
  const m = enter.match(/\.pbar \.pmeta\{order:(\d+);/);
  assert.ok(m && Number(m[1]) > 4, '★ 내 메뉴 단추가 건의하기 왼쪽으로 갔다');
});

test('★ 이름·사번과 연결 상태는 머리줄에 남는다 — 내 메뉴 속으로 숨기지 않는다', () => {
  /* 사번: P005·A005 처럼 숫자가 같은 사번이 있어 늘 보여야 한다(2026-08-10).
     연결: 끊겼을 때 그 말이 바로 보여야 한다. 둘 다 «펼쳐야 보이는» 자리에 두면 안 된다. */
  const 메뉴 = enter.indexOf('id="meMenu"'), 끝 = enter.indexOf('id="meBtn"');
  const 안 = enter.slice(메뉴, 끝);
  assert.ok(안.indexOf('id="userName"') < 0, '★ 이름·사번이 내 메뉴 속으로 숨었다');
  assert.ok(안.indexOf('id="statusDot"') < 0, '★ 연결 상태가 내 메뉴 속으로 숨었다');
  const 단추 = enter.slice(끝, enter.indexOf('me-caret', 끝));
  assert.ok(단추.indexOf('id="userName"') > 0 && 단추.indexOf('id="statusDot"') > 0,
    '★ 머리줄의 내 메뉴 단추에 이름·사번·연결 상태가 없다');
});

test('내 메뉴는 누르면 열리고 · 바깥을 누르거나 Esc 로 닫힌다 · 「내 정보」는 메뉴 안 단추로', () => {
  const at = enter.indexOf('(function initMeMenu(){');
  assert.ok(at > 0, '★ 내 메뉴를 여닫는 곳이 없다');
  const fn = enter.slice(at, enter.indexOf('})();', at));
  assert.match(fn, /aria-expanded/, '★ 펼침 상태를 화면읽기에 알리지 않는다');
  assert.match(fn, /'Escape'/, '★ Esc 로 닫히지 않는다');
  assert.match(fn, /document\.addEventListener\('click'/, '★ 바깥을 눌러도 안 닫힌다');
  assert.match(fn, /'Enter'/, '★ 키보드로 열 수 없다');
  assert.match(fn, /meProfile[\s\S]*kkOpenProfile/, '★ 「내 정보」(카카오 연결)로 가는 길이 사라졌다');
});

/* 대표 2026-10-24 「이부분도 추천대로 해라」 — 내 메뉴 안의 사용액·AI 판독을 시안 1안 목업처럼 «줄»로 */
test('내 메뉴 안의 돈 딱지는 «줄» — 값은 오른쪽 · 경고 색(노랑·빨강)은 남는다', () => {
  const box = enter.match(/\.me-menu #moneyBox\{[^}]*\}/);
  assert.ok(box && /flex-direction:column/.test(box[0]), '★ 사용액·AI 판독이 메뉴 안에서도 알약처럼 옆으로 붙어 선다');
  assert.match(enter, /\.me-menu #moneyBox #billChip \.amt[^{]*\{[^}]*margin-left:auto/, '★ 금액이 오른쪽 끝에 안 선다');
  /* 경고 색은 «얼마나 썼나»를 말한다 — 줄 모양으로 바꾸며 바탕을 지우더라도 경고 색은 되살려야 한다 */
  assert.match(enter, /\.me-menu #moneyBox #aiChip\[data-tone="warn"\]\{background:/, '★ 한도에 가까워도 노란색이 안 보인다');
  assert.match(enter, /\.me-menu #moneyBox #aiChip\[data-tone="over"\]\{background:/, '★ 한도를 넘어도 빨간색이 안 보인다');
});
