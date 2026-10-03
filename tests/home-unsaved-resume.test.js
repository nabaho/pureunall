'use strict';
/* 저장 안 한 고침을 «새로 열려도» 잇는다 — node --test tests/home-unsaved-resume.test.js
 *
 * 2026-10-03 검토 ⑥. 배포가 하루 열다섯 번쯤이고, 그때마다 js/pu-version.js 가 30초 손 놓은
 * 탭을 새로 연다. 홈페이지 관리는 고치던 초안이 메모리에만 있어 통째로 사라졌다.
 *
 * ★ 지키는 것
 *   ① 저장 안 한 초안은 새로 열려도 되살아난다
 *   ② 그 사이 서버가 바뀌었으면 «되살리지 않고» 그렇다고 말한다 — 옛 초안이 남의 고침을 덮는 길을 막는다
 *   ③ 고친 것이 없으면 아무것도 남기지 않는다(지난 것도 지운다)
 *   ④ 이 탭 안에만 둔다(sessionStorage) */
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
const 열쇠줄 = /\nconst 이어쓰기열쇠 = [^\n]*;/.exec(html);

/* 한 탭의 sessionStorage — 두 «부팅»이 같은 것을 나눠 쓴다(새로 열려도 탭은 그대로다) */
function 탭저장소() {
  const m = {};
  return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); },
           removeItem: k => { delete m[k]; }, _m: m };
}
function 부팅(저장소, App) {
  const ctx = { sessionStorage: 저장소, JSON, Date, Object, Number, String,
    window: { addEventListener() {} }, PAGE_LABEL: { work1: '자문서비스' }, App };
  vm.createContext(ctx);
  assert.ok(열쇠줄, 'const 이어쓰기열쇠 를 못 찾았습니다');
  vm.runInContext(열쇠줄[0].replace(/\nconst /, 'var ') + '\n' + fnSource('이어쓰기남기기') + '\n'
    + fnSource('이어쓰기되살리기'), ctx);
  return ctx;
}
const 원본 = () => ({ '190': { name: '홍길동', careers: ['現 가'], updatedAt: 1000 } });
const 고치던 = () => ({ kind: 'member', key: '190', name: '홍길동', careers: ['現 가', '前 새로 친 줄'] });

test('★★ ① 저장 안 한 초안은 «새로 열려도» 되살아난다', () => {
  const 저장소 = 탭저장소();
  부팅(저장소, { group: 'members', filter: '', dirty: true, draft: 고치던(), members: 원본(), pages: {}, pageFix: {} })
    .이어쓰기남기기();
  const 새탭 = { group: 'members', filter: '', dirty: false, draft: null, members: 원본(), pages: {}, pageFix: {} };
  const ctx = 부팅(저장소, 새탭);
  assert.equal(ctx.이어쓰기되살리기(), true, '★★ 새로 열린 뒤 고치던 것을 안 되살렸습니다 — 통째로 다시 쳐야 합니다');
  assert.equal(새탭.dirty, true, '★ 되살렸는데 「저장 안 됨」이 안 켜졌습니다 — 저장 안 하고 떠나게 됩니다');
  assert.equal(새탭.pick, '190');
  assert.equal(새탭.draft.careers[1], '前 새로 친 줄');
  assert.equal(저장소.getItem('pu-home:unsaved'), null, '★ 되살린 뒤에도 남겨 두면 다음에 또 되살아납니다');
});

test('★★★ ② 그 사이 서버가 바뀌었으면 되살리지 «않는다» — 그리고 그렇다고 말한다', () => {
  const 저장소 = 탭저장소();
  부팅(저장소, { group: 'members', filter: '', dirty: true, draft: 고치던(), members: 원본(), pages: {}, pageFix: {} })
    .이어쓰기남기기();
  const 바뀐서버 = 원본(); 바뀐서버['190'].updatedAt = 2000;   // 다른 곳에서 고쳐 저장했다
  const 새탭 = { group: 'members', filter: '', dirty: false, draft: null, members: 바뀐서버, pages: {}, pageFix: {}, saveErr: '' };
  const ctx = 부팅(저장소, 새탭);
  assert.equal(ctx.이어쓰기되살리기(), false,
    '★★★ 바뀐 서버 위에 옛 초안을 얹었습니다 — 저장하면 남의 고침이 말없이 사라집니다');
  assert.equal(새탭.dirty, false);
  assert.match(새탭.saveErr, /되살리지 않았/, '★★ 고치던 것이 사라졌는데 아무 말이 없습니다');
});

test('★ ③ 고친 것이 없으면 아무것도 안 남긴다 — 지난 것도 지운다', () => {
  const 저장소 = 탭저장소();
  저장소.setItem('pu-home:unsaved', '{"at":1}');
  부팅(저장소, { group: 'members', dirty: false, draft: 고치던(), members: 원본(), pages: {}, pageFix: {} })
    .이어쓰기남기기();
  assert.equal(저장소.getItem('pu-home:unsaved'), null, '★ 저장했는데 지난 초안이 남아 다음에 되살아납니다');
});

test('★ 쪽에서 고친 줄도 새로 열려도 남는다 — 맞지 않는 줄은 쪽을 다시 읽을 때 버린다', () => {
  const 저장소 = 탭저장소();
  부팅(저장소, { group: 'work', dirty: false, draft: null, members: {}, pages: {},
             pageFix: { work1: { '1\u0001옛 글': '새 글' } } }).이어쓰기남기기();
  const 새탭 = { group: 'work', dirty: false, draft: null, members: {}, pages: {}, pageFix: {} };
  부팅(저장소, 새탭).이어쓰기되살리기();
  assert.equal(Object.keys(새탭.pageFix.work1 || {}).length, 1, '★ 쪽에서 고친 줄이 사라졌습니다');
  /* 버리는 일은 keepPageHtml 이 한다 — 그 규칙이 그대로 있는지 본다 */
  assert.match(fnSource('keepPageHtml'), /delete fix\[k\]/, '★ 없는 자리의 고침을 버리는 규칙이 사라졌습니다');
});

test('★ 이 탭 안에만 둔다 — localStorage 로 새지 않는다', () => {
  const s = fnSource('이어쓰기남기기') + fnSource('이어쓰기되살리기');
  assert.ok(s.indexOf('localStorage') < 0, '★ 다른 탭·다음 날까지 남는 곳에 둡니다 — 오래된 초안이 엉뚱하게 되살아납니다');
  assert.match(html, /addEventListener\('pagehide', 이어쓰기남기기\)/, '★★ 떠날 때 남기는 고리가 없습니다');
  assert.match(fnSource('loadAll'), /이어쓰기되살리기\(\)/, '★★ 다 읽은 뒤 되살리는 고리가 없습니다');
});
