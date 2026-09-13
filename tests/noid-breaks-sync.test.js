'use strict';
/* id 없는 기록 한 건이 그 표의 동기화를 통째로 망가뜨린다 — 조용히 넘어가지 않는다
   (대표 지시 2026-09-12 「화면이 자주 멈춘다 문제가 뭔지 정확하게 확인하고 고쳐달라」)

   ■ 실측 (2026-09-12 · 운영 자료)
     자문수입 1,860건 가운데 «되돌리기 찌꺼기» 한 건에 id 가 없었다
     (칸이 undoneBy·undoneDate·updatedAt·updatedBy 넷뿐 · 금액도 날짜도 없음 · 2026-08-13).
     그 한 건 때문에:
       · dbSet 의 안전 병합(_canMerge)이 늘 꺼진다 → 병합 트랜잭션이 매번 중단
       · arrayToIdMap 변환이 안 되어 서버가 «배열»로 남는다
       · _fbObjForm 이 false 라 «칸별 저장»이 영영 안 켜진다
     → 자문수입을 한 번 고칠 때마다 1MB 를 통째로 주고받았다. 화면이 멈추던 까닭이다.
     다른 여섯 표(계약·사건·컨설팅·업체·출금·급여)는 모두 객체형으로 잘 돌고 있었다.

   ■ 이 검사가 지키는 것
     ① 「모든 항목에 id 가 있을 때만」이라는 문턱이 그대로 있다 (이것을 풀면 자료가 샌다)
     ② 그 문턱에 걸렸을 때 «말한다» — 조용히 느려지지 않는다
     ③ 새 기록은 id 없이 못 들어간다 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const bare = stripComments(src);

test('① ★★ 「모두 id 가 있을 때만 병합」 문턱이 그대로다', function () {
  const 저장 = stripComments('<script>' + cutFn(src, 'function dbSet(') + '</script>');
  assert.match(저장, /_canMerge\s*=[\s\S]{0,220}every\(function\s*\(x\)\s*\{\s*return x && x\.id;/,
    '★★ 병합 전 「모두 id 가 있나」를 안 봅니다 — id 없는 항목이 병합에서 사라집니다');
  assert.match(저장, /if\(!curArr\.every\(function\(x\)\{ return x && x\.id; \}\)\) return;/,
    '★★ 트랜잭션 안의 문턱이 사라졌습니다 — 서버의 id 없는 항목이 지워질 수 있습니다');
  /* 칸별 저장으로 바뀌는 조건도 같은 잣대여야 한다 */
  assert.match(저장, /arrayToIdMap\(merged\)\s*:\s*merged/,
    '★ 객체형 변환 자리가 바뀌었습니다 — 칸별 저장이 언제 켜지는지가 달라집니다');
});

test('② ★★ 문턱에 걸리면 «말한다» — 조용히 느려지지 않는다', function () {
  /* 자기점검 구역만 잘라 본다 — 파일 전체로 찾으면 딴 곳의 글자에 걸린다 */
  const from = bare.indexOf('var CHECK=[');
  const to = bare.indexOf('지난 접속 대비 급감', from) >= 0
    ? bare.indexOf('지난 접속 대비 급감', from) : from + 4000;
  const 구역 = bare.slice(from, to);
  assert.ok(from > 0, '자기점검 구역을 못 찾았습니다');
  assert.match(구역, /_noId/, '★★ id 없는 기록을 세지 않습니다');
  /* ⚠ 바로 위 «중복» 점검도 erpAlert 를 부른다 — 구역 전체에서 찾으면 내 것을
     통째로 빼도 통과한다(2026-09-12 되돌림 검사에서 드러났다).
     «id 없음을 센 자리부터» 잘라 보고, 그 말이 함께 있는지까지 본다. */
  const 센자리 = 구역.indexOf('var _hasId = 0, _noId = 0;');
  assert.ok(센자리 > 0, 'id 없음 점검을 못 찾았습니다');
  const 말하는곳 = 구역.slice(센자리, 센자리 + 900);
  assert.match(말하는곳, /erpAlert\([^)]*id 없는 기록/,
    '★★ 세어 놓고 말하지 않습니다 — 조용한 고장이 그대로 남습니다');
  assert.match(말하는곳, /_noId/, '★ 몇 건인지 안 알려 줍니다');
  assert.match(bare, /id 없는 기록/, '★ 사람이 읽을 말이 없습니다');
  assert.match(bare, /통째로» 주고받고 있습니다|통째로.{0,4}주고받고/,
    '★ 무엇이 문제인지(통째 저장) 안 알려 줍니다');
});

test('②-2 ★★ «섞였을 때»만 말한다 — 열쇠가 sid 인 표에 헛경보를 울리지 않는다', function () {
  /* 실측 2026-09-12: 직원계정 32건은 «전부» id 가 없다 — 그 표는 sid 를 열쇠로 쓴다.
     고장이 아니라 생김새다. 「하나라도 없으면 알림」으로 두었더니 32건이 떠서
     고칠 것이 없는데 고치라고 안내했다. 틀린 안내는 없느니만 못하다.
     진짜 고장의 모양은 «섞임»이다(자문수입 1,859 + 1). */
  const from = bare.indexOf('var _hasId = 0, _noId = 0;');
  assert.ok(from > 0, '★ id 있음/없음을 «함께» 세지 않습니다 — 섞였는지 알 수 없습니다');
  const 구역 = bare.slice(from, from + 800);
  assert.match(구역, /if\(_noId > 0 && _hasId > 0\)/,
    '★★ 섞이지 않은 표(열쇠가 sid 인 직원계정 등)에도 알림이 뜹니다 — 헛경보입니다');
  assert.match(구역, /_hasId/, '★ 나머지 몇 건에 id 가 있는지 안 알려 줍니다');
});

test('③ ★ 자동으로 지우지 않는다 — 돈이 걸린 자료다', function () {
  const from = bare.indexOf('var _hasId = 0, _noId = 0;');
  assert.ok(from > 0, 'id 없음 점검을 못 찾았습니다');
  const 구역 = bare.slice(from, from + 700);
  assert.ok(!/dbSet\(|filter\(function\(x\)\{ return x && x\.id/.test(구역),
    '★★ 돈이 걸린 기록을 말없이 지웁니다 — 세고 말하기만 해야 합니다');
});

test('④ ★ 새 기록은 id 없이 못 들어간다', function () {
  const up = stripComments('<script>' + cutFn(src, 'function dbUpsert(') + '</script>');
  const pa = stripComments('<script>' + cutFn(src, 'function dbPatch(') + '</script>');
  assert.match(up, /typeof item\.id !== 'string' \|\| !item\.id/, '★★ dbUpsert 가 id 없는 항목을 받습니다');
  assert.match(pa, /typeof id !== 'string' \|\| !id/, '★★ dbPatch 가 빈 id 를 받습니다');
  assert.match(pa, /대상 없음/, '★ 없는 id 를 고치라 하면 새로 만들어 버립니다');
});

/* ── 2026-09-13 대표 제보 「어떻게 해결해야하나 반복된다」 ──────────────────
   ②의 알림은 잘 떴다. 그런데 딸린 안내가 «데이터 관리로 가라»였고, 그 자리에는
   id 를 고칠 것이 아무것도 없었다. 가 봐도 할 일이 없으니 대표는 켤 때마다 같은
   알림을 다시 봤다 — 「반복된다」는 말이 그 뜻이다.
   ★ 실측(2026-09-13): 서버 data/finance_income 은 이미 1,785건 «전부 id 있음·객체형»
     이었다. 껍데기는 «이 기기 사본»에만 남아 있었다. 즉 그때 할 일은 「자료를 고치기」
     가 아니라 「사본을 서버 것으로 갈아 끼우기」 하나였는데, 안내는 그 말을 안 했다.
   그래서 셋을 못 박는다:
     ⑥ 알림이 «누를 것»을 함께 준다 (글자로만 가리키지 않는다)
     ⑦ 서버 모양을 보고 안내를 «가른다» (할 일 없는 곳으로 보내지 않는다)
     ⑧ 안내가 «가리킨 화면»에 그 단추가 실제로 있다

   ⚠★ ⑧ 은 고치는 도중 내가 «또» 밟아서 넣었다. 새 안내에 「데이터 관리로 가라」고
     적었는데, 그 단추는 「JSON 수동 백업」 안에 있었다 — 고치면서 같은 고장을 다시
     만든 것이다. 사람 눈으로는 두 번 다 놓쳤다. 그래서 기계가 맞춰 보게 한다. */

test('⑥ ★★ 알림이 «누를 것»을 함께 준다 — 글자로만 가리키지 않는다', function () {
  const from = bare.indexOf('window.erpAlert=function(');
  assert.ok(from > 0, 'erpAlert 를 못 찾았습니다');
  const to = bare.indexOf('window.erpAlerts=function(', from);
  const 알림 = bare.slice(from, to > from ? to : from + 3000);
  assert.match(알림, /window\.erpAlert=function\(level, title, detail, advice, action\)/,
    '★★ 알림이 «할 일»을 받지 못합니다 — 안내는 늘 글자뿐이 됩니다');
  assert.match(알림, /typeof action\.run\s*===\s*'function'/,
    '★★ 건네받은 할 일을 확인하지 않습니다');
  assert.match(알림, /onclick\s*=\s*function\(\)\{[^}]{0,60}action\.run\(\)/,
    '★★ 단추가 아무 일도 안 합니다 — 모양만 있습니다');
  assert.match(알림, /appendChild\(act\)/, '★★ 만든 단추를 화면에 안 붙입니다');
  assert.match(알림, /appendChild\(btn\)/, '★ 닫기 단추가 사라졌습니다');
  /* ⚠ 알림 기록은 글자만 남는다 — 함수를 넣으면 JSON 으로 못 남고 조용히 깨진다 */
  const 기록 = 알림.slice(알림.indexOf('logAlert('), 알림.indexOf('logAlert(') + 120);
  assert.ok(!/action/.test(기록), '★★ 알림 기록에 함수를 넣습니다 — 저장이 조용히 깨집니다');
});

test('⑦ ★★ 모르는 것을 아는 척하지 않는다 — 대신 «해 볼 수 있는 단추»를 준다', function () {
  /* ⚠⚠ 2026-09-13 하루에 «같은 실수를 세 번» 했다. 이것이 세 번째다.
       ㉠ 안내가 할 일 없는 화면을 가리켰다(데이터 관리)
       ㉡ 고치면서 또 틀린 화면을 가리켰다(역시 데이터 관리) → 검사 ⑧ 이 생겼다
       ㉢ 「서버가 깨끗한지」를 window._fbObjForm 으로 판단했다 — 그 이름은 «함수 안»에
          선언돼 있어 window 에는 없다. 늘 undefined 라 «늘» 「서버에도 껍데기가 있다」로
          떨어졌다. 실제 서버는 1,785건 전부 id 가 있는 객체형이었다(실측).
          틀린 말을 하면서, 단추도 안 줬다.
     ★ 배운 것: 이 점검은 «이 기기 사본»만 센다. 서버가 어떤지는 여기서 알 수 없다.
       알 수 없는 것은 말하지 않는다. 대신 어느 쪽이든 안전한 «해 볼 일»을 준다 —
       사본을 서버 것으로 갈아 끼워 보는 것. 서버도 같으면 알림이 다시 뜰 뿐이다. */
  const from = bare.indexOf('var _hasId = 0, _noId = 0;');
  assert.ok(from > 0, 'id 없음 점검을 못 찾았습니다');
  const end = bare.indexOf("prev[k]==='number'", from);
  const 구역 = bare.slice(from, end > from ? end : from + 2000);

  assert.match(구역, /label:\s*'[^']*다시 받기'/,
    '★★ 누를 단추를 안 건넵니다 — 다시 글자로만 가리키게 됩니다');
  assert.match(구역, /run:\s*function\(\)\{[^}]{0,80}erpPullFromServer\(\)/,
    '★★ 단추가 사본을 갈아 끼우지 않습니다');

  /* ⚠ 함수 안 이름을 window 에서 찾으면 «늘 undefined» 다 — 늘 틀린 쪽으로 안내한다 */
  assert.ok(!/window\._fbObjForm/.test(구역),
    '★★ window._fbObjForm 로 서버 상태를 판단합니다. 그 이름은 «함수 안»에 선언돼 있어\n' +
    '   window 에는 없습니다(늘 undefined) — 그래서 «늘» 한쪽으로만 안내하게 됩니다.');
  assert.ok(!/서버 자료는 이미 깨끗합니다|서버 자료에도 껍데기가 남아 있습니다/.test(구역),
    '★★ 서버가 어떤지 «단정»합니다. 이 점검은 이 기기 사본(localStorage)만 셉니다 —\n' +
    '   서버 상태는 여기서 알 수 없습니다. 알 수 없는 것을 말하면 안 됩니다.');
});

test('⑦-2 ★★ 자기점검이 «window 에 없는 이름»을 window 에서 찾지 않는다', function () {
  /* ⑦㉢ 을 기계로 막는다. 부팅 점검은 한 번 틀리면 «늘» 틀리므로 값이 비싸다.
     규칙: 자기점검이 window.X 로 읽는 이름은, 어딘가에서 window.X 로 «놓인» 것이어야 한다.
     파일 어딘가에 var X 가 있을 뿐이면 그것은 그 함수 안의 이름이지 window 의 것이 아니다. */
  const from = bare.indexOf("var CHECK=['companies'");
  assert.ok(from > 0, '자기점검 구역을 못 찾았습니다');
  const end = bare.indexOf('localStorage.setItem(SNAPK', from);
  const 구역 = bare.slice(from, end > from ? end : from + 6000);

  const 읽는이름 = [];
  const re = /window\.([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(구역))) { if (읽는이름.indexOf(m[1]) < 0) 읽는이름.push(m[1]); }
  assert.ok(읽는이름.length > 0, '★ window 에서 읽는 이름이 하나도 없습니다 — 구역을 잘못 잘랐습니다');

  const 없는것 = 읽는이름.filter(function (n) {
    /* 어딘가에서 window 에 «놓아 준» 적이 있으면 참된 전역이다 */
    return bare.indexOf('window.' + n + ' =') < 0 && bare.indexOf('window.' + n + '=') < 0;
  });
  assert.deepStrictEqual(없는것, [],
    '★★ 자기점검이 window 에 «없는» 이름을 읽습니다: ' + 없는것.join(', ') + '\n' +
    '   파일에 var 로 있더라도 함수 안이면 window 에는 없습니다 — 늘 undefined 로 읽혀\n' +
    '   부팅 점검이 «늘» 같은 쪽으로 틀립니다. window.X = … 로 내놓거나, 읽지 마세요.');
});

test('⑧ ★★ 안내가 가리킨 화면에 그 단추가 «실제로» 있다', function () {
  /* 이 PR 이 고친 고장의 본체가 바로 이것이다 — 안내는 또렷한데 그 자리에 할 일이 없었다.
     사람이 눈으로 맞춰 보면 두 번 다 놓친다(실제로 놓쳤다). 기계가 맞춘다:
       ㉠ 「서버에서 다시 받기」 단추가 «어느 구역 함수» 안에 있나
       ㉡ 그 구역이 환경설정의 «어느 갈피»에 달렸나
       ㉢ 자기점검 안내가 그 갈피 이름을 부르고 있나 */
  const 단추자리 = src.indexOf('if(window.erpPullFromServer) window.erpPullFromServer();');
  assert.ok(단추자리 > 0, '★ 「서버에서 다시 받기」 단추를 못 찾았습니다');

  /* ㉠ 그 앞의 «맨 왼쪽» 함수가 감싼 구역이다 (안쪽 도우미 함수에 속지 않게 줄머리만 본다) */
  const 앞 = src.slice(0, 단추자리);
  const 구역들 = 앞.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/gm) || [];
  assert.ok(구역들.length > 0, '★ 단추를 감싼 구역 함수를 못 찾았습니다');
  const 구역이름 = /^function\s+([A-Za-z_$][\w$]*)\s*\(/.exec(구역들[구역들.length - 1])[1];

  /* ㉡ 그 구역이 달린 갈피 이름 */
  const 갈피 = new RegExp("label:'([^']+)'[^}]*comp:\\s*" + 구역이름 + "\\b").exec(src);
  assert.ok(갈피, '★★ 「' + 구역이름 + '」 구역이 환경설정 갈피에 안 달렸습니다');
  const 씻기 = function (s) { return String(s).replace(/[^가-힣A-Za-z0-9]/g, ''); };

  /* ㉢ 안내가 그 갈피를 부르는가 — 이모지·화살표·띄어쓰기는 걷고 «이름»만 견준다 */
  const from = bare.indexOf('var _hasId = 0, _noId = 0;');
  const end = bare.indexOf("prev[k]==='number'", from);
  const 안내 = bare.slice(from, end > from ? end : from + 2000);
  assert.ok(씻기(안내).indexOf(씻기(갈피[1])) >= 0,
    '★★ 안내가 「' + 갈피[1] + '」 아닌 곳을 가리킵니다 — 가 봐도 누를 것이 없습니다');
});

test('⑤ ★ 중복 점검은 그대로 — 두 점검이 같은 자리에 나란히 있다', function () {
  const from = bare.indexOf('var CHECK=[');
  const 구역 = bare.slice(from, from + 4500);
  /* ⚠ 「글자가 있나」만 보면 그 줄을 죽여도 통과한다 — «일하는 줄»을 본다 */
  assert.match(구역, /if\(dup>0\)\{/, '★★ 중복을 찾아 놓고 아무것도 안 합니다');
  assert.match(구역, /dbSet\(k, _cl\)/, '★★ 중복을 걷어내지 않습니다');
  assert.ok(구역.indexOf('if(dup>0){') < 구역.indexOf('var _hasId = 0, _noId = 0;'),
    '★ 점검 차례가 뒤바뀌었습니다 — 중복을 먼저 걷어야 id 없음이 정확히 세어집니다');
});
