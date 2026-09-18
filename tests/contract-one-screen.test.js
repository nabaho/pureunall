'use strict';
/* 계약창을 한 화면에 — 좌우로 펴고 탭을 없앤다 (대표 지시 2026-09-18 · 목업 승인)

   「계약관리 전체 화면이 아래로 안 내려가고 한 화면에 모두 볼 수 있게 좌우로 넓게
    해서 한번에 데이터 보고 넣게 할 수 있나」
   「단 화면이 너무 불필요하게 많이 있다. 이 부분 정리하고」

   ★ 못 박는 것은 «규칙»이지 지금 숫자가 아니다 —
     폭 1560·1180 같은 값은 대표가 보시고 바꿀 수 있으므로 «있는가»만 본다.
     다만 좁은 화면에서 옛 모습이 남는 것과, 넷을 다 만들어도 훅이 없는 것은
     값이 곧 규칙이라 그대로 박는다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const SRC = stripJs(RAW);

/* 계약창 한 덩이 */
const MODAL = (function () {
  const at = SRC.indexOf('function ContractModal(');
  assert.ok(at > 0, 'ContractModal 을 찾지 못했습니다');
  const end = SRC.indexOf('\nfunction ', at + 30);
  return SRC.slice(at, end > 0 ? end : at + 260000);
})();

test('① 네 장을 «다» 만들어 둔다 — 골라 그리던 것을 나란히 세우려면', () => {
  ['company', 'contract', 'manager', 'journal'].forEach(k => {
    assert.match(MODAL, new RegExp('PANES\\.' + k + ' = h\\('), k + ' 장을 만든다');
  });
  assert.ok(!/else if\(tab === 'contract'\)\{\s*tabBody = h\(/.test(MODAL),
    '「지금 장만 만들기」로 되돌아가지 않았다');
  assert.match(MODAL, /tabBody = PANES\[tab\] \|\| PANES\.company;/,
    '좁은 화면은 그중 한 장을 고른다');
});

test('②★ 그 안에 훅이 하나도 없다 — 넷을 늘 만들어도 순서가 안 어긋난다', () => {
  const a = MODAL.indexOf('var PANES = {};');
  const b = MODAL.indexOf('tabBody = PANES[tab]');
  assert.ok(a > 0 && b > a, '장을 만드는 대목을 찾을 수 있다');
  const panes = MODAL.slice(a, b);
  const hooks = panes.match(/\buse(State|Effect|Ref|Memo|Callback|Reducer)\s*\(/g) || [];
  assert.deepEqual(hooks, [],
    '장을 만드는 대목에 훅이 들어오면 안 된다 — 한 장만 그리던 시절의 순서로 어긋난다');
});

test('③ 넓으면 기둥, 좁으면 예전 탭', () => {
  assert.match(MODAL, /var WIDE = \(typeof window !== 'undefined'\) && window\.innerWidth >= \d+;/,
    '넓은지 가리는 잣대가 있다');
  assert.match(MODAL, /var WIDE3 = \(typeof window !== 'undefined'\) && window\.innerWidth >= \d+;/,
    '세 기둥인지 가리는 잣대가 따로 있다');
  assert.match(MODAL, /!WIDE && h\('div', \{ style:\{ display:'flex', borderBottom/,
    '넓으면 탭 줄을 «안 그린다» — 오갈 곳이 없다');
  assert.match(MODAL, /maxHeight:'55vh', overflowY:'auto', padding:'16px'/,
    '좁은 화면은 예전 그대로 한 장씩 — 폰에서 기둥 셋은 못 쓴다');
});

test('④ 세로를 반만 쓰던 것을 창에 맞춘다', () => {
  /* ⚠ 줄끝을 글에 넣지 않는다 — 저장소는 CRLF 라 `\n` 로 적으면 못 찾는다 */
  const a = MODAL.indexOf("? h('div', { className:'modal-b'");
  const b = MODAL.indexOf(": h('div', { className:'modal-b'", a);
  assert.ok(a > 0 && b > a, '넓은 쪽 본문을 찾을 수 있다');
  const wideBody = MODAL.slice(a, b);
  assert.match(wideBody, /maxHeight:'70vh'/, '창 높이에 맞춘다(55% 로 묶지 않는다)');
  assert.ok(!/maxHeight:'55vh'/.test(wideBody), '넓은 쪽에 옛 55% 제한이 남아 있지 않다');
});

test('⑤ 스크롤은 «기둥 안»에서 생긴다 — 한 기둥이 길어도 옆이 안 밀린다', () => {
  const pane = cutFn(RAW, 'function colPane(');
  assert.match(pane, /overflowY:'auto'/, '기둥마다 제 스크롤');
  assert.match(pane, /minWidth:0/, '격자 칸이 안 넘치게');
  assert.match(pane, /position:'sticky'/, '기둥 제목은 붙어 있다 — 내려도 여기가 어딘지 안 잃는다');
});

test('⑥ 넓은 화면에는 「이전 / 다음」이 없다 — 저장 하나', () => {
  const at = MODAL.indexOf("var TAB_ORDER = ['company','contract','manager','note'];");
  assert.ok(at > 0);
  const foot = MODAL.slice(at, at + 2400);
  assert.match(foot, /if\(WIDE\)\{[\s\S]{0,400}?'💾 저장'/,
    '넓으면 저장 단추 하나만 돌려준다');
  assert.match(foot, /'← 이전'/, '좁은 화면에는 그대로 남아 있다');
});

test('⑦ 폭이 화면을 넘지 않는다', () => {
  assert.match(MODAL, /width: WIDE3 \? '\d+px' : \(WIDE \? '\d+px' : '620px'\), maxWidth:'97vw'/,
    '넓힌 창도 화면 밖으로 나가지 않는다');
});

test('⑧★ 의뢰인 유형 설명은 «한 벌»이다 — 두 벌이면 한쪽만 고쳐져 갈린다', () => {
  const tip = MODAL.match(/【회사가 의뢰인일 때】/g) || [];
  assert.equal(tip.length, 1, '말풍선 글은 CT_TIP 한 곳에만 적는다');
  assert.match(MODAL, /var CT_TIP = \{/, '두 화면이 나눠 쓴다');
  assert.match(MODAL, /ctChip\('company', '🏢 회사',\s*CT_TIP\.company\)/, '넓은 쪽이 갖다 쓴다');
  assert.match(MODAL, /ctBar\('company', '🏢 회사\(의뢰인\)',\s*CT_TIP\.company\)/, '좁은 쪽도 같은 것을');
});

test('⑨ 넓은 화면의 의뢰인 유형은 «한 줄»이다 (전에는 다섯 줄이었다)', () => {
  const at = MODAL.indexOf('if(WIDE){');
  assert.ok(at > 0);
  const band = MODAL.slice(at, MODAL.indexOf('return h(\'div\', { style:{ margin: M?', at));
  assert.ok(!/의뢰인 유형 — 먼저 선택하세요/.test(band),
    '넓은 화면에는 제목 줄을 안 그린다 — 칩만 봐도 안다');
  assert.match(band, /'⚖️ 의뢰인'/, '무엇을 고르는 자리인지는 남긴다');
  assert.match(band, /ctDesc/, '설명은 «없애지 않고» 옆에 한 줄로 남긴다');
});

test('⑩ 기둥 제목이 탭 이름을 대신한다 — 어디가 어딘지 알아야 한다', () => {
  assert.match(MODAL, /colPane\('🏢 의뢰인 · 기업정보'/);
  assert.match(MODAL, /colPane\('📄 계약정보'/);
  assert.match(MODAL, /colPane\('👤 담당자 · 📋 일지'/, '세 기둥일 때는 담당자와 일지가 한 기둥');
  assert.match(MODAL, /colPane\('👤 담당자정보'[\s\S]{0,140}colPane\('📋 일지'/,
    '두 기둥일 때는 아래 줄에 나란히');
});

/* ───────── 2026-09-18 두 번째 정리 (대표 「현재 이렇게 하면 엉망이 된다」) ───────── */

test('⑪★ 업체 연결은 회사정보 «뒤»에 온다 — 회사명을 쳐야 후보가 나온다', () => {
  const 회사명 = MODAL.indexOf("'의뢰인 (회사명) '");
  const 연결   = MODAL.indexOf("'업체 연결 확인'");
  assert.ok(회사명 > 0 && 연결 > 0, '두 자리를 모두 찾을 수 있다');
  assert.ok(연결 > 회사명,
    '업체 연결 상자가 회사명 칸보다 «앞»에 있으면 파란 상자 네 줄을 지나야 회사명이 보인다');
});

test('⑫ 서류 가져오기 — 길 셋이 다 있고, 제목이 «제 단추 위»에 있다', () => {
  /* ⚠★ 2026-09-18 에 한 줄로 합쳤다가 대표 지시로 «되돌렸다»
       (「캡쳐 기존으로 돌려라」). 기둥이 좁아 한 줄이 도로 세 줄로 접혔고,
       그때는 제목과 단추가 갈라져 「어느 서류의 단추인지」가 더 헷갈렸다.
       ★ 넓은 화면을 믿고 한 줄에 몰지 말 것 — 세로로 쪼갠 기둥은 한 줄이 짧다. */
  const dz = stripJs(cutFn(RAW, 'function dropZone('));
  /* 길 셋은 늘 있어야 한다 */
  assert.match(dz, /📇 기업정보함 정보 가져오기/, '기업정보함에서 가져오는 길');
  assert.match(dz, /📷 사진으로 채우기/, '사진으로 채우는 길');
  assert.match(dz, /기업정보함에서 보기/, '사진 보러 가는 길');
  /* 제목이 «맨 먼저» 온다 — 그래야 어느 서류의 단추인지 안다 */
  const 제목 = dz.indexOf("h('span', null, title)");
  const 가져오기 = dz.indexOf('📇 기업정보함 정보 가져오기');
  const 사진 = dz.indexOf('📷 사진으로 채우기');
  assert.ok(제목 > 0 && 제목 < 가져오기 && 가져오기 < 사진,
    '제목 → 가져오기 → 사진으로 채우기 차례라야 한다');
  assert.match(dz, /글자만 읽고 사진은 버립니다/, '사진을 안 담는다는 것을 화면에 적는다');
  assert.match(dz, /onDrop:function\(e\)\{ e\.preventDefault\(\); fillFrom\(/,
    '끌어다 놓기도 받는다');
});

test('⑬ 늘 떠 있던 안내 한 줄은 말풍선으로 (상태 줄은 그대로 남는다)', () => {
  assert.ok(!/h\('div',\{style:\{fontSize:'10\.5px',marginTop:'4px',color:'#64748b'\}\},'사업자번호가 하나의 업체와/.test(MODAL),
    '늘 떠 있던 줄은 없앴다');
  assert.match(RAW, /title:'사업자번호가 하나의 업체와 정확히 일치하면 자동 연결합니다/,
    '그 글은 말풍선에 살아 있다 — 지우지 않았다');
  assert.match(MODAL, /!companyLinkTouched \? '업체를 고르면/,
    '그때그때 달라지는 «답» 줄은 그대로 둔다 — 그건 잔소리가 아니다');
});

test('⑭ 빈 상자는 안 그린다 — 「변경 이력 없음」이 기둥 한가운데를 먹고 있었다', () => {
  assert.match(MODAL, /\(f\.mgrHistory\|\|\[\]\)\.length > 0 &&\s*h\('div'/,
    '이력이 없으면 상자째 안 그린다');
});
