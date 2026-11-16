'use strict';
/* ⚖ 이미 있는 계약 «다시 읽기» — 계획 5 단계 E (대표 승인 2026-11-15 «권고대로»)
 * 계획: docs/superpowers/plans/2026-11-15-quote-auto-plan5-case-stage-marks.md §5-E
 * ⚠ 이 저장소는 공개다 — 업체·사람·문구는 전부 지어낸 것이다.
 * 실행: node --test tests/erp-stage-reread.test.js
 *
 * ■ 못 박는 것 — 깨지면 «사람이 안 누른 읽기»나 «엉뚱한 칸을 읽은 단계»가 계약에 조용히 붙는다
 *   ① 눌렀을 때만 읽는다 — 줄을 그리는 것만으로는 아무것도 안 바뀐다.
 *   ② 읽는 글은 «이미 계약에 적힌» 세 칸(원본 서류 이름 · 업무 요약 · 메모)뿐 — 금액·일지·근로자·업체·유형 이름 칸은 안 읽는다.
 *   ③ 새 단계만 auto(확인 필요)로 더한다 — 사람이 정한 ☑·✕ 는 그대로, stageCode·상태·금액은 안 건드린다.
 *   ④ 못 찾았거나 새로 읽은 것이 없으면 알리기만 하고 아무것도 안 바꾼다. 저장된 계약(cur)에서만, 사건 종류일 때만.
 * 소스 글자가 아니라 함수를 떠서 «돌려» 본다(STATUS.md 「되풀이된 실수」 ②). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const PuCaseStage = require('../js/pu-case-stage.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');

function h(tag, props, ...kids) { return { tag, props: props || {}, kids: kids.flat(Infinity).filter((k) => k !== false && k != null) }; }
function text(n) { return typeof n === 'object' ? n.kids.map(text).join('') : String(n); }
function find(n, pred, out = []) { if (n && typeof n === 'object') { if (pred(n)) out.push(n); n.kids.forEach((k) => find(k, pred, out)); } return out; }

const CODE = ['function erpStageBox(', 'function erpStagePartsFromSaved('].map((d) => cutFn(SRC, d)).join('\n');
const toasts = [];
const ctx = { window: { PuCaseStage }, h, Date, Object, Array, String, JSON, CURRENT_USER: { sid: 'S9' }, showToast: (m) => toasts.push(String(m)) };
vm.createContext(ctx);
vm.runInContext(CODE + '\nthis.api={erpStageBox,erpStagePartsFromSaved};', ctx);
const A = ctx.api;
const OPTS = [{ code: 'lrc-local', name: '지방노동위원회' }, { code: 'lrc-central', name: '중앙노동위원회' }, { code: 'court-admin', name: '행정소송' }];
const CUR = { id: 'ct-1', contractNo: '계약-2026-100' };
const codes = (marks) => Array.from(marks.map((m) => m.code));

/* 계약 창 상자 대역 — setF 호출을 모아 두고 «마지막 폼 값»을 돌려준다 */
function box(f, cur) {
  const sets = [];
  const setF = (fn) => { f = fn(f); sets.push(f); };
  toasts.length = 0;
  return { tree: () => A.erpStageBox(f, setF, OPTS, cur), get: () => f, sets };
}
const readBtn = (tree) => find(tree, (n) => n.tag === 'button' && /읽어 보기|다시 읽기/.test(text(n)))[0];
const base = (o) => Object.assign({ kinds: ['case'], stageCode: '', status: 'signed', briefs: { case: '부당해고 구제신청 대리' }, note: '', srcPhoto: { name: '수임계약서' },
  amounts: { case: 5500000 }, successFee: 100, stageMarks: [] }, o || {});

test('① 줄 — 저장된 계약(cur)일 때만 «읽어 보기» 단추가 있다 · 새 계약은 읽은 것이 없으면 줄이 없다(기존 그대로)', () => {
  assert.equal(A.erpStageBox(base(), () => {}, OPTS), null, 'cur 없음(새 계약)');
  assert.equal(A.erpStageBox(base(), () => {}, OPTS, null), null);
  assert.equal(A.erpStageBox(base(), () => {}, OPTS, {}), null, '번호표 없는 cur 는 저장된 계약이 아니다');
  const t = box(base(), CUR).tree();
  assert.ok(t, '저장된 계약은 읽은 단계가 없어도 줄이 있다');
  assert.match(text(t), /읽은 단계 없음/);
  assert.equal(text(readBtn(t)), '계약 글에서 읽어 보기');
  // 읽은 단계가 이미 있으면 «다시 읽기», cur 가 없으면(새 계약) 단추 자체가 없다
  const withMarks = base({ stageMarks: PuCaseStage.merge([], PuCaseStage.detect([{ where: 'scope', text: '지방노동위원회 대리' }], { kinds: ['case'] }), { now: 1 }).marks });
  assert.equal(text(readBtn(box(withMarks, CUR).tree())), '다시 읽기');
  assert.equal(readBtn(A.erpStageBox(withMarks, () => {}, OPTS)), undefined, '새 계약 창에서는 읽기 단추가 없다(읽을 «이미 적힌» 계약이 아니다)');
});

test('① 그리기만으로는 아무것도 안 바뀐다 — 줄을 그려도 setF·알림이 없다', () => {
  const b = box(base({ note: '지방노동위원회 구제신청 대리' }), CUR);
  b.tree(); b.tree();
  assert.equal(b.sets.length, 0);
  assert.equal(toasts.length, 0);
});

test('② 읽는 글은 «서류 이름 · 업무 요약 · 메모» 세 칸뿐 — 서류 이름은 cur 에서도 받는다', () => {
  const f = base({ note: '메모글', briefs: { case: '요약글' } });
  const parts = A.erpStagePartsFromSaved(f, CUR);
  assert.deepEqual(Array.from(parts.map((p) => p.where)), ['docName', 'scope', 'memo']);
  assert.deepEqual(Array.from(parts.map((p) => p.text)), ['수임계약서', '요약글', '메모글']);
  const fromCur = A.erpStagePartsFromSaved(base({ srcPhoto: undefined }), { id: 'ct-1', srcPhoto: { name: '원본서류' } });
  assert.equal(fromCur[0].text, '원본서류', '폼에 없으면 저장된 계약의 서류 이름');
  assert.equal(A.erpStagePartsFromSaved(null, null).length, 3, '비어 있어도 터지지 않는다');
});

test('② 다른 칸(금액·일지·근로자·업체·유형 이름·원본 사건)에 낱말이 있어도 읽지 않는다', () => {
  const f = base({
    note: '일반 메모', briefs: { case: '일반 요약' }, srcPhoto: { name: '일반서류' },
    journals: [{ content: '중앙노동위원회 심문회의 일정 지방노동위원회 판정' }],
    company: { name: '지방노동위원회기업', workers: [{ name: '근로자', note: '산재 심사청구 재심사청구' }] },
    typeCodes: { case: '지방노동위원회' }, programName: '행정소송 요양신청', parentCaseNo: '중노위-123',
  });
  const b = box(f, CUR);
  readBtn(b.tree()).props.onClick();
  assert.equal(b.sets.length, 0, '읽은 것이 없다 — 아무것도 안 바꾼다');
  assert.equal(toasts.length, 1);
  assert.match(toasts[0], /찾지 못했습니다/);
});

test('③ 눌렀을 때 — 새 단계를 auto(확인 필요)로 더하고, 상태·금액·stageCode 는 그대로(stageMarks 한 칸만 바뀐다)', () => {
  const before = base({ note: '지방노동위원회 구제신청 및 중앙노동위원회 재심 대리' });
  const b = box(before, CUR);
  readBtn(b.tree()).props.onClick();
  assert.equal(b.sets.length, 1);
  const after = b.get();
  assert.deepEqual(codes(after.stageMarks), ['lrc-local', 'lrc-central']);
  assert.ok(after.stageMarks.every((m) => m.state === 'auto' && m.srcDoc === '계약 글 다시 읽기' && m.at > 0));
  const strip = (x) => JSON.stringify(Object.assign({}, x, { stageMarks: undefined }));
  assert.equal(strip(after), strip(before), '★ stageMarks 밖의 값(stageCode·상태·금액·메모)은 한 글자도 안 바뀐다');
  assert.equal(after.stageCode, '');
  assert.equal(toasts.length, 1);
  assert.match(toasts[0], /2개/, '몇 개 읽었는지 알린다');
});

test('③ 사람이 정한 ☑·✕ 는 다시 읽어도 그대로 — 새로 읽은 단계만 auto 로 더해진다', () => {
  let marks = PuCaseStage.setState([], 'lrc-local', 'checked', 'S1', 5);
  marks = PuCaseStage.setState(marks, 'lrc-central', 'dismissed', 'S1', 6);
  const b = box(base({ stageMarks: marks, note: '지방노동위원회, 중앙노동위원회 재심, 행정소송 대리', stageCode: 'lrc-local' }), CUR);
  readBtn(b.tree()).props.onClick();
  const m = b.get().stageMarks;
  assert.deepEqual(codes(m), ['lrc-local', 'lrc-central', 'court-admin']);
  assert.deepEqual(Array.from(m.map((x) => x.state)), ['checked', 'dismissed', 'auto']);
  assert.equal(m[0].bySid, 'S1');
  assert.equal(m[0].at, 5, '확인한 시각이 다시 읽는다고 바뀌지 않는다');
  assert.equal(m[1].bySid, 'S1', '아님(✕)으로 정한 단계를 되살리지 않는다');
  assert.equal(b.get().stageCode, 'lrc-local', '사람이 정한 현재 단계는 그대로');
  assert.match(toasts[0], /1개/);
});

test('④ 새로 읽은 것이 없으면(이미 다 표에 있음) 알리기만 하고 setF 를 안 부른다', () => {
  const marks = PuCaseStage.merge([], PuCaseStage.detect([{ where: 'memo', text: '지방노동위원회 대리' }], { kinds: ['case'] }), { now: 1 }).marks;
  const b = box(base({ stageMarks: marks, note: '지방노동위원회 구제신청 대리' }), CUR);
  readBtn(b.tree()).props.onClick();
  assert.equal(b.sets.length, 0);
  assert.equal(toasts.length, 1);
  assert.match(toasts[0], /새로 읽은 단계가 없습니다/);
  assert.notEqual(b.get().stageMarks, undefined);
});

test('④ 낱말이 없으면 «찾지 못했다»만 알리고 아무것도 안 바꾼다', () => {
  const b = box(base({ note: '임금체불 진정 대리', briefs: { case: '임금체불 진정' } }), CUR);
  readBtn(b.tree()).props.onClick();
  assert.equal(b.sets.length, 0);
  assert.match(toasts[0], /찾지 못했습니다/);
});

test('④ 사건 종류가 아니면(컨설팅 등) 낱말이 있어도 읽지 않는다', () => {
  for (const kinds of [['consulting'], ['company'], []]) {
    const b = box(base({ kinds, note: '지방노동위원회 구제신청 대리' }), CUR);
    readBtn(b.tree()).props.onClick();
    assert.equal(b.sets.length, 0, JSON.stringify(kinds));
    assert.match(toasts[0], /찾지 못했습니다/);
  }
});

test('모듈이 없으면 줄이 없다 — 읽기 단추가 터지지 않는다', () => {
  const c2 = { window: {}, h, Date, Object, Array, String, JSON, showToast() {} };
  vm.createContext(c2);
  vm.runInContext(CODE + '\nthis.api={erpStageBox};', c2);
  assert.equal(c2.api.erpStageBox(base(), () => {}, OPTS, CUR), null);
});

test('계약 창에는 저장된 계약(props.cur)을 넘겨 한 번만 걸려 있다 — 옛 3인자 호출은 남지 않았다', () => {
  assert.equal((SRC.match(/isCase && erpStageBox\(f, setF, caseStageOpts, props\.cur\)/g) || []).length, 1);
  assert.equal((SRC.match(/erpStageBox\(f, setF, caseStageOpts\)/g) || []).length, 0, 'cur 없이 부르면 읽기 단추가 안 생긴다');
});
