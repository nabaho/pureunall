/* 뉴스레터 «자동화 점검» — 「기사 모으기」 칸이 거짓 경고를 안 띄운다 (2026-10-15)
   ═══════════════════════════════════════════════════════════════════════
   대표 화면(자동화 점검 탭)에 「기사 모으기 ⚠ 없음 뒤로 멈춤」이 떠 있었다. 살아 있는 값을 읽어 보니
   homepage/newsBrief/모은날 = 오늘(2026-10-15) · 모은수 21 · 탈 없음 — 모으기는 «정상»이었다.

   ★ 원인: 화면이 `App.브리핑.모은날` 을 읽었는데 App.브리핑 은 homepage/newsBrief/«모음»(기사 목록)이다.
     «모은날»은 모음 «밖»(newsBrief 바로 아래 문자열 하나)에 있으므로 그 칸은 늘 «없다» → 모으기가 멀쩡해도 늘 경고.
     감시꾼을 만든 날(2026-10-04)부터 그랬다. 사람이 「정말 멈췄나」를 매번 확인하게 만드는 거짓 경고는
     진짜 경고를 묻는다.
   ★ 이 검사는 «화면이 읽는 자리»와 «서버가 쓰는 자리»가 같은지를 본다 — 값이 아니라 규칙이다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 주석걷기, 함수몸 } = require('./helpers/strip-comments.js');

const 뿌리 = path.join(__dirname, '..');
const 화면 = 주석걷기(fs.readFileSync(path.join(뿌리, 'pu-news.html'), 'utf8'));
const 서버 = 주석걷기(fs.readFileSync(path.join(뿌리, 'functions', 'index.js'), 'utf8'));

test('★★★ 점검 화면은 «모은날»을 서버가 쓰는 그 자리(homepage/newsBrief/모은날)에서 읽는다', () => {
  const 읽기 = 함수몸(화면, '감시읽기');
  assert.ok(읽기, '감시읽기 를 못 찾았다');
  assert.match(읽기, /homepage\/newsBrief\/모은날/, '★★★ 모은날을 제 자리에서 안 읽는다 — 모으기가 멀쩡해도 늘 「멈춤」 경고가 뜬다');
  /* 서버는 homepage/newsBrief «바로 아래»에 모은날을 쓴다 — 화면이 읽는 자리와 같아야 한다 */
  assert.match(서버, /const 자리 = getDatabase\(\)\.ref\("homepage\/newsBrief"\);[\s\S]{0,2500}자리\.update\(\{ 모은날: 오늘/,
    '서버가 homepage/newsBrief 바로 아래에 모은날을 쓰는 곳을 못 찾았다(이 검사의 그물이 헐거워졌다)');
});

test('★★★ 「모음」(기사 목록)에서 모은날을 읽지 않는다 — 거기엔 그 칸이 없다', () => {
  const 점검 = 함수몸(화면, '감시화면');
  assert.ok(점검, '감시화면 을 못 찾았다');
  assert.ok(!/App\.브리핑/.test(점검), '★★★ 점검 화면이 App.브리핑(= 기사 목록 «모음»)에서 값을 읽는다 — 모은날은 모음 밖에 있다');
  assert.match(점검, /App\.모은날/, '점검 화면이 App.모은날 을 안 읽는다');
});

test('못 읽었으면 «멈췄다»고 단정하지 않는다 — 읽는 중(null)은 경고가 아니라 «기다림»', () => {
  const 점검 = 함수몸(화면, '감시화면');
  assert.match(점검, /모은날\s*===\s*null\s*\?\s*'… 읽는 중'/, 'null(못 읽음)을 「읽는 중」으로 안 말한다 — 못 읽은 것이 「멈춤」으로 보인다');
  assert.match(점검, /모은날\s*===\s*null\s*\?\s*'wait'/, 'null 이 경고(warn) 꼴로 그려진다');
  const 읽기 = 함수몸(화면, '감시읽기');
  assert.match(읽기, /catch\(_\)\{\s*App\.모은날\s*=\s*null/, '읽기가 실패해도 null 로 두지 않는다 — 빈 글자가 되면 다시 거짓 경고다');
});

test('경고는 «어제보다 오래된 날»일 때만 — 오늘·어제까지 모았으면 정상', () => {
  const 점검 = 함수몸(화면, '감시화면');
  assert.match(점검, /모은날\s*>=\s*어제\s*\?\s*'✓ 정상'/, '정상 조건(어제 이후)이 없다');
  assert.match(점검, /'⚠ '\s*\+\s*\(모은날\s*\|\|\s*'없음'\)\s*\+\s*' 뒤로 멈춤'/, '진짜 멈춤 경고가 사라졌다 — 거짓 경고를 없애려다 진짜 경고까지 지웠다');
});
