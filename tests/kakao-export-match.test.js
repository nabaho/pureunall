/* 카톡 내보내기 — 업무 맞추기·파일 맞추기·알림 쌍둥이 (2026-10-24)
   설계서: docs/superpowers/specs/2026-10-24-카톡-법인방-업무정리-design.md (4장·9장)
   ⚠ 예시 이름·사건번호는 모두 가짜다. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const X = require('../js/pu-kakao-export.js');

const grp = (caseNos, companyKeys) => ({ day: '2026-10-23', caseNos: caseNos || [], companyKeys: companyKeys || [], msgs: [], files: [], media: 0,
  anchor: (caseNos && caseNos.length) ? 'case' : (companyKeys && companyKeys.length) ? 'company' : 'none' });
const item = (id, no, key, open, stageNos) => ({ id, no, company: key, key, stageNos: stageNos || [], open: open !== false });

test('사건번호가 업무관리 번호와 «글자 그대로» 같으면 확실(띄어쓰기·하이픈은 무시)', () => {
  const [m] = X.matchGroups([grp(['경기2026부해9001'])], [item('i1', '경기 2026-부해9001', 'c1'), item('i2', '경기2026부해9002', 'c1')]);
  assert.deepStrictEqual({ b: m.basis, id: m.itemId, c: m.candidates }, { b: 'sure', id: 'i1', c: ['i1'] });
});

test('심급 사건번호(stageNos)가 같아도 확실', () => {
  const [m] = X.matchGroups([grp(['경기2026부해9001'])], [item('i1', '부해-2026-003', 'c1', true, ['경기2026부해9001'])]);
  assert.strictEqual(m.basis, 'sure');
  assert.strictEqual(m.itemId, 'i1');
});

test('같은 번호가 업무 둘에 있으면 자동으로 정하지 않는다 — 후보만', () => {
  const [m] = X.matchGroups([grp(['경기2026부해9001'])], [item('i1', '경기2026부해9001', 'c1'), item('i2', '경기2026부해9001', 'c2')]);
  assert.strictEqual(m.basis, 'guess');
  assert.strictEqual(m.itemId, '', '같은 번호가 둘인데 하나를 골라 버렸다');
  assert.deepStrictEqual(m.candidates.slice().sort(), ['i1', 'i2']);
});

test('업무관리에 없는 번호는 «없는 번호», 종결된 업무도 번호가 같으면 확실(후속 대화도 기록돼야 한다)', () => {
  const [a] = X.matchGroups([grp(['경기2026부노9100'])], [item('i1', '경기2026부해9001', 'c1')]);
  assert.deepStrictEqual({ b: a.basis, no: a.caseNo, id: a.itemId }, { b: 'newno', no: '경기2026부노9100', id: '' });
  const [b] = X.matchGroups([grp(['경기2026부해9001'])], [item('i1', '경기2026부해9001', 'c1', false)]);
  assert.strictEqual(b.basis, 'sure');
});

test('업체명만 있으면 짐작 — 진행 업무가 하나뿐이면 미리 고르되 그래도 짐작, 여럿이면 비워 둔다, 종결 업무는 후보가 아니다', () => {
  const one = X.matchGroups([grp([], ['c1'])], [item('i1', 'a', 'c1'), item('i9', 'b', 'c1', false), item('i2', 'c', 'c2')])[0];
  assert.deepStrictEqual({ b: one.basis, id: one.itemId, c: one.candidates }, { b: 'guess', id: 'i1', c: ['i1'] });
  const many = X.matchGroups([grp([], ['c1'])], [item('i1', 'a', 'c1'), item('i3', 'd', 'c1')])[0];
  assert.strictEqual(many.basis, 'guess');
  assert.strictEqual(many.itemId, '');
  assert.strictEqual(many.candidates.length, 2);
});

test('근거가 없으면 «없음»이고, 같은 길이로 하나씩 돌려준다', () => {
  const r = X.matchGroups([grp([], []), grp(['경기2026부해9001'])], [item('i1', '경기2026부해9001', 'c1')]);
  assert.strictEqual(r.length, 2);
  assert.strictEqual(r[0].basis, 'none');
  assert.strictEqual(r[0].itemId, '');
  assert.strictEqual(r[1].basis, 'sure');
});

test('파일 맞추기: 같은 이름이 먼저, 「이름 (1)」은 비슷으로, 한글 자모 형식이 달라도 맞고, 없으면 빈 값', () => {
  const nfd = '답변서(초안).hwp'.normalize('NFD');
  const r = X.matchFiles(['a.hwp', 'b.pdf', 'c.docx', '답변서(초안).hwp', 'a.hwp'], ['a.hwp', 'a (1).hwp', 'b (2).pdf', 'b (1).pdf', nfd]);
  assert.strictEqual(r.length, 4, '같은 이름이 두 번 적혔는데 두 번 나왔다');
  assert.deepStrictEqual(r[0], { name: 'a.hwp', found: 'a.hwp', similar: false });
  assert.deepStrictEqual(r[1], { name: 'b.pdf', found: 'b (1).pdf', similar: true });
  assert.deepStrictEqual(r[2], { name: 'c.docx', found: '', similar: false });
  assert.strictEqual(r[3].found, nfd);
  assert.strictEqual(r[3].similar, false);
});

test('카톡 만료 D-N·민감 이름·안전한 이름', () => {
  assert.strictEqual(X.attachmentExpiry('2026-10-23', '2026-10-24'), X.ATTACH_LIFE_DAYS - 1);
  assert.ok(X.attachmentExpiry('2026-10-01', '2026-10-24') < 0, '지난 날이 음수가 아니다');
  assert.strictEqual(X.attachmentExpiry('2026-10-23', '2026-10-23', 7), 7);
  for (const n of ['통장사본_홍○○.jpg', '신분증.jpg', '진단서.pdf', '주민등록등본.pdf']) assert.strictEqual(X.isSensitiveName(n), true, n);
  assert.strictEqual(X.isSensitiveName('답변서(초안).hwp'), false);
  for (const bad of ['../a/b.hwp', '..\\x.hwp', 'a:b*c?.hwp', '...']) {
    const s = X.safeName(bad);
    assert.ok(!/\.\.|[\\/:*?"<>|]/.test(s), bad + ' → ' + s);
    assert.ok(s.length > 0);
  }
  assert.strictEqual(X.safeName('  a.hwp '), 'a.hwp');
  assert.strictEqual(X.safeName(''), '_');
});

test('알림 쌍둥이: 같은 사람·같은 글·90초 안의 알림은 빠지고 내보내기는 남는다', () => {
  const t = Date.UTC(2026, 9, 23, 5, 5);
  const items = [
    { id: 'e1', room: 'r', sender: '노무사A', text: '답변서  제출 부탁', sentAt: t, src: 'export' },
    { id: 'a1', room: 'r', sender: '노무사A', text: '답변서 제출 부탁', sentAt: t + 30000, src: 'alert' },       /* 쌍둥이 */
    { id: 'a2', room: 'r', sender: '노무사A', text: '다른 글', sentAt: t + 30000, src: 'alert' },
    { id: 'a3', room: 'r', sender: '노무사A', text: '답변서 제출 부탁', sentAt: t + 5 * 60000, src: 'alert' },   /* 시각이 멀다 */
    { id: 'a4', room: 'r', sender: '노무사B', text: '답변서 제출 부탁', sentAt: t + 10000, src: 'alert' },     /* 사람이 다르다 */
    { id: 'a5', room: 'r', sender: '노무사C', text: '옛 서버가 준 알림', sentAt: t },                            /* src 없음 = 알림 */
  ];
  const out = X.dropAlertTwins(items).map((x) => x.id);
  assert.deepStrictEqual(out, ['e1', 'a2', 'a3', 'a4', 'a5']);
  assert.strictEqual(items.length, 6, '원본 배열이 바뀌었다');
});
