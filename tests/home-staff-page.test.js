/* 「일반직원 수정」 탭 — 대표 지시 2026-09-14
   「직원이름고치기를 다른 창으로 넘기지 말고, 구성원소개에 일반직원 수정으로 두고 탭변경으로 해라」.

   ★ 홈페이지가 둘을 다르게 만들어 놓았다(실측):
       노무사 = 게시판 «글»(글 번호·사진·덧창 있음)
       직원   = 쪽 본문에 박힌 «글자»(아무것도 없음)
     구성원 목록은 «글»만 본다. 그래서 직원은 구성원 줄로는 못 세우고, «쪽»으로 고친다.
     다만 그 자리는 구성원 소개 «안»의 탭이어야 한다 — 다른 갈래로 보내면 못 찾는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8');
const H = html.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

function fnSource(name, src) {
  const s = src || html;
  const re = new RegExp('(?:^|\\n)(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(s);
  assert.ok(m, name + ' 를 화면에서 찾지 못했습니다');
  const start = m.index + (m[0][0] === '\n' ? 1 : 0);
  let mode = null, depth = 0;
  for (let i = s.indexOf('{', start); i < s.length; i++) {
    const c = s[i], n = s[i + 1];
    if (mode === '/*') { if (c === '*' && n === '/') { mode = null; i++; } continue; }
    if (mode === '//') { if (c === '\n') mode = null; continue; }
    if (mode) { if (c === '\\') { i++; continue; } if (c === mode) mode = null; continue; }
    if (c === '/' && n === '*') { mode = '/*'; i++; continue; }
    if (c === '/' && n === '/') { mode = '//'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { mode = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return s.slice(start, i + 1); }
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}
const constLine = (name) => {
  const m = new RegExp("\\nconst " + name + " = [^\\n]*;").exec(html);
  assert.ok(m, 'const ' + name + ' 을 찾지 못했습니다');
  return m[0].replace(/\nconst /, '\nvar ');
};

function 상자(옵) {
  const o = Object.assign({ 이미: false, 못읽음: false, 저장탈: null, dirty: false, 버림: true }, 옵 || {});
  const 한것 = [];
  const cfg = o.이미 ? { people: { label: '일반직원', order: 9 }, work1: { label: '자문서비스', order: 1 } }
                     : { work1: { label: '자문서비스', order: 1 } };
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    App: { pageConfig: cfg, group: 'work', filter: '', pick: 'work1', dirty: o.dirty,
           pages: {}, check: null, members: {}, render() { 한것.push({ 무엇: 'render' }); } },
    loadDraft() { 한것.push({ 무엇: 'loadDraft' }); },
    쪽자동읽기() { 한것.push({ 무엇: '읽기' }); },
    leaveDraft() { return Promise.resolve(o.버림); },
    refuseIfPageConfigUnread() { return o.못읽음; },
    savePageConfig(next) {
      한것.push({ 무엇: 'save', next: JSON.parse(JSON.stringify(next)) });
      return o.저장탈 ? Promise.reject(new Error(o.저장탈)) : Promise.resolve();
    },
    말한것: [],
    say(t) { ctx.말한것.push(String(t)); return Promise.resolve(); }
  };
  vm.createContext(ctx);
  vm.runInContext([constLine('직원쪽'), constLine('직원쪽이름'),
    fnSource('직원쪽있나'), fnSource('직원줄'), fnSource('직원탭열기')].join('\n'), ctx);
  return { ctx, 한것 };
}

test('★★ 「일반직원 수정」은 구성원 소개의 «딱지 줄»에 탭으로 있다', () => {
  const s = fnSource('chipsHtml');
  assert.match(s, /App\.group === 'members'[\s\S]{0,600}직원탭열기\(\)/,
    '★★ 구성원 소개 딱지 줄에 일반직원 탭이 없습니다');
  assert.match(s, /일반직원 수정/, '탭 이름이 「일반직원 수정」이 아닙니다');
});

test('★★ 다른 갈래(주요업무)로 «넘기지» 않는다 — 탭은 구성원 갈래에 머문다', async () => {
  const { ctx } = 상자({ 이미: true });
  await ctx.직원탭열기();
  assert.equal(ctx.App.group, 'members', '★★ 주요업무로 넘겼습니다');
  assert.equal(ctx.App.filter, 'staff');
  assert.equal(ctx.App.pick, 'people');
});

test('★ people 은 주요업무 목록에서 빠진다 — 탭이 맡는다', () => {
  const s = fnSource('pageIdsOf');
  assert.match(s, /!== 직원쪽/, '★ 주요업무 목록이 people 을 아직 세웁니다 — 두 곳에 나옵니다');
});

test('★ 탭을 누르면 «묻지 않고» 자리가 열린다 — 목록에 없으면 조용히 넣는다', async () => {
  const { ctx, 한것 } = 상자({ 이미: false });
  await ctx.직원탭열기();
  const 담김 = 한것.find(x => x.무엇 === 'save');
  assert.ok(담김, '★ 목록에 안 넣었습니다');
  assert.ok(담김.next.people && 담김.next.work1, '있던 쪽을 지웠거나 people 이 빠졌습니다');
  assert.equal(ctx.말한것.length, 0, '★ 탭인데 물어봤습니다 — 탭은 누르면 열려야 합니다');
  assert.ok(한것.some(x => x.무엇 === '읽기'), '쪽을 저절로 안 읽어옵니다');
});

test('이미 목록에 있으면 다시 저장하지 않는다', async () => {
  const { ctx, 한것 } = 상자({ 이미: true });
  await ctx.직원탭열기();
  assert.ok(!한것.some(x => x.무엇 === 'save'));
  assert.ok(한것.some(x => x.무엇 === 'render'));
});

test('저장 안 한 것이 있고 「버리지 않겠다」면 탭을 안 옮긴다', async () => {
  const { ctx } = 상자({ 이미: true, dirty: true, 버림: false });
  await ctx.직원탭열기();
  assert.equal(ctx.App.group, 'work', '저장 안 한 것을 두고 옮겼습니다');
});

test('저장이 실패하면 «열렸다»고 하지 않는다', async () => {
  const { ctx } = 상자({ 저장탈: '권한이 없습니다' });
  await ctx.직원탭열기();
  assert.ok(ctx.말한것.some(t => /만들지 못했습니다/.test(t)));
  assert.notEqual(ctx.App.filter, 'staff', '실패했는데 탭으로 옮겼습니다');
});

test('탭이 세우는 줄은 구성원 줄과 «같은 칸»을 채운다', () => {
  const { ctx } = 상자({ 이미: true });
  ctx.App.check = { pages: { people: { status: 'noBase' } } };
  const r = ctx.직원줄();
  assert.equal(r.key, 'people');
  assert.ok(r.name && r.desc !== undefined, 'name·desc 가 없어 목록이 그리다 죽습니다');
  assert.equal(r.status, 'noBase');
});

test('★ 구성원 갈래에서 people 을 고르면 «쪽» 초안이 된다', () => {
  const s = fnSource('loadDraft');
  assert.match(s, /App\.group === 'members'[\s\S]{0,400}App\.pick === 직원쪽[\s\S]{0,200}kind: 'page'/,
    '★ 구성원 갈래에서 people 초안을 못 만듭니다 — 편집칸이 빈 채 남습니다');
});

test('★ 걸러 보기가 «staff»면 people 한 줄만 세운다', () => {
  const s = fnSource('visibleRows');
  assert.match(s, /f === 'staff'[\s\S]{0,60}직원줄\(\)/,
    '★ 탭을 눌러도 목록이 구성원 아홉을 그대로 보입니다');
});

test('★ 할 일에서 people 로 가는 단추는 탭을 연다 — 주요업무로 점프하지 않는다', () => {
  const s = fnSource('쪽으로가기');
  assert.match(s, /mid === 직원쪽[\s\S]{0,40}직원탭열기\(\)/);
  assert.match(fnSource('leftoverGoBtns'), /쪽으로가기\(/, '퇴사자 이름 카드가 옛 점프를 씁니다');
});

test('★★ 서버에 정찰이 있으면 화면에도 «문»이 있다', () => {
  const 서버 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'homepage-write.js'), 'utf8');
  assert.match(서버, /function 정찰\(/, '서버에 정찰이 없습니다');
  assert.match(H, /onclick="홈페이지칸살펴보기\(\)"/,
    '★★ 서버에는 정찰이 있는데 화면에 누를 자리가 없습니다 — 있으나 마나입니다');
  assert.match(fnSource('홈페이지칸살펴보기'), /서버에게물어보기\(\s*'정찰'/);
});

test('★★ 「직원은 구성원 목록에 못 들어간다」는 까닭이 코드에 적혀 있다', () => {
  assert.match(html, /직원[\s\S]{0,200}글 번호도[\s\S]{0,60}사진도/,
    '★ 왜 직원이 구성원 목록에 없는지가 안 적혀 있습니다');
});
