#!/usr/bin/env node
/* 「폰 미러」 — 대표 폰을 PC 에 비춰 놓고, PC 의 Claude 가 «진짜 폰 화면»을 보며 UI 를 고친다
 * (대표 지시 2026-10-24 「내 컴퓨터에 폰을 미러링으로 연결하고 푸른 통합시스템 UI 고칠 수 있게 해 달라」)
 *
 * ■ 왜 있나
 *   폰 화면 점검(tools/phone-audit)은 «지어낸 자료 + 가짜 파이어베이스»로 그린다 — 안전하지만 진짜 폰이 아니다.
 *   대표 폰은 글자를 크게 쓰고, 실제 자료는 더 길다. 그 차이에서 깨지는 것을 대표가 갈무리로 보내 줘야만 알았다.
 *   이 도구는 USB 로 붙인 폰을 그대로 본다:
 *     ① 미러 창   — scrcpy 가 폰 화면을 PC 창에 띄운다. 누르고 넘기는 것은 «사람»이 한다.
 *     ② 갈무리    — `--shot` 이 폰 화면을 그림으로 남긴다. PC 의 Claude 가 그 그림을 읽는다.
 *     ③ 재기      — `--measure` 가 폰 크롬에 열린 푸른 화면을 phone-audit 와 «같은 자»(measure.js)로 잰다.
 *
 * ■ 쓰기 — 저장소 맨 위의 폰미러-켜기.bat 을 두 번 누른다
 *   1  미러 창 켜기 (5초 안에 안 고르면 이것)        node tools/phone-mirror.js --mirror
 *   2  폰 화면 갈무리                                node tools/phone-mirror.js --shot
 *   3  폰 크롬 화면 재기 (읽기만)                     node tools/phone-mirror.js --measure
 *   4  준비 점검                                     node tools/phone-mirror.js --check
 *   5  scrcpy 깔기 (winget — 창이 뜨고 사람이 본다)    node tools/phone-mirror.js --install
 *   node tools/phone-mirror.js --dry --shot           아무것도 안 하고 «할 일»만 찍는다(검사가 이 길로 본다)
 *
 * ■ 폰에서 한 번만 할 것 (사람)
 *   설정 → 휴대전화 정보 → 소프트웨어 정보 → 「빌드번호」 일곱 번 → 개발자 옵션 → 「USB 디버깅」 켬
 *   → USB 선으로 PC 에 꽂고 폰에 뜨는 「USB 디버깅을 허용할까요?」 에서 «이 컴퓨터 항상 허용» 체크 후 허용.
 *   재기(③)는 폰 «크롬»에서 푸른 앱을 열어 둔 채로 한다(삼성 인터넷은 안 된다).
 *
 * ■ 지키는 것 — CLAUDE.md 「화면 같이 보기」·「에고라이트」 절과 같다. 폰 크롬은 «진짜 로그인»이다.
 *   · 이 도구는 폰을 «누르지도 치지도» 않는다 — adb input·CDP Input.* 를 쓰지 않는다(tests/phone-mirror.test.js 가 막는다).
 *     미러 창에서 누르는 것은 사람이다. 저장·삭제·보내기는 사람이 직접 한다.
 *   · 재기는 푸른 화면(nabaho.github.io/pureunall · 내 PC 의 localhost)에서만 — 은행·메일 등 다른 탭은 열어 보지도 않는다.
 *     재는 스크립트는 measure.js 하나뿐이다(값만 돌려주고 화면은 안 건드린다). 그 밖의 코드를 폰 탭에서 돌리지 않는다.
 *   · 갈무리는 tools/phone-mirror/out/ 에만 남긴다 — .gitignore 에 있어 저장소에 안 올라간다.
 *     폰 화면에는 고객 이름·금액이 그대로 보인다. 그림을 채팅·PR·이슈에 붙이지 말 것(필요하면 가린 뒤).
 *   · 깔기는 winget 으로 «보이게» 한다 — 조용히 깔지 않는다. scrcpy(Genymobile, 공개 소스)에 adb 가 함께 든다.
 *
 * ■ 일부러 그렇게 한 것
 *   · 의존 꾸러미 없음 — Node 22 의 fetch·WebSocket 으로 크롬 DevTools 에 붙는다(PC 에 playwright 를 안 깔아도 된다).
 *   · 결정은 순수 함수(계획·adb후보·기기읽기·기기판정·허용주소·사진이름·탭고르기)로 떼어 둔다 — CI 는 리눅스라
 *     윈도우 길을 밟을 수 없다(tools/rc-open.js 가 데인 자리). 검사는 이 함수들을 직접 본다.
 *   · 점검은 «잴 수 있는 것만» 됨/안됨 — 못 잰 것은 «모름»으로 두고 사람이 볼 자리를 적는다.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'phone-mirror', 'out');
const MEASURE = path.join(__dirname, 'phone-audit', 'measure.js');
const PORT = 9222;

/* 푸른 화면만 잰다 — 다른 탭(은행·메일·검색)은 열어 보지 않는다 */
function 허용주소(u) {
  let x;
  try { x = new URL(String(u || '')); } catch (e) { return false; }
  if (x.protocol === 'https:' && x.hostname === 'nabaho.github.io' && /^\/pureunall(\/|$)/.test(x.pathname)) return true;
  if (x.protocol === 'http:' && (x.hostname === 'localhost' || x.hostname === '127.0.0.1')) return true;   // 내 PC 에서 띄운 판
  return false;
}

/* adb 를 어디서 찾나 — PATH · winget 으로 깐 scrcpy 폴더 · 안드로이드 SDK */
function adb후보(env) {
  env = env || {};
  const 목록 = ['adb'];
  const la = env.LOCALAPPDATA;
  if (la) {
    const 패키지 = path.join(la, 'Microsoft', 'WinGet', 'Packages');
    try {
      fs.readdirSync(패키지).filter((d) => /^Genymobile\.scrcpy/i.test(d)).forEach((d) => {
        const 안 = path.join(패키지, d);
        try {
          fs.readdirSync(안).forEach((s) => { if (/^scrcpy/i.test(s)) 목록.push(path.join(안, s, 'adb.exe')); });
        } catch (e) { /* 폴더가 없다 */ }
      });
    } catch (e) { /* winget 을 안 썼다 */ }
    목록.push(path.join(la, 'Android', 'Sdk', 'platform-tools', 'adb.exe'));
  }
  return 목록;
}

/* `adb devices -l` 읽기 */
function 기기읽기(글) {
  return String(글 || '').split(/\r?\n/).slice(1).map((줄) => 줄.trim()).filter(Boolean).map((줄) => {
    const 칸 = 줄.split(/\s+/);
    const m = 줄.match(/model:(\S+)/);
    return { serial: 칸[0], state: 칸[1] || '', model: m ? m[1] : '' };
  });
}

function 기기판정(목록) {
  const 됨 = (목록 || []).filter((d) => d.state === 'device');
  if (됨.length >= 1) return { ok: true, serial: 됨[0].serial, model: 됨[0].model, many: 됨.length > 1 };
  if ((목록 || []).some((d) => d.state === 'unauthorized')) {
    return { ok: false, why: '폰이 «USB 디버깅 허용»을 아직 안 눌렀습니다 — 폰 화면의 창에서 «이 컴퓨터 항상 허용» 체크 후 허용' };
  }
  return { ok: false, why: '폰이 안 보입니다 — USB 선을 꽂고, 개발자 옵션의 «USB 디버깅»이 켜져 있는지 보십시오' };
}

function 사진이름(d) {
  const p = (n) => String(n).padStart(2, '0');
  return '폰-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.png';
}

/* DevTools 탭 목록에서 «잴 탭» 고르기 — 푸른 화면인 page 만, 맨 앞(가장 최근) 것 */
function 탭고르기(탭들) {
  const 쪽 = (탭들 || []).filter((t) => t && t.type === 'page');
  const 푸른 = 쪽.filter((t) => 허용주소(t.url));
  return { tab: 푸른[0] || null, 다른탭수: 쪽.length - 푸른.length };
}

function 계획(argv) {
  const 있나 = (f) => argv.indexOf(f) >= 0;
  const 일 = ['--install', '--check', '--mirror', '--shot', '--measure', '--menu'].find(있나) || '--menu';
  return { 일, dry: 있나('--dry') };
}

/* ───── 아래부터는 실제로 돈다 (윈도우 PC) ───── */
function 돌려(cmd, args, opts) {
  return spawnSync(cmd, args, Object.assign({ encoding: 'utf8', windowsHide: true }, opts || {}));
}

function adb찾기() {
  for (const c of adb후보(process.env)) {
    if (c !== 'adb' && !fs.existsSync(c)) continue;
    const r = 돌려(c, ['version']);
    if (r.status === 0) return c;
  }
  return null;
}

function scrcpy찾기() {
  const r = 돌려('scrcpy', ['--version']);
  if (r.status === 0) return 'scrcpy';
  const a = adb찾기();
  if (a && a !== 'adb') {
    const s = path.join(path.dirname(a), 'scrcpy.exe');
    if (fs.existsSync(s)) return s;
  }
  return null;
}

function 기기(adb) {
  const r = 돌려(adb, ['devices', '-l']);
  return 기기판정(기기읽기(r.stdout));
}

function 준비(필요) {
  const adb = adb찾기();
  if (!adb) { console.log('✗ adb 가 없습니다 — 5번(scrcpy 깔기)을 먼저 하십시오'); return null; }
  const g = 기기(adb);
  if (!g.ok) { console.log('✗ ' + g.why); return null; }
  if (g.many) console.log('⚠ 폰이 여럿 붙어 있습니다 — 첫 폰(' + (g.model || g.serial) + ')을 씁니다');
  return { adb, serial: g.serial, model: g.model };
}

function 설치(dry) {
  console.log('scrcpy(폰 화면을 PC 에 비추는 공개 프로그램, adb 포함)를 winget 으로 깝니다. 창이 뜨면 확인해 주십시오.');
  const args = ['install', '--id', 'Genymobile.scrcpy', '-e', '--source', 'winget'];
  if (dry) { console.log('[할 일] winget ' + args.join(' ')); return; }
  const r = 돌려('winget', args, { stdio: 'inherit' });
  console.log(r.status === 0 ? '✓ 깔았습니다 — 이 창을 닫고 다시 열어야 새 프로그램이 잡힙니다' : '✗ 못 깔았습니다(winget 이 없으면 https://github.com/Genymobile/scrcpy/releases 에서 받으십시오)');
}

function 미러(dry) {
  const args = ['--stay-awake', '--window-title', '푸른 폰 미러', '--max-size', '1400'];
  if (dry) { console.log('[할 일] scrcpy ' + args.join(' ')); return; }
  const 기 = 준비(); if (!기) return;
  const s = scrcpy찾기(); if (!s) { console.log('✗ scrcpy 가 없습니다 — 5번을 먼저'); return; }
  const c = spawn(s, args.concat(['--serial', 기.serial]), { detached: true, stdio: 'ignore', windowsHide: false });
  c.unref();
  console.log('✓ 미러 창을 띄웠습니다(' + (기.model || 기.serial) + '). 창 안에서 누르고 넘기는 것은 사람이 합니다.');
}

function 갈무리(dry) {
  const 이름 = path.join(OUT, 사진이름(new Date()));
  if (dry) { console.log('[할 일] adb exec-out screencap -p > ' + 이름); return 이름; }
  const 기 = 준비(); if (!기) return null;
  const r = spawnSync(기.adb, ['-s', 기.serial, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 100) { console.log('✗ 갈무리 실패 — 폰 화면이 꺼져 있지 않은지 보십시오'); return null; }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(이름, r.stdout);
  console.log('✓ 폰 화면 갈무리: ' + 이름);
  console.log('  ⚠ 고객 이름·금액이 그대로 찍힙니다 — 채팅·PR 에 붙이지 마십시오.');
  return 이름;
}

/* 폰 크롬 DevTools 에 붙어 «한 번 묻고 한 번 듣는다» — 쓰는 명령은 Runtime.evaluate · Page.captureScreenshot 둘뿐 */
function cdp한번(ws주소, method, params) {
  return new Promise((ok, no) => {
    const ws = new WebSocket(ws주소);
    const t = setTimeout(() => { try { ws.close(); } catch (e) {} no(new Error('폰 크롬이 답하지 않습니다')); }, 20000);
    ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
    ws.onmessage = (ev) => {
      const m = JSON.parse(String(ev.data));
      if (m.id !== 1) return;
      clearTimeout(t); try { ws.close(); } catch (e) {}
      m.error ? no(new Error(m.error.message)) : ok(m.result);
    };
    ws.onerror = () => { clearTimeout(t); no(new Error('폰 크롬에 못 붙었습니다')); };
  });
}

async function 재기(dry) {
  if (dry) { console.log('[할 일] adb forward tcp:' + PORT + ' localabstract:chrome_devtools_remote → 푸른 탭 하나를 measure.js 로 잰다'); return; }
  const 기 = 준비(); if (!기) return;
  const f = 돌려(기.adb, ['-s', 기.serial, 'forward', 'tcp:' + PORT, 'localabstract:chrome_devtools_remote']);
  if (f.status !== 0) { console.log('✗ 폰 크롬에 길을 못 냈습니다 — 폰에서 «크롬»을 열어 두십시오'); return; }
  return 탭재기(PORT);
}

/* 길(adb forward)이 난 뒤 — 푸른 탭 하나를 잰다. 길만 다르면 PC 크롬에도 그대로 쓴다(검사·시험용) */
async function 탭재기(port) {
  let 탭들;
  try { 탭들 = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json(); }
  catch (e) { console.log('✗ 폰 크롬 탭을 못 읽었습니다 — 폰에서 크롬을 앞에 띄워 두십시오'); return; }
  const 고름 = 탭고르기(탭들);
  if (!고름.tab) { console.log('✗ 폰 크롬에 푸른 화면이 없습니다 — nabaho.github.io/pureunall 을 열어 두십시오 (다른 탭 ' + 고름.다른탭수 + '개는 안 봤습니다)'); return; }
  const ws = 고름.tab.webSocketDebuggerUrl;
  console.log('잴 화면: ' + 고름.tab.title + '  (' + 고름.tab.url + ')');
  const 자 = fs.readFileSync(MEASURE, 'utf8');
  const 식 = '(function(){' + 자 + '\n;return JSON.stringify(__paMeasure({ width: Math.min(screen.width, document.documentElement.clientWidth) }));})()';
  const r = await cdp한번(ws, 'Runtime.evaluate', { expression: 식, returnByValue: true });
  const m = JSON.parse((r && r.result && r.result.value) || '{}');
  console.log('폭 ' + m.w + 'px · 옆넘침 ' + m.overflowX + ' · 화면밖 ' + m.offscreenN + ' · 세로깨짐 ' + m.verticalN
    + ' · 짓눌림 ' + m.squeezedN + ' · 두줄단추 ' + m.wrapBtnN + ' · 작은단추 ' + m.smallTapN + ' · 작은입력 ' + m.smallInputN);
  fs.mkdirSync(OUT, { recursive: true });
  const 이름 = path.join(OUT, 사진이름(new Date()).replace('.png', '-잰것.json'));
  fs.writeFileSync(이름, JSON.stringify(m, null, 1));
  console.log('✓ 자세한 값: ' + 이름);
  const 그림 = await cdp한번(ws, 'Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (그림 && 그림.data) {
    const p = 이름.replace('-잰것.json', '-크롬.png');
    fs.writeFileSync(p, Buffer.from(그림.data, 'base64'));
    console.log('✓ 크롬 화면: ' + p);
  }
}

function 점검() {
  const v = process.versions.node.split('.').map(Number);
  console.log((v[0] >= 22 ? '✓' : '✗') + ' Node ' + process.versions.node + (v[0] >= 22 ? '' : ' — 22 이상이어야 재기(③)가 됩니다'));
  const adb = adb찾기();
  console.log(adb ? '✓ adb: ' + adb : '✗ adb 없음 — 5번(scrcpy 깔기)');
  console.log(scrcpy찾기() ? '✓ scrcpy 있음' : '✗ scrcpy 없음 — 5번(scrcpy 깔기)');
  if (adb) { const g = 기기(adb); console.log(g.ok ? '✓ 폰: ' + (g.model || g.serial) : '✗ ' + g.why); }
  console.log('? 폰 크롬에 푸른 화면이 열려 있는지는 3번(재기)을 해 봐야 압니다');
}

function 메뉴() {
  console.log('\n  푸른 폰 미러 — 폰을 USB 로 꽂고 고르십시오\n');
  console.log('   1  미러 창 켜기 (5초 뒤 저절로)');
  console.log('   2  폰 화면 갈무리');
  console.log('   3  폰 크롬 화면 재기 (읽기만)');
  console.log('   4  준비 점검');
  console.log('   5  scrcpy 깔기\n');
}

async function main() {
  const p = 계획(process.argv.slice(2));
  if (p.일 === '--menu') return 메뉴();
  if (p.일 === '--install') return 설치(p.dry);
  if (p.일 === '--check') return 점검();
  if (p.일 === '--mirror') return 미러(p.dry);
  if (p.일 === '--shot') return 갈무리(p.dry);
  if (p.일 === '--measure') return 재기(p.dry).catch((e) => console.log('✗ ' + e.message));
}

if (require.main === module) main();

module.exports = { 계획, 허용주소, adb후보, 기기읽기, 기기판정, 사진이름, 탭고르기, 탭재기 };
