'use strict';
/* 대표 폰에서 «휴대폰 연결» 길이 보여야 한다 (2026-11-22)
   대표: 「재무관리 화면에 환경 설정이 안 보인다 — 설정이 나와야 숫자(연결번호)를 연결시킬 수 있다」.
   길은 있었다(⚙ 도구 → 📱 하나문자 ▾ → 🔗 휴대폰 연결, 또는 막힌 표 → 고치는 창). 그런데 «멀쩡히 연결됨»
   으로 보이는 표는 글자뿐이라, 앱을 새로 깔았을 때 번호를 받을 길이 ⚙ 뒤에 숨어 있었다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
function cutBlock(src, header) {
  const i = src.indexOf(header);
  assert.ok(i >= 0, '못 찾음: ' + header);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + header);
}

test('연결 상태 표: 대표(isOwner)에게는 멀쩡한 표도 «누를 수 있고», 누르면 연결번호 창이 열린다', () => {
  const chip = bare(cutBlock(ERP, 'function hanaStatChip(){'));
  const at = chip.indexOf('if(_meNow().isOwner) return h(\'button\'');
  assert.ok(at > 0, '★ 대표에게 멀쩡한 표가 글자뿐이다 — 앱을 새로 깔면 연결번호 받을 길이 안 보인다');
  assert.ok(chip.slice(at, chip.indexOf("return h('span'", at)).includes('setHanaFix(true)'),
    '★ 눌러도 연결번호가 있는 창이 안 열린다');
  assert.ok(at < chip.indexOf("return h('span'"), '★ 글자뿐인 표가 먼저 반환된다');
});

test('대표 전용을 넓히지 않는다 — 대표 아닌 사람에게는 여전히 글자뿐인 표다', () => {
  const chip = bare(cutBlock(ERP, 'function hanaStatChip(){'));
  assert.match(chip, /return h\('span',\{title:tip/, '대표 아닌 사람의 표가 사라졌다');
  assert.doesNotMatch(chip.slice(chip.indexOf('if(_meNow().isOwner)') - 20, chip.indexOf('if(_meNow().isOwner)')),
    /isAdmin/, '대표 전용이 관리자까지 넓어졌다');
});

test('연결 창이 «8자리 번호 받기» 를 갖고, 제목이 «연결» 임을 말한다', () => {
  const fix = bare(cutBlock(ERP, 'function hanaFixModal(){'));
  assert.ok(fix.includes('startHanaSmsPair()'), '연결번호 받기 단추가 없다');
  assert.ok(fix.includes('휴대폰 연결'), '창 제목이 연결이라고 말하지 않는다');
});

test('연결 창을 바로 여는 링크(?hanaPair=1): 대표만, «창만» 열고, 꼬리표를 지우고, 번호는 만들지 않는다', () => {
  const at = ERP.indexOf("q.get('hanaPair') !== '1'");
  assert.ok(at > 0, '★ ?hanaPair=1 링크가 없다 — 폰에서 번호 받는 길을 못 찾는다');
  const seg = bare(ERP.slice(at - 120, at + 700));
  assert.ok(seg.includes('setHanaFix(true)'), '창을 안 연다');
  assert.ok(seg.includes('_meNow().isOwner'), '대표가 아닌 사람도 열린다');
  assert.ok(seg.includes('replaceState'), '꼬리표를 안 지운다 — 새로고침하면 또 열린다');
  assert.ok(!seg.includes('startHanaSmsPair'), '열기만 했는데 새 연결번호를 만든다');
  assert.ok(seg.indexOf('replaceState') < seg.indexOf('setHanaFix(true)'), '꼬리표를 지우기 전에 창이 열린다');
});
