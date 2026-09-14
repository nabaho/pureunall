/* 얼굴 사진 넣기 — 대표 지시 2026-09-14 「화면에서 바꿀 수 있게 사진 넣기 해달라」.

   ★ 지켜야 할 것
     ① 고른 사진은 «그 사람 것»이다 — 다른 사람 화면에서 눌러도 안 나간다
     ② 사람이 「예」 하기 전에는 안 올라간다 (보기 → 쓰기)
     ③ 사진만 보낸다 — 이름·직책·경력을 함께 고치지 않는다
     ④ 글 번호가 없으면 칸을 아예 안 그린다 (보낼 자리가 없다) */
const test = require('node:test');
const assert = require('node:assert/strict');
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
    else if (c === '}') { depth--; if (!depth) return html.slice(start, i + 1); }
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}

function 상자(옵) {
  const o = Object.assign({ 예: true, 답: null, srl: 190, key: '190', 고른것: null }, 옵 || {});
  const 보낸것 = [];
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    App: {
      draft: { key: o.key, srl: o.srl, name: '홍길동' },
      사진: o.고른것, render() {}
    },
    checkHomepage() { 보낸것.push({ 무엇: 'checkHomepage' }); },
    걸린것글자: (a) => String((a && a.error) || ''),
    말한것: [],
    say(t) { ctx.말한것.push(String(t)); return Promise.resolve(); },
    askYes(t) { ctx.말한것.push(String(t)); return Promise.resolve(o.예); },
    서버에게물어보기(방식, srl, 고칠것) {
      보낸것.push({ 방식: 방식, srl: srl, 고칠것: 고칠것 });
      const 답 = typeof o.답 === 'function' ? o.답(방식) : o.답;
      if (답) return Promise.resolve(답);
      return Promise.resolve({ ok: true, 저장됨: 방식 === '쓰기',
        바뀐것: [{ 이름: '얼굴 사진', 옛: '지금 것', 새: '새 사진' }] });
    }
  };
  vm.createContext(ctx);
  vm.runInContext([fnSource('사진칸Html'), fnSource('사진버리기'), fnSource('사진넣기')].join('\n'), ctx);
  return { ctx, 보낸것 };
}
const 고른사진 = { key: '190', srl: 190, 종류: 'image/jpeg', 바이트64: 'AAEC',
                  미리: 'data:image/jpeg;base64,AAEC', 크기말: '600×800 · 74KB' };

test('★ 글 번호가 없으면 사진 칸을 아예 안 그린다 — 보낼 자리가 없다', () => {
  const { ctx } = 상자();
  assert.equal(ctx.사진칸Html({ key: 'a', srl: '' }), '');
  assert.equal(ctx.사진칸Html(null), '');
  assert.ok(ctx.사진칸Html({ key: 'a', srl: 190 }).indexOf('type="file"') > 0);
});

test('★★ 고른 사진은 «그 사람 것»이다 — 남의 화면에서는 안 보인다', () => {
  const { ctx } = 상자({ 고른것: 고른사진 });
  assert.ok(ctx.사진칸Html({ key: '190', srl: 190 }).indexOf('이 사진으로 바꾸기') > 0);
  assert.ok(ctx.사진칸Html({ key: '193', srl: 193 }).indexOf('이 사진으로 바꾸기') < 0,
    '★★ 다른 사람 화면에 남의 사진이 뜹니다');
});

test('★★★ 남의 사진은 «보내지도» 않는다', async () => {
  const { ctx, 보낸것 } = 상자({ 고른것: Object.assign({}, 고른사진, { key: '999' }) });
  await ctx.사진넣기();
  assert.deepEqual(보낸것, [], '★★★ 다른 사람 사진을 이 사람에게 올렸습니다');
});

test('고른 사진이 없으면 아무것도 안 보낸다', async () => {
  const { ctx, 보낸것 } = 상자({ 고른것: null });
  await ctx.사진넣기();
  assert.deepEqual(보낸것, []);
});

test('★★ 「예」 하기 전에는 안 올라간다', async () => {
  const { ctx, 보낸것 } = 상자({ 고른것: 고른사진, 예: false });
  await ctx.사진넣기();
  assert.deepEqual(보낸것.map(x => x.방식), ['보기'], '★★ 묻기 전에 올렸습니다');
});

test('★★ 「예」 하면 보기 → 쓰기 차례로 간다', async () => {
  const { ctx, 보낸것 } = 상자({ 고른것: 고른사진, 예: true });
  await ctx.사진넣기();
  assert.deepEqual(보낸것.map(x => x.방식 || x.무엇), ['보기', '쓰기', 'checkHomepage']);
});

test('★★★ 사진만 보낸다 — 이름·직책·경력을 함께 고치지 않는다', async () => {
  const { ctx, 보낸것 } = 상자({ 고른것: 고른사진, 예: true });
  await ctx.사진넣기();
  보낸것.filter(x => x.방식).forEach((x) => {
    const 열쇠 = Object.keys(Object.assign({}, x.고칠것));
    assert.deepEqual(열쇠, ['사진'],
      '★★★ 사진 말고 다른 칸도 함께 보냈습니다: ' + 열쇠.join(', '));
    assert.equal(x.고칠것.사진.종류, 'image/jpeg');
    assert.equal(x.고칠것.사진.바이트64, 'AAEC');
  });
});

test('보기에서 막히면 쓰기로 안 간다', async () => {
  const { ctx, 보낸것 } = 상자({ 고른것: 고른사진, 예: true,
    답: (방식) => (방식 === '보기' ? { ok: false, error: '사진 칸을 못 찾았습니다' } : null) });
  await ctx.사진넣기();
  assert.deepEqual(보낸것.map(x => x.방식), ['보기']);
  assert.ok(ctx.말한것.some(t => /넣지 않았습니다/.test(t)));
});

test('서버가 못 받으면 «바꿨다»고 하지 않고, 고른 사진도 안 버린다', async () => {
  const { ctx } = 상자({ 고른것: 고른사진, 예: true,
    답: (방식) => (방식 === '쓰기' ? { ok: false, 저장됨: false, error: '안 받아 줌' } : null) });
  await ctx.사진넣기();
  assert.ok(!ctx.말한것.some(t => /^사진을 바꿨습니다/.test(t)));
  assert.ok(ctx.App.사진, '실패했는데 고른 사진을 버렸습니다 — 다시 고르셔야 합니다');
});

test('잘되면 고른 사진을 비우고 대조를 다시 돌린다', async () => {
  const { ctx, 보낸것 } = 상자({ 고른것: 고른사진, 예: true });
  await ctx.사진넣기();
  assert.equal(ctx.App.사진, null, '올린 뒤에도 미리보기가 남아 있습니다');
  assert.ok(보낸것.some(x => x.무엇 === 'checkHomepage'));
});

test('취소하면 고른 사진을 버린다', () => {
  const { ctx } = 상자({ 고른것: 고른사진 });
  ctx.사진버리기();
  assert.equal(ctx.App.사진, null);
});

/* ── 화면에 붙어 있나 ── */
test('★★ 사진 칸이 «붙은 칸»(틀고정)에 들어 있다 — 구르면 못 찾는다', () => {
  const s = fnSource('memberEdit');
  assert.match(s, /붙은칸 \+= 사진칸Html\(d\)/,
    '★★ 사진 칸이 붙은 칸에 없습니다 — 아래로 굴러가 안 보입니다');
});

test('★ 줄이는 규칙이 있다 — 폰 사진을 그대로 보내지 않는다', () => {
  const s = fnSource('사진고르기');
  assert.match(s, /사진긴쪽/, '긴 쪽을 줄이지 않습니다');
  assert.match(s, /toDataURL\('image\/jpeg'/, 'jpeg 로 줄이지 않습니다');
  /* 투명 png 가 검게 나오지 않게 흰 바탕을 깐다 */
  assert.match(s, /fillRect\(0, 0, w, h\)/, '흰 바탕을 안 깔면 투명 png 가 검게 나옵니다');
  /* 작은 그림을 억지로 키우지 않는다 */
  assert.match(s, /Math\.min\(1,/, '작은 그림을 키우면 뭉개집니다');
});

test('★ 그림이 아닌 파일은 화면에서 먼저 막는다', () => {
  const s = fnSource('사진고르기');
  assert.match(s, /image\\\/\(jpeg\|png\|webp\)/, '그림 종류를 안 가립니다');
});

test('★ 꾸밈이 있다 — 없으면 미리보기가 원본 크기로 화면을 덮는다', () => {
  assert.match(html, /(?:^|\n)\.pthumb\{/, '.pthumb 꾸밈이 없습니다');
  assert.match(html, /(?:^|\n)\.photorow\{/, '.photorow 꾸밈이 없습니다');
});
