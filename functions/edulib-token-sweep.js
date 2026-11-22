'use strict';
/* 강의자료 원본의 «내려받기 토큰» 정리 — 매일 밤 edulibMailSweep 이 메일 정리 뒤에 함께 부른다 (2026-11-22)

   ■ 왜
   강의자료 앱은 원본을 «로그인 증표»로만 받는다(js/pu-edulib-app.js 의 fetchOriginal — 창고 규칙 isStaff() 를 매번 거친다).
   그런데 화면에서 파일을 올리면 파이어베이스가 토큰을 저절로 붙인다(막을 수 없다). 앱은 그 토큰을 만들지도 쓰지도 않으므로
   남겨 둘 까닭이 없다 — 매일 한 번 지워, 원본으로 가는 길을 «권한 확인» 하나로 모은다.
   사람이 바로 돌릴 때는 scripts/edulib-revoke-download-tokens.js(같은 판정 함수를 쓴다 — 기본 보기만).

   ■ 지키는 것
   - 자리는 edulib/{id}/{이름} 꼴만 — 사진첩·서고 같은 다른 앱의 파일은 건드리지 않는다(그 앱들은 토큰 주소를 아직 쓴다).
   - 메타데이터의 firebaseStorageDownloadTokens «하나만» null 로 — 내용(바이트)·이름·다른 메타데이터는 그대로(원본 보존).
   - ifGenerationMatch + ifMetagenerationMatch — 그 사이 바뀌거나 갈아 끼운 파일은 건너뛴다(412 = changed).
   - 토큰 값은 기록·출력하지 않는다. 개수만 돌려준다. */

const PREFIX = 'edulib/';
const KEY = 'firebaseStorageDownloadTokens';
const MAX_PER_RUN = 3000;            /* 한 번에 지우는 상한 — 넘으면 다음 날 이어서(more) */

/* edulib/{id}/{이름} — 마디가 비었거나 «.»·«..» 인 이름만 거부한다(이름 안의 연속 마침표는 괜찮다) */
function isEdulibObject(name) {
  if (typeof name !== 'string' || name.indexOf(PREFIX) !== 0) return false;
  const seg = name.split('/');
  return seg.length >= 3 && seg.every((s) => s !== '' && s !== '.' && s !== '..');
}
/* o: { name, metadata: { 사용자 메타데이터 } } */
function needsRevoke(o) {
  const m = o && o.metadata;
  return !!(o && isEdulibObject(o.name) && m && typeof m[KEY] === 'string' && m[KEY] !== '');
}
/* 사용자 메타데이터에서 «그 열쇠 하나»를 null 로 보내면 그 열쇠만 지워진다(합치기) */
function patchBody() { return { metadata: { [KEY]: null } }; }
function preconditionsOf(o) {
  return { ifGenerationMatch: String(o.generation), ifMetagenerationMatch: String(o.metageneration) };
}

/* deps.bucket: @google-cloud/storage 의 Bucket(관리자) · deps.log */
async function revokeTokens(deps, opts) {
  const bucket = deps.bucket;
  const log = deps.log || (() => {});
  const max = Math.max(1, Math.min(MAX_PER_RUN, (opts && +opts.max) || MAX_PER_RUN));
  const t0 = Date.now();
  const [files] = await bucket.getFiles({ prefix: PREFIX, autoPaginate: true });
  const todo = [];
  for (const f of files) {
    const md = f.metadata || {};
    const o = { name: f.name, metadata: md.metadata || {}, generation: md.generation, metageneration: md.metageneration };
    if (needsRevoke(o) && o.generation && o.metageneration) todo.push({ f, o });
  }
  const out = { listed: files.length, had: todo.length, revoked: 0, changed: 0, failed: 0, more: todo.length > max, ms: 0 };
  for (const { f, o } of todo.slice(0, max)) {
    try {
      await f.setMetadata(patchBody(), preconditionsOf(o));
      out.revoked++;
    } catch (e) {
      const code = e && (e.code || (e.response && e.response.status));
      if (+code === 412) out.changed++;
      else { out.failed++; log('edulibTokenSweep fail', String(o.name).split('/')[1], String((e && e.message) || e).slice(0, 120)); }
    }
  }
  out.ms = Date.now() - t0;
  return out;
}

module.exports = { PREFIX, KEY, MAX_PER_RUN, isEdulibObject, needsRevoke, patchBody, preconditionsOf, revokeTokens };
