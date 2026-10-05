'use strict';
/* 급여대장 파서가 «급여가 아닌 칸»을 금액으로 읽던 두 구멍 (실측 2026-10-05)
 *
 * ■ 왜 있나
 *   payroll_all.json 의 지급총액 합이 약 1,088조 원이었다. 직원 86줄의 지급총액이
 *   10억이 넘었는데(예: 11~14자리), 기본급·공제·실수령은 모두 비어 있었다.
 *   ① 「○ 직원」 같은 **인사 명부** 시트의 「급여계좌」 머리글이 지급총액 동의어
 *      「급여계」에 걸려 **계좌번호가 지급총액**으로 들어갔다(성명·입사일·퇴사일과
 *      합쳐 필드 4개가 되어 급여대장으로 통과했다).
 *   ② 일용 대장 아래 붙은 **근태표**에서 「퇴사」라는 글자가 성명으로 잡혀,
 *      근무시간(2, 3.5)이 지급총액·4대보험·공제총액으로 들어갔다.
 *   규칙은 **파서 한 곳**(harness/parser_v1.py 의 FIELDS_NEG·NAME_BLOCK)에 있다.
 *
 * ■ 못 박는 것 — 파이썬 파서를 «진짜로» 돌린다(글자 찾기 아님)
 *   ① 「급여계좌」는 지급총액이 아니다 — 인사 명부 시트는 급여대장으로 뽑히지 않는다
 *   ② 진짜 대장에 「급여계좌」 열이 같이 있어도 지급총액은 진짜 지급총액 열에서 읽는다
 *   ③ 「급여계」「지급합계」처럼 원래 잡던 머리글은 그대로 지급총액이다(규칙을 너무 넓게 막지 않았다)
 *   ④ 근태표의 「퇴사」·「결근」 같은 상태 글자는 성명이 되지 않는다
 *
 * 실행: node --test tests/payroll-parser-misread.test.js
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
`;
function pyJson(code) {
  const r = spawnSync(PY, ['-c', FAKE + code], { cwd: HARNESS, encoding: 'utf8', env: ENV, timeout: 60000 });
  assert.equal(r.status, 0, '파이썬이 실패했습니다:\n' + r.stderr);
  const out = r.stdout.trim().split('\n');
  return JSON.parse(out[out.length - 1]);
}

/* 인사 명부 — 실물과 같은 모양(이름·입사일·퇴사일·월급여·급여계좌, 계좌는 숫자로 든 칸이 있다) */
const ROSTER = `[
  [None, "소속팀", "고용형태", "이름", "재직여부", "월급여", "입사일", "퇴사일자", "주민번호", "급여통장", "급여계좌"],
  [None, "본점", "정규직", "한누리", "재직", 3000000, "2017-08-01", None, "800101-1234567", "가나은행", 12345678901],
  [None, "본점", "정규직", "이두레", "재직", 2500000, "2020-06-15", None, "800101-1234567", "가나은행", 98765432109876],
  [None, "본점", "정규직", "박다온", "재직", 2600000, "2023-09-16", None, "800101-1234567", "가나은행", "110-000-000000"],
]`;

test('① 「급여계좌」는 지급총액이 아니다 — 인사 명부 시트는 급여대장으로 뽑히지 않는다', (t) => {
  if (!needPy(t)) return;
  const got = pyJson(`
rows = ${ROSTER}
out = run([("올 직원", rows)])
print(json.dumps({"field": P.match_field("급여계좌"), "sheets": [s["sheet"] for s in out],
                  "big": [e for s in out for e in s["employees"] if (e.get("지급총액") or 0) > 1e9]}, ensure_ascii=False))
`);
  assert.equal(got.field, null, '「급여계좌」 머리글이 ' + got.field + ' 로 잡힙니다');
  assert.deepEqual(got.sheets, [], '인사 명부 시트가 급여대장으로 뽑혔습니다');
  assert.deepEqual(got.big, []);
});

test('② 진짜 대장에 「급여계좌」 열이 같이 있어도 지급총액은 진짜 지급총액 열에서 읽는다', (t) => {
  if (!needPy(t)) return;
  const got = pyJson(`
rows = [
  ["성명", "급여계좌", "기본급", "지급총액", "소득세", "공제총액", "실수령액"],
  ["한누리", 12345678901, 2500000, 2700000, 30000, 250000, 2450000],
  ["이두레", 98765432109876, 2200000, 2200000, 20000, 210000, 1990000],
]
out = run([("1월", rows)])
print(json.dumps([{k: e.get(k) for k in ("성명", "지급총액", "공제총액", "실수령")}
                  for s in out for e in s["employees"]], ensure_ascii=False))
`);
  assert.deepEqual(got, [
    { 성명: '한누리', 지급총액: 2700000, 공제총액: 250000, 실수령: 2450000 },
    { 성명: '이두레', 지급총액: 2200000, 공제총액: 210000, 실수령: 1990000 },
  ]);
});

test('③ 원래 잡던 머리글(급여계·지급합계·총지급액)은 그대로 지급총액이다', (t) => {
  if (!needPy(t)) return;
  const got = pyJson(`
print(json.dumps({h: P.match_field(h) for h in ("급여계", "급여 계", "지급합계", "총지급액", "지급액 계", "기지급액", "급여통장")}, ensure_ascii=False))
`);
  assert.deepEqual(got, {
    급여계: '지급총액', '급여 계': '지급총액', 지급합계: '지급총액', 총지급액: '지급총액',
    '지급액 계': '지급총액', 기지급액: null, 급여통장: null,
  });
});

test('④ 근태표의 「퇴사」·「결근」 같은 상태 글자는 성명이 되지 않는다', (t) => {
  if (!needPy(t)) return;
  // 실물과 같은 모양: 위에 일용 급여대장, 아래에 날짜별 근태표(시간 숫자 + 상태 글자)
  const got = pyJson(`
H = [None] * 30
def row(*cells):
    r = list(cells) + [None] * (30 - len(cells))
    return r[:30]
rows = [
  row("6월 일용직 급여대장"),
  row("순번", "성명", "근무일", "기본일급", "근로일수", None, "기본급", "휴일근무수당", "지급합계",
      "4대보험 공제내역(근로자)", None, None, None, None, None, None, "공제합계금액", "실급여"),
  row(None, None, None, None, None, None, None, None, None,
      "건강보험", "장기요양보험", "국민연금", "고용보험", "소득세", "주민세", None),
  row(1, "한누리", "6/1~6/26", 80000, 19, None, 1520000, 0, 1520000, 59530, 7620, 61200, 13540, None, None, None, 141890, 1378110),
  row("합계", None, None, None, None, None, 1520000, 0, 1520000, 59530, 7620, 61200, 13540, 0, None, 0, 141890, 1378110),
  row(),
  row(None, None, None, None, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26),
  row(1, "한누리", None, "정상근무(1)", 8, 8, None, None, 8, None, 8, 8, 8, None, None, 8, 8, 3, 8, 8, None, None, 8, 8, 8, 6, "결근"),
  row(None, None, None, "연장근무(1.5)", 2, 2, None, None, 2, None, 2, 2, 2, None, None, 2, 3.5, "조퇴", 4.5, 3.5,
      None, None, 2, 2, 2, "외출", None, None, None, "퇴사"),
  row(None, None, None, "휴일근무(1.5)", None, None, 5.5, None, None, 8, None, None, None, None, None, None, None, None,
      None, None, 8, None, None, None, None, None, None, None, None, "결근"),
]
out = run([("6월 일용(수정)", rows)])
print(json.dumps([{k: e.get(k) for k in ("성명", "지급총액", "공제총액")} for s in out for e in s["employees"]], ensure_ascii=False))
`);
  assert.deepEqual(got.map((e) => e.성명).filter((n) => n !== '한누리'), [],
    '근태표의 상태 글자가 성명으로 잡혔습니다: ' + JSON.stringify(got));
  const 진짜 = got.find((e) => e.성명 === '한누리');
  assert.ok(진짜, '진짜 직원 줄이 사라졌습니다');
  assert.equal(진짜.지급총액, 1520000);
  assert.equal(진짜.공제총액, 141890);
});
