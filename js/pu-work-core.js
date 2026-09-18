/* 푸른통합시스템 — 근태·휴가 규칙 한 자리
   ────────────────────────────────────────────────────────────────────────
   캘린더(법인 대시보드·이음센터)를 이알피에서 떼어 내기 «전에» 놓는 주춧돌이다.
   떼어 내고 나면 같은 규칙이 두 앱에 각각 있게 되고, 그때부터는 한쪽만 고쳐도
   아무도 모른다 — 그리고 그 어긋남은 **급여에서** 드러난다(연차 잔여가 다르다).

   ⚠ 왜 지금 하는가 — 이미 갈라져 있었다(2026-09-18 실측).
     · 「연차 며칠 썼나」 공식이 **다섯 벌**이었다.
       개인 연차칸 · 대시보드 직원카드 · 대시보드 기간집계 · 근태관리 직원칩 · 휴가관리.
       그중 근태관리 것 하나만 8시간이 아니라 «그 사람의 소정근로시간»으로 나눈다.
       나머지 넷은 8로 나눈다. 같은 사람의 잔여 연차가 화면마다 다를 수 있었다.
     · 근태 «유형 목록»이 두 벌이었고 **서로 다른 것을 담고 있었다.**
       근태관리는 공가·지각·조퇴·결근을 알고 출산휴가·육아휴직을 모른다.
       캘린더는 그 반대다. 캘린더에서 넣은 출산휴가가 근태관리 화면에선 이름이 없다.
     · 같은 코드의 이름도 달랐다 — 근태관리 「연차(오전)」, 캘린더 「오전반차」.

   ⚠ 이 파일은 **화면을 바꾸지 않는다.** 갈라진 것을 한 자리에 모으되,
     각 화면이 지금까지 보여 주던 글자와 셈은 그대로 둔다(labelFor 의 where 인자,
     leaveUsed 의 hoursPerDay 인자가 그 «다름»을 숨기지 않고 이름 붙여 드러낸다).
     다르게 만들 것인지는 대표님이 보시고 정하실 일이지 내가 조용히 고를 일이 아니다.

   ⚠ 여기 담는 것은 «규칙»이지 «화면»이 아니다. 색·아이콘까지 담은 까닭은
     그것이 갈리면 같은 연차가 캘린더에선 초록, 근태관리에선 파랑이 되기 때문이다.
     자리잡기·여백 같은 것은 담지 않는다 — 그건 각 화면의 몫이다. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuWork = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* ── 근태 유형 사전 ────────────────────────────────────────────────
     두 화면이 각각 들고 있던 목록의 «합»이다. 어느 쪽이 고를 수 있는지는
     where 로 적어 둔다 — 합쳤다고 해서 없던 단추가 생기면 그건 화면 변경이다.

       code        저장되는 값 (attendance_records.type) — 절대 바꾸지 않는다
       label       근태관리에서 쓰던 이름
       calLabel    캘린더에서 쓰던 이름 (다를 때만 적는다)
       hours       기본 시간 (시간연차는 사람이 넣는다 → 0)
       deductLeave 연차에서 깎는가
       inAtt/inCal 그 화면의 고르기 목록에 있었는가 (지금 그대로)
       legacy      옛 코드 — 새로 만들지 않지만 이미 쌓인 것을 읽어야 한다 */
  var TYPES = [
    { code:'leave',          label:'연차',      hours:8, deductLeave:true,  icon:'🏖️', color:'#16a34a', bg:'#f0fdf4', inAtt:true,  inCal:true },
    { code:'halfday-am',     label:'연차(오전)', calLabel:'오전반차', hours:4, deductLeave:true, icon:'🌅', color:'#2563eb', bg:'#bfdbfe', inAtt:true, inCal:true, legacy:true },
    { code:'halfday-pm',     label:'연차(오후)', calLabel:'오후반차', hours:4, deductLeave:true, icon:'🌇', color:'#2563eb', bg:'#bfdbfe', inAtt:true, inCal:true, legacy:true },
    { code:'leave-hour',     label:'시간연차',  hours:0, deductLeave:true,  icon:'⏱️', color:'#16a34a', bg:'#bbf7d0', inAtt:true,  inCal:true },
    { code:'special-leave',  label:'특별휴가',  hours:8, deductLeave:false, icon:'🎉', color:'#16a34a', bg:'#f0fdf4', inAtt:false, inCal:true },
    { code:'sick',           label:'병가',      hours:8, deductLeave:false, icon:'🤒', color:'#dc2626', bg:'#fef2f2', inAtt:true,  inCal:true },
    { code:'public',         label:'공가',      hours:8, deductLeave:false, icon:'📋', color:'#2563eb', bg:'#eff6ff', inAtt:true,  inCal:false },
    { code:'telework',       label:'재택근무',  hours:8, deductLeave:false, icon:'🏠', color:'#2563eb', bg:'#eff6ff', inAtt:true,  inCal:true },
    { code:'late',           label:'지각',      hours:8, deductLeave:false, icon:'⏰', color:'#d97706', bg:'#fffbeb', inAtt:true,  inCal:false },
    { code:'early',          label:'조퇴',      hours:8, deductLeave:false, icon:'🚪', color:'#d97706', bg:'#fffbeb', inAtt:true,  inCal:false },
    { code:'absent',         label:'결근',      hours:8, deductLeave:false, icon:'❌', color:'#991b1b', bg:'#fef2f2', inAtt:true,  inCal:false },
    { code:'trip',           label:'출장',      hours:8, deductLeave:false, icon:'🚗', color:'#1e40af', bg:'#eff6ff', inAtt:true,  inCal:true,  legacy:true },
    { code:'maternity',      label:'출산휴가',  hours:8, deductLeave:false, icon:'👶', color:'#dc2626', bg:'#fef2f2', inAtt:false, inCal:true },
    { code:'parental-leave', label:'육아휴직',  hours:8, deductLeave:false, icon:'👶', color:'#dc2626', bg:'#fef2f2', inAtt:false, inCal:true },
    { code:'eum-work',       label:'이음센터',  hours:8, deductLeave:false, icon:'🏛️', color:'#2563eb', bg:'#eff6ff', inAtt:true,  inCal:true,  legacy:true }
  ];

  var BY_CODE = {};
  for (var i = 0; i < TYPES.length; i++) BY_CODE[TYPES[i].code] = TYPES[i];

  /* 모르는 코드가 와도 절대 터지지 않는다 — 옛 자료에 우리가 모르는 값이 있을 수 있다.
     터지는 대신 「모르는 유형」으로 그려 두면 사람이 보고 알려 준다. */
  function typeOf(code) {
    return BY_CODE[String(code || '')] || null;
  }

  /* 그 화면이 고를 수 있던 것만 — where: 'attendance' | 'calendar' | 'all' */
  function typesFor(where) {
    if (where === 'attendance') return TYPES.filter(function (t) { return t.inAtt; });
    if (where === 'calendar')   return TYPES.filter(function (t) { return t.inCal; });
    return TYPES.slice();
  }

  /* 화면마다 부르던 이름이 달랐다 — 그 다름을 지우지 않고 인자로 받는다. */
  function labelFor(code, where) {
    var t = typeOf(code);
    if (!t) return String(code || '');
    if (where === 'calendar' && t.calLabel) return t.calLabel;
    return t.label;
  }

  function iconFor(code) { var t = typeOf(code); return t ? t.icon : '📅'; }

  /* 한 건이 몇 시간짜리인가. 시간연차만 사람이 넣은 값을 쓴다. */
  function hoursOf(code, given) {
    var t = typeOf(code);
    if (!t) return 8;
    if (t.code === 'leave-hour') { var n = parseFloat(given); return isFinite(n) && n > 0 ? n : 1; }
    return t.hours;
  }

  /* ── 「연차를 며칠 깎는가」 ─────────────────────────────────────────
     이 한 줄이 다섯 군데에 흩어져 있던 것이다.
       연차 1일 · 반차 0.5일 · 시간연차 = 시간 ÷ 하루시간
     검사고정-허용: 0.5 와 ÷하루시간 은 «지금 값»이 아니라 **규칙**이다 —
       반차는 정의상 하루의 절반이고, 시간연차는 정의상 하루로 나눠 환산한다.
     ⚠ 특별휴가·병가·출산휴가는 연차를 깎지 않는다(0). 「자리를 비웠나」를 세려면
       absenceDaysOf 를 쓴다 — 두 물음은 다른 물음이고, 섞으면 잔여 연차가 줄어든다.
     ⚠ hoursPerDay 는 기본 8 이되 근태관리는 그 사람의 소정근로시간을 넘긴다.
       지금 그렇게 돌고 있어서 그대로 둔다 — 숨기지 않고 인자로 드러낸다. */
  function leaveDaysOf(rec, hoursPerDay) {
    if (!rec) return 0;
    var t = typeOf(rec.type);
    if (!t || !t.deductLeave) return 0;
    if (t.code === 'leave') return 1;
    if (t.code === 'halfday-am' || t.code === 'halfday-pm') return 0.5;
    if (t.code === 'leave-hour') {
      var per = parseFloat(hoursPerDay);
      if (!isFinite(per) || per <= 0) per = 8;
      return (parseFloat(rec.hours) || 0) / per;
    }
    return 0;
  }

  /* 여러 건의 합 — 잔여 연차를 셀 때 쓴다. */
  function leaveUsed(recs, hoursPerDay) {
    if (!recs || !recs.length) return 0;
    var sum = 0;
    for (var i = 0; i < recs.length; i++) sum += leaveDaysOf(recs[i], hoursPerDay);
    return sum;
  }

  /* ── 「며칠 자리를 비웠는가」 ───────────────────────────────────────
     연차 차감과 **다른 물음**이다. 대시보드의 「이번 달 휴가 쓴 사람」이 이것을 묻는다 —
     특별휴가도 자리를 비운 것이므로 센다. 연차 잔여에는 넣지 않는다.
     ⚠ 이 둘을 한 함수로 합치지 말 것. 합치는 순간 특별휴가가 연차를 깎거나,
       특별휴가 쓴 사람이 휴가자 목록에서 사라진다 — 둘 다 겪은 일이다. */
  function absenceDaysOf(rec) {
    if (!rec) return 0;
    var t = typeOf(rec.type);
    if (!t) return 0;
    if (t.deductLeave) return leaveDaysOf(rec, 8);
    if (t.code === 'special-leave') { var d = parseFloat(rec.days); return isFinite(d) && d > 0 ? d : 1; }
    return 0;
  }

  /* ── 마감 자물쇠 ───────────────────────────────────────────────────
     근태를 고치는 자리가 달력·근태관리·휴가·외부인력·이음센터에 걸쳐 스무 곳이 넘는다.
     한 곳씩 막으면 반드시 빠뜨리므로 **저장 함수 한 자리**에서 막는다.
     ⚠ 캘린더가 다른 앱으로 나가면 그 앱도 이 문을 지나야 한다.
       안 지나면 마감한 달의 연차가 캘린더에서 뚫리고 급여가 조용히 틀어진다.
     ⚠ 날짜가 없는 기록은 어느 달인지 알 수 없으니 막지 않는다(막으면 영영 못 고친다). */
  var LOCK_TABLES = { attendance_records:1, overtime_records:1, comp_leave_records:1 };

  function isLockTable(table) { return !!LOCK_TABLES[String(table || '')]; }

  /* 이 기록이 «어느 달의 자물쇠»에 걸리는가. 안 걸리면 빈 문자열. */
  function lockMonthOf(table, ymd) {
    if (!isLockTable(table)) return '';
    var ym = String(ymd || '').slice(0, 7);
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym) ? ym : '';
  }

  return {
    TYPES: TYPES,
    typeOf: typeOf,
    typesFor: typesFor,
    labelFor: labelFor,
    iconFor: iconFor,
    hoursOf: hoursOf,
    leaveDaysOf: leaveDaysOf,
    leaveUsed: leaveUsed,
    absenceDaysOf: absenceDaysOf,
    LOCK_TABLES: LOCK_TABLES,
    isLockTable: isLockTable,
    lockMonthOf: lockMonthOf
  };
});
