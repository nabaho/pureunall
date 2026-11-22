/* 제미나이 CLI 설치 파일 (대표 지시 2026-11-18) — 공식 패키지만, 열쇠는 안 다룬다, ASCII·CRLF */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bat = fs.readFileSync(path.join(__dirname, '..', 'tools', 'gemini-cli', 'install-gemini-cli.bat'));

test('공식 패키지만 깔고, API 키를 묻거나 저장하지 않는다', () => {
  const s = bat.toString();
  assert.match(s, /npm install -g @google\/gemini-cli\b/);
  assert.doesNotMatch(s, /GEMINI_API_KEY\s*=|setx\s/i, '열쇠를 환경에 박으면 구독이 아니라 건당 요금으로 갑니다');
});

test('.bat 는 ASCII·CRLF — 윈도 cmd 에서 안 깨지게', () => {
  assert.ok([...bat].every((b) => b < 0x80), 'ASCII 밖 글자가 있습니다');
  assert.ok(!/(^|[^\r])\n/.test(bat.toString('latin1')), '줄 끝이 CRLF 가 아닙니다');
});
