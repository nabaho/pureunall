/* 푸른 캘린더 — 주·일 보기는 구글 «시간 축 격자» (2026-10-11)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-10 「/goal 완벽하게 구글 캘린더와 똑같이」.

   ★ 이 검사가 지키는 것
     ① 시각 일정은 «시작~끝» 높이로 제 시각에 놓인다(한 시간 48px). 끝이 없으면 한 시간
     ② 이 조직은 시각을 제목 앞에 적는다 — 종일로 들어 있어도 「1000 …」·「1400-1700 …」은 그 시각에 놓는다.
        연도(「2026 일터혁신」)·시각 없는 종일·여러 날·공휴일은 종일 줄이다
     ③ 겹치면 옆으로 나눈다(서로 이어서 겹치는 무리마다 칸 수)
     ④ 날짜 머리는 눌러 일 보기로, 빈 시간 칸을 누르면 «누른 시각»(30분 단위)으로 새 일정 — 위치는 창을 띄우기 «전에» 잰다
     ⑤ 다시 그려도 보던 높이를 지키고, 처음엔 지금(또는 오전 7시) 근처에서 시작 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const 캘린더 = fs.readFileSync(path.join(__dirname, '..', 'pu-cal.html'), 'utf8');
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

function 상자(일정들, 제목시각) {
  const b = { console, String, Object, Array, Number, Math, Date, parseInt, RegExp, JSON,
    esc: (v) => String(v == null ? '' : v),
    eventsOn: (ds) => (일정들[ds] || []), passFilter: () => true, matchSearch: () => true, 공휴칩: () => null };
  vm.createContext(b);
  vm.runInContext('var 격자높이 = 48; var 격자제목시각 = ' + (제목시각 ? 'true' : 'false') + ';', b);
  ['function 제목시간범위(title){', 'function 격자분(hm){', 'function 격자일정(ds, eumOnly){', 'function 겹침배치(목록){',
   'function 격자글자색(바탕){', 'function 시각글(hm){', 'function 시간블록Html(x){']
    .forEach((h) => vm.runInContext(함수몸(h), b));
  return b;
}
const 값 = (b, 식) => JSON.parse(JSON.stringify(vm.runInContext(식, b)));

test('② 제목 앞 시각 — 「1000」·「1400-1700」은 읽고, 연도·날짜·시각 없음은 안 읽는다', () => {
  const b = 상자({});
  const 범위 = (t) => 값(b, '제목시간범위(' + JSON.stringify(t) + ')');
  assert.deepStrictEqual(범위('1000 에스에이씨 최종보고'), { s: 600, t: 660 });
  assert.deepStrictEqual(범위('1400-1700 서울여성플라자'), { s: 840, t: 1020 });
  assert.deepStrictEqual(범위('0950-1200 공주고용센터'), { s: 590, t: 720 });
  assert.deepStrictEqual(범위('10:30 미팅'), { s: 630, t: 690 });
  assert.deepStrictEqual(범위('1700-1600 거꾸로'), { s: 1020, t: 1080 }, '끝이 시작보다 이르면 한 시간');
  for (const t of ['2026 일터혁신 31차 신청 마감', '2026년 계획', '2026-10 점검', '김완재 이음센터', '15 00 노사', '2460 이상', '']) {
    assert.strictEqual(범위(t), null, '시각으로 읽으면 안 됩니다: ' + t);
  }
});

test('①② 그날의 일 가르기 — 시각 일정은 격자, 종일은 종일 줄(구글처럼) · 제목 시각은 켰을 때만', () => {
  const ds = '2026-10-14';
  const 일 = [
    { store: 'gcal', id: 'a', text: '방문', time: '14:00', endAt: Date.parse('2026-10-14T15:30:00+09:00'), date: ds, end: ds },
    { store: 'gcal', id: 'b', text: '오늘 밤 일정', time: '22:00', endAt: Date.parse('2026-10-15T01:00:00+09:00'), date: ds, end: ds },
    { store: 'sch', id: 'c', text: '우리 일정', time: '09:00', endTime: '10:30' },
    { store: 'sch', id: 'd', text: '끝 없음', time: '11:00' },
    { store: 'gcal', id: 'e', text: '1000 종일인데 제목에 시각', time: '', date: ds, end: ds },
    { store: 'gcal', id: 'f', text: '2026 일터혁신 마감', time: '', date: ds, end: ds },
    { store: 'gcal', id: 'g', text: '0900 여러 날', time: '', date: ds, end: '2026-10-16' },
    { store: 'gcal', id: 'h', text: '시각 없는 종일', time: '', date: ds, end: ds },
  ];
  /* ① 기본(끔) — 구글 공식 주 보기를 열어 재 보니 종일 일정은 «종일 줄의 칩»이고 시간 칸은 비어 있다 */
  const r = 값(상자({ [ds]: 일 }), '격자일정("2026-10-14", false)');
  const 시 = {}; r.시간.forEach((x) => { 시[x.e.id] = [x.s, x.t]; });
  assert.deepStrictEqual(시.a, [840, 930]);
  assert.deepStrictEqual(시.b, [1320, 1440], '밤을 넘기면 자정에서 끊는다');
  assert.deepStrictEqual(시.c, [540, 630]);
  assert.deepStrictEqual(시.d, [660, 720], '끝이 없으면 한 시간');
  assert.deepStrictEqual(Object.keys(시).sort(), ['a', 'b', 'c', 'd'], '종일 일정이 시간 칸에 놓였습니다(구글은 종일 줄에 둔다)');
  assert.deepStrictEqual(r.종일.map((e) => e.id).sort(), ['e', 'f', 'g', 'h'], '종일·여러 날은 종일 줄');
  /* ② 켜면(격자제목시각 = true) — 제목 앞 시각으로 시간 칸에 놓되 연도·여러 날·시각 없음은 종일 줄 */
  const r2 = 값(상자({ [ds]: 일 }, true), '격자일정("2026-10-14", false)');
  const 시2 = {}; r2.시간.forEach((x) => { 시2[x.e.id] = [x.s, x.t]; });
  assert.deepStrictEqual(시2.e, [600, 660], '켰는데 종일의 제목 시각을 안 읽습니다');
  assert.deepStrictEqual(r2.종일.map((e) => e.id).sort(), ['f', 'g', 'h']);
  assert.match(캘린더, /var 격자제목시각 = false;/, '기본값이 구글과 달라졌습니다(꺼져 있어야 한다)');
});

test('③ 겹치면 옆으로 — 이어서 겹치는 무리마다 칸 수', () => {
  const b = 상자({});
  const 배치 = (a) => 값(b, '겹침배치(' + JSON.stringify(a) + ')').map((x) => [x.s, x.col, x.cols]);
  assert.deepStrictEqual(배치([{ s: 600, t: 660 }, { s: 630, t: 720 }]), [[600, 0, 2], [630, 1, 2]]);
  assert.deepStrictEqual(배치([{ s: 600, t: 660 }, { s: 660, t: 720 }]), [[600, 0, 1], [660, 0, 1]], '맞닿기만 하면 안 겹친다');
  assert.deepStrictEqual(배치([{ s: 600, t: 720 }, { s: 610, t: 690 }, { s: 620, t: 680 }, { s: 700, t: 760 }]),
    [[600, 0, 3], [610, 1, 3], [620, 2, 3], [700, 1, 3]], '세 겹 — 끝난 칸을 다시 쓴다');
});

test('① 블록 — 위치·높이·너비, 짧아도 22px, 시각 줄은 높을 때만, 밝은 칩은 어두운 글자', () => {
  const b = 상자({});
  const 블록 = (x) => vm.runInContext('시간블록Html(' + JSON.stringify(x) + ')', b);
  const 긴 = 블록({ s: 600, t: 720, col: 1, cols: 2, e: { store: 'gcal', id: 'x', text: '방문', color: '#039be5', tip: '' } });
  assert.match(긴, /top:480px;height:96px;left:50%;width:50%/, '10시 시작 두 시간 · 둘째 칸');
  assert.match(긴, /오전 10:00 – 오후 12:00/, '시각 줄(구글 꼴)이 없습니다');
  assert.match(긴, /data-ev="gcal:x"/, '눌러 여는 길이 칩과 다릅니다');
  const 짧은 = 블록({ s: 600, t: 615, col: 0, cols: 1, e: { store: 'gcal', id: 'y', text: '짧음', color: '#f6bf26', tip: '' } });
  assert.match(짧은, /height:22px/, '짧은 일정이 안 눌릴 만큼 낮습니다');
  assert.ok(!/<span>/.test(짧은), '낮은 블록에 시각 줄이 들어갑니다');
  assert.match(짧은, /color:#1f1f1f/, '밝은 노랑에 어두운 글자를 안 씁니다');
});

test('④⑤ 처리 — 머리 날짜는 일 보기로 · 빈 칸은 «누른 시각» · 높이 보존', () => {
  assert.match(캘린더, /if\(t\.hasAttribute\('data-gotoday'\)\)\{[^}]*S\.view = 'day'/, '머리 날짜를 눌러도 일 보기로 안 갑니다');
  const 길 = 캘린더.slice(캘린더.indexOf("if(t.hasAttribute('data-day')){"));
  const 잼 = 길.indexOf('var 분 = ('), 열기 = 길.indexOf('openNew(날짜);');
  assert.ok(잼 > 0 && 열기 > 잼, '★ 누른 위치를 창을 띄운 «뒤»에 잽니다 — 판이 다시 그려져 엉뚱한 시각이 들어갑니다');
  assert.match(길, /Math\.min\(1439, \(e\.clientY/, '밤 11시 30분 칸까지 눌려야 합니다');
  assert.match(캘린더, /var 옛격자 = document\.querySelector\('\.tgscroll'\)/, '다시 그릴 때 보던 높이를 안 지킵니다');
  assert.match(캘린더, /if\(S\.view === 'week' \|\| S\.view === 'day' \|\| S\.view === '3day'\) S\.gridScroll = true;/, '들어올 때 지금 근처로 안 내려갑니다');
  assert.match(함수몸('function weekHtml(eumOnly){'), /격자Html\(weekDays\(S\.date\), eumOnly\)/);
  assert.match(함수몸('function dayHtml(eumOnly){'), /격자Html\(\[S\.date\], eumOnly\)/);
});

test('PC 머리 크기 — 구글 공식 주 보기 실측(요일 11px·줄 32px, 날짜 26px·줄 46px, 오늘 46px 원), 종일 칩 왼쪽 여백 8px', () => {
  assert.match(캘린더, /@media \(min-width:701px\)\{\s*\.tgh\{padding:0\}\s*\.tgh \.gwd\{font-weight:500;line-height:32px\}\s*\.tgh \.gdn\{font-size:26px;line-height:46px;min-width:46px;width:46px\}/);
  assert.match(캘린더, /@media \(min-width:701px\)\{ \.tga \.ev\{padding-left:8px\} \}/);
  assert.match(캘린더, /\.tgh \.gdn\{font-size:22px;line-height:36px;min-width:36px/, '폰의 작은 값이 사라졌습니다');
});

test('폰 한 시간 높이 62px(구글 폰 앱 캡처) · PC 48px — 눈금선도 같이 따라간다', () => {
  assert.match(캘린더, /격자높이 = \(typeof 폰 === "function" && 폰\(\)\) \? 62 : 48;/);
  assert.match(캘린더, /background-size:100% var\(--hh,48px\)/);
  assert.match(캘린더, /;--hh:' \+ 격자높이 \+ 'px;height:'/);
});
