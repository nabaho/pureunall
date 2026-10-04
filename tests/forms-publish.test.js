'use strict';
// 서식집 Phase 1·2 — 승인(O)한 서식만, 개인정보 다시 보고, 원본 경로 걷고 싣기 (가짜 자료만)
const test = require('node:test');
const assert = require('node:assert');
const P = require('../tools/forms_publish.js');

const F = (o) => Object.assign({
  id: 'wa-0123456789', title: '위임약정서', titleDetected: true, domain: 'wageArrears', track: ['임금체불·진정'],
  category: 'mandate', esign: true, signer: 'worker', jurisdiction: '',
  vars: [{ key: '이름' }], signFields: [{ role: 'worker', label: '위임인', type: 'sign' }],
  body: '<p>위 임 약 정 서</p><p>위임인 {{이름}}</p>',
  source: { file: '가나상사 사건/홍길동/위임약정서.hwp', mtime: 1, hash: '0123456789', pickedBy: 'blank', cluster: ['가나상사 사건/홍길동/위임약정서.hwp'] },
  review: { status: 'pending', flags: [] },
}, o);
const REV = { at: '2026-10-04', by: '노무사' };

test('승인 읽기 — 머리줄(승인·ID)을 찾고 O/X 만, 동그라미·소문자도 O', () => {
  const aoa = [['서식집 검토표'], ['생성 …'],
    ['승인', '육안확인', '도메인', '서식명', 'ID'],
    ['O', '', '임금체불', '위임약정서', 'wa-0123456789'],
    ['○', '', '임금체불', '동의서', 'wa-abcdefabcd'],
    ['x', '', '임금체불', '반려', 'wa-1111111111'],
    ['', '', '임금체불', '아직', 'wa-2222222222'],
    ['O', '', '임금체불', 'ID 망가짐', '모름']];
  assert.deepStrictEqual(P.approvalsFromRows(aoa), { 'wa-0123456789': 'O', 'wa-abcdefabcd': 'O', 'wa-1111111111': 'X' });
  assert.deepStrictEqual(P.approvalsFromRows([['승인', '서식명'], ['O', 'x']]), {}, 'ID 열이 없는 옛 검토표는 읽지 않는다');
});

test('싣기 — 원본 경로를 걷고, 승인 표시를 남긴다', () => {
  const plan = P.publishPlan([F({})], { 'wa-0123456789': 'O' }, [], REV);
  assert.deepStrictEqual(plan.added, ['wa-0123456789']);
  const f = plan.files['wage-arrears'][0];
  assert.deepStrictEqual(f.source, { hash: '0123456789', pickedBy: 'blank' }, '사건 폴더 경로(고객사·사람 이름)가 실리면 안 된다');
  assert.ok(!JSON.stringify(plan).includes('가나상사 사건'), '경로가 어디에도 남으면 안 된다');
  assert.deepStrictEqual(f.review, { status: 'approved', reviewedAt: '2026-10-04', reviewedBy: '노무사' });
  assert.strictEqual(plan.index[0].file, 'wage-arrears');
  assert.ok(!('body' in plan.index[0]), '목록(index)에는 본문을 싣지 않는다');
});

test('싣기 — 개인정보가 남은 서식은 안 싣고 까닭을 알려 준다', () => {
  const dirty = F({ id: 'wa-9999999999', title: '진정서', body: '<p>진정인 주민등록번호 900101-1234567</p>' });
  const plan = P.publishPlan([F({}), dirty], { 'wa-0123456789': 'O', 'wa-9999999999': 'O' }, [], REV);
  assert.deepStrictEqual(plan.added, ['wa-0123456789']);
  assert.strictEqual(plan.refused.length, 1);
  assert.strictEqual(plan.refused[0].id, 'wa-9999999999');
  assert.match(plan.refused[0].why, /개인정보 의심/);
  assert.ok(!JSON.stringify(plan.files).includes('900101-1234567'));
});

test('싣기 — 묶음에 없는 ID 는 거절, X 는 이미 실린 것을 내림, 빈 칸은 그대로', () => {
  const old = P.publicForm(F({ id: 'wa-aaaaaaaaaa', title: '옛것' }), REV);
  const keep = P.publicForm(F({ id: 'wa-bbbbbbbbbb', title: '그대로' }), REV);
  const plan = P.publishPlan([F({})], { 'wa-aaaaaaaaaa': 'X', 'wa-cccccccccc': 'O' }, [old, keep], REV);
  assert.deepStrictEqual(plan.removed, ['wa-aaaaaaaaaa']);
  assert.deepStrictEqual(plan.refused.map(r => r.id), ['wa-cccccccccc']);
  assert.deepStrictEqual(plan.index.map(f => f.id), ['wa-bbbbbbbbbb']);
});

test('도메인별 파일 이름', () => {
  const plan = P.publishPlan([F({}), F({ id: 'ia-0000000001', domain: 'industrialAccident', title: '요양급여신청서' })],
    { 'wa-0123456789': 'O', 'ia-0000000001': 'O' }, [], REV);
  assert.deepStrictEqual(Object.keys(plan.files).sort(), ['industrial-accident', 'wage-arrears']);
});

test('검토표 «파일»을 실제로 읽는다 — xlsx_gen 으로 만든 표에 O/X 를 적고 다시 읽기(Node 의 SheetJS readFile 함정)', () => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const XG = require('../xlsx_gen.js');
  const XLSX = require('../vendor/xlsx.full.min.js');
  const Rp = require('../tools/forms_report.js');
  const t = Rp.reviewRows([F({}), F({ id: 'wa-abcdefabcd', title: '동의서' })]);
  const iId = t.headers.indexOf('ID');   // 표는 서식명 차례라 줄 차례로 짚지 않고 ID 로 짚는다
  t.rows.forEach(r => { r[0] = r[iId] === 'wa-0123456789' ? 'O' : 'X'; });
  const u8 = XG.build({ sheet: '임금체불', title: '서식집 검토표 1차', sub: '시험', headers: t.headers, colRatios: t.colRatios, rows: t.rows, landscape: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forms-'));
  const p = path.join(dir, '서식집_검토_1차_임금체불.xlsx');
  fs.writeFileSync(p, Buffer.from(u8));
  try {
    assert.deepStrictEqual(P.readApprovals([p]), { 'wa-0123456789': 'O', 'wa-abcdefabcd': 'X' });
    // 엑셀에서 고쳐 저장한 꼴(SheetJS 가 다시 쓴 파일)도 읽는다
    const wb = XLSX.read(fs.readFileSync(p), { type: 'buffer' });
    const p2 = path.join(dir, '고쳐저장.xlsx');
    fs.writeFileSync(p2, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    assert.deepStrictEqual(P.readApprovals([p2]), { 'wa-0123456789': 'O', 'wa-abcdefabcd': 'X' });
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
