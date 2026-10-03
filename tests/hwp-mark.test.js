'use strict';
/* 바꿀 자리 만들기 — 엔진 조작 (설계 2026-09-29 §4). rhwp 문서를 흉내 내 node 에서 검사한다.
   ⓐ 찾기: 본문·표 칸 모두, 문서 순서, 앞뒤 글자
   ⓑ 바꾸기: 뒤쪽부터, 이 곳만/모두, 바꾼 뒤 다시 읽어 확인
   ⓒ 표시 이름 다듬기 */
const assert = require('assert');
const { test } = require('node:test');
const M = require('../js/pu-hwp-mark.js');

/* 흉내 문서 — 본문 문단 배열 + 표 칸(키 'pp|ci|cell|cp') */
function fakeDoc(paras, cells) {
  const P = paras.slice(), C = Object.assign({}, cells || {});
  const ck = (pp, ci, cell, cp) => [pp, ci, cell, cp].join('|');
  return {
    P, C,
    searchAllText(q) {
      const out = [];
      P.forEach((t, para) => { let i = -1; while ((i = t.indexOf(q, i + 1)) >= 0) out.push({ sec: 0, para, charOffset: i }); });
      Object.keys(C).forEach(k => { const [pp, ci, cell, cp] = k.split('|').map(Number); let i = -1;
        while ((i = C[k].indexOf(q, i + 1)) >= 0) out.push({ sec: 0, para: pp, charOffset: i, cellContext: { parentPara: pp, ctrlIdx: ci, cellIdx: cell, cellPara: cp } }); });
      return JSON.stringify(out);
    },
    getParagraphLength(s, p) { return P[p].length; },
    getTextRange(s, p, o, n) { return P[p].substr(o, n); },
    deleteText(s, p, o, n) { P[p] = P[p].slice(0, o) + P[p].slice(o + n); return '{"ok":true}'; },
    insertText(s, p, o, t) { P[p] = P[p].slice(0, o) + t + P[p].slice(o); return '{"ok":true}'; },
    getCellParagraphLength(s, pp, ci, cell, cp) { return C[ck(pp, ci, cell, cp)].length; },
    getTextInCell(s, pp, ci, cell, cp, o, n) { return C[ck(pp, ci, cell, cp)].substr(o, n); },
    deleteTextInCell(s, pp, ci, cell, cp, o, n) { const k = ck(pp, ci, cell, cp); C[k] = C[k].slice(0, o) + C[k].slice(o + n); return '{"ok":true}'; },
    insertTextInCell(s, pp, ci, cell, cp, o, t) { const k = ck(pp, ci, cell, cp); C[k] = C[k].slice(0, o) + t + C[k].slice(o); return '{"ok":true}'; }
  };
}

test('ⓐ 찾기 — 본문과 표 칸, 앞뒤 글자', () => {
  const d = fakeDoc(['수 신 자 : 가나도청 노동과 홍길동 팀장님', '1. 귀 기관의 무궁한 발전'], { '5|0|2|0': '금액 5,000,000원' });
  const h = M.hitsOf(d, '가나도청 노동과 홍길동 팀장님');
  assert.strictEqual(h.length, 1);
  assert.strictEqual(h[0].before, '수 신 자 : ');
  assert.strictEqual(h[0].cell, null);
  const c = M.hitsOf(d, '5,000,000원');
  assert.deepStrictEqual(c[0].cell, { pp: 5, ci: 0, ci2: 2, cp: 0 });
  assert.strictEqual(c[0].before, '금액 ');
  assert.deepStrictEqual(M.hitsOf(d, ''), [], '빈 글자는 찾지 않는다');
});
test('ⓑ 이 곳만 — 두 번째 자리만 바꾸고, 다시 읽어 확인한다', () => {
  const d = fakeDoc(['합계 5,000,000원 / 금액 5,000,000원']);
  const r = M.apply(d, '5,000,000원', '{{견적금액}}', 1);
  assert.deepStrictEqual(r, { count: 1, failed: 0 });
  assert.strictEqual(d.P[0], '합계 5,000,000원 / 금액 {{견적금액}}');
});
test('ⓑ 모두 — 한 문단 안 여러 자리도 뒤쪽부터 바꿔 위치가 밀리지 않는다', () => {
  const d = fakeDoc(['귀사에 대하여도 … 귀사의 동반자', '귀사'], { '1|0|0|0': '귀사' });
  const r = M.apply(d, '귀사', '{{호칭}}', 'all');
  assert.deepStrictEqual(r, { count: 4, failed: 0 });
  assert.strictEqual(d.P[0], '{{호칭}}에 대하여도 … {{호칭}}의 동반자');
  assert.strictEqual(d.P[1], '{{호칭}}');
  assert.strictEqual(d.C['1|0|0|0'], '{{호칭}}');
});
test('ⓑ 다시 읽어 다르면 실패로 센다 (엔진 위치 어긋남)', () => {
  const d = fakeDoc(['가나다라']);
  d.insertText = function () { return '{"ok":true}'; };   // 지우기만 되고 넣기가 안 되는 엔진
  const r = M.apply(d, '나다', 'X', 'all');
  assert.deepStrictEqual(r, { count: 0, failed: 1 });
});
test('ⓑ 번호가 범위 밖이면 아무것도 안 바꾼다', () => {
  const d = fakeDoc(['가나']);
  assert.deepStrictEqual(M.apply(d, '가', 'X', 3), { count: 0, failed: 0 });
  assert.strictEqual(d.P[0], '가나');
});
test('ⓒ 표시 이름 다듬기', () => {
  assert.strictEqual(M.markName(' 수신자 '), '{{수신자}}');
  assert.strictEqual(M.markName('{{참조}}'), '{{참조}}');
  assert.strictEqual(M.markName(''), '');
  assert.strictEqual(M.markName('가{나'), '');
  assert.strictEqual(M.markName('가'.repeat(31)), '');
  assert.ok(M.COMMON.indexOf('수신자') >= 0 && M.COMMON.indexOf('위임사무') >= 0);
});
