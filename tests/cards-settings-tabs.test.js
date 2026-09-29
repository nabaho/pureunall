/* ⚙️ 환경설정 — 왼쪽 메뉴 + 한 줄 목록 (대표 지시 2026-09-29 「좀더 깔끔하게」 → 목업 → 「네」)

   ■ 오간 길 — 네 번째다(여섯 탭 → 한 화면 → 탭 넷 → 왼쪽 메뉴). 까닭은 늘 «같은 것이 여러 번 보이고,
     눈이 훑을 곳을 못 정한다»였다. ★ 목업이 아니라 «써 본 것»이 이긴다.

   ★ 못 박는 것
     ① 메뉴는 정리 · 자료 · 이알피 | 내 설정 · 관리자(대표만). 직원에게는 넷이다.
     ② 할 일은 «정리 한 곳» — 맨 위 🔔 띠는 없다(같은 넷이 두 번 나와 헷갈렸다).
        손볼 것이 있으면 정리로 열리고, 메뉴에 주황 숫자. 없으면 자료로 열린다.
     ③ 정리에는 갈래가 «전부» 온다 — 손볼 것은 목록, 이상 없는 것은 회색 한 줄, 휴지통은 따로.
     ④ 칸은 여전히 «자료»(SET_SECTIONS)다 — 갈 곳 22곳이 하나도 안 빠졌는지 센다.
     ⑤ 하위 화면은 «그것만» 보인다. 모르는 메뉴 이름이 오면 기본 칸으로 되돌린다.

     node --test tests/cards-settings-tabs.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

const SUB_NAMES = ['openDedup', 'openSimilar', 'openMixedFix', 'openNameFix', 'openTrash',
  'openErpNameCheck', 'openClassifyRules', 'openViewManager', 'openMailBlock', 'openCleanupCenter'];

/* 함수 몸통 하나를 떠 온다 */
function fnBody(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 을 못 찾았다');
  let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); }
  }
  return '';
}

/* 화면을 통째로 떠서 «그린다» — 글자만 찾으면 메뉴를 지워도 통과한다 */
function draw(opt) {
  const o = Object.assign({ admin: true, sub: '', tab: 'data', trash: 0, sim: 0 }, opt || {});
  const trash = {};
  for (let i = 0; i < o.trash; i++) trash['t' + i] = {};
  const el = { innerHTML: '' };
  const N = v => ({ length: v });
  const ctx = {
    console,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    $: id => (id === 'pcSettings' ? el : { innerHTML: '' }),
    render: () => { },
    state: {
      view: 'settings', tab: 'card', setSub: o.sub, setTab: o.tab, isAdmin: o.admin,
      items: { a: { kind: 'card' }, b: { kind: 'biz' } },
      views: {}, groups: {}, mailBlock: {}, trash: trash, privOpen: false
    },
    Store: { mode: 'firebase' },
    aiReady: () => true,
    findDupGroups: () => N(0), findSimilarGroups: () => N(o.sim),
    emptyTargets: () => N(0), mojibakeTargets: () => N(0),
    mixedFixList: () => N(0), nameFixList: () => N(0),
    trashCount: () => Object.keys(trash).length,
    bizFillCount: () => 0,
    classifyPlan: () => ({ targetN: 0 })
  };
  SUB_NAMES.forEach(n => {
    ctx[n] = () => { ctx._called = n; ctx._targetWhenCalled = ctx._panelTarget; };
  });
  vm.createContext(ctx);
  const a = SRC.indexOf('let _todoMemo = null;');
  const b = SRC.indexOf('function _syncSearchX(){');
  assert.ok(a > 0 && b > a, '알맹이를 못 찾았다');
  /* ⚠ 최상위 let/const 는 컨텍스트 값이 되지 않는다 — var 로 바꿔 실어야 꺼내 본다 */
  vm.runInContext(SRC.slice(a, b).replace(/\nlet /g, '\nvar ').replace(/\nconst /g, '\nvar '), ctx);
  ctx._panelTarget = 'modal';
  ctx.setSub = s => { ctx.state.setSub = s || ''; ctx.renderSettingsPage(); };
  ctx.renderSettingsPage();
  ctx.html = el.innerHTML;
  return ctx;
}
/* 화면에 보이는 줄 이름들 */
const labels = h => (h.match(/<span class="sl">([^<]*)<\/span>/g) || []).map(s => s.replace(/<[^>]*>/g, '').trim());

/* ── ① 메뉴 ── */

test('★★ 메뉴는 «정리 · 자료 · 이알피 | 내 설정 · 관리자» — 직원에게는 넷', () => {
  const c = draw();
  assert.equal(c.SET_TABS.map(t => t.k).join(','), 'clean,data,erp,me,admin');
  c.SET_TABS.forEach(t => {
    assert.ok(t.label && t.label.length <= 12, '★ 메뉴 이름이 길다: ' + t.label);
    assert.ok(t.hint && t.hint.length <= 24, '★ 메뉴 말풍선이 없거나 길다: ' + t.k);
  });
  assert.equal((c.html.match(/class="setnavbtn(?: on)?"/g) || []).length, 5, '★ 대표 메뉴가 다섯이 아니다');
  const 직원 = draw({ admin: false });
  assert.equal((직원.html.match(/class="setnavbtn(?: on)?"/g) || []).length, 4, '★ 직원에게 관리자 메뉴가 보인다');
  assert.ok(직원.html.indexOf("setSetTab('admin')") < 0);
  assert.match(c.html, /class="setnavbtn on"/, '★ 켜진 메뉴가 없다 — 어디에 있는지 모른다');
});

test('★★★ 맨 위 🔔 띠는 «없다» — 할 일은 정리 한 곳이다 (대표 2026-09-29)', () => {
  const c = draw({ trash: 41, sim: 105 });
  assert.ok(c.html.indexOf('지금 손볼 것') < 0 && c.html.indexOf('todorail') < 0, '★ 띠가 되살아났다 — 같은 할 일이 두 번 나온다');
  assert.ok(c.html.indexOf('class="setstat"') < 0, '★ 숫자 알약 줄이 되살아났다 — 제목 옆 한 줄이면 된다');
  assert.match(c.html, /class="setst">명함 1 · 사업자 1/, '★ 제목 옆 숫자 한 줄이 없다');
});

test('★★★ 손볼 것이 있으면 «정리»로 열리고, 없으면 «자료»로 열린다', () => {
  const 밀림 = draw({ tab: '', sim: 3 });
  assert.match(밀림.html, /class="setnavbtn on"[^>]*>🧹 정리/, '★ 손볼 것이 있는데 정리로 안 열렸다');
  const 없음 = draw({ tab: '' });
  assert.match(없음.html, /class="setnavbtn on"[^>]*>📦 자료/, '★ 손볼 것이 없는데 자료로 안 열렸다');
  assert.match(fnBody('openSettingsPage'), /state\.setTab=''/, '★ 열 때마다 기본 칸을 다시 골라야 한다');
});

test('★★ 정리 메뉴에 «주황 숫자» — 0 이면 안 붙는다', () => {
  const c = draw({ tab: 'data', sim: 105, trash: 41 });
  assert.match(c.html, /🧹 정리<span class="setnavn">2<\/span>/, '★ 밀린 수가 메뉴에 안 보인다');
  assert.ok(draw({ tab: 'data' }).html.indexOf('setnavn') < 0, '★ 할 일이 없는데 숫자가 붙었다');
});

/* ── ② 정리 ── */

test('★★★ 「정리」에 갈래가 «전부» 온다 — 손볼 것은 목록, 이상 없는 것은 회색 한 줄, 휴지통은 따로', () => {
  const c = draw({ tab: 'clean', sim: 105, trash: 41 });
  const h = c.html;
  c.todoAll().forEach(r => assert.ok(h.indexOf(r.label) > 0, '★ 「' + r.label + '」 이 정리에 없다'));
  assert.match(h, /<span class="sl">유사 후보<\/span><span class="sv todo">105묶음<\/span>/, '★ 손볼 것이 주황 숫자로 안 보인다');
  assert.match(h, /<span class="sl">휴지통<\/span><span class="sv">41건<\/span>/, '★ 휴지통 줄이 없다');
  assert.match(h, /class="setok"><b>✓<\/b>[^<]*확실한 중복[^<]*— 이상 없음/, '★ 이상 없는 것이 한 줄로 안 모였다');
  assert.ok(!/<span class="sl">확실한 중복/.test(h), '★ 이상 없는 것까지 목록 줄로 깔렸다 — 할 일이 묻힌다');
  const 빈 = draw({ tab: 'clean' }).html;
  assert.match(빈, /지금 손볼 것이 없습니다/, '★ 할 일이 없을 때 아무 말이 없다 — 고장인지 모른다');
});

test('★★ 정리의 줄은 «데려가기만» 한다 — 지우는 일을 여기서 바로 실행하지 않는다', () => {
  const h = draw({ tab: 'clean', sim: 3, trash: 2 }).html;
  assert.match(h, /onclick="todoGo\('similar'\)"/);
  assert.match(h, /onclick="todoGo\('trash'\)"/);
  assert.ok(!/cleanEmpty\(|openMojibakeCleanup\(/.test(h), '★ 정리 줄에서 바로 지운다');
});

/* ── ③ 칸 ── */

test('★★ 칸마다 «어느 메뉴»인지 적혀 있고, 그 메뉴에서만 나온다', () => {
  const c = draw();
  c.SET_SECTIONS().forEach(s => assert.ok(['data', 'erp', 'me', 'admin'].indexOf(s.tab) >= 0,
    '★ 「' + s.t + '」 칸에 메뉴가 없거나 모르는 메뉴다: ' + s.tab));
  const data = labels(draw({ tab: 'data' }).html);
  ['지금 백업', '엑셀로 내보내기', '파일 가져오기', '자료함'].forEach(n => assert.ok(data.indexOf(n) >= 0, '★ 자료에 「' + n + '」 가 없다'));
  assert.ok(data.indexOf('대표자·담당자 대조') < 0, '★ 자료에 이알피 줄이 섞였다');
  const erp = labels(draw({ tab: 'erp' }).html);
  assert.ok(erp.indexOf('대표자·담당자 대조') >= 0 && erp.indexOf('지금 백업') < 0);
  const me = labels(draw({ tab: 'me' }).html);
  ['내 탭 관리', '메일 수신거부', 'AI 자동인식', '로그아웃'].forEach(n => assert.ok(me.indexOf(n) >= 0, '★ 내 설정에 「' + n + '」 가 없다'));
  const admin = labels(draw({ tab: 'admin' }).html);
  ['반출 기록', '명함 그림 빼기', '전체 비우기 (명함)'].forEach(n => assert.ok(admin.indexOf(n) >= 0, '★ 관리자에 「' + n + '」 가 없다'));
});

test('★★★ 갈 수 있는 곳이 «한 곳도» 안 빠졌다 — 메뉴로 나누다 흘리기 쉽다', () => {
  const c = draw();
  const 전부 = c.SET_SECTIONS().map(s => s.rows.map(r => r.fn)).reduce((a, b) => a.concat(b), []);
  const 메뉴에서 = ['data', 'erp', 'me', 'admin'].map(k => draw({ tab: k }).html).join('');
  전부.forEach(fn => assert.ok(메뉴에서.indexOf(fn) > 0, '★ 「' + fn + '」 이 어느 메뉴에도 안 나온다 — 영영 못 찾는다'));
  assert.equal(전부.length, 22, '★ 갈 수 있는 곳이 ' + 전부.length + '개다 (22개여야 한다)');
});

test('★★ 줄은 «이름 ····· 값 ›» 한 줄 — 설명은 화면에 안 깔고 title 로만', () => {
  const h = draw({ tab: 'me' }).html;
  assert.match(h, /<span class="sl">내 탭 관리<\/span><span class="sv">0개<\/span><span class="sc">›<\/span>/);
  const d = draw({ tab: 'data' }).html;
  assert.match(d, /title="리멤버 · 구글 · vCard"/, '★ 설명이 title 에 없다');
  assert.ok(d.indexOf('class="sdesc"') < 0, '★ 설명이 화면에 깔렸다');
});

/* ── ④ 메뉴 누르기 · 하위 화면 ── */

test('★★ 메뉴를 누르면 그 칸이 켜지고, 다시 그리고, 하위 화면은 «풀린다»', () => {
  const c = draw({ tab: 'data', sub: '' });
  /* ⚠ 「값이 바뀌었나」만 보면 안 된다 — 다시 그리지 않으면 화면은 그대로다 */
  const 전 = c.html;
  c.setSetTab('erp');
  assert.equal(c.state.setTab, 'erp');
  assert.equal(c.state.setSub, '', '★ 메뉴를 옮겼는데 하위 화면이 남아 있다');
  const 후 = c.$('pcSettings').innerHTML;
  assert.notEqual(후, 전, '★ 메뉴를 옮겼는데 다시 안 그린다 — 화면이 그대로다');
  assert.ok(후.indexOf('대표자·담당자 대조') > 0, '★ 옮긴 메뉴의 내용이 안 나온다');
  const d = draw({ sub: 'views' });
  d.setSetTab('clean');
  assert.equal(d.state.setSub, '', '★ 하위 화면에서 메뉴를 눌렀는데 안 풀린다');
});

test('★★ 모르는 메뉴 이름이 오면 «기본 칸»으로 — 빈 화면이 되면 앱이 멈춘 줄 안다', () => {
  const c = draw({ tab: '없는탭' });
  assert.ok(c.html.indexOf('지금 백업') > 0, '★ 빈 화면이 됐다');
  assert.match(c.html, /class="setnavbtn on"/, '★ 켜진 메뉴가 없다');
  /* 직원이 관리자 이름을 들고 와도 기본 칸으로 — 관리자 칸을 그리지 않는다 */
  const 직원 = draw({ tab: 'admin', admin: false });
  assert.ok(직원.html.indexOf('wipeAll()') < 0 && 직원.html.indexOf('지금 백업') > 0, '★ 직원에게 관리자 칸이 그려졌다');
});

test('★★ 하위 화면은 «그것만» 보인다 — 목록 밑에 딸려 붙으면 어디 펼쳐졌는지 못 찾는다', () => {
  const c = draw({ sub: 'similar' });
  assert.equal(c._called, 'openSimilar', '★ 엉뚱한 화면을 열었다: ' + c._called);
  assert.ok(c.html.indexOf('class="setnav"') < 0, '★ 메뉴가 그대로 딸려 나왔다');
  assert.ok(c.html.indexOf('class="setlist') < 0, '★ 목록이 그대로 딸려 나왔다');
  assert.ok(c.html.indexOf('setInline') > 0, '★ 하위 화면을 담을 자리가 없다');
});

test('★★ 하위 화면은 «인라인»이고, 터져도 _panelTarget 은 되돌아온다', () => {
  const c = draw({ sub: 'views' });
  assert.equal(c._targetWhenCalled, 'inline', '★ 팝업으로 열렸다');
  assert.equal(c._panelTarget, 'modal', '★ 열고 나서 되돌려 놓지 않았다');
  let 터짐 = 0;
  c.openDedup = () => { 터짐++; throw new Error('일부러 터뜨림'); };
  c.state.setSub = 'dedup';
  c.renderSettingsPage();
  assert.equal(터짐, 1, '★ 터뜨릴 화면을 부르지도 않았다 — 검사가 헛돈 것이다');
  assert.equal(c._panelTarget, 'modal', '★ inline 인 채로 굳었다 — 이후 팝업이 다 안 뜬다');
});

test('★★ 열 갈래가 «다» 열린다 — 하나만 빠져도 그 화면은 영영 못 연다', () => {
  const keys = ['dedup', 'similar', 'mixed', 'namefix', 'trash',
    'erpname', 'rules', 'views', 'mailblock', 'clean'];
  const got = keys.map(k => draw({ sub: k })._called);
  got.forEach((v, i) => assert.ok(SUB_NAMES.indexOf(v) >= 0, '★ 「' + keys[i] + '」 을 열 수 없다'));
  assert.equal(new Set(got).size, keys.length, '★ 두 열쇠가 같은 화면을 연다: ' + got.join(','));
});

/* ── ⑤ 관리자 ── */

test('★★ 대표가 아니면 관리자 칸이 «통째로» 사라진다 — 전체 비우기도 대표만', () => {
  const 전부 = ['data', 'erp', 'me', 'admin'].map(k => draw({ tab: k, admin: false }).html).join('');
  ['migrateInlineThumbs()', 'openExportLog()', 'openPrivateVault()', 'wipeAll()'].forEach(fn =>
    assert.ok(전부.indexOf(fn) < 0, '★ 직원에게 ' + fn + ' 가 보인다'));
  assert.ok(전부.indexOf('undefined') < 0 && 전부.indexOf('null') < 0, '★ 빠진 줄이 화면에 글자로 새어 나왔다');
});
