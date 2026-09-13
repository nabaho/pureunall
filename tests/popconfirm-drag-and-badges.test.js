'use strict';
/* 물음창(popConfirm)이 «가려지지» 않게, 그리고 «옮길 수» 있게
   (대표 제보 2026-09-13 「팝업창에 글자가 안보인다 … 마우스로 움직일 수 있게 해야된다」)

   ■ 무엇이 있었나
     계약 추가에서 「⚠️ 중복 의심 1건 발견: · 계약-2026-031 (주)○○○ (점수 …)」을 물었는데,
     뒷글자가 「새 버전 있음 · 누르기」 딱지에 덮여 무엇과 겹쳤는지 읽을 수가 없었다.
     물음창은 z-index 10만이고 떠다니는 딱지들은 21억대다 — 늘 딱지가 이긴다.
     ★ 창을 더 올려서 푸는 문제가 «아니다» — 2147483647 이 한계값이라 이미 꼭대기다.
       그래서 사진첩이 카메라에서 쓰던 방법을 쓴다: 묻는 동안만 딱지를 감춘다.

   ■ 이 검사가 지키는 것
     ① 묻는 동안 딱지를 감추고, 닫으면 되돌린다
     ② ★★ 감추는 목록에 «빠진 딱지»가 없다 — 새 딱지를 만들면 여기도 함께 고쳐야 한다
     ③ 끌어서 옮길 수 있고, 화면 밖으로는 못 나간다 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
/* ⚠ cutFn 의 첫 줄에는 여는 중괄호를 붙이지 않는다 — 붙이면 다섯 줄만 잘라 온다.
   (그 상태로도 «글자 찾기»는 통과해 버려서, 검사가 아무것도 안 지키게 된다) */
const 물음창 = cutFn(SRC, 'window.popConfirm = function(msg, onYes, opts)');
assert.ok(물음창.length > 4000,
  '★ 물음창을 제대로 못 잘랐습니다(' + 물음창.length + '자) — 아래 검사가 헛돕니다');

test('① ★ 묻는 동안 딱지를 감추고, 닫으면 되돌린다', function () {
  assert.match(물음창, /classList\.add\('pe-ask-open'\)/,
    '★★ 물음창이 열려도 딱지를 안 감춥니다 — 글자가 덮입니다');
  assert.match(물음창, /classList\.remove\('pe-ask-open'\)/,
    '★★ 닫아도 딱지가 안 돌아옵니다 — 감추기가 «지우기»가 됩니다');
  /* ⚠ 물음이 겹쳐 뜬 자리에서 앞엣것이 닫혔다고 돌려놓으면 뒤엣것을 또 가린다 */
  assert.match(물음창, /querySelector\('\.pe-popconfirm'\)[\s\S]{0,80}classList\.remove\('pe-ask-open'\)/,
    '★ 남은 물음창이 있는지 안 보고 되돌립니다 — 겹쳐 뜬 자리에서 다시 가려집니다');
  assert.match(물음창, /body\.pe-ask-open[^{]*\{display:none!important\}/,
    '★★ 감추는 규칙이 없습니다 — 글자만 붙여 놓고 아무 일도 안 합니다');
});

test('② ★★ 감추는 목록에 빠진 딱지가 없다 — 새 딱지를 만들면 여기도 고쳐야 한다', function () {
  /* 물음창이 몇 층인가 */
  const z = /zIndex:'(\d+)'/.exec(물음창);
  assert.ok(z, '★ 물음창의 층(z-index)을 못 찾았습니다');
  const 물음창층 = parseInt(z[1], 10);

  /* 감추기로 적어 둔 이름들 */
  const 감추는것 = (물음창.match(/body\.pe-ask-open #([\w-]+)/g) || [])
    .map(function (s) { return s.replace(/.*#/, ''); });
  assert.ok(감추는것.length > 0, '★ 감추는 목록이 비었습니다');

  /* js/ 안에서 «떠다니는» 딱지를 모두 찾는다 — 물음창보다 높고, 화면 전체 덮개가 아닌 것.
     ⚠ 덮개(inset:0)는 제 나름의 큰 창이라 감추면 «안» 된다 — 가리는 것이 일이다. */
  const 빠진것 = [];
  fs.readdirSync(path.join(R, 'js')).filter(function (f) { return /\.js$/.test(f); })
    .forEach(function (f) {
      const t = fs.readFileSync(path.join(R, 'js', f), 'utf8');
      const re = /z-index:\s*(\d+)/g;
      let m;
      while ((m = re.exec(t))) {
        if (parseInt(m[1], 10) <= 물음창층) continue;
        const 둘레 = t.slice(Math.max(0, m.index - 900), m.index + 400);
        if (!/position:\s*fixed/.test(둘레)) continue;
        if (/inset:\s*0/.test(둘레)) continue;           // 화면 전체 덮개는 건너뛴다
        const ids = 둘레.match(/\.id\s*=\s*'([\w-]+)'|var id\s*=\s*'([\w-]+)'/g) || [];
        ids.forEach(function (raw) {
          const id = raw.replace(/.*'([\w-]+)'.*/, '$1');
          if (감추는것.indexOf(id) < 0 && 빠진것.indexOf(id) < 0) 빠진것.push(f + ' → #' + id);
        });
      }
    });

  assert.deepStrictEqual(빠진것, [],
    '★★ 물음창 위로 올라오는데 «감추는 목록에 없는» 딱지가 있습니다.\n' +
    '   이 딱지는 물음창 글자를 덮습니다. pu-erp.html 의 body.pe-ask-open 목록에 더하세요:\n' +
    '   ' + 빠진것.join('\n   '));
});

test('③ ★★ 끌어서 옮길 수 있다 — 그리고 화면 밖으로는 못 나간다', function () {
  assert.match(물음창, /cursor:'move'/,
    '★★ 끌 수 있다는 표시가 없습니다 — 있어도 아무도 모릅니다');
  assert.match(물음창, /addEventListener\('pointerdown'/, '★★ 끌기 시작을 안 받습니다');
  assert.match(물음창, /addEventListener\('pointermove'/, '★★ 따라 움직이지 않습니다');
  assert.match(물음창, /addEventListener\('pointerup'/, '★ 손을 떼도 안 멈춥니다');
  /* 움직이는 줄이 «실제로» 자리를 바꾸는가 — 글자만 있고 일을 안 하면 소용없다 */
  assert.match(물음창, /box\.style\.left\s*=\s*nx \+ 'px'/, '★★ 끌어도 가로 자리가 안 바뀝니다');
  assert.match(물음창, /box\.style\.top\s*=\s*ny \+ 'px'/, '★★ 끌어도 세로 자리가 안 바뀝니다');
  /* ⚠ 밖으로 나가면 취소·확인을 누를 수가 없다 */
  assert.match(물음창, /Math\.max\([^)]*Math\.min\([^)]*window\.innerWidth/,
    '★★ 가로로 화면 밖까지 끌려 나갑니다 — 단추를 못 누르게 됩니다');
  assert.match(물음창, /Math\.max\([^)]*Math\.min\([^)]*window\.innerHeight/,
    '★★ 세로로 화면 밖까지 끌려 나갑니다');
  /* ⚠ 단추 위에서 끌리면 «누르기»가 먹힌다 — 손잡이와 창 여백에서만 끈다 */
  assert.match(물음창, /if\(t !== box && t !== grip\) return;/,
    '★★ 단추·입력칸 위에서도 끌립니다 — 끌기가 누르기를 잡아먹습니다');
});
