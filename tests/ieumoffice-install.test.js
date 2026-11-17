/* 이음오피스 설치 파일 — 받는 곳을 공식 저장소 하나로 못 박는다 (대표 지시 2026-11-17) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'tools', 'ieumoffice');
const ps = fs.readFileSync(path.join(dir, 'install.ps1'));
const bat = fs.readFileSync(path.join(dir, 'install-ieumoffice.bat'));

test('공식 저장소의 릴리스 다운로드 주소에서만 받는다', () => {
  const s = ps.toString('utf8');
  assert.match(s, /\$Repo\s*=\s*'pblsketch\/ieumoffice'/);
  assert.match(s, /StartsWith\(\$Prefix\)/, '받는 주소를 확인하지 않습니다');
  assert.match(s, /Get-FileHash/, '지문을 보여 주지 않습니다');
  assert.doesNotMatch(s, /\/S\b|\/silent|\/quiet/i, '조용히 깔면 안 됩니다 — 설치 창은 사람이 봅니다');
});

test('ps1 은 BOM, bat 는 ASCII — 윈도에서 한글이 안 깨지게', () => {
  assert.ok(ps[0] === 0xef && ps[1] === 0xbb && ps[2] === 0xbf, 'install.ps1 에 BOM 이 없습니다');
  assert.ok([...bat].every((b) => b < 0x80), '.bat 에 ASCII 밖 글자가 있습니다');
  assert.match(bat.toString(), /-File\s+"%~dp0install\.ps1"/);
});
