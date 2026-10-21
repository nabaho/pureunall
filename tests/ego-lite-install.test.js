/* 에고라이트 설치 도구 — 대표 PC 에서 «한 번 눌러» 까는 스크립트가 지켜야 할 것 (대표 지시 2026-10-21)
 *
 * ■ 왜 있나
 *   클라우드 방은 대표 PC 에 손이 닿지 않는다. 그래서 PC 에서 tools/ego-lite/install-ego-lite.bat 를
 *   한 번 누르면 받기·서명 확인·실행·확인까지 저절로 되게 했다. 사람 손이 안 가는 만큼
 *   «무엇을 받아 무엇을 실행하는가»가 어긋나면 아무도 모른 채 엉뚱한 파일을 실행한다.
 *
 * ■ 무엇을 못 박나 — 지금 값이 아니라 규칙
 *   ① 받는 곳은 만든 쪽 README·cdn.ego.app·공식 사이트뿐이다
 *   ② 설치 파일 주소를 박지 않는다 — 주소 끝 글자가 판마다 바뀐다(옛 판을 받게 된다)
 *   ③ 서명 확인이 실행보다 먼저다 — 깨진 서명(HashMismatch)·남의 서명은 멈춘다
 *   ④ 조용히 깔지 않는다 — 크롬 자료를 옮길지는 사람이 고른다
 *   ⑤ 윈도 PowerShell 5.1 이 한글을 읽게 BOM 이 있고, .bat 는 ASCII 다(cmd 는 UTF-8 을 깨뜨린다)
 * 실행: node --test tests/ego-lite-install.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'tools', 'ego-lite');
const raw = fs.readFileSync(path.join(dir, 'install.ps1'));
const ps = raw.toString('utf8');
const bat = fs.readFileSync(path.join(dir, 'install-ego-lite.bat'));
/* 주석 줄은 빼고 본다 — 설명에 적힌 예시 주소는 받는 곳이 아니다 */
const 코드 = ps.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n');

test('① 받는 곳은 공식 자리뿐이다', () => {
  const 주소들 = [...코드.matchAll(/https?:\/\/[^\s'"]+/g)].map((m) => m[0]);
  assert.ok(주소들.length >= 2, '받는 주소를 못 찾았습니다');
  const 허용 = [/^https:\/\/raw\.githubusercontent\.com\/citrolabs\/ego-lite\//, /^https:\/\/cdn\\?\.ego\\?\.app\//, /^https:\/\/lite\.ego\.app\//];
  for (const u of 주소들) {
    assert.ok(허용.some((re) => re.test(u)),
      '★ 공식이 아닌 곳에서 받으려 합니다: ' + u + ' — 만든 쪽 README·cdn.ego.app·lite.ego.app 만 씁니다');
  }
});

test('② 설치 파일 주소를 박지 않는다 — README 에서 그때그때 읽는다', () => {
  assert.doesNotMatch(코드, /cdn\.ego\.app\/setup\/windows\/x64\/egoliteSetup-[A-Za-z0-9]+\.exe/,
    '★ 설치 파일 주소를 박았습니다 — 끝 글자가 판마다 바뀌어 곧 옛 판을 받게 됩니다');
  assert.match(코드, /\[regex\]::Match\(/, 'README 에서 주소를 읽는 자리가 없습니다');
});

test('③ 서명 확인이 실행보다 먼저 — 깨진 서명·남의 서명은 멈춘다', () => {
  const 서명 = 코드.indexOf('Get-AuthenticodeSignature');
  const 실행 = 코드.search(/Start-Process\s+-FilePath\s+\$exe/);
  assert.ok(서명 > 0 && 실행 > 0, '서명 확인이나 실행 자리를 못 찾았습니다');
  assert.ok(서명 < 실행, '★ 서명을 보기 전에 설치 파일을 실행합니다');
  assert.match(코드, /HashMismatch/, '★ 깨진 서명(받는 도중 바뀐 파일)을 멈추는 자리가 없습니다');
  assert.match(코드, /-notmatch\s+\$SIGNER_PATTERN/, '★ 서명한 곳을 견주는 자리가 없습니다');
});

test('④ 조용히 깔지 않는다 — 크롬 자료를 옮길지는 사람이 고른다', () => {
  const 실행줄 = 코드.split('\n').filter((l) => /Start-Process\s+-FilePath\s+\$exe/.test(l));
  assert.ok(실행줄.length >= 1);
  for (const l of 실행줄) {
    assert.doesNotMatch(l, /-ArgumentList|\/S\b|silent|quiet/i,
      '★ 설치를 조용히 돌립니다 — 온보딩(크롬 자료 옮기기)을 사람이 못 보고 지나갑니다');
  }
});

test('⑤ ps1 은 BOM, bat 는 ASCII — 윈도에서 한글이 안 깨지게', () => {
  assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf],
    '★ install.ps1 에 BOM 이 없습니다 — 윈도 PowerShell 5.1 이 ANSI 로 읽어 한글이 깨집니다');
  assert.ok(bat.every((b) => b < 0x80), '★ .bat 에 ASCII 밖 글자가 있습니다 — cmd 가 깨뜨립니다');
  assert.match(bat.toString(), /-File\s+"%~dp0install\.ps1"/, '.bat 가 제 옆의 install.ps1 을 안 부릅니다');
});
