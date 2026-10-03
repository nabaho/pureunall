/* 취업규칙(새) 「📥 모은 자료」 화면 — Task 10.
   그림(DOM)이 아니라 «그린 글»을 본다 — 화면은 문자열 그리기 함수(tableHtml·bulkHtml…)를 따로 낸다.
   ★ 못 박는 것은 규칙이다(값·개수가 아니다):
     ① 맨 왼쪽 ☐·번호, 보류는 못 고른다   ② 고르면 일괄 단추가 뜬다
     ③ 「지금 더 모으기」는 관리자에게만    ④ 표에는 가린 «셈»만 — 가린 글(원문)은 옆 칸에만
     ⑤ 표의 칸은 한 줄(넘치면 … 과 title)  ⑥ 새 앱 머리(관문 → Firebase, 캐시 번호, 활동 시계)
     ⑦ 업체는 이름으로 «거르고» id 로 «고른다»  ⑧ 최종본 칸이 없으면(RTDB 가 null 을 버린다) 최종본 없음 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global.PuRulesV2Order = require('../js/rules-v2/lib-order.js');
const V = require('../js/rules-v2/view-library.js');
const K = require('../js/pu-kordoc-text.js');

const D = (id, o) => Object.assign({ id, kind: '규칙본문', dir: '받음', status: '담김', name: id + '.hwp', createdAt: 1,
  companyCand: [], pii: { count: { phone: 1 } }, mail: { src: 'imap', box: 'INBOX', key: id, date: 1, subject: '가나상사 취업규칙' } }, o);
const data = { docs: { a: D('a'), b: D('b', { status: '보류', holdWhy: 'PDF — 아직 못 읽음', name: 'b.pdf' }) }, human: {}, rounds: {}, run: { stored: 1, held: 1 } };
const st = (o) => Object.assign({ data, view: 'mail', filt: {}, picked: new Set(), sel: '', companies: [], isAdmin: false }, o);
const HTML = () => fs.readFileSync(path.join(__dirname, '../rules-v2.html'), 'utf8');

/* 사업장이 확정된 한 회사·한 회차 — 판 둘(현행 받음 → 1판 보냄) */
const DAY = 864e5, T0 = Date.UTC(2026, 6, 1);
function coData(rounds) {
  const m = (k, d) => ({ src: 'imap', box: 'INBOX', key: k, date: T0 + d * DAY, subject: '가나상사 규칙' });
  return {
    docs: {
      v0: D('v0', { dir: '받음', name: '가나 현행.hwp', createdAt: 1, mail: m('m1', 0) }),
      v1: D('v1', { dir: '보냄', name: '가나 최종.hwp', createdAt: 2, mail: m('m2', 30) }),
    },
    human: {
      v0: { id: 'v0', companyId: 'co1', companyLinkStatus: 'linked' },
      v1: { id: 'v1', companyId: 'co1', companyLinkStatus: 'linked' },
    },
    rounds: rounds || {}, run: null,
  };
}
const COS = [{ id: 'co1', name: '가나상사' }, { id: 'co2', name: '다라물산' }];

test('맨 왼쪽 ☐ 와 번호, 보류 줄은 못 고른다', () => {
  const h = V.tableHtml(st());
  assert.match(h, /<th class="c"><input type="checkbox"/);
  assert.match(h, /<td class="no">\d+<\/td>/);
  assert.match(h, /data-pick="b"[^>]*disabled/);
  assert.doesNotMatch(h, /data-pick="a"[^>]*disabled/);
});

test('고르면 일괄 단추 — 최종본으로·사업장 확정·갈래 고치기', () => {
  const h = V.bulkHtml(st({ picked: new Set(['a']) }));
  assert.match(h, /★ 최종본으로/); assert.match(h, /사업장 확정/); assert.match(h, /갈래 고치기/);
  assert.equal(V.bulkHtml(st()), '');
});

test('「지금 더 모으기」는 관리자에게만', () => {
  assert.doesNotMatch(V.runHtml(st()), /지금 더 모으기/);
  assert.match(V.runHtml(st({ isAdmin: true })), /지금 더 모으기/);
});

test('가린 셈만 — 글(원문)을 표에 안 그린다', () => {
  const h = V.tableHtml(st());
  assert.match(h, /전화 1/);
  assert.doesNotMatch(V.tableHtml.toString(), /\.text\b/);
  // 옆 칸에 가린 글을 꽂아 둔 상태여도 표에는 안 나온다
  const s = st({ sel: 'a', text: { id: 'a', body: '비밀 본문 한 줄' } });
  assert.doesNotMatch(V.tableHtml(s), /비밀 본문/);
  assert.match(V.sideHtml(s, '비밀 본문 한 줄'), /비밀 본문/);
});

test('가린 셈의 이름표는 pu-kordoc-text.js 의 countLabel 과 같다', () => {
  const c = { rrn: 1, account: 2, card: 1, phone: 3, email: 1, passport: 1, driver: 1 };
  assert.equal(V.piiLabel(c), K.countLabel(c));
});

test('표의 칸은 한 줄 — 넘치면 … 과 title', () => {
  const css = HTML();
  assert.match(css, /\.lib td\{[^}]*white-space:nowrap[^}]*text-overflow:ellipsis/);
  assert.match(V.tableHtml(st()), /<td[^>]*title="/);
  // 파일 이름이 넘칠 수 있는 칸은 title 에 전문
  assert.match(V.tableHtml(st()), /<td[^>]*title="a\.hwp"/);
});

test('title 과 글은 걸러 넣는다 — 파일 이름에 따옴표·꺾쇠가 있어도 칸이 안 깨진다', () => {
  const s = st({ data: { docs: { x: D('x', { name: '"><b>x.hwp' }) }, human: {}, rounds: {}, run: null } });
  const h = V.tableHtml(s);
  assert.doesNotMatch(h, /"><b>x/);
  assert.match(h, /&quot;&gt;&lt;b&gt;x\.hwp/);
});

test('새 앱 머리 — 관문을 Firebase 초기화 전에, 캐시 번호, 활동 시계', () => {
  const html = HTML();
  const iGate = html.indexOf('js/pu-ontology-write.js'), iInit = html.indexOf('firebase.initializeApp');
  assert.ok(iGate > 0 && iInit > iGate);
  assert.match(html, /js\/pu-ontology-write\.js\?v=\d+/);
  assert.match(html, /js\/rules-v2\/lib-order\.js\?v=\d+/);
  assert.match(html, /js\/pu-active\.js\?v=\d+/);
  // 실은 스크립트는 모두 캐시 번호를 단다 (밖의 firebase 묶음은 판이 주소에 있다)
  const bare = [...html.matchAll(/<script src="(js\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !/\?v=\d+$/.test(u));
  assert.deepEqual(bare, []);
});

test('조 나누기 — 줄 머리의 「제N조·제N조의M」 에서 자른다', () => {
  const arts = V.parseArticles('제1조(목적) 이 규칙은…\n제2조(정의) 근로자란…\n법 제93조에 따라\n제2조의2(적용) …\n');
  assert.equal(arts.length, 3);
  assert.equal(arts[0].title, '목적');
  assert.equal(arts[2].label, '제2조의2');
  assert.equal(V.parseArticles('').length, 0);
});

test('사업장 찾기 — 이름으로 거르고, 고르는 단추는 업체 id 를 든다', () => {
  const h = V.linkPickerHtml({ ids: ['a'], label: '첨부 1' }, COS, '가나');
  assert.match(h, /data-co="co1"/);
  assert.doesNotMatch(h, /data-co="co2"/);
  assert.match(h, /사업장 없음/);
  // 지운 업체는 고를 수 없다
  const gone = V.linkPickerHtml({ ids: ['a'] }, [{ id: 'co9', name: '가나옛집', _deleted: true }], '가나');
  assert.doesNotMatch(gone, /data-co="co9"/);
});

test('업체 목록 — {v:[…]}·객체·빈 칸 어느 꼴이든 배열로', () => {
  assert.equal(V.companyList({ v: [{ id: 'a' }, null, { id: 'b' }] }).length, 2);
  assert.equal(V.companyList({ k1: { id: 'a' } }).length, 1);
  assert.deepEqual(V.companyList(null), []);
});

test('✉ 메일 열기 — 사업장이 확정됐으면 그 사업장과 오간 메일, 아니면 메일함', () => {
  assert.match(V.mailHref('co 1'), /pu-cards\.html\?view=mail&mail=co&co=co%201$/);
  const plain = V.mailHref('');
  assert.match(plain, /pu-cards\.html\?view=mail$/);
});

test('사업장별 — 판 차례·「앞 판과 달라진 조」 는 세기 전엔 …, 센 뒤엔 숫자', () => {
  const s = st({ data: coData(), view: 'company', companies: COS });
  const h = V.tableHtml(s);
  assert.match(h, /가나상사/);
  assert.match(h, /<td class="no">0<\/td>/);
  assert.match(h, /<td class="no">1<\/td>/);
  assert.match(h, /…/);
  const done = V.tableHtml(Object.assign({}, s, { diff: { v1: { counts: { '바뀜': 4, '새 조': 1, '없어짐': 0, '번호 바뀜': 0, '같음': 2 }, rows: [] } } }));
  assert.match(done, /바뀐 조 <b>4<\/b>/);
});

test('최종본 칸이 «없는» 회차 레코드(RTDB 가 null 을 버린 꼴)는 최종본 없음으로 본다', () => {
  const rec = { co1_r202607: { id: 'co1_r202607', companyId: 'co1', roundKey: 'r202607', finalBy: '', finalAt: 0 } };
  const s = st({ data: coData(rec), view: 'company', companies: COS });
  assert.doesNotMatch(V.tableHtml(s), /class="fin1"/);
  const fin = { co1_r202607: { id: 'co1_r202607', companyId: 'co1', roundKey: 'r202607', finalDocId: 'v1', finalBy: 'P-001', finalAt: T0 } };
  const s2 = st({ data: coData(fin), view: 'company', companies: COS });
  assert.match(V.tableHtml(s2), /class="fin1"/);
  assert.match(V.tableHtml(Object.assign({}, s2, { view: 'mail' })), /★ 최종본/);
});

test('메일 머리줄 — 사업장 확정은 «메일 한 통» 단위로 건다', () => {
  const h = V.tableHtml(st());
  assert.match(h, /<tr class="mail">[\s\S]*data-act="linkMail"/);
});
