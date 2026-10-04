/* 일정을 누르면 «상세»가 보인다 — 푸른 캘린더 (2026-09-27)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-27 「캘린더 일정 클릭시 상세내역 보이게 해줘」 → 목업 뒤 「추천」.

   ★ 무엇이 비어 있었나 — 누르는 것마다 굴러가는 법이 «제각각»이었다
     · 우리 일정·근태 → 고치는 창 (다 보인다)
     · 구글 일정      → **새 탭으로 구글 달력** — 한 달 126건이 이것이라,
                        일정 하나 보려다 앱을 떠나고 돌아오면 보던 달을 잃었다
     · 사건 기한·마감·휴직·공휴일 → **아무 일도 안 일어났다**

   ★ 고른 것 (대표 결정)
     ㉮ 우리 일정은 «그대로» 고치는 창 — 거기에 이미 다 보이는데 상세를 한 겹 더
        두면 고치러 갈 때마다 한 번 더 눌러야 한다
     · 구글 일정에 「구글에서 열기」 단추는 «남긴다» — 참석자·반복은 거기서만 고친다

   ★ 이 검사가 지키는 것
     ① 여기서 못 고치는 넷(구글·기한·마감·휴직·공휴일)은 «상세 창»이 뜬다
     ② 우리 일정은 «그대로» 고치는 창이다 — 걸음이 늘지 않았다
     ③ 구글 일정의 장소·설명을 «통째로» 들고 온다(전엔 두 줄만 잘라 담았다)
     ④ 못 고치는 것에는 «어디서 고치는지»를 적어 준다
     ⑤ 상세 줄은 «셈이 있는 곳»(js/pu-case-due.js)에서 만든다 — 화면이 글자를 도로 쪼개면
        글월을 다듬는 순간 깨진다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');
const M = require(path.join(ROOT, 'js', 'pu-case-due.js'));

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

function 상자(옵션) {
  const o = 옵션 || {};
  const box = {
    S: { detail: o.상세 || null, date: '2026-09-16' },
    D: { holidays: o.공휴일 || {} },
    GCAL: { evs: o.구글 || [] },
    JSON, Object, Array, String, Number, Math, Date, console,
    esc: (v) => String(v == null ? '' : v),
    nameOf: (sid) => ({ 'P-001': '홍길동', 'P-003': '김철수' })[sid] || sid,
    eventsOn: () => (o.층 || []),
    render: () => {}, toast: () => {}
  };
  vm.createContext(box);
  ['function 구글상세(id){', 'function 층상세(ymd, id){', 'function 공휴일상세(ymd){',
   'function detailHtml(){', 'function 긴날짜(ymd){', 'function 시분(ms){',
   'function holidayOf(ymd){'].forEach((h) => vm.runInContext(함수몸(h), box));
  return box;
}

/* ── ① 못 고치는 것은 상세 창 ── */

test('①★ 구글 일정을 누르면 «상세 창» — 새 탭으로 떠나지 않는다', () => {
  const i = 캘린더.indexOf("if(ev[0] === 'gcal')");
  assert.ok(i > 0, '구글 갈래가 없습니다');
  const 갈래 = 캘린더.slice(i, i + 160);
  assert.match(갈래, /openDetail\(구글상세\(/, '★ 상세 창이 안 뜹니다');
  assert.ok(갈래.indexOf('window.open') < 0,
    '★ 아직 새 탭으로 떠납니다 — 일정 하나 보려다 보던 달을 잃습니다');
});

test('①-2★ 기한·마감·휴직을 누르면 상세 창 — 전엔 아무 일도 없었다', () => {
  const i = 캘린더.indexOf("if(ev[0] === ''){");
  assert.ok(i > 0, '★ 기한·휴직 칩을 누르는 갈래가 없습니다');
  assert.match(캘린더.slice(i, i + 260), /openDetail\(층상세\(/, '★ 상세 창이 안 뜹니다');
});

test('①-3 공휴일에도 손잡이가 달렸다 — 이름이 길면 칸에서 잘린다', () => {
  assert.match(함수몸('function chipHtml(e, ymd){'), /data-holday="/, '★ 공휴일에 손잡이가 없습니다');
  assert.match(캘린더, /data-holday'\)\)\{ openDetail\(공휴일상세\(/, '★ 눌러도 안 열립니다');
});

/* ── ② 우리 일정은 그대로 ── */

test('②★★ 우리 일정은 «그대로» 고치는 창 — 걸음이 늘지 않았다 (대표 결정 ㉮)', () => {
  /* ⚠ 「앞에서 1100자」로 자르면 «다음 손잡이»(공휴일)까지 딸려 와 헛돌았다 —
     data-ev 갈래 «하나»만 떼어 본다(2026-09-27 에 여기서 한 번 속았다). */
  const i = 캘린더.indexOf("if(t.hasAttribute('data-ev')){");
  const j = 캘린더.indexOf("if(t.hasAttribute('data-holday')", i);
  assert.ok(i > 0 && j > i, 'data-ev 갈래를 못 떼었습니다');
  const 몸 = 캘린더.slice(i, j);
  assert.match(몸, /openEdit\(ev\[0\], _id\)/, '★ 우리 일정이 고치는 창으로 안 갑니다');
  /* ★ 상세는 «갈래 안»에서만 불리고, 마지막은 그대로 openEdit 이어야 한다.
     날아가는 갈래(gcal·층) 둘을 지나고 나면 openDetail 이 남아 있으면 안 된다 —
     남아 있다면 우리 일정에도 상세가 한 겹 끼어, 고칠 때마다 한 번 더 눌러야 한다는 뜻이다. */
  const 남은것 = 몸.slice(몸.indexOf('openEdit(ev[0], _id)'));
  assert.ok(남은것.indexOf('openDetail') < 0,
    '★ openEdit 뒤에 상세가 또 있습니다');
  /* 검사고정-허용: «둘»이 규칙이다 — 상세가 붙는 것은 여기서 못 고치는 둘(구글·기한/휴직)뿐이다.
     셋이 되면 고칠 수 있는 길에도 상세가 한 겹 끼었다는 뜻이고, 그러면 대표 결정 ㉮
     (「고치러 갈 때 한 번 더 누르게 하지 않는다」)가 깨진다. */
  assert.strictEqual((몸.match(/openDetail\(/g) || []).length, 2,
    '★ data-ev 갈래의 상세 창이 둘이 아닙니다 — 고칠 수 있는 길에도 한 겹 끼었는지 보십시오');
});

/* ── ③ 구글 일정을 통째로 들고 온다 ── */

test('③★ 장소·설명을 «통째로» 들고 온다 — 전엔 두 줄만 잘라 담았다', () => {
  const 몸 = 함수몸('function gcalToEvent(ev){');
  assert.match(몸, /place: ev\.location/, '★ 장소를 안 들고 옵니다');
  assert.match(몸, /desc: String\(ev\.description/, '★ 설명을 안 들고 옵니다');
  /* tip(칩에 마우스 올렸을 때)은 그대로 두 줄이어야 한다 — 거기까지 길어지면 화면을 덮는다 */
  assert.match(몸, /slice\(0, 2\)/, 'tip 이 두 줄로 안 잘립니다');
});

test('③-2 상세 창이 장소·설명·만든이를 낸다', () => {
  const b = 상자({ 구글: [{ id: 'g1', text: '가나상사 방문', color: '#039be5', date: '2026-09-16',
    time: '14:00', endAt: Date.parse('2026-09-16T16:00:00+09:00'), place: '천안시 서북구', desc: '설문지 지참', mail: 'hong@example.com', mailSid: 'P-001',
    gcalUrl: 'https://x' }] });
  const d = vm.runInContext('구글상세("g1")', b);
  /* ⚠ 상자 안에서 «만들어진» 배열은 겉보기가 같아도 deepEqual 이 튕긴다 —
     글자로 바꿔 견준다(2026-09-27 에 여기서 한 번 헛돌았다). */
  const 줄 = vm.runInContext('구글상세("g1").rows.map(function(r){return r.i+" "+r.t;}).join(" | ")', b);
  assert.strictEqual(줄, '👤 홍길동 | 📍 천안시 서북구 | ≡ 설문지 지참 | ✉ hong@example.com 이 만듦');
  assert.strictEqual(d.url, 'https://x', '구글로 갈 주소가 없습니다');
});

test('③-3 빈 칸은 «줄을 만들지 않는다» — 빈 줄이 자리만 먹는다', () => {
  const b = 상자({ 구글: [{ id: 'g1', text: '회의', color: '#039be5', date: '2026-09-16' }] });
  const 몇줄 = vm.runInContext('구글상세("g1").rows.length', b);
  assert.strictEqual(몇줄, 0, '★ 빈 줄을 만들었습니다');
});

/* ── ④ 어디서 고치는지 ── */

test('④★ 못 고치는 것에는 «어디서 고치는지»를 적어 준다', () => {
  const c = M.chips({
    cases: [{ id: 'c1', title: '부당해고', companyName: '가나상사', managerMain: 'P-001',
      stages: [{ id: 's1', code: 'x', noticeDate: '2026-09-05' }] }],
    stageCatalog: [{ code: 'x', short: '지노위', dueDays: 10, dueFrom: 'notice', dueVerified: false }],
    loa: [{ sid: 'P-003', startDate: '2026-09-08', endDate: '2026-09-24', typeLabel: '질병휴직' }],
    users: [{ sid: 'P-001', name: '홍길동' }, { sid: 'P-003', name: '김철수' }],
    from: '2026-09-01', to: '2026-09-30'
  });
  const 기한 = c.find((x) => x.kind === 'stage-due');
  const 휴직 = c.find((x) => x.kind === 'loa');
  assert.match(기한.hint.join(' '), /사건 ▸ 심급·단계/, '★ 기한을 어디서 고치는지 안 알려 줍니다');
  assert.match(기한.hint.join(' '), /아직 확인되지 않은 기한/, '★ 확인 안 된 기한임을 상세에서도 알려야 합니다');
  assert.match(휴직.hint.join(' '), /인사관리 ▸ 휴직/, '★ 휴직을 어디서 고치는지 안 알려 줍니다');
});

test('④-2★ 기한에 «어떻게 나온 날짜인가»를 적는다 — 없으면 믿을 수도 의심할 수도 없다', () => {
  const c = M.chips({
    cases: [{ id: 'c1', title: 'x', managerMain: 'P-001',
      stages: [{ id: 's1', code: 'x', noticeDate: '2026-09-05' }] }],
    stageCatalog: [{ code: 'x', short: '지노위', dueDays: 10, dueFrom: 'notice', dueVerified: true }],
    users: [{ sid: 'P-001', name: '홍길동' }], from: '2026-09-01', to: '2026-09-30'
  })[0];
  assert.match(c.rows.map((r) => r.t).join(' '), /송달일 2026-09-05 \+ 10일/,
    '★ 셈의 근거가 상세에 없습니다');
});

/* ── ⑤ 줄은 셈이 만든다 ── */

test('⑤★ 상세 줄을 «셈이 있는 곳»에서 만든다 — 화면이 tip 을 도로 쪼개지 않는다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js', 'pu-case-due.js'), 'utf8');
  assert.match(src, /rows: \[/, '★ 셈 쪽이 상세 줄을 안 만듭니다');
  const 몸 = 함수몸('function 층상세(ymd, id){');
  assert.match(몸, /것\.rows/, '★ 화면이 셈이 준 줄을 안 씁니다');
  assert.ok(몸.indexOf('split') < 0, '★ 화면이 글자를 도로 쪼갭니다 — 글월을 다듬으면 깨집니다');
});

/* ── 창 자체 ── */

test('★ 상세 창이 그려진다 — 제목·언제·줄·안내·닫기', () => {
  const b = 상자({ 상세: { kind: 'stage-due', title: '⚖ 지노위 기한(확인)', color: '#d97706',
    date: '2026-09-15', end: '', time: '', endAt: 0,
    rows: [{ i: '📁', t: '가나상사' }], hint: ['사건 ▸ 심급·단계에서 고칩니다.'], url: '' } });
  const html = vm.runInContext('detailHtml()', b);
  assert.match(html, /지노위 기한/, '제목이 없습니다');
  assert.match(html, /9월 15일 \(화\)/, '★ 언제인지 안 적습니다');
  assert.match(html, /가나상사/, '줄이 안 보입니다');
  assert.match(html, /사건 ▸ 심급·단계/, '안내가 안 보입니다');
  /* ⚠ 가림막(veil)에도 data-close 가 붙어 있다 — 그것만 보면 단추를 빼도 안 걸린다
     (2026-09-27 이빨 확인에서 잡았다). «단추»를 본다 — 바깥을 못 누르는 사람도 있다. */
  assert.match(html, /<button[^>]*data-close="1"/, '★ 닫는 단추가 없습니다');
  assert.ok(html.indexOf('data-dgo') < 0, '구글이 아닌데 「구글에서 열기」가 있습니다');
});

test('★ 시각이 있으면 «몇 시부터 몇 시까지»를 적는다', () => {
  const b = 상자({ 상세: { kind: 'gcal', title: '방문', color: '#039be5', date: '2026-09-16',
    end: '', time: '14:00', endAt: Date.parse('2026-09-16T16:00:00+09:00'), rows: [], hint: [], url: 'https://x' } });
  const html = vm.runInContext('detailHtml()', b);
  assert.match(html, /14:00 – 16:00/, '★ 끝 시각을 안 적습니다');
  assert.match(html, /data-dgo="1"/, '★ 구글 일정인데 「구글에서 열기」가 없습니다');
});

test('★ ESC 로 닫힌다 — 창이 열렸는데 못 닫으면 화면이 잠긴다', () => {
  assert.match(캘린더, /if\(S\.detail\)\{ e\.preventDefault\(\); closeDetail\(\); return; \}/,
    '★ ESC 로 상세 창이 안 닫힙니다');
  assert.match(캘린더, /if\(S\.detail\) closeDetail\(\);/, '★ 바깥을 눌러도 안 닫힙니다');
});
