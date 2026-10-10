'use strict';
/* 푸른노무법인 정부사업신청 — 「📅 발주 예정」: 나라장터 «발주계획»과 «사전규격»
   (브라우저 window.GovPlan / Node module.exports 겸용, DOM·통신 없음 — 주소와 글자만 다룬다)

   대표 지시 2026-10-09 「정부사업이 현재 공고 이외 연초나 초기에 미리 언제 공고할 것인지 알리는 경우도
   많은 것 같은데 … 별도로 검토하고 가지고 올 수 있나?」 → 「진행」.

   ── 공공데이터포털 원문으로 확인한 것 (2026-10-09) ──
   ① 조달청_나라장터 발주계획현황서비스 (15129462)
      apis.data.go.kr/1230000/ao/OrderPlanSttusService/getOrderPlanSttusListServcPPSSrch  (용역)
      기관이 그 회계연도에 조달할 용역의 «분기별 발주계획»(발주 예정 시기·예산·계약방법·담당 연락처).
      요청: orderBgnYm·orderEndYm('YYYYMM', 발주년월) · inqryBgnDt·inqryEndDt('YYYYMMDDHHmm', 게시일시).
      ⚠ 원문 단서: 계획에 없던 공고가 나올 수도 있다 — 공고 모아보기를 «대신»하지 않는다.
   ② 조달청_나라장터 사전규격정보서비스 (15129437)
      apis.data.go.kr/1230000/ao/HrcspSsstndrdInfoService/getPublicPrcureThngInfoServcPPSSrch (용역)
      입찰공고 «전에» 규격을 미리 공개하는 절차(국가계약법·지방계약법) — 「곧 공고가 뜬다」는 신호.
      요청: inqryDiv=1(접수일시) · inqryBgnDt·inqryEndDt('YYYYMMDDHHmm').
   ⚠ CORS 는 열려 있다(2026-10-09 실측 — 우리 주소를 그대로 돌려주고 OPTIONS 200). 프록시 불필요.
   ⚠ 열쇠는 나라장터·알리오와 «같은» 공공데이터포털 열쇠지만 활용신청은 «서비스마다 따로»다.
   ⚠ 하루 1,000회(개발계정) — 처음 한 번만 올해 1월부터 채우고, 그 뒤엔 하루 한 번 «지난 며칠치»만. */
(function (root) {

  var PLAN_BASE = 'https://apis.data.go.kr/1230000/ao/OrderPlanSttusService/getOrderPlanSttusListServcPPSSrch';
  var SPEC_BASE = 'https://apis.data.go.kr/1230000/ao/HrcspSsstndrdInfoService/getPublicPrcureThngInfoServcPPSSrch';
  var PLAN_PAGE = 'https://www.data.go.kr/data/15129462/openapi.do';
  var SPEC_PAGE = 'https://www.data.go.kr/data/15129437/openapi.do';

  function s(v) { return v == null ? '' : String(v).trim(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* 이미 인코딩된 열쇠는 그대로 — 두 번 인코딩하면 영영 안 붙는다(GovG2b.encKey 와 같은 잣대) */
  function encKey(k) {
    var t = s(k);
    if (!t) return '';
    return /%[0-9A-Fa-f]{2}/.test(t) ? t : encodeURIComponent(t);
  }
  function toDate(d) { return (d instanceof Date) ? d : new Date(String(d)); }
  function stamp(d, endOfDay) {
    var t = toDate(d);
    return String(t.getFullYear()) + pad(t.getMonth() + 1) + pad(t.getDate()) + (endOfDay ? '2359' : '0000');
  }
  function ymd(d) { var t = toDate(d); return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate()); }

  function planUrl(o) {
    o = o || {};
    return PLAN_BASE + '?' + [
      'serviceKey=' + encKey(o.key), 'type=json',
      'pageNo=' + (o.page || 1), 'numOfRows=' + (o.rows || 999),
      'orderBgnYm=' + s(o.ymFrom), 'orderEndYm=' + s(o.ymTo),
      'inqryBgnDt=' + stamp(o.from, false), 'inqryEndDt=' + stamp(o.to, true)
    ].join('&');
  }
  function specUrl(o) {
    o = o || {};
    return SPEC_BASE + '?' + [
      'serviceKey=' + encKey(o.key), 'type=json',
      'pageNo=' + (o.page || 1), 'numOfRows=' + (o.rows || 999),
      'inqryDiv=1',                                         /* 1 = 접수일시 */
      'inqryBgnDt=' + stamp(o.from, false), 'inqryEndDt=' + stamp(o.to, true)
    ].join('&');
  }

  /* 긴 기간은 31일씩 나눠 묻는다 — 한 번에 몇 달을 물으면 「입력값 범위 초과」가 올 수 있고,
     한 묶음이 너무 커져 쪽 뚜껑에 걸린다. 끝 칸은 to 까지. */
  function windows(from, to, days) {
    var a = toDate(from), b = toDate(to), out = [], step = (days || 31) * 86400000;
    a = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    if (!(a <= b)) return out;
    for (var t = a.getTime(); t <= b.getTime(); t += step) {
      var e = Math.min(t + step - 86400000, b.getTime());
      out.push([new Date(t), new Date(e)]);
    }
    return out;
  }

  /* 입찰공고번호 목록 — 「R26BK01759874-000, R26BK01759875」 · 옛 꼴 「20160530525, 20160505996」.
     차수(-000)는 떼고 번호만 남긴다(공고 모아보기의 no 는 「번호-차수」다). */
  function bidsOf(v) {
    var out = [];
    (Array.isArray(v) ? v.join(',') : s(v)).split(/[,\s]+/).forEach(function (x) {
      var t = x.replace(/[\[\]"']/g, '').replace(/-\d{1,3}$/, '');
      if (t && /[0-9]/.test(t) && out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }
  function amount(v) { return Number(s(v).replace(/[^0-9]/g, '')) || 0; }

  /* 발주년월 — orderYear + orderMnth. 달은 「1」·「01」·「202610」 어느 꼴로 와도 받는다. 모르면 ''. */
  function ymOf(year, mnth) {
    var y = s(year).replace(/[^0-9]/g, ''), m = s(mnth).replace(/[^0-9]/g, '');
    if (m.length >= 6) { y = m.slice(0, 4); m = m.slice(4, 6); }
    var mi = Number(m);
    if (!/^\d{4}$/.test(y) || !(mi >= 1 && mi <= 12)) return '';
    return y + '-' + pad(mi);
  }

  /* 자세한 칸 — 팝업(상세)에서만 보인다. ⚠ «값이 있는 칸만» 담는다(빈 칸까지 담으면 줄마다 스무 칸이 붙어 저장이 부푼다).
     ⚠ 긴 글은 1,500자에서 자른다(규격·비고에 공문 통째가 들어오는 일이 있다). */
  var LONG = 1500;
  function extra(out, it, map) {
    Object.keys(map).forEach(function (k) {
      var v = s(it[map[k]]).replace(/\s+\n/g, '\n');
      if (v) out[k] = v.length > LONG ? v.slice(0, LONG) + '…' : v;
    });
    return out;
  }
  /* 발주계획 — 원문 명세(15129462)의 칸 이름 그대로 */
  var PLAN_MORE = { use: 'usgCntnts', specTx: 'specCntnts', qty: 'qtyCntnts', rmk: 'rmrkCntnts', period: 'cnstwkPrdCntnts',
    bizTy: 'bsnsTyNm', bizDiv: 'bsnsDivNm', jrsd: 'jrsdctnDivNm', cls: 'prdctClsfcNoNm', dcls: 'dtilPrdctClsfcNoNm',
    rdPlace: 'dsgnDocRdngPlceNm', rdPrd: 'dsgnDocRdngPrdCntnts' };
  /* 사전규격 — 원문 명세(15129437) */
  var SPEC_MORE = { rgstDt: 'rgstDt', dlvrDt: 'dlvrTmlmtDt', dlvrDays: 'dlvrDaynum', sw: 'swBizObjYn', items: 'prdctDtlList',
    bizDiv: 'bsnsDivNm' };

  function normPlan(it) {
    it = it || {};
    var no = s(it.orderPlanUntyNo) ||
      (s(it.orderInsttCd) && s(it.orderPlanSno) ? 'P' + s(it.orderInsttCd) + '-' + s(it.orderYear) + '-' + s(it.orderPlanSno) : '');
    var o = extra({
      kind: 'plan', no: no, nm: s(it.bizNm) || s(it.prdctClsfcNoNm),
      org: s(it.orderInsttNm), top: s(it.totlmngInsttNm),
      ym: ymOf(it.orderYear, it.orderMnth),
      prc: amount(it.sumOrderAmt) || amount(it.orderContrctAmt),
      mthd: s(it.cntrctMthdNm), how: s(it.prcrmntMethd),
      dept: s(it.deptNm), ofcl: s(it.ofclNm), tel: s(it.telNo),
      bids: bidsOf(it.bidNtceNoList), postDt: s(it.nticeDt), chgDt: s(it.chgDt)
    }, it, PLAN_MORE);
    var cAmt = amount(it.orderContrctAmt);
    if (cAmt && cAmt !== o.prc) o.cAmt = cAmt;   /* 합계와 다를 때만 — 같으면 두 번 적을 까닭이 없다 */
    if (o.cls === o.nm) delete o.cls;
    return o;
  }
  function normSpec(it) {
    it = it || {};
    var files = [];
    for (var i = 1; i <= 5; i++) {
      var f = s(it['specDocFileUrl' + i]);
      if (/^https:\/\//.test(f) && files.indexOf(f) < 0) files.push(f);
    }
    return extra({
      kind: 'spec', no: s(it.bfSpecRgstNo) ? 'S' + s(it.bfSpecRgstNo) : '',
      nm: s(it.prdctClsfcNoNm), org: s(it.rlDminsttNm) || s(it.orderInsttNm), ntce: s(it.orderInsttNm),
      prc: amount(it.asignBdgtAmt), rcptDt: s(it.rcptDt), closeDt: s(it.opninRgstClseDt),
      ofcl: s(it.ofclNm), tel: s(it.ofclTelNo), refNo: s(it.refNo),
      bids: bidsOf(it.bidNtceNoList), files: files, chgDt: s(it.chgDt)
    }, it, SPEC_MORE);
  }

  /* 응답 풀기 — 나라장터 입찰공고와 같은 봉투(GovG2b.parse 와 같은 잣대).
     ⚠ items 는 배열·객체 하나·없음 셋 다 온다. */
  function parse(json, kind) {
    if (!json) return { ok: false, err: '빈 응답', rows: [], total: 0 };
    var bad = json.OpenAPI_ServiceResponse && json.OpenAPI_ServiceResponse.cmmMsgHeader;
    if (bad) return { ok: false, rows: [], total: 0, err: s(bad.returnAuthMsg || bad.errMsg) || '알 수 없는 오류', code: s(bad.returnReasonCode) };
    var r = json.response || {}, code = r.header && s(r.header.resultCode);
    if (code && code !== '00' && code !== '0') return { ok: false, rows: [], total: 0, err: s(r.header && r.header.resultMsg) || ('오류 코드 ' + code), code: code };
    var body = r.body || {}, items = body.items || [];
    if (!Array.isArray(items)) items = items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : [items];
    var norm = kind === 'spec' ? normSpec : normPlan;
    return { ok: true, err: '', total: Number(body.totalCount || items.length) || 0,
             rows: items.map(norm).filter(function (x) { return !!x.no && !!x.nm; }) };
  }

  /* 활용신청이 아직 승인되지 않았을 때의 말 — 「서비스 접근거부」(코드 20) 만으로는 무엇을 하면 되는지 모른다 */
  function errSay(name, o) {
    var e = s(o && o.err);
    if (/접근거부|SERVICE_KEY|등록되지 않은|NOT_REGISTERED|ACCESS_DENIED/i.test(e) || s(o && o.code) === '20' || s(o && o.code) === '30')
      return name + ': 아직 못 받습니다 — 공공데이터포털 «활용신청 승인»을 기다리는 중일 수 있습니다(승인은 보통 바로~하루)'
        /* 원래 말·코드도 붙인다 — 「승인 대기」(20)인지 「열쇠가 이 서비스에 안 묶임」(30)인지 갈라 볼 수 있게 (2026-10-10) */
        + ' [' + (s(o && o.code) ? '코드 ' + s(o.code) + ' · ' : '') + (e || '알 수 없음') + ']';
    return name + ': ' + (e || '받지 못했습니다');
  }

  /* ── 합치기 ──
     ⚠ 이미 있는 줄은 «공고 사실»(번호·금액·예정월·입찰공고번호…)만 새것으로 바꾸고,
       사람이 한 것(★ 관심 · 숨김)은 그대로 둔다. 입찰공고가 나오면 bids 가 채워져 「공고 나옴」으로 바뀐다.
     judgeFn(row) → 걸린 낱말 배열(공고 모아보기와 «같은» 찾는 말 — GovG2b.judge). */
  var USER = ['star', 'hidden', 'id', 'savedAt'];
  function merge(existing, incoming, judgeFn, nowIso) {
    var list = (existing || []).filter(Boolean).map(function (r) { return Object.assign({}, r); });
    var at = {};
    list.forEach(function (r, i) { if (r.no) at[r.no] = i; });
    var added = 0, updated = 0, unmatched = 0;
    (incoming || []).forEach(function (r) {
      if (!r || !r.no) return;
      var hit = judgeFn ? judgeFn({ src: '나라장터', nm: r.nm }) : [];
      if (at[r.no] != null) {
        var cur = list[at[r.no]], next = Object.assign({}, r, { kw: cur.kw || hit.join(',') });
        USER.forEach(function (k) { if (cur[k] !== undefined) next[k] = cur[k]; });
        if (JSON.stringify(next) !== JSON.stringify(cur)) { list[at[r.no]] = next; updated++; }
        return;
      }
      if (!hit.length) { unmatched++; return; }
      at[r.no] = list.length;
      list.push(Object.assign({}, r, { kw: hit.join(','), savedAt: nowIso || '' }));
      added++;
    });
    return { list: list, added: added, updated: updated, unmatched: unmatched };
  }

  /* ── 지금 어디쯤인가 ──
     posted 공고 나옴 · spec 사전규격(공고 임박) · late 예정월 지났는데 아직 공고 없음 · soon 이번 달·다음 달 · later 그 뒤 · unknown 예정월 모름 */
  function monthsBetween(a, b) {   /* 'YYYY-MM' 두 개 — b 가 a 보다 몇 달 뒤 */
    return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
  }
  function state(r, today) {
    r = r || {};
    var cur = s(today).slice(0, 7) || ymd(new Date()).slice(0, 7);
    if (r.bids && r.bids.length) return { k: 'posted', label: '✅ 공고 나옴' };
    if (r.kind === 'spec') {
      var c = s(r.closeDt).slice(0, 10);
      return { k: 'spec', label: '🔔 공고 임박' + (c ? ' · 의견 마감 ' + c.slice(5).replace('-', '.') : '') };
    }
    if (!r.ym) return { k: 'unknown', label: '예정월 모름' };
    var d = monthsBetween(cur, r.ym);
    if (d < 0) return { k: 'late', label: '⚠ 예정월 지남 · 아직 공고 없음' };
    if (d === 0) return { k: 'soon', label: '⏳ 이번 달 발주 예정' };
    if (d === 1) return { k: 'soon', label: '⏳ 다음 달 발주 예정' };
    return { k: 'later', label: d + '개월 뒤 발주 예정' };
  }

  /* 공고 모아보기에 이미 받은 그 입찰공고 — 번호(차수 뗀 것)로 잇는다 */
  function linked(r, feed) {
    var want = (r && r.bids) || [];
    if (!want.length) return [];
    return (feed || []).filter(function (f) {
      return f && want.indexOf(s(f.no).replace(/-\d{1,3}$/, '')) >= 0;
    });
  }

  /* 오래된 것 덜어내기 — 예정월이 13달 넘게 지났거나 사전규격 접수가 120일 넘은 줄.
     ⚠ ★ 관심을 켠 줄은 남긴다. */
  function prune(list, today) {
    var cur = s(today).slice(0, 10) || ymd(new Date());
    return (list || []).filter(function (r) {
      if (!r) return false;
      if (r.star) return true;
      if (r.kind === 'spec') {
        var t = Date.parse(s(r.rcptDt).slice(0, 10) + 'T00:00:00Z'), n = Date.parse(cur + 'T00:00:00Z');
        return !(t && n && (n - t) / 86400000 > 120);
      }
      return !(r.ym && monthsBetween(r.ym, cur.slice(0, 7)) > 13);
    });
  }

  var api = { PLAN_BASE: PLAN_BASE, SPEC_BASE: SPEC_BASE, PLAN_PAGE: PLAN_PAGE, SPEC_PAGE: SPEC_PAGE,
              encKey: encKey, planUrl: planUrl, specUrl: specUrl, windows: windows, bidsOf: bidsOf, ymOf: ymOf,
              normPlan: normPlan, normSpec: normSpec, parse: parse, errSay: errSay, merge: merge,
              state: state, linked: linked, prune: prune, ymd: ymd, PLAN_MORE: PLAN_MORE, SPEC_MORE: SPEC_MORE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovPlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
