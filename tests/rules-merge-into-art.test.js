/* ↙ 기존 조에 넣기 — 신설을 «새 조» 대신 기존 조의 «다음 항»으로 (대표 결정 2026-10-05 「이대로 만든다」)
   대표 물음 2026-09-13 「조문의 추가인 경우 제2항 또는 단서 추가등이 되어야 하지 않나」 → 목업 「네째 단추 하나」.
   글귀는 표준 취업규칙·근로기준법의 일반 문구만 — 업체를 알아볼 수 있는 것은 없다.

   ■ 지키는 규칙
     ① 항 번호는 저절로 — 그 조의 마지막 항 다음 번호 · 항이 하나뿐인 조는 그 글이 ①항이 된다
     ② 넣을 글이 여러 항이면 이어 매긴다 · 머리(제N조(…))는 뗀다 · 「제N항」 인용은 알려 준다
     ③ 근거·변경이유가 그 조로 따라간다 — 그 조는 「개정」, 신설은 대조표·번호에서 빠진다
     ④ 되돌릴 수 있다 — 그대로면 바로, 고쳤으면 되묻는다(force) · undefined 를 안 남긴다
     ⑤ 넣을 조는 지금 잣대가 잡은 자리(insertAfter → rec)를 미리 고른다
   실행: node --test tests/rules-merge-into-art.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8').replace(/\r\n/g, '\n');
function cut(decl) {
  const at = RAW.indexOf(decl);
  assert.ok(at > 0, decl + ' 을 못 찾았습니다');
  let i = RAW.indexOf('{', at + decl.length), d = 0;
  for (; i < RAW.length; i++) {
    if (RAW[i] === '{') d++;
    else if (RAW[i] === '}') { d--; if (!d) return RAW.slice(at, i + 1); }
  }
  throw new Error(decl + ' 의 끝을 못 찾았습니다');
}
const line = (re) => { const m = RAW.match(re); assert.ok(m, re + ' 을 못 찾았습니다'); return m[0]; };
function 판() {
  const ctx = {};
  vm.createContext(ctx);
  [line(/const BR_OPEN=[^\n]*/), line(/const BR_CLOSE=[^\n]*/), line(/const RE_HEAD_STRIP=new RegExp\([^\n]*/),
    line(/const CIRC="[^"]*";/), line(/const bareLabel=[^\n]*/), line(/const mergeTargets=[^\n]*/),
    line(/const MERGE_KEEP=\[[^\]]*\];/), line(/const inDaejo=[^\n]*/),
    cut('function paraJoin('), cut('function mergeDefault('), cut('function mergeInsert('), cut('function unmergeInsert('),
    cut('function itemKind('), cut('function liveAnchor('), cut('function computeOrdered('), cut('function numberedView(')
  ].forEach((src) => vm.runInContext(src, ctx));
  vm.runInContext('this.inDaejo=inDaejo;this.mergeTargets=mergeTargets;', ctx);
  return ctx;
}
const 조61 = () => ({ id: 'art_제61조', num: 61, sub: null, title: '휴일, 휴가의 중복', label: '제61조 (휴일, 휴가의 중복)',
  orig: '제61조(휴일, 휴가의 중복) ① 휴일과 휴가가 중복되는 경우에는 휴일을 우선한다.',
  after: '제61조(휴일, 휴가의 중복) ① 휴일과 휴가가 중복되는 경우에는 휴일을 우선한다.', del: false, insertAfter: null });
const 조62 = () => ({ id: 'art_제62조', num: 62, sub: null, title: '경조휴가', label: '제62조 (경조휴가)',
  orig: '제62조(경조휴가) 회사는 사원의 경조사에 휴가를 준다.', after: '제62조(경조휴가) 회사는 사원의 경조사에 휴가를 준다.',
  del: false, insertAfter: null });
const 신설 = (after) => ({ id: 'ins_T', title: '유급휴일', label: '', num: null, sub: null, insertAfter: 'art_제61조', rec: 'art_제61조',
  before: '신설', after: after, orig: '', reason: '근로기준법 §55②', suggested: true, del: false });
const 유급 = '① 회사는 사원에게 다음 각 호의 휴일을 유급으로 부여한다.\n1. 주휴일\n2. 노동절(5월 1일)';

test('① 마지막 항 다음 번호 — ① 이 있으면 ②', () => {
  const c = 판();
  const j = c.paraJoin(조61().after, 유급);
  assert.equal(j.ok, true, j.why);
  assert.equal(j.firstNo, '②');
  assert.equal(j.text, '제61조(휴일, 휴가의 중복) ① 휴일과 휴가가 중복되는 경우에는 휴일을 우선한다.\n'
    + '② 회사는 사원에게 다음 각 호의 휴일을 유급으로 부여한다.\n1. 주휴일\n2. 노동절(5월 1일)');
  assert.equal(j.madeFirst, false);
});

test('① 항이 하나뿐인 조는 그 글이 ①항이 된다', () => {
  const c = 판();
  const j = c.paraJoin(조62().after, '회사는 사원의 배우자 출산 시 휴가를 준다.');
  assert.equal(j.ok, true);
  assert.equal(j.madeFirst, true);
  assert.equal(j.text, '제62조(경조휴가) ① 회사는 사원의 경조사에 휴가를 준다.\n② 회사는 사원의 배우자 출산 시 휴가를 준다.');
});

test('② 여러 항은 이어 매긴다 · 머리는 뗀다 · 「제N항」 인용을 알린다 · 본문 속 「제①항」은 안 센다', () => {
  const c = 판();
  const j = c.paraJoin('제10조(목적) ① 가. ② 나. ③ 다.', '제99조(새 조) ① 라. ② 마는 제1항에 따른다.');
  assert.equal(j.firstNo, '④');
  assert.equal(j.text, '제10조(목적) ① 가. ② 나. ③ 다.\n④ 라.\n⑤ 마는 제1항에 따른다.', '★ 머리를 안 뗐거나 번호가 이어지지 않는다');
  assert.equal(j.refWarn, true, '★ 「제1항」 인용이 그대로인데 알리지 않는다');
  const k = c.paraJoin('제5조(적용) 이 규칙은 제①항 외에는 모두 적용한다.', '나.');
  assert.equal(k.firstNo, '②', '본문 속 「제①항」 인용을 항으로 셌다');
  assert.equal(c.paraJoin(조61().after, '  ').ok, false, '빈 문안을 넣었다');
});

test('조 끝의 장 머리·부칙 줄은 새 항 아래에 남는다', () => {
  const c = 판();
  const j = c.paraJoin('제20조(휴게) ① 휴게시간을 준다.\n제5장 휴일', '쉬는 곳을 둔다.');
  assert.equal(j.text, '제20조(휴게) ① 휴게시간을 준다.\n② 쉬는 곳을 둔다.\n제5장 휴일', '★ 새 항이 장 머리 «뒤»에 붙었다');
});

test('③ 넣으면 — 그 조는 개정·근거가 따라가고, 신설은 대조표·번호에서 빠진다', () => {
  const c = 판();
  const items = [조61(), 조62(), 신설(유급)];
  const r = c.mergeInsert(items, 'ins_T', 'art_제61조');
  assert.equal(r.ok, true, r.why);
  const [a61, , ins] = items;
  assert.equal(c.itemKind(a61), '개정');
  assert.match(a61.reason, /근로기준법 §55② 반영 — ②항 신설/, '★ 근거가 그 조로 안 따라갔다');
  assert.equal(c.inDaejo(ins), false, '★ 신설이 대조표에 «또» 나간다 — 새 조와 항이 둘 다 남는다');
  assert.equal(ins.decision, '반영');
  const no = c.numberedView(items, 'partial').find((v) => v.it === ins).no;
  assert.equal(no, '—', '★ 넣은 신설이 가지번호를 먹는다');
  assert.equal(c.mergeInsert(items, 'ins_T', 'art_제61조').ok, false, '두 번 넣었다');
});

test('④ 되돌리기 — 그대로면 바로, 고쳤으면 되묻는다 · undefined 를 안 남긴다', () => {
  const c = 판();
  const items = [조61(), 조62(), 신설(유급)];
  c.mergeInsert(items, 'ins_T', 'art_제61조');
  const p = items[2].merged.prev;
  Object.keys(p).forEach((k) => assert.notEqual(p[k], undefined, k + ' 가 undefined — 파이어베이스가 저장을 물리친다'));
  assert.equal(c.unmergeInsert(items, 'ins_T').ok, true);
  assert.equal(items[0].after, 조61().after, '그 조가 넣기 전 글로 안 돌아갔다');
  assert.equal('reason' in items[0], false, '없던 변경이유가 남았다');
  assert.equal(items[2].del, false);
  assert.equal(items[2].merged, undefined);
  assert.equal(items[2].decision, undefined);
  c.mergeInsert(items, 'ins_T', 'art_제61조');
  items[0].after += ' (손으로 고침)';
  const u = c.unmergeInsert(items, 'ins_T', false);
  assert.equal(u.ok, false); assert.equal(u.edited, true, '★ 고친 뒤인데 묻지 않고 지운다');
  assert.equal(c.unmergeInsert(items, 'ins_T', true).ok, true);
  assert.equal(items[0].after, 조61().after);
});

test('넣지 않는 곳 — 삭제한 조 · 신설 조 · 빈 문안', () => {
  const c = 판();
  const d = Object.assign(조61(), { del: true });
  assert.equal(c.mergeInsert([d, 신설(유급)], 'ins_T', 'art_제61조').ok, false, '삭제한 조에 넣었다');
  assert.equal(c.mergeInsert([조61(), 신설('')], 'ins_T', 'art_제61조').ok, false, '빈 문안을 넣었다');
  assert.equal(c.mergeTargets([조61(), d, 신설(유급)]).length, 1);
});

test('⑤ 미리 고르는 조 — insertAfter, 없으면 rec', () => {
  const c = 판();
  const cands = [조61(), 조62()];
  assert.equal(c.mergeDefault({ insertAfter: 'art_제62조', rec: 'art_제61조' }, cands), 'art_제62조');
  assert.equal(c.mergeDefault({ insertAfter: '__end__', rec: 'art_제61조' }, cands), 'art_제61조');
});

test('화면 — 넷째 단추·카드 안 펼침·다른 결정 전 되돌리기·편집표 되돌리기', () => {
  const qd = cut('function quickDec(');
  assert.match(qd, /data-qm="open"[^>]*>↙ 기존 조에 넣기</, '넷째 단추가 없다');
  assert.match(qd, /it\.merged/, '넣은 뒤의 모습이 없다');
  assert.match(RAW, /\$\{mergePanel\(f,i\)\}/, '카드 안에 펼쳐지지 않는다(새 창)');
  assert.match(RAW, /closest\("\[data-qd\],\[data-go\],\[data-pos\],\[data-qm\],\.fi-merge"\)/, '펼친 줄을 누르면 상세 창이 뜬다');
  assert.match(cut('function applyDecision('), /if\(it\.merged&&!fromHistory\)\{ if\(!doUnmerge\(it\)\)return; \}/,
    '★ 넣은 신설에 「신설 반영」을 누르면 새 조와 항이 둘 다 남는다');
  assert.match(RAW, /data-act="unmerge"/, '편집표에서 되돌릴 길이 없다');
  assert.match(cut('function doMerge('), /pushUndo\(/, '↶ 되돌리기에 안 잡힌다');
});
