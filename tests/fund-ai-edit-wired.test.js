/* 🤖 AI로 서식 고치기 — 화면에 실제로 붙어 있는지 (wire-both-ends 규칙: 정의만 하고 이어
 * 붙이지 않는 사고를 막는다. 순수 함수 자체는 fund-ai-edit.test.js 가 본다.) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

test('한글 편집기 창에 [🤖 AI로 고치기] 단추가 있다', () => {
  assert.match(html, /onclick="openHwpAiChat\(\)"/);
  assert.match(html, />🤖 AI로 고치기</);
});

test('openHwpAiChat — 지금 열린 원본(_hwpOriginalBuf)으로 새 문서를 연다', () => {
  const fn = html.slice(html.indexOf('function openHwpAiChat('), html.indexOf('function closeHwpAiChat('));
  assert.match(fn, /_hwpOriginalBuf/);
  assert.match(fn, /PureunHwp\.openDoc\(buf,\s*name\)/);
  assert.match(fn, /_aiDoc\s*=\s*doc/);
});

test('closeHwpAiChat — 열어 둔 doc 을 free 한다(메모리 안 샌다)', () => {
  const fn = html.slice(html.indexOf('function closeHwpAiChat('), html.indexOf('function _aiNav('));
  assert.match(fn, /_aiDoc\.free\(\)/);
});

test('aiChatSend — 동의 → 문서 내용 뽑기 → AI 부르기 → 적용, 한 줄로 이어진다', () => {
  const fn = html.slice(html.indexOf('function aiChatSend('), html.indexOf('function _aiDownload('));
  assert.match(fn, /aiFundConsent\(\)/, '동의 없이 밖으로 안 나가야 한다');
  assert.match(fn, /_aiDumpText\(/);
  assert.match(fn, /aiCall\(_aiEditSystemPrompt\(\)/);
  assert.match(fn, /_aiParseEditsReply\(/);
  assert.match(fn, /_aiClassifyEdits\(_aiDoc/);
  assert.match(fn, /aiDlBtn/, '뭔가 바뀌면 내려받기 단추를 켜야 한다');
});

test('★ AI 가 고른 글이 실제 문서 안에 있는지 doc 으로 확인한 뒤에만 바꾼다', () => {
  const classify = html.slice(html.indexOf('function _aiClassifyEdits('), html.indexOf('function _aiDumpText('));
  assert.match(classify, /doc\.searchAllText\(e\.find/, '적용 전에 반드시 찾아본다');
  assert.match(classify, /hits\.length>1/, '여러 곳이면 건너뛴다 — 지어내지 않는다');
  assert.match(classify, /hits\.length===0/, '없으면 건너뛴다');
});

test('_aiDownload — 실제로 바뀐 게 있을 때만 되고, 줄을 다시 나눈 뒤 내보낸다', () => {
  const fn = html.slice(html.indexOf('function _aiDownload('), html.indexOf('/* ══════════ 원본 한글'));
  assert.match(fn, /if\s*\(!_aiDoc\s*\|\|\s*!_aiApplied\.length\)\s*return;/);
  assert.match(fn, /_hwpRelayout\(_aiDoc\)/, '줄 다시 나누기 없이 그냥 내보내면 한글에서 겹친다(#1583 의 교훈)');
  assert.match(fn, /PureunHwp\.download\(/);
});

test('_aiRenderPreview — 고친 게 있을 때만 relayout 을 거쳐 그린다(원본 doc 은 그대로 둔다)', () => {
  const fn = html.slice(html.indexOf('function _aiRenderPreview('), html.indexOf('function _aiMsgPush('));
  assert.match(fn, /_aiApplied\.length\s*\?\s*_hwpRelayout\(_aiDoc\)/);
  assert.match(fn, /renderPageSvg/);
});

test('AI 프록시 주소는 포털 설정에서만 읽는다(기금 환경설정에 새 칸을 만들지 않는다)', () => {
  assert.match(html, /window\.PU_CFG\s*&&\s*window\.PU_CFG\.aiProxyUrl/);
});

test('AI 를 쓰기 전에 동의를 구하고, 한 번 동의하면 다시 안 묻는다', () => {
  const fn = html.slice(html.indexOf('function aiFundConsent('), html.indexOf('var AI_WAIT_MS'));
  assert.match(fn, /fund_ai_ok/);
  assert.match(fn, /localStorage\.getItem\('fund_ai_ok'\)==='1'/);
});

test('바깥으로 나가는 부름은 aiFetch 하나뿐이고, 시간 제한이 있다', () => {
  assert.match(html, /var AI_WAIT_MS=60000;/);
  const call = html.slice(html.indexOf('function aiCall('), html.indexOf('function aiJson('));
  assert.match(call, /aiFetch\(url/);
  assert.doesNotMatch(call, /(?<!ai)fetch\(url/, 'aiCall 은 aiFetch 를 거쳐야 한다(시간 제한 없이 fetch 를 직접 부르면 안 된다)');
});
