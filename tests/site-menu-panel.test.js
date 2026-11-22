'use strict';
/* 홈페이지 펼침 메뉴 판 높이 · 공지 작성자 (대표 지시 2026-11-22)

   ★ 왜 이 검사가 있나
     ① 테마가 흰 판을 «345px(헤더 80 + 5행)»로 박아 두었다. 주요업무가 여섯 행이 되자 맨 아래 「AI 인사노무 시스템」이
        판 밖(사진 위)에 걸렸는데, 아무도 몰랐다 — 행을 더할 때 판 높이를 같이 늘려야 한다는 것이 어디에도 안 적혀 있었다.
        → 판 높이를 «행 수 × 행 높이»로 계산하게 했고, 이 검사가 «메뉴에 행이 더 늘었는데 숫자를 안 올린 것»을 잡는다.
     ② 공지 목록·상세의 작성자에 옛 사이트의 회원 아이디(wp)가 그대로 보였다. 새 공지는 앞 글 줄을 복제해 만드니
        한 줄이 틀리면 앞으로도 계속 틀린다 — 사람이 읽는 이름(한글)이어야 한다.

   ★ 무엇을 지키나 — 지금 px 값이 아니라 규칙이다
     ① 가장 긴 펼침 메뉴의 행 수 ≤ --pu-rows (모든 쪽에서)
     ② 판 높이와 메뉴 높이는 --pu-rows 로 계산한다(숫자를 다시 박지 않는다)
     ③ 메뉴가 있는 모든 쪽이 pu-site.css 를 싣는다
     ④ 공지 작성자는 한글 이름이다

   실행: node --test tests/site-menu-panel.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SITE = path.join(__dirname, '..', 'site');
const 읽기 = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function 쪽들() {
  const out = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== '.git' && e.name !== 'files') walk(p); }
      else if (e.name === 'index.html' || e.name === '404.html') out.push(p);
    });
  })(SITE);
  return out;
}

/* 위쪽 메뉴(<nav class="main_menu">) 갈래마다 «펼침 한 단»의 행 수 — 안쪽 단(접힌 하위 메뉴)은 세지 않는다 */
function 메뉴행수(html) {
  const a = html.indexOf('<nav class="main_menu');
  if (a < 0) return null;
  const b = html.indexOf('</nav>', a);
  const 조각 = html.slice(a, b);
  const 갈래 = [];
  let ul = 0;
  const re = /<ul[^>]*>|<\/ul>|<li[\s>]/g;
  let m;
  while ((m = re.exec(조각))) {
    if (m[0].startsWith('<ul')) ul++;
    else if (m[0] === '</ul>') ul--;
    else if (ul === 1) 갈래.push(0);          // 위쪽 메뉴 한 칸(법인소개·주요업무…)
    else if (ul === 2 && 갈래.length) 갈래[갈래.length - 1]++;   // 그 칸의 펼침 한 줄
  }
  return 갈래;
}

const CSS = 읽기(path.join(SITE, 'assets', 'css', 'pu-site.css'));

test('① 가장 긴 펼침 메뉴의 행 수가 --pu-rows 안에 든다 — 모든 쪽에서 (판 밖으로 안 나간다)', () => {
  const m = /--pu-rows\s*:\s*(\d+)/.exec(CSS);
  assert.ok(m, 'pu-site.css 에 --pu-rows 가 없습니다 — 판 높이를 행 수로 계산하는 규칙이 사라졌습니다.');
  const 한도 = Number(m[1]);
  let 본쪽 = 0;
  쪽들().forEach((f) => {
    const rows = 메뉴행수(읽기(f));
    if (!rows) return;
    본쪽++;
    const 최대 = Math.max.apply(null, rows);
    assert.ok(최대 <= 한도,
      path.relative(SITE, f) + ' — 펼침 메뉴 ' + 최대 + '행인데 판은 ' + 한도 + '행까지입니다. '
      + 'pu-site.css 의 --pu-rows 를 ' + 최대 + ' 이상으로 올리십시오(안 올리면 맨 아래 항목이 흰 판 밖으로 나갑니다).');
  });
  assert.ok(본쪽 >= 2, '메뉴가 있는 쪽을 못 찾았습니다 — 검사가 아무것도 안 본 채 통과하면 안 됩니다.');
});

test('② 판 높이·메뉴 높이는 --pu-rows 로 계산한다 — 숫자를 다시 박지 않는다', () => {
  const 판 = /\.bh \.header_wrap\.menu-open::before\s*\{([^}]*)\}/.exec(CSS);
  const 칸 = /\.bh \.header_wrap \.main_menu \.menu_dropdown-content\s*\{([^}]*)\}/.exec(CSS);
  assert.ok(판 && /height\s*:\s*calc\([^;]*var\(--pu-rows\)/.test(판[1]), '흰 판(.menu-open::before) 높이가 --pu-rows 로 계산되지 않습니다.');
  assert.ok(칸 && /height\s*:\s*calc\([^;]*var\(--pu-rows\)/.test(칸[1]), '펼침 칸(.menu_dropdown-content) 높이가 --pu-rows 로 계산되지 않습니다.');
});

test('③ 메뉴가 있는 모든 쪽이 pu-site.css 를 싣는다 — 안 실으면 테마의 345px 판으로 돌아간다', () => {
  쪽들().forEach((f) => {
    const html = 읽기(f);
    if (!/<nav class="main_menu/.test(html)) return;
    assert.ok(/assets\/css\/pu-site\.css/.test(html), path.relative(SITE, f) + ' — pu-site.css 를 안 싣습니다.');
  });
});

test('④ 공지 작성자는 사람이 읽는 이름(한글)이다 — 옛 사이트 회원 아이디(wp)가 보이면 안 된다', () => {
  const 목록 = 읽기(path.join(SITE, 'notice', 'index.html'));
  const 칸 = [];
  const re = /<td class="author">\s*(?:<a[^>]*>)?([^<]*)/g;
  let m;
  while ((m = re.exec(목록))) 칸.push(m[1].trim());
  assert.ok(칸.length >= 1, '공지 목록에서 작성자 칸을 못 찾았습니다.');
  칸.forEach((이름) => assert.ok(/[가-힣]/.test(이름), '공지 목록의 작성자 「' + 이름 + '」 — 한글 이름이 아닙니다.'));

  const 글들 = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name === 'index.html' && d !== path.join(SITE, 'notice')) 글들.push(p);
    });
  })(path.join(SITE, 'notice'));
  assert.ok(글들.length >= 1, '공지 글 쪽을 못 찾았습니다.');
  글들.forEach((f) => {
    const t = /class="member_\d+"[^>]*>([^<]*)</.exec(읽기(f));
    assert.ok(t, path.relative(SITE, f) + ' — 작성자를 못 찾았습니다.');
    assert.ok(/[가-힣]/.test(t[1]), path.relative(SITE, f) + ' — 작성자 「' + t[1] + '」 — 한글 이름이 아닙니다.');
  });
});
