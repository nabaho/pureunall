'use strict';
/* 「✂ 필요 없는 쪽 빼기」 (대표 지시 2026-09-14
   「필요없는 페이지 삭제하는 기능 만들 수 있나 · 삭제 후 실수인 경우 복귀도 가능하게 ·
     필요한 페이지만 자동화해서 정리하고 싶다」)
   ────────────────────────────────────────────────────────────────────────
   ■ ⚠★ 먼저 — 「쪽」은 한글 파일에 «담겨 있지 않다». 그려 낼 때 계산되는 결과다.
     실측(대표님 실물 「노무고문 … 평가기준표.hwp」, 10쪽):
       구역(section) 1개 · 하드 쪽나눔 6개 → 쪽 묶음 7개,
       그 7개가 서류 경계와 «정확히» 맞았다. 그래서 지울 수 있는 단위는 «쪽 묶음»이다.
   ■ ⚠★ 「빈칸 0 인 것만 빼면 된다」가 아니다 — 실측으로 확인한 일곱 묶음:
       [1] 공개모집 공고        빈칸 0 · 칸 1   → 안 냄
       [2] 결과발표·제출서류     빈칸 0 · 칸 0   → 안 냄
       [3] 제출서류 체크리스트    빈칸 0 · 칸 33  → **낸다**(□ 를 손으로 찍는 서류)
       [4] 지원서              빈칸 44         → 냄
       [5] 전문분야 기술         빈칸 3          → 냄
       [6] 동의서              빈칸 1          → 냄
       [7] **평가표(위원회 시 활용)  빈칸 19**    → **안 냄**
     빈칸만 세면 [3]이 잘못 빠지고 [7]이 잘못 남는다(일곱 중 둘이 틀린다).
   ■ ⚠★ 저절로 지우지 않는다 — «권함»이다. 헷갈리면 남긴다
     (낼 서류가 빠지는 쪽이 한 장 더 내는 쪽보다 훨씬 나쁘다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../js/kcareer-hwpxpages.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

/* ── 한글 구역 XML 을 흉내 낸다 ── */
function 문단(글, opt) {
  opt = opt || {};
  return '<hp:p id="0" pageBreak="' + (opt.br ? '1' : '0') + '" columnBreak="0">'
    + (opt.tbl || '')
    + '<hp:run charPrIDRef="0"><hp:t>' + 글 + '</hp:t></hp:run></hp:p>';
}
/* 칸이 여럿인 표. 빈칸 n 개 + 글자 든 칸 m 개 */
function 표(빈, 참, opt) {
  opt = opt || {};
  var tcs = '';
  for (var i = 0; i < 빈; i++) tcs += '<hp:tc><hp:subList><hp:p><hp:run><hp:t></hp:t></hp:run></hp:p></hp:subList></hp:tc>';
  for (var j = 0; j < 참; j++) tcs += '<hp:tc><hp:subList><hp:p><hp:run><hp:t>' + (opt.글 || '항목') + '</hp:t></hp:run></hp:p></hp:subList></hp:tc>';
  return '<hp:tbl rowCnt="1" colCnt="' + (빈 + 참) + '"><hp:tr>' + tcs + '</hp:tr></hp:tbl>';
}
function 구역(문단들) {
  return '<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hp="x" xmlns:hs="y">'
    + 문단들.join('') + '</hs:sec>';
}

/* 실측 일곱 묶음을 그대로 본뜬 것.
   ⚠ 진짜 서식은 «제목 문단»이 먼저 오고 표는 «다음 문단»에 있다. 한 문단 안에 표를 먼저
     넣으면 표 칸 글자가 앞으로 나와 제목이 뒤로 밀린다 — 흉내가 실물과 달라진다
     (처음에 그렇게 지었다가 「평가표」를 제목에서 못 찾았다). */
function 서류(제목, 빈, 참, opt) {
  opt = opt || {};
  var out = [문단(제목, { br: !!opt.br })];
  if (빈 + 참 > 0) out.push('<hp:p id="0" pageBreak="0" columnBreak="0">' + 표(빈, 참) + '</hp:p>');
  return out;
}
function 실물흉내() {
  return 구역([].concat(
    서류('[붙임 1] 코레일유통(주) 노무고문 공개모집 공고 … 능력과 자질을 겸비한 노무고문을 공개모집 합니다 … 붙임 4 평가기준표', 0, 1),
    서류('6. 결과발표 결과는 26년 10월 중 개별 문자메시지로 통보 7. 제출서류 접수 기간 문의처', 0, 0, { br: true }),
    /* ⚠ 실물의 체크리스트 글에는 안내문 낱말(접수 기간·문의처)이 섞여 있다 —
       그래서 「빈칸 0 + 안내문 낱말」만 보면 «낼 서류»가 빠진다. 칸 수가 그것을 막는다. */
    서류('□ 노무고문 제출서류 체크리스트 자가 점검 체크리스트 구 분 점검사항 비 고 ※ 접수 기간 안에 제출', 0, 33, { br: true }),
    서류('[붙임 2] 코레일유통(주) 노무고문 지원서 1. 인적사항', 44, 26, { br: true }),
    서류('③ 전문분야, 논문 및 학술경력 등을 기술', 3, 0, { br: true }),
    서류('[붙임 3] 개인정보 수집 이용 제공 동의서', 1, 17, { br: true }),
    서류('[붙임 4] [고문위촉위원회 시 활용] 2026년 제1차 고문위촉위원회 평가표 평가일시', 19, 59, { br: true })
  ));
}

/* ══════ 쪽 묶음 가르기 ══════ */

test('★★★ 하드 쪽나눔으로 «쪽 묶음»을 가른다 — 실측 그대로 일곱', () => {
  const cs = P.chunks(실물흉내());
  assert.equal(cs.length, 7, '★★★ 묶음을 못 가르면 뺄 수가 없습니다');
  assert.match(cs[0].글, /공개모집 공고/);
  assert.match(cs[6].글, /평가표/);
});

test('★★★ 표 «안»의 문단을 바깥 문단으로 세지 않는다 — 얕게 세면 묶음이 어긋난다', () => {
  /* ⚠ 얕은 정규식(non-greedy)으로 <hp:p> 를 세면 표 안 문단의 첫 </hp:p> 에서 끊겨
     실측에서 문단이 155개가 아니라 373개로 세어졌다. 깊이를 세는 자를 빌려 쓴다. */
  const xml = 구역([문단('머리', { tbl: 표(3, 2) }), 문단('둘째', { br: true })]);
  const cs = P.chunks(xml);
  assert.equal(cs.length, 2, '★★★ 표 안 문단을 쪽 묶음 경계로 잘못 봅니다');
  assert.equal(cs[0].칸, 5, '표의 칸은 세야 합니다');
  assert.equal(cs[0].빈칸, 3);
});

test('★★★ 표 «칸 안»의 쪽나눔은 경계가 아니다 — 여는 태그에 적힌 것만 본다', () => {
  /* ⚠ 문단 글자 전체에서 pageBreak="1" 을 찾으면, 표 칸 속 문단의 쪽나눔 때문에
     한 서류가 둘로 갈린다. 여는 태그(첫 `>` 까지)만 봐야 한다. */
  const 속쪽나눔 = '<hp:tbl><hp:tr><hp:tc><hp:subList>'
    + '<hp:p id="9" pageBreak="1"><hp:run><hp:t>칸 속</hp:t></hp:run></hp:p>'
    + '</hp:subList></hp:tc></hp:tr></hp:tbl>';
  const xml = 구역([
    문단('첫 서류'),
    '<hp:p id="0" pageBreak="0">' + 속쪽나눔 + '</hp:p>',
    문단('둘째 서류', { br: true })
  ]);
  const cs = P.chunks(xml);
  assert.equal(cs.length, 2, '★★★ 칸 속 쪽나눔을 경계로 봤습니다 — 한 서류가 둘로 갈립니다');
  assert.match(cs[0].글, /첫 서류/);
  assert.match(cs[0].글, /칸 속/, '칸 속 글도 그 묶음에 있어야 합니다');
});

test('★★ 중첩 표의 칸을 «두 번» 세지 않는다 — 채울 칸 수가 부풀면 판단이 뒤집힌다', () => {
  const 속표 = '<hp:tbl><hp:tr>'
    + '<hp:tc><hp:subList><hp:p><hp:run><hp:t></hp:t></hp:run></hp:p></hp:subList></hp:tc>'
    + '<hp:tc><hp:subList><hp:p><hp:run><hp:t></hp:t></hp:run></hp:p></hp:subList></hp:tc>'
    + '</hp:tr></hp:tbl>';
  const 겉표 = '<hp:tbl><hp:tr><hp:tc><hp:subList><hp:p>' + 속표 + '</hp:p></hp:subList></hp:tc></hp:tr></hp:tbl>';
  const cs = P.chunks(구역(['<hp:p id="0" pageBreak="0">' + 겉표 + '</hp:p>']));
  assert.equal(cs[0].칸, 2, '★★ 겉칸까지 세어 ' + cs[0].칸 + '칸이 됐습니다');
  assert.equal(cs[0].빈칸, 2);
});

test('★ 쪽나눔이 하나도 없으면 묶음은 하나다 — 나눌 수 없다고 말할 수 있어야 한다', () => {
  const cs = P.chunks(구역([문단('가'), 문단('나'), 문단('다')]));
  assert.equal(cs.length, 1);
});

test('빈 것·이상한 것에 터지지 않는다', () => {
  assert.deepEqual(P.chunks(''), []);
  assert.deepEqual(P.chunks(null), []);
  assert.doesNotThrow(function () { P.remove(null, [0]); });
});

/* ══════ ★★ 무엇을 뺄지 권하기 ══════ */

test('★★★ 실측 일곱 묶음을 «일곱 다» 맞게 가른다', () => {
  const cs = P.chunks(실물흉내());
  const sg = P.suggest(cs);
  const 뺌 = sg.map(function (s) { return s.drop; });
  assert.deepEqual(뺌, [true, true, false, false, false, false, true],
    '★★★ 실측과 다릅니다 — 실제로 낼 서류가 빠지거나 남의 평가표가 따라갑니다');
});

test('★★★ 「평가표」는 채울 칸이 많아도 뺀다 — 남이 쓰는 서류다', () => {
  const cs = P.chunks(실물흉내());
  const sg = P.suggest(cs);
  assert.equal(sg[6].drop, true, '★★★ 빈칸이 19개라고 남기면 남의 평가표를 제출하게 됩니다');
  assert.match(sg[6].why, /남이 쓰는/);
});

test('★★★ 「제출서류 체크리스트」는 빈칸이 0이어도 남긴다 — 칸이 많으면 낼 서류다', () => {
  /* ⚠ □ 를 손으로 찍어 내는 서류다. 빈칸만 세면 잘못 빠진다(실측으로 실제로 그랬다). */
  const cs = P.chunks(실물흉내());
  const sg = P.suggest(cs);
  assert.equal(sg[2].drop, false, '★★★ 낼 서류가 빠집니다');
});

test('★★★ 까닭이 «맞아야» 한다 — 공고문을 「평가표」라고 하면 안 된다', () => {
  /* ⚠ 본문 전체에서 「평가기준표」를 찾으면 공고문 안의 붙임 목록 한 줄 때문에
     공고문이 「남이 쓰는 서류」로 읽힌다(실측으로 실제로 그랬다 — 결과는 맞았지만 까닭이 틀렸다).
     제목에서만 찾는다. 틀린 까닭은 없는 까닭보다 나쁘다. */
  const cs = P.chunks(실물흉내());
  const sg = P.suggest(cs);
  assert.equal(sg[0].drop, true);
  assert.match(sg[0].why, /안내문/, '★★★ 공고문에 「평가·심사」라는 까닭을 붙였습니다');
  assert.ok(!/평가|심사/.test(sg[0].why));
});

test('★★ 채울 칸이 있으면 남긴다 — 헷갈리면 남기는 쪽이다', () => {
  const cs = P.chunks(구역([문단('무슨 안내문 공고', { tbl: 표(5, 1) })]));
  assert.equal(P.suggest(cs)[0].drop, false, '★★ 채울 칸이 있는데 뺐습니다');
});

test('★ 안내문 낱말이 없으면 빈칸 0 이어도 남긴다', () => {
  const cs = P.chunks(구역([문단('그냥 무슨 글')]));
  assert.equal(P.suggest(cs)[0].drop, false);
});

/* ══════ 빼기 ══════ */

test('★★★ 고른 묶음만 빠지고 나머지는 «그대로» 남는다', () => {
  const xml = 실물흉내();
  const out = P.remove(xml, [0, 1, 6]);
  const cs2 = P.chunks(out);
  assert.equal(cs2.length, 4, '★★★ 남은 묶음이 ' + cs2.length + '개입니다');
  assert.match(cs2[0].글, /체크리스트/);
  assert.match(cs2[1].글, /지원서/);
  assert.match(cs2[3].글, /동의서/);
  assert.ok(!/평가표/.test(out), '★★★ 평가표가 남았습니다');
  assert.ok(!/공개모집 공고/.test(out), '★★★ 공고문이 남았습니다');
});

test('★★★ 앞에서부터 지우면 뒤가 밀린다 — 뒤에서부터 지운다', () => {
  /* ⚠ 자리(from·to)는 «원래 글자» 기준이다. 앞을 먼저 지우면 뒤 묶음의 자리가 밀려
     엉뚱한 곳이 잘린다. 가운데 둘을 빼 보면 바로 드러난다. */
  const xml = 실물흉내();
  const out = P.remove(xml, [1, 3]);
  const cs2 = P.chunks(out);
  assert.equal(cs2.length, 5);
  assert.match(cs2[0].글, /공개모집 공고/);
  assert.match(cs2[1].글, /체크리스트/);
  assert.match(cs2[2].글, /전문분야/);
  assert.match(cs2[3].글, /동의서/);
  assert.match(cs2[4].글, /평가표/);
  assert.ok(!/지원서/.test(out), '★★★ 지원서가 남았습니다 — 자리가 밀렸습니다');
});

test('★★ 모두 빼려 하면 «아무것도 안 한다» — 빈 문서를 만들지 않는다', () => {
  const xml = 실물흉내();
  assert.equal(P.remove(xml, [0, 1, 2, 3, 4, 5, 6]), xml, '★★ 빈 문서가 됩니다');
});

test('★ 뺄 것이 없으면 원래 글자 그대로', () => {
  const xml = 실물흉내();
  assert.equal(P.remove(xml, []), xml);
  assert.equal(P.remove(xml, null), xml);
});

test('★★★ 원본 글자를 «건드리지 않는다» — 되돌리기의 바탕이다', () => {
  const xml = 실물흉내();
  const 사본 = String(xml);
  P.remove(xml, [0, 6]);
  assert.equal(xml, 사본, '★★★ 원본을 고쳤습니다 — 되돌릴 수가 없습니다');
});

/* ══════ 앱에 이어져 있나 ══════ */

test('★★ 앱이 모듈을 싣고 왼쪽 기둥에 문이 있다', () => {
  assert.match(SRC, /kcareer-hwpxpages\.js\?v=\d+/, '★ 모듈을 안 싣습니다');
  assert.match(SRC, /onclick="rhPagesOpen\(\)"/, '★★ 들어갈 문이 없으면 만든 것과 같습니다');
  assert.match(SRC, /id="modalPages"/, '창이 없습니다');
  /* ⚠ 판정은 모듈 한 곳 — 화면에서 다시 적으면 어긋난다 */
  const open = SRC.slice(SRC.indexOf('async function rhPagesOpen('), SRC.indexOf('function rhPagesClose('));
  assert.match(open, /KcareerHwpxPages\.chunks\(/, '★★ 화면이 제 나름대로 가릅니다');
  assert.match(open, /KcareerHwpxPages\.suggest\(/, '권하는 것도 모듈이 합니다');
  assert.match(open, /cs\.length<2/, '★ 못 나누는 서식이면 그렇다고 말해야 합니다');
});

test('★★★ 되살리기 — 원본(_rhBase)에서 «다시» 만든다', () => {
  const fn = SRC.slice(SRC.indexOf('async function rhPagesRestore('), SRC.indexOf('/* ── 도장 찍기 ──'));
  assert.match(fn, /_rhBase/, '★★★ 원본을 안 보면 되돌릴 수가 없습니다');
  /* ⚠ 「confirm 이라는 글자가 있나」로는 모자란다 — 죽은 가지에 넣어 둬도 통과한다
     (고장넣기로 확인했다). «묻고 아니면 돌아서는» 모양을 짚는다. */
  assert.match(fn, /if\(!confirm\([\s\S]{0,400}?\)\) return;/,
    '★★ 묻지 않고 되돌리면 친 값이 말없이 사라집니다');
  assert.match(fn, /값은 지워집니다/, '★★ 무엇을 잃는지 말해야 합니다');
  assert.match(fn, /mountEditor\(/, '다시 그려야 합니다');
});

test('★★★ 뺄 때 원본(_rhBase)을 «지킨다» — 안 지키면 되살리기가 뺀 것으로 돌아간다', () => {
  const fn = SRC.slice(SRC.indexOf('async function rhPagesApply('), SRC.indexOf('async function rhPagesRestore('));
  assert.match(fn, /_rhKeepBase=true/, '★★★ 바탕이 갈려 원본이 사라집니다');
  assert.match(fn, /finally\{ _rhKeepBase=false; \}/,
    '★★★ 안 풀면 다음 양식이 바탕을 못 잡습니다(2026-09-07 과 같은 덫)');
  assert.match(fn, /KcareerHwpxPages\.remove\(/, '빼는 것도 모듈이 합니다');
  /* ⚠ 모두 빼면 빈 문서가 된다 — 화면에서도 막는다 */
  assert.match(fn, /모두 뺄 수는 없습니다/, '★★ 다 빼면 빈 문서가 됩니다');
  assert.match(fn, /뺄 것이 없습니다/, '★ 아무것도 안 골랐을 때 조용히 끝나면 안 됩니다');
});

test('★★ 「저절로 지운다」가 아니라 «권한다»고 화면에 밝힌다', () => {
  const fn = SRC.slice(SRC.indexOf('function rhPagesRender('), SRC.indexOf('var _rhDropped'));
  /* ⚠ 「그 글자가 어딘가 있나」로는 모자란다 — 죽은 가지(if(false))에 넣어 둬도 통과한다
     (고장넣기로 확인했다). «어떤 때 보이는지»까지 짚는다. */
  assert.match(fn, /if\(뺄\) h\+=/, '★★ 뺄 것이 있을 때 「확인해 주세요」가 나와야 합니다');
  assert.match(fn, /확인해 주세요/, '★★ 사람이 확인하는 단계임을 밝혀야 합니다');
  assert.match(fn, /저절로 지우지 않습니다/);
  assert.match(fn, /되살리기/, '되돌릴 수 있다고 말해야 안심하고 누릅니다');
  /* ⚠ 이미 값을 쳤으면 «그때» 알린다 — 쪽을 빼면 칸 자리가 바뀐다 */
  assert.match(fn, /if\(값있음\) h\+=/, '★★ 값을 쳤을 때 알려야 합니다');
  assert.match(fn, /쪽 정리를 먼저 하고/, '★★ 값 친 뒤에 빼면 자리가 어긋납니다');
});
