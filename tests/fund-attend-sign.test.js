'use strict';
/* 회의록 뒤쪽 「참석위원」 서명표 — 위원마다 한 줄 (대표 지시 2026-09-20 두 번째)
 *
 *   「기금설립준비위원회의 위원은 설립준비위원회회의록 위원과 같다.」
 *   「현재 참석자 명단이 있는데 여기는 안들어 가있다. 이부분도 같이 검토해서 넣어라.」
 *
 * ⚠⚠ 이 파일은 «뒤집힌» 검사다. 2026-09-20 오전까지는 이 표가 signTableHTML(참여회사마다
 *   한 줄)을 썼고, 그때 검사도 「회사마다 한 줄」을 못 박고 있었다. 그 탓에
 *   «등기임원명부에만 있고 어느 사업장에도 안 묶인 위원»이 이 표에서 통째로 빠졌다 —
 *   별지 제7호 위원 명부에는 있는 사람이 회의록에는 없었다(실제 자료로 그려 확인함).
 *   회의록의 참석위원은 «회사»가 아니라 «위원»이다. 되돌리지 말 것.
 *
 * ★ 이 저장소는 통째로 github.io 로 공개된다 — 이름·회사는 전부 가짜다.
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

/* 사업장에서 오는 위원 — 가나산업은 「대표자와 같음」이라 사용자위원이 대표자(홍길동)다 */
const 사업장들 = [
  { name: '가나산업', ceo: '홍길동', wrep_name: '노측가', urep_same: true, status: 'active' },
  { name: '다라전자', ceo: '김철수', wrep_name: '', urep_name: '사측나', status: 'active' },
  { name: '나간곳', ceo: '박나감', wrep_name: '노측탈퇴', status: 'closed' }
];
/* 등기임원에서 오는 위원 — «어느 사업장에도 안 묶인» 사람들이다(여기가 빠졌던 자리) */
const 기금 = { officers: [
  { role: '이사장', name: '이사장님' },
  { role: '근로자측 이사', name: '박노측', title: '생산팀장' },
  { role: '사용자측 이사', name: '최사측', title: '관리부장' },
  /* ⚠ 「이사 겸 감사」로 적는다 — 그냥 「감사」면 이사·대표 어느 말도 안 들어 있어
     감사를 빼는 규칙이 없어도 저절로 걸러진다. 그 규칙을 «정말» 지키는지 보려면
     이사이면서 감사인 사람이어야 한다(2026-09-20 돌연변이에서 이 구멍을 찾았다). */
  { role: '근로자측 이사 겸 감사', name: '감사람' }
] };

function 그려보기(html, f, sites) {
  const dom = new JSDOM('<div id="d">' + html + '</div>');
  const doc = dom.window.document, root = doc.getElementById('d');
  const box = {};
  new Function('document', 'root', 'F', 'SITES', [
    'function esc(s){ return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;"); }',
    'function estabSites(a){ return (a||[]).filter(function(s){ return s&&s.status!=="closed"; }); }',
    'function _officersOf(x){ return (x&&x.officers)||[]; }',
    grabFn('_siteWrep'), grabFn('_siteUrep'),
    grabFn('_isCommittee'), grabFn('_siteCommittee'), grabFn('_prepCommittee'),
    grabFn('_cmWho'), grabFn('attendSignHTML'), grabFn('fillAttendSign'),
    'this.n=fillAttendSign(root,F,SITES);'
  ].join('\n')).call(box, doc, root, f, sites);
  return { root, n: box.n, html: root.innerHTML, doc };
}
const 줄들 = (r) => [].slice.call(r.root.querySelectorAll('tr'))
  .map((tr) => (tr.textContent || '').replace(/\s+/g, ' ').trim());

/* ══ ① 위원마다 한 줄 — 등기임원이 빠지지 않는다 ══════════════════ */

test('★★ ① 등기임원명부의 위원이 «들어간다» — 여기가 통째로 빠져 있던 자리다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const h = 그려보기(원본표, 기금, 사업장들).html;
  assert.ok(h.indexOf('박노측') >= 0, '★ 등기임원 근로자위원이 빠졌습니다 — 별지 제7호에는 있는 사람입니다.');
  assert.ok(h.indexOf('최사측') >= 0, '★ 등기임원 사용자위원이 빠졌습니다.');
});

test('★★ ② 사업장에서 온 위원도 함께 선다 — 두 곳을 합쳐 한 명단이다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const h = 그려보기(원본표, 기금, 사업장들).html;
  assert.ok(h.indexOf('노측가') >= 0, '★ 사업장 근로자대표가 빠졌습니다.');
  assert.ok(h.indexOf('사측나') >= 0, '★ 사업장 사용자대표가 빠졌습니다.');
  assert.ok(h.indexOf('홍길동') >= 0, '★ 「대표자와 같음」인 사업장의 사용자위원이 빠졌습니다.');
});

test('★★ ③ 위원이 아닌 사람은 안 들어간다 — 감사·이사장은 위원이 아니다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const h = 그려보기(원본표, 기금, 사업장들).html;
  assert.ok(h.indexOf('감사람') < 0, '★ 감사가 위원으로 들어갔습니다.');
  assert.ok(h.indexOf('이사장님') < 0, '★ 이사장은 «측»이 자료에 없어 넣으면 안 됩니다.');
  assert.ok(h.indexOf('노측탈퇴') < 0, '★ 탈퇴한 사업장 사람이 들어갔습니다.');
});

test('★★ ④ 소속을 함께 적는다 — 열 명이 넘으면 누가 어디 사람인지 모른다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const r = 그려보기(원본표, 기금, 사업장들);
  assert.match(r.html, /노측가 <span class="cmco">\(가나산업\)<\/span>/, '★ 소속이 안 붙습니다.');
  /* 등기임원은 소속이 자료에 없다 — 지어내지 않는다 */
  const 박 = 줄들(r).filter((t2) => /박노측/.test(t2))[0] || '';
  assert.ok(!/\(/.test(박.replace(/\(인\)/g, '')), '★ 등기임원에 없는 소속을 지어냈습니다: ' + 박);
});

test('★★ ⑤ 「참여회사마다 한 줄」로 돌아가지 않았다 — 그러면 등기임원이 또 빠진다', () => {
  const fn = 코드만(grabFn('fillAttendSign'));
  assert.match(fn, /attendSignHTML\(f,sites,lab\)/, '★ 위원 명단에서 안 받아 옵니다.');
  assert.ok(fn.indexOf('signTableHTML') < 0,
    '★ 회사마다 한 줄 짜는 표로 되돌렸습니다 — 등기임원 위원이 다시 빠집니다.');
  assert.match(코드만(grabFn('attendSignHTML')), /_prepCommittee\(f,'근로자측',sites\)/,
    '★ 별지 제7호·회의록 앞면과 다른 명단을 봅니다.');
});

test('★★ ⑥ 정관·설립합의서의 「회사마다 한 줄」 표는 그대로 둔다 — 그건 회사끼리 맺는 계약이다', () => {
  assert.match(코드만(grabFn('fillSignTable')), /signTableHTML\(lab,list\)/,
    '★ 계약 서식의 회사별 날인표까지 바꿨습니다.');
  assert.match(코드만(SRC), /function signTableHTML\(lab,list\)\{/, '★ 회사별 날인표가 사라졌습니다.');
});

/* ══ ② 표 자체가 제대로 서는가 ══════════════════════════════════ */

test('★★ ⑦ 짝이 안 맞아도 줄이 어긋나지 않는다 — 많은 쪽을 따라 줄을 세운다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  /* 근로자측 2명(박노측·노측가) · 사용자측 3명(최사측·홍길동·사측나) */
  const r = 그려보기(원본표, 기금, 사업장들);
  const 본문 = 줄들(r).filter((t2) => /^\d/.test(t2));
  assert.equal(본문.length, 3, '★ 많은 쪽(3명)에 맞춰 세 줄이어야 합니다: ' + 본문.length);
  assert.match(본문[2], /^3/, '★ 번호가 이어지지 않습니다.');
  assert.ok(!/박노측|노측가/.test(본문[2]), '★ 없는 근로자위원 자리에 딴 사람이 밀려 들었습니다.');
});

test('★★ ⑧ 서명 칸이 사람마다 둘 선다 — 이름 옆에서 서명을 받는다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const r = 그려보기(원본표, 기금, 사업장들);
  const 머리 = 줄들(r)[0] || '';
  assert.match(머리, /번호.*근로자위원.*서명.*사용자위원.*서명/, '★ 머리줄이 다릅니다: ' + 머리);
  const tds = [].slice.call(r.root.querySelectorAll('tr'))[1].children;
  assert.equal(tds.length, 5, '★ 한 줄이 다섯 칸(번호·이름·서명·이름·서명)이 아닙니다.');
});

test('★★ ⑨ 남의 「000」이 남지 않는다 — 그대로 인쇄하면 남의 이름이 나간다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const h = 그려보기(원본표, 기금, 사업장들).html;
  assert.ok(h.indexOf('000') < 0, '★ 원본에 박힌 남의 자리가 남았습니다.');
  assert.ok(h.indexOf('참석위원') < 0, '★ 갈아 끼운 뒤에도 옛 줄이 남았습니다.');
});

test('★★ ⑩ 위원이 하나도 없으면 «손대지 않는다» — 원본 그대로가 낫다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const r = 그려보기(원본표, {}, []);
  assert.equal(r.n, 0);
  assert.match(r.html, /참석위원/, '★ 위원이 없는데 원본을 지웠습니다.');
});

test('★★ ⑪ 다른 표는 건드리지 않는다 — 「서명」이 있다고 다 서명표가 아니다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const 딴표 = '<table><tbody><tr><td>구분</td><td>근로자위원</td><td>서명</td>'
    + '<td>사용자위원</td><td>서명</td></tr>'
    + '<tr><td>의결</td><td>찬성</td><td></td><td>찬성</td><td></td></tr></tbody></table>';
  const r = 그려보기(딴표, 기금, 사업장들);
  assert.equal(r.n, 0, '★ 「참석위원」 줄이 없는 표까지 갈아 끼웠습니다.');
  assert.match(r.html, /의결/, '★ 남의 표를 지웠습니다.');
});

test('★★ ⑫ 걷어내기가 이 표를 도로 지우지 않는다', () => {
  assert.match(코드만(grabFn('fillAttendSign')), /setAttribute\('data-kept','1'\)/,
    '★ 표를 지켜 두지 않으면 남의 값 걷어내기가 통째로 지웁니다.');
});

test('★★ ⑬ 쪽 나누기보다 «먼저» 돈다 — 위원이 예순이면 줄이 예순으로 늘어난다', () => {
  assert.match(코드만(grabFn('hwpFormHTML')),
    /if\(kind==='minutes'\)\{ fillAttendSign\(d,f,sites\); fillMinutesPages\(d\); \}/,
    '★ 쪽을 나눈 뒤에 줄을 늘리면 늘어난 줄이 쪽에 안 담깁니다.');
});

test('★★ ⑭ 위원이 많아도 «별지로 빼지 않는다» — 서명은 이름이 적힌 자리에서 받는다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  const 많은기금 = { officers: Array.from({ length: 40 }, (_, i) => (
    { role: (i % 2 ? '사용자측' : '근로자측') + ' 이사', name: '위원' + i })) };
  const r = 그려보기(원본표, 많은기금, []);
  const 본문 = 줄들(r).filter((t2) => /^\d/.test(t2));
  assert.equal(본문.length, 20, '★ 스무 줄(각 측 20명)이 그대로 서야 합니다: ' + 본문.length);
  assert.ok(r.html.indexOf('별지') < 0, '★ 서명표를 별지로 미뤘습니다 — 서명할 자리가 사라집니다.');
});
