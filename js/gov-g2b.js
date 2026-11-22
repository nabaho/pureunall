'use strict';
/* 푸른노무법인 정부사업신청 — 나라장터(조달청) 용역 입찰공고 받아오기
   (브라우저 window.GovG2b / Node module.exports 겸용, DOM·통신 없음 — 주소와 글자만 다룬다)

   대표 지시 2026-09-05 「나라장터에 나오는 사업등도 연결해서 한번에 정리」.

   ── 실측으로 확인한 것 (2026-09-05) ──
   ⚠★ 주소에 «/ad/» 가 들어간다. 없으면 「해당 오픈API 서비스가 없거나 폐기됨」이 온다.
        ○ apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc
        ✗ apis.data.go.kr/1230000/BidPublicInfoService/...      ← 흔히 도는 옛 주소
   ⚠ CORS 는 «열려 있다» — 응답이 Access-Control-Allow-Origin 에 우리 주소를 그대로 돌려주고
     사전요청(OPTIONS)도 200 을 준다. 그래서 프록시 서버가 필요 없다. 다시 만들지 말 것.
   ⚠ HTTPS 로 붙는다(HSTS 있음). http 로 적으면 github.io 에서 혼합콘텐츠로 막힌다.
   ⚠ 하루 1,000회(개발계정) — 화면을 열 때마다 부르면 안 된다. 하루 한 번 + 손으로 누를 때만. */
(function (root) {

  var BASE = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService/getBidPblancListInfoServc';

  /* 대표가 고른 낱말(2026-09-05). 처음 여덟에서 「교육」을 뺐다 — 대표 지시 2026-09-06.
     ⚠★ 「교육」을 되살리지 말 것. 클린아이 90일치 410건 실측에서 낱말에 걸린 9건이
       «전부» 「평생교육진흥원 직원 채용」·「교육재단 계약직」 오탐이었다 —
       노무 관련은 한 건도 없었다. 어느 출처에 붙여도 같은 일이 난다.
     늘리기는 쉽지만 넓히면 잡음이 수백 건이다. 좁게 시작해 늘린다. */
  /* 찾는 말 — 대표 결정 2026-10-03 「제안대로 바꾼다」·「위험성평가 넣는다」.
     ⚠ 「교육」은 넣지 않는다(2026-09-06 대표 지시 — 평생교육진흥원 직원채용 오탐).
     뒤 셋(인사·고용·컨설팅)은 «약한 말»이다 — WEAK 참조. */
  var KEYWORDS_DEFAULT = ['노무', '노사', '임금', '일터혁신', '조직진단', '직무분석', '근무평정',
                          '평가체계', '취업규칙', '직장내괴롭힘', '위험성평가', '인사', '고용', '컨설팅'];

  /* ── 걸러내기 규칙 (대표 결정 2026-10-03, 실측 7일치 3,602건) ──
     옛 방식(낱말이 «하나라도» 있으면 걸림)은 53건 중 42건이 잡음이었다 —
     「컨설팅」이 LNG·AI·특허·마케팅까지, 「고용」이 고용노동부 «관용차 임차»까지 걸렸다.
     새 방식은 9건이고 9건 모두 쓸 만했다(조직진단·근무평정 대행처럼 놓치던 것이 들어왔다).
     ① 약한 말(WEAK)은 «업무 분야 말(FIELD)»이 함께 있을 때만 걸린다.
     ② 기관 이름(ORG)에 든 낱말은 지우고 본다 — 「한국고용정보원 회계감사」는 고용 일이 아니다.
     ③ 빼는 말(DROP)이 있으면 걸지 않는다.
     ⚠ 세 목록은 «실측한 것만» 더한다. 짐작으로 늘리면 놓치는 공고가 생긴다. */
  var WEAK = ['인사', '고용', '컨설팅'];
  var FIELD = ['인사', '노무', '노사', '조직', '직무', '근무', '보상', '임금', '안전보건', '위험성', '고객만족', '제도'];
  var DROP = ['단기노무원', '관용차', '차량', '임차', '회계감사', '유지관리', '홍보', '시스템', '플랫폼',
              '청년인턴', '공무직', '시설정비', '파견대행', '해외연수'];
  var ORG = ['고용노동부', '고용노동청', '고용센터', '한국고용정보원', '장애인고용공단', '인사혁신처',
             '보훈특별고용', '노사발전재단'];
  /* 알리오는 «직원 채용» 창구다 — 실측 525건 거의 전부. 대표 결정 「위원·고문 위촉만 본다」. */
  var ALIO_NEED = /위원|고문|자문/;
  var ALIO_NOT = /채용|직원|위촉직|위촉연구|연구위원|연구직|인턴|기간제|근로자|연수연구/;

  /* ── 인증키 함정 ──
     공공데이터포털은 열쇠를 «두 벌» 준다: Encoding(%2B…) 과 Decoding(+…).
     이미 인코딩된 열쇠를 또 인코딩하면 %2B → %252B 가 되어 영영 안 붙는다.
     그래서 «이미 인코딩된 것으로 보이면 그대로 쓴다». */
  function encKey(k) {
    var s = String(k || '').trim();
    if (!s) return '';
    return /%[0-9A-Fa-f]{2}/.test(s) ? s : encodeURIComponent(s);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* 조회 구간은 YYYYMMDDHHmm 열두 자리다 */
  function stamp(d, endOfDay) {
    var t = (d instanceof Date) ? d : new Date(String(d));
    /* 서울 날짜로 만든다 — 서버(UTC)에서 돌아도 하루가 밀리지 않게. 07:40(서울)은 UTC 로는 «전날» 22:40 이다 */
    var k = new Date(t.getTime() + 9 * 3600000);
    return String(k.getUTCFullYear()) + pad(k.getUTCMonth() + 1) + pad(k.getUTCDate()) +
           (endOfDay ? '2359' : '0000');
  }

  /* ── 한 번에 물을 수 있는 기간 ──
     ⚠★ 2026-11-10 부터 «7일»(공공데이터포털 15129394 공지 — 전체 오퍼레이션, 이전 1개월).
       stamp 가 시작은 00:00, 끝은 23:59 로 채우므로 «오늘 포함 7일» = 시작 날을 끝 날의 6일 전으로 잡는다.
       ⚠ 7일 전으로 잡으면 8일치가 되어 거절된다(그동안 그랬다). 지난 공고를 몰아 받을 때도 이 창으로 자른다(weekWindows). */
  var WINDOW_DAYS = 7;
  function recentFrom(to) { var t = (to instanceof Date) ? to : new Date(); return new Date(t.getTime() - (WINDOW_DAYS - 1) * 86400000); }
  /* from ~ to 를 «7일 창»으로 자른다 — 최근 창부터(가까운 것을 먼저 받는다). [[from,to], …] */
  function weekWindows(from, to) {
    var out = [], end = new Date(to.getTime());
    while (end.getTime() >= from.getTime()) {
      var st = new Date(end.getTime() - (WINDOW_DAYS - 1) * 86400000);
      if (st.getTime() < from.getTime()) st = new Date(from.getTime());
      out.push([st, end]);
      end = new Date(st.getTime() - 86400000);
    }
    return out;
  }

  function buildUrl(o) {
    o = o || {};
    var q = [
      'serviceKey=' + encKey(o.key),
      'type=json',
      'inqryDiv=1',                                   /* 1 = 공고게시일시 기준 */
      'inqryBgnDt=' + stamp(o.from, false),
      'inqryEndDt=' + stamp(o.to, true),
      'pageNo=' + (o.page || 1),
      'numOfRows=' + (o.rows || 999)
    ];
    return BASE + '?' + q.join('&');
  }

  /* ── 응답 풀기 ──
     잘 되면 { response:{ header:{resultCode}, body:{ items, totalCount } } }
     틀리면 { OpenAPI_ServiceResponse:{ cmmMsgHeader:{ errMsg, returnAuthMsg } } }
     ⚠ items 는 «배열일 때도, 객체 하나일 때도, 아예 없을 때도» 있다. 셋 다 받아야 한다. */
  function parse(json) {
    if (!json) return { ok: false, err: '빈 응답', rows: [], total: 0 };
    /* ⚠★ 나라장터 오류는 «HTTP 200 + {"nkoneps.com.response.ResponseError":{header:{resultCode,resultMsg}}}» 로도 온다
         (상세 조회 parseDetail 에서 2026-10-24 실측). 목록 풀기가 이 모양을 몰라 «0건 받음(정상)»으로 넘겼다 —
         2026-11-10 조회기간이 1개월 → 7일로 줄었는데(공공데이터포털 공지) 8일치를 묻던 화면·서버가 날마다 «나라장터 0건»이었다(11-16 갈무리).
         03(데이터 없음)만 «빈 결과»이고 나머지는 오류다. */
    var ek = Object.keys(json).filter(function (k) { return /ResponseError$/.test(k); })[0];
    if (ek) {
      var eh = (json[ek] && json[ek].header) || {}, ec = String(eh.resultCode || '');
      if (ec === '03') return { ok: true, err: '', rows: [], total: 0 };
      return { ok: false, rows: [], total: 0, err: String(eh.resultMsg || ('오류 코드 ' + ec)) + (ec ? ' (' + ec + ')' : '') };
    }
    var bad = json.OpenAPI_ServiceResponse && json.OpenAPI_ServiceResponse.cmmMsgHeader;
    if (bad) {
      return { ok: false, rows: [], total: 0,
               err: String(bad.returnAuthMsg || bad.errMsg || '알 수 없는 오류') };
    }
    var r = json.response || {};
    var code = r.header && String(r.header.resultCode || '');
    if (code && code !== '00' && code !== '0') {
      return { ok: false, rows: [], total: 0,
               err: String((r.header && r.header.resultMsg) || ('오류 코드 ' + code)) };
    }
    var body = r.body || {};
    var items = body.items;
    if (!items) items = [];
    if (!Array.isArray(items)) items = (items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : [items]);
    return { ok: true, err: '', total: Number(body.totalCount || items.length) || 0,
             rows: items.map(norm).filter(function (x) { return !!x.no; }) };
  }

  /* ── 공고 첨부 서식 (대표 지시 2026-11-22 「사업 신청서 그리고 관련되는 서식을 다 끌어오고 모으고」) ──
     목록 응답의 한 줄에 «공고규격서» 칸이 열 벌 붙어 온다: ntceSpecDocUrl1~10 · ntceSpecFileNm1~10, 표준 공고서는 stdNtceDocUrl.
     ⚠ 파일은 받지 않는다 — 이름과 «내려받기 주소»만 모은다(나라장터 파일 서버는 다른 사이트라 화면이 직접 못 받는다).
     ⚠ http(s) 만 · 아이디·비밀번호가 박힌 주소는 버린다 · 같은 주소는 한 번만. ★ 칸 이름은 명세 기준 — 실응답으로는 아직 못 봤다.
     ⚠ «나라장터 공식 주소»(g2b.go.kr 과 그 아래)만 받는다 — 칸이 오염돼 다른 사이트를 «나라장터 서식»으로 보이면 안 된다(보안 검토 2026-11-22).
       뺀 것은 개수(dropped)로 알린다 — 조용히 사라지면 «서식 없음»으로 읽힌다. */
  var G2B_HOST = /(^|\.)g2b\.go\.kr$/i;
  function fileUrl(v) {
    var u = s(v); if (!/^https?:\/\/[^\s"'<>\\]+$/i.test(u)) return '';
    if (typeof URL !== 'function') {   /* 해석기가 없는 곳(옛 환경) — 아이디 박힌 주소·공식 밖 주소를 글자로 거른다 */
      var m = u.match(/^https?:\/\/([^\/?#@:]+)(:\d+)?(?=[\/?#]|$)/i);
      return m && G2B_HOST.test(m[1]) ? u : '';
    }
    try {
      var p = new URL(u);
      if (!/^https?:$/.test(p.protocol) || p.username || p.password || !G2B_HOST.test(p.hostname)) return '';
      return p.href;
    } catch (e) { return ''; }
  }
  function specFiles(it, out2) {
    it = it || {};
    var out = [], seen = {}, dropped = 0;
    var add = function (url, name) {
      if (!s(url)) return;
      var u = fileUrl(url); if (!u) { dropped++; return; }
      if (seen[u]) return; seen[u] = 1;
      out.push({ name: s(name).slice(0, 120) || ('첨부 ' + (out.length + 1)), url: u });
    };
    add(it.stdNtceDocUrl, '표준 공고서');
    for (var i = 1; i <= 10; i++) add(it['ntceSpecDocUrl' + i], it['ntceSpecFileNm' + i]);
    if (out2) out2.dropped = dropped;
    return out;
  }
  /* 공고일 하루치 목록 응답에서 «그 공고»(번호·차수)를 찾아 서식을 꺼낸다 → { ok, err, found, files, total, count }
     ⚠ 오류 모양은 parse 와 같다(HTTP 200 ResponseError 포함) — 오류를 «서식 없음»으로 읽지 않는다. */
  function filesFrom(json, no) {
    var p = parse(json);
    if (!p.ok) return { ok: false, err: p.err, found: false, files: [], dropped: 0, total: 0, count: 0 };
    var r = (json && json.response) || {}, items = (r.body || {}).items;
    if (!items) items = [];
    if (!Array.isArray(items)) items = (items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : [items]);
    var want = s(no), hit = items.filter(function (it) { return it && norm(it).no === want; })[0], o = { dropped: 0 };
    var files = hit ? specFiles(hit, o) : [];
    return { ok: true, err: '', found: !!hit, files: files, dropped: o.dropped, total: p.total, count: items.length };
  }

  function s(v) { return v == null ? '' : String(v).trim(); }

  /* 칸 이름이 판마다 조금씩 다르다 — 아는 이름을 차례로 본다 */
  function norm(it) {
    it = it || {};
    return {
      src:   '나라장터',
      no:    s(it.bidNtceNo) + (s(it.bidNtceOrd) ? '-' + s(it.bidNtceOrd) : ''),
      nm:    s(it.bidNtceNm),
      inst:  s(it.dminsttNm) || s(it.ntceInsttNm),      /* 수요기관을 먼저 */
      ntce:  s(it.ntceInsttNm),
      openDt: s(it.bidNtceDt),
      closeDt: s(it.bidClseDt) || s(it.opengDt),
      prc:   Number(String(it.presmptPrce || it.asignBdgtAmt || '').replace(/[^0-9]/g, '')) || 0,
      mthd:  s(it.cntrctCnclsMthdNm),
      url:   s(it.bidNtceDtlUrl),
      /* 제한 표시 — 목록에 있는 것만(참가 가능 지역·면허 이름은 따로 불러야 한다: detailUrl). 있을 때만 담는다 */
      indY:  s(it.indstrytyLmtYn) === 'Y' ? 'Y' : '',
      jnt:   [s(it.jntcontrctDutyRgnNm1), s(it.jntcontrctDutyRgnNm2), s(it.jntcontrctDutyRgnNm3)].filter(Boolean).join(' · ')
    };
  }

  /* ── 지역·업종 제한 (대표 지시 2026-10-19 「지역제한이나 업종제한이 있는 경우 표시」) ──
     나라장터 용역 공고 목록은 «제한이 있다/없다»만 주고 이름은 따로 부르는 두 서비스에 있다:
       참가가능지역 getBidPblancListInfoPrtcptPsblRgn → prtcptPsblRgnNm
       면허제한      getBidPblancListInfoLicenseLimit    → lcnsLmtNm · permsnIndstrytyList · indstrytyMfrcFldList
     ⚠ 이 둘은 «공고마다 한 번씩» 부른다(하루 1,000회) — 걸러낸 공고에만, 한 번 본 공고는 lk 표시로 다시 안 부른다.
     ⚠ 열쇠는 같아도 활용신청은 서비스마다 따로다 — 승인 전이면 못 받는다. 못 받아도 공고 자체는 그대로(조용히 건너뛴다).
     ★ 실호출로 확인(2026-10-24, 대표 키): 조회구분 inqryDiv=2 + bidNtceNo + **bidNtceOrd(차수) 필수** — 차수가 없으면 `{"nkoneps.com.response.ResponseError":{header:{resultCode:"08",resultMsg:"필수값 입력 에러"}}}` 가 HTTP 200 으로 온다.
        그 오류 모양을 «정상(빈 결과)»으로 읽어 «제한 없음»으로 굳힐 뻔했다(lk '1' 이 그것 — 지금은 '2' 만 «제대로 본 것»이다).
     ★ 응답 칸: 지역 prtcptPsblRgnNm(「충청남도 공주시」처럼 시군까지) · 면허 lcnsLmtNm(「정보통신공사업/0036」) — permsnIndstrytyList·indstrytyMfrcFldList 는 비어 오는 일이 많다. */
  var LK = '2';   /* «제대로 본» 표시 — 1 은 차수를 빠뜨려 헛 조회였던 옛 표시라 다시 본다 */
  var DETAIL_BASE = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService/';
  var DETAIL_OP = { rgn: 'getBidPblancListInfoPrtcptPsblRgn', lic: 'getBidPblancListInfoLicenseLimit' };
  function bidNo(no) { return s(no).split('-')[0]; }
  function bidOrd(no) { var o = s(no).split('-')[1]; return /^\d{1,3}$/.test(s(o)) ? s(o) : '000'; }
  function detailUrl(o) {
    o = o || {};
    var q = [
      'serviceKey=' + encKey(o.key), 'type=json',
      'inqryDiv=2', 'bidNtceNo=' + encodeURIComponent(bidNo(o.no)), 'bidNtceOrd=' + encodeURIComponent(bidOrd(o.no)),
      'pageNo=1', 'numOfRows=100'
    ];
    return DETAIL_BASE + DETAIL_OP[o.kind === 'lic' ? 'lic' : 'rgn'] + '?' + q.join('&');
  }
  function uniq(list) { var seen = {}; return list.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  /* 응답 → { ok, err, names[] } — kind 'rgn' 은 지역 이름, 'lic' 는 면허·업종 이름 */
  function parseDetail(json, kind) {
    if (!json) return { ok: false, err: '빈 응답', names: [] };
    var bad = json.OpenAPI_ServiceResponse && json.OpenAPI_ServiceResponse.cmmMsgHeader;
    if (bad) return { ok: false, err: String(bad.returnAuthMsg || bad.errMsg || '알 수 없는 오류'), names: [] };
    /* ⚠ 오류 모양이 둘이다 — 최상위 열쇠가 「nkoneps.com.response.ResponseError」 인 것(필수값 빠짐 등, HTTP 200). «정상(빈 결과)»으로 읽으면 안 된다 */
    var errKey = Object.keys(json).filter(function (k) { return /ResponseError/i.test(k); })[0];
    var eh = errKey && json[errKey] && json[errKey].header;
    if (eh) { var ec = String(eh.resultCode || ''); return ec === '03' ? { ok: true, err: '', names: [] } : { ok: false, err: String(eh.resultMsg || ('오류 코드 ' + ec)), names: [] }; }
    if (!json.response) return { ok: false, err: '알 수 없는 응답', names: [] };
    var r = json.response, code = r.header && String(r.header.resultCode || '');
    if (code === '03') return { ok: true, err: '', names: [] };   /* 데이터 없음 — 제한이 없는 공고 */
    if (code && code !== '00' && code !== '0') return { ok: false, err: String((r.header && r.header.resultMsg) || ('오류 코드 ' + code)), names: [] };
    var items = (r.body || {}).items;
    if (!items) items = [];
    if (!Array.isArray(items)) items = (items.item ? (Array.isArray(items.item) ? items.item : [items.item]) : [items]);
    var names = [];
    items.forEach(function (it) {
      if (!it) return;
      if (kind === 'lic') ['lcnsLmtNm', 'permsnIndstrytyList', 'indstrytyMfrcFldList'].forEach(function (k) { if (s(it[k])) names.push(s(it[k]).slice(0, 80)); });
      else if (s(it.prtcptPsblRgnNm)) names.push(s(it.prtcptPsblRgnNm));
    });
    return { ok: true, err: '', names: uniq(names) };
  }
  /* 목록 줄에 지역·업종 제한을 «붙인다» (통신은 getJson 으로 받는다 — 이 모듈은 통신을 모른다)
     rows: 줄 배열(no 가 있는 나라장터 줄) — 제자리에서 rgn·ind·lk 를 채운다. o = { key, max(기본 60), pool(기본 3) }
     ⚠ 이미 lk===LK('2') 인 줄·나라장터가 아닌 줄은 건너뛴다. 둘 다 승인 전이어 «전부» 실패하면 lk 를 안 남긴다(승인 뒤 다시 본다). */
  function enrich(rows, getJson, o) {
    o = o || {};
    var todo = (rows || []).filter(function (r) { return r && r.no && r.lk !== LK && (r.src || guessSrc(r.no)) === '나라장터'; }).slice(0, o.max || 60);
    var done = 0, failed = 0, idx = 0;
    function one(r) {
      function ask(kind) {
        return Promise.resolve().then(function () { return getJson(detailUrl({ key: o.key, no: r.no, kind: kind })); })
          .then(function (j) { return parseDetail(j, kind); }, function () { return { ok: false, err: '받지 못했습니다', names: [] }; });
      }
      return Promise.all([ask('rgn'), ask('lic')]).then(function (res) {
        if (!res[0].ok && !res[1].ok) { failed++; return; }
        if (res[0].ok && res[0].names.length) r.rgn = res[0].names.join(' · ');
        if (res[1].ok && res[1].names.length) r.ind = res[1].names.join(' · ');
        if (res[0].ok && res[1].ok) { r.lk = LK; done++; }
      });
    }
    function worker() {
      if (idx >= todo.length) return Promise.resolve();
      return one(todo[idx++]).then(worker);
    }
    var pool = []; for (var i = 0; i < Math.min(o.pool || 3, todo.length); i++) pool.push(worker());
    return Promise.all(pool).then(function () { return { asked: todo.length, done: done, failed: failed }; });
  }

  /* 기업마당 — 지역은 해시태그·제목 앞 [대괄호]에서 읽는다(지역 칸이 따로 없다). 지어내지 않고 «그 말이 있을 때만» */
  var SIDO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
  var SIDO_FULL = { '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산',
    '세종특별자치시': '세종', '경기도': '경기', '강원도': '강원', '강원특별자치도': '강원', '충청북도': '충북', '충청남도': '충남', '전라북도': '전북', '전북특별자치도': '전북',
    '전라남도': '전남', '경상북도': '경북', '경상남도': '경남', '제주특별자치도': '제주' };
  function sidoOf(word) { word = s(word); return SIDO.indexOf(word) >= 0 ? word : (SIDO_FULL[word] || ''); }
  function bizRegion(tags, nm) {
    var out = [];
    s(tags).split(/[,#\s]+/).forEach(function (w) { var k = sidoOf(w); if (k) out.push(k); });
    var m = /^\s*[\[\(（【]([^\]\)）】]{1,12})[\]\)）】]/.exec(s(nm));
    if (m) m[1].split(/[,\/·ㆍ\s]+/).forEach(function (w) { var k = sidoOf(w); if (k) out.push(k); });
    out = uniq(out);
    return out.length >= 6 ? '' : out.join(' · ');   /* 여러 시도가 줄줄이면 사실상 전국 — 제한이 아니다 */
  }

  /* ── 낱말 걸러내기 ──
     공고명에서 찾는다.
     ⚠★ 띄어쓰기를 «통째로» 지우고 찾지 말 것 (2026-10-03 실측 3,077건) —
        「선거물품 보관창고 용역」이 「창고용역」이 되어 «고용»으로 걸렸다(단어 사이에 걸림).
        → 세 글자 이상 낱말만 사이 띄어쓰기를 봐준다(「일터 혁신」은 여전히 걸린다).
          두 글자 낱말은 «붙어 있을 때만» 걸린다.
     ⚠ 낱말이 «다른 단어 속»에 든 것도 실측으로 걸렀다 — FALSE_IN 에만 적는다.
        「공공디자인사업」 → «인사»(3건). 짐작으로 늘리지 말고 «실측한 것만» 더한다. */
  var FALSE_IN = ['디자인사'];

  function esc(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function matched(row, kws) {
    var nm = s(row && row.nm);
    FALSE_IN.forEach(function (w) { nm = nm.split(w).join(' '); });
    var list = (kws && kws.length) ? kws : KEYWORDS_DEFAULT;
    return list.filter(function (k) {
      var t = String(k || '').replace(/\s+/g, '');
      if (!t) return false;
      if (t.length < 3) return nm.indexOf(t) >= 0;
      var re = new RegExp(t.split('').map(esc).join('\\s*'));
      return re.test(nm);
    });
  }

  /* 'YYYY-MM-DD HH:mm:ss' · 'YYYYMMDDHHmm' 둘 다 받는다 */
  function _t(v) {
    var t = s(v);
    if (!t) return null;
    var m = /^(\d{4})-?(\d{2})-?(\d{2})[ T]?(\d{2})?:?(\d{2})?/.exec(t);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  }

  /* 마감까지 며칠 — 지났으면 음수. 모르면 null(「-」로 보여 준다). */
  function dday(closeDt, today) {
    var a = _t(closeDt), b = _t(today);
    if (a == null) return null;
    if (b == null) b = Date.now();
    return Math.ceil((a - b) / 86400000);
  }

  /* ── 낱말 켜고 끄기 ──
     ⚠ 마지막 하나까지 끄지 못하게 막는다. 다 끄면 아무것도 안 걸려
       「받았는데 0건」이 되고, 사람은 API 가 고장 난 줄 안다. */
  function toggleKw(list, kw) {
    var cur = (list && list.length) ? list.slice() : KEYWORDS_DEFAULT.slice();
    var t = s(kw);
    if (!t) return { list: cur, ok: false, err: '낱말이 비어 있습니다' };
    var i = cur.indexOf(t);
    if (i < 0) { cur.push(t); return { list: cur, ok: true, err: '' }; }
    if (cur.length <= 1) return { list: cur, ok: false, err: '낱말을 모두 끌 수는 없습니다 — 하나는 남겨 주세요' };
    cur.splice(i, 1);
    return { list: cur, ok: true, err: '' };
  }

  /* ── 이미 받은 것과 합치기 ──
     ⚠ 새로 «만들기»만 한다. 이미 있는 줄은 손대지 않는다 —
       대표가 ⭐관심을 켜 두거나 메모를 적어 뒀을 수 있다. */
  /* 번호 모양으로 출처를 짐작한다 — 출처가 빠진 채 담긴 옛 줄을 되살릴 때만 쓴다.
     나라장터 R26BK01749015-000 · 기업마당 PBLN_000000000080236 · 알리오 305665(숫자만).
     ⚠ 모르는 모양은 «빈 글자»다 — 지어내지 않는다. */
  function guessSrc(no) {
    var t = s(no);
    if (/^PBLN_/i.test(t)) return '기업마당';
    if (/^\d+$/.test(t)) return '알리오';
    if (/^[A-Z]\d{2}[A-Z]{2}\d+/.test(t) || /-\d{2,3}$/.test(t)) return '나라장터';
    return '';
  }

  /* ── 기업마당(지원사업) 전용 넓히기 (대표 지시 2026-10-11 「걸러진건 넓혀라」) ──
     지원사업 공고는 공고명이 「ESG경영 진단 및 컨설팅 지원」처럼 뭉뚱그려도 «해시태그·소분류·요약»에 노무 말이 적혀 있다.
     ① 공고명에 센 말이 있으면 그대로 건다(원래 규칙).
     ② 공고명에 약한 말(컨설팅·인사·고용)만 있어도 «해시태그·소분류·요약»에 업무 분야 말(FIELD)이 있으면 건다.
     ③ 공고명에 낱말이 아예 없어도 «해시태그»에 센 말(노무·노사·일터혁신·직장내괴롭힘 …)이 있으면 건다.
     ⚠ 빼는 말(DROP)·기관 이름(ORG)은 «공고명»에서만 본다 — 해시태그까지 보면 「홍보」 한 태그에 다 빠진다.
     ⚠ 해시태그의 약한 말(컨설팅·경영)만으로는 걸지 않는다 — 그러면 창업·박람회가 다 걸린다. */
  function judgeBiz(title, hits, row, kws) {
    if (hits.some(function (k) { return WEAK.indexOf(k) < 0; })) return hits;
    var list = (kws && kws.length) ? kws : KEYWORDS_DEFAULT;
    var strong = list.filter(function (k) { return WEAK.indexOf(k) < 0; });
    function clean(x) { ORG.forEach(function (o) { x = x.split(o).join(' '); }); return ' ' + x + ' '; }
    if (hits.length) {                       /* 공고명에 약한 말만 — 분야 말이 곁에 있어야 */
      var f = FIELD.filter(function (w) { return hits.indexOf(w) < 0; });
      var extra = clean(s(row.tags).replace(/,/g, ' ') + ' ' + s(row.mid) + ' ' + s(row.body || row.memo));
      return (matched({ nm: title }, f).length || matched({ nm: extra }, f).length) ? hits : [];
    }
    return matched({ nm: clean(s(row.tags).replace(/,/g, ' ')) }, strong);
  }

  /* ── 🤖 AI 사업 갈래 (대표 지시 2026-11-19 「ai 관련 사업 별도로 탭만들어달라」) ──
     찾는 말(노무·임금…)과 «따로» 본다 — 찾는 말에 안 걸려도 여기 걸리면 버리지 않고 ai 표시를 붙여 담는다.
     화면은 그런 줄(«AI 로만 걸린 공고»)을 공고 모아보기·📍 지역 탭·🎯 추천에 넣지 않고 🤖 AI 사업 탭에만 보인다.
     갈래 = 대표가 붙여 준 사업 넷 + 넓은 AI 도입 지원:
       hr 고용부 HR플랫폼(영세사업장 인사노무관리체계) · smart 중기부 스마트서비스 · voucher 과기정통부 AI·클라우드(·데이터) 바우처 ·
       factory 중기부 스마트공장 · ai AI·AX·DX 도입·전환 지원.
     ⚠ 실측 전 «짐작»이다 — 걸리는 것을 보고 늘리고 줄인다(찾는 말 규칙과 같은 약속).
     ⚠ 「AI」 낱말 하나로는 안 건다 — 나라장터에 「AI 기반 ○○ 시스템 구축」 같은 IT 용역이 하루 수십 건이다.
       넓은 갈래(ai)는 «지원사업·공급기업·수요기업·도입 지원·바우처…» 같은 «지원사업» 말이 함께 있어야 건다.
       「컨설팅」은 넣지 않는다 — 「KDB AI 거버넌스 수립 컨설팅」 같은 일반 AI 용역까지 쓸어 온다(tests/gov-g2b.test.js 잡음 목록). */
  var AI_PROGRAMS = [
    { k: 'hr', name: 'HR플랫폼', re: /인사\s*노무\s*관리\s*체계|HR\s*플랫폼|인사\s*노무\s*(플랫폼|솔루션)/i },
    { k: 'smart', name: '스마트서비스', re: /스마트\s*서비스/ },
    { k: 'voucher', name: 'AI·클라우드 바우처', re: /(AI|인공지능|클라우드|데이터)\s*(서비스\s*)?(바우처|보급|확산|이용\s*지원)/i },
    { k: 'factory', name: '스마트공장', re: /스마트\s*공장|스마트\s*제조|자율\s*제조|제조\s*(AI|데이터|디지털)/i },
    { k: 'ai', name: 'AI 도입·전환', re: /(^|[^A-Za-z])(AI|AX|DX)(?![A-Za-z])|인공지능|디지털\s*전환/i,
      need: /지원\s*사업|공급\s*기업|수요\s*기업|도입\s*지원|활용\s*지원|전환\s*지원|바우처|참여\s*기업/ }
  ];
  /* 공고 하나 → 걸린 갈래 열쇠 목록(없으면 []) */
  function judgeAi(row) {
    row = row || {};
    var t = s(row.nm);
    if (!t) return [];
    if (row.src === '알리오' && ALIO_NOT.test(t)) return [];   /* 알리오는 직원 채용 창구 — 「AI 연구원 채용」은 사업이 아니다 */
    if (row.src === '기업마당') t += ' ' + s(row.tags).replace(/,/g, ' ');   /* 지원사업은 해시태그에 「인공지능」·「클라우드」가 적힌다 */
    var out = [];
    AI_PROGRAMS.forEach(function (p) { if (p.re.test(t) && (!p.need || p.need.test(t))) out.push(p.k); });
    /* 좁은 갈래가 걸리면 넓은 갈래(ai)는 겹쳐 붙이지 않는다 — 「AI 바우처」가 「AI 도입·전환」에도 세어지면 칩 수가 부푼다 */
    if (out.length > 1 && out.indexOf('ai') >= 0) out.splice(out.indexOf('ai'), 1);
    return out;
  }

  /* 공고 하나를 거를지 정한다 — merge 가 이것만 쓴다. 걸리면 걸린 낱말 목록, 아니면 []. */
  function judge(row, kws) {
    row = row || {};
    var t = s(row.nm);
    if (row.src === '알리오') {
      if (!ALIO_NEED.test(t) || ALIO_NOT.test(t)) return [];
      return [t.match(ALIO_NEED)[0]];
    }
    ORG.forEach(function (o) { t = t.split(o).join(' '); });
    if (DROP.some(function (d) { return t.indexOf(d) >= 0; })) return [];
    var hits = matched({ nm: t }, kws);
    if (row.src === '기업마당') return judgeBiz(t, hits, row, kws);
    if (!hits.length) return [];
    if (hits.some(function (k) { return WEAK.indexOf(k) < 0; })) return hits;
    var field = FIELD.filter(function (f) { return hits.indexOf(f) < 0; });
    return matched({ nm: t }, field).length ? hits : [];
  }

  function merge(existing, incoming, kws, today) {
    var have = {};
    (existing || []).forEach(function (r) { if (r && r.no) have[r.no] = 1; });
    var adds = [], skipped = 0, unmatched = 0;
    (incoming || []).forEach(function (r) {
      if (!r || !r.no) return;
      var hit = judge(r, kws), ai = judgeAi(r);
      /* 찾는 말에도, 🤖 AI 사업 갈래에도 안 걸리면 버린다 — AI 로만 걸린 줄은 kw 가 비고 ai 가 붙는다 */
      if (!hit.length && !ai.length) { unmatched++; return; }
      if (have[r.no]) { skipped++; return; }
      have[r.no] = 1;
      /* ⚠★ 출처(src)를 «반드시» 데려간다 — 빠뜨려 2026-10-03 첫 실사용 32건이 전부
         출처 칸이 비고 「전체 출처」 거르개도 안 먹었다(실측). */
      adds.push({
        src: r.src || guessSrc(r.no),
        no: r.no, nm: r.nm, org: r.inst, ntce: r.ntce,
        openDt: r.openDt, closeDt: r.closeDt, prc: r.prc, mthd: r.mthd, url: r.url,
        kw: hit.join(','),
        year: s(r.openDt).slice(0, 4),
        dday: dday(r.closeDt, today),
        type: '새 공고'                       /* 상태 — 목록 툴바의 「유형」으로 거른다 */
      });
      var last = adds[adds.length - 1];
      if (ai.length) last.ai = ai.join(',');
      ['indY', 'jnt', 'rgn', 'ind'].forEach(function (k) { if (r[k]) last[k] = r[k]; });
      if (r.lk === LK) last.lk = LK;
      if ((last.src === '기업마당') && !last.rgn) { var br = bizRegion(r.tags, r.nm); if (br) last.rgn = br; }
    });
    return { adds: adds, skipped: skipped, unmatched: unmatched };
  }

  var api = { BASE: BASE, KEYWORDS_DEFAULT: KEYWORDS_DEFAULT, encKey: encKey,
              buildUrl: buildUrl, parse: parse, matched: matched, dday: dday, merge: merge,
              guessSrc: guessSrc, judge: judge, judgeAi: judgeAi, AI_PROGRAMS: AI_PROGRAMS,
              WINDOW_DAYS: WINDOW_DAYS, recentFrom: recentFrom, weekWindows: weekWindows,
              detailUrl: detailUrl, parseDetail: parseDetail, enrich: enrich, bizRegion: bizRegion, LK: LK,
              toggleKw: toggleKw, specFiles: specFiles, filesFrom: filesFrom };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovG2b = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
