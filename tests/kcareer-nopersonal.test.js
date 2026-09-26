'use strict';
/* 🔒 대표님 개인정보가 «경력관리 파일»에 다시 들어오지 못하게 (대표 지시 2026-09-26 「1 해라」)
   ─────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     2026-08-30 `624150d` 가 개인정보를 kcareer.html 에서 뺐고 회귀검사로 못박았다.
     그런데 그 검사는 **kcareer.html 한 파일만** 보았다. 그 사이 검사 파일과 순수 모듈
     주석에 생년월일·집 주소·자격번호가 «예시»로 다시 쌓였다 — 이 저장소는 **공개**다.
     (2026-09-26 실측: 18개 파일 90곳.)

   ■ 그래서 여기서 못 박는 것
     ① 경력관리가 가진 **모든** 파일(kcareer.html · js/kcareer-*.js · tests/kcareer-*.test.js)을 본다
     ② 대표님 실제 값이 한 글자도 없어야 한다
     ③ 주민등록번호 «꼴»은 미리 정한 가짜만 쓴다

   ⚠★ 찾을 글자를 **날것으로 적지 않는다** — 그러면 이 검사 파일이 곧 유출이 된다.
     base64 로 적어 두고 돌릴 때 되살린다. 숨기려는 것이 아니라, 검색·색인에
     그대로 걸리지 않게 하려는 것이다.
   ⚠ 가짜를 바꾸실 일이 있으면 아래 ALLOW 에 더한다. 진짜 값을 여기 적지 말 것. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const R = path.join(__dirname, '..');
const 되살림 = (b64) => Buffer.from(b64, 'base64').toString('utf8');

/* 대표님 실제 값 — base64 로 적는다(날것으로 적으면 이 파일이 곧 유출이다) */
const 금지 = [
  ['NzUwMTA3', '주민등록번호 앞 여섯 자리(생년월일)'],
  ['MTY4NDkxNg==', '주민등록번호 뒤 일곱 자리'],
  ['MTk3NS4wMS4wNw==', '생년월일'],
  ['MTk3NTAxMDc=', '생년월일(여덟 자리)'],
  ['7Jqp6rOh', '집 주소(동 이름)'],
  ['MDQxLTU1Ni0wMDM1', '사무실 전화'],
  ['YmFieWxhd3llcg==', '개인 이메일'],
  ['MDEwMjgwMjQ2MDE=', '휴대전화'],
  ['7Jyg7Iug7Iuc', '(자리 채움 — 쓰지 않음)'],
  ['7KCcMzAxNu2YuA==', '공인노무사 자격번호'],
].map(([b, 무엇]) => ({ 글: 되살림(b), 무엇 }))
 .filter((x) => x.무엇.indexOf('자리 채움') < 0);

/* 써도 되는 가짜 주민등록번호 — 새 가짜가 필요하면 «여기에 적고» 쓴다.
   ⚠ 목록이 있어야 «진짜가 새로 들어온 것»을 가려낼 수 있다. 목록을 지우면 이 검사는
     아무것도 못 막는다. 대신 걸렸을 때 무엇을 하면 되는지 알림에 적어 둔다. */
const ALLOW = [
  '800101-1234567',   /* 기본 가짜 */
  '000000-0000000',   /* 「아무 값도 아님」을 보이는 자리 */
  '900101-2345678', '801231-2345678', '001011-1234567',
];

function 내파일() {
  const out = cp.execSync('git ls-files kcareer.html js/kcareer-*.js tests/kcareer-*.test.js',
    { cwd: R, encoding: 'utf8' });
  return out.trim().split(/\r?\n/).filter(Boolean)
    .filter((f) => path.basename(f) !== 'kcareer-nopersonal.test.js');
}

test('★★★ 경력관리 파일에 대표님 실제 개인정보가 없다 — 이 저장소는 «공개»다', () => {
  const 파일들 = 내파일();
  assert.ok(파일들.length > 30, '볼 파일을 못 찾았습니다(' + 파일들.length + '개)');
  const 걸린것 = [];
  for (const f of 파일들) {
    const s = fs.readFileSync(path.join(R, f), 'utf8');
    for (const { 글, 무엇 } of 금지) {
      if (s.indexOf(글) >= 0) 걸린것.push(f + ' — ' + 무엇);
    }
  }
  assert.deepEqual(걸린것, [],
    '★ 대표님 실제 개인정보가 들어 있습니다. 가짜 값으로 바꿔 주세요:\n  '
    + 걸린것.join('\n  '));
});

test('★★ 주민등록번호 «꼴»은 미리 정한 가짜만 쓴다 — 새 번호를 지어 넣지 않는다', () => {
  const 걸린것 = [];
  for (const f of 내파일()) {
    const s = fs.readFileSync(path.join(R, f), 'utf8');
    for (const m of s.match(/\d{6}\s*-\s*\d{7}/g) || []) {
      if (ALLOW.indexOf(m.replace(/\s/g, '')) < 0) 걸린것.push(f + ' — ' + m);
    }
  }
  assert.deepEqual(걸린것, [],
    '★ 허락하지 않은 주민등록번호 꼴이 있습니다. 가짜는 ' + ALLOW.join(' · ')
    + ' 를 쓰시거나, 정말 새 가짜가 필요하면 이 검사의 ALLOW 에 더해 주세요:\n  '
    + 걸린것.join('\n  '));
});

test('★ 옛 빗장도 살아 있다 — kcareer.html 의 USER_INFO 는 비어 있다', () => {
  const s = fs.readFileSync(path.join(R, 'kcareer.html'), 'utf8');
  assert.ok(s.indexOf('STAMP_SEED') >= 0, 'STAMP_SEED 가 사라졌습니다');
  /* 도장 그림(base64 PNG)이 다시 들어오면 떼어다 남의 서류에 붙일 수 있다 */
  assert.ok(!/STAMP_SEED[\s\S]{0,400}data:image\/png;base64,[A-Za-z0-9+/]{200}/.test(s),
    '★ STAMP_SEED 에 도장 그림이 다시 들어왔습니다');
});
