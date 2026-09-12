'use strict';
/* 좁힌 셋 — 막을 것은 막고, 돌던 것은 «그대로 돈다» (대표 지시 2026-08-29 「셋 좁」)
   ═══════════════════════════════════════════════════════════════════════════
   ■ 좁히기는 «조용히 망가지는» 변경이다
     쓰기가 막혀도 화면에 아무 말이 안 뜬다. 그래서 「막혔나」만 보지 않고
     «돌아야 하는 것이 도는가»를 함께 본다. 코드에서 확인한 것:
       · 백업(js/pu-backup.js)은 관리자·위임관리인이 돌리고, 읽기 실패를 삼키지 않는다
         — 한 자리라도 못 읽으면 백업 «전체»가 멈춘다
       · 복원은 ref().update() 로 «부모 자리에 통째로» 되쓴다
       · 옛 건의 이사(enter.html sgEnsurePrivateMigration)는 관리자만 돈다
       · 포털 설정 단추(cfgFab)는 이미 관리자에게만 보인다
   실행: node --test tests/rules-narrow-three.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = path.join(__dirname, '..');
const rules = JSON.parse(
  fs.readFileSync(path.join(R, 'docs', 'firebase-rules-전체-적용본.json'), 'utf8')).rules;

/* ── 규칙 한 줄을 실제로 돌려 본다 (firebase-access-matrix 와 같은 결) ── */
class Snap {
  constructor(v){ this.value = v; }
  child(p){
    let cur = this.value;
    for (const part of String(p).split('/')) cur = (cur && typeof cur === 'object') ? cur[part] : undefined;
    return new Snap(cur);
  }
  val(){ return this.value === undefined ? null : this.value; }
  exists(){ return this.value !== undefined && this.value !== null; }
}
/* ★ 2026-09-12 — 「직원」의 뜻이 바뀌었다.
   옛 규칙은 「비번으로 로그인했나」만 봤는데, 파이어베이스 가입이 열려 있어
   «아무나» 계정을 만들 수 있었다(실측). 이제는 uid_roles 에 status:'active' 로
   등록된 사람이라야 직원이다 — 그래서 모형에도 status 를 적는다.
   ⚠ 이 칸을 빼면 「로그인만 하면 열리던 시절」의 모형이 되어, 검사가 헛돈다. */
const ROLES = {
  adminUid: { isAdmin: true,    status: 'active' },
  subUid:   { isSubAdmin: true, status: 'active' },
  staffUid: { status: 'active' },
  otherUid: { status: 'active' },
  retiredUid: { status: 'retired' }   /* 퇴사자 — 계정이 살아 있어도 안 열려야 한다 */
};
function who(uid){
  return { uid, token: { email: uid + '@pureun.kr', firebase: { sign_in_provider: 'password' } } };
}
function run(rule, ctx){
  const c = ctx || {};
  const root = new Snap({ uid_roles: ROLES });
  const names = ['auth', 'root', 'data', 'newData', 'now', '$uid'];
  const vals = [c.auth === undefined ? null : c.auth, root,
    new Snap(c.data), new Snap(c.newData), Date.now(), c.$uid];
  /* eslint-disable no-new-func */
  return Function(...names, '"use strict"; return Boolean(' + rule + ');')(...vals);
}

/* ══════ ⓪ 「직원인가」의 잠금이 실제로 먹는가 (2026-09-12 보안 훑기) ══════
   ⚠ 위 모형에 status 를 더했으니, 그 잣대가 «정말» 걸리는지 여기서 잰다.
     안 그러면 모형만 고치고 잠금은 안 걸린 채 검사가 초록이 된다 — 가장 나쁜 꼴이다. */
test('★★ 스스로 가입한 «바깥 사람»은 업무 자료를 못 읽는다', () => {
  /* uid_roles 에 아예 없는 사람 — 파이어베이스 가입이 열려 있어 누구나 될 수 있다 */
  const 바깥 = { uid: 'strangerUid', token: { email: 'stranger@gmail.com', firebase: { sign_in_provider: 'password' } } };
  [['companies', rules.data.companies], ['contracts', rules.data.contracts],
   ['cases', rules.data.cases], ['user_dir', rules.data.user_dir]].forEach(function (p) {
    const [이름, n] = p;
    if (!n || typeof n['.read'] !== 'string') return;
    assert.equal(run(n['.read'], { auth: 바깥 }), false,
      '★ 아무나 가입해서 data/' + 이름 + ' 를 읽습니다');
  });
});

test('★★ 퇴사자는 계정이 살아 있어도 업무 자료를 못 읽는다', () => {
  const 퇴사 = { uid: 'retiredUid', token: { email: 'retiredUid@pureun.kr', firebase: { sign_in_provider: 'password' } } };
  const n = rules.data.companies;
  assert.equal(run(n['.read'], { auth: 퇴사 }), false, '★ 퇴사자가 고객사를 읽습니다');
  assert.equal(run(n['.read'], { auth: who('staffUid') }), true, '재직 직원이 못 읽으면 업무가 멈춥니다');
});

/* ══════ ① 포털 공용 설정 — 읽기는 직원, 쓰기는 관리자 ══════ */
test('★ 공용 설정: 직원은 읽지만 «못 고친다»', () => {
  const n = rules.data.app_config;
  assert.equal(run(n['.read'],  { auth: who('staffUid') }), true,  '직원이 못 읽으면 앱들이 설정을 못 가져온다');
  assert.equal(run(n['.write'], { auth: who('staffUid') }), false, '★ 직원이 앱 공용 설정을 바꿀 수 있다');
  assert.equal(run(n['.write'], { auth: who('adminUid') }), true,  '★ 대표가 설정을 못 바꾼다 — 설정 창이 죽는다');
});

/* ══════ ② 타일 순서 — 제 것만, 다만 백업·복원 길은 남긴다 ══════ */
test('★ 타일 순서: 제 것만 만지고, 남의 것은 못 만진다', () => {
  const n = rules.data.portal_prefs_uid.$uid;
  assert.equal(run(n['.write'], { auth: who('staffUid'), $uid: 'staffUid' }), true,
    '제 타일 순서를 못 바꾸면 포털 정리가 안 된다');
  assert.equal(run(n['.write'], { auth: who('otherUid'), $uid: 'staffUid' }), false,
    '★ 남이 내 포털 배치를 바꿀 수 있다');
  assert.equal(run(n['.read'],  { auth: who('otherUid'), $uid: 'staffUid' }), false,
    '★ 남의 타일 순서를 들여다볼 수 있다');
});

test('★ 백업·복원 길이 살아 있다 — 막으면 백업이 «통째로» 멈춘다', () => {
  /* 백업은 부모 자리를 통째로 읽고, 복원은 부모 자리에 통째로 되쓴다.
     자식 규칙만 두면 둘 다 조용히 실패한다. */
  const p = rules.data.portal_prefs_uid;
  ['adminUid', 'subUid'].forEach(u => {
    assert.equal(run(p['.read'],  { auth: who(u) }), true,  '★ ' + u + ' 이 백업을 못 뜬다');
    assert.equal(run(p['.write'], { auth: who(u) }), true,  '★ ' + u + ' 이 복원을 못 한다');
  });
  assert.equal(run(p['.read'], { auth: who('staffUid') }), false,
    '★ 직원이 «모두의» 타일 순서를 통째로 읽는다');
});

/* ══════ ③ 옛 건의 넷 — 관리자·위임관리인만 ══════ */
test('★ 옛 건의: 직원은 못 읽는다 — 대표께 올린 글이다', () => {
  ['suggestions', 'sg_meta', 'sg_resolved', 'sg_resolved_uid'].forEach(k => {
    const n = rules.data[k];
    assert.ok(n, k + ' 의 이름이 없어졌다 — $other 로 떨어져 직원 누구나 읽는다');
    assert.equal(run(n['.read'], { auth: who('staffUid') }), false,
      '★ data/' + k + ' 을 직원이 읽는다 — 남의 건의 내용이 보인다');
  });
});

test('★ 이사와 백업은 그대로 돈다 — 관리자·위임관리인 길', () => {
  /* 이사(sgEnsurePrivateMigration)는 관리자가 읽고 «지운다»(null 쓰기).
     백업은 위임관리인도 돌리고 읽기 실패를 삼키지 않는다. */
  ['suggestions', 'sg_meta', 'sg_resolved', 'sg_resolved_uid'].forEach(k => {
    const n = rules.data[k];
    assert.equal(run(n['.read'],  { auth: who('adminUid') }), true, '★ 이사가 못 읽는다');
    assert.equal(run(n['.write'], { auth: who('adminUid') }), true, '★ 이사가 옛 자리를 못 지운다');
    assert.equal(run(n['.read'],  { auth: who('subUid') }), true,
      '★ 위임관리인이 못 읽어 백업이 «통째로» 멈춘다');
  });
});

/* ══════ 좁히지 «않은» 것 — 업무 자료는 그대로 ══════ */
test('업무 자료 넷은 그대로 열려 있다 — 좁히면 업무가 멈춘다', () => {
  ['companies', 'contracts', 'consultings', 'presence_hours'].forEach(k => {
    const n = rules.data[k];
    assert.ok(n, k + ' 의 이름이 없어졌다');
    assert.equal(run(n['.read'], { auth: who('staffUid') }), true,
      '★ 직원이 ' + k + ' 을 못 읽는다 — 푸른이알피가 멈춘다');
  });
});
