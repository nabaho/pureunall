/* 카톡정리 › 대화 내보내기 올리기 — 화면(work.html) 규칙 (2026-10-24)
   설계서: docs/superpowers/specs/2026-10-24-카톡-법인방-업무정리-design.md (3·5·6·7·10장)
   화면은 브라우저에서만 도므로 «소스에 규칙이 박혀 있는가»를 본다(kakao-work.test.js 와 같은 방식).
   ⚠ 「지금 값」이 아니라 「규칙」을 본다 — 함수 순서·금지된 호출·서버 한도와의 일치. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const W = read('work.html');

/* 새 구간 전체 — 머리 주석부터 「라우팅」 앞까지 */
const START = W.indexOf('💬 카톡정리 › 대화 내보내기 올리기');
/* 끝 표시 — 이 구간은 «성과급 구간»(var PC_PATH= ~ 라우팅) 밖이어야 한다: tests/perf-confirm-work.test.js 가 그 사이의 fbDb.ref 를 센다 */
const END = W.indexOf('/* ══ 끝: 💬 카톡정리 › 대화 내보내기 올리기');
const REGION = START > 0 && END > START ? W.slice(START, END) : '';
/* 함수 하나의 몸통 — src 안에서 */
function body(src, name) {
  const at = src.indexOf('function ' + name + '(');
  assert.ok(at >= 0, name + ' 함수가 없다');
  const next = src.indexOf('\nfunction ', at + 10);
  return src.slice(at, next < 0 ? undefined : next);
}
const fn = (name) => body(REGION, name);   /* 새 구간 안 */
const wfn = (name) => body(W, name);       /* work.html 어디든 — 탭처럼 기존 카톡 구간에 있는 것 */

test('새 구간이 있고, 내보내기 읽기 스크립트가 카톡 셈 «뒤»에 실려 있다', () => {
  assert.ok(REGION.length > 500, '대화 내보내기 올리기 구간이 없다');
  const pc = W.indexOf('var PC_PATH='), route = W.indexOf('/* ── 라우팅 ── */', pc);
  assert.ok(pc > 0 && !(START > pc && START < route), '새 구간이 성과급 구간(var PC_PATH= ~ 라우팅) 안에 있다 — 성과급 검사가 fbDb.ref 를 센다');
  const a = W.indexOf('<script src="js/pu-kakao-work.js');
  const b = W.search(/<script src="js\/pu-kakao-export\.js\?v=\d+"><\/script>/);
  assert.ok(a > 0 && b > a, 'pu-kakao-export.js 가 pu-kakao-work.js 뒤에 없다');
});

test('탭이 둘(알림·내보내기 올리기)이고, 새 탭은 기존 카톡정리 안(총괄관리자 확인 뒤)에만 있다', () => {
  assert.match(wfn('kkTabsHTML'), /\['alert','알림'\]/);
  assert.match(wfn('kkTabsHTML'), /\['export','대화 내보내기 올리기'\]/);
  assert.match(wfn('kkTab'), /KK\.tab=t/);
  assert.match(W, /function renderKakao\(\)\{[\s\S]{0,400}KK\.tab==='export'/);
  assert.match(W, /id="nav-kakao" style="display:none"/, '메뉴가 기본 숨김이 아니다');
  assert.ok(!/id="nav-kx/.test(W), '새 메뉴를 따로 만들었다 — 총괄관리자 확인이 비켜 간다');
});

test('방 확인이 «읽기보다 앞»이고, 목록 밖이면 거기서 돌아간다 — 개인 대화방 파일이 섞이지 않게', () => {
  const f = fn('kxLoad');
  const room = f.indexOf('roomAllowed');
  const group = f.indexOf('groupMessages(');
  assert.ok(room > 0 && group > room, '방 확인이 묶기보다 뒤에 있다');
  assert.match(f.slice(room, group), /return/, '목록 밖인데도 아래로 흘러간다');
  assert.match(f.slice(0, room), /parseExport\(/, '머리글만 읽어 방을 확인하는 줄이 없다');
  assert.ok(f.indexOf('parseExport(') < group);
});

test('가리개 두 겹(maskSensitive + 주민번호 지우개)을 걸고, 지우개가 없으면 읽기 전에 멈춘다', () => {
  const f = fn('kxLoad');
  assert.match(f, /maskMessages\(/);
  assert.match(f, /maskSensitive/);
  assert.match(f, /maskRrnInText/);
  const guard = f.search(/!M\s*\|\|\s*!M\.maskRrnInText/);
  assert.ok(guard >= 0, '지우개가 없을 때 막는 줄이 없다');
  assert.ok(guard < f.indexOf('parseExport('), '지우개 확인이 읽기보다 뒤에 있다');
});

test('저장 순서: 원문 30일 보관(서버)이 먼저, 진행 기록은 그 «뒤» — 서버 쓰기는 한 곳에서만', () => {
  const f = fn('kxApply');
  const raw = f.indexOf('kxImportRaw(');
  const log = f.indexOf('kxWriteLogs(');
  assert.ok(raw > 0 && log > raw, '진행 기록이 원문 보관보다 앞서거나 없다');
  assert.ok(f.indexOf('confirmM(') > 0 && f.indexOf('confirmM(') < raw, '건수를 묻기 전에 서버로 보낸다');
  assert.ok(!/kakaoImport/.test(f), '서버 호출이 kxApply 안에 흩어져 있다');
  assert.match(fn('kxImportRaw'), /kkCall\('kakaoImport'/);
  const writers = REGION.split('\n').filter((l) => /\.update\(/.test(l) && !/^\s*(\/\*|\*|\/\/)/.test(l));
  assert.ok(writers.length >= 1, '진행 기록을 쓰는 update 가 없다');
  assert.ok(fn('kxWriteLogs').includes('.update('), '진행 기록 쓰기가 kxWriteLogs 밖에 있다');
  assert.strictEqual(REGION.split('.update(').length - 1, fn('kxWriteLogs').split('.update(').length - 1, 'kxWriteLogs 밖에도 update 가 있다');
});

test('진행 기록: lid 열쇠로, 두 자리(logs·itemlogs)를 한 번의 update 로, 기존 줄은 덮어쓰거나 지우지 않는다', () => {
  const f = fn('kxWriteLogs');
  assert.match(fn('kxStatus'), /logId\(/, '줄 열쇠를 내용에서 만들지 않는다');
  assert.match(f, /r\.lid/, '그 열쇠로 쓰지 않는다');
  assert.match(f, /'\/logs\/'/);
  assert.match(f, /'\/itemlogs\/'/);
  assert.strictEqual(f.split('.update(').length - 1, 1, '한 번의 update 가 아니다 — 반쯤 하다 멈출 수 있다');
  assert.ok(!/\.(remove|set)\(/.test(REGION), '기존 줄을 덮거나 지우는 호출이 있다');
  assert.match(f, /k:'kt'/);
  assert.match(fn('kxStatus'), /same/);
  assert.match(fn('kxStatus'), /more/);
});

test('원문 나눠 보내는 크기가 서버 한도를 넘지 않는다', () => {
  const client = Number(/var KX_CHUNK\s*=\s*(\d+)/.exec(REGION)[1]);
  const server = Number(/const IMPORT_ITEMS_MAX\s*=\s*(\d+)/.exec(read('functions/kakao-work-server.js'))[1]);
  assert.ok(client > 0 && client <= server, `화면 ${client} > 서버 ${server} — 넘친 글이 조용히 버려진다`);
});

test('표: ☐ 고르기 칸 + 번호가 맨 왼쪽, 번호는 보는 번호(저장하지 않음), 폰에서는 카드로 편다', () => {
  const f = fn('kxHTML') + fn('kxRowHTML');
  assert.match(f, /<th class="kkfit"><input type="checkbox" onclick="kxPickAll\(/);
  assert.match(f, /<th class="kkfit">번호<\/th>/);
  assert.match(fn('kxRowHTML'), /\(i\+1\)/);
  assert.ok(!/localStorage|\.update\(|\.set\(/.test(fn('kxRowHTML')), '번호·고르기를 저장한다');
  /* .kxt 를 다루는 «폰 구간» 블록을 괄호로 정확히 자른다 */
  const from = W.indexOf('.kxt');
  const m = /@media \(max-width:\d+px\)\s*\{/.exec(W.slice(from));
  assert.ok(m, '폰 구간이 없다');
  let i = from + m.index + m[0].length, depth = 1;
  while (i < W.length && depth > 0) { depth += W[i] === '{' ? 1 : W[i] === '}' ? -1 : 0; i++; }
  const phone = W.slice(from + m.index, i);
  assert.match(phone, /\.kxt/, '폰 구간이 이 표를 다루지 않는다');
  assert.match(phone, /font-size:16px/, '폰 입력칸 16px 이 없다');
  assert.match(phone, /display:flex/, '폰에서 줄을 카드로 펴지 않는다');
});

test('업체명·이름으로 업체·업무를 채우지 않는다 — 새 업무 창은 사건번호만 넣고 저장은 사람이 한다', () => {
  assert.ok(!/co_id/.test(REGION.replace(/it\.co_id/g, '')), '업체 id 를 이름으로 채우는 코드가 있다');
  const f = fn('kxTask');
  assert.match(f, /itemModal\(\)/);
  assert.ok(!/saveItem\(|if-co|if-client/.test(f), '새 업무 창이 업체 칸을 채우거나 저장한다');
});

test('서버가 새 동작을 모를 때(배포 전) 아무것도 저장하지 않는다고 말한다', () => {
  assert.match(fn('kxApply'), /아무것도 저장하지 않/);
});

test('탭·화면을 떠나면 읽은 내용을 버린다', () => {
  assert.match(wfn('kkTab'), /kxReset\(\)/);
  assert.match(W, /kkNav\(\);[^\n]*[\s\S]{0,200}?kxReset\(\)|if\(S\.view!=='kakao'\)\s*kxReset\(\)/);
});

/* ── 독립 검토 지적(2026-10-24) ─────────────────────────────────────── */
test('지운 카톡 줄은 다음 올리기에서 되살아나지 않는다 — 지울 때 표식을 남기고, 올리기가 그 표식을 본다', () => {
  const del = wfn('_delLog');
  assert.match(del, /l\.k==='kt'/, '카톡 줄을 지울 때 표식을 남기지 않는다');
  assert.match(del, /'\/kxoff\/'\+itemId\+'\/'\+lid/, '표식 자리가 다르다');
  assert.ok(del.indexOf('/kxoff/') < del.indexOf('.update('), '표식이 지우기와 «같은 쓰기»에 있지 않다(반쯤 하다 멈출 수 있다)');
  assert.match(fn('kxLogsOf'), /\/kxoff\//, '올리기가 표식을 읽지 않는다');
  const st = fn('kxStatus');
  assert.match(st, /gone/);
  assert.ok(st.indexOf("'gone'") < st.indexOf("'more'"), '표식 확인이 새 줄/보강 판정보다 뒤에 있다');
  assert.ok(!/gone/.test(fn('kxElig').replace(/\s/g, '')) || /new.*more/.test(fn('kxElig')), '지운 줄이 고를 수 있는 줄로 남는다');
  assert.match(fn('kxRowHTML'), /지운 줄/, '지운 줄을 화면이 말하지 않는다');
});

test('새 업무 창으로 만든 업무(번호가 업무명에 있다)도 다음 올리기에서 같은 번호로 맞는다', () => {
  assert.match(fn('kxItems'), /extractCaseNos\(it\.title/, '업무명에 적은 사건번호를 안 본다 — 다음 주 같은 번호가 또 «없는 번호»가 된다');
});

test('보낼 글이 0건이어도 서버 확인을 건너뛰지 않는다(배포 전엔 아무것도 저장하지 않는다)', () => {
  assert.match(fn('kxImportRaw'), /if\(!chunks\.length\)\s*chunks\.push\(\[\]\)/, '0건이면 서버를 안 부른다');
});

/* ── 알림 목록의 쌍둥이 ─────────────────────────────────────────────── */
test('알림 탭: 같은 글이 알림·내보내기 양쪽에 있으면 알림 쪽을 숨기고(목록과 옵시디언 일지 모두), 원본 배열은 건드리지 않는다', () => {
  assert.match(wfn('kkItems'), /dropAlertTwins\(KK\.items\)/);
  assert.match(wfn('kkRows'), /groupBursts\(kkItems\(\)\)/, '쌍둥이를 거르기 전의 KK.items 를 묶는다');
  assert.match(wfn('kkObsRun'), /groupBursts\(kkItems\(\)\)/, '옵시디언 일지에는 쌍둥이가 그대로 들어간다');
  assert.ok(!/groupBursts\(KK\.items\)/.test(W), 'KK.items 를 바로 묶는 곳이 남았다');
});

/* ── 첨부 파일 복사 ─────────────────────────────────────────────────── */
test('파일: 복사만 한다 — 지우거나 옮기는 호출이 없고, 쓰기 전에 같은 이름이 있는지 먼저 본다', () => {
  assert.ok(!/removeEntry|\.remove\(|\.move\(/.test(REGION), '원본을 지우거나 옮기는 호출이 있다');
  const f = fn('kxCopyOne');
  const exist = f.indexOf('getFileHandle(outName)');
  const create = f.indexOf('create:true', exist);
  assert.ok(exist > 0 && create > exist, '쓰기(create) 전에 같은 이름을 확인하지 않는다');
  assert.match(f, /skipped/, '이미 있으면 건너뛰지 않는다');
  assert.match(f, /NotFoundError/, '없음과 다른 오류를 구분하지 않는다');
});

test('파일: 폴더·파일 이름은 safeName 을 거치고, 폴더 고르기가 안 되는 브라우저는 막고 안내한다', () => {
  assert.match(fn('kxCopyOne'), /safeName\(f\.folder\)/);
  assert.match(fn('kxCopyOne'), /safeName\(f\.day/);
  for (const name of ['kxPickDir', 'kxCopyFiles']) {
    assert.match(fn(name), /typeof window\.showDirectoryPicker\s*!==\s*'function'/, name + ' 에 지원 확인이 없다');
  }
});

test('파일: 대화에 이름이 있는 파일만 목록에 오르고(matchFiles), 민감 의심은 기본 해제, 만료 D-N 을 보인다', () => {
  const f = fn('kxFilesBuild');
  assert.match(f, /matchFiles\(/);
  assert.match(f, /isSensitiveName\(/);
  assert.match(f, /attachmentExpiry\(/);
  assert.match(f, /on:\s*!!m\.found\s*&&\s*!sens/, '찾았고 민감하지 않을 때만 기본 체크여야 한다');
  const h = fn('kxFilesHTML') + fn('kxFileRowHTML');
  assert.match(h, /<th class="kkfit"><input type="checkbox" onclick="kxFilePickAll\(/);
  assert.match(h, /<th class="kkfit">번호<\/th>/);
  assert.match(fn('kxFileRowHTML'), /\(i\+1\)/);
  assert.match(h, /민감 의심/);
  assert.match(h, /못 받음/);
});

test('파일: 고르기·번호는 저장하지 않고, 서버로 올리는 호출이 없다(파일은 서버로 안 간다)', () => {
  const f = fn('kxFilesBuild') + fn('kxFileRowHTML') + fn('kxFilesHTML') + fn('kxCopyFiles') + fn('kxCopyOne');
  assert.ok(!/localStorage|\.update\(|\.put\(|uploadBytes|storage\(\)|kkCall\(/.test(f), '파일 복사가 서버·저장소를 건드린다');
});

