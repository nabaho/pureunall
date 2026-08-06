'use strict';
// 파이프라인 조립 — 실행: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const P = require('../tools/forms_pipeline.js');
const TX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools', 'forms_taxonomy.json'), 'utf8'));

test('collectNames: 파일명 끝의 인명 후보를 뽑는다', () => {
  const names = P.collectNames([
    { rel: 'a/진정취하서_강지훈.hwp' },
    { rel: 'b/대리인 선임신고서_김석범.hwp' },
    { rel: 'c/위임약정서.hwp' },
  ]);
  assert.ok(names.includes('강지훈'));
  assert.ok(names.includes('김석범'));
  assert.strictEqual(names.length, 2);
});

test('collectNames: 서식 어휘는 인명으로 오인하지 않는다', () => {
  const names = P.collectNames([{ rel: 'a/진정서-양식.hwp' }, { rel: 'b/합의서-사본.hwp' }]);
  assert.deepStrictEqual(names, []);
});

test('buildForms: 복합 파일이 서식 단위로 펼쳐진다', () => {
  const recs = [{
    rel: '2. 임금체불/위임장-취하서.hwp', mtime: 1000, err: null,
    html: '<p>위   임   장</p><p>위임인 : ( 서 명 ) 성명 : ______</p>'
        + '<p>진정 취하서</p><p>취하인 : (인) 성명 : ______</p>',
  }];
  const forms = P.buildForms(recs, TX, []);
  assert.strictEqual(forms.length, 2);
  assert.strictEqual(forms[0].title, '위임장');
  assert.strictEqual(forms[1].title, '진정취하서');
});

test('buildForms: 같은 서식 3부가 1종으로 접히고 cluster에 경로가 남는다', () => {
  const body = '<p>위   임   장</p><p>위임인 : ( 서 명 ) 성명 : ______</p>';
  const recs = ['x/1.hwp', 'y/2.hwp', 'z/3.hwp'].map((rel, i) =>
    ({ rel, mtime: 1000 + i, err: null, html: body }));
  const forms = P.buildForms(recs, TX, []);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].source.cluster.length, 3);
});

test('buildForms: 변환 실패 레코드는 건너뛴다', () => {
  const forms = P.buildForms([{ rel: 'a.hwp', mtime: 1, err: '깨진 파일', html: '' }], TX, []);
  assert.strictEqual(forms.length, 0);
});

test('buildForms: 사건본만 있으면 익명화 후 pickedBy=anonymized-latest', () => {
  const recs = [{
    rel: '사건/청구서_홍길동.hwp', mtime: 5000, err: null,
    html: '<p>소액체당금 지급청구서</p><p>청구인 : 홍길동 (인) 790101-1234567</p>',
  }];
  const forms = P.buildForms(recs, TX, ['홍길동']);
  assert.strictEqual(forms.length, 1);
  assert.strictEqual(forms[0].source.pickedBy, 'anonymized-latest');
  assert.ok(forms[0].body.includes('{{주민등록번호}}'));
  assert.ok(!forms[0].body.includes('홍길동'));
  assert.ok(forms[0].review.flags.includes('구법용어'));
});

test('buildForms: id는 도메인 접두어를 갖고 유일하다', () => {
  const recs = [
    { rel: 'a/위임장.hwp',  mtime: 1, err: null, html: '<p>위   임   장</p><p>본문 하나</p>' },
    { rel: 'b/진정서.hwp',  mtime: 2, err: null, html: '<p>진   정   서</p><p>본문 둘</p>' },
  ];
  const forms = P.buildForms(recs, TX, []);
  const ids = forms.map(f => f.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => /^[a-z]+-[0-9a-f]{10}$/.test(id)));
});
