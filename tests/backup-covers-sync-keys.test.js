'use strict';
/* 「다담아라」 — 서버에 올라가는 자료는 백업에도 담긴다 (대표 지시 2026-09-20)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     나스 자동백업이 돌기 시작한 날, 대표께 「지금 백업은 21개 칸만 담습니다」라고
     보고했다. **틀렸다.** `SERVER_BACKUP_KEYS` 는 담을 것을 고르는 거름망이 아니라
     「이 중 하나라도 자료가 있어야 백업할 값어치가 있다」를 보는 잣대였다.
     실제로 담기는 것은 localStorage 를 통째로 훑은 것이다.

     그런데 «진짜로» 빠진 것이 하나 있었다 — **ledger_batches(통장 묶음)**.
     서버로 실시간 공유되고 유실검사(DIFF_KEYS)까지 보는 업무 자료인데
     백업에서만 빠져 있었다. 뺀 까닭(통장 4,000행이 16MB 한 번 쓰기 한도를
     넘겼다)은 그 뒤 «행 단위로 쪼개 싣기»로 사라졌는데, 빼 둔 것만 남았다.

   ■ 못 박는 것 — 값이 아니라 «규칙» 이다
     키 이름 몇 개를 세지 않는다. 목록이 늘어도 안 깨지고, 다음에 누가
     업무 키를 백업에서 빼면 그 자리에서 걸리는 규칙만 적는다.

     ① 서버에 올라가는 키(FB_ALL_SYNC_KEYS)는 백업에서 빼지 않는다
     ② 유실검사가 보는 키(DIFF_KEYS)는 반드시 백업에 담긴다
     ③ 부팅 때 «안 받는» 키(FB_COLD_KEYS)는 백업 «직전»에 받아 온다
     ④ 비밀(SECRET_KEYS)은 여전히 안 담는다 — 이건 풀면 안 되는 매듭이다 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8');

/* 배열 꼴 선언에서 «따옴표 안의 이름»만 걷는다. 주석 속 이름이 섞이지 않게
   주석을 먼저 지운다(이 대목은 <script> 안이라 /* *\/ 와 // 둘 다 쓰인다). */
function 이름들(decl) {
  const at = SRC.indexOf(decl);
  assert.ok(at > -1, '★★ 「' + decl + '」 를 못 찾았다 — 이름이 바뀌었으면 검사도 함께 고쳐야 한다');
  const end = SRC.indexOf('];', at);
  assert.ok(end > at, '★★ 「' + decl + '」 의 끝(];)을 못 찾았다');
  const body = SRC.slice(at + decl.length, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return (body.match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
}

/* SNAP_EXCLUDE 는 객체다 — `이름:1` 꼴에서 이름만 걷는다. */
function 백업에서빼는것() {
  const fn = cutFn(SRC, 'function buildBackupSnapshot(');
  const at = fn.indexOf('SNAP_EXCLUDE');
  assert.ok(at > -1, '★★ SNAP_EXCLUDE 가 buildBackupSnapshot 안에 없다');
  const end = fn.indexOf('};', at);
  assert.ok(end > at, '★★ SNAP_EXCLUDE 의 끝을 못 찾았다');
  const body = fn.slice(at, end)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  return (body.match(/([A-Za-z_][\w]*)\s*:\s*1/g) || []).map(s => s.split(':')[0].trim());
}

test('①★★ 서버에 올라가는 자료는 백업에서 빼지 않는다', () => {
  /* 왜 이것이 규칙인가 — 서버에 있다는 것은 「여럿이 함께 쓰는 업무 자료」라는 뜻이다.
     그런 것이 백업에서 빠지면, 잃고 나서야 안 담겼다는 걸 안다.
     이 PC 안에서만 도는 것(임시본·되돌리기 기록)은 애초에 서버에도 안 올라간다 —
     그러니 「서버에 올라가는가」 하나로 갈리며, 목록을 손으로 맞출 일이 없다. */
  const 동기화 = new Set(이름들('var FB_ALL_SYNC_KEYS = ['));
  const 뺀것 = 백업에서빼는것();
  assert.ok(동기화.size > 30, '★ 동기화 목록을 제대로 못 읽었다(' + 동기화.size + '개)');
  assert.ok(뺀것.length > 0, '★ 빼는 목록을 제대로 못 읽었다');

  const 잘못뺀것 = 뺀것.filter(k => 동기화.has(k));
  assert.deepEqual(잘못뺀것, [],
    '★★ 서버에 올라가는데 백업에서 빠지는 키가 있다: ' + 잘못뺀것.join(', ') + '\n' +
    '  2026-09-20 ledger_batches 가 바로 그것이었다 — 통장 묶음이 백업에만 없었다.\n' +
    '  덩치가 걱정이면 빼지 말고 erpBackupBatches 가 «쪼개 싣게» 하라(이미 그렇게 한다).');
});

test('②★★ 유실검사가 보는 자료는 반드시 백업에 담긴다', () => {
  /* 유실검사(DIFF_KEYS)에 있다는 것은 「없어지면 큰일 난다」고 이미 판정한 자료다.
     그것이 백업에 없으면 — 없어진 것을 «알려만» 주고 되돌릴 길이 없다. */
  const 지켜보는것 = 이름들('var DIFF_KEYS = [');
  const 뺀것 = new Set(백업에서빼는것());
  assert.ok(지켜보는것.length > 10, '★ 유실검사 목록을 제대로 못 읽었다');

  const 못되돌리는것 = 지켜보는것.filter(k => 뺀것.has(k));
  assert.deepEqual(못되돌리는것, [],
    '★★ 없어지면 알려는 주는데 되돌릴 백업이 없는 키: ' + 못되돌리는것.join(', ') + '\n' +
    '  경보만 울리고 소화기가 없는 것과 같다.');
});

test('③★★ 부팅 때 «안 받는» 키는 백업 직전에 받아 온다', () => {
  /* 스냅샷은 localStorage 를 훑어 만든다. FB_COLD_KEYS 는 그 화면을 열어야 내려오므로,
     아무도 안 연 날은 통째로 빠진다 — 그리고 빠진 줄도 모른다. */
  const fn = cutFn(SRC, 'function serverBackupDaily(');
  assert.match(fn, /FB_COLD_KEYS/,
    '★★ 백업이 FB_COLD_KEYS 를 모른 채 돈다 — 그 화면을 안 연 날은 급여감사기록이 통째로 빠진다');

  const 받는곳 = fn.indexOf('erpEnsureKeys');
  const 만드는곳 = fn.indexOf('buildBackupSnapshot');
  assert.ok(받는곳 > -1, '★★ 받아 오는 부름(erpEnsureKeys)이 없다');
  assert.ok(만드는곳 === -1 || 받는곳 < 만드는곳,
    '★★ 스냅샷을 «만든 뒤»에 받아 오면 이번 백업에는 안 담긴다 — 차례가 규칙이다');

  /* 못 받아도 백업은 가야 한다 — 한 칸 때문에 백업 전부를 잃는 것이 더 나쁘다 */
  assert.match(fn.slice(받는곳), /\.catch\(/,
    '★★ 받아 오기가 실패하면 백업이 통째로 멎는다 — 반드시 흘려보내야 한다');
});

test('④★★ 비밀은 여전히 안 담는다 — 여기만은 풀면 안 된다', () => {
  /* 「다 담아라」가 열쇠까지 담으라는 뜻은 아니다. 백업은 «잃은 자료를 되찾는 것»이지
     «열쇠를 옮기는 것»이 아니다 — 담기면 그 파일을 볼 수 있는 사람이 곧 열쇠를 갖는다. */
  const fn = cutFn(SRC, 'function buildBackupSnapshot(');
  assert.match(fn, /SECRET_KEYS\.test\(/,
    '★★ 비밀 거르기가 사라졌다 — 나스에 올라간 백업 안에 NAS 비밀번호·API 열쇠가 그대로 들어간다');

  const re = SRC.match(/var SECRET_KEYS = \/([^/]+)\/i;/);
  assert.ok(re, '★★ SECRET_KEYS 를 못 찾았다');
  ['api_key', 'token', 'secret', 'password'].forEach(w => {
    assert.ok(re[1].includes(w), '★★ 거름망에서 ' + w + ' 가 빠졌다');
  });
});

/* ⑤ 는 글자를 보지 않는다 — 진짜 코드를 돌려서 «잰다».
   통장 묶음을 백업에 도로 넣은 근거가 「이제는 쪼개 싣는다」이므로,
   그 말이 정말인지 한도를 넘겨 보려 애쓰며 확인한다. */
const vm = require('node:vm');
function 나눠싣기() {
  const a = SRC.indexOf('var BACKUP_BATCH_CHARS =');
  const b = SRC.indexOf('// 스냅샷 한 벌 저장', a);
  assert.ok(a > -1 && b > a, '★★ erpBackupBatches 대목을 못 찾았다');
  const c = { console, Object, JSON, Array, String, Number, parseInt, isNaN, Math, window: {} };
  vm.createContext(c);
  vm.runInContext(SRC.slice(a, b), c);
  return c.erpBackupBatches;
}

test('⑤★★ 통장이 아무리 불어도 한 번 쓰기가 실시간DB 한도를 안 넘는다', () => {
  /* 실시간DB 는 한 번의 쓰기를 16MB 까지만 받는다. 넘으면 write_too_big —
     조용히 실패해서 「백업이 도는 줄 알았다」가 된다(실제로 났다).
     ⚠ 한도는 «글자»가 아니라 «바이트»로 센다. 통장 적요는 한글이라 한 글자가
       3바이트다 — 글자로만 재면 세 배를 놓친다. */
  const LIMIT = 16 * 1024 * 1024;
  const 싣기 = 나눠싣기();

  /* 한 묶음 = 올린 통장 파일 하나. 4,000행짜리를 20묶음 — 8만 행이다.
     실제 최대치(4,000행)보다 스무 배 크게 잡는다. */
  const 한줄 = () => ({ date: '2026-09-20', memo: '가나다라마바사아자차카타파하'.repeat(6),
                        in: 1234567, out: 0, bal: 98765432, note: '입금확인' });
  const 묶음 = (i) => ({ id: 'B' + i, at: '2026-09-' + (10 + (i % 20)),
                         rows: new Array(4000).fill(0).map(한줄) });
  const data = { ledger_batches: new Array(20).fill(0).map((_, i) => 묶음(i)) };

  const 조각들 = 싣기(data);
  assert.ok(조각들.length > 1,
    '★★ 8만 행이 한 조각에 다 들어갔다 — 쪼개기가 안 도는 것이다');

  조각들.forEach((조각, i) => {
    const 바이트 = Buffer.byteLength(JSON.stringify(조각), 'utf8');
    assert.ok(바이트 < LIMIT,
      '★★ ' + (i + 1) + '번째 조각이 ' + (바이트 / 1048576).toFixed(1) + 'MB 다 — 16MB 한도를 넘는다.\n' +
      '  이것이 넘으면 백업이 write_too_big 으로 «조용히» 실패한다.\n' +
      '  통장 묶음을 백업에 넣은 근거가 바로 이 쪼개기다 — 근거가 무너졌다.');
  });

  /* 담기긴 했는데 «못 되돌리는» 백업이 가장 나쁘다 — 묶음이 하나도 안 빠지는지 본다 */
  const 경로 = [].concat(...조각들.map(b => Object.keys(b)));
  assert.equal(경로.length, data.ledger_batches.length,
    '★★ 묶음 ' + data.ledger_batches.length + '개 중 ' + 경로.length + '개만 실렸다 — 나머지는 되돌릴 수 없다');
  assert.equal(경로.length, new Set(경로).size,
    '★★ 같은 경로가 두 조각에 있다 — 뒤 조각이 앞 조각을 덮어써 줄이 사라진다');
  경로.forEach(p => assert.ok(p.indexOf('data/ledger_batches') === 0,
    '★ 엉뚱한 경로가 섞였다: ' + p));
});

test('⑥★ 쪼개기의 «바닥»을 적어 둔다 — 묶음 하나가 한도를 넘으면 더 쪼갤 곳이 없다', () => {
  /* ⑤ 는 8만 행(실제 최대치의 스무 배)에서도 넉넉함을 보였다. 그런데 쪼개는 단위는
     «행»이 아니라 «묶음»(올린 통장 파일 하나)이다 — 배열의 한 칸이 곧 묶음이기 때문이다.
     그래서 **한 묶음 혼자서** 16MB 를 넘으면 더 쪼갤 곳이 없다.
     통장 한 파일이 그만큼 되려면 5만 행쯤 돼야 하므로 지금은 닿지 않는다.
     ⚠ 이 검사는 막는 것이 아니라 «어디가 바닥인지»를 적어 두는 것이다 —
       언젠가 닿으면, 묶음 안의 rows 를 한 겹 더 쪼개야 한다. 그때 이 글을 읽게 된다. */
  const LIMIT = 16 * 1024 * 1024;
  const 싣기 = 나눠싣기();
  const 한줄 = () => ({ d: '2026-09-20', m: '가나다라마바사아자차카타파하'.repeat(6), v: 1234567 });
  const 한묶음 = { id: 'B0', at: '2026-09-20', rows: new Array(70000).fill(0).map(한줄) };
  const 조각들 = 싣기({ ledger_batches: [한묶음] });

  const 가장큰것 = Math.max.apply(null,
    조각들.map(b => Buffer.byteLength(JSON.stringify(b), 'utf8')));
  assert.equal(조각들.length, 1, '★ 묶음이 하나면 조각도 하나다 — 이것이 바닥이라는 뜻이다');
  assert.ok(가장큰것 > LIMIT,
    '★ 한 묶음 7만 행이 이제 한도 안에 들어온다(' + (가장큰것 / 1048576).toFixed(1) + 'MB).\n' +
    '  쪼개기가 더 잘게 나뉘도록 고쳐졌다면 좋은 일이다 — 이 검사를 그에 맞게 고쳐라.');
});
