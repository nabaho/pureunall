'use strict';
/* 계약창 — 3개 화면을 «기존처럼 한 개씩» + 저장해서 넘어가기로 되돌림
   (대표 지시 2026-09-18 「3개의 화면을 기존처럼 한개씩 하고 저장해서 넘어가게
    해줘 다시」)

   ★ feat/contract-one-screen(#1418)·fix/contract-pane-tidy(#1426) 이
     넓은 화면에서 기둥 셋으로 펴던 것을 걷어내고, 원래의 탭 방식으로 되돌린다.
     PANES 넷을 만들어 두는 구조 자체는 남겨 둔다(pu_c_2026-09-18 온톨로지
     걸음의 「기업정보함에 있습니다」 띠 · 「회사 한 장」 단추가 그 안에 있어서다) —
     되돌리는 것은 «펴는 겉모습»뿐이다.

   이 검사가 못 박는 것:
     ① 창 너비가 고정 620px 이다 (화면 폭에 안 늘어난다)
     ② 탭 바가 «늘» 보인다 (숨기는 조건이 없다)
     ③ 본문은 탭 하나(PANES[tab])만 그린다 — 기둥으로 나란히 안 편다
     ④ 바닥은 늘 이전/다음/저장 흐름이다 — 「누르면 바로 저장」 지름길이 없다
     ⑤ WIDE·WIDE3·colPane 이라는 이름이 계약창 어디에도 없다 (죽은 채 남지 않는다) */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
const MODAL = stripJs(cutFn(RAW, 'function ContractModal('));

test('①★ 창 너비는 «고정»이다 — 화면 폭을 따라 넓어지지 않는다', () => {
  /* ⚠ 620 이라는 «값»을 박지 않는다. 2026-09-18 에 네 칸으로 바뀌며 1080 이 됐고
     그때 이 검사가 «기능이 멀쩡한데» 깨졌다. 못 박을 것은 「한 값으로 고정이고
     화면 폭(WIDE)을 따라 갈라지지 않는다」는 규칙뿐이다. */
  const m = /className:'modal', style:\{ width:([^}]+)\}/.exec(MODAL);
  assert.ok(m, '계약창 너비를 못 찾았다');
  assert.match(m[1], /^\s*'\d+px'\s*,?\s*$/,
    '★ 창 너비가 «한 값으로 고정»이 아니다 — 화면 폭에 따라 갈라지면 안 된다: ' + m[1]);
});

test('②★ 탭 바는 조건 없이 «늘» 그린다', () => {
  /* ⚠ stripJs 가 「// 탭 헤더」 같은 줄 주석을 걷어 내므로, 주석이 아니라
       코드 자체(tabBtn 호출 앞자리)로 찾는다. */
  const at = MODAL.search(/tabBtn\('company',/);
  assert.ok(at > 0, '탭 바(tabBtn 호출)를 못 찾았다');
  const band = MODAL.slice(Math.max(0, at - 220), at + 250);
  assert.match(band, /h\('div', \{ style:\{ display:'flex', borderBottom/,
    '탭 바 h(...) 앞에 조건이 남아 있으면 숨는 경우가 생긴다');
  assert.ok(!/!WIDE/.test(band), '탭 바를 숨기는 조건(!WIDE)이 남아 있다');
  /* ★ 이름만 !WIDE 를 벗어나면 통과하는 헐거운 검사가 되지 않도록,
       h('div' 바로 앞이 «&&로 가려진 조건»이 아니라 이전 항목의 «,»(또는 여는 배열)
       인지를 직접 본다 — 어떤 이름의 조건이 됐든 가려져 있으면 걸린다. */
  const divAt = band.indexOf("h('div', { style:{ display:'flex', borderBottom");
  const before = band.slice(0, divAt).replace(/\s+/g, '');
  assert.ok(!/&&$/.test(before),
    '탭 바 h(...) 바로 앞이 «&&» 로 끝난다 — 이름이 무엇이든 조건부로 가려져 있다');
  /* ⚠ 탭 «개수»나 이름 전문을 박지 않는다 — 2026-09-18 에 일지가 담당자와 합쳐져
     넷에서 셋이 됐다. 못 박을 것은 「세 갈래가 다 갈 길이 있다」는 규칙이다.
     (일지를 어디서 보는지는 tests/contract-4col-order.test.js 가 따로 본다) */
  ['company', 'contract', 'manager'].forEach(v =>
    assert.ok(band.indexOf("tabBtn('" + v + "'") > 0, '「' + v + '」 탭으로 갈 길이 없다'));
});

test('③★ 본문은 PANES[tab] 하나만 — 기둥으로 나란히 펴지 않는다', () => {
  /* ⚠ 주석(// 탭 콘텐츠)이 아니라 코드로 찾는다 — stripJs 가 줄 주석을 없앤다. */
  const at = MODAL.indexOf("style:{ maxHeight:'55vh', overflowY:'auto', padding:'16px' } },");
  assert.ok(at > 0, '탭 콘텐츠 자리를 못 찾았다');
  const body = MODAL.slice(Math.max(0, at - 200), at + 100);
  assert.match(body, /maxHeight:'55vh', overflowY:'auto', padding:'16px'/,
    '본문 높이가 예전 55vh 로 돌아와야 한다');
  assert.match(body, /tabBody/, '탭 하나(tabBody)를 그린다');
  assert.ok(!/display:'grid'/.test(body), '기둥 그리드가 남아 있다');
  assert.ok(!/gridTemplateColumns/.test(body), '여러 칸으로 나누는 자리가 남아 있다');
});

test('④★ 바닥은 늘 이전/다음/저장 — 「누르면 바로 저장」 지름길이 없다', () => {
  const atNext = MODAL.indexOf("function goNext(){");
  const at = MODAL.indexOf("function goPrev(){");
  assert.ok(atNext > 0 && at > atNext, 'goNext·goPrev 를 못 찾았다');
  /* ★ 이름을 WIDE 로 박지 않는다 — 어떤 이름의 조건이든, goNext 와 goPrev
       «사이»에 단추(h('button')를 «미리» 돌려주는 지름길이 있으면 걸려야 한다.
       지금은 그 사이가 goNext 의 몸통(setTab 만 있는)뿐이라 h('button')가 없다. */
  const between = MODAL.slice(atNext, at);
  assert.ok(!/h\('button'/.test(between),
    'goNext 와 goPrev 사이에 단추를 미리 돌려주는 지름길이 있다 — 어느 이름의 조건이든 안 된다');
  const footer = MODAL.slice(at, at + 1100);
  assert.match(footer, /'← 이전'/, '이전 단추가 있다');
  assert.match(footer, /'다음 → 계약정보'/, '다음 단추가 있다(1단계 → 2단계)');
  assert.match(footer, /'✓ 저장'/, '마지막 단계의 저장 단추가 있다');
});

test('⑤★ WIDE·WIDE3·colPane 이라는 이름이 계약창 어디에도 없다', () => {
  assert.ok(!/\bWIDE\b/.test(MODAL), 'WIDE 가 죽은 채 남아 있다');
  assert.ok(!/WIDE3/.test(MODAL), 'WIDE3 가 죽은 채 남아 있다');
  assert.ok(!/colPane/.test(MODAL), 'colPane 이 죽은 채 남아 있다');
  assert.ok(!/function colPane\(/.test(RAW), 'colPane 함수 정의가 파일 어딘가에 남아 있다');
});

test('⑥ 의뢰인 유형 안내는 «예전 큰 밴드» 하나뿐 — 넓은 화면용 칩이 안 남는다', () => {
  assert.ok(!/ctChip\(/.test(MODAL), '넓은 화면 전용 칩 버튼(ctChip)이 남아 있다');
  assert.match(MODAL, /'⚖️ 의뢰인 유형 — 먼저 선택하세요'/, '예전 밴드 제목이 있어야 한다');
  /* CT_TIP 은 그대로 둔다 — ctBar(좁은 화면 큰 버튼)가 여전히 이 말풍선 글을 쓴다 */
  assert.match(MODAL, /var CT_TIP = \{/, 'CT_TIP 자체는 ctBar 가 쓰므로 남아 있어야 한다');
});

test('⑦ PANES 는 그대로 만들어 둔다 — 「회사 한 장」·기업정보함 띠가 그 안에 산다', () => {
  assert.match(MODAL, /var PANES = \{\};/, 'PANES 를 통째로 지우면 안 된다');
  assert.match(MODAL, /tabBody = PANES\[tab\] \|\| PANES\.company;/, '탭 하나를 그 안에서 고른다');
  assert.match(MODAL, /📄 회사 한 장/, 'PANES.company 안의 회사 한 장 단추가 그대로 있다');
});
