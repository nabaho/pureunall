/* 푸른 캘린더 — 제목에 적은 시각을 믿는 때 (대표 결정 2026-10-04 「추천대로」 ㉮)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 왜 이 검사가 있나
     직원들은 시각을 «제목 앞에» 적고(「0930 가나상사 방문」) 구글 시각 칸은 아무렇게나 둔다.
     2026년 9월 공용 달력: 시각 일정 41건 중 36건이 새벽 0~5시, 제목 시각과 맞는 것 0건.
     그래서 폰 «그날 목록»에 「00:30 · 0930 …」이 떴다.

   ★ 지키는 규칙
     ㉠ 구글 시각이 새벽(00~05시) «이고» 제목이 네 자리 시각으로 시작할 때만 제목 시각을 쓴다.
     ㉡ 낮 시각은 사람이 일부러 넣은 것이다 — 제목이 뭐라 하든 구글 시각 그대로.
     ㉢ 끝 시각도 같은 길이만큼 옮긴다 — 안 그러면 아침에 벌써 «지난 일정»(옅은 색)이 된다.
     ㉣ 구글에 실제로 든 시각은 숨기지 않는다 — 상세 창에서 밝힌다.
     ㉤ 보관본(구글을 못 받았을 때)도 같은 셈을 쓴다 — 두 길에서 다른 시각이 뜨면 안 된다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const CAL = fs.readFileSync(path.join(ROOT, 'pu-cal.html'), 'utf8');

function 함수몸(head) {
  const i = CAL.indexOf(head);
  assert.ok(i >= 0, '못 찾음: ' + head);
  let d = 0;
  for (let k = CAL.indexOf('{', i); k < CAL.length; k++) {
    if (CAL[k] === '{') d++;
    else if (CAL[k] === '}') { d--; if (d === 0) return CAL.slice(i, k + 1); }
  }
  throw new Error('닫는 괄호 없음: ' + head);
}

/* gcalToEvent 를 상자에서 돌린다 — 색·사람 찾기는 빈 값으로 막는다(시각만 본다) */
function 상자() {
  const ctx = {
    window: {}, users: () => [], colorOf: () => '', gcalMailColor: () => '',
    gcalSidByMail: () => '', nameOf: () => '',
    shiftDay: (d, n) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); },
    GCAL: { evs: [] },
  };
  vm.createContext(ctx);
  vm.runInContext(함수몸('function 제목시각(') + '\n' + 함수몸('function gcalToEvent(ev){') + '\n'
    + 함수몸('function 구글상세(id){') + '\n' + 함수몸('function 언제적(iso){'), ctx);
  return ctx;
}
function 구글(summary, s, e) {
  return { id: 'x1', summary, start: { dateTime: '2026-10-06T' + s + ':00+09:00' },
    end: { dateTime: '2026-10-06T' + e + ':00+09:00' } };
}

test('① 새벽 시각 + 제목 앞 「0930」 → 09:30 으로 보인다', () => {
  const c = 상자();
  assert.strictEqual(c.gcalToEvent(구글('0930 가나상사 방문', '00:30', '01:30')).time, '09:30');
  assert.strictEqual(c.gcalToEvent(구글('14:00 다라기업 일터', '04:30', '05:30')).time, '14:00');
  /* 붙여 쓴 것도 — 실제 제목의 상당수가 이렇다 */
  assert.strictEqual(c.gcalToEvent(구글('1000가나상사 -홍', '01:30', '02:30')).time, '10:00');
  /* 시각 범위 — 「2026-10」(날짜)과 헷갈리면 안 된다. 10월 실제 제목에 8건 */
  assert.strictEqual(c.gcalToEvent(구글('1300-1600 가나상사 교육', '01:00', '02:00')).time, '13:00');
});

test('② 낮 시각은 제목이 뭐라 하든 구글 그대로 — 사람이 일부러 넣은 시각이다', () => {
  const c = 상자();
  assert.strictEqual(c.gcalToEvent(구글('0930 가나상사 방문', '13:00', '14:00')).time, '13:00');
  assert.strictEqual(c.gcalToEvent(구글('0930 가나상사 방문', '06:00', '07:00')).time, '06:00',
    '06시는 새벽 띠(00~05시) 밖입니다');
});

test('③ 제목에 시각이 없거나 시각 꼴이 아니면 구글 그대로', () => {
  const c = 상자();
  assert.strictEqual(c.gcalToEvent(구글('가나상사 방문', '00:30', '01:30')).time, '00:30');
  assert.strictEqual(c.gcalToEvent(구글('12345 회의', '00:30', '01:30')).time, '00:30', '다섯 자리 숫자는 시각이 아닙니다');
  /* 연도·날짜로 시작하는 제목 — 「2026년」을 20:26 으로 읽으면 안 된다 */
  assert.strictEqual(c.gcalToEvent(구글('2026년 계획', '00:30', '01:30')).time, '00:30', '「2026년」은 연도입니다');
  assert.strictEqual(c.gcalToEvent(구글('2026.10 정기점검', '00:30', '01:30')).time, '00:30', '「2026.10」은 날짜입니다');
  assert.strictEqual(c.gcalToEvent(구글('2026-10 정기점검', '00:30', '01:30')).time, '00:30', '「2026-10」은 날짜입니다');
  assert.strictEqual(c.gcalToEvent(구글('2530 회의', '00:30', '01:30')).time, '00:30', '25시는 없습니다');
  assert.strictEqual(c.gcalToEvent(구글('0975 회의', '00:30', '01:30')).time, '00:30', '75분은 없습니다');
});

test('④ 끝 시각도 같은 길이만큼 옮긴다 — 안 그러면 아침에 «지난 일정»이 된다', () => {
  const c = 상자();
  const e = c.gcalToEvent(구글('0930 가나상사 방문', '00:30', '01:30'));
  assert.strictEqual(e.endAt, Date.parse('2026-10-06T10:30:00+09:00'));
});

test('⑤ 구글에 실제로 든 시각을 상세 창에서 밝힌다', () => {
  const c = 상자();
  c.GCAL.evs = [c.gcalToEvent(구글('0930 가나상사 방문', '00:30', '01:30'))];
  const d = c.구글상세('x1');
  const 줄 = d.rows.map((r) => r.t).join(' / ');
  assert.match(줄, /00:30/, '구글에 든 시각(00:30)을 숨겼습니다 — 구글에서 열면 다른 시각이 보입니다');
  /* 고치지 않은 일정에는 그 줄이 없다 — 빈 줄이 자리만 먹는다 */
  c.GCAL.evs = [c.gcalToEvent(구글('가나상사 방문', '13:00', '14:00'))];
  assert.doesNotMatch(c.구글상세('x1').rows.map((r) => r.t).join(' / '), /구글에는/);
});

test('⑥ 종일 일정은 건드리지 않는다', () => {
  const c = 상자();
  const e = c.gcalToEvent({ id: 'x2', summary: '0930 가나상사', start: { date: '2026-10-06' }, end: { date: '2026-10-07' } });
  assert.strictEqual(e.time, '');
});

test('⑦ 보관본도 같은 셈을 쓴다 — 두 길에서 다른 시각이 뜨면 안 된다', () => {
  const fn = 함수몸('function 보관칩(r, 지워짐){');
  assert.match(fn, /제목시각\(r\.summary, r\.time\)/, '보관본이 제목 시각을 안 봅니다');
});
