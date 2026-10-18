/* 「새벽에 왜 늘었나 — 사람인가 자동인가」 (2026-08-26 대표 물음)

   ★ 물음: "세벽시간에 파이어베이스 사용액이 발생하는데 각사람마다 발생하는것인지
     자동으로 발생하는것인지? 그 이유를 색깔 위에 팝업으로 보여줄 수 있나?"

   ★ 접속자는 시간 칸마다 한 번 남기지만, 청구 알림은 실제 사용보다 늦게 온다.
     따라서 접속 기록은 참고일 뿐 비용을 일으킨 사람이나 자동 작업을 판정하지 못한다.
   ★ 사용액을 보려고 사용액을 늘리면 웃긴다 — 시간 칸에 한 번만 찍고, 읽기도 한 번만 한다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const bare = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const ERP = bare(fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8'));
const RAW_P = fs.readFileSync(path.join(ROOT, 'enter.html'), 'utf8');
const P = bare(RAW_P);

function fnBody(src, name) {
  const a = src.indexOf('function ' + name + '(');
  assert.ok(a > 0, name + ' 이 없다');
  let d = 0;
  for (let k = src.indexOf('{', a); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(a, k + 1); }
  }
  return '';
}

/* ── 남기는 쪽 (푸른이알피) ── */

test('시간 칸마다 접속자를 남긴다', () => {
  const fn = fnBody(ERP, '_markPresenceHour');
  assert.match(fn, /data\/presence_hours\//, '자취를 안 남긴다');
  assert.match(fn, /\.set\(name \|\| sid\)/, '누구인지 안 적는다');
});

test('★ 같은 시간 칸에는 «한 번만» 쓴다 — 사용액을 보려고 사용액을 늘리면 웃긴다', () => {
  const fn = fnBody(ERP, '_markPresenceHour');
  assert.match(fn, /if\(_whoHourKey === mark\) return;/, '2분마다 계속 쓴다');
  assert.match(fn, /_whoHourKey = mark;/, '찍은 것을 기억하지 않는다');
});

test('접속 심장박동이 돌 때 함께 찍는다', () => {
  const fn = fnBody(ERP, '_writePresence');
  assert.match(fn, /_markPresenceHour\(sid, name\)/, '심장박동에서 안 부른다');
});

test('★ 쓰기가 막히는 자리에 두지 않았다', () => {
  /* billing 아래는 «쓰기 금지» 다(서버만 쓴다). 거기 두면 조용히 안 써진다.
     data/$other 는 직원이 읽고 쓸 수 있어 규칙을 안 고쳐도 된다. */
  const fn = fnBody(ERP, '_markPresenceHour');
  assert.strictEqual(/ref\('billing/.test(fn), false, '쓰기 금지 자리에 쓴다');
  assert.match(fn, /ref\('data\/presence_hours/, '규칙이 열린 자리에 안 둔다');
});

test('실패해도 화면이 안 죽는다 — 자취는 곁다리다', () => {
  const fn = fnBody(ERP, '_markPresenceHour');
  assert.match(fn, /\.catch\(function\(\)\{\}\)/, '쓰기 실패가 밖으로 튄다');
  assert.match(fn, /try\{/, '통째로 감싸지 않았다');
});

/* ── 읽어서 답하는 쪽 (포털 사용액 창) ── */

test('사용액 창이 그 자취를 읽는다', () => {
  const fn = fnBody(P, 'billWhoLoad');
  assert.match(fn, /data\/presence_hours\//, '자취를 안 읽는다');
  assert.match(fn, /\.once\('value'\)/, '구독한다 — 한 번만 읽어야 한다');
});

test('★ 색표 읽듯 «한 번만» 읽는다 — 달을 바꿀 때만 다시', () => {
  const fn = fnBody(P, 'billWhoLoad');
  assert.match(fn, /if\(_billWhoYm === ym && _billWho\) return Promise\.resolve/, '매번 다시 읽는다');
});

test('★ 자취를 먼저 채운 «뒤» 표를 그린다', () => {
  /* 순서가 뒤바뀌면 첫 그림에 「누가」 가 빠지고, 사람은 「안 나온다」고 본다. */
  const fn = fnBody(P, 'billHistLoad');
  const i = fn.indexOf('billWhoLoad(ym)');
  const j = fn.indexOf('HISTORY_ROOT');
  assert.ok(i > 0 && j > i, '사용액을 먼저 읽는다');
});

test('접속 기록이 없어도 자동 작업이 원인이라고 단정하지 않는다', () => {
  assert.match(P, /_who\.length \? _who\.join\(', '\) : '기록 없음'/,
    '접속 기록 없음과 자동 비용을 구별해야 한다');
  assert.doesNotMatch(P, /접속한 사람 없음 → 자동/,
    '청구 알림 도착 시각을 실제 비용 발생 시각으로 오인하고 있다');
});

test('자동 일정은 설명에 남기되 특정 알림 시각의 원인으로 붙이지 않는다', () => {
  assert.match(RAW_P, /메일 받기 07~21시 3분/, '자동 일정 참고 설명이 사라졌다');
  assert.doesNotMatch(P, /var _auto =/, '자동 일정 전체를 한 시각의 비용 원인처럼 붙였다');
});

test('줄 도움말은 알림 시각과 실제 사용 시각을 구분한다', () => {
  assert.match(P, /var _tip = h \+ ':00 청구 알림 도착/, '도착 시각을 밝히지 않았다');
  assert.match(P, /실제 사용 시각이나 비용 원인을 뜻하지 않습니다/, '원인으로 오인할 수 있다');
  assert.match(P, /html \+= '<tr title="' \+ _tip/, '줄에 안 붙인다');
  assert.match(P, /_tip\.replace\(\/"\/g, '&quot;'\)/, '따옴표를 안 막는다 — 표가 깨진다');
});

test('시간 열쇠 모양이 두 쪽에서 맞는다', () => {
  /* 남길 때는 2026-08-25-03, 읽을 때 오는 것은 2026-08-25T03 이다.
     여기가 어긋나면 접속 기록이 늘 비어 보인다 — 조용한 고장이다. */
  const fn = fnBody(P, 'billWhoAt');
  assert.match(fn, /replace\('T', '-'\)/, 'T 를 - 로 안 바꾼다');
  const ctx = { String, Object };
  vm.createContext(ctx);
  vm.runInContext('var _billWho = { "2026-08-25-03": { "P-001": "권형하" } };\n'
    + fn + '\nthis.f = billWhoAt;', ctx);
  assert.strictEqual(Array.from(ctx.f('2026-08-25T03')).join(','), '권형하', '시각을 못 맞춘다');
  assert.strictEqual(Array.from(ctx.f('2026-08-25T04')).length, 0, '없는 시각에 사람이 나온다');
});

test('열이 하나 늘었으니 머리줄·빈 줄·합계 줄이 다 맞는다', () => {
  /* 한 곳만 고치면 표가 어긋나 읽을 수 없게 된다. */
  assert.match(RAW_P, /<th title="알림 도착 무렵의 접속 기록[^>]*>접속 참고<\/th>/, '머리줄에 없다');
  assert.strictEqual(/colspan="7"/.test(RAW_P), false, '빈 줄이 아직 일곱 칸이다');
  const sum = fnBody(P, 'billSumRow');
  assert.match(sum, /<td class="unk"><\/td>/, '합계 줄 칸 수가 안 맞는다');
});

test('접속자 표시의 한계를 칸 읽는 법에 적어 두었다', () => {
  assert.match(RAW_P, /알림 도착 무렵의 접속 기록일 뿐 비용 원인이 아닙니다/, '뜻풀이가 없다');
  assert.match(RAW_P, /「기록 없음」도 자동 작업이 원인이었다는 뜻은 아닙니다/, '빈 기록을 자동 비용으로 오인할 수 있다');
});
