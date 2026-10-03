'use strict';
/* 로그인한 본인의 이름이 모든 앱 상단에 나온다 (대표 지시 2026-09-29
   「로그인 한 사람 이름이 나와야된다. 푸른 통합시스템 상단에 로그인한 본인의 이름이 모두 나오게 만들어라」
   「로그인시 모든 앱 상단에 본인의 이름이 나와야 된다」)

   왜 안 나왔나 — 두 갈래였다.
   ㉠ 계정 명부(data/user_accounts)는 «재무 권한자만» 읽힌다(보안규칙 finOnly).
      캘린더·이알피(포털 경유 새 기기)는 「나」를 거기서만 찾아서, 일반 직원은
      「못 읽은 자료: user_accounts」 띠 + 이름 대신 메일 첫 글자만 떴다.
   ㉡ 문서관리·급여관리·뉴스레터 관리·정부사업신청은 이름을 아예 안 찾고 메일·아이디만 그렸다.

   못 박는 것(규칙 — 사람 이름·개수를 박지 않는다):
   ① 캘린더는 공개 명부(user_dir)로도 사람을 찾고, 그것으로 찾았으면 «못 읽음» 띠를 안 띄운다
   ② 캘린더 머리에 이름이 «글자로» 있다(첫 글자 동그라미만이 아니다)
   ③ 공용 부품은 메일이 없는 로그인(카카오 표)도 사번(claims.sid)으로 사람을 찾는다
   ④ 스스로 그리는 앱들은 공용 부품이 찾은 «이름»으로 머리줄을 고쳐 그린다
   ⑤ 이알피는 계정 명부가 없어도 공개 명부로 「나」를 만든다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\r\n/g, '\n');
const bare = (f) => stripJs(read(f));

test('① ★★ 캘린더는 공개 명부로도 사람을 찾는다 — 재무 권한이 없어도', () => {
  const B = bare('pu-cal.html');
  assert.match(B, /var KEYS = \[[^\]]*'user_dir'/, '★★ 캘린더가 공개 명부(user_dir)를 안 읽습니다');
  const fn = cutFn(B, 'function allUsers(');
  assert.ok(fn, 'allUsers 를 못 찾았습니다');
  const 상자 = { D: { user_dir: [{ sid: 'P-001', name: '홍길동', status: 'active' }] }, Object, Array, String };
  vm.createContext(상자);
  vm.runInContext(fn + '\nvar 결과 = allUsers();', 상자);
  assert.equal(상자.결과.length, 1, '★★ 계정 명부가 없을 때 공개 명부로 사람을 못 찾습니다');
  assert.equal(상자.결과[0].name, '홍길동');
  // 둘 다 있으면 계정 명부가 먼저 — 같은 사번은 두 번 안 든다
  const 둘 = { D: { user_accounts: [{ sid: 'P001', name: '홍길동', status: 'active', email: 'p001@pureun.kr' }],
    user_dir: [{ sid: 'P-001', name: '홍길동', status: 'active' }, { sid: 'P002', name: '임꺽정', status: 'active' }] }, Object, Array, String };
  vm.createContext(둘);
  vm.runInContext(fn + '\nvar 결과 = allUsers();', 둘);
  assert.equal(둘.결과.length, 2, '같은 사람이 두 번 들었거나 공개 명부 사람이 빠졌습니다');
  assert.equal(둘.결과[0].email, 'p001@pureun.kr', '계정 명부가 먼저여야 합니다');
  // 공개 명부로 찾았으면 «못 읽음» 띠를 거둔다
  assert.match(B, /if\(FAILED\.user_accounts && !FAILED\.user_dir[^\n]*\n[^\n]*\)\s*delete FAILED\.user_accounts/,
    '★ 재무 권한이 없는 직원에게 「못 읽은 자료: user_accounts」 띠가 계속 뜹니다');
  // 로그인 메일의 사번으로도 「나」를 찾는다(공개 명부엔 메일·uid 가 없다)
  const 시작 = cutFn(B, 'function start(');
  assert.match(시작, /user\.email[^\n]*match\(\/\^\(\[a-z\]\+\)\(\\d\+\)@\//, '★ 공개 명부만 있을 때 「나」를 찾을 길이 없습니다');
});

test('② ★★ 캘린더 머리에 이름이 «글자로» 있다', () => {
  const S = read('pu-cal.html');
  assert.match(S, /<span id="meName"[^>]*><\/span>\s*\n\s*<button id="me"/, '★★ 동그라미 옆 이름 자리가 없습니다');
  assert.match(bare('pu-cal.html'), /\$\('meName'\)[\s\S]{0,200}textContent = ME \? \(\(ME\.name/, '이름 자리에 이름을 안 넣습니다');
});

test('③ ★★ 공용 부품은 메일 없는 로그인(카카오 표)도 사번으로 찾는다', async () => {
  const g = { console, Promise, setInterval() { return 0; }, clearInterval() {} };
  g.globalThis = g; g.window = g;
  vm.createContext(g);
  vm.runInContext(read('js/pu-whoami.js'), g);
  g.PuWhoami.mount(false);
  g.PuWhoami._resolve({ email: '', getIdTokenResult: () => Promise.resolve({ claims: { sid: 'P-001' } }) });
  await new Promise((r) => setTimeout(r, 20));
  const me = g.PuWhoami.get();
  assert.ok(me, '★★ 메일이 없는 로그인에서 사람을 아예 못 찾습니다');
  assert.equal(me.sid, 'P001', '표에 적힌 사번을 못 읽었습니다');
  // 로그아웃하면 비운다
  g.PuWhoami._resolve(null);
  assert.equal(g.PuWhoami.get(), null, '로그아웃 뒤에도 앞사람이 남습니다');
});

test('④ ★★ 스스로 그리는 앱은 공용 부품이 찾은 «이름»으로 머리줄을 고친다', () => {
  ['docs-esign.html', 'payroll-os.html', 'pu-news.html'].forEach((f) => {
    const B = bare(f);
    assert.match(B, /<script src="js\/pu-whoami\.js\?v=\d+"/, f + ' 에 이름 부품이 없습니다');
    assert.match(B, /PuWhoami\.onChange\(/, '★★ ' + f + ' 가 이름을 못 받습니다 — 메일·아이디만 뜹니다');
    assert.match(B, /\.name\s*\+\s*\([\w.]+\.title\s*\?/, '★ ' + f + ' 머리줄에 이름을 안 넣습니다');
  });
  const G = bare('gov.html');
  assert.match(G, /<script src="js\/pu-whoami\.js\?v=\d+"/, '★★ 정부사업신청에 이름 부품이 없습니다');
  assert.match(G, /PuWhoami\.mount\('#who'\)/, '정부사업신청이 이름 자리를 안 알려 줍니다');
  assert.doesNotMatch(G, /\$\('who'\)\.textContent=u\?\(u\.email/, '★ 정부사업신청이 이름 자리를 메일로 덮습니다');
});

test('⑤ ★★ 이알피는 계정 명부가 없어도 공개 명부로 「나」를 만든다', () => {
  const fn = cutFn(bare('pu-erp.html'), 'function buildCurrentUser(');
  assert.ok(fn, 'buildCurrentUser 를 못 찾았습니다');
  const 저장 = { pureun_v6_user_dir: JSON.stringify([{ sid: 'P002', name: '임꺽정', role: 'staff', title: '노무사', status: 'active' }]) };
  const 상자 = { window: {}, JSON, Array, localStorage: { getItem: (k) => (k in 저장 ? 저장[k] : null) },
    safeParse: (s, d) => { try { return s == null ? d : JSON.parse(s); } catch (e) { return d; } } };
  vm.createContext(상자);
  vm.runInContext(fn + '\nvar 나 = buildCurrentUser("P002");', 상자);
  assert.ok(상자.나, '★★ 계정 명부가 없는 기기(일반 직원)에서 「나」를 못 만듭니다 — 상단 이름이 빕니다');
  assert.equal(상자.나.name, '임꺽정');
  // 포털 경유 때 서버에서 읽은 공개 명부로도 찾는다
  const 상자2 = { window: { __puSsoDir: [{ sid: 'P003', name: '홍길동', status: 'active' }] }, JSON, Array,
    localStorage: { getItem: () => null }, safeParse: (s, d) => d };
  vm.createContext(상자2);
  vm.runInContext(fn + '\nvar 나 = buildCurrentUser("P003");', 상자2);
  assert.ok(상자2.나 && 상자2.나.name === '홍길동', '★ 포털 경유 첫 순간에 이름을 못 찾습니다');
  // 그만둔 사람은 공개 명부에 있어도 로그인 안 된다
  const 상자3 = { window: { __puSsoDir: [{ sid: 'P004', name: '홍길동', status: 'retired' }] }, JSON, Array,
    localStorage: { getItem: () => null }, safeParse: (s, d) => d };
  vm.createContext(상자3);
  vm.runInContext(fn + '\nvar 나 = buildCurrentUser("P004");', 상자3);
  assert.equal(상자3.나, null, '★★ 퇴사자가 공개 명부로 로그인됩니다');
  // 서버에서 읽은 명부를 기억해 둔다
  assert.match(bare('pu-erp.html'), /window\.__puSsoDir = list/, '포털 경유 때 읽은 명부를 안 남깁니다');
});
