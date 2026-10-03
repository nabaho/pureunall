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

/* 2026-09-30 대표 「순서대로 모두」 — 규정관리가 kordoc 로 원본을 읽게 됐다. 지키는 뜻은 그대로다:
   «문서는 브라우저 밖으로 안 나간다». 그래서 앱이 kordoc 을 쓰는 길은 «저장소에 넣은 브라우저 묶음»
   (vendor/kordoc, 오프라인 스위치를 켜고 묶음) 하나뿐이고, 서버·MCP·인터넷(npm·CDN)으로 부르는 길은 막는다.
   묶음이 읽는 동안 인터넷에 한 번도 안 닿는 것은 tests/kordoc-text.test.js 가 진짜로 읽혀 지켜본다. */
test('앱은 kordoc 을 «브라우저 안 묶음» 으로만 쓴다 — 서버·MCP·인터넷으로 부르지 않는다', () => {
  const root = path.join(__dirname, '..');
  const hits = [];
  /* 주석은 뺀다 — js/pu-ocr-kr.js 는 kordoc 의 OCR 핵심을 브라우저로 «옮겨 온» 것이라 출처(MIT)를 주석에 적는다.
     부르는 것이 아니다(모델·실행기만 받고 서류는 브라우저 안에서 읽는다). 코드 줄에 kordoc 이 나오면 여전히 걸린다. */
  const code = (s) => s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\'"])\/\/.*$/gm, '$1');
  const scan = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      if (/\.(js|html)$/.test(f) && /kordoc/i.test(code(fs.readFileSync(path.join(dir, f), 'utf8')))) hits.push(f);
    }
  };
  scan(root);
  scan(path.join(root, 'js'));
  const read = (f) => code(fs.readFileSync(fs.existsSync(path.join(root, f)) ? path.join(root, f) : path.join(root, 'js', f), 'utf8'));
  /* 서버·MCP·인터넷으로 부르는 꼴 — 이것이 나오면 문서가 밖으로 나갈 길이 생긴다 */
  const OUTSIDE = /(https?:)?\/\/[^"'\s]*kordoc|npx[^"'\n]*kordoc|kordoc@\d|kordoc-mcp|registry\.npmjs|mcpServers/i;
  hits.forEach((f) => assert.doesNotMatch(read(f), OUTSIDE, '★ ' + f + ' 이 kordoc 을 브라우저 밖(서버·MCP·인터넷)으로 부릅니다'));
  /* 묶음을 싣는 곳은 한 곳 — js/pu-kordoc-text.js 가 저장소의 vendor/kordoc 만 싣는다 */
  hits.filter((f) => f !== 'pu-kordoc-text.js').forEach((f) =>
    assert.doesNotMatch(read(f), /kordoc\.browser|import\([^)]*kordoc/i, '★ ' + f + ' 이 kordoc 묶음을 따로 싣습니다 — PuKordocText 로만'));
  if (hits.includes('pu-kordoc-text.js')) {
    assert.match(read('pu-kordoc-text.js'), /SRC = 'vendor\/kordoc\/kordoc\.browser\.min\.js/, '★ 저장소 밖의 kordoc 을 싣습니다');
  }
});

/* 2026-10-03 설계 §4-2 — 원칙이 «가리기 전 원본은 서버 메모리에서만, 저장되는 것은 가린 것뿐» 으로 넓어졌다.
   서버에서 kordoc 를 부르는 자리는 functions/rules-collect-redact.js «하나»뿐이고, 저장소 사본만 싣는다. */
test('서버에서 kordoc 를 부르는 곳은 rules-collect-redact.js 하나 — 저장소 사본만', () => {
  const dir = path.join(__dirname, '..', 'functions');
  const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\'"])\/\/.*$/gm, '$1');
  const hits = fs.readdirSync(dir).filter((f) => /\.js$/.test(f) && /kordoc/i.test(code(fs.readFileSync(path.join(dir, f), 'utf8'))));
  assert.deepEqual(hits, ['rules-collect-redact.js'], '★ 다른 서버 파일이 kordoc 를 부른다: ' + hits.join(','));
  const src = code(fs.readFileSync(path.join(dir, 'rules-collect-redact.js'), 'utf8'));
  /* 묶음 사본은 .mjs — .js 는 모듈 형식 추측 경고가 난다(Task 1 결정) */
  assert.match(src, /vendor', 'kordoc', 'kordoc\.browser\.min\.mjs'/);
  assert.doesNotMatch(src, /require\(['"]kordoc['"]\)|import\(['"]kordoc['"]\)|https?:\/\//, '★ 저장소 밖 kordoc');
});
