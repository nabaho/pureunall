'use strict';
/* 컨설팅보고서 앱 — 회차 기준 점검 (브라우저 window.PuGovReportCriteria / Node 겸용 · 대표 지시 2026-10-12
   · 설계 docs/superpowers/specs/2026-10-12-gov-report-rounds-design.md · 계획 docs/superpowers/plans/2026-10-12-gov-report-rounds.md)
   무엇을 지키나
     · 순수 함수만 — 읽기·쓰기·화면은 몫이 아니다. 점검은 «알림»일 뿐 제출을 막지 않는다.
     · 수치는 정리본(컨설팅보고서_사업별_양식·항목_정리) 기준 초안 [노무사 확인]: 일터혁신 — 회의 120분 이상·참석 3명 이상·
       시작·종료 사진·서명지·대면 70% 이상 / 산업일자리 — 비대면 보고서 4MD·자료조사 2MD 까지.
     · 사진·서명 «파일»은 모른다 — 확보 여부(photo·sign)만 본다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var WP_MIN_MINS = 120, WP_MIN_PEOPLE = 3, WP_FACE_PCT = 70, IND_REMOTE_REPORT_MD = 4, IND_REMOTE_RESEARCH_MD = 2;
  var KEYS = ['workplace', 'industry'];

  function isKey(k) { return typeof k === 'string' && KEYS.indexOf(k) >= 0; }
  function obj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function num(v) { return typeof v === 'number' && isFinite(v) ? v : null; }

  function roundCheck(planKey, rd) {
    if (!isKey(planKey) || !obj(rd) || (rd.mode !== 'face' && rd.mode !== 'remote')) return { state: 'none', miss: [] };
    var miss = [];
    if (planKey === 'workplace') {
      var m = num(rd.mins), p = num(rd.people);
      if (m === null) miss.push('회의 시간 없음'); else if (m < WP_MIN_MINS) miss.push('회의 2시간 미만(' + m + '분)');
      if (p === null) miss.push('참석 인원 없음'); else if (p < WP_MIN_PEOPLE) miss.push('참석 3명 미만(' + p + '명)');
      if (rd.photo !== true) miss.push('시작·종료 사진 없음');
      if (rd.sign !== true) miss.push('서명지 없음');
    } else {
      if (num(rd.md) === null) miss.push('MD 없음');
      if (typeof rd.kind !== 'string') miss.push('종류 없음');
    }
    return { state: miss.length ? 'miss' : 'ok', miss: miss };
  }

  function summary(planKey, list, planned) {
    if (!isKey(planKey)) return null;
    var rds = (Array.isArray(list) ? list : []).filter(function (r) { return obj(r) && (r.mode === 'face' || r.mode === 'remote'); });
    var pl = Math.max(+planned || 0, 0);
    if (planKey === 'workplace') {
      var face = rds.filter(function (r) { return r.mode === 'face'; }).length, remote = rds.length - face;
      var q = rds.filter(function (r) { return roundCheck('workplace', r).state === 'ok'; }).length;
      var pct = rds.length ? Math.floor(face * 100 / rds.length) : null;
      return { key: 'workplace', recorded: rds.length, qualified: q, face: face, remote: remote, facePct: pct, faceOk: pct === null ? null : pct >= WP_FACE_PCT, planned: pl };
    }
    var md = 0, rep = 0, res = 0;
    rds.forEach(function (r) {
      var v = num(r.md) || 0;
      md += v;
      if (r.mode === 'remote' && r.kind === 'report') rep += v;
      if (r.mode === 'remote' && r.kind === 'research') res += v;
    });
    return { key: 'industry', recorded: rds.length, md: md, remoteReportMd: rep, remoteResearchMd: res,
      reportOk: rep <= IND_REMOTE_REPORT_MD, researchOk: res <= IND_REMOTE_RESEARCH_MD, planned: pl };
  }

  var api = { WP_MIN_MINS: WP_MIN_MINS, WP_MIN_PEOPLE: WP_MIN_PEOPLE, WP_FACE_PCT: WP_FACE_PCT, IND_REMOTE_REPORT_MD: IND_REMOTE_REPORT_MD,
    IND_REMOTE_RESEARCH_MD: IND_REMOTE_RESEARCH_MD, KEYS: KEYS, roundCheck: roundCheck, summary: summary };
  if (isNode) module.exports = api;
  else root.PuGovReportCriteria = api;
})(typeof window !== 'undefined' ? window : globalThis);
