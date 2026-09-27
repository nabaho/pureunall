/* 담당자가 «제 색»을 스스로 고른다 — 푸른 캘린더 (2026-09-27)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-27 「담당자들이 자기 색을 스스로 선택할 수 있게 해달라.
   본인 이름 클릭시 색깔 선택할 수 있게 다양한 색 준비하고, 만약 색이 중복되는 경우
   다른 사람과 중복되어 사용할 수 없다고 창이 나오게 해라.」

   ★ 왜 색을 늘렸나 — 이 검사가 지키는 것 가운데 가장 중요하다.
     구글 일정 색은 «열한 가지»뿐인데 현직이 열 명이다. 겹침을 막으면 남는 색이
     하나뿐이라 «고를 수가 없다». 그래서 사람 구분색 24를 함께 낸다.

   ★ 지키는 것
     ① 내 칩을 누르면 색 고르개가 열린다 — 남의 칩은 그대로 거르개
     ② 고를 색이 «넉넉하다»(사람 수보다 훨씬 많다)
     ③ 남이 쓰는 색은 «누가 쓰는지»를 미리 보여 준다
     ④ 겹치는 색을 누르면 «창»이 뜨고, 서버에 쓰지 않는다
     ⑤ 저장은 «내 칸 하나»만 — 통째로 올리면 남의 색을 덮는다
     ⑥ 제자리(같은 색)면 아무것도 안 한다 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const 캘린더 = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

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

const 명부 = [
  { sid: 'P-001', name: '홍길동', status: 'active' },
  { sid: 'P-003', name: '김철수', status: 'active' },
  { sid: 'P-004', name: '이영희', status: 'active' },
  { sid: 'A-009', name: '최퇴사', status: 'retired' }
];

function 상자(옵션) {
  const o = 옵션 || {};
  const 담김 = { 보낸것: null, 몇번: 0, 알림: [] };
  const box = {
    ME: o.나 === undefined ? { sid: 'P-001', name: '홍길동' } : o.나,
    S: { mycolor: o.창 === undefined ? { busy: false, err: '', 겹침: null } : o.창, filter: null },
    D: { staff_colors: o.색 || { 'P-003': '#33b679', 'P-004': '#8e24aa' } },
    JSON, Object, Array, String, Number, console,
    esc: (v) => String(v == null ? '' : v),
    users: () => 명부,
    nameOf: (sid) => (명부.find((u) => u.sid === sid) || {}).name || sid,
    colorOf: (sid) => (box.D.staff_colors || {})[sid] || null,
    gcalPalette: () => (o.구글 === undefined ? ['#7986cb', '#33b679', '#8e24aa'] : o.구글),
    render: () => {}, toast: (t) => 담김.알림.push(t),
    closeMyColor: () => { box.S.mycolor = null; },
    PuCalWrite: {
      saveMyColor: (sid, c) => { 담김.몇번++; 담김.보낸것 = { sid: sid, color: c }; return Promise.resolve(o.답 || { ok: true }); }
    }
  };
  vm.createContext(box);
  ['var 사람구분색 =', 'function 고를색들(){', 'function 색임자(){',
   'function myColorHtml(){', 'function 겹침창Html(누구){', 'function 내색고르기(색){'
  ].forEach((h) => {
    if (h.indexOf('function ') === 0) vm.runInContext(함수몸(h), box);
    else {
      const i = 캘린더.indexOf(h);
      vm.runInContext(캘린더.slice(i, 캘린더.indexOf('];', i) + 2), box);
    }
  });
  box.__담김 = 담김;
  return box;
}
const 잠깐 = () => new Promise((r) => setImmediate(() => setImmediate(r)));

/* ── ① 내 칩만 색 고르개 ── */

test('①★ 내 칩을 누르면 «색 고르개», 남의 칩은 그대로 «거르개»', () => {
  const i = 캘린더.indexOf("if(t.hasAttribute('data-f')){");
  assert.ok(i > 0, '칩 누르기 자리를 못 찾았습니다');
  const 몸 = 캘린더.slice(i, i + 900);
  assert.match(몸, /f === ME\.sid/, '★ 내 칩인지 안 가릅니다');
  assert.match(몸, /openMyColor\(\)/, '★ 내 칩을 눌러도 색 고르개가 안 열립니다');
  assert.ok(몸.indexOf('S.filter = f || null') > 몸.indexOf('openMyColor()'),
    '★ 거르개가 «먼저» 걸려 색 고르개까지 못 갑니다');
});

test('①-2 내 칩임을 «눈에» 보이게 한다 — 안 보이면 눌러 보기 전엔 모른다', () => {
  const 몸 = 함수몸('function chipsHtml(eumOnly){');
  assert.match(몸, /p\.pk === ME\.sid/, '내 칩을 가리는 자리가 없습니다');
  assert.match(몸, /data-me="1"/, '★ 내 칩에 표가 없습니다');
  assert.match(몸, /눌러서 내 색을 고릅니다/, '★ 눌러도 되는지 안 알려 줍니다');
  assert.match(캘린더, /\.pchip\[data-me="1"\]\{[^}]*box-shadow/, '★ 내 칩 표시에 모양이 없습니다');
});

/* ── ② 색이 넉넉한가 ── */

test('②★★ 고를 색이 «사람 수보다 훨씬» 많다 — 구글 11가지만으론 못 고른다', () => {
  const b = 상자({ 구글: ['#7986cb', '#33b679', '#8e24aa', '#e67c73', '#f6bf26',
    '#f4511e', '#039be5', '#616161', '#3f51b5', '#0b8043', '#d50000'] });
  const 색들 = vm.runInContext('고를색들()', b);
  assert.ok(색들.length >= 30,
    '★ 고를 색이 ' + 색들.length + '가지뿐입니다 — 현직 열 명이 겹치지 않게 고르기엔 모자랍니다');
  /* 구글 것이 «앞»에 온다 — 구글 화면과 같은 색을 먼저 보여 준다 */
  assert.strictEqual(색들[0], '#7986cb', '구글 색이 앞에 오지 않습니다');
});

test('②-2 같은 색이 두 번 나오지 않는다 — 두 벌에 겹치는 값이 있어도', () => {
  const b = 상자({ 구글: ['#1e40af', '#33b679'] });   // #1e40af 는 사람 구분색에도 있다
  const 색들 = vm.runInContext('고를색들()', b);
  const 본것 = {};
  색들.forEach((c) => { const k = String(c).toLowerCase(); assert.ok(!본것[k], '★ ' + c + ' 가 두 번 나옵니다'); 본것[k] = 1; });
});

test('②-3★ 사람 구분색이 이알피와 «같은 값»이다 — 다르면 같은 사람이 두 앱에서 다른 색이 된다', () => {
  const erp = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const 뽑기 = (src, 이름) => {
    const i = src.indexOf(이름);
    assert.ok(i >= 0, 이름 + ' 를 못 찾았습니다');
    return (src.slice(i, src.indexOf('];', i)).match(/#[0-9a-fA-F]{6}/g) || []).map((x) => x.toLowerCase());
  };
  assert.deepStrictEqual(뽑기(캘린더, 'var 사람구분색 ='), 뽑기(erp, 'var EXT_COLOR_CANDIDATES ='),
    '★ 두 앱의 사람 구분색이 어긋났습니다 — 한쪽만 고치면 같은 사람이 다른 색으로 칠해집니다');
});

/* ── ③ 남이 쓰는 색 ── */

test('③★ 남이 쓰는 색은 «누가 쓰는지»를 미리 보여 준다', () => {
  const b = 상자({});
  const html = vm.runInContext('myColorHtml()', b);
  assert.match(html, /class="mysw[^"]*taken/, '★ 남의 색에 표가 없습니다');
  assert.match(html, /김철수 님이 쓰는 색입니다/, '★ 누가 쓰는지 안 알려 줍니다');
  assert.match(html, /<span class="myw">김철<\/span>/, '★ 색칸에 이름이 안 적힙니다');
});

test('③-2 «그만둔 사람»의 색은 막지 않는다 — 안 쓰는 색까지 잠기면 고를 것이 없다', () => {
  const b = 상자({ 색: { 'A-009': '#33b679' } });   // 퇴사자가 쓰던 색
  const 임자 = vm.runInContext('색임자()', b);
  assert.strictEqual(임자['#33b679'], undefined, '★ 그만둔 사람 색이 아직 잠겨 있습니다');
});

test('③-3 내가 지금 쓰는 색은 «남의 것»으로 표시하지 않는다', () => {
  const b = 상자({ 색: { 'P-001': '#7986cb', 'P-003': '#33b679' } });
  const html = vm.runInContext('myColorHtml()', b);
  const 내색칸 = html.slice(html.indexOf('data-mycol="#7986cb"') - 60, html.indexOf('data-mycol="#7986cb"') + 40);
  assert.ok(내색칸.indexOf('taken') < 0, '★ 내 색이 «남의 색»으로 잠겼습니다');
  assert.match(내색칸, /cur/, '지금 쓰는 색에 표가 없습니다');
});

/* ── ④ 겹치면 창 ── */

test('④★★ 겹치는 색을 누르면 «창»이 뜨고, 서버에 쓰지 않는다', async () => {
  const b = 상자({});
  vm.runInContext('내색고르기("#33b679")', b);   // 김철수가 쓰는 색
  await 잠깐();
  assert.strictEqual(b.__담김.몇번, 0, '★ 겹치는데 서버에 썼습니다 — 둘이 같은 색이 됩니다');
  assert.strictEqual(b.S.mycolor.겹침, '김철수', '★ 창이 안 뜹니다');
  const 창 = vm.runInContext('겹침창Html("김철수")', b);
  assert.match(창, /이미 쓰는 색입니다/);
  assert.match(창, /김철수/, '누가 쓰는지 창에 없습니다');
  assert.match(창, /구별할 수 없습니다/, '★ 왜 안 되는지 안 알려 줍니다');
});

test('④-2 창을 닫는 길이 있다 — 못 닫으면 화면이 잠긴다', () => {
  const 창 = 상자({}).__담김 && vm.runInContext('겹침창Html("김철수")', 상자({}));
  assert.match(창, /data-dupclose="1"/, '★ 닫는 단추가 없습니다');
  assert.match(캘린더, /data-dupclose[\s\S]{0,200}?S\.mycolor\.겹침 = null/,
    '★ 닫기를 누르면 창이 사라지지 않습니다');
});

/* ── ⑤⑥ 저장 ── */

test('⑤★★ «내 칸 하나»만 보낸다 — 통째로 올리면 남의 색을 덮는다', async () => {
  const b = 상자({});
  vm.runInContext('내색고르기("#d50000")', b);   // 아무도 안 쓰는 색
  await 잠깐();
  assert.deepStrictEqual(b.__담김.보낸것, { sid: 'P-001', color: '#d50000' },
    '★ 내 칸 하나가 아닌 것을 보냈습니다');
  assert.strictEqual(b.D.staff_colors['P-003'], '#33b679', '★ 남의 색이 함께 바뀌었습니다');
  assert.strictEqual(b.D.staff_colors['P-001'], '#d50000', '화면 자료가 안 바뀌었습니다');
});

test('⑤-2 통째로 올리는 길(saveColors)을 «쓰지 않는다» — 서버도 거절한다', () => {
  const 몸 = 함수몸('function 내색고르기(색){');
  assert.ok(몸.indexOf('saveColors') < 0,
    '★ 통째로 올리는 길을 씁니다 — 서버 규칙이 직원에게 그 길을 막고 있어 조용히 거절당합니다');
  assert.match(몸, /PuCalWrite\.saveMyColor\(/, '내 칸만 쓰는 길을 안 씁니다');
});

test('⑥ 제자리(같은 색)면 아무것도 안 한다 — 쓰기만 늘고 바뀌는 것이 없다', async () => {
  const b = 상자({ 색: { 'P-001': '#7986cb' } });
  vm.runInContext('내색고르기("#7986CB")', b);   // 대문자로 와도 같은 색
  await 잠깐();
  assert.strictEqual(b.__담김.몇번, 0, '★ 같은 색인데 서버에 썼습니다');
});

test('⑥-2 저장에 실패하면 «그대로 말한다» — 조용히 넘기면 바뀐 줄 안다', async () => {
  const b = 상자({ 답: { ok: false, message: '제 색만 고칠 수 있습니다 — 서버가 거절했습니다' } });
  vm.runInContext('내색고르기("#d50000")', b);
  await 잠깐();
  assert.match(b.S.mycolor.err, /서버가 거절했습니다/, '★ 실패했는데 아무 말도 안 합니다');
  assert.strictEqual(b.D.staff_colors['P-001'], undefined, '★ 서버는 거절했는데 화면은 바꿔 놓았습니다');
});

/* ── 저장 문·서버 규칙 ── */

test('★★ 저장 문이 «그 칸 하나»만 적는다 — 경로가 틀리면 규칙이 거절한다', () => {
  const W = fs.readFileSync(path.join(ROOT, 'js', 'pu-cal-write.js'), 'utf8');
  const i = W.indexOf('function saveMyColor(');
  assert.ok(i > 0, 'saveMyColor 가 없습니다');
  const 몸 = W.slice(i, W.indexOf('\n  function ', i + 10));
  assert.match(몸, /ref\('data\/staff_colors\/v\/' \+ sid\)/,
    '★ 담기는 자리가 v 아래가 아닙니다 — { v:{사번:색}, u:시각 } 꼴이라 v 아래여야 합니다');
  assert.match(몸, /#\[0-9a-fA-F\]\{6\}|COLORV/, '색 꼴을 안 봅니다');
  assert.ok(몸.indexOf("'data/staff_colors'") < 0, '★ 통째로 씁니다');
});

test('★★ 서버 규칙이 «제 칸만» 허락한다 — 화면만 막으면 아무 소용이 없다', () => {
  const R = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;
  const r = R.data.staff_colors;
  assert.ok(r && r.v && r.v.$sid, '★ v/$sid 칸이 없습니다 — 직원이 제 색도 못 씁니다');
  const w = String(r.v.$sid['.write'] || '');
  assert.match(w, /child\('sid'\)\.val\(\) === \$sid/,
    '★ «제 칸인지»를 안 봅니다 — 남의 색을 고칠 수 있습니다');
  assert.match(w, /isAdmin/, '관리자 길이 사라졌습니다');
  assert.match(String(r.v.$sid['.validate'] || ''), /#\[0-9a-fA-F\]\{6\}/,
    '★ 색 꼴을 서버가 안 봅니다 — 아무 글자나 들어오면 그 사람 칩이 통째로 안 보입니다');
  /* 부모는 그대로 관리자만 — 통째로 갈아 끼우는 일은 관리자 몫이다 */
  assert.match(String(r['.write'] || ''), /isAdmin/, '★ 통째 쓰기가 아무에게나 열렸습니다');
});
