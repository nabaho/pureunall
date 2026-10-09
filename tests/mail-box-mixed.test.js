'use strict';
/* 🔀 「여럿이 섞여 칸으로는 못 정함」 (대표 지시 2026-10-09)

   「칸 안에는 여러 사람의 담당이 섞여 있어서 특정을 할 수 없다」

   ★ 왜 상태가 하나 더 필요한가 — 지금까지 칸은 둘뿐이었다:
     ① 담당을 정했다   ② 사람 안 붙임(경조사·광고 — 담당이라는 말이 안 맞는 칸)
     그런데 사무실업무관련·공공기관·노무사회·자율점검·국민건강고용산재는 **담당이 있다.**
     여러 사람 것이 섞여 있을 뿐이다. 이것을 ②로 적으면 다음 사람이 「담당 없는 칸」으로
     읽고, 아무 표시도 없으면 「아직 안 정했구나」 하며 **한 사람을 얹는다.**
     그 순간 남의 메일 수백 통이 그 사람에게 통째로 간다 — 대표께서 막으신 것이 그것이다.

   ★ 하는 일은 ②와 같다(칸이 담당을 안 내놓는다). 다른 것은 «말»뿐이고, 그 말이 값이다.

   지키는 것
   ① 까닭을 읽어 낸다(mixed / 그냥) · 모양이 달라도 안 깨진다
   ② 하는 일은 같다 — 둘 다 칸이 담당을 안 내놓는다
   ③ 적을 길이 «두 곳»에 있다 — 폴더 메뉴와 🔎 점검(할 일이 거기 있다)
   ④ 한 통씩 박는 길은 그대로 산다 — 「못 정함」은 칸 이야기지 메일 이야기가 아니다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ');

function box(noWho, whoMsg) {
  const ctx = {
    Object, String, Number, Array, Boolean, Date,
    _mbNoWho: noWho || {},
    _mbWhoMsg: whoMsg || {},
    mbWhoKey: (s) => String(s || '').toLowerCase(),
  };
  vm.createContext(ctx);
  ['mbNoWhoBox', 'mbNoWhoWhy', 'mbNoWhoLabel', 'mbNoWhoOfRow']
    .forEach((n) => vm.runInContext(sliceFn(app, 'function ' + n + '('), ctx));
  return ctx;
}

test('★★★ 까닭을 읽어 낸다 — 섞임과 그냥 안 붙임을 가른다', () => {
  const c = box({
    AD: 1,                                   /* 옛 모양(그냥 1) */
    PARTY: { at: 1, by: '홍길동' },            /* 까닭 없이 적힌 것 */
    GOV: { why: 'mixed', at: 1 },
  });
  assert.equal(c.mbNoWhoWhy('AD'), '');
  assert.equal(c.mbNoWhoWhy('PARTY'), '');
  assert.equal(c.mbNoWhoWhy('GOV'), 'mixed');
  assert.equal(c.mbNoWhoWhy('없는칸'), '');
});

test('★★★ 옛 모양(1)에서도 안 깨진다 — 먼저 적어 둔 칸이 통째로 풀리면 안 된다', () => {
  const c = box({ AD: 1 });
  assert.equal(c.mbNoWhoBox('AD'), true, '★ 옛 모양이 「안 붙임」에서 빠졌다');
  assert.equal(c.mbNoWhoWhy('AD'), '');
});

test('★★★ 하는 일은 같다 — 둘 다 칸이 담당을 안 내놓는다', () => {
  const c = box({ AD: 1, GOV: { why: 'mixed' } });
  assert.equal(c.mbNoWhoBox('AD'), true);
  assert.equal(c.mbNoWhoBox('GOV'), true, '★★ 섞임 칸인데 담당을 내놓는다 — 한 사람에게 쏠린다');
  assert.equal(c.mbNoWhoOfRow({ _slug: 'GOV' }), true);
});

test('★★★ 한 통씩 박은 것은 「못 정함」보다 세다 — 칸 이야기지 메일 이야기가 아니다', () => {
  const c = box({ GOV: { why: 'mixed' } }, { 'gov:7': '홍길동' });
  assert.equal(c.mbNoWhoOfRow({ _slug: 'GOV', _key: 'GOV:7' }), false,
    '★★ 사람이 콕 집어 박았는데 칸 규칙이 덮었다');
  assert.equal(c.mbNoWhoOfRow({ _slug: 'GOV', _key: 'GOV:9' }), true);
});

test('★★ 말이 다르다 — 그 말이 이 기능의 값이다', () => {
  const c = box({ AD: 1, GOV: { why: 'mixed' } });
  assert.equal(c.mbNoWhoLabel('AD'), '사람 안 붙임');
  assert.equal(c.mbNoWhoLabel('GOV'), '여럿이 섞임');
});

/* ══ 적을 길 ══ */
test('★★★ 적는 길이 «두 곳»에 있다 — 폴더 메뉴와 🔎 점검', () => {
  const src = strip(app);
  const 메뉴 = src.indexOf("mbNoWhoSet('${slug}', true, 'mixed')");
  assert.ok(메뉴 > 0, '★★ 폴더 메뉴에 「여럿이 섞임」이 없다');
  const 점검 = strip(sliceFn(app, 'function mbCheckHtml('));
  assert.ok(/mixed/.test(점검),
    '★★ 🔎 점검에 「여럿이 섞임」이 없다 — 할 일 목록이 거기인데 지울 길이 없다');
});

test('★★★ 「아무도 없음」 줄에 바로 지울 단추가 붙는다 — 없으면 할 일이 영영 안 지워진다', () => {
  const src = strip(app);
  const i = src.indexOf('아무도 없음');
  assert.ok(i > 0);
  const 가까이 = src.slice(i, i + 420);
  assert.ok(/mbNoWhoSet\(/.test(가까이) && /mixed/.test(가까이),
    '★★ 그 줄에서 바로 못 정한다고 적을 수 없다: ' + 가까이.slice(0, 160));
});

test('★★★ 쓰는 함수가 까닭을 받는다 · 안 주면 옛 모양 그대로', () => {
  const src = strip(sliceFn(app, 'function mbNoWhoSet('));
  assert.ok(/function mbNoWhoSet\(slug, on, why\)/.test(src), '★★ 까닭을 받지 않는다');
  assert.ok(/why:'mixed'|why: 'mixed'/.test(src), '★★ 까닭을 적어 두지 않는다');
  assert.ok(/\?\s*\{ why:'mixed'[^}]*\}\s*:\s*1/.test(src.replace(/\s+/g, ' ')),
    '★ 까닭이 없을 때는 옛 모양(1)이어야 한다 — 먼저 적힌 칸과 섞이면 안 된다');
});

test('★★ 꺼진 칸에는 사람 고르개를 안 그린다 — 「켜 뒀는데 왜 안 가나」가 된다', () => {
  const src = strip(app);
  const i = src.indexOf('👤 이 칸을 보는 사람');
  assert.ok(i > 0);
  assert.ok(/mbNoWhoBox\(slug\)\s*\?\s*''/.test(src.slice(Math.max(0, i - 400), i + 60)),
    '★★ 안 붙이는 칸에도 고르개가 보인다');
});
