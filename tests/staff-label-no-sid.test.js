'use strict';
/* 👤 이름 옆 사번 걷기 — 2·3단계 (대표 지시 2026-10-19)
   「푸른 통합시스템 모든곳에 권형하를 넣으면 p001 이 나온다 … 검토해라」 → 「추천대로 1단계부터 3단계까지 진행해라.
    내 신원 표시와 인사 화면은 남긴다.」

   ★ 이 검사가 못 박는 것은 «규칙»이다:
     ① 이름표는 이름만 — 같은 이름이 둘 이상일 때만 사번, 이름을 모르면 사번(js/pu-staff-label.js)
     ② 담당자를 «고르는» 목록은 이름표 함수를 거친다 — 글자에 사번을 즉석으로 이어 붙이지 않는다
        (값 value 는 그대로 사번이다 — 온톨로지: 사람은 sid 로 잇는다)
     ③ 화면 글자(배지·알림·안내)에 사번을 그냥 찍지 않는다 — 확인용 말풍선(title)은 괜찮다
   ⚠ 그대로 두는 곳은 이 검사가 안 본다: 내 신원 표시(포털 머리·pu-whoami), 인사·급여·권한 화면의 사번 칸,
     임금명세서. 그 자리는 각자의 검사(portal-identity·whoami 등)가 지킨다. */

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
test('①★ 이름만 — 같은 이름이 둘 이상일 때만 사번, 이름을 모르면 사번', () => {
  const ppl = [{ sid: 'P-001', name: '가나다' }, { sid: 'P-002', name: '라마바' }, { sid: 'P-003', name: '라마바' }];
  assert.equal(L.label(ppl[0], ppl), '가나다', '★ 겹치지 않는 이름에 사번을 붙였다');
  assert.equal(L.label(ppl[1], ppl), '라마바 · P-002', '★ 같은 이름인데 사번이 없다 — 고를 때 헷갈린다');
  assert.equal(L.label(ppl[2], ppl), '라마바 · P-003');
  assert.equal(L.label({ sid: 'P-009', name: '' }, ppl), 'P-009', '이름을 모르면 사번이라도 보여야 한다');
  assert.equal(L.label(ppl[1]), '라마바', '견줄 목록이 없으면 견주지 않는다');
  /* 같은 사람이 두 번 실려 있어도(명부 겹침) 동명이인이 아니다 */
  assert.equal(L.label(ppl[0], [ppl[0], Object.assign({}, ppl[0])]), '가나다');
  assert.equal(L.label({ sid: 'P-001', name: ' 가나다 ' }, [{ sid: 'P-004', name: '가나다' }, { sid: 'P-001', name: '가나다' }]), '가나다 · P-001',
    '앞뒤 빈칸이 달라도 같은 이름이다');
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
test('③★ 정부사업일정 — 🔗 배지·잇기 알림·직원 추가 목록에 사번을 그냥 찍지 않는다', () => {
  assert.doesNotMatch(GOV, />🔗 \$\{escAttr\(s\.erpSid\)\}</, '★ 🔗 배지 글자가 사번이다 — 사번은 말풍선(title)으로');
  assert.match(GOV, /title="푸른ERP 사번 \$\{escAttr\(s\.erpSid\)\} 와 연결됨"[^>]*>🔗 이알피</, '확인용 말풍선의 사번까지 걷었다 — 이을 때 견줄 값이 없다');
  assert.doesNotMatch(GOV, /사번 \$\{sid\} 연결됨/, '★ 잇기 알림에 사번이 찍힌다');
  assert.doesNotMatch(GOV, /\[u\.title,\s*u\.branch,\s*u\.sid\]/, '★ 직원 추가 목록에 사번이 늘 찍힌다 — 같은 이름일 때만');
  assert.match(GOV, /dupN\[String\(u\.name\|\|''\)\.trim\(\)\]\?u\.sid:''/, '같은 이름일 때 사번으로 가르는 길이 없다');
  assert.match(GOV, /made\.push\(typeof PuStaffLabel!=='undefined'\?PuStaffLabel\.label\(u,ERP\.dir\|\|\[\]\):u\.name\)/, '★ 새로 더한 사람 알림에 사번이 붙는다');
});

test('③-2 사진첩 — 로그인 안 한 담당자는 «이름»으로 알리고, 이름을 못 찾을 때만 사번', () => {
  assert.doesNotMatch(PHOTOS, /\(사번 ' \+ m\.noAcct\.join/, '★ 알림에 사번만 적는다');
  assert.doesNotMatch(PHOTOS, /' \(사번 ' \+ esc\(noAcct/, '★ 안내 글에 「사번」만 적는다');
  const mg = cutFn(PHOTOS, 'function coMgrsFor(coName)');
  assert.match(mg, /PuPhotoStore\.namesOfSids\(noAcct\)/, '★ 이름을 찾아 오지 않는다');
  assert.match(mg, /if \(!noAcct\.length \|\| !PuPhotoStore\.namesOfSids\) return out;/, '공용 부품이 옛 판이면 멈춘다 — 그때는 사번이라도 보여야 한다');
  const S = require('../js/pu-photo-store.js');
  assert.equal(typeof (S.namesOfSids || (global.PuPhotoStore && global.PuPhotoStore.namesOfSids)), 'function', '공용 부품이 namesOfSids 를 내놓지 않는다');
});

test('③-3 기업정보함 퇴사자 이어받기 줄 — 글자는 「직위 · 퇴사」, 사번은 말풍선', () => {
  assert.doesNotMatch(CARDS, /\$\{esc\(p\.title\|\|''\)\} · \$\{esc\(p\.sid\|\|''\)\} · 퇴사/, '★ 퇴사자 줄 글자에 사번이 찍힌다');
  assert.match(CARDS, /title="사번 \$\{esc\(p\.sid\)\}"/, '확인용 말풍선의 사번까지 걷었다');
});
