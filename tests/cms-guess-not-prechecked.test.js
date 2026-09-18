'use strict';
/* CMS 일괄이체 — «금액만 맞춘 조합»을 미리 체크해 두지 않는다
   ─────────────────────────────────────────────────────────────────────────
   ■ 건의 그대로 (김보람 노무사 2026-09-15, 대표 전달 2026-09-17)
     「더빌이체3572 라는 적요명으로 입금되는 cms 이체내역에 대하여, 자동매칭기능이
      엉뚱한 업체를 금액만 맞춰 입금처리하는 오류가 있습니다. 3/19 더빌이체3572 로
      입금된 110,000원은 가나메디의원 입금건이나, 나루천막산업의 자문료로
      자동 매치되어 있습니다.」

   ■ 뿌리
     자문료 합계가 입금액과 딱 맞는 조합은 «여러 가지»다 — 110,000원짜리 업체만 수십 곳이라
     220,000원 입금 하나에 수십 가지가 나온다. 매칭 창은 그중 «맨 앞 하나»를 미리 체크해 두고
     「✓ 금액 일치」라고 적었다. 사람이 의심할 거리가 없어 그대로 확정된다.

   ■ 못 박는 것
     ① erpFindFeeSubset 은 «몇 가지나 되는지»(ties)를 함께 돌려준다
     ② 명세(나이스빌)가 있으면 그대로 체크한다 — 이것은 답이다
     ③ 명세가 없으면 «아무것도 체크하지 않는다»
     ④ 추측은 보여 주되, 사람이 단추를 눌러야 체크된다
     ⑤ 근거가 금액뿐이면 확인창이 한 번 더 말한다
     ⑥ 기록(note)에 «무엇을 보고 골랐는지»가 남는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const ERP = stripJs(RAW);
const MODAL = (function () {
  const at = ERP.indexOf('function CmsMatchModal(props){');
  assert.ok(at > 0, 'CmsMatchModal 을 찾지 못했습니다');
  return ERP.slice(at, at + 30000);
})();

/* ══ ① 조합이 몇 가지인지 함께 돌려준다 ══ */
function loadSubset() {
  const box = { console, Math, String, Number, Object, Array, parseInt, JSON };
  box.window = box;
  vm.createContext(box);
  /* ⚠ _erpFeeFits 를 함께 실어야 한다 — 없으면 walk 가 늘 던져 null 이 나오고,
     그러면 이 검사는 «아무것도 안 지키면서» 통과한다. */
  vm.runInContext(cutFn(ERP, 'function _erpFeeFits(') + '\n'
    + cutFn(ERP, 'function erpFindFeeSubset(') + '\n;this.f = erpFindFeeSubset;', box);
  return box.f;
}
const co = (name, fee, payDay) => ({ name: name, fee: fee, payDay: payDay || '' });

test('①★ 같은 금액이 되는 조합이 여럿이면 «몇 가지인지»를 함께 돌려준다', () => {
  const f = loadSubset();
  /* 110,000원짜리 넷 — 220,000원이 되는 조합은 여섯 가지다 (실제 자료의 모양) */
  const r = f(220000, [co('가나상사', 110000), co('홍길동정비', 110000),
                       co('임꺽정식당', 110000), co('가나물류', 110000)], 19);
  assert.ok(r, '조합을 못 찾았습니다 — 검사 밑그림이 틀렸습니다');
  assert.equal(r.diff, 0, '금액은 딱 맞는 조합이어야 합니다');
  assert.ok(r.ties >= 6, '★★ 여섯 가지인데 ' + r.ties + '가지라고 합니다 — '
    + '«몇 가지인지»를 안 세면 화면이 추측을 답처럼 보여 줍니다');
  assert.equal(typeof r.capped, 'boolean', '세기를 멈췄는지(capped)를 알려야 «그 이상»을 말할 수 있습니다');
});

test('① 조합이 하나뿐이면 하나라고 말한다 — 부풀리지 않는다', () => {
  const f = loadSubset();
  const r = f(330000, [co('가나상사', 330000), co('홍길동정비', 11000)], 19);
  assert.ok(r && r.diff === 0);
  assert.equal(r.ties, 1, '하나뿐인데 여럿이라 하면 쓸 만한 추천까지 의심받습니다');
});

/* ══ ②③④ 매칭 창의 첫 체크 ══ */
test('②★ 나이스빌 명세가 있으면 그대로 체크한다 — 이것은 답이다', () => {
  const eff = MODAL.slice(MODAL.indexOf('useEffect(function(){'), MODAL.indexOf('function applyGuess('));
  assert.match(eff, /if\(nbApplyPick\(\)\)\{ setBasis\('nb'\); return; \}/,
    '★ 명세가 있는데도 안 쓰면, 정답을 두고 추측을 합니다');
});

test('③★★ 명세가 없으면 «아무것도 체크하지 않는다» — 이것이 건의의 핵심이다', () => {
  const eff = MODAL.slice(MODAL.indexOf('useEffect(function(){'), MODAL.indexOf('function applyGuess('));
  assert.match(eff, /var r = erpFindFeeSubset\(amount, cands, refDay\);[\s\S]{0,80}setChk\(\{\}\);/,
    '★★ 금액만 맞춘 조합을 미리 체크하면 사람은 그것을 «답»으로 읽습니다 — '
    + '3/19 110,000원이 가나메디의원 것인데 나루천막산업으로 찍힌 것이 그렇게 생겼습니다');
  assert.ok(!/r\.cands\.forEach\(function\(c\)\{ m\[c\.name\] = 1; \}\);[\s\S]{0,40}setChk\(m\)/.test(eff),
    '★★ 추천 조합을 그대로 체크해 버리는 옛 코드가 남아 있습니다');
  /* 조용히 빠뜨리지도 않는다 — 왜 안 골랐는지 말해야 사람이 다음 걸음을 안다 */
  assert.match(eff, /고르지 않았습니다/, '★ 왜 비어 있는지 말하지 않으면 고장으로 봅니다');
});

test('④★ 추측은 보여 주되, 사람이 눌러야 체크된다', () => {
  assert.match(MODAL, /function applyGuess\(\)\{/, '★ 사람이 누를 길이 없으면 쓸모가 줄기만 합니다');
  assert.match(MODAL, /setChk\(m\); setBasis\('guess'\);/, '★ 누른 사실이 근거로 남아야 합니다');
  assert.match(MODAL, /guess && !sel\.length && h\('div'/, '★ 추측을 보여 주는 자리가 없습니다');
  /* ⚠ 「같은 금액이 되는 조합이」라는 «말»로 찾지 않는다 — 바로 위 주석에도 같은 말이 있어,
     화면에서 지워도 주석이 검사를 통과시킨다(2026-09-17 이빨 확인에서 실제로 그랬다).
     화면에 그 «수»가 실제로 쓰이는지를 본다. */
  assert.match(MODAL, /guess\.ties\s*\+\s*'가지/,
    '★★ «몇 가지인지»를 화면에 적지 않으면 추측이 답처럼 보입니다');
  assert.match(MODAL, /onClick:applyGuess/, '★ 단추가 applyGuess 에 이어져 있지 않습니다');
});

/* ══ ⑤ 확인창 ══ */
test('⑤★ 근거가 «금액뿐»이면 확인창이 한 번 더 말한다', () => {
  const ap = MODAL.slice(MODAL.indexOf('async function apply(){'), MODAL.indexOf('var offNames'));
  assert.match(ap, /basis === 'guess'/, '★ 확인창이 근거를 보지 않습니다');
  assert.match(ap, /근거는 «금액뿐»입니다/, '★ 「금액 일치」만 보고 확정하는 것을 막지 못합니다');
});

/* ══ ⑥ 기록에 근거가 남는다 ══ */
test('⑥★ 기록에 «무엇을 보고 골랐는지»가 남는다 — 안 남으면 나중에 되짚을 수 없다', () => {
  const ap = MODAL.slice(MODAL.indexOf('async function apply(){'), MODAL.indexOf('var cmsSet = 0;'));
  assert.match(ap, /_basisTxt/, '★ 근거를 적지 않습니다');
  ['나이스빌 명세', '금액만 맞춤\\(확인 필요\\)', '사람이 고름'].forEach(function (w) {
    assert.match(ap, new RegExp(w), '★ 근거 갈래 「' + w + '」 가 없습니다');
  });
  assert.ok(!/var _note = 'CMS 일괄이체 자동매칭'/.test(ap),
    '★ 명세로 찍은 것과 금액만 맞춰 찍은 것이 둘 다 「자동매칭」이면 감사를 할 수 없습니다');
});

test('⑥ 사람이 한 곳이라도 고치면 그 묶음은 «명세 그대로»가 아니다', () => {
  const tg = MODAL.slice(MODAL.indexOf('function toggle(name){'), MODAL.indexOf('function toggle(name){') + 900);
  assert.match(tg, /setBasis\(basis === 'nb' \? 'nb-hand' : 'hand'\)/,
    '★ 사람이 고친 것을 명세라고 적으면 기록이 거짓말을 합니다');
});
