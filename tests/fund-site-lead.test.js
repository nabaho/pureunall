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
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('상수 끝을 못 찾음: ' + name);
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

/* 명부 한 줄을 «정말 그려» 본다 — 글자로 훑으면 별이 어느 칸에 붙었는지 알 수 없다 */
function 줄그리기(site, 별쓰나) {
  const from = SRC.indexOf('var rows=arr.map(function(s,i){');
  let d = 0, end = -1;
  for (let k = SRC.indexOf('{', from + 20); k < SRC.length; k++) {
    if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) { end = k; break; } }
  }
  const body = SRC.slice(SRC.indexOf('{', from + 20) + 1, end);
  const box = {};
  new Function('S', 'LEAD', [
    'function esc(v){ return String(v==null?"":v); }',
    'function num(v){ return Number(v)||0; }',
    'function _siteContacts(){ return {name:"",mobile:"",email:""}; }',
    'function _siteWrep(){ return {name:""}; }',
    'var 별쓰나=LEAD;',
    'this.row=function(s,i){ ' + body + ' };'
  ].join('\n')).call(box, null, 별쓰나);
  return box.row(site, 0);
}
const 사업장 = { _id: 'S1', name: '가나산업', ceo: '홍길동', biz_no: '000-00-00000',
  biz_type: '제조', company_size: 12, address: '어딘가 1' };

test('★★ ⑥ 상호 앞에 별이 서고, 켜진 곳은 «끄는» 쪽으로 눌린다', () => {
  const 꺼짐 = 줄그리기(사업장, true);
  const 켜짐 = 줄그리기(Object.assign({}, 사업장, { lead: true }), true);
  assert.match(꺼짐, /☆/, '★ 별이 없다.');
  assert.match(켜짐, /★/, '★ 지정된 곳이 빈 별이다.');
  assert.match(켜짐, /class="leadb on"/, '★ 켜진 별이 표시가 안 난다.');
  /* 켜진 것을 누르면 «끄기»로 가야 한다 */
  assert.match(켜짐, /setSiteLead\('S1',false\)/, '★ 켜진 곳을 다시 눌러도 켜기로 간다 — 되돌릴 수가 없다.');
  assert.match(꺼짐, /setSiteLead\('S1',true\)/, '★ 꺼진 곳을 눌러도 안 켜진다.');
  assert.match(켜짐, /event\.stopPropagation\(\);setSiteLead/, '★ 별을 누르면 편집 창까지 열린다.');
  /* 별은 «상호 칸 안»에 있어야 한다 — 따로 칸을 만들면 칸 수가 어긋나 값이 옆으로 밀린다 */
  const 칸들 = 켜짐.split('<td').slice(1);
  const 상호칸 = 칸들.filter((t) => t.indexOf('가나산업') >= 0)[0];
  assert.ok(상호칸 && 상호칸.indexOf('★') >= 0, '★ 별이 상호 칸 밖에 있다.');
  /* 줄머리에 네모를 하나 더 세우지 않았는지 — 협력 체크 하나뿐이어야 한다 */
  assert.equal((켜짐.match(/type="checkbox"/g) || []).length, 1,
    '★ 줄머리에 체크상자가 둘이다 — 어느 것이 무엇인지 매번 마우스를 올려야 한다.');
});

test('★★ ⑥-2 지역기금이 «아니면» 별이 아예 안 선다 — 칸 수는 그대로', () => {
  const 지역 = 줄그리기(사업장, true), 아님 = 줄그리기(사업장, false);
  assert.ok(!/[★☆]/.test(아님), '★ 대표사업장이 없는 기금에 빈 별이 섰다 — 눌러도 되는 줄 안다.');
  assert.ok(!/setSiteLead/.test(아님), '★ 안 보이는데 눌리는 자리가 남았다.');
  assert.equal(아님.split('<td').length, 지역.split('<td').length,
    '★ 별을 빼면서 칸이 하나 사라졌다 — 값이 옆으로 밀린다.');
});

test('★★ ⑥-3 별을 세울지는 홈 묶음과 «같은 잣대»로 가른다', () => {
  const box = {};
  new Function(grabFn('isRegionFund') + ';this.f=isRegionFund;').call(box);
  assert.equal(box.f({ fund_type: '공동', region: '충남' }), true, '지역기금');
  assert.equal(box.f({ fund_type: '공동', region: '' }), false, '지역이 없으면 개별공동');
  assert.equal(box.f({ fund_type: '사내', region: '충남' }), false, '사내기금은 대표사업장이 없다');
  assert.equal(box.f(null), false, '기금이 없으면 터지면 안 된다');
  /* grp() 와 같은 잣대인지 — 갈리면 목록은 지역기금인데 명부에 별이 없는 기금이 생긴다 */
  const g = {};
  new Function(grabFn('grp') + ';this.g=grp;').call(g);
  [{ fund_type: '공동', region: '충남' }, { fund_type: '공동', region: '' },
   { fund_type: '사내', region: '충남' }].forEach((f) => {
    assert.equal(box.f(f), g.g(f) === '지역공동', '★ 홈 묶음과 잣대가 다르다: ' + JSON.stringify(f));
  });
});

test('★★ ⑦ 대표사업장이 «맨 위»에 늘 보인다 — 스무 줄을 내려가며 별을 찾지 않게', () => {
  const st = 코드만(grabFn('sitesTab'));
  assert.match(st, /lead=_leadSite\(전체\)/,
    '★ 거른 뒤에서 찾는다 — 딱지를 누르면 대표사업장이 사라진 것처럼 보인다.');
  assert.match(st, /lead\?'<span class="stat lead"/, '★ 머리에 대표사업장이 없다.');
  assert.match(st, /대표사업장 미지정/, '★ 안 정했을 때 아무 말이 없다 — 정해야 하는 줄 모른다.');
  assert.match(SRC, /\.stat\.lead\{/, '★ 대표 딱지가 다른 배지와 구별이 안 된다.');
});

/* ══ ②-2 서식으로 가는 길 (대표 지시 2026-09-14 「1 서식넣어라」) ══════ */

function 대표회사(f, sites) {
  const box = {};
  new Function('F', 'SITES', [
    grabFn('isRegionFund'), grabFn('_leadSite'), grabFn('repOrg'),
    'this.v=repOrg(F,SITES);'
  ].join('\n')).call(box, f, sites);
  return box.v;
}
const 지역기금 = { fund_type: '공동', region: '충남' };

test('★★ ⑭ 명부에서 ★ 로 지정한 곳이 「대표회사·사무국」이 된다', () => {
  assert.equal(대표회사(지역기금, [{ name: '가나산업' }, { name: '다라전자', lead: true }]), '다라전자');
});

test('★★ ⑮ ★ 가 손으로 적은 칸을 «이긴다» — 두 값이 다르면 사람이 마지막에 고른 쪽이 맞다', () => {
  assert.equal(대표회사(Object.assign({ rep_org: '손으로적은곳' }, 지역기금),
    [{ name: '다라전자', lead: true }]), '다라전자');
  /* ★ 가 없으면 손으로 적은 칸 그대로 */
  assert.equal(대표회사(Object.assign({ rep_org: '손으로적은곳' }, 지역기금),
    [{ name: '가나산업' }]), '손으로적은곳');
  assert.equal(대표회사(지역기금, []), '', '★ 둘 다 없는데 뭔가를 지어낸다.');
});

test('★★ ⑯ 탈퇴한 사업장은 대표가 못 된다 — 나간 회사 이름이 서식에 찍힌다', () => {
  assert.equal(대표회사(Object.assign({ rep_org: '남은곳' }, 지역기금),
    [{ name: '나간곳', lead: true, status: 'closed' }]), '남은곳');
});

test('★★ ⑰ 지역기금이 아니면 ★ 를 «안 본다» — 안 보이는 값이 서식을 움직이면 안 된다', () => {
  const 사내 = { fund_type: '사내', region: '충남', rep_org: '손으로적은곳' };
  assert.equal(대표회사(사내, [{ name: '다라전자', lead: true }]), '손으로적은곳');
  const 개별 = { fund_type: '공동', region: '', rep_org: '손으로적은곳' };
  assert.equal(대표회사(개별, [{ name: '다라전자', lead: true }]), '손으로적은곳');
});

test('★★ ⑱ 서식 다섯 곳이 «모두» 한 길로 간다 — 따로 두면 어떤 서식만 ★ 가 들어간다', () => {
  assert.ok(!/\bf\.rep_org\b/.test(코드만(SRC).replace(grabFn('repOrg'), '')),
    '★ 아직 f.rep_org 를 직접 읽는 곳이 남았다 — 그 서식에는 ★ 가 안 들어간다.');
  ['charterSane', 'docBody', 'fillSetup', 'fillSubsidy'].forEach((n) => {
    const fn = 코드만(grabFn(n));
    if (fn.indexOf('rep_org') >= 0 || fn.indexOf('repOrg') >= 0) {
      assert.match(fn, /repOrg\(f,sites\)/, '★ ' + n + ' 이 제 길로 안 간다.');
    }
  });
  /* 「대표회사·사무국」 칸 자체는 그대로 있어야 한다 — ★ 를 안 쓰는 기금이 쓴다 */
  assert.match(grabDecl('FIELDS'), /\['rep_org','대표회사·사무국','text'\]/, '★ 칸이 사라졌다.');
});

test('★★ ⑲ 기금 정보의 그 칸이 «무엇이 들어가는지» 말해 준다 — 배관 양 끝', () => {
  const fn = 코드만(grabFn('infoForm'));
  assert.match(fn, /c\[0\]==='rep_org' && isRegionFund\(f\)/, '★ 아무 말도 하지 않는다.');
  assert.match(fn, /서식에는 이 이름이 들어갑니다/,
    '★ 이 칸에 다른 상호를 적어 두고 왜 서식에 딴 이름이 나오는지 모른 채 헤매게 된다.');
  assert.match(fn, /이 칸은 쓰이지 않습니다/, '★ 적어 둔 값이 무시되는 것을 말하지 않는다.');
  assert.match(fn, /_fundSites\(S\.fundId\)/, '★ 참여 지자체와 다른 자리를 본다.');
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
