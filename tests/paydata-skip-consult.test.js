'use strict';
/* 급여데이터함 — 컨설팅 메일은 담지 않는다 (대표 결정 2026-10-07)
   실행: node --test tests/paydata-skip-consult.test.js

   ⚠ 왜 이 검사가 생겼나: 공용 칸 「업체관리에 없는 주소」 52건 가운데 35건이 급여가 아니라
     컨설팅 자료였다(재무제표·조직도·인터뷰지). 컨설팅 회사는 업체관리에 넣지 않기로 해서
     이 메일들은 언제나 「없는 주소」로 쌓이고, 「✉ 잇기」를 누르면 컨설팅 회사가 급여
     거래처로 잘못 이어진다.
     이 검사가 지키는 것은 둘이다 — 컨설팅은 거른다, 그리고 **급여 거래처 메일은 무슨 말이
     있어도 절대 안 거른다**(급여 자료가 사라지는 쪽이 훨씬 해롭다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = path.join(__dirname, '..');
const MR = require(path.join(R, 'functions', 'mail-receive.js'));
const FN = fs.readFileSync(path.join(R, 'functions', 'index.js'), 'utf8');

/* 주석은 걷고 본다 — 잘 쓴 주석이 글자 검사를 통과시키면 안 된다 */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

const CO = { id: 'co_1', name: '가나상사', managerMain: 'p-001', email: 'hr@gana.example' };
const OWN = { U1: { name: '김대표', email: 'p001@pureun.kr', lastAt: 1 } };
const IDX = MR.buildCompanyIndex([CO]);
const STRANGER = '담당 <info@nara.example>';
const consult = o => MR.consultMail(Object.assign({ from: STRANGER, subject: '', filenames: [] }, o), IDX, OWN);

/* ══════ ① 거르는 것 — 실제로 쌓였던 꼴 ══════ */

test('★ 모르는 주소 + 제목에 컨설팅 말 → 거른다', () => {
  assert.equal(consult({ subject: 'RE: [푸른노무법인] 산업일자리전환 컨설팅 진행을 위한 기초 자료 요청의 건' }), true);
  assert.equal(consult({ subject: '[가나]비즈니스지원단 현장클리닉 성과추적관리 문의' }), true);
});

test('★ 제목은 「요청자료」뿐이어도 첨부 이름에 컨설팅 자료가 있으면 거른다', () => {
  assert.equal(consult({ subject: '요청자료', filenames: ['2.1 직무기술서 (1).docx'] }), true);
  assert.equal(consult({ subject: '늦어서 죄송합니다.', filenames: ['20260929.pdf', '2026년 통합진단 인터뷰 양식_경영진.hwp'] }), true);
  assert.equal(consult({ subject: '요청자료', filenames: ['직원명단.xlsx'] }), false, '첨부 이름을 안 보면 이것과 구별이 안 됩니다');
});

test('실제 오타 꼴도 잡는다 — 「산업일저리전환」·「인텨뷰」', () => {
  assert.equal(consult({ subject: '산업일저리전환 자료 보냅니다' }), true);
  assert.equal(consult({ subject: '자료', filenames: ['인텨뷰(경영자 및 경영진).pdf'] }), true);
});

/* ══════ ② 절대 안 거르는 것 ══════ */

test('★★ 업체관리에 있는 주소(급여 거래처)는 컨설팅 말이 있어도 담는다', () => {
  assert.equal(MR.consultMail({ from: '가나 <hr@gana.example>', subject: '기술보호컨설팅 관련 처리부탁드립니다',
    filenames: ['9월 급여대장.xlsx'] }, IDX, OWN), false);
});

test('★ 모르는 주소여도 컨설팅 말이 없으면 거르지 않는다 — 급여 자료일 수 있다', () => {
  assert.equal(consult({ subject: '퇴직자 원천영수증', filenames: ['직현병국퇴.pdf'] }), false);
  assert.equal(consult({ subject: '9월 입퇴사자 요청 서식.xlsx', filenames: ['9월 입퇴사자 요청 서식.xlsx', '직원 근태수당.xlsx'] }), false);
});

test('★ 담당자 폴더에 손으로 옮긴 메일은 거르지 않는다 — 손이 자동보다 세다', () => {
  assert.equal(consult({ box: '2.급여+사무대행/김대표', subject: '인사노무 컨설팅 기초자료' }), false);
  assert.equal(consult({ box: '2.급여+사무대행', subject: '인사노무 컨설팅 기초자료' }), true, '사람 폴더가 아니면 거릅니다');
});

/* ══════ ③ 서버 한 회차에 실제로 걸려 있다 ══════ */

function loopBody() {
  const s = strip(FN);
  const i = s.indexOf('async function runPaydataMailOnce');
  assert.ok(i >= 0, 'runPaydataMailOnce 를 찾을 수 없습니다');
  return s.slice(i);
}

test('★ 첨부·본문을 담기 «전에» 메일 한 통 단위로 거른다', () => {
  const b = loopBody();
  const m = b.match(/if\s*\(\s*MR\.consultMail\(/);
  assert.ok(m, '한 회차에서 consultMail 로 거르지 않습니다(조건으로 써야 합니다)');
  const at = m.index;
  assert.ok(at < b.indexOf('payMailStoreOne('), '첨부를 담은 뒤에 거르면 이미 공용 칸에 들어갑니다');
  assert.ok(at < b.indexOf('payMailStoreBody('), '본문 줄도 담기 전에 걸러야 합니다');
  /* 걸리면 그 메일은 거기서 끝난다 — 아래 담기로 흘러가면 거른 뜻이 없다 */
  const branch = b.slice(at, b.indexOf('}', b.indexOf('continue', at)) + 1);
  assert.match(branch, /continue/, '걸린 메일이 담기로 흘러갑니다');
  assert.match(branch, /logRows\.push\(/, '★ 받은 메일 목록에 까닭이 남아야 「왜 안 들어왔나」를 봅니다');
});

test('거른 수를 마지막 회차 기록에 남긴다', () => {
  const b = loopBody();
  const last = b.slice(b.indexOf('/mailconf/lastScan'));
  assert.match(last.slice(0, 400), /consult\s*:/, 'lastScan 에 거른 수가 없습니다');
});
