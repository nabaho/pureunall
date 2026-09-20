'use strict';
/* 기금출연확인서 한 장의 짜임 — 회사마다 한 장, 지면 가운데로 (대표 지시 2026-09-20)
 *
 *   「기금출연확인서의 회사 대표자는 1회사당 1장씩하고 나중에 출력해서 날인을 한다.
 *    …줄간격 글자크기 회사이름 날인 위치를 조정해서 참여사업장수만큼 만들어라.
 *    만들기전에 항상목업 해라」
 *
 * ★ 이 저장소는 통째로 github.io 로 공개된다 — 회사 이름·금액은 전부 가짜다.
 *
 * ⚠⚠ 실제로 겪은 사고: 금액을 <div class="cbwrap"><div class="cbamt"><b>금액</b>
 *   …로 두 겹 감쌌더니, stripBaked 가 «바로 위 부모»만 보고 data-kept 를 확인해
 *   방금 채운 진짜 금액을 남의 박힌 금액인 줄 알고 지웠다(전체 검사에서 잡음).
 *   이 파일은 ①한 장의 짜임 ②stripBaked 가 중첩된 data-kept 도 지키는지 둘 다 본다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
const 코드만 = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/* ══ ① stripBaked — 중첩된 data-kept 도 지킨다 (진짜 사고, 진짜 재현) ══════ */

function 상자() {
  if (!JSDOM) return null;
  const dom = new JSDOM('<!doctype html><body></body>');
  const box = {};
  new Function('document', [
    'function esc(s){ return String(s==null?"":s); }',
    'var BAKE_BLANK=' + JSON.stringify((SRC.match(/var BAKE_BLANK='([^']*)'/) || [])[1] || '＿＿＿＿＿') + ';',
    grabFn('_isRateRow'), grabFn('_isBlankCell'), grabFn('_isLabelCell'), grabFn('_bakeText'),
    grabFn('stripBaked'),
    'this.strip=stripBaked;'
  ].join('\n')).call(box, dom.window.document);
  return { box, doc: dom.window.document };
}

test('★★ ① data-kept 가 두 겹·세 겹 감싸도(<div><div><b>) 지켜진다 — 진짜 사고 재현', (t) => {
  const s = 상자(); if (!s) return t.skip('jsdom 없음');
  const el = s.doc.createElement('div'); el.setAttribute('data-kept', '1');
  el.innerHTML = '<div class="cbwrap"><div class="cbamt">금액<br><b>육백만원정(￦ 6,000,000)</b></div></div>';
  s.box.strip(el);
  assert.match(el.textContent, /육백만원정\(￦ 6,000,000\)/,
    '★ 두 겹 감싼 진짜 금액을 남의 박힌 금액인 줄 알고 지웠습니다.');
});

test('★★ ② «감싸지 않은» 같은 모양의 남의 금액은 여전히 지운다 — data-kept 만 봐주는 것이다', (t) => {
  const s = 상자(); if (!s) return t.skip('jsdom 없음');
  const el = s.doc.createElement('div');   // data-kept 없음 — 원본에 박힌 값
  el.innerHTML = '<div class="cbwrap"><div class="cbamt">금액<br><b>오백만원정(￦5,000,000)</b></div></div>';
  s.box.strip(el);
  assert.ok(!/오백만원정|5,000,000/.test(el.textContent),
    '★ data-kept 가 없는데도 안 지웠습니다 — 남의 금액이 그대로 남습니다.');
});

test('★★ ③ 조상 전체를 본다(closest) — «바로 위 부모»만 보던 옛 방식이 남지 않았다', () => {
  const fn = 코드만(grabFn('stripBaked'));
  assert.match(fn, /el\.closest&&el\.closest\('\[data-kept\]'\)/,
    '★ closest 로 조상을 보지 않습니다 — 몇 겹만 감싸면 다시 지워집니다.');
  assert.ok(!/el\.getAttribute&&el\.getAttribute\('data-kept'\)/.test(fn),
    '★ 「바로 위 부모」만 보던 옛 확인이 남았습니다.');
});

/* ══ ② 확인서 한 장의 짜임 (목업 승인본) ══════════════════════════════ */

function 확인서그리기(fn名, f, sites) {
  if (!JSDOM) return null;
  const dom = new JSDOM('<!doctype html><body></body>');
  const doc = dom.window.document;
  const root = doc.createElement('div');
  new Function('document', 'root', 'F', 'SITES', [
    'function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }',
    'function num(v){ if(v===""||v==null) return ""; var n=Number(String(v).replace(/,/g,"")); return isFinite(n)?n:""; }',
    'var BAKE_BLANK=' + JSON.stringify((SRC.match(/var BAKE_BLANK='([^']*)'/) || [])[1] || '＿＿＿＿＿') + ';',
    'var _KOR_D=' + (SRC.match(/var _KOR_D=\[[^\]]*\]/) || [])[0].slice(9) + ';',
    'var _KOR_P=' + (SRC.match(/var _KOR_P=\[[^\]]*\]/) || [])[0].slice(9) + ';',
    'var _KOR_U=' + (SRC.match(/var _KOR_U=\[[^\]]*\]/) || [])[0].slice(9) + ';',
    grabFn('korWon'), grabFn('_docRok'), grabFn('_siteUrep'), grabFn('estabSites'),
    grabFn('siteContribOf'), grabFn('siteContribNow'), grabFn('contribCertHTML'),
    grabFn(fn名),
    'var S={formFund:"X",year:2026};',
    fn名 + '(root,F,SITES);'
  ].join('\n')).call({}, doc, root, f, sites);
  return root;
}

const F = { name: '가짜공동근로복지기금' };
const SITES = [
  { _id: 's1', name: '가나기계', ceo: '김가나', contrib: 6000000, status: 'active' },
  { _id: 's2', name: '다라전자', ceo: '이다라', contrib: 4000000, status: 'active' }
];

test('★★ ④ 회사마다 지면 가운데로 내리는 덩이(.cbwrap)가 하나씩 선다', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const wraps = [].slice.call(root.querySelectorAll('.cbwrap'));
  assert.equal(wraps.length, 2, '★ 회사 수만큼 덩이가 안 섭니다.');
});

test('★★ ⑤ 제목은 자간 넓힌 표제(fmtitle)를 쓴다 — 다른 서식과 통일', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const titles = [].slice.call(root.querySelectorAll('.cbwrap .fmtitle'));
  assert.equal(titles.length, 2);
  titles.forEach((x) => assert.equal(x.textContent, '기금출연확인서', '★ 글자 사이를 띄운 옛 표기가 남았습니다.'));
});

test('★★ ⑥ 회사 이름이 따로 도드라진다(.cbco) — 서명줄 첫머리에 단독으로', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const cos = [].slice.call(root.querySelectorAll('.cbco')).map((x) => x.textContent);
  assert.deepEqual(cos, ['가나기계', '다라전자'], '★ 회사 이름이 따로 안 섭니다.');
});

test('★★ ⑦ 도장 자리가 표시된다(.cbseal) — 대표이사 다음, 오른쪽 끝', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const seals = [].slice.call(root.querySelectorAll('.cbseal'));
  assert.equal(seals.length, 2);
  seals.forEach((x) => assert.equal(x.textContent, '인'));
  const ceo = root.querySelectorAll('.cbceo')[0];
  assert.match(ceo.textContent, /대표이사.*김가나.*인/, '★ 대표이사·이름·도장 차례가 어긋났습니다.');
});

test('★★ ⑧ 금액이 지어내지지 않고 실제 값으로 선다 — 두 회사가 서로 다른 금액', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const amts = [].slice.call(root.querySelectorAll('.cbamt')).map((x) => x.textContent);
  assert.match(amts[0], /육백만원정.*6,000,000/);
  assert.match(amts[1], /사백만원정.*4,000,000/);
});

test('★★ ⑨ 둘째 장부터 새 장에서 시작한다 — 첫 장에 붙이면 앞에 빈 장이 생긴다', (t) => {
  const root = 확인서그리기('fillFoundContribDoc', F, SITES); if (!root) return t.skip('jsdom 없음');
  const kids = [].slice.call(root.children);
  assert.equal(kids.length, 2);
  assert.ok(!kids[0].hasAttribute('data-newpage'), '★ 첫 장에도 새 장 표시가 있습니다.');
  assert.ok(kids[1].hasAttribute('data-newpage'), '★ 둘째 장에 새 장 표시가 없습니다.');
});

test('★★ ⑩ 확인서 한 장의 «모양»은 짜는 곳이 하나다(contribCertHTML) — 서식마다 갈리지 않는다', () => {
  ['fillFoundContribDoc', 'fillContribDoc'].forEach((n) => {
    assert.match(코드만(grabFn(n)), /contribCertHTML\(\{/, '★ ' + n + ' 이 표를 따로 짭니다.');
  });
  const 코드 = 코드만(SRC);
  assert.equal((코드.match(/class="cbwrap"/g) || []).length, 1,
    '★ 짜는 곳이 둘입니다 — 한쪽만 고쳐지면 두 확인서 모양이 갈립니다.');
});

test('★ ⑪ 지원신청용(sub_contrib)은 「대표」, 설립용(contrib)은 「대표이사」 — 부르는 말은 각자 짓는다', () => {
  assert.match(코드만(grabFn('fillContribDoc')), /signLabel:'대표'/,
    '지원신청용 서명 라벨이 바뀌었다면 원본과 맞는지 확인');
  assert.match(코드만(grabFn('fillFoundContribDoc')), /signLabel:'대표이사'/);
});
