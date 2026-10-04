"use strict";
/* 문서관리 🔒 서명본으로 옮기기 — 순수 함수 (2026-10-04 대표 「네」)
   이미 원본 보관함 «보통 자리»(직원 누구나 여는 곳)에 올라간 계약서를 서명본 자리로 옮길 «후보»를 고른다.
   ⓐ 사진첩에서 가져온 것 — 사진첩에 있을 때는 서버 경유·열람 기록으로 보호됐다(2026-10-03 이전에 가져온 것).
   ⓑ 기업별 서류 줄은 🔒 인데 원본은 보통 자리인 것 — 같은 파일(해시)이 먼저 보통으로 올라가 있어 다시 쓴 경우.
   functions/index.js 의 puDocSecretMove 가 쓰고, tests/doc-secret-move.test.js 가 지킨다. */

const ID_RE = /^[-_A-Za-z0-9]{10,40}$/;

function isOpenOriginal(id, rec) {
  return !!rec && rec.secret !== true && ID_RE.test(String(id))
    && String(rec.path || "").indexOf("pu_docs/originals/" + id + "/") === 0;
}

/* originals: pu_docs/originals 전체, coDocs: pu_docs/co_docs 전체({coKey:{docId:{fileId,secret,...}}}) */
function candidates(originals, coDocs) {
  originals = originals || {};
  const wantSecret = {}, coNames = {};
  Object.keys(coDocs || {}).forEach(function (k) {
    const docs = coDocs[k] || {};
    Object.keys(docs).forEach(function (d) {
      const x = docs[d] || {};
      if (!x.fileId) return;
      if (x.secret === true) wantSecret[x.fileId] = true;
      if (!coNames[x.fileId] && x.title) coNames[x.fileId] = String(x.title);
    });
  });
  return Object.keys(originals).filter(function (id) {
    const rec = originals[id];
    if (!isOpenOriginal(id, rec)) return false;
    return (rec.from && rec.from.kind === "photo") || wantSecret[id] === true;
  }).map(function (id) {
    const rec = originals[id];
    return {
      fileId: id,
      name: String(rec.name || ""),
      coName: String((rec.from && rec.from.coName) || ""),
      title: coNames[id] || "",
      why: rec.from && rec.from.kind === "photo" ? "photo" : "line",
      at: Number(rec.at) || 0,
    };
  }).sort(function (a, b) { return b.at - a.at; });
}

/* 보통 자리 경로 → 서명본 자리 경로. 파일 이름은 그대로 */
function secretPath(id, rec) {
  if (!isOpenOriginal(id, rec)) return "";
  return "pu_docs/secret/" + id + "/" + String(rec.path).slice(("pu_docs/originals/" + id + "/").length);
}

/* 그 파일을 가리키는 기업별 서류 줄 — secret:true 로 바꿀 경로들 */
function coDocPaths(coDocs, fileId) {
  const out = [];
  Object.keys(coDocs || {}).forEach(function (k) {
    const docs = coDocs[k] || {};
    Object.keys(docs).forEach(function (d) {
      if (docs[d] && docs[d].fileId === fileId && docs[d].secret !== true) out.push("pu_docs/co_docs/" + k + "/" + d + "/secret");
    });
  });
  return out;
}

module.exports = { ID_RE, isOpenOriginal, candidates, secretPath, coDocPaths };
