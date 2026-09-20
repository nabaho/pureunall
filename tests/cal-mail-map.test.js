/* 푸른 캘린더에서 «구글 계정 ↔ 직원»을 잇는다 — 한 곳으로 모으기 1걸음(나)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-20 「0부터 순서대로」. 0걸음(일정 표)·1걸음-가(사람 색)에 이어.

   ★ 왜 필요한가
     구글 일정에는 «누가 만들었는지»(메일)만 남고 이름이 없다. 이어 주지 않으면
     그 사람 일정이 담당자·색 없이 뜬다. 이어 주는 화면이 이알피 법인 대시보드
     한 곳뿐이라, 그 화면을 걷어내면 남은 사람을 영영 못 잇는다(지금 열 명 남았다).

   ★ 지키려는 것
     ① 열쇠는 이알피와 «같은 셈»(gcalMailKey — 점을 쉼표로). 다르면 서로 못 찾는다
     ② 아직 안 이은 계정만 세어 단추에 적는다 — 할 일이 없으면 단추가 아예 안 뜬다
     ③ 관리자만 — 서버 규칙이 거절하는 것을 미리 막는다(조용한 실패 방지)
     ④ 고르는 목록은 «현직»만
     ⑤ 저장 문이 이상한 열쇠·사번을 막고, 이알피와 같은 {v,u} 겉꼴로 쓴다
     ⑥ 색표(saveColors)와 달리 «빈 지도»는 허락한다 — 마지막 하나를 끊은 멀쩡한 상태다 */
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

function 상자만들기(옵션) {
  const o = 옵션 || {};
  const 상자 = {
    console, Object, Array, String, JSON, Math, Date,
    D: {
      user_accounts: [
        { sid: 'P-001', name: '홍길동', status: 'active', role: 'admin' },
        { sid: 'P-003', name: '김철수', status: 'active', role: 'member' },
        { sid: 'T-001', name: '박퇴사', status: 'retired', role: 'staff' }
      ],
      gcal_mail_sid: o.이은것 || { 'aaa@gmail,com': 'P-003' }
    },
    ME: o.나 === undefined ? { sid: 'P-001', name: '홍길동', role: 'admin' } : o.나,
    GCAL: { evs: o.일정 || [
      { mail: 'aaa@gmail.com' }, { mail: 'aaa@gmail.com' },
      { mail: 'bbb@pureun.kr' }, { mail: 'bbb@pureun.kr' }, { mail: 'bbb@pureun.kr' },
      { mail: 'ccc@gmail.com' }
    ] },
    S: { mailmap: { busy: false, err: '' } }
  };
  vm.createContext(상자);
  ['function esc(s){', 'function arr(v){', 'function allUsers(){', 'function users(){',
   'function userOf(sid){', 'function nameOf(sid){', 'function gcalMailKey(m){',
   'function gcalMailMap(){', 'function 잇기할수있나(){', 'function 메일줄들(){',
   'function 안이은수(){', 'function mailmapHtml(){', 'function 잇기단추Html(){'
  ].forEach((h) => vm.runInContext(함수몸(h), 상자));
  return 상자;
}
const 돌리기 = (상자, 글) => { vm.runInContext('var __r = (' + 글 + ');', 상자); return 상자.__r; };

test('① 열쇠는 이알피와 «같은 셈» — 점을 쉼표로, 소문자로', () => {
  const 상자 = 상자만들기();
  assert.strictEqual(돌리기(상자, 'gcalMailKey("A.B@Gmail.com")'), 'a,b@gmail,com');
  assert.strictEqual(돌리기(상자, 'gcalMailKey(" x@y.z ")'), 'x@y,z', '앞뒤 공백을 안 걷습니다');
});

test('② 안 이은 계정만 센다 — 이미 이은 것은 안 센다', () => {
  const 상자 = 상자만들기();
  assert.strictEqual(돌리기(상자, '안이은수()'), 2, 'aaa 는 이어져 있으니 bbb·ccc 둘이어야 합니다');
});

test('③ 많이 만든 사람부터 위로 — 찾기 쉬우라고', () => {
  const 상자 = 상자만들기();
  const 줄 = 돌리기(상자, 'JSON.stringify(메일줄들().map(function(r){return r.mail+":"+r.n;}))');
  assert.strictEqual(줄, JSON.stringify(['bbb@pureun.kr:3', 'aaa@gmail.com:2', 'ccc@gmail.com:1']));
});

test('④ 단추 — 할 일이 있을 때만 뜬다', () => {
  assert.match(돌리기(상자만들기(), '잇기단추Html()'), /계정 잇기 2명/, '남은 수를 안 적습니다');
  /* 다 이었으면 아예 안 그린다 — 늘 떠 있으면 머리줄만 좁아진다 */
  const 다이음 = 상자만들기({ 이은것: { 'aaa@gmail,com': 'P-003', 'bbb@pureun,kr': 'P-001', 'ccc@gmail,com': 'P-003' } });
  assert.strictEqual(돌리기(다이음, '잇기단추Html()'), '', '다 이었는데도 단추가 뜹니다');
});

test('⑤ 관리자가 아니면 단추가 없다 — 서버가 거절할 일을 미리 막는다', () => {
  const 남 = 상자만들기({ 나: { sid: 'P-003', name: '김철수', role: 'member' } });
  assert.strictEqual(돌리기(남, '잇기할수있나()'), false);
  assert.strictEqual(돌리기(남, '잇기단추Html()'), '', '관리자가 아닌데 단추가 뜹니다');
  const 없음 = 상자만들기({ 나: null });
  assert.strictEqual(돌리기(없음, '잇기단추Html()'), '', '로그인 전인데 단추가 뜹니다');
});

test('⑥ 고르는 목록은 «현직»만 — 퇴사자는 안 뜬다', () => {
  const html = 돌리기(상자만들기(), 'mailmapHtml()');
  assert.ok(html.indexOf('박퇴사') < 0, '퇴사자가 고르는 목록에 있습니다');
  assert.ok(html.indexOf('홍길동') >= 0 && html.indexOf('김철수') >= 0, '현직이 목록에 없습니다');
});

test('⑦ 이미 이은 줄은 «누구인지»를 적고 그 사람이 골라져 있다', () => {
  const html = 돌리기(상자만들기(), 'mailmapHtml()');
  assert.match(html, /김철수 이어짐/, '이어진 사람 이름을 안 적습니다');
  assert.match(html, /value="P-003" selected/, '이어진 사람이 골라져 있지 않습니다');
  assert.match(html, /아직 안 이음/, '안 이은 줄에 표시가 없습니다');
});

test('⑧ 구글 일정이 없으면 «없다»고 말한다 — 빈 창을 보여 주지 않는다', () => {
  const 빈달 = 상자만들기({ 일정: [] });
  assert.match(돌리기(빈달, 'mailmapHtml()'), /구글 일정이 없습니다/);
});

/* ── 저장 문 ── */
function 문(집는곳) {
  const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
  W.attach({ ref: (p) => ({ set: (v) => { if (집는곳) { 집는곳.자리 = p; 집는곳.값 = v; } return Promise.resolve(); } }) }, {});
  return W;
}

test('⑨ 저장 문 — 이알피와 같은 자리·같은 겉꼴({v,u})', async () => {
  const 잡은것 = {};
  const r = await 문(잡은것).saveMailMap({ 'aaa@gmail,com': 'P-003' });
  assert.strictEqual(r.ok, true, '멀쩡한 것을 막습니다: ' + JSON.stringify(r));
  assert.strictEqual(잡은것.자리, 'data/gcal_mail_sid', '엉뚱한 자리에 씁니다: ' + 잡은것.자리);
  assert.strictEqual(잡은것.값.v['aaa@gmail,com'], 'P-003');
  assert.strictEqual(typeof 잡은것.값.u, 'number', 'u(고친 시각)를 안 찍습니다');
});

test('⑩ 저장 문 — 점이 든 열쇠·빈 사번을 막는다', async () => {
  const W = 문();
  assert.strictEqual((await W.saveMailMap({ 'aaa@gmail.com': 'P-003' })).code, 'bad_id',
    '점이 든 열쇠를 그대로 올립니다 — 실시간DB 가 거절하거나 엉뚱한 자리에 씁니다');
  assert.strictEqual((await W.saveMailMap({ 'aaa@gmail,com': '' })).code, 'bad_sid', '빈 사번을 올립니다');
  assert.strictEqual((await W.saveMailMap([])).ok, false, '배열을 받아들입니다');
});

test('⑪ 저장 문 — «빈 지도»는 허락한다(색표와 다른 점)', async () => {
  const 잡은것 = {};
  const r = await 문(잡은것).saveMailMap({});
  assert.strictEqual(r.ok, true, '마지막 하나를 끊는 것은 멀쩡한 일인데 막습니다: ' + JSON.stringify(r));
  /* ⚠ 색표는 반대다 — 빈 색표를 올리면 모든 사람 색이 날아가므로 막아야 한다 */
  const W = require(path.join(ROOT, 'js', 'pu-cal-write.js'));
  assert.strictEqual((await W.saveColors({})).code, 'empty', '색표의 빈 지도 막이가 풀렸습니다');
});

test('⑫ 고르면 «바로» 저장하고, 색을 다시 칠하려고 일정을 다시 읽는다', () => {
  const fn = 함수몸('function 잇기저장(메일열쇠, sid){');
  assert.match(fn, /PuCalWrite\.saveMailMap/, '저장 문을 안 지납니다');
  assert.match(fn, /gcalLoad\(true\)/, '이은 뒤 일정을 다시 안 읽습니다 — 색이 그대로입니다');
  assert.match(fn, /delete 다음\[메일열쇠\]/, '«안 고름»으로 되돌릴 길이 없습니다');
  assert.match(fn, /m\.err =/, '실패를 사람에게 안 알립니다 — 조용히 실패합니다');
});
