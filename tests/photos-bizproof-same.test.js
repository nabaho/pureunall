'use strict';
/* 사업자등록증과 사업자등록증명은 «똑같이» 다룬다 (대표 지시 2026-08-17)

   "사업자등록증과 사업자등록증명은 같이 데이터 입력하고 기업정보함에 같이
    저장해달라."

   설계(PR #234)에서 갈래(kind)는 일부러 안 나눴다 — 증명원에도 상호·대표자·
   사업자번호가 똑같이 들어 있어, 갈래를 나누면 기업정보함·업체관리·기업정보함으로
   가는 길이 통째로 끊긴다. 가르는 것은 **제목(docName)** 뿐이다.
   이 검사는 그 약속이 깨지지 않는지 못박는다 — 누가 나중에 kind 를 나누면
   여기서 걸린다.

   실행: node --test tests/*.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
const reader = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8');

/* ── 두 서류의 판독 결과(제목만 다르고 나머지는 같다) ── */
const 등록증 = { kind: 'bizreg', fields: { docName: '사업자등록증', company: '주식회사 가야엔지니어링', bizno: '310-81-13809', ceo: '최상윤' } };
const 증명원 = { kind: 'bizreg', fields: { docName: '사업자등록증명', company: '주식회사 가야엔지니어링', bizno: '310-81-13809', ceo: '최상윤' } };

/* 화면의 판정 함수들을 그대로 떠와서 돌린다 */
function loadGates() {
  const ctx = { CARD_KINDS: null, CO_KINDS: null, String, Object };
  /* ⚠ 예전에는 상수 «전문»을 글자로 박아 두었다. 2026-08-31 에 서식(form)이 늘자
     깨졌다 — 이 검사가 보는 것은 «등록증·증명원이 세 길로 다 가는가»이지 상수에 몇
     칸이 있는가가 아니다. 이름으로 찾아 그 줄을 그대로 가져온다. */
  ['CARD_KINDS', 'CO_KINDS'].map(function (nm) {
    const m = app.match(new RegExp('const ' + nm + ' = \\{[^}]*\\};'));
    assert.ok(m, nm + ' 상수를 찾을 수 없습니다');
    return m[0];
  }).forEach(function (line) {
  });
  vm.createContext(ctx);
  ['CARD_KINDS', 'CO_KINDS'].forEach(function (n) {
    const m = app.match(new RegExp('const ' + n + ' = \\{[^}]*\\};'));
    vm.runInContext(m[0].replace('const ', 'var '), ctx);
  });
  /* ⚠ 2026-09-03 — canSendCoInfo 가 «사람이 채운 값»(readFields)을 본다.
     안 실으면 그 줄에서 ReferenceError 로 멎는다. 가짜로 두지 않고 진짜를 넣는다. */
  vm.runInContext(app.match(/^const FIX_KEYS = \[[^\r\n]*\];/m)[0].replace('const ', 'var '), ctx);
  ['readFields', 'canSend', 'canSendCo', 'canSendCoInfo'].forEach(function (n) {
    const m = app.match(new RegExp('function ' + n + '\\([\\s\\S]*?\\n\\}'));
    assert.ok(m, n + ' 를 찾지 못했습니다');
    vm.runInContext(m[0], ctx);
  });
  return ctx;
}

test('★ 기업정보함·업체관리·기업정보함 — 세 길 모두 둘을 똑같이 받는다', () => {
  const g = loadGates();
  for (const [name, r] of [['등록증', 등록증], ['증명원', 증명원]]) {
    assert.equal(g.canSend(r), true, '★ ' + name + ' 이 기업정보함으로 안 갑니다');
    assert.equal(g.canSendCo(r), true, '★ ' + name + ' 이 업체관리로 안 갑니다');
    assert.equal(g.canSendCoInfo(r), true, '★ ' + name + ' 이 기업정보함으로 안 갑니다');
  }
});

test('★ 갈래(kind)를 나누지 않는다 — 나누는 순간 증명원이 세 길에서 다 떨어진다', () => {
  /* 누가 「증명원은 따로 관리하자」며 kind 를 나누면, CARD_KINDS·CO_KINDS 에
     그 이름이 없어 조용히 아무 데도 안 간다. 그때 이 검사가 먼저 운다. */
  assert.ok(!/bizproof|biz_proof|bizregproof/i.test(reader),
    '★ 판독기에 증명원 전용 갈래가 생겼습니다 — 설계(PR #234)와 어긋납니다');
  const kinds = reader.match(/var KINDS = \{[^}]*\}/);
  assert.ok(kinds, 'KINDS 를 찾지 못했습니다');
  assert.ok(!/proof/i.test(kinds[0]), '★ 증명원 전용 갈래가 KINDS 에 들어왔습니다');
});

test('★ 판독기는 둘을 다른 «제목»으로 읽는다 — 같은 이름으로 뭉개지 않는다', () => {
  assert.match(reader, /「사업자등록증명」은 「사업자등록증」이 아닙니다/,
    '★ 제목을 줄여 쓰지 말라는 지시가 사라지면 둘이 한 이름으로 뭉개집니다');
});

test('★ 기업정보함 안내는 실제 서류 이름으로 말한다 — 증명원을 넣고 「등록증」이라 하지 않는다', () => {
  const src = fs.readFileSync(path.join(R, 'js', 'pu-doc-file.js'), 'utf8');
  const i = src.indexOf('function sendToCards(');
  const j = src.indexOf('\n  /* ══', i);
  const fn = src.slice(i, j > i ? j : i + 6000);
  assert.match(fn, /o\.fields && o\.fields\.docName/,
    '★ 제목을 안 쓰면 증명원을 넣고도 「사업자등록증으로 넣었습니다」라고 합니다');
  /* 제목이 없는 옛 사진은 예전 말로 물러난다 — 빈 이름으로 「으로 넣었습니다」가 되면 안 된다 */
  assert.match(fn, /docName \|\| \(want === 'biz'/, '제목이 없을 때 물러날 이름이 없습니다');
});

test('★ 둘은 같은 자리(사업자등록증 탭)에 쌓인다 — 찾을 때 갈라지지 않는다', () => {
  const m = app.match(/\{ key: 'bizreg',[^}]*\}/);
  assert.ok(m, '사업자등록증 탭을 찾지 못했습니다');
  assert.match(m[0], /kinds: \['bizreg', 'sme'\]/,
    '★ 탭이 받는 갈래가 바뀌면 증명원이 다른 탭으로 흩어집니다');
});

/* ══════ 「서류」 딱지 (대표 지적 2026-08-17) ══════
   "이 사진은 서류가 아닌데 왜 서류라고 되어 있나" — 딱지는 원래 «어느 단추로
   올렸나»(서류 고르기 = 고화질)를 적은 것이라, 서류 고르기로 올린 회의사진에도
   붙었다. 판독이 이미 무엇인지 가려 놓았으므로 사진으로 가려진 것에는 안 붙인다. */
/* ⚠ 2026-09-09 — 같은 지적이 또 왔다(「여전히 사진이 서류로 된 곳이 있다」). 이번에는
     판독기가 «서류로 보이지 않음»이라 한 현장 사진이었다. meeting 하나만 빼는 방식은
     갈래가 늘 때마다 여기서 또 어긋나므로, 딱지가 **갈래(laneOf)를 그대로 따르게** 했다.
   ⚠ 그래서 이 검사도 «글자»가 아니라 «규칙»을 본다 — 실제로 돌려서, 사진으로 가려진
     것이 사진 갈래인지 본다. 옛 검사는 `rk !== 'meeting'` 이라는 표현을 붙잡고 있었다. */
function 갈래(meta) {
  const ctx = { String: String, Object: Object, Boolean: Boolean };
  vm.createContext(ctx);
  vm.runInContext([
    app.match(/^const LANE_PIC_KINDS = \{[^}]*\};/m)[0].replace('const ', 'var '),
    cutFn(app, 'function readAnyField('),
    cutFn(app, 'function laneOf(')
  ].join('\n'), ctx);
  ctx.__it = { id: 'p1', meta: meta };
  return vm.runInContext('laneOf(__it)', ctx);
}

test('★ 판독이 회의·현장 사진으로 본 것에는 「서류」 딱지를 안 붙인다', () => {
  const g = app.match(/function renderGrid\(\)[\s\S]*?\n\}/)[0];
  assert.match(g, /const hasTag = \([^)]*laneOf\(it\) === 'doc'\)/,
    '격자 딱지 판단을 찾지 못했습니다 — 딱지가 갈래를 따르지 않습니다');
  assert.equal(갈래({ kind: 'doc', read: { kind: 'meeting' } }), 'pic',
    '★ 회의사진에 「서류」가 붙으면 대표가 사진첩 분류 전체를 못 믿게 됩니다');
  assert.equal(갈래({ kind: 'doc', read: { kind: 'other', fields: {} } }), 'pic',
    '★ 판독기가 «서류가 아니라»고 한 사진에 「서류」가 붙습니다 — 2026-09-09 지적 그대로입니다');
});

test('크게 보기 제목줄도 같은 규칙이다 — 한쪽만 고치면 열 때마다 또 틀린 말이 보인다', () => {
  /* ⚠ 예전에는 `$('viewerInfo').textContent` 라는 **표현식 자체**를 붙잡고 있었다.
     2026-08-17 에 제목줄을 두 줄(날짜 크게)로 가르며 그 줄이 renderViewerTitle 로
     옮겨 가자 깨졌다 — 규칙은 그대로 따라갔는데도다. 자리가 아니라 **함수**를 본다. */
  /* ⚠ 글자 수를 적어 자르지 않는다 — 함수가 한 줄 길어지면(2026-08-26 에 「📌 증빙으로
     씀」 한 줄이 늘었다) 창이 끝에 못 닿아 조용히 헛돈다. 중괄호 짝을 세어 벤다. */
  const chunk = cutFn(app, 'function renderViewerTitle(');
  assert.match(chunk, /read\.kind === 'meeting'/,
    '제목줄이 아직 「서류」라고 적습니다');
});

test('아직 안 읽은 사진에는 딱지를 그대로 붙인다 — 읽히기 전 유일한 실마리다', () => {
  /* 갈래가 「서류」면 딱지가 붙는다(위 hasTag) — 그러니 «안 읽은 것이 서류 갈래인가»가
     곧 이 규칙이다. 대표 결정 ③㉮ 와 같은 자리다: 모르겠으면 서류. */
  assert.equal(갈래({ kind: 'doc' }), 'doc',
    '★ 판독 전 사진의 딱지가 사라지면, 고화질로 올린 서류인지 알 길이 없어집니다');
  assert.equal(갈래({}), 'doc', '표시가 아예 없는 옛 사진도 서류 갈래여야 합니다');
});

test('같은 회사의 등록증·증명원은 기업정보함에서 한 곳으로 모인다 — 사업자번호가 열쇠', () => {
  /* 같은 회사가 서류 종류마다 두 벌로 쌓이면 안 된다(2026-08-16 조사에서 실제로
     dup 처리된 46건을 확인했다 — 그것이 옳은 동작이다). */
  const src = fs.readFileSync(path.join(R, 'js', 'pu-doc-file.js'), 'utf8');
  const m = src.match(/function dedupKey\([\s\S]*?\n  \}/);
  assert.ok(m, 'dedupKey 를 찾지 못했습니다');
  assert.match(m[0], /kind === 'bizreg'\) return digits\(fields && fields\.bizno\)/,
    '★ 사업자번호가 아닌 것으로 겹침을 가리면 같은 회사가 두 벌로 쌓입니다');
});
