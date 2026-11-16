'use strict';
/* ERP 이사 마무리 — 사람에게 «내보내는» 링크는 새 주소다 (2026-11-15 대표 지시 「모두 옮겨라」)
 * ═══════════════════════════════════════════════════════════════════════════
 * ERP 는 2026-11-15 23:03 KST 에 새 출처로 옮겼다(functions/erp-origins.js ERP_NEW).
 * 서버가 «받아 주는» 출처 목록에는 옛 출처가 한동안 남지만(이미 나간 링크·옛 탭),
 * 서버가 메일·문자·뉴스레터로 «내보내는» 링크는 언제나 새 주소여야 한다 —
 *   ① 옛 주소로 내보내면 301 을 한 번 더 돌고,
 *   ② 옛 출처를 목록에서 뺀 뒤에는 그 링크가 남의 주소처럼 보이게 된다.
 * 바깥 사람(뉴스레터 받는 분)에게 «홈»으로 보내는 링크는 ERP 로그인 문이 아니라 공개 홈페이지다.
 *
 * ★ 값을 박지 않는다 — 새 주소는 erp-origins.js 한 자리에서 읽는다. 옛 주소만은 «쓰면 안 되는 곳»이라
 *   규칙 그 자체다(아래 OLD — 검사고정-허용: 접은 옛 주소를 못 쓰게 막는 것이 규칙이다).
 * 실행: node --test tests/erp-move-finish.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = path.join(__dirname, '..');
const EO = require('../functions/erp-origins.js');
const OLD_PREFIX = EO.ERP_OLD + '/pureunall/';   // 검사고정-허용: 내보내면 안 되는 옛 ERP 주소 머리(규칙)

/* 주석을 걷는다 — 주석에 적힌 옛 주소는 내보내는 링크가 아니다 */
function 알맹이(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

test('내보내는 링크의 뿌리는 새 출처 그대로이고, 공개 홈은 ERP 출처가 아니다', () => {
  assert.equal(EO.ERP_LINK_BASE, EO.ERP_NEW, '★★ 내보내는 링크의 뿌리가 새 출처가 아니다: ' + EO.ERP_LINK_BASE);
  assert.ok(EO.ERP_ORIGINS.indexOf(EO.ERP_NEW) >= 0, '★ 새 출처가 받아 주는 목록에 없다');
  assert.match(EO.ERP_LINK_BASE, /^https:\/\/[a-z0-9.-]+$/i, '★ 뿌리는 https 주소 하나(경로 앞머리 없음)여야 한다');
  assert.match(EO.PUBLIC_HOME, /^https:\/\/[a-z0-9.-]+\/$/i, '★ 공개 홈은 https 뿌리 주소여야 한다');
  const 홈출처 = new URL(EO.PUBLIC_HOME).origin;
  assert.ok(EO.ERP_ORIGINS.indexOf(홈출처) < 0, '★★ 바깥 사람의 «홈»이 ERP 로그인 출처다: ' + 홈출처);
});

test('★★ 컨설턴트 모집 알림 메일(돌려 봄)이 새 주소로 링크를 건다', () => {
  const RD = require('../functions/recruit-digest.js');
  const 메일 = RD.build({ today: '2026-11-16', hits: [{ title: '시험 공고', boardName: '시험 게시판', date: '2026-11-15', href: 'https://example.org/a' }] });
  assert.ok(메일, '메일이 지어지지 않았다');
  const 기대 = EO.ERP_LINK_BASE + '/gov.html';
  assert.ok(메일.body.indexOf(기대) >= 0 && 메일.html.indexOf(기대) >= 0, '★★ 메일에 새 주소 정부사업 화면 링크가 없다');
  assert.ok((메일.body + 메일.html).indexOf(OLD_PREFIX) < 0, '★★ 메일이 옛 ERP 주소로 링크를 건다');
});

test('★★ 금요일 뉴스레터 검토 메일(돌려 봄)이 새 주소로 관리 화면을 건다', () => {
  const NF = require('../functions/news-friday.js');
  const 메일 = NF.검토메일짓기({ 회차: { 이름: '2026년 11월 3주' }, 열쇠: '2026-11-w3',
    보낼날: '2026-11-16', 확정본됨: false, 자동발송켜짐: true, 받는수: 10,
    실림: { 표: {} }, 알림들: [], 편지서식: '' });
  const 모두 = JSON.stringify(메일);
  assert.ok(모두.indexOf(EO.ERP_LINK_BASE + '/pu-news.html') >= 0, '★★ 검토 메일에 새 주소 관리 화면 링크가 없다');
  assert.ok(모두.indexOf(OLD_PREFIX) < 0, '★★ 검토 메일이 옛 ERP 주소로 링크를 건다');
});

test('★★ 뉴스레터 링크가 «모르는 번호»일 때 공개 홈으로 보낸다 — 옛 ERP 문이 아니다', () => {
  const src = fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8');
  const 시작 = src.indexOf('exports.newsClick');
  assert.ok(시작 > 0, 'newsClick 을 못 찾았다');
  const 끝 = src.indexOf('exports.', 시작 + 20);
  const 몸 = 알맹이(src.slice(시작, 끝 > 시작 ? 끝 : undefined));
  const m = /res\.redirect\(\s*302\s*,\s*갈곳\s*\|\|\s*([^)]+)\)/.exec(몸);
  assert.ok(m, '★ 모르는 번호일 때 보내는 자리를 못 찾았다');
  assert.equal(m[1].trim(), 'ERP_ORIGINS_LIB.PUBLIC_HOME', '★★ 모르는 번호일 때 공개 홈(PUBLIC_HOME)이 아닌 곳으로 보낸다: ' + m[1]);
  assert.ok(몸.indexOf(EO.ERP_OLD) < 0, '★★ newsClick 안에 옛 ERP 출처가 글자로 남아 있다');
});

test('★★ 서버 코드가 옛 ERP 주소로 «내보내는» 링크를 새로 만들지 않는다 (받는 목록은 예외)', () => {
  /* 옛 주소 글자가 남아도 되는 곳 — 지난 회차 편지의 그림을 «받아 주는» 허용 목록뿐이다(내보내는 링크 아님) */
  const 받는목록 = new Set(['mail-send.js', 'news-view.js', 'news-lib/pu-news-tpl.js', 'news-lib/pu-news-show.js']);
  const 걸린 = [];
  (function 훑기(dir, 앞) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
      if (e.name === 'node_modules' || e.name.startsWith('.')) return;
      const p = path.join(dir, e.name), 이름 = 앞 + e.name;
      if (e.isDirectory()) return 훑기(p, 이름 + '/');
      if (!/\.js$/.test(e.name) || e.name === 'erp-origins.js') return;
      if (알맹이(fs.readFileSync(p, 'utf8')).indexOf(OLD_PREFIX) >= 0 && !받는목록.has(이름)) 걸린.push(이름);
    });
  })(path.join(R, 'functions'), '');
  assert.deepEqual(걸린, [], '★★ 옛 ERP 주소를 글자로 박아 내보내는 서버 파일: ' + 걸린.join(', ')
    + ' — erp-origins.js 의 ERP_LINK_BASE 를 쓸 것');
});

test('★ 뉴스레터 주소(news.…)의 첫 화면 «홈으로»가 공개 홈이다', () => {
  const h = fs.readFileSync(path.join(R, 'hosting', 'index.html'), 'utf8');
  const m = /<a[^>]+class="go"[^>]+href="([^"]+)"/.exec(h);
  assert.ok(m, '★ 홈으로 가는 링크를 못 찾았다');
  assert.equal(m[1], EO.PUBLIC_HOME, '★★ 첫 화면의 «홈으로»가 공개 홈이 아니다: ' + m[1]);
});

test('★★ 플레이스토어 앱(TWA)이 새 주소를 연다 — 옛 경로 앞머리(/pureunall)에 묶이지 않는다', () => {
  const A = path.join(R, 'android', 'portal-twa', 'app', 'src', 'main');
  const 글 = fs.readFileSync(path.join(A, 'res', 'values', 'strings.xml'), 'utf8');
  const 호스트 = new URL(EO.ERP_LINK_BASE).host;
  assert.match(글, new RegExp('<string name="host_name"[^>]*>' + 호스트.replace(/\./g, '\\.') + '</string>'), '★★ 앱 호스트가 새 주소가 아니다');
  const 시작 = /<string name="launch_url"[^>]*>([^<]+)<\/string>/.exec(글);
  assert.ok(시작 && 시작[1].indexOf(EO.ERP_LINK_BASE + '/') === 0, '★★ 앱 시작 주소가 새 주소가 아니다: ' + (시작 && 시작[1]));
  assert.ok(글.indexOf(EO.ERP_OLD) < 0, '★★ 앱 설정에 옛 출처가 남아 있다(주소 확인 파일·호스트가 어긋난다)');
  const 명세 = fs.readFileSync(path.join(A, 'AndroidManifest.xml'), 'utf8');
  assert.ok(!/pathPrefix="\/pureunall"/.test(명세), '★★ 앱 링크가 옛 경로 앞머리(/pureunall)에 묶여 있다');
  const 자바원문 = fs.readFileSync(path.join(A, 'java', 'kr', 'pureun', 'portal', 'PortalLauncherActivity.java'), 'utf8');
  /* 블록 주석만 걷는다 — 줄 주석 거르개는 문자열 "//" 까지 지워 버린다 */
  const 자바 = 자바원문.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const 판정 = (/boolean isAllowedPortalUri[\s\S]*?\n {4}\}/.exec(자바) || [''])[0];
  assert.ok(판정, '★ 앱의 주소 판정(isAllowedPortalUri)을 못 찾았다');
  assert.ok(판정.indexOf('/pureunall') < 0, '★★ 앱이 옛 경로 앞머리(/pureunall)만 받아 새 주소 링크를 버린다');
  assert.match(판정, /!path\.startsWith\("\/\/"\)/, '★ «//» 로 시작하는 꼴을 막는 검사가 빠졌다');
});

test('★ 공용 상태 파일의 배포 주소가 새 주소다', () => {
  const s = fs.readFileSync(path.join(R, 'STATUS.md'), 'utf8');
  const 줄 = (s.match(/^- 포털 입구:[^\n]*$/m) || [''])[0];
  assert.ok(줄.indexOf('배포: ' + EO.ERP_LINK_BASE) >= 0, '★ STATUS.md 「0. 한 줄」 배포 주소가 새 주소가 아니다: ' + 줄);
});
