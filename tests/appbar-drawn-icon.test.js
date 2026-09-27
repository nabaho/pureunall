/* 앱바 목록(15px)에서 «그린 아이콘」(SVG)과 «그림글자」를 갈라 꽂는 자리
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-19 「2」 — 푸른 캘린더가 그림글자(⏰) 대신 그린 SVG 로 갔다.
   앱바 목록의 아이콘 칸은 여태 늘 `ic.textContent = a.icon` 이었다. SVG 문자열을
   그대로 textContent 로 넣으면 <svg...> 글자가 «그대로 찍힌다»(그려지지 않는다).

   ★ 지키려는 것
     ① 그림글자 앱은 예전 그대로 textContent 로 꽂는다 (다른 15곳을 안 건드린다)
     ② SVG 아이콘은 innerHTML 로 꽂고, 안의 <svg> 에 크기(100%)를 준다
     ③ 판가름은 «문자열이 SVG 로 시작하는가» 하나뿐이다 — 다른 조건을 늘리지 않는다

   ⚠ 이 자리를 실제로 도는 검사가 없었다(팝업을 여는 손잡이가 있어야 도는 코드라
     기존 앱바 검사들은 안 건드렸다). 글자만 보고 「됐다」고 하지 않으려고,
     흉내 DOM 에 innerHTML·querySelector 를 «진짜처럼» 만들어 돌려 본다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 앱바 = fs.readFileSync(path.join(ROOT, 'js', 'pu-appbar.js'), 'utf8');

/* 이름 없는 블록(중괄호로 못 찾음)이라 «시작 글자열」로 자르고, 뒤이어 오는
   `row.appendChild(ic);` 까지를 그대로 떼어 온다. */
function 아이콘칸코드() {
  const 시작 = "var ic = document.createElement('span');";
  const i = 앱바.indexOf(시작);
  assert.ok(i >= 0, '아이콘 칸 자리를 못 찾았습니다');
  const 끝표 = 'row.appendChild(ic);';
  const j = 앱바.indexOf(끝표, i);
  assert.ok(j >= 0, '아이콘 칸이 끝나는 자리를 못 찾았습니다');
  return 앱바.slice(i, j + 끝표.length);
}

/* 흉내 <span> — innerHTML 을 «진짜처럼» 파싱하지는 않지만(라이브러리 없이),
   <svg 로 시작하면 안에 svg 하나가 들었다고 보고 querySelector('svg') 가 그것을 돌려준다.
   width/height 를 실제로 «읽어서» 검사한다 — 「불렀는지」가 아니라 «값이 뭔지»를 본다. */
function 흉내엘리먼트() {
  const svgChild = { style: {} };
  const el = {
    style: {},
    _innerHTML: '', _textContent: '',
    get innerHTML() { return this._innerHTML; },
    set innerHTML(v) { this._innerHTML = v; },
    get textContent() { return this._textContent; },
    set textContent(v) { this._textContent = v; },
    querySelector(sel) {
      if (sel === 'svg' && /^<svg/.test(this._innerHTML)) return svgChild;
      return null;
    },
    __svgChild: svgChild
  };
  return el;
}

function 돌려본다(icon) {
  /* 코드가 «직접» document.createElement('span') 을 부른다 —
     흉내 엘리먼트를 미리 만들어 쥐여 주지 않는다(그러면 코드가 실제로 그 자리에서
     엘리먼트를 만드는지조차 안 보게 된다). */
  const row = { appendChild() {} };
  const 상자 = { document: { createElement: () => 흉내엘리먼트() }, row, a: { icon } };
  vm.createContext(상자);
  vm.runInContext(아이콘칸코드(), 상자);
  return 상자.ic;   /* vm 최상위 var 는 상자(context 객체)에 그대로 붙는다 */
}

test('① 그림글자는 예전 그대로 — textContent 로 꽂힌다', () => {
  const ic = 돌려본다('⏰');
  assert.strictEqual(ic.textContent, '⏰', '그림글자가 textContent 에 안 들어갔습니다');
  assert.strictEqual(ic.innerHTML, '', 'innerHTML 이 건드려졌습니다 — 다른 15개 앱의 모양이 바뀝니다');
  assert.match(ic.style.cssText, /font-size:15px/, '옛 꾸밈(font-size)이 없어졌습니다');
});

test('② SVG 아이콘은 innerHTML 로 꽂히고, 안의 svg 가 100% 크기를 받는다', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect/></svg>';
  const ic = 돌려본다(svg);
  assert.strictEqual(ic.innerHTML, svg, 'SVG 문자열이 innerHTML 로 안 들어갔습니다');
  assert.strictEqual(ic.textContent, '', 'textContent 로도 꽂혔습니다 — 글자 그대로(<svg...) 찍힙니다');
  assert.match(ic.style.cssText, /width:15px;height:15px/, '칸 크기(15px)가 없습니다');
  assert.strictEqual(ic.__svgChild.style.width, '100%', '안의 <svg> 가 칸을 안 채웁니다(width)');
  assert.strictEqual(ic.__svgChild.style.height, '100%', '안의 <svg> 가 칸을 안 채웁니다(height)');
});

test('③ 판가름은 «<svg 로 시작하는가» 하나뿐이다 — 글자 속에 <svg 가 섞여도 안 속는다', () => {
  /* "그림 설명: <svg 아님>" 처럼 앞에 다른 글자가 있으면 그림글자로 다룬다.
     indexOf(...) === 0 이 아니라 그냥 포함 여부로 갈랐으면 이 검사가 걸린다. */
  const ic = 돌려본다('메모 <svg 아님>');
  assert.strictEqual(ic.innerHTML, '', '<svg 가 맨 앞이 아닌데도 SVG 로 다뤘습니다');
  assert.strictEqual(ic.textContent, '메모 <svg 아님>', '그림글자 길로 안 갔습니다');
});
