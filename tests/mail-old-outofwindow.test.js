/* 📦 지난 메일이 «POP3 창 밖»일 때 (2026-10-31)
   ═══════════════════════════════════════════════════════════════════════════
   실측(oldProbe): 담아 둔 지난 메일 23,155통 중 811통(가장 옛 2020-12~2021-03)이 다음메일 POP3 목록(최근 3만 통)에서
   «밀려나» 열 수 없다. 예전 안내는 「지워졌을 수 있습니다」였다 — 지운 게 아니라 «창 밖»이라 사실과 달랐고,
   화면은 빈 채였다. 이제 ① 서버가 «창 밖»이라고 말하고 ② 화면은 저장해 둔 앞부분을 함께 보여 준다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sliceFn } = require('./fnslice');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const SRV = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-sync.js'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

function errHtml(o, v) {
  const box = { String, MB_OLD_ID: '*old',
    esc: (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
  vm.createContext(box);
  vm.runInContext(sliceFn(HTML, 'function mbReadErrHtml(') + '\n;this.f = mbReadErrHtml;', box);
  return box.f(o, v);
}
const MSG = '다음메일 POP3 는 최근 3만 통만 열어 줘서 이 옛 메일은 여기서 못 엽니다';

test('★★★ 못 연 지난 메일은 «저장해 둔 앞부분»을 함께 보인다 — 빈 화면으로 두지 않는다', () => {
  const h = errHtml({ slug: '*old', uid: 'K1', err: MSG }, { p: '안녕하세요 근로계약서 건입니다' });
  assert.match(h, /열지 못했습니다 — 다음메일 POP3 는 최근 3만 통만/);
  assert.match(h, /안녕하세요 근로계약서 건입니다 …/, '저장해 둔 앞부분이 안 보인다');
});

test('★★★ 다음메일 폴더 메일(IMAP)의 «없다»에는 앞부분을 덧붙이지 않는다 — 지워진 메일을 보이면 안 된다', () => {
  const h = errHtml({ slug: 'INBOX-a', uid: '5', err: '그 메일이 없습니다 — 지워졌을 수 있습니다' }, { p: '지운 메일의 앞부분' });
  assert.doesNotMatch(h, /지운 메일의 앞부분/, '지워진 메일의 앞부분을 보여 준다');
  assert.match(h, /열지 못했습니다/);
});

test('★ 앞부분이 없는 지난 메일은 말만(앞부분 상자를 안 그린다) · 글자는 이스케이프한다', () => {
  assert.doesNotMatch(errHtml({ slug: '*old', err: MSG }, {}), /<pre/);
  assert.doesNotMatch(errHtml({ slug: '*old', err: MSG }, { p: '<img src=x onerror=1>' }), /<img src=x/, '앞부분을 HTML 로 넣는다');
  assert.doesNotMatch(errHtml({ slug: '*old', err: '<b>x</b>' }, null), /<b>x/, '오류 글을 HTML 로 넣는다');
});

test('★★ 읽는 화면이 이 함수를 쓴다 — 쓰지 않으면 앞부분이 안 보인다', () => {
  assert.match(strip(sliceFn(HTML, 'function mbReadHtml(')), /o\.err \? mbReadErrHtml\(o, v\)/);
});

test('★★★ 서버는 «창 밖»이라고 말한다 — 「지워졌을 수 있습니다」는 사실과 다른 말이었다', () => {
  const body = SRV.slice(SRV.indexOf('readOldMail: F'), SRV.indexOf('readMailAttachment: F'));
  const code = strip(body);
  assert.match(code, /outOfWindow: true/, '창 밖이라는 표시가 없다');
  assert.match(code, /최근 3만 통만 열어 줘서/, '왜 못 여는지 말하지 않는다');
  assert.doesNotMatch(code, /지워졌을 수 있습니다/, '옛 거짓 안내가 남았다');
});
