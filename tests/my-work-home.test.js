'use strict';
/* 📋 «내 업무»는 업무관리 한 곳 — 포털 머리줄 단추 · 이알피 「나의 업무」 2단계 (대표 지시 2026-11-21 「추천대로」)
   ─────────────────────────────────────────────────────────────────────────
   대표 물음: 「나의 업무와 업무관리가 중복되는 것 같다」 → 「추천대로 하고 … 로그인하면 자기 업무 위주로 …
   개별 로그인했던 사람이 정확하게 한 번에 보고 클릭해서 자기 업무만 확인할 수 있게」.

   ★ 이 검사가 지키는 것 (값이 아니라 규칙)
     ① 숫자 한 줄(js/pu-mywork.js) — 날짜로 남기고 «오늘»로 다시 센다 · 못 믿을 값(없음·오래됨·시계 앞섬)은 null(못 받음 ≠ 0건)
     ② 업무관리가 적는다 — «내 몫» 한 줄만 · 이번 주를 볼 때만 · 바뀐 것이 없으면 다시 안 적는다 · 진행은 이관 계약·자문을 뺀다
     ③ 일반업무·업무케이스 옮기기 — 원본(data/…)은 안 건드린다 · 끝난 것·옮긴 것은 빼고 · 한 번의 update ·
        이알피 «종료 동기화» 표식(src:'puerp'·ref)을 안 붙인다 · 업체는 companyId 가 있을 때만 · 담당 이름은 «하나로 정해질 때만» 사번
     ④ 이알피·포털이 여는 주소(#new·#erpmove·#peimport·#f=)를 업무관리가 받는다
     ⑤ 포털 — 업무관리는 머리줄 단추(head) · 숫자는 그 사람 몫 한 줄만 읽는다(업무 목록 통째를 안 읽는다) · 사람이 바뀌면 앞사람 숫자를 버린다
     ⑥ 이알피 「나의 업무」 — 업무를 «만드는» 단추가 없다 · 업무관리 목록을 못 읽었으면 «업무관리에 없음»을 세지 않는다
     ⑦ 길잡이 챗봇이 «자료함에 업무관리»라고 옛 말을 하지 않는다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const WORK = read('work.html');
const ENTER = read('enter.html');
const ERP = read('pu-erp.html');
const KB = read('js/pu-chatbot-kb.js');
const M = require('../js/pu-mywork.js');

/* head 로 시작하는 곳부터 짝이 맞는 닫는 중괄호까지 — 따옴표 안의 괄호는 센다에서 뺀다 */
function 몸(src, head) {
  const at = src.indexOf(head);
  assert.ok(at >= 0, head + ' 를 못 찾았다');
  let i = src.indexOf('{', at), d = 0, q = '';
  for (; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') { i++; continue; } if (ch === q) q = ''; continue; }
    if (ch === '\'' || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '{') d++;
    else if (ch === '}') { d--; if (!d) return src.slice(at, i + 1); }
  }
  throw new Error('짝을 못 맞춤: ' + head);
}
const 함수 = (src, name) => 몸(src, 'function ' + name + '(');
const 줄 = (src, head) => { const a = src.indexOf(head); assert.ok(a >= 0, head + ' 줄이 없다'); return src.slice(a, src.indexOf('\n', a)); };

/* ═════ ① 숫자 한 줄 ═════ */
test('① 자리 — 사번 하나에 한 줄 · 열쇠에 못 쓰는 글자는 바꾼다 · 사번이 없으면 자리도 없다', () => {
  assert.equal(M.pathOf('P-001'), M.PATH + '/P-001');
  assert.ok(M.PATH.indexOf('work_erp/') === 0, '★ 업무관리 자리(work_erp) 밖에 적는다 — 규칙이 다른 자리다');
  assert.ok(!/[.#$\[\]]/.test(M.pathOf('a.b#c$d[e]').slice(M.PATH.length + 1)), '열쇠에 못 쓰는 글자가 남는다');
  assert.equal(M.pathOf(''), '');
  assert.equal(M.pathOf(null), '');
});

test('①★ 임박·할 일은 «날짜»로 남기고 읽는 날의 «오늘»로 다시 센다 — 업무관리를 어제 열었어도 맞다', () => {
  const now = Date.parse('2026-11-21T09:00:00+09:00');
  const sum = M.build({ n: 12, dues: ['2026-11-19', '2026-11-28', '2026-11-29', '엉터리'], nexts: ['2026-11-21', '2026-11-22'],
    nolog: 5, ws: '2026-11-16', we: '2026-11-22', now });
  const c = M.counts(sum, '2026-11-21', now);
  assert.equal(c.open, 12);
  assert.equal(c.due, 2, '★ 7일 안·지난 기한을 못 센다(업무관리 focusCounts 와 같은 잣대: dday<=7)');
  assert.equal(c.next, 1, '★ 오늘까지의 다음 할 일만 세야 한다');
  assert.equal(c.nolog, 5);
  /* 다음 날 — 같은 한 줄인데 오늘이 바뀌면 숫자가 따라 바뀐다 */
  const c2 = M.counts(sum, '2026-11-22', now + 86400000);
  assert.equal(c2.due, 3, '★ 날이 바뀌어도 어제 숫자를 그대로 쓴다');
  assert.equal(c2.next, 2);
  /* 다음 주 — 「미기록」은 그 주 안에서만 뜻이 있다 */
  assert.equal(M.counts(sum, '2026-11-23', now + 2 * 86400000).nolog, null, '★ 지난주 미기록을 이번 주 것처럼 보인다');
  assert.ok(sum.dd.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)), '날짜가 아닌 값이 한 줄에 들어간다');
});

test('①★ 못 믿을 값은 null — 숫자를 «안 보인다»(못 받음 ≠ 0건)', () => {
  const now = Date.parse('2026-11-21T09:00:00+09:00');
  assert.equal(M.counts(null, '2026-11-21', now), null);
  assert.equal(M.counts(undefined, '2026-11-21', now), null);
  assert.equal(M.counts('글자', '2026-11-21', now), null);
  assert.equal(M.counts({ n: 3 }, '2026-11-21', now), null, '언제 적었는지 모르는 값을 믿는다');
  const old = M.build({ n: 3, now: now - (M.STALE_DAYS + 1) * 86400000 });
  assert.equal(M.counts(old, '2026-11-21', now), null, '★ 오래전에 적힌 숫자를 지금 것처럼 보인다');
  const fresh = M.build({ n: 3, now: now - (M.STALE_DAYS - 1) * 86400000 });
  assert.ok(M.counts(fresh, '2026-11-21', now), '기한 안의 값은 보여야 한다');
  const future = M.build({ n: 3, now: now + 3 * 86400000 });
  assert.equal(M.counts(future, '2026-11-21', now), null, '시계가 엉뚱하게 앞선 값을 믿는다');
});

test('① 바뀐 것이 없으면 «같다» — 적은 시각만 다른 것은 다시 안 적는다', () => {
  const a = M.build({ n: 2, dues: ['2026-11-25'], now: 1 });
  const b = M.build({ n: 2, dues: ['2026-11-25'], now: 999999 });
  const c = M.build({ n: 3, dues: ['2026-11-25'], now: 1 });
  assert.equal(M.same(a, b), true);
  assert.equal(M.same(a, c), false);
  assert.equal(M.same(null, a), false);
  const big = M.build({ n: 1, dues: Array.from({ length: 5000 }, () => '2026-11-25'), now: 1 });
  assert.ok(big.dd.length < 5000, '★ 날짜 수에 한도가 없다 — 이상한 값이 서버 자리를 키운다');
});

test('① 한 줄 풀이 — 진행은 늘, 임박·할 일은 있을 때만', () => {
  assert.match(M.line({ open: 4, due: 0, next: 0 }), /^진행 4$/);
  const l = M.line({ open: 4, due: 2, next: 1 });
  assert.ok(/진행 4/.test(l) && /임박 2/.test(l) && /할 일 1/.test(l), l);
  assert.equal(M.line(null), '');
});

/* ═════ ② 업무관리가 적는다 ═════ */
function 적기놀이터(o) {
  const 적음 = [];
  const ctx = {
    window: { PuMyWork: M }, S: { me: o.me === undefined ? { sid: 'P-001', name: '나' } : o.me },
    fbDb: { ref: (p) => ({ set: (v) => { 적음.push({ p, v }); return Promise.resolve(); } }) },
    isCurWeek: () => o.cur !== false,
    openItems: () => o.items,
    xferOf: (it) => !!it.xfer, wsAdv: (it) => !!it.adv,
    curMonday: () => new Date(2026, 10, 16), Date,
  };
  vm.createContext(ctx);
  ['pad', 'ymd', 'addDays', 'isOf', 'itemDue'].forEach((n) => vm.runInContext(함수(WORK, n), ctx));
  vm.runInContext('var _mysumLast=null, _mysumBusy=false, _mysumAgain=null;\n' + 함수(WORK, 'mysumWrite'), ctx);
  return { ctx, 적음 };
}
const 흘려보내기 = () => new Promise((r) => setImmediate(r));
const 내것 = (x) => Object.assign({ mgr_main: { sid: 'P-001', name: '나' } }, x);

test('②★ «내 몫» 한 줄만 · 진행은 이관 계약·자문을 빼고 · 기한·다음 할 일 날짜는 내 진행 업무 모두에서', async () => {
  const items = [
    내것({ due: '2026-11-25' }),
    내것({ next: { date: '2026-11-21', t: '전화' } }),
    내것({ xfer: true, due: '2026-11-30' }),          // 이관한 계약 — 진행 셈에서 빠진다
    내것({ adv: true }),                              // 자문 — 진행 셈에서 빠진다
    { mgr_main: { sid: 'P-009', name: '남' }, due: '2026-11-22' },   // 남의 것
    { mgr_main: { sid: 'P-009', name: '남' }, mgr_subs: [{ sid: 'P-001', name: '나' }], due: '2026-11-24' },   // 부담당 = 내 것
  ];
  const g = 적기놀이터({ items });
  g.ctx.mysumWrite({ nolog: [1, 2] });
  await 흘려보내기();
  assert.equal(g.적음.length, 1);
  assert.equal(g.적음[0].p, M.pathOf('P-001'), '★ 내 자리가 아닌 곳에 적는다');
  const v = g.적음[0].v;
  assert.equal(v.n, 3, '★ 진행 셈이 업무관리 머리 숫자와 다르다(이관 계약·자문 빼기, 부담당 넣기)');
  assert.ok(v.dd.indexOf('2026-11-22') < 0, '★ 남의 업무 기한이 내 숫자에 섞인다');
  assert.ok(v.dd.indexOf('2026-11-24') >= 0 && v.dd.indexOf('2026-11-25') >= 0, '내 업무 기한이 빠진다');
  assert.ok(v.nx.indexOf('2026-11-21') >= 0, '다음 할 일 날짜가 빠진다');
  assert.equal(v.nl, 2);
  assert.ok(v.ws <= v.we, '이번 주 시작·끝이 없다');
});

test('② 바뀐 것이 없으면 다시 안 적는다 · 지난주를 보는 동안은 안 적는다 · 누구인지 모르면 안 적는다', async () => {
  const items = [내것({ due: '2026-11-25' })];
  const g = 적기놀이터({ items });
  g.ctx.mysumWrite({ nolog: [] }); await 흘려보내기();
  g.ctx.mysumWrite({ nolog: [] }); await 흘려보내기();
  assert.equal(g.적음.length, 1, '★ 화면을 다시 그릴 때마다 서버에 적는다');
  items.push(내것({ due: '2026-11-26' }));
  g.ctx.mysumWrite({ nolog: [] }); await 흘려보내기();
  assert.equal(g.적음.length, 2, '★ 업무가 늘었는데 다시 안 적는다');

  const past = 적기놀이터({ items, cur: false });
  past.ctx.mysumWrite({ nolog: [] }); await 흘려보내기();
  assert.equal(past.적음.length, 0, '★ 지난주를 보는 동안 적는다 — 미기록이 «그 주» 숫자로 바뀐다');

  const nobody = 적기놀이터({ items, me: { sid: '', name: '' } });
  nobody.ctx.mysumWrite({ nolog: [] }); await 흘려보내기();
  assert.equal(nobody.적음.length, 0, '★ 누구인지 모르는데 적는다');
});

test('② 「내 업무」를 그릴 때 적는다 — 머리 숫자를 셈한 «바로 그 자리»에서', () => {
  const my = 함수(WORK, 'renderMy');
  const a = my.indexOf('var fc=focusCounts();'), b = my.indexOf('mysumWrite(fc)');
  assert.ok(a >= 0 && b > a, '★ renderMy 가 숫자 한 줄을 안 적는다(또는 셈하기 전에 적는다)');
  assert.ok(b > my.indexOf('xferRefresh();'), '이관 계약을 알아보기(xferRefresh) 전에 적으면 진행 셈이 틀린다');
});

/* ═════ ③ 일반업무·업무케이스 옮기기 ═════ */
function 옮기기놀이터(o) {
  const 원본 = o.원본, 보냄 = [], 읽음 = [], 메시지 = { textContent: '' };
  const ctx = {
    S: { me: o.me || { sid: 'P-001', name: '나', title: '' }, year: 2026 },
    NS: 'work_erp', items: {}, MV_STORES: null, MV_TYPE: null,
    _allStaffCache: o.명부 || [{ sid: 'P-001', name: '나' }, { sid: 'P-002', name: '둘' }, { sid: 'P-003', name: '같은이름' }, { sid: 'P-004', name: '같은이름' }],
    _staffCache: null,
    isAdmin: () => !!o.관리자,
    allItems: () => (o.있는것 || []).map((x, i) => Object.assign({ _id: 'W' + i }, x)),
    fbDb: {
      ref: (p) => ({
        once: () => { 읽음.push(p); const k = p.replace(/^data\//, '').replace(/\/v$/, ''); return o.읽기실패 && o.읽기실패[k] ? Promise.reject(new Error('막힘')) : Promise.resolve({ val: () => 원본[k] }); },
        update: (up) => { 보냄.push(up); return o.쓰기실패 ? Promise.reject(new Error('규칙')) : Promise.resolve(); },
      }),
    },
    todayStr: () => '2026-11-21', genNo: () => '2026-기타-007', rid: (() => { let n = 0; return () => 'Wnew' + (++n); })(),
    $: (id) => (id === 'mv-msg' ? 메시지 : null), document: { querySelectorAll: () => (o.고름 || []) },
    closeM() {}, toast() {}, route() {}, Promise,
  };
  vm.createContext(ctx);
  ['isOf', '_peArr', 'briefTrim', 'mvClosed', 'mvWho', 'mvDoneMap', 'mvCandidates', 'mvRecord', 'erpMoveRun']
    .forEach((n) => vm.runInContext(함수(WORK, n), ctx));
  vm.runInContext(줄(WORK, 'var BRIEF_MAX=') + '\n' + 줄(WORK, 'var MV_STORES=') + '\n' + 몸(WORK, 'var MV_TYPE=') + ';', ctx);
  return { ctx, 보냄, 읽음, 메시지 };
}
const 원본보기 = () => ({
  my_work_items: [
    { id: 'w1', sid: 'P-001', title: '퇴직금 상담', workType: 'consult', companyName: '가나', status: 'open', detail: '상세'.repeat(60), result: '안내함', dueDate: '2026-11-30' },
    { id: 'w2', sid: 'P-001', title: '끝난 일', status: 'closed' },
    { id: 'w3', sid: 'P-001', title: '보관함 것', status: 'open', archived: true },
    { id: 'w4', sid: 'P-001', title: '휴지통', status: 'open', _deleted: true },
    { id: 'w5', sid: 'P-002', title: '남의 일반업무', status: 'open' },
    { id: 'w6', sid: 'P-001', title: '이미 옮김', status: 'open' },
  ],
  biz_cases: {
    a: { id: 'b1', managerMain: 'P-001', managerSubs: ['P-002'], caseType: 'labor-office', title: '진정 대응', companyName: '다라', companyId: 'CO-9', status: 'open' },
    b: { id: 'b2', managerMain: '같은이름', title: '이름만 담당(둘이 같은 이름)', status: 'open' },
    c: { id: 'b3', managerMain: '둘', title: '이름만 담당(하나뿐)', status: 'open' },
    d: { id: 'b4', managerMain: 'P-001', title: '끝남', closedDate: '2026-10-01' },
  },
});

test('③★ 후보 — 끝난 것·보관함·휴지통·이미 옮긴 것은 빼고, 직원은 «내 것»만 · 관리자는 전 직원', async () => {
  const 있는것 = [{ mv: { store: 'my_work_items', id: 'w6' } }];
  const me = await 옮기기놀이터({ 원본: 원본보기(), 있는것 }).ctx.mvCandidates();
  const ids = me.list.map((c) => c.id).sort().join(',');   // vm 안의 배열은 바깥 배열과 «다른 집» — 글자로 견준다
  assert.equal(ids, 'b1,w1', '★ 직원 화면 후보가 틀리다: ' + ids);
  const adm = await 옮기기놀이터({ 원본: 원본보기(), 있는것, 관리자: true }).ctx.mvCandidates();
  const aids = adm.list.map((c) => c.id);
  ['w1', 'w5', 'b1', 'b2', 'b3'].forEach((id) => assert.ok(aids.indexOf(id) >= 0, '관리자 후보에 ' + id + ' 가 없다'));
  ['w2', 'w3', 'w4', 'w6', 'b4'].forEach((id) => assert.ok(aids.indexOf(id) < 0, '★ 옮기면 안 될 ' + id + ' 가 후보에 있다'));
  assert.equal(adm.list[0].mine, true, '내 것이 위로 와야 한다');
});

test('③★ 담당 이름만 있는 옛 자료 — «하나로 정해질 때만» 사번을 붙인다(지어내지 않는다)', async () => {
  const r = await 옮기기놀이터({ 원본: 원본보기(), 관리자: true }).ctx.mvCandidates();
  const by = (id) => r.list.filter((c) => c.id === id)[0];
  assert.deepEqual(JSON.parse(JSON.stringify(by('b3').main)), { sid: 'P-002', name: '둘' });
  assert.equal(by('b2').main.sid, '', '★ 같은 이름이 둘인데 아무 사번이나 붙였다');
  assert.equal(by('b1').subs.length, 1, '부담당이 빠진다');
});

test('③★ 원본을 못 읽은 곳은 «없다»로 치지 않고 알린다', async () => {
  const r = await 옮기기놀이터({ 원본: 원본보기(), 읽기실패: { biz_cases: true } }).ctx.mvCandidates();
  assert.ok(r.fail.length === 1, '못 읽은 곳을 안 알린다');
  assert.ok(r.list.every((c) => c.store !== 'biz_cases'));
});

test('③★ 옮기기 — 한 번의 update · work_erp/items 아래만 · 원본(data/…)은 안 건드린다 · 종료 동기화 표식을 안 붙인다', async () => {
  const g = 옮기기놀이터({ 원본: 원본보기(), 관리자: true });
  const r = await g.ctx.mvCandidates();
  g.ctx.S._mvList = r.list;
  const pick = ['w1', 'b1'].map((id) => ({ checked: true, value: String(r.list.findIndex((c) => c.id === id)) }));
  g.ctx.document.querySelectorAll = () => pick;
  g.ctx.erpMoveRun();
  await 흘려보내기();
  assert.equal(g.보냄.length, 1, '★ 여러 번 나눠 쓴다 — 중간에 실패하면 반쯤 옮겨진다');
  const keys = Object.keys(g.보냄[0]);
  assert.equal(keys.length, 2);
  keys.forEach((k) => assert.match(k, /^work_erp\/items\/[^/]+$/, '★ 업무관리 업무 자리 밖에 쓴다: ' + k));
  const recs = keys.map((k) => g.보냄[0][k]);
  recs.forEach((v) => {
    assert.ok(v.mv && v.mv.store && v.mv.id, '★ 어디서 옮겼는지(mv)가 없다 — 두 번 옮겨지고 이알피가 «옮겼다»를 모른다');
    assert.equal(v.src, undefined, '★ src 를 붙였다 — 이알피 종료 동기화가 원본을 건드린다');
    assert.equal(v.ref, undefined, '★ ref 를 붙였다 — 이알피 종료 동기화가 원본을 건드린다');
    assert.equal(v.entityType, 'Task');
    assert.ok(v.id && v.createdAt && v.updatedAt, '온톨로지 칸(id·createdAt·updatedAt)이 없다');
    assert.ok(v.mgr_main && v.mgr_main.sid, '담당 사번이 없다');
  });
  assert.notEqual(recs[0].no, recs[1].no, '★ 한 번에 옮긴 것들이 같은 관리번호를 받는다');
  const w1 = recs.filter((v) => v.mv.id === 'w1')[0], b1 = recs.filter((v) => v.mv.id === 'b1')[0];
  assert.equal(w1.co_id, undefined, '★ 업체 id 가 없는데 co_id 를 지어냈다(이름으로 짐작 금지)');
  assert.equal(b1.co_id, 'CO-9');
  /* 원본 전문은 잘리지 않고 서랍 옛 메모에 남는다 */
  const note = w1.pe_notes && Object.keys(w1.pe_notes).map((k) => w1.pe_notes[k])[0];
  assert.ok(note && note.t.indexOf('안내함') >= 0 && note.t.length > w1.brief.length, '★ 원본 내용·결과 전문이 사라진다');
  assert.ok(g.읽음.every((p) => /^data\/(my_work_items|biz_cases)\/v$/.test(p)), '원본 두 곳 말고 다른 데를 읽는다');
});

test('③ 쓰기에 실패하면 아무것도 안 바뀐 것으로 둔다 · 그 사이 옮겨진 것은 다시 안 옮긴다', async () => {
  const g = 옮기기놀이터({ 원본: 원본보기(), 쓰기실패: true });
  const r = await g.ctx.mvCandidates();
  g.ctx.S._mvList = r.list;
  g.ctx.document.querySelectorAll = () => [{ checked: true, value: '0' }];
  g.ctx.erpMoveRun();
  await 흘려보내기(); await 흘려보내기();
  assert.equal(Object.keys(g.ctx.items).length, 0, '★ 서버에 못 썼는데 화면에는 옮겨진 것처럼 보인다');
  assert.ok(/못/.test(g.메시지.textContent), '실패를 안 알린다');

  const 옮김 = r.list[0];
  const h = 옮기기놀이터({ 원본: 원본보기(), 있는것: [{ mv: { store: 옮김.store, id: 옮김.id } }] });
  h.ctx.S._mvList = r.list;
  h.ctx.document.querySelectorAll = () => [{ checked: true, value: '0' }];
  h.ctx.erpMoveRun();
  await 흘려보내기();
  assert.equal(h.보냄.length, 0, '★ 다른 창에서 이미 옮긴 것을 또 옮긴다');
});

test('③ 옮기기 창의 목록 — 맨 왼쪽 ☐ 고르기 칸 + 번호 · 머리 ☐ 는 보이는 줄만', () => {
  const m = 함수(WORK, 'erpMoveModal');
  const th = m.indexOf('<thead>'), c1 = m.indexOf('type="checkbox"', th), n1 = m.indexOf('>#</th>', th);
  assert.ok(th > 0 && c1 > th && n1 > c1, '★ 머리줄 맨 왼쪽이 ☐ → 번호 차례가 아니다');
  assert.match(m, /class="mvchk"/, '줄마다 고르기 칸이 없다');
  assert.match(함수(WORK, 'mvAll'), /querySelectorAll\('\.mvchk'\)/, '머리 ☐ 가 보이는 줄의 칸을 안 본다');
});

/* ═════ ④ 여는 주소 ═════ */
test('④ 업무관리가 이알피·포털이 여는 주소를 받는다 — 새 업무 · 옮기기 · 연결 · 거른 내 업무', () => {
  const 불림 = [];
  const ctx = {
    location: { hash: '' }, S: { view: 'my', f: null }, items: {},
    itemModal: () => 불림.push('new'), erpMoveModal: () => 불림.push('move'), puerpMineModal: () => 불림.push('pe'),
    renderMy: () => 불림.push('my:' + ctx.S.f), openDrawer: (id) => 불림.push('item:' + id), toast() {},
  };
  vm.createContext(ctx);
  vm.runInContext(함수(WORK, 'openFromHash'), ctx);
  [['#new', 'new'], ['#erpmove', 'move'], ['#peimport', 'pe'], ['#f=due', 'my:due'], ['#f=next', 'my:next'], ['#f=nolog', 'my:nolog']]
    .forEach(([h, want]) => { 불림.length = 0; ctx.location.hash = h; ctx.openFromHash(); assert.deepEqual(불림, [want], h + ' 를 못 받는다'); });
  불림.length = 0; ctx.location.hash = '#f=아무거나'; ctx.openFromHash();
  assert.deepEqual(불림, [], '모르는 거르개를 받아들인다');
});

/* ═════ ⑤ 포털 ═════ */
const 숫자구역 = (() => {
  const a = ENTER.indexOf('/* ── 📋 내 업무 숫자');
  const b = ENTER.indexOf('/* ── 내 업무 숫자 끝 ── */', a);
  assert.ok(a > 0 && b > a, '포털 «내 업무 숫자» 구역을 못 찾았다');
  return ENTER.slice(a, b);
})();

test('⑤★ 업무관리는 자료함 타일이 아니라 머리줄 단추 — 처음엔 감춰져 있고 숫자를 센다', () => {
  const app = ENTER.split('\n').filter((l) => /^\s*\{\s*key:'work'/.test(l))[0];
  assert.ok(app, '업무관리 앱 줄이 없다');
  assert.match(app, /\bhead:true\b/, '★ 업무관리가 머리줄 단추(head)가 아니다 — 자료함 타일 사이에 묻힌다');
  assert.match(app, /\bcount:'myWork'/, '단추가 숫자를 안 센다');
  const pbar = ENTER.slice(ENTER.indexOf('<div class="pbar">'));
  const at = pbar.indexOf('id="headApp_work"');
  assert.ok(at > 0, '★ 머리줄에 «내 업무» 단추가 없다');
  const tag = pbar.slice(pbar.lastIndexOf('<a ', at), pbar.indexOf('>', at));
  assert.match(tag, /data-count="myWork"/);
  assert.ok(at < pbar.indexOf('id="headApp_cal"'), '«내 업무»가 캘린더보다 앞(맨 앞)에 서야 한다 — 로그인하면 먼저 볼 것');
  assert.match(ENTER, /var PORTAL_HEAD_COUNTERS = \{[^}]*\bmyWork\s*:/, '세는 함수가 등록되지 않았다');
});

test('⑤★ 포털은 «그 사람 몫 한 줄»만 읽는다 — 업무 목록 통째(work_erp/items)를 안 읽는다', () => {
  const 코드 = stripJs(숫자구역);
  assert.ok(!/work_erp\/items/.test(코드), '★ 포털이 업무 목록 전체를 읽는다 — 모든 직원이 포털을 열 때마다 내려받는다');
  assert.match(코드, /PuMyWork\.pathOf\(sid\)|M\.pathOf\(sid\)/, '읽는 자리를 공용 모듈에서 정하지 않는다(쓰는 쪽과 어긋날 수 있다)');
  assert.equal((코드.match(/\.ref\(/g) || []).length, 1, '읽는 곳이 한 곳이 아니다');
});

function 포털놀이터(o) {
  const 읽음 = [];
  const ctx = {
    window: { PuMyWork: M }, Date, Promise,
    db: { ref: (p) => ({ once: () => { 읽음.push(p); return o.실패 ? Promise.reject(new Error('x')) : Promise.resolve({ val: () => o.값[p] }); } }) },
    portalYmdOf: (d) => M.ymdOf(d),
  };
  vm.createContext(ctx);
  vm.runInContext(숫자구역.replace(/var _curSid = '';/, 'var _curSid = ' + JSON.stringify(o.sid || '') + ';'), ctx);
  return { ctx, 읽음 };
}

test('⑤★ 읽으면 숫자 · 못 읽으면 null(캐시에 안 담아 다음에 다시) · 사번이 없으면 읽지도 않는다', async () => {
  const sum = M.build({ n: 7, dues: [M.ymdOf(new Date())], now: Date.now() });
  const g = 포털놀이터({ sid: 'P-001', 값: { [M.pathOf('P-001')]: sum } });
  const c = await g.ctx.portalMyWorkCount();
  assert.equal(c.open, 7); assert.equal(c.due, 1);
  await g.ctx.portalMyWorkCount();
  assert.equal(g.읽음.length, 1, '★ 다시 그릴 때마다 서버를 읽는다(잠깐은 기억해야 한다)');

  const bad = 포털놀이터({ sid: 'P-001', 실패: true, 값: {} });
  assert.equal(await bad.ctx.portalMyWorkCount(), null, '★ 못 읽었는데 숫자를 낸다');
  await bad.ctx.portalMyWorkCount();
  assert.equal(bad.읽음.length, 2, '★ 못 읽은 것을 기억해 다시 시도하지 않는다');

  const none = 포털놀이터({ sid: '', 값: {} });
  assert.equal(await none.ctx.portalMyWorkCount(), null);
  assert.equal(none.읽음.length, 0, '★ 누구인지 모르는데 읽는다');

  const empty = 포털놀이터({ sid: 'P-001', 값: {} });
  assert.equal(await empty.ctx.portalMyWorkCount(), null, '★ 업무관리를 한 번도 안 열었는데 0건으로 보인다');
});

test('⑤★ 사람이 바뀌면 앞사람 숫자를 버린다', async () => {
  const g = 포털놀이터({ sid: 'P-001', 값: { [M.pathOf('P-001')]: M.build({ n: 7, now: Date.now() }), [M.pathOf('P-002')]: M.build({ n: 2, now: Date.now() }) } });
  assert.equal((await g.ctx.portalMyWorkCount()).open, 7);
  vm.runInContext("_curSid = 'P-002';", g.ctx);
  assert.equal((await g.ctx.portalMyWorkCount()).open, 2, '★ 다른 사람으로 바뀌었는데 앞사람 숫자를 보인다');
  assert.deepEqual(g.읽음, [M.pathOf('P-001'), M.pathOf('P-002')]);
  /* 누구 몫으로 읽을지는 포털을 그리는 첫머리에서 정한다(단추를 그리기 전에) */
  const rp = 함수(ENTER, 'renderPortal');
  const s = rp.indexOf('_curSid = mySid'), loop = rp.indexOf('APPS.forEach(function(app){');
  assert.ok(s > 0 && loop > s, '★ 단추를 그리기 전에 «누구 몫»을 안 정한다 — 앞사람 숫자를 읽는다');
});

test('⑤ 단추에 숫자 — PC 는 한 줄, 폰 딱지는 급한 것(임박+할 일)만 · 말풍선은 언제 기준인지 밝힌다', () => {
  const 속성 = {}, 칸 = { hidden: true, 클래스: new Set(), classList: null }, 줄글 = { textContent: '' }, 딱지 = { textContent: '' };
  칸.classList = { toggle(c, f) { if (f) 칸.클래스.add(c); else 칸.클래스.delete(c); } };
  const el = {
    title: '', getAttribute: (k) => (k in 속성 ? 속성[k] : null), setAttribute: (k, v) => { 속성[k] = String(v); },
    querySelector: (s) => (s === '.hd-n' ? 칸 : s === '.hd-nv' ? 딱지 : s === '.hd-wl' ? 줄글 : null),
  };
  el.setAttribute('data-name', '내 업무'); el.setAttribute('data-count', 'myWork');
  const ctx = { window: { PuMyWork: M }, portalHeadAppLabel: (e) => ctx.portalMyWorkLabel(e) };
  vm.createContext(ctx);
  vm.runInContext(함수(숫자구역, 'portalMyWorkApply') + '\n' + 함수(숫자구역, 'portalMyWorkLabel'), ctx);
  ctx.portalMyWorkLabel(el);
  assert.ok(!/진행/.test(el.title), '숫자를 받기 전에 숫자를 말한다');
  ctx.portalMyWorkApply(el, { open: 9, due: 2, next: 1, at: Date.now() }, '2026-11-21');
  assert.equal(칸.hidden, false);
  assert.ok(/진행 9/.test(줄글.textContent) && /임박 2/.test(줄글.textContent), 'PC 한 줄이 틀리다: ' + 줄글.textContent);
  assert.equal(딱지.textContent, '3', '★ 폰 딱지가 급한 것(임박+할 일)이 아니다');
  assert.ok(/진행 9/.test(el.getAttribute('aria-label')), '접근성 이름에 숫자가 없다(폰은 글자를 접는다)');
  assert.ok(/기준/.test(el.title), '★ 말풍선이 언제 기준 숫자인지 안 밝힌다');
  ctx.portalMyWorkApply(el, { open: 9, due: 0, next: 0, at: Date.now() }, '2026-11-21');
  assert.ok(칸.클래스.has('is-zero'), '급한 것이 없으면 흐리게(폰은 딱지를 안 보인다)');
  /* CSS — PC 는 급한 수(.hd-nv)를 숨기고, 폰 구간에서만 보인다 */
  const css = ENTER.slice(0, ENTER.indexOf('</style>'));
  assert.match(css, /\.hd-app\[data-count="myWork"\] \.hd-nv\{display:none;?\}/);
  assert.match(css, /@media\(max-width:900px\)\{[^@]*\.hd-app\[data-count="myWork"\] \.hd-nv\{display:inline;?\}/, '★ 폰에서 급한 수 딱지가 안 보인다');
});

/* ═════ ⑥ 이알피 「나의 업무」 ═════ */
const MYDESK = stripJs(함수(ERP, 'MyDeskV2'));

test('⑥★ 「나의 업무」에서 업무를 «만들지» 않는다 — 새 업무·옮기기·연결은 업무관리로 보낸다', () => {
  assert.ok(MYDESK.indexOf("'+ 일반업무'") < 0, '★ 「+ 일반업무」가 되살아났다 — 업무관리에 안 나오는 섬이 다시 생긴다');
  assert.ok(MYDESK.indexOf("'+ 업무케이스'") < 0, '★ 「+ 업무케이스」가 되살아났다');
  ['#new', '#erpmove', '#peimport'].forEach((h) => assert.ok(MYDESK.indexOf("_goWork('" + h + "')") >= 0, h + ' 로 가는 단추가 없다'));
  /* 표(머리줄·본문 칸 순서가 어긋났던 것)는 걷었다 — 「최근 기록」 머리칸이 다시 생기면 업무 목록이 두 곳이 된다 */
  assert.ok(!/h\('th'[^)]*\)[^\n]*'최근 기록'/.test(MYDESK), '★ 업무 목록 표가 되살아났다 — 목록이 다시 두 곳이 된다');
});

test('⑥★ 업무관리 목록을 못 읽었으면 «업무관리에 없음»을 세지 않는다', () => {
  assert.match(MYDESK, /var map = \{ __ok:true \}/, '다 읽었다는 표시가 없다');
  assert.match(MYDESK, /setWsLogs\(\{ __fail:true \}\)/, '못 읽었을 때를 가르지 않는다');
  assert.match(MYDESK, /var _unl = _wsOk \?/, '★ 못 읽었는데도 «업무관리에 없는 업무»를 센다 — 다 없음으로 보인다');
  assert.match(MYDESK, /var _left = _wsOk \?/, '★ 못 읽었는데도 «옮길 것»을 센다');
  assert.match(MYDESK, /PuMyWork\.pathOf\(sid\)/, '숫자를 공용 모듈 자리에서 안 읽는다');
  assert.match(MYDESK, /PuMyWork\.counts\(wsSum, todayStr/, '숫자를 공용 모듈 셈으로 안 센다 — 포털과 숫자가 갈린다');
});

test('⑥ 세 화면이 같은 모듈을 싣는다', () => {
  [['enter.html', ENTER], ['work.html', WORK], ['pu-erp.html', ERP]].forEach(([n, s]) =>
    assert.match(s, /<script src="js\/pu-mywork\.js[^"]*"><\/script>/, n + ' 가 js/pu-mywork.js 를 안 싣는다'));
});

/* ═════ ⑦ 길잡이 챗봇 ═════ */
test('⑦ 길잡이 챗봇이 «자료함에 업무관리»라고 옛 말을 하지 않는다 · 머리줄 «내 업무» 단추를 안내한다', () => {
  assert.ok(!/자료함\(\d+개\)\]: [^\n]*업무관리/.test(KB), '★ 챗봇이 업무관리가 자료함에 있다고 안내한다');
  assert.ok(/내 업무\][^\n]*머리줄/.test(KB), '챗봇 안내에 «내 업무» 머리줄 단추가 없다');
});
