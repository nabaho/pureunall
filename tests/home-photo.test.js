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
    stampShort: () => '9/14 20:00',
    PuHomeExport: { ORIGIN: 'https://example.test' },
    App: {
      draft: { key: o.key, srl: o.srl, name: '홍길동' },
      members: { [o.key]: { name: '홍길동', srl: o.srl } },
      사진: o.고른것, 올린사진: null, render() {}
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

/* ★ 올린 뒤 확인 (대표 지시 2026-09-14 「사진 올라가면 간단하게 사진 확인 가능하게」) */
test('★★ 올린 사진이 «그 자리»에 남는다 — 홈페이지를 안 열어도 확인된다', async () => {
  const { ctx } = 상자({ 고른것: 고른사진, 예: true });
  await ctx.사진넣기();
  const 남은것 = (ctx.App.올린사진 || {})['190'];
  assert.ok(남은것, '★★ 올린 사진이 안 남아 무엇이 올라갔는지 볼 길이 없습니다');
  assert.equal(남은것.미리, 고른사진.미리);
  assert.ok(남은것.언제, '언제 올렸는지가 없습니다');
});

test('★ 올린 사진이 편집칸에 «방금 올린 사진»으로 보인다', () => {
  const { ctx } = 상자();
  ctx.App.올린사진 = { '190': { 미리: 'data:,z', 크기말: '900×1200', 언제: '9/14 20:00' } };
  const h = ctx.사진칸Html({ key: '190', srl: 190 });
  assert.match(h, /방금 올린 사진/, '올린 사진을 안 보여 줍니다');
  assert.match(h, /사진크게\(/, '눌러서 크게 볼 길이 없습니다');
  assert.match(h, /홈페이지에서 보기/, '진짜 홈페이지로 가는 길이 없습니다');
});

/* ★ 끌어다 놓기 (대표 지시 2026-09-14 「파일 선택을 마우스 드래그 이동 가능하게」) */
test('★★ 사진 칸이 «끌어다 놓는 자리»다', () => {
  const { ctx } = 상자();
  const h = ctx.사진칸Html({ key: '190', srl: 190 });
  assert.match(h, /ondrop="사진놓기\(event\)"/, '★★ 끌어다 놓을 수 없습니다');
  assert.match(h, /ondragover="사진끌기\(event\)"/);
  assert.match(h, /끌어다 놓아도 됩니다/, '★ 놓을 수 있다는 것이 안 보이면 아무도 안 씁니다');
});

test('★★ 한 사람 칸에 여러 장을 놓으면 «조용히 한 장만» 받지 않는다', () => {
  const { ctx } = 상자();
  let 고른것 = null;
  ctx.사진고르기 = (el) => { 고른것 = el; };
  vm.runInContext([fnSource('사진끌기끝'), fnSource('사진놓기')].join('\n'), ctx);
  const 막음 = { preventDefault() {}, stopPropagation() {}, currentTarget: null,
                 dataTransfer: { files: [{ name: 'a.jpg' }, { name: 'b.jpg' }] } };
  ctx.사진놓기(막음);
  assert.equal(고른것, null, '★★ 두 장을 놓았는데 한 장만 조용히 받았습니다');
  assert.ok(ctx.말한것.some(t => /2장입니다/.test(t)), '왜 안 받았는지 안 알립니다');
  /* 한 장이면 그대로 받는다 */
  ctx.사진놓기({ preventDefault() {}, stopPropagation() {}, currentTarget: null,
                 dataTransfer: { files: [{ name: 'a.jpg' }] } });
  assert.ok(고른것, '한 장은 받아야 합니다');
});

test('취소하면 고른 사진을 버린다', () => {
  const { ctx } = 상자({ 고른것: 고른사진 });
  ctx.사진버리기();
  assert.equal(ctx.App.사진, null);
});

/* ══════ 여러 장 한 번에 — 대표 지시 2026-09-14 「여러 명도」 ══════
   ★ 사진은 사람마다 다르다. 한 장을 여럿에게 붙이는 일이 아니라 각자 주인에게
     나눠 주는 일이라, «파일 이름»으로 짝을 맞춘다. 흐릿하면 짐작하지 않는다. */
function 짝상자(옵) {
  const o = Object.assign({ 예: true, 답: null, 줄: [] }, 옵 || {});
  const 보낸것 = [];
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    stampShort: () => '9/14 20:00',
    App: {
      members: {
        '190': { name: '권형하', srl: 190 },
        '195': { name: '박한별', srl: 195 },
        '197': { name: '김혜민', srl: 197 },
        'x': { name: '글번호없음', srl: '' }
      },
      올린사진: null, render() {}
    },
    사진짝: { open: true, 줄: o.줄, 보내는중: false, 끝남: null },
    사진여럿그리기() {},
    checkHomepage() { 보낸것.push({ 무엇: 'checkHomepage' }); },
    말한것: [],
    say(t) { ctx.말한것.push(String(t)); return Promise.resolve(); },
    askYes(t) { ctx.말한것.push(String(t)); return Promise.resolve(o.예); },
    서버에게물어보기(방식, srl, 고칠것) {
      보낸것.push({ 방식: 방식, srl: srl, 고칠것: 고칠것 });
      const 답 = typeof o.답 === 'function' ? o.답(srl) : o.답;
      return Promise.resolve(답 || { ok: true, 저장됨: true, 바뀐것: [{ 이름: '얼굴 사진' }] });
    }
  };
  vm.createContext(ctx);
  vm.runInContext([fnSource('사진이름다듬기'), fnSource('사진주인찾기'),
    fnSource('사진받을사람들'), fnSource('사진여럿보내기')].join('\n'), ctx);
  return { ctx, 보낸것 };
}
const 장 = (파일, 주인) => ({ 파일: 파일, 주인: 주인, 종류: 'image/jpeg',
                              바이트64: 'AAEC', 미리: 'data:,x', 크기말: '900×1200 · 90KB' });

test('★★ 파일 이름으로 주인을 찾는다 — 「권형하.jpg」', () => {
  const { ctx } = 짝상자();
  const 사람 = ctx.사진받을사람들();
  assert.equal(ctx.사진주인찾기('권형하.jpg', 사람), '190');
  assert.equal(ctx.사진주인찾기('박한별.PNG', 사람), '195');
  /* 띄어쓰기·괄호·번호가 붙어도 찾는다 */
  assert.equal(ctx.사진주인찾기('권형하 (1).jpg', 사람), '190');
  assert.equal(ctx.사진주인찾기('2026_김혜민_대표.jpg', 사람), '197');
});

test('★★★ 흐릿하면 «짐작하지 않는다» — 남의 얼굴이 올라간다', () => {
  const { ctx } = 짝상자();
  const 사람 = ctx.사진받을사람들();
  assert.equal(ctx.사진주인찾기('IMG_4821.jpg', 사람), '', '★★★ 모르는 이름에 주인을 붙였습니다');
  assert.equal(ctx.사진주인찾기('사진.jpg', 사람), '');
  assert.equal(ctx.사진주인찾기('', 사람), '');
  /* ★★★ 두 사람 이름이 «둘 다» 들어 있으면 한 사람으로 못 좁힌다 — 비워야 한다 */
  assert.equal(ctx.사진주인찾기('권형하_박한별_단체.jpg', 사람), '',
    '★★★ 두 사람 이름이 든 파일을 «앞사람»에게 붙였습니다');
});

test('★ 이름 다듬기 — 확장자·띄어쓰기·괄호를 걷는다', () => {
  const { ctx } = 짝상자();
  assert.equal(ctx.사진이름다듬기('권형하.jpg'), '권형하', '확장자를 안 걷습니다');
  assert.equal(ctx.사진이름다듬기('권형하 (1).JPEG'), '권형하1');
  assert.equal(ctx.사진이름다듬기('Kim_Hye-Min.png'), 'kimhyemin');
  assert.equal(ctx.사진이름다듬기(''), '');
});

test('★★ 동명이인이면 비워 둔다 — 사람이 고른다', () => {
  const { ctx } = 짝상자();
  ctx.App.members['999'] = { name: '권형하', srl: 999 };
  assert.equal(ctx.사진주인찾기('권형하.jpg', ctx.사진받을사람들()), '');
});

test('★ 글 번호가 없는 사람에게는 안 붙인다 — 보낼 자리가 없다', () => {
  const { ctx } = 짝상자();
  assert.equal(ctx.사진주인찾기('글번호없음.jpg', ctx.사진받을사람들()), '');
  assert.ok(!ctx.사진받을사람들().some(p => p.key === 'x'));
});

test('★★ 주인이 없는 줄은 «안 보낸다»', async () => {
  const { ctx, 보낸것 } = 짝상자({ 줄: [장('권형하.jpg', '190'), 장('IMG_1.jpg', '')] });
  await ctx.사진여럿보내기();
  const 쓴것 = 보낸것.filter(x => x.방식 === '쓰기');
  assert.deepEqual(쓴것.map(x => x.srl), [190], '★★ 주인 없는 사진을 올렸습니다');
});

test('★★ 읽지 못한 줄도 «안 보낸다»', async () => {
  const 깨진것 = { 파일: 'x.pdf', 주인: '195', 막힘: '그림 파일이 아닙니다' };
  const { ctx, 보낸것 } = 짝상자({ 줄: [장('권형하.jpg', '190'), 깨진것] });
  await ctx.사진여럿보내기();
  assert.deepEqual(보낸것.filter(x => x.방식).map(x => x.srl), [190]);
});

test('★★★ 한 분에게 두 장이 가면 «멈추고» 알린다', async () => {
  const { ctx, 보낸것 } = 짝상자({ 줄: [장('권형하.jpg', '190'), 장('권형하2.jpg', '190')] });
  await ctx.사진여럿보내기();
  assert.deepEqual(보낸것, [], '★★★ 한 분에게 두 장을 보냈습니다 — 뒤엣것이 앞엣것을 덮습니다');
  assert.ok(ctx.말한것.some(t => /두 장이 갑니다/.test(t)));
});

test('★★ 「예」 하기 전에는 한 장도 안 올라간다', async () => {
  const { ctx, 보낸것 } = 짝상자({ 예: false, 줄: [장('권형하.jpg', '190')] });
  await ctx.사진여럿보내기();
  assert.deepEqual(보낸것, []);
});

test('★ 한 장이 막혀도 나머지는 간다 — 그리고 못 올린 것을 적는다', async () => {
  const { ctx, 보낸것 } = 짝상자({
    줄: [장('권형하.jpg', '190'), 장('박한별.jpg', '195')],
    답: (srl) => (srl === 190 ? { ok: false, 저장됨: false, error: '안 받아 줌' } : null) });
  await ctx.사진여럿보내기();
  assert.deepEqual(보낸것.filter(x => x.방식).map(x => x.srl), [190, 195],
    '한 장이 막히자 나머지를 포기했습니다');
  assert.match(String(ctx.사진짝.끝남), /못 올림 1장/);
  assert.match(String(ctx.사진짝.끝남), /권형하/);
});

test('★ 올라간 줄은 목록에서 빠진다 — 남으면 또 올리게 된다', async () => {
  const { ctx } = 짝상자({ 줄: [장('권형하.jpg', '190'), 장('박한별.jpg', '195')] });
  await ctx.사진여럿보내기();
  assert.deepEqual(ctx.사진짝.줄, [], '올린 사진이 목록에 남아 있습니다');
});

test('★ 올린 사진은 그 사람 편집칸에도 남는다 — 확인용', async () => {
  const { ctx } = 짝상자({ 줄: [장('권형하.jpg', '190')] });
  await ctx.사진여럿보내기();
  assert.ok(ctx.App.올린사진 && ctx.App.올린사진['190'], '올린 사진이 안 남았습니다');
  assert.equal(ctx.App.올린사진['190'].미리, 'data:,x');
});

test('★ 여럿 보낼 때도 «사진만» 보낸다', async () => {
  const { ctx, 보낸것 } = 짝상자({ 줄: [장('권형하.jpg', '190')] });
  await ctx.사진여럿보내기();
  보낸것.filter(x => x.방식).forEach(x =>
    assert.deepEqual(Object.keys(Object.assign({}, x.고칠것)), ['사진']));
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
