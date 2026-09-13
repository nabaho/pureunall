'use strict';
/* 환경설정 — 한 화면에 들어오게 «좌우»로 나눈다.
   실행: node --test tests/*.test.js

   대표 지시 2026-09-13
     ①「콤팩트하게 한 화면에 모두 정렬되게 해라. 아래로 안 나오게, 좌우로 배치해도 된다」
       → 시스템 › 데이터 관리
     ②「권한·정책도 좌우로 화면 나누어서 정리해라. 한 줄씩 안 해도 된다」
       → 권한·정책

   ── 무엇이 문제였나 (1,600px 화면 실측) ───────────────────────────────
   데이터 관리: 네 덩어리를 세로로만 쌓아 983px. 도구줄·탭을 뺀 남는 높이는 약 620px 이라
     콜드 스토리지가 두 번 스크롤해야 보였다.
   권한·정책: 설정 한 칸이 이름표 150px + 체크상자뿐인데 줄 하나를 통째로 써서,
     오른쪽 1,100px 넘게가 내내 빈 채로 여덟 줄이 내려갔다. 473px.

   ── 고친 뒤 (같은 CSS·같은 내용으로 다시 재었다) ──────────────────────
   데이터 관리 983px → 475px · 권한·정책 473px → 268px. 둘 다 620px 안에 든다.

   ── 이 검사가 못 박는 것 ──────────────────────────────────────────
     ① 좌우로 가르는 규칙이 있고, 칸 수가 «코드에 손으로» 박혀 있지 않다
     ② 좁은 화면에서는 한 칸으로 되돌아온다 (노트북·태블릿에서 글자가 눌리면 안 된다)
     ③ 두 화면이 실제로 그 규칙을 쓴다
     ④ ★★ 접은 설명은 «지운 것이 아니다» — 한 줄로 줄인 자리에는 반드시 말풍선이 있다  */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const css = fs.readFileSync(path.join(R, 'css', 'pu-erp.css'), 'utf8').replace(/\r\n/g, '\n');
const bare = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');

/* ══════ ① 가르는 규칙 ══════ */

test('★★ 좌우로 가르는 규칙이 CSS 한 곳에 있다', () => {
  ['.set-2col', '.set-rows'].forEach(function(k){
    const m = css.match(new RegExp('\\' + k + '\\s*\\{[^}]*\\}'));
    assert.ok(m, '★★ ' + k + ' 규칙이 없습니다 — 화면이 도로 세로로 쌓입니다');
    assert.match(m[0], /display:\s*grid/, '★ ' + k + ' 이 격자가 아닙니다');
    assert.match(m[0], /grid-template-columns:[^;]*(fr|minmax)/,
      '★★ ' + k + ' 에 칸이 둘 이상이 아닙니다');
  });
});

test('★★ 칸 수를 코드에 손으로 박지 않았다 — 나누기는 CSS 한 곳이다', () => {
  /* 화면 코드가 제 손으로 gridTemplateColumns 를 적으면, 좁은 화면 규칙이 안 먹어
     노트북에서 두 칸이 눌린 채 굳는다. 나누는 판단은 CSS 한 곳에만 있어야 한다. */
  const DM = cutFn(src, 'function DataManagementSection()');
  assert.match(DM, /className:'set-2col'/,
    '★★ 데이터 관리가 좌우로 안 갈렸습니다');
  const 손으로 = (DM.match(/gridTemplateColumns:'1\.15fr/g) || []);
  assert.equal(손으로.length, 0,
    '★★ 화면 코드가 칸 너비를 직접 적었습니다 — 좁은 화면에서 되돌아오지 못합니다');
});

/* ══════ ② 좁은 화면에서는 한 칸 ══════ */

test('★★ 좁은 화면(노트북·태블릿)에서는 한 칸으로 되돌아온다', () => {
  /* ⚠ 이 파일에는 @media 블록이 여럿이다 — 첫 번째를 집으면 «남의 규칙»을 보고
       엉뚱하게 통과하거나 엉뚱하게 실패한다. .set-2col 을 담은 블록만 고른다. */
  const 블록들 = css.match(/@media[^{]*\{[\s\S]*?\n\}/g) || [];
  const m = 블록들
    .map(function(b){ return b.indexOf('.set-2col') >= 0 ? b.match(/max-width:\s*(\d+)px/) && [b, RegExp.$1, b] : null; })
    .filter(Boolean)[0];
  assert.ok(m, '★★ 좁은 화면 규칙이 없습니다 — 노트북에서 두 칸이 눌려 못 읽습니다');
  const 경계 = Number(m[1]);
  assert.ok(경계 >= 900 && 경계 <= 1400,
    '★ 되돌아오는 경계가 ' + 경계 + 'px 입니다 — 900~1400px 사이여야 합니다');
  assert.match(m[2], /\.set-2col/, '★★ 데이터 관리가 좁은 화면에서 안 되돌아옵니다');
  assert.match(m[2], /\.set-rows/, '★★ 권한·정책이 좁은 화면에서 안 되돌아옵니다');
  assert.match(m[2], /grid-template-columns:\s*1fr/, '★ 한 칸으로 돌아가야 합니다');
});

/* ══════ ③ 두 화면이 실제로 쓴다 ══════ */

test('★★ 권한·정책 여덟 줄이 «둘씩» 놓인다', () => {
  const at = bare.indexOf("title:'데이터 접근 정책'");
  assert.ok(at > 0, '데이터 접근 정책 칸을 못 찾았습니다');
  const 구역 = bare.slice(at, bare.indexOf('SecurityScope', at));
  assert.match(구역, /h\(PolicyGrid,\s*null,/,
    '★★ 설정 줄이 아직 한 줄에 하나씩입니다 — 오른쪽 1,100px 이 빈 채로 내려갑니다');
  const 줄수 = (구역.match(/h\(PolicyRow,\s*\{/g) || []).length;
  assert.ok(줄수 >= 8, '★ 설정 줄이 ' + 줄수 + '개뿐입니다 — 여덟 줄이 다 들어가야 합니다');
  /* PolicyGrid 가 CSS 를 쓰는지(제 손으로 칸을 적지 않는지) */
  const PG = cutFn(src, 'function PolicyGrid(props)');
  assert.match(PG, /className:'set-rows'/, '★★ PolicyGrid 가 CSS 규칙을 안 씁니다');
  assert.doesNotMatch(PG, /gridTemplateColumns/,
    '★★ PolicyGrid 가 칸 너비를 직접 적었습니다 — 좁은 화면에서 못 되돌아옵니다');
});

test('★★ 데이터 관리 — 넓은 칸에 마이그레이션, 좁은 칸에 나머지 셋', () => {
  const DM = cutFn(src, 'function DataManagementSection()');
  const at = DM.indexOf("className:'set-2col'");
  assert.ok(at > 0, '★★ 좌우 나누기가 없습니다');
  const 뒤 = DM.slice(at);
  const 마이 = 뒤.indexOf('마이그레이션');
  const 중복 = 뒤.indexOf('DuplicateCleanerSection');
  const 콜드 = 뒤.indexOf('콜드 스토리지');
  assert.ok(마이 > 0 && 중복 > 0 && 콜드 > 0, '★ 네 덩어리가 다 있어야 합니다');
  assert.ok(마이 < 중복 && 마이 < 콜드,
    '★★ 마이그레이션이 «먼저»(왼쪽 넓은 칸에) 와야 합니다 — 가장 크고 일하는 자리입니다');
  /* 덩어리가 두 번 그려지지 않았는가 — 좌우로 옮기다 원본을 안 지우면 두 벌이 된다 */
  assert.equal((DM.match(/10년치 과거 데이터 일괄 업로드/g) || []).length, 1,
    '★★ 마이그레이션이 두 번 그려집니다 — 옮기고 «옛 자리»를 안 지웠습니다');
  assert.equal((DM.match(/❄️ 콜드 스토리지/g) || []).length, 1,
    '★★ 콜드 스토리지가 두 번 그려집니다');
});

/* ══════ ④ ★★ 자르되 «감추지» 않는다 ══════ */

test('★★ 한 줄로 줄인 자리에는 반드시 말풍선이 있다 — 설명을 지운 것이 아니다', () => {
  const 규칙 = css.match(/\.set-1line\s*\{[^}]*\}/);
  assert.ok(규칙, '★★ .set-1line 규칙이 없습니다');
  assert.match(규칙[0], /text-overflow:\s*ellipsis/, '★ 잘린 줄도 모르게 됩니다');
  assert.match(규칙[0], /white-space:\s*nowrap/, '★ 줄바꿈을 안 막습니다');

  /* 화면에서 set-1line 을 붙인 자리마다 title 이 함께 있어야 한다.
     ⚠ 이것이 이 검사의 알맹이다 — 설명 다섯 줄을 한 줄로 접었으니,
        말풍선까지 없으면 그 내용은 «어디서도» 못 읽는다. */
  const 자리 = bare.match(/h\('div',\s*\{\s*className:'set-1line'[^]{0,400}?\}/g) || [];
  assert.ok(자리.length >= 3,
    '★ 접은 자리가 ' + 자리.length + '군데뿐입니다 (마이그레이션 안내·필드·콜드 안내 셋 이상)');
  자리.forEach(function(seg, i){
    assert.match(seg, /title:/,
      '★★ ' + (i + 1) + '번째 접은 설명에 말풍선이 없습니다 — 접은 내용을 읽을 길이 사라집니다');
  });
});

test('★ 단추·숫자는 하나도 안 줄였다', () => {
  const DM = cutFn(src, 'function DataManagementSection()');
  ['1단계', '2단계', '콜드 이전', '활성 아카이브', '활성 크기', '콜드 아카이브', '콜드 크기']
    .forEach(function(w){
      assert.ok(DM.indexOf(w) > 0, '★ 「' + w + '」가 사라졌습니다 — 줄인 것은 «설명»뿐이어야 합니다');
    });
});

/* ══════ ⑤ 고친 CSS 가 화면에 닿는가 ══════ */

test('CSS 를 고쳤으니 캐시 번호가 올라가 있다', () => {
  const m = src.match(/css\/pu-erp\.css\?v=(\d+)/);
  assert.ok(m, '스타일 캐시 번호가 없습니다');
  assert.ok(Number(m[1]) >= 7,   // 검사고정-허용: 이 변경이 들어간 판
    '★★ 캐시 번호를 안 올리면 브라우저가 «옛 스타일»을 써서 화면은 그대로 세로로 쌓입니다');
});
