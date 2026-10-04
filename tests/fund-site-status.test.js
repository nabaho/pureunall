'use strict';
/* 참여 상태 — 탈퇴·폐업 (대표 지시 2026-10-04 「폐업으로 체크할 수 있는 항목도 만들어라」, 목업 승인)
 * 편집 창에 「참여 중/탈퇴」·탈퇴일·폐업(탈퇴한 곳만)·폐업일, 참여사업장 탭에 [탈퇴한 사업장 보기]. 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

function 상자(dom) {
  const box = {};
  new Function('DOM', [
    'var $=function(id){ return DOM[id]||null; };',
    'function esc(v){ return String(v==null?"":v).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;"}[c];}); }',
    fnSrc('_siteStatusBox'), fnSrc('siteStatusToggle'), fnSrc('_siteStatusRead'), fnSrc('_siteStatusChips'),
    'this.box=_siteStatusBox; this.toggle=siteStatusToggle; this.read=_siteStatusRead; this.chips=_siteStatusChips;',
  ].join(String.fromCharCode(10))).call(box, dom || {});
  return box;
}

test('★ 저장 — 탈퇴·탈퇴일·폐업·폐업일이 그대로 담긴다', () => {
  const d = { 'se-st-closed': { checked: true }, 'se-leave_date': { value: '2026-10-04' },
    'se-biz_closed': { checked: true }, 'se-biz_closed_date': { value: '2026-09-30' } };
  assert.deepEqual(상자(d).read({}), { status: 'closed', leave_date: '2026-10-04', biz_closed: true, biz_closed_date: '2026-09-30' });
});

test('★ 참여로 되돌리면 탈퇴일·폐업을 함께 걷는다(null = 지움)', () => {
  const d = { 'se-st-closed': { checked: false }, 'se-leave_date': { value: '2026-10-04' },
    'se-biz_closed': { checked: true }, 'se-biz_closed_date': { value: '2026-09-30' } };
  assert.deepEqual(상자(d).read({}), { status: 'active', leave_date: null, biz_closed: null, biz_closed_date: null });
});

test('폐업은 탈퇴한 곳만 — 참여 중이면 폐업 칸이 잠기고 꺼진다', () => {
  const b = { checked: true, disabled: false }, bd = { disabled: false }, ld = { disabled: false }, box = { style: {} };
  상자({ 'se-st-closed': { checked: false }, 'se-biz_closed': b, 'se-biz_closed_date': bd, 'se-leave_date': ld, 'se-bizbox': box }).toggle();
  assert.equal(b.disabled, true); assert.equal(b.checked, false); assert.equal(bd.disabled, true); assert.equal(ld.disabled, true);
  const html = 상자().box({ status: 'active' });
  assert.match(html, /id="se-biz_closed" disabled/, '참여 중인 사업장은 처음부터 폐업 칸이 잠겨 있다');
  assert.match(상자().box({ status: 'closed', biz_closed: true, leave_date: '2026-10-04' }), /id="se-st-closed" checked/);
});

test('목록 딱지 — 탈퇴(날짜)·폐업', () => {
  const c = 상자().chips({ status: 'closed', leave_date: '2026-10-04', biz_closed: true });
  assert.match(c, /탈퇴 26-10-04/); assert.match(c, /폐업/);
  assert.doesNotMatch(상자().chips({ status: 'closed' }), /폐업/);
  assert.match(상자().chips({ status: 'active' }), /참여/);
});

test('★ 배선 — 편집 창에 상자, 저장이 읽고 고쳐 쓰기(update)에 세 칸을 싣는다, 목록에 펼치기, ⓘ 도움말', () => {
  assert.match(fnSrc('editSite'), /_siteStatusBox\(s\)/);
  assert.match(fnSrc('editSite'), /hlp\('site\.status'\)/);
  const sv = fnSrc('saveSite');
  assert.match(sv, /_siteStatusRead\(obj\)/);
  assert.match(sv, /\['leave_date','biz_closed','biz_closed_date'\]\.forEach/);
  const st = fnSrc('sitesTab');
  assert.match(st, /S\.showClosedSites/); assert.match(st, /탈퇴한 사업장 보기/); assert.match(st, /_siteStatusChips\(s\)/);
  assert.match(st, /<th style="width:34px">□<\/th><th style="width:40px">#<\/th>/, '목록 맨 앞에 □·번호');
  assert.match(SRC, /'site\.status':\{t:'참여 상태 — 탈퇴·폐업'/);
});
