'use strict';
/* 회의·비용관리 — 한눈에·정산이 «날짜 모양»에 속지 않는다 (2026-10-03 검토에서 찾음)
   ──────────────────────────────────────────────────────────────────
   ■ 무엇이 깨져 있었나
     입력 칸(autoDate)은 일자를 「2026.09.18」(점)으로 저장한다 — 대표 화면의 실제 건이 그 모양이다.
     달을 가르는 코드는 앞 일곱 글자를 «그대로» 「2026-09」(줄표)와 견줘서, 점 모양 건이 통째로 빠졌다.
       · 한눈에 「이번 달」 — 실제 345,000원인데 45,000원
       · 정산 「지난 달」   — 실제 2건인데 「이 기간에 기록이 없습니다」
     (옆줄 숫자도 목록은 4건인데 3건 — 기타비용 통을 안 셌다.)
   ■ 왜 기존 검사가 못 잡았나
     검사 자료가 전부 줄표(「2026-01-05」)였고, 이번 달·지난 달 길은 아예 안 돌렸다(올해·전체만).
   ■ 그래서 여기서는 — 규칙을 못 박는다
     ① 일자는 어떤 모양이든 «같은 달»로 읽힌다(점·줄표·빗금·여덟 자리·「년월일」)
     ② 시계를 «고정»해 이번 달·지난 달을 돌린다 — 1월에는 지난 달이 «지난해 12월»이다
     ③ 「마지막」·최근 순은 글자가 아니라 «날짜»로 견준다(점과 줄표가 섞여도)
     ④ 옆줄 숫자는 목록이 모으는 «두 통»을 다 센다
     ⑤ 목록 줄은 글자를 감싼다(OCR 로 읽은 영수증 글자가 그대로 실행되면 안 된다) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리 + ' 을 찾지 못했습니다');
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) {
    if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); }
  }
}
/* «지금»을 못 박은 Date — new Date() 가 늘 같은 날을 준다(남은 인자가 있으면 진짜 Date) */
function 고정시계(y, m0, d) {
  return class extends Date { constructor(...a) { if (a.length) super(...a); else super(y, m0, d); } };
}
const 함수들 = ['function feeAll(', 'function _feeAmt(', 'function _feeYMD(', 'function _feeYear(', 'function _feeMon(',
  'function _feeKey(', 'function _feeDay(', 'function _feeThisMonth(', 'function feeMonthSum(',
  'function _feeInWhen(', 'function feeSettleGroups('];
function 세상(통, 시계) {
  const ctx = { get: (k) => 통[k] || [], Date: 시계 || Date, Number, isFinite, String, Object, Math };
  vm.createContext(ctx);
  vm.runInContext(함수들.map(떼기).join('\n'), ctx);
  return ctx;
}
const 값 = (ctx, 식) => vm.runInContext(식, ctx);

test('① 일자는 어떤 모양이든 «같은 달»로 읽힌다', () => {
  const c = 세상({});
  const 모양들 = ['2026.09.18', '2026-09-18', '2026/09/18', '2026/9/8', '2026.9.8', '20260918', '2026년 9월 18일', '2026.09', '202609', ' 2026.09.18 '];
  모양들.forEach((s) => assert.equal(값(c, `_feeMon({date:${JSON.stringify(s)}})`), '2026-09',
    '★ 「' + s + '」를 2026-09 로 못 읽습니다 — 이 모양으로 저장된 건이 달 합계에서 빠집니다'));
  assert.equal(값(c, "_feeDay({date:'2026-09-08'})"), '2026.09.08', '보여 줄 때는 늘 점 모양 + 두 자리');
  ['', null, undefined, '미정', '2026.13.01', '2026.00.05', 'abc'].forEach((s) =>
    assert.equal(값(c, `_feeMon({date:${JSON.stringify(s === undefined ? null : s)}})`), '', '읽을 수 없는 일자는 빈 값 — ' + JSON.stringify(s)));
});

test('② 이번 달 합계 — 점·줄표·빗금이 섞여도 «전부» 센다', () => {
  const c = 세상({
    meetfee: [
      { id: 'a', date: '2026.09.05', amt: '300,000원' },     /* 입력 칸이 저장하는 «진짜 모양» */
      { id: 'b', date: '2026-09-20', amt: 45000 },
      { id: 'c', date: '2026/9/28', amt: '1,000' },
      { id: 'd', date: '2026.10.01', amt: 999999 },          /* 다른 달 */
      { id: 'e', date: '2025.09.05', amt: 999999 },          /* 다른 해 같은 달 */
      { id: 'f', date: '', amt: 999999 }
    ]
  });
  assert.equal(값(c, "feeMonthSum(feeAll(),'2026-09')"), 346000,
    '★ 이번 달 합계가 어긋납니다 — 점 모양으로 저장된 건이 빠지고 있을 수 있습니다');
});

test('②-2 정산 이번 달·지난 달 — 시계를 고정하고 돌린다(1월에는 지난 달 = 지난해 12월)', () => {
  const 통 = {
    meetfee: [
      { id: 'a', org: '홍길동', amt: 300000, date: '2026.01.05' },
      { id: 'b', org: '홍길동', amt: 1600000, date: '2025.12.18' },   /* 지난 달 — 점 모양, «해를 넘는다» */
      { id: 'c', org: '가나상사', amt: 80000, date: '20251205' },     /* 지난 달 — 여덟 자리 */
      { id: 'd', org: '가나식당', amt: 45000, date: '2026-01-20' }
    ]
  };
  const c = 세상(통, 고정시계(2026, 0, 15));
  const 모음 = (w) => 값(c, `feeSettleGroups(feeAll(),'${w}')`).map((x) => x.who + ':' + x.sum).sort().join(',');
  assert.equal(모음('month'), '가나식당:45000,홍길동:300000', '★ 이번 달(2026-01) 정산이 어긋납니다');
  assert.equal(모음('prev'), '가나상사:80000,홍길동:1600000',
    '★ 지난 달(2025-12) 정산이 비거나 어긋납니다 — 「이 기간에 기록이 없습니다」로 뜨던 그 자리입니다');
  assert.equal(모음('year'), '가나식당:45000,홍길동:300000', '올해(2026)는 1월 두 건만');
  assert.equal(모음('all').split(',').length, 3, '전체는 지난해까지');
});

test('③ «마지막»·최근 순은 글자가 아니라 날짜로 견준다 — 점과 줄표가 섞여도', () => {
  const c = 세상({ meetfee: [
    { id: 'a', org: '홍길동', amt: 1, date: '2026.10.05' },
    { id: 'b', org: '홍길동', amt: 1, date: '2026-10-09' }     /* 진짜 마지막 — 글자로 견주면 점(.)이 줄표(-)보다 커서 a 가 이긴다 */
  ] }, 고정시계(2026, 9, 20));
  const g = 값(c, "feeSettleGroups(feeAll(),'all')");
  assert.equal(g[0].last, '2026.10.09', '★ 마지막이 틀립니다 — 글자로 견주고 있습니다: ' + g[0].last);
  assert.ok(값(c, "_feeKey({date:'2026-10-09'})") > 값(c, "_feeKey({date:'2026.10.05'})"), '열쇠 차례가 틀립니다');
  assert.equal(값(c, "_feeKey({date:'미정'})"), '', '읽을 수 없는 일자는 빈 열쇠(맨 끝)');
});

/* 한눈에 «화면 전체»를 돌린다 — 그리는 함수 안에 있는 셈(이번 달 숫자·최근 순)은 부분 함수 검사로는 안 닿는다.
   ⚠ 처음엔 최근 순을 글자로 견주도록 되돌려도 검사가 안 걸렸다(고장넣기로 발견) — 그 줄이 그리기 안에 있어서다. */
function 한눈에그리기(통, 시계, 고른해) {
  const 몸 = { innerHTML: '' }, 해칸 = { value: 고른해 === undefined ? '' : 고른해, dataset:고른해 === undefined ? {} : { set: '1' }, innerHTML: '' };
  const ctx = {
    get: (k) => 통[k] || [], Date: 시계, Number, isFinite, String, Object, Math, Set, Array,
    document: { getElementById: (id) => (id === 'feeDashBody' ? 몸 : id === 'feeDashYear' ? 해칸 : null) },
    escapeHtml: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
    _jsAttr: (s) => String(s == null ? '' : s).replace(/'/g, "\\'")
  };
  vm.createContext(ctx);
  vm.runInContext(SRC.match(/var FEE_KINDS=\[[^\]]*\];/)[0], ctx);
  vm.runInContext(['function _won(', 'function feeMissing(', 'function _feeDashYear(', 'function renderFeeDash(', ...함수들.slice(0, 9)].map(떼기).join('\n'), ctx);
  vm.runInContext('renderFeeDash()', ctx);
  return 몸.innerHTML;
}

test('③-2 한눈에 화면 — 이번 달 숫자와 최근 내역이 «진짜 모양»의 자료로 맞게 나온다', () => {
  const html = 한눈에그리기({
    meetfee: [
      { id: 'MF0001', date: '2026.10.05', year: '2026', type: '회의', content: '이번 달 회의 수당', amt: '300000', org: '홍길동' },
      { id: 'MF0002', date: '2026.09.18', year: '2026', type: '회의', content: '지난 달 회의 수당', amt: '1600000', org: '홍길동' }
    ],
    etcfee: [
      { id: 'EF0001', date: '2026-10-09', year: '2026', type: '식대', content: '줄표 모양 식대', amt: '45000', org: '가나식당' }
    ]
  }, 고정시계(2026, 9, 20));
  const 이번달 = html.match(/이번 달 \(10월\)<\/div><div class="v">([^<]+)</);
  assert.ok(이번달, '이번 달 칸을 못 찾습니다');
  assert.equal(이번달[1], '345,000원',
    '★ 화면의 「이번 달」이 ' + 이번달[1] + ' 입니다 — 점 모양으로 저장된 300,000원이 빠집니다');
  /* 최근 내역 — 10월 9일(줄표)이 10월 5일(점)보다 «위»여야 한다. 글자로 견주면 점이 커서 뒤집힌다 */
  const 최근 = html.slice(html.indexOf('최근 내역'));
  assert.ok(최근.indexOf('줄표 모양 식대') > 0 && 최근.indexOf('이번 달 회의 수당') > 0, '최근 내역에 두 건이 없습니다');
  assert.ok(최근.indexOf('줄표 모양 식대') < 최근.indexOf('이번 달 회의 수당'),
    '★ 최근 내역의 차례가 틀립니다 — 점과 줄표가 섞인 일자를 글자로 견주고 있습니다');
  /* 월별 막대와 이번 달 숫자가 같은 자료를 본다 — 10월 막대 = 345,000, 9월 막대 = 1,600,000 */
  assert.match(html, /2026년 10월 345,000원/, '월별 막대(10월)가 이번 달 숫자와 다릅니다');
  assert.match(html, /2026년 9월 1,600,000원/, '월별 막대(9월)가 틀립니다');
});

test('⑥ 새 화면 CSS — 어두운 판에서 글자·막대가 안 묻히고 · 폰 폭에서 정산 표가 안 잘린다', () => {
  const 시작 = SRC.indexOf('.fd-head{'), 끝 = SRC.indexOf('.fs-pill.no{', 시작);
  assert.ok(시작 > 0 && 끝 > 시작, '한눈에·정산 CSS 덩이를 못 찾았습니다');
  const css = SRC.slice(시작, 끝).replace(/\/\*[\s\S]*?\*\//g, '');   /* ⚠ 주석을 먼저 걷는다 — 까닭을 적은 글에 var(--navy) 가 들어 있다 */
  /* var(--navy) 는 어두운 판에서도 «짙은 남색 그대로» — 글자·막대에 쓰면 어두운 바탕에 묻힌다.
     (2026-10-03 실측: 큰 숫자·칸 제목·구분별 막대가 통째로 안 보였다.) 글자·막대는 var(--ink) 로 — 어두운 판에서 밝게 뒤집힌다. */
  assert.ok(css.indexOf('var(--navy)') < 0,
    '★ 한눈에·정산 CSS 가 var(--navy) 를 씁니다 — 어두운 판에서 글자·막대가 바탕에 묻힙니다. var(--ink) 로 바꾸세요');
  assert.match(css, /\.fd-kpi \.v\{[^}]*color:var\(--ink\)/, '큰 숫자 글자색이 --ink 가 아닙니다');
  assert.match(css, /\.fd-bar \.t i\{[^}]*background:var\(--ink\)/, '구분별 막대색이 --ink 가 아닙니다');
  assert.match(SRC, /--ink:#1e293b/, '밝은 판의 --ink 가 --navy 와 달라지면 모습이 바뀝니다 — 같은 색이어야 합니다');
  assert.match(SRC, /html\.dark\{[^}]*--ink:#e2e8f0/, '어두운 판에서 --ink 가 밝게 뒤집히지 않습니다');
  /* 정산 표는 여섯 칸 — 폰 폭(375)보다 넓다. 감싸는 칸이 옆으로 밀려야 입금계좌가 안 잘린다 */
  assert.match(SRC, /#feeSettleBody\{[^}]*overflow-x:auto/, '★ 정산 표를 옆으로 밀 길이 없습니다 — 폰에서 입금계좌 칸이 잘립니다');
});

test('④ 옆줄 숫자는 목록이 모으는 «두 통»을 다 센다', () => {
  const 마디 = 떼기('function navCount(');
  const ctx = {
    get: (k) => ({ meetfee: [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }], etcfee: [{ id: 'e1' }] }[k] || []),
    CAREER_CFG: { meetfee: { store: 'meetfee', stores: ['meetfee', 'etcfee'] }, etcfee: { store: 'etcfee' }, wiccok: { store: 'wiccok' } },
    PU_SYNC_STORES: undefined, _isExternal: undefined
  };
  vm.createContext(ctx); vm.runInContext(마디, ctx);
  assert.equal(vm.runInContext("navCount('page-meetfee')", ctx), 4,
    '★ 옆줄 숫자가 목록(4건)과 다릅니다 — 기타비용 통을 안 셉니다');
  assert.equal(vm.runInContext("navCount('page-etcfee')", ctx), 1, '통이 하나인 화면은 그대로');
});

test('⑤ 비용 목록 줄은 글자 칸을 감싼다 — OCR 로 읽은 영수증 글자가 실행되면 안 된다', () => {
  const 악성 = '<img src=x onerror=alert(1)>';
  ['meetfee:{store:\'meetfee\',stores:', 'etcfee:{store:\'etcfee\',qFields'].forEach((머리) => {
    const 시작 = SRC.indexOf(머리); assert.ok(시작 > 0, 머리);
    const a = SRC.indexOf('row:(r,p)=>`', 시작);
    const 끝 = SRC.indexOf('</tr>`', a);
    const 식 = SRC.slice(a + 'row:'.length, 끝 + '</tr>`'.length);
    const ctx = {
      escapeHtml: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])),
      _jsAttr: (s) => String(s == null ? '' : s).replace(/'/g, "\\'"),
      formatDate: (s) => s, rowActions: () => '', Number
    };
    vm.createContext(ctx);
    const fn = vm.runInContext('(' + 식 + ')', ctx);
    const html = fn({ id: "M'1", _st: 'meetfee', date: '2026.09.18', type: 악성, content: 악성, org: 악성, amt: 1000 }, 'meetfee');
    assert.ok(html.indexOf('<img') < 0, '★ ' + 머리.split(':')[0] + ' 줄에 날것 태그가 그대로 들어갑니다 — 영수증 글자가 화면에서 실행됩니다');
    assert.ok(html.indexOf('&lt;img') >= 0, '글자는 보여야 합니다(감싸서)');
    assert.ok(html.indexOf("feeConsentDoc('" + (머리.startsWith('meetfee') ? 'meetfee' : 'etcfee') + "','M\\'1')") >= 0,
      '★ 번호의 따옴표를 안 막아 단추가 깨집니다(CSV 로 가져온 번호에 「\'」가 있으면)');
    /* 합친 표(비용 목록)에는 기타비용 통에서 온 줄이 섞여 있다 — 그 줄은 «자기 통»을 넘겨야 한다.
       안 넘기면 동의서를 만든 날(consentAt)이 남의 통에 적히고 정산이 못 읽는다. */
    if (머리.startsWith('meetfee')) {
      const 섞인 = fn({ id: 'EF0001', _st: 'etcfee', date: '2026.09.18', type: '식대', content: 'x', org: 'y', amt: 1 }, 'meetfee');
      assert.ok(섞인.indexOf("feeConsentDoc('etcfee','EF0001')") >= 0,
        '★ 합친 표에서 기타비용 줄이 «meetfee» 로 동의서를 만듭니다 — 만든 날이 남의 통에 적힙니다');
    }
  });
});
