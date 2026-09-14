'use strict';
/* 참여사업장 화면 정리 · 대표사업장 (대표 지시 2026-09-13/14)
 *
 *   「참여사업장 너무 복잡하다 목업만들어서 정리해달라.」
 *   「지역공동기금의 경우 대표사업장이 있다 어떤사업장이 대표사업장인지 체크될 수 있게 해달라.」
 *
 * ★ 대표사업장은 한 기금에 «하나»다. 둘이 켜져 있으면 설립합의서·회의록에 어느 상호를
 *   쓸지 사람이 다시 골라야 한다 — 그 상호가 노동청에 나가는 서류에 그대로 찍힌다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
/* ⚠ 글자로 훑을 때는 주석을 먼저 걷는다 — 이 파일 주석이 지시를 그대로 인용하고 있다 */
const 코드만 = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/* ══ ① 대표사업장 — 한 곳만 ═══════════════════════════════════════ */

function 지정상자(sites) {
  const box = {}, 보낸것 = [], toasts = [];
  new Function('SITES', 'SENT', 'TOASTS', [
    'var S={fundId:"F1",sites:SITES};',
    'var NS="fund_erp";',
    'var fbDb={ref:function(p){ return {update:function(o){ SENT.push({path:p,patch:o}); '
      + 'return Promise.resolve(); }}; }};',
    'function renderFund(){}',
    'function toast(m,k){ TOASTS.push(m); }',
    grabFn('setSiteLead'), grabFn('_leadSite'),
    'this.set=setSiteLead; this.lead=_leadSite; this.S=S;'
  ].join('\n')).call(box, sites, 보낸것, toasts);
  return { box, 보낸것, toasts };
}
const 셋 = { s1: { name: '가나산업' }, s2: { name: '다라전자', lead: true }, s3: { name: '마바디자인' } };

test('★★ ① 새로 지정하면 앞의 것은 «같은 번»에 꺼진다 — 둘이 켜지면 서식이 갈린다', () => {
  const { 보낸것 } = 지정상자(JSON.parse(JSON.stringify(셋)));
  지정상자(JSON.parse(JSON.stringify(셋))).box.set('s1', true);
  const { box, 보낸것: 보냄 } = 지정상자(JSON.parse(JSON.stringify(셋)));
  box.set('s1', true);
  assert.equal(보냄.length, 1, '★ 한 번에 안 보낸다 — 중간에 끊기면 둘 다 켜진 채로 남는다.');
  assert.deepEqual(보냄[0].patch, { 's1/lead': true, 's2/lead': null },
    '★ 새로 켠 곳과 끈 곳이 한 묶음이 아니다.');
  assert.equal(보냄[0].path, 'fund_erp/sites/F1', '★ 기금 밑을 통째로 고치지 않는다.');
  assert.ok(보낸것.length === 0, '검사끼리 섞이면 안 된다');
});

test('★★ ② 이미 켜진 곳을 다시 누르면 꺼진다 — 잘못 누른 것을 되돌릴 길', () => {
  const { box, 보낸것 } = 지정상자(JSON.parse(JSON.stringify(셋)));
  box.set('s2', false);
  assert.deepEqual(보낸것[0].patch, { 's2/lead': null }, '★ 해제가 안 된다.');
});

test('★ ③ 바뀔 것이 없으면 아무것도 안 보낸다 — 헛저장이 「저장 완료」를 띄운다', () => {
  const { box, 보낸것 } = 지정상자(JSON.parse(JSON.stringify(셋)));
  box.set('s2', true);
  assert.equal(보낸것.length, 0, '★ 이미 그 곳이 대표인데 또 보낸다.');
});

test('★★ ④ 대표사업장을 «찾아 주는» 하나의 길이 있다', () => {
  const { box } = 지정상자(JSON.parse(JSON.stringify(셋)));
  assert.equal(box.lead([{ name: 'ㄱ' }, { name: 'ㄴ', lead: true }]).name, 'ㄴ');
  assert.equal(box.lead([{ name: 'ㄱ' }]), null, '★ 없을 때 빈 것을 안 돌려준다.');
  assert.equal(box.lead(null), null, '★ 목록이 없으면 터진다.');
});

test('★★ ⑤ 다시 읽게 해 둔다 — 안 그러면 별이 옛 자리에 그대로 있다', () => {
  const fn = 코드만(grabFn('setSiteLead'));
  assert.match(fn, /S\.sitesFor=null/, '★ 사업장을 다시 안 읽는다 — 화면이 옛 값이다.');
  assert.match(fn, /S\.fundId===_fid/, '★ 저장하는 사이 기금이 바뀐 것을 안 본다.');
  assert.match(fn, /catch\(function\(e\)\{ toast\('저장 실패/, '★ 실패가 조용하다.');
});

/* ══ ② 명부의 별 ══════════════════════════════════════════════════ */

test('★★ ⑥ 상호 앞에 별이 서고, 켜진 곳은 «끄는» 쪽으로 눌린다', () => {
  const 몸통 = SRC.slice(SRC.indexOf('var rows=arr.map(function(s,i){'),
    SRC.indexOf('var tbl = arr.length'));
  assert.match(몸통, /var 별=s\.lead\?'★':'☆';/, '★ 별이 없다.');
  assert.match(몸통, /setSiteLead\(\\'\'\+s\._id\+\'\\',\'\+\(s\.lead\?'false':'true'\)\+\'\)/,
    '★ 켜진 곳을 다시 눌러도 켜기로 간다 — 되돌릴 수가 없다.');
  assert.match(몸통, /event\.stopPropagation\(\);setSiteLead/,
    '★ 별을 누르면 편집 창까지 열린다.');
  assert.match(몸통, /class="leadb'\+\(s\.lead\?' on':''\)/, '★ 켜진 별이 표시가 안 난다.');
  /* 줄머리에 네모를 하나 더 세우지 않았는지 — 협력 체크 하나뿐이어야 한다 */
  assert.equal((몸통.match(/type="checkbox"/g) || []).length, 1,
    '★ 줄머리에 체크상자가 둘이다 — 어느 것이 무엇인지 매번 마우스를 올려야 한다.');
});

test('★★ ⑦ 대표사업장이 «맨 위»에 늘 보인다 — 스무 줄을 내려가며 별을 찾지 않게', () => {
  const st = 코드만(grabFn('sitesTab'));
  assert.match(st, /lead=_leadSite\(전체\)/,
    '★ 거른 뒤에서 찾는다 — 딱지를 누르면 대표사업장이 사라진 것처럼 보인다.');
  assert.match(st, /lead\?'<span class="stat lead"/, '★ 머리에 대표사업장이 없다.');
  assert.match(st, /대표사업장 미지정/, '★ 안 정했을 때 아무 말이 없다 — 정해야 하는 줄 모른다.');
  assert.match(SRC, /\.stat\.lead\{/, '★ 대표 딱지가 다른 배지와 구별이 안 된다.');
});

/* ══ ③ 머리 정리 ══════════════════════════════════════════════════ */

test('★★ ⑧ 두 층으로 갈린다 — 「보는 것」과 「추리는 것」이 한 줄에 섞이지 않는다', () => {
  const st = 코드만(grabFn('sitesTab'));
  assert.match(st, /var 머리=/, '★ 첫 줄이 따로 없다.');
  assert.match(st, /var 고르는줄=/, '★ 추리는 줄이 따로 없다.');
  /* 첫 줄에 «있어야 할 것»과 «없어야 할 것» */
  const 머리 = st.slice(st.indexOf('var 머리='), st.indexOf('var 고르는줄='));
  ['참여사업장', 'sub', '+ 사업장 추가', 'siteToolsMenu()'].forEach((x) => {
    assert.ok(머리.indexOf(x) >= 0, '첫 줄에 없다: ' + x);
  });
  ['찾기딱지', 'sortBar', '엑셀'].forEach((x) => {
    assert.ok(머리.indexOf(x) < 0, '★ 추리는 것이 첫 줄에 남았다: ' + x);
  });
});

test('★★ ⑨ 사업장이 하나도 없으면 «거르는 줄»을 아예 안 그린다', () => {
  const st = 코드만(grabFn('sitesTab'));
  assert.match(st, /var 고르는줄=\(!있음\|\|isYr\)\?''/,
    '★ 0개사인데 딱지 넷과 찾기 칸이 선다 — 무엇을 눌러야 시작되는지가 그 속에 묻힌다.');
  assert.match(st, /var 빈안내=/, '★ 시작하는 길 안내가 없다.');
  assert.match(st, /있음 \? '<div id="siteXlsxOut"><\/div>'\+tbl : 빈안내/,
    '★ 비었을 때 안내로 갈아 끼우지 않는다.');
});

test('★★ ⑩ 엑셀 받는 칸(dz-sites)은 «한 번만» 그려진다 — 둘이면 한쪽이 안 먹는다', () => {
  const st = grabFn('sitesTab');
  assert.equal((st.match(/dropZoneSlim\('dz-sites'/g) || []).length, 1,
    '★ dz-sites 를 두 곳에서 만든다 — id 가 겹쳐 바인딩이 한쪽만 붙는다.');
  /* 한 번 만들어 두 자리(있을 때·비었을 때)에서 «돌려 쓴다» — 동시에 나오지는 않는다 */
  assert.match(코드만(st), /var 엑셀=dropZoneSlim\('dz-sites'/, '★ 엑셀 칸을 따로 안 들고 있다.');
});

test('★★ ⑪ 가끔 쓰는 입구 넷이 서랍 안에 다 있다 — 하나라도 빠지면 길이 끊긴다', () => {
  const fn = 코드만(grabFn('siteToolsMenu'));
  [["openCardPick('site')", '기업정보함'], ['bulkSiteCards()', '일괄 채우기'],
   ['bizregBulkPick()', '사업자등록증 여러 장'], ['importSites()', '백업(JSON)']].forEach((p) => {
    assert.ok(fn.indexOf(p[0]) >= 0, '★ 서랍에서 빠졌다: ' + p[1]);
  });
  assert.match(fn, /hlp\('site\.bulkdoc'\)/, '★ ⓘ 설명이 단추에서 떨어졌다.');
  assert.match(fn, /tmClose\(this\);/, '★ 누른 뒤 서랍이 열린 채로 남는다.');
  /* 늘 쓰는 [+ 사업장 추가] 는 서랍 «밖»이어야 한다 */
  assert.ok(fn.indexOf('editSite') < 0, '★ 늘 쓰는 추가 단추를 서랍에 넣었다.');
});

test('★ ⑫ 서랍은 <details> 라 여닫는 상태를 브라우저가 갖는다 — 다시 그려도 안 꼬인다', () => {
  assert.match(코드만(grabFn('siteToolsMenu')), /<details class="tmenu"><summary/, '★ 서랍이 아니다.');
  assert.match(SRC, /\.tmenu>summary\{[^}]*list-style:none/, '★ 기본 삼각형이 남아 두 겹으로 보인다.');
  assert.match(SRC, /\.tmlist\{position:absolute/, '★ 서랍이 화면을 밀어낸다.');
  /* 닫는 길이 실제로 도는지 */
  const box = {};
  let 열림 = true;
  new Function('EL', grabFn('tmClose') + ';this.c=function(){ tmClose(EL); };')
    .call(box, { closest: () => ({ set open(v) { 열림 = v; } }) });
  box.c();
  assert.equal(열림, false, '★ 서랍이 안 닫힌다.');
  new Function('EL', grabFn('tmClose') + ';this.c=function(){ tmClose(EL); };')
    .call({}, { closest: () => null });   // 서랍 밖에서 불러도 터지면 안 된다
});

test('★★ ⑬ 머리 숫자는 «거르기 전» 전체다 — 딱지를 누를 때마다 달라지면 못 믿는다', () => {
  const st = 코드만(grabFn('sitesTab'));
  assert.match(st, /var 전체=arr;\s*arr=_siteFilter\(arr\);/, '★ 거르기 전 것을 안 들고 있다.');
  const 머리 = st.slice(st.indexOf('var 머리='), st.indexOf('var 고르는줄='));
  assert.match(머리, /'<span class="stat">'\+nAll\+'개사<\/span>/,
    '★ 개사 수를 거른 뒤로 센다 — 딱지 하나에 「16개사」가 「3개사」가 된다.');
  assert.ok(머리.indexOf('arr.length') < 0, '★ 머리에 거른 수가 남았다.');
  /* 거른 결과는 거르는 줄에서 「3 / 16개사」로 따로 말한다 */
  assert.match(st, /arr\.length\+' \/ '\+nAll\+'개사/, '★ 거른 결과를 알려 주지 않는다.');
});
