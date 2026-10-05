'use strict';
/* 홈페이지 월간 자동 연결 — 자문사현황 «로고 글»을 업체(companyId)와 잇고, 계약이 끝나도
   남길 곳은 «남기기»로 둔다 (설계 2026-10-05).
   ★ 자동 내리기는 이어 둔 로고만 내린다. 같은 글 번호를 두 회사가 쓰면 안 된다.
   ★ 업체 자리를 «통째로» 덮는 저장이 하나라도 남으면 이은 번호·남기기가 조용히 지워진다 —
     그래서 기존 저장 셋(표시·한 번에 고르기·표시 지우기)도 함께 돌려 본다.
   ★ 이름은 예시(가나상사·다라산업)만. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(R, 'pu-home.html'), 'utf8');

function fnSource(name) {
  const re = new RegExp('(?:^|\\n)(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(html);
  assert.ok(m, name + ' 를 화면에서 찾지 못했습니다');
  const start = m.index + (m[0][0] === '\n' ? 1 : 0);
  let mode = null, depth = 0;
  for (let i = html.indexOf('{', start); i < html.length; i++) {
    const c = html[i], n = html[i + 1];
    if (mode === '/*') { if (c === '*' && n === '/') { mode = null; i++; } continue; }
    if (mode === '//') { if (c === '\n') mode = null; continue; }
    if (mode) { if (c === '\\') { i++; continue; } if (c === mode) mode = null; continue; }
    if (c === '/' && n === '*') { mode = '/*'; i++; continue; }
    if (c === '/' && n === '/') { mode = '//'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { mode = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}

/* 지금 홈페이지 자문사현황의 «모양»을 본뜬 것 (2026-10-05 읽기만 해서 본 모양, 회사명은 예시) */
const 쪽 = '<div class="bh gall_logo bh_widget_wrap" data-skin="gall_logo"><div class="bh bh_widget_content bh_row">'
  + '<div class="bh bh_item item item1 col-6 lg:col-2_5"> <div class="bh bh_item_inner dark:bh_bd_color_t">'
  + ' <div class="bh bh_img_content clearfix"> <img src="/files/attach/images/2025/11/27/aaa.png" alt="가나상사"> </div> </div>'
  + ' <!-- <a href="https://푸른노무법인.kr/partner_board/185" data-srl="185"></a>가나상사 --></div>'
  + '<div class="bh bh_item item item2 col-6 lg:col-2_5"> <div class="bh bh_item_inner dark:bh_bd_color_t">'
  + ' <div class="bh bh_img_content clearfix"> <img src="/files/attach/images/2025/11/27/bbb.png" alt="다라산업"> </div> </div>'
  + ' <!-- <a href="https://푸른노무법인.kr/partner_board/179" data-srl="179"></a>다라산업 --></div>'
  + '<div class="bh bh_item item item3 col-6 lg:col-2_5"> <div class="bh bh_item_inner dark:bh_bd_color_t">'
  + ' <div class="bh bh_img_content clearfix"> <img src="/files/attach/images/2025/11/27/aaa.png" alt="가나상사"> </div> </div>'
  + ' <!-- <a href="https://푸른노무법인.kr/partner_board/185" data-srl="185"></a>가나상사 --></div>'
  + '</div></div><footer><img src="/assets/images/icon/x.png"></footer>';

function 부품상자() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-home-parse.js'), 'utf8'), ctx);
  return ctx;
}

test('로고 목록 읽기 — 글 번호·그림·이름을 차례대로, 같은 번호는 한 번만', () => {
  const ctx = 부품상자();
  const r = JSON.parse(JSON.stringify(ctx.PuHomeParse.parsePartners(쪽)));
  assert.deepStrictEqual(r.map(x => x.srl), [185, 179]);
  assert.ok(r[0].img.endsWith('aaa.png'));
  assert.strictEqual(r[1].alt, '다라산업');
});

test('로고 목록 읽기 — 로고 칸 밖의 그림(아이콘)은 안 든다, 빈 글자는 빈 목록', () => {
  const ctx = 부품상자();
  const r = ctx.PuHomeParse.parsePartners(쪽);
  assert.ok(r.every(x => !/icon/.test(x.img)));
  assert.strictEqual(ctx.PuHomeParse.parsePartners('').length, 0);
  assert.strictEqual(ctx.PuHomeParse.parsePartners(null).length, 0);
});

/* 가짜 db — 어느 자리에 무엇을 «어떻게» 썼는지 남긴다 */
function 상자(더) {
  const 쓴것 = [];
  const ctx = Object.assign({
    console: { warn() {}, log() {} },
    PARTNER_PATH: 'homepage/partners',
    App: { partners: {}, render() {}, isAdmin: true },
    db: { ref: (p) => ({
      set: async (v) => { 쓴것.push(['set', p, v]); },
      update: async (v) => { 쓴것.push(['update', p, v]); },
      remove: async () => { 쓴것.push(['remove', p]); }
    }) },
    esc: (s) => String(s == null ? '' : s),
    toast() {}, say: async () => {}, askYes: async () => true,
    currentUserName: () => '관리자', todayString: () => '2026-10-05',
    window: {}
  }, 더 || {});
  ctx.쓴것 = 쓴것;
  vm.createContext(ctx);
  vm.runInContext(['로고잇기', '로고남기기', 'setPosted', 'clearPosted', 'partnerPatch']
    .map(fnSource).join('\n'), ctx);
  return ctx;
}

test('로고 잇기는 그 회사의 boardSrl «한 자리»만 쓴다', async () => {
  const ctx = 상자();
  ctx.App.partners = { C1: { posted: true, why: '메모' } };
  assert.strictEqual(await ctx.로고잇기('C1', 185), true);
  assert.deepStrictEqual(ctx.쓴것.map(x => [x[0], x[1], x[2]]), [['set', 'homepage/partners/C1/boardSrl', 185]]);
  assert.strictEqual(ctx.App.partners.C1.boardSrl, 185);
  assert.strictEqual(ctx.App.partners.C1.why, '메모');
});

test('로고 잇기 — 같은 글 번호를 다른 회사가 이미 쓰면 거절한다', async () => {
  const ctx = 상자();
  ctx.App.partners = { C2: { boardSrl: 185 } };
  assert.strictEqual(await ctx.로고잇기('C1', 185), false);
  assert.strictEqual(ctx.쓴것.length, 0);
});

test('로고 잇기 — 잘못된 번호는 거절한다', async () => {
  const ctx = 상자();
  for (const 못된것 of [0, -1, '', 'abc', 1.5]) {
    assert.strictEqual(await ctx.로고잇기('C1', 못된것), false, String(못된것));
  }
  assert.strictEqual(ctx.쓴것.length, 0);
});

test('남기기는 사유가 있어야 한다 — 사유 없는 예외는 나중에 왜 남겼는지 모른다', async () => {
  const ctx = 상자();
  assert.strictEqual(await ctx.로고남기기('C1', '  '), false);
  assert.strictEqual(ctx.쓴것.length, 0);
  assert.strictEqual(await ctx.로고남기기('C1', '실적으로 남김'), true);
  assert.strictEqual(ctx.쓴것[0][1], 'homepage/partners/C1/keep');
  assert.strictEqual(ctx.쓴것[0][2].why, '실적으로 남김');
});

test('★ 올림 표시 저장이 이은 번호·남기기를 지우지 않는다', async () => {
  const ctx = 상자();
  ctx.App.partners = { C1: { boardSrl: 185, keep: { why: '실적' } } };
  await ctx.setPosted('C1', true, '');
  assert.ok(ctx.쓴것.every(x => x[0] !== 'set' || /\/(posted|why)$/.test(x[1])), '업체 자리를 통째로 set 합니다');
  assert.strictEqual(ctx.App.partners.C1.boardSrl, 185);
  assert.strictEqual(ctx.App.partners.C1.keep.why, '실적');
  assert.strictEqual(ctx.App.partners.C1.posted, true);
});

test('★ 표시 지우기가 이은 번호·남기기를 지우지 않는다', async () => {
  const ctx = 상자();
  ctx.App.partners = { C1: { posted: true, why: 'x', boardSrl: 185, keep: { why: '실적' } } };
  ctx.App.draft = { kind: 'partner', key: 'C1' };
  await ctx.clearPosted();
  assert.ok(!ctx.쓴것.some(x => x[0] === 'remove' && x[1] === 'homepage/partners/C1'), '업체 자리를 통째로 지웁니다');
  assert.strictEqual(ctx.App.partners.C1.boardSrl, 185);
  assert.ok(!('posted' in ctx.App.partners.C1), '표시가 안 지워졌습니다');
});

test('★ 한 번에 고르기 저장 — 업체마다 «칸 단위»로 쓴다(업체 자리를 통째로 갈지 않는다)', () => {
  const ctx = 상자();
  const 평평 = JSON.parse(JSON.stringify(ctx.partnerPatch({ C1: { posted: true, why: '' }, C2: { posted: false, why: 'x' } })));
  assert.deepStrictEqual(Object.keys(평평).sort(), ['C1/posted', 'C1/why', 'C2/posted', 'C2/why']);
  assert.match(fnSource('pickSave'), /partnerPatch\(/, '한 번에 고르기 저장이 칸 단위로 쓰지 않습니다');
});

function 편집칸상자(partners) {
  const ctx = { App: { partners: partners }, esc: (s) => String(s == null ? '' : s) };
  vm.createContext(ctx);
  vm.runInContext(fnSource('partnerMark') + '\n' + fnSource('로고연결칸Html'), ctx);
  return ctx;
}

test('편집칸의 로고 줄 — 안 이었으면 잇기 창으로, 이었으면 번호와 풀기', () => {
  const 안이음 = 편집칸상자({ C1: { posted: true } }).로고연결칸Html({ key: 'C1' });
  assert.match(안이음, /로고잇기창\(\)/, '안 이었는데 잇는 길이 없습니다');
  const 이음 = 편집칸상자({ C1: { boardSrl: 185 } }).로고연결칸Html({ key: 'C1' });
  assert.ok(이음.includes('185'), '이은 번호가 안 보입니다');
  assert.match(이음, /로고잇기풀기\('C1'\)/);
  assert.ok(!/로고잇기창\(\)/.test(이음), '이미 이었는데 또 잇기를 권합니다');
});

test('편집칸의 로고 줄 — 남기기는 사유 칸과 함께, 남겼으면 사유를 보여 준다', () => {
  const 안남김 = 편집칸상자({ C1: {} }).로고연결칸Html({ key: 'C1' });
  assert.match(안남김, /로고남기기\('C1'/);
  assert.match(안남김, /<input/);
  const 남김 = 편집칸상자({ C1: { keep: { why: '실적으로 남김' } } }).로고연결칸Html({ key: 'C1' });
  assert.ok(남김.includes('실적으로 남김'));
  assert.match(남김, /로고남기기풀기\('C1'\)/);
});

test('★ 창 제목 함수(modalHead)가 «정의돼» 있다 — 없으면 구성원 넣기·자문사 로고 창이 안 열린다', () => {
  /* 2026-10-05 에 보니 한 번도 정의된 적이 없었다. 검사가 가짜를 넣어 돌려서 못 잡았다. */
  const ctx = { esc: (s) => String(s).replace(/</g, '&lt;') };
  vm.createContext(ctx);
  vm.runInContext(fnSource('modalHead'), ctx);
  const h = ctx.modalHead('<가나>');
  assert.ok(h.includes('&lt;가나'), '제목을 거르지 않고 그대로 넣습니다');
});

test('★ 화면이 부르는 창 함수(modal…)는 모두 화면에 정의돼 있다', () => {
  const 부름 = new Set([...html.matchAll(/\b(modal[A-Z]\w*)\(/g)].map(m => m[1]));
  for (const 이름 of 부름) {
    assert.match(html, new RegExp('function\\s+' + 이름 + '\\s*\\('), 이름 + ' 을 부르는데 정의가 없습니다');
  }
});
