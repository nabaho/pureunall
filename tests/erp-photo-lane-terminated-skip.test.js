'use strict';
/* 사진첩 길의 «종료·해지 통보 거르개»를 다듬는 검사 (2026-11-16 검토 지적 반영)
 * ⚠ 이 저장소는 github.io 로 공개된다 — 회사·사람은 전부 지어낸 것이다.
 * (거르개 자체의 기본 동작은 tests/erp-guess-type-termination.test.js)
 *
 * ■ 못 박는 규칙
 *   ① 거르개는 «통보»만 건다 — 갱신 계약서 송부·날인본처럼 «새 계약서»인 메일은 걸지 않는다.
 *      (제목에 «종료»가 들어 있어도 통보 낱말이 없고 계약서 낱말이 있으면 통과)
 *   ② 걸러진 사진에는 «걸러졌다» 도장(skippedCtReq)을 찍는다 — 사진·판독값은 그대로, 계약 요청만 안 만든다.
 *   ③ 따라잡기(mailContractSweep)는 도장 찍힌 사진을 «아직 안 보낸 것»으로 다시 집지 않는다 —
 *      걸러진 사진이 앞 5건을 차지해 뒤의 정상 계약서가 영영 못 나가는 일이 없다.
 * 소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const PHOTOS = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8').replace(/\r\n/g, '\n');
const out = (v) => JSON.parse(JSON.stringify(v));

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
const ask = (P, id, docName, subject, dir) => P.autoRequestContractFromPhoto({
  id, year: 2026, owner: 'u1', by: '담당가', fields: FIELDS(docName),
  mailMeta: subject == null ? null : { dir: dir || 'in', srcKey: 'INBOX|' + id, subject }
});

test('① 갱신 계약서 송부·날인본처럼 «새 계약서»인 제목은 거르지 않는다(제목에 «종료»가 있어도)', async () => {
  const { P, writes } = producer();
  const renew = [
    ['자문계약 종료 후 신규 계약서 송부', 'sent'],
    ['기존 자문계약 종료 예정에 따른 갱신 자문계약서 송부', 'sent'],
    ['자문계약 종료일 2026.12.31 날인본', 'in'],
    ['[가나기관] 자문계약 종료 후 재계약 위임약정서 회신', 'in']
  ];
  for (let i = 0; i < renew.length; i++) {
    const id = 'p-renew-' + i;
    const res = await ask(P, id, '자문계약서', renew[i][0], renew[i][1]);
    assert.equal(res.ok, true, '«' + renew[i][0] + '» 는 새 계약서다 — 요청을 만든다');
    assert.ok(writes[REQ_KEY(id)], '서버에 요청이 쓰였다');
  }
});

test('① 대조 — 통보 낱말이 붙었으면 «계약서» 낱말이 같이 있어도 거른다', async () => {
  const { P, writes } = producer();
  const notice = ['자문계약 종료 의 건', '[가나기관] 자문계약 해지 통보', '자문계약 해지 통보 관련 계약서 회수', '자문계약 종료 안내(계약서 첨부)',
    '자문계약 종료 의 건 (계약서 첨부)', '자문계약 해지 통지(계약서 첨부)'];
  for (let i = 0; i < notice.length; i++) {
    const id = 'p-notice-' + i;
    const res = await ask(P, id, '자문계약서', notice[i]);
    assert.equal(res.ok, false, '«' + notice[i] + '» → 거른다');
    assert.equal(res.reason, 'terminated_mail');
    assert.equal(writes[REQ_KEY(id)], undefined);
  }
  const doc = await ask(producer().P, 'p-doc', '자문계약 해지 합의서', null);
  assert.equal(doc.reason, 'terminated_mail', '서류 이름이 해지 합의서여도 거른다');
});

/* ─── ② ③ pu-photos.html — 도장과 따라잡기 ─── */
function sendCtx(res, items) {
  const calls = { producer: 0, saved: [] };
  const ctx = {
    console, Date, Object, Array, String, Number, JSON, Math, Promise,
    gridItems: items, gridYear: 2026,
    readFields: (r) => (r && r.fields) || {},
    photoOwner: () => 'u1',
    PuPhotoStore: { myName: () => '담당가', saveRead: (y, id, read) => { calls.saved.push({ y, id, read: out(read) }); return Promise.resolve(); } }
  };
  ctx.PuDocFile = { autoRequestContractFromPhoto: () => { calls.producer++; return Promise.resolve(res); } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(cutFn(PHOTOS, 'function autoSendContractToErp(') + '\nthis.api={autoSendContractToErp};', ctx);
  return { ctx, calls, run: (id) => ctx.api.autoSendContractToErp(id, 2026, null) };
}
const photo = (id, read) => ({ id, meta: { via: 'mail', mail: { subject: '메일 ' + id }, read: Object.assign({ kind: 'contract', fields: { company: '가나기관' } }, read || {}) } });

test('② 걸러진 사진(terminated_mail)에는 skippedCtReq 도장을 찍고, 사진·판독값·계약 요청은 건드리지 않는다', async () => {
  const items = [photo('a1')];
  const s = sendCtx({ ok: false, reason: 'terminated_mail' }, items);
  await s.run('a1');
  assert.equal(s.calls.saved.length, 1, '판독값을 한 번 저장한다(도장)');
  const saved = s.calls.saved[0].read;
  assert.equal(saved.skippedCtReq.reason, 'terminated_mail');
  assert.ok(saved.skippedCtReq.at > 0);
  assert.equal(saved.filedCtReq, undefined, '«계약관리에 등록됨» 도장(filedCtReq)은 찍지 않는다');
  assert.equal(saved.kind, 'contract', '판독값은 그대로');
  assert.deepEqual(out(saved.fields), { company: '가나기관' });
  assert.ok(items[0].meta.read.skippedCtReq, '화면 사본에도 담는다');
  await s.run('a1');
  assert.equal(s.calls.producer, 1, '도장이 찍힌 사진은 다시 보내 보지 않는다');
  assert.equal(s.calls.saved.length, 1);
});

test('② 다른 결과는 예전 그대로다 — 성공은 filedCtReq, 업체 없음 같은 실패는 도장 없음', async () => {
  const ok = sendCtx({ ok: true, id: 'ctphoto-2026_a2', targetStatus: 'review' }, [photo('a2')]);
  await ok.run('a2');
  assert.equal(ok.calls.saved[0].read.filedCtReq.id, 'ctphoto-2026_a2');
  assert.equal(ok.calls.saved[0].read.skippedCtReq, undefined);
  const no = sendCtx({ ok: false, reason: 'no_company' }, [photo('a3')]);
  await no.run('a3');
  assert.equal(no.calls.saved.length, 0, '업체를 못 찾은 사진은 예전처럼 도장 없이 둔다');
});

test('③ 따라잡기는 걸러진 사진이 앞 5건을 차지해도 뒤의 정상 계약서를 보낸다', async () => {
  const skipped = [1, 2, 3, 4, 5].map((i) => photo('s' + i, { skippedCtReq: { at: 1, reason: 'terminated_mail' } }));
  const normal = [photo('n1'), photo('n2')];
  const filed = photo('f1', { filedCtReq: { at: 1, id: 'x' } });
  const sent = [];
  const ctx = {
    console, Date, Object, Array, String, Number, JSON, Math, Promise,
    gridItems: skipped.concat([filed], normal),
    mayTouch: () => true, photoYearOf: () => 2026, toast: () => {}, addFiles: () => Promise.resolve({}),
    autoSendContractToErp: (id) => { sent.push(id); return Promise.resolve(); },
    _mailContractSweptOnce: false
  };
  ctx.PuDocFile = { pullMailContracts: () => Promise.resolve({ pulled: [] }) };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(cutFn(PHOTOS, 'function mailContractSweep(') + '\nthis.api={mailContractSweep};', ctx);
  await ctx.api.mailContractSweep();
  assert.deepEqual(sent, ['n1', 'n2'], '도장 찍힌 5건·이미 보낸 1건은 건너뛰고 정상 2건만 보낸다');
});
