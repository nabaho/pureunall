#!/usr/bin/env node
'use strict';
/* 파이어베이스 요금이 «어느 날» 났는지 한 장으로 (대표 물음 2026-09-19
   「자동으로 돌면서 사용하는 것 횟수를 줄일수 없나 계속 쓸데없이 비용나가는거 아닌가?」)

   ■ 왜 이것이 필요한가
     포털의 사용액 창은 「이번 달 얼마」와 「시간별」을 보여 준다. 그런데 그 둘로는
     **「계속 새는 것」과 「하루 크게 샌 것」을 가릴 수가 없다.** 2026-09-19 실측이
     그랬다 — 이번 달 실시간DB ₩25,298 가운데 ₩18,977(75%)이 9/16·9/17 «이틀»에
     났고, 나머지 17일은 하루 평균 ₩370 이었다. 화면의 「월말 ₩117,492」는 그 이틀이
     아직 「최근 3일」에 끼어 있어 나온 값이었다.
     날마다 갈라 보면 그것이 **한눈에** 보인다.

   ■ 무엇을 읽나 — 이미 서버에 쌓여 있는 것뿐이다
     billing/history/{YYYY-MM}/{항목}/{시각} = 그 달 누적 금액(원).
     구글이 예산 알림을 쏠 때마다 recordBillingAlert 가 적어 둔 것이다.
     여기서는 **읽기만** 한다.

   ■ 「그 밖」이란
     전체 − (실시간DB + 창고 + 서버·메일). 예산이 안 걸린 나머지 전부다.
     ⚠ 이 값이 «날마다 거의 같으면» 그것은 새는 것이 아니라 **가만히 있어도 나가는
       고정비**다(쌓아 둔 것에 붙는 값). 자동으로 도는 횟수를 줄여도 안 준다.
       ⚠ 무엇인지는 여기서 못 본다 — 예산이 안 걸려 있어서다.

   쓰기: node scripts/billing-daily.js            (최근 두 달)
         node scripts/billing-daily.js 2026-09    (그 달만)
   ⚠ firebase CLI 로그인이 있어야 한다. 없으면 그렇다고 말하고 멈춘다. */

const { execFileSync } = require('node:child_process');

const KST_MIN = 9 * 60;
const 항목들 = [
  { key: 'database', 이름: '실시간DB' },
  { key: 'storage', 이름: '창고' },
  { key: 'functions', 이름: '서버' },
];

/* ── 셈 (여기만 검사한다 — 서버를 안 불러도 돌아야 한다) ───────────────── */

/* 그 시각이 «서울로» 며칠인가 */
function 서울날짜(ms, tzMin) {
  const t = Number(ms) + (tzMin === undefined ? KST_MIN : tzMin) * 60000;
  return new Date(t).toISOString().slice(0, 10);
}

/* 누적 금액 점들을 «날마다 늘어난 만큼»으로 바꾼다.
   ⚠ 첫날은 내놓지 않는다 — 그 앞이 없으니 얼마 늘었는지 알 길이 없다.
     0 으로 적으면 「그날 안 썼다」로 읽힌다. 모르는 것과 0 은 다르다. */
function 날마다(점들, tzMin) {
  const 끝값 = Object.create(null);
  Object.keys(점들 || {}).forEach((t) => {
    const v = Number(점들[t]);
    if (!isFinite(v)) return;
    const d = 서울날짜(t, tzMin);
    const 이전 = 끝값[d];
    /* 같은 날 여러 점이면 «마지막» 것이 그날 끝 누적이다 */
    if (이전 === undefined || Number(t) > 이전.t) 끝값[d] = { t: Number(t), v: v };
  });
  const 날들 = Object.keys(끝값).sort();
  const 결과 = Object.create(null);
  let 앞 = null;
  날들.forEach((d) => {
    결과[d] = (앞 === null) ? null : Math.round(끝값[d].v - 앞);
    앞 = 끝값[d].v;
  });
  return 결과;
}

/* 한 달치를 표 한 장으로. 줄마다 { 날짜, 전체, database, storage, functions, 그밖 } */
function 달표(달자료, tzMin) {
  const 칸 = { total: 날마다((달자료 || {}).total, tzMin) };
  항목들.forEach((c) => { 칸[c.key] = 날마다((달자료 || {})[c.key], tzMin); });
  const 날들 = new Set();
  Object.keys(칸).forEach((k) => Object.keys(칸[k]).forEach((d) => 날들.add(d)));
  return Array.from(날들).sort().map((d) => {
    const 줄 = { 날짜: d, total: 칸.total[d] };
    let 아는것 = 0, 하나라도 = false;
    항목들.forEach((c) => {
      const v = 칸[c.key][d];
      줄[c.key] = v;
      if (typeof v === 'number') { 아는것 += v; 하나라도 = true; }
    });
    /* ⚠ 전체를 모르면 「그 밖」도 모른다. 0 으로 내놓으면 「그 밖이 없다」로 읽힌다. */
    줄.그밖 = (typeof 줄.total === 'number' && 하나라도) ? 줄.total - 아는것 : null;
    return 줄;
  });
}

/* 「계속 새는가」 — 날마다 거의 같으면 그것은 고정비다.
   ⚠ 가운뎃값으로 잰다. 하루 크게 샌 날이 평균을 끌어올리면 고정비가 안 보인다. */
function 고정비냐(값들) {
  const xs = (값들 || []).filter((v) => typeof v === 'number').sort((a, b) => a - b);
  if (xs.length < 4) return null;
  const 가운데 = xs[Math.floor(xs.length / 2)];
  const 아래 = xs[Math.floor(xs.length * 0.25)];
  const 위 = xs[Math.floor(xs.length * 0.75)];
  if (가운데 <= 0) return null;
  /* 절반이 가운뎃값의 ±30% 안에 들면 «날마다 같은 값»이라고 본다 */
  const 고름 = (위 - 아래) / 가운데 <= 0.6;
  return { 가운데: Math.round(가운데), 고름: 고름, 날수: xs.length };
}

/* ── 서버에서 읽어 오기 (가장자리) ─────────────────────────────────────── */

function 읽어오기(달) {
  const 인자 = ['database:get', '/billing/history/' + 달, '--project', 'pureun-erp'];
  const out = execFileSync('firebase', 인자, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return JSON.parse(out);
}

function 줄그리기(줄) {
  const f = (v, w) => String(v === null || v === undefined ? '-' : v.toLocaleString('ko-KR')).padStart(w);
  return 줄.날짜 + ' ' + f(줄.total, 9) + f(줄.database, 10) + f(줄.storage, 7) + f(줄.functions, 7) + f(줄.그밖, 9);
}

function main() {
  const 달 = process.argv[2];
  const 달들 = 달 ? [달] : (function () {
    const d = new Date(Date.now() + KST_MIN * 60000);
    const 이번 = d.toISOString().slice(0, 7);
    const p = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
    return [p.toISOString().slice(0, 7), 이번];
  })();

  달들.forEach((ym) => {
    let 자료;
    try {
      자료 = 읽어오기(ym);
    } catch (e) {
      console.error('\n' + ym + ' — 못 읽었습니다: ' + ((e && e.message) || e).toString().split('\n')[0]);
      console.error('  firebase CLI 로그인이 풀렸을 수 있습니다: firebase login');
      return;
    }
    if (!자료) { console.log('\n=== ' + ym + ' — 기록이 없습니다 ==='); return; }
    const 표 = 달표(자료);
    console.log('\n=== ' + ym + ' · 날마다 나간 돈 (원, 서울 기준) ===');
    console.log('날짜            전체  실시간DB     창고    서버     그 밖');
    표.forEach((줄) => console.log(줄그리기(줄)));

    const 그밖들 = 표.map((r) => r.그밖);
    const 판정 = 고정비냐(그밖들);
    if (판정) {
      console.log(판정.고름
        ? '\n▶ 「그 밖」은 날마다 ₩' + 판정.가운데.toLocaleString('ko-KR') + ' 꼴로 «거의 같습니다»'
          + ' — 새는 것이 아니라 가만히 있어도 나가는 고정비입니다(한 달 ≈ ₩'
          + (판정.가운데 * 30).toLocaleString('ko-KR') + ').\n'
          + '  자동으로 도는 횟수를 줄여도 이 값은 안 줄어듭니다. 무엇인지는 예산이 안 걸려 있어 여기서 못 봅니다.'
        : '\n▶ 「그 밖」이 날마다 들쭉날쭉합니다(가운뎃값 ₩' + 판정.가운데.toLocaleString('ko-KR')
          + ') — 쓰는 만큼 붙는 값이 섞여 있습니다.');
    }
    const 큰날 = 표.filter((r) => typeof r.database === 'number').sort((a, b) => b.database - a.database)[0];
    if (큰날 && 큰날.database > 0) {
      const 합 = 표.reduce((s, r) => s + (r.database || 0), 0);
      if (합 > 0) {
        console.log('▶ 실시간DB 가 가장 컸던 날: ' + 큰날.날짜 + ' ₩' + 큰날.database.toLocaleString('ko-KR')
          + ' (이 달 실시간DB 의 ' + Math.round(큰날.database / 합 * 100) + '%)');
      }
    }
  });
}

if (require.main === module) main();

module.exports = { 서울날짜, 날마다, 달표, 고정비냐, 항목들 };
