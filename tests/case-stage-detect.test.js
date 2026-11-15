'use strict';
/* 계약의 «심급·단계»(노동위원회·산재) 읽기 — 순수 함수 (대표 승인 2026-11-15 «권고대로»)
 * 계획: docs/superpowers/plans/2026-11-15-quote-auto-plan5-case-stage-marks.md
 * ⚠ 이 저장소는 공개다 — 문구·업체·번호는 전부 지어낸 것이다.
 * 실행: node --test tests/case-stage-detect.test.js
 *
 * ■ 못 박는 것 — 깨지면 «잘못 읽은 단계»가 계약에 조용히 붙는다
 *   ① 재심사청구 안의 «심사청구»를 심사청구로, «재심»을 중노위로 읽지 않는다.
 *   ② 사건류 계약일 때만 읽는다(컨설팅·자문 글의 «노동위원회» 낱말은 무시).
 *   ③ 근거 글 조각에 금액·번호 덩어리가 남지 않는다.
 *   ④ 사람이 정한 상태(checked·dismissed)는 다시 읽어도 안 바뀌고, 기계는 지우지 않는다.
 *   ⑤ 단계 코드는 사건 단계 목록(pu-erp.html)에 있는 것만 — 목록에서 빠지거나 이름이 바뀌면 여기서 깨진다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../js/pu-case-stage.js');

const CASE = { kinds: ['case'] };
const codes = (r) => Array.from(r.map((x) => x.code));
const scope = (text) => [{ where: 'scope', text }];

test('① 지노위·중노위 — 한 계약서에 둘 다 나오면 둘 다, 단계 순서대로', () => {
  const r = S.detect(scope('부당해고 구제신청(중앙노동위원회 재심 포함) 및 지방노동위원회 대리'), CASE);
  assert.deepEqual(codes(r), ['lrc-local', 'lrc-central'], '글에 나온 순서가 아니라 단계 순서');
  r.forEach((x) => assert.equal(x.strength, 'strong'));
  assert.deepEqual(codes(S.detect(scope('중노위 재심판정 취소 행정소송 대리'), CASE)), ['lrc-central', 'court-admin']);
});

test('① 산재 — 요양신청·심사청구·재심사청구를 각각 읽는다', () => {
  assert.deepEqual(codes(S.detect(scope('산재 요양급여 신청, 심사청구 및 재심사청구 대리'), CASE)), ['wc-apply', 'wc-review', 'wc-rereview']);
  assert.deepEqual(codes(S.detect(scope('최초요양 신청 대리'), CASE)), ['wc-apply']);
});

test('★ ① 「재심사청구」는 심사청구도 중노위도 아니다 — 재심사청구 하나만', () => {
  for (const t of ['재심사청구 대리', '산업재해보상보험재심사위원회 재심사 청구', '재 심사 청구 진행']) {
    assert.deepEqual(codes(S.detect(scope(t), CASE)), ['wc-rereview'], t);
  }
  assert.deepEqual(codes(S.detect(scope('심사청구 대리'), CASE)), ['wc-review']);
  assert.deepEqual(codes(S.detect(scope('재심 신청 대리'), CASE)), ['lrc-central'], '「재심 신청」은 중노위, 산재 재심사와 다르다');
});

test('★ ① 「산재 심사청구」의 «재 심사청구» 를 재심사청구로 읽지 않는다 (통합 검사가 찾은 오탐)', () => {
  for (const t of ['산재 심사청구 대리', '산재 심사 청구 대리', '산재  심사청구']) {
    assert.deepEqual(codes(S.detect(scope(t), CASE)), ['wc-review'], t);
  }
  assert.deepEqual(codes(S.detect(scope('산재 요양급여 신청 및 산재 심사청구 대리'), CASE)), ['wc-apply', 'wc-review']);
  assert.deepEqual(codes(S.detect(scope('산재 재심사청구 대리'), CASE)), ['wc-rereview'], '진짜 재심사청구는 그대로 읽는다');
  assert.deepEqual(codes(S.detect(scope('산재재심사청구'), CASE)), ['wc-rereview']);
  assert.deepEqual(codes(S.detect(scope('산재 심사청구 및 산재 재심사청구 대리'), CASE)), ['wc-review', 'wc-rereview'], '둘 다 있으면 둘 다');
  const ev = S.detect(scope('산재 심사청구 대리'), CASE)[0].evidence;
  assert.ok(ev.includes('산재'), '근거 글 조각은 원문 그대로(산재가 지워지지 않는다): ' + ev);
});

test('① 행정심판은 행정소송이 아니다 · 낱말이 없으면 아무것도 안 읽는다', () => {
  assert.deepEqual(codes(S.detect(scope('행정심판 청구 대리'), CASE)), []);
  assert.deepEqual(codes(S.detect(scope('임금체불 진정 대리 및 근로감독관 면담'), CASE)), []);
  assert.deepEqual(codes(S.detect([], CASE)), []);
  assert.deepEqual(codes(S.detect(null, CASE)), []);
});

test('② 사건류 계약일 때만 읽는다 — 컨설팅·자문 글의 «노동위원회» 는 표시하지 않는다', () => {
  const text = scope('지방노동위원회 구제신청 대리');
  assert.deepEqual(codes(S.detect(text, { kinds: ['consulting'] })), []);
  assert.deepEqual(codes(S.detect(text, { kinds: ['company'] })), []);
  assert.deepEqual(codes(S.detect(text, {})), []);
  assert.deepEqual(codes(S.detect(text, { kinds: ['case'] })), ['lrc-local']);
  assert.deepEqual(codes(S.detect(text, { kinds: ['consult'], inferredKind: 'case' })), ['lrc-local'], '메일 분석이 사건으로 본 것');
});

test('강약 — «판정례 참고» 같은 언급과 메일 머리글만 있는 것은 weak', () => {
  assert.equal(S.detect(scope('지방노동위원회 판정례 참고'), CASE)[0].strength, 'weak');
  assert.equal(S.detect(scope('지방노동위원회'), CASE)[0].strength, 'weak', '맡는 일 낱말이 곁에 없으면 weak');
  /* 맡는 일 낱말(구제신청·대리)이 «함께» 있어도 언급 낱말(사례·표준)이 곁에 있으면 weak — 두 조건을 따로 지킨다 */
  assert.equal(S.detect(scope('지방노동위원회 구제신청 대리 사례 참고'), CASE)[0].strength, 'weak');
  assert.equal(S.detect(scope('표준 양식 지방노동위원회 구제신청 대리'), CASE)[0].strength, 'weak');
  assert.equal(S.detect(scope('지방노동위원회 구제신청 대리 수임'), CASE)[0].strength, 'strong', '언급 낱말이 없으면 strong');
  assert.equal(S.detect([{ where: 'subject', text: '지방노동위원회 구제신청 대리 견적서' }], CASE)[0].strength, 'weak', '메일 제목만');
  const both = S.detect([{ where: 'subject', text: '지방노동위원회 구제신청 대리 견적서' }, { where: 'scope', text: '지방노동위원회 구제신청 대리' }], CASE);
  assert.equal(both[0].strength, 'strong', '내용 칸에서도 나오면 strong');
  assert.equal(both[0].where, 'scope');
});

test('③ 근거 글 조각 — 금액·번호 덩어리가 남지 않고 길이가 한정된다', () => {
  const r = S.detect(scope('충남2026부해123 건 착수금 5,500,000원 지방노동위원회 구제신청 대리 성공보수 3300000원'), CASE)[0];
  assert.ok(r.evidence.includes('지방노동위원회'));
  assert.ok(!/\d{4,}/.test(r.evidence) && !/\d{1,3}(?:,\d{3})+/.test(r.evidence), '숫자 덩어리 없음: ' + r.evidence);
  assert.ok(r.evidence.length <= 90);
  const long = S.detect(scope('가'.repeat(500) + ' 지방노동위원회 대리 ' + '나'.repeat(500)), CASE)[0];
  assert.ok(long.evidence.length <= 90, '앞뒤 24자만');
});

test('입력 한도 — 아주 긴 글·빈칸 폭탄도 즉시 끝난다', () => {
  const t0 = Date.now();
  S.detect(scope('ㅇ' + ' '.repeat(200000) + '지방노동위원회 대리'), CASE);
  S.detect(scope('지 방 노 동 위 원 회 '.repeat(5000)), CASE);
  assert.ok(Date.now() - t0 < 500, '정규식이 길어지지 않는다');
  assert.deepEqual(codes(S.detect(scope('가'.repeat(5000) + '지방노동위원회 대리'), CASE)), [], '칸당 4000자까지만 본다');
});

test('④ 합치기 — 새 코드만 auto 로 더하고, 사람이 정한 상태는 다시 읽어도 그대로', () => {
  const found = S.detect(scope('지방노동위원회 및 중앙노동위원회 대리'), CASE);
  const a = S.merge([], found, { now: 1000, srcDoc: '수임계약서' });
  assert.deepEqual(a.added, ['lrc-local', 'lrc-central']);
  assert.ok(a.marks.every((m) => m.state === 'auto' && m.srcDoc === '수임계약서' && m.at === 1000));
  const human = S.setState(S.setState(a.marks, 'lrc-local', 'checked', 'S1', 2000), 'lrc-central', 'dismissed', 'S1', 2100);
  const again = S.merge(human, found, { now: 3000 });
  assert.deepEqual(again.added, [], '이미 있는 코드는 다시 안 더한다 — dismissed 도 되살리지 않는다');
  assert.deepEqual(again.marks.map((m) => m.state), ['checked', 'dismissed']);
  assert.equal(again.marks[0].bySid, 'S1');
  assert.equal(again.marks[0].at, 2000, '확인한 시각이 다시 읽는다고 바뀌지 않는다');
  const empty = S.merge(human, [], { now: 4000 });
  assert.equal(empty.marks.length, 2, '못 읽었다고 지우지 않는다');
  assert.deepEqual(S.merge(S.merge([], found, { now: 1 }).marks, found, { now: 2 }).added, [], '두 번 돌려도 같다');
});

test('④ 사람이 누른 것 — ☑ ✕ 되돌리기 · 목록에 없는 단계는 «직접 추가»로 checked', () => {
  let m = S.merge([], S.detect(scope('지방노동위원회 대리'), CASE), { now: 1 }).marks;
  m = S.setState(m, 'lrc-local', 'checked', 'S7', 50);
  assert.deepEqual([m[0].state, m[0].bySid, m[0].at], ['checked', 'S7', 50]);
  m = S.setState(m, 'lrc-local', 'auto', 'S7', 60);
  assert.equal(m[0].state, 'auto');
  assert.equal(m[0].bySid, undefined, '되돌리면 «누가»도 지운다');
  m = S.setState(m, 'wc-review', 'checked', 'S7', 70);
  assert.deepEqual(m.map((x) => x.code), ['lrc-local', 'wc-review'], '단계 순서로 정렬');
  assert.equal(m[1].state, 'checked');
  assert.deepEqual(S.setState(m, 'no-such', 'checked', 'S7', 1).map((x) => x.code), ['lrc-local', 'wc-review'], '모르는 코드는 무시');
  assert.equal(S.setState(m, 'wc-review', 'weird', 'S7', 1)[1].state, 'checked', '모르는 상태는 무시');
});

test('저장된 값을 믿기 전에 거른다 — 모르는 코드·상태·모양·겹침은 버린다', () => {
  const c = S.clean([{ code: 'lrc-local', state: 'checked', evidence: 'x'.repeat(500) }, { code: 'lrc-local' }, { code: '???' }, null, 'x',
    { code: 'wc-apply', state: '이상한값' }, { code: 'court-admin', state: 'dismissed', strength: 'strong', at: '12' }]);
  assert.deepEqual(c.map((x) => x.code), ['lrc-local', 'wc-apply', 'court-admin']);
  assert.equal(c[0].evidence.length, 90);
  assert.equal(c[1].state, 'auto');
  assert.equal(c[2].at, 12);
  assert.deepEqual(S.clean('쓰레기'), []);
  assert.deepEqual(S.clean(undefined), []);
});

test('칩 — dismissed 는 뺀다 · 단계 순서 · 상태를 함께 돌려준다', () => {
  const m = S.setState(S.merge([], S.detect(scope('산재 요양급여 신청 및 심사청구 대리, 지방노동위원회 구제신청 대리'), CASE), { now: 1 }).marks, 'wc-review', 'dismissed', 'S1', 2);
  const chips = S.summary(m);
  assert.deepEqual(Array.from(chips.map((c) => c.short)), ['지노위', '요양']);
  assert.ok(chips.every((c) => c.state === 'auto'));
});

test('⑤ 단계 코드는 사건 단계 목록(pu-erp.html BIZ_CASE_STAGE_SEED)에 있는 것만 — 이름·순서도 같다', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
  const at = html.indexOf('var BIZ_CASE_STAGE_SEED = [');
  assert.ok(at > 0, '사건 단계 목록을 못 찾음');
  const body = html.slice(at, html.indexOf('\n];', at));
  const seed = [...body.matchAll(/code:'([a-z-]+)',\s+name:'([^']+)',\s+short:'([^']+)'/g)].map((m) => ({ code: m[1], name: m[2], short: m[3] }));
  const order = seed.map((s) => s.code);
  S.STAGES.forEach((st) => {
    const def = seed.find((s) => s.code === st.code);
    assert.ok(def, '목록에서 빠졌다: ' + st.code);
    assert.equal(st.name, def.name, st.code + ' 이름이 목록과 같다');
    assert.equal(st.short, def.short, st.code + ' 줄임말이 목록과 같다');
  });
  const mine = S.STAGES.map((s) => order.indexOf(s.code));
  assert.deepEqual(mine, [...mine].sort((a, b) => a - b), '순서가 목록의 순서를 거스르지 않는다');
});

test('겉틀 — 브라우저 전역으로도 노출되고(Node 겸용) 전역을 더럽히지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-case-stage.js'), 'utf8');
  assert.match(src, /root\.PuCaseStage = api/);
  const vm = require('node:vm');
  const ctx = { window: {} }; ctx.globalThis = ctx.window;
  vm.createContext(ctx);
  vm.runInContext(src.replace(/\}\)\(typeof globalThis[^)]*\);\s*$/, '})(window);'), ctx);
  assert.equal(typeof ctx.window.PuCaseStage.detect, 'function');
  assert.deepEqual(Object.keys(ctx).sort(), ['globalThis', 'window']);
});
