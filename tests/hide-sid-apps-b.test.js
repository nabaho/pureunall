'use strict';
/* 🙈 사번·로그인 이메일을 «보이는 글자»로 안 적는다 — 기금·규정·문서관리·정부지원·전광판 등 «둘째 묶음» 화면
   (대표 결정 2026-10-25 「이름만 있어야한다」 — 앞선 tests/sid-never-shown.test.js 의 모양 검사가 못 잡는 «자리» 를 지킨다)

   ■ 못 박는 규칙 (값이 아니라 규칙)
     ① 잠금 화면(다시 로그인을 요구하는 카드)에 로그인 이메일·uid 를 적지 않는다.
     ② 서명 요청서의 요청자(byName)는 «이름» — 이메일 앞부분(p001)을 저장하지 않는다.
        (서명 확인서 PDF 의 「요청」 줄로 서명하는 바깥 사람에게도 나간다)
     ③ 저장하는 「올린 사람」·「담당」 이름 자리에 이메일·사번을 대신 넣지 않는다.
     ④ 머리줄 이름 칸을 이메일·아이디로 «잠깐이라도» 채우지 않는다.
   ⚠ 저장값(by·owner·ownerSid 처럼 «기록용» 이메일/uid)은 이 검사 밖이다 — 화면에 안 나가면 그대로 둔다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const code = (f) => stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));

function hits(file, re) {
  const out = [];
  code(file).split('\n').forEach((line, i) => {
    re.lastIndex = 0;
    if (re.test(line)) out.push(file + ':' + (i + 1) + ' ' + line.trim().slice(0, 120));
  });
  return out;
}

test('①★ 잠금 화면에 로그인 이메일·uid 를 적지 않는다', () => {
  const bad = [];
  ['gov.html', 'pu-govaid.html', 'pu-signboard.html', 'rehab-ad.html'].forEach((f) => {
    /* lock(...) · applyLock(...) · why:'…' 안에 u.email / u.uid 가 들어가는 모양 */
    bad.push(...hits(f, /(?:\block|\bapplyLock|\bwhy)\b[^;\n]*\bu\.(?:email|uid)\b/));
    bad.push(...hits(f, /['"]접속:\s*['"]\s*\+\s*\(?\s*u\.(?:email|uid)/));
  });
  assert.deepEqual(bad, [], '★ 잠금 화면에 이메일·uid 가 보인다 — 이름만 적고, 이름을 모르면 그 줄을 뺀다:\n' + bad.join('\n'));
});

test('②★ 서명 요청서의 요청자 이름(byName)은 이메일 앞부분이 아니다', () => {
  const bad = hits('docs-esign.html', /byName\s*=\s*[^;\n]*email/);
  assert.deepEqual(bad, [], '★ 요청자 이름에 이메일 앞부분을 저장한다:\n' + bad.join('\n'));
  /* 이름을 어디서 얻는지 — 공용 부품(PuWhoami) 한 곳 */
  assert.match(code('docs-esign.html'), /function meName\(\)[^\n]*PuWhoami/, '이름 찾는 길(meName)이 PuWhoami 를 거치지 않는다');
});

test('②★ 옛 서명 요청(byName 에 p001 이 저장된 것)은 확인서에 나가기 전에 비운다', () => {
  const src = code('docs-esign.html');
  const list = src.slice(src.indexOf('function formSignList'), src.indexOf('function formSignVoid'));
  assert.ok(list.length > 50, 'formSignList 를 못 찾았다');
  assert.match(list, /r\.byName\s*=\s*''/, '사번·이메일 꼴 byName 을 비우지 않는다');
});

test('③★ 문서관리·규정·취업규칙 작성기: 이름 자리에 이메일·이메일 앞부분을 대신 넣지 않는다', () => {
  const bad = [];
  /* PuOfficeStore.init · PuPhotoStore.signIn · mergePlan 에 넘기는 name */
  bad.push(...hits('docs-esign.html', /\bname\s*:\s*[^,}\n]*email[^,}\n]*split\('@'\)/));
  bad.push(...hits('docs-esign.html', /signIn\([^)\n]*split\('@'\)/));
  /* rules.html 의 myName · chwieop.html 의 chwWho — 이름이 없으면 빈 글자 */
  bad.push(...hits('rules.html', /const myName\s*=[^\n]*\.email/));
  bad.push(...hits('rules.html', /savedBy\s*:[^\n]*\.email/));
  bad.push(...hits('rules.html', /ownerName\s*\|\|\s*[A-Za-z_.]*owner\b(?!Name|Uid)/));
  bad.push(...hits('chwieop.html', /function chwWho\(\)[^\n]*\.email/));
  assert.deepEqual(bad, [], '★ 이름 자리에 이메일이 들어간다:\n' + bad.join('\n'));
});

test('③★ 기금관리: 재직자 이름이 없을 때 사번을 이름 자리에 넣지 않는다', () => {
  const bad = hits('fund.html', /name\s*:\s*u\.name\s*\|\|\s*u\.sid\b/);
  assert.deepEqual(bad, [], '★ 이름 || 사번:\n' + bad.join('\n'));
  /* 푸른이알피 담당 표시 mgrN — 이름을 못 찾았을 때 사번을 그대로 돌려주지 않는다 */
  const bad2 = hits('fund.html', /esc\(\s*me\s*\?\s*me\.name\s*:\s*sid\s*\)/);
  assert.deepEqual(bad2, [], '★ 담당 이름을 못 찾으면 사번이 보인다:\n' + bad2.join('\n'));
});

test('③★ 정부지원금: 검토·확정한 사람은 사번이 아니라 이름으로 보인다', () => {
  const src = code('pu-govaid.html');
  assert.match(src, /function nameOf\(/, '사번 → 이름 도우미가 없다');
  const bad = hits('pu-govaid.html', /esc\(\s*(?:r|p|st|p\.closure)\.(?:by|confirmedBy)\s*\)/);
  assert.deepEqual(bad, [], '★ by/confirmedBy(사번)를 그대로 화면에 찍는다:\n' + bad.join('\n'));
});

test('④★ 머리줄 이름 칸(whoami)을 이메일·이메일 앞부분으로 채우지 않는다', () => {
  const bad = [];
  ['docs-esign.html', 'pu-news.html'].forEach((f) => {
    bad.push(...hits(f, /\$\('whoami'\)\.textContent\s*=\s*[^;\n]*(?:\.email|split\('@'\))/));
  });
  assert.deepEqual(bad, [], '★ 머리줄에 이메일이 보인다:\n' + bad.join('\n'));
});

test('④★ 카메라·리멤버·클리닉: 이름을 못 찾았을 때 이메일을 대신 적지 않는다', () => {
  const bad = [];
  bad.push(...hits('pu-camera.html', /byName\s*:[^\n]*\.email/));
  bad.push(...hits('pu-camera.html', /\$\('who'\)\.textContent\s*=[^\n]*\.email/));
  bad.push(...hits('remember-intake.html', /byName\s*:[^\n]*\.email/));
  bad.push(...hits('clinic-intake.html', /\bby\s*:[^\n]*\.email/));
  assert.deepEqual(bad, [], '★ 이름 자리에 이메일이 들어간다:\n' + bad.join('\n'));
});

test('(이빨) 위 찾개는 실제로 잡는다 — 못 잡으면 초록이 거짓이다', () => {
  const t = (re, s) => { re.lastIndex = 0; return re.test(s); };
  assert.ok(t(/(?:\block|\bapplyLock|\bwhy)\b[^;\n]*\bu\.(?:email|uid)\b/, "return {ok:false, why:'접속: '+(u.email||'-')+' · uid '+u.uid};"));
  assert.ok(t(/(?:\block|\bapplyLock|\bwhy)\b[^;\n]*\bu\.(?:email|uid)\b/, "lock('접속: '+(u.email||'-'));"));
  assert.ok(t(/byName\s*=\s*[^;\n]*email/, "req.byName = String(curUser.email || '').split('@')[0];"));
  assert.ok(t(/const myName\s*=[^\n]*\.email/, 'const myName=()=>(FBUSER&&(FBNAME||FBUSER.displayName||FBUSER.email))||"";'));
  assert.ok(t(/name\s*:\s*u\.name\s*\|\|\s*u\.sid\b/, "{sid:u.sid,name:u.name||u.sid,title:''}"));
  assert.ok(!t(/(?:\block|\bapplyLock|\bwhy)\b[^;\n]*\bu\.(?:email|uid)\b/, "lock((nm?'접속: '+nm+' — ':'')+'이 계정으로는 열 수 없습니다');"));
  assert.ok(!t(/byName\s*=\s*[^;\n]*email/, 'req.byName = meName();'));
});
