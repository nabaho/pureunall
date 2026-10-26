'use strict';
/* 포털 머리줄 정리 — 「다」안 (대표 결정 2026-09-12, 목업 docs/mockups/portal-bar-tidy.html)
   「이부분 깔끔하게 다시 정리해줄수 있나?」

   ■ 무엇이 어수선했나
     머리줄에 여덟 덩이가 있었고, 그중 «돈 이야기가 둘»로 갈라져 있었다 —
     「이번 달 ₩10,592」와 「AI 판독 ₩44 / 30,000」. 훑을 때마다 어느 쪽이
     무엇인지 다시 읽어야 했다.

   ■ 「다」안이 하는 일
     ⓐ 딱지 둘을 한 상자(#moneyBox)에 넣어 «붙여 세운다».
     ⓑ 권한 이름「(admin)」은 접고 덧말로 옮긴다. 직책이 이미 같은 말을 한다.
     ⓒ 「서버 연결됨」은 머리줄에서 「연결됨」으로 줄인다.

   ■ 어기면 안 되는 것
   ⚠ 둘 다 감춰지면 **상자째** 감춘다 — 안 그러면 빈 테두리만 머리줄에 남는다.
   ⚠ 한쪽만 떠 있으면 **붙이지 않는다** — 한쪽 모서리만 각진 딱지는 그리다 만 것으로 보인다.
   ⚠ **사번은 접지 않는다.** P005·A005 처럼 숫자가 같은 사번이 있어, 안 보이면
     엉뚱한 계정으로 들어간 것을 알아챌 길이 없다.
   ⚠ 연결이 **끊겼거나 확인 중일 때는 긴 말 그대로** 둔다. 그때가 정작 읽어야 할 때다. */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripComments } = require('./strip-comments');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(R, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');
const ENTER = stripComments(RAW);

test('① ★★ 딱지 둘이 «한 상자» 안에 있다 — 그것이 붙여 세우는 유일한 길이다', function () {
  const at = ENTER.indexOf('id="moneyBox"');
  assert.ok(at > 0, '★★ 돈 상자가 없습니다 — 딱지 둘이 여전히 따로 섭니다');
  /* 상자가 닫히기 «전»에 딱지 둘이 다 들어 있어야 한다 */
  const 끝 = ENTER.indexOf('</div>', ENTER.indexOf('</button>', ENTER.indexOf('id="aiChip"')));
  const 안 = ENTER.slice(at, 끝);
  assert.ok(안.indexOf('id="billChip"') > 0, '★★ 사용액 딱지가 상자 밖에 있습니다');
  assert.ok(안.indexOf('id="aiChip"') > 0, '★★ AI 딱지가 상자 밖에 있습니다');
});

test('② ★★ 둘 다 감춰지면 «상자째» 감춘다 — 빈 테두리만 남으면 안 된다', function () {
  const fn = cutFn(ENTER, 'function moneyBoxSync(');
  assert.ok(fn, '★★ 상자를 여닫는 자리가 없습니다');
  assert.match(fn, /box\.style\.display = \(bOn \|\| aOn\) \? 'inline-flex' : 'none'/,
    '★★ 딱지가 다 감춰져도 상자가 남습니다');
});

test('③ ★ 한쪽만 떠 있으면 «붙이지 않는다»', function () {
  const fn = cutFn(ENTER, 'function moneyBoxSync(');
  assert.match(fn, /box\.dataset\.join = \(bOn && aOn\) \? '1' : '0'/,
    '★ 한쪽만 있는데 모서리를 잘라 붙인 척합니다');
  /* 붙이는 모양은 «둘 다 있을 때만» 걸린다 */
  const css = ENTER.slice(ENTER.indexOf('#moneyBox{'), ENTER.indexOf('#moneyBox{') + 400);
  assert.match(css, /#moneyBox\[data-join="1"\] #billChip\{[^}]*border-radius:9px 0 0 9px/,
    '★★ 붙이는 모양이 join 과 상관없이 늘 걸립니다');
  assert.match(css, /#moneyBox\[data-join="1"\] #aiChip\{[^}]*border-radius:0 9px 9px 0/,
    '★★ AI 딱지 쪽 모서리가 안 맞물립니다');
});

test('④ ★★ 딱지를 «감추고 켜는 길마다» 상자를 맞춘다 — 한 군데만 빠져도 옛 모양이 남는다', function () {
  ['function billStart(', 'function aiChipStart(', 'function billPaint(', 'function aiChipPaint(']
    .forEach(function (n) {
      const fn = cutFn(ENTER, n);
      assert.ok(fn, n + ' 자리를 못 찾았습니다');
      /* ⚠ 「어딘가에 moneyBoxSync 가 있다」로는 모자란다 — 감추는 길에만 있고 켜는 길에
         없으면 딱지가 떠도 상자는 닫힌 채다. **켜는 줄 바로 다음에** 있어야 한다. */
      const 켬 = /display = 'inline-flex';\s*\n?\s*moneyBoxSync\(\);/;
      if (/display = 'inline-flex'/.test(fn)) {
        assert.match(fn, 켬, '★★ ' + n + ' 이 딱지를 켜고도 상자를 안 맞춥니다');
      }
      if (/style\.display/.test(fn)) {
        assert.match(fn, /moneyBoxSync\(\)/,
          '★★ ' + n + ' 이 딱지만 여닫고 상자를 안 맞춥니다');
      }
    });
});

test('⑤ ★★ 되돌아가는(return) 길에서도 상자를 맞춘다', function () {
  ['function billPaint(', 'function aiChipPaint('].forEach(function (n) {
    const fn = cutFn(ENTER, n);
    /* 「감춘다 → 돌아간다」 사이에 상자 맞추기가 끼어 있어야 한다 */
    assert.match(fn, /display = 'none'; moneyBoxSync\(\); return;/,
      '★★ ' + n + ' 이 딱지만 감추고 그대로 돌아갑니다 — 빈 테두리가 남습니다');
  });
});

test('⑥ ★ 권한 이름「(admin)」은 접고 덧말로 옮긴다', function () {
  assert.match(ENTER, /\.pbar \.pmeta \.un-role\{display:none;\}/,
    '★ (admin) 이 아직 머리줄에 그대로 있습니다');
  const at = ENTER.indexOf("$('userName').title");
  assert.ok(at > 0, '이름 덧말을 짓는 자리를 못 찾았습니다');
  assert.match(ENTER.slice(at, at + 260), /role/,
    '★★ 접기만 하고 덧말에 안 남겼습니다 — 권한을 확인할 길이 없어집니다');
});

test('⑦ ★★ «사번»·로그인 이메일은 화면 어디에도 안 적는다 — 이름만 (대표 결정 2026-10-25)', function () {
  const at = ENTER.indexOf("$('userName').innerHTML");
  assert.ok(at > 0, '이름 칸을 짓는 자리를 못 찾았습니다');
  /* ⚠ 그 «한 문장»만 본다. 넉넉히 잘라 보면 이웃 줄이 섞여 검사가 헛돈다. */
  const 구역 = ENTER.slice(at, ENTER.indexOf(';', at) + 1);
  assert.match(구역, /\bname\b/, '이름 칸에서 이름이 사라졌습니다');
  assert.doesNotMatch(구역, /mySid|email/, '★★ 머리 이름 칸에 사번·이메일이 끼었습니다 — 로그인 아이디가 화면에 보입니다');
  /* 마우스를 올리면 보이는 덧말(title)과 내 메뉴 맨 위(meWho)도 «보이는 것»이다 */
  const t0 = ENTER.indexOf("$('userName').title");
  assert.ok(t0 > 0, '이름 덧말을 짓는 자리를 못 찾았습니다');
  const 덧말 = ENTER.slice(t0, ENTER.indexOf(';', t0) + 1);
  assert.doesNotMatch(덧말, /mySid|email|로그인 계정/, '★★ 덧말에 사번·이메일(로그인 아이디)이 끼었습니다');
  const w0 = ENTER.indexOf("$('meWho').innerHTML");
  assert.ok(w0 > 0, '내 메뉴 맨 위를 짓는 자리를 못 찾았습니다');
  const 메뉴 = ENTER.slice(w0, ENTER.indexOf(';', w0) + 1);
  assert.doesNotMatch(메뉴, /mySid|email/, '★★ 내 메뉴 맨 위에 사번·이메일이 끼었습니다');
});

test('⑧ ★★ 잘 될 때만 「연결됨」 — 끊겼을 때는 긴 말 그대로다', function () {
  const fn = cutFn(ENTER, 'function setConnectionStatus(');
  assert.ok(fn, '연결 상태 짓는 자리를 못 찾았습니다');
  assert.match(fn, /var barLabel = online \? '연결됨' : label;/,
    '★★ 끊겼을 때까지 줄여 버리면 정작 읽어야 할 말이 사라집니다');
  /* 로그인 화면(topStatusText)은 긴 말 그대로 — 거기서는 줄이 넉넉하다 */
  assert.match(fn, /topText\.textContent = label;/,
    '★ 로그인 화면의 말까지 줄였습니다');
  assert.match(fn, /portalText\.title = label/, '★ 줄인 말의 전문을 덧말에 안 남겼습니다');
});

/* 2026-10-24 대표 머리 카드 1안 「아바타 하나」 — 돈 상자는 머리줄을 떠나 «내 메뉴»(#meMenu) 안으로 들어갔다.
   그래서 «머리줄 몇째 자리에 앉는가»(옛 ⑨)는 더 지킬 것이 없다. 남는 규칙은 둘:
   상자째 내 메뉴 안에 있을 것 · 딱지 하나에 자리잡기(order·margin)를 걸지 않을 것(상자와 다툰다). */
test('⑨ ★ 돈 상자는 «상자째» 내 메뉴 안에 있다 — 딱지에 자리잡기를 따로 걸지 않는다', function () {
  const 메뉴 = ENTER.indexOf('id="meMenu"');
  const 끝 = ENTER.indexOf('id="meBtn"');
  assert.ok(메뉴 > 0 && 끝 > 메뉴, '★★ 내 메뉴 자리를 못 찾았습니다');
  const 안 = ENTER.slice(메뉴, 끝);
  assert.ok(안.indexOf('id="moneyBox"') > 0, '★★ 돈 상자가 내 메뉴 밖(머리줄)에 남았습니다');
  const at = ENTER.indexOf('.pbar #billChip,.pbar #aiChip{padding:4px 8px');
  assert.ok(at > 0, '폰용 딱지 규칙을 못 찾았습니다');
  assert.ok(!/order:|margin-top:/.test(ENTER.slice(at, at + 90)),
    '★★ 딱지에 order·margin 이 남아 있습니다 — 상자와 서로 다투게 됩니다');
});
