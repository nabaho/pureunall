'use strict';
/* 👥 집단체불 세트 — 서류는 하나(체당금 접수 세트), 받는 길은 둘 (대표 「추천대로 cms 포함」 2026-10-09) — 가짜 자료만
   ⓐ 문구 고정 — 새 사건 때 체당금 양식 문구를 meta.forms 에, 이름표를 위임장 이름표로 · 예전 사건은 기본 문구
   ⓑ 효성CMS — 폰으로 받지 않고 사람마다 채워 낸다(계좌·서명 칸은 비움, 위임장 서명을 옮겨 붙이지 않는다)
   ⓒ 길 — 세트 칸의 👥 집단체불 세트 · 체당금 접수 세트 막대의 「👥 여러 명에게 링크로 받기」→ 새 사건 창 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const D = require('../js/esign-docs.js');
global.window = global.window || {};
require('../js/pu-contract-forms.js');
const C = global.window.PuContractForms;
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const H = R('docs-esign.html'), SG = R('sign.html'), CF = R('js/pu-contract-forms.js');

test('ⓐ 문구 고정', () => {
  const f = D.formsFrom(C.CHEDANG);
  assert.deepStrictEqual(Object.keys(f), ['delegationAgreement', 'delegation', 'privacyConsent', 'cms']);
  assert.equal(f.delegationAgreement.body, D.ESIGN_FORMS.delegationAgreement.body, '지금 시드는 기본 문구와 같다(이름표만 다르다)');
  assert.equal(D.normVars('{{근로자명}} {{주민번호}} {{근로자주소}} {{계약일}}'), '{{이름}} {{주민등록번호}} {{주소}} {{작성일}}');
  const edited = C.CHEDANG.map((x) => (x.id === 'fm-case-cd-02' ? Object.assign({}, x, { body: '고친 위임장 {{근로자명}}' }) : x));
  const m = { forms: D.formsFrom(edited) };
  assert.equal(D.formOf(m, 'delegation').body, '고친 위임장 {{이름}}', '고친 문구가 사건에');
  assert.equal(D.formOf({}, 'delegation'), D.ESIGN_FORMS.delegation, '예전 사건은 기본 문구');
  assert.equal(D.formOf({}, 'cms'), null);
  assert.deepStrictEqual(Object.keys(D.formsFrom(C.CHEDANG.map((x) => Object.assign({}, x, { enabled: false })))), [], '꺼 둔 양식은 고정하지 않는다');
  const nc = H.slice(H.indexOf("$('ncOk').onclick"), H.indexOf("bg.remove();", H.indexOf("$('ncOk').onclick")));
  assert.match(nc, /fixed = EsignDocs\.formsFrom\(await PuContractForms\.loadForms\(db\)\)/);
  assert.match(nc, /if \(Object\.keys\(fixed\)\.length\) meta\.forms = fixed;/);
  assert.match(SG, /\$\('privacyFull'\)\.textContent = EsignDocs\.formOf\(m, 'privacyConsent'\)\.body;/, '폰도 고정한 문구(글로만)');
  assert.match(SG, /\$\('delegFull'\)\.textContent = EsignDocs\.formOf\(m, 'delegationAgreement'\)\.body;/);
  const ds = R('js/esign-docs.js');
  assert.match(ds, /fillVars\(esc\(formOf\(caseMeta, 'delegation'\)\.body\), v\)/, '사건 문구는 글로 넣는다(esc)');
});

test('ⓑ 효성CMS', () => {
  const ds = R('js/esign-docs.js');
  const b = ds.slice(ds.indexOf('function buildCmsHtml('), ds.indexOf('\n  }\n', ds.indexOf('function buildCmsHtml(')));
  assert.doesNotMatch(b, /sigBlock|sigPng/, '위임장에 한 서명을 옮겨 붙이지 않는다');
  assert.match(H, /id="xCms" checked/);
  const x = H.slice(H.indexOf('async function runExport('), H.indexOf('async function _esignHwpMergedPdf('));
  assert.match(x, /cmsF = EsignDocs\.formOf\(m, 'cms'\);/);
  assert.match(x, /zip\.file\(dir \+ '효성CMS자동이체신청서\.pdf'/);
  assert.match(x, /'효성CMS자동이체신청서_전원\('/);
  assert.doesNotMatch(x, /db\.ref\(/, '채운 서류는 서버로 보내지 않는다');
});

test('ⓒ 길', () => {
  assert.match(CF, /var CHEDANG_SET_ID = 'fs-chedang';/);
  assert.match(CF, /st\.id === CHEDANG_SET_ID && host\.openEsign\) b\.appendChild\(el\('button', \{[^)]*text: '👥 여러 명에게 링크로 받기', onclick: function \(\) \{ host\.openEsign\(\{ newCase: true \}\); \}/);
  assert.match(H, /if \(o && o\.newCase\) setTimeout\(function \(\) \{ var b = \$\('btnNewCase'\); if \(b && b\.onclick\) b\.onclick\(\); \}, 0\);/);
  assert.match(H, /👥 집단체불 세트 = 계약서 양식의 <b>체당금 접수 세트<\/b>/);
});
