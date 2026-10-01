'use strict';
/* 📋 설립준비위원 명단 읽기 (대표 「명단 옮겨라. 그리고 나머지 기금도 모두 자동으로 옮겨지게」 2026-10-01)
 * 옛 인가신청서의 위원 칸·별첨 명단 → 참여사업장 근로자대표·사용자대표의 빈 칸, 남는 사람은 사업장 밖 위원.
 * 이름·날짜는 모두 가짜. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; } else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('끝을 못 찾음: ' + name);
}
const A = (() => {
  const box = {};
  new Function([
    (/var CM_LABEL=.*;/.exec(SRC) || [''])[0], (/var CM_POS=.*;/.exec(SRC) || [''])[0],
    'function _officersOf(f){ return (f&&f.officers)||[]; }',
    grabFn('_relNm'), grabFn('_siteWrep'), grabFn('_siteUrep'), grabFn('_isCommittee'), grabFn('_siteCommittee'), grabFn('_prepCommittee'),
    grabFn('_cmDate'), grabFn('parseCommitteeText'), grabFn('_cmNear'), grabFn('_cmSame'), grabFn('_cmCands'),
    grabFn('committeePlan'), grabFn('_cmPatch'), grabFn('_cmBlocksText'), grabFn('_cmMergeExtra'),
    'Object.assign(this,{parse:parseCommitteeText,plan:committeePlan,patch:_cmPatch,blocks:_cmBlocksText,merge:_cmMergeExtra,prep:_prepCommittee});',
  ].join('\n')).call(box);
  return box;
})();

test('한글 표 줄(측 · 성명 · 생년월일 · 직책) — 측 칸은 첫 줄에만 있어도 다음 줄로 이어진다', () => {
  const t = [
    '기금법인 설립준비위원회 위원 | 근로자측 | 성명 | 가나다 | 생년월일 | 1978. 04. 16 | 직책 | 차장',
    '가나라 | 1982. 05. 31 | 과장',
    '사용자측 | 성명 | 마바사 | 생년월일 | 650309 | 직책 | 대표',
    '분사무소 | 대표자 성명 | 전화번호',
    '2021년 5월 17일 신청인 아자차',
  ].join('\n');
  assert.deepEqual(A.parse(t), [
    { side: '근로자측', name: '가나다', birth: '1978-04-16', title: '차장' },
    { side: '근로자측', name: '가나라', birth: '1982-05-31', title: '과장' },
    { side: '사용자측', name: '마바사', birth: '1965-03-09', title: '대표' },
  ]);
});

test('OCR 한 줄 글 — 직책이 없으면 다음 사람 이름을 직책으로 잡지 않는다 · 서명일은 사람이 아니다', () => {
  const t = '근로자 측 성명 가나다 1978-04-16 다라마 1996.02.06 사원 사용자측 성명 바사아 1961.2.27 대표이사 위와 같이 2021. 5. 17. 신청합니다';
  assert.deepEqual(A.parse(t), [
    { side: '근로자측', name: '가나다', birth: '1978-04-16', title: '' },
    { side: '근로자측', name: '다라마', birth: '1996-02-06', title: '사원' },
    { side: '사용자측', name: '바사아', birth: '1961-02-27', title: '대표이사' },
  ]);
});

test('측 표시 앞(대표자 칸)의 생년월일·같은 사람 두 번은 담지 않는다', () => {
  const t = '대표자 성명(한글) 가나다 생년월일 1961.02.27\n근로자측 | 라마바 | 800101 | 과장\n라마바 | 800101 | 과장';
  assert.deepEqual(A.parse(t).map((o) => o.name), ['라마바']);
});

const SITES = [
  { _id: 's1', name: '가나기계', ceo: '김대표', wrep_name: '' },
  { _id: 's2', name: '다라전자', ceo: '이대표,박대표', wrep_name: '최근로', wrep_title: '대리' },
  { _id: 's3', name: '마바상사', ceo: '정대표', urep_name: '한위원', wrep_name: '' },
  { _id: 's4', name: '문닫은곳', ceo: '김대표', status: 'closed' },
];
test('맞추기 — 근로자대표 이름·대표자(공동대표 낱낱)·사용자대표 이름 · 한 글자 다르면 한 곳일 때만', () => {
  const r = A.plan([
    { side: '근로자측', name: '최근로' }, { side: '사용자측', name: '박대표' }, { side: '사용자측', name: '한위웜' },
    { side: '사용자측', name: '김대표' }, { side: '근로자측', name: '없는이' },
  ], SITES);
  assert.deepEqual(r.map((x) => x.sid), ['s2', 's2', 's3', 's1', '']);
  assert.match(r[2].why, /한 글자/);
  assert.equal(r[3].sid, 's1', '문 닫은 곳은 맞추지 않는다');
});

test('넣을 칸 — 빈 칸만, 대표자와 같으면 urep_same, 다른 사람이 적힌 사업장엔 아무것도 안 넣는다', () => {
  assert.deepEqual(A.patch({ side: '근로자측', name: '최근로', birth: '1980-01-01', title: '과장' }, SITES[1]), { wrep_birth: '1980-01-01' });
  assert.deepEqual(A.patch({ side: '근로자측', name: '새사람', birth: '1980-01-01' }, SITES[1]), {}, '남의 생년월일이 붙지 않게');
  assert.deepEqual(A.patch({ side: '근로자측', name: '새사람', birth: '1980-01-01', title: '사원' }, SITES[0]),
    { wrep_name: '새사람', wrep_title: '사원', wrep_birth: '1980-01-01' });
  assert.deepEqual(A.patch({ side: '사용자측', name: '김대표', birth: '1960-01-01', title: '대표이사' }, SITES[0]),
    { urep_same: true, urep_title: '대표이사', urep_birth: '1960-01-01' });
  assert.deepEqual(A.patch({ side: '사용자측', name: '딴사람', title: '이사' }, SITES[0]), { urep_name: '딴사람', urep_title: '이사' });
  assert.deepEqual(A.patch({ side: '사용자측', name: '딴사람', title: '이사' }, SITES[2]), {}, '사용자대표가 따로 적힌 곳');
});

test('★ 사업장 밖 위원(prep_committee)도 설립 서식 위원이다 — 측별로, 사업장 사람과 겹치면 한 번', () => {
  const f = { prep_committee: [
    { side: '근로자측', name: '밖사람', birth: '1984-07-23', title: '차장', company: '가나상사' },
    { side: '사용자측', name: '김대표', title: '대표이사' },
  ] };
  const w = A.prep(f, '근로자측', SITES);
  assert.deepEqual(w.map((o) => o.name), ['최근로', '밖사람']);
  assert.equal(w[1].company, '가나상사'); assert.equal(w[1]._from, 'prep');
  assert.deepEqual(A.prep(f, '사용자측', SITES).map((o) => o.name), ['김대표', '이대표', '한위원'], '김대표는 사업장에서 이미 셌다');
});

test('담을 때 합치기 — 같은 측·같은 이름은 한 번', () => {
  const m = A.merge([{ side: '근로자측', name: '가나다' }], [{ side: '근로자측', name: '가 나다' }, { side: '사용자측', name: '가나다', birth: '1960-01-01' }]);
  assert.equal(m.length, 2); assert.equal(m[1].side, '사용자측'); assert.equal(m[1].birth, '1960-01-01');
});

test('한글 표 블록 → 줄마다 「칸 | 칸」', () => {
  const t = A.blocks([{ type: 'paragraph', text: '별첨' }, { type: 'table', table: { cells: [[{ text: '근로자측' }, { text: '가나다' }, null, { text: '1978.04.16' }]] } }]);
  assert.equal(t, '별첨\n근로자측 | 가나다 |  | 1978.04.16');
  assert.deepEqual(A.parse(t).map((o) => o.birth), ['1978-04-16']);
});

test('배선 — 👤 사람 단추·도움말·한글 읽개', () => {
  assert.match(SRC, /onclick="cmImportPick\(\)"/);
  assert.match(SRC, /'cm\.import':\{t:/);
  assert.match(SRC, /<script src="js\/pu-kordoc-text\.js\?v=\d+"><\/script>/);
  assert.match(grabFn('cmImportApply'), /prep_committee/);
  assert.match(grabFn('cmImportApply'), /_audit\(/);
});

test('생년월일 6자리 뒤 성별 자리(760607-2)는 걷고, 날짜가 잇달아 나오면(세로로 읽힌 표) 짝짓지 않는다', () => {
  assert.deepEqual(A.parse('근로자측 | 성명 | 가나다 | 생년월일 | 760607-2 | 직책 | 차장'),
    [{ side: '근로자측', name: '가나다', birth: '1976-06-07', title: '차장' }]);
  assert.deepEqual(A.parse('근로자측 성명 가나다 라마바 생년월일 1968-03-10 1954-10-20 팀장 사원'), []);
});

test('직책 낱말(차장·사원…)은 이름 자리에 와도 사람으로 잡지 않는다', () => {
  assert.deepEqual(A.parse('사용자측 | 실장 | 차장 | 1995-09-16 | 사원'), []);
});

test('확인 창 함수들이 문법째로 살아 있다(따옴표가 어긋나면 화면 전체가 멈춘다)', () => {
  ['cmImportShow', 'cmImportApply', 'cmExtraShow', 'cmExtraDel', 'cmImportRun', '_cmFileText'].forEach((n) => {
    assert.doesNotThrow(() => new Function(grabFn(n)), n);
  });
});

test('확인 창을 다시 그릴 때 앞 창을 닫는다 — 고를 때마다 창이 겹쳐 쌓이지 않게', () => {
  ['cmImportShow', 'cmExtraShow', 'wrepBulkShow'].forEach((n) => assert.match(grabFn(n), /closeM\(\);[\s\S]*showModal\(/, n));
});
