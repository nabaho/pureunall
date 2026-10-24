'use strict';
/* 🔴 직인 맞추기 (대표 「계약서 도장위치 제각각 — 정리」·「채울 때 다시 맞추기 — 추천대로」 2026-10-24) — 가짜 자료만
   ⓐ sealTargets — 쪽마다 «푸른노무법인·권형하가 있는 줄의 (인)» 하나. 위임인·회사 대표 줄의 (인)은 고르지 않는다
   ⓑ fitSeals — 직인(종이 기준·크기로 알아봄)만 옮긴다, 쪽이 바뀌면 그 쪽 빈 문단으로(글 있는 문단은 안 건드림), 수가 안 맞으면 그대로, 로고는 그대로
   ⓒ 배선 — 채우기(formHwpFill → formRelayout keep)만 맞춘다, 못 맞추면 원래대로
   ⓓ 문구 — 전자위임장·기본 양식: 「전액」, 「수령한 날부터 7일 이내에 … 지급한다」 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const CF = require('../js/pu-form-cardfill.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');

const run = (o) => Object.assign({ x: 0, y: 0, w: 100, h: 14, charX: null, cellPath: null }, o);

test('ⓐ 쪽마다 푸른노무법인 줄의 (인) 하나', () => {
  const pages = [
    [run({ text: '위임인 : 홍길동 (인)', x: 100, y: 900, w: 200 }),
      run({ text: '수임인 : 푸른노무법인 대표 공인노무사 권형하 (인)', x: 100, y: 930, w: 400 })],
    [run({ text: '본문만 있는 쪽', y: 100 })],
    [run({ text: '신청인 (업무대행기관 사용자): 푸른노무법인 (서명 또는 인)', x: 50, y: 780, w: 400 }),
      run({ text: '신청인 (위탁사업장 사용자): 가나상사 (서명 또는 인)', x: 50, y: 800, w: 400 })]
  ];
  const t = CF.sealTargets(pages);
  assert.strictEqual(t.length, 2);
  assert.strictEqual(t[0].p, 0);
  assert.strictEqual(t[0].cy, 937, '수임인 줄 가운데');
  assert.strictEqual(t[0].cx, 493, 'charX 가 없으면 줄 끝에서 7px 앞');
  assert.strictEqual(t[1].p, 2);
  assert.strictEqual(t[1].cy, 787, '회사 대표 줄(800)이 아니라 푸른노무법인 줄(780)');
});

test('ⓐ 표 안 — 갑(회사) 칸의 (인)은 고르지 않는다', () => {
  const c = (i) => [{ controlIndex: 1, cellIndex: i, cellParaIndex: 0 }];
  const pages = [[
    run({ text: '{{대표자}} (인)', x: 200, y: 300, w: 100, cellPath: c(6) }),
    run({ text: '권 형 하   (인)', x: 500, y: 300, w: 100, cellPath: c(15) })
  ]];
  const t = CF.sealTargets(pages);
  assert.strictEqual(t.length, 1);
  assert.ok(t[0].cx > 500, '을(푸른) 칸');
});

const pic = (ref, vr, hr, vo, ho) => `<hp:pic id="1"><hp:orgSz width="20700" height="20700"/><hp:sz width="3900" widthRelTo="ABSOLUTE" height="3900" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="0" vertRelTo="${vr}" horzRelTo="${hr}" vertAlign="TOP" horzAlign="LEFT" vertOffset="${vo}" horzOffset="${ho}"/><hc:img binaryItemIDRef="${ref}"/></hp:pic>`;
const logo = '<hp:pic id="9"><hp:orgSz width="9000" height="7000"/><hp:sz width="6286" height="5275"/><hp:pos vertRelTo="PARA" horzRelTo="PARA" vertOffset="77" horzOffset="8499"/><hc:img binaryItemIDRef="image1"/></hp:pic>';
const P = (inner, lsa) => '<hp:p id="1" paraPrIDRef="3" styleIDRef="0"><hp:run charPrIDRef="7">' + inner + '</hp:run>' + (lsa ? '<hp:linesegarray><hp:lineseg textpos="0"/></hp:linesegarray>' : '') + '</hp:p>';

test('ⓑ 직인만 옮긴다 — 가운데를 (인) 가운데에, 로고는 그대로', () => {
  const x0 = '<hs:sec>' + P(logo + '<hp:t>머리</hp:t>', 1) + P(pic('sealstd', 'PAPER', 'PAPER', 100, 200) + '<hp:t/>', 1) + '</hs:sec>';
  const r = CF.fitSeals([x0], [{ p: 0, cx: 500, cy: 937, anchor: { sec: 0, para: 1 } }]);
  assert.strictEqual(r.moved, 1);
  assert.strictEqual(r.restruct, 0, '이미 붙은 문단이면 자리 값만');
  assert.match(r.xmls[0], new RegExp('vertOffset="' + (937 * 75 - 1950) + '" horzOffset="' + (500 * 75 - 1950) + '"'));
  assert.match(r.xmls[0], /vertOffset="77" horzOffset="8499"/);
});

test('ⓑ rhwp 가 그림 이름을 바꿔도(image2) 크기로 알아본다', () => {
  const x0 = '<hs:sec>' + P(pic('image2', 'PAPER', 'PAPER', 1, 2) + '<hp:t/>') + '</hs:sec>';
  assert.strictEqual(CF.fitSeals([x0], [{ p: 0, cx: 10, cy: 10, anchor: { sec: 0, para: 0 } }]).moved, 1);
});

test('ⓑ 서명줄이 다음 쪽으로 — 그 쪽 «빈 문단»으로 옮긴다, 글 있는 문단·줄 정보는 안 건드린다', () => {
  const x0 = '<hs:sec>' + P('<hp:t>앞 쪽 문단</hp:t>' + pic('sealstd', 'PAPER', 'PAPER', 1, 2), 1) + P('<hp:t>다음 쪽 첫 문단</hp:t>', 1) + P('<hp:t/>', 1)
    + P('<hp:t>수임인 : 푸른노무법인 대표 공인노무사 권형하 (인)</hp:t>', 1) + '</hs:sec>';
  const r = CF.fitSeals([x0], [{ p: 1, cx: 300, cy: 180, sec: 0, para: 3, lo: 1, hi: 3 }]);
  assert.strictEqual(r.restruct, 1);
  const parts = r.xmls[0].split('</hp:p>');
  assert.ok(!/hp:pic/.test(parts[0]), '앞 쪽 문단에서 뺐다');
  assert.ok(!/hp:pic/.test(parts[1]), '글 있는 문단에는 안 붙인다');
  assert.ok(/hp:pic/.test(parts[2]), '그 쪽 빈 문단에 붙였다');
  assert.match(parts[2], /<hp:run charPrIDRef="7"><hp:pic/, '붙인 문단의 글자 모양을 따른다');
  parts.slice(0, 4).forEach((x, i) => assert.match(x, /<hp:linesegarray/, i + '번 문단 줄 정보는 그대로'));
  const r2 = CF.fitSeals(r.xmls, [{ p: 1, cx: 310, cy: 190, sec: 0, para: 3, lo: 1, hi: 3 }], { offsetsOnly: true });
  assert.strictEqual(r2.restruct, 0);
  assert.match(r2.xmls[0], new RegExp('vertOffset="' + (190 * 75 - 1950) + '"'));
});

test('ⓑ 이미 그 쪽 문단에 붙어 있으면 자리 값만(옮기지 않는다)', () => {
  const x0 = '<hs:sec>' + P('<hp:t>위임인 : 홍길동 (인)</hp:t>' + pic('sealstd', 'PAPER', 'PAPER', 1, 2), 1) + P('<hp:t/>', 1)
    + P('<hp:t>수임인 : 푸른노무법인 대표 공인노무사 권형하 (인)</hp:t>', 1) + '</hs:sec>';
  const r = CF.fitSeals([x0], [{ p: 0, cx: 300, cy: 900, sec: 0, para: 2, lo: 0, hi: 2 }]);
  assert.strictEqual(r.restruct, 0);
  assert.ok(/hp:pic/.test(r.xmls[0].split('</hp:p>')[0]));
});

test('ⓑ 그 쪽에 빈 문단이 없으면 서명줄 뒤 새 빈 문단에 — 서명줄은 그대로', () => {
  const sig = P('<hp:t>수임인 : 푸른노무법인 대표 공인노무사 권형하 (인)</hp:t>', 1);
  const x0 = '<hs:sec>' + P('<hp:t>앞</hp:t>' + pic('sealstd', 'PAPER', 'PAPER', 1, 2), 1) + sig + '</hs:sec>';
  const r = CF.fitSeals([x0], [{ p: 1, cx: 300, cy: 120, sec: 0, para: 1, lo: 1, hi: 1 }]);
  assert.strictEqual(r.restruct, 1);
  assert.ok(r.xmls[0].indexOf(sig) > 0, '서명줄 문단은 한 글자도 안 바뀐다');
  assert.match(r.xmls[0], /권형하 \(인\)<\/hp:t><\/hp:run><hp:linesegarray>[\s\S]*?<\/hp:p><hp:p id="0" paraPrIDRef="3" styleIDRef="0" pageBreak="0"[^>]*><hp:run charPrIDRef="7"><hp:pic/);
});

test('ⓑ 수가 안 맞거나 문단 기준이면 그대로', () => {
  const two = ['<a>' + P(pic('sealstd', 'PAPER', 'PAPER', 1, 2)) + '</a>', '<b>' + P(pic('sealstd', 'PAPER', 'PAPER', 3, 4)) + '</b>'];
  const r1 = CF.fitSeals(two, [{ p: 0, cx: 10, cy: 10 }]);
  assert.strictEqual(r1.moved, 0);
  assert.deepStrictEqual(r1.xmls, two);
  const r2 = CF.fitSeals(two, [{ p: 0, cx: 10, cy: 10, anchor: { sec: 0, para: 0 } }, { p: 1, cx: 20, cy: 20, anchor: { sec: 1, para: 0 } }]);
  assert.strictEqual(r2.moved, 2, '구역을 넘어 차례대로 짝짓는다');
  assert.match(r2.xmls[1], new RegExp('vertOffset="' + (20 * 75 - 1950) + '"'));
  const para = ['<a>' + P(pic('sealstd', 'PARA', 'COLUMN', 1, 2)) + '</a>'];
  assert.strictEqual(CF.fitSeals(para, [{ p: 0, cx: 10, cy: 10 }]).moved, 0);
});

test('ⓐ 쪽마다 문단 범위와 서명줄 문단을 넘긴다', () => {
  const t = CF.sealTargets([
    [run({ text: '본문', y: 100, secIdx: 0, paraIdx: 3, charStart: 0 }), run({ text: '수임인 : 푸른노무법인 대표 공인노무사 권형하 (인)', y: 930, w: 400, secIdx: 0, paraIdx: 5, charStart: 0 })],
    [run({ text: '수임인 : 푸른노무법인 대표 공인노무사 권형하 (인)', y: 100, w: 400, secIdx: 0, paraIdx: 9, charStart: 0 })]
  ]);
  assert.deepStrictEqual([t[0].sec, t[0].para, t[0].lo, t[0].hi], [0, 5, 3, 5]);
  assert.deepStrictEqual([t[1].para, t[1].lo, t[1].hi], [9, 9, 9]);
});

test('ⓒ 배선 — 채우기 길에서만, 실패하면 원래대로', () => {
  const D = read('docs-esign.html');
  assert.match(D, /async function formFitSeals\(d, JSZ\)/);
  assert.match(D, /PuFormCardFill\.sealTargets\(pagesOf\(d\)\)/);
  assert.match(D, /PuFormCardFill\.fitSeals\(S\.xmls, t1\)/);
  assert.match(D, /d2\.reflowLinesegs\(\);\n\s+if \(d2\.pageCount\(\) > d\.pageCount\(\)\) return null;\n\s+var t2 = PuFormCardFill\.sealTargets\(pagesOf\(d2\)\);/, '옮겼으면 줄을 다시 나눈 뒤 다시 잰다 — 쪽이 늘면 버린다');
  assert.match(D, /fitSeals\(S2\.xmls, t2, \{ offsetsOnly: true \}\)/);
  assert.match(D, /if \(keep\) \{\n\s+var fit = null;\n\s+try \{ fit = await formFitSeals\(d2, JSZ\); \} catch \(e\) \{ fit = null; \}/);
  assert.match(D, /try \{ r\.bytes = await formRelayout\(doc, vals, undefined, keep\);/, '채우기는 keep 을 넘긴다');
  assert.match(D, /out = await formRelayout\(doc, \[to\], fmt\);/, '바꿀 자리 만들기는 keep 없이(직인 안 옮김)');
});

test('ⓓ 문구 — 전자위임장·기본 양식', () => {
  ['js/esign-docs.js', 'js/pu-contract-forms.js'].forEach((f) => {
    const s = read(f);
    assert.match(s, /성공된 것으로 보고 제3조의 성공보수를 전액 지급한다\./, f);
    assert.match(s, /성공보수를 제하고 수령한 날부터 7일 이내에 위임인에게 지급한다\./, f);
    assert.ok(!/위임인에게 지급할 수 있다|위임임을/.test(s), f);
  });
});
