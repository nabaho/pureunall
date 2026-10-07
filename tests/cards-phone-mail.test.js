const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sliceFn } = require('./fnslice.js');   // 함수를 «통째로» 자른다(줄 수에 안 매인다)

const cards = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');

test('★ 메일 화면이 폰에서도 그려진다', () => {
  /* 메일 칸(#pcMail)이 PC 전용 틀(#pcRoot) 안에 있어 폰에서는 아예 안 그려졌다 —
     그래서 폰에는 메일 화면 «자체»가 없었다(대표 지시 2026-08-20 "폰에서도 쓰게"). */
  assert.match(cards, /if\(!document\.body\.classList\.contains\('pc'\)\) return renderMailMobile\(\);/,
    '★ PC 칸만 보고 있으면 폰에서는 아무것도 안 그려집니다.');
  assert.match(cards, /function renderMailMobile\(\)/);
  /* 폰 render 가 메일 화면으로 가야 한다 — 안 가면 목록이 그대로 남는다 */
  const fn = sliceFn(cards, 'function render(){');
  assert.match(fn, /if\(state\.view==='mail'\) return renderMailMobile\(\);/);
});

test('폰 메일은 PC 것을 그대로 쓴다 — 폰용을 따로 만들지 않는다', () => {
  /* 따로 만들면 메일에 손댈 때마다 두 곳을 고쳐야 하고, 언젠가 한쪽만 고친다. */
  const fn = sliceFn(cards, 'function renderMailMobile()');
  ['schedBoxHtml()', 'sentBoxHtml()', 'mailWriteHtml()'].forEach(function (f) {
    assert.ok(fn.includes(f), f + ' 를 안 쓰고 폰용을 따로 만들었습니다.');
  });
  assert.match(fn, /wireMailWrite\(\)/, '쓰기 화면의 배선을 안 걸면 보내기가 안 먹습니다.');
});

/* ── 2026-10-07 대표 지시 「메일함을 보일 필요없다. 메일 수신 등에 대한부분은 메일함에서
   찾으면 된다 2중으로 할 필요없다」 — 기업정보함 ☰ 메뉴에서 메일 묶음을 뺐다.
   메일 화면들은 그대로 살아 있고, 들어가는 길은 «메일함 앱(?view=mail) 서랍» 하나다.
   ⚠ 그래서 지킬 것이 둘이다: ① 기업정보함 메뉴에 메일이 다시 끼지 않는다
     ② 메뉴에서만 닿던 칸이 서랍에서 사라지지 않는다(안 그러면 그 화면에 갈 길이 없어진다). */
const drawer = (() => {
  const at = cards.indexOf('function mbDrawerHtml(');
  return cards.slice(at, cards.indexOf('\nfunction ', at + 10));
})();

test('★ 메일 화면들로 가는 길은 메일함 서랍에 다 있다 — 뺀 메뉴 칸이 갈 곳을 잃지 않는다', () => {
  assert.ok(drawer.length > 100, 'mbDrawerHtml 을 못 찾았습니다');
  ['openSentBox()', 'openSchedBox()', 'openInbox()', 'openMatPage()', 'openCoThread()', 'addMailIcon()']
    .forEach(fn => assert.ok(drawer.includes(fn), '★ 메일함 서랍에 ' + fn + ' 가 없습니다 — 그 화면에 갈 길이 없어집니다'));
  /* 쓰기는 메일함 화면의 ✏️ 떠 있는 단추가 연다 */
  assert.match(cards, /dmm-fab[^\n]*openMailPage\(\)|openMailPage\(\)[^\n]*dmm-fab/, '★ 메일함에서 새 편지를 쓸 길이 없습니다');
  /* 나올 길 — 메일 화면 위 「‹ 목록」 */
  assert.match(cards, /class="mmback" onclick="closeMailPage\(\)"/,
    '★ 돌아갈 길이 없으면 메일 화면에 갇힙니다.');
});

test('★★ 기업정보함 ☰ 메뉴에는 메일 묶음이 없다 — 메일은 메일함에서만(두 벌 금지)', () => {
  assert.match(cards, /<div class="mhead"><b>☰ 메뉴<\/b>/);
  const at = cards.indexOf('function openMenu()');
  const menu = cards.slice(at, cards.indexOf('/* ════════════ 🗑 휴지통', at)).replace(/<!--[\s\S]*?-->/g, '');
  assert.ok(menu.includes("hd('🧹 정리')"), '메뉴를 못 읽었습니다');
  assert.ok(!menu.includes("hd('✉️ 메일')"), '★★ 메일 묶음이 기업정보함 메뉴에 다시 생겼습니다');
  ['openMailPage()', 'openInbox()', 'openSentBox()', 'openSchedBox()', 'openCoThread()']
    .forEach(fn => assert.ok(!menu.includes(fn), '★★ 기업정보함 메뉴에 ' + fn + ' 가 다시 생겼습니다'));
});

test('메일 화면에서는 명함 목록의 줄들을 접는다', () => {
  /* 갈래 줄·거르개 줄은 명함 목록 것이라 메일 화면에서는 누를 것이 없고,
     누르면 엉뚱한 데로 간다. */
  /* ⚠ 2026-09-02 에 이 줄을 고쳤다. 예전에는 선택자 «문장을 글자 그대로» 박아 두어,
     html 쪽 규칙을 더하자(첫 그림에서 스치던 것을 막느라) 깨졌다 —
     기능이 망가져서가 아니다. 지킬 것은 「감춰지는가」이지 「어떻게 적혔는가」가 아니다. */
  for (const 줄 of ['#tabs', '#subbar']) {
    assert.match(cards, new RegExp('mailview ' + 줄 + '\\b'),
      '메일 화면에서 ' + 줄 + ' 이 안 감춰집니다');
  }
  assert.match(cards, /\{display:none\}/, '감추는 규칙이 없습니다');
  assert.match(cards, /classList\.toggle\('mailview', state\.view==='mail'\)/);
});

test('이름이 「기업정보함」으로 바뀌었다 (PC·폰 모두)', () => {
  assert.match(cards, /<div class="logo">기업정보함<\/div>/, '폰 머리줄');
  assert.match(cards, /📇 푸른 기업정보함/, 'PC 옆줄');
  /* 탭 제목도 「기업정보함」 — 폰 머리줄·manifest·포털 타일과 같은 이름이어야 한다.
     2026-08-24 탭 이름 통일 전에는 여기만 「푸른 기업정보함」으로 혼자 달랐다. */
  assert.match(cards, /<title>기업정보함<\/title>/);
  const mf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pu-cards-manifest.json'), 'utf8'));
  assert.equal(mf.short_name, '기업정보함', '홈화면에 설치했을 때 뜨는 이름');
  /* 포털 쪽은 이미 「기업정보함」이었다 — 둘이 같은 말을 해야 한다 */
  const enter = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');
  assert.match(enter, /key:'cards',\s+name:'기업정보함'/);
});
