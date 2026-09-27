'use strict';
/* 요금 화면 — 「그 밖」이 늘 새면 알리고, 월말 어림은 튄 날에 휘둘리지 않는다 (2026-09-27)

   ■ 무엇이 있었나
     ① 「그 밖」(예산 없는 서비스가 통째로 섞이는 칸) 안에 하루 ₩557 짜리 Cloud SQL
        (아무도 안 쓰던 시험 서버)이 8월부터 숨어 있었는데 화면은 아무 말이 없었다.
     ② 월말 어림이 «최근 3일 평균»이라, 9/18 아침(9/16·17 고장 난 이틀이 낀 때)에
        월말 ≈₩126,400 을 내놓았다. 실제 9월은 ≈₩46,600 이었다.
   ■ 규칙
     ⓐ 끝난 날 최근 7일 중 5일 이상 「그 밖」 ≥ ₩300/일 이면 알린다 — 하루 튄 것으로는 안 띄운다.
     ⓑ 모르는 날은 세지 않는다(0원으로 치면 거짓말). 오늘(반쪽 하루)도 안 센다.
     ⓒ 월말 어림 = 최근 7일 가운데 값. 단 최근 사흘이 모두 그보다 싸면 사흘 평균(고친 보람). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('node:vm');
/* 화면이 싣는 그 파일을 그대로 싣는다 */
const ctx = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-billing.js'), 'utf8'), ctx);
const B = ctx.PuBilling;
const { stripComments } = require('./strip-comments');

const DAY = 86400000;
/* 날마다 늘어난 돈으로 기록을 짓는다 — total 과 database 두 칸(그 밖 = total − database) */
function hist(perDay) {       // { 'YYYY-MM-DD': [전체, 실시간DB] }
  const total = {}, database = {};
  const days = Object.keys(perDay).sort();
  const first = Date.parse(days[0] + 'T00:00:00Z') - DAY;
  total[first] = 0; database[first] = 0;
  let ct = 0, cd = 0;
  days.forEach((d) => {
    ct += perDay[d][0]; cd += perDay[d][1];
    const t = Date.parse(d + 'T12:00:00Z');
    total[t] = ct; database[t] = cd;
  });
  return { total, database };
}
const bk = (perDay) => B.hourBuckets(hist(perDay), { tz: 0 });

test('ⓐ ★★ 「그 밖」이 일주일 내내 새면 알린다 — Cloud SQL 같은 것', () => {
  const week = {};
  ['09-19', '09-20', '09-21', '09-22', '09-23', '09-24', '09-25'].forEach((d) => { week['2026-' + d] = [700, 100]; });
  const a = B.etcAlert(bk(week), Date.parse('2026-09-26T03:00:00Z'), { tz: 0 });
  assert.ok(a, '★★ 하루 ₩600 씩 일주일이 샜는데 아무 말이 없습니다');
  assert.equal(a.days, 7);
  assert.equal(a.perDay, 600);
  assert.equal(a.share, 86, '전체 중 몫(%)이 틀립니다');
});

test('ⓐ ★ 하루 이틀 튄 것으로는 안 띄운다 — 그것은 하루 폭주 알림 몫이다', () => {
  const week = {};
  ['09-19', '09-20', '09-21', '09-22', '09-23'].forEach((d) => { week['2026-' + d] = [150, 100]; });
  week['2026-09-24'] = [2000, 100]; week['2026-09-25'] = [2000, 100];
  assert.equal(B.etcAlert(bk(week), Date.parse('2026-09-26T03:00:00Z'), { tz: 0 }), null,
    '★ 이틀 튄 것을 «늘 새는 것»으로 봤습니다 — 늘 뜨는 경고는 곧 아무도 안 읽습니다');
});

test('ⓑ ★★ 모르는 날·오늘은 세지 않는다', () => {
  /* 끝난 날이 넷뿐이면 다섯을 못 채운다 — 오늘 반나절을 세면 거짓으로 채워진다 */
  const four = {};
  ['09-22', '09-23', '09-24', '09-25'].forEach((d) => { four['2026-' + d] = [700, 100]; });
  four['2026-09-26'] = [700, 100];                       // «오늘»
  assert.equal(B.etcAlert(bk(four), Date.parse('2026-09-26T20:00:00Z'), { tz: 0 }), null,
    '★★ 아직 안 끝난 오늘을 셌습니다');
  /* 기록이 빈 날(소식 없는 날)은 «0원인 날»이 아니다 — 끝난 날 넷만 알면 다섯을 못 채운다.
     ⚠ 쪼갠 칸이 안 움직인 시간은 «그 칸 0원»으로 보는 것이 이 파일의 셈법이다
       (구글은 금액이 움직일 때만 쏜다) — 그래서 그 경우는 「모른다」가 아니다. */
  const gaps = { '2026-09-19': [700, 100], '2026-09-21': [700, 100], '2026-09-23': [700, 100], '2026-09-25': [700, 100] };
  assert.equal(B.etcAlert(bk(gaps), Date.parse('2026-09-26T03:00:00Z'), { tz: 0 }), null,
    '★★ 소식 없던 날까지 «샌 날»로 셌습니다');
});

test('ⓒ ★★ 월말 어림 — 튄 이틀에 휘둘리지 않는다 (9/18 아침 실제 숫자)', () => {
  const d = { '2026-09-11': 581, '2026-09-12': 579, '2026-09-13': 1148, '2026-09-14': 749,
              '2026-09-15': 1296, '2026-09-16': 10890, '2026-09-17': 9331 };
  const perDay = {}; Object.keys(d).forEach((k) => { perDay[k] = [d[k], 0]; });
  const row = { cost: 34094, intervalStart: Date.parse('2026-09-01T00:00:00Z') };
  const r = B.projectRecent(row, bk(perDay), Date.parse('2026-09-18T00:30:00Z'), { tz: 0 });
  assert.ok(r, '어림을 못 냈습니다');
  assert.equal(r.perDay, 1148, '★★ 가운데 값이 아닙니다 — 튄 이틀(₩10,890·₩9,331)에 끌려갔습니다');
  assert.equal(r.how, 'median');
  assert.ok(r.cost < 60000, '★★ 월말 어림이 또 부풀었습니다: ' + r.cost);
});

test('ⓒ ★ 고친 직후 사흘이 모두 싸면 «바로» 내려간다', () => {
  const perDay = {};
  ['01', '02', '03', '04'].forEach((d) => { perDay['2026-08-' + d] = [5000, 0]; });
  ['05', '06', '07'].forEach((d) => { perDay['2026-08-' + d] = [500, 0]; });
  const row = { cost: 21500, intervalStart: Date.parse('2026-08-01T00:00:00Z') };
  const r = B.projectRecent(row, bk(perDay), Date.parse('2026-08-08T01:00:00Z'), { tz: 0 });
  assert.equal(r.how, 'drop');
  assert.equal(r.perDay, 500, '★ 고친 보람이 어림에 안 보입니다');
});

test('★ 화면 — 알림 칸·몫(%)·결제 보고서 길이 이어져 있다', () => {
  const src = stripComments(fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8'));
  assert.match(src, /id="billEtc"/, '★ 알림 칸이 없습니다');
  assert.match(src, /function billPaintEtc\(s\)\{[\s\S]*?s\.etcAlert/, '★ 알림 칸이 PuBilling.etcAlert 를 안 봅니다');
  assert.match(src, /billPaintEtc\(s\);/, '★ 창을 그릴 때 알림을 안 그립니다');
  assert.match(src, /target="_blank" rel="noopener" href="' \+ B\.BILLING_REPORT_URL/, '★ 결제 보고서로 가는 길이 없거나 요금 창을 덮습니다');
  assert.match(src, /p\.key === 'etc'[\s\S]{0,120}share >= 20/, '★ 「그 밖」 몫(%)이 안 붙습니다');
  assert.match(src, /bs\.how === 'drop'/, '★ 어림을 무엇으로 밀었는지 안 밝힙니다');
  assert.match(B.BILLING_REPORT_URL, /^https:\/\/console\.cloud\.google\.com\/billing\/reports/);
});
