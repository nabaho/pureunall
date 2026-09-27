'use strict';
/* 기업정보함에서 «여러 곳을 한 번에» (대표 지시 2026-09-13)
 *
 *   「기업정보함에서 찾을 수도 있다. 명함왼쪽에 ㅁ 를 체크하고 선택해서 한번에 선택할 수
 *    있게 해달라. 그리고 캡쳐2에는 필터기능도 필요할 수 있다.
 *    그리고 팝업이 전부 안보인다 팝업에 내용을 확인해야 선택할 수 있다.」
 *
 * ★ 열여섯 곳 스무 곳을 한 곳씩 눌러 넣으면 그 자체가 하루 일이다.
 * ⚠ 그래도 «자동으로 만들지» 않는다 — 무엇을 몇 곳 만드는지 보여 주고 사람이 누른다.
 *   여기서 만든 상호가 설립합의서·정관·출연확인서에 그대로 나간다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

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
/* ⚠ 소스를 글자로 볼 때는 주석을 먼저 걷는다 — 이 파일의 주석이 지시를 그대로 인용하고 있어
   그냥 훑으면 그 «글»이 코드로 읽힌다(2026-09-13 에 하루 네 번 걸렸다). */
const 코드만 = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');
const grabCode = (n) => 코드만(grabFn(n));

/* ══ ① 팝업이 «보여야» 고른다 ═══════════════════════════════════════ */

/* ⚠ 반드시 CARD_TARGETS «안»에서만 찾는다 — 파일 앞쪽 EVENT_KINDS 에도 officer:{ 가 있어
   온 파일에서 찾으면 엉뚱한 데를 잡는다(2026-09-13 에 실제로 그랬다). */
/* 대상들의 «시작 자리»를 먼저 모두 찾아 두고, 이웃 사이만 떼어 온다.
   ⚠ 「다음 대상을 찾아 거기까지」로 하면 사이에 낀 주석 때문에 한 칸씩 밀려
     엉뚱한 대상의 설정을 제 것으로 읽는다(2026-09-13 에 실제로 그랬다). */
const 대상자리 = (() => {
  /* ⚠⚠ 주석을 «먼저» 걷는다. 대상들 사이에 낀 주석이 「multi:true」를 말하고 있어,
     그냥 자르면 그 글이 «앞 대상»의 설정으로 읽힌다 — 2026-09-13 하루에 다섯 번째다.
     걷어 낸 자리를 빈칸으로 채워 글자 자리는 그대로 두어야 자리 계산이 안 밀린다. */
  const 블록 = SRC.slice(SRC.indexOf('var CARD_TARGETS='), SRC.indexOf('function openCardPick'))
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const out = [];
  const re = /\n {2}([a-z]+):\{/g;
  let m;
  while ((m = re.exec(블록))) out.push({ name: m[1], at: m.index });
  return { 블록: 블록, 목록: out };
})();
function 고르기대상(name) {
  const i = 대상자리.목록.findIndex((x) => x.name === name);
  assert.ok(i >= 0, 'CARD_TARGETS 에 ' + name + ' 이 없습니다.');
  const 끝 = (i + 1 < 대상자리.목록.length) ? 대상자리.목록[i + 1].at : 대상자리.블록.length;
  return 대상자리.블록.slice(대상자리.목록[i].at, 끝);
}

test('★★ ① 참여사업장 고르기 창이 칸 일곱을 담을 만큼 넓다 — 소재지가 화면 밖이면 못 고른다', () => {
  const w = Number((/width:(\d+)/.exec(고르기대상('site')) || [])[1]);
  assert.ok(w >= 1100, '★ ' + w + 'px 로는 소재지가 잘립니다.');
  /* 편집 창에서 당겨오는 길도 같은 폭이어야 한다 — 같은 표를 그린다 */
  assert.equal(Number((/width:(\d+)/.exec(고르기대상('siteedit')) || [])[1]), w,
    '★ 두 길의 폭이 다릅니다 — 같은 표인데 한쪽만 잘립니다.');
});

test('★★ ② 목록이 창 높이를 «제대로» 쓴다 — 아래가 잘리면 보고 고를 수가 없다', () => {
  const fn = grabCode('openCardPick');
  const m = /id="cardbody"[^>]*max-height:(\d+)vh/.exec(fn);
  assert.ok(m, '목록 높이 설정을 못 찾았습니다.');
  assert.ok(Number(m[1]) >= 60,
    '★ 목록이 ' + m[1] + 'vh 뿐입니다 — 창은 88vh 인데 아래가 비고 목록은 잘립니다.');
});

/* ══ ② 거르기 ═════════════════════════════════════════════════════ */

test('★ ③ 거르는 딱지가 있다 — 종류·사업자번호 있음·소재지 있음', () => {
  const fn = grabCode('cardFilterBar');
  ['biz', 'card', 'bz', 'ad'].forEach((k) => {
    assert.ok(fn.indexOf("'" + k + "'") >= 0, '거르기 딱지가 없습니다: ' + k);
  });
  assert.match(grabCode('setCardOnly'), /_cardOnly===v\)\?'':v/,
    '★ 딱지를 다시 눌러 끌 수 없습니다 — 한 번 켜면 못 돌아옵니다.');
});

test('★★ ④ 소재지로도 찾아진다 — 「아산시」로 그 지역 회사를 모으는 것이 실제로 하는 일이다', () => {
  const fn = grabCode('renderCardPick');
  assert.match(fn, /norm\(e\.ad\|\|''\)\.indexOf\(norm\(q\)\)/,
    '★ 소재지를 안 뒤집니다 — 지역으로 모을 수가 없습니다.');
});

test('★ ⑤ 몇 건이 남았는지 적는다 — 걸러 놓고 「이것뿐인가」 하고 잘못 읽지 않게', () => {
  assert.match(grabCode('renderCardPick'), /cardcnt/, '남은 건수를 안 적습니다.');
});

/* ══ ③ 여러 곳을 한 번에 ═══════════════════════════════════════════ */

test('★★ ⑥ 참여사업장 고르기에만 체크상자가 선다 — 한 칸 채우는 자리엔 없다', () => {
  assert.match(고르기대상('site'), /multi:true/, '★ 참여사업장에 여러 고르기가 없습니다.');
  ['info', 'newfund', 'siteedit', 'officer'].forEach((k) => {
    assert.ok(고르기대상(k).indexOf('multi:true') < 0,
      '★ 한 칸 채우는 자리에 체크상자가 생겼습니다: ' + k + ' — 거기서는 한 벌만 넣습니다.');
  });
});

test('★★ ⑦ 이미 참여 중인 회사는 «체크를 꺼 둔다» — 두 번 들어가면 출연금이 두 번 세어진다', () => {
  const fn = grabCode('renderCardPick');
  assert.match(fn, /bizDupOf\(/, '★ 이미 있는지 안 봅니다.');
  assert.match(fn, /dup\?' disabled/, '★ 이미 있는 것을 고를 수 있게 두었습니다.');
});

test('★★ ⑧ 사업자등록증 여러 장 길과 «같은 규칙»으로 견준다 — 두 길이 다르면 한쪽만 막힌다', () => {
  assert.match(grabCode('renderCardPick'), /bizDupOf\(\{name:r\.c,biz_no:e\.bz\}/,
    '★ 겹침 판정을 따로 짰습니다 — bizDupOf 하나를 써야 합니다.');
});

test('★★ ⑨ 자동으로 만들지 «않는다» — 무엇을 몇 곳 만드는지 보여 주고 사람이 누른다', () => {
  const fn = grabCode('applyCardsMulti');
  assert.match(fn, /confirmM\(/, '★ 묻지 않고 만듭니다 — 그 상호가 서식에 그대로 나갑니다.');
  assert.match(fn, /곳을 참여사업장으로 만들까요/, '무엇을 하는지 말하지 않습니다.');
  assert.match(fn, /출연 약정액/, '★ 출연금이 안 들어온다는 말이 없습니다 — 들어온 줄 알고 넘어갑니다.');
});

test('★★ ⑩ 한 곳씩 «차례로» 읽는다 — 한꺼번에 부르면 기업정보함에 스무 번이 동시에 나간다', () => {
  const fn = grabCode('applyCardsMulti');
  /* ⚠ 「reduce 를 쓴다」만 보면 «빈 배열»로 돌려도 통과한다 — 고른 것을 도는지 본다 */
  assert.match(fn, /rows\.reduce\(function\(p,r\)\{/,
    '★ 고른 것(rows)을 돌지 않습니다 — 아무것도 안 만들어도 통과합니다.');
  assert.match(fn, /Promise\.resolve\(\)\)/, '차례로 잇지 않습니다.');
  assert.ok(fn.indexOf('Promise.all(') < 0, '★ 한꺼번에 부릅니다.');
});

test('★★ ⑪ 만든 뒤 «다시 읽는다» — 안 그러면 새 사업장도, 지자체도 화면에 안 나타난다', () => {
  const fn = grabCode('applyCardsMulti');
  assert.match(fn, /S\.sitesFor=null/, '★ 참여사업장을 다시 안 읽습니다.');
  assert.match(fn, /_allSites=null/, '★ 지자체 셈을 다시 안 합니다 — 새 회사의 지자체가 안 뜹니다.');
  assert.match(fn, /_allSitesTried=false/, '★ 다시 읽기를 켜 두지 않아 영영 옛 값입니다.');
});

test('★ ⑫ 기금이 바뀌었으면 만들지 않는다 — 엉뚱한 기금에 사업장이 들어간다', () => {
  assert.match(grabCode('applyCardsMulti'), /S\.fundId!==_cardPick\.fid/,
    '★ 고르는 사이 기금이 바뀐 것을 안 봅니다.');
});

test('★ ⑬ 한 곳만 넣는 「추가」 단추는 그대로 둔다 — 값을 보고 고칠 수 있는 길이다', () => {
  assert.ok(SRC.indexOf('function applyCard(') >= 0, '★ 한 곳 넣는 길이 사라졌습니다.');
  assert.match(grabCode('renderCardPick'), /applyCard\(/, '줄마다 있던 단추가 없어졌습니다.');
});

test('★★ ⑭ 고른 수를 세어 보여 주고, 없으면 단추를 잠근다', () => {
  const fn = grabCode('cardSelCount');
  assert.match(fn, /\.cardsel/, '고른 것을 세지 않습니다.');
  assert.match(fn, /b\.disabled=!n/, '★ 아무것도 안 골랐는데 누를 수 있습니다.');
  assert.match(grabCode('cardPickAll'), /if\(!x\.disabled\)/,
    '★ 「모두」가 이미 있는 회사까지 켭니다 — 두 번 들어갑니다.');
});
