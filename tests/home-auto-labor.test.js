'use strict';
/* 홈페이지 월간 자동 연결 3단계 — 새 노무사에게 «사진»과 «올리기 허락»을 넣는 화면 (설계 2026-10-05).
   ★ 넣어 두면 다음 달 1일에 서버가 구성원 소개에 새 글로 올리고, 받은 글 번호를 이 사람에게 잇는다.
   ★ 화면 함수를 떼어 상자(vm)에서 실제로 돌린다. 이름은 예시(홍길동)만. */
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

function 상자(더) {
  const 쓴것 = [];
  const ctx = Object.assign({
    console: { warn() {}, log() {} },
    App: { members: {}, staff: [{ sid: 'S1', name: '홍길동', status: 'active' }], lineFormat: 'plain', render() {}, isAdmin: true, dirty: false },
    db: { ref: (p) => ({ set: async (v) => { 쓴것.push(['set', p, v]); } }) },
    esc: (s) => String(s == null ? '' : s),
    toast() {}, say: async () => {}, askYes: async () => true,
    currentUserName: () => '관리자', todayString: () => '2026-10-05',
    PuHomeExport: { careersText: (c) => (c || []).join('\n') },
    사진줄이기: (f, 끝) => 끝({ 종류: 'image/jpeg', 바이트64: 'QUJD', 미리: 'data:x', 크기말: '400×500 · 3KB' }),
    memberKind: (m) => (m && m.kind) || 'labor',
    window: {}
  }, 더 || {});
  ctx.쓴것 = 쓴것;
  vm.createContext(ctx);
  vm.runInContext(['새사진넣기', '올리기허락', '새노무사준비', '새노무사칸Html', '새노무사목록'].map(fnSource).join('\n'), ctx);
  return ctx;
}
const 노무사 = (더) => Object.assign({ name: '홍길동', kind: 'labor', srl: '', sid: 'S1', careers: ['現 가'] }, 더 || {});

test('사진 넣기 — 사진은 사진 자리에, 표시는 그 사람의 «사진 칸 하나»에만', async () => {
  const ctx = 상자();
  ctx.App.members = { n1: 노무사({ careers: ['x'] }) };
  assert.strictEqual(await ctx.새사진넣기('n1', { type: 'image/jpeg' }), true);
  const 자리 = ctx.쓴것.map(x => x[1]);
  assert.deepStrictEqual(자리.sort(), ['homepage/memberPhotos/n1', 'homepage/members/n1/photo']);
  assert.strictEqual(ctx.쓴것.find(x => x[1] === 'homepage/memberPhotos/n1')[2].b64, 'QUJD');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.App.members.n1.careers)), ['x'], '다른 칸을 건드렸습니다');
});

test('올리기 허락 — 그 순간의 경력 글을 담는다', async () => {
  const ctx = 상자();
  ctx.App.members = { n1: 노무사({ careers: ['現 가', '前 나'], photo: { bytes: 9 } }) };
  assert.strictEqual(await ctx.올리기허락('n1'), true);
  const w = ctx.쓴것[0];
  assert.strictEqual(w[1], 'homepage/members/n1/publishOk');
  assert.strictEqual(w[2].경력글, '現 가\n前 나');
});

test('올리기 허락 — 사진·경력·직원 연결이 없거나 저장 안 한 고침이 있으면 막는다', async () => {
  const 경우 = [
    [{ photo: null }, false, '사진 없음'],
    [{ photo: { bytes: 9 }, careers: [] }, false, '경력 없음'],
    [{ photo: { bytes: 9 }, sid: '' }, false, '직원과 안 이음'],
    [{ photo: { bytes: 9 }, srl: '190' }, false, '이미 홈페이지에 있음']
  ];
  for (const [더, _, 뜻] of 경우) {
    const ctx = 상자();
    ctx.App.members = { n1: 노무사(더) };
    assert.strictEqual(await ctx.올리기허락('n1'), false, 뜻);
    assert.strictEqual(ctx.쓴것.length, 0, 뜻);
  }
  const ctx = 상자();
  ctx.App.members = { n1: 노무사({ photo: { bytes: 9 } }) };
  ctx.App.dirty = true; ctx.App.draft = { key: 'n1' };
  assert.strictEqual(await ctx.올리기허락('n1'), false, '저장 안 한 고침이 있는데 허락했습니다');
});

test('준비 상태 — 허락한 뒤 경력을 고쳤으면 «다시 허락»이 필요하다', () => {
  const ctx = 상자();
  const 다 = ctx.새노무사준비(노무사({ photo: { bytes: 9 }, publishOk: { 경력글: '現 가' } }));
  assert.strictEqual(다.준비, true);
  const 낡음 = ctx.새노무사준비(노무사({ careers: ['現 가', '前 나'], photo: { bytes: 9 }, publishOk: { 경력글: '現 가' } }));
  assert.strictEqual(낡음.준비, false);
  assert.strictEqual(낡음.낡은허락, true);
});

test('편집칸 — 글 번호가 있거나 직원(노무사 아님)이면 안 그리고, 새 노무사면 사진 칸과 허락 단추를 그린다', () => {
  const ctx = 상자();
  ctx.App.members = { n1: 노무사() };
  const h = ctx.새노무사칸Html({ key: 'n1', srl: '', mkind: 'labor' });
  assert.match(h, /type="file"/);
  assert.match(h, /올리기허락\('n1'\)/);
  assert.strictEqual(ctx.새노무사칸Html({ key: 'n1', srl: '190', mkind: 'labor' }), '');
  assert.strictEqual(ctx.새노무사칸Html({ key: 'n1', srl: '', mkind: 'staff' }), '');
});

test('편집칸 — 다 갖췄으면 «다음 달 1일에 올라간다»', () => {
  const ctx = 상자();
  ctx.App.members = { n1: 노무사({ photo: { bytes: 9 }, publishOk: { 경력글: '現 가', at: '2026-10-05' } }) };
  assert.match(ctx.새노무사칸Html({ key: 'n1', srl: '', mkind: 'labor' }), /다음 달 1일/);
});

test('새 노무사 목록 — 글 번호 없음·노무사·홈페이지에서 안 뺌·아직 안 올림', () => {
  const ctx = 상자();
  ctx.App.members = {
    a: 노무사(), b: 노무사({ srl: '9' }), c: 노무사({ kind: 'staff' }),
    d: 노무사({ offSite: true }), e: 노무사({ uploadedAt: { at: 1 } })
  };
  assert.deepStrictEqual(JSON.parse(JSON.stringify(ctx.새노무사목록().map(x => x.key))), ['a']);
});

test('할 일·구성원 편집칸이 새 부품을 쓴다', () => {
  assert.match(fnSource('jobsOf'), /새노무사목록/);
  assert.match(fnSource('memberEdit'), /새노무사칸Html\(/);
});
