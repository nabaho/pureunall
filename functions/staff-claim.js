/* 로그인 증표에 «재직자» 표시(staff:true)를 새긴다 — 창고(Storage) 규칙이 볼 수 있게 (2026-10-14 사무실 보안 검토)
 *
 * ■ 왜 있나
 *   창고 규칙은 실시간DB(uid_roles)를 읽을 수 없다. 그래서 isStaff() 가 「이메일이 @pureun.kr 로
 *   끝나는가」만 보았다 — 그런데 가입이 열려 있고 메일 인증을 안 보므로, 아무나 아무개@pureun.kr 로
 *   가입하면 급여자료·서고 원본·명함 사진이 열렸다.
 *   증표 안의 «커스텀 클레임»은 서버(관리자 SDK)만 새길 수 있다. 서버가 uid_roles 재직자에게만
 *   staff:true 를 새기면, 창고 규칙은 request.auth.token.staff == true 하나로 직원을 가린다.
 *
 * ■ 언제 새기나 — 화면 코드는 안 고친다
 *   ① uid_roles/{uid} 가 바뀔 때(이알피가 로그인 때 적는다 · 관리자가 퇴사 처리) — 바로
 *   ② 한 시간마다 전체를 맞춘다 — ①을 놓친 사람, 지워진 uid_roles 의 남은 표시까지
 *   증표는 파이어베이스가 한 시간마다 스스로 새로 받으므로, 새긴 것은 길어야 한 시간 뒤 화면에 닿는다.
 *
 * ■ 잣대 — functions/staff-gate.js · 실시간DB 규칙 LOGIN 과 같다: sid 가 있고 status === 'active'.
 * ■ 다른 클레임은 건드리지 않는다 — staff 한 칸만 넣고 뺀다.
 */
'use strict';

function isActive(role) {
  return !!(role && role.sid && role.status === 'active');
}

/* 지금 클레임과 재직 여부를 보고 «새로 쓸 클레임»을 낸다. 바꿀 것이 없으면 null. */
function nextClaims(current, active) {
  const cur = (current && typeof current === 'object') ? current : {};
  const has = cur.staff === true;
  if (has === !!active) return null;
  const next = Object.assign({}, cur);
  if (active) next.staff = true; else delete next.staff;
  return next;
}

async function syncOne(auth, uid, role) {
  let user;
  try { user = await auth.getUser(uid); }
  catch (e) { if (e && e.code === 'auth/user-not-found') return 'no-user'; throw e; }
  const next = nextClaims(user.customClaims, isActive(role));
  if (!next) return 'same';
  await auth.setCustomUserClaims(uid, next);
  return isActive(role) ? 'granted' : 'revoked';
}

/* 전체 맞추기 — uid_roles 의 재직자에게 새기고, 표시가 있는데 재직자가 아니면 뺀다 */
async function sweep(auth, roles) {
  const r = roles || {};
  const out = { granted: 0, revoked: 0, same: 0 };
  let token;
  do {
    const page = await auth.listUsers(1000, token);
    for (const u of page.users) {
      const next = nextClaims(u.customClaims, isActive(r[u.uid]));
      if (!next) { if (isActive(r[u.uid])) out.same++; continue; }
      await auth.setCustomUserClaims(u.uid, next);
      if (next.staff) out.granted++; else out.revoked++;
    }
    token = page.pageToken;
  } while (token);
  return out;
}

function make(deps) {
  const { getAuth } = require('firebase-admin/auth');
  const fn = deps.functions.region(deps.MAIL_REGION).runWith({ timeoutSeconds: 120, memory: '256MB' });
  const staffClaimOnRole = fn.database.ref('/uid_roles/{uid}').onWrite(async (change, context) => {
    const r = await syncOne(getAuth(), context.params.uid, change.after.val());
    if (r === 'granted' || r === 'revoked') console.log('staff-claim', r);
    return null;
  });
  const staffClaimSweep = fn.pubsub.schedule('every 60 minutes').onRun(async () => {
    const snap = await deps.getDatabase().ref('uid_roles').once('value');
    const out = await sweep(getAuth(), snap.val() || {});
    console.log('staff-claim sweep', JSON.stringify(out));
    return null;
  });
  return { staffClaimOnRole, staffClaimSweep };
}

module.exports = make;
module.exports.isActive = isActive;
module.exports.nextClaims = nextClaims;
module.exports.syncOne = syncOne;
module.exports.sweep = sweep;
