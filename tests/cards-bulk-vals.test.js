/* 기업정보함 묶음 메일 — 화면과 서버가 «같은 칸 이름»을 쓰는가 (2026-09-27)
   ═══════════════════════════════════════════════════════════════════════════
   ⚠⚠ 2026-09-27 에 드러난 것: 둘이 쓰는 말이 «하나도 겹치지 않았다».

     화면(mailVals)  : 받는분 · 회사명 · 자료목록 · 오늘 · 담당자 · 보낸이 · 이번달 · 지난달
     서버(buildQueue): 이름 · 회사 · 직책 (+ name · company · title)

   자료함 기본 틀(「{받는분} 님, 안녕하세요 … {자료목록}」)을 그대로 묶음으로 보내면
   서버가 모르는 칸을 «빈 글자»로 지워, 받는 분은 「 님, 안녕하세요.」를 받으셨다.
   오류도 안 나고 메일은 잘 나간다 — 아무도 모른다.

   ■ 여기서 못 박는 것
     ㉠ 화면이 적어 둔 「서버가 아는 칸」이 «실제 서버»와 어긋나면 그 자리에서 걸린다
     ㉡ 자료함 기본 틀이 묶음으로 나가도 이름·자료목록이 «안 빈다»
     ㉢ 아무도 못 채우는 칸이 남아 있으면 «보내기 전에» 막는다
     ㉣ 시험 발송이 진짜와 «같은 손질»을 지난다 — 다르면 시험이 시험이 아니다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'pu-cards.html'), 'utf8');
const BULK = fs.readFileSync(path.join(ROOT, 'functions', 'mail-bulk.js'), 'utf8');
const MB = require('../functions/mail-bulk.js');

function slice(fromMark, toMark) {
  const a = HTML.indexOf(fromMark);
  const b = HTML.indexOf(toMark, a + 1);
  assert.ok(a > 0 && b > a, '표식을 못 찾았다: ' + fromMark);
  return HTML.slice(a, b);
}

/* 묶음 손질만 떠서 돌린다. 화면 것(mailVals·_matMeta)은 대역으로 채운다 —
   여기서 보려는 것은 «칸 이름을 옳게 바꾸고 막는가»뿐이다. */
function load(로컬) {
  const ctx = { console, Object, Array, String, Number, Math, Set, JSON,
    _matMeta: { m1: { name: '요율표', desc: '2026년' } },
    mailVals: (o) => Object.assign({ 받는분: '', 회사명: '', 자료목록: '',
      오늘: '2026-09-27', 담당자: '', 보낸이: '홍길동', 이번달: '9월', 지난달: '8월' }, o || {}) };
  Object.assign(ctx, 로컬 || {});
  vm.createContext(ctx);
  new vm.Script(slice('const BULK_SERVER_VALS = [', '/* ══════ 단체 메일이 «회사에도»')
    .replace(/^const /gm, 'var ')).runInContext(ctx);
  return ctx;
}

/* ═══ ㉠ 두 곳이 어긋나면 걸린다 ═══════════════════════════════════════ */
test('★★★ 화면이 적어 둔 「서버가 아는 칸」이 실제 서버(buildQueue)와 같다', () => {
  const 화면칸 = load().BULK_SERVER_VALS;
  const vals = BULK.slice(BULK.indexOf('const vals = {'));
  const 서버쪽 = vals.slice(0, vals.indexOf('};'));
  화면칸.forEach((k) => {
    assert.ok(new RegExp('(^|[\\s{,])' + k + '\\s*:').test(서버쪽),
      '화면은 «{' + k + '}» 가 채워진다고 적어 두었는데 서버는 그 칸을 모른다');
  });
  /* 서버가 통마다 채우는 «사람 칸»은 화면도 알아야 한다(지역뉴스·추적열쇠 같은
     뉴스레터 전용 자리는 뺀다 — 기업정보함이 쓰는 말이 아니다). */
  ['이름', '회사', '직책'].forEach((k) => {
    assert.ok(화면칸.indexOf(k) >= 0, '서버는 «{' + k + '}» 를 채우는데 화면이 모른다');
  });
});

/* ═══ ㉡ 기본 틀이 묶음으로 나가도 안 빈다 ═════════════════════════════ */
test('★★★ 자료함 기본 틀을 묶음으로 보내도 이름·자료목록이 «안 빈다»', () => {
  const ctx = load();
  const 기본틀 = '{받는분} 님, 안녕하세요.\n\n아래 자료를 첨부합니다.\n\n{자료목록}\n\n푸른노무법인';
  const 낼것 = ctx.bulkReady(기본틀, { ids: ['m1'] });

  /* 화면 말이 서버 말로 바뀌었고, 화면 몫(자료목록)은 여기서 채워졌다 */
  assert.ok(낼것.includes('{이름}'), '{받는분} 이 서버가 아는 {이름} 으로 안 바뀌었다');
  assert.ok(!낼것.includes('{받는분}'), '{받는분} 이 그대로 남았다');
  assert.ok(낼것.includes('요율표'), '{자료목록} 이 안 채워졌다');

  /* 그리고 «발송기를 실제로 지나» 받는 분 편지가 되는지 본다 */
  const v = MB.validateBulk({ subject: '[푸른노무법인] 자료', body: 낼것,
    to: [{ email: 'a@x.test', name: '홍길동', company: '가나상사' }] });
  assert.ok(v.ok, v.error);
  const 받는편지 = MB.buildQueue(v, 1000, 'me', 'b1')[0].payload.body;
  assert.ok(받는편지.startsWith('홍길동 님'), '받는 분 편지가 「 님,」으로 시작한다: '
    + 받는편지.slice(0, 20));
  assert.ok(받는편지.includes('요율표'), '자료 목록이 빈 채로 나갔다');
  assert.ok(!/\{[^{}\n]{1,20}\}/.test(받는편지), '자리가 글자로 남았다');
});

/* ═══ ㉢ 아무도 못 채우는 칸은 «보내기 전에» 막는다 ══════════════════ */
test('★★★ 아무도 못 채우는 칸을 이름 대어 집어낸다 — 오타·없는 칸', () => {
  const ctx = load();
  /* ⚠ vm 상자 안에서 «만들어진» 배열은 겉보기가 같아도 deepStrictEqual 이 튕긴다 —
     밖으로 한 번 옮겨 담고 견준다(이 저장소에서 여러 번 밟은 자리). */
  assert.deepStrictEqual(Array.from(ctx.bulkUnknownFields(['{이름} 님, {회사} 귀중'])), [],
    '서버가 채우는 칸을 못 채운다고 했다');
  assert.deepStrictEqual(
    Array.from(ctx.bulkUnknownFields([ctx.bulkReady('{받는분} 님 — 담당 {담당자} · {금액} {회사이름}', { ids: [] })])),
    ['금액', '회사이름'],   /* {담당자}·{받는분} 은 이제 채워진다 */
    '못 채우는 칸을 못 집어냈다');
});

/* ═══ 담당자는 «곳마다» 다르다 — 서버가 통마다 채운다 (대표 지시 2026-09-27) ═══ */
test('★★ 화면은 {담당자} 를 «미리 안 채운다» — 채우면 모두 한 사람 이름이 된다', () => {
  const ctx = load();
  const 낸것 = ctx.bulkReady('담당 {담당자} 드림', { ids: [] });
  assert.ok(낸것.includes('{담당자}'), '{담당자} 를 화면이 미리 채웠다 — 모두 같은 이름이 나간다');
  assert.ok(ctx.BULK_SERVER_VALS.indexOf('담당자') >= 0, '서버가 채우는 칸에 담당자가 없다');
  assert.deepStrictEqual(Array.from(ctx.bulkUnknownFields(['담당 {담당자} 드림'])), [],
    '{담당자} 를 「못 채우는 칸」으로 막고 있다 — 이제 서버가 채운다');
});

test('★★★ 명함마다 그 곳 담당 노무사를 실어 보낸다 — 통마다 다른 이름이 찍힌다', () => {
  /* 기업정보함이 담아 보내는 줄(mailTargets)을 그대로 발송기에 넣어 본다 */
  const v = MB.validateBulk({ subject: '{회사} 담당 안내', body: '담당 {담당자} 드림',
    to: [{ email: 'a@x.test', name: '홍길동', company: '가나상사', staff: '이몽룡' },
         { email: 'b@x.test', name: '임꺽정', company: '다라상사', staff: '성춘향' },
         { email: 'c@x.test', name: '심청', company: '마바상사' }] });
  assert.ok(v.ok, v.error);
  const 줄 = MB.buildQueue(v, 1000, 'me', 'b1');
  assert.ok(줄[0].payload.body.includes('담당 이몽룡 드림'), '첫 곳 담당이 안 찍혔다');
  assert.ok(줄[1].payload.body.includes('담당 성춘향 드림'), '둘째 곳 담당이 안 찍혔다');
  /* ⚠ 모르면 «빈 글자» — 지어내지 않는다 */
  assert.ok(줄[2].payload.body.includes('담당  드림'), '모르는 담당을 지어냈다: '
    + 줄[2].payload.body);
  assert.ok(!줄.some(x=>x.payload.body.includes('{담당자}')), '자리가 글자 그대로 남았다');
});

test('★★ 담당자 칸은 안내문 «담당문의»와 갈라져 있다 — 꾸밈말이 섞이면 말이 어그러진다', () => {
  const v = MB.validateBulk({ subject: 's', body: '담당 {담당자} · 문의 {담당문의}끝',
    to: [{ email: 'a@x.test', staff: '이몽룡' }] });
  assert.ok(v.ok, v.error);
  const b = MB.buildQueue(v, 1000, 'me', 'b1')[0].payload.body;
  assert.ok(b.includes('담당 이몽룡 ·'), '{담당자} 에 꾸밈말이 붙었다: ' + b);
  assert.ok(b.includes('문의 담당 이몽룡 · 끝'), '{담당문의} 의 꾸밈말이 사라졌다: ' + b);
});

test('★★★ 기업정보함이 명함마다 담당을 «실어 보낸다» — 안 실으면 서버가 채울 것이 없다', () => {
  const 몸 = slice('function mailTargets(items, block){', '/* CSV —');
  assert.ok(/staff\s*:/.test(몸), 'mailTargets 가 담당(staff)을 안 싣는다');
  assert.ok(/ErpMatch\.match\(it\)/.test(몸), '담당을 담당자 표에서 안 찾는다');
  assert.ok(!/ErpMatch\.label\(/.test(몸), 'label() 은 배지 글자다 — 「이몽룡 +2」가 실린다');
  /* ⚠ 이름만 싣는다 — 직원 개인 번호를 거래처에 뿌리지 않는다 */
  assert.ok(!/staff[^,}]*(phone|tel|mobile)/i.test(몸), '담당의 연락처까지 싣고 있다');
});

test('★★ 담당을 못 찾은 곳이 몇인지 «보내기 전에» 센다 — 조용히 빈칸으로 안 보낸다', () => {
  const ctx = load();
  const 받는곳 = [{ staff: '이몽룡' }, { staff: '' }, {}];
  assert.strictEqual(ctx.bulkNoStaffCount('담당 {담당자} 드림', 받는곳), 2, '빈 곳을 못 셌다');
  assert.strictEqual(ctx.bulkNoStaffCount('담당자를 안 쓰는 편지', 받는곳), 0,
    '{담당자} 를 안 쓰는 편지인데 겁을 준다');
  const 보내기 = slice('async function bulkSendAll(){', 'async function sendCompose(){');
  assert.ok(/bulkNoStaffCount\(/.test(보내기), '보내기 전에 안 센다');
  assert.ok(/담당줄/.test(보내기), '센 것을 물어보는 창에 안 적는다');
});

/* ═══ ㉣ 시험이 진짜와 같은 길을 지난다 ═══════════════════════════════ */
test('★★★ 시험 발송도 진짜와 «같은 손질»을 지나고, 같은 잣대로 막힌다', () => {
  const 시험 = slice('async function bulkTestSend(){', '/* 진짜 보내기 */');
  const 진짜 = slice('async function bulkSendAll(){', 'async function sendCompose(){');
  [['시험 발송', 시험], ['진짜 보내기', 진짜]].forEach(([이름, 몸]) => {
    assert.ok(/bulkReady\(/.test(몸), 이름 + ' 이 bulkReady 를 안 지난다');
    assert.ok(/bulkUnknownFields\(/.test(몸), 이름 + ' 이 못 채우는 칸을 안 막는다');
    assert.ok(!/subject:\s*c\.subject/.test(몸), 이름 + ' 이 손질 안 한 제목을 그대로 보낸다');
    assert.ok(!/body:\s*c\.body/.test(몸), 이름 + ' 이 손질 안 한 본문을 그대로 보낸다');
  });
  assert.ok(/html\s*:/.test(시험), '시험 발송만 서식 없이 나간다 — 진짜와 다른 편지가 된다');
});

/* ═══ 묶음을 시작할 때부터 «보는 글이 곧 나갈 글»이어야 한다 ══════════ */
test('★★ 묶음을 시작하면 틀의 칸 이름을 서버 말로 바꿔 보여 준다', () => {
  const 몸 = slice('function bulkMailStart(){', '/* 묶음을 풀고 보통 메일로');
  assert.ok(/BULK_RENAME/.test(몸), '틀의 칸 이름을 안 바꾼다 — 사람은 {받는분} 을 보고 보낸다');
});
