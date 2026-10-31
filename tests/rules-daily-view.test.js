/* 취업규칙 「🤖 매일 정리」 그리기 (js/rules-v2/view-daily.js · 설계 §14-4). 회사·사람은 지어낸 것만.
   ★ 못 박는 것은 규칙이다:
     ① 판 — 모드(정하지 않았으면 시범) · 스위치는 관리자에게만 · 기록을 못 읽으면 그렇다고 말한다
     ② 오늘 숫자는 화면이 «지금 자료로» 셈한다 — 시범이면 «했을 것», 켜짐이면 «오늘 자동 확정»
     ③ 표 — 맨 왼쪽 ☐ + 보이는 차례 번호 · 기간(오늘/7일) · 줄마다 처리 담당과 정리 상태
     ④ 손잡이 — 자동 확정 줄에만 되돌리기 · 확인이 필요한 줄은 «이 회사 맞음…» · 사람이 정한 줄은 없음
     ⑤ 담당 거르기(내 것·사람·못 정함) · 걸러져 안 보이는 줄은 고른 것에서 빠진다
     ⑥ 글은 esc · 칸에 title · 지난 기록에 메일 주소 없음 */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../js/rules-v2/lib-order.js');
require('../js/rules-v2/lib-topics.js');
require('../js/rules-v2/lib-tidy.js');
require('../js/rules-v2/lib-daily.js');
require('../js/rules-v2/view-library.js');
const V = require('../js/rules-v2/view-daily.js');

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 31, 3, 0, 0);
const companies = [{ id: 'c1', name: '가나정밀', managerMain: 'P-002' }, { id: 'c2', name: '다라물산', managerMain: 'P-003' }, { id: 'c3', name: '마바건설' }];
function doc(id, o) {
  return { name: o.name || id + '.hwp', kind: o.kind || '규칙본문', status: '담김', dir: '받음',
    mail: { src: 'imap', box: 'INBOX', key: id, date: o.created || NOW - 3600e3, from: o.from || 'x@y.kr', to: '370-6@daum.net', subject: '취업규칙 검토' },
    companyCand: o.cand || [], createdAt: o.created || NOW - 3600e3, owner: o.owner };
}
function state(extra) {
  const st = {
    now: () => NOW, isAdmin: false, staff: { 'P-002': '점검노무', 'P-003': '점검사무장', 'P-001': '점검대표' }, me: 'P-002', companies,
    data: {
      docs: {
        a1: doc('a1', { from: 'hr@gana.co.kr', cand: [{ companyId: 'c1', why: '주소' }], owner: { who: '점검노무', why: 'erp' } }),
        a2: doc('a2', { from: 'boss@dara.kr', cand: [{ companyId: 'c2', why: '주소' }] }),
        a3: doc('a3', { from: 'z@maba.kr', cand: [{ companyId: 'c3', why: '도메인' }], name: '<img src=x onerror=1>규칙.hwp' }),
        a4: doc('a4', { from: 'q@gana.co.kr' }),
        // 같은 주소의 지난 서류도 주소 근거가 있어야 묶음이 «일괄 가능»이다(하나라도 없으면 사람에게 남긴다 — rules-daily ②)
        old: doc('old', { from: 'hr@gana.co.kr', cand: [{ companyId: 'c1', why: '주소' }], created: NOW - 3 * DAY }),
        etc: doc('etc', { kind: '기타', from: 'hr@gana.co.kr' }),
      },
      human: {
        a2: { id: 'a2', companyId: 'c2', companyLinkStatus: 'linked', linkedBy: '자동', linkedAt: NOW - 600e3, auto: { why: '주소 일치', at: NOW - 600e3 } },
        a4: { id: 'a4', companyId: 'c1', companyLinkStatus: 'linked', linkedBy: 'P-003', linkedAt: NOW - 300e3 },
      },
      rounds: {},
      auto: { log: { '2026-10-30': { date: '2026-10-30', mode: 'dry', mails: 2, docs: 3, would: 2, need: 1, noOwner: 0, byOwner: { 점검노무: 2 } } } },
    },
  };
  return Object.assign(st, extra || {});
}
const rowsOf = (h) => [...h.matchAll(/<tr data-drow="([^"]+)"/g)].map((m) => m[1]);
const rowHtml = (h, id) => { const a = h.indexOf('<tr data-drow="' + id + '"'); return h.slice(a, h.indexOf('</tr>', a)); };

test('① 판 — 정하지 않았으면 시범 · 스위치는 관리자에게만 · 기록을 못 읽으면 말한다', () => {
  const h = V.html(state());
  assert.match(h, /시범 운행/);
  assert.ok(!/data-act="dailyMode"/.test(h), '직원에게 스위치가 보인다');
  const a = V.html(state({ isAdmin: true }));
  ['dry', 'live', 'off'].forEach((m) => assert.match(a, new RegExp('data-act="dailyMode" data-m="' + m + '"')));
  const s = state(); s.data.auto = { unreadable: true };
  assert.match(V.html(s), /못 읽었습니다/);
  const live = state(); live.data.auto.cfg = { mode: 'live', at: NOW };
  assert.match(V.html(live), /켜짐/);
});

test('② 오늘 숫자 — 시범이면 «했을 것», 켜짐이면 «오늘 자동 확정»', () => {
  const M = V.model(state());
  assert.equal(M.mode, 'dry');
  assert.ok(M.s.would >= 1, '«주소 일치» a1 을 했을 것으로 세지 않았다');
  assert.match(V.html(state()), /자동 확정했을 것\(시범\)/);
  const live = state(); live.data.auto.cfg = { mode: 'live', at: NOW };
  const ML = V.model(live);
  assert.equal(ML.s.linked, 1);
  assert.match(V.html(live), /오늘 자동 확정/);
});

test('③ 표 — ☐ + 차례 번호 · 오늘만(기타 빼고) · 7일로 넓히면 지난 것도', () => {
  const st = state();
  const h = V.html(st);
  assert.deepEqual(rowsOf(h).sort(), ['a1', 'a2', 'a3', 'a4']);
  const r = rowHtml(h, rowsOf(h)[0]);
  assert.match(r, /^<tr data-drow="[^"]+"[^>]*><td class="c"><input type="checkbox" data-dpick=/, '맨 왼쪽이 ☐ 가 아니다');
  assert.match(r, /<td class="no">1<\/td>/, '차례 번호가 1 부터가 아니다');
  st.daily.span = 'week';
  assert.ok(rowsOf(V.html(st)).includes('old'));
  assert.ok(!rowsOf(V.html(st)).includes('etc'), '갈래 기타가 들어왔다');
});

test('④ 손잡이 — 자동 확정만 되돌리기 · 확인 필요·했을 것은 «이 회사 맞음…» · 사람이 정한 줄은 없음', () => {
  const h = V.html(state());
  assert.match(rowHtml(h, 'a2'), /data-act="dailyUndo" data-id="a2"/);
  assert.match(rowHtml(h, 'a2'), /자동 확정/);
  assert.match(rowHtml(h, 'a1'), /시범: 확정했을 것/);
  assert.match(rowHtml(h, 'a1'), /data-act="linkMail" data-ids="a1"/);
  assert.match(rowHtml(h, 'a3'), /확인 필요/);
  assert.match(rowHtml(h, 'a3'), /data-act="linkMail"/);
  assert.match(rowHtml(h, 'a4'), /사람 확정/);
  assert.ok(!/data-act="(dailyUndo|linkMail)"/.test(rowHtml(h, 'a4')), '사람이 정한 줄에 손잡이가 있다');
  ['a1', 'a3', 'a4'].forEach((id) => assert.ok(!/dailyUndo/.test(rowHtml(h, id)), id + ' 에 되돌리기가 있다'));
});

test('⑤ 처리 담당 — 메일함 담당 → 업체 주담당 → 못 정함 · 거르기 · 안 보이는 줄은 고른 것에서 빠진다', () => {
  const st = state();
  const h = V.html(st);
  assert.match(rowHtml(h, 'a1'), /점검노무.*메일함 담당/);
  assert.match(rowHtml(h, 'a2'), /점검사무장.*업체 주담당/);
  assert.match(rowHtml(h, 'a3'), /못 정함/);
  // 내 것(P-002 점검노무) — a1 은 메일함 담당, a4 는 사람이 확정한 업체(가나정밀)의 주담당
  st.daily.who = '@me';
  assert.deepEqual(rowsOf(V.html(st)).sort(), ['a1', 'a4']);
  st.daily.who = '@none';
  assert.deepEqual(rowsOf(V.html(st)), ['a3']);
  st.daily.picked.add('a1');
  V.html(st);
  assert.ok(!st.daily.picked.has('a1'), '걸러져 안 보이는 줄이 고른 것에 남았다');
});

test('⑥ 글은 esc · 칸에 title · 지난 기록 한 줄(메일 주소 없음)', () => {
  const h = V.html(state());
  assert.ok(!/<img/.test(h), '파일 이름의 태그가 살아났다');
  assert.match(rowHtml(h, 'a1'), /<td class="co" title="[^"]+">/);
  assert.match(h, /10\/30 · 새 메일 2통/);
  assert.ok(!/@/.test(h.slice(h.indexOf('dlogs'), h.indexOf('dspan'))), '지난 기록에 메일 주소가 보인다');
});
