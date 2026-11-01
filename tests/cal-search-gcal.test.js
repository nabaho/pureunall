/* 푸른 캘린더(폰) › 검색이 «다른 달 구글 일정»까지 찾는 것 (2026-11-01)
   ═════════════════════════════════════════════════════════════════
   대표 지시 2026-11-01 「다른 달의 구글 일정까지 검색되게 하기 (앞뒤 3개월 정도 권합니다)」.
   까닭: 달력은 «보고 있는 달» 구글 일정만 받아 둔다(GCAL.evs). 폰 검색은 그 안에서만 찾아서 다른 달 일정은 «없다»고 나왔다.

   ★ 이 검사가 지키는 것
     ㉠ 검색용으로 따로 받아 둔다(GSRCH) — 쪽 넘김을 따라가고, 10분 안에는 다시 안 받고, 일정이 바뀌면(gcalLoad(true)) 다시 받는다
     ㉡ 검색 «결과 목록»에서만 합친다 — 보고 있는 달 칸·그날 목록에는 다른 달 일정이 새지 않는다(켜진 채 남거나 오류가 나도 꺼진다)
     ㉢ 보고 있는 달과 겹치는 날은 GCAL 쪽이 진실이다 — 지워진 일정이 검색용 옛 사본으로 되살아나지 않는다
     ㉣ 다른 달 일정도 눌러 상세가 열린다(구글상세·고치기가 검색용 사본도 찾는다)
     ㉤ 받는 중·못 받음·정상 안내가 다르다 — 못 받았는데 «없다»고 거짓말하지 않는다
   ⚠ 날짜는 «오늘»에서 셈해 만든다 — 고정 날짜를 박으면 달이 바뀔 때 검사가 깨진다.
   ⚠ 「3개월」은 값이 아니라 «받는 범위와 안내가 같은 숫자인가»를 본다(검색구글일 하나로 정해진다). */
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

const 상자 = { String, Array, Object, Date, JSON, RegExp, Math, parseInt, isFinite, Promise, encodeURIComponent, Error };
vm.createContext(상자);
['function esc(s){', 'function arr(v){', 'function todayYMD(){', 'function shiftDay(ymd, n){', 'function matchSearch(e){',
  'function 구글목록(){', 'function 구글찾기(id){', 'function 검색구글받기(){', 'function 검색날짜들(){',
  'function 폰검색Html(eumOnly){', 'function eventsOn(ymd, eumOnly){']
  .forEach((h) => vm.runInContext(함수몸(h), 상자));
['var 검색폭 = [^;]+;', 'var 검색구글일 = [^;]+;', 'var GSRCH = [^;]+;', 'var _검색합침 = [^;]+;', 'var ATT_SHOW = \\[[^\\]]+\\];']
  .forEach((p) => vm.runInContext(캘린더.match(new RegExp(p))[0], 상자));

const 실행 = (식) => vm.runInContext(식, 상자);
const 오늘 = 실행('todayYMD()');
const 며칠 = (n) => 실행('shiftDay("' + 오늘 + '", ' + n + ')');
const 구글 = (id, text, date, end) => ({ kind: 'gcal', store: 'gcal', id, sid: 'GCAL', date, end: end || date, time: '', text, color: '#87ac5c', tip: text });

/* 보고 있는 달(GCAL 창)을 «오늘 앞뒤 ±5일»로 둔다 — 창은 첫날~끝날(끝날 포함 안 함) */
function 세팅({ 달 = [], 검색 = [], 창 = [-5, 6], q = '', 오류 = '' } = {}) {
  상자.D = { my_schedules: [], cal_private: [], attendance_records: [] };
  상자.GCAL = { evs: 달, ym: 며칠(창[0]) + '~' + 며칠(창[1]), loading: false, err: 오류 };
  상자.GSRCH = { evs: 검색, 날: '', at: 0, loading: false, err: '' };
  상자.S = { q, filter: null };
  상자.passFilter = () => true;
  실행('_검색합침 = false;');
}
const 누리 = (h) => [...h.matchAll(/data-ev="gcal:([^"]+)"/g)].map((m) => m[1]);

/* ─ ㉡ 합치기는 검색 결과 목록에서만 ─ */
test('㉡ 검색 결과 목록에는 다른 달 구글 일정이 나온다 — 받아 둔 것(GSRCH)에서', () => {
  세팅({ q: '면담', 검색: [구글('far', '면담 먼 달', 며칠(40))] });
  assert.deepStrictEqual(누리(실행('폰검색Html(false)')), ['far']);
});

test('㉡ 월 칸·그날 목록(eventsOn)에는 다른 달 일정이 새지 않는다 — 검색 목록을 그린 뒤에도', () => {
  세팅({ q: '면담', 검색: [구글('far', '면담 먼 달', 며칠(40))] });
  assert.strictEqual(실행('eventsOn("' + 며칠(40) + '", false).length'), 0, '검색 전부터 샌다');
  실행('폰검색Html(false)');
  assert.strictEqual(실행('eventsOn("' + 며칠(40) + '", false).length'), 0, '검색 목록을 그린 뒤 합침이 켜진 채 남았다');
});

test('㉡ 그리다 오류가 나도 합침은 꺼진다(finally) — 켜진 채 남으면 월 칸에 다른 달이 샌다', () => {
  세팅({ q: '면담', 검색: [구글('far', '면담 먼 달', 며칠(40))] });
  상자.passFilter = () => { throw new Error('일부러'); };
  assert.throws(() => 실행('폰검색Html(false)'));
  assert.strictEqual(실행('_검색합침'), false);
  assert.ok(/_검색합침 = true;[\s\S]{0,400}try\{[\s\S]{0,900}\} finally \{ _검색합침 = false; \}/.test(캘린더), 'try/finally 가 없다');
});

test('㉡ 합침을 켜는 곳은 폰검색Html 하나뿐이다 — 다른 데서 켜면 월 칸이 샌다', () => {
  const 켠곳 = 캘린더.match(/_검색합침 = true/g) || [];
  assert.strictEqual(켠곳.length, 1);
  assert.ok(함수몸('function 폰검색Html(eumOnly){').indexOf('_검색합침 = true') >= 0);
});

/* ─ ㉢ 보고 있는 달은 GCAL 이 진실 ─ */
test('㉢ 보고 있는 달과 겹치는 검색용 사본은 뺀다 — 그 달에서 지워진 일정이 되살아나지 않는다', () => {
  세팅({ q: '면담', 달: [구글('live', '면담 살아있음', 며칠(0))],
    검색: [구글('live', '면담 살아있음', 며칠(0)), 구글('gone', '면담 지워진 것', 며칠(1)), 구글('far', '면담 먼 달', 며칠(40))] });
  assert.deepStrictEqual(누리(실행('폰검색Html(false)')).sort(), ['far', 'live']);
});

test('㉢ 걸친 여러 날 일정 — 창 안으로 들어오는 것은 뺀다 · 창 밖에서 끝나는 것은 낸다', () => {
  세팅({ q: '면담', 검색: [구글('into', '면담 걸침', 며칠(-30), 며칠(-4)), 구글('out', '면담 밖', 며칠(-30), 며칠(-10))] });
  assert.deepStrictEqual(누리(실행('폰검색Html(false)')), ['out']);
});

test('㉢ 같은 아이디는 한 번만 — 달 쪽(GCAL)이 이긴다', () => {
  세팅({ q: '면담', 달: [구글('same', '면담 달 쪽', 며칠(0))], 검색: [구글('same', '면담 검색 쪽', 며칠(40))] });
  const 목록 = JSON.parse(JSON.stringify(실행('(function(){ _검색합침 = true; var r = 구글목록(); _검색합침 = false; return r; })()')));
  assert.strictEqual(목록.filter((x) => x.id === 'same').length, 1);
  assert.strictEqual(목록.find((x) => x.id === 'same').text, '면담 달 쪽');
});

test('㉢ 합침이 꺼져 있으면(월 칸) 달에 받아 둔 것만 — 검색용은 안 섞인다', () => {
  세팅({ 검색: [구글('far', '먼 달', 며칠(40))] });
  assert.strictEqual(실행('구글목록().length'), 0);
});

/* ─ ㉣ 눌러서 상세 ─ */
test('㉣ 구글찾기 — 달에 없으면 검색용에서 찾고, 둘 다 있으면 달 쪽', () => {
  세팅({ 달: [구글('a', '달 쪽', 며칠(0))], 검색: [구글('a', '검색 쪽', 며칠(0)), 구글('b', '검색에만', 며칠(40))] });
  assert.strictEqual(실행('구글찾기("a").text'), '달 쪽');
  assert.strictEqual(실행('구글찾기("b").text'), '검색에만');
  assert.strictEqual(실행('구글찾기("없음")'), null);
});

test('㉣ 상세(구글상세)·고치기(openGcalEdit)가 «달에 없으면 검색용에서» 찾는다 — 안 그러면 눌러도 못 연다', () => {
  assert.ok(/function 구글상세\(id\)\{[\s\S]*?typeof 구글찾기 === "function"[\s\S]*?구글찾기\(id\)/.test(캘린더));
  assert.ok(/function openGcalEdit\(gid, 직접\)\{[\s\S]*?typeof 구글찾기 === "function"[\s\S]*?구글찾기\(gid\)/.test(캘린더));
});

/* ─ ㉠ 받는 길 ─ */
function 가짜받기(쪽들, { 오류 = null } = {}) {
  const 불림 = [];
  상자.fetch = (url) => {
    불림.push(url);
    if (오류) return Promise.resolve({ json: () => ({ error: { message: 오류 } }) });
    const 쪽 = 쪽들[불림.length - 1] || { items: [] };
    return Promise.resolve({ json: () => 쪽 });
  };
  상자.gcalLoadColors = () => Promise.resolve();
  상자.gcalToEvent = (ev) => 구글(ev.id, ev.summary, ev.start.date);
  상자.GCAL_CAL_ID = 'cal@example.invalid';
  상자.GCAL_API_KEY = 'KEY';
  상자.__그림 = 0;
  상자.render = () => { 상자.__그림++; };
  return 불림;
}
const 일 = (id, n) => ({ id, summary: id, start: { date: 며칠(n) } });

test('㉠ 쪽을 넘겨 가며 끝까지 받는다 · 범위는 오늘 앞뒤 «검색구글일»일 · 받은 뒤 검색 중이면 다시 그린다', async () => {
  세팅({ q: '면담' });
  const 불림 = 가짜받기([{ items: [일('p1', 10)], nextPageToken: 'T2' }, { items: [일('p2', -20)] }]);
  await 실행('검색구글받기()');
  assert.strictEqual(불림.length, 2, '쪽 넘김을 안 따라갔다');
  assert.ok(/pageToken=T2/.test(불림[1]));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(실행('GSRCH.evs.map(function(x){return x.id;})'))), ['p1', 'p2']);
  const 폭 = 실행('검색구글일');
  const 첫 = decodeURIComponent(불림[0].match(/timeMin=([^&]+)/)[1]), 끝 = decodeURIComponent(불림[0].match(/timeMax=([^&]+)/)[1]);
  assert.strictEqual(첫.slice(0, 10), 며칠(-폭));
  assert.strictEqual(끝.slice(0, 10), 며칠(폭 + 1));
  assert.ok(상자.__그림 >= 1, '받은 뒤 다시 안 그린다');
  assert.strictEqual(실행('GSRCH.loading'), false);
});

test('㉠ 검색어가 없으면 받고도 다시 그리지 않는다(쓸데없는 깜빡임 금지)', async () => {
  세팅({ q: '' });
  가짜받기([{ items: [일('p1', 10)] }]);
  await 실행('검색구글받기()');
  assert.strictEqual(상자.__그림, 0);
});

test('㉠ 10분 안에는 다시 안 받는다 · 받는 중에도 겹쳐 안 받는다 · 일정이 바뀌면(at=0) 다시 받는다', async () => {
  세팅({ q: '면담' });
  const 불림 = 가짜받기([{ items: [일('p1', 10)] }]);
  const 첫 = 실행('검색구글받기()');
  실행('검색구글받기()');                                     /* 받는 중 — 겹침 */
  await 첫;
  assert.strictEqual(불림.length, 1, '받는 중에 또 받았다');
  await 실행('검색구글받기()');
  assert.strictEqual(불림.length, 1, '10분 안에 또 받았다');
  실행('GSRCH.at = 0;');                                       /* gcalLoad(true) 가 하는 일 */
  await 실행('검색구글받기()');
  assert.strictEqual(불림.length, 2, '바뀐 뒤에도 안 받는다');
});

test('㉠ 날이 바뀌면(자정 지나면) 다시 받는다', async () => {
  세팅({ q: '면담' });
  const 불림 = 가짜받기([{ items: [] }]);
  await 실행('검색구글받기()');
  실행('GSRCH.날 = "1999-01-01";');
  await 실행('검색구글받기()');
  assert.strictEqual(불림.length, 2);
});

test('㉠ gcalLoad(true) 는 검색용을 «다시 받게» 비운다 — 연결', () => {
  assert.ok(/function gcalLoad\(force\)\{\s*if\(force && typeof GSRCH !== "undefined"\) GSRCH\.at = 0;/.test(캘린더));
});

test('㉠ 못 받으면 «받은 만큼은 두고» 오류를 적고, 곧바로는 안 다시 받는다(무한 반복 금지)', async () => {
  세팅({ q: '면담' });
  const 불림 = 가짜받기([], { 오류: '할당량' });
  await 실행('검색구글받기()');
  assert.ok(/할당량/.test(실행('GSRCH.err')));
  assert.strictEqual(실행('GSRCH.loading'), false);
  await 실행('검색구글받기()');
  assert.strictEqual(불림.length, 1, '실패 직후 또 받았다');
  assert.ok(실행('Date.now() - GSRCH.at < 600000'), '실패 뒤 다시 받아 볼 때가 «나중»이어야 한다');
});

test('㉠ 검색어를 칠 때만(폰·검색어 있음) 받기 시작한다 — 연결', () => {
  assert.ok(/if\(폰머리 && String\(S\.q \|\| ""\)[^{]*\{[^}]*검색구글받기\(\)[^}]*return 폰머리 \+ 폰검색Html\(eumOnly\);/.test(캘린더));
  assert.strictEqual((캘린더.match(/검색구글받기\(\)/g) || []).length >= 2, true);
});

/* ─ ㉤ 안내 ─ */
test('㉤ 안내 — 받는 중 · 못 받음 · 정상이 서로 다르고, 정상 안내의 개월 수는 받는 범위와 같다', () => {
  세팅({ q: '면담', D: undefined, 검색: [구글('far', '면담 먼 달', 며칠(40))] });
  const 개월 = Math.round(실행('검색구글일') / 30);
  const 정상 = 실행('폰검색Html(false)');
  assert.ok(정상.indexOf('앞뒤 ' + 개월 + '개월까지 찾아집니다') >= 0, '정상 안내의 개월 수가 받는 범위와 다르다');
  /* 범위를 바꿔도 안내가 따라간다(안내만 숫자를 박아 두면 범위만 고칠 때 거짓말이 된다) */
  const 원래 = 실행('검색구글일');
  실행('검색구글일 = 150;');
  assert.ok(실행('폰검색Html(false)').indexOf('앞뒤 5개월까지 찾아집니다') >= 0, '범위를 바꿨는데 안내가 그대로다');
  실행('검색구글일 = ' + 원래 + ';');
  실행('GSRCH.loading = true;');
  const 받는중 = 실행('폰검색Html(false)');
  assert.ok(받는중.indexOf('받는 중') >= 0 && 받는중.indexOf('찾아집니다') < 0);
  실행('GSRCH.loading = false; GSRCH.err = "x";');
  const 못받음 = 실행('폰검색Html(false)');
  assert.ok(못받음.indexOf('받지 못했습니다') >= 0 && 못받음.indexOf('찾아집니다') < 0);
});

test('㉤ 결과가 없어도 안내는 나온다 — 받는 중이면 «없다» 대신 «찾는 중»', () => {
  세팅({ q: '없는말' });
  실행('GSRCH.loading = true;');
  const 중 = 실행('폰검색Html(false)');
  assert.ok(중.indexOf('찾는 중') >= 0 && 중.indexOf('찾는 일정이 없습니다') < 0, '받는 중인데 «없다»고 한다');
  실행('GSRCH.loading = false;');
  const 끝 = 실행('폰검색Html(false)');
  assert.ok(끝.indexOf('찾는 일정이 없습니다') >= 0 && 끝.indexOf('class="sfoot"') >= 0);
});
