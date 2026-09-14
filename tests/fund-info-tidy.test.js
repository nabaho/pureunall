'use strict';
/* 기금 정보 화면 «정리» (대표 지시 2026-09-13)
 *
 *   「너무 정신 없는데 좀 깔끔하게 정리할 수 없을까 저장버튼도 상단에 두고 전체적으로 한번
 *    정리 했으면 좋겠다. 너무 복잡하다. 캡쳐4 새기금등록시 주담당과 부담당 둘을 뒀으면 좋겠다.」
 *
 * ★ 칸이 스물다섯이라 저장하려면 화면 끝까지 내려가야 했다 — 저장을 맨 위로.
 * ★ 잘 안 쓰는 묶음(사무소 임대차·설립)은 접되, «값이 있으면 펼친 채»로 연다.
 *   빈 채로 접혀 있으면 채울 것이 있는 줄도 모른다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('상수 끝을 못 찾음: ' + name);
}
/* ⚠ 글자로 훑을 때는 주석을 먼저 걷는다 — 이 파일의 주석이 지시를 그대로 인용하고 있어
   그냥 보면 그 «글»이 코드로 읽힌다(2026-09-13 에 하루 다섯 번 걸렸다). */
const 코드만 = (s) => String(s || '').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^[ \t]*\/\/.*$/gm, ' ');

/* ══ ① 기금 정보 폼을 «정말 그려» 본다 ════════════════════════════ */

function 폼그리기(f, sites) {
  const box = {};
  new Function('F', 'SITES', [
    grabDecl('FIELDS'), grabDecl('INFO_SECS'), grabDecl('INFO_FOLD'),
    grabDecl('INFO_W2'), grabDecl('SELECT_OPTS'),
    /* 대표사업장 안내(2026-09-14)가 사업장을 찾아본다 — 그 길도 실어야 «정말 그려» 진다 */
    'var S={fundId:"F1",sitesFor:"F1",sites:SITES};',
    'var _allSites={F1:SITES||{}};',
    'function loadAllSites(){}',
    grabFn('isRegionFund'), grabFn('_leadSite'), grabFn('_fundSites'),
    'function esc(s){ return String(s==null?"":s); }',
    'function hlp(){ return "<i>ⓘ</i>"; }',
    'function govField(){ return ""; }',
    'function mgrMainField(){ return "<select id=\\"fd-mgr-main\\"></select>"; }',
    'function mgrSubField(){ return "<select id=\\"fd-mgr-sub-add\\"></select>"; }',
    'function officerPanel(){ return "<!--officers-->"; }',
    'function docZoneOne(){ return "<!--zone-->"; }',
    'function charterZone(){ return ""; }',
    'function bindDocIntake(){}',
    'var setTimeout=function(){};',
    grabFn('infoGroups'), grabFn('infoForm'),
    'this.html=infoForm(F); this.groups=infoGroups();'
  ].join('\n')).call(box, f, sites || {});
  return box;
}
/* 값이 하나도 없는 기금(막 만든 것)과, 임대차·설립까지 다 채운 기금 */
const 빈기금 = { name: '' };
const 채운기금 = { name: '가짜기금', lease_lessor: '○○빌딩', contribution_total: '100000000' };

test('★★ ① 저장이 «맨 위»에 있다 — 칸 스물다섯을 지나 내려가지 않아도 된다', () => {
  const h = 폼그리기(빈기금).html;
  const 저장 = h.indexOf('saveInfo()');
  assert.ok(저장 >= 0, '저장 단추가 없다');
  const 첫칸 = h.indexOf('id="fd-name"');
  assert.ok(첫칸 >= 0, '첫 칸을 못 찾았다');
  assert.ok(저장 < 첫칸, '★ 저장이 아직 칸들 «아래»에 있다 — 끝까지 내려가야 누른다.');
  /* 아래에도 하나 더 두면 「따로 저장해야 하나」 하고 망설인다 — 하나뿐이어야 한다 */
  assert.equal((h.match(/saveInfo\(\)/g) || []).length, 1, '★ 저장 단추가 둘이다.');
});

test('★ ② 아래에는 «저장이 위에 있다»는 한 줄을 남긴다 — 화면이 길면 못 찾는다', () => {
  const h = 폼그리기(빈기금).html;
  assert.ok(/맨 위/.test(h.slice(h.lastIndexOf('id="fd-'))), '★ 아래에 안내 한 줄이 없다.');
});

test('★★ ③ 값이 «있으면» 접는 묶음도 펼쳐 둔다 — 접힌 채면 채운 줄도 모른다', () => {
  const 펴짐 = 폼그리기(채운기금).html;
  const i = 펴짐.indexOf('id="sec-lease_lessor"');
  assert.ok(i >= 0, '접는 묶음 상자가 없다');
  assert.ok(!/^[^>]*display:none/.test(펴짐.slice(i)), '★ 값이 있는데도 접어 두었다.');
  assert.ok(펴짐.indexOf('id="sec-contribution_total"') >= 0);
  const 접힘 = 폼그리기(빈기금).html;
  const j = 접힘.indexOf('id="sec-lease_lessor"');
  assert.match(접힘.slice(j, j + 60), /display:none/, '★ 빈 묶음이 펼쳐진 채다 — 정리가 안 된다.');
  assert.match(접힘.slice(j - 400, j), /비어 있음/, '★ 왜 접혀 있는지 안 적었다.');
});

test('★★ ④ 접어도 칸은 «그려 둔다» — 저장이 FIELDS 를 도는데 칸이 없으면 값이 지워진다', () => {
  const h = 폼그리기(빈기금).html;
  ['fd-lease_lessor', 'fd-contribution_total'].forEach((id) => {
    assert.ok(h.indexOf('id="' + id + '"') >= 0,
      '★ 접힌 묶음의 칸이 아예 안 그려졌다: ' + id + ' — saveInfo 가 빈 값으로 덮어쓴다.');
  });
});

test('★★ ⑤ 묶음을 도로 펴면 FIELDS 와 한 칸도 다르지 않다', () => {
  const g = 폼그리기(빈기금).groups;
  const box = {};
  new Function(grabDecl('FIELDS') + ';this.F=FIELDS;').call(box);
  assert.deepEqual([].concat.apply([], g.map((x) => x.fields)), box.F,
    '★ 칸이 빠지거나 두 번 그려진다.');
  /* 첫 시도에서 lease_lessor «칸 자체»가 사라졌다 — 묶음 머리를 단 칸도 제 묶음에 들어야 한다 */
  assert.equal(g.filter((x) => x.key === 'lease_lessor')[0].fields[0][0], 'lease_lessor',
    '★ 묶음 머리를 단 칸이 제 묶음에서 빠졌다.');
});

test('★ ⑥ 접고 펴는 것은 «자료와 상관없다» — 접었다고 지워지지 않는다', () => {
  const fn = 코드만(grabFn('toggleInfoSec'));
  assert.ok(fn.indexOf('markDirty') < 0, '★ 접기만 했는데 저장 대상으로 잡는다.');
  assert.ok(fn.indexOf('save') < 0, '★ 접기가 저장을 건드린다.');
  const box = {}, 상자 = { style: { display: '' } }, 화살 = { textContent: '▾' };
  new Function('B', 'H', 'function $(id){ return id==="sec-k"?B:(id==="sech-k"?H:null); }\n'
    + grabFn('toggleInfoSec') + ';this.t=function(){ toggleInfoSec("k"); };').call(box, 상자, 화살);
  box.t();
  assert.equal(상자.style.display, 'none', '★ 접히지 않는다.');
  assert.equal(화살.textContent, '▸', '★ 화살표가 안 바뀐다 — 접힌 줄 모른다.');
  box.t();
  assert.equal(상자.style.display, '', '★ 다시 안 펴진다.');
  assert.equal(화살.textContent, '▾');
});

/* ══ ② 새 기금 등록 — 주담당·부담당 ═══════════════════════════════ */

function 새기금상자(staff, main) {
  const box = {}, 담긴것 = [], toasts = [];
  const 알약상자 = {
    insertAdjacentHTML: (_, h) => { 담긴것.push((h.match(/data-sid="([^"]+)"/) || [])[1]); },
    querySelector: (sel) => {
      const sid = (sel.match(/data-sid="([^"]+)"/) || [])[1];
      return 담긴것.indexOf(sid) >= 0
        ? { remove: () => { 담긴것.splice(담긴것.indexOf(sid), 1); } } : null;
    },
    querySelectorAll: () => 담긴것.map((sid) => ({ getAttribute: () => sid }))
  };
  new Function('BOX', 'MAIN', 'TOASTS', [
    'var _staffCache=' + JSON.stringify(staff) + ';',
    'function esc(s){ return String(s==null?"":s); }',
    'function toast(m,k){ TOASTS.push(m); }',
    'function $(id){ return id==="nf-subchips"?BOX:(id==="nf-mgr"?{value:MAIN}:null); }',
    grabFn('mgrSubChip'), grabFn('nfSubAdd'), grabFn('_nfSubs'),
    'this.add=nfSubAdd; this.read=_nfSubs;'
  ].join('\n')).call(box, 알약상자, main || '', toasts);
  return { box, 담긴것, toasts };
}
const 직원 = [{ sid: 'P-001', name: '김주담당' }, { sid: 'P-002', name: '이부담당' },
  { sid: 'P-003', name: '박부담당' }];

test('★★ ⑦ 새 기금 등록에 부담당이 있다 — 주담당 옆 한 줄', () => {
  const nf = 코드만(SRC.slice(SRC.indexOf('function newFund('),
    SRC.indexOf('function newFund(') + 9000));
  assert.match(nf, /id="nf-mgr"/, '주담당 칸이 없다');
  assert.match(nf, /id="nf-subwrap"/, '★ 주담당 옆에 부담당을 둘 자리가 없다.');
  /* 재직자 명단은 나중에 온다 — 그때 그 자리를 채운다. 명단을 기다리는 자리가 없으면 영영 빈칸이다 */
  const 채움 = 코드만(SRC.slice(SRC.indexOf("var sw=$('nf-subwrap')"),
    SRC.indexOf("var sw=$('nf-subwrap')") + 900));
  assert.match(채움, /id="nf-subchips"/, '★ 부담당 담는 곳이 없다.');
  assert.match(채움, /nfSubAdd\(this\.value\)/, '★ 고른 사람을 담는 길이 없다.');
});

test('★★ ⑧ 부담당은 담기고, 두 번 담기지 않고, 주담당은 못 담는다', () => {
  const { box, 담긴것, toasts } = 새기금상자(직원, 'P-001');
  box.add('P-002');
  assert.deepEqual(담긴것, ['P-002'], '고른 사람이 안 담겼다');
  box.add('P-002');
  assert.deepEqual(담긴것, ['P-002'], '★ 같은 사람이 두 번 담겼다.');
  box.add('P-001');
  assert.deepEqual(담긴것, ['P-002'], '★ 주담당인 사람이 부담당으로도 담겼다.');
  assert.ok(toasts.some((t) => t.indexOf('주담당') >= 0), '★ 왜 안 담기는지 말하지 않았다.');
  box.add('');
  assert.deepEqual(담긴것, ['P-002'], '★ 빈 값으로도 담겼다.');
  box.add('P-999');
  assert.deepEqual(담긴것, ['P-002'], '★ 명단에 없는 사람이 담겼다.');
});

test('★★ ⑨ 담은 부담당을 «이름과 함께» 걷어 온다 — 등록될 때 같이 간다', () => {
  const { box } = 새기금상자(직원, 'P-001');
  box.add('P-003'); box.add('P-002');
  assert.deepEqual(box.read(),
    [{ sid: 'P-003', name: '박부담당' }, { sid: 'P-002', name: '이부담당' }],
    '★ 담은 순서·이름이 그대로 안 나온다 — 등록된 기금의 부담당이 빈 이름이 된다.');
});

test('★★ ⑩ 등록할 때 주담당은 부담당에서 빼고 저장한다 — 한 사람이 둘로 세어진다', () => {
  const fn = 코드만(grabFn('createFund'));
  assert.match(fn, /mgr_subs/, '★ 부담당을 저장하지 않는다 — 등록하면 사라진다.');
  assert.match(fn, /_nfSubs\(\)\.filter\(function\(s\)\{ return !\(rec\.mgr_main&&rec\.mgr_main\.sid===s\.sid\)/,
    '★ 주담당을 부담당에서 안 걸러 낸다 — 한 사람이 주·부 둘로 세어진다.');
});

test('★ ⑪ ×로 빼는 길은 두 창이 «같은 것»을 쓴다 — 한쪽만 고치면 다른 쪽이 죽는다', () => {
  const fn = 코드만(grabFn('mgrSubDel'));
  assert.match(fn, /fd-mgr-subchips'\)\|\|\$\('nf-subchips/,
    '★ 정보 폼과 등록 창 중 한 곳에서만 ×가 먹는다.');
  assert.match(fn, /정보폼/, '★ 등록 창에서도 markDirty 를 부른다 — 거기엔 저장할 기금이 없다.');
});
