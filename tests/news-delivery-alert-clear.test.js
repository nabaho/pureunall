'use strict';
/* 뉴스레터 타일 빨간 «⚠ 1» — 못 간 통을 서버가 이미 처리했으면 경고가 «스스로 꺼진다» (대표 지시 2026-10-17)
   ═══════════════════════════════════════════════════════════════════════════
   「빨간색숫자 왜 나오는지 정확이확인하고 자동으로 수정 고치는 기능 만들어서 정리해달라」

   ★ 실제로 있었던 일(살아 있는 자료로 확인): 월요일(10/12) 보낸 179통 중 2통이 «그런 사용자 없음» 으로 거절됐다.
     그 두 주소는 같은 날 09시 반송 자동 확인이 이미 «없는 주소» 로 명단에서 뺐다 — 사람이 할 일은 없었다.
     그런데 12시 점검은 «state==='failed' 는 전부 사람 몫» 으로 세어 경고를 걸었고(반송 쪽 잣대와 어긋남),
     그 경고는 «걸쇠» 라 새 회차 기록이 생길 때까지 엿새를 떠 있었다.
   ★ 이 검사가 지키는 «규칙» (값이 아니라)
     ① 못 간 통의 주소를 서버가 이미 처리했으면(명단에서 뺌 · 반송 기록이 사람 몫 아님) 사람 몫에서 뺀다 — 잣대는 반송 쪽 것 하나
     ② 확인필요(나갔을 수도 있음)·주소 모름·처리 흔적 없음은 «사람 몫» — 자동으로 정리하지 않는다
     ③ 걸려 있는 경보는 경고판을 새로 쓸 때마다 다시 세어, 사람 몫이 0이면 스스로 «정리됨» 이 된다(경고판·자동화 점검이 같이 꺼진다)
     ④ 다시 못 세면(읽기 탈) 경고는 그대로 남는다 — 사람이 볼 것을 숨기는 쪽으로는 틀리지 않는다
     ⑤ 이미 정리된 경보를 다시 세우지 않고, 같은 일을 두 번 쓰지 않는다
     ⑥ 월요일 12시 점검도 같은 잣대로 세어, 처음부터 처리된 것은 경고를 안 건다
     ⑦ 감시 기록에 주소를 남기지 않는다(수만) — 예시는 가짜 주소만 쓴다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const W = require('../functions/news-watch.js');
const C = require('../js/pu-news-core.js');
const FakeDB = require('./helpers/fake-rtdb.js');
const { stripJs, stripComments } = require('./strip-comments.js');

const 서버 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'index.js'), 'utf8')).replace(/\r\n/g, '\n');
const 화면 = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-news.html'), 'utf8')).replace(/\r\n/g, '\n');
const 시계 = (이름) => { const i = 서버.indexOf('exports.' + 이름 + ' '); return 서버.slice(i, 서버.indexOf('\nexports.', i + 10)); };
const 함수 = (src, 머리) => { const i = src.indexOf(머리); assert.ok(i >= 0, 머리 + ' 를 못 찾았다'); return src.slice(i, src.indexOf('\n}\n', i) + 2); };

const 열 = (주소) => C.주소열쇠(주소);
const 줄 = (자리, 덧) => Object.assign({ bulk: 'bA', state: 'failed', payload: { to: 자리 } }, 덧 || {});

/* ── ① ② 사람 몫을 가르는 잣대 ── */
test('① ② 전달사람몫 — 이미 처리한 주소는 빼고, 확인필요·주소 모름·흔적 없음은 사람 몫', () => {
  const 줄들 = {
    r1: 줄('Gone@One.Example'),                                  /* 명단에서 뺀 주소(대소문자 달라도) */
    r2: 줄('gone@two.example'),                                  /* 반송 기록 «없는 주소·자동처리» */
    r3: 줄('slow@three.example'),                                /* 반송 기록 «일시·열림·1회» — 세 번 내리 실패해야 사람 몫 */
    r4: 줄('rude@four.example'),                                 /* 반송 기록 «서버거부·열림» — 사람 몫 */
    r5: 줄('new@five.example'),                                  /* 처리 흔적 없음 — 사람 몫 */
    r6: 줄('maybe@six.example', { state: 'uncertain' }),         /* 나갔을 수도 — 막은 주소여도 사람 몫 */
    r7: { bulk: 'bA', state: 'failed', payload: {} },            /* 주소를 모름 — 사람 몫 */
    r8: 줄('other@seven.example', { bulk: 'bZ' }),               /* 다른 회차 — 안 센다 */
    r9: 줄('wait@eight.example', { state: 'waiting' }),          /* 아직 대기 — 실패가 아니다 */
    r10: 줄('often@nine.example')                                /* 반송 기록 «일시·열림·3회» — 사람 몫 */
  };
  const 처리판 = {
    막힘: { [열('gone@one.example')]: { 자동: true, 까닭: '없는 주소' }, [열('maybe@six.example')]: { 자동: true } },
    반송들: {
      [열('gone@two.example')]: { 갈래: '없는주소', 상태: '자동처리' },
      [열('slow@three.example')]: { 갈래: '일시', 상태: '열림', 횟수: 1 },
      [열('rude@four.example')]: { 갈래: '서버거부', 상태: '열림', 횟수: 1 },
      [열('often@nine.example')]: { 갈래: '일시', 상태: '열림', 횟수: 3 }
    }
  };
  const 셈 = W.전달사람몫(줄들, 'bA', 처리판);
  assert.strictEqual(셈.실패, 7, '실패 줄: r1 r2 r3 r4 r5 r7 r10');
  assert.strictEqual(셈.처리됨, 3, '처리된 것: 명단에서 뺌(r1) · 없는 주소 자동처리(r2) · 일시 1회(r3)');
  assert.strictEqual(셈.확인필요, 1);
  assert.strictEqual(셈.사람몫, 셈.실패 - 셈.처리됨 + 셈.확인필요, '사람 몫 = 처리 안 된 실패 + 확인필요');
  assert.strictEqual(셈.사람몫, 5);
  /* 같은 판정이 반송 쪽 «사람 몫인가» 와 어긋나지 않는다 — 한 잣대 */
  [['없는주소', '자동처리'], ['일시', '열림', 1], ['일시', '열림', 3], ['서버거부', '열림', 1], ['모름', '열림', 1]].forEach(([갈래, 상태, 횟수]) => {
    const b = { 갈래, 상태, 횟수 };
    const 하나 = W.전달사람몫({ x: 줄('a@b.example') }, 'bA', { 막힘: {}, 반송들: { [열('a@b.example')]: b } });
    assert.strictEqual(하나.사람몫 === 1, C.반송사람몫인가(b), 갈래 + '/' + 상태 + ': 전달·반송이 사람 몫을 다르게 본다');
  });
});

test('② 처리판을 못 읽었으면(빈 판) 예전 그대로 — 실패·확인필요 전부가 사람 몫 (숨기는 쪽으로 틀리지 않는다)', () => {
  const 줄들 = { a: 줄('a@x.example'), b: 줄('b@x.example', { state: 'uncertain' }), c: 줄('c@x.example', { state: 'waiting' }) };
  [undefined, {}, { 막힘: {}, 반송들: {} }].forEach((판) => {
    const 셈 = W.전달사람몫(줄들, 'bA', 판);
    assert.strictEqual(셈.사람몫, 2);
    assert.strictEqual(셈.처리됨, 0);
  });
  const 옛 = W.전달셈(줄들, 'bA');
  assert.strictEqual(W.전달사람몫(줄들, 'bA').사람몫, 옛.실패 + 옛.확인필요, '전달셈(옛 셈)과 같은 수');
});

test('⑦ 돌려주는 값에 주소가 없다 — 감시 기록에 주소를 안 남긴다', () => {
  const 셈 = W.전달사람몫({ a: 줄('secret-person@gone.example') }, 'bA', { 막힘: { [열('secret-person@gone.example')]: {} }, 반송들: {} });
  assert.ok(!/@|gone\.example/.test(JSON.stringify(셈)), '셈에 주소가 담겼다');
});

/* ── ③ 걸려 있는 경보를 다시 본다 ── */
test('③ 전달경보다시보기 — 사람 몫 0이면 정리됨 · 줄었으면 말만 · 같으면 그대로 · 이미 정리됐으면 손 안 댐', () => {
  const 경보 = { 상태: 'block', 말: W.전달경보말(2), 때: 5 };
  const 정리 = W.전달경보다시보기(경보, { 실패: 2, 처리됨: 2, 확인필요: 0, 사람몫: 0 }, 1234);
  assert.strictEqual(정리.상태, '정리됨');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(정리.정리)), { 때: 1234, 처리됨: 2 });
  const 줄음 = W.전달경보다시보기(경보, { 실패: 2, 처리됨: 1, 확인필요: 0, 사람몫: 1 }, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(줄음)), { 말: W.전달경보말(1) });
  assert.match(줄음.말, /1통/);
  assert.strictEqual(W.전달경보다시보기(경보, { 실패: 2, 처리됨: 0, 확인필요: 0, 사람몫: 2 }, 1), null, '같으면 쓰지 않는다');
  assert.strictEqual(W.전달경보다시보기({ 상태: '정리됨' }, { 사람몫: 3 }, 1), null, '정리한 것을 다시 세우지 않는다');
  assert.strictEqual(W.전달경보다시보기(null, { 사람몫: 0 }, 1), null);
  assert.strictEqual(W.전달경보다시보기(경보, null, 1), null, '못 세었으면 건드리지 않는다');
});

/* ── ③ ④ ⑤ 서버 함수를 «실제 코드 그대로» 가짜 DB 위에서 돌린다 ── */
function 조회DB(씨, 탈) {
  const db = FakeDB.만들기(씨);
  const ref = db.ref;
  db.ref = (p) => {
    const 쪽 = String(p || '');
    if (탈 && 쪽 === 탈) return { once: async () => { throw new Error('읽기 탈 시험'); } };
    const r = ref(p);
    r.orderByChild = (칸) => ({ equalTo: (값) => ({ once: async () => {
      const v = db.읽기(쪽) || {};
      const o = {};
      Object.keys(v).forEach((k) => { if (v[k] && String(v[k][칸]) === String(값)) o[k] = v[k]; });
      return { val: () => (Object.keys(o).length ? o : null) };
    } }) });
    return r;
  };
  return db;
}
const 경고판돌리개 = (() => {
  const 원 = ['async function 전달처리판읽기', 'async function 뉴스레터전달경보다시보기', 'async function 뉴스레터경고판갱신'].map((머리) => 함수(서버, 머리)).join('\n');
  const 경고 = [];
  const 만듦 = new Function('NWatch', 'MD', 'console', 원 + '\nreturn 뉴스레터경고판갱신;');
  return { 경고, 판갱신: 만듦(W, { CARDS_ROOT: 'pucards' }, { warn: (...a) => 경고.push(a.join(' ')), log() {} }) };
})();

function 씨앗(덧) {
  const 가나 = 'ghost-a@gone.example', 다라 = 'ghost-b@gone.example';
  return Object.assign({
    newsletter: {
      watch: { '2026-10-w2': {
        발송: { batchId: 'bA', 받는수: 179, 상태: 'ok' },
        전달: { 남음: 0, 받는수: 179, 실패: 2, 확인필요: 0 },
        전달경보: { 상태: 'block', 말: W.전달경보말(2), 때: 1 } } },
      issues: { '2026-10-w2': { 보낸때: 2, 회차: { 이름: '2026년 10월 2주차' } } },
      blocked: {}, bounces: {}
    },
    pucards: { scheduled: {
      q1: { bulk: 'bA', state: 'failed', payload: { to: 가나 } },
      q2: { bulk: 'bA', state: 'failed', payload: { to: 다라 } },
      q3: { bulk: 'bOther', state: 'failed', payload: { to: 'someone@else.example' } } } }
  }, 덧 || {});
}
const 차단 = (주소) => ({ [열(주소)]: { 자동: true, 까닭: '없는 주소', by: '반송 자동' } });
const 전달경보 = (db) => db.읽기('newsletter/watch/2026-10-w2/전달경보');
const 판 = (db) => db.읽기('newsletter/watch/현재');

test('③ 실제 서버 코드 — 못 간 두 주소를 이미 명단에서 뺐으면 경고판이 0으로 꺼지고 전달경보는 «정리됨»', async () => {
  const 씨 = 씨앗();
  씨.newsletter.blocked = Object.assign({}, 차단('ghost-a@gone.example'), 차단('ghost-b@gone.example'));
  const db = 조회DB(씨);
  await 경고판돌리개.판갱신(db);
  assert.strictEqual(판(db).경고수, 0, '이미 처리된 실패인데 빨간 숫자가 남았다');
  assert.deepStrictEqual(판(db).줄들 || [], []);
  assert.strictEqual(전달경보(db).상태, '정리됨');
  assert.strictEqual(전달경보(db).정리.처리됨, 2);
  assert.ok(전달경보(db).말, '원래 말은 기록으로 남는다');
  assert.strictEqual(db.읽기('newsletter/watch/2026-10-w2/전달/처리됨'), 2, '자동화 점검 화면이 읽는 «전달» 칸에도 처리 수가 적힌다');
  assert.strictEqual(db.읽기('newsletter/watch/2026-10-w2/전달/실패'), 2, '실제로 2통이 안 간 사실은 지우지 않는다');
});

test('③ 반송 기록(없는 주소·자동처리)만 있어도 처리된 것으로 본다 — 명단에서 빼는 일과 기록이 따로 와도', async () => {
  const 씨 = 씨앗();
  씨.newsletter.bounces = { [열('ghost-a@gone.example')]: { 갈래: '없는주소', 상태: '자동처리' }, [열('ghost-b@gone.example')]: { 갈래: '없는주소', 상태: '자동처리' } };
  const db = 조회DB(씨);
  await 경고판돌리개.판갱신(db);
  assert.strictEqual(판(db).경고수, 0);
  assert.strictEqual(전달경보(db).상태, '정리됨');
});

test('② 처리 흔적이 없으면 경고는 그대로 켜 있다 — 사람이 볼 것을 숨기지 않는다', async () => {
  const db = 조회DB(씨앗());
  await 경고판돌리개.판갱신(db);
  assert.strictEqual(판(db).경고수, 1);
  assert.strictEqual(판(db).줄들[0].종류, 'delivery');
  assert.strictEqual(전달경보(db).상태, 'block');
  assert.strictEqual(db.읽기('newsletter/watch/2026-10-w2/전달/처리됨'), null, '처리된 것이 없으면 쓰지 않는다');
});

test('③ 하나만 처리됐으면 말이 «1통» 으로 줄고 경고는 남는다 — 나머지를 처리하면 그때 꺼진다', async () => {
  const 씨 = 씨앗();
  씨.newsletter.blocked = 차단('ghost-a@gone.example');
  const db = 조회DB(씨);
  await 경고판돌리개.판갱신(db);
  assert.strictEqual(판(db).경고수, 1);
  assert.match(판(db).말들[0], /1통/);
  assert.strictEqual(전달경보(db).상태, 'block');
  /* 그 뒤 반송 자동 확인이 둘째 주소도 뺀다 → 다음 3시간 갱신에서 꺼진다 */
  await db.ref('newsletter/blocked').update(차단('ghost-b@gone.example'));
  await 경고판돌리개.판갱신(db);
  assert.strictEqual(판(db).경고수, 0);
  assert.strictEqual(전달경보(db).상태, '정리됨');
});

test('④ 처리판을 못 읽으면(읽기 탈) 경고는 그대로 — 갱신은 멈추지 않고 탈만 알린다', async () => {
  const 씨 = 씨앗();
  씨.newsletter.blocked = Object.assign({}, 차단('ghost-a@gone.example'), 차단('ghost-b@gone.example'));
  const db = 조회DB(씨, 'newsletter/blocked');
  경고판돌리개.경고.length = 0;
  await 경고판돌리개.판갱신(db);
  assert.strictEqual(판(db).경고수, 1, '못 세었는데 경고를 지웠다');
  assert.strictEqual(전달경보(db).상태, 'block');
  assert.ok(경고판돌리개.경고.some((m) => /전달경보 다시 세기/.test(m)), '탈을 알리지 않았다');
});

test('⑤ 이미 정리된 경보는 다시 세우지도, 다시 쓰지도 않는다 — 그 뒤 처리가 풀려도 한 번 정리한 것은 그대로', async () => {
  const 씨 = 씨앗();
  씨.newsletter.blocked = Object.assign({}, 차단('ghost-a@gone.example'), 차단('ghost-b@gone.example'));
  const db = 조회DB(씨);
  await 경고판돌리개.판갱신(db);
  assert.strictEqual(전달경보(db).상태, '정리됨');
  const 쓴수 = db.쓴것.length;
  /* 사람이 한 주소를 «되돌림»(명단에 다시 넣음) 해도 이미 정리된 경보를 다시 세우지 않는다 */
  await db.ref('newsletter/blocked').set({});
  await 경고판돌리개.판갱신(db);
  assert.strictEqual(전달경보(db).상태, '정리됨');
  assert.strictEqual(판(db).경고수, 0);
  const 전달경보쓰기 = db.쓴것.slice(쓴수).filter((x) => /전달경보/.test(JSON.stringify(x)));
  assert.strictEqual(전달경보쓰기.length, 0, '정리된 경보에 또 썼다');
});

test('③ 걸린 경보가 없으면 대기열도 처리판도 읽지 않는다 — 3시간마다 도는 갱신에 비용을 더하지 않는다', async () => {
  const 씨 = 씨앗();
  delete 씨.newsletter.watch['2026-10-w2'].전달경보;
  const db = 조회DB(씨);
  const 읽은곳 = [];
  const ref = db.ref;
  db.ref = (p) => { 읽은곳.push(String(p || '')); return ref(p); };
  await 경고판돌리개.판갱신(db);
  assert.ok(!읽은곳.some((p) => /pucards|newsletter\/blocked/.test(p)), '걸린 경보도 없는데 대기열·차단 목록을 읽었다: ' + 읽은곳.join(', '));
  assert.strictEqual(판(db).경고수, 0);
});

/* ── ⑥ 월요일 12시 점검 ── */
test('⑥ 월요일 12시 점검 — 같은 잣대로 세어 «사람 몫이 있을 때만» 경보를 건다', () => {
  const 몸 = 시계('newsletterWatchDelivery');
  assert.match(몸, /NWatch\.전달사람몫\(줄들, ready\.batchId, 처리판\)/, '12시 점검이 사람 몫 잣대를 안 쓴다');
  assert.match(몸, /전달처리판읽기\(db\)\.catch\(/, '처리판을 못 읽어도 점검이 서면 안 된다(빈 판 = 전부 사람 몫)');
  assert.match(몸, /if \(사람\.사람몫 > 0\) \{\s*await 뉴스레터경보\(ready\.회차열쇠, "전달경보", NWatch\.전달경보말\(사람\.사람몫\)\);/,
    '경보는 사람 몫이 있을 때만, 같은 말 한 곳(전달경보말)으로 건다');
  assert.ok(!/if \(셈\.실패 \|\| 셈\.확인필요\)/.test(몸), '옛 조건(실패·확인필요 전부 경보)이 남아 있다');
  assert.match(몸, /\.set\(Object\.assign\(\{ 때: Date\.now\(\), 받는수: ready\.받는수 \|\| 0 \}, 셈, \{ 처리됨: 사람\.처리됨 \}\)\)/, '«처리됨» 수를 전달 칸에 남기지 않는다');
  /* 기록에 주소가 안 들어간다 */
  assert.ok(!/to:|email|주소들/.test(몸.split('.set(')[1].split(';')[0]));
});

test('③ 다시 세기는 경고판 갱신 안에서 — 3시간마다 도는 감시 외 모든 갱신 길에서 돈다, 탈이 나도 갱신은 계속', () => {
  const 갱신 = 함수(서버, 'async function 뉴스레터경고판갱신');
  assert.match(갱신, /try \{\s*const 바뀜 = await 뉴스레터전달경보다시보기\(db, 열쇠, v\[열쇠\], 반송들\);/, '다시 세기가 try 안에 없다');
  assert.match(갱신, /catch \(e\) \{ console\.warn\("\[전달경보 다시 세기\]"/);
  assert.ok(갱신.indexOf('전달경보다시보기') < 갱신.indexOf('NWatch.경고판짓기('), '경고판을 짓기 «전에» 다시 세어야 한다');
  const 다시 = 함수(서버, 'async function 뉴스레터전달경보다시보기');
  assert.match(다시, /orderByChild\("bulk"\)\.equalTo\(배치\)/, '이 회차 대기열만 읽는다(bulk 색인)');
  assert.ok(!/scheduled"\)\.once\("value"\)/.test(다시), '대기열을 통째로 읽는다');
  assert.match(다시, /경보\.상태 !== "block"\) return null/, '걸린 경보가 없으면 아무것도 읽지 않아야 한다');
});

test('① 사람 몫 판정은 반송 쪽 잣대 한 곳을 부른다 — 따로 적지 않는다', () => {
  const 본문 = stripJs(fs.readFileSync(path.join(__dirname, '..', 'functions', 'news-watch.js'), 'utf8')).replace(/\r\n/g, '\n');
  const 몸 = 함수(본문, 'function 전달사람몫');
  assert.match(몸, /Core\.반송사람몫인가\(/, '반송 쪽 «사람 몫인가» 를 안 부른다 — 두 잣대가 다시 어긋난다');
  assert.match(몸, /Core\.주소열쇠\(/, '주소 열쇠를 따로 만든다 — 규칙이 어긋나면 하나도 안 맞는다');
});

/* ── 자동화 점검 화면 ── */
test('④ 자동화 점검 화면 — 이미 처리된 실패는 «사람이 볼 것» 이 아니라 «스스로 고친 것» 으로 보인다', () => {
  assert.match(화면, /const 전달사람몫 = !전 \? 0 : Math\.max\(0, \(Number\(전\.실패\) \|\| 0\) - \(Number\(전\.처리됨\) \|\| 0\)\) \+ \(Number\(전\.확인필요\) \|\| 0\);/);
  assert.match(화면, /전달사람몫 \? '⚠ ' \+ 전달사람몫 \+ '통 못 감'/, '사람 몫이 있을 때만 «못 감» 경고');
  assert.match(화면, /전\.실패 \? '↻ ' \+ 전\.실패 \+ '통 못 감 · 이미 자동 정리'/, '전부 처리됐으면 «이미 자동 정리» 로 보여야 한다');
  assert.match(화면, /w\.전달경보\.상태 === '정리됨'/, '정리된 경보를 «스스로 고친 것» 에 안 남긴다');
  /* 탭 숫자는 걸려 있는(block) 것만 센다 — 정리됨은 안 센다 */
  const 수 = 함수(화면, 'function 감시볼것수');
  assert.match(수, /w\[k\]\.상태 === 'block'/);
});

/* ── 서로 같은 눈으로 보는지 — 포털 경고판도 «정리됨» 은 안 센다 ── */
test('③ 경고판짓기는 상태가 block 인 전달경보만 센다 — 정리됨은 0', () => {
  const 판 = W.경고판짓기({ 열쇠: 'k', 발송: { 상태: 'ok' }, 전달경보: { 상태: '정리됨', 말: '3통이 못 나갔습니다' } }, {});
  assert.strictEqual(판.경고수, 0);
  assert.strictEqual(W.경고판짓기({ 열쇠: 'k', 발송: { 상태: 'ok' }, 전달경보: { 상태: 'block', 말: '3통이 못 나갔습니다' } }, {}).경고수, 1);
});
