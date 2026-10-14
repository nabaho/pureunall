/* 「재직 직원인가」 — 서버 함수 공용 문 (2026-10-14 사무실 보안 검토)
 *
 * ■ 왜 있나
 *   파이어베이스 가입이 열려 있다(익명 로그인 때문에 끌 수 없다 — 전자서명 링크가 멈춘다).
 *   그래서 공개 웹 열쇠만 있으면 «아무 이메일»로 비밀번호 계정을 만들 수 있다.
 *   메일 발송(requireStaff)·판독(requireReader)은 「비밀번호로 들어왔는가」만 보았다 —
 *   가입만 한 바깥 사람이 회사 발신 주소로 아무에게나 메일을 보내고(피싱), AI 판독 한도를 태울 수 있었다.
 *   메일함(requireMailUser)만 uid_roles 를 보고 있었다. 이 문을 모두가 함께 쓴다.
 *
 * ■ 잣대 — 실시간DB 규칙 LOGIN 과 «같다»
 *   uid_roles/{uid} 에 sid 가 있고 status === 'active'.
 *   그 칸은 관리자만 쓰는 sid_roles 와 견줘야만 써진다(규칙 .validate) — 스스로 직원이 될 수 없다.
 *
 * ■ 못 읽으면 «막는다» — 문이 열린 채 흔들리면 문이 아니다.
 *   (하루 한도 셈처럼 «못 읽으면 통과»하는 자리와 방향이 반대다. 여기는 들어올 자격을 보는 자리다.)
 *
 * ■ 통과한 것만 잠깐(3분) 기억한다 — 메일함과 같은 길이. 퇴사 처리가 길어야 3분 뒤 닿는다.
 */
'use strict';

const TTL_MS = 3 * 60 * 1000;
const CACHE_MAX = 200;

function makeStaffGate(deps) {
  const now = (deps && deps.now) || Date.now;
  const ok = new Map();   /* uid → 통과한 시각 */

  function 막음(msg) {
    const e = new Error(msg || '재직 중인 직원만 쓸 수 있습니다.');
    e.status = 403;
    return e;
  }

  /* 통과하면 그 사람의 uid_roles 값(sid·status …)을 돌려준다.
     기억에서 꺼낼 때는 sid 를 함께 기억해 둔 것을 준다 — 지문 등록이 사번을 견준다. */
  async function assertActive(uid) {
    const u = String(uid || '');
    if (!u) throw 막음('로그인 후 이용해 주세요.');
    const hit = ok.get(u);
    if (hit && (now() - hit.at) < TTL_MS) return hit.role;
    const snap = await deps.getDatabase().ref('uid_roles/' + u).once('value');
    const v = (snap && snap.val()) || {};
    if (!v.sid || v.status !== 'active') {
      ok.delete(u);
      throw 막음();
    }
    if (ok.size > CACHE_MAX) ok.clear();
    const role = { sid: String(v.sid), status: v.status };
    ok.set(u, { at: now(), role: role });
    return role;
  }

  return { assertActive: assertActive, _ok: ok };
}

module.exports = { makeStaffGate: makeStaffGate, TTL_MS: TTL_MS };
