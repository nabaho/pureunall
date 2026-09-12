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

test('⑤ ★ 중복 점검은 그대로 — 두 점검이 같은 자리에 나란히 있다', function () {
  const from = bare.indexOf('var CHECK=[');
  const 구역 = bare.slice(from, from + 4500);
  /* ⚠ 「글자가 있나」만 보면 그 줄을 죽여도 통과한다 — «일하는 줄»을 본다 */
  assert.match(구역, /if\(dup>0\)\{/, '★★ 중복을 찾아 놓고 아무것도 안 합니다');
  assert.match(구역, /dbSet\(k, _cl\)/, '★★ 중복을 걷어내지 않습니다');
  assert.ok(구역.indexOf('if(dup>0){') < 구역.indexOf('var _hasId = 0, _noId = 0;'),
    '★ 점검 차례가 뒤바뀌었습니다 — 중복을 먼저 걷어야 id 없음이 정확히 세어집니다');
});
