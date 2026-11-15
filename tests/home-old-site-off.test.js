'use strict';
/* 옛 홈페이지(라이믹스 · 푸른노무법인.kr)를 접는다 — 대표 결정 2026-11-15 「푸른노무법인.kr 더이상 연장 안한다」
   (2026-11-27 만료). 손님이 보는 홈페이지는 새 사이트(nabaho/pureun-site · pureunlabor.co.kr) 하나다.

   ★ 여기서 못 박는 것
     ① 서버는 옛 사이트로 «요청 자체»를 안 보낸다 — 만료 도메인을 남이 다시 사면 관리자 계정이 그리로 간다.
        관리자 로그인·읽기·고치기·매달 자동이 모두 «보내기 전에» 멈추고, 매달 자동은 옛 게시판 일만 건너뛴다.
     ② 화면의 읽기(다시 확인·쪽 읽어오기)는 새 사이트 원본에서, 「저장하고 반영」은 새 사이트 구성원 쪽 올리기로.
     ③ 옛 사이트에만 있던 칸(사진 바꾸기·자동 연결 카드·새로 올리기·로고와 잇기)은 숨긴다.
     ④ 새 사이트 원본을 «지금 해석 부품»이 그대로 읽는다(구성원 글 번호·경력, 쪽 고칠 줄).
   ★ 돌려서 본다(STATUS 「되풀이된 실수 ②」) — 함수를 떠 상자(vm)에서 부르고, 스위치를 뺀 «대조군»과 견준다.
   실행: node --test tests/home-old-site-off.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(R, 'pu-home.html'), 'utf8');
const 서버원문 = fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8');
const 서버 = 서버원문.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const HF = require('../functions/homepage-fetch.js');

/* ── 떠 오기 ── */
function fnSource(src, name) {
  const re = new RegExp('(?:^|\\n)(?:async\\s+)?function\\s+' + name + '\\s*\\(');
  const m = re.exec(src);
  assert.ok(m, name + ' 를 찾지 못했습니다');
  const start = m.index + (m[0][0] === '\n' ? 1 : 0);
  let mode = null, depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    const c = src[i], n = src[i + 1];
    if (mode === '/*') { if (c === '*' && n === '/') { mode = null; i++; } continue; }
    if (mode === '//') { if (c === '\n') mode = null; continue; }
    if (mode) { if (c === '\\') { i++; continue; } if (c === mode) mode = null; continue; }
    if (c === '/' && n === '*') { mode = '/*'; i++; continue; }
    if (c === '/' && n === '/') { mode = '//'; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { mode = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}
const 화면함수 = (name) => fnSource(html, name);
// 서버 함수는 «원문»에서 뜬다 — 주석을 걷은 글은 Accept 머리말의 «별·빗금·별» 문자열이 주석 걷기를 속여
// 함수 몸이 잘린다. (fnSource 는 문자열·주석을 스스로 건너뛰며 괄호를 센다)
const 서버함수 = (name) => fnSource(서버원문, name);
function constLine(name) {
  const m = new RegExp('\\nconst ' + name + ' = [^\\n]*;').exec(html);
  assert.ok(m, 'const ' + name + ' 을 찾지 못했습니다');
  return m[0].replace(/\nconst /, '\nvar ');
}
function 덩어리(이름) {
  const i = 서버.indexOf('exports.' + 이름 + ' =');
  assert.ok(i >= 0, 이름 + ' 이 없습니다');
  const j = 서버.indexOf('\nexports.', i + 10);
  return 서버.slice(i, j < 0 ? undefined : j);
}

/* ══════ ① 서버 — 옛 사이트로 «보내기 전에» 멈춘다 ══════ */

test('★ 화면과 서버의 스위치가 «같은 말»을 한다 — 하나만 바꾸면 반쪽만 접힌다', () => {
  const m = /\nconst OLD_SITE_OFF = (true|false);/.exec(html);
  assert.ok(m, '★ 화면에 OLD_SITE_OFF 가 없습니다');
  assert.equal(typeof HF.OLD_SITE_CLOSED, 'boolean', '★ 서버(homepage-fetch.js)가 OLD_SITE_CLOSED 를 내보내지 않습니다');
  assert.equal(String(HF.OLD_SITE_CLOSED), m[1],
    '★★ 화면(OLD_SITE_OFF=' + m[1] + ')과 서버(OLD_SITE_CLOSED=' + HF.OLD_SITE_CLOSED + ')가 다릅니다 — 둘을 함께 바꿀 것');
  /* 대표 결정 2026-11-15 «연장 안 함» — 값 자체가 결정이다. 검사고정-허용: 되살리는 날 이 줄을 함께 고친다 */
  assert.equal(HF.OLD_SITE_CLOSED, true, '★★ 옛 홈페이지를 접은 결정(2026-11-15)이 풀렸습니다'); // 검사고정-허용 (대표 결정 «푸른노무법인.kr 연장 안 함»)
  assert.match(HF.OLD_SITE_CLOSED_MSG, /접었/, '★ 막을 때 사람에게 할 말이 없습니다');
});

function 서버상자(접음) {
  const 부름 = { fetch: 0, 돌기: 0, db: 0, 비밀: 0 };
  const ctx = {
    OLD_SITE_CLOSED: 접음, OLD_SITE_CLOSED_MSG: HF.OLD_SITE_CLOSED_MSG,
    fetch: async () => { 부름.fetch++; return { status: 200, text: async () => '', headers: { getSetCookie: () => [] } }; },
    HW: {
      브라우저표시: 'x', 로그인화면주소: () => 'https://옛/로그인', 로그인보내는곳: () => 'https://옛/보냄',
      로그인몸통: () => ({ ok: true, 몸통: 'a=b', 칸이름들: ['a'] })
    },
    HA: { 돌기: async () => { 부름.돌기++; return { ok: true, 달: '2026-12', 내림: [], 못내림: [] }; } },
    getDatabase: () => { 부름.db++; return { ref: () => ({}) }; },
    process: { env: new Proxy({}, { get: (t, k) => { if (/HOME_ADMIN/.test(String(k))) 부름.비밀++; return 'x'; } }) },
    서울달: () => '2026-12', Date
  };
  vm.createContext(ctx);
  vm.runInContext([서버함수('홈부르기'), 서버함수('홈로그인'), 서버함수('홈자동한번')].join('\n'), ctx);
  ctx.부름 = 부름;
  return ctx;
}
const 그릇 = () => ({ 있나: () => false, 글자: () => '', 담기() {} });

test('★★★ 접으면 옛 사이트로 가는 문(홈부르기)이 «보내기 전에» 멈춘다 — 요청 0건', async () => {
  const 접 = 서버상자(true);
  await assert.rejects(() => 접.홈부르기('https://옛/어디', 그릇()), /접었/);
  assert.equal(접.부름.fetch, 0, '★★★ 접었는데 옛 사이트로 요청이 나갔습니다');
  const 옛 = 서버상자(false);
  await 옛.홈부르기('https://옛/어디', 그릇());
  assert.equal(옛.부름.fetch, 1, '대조군: 스위치가 꺼져 있으면 요청이 나가야 합니다 — 상자가 문을 못 연다');
});

test('★★★ 접으면 관리자 로그인이 아이디·비밀번호를 «만지기 전»에 멈춘다', async () => {
  const 접 = 서버상자(true);
  await assert.rejects(() => 접.홈로그인('아이디', '비밀', 그릇()), /접었/);
  assert.equal(접.부름.fetch, 0, '★★★ 접었는데 로그인 화면을 받으러 나갔습니다');
  const 옛 = 서버상자(false);
  await 옛.홈로그인('아이디', '비밀', 그릇());
  assert.ok(옛.부름.fetch >= 2, '대조군: 스위치가 꺼져 있으면 로그인 두 걸음이 나가야 합니다');
});

test('★★ 접으면 매달 자동은 옛 게시판 일을 «통째로» 건너뛴다 — 비밀값도 자료도 안 건드린다', async () => {
  const 접 = 서버상자(true);
  const r = await 접.홈자동한번('돌리기', '', 'auto');
  assert.equal(r.접음, true, '★★ 접었다는 답이 없습니다 — 매달 기록이 「실패」로 쌓인다');
  assert.equal(r.ok, true);
  assert.equal(접.부름.돌기, 0, '★★ 접었는데 옛 게시판 고르기(돌기)를 돌렸습니다 — 「못 내림」 할 일만 쌓인다');
  assert.equal(접.부름.비밀, 0, '★★★ 접었는데 관리자 비밀값을 꺼냈습니다');
  assert.equal(접.부름.fetch, 0);
  const 옛 = 서버상자(false);
  await 옛.홈자동한번('보기', '', 'u').catch(() => {});
  assert.ok(옛.부름.돌기 === 1, '대조군: 스위치가 꺼져 있으면 돌기를 불러야 합니다');
});

test('★★ 매달 실행은 옛 일을 건너뛰어도 «새 사이트 재게시»는 그대로 돈다 — config.off 로 끄지 않는다', () => {
  const b = 덩어리('monthlyHomepageAuto');
  assert.match(b, /홈자동한번\(\s*"돌리기"/);
  const 옛일 = b.indexOf('홈자동한번('), 새일 = b.indexOf('새사이트한번(');
  assert.ok(옛일 > 0 && 새일 > 옛일, '★★ 새 사이트 재게시가 빠졌거나 옛 일보다 앞입니다');
  /* 옛 일 결과로 return 해 버리면 새 사이트 재게시가 안 돈다 */
  assert.ok(!/if \(r\.접음\)[^;]*return/.test(b), '★★ 접었다고 새 사이트 재게시까지 건너뜁니다');
  assert.ok(!/config[^;]*off\s*=\s*true/.test(서버), '★★ 자동 연결 전체 스위치(config.off)를 켭니다 — 새 사이트 재게시까지 멈춘다');
});

test('★★ 읽기(readHomepage)·고치기(homepageWrite)는 «재직 확인 뒤, 나가기·비밀값 전»에 접음으로 돌려보낸다', () => {
  const 읽기 = 덩어리('readHomepage');
  const 문 = 읽기.indexOf('STAFF_GATE.assertActive'), 접 = 읽기.indexOf('if (OLD_SITE_CLOSED)'), 나감 = 읽기.indexOf('await fetch(');
  assert.ok(문 > 0 && 접 > 문, '★ 접음 확인이 재직 확인보다 앞입니다 — 아무나 접음 여부를 떠볼 수 있다');
  assert.ok(나감 > 접, '★★ 옛 사이트로 나간 «뒤»에 접음을 봅니다');
  const 쓰기 = 덩어리('homepageWrite');
  const 문2 = 쓰기.indexOf('STAFF_GATE.assertActive'), 접2 = 쓰기.indexOf('if (OLD_SITE_CLOSED)'), 비밀 = 쓰기.indexOf('process.env.HOME_ADMIN_ID');
  assert.ok(문2 > 0 && 접2 > 문2, '★ 고치기의 접음 확인이 재직 확인보다 앞입니다');
  assert.ok(비밀 > 접2, '★★★ 관리자 비밀값을 꺼낸 «뒤»에 접음을 봅니다');
});

/* ══════ ② 화면 — 읽기·반영이 새 사이트로 간다 ══════ */

test('★★ 「저장하고 반영」 — 접으면 새 사이트 구성원 쪽 올리기(publishPeople), 아니면 옛 고치기', async () => {
  const 부름 = [];
  const 상자 = (접음) => {
    const ctx = {
      App: { draft: { key: 'k', srl: '190', kind: 'member' } },
      saveDraft: async () => true, toast() {},
      publishPeople: async () => { 부름.push('새'); },
      홈페이지바로고치기: async () => { 부름.push('옛'); },
      window: {}
    };
    if (접음) ctx.OLD_SITE_OFF = true;
    vm.createContext(ctx);
    vm.runInContext(화면함수('저장하고반영'), ctx);
    return ctx;
  };
  await 상자(true).저장하고반영();
  assert.deepEqual(부름, ['새'], '★★ 접었는데 옛 관리자 고치기(homepageWrite)로 갑니다 — 매번 「고치지 못했습니다」가 뜬다');
  부름.length = 0;
  await 상자(false).저장하고반영();
  assert.deepEqual(부름, ['옛'], '대조군: 스위치가 없으면 옛 길 그대로여야 합니다(되살릴 길)');
});

test('★★ 「저장하고 반영」 — 저장이 실패하면 올리기로 안 넘어간다(접어도 같다)', async () => {
  let 올림 = 0;
  const ctx = { App: { draft: { key: 'k', srl: '' } }, saveDraft: async () => false, toast() {},
    publishPeople: async () => { 올림++; }, 홈페이지바로고치기: async () => { 올림++; }, OLD_SITE_OFF: true, window: {} };
  vm.createContext(ctx);
  vm.runInContext(화면함수('저장하고반영'), ctx);
  await ctx.저장하고반영();
  assert.equal(올림, 0, '★★ 저장을 못 했는데 홈페이지에 올렸습니다');
});

function 쪽읽기상자(접음) {
  const 부름 = { 새: [], fetch: [], 담음: [] };
  const ctx = {
    App: { reading: '', pageLines: { work1: ['가'] }, render() {} },
    새사이트쪽읽기: async (mid) => { 부름.새.push(mid); return '<html>새 사이트 ' + mid + '</html>'; },
    keepPageHtml: (mid, h) => { 부름.담음.push([mid, h]); return 0; },
    fetch: async (u) => { 부름.fetch.push(u); return { ok: true, json: async () => ({ html: '<html>옛</html>' }) }; },
    firebase: { auth: () => ({ currentUser: { getIdToken: async () => 'tok' } }) },
    console: { warn() {} }, say: async () => {}, toast() {}, window: {}
  };
  if (접음) ctx.OLD_SITE_OFF = true;
  vm.createContext(ctx);
  vm.runInContext(constLine('READ_HOMEPAGE_URL') + '\n' + 화면함수('readOnePage'), ctx);
  ctx.부름 = 부름;
  return ctx;
}

test('★★ 쪽 읽어오기 — 접으면 새 사이트 원본에서 읽고, 옛 서버 함수(readHomepage)는 안 부른다', async () => {
  const 접 = 쪽읽기상자(true);
  await 접.readOnePage('work1', true);
  assert.deepEqual(접.부름.새, ['work1'], '★★ 접었는데 새 사이트에서 안 읽었습니다 — 고칠 줄이 안 그려져 「홈페이지에 올리기」가 안 나온다');
  assert.equal(접.부름.fetch.length, 0, '★★ 접었는데 옛 사이트 읽기 함수를 불렀습니다');
  assert.equal(접.부름.담음.length, 1, '★ 읽은 쪽을 담지 않았습니다');
  assert.match(접.부름.담음[0][1], /새 사이트/);
  const 옛 = 쪽읽기상자(false);
  await 옛.readOnePage('work1', true);
  assert.equal(옛.부름.새.length, 0);
  assert.ok(옛.부름.fetch.length === 1 && 옛.부름.fetch[0] === 옛.READ_HOMEPAGE_URL, '대조군: 스위치가 없으면 옛 읽기 함수로 가야 합니다');
});

test('★★ 새 사이트 쪽 읽기 — 원본 자리·묵은 사본 피하기·못 읽으면 null(「내용 없음」과 구분)', async () => {
  const 부른 = [];
  let 답 = { ok: true, text: async () => '<p>쪽</p>' };
  const ctx = { fetch: async (u) => { 부른.push(u); return 답; } };
  vm.createContext(ctx);
  vm.runInContext(constLine('SITE_BASE') + '\n' + 화면함수('새사이트쪽읽기'), ctx);
  assert.equal(await ctx.새사이트쪽읽기('people'), '<p>쪽</p>');
  assert.ok(부른[0].indexOf(ctx.SITE_BASE + '/people/index.html?t=') === 0, '★★ 엉뚱한 자리를 읽습니다: ' + 부른[0]);
  await ctx.새사이트쪽읽기('');
  assert.ok(부른[1].indexOf(ctx.SITE_BASE + '/index.html?t=') === 0, '★ 첫 쪽(빈 이름)을 못 읽습니다: ' + 부른[1]);
  답 = { ok: false, status: 404, text: async () => '' };
  assert.equal(await ctx.새사이트쪽읽기('work1'), null, '★★ 못 읽은 것을 「내용 있음」처럼 돌려줍니다 — 「다시 확인」이 멀쩡한 쪽을 「안 올라감」으로 몬다');
  const 전 = 부른.length;
  assert.equal(await ctx.새사이트쪽읽기('../files/x'), null, '★★ 이름 규칙을 안 봅니다 — 엉뚱한 자리를 읽는다');
  assert.equal(부른.length, 전, '★★ 이름 규칙에 걸린 것을 읽으러 나갔습니다');
  ctx.fetch = async () => { throw new Error('그물 끊김'); };
  assert.equal(await ctx.새사이트쪽읽기('work1'), null, '★ 그물이 끊긴 것을 null 로 안 돌려줍니다');
});

/* ══════ ③ 화면 — 옛 사이트에만 있던 칸은 숨긴다 ══════ */

test('★★ 접으면 옛 사이트 전용 칸(사진 바꾸기·자동 연결 카드·새로 올리기·로고와 잇기)이 그려지지 않는다', () => {
  const 칸들 = ['사진칸Html', '자동카드Html', '새로올리기칸Html', '로고연결칸Html', '새노무사칸Html'];
  칸들.forEach(이름 => {
    const ctx = { OLD_SITE_OFF: true, App: {} };
    vm.createContext(ctx);
    vm.runInContext(화면함수(이름), ctx);
    const d = { key: 'k', srl: '190', mkind: 'labor' };
    assert.equal(ctx[이름](d), '', '★★ 접었는데 「' + 이름 + '」가 그려집니다 — 눌러도 갈 곳이 없는 칸이다');
  });
});

test('★ 접어도 「되살릴 길」은 남아 있다 — 칸 함수는 지우지 않고 스위치로만 숨긴다', () => {
  ['사진칸Html', '자동카드Html', '새로올리기칸Html', '로고연결칸Html', '새노무사칸Html', '퇴사자한번에내리기', 'openFillSetup', 'openPaste']
    .forEach(이름 => assert.ok(화면함수(이름).length > 40, 이름 + ' 이 사라졌습니다'));
  /* 함수 안에서는 맨이름 대신 typeof 로 읽는다 — 검사 상자에 상수가 없어도 죽지 않게 */
  const 맨이름 = [...html.matchAll(/\n(?:async )?function ([^\s(]+)\(/g)].map(m => m[1]).filter(이름 => {
    if (이름 === '새사이트쪽읽기') return false;
    const 몸 = 화면함수(이름).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
    return /(^|[^\w.'"])OLD_SITE_OFF\b/.test(몸.replace(/typeof OLD_SITE_OFF !== 'undefined' && OLD_SITE_OFF === true/g, ''));
  });
  assert.deepEqual(맨이름, [], '★ 함수 안에서 OLD_SITE_OFF 를 맨이름으로 부릅니다 — 떼어 돌리는 검사 상자가 죽는다');
});

/* ══════ ④ 새 사이트 원본을 지금 해석 부품이 그대로 읽는다 ══════
   2026-11-15 실제로 견줘 봤다(옛 사이트 ↔ 새 사이트 원본): 구성원 7명·글 번호·경력 24줄, 쪽 여덟의 글자·고칠 줄이 같았다.
   여기서는 저장소의 사본(site/ — 새 사이트와 같은 내용)으로 «읽힌다»는 규칙만 본다(사람 수·줄 수는 안 박는다). */
test('★★ 새 사이트 사본을 해석 부품이 읽는다 — 구성원은 글 번호·경력, 쪽은 고칠 줄이 나온다', () => {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(R, 'js', 'pu-home-parse.js'), 'utf8')
    + '\n' + fs.readFileSync(path.join(R, 'js', 'pu-home-fill.js'), 'utf8'), ctx);
  const P = ctx.PuHomeParse, F = ctx.PuHomeFill;
  const 구성원 = P.parseMembers(fs.readFileSync(path.join(R, 'site', 'people', 'index.html'), 'utf8'));
  assert.ok(구성원.length >= 1, '★★ 새 사이트 구성원 쪽에서 한 사람도 못 읽습니다 — 「다시 확인」이 「구조가 바뀌었다」로 멈춘다');
  구성원.forEach(m => {
    assert.match(String(m.srl), /^\d+$/, '★★ 글 번호를 못 읽었습니다 — 짝짓기가 안 된다: ' + JSON.stringify(m).slice(0, 80));
    assert.ok(String(m.name || '').trim(), '★ 이름을 못 읽었습니다');
  });
  assert.ok(구성원.some(m => (m.careers || []).length > 0), '★★ 경력 줄을 하나도 못 읽습니다');
  ['work1', 'greeting', 'inquiry'].forEach(mid => {
    const h = fs.readFileSync(path.join(R, 'site', mid, 'index.html'), 'utf8');
    assert.ok(P.parsePageText(h).length > 0, '★★ ' + mid + ' 글자를 못 읽습니다');
    assert.ok(F.fixableRuns(P.pageBodyHtml(h)).length > 0, '★★ ' + mid + ' 고칠 줄이 0 — 「홈페이지에 올리기」가 안 나온다');
  });
});
