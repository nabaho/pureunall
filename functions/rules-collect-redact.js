/* 첨부 하나 가리기 — 서버에서 kordoc 를 부르는 «유일한» 자리 (설계 §4-2·§4-10-3)
   ⚠ 원본 바이트(buf)는 이 함수 밖으로 «가린 것이 아닌 채로» 나가지 않는다.
     돌려주는 data 는 가린 파일이거나, 찾은 것이 0일 때의 원본(= 가린 것과 같음)이다.
   ⚠ 남은 것이 있거나 못 읽으면 ok:false — 부르는 쪽은 아무것도 담지 않는다.
   ⚠ PDF 는 pdf.js 로 글만 뽑아 가린다(설계 §11-2) — 파일째 가리기는 없고 data 는 항상 null. */
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
const T = require('./vendor/kordoc/pu-kordoc-text.js');
/* PDF 는 pdf.js 로 글만 뽑는다(설계 §11-2) — kordoc 묶음에 PDF 부품이 없다 */
const PDF = require('./rules-collect-pdf');

/* 묶음 사본은 .mjs — .js 로 두면 functions 의 package.json(type 없음) 때문에 «모듈 형식 추측» 경고와 재해석이 생긴다 */
let ready = null;
function load() {
  if (!ready) ready = import(pathToFileURL(path.join(__dirname, 'vendor', 'kordoc', 'kordoc.browser.min.mjs')).href)
    .then((K) => { T._use(K); return K; });
  return ready;
}
/* 마지막 그물 — 주민·외국인번호 꼴(앞 6자리-뒤 7자리, 뒤 첫 자리 1~8). 가린 것(●)은 안 걸린다 */
/* \b 를 쓰지 않는다 — 앞뒤가 글자(A900101-1234567)에 붙어 있으면 \b 는 못 잡는다. 숫자만 아니면 걸리게 한다 */
const RAW_RE = /(?<!\d)\d{6}\s*-\s*[1-8]\d{6}(?!\d)/;
/* PDF 전용 두 번째 그물 — 글자 사이가 벌어진 PDF(자간·글자마다 위치)는 pdf.js 가 「9 0 0 1 0 1 - 1 2 3 4 5 6 7」 로 뽑아
   번호 규칙·RAW_RE 가 못 잡는다(최종 검토 실측). 숫자 사이 공백을 허락하고 «가린 글»에서 한 번 더 본다. */
const SPACED_RRN_RE = /(?<!\d)\d(?:[ \t]*\d){5}[ \t]*-[ \t]*[1-8](?:[ \t]*\d){6}(?!\d)/;   // 한 줄 안에서만 — \s 는 줄바꿈을 넘어 숫자 표를 잘못 잡는다
/* pdf.js 가 «문서 자체가 나쁨»으로 던지는 이름 — 이것만 「열지 못함」으로 닫는다. 그 밖(싣기·메모리·환경)은 문서 탓이 아니므로 다시 본다 */
const PDF_DOC_ERRORS = ['InvalidPDFException', 'PasswordException', 'FormatError', 'MissingPDFException', 'UnexpectedResponseException'];

/* impl 은 «검사 전용» 이음매 — 실제 호출은 넘기지 않는다(기본 T). 닫는 쪽 가지를 결정적으로 시험하려는 것뿐 */
async function redactOne(buf, ext, impl) {
  const U = impl || T;
  if (!impl) await load();
  const bytes = new Uint8Array(buf);
  let read = null, pdfMeta = null;
  if (ext === 'pdf') {
    /* PDF (설계 §11-2) — pdf.js 로 글만 뽑는다. 가림·마지막 그물은 아래 같은 길.
       pdf.js 를 못 실으면 옛 까닭으로 남긴다(다음에 다시 본다). 열지 못하면 「열지 못함」으로 보류 */
    const pdfText = (impl && impl.pdfText) || PDF.pdfText;
    let got;
    try { got = await pdfText(buf); }
    catch (e) {
      /* 문서 오류만 「열지 못함」(영구). 모르는 암호 방식은 pdf.js 가 UnknownErrorException(…encrypt…) 로 던지므로 문서 탓이다.
         pdf.js 못 실음(PDFJS_MISSING)은 env:true — 부르는 쪽이 이번 다시 보기를 통째로 멈춘다. 그 밖의 모르는 실패는 옛 까닭이되 env 없음 */
      const docBad = e && e.code !== 'PDFJS_MISSING' && (PDF_DOC_ERRORS.indexOf(e.name) >= 0
        || (e.name === 'UnknownErrorException' && /encrypt|password/i.test(String(e.message || ''))));
      if (docBad) return { ok: false, holdWhy: 'PDF 를 열지 못함', count: {}, total: 0 };
      return { ok: false, holdWhy: 'PDF — 아직 못 읽음', env: !!(e && e.code === 'PDFJS_MISSING'), count: {}, total: 0 };
    }
    if (!got || !(Number(got.chars) >= PDF.SCAN_MIN)) return { ok: false, holdWhy: '스캔 PDF — 글 없음', count: {}, total: 0 };
    read = { text: got.text };
    pdfMeta = { truncated: !!got.truncated, pages: got.pages };
  } else {
    try { read = await U.read(bytes); } catch (_) { read = null; }
  }
  if (!read || !read.text) return { ok: false, holdWhy: '글을 읽지 못함', count: {}, total: 0 };
  let r;
  try { r = await U.redactFile(bytes, read.text); }
  catch (_) { return { ok: false, holdWhy: '가리다 실패함', count: {}, total: 0 }; }
  if (r.residual > 0) return { ok: false, holdWhy: '가린 뒤에도 남음 ' + r.residual, count: r.count, total: r.total };
  /* 못 훑은 글이 있으면 «남은 것이 없다» 를 믿을 수 없다 — 찾은 것이 0이어도 원본을 내보내지 않는다 */
  if (r.unscanned > 0) return { ok: false, holdWhy: '검사 못 한 부분 있음 ' + r.unscanned, count: r.count, total: r.total };
  if (RAW_RE.test(r.text)) return { ok: false, holdWhy: '가린 글에 주민번호 꼴이 남음', count: r.count, total: r.total };
  if (ext === 'pdf' && SPACED_RRN_RE.test(r.text)) return { ok: false, holdWhy: '가린 글에 주민번호 꼴이 남음', count: r.count, total: r.total };
  const isHwp = ext === 'hwp' || ext === 'hwpx';
  /* 마지막 그물이 다시 읽은 글에서 더 찾았으면(leak) — 파일(가린 것이든 원본이든)을 믿지 않는다. 가린 «글만» 담는다 (2026-10-05).
     ⚠ 전에는 파일째 가리기가 아무것도 못 찾으면 «원본 파일»을 그대로 내보냈다 — 표 칸 속 번호가 원본째 창고에 들어갔다. */
  if (r.leak) return Object.assign({ ok: true, format: ext, text: r.text, data: null, count: r.count, total: r.total, leak: r.leak },
    pdfMeta ? { truncated: pdfMeta.truncated, pages: pdfMeta.pages } : {});
  /* 찾았는데 가린 파일을 못 받았으면 원본을 내보낼 수 없다 — 보류 */
  if (isHwp && r.total && !r.data) return { ok: false, holdWhy: '가린 파일을 만들지 못함', count: r.count, total: r.total };
  const data = !isHwp ? null : (r.total ? r.data : bytes);
  const ok = { ok: true, format: ext, text: r.text, data, count: r.count, total: r.total };
  if (pdfMeta) { ok.truncated = pdfMeta.truncated; ok.pages = pdfMeta.pages; }   // 쪽 한도에 잘렸는지 — 부르는 쪽이 문서 줄에 적는다
  return ok;
}
/* 이미 담긴 글을 다시 훑는다 (2026-10-05) — 같은 규칙 한 벌(T.rulesOf 기본)로 글 가림만.
   돌려주는 것: { leak(새로 찾은 수), count, text(가린 글 — 찾은 것이 없으면 그대로) } */
async function recheck(text) {
  const K = await load();
  const p = K.redactText(String(text || ''), { rules: T.rulesOf() });
  const t = T.tally(p.hits);
  return { leak: t.total, count: t.count, text: t.total ? p.text : String(text || '') };
}
module.exports = { redactOne, recheck, RAW_RE, load };
