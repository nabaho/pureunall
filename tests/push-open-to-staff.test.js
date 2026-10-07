'use strict';
/* 🔔 폰 알림 등록은 «직원도» 할 수 있다 (대표 지시 2026-10-07 전체 점검에서 찾은 것)

   ★ 무슨 일이었나 — 2026-10-05 에 「📬 내 담당 메일 → 그 담당자 폰 알림」을 지었는데,
     기기를 등록하는 단추가 포털 건의함에 «관리자만» 보이게 돼 있었다.
     그래서 그 기능은 한 번도 울릴 수 없었다 — 실측 2026-10-07 등록된 기기 0대.
   ★ 열어도 안전하다 — 무엇을 받을지는 서버가 가린다(push-admins.adminUids).
     건의 알림은 관리자에게만, 직원에게는 제 담당 메일만 간다.
   ★ 규칙도 이미 본인 것만 쓰게 돼 있었다(fcm_tokens/$uid · auth.uid == $uid).

   여기서 못 박는 것
   ① 등록 단추는 «로그인한 사람»이면 보인다 — 관리자만이 아니다
   ② 켜는 길도 관리자 가림막이 없다
   ③ 그렇다고 «보내는 쪽»이 열리면 안 된다 — 건의 알림은 관리자에게만 간다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
const strip = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
const enter = R('enter.html');
const cards = R('pu-cards.html');
const pushJs = R('functions/push-admins.js');

function fnBody(src, name) {
  const i = src.indexOf('function ' + name + '(');
  assert.ok(i >= 0, name + ' 를 찾지 못했습니다');
  const open = src.indexOf('{', i);
  let d = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  assert.fail(name + ' 의 끝을 찾지 못했습니다');
}

test('★★★ 등록 단추가 직원에게도 보인다 — 관리자만이면 그 사람들 알림은 영영 안 온다', () => {
  const fn = strip(fnBody(enter, 'pushRefresh'));
  assert.ok(!/sgIsAdmin\(\)/.test(fn),
    '★ 등록 단추를 관리자에게만 보이면, 직원 담당 메일 알림은 한 번도 못 간다: ' + fn.slice(0, 220));
  assert.ok(/SG\.uid/.test(fn), '로그인한 사람인지는 본다 — 아무에게나 보이면 안 된다');
});

test('★★★ 켜는 길에도 관리자 가림막이 없다', () => {
  const fn = strip(fnBody(enter, 'pushEnable'));
  assert.ok(!/sgIsAdmin\(\)/.test(fn), '★ 단추만 보이고 눌러도 아무 일이 없으면 더 나쁘다');
});

test('★★★ 그래도 «보내는 쪽»은 안 열린다 — 건의 알림은 관리자에게만', () => {
  const fn = strip(fnBody(pushJs, 'adminUids'));
  assert.ok(/isAdmin === true/.test(fn), '관리자만 고르는 자리가 그대로 있어야 한다');
  assert.ok(/status !== "resigned"|status !== \x27resigned\x27/.test(fn), '퇴사자는 빼야 한다');
});

test('★★ 본인 것만 쓸 수 있다 — 규칙이 그렇게 돼 있다', () => {
  const rules = R('scripts/make-firebase-rules.js');
  const i = rules.indexOf('rules.fcm_tokens');
  assert.ok(i > 0, 'fcm_tokens 규칙이 있어야 한다');
  const near = rules.slice(i, i + 260);
  assert.ok(/auth\.uid == \$uid/.test(near), '남의 기기에 쓸 수 있으면 안 된다: ' + near.slice(0, 160));
});

test('★★★ 메일함 안내가 «어디로 가야 하는지»를 말한다 — 안 적으면 아무도 못 찾는다', () => {
  const fn = strip(fnBody(cards, 'mbMinePushSet'));
  const i = fn.indexOf('켰습니다');
  assert.ok(i > 0, '켰을 때 하는 말이 있어야 한다');
  const line = fn.slice(i, i + 160);
  assert.ok(/건의함/.test(line) && /폰 알림/.test(line),
    '★ 「등록해 주셔야 옵니다」만 적으면 어디서 하는지 모른다: ' + line);
});

test('★★ 켜도 바로 오지 않는다는 것을 숨기지 않는다', () => {
  const fn = strip(fnBody(cards, 'mbMinePushSet'));
  assert.ok(/등록/.test(fn), '기기 등록이 따로 필요하다는 말이 있어야 한다');
});
