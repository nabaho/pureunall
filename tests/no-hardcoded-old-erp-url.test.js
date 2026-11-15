'use strict';
/* 옛 ERP 주소를 실행 코드에 «새로» 박지 못하게 한다 — 대표 지시 2026-11-16
   「도메인주소 변경 이후 안티그래피티 챗지피티 제미나이등 코딩에 전혀 영향 없게 잘정리 해라」
   ═══════════════════════════════════════════════════════════════════════════
   ERP 는 2026-11-15 https://erp.pureunlabor.co.kr 로 옮겼다. 옛 https://nabaho.github.io/pureunall/* 은
   GitHub 이 301 로 넘겨 «동작은 하지만», 여러 AI(Claude·Codex·Gemini)가 옛 코드를 보고 그 주소를 또 박으면
   ① 301 을 한 번 더 돌고 ② 2027-02 이후 서버가 옛 출처를 안 받게 되면 조용히 막힌다.

   ★ 래칫: 지금 남은 자리는 «파일별 상한 + 까닭»으로 묶고, 새 파일에 생기거나 상한을 넘으면 실패.
     줄어드는 것은 언제나 통과 — 줄였으면 아래 상한도 내린다.
   ★ 주석 안 글자는 세지 않는다(되풀이된 실수 2·8) — 주석은 기록이지 동작이 아니다.
     거꾸로, 주석으로 숨겨 두고 «실제 코드»에 박은 것은 센다.
   자세히: docs/규칙/ERP-주소.md · 실행: node --test tests/no-hardcoded-old-erp-url.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const 옛주소 = 'nabaho.github.io/pureunall';

/* 지금 남은 자리 — 상한과 까닭. 새 줄을 더하려면 까닭을 적고, 그 전에 상대경로·erp-origins.js 로 될지 먼저 본다. */
const 허용 = {
  'pu-cal.html': [2, 'OAuth 돌아올 주소의 «https 아닐 때» 대체값 · 이음 보기 링크 뿌리(301 로 동작 — 바꿀 때 받는 쪽 확인)'],
  'pu-erp.html': [4, 'Gmail OAuth «https 아닐 때» 대체값·리디렉션 안내 글 · 하나 문자 다리 apk 내려받기 · 이음 보기 링크 뿌리(301 로 동작)'],
  'pu-news.html': [3, '소식지 그림 주소 안내·예시 — 옛 주소 그림도 지난 회차 때문에 계속 받는다'],
  'js/pu-news-show.js': [1, '소식지 웹보기 그림 허용 목록 — 지난 회차 옛 주소 그림'],
  'js/pu-news-tpl.js': [1, '소식지 틀 그림 허용 목록 — 지난 회차 옛 주소 그림'],
  'functions/news-lib/pu-news-show.js': [1, 'js/pu-news-show.js 의 사본(sync-news-lib)'],
  'functions/news-lib/pu-news-tpl.js': [1, 'js/pu-news-tpl.js 의 사본(sync-news-lib)'],
  'functions/mail-send.js': [1, '발송기 그림 허용 목록(IMG_HOST_OK) — 지난 회차 옛 주소 그림'],
};

/* 주석 걷기 — html 은 <!-- --> 도. `https://` 의 빗금은 앞이 콜론이라 안 걷힌다. */
function 알맹이(s, html) {
  if (html) s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/\/\*[\s\S]*?\*\//g, ' ');
  s = s.replace(/(^|[^:"'\\`])\/\/[^\n]*/g, '$1 ');
  return s;
}
function 세기(s) { return s.split(옛주소).length - 1; }

function 대상들() {
  const out = [];
  for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.html')) out.push(f);
  for (const f of fs.readdirSync(path.join(ROOT, 'js'))) if (f.endsWith('.js')) out.push('js/' + f);
  (function 훑기(d) {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const p = d + '/' + e.name;
      if (e.isDirectory()) 훑기(p);
      else if (e.name.endsWith('.js') && !e.name.endsWith('.test.js')) out.push(p);
    }
  })('functions');
  return out;
}

function 지금개수() {
  const 수 = {};
  for (const f of 대상들()) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    if (s.indexOf(옛주소) < 0) continue;
    const n = 세기(알맹이(s, f.endsWith('.html')));
    if (n) 수[f] = n;
  }
  return 수;
}

test('주석 걷기가 «주석만» 걷는다 — 코드 속 주소는 남고 주석 속 주소는 사라진다', () => {
  const 코드 = "var a = 'https://" + 옛주소 + "/x.html'; // https://" + 옛주소 + "/y\n/* " + 옛주소 + " */";
  assert.equal(세기(알맹이(코드, false)), 1, '코드 속 주소 하나만 남아야 한다');
  const html = '<a href="https://' + 옛주소 + '/a">x</a><!-- ' + 옛주소 + ' -->';
  assert.equal(세기(알맹이(html, true)), 1, 'html 주석은 걷고 링크는 남아야 한다');
});

test('훑는 범위가 비어 있지 않다(없으면 아래 검사가 아무것도 안 지킨다)', () => {
  const t = 대상들();
  assert.ok(t.filter((f) => f.endsWith('.html')).length >= 10, '뿌리 html 을 못 찾았다');
  assert.ok(t.some((f) => f.startsWith('functions/')), 'functions 를 못 훑었다');
  assert.ok(t.includes('functions/erp-origins.js'), '★ 주소 한 자리(erp-origins.js)가 없다');
});

test('★★ 옛 ERP 주소를 실행 코드에 새로 박지 않는다 — 허용 목록 밖에 생기거나 상한을 넘으면 실패', () => {
  const 수 = 지금개수();
  const 넘침 = [];
  for (const [f, n] of Object.entries(수)) {
    const 한 = 허용[f] ? 허용[f][0] : 0;
    if (n > 한) 넘침.push(f + ' ' + n + '곳(상한 ' + 한 + ')');
  }
  assert.deepEqual(넘침, [],
    '★★ 옛 주소(nabaho.github.io/pureunall)가 새로 박혔습니다: ' + 넘침.join(' · ')
    + ' — 화면은 상대경로, 서버는 functions/erp-origins.js 의 ERP_LINK_BASE·ERP_ORIGINS·PUBLIC_HOME 을 쓰세요(docs/규칙/ERP-주소.md)');
});

test('허용 목록의 까닭이 비어 있지 않다 — 왜 남겼는지 모르면 언제 지울지도 모른다', () => {
  for (const [f, [n, 왜]] of Object.entries(허용)) {
    assert.ok(Number.isInteger(n) && n >= 1, f + ' 상한이 이상하다');
    assert.ok(String(왜 || '').length >= 10, f + ' 에 남긴 까닭이 없다');
  }
});

test('내보내는 링크의 한 자리는 새 주소다', () => {
  const s = fs.readFileSync(path.join(ROOT, 'functions', 'erp-origins.js'), 'utf8');
  assert.match(알맹이(s, false), /ERP_LINK_BASE/, 'ERP_LINK_BASE 가 없다');
  assert.match(알맹이(s, false), /https:\/\/erp\.pureunlabor\.co\.kr/, '새 주소가 한 자리에 없다');
});
