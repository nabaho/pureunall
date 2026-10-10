'use strict';
/* 기금관리 쓰기 길 점검(2026-10-09, 대표 「검사하고 테스트… 정리」) — 고친 일곱 가지가 다시 안 깨지게.
 * 이름은 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); return SRC.slice(i, SRC.indexOf(';\n', i) + 1); };

const box = {};
new Function([
  "function num(v){ var n=Number(String(v==null?'':v).replace(/,/g,'')); return isFinite(n)?n:0; }",
  "function _splitsOf(x){ return (x&&x.splits)||[]; } function _monthOf(d){ return String(d||'').slice(5,7); }",
  "var S={fundId:'F1', year:2025, f15For:'F1/2025', f15Close:{}, txns:{}};",
  varSrc('XFER_MIN'), fnSrc('findTransfers'), fnSrc('monthLocked'), fnSrc('_yearLocked'), fnSrc('txnLocked'),
  'this.S=S; this.find=findTransfers; this.yl=_yearLocked; this.tl=txnLocked;',
].join('\n')).call(box);

test('① 결산 확정한 해 — 달을 안 잠갔어도 장부를 못 고친다, 다른 해 마감 자료로는 안 막는다', () => {
  box.S.txns = { t1: { date: '2025-03-02' } };
  box.S.f15Close = { months: {} };
  assert.equal(box.tl('t1'), false);
  box.S.f15Close = { locked: true, months: {} };
  assert.equal(box.tl('t1'), true, '확정한 해의 거래를 고칠 수 있다');
  box.S.f15For = 'F1/2024';
  assert.equal(box.yl(), false, '다른 해 마감 자료로 막았다');
  box.S.f15For = 'F1/2025';
  for (const fn of ['addTxnSave', 'saveOpening', 'sampleApprove']) assert.match(fnSrc(fn), /_yearLocked\(\)/, fn + ' 이 확정한 해를 안 막는다');
  assert.ok(fnSrc('importBank').includes("if(_cl.locked){ toast(_yr+'년은 결산 확정되어 통장을 가져올 수 없습니다"), '확정한 해에 통장을 들인다');
});

test('② 기업정보함에서 여러 곳 — 감싼 객체가 아니라 rec 를 저장', () => {
  assert.ok(fnSrc('applyCardsMulti').includes("var rec=_cardIntoRec(T,e,{status:'active'}).rec;"), '{rec,got,keys} 를 통째로 저장한다');
});

test('③ 손으로 여는 이체 짝 — 쪼갠 줄 빼기, 승인된 줄이 낀 짝은 미리 안 고르고 표시, 잠긴 달은 상계 안 함', () => {
  const T = (id, o) => Object.assign({ _id: id, date: '2025-04-01', deposit: 0, withdraw: 0 }, o);
  const p = box.find([T('i', { deposit: 50000, acct: 'A' }), T('o', { withdraw: 50000, acct: 'B', approved: true })]);
  assert.equal(p.length, 1); assert.equal(p[0].appr, true, '승인된 줄이 낀 줄 모른다');
  assert.equal(box.find([T('i', { deposit: 50000, acct: 'A' }), T('o', { withdraw: 50000, acct: 'B', splits: [{}, {}] })]).length, 0, '쪼갠 거래를 이체로 짝지었다');
  const m = fnSrc('_xferModal');
  assert.ok(m.includes("(pr.kind==='sure'&&!pr.appr?' checked':'')"), '승인된 줄이 낀 짝을 미리 골라 둔다');
  assert.ok(m.includes('승인된 줄 있음'));
  assert.ok(fnSrc('_applyXfer').includes('return _yearLocked()||monthLocked(_monthOf(pr.date));'), '잠긴 달의 짝을 상계한다');
});

test('④ 거래 직접 추가 — 같은 키가 있으면 덮지 않고 묻는다', () => {
  const a = fnSrc('addTxnSave');
  assert.ok(a.includes('if(!ex[key]) return put(key);'), '같은 키를 덮는다');
  assert.ok(a.includes("var n=2, k2=hkey(base+'|'+n); while(ex[k2]){ n++; k2=hkey(base+'|'+n); }"));
  assert.doesNotMatch(a, /\+key\)\.set\(rec\)/, '묻지 않고 바로 set 하는 옛 길이 남았다');
});

test('⑤ 사업장 백업 가져오기 — 모양 검사, 기금마다 늘고·없어지는 수를 보이고 묻는다', () => {
  const s = fnSrc('importSites');
  assert.ok(s.includes('!funds[k]'), '모르는 기금 id 를 sites/ 아래에 쓴다');
  assert.ok(s.includes('없어지는 곳'), '없어지는 사업장을 안 알린다');
  assert.ok(s.indexOf("fbDb.ref(NS+'/sites').once('value')") < s.indexOf("fbDb.ref(NS+'/sites').update(data)"), '보여 주기 전에 쓴다');
});

test('⑥ 기본정보 가져오기 덮어쓰기 칸 — 속성 안에 따옴표를 넣지 않는다', () => {
  const p = fnSrc('_impPreview');
  assert.ok(p.includes('_impPreview(window._impData,window._impFname)'));
  assert.ok(p.includes("window._impFname=fname||''"));
  assert.doesNotMatch(p, /_impPreview\(window\._impData,'\+JSON\.stringify/, '따옴표가 onchange 를 끊던 옛 길');
});

test('⑦ 분할 — 잠긴 달·확정한 해는 열지도 풀지도 못한다', () => {
  assert.match(fnSrc('splitForm'), /if\(txnLocked\(id\)\)\{ _lockStop/);
  assert.match(fnSrc('splitClear'), /if\(txnLocked\(id\)\)\{ closeM\(\); _lockStop/);
});

test('⑧ 결산 확정한 해 — 운영상황보고서 입력값·사업장 연도 기록도 못 고친다 (대표 「계속」 2026-10-09)', () => {
  assert.match(fnSrc('f15Save'), /if\(_yearLocked\(\)\)\{ _lockStop\(''\); return; \}/);
  assert.match(fnSrc('f15SetBf'), /if\(_yearLocked\(\)\)\{ _lockStop\(''\); return; \}/);
  /* 사업장 연도 기록은 마감 자료를 안 읽은 탭이라 저장 직전에 서버에서 본다 */
  const sy = fnSrc('sySet');
  assert.ok(sy.indexOf('_yearLockedP(fid,yr)') >= 0 && sy.indexOf('_yearLockedP(fid,yr)') < sy.indexOf("/site_years/'+fid"), '확인보다 쓰기가 먼저다');
  assert.match(fnSrc('syCopyPrev'), /_yearLockedP\(fid,yr\)\.then\(function\(lk\)\{ if\(lk\)/);
  const p = fnSrc('_yearLockedP');
  assert.ok(p.includes("'/locked').once('value')"), '서버에서 안 읽는다');
  assert.ok(p.includes('function(){ return false; }'), '못 읽으면 저장까지 멈춘다');
});

test('⑨ 잠긴 줄은 처음부터 흐리게 — 승인·계정·✂·× 는 disabled, 증빙은 열어 둠, 확정한 해는 머리에 🔒', () => {
  const c = fnSrc('closingTab');
  assert.ok(c.includes("lk=_yl||monthLocked(_monthOf(x.date)), dis=lk?' disabled':''"));
  assert.ok(c.includes("dis+' onchange=\"approveTxn("), '잠긴 줄의 승인 체크가 살아 있다');
  assert.ok(c.includes("acctSel(x._id,'debit',x.debit).replace('<select','<select disabled')"), '잠긴 줄의 계정 선택이 살아 있다');
  assert.ok(c.includes("<button'+dis+' onclick=\"splitForm(") && c.includes("<button'+dis+' onclick=\"delTxn("), '잠긴 줄의 ✂·× 가 살아 있다');
  assert.ok(!c.includes("<button'+dis+' onclick=\"openAlbumPick("), '증빙 붙이기까지 막았다');
  assert.ok(c.includes('🔒 결산 확정</span>'));
});

test('⑩ 회계·결산 틀 고정 — 회계 머리·표 제목 줄이 기금 머리 아래에 붙는다(넓은 화면만) (대표 「틀고정」 2026-10-10)', () => {
  assert.ok(fnSrc('closingTab').includes('<div class="panel closehead">'), '회계 머리에 closehead 가 없다');
  assert.ok(fnSrc('closeBodyHTML').includes('<div class="ledgerwrap"><table><thead>'), '장부 표가 가로 스크롤 상자에 갇혀 제목 줄이 안 붙는다');
  const css = SRC.slice(SRC.indexOf('.ledgerwrap{overflow-x:auto}'), SRC.indexOf('.ledgerwrap{overflow-x:auto}') + 600);
  assert.ok(css.includes('@media(min-width:1000px)'), '폰에서도 세 겹이 붙는다');
  assert.ok(css.includes('.closehead{position:sticky;top:calc(var(--topbar-h,48px) + var(--fundhead-h,73px))'));
  assert.ok(css.includes('var(--closehead-h,156px)'));
  const t = fnSrc('_syncTopbarH');
  assert.ok(t.includes("_setCssVar('--fundhead-h'") && t.includes("_setCssVar('--closehead-h'"), '머리 높이를 안 잰다');
});
