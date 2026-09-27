'use strict';
/* 푸른노무법인 경력관리 — 화면 맨 위 「띠」를 «언제 띄울지» 정하는 자
   (브라우저 window.KcareerNotices / Node module.exports 겸용, DOM·통신 없음 — 숫자만 본다)

   ── 왜 만드나 (대표 제보 2026-09-12) ──
   「폰에서 자꾸 데이터가 업데이트 해야한다고 한다」

   ■ 뿌리는 «하나»다
     앱이 「이 기기가 클라우드보다 적다/낡았다」를 곧바로
     **「자료가 지워졌다」**로 읽었다. 그런데 폰처럼 «아직 한 번도 받아 오지 않은 기기»에서는
     그것이 **정상**이다. 그래서 폰에는 거짓 경보가 영영 떠 있고, 무엇을 눌러도 안 사라졌다:
       · `fbWatch` — base 가 없으면 «무조건» 띄운다. PC 가 저장할 때마다(2.5초) 다시 뜬다.
       · `fbCheckLoss` — 폰 185건 vs 클라우드 709건 → 「브라우저 자료가 지워졌을 수 있습니다」
       · `fbAutoPush` — base 가 없으면 올리지도 않는다 → 스스로 그 상태를 벗어날 수가 없다.
     ⚠ 게다가 거짓 경보 띠에 「☁ 아니다, 이 기기 것이 맞다」(=올리기)가 함께 있었다 —
       폰의 시드 185건으로 클라우드 709건을 덮자고 권하는 꼴이었다(fbPush 의 확인창이 막아
       주긴 했다). 거짓 경보는 «그 자체로» 위험하다.

   ■ 가르는 잣대 — 한 줄로
     **한 번도 맞춰 본 적 없는 기기(base 가 없다)는 «잃을» 것이 없다.**
     그리고 **클라우드가 내 바탕보다 새것이면, 내가 적은 까닭은 그것으로 이미 설명된다** —
     「지워졌다」가 아니라 「아직 안 받았다」이다.
   ⚠★ 이 잣대를 기기(폰/PC)로 만들지 않았다. 폰이라서가 아니라 «안 맞춰 봤기 때문»이다 —
     새 PC 도 똑같고, 폰도 한 번 받아 오면 PC 와 똑같이 지켜진다. 기기로 가르면
     「폰에서는 자료가 사라져도 안 알려 준다」가 되어 더 나쁘다.

   ⚠ 백업 재촉(bkNotice)은 **손대지 않았다** — `last_backup` 은 클라우드로 함께 오가므로
     (FB_SKIP 에 없다) 한 번 받아 오면 저절로 멎는다. 그 띠는 197건 사고를 막으라고 만든
     것이라 함부로 줄이지 않는다. */
(function (root) {

  /* 「닫기」를 눌렀을 때 얼마나 잠잠할지 — 그 뒤 클라우드가 또 바뀌어도 이 사이에는 안 띄운다.
     ⚠ 「닫기」가 아무것도 기억하지 않아, PC 가 저장할 때마다(2.5초) 곧바로 되살아났다.
       그것이 대표가 겪은 「자꾸」다. */
  function dismissedStill(dismissedAt, cloudAt) {
    if (dismissedAt == null) return false;
    return dismissedAt >= cloudAt;          /* 그때 본 것보다 새것이 없으면 잠잠히 */
  }

  /* s = { base, cloudAt, here, cloud, deleted, dismissedAt }
       base       : 이 기기가 마지막으로 맞춘 클라우드 시각 (null = 한 번도 안 맞춤)
       cloudAt    : 클라우드의 마지막 저장 시각 (0 = 없음)
       here       : 이 기기 기록 수
       cloud      : 클라우드 기록 수 (null = 못 읽음 — 그때는 아무 말도 하지 않는다)
       deleted    : 내가 지운 수(자리표)
       dismissedAt: 「닫기」를 누른 그 순간의 클라우드 시각 */
  function decide(s) {
    var o = s || {};
    var base = (o.base == null) ? null : Number(o.base);
    var cloudAt = Number(o.cloudAt || 0);
    var here = Number(o.here || 0);
    var cloud = (o.cloud == null) ? null : Number(o.cloud);
    var del = Number(o.deleted || 0);

    /* 한 번이라도 클라우드와 맞춰 본 기기인가 */
    var everSynced = (base != null);
    /* 클라우드가 내 바탕보다 새것인가 — 「아직 안 받았다」 */
    var behind = cloudAt > 0 && (base == null || cloudAt > base);

    var out = {
      newer: { show: false, kind: '' },
      loss: { show: false },
      stale: { show: false },
      everSynced: everSynced, behind: behind
    };

    /* ── ① 클라우드가 더 새것이다 ──
       ⚠ 이 띠는 «맞는 말»이다. 다만 두 가지를 고친다:
         · 한 번도 안 받아 온 기기에는 「다른 기기에서 저장된」이 아니라
           「이 기기는 아직 받은 적이 없다」라고 말해야 한다(그래야 무엇을 할지 안다).
         · 「닫기」를 기억한다. */
    if (behind && !dismissedStill(o.dismissedAt, cloudAt)) {
      out.newer.show = true;
      out.newer.kind = everSynced ? 'newer' : 'first';
    }

    /* 못 읽었으면 숫자 이야기는 하지 않는다.
       ⚠ 솔직히 적어 둔다: 이 줄을 지워도 «지금은» 답이 달라지지 않는다 —
         null 은 셈에서 0 으로 읽혀(null - del = -del) 아래 「지운 만큼으로 설명된다」
         가지로 빠지고, 거기서도 손실이라 하지 않기 때문이다. 그래서 고장넣기로 안 잡힌다
         (2026-09-12에 실제로 안 잡혔다 — 억지 검사를 지어 붙이지 않았다).
       ⚠ 그래도 지우지 말 것: 뜻을 밝히는 줄이고, 아래 셈이 조금만 바뀌어도
         「못 읽었는데 겁주는」 자리로 되돌아간다. */
    if (cloud == null) return out;

    /* ── ② 내가 지운 만큼으로 설명되면 손실이 아니다 (2026-09-03 규칙 그대로) ── */
    if (cloud - del <= here + 5) {
      if (cloud > here + 5) out.stale.show = true;
      return out;
    }

    /* ── ③ 「자료가 지워졌을 수 있습니다」 — ★ 여기가 이번에 좁힌 곳 ──
       ⚠★ «맞춰 본 적이 있고»(everSynced) «클라우드가 새것도 아닌데»(!behind)
         내 것이 크게 적을 때만 손실이다. 둘 중 하나라도 아니면 「아직 안 받았다」이지
         「잃었다」가 아니다 — 폰에 거짓 경보를 띄우던 자리다.
       ⚠ 이 두 빗장을 풀면 폰이 다시 「자료가 지워졌을 수 있습니다」로 도배된다. */
    if (everSynced && !behind) out.loss.show = true;
    return out;
  }

  /* 화면에 적을 말 — 「처음」과 「뒤처짐」은 할 일이 다르다 */
  function newerText(kind) {
    return (kind === 'first')
      ? '☁ 이 기기는 아직 클라우드에서 «한 번도» 받아 온 적이 없습니다. 받아 오면 최신이 됩니다.'
      : '☁ 다른 기기에서 저장된 더 최신 기록이 있습니다.';
  }

  var api = { decide: decide, newerText: newerText, dismissedStill: dismissedStill };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerNotices = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
