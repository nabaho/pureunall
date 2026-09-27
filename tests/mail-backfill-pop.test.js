/* 📦 지난 메일 채우기 — POP3 로 머리글만 (대표 지시 2026-09-06)
   「메일함의 데이터를 더 많이 받을 수 없을까? … 최소 1년의 메일을 보관해야 한다」

   ★ 대표님 다음메일 설정을 화면으로 확인하고 시작했다 (2026-09-06):
       원본 저장 ····· 「다음메일에 원본 보관」  → 읽어도 안 지워진다
       메일함 선택 ··· 「전체 메일함 받기」      → 보낸메일함까지 온다
       적용 범위 ····· 「기존에 받은 메일을 포함하여 받기」
     이 셋을 «눈으로 보기 전»에는 내용을 건드리는 명령을 하나도 안 썼다.

   ⚠⚠ 이 검사에서 가장 중요한 것은 ①이다 — 이 파일에 DELE 가 아예 없어야 한다.
     설정이 바뀌는 날이 와도 우리가 대표님 메일을 지우는 일은 없어야 한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const MS = require(path.join(root, 'functions', 'mail-sync.js'));
const raw = fs.readFileSync(path.join(root, 'functions', 'mail-sync.js'), 'utf8');
const sync = raw.replace(/\/\*[\s\S]*?\*\//g, ' ');
const idx = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');

const cut = (from, to) => {
  const i = sync.indexOf(from);
  assert.ok(i > 0, from + ' 를 못 찾았습니다');
  const j = sync.indexOf(to, i);
  return sync.slice(i, j > i ? j : i + 6000);
};
const fill = cut('backfillMailbox:', 'readOldMail:');
const open = cut('function popOpen(', 'function popUidlList(');

/* ══════ ① 지우지 않는다 — 가장 중요한 자리 ══════ */

test('★★★ 이 파일 «어디에도» DELE 가 없다 — 설정이 바뀌어도 지우는 일은 없어야 한다', () => {
  /* ⚠ 주석까지 걷고 본다. 「DELE 는 안 부른다」는 주석은 남아도 되지만
       실제 명령으로 쓰인 자리는 하나도 없어야 한다. */
  assert.ok(!/['"`]\s*DELE\b/.test(sync),
    'DELE 를 쓰는 자리가 있습니다 — 대표님 메일이 지워질 수 있습니다');
  assert.ok(!/write\(\s*['"`]DELE/.test(raw), 'DELE 를 보내는 자리가 있습니다');
});

test('★★ 채우기는 «머리글만» 받는다 — RETR 을 안 쓴다', () => {
  assert.ok(!/RETR/.test(fill),
    '채우기가 본문까지 받습니다 — 계정에 36.8GB 가 들어 있습니다');
  assert.match(fill, /TOP '\s*\+\s*one\.n/, '머리글을 안 받습니다');
});

test('★★ 끊을 때 RSET 을 «먼저» 보낸다 — 표시가 남지 않게', () => {
  const iR = open.indexOf('RSET'), iQ = open.indexOf('QUIT');
  assert.ok(iR > 0, 'RSET 을 안 보냅니다');
  assert.ok(iQ > iR, 'RSET 보다 먼저 끊습니다');
});

/* ══════ ② 이어 가기 ══════ */

test('★★ «이름표»로 이어 간다 — 번호는 회차마다 흔들린다', () => {
  assert.match(fill, /st\.curId/, '어디까지 했는지를 안 들고 있습니다');
  assert.match(fill, /list\.findIndex\(\(x\) => x\.id === st\.curId\)/,
    '번호로 이어 갑니다 — 그 사이 한 통만 지워져도 통째로 어긋납니다');
});

test('★★ 예산이 다하면 «어디까지 했는지» 적고 끊는다', () => {
  /* ⚠ 「deadline 이라는 말이 나오나」로는 모자란다 — 예산을 «재는 줄»이 통째로 빠져도
       그 말은 위(const deadline = …)에 그대로 남아 통과한다(이빨 확인이 잡았다).
       한 통을 볼 때마다 «끊고 나가는지»를 본다. */
  assert.match(fill, /if \(nowMs\(\) > deadline\) break;/,
    '한 통씩 도는 동안 예산을 안 봅니다 — 몇 천 통을 도는 자리라 함수가 그대로 죽습니다');
  assert.match(fill, /old\/state['"]\)\.update\(/, '어디까지 했는지를 안 적습니다');
  /* 끊긴 자리를 적어 두어야 다음에 «이어서» 한다 */
  assert.match(fill, /curId: lastId/, '끊긴 자리를 안 적습니다');
});

/* ══════ ②-2 더 깊이 채우기 (대표 지시 2026-09-10 「3년치까지」) ══════
   1년치를 마친 뒤 3년치로 넓히는 일이다. 여기서 지키는 것 둘 —
   ① 마쳤어도 «어디까지 갔는지»를 안 지운다 (안 그러면 맨 앞부터 다시 걷는다)
   ② 이미 담은 것은 «받아 보기 전에» 지나간다 (한 번에 420초뿐이다) */

test('★★ 마쳤어도 «어디까지 갔는지»를 안 지운다 — 더 깊이 채울 때 맨 앞부터 다시 걷는다', () => {
  assert.ok(!/curId:\s*out\.done\s*\?\s*''/.test(fill),
    '마치면 자리를 지웁니다 — 3년치로 넓힐 때 1년치를 통째로 다시 걷습니다');
  assert.match(fill, /curId: lastId/, '끊긴 자리를 안 적습니다');
});

test('★★★ 이미 담은 것은 «받아 보기 전에» 지나간다 — 되받기만으로 예산이 다 간다', () => {
  /* ★ 지문(fps)으로는 못 거른다 — 지문을 보려면 TOP 으로 받아 봐야 안다.
       이름표(UIDL)는 목록에 이미 있어 받기 «전»에 거를 수 있다.
     ⚠ 그래서 «자리»가 곧 규칙이다 — TOP 보다 앞에 있어야 뜻이 있다. */
  assert.match(fill, /old\/msgs['"]\)\.once/, '이미 담은 것을 안 읽어 옵니다');
  const iHave = fill.search(/havePop\[popKey\(one\.id\)\]/);
  const iTop  = fill.search(/TOP '\s*\+\s*one\.n/);
  assert.ok(iHave > 0, '이미 담은 것을 안 거릅니다');
  assert.ok(iTop > 0, '머리글을 받는 자리를 못 찾았습니다');
  assert.ok(iHave < iTop,
    '받아 본 «뒤에» 거릅니다 — 안 받는 것이 뜻인데 다 받고 나서 버립니다');
});

test('★ 처음부터 다시 걷는 길도 남아 있다 — 이어 가기만 있으면 되돌릴 수가 없다', () => {
  assert.match(fill, /st\.curId && !b\.fresh/, '처음부터 다시 걸을 길이 없습니다');
});

test('★ 얼마나 깊이 채웠는지 «돌려준다» — 안 알려 주면 다 됐는지 알 길이 없다', () => {
  /* ⚠ 돌려주는 그릇(out) 안을 본다 — 딴 자리에 days 가 있다고 화면이 아는 것은 아니다 */
  assert.match(fill, /const out = \{[\s\S]{0,240}days: days/,
    '몇 년치를 판 것인지 안 돌려줍니다');
  assert.match(fill, /const out = \{[\s\S]{0,240}already: 0/,
    '이미 담아서 지나간 통수를 안 돌려줍니다 — 늘 「0통 받음」으로 보입니다');
  assert.match(fill, /old\/state['"]\)\.update\(\{[\s\S]{0,240}days: days/,
    '얼마나 깊이 채웠는지를 안 적어 둡니다');
});

test('★★ 첫 «옛 메일»에서 바로 안 멈춘다 — 번호가 늘 시간 차례는 아니다', () => {
  assert.match(fill, /oldStreak\+\+/, '옛 메일을 연달아 세지 않습니다');
  assert.match(fill, /oldStreak >= \d\d/,
    '한 통만 옛것이어도 끝으로 봅니다 — 그 뒤 몇 천 통을 놓칩니다');
});

test('★★ 한 통을 못 읽어도 «멈추지 않는다» — 만 통 가운데 하나는 늘 이상하다', () => {
  const n = (fill.match(/out\.bad = Number\(out\.bad \|\| 0\) \+ 1;\s*continue;/g) || []).length;
  assert.ok(n >= 2, '못 읽은 통에서 통째로 멈춥니다(' + n + '자리) — 받기·풀기 둘 다 걸러야 합니다');
});

/* ══════ ③ 겹치지 않게 ══════ */

test('★★ 이미 IMAP 으로 든 메일은 «안 담는다» — 안 그러면 전체메일에 두 줄로 보인다', () => {
  assert.match(fill, /mailFp\(/, '지문을 안 만듭니다');
  assert.match(fill, /if \(fps\[fp\]\) \{ out\.skip\+\+; continue; \}/, '겹친 것을 그대로 담습니다');
});

test('★★ 지문은 «푼 제목»과 «분»으로 만든다', () => {
  const fp = MS.mailFp;
  assert.equal(typeof fp, 'function', 'mailFp 를 안 내놓습니다');
  const t = Date.UTC(2026, 8, 6, 1, 2, 3);
  assert.equal(fp('A@B.KR', t, ' 안녕  하세요 '), fp('a@b.kr', t + 30000, '안녕 하세요'),
    '큰글씨·초·빈칸 때문에 같은 메일이 다른 것으로 보입니다');
  assert.notEqual(fp('a@b.kr', t, '가'), fp('a@b.kr', t, '나'), '다른 메일이 같아 보입니다');
});

test('★★ 이름표를 실시간DB 열쇠로 쓸 수 있게 턴다', () => {
  const k = MS.popKey;
  assert.equal(typeof k, 'function', 'popKey 를 안 내놓습니다');
  ['.', '$', '#', '[', ']', '/'].forEach(ch=>{
    assert.ok(k('a' + ch + 'b').indexOf(ch) < 0, ch + ' 가 그대로 남습니다 — 저장이 통째로 거부됩니다');
  });
  assert.ok(k('x'.repeat(400)).length <= 120, '열쇠가 너무 깁니다');
  assert.equal(k('AbC-123_x'), 'AbC-123_x', '멀쩡한 글자까지 바꿉니다 — 같은 메일을 또 담게 됩니다');
});

test('★ UIDL 여러 줄을 번호·이름표로 가른다', () => {
  const L = MS.popUidlList;
  const got = L('1 abc\r\n2 d.e/f\r\n쓰레기\r\n30 zz9\r\n');
  assert.equal(got.length, 3, '줄을 ' + got.length + '개로 읽었습니다');
  assert.deepEqual(got[0], { n: 1, id: 'abc' });
  assert.equal(got[2].n, 30);
});

/* ══════ ④ 문 ══════ */

test('★★ 채우기는 «대표만» 부른다 — 메일함 전체가 걸린 자리다', () => {
  assert.match(fill, /\},\s*requireAdmin\)\)/, '아무 직원이나 채우기를 돌릴 수 있습니다');
});

test('★★ 지난 메일 «열기»는 직원 누구나 — 메일함과 같은 문이어야 한다', () => {
  const rd = cut('readOldMail:', 'readMailAttachment:');
  assert.ok(!/requireAdmin/.test(rd),
    '지난 메일만 대표님께 잠깁니다 — 목록엔 보이는데 못 여는 셈이 됩니다');
});

test('★★ 큰 지난 메일은 «미리» 막는다 — POP3 는 한 통을 통째로만 준다', () => {
  const rd = cut('readOldMail:', 'readMailAttachment:');
  assert.match(rd, /LIST '\s*\+\s*hit\.n/, '크기를 먼저 안 묻습니다');
  assert.match(rd, /size > ATT_MAX/, '얼마나 크든 그냥 받습니다 — 그릇이 죽습니다');
});

test('★★ 밖으로 내보내야 올라간다 — 안 내보내면 배포부터 막힌다', () => {
  ['backfillMailbox', 'readOldMail'].forEach(n=>{
    assert.ok(idx.indexOf('exports.' + n + ' = MSYNC.' + n + ';') > 0,
      'index.js 가 ' + n + ' 을 안 내보냅니다');
  });
});

test('★★ 지난 메일은 «따로» 담는다 — 다음메일 폴더 목록을 안 건드린다', () => {
  assert.match(fill, /ROOT \+ '\/old\/msgs\/'/, '지난 메일을 폴더 자리에 섞어 넣습니다');
  /* ⚠ mailbox/folders 에 가짜 폴더를 만들면 다음 회차에 통째로 지워진다
       (runSync 가 IMAP 목록에 없는 폴더를 걷어낸다). */
  assert.ok(!/old[\s\S]{0,40}ROOT \+ '\/folders/.test(fill),
    '가짜 폴더를 만듭니다 — 다음 동기화가 그것을 지웁니다');
});
