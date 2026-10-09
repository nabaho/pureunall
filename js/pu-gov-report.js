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

  /* 날짜 'YYYY-MM-DD' → {y,mo,d}. 있을 수 없는 날짜(13월·2월 30일)는 null — 지어내지 않고 밑줄로. 윤년 2월 29일은 받는다 */
  function ymd(s) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(s || ''));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1) return null;
    var leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return d > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1] ? null : { y: y, mo: mo, d: d };
  }
  function koDate(s) { var t = ymd(s); return t ? t.y + '년 ' + t.mo + '월 ' + t.d + '일' : ''; }
  /* 서산 양식 날짜 「2025.04.16」 */
  function dotDate(s) { var t = ymd(s); return t ? t.y + '.' + (t.mo < 10 ? '0' : '') + t.mo + '.' + (t.d < 10 ? '0' : '') + t.d : ''; }
  /* 기술보호 지원일자 「4/16(수)」 — 요일은 UTC 로 센다(PC 시간대에 따라 하루 밀리지 않게) */
  var WD = ['일', '월', '화', '수', '목', '금', '토'];
  function mdDate(s) { var t = ymd(s); return t ? t.mo + '/' + t.d + '(' + WD[new Date(Date.UTC(t.y, t.mo - 1, t.d)).getUTCDay()] + ')' : ''; }
  /* 회차는 날짜 순으로 쓴다(같은 날짜는 들어온 순서, 날짜가 없거나 틀린 것은 맨 뒤) — 회차명·상담일시가 날짜를 따른다 */
  function sortRounds(rs) {
    return (rs || []).map(function (x, i) { return { x: x, i: i, k: ymd(x && x.date) }; })
      .sort(function (a, b) {
        if (!a.k || !b.k) return ((a.k ? 0 : 1) - (b.k ? 0 : 1)) || (a.i - b.i);
        return (a.k.y - b.k.y) || (a.k.mo - b.k.mo) || (a.k.d - b.k.d) || (a.i - b.i);
      }).map(function (o) { return o.x; });
  }
  /* 원본 서식에 박힌 그림(상담역 도장·서명)을 걷는다 — 다른 사람 보고서에 찍히면 안 된다.
     그림은 run 안의 <hp:pic>…</hp:pic> 이라 그것만 빼도 둘레 run·글자는 그대로 바르다.
     (그림이 쓰던 BinData 파일 정리는 HWPX 로 다시 묶는 쪽의 일이다) */
  function stripPictures(xml) { return String(xml).replace(/<hp:pic\b[\s\S]*?<\/hp:pic>/g, ''); }
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
     {at, tok}    그 문단의 글을 통째로 표지로 바꾼다.
       keep  — 값이 null 이면 원문 그대로(체크칸)
       gap   — 원문의 «이름표: (빈칸) (서명/날인)» 빈칸 자리에만 값을 넣는다(서명 줄 — 빈칸 길이는 해마다 다르다).
               빈칸 자리에 지난 사람 이름이 들어 있으면 그것도 지운다(서산 2024 원본)
       check — {이름표: 값이름} 원문의 «□ 이름표» 체크만 값대로 ■/□ (값이 null 이면 그 칸은 원문 그대로)
       like  — 문단 모양·글자 모양을 이 주소(같은 문서) 것으로 — 번호 문단·안내 글자 모양을 값에 안 묻힌다(cell 이면 표지 받는 문단)
       post  — 표지 뒤에 붙일 글(반복 묶음 끝 표시 {{/쪽:회차}})
     {cell:'T2.C4.', tok}  그 칸의 첫 문단에 표지, 나머지 문단은 지운다 — 지난 업체 글이 여러 문단으로 든 칸.
                           칸 문단 수는 해마다 달라서 그때 문서를 scan 해서 정한다
     {at, raw}    표지 묶음 표시를 붙인 글로 통째로({{원문}} = 그 문단의 원래 글).
                  반복 장 안의 표지는 엔진 expand 가 회차 항목 값으로 채운다({{번호}} 는 엔진이 넣는다)
     {drop:'P9'}  문단을 통째로 지운다(원본의 남는 장·안 쓰는 장) */
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
    /* 서산상의 — 2025 빈 양식이 없어 2024 확정본을 한글로 HWPX 변환해 잰 주소(2026-10-09).
       칸마다 지난 업체 글이 여러 문단으로 들어 있고(→ cell), 첫 장과 같은 둘째 장이 하나 더 있다(→ drop) */
    'cci-seosan': {
      name: '서산상공회의소 인사노무 경영컨설팅',
      agency: '서산상공회의소',
      rounds: { min: 1, max: 10 },
      files: {
        /* 업체 방문 확인서 — 회차마다 한 장(P0~P8 을 {{#쪽:회차}} 로 베낀다) */
        visit: {
          set: [
            { at: 'T0.C0.P0', raw: '{{#쪽:회차}}{{원문}}' },
            { at: 'T1.C1.P0', tok: '업체명' },
            { at: 'T1.C3.P0', tok: '방문일' },
            { at: 'T1.C5.P0', tok: '회차명' },
            { cell: 'T2.C2.', tok: '상담분야' },
            { cell: 'T2.C4.', tok: '문의', like: 'T2.C6.P0' },
            { cell: 'T2.C6.', tok: '진단' },
            { cell: 'T2.C8.', tok: '자문', like: 'T2.C6.P0' },
            { at: 'P5', tok: '업체담당자줄', gap: true },
            { at: 'P7', tok: '상담역줄', gap: true },
            { at: 'P8', raw: '{{원문}}{{/쪽:회차}}' },
            { drop: 'P9' }, { drop: 'P10' }, { drop: 'P11' }, { drop: 'P12' },
            { drop: 'P13' }, { drop: 'P14' }, { drop: 'P15' }, { drop: 'P16' },
          ],
        },
        /* 상담 및 자문 결과 보고서 — 한 벌 */
        report: {
          set: [
            { at: 'T1.C1.P0', tok: '상담일시' },
            { at: 'T1.C3.P0', tok: '업체명' },
            { at: 'T1.C5.P0', tok: '사업자번호' },
            { at: 'T1.C7.P0', tok: '업종' },
            { at: 'T1.C9.P0', tok: '소재지' },
            { at: 'T1.C11.P0', tok: '근로자수' },
            { at: 'T1.C13.P0', tok: '근무형태' },
            { at: 'T2.C1.P0', tok: '담당부서' },
            { at: 'T2.C3.P0', tok: '담당직위' },
            { at: 'T2.C5.P0', tok: '담당자' },
            { at: 'T2.C7.P0', tok: '연락처' },
            { at: 'T2.C9.P0', tok: '팩스' },
            { at: 'T2.C11.P0', tok: '이메일' },
            { cell: 'T3.C1.', tok: '요청진단', like: 'T4.C1.P7' },
            { at: 'P5', tok: '작성일' },
            { at: 'P8', tok: '상담역줄', gap: true },
            { cell: 'T4.C1.', tok: '자문결과', like: 'T4.C1.P7' },
          ],
        },
      },
    },
    /* 대·중소기업·농어업협력재단 통합 기술보호지원반 법률 자문 완료보고서(별지 11) — 2025 서식(2026-10-09 잼).
       뒤에 붙은 «1일차 일지 · 교육 수행 일지 · 교육 참석자 명단» 장은 노무 자문에 안 쓰여 지우고,
       «법률 자문 일지 (○일차)» 장을 회차마다 한 장씩 베낀다 */
    techguard: {
      name: '통합 기술보호지원반 법률 자문 완료보고서(별지 11)',
      agency: '대·중소기업·농어업협력재단',
      rounds: { min: 1, max: 7 },
      files: {
        main: {
          set: [
            { at: 'T2.C2.P0', tok: '지원분야', check: { '사전예방': '분야_사전예방', '스타트업': '분야_스타트업' } },
            { at: 'T2.C4.P0', tok: '업체명' },
            { at: 'T2.C13.P0', tok: '지원일1', like: 'T2.C14.P0' }, { at: 'T2.C14.P0', tok: '지원일2' }, { at: 'T2.C15.P0', tok: '지원일3' },
            { at: 'T2.C16.P0', tok: '지원일4' }, { at: 'T2.C17.P0', tok: '지원일5' }, { at: 'T2.C18.P0', tok: '지원일6' },
            { at: 'T2.C19.P0', tok: '지원일7' },
            { cell: 'T3.C1.', tok: '자문내용', like: 'T8.C4.P0' },
            { cell: 'T4.C1.', tok: '총평', like: 'T8.C4.P0' },
            { at: 'P10', tok: '대표자서명줄', gap: true },
            { at: 'P11', tok: '담당자서명줄', gap: true },
            { at: 'P12', tok: '상담역줄', gap: true },
            { drop: 'P15' }, { drop: 'P16' }, { drop: 'P17' },
            { at: 'T8.C0.P0', raw: '{{#쪽:회차}}법률 자문 일지 ({{번호}}일차)' },
            { at: 'T8.C2.P0', tok: '자문일' },
            { cell: 'T8.C6.', tok: '문제점', like: 'T8.C4.P0' },
            { cell: 'T8.C8.', tok: '자문', like: 'T8.C4.P0' },
            { cell: 'T8.C10.', tok: '성과', like: 'T8.C4.P0' },
            { cell: 'T8.C12.', tok: '향후', like: 'T8.C4.P0', post: '{{/쪽:회차}}' },
          ],
        },
      },
    },
  };

  /* 보고서 자료 → 표지 값. 빈 값은 ''(엔진이 밑줄로), keep 칸의 «모름»은 null */
  function buildValues(report, formKey) {
    report = report || {};
    var c = report.company || {}, s = report.summary || {}, rs = sortRounds(report.rounds), V = {};
    var max = ((FORMS[formKey] || {}).rounds || {}).max, use = max ? rs.slice(0, max) : rs;
    if (formKey === 'cci-seosan') {
      V['업체명'] = str(c.name); V['사업자번호'] = str(c.bizNo); V['업종'] = str(c.bizType); V['소재지'] = str(c.address);
      V['근로자수'] = workersText(c.workers);            // ⚠ 상시근로자수만
      V['근무형태'] = str(c.workType);
      V['담당부서'] = str(c.contactDept); V['담당직위'] = str(c.contactTitle); V['담당자'] = str(c.contact);
      V['연락처'] = str(c.tel); V['팩스'] = str(c.fax); V['이메일'] = str(c.email);
      V['상담분야'] = str(report.field);
      V['상담일시'] = rs.length ? dotDate(rs[0].date) : '';
      V['요청진단'] = str(s.inquiryDiag); V['자문결과'] = str(s.adviceAll);
      V['작성일'] = koDate(report.writtenAt);
      V['상담역줄'] = str(report.consultant); V['업체담당자줄'] = str(c.contact);
      V['회차'] = use.map(function (r, i) {
        var o = { 방문일: dotDate(r.date), 회차명: (i + 1) + '회차', 문의: str(r.inquiry), 진단: str(r.diagnosis), 자문: str(r.advice) };
        if (str(r.field)) o['상담분야'] = str(r.field);
        return o;
      });
    } else if (formKey === 'techguard') {
      var tf = report.techField || {};
      V['분야_사전예방'] = tf.prevent == null ? null : !!tf.prevent;
      V['분야_스타트업'] = tf.startup == null ? null : !!tf.startup;
      V['업체명'] = str(c.name);
      /* 지원일자 7칸 — 안 쓴 칸은 «빈칸»이 맞다(밑줄은 «모르는 값» 표시). 엔진이 '' 를 밑줄로 바꾸므로 빈칸 한 칸 */
      for (var k = 0; k < 7; k++) V['지원일' + (k + 1)] = use[k] ? mdDate(use[k].date) : ' ';
      V['자문내용'] = str(s.adviceAll); V['총평'] = str(s.overall);
      V['대표자서명줄'] = str(c.ceo); V['담당자서명줄'] = str(c.contact); V['상담역줄'] = str(report.consultant);
      V['회차'] = use.map(function (r) {
        return { 자문일: koDate(r.date), 문제점: str(r.diagnosis), 자문: str(r.advice), 성과: str(r.result), 향후: str(r.next) };
      });
    } else if (formKey === 'cci-north') {
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
  /* 마지막 쌍점 뒤 ~ 끝 괄호(서명) 앞이 빈칸 자리다. 거기 든 것(빈칸·지난 사람 이름)을 걷고 값을 넣는다 */
  function gapLine(orig, val) {
    var v = val || F.BLANK;
    var m = /([:：])([^:：]*?)(\([^()]*\))?\s*$/.exec(orig);
    if (!m) return orig.replace(/\s*$/, '') + ' ' + v;
    return orig.slice(0, m.index) + m[1] + ' ' + v + (m[3] ? '      ' + m[3] : '');
  }
  /* 체크 줄 — 「(□ 사전예방, □ 스타트업)」 에서 아는 칸만 ■/□ 로. 모르는 칸은 원문 그대로 */
  function checkLine(orig, marks, V) {
    var out = orig;
    Object.keys(marks).forEach(function (label) {
      var v = V[marks[label]];
      if (v == null) return;
      out = out.replace(new RegExp('[□■☐☑▫](\\s*)' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), (v ? '■' : '□') + '$1' + label);
    });
    return out;
  }

  /* 지도대로 칸에 표지를 박는다. 원문(keep·gap 에 쓸)도 함께 돌려준다 */
  function tokenize(xml, formKey, fileKey) {
    return tokenizeWith(xml, formKey, fileKey).xml;
  }
  /* 모양 빌리기(like) — 값 칸의 문단 모양·글자 모양을 같은 문서의 «기준 칸» 것으로 바꾼다.
     서산 칸 첫 문단은 «자동 번호» 모양이라 값 앞에 「1.」 이 붙고 베낀 장마다 「2.」「3.」 으로 이어졌고,
     기술보호 안내 칸의 파란 기울임이 값에 묻었다(2026-10-09 한글로 열어 봄). 속성만 바꾸므로 주소는 그대로다.
     기준 칸이 문서에 없으면 짐작하지 않는다 — 모양은 원본 그대로 두고 missing 으로 알린다. */
  function styleOf(xml, p) {
    var body = xml.slice(p.start, p.end);
    var pp = /^<hp:p\b[^>]*?\bparaPrIDRef="(\d+)"/.exec(body), cp = /<hp:run\b[^>]*?\bcharPrIDRef="(\d+)"/.exec(body);
    return pp && cp ? { pp: pp[1], cp: cp[1] } : null;
  }
  function restyle(xml, targets) {             // targets: [{p, st}] — 뒤에서부터 바꿔야 앞 자리가 안 밀린다
    targets.sort(function (a, b) { return b.p.start - a.p.start; });
    targets.forEach(function (g) {
      var body = xml.slice(g.p.start, g.p.end)
        .replace(/^(<hp:p\b[^>]*?\bparaPrIDRef=")\d+"/, '$1' + g.st.pp + '"')
        .replace(/(\bcharPrIDRef=")\d+"/g, '$1' + g.st.cp + '"');
      xml = xml.slice(0, g.p.start) + body + xml.slice(g.p.end);
    });
    return xml;
  }
  function tokenizeWith(xml, formKey, fileKey) {
    var f = FORMS[formKey].files[fileKey], rules = [], owner = [], orig = {}, styles = [], missing = [];
    xml = stripPictures(xml);
    var ps = F.scan(xml), byAddr = {}, pBy = {};
    ps.forEach(function (p) { byAddr[p.addr] = p.text; pBy[p.addr] = p; });
    var label = function (r) { return r.drop || r.cell || r.at; };
    (f.set || []).forEach(function (r, ri) {
      if (r.drop) { rules.push({ at: r.drop, drop: true }); owner.push(ri); return; }
      var at = r.at;
      if (r.cell) {
        var inCell = ps.filter(function (p) { return p.addr.indexOf(r.cell) === 0 && /^P\d+$/.test(p.addr.slice(r.cell.length)); });
        at = inCell.length ? inCell[0].addr : r.cell + 'P0';
        inCell.slice(1).forEach(function (p) { rules.push({ at: p.addr, drop: true }); owner.push(-1); });
      }
      if (r.like) {
        var ref = pBy[r.like] && styleOf(xml, pBy[r.like]);
        if (!ref) { if (missing.indexOf('like ' + r.like) < 0) missing.push('like ' + r.like); }
        else if (pBy[at]) styles.push({ p: pBy[at], st: ref });
      }
      var o = byAddr[at] != null ? byAddr[at] : '';
      if (r.tok) orig[r.tok] = o;
      var body = r.raw != null ? r.raw.split('{{원문}}').join(o) : '{{' + r.tok + '}}' + (r.post || '');
      rules.push({ at: at, set: body }); owner.push(ri);
    });
    (f.find || []).forEach(function (r) { rules.push({ at: r.at, find: r.find, to: '{{' + r.tok + '}}' }); owner.push(-1); });
    if (styles.length) xml = restyle(xml, styles);
    var res = F.replaceText(xml, rules, { lines: 'keep1' });
    /* 지도 칸이 문서에 없으면(해마다 바뀐 양식) 값이 조용히 빠진다 — 알린다 */
    var hit = {};
    res.hits.forEach(function (n, j) { if (owner[j] >= 0) hit[owner[j]] = (hit[owner[j]] || 0) + n; });
    (f.set || []).forEach(function (r, ri) { if (!hit[ri]) missing.push(label(r)); });
    (f.find || []).forEach(function (r, k) { if (!res.hits[rules.length - (f.find.length - k)]) missing.push(r.at + ' find ' + r.find); });
    return { xml: res.xml, orig: orig, missing: missing };
  }

  /* 채우기 — 돌려주는 것: {xml, unknown:[모르는 표지], left:[안 채워진 표지], short:{need,have}|null, over:{max,have}|null,
     missing:[문서에 없던 지도 칸 · 'like 주소' = 없던 기준 칸]} */
  function fillForm(xml, formKey, fileKey, report) {
    var form = FORMS[formKey];
    if (!form || !form.files[fileKey]) throw new Error('모르는 양식: ' + formKey + '/' + fileKey);
    var V = buildValues(report, formKey), t = tokenizeWith(xml, formKey, fileKey);
    (form.files[fileKey].set || []).forEach(function (r) {
      if (!r.tok) return;
      if (r.check) V[r.tok] = checkLine(t.orig[r.tok] || '', r.check, V);        // 아는 칸만 ■/□
      else if (r.keep && V[r.tok] == null) V[r.tok] = t.orig[r.tok];            // 모르면 원문 그대로
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
      missing: t.missing,
    };
  }

  var api = { FORMS: FORMS, tokenize: tokenize, buildValues: buildValues, fillForm: fillForm, koDate: koDate, visitBox: visitBox,
    dotDate: dotDate, mdDate: mdDate, stripPictures: stripPictures };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReport = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
