'use strict';
/* 정부컨설팅 보고서 — 기관이 보낸 «빈 양식(HWPX)» 을 지도대로 채운다 (브라우저 window.PuGovReport / Node 겸용)
   (대표 결정 2026-10-07 「승인 — 1단계부터 시작」 · 설계 docs/superpowers/specs/2026-10-05-정부컨설팅-보고서자동화-design.md
    · 계획 docs/superpowers/plans/2026-10-07-gov-report-step1.md)

   왜 «지도»인가
     · 빈 양식은 해마다 바뀐다. 표지({{이름}})를 박아 둔 견본을 따로 두면 해마다 견본을 다시 만들어야 하고,
       하나라도 빠뜨리면 지난해 글이 남는다. 그래서 «어느 칸 = 무슨 값» 지도만 두고, 받은 빈 양식에
       그때그때 표지를 박아(tokenize) 채운다 — 양식이 바뀌면 지도 한 곳만 고친다.
     · 칸은 엔진(js/pu-hwpx-fill.js)의 주소로 가리킨다: T1.C18.P0 = 둘째 표의 열아홉째 칸 첫 문단.
       주소는 실제 양식을 한글로 HWPX 로 바꿔 scan 으로 잰 것이다(2026-10-07).
   무엇을 지키나
     · 모르는 값은 밑줄(＿＿＿) — 지어내지 않는다. 근로자수는 상시근로자수(workers)만 — 피보험자수를 안 쓴다.
     · 방문 여부를 모르면 체크칸은 원문 그대로 — 아무 쪽도 칠하지 않는다.
     · 여러 줄 글은 한 칸 안에서 한글 줄바꿈 — 칸 밖에 문단을 늘리지 않는다(양식 쪽 수가 안 밀린다).
     · 회차가 모자라거나 넘치면 «말한다»(short · over) — 조용히 비우거나 버리지 않는다.
   ⚠ 저장소는 공개다 — 실제 양식·채운 보고서·업체 자료는 저장소에 넣지 않는다(검사는 합성 XML). */
(function (root) {
  var F = (typeof module !== 'undefined' && module.exports) ? require('./pu-hwpx-fill.js') : root.PuHwpxFill;

  function koDate(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
    return m ? (+m[1]) + '년 ' + (+m[2]) + '월 ' + (+m[3]) + '일' : '';
  }
  /* 방문 체크칸 — 모르면 null(원문 그대로 둔다) */
  function visitBox(v) { return v === true ? '■방문 □사무활동' : v === false ? '□방문 ■사무활동' : null; }
  function str(v) { return v == null ? '' : String(v).trim(); }
  /* 회차 한 칸 — 「문의: …」 줄로 잇고 빈 항목은 뺀다(이름표만 덩그러니 남지 않게) */
  var ROUND_LINES = [['inquiry', '문의'], ['diagnosis', '진단'], ['advice', '자문'], ['result', '성과'], ['next', '향후']];
  function roundText(r) {
    if (!r) return '';
    return ROUND_LINES.map(function (k) { var v = str(r[k[0]]); return v ? k[1] + ': ' + v : ''; })
      .filter(Boolean).join('\n');
  }
  function workersText(w) {
    var s = str(w);
    if (!s) return '';
    return /명\s*$/.test(s) ? s : s + '명';
  }

  /* ── 양식 지도 ──
     set: 그 문단의 글을 통째로 표지로 바꾼다.
       keep — 값이 null 이면 원문 그대로(체크칸)
       gap  — 원문의 «이름표: (빈칸) (서명/날인)» 빈칸 자리에만 값을 넣는다(서명 줄 — 빈칸 길이는 해마다 다르다) */
  var FORMS = {
    'cci-north': {
      name: '충남북부상공회의소 인사노무 컨설팅 결과보고서',
      agency: '충남북부상공회의소',
      rounds: { min: 3, max: 3 },
      files: {
        main: {
          set: [
            { at: 'T1.C1.P0', tok: '업체명' },
            { at: 'T1.C3.P0', tok: '사업자번호' },
            { at: 'T1.C5.P0', tok: '대표자' },
            { at: 'T1.C7.P0', tok: '업종' },
            { at: 'T1.C9.P0', tok: '소재지' },
            { at: 'T1.C11.P0', tok: '근로자수' },
            { at: 'T1.C13.P0', tok: '담당자' },
            { at: 'T1.C15.P0', tok: '담당부서직위' },
            { at: 'T1.C18.P0', tok: '일자1' }, { at: 'T1.C19.P0', tok: '방문체크1', keep: true },
            { at: 'T1.C21.P0', tok: '일자2' }, { at: 'T1.C22.P0', tok: '방문체크2', keep: true },
            { at: 'T1.C24.P0', tok: '일자3' }, { at: 'T1.C25.P0', tok: '방문체크3', keep: true },
            { at: 'T2.C1.P0', tok: '문의진단종합' },
            { at: 'T3.C2.P0', tok: '수행내역1' },
            { at: 'T3.C4.P0', tok: '수행내역2' },
            { at: 'T3.C6.P0', tok: '수행내역3' },
            { at: 'T4.C4.P0', tok: '결과종합_검토' },
            { at: 'T4.C5.P0', tok: '결과종합_조치' },
            { at: 'T4.C6.P0', tok: '산출물목록' },
            { at: 'T5.C1.P0', tok: '기타' },
            { at: 'P10', tok: '작성일' },
            { at: 'P13', tok: '상담역줄', gap: true },
            { at: 'P16', tok: '대표자서명줄', gap: true },
          ],
        },
      },
    },
  };

  /* 보고서 자료 → 표지 값. 빈 값은 ''(엔진이 밑줄로), keep 칸의 «모름»은 null */
  function buildValues(report, formKey) {
    report = report || {};
    var c = report.company || {}, s = report.summary || {}, rs = report.rounds || [], V = {};
    if (formKey === 'cci-north') {
      V['업체명'] = str(c.name); V['사업자번호'] = str(c.bizNo); V['대표자'] = str(c.ceo); V['업종'] = str(c.bizType);
      V['소재지'] = str(c.address);
      V['근로자수'] = workersText(c.workers);            // ⚠ 상시근로자수만 — insuredCount(피보험자수)를 쓰지 않는다
      V['담당자'] = str(c.contact); V['담당부서직위'] = str(c.contactTitle);
      for (var i = 0; i < 3; i++) {
        var r = rs[i];
        V['일자' + (i + 1)] = r ? koDate(r.date) : '';
        V['방문체크' + (i + 1)] = r ? visitBox(r.visit) : null;
        V['수행내역' + (i + 1)] = roundText(r);
      }
      V['문의진단종합'] = str(s.inquiryDiag);
      V['결과종합_검토'] = str(s.review); V['결과종합_조치'] = str(s.action);
      V['산출물목록'] = (s.outputs || []).map(str).filter(Boolean).map(function (o, k) { return '#' + (k + 1) + ' ' + o; }).join('\n');
      V['기타'] = str(s.etc);
      V['작성일'] = koDate(report.writtenAt);
      V['상담역줄'] = str(report.consultant);
      V['대표자서명줄'] = str(c.ceo);
    }
    return V;
  }

  /* 서명 줄 — 원문 「경영상담역:              (서명/날인)」 의 빈칸 자리에 이름을 넣는다 */
  function gapLine(orig, val) {
    var v = val || F.BLANK;
    var m = /([:：])\s{2,}/.exec(orig);
    if (!m) return orig.replace(/\s*$/, '') + ' ' + v;
    return orig.slice(0, m.index) + m[1] + ' ' + v + '      ' + orig.slice(m.index + m[0].length);
  }

  /* 지도대로 칸에 표지를 박는다. 원문(keep·gap 에 쓸)도 함께 돌려준다 */
  function tokenize(xml, formKey, fileKey) {
    return tokenizeWith(xml, formKey, fileKey).xml;
  }
  function tokenizeWith(xml, formKey, fileKey) {
    var f = FORMS[formKey].files[fileKey], rules = [], orig = {};
    var byAddr = {};
    F.scan(xml).forEach(function (p) { byAddr[p.addr] = p.text; });
    (f.set || []).forEach(function (r) {
      orig[r.tok] = byAddr[r.at] != null ? byAddr[r.at] : '';
      rules.push({ at: r.at, set: '{{' + r.tok + '}}' });
    });
    (f.find || []).forEach(function (r) { rules.push({ at: r.at, find: r.find, to: '{{' + r.tok + '}}' }); });
    return { xml: F.replaceText(xml, rules, { lines: 'keep1' }).xml, orig: orig };
  }

  /* 채우기 — 돌려주는 것: {xml, unknown:[모르는 표지], left:[안 채워진 표지], short:{need,have}|null, over:{max,have}|null} */
  function fillForm(xml, formKey, fileKey, report) {
    var form = FORMS[formKey];
    if (!form || !form.files[fileKey]) throw new Error('모르는 양식: ' + formKey + '/' + fileKey);
    var V = buildValues(report, formKey), t = tokenizeWith(xml, formKey, fileKey);
    (form.files[fileKey].set || []).forEach(function (r) {
      if (r.keep && V[r.tok] == null) V[r.tok] = t.orig[r.tok];                 // 모르면 원문 그대로
      else if (r.gap) V[r.tok] = gapLine(t.orig[r.tok] || '', V[r.tok]);
    });
    var e = F.expand(t.xml, V, { breaks: true }), r = F.fill(e.xml, V, { breaks: true });
    var left = Object.keys(F.markers(r.xml));
    var lim = form.rounds || {}, have = ((report && report.rounds) || []).length;
    return {
      xml: r.xml,
      unknown: r.unknown.concat(e.unknown),
      left: left,
      short: (lim.min && have < lim.min) ? { need: lim.min, have: have } : null,
      over: (lim.max && have > lim.max) ? { max: lim.max, have: have } : null,
    };
  }

  var api = { FORMS: FORMS, tokenize: tokenize, buildValues: buildValues, fillForm: fillForm, koDate: koDate, visitBox: visitBox };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReport = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
