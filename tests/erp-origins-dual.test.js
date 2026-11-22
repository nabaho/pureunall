'use strict';
/* ERP 주소 이사 — 서버 함수가 옛·새 두 출처를 받는다 (대표 지시 2026-11-15 「모두 옮겨달라」)
   ═══════════════════════════════════════════════════════════════════════════
   GitHub Pages 에서 도메인(erp.pureunlabor.co.kr)을 켜는 «순간» 옛 주소(nabaho.github.io/pureunall)는
   301 로 넘어간다 — 두 주소를 함께 띄워 두는 기간이 없다. 그래서 서버가 «먼저» 둘 다 받아 둔다.
   전에는 함수 7곳이 `origin === "https://nabaho.github.io"` 처럼 값 «하나»와만 견줬다.

   못 박는 것(규칙)
   ① 받아 주는 출처는 functions/erp-origins.js «한 자리» — 함수 파일마다 출처를 따로 박지 않는다.
   ② 옛·새 두 출처는 «그 값 그대로» 되돌려 주고 Vary: Origin. localhost(개발)는 전처럼.
   ③ 목록 밖(남의 도메인·http·꼬리 붙인 가짜·null·*)은 안 연다. 와일드카드 금지.
   ④ 소식지 그림 «우리 집» 목록 넷(발송기·편지짓개·쇼 화면·쇼 CSP)이 새 출처를 함께 담고 서로 같다.
   실행: node --test tests/erp-origins-dual.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = path.join(__dirname, '..');
const F = path.join(R, 'functions');
const O = require(path.join(F, 'erp-origins.js'));

/* 주석을 걷는다 — 주석에 적힌 글자로 검사가 통과하면 아무것도 안 지킨다(되풀이된 실수 2) */
function 알맹이(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'])\/\/[^\n]*/g, '$1 ');
}
function 연다(origin) {
  const h = {};
  O.allowOrigin({ headers: origin == null ? {} : { origin } }, { set: (k, v) => { h[k] = v; } });
  return h;
}

test('① 옛·새 두 ERP 출처가 목록에 있고, 옛 출처가 0번이다(state 번호가 이 순서를 쓴다)', () => {
  /* 검사고정-허용: 두 출처 값 자체가 이번 이사의 규칙이다(옛 주소를 지우면 이미 나간 링크·설치된 옛 앱이 끊기고,
     새 주소를 빼면 도메인을 켜는 순간 ERP 가 서버를 못 부른다). 0번이 옛 출처인 것은 이 배포 전 state 의 기본값이다. */
  assert.equal(O.ERP_ORIGINS[0], 'https://nabaho.github.io'); // 검사고정-허용: 옛 출처 = 0번(옛 꼴 state 의 기본)
  assert.ok(O.ERP_ORIGINS.indexOf('https://erp.pureunlabor.co.kr') > 0, '★★ 새 ERP 출처가 없다 — 도메인을 켜는 순간 서버가 막힌다'); // 검사고정-허용: 이사할 주소
  O.ERP_ORIGINS.forEach((o) => assert.match(o, /^https:\/\/[a-z0-9.-]+$/, '출처 모양이 아니다(끝 빗금·경로 금지): ' + o));
  assert.ok(Object.isFrozen(O.ERP_ORIGINS), '목록을 실행 중에 늘릴 수 있다');
});

test('② 두 출처는 «그 값 그대로» 되돌려 주고 Vary 를 단다 · 개발용 localhost 도 받는다', () => {
  O.ERP_ORIGINS.concat(['http://localhost:5173', 'http://127.0.0.1:8080']).forEach((o) => {
    const h = 연다(o);
    assert.equal(h['Access-Control-Allow-Origin'], o, '★★ ' + o + ' 를 안 받는다');
    assert.equal(h['Vary'], 'Origin', '★ Vary 가 없으면 한 출처의 답이 다른 출처에 캐시돼 섞인다');
  });
});

test('③ 목록 밖은 안 연다 — 남의 도메인·http·꼬리 붙인 가짜·null·*·빈 값', () => {
  ['https://evil.example', 'http://nabaho.github.io', 'http://erp.pureunlabor.co.kr',
    'https://nabaho.github.io.evil.example', 'https://erp.pureunlabor.co.kr.evil.example',
    'https://evil-erp.pureunlabor.co.kr', 'https://pureunlabor.co.kr', 'null', '*', '', undefined,
    'https://localhost', 'http://localhost.evil.example'].forEach((o) => {
    const h = 연다(o);
    assert.equal(h['Access-Control-Allow-Origin'], undefined, '★★ 남의 출처(' + o + ')에 문을 열었다');
  });
});

test('① 함수 파일에 출처를 따로 박아 견주는 곳이 «없다» — 7곳 모두 공용 목록을 쓴다', () => {
  const 파일들 = fs.readdirSync(F).filter((n) => n.endsWith('.js'));
  const 박은곳 = [];
  파일들.forEach((n) => {
    const s = 알맹이(fs.readFileSync(path.join(F, n), 'utf8'));
    if (/origin\s*===\s*["'`]https?:/.test(s) || /origin\s*===\s*(ORIGIN|MAIL_ORIGIN|PORTAL_ORIGIN)\b/.test(s)) 박은곳.push(n);
    if (/Access-Control-Allow-Origin["']\s*,\s*["'`]\*/.test(s)) 박은곳.push(n + '(와일드카드)');
  });
  assert.deepEqual(박은곳, [], '★★ 출처를 따로 박아 견주는 함수가 있다 — 새 출처에서 막힌다: ' + 박은곳.join(', '));
  /* 쓰는 쪽 — 7곳이 실제로 공용 목록을 부른다(이름이 바뀌어 조용히 빠지지 않게) */
  const 쓰는곳 = { 'index.js': 2, 'kakao.js': 1, 'passkey.js': 1, 'gcal-link.js': 1, 'gcal-proxy.js': 1, 'gcal-eum.js': 1 };
  Object.keys(쓰는곳).forEach((n) => {
    const s = 알맹이(fs.readFileSync(path.join(F, n), 'utf8'));
    const 수 = (s.match(/allowOrigin\(req, res\)/g) || []).length;
    assert.ok(수 >= 쓰는곳[n], '★★ ' + n + ' 가 공용 출처 목록을 ' + 쓰는곳[n] + '번 써야 하는데 ' + 수 + '번이다');
  });
});

test('④ 소식지 그림 «우리 집» 목록 넷이 새 출처를 담고 서로 같다(남의 도메인은 없다)', () => {
  const 목록 = (s, re) => { const m = re.exec(s); assert.ok(m, '목록을 못 찾았다: ' + re); return m[1]; };
  const 주소들 = (txt) => [...txt.matchAll(/https:\/\/[a-z0-9.-]+/g)].map((m) => m[0]);
  const 발송기 = 주소들(목록(fs.readFileSync(path.join(F, 'mail-send.js'), 'utf8'), /const IMG_HOST_OK = \[([^\]]+)\]/));
  const 짓개 = 주소들(목록(fs.readFileSync(path.join(R, 'js', 'pu-news-tpl.js'), 'utf8'), /var 그림집 = \[([^\]]+)\]/));
  const 쇼 = 주소들(목록(fs.readFileSync(path.join(R, 'js', 'pu-news-show.js'), 'utf8'), /var 우리주소들 = \[([^\]]+)\]/));
  const csp = 주소들(목록(fs.readFileSync(path.join(F, 'news-view.js'), 'utf8'), /img-src ([^;]+);/));
  const 정렬 = (a) => [...new Set(a)].sort();
  assert.deepEqual(정렬(짓개), 정렬(발송기), '★ 편지짓개와 발송기가 다르다 — 우리 그림이 메일에서만 사라지거나 추적이 안 찍힌다');
  assert.deepEqual(정렬(쇼), 정렬(발송기), '★ 쇼 화면과 발송기가 다르다');
  assert.deepEqual(정렬(csp), 정렬(발송기), '★ 쇼 CSP 와 발송기가 다르다 — 301 로 넘어간 그림이 깨진다');
  O.ERP_ORIGINS.forEach((o) => assert.ok(발송기.indexOf(o) >= 0, '★★ ' + o + ' 그림을 발송기가 말없이 지운다'));
  발송기.forEach((h) => assert.ok(O.isErpOrigin(h) || /\.cloudfunctions\.net$/.test(h),
    '★★ «우리 집» 목록에 남의 도메인이 끼었다 — 열람 추적이 뚫린다: ' + h));
});

test('④ 함수 폴더의 소식지 사본(news-lib)이 원본(js/)과 같다 — sync-news-lib 를 돌렸는가', () => {
  ['pu-news-tpl.js', 'pu-news-show.js'].forEach((n) => {
    assert.equal(fs.readFileSync(path.join(F, 'news-lib', n), 'utf8'), fs.readFileSync(path.join(R, 'js', n), 'utf8'),
      '★ functions/news-lib/' + n + ' 가 원본과 다르다 — node scripts/sync-news-lib.js');
  });
});
