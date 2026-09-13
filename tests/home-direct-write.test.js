/* 「지금 홈페이지 바로 고치기」 — 붙여넣기 없이 서버가 고치는 길.
   ═══════════════════════════════════════════════════════════════════════
   글자 찾기로 보지 않고 «실제로 돌려» 본다. 여기서 지켜야 할 것은 둘이다:
     ① 사람이 「예」 하기 전에는 절대로 «쓰기»가 나가지 않는다.
     ② 서버가 「안전하지 않다」고 하면 그 자리에서 멈춘다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(R, 'pu-home.html'), 'utf8');

/* 함수 한 덩이를 통째로 떠 온다 — 따옴표·주석 안의 중괄호를 세지 않는다 */
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

/* 서버 대신 답하는 «가짜 서버»를 놓고 화면 함수를 돌린다 */
function 상자(옵) {
  const o = Object.assign({ 예: true, 답: null, srl: 190, dirty: false }, 옵 || {});
  const 부른것 = [];
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    App: {
      dirty: o.dirty, lineFormat: '줄바꿈만',
      draft: { srl: o.srl, name: '홍길동', position1: '대표', position2: '공인노무사',
               careers: ['現 가나상사 자문', '前 다라산업 자문'] }
    },
    PuHomeExport: { careersText: (a) => (a || []).join('\n') },
    checkHomepage() { 부른것.push({ 무엇: 'checkHomepage' }); },
    말한것: [],
    say(t, b) { ctx.말한것.push(String(t)); return Promise.resolve(); },
    askYes(t, b) { ctx.말한것.push(String(t)); return Promise.resolve(o.예); },
    서버에게물어보기(방식, srl, 고칠것) {
      부른것.push({ 무엇: 방식, srl: srl, 고칠것: 고칠것 });
      const 답 = typeof o.답 === 'function' ? o.답(방식) : o.답;
      if (답) return Promise.resolve(답);
      return Promise.resolve({ ok: true, 방식: 방식, srl: srl, 저장됨: 방식 === '쓰기',
        바뀐것: [{ 이름: '경력사항', 옛: '한 줄', 새: '두\n줄' }], 못찾은것: [] });
    }
  };
  vm.createContext(ctx);
  vm.runInContext([fnSource('바뀔것글자'), fnSource('걸린것글자'),
    fnSource('홈페이지바로고치기')].join('\n'), ctx);
  return { ctx, 부른것 };
}

test('「예」 하기 전에는 «보기»만 나간다 — 쓰기는 안 나간다', async () => {
  const { ctx, 부른것 } = 상자({ 예: false });
  await ctx.홈페이지바로고치기();
  assert.deepEqual(부른것.map((x) => x.무엇), ['보기'],
    '사람이 「아니오」 했는데 홈페이지에 썼습니다');
});

test('「예」 하면 «보기 → 쓰기» 차례로 나간다', async () => {
  const { ctx, 부른것 } = 상자({ 예: true });
  await ctx.홈페이지바로고치기();
  assert.deepEqual(부른것.map((x) => x.무엇), ['보기', '쓰기', 'checkHomepage']);
});

test('보기와 쓰기가 «같은 내용»을 보낸다 — 사이에 값이 바뀌면 안 된다', async () => {
  const { ctx, 부른것 } = 상자({ 예: true });
  await ctx.홈페이지바로고치기();
  const 둘 = 부른것.filter((x) => x.무엇 === '보기' || x.무엇 === '쓰기');
  assert.deepEqual(둘[0].고칠것, 둘[1].고칠것,
    '사람이 본 것과 보낸 것이 다릅니다 — 확인의 뜻이 없어집니다');
});

test('서버가 «안전하지 않다»고 하면 그 자리에서 멈춘다', async () => {
  /* ⚠ 「바뀐 것」을 일부러 채워 둔다 — 비워 두면 «고칠 것이 없다»로 빠져나가
       ok:false 를 안 봐도 검사가 통과한다(2026-09-13 이빨 확인에서 실제로 그랬다). */
  const { ctx, 부른것 } = 상자({ 예: true,
    답: () => ({ ok: false, error: '안전하지 않아 아무것도 쓰지 않았습니다.',
                 바뀐것: [{ 이름: '경력사항', 옛: 'ㄱ', 새: 'ㄴ' }],
                 걸린것: ['숨은 칸(content)이 안 왔습니다'] }) });
  await ctx.홈페이지바로고치기();
  assert.deepEqual(부른것.map((x) => x.무엇), ['보기'], '서버가 막았는데 또 보냈습니다');
  assert.ok(ctx.말한것.length, '왜 못 고쳤는지 사람에게 알려야 합니다');
});

test('이미 같으면 아무것도 안 보낸다', async () => {
  const { ctx, 부른것 } = 상자({ 예: true,
    답: () => ({ ok: true, 바뀐것: [], 못찾은것: [] }) });
  await ctx.홈페이지바로고치기();
  assert.deepEqual(부른것.map((x) => x.무엇), ['보기']);
});

test('글 번호가 없으면 서버를 아예 안 부른다', async () => {
  const { ctx, 부른것 } = 상자({ srl: 0 });
  await ctx.홈페이지바로고치기();
  assert.deepEqual(부른것, [], '글 번호도 없이 홈페이지에 들어갔습니다');
});

test('저장 안 된 것이 있는데 「아니오」 하면 안 보낸다', async () => {
  const { ctx, 부른것 } = 상자({ dirty: true, 예: false });
  await ctx.홈페이지바로고치기();
  assert.deepEqual(부른것, []);
});

test('경력사항은 «줄 수»로만 보여 준다 — 스물몇 줄을 통째로 띄우지 않는다', () => {
  const { ctx } = 상자();
  const 글 = ctx.바뀔것글자([{ 이름: '경력사항', 옛: 'ㄱ\nㄴ', 새: 'ㄱ\nㄴ\nㄷ' }]);
  assert.ok(/2줄/.test(글) && /3줄/.test(글), '줄 수로 요약하지 않았습니다: ' + 글);
  assert.ok(글.indexOf('ㄴ') < 0, '경력 본문이 통째로 들어갔습니다');
});

test('단추가 편집칸에 달려 있고 «파란 단추»를 뺏어 오지 않는다', () => {
  const m = /<button class="([^"]*)" onclick="홈페이지바로고치기\(\)"/.exec(html);
  assert.ok(m, '「바로 고치기」 단추가 없습니다');
  assert.ok(!/\bpri\b/.test(m[1]),
    '파란 단추는 띠마다 하나(저장)입니다 — 이 단추까지 파랗게 하면 무엇을 눌러야 할지 흐려집니다');
});
