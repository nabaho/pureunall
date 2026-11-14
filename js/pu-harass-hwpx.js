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

    /* 6) 일반 텍스트 (.txt · .srt · .vtt · .md · .csv) — 손상된 바이너리 컨테이너 문서 및 제어문자 포함 데이터 차단 */
    var isBinContainerExt = /\.(hwpx|hwp|hwt|docx|doc|pdf|xlsx|xls|xlsm|pptx|ppt|zip)$/i.test(lower);
    var isMediaExt = /\.(mp3|m4a|wav|ogg|webm|png|jpg|jpeg|gif|webp)$/i.test(lower);
    if (!isBinContainerExt && !isMediaExt && !isZip && !isOle && !isPdf && u8.length > 0) {
      var plain = decodePlainTextBytes(u8);
      if (!hasDisallowedControlChars(plain) && str(plain)) {
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

  /* ① 면담 진술확인서 (겸 비밀유지서약서) 정식 .hwpx 생성 */
  function buildInterviewHwpx(caseRec, interviewRec) {
    var Hx = ensureHwpxBuilder();
    var c = caseRec || {};
    var iv = interviewRec || {};
    var cat = (C && C.CATEGORIES && C.CATEGORIES[c.category]) || { label: '직장 내 괴롭힘' };
    var roleKr = iv.role === 'accused' ? '피신고인(행위자)' : iv.role === 'witness' ? '참고인' : '신고인(피해근로자)';
    var qaList = Array.isArray(iv.qaList) ? iv.qaList.filter(function (q) { return q && (str(q.q) || str(q.a)); }) : [];

    var blocks = [];
    blocks.push(pBlock('비밀유지서약 및 면담 진술확인서', { align: 'center', size: 16, bold: true, after: 8 }));
    blocks.push(pBlock('조사 수행 기관: 푸른노무법인 · 근로기준법 제76조의3 제7항 직무상 비밀엄수 문서', { align: 'center', size: 9.5, color: '#475569', after: 10 }));

    /* 1. 사건 및 면담 개요 표 */
    blocks.push(pBlock('1. 사건 및 면담 개요', { size: 11.5, bold: true, before: 4, after: 4 }));
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
          tCell(roleKr),
          tCell('성명·호칭 / 소속', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell((str(iv.alias) || '익명') + (str(iv.dept) ? ' (' + str(iv.dept) + ')' : ''))
        ],
        [
          tCell('면담 일자', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(str(iv.date) || '-'),
          tCell('면담 방식', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(str(iv.method) || '대면면담')
        ]
      ]
    });

    /* 2. 비밀유지서약 확인 */
    blocks.push(pBlock('2. 조사 참여자 비밀유지 서약 (근로기준법 제76조의3 제7항)', { size: 11.5, bold: true, before: 10, after: 4 }));
    blocks.push({
      type: 'table',
      widthRatio: 1,
      colWidths: [100],
      rows: [[
        tCell([
          pBlock('• 본인은 직장 내 괴롭힘·성희롱 사안 조사 참여자로서 조사 과정에서 알게 된 사건 내용·질문·타인의 진술·개인정보 등 일체의 비밀을 정당한 이유 없이 누설하지 않을 것을 서약합니다.', { size: 9.5, after: 2 }),
          pBlock('• 서약 확인 상태: ' + (iv.pledgeSigned ? '☑ 비밀유지서약 동의 및 징구 완료' : '☐ 서약 확인 대기'), { size: 9.8, bold: true, color: iv.pledgeSigned ? '#166534' : '#475569' })
        ], { bg: '#F8FAFC' })
      ]]
    });

    /* 3. 녹취·면담 문답(Q&A) 조서 */
    blocks.push(pBlock('3. 면담 문답(Q&A) 정리 내역', { size: 11.5, bold: true, before: 10, after: 4 }));
    if (qaList.length) {
      var qaRows = [[
        tCell('순번', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('질문 요지 (조사역)', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('진술 답변 (진술인)', { bg: '#EFF6FF', bold: true, align: 'center' })
      ]];
      qaList.forEach(function (qa, idx) {
        qaRows.push([
          tCell(String(idx + 1), { align: 'center', valign: 'top' }),
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

  /* ② 최종 직장 내 괴롭힘·성희롱 조사결과보고서 정식 .hwpx 생성 */
  function buildReportHwpx(caseRec, secRec) {
    var Hx = ensureHwpxBuilder();
    var c = caseRec || {};
    var sec = secRec || {};
    var cat = (C && C.CATEGORIES && C.CATEGORIES[c.category]) || { label: '직장 내 괴롭힘' };
    var verdict = (C && C.VERDICTS && C.VERDICTS[str(c.verdictSummary)]) || { label: '조사·검토 진행 중' };
    var interviews = Array.isArray(sec.interviews) ? sec.interviews.filter(function (x) { return x && !x._deleted; }) : [];
    var issues = Array.isArray(sec.issues) ? sec.issues.filter(function (x) { return x && !x._deleted; }) : [];

    var blocks = [];
    blocks.push(pBlock(cat.label + ' 사안 외부전문가 조사결과보고서', { align: 'center', size: 16.5, bold: true, after: 6 }));
    blocks.push(pBlock('작성기관: 푸른노무법인 · 대외비(근로기준법 제76조의3 제7항 비밀엄수)', { align: 'center', size: 9.5, color: '#991B1B', bold: true, after: 10 }));

    /* 1. 사건 개요 표 */
    blocks.push(pBlock('1. 사건 개요', { size: 12, bold: true, before: 4, after: 4 }));
    blocks.push({
      type: 'table',
      widthRatio: 1,
      colWidths: [20, 30, 20, 30],
      rows: [
        [
          tCell('의뢰 사업장', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(str(c.companyName) || '(미입력)'),
          tCell('조사 구분', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(cat.label)
        ],
        [
          tCell('사건명', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(str(c.title) || (cat.label + ' 조사 건'), { colSpan: 3 })
        ],
        [
          tCell('조사 착수일', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(str(c.receiveDate) || '-'),
          tCell('보고·종결일', { bg: '#F1F5F9', bold: true, align: 'center' }),
          tCell(str(c.closeDate) || str(c.dueDate) || '진행 중')
        ],
        [
          tCell('종합 판단 요약', { bg: '#EFF6FF', bold: true, align: 'center' }),
          tCell(verdict.label, { colSpan: 3, bold: true, color: '#1E40AF' })
        ]
      ]
    });

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
        var sumTxt = str(iv.summary) || '-';
        if (str(iv.amendNote)) sumTxt += '\n[정정·보완 의견] ' + str(iv.amendNote);
        ivRows.push([
          tCell(rKr, { align: 'center', valign: 'top' }),
          tCell((str(iv.alias) || '-') + (str(iv.dept) ? '\n(' + str(iv.dept) + ')' : ''), { align: 'center', valign: 'top' }),
          tCell(signTxt, { align: 'center', valign: 'top', size: 9 }),
          tCell(sumTxt, { valign: 'top' })
        ]);
      });
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [13, 18, 21, 48], rows: ivRows });
    } else {
      blocks.push(pBlock('등록된 면담 진술 기록이 없습니다.', { size: 9.8, color: '#64748B' }));
    }

    /* 3. 쟁점 행위별 3요건 검토 요약 표 */
    blocks.push(pBlock('3. 쟁점 행위별 근로기준법 3요건 검토 요약', { size: 12, bold: true, before: 10, after: 4 }));
    if (issues.length) {
      var yn = { yes: '충족', no: '미충족', hold: '검토중' };
      var res = { yes: '인정(해당)', no: '불인정(비해당)', hold: '판단보류' };
      var issRows = [[
        tCell('쟁점 행위 (일시·장소)', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('① 우위성', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('② 적정범위 초과', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('③ 고통·환경악화', { bg: '#EFF6FF', bold: true, align: 'center' }),
        tCell('판정 결과', { bg: '#EFF6FF', bold: true, align: 'center' })
      ]];
      issues.forEach(function (iss, idx) {
        var vCode = str(iss.verdict) || (C && C.judgeIssue ? C.judgeIssue(iss) : 'hold');
        var titleTxt = '[' + (idx + 1) + '] ' + (str(iss.title) || '쟁점') + (str(iss.whenWhere) ? '\n(' + str(iss.whenWhere) + ')' : '');
        issRows.push([
          tCell(titleTxt, { valign: 'top' }),
          tCell(yn[iss.elemSuperiority] || '검토중', { align: 'center' }),
          tCell(yn[iss.elemBeyondScope] || '검토중', { align: 'center' }),
          tCell(yn[iss.elemHarm] || '검토중', { align: 'center' }),
          tCell(res[vCode] || '검토중', { align: 'center', bold: true, color: vCode === 'yes' ? '#991B1B' : vCode === 'no' ? '#166534' : '#854D0E' })
        ]);
      });
      blocks.push({ type: 'table', widthRatio: 1, colWidths: [40, 14, 16, 16, 14], rows: issRows });
    } else {
      blocks.push(pBlock('등록된 개별 쟁점 행위가 없습니다.', { size: 9.8, color: '#64748B' }));
    }

    /* 4. 조사결과보고서 상세 본문 */
    blocks.push(pBlock('4. 상세 사실인정 및 종합 판단 본문', { size: 12, bold: true, before: 10, after: 4 }));
    var bodyText = str(sec.reportBody) || (C && C.assembleReportDraft ? C.assembleReportDraft(c, sec) : '');
    multiLineBlocks(bodyText, { size: 10.2, lineSpacing: 165, after: 3 }).forEach(function (b) {
      blocks.push(b);
    });

    return Hx.buildHwpx({ page: Hx.defaultPage(), pageNum: { pos: 'BOTTOM_CENTER', dash: true }, blocks: blocks });
  }

  return {
    extractDocumentText: extractDocumentText,
    extractReportBodyFromText: extractReportBodyFromText,
    buildInterviewHwpx: buildInterviewHwpx,
    buildReportHwpx: buildReportHwpx
  };
});
