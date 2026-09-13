/* 직원(사무장·사무직)을 «어디서» 고치나 — 대표 지시 2026-09-13
   「일반직원도 변경하고 싶은데 도대체 어디서 변경해야 될지 모르겠다」.

   ★ 홈페이지가 둘을 다르게 만들어 놓았다(실측):
       노무사 = 게시판 «글»(글 번호·사진·덧창 있음)
       직원   = 쪽 본문에 박힌 «글자»(아무것도 없음)
     구성원 목록은 «글»만 본다. 그래서 직원은 거기 나올 수가 없다.
   이 검사가 지키는 것: 그 사실과 «가는 길»이 사람이 찾는 자리에 있는가. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8');
/* 주석을 걷는다 — 잘 쓴 주석이 검사를 통과시키면 아무것도 안 지킨다 */
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
  const o = Object.assign({ 예: true, 이미: false, 못읽음: false, 저장탈: null }, 옵 || {});
  const 한것 = [];
  const cfg = o.이미 ? { people: { label: '직원 이름·직급', order: 9 },
                        work1: { label: '자문서비스', order: 1 } }
                     : { work1: { label: '자문서비스', order: 1 } };
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    App: { pageConfig: cfg, group: 'members', pick: null, render() {} },
    loadDraft() { 한것.push({ 무엇: 'loadDraft' }); },
    refuseIfPageConfigUnread() { return o.못읽음; },
    savePageConfig(next) {
      한것.push({ 무엇: 'save', next: JSON.parse(JSON.stringify(next)) });
      return o.저장탈 ? Promise.reject(new Error(o.저장탈)) : Promise.resolve();
    },
    말한것: [],
    say(t) { ctx.말한것.push(String(t)); return Promise.resolve(); },
    askYes(t) { ctx.말한것.push(String(t)); return Promise.resolve(o.예); }
  };
  vm.createContext(ctx);
  vm.runInContext([constLine('직원쪽'), constLine('직원쪽이름'),
    fnSource('직원쪽있나'), fnSource('직원쪽만들기')].join('\n'), ctx);
  return { ctx, 한것 };
}

test('★★ 「직원은 어디서?」 문이 구성원 목록 머리에 있다', () => {
  /* 사람이 직원을 찾는 자리가 바로 여기다. 안내문 속 작은 글씨면 못 찾는다. */
  const s = fnSource('listHtml');
  assert.match(s, /onclick="직원쪽만들기\(\)"/,
    '★★ 구성원 목록에 직원으로 가는 문이 없습니다');
  assert.match(s, /App\.group === 'members'[\s\S]{0,400}직원쪽만들기/,
    '★★ 그 문이 «구성원 소개» 화면에 안 붙어 있습니다');
});

test('★ 아직 없으면 «물어보고» 만든다 — 묻기 전에 저장하지 않는다', async () => {
  const { ctx, 한것 } = 상자({ 예: false });
  await ctx.직원쪽만들기();
  assert.deepEqual(한것, [], '★ 묻기도 전에 자료를 고쳤습니다');
});

test('★ 「예」 하면 목록에 people 을 넣는다 — 이름을 사람이 치게 하지 않는다', async () => {
  const { ctx, 한것 } = 상자({ 예: true });
  await ctx.직원쪽만들기();
  const 담김 = 한것.find(x => x.무엇 === 'save');
  assert.ok(담김, '★ 저장하지 않았습니다');
  assert.ok(담김.next.people, '★ people 이 목록에 안 들어갔습니다');
  assert.equal(담김.next.people.label, '직원 이름·직급');
  assert.ok(담김.next.work1, '★ 있던 쪽을 지웠습니다');
  assert.equal(담김.next.people.order, 2, '차례가 끝에 안 붙었습니다');
});

test('★ 이미 있으면 다시 만들지 않고 «그 쪽으로 간다»', async () => {
  const { ctx, 한것 } = 상자({ 이미: true });
  await ctx.직원쪽만들기();
  assert.ok(!한것.some(x => x.무엇 === 'save'), '★ 이미 있는데 또 저장했습니다');
  assert.equal(ctx.App.pick, 'people', '그 쪽으로 안 갔습니다');
  assert.ok(한것.some(x => x.무엇 === 'loadDraft'));
});

test('쪽 목록을 «못 읽은» 채로는 아무것도 안 한다', async () => {
  const { ctx, 한것 } = 상자({ 못읽음: true });
  await ctx.직원쪽만들기();
  assert.deepEqual(한것, [], '목록을 모르는 채로 자료를 고쳤습니다');
});

test('저장이 실패하면 «됐다»고 하지 않는다', async () => {
  const { ctx } = 상자({ 저장탈: '권한이 없습니다' });
  await ctx.직원쪽만들기();
  assert.ok(ctx.말한것.some(t => /만들지 못했습니다/.test(t)),
    '저장이 실패했는데 성공이라고 했습니다');
  assert.ok(!ctx.말한것.some(t => /^자리를 만들었습니다/.test(t)));
});

test('★ 단추 이름이 «있을 때»와 «없을 때» 다르다', () => {
  const s = fnSource('listHtml');
  assert.match(s, /직원쪽있나\(\)\s*\?/,
    '★ 이미 만들어 둔 뒤에도 「직원은 어디서?」라고 물으면 매번 새로 만드는 줄 압니다');
});

/* ★ 2026-09-13 — 이 단추를 한 번 «잃었다». 앞선 갈래를 되돌리며 화면 파일을
     통째로 checkout 했는데, 서버 쪽(정찰)만 남고 문이 사라졌다.
     그래서 「서버에 있는데 화면에 문이 없다」를 기계가 잡게 한다. */
test('★★ 서버에 정찰이 있으면 화면에도 «문»이 있다', () => {
  const 서버 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'homepage-write.js'), 'utf8');
  assert.match(서버, /\n\s*정찰[,:]|function 정찰\(/, '서버에 정찰이 없습니다');
  assert.match(H, /onclick="홈페이지칸살펴보기\(\)"/,
    '★★ 서버에는 정찰이 있는데 화면에 누를 자리가 없습니다 — 있으나 마나입니다');
  const s = fnSource('홈페이지칸살펴보기');
  assert.match(s, /서버에게물어보기\(\s*'정찰'/, '정찰로 안 부릅니다');
});

test('★★ 「직원은 구성원 목록에 못 들어간다」는 까닭이 코드에 적혀 있다', () => {
  /* 다음 사람이 「왜 직원만 빠졌지」 하고 구성원 목록에 억지로 넣으려 든다 */
  assert.match(html, /직원[\s\S]{0,200}글 번호도[\s\S]{0,60}사진도/,
    '★ 왜 직원이 구성원 목록에 없는지가 안 적혀 있습니다');
});
