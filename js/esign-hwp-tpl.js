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
  /* ── 한 줄에 한 명씩 세로로 (대표 지시 2026-10-10 「세로로 열을 맞추어 노무사 이름을 아래로 한 줄에 1명씩 공인노무사로 … 모든 위임장은 똑같이」) ──
     「성 명 : 공인노무사 권형하」 줄 밑에 「공인노무사 박한별」… 을 «새 문단»으로 이어 붙이고, 앞을 띄어쓰기로 맞춰 이름 첫 글자가 한 줄로 서게 한다.
     ⚠ 줄 수는 사람 수를 따라 늘고 준다(휴직·퇴사하면 한 줄이 빠진다). 표 칸(위임장 상자)은 칸이 자라서 따라 늘어난다. */
  var SPLIT_META = { style_id: 0, column_type: 'None', raw_break_type: 0, raw_header_extra: [], tab_extended: [] };
  /* 앞(「성 명 : 」)과 같은 너비의 빈칸 수 — 한글 글자 1, 띄어쓰기·영문·숫자 0.5, 글자 사이 -5%(위임장 틀 모두 같다). 한 칸 0.45 */
  function spacesFor(prefix) {
    var w = 0, s = String(prefix || '');
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); w += (c >= 0x1100 ? 1 : (/[:;.,]/.test(s.charAt(i)) ? 0.3 : 0.5)) - 0.05; }
    return Math.max(0, Math.floor(w / 0.45));   // 모자라게(왼쪽으로 반 칸 안쪽) — 넘치면 이름이 오른쪽으로 삐져 보인다
  }
  function acc(doc, sec, c) {
    return {
      len: function (k) { return c ? doc.getCellParagraphLength(sec, c.parentPara, c.ctrlIdx, c.cellIdx, k) : doc.getParagraphLength(sec, k); },
      get: function (k) { try { var L = this.len(k); return c ? doc.getTextInCell(sec, c.parentPara, c.ctrlIdx, c.cellIdx, k, 0, L) : doc.getTextRange(sec, k, 0, L); } catch (e) { return null; } },
      set: function (k, t) {
        var L = this.len(k);
        if (c) { if (L) doc.deleteTextInCell(sec, c.parentPara, c.ctrlIdx, c.cellIdx, k, 0, L); if (t) doc.insertTextInCell(sec, c.parentPara, c.ctrlIdx, c.cellIdx, k, 0, t); }
        else { if (L) doc.deleteText(sec, k, 0, L); if (t) doc.insertText(sec, k, 0, t); }
      },
      merge: function (k) { if (c) doc.mergeParagraphInCell(sec, c.parentPara, c.ctrlIdx, c.cellIdx, k); else doc.mergeParagraph(sec, k); },
      shape: function (k) { try { return JSON.parse(c ? doc.getCellParaPropertiesAt(sec, c.parentPara, c.ctrlIdx, c.cellIdx, k, 0) : doc.getParaPropertiesAt(sec, k, 0)).paraShapeId; } catch (e) { return 0; } },
      setShape: function (k, id) { try { if (c) doc.setCellParaShapeId(sec, c.parentPara, c.ctrlIdx, c.cellIdx, k, id); else doc.setParaShapeId(sec, k, id); } catch (e) {} },
      split: function (k, shapeId) {
        var meta = JSON.stringify(Object.assign({ para_shape_id: shapeId || 0 }, SPLIT_META));
        if (c) doc.splitParagraphInCell(sec, c.parentPara, c.ctrlIdx, c.cellIdx, k, this.len(k), meta);
        else doc.splitParagraph(sec, k, this.len(k), meta);
      }
    };
  }
  /* 문단 k 에 lines[0], 이어서 lines[1..] — reuse 는 이미 있는 이어진 빈 문단 번호들(있으면 새로 쪼개지 않고 거기에 쓴다).
     돌려주는 값: 새로 생긴 문단 수 */
  function writeLines(A, k, prefix, lines, reuse) {
    var pad = new Array(spacesFor(prefix) + 1).join(' '), sh = A.shape(k), added = 0, cur = k, used = 0;
    A.set(k, prefix + lines[0]);
    for (var i = 1; i < lines.length; i++) {
      var next;
      if (reuse && used < reuse.length) { next = reuse[used++]; }
      else { A.split(cur, sh); next = cur + 1; added++; if (reuse) for (var r = used; r < reuse.length; r++) reuse[r]++; }
      A.set(next, pad + lines[i]); A.setShape(next, sh); cur = next;
    }
    for (var u = used; reuse && u < reuse.length; u++) A.set(reuse[u], '');
    return added;
  }
  /* 줄이 늘어난 만큼 위임장 상자 아래쪽의 빈 줄을 덜어낸다 — 안 그러면 상자가 쪽 끝을 넘어 다음 쪽으로 밀린다.
     명단 바로 밑 빈 줄 하나는 남기고, 그 밑 빈 줄을 뒤에서부터 최대 3개(같은 칸 안에서만) */
  function trimBlanks(A, lastKey, want) {
    var left = Math.min(Math.max(0, want), 3), idx = [];
    for (var k = lastKey + 2; ; k++) { var t = A.get(k); if (t == null) break; if (!String(t).trim() && !/아\s*래/.test(String(A.get(k - 1) || ''))) idx.push(k); }   // 「아 래」 밑 빈 줄은 남긴다(내용과 붙어 보인다)
    var gone = 0;
    for (var i = idx.length - 1; i >= 0 && left > 0; i--, left--) { try { A.merge(idx[i]); gone++; } catch (e) { break; } }
    return gone;
  }
  /* 그래도 모자라면(줄이 빈 줄보다 많이 늘었으면) 칸 높이를 한 줄(약 2800)씩 키운다 — 위임장 상자는 칸이 쪽 한 장 높이라 글이 상자 밖으로 삐져나온다.
     쪽 끝을 넘지 않게 72500 까지만 */
  function growCell(doc, sec, c, lines) {
    if (!c || lines < 1) return;
    try {
      var cp = JSON.parse(doc.getCellProperties(sec, c.parentPara, c.ctrlIdx, c.cellIdx)), h = Number(cp.height) || 0;
      if (h < 40000) return;   // 작은 칸(신고서 등)은 건드리지 않는다
      var nh = Math.min(h + lines * 2800, Math.max(h, 72500));
      if (nh > h) doc.setCellProperties(sec, c.parentPara, c.ctrlIdx, c.cellIdx, JSON.stringify({ height: nh }));
    } catch (e) {}
  }
  var MARKER_LAWYERS = '{{공인노무사명단}}';
  /* 채우기 창에서 고칠 수 있는 한 줄 값 → 줄들. 그대로면 기본 줄들, 고쳤으면 쉼표·줄바꿈·가운뎃점으로 나눠 「공인노무사 ○○○」 꼴로 */
  function lawyerLinesOf(value, defLine, defLines) {
    var v = String(value == null ? '' : value).trim();
    if (!v) return [];
    if (defLines && defLines.length && v === String(defLine || '').trim()) return defLines.slice();
    var out = [];
    v.split(/\s*[,\n]\s*/).forEach(function (part) {
      part = part.replace(/^\s*대표\s+/, '').trim(); if (!part) return;
      var m = /^공인노무사\s*(.+)$/.exec(part), names = (m ? m[1] : part).split(/\s*[·ㆍ]\s*/);
      names.forEach(function (n) { n = n.trim(); if (n) out.push('공인노무사 ' + n); });
    });
    return out;
  }
  /* {{공인노무사명단}} 이 「성 명 : 」 뒤에 홀로 선 줄이면 세로 명단으로 — 아니면(신고서 칸 등) 그대로 두어 fillDoc 이 한 줄로 채운다 */
  function expandLawyerMarker(doc, lines) {
    if (!doc || !lines || lines.length < 1) return 0;
    var n = 0, guard = 0;
    for (;;) {
      if (guard++ > 40) break;
      var hits; try { hits = JSON.parse(doc.searchAllText(MARKER_LAWYERS, false, true)) || []; } catch (e) { hits = []; }
      var done = false;
      for (var h = 0; h < hits.length && !done; h++) {
        var ht = hits[h], c = ht.cellContext || null, A = acc(doc, ht.sec, c), k = c ? c.cellPara : ht.para;
        var t = A.get(k); if (t == null) continue;
        var at = t.indexOf(MARKER_LAWYERS); if (at < 0) continue;
        var prefix = t.slice(0, at), suffix = t.slice(at + MARKER_LAWYERS.length);
        if (!/[:：]\s*$/.test(prefix) || suffix.trim()) continue;
        try { var added = writeLines(A, k, prefix, lines), gone = trimBlanks(A, k + added, added - 1); growCell(doc, ht.sec, c, added - gone); n++; done = true; } catch (e) { continue; }
      }
      if (!done) break;
    }
    return n;
  }
  function applyLawyerLine(doc, line, lines) {
    if ((!line && !(lines && lines.length)) || !doc) return 0;
    var js = function (q) { try { return JSON.parse(doc.searchAllText(q, false, true)) || []; } catch (e) { return []; } };
    if (!js('공인노무사법').length) return 0;
    var vertical = (lines && lines.length > 1) ? lines : null;
    var groups = {};
    js('노무사').forEach(function (h) {
      var c = h.cellContext, g = c ? [h.sec, c.parentPara, c.ctrlIdx, c.cellIdx].join('.') : 'b' + h.sec;
      (groups[g] = groups[g] || { sec: h.sec, c: c, idx: [] }).idx.push(c ? c.cellPara : h.para);
    });
    var n = 0;
    Object.keys(groups).forEach(function (g) {
      var G = groups[g], c = G.c, lo = Math.min.apply(null, G.idx), hi = Math.max.apply(null, G.idx);
      var A = acc(doc, G.sec, c), paras = [];
      for (var k = lo; k <= hi + 4; k++) { var t = A.get(k); if (t == null) break; paras.push({ key: k, text: t }); }
      if (!vertical) {
        lawyerLineEdits(paras, line, !!c).forEach(function (e) { try { A.set(e.key, e.text); n++; } catch (x) {} });
        return;
      }
      /* 세로 — 아래 문단부터(쪼개면 뒤 번호가 밀리므로) */
      for (var i = paras.length - 1; i >= 0; i--) {
        var tx = String(paras[i].text || '');
        try {
          if (c && NAME_CELL.test(tx)) { writeLines(A, paras[i].key, '', vertical); n++; continue; }
          var m = NAMES_LINE.exec(tx); if (!m) continue;
          var reuse = [];
          for (var j = i + 1; j < paras.length && NAME_ONLY.test(String(paras[j].text || '')); j++) reuse.push(paras[j].key);
          writeLines(A, paras[i].key, m[1], vertical, reuse); n++;
        } catch (x) {}
      }
    });
    return n;
  }

  var api = {
    lawyerLineEdits: lawyerLineEdits, applyLawyerLine: applyLawyerLine, expandLawyerMarker: expandLawyerMarker, spacesFor: spacesFor, lawyerLinesOf: lawyerLinesOf,
    withAliases: withAliases, fillMode: fillMode, caseForms: caseForms, hasRepForms: hasRepForms, PERSON_KEYS: PERSON_KEYS,
    MK_OPEN: MK_OPEN, MK_CLOSE: MK_CLOSE, BLANK: BLANK,
    mk: mk, markerAt: markerAt, markersOf: markersOf, fillDoc: fillDoc,
    stripLinesegs: stripLinesegs, valuesOf: valuesOf, birthOf: birthOf
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EsignHwpTpl = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
