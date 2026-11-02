'use strict';
/* 🏷 법인 꼬리표만 다른 «같은 이름» 은 새 회사 줄을 만들지 않는다 (대표 지시 2026-11-01)
   ═══════════════════════════════════════════════════════════════════════════
   「기업 상세에 이미 있던 사업장 정보를 중복해서 가지고 오면 안 된다」
   실측(2026-11-01): 기업 상세 4,600줄 중 «법인 꼬리표만 다른 같은 이름» 29묶음·60줄.
   예) 「(사)가나다…」 ↔ 「사단법인 가나다…」, 「…(유)」 ↔ 「…유한회사」.
   원인: _norm 이 (주)·주식회사만 지워 다른 이름으로 보았고, 메일 서명·리멤버 명함이 올 때마다 새 줄이 생겼다.

   ★ 여기서 못 박는 것
     ① 꼬리표만 다르면 «번호 있는 그 회사»에 붙는다
     ② 지점·노조처럼 뜻이 있는 말이 붙으면 «붙지 않는다»(다른 곳이다)
     ③ 같은 이름에 번호가 다른 등록증이 둘이면 «안 붙인다»(어느 쪽인지 모른다)
     ④ 열쇠(coKeyOf)와 원본은 그대로다 — 어느 줄에 붙이는가만 바뀐다
     ⑤ 이미 되던 것((주)·띄어쓰기)은 그대로 된다
   실행: node --test tests/cards-co-strong-name.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');

function fnBody(name) {
  const i = src.indexOf('\nfunction ' + name + '(');
  assert.ok(i >= 0, name + ' 를 찾을 수 없습니다');
  const open = src.indexOf('{', i);
  let d = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  assert.fail(name + ' 의 끝을 찾을 수 없습니다');
}
const line = (re) => { const m = src.match(re); assert.ok(m, String(re) + ' 를 찾을 수 없습니다'); return m[0]; };

/* 진짜 _norm·coKeyOf·digits 를 그대로 뜬다 — 대역을 쓰면 «진짜가 어떻게 이름을 보는가»를 못 잰다 */
function build(items, coInfo) {
  const ctx = { console, Object, String, Number, Array, _coWatch: null, _coListMemo: null, _coInfo: coInfo || {},
    allItems: () => items,
    ErpMatch: { ready: true, match: () => null, matchAll: () => ({}) },
    taxInvoiceFromText: () => '', coEffectiveExtra: () => null,
    fmtBizno: (v) => v || '' };
  vm.createContext(ctx);
  vm.runInContext([
    "var digits = v => String(v||'').replace(/\\D/g,'');",
    line(/^const _norm = .*$/m).replace(/^const /, 'var '),
    line(/^const coKeyOf = .*$/m).replace(/^const /, 'var '),
    fnBody('coDisplayName'), fnBody('coListBuild')
  ].join('\n'), ctx);
  return ctx.coListBuild();
}

const BIZ = (id, company, bizno) => ({ id, kind: 'biz', company, bizno });
const CARD = (id, company) => ({ id, kind: 'card', company, name: '가명' + id });
const rowOf = (rows, key) => rows.find((r) => r.key === key);

test('★ 「(사)」 명함이 「사단법인」 등록증 회사에 붙는다 — 새 줄이 안 생긴다', () => {
  const rows = build([BIZ('b1', '사단법인 가나다복지회', '123-82-17263'), CARD('c1', '(사)가나다복지회')]);
  assert.equal(rows.length, 1, '꼬리표만 다른데 회사 줄이 둘이다');
  assert.equal(rows[0].cards.length, 1);
});

test('「(유)」 ↔ 「유한회사」, 「(재)」 ↔ 「재단법인」 도 붙는다', () => {
  const rows = build([BIZ('b1', '라마바코리아유한회사', '123-86-75823'), CARD('c1', '라마바코리아(유)'),
    BIZ('b2', '재단법인 사아자서비스원', '123-82-00253'), CARD('c2', '(재)사아자서비스원')]);
  assert.equal(rows.length, 2);
  assert.equal(rowOf(rows, '1238675823').cards.length, 1);
  assert.equal(rowOf(rows, '1238200253').cards.length, 1);
});

test('★★ 지점·노조·공장이 붙은 이름은 «다른 곳»이라 붙지 않는다', () => {
  const rows = build([BIZ('b1', '하늘과일센터 (동문점)', '123-98-01530'), CARD('c1', '하늘과일센터'),
    BIZ('b2', '차카타공단 노동조합', '123-80-01095'), CARD('c2', '차카타공단'),
    BIZ('b3', '(주)파하테크공장', '123-85-50074'), CARD('c3', '파하테크')]);
  assert.equal(rows.length, 6, '다른 곳인데 한 줄로 붙었다 — 지점·노조를 짐작으로 합치면 안 된다');
});

test('★★ 같은 이름에 번호가 다른 등록증이 둘이면 어느 쪽인지 모르니 «안 붙인다»', () => {
  const rows = build([BIZ('b1', '사단법인 가나다모임', '123-82-10001'), BIZ('b2', '재단법인 가나다모임', '123-82-10002'),
    CARD('c1', '가나다모임')]);
  assert.equal(rows.length, 3, '어느 회사인지 모르는데 한쪽에 붙였다');
  assert.equal(rowOf(rows, '1238210001').cards.length, 0);
  assert.equal(rowOf(rows, '1238210002').cards.length, 0);
});

test('이미 되던 것은 그대로 — (주)·띄어쓰기는 지금도 붙는다', () => {
  const rows = build([BIZ('b1', '(주)가나테크', '123-86-20021'), CARD('c1', '주식회사 가나 테크')]);
  assert.equal(rows.length, 1);
});

test('명함에 사업자번호가 직접 적혀 있으면 그 번호가 이긴다 — 이름으로 끌어오지 않는다', () => {
  const card = Object.assign(CARD('c1', '(사)가나다복지회'), { bizno: '123-81-10009' });
  const rows = build([BIZ('b1', '사단법인 가나다복지회', '123-82-17263'), card]);
  assert.equal(rows.length, 2);
  assert.equal(rowOf(rows, '1238217263').cards.length, 0);
});

test('짧은 이름(두 글자 이하)은 붙이지 않는다 — 우연히 겹칠 수 있다', () => {
  const rows = build([BIZ('b1', '(재)가나', '123-82-00001'), CARD('c1', '가나')]);
  assert.equal(rows.length, 2);
});

test('등록증(원본)은 건드리지 않는다 — 세는 값만 바뀐다', () => {
  const items = [BIZ('b1', '사단법인 가나다복지회', '123-82-17263'), CARD('c1', '(사)가나다복지회')];
  const before = JSON.stringify(items);
  build(items);
  assert.equal(JSON.stringify(items), before);
});

/* ══════ 완벽히 같은 «번호 없는» 줄은 저절로 한 줄 (대표 지시 2026-11-02 「완벽히 같은 회사는 그냥 삭제해라」) ══════ */

test('★ 법인 꼬리표만 다른 번호 없는 두 줄은 저절로 한 줄이 된다 — 명함은 모두 남는다', () => {
  const rows = build([CARD('c1', '(사)바사아모임'), CARD('c2', '사단법인 바사아모임'), CARD('c3', '사단법인 바사아모임')]);
  assert.equal(rows.length, 1, '완벽히 같은 곳인데 줄이 둘이다');
  assert.equal(rows[0].cards.length, 3, '접으면서 명함이 사라졌다');
});

test('★★ 사람이 손댄 칸이 «두 줄 모두»에 있으면 접지 않는다 — 어느 쪽을 남길지는 사람 몫', () => {
  const info = { 'n사아바모임': { memo: '가' }, 'n사단법인사아바모임': { folder: 'f1' } };
  const rows = build([CARD('c1', '사아바모임'), CARD('c2', '사단법인 사아바모임')], info);
  assert.equal(rows.length, 2);
});

test('손댄 칸이 «한 줄에만» 있으면 그 줄이 남는다', () => {
  const info = { 'n사단법인사아바모임': { folder: 'f1' } };
  const rows = build([CARD('c1', '사아바모임'), CARD('c2', '사아바모임'), CARD('c3', '사단법인 사아바모임')], info);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, 'n사단법인사아바모임', '손댄 줄이 사라지면 그 폴더·메모가 안 보인다');
});

test('★ 지점·노조 이름은 접지 않는다 — 다른 곳이다', () => {
  const rows = build([CARD('c1', '하늘과일센터'), CARD('c2', '하늘과일센터 동문점'), CARD('c3', '차카타공단'), CARD('c4', '차카타공단 노동조합')]);
  assert.equal(rows.length, 4);
});

test('등록증이 있는 줄은 접지 않는다', () => {
  const rows = build([BIZ('b1', '사단법인 자차카모임', '123-82-30001'), BIZ('b2', '재단법인 자차카모임', '123-82-30002')]);
  assert.equal(rows.length, 2);
});

/* ══════ 🔎 같은 회사 의심 — 남은 의심을 사람에게 (대표 승인 2026-11-02) ══════ */
function suspects(rows, info) {
  const ctx = { console, Object, String, Number, Array, _coInfo: info || {}, coList: () => rows, fmtBizno: (v) => v || '' };
  vm.createContext(ctx);
  vm.runInContext([
    line(/^const _norm = .*$/m).replace(/^const /, 'var '),
    line(/^const CO_BRANCH_TAIL = .*$/m).replace(/^const /, 'var '),
    fnBody('coStrongName'), 'var _susMemo = { list:null, out:null };', fnBody('coSuspectList')
  ].join('\n'), ctx);
  return ctx.coSuspectList();
}
const CO = (key, name, bizno, n) => ({ key, name, bizno: bizno || '', cards: new Array(n || 0).fill({}), docs: 0 });

test('같은 이름에 번호가 둘 다 있고 다르면 B, 지점·노조 꼬리말이면 C', () => {
  const out = suspects([CO('1238210001', '사단법인 다라마모임', '123-82-10001', 4), CO('1238210002', '재단법인 다라마모임', '123-82-10002', 2),
    CO('1239801530', '하늘과일센터 (동문점)', '123-98-01530', 6), CO('nx', '하늘과일센터', '', 1),
    CO('1238001095', '차카타공단 노동조합', '123-80-01095', 2), CO('ny', '차카타공단', '', 9)]);
  const kinds = out.map((x) => x.k).sort().join('');
  assert.equal(kinds, 'BCC', '갈래가 맞지 않습니다: ' + kinds);
});

test('뜻 없는 이름 겹침(「두레」/「두레전자」)은 의심에 올리지 않는다', () => {
  const out = suspects([CO('na', '두레건설', '', 1), CO('nb', '두레건설산업', '', 1)]);
  assert.equal(out.length, 0, '꼬리말이 없는 겹침까지 올리면 짐작으로 합치게 된다');
});

test('★ 「다른 곳」으로 표시한 쌍은 다시 안 올라온다 — 어느 쪽에 적어 둬도', () => {
  const rows = [CO('nx', '하늘과일센터', '', 1), CO('1239801530', '하늘과일센터 (동문점)', '123-98-01530', 6)];
  assert.equal(suspects(rows).length, 1);
  assert.equal(suspects(rows, { nx: { notSame: '1239801530' } }).length, 0);
  assert.equal(suspects(rows, { '1239801530': { notSame: 'nx' } }).length, 0);
});

test('짧은 이름(두 글자 이하)은 의심하지 않는다', () => {
  assert.equal(suspects([CO('n1', '가나', '', 1), CO('n2', '가나점', '', 1)]).length, 0);
});

test('★ coStrongName 은 coListBuild 안의 _strong 과 «같은 잣대»다 — 한쪽만 고치면 화면이 거짓말한다', () => {
  const inner = fnBody('coListBuild').match(/const _strong = s => _norm\(s\)\s*\.replace\((\/[^\n]*\/g), ''\)\s*\.replace\((\/[^\n]*\/g), ''\);/);
  const outer = fnBody('coStrongName').match(/\.replace\((\/[^\n]*\/g), ''\)\s*\.replace\((\/[^\n]*\/g), ''\);/);
  assert.ok(inner && outer, '두 함수의 정규식을 찾지 못했습니다');
  assert.equal(inner[1], outer[1]);
  assert.equal(inner[2], outer[2]);
});

test('설정 정리 목록·정리 센터·하위 화면 지도에 「같은 회사 의심」이 모두 걸려 있다', () => {
  assert.match(src, /sub:'samecos'/);
  assert.match(src, /samecos:openSameCoSuspects/);
  assert.match(src, /_go\('samecos','openSameCoSuspects\(\)'\)/);
});