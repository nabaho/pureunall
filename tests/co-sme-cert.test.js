/* ══════ 기업정보 — 중소기업 확인서 (대표 지시 2026-09-10) ══════════════════
   「기업정보에 매년 중소기업 확인서 발급 받고 기간 확인하는 게 필요하다
     사진첩에서 확인된 중소기업 확인서 관리항목넣어라 간단하게」

   ■ 무엇이 없었나
   판독 층은 확인서(kind=sme)의 유효기간·발급일·발급번호까지 이미 읽고 있었고
   업체관리(sendToCompany)도 그 셋을 받고 있었다. 그런데 «기업정보»로 가는 길
   (sendToCoInfo)에는 기업규모(smeType)만 있어, 언제까지 쓸 수 있는 확인서인지
   알 길이 없었다 — 확인서는 해마다 새로 받는다.

   ★ 못 박는 것
     ① 확인서의 날짜는 «제 칸»으로 간다. 확인서의 issueDate 를 그대로 두면
        「등록증 발급일」 자리에 앉는데, 그 칸은 «어느 등록증이 최신인가»를 가리는
        유일한 잣대다(2026-09-07). 확인서 날짜가 앉으면 그 잣대가 망가진다.
     ② 확인서가 «아닌» 서류의 날짜는 안 건드린다 — 반대 방향의 같은 함정이다.
     ③ 담는 곳(KEEP)과 보이는 곳(CO_FIELDS)은 «늘 짝»이다. 이 저장소가 팩스·
        대표번호에서 두 번 겪은 자리다(2026-08-27·08-31).
     ④ 남은 날은 «날짜»로 센다 — 만료 당일은 아직 유효하다.
     ⑤ 유효기간이 없으면 딱지를 «안 그린다». 확인서 없는 회사 4,000곳에 「모름」이
        붙으면 정작 급한 곳이 묻힌다.

   node --test tests/co-sme-cert.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const ROOT = path.join(__dirname, '..');
const FILE = fs.readFileSync(path.join(ROOT, 'js', 'pu-doc-file.js'), 'utf8');
const CARDS = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').split('\r\n').join('\n');

/* ── ①② 보내는 쪽 — 확인서의 날짜가 어느 칸으로 가는가 ─────────────────── */

/* smeKeys 를 «떠서 돌린다» — 글자만 찾는 검사는 기능을 꺼 버려도 통과한다 */
function 이름갈이() {
  const ctx = { Object };
  vm.createContext(ctx);
  vm.runInContext(cutFn(FILE, 'function smeKeys('), ctx);
  return ctx.smeKeys;
}

test('★★★ 확인서의 유효기간·발급일·발급번호가 «제 칸»으로 간다', () => {
  const smeKeys = 이름갈이();
  const out = smeKeys('sme', { bizno: '1348605772', smeType: '소기업',
    expiry: '2027-03-31', issueNo: 'SME-2026-1', issueDate: '2026-04-01' });
  assert.equal(out.smeExpiry, '2027-03-31', '★★ 유효기간이 안 담긴다 — 언제 다시 받을지 알 길이 없다');
  assert.equal(out.smeIssueDate, '2026-04-01');
  assert.equal(out.smeIssueNo, 'SME-2026-1');
});

test('★★★ 확인서 발급일이 「등록증 발급일」 자리에 «앉지 않는다»', () => {
  /* 그 칸은 어느 등록증이 최신인가를 가리는 «유일한» 잣대다(2026-09-07).
     확인서 날짜가 앉으면 옛 등록증이 새것으로 보인다. */
  const smeKeys = 이름갈이();
  const out = smeKeys('sme', { bizno: '1348605772', issueDate: '2026-04-01' });
  assert.equal(out.issueDate, undefined,
    '★★★ 확인서 발급일이 등록증 발급일 칸에 남았다 — 최신 등록증을 가리는 잣대가 망가진다');
});

test('★★★ 확인서가 «아닌» 서류의 날짜는 한 글자도 안 건드린다', () => {
  const smeKeys = 이름갈이();
  const 등록증 = { bizno: '1348605772', issueDate: '2026-04-01', ceo: '나성환' };
  const out = smeKeys('bizreg', 등록증);
  assert.equal(out.issueDate, '2026-04-01',
    '★★★ 등록증 발급일을 옮겼다 — 이 함정의 «반대 방향»이다');
  assert.equal(out.smeIssueDate, undefined, '★ 확인서도 아닌데 확인서 칸을 만들었다');
  /* 갈래를 모를 때도 마찬가지다 — 모르면 손대지 않는다 */
  assert.equal(smeKeys('', 등록증).issueDate, '2026-04-01');
  assert.equal(smeKeys(undefined, 등록증).issueDate, '2026-04-01');
});

test('★ 옮기지 않는 칸은 그대로 온다 — 옮기며 흘리면 안 된다', () => {
  const smeKeys = 이름갈이();
  const out = smeKeys('sme', { bizno: '1348605772', company: '가나컨트롤(주)',
    ceo: '나성환', smeType: '소기업', industry: '제조업' });
  ['bizno', 'company', 'ceo', 'smeType', 'industry'].forEach(k =>
    assert.ok(out[k], k + ' 이 옮기는 사이에 사라졌다'));
});

/* ── 실제로 저장까지 가는가 (가짜 db 로 «돌려» 본다) ─────────────────────── */

function 보내기(existing) {
  const i = FILE.indexOf('function sendToCoInfo');
  const j = FILE.indexOf('function sendToCompany');
  assert.ok(i > 0 && j > i, 'sendToCoInfo 를 찾지 못했습니다');
  const writes = [];
  const ctx = {
    Promise, Object, String, Date, Error,
    CARDS_ROOT: 'pucards',
    CO_LABEL: { smeExpiry: '중소기업확인서 유효기간' },
    FIELD_LABEL: {},
    CO_PAIRS_MAX: 60, CO_PAIR_LEN: 300,
    bizKey: v => { const d = String(v || '').replace(/\D/g, ''); return d.length >= 10 ? d : ''; },
    deps: { db: { ref: p => ({
      once: () => Promise.resolve({ val: () => existing }),
      update: v => { writes.push({ path: p, val: v }); return Promise.resolve(); }
    }) } },
    _writes: writes
  };
  vm.createContext(ctx);
  vm.runInContext(FILE.slice(i, j), ctx);
  return ctx;
}

test('★★★ 확인서를 보내면 유효기간이 «실제로» 기업정보에 담긴다', async () => {
  const c = 보내기({});
  const r = await c.sendToCoInfo({ kind: 'sme', fields: {
    bizno: '134-86-05772', docName: '중소기업확인서', smeType: '소기업',
    expiry: '2027-03-31', issueDate: '2026-04-01', issueNo: 'SME-2026-1' } });
  assert.equal(r.ok, true);
  const v = c._writes[0].val;
  assert.equal(v.smeExpiry, '2027-03-31',
    '★★★ 유효기간이 저장되지 않는다 — KEEP 에 들어 있는지 보세요(담는 곳과 보이는 곳은 짝이다)');
  assert.equal(v.smeIssueDate, '2026-04-01');
  assert.equal(v.smeIssueNo, 'SME-2026-1');
  assert.equal(v.issueDate, undefined, '★★★ 등록증 발급일 자리에 확인서 날짜가 들어갔다');
});

test('★★ 확인서로도 «이미 있는 값»은 안 덮는다 — 이 길의 오래된 약속이다', async () => {
  const c = 보내기({ smeExpiry: '2026-03-31' });
  await c.sendToCoInfo({ kind: 'sme', fields: {
    bizno: '134-86-05772', docName: '중소기업확인서', expiry: '2027-03-31' } });
  const v = c._writes[0].val;
  assert.equal(v.smeExpiry, undefined, '★★ 사람이 고쳐 둔 유효기간을 덮었다');
  /* 다만 «어긋났다»는 것은 남긴다 — 조용히 버리면 아무도 모른다(2026-08-24) */
  assert.ok(v['conflicts/smeExpiry'], '★★ 값이 다른데 아무 자국도 안 남았다');
});

/* ── ③ 담는 곳과 보이는 곳은 «늘 짝» ────────────────────────────────────── */

test('★★★ KEEP 과 CO_FIELDS 가 «짝»이다 — 한쪽만 늘리면 값이 안 보인다', () => {
  /* 이 저장소가 팩스(2026-08-31)·대표번호(2026-08-27)에서 두 번 겪은 자리다 */
  const keep = cutFn(FILE, 'function sendToCoInfo(');
  const co = CARDS.slice(CARDS.indexOf('const CO_FIELDS = ['),
                         CARDS.indexOf('];', CARDS.indexOf('const CO_FIELDS = [')));
  ['smeExpiry', 'smeIssueDate', 'smeIssueNo'].forEach(k => {
    assert.ok(keep.indexOf("'" + k + "'") > 0, '★★ KEEP 에 ' + k + ' 이 없다 — 값이 아예 안 온다');
    assert.ok(co.indexOf("'" + k + "'") > 0, '★★ CO_FIELDS 에 ' + k + ' 이 없다 — 값은 쌓이는데 화면에 안 나온다');
  });
});

/* ── ④⑤ 화면 — 남은 날을 무엇이라 말하는가 ──────────────────────────────── */

function 상태() {
  const ctx = { Date, String, Number, Math, isNaN };
  vm.createContext(ctx);
  vm.runInContext(cutFn(CARDS, 'function coSmeDays(') + '\n' + cutFn(CARDS, 'function coSmeState('), ctx);
  return ctx.coSmeState;
}
/* ⚠★ «한낮»으로 둔다 (2026-09-10 이빨 확인에서 새어 잡은 것).
     처음에는 자정 정각(new Date(2026,8,10))을 썼는데, 그러면 날짜로 자르는 것과
     시각 그대로 견주는 것이 «우연히 같은 답»이라 ④번 함정(만료 당일을 잃는 고장)을
     넣어도 검사가 통과했다. 한낮이어야 둘이 갈린다 — 시험 자료가 고장을 가리면
     그 검사는 있으나 마나다(이 저장소가 여러 번 겪은 자리다). */
const 오늘 = new Date(2026, 8, 10, 15, 30).getTime();     /* 2026-09-10 오후 3시 반 */

test('★★★ 유효기간이 지났으면 «만료됨»이라 말한다', () => {
  const st = 상태()('2026-03-31', 오늘);
  assert.equal(st.cls, 'gone');
  assert.match(st.text, /만료/, '★★★ 만료된 확인서를 그냥 날짜만 보여 준다 — 그것으로 신청하면 반려된다');
});

test('★★★ 만료 «당일»은 아직 유효하다 — 시각까지 견주면 하루를 잃는다', () => {
  const st = 상태()('2026-09-10', 오늘);
  assert.notEqual(st.cls, 'gone', '★★★ 그날까지 유효한 확인서를 만료로 말했다');
  assert.match(st.text, /D-0/, '★ 마지막 날인 것을 안 알린다');
});

test('★★ 30일 안쪽이면 «곧 받아야 한다»고 알린다', () => {
  const st = 상태()('2026-10-05', 오늘);            /* D-25 */
  assert.equal(st.cls, 'soon');
  assert.match(st.text, /D-25/);
  /* 경계 — 31일은 아직 급하지 않다 */
  assert.equal(상태()('2026-10-11', 오늘).cls, 'ok', '★ D-31 까지 급한 것으로 몰면 늘 노랗다');
  assert.equal(상태()('2026-10-10', 오늘).cls, 'soon', '★ D-30 은 알려야 한다');
});

test('★ 아직 멀었으면 날짜만 조용히 보여 준다', () => {
  const st = 상태()('2027-03-31', 오늘);
  assert.equal(st.cls, 'ok');
  assert.match(st.text, /2027-03-31/);
});

test('★★ 문서에 적힌 여러 «날짜 모양»을 다 읽는다', () => {
  /* 판독 층은 적힌 그대로 담는다 — 다듬지 않는다 */
  ['2026-03-31', '2026.03.31', '2026년 3월 31일', '2026/03/31'].forEach(txt => {
    assert.equal(상태()(txt, 오늘).cls, 'gone', '★★ 「' + txt + '」 을 못 읽어 만료를 놓쳤다');
  });
});

test('★★ 날짜로 못 읽으면 «지어내지 않는다» — 적힌 그대로 보여 준다', () => {
  const st = 상태()('별도 통지시까지', 오늘);
  assert.equal(st.cls, 'ok');
  assert.match(st.text, /별도 통지시까지/, '★ 적힌 글자를 버렸다');
  assert.ok(!/D-/.test(st.text), '★★ 못 읽은 날짜로 D-날짜를 지어냈다 — 틀린 D-날짜는 없느니만 못하다');
});

test('★★★ 유효기간이 «없으면» 아무것도 안 그린다', () => {
  const coSmeState = 상태();
  [undefined, null, '', '   '].forEach(v =>
    assert.equal(coSmeState(v, 오늘), null,
      '★★★ 확인서 없는 회사에까지 딱지가 붙는다 — 4,000곳이 모두 「모름」이 되어 급한 곳이 묻힌다'));
});

/* ── 딱지가 «접힌 채로도» 보이는가 ──────────────────────────────────────── */

test('★★★ 딱지가 기업정보 «머리줄»에 있다 — 접혀 있어도 보여야 한다', () => {
  /* 기업정보 칸은 기본이 접힘이다(2026-08-31). 펼친 안쪽에만 있으면 펼쳐 본
     사람만 알게 되어, 대표가 바란 「기간 확인」이 안 된다. */
  const box = cutFn(CARDS, 'function coInfoBoxHtml(');
  const head = box.indexOf('coinfo-head');
  const grid = box.indexOf('_coInfoOpen?`<div class="pdgrid');
  const chip = box.indexOf('coSmeChipHtml(o)');
  assert.ok(head > 0 && grid > head, '머리줄과 펼친 칸을 찾지 못했다');
  assert.ok(chip > head && chip < grid,
    '★★★ 확인서 딱지가 «펼쳐야 보이는» 자리에 있다 — 기업정보는 기본이 접힘이다');
});

test('★★ 딱지가 «값이 있을 때만» 나온다 (그리는 것까지 돌려 본다)', () => {
  const ctx = { Date, String, Number, Math, isNaN,
                esc: s => String(s == null ? '' : s),
                coVal: (o, f) => (o || {})[f] || '' };
  vm.createContext(ctx);
  vm.runInContext([cutFn(CARDS, 'function coSmeDays('), cutFn(CARDS, 'function coSmeState('),
                   cutFn(CARDS, 'function coSmeChipHtml(')].join('\n'), ctx);
  assert.equal(ctx.coSmeChipHtml({}), '', '★★ 유효기간이 없는데 딱지를 그렸다');
  const html = ctx.coSmeChipHtml({ smeExpiry: '2020-03-31' });
  assert.match(html, /만료/, '★★ 만료된 확인서인데 화면에 그 말이 없다');
  assert.match(html, /title="/, '★ 무슨 딱지인지 설명이 없다 — 🏅 하나로는 알 수 없다');
});
