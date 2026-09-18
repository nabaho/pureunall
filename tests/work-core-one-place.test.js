/* 근태·휴가 규칙은 «한 자리»다 — js/pu-work-core.js
   ═══════════════════════════════════════════════════════════════════════════
   ★ 왜 이 검사가 있는가
     캘린더(법인 대시보드·이음센터)를 이알피에서 떼어 내기로 했다. 떼어 내고 나면
     같은 규칙이 두 앱에 각각 있게 되고, 한쪽만 고쳐도 아무도 모른다.
     그리고 그 어긋남은 화면이 아니라 **급여에서** 드러난다 — 잔여 연차가 다르다.

     떼어 내기 전에 이미 갈라져 있었다(2026-09-18 실측):
       · 「연차 며칠 썼나」 공식이 다섯 벌
       · 근태 유형표가 세 벌 — 그중 둘은 «글자 하나까지 같은 것»이 복사돼 있었고,
         나머지 하나는 담고 있는 유형이 아예 달랐다(공가·지각 ↔ 출산휴가·육아휴직).

   ★ 무엇을 지키는가 — «규칙이 한 자리인가»이지 «지금 값이 무엇인가»가 아니다.
     유형이 몇 개인지, 색이 무엇인지는 박지 않는다. 늘어나도 안 깨져야 한다.
     다만 0.5·÷하루시간 같은 것은 «값이 곧 규칙»이라 박는다(아래에 까닭을 적었다).

   ⚠ 이 검사가 걸리면 지울 것이 아니라 고칠 것이다 —
     새로 적은 공식·유형표를 js/pu-work-core.js 로 옮기고 거기서 받아 쓰면 된다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 주석걷기 } = require('./helpers/strip-comments.js');

const ROOT = path.join(__dirname, '..');
const CORE_FILE = path.join(ROOT, 'js', 'pu-work-core.js');
const PuWork = require(CORE_FILE);

/* 이알피의 «코드만» — 주석에 적어 둔 설명이 검사를 통과시키면 안 된다.
   인라인 스크립트만 모아 본다(본문 HTML 에는 규칙이 없다). */
function erpCode() {
  const raw = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const scripts = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(raw)) !== null) scripts.push(m[1]);
  return 주석걷기(scripts.join('\n'));
}

// ── 1. 공용 파일의 셈이 실제로 맞는가 ────────────────────────────────────
// 검사고정-허용: 0.5 와 ÷하루시간 은 «지금 값»이 아니라 정의다 —
//   반차는 하루의 «절반»이고, 시간연차는 하루로 «나눠» 환산하는 것이 규칙이다.
//   이 숫자가 바뀌면 그것은 개선이 아니라 제도 변경이므로 검사가 걸리는 게 옳다.
test('연차 차감 — 연차 1일, 반차 0.5일, 시간연차는 하루로 나눈다', () => {
  assert.strictEqual(PuWork.leaveDaysOf({ type: 'leave' }), 1);
  assert.strictEqual(PuWork.leaveDaysOf({ type: 'halfday-am' }), 0.5);
  assert.strictEqual(PuWork.leaveDaysOf({ type: 'halfday-pm' }), 0.5);
  assert.strictEqual(PuWork.leaveDaysOf({ type: 'leave-hour', hours: 4 }), 0.5);
});

test('하루시간이 8이 아닌 사람 — 소정근로시간으로 나눈다(근태관리가 그렇게 돌고 있다)', () => {
  assert.strictEqual(PuWork.leaveDaysOf({ type: 'leave-hour', hours: 4 }, 4), 1);
  assert.strictEqual(PuWork.leaveDaysOf({ type: 'leave-hour', hours: 4 }, 0), 0.5); // 0 은 8로 물러선다
});

test('연차를 깎지 않는 것은 0 — 특별휴가·병가·출산휴가가 잔여 연차를 줄이면 안 된다', () => {
  ['special-leave', 'sick', 'maternity', 'parental-leave', 'telework', 'trip', 'eum-work']
    .forEach((code) => {
      assert.strictEqual(PuWork.leaveDaysOf({ type: code, hours: 8, days: 3 }), 0, code);
    });
});

test('「자리를 비웠나」는 다른 물음 — 특별휴가는 여기서만 센다', () => {
  assert.strictEqual(PuWork.absenceDaysOf({ type: 'special-leave', days: 3 }), 3);
  assert.strictEqual(PuWork.absenceDaysOf({ type: 'special-leave' }), 1); // 날수가 없으면 하루
  assert.strictEqual(PuWork.absenceDaysOf({ type: 'leave' }), 1);
  assert.strictEqual(PuWork.absenceDaysOf({ type: 'halfday-am' }), 0.5);
});

test('모르는 유형이 와도 터지지 않는다 — 옛 자료에 우리가 모르는 값이 있다', () => {
  assert.strictEqual(PuWork.leaveDaysOf({ type: '엉뚱한값' }), 0);
  assert.strictEqual(PuWork.leaveDaysOf(null), 0);
  assert.strictEqual(PuWork.leaveUsed([]), 0);
  assert.strictEqual(PuWork.leaveUsed(null), 0);
  assert.strictEqual(PuWork.typeOf('엉뚱한값'), null);
});

test('합계는 한 건씩의 합과 같다', () => {
  const recs = [
    { type: 'leave' }, { type: 'halfday-pm' },
    { type: 'leave-hour', hours: 2 }, { type: 'special-leave', days: 5 }
  ];
  const one = recs.reduce((s, r) => s + PuWork.leaveDaysOf(r), 0);
  assert.strictEqual(PuWork.leaveUsed(recs), one);
});

// ── 2. 유형표가 쓸모 있는 꼴인가 (개수·색은 박지 않는다) ────────────────
test('유형표 — 코드가 겹치지 않고, 어느 화면에서도 못 고르는 유령이 없다', () => {
  const codes = PuWork.TYPES.map((t) => t.code);
  assert.strictEqual(new Set(codes).size, codes.length, '같은 코드가 두 번 있다');
  PuWork.TYPES.forEach((t) => {
    assert.ok(t.label, t.code + ' 에 이름이 없다');
    assert.ok(t.inAtt || t.inCal, t.code + ' 는 어느 화면에도 없다 — 유령이다');
  });
});

test('화면마다 부르던 이름이 다르면 그 다름이 남아 있어야 한다', () => {
  // 합쳤다고 해서 화면의 글자가 바뀌면 그건 «규칙 정리»가 아니라 화면 변경이다.
  assert.notStrictEqual(
    PuWork.labelFor('halfday-am', 'attendance'),
    PuWork.labelFor('halfday-am', 'calendar'),
    '근태관리와 캘린더가 반차를 다르게 부르고 있었다 — 한쪽으로 몰래 맞추지 않는다'
  );
});

test('시간연차만 사람이 넣은 시간을 쓴다', () => {
  assert.strictEqual(PuWork.hoursOf('leave-hour', 3), 3);
  assert.strictEqual(PuWork.hoursOf('leave-hour', 0), 1);   // 안 넣었으면 1시간
  assert.strictEqual(PuWork.hoursOf('leave', 3), 8);        // 연차는 사람 값을 안 본다
});

// ── 3. 마감 자물쇠 규칙도 한 자리 ───────────────────────────────────────
test('마감 자물쇠 — 날짜 없는 기록은 막지 않는다(막으면 영영 못 고친다)', () => {
  assert.strictEqual(PuWork.lockMonthOf('attendance_records', '2026-03-15'), '2026-03');
  assert.strictEqual(PuWork.lockMonthOf('attendance_records', ''), '');
  assert.strictEqual(PuWork.lockMonthOf('attendance_records', '2026-13-01'), '');
  assert.strictEqual(PuWork.lockMonthOf('companies', '2026-03-15'), ''); // 근태표가 아니다
});

// ── 4. 이알피가 그 한 자리를 실제로 쓰고 있는가 ─────────────────────────
test('이알피가 공용 파일을 싣는다 — 캐시 번호와 함께', () => {
  const raw = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  const tag = raw.match(/<script[^>]+src="js\/pu-work-core\.js(\?v=\d+)?"/);
  assert.ok(tag, 'js/pu-work-core.js 를 안 싣고 있다');
  assert.ok(tag[1], '캐시 번호(?v=)가 없다 — 고쳐도 옛 파일이 그대로 돈다');
});

/* 연차 공식은 두 가지 꼴로 적혀 있었다. 둘 다 본다 —
   ① 유형을 그 자리에서 보는 꼴   : if(r.type==='halfday-am') return s+0.5
   ② 미리 세어 두고 곱·나누는 꼴 : leaveCnt + halfCnt*0.5 + hourTotal/8
   ②를 안 보면 이빨이 없다. 2026-09-18 에 실제로 겪었다 — ①만 보는 검사를 만들고
   「지켜진다」고 여겼는데, 사본에 옛 공식을 도로 넣어 보니 그냥 통과했다.
   그리고 그 ② 꼴로 숨어 있던 것이 **세 벌** 더 있었다(하루시간을 변수로 나누던 것들). */
test('이알피 안에 «두 번째 연차 공식»이 없다', () => {
  const code = erpCode();
  const inline = code.match(/halfday-(am|pm)['"][^\n]{0,120}?0\.5/g) || [];
  const counted = (code.match(/\*\s*0\.5[^;]{0,200}?\/\s*\(?\s*[A-Za-z0-9_.]/g) || [])
    // 「(며칠)」을 글자로 그리는 자리는 셈이 아니다 — 그 자리는 이미 PuWork 가 낸 값을 받아 쓴다.
    .filter((x) => !/['"]/.test(x));
  assert.deepStrictEqual(
    inline.concat(counted), [],
    '연차 공식을 또 적었다 — PuWork.leaveUsed / leaveDaysOf 를 쓸 것:\n  '
      + inline.concat(counted).map((x) => x.replace(/\s+/g, ' ')).join('\n  ')
  );
});

/* ⚠ 여기서 보는 것은 «셈에 쓰이는 유형표»다 — 유형 → 몇 시간짜리인가.
     그것이 갈리면 저장되는 «자료»가 달라지고, 결국 급여가 달라진다.

   ⚠ 그림·색만 담은 «보기용» 표는 아직 이알피에 셋 남아 있다(2026-09-18).
     개인 캘린더 · 빠른 등록창 · 근태관리가 같은 연차를 🌴 · 🏖️ 로, 반차를
     초록 · 파랑으로 서로 다르게 그리고 있다. 합치면 **화면이 바뀐다** —
     0걸음은 화면을 안 바꾸기로 한 단계라 여기서는 건드리지 않는다.
     합칠지는 대표님이 보시고 정하실 일이다(0걸음-나). 그때 이 검사도 넓힌다.
     지금 좁혀 두는 것을 숨기지 않으려고 이렇게 적어 둔다 —
     «어긋난 안내는 없는 것보다 나쁘다». */
test('이알피 안에 «두 번째 근태 유형표»가 없다 (셈에 쓰이는 것)', () => {
  const code = erpCode();
  // 유형 코드를 열쇠로 { hours: … } 를 적어 두면 그것이 셈에 쓰이는 표다.
  const tables = code.match(/['"][a-z-]+['"]\s*:\s*\{\s*hours\s*:/g) || [];
  assert.deepStrictEqual(
    tables, [],
    '근태 유형표를 또 적었다 — PuWork.typeOf / hoursOf 를 쓸 것:\n  ' + tables.join('\n  ')
  );
});

test('마감 자물쇠 대상표를 이알피에 다시 적지 않는다', () => {
  const code = erpCode();
  const again = code.match(/overtime_records\s*:\s*1[\s\S]{0,60}?comp_leave_records\s*:\s*1/g) || [];
  assert.deepStrictEqual(
    again, [],
    '자물쇠 대상표를 또 적었다 — PuWork.LOCK_TABLES 를 쓸 것'
  );
});

test('공용 파일 자체에 잘못 박힌 것이 없다 — 주석 말고 코드로 검사한다', () => {
  const src = 주석걷기(fs.readFileSync(CORE_FILE, 'utf8'));
  assert.ok(/module\.exports/.test(src), '검사가 require 할 수 있어야 한다');
  assert.ok(/root\.PuWork/.test(src), '브라우저에서 window.PuWork 로 잡혀야 한다');
});
