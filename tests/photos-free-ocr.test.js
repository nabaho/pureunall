'use strict';
/* 사업자등록증 «무료» 판독 — 규칙을 못 박는다 (대표 결정 2026-09-08)
   실행: node --test tests/photos-free-ocr.test.js
   목업: docs/mockups/photos-free-ocr-bizreg.html
   대표 결정: ①㉮ 사업자등록증만 · ②㉯ 자동으로 보낸다 · ③㉮ Vision 먼저

   ⚠ 「지금 값」이 아니라 «규칙»을 본다(CLAUDE.md). 칸 개수·글귀를 글자로 박지 않고,
     ① 무료 길이 열리는 조건 ② 안 열리는 조건 ③ 화면이 그 사실을 말하는지를 본다.
   ⚠ 예외 하나 — 사업자등록번호 «체크섬»은 값 자체가 규칙이다. 국세청 계산식이라
     123-45-00003 은 통과하고 123-45-67890 은 안 된다(검사고정-허용). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
/* ⚠ .html 은 stripComments · .js 는 stripJs 다. 섞으면 «아무것도 안 걷고 조용히»
     지나간다 — 2026-09-08 에 이 검사가 그것으로 헛통과했다(strip-comments.js 머리 참고). */
const { stripComments, stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');
const ERP = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8');
const LAY = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8');

require(path.join(R, 'js', 'pu-doc-read.js'));
const DR = globalThis.PuDocRead;

/* 국세청 체크섬을 통과하는 번호 · 통과 못 하는 번호 (검사고정-허용 —
   값 자체가 규칙이다. 이 둘이 뒤집히면 안전장치가 통째로 무너진다). */
const 참번호 = '123-45-00003';
const 거짓번호 = '123-45-67890';

function 등록증(o) {
  const v = Object.assign({
    제목: '사업자등록증', 상호: '법인명(단체명): 주식회사 천성가축약품',
    대표: '대 표 자 : 김철수', 번호: '등록번호 : ' + 참번호,
    업태: '업 태 : 도매 및 소매업  종 목 : 동물약품',
    주소: '사업장 소재지 : 경기도 화성시 향남읍 상신리 12',
    개업: '개업연월일 : 2011 년 03 월 14 일', 전화: '전화 031-123-4567', 그밖: ''
  }, o || {});
  return [v.제목, v.상호, v.대표, v.번호, v.업태, v.주소, v.개업, v.전화, v.그밖]
    .filter(Boolean).join('\n');
}

/* ══════ ① 무료 길이 «열리는» 조건 ══════════════════════════════════════════ */

test('★ 제목과 «검산 통과» 번호가 둘 다 있어야 무료 길이 열린다', () => {
  assert.equal(DR.bizregLooks(등록증()), true, '멀쩡한 등록증인데 안 열립니다');
  assert.equal(DR.bizregLooks(등록증({ 제목: '표준근로계약서' })), false,
    '★ 제목이 없는데 열렸습니다 — 아무 서류나 사업자등록증으로 읽힙니다');
  assert.equal(DR.bizregLooks(등록증({ 번호: '등록번호 : ' + 거짓번호 })), false,
    '★ 체크섬에서 걸려야 할 번호로 열렸습니다 — 흐린 사진의 오독이 그대로 저장됩니다');
  assert.equal(DR.bizregLooks(등록증({ 번호: '' })), false, '번호가 없는데 열렸습니다');
});

test('제목 글자가 띄어져 와도 읽는다 — 괘선·도장 때문에 흔한 일이다', () => {
  assert.ok(DR.bizregTitle('사 업 자 등 록 증'), '띄어 쓴 제목을 못 읽습니다');
  assert.ok(DR.bizregTitle('사업자등록증'), '붙여 쓴 제목을 못 읽습니다');
});

test('★ «긴» 제목이 이긴다 — 증명서를 등록증이라 적으면 갈래가 틀린 이름으로 생긴다', () => {
  const 증명 = DR.bizregTitle('사업자등록증명 발급 확인');
  assert.notEqual(증명, '사업자등록증',
    '★ 「사업자등록증명」을 「사업자등록증」이라 읽었습니다 — 이 둘은 다른 서류입니다');
  assert.ok(증명.length > '사업자등록증'.length, '긴 제목이 안 이겼습니다');
  /* 고유번호증도 이 길로 온다(비영리법인·국가기관) */
  assert.ok(DR.bizregTitle('고유번호증'), '고유번호증을 못 읽습니다');
});

test('★ 검산을 통과한 번호만 고른다 — 여러 개가 보여도', () => {
  const 글 = 등록증({ 그밖: '참고번호 ' + 거짓번호 });
  assert.equal(DR.bizregNo(글).replace(/\D/g, ''), 참번호.replace(/\D/g, ''),
    '★ 검산 못 한 번호를 골랐습니다');
});

/* ══════ ② 칸을 «어떻게» 채우나 ═════════════════════════════════════════════ */

test('★ 「법인명(단체명)」 이름표 찌꺼기가 상호에 붙지 않는다', () => {
  const f = DR.bizregFields(등록증());
  assert.ok(f.company, '상호를 못 읽었습니다');
  assert.equal(/단체명|법인명|상\s*호/.test(f.company), false,
    '★ 이름표가 상호에 붙었습니다(' + f.company + ') — 그 글자가 기업 상세로 나갑니다');
  assert.ok(f.company.indexOf('천성가축약품') >= 0, '정작 회사 이름이 빠졌습니다');
});

test('상호·대표자·번호·업태·종목·소재지를 채운다', () => {
  const f = DR.bizregFields(등록증());
  ['company', 'ceo', 'bizno', 'bizType', 'bizItem', 'address'].forEach(k => {
    assert.ok(String(f[k] || '').trim(), '이 칸을 못 채웠습니다: ' + k);
  });
});

test('★ 못 채우는 칸을 «지어내지» 않는다 — 발급일·전자세금계산서 주소', () => {
  const f = DR.bizregFields(등록증({ 그밖: '2025 년 02 월 12 일  화성세무서장\ntax@ex.co.kr' }));
  assert.equal(f.issueDate, undefined,
    '★ 등록증 발급일을 채웠습니다 — 규칙으로는 개업일과 구별할 수 없어 「최신 판별」이 뒤집힙니다');
  assert.equal(f.taxInvoiceEmail, undefined,
    '★ 등록증에 적힌 아무 주소를 세금계산서 «전용» 주소로 넣었습니다');
});

test('★ 공동대표를 대표자 칸에 «둘» 넣지 않는다', () => {
  const f = DR.bizregFields(등록증({ 대표: '대 표 자 : 김철수, 이영희' }));
  assert.equal(/[,·]/.test(String(f.ceo || '')), false,
    '★ 대표자 칸에 둘이 들어갔습니다(' + f.ceo + ') — 계약서·신고서에 그대로 나갑니다');
  assert.ok(String(f.memo || '').indexOf('이영희') >= 0,
    '둘째 대표를 버렸습니다 — 메모에라도 남겨야 합니다');
});

/* ══════ ③ freeRead — 입구의 규칙 ══════════════════════════════════════════ */

test('★ 상호나 번호가 없으면 null 을 준다 — 던지지 않는다', async () => {
  /* 던지면 부르는 쪽이 「판독 실패」로 적어, 멀쩡한 서류가 다시 읽을 것에 쌓인다. */
  const 없다 = await DR.freeRead({ text: '아무 글자' });
  assert.equal(없다, null, '사업자등록증이 아닌데 결과를 냈습니다');
  const 상호없다 = await DR.freeRead({ text: '사업자등록증\n등록번호 ' + 참번호 });
  assert.equal(상호없다, null,
    '★ 상호 없이 통과했습니다 — 기업 상세에 이름 없는 껍데기가 생깁니다');
});

test('★ 무료로 읽으면 free 표시가 붙고 via 는 «그대로»다', async () => {
  const r = await DR.freeRead({ text: 등록증() });
  assert.ok(r, '멀쩡한 등록증을 못 읽었습니다');
  assert.equal(r.kind, 'bizreg');
  assert.equal(r.free, true, '★ free 표시가 없습니다 — 화면이 「0원」을 알 길이 없습니다');
  assert.ok(r.via === 'text' || r.via === 'image',
    'via 가 글자/그림 둘 중 하나가 아닙니다: ' + r.via);
  assert.notEqual(r.via, 'free',
    '★ free 를 via 에 섞었습니다 — staleRead 가 「더 나은 길이 생겼다」로 읽어 영영 다시 읽습니다');
  assert.equal(r.bizNoOk, true, '검산 결과가 안 붙었습니다 — 자동 보내기 문턱을 못 넘습니다');
});

test('글자가 이미 있으면 Vision 도 안 부른다 — 진짜 0원', async () => {
  const r = await DR.freeRead({ text: 등록증() });
  assert.equal(r.freeFrom, 'text',
    '문서에 있던 글자로 읽었는데 그렇게 적히지 않았습니다: ' + r.freeFrom);
});

/* ══════ ④ 체크섬은 «한 파일»이다 ══════════════════════════════════════════ */

test('★ 사업자등록번호 검산 계산식이 «늘어나지» 않는다', () => {
  const 계산식 = /\[\s*1\s*,\s*3\s*,\s*7\s*,\s*1\s*,\s*3\s*,\s*7\s*,\s*1\s*,\s*3\s*,\s*5\s*\]/g;
  assert.equal((stripJs(LAY).match(계산식) || []).length, 1,
    '★ 판독 층 안에 검산 계산식이 둘 이상입니다 — 한쪽만 고쳐지면 앱마다 다르게 검산합니다');
  /* ⚠ 푸른이알피에 «하나»가 남아 있다: window.bizNoChecksum — 입력 칸에 번호를
       칠 때 테두리를 붉게 하는 데 쓴다(판독과 무관한 옛 길). 2026-09-08 에 판독
       파서를 공용 층으로 옮기며 그 안의 사본은 지웠지만 이것은 남겼다 —
       tests/co-bizno-audit.test.js 가 이 함수의 «본문을 베어» 돌려 보고 있어서,
       같이 손대면 그 감사 검사가 함께 죽는다.
     ★ 여기서 세는 뜻: **셋이 되는 것을 막는다.** 하나 더 생기면 이 자리에서 걸린다. */
  assert.equal((stripComments(ERP).match(계산식) || []).length, 1,
    '★ 푸른이알피의 검산 계산식이 하나가 아닙니다 — 판독용 사본이 되살아났는지 보세요'
    + '(남아 있어도 되는 것은 window.bizNoChecksum 하나뿐입니다)');
});

test('★ 푸른이알피는 파서를 공용 층에서 가져온다 (두 벌로 갈라지지 않게)', () => {
  const bare = stripComments(ERP);
  assert.match(bare, /function parseBizLicense\(text\)\s*\{\s*return PuDocRead\.bizregParse\(text\);/,
    '★ 푸른이알피가 제 파서를 다시 들고 있습니다 — 사업자등록증을 앱마다 다르게 읽게 됩니다');
  assert.match(bare, /<script[^>]+src="js\/pu-doc-read\.js/,
    '★ 판독 층을 «싣지» 않습니다 — parseBizLicense 가 없는 것을 부르게 됩니다');
});

/* ══════ ⑤ 화면이 하는 일 ══════════════════════════════════════════════════ */

test('★ 무료로 읽은 것은 «자동으로» 다시 읽지 않는다', () => {
  const box = { PuDocRead: { PROMPT_VERSION: 9 }, RESTALE_SKIP: {}, console };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext([
    'function collectingNow() { return false; }',
    'function readPromptVer(r) { return (r && r.pv != null) ? (r.pv || 0) : ((r && r.rv) || 0); }',
    cutFn(APP, 'function staleRead(')
  ].join('\n'), box);
  const 무료 = { meta: { read: { kind: 'bizreg', free: true } } };
  const 옛AI = { meta: { read: { kind: 'bizreg', pv: 8 } } };
  box.__a = 무료; box.__b = 옛AI;
  assert.equal(vm.runInContext('staleRead(__a)', box), false,
    '★ 무료로 읽은 것이 다시 읽을 것으로 잡혔습니다 — 아끼려던 길이 되레 AI 몫을 태웁니다');
  assert.equal(vm.runInContext('staleRead(__b)', box), true,
    '옛 판으로 읽은 AI 결과는 여전히 다시 읽어야 합니다(이 규칙까지 막으면 안 됩니다)');
});

test('★ 판독 길이 «둘»인데 둘 다 무료 길을 거친다', () => {
  const bare = stripComments(APP);
  const 올릴때 = cutFn(bare, 'function readDocChunked(');
  const 다시읽을때 = cutFn(bare, 'function readPhoto(');
  assert.match(올릴때, /freeReadTry\(/,
    '★ 올릴 때 읽는 길이 무료 길을 안 거칩니다');
  assert.match(다시읽을때, /freeReadTry\(/,
    '★ 「다시 판독」 길이 무료 길을 안 거칩니다 — 올릴 때는 0원인데 다시 누르면 AI 를 씁니다');
  /* 두 길 모두 무료 표시를 판독 기록에 옮겨야 한다.
     ⚠ «부르는» 자리만 센다 — 함수를 «만드는» 줄까지 세면 답이 하나 커진다. */
  assert.equal((bare.match(/markFree\(read, r\);/g) || []).length, 2,
    '★ 무료 표시를 옮기는 자리가 두 곳이 아닙니다 — 한 길로 읽은 것만 「0원」이 붙습니다');
});

test('★ 「AI 로 더 자세히 읽기」는 무료 길을 «건너뛴다»', () => {
  const bare = stripComments(APP);
  assert.match(cutFn(bare, 'function readWithAi('), /noFree:\s*true/,
    '★ 건너뛰지 않습니다 — 같은 무료 답이 또 나오고 누른 사람은 아무 일도 없다고 봅니다');
  assert.match(cutFn(bare, 'function freeReadTry('), /opt\s*&&\s*opt\.noFree/,
    '★ noFree 를 보지 않습니다 — 건너뛰라고 해도 무료로 읽습니다');
  /* 가림 확인을 「다시 판독」과 같게 지킨다 — 이 길로 원본이 AI 로 새면 안 된다 */
  assert.match(cutFn(bare, 'function readWithAi('), /maskForced\(/,
    '★ 가림 확인이 없습니다 — 저쪽에서 막아 둔 것이 이 길로 샙니다');
});

test('★ 「0원」 딱지가 갈래 딱지와 «같은 줄»이다 (표의 한 칸은 한 줄)', () => {
  const bare = stripComments(APP);
  const 줄 = bare.match(/'<div class="top">[\s\S]{0,400}?<\/div>'/);
  assert.ok(줄, '결과 칸의 첫 줄을 못 찾았습니다');
  assert.match(줄[0], /freeChip\(/,
    '★ 「0원」 딱지가 그 줄에 없습니다 — 다른 줄로 내려가면 결과 칸이 한 줄 길어집니다');
});

test('무료로 읽었다는 사실과 «못 채운 칸»을 화면이 말한다', () => {
  const bare = stripComments(APP);
  const 딱지 = cutFn(bare, 'function freeChip(');
  const 상자 = cutFn(bare, 'function freeBox(');
  assert.match(딱지, /read\.free/, '딱지가 free 를 안 봅니다');
  assert.match(상자, /freeMissing\(/, '★ 못 채운 칸을 안 알려 줍니다');
  assert.match(상자, /readWithAi\(\)/, '★ AI 로 더 읽을 길을 안 줍니다');
  /* 늘 없는 칸으로 헛경보를 내지 않는다 — 개인사업자에게 법인등록번호는 없다 */
  assert.equal(/corpno/.test(cutFn(bare, 'const FREE_CORE =') || bare.match(/const FREE_CORE = \[[^\]]*\]/)[0]), false,
    '★ 법인등록번호를 「비면 알릴 칸」에 넣었습니다 — 개인사업자마다 헛경보가 뜹니다');
});

test('★ 여러 장짜리 사진 묶음은 무료 길로 «안» 보낸다', () => {
  const fn = stripComments(cutFn(APP, 'function freeReadTry('));
  assert.match(fn, /imgs\s*\|\|\s*\[\]\)\.length\s*!==\s*1|imgs\.length\s*!==\s*1/,
    '★ 여러 쪽을 첫 장만 보고 갈래를 정하게 됩니다 — 2쪽 이후를 버리고도 모릅니다');
});

/* ══════ ⑥ 자동 보내기 (대표 결정 ②㉯) ═════════════════════════════════════ */

test('★ 무료로 읽은 것도 자동 보내기 문턱을 «그대로» 넘는다', async () => {
  const r = await DR.freeRead({ text: 등록증() });
  const box = { console, readFields: null };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext([
    'function readFields(read) { return (read && read.fields) || {}; }',
    'function canSendCoInfo() { return true; }',
    stripComments(cutFn(APP, 'function autoSendCoInfo('))
  ].join('\n'), box);
  box.__r = r;
  assert.equal(vm.runInContext('autoSendCoInfo(__r)', box), true,
    '★ 무료로 읽은 등록증이 스스로 못 갑니다 — 대표 결정은 「자동보낸다」입니다');
});

test('★ 보내는 길은 «빈 칸만» 채운다 — 무료 판독의 적은 칸이 기존 값을 덮지 않는다', () => {
  const 보내기 = stripJs(
    fs.readFileSync(path.join(R, 'js', 'pu-doc-file.js'), 'utf8'));
  /* ⚠ cutFn 은 «맨 왼쪽 }» 로 함수 끝을 가린다. 이 파일은 통째로 IIFE 안이라
       함수들이 두 칸 들여쓰기돼 있어 cutFn 이 첫 줄만 베어 온다 — 그래서 여기서는
       다음 형제 함수까지로 «구역»을 잘라 본다(2026-09-08 에 이것 때문에 헛통과했다). */
  const 시작 = 보내기.indexOf('function sendToCoInfo(o) {');
  assert.ok(시작 > 0, 'sendToCoInfo 를 못 찾았습니다 — 보내는 길이 바뀌었는지 보세요');
  const 다음 = 보내기.indexOf('\n  function ', 시작 + 10);
  const fn = 보내기.slice(시작, 다음 > 시작 ? 다음 : 보내기.length);
  assert.ok(fn.length > 1000, '구역이 너무 짧습니다(' + fn.length + '자) — 자르는 자리를 보세요');
  assert.match(fn, /if \(v == null \|\| String\(v\)\.trim\(\) === ''\) return;/,
    '★ 빈 값을 걸러내지 않습니다 — 무료 판독이 못 읽은 칸이 기존 값을 빈 값으로 덮습니다');
  assert.match(fn, /if \(had !== ''\)[\s\S]{0,900}?return;/,
    '★ 이미 있는 값을 덮습니다 — 자동으로 보내면 AI 로 읽어 둔 자세한 값이 사라집니다');
});
