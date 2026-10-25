#!/usr/bin/env node
/* 폰 화면 전수점검 — 포털 앱을 폰 크기로 «로그인한 채» 그려 재고, 갈무리를 남긴다.
 *
 *   node tools/phone-audit/run.mjs                 # 포털 앱 전부, 360·411px
 *   node tools/phone-audit/run.mjs gov work        # 몇 개만 (APPS key)
 *   node tools/phone-audit/run.mjs --widths=375    # 폭 바꾸기
 *   node tools/phone-audit/run.mjs --out=/tmp/x    # 결과 자리 (기본: tools/phone-audit/out — 저장소에 안 올린다)
 *   node tools/phone-audit/run.mjs --full          # 페이지 전체 갈무리도 남긴다
 *   node tools/phone-audit/run.mjs gov --view=feed # 그 앱의 views 가운데 하나만
 *   node tools/phone-audit/run.mjs erp --font=1.4  # 폰 «글자 크게» 흉내 (글자만 1.4배)
 *
 * 앱마다 자료·화면 열기: tools/phone-audit/seeds/<key>.js — { data, views:[{name, run(page)}], url?, localStorage? }
 *
 * ★ 어떻게 로그인하나 — 안 한다. gstatic 의 파이어베이스를 fake-firebase.js 로 바꿔 끼워
 *   «로그인된 한 사람»(지어낸 대표 계정)과 지어낸 자료(seed.js)로 앱을 돌린다. 앱 코드는 그대로다.
 * ★ 바깥으로 나가는 것 — 라이브러리 CDN(unpkg·cdnjs·jsdelivr·글꼴)만 받는다. 함수·REST·카카오 등은 막는다.
 *   진짜 서버에 아무것도 안 쓴다.
 * ⚠ 개발용이다 — tools/ 는 배포에서 지운다. 결과(out/)는 .gitignore 에 있다.
 * ⚠ playwright 가 필요하다(클라우드 방에는 깔려 있다). 없으면 `npm i -g playwright`.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const require = createRequire(import.meta.url);

async function loadPlaywright() {
  try { return await import('playwright'); } catch (e) {}
  const g = execSync('npm root -g').toString().trim();
  return require(path.join(g, 'playwright'));
}

/* 포털 앱 목록은 enter.html 의 APPS 에서 읽는다 — 새 앱이 생기면 저절로 점검에 든다 */
export function portalApps() {
  const src = fs.readFileSync(path.join(root, 'enter.html'), 'utf8');
  const at = src.search(/\bAPPS\s*=\s*\[/);
  if (at < 0) throw new Error('enter.html 에서 APPS 목록을 못 찾았습니다');
  const seg = src.slice(at, src.indexOf('];', at));
  const re = /key:'([a-z0-9_]+)',\s*name:'([^']+)'[^}]*?url:'([^']+)'/g;
  const out = []; const seen = new Set(); let m;
  while ((m = re.exec(seg))) {
    if (seen.has(m[1])) continue; seen.add(m[1]);
    out.push({ key: m[1], name: m[2], url: m[3] });
  }
  out.unshift({ key: 'portal', name: '포털', url: 'enter.html' });
  return out;
}

const args = process.argv.slice(2);
const opt = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const only = args.filter(a => !a.startsWith('--'));
const widths = String(opt.widths || '360,411').split(',').map(Number);
const outDir = path.resolve(opt.out || path.join(here, 'out'));
const waitMs = Number(opt.wait || 6000);
const onlyView = opt.view || '';

const seed = require('./seed.js');
const fakeSrc = fs.readFileSync(path.join(here, 'fake-firebase.js'), 'utf8');
const measureSrc = fs.readFileSync(path.join(here, 'measure.js'), 'utf8');

function deepMerge(a, b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b;
  const o = Object.assign({}, a);
  for (const k of Object.keys(b)) o[k] = (a && typeof a[k] === 'object' && !Array.isArray(a[k])) ? deepMerge(a[k], b[k]) : b[k];
  return o;
}

/* 저장소를 그대로 내어 주는 작은 서버 */
function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    let f = path.join(root, u === '/' ? 'enter.html' : u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r(srv)));
}

const ALLOW = /^(https:\/\/(unpkg\.com|cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.tailwindcss\.com|code\.jquery\.com|t1\.kakaocdn\.net|developers\.kakao\.com))/;

/* 한 화면을 재고 갈무리한다 */
async function snapOne(page, key, view, width) {
  let m = null, err = null;
  /* --font=1.4 — 폰의 «글자 크게»(접근성 글자 배율)를 흉내 낸다 (2026-10-22).
     대표 폰은 글자가 커서, 보통 크기에서 멀쩡한 칸이 세로로 깨졌다. 배율은 px 글자까지
     키우므로 CSS zoom 과 다르다 — 칸 폭은 그대로, 글자만 커진다. 먼저 다 재고 나서 한꺼번에 바꾼다
     (재면서 바꾸면 em 글자가 두 번 커진다). 이미 키운 것은 표시(data-pa-fs)로 건너뛴다. */
  if (opt.font) {
    await page.evaluate((f) => {
      const els = [...document.querySelectorAll('body *')].filter(el => !el.dataset.paFs);
      const sz = els.map(el => parseFloat(getComputedStyle(el).fontSize) || 0);
      els.forEach((el, i) => { el.dataset.paFs = '1'; if (sz[i]) el.style.setProperty('font-size', (sz[i] * f) + 'px', 'important'); });
    }, Number(opt.font)).catch(() => {});
    /* 폭에 따라 표를 줄이거나 카드로 접는 앱(재무관리 js/pu-fin-phone.js)은 글자가 커진 뒤 다시 잰다 */
    await page.evaluate(() => { try { window.__puFinPhone && window.__puFinPhone.rescan && window.__puFinPhone.rescan(); } catch (e) {} }).catch(() => {});
    await page.waitForTimeout(250);
  }
  try {
    await page.addScriptTag({ content: measureSrc });
    m = await page.evaluate((w) => __paMeasure({ width: w }), width);
    m.missing = await page.evaluate(() => (window.__PA_LOG__ && window.__PA_LOG__.missing || []).slice(0, 60));
  } catch (e) { err = String(e.message).slice(0, 200); }
  const name = view === 'home' ? `${key}-${width}` : `${key}-${view}-${width}`;
  const shot = path.join(outDir, name + '.png');
  try { await page.screenshot({ path: shot, fullPage: false }); } catch (e) {}
  if (opt.full) { try { await page.screenshot({ path: path.join(outDir, name + '-full.png'), fullPage: true }); } catch (e) {} }
  return { m, err, shot: path.relative(root, shot) };
}

/* 앱 하나를 한 폭으로 — 첫 화면 + seeds/<key>.js 의 views(탭·창 열기)를 차례로 잰다 */
async function auditOne(browser, base, app, width) {
  const ctx = await browser.newContext({
    viewport: { width, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
    locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  });
  const extra = seed.apps[app.key] || {};
  const data = deepMerge(seed.base, extra.data || {});
  const errors = [];
  await ctx.addInitScript(({ data, uid, sid, email, ls }) => {
    window.__PA_SEED__ = data;
    window.__PA_USER__ = { uid, email, displayName: '점검대표' };
    window.PU_AUTHSYNC_GRACE_MS = 600000;
    try {
      localStorage.setItem('pu_auth_uid', uid);
      localStorage.setItem('pureun_v6_autologin_sid', sid);
      sessionStorage.setItem('pureun_v6_session_sid', sid);
      Object.keys(ls || {}).forEach(k => localStorage.setItem(k, ls[k]));
    } catch (e) {}
    window.alert = () => {}; window.confirm = () => false; window.prompt = () => null;
  }, { data, uid: seed.UID, sid: seed.SID, email: seed.EMAIL, ls: extra.localStorage || {} });
  await ctx.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (/gstatic\.com\/firebasejs\//.test(u)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: fakeSrc });
    if (/(firebaseio\.com|firebasedatabase\.app)\/.*\.json/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    if (ALLOW.test(u)) return route.continue();
    if (u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    return route.abort();
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)));
  let navErr = null;
  try {
    /* 이알피는 폰에서 포털 타일을 거쳐 온 것(sso=1)이 아니면 포털로 돌려보낸다 */
    let url = extra.url || app.url;
    if (/^pu-erp\.html/.test(url) && !/[?&]sso=1/.test(url)) url += (url.includes('?') ? '&' : '?') + 'sso=1';
    await page.goto(base + '/' + url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(waitMs);
  } catch (e) { navErr = String(e.message).slice(0, 200); }
  const rows = [];
  const first = await snapOne(page, app.key, 'home', width);
  rows.push({ key: app.key, name: app.name, url: app.url, view: 'home', width, navErr: navErr || first.err, errors: errors.slice(0, 8), m: first.m, shot: first.shot });
  for (const v of (extra.views || [])) {
    if (onlyView && v.name !== onlyView) continue;
    let verr = null;
    try { await v.run(page); await page.waitForTimeout(v.wait || 1500); } catch (e) { verr = String(e.message).slice(0, 200); }
    const s = await snapOne(page, app.key, v.name, width);
    rows.push({ key: app.key, name: app.name, url: app.url, view: v.name, width, navErr: verr || s.err, errors: errors.slice(0, 8), m: s.m, shot: s.shot });
    if (v.back) { try { await v.back(page); await page.waitForTimeout(500); } catch (e) {} }
  }
  await ctx.close();
  return rows;
}

function line(r) {
  const m = r.m || {};
  const n = (v, w) => String(v ?? '?').padStart(w);
  return `${(r.key + (r.view === 'home' ? '' : ':' + r.view)).padEnd(22)} ${String(r.width).padEnd(4)} 옆넘침 ${n(m.overflowX, 4)} · 화면밖 ${n(m.offscreenN, 3)} · 세로깨짐 ${n(m.verticalN, 3)} · 짓눌림 ${n(m.squeezedN, 3)} · 두줄단추 ${n(m.wrapBtnN, 3)} · 작은단추 ${n(m.smallTapN, 3)} · 작은입력 ${n(m.smallInputN, 2)} · 떠있음 ${n(m.fixedCoverPct, 3)}% · 양옆 ${m.sideL ?? '?'}/${m.sideR ?? '?'}px·겹${m.boxDepth ?? '?'}${m.gate ? ' · ⚠잠금화면' : ''}${r.navErr ? ' · ⚠' + r.navErr : ''}${r.errors.length ? ' · 오류' + r.errors.length : ''}`;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const { chromium } = await loadPlaywright();
  const srv = await serve();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  let apps = portalApps();
  if (only.length) apps = apps.filter(a => only.includes(a.key));
  const results = [];
  for (const app of apps) {
    for (const w of widths) {
      const rows = await auditOne(browser, base, app, w);
      for (const r of rows) { results.push(r); console.log(line(r)); }
    }
  }
  const file = path.join(outDir, only.length ? `result-${only.join('-')}.json` : 'result.json');
  fs.writeFileSync(file, JSON.stringify(results, null, 1));
  await browser.close(); srv.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
