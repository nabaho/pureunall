'use strict';
/* 기업 상세 «이력 칸»을 vm 에 떠서 돌릴 때 함께 실어야 하는 것들.
   (검사용 공용 도구 — 검사 파일이 아니다)

   ■ 왜 있나
   2026-09-11 에 대표 결정으로 이력 칸이 «해마다 접히고»(coYearIsOpen) 맨 위 숫자 칸을
   다시 그리게(coHeadRepaint) 되었다. 그러자 coHistPaint 를 통째로 떠서 돌리던 검사
   여섯 벌이 한꺼번에 ReferenceError 로 죽었다 — 이 저장소가 2026-09-07·09-10 에
   이미 두 번 밟은 자리다.

   ★ 대역이 아니라 «진짜»를 싣는다. 대역을 넣으면 접기 잣대가 틀려도 검사가 모른다.
     coHeadRepaint 는 화면 칸이 없으면 스스로 조용히 돌아나가므로 그대로 실어도 된다.
   ⚠ 여기 한 곳만 고치면 여섯 벌이 함께 따라온다 — 검사마다 베껴 적지 않는다. */
const { cutFn } = require('./cut-fn');

function histDeps(app) {
  return [
    /* ⚠ top-level let 은 vm 컨텍스트의 프로퍼티가 안 된다 — var 로 바꿔 싣는다 */
    'var _coYearOpen = {}, _coRowDocsOpen = {}, _coHistSum = null, _coLeftDocsN = null;',
    cutFn(app, 'function coYearNewest('),
    cutFn(app, 'function coYearIsOpen('),
    cutFn(app, 'function coHeadRepaint(')
  ].join('\n');
}

/* 기업 상세 «패널»(coDetailPanelHtml)을 vm 에 떠서 돌릴 때 함께 실어야 하는 것들.

   2026-09-11 대표 결정(목업 4번)으로 패널이 「숫자 세 칸 + 접기 카드」로 바뀌면서
   부르는 함수가 여럿 늘었다. 같은 까닭으로 한 곳에 모은다.
   ⚠ coErpPinState·erpHistShortWon 은 «진짜»를 싣는다 — 대역을 넣으면 「확정됐나」를
     잘못 판단해도 검사가 모른다. ErpMatch 는 부르는 쪽이 대역으로 준다. */
function panelDeps(app) {
  return [
    'var _coCardOpen = { need:false, docs:false, ppl:false };',
    cutFn(app, 'function coErpPinOf('),
    cutFn(app, 'function coErpPinState('),
    cutFn(app, 'function erpHistShortWon('),
    cutFn(app, 'function coCardToggle('),
    cutFn(app, 'function coCardHtml('),
    /* 2026-09-12: 「확인 필요 몇 가지」를 카드와 숫자 칸이 «한 곳»에서 세게 모았다 —
       진짜를 싣는다(대역을 넣으면 두 숫자가 어긋나도 검사가 모른다). */
    cutFn(app, 'function coNeedCount('),
    /* 같은 곳인 두 줄을 «사람이 짚어» 합친 것 — 되돌리는 줄이 상세에 뜬다 */
    cutFn(app, 'function coMergedKeys('),
    cutFn(app, 'function coMergeRowHtml('),
    cutFn(app, 'function coNeedHtml('),
    cutFn(app, 'function coNeedClashToggle('),
    cutFn(app, 'function coPinRowToggle('),
    cutFn(app, 'function coNeedOpenDocs('),
    cutFn(app, 'function coTilesHtml('),
    cutFn(app, 'function coGoBox('),
    cutFn(app, 'function coNeedGo('),
    cutFn(app, 'function coDocsSummary('),
    /* 2026-09-12: 패널에 «사람이 적는» 두 칸이 붙었다(담당·메모, 대표 지시 ③④).
       ⚠ 대역이 아니라 «진짜»를 싣는다 — 담당이 업체관리 것인지 우리가 적은 것인지
         가르는 잣대라, 대역을 넣으면 그 가름이 틀려도 검사가 모른다.
       ⚠ 여기 한 곳만 고치면 패널을 뜨는 검사 넷이 함께 따라온다. */
    /* ⚠ coVal 도 «진짜»를 싣는다 — 담당·메모가 그것으로 값을 꺼낸다. 대역으로 두면
       「다듬은 뒤에 고른다」(2026-08-24 에 고친 규칙)가 틀려도 검사가 모른다. */
    cutFn(app, 'function coVal('),
    cutFn(app, 'function coMgrOf('),
    cutFn(app, 'function coMgrIsOurs('),
    cutFn(app, 'function coMemoHtml(')
  ].join('\n');
}

module.exports = { histDeps, panelDeps };
