'use strict';
/* 계약서 자동 정리 길의 두 가지 오류 막기 (2026-11-16 계약·메일함 점검)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 회사·유형 이름은 전부 지어낸 것이다.
 *
 * ■ 못 박는 규칙 (값이 아니라 «규칙»)
 *   ① 컨설팅 유형을 못 골랐으면 «안 고른다» — 유형 목록의 첫 번째를 그냥 찍지 않는다
 *      (찍으면 «인사노무 컨설팅» 계약서도 현장클리닉이 된다). 목록 순서가 바뀌어도 답이 같아야 한다.
 *   ② 사업 이름(클리닉·일터혁신·기술보호)이 글에 있고 그 이름을 가진 유형이 «딱 하나»면 그 유형을 고른다.
 *      둘 이상이거나, 사업 이름이 둘 이상 섞였으면 사람이 고른다(비워 둔다).
 *   ③ 종료·해지 «통보»(메일 제목·서류 이름)는 사진첩 길에서 새 계약 요청을 만들지 않는다.
 *      보통 계약서 송부 메일은 그대로 요청이 만들어진다(거르개가 넓어지지 않았는지의 대조).
 * 소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { CONS_FAMILY_FNS } = require('./helpers/cons-family.js');   // 사업 갈래 함수(2026-11-28)

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));

function guesser() {
  const FN = ['function erpGuessContractFromFields(', 'function erpTypeNameTidy(', 'function erpNameRun(', 'function erpConsTypeByDocName(', ...CONS_FAMILY_FNS]
    .map((d) => cutFn(SRC, d)).join('\n');
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, parseInt, parseFloat };
  vm.createContext(ctx);
  vm.runInContext(FN + '\nthis.api={erpGuessContractFromFields};', ctx);
  return ctx.api.erpGuessContractFromFields;
}
const guess = guesser();

const CLINIC = { code: 'cons-clinic', name: '현장클리닉' };
const TECH = { code: 'cons-tech', name: '기술보호' };
const WORK = { code: 'cons-work', name: '일터혁신' };
const guessCons = (docName, scope, list) => out(guess({ docName, scope }, list, [], [], []));

function permutations(a) {
  if (a.length <= 1) return [a];
  const r = [];
  a.forEach((x, i) => permutations(a.slice(0, i).concat(a.slice(i + 1))).forEach((p) => r.push([x].concat(p))));
  return r;
}

test('① 유형을 못 골랐으면 «안 고른다» — 목록 첫 번째를 찍지 않고, 순서가 바뀌어도 같다', () => {
  permutations([CLINIC, TECH, WORK]).forEach((list) => {
    const g = guessCons('인사노무 컨설팅 위임계약서', '인사노무 진단 및 개선 컨설팅', list);
    assert.equal(g.kind, 'consulting');
    assert.equal(g.typeCode, '', '맞는 유형이 목록에 없으면 비운다 — 첫 번째(' + list[0].name + ')를 찍지 않는다');
  });
  assert.deepEqual(guessCons('용역계약서', '용역', []), { kind: 'consulting', typeCode: '' }, '유형 목록이 비어 있어도 비워 둔다');
  assert.deepEqual(guessCons('컨설팅 위임계약서', '', undefined), { kind: 'consulting', typeCode: '' }, '유형 목록을 안 줘도 비워 둔다');
});

test('② 사업 이름이 글에 있고 그 이름을 가진 유형이 «딱 하나»일 때만 고른다 — 순서와 상관없다', () => {
  permutations([CLINIC, TECH, WORK]).forEach((list) => {
    assert.equal(guessCons('기술보호 컨설팅 위임계약서', '', list).typeCode, TECH.code, '기술보호는 목록 첫 번째가 현장클리닉이어도 기술보호 유형');
    assert.equal(guessCons('현장 클리닉 컨설팅 위임계약서', '', list).typeCode, CLINIC.code);
    assert.equal(guessCons('클리닉 컨설팅 위임계약서', '', list).typeCode, CLINIC.code, '유형 이름 전체가 없어도 «클리닉»만 있으면 하나뿐인 클리닉 유형');
    assert.equal(guessCons('일터혁신 컨설팅 용역계약서', '', list).typeCode, WORK.code);
  });
});

test('② 애매하면 사람이 고른다 — 같은 이름의 유형이 둘이거나 사업 이름이 둘 섞였거나', () => {
  const dup = [CLINIC, { code: 'cons-clinic2', name: '찾아가는 클리닉' }, TECH];
  permutations(dup).forEach((list) => {
    assert.equal(guessCons('클리닉 컨설팅 위임계약서', '', list).typeCode, '', '«클리닉» 이름을 가진 유형이 둘이면 안 고른다');
  });
  permutations([CLINIC, TECH, WORK]).forEach((list) => {
    assert.equal(guessCons('클리닉 일터혁신 컨설팅 위임계약서', '', list).typeCode, '', '사업 이름이 둘 섞였으면 안 고른다');
  });
  assert.equal(guessCons('기술보호 컨설팅 계약서', '', [CLINIC, WORK]).typeCode, '', '그 이름을 가진 유형이 없으면 첫 번째로 대신하지 않는다');
});

test('① 다른 종류 판별은 그대로다(사건·자문·기금)', () => {
  const caseTypes = [{ code: 'case-dismiss', name: '부당해고등노동위원회대리(노사)', short: '부해' }];
  assert.deepEqual(out(guess({ docName: '위임약정서', scope: '충남2026부해1332 부당해고 구제신청' }, [CLINIC], caseTypes, [], [])),
    { kind: 'case', typeCode: 'case-dismiss' });
  assert.deepEqual(out(guess({ docName: '자문계약서', scope: '인사노무 상시자문' }, [CLINIC], [], [{ code: '자문', name: '자문' }], [])),
    { kind: 'company', typeCode: '자문' });
  assert.equal(out(guess({ docName: '기금 컨설팅 계약서' }, [CLINIC], [], [], [{ code: 'fund-1', name: '기금' }])).kind, 'fund');
});

/* ─── ③ 사진첩 길(생산자) — 종료·해지 통보는 요청을 만들지 않는다 ─── */
function producer() {
  const DOCREAD_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-doc-read.js'), 'utf8');
  const DOCFILE_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-doc-file.js'), 'utf8');
  const writes = {};
  const ctx = { console, Date, Object, Array, String, Number, JSON, Math, Promise, RegExp, Error, parseInt, parseFloat, setTimeout };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(DOCREAD_SRC, ctx);
  vm.runInContext(DOCFILE_SRC, ctx);
  ctx.PuDocFile.init({
    db: {
      ref: (p) => ({
        once: () => Promise.resolve({
          val: () => {
            if (p.indexOf('companies') >= 0) return { v: { co1: { id: 'co1', name: '가나기관', bizNo: '1234567890', managerMain: 'P-005' } } };
            if (p.indexOf('user_dir') >= 0) return { v: [{ sid: 'P-005', name: '담당가' }] };
            return null;
          }
        }),
        set: (v) => { writes[p] = v; return Promise.resolve(); },
        update: () => Promise.resolve()
      })
    }
  });
  return { P: ctx.PuDocFile, writes };
}
const FIELDS = (docName) => ({ company: '가나기관', bizno: '', docName, scope: '인사노무 상시자문', retainer: '220만원' });
const REQ_KEY = (id) => 'data/contract_requests/ctphoto-2026_' + id;

test('③ 종료·해지 통보 메일의 첨부는 새 계약 요청을 만들지 않는다(제목으로)', async () => {
  const { P, writes } = producer();
  const subjects = ['자문계약 종료 의 건', '[가나기관] 자문계약 해지 통보', '계약 해지 요청', '거래 종료 통보드립니다'];
  for (let i = 0; i < subjects.length; i++) {
    const res = await P.autoRequestContractFromPhoto({
      id: 'p-term-' + i, year: 2026, owner: 'u1', by: '담당가',
      fields: FIELDS('자문계약서'),
      mailMeta: { dir: 'in', srcKey: 'INBOX|' + i, subject: subjects[i] }
    });
    assert.equal(res.ok, false, '«' + subjects[i] + '» → 요청을 만들지 않는다');
    assert.equal(res.reason, 'terminated_mail');
    assert.equal(writes[REQ_KEY('p-term-' + i)], undefined, '«' + subjects[i] + '» → 서버에 아무것도 쓰지 않는다');
  }
});

test('③ 서류 이름이 해지·종료 통보여도 요청을 만들지 않는다(메일 정보가 없는 사진도)', async () => {
  const { P, writes } = producer();
  const res = await P.autoRequestContractFromPhoto({ id: 'p-term-doc', year: 2026, owner: 'u1', by: '담당가', fields: FIELDS('자문계약 해지 합의서') });
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'terminated_mail');
  assert.equal(writes[REQ_KEY('p-term-doc')], undefined);
});

test('③ 대조 — 보통 계약서 송부 메일·계약서 이름은 그대로 요청이 만들어진다(거르개가 넓어지지 않았다)', async () => {
  const { P, writes } = producer();
  const r1 = await P.autoRequestContractFromPhoto({
    id: 'p-ok-1', year: 2026, owner: 'u1', by: '담당가', fields: FIELDS('자문계약서'),
    mailMeta: { dir: 'sent', srcKey: 'Sent|1', subject: '[푸른노무법인] 가나기관 자문계약서 송부' }
  });
  assert.equal(r1.ok, true, '계약서 송부 메일은 요청이 만들어진다');
  assert.ok(writes[REQ_KEY('p-ok-1')], '서버에 요청이 쓰였다');
  const r2 = await P.autoRequestContractFromPhoto({ id: 'p-ok-2', year: 2026, owner: 'u1', by: '담당가', fields: FIELDS('위임약정서') });
  assert.equal(r2.ok, true, '메일 정보가 없는 계약서 사진도 그대로');
  /* 계약서 본문의 일반 해지 «조항»은 통보로 오인하지 않는다(제목에 계약서가 들어 있으면 본문 조항은 안 본다) */
  const r3 = await P.autoRequestContractFromPhoto({
    id: 'p-ok-3', year: 2026, owner: 'u1', by: '담당가', fields: FIELDS('자문계약서'),
    mailMeta: { dir: 'sent', srcKey: 'Sent|3', subject: '[바사테크] 자문계약서 송부' }
  });
  assert.equal(r3.ok, true);
});
