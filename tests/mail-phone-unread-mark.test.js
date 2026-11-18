/* 폰 메일 목록 — 읽은 메일과 안 읽은 메일이 «한눈에» 갈린다
   대표 지적 2026-11-18: 「메일을 읽은 것과 안 읽은 거에 명확하게 좀 차이가 나는데
   현재는 색깔로는 잘 구분이 안 된다. 읽은 메일과 안 읽은 메일 구분되도록 좀 표시를 해달라.」

   ① 무슨 일이었나 — 어두운 차림에서 보낸이(--ink)와 제목(--sub)이 거의 같은 밝기였고,
      안 읽은 줄은 «글자 굵기 한 단계»만 달랐다. 폰의 작은 글씨로는 그 차이가 안 보였다.
   ② 고친 결 — 안 읽은 줄: 왼쪽 띠 + 바탕 + 굵고 밝은 글자 + 시각 강조.
      읽은 줄: 보낸이·제목을 낮춘 색(--rd)으로, 굵기를 뺀다.
   ⚠ 이 검사는 «색 값»을 박지 않는다 — 표시가 «있는가»와 «두 줄이 서로 다른 색 변수를 쓰는가»,
     «밝은 차림에도 같은 변수가 다시 정해져 있는가»를 본다. 색을 고쳐도 안 깨진다.
   실행: node --test tests/mail-phone-unread-mark.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '..', 'pu-cards.html'), 'utf8').replace(/\r\n/g, '\n');

/* 선택자 그대로의 규칙 덩어리(쉼표로 묶인 것 포함)를 모두 모아 온다 */
function 규칙들(선택자) {
  const esc = 선택자.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(?:^|[\\n,}])\\s*' + esc + '\\s*(?:,[^{]*)?\\{([^}]*)\\}', 'g');
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push(m[1].replace(/\s+/g, ''));
  return out.join(';');
}
function 변수(덩어리, 이름) {
  const m = new RegExp('--' + 이름 + ':([^;]+)').exec(덩어리);
  return m ? m[1].trim() : null;
}

test('★ 안 읽은 줄에는 «줄 전체» 표시(바탕·왼쪽 띠)가 있다 — 굵기 하나로는 폰에서 안 보인다', () => {
  const r = 규칙들('.dmm-row.unread');
  assert.ok(r, '.dmm-row.unread 규칙이 사라졌습니다 — 안 읽은 줄이 다시 굵기로만 갈립니다');
  assert.match(r, /background:/, '★ 안 읽은 줄의 바탕 표시가 없습니다');
  assert.match(r, /box-shadow:inset/,
    '★ 안 읽은 줄의 왼쪽 띠가 없습니다 (border 로 바꾸면 글자가 옆으로 밀려 열이 흔들립니다 — inset 그림자로 둡니다)');
});

test('보낸이·제목은 안 읽은 줄에서 굵고, 읽은 줄에서는 굵기를 뺀다', () => {
  assert.match(규칙들('.dmm-row.unread .dmm-l1 .who'), /font-weight:(700|bold)/, '안 읽은 보낸이가 굵지 않습니다');
  assert.match(규칙들('.dmm-row.unread .dmm-l2'), /font-weight:(700|bold)/, '안 읽은 제목이 굵지 않습니다');
  assert.match(규칙들('.dmm-row:not(.unread) .dmm-l1 .who'), /font-weight:(400|normal)/,
    '★ 읽은 보낸이도 굵습니다 — 두 줄이 다시 비슷해집니다');
});

test('★ 읽은 줄과 안 읽은 줄은 «서로 다른» 색 변수를 쓴다', () => {
  const 색 = (선택자) => {
    const m = /(?:^|;)color:var\(--([\w-]+)\)/.exec(규칙들(선택자));
    assert.ok(m, 선택자 + ' 의 글자색이 변수로 정해져 있지 않습니다');
    return m[1];
  };
  for (const 칸 of ['.dmm-l1 .who', '.dmm-l2']) {
    const 안읽음 = 색('.dmm-row.unread ' + 칸);
    const 읽음 = 색('.dmm-row:not(.unread) ' + 칸);
    assert.notEqual(안읽음, 읽음, '★ ' + 칸 + ' 이 읽음·안읽음에서 같은 색입니다 — 색으로 안 갈립니다');
  }
  assert.match(규칙들('.dmm-row.unread .dmm-l1 .at'), /color:var\(--/, '안 읽은 줄의 시각 강조가 없습니다');
});

test('★ 색 변수는 어두운·밝은 차림 «둘 다»에 정해져 있고, 두 줄의 색이 실제로 다르다', () => {
  const 어두움 = 규칙들('.dmm');
  const 밝음m = /@media\(prefers-color-scheme:light\)\{\s*\.dmm\{([^}]*)\}/.exec(src.replace(/\s*\{\s*/g, '{'));
  assert.ok(밝음m, '밝은 차림의 .dmm 변수 덩어리를 못 찾았습니다');
  const 밝음 = 밝음m[1].replace(/\s+/g, '');
  /* 안 읽은 줄·읽은 줄이 쓰는 변수 이름을 규칙에서 읽어 온다(이름을 박지 않는다) */
  const 이름 = (선택자) => (/(?:^|;)color:var\(--([\w-]+)\)/.exec(규칙들(선택자)) || [])[1];
  const 안읽음 = 이름('.dmm-row.unread .dmm-l2');
  const 읽음 = 이름('.dmm-row:not(.unread) .dmm-l2');
  for (const [차림, 덩어리] of [['어두운', 어두움], ['밝은', 밝음]]) {
    const a = 변수(덩어리, 안읽음), b = 변수(덩어리, 읽음);
    assert.ok(a && b, 차림 + ' 차림에 --' + 안읽음 + ' 또는 --' + 읽음 + ' 가 없습니다');
    assert.notEqual(a.toLowerCase(), b.toLowerCase(), '★ ' + 차림 + ' 차림에서 두 줄의 제목 색이 같습니다');
  }
});

test('고른 줄(.pick)의 표시가 안 읽은 줄 바탕에 덮이지 않는다', () => {
  /* .dmm-row.unread(바탕) 가 .dmm-row.pick 보다 뒤에 있어 같은 무게로 이긴다 — 따로 정해 둬야 한다 */
  assert.match(규칙들('.dmm-row.unread.pick'), /background:/,
    '★ 안 읽은 줄을 고르면 고른 표시가 사라집니다 — .dmm-row.unread.pick 의 바탕이 없습니다');
});
