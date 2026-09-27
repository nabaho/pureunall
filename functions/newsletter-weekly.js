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

module.exports = { todaySeoul, check };
