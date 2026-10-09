#!/usr/bin/env node
/* 🤖 더빌 출금결과 받기 — 이 PC(대표 PC)에서만 돈다 (2026-10-09)
   설계: docs/superpowers/specs/2026-10-09-재무자동화-CMS-design.md §4-1
   · Aside 에 로그인된 더빌 탭에서 «출금결과조회»를 열어 지난 N일(기본 7)을 읽는다.
   · 로그인이 풀렸으면 status.needLogin=true 만 적고 끝낸다 — 로그인은 사람 몫이다.
   · 누르는 것은 ALLOWED_BUTTONS 뿐. 비밀번호 칸은 건드리지 않는다.
   · 서버에는 줄 하나씩 «더하기»만 — 같은 줄은 같은 열쇠라 두 번 쌓이지 않는다.
   쓰기: node scripts/thebill-pull.js [--dry] [--days 7] */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');
const { parsePayTable } = require('../js/pu-cms-auto.js');

const ASIDE = path.join(process.env.LOCALAPPDATA || '', 'Aside', 'CLI', 'current', 'aside.exe');
const ALLOWED_BUTTONS = ['조회'];
const DRY = process.argv.includes('--dry');
const DAYS = (() => { const i = process.argv.indexOf('--days'); return i > 0 ? parseInt(process.argv[i + 1], 10) || 7 : 7; })();

function ymd(t) { return new Date(t + 9 * 3600e3).toISOString().slice(0, 10); }   // 한국 날짜
const END = ymd(Date.now()), START = ymd(Date.now() - DAYS * 864e5);

/* aside repl 에 보낼 코드 — 결과는 «@@JSON@@» 뒤 한 줄로 받는다 */
function replCode() {
  return `
const ALLOWED = ${JSON.stringify(ALLOWED_BUTTONS)};
async function clickAllowed(v){ if(!ALLOWED.includes(v)) throw new Error('허용 안 된 단추 '+v);
  return page.evaluate((val)=>{ const b=[...document.querySelectorAll('input[type=button]')].find(x=>x.value===val&&x.offsetParent); if(b){ b.click(); return true; } return false; }, v); }
async function clickPage(n){ return page.evaluate((k)=>{ const a=[...document.querySelectorAll('a')].find(x=>x.innerText.trim()===String(k)&&/page|Page|goPage|fn_/.test(x.getAttribute('href')||x.getAttribute('onclick')||'')); if(a){ a.click(); return true; } return false; }, n); }
const tabsNow = await listBrowserTabs();
const tb = tabsNow.find(t=>/thebill\\.co\\.kr:444/.test(t.url));
if(!tb){ console.log('@@JSON@@'+JSON.stringify({needLogin:true})); }
else {
  await attachBrowserTab(tb.targetId);
  await page.goto('https://www.thebill.co.kr:444/cms2/defaultSummary.tb?menucd=CMS',{waitUntil:'domcontentloaded'});
  await sleep(2500);
  if(!/thebill\\.co\\.kr:444/.test(page.url()) || await page.locator('#loginid').count()){ console.log('@@JSON@@'+JSON.stringify({needLogin:true})); }
  else {
    done: {
    await page.evaluate(()=>$.loadContent('/cms2/cmsPayList.tb?menucd=CMS5010')); await sleep(3500);
    await page.evaluate(([s,e])=>{ document.getElementById('startDate').value=s; document.getElementById('endDate').value=e;
      const p=document.getElementById('setListPerPage'); p.value='100'; p.dispatchEvent(new Event('change',{bubbles:true})); }, ['${START}','${END}']);
    await sleep(3000);
    await page.evaluate(([s,e])=>{ document.getElementById('startDate').value=s; document.getElementById('endDate').value=e; }, ['${START}','${END}']);
    const clicked = await clickAllowed('조회'); await sleep(4000);
    if(!clicked){ console.log('@@JSON@@'+JSON.stringify({error:'조회 단추 없음'})); break done; }
    const grab = () => page.evaluate(()=>{ const ts=[...document.querySelectorAll('table')].filter(t=>t.offsetParent&&t.rows.length>1);
      const t=ts.sort((a,b)=>b.rows.length-a.rows.length)[0]; if(!t) return {head:[],body:[]};
      const cells=r=>[...r.cells].map(c=>c.innerText.trim());
      return {head:cells(t.rows[0]), body:[...t.rows].slice(1).map(cells)}; });
    const first = await grab();
    if(!first.head.length){ console.log('@@JSON@@'+JSON.stringify({error:'표를 못 찾음'})); break done; }
    const all = first.body.slice();
    for(let pg=2; pg<=20; pg++){
      if(!(await clickPage(pg))) break; await sleep(3000); all.push(...(await grab()).body);
    }
    console.log('@@JSON@@'+JSON.stringify({head:first.head, body:all}));
    }
  }
}`;
}

function firebaseUpdate(p, obj) {
  const f = path.join(os.tmpdir(), 'thebill-pull-' + process.pid + '.json');
  fs.writeFileSync(f, JSON.stringify(obj));
  try {
    execFileSync('firebase', ['database:update', p, '"' + f + '"', '--project', 'pureun-erp', '--force'],
      { stdio: 'pipe', shell: true, env: Object.assign({}, process.env, { MSYS_NO_PATHCONV: '1' }) });
  } finally { try { fs.unlinkSync(f); } catch (_) {} }
}
const safeKey = k => String(k).replace(/[.#$\[\]\/]/g, '_');

function main() {
  const now = Date.now();
  let res;
  try {
    const out = execFileSync(ASIDE, ['repl', replCode()], { encoding: 'utf8', timeout: 150000 });
    const line = out.split(/\r?\n/).find(l => l.indexOf('@@JSON@@') >= 0);
    res = line ? JSON.parse(line.slice(line.indexOf('@@JSON@@') + 8)) : { error: 'Aside 응답 없음' };
  } catch (e) { res = { error: String(e.message || e).slice(0, 200) }; }

  const status = { lastRunAt: now, needLogin: !!res.needLogin, read: 0, error: res.error || '' };
  let ok = false;
  let rows = [];
  if (!res.needLogin && !res.error) {
    const seen = {};
    rows = parsePayTable(res.head || [], res.body || []).filter(r => seen[r._k] ? false : (seen[r._k] = true));
    status.read = rows.length; ok = true;
  }
  console.log(`[더빌 받기] ${START}~${END} · 로그인 ${status.needLogin ? '풀림' : '됨'} · ${rows.length}줄${status.error ? ' · 오류 ' + status.error : ''}`);
  if (DRY) { rows.forEach(r => console.log(' ', r.wdate, r.status, r.amount, r.name)); return; }
  const upd = {
    'cms_pull/status/lastRunAt': status.lastRunAt, 'cms_pull/status/needLogin': status.needLogin,
    'cms_pull/status/read': status.read, 'cms_pull/status/error': status.error };
  if (ok) upd['cms_pull/status/lastOkAt'] = now;
  rows.forEach(r => { upd['cms_pull/rows/' + safeKey(r._k)] = r; });
  firebaseUpdate('/data', upd);
}
main();
