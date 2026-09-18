'use strict';
/* 「지금 어떤 상태인가」를 화면 맨 위에 — 누를 것을 없앤다 (대표님 2026-09-18 「모르겠다 니가 직접하면 안되나」)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     나스가 안 붙는 까닭을 가려 드리려고 검은 실행 로그에 🔎 줄을 넣었다. 그런데 대표님이 하실 일이
     ① 설정에서 단추를 찾아 누르고 ② 검은 칸에서 그 줄을 찾아 ③ 사진을 찍어 보내는 것이었다.
     세 걸음이다. 그러다 「모르겠다 니가 직접하면 안되나」가 나왔다.
   ■ 내가 못 하는 것과 할 수 있는 것
     192.168.0.21 은 사무실 «안»에만 있는 주소다 — 클라우드에서 도는 나는 닿을 수 없다.
     그 안에서 잴 수 있는 것은 대표님 브라우저뿐이다. 그러니 **브라우저가 스스로 재고 스스로 말하게** 한다.
   ■ 그래서
     설정 화면을 여는 «그 순간» 스스로 재고, 검은 칸이 아니라 맨 위 큰 글씨로 답을 적는다.
     대표님이 하실 일은 화면을 여는 것 하나다.

   ★ 못 박는 것
     ① 화면을 열면 «스스로» 잰다 — 누를 것이 없다
     ② 설정(주소·계정)이 없으면 안 잰다 — 빈 설정으로 나스를 두드리지 않는다
     ③ 다시 그릴 때마다 로그인하지 않는다 — 딸린 것 없는 useEffect 한 번
     ④ 재는 동안에도 «재고 있다»고 말한다 — 빈 화면은 「안 되는 것」처럼 보인다
     ⑤ 답은 맨 위에, 검은 로그«보다 앞»에 — 찾아 헤매지 않게
     ⑥ 됐는지 안 됐는지가 «색»으로도 갈린다 — 글자만 바뀌면 넘어간다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');

const ROOT = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const NAS = cutFn(ERP, 'function NasBackupSettings(');

test('①★★ 화면을 열면 «스스로» 잰다 — 대표님이 누를 것이 없다', () => {
  assert.match(NAS, /useEffect\(function\s*\(\)\s*\{[\s\S]{0,400}?doTest\(\)/,
    '★★ 스스로 안 재면 대표님은 다시 「단추를 찾아 누르고 검은 칸에서 줄을 찾는」 세 걸음을 하셔야 한다');
});

test('② 설정이 없으면 안 잰다 — 빈 설정으로 나스를 두드리지 않는다', () => {
  const eff = NAS.slice(NAS.indexOf('useEffect(function'), NAS.indexOf('function toHttps('));
  assert.match(eff, /!cfg\.host \|\| !cfg\.user \|\| !cfg\.pass\) return;/,
    '★ 처음 쓰는 사람에게 «빈 계정»으로 로그인을 시도하면 로그만 더럽히고 답도 틀린다');
  assert.ok(eff.indexOf('return;') < eff.indexOf('doTest()'), '★ 걸러내기가 두드리기 뒤면 이미 두드린 뒤다');
});

test('③ 다시 그릴 때마다 로그인하지 않는다 — 딸린 것 없는 한 번', () => {
  const eff = NAS.slice(NAS.indexOf('useEffect(function'), NAS.indexOf('function toHttps('));
  assert.match(eff, /\}\s*,\s*\[\]\s*\)\s*;/,
    '★★ 딸린 것을 안 비우면 글자 한 자 고칠 때마다 나스에 로그인한다');
});

test('④ 재는 동안에도 «재고 있다»고 말한다 — 빈 화면은 안 되는 것처럼 보인다', () => {
  const eff = NAS.slice(NAS.indexOf('useEffect(function'), NAS.indexOf('function toHttps('));
  assert.match(eff, /set진단\(\{\s*ok:\s*null/, '★ 기다리는 동안 아무 말이 없으면 「또 안 되는구나」로 읽힌다');
  assert.match(eff, /보고 있습니다/);
});

test('⑤★ 답은 맨 위 — 검은 로그«보다 앞»에 둔다', () => {
  const 진단칸 = NAS.indexOf("'지금 상태'");
  const 로그칸 = NAS.indexOf('실행 로그');
  assert.ok(진단칸 > -1, '★ 「지금 상태」 칸이 없다 — 답이 다시 검은 칸으로 숨는다');
  assert.ok(로그칸 > -1 && 진단칸 < 로그칸,
    '★★ 답이 로그 뒤에 있으면 대표님은 또 스크롤해서 찾으셔야 한다 — 그게 「모르겠다」가 된 자리다');
  /* 줄바꿈이 살아야 읽힌다 — 한 덩어리로 붙으면 안 읽는다 */
  const 칸 = NAS.slice(진단칸 - 900, 진단칸 + 200);
  assert.match(칸, /whiteSpace:\s*'pre-line'/, '★ 여러 줄 안내를 한 줄로 붙이면 아무도 안 읽는다');
});

test('⑥ 됐는지 안 됐는지가 «색»으로도 갈린다', () => {
  const 진단칸 = NAS.indexOf("'지금 상태'");
  const 칸 = NAS.slice(진단칸 - 900, 진단칸 + 200);
  assert.match(칸, /진단\.ok === true \? '#f0fdf4'/, '★ 됐을 때 초록');
  assert.match(칸, /'#fef2f2'/, '★ 안 됐을 때 빨강 — 글자만 바뀌면 눈이 넘어간다');
  assert.match(칸, /진단\.ok === null/, '★ «아직 모름»을 «안 됨»과 같은 색으로 칠하면 겁만 준다');
});

test('⑦★ 성공하면 «더 하실 일이 없다»고 못 박는다 — 됐는지 안 됐는지 헷갈리지 않게', () => {
  const t = cutFn(ERP, 'function doTest(');
  assert.match(t, /set진단\(\{\s*ok:true/, '★ 성공을 안 적으면 화면은 옛 실패를 그대로 보인다');
  assert.match(t, /더 하실 일이 없습니다/,
    '★ 「연결 성공」만으로는 「그래서 이제 뭘 해야 하나」가 남는다');
});
