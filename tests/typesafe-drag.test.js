'use strict';
/* 「팝업창 마우스로 이동가능하게 해줘」 (대표 지시 2026-09-23)
   ─────────────────────────────────────────────────────────────────────────
   TypeSafe 검토 창이 화면 한가운데 붙박이라, 가려진 것을 보려면 창을 닫아야 했다.

   ■ 왜 transform 인가
     이 창은 host 의 flex 가 가운데로 세워 준다. position/left/top 으로 옮기면
     그 가운데 세우기와 «싸운다» — 글이 길어지거나 창 크기가 바뀔 때마다 어긋난다.
     transform 은 「세워진 자리에서 얼마나 밀지」만 말하므로 그 위에 얹을 수 있다.

   ★ 못 박는 것 — 값이 아니라 규칙
     ① 머리줄을 잡으면 창이 «따라온다»
     ② 닫기 단추에서 시작한 것은 끌기가 아니다 (누르려다 흔들려도 안 닫히면 안 된다)
     ③ 옮긴 자리를 «기억한다» — 열 때마다 되돌아가면 옮긴 뜻이 없다
     ④ 그래도 «화면 밖으로는 못 나간다» — 나가면 영영 못 잡는다
     ⑤ 가운데 세우기와 싸우지 않는다 (position 을 건드리지 않는다) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripJs } = require('./strip-comments');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-typesafe.js'), 'utf8').replace(/\r\n/g, '\n');

/* 「끌기」 대목을 떠서 «실제로 끌어 본다» — 글자만 보는 검사는 기능을 꺼도 통과한다
   (이 저장소 「되풀이된 실수 ②」). 중괄호를 세어 뜬다. */
function 떠오기(시작글자) {
  const a = SRC.indexOf(시작글자);
  assert.ok(a > -1, '★★ 「' + 시작글자 + '」 를 못 찾았다');
  let i = SRC.indexOf('{', a), d = 0, j = i;
  do { if (SRC[j] === '{') d++; else if (SRC[j] === '}') d--; j++; } while (j < SRC.length && d > 0);
  return SRC.slice(a, j);
}

function 손잡이만들기() {
  const o = { style: {}, _on: {},
    addEventListener(k, fn){ (o._on[k] = o._on[k] || []).push(fn); },
    setPointerCapture(){}, releasePointerCapture(){},
    contains(x){ return x === o; },
    쏘기(k, e){ (o._on[k] || []).forEach(fn => fn(Object.assign({
      pointerId: 1, button: 0, preventDefault(){}, target: o }, e))); } };
  return o;
}

/* _dx·_dy·자리적용·끌기달기를 한 통에 담아 돌린다 */
function 끌기판() {
  const 상자 = { left: 320, top: 100, w: 560, h: 600 };
  const st = {};
  const box = { style: st, getBoundingClientRect(){
    const m = String(st.transform || '').match(/translate\((-?[\d.]+)px,(-?[\d.]+)px\)/);
    const dx = m ? +m[1] : 0, dy = m ? +m[2] : 0;
    return { left: 상자.left + dx, top: 상자.top + dy, width: 상자.w, height: 상자.h,
             right: 상자.left + 상자.w + dx, bottom: 상자.top + 상자.h + dy };
  } };
  const ctx = { box, host: { style: { display: 'flex' } }, console,
    w: { innerWidth: 1200, innerHeight: 800, addEventListener(){} },
    d: { documentElement: {} }, String, Math, Number };
  vm.createContext(ctx);
  vm.runInContext('var _dx = 0, _dy = 0;\n' + 떠오기('function 자리적용()')
    + '\n' + 떠오기('function 안으로당기기()') + '\n' + 떠오기('function 끌기달기('), ctx);
  const 손잡이 = 손잡이만들기(), 닫기 = 손잡이만들기();
  ctx.손잡이 = 손잡이; ctx.닫기 = 닫기;
  vm.runInContext('끌기달기(손잡이, 닫기);', ctx);
  return { ctx, 손잡이, 닫기, box, 상자 };
}

test('①★★ 머리줄을 잡으면 창이 «따라온다»', () => {
  const { 손잡이, box } = 끌기판();
  손잡이.쏘기('pointerdown', { clientX: 500, clientY: 200 });
  손잡이.쏘기('pointermove', { clientX: 560, clientY: 240 });
  assert.equal(box.style.transform, 'translate(60px,40px)',
    '★★ 60·40 만큼 끌었는데 창이 안 따라왔다 (지금: ' + (box.style.transform || '없음') + ')');

  /* 놓은 «뒤»에 움직이면 따라오면 안 된다 — 안 그러면 창이 마우스에 붙어 다닌다 */
  손잡이.쏘기('pointerup', { clientX: 560, clientY: 240 });
  손잡이.쏘기('pointermove', { clientX: 900, clientY: 700 });
  assert.equal(box.style.transform, 'translate(60px,40px)',
    '★★ 놓았는데도 따라온다 — 창이 마우스에 붙어 다닌다');

  /* 다시 잡으면 «그 자리에서» 이어서 끈다 — 0 부터 다시 세면 창이 튄다 */
  손잡이.쏘기('pointerdown', { clientX: 100, clientY: 100 });
  손잡이.쏘기('pointermove', { clientX: 110, clientY: 130 });
  assert.equal(box.style.transform, 'translate(70px,70px)',
    '★★ 다시 잡았더니 창이 튀었다 — 지난 자리에서 이어서 끌어야 한다');

  /* ⚠★ 끌기를 «창에 실제로 붙였는지»도 본다. 위 검사들은 끌기를 직접 불러서 쓰므로,
     만드는 자리(make)에서 안 붙여도 전부 초록이다 — 돌연변이를 돌려 보고서야 알았다.
     「잘 도는 부품」과 「그 부품이 달려 있는 것」은 다른 말이다. */
  const 만들기 = 떠오기('function make()');
  const 붙인곳 = 만들기.indexOf('끌기달기(');
  assert.ok(붙인곳 > -1,
    '★★ 끌기를 만들어 놓고 창에 «안 붙였다» — 부품은 멀쩡한데 창은 그대로 붙박이다');
  assert.match(만들기.slice(붙인곳, 붙인곳 + 40), /끌기달기\(\s*head\s*,/,
    '★★ 머리줄(head) 말고 다른 것에 붙였다 — 글 상자에 붙으면 글을 끌 때 창이 움직인다');

  const bare = stripJs(SRC);
  assert.match(bare, /cursor:move/, '★ 잡을 수 있는 자리라고 «보여» 주지 않는다');
  assert.match(bare, /touch-action:none/,
    '★ 손가락으로 끌면 화면이 함께 굴러간다 — 손잡이에서는 구르지 않게 막아야 한다');
  ['pointercancel'].forEach(ev => assert.ok(bare.indexOf(ev) > -1,
    '★ ' + ev + ' 을 안 들으면 끌다가 알림창이 뜨면 창이 붙어 버린다'));
});

test('②★★ 닫기 단추에서 시작한 것은 «끌기»가 아니다', () => {
  /* 누르려다 1px 흔들렸는데 창이 옮겨지고 안 닫히면 안 된다 */
  const { 손잡이, 닫기, box } = 끌기판();
  손잡이.쏘기('pointerdown', { clientX: 500, clientY: 200, target: 닫기 });
  손잡이.쏘기('pointermove', { clientX: 540, clientY: 260 });
  assert.ok(!box.style.transform,
    '★★ 닫기 단추를 누른 채 흔들었더니 창이 옮겨졌다 (' + box.style.transform + ')');
});

test('③★★ 옮긴 자리를 «기억한다» — 열 때마다 가운데로 돌아가면 옮긴 뜻이 없다', () => {
  const i = SRC.indexOf('function openDialog(');
  const 조각 = stripJs(SRC.slice(i, SRC.indexOf('\n  }', i)));
  assert.doesNotMatch(조각, /_dx\s*=\s*0|_dy\s*=\s*0/,
    '★★ 열 때 자리를 0 으로 되돌린다 — 가린 것을 보려고 옮긴 사람이 열 때마다 또 옮겨야 한다');
  assert.match(조각, /자리적용\(\)/, '★ 기억한 자리를 다시 안 씌운다');
  assert.match(조각, /안으로당기기\(\)/,
    '★★ 열 때 화면 안으로 안 당긴다 — 작은 화면으로 옮겨 가면 창이 밖에 있다');
});

test('④★★ 화면 밖으로는 못 나간다 — 나가면 영영 못 잡는다', () => {
  /* 「안으로당기기」를 떠서 실제로 돌린다. 잣대가 «지금 자리»인지도 함께 본다. */
  const a = SRC.indexOf('function 안으로당기기()');
  let j = SRC.indexOf('{', a), d = 0, k = j;
  do { if (SRC[k] === '{') d++; else if (SRC[k] === '}') d--; k++; } while (k < SRC.length && d > 0);
  const 본문 = SRC.slice(a, k);

  function 돌려보기(시작dx, 시작dy, 상자) {
    const st = {};
    const box = { style: st, getBoundingClientRect(){
      const m = String(st.transform || '').match(/translate\((-?[\d.]+)px,(-?[\d.]+)px\)/);
      const dx = m ? +m[1] : 상자.dx0, dy = m ? +m[2] : 상자.dy0;
      return { left: 상자.left + dx, top: 상자.top + dy, width: 상자.w, height: 상자.h,
               right: 상자.left + 상자.w + dx, bottom: 상자.top + 상자.h + dy };
    } };
    const ctx = { box, host: { style: { display: 'flex' } }, _dx: 시작dx, _dy: 시작dy,
      w: { innerWidth: 1200, innerHeight: 800 }, d: { documentElement: {} },
      자리적용: function(){ ctx.box.style.transform = 'translate(' + ctx._dx + 'px,' + ctx._dy + 'px)'; },
      console };
    vm.createContext(ctx);
    /* ⚠ 실제 흐름은 «끄는 동안 자리적용 → 놓을 때 안으로당기기» 다.
       자리를 안 씌우고 당기면 상자 자리가 옮기기 «전» 값이라, 당길 것이 없다고 나온다.
       이 대역을 처음에 그렇게 짰다가 「안 당겨진다」는 거짓 실패를 봤다. */
    vm.runInContext('자리적용();\n' + 본문 + '\n안으로당기기();', ctx);
    return { dx: ctx._dx, dy: ctx._dy, r: box.getBoundingClientRect() };
  }
  const 상자 = { left: 320, top: 100, w: 560, h: 600, dx0: 0, dy0: 0 };

  const 왼쪽밖 = 돌려보기(-900, 0, 상자);
  assert.ok(왼쪽밖.r.left >= 0, '★★ 왼쪽으로 끌어 화면 밖으로 나갔다 (left=' + 왼쪽밖.r.left + ')');
  const 오른쪽밖 = 돌려보기(900, 0, 상자);
  assert.ok(오른쪽밖.r.right <= 1200, '★★ 오른쪽으로 나갔다 (right=' + 오른쪽밖.r.right + ')');
  const 아래밖 = 돌려보기(0, 900, 상자);
  assert.ok(아래밖.r.top < 800,
    '★★ 아래로 끌어 «머리줄»이 화면 밖으로 나갔다 — 머리줄을 못 잡으면 다시 못 옮긴다');
  const 위밖 = 돌려보기(0, -900, 상자);
  assert.ok(위밖.r.top >= 0, '★★ 위로 나갔다 (top=' + 위밖.r.top + ')');

  const 가운데 = 돌려보기(30, 30, 상자);
  assert.equal(가운데.dx, 30, '★ 화면 안에 잘 있는데 괜히 끌어당겼다');
  assert.equal(가운데.dy, 30, '★ 〃');
});

test('⑤★★ 가운데 세우기와 싸우지 않는다 — position 을 건드리지 않는다', () => {
  const bare = stripJs(SRC);
  const i = bare.indexOf('function 끌기달기(');
  const j = bare.indexOf('function 안으로당기기()');
  const 끌기 = bare.slice(Math.min(i, j), Math.max(i, j) + 1400);
  assert.doesNotMatch(끌기, /box\.style\.(position|left|top)\s*=/,
    '★★ position/left/top 으로 옮긴다 — host 의 flex 가운데 세우기와 싸워,\n' +
    '  글이 길어지거나 창 크기가 바뀔 때마다 자리가 어긋난다. transform 으로 얹어라.');
  assert.match(bare, /box\.style\.transform\s*=/, '★ transform 으로 옮기지 않는다');
});

test('⑥ 공용 파일을 고쳤으면 캐시 번호가 올라가 있다', () => {
  const enter = fs.readFileSync(path.join(__dirname, '..', 'enter.html'), 'utf8');
  const m = enter.match(/<script[^>]*src="js\/pu-typesafe\.js\?v=(\d+)"/);
  assert.ok(m, '★★ 캐시 번호 없이 싣는다 — 고쳐도 옛 파일이 그대로 쓰인다');
  assert.ok(Number(m[1]) >= 6,
    '★★ 끌기를 넣었는데 캐시 번호(' + m[1] + ')가 그대로다 — 대표님 화면엔 옛 파일이 뜬다');
});
