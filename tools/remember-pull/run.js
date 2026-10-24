/* 푸른 리멤버·메일 가져오기 — 윈도우 작업 스케줄러가 1시간마다 돌리는 터미널 프로그램 (대표 「진행」 2026-10-24)
   「리멤버에 있는 것 — 피시는 켜져 있는데 자동으로 터미널에서 연결해서 가지고 올 수 없나」

   node run.js login  → 전용 크롬 창을 띄운다. 대표가 리멤버·푸른 포털에 «한 번» 로그인하고 창을 닫는다.
   node run.js        → (작업 스케줄러) 화면 밖 전용 크롬으로
                         ① 푸른 「리멤버 받기」 화면을 열어 지난번 기준(cp)을 묻고
                         ② 리멤버를 열어, 리멤버 화면이 스스로 쓰는 머리를 그 자리에서 빌려 «수정순»으로 기준 뒤 명함만 받고
                         ③ 앞면 그림(리멤버 그림 창고만)과 함께 받는 화면에 넘긴다 → 명함·사진첩
                         ④ 받는 화면이 열려 있는 동안 메일 서명 명함·메일 첨부 서류도 함께 처리된다 → 끝나면 닫는다
   ⚠ 대표가 쓰는 크롬과 섞이지 않는 «전용 프로필»(%LOCALAPPDATA%\pu-remember-chrome)을 쓴다.
   ⚠ 리멤버 머리(authorization)는 이 프로그램 메모리에만 — 파일·기록에 남기지 않는다. 비밀번호는 다루지 않는다.
   ⚠ 리멤버에는 읽기만. 기록(run.log)에는 개수만 남긴다(이름·연락처 없음). */
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = process.env.PU_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PROFILE = path.join(process.env.LOCALAPPDATA || '.', 'pu-remember-chrome');
const LOG = path.join(PROFILE, 'run.log');
const LOCK = path.join(PROFILE, 'run.lock');
const REM_HOME = 'https://card.rememberapp.co.kr/book/groups';
const INTAKE = 'https://nabaho.github.io/pureunall/remember-intake.html';
const LIST = 'https://api.rememberapp.co.kr/v2/stacks/list.json';
const IMG_OK = /^https:\/\/remember-cdn\.rememberapp\.co\.kr\/[^\s"'<>]+$/;
const IMG_MAX = 4 * 1024 * 1024;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

function log(msg) {
  try { fs.mkdirSync(PROFILE, { recursive: true }); fs.appendFileSync(LOG, new Date().toISOString() + ' ' + msg + '\n'); } catch (e) { /* 기록 못 해도 일은 한다 */ }
  console.log(msg);
}
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* 받는 화면에 말 걸기 — 그 화면이 믿는 표시(확장과 같은 표시)를 붙여 «같은 창 안»에서 보낸다 */
function ask(page, msg, expect, ms) {
  return page.evaluate((msg, expect, ms) => new Promise((ok) => {
    const t = setTimeout(() => { window.removeEventListener('message', on); ok({ err: 'timeout' }); }, ms);
    function on(ev) {
      const m = ev.data;
      if (ev.source !== window || !m || m.__from !== 'pu-remember-intake' || m.__to !== 'pu-remember-ext' || m.cmd !== expect) return;
      clearTimeout(t); window.removeEventListener('message', on); ok(m);
    }
    if (expect) window.addEventListener('message', on); else { clearTimeout(t); ok({ ok: true }); }
    window.postMessage(Object.assign({ __from: 'pu-remember-ext', __to: 'pu-remember-intake' }, msg), location.origin);
  }), msg, expect, ms);
}

async function image(url) {
  if (!IMG_OK.test(url || '')) return '';
  try {
    const r = await fetch(url);
    if (!r.ok) return '';
    const ct = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
    if (!/^image\/(jpeg|png|webp)$/.test(ct)) return '';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > IMG_MAX) return '';
    return 'data:' + ct + ';base64,' + buf.toString('base64');
  } catch (e) { return ''; }
}

async function login() {
  const browser = await puppeteer.launch({ executablePath: CHROME, userDataDir: PROFILE, headless: false, defaultViewport: null, args: ['--no-first-run'] });
  const [p1] = await browser.pages();
  await p1.goto(REM_HOME);
  const p2 = await browser.newPage();
  await p2.goto(INTAKE);
  log('login: 전용 크롬을 띄웠습니다 — 리멤버·푸른 포털에 로그인한 뒤 창을 닫아 주세요');
  await new Promise((ok) => browser.on('disconnected', ok));
}

async function run() {
  fs.mkdirSync(PROFILE, { recursive: true });
  try { const age = Date.now() - fs.statSync(LOCK).mtimeMs; if (age < 50 * 60000) { log('skip: 앞 회차가 아직 돈다'); return; } } catch (e) { /* 자물쇠 없음 */ }
  fs.writeFileSync(LOCK, String(process.pid));
  const browser = await puppeteer.launch({ executablePath: CHROME, userDataDir: PROFILE, headless: 'new', args: ['--no-first-run', '--window-size=1280,900'] });
  try {
    /* ① 받는 화면 */
    const ip = await browser.newPage();
    await ip.setUserAgent(UA);
    await ip.goto(INTAKE, { waitUntil: 'networkidle2', timeout: 90000 });
    let hello = { ready: false };
    for (let i = 0; i < 20 && !hello.ready; i++) { hello = await ask(ip, { cmd: 'hello' }, 'cp', 5000); if (!hello.ready) await sleep(3000); }
    if (!hello.ready) { log('stop: 푸른 포털 로그인이 안 되어 있습니다 — node run.js login'); return; }
    const cp = Number(hello.cp) || 0;
    /* ② 리멤버 — 화면이 목록을 부를 때 쓰는 머리를 빌린다(메모리에만) */
    const rp = await browser.newPage();
    await rp.setUserAgent(UA);
    let heads = null;
    rp.on('request', (rq) => { if (!heads && rq.url().indexOf('/v2/stacks/list.json') >= 0) { const h = rq.headers(); if (h.authorization) heads = h; } });
    await rp.goto(REM_HOME, { waitUntil: 'networkidle2', timeout: 90000 });
    for (let i = 0; i < 30 && !heads; i++) await sleep(1000);
    if (!/^https:\/\/card\.rememberapp\.co\.kr\//.test(rp.url()) || !heads) {
      await ask(ip, { cmd: 'login-lost' }, null, 1000);
      log('stop: 리멤버 로그인이 풀렸습니다 — node run.js login');
    } else {
      const res = await rp.evaluate(async (LIST, heads, cp) => {
        const out = []; let total = 0;
        for (let n = 1; n <= 10; n++) {
          const r = await fetch(LIST, { method: 'POST', headers: heads, credentials: 'include',
            body: JSON.stringify({ group_ids: [], exclude_fields: ['sub_cards'], master: false, page: n, per: 50, sort: [{ updated_at: 'desc' }] }) });
          if (r.status === 401 || r.status === 403) return { err: 'login' };
          const j = await r.json(); const d = (j && j.data) || {}; const st = d.stacks || [];
          total = (d.metainfo && d.metainfo.total_count) || total;
          st.forEach((x) => { const mc = x.main_card || {}, im = mc.image || {};
            const side = (o) => (o ? { original: o.original || '', preview: o.preview || '', empty: !!o.empty } : null);
            out.push({ id: x.id, created_at: x.created_at, updated_at: x.updated_at, main_card: { id: mc.id, created_at: mc.created_at, updated_at: mc.updated_at,
              requested_at: mc.requested_at, image: { front: side(im.front), back: side(im.back) }, data: mc.data } }); });
          const last = st[st.length - 1];
          if (!cp || !st.length || st.length < 50 || (Date.parse(last.updated_at) || 0) <= cp) break;
        }
        return { stacks: out, total };
      }, LIST, heads, cp);
      heads = null;                                   /* 다 썼으면 바로 버린다 */
      if (res.err) { await ask(ip, { cmd: 'login-lost' }, null, 1000); log('stop: 리멤버 로그인이 풀렸습니다'); }
      else {
        /* ③ 그림 — 이번에 새로 다룰 것만 */
        const images = {}; let fresh = 0;
        for (const st of res.stacks) {
          if (!cp || (Date.parse(st.updated_at) || 0) <= cp) continue;
          fresh++;
          const f = st.main_card && st.main_card.image && st.main_card.image.front;
          if (f && !f.empty) { const d = await image(f.original || f.preview); if (d) images[st.id] = d; }
        }
        const done = await ask(ip, { cmd: 'batch', stacks: res.stacks, images: images, total: res.total }, 'done', 600000);
        log('remember: 받은 ' + res.stacks.length + ' · 기준 뒤 ' + fresh + ' · 그림 ' + Object.keys(images).length + ' · 결과 ' + (done.err || ('n=' + done.n)));
      }
    }
    await rp.close().catch(() => {});
    /* ④ 메일 서명·첨부 — 받는 화면이 열려 있는 동안 저절로 처리된다. 첨부 사진첩(숨은 창)이 다 끝날 때까지 기다린다 */
    await sleep(60000);
    for (let i = 0; i < 24; i++) {
      const fr = await ip.evaluate(() => document.querySelectorAll('iframe').length).catch(() => 0);
      if (!fr) break;
      await sleep(30000);
    }
    log('mail: 받는 화면 회차 끝');
  } finally {
    await browser.close().catch(() => {});
    try { fs.unlinkSync(LOCK); } catch (e) { /* 이미 없음 */ }
  }
}

(process.argv[2] === 'login' ? login() : run()).catch((e) => { log('error: ' + String((e && e.message) || e).slice(0, 200)); process.exitCode = 1; });
