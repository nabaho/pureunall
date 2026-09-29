'use strict';
/* 📮 기본정보 주소마다 우편번호 (대표 지시 2026-09-29 「개인정보관리 주소 에 모두 우편번호 필요하다」)
   못 박는 것:
     ① 집·사무실 주소 줄마다 우편번호 칸과 📮 찾기가 «그 줄 안»에 있다
     ② 서식의 「우편번호」를 알아보고, 회사·사무실 우편번호는 따로 알아본다
     ③ 우편번호는 «그 주소의 짝»이다 — 집 주소가 나가면 집 우편번호만(사무실 것을 섞지 않는다)
     ④ 저장은 기본정보 저장 한 곳(savePersonalInfo)을 지난다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const X = require('../js/kcareer-hwpxfill.js');
const html = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

test('① 주소 줄마다 우편번호 칸 + 📮 찾기', () => {
  assert.match(html, /\['zipHome','집 우편번호'\],\['addrHome','집 주소'\],\['zipWork','사무실 우편번호'\],\['addr','사무실 주소'\]/);
  assert.match(html, /const PI_ZIP_OF=\{addrHome:'zipHome', addr:'zipWork'\};/);
  assert.match(html, /onclick="piZipFind\('\$\{k\}','\$\{zk\}'\)"/);
  const fn = html.slice(html.indexOf('async function piZipFind('), html.indexOf('async function firmZipFind('));
  assert.match(fn, /kcAddrSearch\(/, '어제 만든 우편번호 찾기 창을 써야 한다');
  assert.match(fn, /savePersonalInfo\(\)/, '넣고 곧바로 저장해야 한다');
  assert.match(fn, /!a\.value\.trim\(\) && r\.address/, '적어 둔 주소는 덮지 않는다(건물명·호수가 줄어든다)');
});

test('② 서식 라벨 — 「우편번호」는 주소와 같은 곳, 회사·사무실 우편번호는 따로, 법인은 그대로', () => {
  assert.equal(X.fieldKeyOf('우편번호'), 'zip');
  assert.equal(X.fieldKeyOf('자택우편번호'), 'zip');
  assert.equal(X.fieldKeyOf('사무실우편번호'), 'zipWork');
  assert.equal(X.fieldKeyOf('회사 우편번호'), 'zipWork');
  assert.equal(X.fieldKeyOf('법인우편번호'), 'firmZip', '법인 것은 뒷걸음질하면 안 된다');
  assert.ok(X.FIELD_FILL_KEYS.indexOf('zip') >= 0 && X.FIELD_FILL_KEYS.indexOf('zipWork') >= 0);
});

test('③ 우편번호는 그 주소의 짝 — 집 주소가 나가면 집 우편번호만', () => {
  const fn = html.slice(html.indexOf('function _cvFillData('));
  assert.match(fn, /zip:집\?\(info\.zipHome\|\|''\):\(법인\.zip\|\|info\.zipWork\|\|''\), zipWork:법인\.zip\|\|info\.zipWork\|\|''/);
});

test('④ 칸 지도에서 손으로 고를 수도 있다', () => {
  assert.match(html, /\['zip','우편번호\(주소와 같은 곳\)'\],\['zipWork','사무실 우편번호'\]/);
  assert.match(html, /<script src="js\/kcareer-hwpxfill\.js\?v=\d+"><\/script>/);
});
