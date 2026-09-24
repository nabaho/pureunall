'use strict';
/* 문서관리(docs-esign) — 한글 원본에 근로자별로 채우기 (대표 지시 2026-09-24 「문서관리 앱에도 넣어줄수있나」)
   기금 회의록([[docs/../fund.html]] _hwpFillDoc, PR #1583)과 경력관리(kcareer-hwpxfill.js, PR #1584)에서
   한글로 직접 열어 보고 배운 것을 그대로 따른다:
     · 틀은 누름틀이 아니라 «글자 표지» {{이름}} — 한글에서 글씨 크기가 깨지지 않는다.
     · 값을 채운 문단은 옛 줄 정보(linesegarray)를 걷어야 한다 — 안 그러면 긴 값이 한 줄에 겹친다.
   fund.html 과 다른 점: 여기는 «기금 하나»가 아니라 «사건 속 근로자 여러 명»이라 값이 사람마다 다르다.
   틀 파일 자체는 사건별 한글 원본(PureunHwpStore, 이 PC 브라우저에만)을 그대로 쓴다 — 새 저장소를 만들지 않는다.
   (브라우저 window.EsignHwpTpl / Node module.exports 겸용, rhwp 문서 객체는 흉내(mock) 낼 수 있어 Node에서도 검사한다) */
(function (root) {
  var Docs = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./esign-docs.js') : root.EsignDocs;

  /* 표지를 여닫는 글자 — ⚠ fund.html 과 같은 이유로 중괄호를 그대로 쓰지 않는다(짝 없는 「{{」가
     이 파일을 검사하는 정규식의 함수 자르기를 깨뜨릴 수 있다). */
  var MK_OPEN = '{{', MK_CLOSE = '}}';
  function mk(name) { return MK_OPEN + name + MK_CLOSE; }
  var BLANK = '＿＿＿'; // ＿＿＿ — 모르는 값, HTML 서식·기금 한글 틀과 같은 밑줄(지어내지 않는다)

  /* 검색으로 찾은 자리 하나의 글 40자 중 «맨 앞»이 표지인지 — fund._hwpMarkers 와 같은 정규식 */
  function markerAt(text) {
    var m = /^\x7b\x7b([^\x7b\x7d]{1,30})\x7d\x7d/.exec(String(text == null ? '' : text));
    return m ? m[1] : null;
  }

  /* 문서(rhwp HwpDocument, 또는 같은 모양의 흉내)에 남은 표지 이름 — 본문·표 칸 모두.
     doc 은 { searchAllText(q,cs,includeCells), getTextRange(sec,para,off,len), getTextInCell(sec,parentPara,ctrlIdx,cellIdx,cellPara,off,len) } 를 가진다. */
  function markersOf(doc) {
    var hits = [], out = {};
    try { hits = JSON.parse(doc.searchAllText(MK_OPEN, false, true)) || []; } catch (e) { hits = []; }
    hits.forEach(function (h) {
      var t = '', c = h.cellContext;
      try {
        t = c ? doc.getTextInCell(h.sec, c.parentPara, c.ctrlIdx, c.cellIdx, c.cellPara, h.charOffset, 40)
              : doc.getTextRange(h.sec, h.para, h.charOffset, 40);
      } catch (e) { t = ''; }
      var name = markerAt(t);
      if (name) out[name] = (out[name] || 0) + 1;
    });
    return out;
  }

  /* 열린 문서에 값을 넣는다 — doc 은 replaceAll(from,to,caseSensitive) 을 가진다(rhwp API).
     ⚠ 채운 «뒤»에도 문단의 옛 줄 정보가 남는다 — 그것을 걷는 일은 doc 을 직접 쥔 쪽(브라우저)에서
       exportHwpx → linesegarray 제거 → reflowLinesegs 로 한다(stripLinesegs 를 여기서 내보낸다). */
  function fillDoc(doc, V) {
    var filled = 0;
    var rep = function (tok, val) { try { return (JSON.parse(doc.replaceAll(tok, val, false)) || {}).count || 0; } catch (e) { return 0; } };
    var show = function (v) { v = (v == null) ? '' : String(v); return v === '' ? BLANK : v; };
    Object.keys(V || {}).forEach(function (k) {
      var v = V[k];
      var n = rep(mk(k), show(v));
      if (v != null && String(v) !== '') filled += n;
    });
    return { filled: filled, unknown: Object.keys(markersOf(doc)) };
  }

  /* ★ 줄 다시 나누기 — 한글로 직접 열어 보고 배운 것(2026-09-24, fund #1583 · kcareer #1584 와 같은 결함).
     doc 을 직접 쥔 브라우저 쪽(JSZip·PureunHwp)에서 exportHwpx 한 뒤 이 함수로 줄 정보를 걷고,
     다시 열어 reflowLinesegs 를 부른다. 여기서는 순수 문자열 손질만 — Node 검사가 가능하다. */
  function stripLinesegs(xml) {
    return String(xml || '').replace(/<hp:linesegarray\b[\s\S]*?<\/hp:linesegarray>/g, '')
      .replace(/<hp:linesegarray\b[^>]*\/>/g, '');
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  /* 표지 이름 → 넣을 값. person 은 sign.html 에서 근로자가 낸 자료(복호화된 것), caseMeta 는 사건 정보,
     arrears 는 이 사람의 체불내역 한 줄({month1,month2,month3,severance}).
     ⚠ 여기 없는 이름이 틀에 있으면 채우지 않고 알린다 — 틀과 코드가 어긋났다는 뜻이다(fund 와 같은 규칙). */
  function valuesOf(person, caseMeta, arrears, today) {
    person = person || {}; caseMeta = caseMeta || {}; arrears = arrears || {};
    var m1 = +arrears.month1 || 0, m2 = +arrears.month2 || 0, m3 = +arrears.month3 || 0, sev = +arrears.severance || 0;
    var won = function (n) { n = Math.round(n || 0); return n ? n.toLocaleString() : ''; };
    var d = today || new Date();
    var writeDate = String(person.consentAt || '').slice(0, 10) || ymd(d);
    return {
      이름: String(person.name || ''),
      주민등록번호: Docs ? Docs.fmtIdNo(person.idNo) : String(person.idNo || ''),
      근로자연락처: String(person.phone || ''),
      주소: String(person.addr || ''),
      입금계좌: String(person.bank || ''),
      입사일: String(person.joinDate || ''),
      퇴사일: String(person.leaveDate || ''),
      회사명: String(caseMeta.company || ''),
      사건명: String(caseMeta.title || ''),
      작성일: writeDate, 오늘: ymd(d),
      동의일시: String(person.consentAt || '').replace('T', ' ').slice(0, 16),
      체불임금1개월차: won(m1), 체불임금2개월차: won(m2), 체불임금3개월차: won(m3),
      체불퇴직금: won(sev), 체불총액: won(m1 + m2 + m3 + sev),
      착수금: '', 성공보수율: ''   // 사건마다 다르고 자료에 없다 — 비워 두고 편집기에서 적는다
    };
  }

  var api = {
    MK_OPEN: MK_OPEN, MK_CLOSE: MK_CLOSE, BLANK: BLANK,
    mk: mk, markerAt: markerAt, markersOf: markersOf, fillDoc: fillDoc,
    stripLinesegs: stripLinesegs, valuesOf: valuesOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EsignHwpTpl = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
