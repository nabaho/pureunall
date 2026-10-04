'use strict';
/* 🖋 도장 찍을 자리 고르기 (대표 승인 2026-09-29 목업)
   ─────────────────────────────────────────────────────────────
   대표 지적: 「권형하 도장을 넣고 싶은데 … 자동으로 넣어도 잘 안들어간다. 도장만 넣기 따로 하고 싶은데」
   실측(제안서 평가위원 후보자 등록 신청서): (인) 자리가 3곳 — 작성자·평가위원 후보자·작성자.
   옛 방식은 «맨 처음 한 곳»에만 찍고 멈춰, 서약서의 「평가위원 후보자 (인)」에는 안 들어갔다.

   못 박는 것:
     ① 자리를 «모두» 찾는다 · 맨 처음 것은 옛 findSpot 과 같은 자리다
     ② 자리마다 사람이 알아볼 앞 글자(label)를 준다
     ③ 찍는 길은 고른 자리(_rhStampPick)에만 찍고, 고른 것이 없으면 옛 방식(한 곳)이다
     ④ 한 구역에 여럿 찍을 때 «뒤에서부터» 넣는다 — 앞에 넣으면 뒤 자리가 밀린다
     ⑤ 자리가 둘 이상일 때만 고르기 창을 띄운다 · 조용히(채우기 뒤) 부를 때는 안 묻는다
     ⑥ 고른 자리는 자동 저장·되돌리기·새 서식 초기화를 따라간다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require(path.join(__dirname, '..', 'js', 'kcareer-hwpstamp.js'));
const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

function para(text) {
  return '<hp:p id="0" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="3"><hp:t>' + text + '</hp:t></hp:run></hp:p>';
}
const SEC = '<hs:sec>' + para('작성자 : (인)') + para('위 사항을 서약합니다')
  + para('평가위원 후보자 권 형 하 (인)') + para('작성자 :') + para('(인)') + '</hs:sec>';

test('① 자리를 모두 찾고, 맨 처음 것은 옛 방식과 같다', () => {
  const all = S.findSpots(SEC);
  assert.ok(all.length >= 3, '(인) 자리 셋을 다 찾아야 한다');
  assert.equal(all[0].index, S.findSpot(SEC).index);
  for (let i = 1; i < all.length; i++) assert.ok(all[i].index > all[i - 1].index, '앞에서 뒤 순서');
});

test('② 자리마다 앞 글자를 준다 — 어느 자리인지 알아보게', () => {
  const all = S.findSpots(SEC);
  assert.ok(all.some(s => /평가위원 후보자/.test(s.label)));
  all.forEach(s => assert.match(s.label, /\(인\)/));
});

test('자리가 없으면 빈 목록 — 아무 데나 찍지 않는다', () => {
  assert.deepEqual(S.findSpots(para('서약합니다')), []);
  assert.deepEqual(S.findSpots(''), []);
});

test('④ 여럿 찍어도 문서가 안 깨진다 — 뒤에서부터 넣으면 자리마다 하나씩 붙는다', () => {
  const all = S.findSpots(SEC);
  let x = SEC;
  for (let q = all.length - 1; q >= 0; q--) x = S.insertPic(x, S.picXml({ id: 'image1', picId: 9100 + q }), all[q]);
  assert.equal((x.match(/<hp:pic /g) || []).length, all.length);
  /* 도장마다 바로 앞이 (인) 자리여야 한다 */
  const parts = x.split('<hp:run charPrIDRef="3"><hp:pic');
  for (let k = 1; k < parts.length; k++) assert.match(parts[k - 1], /\(인\)<\/hp:t><\/hp:run>$/);
  assert.equal(new Set((x.match(/<hp:pic id="(\d+)"/g) || [])).size, all.length, '그림 번호가 겹치지 않는다');
});

test('③④ 찍는 길은 고른 자리에만 · 고른 것이 없으면 한 곳 · 뒤에서부터 넣는다', () => {
  const fn = /async function rhStampZip\(zip\)\{[\s\S]*?\n\}/.exec(html)[0];
  assert.match(fn, /findSpots\(/);
  assert.match(fn, /_rhStampPick/);
  assert.match(fn, /for\(var q=찍을\.length-1;q>=0;q--\)/, '뒤에서부터 넣어야 한다');
  assert.match(fn, /if\(!고름\) break;/, '고르지 않았으면 한 곳에서 멈춘다');
});

test('⑤ 자리가 둘 이상일 때만 고르기 창 · 조용히 부를 때는 안 묻는다', () => {
  const fn = /async function rhStampDoc\(quiet\)\{[\s\S]*?\n\}/.exec(html)[0];
  assert.match(fn, /var 자리=quiet\?\[\]:await rhStampSpotsNow\(\)/);
  assert.match(fn, /자리\.length>=2[\s\S]*rhStampPickAsk\(/);
  assert.match(html, /id="modalStampPick"/);
  const ask = /function rhStampPickAsk\(spots, preset\)\{[\s\S]*?\n\}/.exec(html)[0];
  /* 2026-10-04 목업 A — 처음 켜 두는 것: 이미 도장이 있으면 끄고, 그 사람 도장이 없으면 끈다(남의 도장이 찍히면 안 된다) */
  assert.match(ask, /var on=p\?true:\(!s\.sealed && !!고른\)/);
  assert.match(ask, /stampOfWho\(s\.who\)/, '서명 줄 이름과 같은 도장을 먼저 고른다');
  assert.match(ask, /escapeHtml\(s\.label/, '서식 글자를 그대로 넣지 않는다');
});

test('⑥ 고른 자리는 저장·되돌리기·초기화를 따라간다', () => {
  assert.match(/function _rhOutPack\(\)\{[\s\S]*?\n\}/.exec(html)[0], /stampPick:/);
  assert.match(html, /_rhStampPick=Array\.isArray\(표\.stampPick\)\?표\.stampPick:null/);
  assert.match(html, /stampPick:_rhStampPick/);
  assert.match(html, /_rhStampPick=_rhUndo\.stampPick\|\|null/);
  assert.match(html, /_rhStampOn=false; _rhStampDone=false; _rhStampPick=null;/);
  assert.match(html, /<script src="js\/kcareer-hwpstamp\.js\?v=\d+"><\/script>/);
});
