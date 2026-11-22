'use strict';
/* 강의자료 원본의 «내려받기 토큰» 정리 (2026-11-22)
   ① 올리기가 끝나는 순간 — 창고 트리거 edulibTokenStrip 이 그 파일 하나를 지운다(stripOne · 몇 초 안).
   ② 매일 밤 — edulibMailSweep 이 메일 정리 뒤에 edulib/ 전체를 훑어 빠진 것을 메운다(revokeTokens · 트리거 실패·배포 전 파일 대비).

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

function statusOf(e) { return +(e && (e.code || (e.response && e.response.status))) || 0; }

const REQ_TIMEOUT_MS = 20000;        /* 창고 요청 하나가 이보다 오래 걸리면 실패로 친다(밤 함수가 540초 안에 끝나게) */
const MAX_TRIES = 3;                 /* 412(그 사이 메타데이터가 바뀜)면 지금 판을 다시 읽어 이만큼까지 다시 해 본다 */
function withTimeout(p, ms) {
  let t = null;
  return Promise.race([
    Promise.resolve(p).finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => { const e = new Error('창고 요청이 ' + ms + 'ms 안에 끝나지 않았습니다'); e.code = 'TIMEOUT'; rej(e); }, ms); }),
  ]);
}
function fromMeta(name, md) {
  return { name, metadata: (md && md.metadata) || {}, generation: md && md.generation, metageneration: md && md.metageneration };
}
function ready(o) { return needsRevoke(o) && !!o.generation && !!o.metageneration; }

/* 파일 하나 — 창고 트리거(edulibTokenStrip)와 밤 정리(revokeTokens)가 함께 쓴다.
   obj: ObjectMetadata 꼴(name·generation·metageneration·metadata). 사진 창고 «모든» 파일에 불리므로 edulib/ 가 아니면 곧바로 끝낸다.
   알림에 토큰이 안 실려 왔거나 412(그 사이 다른 메타데이터가 바뀜)면 «지금 판»을 읽어 다시 한다(MAX_TRIES 까지) — 토큰이 남은 채 끝내지 않게.
   돌려줌: 'skip'(다른 자리) · 'none'(토큰 없음) · 'revoked' · 'changed'(되풀이해도 412 — 밤 정리가 메운다) · 'gone'(404).
   그 밖의 실패(시간 넘김 포함)는 던진다(트리거는 다시 시도, 밤 정리는 failed 로 센다). */
async function stripOne(obj, deps) {
  const name = obj && obj.name;
  if (!isEdulibObject(name)) return 'skip';
  const file = deps.bucket.file(name);
  let o = fromMeta(name, obj);
  for (let n = 0; n < MAX_TRIES; n++) {
    try {
      if (n > 0 || !ready(o)) {
        const [md] = await withTimeout(file.getMetadata(), REQ_TIMEOUT_MS);
        o = fromMeta(name, md);
        if (!ready(o)) return 'none';
      }
      await withTimeout(file.setMetadata(patchBody(), preconditionsOf(o)), REQ_TIMEOUT_MS);
      return 'revoked';
    } catch (e) {
      const st = statusOf(e);
      if (st === 404) return 'gone';
      if (st !== 412) throw e;
    }
  }
  return 'changed';
}

/* deps.bucket: @google-cloud/storage 의 Bucket(관리자) · deps.log
   opts.max: 한 번에 지울 상한 · opts.budgetMs: 쓸 수 있는 시간(밤 함수는 메일 정리와 540초를 나눠 쓴다 — 넘기면 다음 날 이어서) */
async function revokeTokens(deps, opts) {
  const bucket = deps.bucket;
  const log = deps.log || (() => {});
  const max = Math.max(1, Math.min(MAX_PER_RUN, (opts && +opts.max) || MAX_PER_RUN));
  const budgetMs = (opts && +opts.budgetMs > 0) ? +opts.budgetMs : Infinity;
  const t0 = Date.now();
  const left = () => budgetMs - (Date.now() - t0);
  /* 목록은 쪽(1000개)마다 — 남은 시간 안에서만, 쪽마다 시간 상한 */
  const files = [];
  let more = false;
  let query = { prefix: PREFIX, autoPaginate: false, maxResults: 1000 };
  while (query) {
    if (left() <= 0) { more = true; break; }
    const [page, next] = await withTimeout(bucket.getFiles(query), REQ_TIMEOUT_MS);
    (page || []).forEach((f) => files.push(f));
    query = (next && next.pageToken) ? Object.assign({}, query, { pageToken: next.pageToken }) : null;
  }
  const todo = files.map((f) => fromMeta(f.name, f.metadata || {})).filter(ready);
  const out = { listed: files.length, had: todo.length, revoked: 0, changed: 0, gone: 0, failed: 0, more: more || todo.length > max, ms: 0 };
  for (const o of todo.slice(0, max)) {
    if (left() <= 0) { out.more = true; break; }
    try {
      const r = await stripOne(o, { bucket });
      if (r === 'revoked') out.revoked++;
      else if (r === 'changed') out.changed++;
      else out.gone++;                    /* 'none'·'gone' — 그 사이 누가 지웠거나 파일이 없어졌다 */
    } catch (e) {
      out.failed++;
      log('edulibTokenSweep fail', String(o.name).split('/')[1], String((e && e.message) || e).slice(0, 120));
    }
  }
  out.ms = Date.now() - t0;
  return out;
}

module.exports = { PREFIX, KEY, MAX_PER_RUN, MAX_TRIES, REQ_TIMEOUT_MS, isEdulibObject, needsRevoke, patchBody, preconditionsOf, stripOne, revokeTokens };
