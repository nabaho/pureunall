/* 🔗 이알피 대표자·담당자 대조 — 259곳이 «대부분 문제가 아니었다» (대표 2026-09-30 「이런 데이터 어떻게?」 → 「진행」)

   ★ 못 박는 것
     ① 같은 사람은 한 번만 — 이알피는 담당자를 세 곳(contacts · primaryContactName · contactName)에 둔다
     ② 직함은 떼고 견준다 · 「사무실」·「담당자」는 사람이 아니다 · 한 칸에 둘이면 가른다
     ③ 셋으로 가른다 — 손볼 곳(명함은 있는데 이름 없음) · 명함 아직 없음 · 이알피 이름 칸에 직함
     ④ 회사 이름이 «보인다» · 한 회사 한 줄 · 칸 셋을 누르면 그 자리(인라인)에 다시 그린다
     ⑤ 이알피 자료는 읽기만 — 여기서 이알피에 쓰지 않는다

   node --test tests/cards-erpname-clean.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

function load(companies, cards, extra) {
  const shown = [];
  const ErpMatch = {
    ready: true, companies,
    _norm: s => String(s || '').toLowerCase().replace(/㈜|\(주\)|주식회사/g, '').replace(/[\s\-_.,·()]/g, ''),
    _digits: s => String(s || '').replace(/[^0-9]/g, ''),
    _nameHit: (a, b) => !!a && !!b && (a === b || a.indexOf(b) === 0 || b.indexOf(a) === 0)
  };
  const items = {}; (cards || []).forEach((c, i) => { items['c' + i] = Object.assign({ kind: 'card' }, c); });
  const ctx = Object.assign({ console, Object, Array, String, Number, JSON,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    digits: s => String(s || '').replace(/\D/g, ''), fmtBizno: s => String(s),
    state: { items, view: 'list', setSub: '' }, Store: { mode: 'firebase' }, ErpMatch,
    _panelTarget: 'inline', _closeBtn: () => '', showPanel: h => shown.push(h), toast: () => {},
    renderSettingsPage: () => { ctx._redrawn = (ctx._redrawn || 0) + 1; }, coList: () => [] }, extra || {});
  vm.createContext(ctx);
  vm.runInContext([
    SRC.match(/^const ERP_TITLE_RE = [^\n]*$/m)[0].replace('const ', 'var '),
    SRC.match(/^const ERP_NOT_PERSON = [^\n]*$/m)[0].replace('const ', 'var '),
    'var _erpNameSeg = "fix", _erpNameInfo = false;',
    ...['function erpNamePeople(', 'function erpCoPeople(', 'function findErpNameMismatch(', 'function erpNameRepaint(',
      'function erpNameSegSet(', 'function openErpNameCheck('].map(f => cutFn(SRC, f))
  ].join('\n'), ctx);
  ctx._shown = shown;
  return ctx;
}

test('★★★ ① 같은 사람은 한 번만 — 담당자 세 칸에 같은 이름이 있어도', () => {
  const c = load([]);
  const pp = c.erpCoPeople({ ceo: '홍길동', contacts: [{ name: '김담당 전무' }], primaryContactName: '김담당 전무', contactName: '김담당' });
  assert.deepEqual(Array.from(pp.people).map(p => p.role + ' ' + p.name), ['대표 홍길동', '담당 김담당']);
});

test('★★★ ② 직함은 떼고 · 사람 아닌 글자는 빼고 · 한 칸에 둘이면 가른다', () => {
  const c = load([]);
  const pp = c.erpCoPeople({ ceo: '박대표이사', contacts: [{ name: '사무실' }, { name: '이수민대표 , 남가람주임' }], contactName: '담당자' });
  const names = Array.from(pp.people).map(p => p.name);
  assert.ok(names.indexOf('이수민') >= 0 && names.indexOf('남가람') >= 0, '★ 한 칸의 두 사람을 못 갈랐다: ' + names);
  assert.ok(names.indexOf('사무실') < 0 && names.indexOf('담당자') < 0, '★★ 「사무실」·「담당자」를 사람으로 셌다');
  assert.ok(pp.odd.indexOf('사무실') >= 0, '★ 이알피에서 고칠 목록에 사람 아닌 글자가 안 올랐다');
  assert.equal(c.erpNamePeople('홍길동 사장')[0].name, '홍길동');
  assert.equal(c.erpNamePeople('홍길동')[0].titled, false);
  assert.equal(c.erpNamePeople('김이사')[0].name, '김이사', '★ 두 글자 이름까지 깎아 먹으면 안 된다(김 + 이사)');
});

test('★★★ ③ 셋으로 가른다 — 명함 0장인 곳은 «손볼 곳»이 아니다', () => {
  const cos = [
    { name: '가나정밀', bizNo: '1238100001', ceo: '홍길동', contactName: '홍길동 대표' },   // 명함에 홍길동 있음 → 없음
    { name: '다라산업', bizNo: '1238600002', ceo: '박민수' },                             // 명함은 있는데 다른 사람 → 손볼 곳
    { name: '마바테크', bizNo: '1238100003', ceo: '최지훈', contactName: '사무실' }        // 명함 0장 → 명함 아직 없음 + 직함 칸
  ];
  const cards = [{ name: '홍길동', company: '가나정밀' }, { name: '박민숙', company: '다라산업' }];
  const r = load(cos, cards).findErpNameMismatch();
  assert.deepEqual(Array.from(r.fix).map(x => x.company), ['다라산업']);
  assert.deepEqual(Array.from(r.none).map(x => x.company), ['마바테크']);
  assert.deepEqual(Array.from(r.titled).map(x => x.company).sort(), ['가나정밀', '마바테크']);
  assert.deepEqual(Array.from(r.fix[0].have), ['박민숙'], '★ 받아 둔 명함이 누구인지 보여야 견줘 본다');
});

test('★★ ④ 회사 이름이 «보인다» · 한 회사 한 줄 · 칸을 누르면 인라인으로 다시 그린다', () => {
  const c = load([{ name: '다라산업', bizNo: '1238600002', ceo: '박민수' }], [{ name: '박민숙', company: '다라산업' }],
    { state: { items: { c0: { kind: 'card', name: '박민숙', company: '다라산업' } }, view: 'settings', setSub: 'erpname' } });
  c.openErpNameCheck();
  const h = c._shown[0];
  assert.match(h, /<td class="nm">다라산업<\/td>/, '★★ 회사 이름이 표에 없다 — 번호만 떠 보였다');
  assert.match(h, /손볼 곳<b>1<\/b>/); assert.match(h, /명함 아직 없음<b>0<\/b>/);
  assert.ok(!/class="ditem"/.test(h), '★ 옛 두 줄 모양이 남았다');
  c.erpNameSegSet('none');
  assert.equal(c._redrawn, 1, '★★ 환경설정 안에서 칸을 눌렀는데 팝업으로 떴다');
  const css = SRC.slice(SRC.indexOf('.ntstbl td{'), SRC.indexOf('.ntstbl td{') + 160);
  assert.match(css, /white-space:nowrap/, '★ 칸이 두 줄로 접힌다');
});

test('★★ ⑤ 이알피 자료는 «읽기만» — 대조가 이알피에 쓰지 않는다', () => {
  ['erpNamePeople', 'erpCoPeople', 'findErpNameMismatch', 'openErpNameCheck', 'erpNameOpenCo'].forEach(n => {
    const b = cutFn(SRC, 'function ' + n + '(');
    assert.ok(!/\.update\(|\.set\(|\.remove\(|Store\.put|\.ref\(/.test(b), '★★ ' + n + ' 가 저장소에 손을 댄다');
  });
});
