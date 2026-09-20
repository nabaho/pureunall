'use strict';
/* 회의록 뒤쪽 「참석위원」 서명표도 연명 날인표로 (대표 지시 2026-09-20)
 *
 *   「모든 연명 서명날인은 모두 캡쳐1과 같이 바꿔라  캡쳐3도 같다
 *    설립준비위원회회의록에 이름」
 *
 * ★ 원본 회의록 뒤쪽은 〈구분 | 근로자위원 | 서명 | 사용자위원 | 서명〉 다섯 칸에
 *   「참석위원」 한 줄뿐이고, 이름 자리에 남의 「000」이 박혀 있었다.
 *   회사가 열여섯이면 날인도 열여섯 곳에서 받아야 하는데 줄이 하나라 손으로 그려야 했다.
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

/* ── 원본 회의록 뒤쪽과 «같은 짜임»을 세운다(fund_forms.js 에서 옮겨 온 꼴) ── */
const 원본표 = '<table><tbody>'
  + '<tr><td colspan="5">(뒤 쪽)</td></tr>'
  + '<tr><td>구분</td><td>근로자위원</td><td>서명</td><td>사용자위원</td><td>서명</td></tr>'
  + '<tr><td>참석위원</td><td>000<br>000</td><td></td><td>000<br>000</td><td></td></tr>'
  + '<tr><td colspan="5" style="height:188.3pt"></td></tr>'
  + '</tbody></table>';

const 사업장들 = [
  { name: '가나산업', ceo: '홍길동', wrep_name: '노측가', status: 'active' },
  { name: '다라전자', ceo: '김철수', wrep_name: '', status: 'active' },
  { name: '마바디자인', ceo: '이영희', wrep_name: '노측다', status: 'active' }
];

function 그려보기(html, sites) {
  const dom = new JSDOM('<div id="d">' + html + '</div>');
  const doc = dom.window.document, root = doc.getElementById('d');
  const box = {};
  new Function('document', 'root', 'SITES', [
    'function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }',
    'function estabSites(a){ return (a||[]).filter(function(s){ return s&&s.status!=="closed"; }); }',
    grabFn('_siteWrep'), grabFn('_siteUrep'),
    grabFn('signTableHTML'), grabFn('fillAttendSign'),
    'this.n=fillAttendSign(root,{},SITES);'
  ].join('\n')).call(box, doc, root, sites);
  return { root, n: box.n, html: root.innerHTML };
}

test('★★ ① 회사마다 한 줄씩 선다 — 열여섯이면 열여섯 줄이다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const r = 그려보기(원본표, 사업장들);
  assert.equal(r.n, 3, '★ 갈아 끼우지 않았습니다.');
  const tb = r.root.querySelector('table');
  const trs = [].slice.call(tb.querySelectorAll('tr'));
  assert.equal(trs.length, 4, '★ 머리줄 하나 + 회사 셋이어야 합니다: ' + trs.length);
  assert.match(trs[0].textContent, /번호/, '★ 번호 칸이 없습니다.');
  assert.match(trs[1].textContent, /가나산업/);
  assert.match(trs[3].textContent, /마바디자인/, '★ 마지막 회사가 빠졌습니다.');
});

test('★★ ② 서식이 쓴 말(근로자위원·사용자위원)을 그대로 쓴다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const h = 그려보기(원본표, 사업장들).html;
  assert.match(h, /각 참여회사 근로자위원/, '★ 이 서식에 없던 말이 찍힙니다.');
  assert.match(h, /각 참여회사 사용자위원/);
  assert.ok(h.indexOf('근로자대표') < 0, '★ 다른 서식의 말을 끌어왔습니다.');
});

test('★★ ③ 이름을 «넣는다» — 대표이사는 대표자, 근로자위원은 근로자대표', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const trs = [].slice.call(그려보기(원본표, 사업장들).root.querySelectorAll('tr'));
  assert.match(trs[1].textContent, /노측가/, '★ 근로자대표 이름이 안 들어갑니다.');
  assert.match(trs[1].textContent, /홍길동/, '★ 대표자 이름이 안 들어갑니다.');
  /* 모르는 이름은 밑줄로 둔다 — 지어내지 않는다 */
  assert.match(trs[2].textContent, /＿/, '★ 모르는 이름을 무엇으로든 메웠습니다.');
  assert.match(trs[2].textContent, /김철수/, '★ 아는 이름까지 빠졌습니다.');
});

test('★★ ④ 남의 「000」이 남지 않는다 — 그대로 인쇄하면 남의 이름이 나간다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const h = 그려보기(원본표, 사업장들).html;
  assert.ok(h.indexOf('000') < 0, '★ 원본에 박힌 남의 자리가 남았습니다.');
  assert.ok(h.indexOf('참석위원') < 0, '★ 갈아 끼운 뒤에도 옛 줄이 남았습니다.');
});

test('★★ ⑤ 날인 자리는 칸의 «오른쪽 끝» — 세로로 한 줄에 선다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const h = 그려보기(원본표, 사업장들).html;
  assert.equal((h.match(/class="right"/g) || []).length, 6, '★ 회사마다 두 칸이어야 합니다.');
  assert.match(h, /\(인\)/, '★ 날인 표시가 없습니다.');
});

test('★★ ⑥ 참여사업장이 없으면 «손대지 않는다» — 원본 그대로가 낫다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const r = 그려보기(원본표, []);
  assert.equal(r.n, 0);
  assert.match(r.html, /참석위원/, '★ 사업장이 없는데 원본을 지웠습니다.');
});

test('★★ ⑦ 다른 표는 건드리지 않는다 — 「서명」이 있다고 다 서명표가 아니다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const 딴표 = '<table><tbody><tr><td>구분</td><td>근로자위원</td><td>서명</td>'
    + '<td>사용자위원</td><td>서명</td></tr>'
    + '<tr><td>의결</td><td>찬성</td><td></td><td>찬성</td><td></td></tr></tbody></table>';
  const r = 그려보기(딴표, 사업장들);
  assert.equal(r.n, 0, '★ 「참석위원」 줄이 없는 표까지 갈아 끼웠습니다.');
  assert.match(r.html, /의결/, '★ 남의 표를 지웠습니다.');
});

test('★★ ⑧ 걷어내기가 이 표를 도로 지우지 않는다', () => {
  assert.match(코드만(grabFn('fillAttendSign')), /setAttribute\('data-kept','1'\)/,
    '★ 표를 지켜 두지 않으면 남의 값 걷어내기가 통째로 지웁니다.');
});

test('★★ ⑨ 쪽 나누기보다 «먼저» 돈다 — 줄이 열여섯으로 늘어난다', () => {
  assert.match(코드만(grabFn('hwpFormHTML')),
    /if\(kind==='minutes'\)\{ fillAttendSign\(d,f,sites\); fillMinutesPages\(d\); \}/,
    '★ 쪽을 나눈 뒤에 줄을 늘리면 늘어난 줄이 쪽에 안 담깁니다.');
});
