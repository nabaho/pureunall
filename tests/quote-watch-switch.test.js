'use strict';
/* 📨 견적 자동 감지 — «켜는 길과 푸는 길을 함께» (STATUS.md 「되풀이된 실수」 ④: 켤 길 없는 기능) + «누가 켤 수 있나»
   ★ 서버 훅(functions/mail-quote-watch.js)이 읽는 칸과, 총괄관리자가 누르는 화면 단추가 쓰는 칸이 «같은 칸»이어야 한다.
   ★ 그 칸을 쓸 수 있는 사람은 규칙이 «총괄관리자만» 허용해야 한다 — 아무나 켜면 이알피에 요청이 쏟아진다.
   ★ 규칙은 글자(정규식)가 아니라 «판정»으로 본다(검토 2026-11-09): 처음에 pucards/config 에 두었다가, pucards 의 $k 아래 $k2 가
     '.write': LOGIN 이라 «직원 누구나» 쓸 수 있다는 것을 글자 검사가 못 잡았다.
     파이어베이스는 위쪽이 준 쓰기를 아래서 거둘 수 없으므로, 길을 따라 «맞는 모든 칸»(이름 붙은 칸과 $변수 칸 둘 다)의 쓰기를
     모아 하나라도 참이면 «쓸 수 있다»로 센다(가장 엄격한 쪽 — 실제보다 넓게 열린 것으로 보고 걸러 낸다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const W = require('../functions/mail-quote-watch.js');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const GEN = JSON.parse(execFileSync(process.execPath, [path.join(R, 'scripts/make-firebase-rules.js')], { encoding: 'utf8' }));
const APPLY = JSON.parse(fs.readFileSync(path.join(R, 'docs/firebase-rules-전체-적용본.json'), 'utf8'));
const PASTE = JSON.parse(fs.readFileSync(path.join(R, 'docs/rules-paste.json'), 'utf8'));

/* ── 작은 규칙 판정기 — «쓸 수 있나»만 본다 ── */
const TREE = { uid_roles: {
  boss: { status: 'active', isAdmin: true },
  staff: { status: 'active' },
  gone: { status: 'retired' },
} };
const mk = (v) => ({ child: (k) => mk(v == null || typeof v !== 'object' ? null : (k in v ? v[k] : null)), val: () => (v === undefined ? null : v), exists: () => v != null });
function authOf(uid) { return uid ? { uid, token: { firebase: { sign_in_provider: 'password' } } } : null; }
function canWrite(rules, p, uid, newVal, strictAll) {
  const parts = p.split('/').filter(Boolean);
  let nodes = [{ n: rules, vars: {} }];
  const exprs = [];
  const take = (x) => { if (x.n && typeof x.n['.write'] === 'string') exprs.push({ e: x.n['.write'], vars: x.vars }); };
  nodes.forEach(take);
  for (const seg of parts) {
    const next = [];
    nodes.forEach((x) => {
      if (!x.n || typeof x.n !== 'object') return;
      const lit = x.n[seg] && typeof x.n[seg] === 'object';
      if (lit) next.push({ n: x.n[seg], vars: x.vars });
      /* 이름 붙은 칸이 있으면 $변수 칸은 안 맞는다(이 저장소 규칙의 “이름 붙인 칸이라 $k 쓰기 권한을 그대로 옮긴다” 주석이 가리키는 동작).
         strictAll 이면 «둘 다 맞는 것으로» 세어 더 엄격하게 본다 — 새 자리는 두 해석 모두에서 닫혀 있어야 한다. */
      if (!lit || strictAll) Object.keys(x.n).filter((k) => k[0] === '$').forEach((k) => next.push({ n: x.n[k], vars: Object.assign({}, x.vars, { [k]: seg }) }));
    });
    nodes = next; nodes.forEach(take);
  }
  const root = mk(TREE), data = mk(null), newData = mk(newVal === undefined ? null : newVal);
  return exprs.some(({ e, vars }) => {
    try { return !!new Function('root', 'auth', 'data', 'newData', 'now', ...Object.keys(vars), 'return (' + e + ');')(root, authOf(uid), data, newData, Date.now(), ...Object.values(vars)); }
    catch (_) { return false; }   /* 못 읽는 식은 «쓸 수 없음» 으로 센다 — 그 칸은 이 시험이 다룬 길이 아니다 */
  });
}

test('판정기가 맞게 센다 — 알려진 열린 자리·닫힌 자리로 먼저 확인', () => {
  assert.equal(canWrite(GEN.rules, 'pucards/config/mailCo/x', 'staff', { a: 1 }), true, '직원이 쓰는 기존 칸은 열려 있다(그래서 스위치를 여기 두면 안 된다)');
  assert.equal(canWrite(GEN.rules, 'pucards/config/mailCo/x', null, { a: 1 }), false, '로그인 안 한 사람은 못 쓴다');
  assert.equal(canWrite(GEN.rules, 'pucards/config/mailCo/x', 'gone', { a: 1 }), false, '퇴직자는 못 쓴다');
  assert.equal(canWrite(GEN.rules, 'data/app_config/x', 'staff', 1), false, '공용 설정은 관리자만(규칙 app_config)');
  assert.equal(canWrite(GEN.rules, 'data/app_config/x', 'boss', 1), true);
});

test('★★ 옛 자리(pucards/config/quoteWatch)는 직원 누구나 쓸 수 있다 — 그래서 이 자리를 쓰지 않는다', () => {
  assert.equal(canWrite(GEN.rules, 'pucards/config/quoteWatch/on', 'staff', true), true,
    '이 사실이 바뀌었다면(규칙이 닫혔다면) 이 시험의 까닭을 다시 적을 것');
  assert.ok(!read('docs-esign.html').includes('pucards/config/quoteWatch'), '화면이 옛 자리를 쓴다');
  assert.ok(!read('functions/mail-quote-watch.js').replace(/\/\*[\s\S]*?\*\//g, '').includes('pucards/config/quoteWatch'), '서버가 옛 자리를 읽는다');
});

test('★★★ 새 자리(pu_docs/config/quoteWatch)는 총괄관리자만 쓴다 — 일반 직원·퇴직자·로그인 안 한 사람은 못 켠다·못 끈다', () => {
  for (const p of ['pu_docs/config/quoteWatch', 'pu_docs/config/quoteWatch/on']) {
    for (const strict of [false, true]) {
      const tag = strict ? ' (엄격: 이름 칸과 $변수 칸 둘 다 맞는 것으로 셈)' : '';
      assert.equal(canWrite(GEN.rules, p, 'boss', { on: true }, strict), true, p + ' — 총괄관리자는 쓴다' + tag);
      assert.equal(canWrite(GEN.rules, p, 'staff', { on: true }, strict), false, '★ ' + p + ' — 일반 직원이 켠다' + tag);
      assert.equal(canWrite(GEN.rules, p, 'staff', null, strict), false, '★ ' + p + ' — 일반 직원이 지운다(끈다)' + tag);
      assert.equal(canWrite(GEN.rules, p, 'gone', { on: true }, strict), false, p + ' — 퇴직자' + tag);
      assert.equal(canWrite(GEN.rules, p, null, { on: true }, strict), false, p + ' — 로그인 안 한 사람' + tag);
    }
  }
});

test('«본 메일» 표식(pu_docs/config/quoteSeen)은 서버(관리자 SDK)만 쓴다 — 총괄관리자 화면도 직원도 못 쓴다', () => {
  for (const strict of [false, true]) for (const who of ['boss', 'staff', 'gone', null]) assert.equal(canWrite(GEN.rules, 'pu_docs/config/quoteSeen/mq-abc', who, 123, strict), false, String(who) + (strict ? ' (엄격)' : ''));
});

test('새 칸이 pu_docs 의 다른 칸 쓰기를 넓히지 않는다 — 원본 보관함·기록은 그대로', () => {
  for (const strict of [false, true]) {
    assert.equal(canWrite(GEN.rules, 'pu_docs/config/other', 'staff', 1, strict), false, 'config 아래 다른 칸을 직원이 쓴다');
    assert.equal(canWrite(GEN.rules, 'pu_docs/config', 'staff', { a: 1 }, strict), false, 'config 통째로 직원이 쓴다');
  }
  assert.equal(canWrite(GEN.rules, 'pu_docs/co/k1', 'staff', { name: 'x', n: 1 }), true, '기존 업체 기록 길은 그대로(직원이 쓴다)');
});

test('값 모양 — on 은 true/false 만, 칸 이름·길이를 묶는다', () => {
  const q = GEN.rules.pu_docs.config.quoteWatch;
  assert.match(q['.validate'], /hasChildren\(\['on'\]\)/);
  assert.match(q.on['.validate'], /isBoolean/);
  assert.match(q.at['.validate'], /isNumber/);
  assert.match(q.by['.validate'], /<= 60/);
  assert.equal(q.$other['.validate'], false);
});

test('올릴 규칙 파일(적용본·붙여넣기본)에도 들어 있다 — 만들개와 같다', () => {
  assert.deepEqual(APPLY.rules.pu_docs.config, GEN.rules.pu_docs.config);
  assert.deepEqual(PASTE.rules.pu_docs.config, GEN.rules.pu_docs.config);
});

test('화면 단추가 쓰는 칸 = 서버 훅이 읽는 칸(pu_docs/config/quoteWatch/on)', () => {
  const html = read('docs-esign.html');
  const m = /var quoteWatchSwitch = \{([\s\S]*?)\n\};/.exec(html);
  assert.ok(m, 'quoteWatchSwitch 가 없다 — 켤 길이 없는 기능이 된다');
  assert.equal(W.CFG, 'pu_docs/config/quoteWatch');
  assert.match(m[1], new RegExp("db\\.ref\\('" + W.CFG + "/on'\\)\\.once"), '읽는 칸이 서버와 다르다');
  assert.match(m[1], new RegExp("db\\.ref\\('" + W.CFG + "'\\)\\.set\\(\\{ on: !!on"), '쓰는 칸이 서버와 다르다');
  assert.match(html, /watch: quoteWatchSwitch/, '화면에 연결되지 않았다');
  assert.match(m[1], /PuWorklog\.log\('auto_detect'/, '켜고 끈 일을 작업 기록에 남긴다');
  assert.match(html, /규칙을 게시하기 전에는 이 단추의 쓰기도 거절된다/, '규칙 게시 전 거절된다는 사실을 화면 쪽 주석이 숨기지 않는다');
});

test('서버 훅은 스위치가 «true» 일 때만 돈다(기본 꺼짐)', () => {
  assert.match(read('functions/mail-quote-watch.js'), /if \(on !== true\) return out;/);
});

test('게시 전 목록(PENDING)에 새 규칙이 올라 있다 — 게시하면 콘솔 원문을 새 판으로 바꾸고 비운다', () => {
  assert.match(read('tests/photos-staff-share.test.js'), /'\/pu_docs\/config',/);
});
