'use strict';

/* 월요일 자동발송의 문지기.
   화면이 미리 만든 «확정본»만 받고, 서버는 당일·상태·중복을 다시 확인한다. */
function todaySeoul(now) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(Number(now) || Date.now()));
}

function check(config, ready, today) {
  const c = config && typeof config === 'object' ? config : {};
  const r = ready && typeof ready === 'object' ? ready : {};
  if (c.자동발송 !== true) return { ok: false, reason: 'off' };
  if (r.상태 !== '준비') return { ok: false, reason: 'not-ready' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.보낼날 || ''))
      || r.보낼날 !== today) return { ok: false, reason: 'wrong-day' };
  if (!r.회차열쇠 || !Array.isArray(r.to) || !r.to.length) {
    return { ok: false, reason: 'empty' };
  }
  if (!r.subject || !r.body || !r.html) return { ok: false, reason: 'empty-letter' };
  return { ok: true };
}

/* ★★ 월요일 자동발송 «찜» — 거래(transaction) 안에서 부른다 (2026-10-05 실제 사고)
   ═══════════════════════════════════════════════════════════════════════════
   실시간DB 거래는 «손안의 값»으로 먼저 한 번 부른다 — 서버 함수는 그 자리를 구독하지 않으므로 그 값이 null 이다.
   예전엔 `v === "준비" ? "거는중" : undefined` 였다. null 에서 undefined(접기)를 돌려주니 서버에 묻지도 않고
   «이미 처리 중이거나 완료됨»으로 끝났다 — 2026-10-05 06:00 첫 자동발송이 그렇게 «조용히» 안 나갔다
   (확정본은 준비 그대로, 대표님이 11:12 에 손으로 보내셨다).
   ★ null 이면 «해 본다» — 서버 값이 다르면 파이어베이스가 진짜 값으로 한 번 더 부르고, 그때 «준비»만 통과한다.
   (memory: rtdb-transaction-cold-abort — 이 저장소에서 네 번째) */
function 자동발송찜(v) {
  return (v === '준비' || v === null || v === undefined) ? '거는중' : undefined;
}

module.exports = { todaySeoul, check, 자동발송찜 };
