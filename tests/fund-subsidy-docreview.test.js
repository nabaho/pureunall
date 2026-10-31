'use strict';
/* 참여사 제출서류 자동 검토 (대표 지시 2026-10-31, 목업 승인 「추천대로」)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 기금·회사·사람·번호는 전부 지어낸 것이다.
 * node --test tests/fund-subsidy-docreview.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8').replace(/\r\n/g, '\n');
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + name);
}
function grabVar(name) {            // 줄 맨 앞 «var NAME=…;» — 끝은 «;» 바로 뒤 줄바꿈
  const i = SRC.indexOf('\nvar ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 var 가 없다: ' + name);
  const j = SRC.indexOf(';\n', i);
  return SRC.slice(i + 1, j + 1);
}
const B = (() => {
  const box = {};
  new Function([
    grabFn('subNormCo'), grabFn('_flat'), grabFn('_cleanCoName'), grabFn('_cleanAddr'),
    grabVar('RV_AREA'), grabVar('RV_PICK'),
    "var SUB_SITE_DOCS=[['sme','중소기업확인서'],['reg','등기부등본'],['bizno','사업자등록증']];",
    grabFn('rvNormAddr'), grabFn('_rvSameDigits'), grabFn('_rvSameName'), grabFn('_rvSameCeo'), grabFn('_rvSameAddr'),
    grabFn('parseSiteReg'), grabFn('rvPickRead'), grabFn('docCompare'), grabFn('docCellState'), grabFn('_rvDiffText'), grabFn('rvRemindText'),
    'this.cmp=docCompare; this.cell=docCellState; this.reg=parseSiteReg; this.pick=rvPickRead; this.addr=rvNormAddr; this.remind=rvRemindText; this.diffText=_rvDiffText;',
  ].join('\n')).call(box);
  return box;
})();

const SITE = { name: '예시전자(주)', ceo: '이○○', biz_no: '123-45-67890', corp_no: '110111-1234567', address: '충남 천안시 서북구 예시로 1' };
const res = (c, k) => c.items.find((x) => x.k === k).res;

test('사업자등록증 — 법인 꼬리말·띄어쓰기·시도 이름이 달라도 같은 것으로 본다', () => {
  const c = B.cmp('bizno', { biz_no: '1234567890', name: '예시전자 주식회사', ceo: '이 ○○', address: '충청남도 천안시 서북구 예시로 1, 2층' }, SITE, '', '2026-10-31');
  assert.equal(c.st, 'match');
  assert.deepEqual(c.items.map((x) => x.res), ['ok', 'ok', 'ok', 'ok']);
});

test('사업자등록증 — 다름은 항목 이름과 함께 나온다(번호·대표자·상호)', () => {
  const c = B.cmp('bizno', { biz_no: '123-46-67890', name: '예시푸드', ceo: '김○○', address: '충남 천안시 서북구 예시로 1' }, SITE, '', '2026-10-31');
  assert.equal(c.st, 'diff');
  assert.equal(res(c, 'biz_no'), 'diff'); assert.equal(res(c, 'name'), 'diff'); assert.equal(res(c, 'ceo'), 'diff'); assert.equal(res(c, 'address'), 'ok');
});

test('★ 못 읽었거나 우리 정보에 값이 없으면 «일치»라고 하지 않는다 — 못 읽음으로 둔다', () => {
  // 서류에서 사업자번호를 못 읽음 → 상호가 같아도 일치가 아니다(필수 항목이 비었다)
  const a = B.cmp('bizno', { name: '예시전자' }, SITE, '', '2026-10-31');
  assert.equal(a.st, 'unk'); assert.equal(res(a, 'biz_no'), 'unk');
  // 우리 사업장에 사업자번호가 없으면 맞춰 볼 수 없다 — na, 역시 일치가 아니다
  const b = B.cmp('bizno', { biz_no: '123-45-67890', name: '예시전자' }, Object.assign({}, SITE, { biz_no: '' }), '', '2026-10-31');
  assert.equal(res(b, 'biz_no'), 'na'); assert.equal(b.st, 'unk');
  // 하나라도 «다름»이 있으면 못 읽은 칸이 있어도 다름이 먼저다
  const c = B.cmp('bizno', { name: '예시푸드' }, SITE, '', '2026-10-31');
  assert.equal(c.st, 'diff');
  // 아무것도 못 읽음
  assert.equal(B.cmp('bizno', {}, SITE, '', '2026-10-31').st, 'unk');
});

test('중소기업확인서 — 유효기간이 «신청일»을 덮는지, 신청일이 없으면 오늘 기준(그렇다고 적는다)', () => {
  const R = { sme_cert: '중소기업', sme_from: '2026-04-01', sme_to: '2027-03-31', name: '예시전자' };
  assert.equal(B.cmp('sme', R, SITE, '2026-04-10', '2026-10-31').st, 'match');
  // 지난 확인서 — 작년 기간
  const old = B.cmp('sme', Object.assign({}, R, { sme_from: '2025-04-01', sme_to: '2026-03-31' }), SITE, '2026-04-10', '2026-10-31');
  assert.equal(old.st, 'diff'); assert.equal(res(old, 'period'), 'diff');
  // 신청일이 기간 시작 «전»이면 아직 안 된 확인서
  assert.equal(res(B.cmp('sme', R, SITE, '2026-03-30', '2026-10-31'), 'period'), 'diff');
  // 신청일 미입력 → 오늘 기준, 그 사실이 기준 칸에 적힌다
  const noDate = B.cmp('sme', R, SITE, '', '2026-10-31');
  assert.equal(noDate.st, 'match');
  assert.match(noDate.items.find((x) => x.k === 'period').have, /신청일 미입력/);
  // 기간을 못 읽으면 지어내지 않는다
  assert.equal(B.cmp('sme', { sme_cert: '중소기업', name: '예시전자' }, SITE, '', '2026-10-31').st, 'unk');
});

test('중소기업확인서 — «해당 없음»·중견기업은 다름(대상이 아닐 수 있다)', () => {
  const R = { sme_from: '2026-04-01', sme_to: '2027-03-31', name: '예시전자' };
  assert.equal(res(B.cmp('sme', Object.assign({ sme_cert: '해당 없음' }, R), SITE, '2026-04-10', ''), 'sme_cert'), 'diff');
  assert.equal(res(B.cmp('sme', Object.assign({ sme_cert: '중견기업' }, R), SITE, '2026-04-10', ''), 'sme_cert'), 'diff');
  assert.equal(res(B.cmp('sme', Object.assign({ sme_cert: '소기업' }, R), SITE, '2026-04-10', ''), 'sme_cert'), 'ok');
});

test('등기부등본 — 번호·상호·소재지를 맞추고, 발급일은 «참고»로만 보인다(판정하지 않음)', () => {
  const c = B.cmp('reg', { corp_no: '110111-1234567', name: '예시전자 주식회사', address: '충청남도 천안시 서북구 예시로 1', issued: '2020-01-01' }, SITE, '', '2026-10-31');
  assert.equal(c.st, 'match');                                    // 5년 전 발급이어도 요건을 모르니 판정하지 않는다
  assert.equal(res(c, 'issued'), 'info');
  assert.equal(B.cmp('reg', { name: '예시전자 주식회사' }, SITE, '', '').st, 'match');   // 필수는 상호 하나
  assert.equal(B.cmp('reg', { name: '다른회사' }, SITE, '', '').st, 'diff');
});

test('★ 등기부 판독 — 법인등록번호는 «등록번호» 이름표 뒤만, 주민등록번호는 읽지 않는다', () => {
  const txt = '등기번호 123456 등록번호 110111-1234567 상호 예시전자 주식회사 본점 충청남도 천안시 서북구 예시로 1 공고방법 서울특별시 내 일간신문 '
    + '임원 대표이사 김○○ 710101-1234567 거주지 충남 발행일 2026/04/01';
  const o = B.reg(txt);
  assert.equal(o.corp_no, '110111-1234567');
  assert.equal(o.name, '예시전자 주식회사');
  assert.match(o.address, /천안시 서북구/);
  assert.equal(o.issued, '2026-04-01');
  assert.ok(!JSON.stringify(o).includes('710101'), '주민등록번호가 결과에 들어오면 안 된다');
  // 이름표가 없으면 주민번호 모양의 숫자를 법인번호로 읽지 않는다
  assert.equal(B.reg('대표이사 김○○ 710101-1234567').corp_no, undefined);
  // 항목이 하나도 없으면 빈 결과
  assert.deepEqual(B.reg('아무 글자나'), {});
});

test('저장할 칸만 고른다 — 빈 값·남의 칸은 버리고, 하나도 없으면 null', () => {
  assert.deepEqual(B.pick('bizno', { biz_no: ' 123-45-67890 ', name: '', ceo: undefined, open_date: '2015-03-02' }), { biz_no: '123-45-67890' });
  assert.equal(B.pick('sme', { open_date: 'x' }), null);
  assert.equal(B.pick('reg', null), null);
});

test('칸 상태 — 미수령·사람 체크·안 읽음·읽음(일치·다름·못 읽음)·확인함, 사진을 바꾸면 읽은 값을 버린다', () => {
  const ref = { id: 'p1', year: '2026', owner: 'u' };
  const rv = { src: 'p1', read: { biz_no: '123-45-67890', name: '예시전자' } };
  assert.equal(B.cell('bizno', null, null, null, SITE, '', '2026-10-31').k, 'none');
  assert.equal(B.cell('bizno', null, 1, null, SITE, '', '2026-10-31').k, 'manual');      // 기존 사람 체크는 그대로 «받음»
  assert.equal(B.cell('bizno', ref, 1, null, SITE, '', '2026-10-31').k, 'got');
  assert.equal(B.cell('bizno', ref, 1, rv, SITE, '', '2026-10-31').k, 'match');
  assert.equal(B.cell('bizno', ref, 1, { src: 'p1', read: { biz_no: '999-99-99999', name: '예시전자' } }, SITE, '', '2026-10-31').k, 'diff');
  assert.equal(B.cell('bizno', ref, 1, { src: 'p1', fail: '글자는 읽었지만 항목을 못 찾았습니다' }, SITE, '', '2026-10-31').k, 'unk');
  assert.equal(B.cell('bizno', ref, 1, Object.assign({ ok: { by: 'x', at: '2026-10-31' } }, rv), SITE, '', '2026-10-31').k, 'human');
  // 다른 사진으로 바꿔 이으면(src 다름) 옛 읽은 값·옛 확인함은 무효 → 안 읽음
  assert.equal(B.cell('bizno', { id: 'p2' }, 1, Object.assign({ ok: { by: 'x', at: 'y' } }, rv), SITE, '', '2026-10-31').k, 'got');
  // 사업장 정보를 고치면 같은 읽은 값이 일치로 바뀐다(비교 결과를 저장하지 않으므로)
  const fixed = Object.assign({}, SITE, { ceo: '김○○' });
  assert.equal(B.cell('bizno', ref, 1, { src: 'p1', read: { biz_no: '123-45-67890', name: '예시전자', ceo: '김○○' } }, SITE, '', '2026-10-31').k, 'diff');
  assert.equal(B.cell('bizno', ref, 1, { src: 'p1', read: { biz_no: '123-45-67890', name: '예시전자', ceo: '김○○' } }, fixed, '', '2026-10-31').k, 'match');
});

test('독촉 문구 — 미수령·새로 필요한 서류만, 기한 날짜는 지어내지 않는다', () => {
  const cellsA = { sme: { k: 'none' }, reg: { k: 'none' }, bizno: { k: 'none' } };
  const cmpExp = B.cmp('sme', { sme_cert: '중소기업', sme_from: '2025-04-01', sme_to: '2026-03-31', name: '예시' }, SITE, '2026-04-10', '');
  const cellsB = { sme: { k: 'diff', cmp: cmpExp }, reg: { k: 'human' }, bizno: { k: 'human' } };
  const cellsC = { sme: { k: 'human' }, reg: { k: 'human' }, bizno: { k: 'human' } };
  const t = B.remind('예시 1호', 2026, [{ name: '예시금속(주)', cells: cellsA }, { name: '예시테크(주)', cells: cellsB }, { name: '예시산업(주)', cells: cellsC }], '');
  assert.match(t, /^\[예시 1호 · 2026년 지원금 신청 — 제출서류 안내\]/);
  assert.match(t, /예시금속\(주\): 중소기업확인서, 법인등기부등본, 사업자등록증 \(3종 미제출\)/);
  assert.match(t, /예시테크\(주\): 중소기업확인서 새로 발급본 \(유효기간 2026-03-31 지남\)/);
  assert.ok(!/예시산업/.test(t), '다 낸 곳은 넣지 않는다');
  assert.match(t, /※ 제출 기한: \[확인 필요/);
  assert.match(B.remind('x', 2026, [], '2026-05-20'), /제출 기한: 2026-05-20/);
});

test('배선 — 격자는 제출서류 탭 맨 위, 쓰기는 정한 자리만, 읽기는 기존 도구, 사람 확인 없이 확인함이 되지 않는다', () => {
  const docs = grabFn('subsidyDocsPanel');
  assert.ok(docs.indexOf('subDocReviewPanel(f,act,schk)') > 0 && docs.indexOf('subDocReviewPanel(') < docs.indexOf('제출서류 — 기금 단위'), '격자가 기금 단위 표보다 위');
  assert.match(docs, /subChkSite\(/, '기존 □ 체크표는 그대로');
  // 읽기: 기존 도구만, 쓰지 않는다
  const rd = grabFn('rvRead');
  assert.match(rd, /loadFullDetail\(/); assert.match(rd, /imgCanvas\(/); assert.match(rd, /ocrCanvases\(/);
  assert.ok(!/\.(set|update|remove|push)\(/.test(rd), '원본 읽기는 쓰지 않는다');
  // 쓰기 자리: review/… 와 «받음» 체크(site/…) 와 사업장 한 칸, 신청일 칸 — 그 밖은 없다
  assert.match(grabFn('_rvPath'), /subsidy_chk\/.*\/review\/site\//);
  const ok = grabFn('dvOk');
  assert.match(ok, /\/ok'\]=on\?/); assert.match(ok, /up\['site\/'\+sid\+'\/'\+kind\]=1/);
  // 한꺼번에 확인함은 «일치» 칸만
  assert.match(grabFn('rvOkMatched'), /\.k!=='match'\)\s*return/);
  // 서류대로 고침은 정한 다섯 칸만, 읽은 값이 있을 때만
  assert.deepEqual(Object.keys(eval('(' + grabVar('RV_FIX').replace(/^var RV_FIX=/, '').replace(/;$/, '') + ')')).sort(), ['address', 'biz_no', 'ceo', 'corp_no', 'name']);
  assert.match(grabFn('rvFix'), /RV_FIX\[field\]/);
  // 읽은 결과를 저장할 때 비교 결과가 아니라 값만(src·read·fail)
  assert.ok(!/st:|cmp:/.test(grabFn('rvSaveRead')));
  // 등기부에서 주민번호·대표자를 읽지 않는다
  assert.ok(!/주민|ceo/.test(grabFn('parseSiteReg')));
  // 복사만 하고 보내지 않는다
  assert.match(grabFn('rvCopyRemind'), /_copyText\(/);
  assert.ok(!/fetch\(|sendMail|mailto:/.test(grabFn('rvCopyRemind')));
});
