'use strict';
/* 사진첩 — 폰에서 «한 줄»·«보이는 글자» 를 지킨다 (대표 지시 2026-10-18 「폰화면관리」)
   실행: node --test tests/photos-phone-oneline.test.js

   ⚠ 왜 이 검사가 생겼나 — 360·411px 로 로그인한 채 재 보니:
     ① 서류 카드(.cell.doc)가 «제목 없는 맨 사진»으로 보였다. 목록을 처음 받으면 미리보기가
        나중에 오는데, 그것을 끼우는 paintThumb 가 그림을 칸 «맨 앞»에 넣어 칸을 통째로 덮었다
        (renderGrid 는 같은 그림을 위쪽 띠 .strip «안»에 넣는다). 다른 일로 격자를 다시 그릴
        때까지 제목·업체 글자가 안 보였다 — PC 도 같았다.
     ② 크게 보기 윗줄에서 가운데 날짜가 「2026년 10월 18 / 일 (오늘)」로 낱말 가운데서 꺾였다.
     ③ 「이 날 전부 고르기 ✓」·「고른 것 풀기 ✕」가 20px 남짓이라 손가락이 빗나갔다.
   ⚠ px 값을 박지 않는다 — «어디에 끼우나 / 한 줄인가 / 단추를 지우지 않았나 / 누르는 자리가 넓은가» 를 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn');

const app = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8');
const css = app.slice(app.indexOf('<style'), app.indexOf('</style>'));

/* 폰 구간(@media max-width, min-width 없음)의 규칙만 모은다 — 중괄호 짝을 센다 */
function phoneRules() {
  const out = [];
  let i = 0;
  while ((i = css.indexOf('@media', i)) >= 0) {
    const open = css.indexOf('{', i);
    const cond = css.slice(i, open);
    let depth = 0, k = open;
    for (; k < css.length; k++) {
      if (css[k] === '{') depth++;
      else if (css[k] === '}') { depth--; if (!depth) break; }
    }
    if (/max-width/.test(cond) && !/min-width/.test(cond)) {
      const re = /([^{}]+)\{([^}]*)\}/g;
      const body = css.slice(open + 1, k);
      let m;
      while ((m = re.exec(body))) out.push({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: m[2] });
    }
    i = k + 1;
  }
  return out;
}
const PHONE = phoneRules();
function phoneBody(selRe) {
  return PHONE.filter(r => r.sel.split(',').some(s => selRe.test(s.trim()))).map(r => r.body).join(';');
}

/* ══════ ① 미리보기는 서류 카드의 «띠 안»에 끼운다 ══════ */
function fakeCell(withStrip) {
  const mk = (cls) => ({
    cls, kids: [], firstChild: null,
    insertBefore(c) { this.kids.unshift(c); this.firstChild = c; c.parent = this; },
    querySelector(q) {
      if (q === 'img') return find(this, k => k.tag === 'IMG');
      if (q === '.strip') return find(this, k => k.cls === 'strip');
      return null;
    }
  });
  function find(node, pred) {
    for (const k of node.kids) { if (pred(k)) return k; const f = k.kids ? find(k, pred) : null; if (f) return f; }
    return null;
  }
  const cell = mk(withStrip ? 'cell doc' : 'cell');
  if (withStrip) { const strip = mk('strip'); cell.kids.push(strip); strip.parent = cell; cell.firstChild = strip; }
  return cell;
}
function runPaint(cell) {
  const ctx = {
    THUMB_HOST: 'https://firebasestorage.googleapis.com/',
    safeSrc: s => s,
    document: {
      querySelector: () => cell,
      createElement: tag => ({ tag: String(tag).toUpperCase(), kids: [] })
    }
  };
  vm.createContext(ctx);
  vm.runInContext(cutFn(app, 'function paintThumb('), ctx);
  ctx.paintThumb({ id: 'p1', thumb: 'data:image/png;base64,AAAA', meta: {} });
}

test('★ 서류 카드에서는 미리보기를 위쪽 띠(.strip) «안»에 끼운다 — 칸을 덮지 않는다', () => {
  const cell = fakeCell(true);
  runPaint(cell);
  const strip = cell.querySelector('.strip');
  const img = cell.querySelector('img');
  assert.ok(img, '그림을 안 끼웠습니다');
  assert.equal(img.parent, strip,
    '★ 그림이 칸 맨 앞에 들어갔습니다 — 높이 100% 그림이 서류 제목·업체 글자를 통째로 덮습니다');
});

test('사진 칸(띠가 없는 칸)에는 예전처럼 칸 맨 앞에 끼운다', () => {
  const cell = fakeCell(false);
  runPaint(cell);
  assert.equal(cell.firstChild && cell.firstChild.tag, 'IMG');
});

test('★ 처음부터 그림을 알 때(renderGrid)와 나중에 끼울 때(paintThumb)가 같은 자리다', () => {
  /* renderGrid 가 서류 카드에 그림을 넣는 자리 — 띠 안 */
  assert.match(cutFn(app, 'function renderGrid('), /<span class="strip">' \+ img/,
    'renderGrid 의 서류 카드 그림 자리가 바뀌었습니다 — paintThumb 도 같이 맞춰야 합니다');
  assert.match(cutFn(app, 'function paintThumb('), /querySelector\('\.strip'\)/);
});

/* ══════ ② 크게 보기 윗줄 — 폰에서 한 줄 ══════ */
function viewerBar() {
  const m = app.match(/<div class="bar"><button class="vback"[\s\S]*?<\/div>/);
  assert.ok(m, '크게 보기 윗줄을 찾지 못했습니다');
  return m[0];
}

test('★ 폰에서 가운데 날짜는 줄을 바꾸지 않는다 — 넘치면 …로 준다', () => {
  const b = phoneBody(/#viewerInfo \.d$/);
  assert.match(b, /white-space:\s*nowrap/, '★ 날짜가 낱말 가운데서 두 줄로 꺾입니다');
  assert.match(b, /text-overflow:\s*ellipsis/);
});

test('★ 폰에서 곁 단추(복사·원본·닫기)는 글씨를 접고 그림만 남긴다 — 단추 자체는 남는다', () => {
  const bar = viewerBar();
  const side = (bar.match(/<button[^>]*>/g) || []).filter(t => !/class="vback"/.test(t));
  assert.ok(side.length >= 2, '곁 단추를 찾지 못했습니다');
  side.forEach(t => {
    /* 글씨를 접으면 화면 읽기·길게 누르기에 이름이 남아야 한다 */
    assert.match(t, /aria-label="[^"]+"/, '★ 글씨를 접는 단추에 이름(aria-label)이 없습니다: ' + t.slice(0, 60));
    const id = (t.match(/id="([^"]+)"/) || [])[1];
    const cls = (t.match(/class="([^"]+)"/) || [])[1];
    const key = id ? '#' + id : '\\.' + cls.split(/\s+/)[0];
    assert.match(phoneBody(new RegExp(key + '$')), /font-size:\s*0/, key + ' 글씨가 폰에서 안 접힙니다');
    assert.match(phoneBody(new RegExp(key + '::before$')), /content:\s*'[^']+'/, key + ' 접은 자리에 그림이 없습니다');
  });
});

test('★ 「← 돌아가기」는 폰에서도 글씨째 둔다(대표 지시 2026-08-13 「백 버튼이 있으면 좋겠다」)', () => {
  const b = phoneBody(/\.vback$/);
  assert.equal(/font-size:\s*0/.test(b), false, '★ 돌아가기 글씨를 접었습니다 — 길을 모르는 사람이 못 나옵니다');
  assert.match(viewerBar(), /class="vback"[^>]*>← 돌아가기</);
});

/* ══════ ③ 작은 단추 — 보이는 크기는 그대로, 누르는 자리만 넓게 ══════ */
test('★ 폰에서 「이 날 전부 고르기」·「고른 것 풀기」는 누르는 자리를 둘레로 넓힌다', () => {
  ['\\.dayck', '#gridCount \\.x'].forEach(sel => {
    const b = phoneBody(new RegExp(sel + '::after$'));
    assert.match(b, /position:\s*absolute/, sel + ' 누르는 자리를 넓히는 덮개가 없습니다');
    assert.match(b, /inset:\s*-\d/, sel + ' 덮개가 단추보다 넓지 않습니다');
    assert.match(phoneBody(new RegExp(sel + '$')), /position:\s*relative/, sel + ' 덮개가 단추 기준으로 서지 않습니다');
  });
});
