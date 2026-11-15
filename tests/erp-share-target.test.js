'use strict';
/* 이알피 폰 «공유 → 푸른이알피» — 통합 일꾼(pu-sw.js)이 받아 사진첩 받은 함에 넣는다 (2026-11-15)

   ■ 무엇이 바뀌었나
   대표 지시 2026-09-17 「이알피에도 공유받기 붙여라」로 이알피는 자기 일꾼 pu-erp-sw.js 를
   기본 자리(/pureunall/)에 따로 등록했다. 한 자리에 일꾼은 하나만 살아 다른 앱들의 공유와
   번갈아 죽었다(sw-one-root-worker 검사 머리말). 그 몫을 pu-sw.js 의 갈래(takeErp)로 옮겼다.

   ■ 지키는 것
     ① 이알피 화면은 다른 앱과 «같은» 일꾼을 등록한다.
     ② 이알피로 온 공유는 «사진첩 화면이 꺼내는 바로 그 함»에 담기고, 사진첩 화면으로 넘어간다
        (이알피에는 사진 자리가 없다 — 사진첩이 명함 판독·기업정보함까지 잇는다).
     ③ 같은 일꾼의 다른 앱 갈래(기업정보함·사진첩·급여데이터함·문서뷰어)는 그대로이고 서로 안 섞인다.
     ④ 옛 pu-erp-sw.js 가 이미 깔린 폰도 통합 일꾼과 «똑같이» 받는다(껍데기가 통합 일꾼을 부른다).

   일꾼은 내장 브라우저가 등록을 막아 두어 화면으로는 못 본다 — vm 으로 파일을 통째로 켜서 돌린다.
   진짜 폰에서의 확인은 사람이 할 일로 남는다(status/2026-11-15-sw-erp-into-pu-sw.md). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { 일꾼켜기, 공유요청, 깨진요청, 사진, 보내기 } = require('./lib-sw-boot');

const R = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(R, f), 'utf8');
const 뿌리 = 'https://x.io/pureunall/';

const erp = read('pu-erp.html');
const 사진첩 = read('pu-photos.html');
const mf = (f) => JSON.parse(read(f));
const 이알피mf = mf('pu-erp-manifest.json');

/* 화면이 실제로 등록하는 일꾼 — 파일 이름을 손으로 박지 않는다(photos-share-target 머리말의 함정) */
function 등록한일꾼(src, 이름) {
  const m = src.match(/serviceWorker\s*\.\s*register\(\s*'([^']+)'\s*\)/);
  assert.ok(m, 이름 + ' 이 일꾼을 등록하는 줄을 못 찾았습니다');
  return m[1].replace(/^.*\//, '');
}
const 일꾼파일 = 등록한일꾼(erp, 'pu-erp.html');

/* 앱마다 «공유 받는 주소»와 «파일 칸 이름»은 그 앱 manifest 에서 읽는다 */
function 공유자리(manifest파일, 기준) {
  const st = mf(manifest파일).share_target;
  return { 주소: new URL(st.action, new URL(manifest파일, 기준)).href, 칸: st.params.files[0].name };
}
/* 사진첩 화면이 공유를 꺼내는 함의 이름 — 일꾼이 여기에 담아야 사진첩이 찾는다 */
const 사진첩함 = (사진첩.match(/const SHARE_IDB = '([^']+)'/) || [])[1];

/* ══════ ① 같은 일꾼을 등록한다 ══════ */

test('★ ① 이알피 화면은 사진첩·포털과 «같은» 일꾼을 등록한다 — 다르면 서로 밀어낸다', () => {
  const 사진첩일꾼 = 등록한일꾼(사진첩, 'pu-photos.html');
  assert.equal(일꾼파일, 사진첩일꾼,
    '★ 이알피가 ' + 일꾼파일 + ' 를, 사진첩이 ' + 사진첩일꾼 + ' 를 등록합니다 — 한 자리에 일꾼은 하나만 삽니다.');
  assert.match(erp, /location\.protocol === 'https:'[\s\S]{0,200}serviceWorker\.register\(/,
    'https 에서만 등록해야 합니다(file:// · http 에서는 등록 자체가 오류).');
  assert.match(erp, /serviceWorker\.register\('[^']+'\)\s*(?:\.catch|\['catch'\])\(/,
    '등록이 실패해도 이알피는 열려야 합니다.');
});

/* ══════ ② 이알피로 온 공유 → 사진첩 받은 함 → 사진첩 화면 ══════ */

for (const 기준 of [뿌리, 'http://localhost:8080/']) {
  test('★ ② 이알피 공유 POST 는 사진첩 받은 함에 담기고 사진첩 화면(?share=1)으로 넘어간다 — ' + 기준, async () => {
    assert.ok(사진첩함, 'pu-photos.html 에서 공유함 이름(SHARE_IDB)을 못 찾았습니다');
    const w = 일꾼켜기(일꾼파일, new URL(일꾼파일, 기준).href);
    const 이알피 = 공유자리('pu-erp-manifest.json', 기준);
    const 사진첩화면 = 공유자리('pu-photos-manifest.json', 기준).주소;
    const res = await 보내기(w.handlers, 공유요청(이알피.주소, 이알피.칸, [사진('명함.jpg'), 사진('스캔.pdf', 3000, 'application/pdf')]));
    assert.ok(res, '★ 일꾼이 이알피로 온 공유를 안 받습니다 — 받는 갈래가 없으면 깃허브가 오류 화면을 냅니다');
    assert.equal(res.status, 303, '303 이어야 새로고침해도 다시 안 보냅니다');
    assert.equal(res.headers.get('location'), 사진첩화면 + '?share=1',
      '★ 받은 뒤 «같은 폴더의» 사진첩 화면으로 가야 합니다 — 사진첩이 꺼내 판독까지 잇습니다');
    const 담김 = w.담긴것[사진첩함] || [];
    assert.equal(담김.length, 2, '★ 사진첩 화면이 꺼내는 함(' + 사진첩함 + ')에 안 담겼습니다 — 사진첩이 「보낸 게 없다」고 합니다');
    assert.equal(담김[0].name, '명함.jpg');
    assert.ok(담김[0].blob, '사진 알맹이를 그대로 담아야 합니다');
    assert.equal(담김[1].type, 'application/pdf', '스캔(PDF)도 받는다(manifest accept 와 같다)');
    /* 다른 앱의 함·캐시에 섞이면 그 앱이 남의 사진을 집어간다 */
    assert.deepEqual(Object.keys(w.담긴것), [사진첩함], '이알피 공유가 다른 앱 함에도 담겼습니다: ' + Object.keys(w.담긴것).join(','));
    assert.deepEqual(Object.keys(w.캐시), [], '이알피 몫에 캐시가 끼어들면 새 버전 자동 적용과 싸웁니다');
  });
}

test('② 한 장도 못 받았으면 사진첩 화면이 «없음»을 알린다 — 조용히 넘기면 올라간 줄 안다', async () => {
  const w = 일꾼켜기(일꾼파일, new URL(일꾼파일, 뿌리).href);
  const 이알피 = 공유자리('pu-erp-manifest.json', 뿌리);
  const 사진첩화면 = 공유자리('pu-photos-manifest.json', 뿌리).주소;
  const res = await 보내기(w.handlers, 공유요청(이알피.주소, 이알피.칸, [사진('빈것.jpg', 0), null]));
  assert.equal(res.headers.get('location'), 사진첩화면 + '?share=none');
  assert.equal((w.담긴것[사진첩함] || []).length, 0);
  /* 사진첩 화면이 그 표시를 정말 알린다 */
  assert.match(사진첩, /flag === 'none' \|\| flag === 'err'/, '사진첩 화면이 none·err 표시를 안 읽습니다');
});

test('② 읽다 깨져도 사진첩 화면으로 돌려보낸다(?share=err) — 빈 화면에 갇히지 않게', async () => {
  const w = 일꾼켜기(일꾼파일, new URL(일꾼파일, 뿌리).href);
  const 이알피 = 공유자리('pu-erp-manifest.json', 뿌리);
  const 사진첩화면 = 공유자리('pu-photos-manifest.json', 뿌리).주소;
  const res = await 보내기(w.handlers, 깨진요청(이알피.주소));
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), 사진첩화면 + '?share=err');
});

test('② 이알피 화면을 그냥 여는 것(GET)·남의 POST 는 건드리지 않는다', async () => {
  const w = 일꾼켜기(일꾼파일, new URL(일꾼파일, 뿌리).href);
  const 이알피 = 공유자리('pu-erp-manifest.json', 뿌리);
  assert.equal(await 보내기(w.handlers, { method: 'GET', url: 이알피.주소, mode: 'navigate' }), null,
    '가로채면 캐시가 끼어들어 새 버전이 안 내려옵니다');
  assert.equal(await 보내기(w.handlers, 공유요청(뿌리 + 'enter.html', 'photos', [사진('a.jpg')])), null,
    '공유 주소가 아닌 POST 까지 가로챕니다');
});

/* ══════ ③ 같은 일꾼의 다른 앱 갈래는 그대로, 서로 안 섞인다 ══════ */

test('★ ③ 이알피 갈래를 더해도 사진첩·급여데이터함·문서뷰어는 «제 함»에, 기업정보함은 제 캐시에 담긴다', async () => {
  const 앱들 = fs.readdirSync(R).filter((f) => /manifest.*\.json$/.test(f) && f !== 'pu-erp-manifest.json')
    .filter((f) => mf(f).share_target);
  let 돌린수 = 0;
  for (const f of 앱들) {
    const 자리 = 공유자리(f, 뿌리);
    /* 좁힌 자리(푸른캘린더 ./cal-share/)는 이 일꾼이 아니라 제 일꾼이 맡는다 — sw-one-root-worker 검사 ③ */
    if (new URL('./', 자리.주소).href !== 뿌리) continue;
    const w = 일꾼켜기(일꾼파일, new URL(일꾼파일, 뿌리).href);
    const res = await 보내기(w.handlers, 공유요청(자리.주소, 자리.칸, [사진('자료.jpg')]));
    assert.ok(res, '★ ' + f + ' 의 공유를 ' + 일꾼파일 + ' 가 안 받습니다 — 이알피 갈래를 더하다 다른 앱 길이 죽었습니다');
    assert.equal(res.status, 303);
    const 화면 = new URL(res.headers.get('location'));
    assert.ok(!/pu-erp/.test(화면.pathname), '★ ' + f + ' 의 공유가 이알피 쪽으로 샜습니다: ' + 화면.href);
    const 함들 = Object.keys(w.담긴것), 캐시들 = Object.keys(w.캐시);
    assert.equal(함들.length + 캐시들.length, 1, '★ ' + f + ' 의 공유가 한 곳이 아니라 여러 곳에 담겼습니다: ' + 함들.concat(캐시들).join(','));
    /* 사진첩 함은 사진첩(과 이알피) 몫이다 — 다른 앱 것이 들어오면 사진첩이 남의 자료를 집어간다 */
    if (f !== 'pu-photos-manifest.json') assert.ok(!(사진첩함 in w.담긴것), '★ ' + f + ' 의 공유가 사진첩 함에 섞였습니다');
    else assert.equal((w.담긴것[사진첩함] || []).length, 1, '사진첩 공유가 사진첩 함에 안 담겼습니다');
    돌린수++;
  }
  assert.ok(돌린수 >= 3, '돌려 본 다른 앱이 거의 없습니다(' + 돌린수 + ') — manifest 읽기가 틀어졌나요?');
});

/* ══════ ④ 옛 자리(pu-erp-sw.js)가 깔린 폰 ══════ */

const 옛일꾼 = 'pu-erp-sw.js';
test('④ 옛 ' + 옛일꾼 + ' 가 깔린 폰도 통합 일꾼과 «똑같이» 모든 앱의 공유를 받는다', { skip: !fs.existsSync(path.join(R, 옛일꾼)) && '옛 껍데기를 지웠다 — 볼 것이 없다' }, async () => {
  /* 브라우저는 깔린 일꾼의 파일을 때때로 다시 받아 본다 — 바뀌었으면 그 자리에서 갈아 끼운다.
     껍데기가 옛 몫을 따로 들고 있으면 이알피 공유만 받고 다른 앱 공유를 죽이던 때로 돌아간다. */
  assert.notEqual(일꾼파일, 옛일꾼, '이알피가 아직 옛 일꾼을 등록합니다');
  const w = 일꾼켜기(옛일꾼, 뿌리 + 옛일꾼);
  const 이알피 = 공유자리('pu-erp-manifest.json', 뿌리);
  const res = await 보내기(w.handlers, 공유요청(이알피.주소, 이알피.칸, [사진('명함.jpg')]));
  assert.ok(res && res.status === 303, '옛 자리에서 이알피 공유를 못 받습니다');
  assert.equal((w.담긴것[사진첩함] || []).length, 1, '옛 자리에서 받은 사진이 사진첩 함에 안 담겼습니다');
  for (const f of ['pu-photos-manifest.json', 'pu-paydata-manifest.json', 'pu-viewer-manifest.json', 'pu-cards-manifest.json']) {
    if (!fs.existsSync(path.join(R, f))) continue;
    const 자리 = 공유자리(f, 뿌리);
    const w2 = 일꾼켜기(옛일꾼, 뿌리 + 옛일꾼);
    assert.ok(await 보내기(w2.handlers, 공유요청(자리.주소, 자리.칸, [사진('자료.jpg')])),
      '★ 옛 자리에서 ' + f + ' 의 공유가 죽습니다 — 껍데기가 통합 일꾼을 안 부르고 옛 몫만 들고 있습니다');
  }
});
