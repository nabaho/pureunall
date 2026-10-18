/* 뉴스레터 «회차 저장» — 비동기 순서를 «실제로 돌려» 본다 (2026-10-15 Codex 검토 1·2·4번)
   ═══════════════════════════════════════════════════════════════════════
   화면(pu-news.html)의 저장 함수들을 «그대로 꺼내» 가짜 DB 위에서 돌린다. 문자열만 보는 검사로는 못 잡는 «순서» 문제다:

   ㉠ 먼저 시작한 저장이 판 거래를 기다리는 사이 더 치신 글이 생겨도, 저장이 끝나며 그 글을 «치기 전 모양으로 되돌리지» 않는다
      (예전에는 저장이 끝나는 순간 옛 객체를 App.회차들 에 다시 꽂았고, 뒤따르는 저장은 옛 판을 들고 있어 「남이 고쳤다」로 막혔다)
   ㉡ 남이 먼저 고쳐 «막힌» 뒤 다시 읽은 자료로 다음 저장을 해도 서버의 핵심 카드가 «지워지지» 않는다
   ㉢ 핵심이 «없는» 자료는 빈 목록을 쓰지 않는다(카드를 일부러 다 뺀 []만 칸을 지운다)
   ㉣ AI 를 기다리는 사이 다른 회차로 옮겨도 후보는 «요청한 그 회차»에 담긴다 · 그 사이 보낸 회차가 되면 안 담긴다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const 원문 = fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8');
const Core = require('../js/pu-news-core.js');

/* 화면의 최상위 함수 한 벌을 «글자 그대로» 꺼낸다 */
function 소스(이름) {
  for (const 머리 of ['async function ' + 이름 + '(', 'function ' + 이름 + '(']) {
    const i = 원문.indexOf('\n' + 머리);
    if (i < 0) continue;
    const j = 원문.indexOf('\n}', i + 1);
    assert.ok(j > i, 이름 + ' 의 끝을 못 찾았다');
    return 원문.slice(i + 1, j + 2);
  }
  assert.fail(이름 + ' 을(를) 못 찾았다');
}
const 줄소스 = (정규) => { const m = 정규.exec(원문); assert.ok(m, '줄을 못 찾았다: ' + 정규); return m[0]; };

/* 가짜 실시간DB — 거래 앞에 «문»을 둬서 저장이 겹치는 순간을 만든다 */
function 가짜DB(처음, 문) {
  const 값 = JSON.parse(JSON.stringify(처음 || {}));
  const 쓴 = [];
  const 조각 = (p) => String(p).split('/').filter(Boolean);
  const 읽기 = (p) => 조각(p).reduce((o, k) => (o == null ? undefined : o[k]), 값);
  const 쓰기 = (p, v) => {
    const a = 조각(p); let o = 값;
    a.slice(0, -1).forEach((k) => { if (typeof o[k] !== 'object' || o[k] == null) o[k] = {}; o = o[k]; });
    const 마지막 = a[a.length - 1];
    const 빈것 = v === null || v === undefined || (Array.isArray(v) && !v.length);
    if (빈것) delete o[마지막]; else o[마지막] = JSON.parse(JSON.stringify(v));
  };
  return {
    값, 쓴,
    ref(p) {
      return {
        once: async () => { const v = 읽기(p); return { val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }; },
        update: async (o) => { 쓴.push({ 자리: p, 값: JSON.parse(JSON.stringify(o)) }); Object.keys(o).forEach((k) => 쓰기(p + '/' + k, o[k])); },
        transaction: async (fn) => {
          if (문) await 문();
          const 지금 = 읽기(p);
          const 새 = fn(지금 === undefined ? null : 지금);
          if (새 === undefined) return { committed: false, snapshot: { val: () => (지금 === undefined ? null : 지금) } };
          쓰기(p, 새);
          return { committed: true, snapshot: { val: () => 읽기(p) } };
        }
      };
    }
  };
}

/* 화면 함수들을 한 세계(vm)에 올린다 */
function 세계(db, 덧) {
  const 알림 = [], 그림 = { n: 0 };
  const ctx = Object.assign({
    db, App: { 회차들: {}, 설정: { 범위: '자문중' }, me: { email: 't@example.com' }, 지금열쇠: '' },
    toast: (m) => 알림.push(String(m)), render: () => { 그림.n++; }, 핵심그리기: () => { 그림.n++; },
    Core, console, Promise, setTimeout, clearTimeout, Date, Number, Object, Array, String, JSON, Math, Error
  }, 덧 || {});
  vm.createContext(ctx);
  const 코드 = [줄소스(/const _저장줄 = \{\};/), 줄소스(/const _저장대기 = \{\};/),
    소스('판올리기'), 소스('회차다시읽기'), 소스('회차저장'), 소스('회차저장하기')].join('\n');
  vm.runInContext(코드, ctx);
  return { ctx, 알림, 그림 };
}

const 풀기 = () => { let 열; const 문 = new Promise((r) => { 열 = r; }); return { 문, 열 }; };
const 틱 = () => new Promise((r) => setTimeout(r, 5));

test('★★★ 저장이 «셋 겹쳐도» — 먼저 끝난 저장이 더 새 입력을 되돌리지 않고, 줄 선 저장은 모두 판을 이어받아 저장된다', async () => {
  const 문들 = [풀기(), 풀기()];                     /* 첫째·둘째 거래는 «문»이 닫혀 있다 — 저장이 겹치는 순간을 만든다 */
  const db = 가짜DB({ newsletter: { issues: { k: { 판: 1, 핵심: [{ 제목: '처음' }] } } } },
    async () => { const g = 문들.shift(); if (g) await g.문; });
  const { ctx, 알림 } = 세계(db);
  const d0 = { 열쇠: 'k', 판: 1, 회차: { 이름: 'w' }, 상태: '초안', 안: {}, 핵심: [{ 제목: '처음' }] };
  ctx.App.회차들.k = d0;
  const 문1 = 문들[0], 문2 = 문들[1];
  /* 글을 칠 때마다 «최신 객체의 사본»에 고쳐 저장을 건다(지금회차() 가 하는 것) */
  const 치기 = (제목) => { const d = Object.assign({}, ctx.App.회차들.k, { 핵심: [{ 제목 }] }); ctx.App.회차들.k = d; return d; };
  const d1 = 치기('첫 글');  const p1 = ctx.회차저장(d1);
  await 틱();
  const d2 = 치기('둘째 글'); const p2 = ctx.회차저장(d2);
  const d3 = 치기('더 친 글'); const p3 = ctx.회차저장(d3);
  /* 첫 저장만 끝나게 한다 — 둘째 저장은 아직 거래를 기다린다 */
  문1.열();
  assert.strictEqual(await p1, true, '첫 저장이 안 됐다');
  assert.strictEqual(ctx.App.회차들.k, d3, '★★★ 먼저 끝난 저장이 최신 객체를 옛 객체(첫 글)로 바꿔 꽂았다 — 화면이 치기 전 모양으로 되돌아간다');
  assert.strictEqual(ctx.App.회차들.k.핵심[0].제목, '더 친 글', '최신 글이 옛 글로 되돌려졌다');
  문2.열();
  const [r2, r3] = await Promise.all([p2, p3]);
  assert.strictEqual(r2, true, '★★★ 줄 선 둘째 저장이 «남이 고쳤다»로 막혔다 — 앞 저장이 올린 판을 이어받지 못했다(최신 객체만 판을 받고 줄 선 객체는 못 받았다): ' + 알림.join(' / '));
  assert.strictEqual(r3, true, '셋째 저장이 막혔다: ' + 알림.join(' / '));
  assert.strictEqual(ctx.App.회차들.k, d3, '저장이 다 끝난 뒤 최신 객체가 바뀌었다');
  assert.strictEqual(db.값.newsletter.issues.k.핵심[0].제목, '더 친 글', '서버에 마지막 글이 안 남았다');
  assert.strictEqual(db.값.newsletter.issues.k.판, 4, '판이 저장마다 한 번씩(1→2→3→4) 오르지 않았다');
  assert.strictEqual(ctx.App.회차들.k.판, 4, '최신 객체가 올린 판을 모른다 — 다음 저장이 또 막힌다');
  assert.deepStrictEqual(db.쓴.map((w) => w.값.핵심 && w.값.핵심[0].제목), ['첫 글', '둘째 글', '더 친 글'], '저장이 친 차례대로 서버에 쓰이지 않았다');
  assert.ok(!알림.some((m) => /다른 관리자|막혔/.test(m)), '막힘 알림이 떴다: ' + 알림.join(' / '));
});

test('★★★ 남이 먼저 고쳐 «막힌» 뒤에도 — 다시 읽은 자료로 다음 저장해도 서버의 핵심 카드는 안 지워진다', async () => {
  const db = 가짜DB({ newsletter: { issues: { k: { 판: 5, 상태: '초안', 회차: { 이름: 'w' }, 안: { news: [{ 제목: 'x' }] },
    핵심: [{ 제목: '서버 카드 하나' }, { 제목: '서버 카드 둘' }], 핵심후보: [{ 제목: '받아 둔 후보' }] } } } });
  const { ctx } = 세계(db);
  /* 이 화면의 판(3)은 낡았다 — 저장은 막히고 «서버 것으로 다시 읽는다» */
  ctx.App.회차들.k = { 열쇠: 'k', 판: 3, 회차: { 이름: 'w' }, 상태: '초안', 안: {}, 핵심: [{ 제목: '내 카드' }] };
  const 막힘 = await ctx.회차저장(ctx.App.회차들.k);
  assert.strictEqual(막힘, false, '낡은 판인데 저장됐다');
  assert.deepStrictEqual(ctx.App.회차들.k.핵심.map((c) => c.제목), ['서버 카드 하나', '서버 카드 둘'],
    '★★★ 다시 읽은 자료에 서버의 핵심 카드가 없다 — 화면에서 카드가 사라지고 다음 저장이 지운다');
  assert.strictEqual(ctx.App.회차들.k.핵심후보[0].제목, '받아 둔 후보', '다시 읽기가 핵심후보를 안 읽는다');
  /* 이어서 «다른 것»을 고쳐 저장한다 — 핵심은 건드리지 않았다 */
  const 다시 = Object.assign({}, ctx.App.회차들.k, { 우리글: '한마디를 고쳤다' });
  ctx.App.회차들.k = 다시;
  assert.strictEqual(await ctx.회차저장(다시), true);
  assert.deepStrictEqual(db.값.newsletter.issues.k.핵심.map((c) => c.제목), ['서버 카드 하나', '서버 카드 둘'], '★★★ 다음 저장이 서버의 핵심 카드를 지웠다');
  assert.strictEqual(db.값.newsletter.issues.k.핵심후보[0].제목, '받아 둔 후보', '다음 저장이 받아 둔 후보를 지웠다');
});

test('★★ 핵심이 «없는» 자료(새 회차·안 읽은 자료)는 빈 목록을 쓰지 않는다 · 일부러 다 뺀 []만 칸을 지운다', async () => {
  const db = 가짜DB({ newsletter: { issues: { k: { 판: 1, 핵심: [{ 제목: '서버 카드' }], 핵심후보: [{ 제목: '후보' }] } } } });
  const { ctx } = 세계(db);
  const 안읽음 = { 열쇠: 'k', 판: 1, 회차: { 이름: 'w' }, 상태: '초안', 안: {}, 우리글: '고침' };     /* 핵심·핵심후보 칸이 «아예 없다» */
  ctx.App.회차들.k = 안읽음;
  assert.strictEqual(await ctx.회차저장(안읽음), true);
  assert.strictEqual(db.값.newsletter.issues.k.핵심[0].제목, '서버 카드', '★★ 안 읽은 칸을 빈 목록으로 써서 서버 카드를 지웠다');
  assert.strictEqual(db.값.newsletter.issues.k.핵심후보[0].제목, '후보');
  /* 일부러 다 뺀 것([])은 지워진다 */
  const 다뺌 = Object.assign({}, ctx.App.회차들.k, { 핵심: [], 핵심후보: [] });
  ctx.App.회차들.k = 다뺌;
  assert.strictEqual(await ctx.회차저장(다뺌), true);
  assert.ok(!('핵심' in db.값.newsletter.issues.k), '카드를 다 뺐는데 서버에 남았다');
  assert.ok(!('핵심후보' in db.값.newsletter.issues.k), '후보를 다 지웠는데 서버에 남았다');
});

/* ───── AI 를 기다리는 사이 회차를 옮기는 경우 ───── */

function 후보세계(상태B) {
  const 열 = {};
  const db = 가짜DB({});
  const 건 = (제목, 링크) => ({ 갈래: '기사', 제목, 우리말: '우리 정리 ' + 제목, 링크, 언론사: '매일노동뉴스' });
  const 안A = { news: [건('안전 점검 안내', 'https://n.example/a1'), 건('유급휴일 안내', 'https://n.example/a2'), 건('다른 기사', 'https://n.example/a3')] };
  const 저장된 = [];
  const { ctx, 알림 } = 세계(db, {
    오늘: () => '2026-10-13',
    회차로부터: (k) => ({ 이름: k, 기간: '', 열쇠: k }),
    firebase: { auth: () => ({}) }
  });
  /* 화면 함수들이 «window.PuAiCall»·«PuAiCall» 둘 다 본다 — 응답은 시험이 직접 «풀어 준다» */
  ctx.PuAiCall = { ask: () => new Promise((r) => { 열.응답 = r; }), textOf: (x) => x };
  ctx.window = { PuAiCall: ctx.PuAiCall, fetch: function () {} };
  ctx.회차저장 = async (자료) => { 저장된.push(JSON.parse(JSON.stringify(자료))); return true; };   /* 저장 자체는 흉내 — 무엇이 «어느 회차에» 저장되는지만 본다 */
  vm.runInContext([소스('회차한벌'), 소스('지금회차'), 소스('핵심후보뽑기')].join('\n'), ctx);
  ctx.App.회차들['2026-10-w1'] = { 열쇠: '2026-10-w1', 회차: { 이름: 'A회차' }, 상태: '초안', 안: 안A, 우리글: '' };
  ctx.App.회차들['2026-10-w2'] = { 열쇠: '2026-10-w2', 회차: { 이름: 'B회차' }, 상태: 상태B || '초안', 안: { news: [건('B 기사', 'https://n.example/b1')] }, 우리글: '' };
  ctx.App.지금열쇠 = '2026-10-w1';
  return { ctx, 알림, 열, 저장된 };
}
const 답 = (번호) => JSON.stringify([{ 번호, 종류: '노동법', 제목: '쉬운 제목', 설명: '설명', 대상: '', 할일: '', 때: '' }]);

test('★★ AI 를 기다리는 사이 다른 회차로 옮겨도 후보는 «요청한 그 회차»에 담긴다', async () => {
  const { ctx, 열, 저장된 } = 후보세계();
  const 진행 = ctx.핵심후보뽑기();
  await 틱();
  ctx.App.지금열쇠 = '2026-10-w2';              /* 기다리는 사이 B 회차로 옮겼다 */
  열.응답(답(0));
  await 진행;
  assert.strictEqual(저장된.length, 1, '후보가 저장되지 않았다');
  assert.strictEqual(저장된[0].열쇠, '2026-10-w1', '★★ 후보가 «지금 보는 다른 회차(B)»에 저장됐다 — A 회차의 기사로 만든 후보가 B 회차에 들어간다');
  assert.strictEqual(저장된[0].핵심후보[0].링크, 'https://n.example/a1', '후보의 링크가 A 회차 건의 것이 아니다');
  assert.ok(!ctx.App.회차들['2026-10-w2'].핵심후보, 'B 회차가 건드려졌다');
});

test('★★ 그 사이 «보낸 회차»가 됐으면 후보를 안 담는다 — 응답 때 잠김을 다시 본다', async () => {
  const { ctx, 열, 저장된, 알림 } = 후보세계();
  const 진행 = ctx.핵심후보뽑기();
  await 틱();
  ctx.App.회차들['2026-10-w1'].상태 = '발송';      /* 기다리는 사이 이 회차가 나갔다 */
  열.응답(답(0));
  await 진행;
  assert.strictEqual(저장된.length, 0, '★★ 이미 보낸 회차에 후보를 저장했다');
  assert.ok(알림.some((m) => /보낸 회차/.test(m)), '왜 안 담았는지 말하지 않는다: ' + 알림.join(' / '));
});
