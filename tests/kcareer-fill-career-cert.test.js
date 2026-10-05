'use strict';
/* 이력서 「자격증 보유현황」·「경력 현황」이 엉뚱하게 채워지던 것 (대표 제보 2026-10-05 캡처)
     경력 현황: 기업경력 2줄 뒤에 「천안시청소년재단 · 위촉장 임원추천위원회 위원」(위촉장이 근무경력 자리로)
                「2026.04.29 ~ 2026.11.30」이 첫 칸에 몰리고 「~」 뒤 끝 칸은 빔 · 주요업무 칸에 「권형하」
     자격증:   「인가관리기관」 칸에 「공인노무사 제3016호」 · 줄이 셋뿐인데 최신순이라 공인노무사가 잘림
   못 박는 것:
     ① 직위·부서 칸이 있는 경력 표는 근무경력만 — 위촉장으로 메우지 않는다
     ② 기간이 「시작 | ~ | 끝」 세 칸이면 갈라 넣는다
     ③ 「주요업무」는 담당업무(role) 칸, 「인가관리기관」은 기관(org) 칸
     ④ 자격 표는 국가자격 먼저 · 과정·양성·교육(수료)은 빼고 · 기관도 보낸다
     ⑤ 직위 칸에 「위촉장」 같은 종류 이름을 붙이지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const X = require('../js/kcareer-hwpxfill.js');
const H = require('../hwpx_gen.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

function tbl(rows) {
  var n = 0;
  rows.forEach(function (r) { var w = 0; r.forEach(function (c) { w += (c && c.colSpan) || 1; }); if (w > n) n = w; });
  var widths = []; for (var i = 0; i < n; i++) widths.push(1 / n);
  return H.tablePara(rows, H.cols(widths));
}
function 읽기(xml) {
  var out = [];
  X.eachTable(xml, function (t) {
    X.splitRows(t).forEach(function (tr) { out.push(X.splitCells(tr).map(function (c) { return X.cellText(c).replace(/\s+/g, ' ').trim(); })); });
    return t;
  });
  return out;
}

const 경력서식 = () => tbl([
  [{ t: '근 무 기 간', colSpan: 3 }, null, null, '근 무 처', '직 위', '주 요 업 무'],
  ['', '~', '', '', '', ''],
  ['', '~', '', '', '', ''],
  ['', '~', '', '', '', ''],
  ['', '~', '', '', '', '']
]);
const 자료 = {
  fields: { name: '권형하' }, secrets: {},
  work: [{ period: '2017.10 ~ 현재', org: '푸른노무법인', title: '대표노무사', role: '' },
         { period: '2011.05 ~ 2014.02', org: '푸른노무법인', title: '책임노무사', role: '' }],
  career: [{ period: '2017.10 ~ 현재', org: '푸른노무법인', title: '대표노무사', role: '' },
           { period: '2011.05 ~ 2014.02', org: '푸른노무법인', title: '책임노무사', role: '' },
           { period: '2026.09.30', org: '천안시청소년재단', role: '임원추천위원회 위원' }]
};

test('① 직위 칸이 있는 경력 표에는 근무경력만 — 위촉장이 근무처로 오지 않는다', () => {
  const 줄 = 읽기(X.autoFill(경력서식(), 자료).xml);
  const 글 = 줄.map((r) => r.join('|')).join('\n');
  assert.ok(!/천안시청소년재단/.test(글), '★ 위촉장이 근무경력 자리에 들어갔습니다:\n' + 글);
  assert.ok(/푸른노무법인/.test(글) && /대표노무사/.test(글));
  assert.ok(!/권형하/.test(글.replace(/권형하노무사사무소/g, '')), '주요업무 칸에 이름이 들어가면 안 됩니다');
});

test('② 기간 「시작 | ~ | 끝」 세 칸에 갈라 넣는다', () => {
  const 줄 = 읽기(X.autoFill(경력서식(), 자료).xml);
  const 첫 = 줄[1];
  assert.equal(첫[0], '2017.10');
  assert.equal(첫[1], '~');
  assert.equal(첫[2], '현재', '★ 끝 칸이 비면 「2017.10 ~ 현재」가 첫 칸에 몰린다');
  assert.equal(줄[2][2], '2014.02');
});

test('③ 칸 이름 — 「주요업무」는 담당업무, 「인가관리기관」은 기관', () => {
  assert.equal(X.colKeyOf('주 요 업 무'), 'role');
  assert.equal(X.colKeyOf('인가관리기관'), 'org');
  const 자격서식 = tbl([['취 득 년 월', '자 격 증 명', '인가관리기관'], ['', '', ''], ['', '', '']]);
  const r = X.autoFill(자격서식, { fields: {}, secrets: {}, certaward: [
    { certName: '공인노무사 (제3016호)', gotAt: '2010.10.20', org: '고용노동부' },
    { certName: '정보처리기사', gotAt: '2007.03.19', org: '한국산업인력공단' }] });
  const 줄 = 읽기(r.xml);
  assert.deepEqual(줄[1], ['2010.10.20', '공인노무사 (제3016호)', '고용노동부'], '★ 기관 칸에 엉뚱한 값(면허번호)이 들어가면 안 됩니다');
});

test('④⑤ 자격 목록·위촉 직위 — 만드는 곳(_cvFillData)의 규칙', () => {
  const i = SRC.indexOf('function _cvFillData('); assert.ok(i > 0);
  const f = SRC.slice(i, SRC.indexOf('\nasync function hwpxFill(', i));
  assert.ok(/_국가\(b\)\?1:0\)-\(_국가\(a\)\?1:0\)/.test(f), '★ 국가자격 먼저 — 줄이 셋이면 최신순에서 공인노무사가 잘린다');
  assert.ok(/과정\|양성\|교육/.test(f), '과정·양성·교육(수료)은 자격 표에서 뺀다');
  assert.ok(/gotAt:formatDate\(r\.date\)\|\|'', org:r\.org/.test(f), '자격 기관을 보낸다');
  assert.ok(/role:r\.titleVal\|\|r\.type\|\|''/.test(f) && !/role:\(r\.type\|\|''\)\+/.test(f), '직위 칸에 「위촉장 …」 종류 이름을 붙이지 않는다');
});
