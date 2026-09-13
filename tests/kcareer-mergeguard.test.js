'use strict';
/* 「합치기」 안전장치 (대표 제보 2026-09-12 — 실제로 서류 둘을 잃고 나서 만들었다)
   ────────────────────────────────────────────────────────────────────────
   ■ 실제로 잃은 것
       위촉장2019-016  교육부 · 학교 전담 노무사(삽교고등학교)          · 중등직업교육 2019-0299
       위촉장2019-017  교육부 · 학교 전담 노무사(한국식품마이스터고등학교) · 중등직업교육 2019-0301
     «서로 다른 학교»인데 「3건 완전일치」로 묶여 합쳐졌고, 한쪽이 사라졌다.

   ■ 까닭 둘이 겹쳤다
     ① dupKey 가 이름을 «앞 6자»만 본다 → 둘 다 「학교전담노」로 같아 보였다
     ② 합치기가 `if(!prim[k]&&other[k])` 라 «기준에 값이 있으면» 다른 값을 말없이 버린다

   ■ 잣대 — 한 줄로
     **한쪽이 다른 쪽을 품고 있으면 같은 서류, 아니면 다른 서류다.**
       · 「제5기 충청남도 노사분쟁 조정·중재단 위원」
         ⊂ 「2026제 5기 충청남도 노사분쟁 조정,중재단 위원 위촉장」 → 같은 서류(허용)
       · 「학교 전담 노무사(삽교고등학교)」
         ⊄ 「학교 전담 노무사(한국식품마이스터고등학교)」            → 다른 서류(막음)
     ⚠ 날짜는 «품는 사이»를 보지 않는다 — 한 서류에 발급일이 둘일 수 없다.

   ■ 고장넣기 21개 중 20개 걸림.
     ⚠ 안 걸린 하나는 explain 의 `if (!res || res.ok) return '';` 에서 `|| res.ok` 를 뺀 것인데,
       ok 인 결과는 conflicts 가 «빈 배열»이라 어느 쪽이든 돌려주는 말이 똑같다(같은 코드다).
       억지 검사를 지어 붙이지 않고 왜 못 잡는지 여기 적어 둔다.

   ⚠ dupKey 는 손대지 않았다(CLAUDE.md 경고 — 사슬을 바꾸면 dup_dismiss 기억이 어긋난다).
     열쇠는 «찾는» 자이고 이 파일은 «막는» 자다. 찾는 자가 헐거워도 서류는 안 잃는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../js/kcareer-mergeguard.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

/* ⚠ 「앞 N자」로 자르지 않는다 — 함수가 길어지면 봐야 할 줄이 창 밖으로 밀려
   «없는데도 통과»한다(2026-09-12 에 실제로 옆 검사가 그렇게 깨졌다).
   중괄호를 세어 함수가 끝나는 자리까지 본다. */
function mergeIntoSource() {
  const i = SRC.indexOf('async function mergeInto(');
  assert.ok(i > 0, 'mergeInto 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail('mergeInto 의 끝을 못 찾았습니다');
}

/* ══════ ★ 실제로 잃은 그 건 ══════ */

test('★★★ 서로 다른 학교를 합치지 못하게 막는다 — 실제로 잃은 그 건', () => {
  const 삽교 = { id: '위촉장2019-016', type: '위촉장', org: '교육부',
    titleVal: '학교 전담 노무사(삽교고등학교)', issueDate: '2019.05.08',
    note: '중등직업교육 2019-0299' };
  const 마이스터 = { id: '위촉장2019-017', type: '위촉장', org: '교육부',
    titleVal: '학교 전담 노무사(한국식품마이스터고등학교)', issueDate: '2019.05.08',
    note: '중등직업교육 2019-0301' };
  const r = G.check([삽교, 마이스터]);
  assert.equal(r.ok, false, '★★★ 서로 다른 학교의 위촉장을 합치게 둡니다 — 한쪽이 사라집니다');
  /* 무엇이 다른지 «값을 그대로» 말해야 한다 — 「다릅니다」만으로는 판단할 수 없다 */
  const 말 = G.explain(r);
  assert.match(말, /삽교고등학교/, '어느 값이 다른지 밝혀야 합니다');
  assert.match(말, /한국식품마이스터고등학교/, '양쪽 값을 다 보여 줘야 합니다');
  assert.match(말, /위촉내용/, '어느 칸이 다른지 밝혀야 합니다');
});

/* ══════ 허용해야 하는 것 — 막기만 하면 쓸모가 없다 ══════ */

test('★★★ 스캔이 만든 줄과 제대로 된 줄은 «같은 서류»다 — 합쳐져야 한다', () => {
  /* 스캔 줄은 파일이름이 통째로 들어가 «더 길» 뿐이다 */
  const 제대로 = { id: 'A', org: '충청남도', titleVal: '제5기 충청남도 노사분쟁 조정·중재단 위원',
    issueDate: '2026.07.30' };
  const 스캔 = { id: 'B', org: '', titleVal: '2026제 5기 충청남도 노사분쟁 조정,중재단 위원 위촉장',
    year: '2026' };
  const r = G.check([제대로, 스캔]);
  assert.equal(r.ok, true,
    '★ 같은 서류를 막으면 중복을 영영 못 정리합니다: ' + G.explain(r));
});

test('★ 기관 이름이 줄었다 늘었다 해도 같은 서류로 본다', () => {
  /* 「충청남도」 ↔ 「충청남도청」 처럼 한쪽이 다른 쪽을 품는다 */
  const r = G.check([{ id: 'a', org: '충청남도', titleVal: '위원' },
                     { id: 'b', org: '충청남도청', titleVal: '위원' }]);
  assert.equal(r.ok, true, '한쪽이 품는 기관 이름을 다르다고 보면 안 됩니다');
});

test('빈 칸은 «다름»이 아니다 — 채워 주는 것이 합치기의 뜻이다', () => {
  const r = G.check([{ id: 'a', org: '충청남도', titleVal: '위원', issueDate: '2020.01.01' },
                     { id: 'b', org: '', titleVal: '', issueDate: '' }]);
  assert.equal(r.ok, true, '★ 빈 칸을 다르다고 보면 아무것도 못 합칩니다');
});

test('★★ 발급기관이 «아주 다르면» 막는다 — 발급기관을 안 보면 남의 기관 위촉장이 합쳐진다', () => {
  const r = G.check([{ id: 'a', org: '충청남도교육청', titleVal: '인사위원회 위원' },
                     { id: 'b', org: '고용노동부', titleVal: '인사위원회 위원' }]);
  assert.equal(r.ok, false, '★★ 기관이 달라도 합치게 둡니다 — 다른 기관의 위촉장입니다');
  assert.match(G.explain(r), /발급기관/);
});

test('★★ 두 줄의 발급일이 «같으면» 다툼이 아니다 — 같은 값을 둘로 세면 아무것도 못 합친다', () => {
  /* ⚠ 값을 모을 때 겹치는 것을 걸러야 한다. 안 걸러 「값이 둘」로 세면
     날짜가 «똑같은» 진짜 중복까지 전부 막혀 중복관리가 통째로 멈춘다. */
  const r = G.check([{ id: 'a', org: '충청남도', titleVal: '조정위원', issueDate: '2026.07.30' },
                     { id: 'b', org: '충청남도', titleVal: '2026 충청남도 조정위원 위촉장',
                       issueDate: '2026.07.30' }]);
  assert.equal(r.ok, true, '★★ 같은 날짜를 다르다고 봅니다: ' + G.explain(r));
});

/* ══════ 날짜 ══════ */

test('★★ 발급일이 다르면 «다른 서류»다 — 한 서류에 발급일이 둘일 수 없다', () => {
  const r = G.check([{ id: 'a', org: '충청남도', titleVal: '위원', issueDate: '2020.01.01' },
                     { id: 'b', org: '충청남도', titleVal: '위원', issueDate: '2022.03.03' }]);
  assert.equal(r.ok, false, '★★ 발급일이 다른 것을 합치게 둡니다');
  assert.match(G.explain(r), /발급일/);
});

test('★ 날짜는 «품는 사이»를 보지 않는다 — 2019.05.08 과 2019.05.0 은 같은 날이 아니다', () => {
  const r = G.check([{ id: 'a', issueDate: '2019.05.08' }, { id: 'b', issueDate: '2019.05.0' }]);
  assert.equal(r.ok, false,
    '★ 날짜에 품는 사이를 쓰면 잘린 날짜를 같은 날로 봅니다');
});

test('위촉시작·종료·번호도 본다', () => {
  assert.equal(G.check([{ id: 'a', periodStart: '2020.01.01' },
                        { id: 'b', periodStart: '2021.01.01' }]).ok, false, '위촉시작');
  assert.equal(G.check([{ id: 'a', periodEnd: '2020.12.31' },
                        { id: 'b', periodEnd: '2021.12.31' }]).ok, false, '위촉종료');
  assert.equal(G.check([{ id: 'a', num: '제3016호' }, { id: 'b', num: '제9999호' }]).ok, false, '번호');
});

/* ══════ 다른 화면의 칸도 본다 ══════ */

test('자격증·수료증(title)·학력(school·major)·증명서(kind)도 가린다', () => {
  assert.equal(G.check([{ id: 'a', title: '공인노무사 자격증' },
                        { id: 'b', title: '경영지도사 자격증' }]).ok, false, '자격증 이름');
  assert.equal(G.check([{ id: 'a', school: '영남대학교' },
                        { id: 'b', school: '고려대학교' }]).ok, false, '학교');
  assert.equal(G.check([{ id: 'a', major: '법학과' }, { id: 'b', major: '경영학과' }]).ok, false, '전공');
  assert.equal(G.check([{ id: 'a', kind: '경력증명서' },
                        { id: 'b', kind: '재직증명서' }]).ok, false, '증명서 종류');
});

/* ══════ 셋 이상 ══════ */

test('★ 셋을 합칠 때도 «하나라도» 다르면 막는다', () => {
  const 같음1 = { id: 'a', titleVal: '노사분쟁 조정위원' };
  const 같음2 = { id: 'b', titleVal: '2026 노사분쟁 조정위원 위촉장' };   /* 품는 사이 */
  const 다름 = { id: 'c', titleVal: '산업안전 지킴이' };
  assert.equal(G.check([같음1, 같음2]).ok, true, '둘은 같은 서류입니다');
  assert.equal(G.check([같음1, 같음2, 다름]).ok, false,
    '★ 셋 중 하나가 달라도 합치면 그 하나가 사라집니다');
});

test('한 줄뿐이면 볼 것이 없다', () => {
  assert.equal(G.check([{ id: 'a', titleVal: '위원' }]).ok, true);
  assert.equal(G.check([]).ok, true);
  assert.equal(G.check(null).ok, true);
});

test('빈 것·이상한 것에 터지지 않는다', () => {
  assert.doesNotThrow(function () { G.check([null, undefined, {}]); });
  assert.doesNotThrow(function () { G.explain(null); });
  assert.equal(G.explain({ ok: true }), '');
});

/* ══════ 앱에 «실제로» 이어져 있나 ══════ */

test('★★ 앱이 모듈을 싣고 합치기에서 «막는다»', () => {
  assert.match(SRC, /kcareer-mergeguard\.js\?v=\d+/, '★ 모듈을 안 싣습니다');
  const fn = mergeIntoSource();
  assert.match(fn, /KcareerMergeGuard\.check\(group\)/, '★★ 합치기가 안전장치를 안 씁니다');
  assert.match(fn, /KcareerMergeGuard\.explain\(/, '★ 무엇이 다른지 안 보여 줍니다');
  /* ⚠ 막는 것이 «확인창보다 먼저»여야 한다 — 뒤에 두면 이미 눌러 버린 뒤다 */
  assert.ok(fn.indexOf('KcareerMergeGuard.check(group)') < fn.indexOf('if(!confirm('),
    '★★ 확인창 뒤에서 검사합니다 — 사람이 이미 누른 뒤입니다');
  /* ⚠ 막았으면 «돌아서야» 한다 */
  const 막는대목 = fn.slice(fn.indexOf('if(!_g.ok){'), fn.indexOf('var primHas='));
  assert.match(막는대목, /return;/, '★★ 막고도 그대로 진행합니다');
});

test('★★ 목록에서도 «누르기 전에» 밝힌다', () => {
  const i = SRC.indexOf('function renderDup(');
  assert.ok(i > 0, 'renderDup 을 못 찾았습니다');
  const fn = SRC.slice(i, SRC.indexOf('\nfunction ', i + 10));
  assert.match(fn, /KcareerMergeGuard\.check\(g\)/,
    '★ 목록에서 미리 안 보여 주면 누른 뒤에야 압니다');
  assert.match(fn, /합치면 한쪽이 사라집니다/, '무슨 일이 생기는지 말해야 합니다');
});

test('★ 합치기의 «말없이 버리는» 줄은 그대로 — 안전장치가 앞에서 막는다', () => {
  /* ⚠ 이 줄(빈 칸만 채운다)은 옳다. 문제는 «다른 서류»가 여기 오는 것이었다.
     안전장치를 지우고 이 줄만 고치면 오히려 엉뚱한 값이 덮인다. */
  const fn = mergeIntoSource();
  assert.match(fn, /if\(!prim\[k\]&&other\[k\]\) prim\[k\]=other\[k\]/,
    '빈 칸만 채우는 규칙은 그대로여야 합니다');
});
