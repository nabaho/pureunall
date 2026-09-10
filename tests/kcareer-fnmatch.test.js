'use strict';
/* 파일이름으로 원본 짝짓기 — 잣대를 «돌려 보는» 검사 (대표 지시 2026-09-10 「가」)
   ────────────────────────────────────────────────────────────────────────
   대표 물음: 「위촉장 원본이 없는게 많이 보인다 … 원본이 있는것과 없는것 찾고
              중복안되게 정리하고 … 한번에 정리하고 싶다.」

   ■ 실물로 재어 본 것 (2026-09-10, 대표 기록 110건 ↔ 서류 파일 279개)
     · 고치기 전 짝 86건 → 고친 뒤 90건
     · 그 중 저절로 켜지는 것 82 · 사람이 봐야 하는 것 8 (틀린 것들이 그 8에 모였다)

   ■ 여기서 못 박는 것 — 실측으로 찾은 «세 가지 구멍»
     ① 기록에 적힌 «파일이름»(fname)을 한 번도 보지 않았다.
        110건 «전부» fname 이 있고 그 중 37건은 폴더 파일과 글자까지 똑같았다 —
        공짜로 맞출 수 있는 것을 놓쳤다.
     ② 해(年)가 «어긋나는» 것을 벌하지 않았다(맞으면 +30, 틀리면 0).
        그래서 「충청남도」처럼 앞 네 글자가 같은 기관이 수십 곳인 경우
        엉뚱한 해의 파일이 제 해의 파일을 이겼다 — 실측:
          「2024 충청남도 공무직인사위원회」의 제 파일은 95점인데
          남의 파일(2022 «충청남도청소년진흥원» 인사위원)이 115점으로 이겼다.
     ③ 확신이 낮은 짝도 «그대로 다» 붙었다. 사람이 볼 기회가 없었다.

   ⚠ 이 파일의 검사는 전부 «돌려 본다». 앞서 붙어 있던 검사는 kcareer.html 의 글자를
     찾는 것이어서, 「fname 을 안 본다」는 큰 구멍을 하나도 못 잡았다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const FM = require('../js/kcareer-fnmatch.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
function 파일(names) { return names.map(function (n) { return { name: n }; }); }

/* ══════════ ① 기록에 적힌 파일이름을 본다 ══════════ */

test('★★★ 기록에 적힌 «파일이름»을 본다 — 여태 한 번도 보지 않았다', () => {
  /* 실측: 대표 기록 110건 전부 fname 을 갖고 있는데 잣대가 그것을 안 봤다.
     그 중 37건은 폴더 파일과 «글자까지» 똑같았다. */
  const r = { id: 'a', org: '어떤기관', year: '2020',
              fname: '2020 공공부문 정규직 전환 컨설턴트 위촉장 (2020.05.28).pdf' };
  const 같은것 = FM.fnKey('2020 공공부문 정규직 전환 컨설턴트 위촉장 (2020.05.28).pdf');
  const 남의것 = FM.fnKey('2020 어떤기관 위촉장.pdf');
  const a = FM.scoreDetail(같은것, r, 'wiccok', {});
  assert.ok(a.score >= 200, '★ 파일이름이 그대로 같은데 점수가 낮습니다: ' + a.score);
  assert.equal(a.strong, true, '파일이름이 같은 것은 «센 증거»여야 합니다');
  assert.ok(a.why.join().indexOf('파일이름') >= 0, '까닭을 밝히지 않습니다');
  /* 기관 이름만 맞는 남의 파일보다 «훨씬» 높아야 한다 */
  const 남의점 = FM.score(남의것, r, 'wiccok', {});
  assert.ok(a.score >= 남의점 + 100,
    '★ 파일이름이 기관 이름보다 센 단서가 아닙니다 (' + a.score + ' vs ' + 남의점 + ')');
  /* ⚠ 기관 이름만 맞은 것은 «센 증거»가 아니다 — 이름이 통째로 든 것이 아니기 때문이다 */
  assert.equal(FM.scoreDetail(남의것, r, 'wiccok', {}).strong, false,
    '기관 앞 몇 자만 맞은 것을 센 증거로 보면 안 됩니다');
});

test('★★ 파일이름이 «기호만 다를» 때도 알아본다', () => {
  const r = { id: 'a', fname: '2016 충남지회 회장 위촉장(2016.01.01).pdf' };
  /* 괄호 앞 빈칸 하나 차이 */
  const d = FM.scoreDetail(FM.fnKey('2016 충남지회 회장 위촉장 (2016.01.01).pdf'), r, 'wiccok', {});
  assert.ok(d.score >= 150, '★ 기호 차이로 못 알아봅니다: ' + d.score);
  assert.equal(d.strong, true);
});

test('★ 기록의 파일이름이 «지어낸 이름»이면 억지로 잇지 않는다', () => {
  /* OCR 등록 때 앱이 지어낸 이름은 기관명이 잘려 있다 —
     `2020_경기도공동근로복지기_운영위원회 위원_위촉장.pdf` (실측) */
  const r = { id: 'a', org: '경기도공동근로복지기금 설립운영위원회', year: '2020',
              fname: '2020_경기도공동근로복지기_운영위원회 위원_위촉장.pdf' };
  const d = FM.scoreDetail(FM.fnKey('2024 경기도공동기금 설립운영위원 위촉장 (2024.12.09).pdf'), r, 'wiccok', {});
  /* 해가 네 해 어긋난다 — 붙이면 틀린 서류가 된다 */
  assert.ok(d.score < FM.문턱, '★ 해가 네 해 어긋난 것을 붙입니다: ' + d.score);
});

/* ══════════ ② 해(年)가 어긋나면 깎는다 ══════════ */

test('★★★ 해가 «어긋나면» 깎는다 — 안 깎으니 남의 파일이 제 파일을 이겼다', () => {
  /* 실측 그대로 재현한다. 기록의 기관 이름은 「충청남도 공무직인사위원회」이고
     제 파일은 「충남공무직인사위원회」(충청남도가 «충남»으로 줄었다),
     남의 파일은 「충청남도청소년진흥원」(앞 네 글자가 같다). */
  const r = { id: 'a', org: '충청남도 공무직인사위원회', titleVal: '인사위원', year: '2024' };
  const 제것 = FM.score(FM.fnKey('2024 충남공무직인사위원회 위촉장 (2024.03.05).pdf'), r, 'wiccok', {});
  const 남의것 = FM.score(FM.fnKey('2022 (재)충청남도청소년진흥원 인사위원 위촉장 (2022.04.01).pdf'), r, 'wiccok', {});
  assert.ok(제것 > 남의것,
    '★ 남의 해 파일이 이깁니다 — 제것 ' + 제것 + ' vs 남의것 ' + 남의것);
  /* 짝짓기에서도 제 파일을 가져가야 한다 */
  const p = FM.pairUp(파일(['2022 (재)충청남도청소년진흥원 인사위원 위촉장 (2022.04.01).pdf',
                            '2024 충남공무직인사위원회 위촉장 (2024.03.05).pdf']), [r], 'wiccok', {});
  assert.equal(p.matched[0].file.name, '2024 충남공무직인사위원회 위촉장 (2024.03.05).pdf',
    '★ 엉뚱한 해의 파일을 가져갔습니다');
});

test('★★ 한 해 차이는 «약하게만» 깎는다 — 12월 31일 위촉은 파일에 다음 해가 붙는다', () => {
  /* 실측: 「2026 서산시 …(2025.12.31).pdf」 — 위촉일은 2025년인데 이름은 2026이다.
     ⚠ 여기서 크게 깎으면 «맞는 짝»이 떨어진다. */
  const r = { id: 'a', org: '서산시비정규직근로자지원센터', titleVal: '고문노무사', year: '2025' };
  /* ⚠ 「문턱을 넘나」만 보면 안 된다 — 점수가 넉넉한 짝은 크게 깎여도 문턱을 넘어
     그대로 통과했다(고장넣기 2026-09-10). «깎는 폭»을 견줘야 한다.
     ⚠ 같은 이름의 파일로 해만 바꿔 재면 다른 단서가 모두 같으므로 «해 하나»만 본다. */
  const 이름 = ' 서산시 비정규직근로자지원센터 고문노무사 위촉장.pdf';
  const 같은해 = FM.score(FM.fnKey('2025' + 이름), r, 'wiccok', {});
  const 한해차 = FM.score(FM.fnKey('2026' + 이름), r, 'wiccok', {});
  const 세해차 = FM.score(FM.fnKey('2022' + 이름), r, 'wiccok', {});
  assert.ok(한해차 >= FM.문턱, '★ 한 해 차이를 너무 깎아 맞는 짝이 떨어집니다: ' + 한해차);
  /* 같은 해(+30) → 한 해 차이(−10) 는 40 만큼만 떨어진다 */
  assert.equal(같은해 - 한해차, 40,
    '★ 한 해 차이의 깎는 폭이 달라졌습니다 (같은해 ' + 같은해 + ' · 한해차 ' + 한해차 + ')');
  /* 한 해 차이(−10) → 두 해 이상(−40) 은 30 만큼 더 떨어진다 */
  assert.equal(한해차 - 세해차, 30,
    '★ 여러 해 어긋난 것을 한 해 차이와 같이 봅니다 (한해차 ' + 한해차 + ' · 세해차 ' + 세해차 + ')');
});

test('해를 «모르면» 깎지 않는다 — 모르는 것을 벌하면 안 된다', () => {
  const r = { id: 'a', org: '충청남도교육청' };            /* 해 없음 */
  const 해있는파일 = FM.score(FM.fnKey('2020 충청남도교육청 위촉장.pdf'), r, 'wiccok', {});
  assert.ok(해있는파일 >= FM.문턱, '★ 기록에 해가 없으면 점수가 깎입니다: ' + 해있는파일);
  const r2 = { id: 'b', org: '충청남도교육청', year: '2020' };
  const 해없는파일 = FM.score(FM.fnKey('충청남도교육청 위촉장.pdf'), r2, 'wiccok', {});
  assert.ok(해없는파일 >= FM.문턱, '★ 파일에 해가 없으면 점수가 깎입니다: ' + 해없는파일);
});

test('issueDate 에서도 해를 읽는다 — year 칸이 비어 있는 기록이 있다', () => {
  const r = { id: 'a', org: '충청남도교육청', issueDate: '2020.03.02' };
  const 맞는해 = FM.score(FM.fnKey('2020 충청남도교육청 위촉장.pdf'), r, 'wiccok', {});
  const 틀린해 = FM.score(FM.fnKey('2015 충청남도교육청 위촉장.pdf'), r, 'wiccok', {});
  assert.ok(맞는해 > 틀린해, '★ issueDate 의 해를 안 봅니다 (' + 맞는해 + ' vs ' + 틀린해 + ')');
});

/* ══════════ ③ 확신 — 저절로 켜지는 것과 사람이 볼 것 ══════════ */

test('★★★ 센 증거가 없고 «확실»도 아니면 «꺼진 채로» 내놓는다', () => {
  /* ⚠ 이것이 이 커밋의 안전장치다. 예전에는 짝을 찾은 것이 «전부» 그대로 붙었다.
     실측: 그렇게 붙이면 「2021 충청남도 공무직인사위원회」에
     「2022 충청남도청소년진흥원」 위촉장이 조용히 붙었다(앞 네 글자가 같아서). */
  const 약한기록 = { id: 'a', org: '충남청소년진흥원', titleVal: '인사위원', year: '2022' };
  const p = FM.pairUp(파일(['2022 충남도청 공무직인사위원회 위촉장 (2022.02.25).pdf']),
                      [약한기록], 'wiccok', {});
  if (p.matched.length) {
    assert.equal(p.matched[0].on, false,
      '★ 센 증거가 없는 짝이 저절로 켜져 있습니다 — 엉뚱한 원본이 말없이 붙습니다');
    assert.ok(p.matched[0].tier !== '확실', '확신 등급이 «확실»이면 안 됩니다');
  }
});

test('★★ 파일이름이 같은 짝은 «저절로 켜진다» — 사람이 또 손대게 하지 않는다', () => {
  const r = { id: 'a', org: '어떤기관', year: '2020', fname: '2020 어떤기관 위촉장.pdf' };
  const p = FM.pairUp(파일(['2020 어떤기관 위촉장.pdf']), [r], 'wiccok', {});
  assert.equal(p.matched.length, 1);
  assert.equal(p.matched[0].on, true, '★ 확실한 짝이 꺼진 채로 나옵니다');
  assert.equal(p.matched[0].tier, '확실');
});

test('★★ 꼬리 한 자 차이로 «맞는 짝»이 꺼지지 않는다 — 「…청장」 ↔ 「…청」', () => {
  /* 실측: 「행정중심복합도시건설청장」 ↔ 「행정중심복합도시건설청 부정수급심의위원회」.
     기관 이름이 통째로는 안 들어가지만(장), 단서가 여럿 겹쳐 «확실»이다.
     ⚠ 센 증거 «하나만»으로 좁히면 이런 것이 줄줄이 꺼진다(실측에서 16건이 꺼졌다). */
  const r = { id: 'a', org: '행정중심복합도시건설청장', titleVal: '부정수급심의위원회위원', year: '2020' };
  const p = FM.pairUp(파일(['2020 행정중심복합도시건설청 부정수급심의위원회 위촉장 (2020.06.01).pdf']),
                      [r], 'wiccok', {});
  assert.equal(p.matched.length, 1, '★ 짝을 못 찾습니다');
  assert.equal(p.matched[0].on, true,
    '★ 꼬리 한 자 때문에 맞는 짝이 꺼졌습니다 (' + p.matched[0].score + '점 '
    + p.matched[0].tier + ')');
});

test('★ 확신이 «낮은 것부터» 위에 온다 — 눈이 위험한 것에 먼저 가야 한다', () => {
  const db = [{ id: 'hi', org: '어떤기관', year: '2020', fname: '2020 어떤기관 위촉장.pdf' },
              { id: 'lo', org: '충청남도교육청', year: '2020' }];
  const p = FM.pairUp(파일(['2020 어떤기관 위촉장.pdf', '2020 충청남도교육청 위촉장.pdf']),
                      db, 'wiccok', {});
  assert.equal(p.matched.length, 2);
  assert.ok(p.matched[0].score <= p.matched[1].score,
    '★ 점수 높은 것이 위에 있습니다 — 봐야 할 것이 아래에 묻힙니다');
});

test('확신 등급의 경계가 못박혀 있다', () => {
  assert.equal(FM.tierOf(FM.TIER.확실), '확실');
  assert.equal(FM.tierOf(FM.TIER.확실 - 1), '보통');
  assert.equal(FM.tierOf(FM.TIER.보통), '보통');
  assert.equal(FM.tierOf(FM.TIER.보통 - 1), '약함');
  assert.ok(FM.TIER.확실 > FM.TIER.보통, '경계가 뒤집혔습니다');
});

/* ══════════ 앱에 실려 있나 ══════════ */

test('★ 앱이 이 모듈을 싣고 «실제로 쓴다»', () => {
  assert.match(SRC, /kcareer-fnmatch\.js\?v=\d+/, '★ 모듈을 안 싣습니다');
  assert.match(SRC, /KcareerFnMatch\.score\(/, '★ 잣대를 안 씁니다');
  assert.match(SRC, /KcareerFnMatch\.pairUp\(/, '★ 짝짓기를 안 씁니다');
  assert.match(SRC, /KcareerFnMatch\.fnKey\(/, '★ 자를 안 씁니다');
});

test('★★ 켜진 줄만 붙인다 — 체크가 «장식»이면 안 된다', () => {
  /* ⚠ 여기가 풀리면 사람이 끈 짝까지 붙는다 — 확신 낮은 것을 끄는 뜻이 사라진다 */
  const fn = SRC.slice(SRC.indexOf('async function bulkSaveMatched('),
                       SRC.indexOf('/* ===== 상단 탭'));
  assert.ok(fn.length > 100, 'bulkSaveMatched 를 못 찾았습니다');
  assert.match(fn, /_bulkChecked\(\)/, '★ 체크 상태를 읽지 않습니다');
  assert.match(fn, /_bulkCtx\.matched\.filter/, '★ 켜진 것만 걸러내지 않습니다');
  /* 줄을 그리는 쪽에도 체크가 있어야 한다 */
  assert.match(SRC, /class="bulk-chk"/, '★ 줄마다 체크가 없습니다');
  assert.match(SRC, /전부 켜기/, '한꺼번에 켜는 길이 없습니다');
});

test('★ 앱이 hasOriginal 을 «넘겨준다» — 모듈은 앱 상태를 모른다', () => {
  assert.match(SRC, /hasOriginal:\s*hasOriginal/,
    '★ 이미 원본이 있는 것을 뒤로 미룰 수 없습니다');
  /* 모듈은 안 넘기면 그 규칙을 그냥 건너뛴다(터지지 않는다) */
  const r = { id: 'a', org: '충청남도교육청', year: '2020' };
  assert.doesNotThrow(function () { FM.score(FM.fnKey('2020 충청남도교육청.pdf'), r, 'wiccok'); });
  assert.doesNotThrow(function () { FM.score(FM.fnKey('x.pdf'), r, 'wiccok', {}); });
});

test('빈 것·이상한 것에 터지지 않는다', () => {
  assert.doesNotThrow(function () { FM.pairUp([], [], 'wiccok', {}); });
  assert.doesNotThrow(function () { FM.pairUp(null, null, 'wiccok', {}); });
  assert.deepEqual(FM.pairUp([], [], 'wiccok', {}).matched, []);
  assert.equal(FM.recFnFlat(null), '');
  assert.equal(FM.recFnFlat({}), '');
  assert.doesNotThrow(function () { FM.score(FM.fnKey(''), {}, 'wiccok', {}); });
  assert.doesNotThrow(function () { FM.score(FM.fnKey(null), {}, '', {}); });
});

test('★ 짧은 기관 이름이 통째로 들어도 «센 증거»는 아니다', () => {
  /* ⚠ 「충남」·「서산시」·「충남교육청」 같은 짧은 이름은 남의 이름 안에도 흔히 든다.
     그것 하나로 저절로 켜지면 엉뚱한 원본이 말없이 붙는다.
     ⚠ 점수는 주되(+40) «센 증거»로는 세지 않는다 — 여섯 글자 넘을 때만 센 증거다. */
  const 짧은 = { id: 'a', org: '충남교육청', year: '2020' };           /* 다섯 글자 */
  const d1 = FM.scoreDetail(FM.fnKey('2020 충남교육청 위촉장.pdf'), 짧은, 'wiccok', {});
  assert.ok(d1.why.indexOf('기관명 전부') >= 0, '기관명이 통째로 든 것은 점수를 줘야 합니다');
  assert.equal(d1.strong, false,
    '★ 다섯 글자 기관 이름을 센 증거로 봅니다 — 남의 이름에도 흔히 듭니다');
  /* 긴 이름은 센 증거다 */
  const 긴 = { id: 'b', org: '한국산업인력공단', year: '2020' };        /* 여덟 글자 */
  assert.equal(FM.scoreDetail(FM.fnKey('2020 한국산업인력공단 위촉장.pdf'), 긴, 'wiccok', {}).strong,
    true, '긴 기관 이름이 통째로 들면 센 증거여야 합니다');
});

test('★★ 기관 이름이 «통째로» 든 파일이 «앞부분만» 든 파일을 이긴다', () => {
  /* ⚠ 앞 여섯 글자까지 같은 «다른» 기관이 있다:
       한국산업인력공단 / 한국산업인력개발원 → 앞 여섯 글자(한국산업인력)가 같다.
     ⚠ 「기관명 전부 +40」이 없으면 둘이 «같은 점수»가 되어 아무 쪽이나 뽑힌다.
       실측: 180 vs 140 — 그 40이 갈라 주는 유일한 단서다. */
  const r = { id: 'a', org: '한국산업인력공단', year: '2020' };
  const 전부 = FM.score(FM.fnKey('2020 한국산업인력공단 위촉장.pdf'), r, 'wiccok', {});
  const 앞부분 = FM.score(FM.fnKey('2020 한국산업인력개발원 위촉장.pdf'), r, 'wiccok', {});
  assert.ok(전부 > 앞부분,
    '★ 기관 이름이 통째로 든 파일과 앞부분만 든 파일이 안 갈립니다 ('
    + 전부 + ' vs ' + 앞부분 + ')');
  /* 짝짓기에서도 «제 파일»을 가져가야 한다 — 남의 파일을 먼저 놓아도 */
  const p = FM.pairUp([{ name: '2020 한국산업인력개발원 위촉장.pdf' },
                       { name: '2020 한국산업인력공단 위촉장.pdf' }], [r], 'wiccok', {});
  assert.equal(p.matched.length, 1);
  assert.equal(p.matched[0].file.name, '2020 한국산업인력공단 위촉장.pdf',
    '★ 이름이 비슷한 남의 기관 파일을 가져갔습니다');
});

test('같은 점수의 «순서»를 못박아 둔다 — 엔진이 바뀌어도 답이 흔들리지 않게', () => {
  /* ⚠ 이 줄(a.fi-b.fi || a.ri-b.ri)은 «지금 엔진에서는» 결과를 바꾸지 않는다.
     V8 의 sort 는 안정 정렬이라, 같은 점수면 후보를 만든 순서(파일 먼저·기록 다음)가
     그대로 유지되고 그것이 곧 이 순서다. 그래서 고장넣기로 «잡히지 않는다» —
     억지 검사를 지어 붙이지 않고 이렇게 적어 둔다.
     ⚠ 그래도 지우지 말 것: 안정 정렬을 보장하지 않는 엔진에서는 돌릴 때마다 짝이
       달라지고, 「어제 본 짝과 오늘 붙는 짝이 다르다」가 된다.
     여기서는 «지금 답이 늘 같은지»만 못박는다. */
  const files = [{ name: '2020 가기관 위촉장.pdf' }, { name: '2020 가기관 위촉장 사본.pdf' }];
  const db = [{ id: 'r1', org: '가기관', year: '2020' }, { id: 'r2', org: '가기관', year: '2020' }];
  const 첫답 = JSON.stringify(FM.pairUp(files, db, 'wiccok', {}).matched
    .map(function (m) { return m.rec.id + '<-' + m.file.name; }));
  for (let i = 0; i < 20; i++) {
    assert.equal(JSON.stringify(FM.pairUp(files, db, 'wiccok', {}).matched
      .map(function (m) { return m.rec.id + '<-' + m.file.name; })), 첫답,
      '★ 돌릴 때마다 다른 짝이 나옵니다');
  }
});
