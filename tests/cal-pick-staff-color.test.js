/* 사람 색 «바꾸기» — 푸른 캘린더로 옮겼다 (캘린더 한 곳으로 모으기 4걸음)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 — 법인 대시보드·이음센터를 «통째로» 걷어낸다.

   ★ 왜 이 검사가 있나 — 안 옮겼으면 «온 시스템에서» 색을 바꿀 길이 사라졌다.
     색을 고르는 자리가 이알피 법인 대시보드 한 곳뿐이었다(사람 칩에 마우스를 올리면
     뜨던 팔레트). 그 화면을 걷어내며 그대로 두었으면, 빠진 사람은 채워지지만
     («빠진색채우기») «이미 있는 색을 바꾸는 일»은 아무 데서도 못 하게 된다.
     data/staff_colors 는 컨설팅일정도 읽는 자리라 손해가 이 앱에서 안 그친다.

   ★ 이알피와 «다르게» 만든 곳 — 그 PC 에만 담지 않는다.
     이알피는 고른 색을 그 PC 브라우저(localStorage: pureun_v6_staff_custom_colors)에
     담고, 화면을 그릴 때마다 다시 셈해 «통째로» 올렸다. 그래서 다른 PC 에서 열면
     순번 색으로 돌아갔다. 여기서는 고른 «그 칸 하나»만 서버에 적는다.

   ⚠ 이 검사가 지키는 것
     ① 관리자·위임관리인만 — 서버 규칙(staff_colors .write = MGR)과 «같은» 잣대
     ② 구글 색표 안에서만 고른다 (색을 새로 만들지 않는다)
     ③ 색표가 안 왔으면 고르게 하지 않는다 (되돌아갈 색이 진짜 색을 덮는다)
     ④ 고른 «그 칸 하나»만 바꾼다 (통째로 다시 셈해 올리지 않는다) */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

/* 이름 붙은 함수 하나의 몸만 떼어 온다 (중괄호를 센다) */
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

/* 화면 그리는 함수들을 상자에 넣고 실제로 돌린다 */
function 상자만들기(옵션) {
  const o = 옵션 || {};
  const 담김 = { 보낸것: null, 몇번: 0 };
  const 상자 = {
    ME: o.나 || { sid: 'P-001', name: '홍길동', role: 'admin' },
    D: { staff_colors: o.색 || {}, user_accounts: o.명부 || [] },
    S: { colors: o.창 || null },
    JSON, Object, Array, String, Number, console,
    esc: (v) => String(v == null ? '' : v),
    nameOf: (sid) => ((o.명부 || []).find((u) => u.sid === sid) || {}).name || sid,
    users: () => (o.명부 || []),
    arr: (v) => (Array.isArray(v) ? v : []),
    render: () => {},
    gcalPalette: () => (o.색표 === undefined ? ['#d50000', '#33b679', '#3f51b5'] : o.색표),
    PuCalWrite: {
      saveColors: (m) => { 담김.몇번++; 담김.보낸것 = JSON.parse(JSON.stringify(m)); return Promise.resolve({ ok: true }); }
    }
  };
  vm.createContext(상자);
  ['function 관리자인가(){', 'function colorOf(sid){', 'function openColors(){',
   'function closeColors(){', 'function colorsHtml(){', 'function 색고르기(sid, 색){',
   'function 색단추Html(){'].forEach((h) => vm.runInContext(함수몸(h), 상자));
  상자.__담김 = 담김;
  return 상자;
}
const 잠깐 = () => new Promise((r) => setImmediate(() => setImmediate(r)));

/* ── ① 누가 바꿀 수 있나 ── */

test('① 관리자·위임관리인에게만 단추가 뜬다 — 서버가 거절할 일을 미리 막는다', () => {
  const 관 = 상자만들기({ 나: { sid: 'P-001', role: 'admin' } });
  assert.ok(vm.runInContext('색단추Html()', 관).length > 0, '관리자에게 단추가 없습니다');

  const 남 = 상자만들기({ 나: { sid: 'P-009', role: 'user' } });
  assert.strictEqual(vm.runInContext('색단추Html()', 남), '',
    '★ 쓸 수 없는 사람에게 단추가 보입니다 — 눌러 놓고 조용히 거절당합니다');
});

test('①-2★ 위임관리인도 바꿀 수 있다 — 서버 규칙(MGR)과 같은 잣대여야 한다', () => {
  const 위 = 상자만들기({ 나: { sid: 'P-005', isSubAdmin: true } });
  assert.strictEqual(vm.runInContext('관리자인가()', 위), true,
    '★ 서버는 허락하는데 화면이 막습니다 — 될 사람이 못 하게 됩니다');
});

/* ── ② 무슨 색을 고르게 하나 ── */

test('②★ 구글 색표 «안에서만» 고르게 한다 — 새 색을 만들면 구글 화면과 달라진다', () => {
  const b = 상자만들기({ 색표: ['#d50000', '#33b679'], 창: { pick: 'P-001', busy: false, err: '' },
    명부: [{ sid: 'P-001', name: '홍길동', status: 'active' }] });
  const html = vm.runInContext('colorsHtml()', b);
  const 고를것 = (html.match(/data-cset="[^"]*\|([^"]+)"/g) || [])
    .map((x) => x.replace(/.*\|/, '').replace(/"$/, ''));
  assert.deepStrictEqual(고를것, ['#d50000', '#33b679'],
    '★ 색표 밖의 색을 고르게 하고 있습니다');
});

test('③★ 색표가 «안 왔으면» 고르게 하지 않는다 — 되돌아갈 색이 진짜 색을 덮는다', () => {
  const b = 상자만들기({ 색표: null, 창: { pick: '', busy: false, err: '' },
    명부: [{ sid: 'P-001', name: '홍길동', status: 'active' }] });
  const html = vm.runInContext('colorsHtml()', b);
  assert.ok(html.indexOf('data-cset=') < 0,
    '★ 색표가 오기 전에 고르게 합니다 — 서버의 진짜 색을 덮습니다');
  assert.match(html, /아직 못 받았습니다/, '왜 못 고르는지 말해 주지 않습니다');
});

test('④ 남이 쓰는 색인지 알려 준다 — 막지는 않는다(일부러 같이 줄 때도 있다)', () => {
  const b = 상자만들기({
    색표: ['#d50000', '#33b679'],
    색: { 'P-002': '#33b679' },
    창: { pick: 'P-001', busy: false, err: '' },
    명부: [{ sid: 'P-001', name: '홍길동', status: 'active' },
           { sid: 'P-002', name: '김철수', status: 'active' }]
  });
  const html = vm.runInContext('colorsHtml()', b);
  assert.match(html, /김철수 님이 쓰는 색입니다/, '누가 쓰는 색인지 안 알려 줍니다');
  assert.match(html, /data-cset="P-001\|#33b679"/, '★ 아예 못 고르게 막았습니다 — 알려만 주면 된다');
});

/* ── ⑤ 서버에 어떻게 적나 ── */

test('⑤★ 고른 «그 칸 하나»만 바꾼다 — 통째로 다시 셈해 올리면 남의 색을 덮는다', async () => {
  const b = 상자만들기({
    색: { 'P-001': '#d50000', 'P-002': '#33b679' },
    창: { pick: 'P-001', busy: false, err: '' },
    명부: [{ sid: 'P-001', name: '홍길동', status: 'active' }]
  });
  vm.runInContext('색고르기("P-001", "#3f51b5")', b);
  await 잠깐();
  assert.deepStrictEqual(b.__담김.보낸것, { 'P-001': '#3f51b5', 'P-002': '#33b679' },
    '★ 다른 사람 색이 함께 바뀌었거나 사라졌습니다');
});

test('⑥ 같은 색을 다시 고르면 안 쓴다 — 쓰기가 늘 뿐 바뀌는 것이 없다', async () => {
  const b = 상자만들기({
    색: { 'P-001': '#d50000' },
    창: { pick: 'P-001', busy: false, err: '' },
    명부: [{ sid: 'P-001', name: '홍길동', status: 'active' }]
  });
  vm.runInContext('색고르기("P-001", "#D50000")', b);   // 대문자로 와도 같은 색이다
  await 잠깐();
  assert.strictEqual(b.__담김.몇번, 0, '★ 바뀐 것이 없는데 서버에 썼습니다');
});

test('⑦ 저장에 실패하면 «그대로 말한다» — 조용히 넘어가면 바뀐 줄 안다', async () => {
  const b = 상자만들기({
    색: { 'P-001': '#d50000' },
    창: { pick: 'P-001', busy: false, err: '' },
    명부: [{ sid: 'P-001', name: '홍길동', status: 'active' }]
  });
  b.PuCalWrite.saveColors = () => Promise.resolve({ ok: false, message: '권한이 없습니다' });
  vm.runInContext('색고르기("P-001", "#3f51b5")', b);
  await 잠깐();
  assert.strictEqual(b.S.colors.err, '권한이 없습니다', '★ 실패했는데 아무 말도 안 합니다');
  assert.strictEqual(b.D.staff_colors['P-001'], '#d50000',
    '★ 서버는 거절했는데 화면 자료는 바꿔 놓았습니다');
});

/* ── ⑧ 이알피의 «그 PC 에만 남는» 버릇을 물려받지 않는다 ── */

test('⑧★ 고른 색을 그 PC 브라우저에 담지 않는다 — 이알피가 그래서 PC 마다 달랐다', () => {
  const 몸 = 함수몸('function 색고르기(sid, 색){');
  assert.ok(몸.indexOf('localStorage') < 0,
    '★ 고른 색을 이 PC 에만 담고 있습니다 — 다른 PC 에서는 안 보입니다');
  assert.ok(캘린더.indexOf('pureun_v6_staff_custom_colors') < 0,
    '★ 이알피의 PC 별 색표를 물려받았습니다');
});
