/* 푸른통합시스템 — 괴롭힘·성희롱 조사 한글(.hwpx · .hwp) 읽기 및 정식 .hwpx 문서 생성기
 *
 * 맡는 일:
 *   1. 입력(읽기): 녹취록·진술서·신고서로 올라온 .hwpx / .hwp / .docx / .txt(.srt·.vtt·.md) 파일에서
 *      브라우저(또는 Node) 안에서 바로 문단과 표(칸 | 칸 | 칸)를 추출하고 주민등록번호를 가린다.
 *   2. 출력(생성): 정리된 「면담 진술확인서(겸 비밀유지서약서, 전자서명 이미지·문서지문·정정의견 포함)」와
 *      「최종 직장 내 괴롭힘·성희롱 조사결과보고서」를 한컴오피스·푸른 한글편집기(hangul.html) 호환
 *      표준 OWPML(.hwpx) 바이트로 직접 조립해 내려준다.
 */
(function (root, factory) {
  'use strict';
  var C = (root && root.PuHarassCore) || (typeof require === 'function' ? require('./pu-harass-core.js') : null);
  if (typeof module === 'object' && module.exports && (!root.PureunZip || !root.PureunHwpx)) {
    try {
      require('../hangul/js/zip.js');
      require('../hangul/js/hwpx.js');
      require('../hangul/js/hwp.js');
    } catch (e) {}
  }
  var api = factory(root, C);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuHarassHwpx = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function (root, C) {
  'use strict';

  var FONT = '맑은 고딕';

  function mask(s) {
    var v = String(s == null ? '' : s);
    return (C && typeof C.maskRrnText === 'function') ? C.maskRrnText(v) : v;
  }

  function str(s) {
    return String(s == null ? '' : s).trim();
  }

  function decodeXmlEntities(s) {
    return String(s || '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); })
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/&amp;/g, '&');
  }

  function formatExtractedTableRows(rawRows) {
    var rows = (rawRows || []).filter(function (r) { return Array.isArray(r) && r.some(function (c) { return str(c); }); });
    if (!rows.length) return '';
    /* 3열 문답표(순번 · 질문 · 답변)는 셀 내부 파이프(|) 및 여러 줄(\n)이 훼손되지 않도록 명시적 문답 표지로 직렬화 */
    if (rows[0].length === 3 && /^순번$/.test(str(rows[0][0])) && /질문/.test(str(rows[0][1]))) {
      var qaOut = [];
      for (var i = 1; i < rows.length; i++) {
        var r = rows[i];
        if (r.length >= 3 && /^\d+$/.test(str(r[0]))) {
          var seq = str(r[0]);
          qaOut.push('【문' + seq + '】 ' + String(r[1] || '').trim());
          qaOut.push('【답' + seq + '】 ' + String(r[2] || '').trim());
        } else {
          qaOut.push(r.map(function (c) { return String(c || '').replace(/\s*\n+\s*/g, ' ').trim(); }).join(' | '));
        }
      }
      return qaOut.join('\n');
    }
    return rows.map(function (r) {
      if (r.length === 1) return String(r[0] || '').trim();
      return r.map(function (c) { return String(c || '').replace(/\s*\n+\s*/g, ' ').trim(); }).join(' | ');
    }).filter(Boolean).join('\n');
  }

  /* PureunHwpx 문서 모델 블록 → 줄·표 텍스트 (1칸 상자 줄바꿈 및 문답표 파이프·줄바꿈 보존) */
  function blocksToStructuredText(blocks, keepBlankLines) {
    var lines = [];
    (blocks || []).forEach(function (b) {
      if (!b) return;
      if (b.type === 'table' && Array.isArray(b.rows)) {
        var tblRows = b.rows.map(function (row) {
          return (row || []).map(function (cell) {
            return blocksToStructuredText(cell && cell.blocks, true).trim();
          });
        });
        var formatted = formatExtractedTableRows(tblRows);
        if (formatted) lines.push(formatted);
        return;
      }
      var runTxt = (b.runs || []).map(function (r) {
        if (!r) return '';
        if (r.table) return '\n' + blocksToStructuredText([r.table]) + '\n';
        return r.text || '';
      }).join('').trim();
      if (runTxt || keepBlankLines) lines.push(runTxt);
    });
    return lines.join('\n');
  }

  /* DOMParser 없는 환경(Node 단위검사 등)에서 HWPX section XML 직접 추출 */
  function extractOwpmXmlText(xmlStr) {
    var out = [];
    var s = String(xmlStr || '');
    var tblTokens = [];
    var rest = s.replace(/<hp:tbl\b[\s\S]*?<\/hp:tbl>/g, function (tblXml) {
      var rawRows = [];
      tblXml.replace(/<hp:tr\b[^>]*>([\s\S]*?)<\/hp:tr>/g, function (_, trBody) {
        var cells = [];
        trBody.replace(/<hp:tc\b[^>]*>([\s\S]*?)<\/hp:tc>/g, function (__, tcBody) {
          var pLines = [];
          tcBody.replace(/<hp:p\b[^>]*>([\s\S]*?)<\/hp:p>/g, function (___, pBody) {
            var pRuns = [];
            pBody.replace(/<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/g, function (____, tInner) {
              var cleanT = decodeXmlEntities(tInner.replace(/<[^>]+>/g, '')).trim();
              if (cleanT) pRuns.push(cleanT);
            });
            pLines.push(pRuns.join(' '));
          });
          cells.push(pLines.join('\n').trim());
        });
        rawRows.push(cells);
      });
      var idx = tblTokens.length;
      tblTokens.push(formatExtractedTableRows(rawRows));
      return '\n<hp:p><hp:t>__PU_TBL_' + idx + '__</hp:t></hp:p>\n';
    });
    rest.replace(/<hp:p\b[^>]*>([\s\S]*?)<\/hp:p>/g, function (_, pBody) {
      var runs = [];
      pBody.replace(/<hp:t\b[^>]*>([\s\S]*?)<\/hp:t>/g, function (__, tInner) {
        var cleanT = decodeXmlEntities(tInner.replace(/<[^>]+>/g, '')).trim();
        if (cleanT) runs.push(cleanT);
      });
      if (!runs.length) return;
      var line = runs.join(' ');
      var mTbl = line.match(/^__PU_TBL_(\d+)__$/);
      if (mTbl) {
        var tblTxt = tblTokens[Number(mTbl[1])];
        if (tblTxt) out.push(tblTxt);
      } else {
        out.push(line);
      }
    });
    return out.join('\n');
  }

  function hasDisallowedControlChars(txt) {
    return /[\x00-\x08\x0B\x0E-\x1F\x7F]/.test(String(txt == null ? '' : txt));
  }

  function decodePlainTextBytes(u8) {
    if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
      return new TextDecoder('utf-16le', { fatal: false }).decode(u8);
    }
    if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
      return new TextDecoder('utf-16be', { fatal: false }).decode(u8);
    }
    var utf8 = new TextDecoder('utf-8', { fatal: false }).decode(u8);
    if (utf8.indexOf('\uFFFD') >= 0) {
      try {
        var euckr = new TextDecoder('euc-kr', { fatal: false }).decode(u8);
        var badUtf = (utf8.match(/\uFFFD/g) || []).length;
        var badKr = (euckr.match(/\uFFFD/g) || []).length;
        if (badKr < badUtf) return euckr;
      } catch (e) {}
    }
    return utf8;
  }

  /* 업로드·첨부 파일 바이트(.hwpx, .hwp, .docx, .txt 등)에서 구조화된 텍스트 추출 */
  async function extractDocumentText(bufferOrBytes, fileName, optKordoc) {
    var u8 = bufferOrBytes instanceof Uint8Array ? bufferOrBytes : new Uint8Array(bufferOrBytes || []);
    var lower = String(fileName || '').toLowerCase();
    var isZip = u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4b;
    var isOle = u8.length >= 8 && u8[0] === 0xd0 && u8[1] === 0xcf && u8[2] === 0x11 && u8[3] === 0xe0;

    /* 1) .hwpx (한글 OWPML ZIP 패키지) */
    if (/\.hwpx$/.test(lower) || (isZip && !/\.(docx|xlsx|pptx)$/.test(lower))) {
      if (root.PureunZip && typeof root.PureunZip.readZip === 'function') {
        try {
          var zFiles = await root.PureunZip.readZip(u8);
          if (zFiles && (zFiles['Contents/section0.xml'] || zFiles['Contents/header.xml'])) {
            if (typeof DOMParser !== 'undefined' && root.PureunHwpx && typeof root.PureunHwpx.readHwpx === 'function') {
              var doc = await root.PureunHwpx.readHwpx(u8);
              var txt = blocksToStructuredText(doc && doc.blocks);
              if (str(txt)) return { ok: true, format: 'hwpx', text: mask(txt) };
            }
            var secKeys = Object.keys(zFiles).filter(function (k) { return /^Contents\/section\d+\.xml$/i.test(k); }).sort();
            var xmlChunks = secKeys.map(function (k) {
              return extractOwpmXmlText(new TextDecoder('utf-8').decode(zFiles[k]));
            }).filter(Boolean);
            if (xmlChunks.length) return { ok: true, format: 'hwpx', text: mask(xmlChunks.join('\n\n')) };
          }
        } catch (e) {
          if (/암호가 걸린/.test(String(e && e.message))) throw e;
        }
      }
    }

    /* 2) .hwp (한글 5.0 OLE 복합문서) */
    if (/\.hwp$/.test(lower) || isOle) {
      if (root.PureunHwp && typeof root.PureunHwp.readHwp === 'function') {
        try {
          var hwpDoc = await root.PureunHwp.readHwp(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
          var hwpTxt = blocksToStructuredText(hwpDoc && hwpDoc.blocks);
          if (str(hwpTxt)) return { ok: true, format: 'hwp', text: mask(hwpTxt) };
        } catch (e) {}
      }
    }

    /* 3) kordoc 보조 엔진 (.docx · .hwpx · .hwp 표·문단 추출) */
    var kd = optKordoc || root.PuKordocText;
    if ((isZip || isOle) && kd && typeof kd.read === 'function') {
      try {
        var kr = await kd.read(u8);
        if (kr && str(kr.text)) {
          return { ok: true, format: /\.docx$/.test(lower) ? 'docx' : (isOle ? 'hwp' : 'hwpx'), text: mask(kr.text) };
        }
      } catch (e) {}
    }

    /* 4) .docx 최소 XML 폴백 (word/document.xml) */
    if ((/\.docx$/.test(lower) || isZip) && root.PureunZip && typeof root.PureunZip.readZip === 'function') {
      try {
        var dz = await root.PureunZip.readZip(u8);
        if (dz && dz['word/document.xml']) {
          var wXml = new TextDecoder('utf-8').decode(dz['word/document.xml']);
          var wParas = [];
          wXml.replace(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g, function (_, pInner) {
            var ts = [];
            pInner.replace(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g, function (__, tVal) {
              ts.push(decodeXmlEntities(tVal));
            });
            var joined = ts.join('').trim();
            if (joined) wParas.push(joined);
          });
          if (wParas.length) return { ok: true, format: 'docx', text: mask(wParas.join('\n')) };
        }
      } catch (e) {}
    }

    /* 5) 텍스트형 PDF 브라우저 로컬 추출 (원본 외부 전송 없이 로컬 추출 즉시 주민번호 가림) */
    var isPdf = /\.pdf$/i.test(lower) || (u8.length >= 5 && u8[0] === 0x25 && u8[1] === 0x50 && u8[2] === 0x44 && u8[3] === 0x46);
    if (isPdf && root.pdfjsLib && typeof root.pdfjsLib.getDocument === 'function') {
      try {
        var pdfDoc = await root.pdfjsLib.getDocument({ data: u8.slice(0), isEvalSupported: false }).promise;
        var totalPages = Number(pdfDoc.numPages) || 0;
        var maxPages = Math.min(totalPages, 150);
        var pageTexts = [];
        for (var pIdx = 1; pIdx <= maxPages; pIdx++) {
          var page = await pdfDoc.getPage(pIdx);
          var tc = await page.getTextContent();
          var lineBuf = [];
          var pageLines = [];
          var prevEndX = null;
          var prevStr = '';
          (tc && tc.items ? tc.items : []).forEach(function (it) {
            var sVal = String(it && it.str != null ? it.str : '');
            if (sVal) {
              var tr = it && Array.isArray(it.transform) ? it.transform : null;
              var curX = tr && typeof tr[4] === 'number' ? tr[4] : null;
              var fontH = tr && typeof tr[0] === 'number' ? Math.abs(tr[0]) : 10;
              var w = (it && typeof it.width === 'number') ? it.width : (sVal.length * fontH * 0.5);
              if (!lineBuf.length) {
                lineBuf.push(sVal);
              } else {
                var noGapByCoord = (curX != null && prevEndX != null) ? ((curX - prevEndX) <= Math.max(2, fontH * 0.25)) : false;
                var adjNumHyphen = /[-~–—\d]\s*$/.test(prevStr) && /^\s*[-~–—\d]/.test(sVal);
                lineBuf.push((noGapByCoord || adjNumHyphen) ? sVal : (' ' + sVal));
              }
              prevStr = sVal;
              prevEndX = curX != null ? (curX + w) : null;
            }
            if (it && it.hasEOL) {
              var joinedLine = lineBuf.join('').trim();
              if (joinedLine) pageLines.push(joinedLine);
              lineBuf = [];
              prevEndX = null;
              prevStr = '';
            }
          });
          if (lineBuf.length) {
            var tailLine = lineBuf.join('').trim();
            if (tailLine) pageLines.push(tailLine);
          }
          if (pageLines.length) pageTexts.push(pageLines.join('\n'));
        }
        var fullPdfTxt = pageTexts.join('\n\n').trim();
        if (str(fullPdfTxt)) {
          var isTruncated = totalPages > maxPages;
          if (isTruncated) {
            fullPdfTxt += '\n\n[안내: 전체 ' + totalPages + '쪽 중 앞 ' + maxPages + '쪽까지만 추출되었습니다. 이후 쪽은 분할 파일로 불러와 주세요.]';
          }
          return { ok: true, format: 'pdf', text: mask(fullPdfTxt), truncated: isTruncated, totalPages: totalPages, readPages: maxPages };
        }
        return { ok: false, format: 'pdf_image', text: '' };
      } catch (e) {
        return { ok: false, format: 'pdf', text: '' };
      }
    }

    /* 6) 일반 텍스트 (.txt · .srt · .vtt · .json · .md · .csv) — 손상된 바이너리 컨테이너 문서 및 제어문자 포함 데이터 차단 */
    var isBinContainerExt = /\.(hwpx|hwp|hwt|docx|doc|pdf|xlsx|xls|xlsm|pptx|ppt|zip)$/i.test(lower);
    var isMediaExt = /\.(mp3|m4a|wav|ogg|webm|png|jpg|jpeg|gif|webp)$/i.test(lower);
    if (!isBinContainerExt && !isMediaExt && !isZip && !isOle && !isPdf && u8.length > 0) {
      var plain = decodePlainTextBytes(u8);
      if (!hasDisallowedControlChars(plain) && str(plain)) {
        if (/\.json$/i.test(lower) && C && typeof C.parseJsonTranscript === 'function') {
          var jsonParsed = C.parseJsonTranscript(plain);
          if (str(jsonParsed)) return { ok: true, format: 'json', text: mask(jsonParsed) };
        }
        if (/\.(srt|vtt)$/i.test(lower)) {
          var subCleaned = plain
            .replace(/^\s*WEBVTT[^\n]*\n+/i, '')
            .replace(/^\s*\d+\s*\r?\n(?=\d{2}:\d{2})/gm, '')
            .replace(/(\d{2}:\d{2}:\d{2})[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}[^\n]*/g, '[$1]');
          return { ok: true, format: 'srt', text: mask(subCleaned) };
        }
        return { ok: true, format: 'txt', text: mask(plain) };
      }
      return { ok: false, format: 'corrupt', text: '' };
    }

    return { ok: false, format: isPdf ? 'pdf_image' : (isBinContainerExt ? 'corrupt' : (lower.split('.').pop() || 'unknown')), text: '' };
  }

  /* 보고서 .hwpx/.docx/.txt 불러오기 시 본문 영역만 깔끔히 추출 (자체 생성 .hwpx 왕복 지원) */
  function extractReportBodyFromText(extractedText) {
    var safe = mask(String(extractedText == null ? '' : extractedText)).trim();
    if (!safe) return '';
    var marker = '4. 상세 사실인정 및 종합 판단 본문';
    var idx = safe.indexOf(marker);
    if (idx >= 0) {
      var bodyPart = safe.slice(idx + marker.length).trim();
      var tailIdx = bodyPart.indexOf('5. 고충심의위원회 심의위원 확인 서명란');
      if (tailIdx > 0) bodyPart = bodyPart.slice(0, tailIdx).trim();
      if (bodyPart) return bodyPart;
    }
    return safe;
  }

  /* ═══ HWPX 문서 블록 조립 도우미 ═══ */
  function pBlock(text, opts) {
    var o = opts || {};
    var clean = mask(String(text == null ? '' : text));
    return {
      type: 'p',
      align: o.align || 'justify',
      lineSpacing: o.lineSpacing || 160,
      before: o.before || 0,
      after: o.after != null ? o.after : 4,
      left: o.left || 0,
      runs: clean ? [{
        text: clean,
        font: o.font || FONT,
        size: o.size || 10.5,
        bold: !!o.bold,
        color: o.color || '#000000'
      }] : [{ text: '', font: FONT, size: o.size || 10.5 }]
    };
  }

  function multiLineBlocks(text, opts) {
    var lines = mask(String(text == null ? '' : text)).split(/\r?\n/);
    if (!lines.length) return [pBlock('', opts)];
    return lines.map(function (ln) { return pBlock(ln, opts); });
  }

  function tCell(textOrBlocks, opts) {
    var o = opts || {};
    var blocks = Array.isArray(textOrBlocks)
      ? textOrBlocks
      : multiLineBlocks(textOrBlocks, {
        align: o.align || 'left',
        size: o.size || 9.8,
        bold: !!o.bold,
        color: o.color || '#000000',
        lineSpacing: 145,
        after: 1
      });
    return {
      colSpan: o.colSpan || 1,
      rowSpan: o.rowSpan || 1,
      bg: o.bg || undefined,
      valign: o.valign || 'middle',
      margin: { l: 2.4, r: 2.4, t: 1.6, b: 1.6 },
      blocks: blocks
    };
  }

  function dataUrlToPngBytes(dataUrl) {
    var s = String(dataUrl || '').trim();
    var m = s.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i);
    if (!m) return null;
    var raw = m[2].replace(/\s+/g, '');
    var bytes = null;
    if (typeof atob === 'function') {
      var bin = atob(raw);
      bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else if (typeof Buffer !== 'undefined') {
      bytes = new Uint8Array(Buffer.from(raw, 'base64'));
    }
    if (!bytes || !bytes.length) return null;
    return { mime: m[1].toLowerCase() === 'png' ? 'image/png' : 'image/jpeg', data: bytes };
  }

  function ensureHwpxBuilder() {
    if (!root.PureunHwpx || typeof root.PureunHwpx.buildHwpx !== 'function' || !root.PureunZip) {
      throw new Error('한글(.hwpx) 생성 엔진이 아직 준비되지 않았습니다.');
    }
    return root.PureunHwpx;
  }

  /* 세련된 상단 문서분류·표제 배너 표 (27색 팔레트 엄수) */
  function docTopBannerTable(classBadge, mainTitle, subInfo, docNoText) {
    return {
      type: 'table',
      widthRatio: 1,
      colWidths: [72, 28],
      rows: [
        [
          tCell([
            pBlock(classBadge || '대외비 · 외부전문가 독립조사 문서', { size: 8.8, bold: true, color: '#991B1B', after: 2 }),
            pBlock(mainTitle, { size: 15, bold: true, color: '#0F172A', after: 2 }),
            pBlock(subInfo || '조사·자문기관: 푸른노무법인', { size: 9.2, color: '#475569', after: 0 })
          ], { bg: '#F8FAFC', valign: 'middle' }),
          tCell([
            pBlock('문서관리 · 보안등급', { align: 'center', size: 8.5, bold: true, color: '#1E40AF', after: 2 }),
            pBlock(docNoText || '인사기밀 (열람제한)', { align: 'center', size: 9.2, bold: true, color: '#1E293B', after: 1 }),
            pBlock('무단 복제·유출 엄금', { align: 'center', size: 8.2, color: '#64748B', after: 0 })
          ], { bg: '#EFF6FF', valign: 'middle', align: 'center' })
        ]
      ]
    };
  }

  /* ① 면담 진술확인서 / 법무 문답조서 / 노동부 면담기록지 정식 .hwpx 생성 (3종 서식 지원 · 왕복 무손실 보존) */
  function buildInterviewHwpx(caseRec, interviewRec, opts) {
    var Hx = ensureHwpxBuilder();
    var c = caseRec || {};
    var iv = interviewRec || {};
    var o = opts || {};
    var styleId = str(o.stmtStyle || iv.stmtStyle) || 'confirm_std';
    var cat = (C && C.CATEGORIES && C.CATEGORIES[c.category]) || { label: '직장 내 괴롭힘' };
    var roleKr = iv.role === 'accused' ? '피신고인(행위자)' : iv.role === 'witness' ? '참고인' : '신고인(피해근로자)';
    var qaList = Array.isArray(iv.qaList) ? iv.qaList.filter(function (q) { return q && (str(q.q) || str(q.a)); }) : [];

    var titleByStyle = styleId === 'legal_record'
      ? (roleKr + ' 면담 문답조서 (비밀유지서약 겸용)')
      : styleId === 'moel_sheet'
        ? (cat.label + ' 고충사건 면담기록지 (매뉴얼 표준)')
        : '비밀유지서약 및 면담 진술확인서';
    var badgeByStyle = styleId === 'legal_record'
      ? '대외비 · 법무·외부조사단 표준 문답조서'
      : styleId === 'moel_sheet'
        ? '대외비 · 고용노동부 매뉴얼 별지 표준양식'
        : '대외비 · 노무법인 표준 진술확인·서약서';

    var blocks = [];
    blocks.push(docTopBannerTable(
      badgeByStyle,
      titleByStyle,
      '수행기관: 푸른노무법인 · 근로기준법 제76조의3 제7항 및 남녀고용평등법 제14조 비밀엄수 문서',
      str(c.erpCaseNo || c.caseNo) || (str(iv.date) || '대외비 진술기록')
    ));
    blocks.push(pBlock('', { size: 4, after: 4 }));

    /* 1. 사건 및 면담 개요 표 */
    blocks.push(pBlock('1. 사건 및 면담 개요', { size: 11.5, bold: true, color: '#0F172A', before: 4, after: 4 }));
    blocks.push({
      type: 'table',
      widthRatio: 1,
      colWidths: [18, 32, 18, 32],
      rows: [
        [
          tCell('의뢰 사업장', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(str(c.companyName) || '-'),
          tCell('조사 구분', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(cat.label)
        ],
        [
          tCell('사건명', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(str(c.title) || (cat.label + ' 조사 건'), { colSpan: 3 })
        ],
        [
          tCell('대상자 구분', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(roleKr, { bold: true }),
          tCell('성명·호칭 / 소속', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell((str(iv.alias) || '익명') + (str(iv.dept) ? ' (' + str(iv.dept) + ')' : ''))
        ],
        [
          tCell('면담 일자', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(str(iv.date) || '-'),
          tCell('면담 방식 · 양식', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell((str(iv.method) || '대면면담') + ' · ' + (styleId === 'legal_record' ? '문답조서형' : styleId === 'moel_sheet' ? '면담기록지형' : '진술확인서형'))
        ]
      ]
    });

    /* 2. 비밀유지서약 및 사전 고지 확인 */
    blocks.push(pBlock('2. 조사 참여자 비밀유지 서약 및 절차 고지 확인 (근로기준법 제76조의3 제7항)', { size: 11.5, bold: true, color: '#0F172A', before: 10, after: 4 }));
    blocks.push({
      type: 'table',
      widthRatio: 1,
      colWidths: [100],
      rows: [[
        tCell([
          pBlock('• 본인은 직장 내 괴롭힘·성희롱 사안 조사 참여자로서 조사 과정에서 알게 된 사건 내용·질문·타인의 진술·개인정보 등 일체의 비밀을 정당한 이유 없이 누설하지 않을 것을 서약하며, 신고인·참고인에 대한 일체의 불이익 처우 및 2차 가해가 법령상 엄격히 금지됨을 안내받았습니다.', { size: 9.5, after: 2 }),
          pBlock('• 서약 확인 상태: ' + (iv.pledgeSigned ? '☑ 비밀유지서약 동의 및 징구 완료' : '☐ 서약 확인 대기'), { size: 9.8, bold: true, color: iv.pledgeSigned ? '#166534' : '#475569' })
        ], { bg: '#F8FAFC' })
      ]]
    });

    /* 3. 녹취·면담 문답(Q&A) 조서 (서식 스타일별 렌더링 · 왕복 파서 호환 유지) */
    blocks.push(pBlock('3. 면담 문답(Q&A) 정리 내역', { size: 11.5, bold: true, color: '#0F172A', before: 10, after: 4 }));
    if (qaList.length) {
      if (styleId === 'legal_record') {
        /* 법무·조서형 연속 문답 블록 (【문1】 / 【답1】 — tryParseStructuredInterviewText 완벽 왕복 호환) */
        var recordBlocks = [];
        qaList.forEach(function (qa, idx) {
          recordBlocks.push(pBlock('【문' + (idx + 1) + '】 ' + (str(qa.q) || '진술 사항 확인'), { size: 10, bold: true, color: '#1E293B', before: idx === 0 ? 0 : 6, after: 2 }));
          recordBlocks.push(pBlock('【답' + (idx + 1) + '】 ' + (str(qa.a) || '-'), { size: 10, color: '#0F172A', after: 3 }));
        });
        blocks.push({
          type: 'table',
          widthRatio: 1,
          colWidths: [100],
          rows: [[tCell(recordBlocks, { valign: 'top' })]]
        });
      } else {
        var qaRows = [[
          tCell('순번', { bg: '#EFF6FF', bold: true, align: 'center' }),
          tCell(styleId === 'moel_sheet' ? '확인 항목 · 질문 (육하원칙)' : '질문 요지 (조사역)', { bg: '#EFF6FF', bold: true, align: 'center' }),
          tCell(styleId === 'moel_sheet' ? '면담 진술 기록' : '진술 답변 (진술인)', { bg: '#EFF6FF', bold: true, align: 'center' })
        ]];
        qaList.forEach(function (qa, idx) {
          qaRows.push([
            tCell(String(idx + 1), { align: 'center', valign: 'top', bold: true }),
            tCell(str(qa.q) || '-', { valign: 'top' }),
            tCell(str(qa.a) || '-', { valign: 'top' })
          ]);
        });
        blocks.push({
          type: 'table',
          widthRatio: 1,
          colWidths: [10, 34, 56],
          rows: qaRows
        });
      }
    } else {
      blocks.push(pBlock('(개별 문답 항목 없이 아래 진술 핵심 요지로 갈음함)', { size: 9.5, color: '#64748B' }));
    }

    /* 4. 진술 핵심 요지 */
    blocks.push(pBlock('4. 진술 핵심 요지', { size: 11.5, bold: true, before: 10, after: 4 }));
    blocks.push({
      type: 'table',
      widthRatio: 1,
      colWidths: [100],
      rows: [[tCell(str(iv.summary) || '(진술 요지 미입력)', { valign: 'top' })]]
    });

    /* 5. 진술인 정정·보완 의견 */
    blocks.push(pBlock('5. 진술인 열람 후 정정·보완 의견', { size: 11.5, bold: true, before: 10, after: 4 }));
    blocks.push({
      type: 'table',
      widthRatio: 1,
      colWidths: [100],
      rows: [[tCell(str(iv.amendNote) || '별도 정정·보완 의견 없음 (위 정리 내용이 본인의 진술 취지와 상위 없음을 확인함)', { valign: 'top' })]]
    });

    /* 6. 전자서명 및 무결성 봉인 표 */
    blocks.push(pBlock('6. 진술 확인 및 서명', { size: 11.5, bold: true, before: 10, after: 4 }));
    var sigImg = dataUrlToPngBytes(iv.sigDataUrl);
    var sigCellBlocks = [];
    if (sigImg) {
      sigCellBlocks.push({
        type: 'p',
        align: 'center',
        lineSpacing: 130,
        runs: [{ image: { mime: sigImg.mime, data: sigImg.data, w: 40, h: 14 }, style: { font: FONT, size: 9.5 } }]
      });
    }
    sigCellBlocks.push(pBlock(
      iv.stmtSigned ? ('전자서명 완료 (' + (str(iv.signedAtText) || '확인됨') + ')') : '(서명란:                  (인/서명))',
      { align: 'center', size: 9.5, bold: !!iv.stmtSigned }
    ));

    blocks.push({
      type: 'table',
      widthRatio: 1,
      colWidths: [20, 35, 45],
      rows: [
        [
          tCell('확인 진술인', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell((str(iv.alias) || roleKr) + (iv.signMode === 'onsite' ? ' (현장 대면 서명)' : iv.stmtSigned ? ' (모바일 본인인증 서명)' : ''), { align: 'center' }),
          tCell(sigCellBlocks, { align: 'center' })
        ],
        [
          tCell('문서 무결성 지문', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(iv.docHash ? ('SHA-256: ' + str(iv.docHash)) : '서명 전 초안 문서', { colSpan: 2, size: 8.8, color: '#475569' })
        ]
      ]
    });

    return Hx.buildHwpx({ page: Hx.defaultPage(), pageNum: { pos: 'BOTTOM_CENTER', dash: true }, blocks: blocks });
  }

  /* ② 최종 직장 내 괴롭힘·성희롱 조사결과보고서·법률의견서 정식 .hwpx 생성 (6대 마스터 양식 · 실명 원본 · 비식별 익명본 겸용) */
  function buildReportHwpx(caseRec, secRec, opts) {
    var Hx = ensureHwpxBuilder();
    var o = opts || {};
    var pkg = (o.anonymized && C && typeof C.anonymizeReportPackage === 'function')
      ? C.anonymizeReportPackage(caseRec, secRec, o)
      : { caseRec: caseRec || {}, secretRec: secRec || {} };
    var c = pkg.caseRec || {};
    var sec = pkg.secretRec || {};
    var tplId = (C && typeof C.normalizeTemplateId === 'function')
      ? C.normalizeTemplateId(o.reportTemplate || c.reportTemplate || sec.reportTemplate)
      : 'laborfirm_deep';
    var tpl = (C && C.REPORT_TEMPLATES && C.REPORT_TEMPLATES[tplId]) || {
      id: 'laborfirm_deep',
      name: '전문 노무법인 심층 사실조사 표준형',
      docClassBadge: '대외비 · 외부독립조사 보고서',
      docTitleSuffix: '사안 외부전문가 조사결과보고서'
    };
    var tm = (sec.templateMeta && typeof sec.templateMeta === 'object' && sec.templateMeta[tplId] && typeof sec.templateMeta[tplId] === 'object')
      ? sec.templateMeta[tplId]
      : ((sec.templateMeta && typeof sec.templateMeta === 'object') ? sec.templateMeta : {});
    var cat = (C && C.CATEGORIES && C.CATEGORIES[c.category]) || { label: '직장 내 괴롭힘' };
    var subMeta = (C && C.CASE_SUBTYPES && C.CASE_SUBTYPES[str(c.caseSubType)]) || { label: '' };
    var caseSchema = (C && typeof C.getLegalSchema === 'function') ? C.getLegalSchema(c) : {
      shortTitle: '근로기준법 3요건',
      lawBasis: '근로기준법 제76조의2·제76조의3',
      e1: { chip: '① 우위성' },
      e2: { chip: '② 적정범위 초과' },
      e3: { chip: '③ 고통·환경악화' }
    };
    var verdict = (C && C.VERDICTS && C.VERDICTS[str(c.verdictSummary)]) || { label: '조사·검토 진행 중' };
    var interviews = Array.isArray(sec.interviews) ? sec.interviews.filter(function (x) { return x && !x._deleted; }) : [];
    var issues = Array.isArray(sec.issues) ? sec.issues.filter(function (x) { return x && !x._deleted; }) : [];
    var evidences = (C && typeof C.renumberEvidences === 'function') ? C.renumberEvidences(sec.evidences || []) : [];
    var surveyStats = (C && typeof C.aggregateSurveyResponses === 'function' && Array.isArray(sec.surveyResponses) && sec.surveyResponses.length)
      ? C.aggregateSurveyResponses(sec.surveyResponses)
      : null;

    var blocks = [];
    var mainTitle = cat.label + ' ' + tpl.docTitleSuffix + (o.anonymized ? ' (비식별 익명본)' : '');
    var docRefTxt = o.anonymized
      ? '비식별 심의·열람본'
      : (mask(str(tm.docRefNo || tm.agendaNo || c.erpCaseNo || c.caseNo)) || '인사기밀 · 외부조사');
    blocks.push(docTopBannerTable(
      tpl.docClassBadge + (o.anonymized ? ' · 개인정보 비식별 처리본' : ''),
      mainTitle,
      '적용 양식: ' + tpl.name + ' · 수행기관: 푸른노무법인 · 근거법령: ' + caseSchema.lawBasis,
      docRefTxt
    ));
    blocks.push(pBlock('', { size: 4, after: 4 }));

    /* 양식별 상단 Executive / 심의주문 / 경영진 요약 특화 표 */
    if (tplId === 'lawfirm_opinion') {
      var riskLbl = str(tm.litigationRisk) === 'high' ? '주의 (분쟁·부당징계 리스크 높음)' : str(tm.litigationRisk) === 'mid' ? '보통 (절차·양정 비례성 유의)' : '안정 (객관 물증·절차 확보)';
      blocks.push(pBlock('▣ 법률검토 Executive Summary (결론 선제시)', { size: 11.5, bold: true, color: '#1E40AF', before: 2, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 78],
        rows: [
          [tCell('검토 질의 요지', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(mask(str(tm.querySummary)) || (cat.label + ' 성립 여부 및 인사조치 적정성에 관한 법률 검토'))],
          [tCell('핵심 법률의견', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(mask(str(tm.execSummary || sec.conclusion)) || verdict.label, { bold: true, color: '#0F172A' })],
          [tCell('소송·분쟁 리스크', { bg: '#F8FAFC', bold: true, align: 'center' }), tCell(riskLbl)]
        ]
      });
    } else if (tplId === 'corp_executive') {
      var sevTxt = str(tm.severityGrade) === 'S' ? 'S등급 (Critical — 중대 비위)' : str(tm.severityGrade) === 'B' ? 'B등급 (Medium — 주의·경고)' : str(tm.severityGrade) === 'C' ? 'C등급 (Low — 불인정·종결)' : 'A등급 (High — 법 위반 인정)';
      var lRisk = str(tm.riskLegal) === 'red' ? '고위험(적색)' : str(tm.riskLegal) === 'amber' ? '주의(황색)' : '안정(녹색)';
      var rRisk = str(tm.riskRep) === 'red' ? '고위험(적색)' : str(tm.riskRep) === 'green' ? '안정(녹색)' : '주의(황색)';
      blocks.push(pBlock('▣ Executive Brief — 경영진 의사결정 대시보드', { size: 11.5, bold: true, color: '#1E40AF', before: 2, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('사안 심각도 등급', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(sevTxt, { bold: true, color: '#991B1B' }), tCell('최종 판정 결론', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(verdict.label, { bold: true, color: '#1E40AF' })],
          [tCell('법규·노동청 리스크', { bg: '#F8FAFC', bold: true, align: 'center' }), tCell(lRisk), tCell('평판·조직 리스크', { bg: '#F8FAFC', bold: true, align: 'center' }), tCell(rRisk)],
          [tCell('경영진 3줄 핵심요약', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(mask(str(tm.execKeyPoints || sec.conclusion || sec.overview)) || verdict.label, { colSpan: 3 })]
        ]
      });
    } else if (tplId === 'public_committee') {
      var ordMap = { uphold: '인용 (괴롭힘·성희롱 해당 — 가결)', partial: '일부 인용 (일부 쟁점 해당)', dismiss: '기각 (해당 없음)', reject: '각하 (심의요건 불비·취하)' };
      blocks.push(pBlock('▣ 고충심의위원회 부의안건 및 의결 주문 표지', { size: 11.5, bold: true, color: '#1E40AF', before: 2, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 28, 22, 28],
        rows: [
          [tCell('부의 안건번호', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(mask(str(tm.agendaNo)) || '-'), tCell('외부위원·제척 확인', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(mask(str(tm.committeeQuorum)) || (c.fairnessChecked ? '제척사유 없음 확인필' : '외부위원 참여'))],
          [tCell('의결 주문(안)', { bg: '#F8FAFC', bold: true, align: 'center' }), tCell(ordMap[str(tm.resolutionOrder)] || verdict.label, { colSpan: 3, bold: true, color: '#1E40AF' })]
        ]
      });
    } else if (tplId === 'nlrb_defense') {
      blocks.push(pBlock('▣ 노동위원회·소송 방어용 징계정당성 3단 입증 요약', { size: 11.5, bold: true, color: '#1E40AF', before: 2, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [24, 76],
        rows: [
          [tCell('① 징계사유 (사실인정)', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(verdict.label + ' (전체 쟁점 ' + issues.length + '건 · 객관 호증 ' + evidences.length + '건 매핑)')],
          [tCell('② 징계절차 (방어권 보장)', { bg: '#F8FAFC', bold: true, align: 'center' }), tCell(mask(str(tm.dueProcessNote)) || '외부전문가 공정조사 · 피신고인 소명기회 부여 및 진술서명 확인')],
          [tCell('③ 징계양정 (비례·형평성)', { bg: '#F8FAFC', bold: true, align: 'center' }), tCell(mask(str(tm.equityNote || sec.recommendations)) || '비위 정도·반복성·2차가해 유무 및 동종 사례 형평성 종합 참작')]
        ]
      });
    }

    /* 1. 사건 개요 표 */
    blocks.push(pBlock('1. 사건 개요', { size: 12, bold: true, color: '#0F172A', before: 8, after: 4 }));
    var effDue = (C && typeof C.effectiveDueDateOf === 'function') ? C.effectiveDueDateOf(c) : str(c.dueDate);
    var catCellTxt = cat.label + (str(c.caseSubType) && subMeta.label ? ' (' + subMeta.label + ')' : '');
    var metaRows = [
      [
        tCell('의뢰 사업장', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell(mask(str(c.companyName)) || '(미입력)'),
        tCell('조사 구분', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell(catCellTxt)
      ],
      [
        tCell('사건명', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell(mask(str(c.title)) || (cat.label + ' 조사 건'), { colSpan: 3 })
      ],
      [
        tCell('조사 착수일', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell(str(c.receiveDate) || '-'),
        tCell('보고·종결일', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell(str(c.closeDate) || effDue || '진행 중')
      ]
    ];
    if (str(tm.investTeam) || str(tm.intakeRoute)) {
      metaRows.push([
        tCell(tplId === 'moel_standard' ? '인지·접수 경로' : '조사단 · 조사방식', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell(mask(str(tm.intakeRoute || tm.investTeam)), { colSpan: 3 })
      ]);
    }
    if (str(c.laborOffice) || str(c.govCaseNo)) {
      metaRows.push([
        tCell('관할 노동관서', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell(mask([str(c.laborOffice), str(c.inspectorName) ? ('담당 ' + str(c.inspectorName)) : ''].filter(Boolean).join(' · ')) || '-'),
        tCell('행정 사건번호', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell(mask(str(c.govCaseNo)) || '-')
      ]);
    }
    metaRows.push([
      tCell('종합 판단 요약', { bg: '#EFF6FF', bold: true, align: 'center' }),
      tCell(verdict.label, { colSpan: 3, bold: true, color: '#1E40AF' })
    ]);
    blocks.push({ type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30], rows: metaRows });

    /* 2. 당사자·참고인 면담 및 서명 현황 표 */
    blocks.push(pBlock('2. 당사자 및 참고인 면담 진술 요약', { size: 12, bold: true, before: 10, after: 4 }));
    if (interviews.length) {
      var ivRows = [[
        tCell('구분', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell('성명·호칭', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell('면담일·서명확인', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell('핵심 진술 요지 및 정정의견', { bg: '#F1F5F9', bold: true, align: 'center' })
      ]];
      interviews.forEach(function (iv) {
        var rKr = iv.role === 'accused' ? '피신고인' : iv.role === 'witness' ? '참고인' : '신고인';
        var signTxt = (str(iv.date) || '-') + '\n' + (iv.stmtSigned ? '✓ 진술서명 완료' : (iv.pledgeSigned ? '✓ 비밀서약 완료' : '서명 전'));
        var sumTxt = mask(str(iv.summary)) || '-';
        if (str(iv.amendNote)) sumTxt += '\n[정정·보완 의견] ' + mask(str(iv.amendNote));
        ivRows.push([
          tCell(rKr, { align: 'center', valign: 'top' }),
          tCell(mask(str(iv.alias) || '-') + (str(iv.dept) ? '\n(' + mask(str(iv.dept)) + ')' : ''), { align: 'center', valign: 'top' }),
          tCell(signTxt, { align: 'center', valign: 'top', size: 9 }),
          tCell(sumTxt, { valign: 'top' })
        ]);
      });
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [13, 18, 21, 48], rows: ivRows });
    } else {
      blocks.push(pBlock('등록된 면담 진술 기록이 없습니다.', { size: 9.8, color: '#64748B' }));
    }

    /* 2-2. 제출 호증 편철 목록 표 (등록된 호증이 있을 때 자동 수록) */
    if (evidences.length) {
      blocks.push(pBlock('2-2. 제출 증거·호증 편철 목록', { size: 11.5, bold: true, before: 10, after: 4 }));
      var evRows = [[
        tCell('호증 번호', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell('일자', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell('제출 구분', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell('증거 명칭 및 입증 취지', { bg: '#F1F5F9', bold: true, align: 'center' })
      ]];
      evidences.forEach(function (ev) {
        evRows.push([
          tCell(ev.exhibitNo, { align: 'center', bold: true }),
          tCell(str(ev.date) || '-', { align: 'center' }),
          tCell(mask(str(ev.submitter)) || '-', { align: 'center' }),
          tCell(mask(ev.title + (ev.summary ? ' — ' + ev.summary : '')), { valign: 'top' })
        ]);
      });
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [18, 15, 17, 50], rows: evRows });
    }

    /* 2-3. 부서·조직 무기명 실태조사 설문 집계표 (설문 응답이 있을 때 자동 수록) */
    if (surveyStats && surveyStats.total > 0) {
      blocks.push(pBlock('2-3. 부서·조직 무기명 실태조사 설문 집계 (응답 ' + surveyStats.total + '명)', { size: 11.5, bold: true, before: 10, after: 4 }));
      var svRows = [[
        tCell('문항', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('설문 항목 요지', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('주의·반복 응답률', { bg: '#EFF6FF', bold: true, align: 'center' })
      ]];
      surveyStats.items.forEach(function (it, qi) {
        svRows.push([
          tCell(String(qi + 1), { align: 'center' }),
          tCell(it.q, { valign: 'top' }),
          tCell(it.highRiskCnt + '명 (' + it.highRiskPct + '%)', { align: 'center', bold: it.highRiskPct >= 30, color: it.highRiskPct >= 30 ? '#991B1B' : '#1E293B' })
        ]);
      });
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [10, 68, 22], rows: svRows });
    }

    /* 3. 쟁점 행위별 법정 성립요건 검토 요약 표 (괴롭힘 / 성희롱 / 복합 / 제3자 자동 분기) */
    var sec3Heading = c.category === 'both'
      ? '3. 쟁점 행위별 법정 성립요건(근로기준법 · 남녀고용평등법) 검토 요약'
      : ('3. 쟁점 행위별 ' + caseSchema.shortTitle + ' 검토 요약');
    blocks.push(pBlock(sec3Heading, { size: 12, bold: true, before: 10, after: 4 }));
    if (issues.length) {
      var yn = { yes: '충족', no: '미충족', hold: '검토중' };
      var res = { yes: '인정(해당)', no: '불인정(비해당)', hold: '판단보류' };
      var hE1 = c.category === 'both' ? '① 우위·업무관련' : caseSchema.e1.chip;
      var hE2 = c.category === 'both' ? '② 적정초과·성적언동' : caseSchema.e2.chip;
      var hE3 = c.category === 'both' ? '③ 환경악화·굴욕감' : caseSchema.e3.chip;
      var issRows = [[
        tCell('쟁점 행위 (일시·장소)', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell(hE1, { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell(hE2, { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell(hE3, { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('판정 결과', { bg: '#EFF6FF', bold: true, align: 'center' })
      ]];
      issues.forEach(function (iss, idx) {
        var vCode = str(iss.verdict) || (C && C.judgeIssue ? C.judgeIssue(iss) : 'hold');
        var issLaw = (C && C.inferIssueLawType) ? C.inferIssueLawType(iss, c) : 'harass';
        var lawTag = c.category === 'both' ? (issLaw === 'sexual' ? '[성희롱] ' : '[괴롭힘] ') : '';
        var titleTxt = '[' + (idx + 1) + '] ' + lawTag + (mask(str(iss.title)) || '쟁점') + (str(iss.whenWhere) ? '\n(' + mask(str(iss.whenWhere)) + ')' : '');
        issRows.push([
          tCell(titleTxt, { valign: 'top' }),
          tCell(yn[iss.elemSuperiority] || '검토중', { align: 'center' }),
          tCell(yn[iss.elemBeyondScope] || '검토중', { align: 'center' }),
          tCell(yn[iss.elemHarm] || '검토중', { align: 'center' }),
          tCell(res[vCode] || '검토중', { align: 'center', bold: true, color: vCode === 'yes' ? '#991B1B' : vCode === 'no' ? '#166534' : '#854D0E' })
        ]);
      });
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [40, 15, 16, 15, 14], rows: issRows });
    } else {
      blocks.push(pBlock('등록된 개별 쟁점 행위가 없습니다.', { size: 9.8, color: '#64748B' }));
    }

    /* 3-2. 진술 신빙성 5대 지표 평가표 (법무법인형·소송방어형 또는 신빙성 평가 데이터가 있을 때 수록) */
    var hasAnyCred = issues.some(function (iss) {
      return C && typeof C.evaluateIssueCredibility === 'function' && (C.evaluateIssueCredibility(iss).hasExplicit || str(iss.credibilityNote));
    });
    if (issues.length && (tplId === 'lawfirm_opinion' || tplId === 'nlrb_defense' || hasAnyCred) && C && typeof C.evaluateIssueCredibility === 'function') {
      blocks.push(pBlock('3-2. 대법원 판례 기준 진술 신빙성(Credibility) 5대 지표 평가표', { size: 11.5, bold: true, color: '#0F172A', before: 10, after: 4 }));
      var credRows = [[
        tCell('쟁점 행위', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('신빙성 종합', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('충족 지표 (일관·구체·합리·무고부재·물증부합)', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('신빙성 판단 근거', { bg: '#EFF6FF', bold: true, align: 'center' })
      ]];
      issues.forEach(function (iss, idx) {
        var cr = C.evaluateIssueCredibility(iss);
        credRows.push([
          tCell('[' + (idx + 1) + '] ' + (mask(str(iss.title)) || '쟁점'), { valign: 'top' }),
          tCell(cr.level, { align: 'center', bold: true, color: cr.count >= 4 ? '#166534' : cr.count >= 2 ? '#1E40AF' : '#475569' }),
          tCell(cr.checkedLabels.length ? cr.checkedLabels.join(' · ') : '(개별 체크 전)', { align: 'center' }),
          tCell(mask(cr.note || str(iss.evidenceNote)) || '-', { valign: 'top' })
        ]);
      });
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [28, 18, 26, 28], rows: credRows });
    }

    /* 3-3. 고용노동부 매뉴얼 법정의무 6대 점검표 (moel_standard 양식 선택 시 수록) */
    if (tplId === 'moel_standard' && C && Array.isArray(C.MOEL_OBLIGATION_CHECKS)) {
      blocks.push(pBlock('3-3. 근로기준법 제76조의3 · 남녀고용평등법 제14조 법정의무 이행 점검표', { size: 11.5, bold: true, color: '#0F172A', before: 10, after: 4 }));
      var mcObj = (tm.moelChecks && typeof tm.moelChecks === 'object') ? tm.moelChecks : {};
      var stepsObj = (c.steps && typeof c.steps === 'object') ? c.steps : {};
      var moelRows = [[
        tCell('법정의무 점검 항목', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('이행 확인', { bg: '#EFF6FF', bold: true, align: 'center' })
      ]];
      C.MOEL_OBLIGATION_CHECKS.forEach(function (chk) {
        var isOk = (typeof C.isMoelObligationMet === 'function')
          ? C.isMoelObligationMet(chk.key, c, sec, tm)
          : (mcObj[chk.key] !== undefined ? !!mcObj[chk.key] : false);
        moelRows.push([
          tCell(chk.label, { valign: 'top' }),
          tCell(isOk ? '☑ 이행 완료' : '☐ 점검·이행 예정', { align: 'center', bold: isOk, color: isOk ? '#166534' : '#92400E' })
        ]);
      });
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [76, 24], rows: moelRows });
    }

    /* 4. 조사결과보고서 상세 본문 (주의: '4. 상세 사실인정 및 종합 판단 본문' 표지는 왕복 추출기 기준점임) */
    blocks.push(pBlock('4. 상세 사실인정 및 종합 판단 본문', { size: 12, bold: true, color: '#0F172A', before: 10, after: 4 }));
    var bodyText = mask(str(sec.reportBody)) || (C && C.assembleReportDraft ? C.assembleReportDraft(c, sec, tplId) : '');
    multiLineBlocks(bodyText, { size: 10.2, lineSpacing: 165, after: 3 }).forEach(function (b) {
      blocks.push(b);
    });

    /* 공공기관 고충심의위 양식 선택 시 말미 심의위원 서명 확인 표 자동 첨부 */
    if (tplId === 'public_committee' && !o.anonymized) {
      blocks.push(pBlock('5. 고충심의위원회 심의위원 확인 서명란', { size: 11.5, bold: true, color: '#0F172A', before: 12, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 25, 25],
        rows: [
          [tCell('구분', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('소속 · 직위', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('성명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('서명 / 날인', { bg: '#F1F5F9', bold: true, align: 'center' })],
          [tCell('위원장', { align: 'center', bold: true }), tCell(''), tCell(''), tCell('(서명)', { align: 'right', color: '#64748B' })],
          [tCell('외부위원', { align: 'center' }), tCell('푸른노무법인'), tCell(''), tCell('(서명)', { align: 'right', color: '#64748B' })],
          [tCell('내부위원', { align: 'center' }), tCell(''), tCell(''), tCell('(서명)', { align: 'right', color: '#64748B' })]
        ]
      });
    }

    return Hx.buildHwpx({ page: Hx.defaultPage(), pageNum: { pos: 'BOTTOM_CENTER', dash: true }, blocks: blocks });
  }

  /* ②-2 제출 호증 편철 목록 및 일자별 주장·증거 타임라인 대조표 단독 .hwpx 생성 */
  function buildEvidenceTimelineHwpx(caseRec, secRec) {
    var Hx = ensureHwpxBuilder();
    var c = caseRec || {};
    var sec = secRec || {};
    var cat = (C && C.CATEGORIES && C.CATEGORIES[c.category]) || { label: '직장 내 괴롭힘' };
    var evs = (C && typeof C.renumberEvidences === 'function') ? C.renumberEvidences(sec.evidences || []) : [];
    var tlRows = (C && typeof C.buildCaseTimelineRows === 'function') ? C.buildCaseTimelineRows(c, sec) : [];

    var blocks = [];
    blocks.push(pBlock(cat.label + ' 사건 호증 편철 목록 및 일자별 타임라인 대조표', { align: 'center', size: 16, bold: true, after: 6 }));
    blocks.push(pBlock('의뢰 사업장: ' + (mask(str(c.companyName)) || '-') + ' · 사건명: ' + (mask(str(c.title)) || '-') + ' · 푸른노무법인', { align: 'center', size: 9.5, color: '#475569', after: 10 }));

    blocks.push(pBlock('1. 제출 증거 · 호증 편철 목록 (갑호증 · 을호증 · 참고자료)', { size: 11.5, bold: true, before: 4, after: 4 }));
    if (evs.length) {
      var evTbl = [[
        tCell('호증 번호', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('작성·수집일', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('제출인', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('증거 명칭', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('입증 취지 · 핵심 요지', { bg: '#EFF6FF', bold: true, align: 'center' })
      ]];
      evs.forEach(function (ev) {
        evTbl.push([
          tCell(ev.exhibitNo, { align: 'center', bold: true }),
          tCell(str(ev.date) || '-', { align: 'center' }),
          tCell(mask(str(ev.submitter)) || '-', { align: 'center' }),
          tCell(mask(str(ev.title)), { valign: 'top' }),
          tCell(mask(str(ev.summary) || '-'), { valign: 'top' })
        ]);
      });
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [16, 14, 15, 25, 30], rows: evTbl });
    } else {
      blocks.push(pBlock('등록된 호증 항목이 없습니다.', { size: 9.5, color: '#64748B' }));
    }

    blocks.push(pBlock('2. 일자별 양측 주장 및 객관적 증거 타임라인 대조표', { size: 11.5, bold: true, before: 12, after: 4 }));
    if (tlRows.length) {
      var tlTbl = [[
        tCell('일자·시점', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell('구분·쟁점', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell('신고인 측 주장·자료', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell('피신고인 측 소명·자료', { bg: '#F1F5F9', bold: true, align: 'center' }),
        tCell('객관적 확인 사실', { bg: '#F1F5F9', bold: true, align: 'center' })
      ]];
      tlRows.forEach(function (r) {
        tlTbl.push([
          tCell(mask(str(r.date)), { align: 'center', valign: 'top', size: 9 }),
          tCell(mask(str(r.kind) + '\n' + str(r.title)), { valign: 'top', bold: true, size: 9.2 }),
          tCell(mask(str(r.victimSide)), { valign: 'top', size: 9.2 }),
          tCell(mask(str(r.accusedSide)), { valign: 'top', size: 9.2 }),
          tCell(mask(str(r.objectiveFact)), { valign: 'top', size: 9.2 })
        ]);
      });
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [14, 18, 23, 23, 22], rows: tlTbl });
    } else {
      blocks.push(pBlock('대조할 쟁점·면담·호증 데이터가 없습니다.', { size: 9.5, color: '#64748B' }));
    }

    return Hx.buildHwpx({ page: Hx.defaultPage(), pageNum: { pos: 'BOTTOM_CENTER', dash: true }, blocks: blocks });
  }

  /* 조사 전 과정 실무 필수 공문·서식 14종 정의 */
  var OFFICIAL_DOC_TYPES = {
    intake_form: {
      code: 'intake_form',
      label: '직장 내 괴롭힘·성희롱 신고서 및 기초 사실확인 설문지',
      short: '신고서·기초설문지',
      stepCode: 'intake',
      docRole: 'victim_stmt'
    },
    committee_fairness: {
      code: 'committee_fairness',
      label: '외부 조사위원 위촉장 및 공정조사(제척·기피·회피) 확인서',
      short: '조사위원위촉·제척확인서',
      stepCode: 'plan',
      docRole: 'official_plan'
    },
    privacy_consent: {
      code: 'privacy_consent',
      label: '개인정보·민감정보 수집·이용 및 제3자 제공 동의서',
      short: '개인정보·민감정보 동의서',
      stepCode: 'pledge',
      docRole: 'pledge_protect'
    },
    plan_req: {
      code: 'plan_req',
      label: '조사계획서 및 기초자료 제출·협조 요청 공문',
      short: '조사계획·자료요청 공문',
      stepCode: 'plan',
      docRole: 'official_plan'
    },
    pledge_form: {
      code: 'pledge_form',
      label: '조사 참여자 비밀유지서약서 (현장 출력·자필서명용)',
      short: '비밀유지서약서 양식',
      stepCode: 'pledge',
      docRole: 'pledge_protect'
    },
    attend_notice: {
      code: 'attend_notice',
      label: '당사자·참고인 조사 출석 및 면담 안내문',
      short: '출석·면담 안내문',
      stepCode: 'victim',
      docRole: 'victim_stmt'
    },
    written_inquiry: {
      code: 'written_inquiry',
      label: '피신고인 소명 안내 및 쟁점별 사전 서면질문지(답변서)',
      short: '피신고인 서면질문지',
      stepCode: 'accused',
      docRole: 'accused_stmt'
    },
    labor_ext_req: {
      code: 'labor_ext_req',
      label: '관할 노동지청 조사결과 보고기한 연장 신청 공문',
      short: '노동청 기한연장 신청공문',
      stepCode: 'plan',
      docRole: 'official_plan'
    },
    withdrawal_settle: {
      code: 'withdrawal_settle',
      label: '신고 취하서 · 정식조사 종료 동의서 · 당사자 합의서',
      short: '취하·조사종료·합의서',
      stepCode: 'report',
      docRole: 'final_report'
    },
    victim_opinion_form: {
      code: 'victim_opinion_form',
      label: '피해근로자 보호 및 행위자 조치 관련 사전 의견청취서',
      short: '피해자 사전의견청취서',
      stepCode: 'review',
      docRole: 'pledge_protect'
    },
    party_result_notice: {
      code: 'party_result_notice',
      label: '당사자용 조사결과 통지문 (비공개 요약본)',
      short: '당사자 조사결과 통지문',
      stepCode: 'report',
      docRole: 'final_report'
    },
    measure_rec: {
      code: 'measure_rec',
      label: '피해근로자 보호조치 및 사후 조치 권고 공문',
      short: '보호·후속조치 권고공문',
      stepCode: 'report',
      docRole: 'final_report'
    },
    labor_result_rpt: {
      code: 'labor_result_rpt',
      label: '고용노동부 개선지도(시정지시) 조치결과 보고 공문',
      short: '노동청 개선지도 결과보고',
      stepCode: 'report',
      docRole: 'final_report'
    },
    disciplinary_pack: {
      code: 'disciplinary_pack',
      label: '인사(징계)위원회 출석통지서 · 의결서 · 징계처분통지서',
      short: '인사위 출석·의결·처분통지서',
      stepCode: 'report',
      docRole: 'final_report'
    },
    counsel_log: {
      code: 'counsel_log',
      label: '초기 고충 상담일지 및 잠정 보호·분리 검토서 (노동부 매뉴얼 별지)',
      short: '초기고충 상담일지',
      stepCode: 'intake',
      docRole: 'intake'
    },
    investigator_oath: {
      code: 'investigator_oath',
      label: '조사위원(내·외부 공동조사단) 비밀엄수 및 공정조사 서약서',
      short: '조사위원 비밀·공정서약서',
      stepCode: 'plan',
      docRole: 'pledge_protect'
    },
    separation_order: {
      code: 'separation_order',
      label: '조사기간 중 잠정 분리·보호조치(공간분리·유급휴가·재택) 인사명령서',
      short: '잠정 분리·보호조치 명령서',
      stepCode: 'pledge',
      docRole: 'pledge_protect'
    },
    evidence_receipt: {
      code: 'evidence_receipt',
      label: '증거자료(녹음·메신저·물증) 제출 목록 및 원본대조 확인서',
      short: '증거제출·원본대조 확인서',
      stepCode: 'witness',
      docRole: 'witness_evid'
    },
    legal_opinion_short: {
      code: 'legal_opinion_short',
      label: '단독 법률검토의견서 (징계양정 적정성 · 법적 리스크 자문서)',
      short: '단독 법률검토의견서',
      stepCode: 'review',
      docRole: 'final_report'
    },
    committee_minutes: {
      code: 'committee_minutes',
      label: '고충심의위원회(인사위원회) 심의 회의록 및 의결서 표준양식',
      short: '고충심의위 회의록·의결서',
      stepCode: 'report',
      docRole: 'final_report'
    }
  };

  /* ③ 조사 단계별 실무 필수 공문·서식 14종 정식 .hwpx 생성 */
  function buildOfficialDocHwpx(docType, caseRec, opts) {
    var Hx = ensureHwpxBuilder();
    var c = caseRec || {};
    var o = opts || {};
    var kind = OFFICIAL_DOC_TYPES[docType] ? docType : 'plan_req';
    var cat = (C && C.CATEGORIES && C.CATEGORIES[c.category]) || { label: '직장 내 괴롭힘' };
    var lawBasis = str(c.caseSubType) === 'third_party'
      ? '산업안전보건법 제41조 및 남녀고용평등법 제14조의2'
      : c.category === 'sexual'
        ? '남녀고용평등과 일·가정 양립 지원에 관한 법률 제14조'
        : c.category === 'both'
          ? '근로기준법 제76조의2·제76조의3 및 남녀고용평등법 제14조'
          : '근로기준법 제76조의2 및 제76조의3';
    var coName = mask(str(o.companyName || c.companyName)) || '(의뢰 사업장)';
    var caseTitle = mask(str(o.caseTitle || c.title)) || (cat.label + ' 사안 외부전문가 조사');
    var issueDate = mask(str(o.issueDate)) || (C && C.ymdOf ? C.ymdOf(Date.now()) : '');
    var mgrLabel = mask(str(o.managerText)) || '담당 공인노무사';
    var customNote = mask(str(o.customBody || o.extraNote));
    var targetName = mask(str(o.targetName));
    var targetDept = mask(str(o.targetDept));
    var laborOffice = mask(str(o.laborOffice || c.laborOffice)) || '관할 지방고용노동관서';
    var inspectorName = mask(str(o.inspectorName || c.inspectorName)) || '담당 근로감독관';
    var govCaseNo = mask(str(o.govCaseNo || c.govCaseNo)) || '(진정·개선지도 사건번호)';
    var vObj = (C && C.VERDICTS && C.VERDICTS[str(c.verdictSummary)]) || { label: '조사·검토 진행 중' };
    var blocks = [];

    if (kind === 'intake_form') {
      blocks.push(pBlock(cat.label + ' 고충 신고서 및 기초 사실확인 설문지', { align: 'center', size: 16, bold: true, after: 6 }));
      blocks.push(pBlock('접수·조사기관: ' + coName + ' / 푸른노무법인 · 비밀엄수 (' + lawBasis + ')', { align: 'center', size: 9.5, color: '#991B1B', bold: true, after: 10 }));
      blocks.push(pBlock('1. 신고인 및 피신고인 인적사항', { size: 11.5, bold: true, before: 4, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('사업장명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName), tCell('신고 접수일', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate)],
          [tCell('신고인 성명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetName || ''), tCell('소속 / 직위', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetDept || '')],
          [tCell('피신고인(행위자)', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('(성명·직위·관계 기재)', { colSpan: 3 })],
          [tCell('사건 구분', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('☐ 직장 내 괴롭힘   ☐ 직장 내 성희롱   ☐ 복합 사안   ☐ 제3자 가해', { colSpan: 3 })]
        ]
      });
      blocks.push(pBlock('2. 피해 주장 행위 육하원칙 기재 (복수 행위 시 번호순 기재)', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 78],
        rows: [
          [tCell('발생 일시·기간', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('(예: 2026년 3월 초순경 ~ 현재, 주 2~3회 등 구체적 일시)')],
          [tCell('발생 장소·매체', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('(예: 사무실 자리, 회의실, 단체 메신저방, 통화 등)')],
          [tCell('구체적 행위 내용', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(customNote || '(피신고인의 구체적 언동·지시 내용, 전후 맥락, 업무상 적정범위 초과 사유 등을 상세히 기재해 주시기 바랍니다)\n\n\n')],
          [tCell('목격자(참고인)', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('(목격자 성명·부서 및 목격 경위)')],
          [tCell('보유 입증자료', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('☐ 녹음·녹취록  ☐ 메신저·문자  ☐ 이메일·공문  ☐ 업무일지  ☐ 진료기록·진단서  ☐ 기타(        )')]
        ]
      });
      blocks.push(pBlock('3. 희망 보호조치 및 처리 방향 의견', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 78],
        rows: [
          [tCell('조사 중 보호조치', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('☐ 근무장소·공간 분리  ☐ 부서 전환  ☐ 유급휴가·재택근무  ☐ 현상 유지(노출 최소화)  ☐ 기타')],
          [tCell('희망 처리절차', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('☐ 정식 사실조사 및 인사조치  ☐ 행위자 경고·사과·재발방지 약정  ☐ 분리배치 중심 조정')],
          [tCell('신고인 확인 서명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('위 기재 내용은 사실과 다름없으며 비밀유지 안내를 확인하였습니다.   성명: ' + (targetName || '            ') + '  (서명/인)', { align: 'right' })]
        ]
      });

    } else if (kind === 'committee_fairness') {
      blocks.push(pBlock('외부 독립 조사위원 위촉장 및 공정조사(제척·기피·회피) 확인서', { align: 'center', size: 15.5, bold: true, after: 6 }));
      blocks.push(pBlock('의뢰기관: ' + coName + ' · 수임기관: 푸른노무법인 (' + lawBasis + ')', { align: 'center', size: 9.5, color: '#475569', after: 10 }));
      blocks.push(pBlock('1. 외부 조사위원 위촉 내역', { size: 11.5, bold: true, before: 4, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('위촉 기관(사업장)', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName), tCell('위촉 일자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate)],
          [tCell('조사 대상 사건', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(caseTitle, { colSpan: 3 })],
          [tCell('위촉 외부전문가', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('푸른노무법인 ' + mgrLabel, { colSpan: 3, bold: true, color: '#1E40AF' })]
        ]
      });
      blocks.push(pBlock('2. 이해충돌 부존재(제척·기피·회피) 및 직무상 비밀엄수 서약', { size: 11.5, bold: true, before: 10, after: 4 }));
      var fairTxt = customNote || [
        '1. [제척·회피 사유 부존재 확인] 본 조사위원은 본 건의 신고인 또는 피신고인과 친족 관계, 개인적 이해관계, 직접적 자문·대리 이해충돌 관계에 있지 아니함을 확인하며, 조사 중 공정성을 해할 사유가 인지될 경우 즉시 회피하겠습니다.',
        '2. [객관·중립 조사 원칙] 양 당사자에게 동등한 진술 및 증거 제출 기회를 부여하고, 예단 없이 객관적 사실과 관련 법령에 입각하여 독립적으로 판단하겠습니다.',
        '3. [법정 비밀유지 서약] ' + lawBasis + '에 따라 조사 과정에서 지득한 일체의 개인정보 및 사건 비밀을 정당한 사유 없이 누설하지 않겠습니다.'
      ].join('\n\n');
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [100], rows: [[tCell(fairTxt, { bg: '#F8FAFC', valign: 'top' })]] });
      blocks.push(pBlock('확인 일자:  ' + issueDate, { align: 'center', size: 11, bold: true, before: 14, after: 8 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [25, 75],
        rows: [
          [tCell('외부 조사위원 확인', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('소속: 푸른노무법인   직책·성명: ' + mgrLabel + '   (서명 또는 인)', { align: 'right' })],
          [tCell('의뢰 사업장 귀중', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName + ' 대표이사 (고충처리위원회 위원장) 귀하')]
        ]
      });

    } else if (kind === 'privacy_consent') {
      blocks.push(pBlock('조사 관련 개인정보 · 민감정보 수집·이용 및 제3자 제공 동의서', { align: 'center', size: 15.5, bold: true, after: 6 }));
      blocks.push(pBlock('개인정보보호법 제15조·제17조·제23조 및 ' + lawBasis + ' 준수 서식', { align: 'center', size: 9.5, color: '#475569', after: 10 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [24, 76],
        rows: [
          [tCell('수집·이용 목적', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(coName + ' 내 「' + caseTitle + '」 객관적 사실관계 조사, 진술조서 작성, 법리 검토 및 사업주·관할 행정기관 결과 보고')],
          [tCell('수집 개인정보 항목', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('성명, 소속, 직위, 연락처, 이메일, 경력·근무이력, 면담 진술·음성녹취록, 메신저·이메일 증빙 내역 (※ 주민등록번호 뒷자리는 원칙적 가림 처리)')],
          [tCell('민감정보 항목(선택)', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('진단서·진료확인서·심리상담 내역 등 건강에 관한 정보 (피해 입증 목적으로 당사자가 자발적으로 제출하는 경우에 한함)')],
          [tCell('제3자 제공 내역', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('제공받는 자: ' + coName + ' 인사권자(및 관할 고용노동관서·노동위원회 등 법령상 기관) / 제공 목적: 법정 후속조치 이행 및 행정보고')],
          [tCell('보유·이용 기간', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('사건 조사 종결 및 관련 법령상 분쟁·보존 기간(근로기준법 등 3년) 경과 시까지 대외비 분리 보관 후 파기')],
          [tCell('동의 거부 권리 안내', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('귀하는 동의를 거부할 권리가 있으나, 미동의 시 본인 진술 반영 또는 제출 자료의 증거 채택이 제한될 수 있습니다.')]
        ]
      });
      blocks.push(pBlock('동의 여부 확인 (해당 란에 ☑ 표시)', { size: 11, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [72, 28],
        rows: [
          [tCell('1. [필수] 일반 개인정보 수집·이용에 동의합니다.'), tCell('☐ 동의함   ☐ 동의하지 않음', { align: 'center' })],
          [tCell('2. [선택] 건강정보(진단서 등) 민감정보 수집·이용에 동의합니다.'), tCell('☐ 동의함   ☐ 동의하지 않음', { align: 'center' })],
          [tCell('3. [필수] 조사 결과 보고를 위한 개인정보 제3자 제공에 동의합니다.'), tCell('☐ 동의함   ☐ 동의하지 않음', { align: 'center' })]
        ]
      });
      blocks.push(pBlock('동의 일자: ' + issueDate + '   소속: ' + (targetDept || '          ') + '   성명: ' + (targetName || '            ') + '  (서명 또는 인)', { align: 'right', size: 10.5, bold: true, before: 14 }));

    } else if (kind === 'plan_req') {
      blocks.push(pBlock(cat.label + ' 사안 조사계획 및 기초자료 협조 요청', { align: 'center', size: 16, bold: true, after: 6 }));
      blocks.push(pBlock('수행기관: 푸른노무법인 · 대외비 (' + lawBasis + ' 비밀엄수)', { align: 'center', size: 9.5, color: '#991B1B', bold: true, after: 10 }));

      blocks.push(pBlock('1. 공문 및 조사 개요', { size: 11.5, bold: true, before: 4, after: 4 }));
      blocks.push({
        type: 'table',
        widthRatio: 1,
        colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('수신 (의뢰 사업장)', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName + ' 인사·노무 담당 부서장'), tCell('발신 일자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate)],
          [tCell('발신 기관', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('푸른노무법인'), tCell('담당 조사위원', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(mgrLabel)],
          [tCell('조사 건명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(caseTitle, { colSpan: 3 })],
          [tCell('적용 법령', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(lawBasis + ' (직무상 비밀누설 금지 준수)', { colSpan: 3, color: '#1E40AF' })]
        ]
      });

      blocks.push(pBlock('2. 표준 조사 추진 절차 및 일정(안)', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table',
        widthRatio: 1,
        colWidths: [18, 34, 48],
        rows: [
          [tCell('단계', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('주요 수행 내용', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('세부 기준 및 유의사항', { bg: '#EFF6FF', bold: true, align: 'center' })],
          [tCell('1~2단계', { align: 'center', bold: true }), tCell('신고 요지 검토 및 기초자료 확보'), tCell('관련 사규·조직도·입증자료 검토 및 조사 범위·대상자 확정')],
          [tCell('3단계', { align: 'center', bold: true }), tCell('비밀유지서약 및 임시 보호조치 점검'), tCell('조사 참여자 전원 비밀유지서약 징구, 피해근로자 분리배치·유급휴가 등 검토')],
          [tCell('4~6단계', { align: 'center', bold: true }), tCell('신고인 · 참고인 · 피신고인 면담조사'), tCell('문답 조서 작성 및 본인 열람·정정 기회 부여 후 전자/자필 서명 확인')],
          [tCell('7~8단계', { align: 'center', bold: true }), tCell('사실인정 · 법리검토 · 최종 결과보고'), tCell('객관적 증거 교차검증 및 법정 요건 검토 후 조사결과보고서 제출')]
        ]
      });

      blocks.push(pBlock('3. 제출 및 협조 요청 기초자료', { size: 11.5, bold: true, before: 10, after: 4 }));
      var reqItems = customNote || [
        '① 취업규칙, 인사·징계규정, 직장 내 괴롭힘·성희롱 예방 및 처리 지침 사본',
        '② 관련 부서 조직도 및 당사자(신고인·피신고인) 직위·담당업무·근무기간 현황',
        '③ 최초 신고서 사본 및 기 제출된 녹취·메신저·이메일·진술서 등 관련 자료 일체',
        '④ 면담 대상자(당사자 및 참고인) 일정 조율 담당자 지정 및 비밀보장 독립 면담장소 협조',
        '※ 조사 개시 사실 및 관련 자료는 관계자 외 열람·유출되지 않도록 대외비로 관리하여 주시기 바랍니다.'
      ].join('\n');
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [100], rows: [[tCell(reqItems, { valign: 'top' })]] });

    } else if (kind === 'attend_notice') {
      var role = str(o.targetRole) || 'victim';
      var roleKr = role === 'accused' ? '피신고인(소명 대상자)' : role === 'witness' ? '참고인' : '신고인(피해 주장 근로자)';
      var tName = targetName || '(대상자 성명·소속)';
      var meetWhen = mask(str(o.meetWhen)) || '(추후 개별 조율 일시)';
      var meetWhere = mask(str(o.meetWhere)) || '독립 비밀보장 면담실 (또는 비대면 화상·유선)';

      blocks.push(pBlock(cat.label + ' 사안 면담조사 출석 및 절차 안내문', { align: 'center', size: 16, bold: true, after: 6 }));
      blocks.push(pBlock('[친전 · 비밀엄수] 수신인 본인 외 개봉·공유 금지 (' + lawBasis + ')', { align: 'center', size: 9.5, color: '#991B1B', bold: true, after: 10 }));

      blocks.push(pBlock('1. 면담조사 일정 및 대상 안내', { size: 11.5, bold: true, before: 4, after: 4 }));
      blocks.push({
        type: 'table',
        widthRatio: 1,
        colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('사업장명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName), tCell('안내 일자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate)],
          [tCell('조사 건명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(caseTitle, { colSpan: 3 })],
          [tCell('면담 구분', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(roleKr, { bold: true }), tCell('성명 · 소속', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(tName + (targetDept ? ' (' + targetDept + ')' : ''))],
          [tCell('면담 일시', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(meetWhen, { bold: true, color: '#1E40AF' }), tCell('면담 장소·방식', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(meetWhere)],
          [tCell('외부 조사기관', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('푸른노무법인 (' + mgrLabel + ')', { colSpan: 3 })]
        ]
      });

      blocks.push(pBlock('2. 진술 권리 보장 및 비밀엄수 유의사항', { size: 11.5, bold: true, before: 10, after: 4 }));
      var roleGuide = role === 'accused'
        ? [
          '① 공정성 및 소명권 보장: 본 조사는 객관적 사실관계 확인을 위해 독립된 외부 공인노무사가 중립적으로 수행하며, 귀하께서는 조사 쟁점에 대하여 충분한 소명 의견과 반박 자료를 제출하실 수 있습니다.',
          '② 진술 확인 절차: 면담 내용은 문답 조서로 정리되며, 귀하께서 직접 내용을 열람·정정한 뒤 전자서명 또는 자필 서명으로 확인합니다.',
          '③ 비밀유지 및 2차 피해 방지 의무: 조사 과정에서 알게 된 신고 내용·면담 질문·참고인 정보 등을 타인에게 누설하거나 신고인·참고인에게 연락·회유·불이익 언동을 하는 행위는 엄격히 금지됩니다.'
        ]
        : role === 'witness'
          ? [
            '① 참고인 보호 및 비밀보장: 귀하의 면담 참여 사실과 진술 내용은 ' + lawBasis + '에 따라 철저히 비밀이 보장되며, 조사 참여를 이유로 어떠한 인사상·업무상 불이익도 받지 않습니다.',
            '② 객관적 진술 협조: 직접 경험하거나 목격하신 사실과 관련 자료(메신저·이메일 등)를 있는 그대로 말씀해 주시기 바랍니다.',
            '③ 직무상 비밀유지 의무: 면담 과정에서 인지한 사건 내용 및 질문 사항을 사내외 타인에게 공유하거나 발설하지 않도록 유의하여 주시기 바랍니다.'
          ]
          : [
            '① 피해근로자 보호 및 불이익 금지: ' + lawBasis + '에 따라 신고 및 조사 참여를 이유로 한 불리한 처우는 법적으로 금지되며, 조사 기간 중 근무장소 변경·유급휴가 등 희망하시는 보호조치 의견을 말씀하실 수 있습니다.',
            '② 입증자료 지참 안내: 쟁점 행위 일시·장소·경위를 확인할 수 있는 녹취, 메신저 대화, 이메일, 업무일지, 진료기록 등 관련 자료가 있으면 면담 시 제출해 주시기 바랍니다.',
            '③ 진술 확인 및 비밀유지: 면담 종료 후 정리된 진술확인서를 직접 열람·보완하신 뒤 서명하며, 공정한 조사를 위해 조사 진행 내용은 외부에 누설하지 않도록 협조 바랍니다.'
          ];
      var guideText = customNote ? (roleGuide.join('\n\n') + '\n\n[추가 안내사항]\n' + customNote) : roleGuide.join('\n\n');
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [100], rows: [[tCell(guideText, { valign: 'top' })]] });

    } else if (kind === 'written_inquiry') {
      var inqIssues = Array.isArray(o.issues) ? o.issues.filter(function (x) { return x && !x._deleted; }) : [];
      blocks.push(pBlock(cat.label + ' 사안 피신고인 소명 안내 및 서면질문지(답변서)', { align: 'center', size: 15.5, bold: true, after: 6 }));
      blocks.push(pBlock('[친전 · 대외비] 소명권 보장 및 비밀엄수 서식 (' + lawBasis + ')', { align: 'center', size: 9.5, color: '#991B1B', bold: true, after: 10 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('사업장명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName), tCell('발송 일자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate)],
          [tCell('소명 대상자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell((targetName || '(피신고인)') + (targetDept ? ' (' + targetDept + ')' : '')), tCell('회신 요청기한', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(mask(str(o.meetWhen)) || '수령 후 5일 이내', { bold: true, color: '#1E40AF' })],
          [tCell('조사 수행기관', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('푸른노무법인 (' + mgrLabel + ') — 회신처 및 소명자료 일체 대외비 관리', { colSpan: 3 })]
        ]
      });
      blocks.push(pBlock('쟁점별 사실관계 확인 및 서면 소명 문항', { size: 11.5, bold: true, before: 10, after: 4 }));
      var qRows = [[
        tCell('번호', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('조사 확인 쟁점 요지 (일시·장소·주장 내용)', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('피신고인 사실 인정 여부 및 구체적 소명 답변', { bg: '#EFF6FF', bold: true, align: 'center' })
      ]];
      if (inqIssues.length) {
        inqIssues.forEach(function (iss, idx) {
          var qPrompt = '[' + mask(str(iss.title) || ('쟁점 ' + (idx + 1))) + ']' +
            (str(iss.whenWhere) ? '\n· 일시·장소: ' + mask(str(iss.whenWhere)) : '') +
            (str(iss.claimVictim) ? '\n· 확인 요지: ' + mask(str(iss.claimVictim)) : '');
          qRows.push([
            tCell(String(idx + 1), { align: 'center', bold: true, valign: 'top' }),
            tCell(qPrompt, { valign: 'top' }),
            tCell('☐ 사실 인정   ☐ 일부 인정   ☐ 사실 아님\n[구체적 경위·소명 및 반박 입증자료]:\n\n\n', { valign: 'top' })
          ]);
        });
      } else {
        qRows.push([
          tCell('1', { align: 'center', bold: true }),
          tCell(customNote || '신고 접수된 주요 쟁점 언동·업무지시 경위 전반에 대한 사실 여부 및 업무상 필요성', { valign: 'top' }),
          tCell('☐ 사실 인정   ☐ 일부 인정   ☐ 사실 아님\n[구체적 경위·소명 기재란]:\n\n\n', { valign: 'top' })
        ]);
      }
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [10, 44, 46], rows: qRows });
      blocks.push(pBlock('※ 주의: 본 서면질문지 내용에 관하여 신고인·참고인에게 연락·문의·질책하는 행위는 2차 가해에 해당할 수 있으므로 엄격히 금지됩니다.\n작성일: ' + issueDate + '   작성인(피신고인): ' + (targetName || '            ') + '  (서명/인)', { size: 9.5, before: 10 }));

    } else if (kind === 'labor_ext_req') {
      var origDue = mask(str(c.dueDate)) || '(당초 기한)';
      var nextExtDue = mask(str(o.extDueDate || c.extDue2 || c.extDue1)) || '(연장 희망일)';
      blocks.push(pBlock(cat.label + ' 조사결과 보고기한 연장 신청의 건', { align: 'center', size: 16, bold: true, after: 6 }));
      blocks.push(pBlock('발신: ' + coName + ' (조사수행 대리·위탁: 푸른노무법인 ' + mgrLabel + ')', { align: 'center', size: 9.5, color: '#475569', after: 10 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 28, 22, 28],
        rows: [
          [tCell('수신 행정기관', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(laborOffice + '장 귀하'), tCell('참조 (감독관)', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('근로개선지도과 ' + inspectorName)],
          [tCell('대상 사업장', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName), tCell('관련 사건번호', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(govCaseNo)],
          [tCell('당초 제출기한', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(origDue), tCell('연장 희망기한', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(nextExtDue, { bold: true, color: '#1E40AF' })]
        ]
      });
      blocks.push(pBlock('연장 신청 사유 및 현재까지 조사 진행 경과', { size: 11.5, bold: true, before: 10, after: 4 }));
      var extBody = customNote || [
        '1. 귀 청의 노무행정 발전을 기원합니다.',
        '2. 귀 청으로부터 개선지도(자체조사 및 결과보고 지시)를 받은 위 사건과 관련하여, 당사는 공정하고 객관적인 사실관계 확인을 위해 외부 독립 조사기관(푸른노무법인)을 선임하여 조사를 진행하고 있습니다.',
        '3. 현재 당사자 및 복수 참고인 면담 일정 조율, 제출된 대용량 녹취·증빙자료 교차 검증, 진술조서 열람·서명 확인 및 법리 검토에 물리적 시일이 추가로 소요되고 있습니다.',
        '4. 충실하고 절차적 하자 없는 조사결과 보고를 위하여 제출기한을 「' + nextExtDue + '」까지 연장 승인하여 주시기를 정중히 요청드립니다.'
      ].join('\n\n');
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [100], rows: [[tCell(extBody, { valign: 'top' })]] });
      blocks.push(pBlock(issueDate + '\n신청인: ' + coName + ' 대표이사  /  조사수행기관: 푸른노무법인 ' + mgrLabel + ' (직인)', { align: 'center', size: 10.5, bold: true, before: 14 }));

    } else if (kind === 'withdrawal_settle') {
      blocks.push(pBlock(cat.label + ' 신고 취하 · 정식조사 종료 동의 및 합의 확인서', { align: 'center', size: 15.5, bold: true, after: 6 }));
      blocks.push(pBlock('자유의사 확인 및 불이익·재발 방지 법정 확인 문서 (' + lawBasis + ')', { align: 'center', size: 9.5, color: '#475569', after: 10 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('사업장명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName), tCell('작성 일자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate)],
          [tCell('대상 사건명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(caseTitle, { colSpan: 3 })],
          [tCell('종결 유형 선택', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('☐ 신고 취하   ☐ 정식조사 종료 동의(약식 종결)   ☐ 당사자 간 화해·합의 종결', { colSpan: 3, bold: true })]
        ]
      });
      var wsBody = customNote || [
        '1. [자유의사 확인] 본인은 회사나 피신고인 또는 제3자로부터 어떠한 회유·압박·강요를 받지 아니하고, 본인의 자유로운 의사에 따라 위 사건의 신고 취하(또는 정식조사 절차 종료·당사자 합의)에 동의합니다.',
        '2. [합의 및 재발방지 이행 조건] 양 당사자는 상호 존중하며, 향후 업무 공간 분리 유지·재발 방지 약속 및 본 건과 관련한 일체의 비방·소문 유포·보복성 언동(2차 가해)을 하지 않을 것을 확약합니다.',
        '3. [재조사 청구권 유보 안내] 합의 조건의 중대한 위반이나 2차 가해·보복 행위가 발생할 경우, 피해근로자는 언제든지 재조사 및 보호조치를 요청할 수 있음을 안내받았습니다.'
      ].join('\n\n');
      blocks.push(pBlock('합의 · 조사 종료 확인 사항', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [100], rows: [[tCell(wsBody, { bg: '#F8FAFC', valign: 'top' })]] });
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [25, 75],
        rows: [
          [tCell('신고인(피해주장자)', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('소속: ' + (targetDept || '          ') + '   성명: ' + (targetName || '            ') + '   (자필서명/인)', { align: 'right' })],
          [tCell('상대방 / 입회 확인', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('상대 당사자(합의 시):               (인)   /   입회 노무사: ' + mgrLabel + ' (확인)', { align: 'right' })]
        ]
      });

    } else if (kind === 'victim_opinion_form') {
      blocks.push(pBlock('피해근로자 보호 및 행위자 조치 관련 사전 의견청취서', { align: 'center', size: 15.5, bold: true, after: 6 }));
      blocks.push(pBlock('법정 의무 이행 증빙 (근로기준법 제76조의3 제4항·제5항 / 남녀고용평등법 제14조 제4항·제5항)', { align: 'center', size: 9.3, color: '#991B1B', bold: true, after: 10 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('사업장명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName), tCell('의견청취 일자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate)],
          [tCell('대상 사건명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(caseTitle), tCell('조사 판단 요약', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(vObj.label, { bold: true, color: '#1E40AF' })],
          [tCell('의견 진술인(피해자)', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell((targetName || '(신고·피해근로자)') + (targetDept ? ' (' + targetDept + ')' : ''), { colSpan: 3 })]
        ]
      });
      blocks.push(pBlock('1. 피해근로자 본인 보호조치 희망 의견 (중복 선택 가능)', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [100],
        rows: [[tCell('☐ 행위자의 근무장소·부서 변경(물리적 분리) 요청\n☐ 본인의 희망에 따른 근무장소·부서 전환 요청 (※ 본인 의사에 반하는 전환 불가)\n☐ 유급휴가 부여 또는 심리상담·치료 지원 요청\n☐ 업무 보고체계·결재라인 분리 요청\n☐ 현재 근무상태 그대로 유지 희망', { valign: 'top' })]]
      });
      blocks.push(pBlock('2. 행위자에 대한 인사·징계 조치 및 재발방지 관련 의견 (법 제76조의3 제5항 필수 청취)', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [100],
        rows: [[tCell(customNote || '☐ 사규(인사·징계규정)에 따른 엄정한 징계 처분 요청\n☐ 공식 사과 및 서면 재발방지 서약 징구 요청\n☐ 부서 내 2차 가해 방지 교육 및 모니터링 요청\n\n[구체적 희망 의견 기재란]:\n\n', { valign: 'top' })]]
      });
      blocks.push(pBlock('본인은 행위자 조치 및 보호조치 결정에 앞서 위와 같이 사전 의견을 진술하였음을 확인합니다.\n확인 일자: ' + issueDate + '   성명: ' + (targetName || '            ') + '  (서명 또는 인)', { align: 'right', size: 10, bold: true, before: 12 }));

    } else if (kind === 'party_result_notice') {
      var recvRole = str(o.targetRole) === 'accused' ? '피신고인' : '신고인';
      blocks.push(pBlock(cat.label + ' 사안 조사결과 통지문 (' + recvRole + ' 교부용)', { align: 'center', size: 16, bold: true, after: 6 }));
      blocks.push(pBlock('[친전 · 비공개 요약본] 타인 진술 원문 비공개 및 외부 유출·게시 엄금 (' + lawBasis + ')', { align: 'center', size: 9.5, color: '#991B1B', bold: true, after: 10 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('발신 사업장', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName), tCell('통지 일자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate)],
          [tCell('수신인 (' + recvRole + ')', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell((targetName || '(' + recvRole + ' 귀하)') + (targetDept ? ' (' + targetDept + ')' : ''), { colSpan: 3 })],
          [tCell('조사 수행기관', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('외부 독립 조사기관 푸른노무법인 (' + mgrLabel + ')', { colSpan: 3 })],
          [tCell('조사 최종 판단', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(vObj.label, { colSpan: 3, bold: true, color: '#1E40AF' })]
        ]
      });
      blocks.push(pBlock('조사 판단 요지 및 후속 절차 안내', { size: 11.5, bold: true, before: 10, after: 4 }));
      var noticeTxt = customNote || [
        '1. [조사 경과] 당사는 귀하가 관련된 「' + caseTitle + '」 사안에 대하여 공정성과 객관성을 기하기 위해 외부 전문기관(푸른노무법인)에 의뢰하여 당사자 및 참고인 면담과 제출 증거 조사를 완료하였습니다.',
        '2. [판단 결과 요약] 관계 법령(' + lawBasis + ') 및 사규에 따른 사실인정과 법리 검토 결과, 본 사안은 최종 「' + vObj.label + '」으로 판단되었음을 통지합니다.',
        '3. [후속 절차 안내] ' + (recvRole === 'accused'
          ? '조사 결과 인정된 사항에 대하여는 사규가 정한 인사·징계위원회 절차에 따라 별도 소명 기회가 부여될 예정이며, 신고인·참고인에 대한 일체의 연락·언급·불이익 행위는 엄격히 금지됩니다.'
          : '법령에 따라 보호조치 및 행위자 조치에 관한 귀하의 의견을 반영하여 후속 인사조치 및 재발방지 대책을 시행할 예정이며, 보복이나 2차 피해 발생 시 즉시 인사부서에 알려 주시기 바랍니다.'),
        '4. [비밀유지 고지] 개인정보보호법 및 직무상 비밀유지 의무에 따라 타인의 구체적 진술서 전문은 공개되지 않으며, 본 통지문을 사내외에 게시·유포하는 행위는 금지됩니다.'
      ].join('\n\n');
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [100], rows: [[tCell(noticeTxt, { valign: 'top' })]] });

    } else if (kind === 'labor_result_rpt') {
      blocks.push(pBlock(cat.label + ' 사건 자체(외부전문가) 조사 및 조치결과 보고', { align: 'center', size: 16, bold: true, after: 6 }));
      blocks.push(pBlock('수신: ' + laborOffice + '장 (참조: ' + inspectorName + ') · 사건번호: ' + govCaseNo, { align: 'center', size: 9.8, bold: true, color: '#1E40AF', after: 10 }));
      blocks.push(pBlock('1. 대상 사업장 및 조사 수행 개요', { size: 11.5, bold: true, before: 4, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 28, 22, 28],
        rows: [
          [tCell('사업장명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName), tCell('보고 일자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate)],
          [tCell('관련 사건번호', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(govCaseNo), tCell('외부 조사기관', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('푸른노무법인 (' + mgrLabel + ')')],
          [tCell('조사 기간', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell((str(c.receiveDate) || '-') + ' ~ ' + (str(c.closeDate) || issueDate)), tCell('최종 판단 결과', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(vObj.label, { bold: true, color: '#1E40AF' })]
        ]
      });
      blocks.push(pBlock('2. 근로기준법 제76조의3(남녀고평법 제14조) 법정의무 이행 점검표', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [28, 72],
        rows: [
          [tCell('법정 의무 항목', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('이행 내역 및 첨부 증빙', { bg: '#EFF6FF', bold: true, align: 'center' })],
          [tCell('① 지체 없는 객관적 조사', { bold: true, align: 'center' }), tCell('독립 외부 공인노무사 위촉, 조사참여자 비밀유지서약 징구, 당사자·참고인 문답 및 전자서명 확인 완료 (별첨 조사결과보고서 참조)')],
          [tCell('② 조사기간 피해자 보호', { bold: true, align: 'center' }), tCell('근무공간·업무동선 분리 및 희망 보호조치 의견 확인 이행')],
          [tCell('③ 피해자 사전 의견청취', { bold: true, align: 'center' }), tCell('행위자 인사·징계 조치 결정 전 피해근로자 사전 의견청취서 징구 완료')],
          [tCell('④ 행위자 징계·인사조치', { bold: true, align: 'center' }), tCell(customNote || (str(o.recommendations) ? mask(str(o.recommendations)) : '조사 결과 및 취업규칙 징계규정에 따른 인사조치·분리배치 및 재발방지 특별교육 이행'))],
          [tCell('⑤ 비밀유지·불이익 금지', { bold: true, align: 'center' }), tCell('당사자 비공개 결과통지 완료 및 향후 2차 가해·보복행위 방지 사후 모니터링 시행')]
        ]
      });
      blocks.push(pBlock('붙임: 1. 외부전문가 조사결과보고서 1부.  2. 당사자 진술확인서·비밀유지서약서 사본 각 1부.  3. 피해근로자 사전 의견청취서 및 인사조치·재발방지 증빙 각 1부. 끝.', { size: 9.8, before: 10 }));
      blocks.push(pBlock(issueDate + '\n보고 사업장: ' + coName + ' 대표이사 (직인)', { align: 'center', size: 11, bold: true, before: 12 }));

    } else if (kind === 'disciplinary_pack') {
      blocks.push(pBlock('인사(징계)위원회 출석통지서 · 징계의결서 · 징계처분통지서 표준 서식', { align: 'center', size: 15.5, bold: true, after: 6 }));
      blocks.push(pBlock('사업장: ' + coName + ' · 관련 조사건: ' + caseTitle + ' (절차적 정당성 준수용)', { align: 'center', size: 9.5, color: '#475569', after: 10 }));

      blocks.push(pBlock('[서식 1] 인사(징계)위원회 출석통지서 (개최 전 사규상 사전통지 기한 준수 필수)', { size: 11.2, bold: true, before: 4, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 28, 22, 28],
        rows: [
          [tCell('출석 대상자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetName || '(행위자 성명)'), tCell('소속 / 직위', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetDept || '-')],
          [tCell('개최 일시', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(mask(str(o.meetWhen)) || '(개최 일시 기재)', { bold: true }), tCell('개최 장소', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(mask(str(o.meetWhere)) || '본사 대회의실')],
          [tCell('징계 회부 사유', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(caseTitle + ' 조사 결과 인정된 비위 사실 및 취업규칙(직장 내 괴롭힘·성희롱 금지 및 복무규율) 위반 혐의', { colSpan: 3 })],
          [tCell('소명권 안내', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('귀하는 위원회에 직접 출석하여 진술하거나 서면 소명자료·증거를 제출할 수 있으며, 미출석 시 서면 진술로 갈음하거나 진술을 포기한 것으로 처리될 수 있습니다.', { colSpan: 3 })]
        ]
      });

      blocks.push(pBlock('[서식 2] 인사(징계)위원회 심의 · 징계의결서 요지', { size: 11.2, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 78],
        rows: [
          [tCell('의결 주문(양정)', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('☐ 견책(경고)   ☐ 감봉(   월)   ☐ 정직(   월)   ☐ 강등·보직해임   ☐ 징계해고   (피해근로자 사전 의견청취 반영필)')],
          [tCell('인정 비위 사실 및 양정 이유', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(customNote || '외부전문가 조사결과보고서상 인정된 구체적 비위 행위, 행위의 반복성·고의성, 피해 정도, 피해근로자 의견 및 소명 태도를 종합 참작하여 사규 제○조에 의거 위와 같이 의결함.')],
          [tCell('위원 서명란', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('위원장:            (인)   /   위원:            (인)   /   위원:            (인)   /   간사:            (인)')]
        ]
      });

      blocks.push(pBlock('[서식 3] 징계처분 사유 및 결과 서면 통지서 (근로기준법 제27조 서면통지 준수)', { size: 11.2, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 78],
        rows: [
          [tCell('처분 종류 · 일자', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('처분 내용: (예: 정직 1월)   /   처분 효력발생일: 2026-  -  ')],
          [tCell('구체적 처분 사유 · 적용 사규', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('(반드시 일시·장소·구체적 비위 사실과 취업규칙·인사규정 해당 조항 번호를 명시하여 서면 교부하십시오)')],
          [tCell('재심 청구 안내', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('본 처분에 이의가 있을 경우 통지서를 받은 날로부터 사규가 정한 기한(예: 7일 또는 10일) 이내에 서면으로 재심을 청구하실 수 있습니다.')]
        ]
      });

    } else if (kind === 'pledge_form') {
      blocks.push(pBlock('직장 내 괴롭힘 · 성희롱 조사 참여자 비밀유지서약서', { align: 'center', size: 16, bold: true, after: 8 }));
      blocks.push(pBlock('조사 수행 기관: 푸른노무법인 · 법정 비밀유지 서약 문서 (' + lawBasis + ')', { align: 'center', size: 9.5, color: '#475569', after: 10 }));

      blocks.push({
        type: 'table',
        widthRatio: 1,
        colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('사업장명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName), tCell('참여 구분', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(str(o.targetRole) === 'accused' ? '피신고인' : str(o.targetRole) === 'witness' ? '참고인' : str(o.targetRole) === 'victim' ? '신고인' : '조사 참여자 (신고인/피신고인/참고인/관계자)')],
          [tCell('조사 건명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(caseTitle, { colSpan: 3 })]
        ]
      });

      blocks.push(pBlock('비밀유지 및 2차 피해 방지 서약 사항', { size: 11.5, bold: true, before: 10, after: 4 }));
      var pledgeClauses = customNote || [
        '1. 본인은 위 사안의 조사 참여자로서, 조사 과정에서 알게 된 신고 사실·당사자 및 참고인 인적사항·면담 질문 및 진술 내용·제출 증거 등 일체의 비밀을 피해근로자의 의사에 반하여 타인에게 누설하지 않겠습니다.',
        '2. 본인은 면담 내용을 무단으로 녹음·유포하거나 사내외 메신저·게시판 등에 언급하여 2차 피해를 유발하는 행위를 일체 하지 않겠습니다.',
        '3. 본인은 관련 법령(' + lawBasis + ')에 따른 비밀누설 금지 의무 및 불이익 처우·보복 행위 금지 규정을 안내받았으며, 이를 위반할 경우 관계 법령 및 사규에 따른 책임을 질 것을 확인합니다.',
        '4. 위 서약 사항을 충분히 이해하고 본인의 자유로운 의사로 서명합니다.'
      ].join('\n\n');
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [100], rows: [[tCell(pledgeClauses, { bg: '#F8FAFC', valign: 'top' })]] });

      blocks.push(pBlock('서약 일자:  ' + issueDate, { align: 'center', size: 11, bold: true, before: 14, after: 8 }));
      blocks.push({
        type: 'table',
        widthRatio: 1,
        colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('소속 부서 / 직위', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetDept || ''), tCell('성명 (자필서명)', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell((targetName || '                ') + '   (서명 또는 인)', { align: 'right' })],
          [tCell('조사 수행 기관', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('푸른노무법인 (' + mgrLabel + ') 귀중', { colSpan: 3 })]
        ]
      });

    } else if (kind === 'counsel_log') {
      /* 초기 고충 상담일지 및 잠정 보호·분리 검토서 (고용노동부 매뉴얼 별지 제1호 스타일) */
      blocks.push(docTopBannerTable('대외비 · 고용노동부 매뉴얼 별지 표준양식', cat.label + ' 초기 고충 상담일지 및 처리방안 검토서', '접수·상담기관: ' + coName + ' / 푸른노무법인 (' + mgrLabel + ')', issueDate));
      blocks.push(pBlock('1. 상담 접수 및 내담자 인적사항', { size: 11.5, bold: true, before: 8, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('상담 일시', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(mask(str(o.meetWhen)) || issueDate), tCell('상담 방식', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(mask(str(o.meetWhere)) || '대면 / 유선 / 온라인')],
          [tCell('내담자 성명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetName || '(익명 상담 가능)'), tCell('소속 / 직위', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetDept || '-')],
          [tCell('피신고 지목인', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('(성명·직위·업무상 관계 기재)', { colSpan: 3 })]
        ]
      });
      blocks.push(pBlock('2. 고충 호소 요지 및 희망 처리 절차 확인', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [24, 76],
        rows: [
          [tCell('고충 상담 요지\n(육하원칙)', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(customNote || '• 발생 일시·장소:\n• 구체적 언행 내용:\n• 현재 고충 및 피해 상태:\n• 보유 증거(녹음·메신저·목격자 등):')],
          [tCell('내담자 희망 절차', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('☐ 정식 사실조사 착수 요청     ☐ 당사자 분리·약식 조정 희망     ☐ 상담 기록만 유지(보류)')],
          [tCell('즉시 잠정 보호조치\n검토 (제76조의3 제3항)', { bg: '#F8FAFC', bold: true, align: 'center' }), tCell('☐ 근무장소 임시 분리   ☐ 유급휴가·재택근무 부여   ☐ 업무보고선 임시 변경   ☐ 해당 없음')]
        ]
      });
      blocks.push(pBlock('3. 상담원(조사역) 안내 및 확인 서명', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [25, 75],
        rows: [
          [tCell('법정 고지 확인', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('☑ 비밀유지 의무(제76조의3 제7항) 및 신고·상담에 따른 불리한 처우 금지(제6항) 안내 완료')],
          [tCell('상담자 확인', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(mgrLabel + '   (서명 또는 인)', { align: 'right' })]
        ]
      });

    } else if (kind === 'investigator_oath') {
      /* 조사위원(내·외부 공동조사단) 비밀엄수 및 공정조사 서약서 */
      blocks.push(docTopBannerTable('대외비 · 조사단 공정성·기밀성 담보 문서', '내·외부 조사위원 비밀엄수 및 공정조사 서약서', '대상 사건: ' + coName + ' — ' + caseTitle, issueDate));
      blocks.push(pBlock('1. 서약 조항 (' + lawBasis + ')', { size: 11.5, bold: true, before: 8, after: 4 }));
      var oathTxt = customNote || [
        '1. [독립·공정 조사] 본인은 어느 일방 당사자에게도 치우침 없이 객관적 증거와 법리에 입각하여 중립적·공정하게 사실조사를 수행하겠습니다.',
        '2. [제척·회피 확인] 본인은 신고인 또는 피신고인과 친족, 직속 이해관계 등 조사의 공정성을 해할 우려가 있는 사유가 없음을 확인하며, 사유 발생 시 즉시 회피하겠습니다.',
        '3. [직무상 비밀엄수] 조사 과정에서 지득한 당사자 인적사항, 진술 내용, 녹취록, 호증 등 일체의 기밀을 조사 목적 외에 사용하거나 제3자에게 누설하지 않겠습니다(위반 시 과태료 및 민·형사 책임 감수).',
        '4. [2차 피해 방지] 면담 진행 시 피해자 비난·합의 강요·예단 발언 등 2차 피해를 유발할 수 있는 언동을 엄격히 금하겠습니다.'
      ].join('\n\n');
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [100], rows: [[tCell(oathTxt, { bg: '#F8FAFC', valign: 'top' })]] });
      blocks.push(pBlock('서약 일자:  ' + issueDate, { align: 'center', size: 11, bold: true, before: 12, after: 6 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 25, 25],
        rows: [
          [tCell('구분', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('소속 · 직위', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('성명', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('자필 서명', { bg: '#EFF6FF', bold: true, align: 'center' })],
          [tCell('책임 조사위원', { align: 'center', bold: true }), tCell('푸른노무법인'), tCell(mgrLabel), tCell('(서명)', { align: 'right', color: '#64748B' })],
          [tCell('공동 조사위원', { align: 'center' }), tCell(targetDept || '푸른노무법인 / 사내 간사'), tCell(targetName || ''), tCell('(서명)', { align: 'right', color: '#64748B' })]
        ]
      });

    } else if (kind === 'separation_order') {
      /* 조사기간 중 잠정 분리·보호조치 인사명령 통지서 (근기법 제76조의3 제3항) */
      blocks.push(docTopBannerTable('인사대외비 · 조사기간 중 잠정조치 명령', '조사기간 중 당사자 잠정 분리·보호조치 통지서', '발신: ' + coName + ' 인사권자 · 자문: 푸른노무법인', issueDate));
      blocks.push(pBlock('1. 통지 대상 및 조치 내역', { size: 11.5, bold: true, before: 8, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 28, 22, 28],
        rows: [
          [tCell('대상자 성명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetName || '(성명 기재)'), tCell('소속 / 직위', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetDept || '-')],
          [tCell('조치 적용 기간', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate + ' ~ 조사 종결 및 후속조치 확정 시까지', { colSpan: 3 })],
          [tCell('잠정 조치 내용', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(customNote || '• 근무장소 임시 분리 배치 / 재택근무 전환 / 유급휴가(대기) 부여\n• 업무 지시·보고 라인 임시 조정 (직접 대면·유선·메신저 접촉 일체 금지)', { colSpan: 3 })]
        ]
      });
      blocks.push(pBlock('2. 법적 성격 및 준수 유의사항', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [100],
        rows: [[tCell('• 본 조치는 ' + lawBasis + '에 의거하여 객관적인 사실조사 및 당사자 보호·2차 피해 방지를 위해 시행하는 잠정적 보호·예방 조치이며, 징계처분이 아닙니다.\n• 조사 종결 전까지 상대방 당사자 및 참고인에 대한 사적 연락, 사건 언급, 소문 유포, 합의 종용 행위를 엄격히 금합니다.', { bg: '#F8FAFC' })]]
      });

    } else if (kind === 'evidence_receipt') {
      /* 증거자료 제출 목록 및 원본대조 확인서 */
      blocks.push(docTopBannerTable('대외비 · 조사 증거물 무결성 확인서', '증거자료(호증) 제출 목록 및 원본대조 확인서', '사건명: ' + caseTitle + ' · 수행기관: 푸른노무법인', issueDate));
      blocks.push(pBlock('1. 제출인 정보', { size: 11.5, bold: true, before: 8, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('제출인 성명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetName || '-'), tCell('당사자 구분', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(o.targetRole === 'accused' ? '피신고인 측(을호증)' : o.targetRole === 'witness' ? '참고인(참고자료)' : '신고인 측(갑호증)')],
          [tCell('제출 일자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate), tCell('소속 / 직위', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(targetDept || '-')]
        ]
      });
      blocks.push(pBlock('2. 제출 증거 목록 및 원본 대조', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [16, 22, 38, 24],
        rows: [
          [tCell('호증 번호', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('자료 형태·생성일', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('자료 명칭 및 입증 취지', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('원본대조 확인', { bg: '#EFF6FF', bold: true, align: 'center' })],
          [tCell('제1호증', { align: 'center', bold: true }), tCell('녹음 / 캡처 / 문서'), tCell(customNote || '(제출 자료 명칭 및 입증하고자 하는 사실 요지 기재)'), tCell('☐ 원본대조필', { align: 'center' })],
          [tCell('제2호증', { align: 'center', bold: true }), tCell(''), tCell(''), tCell('☐ 원본대조필', { align: 'center' })],
          [tCell('제3호증', { align: 'center', bold: true }), tCell(''), tCell(''), tCell('☐ 원본대조필', { align: 'center' })]
        ]
      });
      blocks.push(pBlock('3. 진정성립(무편집·무위조) 서약 및 확인 서명', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [100],
        rows: [[tCell('본인이 제출한 위 증거자료는 인위적인 편집·짜깁기·위변조가 없는 원본(또는 원본과 상위 없는 사본)임을 확인합니다.\n\n제출인:  ' + (targetName || '                ') + '  (서명)      /      원본대조 확인 조사역:  ' + mgrLabel + '  (서명)', { bg: '#F8FAFC' })]]
      });

    } else if (kind === 'legal_opinion_short') {
      /* 단독 법률검토의견서 (징계양정 적정성 · 법적 리스크 자문서 — 법무·노무법인 자문 양식) */
      blocks.push(docTopBannerTable('극비(Confidential) · 인사노무 법률검토의견서', cat.label + ' 관련 인사조치 및 법적 리스크 검토의견서', '수신: ' + coName + ' 대표이사 · 발신: 푸른노무법인 (' + mgrLabel + ')', issueDate));
      blocks.push(pBlock('Ⅰ. 질의 요지 및 핵심 검토 결론 (Executive Summary)', { size: 11.5, bold: true, color: '#1E40AF', before: 8, after: 4 }));
      var issList = Array.isArray(o.issues) ? o.issues : [];
      var recIssCnt = issList.filter(function (x) { return x && (x.verdict === 'yes' || (C && C.judgeIssue && C.judgeIssue(x) === 'yes')); }).length;
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 78],
        rows: [
          [tCell('검토 사안', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(caseTitle + ' (' + lawBasis + ')')],
          [tCell('사실조사 요약', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(vObj.label + ' (검토 쟁점 총 ' + issList.length + '건 중 성립 인정 ' + recIssCnt + '건)', { bold: true, color: '#0F172A' })],
          [tCell('자문 결론 요지', { bg: '#F8FAFC', bold: true, align: 'center' }), tCell(customNote || mask(str(o.recommendations)) || '인정된 비위 행위의 정도·반복성·2차 가해 유무를 종합할 때 사규상 징계사유가 성립하며, 피해근로자 사전 의견청취 절차를 거쳐 비례원칙에 부합하는 인사조치를 시행함이 타당합니다.')]
        ]
      });
      blocks.push(pBlock('Ⅱ. 부당징계·재진정 예방을 위한 4대 적법절차 체크포인트', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [26, 74],
        rows: [
          [tCell('① 피해자 사전 의견청취', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('징계·배치전환 등 행위자 조치 전 반드시 피해근로자의 의견을 서면·전자서명으로 청취하여 보존할 것 (근기법 제76조의3 제5항)')],
          [tCell('② 인사위원회 소명 보장', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('취업규칙상 출석통지 기한(통상 3~7일 전) 준수 및 혐의사실을 구체적으로 특정하여 방어권을 보장할 것')],
          [tCell('③ 징계양정 형평성 확보', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('사내 양정기준표 및 과거 동종 사례와 현저한 불균형이 없도록 가중·감경 사유를 의결서에 명시할 것')],
          [tCell('④ 불이익처우·비밀 관리', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('처분 통지 시 서면 사유 명시 및 종결 후 신고인·참고인에 대한 보복성 인사조치 여부 모니터링 실시')]
        ]
      });

    } else if (kind === 'committee_minutes') {
      /* 고충심의위원회(인사위원회) 심의 회의록 및 의결서 표준양식 */
      blocks.push(docTopBannerTable('대외비 · 고충심의위원회 공식 심의기록', cat.label + ' 고충심의위원회 심의 회의록 및 의결서', '기관·사업장명: ' + coName + ' · 자문: 푸른노무법인', issueDate));
      blocks.push(pBlock('1. 회의 소집 및 성원 확인', { size: 11.5, bold: true, before: 8, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('개최 일시', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(mask(str(o.meetWhen)) || issueDate), tCell('개최 장소', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(mask(str(o.meetWhere)) || '대회의실 (비공개)')],
          [tCell('심의 안건명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(caseTitle + ' 심의·의결의 건', { colSpan: 3 })],
          [tCell('외부위원·정족수', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('재적위원 ___인 중 출석 ___인 (외부전문가 ' + mgrLabel + ' 포함 · 제척사유 없음 확인)', { colSpan: 3 })]
        ]
      });
      blocks.push(pBlock('2. 조사결과 보고 청취 및 주요 심의 요지', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [100],
        rows: [[tCell(customNote || '• 외부전문가 조사결과보고서 핵심 요지 보고 청취\n• 쟁점별 사실인정 및 법정 요건(' + lawBasis + ') 충족 여부 질의·토론\n• 피해근로자 보호조치 의견 및 행위자 조치 수위 심의', { valign: 'top' })]]
      });
      blocks.push(pBlock('3. 의결 주문 및 참석 위원 서명', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [22, 78],
        rows: [
          [tCell('심의 의결 주문', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('☐ 직장 내 괴롭힘·성희롱 해당(인용)    ☐ 일부 해당(일부인용)    ☐ 비해당(기각)', { bold: true })],
          [tCell('후속조치 건의', { bg: '#F8FAFC', bold: true, align: 'center' }), tCell(mask(str(o.recommendations)) || '피해근로자 분리·보호조치 유지 및 인사위원회 회부·재발방지 교육 권고')]
        ]
      });
      blocks.push(pBlock('', { size: 4, after: 2 }));
      blocks.push({
        type: 'table', widthRatio: 1, colWidths: [20, 30, 25, 25],
        rows: [
          [tCell('직책', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('소속', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('성명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell('서명 / 날인', { bg: '#F1F5F9', bold: true, align: 'center' })],
          [tCell('위원장', { align: 'center', bold: true }), tCell(coName), tCell(''), tCell('(서명)', { align: 'right', color: '#64748B' })],
          [tCell('외부위원', { align: 'center' }), tCell('푸른노무법인'), tCell(mgrLabel), tCell('(서명)', { align: 'right', color: '#64748B' })],
          [tCell('위원 / 간사', { align: 'center' }), tCell(coName), tCell(''), tCell('(서명)', { align: 'right', color: '#64748B' })]
        ]
      });

    } else {
      /* measure_rec: 피해근로자 보호조치 및 사후 조치 권고 공문 */
      blocks.push(pBlock(cat.label + ' 사안 사업주 법정의무 및 후속조치 권고 공문', { align: 'center', size: 16, bold: true, after: 6 }));
      blocks.push(pBlock('발신: 푸른노무법인 (' + mgrLabel + ') · 대외비 인사권자 전용', { align: 'center', size: 9.5, color: '#991B1B', bold: true, after: 10 }));

      blocks.push(pBlock('1. 대상 사건 및 판단 요약', { size: 11.5, bold: true, before: 4, after: 4 }));
      blocks.push({
        type: 'table',
        widthRatio: 1,
        colWidths: [20, 30, 20, 30],
        rows: [
          [tCell('수신 사업장', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(coName + ' 대표이사 귀하'), tCell('발신 일자', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(issueDate)],
          [tCell('사건명', { bg: '#F1F5F9', bold: true, align: 'center' }), tCell(caseTitle, { colSpan: 3 })],
          [tCell('종합 판단 요약', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell(vObj.label, { colSpan: 3, bold: true, color: '#1E40AF' })]
        ]
      });

      blocks.push(pBlock('2. 관계 법령상 사업주 필수 이행 사항 (' + lawBasis + ')', { size: 11.5, bold: true, before: 10, after: 4 }));
      blocks.push({
        type: 'table',
        widthRatio: 1,
        colWidths: [26, 74],
        rows: [
          [tCell('법정 조치 구분', { bg: '#EFF6FF', bold: true, align: 'center' }), tCell('이행 기준 및 실무 유의사항', { bg: '#EFF6FF', bold: true, align: 'center' })],
          [tCell('피해근로자 보호조치', { bold: true, align: 'center' }), tCell('근무장소 변경, 배치전환, 유급휴가 명령 등 적절한 보호조치 시행 (피해근로자의 의사에 반하는 불리한 배치전환 금지)')],
          [tCell('행위자 인사·징계 조치', { bold: true, align: 'center' }), tCell('괴롭힘·성희롱 사실 인정 시 지체 없이 행위자에 대해 징계, 근무장소 변경 등 필요한 조치 이행 (조치 전 반드시 피해근로자 의견 사전 청취 필수)')],
          [tCell('불이익 처우·2차 가해 금지', { bold: true, align: 'center' }), tCell('신고인 및 참고인에 대한 해고·징계·집단 따돌림 등 불리한 처우 엄금 (위반 시 형사처벌 대상) 및 비밀유지 모니터링')],
          [tCell('재발방지 및 조직문화 개선', { bold: true, align: 'center' }), tCell('관리자·전 직원 대상 예방 특별교육 실시, 사내 고충처리 절차 점검 및 후속 모니터링 실시')]
        ]
      });

      blocks.push(pBlock('3. 본 건 맞춤 권고 의견', { size: 11.5, bold: true, before: 10, after: 4 }));
      var recBody = customNote || mask(str(o.recommendations)) || '• 조사결과보고서상 인정된 사실관계 및 법리 판단을 토대로 피해근로자 보호의견을 우선 청취한 뒤 사규(인사·징계규정)에 따른 적정 후속조치 및 재발방지 교육을 시행하시기 바랍니다.';
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [100], rows: [[tCell(recBody, { valign: 'top' })]] });
    }

    return Hx.buildHwpx({ page: Hx.defaultPage(), pageNum: { pos: 'BOTTOM_CENTER', dash: true }, blocks: blocks });
  }

  /* ④ 마스터 보고서 양식 6종 견본(빈 표준양식) .hwpx 즉시 생성 */
  function buildTemplateSampleHwpx(templateId, optCategory) {
    var tplKey = (C && typeof C.normalizeTemplateId === 'function') ? C.normalizeTemplateId(templateId) : 'laborfirm_deep';
    var catKey = (optCategory === 'sexual' || optCategory === 'both') ? optCategory : 'harass';
    var sampleCase = {
      id: 'sample_' + tplKey,
      companyName: '(의뢰 사업장명 기재)',
      title: '직장 내 괴롭힘·성희롱 사안 외부전문가 조사 (표준 양식 견본)',
      category: catKey,
      caseSubType: 'internal',
      reportTemplate: tplKey,
      receiveDate: '2026-00-00',
      dueDate: '2026-00-00',
      fairnessChecked: true,
      verdictSummary: 'hold'
    };
    var sampleSec = {
      reportTemplate: tplKey,
      overview: '(신고 접수 일자, 접수 경로, 당사자 직급·업무 관계 및 조사 착수 범위를 기재합니다)',
      companyRuleQuote: '(의뢰 사업장 취업규칙·인사규정·인권경영지침 중 괴롭힘·성희롱 금지 및 징계 조항을 인용합니다)',
      conclusion: '(쟁점별 사실인정 및 법리 포섭 결과를 종합한 최종 판단 의견을 기재합니다)',
      recommendations: '(피해근로자 사전 의견청취 후 분리·보호조치, 행위자 인사조치, 재발방지 교육 계획을 기재합니다)',
      interviews: [
        { id: 's_iv1', role: 'victim', alias: '신고인 (성명·직위)', dept: '소속부서', date: '2026-00-00', method: '대면면담', pledgeSigned: true, stmtSigned: true, summary: '(신고인의 주요 피해 주장 일시·장소·내용·요구사항 요지)' },
        { id: 's_iv2', role: 'accused', alias: '피신고인 (성명·직위)', dept: '소속부서', date: '2026-00-00', method: '대면면담', pledgeSigned: true, stmtSigned: true, summary: '(피신고인의 업무상 필요성 해명 및 반박 소명 요지)' },
        { id: 's_iv3', role: 'witness', alias: '참고인 (성명·직위)', dept: '소속부서', date: '2026-00-00', method: '대면면담', pledgeSigned: true, stmtSigned: false, summary: '(목격 정황 및 평소 조직 분위기에 관한 제3자 객관 진술 요지)' }
      ],
      evidences: [
        { id: 's_ev1', side: 'gap', exhibitNo: '갑 제1호증', date: '2026-00-00', submitter: '신고인 측', title: '고충 신고서 및 메신저·녹취 자료', summary: '당시 발언 정황 입증' },
        { id: 's_ev2', side: 'eul', exhibitNo: '을 제1호증', date: '2026-00-00', submitter: '피신고인 측', title: '업무 지시 이메일 및 소명서', summary: '업무상 경위 소명' }
      ],
      issues: [
        {
          id: 's_is1',
          lawType: catKey === 'sexual' ? 'sexual' : 'harass',
          title: '제1쟁점 행위명 (발생 일시 · 장소 기재)',
          whenWhere: '2026-00-00 회의실',
          claimVictim: '(신고인 주장 요지)',
          claimAccused: '(피신고인 소명 요지)',
          evidenceNote: '(갑/을 호증 및 참고인 진술 대조 결과)',
          credibility: { consistency: true, specificity: true, rationality: true, noMotive: true, corroboration: true },
          credibilityNote: '(일관성·구체성·물증 부합 여부 검토 의견)',
          factStatus: 'hold',
          elemSuperiority: 'hold',
          elemBeyondScope: 'hold',
          elemHarm: 'hold',
          verdict: 'hold'
        }
      ],
      templateMeta: {}
    };
    sampleSec.reportBody = (C && typeof C.assembleReportDraft === 'function')
      ? C.assembleReportDraft(sampleCase, sampleSec, tplKey)
      : '';
    return buildReportHwpx(sampleCase, sampleSec, { reportTemplate: tplKey });
  }

  return {
    OFFICIAL_DOC_TYPES: OFFICIAL_DOC_TYPES,
    extractDocumentText: extractDocumentText,
    extractReportBodyFromText: extractReportBodyFromText,
    buildInterviewHwpx: buildInterviewHwpx,
    buildReportHwpx: buildReportHwpx,
    buildEvidenceTimelineHwpx: buildEvidenceTimelineHwpx,
    buildOfficialDocHwpx: buildOfficialDocHwpx,
    buildTemplateSampleHwpx: buildTemplateSampleHwpx
  };
});
