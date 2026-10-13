'use strict';
/* 계약번호 ↔ 이알피 계약 연결 (대표 「계약번호는 이알피와 연결되는가 — 온톨로지로 서로 연결」 2026-10-13) — 가짜 자료만
   ⓐ 보낸 기록 한 줄에 «계약 ID»가 함께 남는다 — 온톨로지는 번호가 아니라 ID(sourceContractId)로 잇는다. 계약이 없으면 모양이 그대로
   ⓑ 채우기 창: 계약을 고르면 ID·번호를 들고 있고, 번호 칸은 잠긴다(손으로 고친 값이 연결을 깨지 않게)
   ⓒ 받기·메일·팩스 기록 세 길이 모두 계약 ID 를 넘긴다, 서버 쓰기 길(formMailRecord)도 그대로 sentRecord 에 넘긴다 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');

const ROOT = path.join(__dirname, '..');
const CF = require('../js/pu-form-cardfill.js');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const SRC = read('js/pu-contract-forms.js');
const DOCS = read('docs-esign.html');

test('ⓐ 보낸 기록 — 계약 ID·번호가 함께, 계약이 없으면 예전 모양 그대로', () => {
  const base = { at: 5, by: 'p001@pureun.kr', kind: '계약서', names: ['a.hwp'], who: '(받기)' };
  assert.deepStrictEqual(CF.sentRecord(base), { at: 5, by: 'p001@pureun.kr', kind: '계약서', names: ['a.hwp'], card: '', who: '(받기)' });
  assert.deepStrictEqual(CF.sentRecord(Object.assign({}, base, { contract: null })), CF.sentRecord(base));
  assert.deepStrictEqual(CF.sentRecord(Object.assign({}, base, { contract: { id: '', no: 'C-1' } })), CF.sentRecord(base), 'ID 없이 번호만으론 잇지 않는다');
  const r = CF.sentRecord(Object.assign({}, base, { contract: { id: ' ct-001 ', no: 'C-2026-0001' } }));
  assert.strictEqual(r.sourceContractId, 'ct-001');
  assert.strictEqual(r.sourceContractNo, 'C-2026-0001');
  const r2 = CF.sentRecord(Object.assign({}, base, { contract: { id: 'ct-002' } }));
  assert.strictEqual(r2.sourceContractId, 'ct-002');
  assert.ok(!('sourceContractNo' in r2), '번호가 없으면 칸을 만들지 않는다(null 금지)');
});

test('ⓑ 채우기 창 — 계약 ID·번호를 들고, 번호 칸을 잠근다', () => {
  assert.match(SRC, /st\.ct = \{ id: info\.id \|\| c\.id, no: info\.contractNo \|\| c\.contractNo \|\| '', vals: info\.vals,/);
  assert.match(SRC, /host\.contractCtx = \{ id: info\.id \|\| host\.contract, no: info\.contractNo \|\| '', vals: info\.vals,/);
  assert.match(SRC, /function ctxRef\(\) \{ var x = ctxOf\(\); return x && x\.id \? \{ id: x\.id, no: x\.no \|\| '' \} : null; \}/);
  assert.match(SRC, /function noLocked\(\)/);
  assert.match(SRC, /if \(k === '계약번호' && noLocked\(\)\) return; V\[k\] = st\.edits\[k\];/, '손으로 적은 번호가 계약 번호를 덮지 않는다');
  assert.match(SRC, /lockNo\) \{ inp\.readOnly = true;/);
  assert.match(SRC, /delete st\.edits\['계약번호'\];/, '계약을 고르면 앞서 손으로 적은 번호는 버린다');
});

test('ⓒ 받기·메일·팩스 기록이 모두 계약 ID 를 넘긴다', () => {
  assert.match(SRC, /how: '받기', await: true, contract: ctxRef\(\) \}/);
  assert.match(SRC, /openSend\(\{ fm: items\[0\]\.fm, title: title \|\| '서류 묶음', V: V, row: st\.co \|\| \{\}, contract: ctxRef\(\)/);
  assert.match(SRC, /openSend\(\{ fm: it\.fm, V: values\(\), row: st\.co \|\| \{\}, contract: ctxRef\(\)/);
  assert.match(SRC, /await: !ag, contract: o\.contract \}/);
  assert.match(SRC, /who: '\(팩스\)', await: true, contract: o\.contract \}/);
  assert.match(DOCS, /who: o\.how === '받기' \? '\(받기\)' : o\.who, contract: o\.contract \}\)/, '서버에 쓰는 길도 sentRecord 에 계약을 넘긴다');
  /* 이알피를 읽기만 한다 — 새로 쓰는 길이 생기지 않았다 */
  assert.ok(!/data\/contracts['"]\)\.(set|update|push|remove)/.test(DOCS));
});
