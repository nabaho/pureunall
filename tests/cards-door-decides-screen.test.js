/* 문이 세상을 정한다 — 기업정보함 문으로 들어오면 메일을 되살리지 않는다 (대표 지시 2026-09-14)

   「기업 정보함을 폰에서 터치하면 무조건 메일로 넘어간다. 이거 반드시 고쳐 달라.」

   ── 무슨 일이 있었나 ──
   포털의 「기업정보함」과 「푸른 메일」은 같은 파일(pu-cards.html)의 두 문이다 — 주소 ?view=mail 이 가른다.
   restoreLastScreen 은 «마지막 본 화면»을 되살리는데, 문을 안 봤다. 마지막이 메일이었으면
   기업정보함 문으로 들어와도 메일을 열었다. 이 값은 기기(localStorage)에만 적히므로,
   폰에서 메일을 마지막으로 쓴 사람은 기업정보함을 눌러도 «무조건» 메일이었다.

   ── 규칙 ──
   ① 기업정보함 문(view=mail 없음)에서는 명함 쪽 화면만 되살린다 — 메일 함수는 하나도 부르지 않는다
   ② 그래도 «탭»(명함/사업자)은 되살린다 — 명함 쪽 기억은 그대로다
   ③ 메일 문(view=mail)은 예전 그대로 제 첫 화면을 연다
   ④ 코드에 기업정보함 문 아래 메일 갈래가 «남아 있지 않다» — 남기면 이 흠이 되살아난다
   ⑤ 포털 두 타일은 주소로 문이 갈린다 */

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sliceFn } = require('./fnslice.js');
const { stripComments } = require('./strip-comments');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'pu-cards.html'), 'utf8');
const portal = fs.readFileSync(path.join(root, 'enter.html'), 'utf8');
function fn(name) { return sliceFn(app, 'function ' + name + '('); }

function boot(who, search) {
  const store = {}, opened = [];
  const ctx = {
    JSON, Object, String, URLSearchParams,
    myUid: who || '', myEmail: '',
    location: { search: search || '' },
    state: { view: 'list', tab: 'card', mailSent: false },
    _compose: null,
    document: { body: { classList: { contains: function () { return false; } } } },   // 폰
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    __store: store, opened: opened,
    openMatPage() { opened.push('mat'); },
    openCoMobile() { opened.push('co-mobile'); },
    openMailPage() { opened.push('mail'); },
    openMailBox(id) { opened.push('box:' + (id || '')); },
    openInbox() { opened.push('inbox'); },
    openSentBox() { opened.push('sent'); },
    openSchedBox() { opened.push('sched'); },
    openCoThread(id) { opened.push('co:' + (id || '')); },
    openWhoPage(t) { opened.push('who:' + (t || '')); },
    openSendMaterials() { opened.push('send'); },
    switchTab(t) { opened.push('tab:' + t); }
  };
  vm.createContext(ctx);
  vm.runInContext(app.match(/const LASTV_PREFIX = [^\n]*/)[0], ctx);
  vm.runInContext("var _lastScreenSig = ''; var _lastScreenDone = false; var MAIL_WHO_TABS = ['succ','addr','end','notco'];", ctx);
  ['lastScreenKey', 'mailToFromUrl', 'mailCoFromUrl', 'mailWhoFromUrl', 'urlWantsMail', 'composeTouched', 'saveLastScreen', 'restoreLastScreen']
    .forEach(n => vm.runInContext(fn(n), ctx));
  return ctx;
}
/* 메일을 보고 나간 기록을 남기고, «기업정보함 문»으로 다시 들어온다 */
function leaveMailThenEnterCards(mailState, tab) {
  const c = boot('u1');
  Object.assign(c.state, { view: 'mail', tab: tab || 'card' }, mailState);
  c.saveLastScreen();
  const back = boot('u1', '');                 // 기업정보함 타일 = view=mail 없는 주소
  back.__store[back.lastScreenKey()] = c.__store[c.lastScreenKey()];
  back.restoreLastScreen();
  return Array.from(back.opened);
}
const MAIL_OPENS = /^(mail|box:|inbox|sent|sched|co:|who:|send)/;

test('★★ 기업정보함 문 — 마지막이 메일함이었어도 메일을 열지 않는다', () => {
  const opened = leaveMailThenEnterCards({ mailSent: 'box', mbBox: 'INBOX-abc' });
  assert.deepEqual(opened.filter(o => MAIL_OPENS.test(o)), [],
    '★★ 기업정보함을 눌렀는데 메일이 열립니다 — 대표가 「무조건 메일로 넘어간다」고 한 바로 그 자리입니다: ' + JSON.stringify(opened));
});

test('★★ 마지막이 보낸메일·예약·사업장별·쓰기였어도 같다 — 갈래마다 따로 본다', () => {
  [{ mailSent: true }, { mailSent: 'sched' }, { mailSent: 'co', co: 'C1' }, { mailSent: 'inbox' },
   { mailSent: false, _compose: { to: 'a@b.kr', base: {} } }].forEach(function (st) {
    const opened = leaveMailThenEnterCards(st);
    assert.deepEqual(opened.filter(o => MAIL_OPENS.test(o)), [],
      '★★ ' + JSON.stringify(st) + ' 에서 나갔는데 기업정보함 문으로 메일이 열립니다: ' + JSON.stringify(opened));
  });
});

test('★ 그래도 «탭»은 되살린다 — 명함 쪽 기억은 그대로다', () => {
  const opened = leaveMailThenEnterCards({ mailSent: 'box' }, 'biz');
  assert.deepEqual(opened, ['tab:biz'], '메일을 안 여는 대신 사업자 탭으로는 돌아와야 합니다');
});

test('★ 메일 문(view=mail)은 예전 그대로 — 마지막이 명함이었어도 메일함이 열린다', () => {
  const c = boot('u2');
  c.state.view = 'co'; c.saveLastScreen();
  const back = boot('u2', '?view=mail');
  back.__store[back.lastScreenKey()] = c.__store[c.lastScreenKey()];
  back.restoreLastScreen();
  /* ⚠ «어느 칸»인지는 여기서 안 본다 — 2026-09-18 에 첫 화면이 받은메일함에서
       전체메일로 바뀌자 'box:' 를 박아 둔 이 줄이 깨졌다. 이 검사가 지키는 것은
       «메일 문으로 들어오면 메일함이 열리는가»이지 그 안 어느 칸인가가 아니다. */
  assert.equal(back.opened.length, 1, '연 화면이 하나가 아닙니다: ' + back.opened.join(', '));
  assert.match(back.opened[0], /^box:/, '메일 타일을 눌렀으면 메일함이어야 합니다');
});

test('★★ 코드에 기업정보함 문 아래 «메일 갈래»가 남아 있지 않다 — 남기면 이 흠이 되살아난다', () => {
  const body = stripComments(fn('restoreLastScreen'));
  const i = body.indexOf('let s = null');
  assert.ok(i > 0, '★ 마지막 화면을 읽는 자리를 못 찾았습니다');
  const afterDoor = body.slice(i);            // 메일 문 처리(urlWantsMail)는 그 위에서 끝난다
  assert.ok(!/open(Mail|Sent|Sched)Box|openInbox|openCoThread|openMailPage|openWhoPage/.test(afterDoor),
    '★★ 저장된 화면을 읽은 뒤에 메일을 여는 갈래가 있습니다 — 기업정보함 문에서 메일이 열리는 길입니다');
});

test('★ 포털의 두 타일은 같은 파일의 두 문이다 — 주소로 갈린다', () => {
  const cards = portal.match(/key:'cards'[^\n]*/)[0];
  const mail = portal.match(/key:'mail'[^\n]*/)[0];
  assert.match(cards, /url:'pu-cards\.html/, '기업정보함 타일 주소가 바뀌었습니다');
  assert.ok(!/view=mail/.test(cards), '★★ 기업정보함 타일이 메일 문으로 갑니다');
  assert.match(mail, /view=mail/, '★ 푸른 메일 타일은 메일 문이어야 합니다');
});
