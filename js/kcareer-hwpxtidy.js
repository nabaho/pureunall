/* 한글 서식 «정리» — 쪽 빼기 · 남은 안내 글자 지우기 · 표 끝의 빈 줄 지우기
   (대표 지시 2026-09-13 「불필요한 페이지는 삭제하고 싶다 · 박스 정리 안 되는 것」)

   ■ 왜 따로 두나
     채우는 자(kcareer-hwpxfill.js)는 «넣는» 일만 한다. 여기는 «빼는» 일만 한다.
     빼는 일은 되돌릴 수 없어서, 판정 하나하나를 검사로 못 박아 두어야 한다.

   ■ 무엇을 «안» 하나 — 이것이 더 중요하다
     ⚠ 표를 통째로 지우지 않는다. 기관 서식의 표는 「몇 줄로 내라」가 뜻인 경우가 많다.
     ⚠ 글자가 든 칸을 함부로 비우지 않는다 — 자리표이거나, 기울임(예시)일 때만 비운다.
     ⚠ 마지막 한 쪽은 남긴다. 전부 빼면 빈 파일이 나가는데, 그것은 «실수»지 뜻이 아니다.

   ⚠ 반드시 kcareer-hwpxfill.js 뒤에 실어야 한다 — 표·칸을 다루는 자를 거기서 빌려 온다.
     두 벌로 만들면 「채울 때는 한 칸인데 지울 때는 두 칸」 같은 어긋남이 생긴다. */
(function (root) {
  'use strict';

  var _fx = null;
  function FX() {
    if (_fx) return _fx;
    if (typeof module !== 'undefined' && module.exports) _fx = require('./kcareer-hwpxfill.js');
    else _fx = root.KcareerHwpxFill;
    if (!_fx) throw new Error('kcareer-hwpxfill.js 를 먼저 실어야 합니다');
    return _fx;
  }

  /* 여는 태그만 — 표 안에 든 문단의 속성을 바깥 문단의 것으로 읽으면 안 된다 */
  function openTag(text) {
    var s = String(text || ''), i = s.indexOf('>');
    return i < 0 ? s : s.slice(0, i + 1);
  }
  function 보이는글자(text) {
    var out = [], re = /<hp:t[^>]*>([\s\S]*?)<\/hp:t>/g, m;
    while ((m = re.exec(String(text || '')))) out.push(m[1]);
    return out.join('').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ').trim();
  }

  /* ── 쪽 묶음 ───────────────────────────────────────────────────────────
     한글은 「쪽 나누기」를 문단의 pageBreak="1" 로 적어 둔다. 그 자리에서 갈린다.
     ⚠★ 이것은 «쪽»이 아니라 «쪽 나누기로 갈린 묶음»이다. 글이 넘쳐 저절로 넘어간 쪽은
        파일 안에 흔적이 없어 여기서는 알 수 없다 — 화면도 그렇게 말해야 한다.
        「10쪽인데 묶음이 4개」인 것은 고장이 아니다. */
  function pages(xml) {
    var X = FX();
    var blocks = X.tagBlocks(String(xml || ''), 'hp:p');
    var out = [];
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      var 새묶음 = /pageBreak\s*=\s*"1"/.test(openTag(b.text));
      if (!out.length || 새묶음) out.push({ start: b.start, end: b.end, blocks: 0, head: '', 줄: [] });
      var cur = out[out.length - 1];
      cur.end = b.end;
      cur.blocks++;
      if (cur.줄.length < 8) {
        var t = 보이는글자(b.text);
        if (t) cur.줄.push(t);
      }
      if (!cur.head) cur.head = 보이는글자(b.text).slice(0, 40);
    }
    out.forEach(function (g) { g.title = 제목고르기(g.줄); delete g.줄; });
    return out;
  }

  /* ── 서류의 «제목» 고르기 ──────────────────────────────────────────────
     (대표 지시 2026-09-13 「저장할 때 제목은 첨부 파일에서 찾아서 제목으로 만들고」)
     기관 서식 한 덩이에 여러 서류가 들어 있다 — 모집공고문·지원서·수행계획서·동의서·평가기준표.
     쪽마다 갈라 저장하려면 그 쪽이 «무슨 서류인지» 이름이 있어야 한다.

     ⚠★ 첫 줄이 제목인 경우는 오히려 드물다. 실측(코레일 서식): 첫 줄은 「[붙임 1]」이고
        진짜 제목은 «둘째 줄»이다. 그래서 몇 줄을 보고 «제목답지 않은 것»을 걸러 낸다.
     ⚠ 못 고르면 빈 글자를 준다 — 지어내지 않는다. 그때는 사람이 적는다. */
  var 버릴것 = [
    /^[[［(（<《][^\]］)）>》]{0,12}[\]］)）>》]$/,   /* [붙임 1] · (별지 제1호) */
    /^[○◯□■●▶※·*\-–—]/,                                    /* 항목 글머리 */
    /^\d+[.)]/,                                              /* 1. 2) 같은 번호 */
    /[:：]\s*$/,                                              /* 「담당자 :」 */
    /^[\d\s.\-~년월일]+$/                                     /* 날짜·숫자만 */
  ];
  function 제목답나(s) {
    var t = String(s || '').replace(/\s+/g, ' ').trim();
    if (t.length < 4 || t.length > 60) return false;
    for (var i = 0; i < 버릴것.length; i++) if (버릴것[i].test(t)) return false;
    return true;
  }
  function 제목고르기(줄들) {
    var 후보 = (줄들 || []).filter(제목답나);
    return 후보.length ? String(후보[0]).replace(/\s+/g, ' ').trim() : '';
  }
  /* 서류 전체의 제목 — 맨 앞 묶음의 제목이 곧 그 서류의 이름이다 */
  function docTitle(xml) {
    var ps = pages(xml);
    for (var i = 0; i < ps.length; i++) if (ps[i].title) return ps[i].title;
    return '';
  }
  /* 파일 이름으로 쓸 수 있게 다듬는다 — 윈도가 싫어하는 글자를 뺀다 */
  function safeName(s) {
    return String(s || '').replace(/[\\/:*?"<>|\r\n\t]/g, ' ')
      .replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  /* 고른 묶음을 뺀다.
     ⚠ 전부 빼려 하면 «하나도 안 뺀다»(refused). 빈 서류가 나가는 것보다 낫다.
     ⚠ 맨 앞 묶음을 빼면 그다음 묶음의 「쪽 나누기」를 떼어야 한다 —
       안 떼면 첫 장이 통째로 빈 쪽이 된다. */
  function dropPages(xml, 뺄것) {
    var src = String(xml || '');
    var ps = pages(src);
    var 뺄 = {};
    (뺄것 || []).forEach(function (i) { if (i >= 0 && i < ps.length) 뺄[i] = 1; });
    var n = Object.keys(뺄).length;
    if (!n) return { xml: src, dropped: 0, refused: false };
    if (n >= ps.length) return { xml: src, dropped: 0, refused: true };

    var out = '', pos = 0;
    ps.forEach(function (p, i) {
      if (!뺄[i]) return;
      out += src.slice(pos, p.start);
      pos = p.end;
    });
    out += src.slice(pos);

    /* 새로 맨 앞이 된 묶음의 쪽 나누기를 뗀다 */
    if (뺄[0]) {
      var first = FX().tagBlocks(out, 'hp:p')[0];
      if (first) {
        var head = openTag(first.text);
        var 고친머리 = head.replace(/pageBreak\s*=\s*"1"/, 'pageBreak="0"');
        if (고친머리 !== head) {
          out = out.slice(0, first.start) + 고친머리 + first.text.slice(head.length)
              + out.slice(first.end);
        }
      }
    }
    return { xml: out, dropped: n, refused: false };
  }

  /* ── 기울임(예시) 글자 ────────────────────────────────────────────────
     기관 서식은 「직위, 연수 등」처럼 «예시»를 기울임으로 적어 둔다.
     기울임 여부는 본문이 아니라 header.xml 의 글자모양표에 있다 — 그 번호를 모아 준다.
     ⚠ 못 읽으면 빈 목록을 준다. 그러면 기울임 지우기는 «아무것도 안 한다» — 안전한 쪽이다. */
  function italicIds(headerXml) {
    var out = {};
    var X = FX();
    var blocks;
    try { blocks = X.tagBlocks(String(headerXml || ''), 'hh:charPr'); } catch (e) { return out; }
    blocks.forEach(function (b) {
      var head = openTag(b.text);
      var m = /\bid\s*=\s*"([^"]+)"/.exec(head);
      if (!m) return;
      /* <hh:italic/> 가 있거나 italic="1" 로 적힌 두 꼴을 모두 본다 */
      if (/<hh:italic\b/.test(b.text) || /\bitalic\s*=\s*"1"/.test(head)) out[m[1]] = true;
    });
    return out;
  }

  /* 칸의 글자가 «전부» 기울임인가 — 한 조각이라도 곧은 글자면 아니다.
     ⚠ 「전부」로 못 박는 까닭: 「홍길동(기울임: 예시)」처럼 섞인 칸을 비우면
       사람이 친 값까지 날아간다. */
  function 온통기울임(tcText, italic) {
    if (!italic) return false;
    var re = /<hp:run\b([^>]*)>([\s\S]*?)<\/hp:run>/g, m, 글자있나 = false;
    while ((m = re.exec(String(tcText || '')))) {
      var 속 = 보이는글자(m[2]);
      if (!속) continue;
      글자있나 = true;
      var id = /charPrIDRef\s*=\s*"([^"]+)"/.exec(m[1]);
      if (!id || !italic[id[1]]) return false;
    }
    return 글자있나;
  }

  /* ── 남은 안내 글자 지우기 ────────────────────────────────────────────
     opts.italic 을 주면 「온통 기울임인 칸」도 함께 비운다(예시 글자).
     ⚠ 자리표 판정은 채우는 자(isPlaceholder)와 «같은 자»를 쓴다 — 두 벌이면
       「채울 때는 자리표인데 지울 때는 아닌」 칸이 생긴다. */
  /* ⚠ 줄은 «표 안에서의 자리»로 센다 — splitRows 와 tagBlocks(tbl,'hp:tr') 의 차례가 같다.
     splitRows 가 주는 것은 글자뿐이라 자리를 알 수 없다. */
  function 줄들(X, tbl) {
    return X.tagBlocks(String(tbl || ''), 'hp:tr').map(function (b) { return b.text; });
  }
  /* 줄이 통째로 비었나 — 자리표(「____」·「1900.00.00」)도 «빈 것»으로 본다.
     ⚠ 채우는 자와 «같은 자»(isRowBlank)를 칸마다 쓴다. 두 벌이면 어긋난다. */
  function 빈줄인가(X, trText) {
    var cells = X.splitCells(trText);
    if (!cells.length) return false;
    for (var i = 0; i < cells.length; i++) {
      if (!X.isRowBlank(X.cellText(cells[i]))) return false;
    }
    return true;
  }

  function clearHints(xml, opts) {
    var X = FX();
    var italic = (opts && opts.italic) || null;
    var src = String(xml || '');
    var n = 0;
    var out = X.eachTable(src, function (tbl) {
      var rows = 줄들(X, tbl), newTbl = tbl;
      for (var r = 0; r < rows.length; r++) {
        var cells = X.splitCells(rows[r]), newTr = rows[r], 바뀜 = false;
        for (var c = 0; c < cells.length; c++) {
          var t = X.cellText(cells[c]);
          if (!t) continue;
          var 지울까 = X.isPlaceholder(t) || 온통기울임(cells[c], italic);
          if (!지울까) continue;
          var 빈칸 = X.setCellText(cells[c], '');
          if (!빈칸) continue;
          newTr = X.replaceCellAt(newTr, c, 빈칸);
          cells[c] = 빈칸; 바뀜 = true; n++;
        }
        if (바뀜) { newTbl = replaceRowAt(newTbl, r, newTr); rows = 줄들(X, newTbl); }
      }
      return newTbl;
    });
    return { xml: out, cleared: n };
  }

  /* ⚠ 줄도 «자리»로 바꾼다 — 빈 줄끼리는 XML 이 글자 하나까지 같아서,
     글자로 찾아 바꾸면 맨 앞의 빈 줄이 바뀐다(채우는 쪽이 겪은 그대로다). */
  function replaceRowAt(tbl, idx, newRow) {
    var b = FX().tagBlocks(String(tbl || ''), 'hp:tr');
    if (!b[idx]) return tbl;
    return tbl.slice(0, b[idx].start) + newRow + tbl.slice(b[idx].end);
  }

  /* ── 표 «끝»의 빈 줄 지우기 ───────────────────────────────────────────
     ⚠★ 끝에서만 지운다. 가운데 빈 줄은 서식이 일부러 비워 둔 자리일 수 있다
        (「2줄씩 띄워 적으시오」 같은 서식이 실제로 있다).
     ⚠★ 머리줄만 남기지 않는다 — 자료가 한 줄도 없는 표는 통째로 빈칸이 되어
        「표가 사라졌다」로 보인다. 적어도 한 줄은 남긴다. */
  function dropEmptyRows(xml) {
    var X = FX();
    var n = 0;
    var out = X.eachTable(String(xml || ''), function (tbl) {
      var blocks = X.tagBlocks(tbl, 'hp:tr');
      if (blocks.length < 3) return tbl;      /* 머리줄 + 남길 한 줄 + 지울 것이 있어야 뜻이 있다 */
      var 끝 = blocks.length - 1;
      while (끝 >= 2 && 빈줄인가(X, blocks[끝].text)) 끝--;
      var 남길수 = 끝 + 1;
      if (남길수 >= blocks.length) return tbl;
      n += blocks.length - 남길수;
      var 새표 = tbl.slice(0, blocks[남길수].start) + tbl.slice(blocks[blocks.length - 1].end);
      return 줄수고치기(새표, 남길수);
    });
    return { xml: out, dropped: n };
  }

  /* 표 머리에 적힌 줄 수(rowCnt)를 실제 줄 수에 맞춘다 —
     ⚠ 안 맞추면 한글이 표를 못 그리거나 빈 줄을 지어낸다. */
  function 줄수고치기(tbl, 줄수) {
    var s = String(tbl || '');
    var i = s.indexOf('>');
    if (i < 0) return s;
    var head = s.slice(0, i + 1);
    var 새머리 = head.replace(/rowCnt\s*=\s*"\d+"/, 'rowCnt="' + 줄수 + '"');
    return 새머리 + s.slice(i + 1);
  }

  /* ── 쪽마다 갈라 저장 ─────────────────────────────────────────────────
     (대표 지시 2026-09-13 「페이지 나누어서 저장하고 제목도 정할 수 있게」)
     한 묶음만 남기고 나머지를 빼면 그 쪽 하나짜리 서류가 된다.
     ⚠ 「전부 빼기」 빗장에 걸리지 않는다 — 하나는 늘 남기기 때문이다. */
  function keepOnly(xml, 남길것) {
    var ps = pages(xml);
    var 뺄 = [];
    for (var i = 0; i < ps.length; i++) if (i !== 남길것) 뺄.push(i);
    return dropPages(xml, 뺄);
  }

  var api = {
    pages: pages, dropPages: dropPages, keepOnly: keepOnly,
    docTitle: docTitle, safeName: safeName,
    italicIds: italicIds, clearHints: clearHints,
    dropEmptyRows: dropEmptyRows,
    /* 검사가 같은 자를 쓰도록 내보낸다 */
    _openTag: openTag, _text: 보이는글자, _allItalic: 온통기울임
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerHwpxTidy = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
