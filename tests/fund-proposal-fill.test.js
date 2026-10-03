'use strict';
/* 기금 제안서 PR1 — 채우기 창의 제안서 칸 (설계 2026-09-29 §5)
   ⓐ 제안서 자리가 있으면 칸이 보이고, 값은 proposalValues 에서 온다 — 고친 값(edits)이 이긴다
   ⓑ 연락처 한 칸만 브라우저에 기억한다(try/catch) — 다른 값은 저장하지 않는다
   ⓒ 문서관리가 로그인한 사람(PuWhoami)을 host.me 로 넘긴다 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const CF = fs.readFileSync(path.join(R, 'js/pu-contract-forms.js'), 'utf8').replace(/\r\n/g, '\n');
const HTML = fs.readFileSync(path.join(R, 'docs-esign.html'), 'utf8').replace(/\r\n/g, '\n');

test('ⓐ values() 가 제안서 값을 섞고, 사람이 고친 값이 마지막에 이긴다', () => {
  const f = cutFn(stripJs(CF), 'function openFill(');
  const v = cutFn(f, 'function values(');
  const iP = v.indexOf('CF.proposalValues('), iE = v.indexOf('st.edits');
  assert.ok(iP > 0, 'values() 가 proposalValues 를 부르지 않습니다');
  assert.ok(iE > iP, '고친 값(edits)이 제안서 값보다 먼저 들어가 덮입니다');
});
test('ⓐ 제안서 칸은 제안서 자리가 있을 때만 — PROPOSAL_KEYS 로 판정', () => {
  const f = cutFn(stripJs(CF), 'function openFill(');
  assert.match(f, /CF\.PROPOSAL_KEYS/, '제안서 자리 판정이 PROPOSAL_KEYS 가 아닙니다');
  assert.match(f, /propBox/, '제안서 칸이 없습니다');
  assert.match(f, /기관·지자체/, '받는 곳 종류(기업/기관·지자체) 고르기가 없습니다');
  assert.match(f, /부가세 포함/, '부가세 포함/별도 고르기가 없습니다');
  assert.match(f, /비용 산출/, '산출표 금액 안내가 없습니다');
});
test('ⓑ 연락처만 기억 — localStorage 는 pcf-staff-tel 한 열쇠, try 안에서만', () => {
  const f = cutFn(stripJs(CF), 'function openFill(');
  const keys = (f.match(/localStorage\.(?:get|set)Item\('([^']+)'/g) || []).map(s => s.replace(/.*\('/, '').replace(/'$/, ''));
  assert.ok(keys.length >= 2, '연락처를 읽고 쓰지 않습니다');
  assert.ok(keys.every(k => k === 'pcf-staff-tel'), '연락처 말고 다른 값을 브라우저에 남깁니다: ' + keys.join(','));
  (f.match(/[^\n]*localStorage\.[^\n]*/g) || []).forEach(line => assert.match(line, /try\s*\{/, '보관 접근이 try 밖에 있습니다: ' + line.trim()));
});
test('ⓒ 문서관리 — host.me 로 로그인한 사람을 넘긴다', () => {
  assert.match(HTML, /me:\s*function\s*\(\)\s*\{\s*return window\.PuWhoami && PuWhoami\.get\(\);?\s*\}/, 'host.me 가 없습니다');
});
