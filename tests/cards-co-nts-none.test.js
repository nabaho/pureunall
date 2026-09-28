'use strict';
/* 🏛 국세청 훑기 — 「국세청에 없는 번호」도 목록에 뜬다 (대표 지시 2026-09-28 「국세청 훑기」)

   ■ 무엇이 없었나
     훑기는 국세청 답을 그대로 받아 적는다. 없는 번호면 b_stt 가 비고 tax_type 에
     「국세청에 등록되지 않은 사업자등록번호입니다.」가 온다 — 그것도 ntsState 로 적힌다.
     그런데 결과 창·띠·거르개는 «폐업·휴업만» 보여서, 받아 적고도 **어디에도 안 떴다.**
     이 훑기를 돌리는 까닭이 바로 그 번호(가짜·오타)를 찾는 것이었다(앞서 찾은 가짜 번호 건).
   ■ 지키는 것 (전부 실제로 돌린다)
     ① 없는 번호는 «없는 번호»(none)로 가른다 — 폐업(gone)과 다른 갈래, 모르는 답(dim)과도 다르다
     ② 결과 목록·거르개·띠에 함께 뜬다, 급한 순(폐업 → 없는 번호 → 휴업)
     ③ 창은 번호를 보여 주고, 무엇을 하면 되는지(원본과 맞춰 보기) 말한다 — 막 등록한 곳일 수도 있다고 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const 오늘 = '2026-09-28';
const 없는말 = '국세청에 등록되지 않은 사업자등록번호입니다.';
const CO = (name, bizno, st) => ({ key: name, name, bizno, extra: st ? { ntsState: st, ntsAt: 오늘 } : {} });

function load(list) {
  const ctx = {
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => '&#' + c.charCodeAt(0) + ';'),
    digits: (s) => String(s || '').replace(/\D/g, ''),
    todayYmd: () => 오늘, coList: () => list || [], _closeBtn: () => '', _coNtsRun: null
  };
  vm.createContext(ctx);
  vm.runInContext([
    SRC.match(/^const NTS_SKIP_DAYS = [^\n]*$/m)[0].replace('const ', 'var '),
    'var _coNtsRun = null, _coNtsMatchRun = null;',
    /* 2026-09-28: 창 안에 🧾 등록증 대조 칸이 붙었다 — «진짜»를 싣는다 */
    ...['function coNtsCeo(', 'function coNtsDay(', 'function coNtsName(', 'function coNtsNameVariants(',
      'function coNtsMatchOf(', 'function coNtsMatchReq(', 'function coNtsMatchState(',
      'function coNtsMatchTargets(', 'function coNtsMatchPartHtml('].map((d) => cutFn(SRC, d)),
    ...['function coVal(', 'function coSmeDays(', 'function coNtsWord(', 'function coNtsCls(',
      'function coNtsTargets(', 'function coNtsBadList(', 'function coNtsBadCount(', 'function coNtsNeeds(',
      'function coNtsBarHtml(', 'function coNtsHtml(', 'function coNtsChipHtml('].map((d) => cutFn(SRC, d))
  ].join('\n'), ctx);
  return ctx;
}
const LIST = [CO('휴업곳', '2208612345', '휴업자'), CO('없는곳', '1234567891', 없는말),
  CO('폐업곳', '1238620021', '폐업자'), CO('계속곳', '1238120012', '계속사업자'), CO('안물어봄', '4118612345')];

test('① 없는 번호는 «없는 번호»로 가른다 — 폐업도, 모르는 답도 아니다', () => {
  const c = load();
  assert.equal(c.coNtsCls(없는말), 'none', '★★ 흐리게 두면 훑기가 받아 적고도 어느 목록에도 안 뜹니다');
  assert.equal(c.coNtsCls(c.coNtsWord({ b_stt: '', tax_type: 없는말 })), 'none', '국세청 답 그대로(b_stt 비고 tax_type)');
  assert.equal(c.coNtsCls('폐업자'), 'gone');
  assert.equal(c.coNtsCls('무슨 말인지 모를 답'), 'dim', '★ 모르는 답까지 나쁜 빛으로 칠하면 안 됩니다');
});

test('② 결과 목록에 함께 뜬다 — 급한 순(폐업 → 없는 번호 → 휴업), 계속·안 물어본 곳은 빠진다', () => {
  const c = load(LIST);
  assert.deepEqual(Array.from(c.coNtsBadList()).map((x) => x.name), ['폐업곳', '없는곳', '휴업곳']);
  assert.equal(c.coNtsBadCount(), 3);
});

test('② 거르개도 같은 잣대 — 없는 번호를 거른다', () => {
  const c = load();
  assert.equal(c.coNtsNeeds(CO('없는곳', '1234567891', 없는말)), true, '★★ 거르개에서 빠지면 「띠는 3곳인데 목록은 2곳」이 됩니다');
  assert.equal(c.coNtsNeeds(CO('계속곳', '1238120012', '계속사업자')), false);
});

test('② 띠가 없는 번호를 따로 센다', () => {
  const c = load(LIST);
  const bar = c.coNtsBarHtml();
  assert.match(bar, /폐업 <b>1곳<\/b>/);
  assert.match(bar, /없는 번호 <b>1곳<\/b>/, '★★ 띠에 안 뜨면 훑고 나서도 모릅니다');
  assert.match(bar, /휴업 <b>1곳<\/b>/);
  assert.equal(load([CO('없는곳', '1234567891', 없는말)]).coNtsBarHtml().length > 0, true, '없는 번호만 있어도 띠가 뜬다');
});

test('③ 창이 번호를 보여 주고 무엇을 할지 말한다 · 국세청 원문 대신 짧은 말', () => {
  const c = load(LIST);
  const h = c.coNtsHtml();
  assert.match(h, /국세청에 없는 번호 1곳/, '★★ 몇 곳인지 말해야 합니다');
  assert.match(h, /원본과 번호를 맞춰/, '★ 무엇을 하면 되는지 말해야 합니다');
  assert.match(h, /막 등록한 사업자/, '★ 새 사업자일 수도 있다고 말하지 않으면 멀쩡한 곳을 가짜로 봅니다');
  assert.match(h, /없는곳 <span class="se">1234567891<\/span>/, '★★ 번호가 보여야 틀린 번호를 찾아 고칩니다');
  assert.match(h, /<span class="sd none">국세청에 없는 번호<\/span>/);
  assert.ok(!/폐업곳 <span class="se">/.test(h), '폐업 줄에는 번호를 안 붙인다(번호는 맞다)');
  const empty = load([CO('계속곳', '1238120012', '계속사업자')]).coNtsHtml();
  assert.match(empty, /국세청에 없는 번호로 나온 곳이 없습니다/);
});

test('③ 회사 딱지도 짧은 말로 — 국세청 원문은 딱지에 넣기엔 길다', () => {
  const c = load();
  const chip = c.coNtsChipHtml(CO('없는곳', '1234567891', 없는말));
  assert.match(chip, /🏛 국세청에 없는 번호 · 2026-09-28 확인/);
  assert.ok(!/등록되지 않은 사업자등록번호입니다/.test(chip));
  assert.match(chip, /color:#991b1b/, '빨간 딱지');
});

test('거르개·끝 알림 이름표도 「없는 번호」를 말한다', () => {
  assert.match(SRC, /k: 'coOnlyNtsBad',\s+icon: '🏛', label: '폐업·휴업·없는 번호'/);
  assert.match(SRC, /coOnlyNtsBad:'🏛 폐업·휴업·없는 번호'/);
  assert.match(cutFn(SRC, 'async function coNtsSweepRun('), /챙길 곳 \$\{나쁜곳\.toLocaleString\(\)\}곳\(폐업·휴업·없는 번호\)/);
});
