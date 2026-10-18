/* 인사관리(hr = pu-erp.html?app=hr) 폰 점검 — 자료는 이알피와 같은 것을 쓴다(seeds/erp.js, 모두 지어낸 것). */
'use strict';
const erp = require('./erp.js');
module.exports = {
  data: erp.data,
  views: [
    erp.메뉴('hr/attend'),
    erp.메뉴('hr/leave'),
    erp.메뉴('hr/pay', 3500),
    erp.메뉴('hr/perf'),
    erp.메뉴('hr/severance'),
    erp.메뉴('hr/cert'),
    erp.메뉴('env/settings', 3000),
  ],
};
/* 첫 화면(근로자명부)은 자료가 들어오기 전에 그려져 빈 채로 남는다 — 한 바퀴 돌고 다시 연다 */
module.exports.views.push(Object.assign(erp.메뉴('hr/staff'), { name: 'hr-staff' }));
