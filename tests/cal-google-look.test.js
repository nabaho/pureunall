/* 푸른 캘린더 — 구글 캘린더 화면과 «같은 꼴» (대표 지시 2026-09-27)
   ═══════════════════════════════════════════════════════════════════════════
   「캘린더 ui 와 화면을 구글캘린더 화면과 글자색·테두리·글자형태로 완벽하게 같이 …
    담당자 색깔 이름글자 저장방식 색깔 테두리 관리 공휴일 처리 등 완벽하게 같이」

   ★ 구글 캡처와 우리 캡처를 나란히 놓고 갈린 자리를 하나씩 옮겼다:
     ① 색 — 구글 색표 API 는 2012년 «옛 연한 색»(#a4bdfc…)을 준다. 구글 화면은 같은
        번호를 요즘 색(라벤더 #7986cb…)으로 칠한다. 옛 색을 그대로 써서 물 빠져 보였다.
     ② 종일 일정 — 색을 꽉 채운 칩 + 흰 글자. 지난 것은 옅게 + 회색 글자.
        (예전 판은 «남의 일정은 옅게 + 왼쪽 띠» 였다 — 구글엔 그런 구별이 없다)
     ③ 시각 일정 — 바탕 없이 «색 점 · 10:30 · 제목».
     ④ 여러 날 일정 — 칸마다 따로가 아니라 «한 줄 막대»로 칸을 가로지른다.
     ⑤ 공휴일 — 보통 칩(「대한민국의 휴일」 달력 색). 칸 옆까지 번지는 띠가 아니다.
   ★ 값(색 번호·픽셀)이 아니라 «규칙»을 본다 — 실제로 chipHtml·줄배치를 돌려 본다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

function 함수몸(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

function 상자(theme) {
  const b = {
    console, String, Object, Array, JSON, Math, Date, parseInt,
    S: { theme: theme || 'light' },
    ME: { sid: 'S001', name: '나' },
    todayYMD: () => '2026-09-27',
    esc: (s) => String(s == null ? '' : s)
  };
  vm.createContext(b);
  ['function mixHex(hexA, hexB, t){', 'function chipHtml(e, ymd){', 'function 줄배치(날들, 일들, 용량, 틈){']
    .forEach((h) => vm.runInContext(함수몸(캘린더, h), b));
  return b;
}
function 칩(b, e, ymd) {
  b.__e = e;
  vm.runInContext('var __h = chipHtml(__e, ' + JSON.stringify(ymd || e.date || '2026-09-30') + ');', b);
  return b.__h;
}
function 바탕(html) { const m = html.match(/background:(#[0-9a-f]{6})/i); return m ? m[1].toLowerCase() : ''; }
function 밝기(h) {
  const n = parseInt(h.slice(1), 16);
  return 0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255);
}

const 색 = '#33b679';
const 올일 = { store: 'gcal', id: 'a', sid: 'P-002', date: '2026-09-30', end: '2026-09-30', color: 색, text: '가나상사 방문', tip: '' };

test('② 올 종일 일정은 «그 사람 색으로 꽉» + 흰 글자, 테두리·왼쪽 띠가 없다', () => {
  const h = 칩(상자(), 올일);
  assert.strictEqual(바탕(h), 색, '바탕이 사람 색 그대로가 아닙니다: ' + h);
  assert.match(h, /color:#ffffff/, '글자가 흰색이 아닙니다: ' + h);
  assert.strictEqual(/border-left/.test(h), false, '왼쪽 띠가 남았습니다 — 구글엔 없습니다: ' + h);
});

test('② 지난 종일 일정은 옅게 — 바탕이 사람 색보다 밝고, 흰색도 아니다', () => {
  const h = 칩(상자(), Object.assign({}, 올일, { date: '2026-09-01', end: '2026-09-01' }), '2026-09-01');
  const bg = 바탕(h);
  assert.ok(bg && bg !== 색, '지난 일정이 옅어지지 않았습니다: ' + h);
  assert.ok(밝기(bg) > 밝기(색) + 40, '지난 일정이 충분히 옅지 않습니다: ' + bg);
  assert.ok(bg !== '#ffffff', '지난 일정 색이 지워졌습니다(흰색) — 누구 일인지 안 보입니다');
  assert.strictEqual(/color:#ffffff/.test(h), false, '옅은 바탕에 흰 글자는 안 읽힙니다: ' + h);
});

test('②★ 여러 날 일정은 «마지막 날»이 지나야 옅어진다 — 걸쳐 있는 동안은 진하다', () => {
  const h = 칩(상자(), Object.assign({}, 올일, { date: '2026-09-25', end: '2026-09-29' }), '2026-09-25');
  assert.strictEqual(바탕(h), 색, '아직 안 끝난 연차가 옅어졌습니다: ' + h);
});

test('③ 시각 일정은 바탕 없이 «색 점 · 시각 · 제목»', () => {
  const h = 칩(상자(), Object.assign({}, 올일, { time: '10:30' }));
  assert.match(h, /data-g="t"/, '시각 일정 꼴로 안 그립니다: ' + h);
  assert.match(h, /class="gdot"[^>]*background:#33b679/, '색 점이 없거나 사람 색이 아닙니다: ' + h);
  assert.match(h, />10:30</, '시각을 「10:30」으로 안 적습니다: ' + h);
  /* 바깥 칩(첫 div)의 style 만 본다 — 안쪽 점은 색이 있는 게 맞다 */
  const 겉 = (h.match(/^<div[^>]*?style="([^"]*)"/) || [])[1] || '';
  assert.strictEqual(/background/.test(겉), false, '시각 일정을 색으로 채웠습니다: ' + 겉);
});

test('㉱ 내 일정·남의 일정이 «같은 꼴» — 구글 화면엔 그런 구별이 없다', () => {
  const b = 상자();
  const 남 = 칩(b, 올일);
  const 나 = 칩(b, Object.assign({}, 올일, { sid: 'S001' }));
  assert.strictEqual(나, 남, '내 일정만 다르게 그립니다');
});

test('㉲ 칩 머리의 그림글자(🏛️ 🏖️)는 칩에 안 그린다 — 구글 화면에 없다', () => {
  const h = 칩(상자(), Object.assign({}, 올일, { text: '🏛️ 홍길동 이음센터', tip: '🏛️ 홍길동 이음센터' }));
  assert.match(h, />홍길동 이음센터</, '글자가 사라졌습니다: ' + h);
  assert.strictEqual(/>🏛/.test(h), false, '칩에 그림글자가 남았습니다: ' + h);
});

test('⑤ 공휴일 칩은 끌어 옮길 수 없고, 보통 칩처럼 색이 채워진다', () => {
  const b = 상자();
  vm.runInContext((캘린더.match(/var 공휴색 = [^;]+;/) || [''])[0], b);
  vm.runInContext('function holidayOf(){ return "추석"; }' + 함수몸(캘린더, 'function 공휴칩(ymd){')
    + ' var __c = 공휴칩("2026-09-30");', b);
  const h = 칩(b, b.__c, '2026-09-30');
  assert.match(h, /class="ev hol"/, '공휴일 칩이 아닙니다: ' + h);
  assert.strictEqual(/draggable/.test(h), false, '공휴일을 끌 수 있습니다: ' + h);
  assert.ok(바탕(h), '공휴일 칩에 색이 없습니다: ' + h);
});

/* ── ④ 여러 날 막대 ── */
const 주 = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26'];
function 배치(일들, 용량) {
  const b = 상자();
  b.__a = [주, 일들, 용량, 9];
  vm.runInContext('var __r = 줄배치(__a[0], __a[1], __a[2], __a[3]);', b);
  return b.__r;
}
const 연차 = { store: 'gcal', id: 'L', sid: 'P-003', date: '2026-09-21', end: '2026-09-23', color: '#0b8043', text: '최기운 연차', tip: '' };
const 하루 = (id, ds) => ({ store: 'gcal', id: id, sid: 'P-002', date: ds, end: ds, color: 색, text: '일 ' + id, tip: '' });

test('④★ 사흘 연차는 «첫날 한 번» 막대로 그리고, 나머지 두 날은 빈 자리로 줄을 맞춘다', () => {
  const 일들 = 주.map((ds) => (ds >= 연차.date && ds <= 연차.end) ? [연차] : []);
  일들[2] = [하루('x', '2026-09-22'), 연차];      // 둘째 날엔 하루짜리가 «먼저» 들어 있어도
  const r = 배치(일들, 5);
  assert.match(r[1].html, /width:calc\(300% \+ 18px\)/, '첫날 막대가 사흘을 안 건넙니다: ' + r[1].html);
  assert.strictEqual((r[1].html.match(/최기운 연차/g) || []).length, 1);
  assert.strictEqual(/최기운 연차/.test(r[2].html + r[3].html), false, '연차를 날마다 또 찍었습니다');
  /* 막대는 맨 윗줄 — 둘째 날의 하루짜리는 막대 «밑»으로 내려가야 겹치지 않는다 */
  assert.ok(r[2].html.indexOf('evph') >= 0 && r[2].html.indexOf('evph') < r[2].html.indexOf('일 x'),
    '둘째 날에 막대 자리를 안 비웠습니다(겹칩니다): ' + r[2].html);
  assert.match(r[3].html, /^<div class="evph"><\/div>$/, '셋째 날 줄이 안 맞습니다: ' + r[3].html);
});

test('④ 주를 넘어가는 막대는 잘린 쪽 모서리를 각지게 한다', () => {
  const 긴 = Object.assign({}, 연차, { date: '2026-09-18', end: '2026-09-22' });
  const 일들 = 주.map((ds) => (ds <= 긴.end) ? [긴] : []);
  const r = 배치(일들, 5);
  assert.match(r[0].html, /border-top-left-radius:0/, '앞 주에서 이어진 막대의 왼쪽이 둥급니다: ' + r[0].html);
  assert.strictEqual(/border-top-right-radius:0/.test(r[0].html), false, '끝나는 쪽까지 각졌습니다');
});

test('④★ 칸이 모자라 가려진 날에서는 막대를 «끊는다» — 「N개 더보기」를 덮지 않는다', () => {
  /* 막대 둘(윗줄 A · 아랫줄 B)이 사흘을 건너고, 둘째 날만 바빠 한 줄밖에 못 보인다 */
  const B = Object.assign({}, 연차, { id: 'B', text: '비 출장' });
  const 일들 = 주.map((ds) => (ds >= 연차.date && ds <= 연차.end) ? [연차, B] : []);
  일들[2] = [연차, B].concat(['a', 'b', 'c'].map((k) => 하루(k, '2026-09-22')));
  const r = 배치(일들, 2);
  assert.ok(r[2].숨김 > 0, '바쁜 날을 안 접었습니다');
  /* A 는 윗줄이라 그 날에도 보인다 — 사흘을 그대로 건너간다 */
  assert.match(r[1].html, /width:calc\(300%[^"]*"[^>]*>최기운 연차/, '보이는 막대를 끊었습니다: ' + r[1].html);
  /* B 는 둘째 날에 가려진다 — 첫날에서 끊고(오른쪽 각짐), 셋째 날에 다시 시작(왼쪽 각짐) */
  const 첫B = r[1].html.slice(r[1].html.lastIndexOf('<div'));
  assert.match(첫B, />비 출장</, '첫날에 B 가 없습니다: ' + r[1].html);
  assert.strictEqual(/width:calc/.test(첫B), false, '가려진 날을 건너 B 를 그렸습니다(더보기를 덮습니다): ' + 첫B);
  assert.match(첫B, /border-top-right-radius:0/, '끊긴 쪽이 둥급니다: ' + 첫B);
  assert.match(r[3].html, /border-top-left-radius:0[^>]*>비 출장/, '셋째 날에 B 를 다시 안 잇습니다: ' + r[3].html);
  assert.strictEqual(/비 출장/.test(r[2].html), false, '가려야 할 날에 B 를 그렸습니다');
  const 좁 = 배치(주.map((ds, i) => (i >= 1 && i <= 3) ? [연차] : []), 0);
  assert.ok(좁[1].html.length > 0, '용량이 없으면(못 잰 판) 접지 않고 다 그려야 합니다');
});

test('④ 접었으면 «몇 개인지» 말한다 — 보인 것 + 접힌 것 = 전부', () => {
  const 일들 = 주.map(() => []);
  일들[3] = ['a', 'b', 'c', 'd', 'e', 'f'].map((k) => 하루(k, '2026-09-23'));
  const r = 배치(일들, 4);
  const 보인 = (r[3].html.match(/class="ev"/g) || []).length;
  assert.strictEqual(보인 + r[3].숨김, 6, '보인 ' + 보인 + ' + 접힌 ' + r[3].숨김 + ' ≠ 6');
  assert.ok(보인 + 1 <= 4, '「더보기」 줄 몫을 안 남겼습니다');
});

/* ── ① 색 — 옛 구글 색 → 요즘 구글 색 ── */
test('①★ 구글 색표의 옛 색을 «같은 번호의 요즘 색»으로 바꿔 쓴다 — 저장된 사람 색도 그렇게 읽는다', async () => {
  const b = {
    console, String, Object, Array, JSON, Math, Promise,
    GCAL_API_KEY: 'k', D: { staff_colors: { 'P-001': '#A4BDFC', 'P-002': '#7986cb' } },
    window: {},
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ event: {
      '1': { background: '#a4bdfc' }, '2': { background: '#7ae7bf' } } }) })
  };
  vm.createContext(b);
  vm.runInContext((캘린더.match(/var 구글요즘색 = \{[\s\S]*?\};/) || [''])[0]
    + 함수몸(캘린더, 'function gcalLoadColors(){') + 함수몸(캘린더, 'function colorOf(sid){')
    + 함수몸(캘린더, 'function gcalPalette(){'), b);
  await vm.runInContext('gcalLoadColors()', b);
  const 표 = vm.runInContext('gcalPalette()', b);
  assert.ok(표 && 표.indexOf('#a4bdfc') < 0, '고르는 색표에 옛 색이 남았습니다: ' + 표);
  const c1 = vm.runInContext('colorOf("P-001")', b);
  assert.notStrictEqual(String(c1).toLowerCase(), '#a4bdfc', '옛 색으로 담긴 사람이 여전히 옛 색입니다');
  assert.strictEqual(c1, 표[0], '옛 1번 색이 요즘 1번 색으로 안 읽힙니다: ' + c1);
  assert.strictEqual(vm.runInContext('colorOf("P-002")', b), '#7986cb', '요즘 색으로 담긴 것을 건드렸습니다');
});

/* ── 끌어 옮기기 — 길이를 지킨다 ── */
test('★ 사흘 연차를 끌어 옮겨도 «사흘 그대로»다 — 하루짜리로 줄지 않는다', async () => {
  const A = require(path.join(ROOT, 'js', 'pu-gcal-auth.js'));
  globalThis._gcalToken = 'tok'; globalThis._gcalExpiry = Date.now() + 3600e3;
  const 보낸 = [];
  const 답 = [
    { start: { date: '2026-09-21' }, end: { date: '2026-09-24' } },
    { id: 'L' }
  ];
  const f = (url, opt) => {
    보낸.push(opt);
    const j = 답.shift();
    return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(j) });
  };
  await A.moveEvent('cal', 'L', '2026-10-05', { fetch: f });
  const 고침 = JSON.parse(보낸[1].body);
  assert.strictEqual(고침.start.date, '2026-10-05');
  assert.strictEqual(고침.end.date, '2026-10-08', '길이를 안 지켰습니다: ' + 보낸[1].body);

  const 답2 = [{ start: { date: '2026-09-21' }, end: { date: '2026-09-22' } }, { id: 'L' }];
  const 보낸2 = [];
  await A.moveEvent('cal', 'L', '2026-10-05', { fetch: (u, o) => { 보낸2.push(o); const j = 답2.shift();
    return Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(j) }); } });
  assert.strictEqual(JSON.parse(보낸2[1].body).end.date, '2026-10-06', '하루짜리의 끝날이 틀렸습니다');
});

/* ── 선명도 (대표 지시 2026-09-28 「색감이나 느낌 선명도 … 여전히 구글이 더 명확하다 … 글자의 색강도 등
   구글과 똑같이」). 두 캡처를 한 점씩 재 보니 우리 글자가 «한 단계 옅었다». ── */
function 글자(html) { const m = html.match(/^<div[^>]*?style="[^"]*?(?:^|;)color:(#[0-9a-f]{6})/i); return m ? m[1].toLowerCase() : ''; }
test('⑪ 지난 일정 글자는 «검정을 바탕에 녹인 색» — 칩 색마다 글자가 따라간다(회색 한 가지로 칠하지 않는다)', () => {
  const b = 상자();
  const 지난 = (c) => 칩(b, Object.assign({}, 올일, { color: c, date: '2026-09-01', end: '2026-09-01' }), '2026-09-01');
  const 가 = 지난('#33b679'), 나 = 지난('#8e24aa');
  const ga = 글자(가), na = 글자(나);
  assert.ok(ga && na, '지난 칩 글자색을 셈하지 않습니다(변수 한 가지?): ' + 가);
  assert.notStrictEqual(ga, na, '칩 색이 달라도 글자가 같습니다 — 칩마다 떠 보입니다');
  /* 글자는 바탕보다 어둡되(읽힌다) 검정보다는 밝다(지난 것이라 물러난다) */
  [[가, ga], [나, na]].forEach(([h, g]) => {
    assert.ok(밝기(g) < 밝기(바탕(h)) - 40, '지난 칩 글자가 바탕과 너무 가깝습니다: ' + h);
    assert.ok(밝기(g) > 밝기('#1f1f1f') + 40, '지난 칩 글자가 앞으로의 것만큼 진합니다: ' + h);
  });
});
test('⑪ 어두운판의 지난 글자는 전처럼 회색 변수 — 밝은판 셈을 어두운판에 끌고 가지 않는다', () => {
  const h = 칩(상자('dark'), Object.assign({}, 올일, { date: '2026-09-01', end: '2026-09-01' }), '2026-09-01');
  assert.match(h, /color:var\(--gsub\)/, h);
});
test('⑫ 밝은판 글자가 구글만큼 진하다 — 본문은 날짜보다, 날짜는 음력보다 진하다', () => {
  const 밝은 = (캘린더.match(/:root\{[\s\S]*?\}/) || [''])[0];
  const 값 = (k) => ((밝은.match(new RegExp('--' + k + ':(#[0-9a-f]{6})', 'i')) || [])[1] || '').toLowerCase();
  const 본문 = 값('gtext'), 날짜 = 값('gdate'), 음력 = 값('gfaint');
  assert.ok(본문 && 날짜 && 음력, '밝은판에 --gtext · --gdate · --gfaint 가 다 없습니다');
  /* 검사고정-허용: 구글 캘린더 화면을 실측한 «그 값» 이 규칙이다(2026-09-28 캡처 두 장 대조) */
  assert.strictEqual(본문, '#1f1f1f', '본문 글자가 구글(#1f1f1f)보다 옅습니다');
  assert.ok(밝기(본문) < 밝기(날짜) && 밝기(날짜) < 밝기(음력), '진하기 차례가 어긋났습니다');
  const 날짜칸 = (캘린더.match(/\.dnum\{[^}]*\}/) || [''])[0];
  assert.match(날짜칸, /color:var\(--gdate\)/, '날짜 숫자가 날짜 색 변수를 안 씁니다');
  assert.match((캘린더.match(/\.lun\{[^}]*\}/) || [''])[0], /var\(--gfaint\)/, '음력이 날짜만큼 진해 다툽니다');
});
