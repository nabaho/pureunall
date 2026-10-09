'use strict';
// 광고 표(bulk) · 지운 메일 표(gone) — node --test tests/mail-bulk-and-gone.test.js
//
// 대표 지시 2026-09-27
//   ① "스팸이나 광고메일도 많이 있다. 이부분은 자동으로 배제"
//   ② "다음 메일에서 삭제되었는지 체크하고 같이 삭제되도록 해라"
//
// 이 검사가 지키는 것
//   ①★ 낱말로는 «안» 가린다 — 판정이 제목·본문을 아예 안 본다
//   ②★★ 견주기가 틀렸을 때 «목록 전체»가 사라지지 않는다 (맞은 비율이 낮으면 그만둔다)
//   ③  메일함을 못 믿으면 아무것도 안 한다
//   ④  메일함이 담은 기간 «밖»은 안 건드린다
//   ⑤  지우지 않는다 — 표만 단다
//   ⑥  양 끝 — 서버가 적고 화면이 읽는다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MR = require('../functions/mail-receive.js');
const MG = require('../functions/mail-gone.js');
const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');

/* ══════════ ① 광고 표 ══════════ */

test('수신거부 안내가 붙으면 여럿에게 뿌린 것으로 본다', () => {
  assert.equal(MR.isBulkMail({ 'list-unsubscribe': '<mailto:off@synology.com>' }), true);
});

test('옛 규약(Precedence)도 본다', () => {
  ['bulk', 'list', 'junk', 'BULK'].forEach(v => {
    assert.equal(MR.isBulkMail({ precedence: v }), true, 'Precedence: ' + v);
  });
});

test('자동으로 만들어 보낸 것도 본다 — 다만 «no» 는 사람이 보낸 것이다', () => {
  assert.equal(MR.isBulkMail({ 'auto-submitted': 'auto-generated' }), true);
  assert.equal(MR.isBulkMail({ 'auto-submitted': 'no' }), false, 'no 는 사람이 보낸 것입니다');
});

test('머리글이 Map 으로 와도 읽는다 — 파서가 그렇게 준다', () => {
  const m = new Map([['list-unsubscribe', '<mailto:x@y.com>']]);
  assert.equal(MR.isBulkMail(m), true);
});

test('보통 업무 메일에는 표가 안 붙는다', () => {
  [{}, null, undefined, { subject: '무료 상담 요청' }, { from: 'ceo@ganasa.co.kr' },
   { precedence: 'normal' }].forEach(h => {
    assert.equal(MR.isBulkMail(h), false, JSON.stringify(h));
  });
});

test('★ 판정이 제목·본문을 «아예 안 본다» — 글자를 보면 결국 낱말 목록이 된다', () => {
  const src = MR.isBulkMail.toString() + MR.headerOf.toString();
  ['subject', 'body', 'preview', '광고', '대출', '무료'].forEach(k => {
    assert.equal(src.indexOf(k), -1, '판정이 ' + k + ' 를 봅니다');
  });
});

test('아닐 때는 칸을 아예 안 만든다 — 수백 줄의 false 도 값이다', () => {
  assert.equal('bulk' in MR.mailLogRecord({ from: 'a@b.com', subject: 'x' }), false);
  assert.equal(MR.mailLogRecord({ from: 'a@b.com', subject: 'x', bulk: true }).bulk, true);
});

/* ══════════ ② 지운 메일 표 ══════════ */

/* 메일함을 믿을 만큼(MIN_TRUST) 채운다 — 대부분은 목록에도 있는 것으로 */
function 메일함(rows, 채움) {
  const box = {};
  (rows || []).forEach((r, i) => { box['u' + i] = r; });
  const n = 채움 == null ? MG.MIN_TRUST + 10 : 채움;
  for (let i = 0; i < n; i++) {
    box['pad' + i] = { e: 'pad' + i + '@x.com', s: '채움 ' + i, d: 1757000000000 + i * 1000 };
  }
  return { INBOX: box };
}
const 줄 = (from, subject, at, more) =>
  Object.assign({ from, subject, at }, more || {});

test('메일함에 있는 메일은 안 건드린다', () => {
  const log = { k1: 줄('"홍길동" <hong@ganasa.co.kr>', '9월 근무표', 1757100000000) };
  const msgs = 메일함([{ e: 'hong@ganasa.co.kr', s: '9월 근무표', d: 1757100000000 }]);
  assert.deepEqual(MG.pickGone(log, msgs).mark, []);
});

test('★ 메일함에 없으면 표를 단다 — 다음메일에서 지운 것이다', () => {
  const log = {
    k1: 줄('"홍길동" <hong@ganasa.co.kr>', '9월 근무표', 1757100000000),
    k2: 줄('"광고" <ad@spam.com>', '지운 메일', 1757100500000)
  };
  const msgs = 메일함([{ e: 'hong@ganasa.co.kr', s: '9월 근무표', d: 1757100000000 }]);
  assert.deepEqual(MG.pickGone(log, msgs).mark, ['k2']);
});

test('제목이 길어도 맞는다 — 두 곳이 자르는 길이가 다르다', () => {
  const 긴제목 = '가'.repeat(250);
  const log = { k1: 줄('a@b.com', 긴제목.slice(0, 200), 1757100000000) };
  const msgs = 메일함([{ e: 'a@b.com', s: 긴제목.slice(0, 300), d: 1757100000000 }]);
  assert.deepEqual(MG.pickGone(log, msgs).mark, [], '긴 제목이 안 맞았습니다');
});

test('초 아래가 어긋나도 맞는다 — 분으로 뭉갠다', () => {
  const log = { k1: 줄('a@b.com', 'x', 1757100000000) };
  const msgs = 메일함([{ e: 'a@b.com', s: 'x', d: 1757100000000 + 45000 }]);
  assert.deepEqual(MG.pickGone(log, msgs).mark, []);
});

/* ── ②★★ 가장 중요한 안전장치 ── */

test('★★ 견주기가 «통째로» 안 맞으면 한 줄도 안 건드린다', () => {
  const log = {};
  for (let i = 0; i < 20; i++) log['k' + i] = 줄('a' + i + '@b.com', '제목' + i, 1757100000000 + i * 60000);
  /* 메일함에는 그 가운데 하나도 없다 — 셈법이 틀렸다는 뜻으로 읽어야 한다 */
  const r = MG.pickGone(log, 메일함([]));
  assert.deepEqual(r.mark, [], '스무 줄을 한꺼번에 뺐습니다 — 셈법이 틀렸을 때 목록이 사라집니다');
  assert.match(r.why, /맞은 비율/, '왜 그만뒀는지가 안 적혔습니다');
});

test('거의 다 맞으면 안 맞는 하나만 뺀다', () => {
  const log = {}, rows = [];
  for (let i = 0; i < 20; i++) {
    log['k' + i] = 줄('a' + i + '@b.com', '제목' + i, 1757100000000 + i * 60000);
    if (i > 0) rows.push({ e: 'a' + i + '@b.com', s: '제목' + i, d: 1757100000000 + i * 60000 });
  }
  assert.deepEqual(MG.pickGone(log, 메일함(rows)).mark, ['k0']);
});

/* ── ③ 메일함을 못 믿을 때 ── */

test('★ 메일함이 거의 비었으면 아무것도 안 한다 — 첫 동기화 중일 수 있다', () => {
  const log = { k1: 줄('a@b.com', 'x', 1757100000000) };
  const r = MG.pickGone(log, 메일함([], 5));
  assert.deepEqual(r.mark, []);
  assert.match(r.why, /믿지 않았습니다/);
});

test('메일함이 통째로 비어도 목록을 안 지운다', () => {
  const log = { k1: 줄('a@b.com', 'x', 1757100000000) };
  assert.deepEqual(MG.pickGone(log, {}).mark, []);
  assert.deepEqual(MG.pickGone(log, null).mark, []);
});

/* ── ④ 창 밖 ── */

test('★ 메일함이 담은 기간보다 «옛것»은 안 건드린다', () => {
  const 옛날 = 1700000000000;
  const log = { old: 줄('gone@x.com', '옛 메일', 옛날) };
  /* 메일함의 가장 오래된 것은 2025-09 무렵 — 옛 메일은 걷어낸 것일 뿐 지운 것이 아니다 */
  const r = MG.pickGone(log, 메일함([]));
  assert.deepEqual(r.mark, [], '메일함이 안 담은 옛 메일을 지웠다고 봤습니다');
});

/* ── ⑤ 두 번 적지 않는다 ── */

test('이미 표가 달린 줄은 다시 안 적는다 — 같은 값을 또 쓰면 요금이다', () => {
  const log = {}, rows = [];
  for (let i = 1; i < 20; i++) {
    log['k' + i] = 줄('a' + i + '@b.com', '제목' + i, 1757100000000 + i * 60000);
    rows.push({ e: 'a' + i + '@b.com', s: '제목' + i, d: 1757100000000 + i * 60000 });
  }
  log.k0 = 줄('gone@x.com', '없는 것', 1757100000000, { gone: true });
  assert.deepEqual(MG.pickGone(log, 메일함(rows)).mark, []);
});

test('★ 지우지 않는다 — 표만 단다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-gone.js'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
  assert.equal(code.indexOf('.remove('), -1, '메일 줄을 지웁니다');
  assert.equal(/=\s*null\s*;/.test(code.split('up[')[1] || ''), false, '줄을 null 로 덮습니다');
  assert.ok(/\/gone"\]\s*=\s*true/.test(code), 'gone 표를 true 로 달지 않습니다');
});

/* ══════════ ⑥ 양 끝 ══════════ */

test('★ 서버가 적는 곳과 화면이 읽는 곳이 «둘 다» 있다', () => {
  const idx = fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8');
  assert.ok(idx.indexOf('MR.isBulkMail(') >= 0, '서버가 광고 표를 안 답니다');
  assert.ok(idx.indexOf('exports.sweepDeletedMail') >= 0,
    '쓸기를 안 내보냅니다 — 적어 두기만 하면 배포가 안 됩니다');
  assert.ok(W.indexOf('m.bulk===true') >= 0, '화면이 광고 표를 안 읽습니다');
  assert.ok(W.indexOf('m.gone===true') >= 0, '화면이 지운 표를 안 읽습니다');
});

test('지운 표가 광고 표보다 «먼저»다 — 왜 빠졌는지가 거짓말이 되면 안 된다', () => {
  /* 2026-10-09 — mlkAuto 가 알림·발송 회사 판정으로 길어졌다. 고정 700자로 자르면 끝을 못 본다
     (test-cut-truncation 가드) — 함수를 괄호 짝으로 «통째로» 꺼낸다. */
  const i = W.indexOf('function mlkAuto(');
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  const src = W.slice(i, j);
  assert.ok(src.indexOf('m.gone===true') < src.indexOf('m.bulk===true'),
    '지운 메일을 「광고」라고 적습니다');
});

test('화면에 왜 빠졌는지 우리말로 적힌다', () => {
  ['다음메일에서 지움', '메일함에 없음'].forEach(k => {
    assert.ok(W.indexOf(k) >= 0, '빠진 말: ' + k);
  });
});
