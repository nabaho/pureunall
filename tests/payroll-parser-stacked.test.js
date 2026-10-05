'use strict';
/* 직원 한 명이 «여러 줄»인 급여대장 — 줄 묶음으로 읽는다 (실측 2026-10-05)
 *
 * ■ 왜 있나
 *   어떤 대장은 머리글이 3줄이고 직원 한 명도 3줄이다. 같은 칸에 줄마다 다른 항목이 있다.
 *     머리글 1줄: 국민연금 | 갑근세 | 지급액 총계        직원 1줄: 89190 | 34630 | 2677500
 *     머리글 2줄: 건강보험 | 주민세 | 공제액 총계        직원 2줄: 99190 |  3460 |  248800
 *     머리글 3줄: 고용보험 |        | 차인 지급액        직원 3줄: 22290 |       | 2428700
 *   파서는 머리글 3줄을 한 칸으로 합쳐(「지급액 총계 공제액 총계 차인 지급액」) 읽었다. 그래서
 *   ① 실수령 자리에 지급총액(2,677,500)이 들어갔고 ② 주민번호가 있는 3번째 줄을 자료 시작으로
 *   잡아 첫 직원이 통째로 빠졌다. 다른 양식(성명이 2번째 줄)은 직원 10명이 30줄로 쪼개지고
 *   소득세가 지방세 칸에 들어갔다.
 *   규칙은 **파서 한 곳**(harness/parser_v1.py 의 score_stacked)에 있다.
 *
 * ■ 못 박는 것 — 파이썬 파서를 «진짜로» 돌린다(글자 찾기 아님)
 *   ① 3줄 대장: 첫 직원까지 모두, 지급총액·공제총액·실수령을 각자 제 줄에서 읽는다
 *      (지급총액 − 공제총액 = 실수령 이 맞는다)
 *   ② 성명이 머리글 2번째 줄에 있고 위에 묶음 제목 줄이 더 있는 양식도 같은 규칙으로 읽는다
 *   ③ 보통 대장(머리글 2줄 · 직원 한 줄)은 건드리지 않는다 — 줄 묶음으로 오인하지 않는다
 *   ④ 묶음 제목 한 칸(「공제내역」 아래 「국민연금」)만 겹친 대장도 건드리지 않는다
 *
 * 실행: node --test tests/payroll-parser-stacked.test.js
 * ⚠ 엑셀 라이브러리 없이 돈다 — 파서가 쓰는 시트 모양(iter_rows 등)만 흉내 낸 가짜 시트를 넣는다.
 * ⚠ 파이썬이 없으면 건너뛴다 — 단 CI 에서는 건너뛰지 않고 실패한다(ubuntu 에는 python3 가 있다). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const R = path.join(__dirname, '..');
const HARNESS = path.join(R, 'harness');
const ENV = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' });

const PY = (() => {
  for (const c of ['python3', 'python', 'py']) {
    const r = spawnSync(c, ['-c', 'import re'], { encoding: 'utf8', env: ENV, timeout: 30000 });
    if (r.status === 0) return c;
  }
  return null;
})();
function needPy(t) {
  if (PY) return true;
  assert.ok(!process.env.CI, 'CI 에 파이썬이 없습니다 — 파서 규칙을 한 번도 돌리지 않고 지나가게 됩니다');
  t.skip('python 없음');
  return false;
}

/* 가짜 시트 — 파서가 쓰는 것(title·max_row·max_column·iter_rows)만 갖췄다 */
const FAKE = `
import json, sys
sys.path.insert(0, ".")
import parser_v1 as P

class WS:
    def __init__(self, title, rows):
        self.title = title
        self.rows = rows
        self.max_row = len(rows)
        self.max_column = max(len(r) for r in rows)
    def iter_rows(self, min_row=1, max_row=None, max_col=None, values_only=True):
        mc = max_col or self.max_column
        for r in self.rows[min_row - 1:max_row]:
            yield tuple((list(r) + [None] * mc)[:mc])

class WB:
    def __init__(self, sheets):
        self.worksheets = [WS(t, rows) for t, rows in sheets]

def run(sheets):
    return P.pick_and_parse(WB(sheets))

KEYS = ("성명", "시급", "기본급", "지급총액", "소득세", "지방세", "국민연금", "건강보험", "고용보험", "공제총액", "실수령", "입사일")
def show(out):
    return [{k: e[k] for k in KEYS if k in e} for s in out for e in s["employees"]]
`;
function pyJson(code) {
  const r = spawnSync(PY, ['-c', FAKE + code], { cwd: HARNESS, encoding: 'utf8', env: ENV, timeout: 60000 });
  assert.equal(r.status, 0, '파이썬이 실패했습니다:\n' + r.stderr);
  const out = r.stdout.trim().split('\n');
  return JSON.parse(out[out.length - 1]);
}

test('① 3줄 대장: 첫 직원까지 모두, 지급총액·공제총액·실수령을 각자 제 줄에서 읽는다', (t) => {
  if (!needPy(t)) return;
  // 실물과 같은 모양(이름·번호만 가짜): 성명 1줄 · 빈 줄 · 주민번호 줄, 비고 칸에 「입사」
  const got = pyJson(`
rows = [
  [None, None, None, None, None, "임금 대장"],
  [],
  ["다온원", None, None, None, None, None, None, None, None, None, None, "2025-05-31"],
  ["순번", "성 명", "기본시급", "기본시간", "기 본 급", "식대보조비", "국민연금", "갑근세", "기숙사비", "지급액 총계", "비 고"],
  [None, None, "통상시급", "연장시간", "연장수당", "교통지원비", "건강보험", "주민세", "산재보험", "공제액 총계"],
  [None, None, None, "심야시간", "심야수당", "조정수당", "고용보험", None, None, "차인 지급액"],
  [1, "한누리", 10030, 176, 1765300, 100000, 89190, 34630, None, 2677500, "가나은행"],
  [None, None, 14204, 32, 321000, 100000, 99190, 3460, None, 248800, "NO"],
  [None, "800101-1234567", None, 26, 391200, None, 22290, None, None, 2428700, "입사", "2024-01-01", "퇴사"],
  [2, "이두레", 10030, 176, 1765300, 100000, 90540, 35600, 50000, 2707600, "가나은행"],
  [None, None, 14204, 32, 321000, 100000, 100400, 3560, None, 302700, "NO"],
  [None, "800101-1234567", None, 28, 421300, None, 22560, None, None, 2404900, "입사", "2021-03-02", "퇴사"],
  ["합계", None, None, None, 3530600, None, 179730, 70230, 50000, 5385100],
]
out = run([("상용임금", rows)])
print(json.dumps(show(out), ensure_ascii=False))
`);
  assert.deepEqual(got, [
    { 성명: '한누리', 시급: 10030, 기본급: 1765300, 지급총액: 2677500, 소득세: 34630, 지방세: 3460,
      국민연금: 89190, 건강보험: 99190, 고용보험: 22290, 공제총액: 248800, 실수령: 2428700 },
    { 성명: '이두레', 시급: 10030, 기본급: 1765300, 지급총액: 2707600, 소득세: 35600, 지방세: 3560,
      국민연금: 90540, 건강보험: 100400, 고용보험: 22560, 공제총액: 302700, 실수령: 2404900 },
  ]);
  for (const e of got) assert.equal(e.지급총액 - e.공제총액, e.실수령, e.성명 + ': 지급−공제≠실수령');
});

test('② 성명이 머리글 2번째 줄에 있고 위에 묶음 제목 줄이 더 있어도 같은 규칙으로 읽는다', (t) => {
  if (!needPy(t)) return;
  const got = pyJson(`
rows = [
  [None, None, None, None, None, "2025년 10월", None, None, "임   금   대   장"],
  [None, None, "두레", None, None, None, None, None, None, "산정기간 :"],
  [None, None, None, None, "근로일수/실제근로시간/임금", None, "임금산정내역", None, None, "공제(세금,4대보험)", None, None, "지급"],
  [None, None, None, None, None, None, "기본급 및 주휴수당//약정", None, None, None, None, None, None],
  [None, "사번", "직위", "근로일수", "약정연장근로", "적용시급", "직책수당", "갑근세", "국민연금", "학자금대출", "차인지급액"],
  [None, None, "성명", "근로시간", "약정야간근로", "기본급", "연차수당", "주민세", "건강보험", "무급휴가공제", None],
  [None, None, "입사일", "주휴시간", "약정휴일근로", "주휴수당", "지급 계", "고용보험", None, "공제 계", None],
  [None, 1, "과장", 23, 0, 16746, 200000, 124770, 151330, 0, 3423705],
  [None, None, "한누리", 174, 0, 2580861, 0, 12470, 123470, 0, None],
  [None, None, "2020-09-24", 35, 0, 519139, 3883065, 31340, None, 459360, None],
  [None, 2, "사원", 23, 0, 11961, 0, 22740, 92970, 0, 2297950],
  [None, None, "이두레", 174, 0, 1748325, 0, 2270, 74440, 0, None],
  [None, None, "2024-01-15", 35, 0, 351675, 2500000, None, 9630, 202050, None],
]
out = run([("임금대장", rows)])
print(json.dumps(show(out), ensure_ascii=False))
`);
  assert.deepEqual(got, [
    { 성명: '한누리', 시급: 16746, 기본급: 2580861, 지급총액: 3883065, 소득세: 124770, 지방세: 12470,
      국민연금: 151330, 건강보험: 123470, 고용보험: 31340, 공제총액: 459360, 실수령: 3423705, 입사일: '2020-09-24' },
    { 성명: '이두레', 시급: 11961, 기본급: 1748325, 지급총액: 2500000, 소득세: 22740, 지방세: 2270,
      국민연금: 92970, 건강보험: 74440, 공제총액: 202050, 실수령: 2297950, 입사일: '2024-01-15' },
  ]);
  for (const e of got) assert.equal(e.지급총액 - e.공제총액, e.실수령, e.성명 + ': 지급−공제≠실수령');
});

test('③ 보통 대장(머리글 2줄 · 직원 한 줄)은 줄 묶음으로 오인하지 않는다', (t) => {
  if (!needPy(t)) return;
  const got = pyJson(`
rows = [
  ["성명", "기본급", "지급", None, "공제", None, None, "실수령액"],
  [None, None, "식대", "지급합계", "소득세", "국민연금", "공제합계", None],
  ["한누리", 2500000, 200000, 2700000, 30000, 112500, 250000, 2450000],
  ["이두레", 2200000, 0, 2200000, 20000, 99000, 210000, 1990000],
  ["박다온", 2000000, 0, 2000000, 10000, 90000, 150000, 1850000],
]
out = run([("1월", rows)])
print(json.dumps({"stacked": P.score_stacked(WB([("1월", rows)]).worksheets[0]) is not None, "emps": show(out)}, ensure_ascii=False))
`);
  assert.equal(got.stacked, false);
  assert.deepEqual(got.emps.map((e) => [e.성명, e.지급총액, e.공제총액, e.실수령]), [
    ['한누리', 2700000, 250000, 2450000], ['이두레', 2200000, 210000, 1990000], ['박다온', 2000000, 150000, 1850000],
  ]);
});

test('④ 묶음 제목 한 칸만 겹친 대장(「공제금액」 아래 「국민연금」)도 건드리지 않는다', (t) => {
  if (!needPy(t)) return;
  const got = pyJson(`
rows = [
  [None, "임금지급대장"],
  ["순번", "성명", "기본급", "지급총액", "공제금액", None, None, "차인지급액"],
  [None, None, None, None, "국민연금", "건강보험", "공제계", None],
  [1, "한누리", 2500000, 2700000, 112500, 88620, 250000, 2450000],
  [2, "이두레", 2200000, 2200000, 99000, 77980, 210000, 1990000],
  [3, "박다온", 2000000, 2000000, 90000, 70900, 150000, 1850000],
]
out = run([("급여대장", rows)])
print(json.dumps({"stacked": P.score_stacked(WB([("급여대장", rows)]).worksheets[0]) is not None, "emps": show(out)}, ensure_ascii=False))
`);
  assert.equal(got.stacked, false);
  assert.deepEqual(got.emps.map((e) => [e.성명, e.지급총액, e.국민연금, e.공제총액, e.실수령]), [
    ['한누리', 2700000, 112500, 250000, 2450000], ['이두레', 2200000, 99000, 210000, 1990000],
    ['박다온', 2000000, 90000, 150000, 1850000],
  ]);
});
