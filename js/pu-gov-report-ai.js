'use strict';
/* 정부컨설팅 보고서 3단계 — AI 초안 (브라우저 window.PuGovReportAi / Node 겸용)
   (대표 「추천대로」 2026-10-10 · 설계 docs/superpowers/specs/2026-10-10-gov-report-step3-ai-draft-design.md
    · 계획 docs/superpowers/plans/2026-10-10-gov-report-step3-ai-draft.md)
   무엇을 지키나
     · 밖(Anthropic)으로 나가는 글은 모두 가린다 — 주민·전화·메일·계좌·사업자번호는 [가림](되돌리지 않는다),
       업체·대표자·담당자 이름은 대괄호 자리 표시([해당 기업]·[대표자]·[담당자])로 바꾸고 받은 글에서 되돌린다.
       (맨 낱말 「대표자」로 바꾸면 되돌릴 때 보통 글의 「대표자」까지 사람 이름이 된다 — 그래서 대괄호)
     · 양식이 쓰지 않는 칸은 보내지도 받지도 않는다(USES — pu-gov-report.js buildValues 와 검사가 대조한다).
     · 사람이 쓴 칸은 덮지 않는다 — 비었거나 전에 AI 가 넣고 사람이 손대지 않은 칸만.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  /* Task 2 의 buildRequest 가 양식 이름(FORMS[formKey].name)을 읽는다 */
  var G = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report.js') : root.PuGovReport;

  var GARIM = '[가림]';
  var NO_RECORD = '기록 없음 — 입력 필요';
  var ROUND_KEYS = ['inquiry', 'diagnosis', 'advice', 'result', 'next'];
  var SUMMARY_KEYS = ['inquiryDiag', 'review', 'action', 'etc', 'adviceAll', 'overall'];
  /* 양식 파일마다 쓰는 칸 — buildValues 가 실제로 찍는 칸 */
  var USES = {
    'cci-north': { main: { rounds: ROUND_KEYS, summary: ['inquiryDiag', 'review', 'action', 'etc'] } },
    'cci-seosan': {
      visit: { rounds: ['inquiry', 'diagnosis', 'advice'], summary: [] },
      report: { rounds: [], summary: ['inquiryDiag', 'adviceAll'] },
    },
    techguard: { main: { rounds: ['diagnosis', 'advice', 'result', 'next'], summary: ['adviceAll', 'overall'] } },
  };
  /* 칸별 글자 수 한도 — 기관 공식 한도가 아니라 양식 칸 크기에 맞춘 출발값(노무사 확인 필요) */
  var LIMITS = { inquiry: 300, diagnosis: 300, advice: 300, result: 300, next: 300,
    inquiryDiag: 600, review: 600, action: 600, etc: 300, adviceAll: 1000, overall: 600 };

  function str(v) { return v == null ? '' : String(v).trim(); }

  function fieldsFor(formKey, fileKeys) {
    var u = USES[formKey];
    if (!u) return { rounds: [], summary: [] };
    var ks = (fileKeys && fileKeys.length) ? fileKeys : Object.keys(u), r = {}, s = {};
    ks.forEach(function (k) {
      var f = u[k]; if (!f) return;
      f.rounds.forEach(function (x) { r[x] = 1; });
      f.summary.forEach(function (x) { s[x] = 1; });
    });
    return { rounds: ROUND_KEYS.filter(function (x) { return r[x]; }), summary: SUMMARY_KEYS.filter(function (x) { return s[x]; }) };
  }

  /* 가리기 — 차례가 중요하다: 메일(숫자를 품을 수 있다) → 주민 → 사업자 → 전화 → 대표번호 → 긴 숫자열(계좌) */
  var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  var RRN_RE = /(?<!\d)\d{6}\s?-\s?[1-8]\d{6}(?!\d)/g;
  var BIZ_RE = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g;
  var TEL_RE = /(?<!\d)(?:\+82[-.\s]?)?\(?0\d{1,2}\)?[-.\s]?\d{3,4}[-.\s]\d{4}(?!\d)/g;
  var REP_RE = /(?<!\d)1[5-9]\d{2}-\d{4}(?!\d)/g;
  var LONG_RE = /\d[\d-]{8,}\d/g;          // 숫자가 10개 이상일 때만 가린다(날짜 2025-09-04 는 8개라 남는다)

  /* 이름 목록 — 2자 미만은 버린다. 「(주)가나상사」면 「가나상사」도 같은 자리 표시로 */
  function nameList(names) {
    var out = [];
    (names || []).forEach(function (n) {
      var v = str(n && n.v), as = str(n && n.as);
      if (v.length < 2 || !as) return;
      out.push({ v: v, as: as, orig: v });
      var core = v.replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\(합\)|합자회사/g, '').trim();
      if (core !== v && core.length >= 2) out.push({ v: core, as: as, orig: v });
    });
    return out;
  }
  function mask(text, names) {
    var t = String(text == null ? '' : text)
      .replace(EMAIL_RE, GARIM).replace(RRN_RE, GARIM).replace(BIZ_RE, GARIM)
      .replace(TEL_RE, GARIM).replace(REP_RE, GARIM)
      .replace(LONG_RE, function (m) { return m.replace(/\D/g, '').length >= 10 ? GARIM : m; });
    var list = nameList(names), back = [], seenAs = {};
    list.forEach(function (n) { if (!seenAs[n.as]) { seenAs[n.as] = 1; back.push({ as: n.as, v: n.orig }); } });
    /* 긴 이름부터 — 「(주)가나상사」를 「가나상사」보다 먼저 */
    list.slice().sort(function (a, b) { return b.v.length - a.v.length; })
      .forEach(function (n) { t = t.split(n.v).join(n.as); });
    return { text: t, back: back };
  }
  function unmask(text, back) {
    var t = String(text == null ? '' : text);
    (back || []).forEach(function (b) { if (b && b.as) t = t.split(b.as).join(String(b.v == null ? '' : b.v)); });
    return t;
  }

  var BODY_MAX = 1500;
  var LABEL = { inquiry: '문의', diagnosis: '진단', advice: '자문', result: '성과', next: '향후',
    inquiryDiag: '문의·진단 종합', review: '검토사항(기존)', action: '조치결과', etc: '기타사항',
    adviceAll: '자문 결과', overall: '총평' };
  var LABEL_FORM = {
    'cci-seosan': { inquiryDiag: '요청 진단', adviceAll: '자문 결과' },
    techguard: { diagnosis: '문제점', adviceAll: '자문 내용' },
  };
  function labelsFor(formKey) {
    var o = {}, x = LABEL_FORM[formKey] || {};
    Object.keys(LABEL).forEach(function (k) { o[k] = x[k] || LABEL[k]; });
    return o;
  }
  /* 기관 작성기준 — FORMS 에는 기준 문구가 없다. 기관 원문 대조 전의 출발 문구(노무사 확인 필요) */
  var COMMON_GUIDE = '회차마다 상담 요청(문의)·현황 진단·자문 내용·성과·향후 계획을 사실 위주로 1~3문장씩 쓴다. '
    + '보고서 문체(~함, ~임)로 쓰고, 법 조문은 입력에 나온 것만 쓴다.';
  var GUIDE = {
    'cci-north': '충남북부상공회의소 인사노무 컨설팅 결과보고서. 회차별 수행내역은 문의·진단·자문·성과·향후가 한 칸에 이어 들어간다. '
      + '문의·진단 종합은 기업의 요청과 진단 결과를 묶고, 결과종합은 검토사항(기존 제도)과 조치결과를 나눠 쓴다. 기타사항이 없으면 「없음」.',
    'cci-seosan': '서산상공회의소 인사노무 경영컨설팅. 업체 방문 확인서는 회차마다 문의·진단·자문을 쓰고, '
      + '상담 및 자문 결과 보고서는 요청 진단과 자문 결과를 전체 회차를 묶어 쓴다.',
    techguard: '통합 기술보호지원반 법률 자문 완료보고서(별지 11). 회차별 법률 자문 일지에 문제점·자문·성과·향후를 쓰고, '
      + '종합에 자문 내용과 총평을 쓴다. 기술 자료의 내용은 쓰지 않는다.',
  };
  function systemText(formKey, fields, lim) {
    var lab = labelsFor(formKey);
    var one = function (k) { return k + '=' + lab[k] + ' ' + lim[k] + '자'; };
    var r0 = fields.rounds[0] || 'inquiry', s0 = fields.summary[0] || 'overall';
    return [
      '당신은 공인노무사가 쓰는 정부 지원 인사노무 컨설팅 보고서의 초안을 쓴다. 노무사가 읽고 고친 뒤 확정한다.',
      '작성기준: ' + (GUIDE[formKey] ? GUIDE[formKey] + ' ' : '') + COMMON_GUIDE,
      '규칙',
      '- 입력에 없는 사실·날짜·숫자·법 조문 번호를 만들지 않는다. 모르면 쓰지 않는다.',
      '- 메모도 자료도 없는 회차의 칸에는 정확히 「' + NO_RECORD + '」 만 쓴다.',
      '- [해당 기업] [대표자] [담당자] 같은 대괄호 표시는 그대로 옮겨 쓴다. ' + GARIM + ' 의 원래 값을 짐작하지 않는다.',
      '- 입력의 「채울_칸」에 있는 칸만 쓴다. 「이미_쓴_칸」·「이미_쓴_종합」은 맥락으로만 읽는다.',
      '- 칸 이름과 글자 수 한도 — 회차: ' + (fields.rounds.map(one).join(', ') || '없음')
        + ' / 종합: ' + (fields.summary.map(one).join(', ') || '없음'),
      '- JSON 만 답한다. 앞뒤에 다른 글을 붙이지 않는다. 꼴: {"rounds":[{"i":0,"' + r0 + '":"…"}],"summary":{"' + s0 + '":"…"}}'
        + ' — i 는 입력 회차의 i 그대로.',
    ].join('\n');
  }
  function baseNames(report) {
    var c = (report && report.company) || {};
    return [{ v: c.name, as: '[해당 기업]' }, { v: c.ceo, as: '[대표자]' }, { v: c.contact, as: '[담당자]' }];
  }

  /* 보낼 글 — 입력을 JSON 으로 묶은 뒤 «통째로» 가린다(빠지는 글이 없게) */
  function buildRequest(report, feed, formKey, opts) {
    opts = opts || {};
    var form = (G && G.FORMS && G.FORMS[formKey]) || {};
    var fields = fieldsFor(formKey, opts.fileKeys);
    var lim = {};
    Object.keys(LIMITS).forEach(function (k) { lim[k] = LIMITS[k]; });
    Object.keys(opts.limits || {}).forEach(function (k) { if (+opts.limits[k] > 0) lim[k] = +opts.limits[k]; });
    var src = opts.src || {}, tg = !!opts.techguard, memos = opts.memos || [], want = [];
    var rs = (report && Array.isArray(report.rounds)) ? report.rounds : [], sm = (report && report.summary) || {};
    var rounds = rs.map(function (r, i) {
      r = r || {};
      var o = { i: i, 날짜: str(r.date) };
      if (!tg) o.방식 = r.visit === true ? '방문' : r.visit === false ? '사무' : '모름';
      o.메모 = str(memos[i]);
      var had = {};
      fields.rounds.forEach(function (k) {
        var v = str(r[k]), p = 'rounds.' + i + '.' + k;
        if (!v || src[p] === 'ai') want.push(p);
        else if (!tg) had[k] = v;
      });
      if (!tg && Object.keys(had).length) o.이미_쓴_칸 = had;
      return o;
    });
    var hadS = {};
    fields.summary.forEach(function (k) {
      var v = str(sm[k]), p = 'summary.' + k;
      if (!v || src[p] === 'ai') want.push(p);
      else if (!tg) hadS[k] = v;
    });
    var data = [];
    if (!tg) (feed || []).forEach(function (x) {
      if (!x || x.priv || x.kind === '일정') return;          // 일정은 회차 메모로 이미 간다
      var o = { 날짜: str(x.d), 종류: str(x.kind) };
      if (x.kind === '보낸 서류') o.서류 = str(x.text);
      else {
        o.제목 = str(x.text);
        if (str(x.body)) o.본문 = str(x.body).slice(0, BODY_MAX);
      }
      data.push(o);
    });
    var input = { 양식: str(form.name), 회차: rounds, 자료: data };
    if (!tg && Object.keys(hadS).length) input.이미_쓴_종합 = hadS;
    input.채울_칸 = want;
    var m = mask(JSON.stringify(input, null, 1), baseNames(report).concat(opts.names || []));
    return { system: systemText(formKey, fields, lim), messages: [{ role: 'user', content: m.text }],
      sent: m.text, back: m.back, fields: fields, want: want, limits: lim };
  }

  /* 받은 글 — 첫 { ~ 마지막 } 를 JSON 으로. 아는 칸의 글자만 옮긴다(모르는 열쇠·__proto__ 는 버린다) */
  function parseDraft(text, back) {
    var bad = function (why) { var e = new Error('AI 답을 읽지 못했습니다 — ' + why); e.parse = true; return e; };
    var s = String(text == null ? '' : text), a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw bad('JSON 이 없습니다');
    var o;
    try { o = JSON.parse(s.slice(a, b + 1)); } catch (e) { throw bad('JSON 이 깨졌습니다'); }
    if (!o || typeof o !== 'object' || Array.isArray(o)) throw bad('꼴이 다릅니다');
    var un = function (v) {
      if (typeof v !== 'string') return '';
      v = v.replace(/\r\n?/g, '\n').trim();
      return back ? unmask(v, back) : v;
    };
    var rounds = [];
    (Array.isArray(o.rounds) ? o.rounds : []).forEach(function (r) {
      if (!r || typeof r !== 'object') return;
      var i = Number(r.i);
      if (!Number.isInteger(i) || i < 0 || typeof r.i === 'string' && !/^\d+$/.test(r.i)) return;
      var x = { i: i };
      ROUND_KEYS.forEach(function (k) { var v = un(r[k]); if (v) x[k] = v; });
      rounds.push(x);
    });
    var so = (o.summary && typeof o.summary === 'object' && !Array.isArray(o.summary)) ? o.summary : {}, summary = {};
    SUMMARY_KEYS.forEach(function (k) { var v = un(so[k]); if (v) summary[k] = v; });
    rounds = rounds.filter(function (x) { return Object.keys(x).length > 1; });
    if (!rounds.length && !Object.keys(summary).length) throw bad('채운 칸이 없습니다');
    return { rounds: rounds, summary: summary };
  }

  var api = { fieldsFor: fieldsFor, mask: mask, unmask: unmask, buildRequest: buildRequest, parseDraft: parseDraft,
    ROUND_KEYS: ROUND_KEYS, SUMMARY_KEYS: SUMMARY_KEYS, USES: USES, LIMITS: LIMITS, GARIM: GARIM, NO_RECORD: NO_RECORD,
    BODY_MAX: BODY_MAX, GUIDE: GUIDE, COMMON_GUIDE: COMMON_GUIDE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportAi = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
