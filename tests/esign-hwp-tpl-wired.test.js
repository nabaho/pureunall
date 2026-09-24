'use strict';
// 문서관리(docs-esign) — 근로자별로 채우기가 실제로 화면에 붙어 있는지 (js/esign-hwp-tpl.js 는 순수 검사만이라
// wire-both-ends 규칙대로 «화면 쪽도» 확인한다).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'docs-esign.html'), 'utf8');

test('esign-hwp-tpl.js 모듈을 pu-hwp-engine 뒤·docs-esign 안에서 읽는다', () => {
  const engine = html.indexOf('js/pu-hwp-engine.js');
  const tpl = html.indexOf('js/esign-hwp-tpl.js');
  assert.ok(engine > 0);
  assert.ok(tpl > engine);
});

test('사건 한글 원본 창에 근로자별로 채우기 칸이 붙어 있다', () => {
  assert.match(html, /id="caseHwpTplBox"/);
  assert.match(html, /function refreshCaseHwpTpl/);
  assert.match(html, /EsignHwpTpl\.markersOf\(doc\)/);
  assert.match(html, /EsignHwpTpl\.valuesOf\(/);
  assert.match(html, /EsignHwpTpl\.fillDoc\(doc, ?V\)/);
});

test('한글 원본을 새로 등록·삭제해도 근로자별로 채우기 칸이 다시 그려진다', () => {
  const fn = html.slice(html.indexOf('async function refreshCaseHwp('), html.indexOf('async function refreshCaseHwpTpl('));
  assert.match(fn, /refreshCaseHwpTpl\(record\)/);
});

test('표지가 없는(빈) 서식은 칸을 보여주지 않는다 — 기존 [열기]만 쓴다', () => {
  const fn = html.slice(html.indexOf('async function refreshCaseHwpTpl('), html.indexOf('function renderCaseHwpFillBox('));
  assert.match(fn, /if\s*\(!total\)\s*\{\s*box\.innerHTML\s*=\s*'';\s*return;\s*\}/);
});

test('사람을 하나도 안 고르면 채우지 않고 알린다', () => {
  const one = html.slice(html.indexOf('async function tplPreviewFirst('), html.indexOf('async function tplDownloadZip('));
  const zip = html.slice(html.indexOf('async function tplDownloadZip('), html.indexOf('// 서류 4종 생성'));
  [one, zip].forEach((fn) => assert.match(fn, /if\s*\(!people\.length\)/));
});

test('★ 값을 채운 뒤 옛 줄 정보를 걷는다(_esignRelayout) — 한 사람 미리보기·zip 두 길 모두', () => {
  const one = html.slice(html.indexOf('async function tplPreviewFirst('), html.indexOf('async function tplDownloadZip('));
  const zip = html.slice(html.indexOf('async function tplDownloadZip('), html.indexOf('// 서류 4종 생성'));
  assert.match(one, /_esignFillOne/);
  assert.match(zip, /_esignFillOne/);
  const fillOne = html.slice(html.indexOf('async function _esignFillOne('), html.indexOf('function _esignSafeName('));
  assert.match(fillOne, /_esignRelayout\(doc\)/);
});

test('한글 원본·틀 파일은 이 PC 브라우저 보관소(PureunHwpStore)에서만 읽는다 — 서버로 올리지 않는다', () => {
  const zone = html.slice(html.indexOf('// ── 근로자별로 채우기'), html.indexOf('// 서류 4종 생성'));
  assert.doesNotMatch(zone, /db\.ref\([^)]*hwp/i, '틀 파일을 RTDB 로 보내면 안 된다');
  assert.match(zone, /PureunHwpStore\.get\('esign-case', curCaseId\)/);
});
