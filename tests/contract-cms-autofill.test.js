'use strict';
/* 계약서에서 «CMS 자동이체»를 읽어 체크와 이체일을 채운다
   (대표 지시 2026-09-12 「사진첩에 cms 자동이체도 날짜와 체크항목 자동으로 되게 해라」)

   ■ 왜
     자문계약서는 대개 한 조항에 «자동이체인가»와 «며칠인가»를 함께 적는다 —
     「제2조(자문보수) … 매월 25일 자동이체(CMS)로 지급한다」.
     판독기는 그 줄을 pairs 에 그대로 담아 왔는데 계약창이 읽지 않아,
     사람이 체크와 날짜를 다시 손으로 넣고 있었다.

   ■ 규칙
     ⓐ 「CMS·자동이체·출금이체…」가 적혀 있을 «때만» 켠다.
     ⓑ 날짜는 이체를 가리키는 말(매월·당월·이체일·출금일…) 뒤의 «N일»만 본다.
     ⓒ 자동이체가 아니어도 지급일은 읽는다 — 그것이 곧 입금일이다.
   ⚠ **끄지 않는다.** 사람이 켜 둔 것을 판독이 되돌리면 안 된다.
   ⚠ 이미 넣어 둔 이체일은 «안 덮는다».
   ⚠ 「말일」은 숫자로 안 바꾼다 — 달마다 28·30·31 이다.
   ⚠ 계약일(2026년 8월 28일)의 28, 금액(25만원)의 25 를 이체일로 읽으면 안 된다. */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

const 상자 = (function () {
  const box = { window: {}, BRIEF_MAX: 40 };
  box.globalThis = box;
  vm.createContext(box);
  /* ⚠ 끝을 «이 자리에서부터» 찾는다 — 낱말 하나로 찾으면 파일 앞쪽의 다른 목록
     (CMS_MEMO_MARKERS)이 먼저 걸려 엉뚱한 데를 자른다. */
  const at = ERP.indexOf('var ERP_CMS_WORDS =');
  assert.ok(at > 0, 'CMS 낱말 목록을 못 찾았습니다');
  vm.runInContext(ERP.slice(at, ERP.indexOf('];', at) + 2), box);
  ['function erpDocText(', 'function erpCmsFromDoc(', 'function erpVatTextToFlag(',
   'function erpContractPhotoApplyPatch(']
    .forEach(function (d) { vm.runInContext(cutFn(ERP, d), box); });
  return box;
})();
const 읽기 = 상자.erpCmsFromDoc;

/* 조항 한 줄을 pairs 모양으로 */
const 조항 = (v) => ({ pairs: [{ k: '제 2 조 ( 자문보수 )', v: v }] });

test('① ★★ 「매월 25일 자동이체」 — 켜고 25일을 읽는다', function () {
  const r = 읽기(조항('갑은 을에게 자문료를 매월 25일 자동이체(CMS)로 지급한다.'));
  assert.equal(r.isCMS, true, '★★ 자동이체라 적혀 있는데 안 켭니다');
  assert.equal(r.payDay, 25, '★★ 이체일을 못 읽었습니다');
});

test('② ★★ 판독기가 «띄어 적어도» 읽는다 — 「자 동 이 체」는 흔한 모양이다', function () {
  const r = 읽기(조항('매월 25 일 자 동 이 체 로 지급한다'));
  assert.equal(r.isCMS, true, '★★ 띄어 적힌 자동이체를 못 알아봅니다');
  assert.equal(r.payDay, 25);
});

test('③ ★★ 자동이체라는 말이 «없으면» 켜지 않는다 — 엉뚱한 이체일 알림이 울린다', function () {
  const r = 읽기(조항('갑은 자문료를 당월 25일까지 지급한다.'));
  assert.equal(r.isCMS, false, '★★ 적혀 있지도 않은 자동이체를 켰습니다');
  assert.equal(r.payDay, 25, '★ 자동이체가 아니어도 지급일은 읽어야 합니다');
});

test('④ ★★ 계약일·금액의 숫자를 이체일로 읽지 «않는다»', function () {
  /* 운영 자료 그대로 — 아이행복어린이집 자문계약서(2026-08-28)의 실제 문구다 */
  const 실제 = {
    pairs: [
      { k: '제 2 조 ( 자문보수 )', v: '① 갑은 을에게 월 자문수수료로 매월 금 200,000원(부가세 포함)을 지불한다.' },
      { k: '2026년 8월 28일', v: '' },
      { k: '제 6 조 ( 계약기간 )', v: '본 계약의 계약기간은 2026년 09월 01일부터 2027년 08월 31일까지 1년으로 한다.' }
    ]
  };
  const r = 읽기(실제);
  assert.equal(r.isCMS, false, '★★ 자동이체 이야기가 없는 계약서를 켰습니다');
  assert.equal(r.payDay, null,
    '★★ 계약일·기간의 날짜를 이체일로 읽었습니다 (읽은 값 ' + r.payDay + ') — 엉뚱한 날에 알림이 울립니다');
});

test('⑤ ★ 「이체일 5일」·「출금일 10일」처럼 적힌 것도 읽는다', function () {
  assert.equal(읽기(조항('CMS 이체일 5일')).payDay, 5);
  assert.equal(읽기(조항('자동이체 출금일: 10일')).payDay, 10);
  assert.equal(읽기(조항('매월 1일 이체')).payDay, 1);
});

test('⑥ ★★ 1~31 밖의 숫자는 버린다', function () {
  assert.equal(읽기(조항('매월 35일 자동이체')).payDay, null, '★★ 있지도 않은 날을 넣었습니다');
  assert.equal(읽기(조항('매월 0일 자동이체')).payDay, null);
});

test('⑦ ★★ 「말일」은 숫자로 안 바꾼다 — 달마다 28·30·31 이다', function () {
  const r = 읽기(조항('자문료는 매월 말일 자동이체로 출금한다'));
  assert.equal(r.isCMS, true);
  assert.equal(r.payDay, null, '★★ 말일을 어떤 숫자로 굳혔습니다');
  assert.equal(r.lastDay, true, '★ 말일이라고 적혀 있다는 것을 안 알려 줍니다');
});

test('⑧ ★ 계약서에 아무 말도 없으면 아무것도 안 한다', function () {
  const r = 읽기({});
  assert.deepEqual({ isCMS: r.isCMS, payDay: r.payDay, lastDay: r.lastDay },
    { isCMS: false, payDay: null, lastDay: false });
});

/* ── 실제로 계약창에 담기는 값 ── */
const 담기 = 상자.erpContractPhotoApplyPatch;
const 빈창 = { amounts: {}, briefs: {}, company: {} };

test('⑨ ★★ 켜는 값이 실제로 계약창까지 간다 — 체크·이체일 둘 다', function () {
  const r = 담기(조항('매월 25일 CMS 자동이체로 지급한다'), '자문', 빈창);
  assert.equal(r.patch.isCMS, true, '★★ 체크가 안 켜집니다');
  assert.equal(r.patch.cmsPayDay, '25', '★★ 이체일이 안 들어갑니다');
  assert.equal(r.patch.taxInvoicePaymentDay, '25일',
    '★ 세금계산서 입금일 칸과 어긋납니다 — 화면이 둘을 함께 씁니다');
  assert.ok(r.previewLines.join('\n').indexOf('CMS') >= 0, '★ 무엇이 바뀌는지 안 보여 줍니다');
});

test('⑩ ★★ 사람이 켜 둔 것을 «끄지 않는다»', function () {
  const r = 담기(조항('갑은 자문료를 당월 25일까지 지급한다'), '자문',
    Object.assign({}, 빈창, { isCMS: true }));
  assert.notEqual(r.patch.isCMS, false, '★★ 사람이 켠 자동이체를 판독이 껐습니다');
});

test('⑪ ★★ 이미 넣어 둔 이체일을 «안 덮는다»', function () {
  const r = 담기(조항('매월 25일 자동이체'), '자문',
    Object.assign({}, 빈창, { isCMS: true, cmsPayDay: '5' }));
  assert.equal(r.patch.cmsPayDay, undefined, '★★ 사람이 넣은 이체일을 덮어썼습니다');
  assert.equal(r.patch.taxInvoicePaymentDay, undefined);
});

test('⑫ ★ 이미 켜져 있으면 켰다고 또 말하지 않는다', function () {
  const r = 담기(조항('매월 25일 자동이체'), '자문', Object.assign({}, 빈창, { isCMS: true }));
  assert.ok(r.previewLines.join('\n').indexOf('CMS 자동이체 켬') < 0,
    '★ 안 바뀌는 것을 「바뀐다」고 알립니다');
});
