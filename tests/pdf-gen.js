/* 검사용 작은 PDF 만들개 — 글꼴은 PDF 기본(Helvetica)이라 영문·숫자만 쓴다(한글 글꼴을 심지 않는다).
   pages: [[{x, y, s, size, tc?, glyphs?}]] — 한 조각이 Tj 하나(tc: 글자 벌림, glyphs: 글자마다 따로). 쪽 크기 A4(595×842). */
'use strict';
function esc(s) { return String(s).replace(/([()\\])/g, '\\$1'); }
function makePdf(pages, opts) {
  const bodies = [];
  bodies.push('<< /Type /Catalog /Pages 2 0 R >>');                          // 1
  bodies.push(null);                                                           // 2 (Pages — 뒤에 채운다)
  bodies.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');      // 3
  const kids = [];
  (pages || []).forEach((items) => {
    /* 조각 하나: 기본은 Tj 하나. tc = 글자 사이 벌림(Tc), glyphs:true = 글자마다 Td/Tj 따로(step 간격, 기본 14) */
    const content = (items || []).map((t) => {
      const size = t.size || 12;
      if (t.glyphs) {
        const step = t.step || 14;
        return String(t.s).split('').map((ch, i) =>
          'BT /F1 ' + size + ' Tf ' + (t.x + i * step) + ' ' + t.y + ' Td (' + esc(ch) + ') Tj ET').join('\n');
      }
      return 'BT /F1 ' + size + ' Tf ' + (t.tc ? t.tc + ' Tc ' : '') + t.x + ' ' + t.y + ' Td (' + esc(t.s) + ') Tj ET';
    }).join('\n');
    bodies.push('<< /Length ' + Buffer.byteLength(content, 'latin1') + ' >>\nstream\n' + content + '\nendstream');
    const cid = bodies.length;
    bodies.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ' + cid + ' 0 R >>');
    kids.push(bodies.length + ' 0 R');
  });
  bodies[1] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';
  let out = '%PDF-1.4\n';
  const offs = [];
  bodies.forEach((b, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += (i + 1) + ' 0 obj\n' + b + '\nendobj\n'; });
  let encId = 0;
  if (opts && opts.encrypt) {   // 모르는 암호 필터 — pdf.js 는 UnknownErrorException('unknown encryption method') 로 던진다
    offs.push(Buffer.byteLength(out, 'latin1')); encId = bodies.length + 1;
    out += encId + ' 0 obj\n<< /Filter /FooDRM /V 1 /R 2 /P -4 /O (aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) /U (bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) >>\nendobj\n';
  }
  const xref = Buffer.byteLength(out, 'latin1');
  const total = bodies.length + (encId ? 1 : 0);
  out += 'xref\n0 ' + (total + 1) + '\n0000000000 65535 f \n'
    + offs.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += 'trailer\n<< /Size ' + (total + 1) + ' /Root 1 0 R' + (encId ? ' /Encrypt ' + encId + ' 0 R /ID [<00112233445566778899aabbccddeeff> <00112233445566778899aabbccddeeff>]' : '') + ' >>\nstartxref\n' + xref + '\n%%EOF\n';
  return Buffer.from(out, 'latin1');
}
module.exports = { makePdf };
