/* 🤖 AI로 서식 고치기 — 채팅으로 자유롭게 지시 (대표 결정 2026-09-26)
 *
 * 대표가 스레드에서 본 남의 서비스(InkPad)를 보고 「이 기능을 카피해서 기금관리에
 * 집어넣으면 안되나」 → AskUserQuestion 으로 범위를 여쭤 「채팅으로 자유롭게 지시」로 정했다.
 * 목업(claude.ai/artifact/Bv8fSDBufMwfsvpQU5WgE2) 승인 후 구현.
 *
 * ★ 한글의 진짜 「AI 편집 통로」(applyTextCommand)는 못 쓴다 — 지문(SHA-256)을 읽어 오는
 *   요청이 없다. 그래서 이미 검증된 엔진 직접 호출(doc.searchAllText/replaceAll)로 간다.
 * ★ 안전장치: AI 가 고른 글이 문서에 «정확히 한 곳»에만 있어야 바꾼다 — 이 검사의 핵심.
 *
 * 순수 함수만 여기서 본다(fund-hwp-template.test.js 와 같은 grabFn 방식) — 화면·네트워크·
 * rhwp 엔진 부분은 fund-ai-edit-wired.test.js 가 «정의만 하고 이어 붙이지 않는» 사고를 막는다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = i; j < SRC.length; j++) {
    if (SRC[j] === '{') { d++; on = true; }
    else if (SRC[j] === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
  }
  throw new Error('함수 끝을 못 찾음: ' + name);
}
function grabDecl(name) {
  const i = SRC.indexOf('var ' + name + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('=', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{' || c === '[') { d++; on = true; }
    else if (c === '}' || c === ']') { d--; if (on && !d) return SRC.slice(i, j + 1) + ';'; }
  }
  throw new Error('상수 끝을 못 찾음: ' + name);
}

const API = (() => {
  const box = {};
  new Function([
    grabDecl('AI_MODELS'),
    grabFn('aiJson'),
    grabFn('_aiEditSystemPrompt'),
    grabFn('_aiParseEditsReply'),
    grabFn('_aiClassifyEdits'),
    grabFn('_aiDumpText'),
    'this.aiJson=aiJson; this.systemPrompt=_aiEditSystemPrompt; this.parseReply=_aiParseEditsReply;',
    'this.classify=_aiClassifyEdits; this.dumpText=_aiDumpText; this.MODELS=AI_MODELS;',
  ].join('\n')).call(box);
  return box;
})();

/* fund-hwp-template.test.js 의 fakeDoc 과 같은 흉내 — 문단 하나짜리 글로 찾기·바꾸기만 흉내 낸다.
   ⚠ searchAllText 는 원문 그대로(case-sensitive) 세어야 한다 — _aiClassifyEdits 는 대소문자를
     가려 부른다(doc.searchAllText(e.find,true,true)). */
function fakeDoc(text) {
  const d = { text };
  d.searchAllText = (q) => {
    const hits = []; let i = d.text.indexOf(q);
    while (i >= 0) { hits.push({ sec: 0, para: 0, charOffset: i }); i = d.text.indexOf(q, i + 1); }
    return JSON.stringify(hits);
  };
  d.replaceAll = (a, b) => {
    const n = d.text.split(a).length - 1;
    d.text = d.text.split(a).join(b);
    return JSON.stringify({ ok: true, count: n });
  };
  return d;
}

test('AI_MODELS — work.html·pu-erp.html 과 같은 프록시를 쓰니 모델 이름도 같다', () => {
  assert.ok(API.MODELS.includes('claude-opus-5'));
  assert.ok(API.MODELS.includes('claude-sonnet-4-20250514'));
});

test('systemPrompt — «찾아 바꾸기만» 시키고, JSON 하나만 요구한다', () => {
  const p = API.systemPrompt();
  assert.match(p, /find/);
  assert.match(p, /replace/);
  assert.match(p, /지어내지/, '있는 글만 골라야 한다고 못 박는다');
  assert.match(p, /표.*줄.*글씨/, '모양은 안 바꾼다고 알려준다');
});

test('aiJson — 앞뒤에 말이 섞여 와도 JSON 만 뽑는다', () => {
  const j = API.aiJson('알겠습니다\n{"edits":[{"find":"a","replace":"b"}]}\n끝');
  assert.deepEqual(j.edits, [{ find: 'a', replace: 'b' }]);
});
test('aiJson — 중괄호가 없으면 알아들을 수 없다고 알린다', () => {
  assert.throws(() => API.aiJson('그냥 말'), /해석할 수 없습니다/);
});

test('parseReply — 정상 모양은 그대로 옮긴다', () => {
  const r = API.parseReply('{"edits":[{"find":"본사 회의실","replace":"본사 3층 대회의실"}],"note":"바꿨습니다"}');
  assert.deepEqual(r.edits, [{ find: '본사 회의실', replace: '본사 3층 대회의실' }]);
  assert.equal(r.note, '바꿨습니다');
});
test('parseReply — edits 가 없거나 모양이 틀리면 «지어내지 않고» 빈 목록', () => {
  assert.deepEqual(API.parseReply('그냥 말입니다').edits, []);
  assert.deepEqual(API.parseReply('{"note":"모르겠어요"}').edits, []);
  assert.equal(API.parseReply('{"note":"모르겠어요"}').note, '모르겠어요');
});
test('parseReply — find·replace 가 문자열이 아닌 항목은 조용히 버린다', () => {
  const r = API.parseReply('{"edits":[{"find":"a","replace":"b"},{"find":123,"replace":"c"},{"find":"d"}]}');
  assert.deepEqual(r.edits, [{ find: 'a', replace: 'b' }]);
});

test('★ classify — 문서에 «정확히 한 곳»에만 있으면 바꾼다', () => {
  const doc = fakeDoc('일 시: 2026. 3. 2.\n장 소: 본사 회의실\n의안번호 제1호');
  const r = API.classify(doc, [{ find: '본사 회의실', replace: '본사 3층 대회의실' }]);
  assert.equal(r.applied.length, 1);
  assert.equal(r.applied[0].count, 1);
  assert.equal(r.skipped.length, 0);
  assert.ok(doc.text.includes('본사 3층 대회의실'));
});

test('★★ classify — 같은 글이 «여러 곳»이면 지어내지 않고 되묻는다(바꾸지 않는다)', () => {
  const doc = fakeDoc('가. 목적사업 승인\n나. 목적사업 승인 결의\n다. 목적사업 승인 통지');
  const before = doc.text;
  const r = API.classify(doc, [{ find: '목적사업 승인', replace: '고유목적사업 시행' }]);
  assert.equal(r.applied.length, 0);
  assert.equal(r.skipped.length, 1);
  assert.match(r.skipped[0].reason, /3곳/);
  assert.equal(doc.text, before, '어느 자리인지 모르면 문서를 건드리지 않는다');
});

test('classify — 문서에 없는 글은 못 찾았다고 알린다', () => {
  const doc = fakeDoc('본사 회의실');
  const r = API.classify(doc, [{ find: '지어낸 문장', replace: 'x' }]);
  assert.equal(r.applied.length, 0);
  assert.match(r.skipped[0].reason, /찾지 못했/);
});

test('classify — 여러 지시를 한 번에 주면 되는 것만 바꾸고 안 되는 것은 따로 알린다', () => {
  const doc = fakeDoc('회의 장소: 본사 회의실\n출연금: ＿＿＿');
  const r = API.classify(doc, [
    { find: '본사 회의실', replace: '본사 3층' },
    { find: '없는말', replace: 'x' },
  ]);
  assert.equal(r.applied.length, 1);
  assert.equal(r.skipped.length, 1);
});

test('classify — find 가 비었거나 없는 항목은 조용히 건너뛴다(죽지 않는다)', () => {
  const doc = fakeDoc('아무 글');
  const r = API.classify(doc, [null, {}, { find: '', replace: 'x' }]);
  assert.equal(r.applied.length, 0);
  assert.equal(r.skipped.length, 0);
});

test('dumpText — <hp:t> 안의 글자만 남기고 나머지 태그는 걷는다', () => {
  const xml = '<hp:p><hp:run charPrIDRef="0"><hp:t>회의 장소: 본사 회의실</hp:t></hp:run></hp:p>';
  const t = API.dumpText([xml]);
  assert.equal(t, '회의 장소: 본사 회의실');
});
test('dumpText — 표 칸의 글도 담는다(여러 section.xml 을 이어 붙인다)', () => {
  const a = '<hp:p><hp:t>1쪽 글</hp:t></hp:p>';
  const b = '<hp:tc><hp:t>표 칸 글</hp:t></hp:tc>';
  const t = API.dumpText([a, b]);
  assert.match(t, /1쪽 글/);
  assert.match(t, /표 칸 글/);
});
test('dumpText — 너무 길면 잘라서 알린다(프록시 비용을 아낀다)', () => {
  const xml = '<hp:t>' + 'X'.repeat(7000) + '</hp:t>';
  const t = API.dumpText([xml]);
  assert.ok(t.length < 6100);
  assert.match(t, /뒤 생략/);
});
test('dumpText — 빈 목록도 죽지 않는다', () => {
  assert.equal(API.dumpText([]), '');
  assert.equal(API.dumpText(null), '');
});
