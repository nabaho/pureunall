'use strict';
/* 급여데이터함 — 확실한 메일 자료는 확인 없이 바로 서랍에 (대표 결정 2026-10-03 「ㄴ」)
   실행: node --test tests/paydata-autofile.test.js

   ⚠ 왜 이 검사가 생겼나: 메일은 15분마다 담당자 「확인 대기」까지는 저절로 갔다.
     그런데 거기서 사람이 한 장씩 넣어야 도착이 찍혔고, 넣은 것이 0장이었다 —
     456건이 쌓이고 사업장 113곳이 전부 「미도착」. 그래서 다섯 잣대를 모두 통과한
     것만 서버가 바로 서랍에 넣는다.
     이 검사가 지키는 것은 «잘못 넣지 않는다»이다 — 잘못 넣으면 틀린 서랍에 들어가고
     아무도 모르지만, 안 넣으면 확인 대기에 보인다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const MR = require(path.join(R, 'functions', 'mail-receive.js'));
const html = fs.readFileSync(path.join(R, 'pu-paydata.html'), 'utf8');
const storeSrc = fs.readFileSync(path.join(R, 'js', 'pu-paydata-store.js'), 'utf8');
const FN = fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8');

/* 주석은 걷고 본다 — 잘 쓴 주석이 글자 검사를 통과시키면 안 된다 */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

function cutHtml(name) {
  const m = html.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}
function cutFn(src, name) {
  const m = src.match(new RegExp('(?:async )?function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다');
  return m[0];
}

function loadStore(uid) {
  const sb = { window: {}, console };
  sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(storeSrc, { filename: 'pu-paydata-store.js' }).runInContext(sb);
  const S = sb.window.PuPaydataStore;
  S.init({ uid: uid || 'U1' });
  return { S, sb };
}

/* 화면 guessTag 를 그대로 꺼내 돌린다 — 서버와 같은 답을 내는지 견주려고 */
function loadGuess() {
  const { sb } = loadStore();
  new vm.Script('const S = window.PuPaydataStore;\n' + cutHtml('guessTag')
    + '\nwindow.guessTag = guessTag;', { filename: 'guess.js' }).runInContext(sb);
  return sb.window.guessTag;
}

/* 2026-10-03 10:00 한국 시각 */
const AT = Date.UTC(2026, 9, 3, 1, 0, 0);

/* ══════ ① 이름 읽기 — 실제 쌓인 꼴 ══════ */

test('★ 「26.08 일용직」처럼 「월」 없는 두 자리 해도 달로 읽는다', () => {
  assert.equal(MR.tagFor({ filename: '26.08 법인일용직(가나점).xlsx' }, null).month, '2026-08');
});

test('「월」 없는 두 자리 해 뒤에 날이 붙으면(날짜) 그 꼴로는 안 읽는다', () => {
  /* 26.08.15 는 날짜다 — 앞 두 마디만 떼어 읽으면 맞을 때도 있지만, 이 꼴은 묶지 않는다 */
  assert.equal(MR.tagFor({ filename: '정산_26.08.15.xlsx' }, null).month, '');
});

test('★ 해 없는 「9월 근태」는 받은 날로 해를 정한다', () => {
  assert.equal(MR.tagFor({ filename: '9월 근태(홍길동).xlsx', at: AT }, null).month, '2026-09');
});

test('★ 1월에 받은 「12월」은 지난해 12월이다', () => {
  const jan = Date.UTC(2027, 0, 5, 1, 0, 0);
  assert.equal(MR.tagFor({ filename: '12월 근태.xlsx', at: jan }, null).month, '2026-12');
});

test('★ 받은 시각이 없으면 해를 지어내지 않는다', () => {
  assert.equal(MR.tagFor({ filename: '9월 근태.xlsx' }, null).month, '');
});

test('★ 한국 시각으로 센다 — 새해 첫날 새벽(한국)에 받은 「1월」 은 새해 1월', () => {
  /* UTC 로는 아직 지난해 12/31 이다. 해를 UTC 로 정하면 「1월 근태」가 «지난해» 1월
     서랍으로 들어간다 — 열두 달 어긋난다. (다른 달은 우연히 같은 답이 나와 못 가른다) */
  const kstJan1 = Date.UTC(2026, 11, 31, 16, 30, 0);   // 한국 2027-01-01 01:30
  assert.equal(MR.tagFor({ filename: '1월 근태.xlsx', at: kstJan1 }, null).month, '2027-01');
  /* 귀속월 거리도 한국 시각으로 — 같은 순간 「2027-01」은 0달 차이다 */
  assert.equal(MR.monthGap('2027-01', kstJan1), 0);
});

test('「1.5월분」의 5 는 달이 아니다 — 받은 시각이 있어도', () => {
  assert.equal(MR.tagFor({ filename: '제1.5월분 자료.xlsx', at: AT }, null).month, '');
});

test('★ 「급여」 + 자료 말이면 급여대장이다 (급여확정·급여예정·급여 기초자료)', () => {
  ['26.07월 가나공장_급여확정.xlsx', '26.09월 가나공장_급여예정.xlsx', '9월 급여 기초자료.xlsx']
    .forEach(n => assert.equal(MR.tagFor({ filename: n, at: AT }, null).kind, 'ledger', n));
});

test('먼저 잡히는 종류는 그대로다 — 급여명세서는 산출물, 급여 근태는 근태', () => {
  assert.equal(MR.tagFor({ filename: '9월 급여명세서.pdf' }, null).kind, 'output');
  assert.equal(MR.tagFor({ filename: '급여 근태표.xlsx' }, null).kind, 'attend');
});

/* ══════ ② 서버와 화면이 같은 답을 낸다 ══════
   다르면 같은 파일이 서버에서는 9월 서랍, 화면 짐작에서는 다른 달로 잡힌다. */
test('★ 서버 tagFor 와 화면 guessTag 가 달·종류에서 같은 답을 낸다', () => {
  const guess = loadGuess();
  const names = [
    '26.08 법인일용직(가나점).xlsx', '9월 근태(홍길동).xlsx', '12월 근태.xlsx',
    '26.07월 가나공장_급여확정.xlsx', '9월 급여 기초자료.xlsx', '8월급여수정 요청.hwp',
    '2026년 8월 급여대장.xlsx', '25년 07월 노임.xlsx', '근로계약서_홍길동.pdf',
    '9월 급여명세서.pdf', '제1.5월분 자료.xlsx', 'IMG_3070.jpeg', '정산_26.08.15.xlsx',
    '05월 수정신고.pdf', '9월.zip', '급여 문의.pdf', '9월 급여자료 수정 요청.xlsx',
    '1월 근태.xlsx'
  ];
  [AT, Date.UTC(2027, 0, 5, 1, 0, 0), Date.UTC(2026, 11, 31, 16, 30, 0), 0].forEach(at => {
    names.forEach(n => {
      const s = MR.tagFor({ filename: n, subject: '', at: at || undefined }, null);
      const c = guess({ filename: n, note: '', at: at || undefined }, []);
      assert.equal(c.month, s.month, '달이 다릅니다: ' + n + ' (' + at + ')');
      assert.equal(c.kind === 'etc' ? '' : c.kind, s.kind, '종류가 다릅니다: ' + n);
    });
  });
});

/* ══════ ③ 다섯 잣대 ══════ */

const ROUTE_OK = { seat: 'U1', how: 'addr', tag: { companyId: 'co_1', companyName: '가나상사', kind: 'ledger', month: '2026-09' } };
const route = patch => Object.assign({}, ROUTE_OK, patch, { tag: Object.assign({}, ROUTE_OK.tag, (patch || {}).tag) });

test('★ 다섯 잣대를 모두 통과하면 바로 넣는다', () => {
  assert.equal(MR.sureFor({ filename: '9월 급여대장.xlsx', at: AT }, ROUTE_OK).ok, true);
});

test('★ 하나라도 걸리면 안 넣는다 — 까닭을 말한다', () => {
  const cases = [
    [{ filename: '메일.txt', at: AT, body: true }, ROUTE_OK, '본문'],
    [{ filename: 'a.xlsx', at: AT }, route({ seat: '' }), '자리'],
    [{ filename: 'a.xlsx', at: AT }, route({ tag: { companyId: '' } }), '사업장'],
    [{ filename: 'a.xlsx', at: AT }, route({ how: 'text' }), '제목'],
    [{ filename: 'a.xlsx', at: AT }, route({ tag: { kind: '' } }), '종류'],
    [{ filename: 'a.xlsx', at: AT }, route({ tag: { kind: 'etc' } }), '종류'],
    [{ filename: '일용노무비대장 양식.xlsx', at: AT }, ROUTE_OK, '양식'],
    [{ filename: 'a.xlsx', at: AT }, route({ tag: { month: '' } }), '귀속월'],
    [{ filename: 'a.xlsx', at: AT }, route({ tag: { month: '2024-01' } }), '멂'],
    [{ filename: 'a.xlsx', at: AT }, route({ tag: { month: '2027-03' } }), '멂']
  ];
  cases.forEach(([o, r, word]) => {
    const v = MR.sureFor(o, r);
    assert.equal(v.ok, false, '★ 넣으면 안 되는데 넣습니다: ' + word);
    assert.ok(v.why.indexOf(word) >= 0, '까닭에 「' + word + '」가 없습니다: ' + v.why);
  });
});

test('주소가 여러 곳에 걸려도 제목으로 좁혔으면(addr+text) 믿는다', () => {
  assert.equal(MR.sureFor({ filename: 'a.xlsx', at: AT }, route({ how: 'addr+text' })).ok, true);
});

test('근로계약서는 달과 무관하다 — 달이 없어도 넣는다', () => {
  assert.equal(MR.sureFor({ filename: '근로계약서.pdf', at: AT },
    route({ tag: { kind: 'contract', month: '' } })).ok, true);
});

/* ══════ ④ 서랍 묶음 — 화면이 쓰는 모양 그대로 ══════ */

test('★ 서랍 줄·도착 표시를 한 묶음으로 쓴다 — 화면 drawerUpdate 와 같은 자리', () => {
  const { S } = loadStore('U1');
  const tag = { companyId: 'co_1', companyName: '가나상사', kind: 'ledger', month: '2026-09' };
  const w = MR.drawerWriteFor('paydata', 'U1', 'm1',
    { filename: 'a.xlsx', file: 'f', mime: 'x', bytes: 3, at: AT, tag: tag });
  const human = S.drawerUpdate('m1', { filename: 'a.xlsx', file: 'f' },
    { companyId: 'co_1', kind: 'ledger', month: '2026-09', at: AT });
  const want = Object.keys(human).filter(k => !/\/pending\//.test(k)).sort();
  assert.deepEqual(Object.keys(w.up).sort(), want, '★ 사람이 넣을 때와 다른 자리에 씁니다');
  assert.equal(w.slot, S.slotOf('ledger', '2026-09'));
});

test('★ 기계가 넣은 줄에는 표(auto)가 달린다 — 서랍에서 🤖 로 보이고 되돌릴 수 있게', () => {
  const w = MR.drawerWriteFor('paydata', 'U1', 'm1', { filename: 'a.xlsx', at: AT,
    tag: { companyId: 'co_1', kind: 'attend', month: '2026-09' } });
  const rec = w.up['paydata/u/U1/items/202609/m1'];
  assert.equal(rec.auto, true);
  assert.equal(rec.month, '202609', '서랍 줄의 달은 칸 열쇠 꼴이어야 합니다');
  assert.equal(rec.filedBy, '', '사람이 넣은 것처럼 적으면 안 됩니다');
});

test('★ 도착 칸에는 시각 숫자만 — 전 직원이 읽는 칸이다(파일 이름에 성명이 있다)', () => {
  const w = MR.drawerWriteFor('paydata', 'U1', 'm1', { filename: '홍길동 근태.xlsx', at: AT,
    tag: { companyId: 'co_1', kind: 'attend', month: '2026-09' } });
  Object.keys(w.up).filter(k => /\/arrivals\//.test(k)).forEach(k => {
    assert.equal(typeof w.up[k], 'number', '★ 도착 칸에 숫자 말고 다른 것이 들어갑니다: ' + k);
  });
});

test('근로계약서는 keep 칸이다 — 화면 slotOf 와 같다', () => {
  const { S } = loadStore();
  assert.equal(MR.drawerSlotOf('contract', ''), S.slotOf('contract', ''));
  assert.equal(MR.drawerSlotOf('attend', '2026-9'), S.slotOf('attend', '2026-9'));
});

/* ══════ ⑤ 쌓인 것 정리 — 계획만 만든다 ══════ */

const CO = { id: 'co_1', name: '가나상사', managerMain: 'p-001', email: 'hr@gana.example' };
const OWN = { U1: { name: '김대표', email: 'p001@pureun.kr', lastAt: 1 } };
const IDX = MR.buildCompanyIndex([CO]);
const fileRec = o => Object.assign({ filename: '9월 급여대장.xlsx', file: 'f', mime: 'application/vnd.ms-excel',
  bytes: 100, at: AT, mailFrom: 'hr@gana.example', mailSubject: '9월 자료' }, o);

test('★ 확실한 것은 서랍으로, 원래 칸에서는 뺀다', () => {
  const p = MR.settlePlan('paydata', {}, { U1: { a: fileRec() } }, IDX, OWN, [CO], AT);
  assert.equal(p.counts.filed, 1);
  assert.ok(p.up['paydata/u/U1/items/202609/a'], '서랍에 안 들어갔습니다');
  assert.equal(p.up['paydata/u/U1/pending/a'], null, '★ 확인 대기에도 남으면 두 번 보입니다');
  assert.equal(typeof p.up['paydata/arrivals/co_1/202609/ledger/a'], 'number');
});

test('★ 메일 본문은 손대지 않는다 — 읽을 글이다', () => {
  const body = fileRec({ filename: '9월 급여대장 보냅니다.txt', mime: 'text/plain' });
  const p = MR.settlePlan('paydata', {}, { U1: { b: body } }, IDX, OWN, [CO], AT);
  assert.equal(Object.keys(p.up).length, 0);
  assert.equal(p.counts.body, 1);
});

test('★ 이미 사람 자리에 있는 것은 그 자리에 둔다 — 손으로 넘긴 것일 수 있다', () => {
  /* 지금 규칙으로는 U1 이 주담당이지만, 이 줄은 U2 자리에 있다 */
  const own = Object.assign({}, OWN, { U2: { name: '박노무', email: 'p002@pureun.kr', lastAt: 1 } });
  const p = MR.settlePlan('paydata', {}, { U2: { a: fileRec() } }, IDX, own, [CO], AT);
  assert.ok(p.up['paydata/u/U2/items/202609/a'], '★ 그 사람 서랍이 아니라 딴 데로 갔습니다');
  assert.equal(Object.keys(p.up).some(k => k.indexOf('/u/U1/') >= 0), false);
});

test('★ 공용 칸 것은 자리를 찾으면 그 사람에게 — 확실하지 않으면 그 사람 확인 대기로', () => {
  const unsure = fileRec({ filename: 'IMG_3070.jpeg', mailSubject: '사진' });
  const p = MR.settlePlan('paydata', { s1: unsure }, {}, IDX, OWN, [CO], AT);
  assert.ok(p.up['paydata/u/U1/pending/s1'], '자리를 찾았는데 안 내려갔습니다');
  assert.equal(p.up['paydata/pending_shared/s1'], null);
  assert.equal(p.counts.toSeat, 1);
  assert.equal(Object.keys(p.up).some(k => /\/items\//.test(k)), false, '★ 확실하지 않은데 서랍에 넣었습니다');
});

test('★ 같은 파일은 한 장만 넣는다 — 「RE:」 메일에 같은 첨부가 다시 온다', () => {
  const p = MR.settlePlan('paydata', {}, { U1: { a: fileRec(), b: fileRec({ at: AT + 1000 }) } }, IDX, OWN, [CO], AT);
  assert.equal(p.counts.filed, 1);
  assert.equal(p.counts.dup, 1);
  const arrived = Object.keys(p.up).filter(k => /\/arrivals\/co_1\/202609\/ledger\//.test(k));
  assert.equal(arrived.length, 1, '★ 같은 파일이 「2장 도착」으로 셉니다');
});

test('도착 칸의 last 는 가장 늦은 것이다', () => {
  const p = MR.settlePlan('paydata', {}, { U1: {
    a: fileRec({ filename: '9월 급여대장.xlsx', at: AT }),
    b: fileRec({ filename: '9월 근태.xlsx', at: AT + 5000 }) } }, IDX, OWN, [CO], AT);
  assert.equal(p.up['paydata/arrivals/co_1/202609/last'], AT + 5000);
});

test('★ 계획을 만드는 것만으로는 받은 자료를 바꾸지 않는다 — 미리 보기가 미리 보기다', () => {
  const box = { U1: { a: fileRec() } };
  const before = JSON.stringify(box);
  MR.settlePlan('paydata', {}, box, IDX, OWN, [CO], AT);
  assert.equal(JSON.stringify(box), before);
});

test('★ 조각을 나눠도 자료 한 건의 자리들은 같은 조각에 있다', () => {
  const box = {};
  for (let i = 0; i < 7; i++) box['m' + i] = fileRec({ filename: i + '_9월 급여대장.xlsx' });
  const p = MR.settlePlan('paydata', {}, { U1: box }, IDX, OWN, [CO], AT);
  const chunks = MR.settleChunks(p.up, 3);
  assert.ok(chunks.length >= 3);
  Object.keys(box).forEach(id => {
    const holders = chunks.filter(c => Object.keys(c).some(k => k.endsWith('/' + id)));
    assert.equal(holders.length, 1, '★ ' + id + ' 의 자리가 여러 조각에 흩어졌습니다');
  });
  const all = Object.assign.apply(null, [{}].concat(chunks));
  assert.deepEqual(Object.keys(all).sort(), Object.keys(p.up).sort(), '빠진 자리가 있습니다');
});

/* ══════ ⑥ 아직 안 들어온 주담당의 자리 ══════ */

test('★ 아직 자리가 없는 주담당만 찾는다 — 사번이 아닌 값은 건너뛴다', () => {
  const cos = [CO, { id: 'c2', managerMain: 'a-003' }, { id: 'c3', managerMain: '김보람(박은비)' },
    { id: 'c4', managerMain: 'A-003' }];
  assert.deepEqual(JSON.parse(JSON.stringify(MR.missingSeatSids(cos, OWN))), ['a-003']);
});

test('★ 서버가 적은 owners 줄은 「들어온 사람」이 아니다 — 자리는 알되 연한 이름', () => {
  const { S } = loadStore();
  const owners = { U9: { email: 'a003@pureun.kr', name: '홍길동', addedBy: 'server' } };
  const r = S.managerRoster([{ id: 'c2', name: '가', managerMain: 'a-003' }], [], owners);
  const p = r.people[0];
  assert.equal(p.uid, 'U9', '★ 자리를 모르면 관리자가 그 서랍을 못 엽니다');
  assert.equal(p.away, true, '★ 안 들어온 사람을 들어온 것처럼 보입니다');
  assert.equal(S.isHere(owners.U9), false);
  assert.equal(S.isHere({ lastAt: 5 }), true);
});

/* ══════ ⑦ 되돌리기 — 「틀림 — 확인 대기로」 ══════ */

const AUTO = { filename: '9월 급여대장.xlsx', file: 'f', companyId: 'co_1', companyName: '가나상사',
  kind: 'ledger', month: '202609', auto: true, filedAt: AT, filedBy: '', _by: 'U1', _id: 'a', id: 'a' };

test('★ 되돌리면 서랍에서 빠지고 도착도 내려가고 확인 대기로 간다 — 한 묶음', () => {
  const { S } = loadStore('U1');
  const up = S.undoAutoUpdate('a', AUTO);
  assert.equal(up['paydata/u/U1/items/202609/a'], null);
  assert.equal(up['paydata/arrivals/co_1/202609/ledger/a'], null, '★ 도착이 그대로면 거짓말을 합니다');
  const back = up['paydata/u/U1/pending/a'];
  assert.ok(back, '확인 대기로 안 갔습니다');
  assert.equal(back.file, 'f', '파일 자리가 바뀌면 안 됩니다');
  assert.equal(back.month, '2026-09', '확인 대기는 「2026-09」 꼴로 적습니다');
  assert.equal(back.auto, undefined, '되돌린 것을 다시 기계가 넣은 것으로 보면 안 됩니다');
  assert.equal(back._by, undefined, '화면이 붙인 표가 저장됩니다');
  assert.equal(back.undoneBy, 'U1', '누가 되돌렸는지 안 남습니다');
});

test('★ 사람이 넣은 것은 이 길로 못 되돌린다', () => {
  const { S } = loadStore('U1');
  assert.throws(() => S.undoAutoUpdate('a', Object.assign({}, AUTO, { auto: false })), /기계가 넣은/);
});

test('근로계약서(keep)를 되돌리면 달이 빈 채로 간다', () => {
  const { S } = loadStore('U1');
  const up = S.undoAutoUpdate('k', Object.assign({}, AUTO, { kind: 'contract', month: 'keep' }));
  assert.equal(up['paydata/u/U1/items/keep/k'], null);
  assert.equal(up['paydata/u/U1/pending/k'].month, '');
});

/* ══════ ⑧ 서버 배선 ══════ */

test('★ 첨부는 확실하면 서랍으로, 아니면 지금처럼 확인 대기·공용 칸으로', () => {
  const body = strip(cutFn(FN, 'payMailStoreOne'));
  assert.match(body, /MR\.sureFor\(/, '잣대를 안 봅니다');
  assert.match(body, /MR\.drawerWriteFor\(/, '서랍에 넣는 길이 없습니다');
  assert.match(body, /sure\.ok \?/, '확실할 때만 넣어야 합니다');
  assert.match(body, /pendingRecordFor\(/, '확실하지 않을 때의 길이 사라졌습니다');
});

test('★ 메일 본문은 늘 확인 대기다 — 서랍에 안 넣는다', () => {
  const body = strip(cutFn(FN, 'payMailStoreBody'));
  assert.equal(/sureFor|drawerWriteFor/.test(body), false, '★ 본문을 서랍에 넣으려 합니다');
});

test('★ 정리는 apply 가 true 일 때만 쓴다 — 미리 보기는 아무것도 안 쓴다', () => {
  const body = strip(cutFn(FN, 'paydataSettle'));
  const writeAt = body.indexOf('.update(');
  const gate = body.indexOf('body.apply === true');
  assert.ok(gate > 0, '쓰기 전 확인이 없습니다');
  assert.ok(writeAt > gate, '★ 확인보다 먼저 씁니다');
  assert.equal((body.match(/\.update\(/g) || []).length, 1, '쓰는 곳이 하나여야 합니다');
  assert.equal(/\.set\(|\.remove\(/.test(body), false);
});

test('★ 정리는 「다시 갈라 보내기」 문으로만 들어온다 — 총괄관리자만', () => {
  const i = FN.indexOf('exports.regroupPaydataShared');
  const head = strip(FN.slice(i, i + 2000));
  assert.match(head, /isAdmin !== true/);
  const a = head.indexOf('isAdmin !== true'), b = head.indexOf('paydataSettle(');
  assert.ok(b > a, '★ 관리자 확인보다 먼저 정리에 들어갑니다');
});

test('★ 손으로 넘길 때는 «정말 들어온» 사람에게만 — 서버가 적은 줄은 안 된다', () => {
  const i = FN.indexOf('exports.handPaydataItem');
  const body = strip(FN.slice(i, i + 5000));
  assert.match(body, /lastAt/, '★ 아무도 안 여는 자리로 넘어갑니다');
});

test('★ 서버가 적는 owners 줄에는 lastAt 이 없다 — 그것이 「아직 안 들어옴」의 표다', () => {
  const body = strip(cutFn(FN, 'payMailAddMissingSeats'));
  assert.match(body, /addedBy: "server"/);
  assert.equal(/lastAt/.test(body), false, '★ 서버가 lastAt 을 적으면 들어온 사람으로 보입니다');
  assert.match(body, /owners\[user\.uid\]\) continue/, '★ 이미 있는 줄(사람이 적은 것)을 덮습니다');
});

/* ══════ ⑨ 화면 ══════ */

test('★ 서랍 줄 — 기계가 넣은 것에만 🤖 와 「틀림 — 확인 대기로」', () => {
  const d = strip(cutHtml('screenDrawer'));
  assert.match(d, /r\.auto \?[^:]*🤖/, '🤖 표가 없습니다');
  assert.match(d, /r\.auto \?[^:]*undoAutoRow/, '되돌리는 단추가 없습니다');
});

test('★ 되돌리기는 묻고 나서 한다 · 묶음은 저장층 한 곳', () => {
  const f = strip(cutHtml('undoAutoRow'));
  assert.match(f, /confirm\(/);
  assert.ok(f.indexOf('confirm(') < f.indexOf('S.undoAutoUpdate('), '★ 묻기 전에 씁니다');
  assert.match(f, /canEditRow\(/, '남의 자리 자료를 되돌리려 합니다');
});

test('★ 쌓인 것 정리 — 먼저 미리 보기, 넣기는 한 번 더 묻고', () => {
  const pre = strip(cutHtml('sweepPreview'));
  assert.match(pre, /S\.settleQueued\(false\)/, '★ 미리 보기가 실제로 넣습니다');
  assert.match(pre, /S\.amAdmin\(\)/);
  const app = strip(cutHtml('sweepApply'));
  assert.ok(app.indexOf('confirm(') >= 0 && app.indexOf('confirm(') < app.indexOf('S.settleQueued(true)'),
    '★ 묻지 않고 넣습니다');
});

test('넘기기·공유 받을 사람에 «아직 안 들어온» 사람이 안 나온다', () => {
  assert.match(strip(cutHtml('handHtml')), /S\.isHere\(/);
  assert.match(strip(cutHtml('shareModalHtml')), /S\.isHere\(/);
});

test('사업장 줄의 「대기」는 서버가 적은 사업장을 먼저 본다 — 파일 이름만 짐작하지 않는다', () => {
  const f = strip(cutHtml('sideListModel'));
  const at = f.indexOf('pendBy[');
  const near = f.slice(Math.max(0, at - 900), at);
  assert.match(near, /said/, '★ 서버가 주소로 알아낸 사업장을 버립니다');
});
