'use strict';
/* 컨설팅 «사업 갈래» 함수 목록 (대표 지시 2026-11-28 「유사한 것들 체크를 다 하고 거기에 맞게 매칭을 해라」)
   erpGuessContractFromFields 처럼 갈래 함수를 부르는 함수를 «떠서 돌리는» 검사가 함께 떠 갈 선언 머리들이다.
   한 곳에 두어, 갈래 함수가 늘어도 검사마다 목록을 고치지 않게 한다(검사 도구 — 검사 파일이 아니다). */
const CONS_FAMILY_FNS = [
  'function erpConsFamilyList(', 'function erpConsFamilyOfType(', 'function erpConsFamiliesInText(',
  'function erpConsTypesOfFamily(', 'function erpConsTypeByCues(', 'function erpConsWorkTexts(',
  'function erpConsTypeGuessForRec(', 'function erpConsTypeCheck(', 'function erpContractConsTypeCheck(',
  'function erpConsTypeCheckMsg(', 'function erpConsTypeCheckShort(', 'function erpConsTypeAudit('
];
module.exports = { CONS_FAMILY_FNS };
