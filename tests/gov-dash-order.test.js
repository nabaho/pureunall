'use strict';
/* ══════ 사업장 차례 — 새것 위로 · 끌어서 옮기기 ══════
   실행: node --test tests/*.test.js

   ■ 무엇을 바라셨나 (대표 지시 2026-09-09)
     「새로 입력된건은 최상위에 올라오게 하고 기업순서를 바꿀수 있게해달라.
       마우스로 드래그해서 위아래로 조정가능하게 해라.」
     승인 목업 docs/mockups/dash-order-drag.html — 「①㉮ ②㉮」.
     ① 새것은 ⭐즐겨찾기·마감임박은 그대로 두고 그 아래(가나다 자리)에서 맨 앞으로.
     ② 끌어서 정한 차례는 «사람마다 따로» — 내가 옮긴 것이 남의 화면을 안 바꾼다.

   ★ 여기서 못 박는 것
     · 손으로 정한 차례가 «즐겨찾기보다도 앞» — 안 그러면 끌어도 도로 튕겨
       내려가 「끌었는데 안 바뀌었다」가 된다.
     · 새것은 코일 것을 기준 하나로 판정한다(coIsNew 와 같은 자리) — 「NEW」
       딱지는 붙었는데 자리는 안 올라오는 어긋남을 막는다.
     · 사업장 차례는 «내 uid» 밑에만 쓰고 읽는다(다른 사람 것은 규칙이 막는다).
     · 이 값을 잃어도 손해가 없다 — ①㉮ 규칙으로 돌아갈 뿐이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');
const RULES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;

function fnSrc(name) {
  const m = new RegExp('(?:^|\\n)((?:async )?function ' + name + '\\s*\\()').exec(SRC);
  assert.ok(m, '함수를 찾을 수 없습니다: ' + name);
  const start = m.index + (m[0].startsWith('\n') ? 1 : 0);
  let i = SRC.indexOf('{', start), d = 0, k = i;
  while (k < SRC.length) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) break; }
    k++;
  }
  return SRC.slice(start, k + 1);
}

/* 진짜 견주는 함수(dashCompareItems)와 그 밑돌(coIsNew·coNewDays·daysSince)을 태운다.
   ⚠ todayStr 은 흉내로 준다 — 실제 날짜에 검사가 매인 채로 굳으면 내일 저절로 깨진다. */
function box(today) {
  const b = {
    console, String, Object, Array, Number, Math, Date, isNaN, JSON,
    todayStr: () => today || '2026-09-09',
    NEW_DAYS: 3,
  };
  vm.createContext(b);
  vm.runInContext(
    ['daysSince', 'coIsNew', 'coNewDays', 'dashCompareItems'].map(fnSrc).join('\n')
    + '\nvar NEW_DAYS = 3;', b);
  return b;
}
function item(id, name, opt) {
  opt = opt || {};
  return {
    co: Object.assign({ id, name, createdAt: opt.createdAt, typeAddedAt: opt.typeAddedAt || {},
      types: opt.types || [], endedTypes: opt.endedTypes || {} }, {}),
    risk: { minDiff: opt.minDiff != null ? opt.minDiff : 9999 },
  };
}
function sorted(b, arr, favs, dashOrder) {
  return [...arr].sort((a, c) => b.dashCompareItems(a, c, favs || [], dashOrder || {}))
    .map(x => x.co.name);
}

test('새것이 «가나다」를 대신한다 — 등록일이 최근일수록 위', () => {
  const b = box('2026-09-09');
  const arr = [
    item('c1', '가나다상사', { createdAt: '2026-08-01' }),   // 옛것
    item('c2', '태양농산', { createdAt: '2026-09-09' }),     // 오늘 등록 — 맨 위
    item('c3', '나무들', { createdAt: '2026-09-08' }),       // 어제 등록
  ];
  assert.deepEqual(sorted(b, arr), ['태양농산', '나무들', '가나다상사'],
    '★ 최근 것이 위로 안 올라옵니다');
});

test('사업장은 옛것이어도 «컨설팅 종류가 새로 붙으면» 새것으로 친다', () => {
  const b = box('2026-09-09');
  const arr = [
    item('c1', '옛사업장(새 종류)', { createdAt: '2020-01-01', types: ['t1'], typeAddedAt: { t1: '2026-09-09' } }),
    item('c2', '중간사업장', { createdAt: '2026-06-01' }),
  ];
  assert.equal(sorted(b, arr)[0], '옛사업장(새 종류)',
    '★ 사업장 등록일만 보고 «사업이 새로 붙은 것»을 놓칩니다');
});

test('★ 끝난 컨설팅이 새로 붙어도 새것으로 안 친다', () => {
  /* ⚠ 이름을 «일부러» 가나다 뒤쪽으로 준다 — 새것 취급하는 잘못이 있으면 알파벳
     차례를 뚫고 앞으로 튀어나와 이 검사가 잡아낸다. 둘 다 새것이 아니면(올바르면)
     가나다만 남아 '가나다곳' 이 그대로 앞이어야 한다. */
  const b = box('2026-09-09');
  const arr = [
    item('c1', '하나끝난것', { createdAt: '2020-01-01', types: ['t1'], endedTypes: { t1: 1 }, typeAddedAt: { t1: '2026-09-09' } }),
    item('c2', '가나다곳', { createdAt: '2026-01-01' }),
  ];
  assert.equal(sorted(b, arr)[0], '가나다곳',
    '★ 끝난 컨설팅까지 «새로 붙었다」고 셉니다 — 가나다를 뚫고 앞으로 튀어나옵니다');
});

test('⭐ 즐겨찾기가 새것보다 위 — 손을 안 댄 자리에서는 즐겨찾기가 이긴다', () => {
  const b = box('2026-09-09');
  const arr = [
    item('c1', '새것', { createdAt: '2026-09-09' }),
    item('c2', '즐겨찾기곳', { createdAt: '2020-01-01' }),
  ];
  assert.equal(sorted(b, arr, ['c2'])[0], '즐겨찾기곳',
    '★ 즐겨찾기가 새것 밑으로 밀렸습니다');
});

test('★ 손으로 정한 차례는 «즐겨찾기보다도 위» — 안 그러면 끌어도 튕겨 돌아간다', () => {
  const b = box('2026-09-09');
  const arr = [
    item('c1', '즐겨찾기곳', {}),
    item('c2', '손으로올린곳', {}),
  ];
  const order = { c2: 0 };   // c2 를 손으로 맨 위로 옮겼다
  assert.equal(sorted(b, arr, ['c1'], order)[0], '손으로올린곳',
    '★ 즐겨찾기가 손으로 정한 차례를 도로 밀어냅니다 — 끌어도 안 바뀐 것처럼 보입니다');
});

test('손으로 정한 것끼리는 «숫자 차례»대로', () => {
  const b = box('2026-09-09');
  const arr = [item('c1', '가'), item('c2', '나'), item('c3', '다')];
  const order = { c1: 2, c2: 0, c3: 1 };
  assert.deepEqual(sorted(b, arr, [], order), ['나', '다', '가']);
});

test('손댄 것과 안 댄 것이 섞이면 손댄 것이 위 — 절반만 옮겨도 자리가 안 어긋난다', () => {
  const b = box('2026-09-09');
  const arr = [
    item('c1', '안 댄 곳', { createdAt: '2026-09-09' }),   // 새것이지만 손 안 댐
    item('c2', '손댄 곳', {}),
  ];
  const order = { c2: 5 };
  assert.equal(sorted(b, arr, [], order)[0], '손댄 곳',
    '★ 손 안 댄 새것이 손댄 것보다 위로 갑니다');
});

test('마감이 급한 곳은 «새것·손댐 둘 다 없을 때만» 순서에 낀다', () => {
  const b = box('2026-09-09');
  const arr = [
    item('c1', '마감급함', { minDiff: 2 }),
    item('c2', '마감여유', { minDiff: 40 }),
  ];
  assert.deepEqual(sorted(b, arr), ['마감급함', '마감여유']);
});

/* ══════ 끌기는 «묶음 안에서만» ══════ */

function dcardDragBlock() {
  const start = SRC.indexOf("qa('#dashList .dcard').forEach(card=>{");
  assert.ok(start >= 0, '★ 카드 묶기(드래그) 코드를 찾을 수 없습니다');
  let i = SRC.indexOf('{', start), d = 0, k = i;
  while (k < SRC.length) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) break; }
    k++;
  }
  return SRC.slice(start, k + 1);
}

test('★ 카드에 손잡이(끌기)가 있고, 묶음 밖으로는 못 끈다', () => {
  assert.match(SRC, /class="dcard-grip"/, '★ 손잡이가 화면에 없습니다');
  assert.match(SRC, /card\.draggable\s*=\s*true/, '★ 카드가 끌리지 않습니다');
  const block = dcardDragBlock();
  /* ⚠ mySection·section 을 «따로» 짚는다 — 둘 다 같은 모양의 줄이라 하나만 지워도
     다른 쪽 한 줄이 여전히 걸려 정규식이 통째로는 못 알아챈다(그렇게 새는 것을
     실제로 보고 고쳤다). ondragover(끄는 동안)·ondrop(놓는 순간) 각각 확인한다. */
  assert.match(block, /card\.ondragover=e=>\{[\s\S]*?closest\('\.dash-section'\)!==mySection\)return;/,
    '★ 끄는 동안(ondragover) 묶음이 다르면 막는 줄이 없습니다 — 담당·마감 구간을 넘나들 수 있습니다');
  assert.match(block, /card\.ondrop=e=>\{[\s\S]*?closest\('\.dash-section'\)!==section\)return;/,
    '★ 놓는 순간(ondrop) 묶음이 다르면 막는 줄이 없습니다 — 담당·마감 구간을 넘나들 수 있습니다');
});

test('★ 옮긴 뒤 그 묶음 전체를 «다시 매긴다» — 일부만 적으면 다음 렌더에서 어긋난다', () => {
  assert.match(SRC, /qa\('\.dcard',section\)\.forEach\(\(c,i\)=>\{\s*map\[c\.dataset\.coid\]=i;\s*\}\)/,
    '★ 묶음 안 전체를 다시 안 매깁니다');
});

test('저장은 «더하기»(update) — set 을 쓰면 다른 묶음 차례를 지운다', () => {
  const fn = fnSrc('saveDashOrder');
  assert.match(fn, /\.update\(map\)/, '★ update 대신 다른 방법으로 씁니다');
  assert.doesNotMatch(fn, /\.set\(map\)/, '★ set 을 쓰면 다른 묶음의 차례가 사라집니다');
});

/* ══════ 사람마다 따로 (②㉮) ══════ */

test('★ 서버에는 «내 uid» 밑에만 쓰고 읽는다', () => {
  const sub = fnSrc('subscribeDashOrder');
  assert.match(sub, /'data\/gov_dash_order\/'\s*\+\s*_fbAuthUid/,
    '★ 내 uid 로 자리를 안 가릅니다 — 남의 차례를 읽거나 덮어씁니다');
  const save = fnSrc('saveDashOrder');
  assert.match(save, /'data\/gov_dash_order\/'\s*\+\s*_fbAuthUid/,
    '★ 저장할 때 내 uid 자리로 안 씁니다');
});

test('★ 아직 로그인 정보(uid)가 없으면 조용히 넘어간다 — 남의 자리를 건드리지 않는다', () => {
  const sub = fnSrc('subscribeDashOrder');
  assert.match(sub, /if\(!FB_READY\|\|!_fbDB\|\|!_fbAuthUid\)return;/,
    '★ uid 가 비었을 때를 안 막습니다');
});

test('규칙: gov_dash_order 는 «본인 uid» 만 읽고 쓴다', () => {
  const r = RULES.data && RULES.data.gov_dash_order;
  assert.ok(r, '★ data/gov_dash_order 규칙이 없습니다 — 이름 없는 자리로 떨어집니다');
  const uidRule = r.$uid;
  assert.ok(uidRule, '★ $uid 자리가 없습니다 — 전 직원이 서로의 차례를 봅니다');
  assert.match(String(uidRule['.read']), /auth\.uid === \$uid/, '★ 남이 내 차례를 읽을 수 있습니다');
  assert.match(String(uidRule['.write']), /auth\.uid === \$uid/, '★ 남이 내 차례를 바꿀 수 있습니다');
});

/* ══════ 값이 사라져도 손해가 없다 ══════ */

test('이 값이 없으면 그냥 ①㉮ 규칙(새것 먼저·가나다)으로 돌아간다 — 백업 목록에 없다', () => {
  const bk = (SRC.match(/const BK_KEYS=\[[^\]]*\]/) || [''])[0];
  assert.doesNotMatch(bk, /p_dashOrder/,
    '★ 백업 목록에 들어갔습니다 — 잃어도 손해 없는 값인데 백업 부피만 키웁니다');
});

test('기기에 저장해 둔 지난 차례를 서버가 붙기 전에도 쓴다', () => {
  assert.match(SRC, /let _dashOrder=getDashOrderLocal\(\);/,
    '★ 시작값이 빈 채로 있습니다 — 서버가 늦게 붙으면 그사이 지난 차례가 안 보입니다');
});
