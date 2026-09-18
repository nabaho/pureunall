'use strict';
/* 🚫 스팸신고 — 다음메일 상단과 같은 단추를 놓는다 (대표 지시 2026-09-18)
   「다음메일 상단과 같은 내용을 넣어 줄 수 있나」(캡처: 삭제·스팸신고·전달·이동˅·
   읽음표시˅·통수·새로고침)

   대표 확인(AskUserQuestion) — 통수 표시(10/42319)는 «다시 안 넣는다»(2026-08-30에
   빼기로 한 결정 유지), 스팸신고 단추는 «만든다».

   지키는 것.
   ① 스팸신고 단추가 실제로 있고, 「우리가 낸 칸」에서는 안 보인다
   ② 우리 자체 거르개(mbIsSpam)와는 «다른 길»이다 — 서버에 실제로 신고한다
   ③ 「우리가 낸 칸」의 메일은 신고 대상에서 걸러낸다(서버도 같은 잣대로 막는다)
   ④ 지난 메일(POP3 전용)은 막는다
   ⑤ 확인창을 띄운다 — 되돌리기 어려운 일이다
   ⑥ 성공하면 화면에서 즉시 지운다 — 신고했는데 화면에 남으면 안 된다
   ⑦ 서버는 스팸함 자리를 «그 자리에서» 찾는다 — data/folders 캐시로는 못 찾는다
      (스팸함은 syncMailbox 가 일부러 안 가져오는 칸이다) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sliceFn } = require('./fnslice.js');

const ROOT = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');
const raw = fs.readFileSync(path.join(ROOT, 'functions', 'mail-sync.js'), 'utf8').replace(/\r\n/g, '\n');
const idxSrc = fs.readFileSync(path.join(ROOT, 'functions', 'index.js'), 'utf8').replace(/\r\n/g, '\n');
/* ⚠ 주석을 걷고 본다 — 잘 쓴 «설명»이 검사를 통과시키면 안 된다 */
const src = raw.replace(/\/\*[\s\S]*?\*\//g, ' ');

function code(t){
  return t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/* ══════════════════════════════════════════════
   ① 클라이언트 — 단추가 있고, 「우리가 낸 칸」에서는 안 보인다
   ══════════════════════════════════════════════ */
test('★★★ 「스팸신고」 단추가 목록 위에 있다', () => {
  const toolbar = code(sliceFn(app, 'function mbListHtml('));
  assert.match(toolbar, /onclick="mbSpamReport\(\)"/, '단추가 없습니다');
  assert.match(toolbar, /스팸신고/, '글자가 「스팸신고」가 아닙니다 — 다음메일과 다른 말을 씁니다');
});

test('★★ 「우리가 낸 칸」(보낸메일함 등)에서는 단추가 안 보인다', () => {
  /* ⚠ 우리가 쓴 메일을 신고할 일이 없다 — 서버도 거절하므로 화면에서부터 안 보여야
       「눌렀는데 오류가 난다」가 안 생긴다. */
  const toolbar = sliceFn(app, 'function mbListHtml(');
  const i = toolbar.indexOf('onclick="mbSpamReport()"');
  const before = toolbar.slice(Math.max(0, i - 200), i);
  assert.match(before, /mbSentBox\(\)\s*\?\s*''/, '보낸 칸 가림이 스팸신고 단추 앞에 없습니다');
});

/* ══════════════════════════════════════════════
   ② 우리 자체 거르개와는 다른 길이다
   ══════════════════════════════════════════════ */
test('★★★ mbSpamReport 는 «다른 함수»다 — mbIsSpam(자체 거르개)을 부르지 않는다', () => {
  const fn = code(sliceFn(app, 'function mbSpamReport('));
  assert.doesNotMatch(fn, /mbIsSpam\(|mbNotSpam\(/,
    '우리 화면에서만 숨기는 자체 거르개와 뒤섞였습니다 — 서버에 신고하는 다른 일입니다');
  assert.match(fn, /MB_FN\s*\+\s*'reportMailSpam'/, '전용 서버 길을 안 부릅니다');
  assert.doesNotMatch(fn, /moveMailMessages/, '휴지통·분류가 쓰는 길로 잘못 보냅니다');
});

/* ══════════════════════════════════════════════
   ③ 「우리가 낸 칸」의 메일은 신고 대상에서 걸러낸다
   ══════════════════════════════════════════════ */
test('★★★ 고른 것에 «우리가 낸 칸» 메일이 섞여 있으면 걸러내고 알린다', () => {
  const fn = code(sliceFn(app, 'function mbSpamReport('));
  assert.match(fn, /MB_SENT_KINDS\[f\.kind\]/, '보낸 칸 메일을 안 거릅니다');
  assert.match(fn, /skipped/, '몇 통을 뺐는지 알리지 않습니다');
  assert.match(fn, /picked\.length\s*\?\s*''\s*:.*스팸으로 신고할 수 없습니다|우리가 보낸 메일은 스팸으로 신고할 수 없습니다/,
    '다 걸러졌을 때 아무 말 없이 지나갑니다');
});

/* ══════════════════════════════════════════════
   ④ 지난 메일은 막는다
   ══════════════════════════════════════════════ */
test('★★ 지난 메일(POP3 전용)은 신고할 수 없다 — 우리가 손댈 자리가 없다', () => {
  const fn = code(sliceFn(app, 'function mbSpamReport('));
  assert.match(fn, /mbOldBlock\(/, '지난 메일을 막지 않습니다');
});

/* ══════════════════════════════════════════════
   ⑤ 확인창을 띄운다
   ══════════════════════════════════════════════ */
test('★★★ 신고 전에 확인창을 띄운다 — 되돌리려면 다음메일 스팸함에서 직접 꺼내야 한다', () => {
  const fn = code(sliceFn(app, 'function mbSpamReport('));
  assert.match(fn, /\bconfirm\(/, '확인창이 없습니다');
  assert.match(fn, /스팸함으로 실제로 옮겨집니다|되돌리|직접 꺼내야/,
    '되돌리기 어렵다는 것을 안 알립니다 — 눌러 보고서야 압니다');
});

/* ══════════════════════════════════════════════
   ⑥ 성공하면 화면에서 즉시 지운다
   ══════════════════════════════════════════════ */
test('★★ 신고에 성공하면 그 줄을 화면에서 바로 지운다', () => {
  const fn = code(sliceFn(app, 'function mbSpamReport('));
  const i = fn.indexOf('.then(res=>{');
  assert.ok(i > 0, '성공 처리 자리를 못 찾았습니다');
  const after = fn.slice(i);
  assert.match(after, /delete _mbMsgs\[v\._slug\]\[String\(v\.u\)\]/, '지운 줄을 화면에서 안 뺍니다');
  assert.match(after, /renderMailPage\(\)/, '화면을 다시 안 그립니다');
});

test('★ 실패하면 실패했다고 알린다 — 조용히 넘어가면 신고된 줄 안다', () => {
  const fn = code(sliceFn(app, 'function mbSpamReport('));
  assert.match(fn, /\.catch\(e=>toast\(/, '실패를 알리지 않습니다');
});

/* ══════════════════════════════════════════════
   ⑦ 서버 — 스팸함을 그 자리에서 찾는다
   ══════════════════════════════════════════════ */
function serverFn(){
  const i = src.indexOf('reportMailSpam: F');
  assert.ok(i > 0, '★ 서버 함수(reportMailSpam)가 없습니다');
  return src.slice(i, src.indexOf('POP3 로 「몇 통이 있는지」만'));
}

test('★★★ 서버는 스팸함 자리를 «그 자리에서» client.list() 로 찾는다', () => {
  /* ⚠ 스팸함은 syncMailbox 가 일부러 안 가져오는 칸이라(SKIP_KINDS) data/folders 에
       없다 — folderPath(캐시)로 찾으면 404 로 늘 실패한다. */
  const b = serverFn();
  assert.match(b, /client\.list\(\)/, '실시간으로 스팸함을 찾지 않습니다');
  assert.match(b, /folderKind\(x\)\s*===\s*'spam'/, '스팸 칸을 못 가립니다');
  assert.doesNotMatch(b, /folderPath\(deps,\s*['"`]spam['"`]\)|folderPath\(deps,\s*to\)/,
    '캐시(folderPath)로 스팸함을 찾습니다 — 등록돼 있지 않아 늘 404 입니다');
});

test('★★ 「우리가 낸 칸」에서는 서버도 거절한다', () => {
  const b = serverFn();
  assert.match(b, /\[.*'sent'.*'drafts'.*'tome'.*'sched'.*\]\.indexOf\(kind\)\s*>=\s*0/,
    '보낸 칸 등을 서버가 안 막습니다 — 화면 검사를 우회하면 뚫립니다');
});

test('★★ 한 번에 200통까지만 — 다른 옮기기 함수와 같은 한도다', () => {
  const b = serverFn();
  assert.match(b, /uids\.length\s*>\s*200/, '한도가 없습니다');
});

test('★★★ 성공한 뒤 우리 실시간DB 에서도 지운다 — 안 지우면 신고했는데 화면에 남는다', () => {
  const b = serverFn();
  const i = b.indexOf('messageMove');
  const after = b.slice(i);
  assert.match(after, /ROOT \+ '\/msgs\/' \+ from \+ '\/' \+ u\] = null/, '우리 DB에서 안 지웁니다');
});

test('★ DELE 를 부르지 않는다 — POP3 규칙과 같은 잣대다', () => {
  assert.doesNotMatch(serverFn(), /\bDELE\b/, '메일을 영영 지우는 명령을 씁니다');
});

/* ══════════════════════════════════════════════
   ⑧ 이어 붙임 — index.js 가 내보내고, 클라이언트가 그 이름을 정확히 부른다
   ══════════════════════════════════════════════ */
test('★★ index.js 가 reportMailSpam 을 내보낸다 — 안 하면 함수 자체가 안 뜬다', () => {
  assert.match(idxSrc, /exports\.reportMailSpam\s*=\s*MSYNC\.reportMailSpam/,
    'index.js 에서 내보내지 않습니다');
});

test('★ 클라이언트와 서버가 같은 이름을 쓴다', () => {
  assert.match(app, /MB_FN\+'reportMailSpam'/, '클라이언트가 부르는 이름이 다릅니다');
});
