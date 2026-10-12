/* 전광판 심부름꾼 — 열쇠·쓰기 범위·시험 모드 기본값의 «위생» (2026-10-12)
   코드를 «글자로» 보는 검사라 주석은 걷고 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'scripts', 'signboard-agent');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/[^\n]*/g, '$1');
const codeFiles = fs.readdirSync(DIR).filter((f) => f.endsWith('.js'));
const src = (f) => strip(fs.readFileSync(path.join(DIR, f), 'utf8'));

test('샘플 설정에는 열쇠가 비어 있고 실전이 꺼져 있다', () => {
  const c = JSON.parse(fs.readFileSync(path.join(DIR, 'config.example.json'), 'utf8'));
  assert.equal(c.sdkKey, ''); assert.equal(c.sdkSecret, '');
  assert.equal(c.liveEnabled, false);
});

test('코드에 열쇠 값을 글자로 박지 않았다', () => {
  codeFiles.forEach((f) => {
    const s = src(f);
    assert.doesNotMatch(s, /sdkSecret\s*[:=]\s*['"][^'"]{3,}['"]/, f + ': sdkSecret 글자 값');
    assert.doesNotMatch(s, /sdkKey\s*[:=]\s*['"][^'"]{3,}['"]/, f + ': sdkKey 글자 값');
  });
});

test('설정·열쇠를 통째로 찍지 않는다', () => {
  codeFiles.forEach((f) => {
    const s = src(f);
    assert.doesNotMatch(s, /console\.(log|error|warn)\([^)]*\bconfig\b/, f + ': 설정을 찍는다');
    assert.doesNotMatch(s, /JSON\.stringify\((ctx\.)?config\b/, f + ': 설정을 글자로 만든다');
  });
});

test('포털 데이터베이스에는 signboard/state «한 곳만» 쓴다(CLI 는 규칙을 건너뛰므로)', () => {
  const store = src('store.js');
  const updates = [...store.matchAll(/'database:(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(updates)].sort(), ['get', 'update']);
  assert.equal((store.match(/'database:update',\s*'([^']+)'/g) || []).length, 1);
  assert.match(store, /'database:update',\s*'\/signboard\/state'/);
  codeFiles.filter((f) => f !== 'store.js').forEach((f) => assert.doesNotMatch(src(f), /database:(set|update|remove|push)/, f));
});

test('시험 모드가 기본이다 — 실전은 liveEnabled 가 정확히 true 일 때뿐이고, --dry-run 이 이긴다', () => {
  const main = src('main.js');
  assert.match(main, /const dryRun = args\.dry \|\| config\.liveEnabled !== true;/);
});

test('장비에 보내는 길은 device.js 하나뿐이다', () => {
  codeFiles.filter((f) => f !== 'device.js').forEach((f) => assert.doesNotMatch(src(f), /require\(['"]node:http['"]\)|require\(['"]http['"]\)/, f + ': 장비 통신이 다른 곳에도 있다'));
});

test('.ps1 은 ASCII 만 쓴다 — 윈도 PowerShell 5.1 이 BOM 없는 파일을 ANSI 로 읽는다', () => {
  const b = fs.readFileSync(path.join(DIR, 'install-task.ps1'));
  for (const x of b) assert.ok(x < 128, '한글·특수문자가 들어 있다');
});

test('안내문이 시험 모드·대표 확인·열쇠 비공개를 말한다', () => {
  const r = fs.readFileSync(path.join(DIR, 'README.md'), 'utf8');
  assert.match(r, /시험 모드/); assert.match(r, /지워도 됩니다/); assert.match(r, /저장소·채팅·화면 어디에도 적지 않습니다/);
});
