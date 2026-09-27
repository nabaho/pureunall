/* 법제처가 안 받아 줘도 «우리 얼굴»로 돌아온다 (2026-09-20 실측에서 못 돌아왔다)
   ═══════════════════════════════════════════════════════════════════════════
   ■ 무슨 일이 있었나
     판례 쪽(newsFullPage)이 부를 때마다 20초를 꽉 채우고 끊겼다.
       12:23:57  Function execution took 19999 ms, finished with status: 'timeout'
     받는 분이 본 것은 우리 쪽이 아니라 맨 오류였다:
       408  upstream request timeout
     같은 때 법제처를 «우리 컴퓨터»에서 두드리면 91ms 에 95KB 가 왔다 —
     법제처가 느린 것이 아니라, 우리 함수가 «돌아올 시간»을 안 남긴 것이다.

   ■ 셈이 안 맞았다
     글자로받기() 는 첫 시도 8초 + IPv4 재시도 15초 = «23초»를 쓴다.
     그런데 판례 두 문의 함수 제한은 «20초»다. 법제처가 한 번만 안 받아 줘도
     23초를 쓰려다 20초에 잘린다 — 그래서 공들여 지어 둔 NF.오류쪽
     (「지금 법제처에서 받아 오지 못했습니다」 + 법제처 링크)이 «한 번도 못 뜬다».

   ■ 고친 길
     그 두 문만 «작은 주머니»(6초)를 들려 보낸다. 6 + 6 = 12초 < 20초라,
     다 못 받아 와도 시간 안에 돌아와 우리 얼굴을 내놓는다.
     ⚠ 밤에 도는 «모으기»는 그대로 8초 + 15초다 — 거기는 시간이 넉넉하고,
       한 건 놓치면 그 주 자료가 빈다.

   ■ 이 검사가 지키는 것
     ㉠ 판례 두 문이 «주머니»를 들려 보낸다
     ㉡ 주머니 둘을 더해도 함수 제한보다 «넉넉히» 작다
     ㉢ 안 들려 보내면 예전 그대로다 — 모으기가 짧아지면 안 된다 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { 주석걷기 } = require('./helpers/strip-comments.js');

const 뿌리 = path.join(__dirname, '..');
const 서버 = 주석걷기(fs.readFileSync(path.join(뿌리, 'functions/index.js'), 'utf8'));

function 문몸(이름) {
  const i = 서버.indexOf('exports.' + 이름 + ' = functions');
  assert.ok(i >= 0, 이름 + ' 을 못 찾았다');
  const j = 서버.indexOf('\nexports.', i + 1);
  return 서버.slice(i, j > 0 ? j : 서버.length);
}
const 판례문들 = ['newsFull', 'newsFullPage'];

test('★★★ 판례 두 문이 «시간 주머니»를 들려 보낸다', () => {
  판례문들.forEach((이름) => {
    assert.match(문몸(이름), /글자로받기\(NF\.받을주소\(q\.갈래, q\.번호\),\s*\d+\)/,
      '★★★ ' + 이름 + ' 이 주머니 없이 부른다 — 법제처가 안 받아 주면 맨 오류(408)가 나간다');
  });
});

test('★★★ 주머니 둘을 더해도 함수 제한 «안»에 돌아온다', () => {
  판례문들.forEach((이름) => {
    const 몸 = 문몸(이름);
    const 주머니 = Number((/글자로받기\(NF\.받을주소\(q\.갈래, q\.번호\),\s*(\d+)\)/.exec(몸) || [, 0])[1]);
    const 제한 = Number((/timeoutSeconds:\s*(\d+)/.exec(몸) || [, 0])[1]);
    assert.ok(주머니 > 0, '★★★ ' + 이름 + ' 의 주머니를 못 읽었다');
    assert.ok(제한 > 0, '★★ ' + 이름 + ' 의 함수 제한을 못 읽었다');
    /* 두 번 시도(첫 시도 + IPv4) + 쪽을 짓고 내보낼 틈 */
    const 최악 = 주머니 * 2;
    assert.ok(최악 + 3000 <= 제한 * 1000,
      '★★★ ' + 이름 + ' : 기다림 ' + (최악 / 1000) + '초인데 제한이 ' + 제한
        + '초다 — 잘리면 우리 오류 쪽이 «한 번도» 안 뜬다');
  });
});

test('★★ 주머니를 «안» 주면 예전 그대로다 — 모으기가 짧아지면 안 된다', () => {
  /* ⚠ 밤에 도는 모으기는 한 건 놓치면 그 주 자료가 빈다. 판례 쪽을 고치려다
       모으기까지 조급해지면, 고치고 더 나빠진다. */
  const m = /async function 글자로받기\(url, 제한밀리초\)[\s\S]*?\n\}/.exec(서버);
  assert.ok(m, '글자로받기() 를 못 찾았다');
  assert.match(m[0], /Number\(제한밀리초\) > 0 \? Number\(제한밀리초\) : 8000/,
    '★★ 첫 시도의 «기본 8초»가 사라졌다');
  assert.match(m[0], /Number\(제한밀리초\) > 0 \? Number\(제한밀리초\) : 15000/,
    '★★ IPv4 재시도의 «기본 15초»가 사라졌다');
  const v4 = /function IPv4로글자받기\(url, 옮김횟수, 제한밀리초\)[\s\S]*?\n\}/.exec(서버);
  assert.ok(v4, 'IPv4로글자받기() 를 못 찾았다');
  assert.match(v4[0], /timeout: 제한/, '★★ IPv4 쪽이 받은 주머니를 안 쓴다');
  assert.match(v4[0], /IPv4로글자받기\(다음\.href, 횟수 \+ 1, 제한\)/,
    '★★ 주소가 옮겨지면 주머니를 잃는다 — 거기서 다시 15초를 쓴다');
});
