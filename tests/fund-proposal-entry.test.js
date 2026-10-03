'use strict';
/* 기업정보함 입구 — 회사 보기의 「📨 제안서 보내기」 (설계 2026-09-29 §8)
   ⓐ 기업정보함은 양식 목록을 읽지 않는다 — 문서관리를 «그 회사 열쇠»만 들고 새 탭으로 연다
   ⓑ 문서관리는 #forms:propose=열쇠 를 읽어 기금관리 › 제안서·견적서 를 열고, 제안서가 하나면 채우기 창을 바로 연다
   ⓒ 채우기 창은 그 열쇠로 회사를 골라 둔다 — 사람(명함·담당자) 줄이 아니라 «회사» 줄만 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const rd = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const CARDS = rd('pu-cards.html'), DOCS = rd('docs-esign.html'), CFJ = rd('js/pu-contract-forms.js');

test('ⓐ 기업정보함 — 보낸 서류 칸에 「📨 제안서 보내기」, 열쇠만 들고 새 탭', () => {
  const h = cutFn(stripJs(CARDS), 'function coSentHtml(');
  assert.match(h, /📨 제안서 보내기/);
  assert.match(h, /openProposeFor\(/);
  const f = cutFn(stripJs(CARDS), 'function openProposeFor(');
  assert.match(f, /docs-esign\.html#forms:propose=' \+ encodeURIComponent\(/);
  assert.match(f, /'_blank'/);
  assert.ok(!/contract_forms/.test(f), '기업정보함이 양식 목록을 읽습니다');
});
test('ⓐ 보낸 서류 안내 — 문서관리에서 보낸 것도 잡힌다', () => {
  const h = cutFn(stripJs(CARDS), 'function coSentHtml(');
  assert.match(h, /자료함·문서관리에서 보낸 것/);
});
test('ⓑ 문서관리 — propose 열쇠를 읽고, 그것을 양식 번호로 착각하지 않는다', () => {
  const p = cutFn(stripJs(DOCS), 'function proposeFromHash(');
  assert.match(p, /'#forms:propose='/);
  const f = cutFn(stripJs(DOCS), 'function formFromHash(');
  assert.match(f, /propose=/, '#forms:propose=… 를 양식 번호로 읽습니다');
  assert.match(DOCS, /propose: proposeFromHash\(\)/);
});
test('ⓑ 양식 화면 — 처음 한 번 기금관리 › 제안서·견적서 로, 하나면 채우기 창', () => {
  const m = cutFn(stripJs(CFJ), 'function mount(');
  const p = cutFn(m, 'function openPropose(');
  assert.match(p, /PROPOSAL_GROUP/);
  assert.match(p, /kind: 'fund'/);
  assert.match(p, /list\.length === 1/);
  assert.match(p, /openFill\(\[list\[0\]\], host\)/);
  assert.match(m, /if \(host\.propose && !S\.proposed\)/);
});
test('ⓒ 채우기 창 — host.propose 열쇠로 «회사» 줄만 골라 둔다', () => {
  const f = cutFn(stripJs(CFJ), 'function openFill(');
  assert.match(f, /host\.propose/);
  assert.match(f, /var preKey = host\.propose \|\|/);
  assert.match(f, /CF\.sentKeys\(x, \{\}\)\.indexOf\(preKey\)/);
  assert.match(f, /x\.k === 'biz' \|\| x\.k === 'erp' \|\| x\.k === 'card-co'/);
});
