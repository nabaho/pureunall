'use strict';
/* 🔑 회사 열쇠 = 사업자번호 (온톨로지 1걸음, 대표 결정 2026-09-18 「추천대로」)

   ■ 왜
     「회사」가 여섯 군데에 따로 적혀 있고 합치면 493곳이다(2026-09-18 실측).
     영구번호를 새로 매기는 대신 «이미 있는» 사업자번호를 열쇠로 쓴다 —
     계약 78% · 컨설팅 95% · 업체관리 91% · 기업정보함 기업상세 100%가 갖고 있다.

   ★ 이 검사가 못 박는 것:
     ① 검산은 국세청 규칙 그대로 — 통과 못 한 번호는 «없는 것»
     ② 두 앱이 «한 파일»을 쓴다 — 각자 셈하면 같은 회사가 둘로 갈린다
     ③ 이름으로는 잇지 않는다
     ④ 계약창은 «빈 칸만» 채우고, 눌러야 들어간다 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const K = require(path.join(ROOT, 'js', 'pu-cokey.js'));
const ERP_RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const ERP = stripJs(ERP_RAW);
const CARDS = stripJs(fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8'));

/* 2026-09-18 서버에 실제로 있는 번호.
   ⚠★ 뒤의 셋은 «아홉째 자리가 2 이상»이다 — 국세청 규칙의 ×5 보정을 지워도
     아홉째 자리가 0·1 이면 그대로 통과한다. 그 구멍을 실제로 겪었다. 지우지 말 것. */
const REAL = ['314-86-59404', '215-81-62801', '312-81-43008',
              '312-86-42324', '312-83-01166', '312-81-05571'];

test('① 검산 — 국세청 규칙 그대로', () => {
  REAL.forEach(n => assert.equal(K.bizNoOk(n), true, n));
  REAL.forEach(n => {
    const d = n.replace(/\D/g, '');
    assert.equal(K.bizNoOk(d.slice(0, 9) + ((+d[9] + 1) % 10)), false, '끝자리를 바꾸면 걸린다');
  });
  assert.equal(K.bizNoOk('123-45-67890'), false, '아무 숫자나 통과하지 않는다');
  assert.equal(K.bizNoOk('31486594'), false, '열 자리가 아니면 안 된다');
  assert.equal(K.bizNoOk(''), false);
  assert.equal(K.bizNoOk(null), false);
});

test('② 열쇠 — 열세 자리도 앞 열 자리로 끊는다 (업체관리에 실제로 있다)', () => {
  assert.equal(K.key('312-10-55163-0'), '3121055163', '뒤 사업장 번호는 떼어 낸다');
  assert.equal(K.key('3148659404'), '3148659404');
  assert.equal(K.key('314-86-59404'), '3148659404', '붙임표가 있어도 같은 열쇠');
  assert.equal(K.key('123-45-67890'), '', '검산 못 한 번호는 열쇠가 «없다»');
  assert.equal(K.key('3148'), '');
});

test('③ 자리 이름을 한 곳에서만 만든다 — 한쪽이 coinfo 로 적으면 영영 안 보인다', () => {
  assert.equal(K.coInfoPath('314-86-59404'), 'pucards/coInfo/3148659404');
  assert.equal(K.coInfoPath('123-45-67890'), '', '못 믿을 번호면 자리도 없다');
});

test('④ 같은 회사인가 — 번호가 없으면 «판단하지 않는다»(false 가 아니다)', () => {
  assert.equal(K.sameCo('314-86-59404', '3148659404'), true);
  assert.equal(K.sameCo('314-86-59404', '312-86-42324'), false);
  assert.equal(K.sameCo('314-86-59404', ''), null, '한쪽이 없으면 모른다');
  assert.equal(K.sameCo('', ''), null);
  assert.equal(K.sameCo('123-45-67890', '123-45-67890'), null, '둘 다 못 믿으면 모른다');
});

test('⑤ 열 자리는 되지만 검산을 못 한 번호를 가릴 수 있다', () => {
  assert.equal(K.looksLikeBizNo('123-45-67890'), true, '번호 «꼴»이기는 하다');
  assert.equal(K.bizNoOk('123-45-67890'), false, '그러나 못 믿는다');
  assert.equal(K.looksLikeBizNo('123'), false);
});

test('⑥★ 두 앱이 «한 파일»을 쓴다 — 각자 셈하면 같은 회사가 둘로 갈린다', () => {
  ['pu-erp.html', 'pu-cards.html'].forEach(f => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    assert.match(s, /<script src="js\/pu-cokey\.js\?v=\d+"><\/script>/, f + ' 이 공용 열쇠를 안 싣는다');
  });
  /* 기업정보함이 제 사본으로 되돌아가지 않았다 */
  /* ⚠ 맨이름(PuCoKey)이 아니라 window 를 거쳐 부른다 — window 로 확인해 놓고
       맨이름으로 부르면 브라우저에서는 되지만 검사 창(vm)에서는 터진다. */
  assert.match(CARDS, /function bizNoOk\(v\)\{ return !!\(window\.PuCoKey && window\.PuCoKey\.bizNoOk\(v\)\); \}/,
    '기업정보함이 검산을 다시 제 손으로 하고 있다');
  assert.match(CARDS, /function bizKey10\(v\)\{ return \(window\.PuCoKey && window\.PuCoKey\.key\(v\)\) \|\| ''; \}/);
  assert.ok(!/var w = \[1,3,7,1,3,7,1,3,5\]|const w = \[1,3,7,1,3,7,1,3,5\]/.test(CARDS),
    '가중치 표가 기업정보함에 다시 생겼다 — 공용 파일에만 있어야 한다');
});

test('⑦★ 계약창은 «번호»로만 찾는다 — 이름으로 찾지 않는다', () => {
  const at = ERP.indexOf('var k = (window.PuCoKey && window.PuCoKey.key(f.company && f.company.bizNo))');
  assert.ok(at > 0, '사업자번호로 찾는 자리가 없다');
  /* ⚠ 고정 폭으로 자르면 뒤엣것까지 끌려와 엉뚱하게 걸린다 — 그 효과의 «끝»에서 끊는다 */
  const end = ERP.indexOf("}, [ (f.company && f.company.bizNo) || '' ]);", at);
  assert.ok(end > at, '그 효과의 끝을 찾을 수 있다');
  const eff = ERP.slice(at, end);
  assert.match(eff, /if\(!k\)\{ setCoInfoHit\(null\); return; \}/, '열쇠가 없으면 아무것도 안 한다');
  assert.match(eff, /window\.PuCoKey\.coInfoPath\(f\.company\.bizNo\)/, '자리도 공용 파일이 만든다');
  assert.match(eff, /\.once\('value'\)/, '구독하지 않고 «한 번»만 읽는다');
  assert.ok(!/companyName|f\.company\.name/.test(eff),
    '이름으로 찾으면 안 된다 — 「가나상사」가 두 곳일 수 있다');
});

test('⑧ 알맹이 없는 자리는 «없는 것»으로 친다 (207 중 180이 열쇠만 있었다)', () => {
  const at = ERP.indexOf('var k = (window.PuCoKey && window.PuCoKey.key(f.company && f.company.bizNo))');
  const eff = ERP.slice(at, at + 1100);
  assert.match(eff, /v && String\(v\.company\|\|''\)\.trim\(\) \? \{ key:k, v:v \} : null/,
    '회사명이 없으면 띠를 안 띄운다');
});

test('⑨★ 빈 칸만 채운다 — 이미 적힌 값은 건드리지 않는다', () => {
  const fn = stripJs(cutFn(ERP_RAW, 'function coInfoFillable('));
  assert.match(fn, /return got && !had;/, '있는 값은 「채울 것」에서 뺀다');
  const fill = stripJs(cutFn(ERP_RAW, 'function coInfoFill('));
  assert.match(fill, /add\.forEach\(function\(p\)\{ nextC\[p\[1\]\] = String\(hit\.v\[p\[0\]\]\)\.trim\(\); \}\);/,
    '「채울 것」으로 가려낸 칸만 쓴다');
  assert.ok(!/Object\.assign\(\{\}, prev\.company, hit\.v\)/.test(fill),
    '통째로 덮으면 사람이 적어 둔 값이 조용히 지워진다');
});

test('⑩ 업태와 종목을 바꿔 넣지 않는다 (이름이 다르다)', () => {
  const map = ERP.slice(ERP.indexOf('var COINFO_TO_CONTRACT = ['),
                        ERP.indexOf('];', ERP.indexOf('var COINFO_TO_CONTRACT = [')));
  assert.match(map, /\['bizType','bizType'\]/, '업태는 업태로');
  assert.match(map, /\['bizItem','bizCategory'\]/, '기업정보함의 종목은 계약의 bizCategory 다');
  assert.ok(!/\['bizItem','bizType'\]/.test(map), '바꿔 넣으면 업태 칸에 종목이 들어간다');
});

test('⑪★ 저절로 채우지 않는다 — 눌러야 들어간다', () => {
  const at = ERP.indexOf("'📇 기업정보함에 「'");
  assert.ok(at > 0, '띠가 없다');
  const band = ERP.slice(at - 900, at + 1600);
  assert.match(band, /onClick:function\(\)\{ coInfoFill\(coInfoHit\); \}/, '누르면 채운다');
  assert.match(band, /'빈 칸 채우기'/);
  assert.match(band, /coInfoHit && \(function\(\)\{/, '찾았을 때만 띠가 뜬다');
  assert.match(band, /'이미 다 들어 있습니다'/, '채울 것이 없으면 그렇게만 말한다');
  /* 자동으로 부르는 자리가 없어야 한다 */
  const auto = ERP.match(/useEffect\([^;]{0,400}coInfoFill\(/g) || [];
  assert.deepEqual(auto, [], '창이 열리면서 저절로 채우면 안 된다');
});
