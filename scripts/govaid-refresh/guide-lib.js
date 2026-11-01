/* 연간 안내 자료 읽기 — 순수 함수(읽기·쓰기 없음). 대표 지시 2026-11-01 「매년 고용노동부·정부부처·지자체 지원금 안내 자료도
   자동으로 검토하고 가지고 오게」 → 「추천대로」.
   ① 서버(govaidNoticeWatch)가 기업마당 공고 가운데 묶음 자료(통합공고·지원제도 안내)에 guide 를 표시한다.
   ② 이 PC 매월 1일 예약 작업이 아직 안 읽은 것(guideDone 없음)을 골라 첨부를 읽고, 사전에 없는 사업은 초안(load-yearly)으로,
      다 읽으면 공고에 guideDone 을 남긴다 — 화면 «📰 새 공고 → 📘 연간 안내 자료»에 «읽음 · 새 초안 N»으로 보인다.
   ③ 고용노동부 «고용장려금 지원제도 안내»는 기업마당에 안 올라올 수 있어 해마다 한 번 고용24 에서 찾는다(MOEL_GUIDE_{해}). */
'use strict';
const MAX_PER_RUN = 6;   // 한 번에 읽는 자료 수 — 두꺼운 문서가 몰리는 1월에도 AI 사용량이 한도 안에 있게. 남은 것은 다음 달에
function s(v) { return v == null ? '' : String(v).trim(); }
function moelId(year) { return 'MOEL_GUIDE_' + year; }
/* 지역 자료는 고객사가 몰린 곳만 — 2026-11-01 실측 통합공고 28건 중 경기·대구·전북 등 남의 지역 것이 절반이었다. 전국 자료(지역 없음)는 늘 읽는다 */
const REGIONS = ['충남'];
function ourArea(n) { const a = (n.area && n.area.sido) || []; const l = Array.isArray(a) ? a : Object.keys(a).map((k) => a[k]); return !l.length || l.some((x) => REGIONS.indexOf(String(x)) >= 0); }
/* 읽을 것 — guide 표시가 있고 아직 안 읽은 공고(새것 먼저) + 올해 고용노동부 안내를 아직 못 찾았으면 «찾기» 한 건 */
function pickGuides(notices, year) {
  notices = notices || {};
  const out = Object.keys(notices).map((k) => notices[k]).filter((n) => n && s(n.id) && !n._deleted && s(n.guide) && !n.guideDone && ourArea(n))
    .sort((a, b) => s(b.openDt).localeCompare(s(a.openDt)))
    .map((n) => ({ id: s(n.id), kind: 'read', nm: s(n.nm), url: s(n.url), org: [s(n.ntce), s(n.inst)].filter(Boolean).join(' · '), openDt: s(n.openDt), guide: s(n.guide) }));
  const m = notices[moelId(year)];
  if (!m || !m.guideDone || m.guideDone.error) out.unshift({ id: moelId(year), kind: 'search', nm: year + '년 고용장려금 지원제도 안내(고용노동부)', url: '', org: '고용노동부', openDt: '', guide: '지원 안내' });
  return out.slice(0, MAX_PER_RUN);
}
/* 읽은 결과 → 공고에 붙일 표시. summaries = 조사 담당이 쓴 guide-*.json 의 {id, found, note, error, nm?, url?}
   byGuide = load-yearly 가 센 {id: {created, known}} — 새 초안·이미 사전에 있던 사업 수 */
function doneUpdates(summaries, byGuide, notices, nowMs, year) {
  const up = {}, n0 = notices || {};
  (summaries || []).forEach((x) => {
    const id = s(x && x.id);
    if (!id || /[.#$[\]/]/.test(id)) return;
    const g = (byGuide || {})[id] || {};
    const done = { at: nowMs, found: Number(x.found) || 0, created: Number(g.created) || 0, known: Number(g.known) || 0, note: s(x.note).slice(0, 300), by: 'AI-조사초안' };
    if (s(x.error)) done.error = s(x.error).slice(0, 200);
    if (n0[id]) { up['notices/' + id + '/guideDone'] = done; return; }
    /* 고용24 안내(기업마당에 없는 것) — 찾았을 때만 새 자리를 만든다. 못 찾았으면(아직 안 나옴) 아무것도 안 쓴다 → 다음 달에 다시 찾는다 */
    if (id === moelId(year) && !done.error && /^https:\/\//.test(s(x.url))) {
      up['notices/' + id] = { id, entityType: 'Document', docKind: 'govNotice', no: id, src: '고용24', nm: s(x.nm).slice(0, 300) || year + '년 고용장려금 지원제도 안내',
        url: s(x.url), ntce: '고용노동부', inst: '', field: '인력', startDt: '', closeDt: '', openDt: s(x.openDt), memo: '', guide: '지원 안내',
        schemaVersion: 1, contractVersion: 1, revision: 1, createdAt: nowMs, updatedAt: nowMs, createdBy: 'AI-조사초안', updatedBy: 'AI-조사초안', firstSeen: nowMs, seenAt: nowMs, guideDone: done };
    }
  });
  return up;
}
module.exports = { pickGuides, doneUpdates, moelId, MAX_PER_RUN, REGIONS };
