/* 퇴사자를 «한 번에» 내리기 — 대표 지시 2026-09-13.
   ═══════════════════════════════════════════════════════════════════════
   지켜야 할 것 셋:
     ① 사람이 「예」 하기 전에는 한 사람도 안 내린다.
     ② 한 사람이 막혀도 나머지는 계속 간다 — 그리고 «못 내린 사람»을 반드시 적는다.
     ③ 글 번호가 없는 사람은 건너뛴다(엉뚱한 글을 내리지 않게). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
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
    else if (c === '}') { depth--; if (!depth) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}

/* 가짜 서버를 놓고 «실제로 돌려» 본다 */
function 상자(옵) {
  const o = Object.assign({ 예: true, 답: null, 사람: [
    { key: 'a', name: '홍길동', srl: 101, status: 'toRemove' },
    { key: 'b', name: '김서방', srl: 102, status: 'toRemove' },
    { key: 'c', name: '이몽룡', srl: 103, status: 'same' }
  ] }, 옵 || {});
  const 보낸것 = [];
  const members = {}, chk = {};
  o.사람.forEach(p => { members[p.key] = { name: p.name, srl: p.srl };
                        chk[p.key] = { status: p.status }; });
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    App: { members: members, check: { members: chk }, filt() {} },
    checkHomepage() { 보낸것.push({ 무엇: 'checkHomepage' }); },
    말한것: [], 마지막몸말: '',
    say(t, b) { ctx.말한것.push(String(t)); ctx.마지막몸말 = String(b || ''); return Promise.resolve(); },
    askYes(t, b) { ctx.말한것.push(String(t)); ctx.마지막몸말 = String(b || ''); return Promise.resolve(o.예); },
    서버에게물어보기(방식, srl, 고칠것) {
      보낸것.push({ 방식: 방식, srl: srl, 고칠것: 고칠것 });
      const 답 = typeof o.답 === 'function' ? o.답(srl) : o.답;
      if (답) return Promise.resolve(답);
      return Promise.resolve({ ok: true, 저장됨: true,
        바뀐것: [{ 이름: '홈페이지에서', 옛: '보임', 새: '비공개' }] });
    }
  };
  vm.createContext(ctx);
  vm.runInContext([fnSource('살펴본것글자'), fnSource('내릴사람들'),
    fnSource('퇴사자한번에내리기')].join('\n'), ctx);
  return { ctx, 보낸것 };
}

/* ⚠ 상자(vm) 안에서 만든 배열·객체는 바깥과 «다른 realm» 이라 deepEqual 이 틀린다.
     Array.from·Object.assign 으로 바깥 것으로 옮겨 견준다. */
const 밖으로 = (a) => Array.from(a || []);

test('「내릴 것」인 사람만 고른다 — 멀쩡한 사람은 안 건드린다', () => {
  const { ctx } = 상자();
  assert.deepEqual(밖으로(ctx.내릴사람들()).map(x => x.name), ['홍길동', '김서방']);
});

test('글 번호가 없는 사람은 건너뛴다 — 엉뚱한 글을 내리지 않게', () => {
  const { ctx } = 상자({ 사람: [
    { key: 'a', name: '홍길동', srl: 0, status: 'toRemove' },
    { key: 'b', name: '김서방', srl: 102, status: 'toRemove' }
  ] });
  assert.deepEqual(밖으로(ctx.내릴사람들()).map(x => x.name), ['김서방']);
});

test('★ 「예」 하기 전에는 한 사람도 안 내린다', async () => {
  const { ctx, 보낸것 } = 상자({ 예: false });
  await ctx.퇴사자한번에내리기();
  assert.deepEqual(보낸것, [], '물어보기 전에 홈페이지를 고쳤습니다');
});

test('★ 「예」 하면 두 사람에게 차례로 «비공개»를 보낸다', async () => {
  const { ctx, 보낸것 } = 상자({ 예: true });
  await ctx.퇴사자한번에내리기();
  const 쓰기 = 보낸것.filter(x => x.방식 === '쓰기');
  assert.deepEqual(쓰기.map(x => x.srl), [101, 102]);
  쓰기.forEach(x => assert.deepEqual(Object.assign({}, x.고칠것), { 비공개: true },
    '내리면서 딴 칸을 함께 보냈습니다 — 내리는 것은 감추는 것 하나입니다'));
});

test('★ 한 사람이 막혀도 나머지는 간다 — 그리고 «못 내린 사람»을 적는다', async () => {
  const { ctx, 보낸것 } = 상자({ 예: true,
    답: (srl) => (srl === 101
      ? { ok: false, error: '안전하지 않습니다', 걸린것: ['숨은 칸이 안 왔습니다'] }
      : { ok: true, 저장됨: true, 바뀐것: [{ 이름: '홈페이지에서', 옛: '보임', 새: '비공개' }] }) });
  await ctx.퇴사자한번에내리기();
  assert.deepEqual(보낸것.filter(x => x.방식 === '쓰기').map(x => x.srl), [101, 102],
    '한 사람이 막히자 나머지를 포기했습니다');
  assert.ok(ctx.말한것.some(t => /일부만/.test(t)),
    '못 내린 사람이 있는데 «다 됐다»고 했습니다');
});

/* ★★ 2026-09-13 에 실제로 이 구멍으로 퇴사자가 안 내려갔다.
     비공개 자리를 «못 찾아» 바뀐 것이 0이었는데, 그것을 「이미 내려가 있음」으로
     읽어 「내렸습니다」라고 말했다. 조용한 실패가 성공으로 보고된 것이다. */
test('★★ 「못 찾았다」를 «이미 내려가 있다»로 읽지 않는다', async () => {
  const { ctx } = 상자({ 예: true,
    답: () => ({ ok: true, 저장됨: false, 바뀐것: [],
                 못찾은것: ['비공개(이 화면에서 «비공개로 바꾸는 자리»를 찾지 못했습니다)'] }) });
  await ctx.퇴사자한번에내리기();
  assert.ok(ctx.말한것.some(t => /일부만/.test(t)),
    '★★ 한 명도 못 내렸는데 «내렸습니다»라고 했습니다 — 조용한 실패입니다');
});

/* ★ 2026-09-13 — 「비공개 자리가 없다」로 막혔을 때, 대표께서 «다시 누르실» 일이
     없게 서버가 «이 게시판이 할 수 있는 일»을 실패와 함께 실어 보낸다.
     화면이 그것을 버리면 한 번 더 누르게 된다. */
test('★★ 못 내렸을 때 서버가 보낸 «살펴본 것»을 버리지 않는다', async () => {
  const { ctx } = 상자({ 예: true,
    답: () => ({ ok: true, 저장됨: false, 바뀐것: [],
                 못찾은것: ['비공개(자리를 찾지 못했습니다)'],
                 살펴본것: { 쓰는화면: ['procBoardInsertDocument'],
                            읽는화면: ['dispBoardDelete', 'dispDocumentManageDocument'] } }) });
  await ctx.퇴사자한번에내리기();
  const 끝말 = ctx.말한것.join(' ');
  assert.ok(/일부만/.test(끝말), '못 내렸는데 됐다고 했습니다');
  assert.ok(ctx.마지막몸말 && /dispDocumentManageDocument/.test(ctx.마지막몸말),
    '★★ 서버가 보낸 «할 수 있는 일»을 화면이 버렸습니다 — 다시 누르게 됩니다');
});

test('다 되면 «일부만»이라고 하지 않는다', async () => {
  const { ctx } = 상자({ 예: true });
  await ctx.퇴사자한번에내리기();
  assert.ok(!ctx.말한것.some(t => /일부만/.test(t)));
});

test('내릴 사람이 없으면 서버를 아예 안 부른다', async () => {
  const { ctx, 보낸것 } = 상자({ 사람: [{ key: 'c', name: '이몽룡', srl: 103, status: 'same' }] });
  await ctx.퇴사자한번에내리기();
  assert.deepEqual(보낸것, []);
});

test('끝나면 대조를 다시 돌려 딱지를 새로 붙인다', async () => {
  const { ctx, 보낸것 } = 상자({ 예: true });
  await ctx.퇴사자한번에내리기();
  assert.ok(보낸것.some(x => x.무엇 === 'checkHomepage'),
    '내려놓고 딱지를 안 고치면 화면이 옛 상태로 남습니다');
});

/* ── 한 사람만 내리기 ── 전에는 다섯 걸음짜리 안내가 떴다 ─────────────── */
function 한사람상자(옵) {
  const o = Object.assign({ 예: true, 답: null, srl: 193, 손으로: false }, 옵 || {});
  const 한것 = [];
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    App: { members: { a: { name: '홍길동', srl: o.srl } } },
    checkHomepage() { 한것.push({ 무엇: 'checkHomepage' }); },
    copyPrivate(k) { 한것.push({ 무엇: '손으로', key: k }); },
    물은것: [],
    say(t) { ctx.물은것.push(String(t)); return Promise.resolve(); },
    askYes(t) {
      ctx.물은것.push(String(t));
      return Promise.resolve(/내리지 못했습니다/.test(String(t)) ? o.손으로 : o.예);
    },
    서버에게물어보기(방식, srl, 고칠것) {
      한것.push({ 방식: 방식, srl: srl, 고칠것: 고칠것 });
      if (typeof o.답 === 'function') return o.답();
      if (o.답) return Promise.resolve(o.답);
      return Promise.resolve({ ok: true, 저장됨: true, 바뀐것: [{ 이름: '홈페이지에서' }] });
    }
  };
  vm.createContext(ctx);
  vm.runInContext(fnSource('한사람내리기'), ctx);
  return { ctx, 한것 };
}

test('★ 한 사람 내리기는 «안내»가 아니라 바로 서버로 간다', async () => {
  const { ctx, 한것 } = 한사람상자();
  await ctx.한사람내리기('a');
  const 쓴것 = 한것.filter(x => x.방식 === '쓰기');
  assert.equal(쓴것.length, 1, '서버로 안 갔습니다 — 옛 안내로 되돌아갔습니다');
  assert.equal(쓴것[0].srl, 193);
  assert.deepEqual(Object.assign({}, 쓴것[0].고칠것), { 비공개: true });
});

test('한 사람 내리기도 「예」 하기 전에는 안 보낸다', async () => {
  const { ctx, 한것 } = 한사람상자({ 예: false });
  await ctx.한사람내리기('a');
  assert.deepEqual(한것, []);
});

test('★ 서버가 막히면 «왜»를 보이고, 손으로 하는 길을 그때 연다', async () => {
  const { ctx, 한것 } = 한사람상자({
    답: () => Promise.resolve({ ok: false, error: '안전하지 않습니다',
                                걸린것: ['확인표가 없습니다'] }), 손으로: true });
  await ctx.한사람내리기('a');
  assert.ok(ctx.물은것.some(t => /내리지 못했습니다/.test(t)), '왜 안 됐는지 안 알렸습니다');
  assert.ok(한것.some(x => x.무엇 === '손으로'), '손으로 하는 길이 사라졌습니다');
});

test('★★ 한 사람도 — 「못 찾았다」를 «됐다»로 읽지 않는다', async () => {
  const { ctx, 한것 } = 한사람상자({
    답: () => Promise.resolve({ ok: true, 저장됨: false, 바뀐것: [],
                                못찾은것: ['비공개(자리를 찾지 못했습니다)'] }), 손으로: false });
  await ctx.한사람내리기('a');
  assert.ok(!ctx.물은것.some(t => /^내렸습니다/.test(t)),
    '★★ 못 내렸는데 «내렸습니다»라고 했습니다');
  assert.ok(!한것.some(x => x.무엇 === 'checkHomepage'),
    '★ 안 내려갔는데 딱지를 새로 붙이러 갔습니다');
});

test('막혔을 때 «아니오» 하면 손으로 하는 창을 안 연다', async () => {
  const { ctx, 한것 } = 한사람상자({
    답: () => Promise.resolve({ ok: false, error: '안 됨', 걸린것: [] }), 손으로: false });
  await ctx.한사람내리기('a');
  assert.ok(!한것.some(x => x.무엇 === '손으로'));
});

test('글 번호가 없으면 서버를 안 부른다', async () => {
  const { ctx, 한것 } = 한사람상자({ srl: 0 });
  await ctx.한사람내리기('a');
  assert.deepEqual(한것, []);
});

test('★ ⋯ 안의 「비공개로」 단추가 바로 내리는 쪽에 걸려 있다', () => {
  assert.match(html, /onclick="한사람내리기\(/, '★ 단추가 바로 내리는 쪽에 안 걸려 있습니다');
  assert.ok(!/onclick="copyPrivate\('/.test(html),
    '★ 단추가 아직 옛 «다섯 걸음 안내»를 바로 엽니다 — 막혔을 때만 열려야 합니다');
});

/* ★★ 2026-09-14 — 이 게시판에 「비공개」 자리가 «없다»는 것이 정찰로 확인됐다.
     그래서 실제로 하는 일은 «휴지통으로 옮기기»다. 화면이 「비공개로 바꿉니다」라고
     말하면 그것은 거짓말이다 — 사람은 손님에게만 안 보이는 줄 알게 된다. */
test('★★ 화면이 «하는 일 그대로» 말한다 — 비공개가 아니라 휴지통', () => {
  const 물음 = [fnSource('퇴사자한번에내리기'), fnSource('한사람내리기')].join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  assert.match(물음, /휴지통/, '★★ 휴지통이라고 말하지 않습니다');
  assert.match(물음, /되살릴 수 있/, '★ 되살릴 수 있다는 말이 없습니다');
  assert.ok(!/「비공개」로 바꿉니다/.test(물음),
    '★★ 아직 「비공개로 바꿉니다」라고 말합니다 — 그 자리는 이 게시판에 없습니다');
  /* 지운다고 읽히면 안 된다 */
  assert.match(물음, /지우지 않습니다/, '★ 「지우지 않습니다」를 안 적었습니다');
});

test('★ 할 일 카드에서 한 번에 내리는 문이 보인다', () => {
  assert.match(html, /onclick="퇴사자한번에내리기\(\)"/,
    '★ 한 번에 내리는 단추가 어디에도 없습니다');
  /* 「지우기」로 읽히면 안 된다 — 지우지 않고 감추는 것이다 */
  assert.ok(!/퇴사자한번에내리기[\s\S]{0,120}>[^<]*지우/.test(html),
    '★ 단추가 «지운다»고 읽힙니다 — 내리는 것은 비공개입니다');
});
