/* 📦 지난 메일을 빨리 연다 (대표 지시 2026-10-10 「메일을 읽는데 너무 늦거나 못 읽는 경우도 있다」)
   ═══════════════════════════════════════════════════════════════════════════
   ★ 실측(서버 기록 readOldMail): 한 통에 13~18초, 겹치면 75~137초.
     한 통을 열 때마다 ①새로 로그인 ②이름표 3만 줄(UIDL)을 처음부터 받았다.
   ★ 그리고 목록에서 누르면 «못» 열렸다 — 지난 메일 줄의 u 는 0 이라(번호가 아니라 이름표가
     열쇠다) 화면이 「0」을 보냈다. 머리글은 (제목 없음)·(모름)·1970.01.01 로 비고, 10초 뒤
     「다음메일에 없습니다」가 왔다(2026-10-10 15:13 대표 화면 그대로).
   이 검사는 둘을 지킨다 — 붙어 둔 연결을 이어 쓰는가, 그리고 화면이 «열쇠»를 보내는가. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MS_PATH = require.resolve('../functions/mail-sync.js');
/* 붙어 둔 연결은 모듈 자리에 산다 — 검사마다 새로 불러 깨끗한 자리에서 시작한다 */
function fresh() { delete require.cache[MS_PATH]; return require(MS_PATH); }

function fakePopFactory(ids) {
  const stats = { logins: 0, uidl: 0, closed: 0 };
  const open = async () => {
    stats.logins++;
    return {
      cmd: async (text) => {
        if (text === 'UIDL') { stats.uidl++; return { head: '+OK', body: ids.map((id, k) => (k + 1) + ' ' + id).join('\r\n') + '\r\n' }; }
        throw new Error('모르는 명령 ' + text);
      },
      close: async () => { stats.closed++; },
    };
  };
  return { open, stats };
}

test('★★ 두 통을 열어도 로그인·이름표 목록은 «한 번»뿐이다', async () => {
  const MS = fresh();
  const f = fakePopFactory(['AAA', 'BBB', 'CCC']);
  const a = await MS.oldPopFind(f.open, 'BBB');
  const b = await MS.oldPopFind(f.open, 'CCC');
  assert.equal(a.n, 2);
  assert.equal(b.n, 3);
  assert.equal(b.reused, true, '두 번째 통이 붙어 둔 연결을 안 썼다');
  assert.equal(f.stats.logins, 1, '통마다 새로 로그인한다 — 그것이 13초였다');
  assert.equal(f.stats.uidl, 1, '통마다 3만 줄 목록을 다시 받는다');
  MS.oldPopForget();
});

test('★ 열쇠는 popKey 로 맞춘다 — 점·빗금이 든 이름표도 찾는다', async () => {
  const MS = fresh();
  const f = fakePopFactory(['a.b/c', 'zz']);
  const got = await MS.oldPopFind(f.open, MS.popKey('a.b/c'));
  assert.equal(got.n, 1);
  MS.oldPopForget();
});

test('★ 붙어 둔 표에 없으면 «새로 붙어 한 번 더» 본 뒤에야 없다고 한다', async () => {
  const MS = fresh();
  const f = fakePopFactory(['AAA']);
  await MS.oldPopFind(f.open, 'AAA');
  const got = await MS.oldPopFind(f.open, 'NOPE');
  assert.equal(got.n, 0);
  assert.equal(f.stats.logins, 2, '낡은 표만 보고 없다고 했다');
  MS.oldPopForget();
});

test('★ 오래 놀린 연결은 버리고 새로 붙는다 — POP3 는 붙어 있는 동안 메일함을 잠근다', async () => {
  const MS = fresh();
  const f = fakePopFactory(['AAA']);
  const realNow = Date.now;
  try {
    await MS.oldPopFind(f.open, 'AAA');
    const t = realNow();
    Date.now = () => t + 10 * 60 * 1000;
    await MS.oldPopFind(f.open, 'AAA');
  } finally { Date.now = realNow; }
  assert.equal(f.stats.logins, 2, '10분 놀린 연결을 그대로 썼다');
  assert.ok(f.stats.closed >= 1, '버린 연결을 안 닫았다');
  MS.oldPopForget();
});

const SRC = fs.readFileSync(path.join(__dirname, '..', 'functions', 'mail-sync.js'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const rd = strip(SRC.slice(SRC.indexOf('readOldMail: F'), SRC.indexOf('readMailAttachment: F')));

test('★★ readOldMail 이 붙어 둔 연결을 쓴다 — 통마다 popOpen·UIDL 을 하지 않는다', () => {
  assert.match(rd, /oldPopFind\(/, 'readOldMail 이 붙어 둔 연결을 안 쓴다');
  assert.doesNotMatch(rd, /cmd\('UIDL'/, 'readOldMail 이 아직 통마다 이름표 목록을 받는다');
  assert.doesNotMatch(rd, /finally\s*\{[^}]*pop\.close\(\)/, '통마다 연결을 닫는다 — 다음 통이 또 로그인한다');
});

test('★★ 그릇 수를 묶지 않는다 — 1 로 묶었더니 큰 메일 한 통 도는 동안 다른 요청이 «그냥 끊겼다»', () => {
  /* 2026-10-10 06:55~06:57 「사용 가능한 인스턴스 없음」 10건. 경력관리 화면도 이 함수를 쓴다. */
  assert.doesNotMatch(rd, /maxInstances/, 'readOldMail 그릇 수를 묶었다 — 큰 메일이 도는 동안 나머지가 끊긴다');
});

test('★★ 큰 지난 메일은 «앞부분(TOP)만» 먼저 받는다 — POP3 는 1초에 60KB 쯤이다(12MB 가 195초)', () => {
  assert.match(rd, /const partial = size > OLD_FULL_MAX && !b\.full && wantAtt < 0;/, '큰 메일도 통째로 받는다');
  assert.match(rd, /partial \? 'TOP ' \+ hit\.n/, '앞부분만 받는 길이 없다');
  assert.match(rd, /full: !partial, partial: partial/, '화면이 앞부분인 줄 모른다');
});

test('★ 화면은 앞부분만 온 메일에 말을 하고 「전체 받기」를 둔다 — 첨부 목록도 반쪽이다', () => {
  assert.match(HTML, /큰 메일이라 글 앞부분만 보입니다/);
  assert.match(HTML, /body: JSON\.stringify\(\{ key:uid, full:1 \}\)/, '전체 받기가 full 을 안 보낸다');
});

test('★★ 로그인이 잠겨 거절되면(-ERR) 기다렸다 다시 — 연결 문제는 그대로 올린다', async () => {
  const MS = fresh();
  let tries = 0;
  const realSet = global.setTimeout;
  global.setTimeout = (fn) => realSet(fn, 0);
  try {
    const ok = await MS.oldPopOpen(async () => {
      tries++;
      if (tries < 3) throw Object.assign(new Error('-ERR [IN-USE]'), { pop: true });
      return 'connected';
    });
    assert.equal(ok, 'connected');
    assert.equal(tries, 3);
    let n = 0;
    await assert.rejects(MS.oldPopOpen(async () => { n++; throw new Error('소켓이 끊겼다'); }));
    assert.equal(n, 1, '연결 문제인데 되풀이했다');
  } finally { global.setTimeout = realSet; }
});

test('★ 「지난 메일」 칸을 열면 미리 붙여 둔다(warm) — 메일은 안 읽는다', () => {
  assert.match(rd, /if \(warm\)\s*\{[\s\S]{0,400}oldPopSession\(/, 'warm 이 붙여 두지 않는다');
  const w = rd.slice(rd.indexOf('if (warm)'), rd.indexOf('if (warm)') + 500);
  assert.doesNotMatch(w, /RETR|TOP /, 'warm 이 메일을 읽는다');
});

/* ── 화면 쪽 ── */
const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
function fnSrc(name) {
  const i = HTML.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 을 못 찾음');
  const j = HTML.indexOf('\nfunction ', i + 10);
  return HTML.slice(i, j > i ? j : HTML.length);
}

test('★★ 목록 줄은 «열쇠»를 번호로 들고 간다 — 지난 메일 줄의 u 는 0 이다', () => {
  const vm = require('vm');
  const box = { _mbMsgs: { '*old': { 'K1abc': { u: 0, d: 1600000000000, s: '가나상사 급여', e: 'hong@example.com' } } },
    MB_OLD_ID: '*old', MB_RAW_P: '~', MB_BIN_P: '#', MB_WHO_P: '@',
    mbNow: () => '*old', mbFolderBy: () => null, mbFolderLabel: () => '', mbRowFits: () => true,
    mbMemoOf: () => ({}), mbWhoIndex: () => null, mbMyAddr: () => '' };
  vm.createContext(box);
  vm.runInContext(fnSrc('mbAllRows') + '\n;this.mbAllRows = mbAllRows;', box);
  const rows = box.mbAllRows();
  assert.equal(rows.length, 1);
  assert.equal(String(rows[0].u), 'K1abc', '지난 메일 줄이 u=0 을 들고 간다 — 누르면 「0」을 열려다 못 연다');
});

test('★ 「지난 메일」 칸을 열면 서버를 미리 깨운다', () => {
  const open = fnSrc('openMailBox');
  assert.match(open, /id === MB_OLD_ID\)\s*\{\s*mbOldWarm\(\)/, '지난 메일 칸을 열 때 미리 붙여 두지 않는다');
  const w = fnSrc('mbOldWarm');
  assert.match(w, /readOldMail/);
  assert.match(w, /warm:\s*1/);
});
