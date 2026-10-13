/* 회생광고 — 금융위 기업기본정보(대표자·연락처) 연결이 «끊기지 않았는가».
   서버(rehabWatch)가 rehab_ad/fsc 에 담고 → 화면이 읽어 대표자·연락처에 합친다. 어느 한쪽이 빠지면 조용히 «대표자 칸이 계속 빈다».
   지키는 것: ① 서버가 모듈을 불러 fsc 칸에 쓴다 ② 화면이 그 칸을 읽는다 ③ 화면은 «확인됨(found)»만 쓴다
   ④ 대표자 우선순위에서 직접 입력이 금융위보다 앞이다 ⑤ 보안규칙은 fsc 를 화면(클라이언트)이 쓰게 열지 않는다
   실행: node --test tests/rehab-fsc-wiring.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const server = strip(read('functions/index.js'));
const page = strip(read('rehab-ad.html'));
const rules = strip(read('scripts/make-firebase-rules.js'));

test('① 서버: 금융위 모듈을 불러 rehab_ad/fsc 에 공고별로 담는다', () => {
  assert.match(server, /require\("\.\/rehab-fsc"\)/);
  assert.match(server, /upd\["fsc\/"\s*\+\s*n\.id\]/);
  assert.match(server, /RehabFsc\.lookup\(/);
});

test('② 서버: 호출이 실패한 곳은 저장하지 않는다(catch 에서 upd 에 쓰지 않는다)', () => {
  const block = server.slice(server.indexOf('RehabFsc.lookup('), server.indexOf('RehabFsc.lookup(') + 900);
  const catchAt = block.indexOf('catch');
  assert.ok(catchAt > 0);
  const catchLine = block.slice(catchAt, block.indexOf(String.fromCharCode(10), catchAt));   // catch 가 열리는 줄 하나만 본다
  assert.ok(!/upd\[/.test(catchLine), '실패했는데 저장하면 «못 찾음»으로 굳어 내일 다시 안 본다');
});

test('③ 화면: rehab_ad/fsc 를 읽는다', () => {
  assert.match(page, /ref\('rehab_ad\/fsc'\)/);
});

test('④ 화면: «확인됨(found)»만 쓴다 — 못 찾음·모호 기록의 칸은 쓰지 않는다', () => {
  assert.match(page, /function fscOf\(id\)\s*\{[^}]*status\s*===\s*'found'/);
});

test('⑤ 화면: 대표자는 직접 입력이 금융위보다 앞선다', () => {
  const at = (s) => page.indexOf(s);
  assert.ok(at("src:'직접 입력'") > 0 && at('f.ceo') > 0);
  assert.ok(at("src:'직접 입력'") < at('f.ceo'), '사람이 고친 값이 자동 값에 덮이면 안 된다');
});

test('⑥ 보안규칙: rehab_ad/fsc 를 화면이 쓰게 열지 않는다', () => {
  const block = rules.slice(rules.indexOf('rules.rehab_ad'), rules.indexOf('rules.rehab_ad') + 700);
  const fscAt = block.indexOf('fsc');
  if (fscAt >= 0) assert.match(block.slice(fscAt, fscAt + 60), /'\.write':\s*false/);
  /* fsc 를 따로 적지 않았다면 rehab_ad 에 쓰기 규칙이 없어야 서버(관리자 SDK)만 쓴다 */
  else assert.ok(!/'\.write':\s*'auth/.test(block.replace(/marks:\s*\{[^}]*\}/, '')), 'rehab_ad 바로 아래에 쓰기를 열면 fsc 도 열린다');
});
