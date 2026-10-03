/* 첨부 하나 가리기 — 서버에서 kordoc 를 부르는 «유일한» 자리 (설계 §4-2·§4-10-3)
   ⚠ 원본 바이트(buf)는 이 함수 밖으로 «가린 것이 아닌 채로» 나가지 않는다.
     돌려주는 data 는 가린 파일이거나, 찾은 것이 0일 때의 원본(= 가린 것과 같음)이다.
   ⚠ 남은 것이 있거나 못 읽으면 ok:false — 부르는 쪽은 아무것도 담지 않는다. */
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
const T = require('./vendor/kordoc/pu-kordoc-text.js');

/* 묶음 사본은 .mjs — .js 로 두면 functions 의 package.json(type 없음) 때문에 «모듈 형식 추측» 경고와 재해석이 생긴다 */
let ready = null;
function load() {
  if (!ready) ready = import(pathToFileURL(path.join(__dirname, 'vendor', 'kordoc', 'kordoc.browser.min.mjs')).href)
    .then((K) => { T._use(K); return K; });
  return ready;
}
/* 마지막 그물 — 주민·외국인번호 꼴(앞 6자리-뒤 7자리, 뒤 첫 자리 1~8). 가린 것(●)은 안 걸린다 */
const RAW_RE = /\b\d{6}\s*-\s*[1-8]\d{6}\b/;

async function redactOne(buf, ext) {
  if (ext === 'pdf') return { ok: false, holdWhy: 'PDF — 아직 못 읽음', count: {}, total: 0 };
  await load();
  const bytes = new Uint8Array(buf);
  let read = null;
  try { read = await T.read(bytes); } catch (_) { read = null; }
  if (!read || !read.text) return { ok: false, holdWhy: '글을 읽지 못함', count: {}, total: 0 };
  let r;
  try { r = await T.redactFile(bytes, read.text); }
  catch (_) { return { ok: false, holdWhy: '가리다 실패함', count: {}, total: 0 }; }
  if (r.residual > 0) return { ok: false, holdWhy: '가린 뒤에도 남음 ' + r.residual, count: r.count, total: r.total };
  if (RAW_RE.test(r.text)) return { ok: false, holdWhy: '가린 글에 주민번호 꼴이 남음', count: r.count, total: r.total };
  const isHwp = ext === 'hwp' || ext === 'hwpx';
  /* 찾았는데 가린 파일을 못 받았으면 원본을 내보낼 수 없다 — 보류 */
  if (isHwp && r.total && !r.data) return { ok: false, holdWhy: '가린 파일을 만들지 못함', count: r.count, total: r.total };
  const data = !isHwp ? null : (r.total ? r.data : bytes);
  return { ok: true, format: ext, text: r.text, data, count: r.count, total: r.total };
}
module.exports = { redactOne, RAW_RE, load };
