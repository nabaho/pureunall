'use strict';
/* 대표 지시 2026-09-27 「지금 기금인데 왜 기존자료불러오면서 이름표기가 모두 다 잘못되어
   있나? 완벽하게 고쳐라」 — 조사 결과, 서식 대부분은 「기금 정보」의 대표자(chairman) 칸이
   아니라 «임원 명부의 이사장 줄»(_boss(f))을 읽는다(대표자 정보를 따로 두지 않는다는
   기존 설계). 옛 시스템에서 옮겨 온 기금은 명부가 비거나 다른 사람으로 채워지기 쉬운데,
   대표자 칸만 봐서는 이 어긋남을 알 방법이 없었다 — «조용한 실패»였다.

   ⚠ 이 파일은 그 어긋남을 «눈에 띄게» 알리는 두 자리(임원 명부 화면·한글 미리보기)를 본다.
   값이 실제로 어디서 왔는지(officers 배열의 진짜 데이터)는 여기서 손대지 않는다 — 그 자료가
   왜 잘못 들어왔는지는(가져오기 스크립트·수기 입력 등) 이 저장소 밖의 일이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

function grabFn(name) {
  const i = SRC.indexOf('function ' + name + '(');
  assert.ok(i >= 0, 'fund.html 에 함수가 없다: ' + name);
  let d = 0, on = false;
  for (let j = SRC.indexOf('{', i); j < SRC.length; j++) {
    const c = SRC[j];
    if (c === '{') { d++; on = true; }
    else if (c === '}') { d--; if (on && !d) return SRC.slice(i, j + 1); }
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

/* ══ ① 임원 명부 화면(officerPanel) — 정말 그려서 본다 ══ */

function renderOfficerPanel(f) {
  const box = {};
  new Function('F', [
    'function esc(s){ return String(s==null?"":s); }',
    'function hlp(k){ return "<i>"+k+"</i>"; }',
    grabDecl('OFFICER_ROLES'),
    grabFn('_officersOf'), grabFn('_auditorsOf'), grabFn('_boss'), grabFn('_offRow'),
    grabFn('officerPanel'),
    'this.html = officerPanel(F);'
  ].join('\n')).call(box, f);
  return box.html;
}

test('★★ 명부의 이사장과 대표자 칸이 다르면 눈에 띄게 알린다', () => {
  const f = { chairman: '신동현', officers: [{ role: '이사장', name: '권형하' }] };
  const html = renderOfficerPanel(f);
  assert.match(html, /명부 이사장.*권형하/, '어긋남을 말하지 않는다');
  assert.match(html, /대표자 칸.*신동현/, '대표자 칸 쪽 이름도 함께 보여야 비교가 된다');
  assert.match(html, /서식엔.*권형하.*찍힙니다/, '서식엔 «어느 이름»이 찍히는지 말하지 않는다');
});

test('★ 명부의 이사장과 대표자 칸이 같으면 조용하다', () => {
  const f = { chairman: '신동현', officers: [{ role: '이사장', name: '신동현' }] };
  const html = renderOfficerPanel(f);
  assert.doesNotMatch(html, /≠/, '같은데도 어긋남 표시가 떴다');
});

test('★ 명부에 이사장이 없으면(대표자 칸만 있으면) 어긋남으로 잘못 잡지 않는다', () => {
  const f = { chairman: '신동현', officers: [] };
  const html = renderOfficerPanel(f);
  assert.doesNotMatch(html, /≠/, '명부가 비었을 뿐인데 어긋남으로 잡았다');
  assert.match(html, /비어 있음/, '명부가 비어 있다는 기존 경고는 그대로여야 한다');
});

test('★ 대표자 칸이 비어 있으면(아직 안 적었으면) 어긋남으로 잡지 않는다', () => {
  const f = { chairman: '', officers: [{ role: '이사장', name: '권형하' }] };
  const html = renderOfficerPanel(f);
  assert.doesNotMatch(html, /≠/, '대표자 칸이 비었을 뿐인데 어긋남으로 잡았다');
});

/* ══ ② 한글 미리보기(hwpSidePreview) — 실제로 이름이 찍히는 자리에도 같은 경고 ══ */

test('★★ 한글 미리보기도 같은 어긋남을 그 자리에서 말한다', () => {
  const src = grabFn('hwpSidePreview');
  assert.match(src, /_boss\(f\)/, '미리보기가 _boss 를 안 본다');
  assert.match(src, /f\.chairman/, '미리보기가 대표자 칸과 안 맞대본다');
  assert.match(src, /임원 명부의 이사장/, '알리는 말이 없다');
  assert.match(src, /msg\.push/, '기존 안내(msg) 줄에 얹어야 한 줄로 함께 보인다');
});

/* ══ ③ 🖼 붙여넣기 — 외부 글·그림을 편집기에 넣는 길 ══ */

test('★★ [🖼 붙여넣기] 단추가 HWP 편집창에 있고 hwpPasteClip 을 부른다', () => {
  const buf = grabFn('_openHwpBuf');
  assert.match(buf, /onclick="hwpPasteClip\(\)"/, '편집창 툴바에 붙여넣기 단추가 없다');
});

test('★★ hwpPasteClip 은 navigator.clipboard.read() 로 읽어 편집기 안에 «진짜 paste 이벤트»를 만든다', () => {
  const fn = grabFn('hwpPasteClip');
  assert.match(fn, /navigator\.clipboard\.read\(\)/, '클립보드를 안 읽는다');
  assert.match(fn, /hwpHost/, '편집기 자리(#hwpHost)를 안 찾는다');
  assert.match(fn, /querySelector\('iframe'\)/, 'iframe 안으로 안 들어간다');
  assert.match(fn, /contentDocument/, '같은 출처(same-origin) iframe 문서에 안 닿는다');
  assert.match(fn, /activeElement/, '지금 커서가 있는 자리를 안 찾는다 — 포커스가 없으면 어디에 넣을지 모른다');
  assert.match(fn, /new ClipboardEvent\('paste'/, '진짜 paste 이벤트를 안 만든다');
  assert.match(fn, /new DataTransfer\(\)/, '읽은 것을 clipboardData 로 안 담는다');
  assert.match(fn, /image\\\//, '그림(서명·도장) 형식을 안 본다');
});

test('★ hwpPasteClip 은 이 브라우저가 못 하면(구형) 조용히 죽지 않고 Ctrl+V 를 안내한다', () => {
  const fn = grabFn('hwpPasteClip');
  assert.match(fn, /!navigator\.clipboard\|\|!navigator\.clipboard\.read/, '지원 여부를 안 본다');
  assert.match(fn, /Ctrl\+V/, '대안(Ctrl+V)을 안 알린다');
});

test('★ hwpPasteClip 은 포커스가 없으면(문서 안을 안 눌렀으면) 지어내지 않고 그렇게 말한다', () => {
  const fn = grabFn('hwpPasteClip');
  assert.match(fn, /!target\|\|target===idoc\.body/, '포커스 없는 경우를 안 가린다');
  assert.match(fn, /클릭해 커서를 두고/, '무엇을 하라는지 안 말한다');
});
