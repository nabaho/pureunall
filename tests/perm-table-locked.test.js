/* 메뉴 권한표·구글 열쇠를 «누구나 고칠 수» 없게 잠갔다 (2026-09-21)
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-21 「권한구멍 둘」.

   ★ 무엇이 문제였나
     실시간DB 의 data 아래에 이름이 붙은 칸은 42개인데 서버에는 자리가 150개다.
     나머지는 $other 로 떨어져 «재직 직원 누구나 읽고 쓴다». 그 가운데 둘이 걸렸다:

     ① data/security_perms — isMenuPermitted() 가 보는 «진짜» 메뉴 권한표다.
        제 사번 칸에 메뉴 이름을 적어 넣으면 그 메뉴가 열린다.
        스스로 권한을 키울 수 있는 길이었다.
     ② data/setting_google_vision_api_key — 구글 열쇠가 직원 누구나 읽는 자리에 있었다.

   ★ 왜 «읽기»는 안 좁혔나 (①)
     앱이 켜질 때 이 표를 통째로 받아 제 메뉴를 고른다 — 막으면 아무에게도 메뉴가
     안 뜬다. 남의 메뉴 권한이 보이는 것은 비밀이 아니다. 쓰기만 막는다.

   ⚠ 이 검사는 «규칙 파일»을 본다. 콘솔에 실제로 올라갔는지는 rules-deploy 가 본다. */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RULES = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;
const D = RULES.data;

/* 규칙 글귀가 «무엇을 요구하는가»로 읽는다 — 글자를 통째로 못 박지 않는다
   (조건이 한 줄 늘어도 뜻이 같으면 안 깨지게). */
const 관리자요구 = (s) => /isAdmin/.test(String(s || ''));
const 위임도 = (s) => /isSubAdmin/.test(String(s || ''));
const 로그인요구 = (s) => /sign_in_provider|passkey/.test(String(s || ''));

test('①★★ 메뉴 권한표는 «아무나 못 쓴다» — 스스로 권한을 키울 수 있었다', () => {
  const r = D.security_perms;
  assert.ok(r, '★ security_perms 에 이름이 없습니다 — $other 로 떨어져 누구나 씁니다');
  assert.ok(관리자요구(r['.write']),
    '★ 쓰기가 관리자를 요구하지 않습니다 — 직원이 제 사번 칸에 메뉴를 적어 넣을 수 있습니다');
});

test('①-2★ 읽기는 «그대로 열어 둔다» — 막으면 아무에게도 메뉴가 안 뜬다', () => {
  const r = D.security_perms;
  assert.ok(로그인요구(r['.read']), '읽기에 로그인 조건이 없습니다');
  assert.ok(!관리자요구(r['.read']),
    '★ 읽기를 관리자만으로 좁혔습니다 — 앱이 켜질 때 이 표를 받아 제 메뉴를 고릅니다. '
    + '막으면 직원 화면에 메뉴가 하나도 안 뜹니다');
});

test('①-3 위임관리인도 쓸 수 있다 — 환경설정을 여는 사람과 잣대를 맞춘다', () => {
  /* ⚠ 관리자만으로 더 좁히면, 위임관리인이 환경설정 ▸ 데이터 접근을 여는 순간
     buildInitial() 이 조용히 실패한다(그 화면이 열릴 때 기본값을 쓴다).
     더 좁히려면 화면도 함께 고쳐야 한다 — 대표 판단 몫으로 남겼다. */
  assert.ok(위임도(D.security_perms['.write']),
    '위임관리인을 뺐습니다 — 환경설정을 열 때 조용히 실패합니다(화면도 함께 고쳐야 합니다)');
});

test('②★★ 구글 Vision 열쇠는 관리자만 읽는다 — 열쇠가 직원에게 보였다', () => {
  const r = D.setting_google_vision_api_key;
  assert.ok(r, '★ 이름이 없습니다 — $other 로 떨어져 직원 누구나 읽습니다');
  assert.ok(관리자요구(r['.read']), '★ 읽기가 관리자를 요구하지 않습니다 — 열쇠가 샙니다');
  assert.ok(관리자요구(r['.write']), '★ 쓰기가 관리자를 요구하지 않습니다');
});

test('②-2 그 열쇠를 «부르는 코드가 없다» — 다시 브라우저로 끌어오지 말 것', () => {
  /* 판독은 서버 대리인(readVision)이 한다. 브라우저에 열쇠를 두면 누구나 복사한다 —
     그래서 서버로 옮겼고, 이 자리는 그 시절의 찌꺼기다.
     ⚠ 다시 쓰기 시작하면 이 검사가 걸린다. 그때는 «왜 브라우저에서 부르는지»를
       먼저 답해야 한다. */
  ['pu-erp.html', 'pu-cal.html', 'kcareer.html', 'pu-photos.html', 'pu-cards.html'].forEach((f) => {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) return;
    assert.ok(fs.readFileSync(p, 'utf8').indexOf('setting_google_vision_api_key') < 0,
      '★ ' + f + ' 가 구글 열쇠를 브라우저로 끌어옵니다 — 서버 대리인(readVision)을 쓰십시오');
  });
});

test('★ 잠근 뒤에도 «이알피가 권한표를 읽는» 길은 살아 있다', () => {
  const erp = fs.readFileSync(path.join(ROOT, 'pu-erp.html'), 'utf8');
  assert.match(erp, /function isMenuPermitted\(user, menuId\)\{[\s\S]{0,400}?dbGet\('security_perms'/,
    '★ 메뉴 권한을 보는 자리가 바뀌었습니다 — 규칙도 다시 봐야 합니다');
});
