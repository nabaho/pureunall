'use strict';
/* 집단체불 위임장 — 받는 서류 안내 · 사건계약 양식 함께 채워 내기 (대표 「추천」 2026-10-09) — 가짜 자료만
   ⓐ 안내 — 사건이 없어도 순서·기본 서류 3종(👁)·사건계약 양식 목록, 대표 선정 서식이 없으면 올리는 길
   ⓑ 양식 고르기 — 사건계약 · 켜 둔 것 · 한글 원본(엑셀 제외) · 근로자 칸이면 사람마다, 아니면 사건에 한 벌 · 이름표 잇기
   ⓒ 내보내기 — 고른 양식을 사건(secret/forms, 직원만)에 남기고, 채운 값은 저장하지 않는다 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const T = require('../js/esign-hwp-tpl.js');
const H = fs.readFileSync(path.join(__dirname, '..', 'docs-esign.html'), 'utf8').replace(/\r\n/g, '\n');
const cut = (s) => { const a = H.indexOf(s); assert.ok(a >= 0, s); return H.slice(a, H.indexOf('\n}\n', a)); };

test('ⓑ 양식 고르기 · 채우는 모양 · 이름표', () => {
  const src = (f) => f.att || [];
  const l = JSON.parse(JSON.stringify(T.caseForms([
    { id: 'a', kind: 'case', name: '진정서·진정인 연명부', att: [{ name: 'a.xlsx', data: 'x' }, { name: 'a.hwpx', fileId: 'f1' }] },
    { id: 'b', kind: 'case', name: '꺼 둔 것', enabled: false, att: [{ name: 'b.hwp', fileId: 'f2' }] },
    { id: 'c', kind: 'company', name: '자문계약서', att: [{ name: 'c.hwp', fileId: 'f3' }] },
    { id: 'd', kind: 'case', name: '글만 있는 양식', att: [] },
    { id: 'e', kind: 'case', name: '엑셀만', att: [{ name: 'e.xlsx', data: 'x' }] }], src)));
  assert.deepStrictEqual(l.map((x) => [x.id, x.src.name]), [['a', 'a.hwpx']]);
  assert.equal(T.hasRepForms(l), true); assert.equal(T.hasRepForms([{ name: '위임장' }]), false);
  assert.equal(T.hasRepForms([{ name: '대지급금 대리인선임신고서' }]), true);
  assert.equal(T.fillMode(['대표근로자', '관할관서', '작성일', '회사명']), 'case', '대표·사건 칸만 — 사건에 한 벌');
  assert.equal(T.fillMode(['이름', '관할관서']), 'person');
  assert.equal(T.fillMode(['근로자명']), 'person', '계약서 양식 이름표도 근로자 칸');
  const V = T.withAliases(T.valuesOf({ name: '홍길동', idNo: '900101-1000000', addr: '천안시 가나로 1' }, { company: '가나상사' }, {}));
  assert.equal(V.근로자명, '홍길동'); assert.equal(V.근로자주소, '천안시 가나로 1'); assert.equal(V.회사명, '가나상사');
  assert.equal(V.주민번호, V.주민등록번호);
});

test('ⓐ 안내', () => {
  assert.match(H, /<div id="esignIntro" style="margin-top:14px"><\/div>/);
  assert.match(cut('function renderCaseList('), /renderEsignIntro\(\)/, '목록을 그릴 때마다');
  const r = cut('function renderEsignIntro(');
  assert.match(r, /'<details' \+ \(n \? '' : ' open'\)/, '사건이 없으면 펼쳐서');
  assert.match(r, /\['delegationAgreement', 'delegation', 'privacyConsent'\]/);
  assert.match(r, /EsignHwpTpl\.hasRepForms\(l\)/); assert.match(r, /📎 파일 올려 양식 만들기/);
  assert.doesNotMatch(r, /\.(set|update|push|remove)\(/, '안내는 읽기만');
  const p = cut('function esignFormPeek(');
  assert.match(p, /body\.textContent = /); assert.doesNotMatch(p, /innerHTML/, '양식 글은 글로만 넣는다');
});

test('ⓒ 내보내기', () => {
  const o = cut('function openExportPicker(');
  assert.match(o, /id="xForms"/);
  assert.match(o, /db\.ref\('esign\/cases\/' \+ curCaseId \+ '\/secret\/forms'\)\.set\(forms\.length \? pick : null\)/, '고른 양식(아이디만)을 사건에');
  assert.match(o, /forms: forms, cms: /);
  const x = H.slice(H.indexOf('async function runExport('), H.indexOf('async function _esignHwpMergedPdf('));
  assert.match(x, /EsignHwpTpl\.fillMode\(await formHwpMarkers\(u8, fm\.src\.name\)\)/);
  assert.match(x, /var who = mode === 'case' \? \[mf\._rep \|\| \{\}\] : pool;/);
  assert.match(x, /EsignHwpTpl\.withAliases\(EsignHwpTpl\.valuesOf\(/);
  assert.match(x, /zip\.file\('사건 서류\/' \+ f\.name \+ '\.hwp', f\.list\[0\]\)/);
  assert.match(x, /zip\.file\(dir \+ f\.name \+ '\.hwp', f\.list\[j\]\)/);
  assert.match(x, /_전원\(' \+ pool\.length \+ '명\)\.pdf', await _esignHwpMergedPdf\(formOut\[fj\]\.list\)/);
  assert.match(x, /못 채운 양식/);
  assert.doesNotMatch(x, /db\.ref\(/, '채운 서류는 서버로 보내지 않는다');
});
