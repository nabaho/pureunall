/* 📥 메일로 업체 담당자 채우기 — 셈 «한 벌» (2026-10-07 기업정보함 점검 ③-A)
   ═══════════════════════════════════════════════════════════════════════════
   화면(pu-cards.html 의 mnewDomTable·mnewDomCo·erpFillContactPlan)과 서버(functions/mail-fill.js)가
   «같은 셈»을 쓴다. 두 벌로 두면 한쪽만 고쳐져, 화면은 안 채우는 것을 서버가 채운다.
   ⚠ 서버에는 js/ 가 안 올라간다 — functions/mail-fill-core/ 에 «글자 그대로» 사본을 둔다.
     고칠 곳은 늘 여기(js/)다. 고친 뒤:  node scripts/sync-mail-fill-core.js  → mailSync 다시 배포.
     tests/mail-fill-core-in-sync.test.js 가 둘이 한 글자라도 다르면 걸린다.
   ⚠ 이름 다듬개(norm·nameHit)는 pu-cards.html 의 ErpMatch._norm·_nameHit 과 «글자까지 같다»
     (같은 검사가 견준다). 서버에는 ErpMatch 가 없어서 여기 한 벌을 둔다.
   ⚠ 예시는 가짜다(가나상사·홍길동). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuMailFill = api;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  function norm(s){ return String(s||'').toLowerCase()
      .replace(/㈜|\(주\)|주식회사|주\)|\(유\)|유한회사|농업회사법인|유한책임회사|합자회사|합명회사|재단법인|사단법인|의료법인|\(재\)|\(사\)/g,'')
      .replace(/[\s\-_.,·・()[\]{}'"]/g,''); }
  function nameHit(a,b){ if(!a||!b) return false; return a===b || a.indexOf(b)===0 || b.indexOf(a)===0; }

  function domOf(email){
    var e = String(email||'').toLowerCase();
    var at = e.lastIndexOf('@');
    return at > 0 ? e.slice(at + 1) : '';
  }

  /* 도메인 → 그 도메인을 쓰는 업체들. 끝난 업체(closed·terminated·inactive)와 지운 업체는 뺀다. */
  function domTable(cos){
    var by = {};
    (cos || []).forEach(function(co){
      if(!co || !co.id || co._deleted || /closed|terminated|inactive/.test(String(co.status||''))) return;
      [co.email, co.primaryContactEmail].concat((co.contacts||[]).map(function(c){ return c && c.email; })).forEach(function(e){
        var d = domOf(String(e||'').trim().toLowerCase()); if(!d) return;
        var t = by[d] || (by[d] = { ids:[], co:null });
        if(t.ids.indexOf(String(co.id)) < 0){ t.ids.push(String(co.id)); t.co = co; }
      });
    });
    return by;
  }

  /* 회사 도메인이 업체 «한 곳»과만 같은가 — 그 업체 기록, 아니면 null.
     ⚠ 무료메일·공공기관 도메인은 안 본다(isPub). 둘 이상이면 안 짚는다(그룹사·세무사무소). */
  function domCo(em, byDom, isPub){
    var d = domOf(em);
    if(!d || (typeof isPub === 'function' && isPub(d))) return null;
    var set = byDom[d];
    if(!set || set.ids.length !== 1) return null;
    return set.co;
  }

  /* 업체 한 건(cur)을 받아 바꿀 칸을 돌려준다 — 서버 판으로 «다시» 불릴 수 있다.
     t: { name, role, phone, from, mode }, em: 소문자 주소, by: 누가(로그인 메일·「서버」), now: 시각
     돌려주는 것: { fields:{…}, info:{added:true,…} } 또는 { none:true, info:{added:false, why} } */
  function fillPlan(cur, t, em, by, now){
    t = t || {}; now = Number(now) || Date.now();
    var arr = (cur.contacts||[]).map(function(c){ return Object.assign({}, c); });
    var has = arr.filter(function(c){ return String(c.email||'').trim().toLowerCase()===em; })[0];
    /* ⚠ 이미 적혀 있으면 «아무것도 안 한다» — 덮으면 남이 고쳐 둔 것이 조용히 사라진다.
         그런데 «실패»는 아니다. 한꺼번에 적을 때 이것을 실패로 세면 다 틀린 것처럼 보인다. */
    if(has) return { none:true, info:{ added:false, why:'이미 그 업체 담당자로 적혀 있습니다' } };
    /* 바뀐 것이면 전임자에게 «떠났다» 표를 붙인다 */
    var leftN = 0;
    if(t.mode === 'replace'){
      arr.forEach(function(c){ if(String(c.email||'').trim() && !c.left){ c.left = true;
        c.leftAt = now; leftN++; } });
    }
    /* ⚠ 「누가·언제」를 남긴다 (대표 지시 2026-09-03 「되돌릴 수 있어야 한다」) —
         메일함에서 적은 것을 나중에 가려내려면 이 표가 있어야 한다. */
    arr.push({ id:'mc-' + now.toString(36) + Math.random().toString(36).slice(2,5),
      name:String(t.name||'').trim(), role:String(t.role||'').trim(),
      phone:String(t.phone||'').trim(), bizPhone:'', fax:'', email:em,
      addedFrom: String(t.from||'mail'), addedBy: String(by||''), addedAt: now,
      isPrimary: (t.mode === 'replace' || !arr.filter(function(c){ return c.isPrimary && !c.left; }).length) });
    /* ══════ 대표 담당자 거울 칸 — «빈 칸만», 그리고 «한 사람»이어야 한다 ══════
       ⚠ 이 셋(이름·이메일·전화)은 «한 사람»을 가리킨다. 칸마다 따로 「비었으면 채운다」로만 보면
         이름 칸에 이미 다른 사람이 있는데 이메일만 채워, 한 줄이 «두 사람»을 섞어 적게 된다
         (대표 검토 2026-10-03 — 이름·전화는 그 회사 사람, 이메일만 세무사무실 사람).
       ★ 그래서 이름 칸이 «이미 다른 사람»이면 거울 칸을 아예 안 건드린다.
         잃는 것은 없다 — 담당자 목록(contacts)에는 그대로 들어간다. 거울 칸은 «요약»일 뿐이다.
       ⚠ 들어오는 이름이 «없으면» 같은 사람인지 알 길이 없다 — 그때도 안 건드린다.
       ⚠ 「이 사람으로 바꾼다」(mode==='replace')는 사람이 또렷이 고른 길이라 그대로 덮는다. */
    var blank = function(x){ return x===undefined || x===null || String(x).trim()===''; };
    var curNm = String(cur.primaryContactName||'').trim();
    var newNm = String(t.name||'').trim();
    var samePerson = blank(curNm) || (!!newNm && nameHit(norm(curNm), norm(newNm)));
    var patch = { contacts:arr };
    if(t.mode === 'replace' || (blank(cur.primaryContactEmail) && samePerson)){
      patch.primaryContactEmail = em;
      if(newNm && blank(cur.primaryContactName))
        patch.primaryContactName = newNm;
      if(String(t.phone||'').trim() && blank(cur.primaryContactPhone))
        patch.primaryContactPhone = String(t.phone).trim();
    }
    return { fields:patch, info:{ added:true, leftN:leftN, coName:String(cur.name||'') } };
  }

  return { norm:norm, nameHit:nameHit, domOf:domOf, domTable:domTable, domCo:domCo, fillPlan:fillPlan };
});
