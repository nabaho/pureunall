/* 푸른 캘린더 › 🧑‍💼 컨설턴트 모집 일정 (대표 결정 2026-10-04 「구글과 푸른 둘 다」)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 이 검사가 지키는 것
     ① 칩 둘 — [모집 준비](모집 달의 앞 달 1일, 해마다) · [마감](log[기관][해].due)
     ② 셈은 GovRecruit 한 곳 — PuCalRecruit 는 «불러 쓸» 뿐이다(가짜 GovRecruit 로 확인)
     ③ 폴더 이름(scan.name)은 칩 어디에도 안 들어간다
     ④ 공지 링크는 recruit.url 덮어쓰기를 따르고, http(s) 만 받는다
     ⑤ 대표일 때만 읽는다 — 직원이면 gov/ 를 건드리지도 않는다
     ⑥ 못 읽어도(permission_denied) 화면은 멀쩡하다 — 층만 빈다
     ⑦ 이알피 data/ 에 쓰지 않는다 — 읽기만 한다
   pu-cal.html 의 함수들을 vm 에 떼어 올려 «실제로» 돌린다(글자만 찾지 않는다). */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const GR = require(path.join(ROOT, 'js', 'gov-recruit.js'));
const M = require(path.join(ROOT, 'js', 'pu-cal-recruit.js'));
const HTML = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8').replace(/\r\n/g, '\n');

/* 3월에 해마다 낸 지방공기업평가원 · 1월에 낸 노사발전재단 */
const T = (y, m, d) => new Date(y, m - 1, d).getTime();
const 폴더이름 = '2025 지방공기업평가원 자문위원 신청서_비밀메모';
const RECRUIT = {
  scan: [
    { y: '2024', name: '2024 지방공기업평가원 자문위원', dir: 'a', t: T(2024, 3, 10) },
    { y: '2025', name: 폴더이름, dir: 'a', t: T(2025, 3, 12) },
    { y: '2025', name: '2025 노사발전재단 일터혁신 컨설턴트', dir: 'b', t: T(2025, 1, 20) },
    { y: '2025', name: '2025 아무데도 안 묶이는 서류', dir: 'c', t: T(2025, 6, 1) }
  ],
  log: { erc: { '2027': { st: '지원 예정', due: '2027-03-20' }, '2026': { due: '2026-03-18' } } },
  url: {},
  custom: []
};
const 다른것 = (x) => JSON.parse(JSON.stringify(x));

/* ── 순수 모듈 ── */

test('①★ 모집 준비 — 모집 달(3월)의 앞 달 1일에 해마다 뜬다', () => {
  const r = M.chips({ recruit: RECRUIT, GovRecruit: GR, from: '2027-01-31', to: '2027-03-13', sid: 'P-001' });
  const 준비 = r.filter(c => c.kind === 'recruit-prep' && c.key === 'erc');
  assert.strictEqual(준비.length, 1, '준비 칩이 한 번 떠야 합니다');
  assert.strictEqual(준비[0].date, '2027-02-01');
  assert.match(준비[0].text, /\[모집 준비\] 지방공기업평가원 — 보통 3월 모집/);
  assert.strictEqual(준비[0].movable, false);
  assert.strictEqual(준비[0].sid, 'P-001');
  /* 다른 해에도 같은 날 */
  const r2 = M.chips({ recruit: RECRUIT, GovRecruit: GR, from: '2031-02-01', to: '2031-02-01' });
  assert.ok(r2.some(c => c.kind === 'recruit-prep' && c.key === 'erc'), '★ 해마다 떠야 합니다');
  /* 범위 밖이면 안 뜬다 */
  const r3 = M.chips({ recruit: RECRUIT, GovRecruit: GR, from: '2027-02-02', to: '2027-02-28' });
  assert.ok(!r3.some(c => c.kind === 'recruit-prep' && c.key === 'erc'), '★ 범위 밖 준비 칩이 떴습니다');
});

test('①-2 1월 모집이면 «앞 해» 12월 1일에 뜨고, 상태는 «모집 해»의 것을 보인다', () => {
  const rc = 다른것(RECRUIT); rc.log.nosa = { '2027': { st: '지원함' } };
  const r = M.chips({ recruit: rc, GovRecruit: GR, from: '2026-11-29', to: '2027-01-09' });
  const c = r.find(x => x.kind === 'recruit-prep' && x.key === 'nosa');
  assert.ok(c, '노사발전재단 준비 칩이 없습니다');
  assert.strictEqual(c.date, '2026-12-01');
  assert.ok(c.rows.some(w => w.t === '2027년 상태: 지원함'), '★ 모집이 열리는 해(2027)의 상태가 아닙니다');
});

test('①-3★ 마감 — 적어 둔 날에, 범위 안의 것만', () => {
  const r = M.chips({ recruit: RECRUIT, GovRecruit: GR, from: '2027-03-01', to: '2027-03-31' });
  const 마감 = r.filter(c => c.kind === 'recruit-due');
  assert.deepStrictEqual(마감.map(c => c.date), ['2027-03-20'], '★ 마감 칩이 틀렸습니다');
  assert.match(마감[0].text, /\[마감\] 지방공기업평가원 컨설턴트 지원/);
  assert.ok(마감[0].rows.some(w => w.t === '2027년 상태: 지원 예정'));
  const 없음 = M.chips({ recruit: RECRUIT, GovRecruit: GR, from: '2027-04-01', to: '2027-04-30' });
  assert.ok(!없음.some(c => c.kind === 'recruit-due'), '★ 다른 달 마감이 떴습니다');
});

test('②★ 셈은 GovRecruit 한 곳 — 가짜 GovRecruit 를 주면 그 답대로 그린다', () => {
  const 가짜 = {
    group: () => ({ orgs: [{ id: 'x', name: '가짜기관', what: '', url: '', years: ['2025'], month: 7, custom: false }], rest: [] }),
    order: (orgs) => orgs,
    prepDate: (m, today) => (today <= new Date(2027, 4, 17) ? new Date(2027, 4, 17) : null)
  };
  const r = M.chips({ recruit: RECRUIT, GovRecruit: 가짜, from: '2027-05-01', to: '2027-05-31' });
  assert.deepStrictEqual(r.map(c => [c.date, c.key]), [['2027-05-17', 'x']],
    '★ PuCalRecruit 가 GovRecruit 의 묶기·날짜 셈을 따르지 않고 제 손으로 셉니다');
  /* «지원한 적 있는 곳만» 고르는 것도 GovRecruit.order 다 — 그것이 다 빼면 칩도 없다 */
  const 빼는 = Object.assign({}, 가짜, { order: () => [] });
  assert.strictEqual(M.chips({ recruit: RECRUIT, GovRecruit: 빼는, from: '2027-05-01', to: '2027-05-31' }).length, 0,
    '★ GovRecruit.order 를 거치지 않습니다(정부사업신청 목록과 달력이 갈립니다)');
  /* 그리고 화면은 GovRecruit 를 싣는다 — 두 벌이면 정부사업신청과 날짜가 어긋난다 */
  assert.match(HTML, /<script src="js\/gov-recruit\.js\?v=\d+"><\/script>/);
  assert.match(HTML, /<script src="js\/pu-cal-recruit\.js\?v=\d+"><\/script>/);
  assert.ok(HTML.indexOf('js/gov-recruit.js') < HTML.indexOf('js/pu-cal-recruit.js'), 'GovRecruit 를 먼저 실어야 합니다');
});

test('③★ 폴더 이름은 칩 어디에도 없다 — 기관 이름만', () => {
  const r = M.chips({ recruit: RECRUIT, GovRecruit: GR, from: '2026-01-01', to: '2027-12-31' });
  assert.ok(r.length >= 4, '칩이 너무 적습니다: ' + r.length);
  const 글 = JSON.stringify(r);
  ['비밀메모', '신청서_', '아무데도', '자문위원 신청'].forEach(w =>
    assert.ok(!글.includes(w), '★ 폴더 이름(' + w + ')이 일정에 새었습니다'));
});

test('④★ 공지 링크 — 덮어쓴 주소를 따르고, http(s) 가 아니면 버린다', () => {
  const rc = 다른것(RECRUIT); rc.url = { erc: 'https://example.org/notice' };
  const r = M.chips({ recruit: rc, GovRecruit: GR, from: '2027-02-01', to: '2027-02-01' });
  const c = r.find(x => x.key === 'erc');
  assert.strictEqual(c.url, 'https://example.org/notice', '★ recruit.url 덮어쓰기가 반영되지 않았습니다');
  rc.url = { erc: 'javascript:alert(1)' };
  const r2 = M.chips({ recruit: rc, GovRecruit: GR, from: '2027-02-01', to: '2027-02-01' });
  const c2 = r2.find(x => x.key === 'erc');
  assert.strictEqual(c2.url, '', '★ javascript: 주소가 링크로 나갑니다');
  assert.ok(!JSON.stringify(c2).includes('javascript:'), '★ 줄에도 남았습니다');
});

test('④-2 파이어베이스가 배열을 {0:…} 로 돌려줘도 읽는다', () => {
  const rc = 다른것(RECRUIT);
  rc.scan = Object.assign({}, rc.scan);
  const r = M.chips({ recruit: rc, GovRecruit: GR, from: '2027-02-01', to: '2027-02-01' });
  assert.ok(r.some(c => c.key === 'erc'));
});

test('⑤ 대표 판정 — P-001 · 권형하 만', () => {
  assert.strictEqual(M.isOwner({ sid: 'P-001' }), true);
  assert.strictEqual(M.isOwner({ sid: 'p001' }), true);
  assert.strictEqual(M.isOwner({ sid: 'X', name: '권형하' }), true);
  assert.strictEqual(M.isOwner({ sid: 'P-002', name: '박한별' }), false);
  assert.strictEqual(M.isOwner({ sid: 'P-0011' }), false);
  assert.strictEqual(M.isOwner(null), false);
  assert.deepStrictEqual(M.chips({}), [], '빈 입력에 터지면 안 됩니다');
  assert.deepStrictEqual(M.chips({ recruit: null, GovRecruit: GR, from: '2027-01-01', to: '2027-01-31' }), []);
});

/* ── 화면(pu-cal.html) — 함수들을 떼어 vm 에서 실제로 돌린다 ── */

function 함수(이름) {
  const i = HTML.indexOf('\nfunction ' + 이름 + '(');
  assert.ok(i >= 0, 'pu-cal.html 에 ' + 이름 + ' 가 없습니다');
  const j = HTML.indexOf('\n}\n', i);
  return HTML.slice(i + 1, j + 2);
}
function 변수(이름) {
  const m = new RegExp('\\nvar ' + 이름 + ' = [^\\n]*\\n').exec(HTML);
  assert.ok(m, 'pu-cal.html 에 var ' + 이름 + ' 이 없습니다');
  return m[0];
}

function 상자(opt) {
  opt = opt || {};
  const 읽은곳 = [], 쓴곳 = [];
  const fbDb = {
    ref(p) {
      return {
        once() {
          읽은곳.push(p);
          if (opt.deny) return Promise.reject(Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' }));
          return Promise.resolve({ val: () => (opt.data === undefined ? 다른것(RECRUIT) : opt.data) });
        },
        set() { 쓴곳.push(p); return Promise.resolve(); },
        update() { 쓴곳.push(p); return Promise.resolve(); },
        push() { 쓴곳.push(p); return Promise.resolve(); }
      };
    }
  };
  const ctx = {
    console: { warn() {}, log() {} },
    GovRecruit: GR, PuCalRecruit: M, fbDb,
    ME: opt.me === undefined ? { sid: 'P-001', name: '권형하' } : opt.me,
    S: { uid: 'U1', filter: opt.filter === undefined ? null : opt.filter, view: 'month', ym: '2027-02', date: '2027-02-01' },
    D: {}, GCAL: { evs: [] }, renders: 0,
    arr: (v) => (Array.isArray(v) ? v : []),
    colorOf: () => '#123456', nameOf: () => '', externalOf: () => null, holidayOf: () => '',
    monthGrid: () => [{ date: '2027-01-31' }, { date: '2027-03-13' }],
    weekDays: () => [], esc: (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    document: { addEventListener() {} }
  };
  ctx.render = () => { ctx.renders++; };
  vm.createContext(ctx);
  const 코드 = [변수('RECRUIT'), 변수('_모집칩'), 함수('보이는범위'), 함수('모집칩'), 함수('모집받기'),
    함수('eventsOn'), 함수('passFilter'), 함수('층상세'), 함수('detailHtml'), 함수('긴날짜'), 함수('시분')].join('\n');
  vm.runInContext(코드, ctx);
  return { ctx, 읽은곳, 쓴곳 };
}

test('⑤★ 화면 — 대표면 gov/{uid}/recruit 만 읽고 달력에 얹는다, 쓰지 않는다', async () => {
  const { ctx, 읽은곳, 쓴곳 } = 상자();
  await ctx.모집받기();
  assert.deepStrictEqual(읽은곳, ['gov/U1/recruit'], '★ 대표 «본인» 자리만 읽어야 합니다');
  assert.deepStrictEqual(쓴곳, [], '★ 어디에도 쓰면 안 됩니다(이알피 data/ 포함)');
  assert.ok(ctx.renders >= 1, '받은 뒤 다시 그려야 합니다');
  const 그날 = ctx.eventsOn('2027-02-01');
  const c = 그날.find(e => e.kind === 'recruit-prep');
  assert.ok(c, '★ 준비 칩이 달력에 안 얹혔습니다');
  assert.strictEqual(c.movable, false);
  assert.strictEqual(c.store, '', '★ 저장 표가 붙으면 고치기 창이 열려 data/ 에 쓰려 듭니다');
  const 마감날 = ctx.eventsOn('2027-03-20');
  assert.strictEqual(마감날.length, 0, '보이는 범위(01-31~03-13) 밖 마감은 안 떠야 합니다');
});

test('⑤-2★ 화면 — 직원이면 gov/ 를 읽지도 않고 층이 빈다', async () => {
  const { ctx, 읽은곳 } = 상자({ me: { sid: 'P-002', name: '박한별' } });
  await ctx.모집받기();
  assert.deepStrictEqual(읽은곳, [], '★ 직원 화면이 대표 자리(gov/)를 읽으려 합니다');
  assert.strictEqual(ctx.eventsOn('2027-02-01').length, 0);
  const 모름 = 상자({ me: null });
  await 모름.ctx.모집받기();
  assert.deepStrictEqual(모름.읽은곳, [], '★ 누군지 모르는데 읽습니다');
});

test('⑥★ 못 읽으면(permission_denied) 조용히 — 터지지 않고 층만 빈다', async () => {
  const { ctx } = 상자({ deny: true });
  await ctx.모집받기();          // 던지면 이 줄에서 실패한다
  assert.strictEqual(ctx.eventsOn('2027-02-01').length, 0);
  const 빈 = 상자({ data: null });
  await 빈.ctx.모집받기();
  assert.strictEqual(빈.ctx.eventsOn('2027-02-01').length, 0);
});

test('⑦ 거르개 — 구글·이음만 보기에선 빠지고, 🔒 개인에선 보이고, 👥 공용에선 빠진다', async () => {
  for (const [f, 보임] of [[null, true], ['pureun', true], ['P-001', true], ['priv', true],
                          ['gcal', false], ['eumwork', false], ['P-002', false], ['shared', false]]) {
    const { ctx } = 상자({ filter: f });
    await ctx.모집받기();
    const 있음 = ctx.eventsOn('2027-02-01').filter(ctx.passFilter).some(e => e.kind === 'recruit-prep');
    assert.strictEqual(있음, 보임, '거르개 ' + f + ' 에서 ' + (보임 ? '보여야' : '빠져야') + ' 합니다');
    /* 사건 기한 층(④)과 같은 약속 — 층을 만들 때부터 뺀다(칩 옆 「겹친 날」 수도 eventsOn 을 센다) */
    if (f === 'gcal' || f === 'eumwork' || f === 'P-002') {
      assert.ok(!ctx.eventsOn('2027-02-01').some(e => e.kind === 'recruit-prep'), '★ 거르개 ' + f + ' 인데 층에 들어갑니다');
    }
  }
});

test('⑦-2★ 같은 날 두 기관 — 상세 창이 «제 기관»을 연다(번호가 겹치지 않는다)', async () => {
  const rc = 다른것(RECRUIT);
  rc.scan.push({ y: '2025', name: '2025 소상공인 역량강화 컨설턴트', dir: 'd', t: T(2025, 3, 2) });
  rc.url = { semas: 'https://example.org/semas' };
  const { ctx } = 상자({ data: rc });
  await ctx.모집받기();
  const 둘 = ctx.eventsOn('2027-02-01').filter(e => e.kind === 'recruit-prep');
  assert.strictEqual(둘.length, 2);
  assert.notStrictEqual(둘[0].id, 둘[1].id, '★ 번호가 겹쳐 둘째 것을 눌러도 첫째가 열립니다');
  const 소 = 둘.find(e => /소상공인/.test(e.text));
  const 상세 = ctx.층상세('2027-02-01', 소.id);
  assert.match(상세.title, /소상공인/);
  ctx.S.detail = 상세;
  const html = ctx.detailHtml();
  assert.match(html, /<a class="btn ghost" href="https:\/\/example\.org\/semas" target="_blank" rel="noopener">🔗 공지 열기<\/a>/,
    '★ 상세 창에 공지 링크가 없습니다');
  /* 링크 없는 기관은 단추를 안 그린다 */
  ctx.S.detail = Object.assign({}, 상세, { link: '' });
  assert.ok(!/공지 열기/.test(ctx.detailHtml()));
  ctx.S.detail = Object.assign({}, 상세, { link: 'javascript:alert(1)' });
  assert.ok(!/공지 열기/.test(ctx.detailHtml()), '★ http(s) 가 아닌 주소로 단추를 그립니다');
});
