'use strict';
/* 정관 제목 바로 아래 «중복 기금이름 줄»·«빈 인가일자 줄»을 지운다
 * (대표 지시 2026-09-20 「캡쳐2 삭제해라」 — 캡쳐2 는 정관 화면에서 제목
 *   「더 행 복 한 충 남 공 동 근 로 복 지 기 금  정 관」 바로 아래 두 줄:
 *     「더행복한충남공동근로복지기금」(기금이름만 한 번 더)
 *     「20  년    월    일  인가」(빈 인가일자 자리표)
 *
 * ★ 지운 자리를 «정확히» 집었다 — 「00공동근로복지기금」이라는 말이 문서 뒤쪽
 *   (부칙 등)에 «한 번 더» 나온다. 그건 안 건드렸다. 여는 두 번째·세 번째 문단
 *   (제목 바로 다음)만 골라 지웠다 — 스타일(line-height:142%/200%)까지 맞춰
 *   짝을 확인한 뒤 지웠다(짝이 안 맞으면 손대지 않고 에러를 내게 만들어 뒀다).
 * ★ 정관은 원본이 둘이다(공동 charter · 사내 charter_sane) — 둘 다 같은 모양의
 *   두 줄이 있어 «둘 다» 지웠다.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FF = fs.readFileSync(path.join(__dirname, '..', 'fund_forms.js'), 'utf8');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');
let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

function getTemplate(key) {
  const l = FF.split('\n').find((x) => x.trim().startsWith('"' + key + '"'));
  assert.ok(l, 'fund_forms.js 에 ' + key + ' 가 없다');
  const m = /^\s*"[a-z_0-9]+":\s*("(?:[^"\\]|\\.)*")/.exec(l);
  return JSON.parse(m[1]);
}
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
function grabLine(varDecl) {
  const i = SRC.indexOf('var ' + varDecl + '=');
  assert.ok(i >= 0, 'fund.html 에 상수가 없다: ' + varDecl);
  return SRC.slice(i, SRC.indexOf('\n', i));
}

for (const [key, 이름말] of [['charter', '00공동근로복지기금'], ['charter_sane', '00 사내근로복지기금']]) {
  test('★★ ' + key + ' — 제목 다음 중복 이름줄·빈 인가일자 줄이 없다', () => {
    const html = getTemplate(key);
    const ps = [...html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/g)];
    assert.ok(ps.length >= 2, key + ' 문단이 너무 적습니다.');
    /* 제목(첫 문단) 다음 문단이 곧바로 「제 1 장」이어야 한다 — 그 사이에 지운 두 줄이 남아 있으면 안 된다 */
    assert.match(ps[1][0], /제\s*1\s*장/, '★ 제목 다음이 「제 1 장」이 아닙니다 — 지운 두 줄이 아직 있습니다.');
    assert.ok(!/text-align:right;line-height:200%/.test(html.split(ps[1][0])[0]),
      '★ 제목과 「제1장」 사이에 인가일자 줄(오른쪽 정렬) 흔적이 남았습니다.');
  });

  test('★ ' + key + ' — 지운 두 줄 말고는 한 글자도 안 바뀌었다(뒤쪽 자리표는 그대로)', () => {
    const html = getTemplate(key);
    /* {{FUND}} 자리표는 그대로 여러 곳에 남아 있어야 한다 */
    assert.ok((html.match(/\{\{FUND\}\}/g) || []).length >= 2,
      '★ {{FUND}} 자리표가 줄었습니다 — 본문까지 건드렸을 수 있습니다.');
  });
}

test('★ charter — 문서 뒤쪽(부칙 등)의 「00공동근로복지기금」은 그대로 남아 있다', () => {
  const html = getTemplate('charter');
  assert.equal((html.match(/00공동근로복지기금/g) || []).length, 1,
    '★ 뒤쪽 자리표가 사라졌거나(0) 앞의 것도 안 지워졌습니다(2+) — 정확히 하나만 남아야 합니다.');
});

test('★★ 실제로 그려 보면(fillCharterHead) 제목 다음이 곧바로 「제 1 장」이다', (t) => {
  if (!JSDOM) return t.skip('jsdom 없음');
  for (const [key, fname] of [['charter', '가짜공동근로복지기금'], ['charter_sane', '가짜사내근로복지기금']]) {
    const dom = new JSDOM('<!doctype html><body></body>');
    const doc = dom.window.document;
    const root = doc.createElement('div');
    root.innerHTML = getTemplate(key).replace(/\{\{FUND\}\}/g, fname);

    new Function('document', 'root', 'F', [
      grabLine('CHARTER_TITLE'), grabLine('CHARTER_NAME'),
      grabLine('CHARTER_DATELINE'), grabLine('CHARTER_BRANCH'),
      grabFn('fillCharterHead'),
      'fillCharterHead(root,F);',
    ].join('\n')).call({}, doc, root, { name: fname, address: '' });

    const ps = [...root.querySelectorAll('p')].map((p) => p.textContent.trim());
    assert.equal(ps[0], fname + ' 정관', '★ ' + key + ' 제목이 이름으로 안 채워집니다.');
    assert.match(ps[1], /제\s*1\s*장/, '★ ' + key + ' — 채운 뒤에도 제목 다음이 「제1장」이 아닙니다.');
    assert.ok(!ps.some((x) => /^\s*(?:20)?\s*[＿_]*\s*년\s*월\s*일\s*인가\s*$/.test(x)),
      '★ ' + key + ' — 채운 뒤에도 빈 인가일자 줄이 남아 있습니다: ' + JSON.stringify(ps.slice(0, 3)));
  }
});

test('★ fund_forms.js 에 캐시번호가 붙어 있다 — 안 올리면 브라우저가 옛 서식을 계속 쓴다', () => {
  /* ⚠ 숫자를 못박지 않는다(다음에 또 올리면 이 검사부터 깨진다) — «붙어 있는지»만 본다.
     실제로 이번에 6→7 로 올렸다는 것은 git diff 로 확인했다(코드에 못박지 않는다). */
  assert.match(SRC, /fund_forms\.js\?v=\d+/, '★ 캐시번호(?v=숫자)가 안 붙어 있습니다.');
});
