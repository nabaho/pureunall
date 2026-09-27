'use strict';
/* 「지금 기금인데 기존 자료를 불러오면 이름이 모두 다 잘못돼 있다」(대표 2026-09-27) — 실제 자료로 찾은 두 길.
 * ① 이 기금 전용 저장본(doc_edits)에 저장하던 때의 이름이 글자로 박혀 있다 — 이름을 바꾼 뒤 열면 옛 이름이 찍혔다.
 *    → 열 때 이 기금의 옛 이름(name_hist)을 지금 이름으로 바꿔 보인다.
 * ② [⬆ 원본 .hwp 등록]으로 올린 옛 서류는 [📄 HWP 편집]이 손대지 않고 연다 — 다른 기금 이름이 그대로 보였다.
 *    → 열 때 우리가 아는 다른 기금 이름을 찾아 알린다(채워 주는 길은 [📄 한글로 채워 열기]).
 * 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

const FUNDS = {
  A: { name: '가나다공동근로복지기금', short_name: '가나다기금', name_hist: { h1: { from: '가칭푸른', to: '가나다공동근로복지기금', at: '2026-09-13' } } },
  B: { name: '가나다공동근로복지기금2호', short_name: '가나다2호' },
  C: { name: '라마바사내근로복지기금', short_name: '라마바' },
  D: { name: '지운공동근로복지기금', deleted: true },
};
const A = (() => {
  const box = {};
  new Function(['var funds=' + JSON.stringify(FUNDS) + ';', 'function isTrashed(f){ return !!(f&&f.deleted); }',
    gF('nameHistOf'), gF('_fundOldNames'), gF('_docFixOldNames'), gF('_foreignFundNames'),
    'this.fix=_docFixOldNames; this.old=_fundOldNames; this.foreign=_foreignFundNames;'].join('\n')).call(box);
  return box;
})();

test('★ 저장본의 옛 이름 → 지금 이름 (제목·명칭·소재지 모두)', () => {
  const html = '<h1>가칭푸른 정관</h1><p>이 기금은 "가칭푸른"이라 칭한다. 가칭푸른 법인의 주된 사무소는…</p>';
  const r = A.fix(html, FUNDS.A);
  assert.equal(r.n, 3); assert.deepEqual(r.names, ['가칭푸른']);
  assert.ok(!r.html.includes('가칭푸른')); assert.equal(r.html.split('가나다공동근로복지기금').length - 1, 3);
});

test('옛 이름이 지금 이름 속에 들어 있으면 안 바꾼다 — 「가나」→「가나다」가 「가나다다」가 되지 않게', () => {
  const f = { name: '가나다공동근로복지기금', name_hist: { h: { from: '가나다공동' } } };
  assert.deepEqual(A.old(f), []);
  assert.equal(A.fix('가나다공동근로복지기금', f).n, 0);
});

test('두 글자 이하 옛 이름·자취 없는 기금은 손대지 않는다', () => {
  assert.deepEqual(A.old({ name: '가', name_hist: { h: { from: '푸른' } } }), []);
  assert.equal(A.fix('<p>아무 글</p>', { name: '가나다' }).n, 0);
});

test('★★ 옛 원본의 다른 기금 이름을 찾는다 — 이 기금 이름 속 짧은 이름(1호 ⊂ 2호)은 남의 것으로 잡지 않는다', () => {
  assert.deepEqual(A.foreign('가나다공동근로복지기금2호 이사장 귀하', 'B'), [], '제 이름 속 「…기금」(A)을 남의 이름으로 잡았다');
  assert.deepEqual(A.foreign('라마바사내근로복지기금 대표이사 귀하', 'A'), ['라마바사내근로복지기금']);
  assert.deepEqual(A.foreign('라마바 사내근로복지기금의 회계', 'A'), ['라마바사내근로복지기금'], '띄어쓰기가 달라도 같은 이름');
  assert.deepEqual(A.foreign('가나다공동근로복지기금2호 협의회', 'A'), ['가나다공동근로복지기금2호'], '긴 이름을 먼저 찾는다');
  assert.deepEqual(A.foreign('가칭푸른 정관', 'A'), ['가칭푸른'], '이 기금의 옛 이름도 알린다');
  assert.deepEqual(A.foreign('지운공동근로복지기금', 'A'), [], '휴지통 기금은 안 본다');
  assert.deepEqual(A.foreign('라마바 회사 소개', 'A'), [], '네 글자 미만 약칭은 회사 이름과 겹쳐 안 본다');
});

test('배선 — 저장본을 열 때 고쳐 보이고, 등록 원본을 열 때만 다른 기금 이름을 알린다', () => {
  const ld = gF('_loadDocInto');
  assert.match(ld, /_docFixOldNames\(fd\.html,f\)/);
  assert.match(ld, /_showDocHTML\(fx\.html\)/);
  const op = gF('_openHwpBuf');
  assert.match(op, /if\(!_hwpSaveKind\) _hwpBufText\(buf\)/, '틀에 채운 문서까지 의심하면 안 된다');
  assert.match(op, /_foreignFundNames\(t,S\.formFund\)/);
  assert.match(op, /한글로 채워 열기/);
});
