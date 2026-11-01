'use strict';
/* 직원 경력 — «내 정보»에서 직원이 보내고, 대표가 받는다 (대표 지시 2026-11-01)
   「최근것 10개 이하로 넣고 필요시 개인이 추가할 수 있게해라」 · 결정 「대표 확인 뒤」.
   ★ 여기서 못 박는 것
     ① 새 사이트에는 맨 위 10줄까지만 간다(맨 위가 최근).
     ② 제안함 규칙 — 재직 직원이 «내 사번 칸»에만, 10줄까지. 지우기·남의 칸은 총괄관리자.
        (homepage 의 $part 가 «누구나»라서, 이름 붙은 갈래로 따로 막지 않으면 남의 칸에 쓸 수 있다.)
     ③ 포털 「내 정보」는 «보내기»만 한다 — homepage/members 를 고치지 않는다.
     ④ 관리 화면 「받기」는 저장이 «된 뒤에만» 제안을 지운다.
   이름은 지어낸 것. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const R = path.join(__dirname, '..');
require(path.join(R, 'js', 'pu-site-people.js'));
const P = globalThis.PuSitePeople;
const 주석뺀 = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ');
const 포털 = fs.readFileSync(path.join(R, 'enter.html'), 'utf8').replace(/\r\n/g, '\n');
const 관리 = fs.readFileSync(path.join(R, 'pu-home.html'), 'utf8').replace(/\r\n/g, '\n');
function fnSource(src, name) {
  const m = new RegExp('(?:^|\\n)\\s*(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(src);
  assert.ok(m, name + ' 를 찾지 못했습니다');
  let depth = 0;
  for (let i = src.indexOf('{', m.index); i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (!depth) return src.slice(m.index, i + 1); }
  }
  assert.fail(name + ' 끝을 찾지 못했습니다');
}

test('★ 새 사이트에는 맨 위 10줄까지만 간다', () => {
  assert.equal(P.경력한도, 10);   // 검사고정-허용: 「최근것 10개 이하로」 — 대표 지시 2026-11-01 이 정한 수
  const 열둘 = Array.from({ length: 12 }, (_, i) => '줄' + (i + 1));
  const [p] = P.올릴직원([{ key: 'a', kind: 'staff', name: '김예시', position1: '사무장',
    careers: 열둘, careerConsent: { at: '2026-11-01', how: '구두' } }]);
  assert.equal(p.경력.length, P.경력한도, '★ 한도보다 많이 새 사이트로 갑니다');
  assert.equal(p.경력[0], '줄1', '맨 위(최근)부터 가야 합니다');
});

test('★★ 제안함 규칙 — 내 사번 칸에만, 10줄까지, 지우기는 총괄관리자', () => {
  const out = cp.execFileSync(process.execPath, [path.join(R, 'scripts', 'make-firebase-rules.js')], { cwd: R, encoding: 'utf8' });
  const hp = JSON.parse(out.slice(out.indexOf('{'))).rules.homepage;
  const 함 = hp.careerInbox;
  assert.ok(함, '★★ 제안함 규칙이 없습니다 — $part(재직 직원 누구나)를 타서 남의 칸에 쓸 수 있습니다');
  assert.doesNotMatch(String(함['.write']), /재직|auth != null &&[^]*status/, '제안함 전체 쓰기가 직원에게 열렸습니다');
  const 칸 = 함.$sid;
  assert.match(칸['.write'], /child\('sid'\)\.val\(\) === \$sid/, '★★ 남의 사번 칸에도 쓸 수 있습니다');
  assert.match(칸['.write'], /newData\.exists\(\)/, '★ 직원이 제안을 지울 수 있습니다 — 「보냈다」를 다툴 수 없게 됩니다');
  assert.match(칸['.validate'], /lines'\)\.child\('10'\)\.exists\(\)/, '★ 10줄 넘게 보낼 수 있습니다');
});

test('★ 포털 「내 정보」는 제안함에 «보내기»만 — 홈페이지 직원 자료를 고치지 않는다', () => {
  const 보내기 = 주석뺀(fnSource(포털, 'homeCareerSend'));
  assert.match(보내기, /db\.ref\('homepage\/careerInbox\/' \+ hc\.sid\)/);
  const 전부 = ['homeCareerOpen', 'homeCareerDraw', 'homeCareerSend'].map(n => 주석뺀(fnSource(포털, n))).join('\n');
  assert.doesNotMatch(전부, /homepage\/members[^']*'\)\.(set|update|push|remove|transaction)/, '★ 포털이 홈페이지 자료를 바로 고칩니다 — 대표 확인을 건너뜁니다');
  assert.match(주석뺀(fnSource(포털, 'homeCareerOpen')), /m\.kind === 'staff' && String\(m\.sid \|\| ''\) === r\[0\]/,
    '★ 내 사번으로 이어진 직원 자료가 아닌데도 칸이 뜹니다');
  assert.match(주석뺀(fnSource(포털, 'kkOpenProfile')), /homeCareerOpen\(body\)/, '「내 정보」에서 칸을 안 부릅니다');
});

test('★ 포털 입력칸은 폰에서 확대되지 않게 16px', () => {
  assert.match(주석뺀(fnSource(포털, 'homeCareerDraw')), /font-size:16px/);
});

test('★★ 관리 화면 「받기」는 저장이 «된 뒤에만» 제안을 지운다', () => {
  const s = 주석뺀(fnSource(관리, '경력제안받기'));
  const 저장 = s.indexOf('saveDraft('), 지움 = s.indexOf('.remove()');
  assert.ok(저장 >= 0 && 지움 > 저장, '★★ 저장 전에 제안을 지웁니다 — 저장이 실패하면 직원이 쓴 것이 사라집니다');
  assert.match(s, /if \(!\(await saveDraft\(true\)\)\) return;/, '★ 저장이 실패해도 지웁니다');
});

test('제안은 사번으로 잇는다 — 이름으로 맞추지 않는다', () => {
  const s = 주석뺀(fnSource(관리, '경력제안'));
  assert.match(s, /\.sid/);
  assert.doesNotMatch(s, /\.name/, '★ 이름으로 제안을 맞춥니다');
});
