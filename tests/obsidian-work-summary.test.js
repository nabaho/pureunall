const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/pu-obsidian.js', 'utf8');

test('옵시디언 연결은 공식 obsidian URI로 새 메모리를 연다', () => {
  assert.match(source, /obsidian:\/\/new\?name=/);
  assert.match(source, /encodeURIComponent\(n\.body\)/);
});

test('업무요약 메모리는 원본·첨부파일 없이 ERP 링크와 업무 필드를 담는다', () => {
  for (const field of ['업체', '담당자', '기한', 'ERP 원본', '업무 요약', '다음 할 일']) assert.match(source, new RegExp(field));
  assert.match(source, /원본 자료와 첨부파일은 포함하지 않습니다/);
});

test('업무요약 연결은 허용된 팔레트 색을 사용한다', () => {
  assert.match(source, /#1e40af/);
});
