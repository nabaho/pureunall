'use strict';
/* 기금 서류 «원본 파일» 보관 (대표 지시 2026-10-03 「원본보관도 가능하게 해달라」)
 * 사진첩 그림은 PDF 첫 쪽뿐 — 원래 파일(여러 쪽 전부)을 창고에 함께 올리고, 기금 연결(scans)에 적고, [보기]에서 받게 한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
const gF = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };

function 상자(putFails) {
  const 기록 = { photo: null, ref: null, toast: [] };
  const box = {};
  new Function('기록', 'putFails', [
    'var S={user:"테스트"}; var funds={X:{name:"가나다공동근로복지기금",short_name:"가나다"}};',
    'function photoStoreReady(){ return true; }',
    'function toast(m){ 기록.toast.push(m); }',
    'function docZoneLabel(k){ return ({inka:"설립인가증"})[k]||k; }',
    'function _docToImage(){ return Promise.resolve({full:"data:f",thumb:"data:t"}); }',
    'function saveScanRef(fid,kind,ref){ 기록.ref={fid:fid,kind:kind,ref:ref}; }',
    'var PuPhotoStore={ newId:function(){ return "id"+(++this.n); }, n:0, yearOf:function(){ return "2026"; }, myUid:function(){ return "u1"; },',
    '  putOriginal:function(key,year,blob,name){ return putFails?Promise.reject(new Error("창고 없음")):Promise.resolve({key:key,year:year,url:"https://x/o?token=1",name:name,size:blob.size}); },',
    '  savePhoto:function(p){ 기록.photo=p; return Promise.resolve(); } };',
    gF('_keepDocOriginal'),
    'this.keep=_keepDocOriginal;',
  ].join('\n')).call(box, 기록, putFails);
  return { box, 기록 };
}

test('★ 원본 파일을 창고에 올리고 사진(meta.doc.orig)과 기금 연결(scans.orig) 양쪽에 적는다', async () => {
  const { box, 기록 } = 상자(false);
  await box.keep('inka', { name: '설립인가증.pdf', size: 1234 }, 'X');
  assert.equal(기록.photo.meta.doc.orig.url, 'https://x/o?token=1');
  assert.equal(기록.photo.meta.doc.name, '설립인가증.pdf');
  assert.deepEqual(기록.ref.ref.orig, { name: '설립인가증.pdf', url: 'https://x/o?token=1', size: 1234, key: 'id1', year: '2026' });
  assert.equal(기록.ref.kind, 'inka');
});

test('원본 담기가 실패해도 그림 보관·연결은 그대로 — 대신 알린다, undefined 칸을 만들지 않는다', async () => {
  const { box, 기록 } = 상자(true);
  await box.keep('inka', { name: 'a.pdf', size: 1 }, 'X');
  assert.ok(기록.photo, '그림은 보관');
  assert.ok(!('doc' in 기록.photo.meta), '실시간DB 는 undefined 칸을 거부한다');
  assert.ok(!('orig' in 기록.ref.ref));
  assert.match(기록.toast.join(' '), /원본 파일은 못 담았습니다/);
});

test('[보기] 창에 원본 파일 받기 단추', () => {
  assert.match(gF('openScan'), /r\.orig&&r\.orig\.url/);
  assert.match(gF('openScan'), /⬇ 원본 파일/);
});
