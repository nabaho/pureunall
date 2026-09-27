/* 사진첩 판독 띠 — #home 의 큰 단추 규칙이 띠 단추에 새지 않는다 (대표 화면 2026-09-27)
 *
 *   「화면에서 잘린 부분 다시 검토하고 그 부분 다시 컴팩트하게 수정해 달라」
 *
 * 두 띠(#readAskBar·#collectBar)는 #home «안»에 있다. #home .pri 는 「사진 올리기」 큰 단추
 * 것이라 너비 100%·넓은 여백·15px 인데, 그것이 띠의 파란 단추에 새어 들어와
 * 「📄 서류입니다」가 폭을 통째로 먹고 「🖼 그냥 사진」이 화면 밖으로 밀려났다.
 *
 * ⚠ 값을 박지 않는다 — «이기는 규칙이 있는가»와 «너비를 되돌리는가»를 본다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8');
const CSS = (RAW.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

function ruleBody(selRe) {
  const m = CSS.match(new RegExp(selRe.source + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
}

test('★ 전제: 두 띠가 정말 #home 안에 있다 — 아니면 이 검사는 헛돈다', () => {
  const home = RAW.indexOf('<div id="home">');
  assert.ok(home > 0, '#home 이 없습니다');
  ['readAskBar', 'collectBar'].forEach(function (id) {
    assert.ok(RAW.indexOf('id="' + id + '"', home) > home, id + ' 가 #home 앞에 있습니다 — 전제가 바뀌었으니 이 검사를 다시 보세요');
  });
  assert.match(ruleBody(/#home \.pri/), /width:\s*100%/,
    '#home .pri 에서 너비 100% 가 사라졌다면 이 검사의 까닭도 사라진 것입니다 — 함께 정리하세요');
});

test('★★★ 띠 단추가 #home .pri 의 «너비 100%»를 되돌린다 — 안 되돌리면 한 단추가 띠를 다 먹는다', () => {
  ['readAskBar', 'collectBar'].forEach(function (id) {
    const re = new RegExp('#home #' + id + ' button[^{]*\\{([^}]*)\\}');
    const hit = CSS.match(re) || CSS.match(new RegExp('#home #' + id + ' button\\s*,[^{]*\\{([^}]*)\\}'));
    let body = hit ? hit[1] : '';
    if (!body) {
      /* 여러 선택자를 한 규칙에 묶은 꼴도 받는다 */
      const all = CSS.match(new RegExp('([^{}]*#home #' + id + ' button[^{}]*)\\{([^}]*)\\}'));
      body = all ? all[2] : '';
    }
    assert.ok(body, '★★ #home #' + id + ' button 규칙이 없습니다 — #home .pri 가 이깁니다');
    assert.match(body, /width:\s*auto/, '★★★ #' + id + ' 단추가 너비를 안 되돌립니다');
  });
});

test('★★ 폰에서는 긴 설명·셈·단추 꼬리를 접는다 — 한 줄에 제목과 단추 둘이 다 들어가게', () => {
  const m = CSS.match(/@media \(max-width:560px\)\{([\s\S]*?\})\s*\}/g) || [];
  const phone = m.join('\n');
  assert.match(phone, /#readAskBar \.d/, '★ 폰에서 긴 설명이 단추 자리를 먹습니다');
  assert.match(phone, /#readAskBar \.lg/, '★ 폰에서 단추 꼬리(「입니다」·「그냥」)를 안 접습니다');
  const fn = stripJs(cutFn(RAW, 'function renderReadAsk('));
  assert.match(fn, /📄 서류<span class="lg">/, '★ 「서류입니다」 단추에 접히는 꼬리가 없습니다');
  assert.match(fn, /🖼 <span class="lg">/, '★ 「그냥 사진」 단추에 접히는 꼬리가 없습니다');
});
