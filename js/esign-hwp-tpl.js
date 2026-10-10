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
      착수금: '', 성공보수율: '',   // 사건마다 다르고 자료에 없다 — 비워 두고 편집기에서 적는다
      /* 대표 근로자(진정인 대표·선정당사자) — 대표 지시 2026-10-09 「근로자 대표 등 선정 서식」.
         caseMeta.repName 은 사건에서 고른 이름, caseMeta._rep 은 그 사람의 제출(연락처·주소) — 화면이 열 때 붙인다 */
      대표근로자: String(caseMeta.repName || ''),
      대표근로자연락처: String((caseMeta._rep && caseMeta._rep.phone) || ''),
      대표근로자주소: String((caseMeta._rep && caseMeta._rep.addr) || ''),
      진정인수: caseMeta._count ? String(caseMeta._count) : '',
      관할관서: String(caseMeta.office || ''),
      공인노무사명단: String(caseMeta._lawyers || (root.PuFormCardFill && root.PuFormCardFill.lawyersNow ? root.PuFormCardFill.lawyersNow() : '')),
      생년월일: birthOf(person.idNo)
    };
  }
  /* 주민번호 앞 7자리 → 생년월일(YYYY.MM.DD). 성별 자리 1·2·5·6 은 1900년대, 3·4·7·8 은 2000년대. 모르면 빈칸 */
  function birthOf(idNo) {
    var d = String(idNo || '').replace(/\D/g, '');
    if (d.length < 7) return '';
    var g = +d[6], cen = (g === 1 || g === 2 || g === 5 || g === 6) ? '19' : (g === 3 || g === 4 || g === 7 || g === 8) ? '20' : '';
    if (!cen) return '';
    return cen + d.slice(0, 2) + '.' + d.slice(2, 4) + '.' + d.slice(4, 6);
  }

  /* ══ 계약서 양식(사건계약)에서 함께 채워 내기 (대표 「추천」 2026-10-09) ══
     사건마다 이 PC 에만 두던 한글 원본 대신, 계약서 양식 › 사건계약에 올린 양식(어느 PC 에서나 같다)을 고른다.
     계약서 양식은 이름표가 조금 다르다({{근로자명}}·{{주민번호}}·{{근로자주소}} …) — 같은 값으로 잇는다. */
  var FORM_ALIASES = { 근로자명: '이름', 근로자이름: '이름', 주민번호: '주민등록번호', 근로자주민: '주민등록번호', 근로자주소: '주소', 오늘날짜: '오늘', 계약일: '작성일' };
  function withAliases(V) {
    var out = {}; V = V || {};
    Object.keys(FORM_ALIASES).forEach(function (k) { out[k] = V[FORM_ALIASES[k]] == null ? '' : V[FORM_ALIASES[k]]; });
    Object.keys(V).forEach(function (k) { out[k] = V[k]; });
    return out;
  }
  /* 사람마다 다른 칸 — 이 가운데 하나라도 있으면 «사람마다», 없으면(대표·사건 칸만) «사건에 한 벌» */
  var PERSON_KEYS = ['이름', '주민등록번호', '근로자연락처', '주소', '입금계좌', '입사일', '퇴사일', '동의일시', '생년월일',
    '체불임금1개월차', '체불임금2개월차', '체불임금3개월차', '체불퇴직금', '체불총액', '근로자명', '근로자이름', '주민번호', '근로자주민', '근로자주소'];
  function fillMode(markers) {
    return (markers || []).some(function (k) { return PERSON_KEYS.indexOf(k) >= 0; }) ? 'person' : 'case';
  }
  /* 사건계약 양식 중 채울 수 있는 것 — 켜 둔 것 · 한글(hwp/hwpx) 원본이 있는 것. sourcesOf = PuContractForms.hwpSources */
  function caseForms(forms, sourcesOf) {
    return (forms || []).filter(function (f) { return f && f.id && f.kind === 'case' && f.enabled !== false; }).map(function (f) {
      var src = (sourcesOf(f) || []).filter(function (x) { return x && !/\.xlsx?$/i.test(x.name || ''); })[0];
      return src ? { id: f.id, name: String(f.name || '양식'), group: String(f.groupName || ''), src: src } : null;
    }).filter(Boolean);
  }
  /* 대표 선정 서식(진정서·연명부·당사자 선정서·대리인선임신고서)이 사건계약에 올라 있나 — 안내 글에 쓴다 */
  var REP_FORM_RE = /선정|연명부|대리인\s*선임/;
  function hasRepForms(list) { return (list || []).some(function (f) { return REP_FORM_RE.test(f.name || ''); }); }

  /* ══ 이름표({{공인노무사명단}})가 없는 위임장 — 노무사 이름 줄을 재직 명단으로 바꾼다 (대표 지시 2026-10-10
       「모든 위임장은 푸른노무법인 담당노무사들 자동으로 … 퇴사하거나 휴직시 이름이 자동으로 빠지게」) ══
     「성 명 : (대표 /) 공인노무사 권 형 하」 줄 → 「성 명 : 〈재직 명단〉」, 그 밑에 이어진 「공인노무사 ○ ○ ○」 줄은 비운다.
     ⚠ 「공인노무사법」 문장이 든 문서(위임장)에서만 · 같은 칸(또는 본문) 안 차례로만 본다. 직접 올린 원본은 고치지 않는다(채울 때만) */
  /* ★ 표 칸 하나에 이름만 든 꼴(「공인노무사명 | 권형하노무사」 — 한국공인노무사회 승인서식 사건위임계약서)도 바꾼다
       (2026-10-10 대표 「위임장에 … 공인노무사 모든 사람의 이름이 자동으로」). 칸 안에서만 — 본문의 「… 대표 권형하노무사」 서명 줄은 그대로.
     ⚠ 「공인노무사」·「대표노무사」 같은 이름표 글자만 든 칸은 사람 이름이 아니라 건너뛴다. */
  var NAME_CELL = /^\s*(?!공인|대표)[가-힣](?:\s*[가-힣]){1,3}\s*(?:공인\s*)?노무사\s*$/;
  var NAMES_LINE = /^(\s*성\s*명\s*[:：]\s*)(?:대표\s*\/?\s*)?공인노무사\s*[가-힣](?:\s*[가-힣]){1,3}\s*$/;
  var NAME_ONLY = /^\s*공인노무사\s*[가-힣](?:\s*[가-힣]){1,3}\s*$/;
  function lawyerLineEdits(paras, line, inCell) {
    var out = [];
    for (var i = 0; i < (paras || []).length; i++) {
      if (inCell && NAME_CELL.test(String(paras[i].text || ''))) { out.push({ key: paras[i].key, text: line }); continue; }
      var m = NAMES_LINE.exec(String(paras[i].text || '')); if (!m) continue;
      out.push({ key: paras[i].key, text: m[1] + line });
      for (var j = i + 1; j < paras.length && NAME_ONLY.test(String(paras[j].text || '')); j++) out.push({ key: paras[j].key, text: '' });
    }
    return out;
  }
  function applyLawyerLine(doc, line) {
    if (!line || !doc) return 0;
    var js = function (q) { try { return JSON.parse(doc.searchAllText(q, false, true)) || []; } catch (e) { return []; } };
    if (!js('공인노무사법').length) return 0;
    var groups = {};
    js('노무사').forEach(function (h) {
      var c = h.cellContext, g = c ? [h.sec, c.parentPara, c.ctrlIdx, c.cellIdx].join('.') : 'b' + h.sec;
      (groups[g] = groups[g] || { sec: h.sec, c: c, idx: [] }).idx.push(c ? c.cellPara : h.para);
    });
    var n = 0;
    Object.keys(groups).forEach(function (g) {
      var G = groups[g], c = G.c, lo = Math.min.apply(null, G.idx), hi = Math.max.apply(null, G.idx);
      var len = function (k) { return c ? doc.getCellParagraphLength(G.sec, c.parentPara, c.ctrlIdx, c.cellIdx, k) : doc.getParagraphLength(G.sec, k); };
      var get = function (k) { try { var L = len(k); return c ? doc.getTextInCell(G.sec, c.parentPara, c.ctrlIdx, c.cellIdx, k, 0, L) : doc.getTextRange(G.sec, k, 0, L); } catch (e) { return null; } };
      var paras = [];
      for (var k = lo; k <= hi + 4; k++) { var t = get(k); if (t == null) break; paras.push({ key: k, text: t }); }
      lawyerLineEdits(paras, line, !!c).forEach(function (e) {
        try {
          var L = len(e.key);
          if (c) { if (L) doc.deleteTextInCell(G.sec, c.parentPara, c.ctrlIdx, c.cellIdx, e.key, 0, L); if (e.text) doc.insertTextInCell(G.sec, c.parentPara, c.ctrlIdx, c.cellIdx, e.key, 0, e.text); }
          else { if (L) doc.deleteText(G.sec, e.key, 0, L); if (e.text) doc.insertText(G.sec, e.key, 0, e.text); }
          n++;
        } catch (x) {}
      });
    });
    return n;
  }

  var api = {
    lawyerLineEdits: lawyerLineEdits, applyLawyerLine: applyLawyerLine,
    withAliases: withAliases, fillMode: fillMode, caseForms: caseForms, hasRepForms: hasRepForms, PERSON_KEYS: PERSON_KEYS,
    MK_OPEN: MK_OPEN, MK_CLOSE: MK_CLOSE, BLANK: BLANK,
    mk: mk, markerAt: markerAt, markersOf: markersOf, fillDoc: fillDoc,
    stripLinesegs: stripLinesegs, valuesOf: valuesOf, birthOf: birthOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EsignHwpTpl = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
