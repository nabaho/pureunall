'use strict';
/* 카카오 «나에게 보내기» 연결의 «순수 핵심» — 대표가 한 번만 동의하면 서버가 refresh 토큰을 받아 둔다 (정부사업신청 매일 카톡 요약용)

   대표 지시 2026-11-22 「정부 지원사업 관련해서 카카오톡으로 매일 받고 싶다」 → 「공식 방식으로」.
   ── 흐름 ──
   ① 대표가 kakaoMemoStart 주소를 연다 → 서명한 state 를 달아 카카오 동의 화면(scope=talk_message)으로 보낸다.
   ② 카카오가 kakaoMemoCallback 으로 돌려보낸다 → state 를 한 번만 쓰게 확인하고 code 를 토큰으로 바꾼다.
   ③ ★ 동의한 카카오 계정이 «ERP 에 연결된 관리자(총괄)»인지 확인한다 — 아니면 토큰을 저장하지 않는다(남의 카카오가 대표 알림을 가로채지 못하게).
   ④ 토큰을 서버 전용 자리(gov_digest_secret/kakao)에 두고, 확인용 글 한 통을 «나에게» 보낸다.
   ⚠ 로그인용 카카오 코드(functions/kakao.js)는 건드리지 않는다 — 같은 앱 키·state 서명·연결표(kakao_links)만 빌려 쓴다.
   ⚠ 토큰·열쇠는 화면 글·로그·오류 어디에도 안 남긴다. 화면에 나가는 글은 고정 문구뿐이다(사람이 넣은 값을 그대로 싣지 않는다).
   ⚠ 돌아올 주소(Redirect URI)가 카카오 콘솔에 등록돼 있어야 한다 — 안 돼 있으면 카카오가 오류 화면을 띄운다. */
/* ★ 이 파일은 firebase 모듈을 안 부른다 — 서버 연결(functions/kakao-memo.js)과 시험(functions/gov-digest-kakao.test.js)이 함께 쓴다. */
const Memo = require('./gov-digest-kakao.js');
const ERP = require('./erp-origins');

const REGION = 'asia-northeast3';   // functions/kakao.js 의 REGION 과 같다
const SCOPE = 'talk_message';
const CB_NAME = 'kakaoMemoCallback';

/* 돌아올 주소 — 함수 주소 그대로(카카오 콘솔 Redirect URI 에 «이 글자 그대로» 등록) */
function callbackUrl(env) {
  env = env || process.env;
  return 'https://' + REGION + '-' + (env.GCLOUD_PROJECT || env.GCP_PROJECT || 'pureun-erp') + '.cloudfunctions.net/' + CB_NAME;
}

/* 화면에 나가는 글 — 고정 문구만. 제목·문구에 사람이 넣은 값이 없어 XSS 길이 없다 */
function page(ok, title, lines) {
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex"><title>' + esc(title) + '</title>'
    + '<style>body{font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:8vh auto;padding:0 16px;color:#222}h1{font-size:20px}'
    + '.ok{color:#0a7a3d}.no{color:#b3261e}</style></head><body><h1 class="' + (ok ? 'ok' : 'no') + '">' + (ok ? '✅ ' : '⚠ ') + esc(title) + '</h1>'
    + lines.map((l) => '<p>' + esc(l) + '</p>').join('') + '</body></html>';
}

/* 돌아온 요청 한 건 처리 — deps 를 꽂아 시험한다.
   deps = { restKey, clientSecret, now, fetch, takeState(state), kakaoIdOf(accessToken) → id, linkOf(kakaoId) → {uid}|null, roleOf(uid), store{get,update}, redirectUri, linkBase }
   돌려주는 것: { status, html } */
async function handleCallback(q, d) {
  q = q || {};
  if (q.error) return { status: 400, html: page(false, '연결하지 않았습니다', ['카카오 동의 화면에서 취소하셨거나 동의하지 않으셨습니다. 필요하면 처음 주소부터 다시 열어 주세요.']) };
  if (!d.restKey || !d.clientSecret) return { status: 500, html: page(false, '서버 설정이 필요합니다', ['카카오 앱 키가 서버에 제대로 등록돼 있지 않습니다. 관리자가 확인해야 합니다.']) };
  const code = String(q.code || ''), state = String(q.state || '');
  if (!code || !state) return { status: 400, html: page(false, '잘못된 요청입니다', ['카카오에서 돌아온 정보가 없습니다. 처음 주소부터 다시 열어 주세요.']) };
  const took = await d.takeState(state);
  if (!took) return { status: 400, html: page(false, '요청이 만료됐습니다', ['연결 요청은 10분 안에, 한 번만 쓸 수 있습니다. 처음 주소부터 다시 열어 주세요.']) };

  const ex = await Memo.exchangeCode(d.fetch, { restKey: d.restKey, clientSecret: d.clientSecret }, code, d.redirectUri, d.now);
  if (!ex.ok) return { status: 400, html: page(false, '카카오 인증에 실패했습니다', ['잠시 뒤 처음 주소부터 다시 열어 주세요.']) };
  if (ex.scope.indexOf(SCOPE) < 0) {
    return { status: 400, html: page(false, '«카카오톡 메시지 전송» 동의가 없습니다', [
      '카카오 개발자 콘솔에서 이 앱의 동의항목 «카카오톡 메시지 전송(talk_message)» 이 켜져 있어야 하고, 동의 화면에서 허용하셔야 합니다.',
      '설정을 켠 뒤 처음 주소부터 다시 열어 주세요.'] ) };
  }
  /* ★ 동의한 카카오가 «ERP 에 연결된 총괄 관리자»인가 — 아니면 토큰을 버린다 */
  let kakaoId = '';
  try { kakaoId = await d.kakaoIdOf(ex.tok.access); } catch (e) { kakaoId = ''; }
  if (!kakaoId) return { status: 400, html: page(false, '카카오 회원 확인에 실패했습니다', ['잠시 뒤 다시 시도해 주세요.']) };
  const link = await d.linkOf(kakaoId);
  if (!link || !link.uid) {
    return { status: 403, html: page(false, 'ERP 에 연결된 카카오가 아닙니다', ['ERP 로그인 화면에서 먼저 이 카카오 계정을 연결한 뒤, 처음 주소부터 다시 열어 주세요.']) };
  }
  const role = await d.roleOf(link.uid);
  /* 총괄 관리자·재직이어야 하고, 대표 표지(app_owner/uid — 데이터관리가 쓰는 «대표 uid»)가 있으면 그 사람이어야 한다 */
  const owner = await d.store.get('app_owner/uid');
  const uidLink = await d.uidLinkOf(link.uid);
  const linkedNow = !!(uidLink && uidLink.linked === true && uidLink.linkKey === d.linkKeyOf(kakaoId));
  if (!linkedNow) {
    return { status: 403, html: page(false, 'ERP 카카오 연결을 한 번 새로 해 주세요', ['ERP 로그인 화면에서 «카카오로 로그인»을 한 번 하신 뒤, 처음 주소부터 다시 열어 주세요.']) };
  }
  if (!Memo.ownerOk(link.uid, role, owner, true)) {
    return { status: 403, html: page(false, '대표(총괄 관리자) 카카오만 연결할 수 있습니다', ['이 알림은 총괄 관리자이고 대표로 지정된 계정의 카카오로만 받을 수 있습니다.']) };
  }

  /* 확인용 글 — 이 한 통이 «나에게» 가면 연결이 끝까지 된 것이다. ★ 토큰은 «이 글이 간 뒤에만» 저장한다 — 실패했는데 기존 연결을 새 토큰으로 덮어 망가뜨리지 않게 */
  const linkUrl = (d.linkBase || ERP.ERP_LINK_BASE) + '/gov.html?digest=1';
  const sent = await Memo.memoSend(d.fetch, ex.tok.access, Memo.templateOf('✅ 푸른노무법인 정부지원사업 알림이 연결됐습니다.' + String.fromCharCode(10) + '새 공고·모집이 있으면 매일 아침 이곳으로 알려 드립니다.', linkUrl));
  if (!sent.ok) {
    return { status: 502, html: page(false, '확인 글을 보내지 못해 연결하지 않았습니다', [
      '«나에게 보내기»가 거절됐습니다(' + (sent.status || 0) + (sent.code != null ? '/' + sent.code : '') + '). 기존 연결은 그대로 두었고 새 토큰은 저장하지 않았습니다.',
      '카카오 개발자 콘솔의 제품 링크 관리 › 웹 도메인에 ERP 주소가 등록돼 있는지, 동의항목이 켜져 있는지 확인해 주세요.'] ) };
  }
  /* linkKey = ERP 에 연결된 카카오의 «지문»(회원번호 원문이 아니다) — 보낼 때마다 지금 ERP 연결과 같은지 대조한다. 카카오를 바꿔 연결하면 옛 카카오로 안 간다 */
  await d.store.update({ ['gov_digest_secret/kakao']: Object.assign({}, ex.tok, { uid: link.uid, linkKey: d.linkKeyOf(kakaoId), linkedAt: d.now }) });
  /* 처음 연결하면 매일 알림을 켠다(모드가 비어 있을 때만 — 이미 정해 둔 모드는 건드리지 않는다) */
  const mode = await d.store.get('gov_digest_cfg/mode');
  let on = false;
  if (!mode) { await d.store.update({ ['gov_digest_cfg/mode']: 'live' }); on = true; }
  return { status: 200, html: page(true, '연결됐습니다', [
    '방금 카카오톡 «나와의 채팅»에 확인 글을 보냈습니다.',
    on ? '매일 아침 8시 30분에 새 공고·모집이 있으면 알려 드립니다. 이 창은 닫으셔도 됩니다.' : '이 창은 닫으셔도 됩니다.'] ) };
}

/* 연결표에서 카카오 회원번호로 사람 찾기 — 지문 열쇠가 먼저, 없으면 «옛 원문 열쇠»(예전 연결은 로그인 때 천천히 옮겨진다) */
async function findLink(get, modernKey, legacyKey) { return (await get(modernKey)) || (await get(legacyKey)) || null; }

module.exports = { handleCallback, callbackUrl, page, SCOPE, CB_NAME, REGION, findLink };
