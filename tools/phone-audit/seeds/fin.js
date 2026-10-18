/* 재무관리(fin = pu-erp.html?app=fin) 폰 점검 — 자료는 이알피와 같은 것을 쓴다(seeds/erp.js, 모두 지어낸 것). */
'use strict';
const erp = require('./erp.js');
module.exports = {
  data: erp.data,
  views: [
    erp.메뉴('fin/income', 3000),
    erp.메뉴('fin/expense', 3000),
    erp.메뉴('fin/pnl'),
    erp.메뉴('fin/invoice'),
    erp.메뉴('fin/recv'),
    erp.메뉴('fin/vat'),
    erp.메뉴('fin/auto'),
    erp.메뉴('fin/close'),
  ],
};
