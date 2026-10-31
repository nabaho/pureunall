/* 푸른 캘린더(폰) › 칩이 손가락보다 작아 «특정 일정이 안 눌리는» 것 (2026-10-31)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-31 「폰에서 특정 일정을 직접 손으로 터치가 잘 안 된다 · 폰터치 검색 안 된다」.
   실측(375px 폭): 월 칩 높이 12px · 폭 46px · 간격 2px — 손가락 끝(40~50px)보다 작다.

   ★ 이 검사가 지키는 것
     ㉠ 폰 월 달력의 «칩»을 눌러도 그 날 목록이 올라오고, 누른 일정만 강조된다 — 칩의 날은 «손가락이 닿은 칸»으로 잰다(여러 날 막대)
        목록 줄·검색 줄은 칸 밖이라 상세로 간다(안 그러면 영영 상세에 못 간다) · PC 는 그대로(폰()·month·.calgrid 안에서만)
     ㉡ 폰에서 검색하면 «결과 목록»: 앞으로 → 지난 일정(가까운 날 위) · 여러 날 일정은 한 번 · 앞뒤 1년 안 · 건수 상한 · 「달력」으로 그 날로
     ㉢ 손가락 크기 — 폰의 목록 줄·결과 줄·「달력」 단추는 높이 44px 이상(값 자체가 아니라 «기준 이상인가»를 본다)
   ⚠ 날짜는 «오늘»에서 셈해 만든다 — 고정 날짜를 박으면 달이 바뀔 때 검사가 깨진다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');

function 함수몸(head) {
  const i = 캘린더.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = 캘린더.indexOf('{', i); k < 캘린더.length; k++) {
    if (캘린더[k] === '{') d++;
    else if (캘린더[k] === '}') { d--; if (d === 0) return 캘린더.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

const 상자 = { String, Array, Object, Date, JSON, RegExp, Math, parseInt, isFinite };
vm.createContext(상자);
['function esc(s){', 'function arr(v){', 'function todayYMD(){', 'function shiftDay(ymd, n){', 'function matchSearch(e){',
  'function 칩날(e, t){', 'function 검색날짜들(){', 'function 폰검색Html(eumOnly){', 'function 폰목록Html(eumOnly, 날){']
  .forEach((h) => vm.runInContext(함수몸(h), 상자));
vm.runInContext(캘린더.match(/var 검색폭 = [^;]+;/)[0], 상자);

const 실행 = (식) => vm.runInContext(식, 상자);
const 오늘 = 실행('todayYMD()');
const 며칠 = (n) => 실행('shiftDay("' + 오늘 + '", ' + n + ')');

/* 가짜 자료 — eventsOn 은 «날짜 → 일정들» 표에서 꺼내는 가짜(진짜 규칙은 다른 검사가 지킨다) */
function 세팅({ 표 = {}, D = {}, GCAL = { evs: [] }, q = '', hi = null } = {}) {
  상자.D = Object.assign({ my_schedules: [], cal_private: [], attendance_records: [] }, D);
  상자.GCAL = GCAL;
  상자.S = { q, hi, filter: null };
  상자.__표 = 표;
  상자.eventsOn = (ds) => (상자.__표[ds] || []).slice();
  상자.passFilter = () => true;
  상자.공휴칩 = () => null;
  상자.목록순 = () => 0;
}
const 일정 = (id, text, extra) => Object.assign({ kind: 'sch', store: 'my_schedules', id, text, time: '', color: '#123456' }, extra);

/* ─ ㉡ 검색 날짜 후보 ─ */
test('㉡ 날짜 후보 — 일정·나만 보기·근태·구글(걸친 날)에서 모으고, 앞뒤 1년 밖·꼴이 틀린 날짜는 뺀다', () => {
  세팅({
    D: {
      my_schedules: [{ date: 며칠(3) }, { date: 며칠(400) }, { date: '날짜아님' }, null],
      cal_private: [{ date: 며칠(-5) }],
      attendance_records: [{ date: 며칠(10) }, { date: 며칠(-400) }]
    },
    GCAL: { evs: [{ date: 며칠(20), end: 며칠(22) }] }
  });
  const 후보 = JSON.parse(JSON.stringify(실행('검색날짜들()')));
  [3, -5, 10, 20, 21, 22].forEach((n) => assert.ok(후보.indexOf(며칠(n)) >= 0, n + '일 뒤가 후보에 없다'));
  assert.ok(후보.indexOf(며칠(400)) < 0 && 후보.indexOf(며칠(-400)) < 0, '1년 밖이 들어왔다');
  assert.ok(후보.indexOf('날짜아님') < 0);
  assert.deepStrictEqual(후보, 후보.slice().sort(), '날짜순이어야 한다');
});

test('㉡ 아주 긴 여러 날 일정이 날짜를 수백 개 만들지 않는다(상한)', () => {
  세팅({ GCAL: { evs: [{ date: 며칠(1), end: 며칠(300) }] } });
  const 개수 = 실행('검색날짜들().length');
  assert.ok(개수 <= 62, '걸친 날을 ' + 개수 + '개나 만들었다');
});

/* ─ ㉡ 결과 목록 ─ */
test('㉡ 결과 — 앞으로(가까운 날부터) 다음에 지난 일정(가까운 날이 위) · 줄마다 열쇠·날짜·「달력」', () => {
  세팅({
    q: '면담',
    D: { my_schedules: [{ date: 며칠(5) }, { date: 며칠(2) }, { date: 며칠(-3) }, { date: 며칠(-9) }] },
    표: {
      [며칠(5)]: [일정('a5', '면담 다섯째')], [며칠(2)]: [일정('a2', '면담 둘째')],
      [며칠(-3)]: [일정('b3', '면담 사흘전')], [며칠(-9)]: [일정('b9', '면담 아흐레전')]
    }
  });
  const h = 실행('폰검색Html(false)');
  const 순서 = [...h.matchAll(/data-ev="my_schedules:(\w+)"/g)].map((m) => m[1]);
  assert.deepStrictEqual(순서, ['a2', 'a5', 'b3', 'b9']);
  assert.ok(h.indexOf('앞으로 일정 · 2건') >= 0 && h.indexOf('지난 일정 · 2건') >= 0);
  assert.strictEqual((h.match(/class="srow/g) || []).length, 4);
  assert.strictEqual((h.match(/data-sgo="/g) || []).length, 4, '줄마다 「달력」 단추');
  assert.ok(h.indexOf('data-day="' + 며칠(2) + '"') >= 0, '줄에 그 날(사건 기한 상세가 날을 찾는다)');
});

test('㉡ 검색어에 안 맞는 일정은 안 나오고, 아무것도 없으면 안내 한 줄', () => {
  세팅({ q: '없는말', D: { my_schedules: [{ date: 며칠(1) }] }, 표: { [며칠(1)]: [일정('x1', '면담')] } });
  const h = 실행('폰검색Html(false)');
  assert.ok(h.indexOf('data-ev=') < 0);
  assert.ok(h.indexOf('찾는 일정이 없습니다') >= 0);
});

test('㉡ 여러 날 일정은 한 번만 — 걸친 날마다 나오지 않는다', () => {
  const 막대 = 일정('bar', '면담 연수', { end: 며칠(3) });
  세팅({ q: '면담', D: { my_schedules: [{ date: 며칠(1) }] }, 표: { [며칠(1)]: [막대], [며칠(2)]: [막대], [며칠(3)]: [막대] },
    GCAL: { evs: [{ date: 며칠(1), end: 며칠(3) }] } });
  const h = 실행('폰검색Html(false)');
  assert.strictEqual((h.match(/data-ev="my_schedules:bar"/g) || []).length, 1);
});

test('㉡ 제목은 걸러서 그린다(HTML 이 먹히지 않는다) · 나만 보기는 🔒', () => {
  세팅({ q: '면담', D: { my_schedules: [{ date: 며칠(1) }] },
    표: { [며칠(1)]: [일정('s1', '면담 <img src=x onerror=1>'), { kind: 'priv', store: 'cal_private', id: 'p1', text: '면담 개인', time: '09:00', color: '#000' }] } });
  const h = 실행('폰검색Html(false)');
  assert.ok(h.indexOf('<img') < 0 && h.indexOf('&lt;img') >= 0);
  assert.ok(h.indexOf('🔒 면담 개인') >= 0);
});

test('㉡ 건수 상한 — 넘으면 상한까지만 그리고 «좁혀 보라»고 알린다', () => {
  const 상한 = 실행('검색상한');
  const 날들 = []; const 표 = {};
  for (let i = 1; i <= 상한 + 30; i++) { const d = 며칠(i % 300 + 1); 날들.push({ date: d }); (표[d] = 표[d] || []).push(일정('e' + i, '면담 ' + i)); }
  세팅({ q: '면담', D: { my_schedules: 날들 }, 표 });
  const h = 실행('폰검색Html(false)');
  assert.ok((h.match(/class="srow/g) || []).length <= 상한);
  assert.ok(h.indexOf('까지만 보입니다') >= 0);
});

/* ─ ㉠ 칩 → 날 ─ */
test('㉠ 칩의 날 — 손가락이 닿은 «칸»으로 잰다(막대가 칸 위로 겹쳐도) · 못 재면 칩이 달린 칸 · 둘 다 없으면 빈 값', () => {
  const 칸 = (ds) => ({ classList: { contains: (c) => c === 'day' }, getAttribute: (k) => (k === 'data-day' ? ds : null) });
  const 막대 = { classList: { contains: () => false }, getAttribute: () => null };
  상자.document = { elementsFromPoint: () => [막대, 칸('2026-01-14')] };
  assert.strictEqual(실행('칩날({ clientX: 187, clientY: 410 }, { closest: () => null })'), '2026-01-14');
  상자.document = {};   /* elementsFromPoint 없는 브라우저 */
  assert.strictEqual(실행('칩날({ clientX: 1, clientY: 1 }, { closest: () => ({ getAttribute: () => "2026-01-13" }) })'), '2026-01-13');
  assert.strictEqual(실행('칩날({ clientX: 1, clientY: 1 }, { closest: () => null })'), '');
  상자.document = { elementsFromPoint: () => { throw new Error('boom'); } };
  assert.strictEqual(실행('칩날({ clientX: 1, clientY: 1 }, { closest: () => null })'), '', '터지면 빈 값(눌림이 죽지 않는다)');
});

test('㉠ 그날 목록 — 방금 누른 일정 «하나만» 강조(hi) · 안 눌렀으면 아무것도 강조 안 함', () => {
  세팅({ 표: { [오늘]: [일정('k1', '첫째', { time: '09:00' }), 일정('k2', '둘째', { time: '10:00' })] } });
  상자.S.hi = 'my_schedules:k2';
  const h = 실행('폰목록Html(false, "' + 오늘 + '")');
  const 줄들 = h.split('<div class="mrow').slice(1);
  assert.strictEqual(줄들.length, 2);
  assert.ok(/ hi"/.test(줄들.find((x) => x.indexOf('k2') >= 0).slice(0, 40)));
  assert.ok(!/ hi"/.test(줄들.find((x) => x.indexOf('k1') >= 0).slice(0, 40)));
  상자.S.hi = null;
  assert.ok(실행('폰목록Html(false, "' + 오늘 + '")').indexOf(' hi"') < 0);
});

/* ─ 연결 / 규칙 ─ */
function 핸들러() {
  const a = 캘린더.indexOf("★ 폰 월 달력의 «칩»(12px)은 손가락보다 작다");
  assert.ok(a >= 0, '칩 누르기 처리를 못 찾았다');
  return 캘린더.slice(a, a + 1800);
}

test('㉠ 칩 처리는 «폰 · 월 보기 · 달력칸(.calgrid) 안»에서만 — PC·목록 줄·검색 줄은 상세/고치기로 간다', () => {
  const 몸 = 핸들러();
  assert.ok(/t\.hasAttribute\('data-ev'\) && 폰\(\) && S\.view === 'month' && t\.closest && t\.closest\('\.calgrid'\)/.test(몸));
  assert.ok(/S\.pick = 칸날; S\.sheet = true; S\.hi = t\.getAttribute\('data-ev'\)/.test(몸));
  /* 일반 data-ev 처리(상세 열기)보다 «앞»에 있어야 한다 */
  assert.ok(캘린더.indexOf("t.hasAttribute('data-ev') && 폰() && S.view === 'month'") < 캘린더.indexOf("if(t.hasAttribute('data-ev')){\n    var ev = "));
});

test('㉠ 날을 다른 길로 고르면(날 칸·「•••」) 강조를 지운다 — 남은 강조가 엉뚱한 날에 뜨지 않게', () => {
  assert.ok(/S\.pick = 날; S\.sheet = true; S\.hi = null;/.test(캘린더), '「•••」');
  assert.ok(/S\.pick = 날짜; S\.sheet = true; S\.hi = null;/.test(캘린더), '날 칸');
});

test('㉡ 검색 결과 — 폰이고 검색어가 있을 때만 달 칸 대신 목록 · 「달력」 단추가 눌림 목록에 있다', () => {
  assert.ok(/if\(폰머리 && String\(S\.q \|\| ""\)\.replace\(\/\\s\+\/g, ""\) && typeof 폰검색Html === "function"\) return 폰머리 \+ 폰검색Html\(eumOnly\);/.test(캘린더));
  assert.ok(/\[data-gen\],\[data-sgo\]'\)/.test(캘린더), 'data-sgo 가 눌림 목록에 없으면 「달력」이 죽는다');
  assert.ok(/if\(t\.hasAttribute\('data-sgo'\)\)\{[^}]*S\.q = ''; S\.srch = false;[^}]*S\.sheet = true/.test(캘린더));
});

test('㉢ 손가락 크기 — 폰의 목록 줄·결과 줄·「달력」 단추 높이는 44px 이상', () => {
  const 높이 = (선택자) => {
    const m = 캘린더.match(new RegExp(선택자.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{[^}]*min-height:(\\d+)px'));
    assert.ok(m, '높이 한도를 못 찾았다: ' + 선택자);
    return parseInt(m[1], 10);
  };
  ['body.mob .mrow', 'body.mob .srow', 'body.mob .srow .sgo'].forEach((s) => assert.ok(높이(s) >= 44, s + ' 가 ' + 높이(s) + 'px'));
});

test('㉢ 새 모양은 모두 폰(body.mob) 안에서만 — PC 화면은 그대로다', () => {
  const 줄들 = 캘린더.split('\n').filter((l) => /\.(srow|slistq|shd|sfoot|sgo)\b|\.mrow\.hi\b/.test(l) && /\{/.test(l) && !/^\s*(\/\*|function|var|\+|return)/.test(l));
  assert.ok(줄들.length >= 6, '규칙을 못 찾았다: ' + 줄들.length);
  줄들.forEach((l) => assert.ok(/^\s*body\.mob /.test(l), '폰 밖에 걸린 규칙: ' + l.trim().slice(0, 60)));
});
