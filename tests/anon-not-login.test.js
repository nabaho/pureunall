/* 익명 손님은 «로그인한 사람»이 아니다 (2026-10-07)
   대표 보고: 「뉴스레터 내가 총괄 관리자인데 로그인이 안된다」
   ── 까닭: 정부사업일정·전자서명은 아무도 없으면 스스로 «익명 로그인»을 건다.
      총괄관리자 전용 앱이 그 익명도 「로그인함」으로 치고 권한(uid_roles)을 읽다가
      못 읽어 「총괄관리자만 쓸 수 있습니다」에 가뒀다 — 로그인 칸조차 안 떴다.
   ★ 그래서 앱의 로그인 갈림길을 «실제로 돌려» 익명이면 afterLogin 에 안 가는지 본다. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const APPS = ['pu-news.html', 'pu-home.html', 'pu-paydata.html'];

/* firebase.auth().onAuthStateChanged(function(user){ … }); 의 함수만 떼어 낸다 */
function handlerOf(src) {
  const at = src.indexOf('firebase.auth().onAuthStateChanged(function');
  assert.ok(at >= 0, '로그인 갈림길을 못 찾음');
  const start = src.indexOf('function', at);
  let depth = 0, i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) break;
  }
  return src.slice(start, i + 1);
}

function run(file, user) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const log = [];
  const ctx = {
    App: {},
    afterLogin: () => log.push('afterLogin'),
    PuGate: { show: () => log.push('gate') },
    location: { search: '', protocol: 'https:', replace: () => log.push('redirect') },
  };
  vm.createContext(ctx);
  vm.runInContext('(' + handlerOf(src) + ')', ctx)(user);
  return log;
}

for (const f of APPS) {
  test(f + ': 익명 손님이면 권한 확인(afterLogin)으로 가지 않는다', () => {
    const log = run(f, { uid: 'anon1', isAnonymous: true });
    assert.ok(!log.includes('afterLogin'), '익명을 로그인한 사람으로 쳤다: ' + log.join(','));
    assert.ok(log.length >= 1, '익명일 때 로그인 화면(자물쇠·포털)으로 보내야 한다');
  });
  test(f + ': 진짜 계정이면 그대로 들어간다', () => {
    const log = run(f, { uid: 'u1', isAnonymous: false, email: 'hong@example.kr' });
    assert.ok(log.includes('afterLogin'));
  });
}
