'use strict';
/* 정부사업신청 — 서류 준비 창의 «AI·DX 수행·강의 이력» (대표 지시 2026-10-31)
   경력관리 강의에 넣은 AI 강의를 정부사업신청(공단 AI훈련코치 서류 준비)에서 읽어 와 보여 주고 고른 것만 복사한다.
   화면 함수를 vm 에 올려 «실제로 돌린다» — 글자만 찾는 검사는 기능을 꺼도 통과한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'gov.html'), 'utf8').replace(/\r\n/g, '\n');

const a = src.indexOf('var _aiOff={};');
const b = src.indexOf('/* 서류 폴더의 파일을 «읽기만» 해서 연다');
assert.ok(a > 0 && b > a, '화면 함수 구역을 못 찾았습니다');
const block = src.slice(a, b);
const escSrc = src.slice(src.indexOf('function esc(s){'), src.indexOf('\n}', src.indexOf('function esc(s){')) + 2);

function boot(over) {
  const box = { innerHTML: '' };
  const copied = [];
  const toasts = [];
  const ctx = {
    _mat: { perf: [] }, _matAi: [], _matchErr: '', _recPopId: 'hrdkai',
    $: (id) => (id === 'recAi' ? box : null),
    toast: (m) => toasts.push(m),
    navigator: { clipboard: { writeText: (t) => { copied.push(t); return Promise.resolve(); } } },
    document: {},
  };
  Object.assign(ctx, over || {});
  vm.createContext(ctx);
  vm.runInContext(escSrc + '\n' + block + '\n;globalThis.__api={recAiDraw,recAiPick,recAiAll,recAiText,recAiCopy,get off(){return _aiOff;}};', ctx);
  return { api: ctx.__api, box, copied, toasts, ctx };
}

const ROWS = [
  { kind: '강의', date: '2026-10-27', year: '2026', topic: '실무자직무역량강화교육 — 개정노동법·AI 업무 활용(1시간)', org: '(사)한국여성인력개발센터연합', hours: '3', people: '18', id: 'L0212' },
  { kind: '강의', date: '2026-10-23', year: '2026', topic: '2026년 개정노동법 및 AI 강의', org: '서산상공회의소', hours: '2', people: '', id: 'L0211' },
  { kind: '컨설팅', date: '', year: '2026', topic: '인사노무 분야 AI 활용 방안 컨설팅', org: '통합 기술보호지원반', hours: '', people: '', id: 'C1' },
];

test('★ 경력관리 자료를 못 받았으면 «받는 중»·«못 읽음»을 밝힌다 — 0건이라 하지 않는다', () => {
  let h = boot({ _mat: null });
  h.api.recAiDraw('hrdkai');
  assert.match(h.box.innerHTML, /받는 중/);
  assert.ok(!/0건|없습니다/.test(h.box.innerHTML), '받는 중인데 «없다»고 말합니다');
  h = boot({ _mat: null, _matchErr: '경력관리 자료를 못 읽어 ...' });
  h.api.recAiDraw('hrdkai');
  assert.match(h.box.innerHTML, /⚠ 경력관리 자료를 못 읽어/);
});

test('★ 받았는데 AI 이력이 없으면 «없다»고 말하고 넣는 길을 알려 준다 — 지어 넣지 않는다', () => {
  const h = boot({ _matAi: [] });
  h.api.recAiDraw('hrdkai');
  assert.match(h.box.innerHTML, /아직 없습니다/);
  assert.match(h.box.innerHTML, /경력관리 › 강의/);
  assert.ok(h.box.innerHTML.indexOf('<table') < 0);
});

test('★ 맨 왼쪽 ㅁ·№ — 줄마다 체크칸과 번호, 머리칸은 모두 선택', () => {
  const h = boot({ _matAi: ROWS });
  h.api.recAiDraw('hrdkai');
  const html = h.box.innerHTML;
  assert.equal((html.match(/<td class="chk"><input type="checkbox" checked/g) || []).length, 3);
  assert.match(html, /<th class="chk"><input type="checkbox" title="모두" checked/);
  assert.match(html, /<td class="rn">1<\/td>[\s\S]*<td class="rn">3<\/td>/);
  assert.match(html, /AI 관련 <b>3건<\/b>/);
  assert.match(html, /증빙\(강의 확인서\)은 기관에서 따로/, '증빙은 따로 받아야 한다는 말이 있어야 합니다');
  assert.match(html, /3시간 · 18명/);
});

test('★ 고른 것만 복사 — 끄면 복사 글에서 빠지고 단추 건수도 줄어든다', () => {
  const h = boot({ _matAi: ROWS });
  h.api.recAiPick('L0211', false);
  h.api.recAiDraw('hrdkai');
  assert.match(h.box.innerHTML, /고른 2건 복사/);
  const tx = h.api.recAiText();
  assert.equal(tx.split('\n').length, 2);
  assert.ok(tx.indexOf('서산상공회의소') < 0, '끈 줄이 복사 글에 있습니다');
  assert.ok(tx.indexOf('(사)한국여성인력개발센터연합') >= 0);
  assert.match(tx.split('\n')[0], /^2026-10-27 · \(사\)한국여성인력개발센터연합 · .*\(3시간, 18명\)$/);
  assert.match(tx.split('\n')[1], /^2026 · 통합 기술보호지원반 · 인사노무 분야 AI 활용 방안 컨설팅$/, '날짜가 없으면 해로 적고 시간·인원 괄호는 만들지 않는다');
});

test('모두 끄고 켜기 · 다 끄고 복사하면 안내만', async () => {
  const h = boot({ _matAi: ROWS });
  h.api.recAiAll(false);
  assert.equal(Object.keys(h.api.off).length, 3);
  assert.equal(h.api.recAiText(), '');
  h.api.recAiCopy();
  assert.deepEqual(h.copied, []);
  assert.match(h.toasts.join(' '), /고른 줄이 없습니다/);
  h.api.recAiAll(true);
  assert.equal(Object.keys(h.api.off).length, 0);
  h.api.recAiCopy();
  assert.equal(h.copied.length, 1);
  assert.equal(h.copied[0].split('\n').length, 3);
});

test('★ 다른 기관 창이 열려 있으면 쓰지 않는다 — 늦게 끝난 읽기가 남의 창을 덮지 않게', () => {
  const h = boot({ _matAi: ROWS, _recPopId: 'nosa' });
  h.api.recAiDraw('hrdkai');
  assert.equal(h.box.innerHTML, '');
});

test('★ 주제·기관의 글자는 HTML 로 벗겨 그린다', () => {
  const h = boot({ _matAi: [{ kind: '강의', date: '2026-10-01', year: '2026', topic: 'AI <img src=x onerror=alert(1)>', org: '"기관"', hours: '', people: '', id: 'L9' }] });
  h.api.recAiDraw('hrdkai');
  assert.ok(h.box.innerHTML.indexOf('<img') < 0, '벗기지 않았습니다');
});

/* ───────── 이어 붙인 자리(글자 검사) ───────── */

test('서류 준비 창에 AI 이력 칸은 공단 AI훈련코치(hrdkai)에만 붙고, 열 때 한 번 받아 그린다', () => {
  assert.match(src, /\(id==='hrdkai'\?'<div class="pop-sub">🤖 AI·DX 수행·강의 이력[^\n]*<div id="recAi"><\/div>':''\)/);
  assert.match(src, /if\(id==='hrdkai'\)\{ matchEnsure\(\); recAiDraw\(id\); \}/);
});

test('경력관리 자료를 받으면 AI 이력을 만들고, 받기가 끝나면 열린 창을 다시 그린다', () => {
  const cp = src.slice(src.indexOf('async function careerPull'), src.indexOf('function recStickySync'));
  assert.match(cp, /_matAi=GovCareer\.aiLectures\(ls\)/);
  assert.match(cp, /if\(!okN\)\{ _mat=null; _matDocs=null; _matAi=null; return; \}/, '못 읽었을 때 옛 값이 남으면 안 됩니다');
  const me = src.slice(src.indexOf('function matchEnsure'), src.indexOf('function matchNoteHtml'));
  assert.match(me, /if\(_recPopId\) recAiDraw\(_recPopId\)/);
});

test('★ 경력관리에 쓰지 않는다 — AI 이력 구역에 쓰기가 없다', () => {
  const code = block.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/ref\(|\.set\(|\.update\(|\.remove\(|localStorage|lsSet/.test(code), '쓰기처럼 보이는 것이 있습니다');
});

test('gov-career.js 캐시 번호가 올라 있다', () => {
  assert.match(src, /<script src="js\/gov-career\.js\?v=([3-9]|\d{2,})"><\/script>/);
});
