'use strict';
/* 폰화면관리 마지막 판(2026-10-18) — 전수 측정을 한 번 더 돌려 찾은 «짓눌림» 셋
   ① 기금 상단바: «지금 어느 화면인지»(#crumb)가 19px 로 짓눌려 「기…」 만 남았다
   ② 급여데이터함 확인 대기 줄: 딱지·단추가 자리를 먹어 파일 이름이 「Kaka…」 4글자만 남았다
   ③ 취업규칙 조별 문안 카드 머리: 한 줄에 우겨 넣어 「📋 복사」 단추가 화면 오른쪽 밖으로 잘렸다
   ★ 지키는 것 — px 값이 아니라 «폰 구간에서 무엇이 먼저 줄어드는가»다. 셋 다 PC 에는 안 걸린다.
   실행: node --test tests/phone-final-pass.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const 읽기 = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, ' ');

/* 선택자 규칙이 들어 있는 «가장 가까운 @media» 의 max-width — 없으면 null(전 화면에 걸린다) */
function 감싼폭(src, at) {
  let 깊이 = 0;
  for (let i = at; i >= 0; i--) {
    if (src[i] === '}') 깊이++;
    else if (src[i] === '{') {
      if (깊이 > 0) { 깊이--; continue; }
      const 앞 = src.slice(Math.max(src.lastIndexOf('}', i), src.lastIndexOf(';', i), src.lastIndexOf('\n@', i)) + 1, i);
      if (/@media/.test(앞)) { const m = /max-width\s*:\s*(\d+)px/.exec(앞); return m ? Number(m[1]) : null; }
    }
  }
  return null;
}
function 폰규칙(src, 선택자, 속성re, 이름) {
  const re = new RegExp(선택자.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
  const 찾음 = [...src.matchAll(re)].filter((m) => 속성re.test(m[1]));
  assert.ok(찾음.length, 이름 + ' — 규칙이 없습니다');
  for (const m of 찾음) {
    const 폭 = 감싼폭(src, m.index);
    assert.ok(폭 && 폭 <= 768, 이름 + ' — 폰 구간 밖에 있어 PC 도 바뀝니다');
  }
}

test('① 기금 상단바 — 화면 이름은 네 글자를 지키고, 사람 이름 칸이 먼저 준다', () => {
  const s = 읽기('fund.html');
  폰규칙(s, '#crumb', /min-width\s*:\s*[1-9][\d.]*em/, '화면 이름의 최소 폭');
  폰규칙(s, '#topuser', /min-width\s*:\s*0[;\s}]?[\s\S]*flex\s*:\s*0 1 auto|flex\s*:\s*0 1 auto[\s\S]*min-width\s*:\s*0/, '사람 이름 칸이 줄어들 수 있게');
});

test('② 급여데이터함 확인 대기 줄 — 파일 이름이 줄의 몫을 지키고 딱지가 먼저 준다', () => {
  const s = 읽기('pu-paydata.html');
  폰규칙(s, '.gl .gt', /min-width\s*:\s*[1-9]\d*%/, '파일 이름의 최소 몫');
  폰규칙(s, '.gl .tg', /flex\s*:\s*0 1 auto[\s\S]*text-overflow\s*:\s*ellipsis/, '딱지가 줄어들고 «…»');
});

test('③ 취업규칙 문안 카드 머리 — 폰에서는 접어서 단추가 제 줄을 갖는다', () => {
  const s = 읽기('rules-v2.html');
  폰규칙(s, '#topics .ch2', /flex-wrap\s*:\s*wrap/, '카드 머리 접기');
  폰규칙(s, '#topics .ch2 .r', /flex\s*:\s*1 1 100%/, '단추 줄이 제 줄을 갖기');
});
