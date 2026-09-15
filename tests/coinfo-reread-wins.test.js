'use strict';
/* 재판독한 값이 기업 상세에 들어가게 (대표 결정 2026-09-15 「셋 다」)
   실행: node --test tests/coinfo-reread-wins.test.js
   목업 docs/mockups/coinfo-reread-wins.html

   ■ 무엇이 문제였나 — 살아 있는 자료에서 잰 것(2026-09-15)
   대표: 「ocr 인식이 잘못되어 다시 인식시켰는데 기업정보함에 기존 정보로 잘못
         올라가거나 변경되는 경우가 종종 있다」
   삼성검수주식회사(316-81-03842)가 기업 상세에 이렇게 들어 있었다 —
     상호  「삼성검수주식회사표자」  ← 「대표자」의 「표자」가 붙었다
     대표자「변경」                  ← 「발급사유: 대표자 변경」의 「변경」이 앉았다
   대표님이 하루 전 «맞게» 다시 읽히셨는데(「삼성검수주식회사」·「안용운」),
   그 값이 conflicts 에 갇힌 채 틀린 값이 화면에 남아 있었다.

   ■ ★★ 못 박는 것 셋 — 셋은 «따로 떼면 위험하다»
   ① 같은 서류를 «다시» 읽으면 새 값이 이긴다. 판별은 추측이 아니라
      「지금 값이 바로 이 사진에서 왔는가」(src/{칸} === 이 사진의 열쇠)다.
   ② ⚠⚠ 사람이 적은 칸에는 «도장»이 있고, 기계는 그 칸을 영영 안 덮는다.
      도장 없이 ①만 켜면 대표님이 고쳐 두신 값이 조용히 지워진다 — 2026-07 사고의 재판이다.
   ③ 다른 서류에서 온 값이면 «여전히 안 덮는다». 실측 21칸 중 16칸이 그 경우였고,
      거기서 새것이 이기게 하면 자세히 적힌 업태가 한 줄짜리로 지워진다.

   ■ 이 검사는 «글자»가 아니라 «하는 일»을 본다 — 진짜 sendToCoInfo 를 돌린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripComments, stripJs } = require('./strip-comments.js');
const { cutFn } = require('./cut-fn.js');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'js', 'pu-doc-file.js'), 'utf8');
const CARDS = fs.readFileSync(path.join(R, 'pu-cards.html'), 'utf8');

/* ── 가짜 실시간DB — 무엇이 쓰였는지 그대로 받아 둔다 ── */
function 층(자리값) {
  const 쓴것 = [];
  const db = {
    ref: function (p) {
      return {
        once: function () {
          return Promise.resolve({ val: function () { return 자리값; } });
        },
        update: function (u) { 쓴것.push(u); return Promise.resolve(); },
        push: function () { return { key: 'new1' }; }
      };
    }
  };
  const box = {
    window: undefined, console: { warn: function () { } },
    Date, Math, JSON, Object, Array, String, Number, Promise, RegExp, isNaN
  };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(SRC, box);
  const F = box.PuDocFile;
  F.init({ db: db, storage: null });
  return { F: F, 쓴것: 쓴것 };
}

const 사진 = { id: '-P1U5Vgy8qps1uB0y7SU', year: '2026', owner: 'U1' };
const 그사진열쇠 = '2026_-P1U5Vgy8qps1uB0y7SU';
const 다른사진 = { id: '-P06pi9G7tRUjczDqmzl', year: '2026', owner: 'U1' };

/* 삼성검수 — 처음 판독이 두 칸을 잘못 읽은 «그 상태» */
function 잘못읽힌회사(src) {
  return {
    company: '삼성검수주식회사표자', ceo: '변경', bizno: '316-81-03842',
    src: src || { company: 그사진열쇠, ceo: 그사진열쇠 }
  };
}
const 바르게읽음 = {
  bizno: '316-81-03842', company: '삼성검수주식회사', ceo: '안용운', docName: '사업자등록증'
};

function 보내기(자리값, fields, photo) {
  const a = 층(자리값);
  return a.F.sendToCoInfo({ kind: 'bizreg', fields: fields, photo: photo || 사진, byName: '권형하' })
    .then(function (r) { return { r: r, 쓴것: a.쓴것 }; });
}
function 합친쓰기(쓴것) {
  const out = {};
  쓴것.forEach(function (u) { Object.keys(u).forEach(function (k) { out[k] = u[k]; }); });
  return out;
}

/* ══════ ① 같은 서류를 다시 읽으면 «새 값이 이긴다» ═══════════════════ */

test('★★★ 같은 사진을 다시 읽으면 틀린 값을 «고친다» — 이것이 대표님이 다시 읽히신 까닭이다', async () => {
  const { r, 쓴것 } = await 보내기(잘못읽힌회사(), 바르게읽음);
  const u = 합친쓰기(쓴것);
  assert.equal(u.company, '삼성검수주식회사',
    '★★★ 다시 읽어도 안 고치면, 대표님은 판독을 눌러도 화면이 그대로인 것을 보십니다');
  assert.equal(u.ceo, '안용운');
  assert.equal(Array.from(r.redone || []).sort().join(','), 'ceo,company');
});

test('★★ 고쳤으면 «어긋남 줄»을 치운다 — 남겨 두면 다 끝난 일을 또 묻는다', async () => {
  const { 쓴것 } = await 보내기(잘못읽힌회사(), 바르게읽음);
  const u = 합친쓰기(쓴것);
  assert.equal(u['conflicts/company'], null);
  assert.equal(u['conflicts/ceo'], null);
});

test('★★ 고쳤다고 «말한다» — 묻히면 대표님이 또 판독을 누르신다(요금이 든다)', async () => {
  const { r } = await 보내기(잘못읽힌회사(), 바르게읽음);
  assert.match(r.message, /다시 읽어/);
  assert.match(r.message, /상호|회사/, '어느 칸이 고쳐졌는지 없으면 확인할 길이 없습니다');
});

test('★ 고친 칸의 출처를 다시 적는다 — 「이 값 어디서 왔나」에 답해야 한다', async () => {
  const { 쓴것 } = await 보내기(잘못읽힌회사(), 바르게읽음);
  assert.equal(합친쓰기(쓴것)['src/company'], 그사진열쇠);
});

/* ══════ ② ⚠⚠ 사람이 적은 칸은 «영영» 안 덮는다 ═══════════════════════ */

test('★★★ 사람 도장이 찍힌 칸은 같은 사진을 다시 읽어도 «안 덮는다»', async () => {
  const HAND = 층({}).F.HAND;
  const 자리 = 잘못읽힌회사({ company: HAND, ceo: 그사진열쇠 });
  자리.company = '사람이 고쳐 둔 이름';
  const { 쓴것 } = await 보내기(자리, 바르게읽음);
  const u = 합친쓰기(쓴것);
  assert.equal(u.company, undefined,
    '★★★ 대표님이 손으로 고쳐 두신 값이 판독 한 번에 지워집니다 — 2026-07 사고의 재판입니다');
  assert.ok(u['conflicts/company'], '★★ 안 덮더라도 «다른 값이 왔다»는 사실은 남겨야 합니다');
  assert.equal(u.ceo, '안용운', '도장이 없는 칸은 그대로 고쳐져야 합니다');
});

test('★★★ 기업정보함이 손으로 고칠 때 «도장을 찍는다» — 안 찍으면 위 울타리가 헛돈다', () => {
  const fn = cutFn(CARDS, 'function coSaveInfoPatch(');
  assert.ok(fn, 'coSaveInfoPatch 가 없습니다');
  const 몸통 = stripJs(fn);
  assert.match(몸통, /coInfo\/'\s*\+\s*key\s*\+\s*'\/src\/'\s*\+\s*f/,
    '★★★ 손으로 고친 칸에 도장을 안 찍으면, 같은 서류를 다시 읽는 순간 그 값이 지워집니다');
});

test('★★★ 도장 글자가 두 파일에서 «같다» — 어긋나면 도장이 아무것도 안 막는다', () => {
  /* 기업정보함은 판독 층을 안 실어서 글자가 두 곳에 적힌다. 그래서 기계로 견준다. */
  const m = stripComments(SRC).match(/var HAND\s*=\s*'([^']+)'/);
  assert.ok(m, 'js/pu-doc-file.js 에 HAND 도장이 없습니다');
  const 판독층 = m[1];
  const fn = stripJs(cutFn(CARDS, 'function coSaveInfoPatch(') || '');
  const m2 = fn.match(/PuDocFile\.HAND\)\s*\|\|\s*'([^']+)'/);
  assert.ok(m2, 'pu-cards.html 에 도장 글자가 없습니다');
  assert.equal(m2[1], 판독층,
    '★★★ 두 파일의 도장 글자가 다릅니다 — 한쪽이 찍은 도장을 다른 쪽이 못 알아봅니다');
  assert.ok(!/^\d{4}_/.test(판독층),
    '★★ 도장 글자가 사진 열쇠(해_사진번호)와 헷갈릴 모양입니다');
});

/* ══════ ③ 다른 서류에서 온 값은 «여전히» 안 덮는다 ═══════════════════ */

test('★★★ 다른 사진에서 온 값은 안 덮고 ⚠ 로 남긴다 — 실측 21칸 중 16칸이 이 경우다', async () => {
  const { r, 쓴것 } = await 보내기(잘못읽힌회사(), 바르게읽음, 다른사진);
  const u = 합친쓰기(쓴것);
  assert.equal(u.company, undefined,
    '★★★ 다른 서류가 이기게 하면, 자세히 적힌 업태가 신청서 한 줄로 지워집니다');
  assert.ok(u['conflicts/company'], '★★ 어긋났다는 사실은 반드시 남겨야 합니다');
  assert.equal(u['conflicts/company'].got, '삼성검수주식회사');
  assert.equal(u['conflicts/company'].had, '삼성검수주식회사표자');
  assert.equal(r.conflicts, 2);
});

test('★★ 출처를 모르는 옛 칸도 안 덮는다 — 모르면 사람이 본다', async () => {
  const 자리 = 잘못읽힌회사({});          /* src 가 아예 없다(옛 기록) */
  const { 쓴것 } = await 보내기(자리, 바르게읽음);
  const u = 합친쓰기(쓴것);
  assert.equal(u.company, undefined);
  assert.ok(u['conflicts/company']);
});

test('★★ 사진이 없는 보내기는 아무것도 덮지 않는다 — 열쇠가 없으면 판별할 수 없다', async () => {
  const { 쓴것 } = await 보내기(잘못읽힌회사(), 바르게읽음, {});
  const u = 합친쓰기(쓴것);
  assert.equal(u.company, undefined);
});

test('★ 빈 칸 채우기는 그대로다 — 이 일의 본래 값이다', async () => {
  const { 쓴것 } = await 보내기({ bizno: '316-81-03842' }, 바르게읽음);
  const u = 합친쓰기(쓴것);
  assert.equal(u.company, '삼성검수주식회사');
  assert.equal(u['src/company'], 그사진열쇠);
});

test('★ 값이 «같으면» 한 글자도 안 쓴다 — 요금이 는다', async () => {
  const 자리 = { bizno: '316-81-03842', company: '삼성검수주식회사', ceo: '안용운',
                 src: { company: 그사진열쇠, ceo: 그사진열쇠 } };
  const { 쓴것 } = await 보내기(자리, 바르게읽음);
  const u = 합친쓰기(쓴것);
  assert.equal(u.company, undefined);
  assert.equal(u.ceo, undefined);
});

/* ══════ ④ 모아 보는 화면 — 찾아가는 길 ═══════════════════════════════ */

const 화면 = stripComments(CARDS);

test('★★★ 목록 위에 «띠»가 선다 — 회사를 하나씩 열어야 보이면 사실상 못 쓴다', () => {
  /* ⚠ «사슬»을 통째로 본다 — 목록 → coBarsHtml → coClashBarHtml.
     한 토막만 보면 사슬이 끊겨도 통과한다(되돌림 검사에서 실제로 못 잡았다). */
  assert.match(stripJs(cutFn(CARDS, 'function coListHtml(') || ''), /\$\{coBarsHtml\(\)\}/,
    '★★★ 목록이 띠를 안 부르면, 띠를 아무리 잘 만들어도 화면에 안 뜹니다');
  assert.match(stripJs(cutFn(CARDS, 'function coBarsHtml(') || ''), /\$\{coClashBarHtml\(\)\}/,
    '★★★ 4,100곳 가운데 어디가 어긋났는지 알 길이 없으면, 고치는 단추가 있어도 못 씁니다');
  const bar = stripJs(cutFn(CARDS, 'function coClashBarHtml(') || '');
  assert.ok(bar, 'coClashBarHtml 이 없습니다');
  assert.match(bar, /if\s*\(!list\.length\)\s*return\s*''/,
    '★★ 0칸이면 띠를 아예 안 띄워야 합니다 — 늘 뜨는 띠는 눈이 배경으로 배웁니다');
  assert.match(bar, /openCoClash\(\)/, '★ 눌러서 볼 길이 없습니다');
});

test('★★ 「다시 읽은 것」과 「다른 서류」를 갈라 보인다 — 섞으면 급한 것이 묻힌다', () => {
  const html = stripJs(cutFn(CARDS, 'function coClashHtml(') || '');
  assert.ok(html, 'coClashHtml 이 없습니다');
  assert.match(html, /same\.length/);
  assert.match(html, /other\.length/);
});

test('★★ 갈래를 «출처»로 가른다 — 눈짐작이 아니다', () => {
  const list = stripJs(cutFn(CARDS, 'function coClashList(') || '');
  assert.ok(list, 'coClashList 가 없습니다');
  assert.match(list, /coAttachDocKey\(/, '★★ 사진 열쇠를 사진첩과 «같은 규칙»으로 지어야 합니다');
  assert.match(list, /from\s*===\s*dk/, '★★ 「지금 값이 바로 이 사진에서 왔는가」가 갈래의 잣대입니다');
});

test('★★★ 「그냥 둠」이 있다 — 없으면 어긋난 칸이 영영 줄지 않는다', () => {
  const fn = stripJs(cutFn(CARDS, 'async function coKeepOld(') || '');
  assert.ok(fn, '★★★ coKeepOld 가 없습니다 — 「지금 값이 맞다」를 말할 길이 없습니다');
  assert.match(fn, /conflicts\/\$\{k\}`\]\s*=\s*null/, '어긋남 줄을 치워야 합니다');
  assert.match(fn, /src\/\$\{k\}`\]\s*=\s*\(window\.PuDocFile/,
    '★★ 도장을 안 찍으면 다음에 같은 서류가 와서 또 묻습니다');
  assert.ok(!new RegExp('coInfo/\\$\\{key\\}/\\$\\{k\\}`\\]\\s*=\\s*c\\.').test(fn),
    '★★★ 「그냥 둠」이 값을 바꾸면 안 됩니다 — 그 단추의 뜻은 「안 바꾼다」입니다');
});

test('★★ 고치기·그냥 둠이 «회사를 받는다» — 모아 보는 창은 여러 회사를 한 줄씩 늘어놓는다', () => {
  assert.match(화면, /async function coTakeNewFor\(key, k, opt\)/,
    '★★ state.coPick 만 보면 모아 보는 창에서 누를 수가 없습니다');
  assert.match(화면, /async function coTakeNew\(k\)\s*\{\s*return coTakeNewFor\(/,
    '★★ 두 벌로 베끼면 한쪽만 고쳐져 「상세에서는 되는데 모아 보기는 안 된다」가 됩니다');
});

test('★ 한 줄에 한 칸이다 — 21줄이 42줄이 되면 한 화면에 안 들어온다', () => {
  const css = CARDS.match(/\.coclashrow\{[^}]*\}/);
  assert.ok(css, '.coclashrow 모양이 없습니다');
  assert.match(css[0], /display:flex/, '★ 세로로 쌓으면 표가 두 배로 길어집니다(2026-08-30 대표 지시)');
  assert.match(CARDS, /\.coclashrow \.cv \.now\{[^}]*text-overflow:ellipsis/,
    '★ 넘치는 값을 안 자르면 한 줄이 무너집니다');
});

test('★ 줄에서 그 서류 «원본»을 열 수 있다 — 눈으로 보고 누르셔야 한다', () => {
  const row = stripJs(cutFn(CARDS, 'function coClashRowHtml(') || '');
  assert.match(row, /openCoDoc\(/, '★ 원본을 못 보면 어느 쪽이 맞는지 가릴 수가 없습니다');
});
