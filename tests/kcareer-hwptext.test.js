'use strict';
/* 한글 문서에서 «AI 가 읽을 글자»를 뽑는다 (대표 지시 2026-09-18
   「권형하 컨설턴트 참석확인서.hwp … 이 서류를 못 읽는다. 읽고 내용 넣을 수 있게 해달라」)
   ────────────────────────────────────────────────────────────────────────
   ■ ⚠★ 한글 파일은 «스캔이 아니다» — 글자가 파일 안에 그대로 적혀 있다.
     그림으로 바꿔 OCR 하면 «우리가 그린 그림을 우리가 다시 읽는» 셈이고 틀리기까지 한다.
   ■ ⚠★ 표는 «줄과 칸»을 살린다. 통째로 이으면
       「연번 기업명 컨설팅 진행일 1 가장큰약국 8.14.(금) 2 …」가 되어
       어느 값이 어느 열인지 알 수 없다.
   ■ ⚠★ 주민등록번호는 «통째로» 가린다 — 생년 네 자리가 새는 것도 새는 것이다.
     사전이 「주민」을 묻는 화면(신분증·개인서류)에서만 그대로 보낸다.
   ■ 아래 흉내는 대표님 실물(71KB, 2쪽)에서 실제로 뽑힌 글자를 그대로 본떴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const T = require('../js/kcareer-hwptext.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

/* ── 한글 구역 XML 흉내 ── */
function 문단(글) { return '<hp:p id="0"><hp:run charPrIDRef="0"><hp:t>' + 글 + '</hp:t></hp:run></hp:p>'; }
function 칸(글) { return '<hp:tc><hp:subList><hp:p><hp:run><hp:t>' + 글 + '</hp:t></hp:run></hp:p></hp:subList></hp:tc>'; }
function 빈칸() { return '<hp:tc><hp:subList><hp:p><hp:run><hp:t></hp:t></hp:run></hp:p></hp:subList></hp:tc>'; }
function 줄(칸들) { return '<hp:tr>' + 칸들.join('') + '</hp:tr>'; }
function 표(줄들) { return '<hp:tbl rowCnt="' + 줄들.length + '" colCnt="3">' + 줄들.join('') + '</hp:tbl>'; }
function 표문단(줄들) { return '<hp:p id="0"><hp:run>' + 표(줄들) + '</hp:run></hp:p>'; }
function 구역(ps) {
  return '<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hp="x" xmlns:hs="y">' + ps.join('') + '</hs:sec>';
}

/* 대표님 실물 「권형하 컨설턴트 참석확인서.hwp」를 본뜬 것 */
function 참석확인서() {
  return 구역([
    문단('참 석 확 인 서'),
    문단('○ 소속/직위(급) : 푸른노무법인/대표'),
    문단('○ 성 명 : 권형하'),
    문단('○ 주민등록번호 : 750107-1684916'),
    문단('○ (은행)계좌번호 : 하나 261 910 164 054 07'),
    표문단([줄([칸('연번'), 칸('기업명'), 칸('컨설팅 진행일')]),
            줄([칸('1'), 칸('가장큰약국'), 칸('8.14.(금)')]),
            줄([칸('2'), 칸('㈜에스에이씨'), 칸('8.18.(화)')])]),
    문단('2026년 09월 18일'),
    표문단([줄([칸('세부내역'), 칸('공제액(8.8%)'), 칸('실지급액')]),
            줄([칸('회의수당 : 400,000 x 4 = 1,600,000'), 칸('140,800'), 칸('1,459,200')])])
  ]);
}

/* ══════ 글자 뽑기 ══════ */

test('★★★ 문단이 «문서에 적힌 차례 그대로» 줄이 된다', () => {
  const ls = T.lines(참석확인서());
  assert.equal(ls[0], '참 석 확 인 서', '제목이 맨 앞이어야 합니다');
  assert.ok(ls.indexOf('○ 성 명 : 권형하') > 0);
  assert.ok(ls.indexOf('2026년 09월 18일') > ls.indexOf('○ 성 명 : 권형하'),
    '⚠ 차례가 뒤바뀌면 AI 가 어느 날짜가 무엇인지 알 수 없습니다');
});

test('★★★ 표는 «칸 | 칸 | 칸» 으로 나온다 — 실측 줄 그대로', () => {
  const ls = T.lines(참석확인서());
  assert.ok(ls.includes('연번 | 기업명 | 컨설팅 진행일'), '머리줄');
  assert.ok(ls.includes('1 | 가장큰약국 | 8.14.(금)'), '자료 줄');
  assert.ok(ls.includes('2 | ㈜에스에이씨 | 8.18.(화)'));
});

test('★★★ 금액 줄이 «한 글자도 안 틀리게» 나온다 — 이것이 읽으려는 값이다', () => {
  const t = T.fromXml(참석확인서());
  assert.ok(t.indexOf('회의수당 : 400,000 x 4 = 1,600,000 | 140,800 | 1,459,200') >= 0,
    '⚠ 총액·공제액·실지급액이 «각각 어느 칸인지» 알 수 있어야 합니다');
});

test('★★ 문단 글자와 표 글자가 «섞이지 않는다»', () => {
  const ls = T.lines(참석확인서());
  /* 표가 든 문단이 「연번기업명…」을 «제 줄»로 또 내놓으면 안 된다 */
  const 섞임 = ls.filter((l) => l.indexOf('|') < 0 && /연번|세부내역/.test(l));
  assert.deepEqual(섞임, [], '⚠ 표 칸 글자가 문단 줄로 새어 나왔습니다');
});

test('★★ 한 문단에 «글자와 표»가 같이 있으면 글자가 «먼저» 나온다', () => {
  /* ⚠ 표를 앞에 내면 「< 지급 산출내역 >」 같은 제목이 표 «뒤»로 밀려,
     어느 표를 가리키는 제목인지 알 수 없게 된다. */
  const xml = 구역(['<hp:p><hp:run><hp:t>&lt; 지급 산출내역 &gt;</hp:t>'
    + 표([줄([칸('세부내역'), 칸('실지급액')])]) + '</hp:run></hp:p>']);
  assert.deepEqual(T.lines(xml), ['< 지급 산출내역 >', '세부내역 | 실지급액']);
});

test('★★★ 속 표(중첩)의 줄이 겉 표의 «독립된 줄»로 새지 않는다', () => {
  /* 칸 안에 표가 든 서식이 실제로 있다. 겉에서 멈추면 속을 못 읽고,
     깊이를 안 세면 속 줄이 겉 표의 줄로 두 번 나온다. */
  const 속 = 표([줄([칸('속1'), 칸('속2')])]);
  const 겉칸 = '<hp:tc><hp:subList><hp:p><hp:run><hp:t>겉</hp:t>' + 속 + '</hp:run></hp:p></hp:subList></hp:tc>';
  const xml = 구역([문단('머리'), '<hp:p><hp:run>' + 표([줄([겉칸, 칸('옆')])]) + '</hp:run></hp:p>']);
  const ls = T.lines(xml);
  assert.equal(ls.filter((l) => l.indexOf('속1') >= 0).length, 1,
    '⚠ 속 표 글자는 «한 번만» 나와야 합니다');
  assert.ok(ls.some((l) => /겉.*속1 \| 속2.*\| 옆/.test(l)),
    '⚠ 속 표는 그 칸 «안»에 담겨야 합니다 — 따로 떨어지면 어느 칸 것인지 모릅니다');
});

test('★★ 가운데 빈 칸은 남기고, 뒤쪽 빈 칸만 버린다', () => {
  const xml = 구역([표문단([줄([칸('성명'), 빈칸(), 칸('소속'), 빈칸(), 빈칸()])])]);
  const ls = T.lines(xml);
  assert.equal(ls[0], '성명 |  | 소속',
    '⚠ 가운데를 버리면 줄이 밀려 「성명 | 소속」이 되고 짝이 어긋납니다');
});

test('★ 글자만 있고 표가 없는 서식도 그대로 나온다', () => {
  assert.equal(T.fromXml(구역([문단('가'), 문단('나')])), '가\n나');
});

test('★ XML 이 비었거나 망가져도 터지지 않는다', () => {
  assert.deepEqual(T.lines(''), []);
  assert.deepEqual(T.lines(null), []);
  assert.equal(T.fromXml('<hp:p><hp:t>짝없음'), '');
});

test('★ 구역이 여럿이면 «차례대로» 이어 붙인다', () => {
  const a = 구역([문단('첫쪽')]), b = 구역([문단('둘쪽')]);
  assert.equal(T.fromXmls([a, b]), '첫쪽\n둘쪽');
  assert.equal(T.fromXmls([]), '');
});

test('★ XML 엔티티를 사람 말로 푼다', () => {
  assert.equal(T.fromXml(구역([문단('&lt;지급 산출내역&gt; A&amp;B')])), '<지급 산출내역> A&B');
});

/* ══════ 주민등록번호 가리기 ══════ */

test('★★★ 주민등록번호를 «통째로» 가린다 — 생년 네 자리도 새면 안 된다', () => {
  const t = T.maskRrn(T.fromXml(참석확인서()));
  assert.ok(t.indexOf('750107') < 0, '⚠ 앞 6자리(생년월일)가 남아 있습니다');
  assert.ok(t.indexOf('1684916') < 0, '⚠ 뒷자리가 남아 있습니다');
  assert.ok(t.indexOf('○○○○○○-○○○○○○○') > 0, '가렸다는 것이 보여야 합니다');
});

test('★★ 가리면서 «앞 글자»를 지우지 않는다', () => {
  assert.equal(T.maskRrn('○ 주민등록번호 : 750107-1684916'), '○ 주민등록번호 : ○○○○○○-○○○○○○○');
  assert.equal(T.maskRrn('750107-1684916 님'), '○○○○○○-○○○○○○○ 님', '맨 앞에 있어도 가린다');
  assert.equal(T.maskRrn('가750107-1684916'), '가○○○○○○-○○○○○○○');
});

test('★★ 나란히 둘이 있어도 둘 다 가린다', () => {
  assert.equal(T.maskRrn('750107-1684916, 801231-2345678'), '○○○○○○-○○○○○○○, ○○○○○○-○○○○○○○');
});

test('★★ 주민번호가 «아닌» 숫자는 건드리지 않는다 — 계좌·전화·사업자번호', () => {
  /* ⚠ 계좌번호를 가리면 계좌 화면이 그것을 못 읽는다. 붙여 쓴 13자리는
     계좌번호와 구분할 수 없어 «일부러» 손대지 않는다. */
  assert.equal(T.maskRrn('하나 261 910 164 054 07'), '하나 261 910 164 054 07');
  assert.equal(T.maskRrn('041-000-0000'), '041-000-0000', '전화번호');
  assert.equal(T.maskRrn('123-45-67890'), '123-45-67890', '사업자등록번호');
  assert.equal(T.maskRrn('7501071684916'), '7501071684916', '붙여 쓴 13자리는 그대로');
  assert.equal(T.maskRrn('7501071-16849160'), '7501071-16849160', '자릿수가 다르면 아니다');
  /* ⚠ 뒤에 숫자가 «더» 이어지면 주민번호가 아니다 — 가리면 엉뚱한 번호가 토막 난 채 남는다
     (「750107-16849167」이 「○○○○○○-○○○○○○○7」이 된다). */
  assert.equal(T.maskRrn('750107-16849167'), '750107-16849167', '뒤가 8자리면 아니다');
});

/* ══════ 「주민번호를 묻는 화면」 가르기 ══════ */

test('★★★ 사전이 주민번호를 «묻는» 화면에서만 그대로 보낸다', () => {
  assert.equal(T.needsRrn('{"kind":"종류","number":"주민번호앞7자리 또는 면허번호"}'), true);
  assert.equal(T.needsRrn('이 영수증·청구서에서 비용 내역을 읽어 JSON 으로만 답하세요.'), false);
  assert.equal(T.needsRrn(''), false);
  assert.equal(T.needsRrn(null), false);
});

test('★★★ 실제 판독 사전으로 견준다 — 주민번호를 묻는 화면은 «둘뿐»이다', () => {
  /* ⚠ 사전이 늘어 다른 화면이 주민번호를 묻게 되면 이 검사가 알려 준다.
     그때는 «정말 필요한지» 먼저 따진다 — 필요 없으면 사전에서 빼는 것이 맞다. */
  const i = SRC.indexOf('const PAGE_OCR_PROMPT={');
  assert.ok(i > 0);
  const blk = SRC.slice(i, SRC.indexOf('\n};', i));
  const 묻는화면 = [];
  const marks = [];
  const re = /\n  ([a-z_]+):\s*[`']/g;
  let m;
  while ((m = re.exec(blk))) marks.push({ page: m[1], at: m.index });
  marks.forEach((mk, k) => {
    const body = blk.slice(mk.at, k + 1 < marks.length ? marks[k + 1].at : blk.length);
    if (T.needsRrn(body)) 묻는화면.push(mk.page);
  });
  assert.deepEqual(묻는화면.sort(), ['id_doc', 'personal_doc'],
    '★ 이 밖의 화면이 주민번호를 묻고 있습니다 — 그 화면은 이제 가리지 않고 보냅니다');
});

/* ══════ 길이 뚜껑 · 쓸 만한가 ══════ */

test('★★ 길면 자르고 «잘랐다고 말한다»', () => {
  const 긴 = '가'.repeat(100);
  const c = T.cut(긴, 30);
  assert.equal(c.length > 30, true);
  assert.ok(/여기까지만 읽었습니다/.test(c), '⚠ 조용히 자르면 뒤쪽 값이 없는 까닭을 아무도 모릅니다');
  assert.equal(c.slice(0, 30), '가'.repeat(30));
});

test('★ 짧으면 그대로 둔다', () => {
  assert.equal(T.cut('짧은 글', 30), '짧은 글');
  assert.equal(T.cut('짧은 글'), '짧은 글');
  assert.ok(T.MAX >= 10000, '여러 쪽 서류도 한 번에 읽어야 합니다');
});

test('★★★ 「쓸 만한가」 — 모자라면 부르는 쪽이 옛 길로 물러선다', () => {
  assert.equal(T.enough(T.fromXml(참석확인서())), true, '실물은 쓸 만하다');
  assert.equal(T.enough(''), false);
  assert.equal(T.enough(null), false);
  assert.equal(T.enough('짧다'), false, '두 글자로는 아무 기록도 못 만든다');
  assert.equal(T.enough(' |  |  | \n |  | '), false,
    '⚠ 칸 구분자와 공백만 남은 «빈 양식»을 AI 에게 보내면 빈 기록이 만들어집니다');
  assert.equal(T.enough('열글자가넘는글자입니다'), true);
});
