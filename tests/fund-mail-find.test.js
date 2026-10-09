'use strict';
/* 📨 메일에서 찾기 — 「기계가 스스로 읽기」를 작게 (2026-10-09). 이름·주소는 전부 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
const fnSrc = (n) => { const i = SRC.indexOf('function ' + n + '('); assert.ok(i >= 0, '없음 ' + n); let d = 0;
  for (let k = SRC.indexOf('{', i); k < SRC.length; k++) { if (SRC[k] === '{') d++; else if (SRC[k] === '}') { d--; if (!d) return SRC.slice(i, k + 1); } } };
const varSrc = (n) => { const i = SRC.indexOf('var ' + n + '='); assert.ok(i >= 0, '없음 ' + n); return SRC.slice(i, SRC.indexOf(';\n', i) + 1); };

const box = {};
new Function([
  varSrc('MF_KINDS'), fnSrc('_cardFundKey'), fnSrc('_mfKind'), fnSrc('_mfKeys'), fnSrc('_mfScore'), fnSrc('_mfNeed'),
  'this.kind=_mfKind; this.keys=_mfKeys; this.score=_mfScore; this.need=_mfNeed;',
].join('\n')).call(box);

test('★ 서류 종류 — 첨부·제목 글자로', () => {
  assert.equal(box.kind('가람_등기사항전부증명서.pdf'), 'corpreg');
  assert.equal(box.kind('법인등기부등본(말소포함).pdf'), 'corpreg');
  assert.equal(box.kind('고유번호증 사본.jpg'), 'taxid');
  assert.equal(box.kind('설립인가증.pdf'), 'inka');
  assert.equal(box.kind('재무현황.xlsx'), '');
});

test('★ 이 기금 메일인가 — 보낸 사람 메일·기금 이름 · 첨부 없으면 0', () => {
  const f = { name: '가람공동근로복지기금', short_name: '가람 1호' };
  const sites = [{ name: '가나산업', email: 'Kim@Gana.co.kr', contacts: [{ name: '김가람', email: 'staff@dara.kr' }] }];
  const K = box.keys(f, sites);
  assert.ok(K.mails['kim@gana.co.kr'] && K.mails['staff@dara.kr'], '사업장·담당자 메일을 안 모았다');
  assert.ok(K.names.includes('가람'), '«근로복지기금» 뗀 이름이 없다');
  assert.equal(box.score({ a: 1, e: 'staff@dara.kr', s: '자료 보냅니다' }, K), 3);
  assert.equal(box.score({ a: 2, e: 'x@y.kr', s: '[가람공동근로복지기금] 등기부 송부' }, K), 3, '이름+서류 낱말');
  assert.equal(box.score({ a: 0, e: 'staff@dara.kr', s: '등기부' }, K), 0, '첨부 없는 메일을 골랐다');
  assert.equal(box.score({ a: 1, e: 'x@y.kr', s: '나래 기금 등기부' }, K), 0, '다른 기금 메일을 골랐다');
});

test('★ 빈 칸 알림 — 찾는 다섯 칸 중 빈 것만', () => {
  assert.deepEqual(box.need({ corp_reg_no: '', tax_id_no: '000-82-00000', inka_no: 'x', inka_date: '', reg_date: '2020-01-01' }), ['법인등록번호', '인가일']);
});

test('★ 배선 — 읽기만 · peek · 판독은 기존 길(readDocInto) · □·# · ⓘ · 단추', () => {
  const mf = fnSrc('mailFind');
  assert.match(mf, /_mfCall\('readMailMessage',\{slug:x\.m\.slug, uid:String\(x\.m\.uid\), peek:1\}\)/, '읽음 표시를 건드린다');
  assert.match(mf, /\.slice\(0,MF_TOP\)/, '첨부 목록을 모든 메일에 묻는다');
  assert.doesNotMatch(SRC.slice(SRC.indexOf('/* ══ 📨 메일에서 찾기'), SRC.indexOf('function mailFindRead(')), /sendMail|flagMail|deleteMail|\.set\(|\.update\(|\.remove\(/, '메일·자료를 바꾸는 길이 있다');
  const rd = fnSrc('mailFindRead');
  assert.match(rd, /readDocInto\(\{inka:'dz-inka',corpreg:'dz-corpreg',taxid:'dz-taxid'\}\[kind\], kind, file\)/, '기존 판독·확인 길을 안 탄다');
  assert.match(rd, /if\(!kind\|\|!DOC_PARSE\[kind\]\)/);
  assert.match(fnSrc('renderMailFind'), /<th style="width:34px">□<\/th><th style="width:40px">#<\/th>/);
  assert.match(SRC, /onclick="mailFind\(\)"/);
  assert.match(SRC, /'doc\.mail':\{t:'메일에서 서류 찾기'/);
});
