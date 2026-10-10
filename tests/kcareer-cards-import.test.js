'use strict';
/* 🏷 기업정보함에서 수행 실적 가져오기 (대표 지시 2026-10-10 「1 넣어라 · 현장클리닉 일수도 · 4는 내용을 봐야」)
   못 박는 것:
     ① 줄 읽기 — 현장클리닉(신청·완료·클리닉위원·상담위원) · 기술보호(자문 기간→일수) · 모르는 줄은 null
     ② 일수는 지어내지 않는다 — 기술보호는 자문 기간(양끝 포함), 현장클리닉은 기록에 없으면 0(빈칸)
     ③ 화면 — 우리 노무사만 · 같은 줄 두 번 안 넣음(cardsRef) · 겹치면 사람이 고름 · 일수는 이알피 확정 일수만 자동 · 되돌리기
     ④ 일수는 수행 실적 표에 합쳐진다(적힌 건만) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const B = require('../js/kcareer-biz.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
function 떼기(머리) {
  const i = SRC.indexOf(머리); assert.ok(i > 0, 머리);
  let d = 0, s = false;
  for (let p = i; p < SRC.length; p++) { if (SRC[p] === '{') { d++; s = true; } else if (SRC[p] === '}') { d--; if (s && !d) return SRC.slice(i, p + 1); } }
}
const 현장 = '[현장클리닉] 2022-04-14 신청 · 2022-05-23 완료 · 클리닉위원 홍길동 · 지방청 상담위원 김철수 (중기부 비즈니스지원단, 충남)';
const 기술 = '[기술보호울타리] 2025-02-18 신청 · 사전예방 · 자문 2025-03-19~2025-03-21 · 최종완료 · 노무사 홍길동 (통합기술보호지원반)';

test('① 줄 읽기', () => {
  const c = B.parseCardsLine(현장);
  assert.equal(c.kind, 'clinic'); assert.equal(c.member, '홍길동'); assert.equal(c.counselor, '김철수');
  assert.equal(c.year, '2022', '현장클리닉 연도 = 완료한 해'); assert.equal(c.period, '2022.04.14~2022.05.23');
  assert.equal(c.where, '중기부 비즈니스지원단, 충남');
  const t = B.parseCardsLine(기술);
  assert.equal(t.kind, 'tech'); assert.equal(t.member, '홍길동'); assert.equal(t.year, '2025', '기술보호 연도 = 자문 시작한 해'); assert.equal(t.status, '최종완료');
  assert.equal(B.parseCardsLine('그냥 적어 둔 메모'), null, '모르는 줄은 안 읽는다');
  assert.equal(B.parseCardsLine('[현장클리닉] 2022-04-14 신청 · 클리닉위원 홍길동').year, '2022', '완료일이 없으면 신청한 해');
});

test('② 일수 — 기술보호는 자문 기간(양끝 포함) · 현장클리닉은 지어내지 않는다', () => {
  assert.equal(B.parseCardsLine(기술).days, 3);
  assert.equal(B.cardsDays('2025-07-10', '2025-07-10'), 1, '하루짜리');
  assert.equal(B.cardsDays('2025-07-12', '2025-07-10'), 0, '거꾸로면 0');
  assert.equal(B.parseCardsLine(현장).days, 0, '현장클리닉 기록에는 일수가 없다 → 빈칸');
  assert.notEqual(B.parseCardsLine(현장).key, B.parseCardsLine(기술).key);
  assert.equal(B.parseCardsLine(현장).key, B.parseCardsLine(현장).key, '같은 줄은 같은 열쇠 — 두 번 안 넣는다');
});

test('③ 화면 규칙', () => {
  const op = strip(떼기('async function openCardsImport('));
  assert.ok(/staff\[p\.member\]/.test(op), '우리 노무사만');
  assert.ok(/have\[ref\]\)\{ already\+\+; return; \}/.test(op), '이미 가져온 줄은 건너뛴다');
  assert.ok(/Number\(x\.consultDays\)>0/.test(op) && /현장클리/.test(op) && /_ciDigits\(x\.bizNo\|\|x\.bizno\)===k/.test(op), '현장클리닉 일수는 이알피 «확정» 일수만 — 사업자번호로 잇는다');
  assert.ok(/같은해 \? 'link:'\+같은해\.id : 'new'/.test(op), '같은 해면 연결을 미리 골라 두고 아니면 새로');
  const ap = strip(떼기('function ciApply('));
  assert.ok(/if\(!String\(rec\[f\]==null\?'':rec\[f\]\)\.trim\(\)\)/.test(ap), '연결은 «비어 있는 칸만» 보탠다 — 적힌 값은 안 덮는다');
  assert.ok(!/rec\.amt\b/.test(ap) && !/fill\('amt'/.test(ap), '금액은 건드리지 않는다');
  assert.ok(/kcNextNo\('CN',4,'consult',추가\)/.test(ap), '번호는 겹치지 않게');
  assert.ok(/cardsRef:ref/.test(ap) && /rec\.cardsRef=ref/.test(ap), '넣은 것에 열쇠를 단다');
  assert.ok(/function ciUndoRun\(/.test(SRC), '되돌리기');
  assert.ok((SRC.match(/onclick="openCardsImport\(\)"/g) || []).length >= 2, '컨설팅실적 + 수행 실적 탭 단추');
  assert.match(SRC, /\{key:'days',label:'수행일수',type:'number'\}/, '입력 창에도 일수');
});

test('④ 일수는 수행 실적 표에 합쳐진다(적힌 건만)', () => {
  const t = B.perfTable([{ type: '현장클리닉', year: '2022', days: '3' }, { type: '현장클리닉', year: '2023' }, { type: '기술', year: '2025', days: 1 }]);
  assert.equal(t.days, 4); assert.equal(t.rows.find((r) => r.type === '현장클리닉').days, 3);
  const g = B.perfBy([{ main: '홍길동', year: '2022', days: 3 }, { main: '홍길동', year: '2023' }], 'main');
  assert.equal(g[0].days, 3, '담당자별에서도');
  assert.ok(/일수\?'<th/.test(strip(떼기('function _bizPerfHtml('))) || /일수/.test(strip(떼기('function _bizPerfHtml('))), '사업별 표에 일수 열');
});
