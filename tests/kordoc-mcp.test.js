'use strict';
/* kordoc(한글·PDF 문서 읽기·비교·양식) MCP 연결 (대표 지시 2026-09-27 「니가해라」)

   ■ 지키는 것
     ⓐ 판을 못 박는다 — `npx -y kordoc` 만 쓰면 새 판이 나올 때마다 동작이 조용히 바뀐다.
     ⓑ 바깥 통신을 막는다(KORDOC_OFFLINE=1) — OCR 모델 내려받기·웹훅이 사건 서류를 들고 나가지 않게.
     ⓒ 읽을 수 있는 폴더를 묶을 자리(KORDOC_ROOT)를 비워 두지 않는다 — PC 마다 달라 환경변수로 받는다.
   ⚠ 이 연결은 «개발자 도구»다. 앱(브라우저)은 kordoc 을 부르지 않는다 — 주민번호는 브라우저 밖으로 안 나간다. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');

const conf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '.mcp.json'), 'utf8'));
const k = (conf.mcpServers || {}).kordoc;

test('kordoc MCP 가 저장소 연결 설정에 있다', () => {
  assert.ok(k, 'kordoc 연결이 없습니다');
  assert.equal(k.type, 'stdio');
  assert.equal(k.command, 'npx');
  assert.ok(k.args.indexOf('mcp') >= 0, 'MCP 서버로 띄우지 않습니다');
});

test('ⓐ 판을 못 박는다', () => {
  const pkg = k.args.filter((a) => /^kordoc/.test(a))[0] || '';
  assert.match(pkg, /^kordoc@\d+\.\d+\.\d+$/, '판이 고정되지 않았습니다: ' + pkg);
});

test('ⓑⓒ 바깥 통신을 막고, 읽을 폴더를 묶을 자리가 있다', () => {
  const env = k.env || {};
  assert.equal(env.KORDOC_OFFLINE, '1', '바깥 통신이 열려 있습니다');
  assert.match(String(env.KORDOC_ROOT || ''), /\$\{KORDOC_ROOT/, '읽을 폴더를 묶는 자리가 없습니다');
});

test('앱(배포되는 js/·html)은 kordoc 을 부르지 않는다', () => {
  const root = path.join(__dirname, '..');
  const hits = [];
  const scan = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      if (/\.(js|html)$/.test(f) && /kordoc/i.test(fs.readFileSync(path.join(dir, f), 'utf8'))) hits.push(f);
    }
  };
  scan(root);
  scan(path.join(root, 'js'));
  assert.deepEqual(hits, [], '앱 파일이 kordoc 을 부릅니다 — 문서가 브라우저 밖으로 나갈 길이 생깁니다');
});
