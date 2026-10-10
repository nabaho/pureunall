'use strict';
/* 🏢 법인 도장을 서류에 쓰기 (대표 지시 2026-10-10 「1부터」 — 검토 1번)
   못 박는 것:
     ① 법인 «명의» 서명 줄만 법인 자리 — 법인 이름 뒤에 «성명:»·참여자 등이 끼면 개인 자리
     ② 자리 고르기 창·한 자리 찍기·조용히 찍기 셋 다 같은 판정(stampForSpot)을 쓴다
     ③ 법인 도장을 안 정했으면 예전 그대로(이름 맞는 사람 도장·기본 도장) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const H = require('../js/kcareer-hwpstamp.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const F = '가나노무법인';

test('① 법인 명의 서명 줄만 법인 자리', () => {
  [['가나노무법인 대표노무사 홍길동 (인)', true], ['가나 노무법인 대표 홍길동 (인)', true], ['가나노무법인 (인)', true],
   ['법인 인감 (인)', true], ['직인', true],
   ['소속: 가나노무법인 성명: 홍길동 (인)', false], ['신 청 인 : 김 철 수 (인)', false],
   ['수행기관 가나노무법인 담당 컨설턴트 이영희 (서명)', false], ['가나노무법인 참여자 홍길동 (인)', false]]
    .forEach(([l, e]) => assert.equal(H.isFirmSpot(l, F), e, l));
  assert.equal(H.isFirmSpot('가나노무법인 대표 홍길동 (인)', ''), false, '법인 이름을 모르면 이름으로는 가르지 않는다');
});

test('② 세 길 모두 stampForSpot — 법인 도장을 안 정했으면 예전 그대로', () => {
  const f = strip(떼기('function stampFirmFor('));
  assert.ok(/firmSealStamp\(\)/.test(f) && /\.isFirmSpot\(/.test(f), '판정은 한 곳');
  assert.ok(/stampFirmFor\(s\) \|\| stampOfWho/.test(SRC), '법인 자리가 아니거나 법인 도장이 없으면 사람 도장');
  assert.ok(/stampForSpot\(s\)/.test(strip(떼기('function rhStampPickAsk('))), '자리 고르기 창');
  assert.ok(/stampForSpot\(자리\[0\]\)/.test(SRC), '한 자리 찍기');
  assert.ok(/stampFirmFor\(찍을\[q\]\.at\)\|\|기본/.test(strip(떼기('async function rhStampZip('))), '조용히 찍기 — 법인 자리만 법인 도장, 사람 자리는 예전대로 기본');
  assert.match(SRC, /<script src="js\/kcareer-hwpstamp\.js\?v=\d+"><\/script>/);
});
