'use strict';
/* ══════ 일정 등록 달력 — 「이미 쓴 날」이 눈에 보이는가 ══════
   실행: node --test tests/*.test.js

   ■ 무엇을 바라셨나 (대표 지시 2026-09-17)
     「이미 사용했던 날짜를 회색으로 표시했는데 구분이 잘 안 된다. 이미 몇 회차로
      사용되었는지 눈에 보이게 간단하게 확인 가능하게 했으면 좋겠다. 그리고 …
      날짜에 마우스를 올릴 경우 짧게 방문 사무실 몇 회 등이 나오면 훨씬 편할 것 같다」
     승인 목업 docs/mockups/cal-used-days.html 「㉮」(날짜 밑에 회차) · ②(요약에 방문·사무실 셈)

   ⚠ «글자»를 박지 않는다 — 「7회」인지 「7」인지는 대표가 바꿀 수 있는 모양이다.
     「회차 숫자가 칸에 있는가」, 「사전진단과 본컨설팅이 갈리는가」 같은 규칙만 본다.
   ⚠ 진짜 함수를 돌린다 — 소스를 글자로만 보면 이름만 바뀌어도 깨지고 정작 안 그려지는 것은 못 잡는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'gov-consulting.html'), 'utf8');

function fnSrc(name) {
  const m = new RegExp('(?:^|\\n)((?:async )?function ' + name + '\\s*\\()').exec(SRC);
  assert.ok(m, '함수를 찾을 수 없습니다: ' + name);
  const start = m.index + (m[0].startsWith('\n') ? 1 : 0);
  let i = SRC.indexOf('{', start), d = 0, k = i;
  while (k < SRC.length) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) break; }
    k++;
  }
  return SRC.slice(start, k + 1);
}

/* 달력을 실제로 그려 보고, 그려진 칸을 돌려준다.
   scheds: 이 사업장·종류의 일정들 · y/m: 그릴 달(m 은 0부터) */
function drawCal(scheds, y, m, opt) {
  opt = opt || {};
  const out = {};
  const box = {
    console, String, Object, Array, Number, Math, Date, JSON, Map, Set,
    single: { coId: 'co1', typeId: 'ty1', isField: true, selDate: '', calY: y, calM: m, multi: false, picks: [] },
    getScheds: () => scheds,
    getTypes: () => opt.types || [],
    isBlocked: ds => (opt.blocked || []).includes(ds) ? '막힌 날' : null,
    todayStr: () => opt.today || '2000-01-01',
    q: sel => sel === '#mSingleCal' ? { set innerHTML(v) { out.html = v; } }
      : { set textContent(v) { out.month = v; } },
  };
  vm.createContext(box);
  vm.runInContext([fnSrc('p2'), fnSrc('escAttr'), fnSrc('schedPhase'),
    fnSrc('usedRoundShort'), fnSrc('usedDayTip'), fnSrc('coOtherTypeOn'),
    fnSrc('renderSingleCal')].join('\n'), box);
  box.renderSingleCal();
  /* 그려진 칸을 하나씩 뜯어 본다 */
  const cells = [];
  const re = /<div class="([^"]*bulk-cell[^"]*)"([^>]*)>([\s\S]*?)<\/div>\s*(?=<div class="bulk-cell|<\/div>|$)/g;
  let mm;
  while ((mm = re.exec(out.html))) cells.push({ cls: mm[1], attrs: mm[2], inner: mm[3] });
  return { html: out.html, cells, used: cells.filter(c => /\btaken\b/.test(c.cls)) };
}

const S = (date, round, isField, phase) => ({ id: 'x' + date, coId: 'co1', typeId: 'ty1', date, round, isField, phase: phase || 'main' });

/* ─────────────────────────────── ① 칸에서 바로 보이는가 */
test('★ 이미 쓴 날은 «몇 회차였는지»가 칸에 적힌다 — 회색 하나로 숨지 않는다', () => {
  const r = drawCal([S('2026-08-04', 7, true), S('2026-08-18', 12, false)], 2026, 7);
  assert.equal(r.used.length, 2, '★ 쓴 날이 쓴 날로 안 그려집니다');

  r.used.forEach(c => {
    /* 회차 숫자가 «칸 안»에 있어야 한다 — 마우스를 올려야만 보이면 안 된다(대표 지시 ㉮) */
    assert.match(c.inner, /7|12/, '★ 칸에 회차가 없습니다: ' + c.inner);
    /* 날짜도 그대로 있어야 한다 — 회차가 날짜를 밀어내면 달력이 아니다 */
    assert.match(c.inner, /(^|>)\s*(4|18)\s*</, '★ 날짜가 사라졌습니다: ' + c.inner);
    /* ★ 흐리게(dis) 칠하지 않는다 — 그게 「구분이 안 된다」의 원인이었다 */
    assert.doesNotMatch(c.cls, /\bdis\b/, '★ 쓴 날을 흐리게 칠하고 있습니다');
  });
});

test('★ 방문과 사무실이 «갈라져» 보인다', () => {
  const r = drawCal([S('2026-08-04', 7, true), S('2026-08-18', 12, false)], 2026, 7);
  const f = r.used.find(c => /04|>4</.test(c.inner) || /\b4\b/.test(c.inner));
  const o = r.used.find(c => /18/.test(c.inner));
  assert.notEqual(f.cls, o.cls, '★ 방문과 사무실이 같은 모양입니다 — 가릴 수 없습니다');
});

test('★ 고르는 날은 그대로 고를 수 있고, 쓴 날은 못 고른다', () => {
  const r = drawCal([S('2026-08-04', 7, true)], 2026, 7);
  const used = r.used[0];
  assert.doesNotMatch(used.attrs, /onclick/, '★ 이미 쓴 날이 눌립니다 — 같은 날 두 번 들어갑니다');
  const free = r.cells.find(c => !/taken|dis/.test(c.cls) && /onclick/.test(c.attrs));
  assert.ok(free, '★ 빈 날을 고를 수 없게 됐습니다 — 쓰던 길이 막혔습니다');
});

/* ─────────────────────────────── ② 사전진단과 본컨설팅이 안 겹치는가 */
test('★ 사전진단 회차는 본컨설팅 회차와 «구분»된다 — 숫자가 같아도', () => {
  /* ⚠ 칸에 적히는 «글자 자체»를 견준다. 그려진 칸끼리 통째로 견주면 날짜가 달라
     늘 다르게 나와서, 정작 둘이 똑같이 적혀도 통과해 버린다(실제로 그랬다). */
  const box = { console, String };
  vm.createContext(box);
  vm.runInContext([fnSrc('schedPhase'), fnSrc('usedRoundShort')].join('\n'), box);
  assert.notEqual(
    box.usedRoundShort(S('2026-08-04', 1, true, 'pre')),
    box.usedRoundShort(S('2026-08-18', 1, true, 'main')),
    '★ 사전진단 1회차와 본컨설팅 1회차가 칸에서 똑같이 보입니다 — 어느 것이 무엇인지 알 수 없습니다');
  /* 그래도 회차 숫자는 둘 다 들어 있어야 한다 */
  assert.match(box.usedRoundShort(S('2026-08-04', 2, true, 'pre')), /2/, '★ 사전진단 칸에 회차가 없습니다');

  /* 쪽지에는 «사전진단»이라고 풀어서 적힌다 */
  const r = drawCal([S('2026-08-04', 1, true, 'pre')], 2026, 7);
  assert.match(r.used[0].attrs, /사전진단/, '★ 쪽지가 사전진단임을 안 알려 줍니다');
});

/* ─────────────────────────────── ③ 마우스를 올리면 나오는 쪽지 */
test('★ 쪽지에 날짜·회차·방문/사무실이 «다» 들어간다', () => {
  const box = { console, String };
  vm.createContext(box);
  vm.runInContext([fnSrc('schedPhase'), fnSrc('usedDayTip')].join('\n'), box);

  const t1 = box.usedDayTip(S('2026-09-15', 14, false), 8, 15);
  assert.match(t1, /9월/, '★ 몇 월인지가 없습니다');
  assert.match(t1, /15/, '★ 며칠인지가 없습니다');
  assert.match(t1, /14/, '★ 몇 회차인지가 없습니다');
  assert.match(t1, /사무실/, '★ 방문인지 사무실인지가 없습니다');

  const t2 = box.usedDayTip(S('2026-09-15', 2, true), 8, 15);
  assert.match(t2, /방문/, '★ 방문을 사무실로 적습니다');
});

test('양 끝 칸은 쪽지가 «창 밖으로» 나가지 않게 자리를 잡는다', () => {
  /* 2026-08-01 은 토요일 — 맨 오른쪽 줄에 쓴 날을 두고 본다 */
  const r = drawCal([S('2026-08-01', 1, true), S('2026-08-03', 2, true)], 2026, 7);
  const right = r.used.find(c => /\b1\b/.test(c.inner));
  const left = r.used.find(c => /\b3\b/.test(c.inner));
  assert.match(right.cls, /tip-r/, '★ 오른쪽 끝 쪽지가 창 밖으로 나갑니다');
  assert.match(left.cls, /tip-l/, '★ 왼쪽 끝 쪽지가 창 밖으로 나갑니다');
});

/* ─────────────────────────────── ④ 요약 줄의 방문·사무실 셈 (대표 결정 ②) */
test('★ 요약의 방문·사무실 셈은 «기존 N회»와 같은 묶음에서 나온다 — 더하면 N 이어야 한다', () => {
  /* ⚠ 「첫 세미콜론까지」로 자르면 style="…;" 에서 잘린다 — 묶음이 끝나는 자리로 자른다 */
  const m = /const ex=getScheds\(\)[\s\S]*?\n\s*\}\)\(\);/.exec(SRC);
  assert.ok(m, '요약 줄을 찾을 수 없습니다');
  const blk = m[0];
  assert.match(blk, /방문/, '★ 요약에 방문 셈이 없습니다');
  assert.match(blk, /사무실/, '★ 요약에 사무실 셈이 없습니다');
  /* ⚠ 다른 목록에서 따로 세면 「기존 14회」인데 「방문 7 · 사무실 8」 같은 것이 나온다 */
  assert.match(blk, /ex\.filter\(s=>s\.isField\)\.length/, '★ 방문 셈이 «기존 N회»와 다른 데서 나옵니다');
  assert.match(blk, /ex\.length\s*-\s*\w+/, '★ 사무실 셈이 «기존 N회»와 다른 데서 나옵니다');
});
