'use strict';
// AI 로 보내기 전 개인정보 가림 — node --test tests/ai-mask.test.js
//
// 왜(2026-11-19): 상담 AI 요약(푸른이알피)·업무관리 AI 초안·인터뷰·지식 뽑기·기금 AI 가
//   의뢰인 이름·전화·주민번호를 가림 없이 바깥 AI 로 보내고 있었다(무료 API 크레딧 연결 검토 중 발견).
//   회사 원칙은 «외부 서비스에 고객 실명·주민번호를 넣지 않는다».
// 지키는 것: ① 가리개(js/pu-ai-mask.js)가 이름·번호를 꼬리표로 바꾸고 답에서 정확히 되돌린다
//            ② AI 를 부르는 세 앱이 가리개를 싣고, 보내기 전에 거치며, 가리개가 없으면 «보내지 않는다».
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const MODSRC = read('js/pu-ai-mask.js');
const M = require(path.join(ROOT, 'js', 'pu-ai-mask.js'));

/* 지어낸 값만 쓴다 */
const SAMPLE = '김철수(900101-1234567) 님, 푸른샘 주식회사 대표. 휴대폰 010-1234-5678, 사무실 02-123-4567, '
  + 'a.b@example.invalid, 계좌 110-123-456789, 사업자 123-45-67890, 카드 1234-5678-9012-3456, '
  + '외국인번호 9001015234567. 날짜 2026-11-19, 금액 1,500,000원, 사건 2026구합12345.';

test('★ 이름·번호가 바깥으로 나가는 글에 남지 않는다', () => {
  const mk = M.createMasker({ known: [{ value: '㈜푸른샘 김철수', label: '상담자' }] });
  const out = mk.mask(SAMPLE);
  ['김철수', '푸른샘', '900101-1234567', '010-1234-5678', '02-123-4567', 'a.b@example.invalid',
    '110-123-456789', '123-45-67890', '1234-5678-9012-3456', '9001015234567'].forEach((v) => {
    assert.ok(out.indexOf(v) < 0, '가리지 못했다: ' + v + '\n' + out);
  });
  assert.ok(mk.changed() && mk.count() >= 9);
});

test('★ 답에서 진짜 값으로 «정확히» 되돌린다 (초안을 사람이 다시 채울 일이 없다)', () => {
  const mk = M.createMasker({ known: [{ value: '김철수', label: '의뢰인' }, { value: '푸른샘 주식회사', label: '업체' }] });
  assert.equal(mk.unmask(mk.mask(SAMPLE)), SAMPLE);
  // AI 가 꼬리표를 문장 안에 섞어 써도 되돌린다
  const reply = '[의뢰인1] 님께 [전화1]로 연락. [업체1] 담당.';
  assert.equal(mk.unmask(reply), '김철수 님께 010-1234-5678로 연락. 푸른샘 주식회사 담당.');
});

test('같은 값은 같은 꼬리표, [전화1] 이 [전화10] 의 앞부분을 바꾸지 않는다', () => {
  const nums = Array.from({ length: 11 }, (_, i) => '010-1234-' + String(5600 + i));
  const mk = M.createMasker({});
  const out = mk.mask(nums.join(' ') + ' ' + nums[0]);
  assert.equal(out.split('[전화1]').length - 1, 2, '같은 번호는 같은 꼬리표');
  assert.ok(out.indexOf('[전화10]') >= 0 && out.indexOf('[전화11]') >= 0);
  assert.equal(mk.unmask(out), nums.join(' ') + ' ' + nums[0]);
});

test('날짜·금액·사건번호는 건드리지 않는다 (가리면 요약이 쓸모없어진다)', () => {
  const out = M.createMasker({}).mask(SAMPLE);
  ['2026-11-19', '1,500,000원', '2026구합12345'].forEach((v) => assert.ok(out.indexOf(v) >= 0, '가리면 안 된다: ' + v));
});

test('휴대폰 번호는 «계좌»가 아니라 «전화»로 가린다 (꼴이 같아도 이름표가 맞아야 AI 가 문맥을 안다)', () => {
  const mk = M.createMasker({});
  assert.match(mk.mask('연락처 010-1234-5678'), /\[전화1\]/);
  assert.match(mk.mask('계좌 110-123-456789'), /\[계좌\d+\]/);
});

test('한 칸에 여럿 적힌 이름은 조각도 가리고, 직함·회사 꼴 낱말은 남긴다', () => {
  assert.deepEqual(M.partsOf('㈜푸른샘 김철수 대표'), ['푸른샘', '김철수']);
  assert.deepEqual(M.partsOf('(주)한빛 / 이영희 부장'), ['한빛', '이영희']);
  const mk = M.createMasker({ known: [{ value: '㈜푸른샘 김철수 대표', label: '상담자' }] });
  const out = mk.mask('김철수 대표가 푸른샘 직원 문제로 문의');
  assert.ok(out.indexOf('김철수') < 0 && out.indexOf('푸른샘') < 0, out);
  assert.ok(out.indexOf('대표가') >= 0, '직함은 남긴다: ' + out);
});

test('빈 값·한 글자·「—」 같은 빈자리 표시는 가리지 않는다 (글이 깨진다)', () => {
  const mk = M.createMasker({ known: [{ value: '', label: '의뢰인' }, { value: '김', label: '의뢰인' }, { value: '—', label: '상대담당' }, null] });
  const t = '김 과장 — 확인';
  assert.equal(mk.mask(t), t);
  assert.equal(mk.changed(), false);
});

test('가린 것이 있을 때만 AI 에게 꼬리표 안내를 붙인다', () => {
  const none = M.createMasker({});
  none.mask('개인정보 없는 글');
  assert.equal(none.withNote('시스템'), '시스템');
  const some = M.createMasker({});
  some.mask('010-1234-5678');
  assert.ok(some.withNote('시스템').indexOf(M.NOTE) > 0);
});

test('마지막 문지기 — 실려 있으면 PuRrnMask 로 남은 주민번호 꼴을 한 번 더 지운다', () => {
  const saved = globalThis.PuRrnMask;
  let called = 0;
  globalThis.PuRrnMask = { maskRrnInText: (t) => { called++; return { text: t, count: 0 }; } };
  try {
    M.createMasker({}).mask('글');
    assert.equal(called, 1);
  } finally {
    if (saved === undefined) delete globalThis.PuRrnMask; else globalThis.PuRrnMask = saved;
  }
});

test('★ 옛 아이폰 사파리에서 터지는 뒤돌아보기(lookbehind)를 쓰지 않는다', () => {
  assert.ok(!/\(\?<[=!]/.test(MODSRC), 'js/pu-ai-mask.js 에 (?<= 나 (?<! 가 있다');
});

/* ── 앱이 실제로 거치나 ── */
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 를 찾지 못했다');
  let d = 0, on = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { d++; on = true; } else if (src[j] === '}') { d--; if (on && !d) return src.slice(i, j + 1); }
  }
  throw new Error(name + ' 끝을 못 찾음');
}

const APPS = [
  { file: 'work.html', fn: 'aiCall' },
  { file: 'fund.html', fn: 'aiCall' },
  { file: 'pu-erp.html', fn: 'aiSummarize' },
];

APPS.forEach(({ file, fn }) => {
  const src = read(file);
  test(`★ ${file} — 가리개를 싣고, ${fn} 이 보내기 전에 가리고 답을 되돌린다`, () => {
    assert.match(src, /<script src="js\/pu-ai-mask\.js\?v=\d+"><\/script>/, '가리개를 싣지 않았다');
    const body = grab(src, fn);
    assert.match(body, /PuAiMask/, '가리개를 부르지 않는다');
    assert.match(body, /\.mask\(/, '보내기 전에 가리지 않는다');
    assert.match(body, /\.unmask\(/, '답을 되돌리지 않는다');
    // 가리개가 없으면 보내지 않는다 — 「없으면 그냥 원문」이면 조용히 새어 나간다
    assert.match(body, /if\(\s*!_?MK\s*\|\|\s*!_?MK\.createMasker\s*\)/, '가리개가 없을 때 멈추지 않는다');
    // 원문을 그대로 싣는 자리가 남지 않았다
    assert.ok(!/content:\s*userText\b/.test(body) && !/content:'상담 내용:\\n'\+allText/.test(body), '가리지 않은 원문을 싣는다');
  });
});

test('★ 업무관리 — 업무 정보를 보내는 부름은 모두 «아는 이름»을 넘긴다', () => {
  const work = read('work.html');
  const calls = work.match(/aiCall\(AI_SYS_(?:DRAFT|ASK|HARVEST),[^\n]*?\)\s*;?\s*\}\)/g) || [];
  assert.ok(calls.length >= 1, '업무 정보를 보내는 AI 부름을 찾지 못했다');
  calls.forEach((c) => assert.match(c, /aiKnown\(id\)/, '아는 이름을 넘기지 않는다: ' + c));
  const k = grab(work, 'aiKnown');
  ['company', 'client', 'officer', 'mgr_main'].forEach((f) => assert.ok(k.indexOf('it.' + f) >= 0, 'aiKnown 이 ' + f + ' 를 안 넣는다'));
});
