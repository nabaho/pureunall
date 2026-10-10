'use strict';
/* 🔒 이미 올린 것 서명본으로 옮기기 (2026-10-04 대표 「네」) — 가짜 자료만
   ⓐ 후보: 사진첩에서 온 보통 자리 원본 + 줄은 🔒 인데 원본은 보통 자리인 것. 이미 서명본·경로가 이상한 것은 빼기
   ⓑ 경로: pu_docs/secret/{id}/{파일 이름} — 규칙(path validate)과 같은 모양
   ⓒ 서버: 총괄관리자만, 후보를 서버가 다시 고름, 복사 → 토큰 지우기 → 기록 → 옛 파일 지우기 → 열람 기록, 주소 만들지 않음
   ⓓ 화면: 문서관리가 서버 길을 넘기고, 기업별 계약서에 버튼, 20개씩, 옮긴 뒤 주소 캐시 비우기 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const M = require('../functions/doc-secret-move.js');
const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');

const ID1 = 'Kph0to00000001', ID2 = 'Kfold000000002', ID3 = 'Ksecr000000003', ID4 = 'Kform000000004', ID5 = 'Kbadp000000005';
const originals = {
  [ID1]: { name: '자문계약서.jpg', path: 'pu_docs/originals/' + ID1 + '/자문계약서.jpg', at: 2, from: { kind: 'photo', coName: '가나상사' } },
  [ID2]: { name: '위임장.pdf', path: 'pu_docs/originals/' + ID2 + '/위임장.pdf', at: 3, from: { kind: 'folder', coName: '다라산업' } },
  [ID3]: { name: '서명본.pdf', path: 'pu_docs/secret/' + ID3 + '/서명본.pdf', at: 4, secret: true, from: { kind: 'photo' } },
  [ID4]: { name: '양식.hwp', path: 'pu_docs/originals/' + ID4 + '/양식.hwp', at: 5, from: { kind: 'form' } },
  [ID5]: { name: '이상.jpg', path: 'elsewhere/' + ID5 + '/이상.jpg', at: 6, from: { kind: 'photo' } },
};
const coDocs = {
  k1: { d1: { fileId: ID1, title: '자문계약서' } },
  k2: { d2: { fileId: ID2, title: '위임장', secret: true }, d3: { fileId: ID2, title: '위임장(사본)' } },
  k3: { d4: { fileId: ID4, title: '양식' } },
};

test('ⓐ 후보 — 사진첩 보통 자리 + 줄만 🔒, 서명본·양식·이상한 경로는 빼기', () => {
  const c = M.candidates(originals, coDocs);
  assert.deepStrictEqual(c.map(x => [x.fileId, x.why]), [[ID2, 'line'], [ID1, 'photo']]);
  assert.strictEqual(c[1].coName, '가나상사');
  assert.strictEqual(c[1].title, '자문계약서');
  assert.deepStrictEqual(M.candidates({}, {}), []);
  assert.deepStrictEqual(M.candidates(null, null), []);
});
test('ⓑ 경로 — pu_docs/secret/{id}/이름, 기업별 서류 줄은 🔒 아닌 것만', () => {
  assert.strictEqual(M.secretPath(ID1, originals[ID1]), 'pu_docs/secret/' + ID1 + '/자문계약서.jpg');
  assert.strictEqual(M.secretPath(ID3, originals[ID3]), '', '이미 서명본');
  assert.strictEqual(M.secretPath(ID5, originals[ID5]), '', '경로가 이상한 것');
  assert.deepStrictEqual(M.coDocPaths(coDocs, ID2), ['pu_docs/co_docs/k2/d3/secret']);
  assert.deepStrictEqual(M.coDocPaths(coDocs, ID1), ['pu_docs/co_docs/k1/d1/secret']);
  /* 규칙의 path validate 와 같은 모양인지 */
  const rules = read('scripts/make-firebase-rules.js');
  assert.match(rules, /beginsWith\('pu_docs\/secret\/' \+ \$id \+ '\/'\)/);
});
test('ⓒ 서버 — 총괄관리자만, 서버가 후보를 다시 고르고, 토큰을 지우고, 옛 파일을 지운다', () => {
  const src = read('functions/index.js');
  const a = src.indexOf('exports.puDocSecretMove'); assert.ok(a > 0);
  const f = src.slice(a, src.indexOf('\n  });\n', a));
  assert.match(f, /requireStaff\(req\)/);
  assert.match(f, /isAdmin !== true/);
  assert.match(f, /DocSecretMove\.candidates\(/);
  assert.match(f, /if \(!ok\[id\]\)/, '화면이 보낸 번호를 후보와 맞춰 봐야 한다');
  assert.match(f, /\.slice\(0, 20\)/);
  const iCopy = f.indexOf('.copy(dest)'), iTok = f.indexOf('firebaseStorageDownloadTokens: null'),
    iUp = f.indexOf('await db.ref().update(up)'), iDel = f.indexOf('.delete({ ignoreNotFound: true })'), iLog = f.indexOf('pu_docs/secret_log');
  assert.ok(iCopy > 0 && iCopy < iTok && iTok < iUp && iUp < iDel && iDel < iLog, '순서: 복사 → 토큰 지우기 → 기록 → 옛 파일 지우기 → 열람 기록');
  assert.doesNotMatch(f, /getSignedUrl|getDownloadURL/, '주소를 만들면 안 된다');
});
test('ⓓ 화면 — 서버 길, 버튼, 20개씩, 옮긴 뒤 주소 캐시 비우기', () => {
  const html = read('docs-esign.html');
  assert.match(html, /cloudfunctions\.net\/puDocSecretMove/);
  assert.match(html, /secretMove: secretMoveCall/);
  const docs = read('js/pu-office-docs.js');
  const a = docs.indexOf('function openSecretMove('), b = docs.indexOf('function walkEntry(');
  assert.ok(a > 0 && b > a);
  const f = docs.slice(a, b);
  assert.match(f, /host\.secretMove\(\{ mode: 'list' \}\)/);
  assert.match(f, /host\.secretMove\(\{ mode: 'move', fileIds: ch \}\)/);
  assert.match(f, /i \+= 20/);
  assert.match(f, /w\.confirm\(/);
  assert.match(f, /urlCache = \{\};/);
  assert.match(docs, /host\.secretMove \? \['🔒 서명본으로 옮기기'[^\n]*openSecretMove\]/, '「가져오기·정리」 메뉴 안에 있다(2026-10-10)');
});
