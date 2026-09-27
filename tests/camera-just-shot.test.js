'use strict';
/* 푸른카메라 — 「방금 찍은 것」을 «그림»으로 보여 준다 (대표 지시 2026-09-12)
   실행: node --test tests/camera-just-shot.test.js

   「카메라 찍은 거 찍은 것만 확인할 수 있게 별도로 … 자유롭게 활용하고 싶다」
   목업 docs/mockups/camera-just-shot.html · 대표 승인 「가」

   ■ 무엇이 모자랐나
   찍은 뒤 어디로 갔는지 알려 주는 표(2026-08-08 「보낸 곳」)는 이미 있었다.
   그런데 **무엇을 찍었는지는 안 보였다** — 현장 사진 셋을 이어 찍으면 세 줄이
   똑같이 「회의·현장 사진」이라 어느 것이 어느 것인지, 흐리게 찍힌 것이 있는지
   알 길이 없었다.

   ■ ★ 「가는 곳」이 하나다 (2026-08-08 대표 결정 「카메라는 하나로」)
   2026-09-12 다시 겨눔 — 대표 지시로 푸른카메라가 «사진만 찍는» 제 앱이 되었다.
   촬영 코드는 두 곳이 됐지만, 2026-08-08 에 실제로 아팠던 것은 그것이 아니라
   **가는 곳이 달랐던 것**이다(옛 푸른카메라는 기업정보함 직행).
   그래서 못 박는 것은 「저장 층이 하나인가」다 — 어느 문으로 들어가도 같은 자리에 담긴다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');
const { stripComments, stripJs } = require('./strip-comments.js');

const R = path.join(__dirname, '..');
const APP = fs.readFileSync(path.join(R, 'pu-photos.html'), 'utf8');

/* ══════ ① 찍은 지 얼마나 됐나 ═══════════════════════════════════════════ */

function 때상자() {
  const ctx = { Number, Math, Date, String };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(cutFn(APP, 'function shotAgo('), ctx);
  return ctx;
}
const 분 = 60000;

test('★ 언제 찍었는지 적는다 — 여러 장 찍으면 «차례»가 유일한 실마리다', () => {
  const c = 때상자();
  c.__now = Date.now();
  assert.equal(vm.runInContext('shotAgo(__now)', c), '방금');
  assert.equal(vm.runInContext('shotAgo(__now - 3 * 60000)', c), '3분 전');
  assert.equal(vm.runInContext('shotAgo(__now - 90 * 60000)', c), '1시간 전');
  assert.equal(vm.runInContext('shotAgo(__now - 50 * 60 * 60000)', c), '2일 전');
});

test('★★ 시각을 모르면 «아무 말도 안 한다» — 1970년이라고 적느니 안 적는다', () => {
  const c = 때상자();
  [0, null, undefined, '', 'abc', NaN].forEach(function (v) {
    c.__v = v;
    assert.equal(vm.runInContext('shotAgo(__v)', c), '',
      '★★ 못 믿을 시각을 그대로 적으면 「1970년 1월」 같은 말이 화면에 뜹니다: ' + String(v));
  });
});

test('앞날로 찍힌 것(시계가 어긋난 기기)도 «방금»으로 둔다 — 음수를 적지 않는다', () => {
  const c = 때상자();
  c.__next = Date.now() + 10 * 분;
  assert.equal(vm.runInContext('shotAgo(__next)', c), '방금');
});

/* ══════ ② 줄에 «그 사진»이 붙는가 ═══════════════════════════════════════ */

function 표그리기(jobs, o) {
  o = o || {};
  const el = {};
  const mk = function (id) {
    return (el[id] = el[id] || { id: id, style: { display: o.camOpen === false ? 'none' : 'flex' },
      innerHTML: '' });
  };
  const ctx = {
    Object, Array, String, Number, Math, Date,
    $: mk,
    upJobs: jobs,
    SHIP_MAX: 5,
    esc: function (s) { return String(s); },
    /* ⚠ safeSrc 는 **원본 그대로** 싣는다 — 주소를 거르는 문지기라 대역을 만들면
       「막았다고 믿는데 실제로는 새는」 것을 못 본다. */
    shipRowOf: function (j) {
      return j.__row || { ic: '📷', tx: '회의·현장 사진', to: '사진첩에 보관', cls: '' };
    },
    closeCam: function () { }
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    /* ⚠ safeSrc 가 보는 창고 주소 — **원본 그대로** 싣는다(대역을 만들면 문지기가
       무엇을 통과시키는지 화면과 달라진다) */
    APP.match(/^const THUMB_HOST = '[^']*';/m)[0].replace('const ', 'var '),
    cutFn(APP, 'function safeSrc('),
    cutFn(APP, 'function shotAgo('),
    cutFn(APP, 'function renderShip(')
  ].join('\n'), ctx);
  /* 카메라 덮개가 열려 있어야 그린다 */
  mk('camOv').style.display = o.camOpen === false ? 'none' : 'flex';
  vm.runInContext('renderShip()', ctx);
  return { html: mk('camShip').innerHTML, box: mk('camShip') };
}
const 찍은것 = function (n, extra) {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(Object.assign({ id: 'p' + i, _fromCam: true,
      thumb: 'data:image/jpeg;base64,QUJD', takenAt: Date.now() - i * 분 }, extra || {}));
  }
  return out;
};

test('★★★ 줄 앞에 «그 사진»이 붙는다 — 갈래 이름만으로는 셋이 똑같아 보인다', () => {
  const r = 표그리기(찍은것(3));
  assert.equal((r.html.match(/class="th"/g) || []).length, 3,
    '★★★ 그림이 없으면 현장 사진 셋이 전부 「회의·현장 사진」 한 말로 보입니다 —\n' +
    '  어느 것이 어느 것인지, 흐리게 찍힌 것이 있는지 알 수가 없습니다.');
  assert.match(r.html, /data:image\/jpeg;base64,QUJD/, '★ 찍은 사진이 아니라 빈 칸을 그립니다');
});

test('★★ 그림을 누르면 그 사진이 열린다 — 보기만 하고 끝나면 잘못 찍힌 것을 못 지운다', () => {
  const r = 표그리기(찍은것(1));
  assert.match(r.html, /class="th"[^>]*onclick="shipOpen\('p0'\)"/,
    '★★ 누를 수 없으면 흐리게 찍힌 것을 보고도 아무것도 못 합니다');
});

test('★★ 미리보기가 아직 없으면 «옛 아이콘»으로 물러선다 — 빈 칸을 그리지 않는다', () => {
  const r = 표그리기(찍은것(1, { thumb: '' }));
  assert.ok(!/class="th"/.test(r.html), '미리보기가 없는데 그림 칸을 그립니다');
  assert.match(r.html, /class="ic"/,
    '★★ 아무것도 안 그리면 줄이 어긋나 보이고 「사진이 안 찍혔나」로 읽힙니다');
});

test('★★★ 위험한 주소는 «그리지 않는다» — 문지기(safeSrc)를 지난다', () => {
  const r = 표그리기(찍은것(1, { thumb: 'javascript:alert(1)' }));
  assert.ok(!/javascript:/.test(r.html),
    '★★★ 거르지 않은 주소를 그림에 꽂고 있습니다');
  assert.match(r.html, /class="ic"/, '막았으면 옛 아이콘으로 물러서야 합니다');
});

test('★ 언제 찍었는지가 줄에 적힌다', () => {
  const r = 표그리기(찍은것(2));
  assert.match(r.html, /방금 · 회의·현장 사진/);
  assert.match(r.html, /1분 전 · 회의·현장 사진/);
});

/* ══════ ③ 제목과 «어디로 갔나»는 그대로 ═══════════════════════════════ */

test('★★ 제목이 「방금 찍은 것」이다 — 「보낸 곳」은 결과만 말한다', () => {
  const r = 표그리기(찍은것(1));
  assert.match(r.html, /방금 찍은 것/,
    '★★ 대표께서 찾으신 것은 «내가 무엇을 찍었나»입니다(대표 지시 2026-09-12)');
});

test('★★★ 어디로 갔는지는 «그대로» 남는다 — 그림을 붙이려고 그것을 뺏으면 안 된다', () => {
  const r = 표그리기(찍은것(1));
  assert.match(r.html, /사진첩에 보관/,
    '★★★ 「알아서 보낸다」는 느낌이 나는 까닭이 바로 이 줄입니다(2026-08-08)');
  assert.match(r.html, /끝내기 1장/, '★ 끝내는 길이 사라지면 카메라에서 못 나옵니다');
});

test('★ 확인이 필요한 줄은 「보기」 단추를 그대로 낸다', () => {
  const r = 표그리기(찍은것(1, { __row: { ic: '⚠', tx: '확인이 필요합니다',
    to: '확인 필요', cls: 'warn', btn: '보기', act: 'shipOpen' } }));
  assert.match(r.html, /class="shrow warn"/);
  assert.match(r.html, /보기<\/button>/, '★ 못 간 것을 조용히 넘기면 아무도 모릅니다');
});

test('카메라를 닫았으면 안 그린다 · 찍은 것이 없어도 안 그린다', () => {
  assert.equal(표그리기(찍은것(2), { camOpen: false }).box.style.display, 'none');
  assert.equal(표그리기([]).box.style.display, 'none');
});

test('★ 이번에 카메라를 켠 뒤 올린 것«만» — 아까 올린 것이 섞이면 헷갈린다', () => {
  const 섞임 = 찍은것(1).concat([{ id: 'old', thumb: 'data:image/jpeg;base64,WA==' }]);
  const r = 표그리기(섞임);
  assert.equal((r.html.match(/class="th"/g) || []).length, 1,
    '★ 카메라로 찍지 않은 것이 「방금 찍은 것」에 들어갔습니다');
});

/* ══════ ④ 문은 둘이라도 «담기는 자리»는 하나다 ═══════════════════════════ */

test('★★★ 푸른카메라도 «같은 저장 층»으로 담는다 — 가는 곳이 갈리지 않는다', () => {
  const cam = stripComments(fs.readFileSync(path.join(R, 'pu-camera.html'), 'utf8'));
  assert.ok(!/\bdb\.ref\s*\(|\bstorage\.ref\s*\(/.test(cam),
    '★★★ 푸른카메라가 제 저장 길을 갖기 시작하면, 2026-08-08 에 없앤 문제가 돌아옵니다 —\n' +
    '  같은 사진이 «어느 카메라로 찍었느냐»에 따라 다른 곳으로 갑니다.');
  assert.match(cam, /PuPhotoStore\.savePhoto\(/,
    '★★★ 공용 저장 층을 안 지나면 이 「방금 찍은 것」 줄과 사진첩이 서로 다른 것을 보게 됩니다.');
  assert.match(cam, /mode !== 'card' && mode !== 'document'/,
    '★ 명함·서류는 사진첩 카메라가 맡습니다 — 판독·가림·검토가 그쪽에만 있습니다.');
});

test('★★ 앱 설명이 «지금 하는 일»을 말한다 — 어긋난 안내는 없는 것보다 나쁘다', () => {
  const mf = JSON.parse(fs.readFileSync(path.join(R, 'pu-camera-manifest.json'), 'utf8'));
  assert.ok(!/기업정보함/.test(mf.description),
    '★★ 2026-08-08 에 없어진 동작입니다 — 폰 홈 화면에 그 말이 그대로 남아 있었습니다.\n' +
    '  그 말을 믿으면 「명함을 찍었는데 기업정보함에 없다」고 고장을 찾게 됩니다.');
  assert.match(mf.description, /사진첩/, '★ 지금 어디로 가는지는 적어야 합니다');
  assert.equal(mf.name, '푸른카메라',
    '★★ 이름이 바뀌면 폰 홈 화면에서 아이콘을 못 찾습니다(설치해 둔 분들이 있습니다)');
  assert.equal(mf.start_url, './pu-camera.html',
    '★★ 시작 주소가 바뀌면 깔아 둔 아이콘이 깨집니다');
});
