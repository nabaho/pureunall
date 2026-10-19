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
     ⚠ 조회구분(inqryDiv) 값은 문서에 풀이가 없다 — 2(공고번호)를 먼저, 비면 3 을 한 번 더 본다(enrich). */
  var DETAIL_BASE = 'https://apis.data.go.kr/1230000/ad/BidPublicInfoService/';
  var DETAIL_OP = { rgn: 'getBidPblancListInfoPrtcptPsblRgn', lic: 'getBidPblancListInfoLicenseLimit' };
  function bidNo(no) { return s(no).split('-')[0]; }
  function detailUrl(o) {
    o = o || {};
    var q = [
      'serviceKey=' + encKey(o.key), 'type=json',
      'inqryDiv=' + (o.div || 2), 'bidNtceNo=' + encodeURIComponent(bidNo(o.no)),
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
    var r = json.response || {}, code = r.header && String(r.header.resultCode || '');
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
     ⚠ 이미 lk 가 있는 줄·나라장터가 아닌 줄은 건너뛴다. 둘 다 승인 전이어 «전부» 실패하면 lk 를 안 남긴다(승인 뒤 다시 본다). */
  function enrich(rows, getJson, o) {
    o = o || {};
    var todo = (rows || []).filter(function (r) { return r && r.no && !r.lk && (r.src || guessSrc(r.no)) === '나라장터'; }).slice(0, o.max || 60);
    var div = 2, hadData = false, tried = 0, done = 0, failed = 0, idx = 0;
    function one(r) {
      function ask(kind, d) {
        return Promise.resolve().then(function () { return getJson(detailUrl({ key: o.key, no: r.no, kind: kind, div: d })); })
          .then(function (j) { return parseDetail(j, kind); }, function () { return { ok: false, err: '받지 못했습니다', names: [] }; });
      }
      return Promise.all([ask('rgn', div), ask('lic', div)]).then(function (res) {
        if (res[0].ok && res[1].ok && !res[0].names.length && !res[1].names.length && !hadData && tried < 6 && div === 2) {
          /* 둘 다 «빈 성공» — 조회구분이 틀렸을 수 있다. 3 으로 한 번 더 */
          tried++;
          return Promise.all([ask('rgn', 3), ask('lic', 3)]).then(function (res2) {
            if (res2[0].names.length || res2[1].names.length) { div = 3; hadData = true; return res2; }
            return res;
          });
        }
        return res;
      }).then(function (res) {
        if (res[0].names.length || res[1].names.length) hadData = true;
        if (!res[0].ok && !res[1].ok) { failed++; return; }
        if (res[0].ok && res[0].names.length) r.rgn = res[0].names.join(' · ');
        if (res[1].ok && res[1].names.length) r.ind = res[1].names.join(' · ');
        if (res[0].ok && res[1].ok) { r.lk = '1'; done++; }
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
      var hit = judge(r, kws);
      if (!hit.length) { unmatched++; return; }
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
      ['indY', 'jnt', 'rgn', 'ind', 'lk'].forEach(function (k) { if (r[k]) last[k] = r[k]; });
      if ((last.src === '기업마당') && !last.rgn) { var br = bizRegion(r.tags, r.nm); if (br) last.rgn = br; }
    });
    return { adds: adds, skipped: skipped, unmatched: unmatched };
  }

  var api = { BASE: BASE, KEYWORDS_DEFAULT: KEYWORDS_DEFAULT, encKey: encKey,
              buildUrl: buildUrl, parse: parse, matched: matched, dday: dday, merge: merge,
              guessSrc: guessSrc, judge: judge,
              detailUrl: detailUrl, parseDetail: parseDetail, enrich: enrich, bizRegion: bizRegion,
              toggleKw: toggleKw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GovG2b = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
