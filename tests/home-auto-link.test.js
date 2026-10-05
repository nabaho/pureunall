'use strict';
/* 홈페이지 월간 자동 연결 — 구성원 글을 푸른ERP 직원(sid)과 «사람이 확인해» 잇는다 (설계 2026-10-05).
   ★ 자동 내리기는 이어 둔 글만 움직인다. 이름은 열쇠가 아니다(온톨로지 규칙).
   ★ 화면 함수를 떼어 상자(vm)에서 실제로 돌린다. 이름은 예시(홍길동·김가나)만. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8');

function fnSource(name) {
  const re = new RegExp('(?:^|\\n)(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(html);
  assert.ok(m, name + ' 를 화면에서 찾지 못했습니다');
  const start = m.index + (m[0][0] === '\n' ? 1 : 0);
  let mode = null, depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    const c = html[i], n = html[i + 1];
    if (mode === '/*') { if (c === '*' && n === '/') { mode = null; i++; } continue; }
    if (mode === '//') { if (c === '\n') mode = null; continue; }
    if (mode) { if (c === '\\') { i++; continue; } if (c === mode) mode = null; continue; }
    if (c === '/' && n === '*') { mode = '/*'; i++; continue; }
    if (c === '/' && n === '/') { mode = '//'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { mode = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}

/* 가짜 db — 어느 자리에 무엇을 «어떻게»(set/update) 썼는지 남긴다 */
function 상자(더) {
  const 쓴것 = [];
  const ctx = Object.assign({
    console: { warn() {}, log() {} },
    App: { members: {}, staff: [], render() {} },
    db: { ref: (p) => ({
      set: async (v) => { 쓴것.push(['set', p, v]); },
      update: async (v) => { 쓴것.push(['update', p, v]); }
    }) },
    esc: (s) => String(s == null ? '' : s),
    toast() {}, say: async () => {}, askYes: async () => true,
    window: {}
  }, 더 || {});
  ctx.쓴것 = 쓴것;
  vm.createContext(ctx);
  vm.runInContext(['잇기후보', '이름하나만맞는것', '직원잇기', '한번에잇기', '직원연결칸Html']
    .map(fnSource).join('\n'), ctx);
  return ctx;
}
const 직원들 = () => [
  { sid: 'S1', name: '홍길동' }, { sid: 'S2', name: '홍길동' }, { sid: 'S3', name: '김가나' }];

test('이름이 «한 사람과만» 맞고, 아직 안 이었고, 글 번호가 있는 것만 한 번에 이을 후보다', () => {
  const ctx = 상자();
  ctx.App.staff = 직원들();
  ctx.App.members = {
    a: { name: '홍길동', srl: 1 },             // 동명이인 — 빠진다
    b: { name: '김가나', srl: 2 },             // 하나만 맞음 — 든다
    c: { name: '김가나', srl: 3, sid: 'S3' },  // 이미 이음 — 빠진다
    d: { name: '김가나' }                       // 글 번호 없음 — 빠진다
  };
  const r = JSON.parse(JSON.stringify(ctx.이름하나만맞는것()));
  assert.deepStrictEqual(r, [{ key: 'b', sid: 'S3' }]);
});

test('잇기는 그 사람의 sid «한 자리»만 쓴다 — 구성원 자료를 통째로 덮지 않는다', async () => {
  const ctx = 상자();
  ctx.App.members = { b: { name: '김가나', srl: 2, careers: ['x'] } };
  await ctx.직원잇기('b', 'S3');
  assert.strictEqual(ctx.쓴것.length, 1);
  assert.strictEqual(ctx.쓴것[0][1], 'homepage/members/b/sid');
  assert.strictEqual(ctx.쓴것[0][2], 'S3');
  assert.strictEqual(ctx.App.members.b.sid, 'S3');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.App.members.b.careers)), ['x']);
});

test('한 번에 잇기는 «예»를 안 누르면 아무것도 쓰지 않는다', async () => {
  const ctx = 상자({ askYes: async () => false });
  ctx.App.staff = 직원들();
  ctx.App.members = { b: { name: '김가나', srl: 2 } };
  await ctx.한번에잇기();
  assert.strictEqual(ctx.쓴것.length, 0);
});

test('한 번에 잇기는 «예»를 누르면 후보마다 한 자리씩 쓴다', async () => {
  const ctx = 상자();
  ctx.App.staff = 직원들().concat([{ sid: 'S4', name: '이다라' }]);
  ctx.App.members = { b: { name: '김가나', srl: 2 }, e: { name: '이다라', srl: 5 } };
  await ctx.한번에잇기();
  const 자리 = ctx.쓴것.map(x => x[1]).sort();
  assert.deepStrictEqual(자리, ['homepage/members/b/sid', 'homepage/members/e/sid']);
});

test('편집칸의 직원 줄 — 동명이인이면 사람이 고르게 하고, 저절로 고르지 않는다', () => {
  const ctx = 상자();
  ctx.App.staff = 직원들();
  ctx.App.members = { a: { name: '홍길동', srl: 1 } };
  const h = ctx.직원연결칸Html({ key: 'a', srl: '1' });
  assert.ok(h.includes('S1') && h.includes('S2'), '후보 둘이 다 보여야 합니다');
  assert.ok(!/selected/.test(h), '동명이인인데 하나를 미리 골라 두었습니다');
});

test('편집칸의 직원 줄 — 글 번호가 없으면 안 그린다(자동 내리기와 상관없다)', () => {
  const ctx = 상자();
  ctx.App.staff = 직원들();
  ctx.App.members = { a: { name: '홍길동' } };
  assert.strictEqual(ctx.직원연결칸Html({ key: 'a', srl: '' }), '');
});

test('편집칸의 직원 줄은 «한 줄»이다 — 줄바꿈 상자를 쌓지 않는다', () => {
  const ctx = 상자();
  ctx.App.staff = 직원들();
  ctx.App.members = { a: { name: '홍길동', srl: 1, sid: 'S1' }, b: { name: '김가나', srl: 2 } };
  for (const k of ['a', 'b']) {
    const h = ctx.직원연결칸Html({ key: k, srl: String(ctx.App.members[k].srl) });
    assert.ok(h, k + ' 줄이 비었습니다');
    assert.ok(!/<br|<\/div>\s*<div/.test(h), '두 줄로 쌓았습니다: ' + h);
  }
});

/* saveRecord 를 가짜 서버 사본으로 실제로 돌린다 */
async function 저장해보기(서버값, next) {
  let 쓴것 = null;
  const ctx = {
    console: { warn() {} }, App: { members: { k: Object.assign({}, 서버값) }, pages: {} },
    currentUserName: () => '관리자', histStamp: () => 't1',
    db: { ref: (p) => ({
      transaction: async (fn) => { 쓴것 = fn(JSON.parse(JSON.stringify(서버값))); return { committed: true }; },
      set: async () => {}
    }) }
  };
  vm.createContext(ctx);
  vm.runInContext(fnSource('saveRecord'), ctx);
  await ctx.saveRecord('member', 'k', next);
  return 쓴것;
}

test('★ 구성원을 편집해 저장해도 «자동 연결 칸»(직원 번호·내린 표시·사진·올리기 허락)이 안 지워진다', async () => {
  const 서버 = { name: '홍길동', srl: '101', careers: [], updatedAt: 0,
    sid: 'S1', takenDown: { at: 1 }, photo: { bytes: 9 }, publishOk: { at: 2 } };
  const 쓴것 = await 저장해보기(서버, { name: '홍길동', srl: '101', careers: ['現 가'] });
  assert.strictEqual(쓴것.sid, 'S1');
  assert.ok(쓴것.takenDown && 쓴것.photo && 쓴것.publishOk);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(쓴것.careers)), ['現 가']);
});

test('저장할 것에 그 칸이 «있으면» 그 값이 이긴다(사람이 일부러 바꾼 것)', async () => {
  const 쓴것 = await 저장해보기({ name: '홍길동', updatedAt: 0, sid: 'S1' }, { name: '홍길동', sid: 'S2' });
  assert.strictEqual(쓴것.sid, 'S2');
});

test('명부에서 넣을 때 직원 번호를 함께 남긴다 — 그 번호가 «그 이름»일 때만', () => {
  const 몸 = fnSource('addFromRoster');
  assert.match(몸, /rec\.sid\s*=/);
  assert.match(fnSource('명부재직자'), /sid:/);
  assert.match(fnSource('openRosterAdd'), /esc\(s\.sid\)/);
});

function 표시상자(members) {
  const 쓴것 = [];
  const ctx = { console: { warn() {} }, App: { members: members },
    todayString: () => '2026-10-05', currentUserName: () => '관리자',
    db: { ref: (p) => ({ set: async (v) => { 쓴것.push([p, v]); } }) } };
  vm.createContext(ctx);
  vm.runInContext(fnSource('내린표시남기기'), ctx);
  ctx.쓴것 = 쓴것;
  return ctx;
}

test('★ 내린 표시 — 이어 둔 글에, 표시가 없을 때만, 그 칸 하나만 쓴다', async () => {
  const ctx = 표시상자({ a: { sid: 'S1', srl: 193 }, b: { srl: 194 }, c: { sid: 'S3', takenDown: { at: 1 } } });
  assert.strictEqual(await ctx.내린표시남기기('a', '대조'), true);
  assert.strictEqual(await ctx.내린표시남기기('b', '대조'), false, '안 이은 글에 표시를 남겼습니다');
  assert.strictEqual(await ctx.내린표시남기기('c', '대조'), false, '이미 있는 표시를 덮었습니다');
  assert.deepStrictEqual(ctx.쓴것.map(x => x[0]), ['homepage/members/a/takenDown']);
});

test('★ 손으로 내리거나 대조가 «퇴사·홈페이지에 없음»을 보면 내린 표시를 남긴다 — 다음 달에 또 안 내리게', () => {
  assert.match(fnSource('applyStatus'), /'done'[\s\S]{0,80}내린표시남기기\(/);
  assert.match(fnSource('한사람내리기'), /내린표시남기기\(key/);
  assert.match(fnSource('퇴사자한번에내리기'), /내린표시남기기\(x\.key/);
});

test('공개 명부를 읽을 때 sid 를 함께 싣는다 — 잇기의 열쇠다', () => {
  const ctx = { console: { warn() {} } };
  vm.createContext(ctx);
  vm.runInContext(fnSource('staffFromRoster'), ctx);
  const r = ctx.staffFromRoster([{ sid: 'S1', name: '홍길동', status: 'active' }], 'dir');
  assert.strictEqual(r.staff[0].sid, 'S1');
});

test('할 일에 «아직 안 이은 구성원 글»이 뜬다 — 명부를 읽었을 때만', () => {
  const 몸 = fnSource('jobsOf').replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(몸, /한번에잇기\(\)/, '할 일에서 한 번에 잇기로 가는 단추가 없습니다');
  const i = 몸.indexOf('한번에잇기()');
  const 앞 = 몸.slice(Math.max(0, i - 600), i);
  assert.match(앞, /App\.staff/, '명부를 못 읽었는데도 잇기를 권합니다');
});
