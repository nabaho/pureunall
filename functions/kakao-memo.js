'use strict';
/* 카카오 «나에게 보내기» 연결 — 대표가 한 번만 동의하면 서버가 refresh 토큰을 받아 둔다 (정부사업신청 매일 카톡 요약용)

   대표 지시 2026-11-22 「정부 지원사업 관련해서 카카오톡으로 매일 받고 싶다」 → 「공식 방식으로」.
   ── 흐름 ──
   ① 대표가 kakaoMemoStart 주소를 연다 → 서명한 state 를 달아 카카오 동의 화면(scope=talk_message)으로 보낸다.
   ② 카카오가 kakaoMemoCallback 으로 돌려보낸다 → state 를 한 번만 쓰게 확인하고 code 를 토큰으로 바꾼다.
   ③ ★ 동의한 카카오 계정이 «ERP 에 연결된 관리자(총괄)»인지 확인한다 — 아니면 토큰을 저장하지 않는다(남의 카카오가 대표 알림을 가로채지 못하게).
   ④ 토큰을 서버 전용 자리(gov_digest_secret/kakao)에 두고, 확인용 글 한 통을 «나에게» 보낸다.
   ⚠ 로그인용 카카오 코드(functions/kakao.js)는 건드리지 않는다 — 같은 앱 키·state 서명·연결표(kakao_links)만 빌려 쓴다.
   ⚠ 토큰·열쇠는 화면 글·로그·오류 어디에도 안 남긴다. 화면에 나가는 글은 고정 문구뿐이다(사람이 넣은 값을 그대로 싣지 않는다).
   ⚠ 돌아올 주소(Redirect URI)가 카카오 콘솔에 등록돼 있어야 한다 — 안 돼 있으면 카카오가 오류 화면을 띄운다. */
const functions = require('firebase-functions/v1');
const { getDatabase: getRawDatabase } = require('firebase-admin/database');
const K = require('./kakao')._shared;
const Memo = require('./gov-digest-kakao.js');
const Core = require('./kakao-memo-core.js');
const { handleCallback, callbackUrl, page, SCOPE } = Core;

/* ── 함수 둘 ── */
const SECRETS = ['KAKAO_REST_KEY', 'KAKAO_CLIENT_SECRET'];

exports.kakaoMemoStart = functions
  .region(K.REGION)
  .runWith({ secrets: SECRETS })
  .https.onRequest(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET') return res.status(405).send('GET 만 받습니다');
    const rk = K.restKeyOf(), cs = K.clientSecretOf();
    if (!rk || !cs) return res.status(500).send(page(false, '서버 설정이 필요합니다', ['카카오 앱 키가 서버에 제대로 등록돼 있지 않습니다.']));
    const state = K.issueState('memo', cs, 0);
    /* prompt=login — 브라우저에 남은 다른 카카오 계정으로 그냥 통과하지 않고, 대표 카카오로 다시 확인하게 한다 */
    const url = 'https://kauth.kakao.com/oauth/authorize?client_id=' + encodeURIComponent(rk)
      + '&redirect_uri=' + encodeURIComponent(callbackUrl())
      + '&response_type=code&scope=' + SCOPE + '&prompt=login&state=' + encodeURIComponent(state);
    res.redirect(302, url);
  });

exports.kakaoMemoCallback = functions
  .region(K.REGION)
  .runWith({ secrets: SECRETS })
  .https.onRequest(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'text/html; charset=utf-8');
    if (req.method !== 'GET') return res.status(405).send(page(false, '허용되지 않는 요청입니다', ['GET 만 받습니다.']));
    const rk = K.restKeyOf(), cs = K.clientSecretOf();
    const raw = getRawDatabase();
    const deps = {
      restKey: rk, clientSecret: cs, now: Date.now(), fetch: (u, o) => fetch(u, o), redirectUri: callbackUrl(),
      takeState: (state) => K.takeState(state, 'memo', cs),
      kakaoIdOf: async (access) => {
        const r = await fetch('https://kapi.kakao.com/v2/user/me?property_keys=%5B%5D', { headers: { Authorization: 'Bearer ' + access } });
        const j = await r.json().catch(() => null);
        return r.ok && j && j.id != null ? String(j.id) : '';
      },
      linkOf: (kakaoId) => Core.findLink(async (p) => (await raw.ref(K.DB_LINK + '/' + p).once('value')).val(), K.kakaoLinkKey(kakaoId), K.pathSafe(kakaoId)),
      roleOf: (uid) => K.roleOf(uid), linkKeyOf: (id) => K.kakaoLinkKey(id),
      store: { get: async (p) => (await raw.ref(p).once('value')).val(), update: (u) => raw.ref().update(u) }
    };
    try {
      const out = await handleCallback(req.query, deps);
      res.status(out.status).send(out.html);
    } catch (e) {
      console.warn('[kakaoMemoCallback] 실패', Memo.scrub((e && e.message) || e, [rk, cs]));
      res.status(500).send(page(false, '처리하지 못했습니다', ['잠시 뒤 처음 주소부터 다시 열어 주세요.']));
    }
  });

