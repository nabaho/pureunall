'use strict';
/* 🖨 서식 자동 채움 · 바뀐 칸 빨강 (대표 승인 2026-11-07 — 목업 «설립중팝업·자동채움·빨간표시» 2~5번)
   · 서식이 «읽는 자료 칸»을 마지막 확인 기록(form_ok)과 견준다: 없던 값 = 새로 · 다른 값 = 바뀜(전 값) · 사라짐 = 바뀜
   · 빨강은 화면 검토용 — 서식 본문(인쇄·PDF·한글)에는 한 글자도 안 들어간다. 인쇄·받기 관문이 «확인 안 한 칸»을 한 번 묻는다
   · [✔ 확인]은 값을 안 고친다 — 쓰는 곳은 form_ok(확인 기록)와 prov/…/ok(🤖 «맞음») 둘뿐
   · 개인정보(생년월일·주소)는 확인 기록에 값을 남기지 않는다(지문만)
   ⚠ 이름·값은 모두 가짜다. 함수를 «떠서 돌려» 본다(글자만 찾는 검사는 기능을 꺼도 초록이다).
   node --test tests/fund-fill-red.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1 ');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0, on = false;
  for (let k = i; k < SRC.length; k++) { if (SRC[k] === '{') { d++; on = true; } else if (SRC[k] === '}') { d--; if (on && !d) return SRC.slice(i, k + 1); } }
  throw new Error('끝을 못 찾음 ' + n); };
const lineSrc = (n) => { const m = SRC.match(new RegExp('^var ' + n + '=.*$', 'm')); assert.ok(m, '없음 ' + n); return m[0]; };
const FUNCS = ['_fcIsSetup', '_fcForms', '_fcLabel', '_fcCells', '_fcHash', '_fcStable', '_fcRec', '_fcShow', '_fcOld', '_fcDiff', '_fcSnap',
  '_fcItLab', '_fcReadsSites', '_fcMiss', '_fcState', '_fcFund', '_fcGateRed', '_fcGateRow', '_gateWhy', '_estabKind', '_hwpTplKey', '_dkKeyOf', 'docsFor'];

/* ── 실제 함수를 가짜 자료 위에서 돌린다 ── */
function make(extra) {
  const box = {};
  new Function([
    "var S={_docR:{marker:1},user:'담당A'}; var NS='fund_erp';",
    "var FIELDS=[['chairman','대표자 성명'],['name','기금법인 명칭'],['address','주사무소 소재지'],['phone','전화번호']];",
    "var SITE_FIELDS=[['name','상호'],['ceo','대표자'],['contrib','출연금']], WREP_FIELDS=[['wrep_birth','근로자대표 생년월일']], UREP_FIELDS=[], SME_FIELDS=[];",
    "function _rvLabel(k){ return '«'+k+'»'; }",
    "function esc(s){ return String(s==null?'':s); }",
    /* 서식 목록 — 인가(공동 전용 합의서 포함)·등기·세무. 사업계획서는 사업장이 «아직 있는» 것만 읽는 서식 */
    "var DOCS={kinds:[['inka','설립인가신청서'],['agreement','설립합의서','공동'],['charter','정관'],['bizplan','사업계획서']],reg:[['reg_apply','등기신청서']],tax:[['tax_bizreg','사업자등록신청']]};",
    "var ESTAB_PHASES=[['kinds','① 인가',function(){return DOCS.kinds;}],['reg','② 등기',function(){return DOCS.reg;}],['tax','③ 세무',function(){return DOCS.tax;}],['ops','④ 운영',function(){return [];}]];",
    /* 서식이 읽는 칸: 기금 이름·대표자·소재지·임원, 사업장 상호·대표자·근로자대표 생년월일·출연금. 오늘 날짜는 자료가 아니다 */
    "function rd(f,sites){ var v={n:f.name,c:f.chairman,a:f.address,o:f.officers,today:new Date().toISOString()};",
    "  sites.forEach(function(s){ v[s._id]=[s.name,s.ceo,s.wrep_birth,s.contrib].join('/'); }); return v; }",
    "var HWP_TPL_VALUES={inka:rd,agreement:rd,charter:rd,bizplan:rd,reg_apply:rd,tax_bizreg:rd};",
    "function _sitesFill(f,s){ return s||[]; }",
    "function _fundFill(f){ return {f:Object.assign({},f),notes:[]}; }",
    "function _formUnconf(kind,f,sites,P){ return (P&&P.__bot)||[]; }",
    extra || '',
    ...FUNCS.map(fnSrc),
    ...['FC_PH', 'FC_LOCK', 'FC_SKIP', 'FC_SECRET', 'FC_LBL'].map(lineSrc),
    'this.S=S; this.forms=_fcForms; this.cells=_fcCells; this.diff=_fcDiff; this.rec=_fcRec; this.snap=_fcSnap; this.old=_fcOld; this.show=_fcShow;',
    'this.state=_fcState; this.fund=_fcFund; this.gate=_fcGateRed; this.why=_gateWhy; this.row=_fcGateRow; this.isSetup=_fcIsSetup; this.miss=_fcMiss;',
  ].join('\n')).call(box);
  return box;
}
const B = make();

const F = { _id: 'F1', fund_type: '공동', setup_stage: '설립준비', name: '검증공동기금', chairman: '김가나', address: '충남 검증시 가로 1', officers: [{ name: '이다라' }], setup: {} };
const SITES = [
  { _id: 's1', name: '가나산업', ceo: '박마바', wrep_birth: '1980-01-02', contrib: 1000000 },
  { _id: 's2', name: '다라전자', ceo: '최사아', contrib: 2000000 },
];
const keysOf = (red) => red.map((r) => r.k).sort();

test('★ 자료 칸만 잰다 — 오늘 날짜 같은 «자료 아닌 값»은 칸이 아니다(날마다 빨개지지 않는다)', () => {
  const cells = B.cells('inka', F, SITES);
  const ks = cells.map((c) => c.k);
  assert.ok(ks.includes('f|chairman') && ks.includes('f|address') && ks.includes('s|s1|ceo'), '서식이 읽는 칸이 빠졌다');
  assert.ok(!ks.some((k) => /today/.test(k)), '오늘 날짜를 칸으로 센다 — 날마다 빨개진다');
  assert.ok(!ks.some((k) => /\|_/.test(k)), '밑줄로 시작하는 안쪽 칸을 센다');
  assert.ok(!ks.includes('f|setup') && !ks.includes('f|setup_stage'), '진행 단계 칸을 자료로 센다');
  /* 사업장 줄에서 상호가 맨 앞 */
  const s1 = cells.filter((c) => c.sid === 's1').map((c) => c.fk);
  assert.equal(s1[0], 'name', '사업장 칸이 상호부터 시작해야 한다');
});

test('★ 안쪽 상태를 어지럽히지 않는다 — 장부 곁값(S._docR)은 재는 동안만 비우고 반드시 되돌린다', () => {
  const b = make("HWP_TPL_VALUES.inka=function(){ throw new Error('값 함수가 터짐'); };");
  b.cells('inka', F, SITES);
  assert.ok(b.S._docR && b.S._docR.marker === 1, '재고 나서 S._docR 를 되돌리지 않았다');
});

test('★ 확인 기록이 없으면 값 있는 칸은 모두 «새로» · 빈 칸은 빨갛지 않다', () => {
  const cells = B.cells('inka', F, SITES);
  const red = B.diff(cells, null);
  assert.ok(red.length >= 2 && red.every((r) => r.how === 'new'));
  const filled = cells.filter((c) => c.val != null && String(c.val).trim() !== '' && !(Array.isArray(c.val) && !c.val.length));
  assert.equal(red.length, filled.length, '값 있는 칸 수와 빨간 칸 수가 다르다');
  assert.ok(!red.some((r) => r.c && (r.c.val == null || r.c.val === '')), '빈 칸이 빨갛다');
});

test('★ [확인]한 값과 같으면 빨강 없음 · 다르면 «바뀜»+전 값 · 값이 사라져도 바뀜', () => {
  const cells = B.cells('inka', F, SITES);
  const ok = { v: B.snap(cells) };
  assert.deepEqual(B.diff(cells, ok), [], '확인 직후인데 빨갛다');
  /* 대표자가 바뀜 */
  const f2 = Object.assign({}, F, { chairman: '새대표' });
  const r2 = B.diff(B.cells('inka', f2, SITES), ok);
  assert.deepEqual(keysOf(r2), ['f|chairman']);
  assert.equal(r2[0].how, 'chg');
  assert.equal(B.old(r2[0].old), '김가나', '전 값을 못 보인다');
  /* 값이 사라짐 */
  const f3 = Object.assign({}, F, { chairman: '' });
  const r3 = B.diff(B.cells('inka', f3, SITES), ok);
  assert.ok(r3.some((r) => r.k === 'f|chairman' && r.how === 'chg'), '지워진 값을 못 알아챈다');
  /* 명단(배열)이 바뀜 — 지문으로 알아챈다 */
  const f4 = Object.assign({}, F, { officers: [{ name: '이다라' }, { name: '추가' }] });
  assert.deepEqual(keysOf(B.diff(B.cells('inka', f4, SITES), ok)), ['f|officers']);
});

test('★ 참여사업장이 새로 생기면 새로 · 빠지면 «빠짐» (확인 때 있던 사업장이 사라지는 것도 바뀐 것)', () => {
  const ok = { v: B.snap(B.cells('inka', F, SITES)) };
  const added = SITES.concat([{ _id: 's3', name: '마바화학', ceo: '정자차', contrib: 1 }]);
  const r1 = B.diff(B.cells('inka', F, added), ok);
  assert.ok(r1.length >= 1 && r1.every((r) => r.how === 'new' && r.c.sid === 's3'), '새 사업장만 빨개야 한다');
  const r2 = B.diff(B.cells('inka', F, SITES.slice(0, 1)), ok);
  assert.ok(r2.some((r) => r.how === 'gone' && r.k === 's|s2' && r.nm === '다라전자'), '빠진 사업장을 못 알아챈다');
});

test('★ 개인정보는 확인 기록에 값을 남기지 않는다 — 생년월일·주소는 지문만, 전 값은 못 보인다', () => {
  assert.match(B.rec('wrep_birth', '1980-01-02'), /^#[0-9a-f]+$/);
  assert.match(B.rec('address', '충남 검증시 가로 1'), /^#[0-9a-f]+$/);
  assert.match(B.rec('urep_addr', '어딘가'), /^#[0-9a-f]+$/);
  const snap = JSON.stringify(B.snap(B.cells('inka', F, SITES)));
  assert.ok(!/1980|가로 1/.test(snap), '확인 기록에 생년월일·주소 값이 그대로 들어갔다');
  /* 지문은 같은 값이면 같고 다른 값이면 다르다 */
  assert.equal(B.rec('address', 'A'), B.rec('address', 'A'));
  assert.notEqual(B.rec('address', 'A'), B.rec('address', 'B'));
  /* 값을 안 남긴 칸이 바뀌어도 «바뀜»은 알리되 전 값은 지어내지 않는다 */
  const ok = { v: B.snap(B.cells('inka', F, SITES)) };
  const r = B.diff(B.cells('inka', Object.assign({}, F, { address: '다른 곳' }), SITES), ok);
  assert.equal(r.length, 1);
  assert.ok(!/충남/.test(B.old(r[0].old)), '남기지 않은 전 값을 보인다');
  /* 보통 값·빈 값·긴 값 */
  assert.equal(B.rec('chairman', '김가나'), '=김가나');
  assert.equal(B.rec('chairman', '  '), '=');
  assert.equal(B.rec('chairman', null), '=');
  assert.match(B.rec('memo', 'x'.repeat(300)), /^#/, '긴 값을 통째로 남긴다');
});

test('★ 설립중 기금만 · 인가 전 «등기»·등기 전 «세무» 서식은 잠가 두고 재지 않는다', () => {
  assert.equal(B.isSetup(F), true);
  assert.equal(B.isSetup(Object.assign({}, F, { setup_stage: '' })), false, '운영 기금이 설립중으로 센다');
  assert.equal(B.isSetup(Object.assign({}, F, { _sample: true })), false, '견본이 설립중으로 센다');
  const lock = (f) => B.forms(f).reduce((m, x) => { m[x.kind] = x.lock; return m; }, {});
  const L0 = lock(F);
  assert.ok(L0.inka === '' && L0.reg_apply && L0.tax_bizreg, '단계 잠금이 다르다: ' + JSON.stringify(L0));
  const L1 = lock(Object.assign({}, F, { setup: { 'EST-08': { done: true } } }));
  assert.equal(L1.reg_apply, '', '인가 뒤인데 등기 서식이 잠겨 있다');
  assert.ok(L1.tax_bizreg, '등기 전인데 세무 서식이 열렸다');
  const L2 = lock(Object.assign({}, F, { setup: { 'EST-08': { done: true }, 'EST-09': { done: true } } }));
  assert.equal(L2.tax_bizreg, '');
  /* 사내 기금에는 공동 전용 서식(합의서)이 없다 */
  assert.ok(!B.forms(Object.assign({}, F, { fund_type: '사내' })).some((x) => x.kind === 'agreement'));
  assert.ok(B.forms(F).some((x) => x.kind === 'agreement'));
  /* 잠긴 서식은 형편을 재지 않는다 */
  const fm = B.forms(F).filter((x) => x.lock)[0];
  const st = B.state(F, fm, SITES, {}, {}, []);
  assert.deepEqual([st.n, st.red.length, st.cells.length], [0, 0, 0]);
});

test('★ 폐업·탈퇴 사업장은 설립 서식에선 읽고 사업계획서(해마다)에선 뺀다 — 서식을 만드는 규칙과 같게', () => {
  const closed = SITES.concat([{ _id: 'sx', name: '폐업상사', ceo: '탈퇴', status: 'closed' }]);
  assert.ok(B.cells('inka', F, closed).some((c) => c.sid === 'sx'), '설립 서식은 탈퇴한 곳도 읽는다');
  assert.ok(!B.cells('bizplan', F, closed).some((c) => c.sid === 'sx'), '사업계획서가 탈퇴한 곳을 읽는다');
});

test('★ 🤖(기계가 넣고 원본 대조 전)는 한 번만 센다 — 빨강과 겹치면 중복 계산하지 않는다', () => {
  const bot = [{ key: 'f|chairman', lab: '대표자 성명', val: '김가나' }];
  const fm = B.forms(F)[0];
  const st = B.state(F, fm, SITES, {}, { __bot: bot }, []);
  const filled = st.cells.filter((c) => c.val != null && String(c.val).trim() !== '' && !(Array.isArray(c.val) && !c.val.length)).length;
  assert.equal(st.n, filled, '🤖 칸이 빨강과 겹치는데 두 번 센다');
  /* 확인한 뒤에도 🤖 가 남아 있으면 그 칸은 센다 */
  const ok = { inka: { v: B.snap(st.cells) } };
  const st2 = B.state(F, fm, SITES, ok, { __bot: bot }, []);
  assert.equal(st2.red.length, 0);
  assert.equal(st2.n, 1, '확인했어도 🤖 가 남으면 확인할 칸이다');
});

test('★ 자료 모자람 — 이 서식이 읽는 빈 자료만(추정은 제외) · 사업장을 읽는 서식만 «사업장 없음»을 말한다', () => {
  const gaps = [{ k: 'chairman', label: '대표자 성명', where: '기금 정보' }, { k: 'phone', label: '전화번호', where: '기금 정보' },
    { k: 'ceo', label: '대표자', where: '참여사업장', site: true }, { k: 'contrib', label: '출연금(추정)', est: true, site: true }, { k: '_sites', label: '참여사업장', where: '추가' }];
  const cells = B.cells('inka', F, SITES);
  const m = B.miss('inka', F, cells, gaps).map((g) => g.k).sort();
  assert.deepEqual(m, ['_sites', 'ceo', 'chairman'], '이 서식이 읽는 것만 모자람이다: ' + m);
  assert.ok(!m.includes('phone'), '읽지 않는 칸을 모자람으로 센다');
  assert.ok(!m.includes('contrib'), '추정을 빈 자료로 센다');
  /* 사업장을 안 읽는 서식이면 «사업장 없음»은 이 서식의 모자람이 아니다 */
  const noSite = make("HWP_TPL_VALUES.inka=function(f){ return {n:f.name}; };");
  const c2 = noSite.cells('inka', F, SITES);
  assert.ok(!noSite.miss('inka', F, c2, gaps).some((g) => g.k === '_sites'));
});

test('★ 자료를 못 읽었으면 «없음»이라 하지 않는다 — 사업장·확인 기록이 null 이면 null', () => {
  assert.equal(B.fund(F, null, {}, {}, []), null);
  assert.equal(B.fund(F, SITES, null, {}, []), null);
  assert.equal(B.fund(Object.assign({}, F, { setup_stage: '' }), SITES, {}, {}, []), null, '운영 기금을 잰다');
  const fc = B.fund(F, SITES, {}, {}, []);
  assert.ok(fc && fc.nForm >= 1 && fc.nCell >= fc.nForm);
});

test('★ 관문에 붙는 🔴 — 설립중·열린 서식만, 🤖 와 겹치면 빼고, 같은 칸은 한 줄(한 번 확인하면 모든 서식)', () => {
  const kinds = ['inka', 'charter', 'reg_apply'];
  const R = B.gate(kinds, F, SITES, {}, []);
  assert.ok(R.items.length >= 1 && R.items.every((i) => i.red));
  assert.deepEqual(R.snaps.map((s) => s.kind).sort(), ['charter', 'inka'], '잠긴 서식(등기)이 관문에 든다');
  const dup = R.items.filter((i) => i.key === 'f|chairman');
  assert.equal(dup.length, 1, '같은 칸이 서식마다 따로 센다');
  assert.ok(dup[0].forms.length >= 2, '어느 서식들이 읽는지 모아 보이지 않는다');
  /* 🤖 에 이미 있는 칸은 뺀다 */
  const R2 = B.gate(kinds, F, SITES, {}, [{ key: 'f|chairman' }]);
  assert.ok(!R2.items.some((i) => i.key === 'f|chairman'), '🤖 와 겹치는 칸을 또 센다');
  /* 설립중이 아니면 아무것도 묻지 않는다 */
  const R3 = B.gate(kinds, Object.assign({}, F, { setup_stage: '' }), SITES, {}, []);
  assert.deepEqual([R3.items.length, R3.snaps.length], [0, 0]);
  /* 방금 확인한 서식은 묻지 않는다 */
  const ok = {}; B.forms(F).forEach((x) => { ok[x.kind] = { v: B.snap(B.cells(x.kind, F, SITES)) }; });
  assert.equal(B.gate(kinds, F, SITES, ok, []).items.length, 0);
  /* 안내문은 있는 것만 말한다 */
  assert.match(B.why([{ red: 1 }]), /🔴/); assert.ok(!/🤖/.test(B.why([{ red: 1 }])));
  assert.match(B.why([{ key: 'x' }]), /🤖/); assert.ok(!/🔴/.test(B.why([{ key: 'x' }])));
  assert.ok(/🤖/.test(B.why([{ red: 1 }, { key: 'x' }])) && /🔴/.test(B.why([{ red: 1 }, { key: 'x' }])));
  assert.match(B.row(R.items[0]), /🔴/);
});

/* ── 쓰는 곳 — [✔ 확인]은 form_ok 와 prov/…/ok 만 쓴다 ── */
test('★ [✔ 확인]은 자료 값을 안 고친다 — 쓰는 곳은 form_ok 와 🤖 «맞음»(prov/…/ok) 둘뿐', async () => {
  const written = [];
  const b = {};
  new Function([
    "var S={_docR:null,user:'담당A',view:'home'}; var NS='fund_erp';",
    "var SD={sites:{F1:[]},fok:{F1:{}},prov:{F1:{}},pop:false,fcv:'x'}; var funds={F1:{_x:1}};",
    "var RV={at:5}, FG={at:5}; function toast(){} function confirmM(){ return Promise.resolve(true); }",
    "function _nowStamp(){ return '2026-11-08 09:00:00'; } function _trProvRk(){ return 'rk'; } function _trEv(){}",
    "function renderSetupDash(){} function sdPop(){}",
    "var fbDb={ref:function(p){ return {update:function(up){ WRITTEN.push({p:p,up:up}); return Promise.resolve(); }}; }};",
    "var cellsOf={k1:{k:'f|chairman',fk:'chairman',val:'김가나'},k2:{k:'f|address',fk:'address',val:'어딘가'}};",
    /* _fcFund 를 가짜로 — 빨간 서식 하나(칸 둘, 🤖 하나) */
    "function _fcFund(){ return {list:[{kind:'inka',lock:'',err:0,n:2,cells:[cellsOf.k1,cellsOf.k2],bot:{'f|chairman':{key:'f|chairman'}}}]}; }",
    "function _fcSnap(c){ var v={}; c.forEach(function(x){ v[x.k]='='+x.val; }); return v; }",
    fnSrc('fcOk'),
    'this.go=fcOk; this.SD=SD; this.RV=RV; this.FG=FG;',
  ].join('\n').replace(/WRITTEN/g, '__W')).call(Object.assign(b, {}));
  // new Function 안의 __W 를 밖에서 쓰려고 전역에 건다
  global.__W = written;
  b.go('F1', ['inka']);
  await new Promise((r) => setTimeout(r, 20));
  delete global.__W;
  assert.equal(written.length, 1, '쓰기가 한 번이 아니다');
  assert.equal(written[0].p, 'fund_erp');
  const keys = Object.keys(written[0].up);
  assert.ok(keys.length >= 2);
  assert.ok(keys.every((k) => /^form_ok\/F1\/[a-z_]+$/.test(k) || /^prov\/F1\/[^/]+\/ok$/.test(k)), '자료 값을 건드리는 길이다: ' + keys);
  assert.ok(keys.includes('form_ok/F1/inka') && keys.includes('prov/F1/f|chairman/ok'));
  assert.ok(!keys.includes('prov/F1/f|address/ok'), '🤖 아닌 칸에 «원본과 맞음»을 붙인다');
  assert.equal(b.RV.at, 0, '확인함 숫자를 다시 안 센다'); assert.equal(b.FG.at, 0);
  assert.equal(b.SD.fcv, '', '확인한 뒤에도 한 서식 화면에 머문다');
});

test('★ 관문에서 «N칸 확인하고 …»를 누르면 — 🔴 는 form_ok 만, 🤖 는 prov ok, 이미 올린 목록은 비운다', async () => {
  const written = [], audits = [];
  const b = {};
  global.__W = written; global.__A = audits;
  new Function([
    "var S={_gate:null,user:'담당A',_oneGate:{x:1},_bundleGate:{x:1}}; var NS='fund_erp';",
    "var SD={fok:{}}, RV={at:5}, FG={at:5}; function toast(){} function _nowStamp(){ return '2026-11-08 09:00:00'; }",
    "function _audit(f,w,d){ __A.push([f,w,d]); } function _trProvRk(){ return 'rk'; } function _trEv(){} function _closeTopM(){}",
    "function _hwpOneDl(){} function _estabBundleHwpGo(){} function _docToHwpxRun(){} function printDoc(){}",
    "var window={open:function(){ return {}; }};",
    "var fbDb={ref:function(p){ return {update:function(up){ __W.push({p:p,up:up}); return Promise.resolve(); }}; }};",
    fnSrc('formGateOk'),
    'this.go=formGateOk; this.S=S; this.SD=SD;',
  ].join('\n')).call(b);
  b.S._gate = { fid: 'F1', after: 'hwpone', P: { 'f|chairman': { src: 'card' } },
    items: [{ key: 'f|chairman', lab: '대표자' }, { key: 'f|address', red: 1, how: 'new' }, { key: 's|s1|ceo', red: 1, how: 'chg' }],
    snaps: [{ kind: 'inka', v: { 'f|address': '#ab' } }, { kind: 'charter', v: {} }] };
  b.go();
  await new Promise((r) => setTimeout(r, 20));
  delete global.__W; delete global.__A;
  const keys = Object.keys(written[0].up);
  assert.ok(keys.includes('prov/F1/f|chairman/ok'), '🤖 칸에 «맞음»을 안 붙인다');
  assert.ok(!keys.some((k) => /^prov\/F1\/(f\|address|s\|s1\|ceo)\//.test(k)), '🔴 칸에 출처 기록(prov)을 쓴다');
  assert.ok(keys.includes('form_ok/F1/inka') && keys.includes('form_ok/F1/charter'), '확인 기록(form_ok)을 안 쓴다');
  assert.ok(keys.every((k) => /^(prov|form_ok)\//.test(k)), '그 밖의 곳을 쓴다: ' + keys);
  assert.match(audits[0][2], /새로·바뀐 칸 2/, '변경 기록에 새로·바뀐 칸 수가 없다');
  assert.equal(b.S._oneGate, null); assert.equal(b.S._bundleGate, null);
  assert.ok(b.SD.fok.F1 && b.SD.fok.F1.inka, '목록이 낡은 확인 기록을 쥔다');
});

/* ── 팝업이 기금 번호를 잃지 않는다 (2026-11-07 진행판 팝업 — funds[…] 값에는 _id 가 없다) ── */
test('★ 진행판 팝업은 기금 «번호»를 실어 연다 — 안 그러면 단추마다 undefined 로 나가 엉뚱한 곳에 쓴다', () => {
  let seen = null, rawBefore = null;
  const b = {};
  new Function([
    "var SD={sel:'F1',sites:{},pop:false,ci:{}}; var funds={F1:{name:'가'}};",
    "function ciLoad(){} function $(){ return null; } function ymd(){ return '2026-11-08'; }",
    "function _sdState(){ return {}; } function closeM(){} function showModal(){} function renderSetupDash(){}",
    "var S={view:'home'};",
    "function _sdBoard(f){ SEEN.f=f; return ''; }",
    fnSrc('sdPop'),
    'this.go=sdPop; this.funds=funds;',
  ].join('\n').replace(/SEEN/g, '__SEEN')).call(b);
  global.__SEEN = {};
  b.go();
  seen = global.__SEEN.f; delete global.__SEEN;
  assert.equal(seen && seen._id, 'F1', '팝업이 기금 번호 없이 진행판을 그린다');
  assert.ok(!('_id' in b.funds.F1), '원본 기금 자료에 _id 를 써 넣었다');
});

/* ── 배선 · 빨강은 화면 검토용 — 서식 본문에 안 들어간다 ── */
test('★ 빨강은 서식 본문(인쇄·PDF·한글)에 안 들어간다 — 서식을 만드는 함수는 이 기능을 모른다', () => {
  for (const fn of ['docBody', 'hwpFormHTML', 'hwpTplFill', 'printDoc', '_hwpValuesFor']) {
    const s = strip(fnSrc(fn));
    assert.ok(!/\b_fc[A-Z]|\bfcnew\b|\bfcchg\b|\bfcv\b|\bform_ok\b/.test(s), fn + ' 이 빨간 표시를 서식에 넣는다');
  }
  const css = SRC.slice(SRC.indexOf('.fcpaper{'), SRC.indexOf('.fcpaper{') + 1400);
  assert.match(css, /@media print\{[^}]*\.fcv\.fcnew[^}]*color:#000/, '인쇄하면 빨강이 검정으로 안 돌아간다');
  assert.match(css, /@media print\{[\s\S]*?\.fcold\{display:none\}/, '인쇄에 전 값 표시가 나간다');
});

test('★ 이 기능이 쓰는 곳은 [✔ 확인] 한 군데뿐 — 읽기만 하는 함수가 쓰지 않는다', () => {
  const a = SRC.indexOf('══ 🖨 서식 자동 채움'), z = SRC.indexOf('// ── 기금 설립 진행 (신규 기금 대시보드) ──');
  assert.ok(a > 0 && z > a);
  const blk = strip(SRC.slice(a, z));
  /* 배열에 담는 .push( 는 쓰기가 아니다 — 파이어베이스에 쓰는 길만 센다 */
  const w = blk.match(/\.(set|update|remove|transaction)\(/g) || [];
  assert.equal(w.length, 1, '쓰는 곳이 한 군데가 아니다: ' + w);
  assert.ok(!/fbDb\.ref\([^)]*\)\.push\(/.test(blk), '새 줄을 파이어베이스에 밀어 넣는 길이 있다');
  assert.ok(strip(fnSrc('fcOk')).includes("fbDb.ref(NS).update(up)"), '쓰는 곳이 fcOk 가 아니다');
});

test('★ 배선 — 목록 «서식» 칸 · 진행판 탭 · 세 관문(한 장·묶음 인쇄·한글 묶음)이 같은 🔴 를 쓴다', () => {
  const r = strip(fnSrc('renderSetupDash'));
  assert.ok(r.includes('_fcLoad(') && r.includes('_fcOf(') && r.includes('_fcChip('), '목록이 서식 칸을 안 그린다');
  assert.ok(/<th>서식<\/th>/.test(r), '표 머리에 «서식» 칸이 없다');
  const bd = strip(fnSrc('_sdBoard'));
  assert.ok(bd.includes("['fill',") && bd.includes('_fcTab(f,fc)') && bd.includes("hlp('setup.fill')"), '진행판에 서식 탭이 없다');
  assert.ok(/'setup\.fill':\{t:/.test(SRC), '도움말 항목이 없다');
  assert.ok(strip(fnSrc('estabBundle')).includes('_fcBundleRed(S._bundleGate'), '묶음 인쇄 관문에 🔴 를 안 붙인다');
  assert.ok(strip(fnSrc('_oneGatePrep')).includes('_fcGateRed([kind]'), '한 장 관문에 🔴 를 안 붙인다');
  assert.ok(strip(fnSrc('estabBundleHwp')).includes('_fcGateRed('), '한글 묶음 관문에 🔴 를 안 붙인다');
  assert.ok(strip(fnSrc('_gateModal')).includes('it.red'), '관문 창이 🔴 줄을 따로 안 그린다');
  const gk = strip(fnSrc('formGateOk'));
  assert.ok(gk.includes('it.red') && gk.includes("'form_ok/'"), '관문 확인이 확인 기록을 안 쓴다');
  for (const fn of ['estabBundlePrint', 'docPrintGated', 'hwpSideDownload', 'docToHwpx']) assert.ok(strip(fnSrc(fn)).includes('snaps:G.snaps'), fn + ' 이 확인 기록을 관문에 안 실어 보낸다');
  assert.ok(strip(fnSrc('estabBundleHwp')).includes('snaps:R.snaps'));
  /* 틀 고정이 되살아나지 않는다 · 폰에서 탭은 한 줄 */
  assert.ok(/@media\(max-width:\d+px\)\{\s*\.row\.sdtabs\{[^}]*flex-wrap:nowrap/.test(SRC), '폰에서 탭이 한 줄이 아니다');
  /* 서식 단계 ↔ 묶음 이름 — 단계 이름이 바뀌면 여기서 먼저 운다 */
  const ph = Object.keys(new Function(lineSrc('FC_PH') + '\n;return FC_PH;')());
  ph.forEach((k) => assert.ok(SRC.includes("['" + k + "','"), 'ESTAB_PHASES 에 ' + k + ' 가 없다'));
});
