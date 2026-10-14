/* 자료함 «주소» 미리보기는 https 만 (2026-10-14 사무실 보안 검토)
 *
 * ■ 왜
 *   자료(pucards/materials)의 url 을 iframe 에 그대로 넣었다. esc 는 따옴표만 막아
 *   javascript: 주소가 그대로 지나간다 — 누군가 그 칸에 심어 두면, 직원이 미리보기를 누르는
 *   순간 우리 화면 주소(nabaho.github.io)에서 스크립트가 돈다. 그 주소의 앱 열다섯 개 전부의
 *   로그인 증표가 그 스크립트에게 열린다.
 *
 * ■ 무엇을 보나 — 거르개를 떠서 «돌려» 본다. 그리고 미리보기가 그 거르개를 지난 값만 쓰는가.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const H = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');

function 한줄(head) {
  const at = H.indexOf(head);
  assert.ok(at >= 0, head + ' 를 못 찾았습니다');
  return H.slice(at, H.indexOf('\n', at));
}
const ctx = { String: String };
vm.createContext(ctx);
vm.runInContext(한줄('function matSafeUrl(u)') + '\nthis.__f = matSafeUrl;', ctx);
const safe = ctx.__f;

test('★★ javascript:·data:·http: 주소는 비운다', () => {
  for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<script>1</script>',
    'http://example.com/a.pdf', 'vbscript:x', '//example.com/a', 'https://a.com/"onload="x', '']) {
    assert.equal(safe(bad), '', bad + ' 가 통과합니다');
  }
});

test('https 주소는 그대로 연다 — 거르개가 모두 막아 버리면 미리보기가 죽는다', () => {
  assert.equal(safe('https://drive.google.com/file/d/abc/preview'), 'https://drive.google.com/file/d/abc/preview');
  assert.equal(safe('  https://example.com/x.pdf  '), 'https://example.com/x.pdf');
});

test('★★ 미리보기 iframe 은 거른 값만 쓴다 — m.url 을 바로 넣지 않는다', () => {
  const at = H.indexOf('async function fillMatPreview(id)');
  const body = H.slice(at, H.indexOf('\n}\n', at)).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(body, /src="\$\{esc\(m\.url\)\}"/, '★★ m.url 을 거르지 않고 iframe 에 넣습니다');
  assert.match(body, /matSafeUrl\(m\.url\)/, '거르개를 안 지납니다');
});
