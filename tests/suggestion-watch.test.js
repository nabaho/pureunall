'use strict';
/* 건의함 감시·답변 도구(scripts/suggestion-watch.js)의 규칙 (대표 지시 2026-10-30 「건의함 자동감시」)

   ■ 지키는 것 — 값이 아니라 «규칙»
     ① 미처리 = meta 의 status 가 done «이 아닌» 것 — 오래된 것부터
     ② 답변은 «세 자리»에 같은 말로 간다(본문·미처리 판정·건의자 진행함)
     ③ 거짓 완료를 막는다 — 짧은 완료 답(「처리함」)·이미 done 인 건을 덮는 것·new 로 되돌리는 것은 거절
     ④ 건의자 팝업: 완료 답은 기본으로 알리고(seen:false), 검토중 답·정리 답은 조용히
   실행: node --test tests/suggestion-watch.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pickPending, buildReplyWrites, MIN_DONE_REPLY } = require('../scripts/suggestion-watch.js');

const LONG = '■ 왜 그랬나 한 줄이 빠져 있었습니다. ■ 어떻게 고쳤나 빠진 줄을 되살렸습니다. ■ 하실 일 새로고침 해 주세요.';
const rec = (o) => Object.assign({ authorUid: 'U1', title: '제목', cat: 'erp', createdAt: 1000, status: 'new' }, o || {});

test('① 미처리는 done 이 «아닌» 것이다 — new 와 ing 둘 다, 오래된 것부터', () => {
  const meta = {
    b: { status: 'new', createdAt: 30, title: 'B' },
    a: { status: 'ing', createdAt: 10, title: 'A' },
    c: { status: 'done', createdAt: 20, title: 'C' },
    d: { createdAt: 5, title: 'D' }               /* status 가 없는 옛 기록 — 완료가 확인되지 않았으니 미처리 */
  };
  assert.deepEqual(pickPending(meta).map((x) => x.id), ['d', 'a', 'b']);
  assert.deepEqual(pickPending(null), [], '건의함이 비어 있어도 죽지 않는다');
  assert.deepEqual(pickPending({ x: null }), []);
});

test('★ ② 답변은 세 자리에 «같은 말과 같은 상태»로 간다', () => {
  const w = buildReplyWrites({ id: 'I1', rec: rec(), status: 'done', reply: LONG, now: 5000 });
  assert.equal(w.private.status, 'done');
  assert.equal(w.private.reply, LONG);
  assert.equal(w.private.repliedAt, 5000);
  assert.equal(w.meta.status, 'done', '★ 미처리 판정 기준(meta)을 안 고치면 답은 들어갔는데 미처리로 남는다');
  assert.equal(w.resolved.uid, 'U1', '건의자 진행함 자리가 건의자 uid 가 아닙니다');
  assert.equal(w.resolved.data.reply, LONG);
  assert.equal(w.resolved.data.status, 'done');
  assert.equal(w.resolved.data.at, 1000, '진행함의 시각은 «건의한 때»다(답한 때가 아니다)');
});

test('★★ ③ 거짓 완료를 막는다', () => {
  assert.throws(() => buildReplyWrites({ id: 'I1', rec: rec(), status: 'done', reply: '처리함' }), /짧/,
    '★ 「처리함」 같은 짧은 완료 답이 통과합니다(7~8월에 14건 있었다)');
  assert.ok(MIN_DONE_REPLY >= 30, '완료 답의 최소 길이가 너무 낮습니다');
  assert.throws(() => buildReplyWrites({ id: 'I1', rec: rec({ status: 'done' }), status: 'done', reply: LONG }), /이미 완료/,
    '★ 이미 완료된 건을 말없이 덮습니다 — 정정은 --again 으로 «일부러» 해야 한다');
  assert.doesNotThrow(() => buildReplyWrites({ id: 'I1', rec: rec({ status: 'done' }), status: 'done', reply: LONG, again: true }));
  assert.throws(() => buildReplyWrites({ id: 'I1', rec: rec(), status: 'new', reply: LONG }), /ing 또는 done/,
    'new 로 되돌릴 수 있습니다');
  assert.throws(() => buildReplyWrites({ id: 'I1', rec: rec(), status: 'ing', reply: '  ' }), /비어/);
  assert.throws(() => buildReplyWrites({ id: 'I1', rec: null, status: 'ing', reply: '접수했습니다' }), /찾지 못/,
    '없는 건의에 쓰면 빈 자리가 생깁니다');
  assert.throws(() => buildReplyWrites({ id: 'I1', rec: { title: 'x' }, status: 'ing', reply: '접수했습니다' }), /uid/,
    '건의자를 모르면 진행함 자리를 만들 수 없습니다');
});

test('④ 건의자 팝업 — 완료 답은 알리고, 검토중 답과 «이미 확인한 분께 드리는 정리 답»은 조용히', () => {
  assert.equal(buildReplyWrites({ id: 'I', rec: rec(), status: 'done', reply: LONG }).resolved.data.seen, false);
  assert.equal(buildReplyWrites({ id: 'I', rec: rec(), status: 'ing', reply: '접수했습니다. 검토 중입니다.' }).resolved.data.seen, true,
    '검토중 답에 팝업이 뜹니다 — 「해결됐나요?」를 아직 고치지도 않은 건에 묻게 된다');
  assert.equal(buildReplyWrites({ id: 'I', rec: rec(), status: 'done', reply: LONG, seen: true }).resolved.data.seen, true);
});

test('⑤ 도구는 «읽기 명령은 아무것도 안 쓴다» — pending·show 에는 쓰기 호출이 없다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'suggestion-watch.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
  const sliceFn = (n) => { const i = src.indexOf('function ' + n + '('); let d = 0, j = src.indexOf('{', i);
    for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(i, j + 1); };
  ['cmdPending', 'cmdShow'].forEach((n) => assert.ok(!/updateJson\(|database:(update|set|remove)/.test(sliceFn(n)),
    '★ ' + n + ' 가 쓰기를 부릅니다 — 읽기 명령은 아무것도 바꾸지 않습니다'));
  /* 쓰는 자리는 세 곳뿐 — 다른 경로를 쓰면 안 된다 */
  const writes = [...sliceFn('cmdReply').matchAll(/updateJson\('([^']*)'/g)].map((m) => m[1]);
  assert.equal(writes.length, 3, '쓰는 자리가 세 곳이 아닙니다: ' + writes.join(' | '));
  assert.ok(!/rules|storage|deploy/i.test(src.replace(/\/\/.*$/gm, '').replace(/'[^']*안 하는 것[^']*'/g, '')),
    '이 도구가 규칙·배포를 건드립니다 — 한 건의 세 자리만 쓰는 도구입니다');
});
