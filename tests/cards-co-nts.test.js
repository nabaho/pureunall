/* ══════ 🏛 국세청 사업자 상태 — «지금» 묻고 «언제 물었는지»와 함께 (2026-09-13) ═════
   대표 지시 「1」 — 기능 검토 보고의 ⑤ 「사업장이 진짜로 폐업했는지」

   ■ 알아보니 «이미 다 있었다»
   국세청 조회는 이 저장소가 이미 하고 있다 — 사진첩이 등록증을 읽을 때
   `js/pu-doc-read.js` 가 api.odcloud.kr 에 물어 `ntsState`(계속사업자·휴업자·폐업자)를
   받고, 「번호 확인됨 · 국세청 계속사업자」를 화면에 적는다. 열쇠 자리도 이미 있다
   (포털 환경설정 › 국세청 사업자번호 조회 키 · data/app_config/ntsKey · 무료).
   **없던 것은 그 값이 기업정보함까지 오는 길뿐이었다** — 중소기업 확인서 때와 같은 자리다.

   ★ 못 박는 것
     ①⚠ **「언제 확인했나」를 반드시 함께 적는다.** 상태는 «그때의 사실»이지 지금의 사실이
        아니다. 날짜 없이 「폐업자」만 적어 두면 반년 뒤에도 화면이 단정해서 거짓말한다.
     ② 못 물어봤으면 «물어본 척 안 한다» — 적어 둔 값도 안 건드린다(pu-doc-read 의 규칙).
     ③ 열쇠가 없으면 «어디서 넣는지»까지 말한다. 조용히 아무 일도 안 하면 고장으로 보인다.
     ④ 사업자번호가 없으면 칩을 «아예 안 띄운다» — 눌러도 안 되는 단추를 두지 않는다.
     ⑤ 우리가 정하지 않는다 — 국세청이 준 말을 그대로 적는다.
     ⑥ 상태와 확인일은 «한 번에» 쓴다. 따로 쓰면 날짜 없는 상태가 남는다.

   node --test tests/cards-co-nts.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { cutFn } = require('./cut-fn');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8')
  .split('\r\n').join('\n');

function load(over) {
  const ctx = Object.assign({ console, Object, Array, String, Number, JSON,
    esc: s => String(s == null ? '' : s)
      .replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])) },
    over || {});
  vm.createContext(ctx);
  vm.runInContext([
    SRC.match(/^const digits = [^\n]*;$/m)[0],
    cutFn(SRC, 'function coVal('),
    cutFn(SRC, 'function coNtsWord('), cutFn(SRC, 'function coNtsCls('),
    cutFn(SRC, 'function coNtsChipHtml(')
  ].join('\n'), ctx);
  return ctx;
}
const CO = (o) => Object.assign({ key:'k1', name:'가나', bizno:'1348605772', extra:{} }, o || {});

/* ── ⑤ 국세청이 준 말을 그대로 ────────────────────────────────────────── */

test('★★★ 국세청이 준 말을 «그대로» 적는다 — 우리가 고쳐 부르지 않는다', () => {
  const c = load();
  assert.equal(c.coNtsWord({ b_stt:'계속사업자' }), '계속사업자');
  assert.equal(c.coNtsWord({ b_stt:'폐업자' }), '폐업자');
  assert.equal(c.coNtsWord({ b_stt:'휴업자' }), '휴업자');
});

test('★★ 등록 안 된 번호는 «그 안내문»이 대신한다 — 빈 값으로 두면 아무 말도 못 한다', () => {
  const c = load();
  /* 국세청은 등록되지 않은 번호에 b_stt 를 안 주고 tax_type 에 안내문을 담아 준다 */
  assert.equal(c.coNtsWord({ b_stt:'', tax_type:'국세청에 등록되지 않은 사업자등록번호입니다.' }),
    '국세청에 등록되지 않은 사업자등록번호입니다.');
  assert.equal(c.coNtsWord(null), '');
  assert.equal(c.coNtsWord({}), '');
});

test('★★★ 빛깔이 뜻과 맞는다 — 폐업은 빨강, 휴업은 주황, 계속은 파랑', () => {
  const c = load();
  assert.equal(c.coNtsCls('폐업자'), 'gone');
  assert.equal(c.coNtsCls('휴업자'), 'soon');
  assert.equal(c.coNtsCls('계속사업자'), 'ok');
  assert.equal(c.coNtsCls('국세청에 등록되지 않은 사업자등록번호입니다.'), 'dim',
    '★★ 「모른다」를 나쁜 빛으로 칠하면 멀쩡한 곳이 폐업처럼 보인다');
  assert.equal(c.coNtsCls(''), '');
});

/* ── ①④ 칩 ───────────────────────────────────────────────────────────── */

test('★★★ 확인한 날을 «반드시» 함께 적는다 — 날짜 없는 상태는 거짓말이 된다', () => {
  const c = load();
  const h = c.coNtsChipHtml(CO({ extra:{ ntsState:'폐업자', ntsAt:'2026-09-13' } }));
  assert.match(h, /폐업자/);
  assert.match(h, /2026-09-13 확인/,
    '★★★ 상태는 «그때의 사실»이다 — 날짜가 없으면 반년 뒤에도 화면이 단정해 버린다');
});

test('★★ 아직 안 물어본 줄에는 «물어보는 단추»가 보인다', () => {
  const c = load();
  const h = c.coNtsChipHtml(CO());
  assert.match(h, /국세청 확인/, '★★ 빈 자리를 두면 물어볼 길이 있는 줄도 모른다');
  assert.match(h, /coAskNts\('k1'\)/);
});

test('★★★ 사업자번호가 없으면 칩을 «아예 안 띄운다» — 눌러도 안 되는 단추를 두지 않는다', () => {
  const c = load();
  assert.equal(c.coNtsChipHtml(CO({ bizno:'' })), '');
  assert.equal(c.coNtsChipHtml(CO({ bizno:'1234' })), '', '★ 열 자리가 안 되면 물어볼 수 없다');
  assert.equal(c.coNtsChipHtml(null), '');
});

test('★★ 칩을 눌러도 기업정보 칸이 «접히지 않는다» — 머리줄 안에 있다', () => {
  const c = load();
  assert.match(c.coNtsChipHtml(CO()), /event\.stopPropagation\(\)/,
    '★★ 물어보려고 눌렀는데 칸이 접히면 결과를 못 본다');
});

test('★ 적어 둔 말의 꺾쇠가 글자로 보인다 — 화면이 깨지면 안 된다', () => {
  const c = load();
  const h = c.coNtsChipHtml(CO({ extra:{ ntsState:'<b>폐업자</b>', ntsAt:'2026-09-13' } }));
  assert.ok(!/<b>폐업자<\/b>/.test(h));
});

/* ── ②③⑥ 물어보는 길 ───────────────────────────────────────────────── */

function 물어보기(over) {
  const calls = { toast:[], saved:null, fetched:null };
  const o = over && over.co ? over.co : CO();
  const ctx = { console, Object, Array, String, Number, JSON, Promise,
    digits: s => String(s || '').replace(/\D/g, ''),
    coList: () => [o],
    coVal: (x, f) => String(((x && x.extra) || {})[f] || ''),
    todayYmd: () => '2026-09-13',
    toast: (m) => calls.toast.push(String(m)),
    PU_CFG: (over && 'cfg' in over) ? over.cfg : { ntsKey:'KEY123' },
    fetch: (url, init) => { calls.fetched = { url, body: init && init.body };
      return Promise.resolve(over && over.res); },
    coSaveInfoPatch: (k, patch, msg) => { calls.saved = { key:k, patch, msg }; } };
  vm.createContext(ctx);
  vm.runInContext([
    /* ⚠ 주소도 «원본에서» 떠 온다 — 베껴 적으면 제품이 주소를 바꿔도 검사는 옛 주소를 본다.
       (안 실었더니 제품이 「못 물어봤습니다」로 조용히 빠져나가 한참 헤맸다.) */
    SRC.match(/^const NTS_STATUS_URL = [^\n]*;$/m)[0].replace('const ', 'var '),
    cutFn(SRC, 'function coNtsWord('),
    /* ⚠ coAskNts 는 `async function` 이다. cutFn 은 「function …」부터 뜨므로
       async 가 떨어져 나가 안에서 await 이 구문 오류가 된다 — 도로 붙여 싣는다. */
    'async ' + cutFn(SRC, 'function coAskNts(')
  ].join('\n'), ctx);
  return ctx.coAskNts(o.key).then(() => calls);
}
const 답 = (row) => ({ ok:true, json: () => Promise.resolve({ data: row ? [row] : [] }) });

test('★★★ ③ 열쇠가 없으면 «어디서 넣는지»까지 말한다 — 조용히 넘어가면 고장으로 보인다', async () => {
  const c = await 물어보기({ cfg:{} });
  assert.equal(c.fetched, null, '★★ 열쇠도 없이 국세청을 불렀다');
  assert.equal(c.saved, null);
  assert.ok(c.toast.some(t => /환경설정/.test(t) && /무료/.test(t)),
    '★★★ 「안 된다」만 하면 사람은 무엇을 해야 할지 모른다');
});

test('★★ 사업자번호가 없으면 묻지도 않는다', async () => {
  const c = await 물어보기({ co: CO({ bizno:'' }) });
  assert.equal(c.fetched, null);
  assert.ok(c.toast.some(t => /사업자번호가 없어/.test(t)));
});

test('★★★ ⑥ 상태와 확인일을 «한 번에» 쓴다 — 따로 쓰면 날짜 없는 상태가 남는다', async () => {
  const c = await 물어보기({ res: 답({ b_no:'1348605772', b_stt:'폐업자', tax_type:'부가가치세 일반과세자' }) });
  assert.deepEqual(Object.keys(c.saved.patch).sort(), ['ntsAt','ntsState']);
  assert.equal(c.saved.patch.ntsState, '폐업자');
  assert.equal(c.saved.patch.ntsAt, '2026-09-13', '★★★ 「오늘」을 받아 적는다');
  assert.equal(c.saved.key, 'k1');
});

test('★★ 물어볼 때 «번호만» 보낸다 — 필요 없는 것을 밖으로 내보내지 않는다', async () => {
  const c = await 물어보기({ res: 답({ b_stt:'계속사업자' }) });
  assert.equal(c.fetched.body, JSON.stringify({ b_no:['1348605772'] }),
    '★★ 상호·대표자까지 실어 보낼 까닭이 없다');
  assert.match(c.fetched.url, /api\.odcloud\.kr/);
  assert.match(c.fetched.url, /serviceKey=KEY123/);
});

test('★★★ ② 못 물어봤으면 «물어본 척 안 한다» — 적어 둔 값도 안 건드린다', async () => {
  const 끊김 = await 물어보기({ res: { ok:false, status:503, json: () => Promise.resolve({}) } });
  assert.equal(끊김.saved, null, '★★★ 못 물어봤는데 적으면 그 값이 사실인 줄 안다');
  assert.ok(끊김.toast.some(t => /못 물어봤습니다/.test(t)));
});

test('★★ 국세청이 «아무 말도» 안 주면 안 적는다', async () => {
  const 빈것 = await 물어보기({ res: 답(null) });
  assert.equal(빈것.saved, null);
  const 빈말 = await 물어보기({ res: 답({ b_stt:'', tax_type:'' }) });
  assert.equal(빈말.saved, null, '★★ 빈 말을 적어 두면 「확인했는데 모른다」가 남는다');
});

/* ── 붙어 있나 ────────────────────────────────────────────────────────── */

test('★★ 기업정보 머리줄이 칩을 «실제로» 내보낸다', () => {
  assert.match(cutFn(SRC, 'function coInfoBoxHtml('), /coNtsChipHtml\(o\)/,
    '★★★ 만들어 놓고 안 붙이면 소용없다');
});

test('★★ 열쇠는 «포털 공용 설정»에서 온다 — 앱마다 따로 넣게 하지 않는다', () => {
  const fn = cutFn(SRC, 'function coAskNts(');
  assert.match(fn, /PU_CFG && PU_CFG\.ntsKey/,
    '★★ 열쇠를 두 곳에 두면 한쪽만 바꿨을 때 왜 안 되는지 알 수 없다');
});
