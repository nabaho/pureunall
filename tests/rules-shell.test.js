/* 취업규칙 갈래 단추(🏢·✏️·📚·📥)는 «한 자리»에 서 있는다 (대표 지시 2026-10-05 「이부분 위치가 안바뀌고 고정위치로」)

   ■ 무엇이 있었나 (1500px 실측)
     ✏️ 검토·개정(rules.html)  — 단추 묶음 x 147 · y 7  · 폭 367 · 머리줄 높이 45
     🏢·📚·📥 (rules-v2.html)   — 단추 묶음 x 152 · y 11 · 폭 386 · 머리줄 높이 51
   두 파일이 머리줄을 «제각각» 짜서(여백·로고 크기·로고 옆 글·글꼴·이름 접는 폭 1200/1100) 갈래를 누를 때마다 단추가 튀었다.

   ■ 지키는 규칙
     ① 머리줄 «왼쪽 묶음»(로고·이름)과 갈래 단추의 모양은 css/rules-shell.css «한 벌»에만 있다 — 두 파일이 함께 싣는다
     ② 두 파일의 왼쪽 묶음 표시(로고 글자·이름)가 같다 — 단추 앞에 다른 것이 끼지 않는다
     ③ 페이지 안에는 .rmode 모양이 따로 없다 — 두 벌이면 또 갈린다
     ④ 한 벌 css 는 페이지 <style> «뒤»에 싣는다 — 같은 세기의 규칙이 이기려면 뒤여야 한다
   실제 자리는 브라우저로 쟀다(1500·1300·1100·900·760px — 두 파일에서 단추 묶음 x·y·폭이 같다).
   실행: node --test tests/rules-shell.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const FILES = ['rules.html', 'rules-v2.html'];

test('① 한 벌 css 가 있다 — 왼쪽 묶음·갈래 단추 모양', () => {
  const css = R('css/rules-shell.css');
  ['.rs-head', '.rs-logo', '.rs-name', '.rmode', '.rmode a'].forEach((sel) => {
    assert.ok(css.includes(sel + '{') || css.includes(sel + ' {') || css.includes(sel + ','), sel + ' 이 한 벌 css 에 없다');
  });
});

test('①④ 두 파일이 한 벌 css 를 «자기 <style> 뒤»에 싣는다 — 캐시 번호도', () => {
  FILES.forEach((f) => {
    const s = R(f);
    const at = s.search(/<link rel="stylesheet" href="css\/rules-shell\.css\?v=\d+">/);
    assert.ok(at > 0, f + ' 가 css/rules-shell.css 를 안 싣는다');
    const styleEnd = s.indexOf('</style>');
    assert.ok(at > styleEnd, '★ ' + f + ' — 한 벌 css 가 페이지 <style> 앞에 있어 같은 세기의 페이지 규칙에 진다');
  });
});

test('② 두 파일의 머리줄 왼쪽 묶음이 같다 — 갈래 단추 앞에 다른 것이 안 낀다', () => {
  const left = (f) => {
    const s = stripComments(R(f));
    const h = s.match(/<(header|div) class="[^"]*rs-head[^"]*"[^>]*>([\s\S]*?)<nav class="rmode"/);
    assert.ok(h, f + ' 머리줄에 rs-head 가 없다');
    return h[2].replace(/\s+/g, '');
  };
  assert.equal(left('rules.html'), left('rules-v2.html'), '★ 단추 앞 묶음이 두 파일에서 다르다 — 단추 자리가 튄다');
  assert.match(left('rules.html'), /rs-logo/);
  assert.match(left('rules.html'), /rs-name/);
});

test('③ 페이지 안에 .rmode 모양을 따로 두지 않는다 — 두 벌이면 또 갈린다', () => {
  FILES.forEach((f) => {
    const style = stripComments(R(f)).split('</style>')[0];
    assert.doesNotMatch(style, /(^|[}\s,])\.rmode\b[^{]*\{/, '★ ' + f + ' 의 <style> 안에 .rmode 규칙이 남았다');
  });
});

test('두 파일이 같은 웹글꼴을 싣는다 — 안 실으면 같은 글자도 폭이 달라 단추가 튄다(실측 15px)', () => {
  const font = (f) => (R(f).match(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?[^"]+" rel="stylesheet">/) || [''])[0];
  assert.ok(font('rules.html'), 'rules.html 웹글꼴이 없다');
  assert.equal(font('rules-v2.html'), font('rules.html'), '★ 두 파일의 웹글꼴이 다르다');
});

test('🏢·📚·📥 상자는 화면 좌우 끝까지 — 폭 상한을 두지 않는다 (대표 지시 2026-10-05)', () => {
  const css = R('rules-v2.html').split('</style>')[0];
  ['#lib', '#topics', '#sites'].forEach((sel) => {
    const m = css.match(new RegExp(sel + '\{[^}]*\}'));
    assert.ok(m, sel + ' 규칙이 없다');
    assert.doesNotMatch(m[0], /max-width:\s*\d/, '★ ' + sel + ' 에 폭 상한이 남았다 — 넓은 화면 양옆이 빈다');
  });
});
