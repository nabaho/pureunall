'use strict';
/* 서버에 «칸만» 보낼 때는 id 를 «늘» 함께 보낸다 — 껍데기를 만들지 않는다
   (대표 제보 2026-09-14 「자꾸 이것 나온다. 근본적으로 안 나오게 고칠 수 없나」)

   ■ 무엇이 있었나
     레코드 한 칸을 고치는 길(dbPatch)은 서버에 «칸 하나»씩 보낸다 —
     `data/{표}/v/{id}/{칸}`. 그런데 실시간DB 의 update 는 «없는 자리에 쓰면 만들어 준다».
     그래서 이 기기에는 있고 서버에는 없는 기록에 칸을 쓰면, 서버에 그 칸들만 든
     «껍데기»가 생긴다 — 본문에 id 가 없다. 지도 열쇠에는 id 가 있지만
     배열로 펼 때(normalizeFbValue) 열쇠는 버려진다.

   ■ ★★ 실측 2026-09-14 (운영 자료)
     자문수입 1,984건 가운데 껍데기 5건. 칸이 undoneBy·undoneDate·updatedAt·updatedBy
     넷뿐이고 모두 2026-08-13 16:19:07 — 입금확정 되돌리기 한 묶음이 남긴 것이다.

   ■ 그 한 건이 무엇을 망가뜨리나
     id 없는 항목이 하나라도 있으면 안전 병합(_canMerge)과 객체형 변환이 꺼진다.
     그 표는 영영 «통째 저장»이 되어 한 번 고칠 때마다 1MB 를 주고받는다.
     「화면이 멈춘다」와 「id 없는 기록」 알림이 되풀이된 뿌리가 이것이다.

   ■ 왜 아무도 못 봤나
     고치는 길 다섯(dbUpsert·dbPatch·dbRemove·dbUpsertMany·묶음삭제) 가운데
     **dbPatch 하나만** 이 그물이 없었다. 나머지는 id 를 함께 보내거나 통째/삭제다.
     그래서 이 검사는 «한 자리»가 아니라 «칸 단위로 보내는 모든 자리»를 본다. */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const { stripComments } = require('./strip-comments');

const R = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(R, 'pu-erp.html'), 'utf8').replace(/\r\n/g, '\n');
const bare = stripComments(src);

test('① ★★★ dbPatch 가 id 를 «함께» 보낸다 — 이 한 줄이 껍데기를 막는다', function () {
  const 고침 = stripComments('<script>' + cutFn(src, 'function dbPatch(') + '</script>');
  assert.match(고침, /cp\[id\s*\+\s*'\/id'\]\s*=\s*id;/,
    '★★★ 칸만 보내고 id 를 안 보냅니다 — 서버에 없던 기록에 쓰면 «id 없는 껍데기»가 생기고,\n' +
    '   그 한 건이 그 표 전체를 「통째 저장」으로 떨어뜨립니다(화면이 멈추는 원인).');
  /* 보내는 자리 바로 그 묶음에 들어가야 한다 — 딴 데 적어 두면 안 나간다 */
  const at = 고침.indexOf('_recServerWrite(k, cp)');
  assert.ok(at > 0, '★ 보내는 자리를 못 찾았습니다');
  assert.ok(고침.indexOf("cp[id+'/id'] = id;") < at,
    '★★ id 를 «보낸 뒤»에 넣습니다 — 그 묶음에는 안 실립니다');
});

test('② ★★ dbUpsert 쪽 그물은 그대로 — 되돌아가지 않게', function () {
  const 길 = stripComments('<script>' + cutFn(src, 'function _recFieldPaths(') + '</script>');
  assert.match(길, /out\[item\.id \+ '\/id'\] = item\.id;/,
    '★★ 원래 있던 그물이 사라졌습니다 — 이쪽으로도 껍데기가 생깁니다');
});

test('③ ★★★ «칸 단위로» 보내는 자리는 «모두» id 를 함께 보낸다', function () {
  /* 한 자리만 못 박으면 여섯 번째 길이 생길 때 또 같은 일이 난다.
     칸 단위 경로({id}/{칸})를 만드는 함수를 «모두» 찾아, 그 안에 id 줄이 있는지 본다. */
  const 조각 = bare.split(/\nfunction /);
  const 빠진것 = [];
  조각.forEach(function (본문) {
    const 이름 = (/^([A-Za-z_$][\w$]*)\s*\(/.exec(본문) || [])[1];
    if (!이름) return;
    /* 칸 단위 경로를 만드는가 — [something + '/' + field] 꼴 */
    const 칸단위 = /\[\s*(id|item\.id)\s*\+\s*'\/'\s*\+/.test(본문);
    if (!칸단위) return;
    const id줄 = /\+\s*'\/id'\s*\]\s*=\s*(id|item\.id)/.test(본문);
    if (!id줄) 빠진것.push(이름);
  });
  assert.deepStrictEqual(빠진것, [],
    '★★★ 칸만 보내면서 id 를 안 보내는 자리가 있습니다: ' + 빠진것.join(', ') + '\n' +
    '   실시간DB 는 «없는 자리에 쓰면 만들어 줍니다» — 서버에 id 없는 껍데기가 생기고,\n' +
    '   그 한 건이 그 표를 통째 저장으로 떨어뜨립니다. id 를 함께 보내세요.');
});

test('④ ★★ 백업 이력은 «이 PC 것»이라 서버에 안 올린다', function () {
  const at = bare.indexOf('var FB_EXCLUDE = [');
  assert.ok(at > 0, '★ 동기화 제외 목록을 못 찾았습니다');
  const 목록 = bare.slice(at, bare.indexOf('\n', at));
  assert.match(목록, /'backup_history'/,
    '★★ 백업 이력을 서버에 올립니다 — 16번 받은 PC 와 1번 받은 PC 가 서로를 지워\n' +
    '   「데이터 급감 차단」 창이 매번 뜹니다. 그것은 «자료»가 아니라 «그 PC 의 기록»입니다.');
  /* 이미 기기별로 빼 둔 것들이 그대로 있어야 한다 — 함께 지우면 다른 경고가 되살아난다 */
  ['bank_ledger_draft', 'co_merge_log', 'co_link_log', 'co_vat_log'].forEach(function (k) {
    assert.match(목록, new RegExp("'" + k + "'"), '★ 기기별 제외였던 ' + k + ' 가 사라졌습니다');
  });
});
