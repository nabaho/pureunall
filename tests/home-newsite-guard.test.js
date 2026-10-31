'use strict';
/* 새 사이트 지킴이 — 화면 쪽 (대표 지시 2026-10-31 「앞으로 이런 문제 없게 자동으로」 → 「둘 다」 · 목업 승인 전 보냄)
   ★ 막혔을 때만 맨 위에 띠 한 줄이 뜬다. 평소에는 아무것도 안 보인다.
   ★ 자동 연결 칸에 「새 사이트」 한 줄이 늘 있다.
   실제 화면 함수를 떼어 vm 에서 돌려 본다 — 글자 찾기만으로는 «뜨는가»를 알 수 없다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const HN = require('../functions/homepage-newsite.js');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8').replace(/\r\n/g, '\n');
const 주석뺌 = src.replace(/\/\*[\s\S]*?\*\//g, ' ');

function 함수(이름) {
  const i = src.indexOf('\nfunction ' + 이름 + '(');
  assert.ok(i >= 0, 이름 + ' 이 없습니다');
  const j = src.indexOf('\n}\n', i);
  return src.slice(i + 1, j + 2);
}
function 상자(App) {
  const box = { App, esc: (s) => String(s).replace(/</g, '&lt;'), stampShort: (ms) => '11/0' + (Number(ms) % 9) + ' 07:50' };
  vm.createContext(box);
  vm.runInContext(src.match(/\nconst 열쇠점검늦음ms = [^\n]+/)[0] + '\n'
    + ['새사이트띠', '새사이트띠Html', '새사이트줄'].map(함수).join('\n')
    + '\n;this.새사이트띠=새사이트띠;this.새사이트띠Html=새사이트띠Html;this.새사이트줄=새사이트줄;', box);
  return box;
}
const 지금 = 10 * 86400000;

test('★ 평소(열쇠 이상 없음·지난 올리기 성공)에는 띠가 아무것도 안 뜬다', () => {
  const b = 상자({ keyCheck: { at: 지금 - 3600000, ok: true, 까닭: '' }, newsite: { at: 1, ok: true, 올림: true, 인원: 7 } });
  assert.equal(b.새사이트띠(지금), null);
  const b2 = 상자({ keyCheck: null, newsite: null });
  assert.equal(b2.새사이트띠(지금), null, '아직 한 번도 안 돌았을 때 띠를 띄우면 배포 첫날부터 잔소리가 된다');
});

test('★ 열쇠가 막히면 빨간 띠 — 까닭과 고치는 법 단추', () => {
  const b = 상자({ keyCheck: { at: 지금, ok: false, 까닭: '새 사이트 — GitHub 401: Bad credentials' }, newsite: null });
  const 띠 = b.새사이트띠(지금);
  assert.equal(띠.색, 'red');
  assert.match(띠.말, /401/);
  b.Date = Date;
  const h = vm.runInContext('새사이트띠Html()', b);
  assert.match(h, /class="gband red"/);
  assert.match(h, /열쇠고치는법\(\)/, '고치는 법 단추가 없다');
});

test('★ 열쇠 점검이 «이상 없음»이어도 지난 자동 올리기 실패는 남는다 — 읽기는 되고 쓰기가 막힌 날이 있었다', () => {
  const b = 상자({ keyCheck: { at: 지금, ok: true }, newsite: { at: 지금 - 5, ok: false, 실패: 'GitHub 400: Body should be a JSON object' } });
  const 띠 = b.새사이트띠(지금);
  assert.equal(띠.색, 'red');
  assert.match(띠.말, /400/);
  assert.match(b.새사이트줄(), /실패/);
});

test('★ 손으로 다시 올려 성공하면 실패 띠가 사라진다', () => {
  const b = 상자({ keyCheck: { at: 지금, ok: true }, newsite: { at: 지금, ok: true, 올림: true, 수동: true } });
  assert.equal(b.새사이트띠(지금), null);
  assert.match(b.새사이트줄(), /손으로 올림/);
});

test('★ 한꺼번에 많이 빠져 멈추면 노란 띠, 점검이 며칠째 안 돌면 노란 띠', () => {
  const b = 상자({ keyCheck: { at: 지금, ok: true }, newsite: { at: 지금, ok: true, 멈춤: '한 번에 4명이 빠지게 되어 올리지 않았습니다' } });
  assert.equal(b.새사이트띠(지금).색, 'amber');
  const 늦음 = 상자({ keyCheck: { at: 지금 - HN.점검늦음ms - 1, ok: true }, newsite: null });
  const 띠 = 늦음.새사이트띠(지금);
  assert.equal(띠 && 띠.색, 'amber', '★ 매일 돌아야 할 점검이 멈춰도 아무도 모른다');
  assert.equal(상자({ keyCheck: { at: 지금 - HN.점검늦음ms + 60000, ok: true } }).새사이트띠(지금), null, '하루 이틀 빠진 것은 봐준다');
});

test('늦음 기준은 서버와 같다', () => {
  const b = 상자({});
  assert.equal(vm.runInContext('열쇠점검늦음ms', b), HN.점검늦음ms);
});

test('★ 자동 연결 칸의 「새 사이트」 줄 — 올림·바뀐 것 없음·아직 안 돎', () => {
  assert.match(상자({ newsite: { at: 1, ok: true, 올림: true, 인원: 7, 뺀수: 2 } }).새사이트줄(), /올림 7명 · 2명 뺌/);
  assert.match(상자({ newsite: { at: 1, ok: true, 올림: false } }).새사이트줄(), /바뀐 것 없음/);
  assert.equal(상자({ newsite: null }).새사이트줄(), '아직 안 돎');
});

test('★ 띠는 맨 위 띠 바로 아래에 붙고, 자동 연결 칸에 「새 사이트」 줄이 있다 · 두 기록을 읽는다', () => {
  const s = 함수('screen');
  assert.ok(s.indexOf('새사이트띠Html()') > s.indexOf('appbarHtml()'), '띠가 위 띠 아래에 없다');
  assert.match(함수('자동카드Html'), /줄\('새 사이트', esc\(새사이트줄\(\)\)\)/);
  assert.match(주석뺌, /db\.ref\('homepage\/auto\/newsite'\)/);
  assert.match(주석뺌, /db\.ref\('homepage\/auto\/keyCheck'\)/);
  assert.match(주석뺌, /App\.newsite = newsite/);
  assert.match(주석뺌, /App\.keyCheck = keyCheck/);
});

test('띠는 한 줄이다 — 넘치면 말줄임(…)으로 자르고 전문은 title 에', () => {
  const css = src.match(/\.gband\{[^}]*\}/)[0];
  assert.match(css, /white-space:nowrap/);
  assert.match(src, /\.gband \.how\{[^}]*text-overflow:ellipsis/);
  assert.match(함수('새사이트띠Html'), /title="/);
});
