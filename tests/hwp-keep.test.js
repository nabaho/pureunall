/* 원본 살려 고치기 (js/pu-hwp-keep.js) — 가짜 한글 문서로 돌린다
   왜 생겼나(2026-09-26): 목업 ③ 승인. 회사가 준 원본 한글 파일에 바뀐 조만 넣는다.
   표준취업규칙 시험에서 드러난 함정을 못 박는다 —
     · 새 글자가 빈 문단의 «굵은 조 머리» 모양을 물려받던 것
     · 가지번호 조(제24조의2)를 못 찾던 것(「조(」 로만 찾았다)
     · 목차·부록(다른 규정의 제1조)을 본문으로 잘못 고르는 것
     · 앞에서부터 고치면 문단 번호가 밀려 엉뚱한 줄을 고치는 것 */
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../js/pu-hwp-keep.js');
const { FakeDoc, para, art } = require('./lib-fake-hwpdoc.js');

const HEAD = 9, BODY = 7, PH = 81, PI = 82;          // 조 머리 글자·본문 글자, 조 머리 문단·항 문단
/* 문단형 취업규칙 — 목차 + 본문 + 부록(다른 규정이 제1조부터 다시) */
function bodyDoc() {
  return new FakeDoc([[
    para('목  차'),
    para('제1조(목적)\t1'), para('제2조(휴게)\t1'),
    para('제1장 총칙'),
    art('제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.', HEAD, BODY, PH),
    para(''),
    art('제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.', HEAD, BODY, PH),
    para('  ② 휴게시간은 자유롭게 이용할 수 있다.', BODY, PI),
    para(''),
    art('제3조(탄력적 근로시간제) ① 회사는 2주 단위로 시행한다.', HEAD, BODY, PH),
    para('  ② 임신 중인 사원에게는 적용하지 아니한다.', BODY, PI),
    para(''),
    art('제4조(연차) ① 회사는 15일의 연차를 준다.', HEAD, BODY, PH),
    para('부  칙'),
    para('1. 이 규칙은 2020년 1월 1일부터 시행한다.', 5, 50),
    para('[별첨] 괴롭힘 예방규정'),
    art('제1조(목적) 이 규정은 괴롭힘을 막는다.', 3, 3, 30),
    art('제2조(정의) 괴롭힘이란 다음과 같다.', 3, 3, 30)
  ]]);
}
const WANT = [{ num: 2, sub: 0, title: '휴게' }, { num: 3, sub: 0, title: '탄력적 근로시간제' }];
const runOf = (doc, want) => K.pickRun(K.scan(doc), want || WANT);

test('본문을 고른다 — 목차 줄과 부록(제1조부터 다시)은 떼어 낸다', () => {
  const doc = bodyDoc(), run = runOf(doc);
  assert.deepEqual(run.map(c => c.key), ['1', '2', '3', '4']);
  assert.equal(run[0].k, 4, '★ 목차의 「제1조(목적)\\t1」 을 본문으로 골랐다');
  /* 조의 끝 — 다음 조 앞, 끝의 빈 줄 빼고, 부칙 머리 앞에서 멈춘다 */
  assert.deepEqual(run[1].lines, ['제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.', '  ② 휴게시간은 자유롭게 이용할 수 있다.']);
  assert.deepEqual(run[3].lines, ['제4조(연차) ① 회사는 15일의 연차를 준다.'], '★ 부칙이 마지막 조에 딸려 들어갔다');
  /* 부록 제목과 맞는 조를 찾을 때는 부록을 고른다 */
  assert.equal(runOf(doc, [{ num: 1, title: '목적' }, { num: 2, title: '정의' }])[0].lines[0], '제1조(목적) 이 규정은 괴롭힘을 막는다.');
});

test('계획 — 제목이 다르면 사람이 고르고, 없는 조는 «못 찾음», 신설은 앞 조 뒤', () => {
  const run = runOf(bodyDoc());
  const rows = K.plan(run, [
    { id: 'a', kind: '개정', num: 2, sub: 0, title: '휴게', lines: [] },
    { id: 'b', kind: '개정', num: 3, sub: 0, title: '선택적 근로시간제', lines: [] },
    { id: 'c', kind: '개정', num: 9, sub: 0, title: '없음', lines: [] },
    { id: 'd', kind: '신설', newNo: '제2조의2', title: '휴게 선택', anchor: { num: 2, sub: 0 }, lines: [] },
    { id: 'e', kind: '신설', newNo: '제5조', title: '끝', anchor: null, lines: [] }
  ]);
  assert.deepEqual(rows.map(r => r.state), ['ok', 'confirm', 'missing', 'place', 'place']);
  assert.match(rows[1].why, /탄력적 근로시간제/, '원본 제목을 보여 줘야 사람이 고른다');
  assert.equal(rows[3].target.key, '2');
  assert.equal(rows[4].target.key, '4', '앞 조가 없으면 맨 끝 조 뒤');
});

test('개정 — 원본 파일 글자가 검토 화면 원문과 다르면 «통째로 바꾸지 않고» 멈춘다', () => {
  /* 표준취업규칙처럼 해설 칸이 있는 표는 읽을 때 해설이 원문에 섞인다. 그 글로 바꾸면 해설이
     조문 칸에 들어가는데, 검증도 같은 글로 하니 «통과» 해 버렸다(2026-09-26 실측) */
  const run = runOf(bodyDoc());
  const same = '제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.\n② 휴게시간은 자유롭게 이용할 수 있다.';
  const mixed = same + ' [필수] 휴게는 자유롭게 이용하게 할 것';
  const rows = K.plan(run, [
    { id: 'a', kind: '개정', num: 2, sub: 0, title: '휴게', orig: same, lines: [] },
    { id: 'b', kind: '개정', num: 2, sub: 0, title: '휴게', orig: mixed, lines: [] },
    { id: 'c', kind: '개정', num: 2, sub: 0, title: '휴게', lines: [] }
  ]);
  assert.equal(rows[0].state, 'ok', '띄어쓰기·줄바꿈만 다른 것은 같은 글이다');
  assert.equal(rows[1].state, 'differ', '★ 해설이 섞인 원문으로 원본을 통째로 바꾸려 한다');
  assert.equal(rows[2].state, 'ok', '원문을 안 준 옛 호출은 그대로 간다');
});

test('개정 — 같은 줄은 손대지 않고, 바뀐 줄은 가운데만, 새 항은 «항 문단·본문 글자» 모양', () => {
  const doc = bodyDoc(), run = runOf(doc);
  const untouched = JSON.stringify(doc.S[0][7]);                       // ② 줄
  const rows = K.plan(run, [{ id: 'a', kind: '개정', num: 2, sub: 0, title: '휴게', lines: [
    '제2조(휴게) ① 휴게시간은 12:30부터 13:30까지로 한다.',
    '② 휴게시간은 자유롭게 이용할 수 있다.',
    '③ 4시간 근로로서 사원이 요청하면 주지 아니할 수 있다.'] }]);
  K.apply(doc, rows);
  const L = doc.lines(0);
  assert.equal(L[6], '제2조(휴게) ① 휴게시간은 12:30부터 13:30까지로 한다.');
  assert.equal(JSON.stringify(doc.S[0][7]), untouched, '★ 안 바뀐 줄(②)을 건드렸다 — 그 줄의 글자 모양이 흔들린다');
  assert.equal(L[8], '  ③ 4시간 근로로서 사원이 요청하면 주지 아니할 수 있다.', '새 항은 원문 들여쓰기(빈칸 둘)를 따른다');
  const p3 = doc.S[0][8];
  assert.ok(p3.cs.every(id => id === BODY), '★ 새 항이 조 머리(굵게) 모양을 물려받았다');
  assert.equal(p3.ps, PI, '★ 새 항이 조 머리 문단 모양(내어쓰기)을 받았다 — 같은 조의 항 문단 모양이어야 한다');
  /* 바뀐 줄 — 조 머리 글자는 그대로 굵게 */
  assert.ok(doc.S[0][6].cs.slice(0, 7).every(id => id === HEAD));
  assert.equal(L[9], '', '조 사이 빈 줄은 그대로');
});

test('삭제 — 「제3조 삭제 <날짜>」, 조 번호만 굵게, 딸린 항은 지운다, 뒤 조 번호는 안 민다', () => {
  const doc = bodyDoc(), run = runOf(doc);
  K.apply(doc, K.plan(run, [{ id: 'c', kind: '삭제', num: 3, sub: 0, title: '탄력적 근로시간제', delText: '제3조 삭제 <2026. 12. 10.>' }]));
  const L = doc.lines(0);
  const at = L.indexOf('제3조 삭제 <2026. 12. 10.>');
  assert.ok(at > 0);
  assert.ok(!L.some(t => t.includes('임신 중인 사원')), '딸린 ② 가 남았다');
  assert.equal(L[at + 2], '제4조(연차) ① 회사는 15일의 연차를 준다.');
  const p = doc.S[0][at];
  assert.ok(p.cs.slice(0, 3).every(id => id === HEAD) && p.cs.slice(3).every(id => id === BODY), '★ 「삭제」 글자까지 굵게 나온다');
});

test('신설(문단형) — 앞 조 · 빈 줄 · 새 조 · 빈 줄 · 다음 조, 같은 자리 둘이면 차례대로', () => {
  const doc = bodyDoc(), run = runOf(doc);
  K.apply(doc, K.plan(run, [
    { id: 'd1', kind: '신설', newNo: '제2조의2', title: '휴게 선택', anchor: { num: 2, sub: 0 }, lines: ['제2조의2(휴게 선택) 요청은 서면으로 한다.'] },
    { id: 'd2', kind: '신설', newNo: '제2조의3', title: '휴게 장소', anchor: { num: 2, sub: 0 }, lines: ['제2조의3(휴게 장소) 휴게실을 둔다.', '② 휴게실은 깨끗이 한다.'] }
  ]));
  const L = doc.lines(0);
  const i = L.indexOf('제2조의2(휴게 선택) 요청은 서면으로 한다.');
  assert.ok(i > 0);
  assert.deepEqual(L.slice(i - 2, i + 6), [
    '  ② 휴게시간은 자유롭게 이용할 수 있다.', '',
    '제2조의2(휴게 선택) 요청은 서면으로 한다.', '',
    '제2조의3(휴게 장소) 휴게실을 둔다.', '  ② 휴게실은 깨끗이 한다.', '',
    '제3조(탄력적 근로시간제) ① 회사는 2주 단위로 시행한다.']);
  const h = doc.S[0][i];
  assert.equal(h.ps, PH, '새 조 머리 문단은 조 머리 문단 모양');
  assert.ok(h.cs.slice(0, K.headLen(h.t)).every(id => id === HEAD) && h.cs.slice(K.headLen(h.t)).every(id => id === BODY));
});

test('뒤에서부터 고친다 — 앞 조에 줄이 늘어도 뒤 조를 제자리에서 고친다', () => {
  const doc = bodyDoc(), run = runOf(doc);
  K.apply(doc, K.plan(run, [
    { id: 'a', kind: '개정', num: 2, sub: 0, title: '휴게', lines: ['제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.', '② 휴게시간은 자유롭게 이용할 수 있다.', '③ 새 항 하나.', '④ 새 항 둘.'] },
    { id: 'b', kind: '개정', num: 4, sub: 0, title: '연차', lines: ['제4조(연차) ① 회사는 15일의 연차유급휴가를 준다.'] }
  ]));
  /* 문서 전체를 줄째로 견준다 — 뒤 조의 새 글이 «어딘가에» 있는 것만으로는 부족하다
     (앞에서부터 고치면 새 글은 들어가되 엉뚱한 줄이 망가진다) */
  assert.deepEqual(doc.lines(0).slice(4, 17), [
    '제1조(목적) 이 규칙은 가나상사 사원의 근로조건을 정한다.', '',
    '제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.', '  ② 휴게시간은 자유롭게 이용할 수 있다.', '  ③ 새 항 하나.', '  ④ 새 항 둘.', '',
    '제3조(탄력적 근로시간제) ① 회사는 2주 단위로 시행한다.', '  ② 임신 중인 사원에게는 적용하지 아니한다.', '',
    '제4조(연차) ① 회사는 15일의 연차유급휴가를 준다.', '부  칙', '1. 이 규칙은 2020년 1월 1일부터 시행한다.'],
    '★ 앞에서 늘어난 줄 때문에 뒤 조가 엉뚱한 자리에서 고쳐졌다');
});

test('목차가 본문보다 조를 더 많이 가진 것처럼 보여도 목차를 고르지 않는다', () => {
  /* 본문에서 제4조 머리를 못 읽은 문서(머리에 괄호가 없다) — 목차 줄만 보면 목차가 더 «맞아» 보인다 */
  const doc = new FakeDoc([[
    para('제1조(목적)\t1'), para('제2조(휴게)\t2'), para('제3조(연차)\t3'), para('제4조(퇴직)\t4'),
    art('제1조(목적) 이 규칙은 근로조건을 정한다.', HEAD, BODY, PH),
    art('제2조(휴게) ① 휴게시간은 1시간으로 한다.', HEAD, BODY, PH),
    art('제3조(연차) ① 15일을 준다.', HEAD, BODY, PH),
    para('제4조 퇴직 — 사원은 30일 전에 알린다.')
  ]]);
  const run = K.pickRun(K.scan(doc), [{ num: 1, title: '목적' }, { num: 2, title: '휴게' }, { num: 3, title: '연차' }, { num: 4, title: '퇴직' }]);
  assert.equal(run[0].k, 4, '★ 목차 줄(「제1조(목적)\\t1」)을 본문으로 골랐다 — 고치면 목차가 바뀐다');
});

test('부칙 — 원본 부칙 마지막 줄 뒤에, 그 줄의 모양으로', () => {
  const doc = bodyDoc(), run = runOf(doc);
  const res = K.apply(doc, K.plan(run, []), { after: '1. 이 규칙은 2020년 1월 1일부터 시행한다.', line: '2. 본 규칙의 일부를 개정하여 2026. 12. 10.부터 시행한다.' });
  assert.equal(res.addendumPlaced, true);
  const L = doc.lines(0), i = L.indexOf('1. 이 규칙은 2020년 1월 1일부터 시행한다.');
  assert.equal(L[i + 1], '2. 본 규칙의 일부를 개정하여 2026. 12. 10.부터 시행한다.');
  assert.ok(doc.S[0][i + 1].cs.every(id => id === 5) && doc.S[0][i + 1].ps === 50);
  assert.equal(K.apply(bodyDoc(), [], { after: '없는 줄', line: 'x' }).addendumPlaced, false, '못 찾으면 넣지 않고 알린다');
});

/* 표형 — 표준취업규칙처럼 큰 표(왼쪽 조문 · 오른쪽 해설) */
function tableDoc() {
  const cell = (...ps) => ps;
  return new FakeDoc([[para('취업규칙'), para('[표]')]], {
    '0|1|0': { cols: 2, cells: [
      cell(para('취업규칙(안)', 20, 60)), cell(para('착안사항', 20, 60)),
      cell(art('제1조(목적) 이 규칙은 근로조건을 정한다.', HEAD, BODY, PH)), cell(para('[필수] 목적을 적는다', 44, 70)),
      cell(art('제2조(휴게) ① 휴게시간은 00:00부터 00:00까지로 한다.', HEAD, BODY, PH), para('  ② 공지한다.', BODY, PI), para('', HEAD, PI)),
      cell(para('[필수] 휴게는 자유롭게', 44, 70)),
      cell(art('제3조(연차) 15일을 준다.', HEAD, BODY, PH)), cell(para('[선택] 연차', 44, 70))
    ] }
  });
}
test('표형 — 칸 안 조를 고치고, 신설은 그 줄 아래 새 줄에 넣는다', () => {
  const doc = tableDoc();
  const run = K.pickRun(K.scan(doc), [{ num: 2, title: '휴게' }]);
  assert.deepEqual(run.map(c => c.key), ['1', '2', '3']);
  assert.deepEqual(run[1].lines, ['제2조(휴게) ① 휴게시간은 00:00부터 00:00까지로 한다.', '  ② 공지한다.'], '칸 끝의 빈 문단은 조에 안 넣는다');
  K.apply(doc, K.plan(run, [
    { id: 'a', kind: '개정', num: 2, sub: 0, title: '휴게', lines: ['제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.', '② 공지한다.', '③ 요청하면 주지 아니할 수 있다.'] },
    { id: 'b', kind: '신설', newNo: '제2조의2', title: '휴게 선택', anchor: { num: 2, sub: 0 }, lines: ['제2조의2(휴게 선택) 서면으로 한다.'] }
  ]));
  const T = '0|1|0';
  assert.deepEqual(doc.cellLines(T, 4).slice(0, 3), ['제2조(휴게) ① 휴게시간은 12:00부터 13:00까지로 한다.', '  ② 공지한다.', '  ③ 요청하면 주지 아니할 수 있다.']);
  assert.ok(doc.T[T].cells[4][2].cs.every(id => id === BODY), '★ 칸 끝 빈 문단의 굵은 모양을 물려받았다(표준취업규칙에서 실제로 그랬다)');
  assert.deepEqual(doc.cellLines(T, 6), ['제2조의2(휴게 선택) 서면으로 한다.'], '신설은 제2조 줄 바로 아래 새 줄의 왼쪽 칸');
  assert.deepEqual(doc.cellLines(T, 8), ['제3조(연차) 15일을 준다.'], '뒤 줄은 한 줄씩 밀린다');
  assert.equal(doc.T[T].cells[6][0].ps, PH);
  /* 다시 훑으면 가지번호 조도 찾는다 */
  const again = K.pickRun(K.scan(doc), [{ num: 2, title: '휴게' }]).map(c => c.key);
  assert.deepEqual(again, ['1', '2', '2의2', '3'], '★ 가지번호 조(제2조의2)를 못 찾는다 — 「조(」 로만 찾으면 이렇게 된다');
});

test('저장 전 검증 — 바뀐 조는 새 글자, 안 바꾼 조는 원본 글자여야 통과', () => {
  const doc = bodyDoc(), before = runOf(doc);
  const rows = K.plan(before, [{ id: 'a', kind: '개정', num: 2, sub: 0, title: '휴게', lines: ['제2조(휴게) ① 휴게시간은 12:30부터 13:30까지로 한다.', '② 휴게시간은 자유롭게 이용할 수 있다.'] },
    { id: 'n', kind: '신설', newNo: '제2조의2', title: '선택', anchor: { num: 2, sub: 0 }, lines: ['제2조의2(선택) 서면으로 한다.'] }]);
  const after = doc.clone();
  K.apply(after, rows);
  assert.equal(K.verify(before, runOf(after), rows).ok, true);
  /* 안 고친 조가 바뀌면 걸린다 */
  const bad = after.clone();
  bad.S[0].find(p => p.t.startsWith('제4조')).t = '제4조(연차) ① 회사는 10일의 연차를 준다.';
  const v = K.verify(before, runOf(bad), rows);
  assert.equal(v.ok, false);
  assert.ok(v.issues.some(x => x.key === '4' && /안 고친 조/.test(x.why)));
  /* 고친 조가 신구대조표와 다르면 걸린다 */
  const bad2 = after.clone();
  bad2.S[0].find(p => p.t.startsWith('제2조(휴게) ①')).t = '제2조(휴게) ① 엉뚱한 글자';   // 목차 줄(「제2조(휴게)\t1」)이 아니라 본문
  assert.ok(K.verify(before, runOf(bad2), rows).issues.some(x => x.key === '2'));
});

test('원본 형식 — .hwp 는 .hwp, .hwpx 는 .hwpx 로만 저장한다', () => {
  assert.equal(K.formatOf(new Uint8Array([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1, 0])), 'hwp');
  /* ZIP 머리(30바이트) 뒤에 첫 칸 이름과 내용 — .hwpx 는 「mimetype」「application/hwp+zip」, 워드는 다른 이름 */
  const zip = (name, body) => new Uint8Array([0x50, 0x4B, 0x03, 0x04].concat(new Array(26).fill(0), [...Buffer.from(name + body + 'PK'.repeat(20))]));
  assert.equal(K.formatOf(zip('mimetype', 'application/hwp+zip')), 'hwpx');
  assert.equal(K.formatOf(zip('[Content_Types].xml', '<?xml version="1.0"?><Types>')), '', '★ 워드(.docx)를 한글로 여긴다');
  assert.equal(K.formatOf(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D])), '', 'PDF 는 이 길을 안 쓴다');
  const calls = [];
  const fake = { exportHwp: () => { calls.push('hwp'); return 1; }, exportHwpx: () => { calls.push('hwpx'); return 2; } };
  K.exportSame(fake, 'hwp'); K.exportSame(fake, 'hwpx');
  assert.deepEqual(calls, ['hwp', 'hwpx'], '★ .hwp 를 .hwpx 로 바꿔 저장하면 띄어쓰기가 160줄 어긋났다(2026-09-26 실측)');
});
