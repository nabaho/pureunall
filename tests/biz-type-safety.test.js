'use strict';
/* 업무유형 사전 안전장치 (대표 2026-10-05 「유형을 고치면 진행 중인 업무가 바뀌지 않나 —
   아무 문제 없이 관리하려면」). 업무 기록은 유형을 고유번호로 잇는다 — 위험은 사전 쪽에 있었다.

   못 박는 것(규칙):
   ① 「복원」은 빠진 기본 유형만 더한다 — 지금 목록은 하나도 지우거나 바꾸지 않는다
   ② 지우기 전 쓰는 건수에 계약관리(contracts.typeCodes)도 센다 · 삭제표시 줄은 안 센다
   ③ 같은 약어·이름(띄어쓰기 무시)은 또 못 만든다 — 숨긴 것과도 견준다 · 자기 자신은 빼고 본다
   ④ 고칠 때마다 누가·언제·전→후를 남기고, 기록은 한도 안에서 오래된 것부터 버린다
   ⑤ 저장은 «지금 사전»을 다시 읽어 그 위에 얹는다 — 화면이 들고 있던 목록으로 덮지 않는다
   ⑥ 이름 글자로 알아보는 유형(현장클리닉·기술보호)의 이름이 빠지면 경고한다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
function strip(s) { return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1'); }
function body(s, head) {
  const i = s.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = s.indexOf('{', i); k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); }
  }
  throw new Error('괄호가 안 닫힘: ' + head);
}
const HEAD = src.slice(src.indexOf('var BIZ_TYPE_STORE ='), src.indexOf('// 카테고리별 색상 (캡쳐 색상 톤)'));

function ctx(store) {
  store = store || {};
  const written = [];
  const c = {
    Object, String, Array, Math, Date, JSON,
    dbGet: (k, d) => (k in store ? JSON.parse(JSON.stringify(store[k])) : d),
    dbSet: (k, v) => { written.push([k, v]); store[k] = v; return true; },
  };
  vm.createContext(c);
  vm.runInContext(HEAD, c);
  c.__written = written;
  return c;
}
const LIVE = [   /* 운영 사전 모양 — 씨앗과 번호가 다르다(실측 2026-10-05) */
  { code: 'consulting-mp0w1084', short: '현클', name: '현장클리닉', sortOrder: 10 },
  { code: 'consulting-mozfisq7', short: '일터', name: '일터상생혁신컨설팅', sortOrder: 20 },
];
const SEED = [
  { code: 'cons-clinic', short: '클릭', name: '현장클리닉', sortOrder: 10 },
  { code: 'cons-new', short: '새것', name: '새 기본 유형', sortOrder: 20 },
];

test('①★ 「복원」은 빠진 기본 유형만 고른다 — 이름이 같은 씨앗(번호만 다른 것)은 안 넣는다', () => {
  const c = ctx();
  const miss = c.bizTypeMissingSeeds(LIVE, SEED);
  assert.deepEqual(miss.map((m) => m.code), ['cons-new']);
});
test('①★ 화면의 「복원」은 씨앗으로 통째 덮지 않는다', () => {
  const card = strip(body(src, 'function BizTypeCard('));
  const rs = body(card, 'function reseed(');
  assert.doesNotMatch(rs, /persist\w*\(\s*cat\.seed/, '씨앗으로 통째 덮으면 모든 업무가 미설정이 된다');
  assert.match(rs, /bizTypeMissingSeeds\(/);
  assert.match(rs, /showConfirm\(/, '더하기 전에 무엇을 더하는지 보여 주고 묻는다');
});

test('②★ 쓰는 건수에 계약관리도 센다 · 삭제표시 줄은 안 센다', () => {
  const c = ctx({
    consultings: [{ typeCode: 'K' }, { typeCode: 'K', _deleted: true }],
    contracts: [{ kinds: ['consulting'], typeCodes: { consulting: 'K' } }, { kinds: ['consulting'], typeCode: 'K' },
      { kinds: ['case'], typeCode: 'K' }, { kinds: ['consulting'], typeCodes: { consulting: 'K' }, _deleted: true }],
  });
  const u = c.bizTypeUsage('consulting', 'K');
  assert.equal(u.by.consultings, 1);
  assert.equal(u.by.contracts, 2, '계약만 쓰는 유형이 «0건»으로 보여 지워지면 그 계약들이 미설정이 된다');
  assert.equal(u.n, 3);
});
test('② 지우기 화면은 그 셈을 쓰고, 지우기 직전에 한 번 더 센다', () => {
  const card = strip(body(src, 'function BizTypeCard('));
  assert.match(body(card, 'function countUsage('), /bizTypeUsage\(/);
  /* 2026-10-31: 「사용 0건」 지우기가 removeUnused 한 곳으로 모였다(완전 삭제·보관 칸의 🗑 도 같은 길) —
     «묻기 전» 한 번(del)과 «지우기 직전» 한 번(removeUnused)을 합쳐 두 번 센다. */
  const del = body(card, 'function del(');
  assert.ok((del.match(/countUsage\(/g) || []).length >= 1, '지우기 전에 쓰는 건수를 안 센다');
  const ru = body(card, 'function removeUnused(');
  assert.ok(/\.then\(function\(ok\)\{[\s\S]*countUsage\(/.test(ru), '누르는 사이 생긴 사용을 지우기 «직전»에 다시 세지 않는다');
  assert.equal((card.match(/cur\.filter\(function\(x\)\{ return x\.code !== code; \}\)/g) || []).length, 1,
    '유형을 지우는 줄이 removeUnused 말고 또 있다 — 직전 재확인을 건너뛰는 길이 생긴다');
});

test('③★ 같은 약어·같은 이름(띄어쓰기·점 무시)은 겹침으로 본다 — 숨긴 것과도', () => {
  const c = ctx();
  const list = LIVE.concat([{ code: 'h', short: '숨김', name: '숨긴 유형', hidden: true }]);
  assert.equal(c.bizTypeDupOf(list, '현클', '아무거나', null).code, 'consulting-mp0w1084');
  assert.equal(c.bizTypeDupOf(list, 'zz', '일터 상생·혁신 컨설팅', null).code, 'consulting-mozfisq7');
  assert.equal(c.bizTypeDupOf(list, '숨김', 'x', null).code, 'h');
  assert.equal(c.bizTypeDupOf(list, '새약', '새 이름', null), null);
});
test('③ 고칠 때는 자기 자신과는 견주지 않는다', () => {
  const c = ctx();
  assert.equal(c.bizTypeDupOf(LIVE, '현클', '현장클리닉', 'consulting-mp0w1084'), null);
});
test('③★ 자기가 «흡수한» 합쳐진 유형의 이름은 되찾을 수 있다 — 남의 유형 이름은 여전히 막는다 (일터 이름 바로잡기 2026-10-31)', () => {
  const c = ctx();
  /* 일터상생(mozfisq7)이 옛 「일터혁신상생컨설팅」(숨김·mergedInto)을 흡수했다 — 공식 이름 순서로 되돌리는 고침 */
  const list = LIVE.concat([{ code: 'old', short: '일터혁신', name: '일터혁신상생컨설팅', hidden: true, mergedInto: 'consulting-mozfisq7' }]);
  assert.equal(c.bizTypeDupOf(list, '일터', '일터혁신상생컨설팅', 'consulting-mozfisq7'), null,
    '★ 합쳐 남은 유형이 흡수한 옛 유형의 이름을 못 쓰면 이름을 바로잡을 길이 없다');
  assert.equal(c.bizTypeDupOf(list, '일터혁신', 'x', 'consulting-mozfisq7'), null, '옛 약어도 마찬가지');
  /* 그러나 — 다른 유형이 그 이름을 쓰려 하면 막는다(합쳐진 유형은 «흡수한 쪽»에게만 열린다) */
  assert.equal(c.bizTypeDupOf(list, '현클', '일터혁신상생컨설팅', 'consulting-mp0w1084').code, 'old', '★ 남의 유형이 합쳐진 이름을 가져갔다');
  /* 새로 만들 때(exceptCode 없음)도 막는다 */
  assert.equal(c.bizTypeDupOf(list, 'zz', '일터혁신상생컨설팅', null).code, 'old');
  /* 합쳐지지 않고 «그냥 숨긴» 유형은 흡수한 쪽이 없으므로 누구에게도 안 열린다 */
  const hid = LIVE.concat([{ code: 'h', short: '숨김', name: '숨긴 유형', hidden: true }]);
  assert.equal(c.bizTypeDupOf(hid, 'zz', '숨긴 유형', 'consulting-mozfisq7').code, 'h');
});
test('③ 추가·수정 화면이 겹침 검사를 거친다', () => {
  const card = strip(body(src, 'function BizTypeCard('));
  assert.match(body(card, 'function add('), /bizTypeDupOf\(/);
  assert.match(body(card, 'async function editType('), /bizTypeDupOf\([^;]*,\s*x\.code\s*\)/);
});

test('④★ 고친 기록에 누가·언제·전→후가 남는다', () => {
  const c = ctx();
  const before = { code: 'a', short: '일터', name: '일터상생혁신컨설팅' };
  const after = c.bizTypeHist(Object.assign({}, before, { short: '일혁' }), '수정', before, '홍길동', '2026-10-05T00:00:00Z');
  const h = after.hist[after.hist.length - 1];
  assert.equal(h.by, '홍길동');
  assert.equal(h.act, '수정');
  assert.equal(h.from.short, '일터');
  assert.equal(h.to.short, '일혁');
  const item = { code: 'b', short: 's', name: 'n' };
  const out = c.bizTypeHist(item, '수정', item, 'x');
  assert.equal(item.hist, undefined, '원본은 안 바꾼다 — 화면·사본이 몰래 바뀐다');
  assert.notEqual(out, item);
});
test('④ 기록은 한도 안에서 오래된 것부터 버린다', () => {
  const c = ctx();
  let it = { code: 'a', short: 's', name: 'n' };
  for (let i = 0; i < 40; i++) it = c.bizTypeHist(it, '수정' + i, it, 'x');
  assert.ok(it.hist.length <= c.BIZ_TYPE_HIST_MAX && it.hist.length > 0);
  assert.equal(it.hist[it.hist.length - 1].act, '수정39');
});
test('④ 추가·수정·숨김·기본값 더하기가 모두 기록을 남긴다', () => {
  const card = strip(body(src, 'function BizTypeCard('));
  for (const fn of ['function add(', 'async function editType(', 'function setHidden(', 'function reseed(']) {
    assert.match(body(card, fn), /bizTypeHist\(/, fn + ' 가 기록을 안 남긴다');
  }
});

test('⑤★ 저장은 지금 사전을 다시 읽어 그 위에 얹는다 — 그 사이 남이 더한 것을 안 지운다', () => {
  const store = { biz_cons_types: LIVE.slice() };
  const c = ctx(store);
  const screen = LIVE.slice();                                     // 화면이 들고 있던 목록
  store.biz_cons_types = LIVE.concat([{ code: 'other', short: '남것', name: '남이 방금 더함', sortOrder: 30 }]);
  c.bizTypeApply('biz_cons_types', [], (cur) => cur.concat([{ code: 'mine', short: '내것', name: '내가 더함', sortOrder: 40 }]));
  const saved = c.__written[c.__written.length - 1][1].map((x) => x.code);
  assert.ok(saved.includes('other'), '남이 더한 것이 사라졌다');
  assert.ok(saved.includes('mine'));
  assert.equal(screen.length, 2);
});
test('⑤ 화면의 저장 길은 모두 그 길(persistWith)이다 — 화면 목록으로 통째 덮는 persist() 가 없다', () => {
  const card = strip(body(src, 'function BizTypeCard('));
  assert.doesNotMatch(card, /\bpersist\(/, '화면 목록 통째 저장이 남아 있다');
  assert.match(body(card, 'function persistWith('), /bizTypeApply\(/);
});

/* ⑥ 1단계의 «이름 변경 경고»는 2단계에서 «역할 칸»으로 바뀌었다 — tests/type-role-by-code.test.js 가 본다.
     여기서는 컨설팅 사전 저장이 «고치기 전» 역할을 굳히는지만 본다. */
test('⑥ 컨설팅 사전 저장은 고치기 전에 역할(role)을 굳힌다 — 이름을 바꿔도 셈이 그 유형을 찾는다', () => {
  const store = { biz_cons_types: [{ code: 'consulting-mp0w1084', short: '현클', name: '현장클리닉', sortOrder: 10 }] };
  const c = ctx(store);
  c.bizTypeStampRoles = (l) => l.map((x) => (x.role ? x : Object.assign({}, x, { role: x.name === '현장클리닉' ? 'clinic' : undefined })));
  c.bizTypeApply('biz_cons_types', [], (cur) => cur.map((x) => Object.assign({}, x, { name: '클리닉' })));
  const saved = c.__written[c.__written.length - 1][1][0];
  assert.equal(saved.name, '클리닉');
  assert.equal(saved.role, 'clinic', '이름을 바꾼 저장에서 역할이 사라지면 현장클리닉 일수표가 그 유형을 못 찾는다');
});
