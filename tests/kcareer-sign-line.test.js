'use strict';
/* 서명 줄 — 이름이 밑줄 위에 앉고, 표 칸 안의 «내 이름» 서명 줄에도 도장이 자동으로 찍힌다
   (대표 지적 2026-10-10 「서명 날인이 빠졌다 · 줄이 제대로 안 맞다」). 강사카드 실물 모양의 조각으로 못 박는다. */
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
const 로고 = '<hp:ctrl><hp:footer id="1"><hp:subList><hp:p id="9"><hp:run charPrIDRef="1"><hp:pic id="7"></hp:pic></hp:run></hp:p></hp:subList></hp:footer></hp:ctrl>';
const 줄 = (이름, 공백) => '<hp:p id="90" paraPrIDRef="20"><hp:run charPrIDRef="9">' + 로고 + '<hp:t>성명: ' + 이름 + '</hp:t></hp:run>'
  + '<hp:run charPrIDRef="16"><hp:t>' + ' '.repeat(공백) + '</hp:t></hp:run><hp:run charPrIDRef="9"><hp:t> (서명)</hp:t></hp:run></hp:p>';

test('① 이름이 밑줄 조각 안으로 옮겨 앉고 줄 길이는 그대로', () => {
  const r = H.tidySignLine(줄('권형하', 16));
  assert.equal(r.n, 1);
  assert.ok(r.xml.includes('<hp:t>성명: </hp:t>'), '라벨만 남는다');
  const m = /<hp:run charPrIDRef="16"><hp:t>([^<]*)<\/hp:t>/.exec(r.xml);
  assert.ok(m && m[1].startsWith('권형하'), '이름이 밑줄 글자 모양 조각에 든다');
  assert.equal(m[1].replace(/\s/g, '').length, 3);
  assert.ok(m[1].length >= 4 + 3 && m[1].length < 16, '이름만큼 공백을 줄인다(줄 전체 길이 유지)');
  assert.ok(r.xml.includes('<hp:t> (서명)</hp:t>'), '(서명) 꼬리는 그대로');
});

test('② 다시 돌려도 그대로(겹쳐 손대지 않는다) · 모르는 꼴은 손대지 않는다', () => {
  const once = H.tidySignLine(줄('권형하', 16)).xml;
  const twice = H.tidySignLine(once);
  assert.equal(twice.n, 0); assert.equal(twice.xml, once);
  const 빈 = 줄('', 16).replace('성명: ', '성명:');
  assert.equal(H.tidySignLine(빈).n, 0, '이름이 없으면 그대로');
  const 본문 = '<hp:p><hp:run charPrIDRef="9"><hp:t>서명 또는 날인하여 주십시오</hp:t></hp:run></hp:p>';
  assert.equal(H.tidySignLine(본문).xml, 본문);
});

test('③ 정돈한 뒤에도 서명 자리는 «내 이름»으로 읽히고, 꼬리말 로고는 도장으로 안 본다', () => {
  const x = H.tidySignLine(줄('권형하', 16)).xml;
  const s = H.findSpots(x);
  assert.equal(s.length, 1); assert.equal(s[0].who, '권형하');
  assert.equal(s[0].sealed, false, '꼬리말에 든 기관 로고는 이미 찍힌 도장이 아니다');
  const 진짜 = x.replace('<hp:t> (서명)', '<hp:pic id="55"></hp:pic><hp:t> (서명)');
  assert.equal(H.findSpots(진짜)[0].sealed, true, '본문에 매달린 그림은 그대로 도장으로 본다');
});

test('④ 짓는 길이 정돈하고, 채운 뒤 «내 이름» 서명 줄에 도장을 자동으로 찍는다', () => {
  const fin = strip(떼기('async function rhSignTidyZip('));
  assert.ok(/KcareerHwpStamp\.tidySignLine\(/.test(fin), '서명 줄을 정돈');
  assert.ok(/await rhSignTidyZip\(zip\)/.test(strip(떼기('async function rhFinishZip('))), '지을 때마다 정돈');
  const fill = strip(떼기('async function rhFillByMap('));
  assert.ok(/rhAutoStampMine\(\)/.test(fill), '채운 뒤 내 서명 줄 자동 날인');
  const auto = strip(떼기('async function rhAutoStampMine('));
  assert.ok(/===나/.test(auto) && /s\.who/.test(auto), '줄의 이름이 내 이름일 때만');
  assert.ok(/replace\(\/\\s\+\/g,''\)===나/.test(auto), '공백 떼기 정규식이 \\s 로 온전한가(역슬래시가 빠지면 이름이 안 맞는다)');
  assert.ok(/\/\^Contents\\\/section\\d\+\\\.xml\$\/i/.test(fin), '구역 파일 이름 정규식 온전');
  assert.ok(/stampForSpot\(s\)\|\|기본/.test(auto), '자리마다 맞는 도장');
  assert.ok(!/_rhStampOn\s*=\s*true/.test(auto), '표시는 rhStampDoc 한 곳에서만 켠다');
});

test('⑤ 문맥 없는 빈칸은 AI 가 짚어도 안 채운다 — 강의경력 표에 인적사항이 박히던 것', () => {
  const AI = require('../js/kcareer-slotai.js');
  const slots = [
    { id: 't0r14c1', tbl: 0, row: 14, col: 1, kind: '빈칸', left: '', up: '', sec: 'Contents/section0.xml', rawId: 't0r14c1' },
    { id: 't0r1c2', tbl: 0, row: 1, col: 2, kind: '빈칸', left: '성 명', up: '', sec: 'Contents/section0.xml', rawId: 't0r1c2' }];
  const picks = {};
  slots.forEach((s) => { picks[s.sec + '#' + s.id] = 'name'; picks[s.id] = 'name'; });
  AI.mergeInto(slots, picks);
  assert.ok(!slots[0].guess, '라벨도 머리글도 없는 칸은 비워 둔다');
});
