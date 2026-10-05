'use strict';
/* 급여 금액의 원 미만 — 반올림 (대표 결정 2026-10-05 「원미만 반올림」)
 *
 * ■ 왜 있나
 *   대장 수식(일할 계산 등)이 칸에 원 미만을 남긴다. 엑셀은 #,##0 으로 반올림해 «보여»
 *   주지만 파서는 칸 속 값(436897.14285714284)을 읽는다. 그대로 두면 명세서에
 *   436,897.143 이 찍혔다(실측: 원 금액 칸 9,511개 · 34곳).
 *   규칙은 **엔진 한 곳**(engine/won_round.py → build_payroll_all.py)에 있다.
 *
 * ■ 못 박는 것 — 파이썬을 «진짜로» 돌린다(글자 찾기 아님)
 *   ① 반올림은 엑셀과 같다 — 0.5 는 올림(파이썬 round() 의 짝수 쪽이 아니다),
 *      2646319.9999999995 같은 부동소수 찌꺼기는 유효숫자 15자리로 먼저 맞춘다
 *   ② 시급·근무시간처럼 지급액이 아닌 칸은 건드리지 않는다
 *   ③ 지급총액 − 공제 = 실수령 이던 사람은 반올림 뒤에도 정확히 맞는다(1원도 안 어긋남)
 *   ④ 생성기(build_payroll_all.py)를 가짜 자료로 통째로 돌려, 결과 파일의 금액이 전부
 *      정수이고 명세서 셈(slipRows)이 임금총액 = 실수령 + 공제총액 을 정확히 낸다
 *
 * 실행: node --test tests/payroll-won-round.test.js
 * ⚠ 파이썬이 없으면 건너뛴다 — 단 CI 에서는 건너뛰지 않고 실패한다(ubuntu 에는 python3 가 있다).
 *   건너뛴 채 초록이면 규칙이 꺼져도 아무도 모른다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const R = path.join(__dirname, '..');
const ENGINE = path.join(R, 'engine');
const ENV = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' });

const PY = (() => {
  for (const c of ['python3', 'python', 'py']) {
    const r = spawnSync(c, ['-c', 'import decimal'], { encoding: 'utf8', env: ENV, timeout: 30000 });
    if (r.status === 0) return c;
  }
  return null;
})();
function needPy(t) {
  if (PY) return true;
  assert.ok(!process.env.CI, 'CI 에 파이썬이 없습니다 — 반올림 규칙을 한 번도 돌리지 않고 지나가게 됩니다');
  t.skip('python 없음');
  return false;
}
/* 파이썬 코드를 돌려 마지막 줄의 JSON 을 받는다 */
function py(code, opts) {
  const r = spawnSync(PY, ['-c', code], Object.assign({ cwd: ENGINE, encoding: 'utf8', env: ENV, timeout: 60000 }, opts || {}));
  assert.equal(r.status, 0, '파이썬이 실패했습니다:\n' + r.stderr);
  return r;
}
function pyJson(code) {
  const out = py('import json, sys\nsys.path.insert(0, ".")\n' + code).stdout.trim().split('\n');
  return JSON.parse(out[out.length - 1]);
}

test('① 반올림은 엑셀과 같다 — 0.5 는 올리고, 부동소수 찌꺼기는 먼저 걷는다', (t) => {
  if (!needPy(t)) return;
  const cases = [
    [436897.14285714284, 436897],
    [112300.17857142857, 112300],
    [83534.5, 83535],                 // 파이썬 round() 면 83534 — 대장(83,535)과 1원 어긋난다
    [2.5, 3],
    [2646319.9999999995, 2646320],
    [62999.99999999999, 63000],
    [4346885.000000001, 4346885],
    [-0.5, -1],                        // 연말정산 환급(음수) — 엑셀처럼 0 에서 먼 쪽
    [-12345.6, -12346],
    [128250.01928571428, 128250],
  ];
  const got = pyJson('from won_round import round_won\nprint(json.dumps([round_won(v) for v in ' +
    JSON.stringify(cases.map(c => c[0])) + ']))');
  cases.forEach((c, i) => assert.equal(got[i], c[1], c[0] + ' → ' + c[1] + ' 이어야 합니다(받은 값 ' + got[i] + ')'));
  /* 정수·빈칸·글자는 그대로 */
  const keep = pyJson('from won_round import round_won\nprint(json.dumps([round_won(1000), round_won(None), round_won("가"), round_won(True)]))');
  assert.deepEqual(keep, [1000, null, '가', true]);
});

test('② 시급·근무시간·근무일수는 건드리지 않는다 — 지급액이 아니다', (t) => {
  if (!needPy(t)) return;
  const e = { 성명: '가사람', 시급: 9860.28, 근무시간: 120.5, 근무일수: 21.5, 평균시간: 7.75,
    기본급: 1927789.0322580645, 고용보험: 21875.22, 실수령: 1905913.81 };
  const out = pyJson('from won_round import round_emp\nprint(json.dumps(round_emp(' + 'json.loads(' + JSON.stringify(JSON.stringify(e)) + '))[0]))');
  assert.equal(out.시급, 9860.28);
  assert.equal(out.근무시간, 120.5);
  assert.equal(out.근무일수, 21.5);
  assert.equal(out.평균시간, 7.75);
  assert.equal(out.기본급, 1927789);
  assert.equal(out.고용보험, 21875);
  assert.equal(out.실수령, 1905914);
  assert.equal(out.성명, '가사람');
});

test('③ 지급 − 공제 = 실수령 이던 사람은 반올림 뒤에도 정확히 맞는다', (t) => {
  if (!needPy(t)) return;
  /* 따로 반올림하면 어긋나는 꼴: 101 − 0 ≠ 100 → 실수령을 101 로 맞춘다 */
  const odd = { 지급총액: 100.5, 기타공제: 0.4, 실수령: 100.1 };
  /* 공제 항목 합과 공제총액: 11 + 2 ≠ 12 → 공제총액을 13 으로, 실수령도 따라 맞춘다 */
  const ded = { 지급총액: 1000.0, 소득세: 10.5, 지방세: 1.5, 공제총액: 12.0, 실수령: 988.0 };
  /* 원래부터 안 맞던 사람(비과세 등 대장 사정)은 손대지 않는다 — 반올림 일이 아니다 */
  const raw = { 지급총액: 2000.4, 공제총액: 100.0, 실수령: 1500.2 };
  const res = pyJson('from won_round import round_emp\nprint(json.dumps([round_emp(e) for e in ' +
    'json.loads(' + JSON.stringify(JSON.stringify([odd, ded, raw])) + ')]))');
  assert.deepEqual(res[0][0], { 지급총액: 101, 기타공제: 0, 실수령: 101 });
  assert.deepEqual(res[0][1], ['실수령']);
  assert.equal(res[1][0].공제총액, 13);
  assert.equal(res[1][0].실수령, 1000 - 13);
  assert.deepEqual(res[1][1], ['공제총액', '실수령']);
  assert.deepEqual(res[2][0], { 지급총액: 2000, 공제총액: 100, 실수령: 1500 });
  assert.deepEqual(res[2][1], []);

  /* 무작위 1만 명: 일할 계산처럼 소수가 붙은 지급·실수령, 정수/소수 공제 — 늘 맞아야 한다 */
  const bad = pyJson([
    'import random',
    'from won_round import round_emp, WON_FIELDS',
    'random.seed(20261005); bad = []',
    'for i in range(10000):',
    '    base = random.randint(500000, 5000000) * random.randint(1, 31) / 31',
    '    it = {"소득세": random.choice([random.randint(0, 90000), random.randint(0, 90000) + random.random()]),',
    '          "국민연금": random.randint(0, 2000) * 45 * 0.7, "고용보험": base * 0.009, "지방세": random.randint(0, 9000)}',
    '    d = sum(it.values())',
    '    e = dict(it, 지급총액=base, 실수령=base - d)',
    '    if i % 2: e["공제총액"] = d',
    '    o, _ = round_emp(e)',
    '    dd = o.get("공제총액", sum(o[k] for k in it))',
    '    if any(isinstance(o[k], float) for k in WON_FIELDS if k in o) or o["지급총액"] - dd != o["실수령"]: bad.append(e)',
    'print(json.dumps(bad[:3]))',
  ].join('\n'));
  assert.deepEqual(bad, [], '반올림 뒤 지급 − 공제 ≠ 실수령 이거나 소수가 남은 사람이 있습니다');
});

/* 명세서 셈 — 화면의 slipRows 를 잘라 와 진짜로 돌린다 */
const HTML = fs.readFileSync(path.join(R, 'payroll-os.html'), 'utf8');
function cut(name) {
  const m = HTML.match(new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}'));
  assert.ok(m, name + ' 함수를 찾을 수 없습니다 — 화면에서 사라졌다면 이 검사를 함께 고치십시오');
  return m[0];
}
function slipBox() {
  const box = { Number, Math, String };
  vm.createContext(box);
  new vm.Script('function won(n){ return (n==null)?"-":Number(n).toLocaleString(); }\n' + cut('slipRows') +
    '\nglobalThis.slipRows = slipRows;').runInContext(box);
  return box.slipRows;
}

test('④ 생성기를 통째로 돌리면 금액이 전부 정수이고 명세서가 정확히 맞는다', (t) => {
  if (!needPy(t)) return;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'won-round-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const out = path.join(root, '_harness_out');
  fs.mkdirSync(out);
  const emps = [
    { 성명: '가사람', 시급: 9860.28, 기본급: 112300.17857142857, 지급총액: 480000.64285714284,
      소득세: 12000, 지방세: 1200, 국민연금: 21600, 건강보험: 8500, 고용보험: 4320.0057857142857,
      공제총액: 47620.0057857142857, 실수령: 432380.637071428554 },
    { 성명: '나사람', 기본급: 2650000.4285714286, 과세총액: 2650000.4285714286, 지급총액: 2650000.4285714286,
      소득세: 30000, 지방세: 3000, 국민연금: 119250, 건강보험: 94000, 장기요양: 12170, 고용보험: 23850,
      실수령: 2367730.4285714286 },
    { 성명: '다사람', 기본급: 83534.5, 지급총액: 83534.5, 실수령: 83534.5, 소득세: 0 },
  ];
  fs.writeFileSync(path.join(out, 'parser_output.json'), JSON.stringify([
    { path: '담당\\다온원\\2026년 8월 급여대장_다온원.xlsx', ok: true, sheets: [{ sheet: '8월', employees: emps }] },
  ]));
  const r = spawnSync(PY, [path.join(ENGINE, 'build_payroll_all.py')],
    { cwd: R, encoding: 'utf8', env: Object.assign({}, ENV, { PAYROLL_DATA_ROOT: root }), timeout: 60000 });
  assert.equal(r.status, 0, '생성기가 실패했습니다:\n' + r.stderr + r.stdout);
  assert.match(r.stdout, /원 미만 반올림: 금액 칸 \d+개/, '몇 칸을 반올림했는지 알려야 합니다');

  const res = JSON.parse(fs.readFileSync(path.join(out, 'payroll_all.json'), 'utf8'));
  const rows = res.index['다온원'];
  assert.equal(rows.length, 1);
  const got = res.emp[rows[0].id];
  assert.equal(got.length, 3);
  const WON = ['기본급', '과세총액', '지급총액', '실수령', '공제총액', '소득세', '지방세', '국민연금',
    '건강보험', '장기요양', '고용보험', '연말정산', '기타공제', '일당'];
  got.forEach(e => WON.forEach(k => {
    if (e[k] != null) assert.ok(Number.isInteger(e[k]), e.성명 + ' ' + k + ' = ' + e[k] + ' — 원 미만이 남았습니다');
  }));
  const by = Object.fromEntries(got.map(e => [e.성명, e]));
  assert.equal(by.가사람.시급, 9860.28, '시급은 그대로');
  assert.equal(by.가사람.기본급, 112300);
  assert.equal(by.가사람.실수령, 432381);
  assert.equal(by.다사람.실수령, 83535, '0.5 는 올림');

  const slipRows = slipBox();
  got.forEach(e => {
    const s = slipRows(e);
    assert.equal(s.gross, s.net + s.dedTotal, e.성명 + ': 임금총액 ≠ 실수령 + 공제총액');
    [s.gross, s.net, s.dedTotal].forEach(v => assert.ok(Number.isInteger(v), e.성명 + ' 명세서 금액 ' + v + ' 에 원 미만'));
    s.pay.concat(s.ded).forEach(p => assert.ok(Number.isInteger(p[1]), e.성명 + ' ' + p[0] + ' = ' + p[1]));
    if (e.지급총액 != null) assert.equal(s.gross, e.지급총액, e.성명 + ': 명세서 임금총액이 대장 지급총액과 1원 어긋남');
  });
});
