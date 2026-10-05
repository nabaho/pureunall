'use strict';
/* 기금 정보 칸마다 «누가 채웠는지» 딱지 — 자동화 확인 목업 4 (2026-10-05)
   🤖 기계·미확인(파란 점선) · ✓ 확인됨 · ✎ 사람이 씀 · 기록 없으면 딱지 없음.
   잣대는 확인함(_rvItems)과 같아야 한다: m:1 · ok 없음 · how≠dialog 만 «미확인».
   node --test tests/fund-prov-marks.test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
function grabFn(n) {
  const i = SRC.indexOf('function ' + n + '('); if (i < 0) throw new Error('없음: ' + n);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; } else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + n);
}
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

test('★★ 잣대 — 확인함과 같다(기계·미확인 / 확인 / 사람 / 기록 없음)', () => {
  const box = {};
  new Function(grabFn('_provState') + '\nthis.st=_provState;').call(box);
  assert.equal(box.st({ m: 1, src: 'scan:inka', how: '' }), 'a');
  assert.equal(box.st({ m: 1, src: 'card', how: 'list' }), 'a', '목록만 보고 넣은 값은 아직 미확인');
  assert.equal(box.st({ m: 1, src: 'scan:inka', how: 'dialog' }), 'o', '원본 옆에서 보고 넣은 값은 확인된 것(확인함도 안 묻는다)');
  assert.equal(box.st({ m: 1, ok: { by: 'x', at: 'y' } }), 'o');
  assert.equal(box.st({ m: 0, src: 'hand' }), 'h');
  assert.equal(box.st(undefined), '', '기록이 없으면 지어 붙이지 않는다');
  /* 확인함의 «미확인» 조건과 글자 그대로 맞대 본다 */
  assert.match(strip(grabFn('_rvItems')), /if\(p\.m!==1\|\|p\.ok\|\|p\.how==='dialog'\) return;/, '확인함 잣대가 바뀌었습니다 — _provState 도 함께 바꾸세요');
});

test('★★ 딱지를 단다 — 기계 칸은 파란 점선, 위 머리에 미확인 수', { skip: !JSDOM && 'jsdom 없음' }, () => {
  const dom = new JSDOM('<!doctype html><body><span id="provSum"></span>'
    + '<div class="fld"><label>인가번호</label><input id="fd-inka_no"></div>'
    + '<div class="fld"><label>인가일</label><input id="fd-inka_date"></div>'
    + '<div class="fld"><label>설립합의일</label><input id="fd-agree_date"></div>'
    + '<div class="fld"><label>전화</label><input id="fd-phone"></div></body>');
  const doc = dom.window.document;
  const ctx = { S: { view: 'fund', tab: 'info', fundId: 'F1' }, $: (id) => doc.getElementById(id), document: doc,
    FIELDS: [['inka_no', '기금인가번호'], ['inka_date', '인가일자'], ['agree_date', '설립합의일'], ['phone', '전화번호']] };
  const box = {};
  new Function('S', '$', 'document', 'FIELDS', [grabFn('_provState'), 'var PV={fid:"F1",ref:null,v:{}};', grabFn('_provPaint'),
    'this.PV=PV; this.paint=_provPaint;'].join('\n')).call(box, ctx.S, ctx.$, ctx.document, ctx.FIELDS);
  box.PV.v = { 'f|inka_no': { m: 1, src: 'scan:inka', how: 'dialog' }, 'f|inka_date': { m: 1, src: 'scan:inka', how: '' },
    'f|agree_date': { m: 0, src: 'hand' } };
  box.paint();
  const mark = (id) => { const l = doc.getElementById(id).parentNode.querySelector('.pvm'); return l ? l.textContent : ''; };
  assert.equal(mark('fd-inka_no'), '✓');
  assert.equal(mark('fd-inka_date'), '🤖');
  assert.equal(mark('fd-agree_date'), '✎');
  assert.equal(mark('fd-phone'), '', '기록 없는 칸에는 딱지가 없다');
  assert.ok(doc.getElementById('fd-inka_date').classList.contains('pv-a'), '★ 기계·미확인 칸이 파란 점선이 아닙니다');
  assert.ok(!doc.getElementById('fd-inka_no').classList.contains('pv-a'));
  assert.match(doc.getElementById('provSum').textContent, /확인 안 된 값 1/);
  /* 다시 칠해도 딱지가 겹치지 않고, 확인되면 점선이 걷힌다 */
  box.PV.v['f|inka_date'].ok = { by: 'x', at: 'y' };
  box.paint();
  assert.equal(doc.getElementById('fd-inka_date').parentNode.querySelectorAll('.pvm').length, 1);
  assert.equal(mark('fd-inka_date'), '✓');
  assert.ok(!doc.getElementById('fd-inka_date').classList.contains('pv-a'));
  assert.equal(doc.getElementById('provSum').textContent, '');
  /* 다른 기금 화면이면 손대지 않는다 */
  box.PV.fid = 'F2'; box.PV.v['f|inka_date'] = { m: 1, src: 'card' }; box.paint();
  assert.equal(mark('fd-inka_date'), '✓', '★ 다른 기금의 기록을 이 화면에 칠했습니다');
});

test('★ 배선 — 기금 정보 화면이 구독·칠하기를 부르고, [맞음]은 확인함과 같은 자리에 쓴다', () => {
  const f = strip(grabFn('infoForm'));
  assert.match(f, /id="provSum"/);
  assert.match(f, /_provSub\(S\.fundId\); _provPaint\(\);/);
  const ok = strip(grabFn('provOkOne'));
  assert.match(ok, /up\['prov\/'\+fid\+'\/f\|'\+k\+'\/ok'\]=\{by:by,at:at\}/, '★ 확인 표시를 확인함과 다른 자리에 씁니다');
  assert.match(strip(grabFn('_rvOkMany')), /up\['prov\/'\+it\.fid\+'\/'\+it\.key\+'\/ok'\]=\{by:by,at:at\}/);
  assert.match(ok, /RV\.at=0/, '확인함 숫자를 다시 세게 해야 합니다');
  /* 구독은 기금마다 하나 — 바꾸면 앞 것을 끊는다 */
  assert.match(strip(grabFn('_provSub')), /PV\.ref\.off\(\)/);
});
