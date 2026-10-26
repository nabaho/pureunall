'use strict';
/* 👤 이름 옆 사번 걷기 — 이름표·고르는 목록·화면 글자 (대표 지시 2026-10-19 → 결정 2026-10-25 「이름만 있어야한다」)

   ★ 이 검사가 못 박는 것은 «규칙»이다:
     ① 이름표는 이름만 — 같은 이름이면 직책으로 가른다, 이름을 모르면 「이름 미확인」. 사번은 어떤 경우에도 안 쓴다
        (js/pu-staff-label.js)
     ② 담당자를 «고르는» 목록은 이름표 함수를 거친다 — 글자에 사번을 즉석으로 이어 붙이지 않는다
        (값 value 는 그대로 사번이다 — 온톨로지: 사람은 sid 로 잇는다)
     ③ 화면 글자(배지·알림·안내)에 사번을 그냥 찍지 않는다 — 말풍선(title)도 «보이는 것»이라 마찬가지다
   ⚠ 그 밖의 앱 전체(인사·급여·권한 화면 포함)는 tests/sid-never-shown.test.js 가 «패턴»으로 지킨다. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cutFn } = require('./cut-fn');
const { stripJs } = require('./strip-comments');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const L = require('../js/pu-staff-label.js');
const ERP_RAW = read('pu-erp.html');
const ERP = stripJs(ERP_RAW);
const PAY = stripJs(read('pu-paydata.html'));
const GOV = stripJs(read('gov-consulting.html'));
const PHOTOS = stripJs(read('pu-photos.html'));
const CARDS = stripJs(read('pu-cards.html'));

/* ── ① 이름표 ── */
test('①★ 이름만 — 같은 이름이면 직책으로 가른다, 이름을 모르면 「이름 미확인」 · 사번은 어떤 경우에도 안 쓴다', () => {
  const ppl = [{ sid: 'P-001', name: '가나다', title: '노무사' }, { sid: 'P-002', name: '라마바', title: '노무사' },
    { sid: 'P-003', name: '라마바', title: '사무장' }];
  assert.equal(L.label(ppl[0], ppl), '가나다', '★ 겹치지 않는 이름에 직책을 붙였다');
  assert.equal(L.label(ppl[2], ppl), '라마바 (사무장)', '★ 같은 이름인데 직책으로도 안 갈랐다 — 고를 때 헷갈린다');
  assert.equal(L.label({ sid: 'P-009', name: '' }, ppl), '이름 미확인', '★ 이름을 모를 때 사번을 대신 적었다');
  assert.equal(L.label(ppl[1]), '라마바', '견줄 목록이 없으면 견주지 않는다');
  const twin = [{ sid: 'P-011', name: '마바사' }, { sid: 'P-010', name: '마바사' }];
  assert.equal(L.label(twin[1], twin), '마바사 (1)', '직책도 같으면 사번 순서의 번호로 가른다 — 사번 글자는 안 쓴다');
  assert.equal(L.label(twin[0], twin), '마바사 (2)');
  assert.equal(L.label(twin[0], twin.slice().reverse()), '마바사 (2)', '목록 순서가 바뀌어도 같은 사람은 같은 번호');
  /* 같은 사람이 두 번 실려 있어도(명부 겹침) 동명이인이 아니다 */
  assert.equal(L.label(ppl[0], [ppl[0], Object.assign({}, ppl[0])]), '가나다');
  /* ★ 어떤 입력에서도 사번 꼴이 글자에 끼면 안 된다 */
  [[ppl[0], ppl], [ppl[2], ppl], [{ sid: 'P-009', name: '' }, ppl], [{ sid: 'A005', name: '', title: '' }, []]].forEach((c) => {
    assert.ok(!/[A-Za-z]-?\d{3}/.test(L.label(c[0], c[1])), '★ 사번이 글자에 끼었다: ' + L.label(c[0], c[1]));
  });
});

/* ── ② 고르는 목록 ── */
test('②★ 이알피 담당자 고르는 목록(계약·사건·일괄 가져오기)은 글자에 사번을 이어 붙이지 않는다', () => {
  const bad = ERP.split('\n').filter((x) => /h\('option'/.test(x) && /'\s*·\s*'\s*\+\s*u\.sid\b/.test(x));
  assert.deepEqual(bad.map((x) => x.trim().slice(0, 120)), [],
    '★ 고르는 목록에 「이름 · P-001」을 즉석으로 붙인 줄이 있다 — erpStaffLabel(u, 목록) 을 쓴다');
  /* 계약 창의 주담당·부담당 자리·「+ 부담당 추가」 세 곳 — 휴직(🚫) 표시는 그대로 붙는다 */
  const ct = cutFn(ERP, 'function ContractModal(props)');
  assert.ok((ct.match(/erpStaffLabel\(u, lawyers\)/g) || []).length >= 3, '★ 계약 창 고르는 목록이 이름표 함수를 안 거친다');
  assert.match(ERP, /function erpStaffLabel\(u, list\)\{[\s\S]{0,200}PuStaffLabel/, '이름표 함수가 공용 파일을 안 쓴다');
  assert.match(ERP_RAW, /<script src="js\/pu-staff-label\.js\?v=\d+"><\/script>/, '공용 이름표 파일을 싣지 않는다(캐시 번호와 함께)');
});

test('②-2 급여데이터함 주담당 고르기·알림도 이름표 함수를 거친다', () => {
  /* 말풍선(title)의 「이름 (P-001)」은 확인용이라 괜찮다 — 고르는 목록(option) 글자만 본다 */
  assert.doesNotMatch(PAY, /esc\(p\.sid\)\s*\+\s*'\)<\/option>'/, '★ 주담당 목록에 「이름 (P-001)」이 남았다');
  assert.match(PAY, /esc\(staffLbl\(p, people\)\) \+ '<\/option>'/, '★ 주담당 목록이 이름표 함수를 안 거친다');
  const fn = cutFn(PAY, 'function ownerLabel(sid)');
  assert.match(fn, /staffLbl\(p, people\)/, '★ 알림 글자가 이름표 함수를 안 거친다');
  assert.doesNotMatch(fn, /' \(' \+ sid/, '★ 알림 글자에 사번을 이어 붙인다');
});

/* ── ③ 화면 글자 ── */
test('③★ 정부사업일정 — 🔗 배지·잇기 알림·직원 추가 목록·말풍선에 사번을 안 찍는다', () => {
  assert.doesNotMatch(GOV, />🔗 \$\{escAttr\(s\.erpSid\)\}</, '★ 🔗 배지 글자가 사번이다');
  assert.doesNotMatch(GOV, /title="[^"]*\$\{escAttr\((?:s\.erpSid|cand\[0\]\.sid)\)\}/, '★ 말풍선에 사번이 끼었다 — 마우스를 올리면 보인다');
  assert.match(GOV, /title="푸른이알피 계정과 연결됨"[^>]*>🔗 이알피</, '연결 배지가 이알피 연결을 말하지 않는다');
  assert.doesNotMatch(GOV, /사번 \$\{sid\} 연결됨/, '★ 잇기 알림에 사번이 찍힌다');
  assert.doesNotMatch(GOV, /\[u\.title,\s*u\.branch,[^\]]*u\.sid[^\]]*\]/, '★ 직원 추가 목록에 사번이 찍힌다');
  assert.match(GOV, /made\.push\(typeof PuStaffLabel!=='undefined'\?PuStaffLabel\.label\(u,ERP\.dir\|\|\[\]\):u\.name\)/, '★ 새로 더한 사람 알림에 사번이 붙는다');
});

test('③-2 사진첩 — 로그인 안 한 담당자는 «이름»으로 알리고, 이름을 못 찾으면 「이름 미확인」 (사번 안 적음)', () => {
  assert.doesNotMatch(PHOTOS, /\(사번 ' \+ m\.noAcct\.join/, '★ 알림에 사번만 적는다');
  assert.doesNotMatch(PHOTOS, /' \(사번 ' \+ esc\(noAcct/, '★ 안내 글에 「사번」만 적는다');
  const mg = cutFn(PHOTOS, 'function coMgrsFor(coName)');
  assert.match(mg, /PuPhotoStore\.namesOfSids\(noAcct\)/, '★ 이름을 찾아 오지 않는다');
  assert.match(mg, /if \(!noAcct\.length \|\| !PuPhotoStore\.namesOfSids\) return out;/, '공용 부품이 옛 판이면 멈춘다');
  assert.doesNotMatch(PHOTOS, /noAcctNames\[i\]\) \|\| s\b/, '★ 이름을 못 찾았을 때 사번을 대신 적는다');
  const S = require('../js/pu-photo-store.js');
  assert.equal(typeof (S.namesOfSids || (global.PuPhotoStore && global.PuPhotoStore.namesOfSids)), 'function', '공용 부품이 namesOfSids 를 내놓지 않는다');
});

test('③-3 기업정보함 퇴사자 이어받기 줄 — 글자는 「직위 · 퇴사」, 말풍선에도 사번 없음', () => {
  assert.doesNotMatch(CARDS, /\$\{esc\(p\.title\|\|''\)\} · \$\{esc\(p\.sid\|\|''\)\} · 퇴사/, '★ 퇴사자 줄 글자에 사번이 찍힌다');
  assert.doesNotMatch(CARDS, /title="사번 \$\{esc\(p\.sid\)\}"/, '★ 퇴사자 줄 말풍선에 사번이 끼었다');
});
