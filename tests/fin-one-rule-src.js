'use strict';
/* 재무 «판정 하나» 함수 묶음을 원본에서 뽑는다 (검사용 공용 도구 — 검사 파일이 아니다).

   ■ 왜 있나 (2026-10-11 fin.md 1·3·6)
   입금을 읽는 함수들이 이제 erpIncomeLive · erpAdvisoryPaidFor · erpIncomeLockYm 같은
   공용 판정을 부른다. 함수 하나만 vm 에 넣어 돌리던 검사는 그 판정이 없어 깨진다.
   검사마다 따로 이름을 늘어놓으면 판정이 하나 늘 때 또 다 깨지므로 여기 한 곳에 둔다.

   ■ 쓰는 법
     const { finRuleSrc } = require('./fin-one-rule-src');
     vm.runInContext(finRuleSrc(src) + '\n' + cutFn(src, 'function isPaid('), ctx);

   ⚠ 넣는 것은 «함수 선언» 뿐이다 — 바깥 상태(dbGet·isIncomeLocked)는 검사가 ctx 에 준다. */
const { cutFn } = require('./cut-fn');

const FIN_RULE_FNS = [
  'function incomeIsCo(',
  'function erpIncomeLive(',
  'function erpIncomeIsRevenue(',
  'function erpAdvisoryYmOf(',
  'function erpIsAdvisoryIncome(',
  'function erpAdvisoryIndex(',
  'function erpAdvisoryPaidFor(',
  'function erpIncomeLockYm(',
  'function erpCmsRowKey(',
  'function erpCmsKeyTaken(',
];

/* without: 이미 따로 넣는 함수(예: incomeIsCo)는 빼고 달라고 할 수 있다 */
function finRuleSrc(src, without) {
  const skip = new Set((without || []).map((n) => 'function ' + n + '('));
  return FIN_RULE_FNS.filter((d) => !skip.has(d)).map((d) => cutFn(src, d)).join('\n');
}

module.exports = { finRuleSrc, FIN_RULE_FNS };
