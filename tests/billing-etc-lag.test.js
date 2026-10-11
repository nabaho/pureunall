'use strict';
/* 요금 화면 「그 밖」 부풀림 — 칸이 늦게 오면 하루치가 커 보이던 것 (2026-10-11)

   ■ 무엇이 있었나
     대표 「비용이 너무 많이 증가」 — 화면이 「그 밖이 최근 7일 중 7일 하루 ₩300 넘게, 평균 ₩1,130」이라 경고했다.
     실제 구글 기록(날마다 전체 − 실시간DB)으로 세면 10/8~10/10 「그 밖」은 하루 ₩100~250 남짓이었다.
   ■ 왜
     구글은 «전체»와 «실시간DB»를 따로, 몇십 분씩 어긋나게 알려 준다. 전체가 먼저 온 시간은 그 몫이 「그 밖」으로
     잡히고(+), 실시간DB 가 뒤늦게 온 시간은 「그 밖」이 마이너스가 되는데 시간마다 0 으로 깎았다.
     그 깎은 값을 하루치로 더하니 플러스만 남아 부풀었다.
   ■ 규칙
     ⓐ 시간 칸 화면은 예전처럼 마이너스를 0 으로 보인다(사람이 마이너스 지출을 이해 못 한다).
     ⓑ 날·합계·시간당·경고는 «깎기 전» 값을 더한다 — 어긋난 몫이 서로 지워진다.
     ⓒ 자정을 넘겨 늦게 온 몫(어제 +, 오늘 −)도 이레치 경고에서는 서로 지워진다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-billing.js'), 'utf8'), ctx);
const B = ctx.PuBilling;

const H = 3600000;
const T0 = Date.parse('2026-10-01T00:00:00Z');
/* 하루 안에서 «전체가 먼저, 실시간DB 가 한 시간 뒤» 오는 기록을 짓는다.
   days: [{ db: 실시간DB 하루치, etc: 진짜 그 밖 하루치 }] — 날마다 08시에 전체, 09시에 실시간DB */
function laggedHistory(days) {
  const total = { [T0]: 0 }, database = { [T0]: 0 };
  let ct = 0, cd = 0;
  days.forEach((d, i) => {
    const base = T0 + i * 24 * H;
    ct += d.db + d.etc;
    total[base + 8 * H] = ct;          // 전체가 먼저 온다 — 이 시간엔 실시간DB 몫까지 「그 밖」처럼 보인다
    cd += d.db;
    database[base + 9 * H] = cd;       // 실시간DB 는 한 시간 뒤
    total[base + 9 * H] = ct;          // 전체는 그대로
  });
  return { total, database };
}

test('ⓐ 시간 칸은 예전처럼 — 마이너스 「그 밖」은 0 으로 보인다', () => {
  const hb = B.hourBuckets(laggedHistory([{ db: 0, etc: 0 }, { db: 3000, etc: 100 }]), { tz: 0 });
  const etcs = hb.filter((b) => b.known.etc).map((b) => b.parts.etc);
  assert.ok(etcs.every((v) => v >= 0), '시간 칸에 마이너스가 보이면 안 된다');
  assert.ok(etcs.some((v) => v >= 3000), '전체가 먼저 온 시간은 크게 보인다(시간 칸은 그대로)');
});

test('ⓑ 날의 「그 밖」은 진짜 값이다 — 늦게 온 실시간DB 몫이 섞이지 않는다', () => {
  const hb = B.hourBuckets(laggedHistory([{ db: 0, etc: 0 }, { db: 3000, etc: 100 }, { db: 2500, etc: 120 }]), { tz: 0 });
  const days = B.dayBuckets(hb);
  const d2 = days.find((d) => d.day === '2026-10-02'), d3 = days.find((d) => d.day === '2026-10-03');
  assert.equal(Math.round(d2.parts.etc), 100);
  assert.equal(Math.round(d3.parts.etc), 120);
  assert.equal(Math.round(d2.parts.database), 3000);
});

test('ⓑ 합계 줄과 시간당도 같은 셈 — 부풀지 않는다', () => {
  const hb = B.hourBuckets(laggedHistory([{ db: 0, etc: 0 }, { db: 3000, etc: 100 }]), { tz: 0 });
  const day2 = hb.filter((b) => b.hour.startsWith('2026-10-02'));
  assert.equal(Math.round(B.sumBuckets(day2).parts.etc), 100, '오늘 합계 「그 밖」');
  /* 아는 시간 칸 넷에 진짜 「그 밖」 100 → 시간당 25. 깎은 값을 더하던 예전 셈은 (3100)/4 ≈ 775 였다. */
  const r = B.hourlyRates(hb);
  assert.ok(r.parts.etc <= 100, '시간당 「그 밖」이 실시간DB 몫(3000)으로 부풀면 안 된다: ' + r.parts.etc);
});

test('ⓒ 이레 내내 실시간DB 만 큰 날 — 「그 밖」 경고가 뜨지 않는다', () => {
  const days = [{ db: 0, etc: 0 }];
  for (let i = 0; i < 8; i++) days.push({ db: 3000, etc: 80 });
  const h = laggedHistory(days);
  const hb = B.hourBuckets(h, { tz: 0 });
  const now = T0 + 9 * 24 * H + 12 * H;
  assert.equal(B.etcAlert(hb, now, { tz: 0 }), null);
});

test('ⓒ 자정을 넘겨 늦게 온 몫 — 어제 +, 오늘 − 가 이레치에서 지워진다', () => {
  /* 날마다 23시에 전체, 다음 날 01시에 실시간DB — 날 칸으로는 어제 크고 오늘 마이너스 */
  const total = { [T0]: 0 }, database = { [T0]: 0 };
  let ct = 0, cd = 0;
  for (let i = 0; i < 9; i++) {
    const base = T0 + i * 24 * H;
    ct += 2000 + 50; total[base + 23 * H] = ct;
    cd += 2000; database[base + 25 * H] = cd; total[base + 25 * H] = ct;
  }
  const hb = B.hourBuckets({ total, database }, { tz: 0 });
  const now = T0 + 10 * 24 * H + 12 * H;
  const a = B.etcAlert(hb, now, { tz: 0 });
  assert.equal(a, null, '진짜 「그 밖」은 하루 ₩50 — 경고가 뜨면 안 된다: ' + JSON.stringify(a));
});

test('진짜로 늘 새는 「그 밖」(하루 ₩600)은 여전히 알린다 — 고치다 이빨이 빠지지 않게', () => {
  const days = [{ db: 0, etc: 0 }];
  for (let i = 0; i < 8; i++) days.push({ db: 1000, etc: 600 });
  const hb = B.hourBuckets(laggedHistory(days), { tz: 0 });
  const now = T0 + 9 * 24 * H + 12 * H;
  const a = B.etcAlert(hb, now, { tz: 0 });
  assert.ok(a, '하루 ₩600 이 이레 내내면 알려야 한다');
  assert.ok(Math.abs(a.perDay - 600) <= 10, '하루 평균은 진짜 값: ' + a.perDay);
});
