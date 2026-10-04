/* D13 — 성희롱 예방교육 대상 확대(2026.11.27) (대표 결정 2026-10-04 「추천대로」 · 목업 docs/mockups/2026-10-04-성희롱교육-대상확대.html)

   남녀고용평등법 제13조 제2항(법률 제21700호, 2026.5.26 공포 · 2026.11.27 시행)
     지금      「사업주 및 근로자는 제1항에 따른 성희롱 예방 교육을 받아야 한다.」
     11.27부터 「사업주, 법인의 대표자, 상급자 또는 근로자는 …」
   고용노동부 표준취업규칙(2026) 제84조②도 옛 문구(「사업주 및 사원은」)다 — 표준을 따른 사업장은 거의 다 이 문장을 갖고 있다.

   ★ 지키는 것
     ① 옛 문구 찾기 — 「성희롱」 이 든 조문 «안»에서만(산업안전 조문의 「사업주 및 근로자는」 을 헛잡지 않는다)
     ② 시행일 전이면 「시행예정」, 뒤면 「위반의심」 — 옛 문구 찾기(금지문구)도 시행일을 본다
     ③ 문장이 없으면 걸지 않는다(필수기재가 아니다 — 교육 자체는 B15 가 본다)
     ④★★★ 고칠 때 «그 문구만» 바꾼다 — 조 전체를 문안으로 갈아 끼우면 ①③④항이 지워진다
   실행: node --test tests/rules-d13.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../js/pu-rules-criteria.js');
const L = require('../js/pu-rules-lawlink.js');
const { parseArticles, STD_TEXT } = require('./lib-rules-std.js');

const D13 = () => C.RULES.find((r) => r.id === 'D13');
const 판정 = (arts, asof) => C.evaluate(arts, '30인이상', new Set(), asof).find((f) => f.rule.id === 'D13');
const 글 = (s) => parseArticles(s);
const 옛 = '제10조(직장 내 성희롱 예방교육) ① 회사는 직장 내 성희롱 예방교육을 연 1회 이상 실시한다.\n'
  + '② 사업주 및 사원은 제1항에 따른 성희롱 예방교육을 받아야 한다.\n'
  + '③ 회사는 성희롱 예방교육의 내용을 사원들이 자유롭게 열람할 수 있는 장소에 항상 게시한다.\n';
const 새 = '제10조(직장 내 성희롱 예방교육) ① 회사는 직장 내 성희롱 예방교육을 연 1회 이상 실시한다.\n'
  + '② 사업주, 법인의 대표자, 상급자 또는 사원은 제1항에 따른 성희롱 예방교육을 받아야 한다.\n';
const 안전 = '제20조(안전보건) 사업주 및 근로자는 산업안전보건법에 따른 안전수칙을 지켜야 한다.\n'
  + '제21조(직장 내 성희롱 예방교육) 회사는 직장 내 성희롱 예방교육을 연 1회 이상 실시한다.\n';

/* ══════ 기준 ══════ */

test('D13 이 규칙집에 있다 — 근거·시행일·판정 방식', () => {
  const r = D13();
  assert.ok(r, 'D13 이 없다');
  assert.equal(r.type, '금지문구');
  assert.equal(r.effective, '2026-11-27');
  assert.match(r.law, /남녀고용평등법 §13②/);
  assert.equal(r.within, '성희롱', '「성희롱」 이 든 조문 안에서만 찾아야 한다');
  assert.equal(r.scope, '전체');
});

/* ══════ 판정 ══════ */

test('★★ 표준취업규칙(2026) 그대로면 — 시행일 전 「시행예정」, 뒤 「위반의심」 · 제84조를 짚는다', () => {
  const arts = 글(STD_TEXT);
  const 전 = 판정(arts, '2026-10-04'), 후 = 판정(arts, '2026-11-27');
  assert.equal(전.status, '시행예정', '★★ 아직 시행 전인데 위반의심으로 띄운다');
  assert.equal(후.status, '위반의심');
  assert.equal(후.hit && 후.hit.label, '제84조', '성희롱 예방교육 조문을 짚어야 한다');
  assert.match(전.note, /2026-11-27/);
});

test('이미 고친 문구는 어느 날이든 적합', () => {
  assert.equal(판정(글(새), '2026-12-01').status, '적합');
  assert.equal(판정(글(새), '2026-10-04').status, '적합');
});

test('★ 성희롱 조문 «밖»의 「사업주 및 근로자는」 은 잡지 않는다', () => {
  assert.equal(판정(글(안전), '2026-12-01').status, '적합', '★ 산업안전 조문을 헛잡았다');
});

test('그 문장이 아예 없으면 걸지 않는다 — 교육 자체는 B15 몫', () => {
  const t = '제10조(직장 내 성희롱 예방교육) 회사는 직장 내 성희롱 예방교육을 연 1회 이상 실시한다.\n';
  assert.equal(판정(글(t), '2026-12-01').status, '적합');
});

test('호칭·이음말이 달라도 잡는다 — 근로자·직원 · 「와」', () => {
  ['근로자는', '직원은'].forEach((w) => {
    assert.equal(판정(글(옛.replace('사원은', w)), '2026-12-01').status, '위반의심', w);
  });
  assert.equal(판정(글(옛.replace('사업주 및 사원은', '사업주와 사원은')), '2026-12-01').status, '위반의심');
});

test('옛 문구 찾기의 시행일 규칙은 다른 기준에도 같다 — 지난 시행일은 그대로 위반의심', () => {
  // D2(무급 공휴일, 2022-01-01) — 이미 지난 날이라 그대로
  const t = '제30조(휴일) 공휴일은 무급으로 한다.\n';
  const f = C.evaluate(글(t), '30인이상', new Set(), '2026-10-04').find((x) => x.rule.id === 'D2');
  assert.equal(f.status, '위반의심');
});

/* ══════ 법 개정 감시 — 제13조가 «이미 있음»이 된다 ══════ */

test('법 개정 감시 — 남녀고용평등법 제13조에 D13 이 걸린다(시행일 같음 → 이미 반영)', () => {
  const ids = L.rulesForArticle('남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률', '13', C.RULES);
  assert.ok(ids.includes('D13'), '연결표가 D13 을 제13조에 못 잇는다: ' + ids.join(','));
  const W = require('../js/pu-rules-lawwatch.js');
  const ev = { id: 'x', lawKey: '남녀고용평등과 일ㆍ가정 양립 지원에 관한 법률', effective: '2026-11-27',
    arts: { 13: { art: '13', title: '직장 내 성희롱 예방 교육 등', kind: '개정', effective: '2026-11-27', before: '② 사업주 및 근로자는', after: '② 사업주, 법인의 대표자, 상급자 또는 근로자는' } } };
  const c = W.criteria(ev, C.RULES, L)[0];
  assert.equal(c.covered, true, '「⚠ 기준 손질 필요」가 그대로다');
});

/* ══════ ★★★ 고칠 때 «그 문구만» ══════ */

const RAW = fs.readFileSync(path.join(__dirname, '..', 'rules.html'), 'utf8').replace(/\r\n/g, '\n');
function cut(decl) {
  const at = RAW.indexOf(decl);
  assert.ok(at > 0, decl + ' 을 못 찾았습니다');
  let i = RAW.indexOf('{', at + decl.length), d = 0;
  for (; i < RAW.length; i++) { if (RAW[i] === '{') d++; else if (RAW[i] === '}') { d--; if (!d) return RAW.slice(at, i + 1); } }
  throw new Error(decl + ' 끝 없음');
}
function 판() {
  const ctx = {};
  vm.createContext(ctx);
  const line = RAW.split('\n').find((l) => l.startsWith('const TPLS = '));
  vm.runInContext(line.replace(/^const TPLS = /, 'var TPLS = '), ctx);
  vm.runInContext(cut('function tplReplace('), ctx);
  return ctx;
}

test('★★★ 문안은 «치환»이다 — 조를 통째로 갈아 끼우지 않는다', () => {
  const c = 판();
  const t = c.TPLS.find((x) => x.ruleIds.includes('D13'));
  assert.ok(t, 'D13 문안이 없다');
  assert.equal(t.kind, '치환', '★★★ 조 전체 문안이면 ①③④항이 지워진다');
  const before = 옛.replace(/^제10조\(직장 내 성희롱 예방교육\)\s*/, '').replace(/\s+/g, ' ').trim();
  const after = c.tplReplace(t, before);
  assert.match(after, /② 사업주, 법인의 대표자, 상급자 또는 사원은 제1항에 따른 성희롱 예방교육을 받아야 한다\./);
  assert.match(after, /① 회사는 직장 내 성희롱 예방교육을 연 1회 이상 실시한다\./, '★★★ ①항이 사라졌다');
  assert.match(after, /③ 회사는 성희롱 예방교육의 내용을/, '★★★ ③항이 사라졌다');
  assert.equal(after.replace('법인의 대표자, 상급자 또는 ', '').replace('사업주, ', '사업주 및 '), before, '그 문구 밖이 바뀌었다');
});

test('호칭은 그 사업장 것 그대로 — 「사원은」·「근로자는」 을 바꾸지 않는다', () => {
  const c = 판(), t = c.TPLS.find((x) => x.ruleIds.includes('D13'));
  assert.match(c.tplReplace(t, '② 사업주 및 근로자는 교육을 받아야 한다.'), /상급자 또는 근로자는/);
  assert.match(c.tplReplace(t, '② 사업주와 직원은 교육을 받아야 한다.'), /상급자 또는 직원은/);
});

test('고칠 문구가 없으면 null — 아무것도 안 바꾼다', () => {
  const c = 판(), t = c.TPLS.find((x) => x.ruleIds.includes('D13'));
  assert.equal(c.tplReplace(t, '① 회사는 교육을 실시한다.'), null);
});

test('★★ buildItems 가 치환 문안을 «치환»으로 쓴다 — 통째 넣기 길로 안 흐른다', () => {
  const fn = cut('function buildItems(');
  assert.match(fn, /t\.kind==="치환"/, '★★ buildItems 가 치환 문안을 모른다 — 조가 통째로 바뀐다');
  assert.match(fn, /tplReplace\(/);
});
