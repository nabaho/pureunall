'use strict';
/* 🖋 자리마다 누구 도장 (대표 승인 2026-10-04 목업 A — 「박한별과 권형하 도장은 안 보인다」에서 시작)
   못 박는 것:
     ① 서명 줄의 이름을 읽는다(띄어 쓴 이름도) · 괄호 없는 「서약자: 권 형 하 서명」도 자리다
     ② 이미 도장이 있는 자리를 안다(서명 줄 위 빈 문단에 매단 도장 포함)
     ③ 그 사람 도장은 도장 이름에서 찾는다 · 없으면 null(기본 도장을 몰래 찍지 않는다)
     ④ 자리마다 «그 도장»으로 찍는다 — 도장 둘이면 그림도 둘 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const S = require('../js/kcareer-hwpstamp.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const P = (t, extra) => '<hp:p id="0"><hp:run charPrIDRef="3"><hp:t>' + t + '</hp:t></hp:run>' + (extra || '') + '</hp:p>';
const PIC = '<hp:run charPrIDRef="0"><hp:pic id="1"></hp:pic></hp:run>';
const 동의서 = P('2026 년 09월 28일') + P('', PIC) + P('신 청 인 :   권 형 하 (인)')
  + P('2026 년 09월 28일') + P('') + P('신 청 인 :   박 한 별 (인)');
const 서약서 = P('2026. 09 . 28 .') + P('서약자:   권 형 하  서명') + P('한국기계연구원장 귀하');

test('① 서명 줄 이름 · 괄호 없는 「서명」 자리', () => {
  const a = S.findSpots(동의서);
  assert.deepEqual(a.map((x) => x.who), ['권형하', '박한별']);
  const b = S.findSpots(서약서);
  assert.equal(b.length, 1, '★ 「서약자: 권 형 하 서명」을 자리로 못 잡으면 서약서에 도장을 못 찍는다');
  assert.equal(b[0].who, '권형하');
  assert.equal(S.findSpots(P('성명  홍길동  (서명 또는 인)')).length, 1, '「서명 또는 인」 꼴은 예전대로');
  assert.equal(S.findSpots(P('서명한 문서를 보낸다')).length, 0, '본문의 맨 「서명」은 자리가 아니다');
});

test('② 이미 도장이 있는 자리를 안다 — 서명 줄 위 빈 문단의 도장도', () => {
  const a = S.findSpots(동의서);
  assert.deepEqual(a.map((x) => x.sealed), [true, false]);
});

test('③ 그 사람 도장은 도장 이름에서 — 없으면 null', () => {
  const ctx = { get: () => [{ id: 'A', label: '도장_권형하 노무사', def: true }, { id: 'B', name: '박한별.png' }], String };
  vm.createContext(ctx);
  vm.runInContext(떼기('function stampOfWho('), ctx);
  assert.equal(vm.runInContext("stampOfWho('권형하').id", ctx), 'A');
  assert.equal(vm.runInContext("stampOfWho('박 한 별').id", ctx), 'B');
  assert.equal(vm.runInContext("stampOfWho('박재원')", ctx), null, '★ 남의 이름 자리에 기본 도장을 찍으면 안 된다');
});

test('④ 자리마다 그 도장으로 — 도장 둘이면 그림 둘 · 옛 기록(자리만)은 기본 도장', async () => {
  const JSZip = require('../vendor/jszip.min.js');
  const files = { A: { base64: 'AAAA' }, B: { base64: 'BBBB' } };
  const ctx = {
    console, Object, Array, String, Number, JSON, Math, Promise,
    KcareerHwpStamp: S,
    get: () => [{ id: 'A', label: '권형하', def: true }, { id: 'B', label: '박한별' }],
    getDefaultStamp: () => ({ id: 'A', label: '권형하', def: true }),
    getFileAsync: async (id) => files[id],
    _rhStampPx: async () => 300,
    stampFit: () => ({ size: 3400, dx: 0, dy: -700 }),
  };
  vm.createContext(ctx);
  vm.runInContext(['function _rhPickSplit(', 'async function rhStampZip('].map(떼기).join('\n'), ctx);
  const 지어 = async (pick) => {
    const z = new JSZip();
    z.file('Contents/section0.xml', 동의서);
    z.file('Contents/content.hpf', '<opf:manifest></opf:manifest>');
    ctx._z = z; ctx._rhStampPick = pick;
    const r = await vm.runInContext('rhStampZip(_z)', ctx);
    return { r, z, xml: await z.file('Contents/section0.xml').async('string'), hpf: await z.file('Contents/content.hpf').async('string') };
  };
  const 둘 = await 지어(['Contents/section0.xml#0=A', 'Contents/section0.xml#1=B']);
  assert.equal(둘.r.ok, true);
  const 그림 = Object.keys(둘.z.files).filter((n) => /^BinData\/./.test(n));
  assert.equal(그림.length, 2, '★ 두 사람 도장이 한 그림으로 찍히면 박한별 자리에 권형하 도장이 들어간다');
  assert.equal(await 둘.z.file(그림[0]).async('base64') !== await 둘.z.file(그림[1]).async('base64'), true);
  assert.equal((둘.hpf.match(/<opf:item /g) || []).length, 2);
  const 옛 = await 지어(['Contents/section0.xml#1']);
  assert.equal(옛.r.ok, true);
  const 옛그림 = Object.keys(옛.z.files).filter((n) => /^BinData\/./.test(n));
  assert.equal(옛그림.length, 1);
  assert.equal(await 옛.z.file(옛그림[0]).async('base64'), 'AAAA', '도장 없는 옛 기록은 기본 도장');
});
