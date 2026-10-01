'use strict';
/* 계약 저장 때 업체 연결을 «그 자리에서» 묻는다 (대표 지시 2026-10-01
   「직원이 체크를 어떻게 해야 하는지 판단이 안 되어 계속 되돌아가는 것 같다」)

   ■ 무엇이 되돌려 보냈나
     계약 «창»의 저장 길이 업체 검증을 먼저 해서, 「연결 보류로 저장」을 묻는 자리(목록 쪽 save)에
     한 번도 닿지 않았다 — 토스트 한 줄 + 기업정보 탭으로 튕김.
   ■ 이 검사가 지키는 것
     ① 창의 저장 길이 검증 «전»에 묻는다(erpAskCompanyLink)
     ② 이름만 다르고 업체는 사람이 고른 것 → 「고른 업체 이름으로 맞추기」면 그대로 통과
     ③ ★★ 사업자번호가 어긋나면 «연결 보류»로 덮지 않는다 — 고쳐야 할 것을 알려 주고 막는다
     ④ 업체를 못 고른 때는 지금까지의 물음(연결 보류로 저장) 그대로
   실제 js/pu-ontology.js 와 pu-erp.html 의 함수를 잘라 돌린다. 이름·번호는 가짜. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const onto = fs.readFileSync(path.join(R, 'js', 'pu-ontology.js'), 'utf8');

function box(companies, answer) {
  const asked = [];
  const ctx = {
    console, JSON, Object, Array, String, Number, Date, Math, RegExp, parseInt,
    dbGet: (k, d) => (k === 'companies' ? companies : d),
    popConfirm: async (msg, opt) => { asked.push({ msg: String(msg), ok: opt && opt.okText }); return answer; },
    showToast: (m) => asked.push({ toast: String(m) }),
    _asked: asked
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(onto, ctx);
  ['function erpDropDeadCoLink(', 'function erpDeferCoLinkIfNew(', 'async function erpAskDeferCompanyLink(',
   'async function erpAskCompanyLink('].forEach((h) => vm.runInContext(cutFn(src, h), ctx));
  return ctx;
}
const COS = [{ id: 'co-1', name: '주식회사 가나관리단', bizNo: '123-45-67891' }];

test('① ★★ 계약 창의 저장 길이 검증 «전»에 묻는다 — 안 그러면 토스트와 함께 앞 탭으로 튕긴다', () => {
  /* ⚠ cutFn 으로는 못 자른다 — 그 저장 함수는 길고 글자 속 괄호가 많아 중간에서 끊긴다.
     그래서 «자리»로 본다: 창의 업체 검증 바로 앞, 같은 저장 함수 안에 묻기가 있어야 한다. */
  const body = stripJs(src);
  const val = body.indexOf('saveData = erpValidateContractCompany(saveData)');
  assert.ok(val > 0, '창의 저장 길을 못 찾았습니다');
  const fnStart = body.lastIndexOf('async function save(){', val);
  const ask = body.lastIndexOf('saveData = await erpAskCompanyLink(saveData)', val);
  assert.ok(fnStart > 0, '창의 저장 함수를 못 찾았습니다');
  assert.ok(ask > fnStart && ask < val, '★★ 묻기가 없거나 검증 «뒤»에 있습니다 — 직원은 또 튕깁니다');
});

test('② 이름만 다름 → 「고른 업체 이름으로 맞추기」 하면 검증을 지난다', async () => {
  const c = box(COS, true);
  const form = { companyId: 'co-1', company: { companyId: 'co-1', name: '가나호텔', bizNo: '' }, companyName: '가나호텔' };
  assert.equal(c.PuOntology.validateCompanyLink(form, COS).code, 'company_name_mismatch');
  const out = await c.erpAskCompanyLink(form);
  assert.equal(out.company.name, '주식회사 가나관리단');
  assert.equal(out.companyName, '주식회사 가나관리단');
  assert.equal(out.companyId, 'co-1', '업체 ID 는 사람이 고른 그대로');
  assert.equal(c.PuOntology.validateCompanyLink(out, COS).ok, true);
  assert.match(c._asked[0].msg, /가나호텔[\s\S]*주식회사 가나관리단/);
});

test('② 「업체 다시 고르기」면 아무것도 안 바꾼다', async () => {
  const c = box(COS, false);
  const form = { companyId: 'co-1', company: { companyId: 'co-1', name: '가나호텔' }, companyName: '가나호텔' };
  const out = await c.erpAskCompanyLink(form);
  assert.equal(out.company.name, '가나호텔');
});

test('③ ★★ 사업자번호가 어긋나면 «연결 보류»로 덮지 않고, 할 일을 알려 준다', async () => {
  const c = box(COS, true);   // 무엇을 눌러도
  const form = { companyId: 'co-1', company: { companyId: 'co-1', name: '주식회사 가나관리단', bizNo: '123-45-67890' }, companyName: '주식회사 가나관리단' };
  assert.equal(c.PuOntology.validateCompanyLink(form, COS).code, 'company_business_mismatch');
  const out = await c.erpAskCompanyLink(form);
  assert.notEqual(out.companyLinkStatus, 'pending', '★★ 잘못 고른 업체를 보류로 덮었습니다');
  assert.equal(out.companyId, 'co-1');
  assert.equal(c.PuOntology.validateCompanyLink(out, COS).ok, false, '검증은 여전히 막는다');
  assert.ok(c._asked.length === 1 && /사업자번호/.test(c._asked[0].msg), '무엇이 어긋났는지 알려야 합니다');
  assert.ok(!/연결 보류로 저장/.test(c._asked[0].ok || ''), '★★ 보류로 저장하라는 단추가 있으면 안 됩니다');
});

/* 2026-10-01 대표 지시 「특이사항이 있을 경우 다시 선택하게 하고, 유사 특이사항이 없을 경우 저장될 수 있게」 */
test('④ ★★ 비슷한 업체가 «하나도 없는» 새 회사 → 묻지 않고 「연결 보류」로 저장된다', async () => {
  const c = box(COS, false);   // 물으면 «고르기»로 답하게 해 둬도
  const out = await c.erpAskCompanyLink({ company: { name: '다라상사' }, companyName: '다라상사' });
  assert.equal(out.companyLinkStatus, 'pending');
  assert.equal(out.companyId, '');
  assert.equal(c.PuOntology.validateCompanyLink(out, COS).ok, true, '그대로 저장된다 — 기업정보로 안 튕긴다');
  assert.equal(c._asked.filter((x) => x.msg).length, 0, '★★ 헷갈릴 것이 없는데 물었습니다');
});

test('④ ★★ 비슷한 업체(같은 이름)가 있으면 그때만 묻는다 — Esc·닫기는 «업체 고르기»', async () => {
  const cos = [{ id: 'co-7', name: '마바상사', bizNo: '' }];
  const ask = box(cos, false);
  const kept = await ask.erpAskCompanyLink({ company: { name: '마바상사' }, companyName: '마바상사' });
  assert.notEqual(kept.companyLinkStatus, 'pending', '닫으면 보류로 넘기지 않는다');
  assert.equal(kept.companyId || '', '', '★★ 이름이 같다고 업체를 채우지 않는다');
  assert.match(ask._asked[0].msg, /마바상사/, '비슷한 업체를 보여 준다');
  const yes = box(cos, true);
  const out = await yes.erpAskCompanyLink({ company: { name: '마바상사' }, companyName: '마바상사' });
  assert.equal(out.companyLinkStatus, 'pending', '「다른 회사 — 새 업체로 저장」이면 보류로 저장');
});

test('④ 사업자번호 10자리가 업체관리에 «딱 하나»면 저절로 잇는다(온톨로지 자동 연결 규칙)', async () => {
  const c = box(COS, false);
  const out = await c.erpAskCompanyLink({ company: { name: '주식회사 가나관리단', bizNo: '1234567891' }, companyName: '주식회사 가나관리단' });
  assert.equal(out.companyId, 'co-1');
  assert.equal(c.PuOntology.validateCompanyLink(out, COS).ok, true);
  assert.equal(c._asked.filter((x) => x.msg).length, 0);
});

test('멀쩡하면 묻지 않는다', async () => {
  const c = box(COS, true);
  const form = { companyId: 'co-1', company: { companyId: 'co-1', name: '주식회사 가나관리단', bizNo: '123-45-67891' } };
  const out = await c.erpAskCompanyLink(form);
  assert.equal(c._asked.length, 0);
  assert.equal(out, form);
});
