'use strict';
/* 「🔎 잘못 붙은 원본 찾기」 (대표 지시 2026-09-12 「잘못 붙은 원본찾기 만들어」)
   ────────────────────────────────────────────────────────────────────────
   ■ 왜
     실측: 기록 `위촉장2024-008`(발급일 2024.03.01)에 붙은 원본이
           「2025 직업계고 현장실습 및 취업지원 전담노무사 위촉장 (2025.12.26).pdf」였다.
     그 상태로 「🔍 원본 다시 읽기」를 돌려 저장하면 2024년 기록이 2025년으로 덮이고,
     이미 있는 `위촉장2025-001` 과 겹쳐 **한 해가 사라진다.**

   ■ 잣대 — 「기록의 날짜」와 「파일 이름의 날짜」 사이 거리(일)
       200일 넘음 → 의심 · 400일 넘음 → 강함
     ⚠★ 해(年)만 견주지 «않는다». 위촉일이 12월 31일이면 파일 이름에 다음 해가 붙는 일이
        흔하다(실측 「2026 서산시 …(2025.12.31).pdf」). 해만 보면 «맞는» 짝이 줄줄이 걸려
        나와 목록이 거짓 경보로 차고 진짜가 묻힌다.
     ⚠ 해만 적힌 이름은 그 해 7월 1일로 친다 → 같은 해 안에서는 최대 182일이라 안 걸린다.
     ⚠ 한쪽이라도 날짜를 모르면 판정하지 않는다.
   ■ 따로 보는 것: 한 파일이 두 줄 이상에 붙어 있으면 하나는 틀렸다(날짜와 무관하게 확실). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../js/kcareer-misattach.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

/* ══════ ★ 실제로 찾아낸 것들 ══════ */

test('★★★ 2024년 기록에 붙은 2025년 위촉장을 잡아낸다 — 이걸 놓치면 한 해가 덮인다', () => {
  const r = { id: '위촉장2024-008', issueDate: '2024.03.01', src: 'fs',
    relPath: '1. 위촉장/2025 직업계고 현장실습 및 취업지원 전담노무사 위촉장 (2025.12.26).pdf' };
  const c = M.check(r);
  assert.ok(c, '★★★ 못 잡았습니다 — 대표가 실제로 겪으신 그 짝입니다');
  assert.equal(c.level, '강함');
  assert.ok(c.days > 600, '떨어진 거리를 말해야 합니다: ' + c.days);
  assert.match(c.why, /떨어져/, '왜 걸렸는지 말해야 합니다');
  assert.equal(c.where, '폴더', '폴더 경로인지 기록에 적힌 이름인지 밝혀야 합니다');
});

test('★★ 남의 서류가 붙은 표창 — 실측(발급일 2025.12.23 ↔ 2017년 파일)', () => {
  const c = M.check({ id: '표창2017-001', issueDate: '2025.12.23',
    fname: '2017_더불어민주당_표창장_표창.pdf' });
  assert.ok(c && c.level === '강함', '★★ 8년 떨어진 짝을 놓쳤습니다');
  assert.equal(c.where, '기록', '기록에 적힌 이름임을 밝혀야 합니다');
});

test('★★ 실측 — 2015년 수료증에 2025년 파일', () => {
  const c = M.check({ id: 'C0037', issueDate: '2015.03.17', fname: '2025 한기대 고용노동교육수료.pdf' });
  assert.ok(c && c.level === '강함');
});

/* ══════ ★★ 걸리면 «안 되는» 것 — 거짓 경보가 진짜를 묻는다 ══════ */

test('★★★ 12월 31일 위촉 → 파일 이름에 다음 해 — 걸리면 안 된다', () => {
  /* 실측 「2026 서산시 비정규직근로자지원센터 고문노무사 위촉장 (2025.12.31).pdf」.
     이름 앞의 2026 만 보면 «맞는» 짝이 걸려 나온다. 온날짜가 있으면 그것을 쓴다. */
  const c = M.check({ id: 'W1', issueDate: '2025.12.31',
    relPath: '1. 위촉장/2026 서산시 비정규직근로자지원센터 고문노무사 위촉장 (2025.12.31).pdf', src: 'fs' });
  assert.equal(c, null, '★★★ 맞는 짝을 틀렸다고 합니다 — 목록이 거짓 경보로 찹니다');
});

test('★★ 같은 해 안에서는 아무리 멀어도 안 걸린다 — 해만 적힌 이름은 어림이다', () => {
  assert.equal(M.check({ id: 'W2', issueDate: '2024.01.05', fname: '2024 충청남도 위촉장.pdf' }), null);
  assert.equal(M.check({ id: 'W3', issueDate: '2024.12.20', fname: '2024 충청남도 위촉장.pdf' }), null);
});

test('★★ 해를 «모르면» 판정하지 않는다 — 모르는 것을 벌하지 않는다', () => {
  assert.equal(M.check({ id: 'W4', fname: '2024 충청남도 위촉장.pdf' }), null, '기록 날짜가 없습니다');
  assert.equal(M.check({ id: 'W5', issueDate: '2024.03.01', fname: '충청남도 위촉장.pdf' }), null,
    '파일 이름에 해가 없습니다');
});

test('붙은 원본이 아예 없으면 볼 것이 없다', () => {
  assert.equal(M.check({ id: 'W6', issueDate: '2024.03.01' }), null);
  assert.equal(M.check(null), null);
  assert.equal(M.check({}), null);
});

test('★ 날짜가 조금 떨어진 것은 «의심»으로만 — 등급을 갈라 내놓는다', () => {
  /* 2024.01.10 ↔ 2024.12.20 온날짜 = 345일 → 의심 */
  const c = M.check({ id: 'W7', issueDate: '2024.01.10', fname: '2024.12.20 위촉장.pdf' });
  assert.ok(c && c.level === '의심', '실제 ' + JSON.stringify(c));
  /* 400일 넘으면 강함 */
  const c2 = M.check({ id: 'W8', issueDate: '2024.01.10', fname: '2025.05.20 위촉장.pdf' });
  assert.equal(c2.level, '강함');
});

/* ══════ 한 파일이 여러 줄에 ══════ */

test('★★★ 같은 파일이 두 줄에 붙어 있으면 «날짜와 상관없이» 내놓는다', () => {
  /* 실측 4쌍 — 2017 대전질판위 · 2025 대산지방해양수산청 · 2013 위험성평가 · 2013 노사발전재단 */
  const a = { id: '위촉장2017-007', issueDate: '2017.04.28', fname: '2017 대전질판위 재위촉 (2017.04.28).pdf' };
  const b = { id: '위촉장2017-003', year: '2017', fname: '2017 대전질판위 재위촉 (2017.04.28).pdf' };
  assert.equal(M.check(a), null, '날짜만 보면 둘 다 멀쩡합니다');
  assert.equal(M.check(b), null);
  const res = M.scan([{ page: 'wiccok', rec: a }, { page: 'wiccok', rec: b }]);
  assert.equal(res.rows.length, 2, '★★★ 한 파일이 두 줄에 붙은 것을 놓쳤습니다 — 하나는 틀렸습니다');
  assert.equal(res.shared.length, 1);
  res.rows.forEach(function (x) {
    assert.equal(x.level, '강함');
    assert.match(x.why, /같은 파일이 2개 줄에/);
  });
});

test('★ 폴더 경로가 같으면 이름이 어떻든 같은 파일이다', () => {
  const a = { id: 'A', issueDate: '2020.01.01', src: 'fs', relPath: '1. 위촉장/가.pdf' };
  const b = { id: 'B', issueDate: '2020.01.01', src: 'fs', relPath: '1. 위촉장/가.pdf' };
  assert.equal(M.scan([{ page: 'wiccok', rec: a }, { page: 'wiccok', rec: b }]).shared.length, 1);
});

test('★★ 센 것이 위로 온다 — 눈이 위험한 것에 먼저 가야 한다', () => {
  /* ⚠ 「강함은 언제나 날짜가 더 멀다」고 두면 검사가 헛돈다 — 날짜를 안 보고 «겹침»만으로
     강함이 되는 줄이 있고(거리 없음), 그런 줄이 의심보다 아래로 밀리면 안 된다.
     고장넣기로 확인했다: 등급을 안 보고 날짜만으로 줄 세우면 이 검사가 빨개진다. */
  const 약 = { id: '약', issueDate: '2024.01.10', fname: '2024.12.20 위촉장.pdf' };   /* 의심 345일 */
  const 겹1 = { id: '겹1', issueDate: '2020.01.01', fname: '같은파일.pdf' };           /* 겹침 = 강함 */
  const 겹2 = { id: '겹2', issueDate: '2020.01.01', fname: '같은파일.pdf' };
  const res = M.scan([{ page: 'wiccok', rec: 약 },
                      { page: 'wiccok', rec: 겹1 }, { page: 'wiccok', rec: 겹2 }]);
  assert.equal(res.rows.length, 3);
  assert.equal(res.rows[0].level, '강함', '★★ 의심이 강함보다 위에 있습니다');
  assert.equal(res.rows[1].level, '강함');
  assert.equal(res.rows[2].rec.id, '약', '★★ 약한 것이 맨 아래여야 합니다');
  /* 날짜로 걸린 강함도 여전히 위다 */
  const 강 = { id: '강', issueDate: '2015.03.17', fname: '2025 한기대 수료.pdf' };
  const res2 = M.scan([{ page: 'wiccok', rec: 약 }, { page: 'complete', rec: 강 }]);
  assert.equal(res2.rows[0].rec.id, '강');
});

test('멀쩡한 줄만 있으면 아무것도 안 내놓는다', () => {
  const res = M.scan([{ page: 'wiccok', rec: { id: 'A', issueDate: '2020.05.01', fname: '2020 위촉장.pdf' } }]);
  assert.equal(res.rows.length, 0);
  assert.equal(res.shared.length, 0);
});

test('빈 것·이상한 것에 터지지 않는다', () => {
  assert.doesNotThrow(function () { M.scan(null); });
  assert.doesNotThrow(function () { M.scan([null, {}, { rec: null }]); });
});

/* ══════ 앱에 «실제로» 이어져 있나 ══════ */

test('★★ 앱이 모듈을 싣고, 위촉장 더보기에 문이 있다', () => {
  assert.match(SRC, /kcareer-misattach\.js\?v=\d+/, '★ 모듈을 안 싣습니다');
  assert.match(SRC, /onclick="openMisattach\(\)"/, '★★ 들어갈 문이 없으면 만든 것과 같습니다');
  assert.match(SRC, /id="modalMisattach"/, '창이 없습니다');
  /* ⚠ 판정은 모듈 한 곳 — 화면에서 다시 적으면 어긋난다 */
  const fn = SRC.slice(SRC.indexOf('function renderMisattach('), SRC.indexOf('function misDetach('));
  assert.match(fn, /KcareerMisattach\.scan\(/, '★★ 화면이 제 나름대로 판정합니다');
  assert.ok(!/200|400/.test(fn.replace(/56vh|width:\d+/g, '')), '★ 문턱 숫자를 화면에 다시 적었습니다');
});

test('★★★ 「떼기」는 «연결만» 뗀다 — 파일을 지우지 않는다', () => {
  const fn = SRC.slice(SRC.indexOf('function misDetach('), SRC.indexOf('function misUndo('));
  assert.ok(!/deleteFile\(/.test(fn), '★★★ 서류 원본을 지우고 있습니다 — 되돌릴 수 없습니다');
  assert.match(fn, /delete r\.relPath/, '경로를 떼야 합니다');
  assert.match(fn, /confirm\(/, '★★ 묻지 않고 떼면 안 됩니다');
  assert.match(fn, /misUndoStash\(/, '★★ 되돌릴 수 없으면 누르기 무섭습니다');
  /* ⚠ 앱 안 첨부는 여기서 안 건드린다 — 그쪽은 지우면 원본이 «없어진다» */
  assert.match(fn, /r\.src==='fs' && r\.relPath/, '★★ 앱 첨부까지 떼려 듭니다');
});

test('★★★ 떼면 그 «파일 이름»도 지운다 — 안 지우면 다음 채우기가 같은 파일을 다시 붙인다', () => {
  /* ⚠ fname 은 짝짓기에서 가장 센 증거다(이름이 같으면 +200 · 「확실」).
     떼기만 하고 남겨 두면 「📎 원본 없는 것 채우기」가 그 틀린 파일을 다시,
     그것도 확신 높게 붙인다 — 떼나 마나가 된다. */
  const fn = SRC.slice(SRC.indexOf('function misDetach('), SRC.indexOf('function misUndo('));
  assert.match(fn, /delete r\.fname/, '★★★ 틀린 파일 이름이 남아 그대로 다시 붙습니다');
  /* 그러나 «다른» 이름(등록 때 적어 둔 증거)은 남겨 둔다 */
  assert.match(fn, /String\(r\.fname\|\|''\)===nm/, '★ 아무 fname 이나 지우면 증거를 잃습니다');
});
