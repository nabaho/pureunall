'use strict';
/* 서비스워커 파일 하나를 vm 에 «진짜로» 켜서 fetch 를 흘려 보는 검사용 공용 도구 (검사 파일이 아니다)

   ■ 왜 있나
   일꾼(서비스워커)은 폰에서만 제대로 돈다 — 내장 브라우저는 등록을 막아 두었고, 공유 POST 는
   안드로이드가 보낸다. 그래서 «글자가 있나»만 보면 갈래를 꺼 버려도 초록이다(STATUS.md 되풀이된 실수 ②).
   여기서는 파일을 통째로 켜고, 가짜 IndexedDB·캐시에 «무엇이 어디 담겼나»를 받아 적는다.

   ■ 쓰는 법
     const { 일꾼켜기, 공유요청, 보내기 } = require('./lib-sw-boot');
     const w = 일꾼켜기('pu-sw.js', 'https://x.io/pureunall/pu-sw.js');
     const res = await 보내기(w.handlers, 공유요청('https://x.io/pureunall/pu-erp.html', 'photos', [사진('a.jpg')]));
     w.담긴것['pu-photos-share']   // → [{ blob, name, type, at }]

   ⚠ importScripts 도 된다 — 주소를 일꾼 주소 기준으로 풀어 «저장소의 같은 자리 파일»을 같은 판에 싣는다
     (옛 껍데기 일꾼이 통합 일꾼을 불러 쓰는지 볼 때 쓴다). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const R = path.join(__dirname, '..');

/* 파일: 저장소 기준 경로(예: 'pu-sw.js') · 주소: 그 파일이 배포돼 열리는 주소 */
function 일꾼켜기(파일, 주소) {
  const handlers = {};
  const 담긴것 = {};   // IndexedDB 이름 → 담긴 레코드들
  const 캐시 = {};     // 캐시 이름 → 넣은 열쇠들
  const ctx = { URL, Response, Promise, setTimeout, console: { warn() {}, log() {} } };
  ctx.indexedDB = {
    open(이름) {
      const req = {};
      setTimeout(function () {
        req.result = {
          objectStoreNames: { contains() { return true; } },
          createObjectStore() {},
          transaction() {
            const tx = {};
            setTimeout(function () { tx.oncomplete && tx.oncomplete(); }, 0);
            return Object.assign(tx, {
              objectStore() {
                return {
                  add(v) { (담긴것[이름] = 담긴것[이름] || []).push(v); },
                  clear() { 담긴것[이름] = []; }
                };
              }
            });
          },
          close() {}
        };
        req.onsuccess && req.onsuccess();
      }, 0);
      return req;
    }
  };
  ctx.caches = {
    delete: async function (n) { delete 캐시[n]; return true; },
    open: async function (n) {
      캐시[n] = 캐시[n] || [];
      return { put: async function (k) { 캐시[n].push(String(k)); } };
    }
  };
  ctx.self = {
    addEventListener(n, fn) { handlers[n] = fn; },
    skipWaiting() {}, clients: { claim() {} },
    console: ctx.console, location: new URL(주소)
  };
  const 폴더주소 = new URL('./', 주소);
  function 싣기(상대) {
    const f = path.join(R, path.dirname(파일), 상대);
    if (!fs.existsSync(f)) throw new Error('일꾼이 부르는 파일이 저장소에 없습니다(배포하면 404): ' + 상대);
    vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
  }
  ctx.importScripts = function () {
    for (const u of arguments) {
      const 풀린 = new URL(u, 주소);
      if (풀린.origin !== 폴더주소.origin || !풀린.pathname.startsWith(폴더주소.pathname)) {
        throw new Error('일꾼 폴더 밖 파일을 부릅니다: ' + 풀린.href);
      }
      싣기(풀린.pathname.slice(폴더주소.pathname.length));
    }
  };
  vm.createContext(ctx);
  싣기(path.basename(파일));
  return { handlers, 담긴것, 캐시 };
}

/* 가짜 공유 요청 — 안드로이드가 보내는 모양(multipart 의 파일 칸 하나) */
function 공유요청(주소, 칸, 파일들) {
  return {
    method: 'POST', url: 주소, mode: 'navigate',
    formData: async function () {
      return {
        getAll: function (k) { return k === 칸 ? 파일들.slice() : []; },
        get: function (k) { return k === 칸 ? (파일들[0] || null) : null; }
      };
    }
  };
}

/* 읽다가 깨지는 요청 — 일꾼이 그래도 화면을 돌려보내는지 본다 */
function 깨진요청(주소) {
  return { method: 'POST', url: 주소, mode: 'navigate', formData: async function () { throw new Error('망가진 요청'); } };
}

function 사진(이름, 크기, 꼴) { return { name: 이름, size: 크기 === undefined ? 1200 : 크기, type: 꼴 || 'image/jpeg' }; }

/* fetch 를 한 번 흘린다 — 일꾼이 respondWith 를 안 부르면 null(브라우저가 평소대로 처리) */
async function 보내기(handlers, request) {
  let 답 = null;
  handlers.fetch({ request: request, respondWith: function (p) { 답 = p; } });
  return 답 ? await 답 : null;
}

module.exports = { 일꾼켜기, 공유요청, 깨진요청, 사진, 보내기 };
