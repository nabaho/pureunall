'use strict';
/* 전체 점검에서 나온 둘을 못 박는다 (대표 지시 2026-09-22 「네」)
   ─────────────────────────────────────────────────────────────────────────
   ■ ① 직원 명부(user_dir)를 통째로 덮어쓰던 자리
     이 집의 저장은 전부 dbSet 이라는 두꺼운 문을 지난다 — 서버를 먼저 읽고,
     합치고, 트랜잭션으로 쓰고, 0건·급감을 막는다.
     그런데 `_syncUserDir` **한 곳만** 그 문을 안 지나고 통째로 set 했다.
     게다가 handleLogin 에서 «로그인하는 그 순간» 돌고, USERS_SEED 는 [] 다.
     사본이 없는 기기에서 관리자가 로그인하면 로그인용 명부가 **통째로 빈다** —
     그러면 아무도 못 들어온다. 실패해도 .catch(function(){}) 라 말이 없었다.

   ■ ② 거래내역의 useEffect 둘에 의존목록이 없던 것
     없으면 «무엇 때문에 다시 그리든» 그 일이 또 돈다. 둘째 것은 그 길에서
     **서버에 쓴다**(dbUpsert, 부를 때마다 새 id) — 같은 줄이 두 번 통과하면
     지출이 두 건 생긴다. 막는 것이 한 겹뿐이었다.

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 빈 명부는 «안 올린다»          ② 통째 set 이 아니라 트랜잭션이다
     ③ 사람이 사라지면 멈춘다          ④ 조용히 실패하지 않는다
     ⑤ 두 효과에 의존목록이 있다
     ⑥ 그 목록에 «그릴 때마다 새로 만드는 값»을 넣지 않는다 ← 넣으면 목록이 헛것이 된다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const FN = cutFn(SRC, 'function _syncUserDir(');

/* 진짜 함수를 떠서 «돌린다» — 글자만 보는 검사는 기능을 꺼도 통과한다
   (이 저장소 「되풀이된 실수 ②」). */
function 돌려보기(opts) {
  const calls = { set: [], tx: [], alert: [], warn: [] };
  const ctx = {
    console: { warn: (...a) => calls.warn.push(a.join(' ')), log(){}, error(){} },
    Object, JSON, Array, Math, Date, Number, String,
    USERS_SEED: [],
    USERDIR_MAX_DROP: opts.maxDrop == null ? 1 : opts.maxDrop,
    CURRENT_USER: { isAdmin: true },
    dbGet: () => opts.local,
    normalizeFbValue: (v) => (Array.isArray(v) ? v : (v ? [] : [])),
    erpAlert: (...a) => calls.alert.push(a),
    fbDb: {
      ref(p) {
        return {
          set(v) { calls.set.push({ path: p, v }); return { catch(){} }; },
          transaction(fn, done) {
            const out = fn(opts.server === undefined ? null : { v: opts.server, u: 1 });
            calls.tx.push({ path: p, out });
            if (done) done(null, out !== undefined, { val: () => out });
          }
        };
      }
    }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(FN + '\n_syncUserDir();', ctx);
  return calls;
}

const 사람 = (sid, name) => ({ sid, name, loginId: name, role: 'staff', status: 'active' });

test('①★★ 사본이 없는 기기에서는 «아무것도 안 올린다» — 비우는 것은 갱신이 아니다', () => {
  /* handleLogin 에서 로그인하는 그 순간 도는데, USERS_SEED 가 [] 다.
     그대로 올리면 로그인용 명부가 통째로 비고 아무도 못 들어온다. */
  const c = 돌려보기({ local: [], server: [사람('s1', '권형하'), 사람('s2', '김')] });
  assert.equal(c.set.length, 0, '★★ 빈 명부를 통째로 올렸다 — 아무도 로그인 못 한다');
  assert.equal(c.tx.length, 0, '★★ 올릴 것이 없으면 서버를 건드리지도 말아야 한다');
  assert.ok(c.warn.length > 0, '★ 건너뛴 줄 아무도 모르면 다음에 또 같은 자리를 판다');
});

test('②★★ 통째 set 이 아니라 «트랜잭션»으로 쓴다 — 읽고 쓰는 사이를 막는다', () => {
  const c = 돌려보기({ local: [사람('s1', '권형하')], server: [사람('s1', '권형하')] });
  assert.equal(c.set.length, 0,
    '★★ set() 으로 통째로 덮어쓴다 — 읽고 쓰는 사이에 남이 넣은 직원이 사라진다');
  assert.equal(c.tx.length, 1, '★★ 트랜잭션으로 쓰지 않는다');
  assert.equal(c.tx[0].path, 'data/user_dir');
  assert.ok(c.tx[0].out && Array.isArray(c.tx[0].out.v), '★ 쓰는 모양이 {v,u} 가 아니다');
});

test('③★★ 사람이 «사라지는» 갱신이면 멈춘다 — 사라진 사람은 로그인이 막힌다', () => {
  /* 내 기기의 사본이 낡아 남이 방금 넣은 직원이 없는 상황.
     잣대는 수가 아니라 이름표(sid)다 — 수만 맞아도 다른 사람일 수 있다. */
  const 서버 = [사람('s1', '가'), 사람('s2', '나'), 사람('s3', '다'), 사람('s4', '라')];
  const c = 돌려보기({ local: [사람('s1', '가')], server: 서버 });
  assert.equal(c.tx[0].out, undefined,
    '★★ 셋이 사라지는데 그대로 올렸다 — 그 셋은 내일 로그인을 못 한다');

  /* 수는 같은데 «사람»이 바뀐 경우도 막혀야 한다 — 수로만 세면 그냥 지나간다 */
  const c2 = 돌려보기({ local: [사람('s9', '새'), 사람('s8', '새2')], server: [사람('s1', '가'), 사람('s2', '나')] });
  assert.equal(c2.tx[0].out, undefined,
    '★★ 수(2=2)는 같지만 «둘 다 다른 사람»이다 — 수로만 세면 이것이 지나간다');
});

test('③-2 한 명 줄이는 것은 «사람이 한 일»일 수 있으니 통과시킨다', () => {
  /* 다 막으면 정말 내보낼 때 아무도 못 지운다. 울타리는 있되 문은 있어야 한다. */
  const c = 돌려보기({ local: [사람('s1', '가'), 사람('s2', '나')],
                      server: [사람('s1', '가'), 사람('s2', '나'), 사람('s3', '다')] });
  assert.notEqual(c.tx[0].out, undefined, '★ 한 명 지우는 길까지 막으면 아무도 못 내보낸다');
});

test('④★★ 조용히 실패하지 않는다 — 막혔으면 사람에게 말한다', () => {
  const c = 돌려보기({ local: [사람('s1', '가')],
                      server: [사람('s1','가'),사람('s2','나'),사람('s3','다'),사람('s4','라')] });
  assert.ok(c.alert.length > 0 || c.warn.length > 0,
    '★★ 막아 놓고 아무 말이 없으면 「명부가 갱신된 줄 알았다」가 된다');
  /* ⚠ 주석을 «먼저 걷는다». 걷지 않으면 이 검사는 «까닭을 적어 둔 주석»에 걸린다 —
     이 저장소 「되풀이된 실수 ②」 그대로다. 실제로 이 줄을 쓰자마자 걸렸다. */
  assert.doesNotMatch(stripJs(FN), /\.catch\(\s*function\s*\(\s*\)\s*\{\s*\}\s*\)/,
    '★★ 삼키는 .catch 가 남아 있다 — 이것이 여태 조용했던 까닭이다');
});

/* ══════ ⑤⑥ 거래내역 효과 둘 ══════ */
function 효과(anchor) {
  const i = SRC.indexOf(anchor);
  assert.ok(i > -1, '★★ 「' + anchor.slice(0, 40) + '」 를 못 찾았다');
  const j = SRC.indexOf('useEffect(', i);
  assert.ok(j > -1);
  let d = 0, k = SRC.indexOf('(', j);
  const start = k;
  do { if (SRC[k] === '(') d++; else if (SRC[k] === ')') d--; k++; } while (k < SRC.length && d > 0);
  return SRC.slice(start, k);
}

test('⑤★★ 자동 채우기·자동 등록에 «의존목록»이 있다', () => {
  /* 없으면 무엇 때문에 다시 그리든 또 돈다 — 검색창에 한 글자를 쳐도,
     1초 시계가 돌아도, 서버 자료가 도착해도. 322줄이면 그때마다 전부 훑는다. */
  [['채우기', '배운 것을 «저절로» 채운다'], ['등록', '켜 두었으면 «배운 것»을 저절로 등록한다']]
    .forEach(([이름, anchor]) => {
      const fn = 효과(anchor);
      assert.match(fn, /\}\s*,\s*\[[^\]]*\]\s*\)$/,
        '★★ 자동 ' + 이름 + ' 효과에 의존목록이 없다 — 그릴 때마다 돈다');
    });
});

test('⑥★★ 그 목록에 «그릴 때마다 새로 만드는 값»을 넣지 않는다', () => {
  /* expAll 은 `rows ? (rows.exp||[]).filter(…) : []`, expGuess 는 `{}` 로 시작한다 —
     둘 다 그릴 때마다 새 것이라 목록에 넣으면 매번 달라 보여 **목록이 헛것이 된다.**
     의존목록이 있는데도 매번 도는 것이 가장 나쁘다 — 고친 줄 알기 때문이다. */
  const 새로만드는것 = ['expAll', 'expGuess', 'comboMemo'];
  [['채우기', '배운 것을 «저절로» 채운다'], ['등록', '켜 두었으면 «배운 것»을 저절로 등록한다']]
    .forEach(([이름, anchor]) => {
      const fn = 효과(anchor);
      const deps = fn.slice(fn.lastIndexOf('['), fn.lastIndexOf(']') + 1);
      새로만드는것.forEach(v => {
        assert.doesNotMatch(deps, new RegExp('\\b' + v + '\\b'),
          '★★ 자동 ' + 이름 + ' 의 목록에 ' + v + ' 가 있다 — 그릴 때마다 새로 만드는 값이라\n' +
          '  목록에 넣어도 매번 달라 보인다. 고친 것처럼 보이지만 그대로 매번 돈다.');
      });
      assert.match(deps, /\browsb?\b|\brows\b/, '★ 줄이 바뀌면 다시 해야 한다 — rows 가 목록에 없다');
    });
});
