'use strict';
/* 명함 본문을 «바뀐 것만» 받는다 (대표 지시 2026-09-18 「기업정보함도 줄여라」)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     씨앗(IndexedDB 스냅숏)이 화면은 빨리 세워 줬지만 **내려받는 양은 그대로 3.07MB** 였다.
     켤 때마다 6,600장을 통째로 다시 받아 놓고 거의 전부를 「씨앗과 같다」며 버렸다.

   ■ 이 고침이 «조용히 틀릴 수 있는» 자리가 셋이다. 그 셋을 여기서 못 박는다.
     ① 유령 걷기 — 씨앗 걷기는 「스트림이 전부」라는 셈에 기댄다. 바뀐 것만 받는데
        그대로 두면 **안 바뀐 6,600장이 통째로 사라진다.**
     ② 지워진 것 — 추린 구독으로는 «안 온다». 자국(tomb)으로 걷어야 유령이 안 남는다.
     ③ updatedAt 을 안 올리는 저장 길 — 그 고침은 다른 기기에 영영 안 간다.
   ■ 그리고 물러설 길이 있어야 한다 — 모르면 통째로 받는다(조용히 틀리느니 더 받는다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const RAW = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');
const SRC = stripJs(RAW);
const RULES = fs.readFileSync(path.join(ROOT, 'scripts', 'make-firebase-rules.js'), 'utf8');

/* ══ ① 유령 걷기 — 바뀐 것만 받을 때는 걷지 않는다 ══════════════════════ */
function loadWatch() {
  const a = SRC.indexOf('function watchCardMap(');
  const b = SRC.indexOf('\nconst CARD_CACHE_KEY');
  assert.ok(a > 0 && b > a, 'watchCardMap 을 찾지 못했습니다');
  const held = { timers: {}, tid: 0, h: {}, paints: [] };
  const ctx = {
    console, Object, Array, String, Number, JSON,
    setTimeout: fn => { const id = ++held.tid; held.timers[id] = fn; return id; },
    clearTimeout: id => { delete held.timers[id]; },
  };
  vm.createContext(ctx);
  vm.runInContext(SRC.slice(a, b), ctx);
  held.flush = () => { const fns = Object.values(held.timers); held.timers = {}; fns.forEach(f => f()); };
  held.ref = {
    on(ev, fn) { held.h[ev] = fn; }, off() {},
    limitToFirst() { return { once: () => ({ then: () => ({ catch() {} }) }) }; }
  };
  held.add = (k, v) => held.h['child_added']({ key: k, val: () => v });
  return { ctx, held };
}
const CARD = n => ({ id: n, name: n, company: n + '상사' });

test('①★★ 바뀐 것만 받을 때는 유령을 «걷지 않는다» — 걷으면 안 바뀐 명함이 통째로 사라진다', () => {
  const { ctx, held } = loadWatch();
  const seed = { a: CARD('가'), b: CARD('나'), c: CARD('다') };
  ctx.watchCardMap(held.ref, m => held.paints.push(Object.assign({}, m)), null, null, seed, { partial: true });
  held.add('b', Object.assign(CARD('나'), { name: '나2' }));   /* 서버는 바뀐 한 장만 준다 */
  held.flush();
  const last = held.paints[held.paints.length - 1];
  assert.deepStrictEqual(Object.keys(last).sort(), ['a', 'b', 'c'],
    '★★★ 안 바뀐 명함이 사라졌습니다 — 기업정보함이 통째로 비어 보입니다');
  assert.equal(last.b.name, '나2', '바뀐 것은 갈아 끼워져야 합니다');
});

test('① 통째로 받을 때는 예전처럼 유령을 걷는다 — 지운 명함이 남으면 안 된다', () => {
  const { ctx, held } = loadWatch();
  ctx.watchCardMap(held.ref, m => held.paints.push(Object.assign({}, m)), null, null,
    { a: CARD('가'), zombie: CARD('그사이지운것') });     /* opts 없음 = 통째 */
  held.add('a', CARD('가'));
  held.flush();
  const last = held.paints[held.paints.length - 1];
  assert.ok(last.a && !last.zombie, '★ 통째로 받는 길에서 유령 걷기가 꺼졌습니다');
});

/* ══ ② 지운 자국 ═══════════════════════════════════════════════════════ */
test('②★ 지울 때 «자국»을 남긴다 — 네 갈래 모두', () => {
  const del = SRC.slice(SRC.indexOf('async del(id){'), SRC.indexOf('async del(id){') + 1400);
  assert.match(del, /cardTomb\(id\)/, '★ 한 장 지우기에 자국이 없습니다');
  assert.match(SRC, /cardTomb\(Object\.keys\(chunk\)\)/, '★ 묶음 지우기에 자국이 없습니다');
  assert.match(SRC, /cardTomb\(Object\.keys\(itemUpd\)\)/, '★ 깨진 글자 정리에 자국이 없습니다');
  const priv = SRC.slice(SRC.indexOf('function cardPrivPaths(id, on){'), SRC.indexOf('function cardPrivPaths(id, on){') + 900);
  assert.match(priv, /if\(on\) out\[`\$\{DB_ROOT\}\$\{TOMB\}\/\$\{id\}`\] = Date\.now\(\);/,
    '★★ 개인으로 옮긴 명함이 남의 화면에 그대로 남습니다 — 숨긴 것이 안 숨겨집니다');
  assert.ok(priv.indexOf('on ? null :') > 0, '되돌아오는 길은 그대로여야 합니다');
});

test('②★ 자국은 30일만 둔다 — 안 걷으면 지우려고 만든 것이 새 요금이 된다', () => {
  assert.match(SRC, /function purgeTombs\(\)\{/, '★ 자국 정리가 없습니다');
  assert.match(SRC, /purgeTombs\(\);/, '★ 정리를 아무도 안 부릅니다');
  assert.match(SRC, /orderByValue\(\)\.endAt\(cut\)/, '★ 오래된 것만 골라 걷어야 합니다');
});

/* ══ ③ updatedAt 을 안 올리는 저장 길이 없다 ══════════════════════════ */
test('③★★ 명함 칸을 고치는 «모든» 길이 updatedAt 을 함께 올린다', () => {
  /* items/{id}/{칸} 을 고치면서 같은 덩어리에 updatedAt 이 없으면, 그 고침은
     「바뀐 것만」 받는 다른 기기에 영영 안 간다 — 조용한 사고다. */
  const lines = SRC.split(/\r?\n/);
  const bad = [];
  lines.forEach((ln, i) => {
    const m = ln.match(/items\/\$\{[^}]+\}\/([A-Za-z_][\w]*)`?\]\s*=/g) || [];
    if (!m.length) return;
    if (/updatedAt/.test(ln)) return;                       // 같은 줄에 있으면 됐다
    const near = lines.slice(Math.max(0, i - 3), i + 4).join('\n');
    if (/updatedAt/.test(near)) return;                     // 바로 옆 줄에 있으면 됐다
    bad.push((i + 1) + ': ' + ln.trim().slice(0, 100));
  });
  assert.deepStrictEqual(bad, [],
    '★★ updatedAt 을 안 올리는 저장 길이 남았습니다 — 그 고침은 다른 기기에 영영 안 갑니다:\n  ' + bad.join('\n  '));
});

test('③ 자주 도는 길(자동 폴더 옮기기)이 특히 그렇다', () => {
  const p = SRC.slice(SRC.indexOf('function autoClsChunks('), SRC.indexOf('function autoClsChunks(') + 800);
  assert.match(p, /upd\['items\/' \+ m\.id \+ '\/updatedAt'\] = Date\.now\(\)/,
    '★ 새 명함이 들어올 때마다 도는 길입니다 — 여기가 빠지면 다른 기기는 옛 폴더로 봅니다');
});

/* ══ 물러설 길 ═════════════════════════════════════════════════════════ */
test('★ 모르면 «통째로» 받는다 — 조용히 틀리느니 조금 더 받는다', () => {
  const g = SRC.slice(SRC.indexOf('cardCacheGet(snap=>{'), SRC.indexOf('cardCacheGet(snap=>{') + 1800);
  assert.match(g, /if\(!snap\)\{ goSub\(null\); return; \}/, '★ 씨앗이 없으면 통째로여야 합니다');
  assert.match(g, /const _needFull = !_ckpt \|\| !_lastFullAt \|\| \(Date\.now\(\) - _lastFullAt\) > FULL_EVERY_MS/,
    '★ 옛 씨앗·오래된 씨앗이면 통째로여야 합니다');
  assert.match(g, /\.catch\(\(\)=>\{[\s\S]{0,200}goSub\(_seed\);/,
    '★★ 지운 자국을 «못 읽었는데» 바뀐 것만 받으면, 남이 지운 명함이 영영 남습니다');
  assert.match(g, /setTimeout\(\(\)=>\{ if\(!_tombDone\)/, '★ 자국 읽기가 늦으면 문이 잠깁니다');
});

test('★ 사흘에 한 번은 통째로 받는다 — 어느 길이 updatedAt 을 빠뜨려도 스스로 낫는다', () => {
  assert.match(SRC, /const FULL_EVERY_MS = 3\*24\*3600\*1000;/, '★ 스스로 낫는 길이 없습니다');
  /* «통째로» 받는 자리가 하나여야 시각 찍기를 빠뜨리지 않는다 */
  assert.match(SRC, /if\(!_partial\) _lastFullAt = Date\.now\(\);/,
    '★★ 통째로 받고도 시각을 안 찍으면 영영 통째로만 받습니다 — 줄인 것이 없어집니다');
});

test('★ 씨앗의 ckpt 는 담은 시각에서 물러선 값이다 — PC 마다 시계가 어긋난다', () => {
  assert.match(SRC, /const CKPT_BACK_MS = 60\*60\*1000;/, '★ 여유가 없으면 그 사이 것을 빠뜨립니다');
  assert.match(SRC, /ckpt: Date\.now\(\) - CKPT_BACK_MS/, '★ 담을 때 물러서지 않았습니다');
});

/* ══ 규칙 — 색인이 없으면 이 고침은 아무것도 안 줄인다 ═══════════════ */
test('★★ 규칙에 색인이 있다 — 없으면 파이어베이스가 6,600장을 다 받아 놓고 줄을 세운다', () => {
  const p = RULES.slice(RULES.indexOf('rules.pucards = {'), RULES.indexOf('rules.pucards_private'));
  assert.match(p, /items: \{[^}]*'\.indexOn': \['updatedAt'\]/,
    '★★★ updatedAt 색인이 없으면 추린 구독이 도리어 통째로 받는 길이 됩니다');
  assert.match(p, /tomb:\s*\{[^}]*'\.indexOn': '\.value'/, '★ 자국은 값으로 추립니다');
  /* 이름으로 적는 순간 $k 가 안 걸린다 — 쓰기 허락을 옮겨 적었는가 */
  assert.match(p, /items: \{ '\.write': pucardsWrite/, '★★ 명함 저장이 통째로 막힙니다');
  assert.match(p, /tomb:\s*\{ '\.write': pucardsWrite/, '★ 자국을 못 남깁니다');
  assert.match(p, /items: \{[^}]*\$k2: \{ '\.write': MAIL \}/, '★ 명함 한 칸 고치기가 막힙니다');
});
