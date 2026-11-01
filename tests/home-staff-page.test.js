/* 「직원」 탭 — 대표 승인 2026-11-01 직원 소개 1단계
   (앞선 지시: 2026-09-14 「구성원소개에 일반직원 수정으로 두고 탭변경으로 해라」 · 2026-10-24 「노무사 / 직원」)

   ★ 무엇이 바뀌었나 — 전에는 이 탭이 옛 홈페이지 people «쪽 글자»를 고쳤다. 직원 이름은 그 쪽이 아니라
     제작사 레이아웃에 박혀 있어 실제로 바뀌는 것이 없었다(대표 결정 ① 「탭을 바꾼다」).
     이제 직원도 한 사람씩 우리 자료(구분 = 직원)로 고치고, 새 사이트의 직원 줄을 다시 찍어 낸다.
   ★ 여기서 지키는 것
     ① 탭은 구성원 소개 «목록 머리»에 있고, 누르면 묻지 않고 열린다 — 다른 갈래로 넘기지 않는다.
     ② 직원 탭 목록은 직원 자료만, 딱지 두 칸은 «열을 맞춘다»(대표 지시 2026-11-01).
     ③ 처음 가져오기는 이름이 같아도 «저절로 잇지 않는다» — 사람이 「이 사람 맞음」을 눌러야 sid 가 들어간다.
     ④ 직원 편집칸에는 글 번호·사진·경력이 없다(2단계). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'pu-home.html'), 'utf8').replace(/\r\n/g, '\n');
const H = html.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const 부품글 = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-site-people.js'), 'utf8');
const 쪽 = fs.readFileSync(path.join(__dirname, '..', 'site', 'people', 'index.html'), 'utf8').replace(/\r\n/g, '\n');

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
const 주석뺀 = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 쪽에서 읽은 직원 — 이름·직급을 박지 않으려고 쪽에서 읽어 쓴다 */
const 쪽직원 = (() => {
  const c = {}; vm.createContext(c); vm.runInContext(부품글, c);
  return c.PuSitePeople.직원읽기(쪽);
})();

/* 진짜 부품(PuSitePeople)을 싣고, 화면 함수를 떼어 돌린다. 이름은 지어낸 것. */
function 상자(옵) {
  const o = Object.assign({ members: {}, staff: [], sitePeople: null, 버림: true }, 옵 || {});
  const 한것 = [];
  const ctx = {
    console: { warn() {}, log() {} },
    esc: (s) => String(s == null ? '' : s),
    App: { group: 'work', filter: '', pick: 'work1', members: o.members, staff: o.staff,
           sitePeople: o.sitePeople, previewReading: false, render() { 한것.push('render'); } },
    loadDraft() { 한것.push('loadDraft'); },
    readPeoplePage() { 한것.push('읽기'); return Promise.resolve(); },
    leaveDraft() { return Promise.resolve(o.버림); },
    offSiteOf: (r) => !!(r || {}).offSite,
    새홈페이지에갈사람: (r) => !(r || {}).퇴사,
    직급의갈래: (t) => (/노무사/.test(String(t || '')) ? 'labor' : 'staff'),
    고름이름표: (s) => String((s && s.name) || ''),
    modalHead: (t) => '<h2>' + t + '</h2>', modalFoot: () => '',
    열린창: '', openModal(h) { ctx.열린창 = h; }, closeModal() {},
    저장한것: [],
    saveRecord(kind, key, rec) { ctx.저장한것.push({ kind, key, rec: JSON.parse(JSON.stringify(rec)) }); return Promise.resolve(rec); },
    say() { return Promise.resolve(); }, toast() {}
  };
  vm.createContext(ctx);
  vm.runInContext(부품글, ctx);
  vm.runInContext(['직원명부딱지', '직원사이트딱지', '직원행들', '명부에만있는직원수', '직원목록Html',
    '직원탭열기', '직원가져오기열기', '직원가져오기그리기', '직원가져오기넣기'].map(n => fnSource(n)).join('\n'), ctx);
  return { ctx, 한것 };
}

test('검사 준비 — 본 쪽에 직원이 둘 이상 있다', () => {
  assert.ok(쪽직원.length >= 2, '본 쪽에 직원이 모자랍니다');
});

/* ⚠ 탭 이름·숫자는 박지 않는다 — «직원으로 읽히는 이름의 탭이 목록 머리에 있나»를 본다 */
test('★★ 직원 탭은 구성원 소개 «목록 머리»에 탭으로 있다', () => {
  const s = 주석뺀(fnSource('listCountHtml'));
  assert.match(s, /App\.group === 'members'[\s\S]{0,3000}onclick="직원탭열기\(\)"/,
    '★★ 구성원 소개 목록 머리에 직원 탭이 없습니다');
  assert.match(s, /onclick="직원탭열기\(\)"[\s\S]{0,200}>직원/, '탭 이름에 «직원»이 안 보입니다');
  assert.match(s, /onclick="App\.filt\(\\'\\'\)"/, '★ 노무사로 돌아오는 탭이 없습니다');
  assert.ok(주석뺀(fnSource('chipsHtml')).indexOf('직원탭열기') < 0,
    '★ 딱지 줄에도 탭이 또 있습니다 — 두 곳이 되면 딱지 줄이 다시 두 줄로 넘칩니다');
});

test('★★ 탭은 구성원 갈래에 머물고, 첫 직원을 고른다 — 묻지도, 무엇을 저장하지도 않는다', async () => {
  const { ctx, 한것 } = 상자({ members: {
    b: { kind: 'staff', name: '이샘플', order: 2 }, a: { kind: 'staff', name: '김예시', order: 1 },
    x: { kind: 'labor', name: '정모형' } } });
  await ctx.직원탭열기();
  assert.equal(ctx.App.group, 'members', '★★ 다른 갈래로 넘겼습니다');
  assert.equal(ctx.App.filter, 'staff');
  assert.equal(ctx.App.pick, 'a', '차례가 첫째인 직원을 고르지 않았습니다');
  assert.ok(한것.includes('읽기'), '「올라감」을 견줄 새 사이트 쪽을 저절로 안 읽습니다');
  assert.equal(ctx.저장한것.length, 0, '탭을 여는 것만으로 무엇을 저장했습니다');
});

test('저장 안 한 것이 있고 「버리지 않겠다」면 탭을 안 옮긴다', async () => {
  const { ctx } = 상자({ 버림: false });
  await ctx.직원탭열기();
  assert.equal(ctx.App.group, 'work');
});

test('★ people 은 주요업무 목록에서 빠진다 — 탭이 맡는다', () => {
  assert.match(fnSource('pageIdsOf'), /!== 직원쪽/, '★ 주요업무 목록이 people 을 아직 세웁니다');
});

test('★ 할 일에서 people 로 가는 단추는 탭을 연다 — 주요업무로 점프하지 않는다', () => {
  assert.match(fnSource('쪽으로가기'), /mid === 직원쪽[\s\S]{0,40}직원탭열기\(\)/);
  assert.match(fnSource('leftoverGoBtns'), /쪽으로가기\(/, '퇴사자 이름 카드가 옛 점프를 씁니다');
});

test('★ 걸러 보기가 «staff»면 직원 줄을 세우고, 목록은 직원목록Html 이 그린다', () => {
  assert.match(주석뺀(fnSource('visibleRows')), /f === 'staff'[\s\S]{0,40}직원행들\(\)/);
  assert.match(주석뺀(fnSource('rowsHtml')), /App\.filter === 'staff'[\s\S]{0,40}직원목록Html\(\)/);
});

test('★ 직원 탭 줄 — 직원만, 차례대로, 퇴사·안 올림·올라감·안 올린 고침을 가른다', () => {
  /* 「올라감」을 보려면 쪽 글자와 같은 이름이 있어야 한다 — 쪽의 첫 직원을 «그대로» 빌려 쓴다 */
  const { ctx } = 상자({ sitePeople: 쪽, staff: [{ sid: 'T1', name: '아무개' }], members: {
    a: { kind: 'staff', name: 쪽직원[0].이름, position1: 쪽직원[0].직급, order: 1, sid: 'T1' },
    b: { kind: 'staff', name: '이샘플', position1: '새직급', order: 2 },
    c: { kind: 'staff', name: '박보기', position1: '과장', order: 3, 퇴사: true },
    d: { kind: 'staff', name: '최가상', position1: '주임', order: 4, offSite: true },
    e: { name: '정모형', position2: '공인노무사' } } });
  const 줄 = ctx.직원행들();
  assert.deepEqual(JSON.parse(JSON.stringify(줄.map(r => r.key))), ['a', 'b', 'c', 'd'], '노무사가 섞였거나 차례가 틀렸습니다');
  assert.equal(줄[0].사이트.label, '올라감');
  assert.equal(줄[0].명부.label, '명부 연결');
  assert.notEqual(줄[1].사이트.label, '올라감', '★ 고친 직급이 아직 안 올라갔는데 「올라감」이라 합니다');
  assert.equal(줄[1].명부.label, '명부 안 이음');
  assert.match(줄[2].사이트.label, /퇴사/);
  assert.equal(줄[3].사이트.label, '안 올림');
});

test('★★ 딱지 두 칸은 «열을 맞춘다» — 칸마다 폭이 못 박혀 있고, 노무사 목록도 같은 칸을 쓴다', () => {
  const css = html.slice(0, html.indexOf('</style>'));
  assert.match(css, /\.tags \.tc\{[^}]*width:\d+px/, '★★ 딱지 칸 폭이 정해져 있지 않아 줄마다 시작이 어긋납니다');
  assert.match(주석뺀(fnSource('직원목록Html')), /<span class="tc">'[\s\S]{0,40}<\/span><span class="tc">/);
  assert.match(주석뺀(fnSource('rowsHtml')), /<span class="tags"><span class="tc">/,
    '★ 노무사 목록의 딱지는 아직 열을 안 맞춥니다 — 「항상」입니다');
});

test('★ 직원 자료가 없으면 「새 사이트 직원 가져오기」를 내민다', () => {
  const { ctx } = 상자();
  assert.match(ctx.직원목록Html(), /직원가져오기열기\(\)/);
});

test('명부에는 재직 직원인데 이어진 사람이 없으면 «알림 줄만» 띄운다 — 저절로 넣지 않는다', () => {
  const { ctx } = 상자({
    staff: [{ sid: 'T1', name: '김예시', title: '사무장' }, { sid: 'T2', name: '한보기', title: '대리' },
            { sid: 'T3', name: '서샘플', title: '주임', left: true }, { sid: 'L1', name: '정모형', title: '공인노무사' }],
    members: { a: { kind: 'staff', name: '김예시', sid: 'T1', order: 1 } } });
  assert.equal(ctx.명부에만있는직원수(), 1, '퇴사자·노무사·이미 이은 사람까지 셌습니다');
  assert.match(ctx.직원목록Html(), /1명 있습니다[\s\S]*openRosterAdd\(\)/);
  assert.equal(ctx.저장한것.length, 0);
});

test('★★ 처음 가져오기 — 이름이 한 사람과 맞아도 «이 사람 맞음»은 꺼진 채 시작하고, 안 누르면 sid 를 안 넣는다', async () => {
  /* 명부에 쪽의 첫 직원과 «같은 이름» 한 사람을 둔다 — 이름으로 짐작해 잇는지 본다 */
  const { ctx } = 상자({ sitePeople: 쪽, staff: [{ sid: 'T9', name: 쪽직원[0].이름, title: 쪽직원[0].직급 }] });
  ctx.직원가져오기열기();
  assert.equal(ctx.App.가져오기.length, 쪽직원.length, '새 사이트의 직원을 다 못 읽었습니다');
  assert.equal(ctx.App.가져오기[0].맞음, false, '★★ 이름만 같은데 「맞음」이 켜진 채 시작합니다 — 이름으로 잇는 것입니다');
  assert.match(ctx.열린창, /이 사람 맞음/);
  await ctx.직원가져오기넣기();
  assert.equal(ctx.저장한것.length, 쪽직원.length);
  assert.ok(ctx.저장한것.every(x => x.rec.kind === 'staff'), '구분을 «직원»으로 안 적었습니다 — 노무사 카드로 갑니다');
  assert.ok(ctx.저장한것.every(x => !('sid' in x.rec)), '★★ 사람이 확인하지 않았는데 sid 를 넣었습니다');
  assert.deepEqual(ctx.저장한것.map(x => x.rec.position1), JSON.parse(JSON.stringify(쪽직원.map(s => s.직급))),
    '★ 새 사이트 글자(직급)를 그대로 안 넣었습니다 — 넣는 것만으로 사이트가 바뀝니다');
  assert.deepEqual(ctx.저장한것.map(x => x.rec.order), JSON.parse(JSON.stringify(쪽직원.map((_, i) => i + 1))), '쪽 순서대로 차례를 안 매겼습니다');
});

test('★ 「이 사람 맞음」을 누른 줄만 sid 가 들어간다', async () => {
  const { ctx } = 상자({ sitePeople: 쪽, staff: [{ sid: 'T9', name: 쪽직원[0].이름 }] });
  ctx.직원가져오기열기();
  ctx.App.가져오기[0].맞음 = true;
  await ctx.직원가져오기넣기();
  assert.equal(ctx.저장한것[0].rec.sid, 'T9');
  assert.ok(ctx.저장한것.slice(1).every(x => !('sid' in x.rec)));
});

test('★ 이미 목록에 있는 직원은 가져오기에서 또 넣지 않는다', () => {
  const { ctx } = 상자({ sitePeople: 쪽, members: { a: { kind: 'staff', name: 쪽직원[0].이름, order: 1 } } });
  ctx.직원가져오기열기();
  assert.equal(ctx.App.가져오기[0].넣기, false);
  assert.equal(ctx.App.가져오기[0].이미, true);
});

test('★ 직원 편집칸에는 글 번호·사진·경력 칸이 없다 — 2단계(본인 동의 뒤)다', () => {
  const s = 주석뺀(fnSource('직원편집'));
  assert.doesNotMatch(s, /fieldEdit\(\\'srl\\'/, '직원 편집칸에 글 번호 칸이 있습니다');
  assert.doesNotMatch(s, /사진칸Html|careerEdit|openPull/, '직원 편집칸에 사진·경력이 들어왔습니다');
  assert.match(s, /fieldEdit\(\\'position1\\'/, '직급을 고칠 칸이 없습니다');
  assert.match(s, /직원연결칸Html\(d\)/, '명부와 잇는 줄이 없습니다 — 퇴사 때 저절로 빠지지 않습니다');
  assert.match(주석뺀(fnSource('memberEdit')), /mkind === 'staff'[\s\S]{0,80}직원편집\(d\)/);
});

test('★ 직원 차례는 저장 때 지워지지 않는다(저장은 통째로 쓴다)', () => {
  assert.match(주석뺀(fnSource('saveDraft')), /d\.mkind === 'staff'[\s\S]{0,300}next\.order/,
    '★ 저장이 차례를 빠뜨려 순서가 사라집니다');
});

test('★★ 서버에 정찰이 있으면 화면에도 «문»이 있다', () => {
  const 서버 = fs.readFileSync(path.join(__dirname, '..', 'functions', 'homepage-write.js'), 'utf8');
  assert.match(서버, /function 정찰\(/, '서버에 정찰이 없습니다');
  assert.match(H, /onclick="홈페이지칸살펴보기\(\)"/,
    '★★ 서버에는 정찰이 있는데 화면에 누를 자리가 없습니다 — 있으나 마나입니다');
  assert.match(fnSource('홈페이지칸살펴보기'), /서버에게물어보기\(\s*'정찰'/);
});
