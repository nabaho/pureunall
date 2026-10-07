'use strict';
/* 🔎 점검에 「👤 보는 사람이 없는 칸」 · ✉ 이알피 → 메일함 길 (대표 지시 2026-10-07 전체 점검)

   ★ 실측 2026-10-07 — 받은 메일 6,863통 중 담당 모름 5,905통(86%). 연결 표가 거의 비어
     있었다(mailWork 0 · mailBoxWho 0 · mailBins 0 · 신규 문의 기록 0 · 폰 0대).
     담당 모름은 «칸마다 통째로» 모여 있어, 칸에 사람을 정하는 것이 유일한 길이다.

   지키는 것
   ① 보는 사람이 없는 칸만 센다 · 사람 안 붙임 칸은 안 센다 · 받는 칸만 본다
   ② 정해 둔 칸도 내놓는다(고칠 자리가 달리 없다) · 할 일도 없고 정한 것도 없으면 안 그린다
   ③ 점검 «칩 수»에는 안 넣는다 — 넣으면 수천으로 떠 정작 이상한 것이 묻힌다
   ④ 고르개는 폴더 메뉴의 것을 «그대로» 쓴다(두 벌이면 한쪽만 고쳐진다)
   ⑤ ?q= 로 온 찾는 말은 «한 번만» 쓴다 — 안 비우면 칸을 바꿀 때마다 되살아난다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const erp = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

function box(o) {
  o = o || {};
  const ctx = {
    Object, String, Number, Array, JSON, RegExp,
    esc: (s) => String(s == null ? '' : s),
    _mbFolders: o.folders || {},
    _mbNoWho: o.noWho || {},
    _mbBoxWho: o.boxWho || {},
    mbWhoLive: (w) => String(w || ''),
    mbFolderBy: (s) => (o.folders || {})[s] || null,
    location: { search: o.search === undefined ? '' : o.search },
  };
  vm.createContext(ctx);
  ['mbNoWhoBox', 'mbBoxWhoList', 'mbBoxTodo', 'mailQFromUrl']
    .forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  const m = app.match(/const MB_MINE_KINDS = \[[^\]]*\];/);
  assert.ok(m, 'MB_MINE_KINDS 를 앱에서 찾지 못했습니다');
  vm.runInContext('var ' + m[0].slice('const '.length), ctx);
  return ctx;
}
const F = { IN: { name: '받은메일함', kind: 'inbox' }, TAX: { name: '12. 세금계산서', kind: 'custom' },
  AD: { name: '기타광고', kind: 'custom' }, SENT: { name: '보낸메일함', kind: 'sent' },
  TRASH: { name: '휴지통', kind: 'trash' } };

test('★★★ 보는 사람이 없고 담당 모름이 쌓인 칸이 «많은 쪽부터» 나온다', () => {
  const c = box({ folders: F });
  const r = c.mbBoxTodo({ IN: 472, TAX: 422 });
  assert.equal(r.map((x) => x.slug).join(','), 'IN,TAX');
  assert.equal(r[0].n, 472);
  assert.equal(r[0].name, '받은메일함');
});

test('★★★ 「사람 안 붙임」 칸은 안 센다 — 거기는 일부러 아무도 안 붙는다', () => {
  const c = box({ folders: F, noWho: { AD: 1 } });
  assert.equal(c.mbBoxTodo({ AD: 110 }).some((x) => x.slug === 'AD'), false);
});

test('★★★ 보낸메일함·휴지통에는 「누가 봅니까」를 묻지 않는다', () => {
  const c = box({ folders: F });
  const slugs = c.mbBoxTodo({}).map((x) => x.slug);
  assert.equal(slugs.indexOf('SENT'), -1);
  assert.equal(slugs.indexOf('TRASH'), -1);
});

test('★★★ 이미 정해 둔 칸도 내놓는다 — 고칠 자리가 달리 없다', () => {
  const c = box({ folders: F, boxWho: { TAX: { who: ['홍길동', '김노무'] } } });
  const r = c.mbBoxTodo({});           /* 담당 모름 0통이어도 */
  const x = r.filter((y) => y.slug === 'TAX')[0];
  assert.ok(x, '정해 둔 칸이 보여야 한다');
  assert.equal(x.who.join(','), '홍길동,김노무');
  assert.equal(x.n, 0);
});

test('★★ 할 일도 없고 정해 둔 것도 없는 칸은 안 그린다', () => {
  const c = box({ folders: F });
  assert.equal(c.mbBoxTodo({}).length, 0);
});

test('★★★ 점검 «칩 수»에는 안 넣는다 — 넣으면 정작 이상한 것이 묻힌다', () => {
  const src = strip(sliceFn(app, 'function mbCkCount('));
  assert.ok(!/\.box\b/.test(src), '칩 수에 box 가 들어가면 안 된다: ' + src.trim());
  assert.ok(/mix|none/.test(src));
});

test('★★★ 고르개는 폴더 메뉴의 것을 «그대로» 쓴다 — 두 벌이면 한쪽만 고쳐진다', () => {
  const src = strip(app);
  const i = src.indexOf("if(tab === 'box')");
  assert.ok(i > 0, '점검 창에 box 갈래가 있어야 한다');
  assert.ok(/mbBoxWhoPickHtml\(x\.slug\)/.test(src.slice(i, i + 900)),
    '그 줄 안에서 바로 고를 수 있어야 한다 — 폴더 메뉴로 보내면 아무도 안 한다');
});

test('★★ 칸을 한 번 훑을 때 «함께» 센다 — 따로 훑으면 메일 수만큼 느려진다', () => {
  const src = strip(sliceFn(app, 'function mbCheckAll('));
  assert.ok(/boxM\[v\._slug\]/.test(src), '이미 도는 고리 안에서 세야 한다');
  assert.ok(/mbBoxTodo\(boxM\)/.test(src));
});

/* ══ ⑤ ?q= 로 온 찾는 말 ══ */
test('★★★ ?q= 를 읽는다 · 없으면 빈 글자', () => {
  const c = box({});
  assert.equal(c.mailQFromUrl('?view=mail&q=%EA%B0%80%EB%82%98%EC%83%81%EC%82%AC'), '가나상사');
  assert.equal(c.mailQFromUrl('?view=mail&q=%EA%B0%80+%EB%82%98'), '가 나');
  assert.equal(c.mailQFromUrl('?view=mail'), '');
  assert.equal(c.mailQFromUrl(''), '');
});

test('★★ 다른 열쇠의 q 를 잘못 집지 않는다', () => {
  const c = box({});
  assert.equal(c.mailQFromUrl('?view=mail&qq=xx'), '', 'qq 는 q 가 아니다');
  assert.equal(c.mailQFromUrl('?aq=xx'), '');
});

test('★★★ 찾는 말을 «한 번만» 쓴다 — 안 비우면 칸을 바꿀 때마다 되살아난다', () => {
  const src = strip(sliceFn(app, 'function openMailBox('));
  assert.ok(/_mbUrlQ === null/.test(src), '아직 안 읽음(null)과 다 썼음(빈 글자)을 갈라야 한다');
  assert.ok(/_mbUrlQ = ''/.test(src), '쓰고 나면 비워야 한다');
  assert.ok(/state\.mbQ = _mbUrlQ/.test(src));
});

/* ══ ✉ 이알피 → 메일함 ══ */
test('★★★ 이알피 업체 상세에서 메일함으로 가는 길이 있다', () => {
  assert.ok(/pu-cards\.html\?sso=1&view=mail&q=' \+ encodeURIComponent\(co\.name/.test(erp),
    '업체 이름을 실어 메일함을 열어야 한다');
});

test('★★★ 업체 상세를 열 때 메일을 «세지 않는다» — 수천 통을 훑으면 그만큼 느려진다', () => {
  const i = erp.indexOf("view=mail&q=");
  const near = erp.slice(Math.max(0, i - 1400), i);
  assert.ok(!/mailbox\/msgs|fbDb\.ref\('mailbox/.test(near),
    '메일을 읽어 세는 길이 섞이면 안 된다');
  assert.ok(!/'메일함' \+ '\s*\(' /.test(erp), '세지 않은 수를 적으면 그 숫자를 못 믿게 된다');
});
