/* ⚖ 산재 사례 찾기 (대표 「진행」 → 목업 ㉮ 2026-10-11)

   ★ 못 박는 것
     ① 결과 낱말(인정·불인정·기각·취소)을 인정/불인정 갈래로 바르게 나눈다
     ② 요청 주소에 갈래별 경로·낱말(cq)·결과 거르기가 실린다
     ③ 공단 원문은 «글자로만» 넣는다(innerHTML 금지) — 원문에 꺾쇠가 섞여도 화면이 깨지지 않게
     ④ 우리 쪽에 «저장하지 않는다» — 이 모듈은 실시간DB·로컬 저장소에 손대지 않는다
     ⑤ 이알피: 산재 사건에만 단추가 뜨고, 붙이기는 기존 업무 메모 표(case_memos)를 쓴다
     ── 2026-11-11 (대표 「추천대로 진행」) ──
     ⑥ 찾는 말: 띄어쓰기 = 모두 · "따옴표" = 구절 · -낱말 = 빼기. 공단에는 «한 낱말»만 보내고 나머지는 받은 쪽에서 거른다
     ⑦ 판례에는 본문 검색 변수(cq)를 «안 보낸다» — 공공데이터포털 명세(15041878)에 없는 변수다. 화면이 그 사실을 밝힌다
     ⑧ 결과는 «공단 처분 기준» — 사업주가 원고로 보이는 판례는 초록을 빼고 「원고 확인」을 «보이는 글자»로 붙인다
     ⑨ 심사결정서 「취소만」은 「인정」으로 찾지 않는다(심사 결과에 「인정」은 없다) — 취소·일부취소를 받은 쪽에서 가른다
   node --test tests/sanjae-cases.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MOD = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-sanjae-cases.js'), 'utf8');
const ERP = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').split('\r\n').join('\n');
function load() {
  const ctx = { console, encodeURIComponent, String, Number, Object, Array, JSON };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(MOD, ctx);
  return ctx.PuSanjae;
}
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

test('★★ ① 결과 낱말 → 인정/불인정', () => {
  const P = load();
  [['인정', 'ok'], ['취소', 'ok'], ['불인정', 'no'], ['기각', 'no'], ['각하', 'no'], ['일부인정', 'ok'], ['', '']]
    .forEach(([w, v]) => assert.equal(P.verdict(w), v, w));
  const r = P.row({ accnum: 2016001, kinda: '불인정', kindb: '행정 사무원', kindc: '뇌혈관질환', noncontent: '주문\n신청인 ○○○의 …' }, 'jil');
  assert.equal(r.v, 'no'); assert.equal(r.no, '2016001'); assert.equal(r.c, '뇌혈관질환');
  assert.match(r.first, /^신청인/, '첫 줄은 「주문」 머리를 덜어 낸다');
});

test('★★ ② 요청 주소 — 갈래별 경로·낱말·결과', () => {
  const P = load();
  const u = P.url('KEY', 'jil', '뇌출혈 야간', '인정', 2);
  assert.match(u, /jilbyeongPstateInfoService\/getJilbyeongResultNaeyongPstate\?/);
  assert.match(u, /serviceKey=KEY/); assert.match(u, /_type=json/); assert.match(u, /pageNo=2/);
  assert.match(u, new RegExp('cq=' + encodeURIComponent('뇌출혈 야간').replace(/[%]/g, '%')));
  assert.match(u, new RegExp('kinda=' + encodeURIComponent('인정')));
  assert.match(P.url('K', 'pan', '', 'x', 1), /sjbPrecedentInfoService\/getSjbPrecedentNaeyongPstate\?.*kindA=x/);
  assert.match(P.url('K', 'sim', 'a', '', 1), /simsaPstateInfoService\/getSimsaResultNaeyongPstate\?/);
  assert.doesNotMatch(P.url('K', 'sim', '', '', 1), /cq=/, '낱말이 없으면 cq 를 안 붙인다');
});

test('★ 사건 제목 → 처음 찾을 낱말 (괄호·「산재」 같은 군말을 덜어 낸다)', () => {
  const P = load();
  assert.equal(P.guessQuery({ title: '[홍길동] 뇌출혈 산재 신청(가나상사)' }), '뇌출혈');
  assert.equal(P.guessQuery({ title: '' }), '');
});

test('★★★ ③ 공단 원문은 글자로만 넣는다', () => {
  const code = noComments(MOD);
  assert.match(code, /pre\.textContent = r\.text/, '★★★ 원문을 textContent 로 넣지 않습니다');
  assert.doesNotMatch(code, /innerHTML\s*=\s*(?!''|"")\S/,'★★★ 바깥 글을 innerHTML 로 넣습니다(빈 문자열로 비우는 것만 허용)');
});

test('★★ ④ 우리 쪽에 저장하지 않는다', () => {
  const code = noComments(MOD);
  ['firebase', 'localStorage', 'sessionStorage', 'dbSet', 'indexedDB'].forEach(w =>
    assert.ok(!code.includes(w), '★★ 이 모듈이 ' + w + ' 에 손댑니다 — 읽고 보여 줄 뿐이어야 합니다'));
});

test('★★ ⑤ 이알피 — 산재 사건에만 단추, 붙이기는 업무 메모 표', () => {
  assert.match(ERP, /<script src="js\/pu-sanjae-cases\.js\?v=\d+"><\/script>/, '모듈을 안 싣거나 캐시 번호가 없습니다');
  const a = ERP.indexOf('\nfunction CaseDetailModal(');
  const cd = ERP.slice(a, ERP.indexOf('\nfunction UnifiedDetailModal(', a));
  assert.match(cd, /erpIsInjuryCase\(c, t\) && window\.PuSanjae/, '★★ 산재 사건만 거르지 않습니다');
  assert.match(cd, /onAttach:function\(txt\)\{ erpCaseMemoAdd\(c\.id/, '붙이기가 업무 메모로 안 갑니다');
  const isInj = vm.runInNewContext('(' + ERP.slice(ERP.indexOf('function erpIsInjuryCase('), ERP.indexOf('\n}\n', ERP.indexOf('function erpIsInjuryCase(')) + 2) + ')');
  assert.equal(isInj({ typeCode: 'case-injury' }, null), true);
  assert.equal(isInj({ typeCode: 'case-wage' }, { short: '체불', name: '임금체불' }), false);
  assert.equal(isInj({ typeCode: 'x' }, { short: '산재', name: '산재등' }), true);
  const add = ERP.slice(ERP.indexOf('function erpCaseMemoAdd('), ERP.indexOf('\n}\n', ERP.indexOf('function erpCaseMemoAdd(')));
  assert.match(add, /dbSet\(CASE_MEMO_KEY/, '★★ 업무 메모 표(case_memos)에 안 씁니다');
  assert.match(add, /entityType: 'case_memo'/);
});

/* ───────── 2026-11-11 찾는 말 · 판례 본문 검색 없음 · 원고 확인 ───────── */

test('★★ ⑥ 찾는 말 — 띄어쓰기·따옴표·빼기', () => {
  const P = load();
  const j = (o) => JSON.parse(JSON.stringify(o));
  assert.deepEqual(j(P.parseQuery('뇌출혈 야간근무 -당뇨 "출퇴근 사고" -"기존 질환"')),
    { inc: ['뇌출혈', '야간근무', '출퇴근 사고'], exc: ['당뇨', '기존 질환'] });
  assert.deepEqual(j(P.parseQuery('')), { inc: [], exc: [] });
  assert.deepEqual(j(P.parseQuery(' - "닫지 않은 따옴표')), { inc: ['닫지', '않은', '따옴표'], exc: [] }, '줄표 하나·안 닫힌 따옴표에 죽지 않는다');
  assert.deepEqual(j(P.parseQuery('“둥근 따옴표”')), { inc: ['둥근 따옴표'], exc: [] }, '폰 자판의 둥근 따옴표도 구절이다');

  // 공단에는 «한 낱말»만 — 그 낱말은 꼭 들어야 할 말 가운데 하나다
  const pl = P.plan('jil', '뇌출혈 야간근무 -당뇨', '');
  assert.ok(pl.p.inc.includes(pl.sent), '공단에 보내는 말이 찾는 말에 없습니다');
  assert.ok(!/\s/.test(pl.sent), '띄어 쓴 말을 통째로 보내면 공단은 그 글자 그대로만 찾습니다');
  assert.ok(pl.scan && pl.size > P.plan('jil', '뇌출혈', '').size, '★★ 받은 쪽에서 거를 때는 한 번에 더 받아 살펴야 합니다');
  assert.equal(P.plan('jil', '뇌출혈', '').scan, false, '낱말 하나면 공단이 다 찾는다 — 더 받을 까닭이 없다');
  assert.equal(P.plan('sim', '"최초 요양"', '').sent, '최초 요양', '구절뿐이면 구절을 보낸다');

  // 받은 쪽에서 거르기 — 띄어쓰기는 무시, 빼는 말이 든 줄은 뺀다
  const rows = [
    P.row({ accnum: 1, kinda: '인정', noncontent: '뇌출혈 … 야간 근무가 잦았고' }, 'jil'),
    P.row({ accnum: 2, kinda: '인정', noncontent: '뇌출혈 … 야간근무 … 당뇨 병력' }, 'jil'),
    P.row({ accnum: 3, kinda: '인정', noncontent: '뇌출혈 … 주간 근무' }, 'jil')
  ];
  const sentOnly = P.plan('jil', '뇌출혈 야간근무 -당뇨', '');
  // 공단은 «보낸 말»로 걸러 준다고 보고, 나머지(뇌출혈)와 빼는 말(당뇨)을 여기서 본다
  assert.deepEqual(P.pick(rows.filter(r => /야간\s*근무/.test(r.text)), sentOnly).map(r => r.no), ['1']);
  assert.deepEqual(P.pick(rows, P.plan('jil', '뇌출혈 주간근무', '')).map(r => r.no).includes('3'), true);
});

test('★★★ ⑦ 판례에는 본문 검색 변수를 안 보낸다 — 명세에 없는 변수', () => {
  const P = load();
  assert.doesNotMatch(P.url('K', 'pan', '뇌출혈', '', 1), /[?&]cq=/, '★★★ 판례에 cq 를 보냅니다 — 명세에 없어 무엇을 넣어도 같은 목록이 옵니다');
  assert.match(P.url('K', 'jil', '뇌출혈', '', 1), /[?&]cq=/);
  assert.match(P.url('K', 'sim', '뇌출혈', '', 1), /[?&]cq=/);
  const pl = P.plan('pan', '뇌출혈', '');
  assert.equal(pl.sent, '', '판례는 공단에 보낼 말이 없다');
  assert.ok(pl.scan, '★★ 판례는 낱말이 있으면 받은 쪽에서 걸러야 한다(안 거르면 낱말과 무관한 목록이 뜬다)');
  const rows = [P.row({ accnum: 'A', kindA: '기각', noncontent: '뇌출혈로 쓰러져' }, 'pan'), P.row({ accnum: 'B', kindA: '기각', noncontent: '추락 사고' }, 'pan')];
  assert.deepEqual(P.pick(rows, pl).map(r => r.no), ['A']);
  // 화면이 그 사실을 밝힌다
  assert.ok(P.noteOf(pl).some(t => /본문 검색/.test(t)), '★★ 판례는 받은 쪽에서만 거른다는 안내가 없습니다');
  assert.ok(P.noteOf(P.plan('pan', '', '')).some(t => /처분 기준/.test(t)), '판례 결과가 공단 처분 기준이라는 안내가 없습니다');
  assert.equal(P.noteOf(P.plan('jil', '뇌출혈', '')).length, 0, '거를 것이 없으면 안내도 없다');
  assert.match(P.countText(35000, 100, 3, pl), /100.*3/, '몇 건을 살펴 몇 건인지 보여 준다');
});

test('★★ ⑧ 사업주가 원고로 보이는 판례 — 초록을 빼고 「원고 확인」', () => {
  const P = load();
  assert.equal(P.employerSuit('원 고  ○○○ 주식회사\n피 고  근로복지공단'), true);
  assert.equal(P.employerSuit('원고 주식회사 ○○\n피고 근로복지공단'), true);
  assert.equal(P.employerSuit('원고 ○○○\n피고 근로복지공단\n피고보조참가인 ○○○'), true, '근로자가 참가인으로 들어온 사건');
  assert.equal(P.employerSuit('원고 ○○○\n피고 근로복지공단\n이 유\n원고는 주식회사 ○○ 소속 근로자로서'), false, '★ 본문 문장에 걸리면 판례 대부분에 경고가 붙는다');
  assert.equal(P.employerSuit('원고 ○○○ (소송대리인 법무법인 ○○)\n피고 근로복지공단'), false);
  assert.equal(P.row({ accnum: 1, kindA: '취소', noncontent: '원고 주식회사 ○○\n피고 근로복지공단' }, 'pan').chk, true);
  assert.equal(P.row({ accnum: 1, kinda: '인정', noncontent: '원고 주식회사 ○○' }, 'jil').chk, false, '질병판정서에는 원고가 없다');
});

test('★★ ⑨ 결과 거르기 — 갈래마다 공단 낱말이 다르다', () => {
  const P = load();
  assert.notEqual(P.plan('sim', '', 'ok').resWord, '인정', '★★ 심사결정서를 「인정」으로 찾습니다 — 심사 결과에 없는 낱말이라 0건이 됩니다');
  const sim = ['취소', '일부취소', '기각', '각하', '취하'].map((w, i) => P.row({ accnum: i, kinda: w, noncontent: 'x' }, 'sim'));
  assert.deepEqual(P.pick(sim, P.plan('sim', '', 'ok')).map(r => r.res), ['취소', '일부취소']);
  assert.deepEqual(P.pick(sim, P.plan('sim', '', 'no')).map(r => r.res), ['기각', '각하']);
  // 질병판정서 — 공단이 「인정」에 「불인정」을 섞어 줘도 화면에는 인정만
  const jil = ['인정', '불인정', '일부인정'].map((w, i) => P.row({ accnum: i, kinda: w, noncontent: 'x' }, 'jil'));
  assert.equal(P.plan('jil', '', 'ok').resWord, '인정');
  assert.deepEqual(P.pick(jil, P.plan('jil', '', 'ok')).map(r => r.res), ['인정', '일부인정']);
  assert.notEqual(P.resLabels('jil').ok, P.resLabels('pan').ok, '판례·심사결정서 단추를 「인정만」이라 부르면 처분 기준을 근로자 기준으로 읽게 된다');
});

/* 가짜 화면 — «보이는 글자»만 모은다(말풍선 title 은 세지 않는다) */
function fakeDom() {
  const mk = (tag) => ({ tag, kids: [], attrs: {}, on: {}, style: {}, _t: null,
    setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, f) { this.on[k] = f; },
    appendChild(c) { this.kids.push(c); c.parent = this; return c; },
    remove() { if (this.parent) this.parent.kids = this.parent.kids.filter(k => k !== this); },
    set innerHTML(v) { this.kids = []; }, get innerHTML() { return ''; },
    set textContent(v) { this._t = String(v); this.kids = []; }, get textContent() { return this._t; } });
  const body = mk('body');
  const all = (n, out) => { out.push(n); (n.kids || []).forEach(k => all(k, out)); return out; };
  const text = (n) => n.text != null ? n.text : (n._t != null ? n._t : (n.kids || []).map(text).join(' '));
  return { body, text, all: () => all(body, []),
    document: { body, createElement: mk, createTextNode: (t) => ({ text: String(t) }), addEventListener() {},
      getElementById: (id) => all(body, []).find(n => n.attrs && n.attrs.id === id) || null } };
}
async function screen(opts, items, total) {
  const D = fakeDom(), urls = [];
  const ctx = { console, encodeURIComponent, String, Number, Object, Array, JSON, Promise, document: D.document, PU_CFG: { ntsKey: 'K' },
    fetch: (u) => { urls.push(u); return Promise.resolve({ ok: true, json: () => Promise.resolve({ response: { body: { totalCount: total, items: { item: items } } } }) }); } };
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(MOD, ctx);
  ctx.PuSanjae.open(opts);
  for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r));
  return { D, urls, P: ctx.PuSanjae, settle: async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); } };
}

test('★★★ ⑦⑧ 화면 — 판례: cq 없이 받고, 낱말이 든 줄만 보이고, 원고 확인이 «보인다»', async () => {
  const items = [
    { accnum: '2020구단111', courtname: '서울행정법원', kindA: '취소', kindB: '요양', kindC: '업무상질병', noncontent: '원고 주식회사 ○○\n피고 근로복지공단\n뇌출혈 요양승인처분을 취소한다' },
    { accnum: '2020구단222', courtname: '서울행정법원', kindA: '취소', kindB: '요양', kindC: '업무상질병', noncontent: '원고 ○○○\n피고 근로복지공단\n뇌출혈 불승인처분을 취소한다' },
    { accnum: '2020구단333', courtname: '서울행정법원', kindA: '기각', kindB: '장해', kindC: '업무상사고', noncontent: '원고 ○○○\n피고 근로복지공단\n추락 사고' }
  ];
  const s = await screen({ kind: 'pan', q: '뇌출혈' }, items, 35000);
  assert.ok(s.urls.length >= 1, '공단을 부르지 않았습니다');
  assert.doesNotMatch(s.urls[0], /[?&]cq=/, '★★★ 판례 요청에 cq 가 실렸습니다');
  const seen = s.D.text(s.D.body);
  assert.ok(seen.includes('2020구단111') && seen.includes('2020구단222'), '낱말이 든 판례가 안 보입니다');
  assert.ok(!seen.includes('2020구단333'), '★★ 낱말이 없는 판례가 그대로 보입니다(받은 쪽에서 안 걸렀다)');
  assert.match(seen, /본문 검색/, '★★ 판례는 받은 쪽에서만 거른다는 안내가 화면에 없습니다');
  assert.match(seen, /처분 기준/, '★★ 공단 처분 기준 안내가 화면에 없습니다');
  // 사업주 원고로 보이는 줄에만 ⚠ — 결과 칸의 «보이는 글자»
  const cell = (no) => { const rowEl = s.D.all().find(n => n.on && n.on.click && n.kids && n.kids.length === 4 && s.D.text(n).includes(no)); return s.D.text(rowEl.kids[1]); };
  assert.match(cell('2020구단111'), /⚠/, '★★ 사업주 원고로 보이는 판례에 표시가 없습니다');
  assert.doesNotMatch(cell('2020구단222'), /⚠/, '근로자가 원고인 판례에까지 표시가 붙었습니다');
  // 줄을 열면 까닭이 글자로 보인다
  s.D.all().find(n => n.on && n.on.click && n.kids && n.kids.length === 4 && s.D.text(n).includes('2020구단111')).on.click();
  assert.match(s.D.text(s.D.body), /원고를 확인/, '★★ 연 화면에 「원고를 확인」 안내가 없습니다');
});

test('★★ ⑥ 화면 — 질병판정서: 한 낱말만 공단에, 나머지는 받은 쪽에서', async () => {
  const items = [
    { accnum: 1001, kinda: '인정', kindb: '경비원', kindc: '뇌혈관질환', noncontent: '뇌출혈 … 야간근무 … ' },
    { accnum: 1002, kinda: '인정', kindb: '경비원', kindc: '뇌혈관질환', noncontent: '뇌출혈 … 야간근무 … 당뇨 병력' },
    { accnum: 1003, kinda: '불인정', kindb: '사무원', kindc: '뇌혈관질환', noncontent: '야간근무 … 뇌경색' }
  ];
  const s = await screen({ kind: 'jil', q: '뇌출혈 야간근무 -당뇨' }, items, 240);
  const cq = decodeURIComponent((s.urls[0].match(/[?&]cq=([^&]*)/) || [])[1] || '');
  assert.ok(['뇌출혈', '야간근무'].includes(cq), '★★ 공단에 낱말 하나가 아니라 「' + cq + '」 를 보냈습니다');
  const seen = s.D.text(s.D.body);
  assert.ok(seen.includes('1001'), '맞는 판정서가 안 보입니다');
  assert.ok(!seen.includes('1002'), '★★ 빼는 말(-당뇨)이 든 판정서가 보입니다');
  assert.ok(!seen.includes('1003'), '★★ 모두 들어야 할 말(뇌출혈)이 없는 판정서가 보입니다');
  assert.match(seen, /받은 \d+건 안에서/, '받은 쪽에서 걸렀다는 안내가 없습니다');
});
