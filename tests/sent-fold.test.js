/* 보낸 메일 목록 — 한 번에 보낸 것은 «한 줄»로 묶는다 (대표 지시 2026-11-09)
 *
 *   「대량으로 보낸메일 너무 많이 표시된다. 모든 사람 필요없다. 해결방안 만들어라」
 *
 * ■ 무슨 일이었나
 *   보낸 메일 목록(pucards/sentBox)은 «받는 곳마다 한 줄»이다. 주간 뉴스레터가 175곳으로 나가면
 *   같은 제목 줄이 175줄 쌓이고, 불러온 최근 300줄이 거의 그것으로 찼다.
 *   (다음메일 보낸함은 10/12 에 «한 통»으로 고쳤지만 이 목록은 따로였다.)
 *
 * ■ 무엇을 지키나 — «기록은 지우지 않고 화면에서만 묶는다»
 *   ① 같은 보낸이·같은 제목이 이어서 «여럿» 나간 것은 한 줄(몇 곳)로 묶인다.
 *   ② 두세 사람에게 따로 보낸 것·제목이 다른 것·제목이 빈 것은 묶이지 않는다.
 *   ③ 묶어도 «잃는 줄이 없다» — 묶음 안 줄 + 낱줄 = 들어간 줄 전부.
 *   ④ 펼치면 받은 곳이 모두 나오고, 「낱낱이 보기」는 예전 그대로다.
 *   ⑤ 찾기로 한 곳만 남기면 묶이지 않고 그 줄이 그대로 나온다.
 *   ⑥ 번호 규칙(맨 왼쪽 번호 · ☐ 없음) · 이름 표시(staffName)는 그대로.
 *
 * ⚠ 값을 박지 않는다 — 간격·최소 줄 수는 소스의 상수(SENT_FOLD_*)를 읽어 «경계에서» 본다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');

const cards = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');

function constLine(name) {
  const m = new RegExp('^const ' + name + ' = [^\\n]*;', 'm').exec(cards);
  assert.ok(m, name + ' 상수를 못 찾았습니다');
  return m[0];
}

/* 소스에서 «진짜 함수»를 잘라 가짜 화면(상태·도우미)에 올려 돌린다 */
function makeEnv(stateInit) {
  const parts = [
    constLine('SENT_FOLD_GAP_MS'), constLine('SENT_FOLD_MIN'), constLine('sentHm'),
    sliceFn(cards, 'function sentVisibleRows()'),
    sliceFn(cards, 'function sentFold(rows)'),
    sliceFn(cards, 'function sentFoldToggle(key)'),
    sliceFn(cards, 'function sentFlatToggle()'),
    sliceFn(cards, 'function sentTdsHtml(v, sub)'),
    sliceFn(cards, 'function sentFoldHtml(g, i, isOpen)'),
    sliceFn(cards, 'function sentBoxHtml()'),
    '({ sentFold, sentFoldToggle, sentFlatToggle, sentBoxHtml, sentVisibleRows, GAP: SENT_FOLD_GAP_MS, MIN: SENT_FOLD_MIN })',
  ];
  const ctx = {
    state: Object.assign({ sentBox: {}, sentQ: '', sentMine: false, sentCat: '', sentBy: '', sentFlat: false, sentOpen: {} }, stateInit || {}),
    myEmail: 'me@example.invalid', _matMeta: {}, matCat: () => '',
    staffName: (e) => ({ 'p@example.invalid': '보낸이가' }[String(e || '')] || ''),
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    fmtDate: (ts) => { const d = new Date(ts || 0); return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate(); },
    redraws: 0,
  };
  ctx.renderMailPage = () => { ctx.redraws++; };
  vm.createContext(ctx);
  const api = vm.runInContext(parts.join('\n'), ctx);
  return { api, ctx };
}

const BASE = Date.UTC(2026, 10, 9, 0, 0, 0);
const MIN = 60 * 1000;
let seq = 0;
/* 가짜 보낸 줄 — 주소는 example.invalid, 사람 이름은 «받는곳N» */
function row(at, over) {
  seq++;
  return Object.assign({ id: 'k' + String(seq).padStart(4, '0'), at, by: 'p@example.invalid', to: 'u' + seq + '@example.invalid',
    toName: '받는곳' + seq, subject: '주간뉴스레터 입니다', names: [], set: '', cardId: '' }, over || {});
}
/* 대량 발송 한 건 — 발송기가 한 바퀴(15분)마다 20통씩 */
function bulk(n, start, over) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(row(start + Math.floor(i / 20) * 15 * MIN + (i % 20) * 1000, over));
  return out;
}
const desc = (rows) => rows.slice().sort((a, b) => b.at - a.at);
const keyed = (rows) => { const o = {}; rows.forEach((r) => { o[r.id] = r; }); return o; };

test('★ 한 번에 보낸 175곳이 한 줄이 된다 — 몇 곳인지 말한다', () => {
  const { api } = makeEnv();
  const rows = desc(bulk(175, BASE));
  const items = api.sentFold(rows);
  assert.equal(items.length, 1, '★ 175줄이 한 줄로 안 묶였습니다');
  assert.equal(items[0].fold, true);
  assert.equal(items[0].n, 175);
  assert.equal(items[0].rows.length, 175);
});

test('③ 묶어도 잃는 줄이 없다 — 묶음 안 + 낱줄 = 들어간 줄 전부', () => {
  const { api } = makeEnv();
  const rows = desc([].concat(
    bulk(60, BASE + 600 * MIN),
    [row(BASE + 500 * MIN, { subject: '계약서 보내드립니다' })],
    bulk(30, BASE + 100 * MIN, { subject: '안내문' }),
    [row(BASE + 50 * MIN, { subject: '계약서 보내드립니다' }), row(BASE + 40 * MIN, { subject: '계약서 보내드립니다' })]));
  const items = api.sentFold(rows);
  const ids = [];
  items.forEach((it) => (it.fold ? it.rows : [it.row]).forEach((r) => ids.push(r.id)));
  assert.equal(ids.length, rows.length, '★ 묶다가 줄을 잃거나 늘렸습니다');
  assert.equal(new Set(ids).size, rows.length, '같은 줄이 두 번 나옵니다');
});

test('② 한도의 «뜻»을 지킨다 — 두세 사람 몫은 안 묶고, 발송기 한 바퀴보다는 넉넉하며, 다른 날 발송과는 안 섞인다', () => {
  const { api } = makeEnv();
  /* 값을 박지 않고 «규칙»으로 본다(경계 검사는 소스 상수를 따라가므로, 상수가 엉뚱해져도 안 울린다 — 그래서 뜻을 따로 못 박는다) */
  assert.ok(api.MIN >= 3, '★ 두세 사람에게 따로 보낸 것까지 묶게 됩니다');
  const drainMs = require('../functions/mail-bulk.js').DRAIN_EVERY_MIN * MIN;
  assert.ok(api.GAP > drainMs, '★ 발송기 한 바퀴 간격보다 좁으면 한 번의 대량 발송이 여러 묶음으로 쪼개집니다');
  assert.ok(api.GAP <= 24 * 60 * MIN, '★ 하루가 넘게 벌어져도 같은 묶음이면 다른 날 보낸 같은 제목이 한 줄로 섞입니다');
  /* 하루 간격의 같은 제목 두 번 — 두 묶음 */
  const a = bulk(30, BASE), b = bulk(30, BASE + 24 * 60 * MIN);
  assert.equal(api.sentFold(desc(a.concat(b))).filter((i) => i.fold).length, 2, '다른 날 보낸 것이 한 줄로 섞였습니다');
});

test('② 적은 줄 수는 묶지 않는다 — 경계(최소 줄 수 바로 아래·바로 위)', () => {
  const { api } = makeEnv();
  const below = api.sentFold(desc(bulk(api.MIN - 1, BASE)));
  assert.equal(below.filter((i) => i.fold).length, 0, '★ 두세 사람에게 따로 보낸 것까지 묶었습니다');
  assert.equal(below.length, api.MIN - 1);
  const at = api.sentFold(desc(bulk(api.MIN, BASE)));
  assert.equal(at.filter((i) => i.fold).length, 1, '최소 줄 수부터는 묶여야 합니다');
});

test('② 제목이 다르거나 보낸이가 다르거나 제목이 비면 묶지 않는다', () => {
  const { api } = makeEnv();
  const many = 12;   /* 최소 줄 수보다 넉넉히 */
  const diffSubject = [];
  for (let i = 0; i < many; i++) diffSubject.push(row(BASE + i * MIN, { subject: '제목 ' + i }));
  assert.equal(api.sentFold(desc(diffSubject)).filter((i) => i.fold).length, 0, '제목이 다른 것을 묶었습니다');
  const diffBy = [];
  for (let i = 0; i < many; i++) diffBy.push(row(BASE + i * MIN, { by: 'u' + i + '@example.invalid' }));
  assert.equal(api.sentFold(desc(diffBy)).filter((i) => i.fold).length, 0, '보낸이가 다른 것을 묶었습니다');
  const noSubject = [];
  for (let i = 0; i < many; i++) noSubject.push(row(BASE + i * MIN, { subject: '   ' }));
  assert.equal(api.sentFold(desc(noSubject)).filter((i) => i.fold).length, 0, '제목이 빈 것을 묶었습니다');
});

test('같은 제목이라도 간격이 벌어지면 «다른 발송»이다 — 경계', () => {
  const { api } = makeEnv();
  const a = bulk(api.MIN + 2, BASE);
  const lastOfA = Math.max.apply(null, a.map((r) => r.at));
  /* 간격 한도 «바로 안» — 같은 발송 */
  const near = bulk(api.MIN + 2, lastOfA + api.GAP - 1000);
  assert.equal(api.sentFold(desc(a.concat(near))).filter((i) => i.fold).length, 1, '간격 안인데 갈라졌습니다');
  /* 한도 «바로 밖» — 다른 발송 두 건 */
  const far = bulk(api.MIN + 2, lastOfA + api.GAP + 1000);
  const two = api.sentFold(desc(a.concat(far))).filter((i) => i.fold);
  assert.equal(two.length, 2, '간격이 벌어졌는데 한 묶음으로 뭉쳤습니다');
});

test('묶음은 가장 최근 줄 자리에 한 번만 선다 — 사이에 낀 다른 메일 순서가 안 흐트러진다', () => {
  const { api } = makeEnv();
  const newer = row(BASE + 1000 * MIN, { subject: '맨 위 메일' });
  const older = row(BASE - 1000 * MIN, { subject: '맨 아래 메일' });
  const rows = desc([newer, older].concat(bulk(40, BASE)));
  const items = api.sentFold(rows);
  assert.equal(items.length, 3);
  assert.equal(items[0].row.id, newer.id);
  assert.equal(items[1].fold, true);
  assert.equal(items[2].row.id, older.id);
});

/* ── 화면 ── */
function box(rows, stateInit) {
  const { api, ctx } = makeEnv(Object.assign({ sentBox: keyed(rows) }, stateInit || {}));
  return { api, ctx, html: api.sentBoxHtml() };
}
const count = (s, re) => (s.match(re) || []).length;

test('④ 기본은 묶어 보기 — 175곳이 한 줄, 받는 곳 이름은 안 나온다', () => {
  const rows = bulk(175, BASE);
  const { html } = box(rows);
  assert.equal(count(html, /<tr class="sfold/g), 1);
  assert.equal(count(html, /<tr>\s*<td class="numonly">/g), 0, '낱줄이 남아 있습니다');
  assert.ok(!html.includes('받는곳3<'), '펼치기 전에 받는 곳이 나옵니다');
  assert.match(html, /175곳/);
  assert.match(html, /175통/, '머리줄 통수가 실제 기록 수를 말해야 합니다');
});

test('④ 펼치면 받은 곳이 모두 안쪽 줄로 나온다 — 번호는 맨 왼쪽 번호 칸 그대로', () => {
  const rows = bulk(30, BASE);
  const key = desc(rows)[0].id;   /* 묶음 열쇠 = 가장 최근 줄 */
  const { html } = box(rows, { sentOpen: { [key]: true } });
  assert.equal(count(html, /<tr class="sfsub/g), 30, '펼쳤는데 받는 곳 수가 다릅니다');
  assert.equal(count(html, /class="numonly">1<\/td>/g) >= 1, true, '묶음 줄 번호가 없습니다');
});

test('④ 「낱낱이 보기」는 예전처럼 줄마다 한 줄', () => {
  const rows = bulk(30, BASE);
  const { html } = box(rows, { sentFlat: true });
  assert.equal(count(html, /<tr class="sfold/g), 0);
  assert.equal(count(html, /<tr>\s*<td class="numonly">/g), 30);
  assert.match(html, /묶어 보기/, '되돌아갈 단추가 없습니다');
  /* 낱줄마다 받는 곳 이름·주소와 「다시 쓰기」가 그대로 있다 — 묶기 때문에 낱줄의 쓸모가 줄지 않는다 */
  rows.forEach((r) => {
    assert.ok(html.includes(r.toName) && html.includes(r.to), '낱줄에 받는 곳이 안 나옵니다: ' + r.toName);
    assert.ok(html.includes("resendFrom('" + r.id + "')"), '낱줄에 「다시 쓰기」가 없습니다: ' + r.toName);
  });
});

test('묶을 것이 없으면 「낱낱이 보기」 단추도 없다 — 쓸데없는 단추를 안 둔다', () => {
  const { html } = box([row(BASE), row(BASE + MIN, { subject: '다른 제목' })]);
  assert.ok(!/낱낱이 보기/.test(html));
  assert.equal(count(html, /<tr class="sfold/g), 0);
});

test('⑤ 찾기로 한 곳만 남기면 묶이지 않고 그 줄이 나온다', () => {
  const rows = bulk(40, BASE);
  const target = rows[7];
  const { html } = box(rows, { sentQ: target.toName });
  assert.equal(count(html, /<tr class="sfold/g), 0, '한 곳만 남았는데 묶음으로 보입니다');
  assert.ok(html.includes(target.toName), '찾은 사람이 안 나옵니다');
});

test('⑤ 「내가 보낸 것」도 묶은 뒤가 아니라 «거른 뒤»에 묶는다', () => {
  const mine = bulk(10, BASE, { by: 'me@example.invalid' });
  const others = bulk(10, BASE, { by: 'p@example.invalid' });
  const { html } = box(mine.concat(others), { sentMine: true });
  assert.equal(count(html, /<tr class="sfold/g), 1);
  assert.match(html, /10곳/);
});

test('묶음 줄을 누르면 펴고 접는다 — 같은 줄을 다시 누르면 닫힌다', () => {
  const { api, ctx } = makeEnv();
  api.sentFoldToggle('abc');
  assert.equal(ctx.state.sentOpen.abc, true);
  api.sentFoldToggle('abc');
  assert.equal(ctx.state.sentOpen.abc, false);
  assert.equal(ctx.redraws, 2, '누르면 다시 그려야 합니다');
  api.sentFlatToggle();
  assert.equal(ctx.state.sentFlat, true);
});

/* ── 소스 지킴 ── */
test('⑥ 기록은 지우지 않는다 — 묶는 함수는 읽기만 한다', () => {
  ['function sentFold(rows)', 'function sentFoldHtml(g, i, isOpen)', 'function sentFoldToggle(key)', 'function sentTdsHtml(v, sub)']
    .forEach((h) => {
      const body = sliceFn(cards, h).replace(/\/\*[\s\S]*?\*\//g, '');
      /* 자료 쓰기 길(firebase 손잡이·remove·set·update·transaction)이 없어야 한다 — 배열에 줄을 모으는 push 는 자료가 아니다 */
      assert.ok(!/firebase|\.ref\(|\.remove\(|\.set\(|\.update\(|\.transaction\(/.test(body),
        h + ' 이 자료를 건드립니다 — 화면에서만 묶어야 합니다');
    });
});

test('⑥ 번호만 있는 칸(☐ 없음)과 목록 한 벌(sentVisibleRows)은 그대로다', () => {
  const body = sliceFn(cards, 'function sentBoxHtml()');
  assert.match(body, /class="numonly">\$\{i\+1\}/, '낱줄 번호가 없습니다');
  assert.match(body, /sentVisibleRows\(\)/, '고르기·그리기가 같은 목록을 안 봅니다');
  assert.match(body, /sentFold\(/, '묶는 길이 화면에 안 걸려 있습니다');
  assert.doesNotMatch(body, /pickHit\('sent'|pickBar\('sent'|pickHeadBox\('sent'/, '보낸 메일에 ☐ 가 생겼습니다');
  assert.match(cards, /table\.sbox tr\.sfold td\{[^}]*background/, '묶음 줄이 낱줄과 한눈에 안 갈립니다');
  assert.match(cards, /table\.sbox tr\.sfold\{[^}]*cursor:pointer/, '눌러서 여는 줄인데 누르는 손 모양이 아닙니다');
  assert.match(cards, /table\.sbox tr\.sfsub td/, '펼친 안쪽 줄 모양이 없습니다');
});
