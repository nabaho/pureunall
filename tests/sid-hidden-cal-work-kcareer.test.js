'use strict';
/* 🙈 푸른 캘린더·업무관리·경력관리 — 보이는 글자에 사번·로그인 이메일이 없다 (대표 결정 2026-10-25 「이름만 있어야한다」)

   ★ 이 검사가 못 박는 것은 «규칙»이다 (값이 아니라 규칙 — 프로젝트 CLAUDE.md 「검사를 쓰는 규칙」)
     ① 이름을 못 찾으면 «빈 글자» — 사번을 대신 돌려주지 않는다 (캘린더 nameOf · 경력관리 담당 이름표 · 업무관리 부담당 이름표)
     ② 내 이름 자리(머리줄·말풍선·클라우드 창·잠금 창)에 로그인 이메일·사번이 안 나간다
     ③ 오류 글(저장 문)에 사번이 안 끼어든다 — 이 글은 화면에 뜬다
     ④ 옛 일정 설명의 「푸른 담당: 이름 (사번)」은 보이는 복사본에서 사번을 걷는다 → tests/cal-event-detail.test.js
     ⑤ 보낸 메일 줄의 보낸 사람(기록에는 로그인 이메일)은 이름으로 → tests/co-sent-history.test.js
   저장값·열쇠(value, DB 경로, sid 비교)는 그대로 사번이다 — 이 검사는 «보이는 글자»만 본다.
   바깥 안전망(js/pu-sid-guard.js)이 있어도 «원천»을 고친 것을 따로 지킨다 — 안전망에만 기대지 않는다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const CAL = read('pu-cal.html');
const WORK = read('work.html');
const KC = read('kcareer.html');

/* 함수 몸통 — 머리글에서 짝 맞는 닫는 괄호까지 */
function cut(src, head) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}
const SID_SHAPE = /[A-Za-z]-?\d{3}/;

/* ── ① 이름을 못 찾으면 «빈 글자» ── */
test('①★ 캘린더 nameOf — 이름을 못 찾으면 빈 글자(사번을 돌려주지 않는다), 찾으면 이름', () => {
  const 상자 = { allUsers: () => [{ sid: 'P-001', name: '홍길동' }, { sid: 'P-002' }] };
  vm.createContext(상자);
  vm.runInContext(cut(CAL, 'function userOf(sid){') + '\n' + cut(CAL, 'function nameOf(sid){'), 상자);
  assert.equal(vm.runInContext('nameOf("P-001")', 상자), '홍길동');
  assert.equal(vm.runInContext('nameOf("P-002")', 상자), '', '★ 이름이 없는 사람의 사번이 이름 자리에 들어갔다');
  assert.equal(vm.runInContext('nameOf("P-999")', 상자), '', '★ 명부에 없는 사번이 이름 자리에 들어갔다');
});

test('①★ 캘린더 — 사람 칩·고르는 목록·색 창에서 이름이 없을 때 사번을 쓰지 않는다 (「이름 미확인」)', () => {
  const live = stripComments(CAL);
  /* 이름 자리에 사번을 쓰는 모양 — u.name||u.sid · nameOf(..)||..sid · ME.sid 를 글자로 */
  assert.doesNotMatch(live, /\.name\s*\|\|\s*u\.sid/, '이름 || 사번');
  assert.doesNotMatch(live, /nameOf\([^)]*\)\s*\|\|\s*(?:ME\.sid|남)\b/, 'nameOf(..) || 사번');
  assert.doesNotMatch(live, /\.textContent\s*=[^;\n]*(?:ME\.sid|\.sid\b)/, '화면 글자에 사번을 바로 넣는다');
  assert.match(live, /이름 미확인/, '이름을 모를 때 쓸 글자가 없다');
});

test('①★ 경력관리 — 담당 이름표 변환표는 이름이 없으면 «빈 글자» (사번을 이름 자리에 넣지 않는다)', () => {
  const live = stripComments(KC);
  const body = cut(live, 'async function _puLoadUserMap(){');
  assert.doesNotMatch(body, /u\.name\s*\|\|\s*String\(u\.sid\)/, '★ 담당 이름표에 사번이 들어간다 — 실적 표·증명서로 샌다');
  /* 주담당별로 묶을 때도 이름이 없으면 사번이 아니라 「이름 미확인」 */
  assert.doesNotMatch(live, /_puUserMap\[String\(sid\)\]\s*\|\|\s*String\(sid\s*\|\|/, '★ 묶음 이름에 사번이 들어간다');
});

test('①★ 업무관리 — 사번→이름 표(_peU2N)는 이름이 없으면 빈 글자 · 성과급 탭·진행 메모는 「이름 미확인」', () => {
  const live = stripComments(WORK);
  const body = cut(live, 'function peUsers(){');
  assert.doesNotMatch(body, /u\.name\s*\|\|\s*u\.sid/, '★ 사번을 부담당 이름으로 저장·표시한다');
  assert.doesNotMatch(live, /_peU2N\[p\.sid\]\)\s*\|\|\s*p\.sid/, '★ 진행 메모 작성자에 사번이 나온다');
  assert.doesNotMatch(live, /\.name\)\s*\|\|\s*sid\)/, '★ 성과급 탭에 사번이 나온다');
  assert.doesNotMatch(live, /esc\(p\.name\s*\|\|\s*sid\)/, '★ 성과급 표에 사번이 나온다');
  assert.doesNotMatch(live, /esc\(s\.name\s*\|\|\s*s\.sid\)/, '★ 부담당 딱지에 사번이 나온다');
});

/* ── ② 내 이름 자리 ── */
test('②★ 캘린더 머리줄·내 계정 창 — 로그인 이메일·사번이 안 나간다', () => {
  const live = stripComments(CAL);
  const start = cut(live, 'function start(user){');
  assert.doesNotMatch(start, /esc\(user\.email/, '★ 내 계정 창에 로그인 이메일이 나온다');
  assert.doesNotMatch(start, /\.title\s*=[^;\n]*user\.email/, '★ 말풍선에 로그인 이메일이 나온다');
  assert.doesNotMatch(start, /\.textContent\s*=[^;\n]*user\.email/, '★ 머리줄에 로그인 이메일이 나온다');
  assert.doesNotMatch(start, /ME\.name\s*\|\|\s*ME\.sid/, '★ 이름을 모를 때 사번을 적는다');
});

test('②★ 경력관리 — 잠금 창·클라우드 창·반출 목록에 사번·로그인 이메일이 안 나간다', () => {
  const live = stripComments(KC);
  assert.doesNotMatch(live, /kl-who[^\n]*_me\.sid/, '★ 잠금 창에 사번이 나온다');
  assert.doesNotMatch(live, /getElementById\('fbWho'\)[^\n]*u\.email/, '★ 클라우드 창에 로그인 이메일이 나온다');
  assert.doesNotMatch(live, /x\.by\.name\s*\|\|\s*x\.by\.sid/, '★ 받은함 목록에 사번이 나온다');
  /* pu-erp 원본 줄 보기 — 담당자 칸의 사번은 이름으로 바꿔 보여 준다 */
  const peek = cut(live, 'async function openPuSource(puRef){');
  assert.match(peek, /_puUserMap/, '원본 줄 보기가 담당자 사번을 이름으로 바꾸지 않는다');
});

/* ── ③ 오류 글 ── */
test('③★ 캘린더 저장 문 — 오류 글에 사번이 안 끼어든다 (이 글은 화면에 뜬다)', async () => {
  const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
  W.attach({ ref: () => ({ set: () => Promise.resolve() }) }, {});
  const 모두 = [];
  모두.push(await W.saveMyColor('P.001', '#aabbcc'));
  모두.push(await W.saveColors({ 'P.001': '#a4bdfc' }));
  모두.push(await W.saveColors({ 'P-001': 'not-a-color' }));
  모두.push(await W.saveNotes({ 'P.001': '글' }));
  모두.push(await W.saveNotes({ 'P-001': 123 }));
  모두.push(await W.saveMailMap({ 'aaa@gmail,com': 'P.001' }));
  모두.push(await W.saveMailMap({ 'aaa@gmail,com': '' }));
  모두.forEach((r) => {
    assert.equal(r.ok, false, '막혀야 하는 입력이 통과했다');
    assert.ok(!SID_SHAPE.test(String(r.message)), '★ 오류 글에 사번이 끼었다: ' + r.message);
  });
});

/* ── 이빨 ── */
test('(이빨) 위 검사들이 실제로 잡는다 — 못 잡으면 초록은 눈을 감은 것이다', () => {
  assert.match('var n = u.name || u.sid;', /\.name\s*\|\|\s*u\.sid/);
  assert.match("w.textContent=u.email||u.uid;", /\.textContent\s*=[^;\n]*u\.email|u\.email/);
  assert.ok(SID_SHAPE.test('사번이 이상합니다: P-001'));
  assert.ok(!SID_SHAPE.test('사번이 이상합니다'));
});
