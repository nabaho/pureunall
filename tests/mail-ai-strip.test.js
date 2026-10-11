/* 🤖 받은메일함 위 「AI가 새 메일 N통을 업무 칸으로 옮겼습니다」 띠 (대표 승인 목업 2026-10-11)
   ═══════════════════════════════════════════════════════════════════════════
   실측 2026-10-11 — AI 자동분류를 켠 뒤(10/04) 새 메일 30통이 전부 업무 칸으로 옮겨져 받은메일함
   맨 위가 10/04 였다. 사람은 「받은메일함이 이상하다」로 읽었다. 옮기는 동작은 그대로 두고 알리기만 한다.
   이 검사는 띠를 «실제로 그려» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { sliceFn } = require('./fnslice');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8');
const fn = (n) => sliceFn(HTML, 'function ' + n + '(');
const DAY = 86400000;

function make(o) {
  const opt = o || {};
  const now = Date.now();
  const INBOX = 'INBOX-aaaa1111';
  const msgs = { [INBOX]: {} };
  (opt.rows || []).forEach((r) => { msgs[INBOX][r.u] = { d: now - r.daysAgo * DAY, s: '제목' + r.u }; });
  const box = {
    console, Date, Object, Number, String, Math,
    MB_BIN_P: '~',
    esc: (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    _mbMsgs: msgs,
    _mbPut: opt.put || {},
    _mbPutBy: opt.putBy || {},
    mbMemoOf: (() => { let m = {}; return () => m; })(),
    mbFolderOf: (k) => (k === 'inbox' ? [{ slug: INBOX }] : []),
    mbHidden: (id) => (opt.hidden || []).indexOf(id) >= 0,
    mbBinBy: (id) => ({ name: '칸:' + id }),
    mbBoxName: (id) => id,
    mbSentBox: () => !!opt.sent,
    mbNow: () => (opt.now === undefined ? INBOX : opt.now),
  };
  vm.createContext(box);
  vm.runInContext('const MB_AI_DAYS = 7;\n' + fn('mbAiMoved') + '\n' + fn('mbAiStripHtml') +
    '\n;this.mbAiStripHtml = mbAiStripHtml; this.mbAiMoved = mbAiMoved;', box);
  box.INBOX = INBOX;
  return box;
}
const k = (b, u) => b.INBOX + ':' + u;

function scene() {
  const b0 = make({ rows: [] });
  const IN = b0.INBOX;
  const rows = [
    { u: 1, daysAgo: 1 }, { u: 2, daysAgo: 2 }, { u: 3, daysAgo: 3 }, { u: 4, daysAgo: 1 },
    { u: 5, daysAgo: 20 },                 // 오래된 것 — 안 센다
    { u: 6, daysAgo: 1 },                  // 사람이 옮긴 것 — 안 센다
    { u: 7, daysAgo: 1 },                  // 안 옮겨진 것
  ];
  const put = { [IN + ':1']: '컨설팅', [IN + ':2']: '컨설팅', [IN + ':3']: '급여', [IN + ':4']: '광고', [IN + ':5']: '급여', [IN + ':6']: '급여' };
  const putBy = { [IN + ':1']: 'ai', [IN + ':2']: 'ai', [IN + ':3']: 'ai', [IN + ':4']: 'ai', [IN + ':5']: 'ai' };
  return { rows, put, putBy, hidden: ['광고'] };
}

test('★★ AI 가 옮긴 새 메일만 센다 — 오래된 것·사람이 옮긴 것·안 옮긴 것은 안 센다', () => {
  const b = make(scene());
  const a = b.mbAiMoved();
  assert.equal(a.n, 3, '센 수가 다르다 (컨설팅 2 + 급여 1)');
  assert.equal(a.hidden, 1, '숨긴 칸으로 간 것은 따로 센다');
  assert.equal(a.by['컨설팅'], 2);
  assert.equal(a.order[0], '컨설팅', '많은 칸부터 나열한다');
});

test('★★ 띠는 «받은메일함에서만» 뜬다 — 다른 칸·보낸 칸에서는 안 뜬다', () => {
  assert.match(make(scene()).mbAiStripHtml(), /dm-ai2/);
  assert.equal(make(Object.assign(scene(), { now: '~다른칸' })).mbAiStripHtml(), '', '다른 칸에서 떴다');
  assert.equal(make(Object.assign(scene(), { sent: true })).mbAiStripHtml(), '', '보낸 칸에서 떴다');
});

test('★ 옮겨진 것이 없으면 띠 자체가 없다 — 늘 켜진 등은 아무것도 못 알린다', () => {
  const b = make({ rows: [{ u: 1, daysAgo: 1 }], put: {}, putBy: {} });
  assert.equal(b.mbAiStripHtml(), '');
  const old = make({ rows: [{ u: 1, daysAgo: 30 }], put: { 'INBOX-aaaa1111:1': '급여' }, putBy: { 'INBOX-aaaa1111:1': 'ai' } });
  assert.equal(old.mbAiStripHtml(), '', '7일 넘은 것으로 띠가 떴다');
});

test('★★ 띠에 총 수·칸 칩·전체메일 단추가 있고, 숨긴 칸은 «수만» 적는다(누를 곳 없음)', () => {
  const h = make(scene()).mbAiStripHtml();
  assert.match(h, /<b>4통<\/b>/, '총 수(보이는 3 + 숨김 1)가 아니다');
  assert.match(h, /mbGo\('~컨설팅'\)/, '칩이 그 칸을 열지 않는다');
  assert.match(h, /mbGo\('~급여'\)/);
  assert.match(h, /광고 1 \(숨김\)/);
  assert.doesNotMatch(h, /mbGo\('~광고'\)/, '숨긴 칸에 누르는 칩이 달렸다 — 눌러도 볼 것이 없다');
  assert.match(h, /openMailBox\('\*all'\)[\s\S]{0,120}전체메일에서 보기/);
});

test('★ 칸 이름은 이스케이프한다 — 폴더 이름이 글자 그대로 들어가지 않는다', () => {
  const b = make(Object.assign(scene(), {}));
  b.mbBinBy = () => ({ name: '<img onerror=x>' });
  const h = b.mbAiStripHtml();
  assert.doesNotMatch(h, /<img onerror/);
});

test('★★ 목록 위에 실제로 끼워져 있다 — 문의 띠 «앞»', () => {
  const i = HTML.indexOf('${mbAiStripHtml()}');
  const j = HTML.indexOf('${mbInqLineHtml()}');
  assert.ok(i > 0, '띠를 목록에 안 끼웠다');
  assert.ok(i < j, '문의 띠보다 뒤다');
});

test('★ 한 줄이다 — 넘치면 … (표의 한 칸은 한 줄)', () => {
  const css = HTML.slice(HTML.indexOf('.dm-ai2{'), HTML.indexOf('.dm-ai2{') + 260);
  assert.match(css, /white-space:nowrap/);
  assert.match(css, /overflow:hidden/);
});
