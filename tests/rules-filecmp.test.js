/* 두 파일 견주기(신구대조) 부품 — js/pu-rules-filecmp.js · 2026-09-30 목업 ③ 「추천대로」
   조번호는 한 조만 끼워도 뒤가 다 밀린다. 번호가 아니라 «제목» 으로 짝지어야
   밀린 조가 전부 「바뀜」 으로 뜨지 않는다 — 그것을 행동으로 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/pu-rules-filecmp.js');

function art(num, title, body, sub) {
  const label = '제' + num + '조' + (sub ? '의' + sub : '');
  return { num, sub: sub || null, label, title, body: label + '(' + title + ') ' + body };
}
const OLD = [
  art(1, '목적', '이 규칙은 가나상사 근로자의 근로조건을 정함을 목적으로 한다.'),
  art(2, '휴게', '① 휴게시간은 12:00부터 13:00까지로 한다.'),
  art(3, '연차', '① 회사는 1년간 80퍼센트 이상 출근한 근로자에게 15일의 유급휴가를 준다.'),
  art(4, '징계부가금', '징계부가금은 금품 수수액의 2배 이내로 한다.'),
  art(5, '정년', '근로자의 정년은 만 60세에 도달한 날로 한다.')
];
const NEW = [
  art(1, '목적', '이 규칙은 가나상사 근로자의 근로조건을 정함을 목적으로 한다.'),
  art(2, '휴게시간 선택', '휴게시간 선택 요청은 서면으로 한다.'),          // 끼운 새 조 — 뒤가 한 칸씩 밀림
  art(3, '휴게', '① 휴게시간은 12:00부터 13:00까지로 한다. 다만, 근로자가 요청하면 달리 정할 수 있다.'),
  art(4, '연차', '① 회사는 1년간 80퍼센트 이상 출근한 근로자에게 12일의 유급휴가를 준다.'),
  art(5, '정년', '근로자의 정년은 만 60세에 도달한 날로 한다.')
];

test('제목으로 짝짓는다 — 한 조를 끼워 번호가 밀려도 같은 글은 「번호 바뀜」, 빠진 조는 「없어짐」', () => {
  const r = C.compare(OLD, NEW);
  const k = r.rows.map(x => x.kind + ':' + (x.old ? x.old.label : '-') + '>' + (x.now ? x.now.label : '-'));
  assert.ok(k.includes('같음:제1조>제1조'));
  assert.ok(k.includes('새 조:->제2조'), '★ 끼운 조를 옛 제2조(휴게)와 짝지었다 — 번호로 짝짓고 있다');
  assert.ok(k.includes('바뀜:제2조>제3조'));
  assert.ok(k.includes('바뀜:제3조>제4조'));
  assert.ok(k.includes('없어짐:제4조>-'));
  assert.ok(k.includes('번호 바뀜:제5조>제5조') === false && k.includes('같음:제5조>제5조'));
  assert.equal(r.counts['바뀜'], 2);
  assert.equal(r.counts['새 조'], 1);
  assert.equal(r.counts['없어짐'], 1);
  /* 없어진 조는 옛 자리(정년 앞)에 */
  const iDel = k.indexOf('없어짐:제4조>-'), iEnd = k.indexOf('같음:제5조>제5조');
  assert.ok(iDel >= 0 && iDel < iEnd, '없어진 조가 옛 자리가 아닌 맨 끝으로 간다');
});

test('글은 같고 번호만 다르면 「번호 바뀜」 — 제목만 고친 조는 본문으로 짝짓는다', () => {
  const o = [art(1, '목적', '가'.repeat(12)), art(2, '정년', '근로자의 정년은 만 60세에 도달한 날로 한다.')];
  const n = [art(1, '목적', '가'.repeat(12)), art(2, '신설', '새로 넣은 조의 본문이다.'), art(3, '정년', '근로자의 정년은 만 60세에 도달한 날로 한다.')];
  const r = C.compare(o, n);
  assert.ok(r.rows.some(x => x.kind === '번호 바뀜' && x.old.label === '제2조' && x.now.label === '제3조'));
  const t = C.compare([art(7, '퇴직', '근로자가 퇴직하려면 30일 전에 알린다.')], [art(7, '사직', '근로자가 퇴직하려면 30일 전에 알린다.')]);
  assert.equal(t.rows.length, 1);
  assert.equal(t.rows[0].kind, '바뀜', '★ 제목이 바뀐 조를 「같음」 으로 본다');
});

test('낱말 차이 — 숫자만 바뀌면 숫자만 칠한다, 두 쪽을 이어 붙이면 원래 글', () => {
  const a = '15일의 유급휴가를 준다.', b = '12일의 유급휴가를 준다.';
  const d = C.wordDiff(a, b);
  assert.deepEqual(d.filter(x => x.t === '-').map(x => x.s), ['15']);
  assert.deepEqual(d.filter(x => x.t === '+').map(x => x.s), ['12']);
  assert.equal(d.filter(x => x.t !== '+').map(x => x.s).join(''), a);
  assert.equal(d.filter(x => x.t !== '-').map(x => x.s).join(''), b);
});

test('검토 기준은 바뀐 조·새 조에만 — 옛 글에도 있던 위반 의심은 was 로 가른다', () => {
  const r = C.compare(OLD, NEW);
  const B5 = { id: 'B5', name: '연차 15일', law: '근로기준법 §60' }, B9 = { id: 'B9', name: '정년', law: '고령자고용법' };
  const B2 = { id: 'B2', name: '휴게', law: '근로기준법 §54' };
  const resNew = [
    { rule: B5, status: '위반의심', loc: '제4조', note: '15일 미달' },
    { rule: B9, status: '위반의심', loc: '제5조' },            // 같은 조(안 바뀜) — 달지 않는다
    { rule: B2, status: '위반의심', loc: '제3조' },
    { rule: { id: 'A1' }, status: '적합', loc: '제4조' }
  ];
  const resOld = [{ rule: B2, status: '위반의심', loc: '제2조' }];
  const s = C.flag(r.rows, resOld, resNew);
  const at = l => r.rows.find(x => x.now && x.now.label === l).flags;
  assert.deepEqual(at('제4조').map(g => g.id + ':' + g.was), ['B5:false']);
  assert.deepEqual(at('제3조').map(g => g.id + ':' + g.was), ['B2:true']);
  assert.deepEqual(at('제5조'), [], '★ 안 바뀐 조에도 검토 기준을 단다');
  assert.equal(s.total, 2);
  assert.equal(s.fresh, 1);
});

test('새 회차 계획 — 바뀐 조는 옛 번호로 새 글, 새 조는 앞 짝 조 뒤, 없어진 조는 삭제, 번호만 바뀐 것은 뺀다', () => {
  const o = OLD.concat([art(6, '부칙 전 조', '끝 조의 본문이다. 길게 적는다.')]);
  const n = NEW.concat([art(7, '부칙 전 조', '끝 조의 본문이다. 길게 적는다.')]);
  const r = C.compare(o, n);
  const p = C.plan(r.rows);
  assert.deepEqual(p.amend.map(x => x.label), ['제2조', '제3조'], '★ 새 글을 «새 번호» 에 건다 — 옛 원본의 다른 조를 덮는다');
  assert.match(p.amend[1].text, /12일/);
  assert.deepEqual(p.ins.map(x => x.label + '@' + x.after), ['제2조@제1조']);
  assert.doesNotMatch(p.ins[0].text, /^제2조/, '신설 문안에 새 파일의 조 머리를 달면 번호가 두 번 붙는다');
  assert.deepEqual(p.del, ['제4조']);
  assert.ok(!p.amend.some(x => x.label === '제6조'), '번호만 바뀐 조를 개정으로 넣는다');
});

test('한글 신구대조표 줄 — 같은 조는 빼고, 번호가 바뀐 조는 「옛 → 새」', () => {
  const r = C.compare(OLD, NEW);
  const rows = C.daejoRows(r.rows);
  assert.equal(rows.length, r.rows.length - r.counts['같음']);
  assert.ok(rows.some(x => x[0].startsWith('제3조 → 제4조')));
  assert.ok(rows.every(x => x.length === 4));
});
