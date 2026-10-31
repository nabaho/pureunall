/* 푸른 캘린더(폰) › 입력창이 «깜빡이고 입력이 안 되는» 것 (2026-10-31)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-10-31 「폰에서 일정 입력하려고 창을 열거나 이름을 고르거나 내용을 열려면 자꾸 화면이 깜빡이거나 뒤로 간다」.
   원인(폰 폭 화면에서 재현): render() 가 판 전체를 갈아 끼워 입력칸이 «새 칸»이 된다 → 쓰던 글·커서·키보드가 사라진다.
     키보드가 올라오면 resize 가 오고(그때마다 render), 서버 자료·구글 일정·알림이 도착해도 render 가 온다.

   ★ 이 검사가 지키는 것
     ① 그리기 앞뒤: 사용자가 «마지막 그림 뒤» 친 칸은 S.modal 에 담기고, 새 칸에 되돌려지고, 포커스·커서·스크롤이 돌아온다
     ② 코드가 S.modal 을 바꾼 칸은 «코드가 이긴다» — 그려 둔 옛 값이 덮어쓰면 안 된다(캡처 결과 채우기 · 새 창에 시각 넣기)
     ③ 창이 닫혔다 다시 열려도 지난 창의 기준이 딸려 오지 않는다
     ④ resize — 글을 쓰는 중이고 «너비가 그대로»면 다시 그리지 않는다(키보드). 포커스가 없거나 너비가 바뀌면(회전) 그린다
   ⚠ 값(숫자·색)이 아니라 «규칙»을 본다. */
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

/* ── 가짜 화면 — «칸 이름 → 칸» 표를 갈아 끼우는 것이 render() 의 innerHTML 교체다 ── */
function 새판() {
  const 상자 = { String, Object, Array, JSON };
  vm.createContext(상자);
  vm.runInContext(캘린더.match(/var 창칸들 = \[[^\]]*\];/)[0], 상자);
  vm.runInContext('var _그린창값 = null;', 상자);
  ['function 입력중인가(){', 'function 창입력지킴(){', 'function 창입력되살림(지킴){'].forEach((h) => vm.runInContext(함수몸(h), 상자));
  const 판 = { 칸: {}, 창있음: false, 창위: 0, 검색: null };
  const 몸 = { tagName: 'BODY' };
  const doc = { body: 몸, activeElement: 몸 };
  function 칸만들기(f, v) {
    const el = {
      tagName: f === 'note' ? 'TEXTAREA' : f === 'sid' ? 'SELECT' : 'INPUT', type: 'text', value: v == null ? '' : String(v), id: '',
      selectionStart: 0, selectionEnd: 0,
      getAttribute: (k) => (k === 'data-m' ? f : null),
      setSelectionRange(s, e) { this.selectionStart = s; this.selectionEnd = e; },
      focus() { doc.activeElement = this; }
    };
    return el;
  }
  const 창 = {
    get scrollTop() { return 판.창위; }, set scrollTop(v) { 판.창위 = v; },
    querySelector: (sel) => { const m = /data-m='(\w+)'/.exec(sel); return m ? 판.칸[m[1]] || null : null; },
    contains: (el) => Object.values(판.칸).indexOf(el) >= 0
  };
  doc.querySelector = (sel) => {
    if (sel === '.modal.gform') return 판.창있음 ? 창 : null;
    if (sel === '#calq') return 판.검색;
    const m = /data-m='(\w+)'/.exec(sel);
    return m && 판.창있음 ? 판.칸[m[1]] || null : null;
  };
  doc.getElementById = (id) => (id === 'calq' ? 판.검색 : null);
  상자.document = doc;
  /* render() 흉내 — 지킴 → (S 로 칸을 새로 그림) → 되살림 */
  판.그리기 = (S) => {
    상자.S = S;
    const 지킴 = vm.runInContext('창입력지킴()', 상자);
    판.창있음 = !!S.modal;
    판.창위 = 0;                                          /* 새로 그린 창은 맨 위에서 시작한다 */
    판.칸 = {};
    if (S.modal) vm.runInContext('창칸들', 상자).forEach((f) => { 판.칸[f] = 칸만들기(f, S.modal[f]); });
    if (S.검색) 판.검색 = Object.assign(칸만들기('calq', S.q), { id: 'calq', getAttribute: () => null });
    doc.activeElement = 몸;                              /* 갈아 끼우면 포커스는 사라진다 */
    상자.__지킴 = 지킴;
    vm.runInContext('창입력되살림(__지킴)', 상자);
  };
  판.칸만들기 = 칸만들기;
  판.doc = doc;
  판.상자 = 상자;
  return 판;
}
const 모달 = (extra) => Object.assign({ mode: 'new', kind: 'sch', title: '', place: '', note: '', time: '', endTime: '', date: '2026-01-02', sid: 'P-001' }, extra);

/* ── ① 사용자가 친 글 ── */
test('① 그린 뒤 사용자가 친 글은 다시 그려도 남는다 — S.modal 에 담기고 새 칸에 되돌려지고 포커스·커서가 돌아온다', () => {
  const 판 = 새판(); const S = { modal: 모달() };
  판.그리기(S);                                        /* 처음 그림 */
  판.칸.note.value = '쓰는 중인 메모'; 판.칸.note.setSelectionRange(3, 3); 판.doc.activeElement = 판.칸.note;
  const 옛칸 = 판.칸.note;
  판.그리기(S);                                        /* 뒤에서 자료가 도착해 다시 그림 */
  assert.notStrictEqual(판.칸.note, 옛칸, '새 칸이어야 시험이 된다');
  assert.strictEqual(S.modal.note, '쓰는 중인 메모');
  assert.strictEqual(판.칸.note.value, '쓰는 중인 메모');
  assert.strictEqual(판.doc.activeElement, 판.칸.note, '포커스가 돌아와야 한다(키보드가 안 내려간다)');
  assert.strictEqual(판.칸.note.selectionStart, 3);
});

test('① 여러 칸을 쳤어도 모두 남는다 · 스크롤도 돌아온다', () => {
  const 판 = 새판(); const S = { modal: 모달() };
  판.그리기(S);
  판.칸.title.value = '제목 글'; 판.칸.place.value = '장소 글'; 판.창위 = 77;
  판.그리기(S);
  assert.strictEqual(판.칸.title.value, '제목 글');
  assert.strictEqual(판.칸.place.value, '장소 글');
  assert.strictEqual(판.창위, 77, '창이 맨 위로 튀면 안 된다(「뒤로 간다」)');
});

test('① 아무것도 안 쳤으면 S.modal 을 건드리지 않는다', () => {
  const 판 = 새판(); const S = { modal: 모달({ title: '원래' }) };
  판.그리기(S); 판.그리기(S);
  assert.strictEqual(S.modal.title, '원래');
  assert.strictEqual(S.modal.date, '2026-01-02');
});

/* ── ② 코드가 이긴다 ── */
test('② 코드가 S.modal 을 바꾼 칸은 «옛 그림 값»이 덮지 않는다 — 캡처 결과 채우기', () => {
  const 판 = 새판(); const S = { modal: 모달({ title: '' }) };
  판.그리기(S);
  S.modal.title = '코드가 채운 제목';                  /* 사용자는 안 만졌다 */
  판.그리기(S);
  assert.strictEqual(S.modal.title, '코드가 채운 제목');
  assert.strictEqual(판.칸.title.value, '코드가 채운 제목');
});

test('② 사용자는 장소를 치고 코드는 제목을 바꿨다 — 둘 다 산다', () => {
  const 판 = 새판(); const S = { modal: 모달() };
  판.그리기(S);
  판.칸.place.value = '사용자가 친 장소'; S.modal.title = '코드가 채운 제목';
  판.그리기(S);
  assert.strictEqual(S.modal.place, '사용자가 친 장소');
  assert.strictEqual(S.modal.title, '코드가 채운 제목');
  assert.strictEqual(판.칸.place.value, '사용자가 친 장소');
  assert.strictEqual(판.칸.title.value, '코드가 채운 제목');
});

test('② 새 창을 열고 시각을 코드가 넣는 길 — 시각이 지워지지 않는다', () => {
  const 판 = 새판(); const S = { modal: 모달({ time: '' }) };
  판.그리기(S);
  S.modal.time = '09:30'; S.modal.endTime = '10:30';
  판.그리기(S);
  assert.strictEqual(판.칸.time.value, '09:30');
  assert.strictEqual(판.칸.endTime.value, '10:30');
});

/* ── ③ 닫고 다시 열기 ── */
test('③ 창이 닫혔다 다시 열려도 지난 창의 기준이 딸려 오지 않는다', () => {
  const 판 = 새판(); const S = { modal: 모달({ title: '' }) };
  판.그리기(S);
  판.칸.title.value = '지난 창에서 친 글';
  S.modal = null; 판.그리기(S);                        /* 닫힘 */
  assert.strictEqual(vm.runInContext('_그린창값', 판.상자), null, '창이 없으면 기준을 비운다');
  S.modal = 모달({ title: '' }); 판.그리기(S);          /* 새 창 */
  assert.strictEqual(판.칸.title.value, '');
  assert.strictEqual(S.modal.title, '');
});

/* ── 검색칸 · 안전 ── */
test('검색칸의 포커스·커서도 돌아온다(키보드가 안 내려간다) — 창이 없어도 안 터진다', () => {
  const 판 = 새판(); const S = { modal: null, 검색: true, q: '가나' };
  판.그리기(S);
  판.검색.setSelectionRange(1, 1); 판.doc.activeElement = 판.검색;
  판.그리기(S);
  assert.strictEqual(판.doc.activeElement, 판.검색);
  assert.strictEqual(판.검색.selectionStart, 1);
});

test('입력중인가 — 글 칸·메모·고르기는 «입력 중», 단추·체크·본문은 아니다', () => {
  const 판 = 새판(); const 보기 = (tag, type) => { 판.doc.activeElement = { tagName: tag, type: type }; return vm.runInContext('입력중인가()', 판.상자); };
  assert.strictEqual(보기('INPUT', 'text'), true);
  assert.strictEqual(보기('INPUT', 'search'), true);
  assert.strictEqual(보기('INPUT', 'date'), true);
  assert.strictEqual(보기('TEXTAREA'), true);
  assert.strictEqual(보기('SELECT'), true);
  assert.strictEqual(보기('INPUT', 'checkbox'), false);
  assert.strictEqual(보기('INPUT', 'button'), false);
  assert.strictEqual(보기('BUTTON'), false);
  판.doc.activeElement = 판.doc.body;
  assert.strictEqual(vm.runInContext('입력중인가()', 판.상자), false);
  판.doc.activeElement = null;
  assert.strictEqual(vm.runInContext('입력중인가()', 판.상자), false);
});

/* ── 연결 · ④ resize ── */
test('연결 — render() 는 그리기 «앞»에 지킴을, innerHTML 교체 «바로 뒤»에 되살림을 한다', () => {
  const 몸 = 함수몸('function render(){');
  assert.ok(/^function render\(\)\{\s*var 지킴 = 창입력지킴\(\);/.test(몸), '맨 앞에서 지킴');
  assert.ok(/\$\('app'\)\.innerHTML = html;\s*창입력되살림\(지킴\);/.test(몸), '교체 바로 뒤에서 되살림');
});

test('④ resize — 글을 쓰는 중이고 너비가 그대로면 다시 그리지 않는다 · 그 판단이 타이머(그리기)보다 앞이다', () => {
  const a = 캘린더.indexOf("window.addEventListener('resize', function(){");
  assert.ok(a >= 0);
  const 몸 = 캘린더.slice(a, a + 1400);
  const 판단 = 몸.search(/입력중인가\(\)\s*&&\s*너비\s*===\s*_크기너비/);
  const 그리기 = 몸.indexOf('render()');
  assert.ok(판단 >= 0, '입력 중 + 너비 같음 판단이 없다');
  assert.ok(/입력중인가\(\)\s*&&\s*너비\s*===\s*_크기너비\)\s*return;/.test(몸), '그 판단은 «그만둔다(return)» 여야 한다');
  assert.ok(그리기 > 판단, '판단이 그리기보다 앞이어야 한다');
  assert.ok(/_크기너비 = 너비;/.test(몸), '너비가 바뀌면(회전) 기준을 갱신하고 그린다');
});

test('④ 폰을 돌리는 길(orientationchange)은 그대로 다시 그린다', () => {
  assert.ok(/orientationchange", function\(\)\{ _칸용량 = 0; _첫줄용량 = 0; setTimeout\(render, 250\); \}/.test(캘린더));
});
