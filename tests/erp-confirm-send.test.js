'use strict';
/* ✅ 계약 확정 → 서류 보내기 (대표 「2」 2026-10-09) — 가짜 자료만
   ⓐ 확정으로 가는 세 길(끌어 놓기·▶확정 = moveStatus, 새 등록, 수정 창)에서 묻는다 — 이미 확정이던 것은 안 묻는다
   ⓑ 혼자 보내지 않는다 — 계약서등관리 #forms:contract={id} 를 열 뿐(금액·이름 안 실음), 「묻지 않기」는 이 기기
   ⓒ 계약서등관리 묶음 메일 — 다 채워 첨부 여럿, 보관도 파일마다 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const E = read('pu-erp.html');
const cutFn = (src, start) => { const a = src.indexOf(start); assert.ok(a >= 0, start); return src.slice(a, src.indexOf('\n  }\n', a)); };

test('ⓐ 세 길에서 묻는다', () => {
  assert.match(cutFn(E, '  function moveStatus('), /if\(newStatus === 'signed' && ct\.id && erpConfirmAskOn\(\)\) setSendAsk\(/);
  const sv = cutFn(E, '  async function save(form){');
  assert.match(sv, /if\(newOne\.status === 'signed' && erpConfirmAskOn\(\)\) setSendAsk\(newOne\);/);
  assert.match(sv, /form\.status === 'signed' && \(!before \|\| before\.status !== 'signed'\)/, '이미 확정이던 것은 안 묻는다');
  assert.match(E, /sendAsk && h\(ErpConfirmSendAsk, \{ contract:sendAsk/);
});

test('ⓑ 열기만 한다', () => {
  const a = E.indexOf('function ErpConfirmSendAsk('), f = E.slice(a, E.indexOf('\n}\n', a));
  assert.match(f, /window\.open\('docs-esign\.html#forms:contract=' \+ encodeURIComponent\(c\.id\), '_blank'\)/);
  assert.doesNotMatch(f, /amount|ceo|bizNo|mail\.send|fetch\(/, '주소에 금액·이름을 싣거나 혼자 보내지 않는다');
  assert.match(E, /localStorage\.setItem\(ERP_CONFIRM_ASK_KEY, '1'\)/);
});

test('ⓒ 묶음 메일', () => {
  const cf = read('js/pu-contract-forms.js');
  const m = cf.slice(cf.indexOf('    function doMailAll()'), cf.indexOf('    function doMail()'));
  assert.match(m, /openSend\(\{ fm: items\[0\]\.fm, title: [\s\S]*?extra: rs\.slice\(1\)/);
  assert.match(cf, /\(!one && host\.mail\) \? el\('button', \{[^)]*'개 메일로 보내기 →'/);
  assert.match(cf, /var out = \[\{ name: o\.name, bytes: o\.bytes \}\]\.concat\(o\.extra \|\| \[\]\);/);
  assert.match(cf, /CF\.mailDefaults\(V, o\.title \|\| o\.fm\.name \|\| '서류'\)/);
});
