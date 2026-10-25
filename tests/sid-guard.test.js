'use strict';
/* 🙈 사번·로그인 이메일 가림막 — 글자 바꾸는 규칙 (대표 결정 2026-10-25 「이름만 있어야한다」)

   ★ 이 검사가 못 박는 것은 «규칙»이다:
     ① 사번 꼴(앞글자-숫자3)과 로그인 이메일은 어떤 둘레에 있어도 지워진다 — 둘레의 구분 글자까지
     ② 사번이 아닌 것은 «한 글자도» 안 바뀐다 — 금액·전화·사업자번호·계약번호·모델명
     ③ 명부에서 읽은 실제 사번은 하이픈 없는 꼴·소문자 꼴도 지운다
   값(사번 문자열)은 시험용이다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-sid-guard.js'), 'utf8');

/* 화면 없이 글자 규칙만 시험한다 — document 가 없으면 가림막은 아무것도 안 시작한다 */
function boot() {
  const g = { console, setInterval: () => 1, clearInterval() {}, String, Object, Array, JSON, RegExp };
  g.window = g;
  vm.createContext(g);
  vm.runInContext(SRC, g);
  return g.PuSidGuard;
}

test('①★ 이름 옆에 붙은 사번은 구분 글자까지 같이 지운다', () => {
  const G = boot();
  assert.equal(G.scrubText('권형하 · P-001'), '권형하');
  assert.equal(G.scrubText('권형하 · 대표노무사 · P-001'), '권형하 · 대표노무사');
  assert.equal(G.scrubText('박한별 (P-003)'), '박한별');
  assert.equal(G.scrubText('박한별（P-003）'), '박한별');
  assert.equal(G.scrubText('P-001 · 권형하'), '권형하');
  assert.equal(G.scrubText('최기운, A-002'), '최기운');
  assert.equal(G.scrubText('담당 권형하/P-001'), '담당 권형하');
});

test('①-2 「사번 …」 이름표째 지운다 · 여러 개가 붙어 있어도', () => {
  const G = boot();
  assert.equal(G.scrubText('사번 P-001'), '');
  assert.equal(G.scrubText('사번: P-001 확인'), '확인');
  assert.equal(G.scrubText('로그인 계정: p001@pureun.kr'), '로그인 계정:');
  assert.ok(!/P-00/.test(G.scrubText('P-006·P-007 확인 필요')), '★ 여러 개가 붙은 줄에 사번이 남았다');
  assert.ok(!/[A-Z]-\d{3}/.test(G.scrubText('원본: P-006 (사번 확인 필요)')));
});

test('①-3 로그인 이메일(= 로그인 아이디)도 지운다', () => {
  const G = boot();
  assert.equal(G.scrubText('p001@pureun.kr'), '');
  assert.ok(!/@/.test(G.scrubText('로그인 계정: p001@pureun.kr')), '★ 이메일이 남았다');
  assert.ok(!/@/.test(G.scrubText('시도한 계정: A005@PUREUN.KR 로 로그인')), '★ 대문자 이메일이 남았다');
  /* 고객·외부 이메일은 로그인 아이디가 아니다 — 그대로 둔다 */
  assert.equal(G.scrubText('연락처 kim001@gmail.com'), '연락처 kim001@gmail.com');
});

test('②★ 사번이 아닌 것은 한 글자도 안 바뀐다 (금액·전화·사업자번호·계약번호·모델명·날짜)', () => {
  const G = boot();
  [
    '330,000원 (부가세 포함)', '010-1234-5678', '041-556-0035', '131-82-89682', '214-82-05236',
    '계약-2026-181', '문서작성-2026-001', '자문-10354', '임금체불-2026-002', '2026-10-25 14:30',
    '모델 A-1000', 'P-0012', 'AP-001', 'KP-001', '우편번호 31900', '합계 1,234건', '제 100조 2항', ''
  ].forEach((s) => assert.equal(G.scrubText(s), s, '★ 사번이 아닌데 바뀌었다: ' + s));
  assert.equal(G.scrubText(null), null);
  assert.equal(G.scrubText(undefined), undefined);
  assert.equal(G.scrubText(12345), '12345', '숫자가 와도 깨지지 않는다');
});

test('③★ 명부에서 읽은 실제 사번은 하이픈 없는 꼴·소문자 꼴도 지운다', () => {
  const G = boot();
  /* 명부를 읽기 전에는 하이픈 없는 꼴(p001)은 사번인지 알 수 없어 그대로 둔다 — 모델명(A100)과 구분이 안 되기 때문 */
  assert.equal(G.scrubText('담당 p001 님'), '담당 p001 님');
  G.setKnown(['P-001', 'A-002']);
  assert.ok(!/p001/i.test(G.scrubText('담당 p001 님')), '★ 명부의 사번(소문자·하이픈 없음)이 남았다');
  assert.ok(!/P001/.test(G.scrubText('P001 · 권형하')));
  assert.equal(G.scrubText('모델 A100'), '모델 A100', '명부에 없는 A100 은 사번이 아니다');
  assert.equal(G.scrubText('p0012'), 'p0012', '자릿수가 다르면 사번이 아니다');
});

test('④ 명부에 새 앞글자(Q)가 있으면 그 글자도 사번으로 본다', () => {
  const G = boot();
  assert.ok(/Q-007/.test(G.scrubText('담당 Q-007')), '명부를 읽기 전에는 Q 를 모른다(기본은 A·P·T)');
  G.setKnown(['Q-007']);
  assert.ok(!/Q-007/.test(G.scrubText('담당 Q-007')), '★ 명부에서 알게 된 앞글자를 안 지운다');
});

test('⑤ 같은 글을 두 번 거쳐도 같다 (스스로 일으킨 변화로 무한히 돌지 않는다)', () => {
  const G = boot();
  ['권형하 · P-001', '박한별 (P-003)', 'p001@pureun.kr', '330,000원'].forEach((s) => {
    const once = G.scrubText(s);
    assert.equal(G.scrubText(once), once, '두 번째에 또 바뀐다: ' + s);
  });
});
