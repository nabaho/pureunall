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

test('⑦ ★★ «사번»은 접지 않는다 — P005·A005 를 가르는 유일한 값이다', function () {
  const at = ENTER.indexOf("$('userName').innerHTML");
  assert.ok(at > 0, '이름 칸을 짓는 자리를 못 찾았습니다');
  /* ⚠ 그 «한 문장»만 본다. 넉넉히 잘라 보면 바로 아래 덧말 짓는 줄의 사번이 걸려,
     정작 이름 칸에서 사번을 빼도 검사가 통과한다(2026-09-12 이빨 확인에서 찾음). */
  const 구역 = ENTER.slice(at, ENTER.indexOf(';', at) + 1);
  assert.match(구역, /mySid.*toUpperCase\(\)/, '★★ 사번이 이름 칸에서 사라졌습니다');
  /* 사번을 감추는 css 가 생기면 안 된다 */
  assert.ok(!/\.un-sid\{display:none|un-sid[^{]*\{[^}]*display:none/.test(ENTER),
    '★★ 사번을 접는 규칙이 생겼습니다 — 엉뚱한 계정으로 들어간 것을 못 알아챕니다');
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

test('⑨ ★ 폰에서 자리잡기는 «상자»가 진다 — 딱지에 걸면 머리줄 첫 줄에 끼어든다', function () {
  assert.match(ENTER, /\.pbar #moneyBox\{order:2;flex:0 0 auto;margin-top:7px;\}/,
    '★★ 상자에 자리잡기가 안 걸려 있습니다');
  const at = ENTER.indexOf('.pbar #billChip,.pbar #aiChip{padding:4px 8px');
  assert.ok(at > 0, '폰용 딱지 규칙을 못 찾았습니다');
  assert.ok(!/order:|margin-top:/.test(ENTER.slice(at, at + 90)),
    '★★ 딱지에 order·margin 이 남아 있습니다 — 상자와 서로 다투게 됩니다');
});
