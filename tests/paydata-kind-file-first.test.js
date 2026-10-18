'use strict';
/* 급여데이터함 종류 짐작 — «파일 이름이 먼저다» (2026-10-17)
   실행: node --test tests/paydata-kind-file-first.test.js

   ⚠ 왜 이 검사가 생겼나: 종류를 파일 이름 + 메일 제목 «한 덩어리»로 보았다.
     고객이 「퇴사자 상실신고 부탁드립니다」 제목에 「9월 급여대장.xlsx」를 붙여 보내면
     제목의 「상실·신고」가 먼저 걸려 «우리 산출물»이 됐고, 산출물은 확인 없이 바로
     넣는 종류(SURE_KINDS)라 급여대장이 산출물 서랍으로 조용히 들어갔다.
     잘못 넣으면 아무도 모른다 — 안 넣으면 대기 칸에 보인다.

   지키는 것.
   ① 파일 이름이 종류를 말하면 제목은 안 본다
   ② 제목에서는 신고·취득·상실을 산출물로 안 본다(고객 제목의 그 말은 부탁이다)
   ③ 못 가르면 종류가 비고, 비면 바로 넣지 않는다
   ④ 서버 tagFor 와 화면 guessTag 가 «제목이 있을 때도» 같은 답을 낸다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');
const MR = require(path.join(R, 'functions', 'mail-receive.js'));
const html = fs.readFileSync(path.join(R, 'pu-paydata.html'), 'utf8');
const storeSrc = fs.readFileSync(path.join(R, 'js', 'pu-paydata-store.js'), 'utf8');

function loadGuess() {
  const m = html.match(/function guessTag\s*\([\s\S]*?\n\}/);
  assert.ok(m, '화면 guessTag 함수를 찾을 수 없습니다 — 이름이 바뀌었으면 이 검사도 따라 고칩니다');
  const sb = { window: {}, console };
  sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(storeSrc, { filename: 'pu-paydata-store.js' }).runInContext(sb);
  sb.window.PuPaydataStore.init({ uid: 'U1' });
  new vm.Script('const S = window.PuPaydataStore;\n' + m[0] + '\nwindow.guessTag = guessTag;',
    { filename: 'guess.js' }).runInContext(sb);
  return sb.window.guessTag;
}

const kindOf = (filename, subject) => MR.tagFor({ filename, subject }, null).kind;

/* ══════ ① 파일 이름이 먼저 ══════ */

test('★★ 「상실신고 부탁」 제목에 붙은 급여대장은 «급여대장»이다 — 우리 산출물이 아니다', () => {
  assert.equal(kindOf('9월 급여대장.xlsx', '[가나상사] 퇴사자 상실신고 부탁드립니다'), 'ledger',
    '제목의 「상실·신고」가 파일 이름을 이겼습니다 — 급여대장이 산출물 서랍으로 들어갑니다');
  assert.equal(kindOf('9월 근태.xlsx', '신규 입사자 취득신고 요청'), 'attend');
  assert.equal(kindOf('근로계약서_홍길동.pdf', '4대보험 취득 부탁드립니다'), 'contract');
});

test('★ 파일 이름에 있는 신고·취득·상실은 예전처럼 산출물이다', () => {
  /* 이름이 «서류 자체»를 말할 때는 산출물이 맞다 — 이 갈래는 바꾸지 않았다 */
  ['상실신고서_홍길동.pdf', '05월 수정신고.pdf', '취득신고 접수증.pdf', '9월 급여명세서.pdf']
    .forEach(n => assert.equal(kindOf(n, '자료 송부'), 'output', n));
});

/* ══════ ② 제목에서는 부탁을 산출물로 보지 않는다 ══════ */

test('★★ 이름이 아무것도 말하지 않으면 — 제목의 신고·취득·상실은 산출물로 안 본다', () => {
  assert.equal(kindOf('퇴사자명단.xlsx', '4대보험 상실신고 부탁드립니다'), '',
    '고객의 부탁 메일 첨부를 «우리 산출물»로 짐작합니다');
  assert.equal(kindOf('IMG_3070.jpeg', '신규 입사자 취득 신고 요청드립니다'), '');
});

test('제목의 명세서·이체는 산출물로 본다 — 단 부탁 말이 함께면 안 본다', () => {
  assert.equal(kindOf('9월.pdf', '9월 급여명세서 송부'), 'output');
  assert.equal(kindOf('a.pdf', '급여명세서 재발행 요청'), '',
    '「재발행 요청」 메일의 첨부를 산출물로 짐작합니다 — 부탁이지 산출물이 아닙니다');
});

/* ══════ ③ 비면 바로 넣지 않는다 ══════ */

test('★ 종류를 못 가른 부탁 메일 첨부는 바로 서랍에 넣지 않는다', () => {
  const AT = Date.UTC(2026, 9, 3, 1, 0, 0);
  const tag = MR.tagFor({ filename: '퇴사자명단.xlsx', subject: '9월 상실신고 부탁드립니다', at: AT }, null);
  const v = MR.sureFor({ filename: '퇴사자명단.xlsx', at: AT },
    { seat: 'U1', how: 'addr', tag: Object.assign({}, tag, { companyId: 'co_1' }) });
  assert.equal(v.ok, false, '종류가 빈 것을 바로 넣습니다');
  assert.ok(v.why.indexOf('종류') >= 0, '까닭에 「종류」가 없습니다: ' + v.why);
});

/* ══════ ④ 서버와 화면이 같다 — 제목이 있을 때도 ══════
   tests/paydata-autofile 은 제목 없이만 견준다. 이번 고장은 «제목»에서 났으므로
   제목을 붙여 견준다. */
test('★★ 제목이 있어도 서버 tagFor 와 화면 guessTag 가 같은 종류를 낸다', () => {
  const guess = loadGuess();
  const pairs = [
    ['9월 급여대장.xlsx', '퇴사자 상실신고 부탁드립니다'],
    ['퇴사자명단.xlsx', '4대보험 상실신고 부탁드립니다'],
    ['IMG_3070.jpeg', '신규 입사자 취득 신고 요청드립니다'],
    ['9월.pdf', '9월 급여명세서 송부'],
    ['a.pdf', '급여명세서 재발행 요청'],
    ['상실신고서_홍길동.pdf', '자료 송부'],
    ['9월 근태.xlsx', '신규 입사자 취득신고 요청'],
    ['홍길동.pdf', '근로계약서 보내드립니다'],
    ['자료.xlsx', '9월 급여 기초자료'],
    ['자료.xlsx', '8월 급여 수정 요청'],
    ['9월.zip', ''],
  ];
  pairs.forEach(([f, s]) => {
    const a = MR.tagFor({ filename: f, subject: s }, null).kind;
    const b = guess({ filename: f, note: s }, []).kind;
    assert.equal(b === 'etc' ? '' : b, a, '종류가 다릅니다: ' + f + ' / ' + s);
  });
});
