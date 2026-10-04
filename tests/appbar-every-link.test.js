'use strict';
/* 즐겨찾기(앱바) 목록의 «모든 줄»이 제 프로그램으로 가는가 (대표 지시 2026-10-04)
 *
 * 「메일을 눌렀는데 기업정보함으로 간다 — 즐겨찾기 제대로 연결되어 있는지 반드시 확인해라」
 *
 * ■ 무엇이 틀렸나
 *   ① 누르면 주소 뒤에 «?v=…» 를 붙였는데, 메일 주소는 이미 물음표가 있다(pu-cards.html?view=mail).
 *      → pu-cards.html?view=mail?v=… 가 되어 view 값이 「mail?v=…」 로 읽히고 기업정보함이 열렸다.
 *   ② 메일 화면에서 「지금」이 기업정보함에 붙어, 메일에서 기업정보함 줄을 누를 수 없었다.
 *
 * ■ 무엇을 보는가 — 줄 하나하나를 «실제로 누르고», 도착한 주소에서 앱바가 «나는 누구»라고
 *   하는지 묻는다. 줄 이름·개수는 못 박지 않는다(앱이 늘어도 그대로 돈다).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./lib-appbar-load');

const ROOT = path.join(__dirname, '..');
const BASE = 'https://example.test/pureunall/';

/* 관리자로 실어야 관리자 전용 줄까지 다 나온다 */
const B = load({ role: 'admin' });
const APPS = B.APPS;

/* 누른 뒤 «도착한 화면»에서 앱바를 새로 띄워 본다 */
function landedAs(navUrl) {
  const u = new URL(navUrl, BASE);
  const there = load({ role: 'admin', pathname: u.pathname, search: u.search });
  return { key: there.whoAmI(), search: u.search, file: u.pathname.split('/').pop() };
}

test('즐겨찾기 목록에 줄이 있다 (빈 목록이면 아래 검사가 헛돈다)', () => {
  assert.ok(APPS.length >= 2);
});

for (const app of APPS) {
  test(`「${app.name}」 을 누르면 «${app.name}» 이 열린다`, () => {
    const file = app.url.split('?')[0];
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${app.name}: ${file} 파일이 없습니다`);

    B.__nav.length = 0;
    B._go(app);
    assert.equal(B.__nav.length, 1, `${app.name}: 눌러도 아무 데로도 안 갑니다`);
    const navUrl = B.__nav[0];

    assert.equal((navUrl.match(/\?/g) || []).length, 1,
      `${app.name}: 주소에 물음표가 두 번 들어갑니다 — ${navUrl}`);

    const got = landedAs(navUrl);
    assert.equal(got.file, file, `${app.name}: 다른 파일로 갑니다 — ${navUrl}`);
    assert.equal(got.key, app.key,
      `${app.name}: 눌렀는데 「${got.key || '알 수 없음'}」 화면이 됩니다 — ${navUrl}`);

    /* 주소 꼬리로 갈리는 앱(메일)은 «그 앱이 스스로 보는 잣대»로도 본다 */
    const qi = app.url.indexOf('?');
    if (qi >= 0) {
      for (const pair of app.url.slice(qi + 1).split('&')) {
        const esc = pair.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        assert.match(got.search, new RegExp('(^|[?&])' + esc + '(&|$)'),
          `${app.name}: 도착한 주소에 ${pair} 가 온전히 없습니다 — ${navUrl}`);
      }
    }
  });
}

test('보던 화면(back)이 붙어도 메일은 메일로 간다', () => {
  const mail = APPS.find((a) => a.url.indexOf('?') >= 0);
  if (!mail) return;
  /* 그 앱 화면에 떠서(auto 가 「지금 앱」을 잡는다) 보던 화면을 적어 둔 뒤 누른다 */
  const D = load({ role: 'admin', pathname: '/pureunall/' + mail.url.split('?')[0], search: '?' + mail.url.split('?')[1] });
  D.auto();
  D.mark('inbox');
  D.__nav.length = 0;
  D._go(mail);
  const navUrl = D.__nav[0] || '';
  assert.match(navUrl, /[?&]back=/, '보던 화면 표시가 안 붙었습니다');
  assert.equal(landedAs(navUrl).key, mail.key, `back 이 붙으니 다른 화면이 됩니다 — ${navUrl}`);
});

test('한 주소에서 «지금 앱»은 하나뿐이다 — 메일 화면은 메일, 기업정보함 화면은 기업정보함', () => {
  for (const app of APPS) {
    const u = new URL(app.url, BASE);
    const here = load({ role: 'admin', pathname: u.pathname, search: u.search });
    assert.equal(here.whoAmI(), app.key,
      `${app.name} 화면(${app.url})에서 앱바가 「${here.whoAmI() || '알 수 없음'}」 이라고 합니다 — ` +
      '그 줄이 「지금」이 되어 원래 앱으로 돌아가는 줄을 못 누릅니다');
  }
});
