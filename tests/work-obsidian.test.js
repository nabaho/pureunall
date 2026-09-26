'use strict';
// 옵시디언 금고로 내보내기 — node --test tests/work-obsidian.test.js
//
// 대표 지시 2026-09-26: "옵시디언만 우선 연결시켜달라."
//
// 이 검사가 지키는 것 — 조용히 깨지는 것들만 골랐다.
//   ① 사람·사업장 장의 [[연결]]이 업무 파일 «이름과 글자 그대로» 같다
//      → 한 글자만 어긋나도 옵시디언 그래프가 통째로 안 이어진다. 오류도 안 난다.
//   ② 같은 이름이 둘이면 덮어쓰지 않는다 (윈도는 Abc 와 abc 가 같은 파일이다)
//   ③ 파일 이름에 금지문자·[[ ]] 를 깨뜨리는 글자가 안 남는다
//   ④ 주민번호 지우개가 없으면 «내보내기가 멈춘다» (조용히 새지 않는다)
//   ⑤ 그 지우개가 work.html 에 «실제로 실려 있다» (배관 양 끝)
//   ⑥ 성과급 자리는 아예 안 읽는다
//   ⑦ 단추와 함수가 둘 다 있다 (한쪽만 있으면 눌러도 아무 일이 없다)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');

function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}

const NAMES = ['obsName', 'obsYaml', 'obsLink', 'obsModel', 'obsItemMD',
  'obsPersonMD', 'obsCoMD', 'obsKbMD', 'obsGuideMD', 'obsWrite'];

function box(win) {
  const b = {
    console, String, Object, Array, Promise, Error, JSON, Date, setTimeout,
    OBS_DIR: '업무관리',
    OBS_SUB: { person: '사람', co: '사업장', item: '업무', kb: '지식' }
  };
  if (win) b.window = win;
  vm.createContext(b);
  vm.runInContext(NAMES.map(grab).join('\n'), b);
  return b;
}

const B = box();

/* ── ③ 파일 이름 ─────────────────────────────────────────────── */

test('파일 이름에 윈도 금지문자가 안 남는다', () => {
  const out = B.obsName('가나/다:라*마?바"사<아>자|차\\카');
  assert.equal(/[\\/:*?"<>|]/.test(out), false, '금지문자가 남았습니다: ' + out);
});

test('[[ ]] 를 깨뜨리는 글자도 뺀다 — # ^ [ ]', () => {
  const out = B.obsName('가나#다^라[마]바');
  assert.equal(/[#^[\]]/.test(out), false, '연결을 깨뜨리는 글자가 남았습니다: ' + out);
});

test('앞뒤 점을 뗀다 — 숨김파일·확장자 흉내를 막는다', () => {
  assert.equal(B.obsName('..가나..').indexOf('.'), -1);
  assert.equal(B.obsName('.htaccess').charAt(0) === '.', false);
});

test('빈 이름은 절대 안 나온다 — 이름 없는 파일은 못 만든다', () => {
  ['', null, undefined, '   ', '///', '...'].forEach(v => {
    assert.ok(B.obsName(v).length > 0, '빈 이름이 나왔습니다: ' + JSON.stringify(v));
  });
});

test('아주 긴 이름은 잘린다 — 윈도 경로 길이에 걸린다', () => {
  assert.ok(B.obsName('가'.repeat(300)).length <= 80);
});

/* ── 앞머리(front matter) ─────────────────────────────────────── */

test('앞머리 값의 따옴표·줄바꿈이 막힌다 — 한 칸이 깨지면 그 장 전체가 깨진다', () => {
  const v = B.obsYaml('가"나\n다');
  assert.equal(v.indexOf('\n'), -1, '줄바꿈이 남았습니다');
  assert.ok(/^".*"$/.test(v), '따옴표로 안 감쌌습니다: ' + v);
  assert.ok(v.indexOf('\\"') >= 0, '안쪽 따옴표를 안 막았습니다: ' + v);
});

/* ── 연결 ────────────────────────────────────────────────────── */

test('연결은 «전체 경로»로 건다 — 금고에 원래 있던 같은 이름 노트와 안 엉킨다', () => {
  assert.equal(B.obsLink('사람', '홍길동'), '[[업무관리/사람/홍길동]]');
});

test('이름이 없으면 연결을 안 만든다 — [[이름없음]] 이 잔뜩 생기지 않게', () => {
  assert.equal(B.obsLink('사람', ''), '');
  assert.equal(B.obsLink('사람', '  '), '');
});

/* ── ② 같은 이름 ─────────────────────────────────────────────── */

const nameOf = it => it.nm || '';

test('같은 이름이 둘이면 뒤엣것에 번호를 붙인다 — 덮어쓰면 한 건이 사라진다', () => {
  const m = B.obsModel([
    { _id: 'a', company: '가나상사', nm: '부당해고' },
    { _id: 'b', company: '가나상사', nm: '부당해고' }
  ], nameOf);
  assert.notEqual(m.items[0]._obsFile, m.items[1]._obsFile, '두 업무가 같은 파일을 씁니다');
});

test('대소문자만 다른 이름도 «같은 파일»로 본다 — 윈도가 그렇다', () => {
  const m = B.obsModel([
    { _id: 'a', company: 'ABC', nm: 'x' },
    { _id: 'b', company: 'abc', nm: 'x' }
  ], nameOf);
  assert.notEqual(m.items[0]._obsFile.toLowerCase(), m.items[1]._obsFile.toLowerCase(),
    '대소문자만 다른 두 업무가 서로를 덮어씁니다');
});

/* ── ① 가장 중요한 것 — 연결이 실제로 이어지나 ──────────────── */

const SAMPLE = [
  { _id: 'i1', company: '가나상사', nm: '부당해고', cat: '사건', due: '2026-10-02',
    mgr_main: { sid: '1', name: '홍길동' }, mgr_subs: [{ sid: '2', name: '김철수' }],
    brief: '해고 다툼', last: { d: '2026-09-20', t: '서면 접수' } },
  { _id: 'i2', company: '다라산업', nm: '임금체불', cat: '사건', state: 'done',
    mgr_main: { sid: '1', name: '홍길동' }, mgr_subs: [] }
];

test('사람 장의 [[연결]]이 업무 파일 이름과 «글자 그대로» 같다', () => {
  const m = B.obsModel(SAMPLE.map(x => Object.assign({}, x)), nameOf);
  const md = B.obsPersonMD('홍길동', m.people['홍길동'], '2026-09-26');
  m.items.forEach(it => {
    assert.ok(md.indexOf('[[업무관리/업무/' + it._obsFile + ']]') >= 0,
      '사람 장이 이 업무를 못 가리킵니다: ' + it._obsFile);
  });
});

test('사업장 장의 [[연결]]도 업무 파일 이름과 같다', () => {
  const m = B.obsModel(SAMPLE.map(x => Object.assign({}, x)), nameOf);
  const it = m.items[0];
  const md = B.obsCoMD('가나상사', m.cos['가나상사'], '2026-09-26');
  assert.ok(md.indexOf('[[업무관리/업무/' + it._obsFile + ']]') >= 0, '사업장 장이 업무를 못 가리킵니다');
});

test('업무 장은 사업장·담당·함께 맡은 사람을 모두 가리킨다', () => {
  const m = B.obsModel(SAMPLE.map(x => Object.assign({}, x)), nameOf);
  const it = m.items[0];
  const md = B.obsItemMD(it, null, { name: '부당해고', end: '종료', today: '2026-09-26' });
  assert.ok(md.indexOf('[[업무관리/사업장/가나상사]]') >= 0, '사업장 연결이 없습니다');
  assert.ok(md.indexOf('[[업무관리/사람/홍길동]]') >= 0, '담당 연결이 없습니다');
  assert.ok(md.indexOf('[[업무관리/사람/김철수]]') >= 0, '함께 맡은 사람 연결이 없습니다');
});

test('부담당도 그 사람 장에 「함께 맡은 업무」로 들어간다', () => {
  const m = B.obsModel(SAMPLE.map(x => Object.assign({}, x)), nameOf);
  assert.ok(m.people['김철수'], '부담당이 사람 목록에 없습니다');
  assert.equal(m.people['김철수'].sub.length, 1);
  assert.equal(m.people['김철수'].main.length, 0);
});

/* ── 업무 한 장의 내용 ───────────────────────────────────────── */

test('진행 중인 업무는 「진행」, 끝난 업무는 끝낸 방식이 적힌다', () => {
  const a = B.obsItemMD(SAMPLE[0], null, { name: 'x', end: '종료', today: 't' });
  const b = B.obsItemMD(SAMPLE[1], null, { name: 'y', end: '이관', today: 't' });
  assert.ok(/상태: "진행"/.test(a), '진행이 안 적혔습니다');
  assert.ok(/상태: "이관"/.test(b), '끝낸 방식이 안 적혔습니다');
});

test('기록을 넣으면 날짜 차례로 적힌다 — 뒤죽박죽이면 읽을 수 없다', () => {
  const md = B.obsItemMD(SAMPLE[0], [
    { d: '2026-09-20', t: '나중 일', byName: '홍길동' },
    { d: '2026-09-01', t: '먼저 일', byName: '홍길동' }
  ], { name: 'x', end: '종료', today: 't' });
  assert.ok(md.indexOf('먼저 일') < md.indexOf('나중 일'), '기록 차례가 거꾸로입니다');
});

test('기록이 없으면 «최근 한 줄»이라도 남긴다 — 빈 장을 만들지 않는다', () => {
  const md = B.obsItemMD(SAMPLE[0], null, { name: 'x', end: '종료', today: 't' });
  assert.ok(md.indexOf('서면 접수') >= 0, '최근 기록이 안 들어갔습니다');
});

test('빈 기록 줄은 버린다 — 날짜만 있고 내용 없는 칸이 생기지 않게', () => {
  const md = B.obsItemMD(SAMPLE[0], [{ d: '2026-09-02', t: '   ' }], { name: 'x', end: '종료', today: 't' });
  assert.ok(md.indexOf('### 2026-09-02') === -1, '빈 기록이 한 칸을 차지했습니다');
});

/* ── 지식 ────────────────────────────────────────────────────── */

test('「지금은 다름」이 붙은 지식은 맨 위에 그 사실을 적는다', () => {
  const md = B.obsKbMD({ _kind: 'person', kl: '김감독관', t: '오전에만 통화된다', x: '', flags: ['x'] }, 't');
  assert.ok(md.indexOf('지금은 다름') >= 0, '정정 요청이 안 보입니다 — 읽는 사람이 그대로 믿습니다');
});

test('사람·업체에 붙은 지식은 그 장으로 이어진다', () => {
  const a = B.obsKbMD({ _kind: 'person', kl: '김감독관', t: 'ㄱ', x: '' }, 't');
  const b = B.obsKbMD({ _kind: 'company', kl: '가나상사', t: 'ㄴ', x: '' }, 't');
  assert.ok(a.indexOf('[[업무관리/사람/김감독관]]') >= 0);
  assert.ok(b.indexOf('[[업무관리/사업장/가나상사]]') >= 0);
});

/* ── ④ 주민번호 문지기 ───────────────────────────────────────── */

function fakeDir(sink) {
  return { getFileHandle: () => Promise.resolve({ createWritable: () => Promise.resolve({
    write: t => { sink.text = t; return Promise.resolve(); }, close: () => Promise.resolve() }) }) };
}

test('지우개가 안 실려 있으면 내보내기가 «멈춘다» — 조용히 새지 않는다', async () => {
  const b = box();                      // window 자체가 없다
  await assert.rejects(() => b.obsWrite(fakeDir({}), '가', '본문'),
    /주민번호 지우개/, '지우개가 없는데 그냥 썼습니다');
});

test('지우개가 있으면 주민번호를 지우고 쓴다', async () => {
  const sink = {};
  const b = box({ PuRrnMask: { maskRrnInText: t => ({ text: t.replace(/\d{6}-\d{7}/g, '******-*******'), count: 1 }) } });
  await b.obsWrite(fakeDir(sink), '가', '홍길동 900101-1234567 입니다');
  assert.equal(sink.text.indexOf('900101-1234567'), -1, '주민번호가 파일로 나갔습니다');
});

/* ── ⑤⑥⑦ 배관 양 끝 ────────────────────────────────────────── */

test('work.html 이 주민번호 지우개를 «실제로» 싣는다', () => {
  assert.ok(W.indexOf('js/pu-rrn-mask.js') >= 0,
    '지우개를 안 싣고 있습니다 — 내보내기가 늘 멈춥니다');
});

test('옆줄 단추와 함수가 둘 다 있다 — 한쪽만 있으면 눌러도 아무 일이 없다', () => {
  assert.ok(W.indexOf('onclick="obsModal()"') >= 0, '옆줄에 단추가 없습니다');
  assert.ok(W.indexOf('function obsModal(') >= 0, '함수가 없습니다');
  assert.ok(W.indexOf('function obsRun(') >= 0, '내보내기 함수가 없습니다');
});

/* ⚠ 주석은 걷어 내고 «도는 코드»만 본다 — 여기 주석에는 「성과급은 안 내보낸다」는
   설명이 있고, 그 설명 자체가 finance_income 이라는 낱말을 담고 있다.
   글자로만 찾으면 설명을 지우게 되고, 그러면 왜 안 읽는지가 사라진다. */
function obsCode() {
  const mark = W.indexOf('옵시디언 금고로 내보내기');
  const j = W.indexOf('엑셀 이관 JSON 가져오기');
  assert.ok(mark >= 0 && j > mark, '옵시디언 토막을 못 찾았습니다');
  /* ⚠ 토막의 «머리 주석이 시작하는 자리»부터 잘라야 한다. 표식만 보고 자르면 잘린
     자리가 주석 한가운데라 여는 /* 가 없고, 그러면 주석이 안 걷혀 설명이 코드로 셈해진다. */
  const i = W.lastIndexOf('/*', mark);
  return W.slice(i >= 0 ? i : mark, j)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

test('성과급 자리는 아예 안 읽는다', () => {
  const blk = obsCode();
  ['finance_income', 'perf_confirm', 'PC_PATH'].forEach(k => {
    assert.equal(blk.indexOf(k), -1, '성과급 자리를 건드립니다: ' + k);
  });
});

test('회사 메일함도 안 읽는다 — 업무관리가 지키는 울타리 그대로', () => {
  assert.equal(obsCode().indexOf('mailbox'), -1, 'mailbox 를 건드립니다');
});

test('한 방향이다 — 금고를 «읽어서 되돌리는» 길이 없다', () => {
  const blk = obsCode();
  ['getFile(', 'removeEntry('].forEach(k => {
    assert.equal(blk.indexOf(k), -1, '금고를 읽거나 지웁니다: ' + k);
  });
});

test('안내 장에 한 방향·안 지움·평문이라는 것이 적힌다', () => {
  const md = B.obsGuideMD({ person: 1, co: 2, item: 3, kb: 4 }, '2026-09-26', '홍길동');
  ['한 방향', '지우지 않습니다', '평문'].forEach(k => {
    assert.ok(md.indexOf(k) >= 0, '안내에 빠졌습니다: ' + k);
  });
});
