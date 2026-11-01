// 새 사이트 직원 상자 — 매달 자동 올리기가 직원도 «같은 잣대»로 다룬다 (대표 승인 2026-11-01 직원 소개 1단계)
// ★ 쪽은 저장소의 실제 사본(site/people/index.html). 직원 수·직급은 그 쪽에서 «읽어서» 쓴다 — 지금 값을 박지 않는다.
// ★ 이름은 지어낸 것만 쓴다(예시에 실명 금지).
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const HN = require('./homepage-newsite');
require('./site-people/pu-site-people.js');
const PSP = globalThis.PuSitePeople;

const 지금쪽 = fs.readFileSync(path.join(__dirname, '..', 'site', 'people', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const 지금사람 = PSP.사람읽기(지금쪽);
const 지금직원 = PSP.직원읽기(지금쪽);
const 가짜이름 = ['김예시', '이샘플', '박보기', '최가상', '정모형', '한보기', '윤예시', '서샘플'];

/* 노무사는 지금 쪽 그대로, 직원은 지금 쪽 직원 수만큼 지어낸 이름으로(직급은 쪽에서 읽은 것) */
function 자료(직원도) {
  const members = {}, roster = [];
  지금사람.forEach((p) => {
    members[p.srl] = { name: p.이름, position1: p.직책1, position2: p.직책2, srl: p.srl,
      careers: p.경력.slice(), sid: 'S' + p.srl };
    roster.push({ sid: 'S' + p.srl, status: 'active' });
  });
  if (직원도) {
    지금직원.forEach((s, i) => {
      members['staff-' + i] = { kind: 'staff', name: 가짜이름[i], position1: s.직급, order: i + 1, sid: 'T' + i };
      roster.push({ sid: 'T' + i, status: 'active' });
    });
  }
  return { members, roster };
}
function 도구(d) {
  const 쓴것 = {}, 올린것 = [];
  const t = {
    읽기: async (p) => ({ 'homepage/members': d.members, 'data/user_dir': d.roster, 'homepage/auto/config': null })[p],
    쓰기: async (p, v) => { 쓴것[p] = v; },
    쪽읽기: async () => 지금쪽,
    올리기: async (html, note) => { 올린것.push({ html, note }); return { commit: { sha: 'abcdef1234' } }; },
    지금: () => 1000,
    누가: 'auto'
  };
  return { t, 쓴것, 올린것 };
}

test('검사 준비 — 본 쪽에 직원이 문턱보다 많다', () => {
  assert.ok(지금직원.length > HN.빠짐문턱, '본 쪽의 직원이 너무 적어 아래 검사가 뜻이 없다');
});

test('★★ 우리 자료에 직원이 «없으면» 직원 줄을 건드리지 않는다 — 처음 가져오기 전에 지우지 않게', async () => {
  /* 노무사 카드는 다시 찍으며 띄움이 고르게 될 수 있어 «올렸는지»가 아니라 «직원 줄이 그대로인지»를 본다 */
  const d = 자료(false);
  d.roster.find((x) => x.sid === 'S' + 지금사람[0].srl).status = 'retired';   // 일부러 한 번 올리게
  const { t, 올린것 } = 도구(d);
  const r = await HN.돌기(t);
  assert.strictEqual(r.ok, true, r.실패);
  assert.strictEqual(올린것.length, 1);
  const 원 = 지금쪽.indexOf('<div class="people_box">');
  const 새 = 올린것[0].html;
  assert.strictEqual(새.slice(새.indexOf('<div class="people_box">') - 60), 지금쪽.slice(원 - 60),
    '★ 직원 자료가 없는데 직원 줄을 바꿨다');
});

test('★ 직원은 «카드 못 감»(글 번호 없음)으로 걸리지 않는다', () => {
  const d = 자료(true);
  const r = HN.고르기(지금쪽, d.members, d.roster);
  assert.strictEqual(r.ok, true, r.실패);
  assert.strictEqual(r.못간수, 0, '★ 직원이 노무사 카드 쪽으로 가서 「글 번호 없음」에 걸렸다');
  assert.strictEqual(r.직원인원, 지금직원.length);
});

test('★★ 퇴사한 직원은 저절로 빠지고, 고친 직급이 그대로 올라간다 · 노무사 카드는 그대로', async () => {
  const d = 자료(true);
  d.roster.find((x) => x.sid === 'T1').status = 'retired';
  d.members['staff-0'].position1 = '새직급';
  const { t, 쓴것, 올린것 } = 도구(d);
  const r = await HN.돌기(t);
  assert.strictEqual(r.ok, true, r.실패);
  assert.strictEqual(올린것.length, 1, '★ 바뀐 것이 있는데 안 올렸다');
  const 올라간 = PSP.직원읽기(올린것[0].html);
  assert.strictEqual(올라간.length, 지금직원.length - 1);
  assert.ok(!올라간.some((s) => s.이름 === 가짜이름[1]), '★ 퇴사한 직원이 새 사이트에 남았다');
  assert.deepStrictEqual(올라간[0], { 이름: 가짜이름[0], 직급: '새직급' });
  assert.strictEqual(PSP.사람읽기(올린것[0].html).length, 지금사람.length, '★ 직원을 고치다 노무사 카드가 바뀌었다');
  assert.strictEqual(쓴것['homepage/auto/newsite'].직원인원, 지금직원.length - 1);
});

test('★ 차례(order)대로 그린다 — 열쇠 순이 아니다', () => {
  const d = 자료(true);
  d.members['staff-0'].order = 99;
  const r = HN.고르기(지금쪽, d.members, d.roster);
  const 올라간 = PSP.직원읽기(r.새쪽);
  assert.strictEqual(올라간[올라간.length - 1].이름, 가짜이름[0]);
});

test('★★ 직원이 한 번에 문턱보다 많이 빠지면 «올리지 않고» 멈춘다 — 노무사와 따로 센다', async () => {
  const d = 자료(true);
  for (let i = 0; i <= HN.빠짐문턱; i++) d.roster.find((x) => x.sid === 'T' + i).status = 'retired';
  const { t, 쓴것, 올린것 } = 도구(d);
  const r = await HN.돌기(t);
  assert.strictEqual(올린것.length, 0, '★ 직원이 한꺼번에 빠지는데 올렸다');
  assert.match(쓴것['homepage/auto/newsite'].멈춤, /직원/);
});

test('직원이 «모두» 안 올림이면 빈 줄을 내보내지 않고 멈춘다', () => {
  const d = 자료(true);
  지금직원.forEach((_, i) => { d.members['staff-' + i].offSite = true; });
  const r = HN.고르기(지금쪽, d.members, d.roster);
  assert.ok(r.멈춤, '★ 직원 줄이 통째로 사라질 쪽을 만들었다');
  assert.strictEqual(r.새쪽, '');
});

test('명부에 없는(안 이은) 직원은 이름으로 맞추지 않고 그대로 올린다', () => {
  const d = 자료(true);
  delete d.members['staff-2'].sid;
  const r = HN.고르기(지금쪽, d.members, d.roster);
  assert.ok(PSP.직원읽기(r.새쪽).some((s) => s.이름 === 가짜이름[2]));
  assert.ok(r.연결없음수 >= 1);
});
