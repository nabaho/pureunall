/* 카톡정리 › 📋 진행 기록 — 화면(work.html) 규칙 (2026-10-26, main 의 대화 읽기 위에 얹음)
   설계서: docs/superpowers/specs/2026-10-24-카톡-법인방-업무정리-design.md (2026-10-26 개정 머리말)
   화면은 브라우저에서만 도므로 «소스에 규칙이 박혀 있는가»를 본다(kakao-work.test.js 와 같은 방식).
   ⚠ 「지금 값」이 아니라 「규칙」을 본다 — 함수 순서·금지된 호출·서버를 안 부르는 것. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const W = read('work.html');

/* 새 구간 — 머리 주석부터 끝 표시까지. 이 구간은 «성과급 구간»(var PC_PATH= ~ 라우팅) 밖이어야 한다:
   tests/perf-confirm-work.test.js 가 그 사이의 fbDb.ref 를 센다. */
const START = W.indexOf('💬 카톡정리 › 진행 기록 정리');
const END = W.indexOf('/* ══ 끝: 💬 카톡정리 › 진행 기록 정리');
const REGION = START > 0 && END > START ? W.slice(START, END) : '';
function body(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 함수가 없다');
  const next = src.indexOf('\nfunction ', at + 10);
  return src.slice(at, next < 0 ? undefined : next);
}
const fn = (name) => body(REGION, name);
const wfn = (name) => body(W, name);

test('새 구간이 있고, 읽기 스크립트가 카톡 셈 «뒤»에 실려 있으며, 성과급 구간 안에 있지 않다', () => {
  assert.ok(REGION.length > 500, '진행 기록 정리 구간이 없다');
  const a = W.indexOf('<script src="js/pu-kakao-work.js');
  const b = W.search(/<script src="js\/pu-kakao-export\.js\?v=\d+"><\/script>/);
  assert.ok(a > 0 && b > a, 'pu-kakao-export.js 가 pu-kakao-work.js 뒤에 없다');
  const pc = W.indexOf('var PC_PATH='), route = W.indexOf('/* ── 라우팅 ── */', pc);
  assert.ok(pc > 0 && route > pc && !(START > pc && START < route), '새 구간이 성과급 구간 안에 있다 — 성과급 검사가 fbDb.ref 를 센다');
});

test('탭이 셋이 되고(대화·받을 파일·진행 기록) 새 탭은 기존 카톡정리 안(총괄관리자 확인 뒤)에만 있다', () => {
  const r = wfn('renderKakao');
  assert.match(r, /kkTab\(\\'log\\'\)/, '진행 기록 탭 단추가 없다');
  assert.match(r, /kxHTML\(\)/, '진행 기록 탭이 그려지지 않는다');
  assert.match(r, /kkTalkHtml\(\)/, '기존 대화 탭이 사라졌다');
  assert.match(r, /kkFilesHtml\(\)/, '기존 받을 파일 탭이 사라졌다');
  assert.match(W, /id="nav-kakao" style="display:none"/, '메뉴가 기본 숨김이 아니다');
  assert.ok(!/id="nav-kx/.test(W), '새 메뉴를 따로 만들었다 — 총괄관리자 확인이 비켜 간다');
});

test('main 의 저장본 미리보기 창에 «진행 기록으로 정리» 길이 있고, 읽은 줄을 한 곳(KX.src)에 붙잡아 둔다', () => {
  const m = wfn('kkImportModal');
  assert.match(m, /kxKeep\(/, '미리보기 창이 읽은 줄을 넘기지 않는다');
  assert.match(m, /kxOpenLog\(\)/, '진행 기록으로 가는 단추가 없다');
  assert.ok(m.indexOf('kxOpenLog()') < m.indexOf('kkImportGo()'), '넣기 단추보다 앞에 두어 «넣기»가 주 단추로 남게 한다');
  assert.match(fn('kxKeep'), /KX\.src\s*=/);
  assert.match(fn('kxOpenLog'), /KK\.tab\s*=\s*'log'/);
});

test('이 구간은 서버를 부르지 않는다 — 원문 보관은 main 의 「넣기」(kakaoImport)가 한다', () => {
  /* 주석을 벗기고 «코드»만 본다 — REGION 은 머리 주석 한가운데에서 시작하므로 여는 표시를 앞에 붙여 짝을 맞춘다 */
  const code = ('/*' + REGION).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/kkCall\(|kakaoImport|aiFetch\(/.test(code), '진행 기록 정리가 서버를 부른다 — 원문 보관과 두 벌이 된다');
});

test('주민번호 지우개가 없으면 묶기 전에 멈추고, 쓰는 한 줄에도 한 번 더 건다', () => {
  const f = fn('kxBuild');
  const guard = f.search(/!M\s*\|\|\s*!M\.maskRrnInText/);
  assert.ok(guard >= 0, '지우개가 없을 때 막는 줄이 없다');
  assert.ok(guard < f.indexOf('groupMessages('), '지우개 확인이 묶기보다 뒤에 있다');
  assert.match(f, /maskRrnInText\(d\.text\)/, '진행 기록 한 줄에 지우개를 안 건다');
});

test('진행 기록: lid 열쇠로, logs·itemlogs 두 자리를 한 번의 update 로, 기존 줄은 덮어쓰거나 지우지 않는다', () => {
  const f = fn('kxWriteLogs');
  assert.match(fn('kxStatus'), /logId\(/, '줄 열쇠를 내용에서 만들지 않는다');
  assert.match(f, /r\.lid/);
  assert.match(f, /'\/logs\/'/);
  assert.match(f, /'\/itemlogs\/'/);
  assert.strictEqual(f.split('.update(').length - 1, 1, '한 번의 update 가 아니다 — 반쯤 하다 멈출 수 있다');
  assert.strictEqual(REGION.split('.update(').length - 1, 1, 'kxWriteLogs 밖에도 update 가 있다');
  assert.ok(!/\.(remove|set)\(/.test(REGION), '기존 줄을 덮거나 지우는 호출이 있다');
  assert.match(f, /k:'kt'/);
  const st = fn('kxStatus');
  for (const s of ['same', 'more', 'gone']) assert.match(st, new RegExp(s));
});

test('지운 카톡 줄은 다음 올리기에서 되살아나지 않는다 — 지울 때 표식을 «같은 쓰기»에 남기고, 올리기가 그 표식을 본다', () => {
  const del = wfn('_delLog');
  assert.match(del, /l\.k==='kt'/, '카톡 줄을 지울 때 표식을 남기지 않는다');
  assert.match(del, /'\/kxoff\/'\+itemId\+'\/'\+lid/);
  assert.ok(del.indexOf('/kxoff/') < del.indexOf('.update('), '표식이 지우기와 «같은 쓰기»에 있지 않다');
  assert.match(fn('kxLogsOf'), /\/kxoff\//, '올리기가 표식을 읽지 않는다');
  const st = fn('kxStatus');
  assert.ok(st.indexOf("'gone'") < st.indexOf("'more'"), '표식 확인이 새 줄/보강 판정보다 뒤에 있다');
  assert.match(fn('kxRowHTML'), /지운 줄/);
});

test('사건번호는 업무관리 번호·심급 사건번호·업무명 속 번호와 «글자 그대로» 맞춘다 — 이름으로 id 를 채우지 않는다', () => {
  assert.match(fn('kxItems'), /extractCaseNos\(it\.title/);
  assert.ok(!/co_id/.test(REGION.replace(/it\.co_id/g, '')), '업체 id 를 이름으로 채우는 코드가 있다');
  const t = fn('kxTask');
  assert.match(t, /itemModal\(\)/);
  assert.ok(!/saveItem\(|if-co|if-client/.test(t), '새 업무 창이 업체 칸을 채우거나 저장한다');
});

test('표: ☐ 고르기 칸 + 번호가 맨 왼쪽, 번호는 보는 번호(저장하지 않음), 폰에서는 카드로 편다', () => {
  const f = fn('kxHTML') + fn('kxRowHTML');
  assert.match(f, /<th class="kkfit"><input type="checkbox" onclick="kxPickAll\(/);
  assert.match(f, /<th class="kkfit">번호<\/th>/);
  assert.match(fn('kxRowHTML'), /\(i\+1\)/);
  assert.ok(!/localStorage/.test(fn('kxRowHTML')), '번호·고르기를 저장한다');
  const from = W.indexOf('.kxt');
  const m = /@media \(max-width:\d+px\)\s*\{/.exec(W.slice(from));
  assert.ok(m, '폰 구간이 없다');
  let i = from + m.index + m[0].length, depth = 1;
  while (i < W.length && depth > 0) { depth += W[i] === '{' ? 1 : W[i] === '}' ? -1 : 0; i++; }
  const phone = W.slice(from + m.index, i);
  assert.match(phone, /\.kxt/);
  assert.match(phone, /font-size:16px/, '폰 입력칸 16px 이 없다');
  assert.match(phone, /display:flex/, '폰에서 줄을 카드로 펴지 않는다');
});

test('화면을 떠나면 읽은 내용을 버리고, 반영은 건수를 묻고 한 번에 쓴다', () => {
  assert.match(W, /if\(S\.view!=='kakao'\)\s*kxReset\(\)/);
  const a = fn('kxApply');
  assert.ok(a.indexOf('confirmM(') > 0 && a.indexOf('confirmM(') < a.indexOf('kxWriteLogs('), '건수를 묻기 전에 쓴다');
});
