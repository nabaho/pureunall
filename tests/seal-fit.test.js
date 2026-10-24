'use strict';
/* 🔴 직인 맞추기 (대표 「계약서 도장위치 제각각 — 정리」·「채울 때 다시 맞추기 — 추천대로」 2026-10-24) — 가짜 자료만
   ⓐ sealTargets — 쪽마다 «푸른노무법인·권형하가 있는 줄의 (인)» 하나. 위임인·회사 대표 줄의 (인)은 고르지 않는다
   ⓑ fitSeals — 직인(sealstd·종이 기준)만 옮긴다, 수가 안 맞으면 그대로, 다른 그림(로고)은 그대로
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

const pic = (ref, vr, hr, vo, ho) => `<hp:pic id="1"><hp:sz width="3900" widthRelTo="ABSOLUTE" height="3900" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="0" vertRelTo="${vr}" horzRelTo="${hr}" vertAlign="TOP" horzAlign="LEFT" vertOffset="${vo}" horzOffset="${ho}"/><hc:img binaryItemIDRef="${ref}"/></hp:pic>`;

test('ⓑ 직인만 옮긴다 — 가운데를 (인) 가운데에', () => {
  const x0 = '<hs:sec>' + pic('image1', 'PARA', 'PARA', 77, 8499) + '<hp:p>' + pic('sealstd', 'PAPER', 'PAPER', 100, 200) + '</hp:p></hs:sec>';
  const r = CF.fitSeals([x0], [{ p: 0, cx: 500, cy: 937 }]);
  assert.strictEqual(r.moved, 1);
  assert.match(r.xmls[0], /binaryItemIDRef="sealstd"/);
  assert.match(r.xmls[0], new RegExp('vertOffset="' + (937 * 75 - 1950) + '" horzOffset="' + (500 * 75 - 1950) + '"'));
  assert.match(r.xmls[0], /vertOffset="77" horzOffset="8499"/, '로고는 그대로');
});

test('ⓑ 수가 안 맞거나 종이 기준이 아니면 그대로', () => {
  const two = ['<a>' + pic('sealstd', 'PAPER', 'PAPER', 1, 2) + '</a>', '<b>' + pic('sealstd', 'PAPER', 'PAPER', 3, 4) + '</b>'];
  const r1 = CF.fitSeals(two, [{ p: 0, cx: 10, cy: 10 }]);
  assert.strictEqual(r1.moved, 0);
  assert.deepStrictEqual(r1.xmls, two);
  const r2 = CF.fitSeals(two, [{ p: 0, cx: 10, cy: 10 }, { p: 1, cx: 20, cy: 20 }]);
  assert.strictEqual(r2.moved, 2, '구역을 넘어 차례대로 짝짓는다');
  assert.match(r2.xmls[1], new RegExp('vertOffset="' + (20 * 75 - 1950) + '"'));
  const para = ['<a>' + pic('sealstd', 'PARA', 'COLUMN', 1, 2) + '</a>'];
  assert.strictEqual(CF.fitSeals(para, [{ p: 0, cx: 10, cy: 10 }]).moved, 0, '문단 기준 직인은 건드리지 않는다');
});

test('ⓒ 배선 — 채우기 길에서만, 실패하면 원래대로', () => {
  const D = read('docs-esign.html');
  assert.match(D, /async function formFitSeals\(d, JSZ\)/);
  assert.match(D, /PuFormCardFill\.sealTargets\(pages\)/);
  assert.match(D, /PuFormCardFill\.fitSeals\(xmls, targets\)/);
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
