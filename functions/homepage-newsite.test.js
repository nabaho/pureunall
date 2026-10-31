// 새 사이트 지킴이 — 매달 자동 올리기와 매일 열쇠 점검을 «실제로 돌려» 본다 (2026-10-31)
// ★ 대표 「앞으로 이런 문제 없게 자동으로 프로그램 되게 해라」. 그날 퇴사자가 새 사이트에 남아 있었고,
//   열쇠가 죽어 있었고, 올리는 길은 처음부터 막혀 있었다 — 셋 다 아무도 몰랐다.
// ★ 쪽은 저장소의 실제 사본(site/people/index.html)을 본으로 쓴다. 사람 수·글 번호는 그 쪽에서 «읽어서» 쓴다 —
//   쪽이 바뀌어도 검사가 깨지지 않게(지금 값을 박지 않는다). 이름은 쓰지 않는다.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const HN = require('./homepage-newsite');
require('./site-people/pu-site-people.js');
const PSP = globalThis.PuSitePeople;

/* 깃허브가 주는 그대로(LF) — 윈도 작업본은 CRLF 로 풀려 있어 «다시 그리면 달라짐»으로 헛걸린다 */
const 지금쪽 = fs.readFileSync(path.join(__dirname, '..', 'site', 'people', 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const 지금사람 = PSP.사람읽기(지금쪽);

/* 지금 쪽의 사람마다 구성원 한 줄 + 재직 명부 한 줄(sid = 'S' + 글 번호) */
function 자료() {
  const members = {}, roster = [];
  지금사람.forEach((p) => {
    members[p.srl] = { name: p.이름, position1: p.직책1, position2: p.직책2, srl: p.srl,
      careers: p.경력.slice(), sid: 'S' + p.srl };
    roster.push({ sid: 'S' + p.srl, status: 'active' });
  });
  return { members, roster };
}
function 도구(d, 덧) {
  const 쓴것 = {}, 올린것 = [];
  const t = Object.assign({
    읽기: async (p) => ({ 'homepage/members': d.members, 'data/user_dir': d.roster, 'homepage/auto/config': d.config || null })[p],
    쓰기: async (p, v) => { 쓴것[p] = v; },
    쪽읽기: async () => 지금쪽,
    올리기: async (html, note) => { 올린것.push({ html, note }); return { commit: { sha: 'abcdef1234' } }; },
    지금: () => 1000,
    누가: 'auto'
  }, 덧 || {});
  return { t, 쓴것, 올린것 };
}

test('검사 준비 — 본으로 쓸 쪽에 사람이 넉넉히 있다', () => {
  assert.ok(지금사람.length > HN.빠짐문턱 + 1, '본 쪽의 사람이 너무 적어 아래 검사가 뜻이 없다');
});

test('★ 명부에서 퇴사(retired)한 사람은 저절로 빠지고, 빠진 쪽이 올라간다', async () => {
  const d = 자료();
  const 나간 = 지금사람[1].srl;
  d.roster.find((r) => r.sid === 'S' + 나간).status = 'retired';
  const { t, 쓴것, 올린것 } = 도구(d);
  const r = await HN.돌기(t);
  assert.strictEqual(r.ok, true, r.실패);
  assert.strictEqual(r.올림, true, '★ 퇴사자가 있는데 올리지 않았다');
  assert.strictEqual(올린것.length, 1);
  const 올라간 = PSP.사람읽기(올린것[0].html).map((p) => p.srl);
  assert.ok(!올라간.includes(나간), '★ 퇴사자가 새 사이트에 그대로 남았다');
  assert.strictEqual(올라간.length, 지금사람.length - 1);
  assert.strictEqual(r.뺀수, 1);
  assert.strictEqual(쓴것['homepage/auto/newsite'].올림, true, '결과를 화면이 볼 자리에 남기지 않았다');
  assert.strictEqual(쓴것['homepage/auto/newsite'].commit, 'abcdef1');
});

test('★ 휴직·사유 있는 남기기는 빠지지 않는다 · 안 올림·내린 표시는 빠진다', async () => {
  const d = 자료();
  const [a, b, c, e] = 지금사람.map((p) => p.srl);
  d.roster.find((r) => r.sid === 'S' + a).status = 'leave';
  d.roster.find((r) => r.sid === 'S' + b).status = 'retired';
  d.members[b].keepOnSite = { at: 'x', by: 'y', why: '지사장' };
  d.members[c].offSite = true;
  d.members[e].takenDown = { at: 1 };
  const { t, 올린것 } = 도구(d);
  await HN.돌기(t);
  const 올라간 = PSP.사람읽기(올린것[0].html).map((p) => p.srl);
  assert.ok(올라간.includes(a), '★ 휴직자를 뺐다 — 휴직은 퇴사가 아니다');
  assert.ok(올라간.includes(b), '★ 사유 있는 남기기를 뺐다');
  assert.ok(!올라간.includes(c), '★ 「새 사이트에서 빼기」한 사람이 올라갔다');
  assert.ok(!올라간.includes(e), '★ 내린 사람이 올라갔다');
});

test('★ 직원과 안 이은 사람은 이름으로 맞추지 않고 그대로 둔다 — 대신 센다', async () => {
  const d = 자료();
  const x = 지금사람[0].srl;
  delete d.members[x].sid;
  const r = await HN.돌기(도구(d).t);
  assert.strictEqual(r.연결없음수, 1);
  assert.strictEqual(r.ok, true);
});

test('★ 바뀐 것이 없으면 올리지 않는다', async () => {
  /* «지난번에 우리 자료로 올린 쪽»이 지금 쪽인 경우 — 읽어 들인 글자는 빈칸이 접혀 있어 본 쪽 그대로와는 다르다 */
  const d = 자료();
  const 지난번 = PSP.쪽그리기(지금쪽, PSP.올릴사람(지금쪽, Object.keys(d.members).map((k) => d.members[k])).갈것);
  const { t, 올린것, 쓴것 } = 도구(d, { 쪽읽기: async () => 지난번 });
  const r = await HN.돌기(t);
  assert.strictEqual(r.ok, true, r.실패);
  assert.strictEqual(r.바뀜, false, '같은 자료로 다시 그렸는데 쪽이 달라졌다');
  assert.strictEqual(올린것.length, 0);
  assert.strictEqual(쓴것['homepage/auto/newsite'].올림, false);
});

test('★ 한꺼번에 문턱보다 많이 빠지면 올리지 않고 멈춘다', async () => {
  const d = 자료();
  지금사람.slice(0, HN.빠짐문턱 + 1).forEach((p) => { d.roster.find((r) => r.sid === 'S' + p.srl).status = 'retired'; });
  const { t, 올린것 } = 도구(d);
  const r = await HN.돌기(t);
  assert.ok(r.멈춤, '★ 한꺼번에 많이 빠지는데 멈추지 않았다');
  assert.strictEqual(올린것.length, 0, '★ 멈췄다면서 올렸다');

  const d2 = 자료();
  지금사람.slice(0, HN.빠짐문턱).forEach((p) => { d2.roster.find((r) => r.sid === 'S' + p.srl).status = 'retired'; });
  const r2 = await HN.돌기(도구(d2).t);
  assert.strictEqual(r2.멈춤, '', '문턱만큼 빠지는 것은 올려야 한다');
  assert.strictEqual(r2.올림, true);
});

test('★ 명부를 못 읽으면 아무것도 올리지 않고 실패를 남긴다', async () => {
  const d = 자료(); d.roster = [];
  const { t, 올린것, 쓴것 } = 도구(d);
  const r = await HN.돌기(t);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(올린것.length, 0);
  assert.ok(쓴것['homepage/auto/newsite'].실패, '실패를 남기지 않았다 — 화면 띠가 안 뜬다');
});

test('★ 올리다 막히면(열쇠·깃허브 오류) 까닭을 남긴다 — 조용히 넘기지 않는다', async () => {
  const d = 자료();
  d.roster.find((r) => r.sid === 'S' + 지금사람[0].srl).status = 'retired';
  const { t, 쓴것 } = 도구(d, { 올리기: async () => { throw new Error('GitHub 401: Bad credentials'); } });
  const r = await HN.돌기(t);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.올림, false);
  assert.match(쓴것['homepage/auto/newsite'].실패, /401/);

  const { t: t2, 쓴것: 쓴2 } = 도구(자료(), { 쪽읽기: async () => { throw new Error('GitHub 404: Not Found'); } });
  await HN.돌기(t2);
  assert.match(쓴2['homepage/auto/newsite'].실패, /404/, '쪽을 못 읽은 것도 남겨야 한다');
});

test('★ 자동 연결을 꺼 두면 아무것도 안 한다', async () => {
  const d = 자료(); d.config = { off: true };
  const { t, 쓴것, 올린것 } = 도구(d);
  const r = await HN.돌기(t);
  assert.strictEqual(r.꺼짐, true);
  assert.strictEqual(Object.keys(쓴것).length, 0);
  assert.strictEqual(올린것.length, 0);
});

test('★ 열쇠 점검 — 두 저장소를 다 읽어야 «이상 없음», 하나라도 막히면 어디가 왜 막혔는지 남긴다', async () => {
  const 쓴것 = {};
  const ok = await HN.열쇠점검({ 읽어보기: async () => 'x', 쓰기: async (p, v) => { 쓴것[p] = v; }, 지금: () => 5 });
  assert.deepStrictEqual(쓴것['homepage/auto/keyCheck'], { at: 5, ok: true, 까닭: '' });
  assert.strictEqual(ok.ok, true);

  const 읽은것 = [];
  const bad = await HN.열쇠점검({
    읽어보기: async (이름) => { 읽은것.push(이름); if (이름 === '우리 사본') throw new Error('GitHub 401: Bad credentials'); },
    쓰기: async (p, v) => { 쓴것[p] = v; }, 지금: () => 6 });
  assert.deepStrictEqual(읽은것, ['새 사이트', '우리 사본'], '두 저장소를 다 읽어 봐야 한다');
  assert.strictEqual(bad.ok, false);
  assert.match(쓴것['homepage/auto/keyCheck'].까닭, /우리 사본.*401/);
});
