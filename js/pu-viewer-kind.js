/* pu-viewer-kind.js — 문서뷰어: «파일 서명»으로 형식 가리기 (2026-10-25)
   ------------------------------------------------------------------
   쓰는 법:  PuViewerKind.check(바이트, '파일이름.hwpx')
             → { ok:true, kind:'hwpx', size } | { ok:false, error:'…', kind?:'pptx' }

   ★ 확장자는 «힌트»일 뿐이다 — 형식은 파일 안의 서명으로 가른다.
     확장자를 속인 파일(예: .pdf 라고 붙은 압축파일)도 진짜 형식으로 본다.
   ★ 이 파일은 바이트만 읽는다 — 풀지도, 그리지도, 어디로 보내지도 않는다.
     (zip 은 끝의 «중앙 목록» 이름만 훑는다 — 압축을 풀지 않는다)
   ★ kind: pdf · hwp · hwpx · xlsx · xls · csv — «지금 그려 주는 것».
           docx · pptx — 알아보지만 아직 못 그린다(2판). 못 그린다고 «말해 준다».
   ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  /* 폰 메모리 한도 — 파일이 이 크기를 넘으면 열지 않는다.
     검사고정-허용: 값 자체가 규칙이다(폰에서 탭이 죽지 않는 한도). 시험 제작 뒤 폰에서 재어 조정한다. */
  var MAX_BYTES = 50 * 1024 * 1024;

  var LABELS = {
    pdf: 'PDF', hwp: '한글(hwp)', hwpx: '한글(hwpx)', xlsx: '엑셀', xls: '엑셀(옛 형식)', csv: 'CSV 표',
    docx: '워드', pptx: '파워포인트'
  };
  var NEXT_VERSION = { docx: true, pptx: true };

  function bytesOf(input) {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (input && ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    return null;
  }

  function extOf(name) {
    var m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
    return m ? m[1] : '';
  }

  /* 바이트 안에 «ASCII 글자 묶음»이 있는가 — from~to 사이만 훑는다 */
  function hasAscii(b, text, from, to) {
    var n = text.length, first = text.charCodeAt(0);
    var end = Math.min(to == null ? b.length : to, b.length) - n;
    for (var i = Math.max(0, from || 0); i <= end; i++) {
      if (b[i] !== first) continue;
      var k = 1;
      while (k < n && b[i + k] === text.charCodeAt(k)) k++;
      if (k === n) return true;
    }
    return false;
  }

  /* 옛 오피스(CFB) 안의 «글자 이름»은 UTF-16LE 로 적힌다 — 'F\0i\0l\0e…' */
  function hasUtf16(b, text) {
    var n = text.length, first = text.charCodeAt(0);
    var end = b.length - n * 2;
    for (var i = 0; i <= end; i++) {
      if (b[i] !== first || b[i + 1] !== 0) continue;
      var k = 1;
      while (k < n && b[i + k * 2] === text.charCodeAt(k) && b[i + k * 2 + 1] === 0) k++;
      if (k === n) return true;
    }
    return false;
  }

  function isCfb(b) {
    return b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 &&
      b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1;
  }
  function isZip(b) {
    return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07);
  }
  function isPdf(b) {
    /* PDF 는 앞 1KB 안 어딘가에 %PDF- 가 있으면 된다(앞에 쓰레기가 붙은 파일이 있다) */
    return hasAscii(b, '%PDF-', 0, 1024);
  }

  /* zip 의 «끝 목록»(중앙 디렉터리) 범위를 찾는다 — 못 찾으면 null */
  function centralDir(b) {
    var from = Math.max(0, b.length - 22 - 65535);
    for (var i = b.length - 22; i >= from; i--) {
      if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) {
        var size = (b[i + 12] | (b[i + 13] << 8) | (b[i + 14] << 16) | (b[i + 15] << 24)) >>> 0;
        var off = (b[i + 16] | (b[i + 17] << 8) | (b[i + 18] << 16) | (b[i + 19] << 24)) >>> 0;
        if (off + size <= b.length) return { from: off, to: off + size };
        return null;
      }
    }
    return null;
  }

  function zipKind(b) {
    var cd = centralDir(b);
    var from = cd ? cd.from : 0, to = cd ? cd.to : Math.min(b.length, 2 * 1024 * 1024);
    if (hasAscii(b, 'Contents/content.hpf', from, to) || hasAscii(b, 'Contents/section0.xml', from, to)) return 'hwpx';
    if (hasAscii(b, 'xl/workbook.xml', from, to)) return 'xlsx';
    if (hasAscii(b, 'ppt/presentation.xml', from, to)) return 'pptx';
    if (hasAscii(b, 'word/document.xml', from, to)) return 'docx';
    return '';
  }

  function cfbKind(b) {
    if (hasUtf16(b, 'FileHeader')) return 'hwp';
    if (hasUtf16(b, 'Workbook') || hasUtf16(b, 'Book')) return 'xls';
    return '';
  }

  /* 글자 파일(csv)인가 — 앞 4KB 에 NUL 이 없고 확장자가 csv·tsv */
  function looksText(b) {
    var n = Math.min(b.length, 4096);
    for (var i = 0; i < n; i++) if (b[i] === 0) return false;
    return n > 0;
  }

  function kindOf(b, name) {
    if (isPdf(b)) return 'pdf';
    if (isZip(b)) return zipKind(b);
    if (isCfb(b)) return cfbKind(b);
    var ext = extOf(name);
    if ((ext === 'csv' || ext === 'tsv') && looksText(b)) return 'csv';
    return '';
  }

  function check(input, name) {
    var b = bytesOf(input);
    if (!b) return { ok: false, error: '파일 내용을 읽지 못했습니다' };
    if (!b.length) return { ok: false, error: '빈 파일입니다' };
    if (b.length > MAX_BYTES) {
      return { ok: false, error: '파일이 너무 큽니다 — ' + Math.round(MAX_BYTES / 1048576) + 'MB 까지 열 수 있습니다', size: b.length };
    }
    var kind = kindOf(b, name);
    if (!kind) return { ok: false, error: '지원하지 않는 형식입니다 (한글·PDF·엑셀·CSV 만 열 수 있습니다)', size: b.length };
    if (NEXT_VERSION[kind]) {
      return { ok: false, kind: kind, size: b.length,
        error: LABELS[kind] + ' 파일은 다음 판에서 보여 드립니다 — 지금은 한글·PDF·엑셀만 열립니다' };
    }
    return { ok: true, kind: kind, size: b.length };
  }

  var api = { MAX_BYTES: MAX_BYTES, LABELS: LABELS, check: check, extOf: extOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PuViewerKind = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
