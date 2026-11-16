'use strict';
/* 규칙: «다른 웹사이트가 보낸 공유는 어느 일꾼도 담지 않는다 — 폰의 공유는 그대로 받는다» (대표 지시 2026-11-16)

   ■ 무엇을 지키나
   폰의 「공유 → 푸른○○」는 안드로이드가 앱 주소로 POST 를 보내고, 일꾼(서비스워커)이 받아 담는다.
   웹페이지도 같은 주소로 전송을 보낼 수 있다 — 그런 것은 «보낸 곳»에 그 페이지 주소가 붙어 온다.
   일꾼은 보낸 곳이 우리 앱(일꾼과 같은 폴더) 밖의 http(s) 주소이면 담지 않고 거절 화면(403)을 보인다.
   폰의 공유는 보낸 곳이 비어 있거나 android-app:// 로 온다 — 그것까지 막으면 공유가 죽는다.

   ■ 어떻게 보나 — 글자가 아니라 «돌려서» 본다(STATUS.md 되풀이된 실수 ②)
   ① 저장소에서 일꾼 파일을 «빠짐없이» 찾는다(이름이 아니라 내용 — fetch 를 듣거나 importScripts 를 쓰는 js).
      등록하지 않는 옛 껍데기도 넣는다 — 그 일꾼이 남은 폰이 있다.
   ② 공유를 받는 앱(manifest share_target)마다, 일꾼을 vm 으로 켜고 «폰처럼» 보내 본다 — 담으면 «받는 짝».
   ③ 받는 짝마다 보낸 곳을 바꿔 가며 보낸다: 폰·같은 폴더 → 담긴다 / 남의 사이트·같은 출처 다른 폴더 → 거절.

   ⚠ 일꾼의 진짜 POST 받기는 폰에서만 돈다(내장 브라우저는 등록을 막아 두었다) — 폰 확인은 사람 몫이다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { 일꾼켜기, 공유요청, 사진, 보내기 } = require('./lib-sw-boot');

const R = path.join(__dirname, '..');

/* 깃허브 주소(폴더 /pureunall/)와 내 컴퓨터 미리보기(폴더 /) 둘 다 본다 */
const 뿌리들 = ['https://x.io/pureunall/', 'http://localhost:8080/'];

/* ══════ ① 일꾼 파일 찾기 ══════ */
const 파일들 = execSync('git -c core.quotepath=false ls-files --cached --others --exclude-standard', { cwd: R, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean)
  .filter((f) => /\.m?js$/.test(f))
  /* 검사·참고본·서버 함수·남의 라이브러리(vendor)·숨은 폴더(작업 사본 등)는 화면이 등록하는 일꾼이 아니다 */
  .filter((f) => !/^(tests|node_modules|reference|functions|vendor)\//.test(f) && !/(^|\/)\./.test(f))
  .filter((f) => fs.existsSync(path.join(R, f)));

const 일꾼후보 = 파일들.filter((f) => {
  const s = fs.readFileSync(path.join(R, f), 'utf8');
  return /\bimportScripts\s*\(/.test(s) || /addEventListener\(\s*['"]fetch['"]/.test(s);
});

function 켜기(파일, 뿌리) {
  return 일꾼켜기(파일, new URL(파일, 뿌리).href);
}

/* 켜지지 않는 일꾼(바깥 파일을 부르는 웹푸시 등)은 «공유를 받는 꼴»이 아니어야 한다.
   켜졌는데 fetch 를 안 듣는 것(남의 라이브러리 등)은 공유를 받을 수 없으니 빠진다. */
const 켜지는일꾼 = [];
const 못켬 = [];
for (const f of 일꾼후보) {
  try { if (켜기(f, 뿌리들[0]).handlers.fetch) 켜지는일꾼.push(f); } catch (e) { 못켬.push({ f, e }); }
}

const 공유앱들 = fs.readdirSync(R)
  .filter((f) => /manifest.*\.json$/.test(f))
  .map((f) => ({ f, mf: JSON.parse(fs.readFileSync(path.join(R, f), 'utf8')) }))
  .filter((x) => x.mf.share_target && String(x.mf.share_target.method || '').toUpperCase() === 'POST');

function 받는곳(앱, 뿌리) {
  const st = 앱.mf.share_target;
  return {
    주소: new URL(st.action, new URL(앱.f, 뿌리)).href,
    칸: st.params && st.params.files && st.params.files[0] && st.params.files[0].name
  };
}

function 담긴수(w) {
  return Object.values(w.담긴것).reduce((n, a) => n + a.length, 0) +
    Object.values(w.캐시).reduce((n, a) => n + a.length, 0);
}

async function 보내보기(파일, 뿌리, 앱, 덧) {
  const w = 켜기(파일, 뿌리);
  const 곳 = 받는곳(앱, 뿌리);
  const res = await 보내기(w.handlers, 공유요청(곳.주소, 곳.칸, [사진('명함.jpg')], 덧));
  return { res, n: 담긴수(w) };
}

test('① 일꾼 파일을 찾았다 — 못 찾으면 아래 검사가 헛돈다', () => {
  assert.ok(켜지는일꾼.length >= 2, '켜 볼 수 있는 일꾼이 거의 없습니다: ' + 켜지는일꾼.join(', '));
  assert.ok(공유앱들.length >= 2, 'POST 로 공유를 받는 manifest 를 거의 못 찾았습니다(' + 공유앱들.length + ')');
});

test('① 켜 볼 수 없는 일꾼은 공유를 받는 꼴이 아니다 — 받는다면 이 검사 밖으로 빠진다', () => {
  for (const { f, e } of 못켬) {
    const s = fs.readFileSync(path.join(R, f), 'utf8');
    assert.ok(!(/formData\s*\(/.test(s) && /respondWith/.test(s)),
      f + ' 은 공유를 받는 일꾼 같은데 켜 볼 수 없습니다(' + e.message + ') — 다른 사이트 거절을 확인할 수 없습니다');
  }
});

/* ══════ ② 받는 짝 찾기 — 폰처럼(보낸 곳 없이) 보내 «담는» 일꾼·앱 ══════ */
const 짝들 = [];
test('② 공유를 받는 앱마다 «폰처럼» 보내면 담는 일꾼이 있다', async () => {
  for (const 앱 of 공유앱들) {
    let 받는일꾼 = 0;
    for (const f of 켜지는일꾼) {
      const { res, n } = await 보내보기(f, 뿌리들[0], 앱);
      if (res && n > 0) { 짝들.push({ f, 앱 }); 받는일꾼++; }
    }
    assert.ok(받는일꾼 > 0, 앱.f + ' 의 공유를 «폰처럼» 보내도 담는 일꾼이 없습니다 — 아래 거절 검사가 이 앱을 못 봅니다');
  }
  assert.ok(new Set(짝들.map((x) => x.f)).size >= 2, '공유를 받는 일꾼이 거의 없습니다: ' + 짝들.map((x) => x.f).join(', '));
});

/* ══════ ③ 보낸 곳을 바꿔 가며 ══════ */
function 경우들(뿌리) {
  const 집 = new URL(뿌리);
  const 받음 = [
    ['폰의 공유(보낸 곳 없음)', {}],
    ['폰의 다른 앱(android-app://)', { 보낸곳: 'android-app://com.kakao.talk/' }],
    ['우리 앱 화면', { 보낸곳: new URL('enter.html', 뿌리).href }],
    ['보낸 곳 없음 + Origin null', { origin: 'null' }],
    ['우리 앱 화면 + 같은 Origin', { 보낸곳: new URL('pu-photos.html', 뿌리).href, origin: 집.origin }]
  ];
  const 거절 = [
    ['남의 사이트(https)', { 보낸곳: 'https://evil.example/page.html' }],
    ['남의 사이트(http)', { 보낸곳: 'http://evil.example/' }],
    ['보낸 곳 없음 + 남의 Origin', { origin: 'https://evil.example' }],
    ['우리 앱 주소 + 남의 Origin', { 보낸곳: new URL('enter.html', 뿌리).href, origin: 'https://evil.example' }]
  ];
  /* 같은 깃허브 주소의 다른 저장소 — 폴더가 뿌리(/)면 «다른 폴더»가 없다 */
  if (집.pathname !== '/') 거절.push(['같은 주소 다른 폴더', { 보낸곳: 집.origin + '/other-repo/page.html' }]);
  return { 받음, 거절 };
}

test('★ ③ 폰의 공유·우리 앱 화면에서 온 것은 그대로 담는다', async () => {
  assert.ok(짝들.length, '받는 짝이 없습니다(② 먼저)');
  for (const { f, 앱 } of 짝들) {
    for (const 뿌리 of 뿌리들) {
      for (const [이름, 덧] of 경우들(뿌리).받음) {
        const { res, n } = await 보내보기(f, 뿌리, 앱, 덧);
        assert.ok(res && res.status === 303 && n > 0,
          '★ ' + f + ' 이 ' + 앱.f + ' 공유를 «' + 이름 + '»에서 받았는데 안 담았습니다(' + (res && res.status) + ') — 폰의 공유가 막힙니다');
      }
    }
  }
});

test('★ ③ 다른 웹사이트가 보낸 것은 어느 일꾼도 담지 않고 거절 화면(403)을 보인다', async () => {
  assert.ok(짝들.length, '받는 짝이 없습니다(② 먼저)');
  for (const { f, 앱 } of 짝들) {
    for (const 뿌리 of 뿌리들) {
      for (const [이름, 덧] of 경우들(뿌리).거절) {
        const { res, n } = await 보내보기(f, 뿌리, 앱, 덧);
        const 어디 = f + ' · ' + 앱.f + ' · «' + 이름 + '» · ' + 뿌리;
        assert.equal(n, 0, '★ 다른 사이트가 보낸 것을 담았습니다: ' + 어디);
        assert.ok(res, '응답이 없으면 전송이 서버(깃허브)로 가 오류 화면이 뜹니다: ' + 어디);
        assert.equal(res.status, 403, '거절은 403 이어야 합니다(앱으로 넘기면 받은 줄 압니다): ' + 어디);
        assert.match(String(res.headers.get('content-type')), /text\/html/, '거절 화면이 글자 덩어리로 뜹니다: ' + 어디);
        const 본문 = await res.text();
        assert.ok(!본문.includes('evil.example') && !본문.includes('other-repo'), '거절 화면에 보낸 곳 주소를 실었습니다: ' + 어디);
        const 고리 = [...본문.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
        assert.ok(고리.length >= 1, '거절 화면에 앱으로 돌아갈 고리가 없습니다: ' + 어디);
        for (const h of 고리) assert.ok(h.startsWith(뿌리), '거절 화면의 고리가 앱 밖을 가리킵니다(' + h + '): ' + 어디);
      }
    }
  }
});

test('③ 잣대가 헛돌지 않는다 — 거절 경우가 받음 경우와 같은 요청 모양이다', async () => {
  /* 받음·거절이 «보낸 곳»만 다르고 나머지(주소·칸·파일)가 같아야 위 두 검사가 뜻이 있다 */
  const { f, 앱 } = 짝들[0];
  const 뿌리 = 뿌리들[0];
  const 받음 = await 보내보기(f, 뿌리, 앱, {});
  const 거절 = await 보내보기(f, 뿌리, 앱, { 보낸곳: 'https://evil.example/' });
  assert.ok(받음.n > 0 && 거절.n === 0, '같은 요청이 보낸 곳만 바꿔 갈라지지 않습니다');
});
