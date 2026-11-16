/* 🧰 산재 묶음 — 급여·서류·기한·계산·유족·소식 (대표 「모든 단계 한번에 진행해라」 2026-11-15)
   ═══════════════════════════════════════════════════════════════════════════
   푸른이알피 산재 사건(case-injury) 상세에서 연다. 사건 «한 건»의 산재 업무를 한 창에서 본다.
     📋 서류  재해 갈래·질병 갈래·청구할 급여를 고르면 챙길 서류 목록이 나온다 — 받음·제출을 표시한다
     ⏰ 기한  결정 안 날·송달일을 넣으면 심사·재심사·행정소송 마감과 급여별 소멸시효 만료일
     🧮 계산  1일 평균임금으로 휴업·장해·유족·장례비·상병보상연금 어림
     👪 유족  가족 관계·나이·생계로 유족보상연금 수급자격·순위, 없으면 일시금 순위
     📰 소식  법령 현행·시행예정 개정과 공식 출처, 판례·결정례 찾기(js/pu-sanjae-cases.js)

   ■ 근거 — 국가법령정보센터 원문으로 확인(기준일 LAW_ASOF). 숫자 하나하나 옆에 조문을 단다.
       산업재해보상보험법 제36·37·41·52·54·55·57·62·63·65·66·71·103·105·106·109·111·112조, 별표 2·3·4
       같은 법 시행령 제21·53조·별표 3 · 시행규칙 제20·21조 · 행정소송법 제20조 · 민법 제157·160·161·166조
     ⚠ 서식 «이름»과 첨부 서류는 법이 정하지 않는다(공단 안내 몫). 그래서 서류 줄마다 근거를 달고,
       법에 없는 것은 「실무 [확인 필요]」로 적는다. 법인 목록이 따로 있으면 「서류 더하기」로 넣는다.
     ⚠ 해마다 바뀌는 금액(최고·최저 보상기준 금액, 장례비 최고·최저, 최저임금)은 «박지 않는다» — 고시를 보고 넣는 칸.
       비워 두면 그 조정 없이 어림하고, 그렇다고 화면에 적는다.

   ■ 저장 — 사건마다 한 줄(이알피 동기화 표 case_sanjae, entityType 'SanjaeKit', sourceKind 'case').
       이 모듈은 저장소를 모른다 — 이알피가 load·save 를 건넨다(바깥 저장 길 하나).
     ★ 저장하는 것: 재해 갈래·질병 갈래·고른 급여·서류 받음/제출 날짜·직접 넣은 서류 이름·기한 계산용 날짜.
     ★ 저장하지 않는 것: 계산 칸(임금)·유족 표(가족 관계·나이) — 창을 닫으면 사라진다.
       남기고 싶으면 「업무 메모에 붙이기」로 사람이 골라 남긴다(이름은 애초에 받지 않는다).
     ★ 끝난 사건(종결·이관·취소)은 «보기만» — 종료·삭제·되돌림 불변(docs/규칙/종료-삭제-되돌림-불변.md).

   ⚠ 화면은 Preact 바깥(document.body)에 붙인다 — Preact 가 그린 자리를 손으로 고치지 않는다(pu-sanjae-cases.js 와 같다).
   ⚠ 바깥 글은 textContent 로만 넣는다. */
(function (root) {
  'use strict';
  var LAW_ASOF = '2026-11-15';

  /* ══════════════════ 법령 기준표 ══════════════════ */
  /* 보험급여 여덟 가지 — 산재보험법 제36조①. 시효: 제112조① (3년, 장해·유족·장례비는 5년) */
  var BENEFITS = [
    { k: 'yoyang',     n: '요양급여',     law: '제40조·제41조', sozo: 3 },
    { k: 'hyueop',     n: '휴업급여',     law: '제52조',        sozo: 3 },
    { k: 'janghae',    n: '장해급여',     law: '제57조',        sozo: 5 },
    { k: 'ganbyeong',  n: '간병급여',     law: '제61조',        sozo: 3 },
    { k: 'yujok',      n: '유족급여',     law: '제62조',        sozo: 5 },
    { k: 'sangbyeong', n: '상병보상연금', law: '제66조',        sozo: 3 },
    { k: 'jangrye',    n: '장례비',       law: '제71조',        sozo: 5 },
    { k: 'jaehwal',    n: '직업재활급여', law: '제72조',        sozo: 3 }
  ];
  /* 시효 기산 — 법은 «권리를 행사할 수 있는 때»(민법 제166조①)만 정한다. 아래는 실무 예시라 [확인 필요] */
  var SOZO_HINT = {
    yoyang: '요양 비용이 생긴 때', hyueop: '취업하지 못한 날마다', janghae: '치유된 때', ganbyeong: '간병을 받은 때',
    yujok: '사망한 때', sangbyeong: '지급 사유가 생긴 때', jangrye: '사망한 때', jaehwal: '지급 사유가 생긴 때'
  };
  /* 재해 갈래 — 제37조① 1·2·3호 */
  var KINDS = [
    { k: 'accident', n: '업무상 사고', law: '제37조①1호' },
    { k: 'disease',  n: '업무상 질병', law: '제37조①2호' },
    { k: 'commute',  n: '출퇴근 재해', law: '제37조①3호' }
  ];
  /* 업무상 질병 갈래 — 시행령 별표 3 (1~13호). doc: 업무 관련성을 보일 자료 */
  var DISEASES = [
    { k: 'd1',  n: '뇌혈관·심장 질병',   law: '시행령 별표3 1호', doc: '발병 전 근무시간·업무량 기록(출퇴근 기록·업무일지 등)' },
    { k: 'd2',  n: '근골격계 질병',      law: '시행령 별표3 2호', doc: '신체부담업무 자료(작업 내용·자세·반복·중량·종사 기간)' },
    { k: 'd3',  n: '호흡기계 질병',      law: '시행령 별표3 3호', doc: '노출 물질·기간 자료(취급 물질·작업환경 등)' },
    { k: 'd4',  n: '신경정신계 질병',    law: '시행령 별표3 4호 · 법 제37조①2호 다목', doc: '정신적 충격 사건·폭언·괴롭힘 기록(경위·신고 기록 등)' },
    { k: 'd5',  n: '림프조혈기계 질병',  law: '시행령 별표3 5호', doc: '벤젠·납 등 노출 농도·기간 자료' },
    { k: 'd6',  n: '피부 질병',          law: '시행령 별표3 6호', doc: '노출 물질·작업 환경 자료' },
    { k: 'd7',  n: '눈·귀 질병(소음성 난청 포함)', law: '시행령 별표3 7호', doc: '소음 등 노출 자료와 청력·안과 검사 결과' },
    { k: 'd8',  n: '간 질병',            law: '시행령 별표3 8호', doc: '노출 물질 자료(유기용제 등)' },
    { k: 'd9',  n: '감염성 질병',        law: '시행령 별표3 9호', doc: '감염 경위·업무 내용 자료' },
    { k: 'd10', n: '직업성 암',          law: '시행령 별표3 10호', doc: '발암물질 노출 물질·기간 자료' },
    { k: 'd11', n: '급성 중독 등 화학적 요인', law: '시행령 별표3 11호', doc: '노출 물질·급성 증상 자료' },
    { k: 'd12', n: '물리적 요인(기압·진동·방사선·온도)', law: '시행령 별표3 12호', doc: '노출 환경 자료' },
    { k: 'd13', n: '그 밖의 질병(상당인과관계)', law: '시행령 별표3 13호 · 법 제37조①', doc: '업무와 질병의 상당인과관계 자료' }
  ];
  var CHECK = '실무 [확인 필요]';
  /* 챙길 서류 — g: 어느 갈래에서 나오나(급여 열쇠 · 재해 갈래 · appeal) */
  var DOCS = [
    { k: 'y1', g: 'yoyang', n: '요양급여 신청서 — 소속 사업장·재해발생 경위 기재', law: '법 제41조①' },
    { k: 'y2', g: 'yoyang', n: '의학적 소견서(초진소견서 등)', law: '법 제41조①' },
    { k: 'y3', g: 'yoyang', n: '재해 경위 자료(진술서·목격자 진술·사진 등)', law: '법 제41조① · ' + CHECK },
    { k: 'y4', g: 'yoyang', n: '근로관계 자료(근로계약서·출근 기록 등)', law: CHECK },
    { k: 'y5', g: 'yoyang', n: '의료기관이 대행할 때 — 근로자 대행 동의 서류', law: '시행규칙 제20조①' },
    { k: 'h1', g: 'hyueop', n: '휴업급여 청구서', law: '시행령 제21조①1호' },
    { k: 'h2', g: 'hyueop', n: '임금 자료(평균임금 — 3개월 임금대장·명세서)', law: '법 제36조 · 근로기준법 제2조①6호' },
    { k: 'h3', g: 'hyueop', n: '요양으로 취업하지 못한 기간 확인(의사 소견 등)', law: '법 제52조' },
    { k: 'j1', g: 'janghae', n: '장해급여 청구서', law: '시행령 제21조①2호' },
    { k: 'j2', g: 'janghae', n: '장해 상태 의학 소견(장해진단서)', law: '시행령 제53조·별표6 · 서식명 ' + CHECK },
    { k: 'j3', g: 'janghae', n: '장해 부위 영상·검사 자료', law: '시행규칙 제48조 · ' + CHECK },
    { k: 'j4', g: 'janghae', n: '연금·일시금 선택 의사(제4~7급)', law: '법 제57조③' },
    { k: 'g1', g: 'ganbyeong', n: '간병급여 청구서', law: '시행령 제21조①3호' },
    { k: 'g2', g: 'ganbyeong', n: '간병이 필요하다는 의학 소견', law: '시행령 제59조① 별표' },
    { k: 'u1', g: 'yujok', n: '유족급여 청구서', law: '시행령 제21조①4호' },
    { k: 'u2', g: 'yujok', n: '사망 사실 서류(사망진단서·시체검안서)', law: CHECK },
    { k: 'u3', g: 'yujok', n: '가족관계 증명 서류', law: '법 제63조·제65조' },
    { k: 'u4', g: 'yujok', n: '사망 당시 생계를 같이 했음을 보이는 자료', law: '법 제63조①' },
    { k: 'u5', g: 'yujok', n: '장애 정도 증빙(해당 유족만)', law: '법 제63조①4호' },
    { k: 'u6', g: 'yujok', n: '연금 절반을 일시금으로 받을지 의사', law: '법 제62조③' },
    { k: 's1', g: 'sangbyeong', n: '상병보상연금 청구서', law: '시행령 제21조①5호' },
    { k: 's2', g: 'sangbyeong', n: '중증요양상태 의학 소견(요양 2년 경과 뒤)', law: '법 제66조①' },
    { k: 'r1', g: 'jangrye', n: '장례비 청구서', law: '시행령 제21조①6호' },
    { k: 'r2', g: 'jangrye', n: '장례 비용 영수증(유족 아닌 사람이 장례를 지낸 때)', law: '법 제71조① 단서' },
    { k: 'w1', g: 'jaehwal', n: '직업재활급여 신청서', law: '시행령 제21조①7호 · 세부 ' + CHECK },
    { k: 'c1', g: 'commute', n: '출퇴근 경로·방법 자료(경로·교통수단·시각)', law: '법 제37조①3호' },
    { k: 'c2', g: 'commute', n: '경로를 벗어나거나 멈췄다면 그 사유 자료', law: '법 제37조③' },
    { k: 'a1', g: 'appeal', n: '보험급여 결정 통지서 사본(안 날 확인)', law: '법 제103조③ · ' + CHECK },
    { k: 'a2', g: 'appeal', n: '심사청구서 — 결정한 공단 소속 기관을 거쳐 제출', law: '법 제103조②③' },
    { k: 'a3', g: 'appeal', n: '재심사청구서 — 결정한 공단 소속 기관을 거쳐 재심사위원회에', law: '법 제106조②③' },
    { k: 'a4', g: 'appeal', n: '청구 이유 증거(소견서·판례·결정례)', law: '법 제105조④ · ' + CHECK }
  ];

  /* 장해급여표 — 산재보험법 별표 2 (평균임금 기준 일수). 연금은 제1~7급만 있다 */
  var JANGHAE_PENSION = [329, 291, 257, 224, 193, 164, 138];
  var JANGHAE_LUMP = [1474, 1309, 1155, 1012, 869, 737, 616, 495, 385, 297, 220, 154, 99, 55];
  /* 상병보상연금표 — 별표 4 (중증요양상태등급 1~3급) */
  var SANGBYEONG = [329, 291, 257];

  /* ══════════════════ 순수 로직 — 날짜 ══════════════════ */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; }
  function fmt(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function toUTC(s) { var p = ymd(s); return p ? Date.UTC(p.y, p.m - 1, p.d) : NaN; }
  function fromUTC(t) { var d = new Date(t); return fmt(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }
  function addDays(s, n) { var t = toUTC(s); return isNaN(t) ? '' : fromUTC(t + n * 86400000); }
  function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  /* 그 날부터 N년 — 초일 불산입(민법 제157조) → 기산일의 N년 뒤 해당일 전날(제160조②), 그 달에 해당일이 없으면 말일(제160조③) */
  function addYearsCivil(s, n) {
    var st = ymd(addDays(s, 1)); if (!st) return '';
    var y = st.y + n, last = dim(y, st.m);
    if (st.d > last) return fmt(y, st.m, last);
    return addDays(fmt(y, st.m, st.d), -1);
  }
  /* 말일이 토요일·공휴일이면 다음 날 (민법 제161조) — 일요일은 공휴일로 본다 */
  function rollHoliday(s, hol) {
    var set = {}; [].concat(hol || []).forEach(function (h) { set[String(h && h.date || h)] = 1; });
    var out = s, guard = 0;
    while (out && guard++ < 40) {
      var w = new Date(toUTC(out)).getUTCDay();
      if (w !== 0 && w !== 6 && !set[out]) break;
      out = addDays(out, 1);
    }
    return out;
  }
  function dday(due, today) { var a = toUTC(due), b = toUTC(today); return (isNaN(a) || isNaN(b)) ? null : Math.round((a - b) / 86400000); }
  function todayStr() { var d = new Date(); return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate()); }

  /* ══════════════════ 순수 로직 — 기록 ══════════════════ */
  function newRec(caseId) {
    return { caseId: String(caseId || ''), kind: '', disease: '', benefits: ['yoyang'], appeal: false,
      docs: {}, extra: [], hidden: [], dates: {}, sozo: {} };
  }
  function normRec(r, caseId) {
    var b = newRec(caseId); r = r || {};
    Object.keys(b).forEach(function (k) { if (r[k] != null) b[k] = r[k]; });
    Object.keys(r).forEach(function (k) { if (!(k in b)) b[k] = r[k]; });
    b.benefits = [].concat(b.benefits || []).filter(function (k) { return BENEFITS.some(function (x) { return x.k === k; }); });
    b.docs = b.docs && typeof b.docs === 'object' ? b.docs : {};
    b.extra = [].concat(b.extra || []).filter(function (x) { return x && x.k && x.n; });
    b.hidden = [].concat(b.hidden || []);
    b.dates = b.dates && typeof b.dates === 'object' ? b.dates : {};
    b.sozo = b.sozo && typeof b.sozo === 'object' ? b.sozo : {};
    return b;
  }
  /* 고른 갈래 → 챙길 서류 (순수 로직). 숨긴 서류는 showHidden 일 때만 */
  function docsFor(rec, showHidden) {
    rec = normRec(rec, rec && rec.caseId);
    var on = {}; rec.benefits.forEach(function (k) { on[k] = 1; });
    if (rec.kind) on[rec.kind] = 1;
    if (rec.appeal) on.appeal = 1;
    var out = DOCS.filter(function (d) { return on[d.g]; }).map(function (d) { return { k: d.k, g: d.g, n: d.n, law: d.law }; });
    if (rec.kind === 'disease' && rec.disease) {
      var z = DISEASES.filter(function (x) { return x.k === rec.disease; })[0];
      if (z) out.splice(Math.min(out.length, 2), 0, { k: 'dz', g: 'disease', n: '업무 관련성 — ' + z.doc, law: z.law });
    }
    rec.extra.forEach(function (x) { out.push({ k: x.k, g: 'extra', n: x.n, law: '직접 넣음' }); });
    var hid = {}; rec.hidden.forEach(function (k) { hid[k] = 1; });
    return out.map(function (d) { var s = rec.docs[d.k] || {}; return Object.assign(d, { got: s.got || '', sent: s.sent || '', hidden: !!hid[d.k] }); })
      .filter(function (d) { return showHidden || !d.hidden; });
  }
  function progress(rec) {
    var list = docsFor(rec, false);
    return { n: list.length, got: list.filter(function (d) { return d.got; }).length, sent: list.filter(function (d) { return d.sent; }).length };
  }
  /* 여러 줄에 한꺼번에 받음·제출 표시 / 지우기 / 숨기기 (순수 로직 — 새 기록을 돌려준다) */
  function bulk(rec, keys, act, day) {
    var r = normRec(JSON.parse(JSON.stringify(rec || {})), rec && rec.caseId);
    [].concat(keys || []).forEach(function (k) {
      var s = Object.assign({}, r.docs[k] || {});
      if (act === 'got') s.got = day; else if (act === 'sent') { s.sent = day; if (!s.got) s.got = day; }
      else if (act === 'clear') { s = {}; }
      else if (act === 'unsent') { delete s.sent; }
      else if (act === 'hide') { if (r.hidden.indexOf(k) < 0) r.hidden.push(k); return; }
      else if (act === 'unhide') { r.hidden = r.hidden.filter(function (x) { return x !== k; }); return; }
      if (s.got || s.sent) r.docs[k] = s; else delete r.docs[k];
    });
    return r;
  }

  /* ══════════════════ 순수 로직 — 기한 ══════════════════ */
  /* 날짜 칸 → 마감 줄. 마감은 «그 날 + N일»(초일 불산입, 민법 제157조) 뒤 토·공휴일이면 다음 날(제161조) */
  function deadlines(rec, hol, today) {
    var d = (rec && rec.dates) || {}, out = [];
    function row(k, n, from, days, law, note) {
      if (!ymd(from)) return;
      var raw = addDays(from, days), due = rollHoliday(raw, hol);
      out.push({ k: k, n: n, from: from, raw: raw, due: due, rolled: due !== raw, left: dday(due, today || todayStr()), law: law, note: note || '' });
    }
    row('review', '심사청구 마감', d.known, 90, '산재보험법 제103조③', '보험급여 결정이 있음을 안 날부터 90일');
    if (d.viaBoard) row('rereviewDirect', '재심사청구 마감(심사 없이 바로)', d.known, 90, '산재보험법 제106조① 단서·③ 단서', '업무상질병판정위원회 심의를 거친 결정');
    row('rereview', '재심사청구 마감', d.reviewKnown, 90, '산재보험법 제106조③', '심사 결정이 있음을 안 날부터 90일');
    row('suitAfter', '행정소송 제기 마감(재결 뒤)', d.reServed, 90, '행정소송법 제20조① 단서 · 산재보험법 제111조②', '재결서 정본을 송달받은 날부터 90일(불변기간)');
    row('suitDirect', '행정소송 제기 마감(처분을 바로 다툴 때)', d.known, 90, '행정소송법 제20조①', '처분이 있음을 안 날부터 90일 — 바로 소송할지는 담당 노무사 판단');
    row('reviewDecide', '심사 결정 예정(참고)', d.reviewFiled, 60, '산재보험법 제105조①', '공단이 청구서를 받은 날부터 60일 · 한 차례 20일 연장 가능');
    row('rereviewDecide', '재심사 재결 예정(참고)', d.reFiled, 60, '산재보험법 제109조①', '60일 · 한 차례 20일 연장 가능');
    return out.sort(function (a, b) { return a.due < b.due ? -1 : a.due > b.due ? 1 : 0; });
  }
  /* 고른 급여마다 소멸시효 — 기산 기준일을 넣으면 만료일 (제112조①, 민법 제157·160·161조) */
  function sozoRows(rec, hol, today) {
    rec = normRec(rec, rec && rec.caseId);
    return rec.benefits.map(function (k) {
      var b = BENEFITS.filter(function (x) { return x.k === k; })[0];
      var from = rec.sozo[k] || '', raw = ymd(from) ? addYearsCivil(from, b.sozo) : '', due = raw ? rollHoliday(raw, hol) : '';
      return { k: k, n: b.n, years: b.sozo, from: from, raw: raw, due: due, rolled: !!due && due !== raw, left: due ? dday(due, today || todayStr()) : null,
        hint: SOZO_HINT[k] || '', law: '산재보험법 제112조①' + (b.sozo === 5 ? ' 단서' : '') };
    });
  }

  /* ══════════════════ 순수 로직 — 계산 ══════════════════ */
  function num(v) { var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
  /* 원 미만 버림 — 공단 실제 끝수 처리는 [확인 필요]. 비율은 «정수 %»로 곱한 뒤 100 으로 나눠 소수 오차를 줄이고,
     그래도 남는 오차(예: 18979999.999…)가 1원을 깎지 않게 아주 작은 값을 더해 버린다 */
  function won(n) { return Math.floor(n + 1e-6); }
  function pct(v, p) { return v * p / 100; }
  /* 평균임금 조정 — 제36조⑦: 최고 보상기준 금액 초과면 그 금액, 최저 미만이면 최저(최저임금액보다 적으면 최저임금액).
     장례비는 이 조정을 안 한다(괄호). 휴업급여·상병보상연금에는 «최저»를 안 쓴다(단서). */
  function minStdOf(i) {
    var lo = num(i.minStd), mw = num(i.minWageHour) * 8;
    if (!lo) return 0;
    return mw > lo ? mw : lo;
  }
  function adjAvg(i, kind) {
    var a = num(i.avg), hi = num(i.maxStd), lo = minStdOf(i);
    if (!a) return { v: 0, note: '' };
    if (kind === 'jangrye') return { v: a, note: '' };
    if (hi && a > hi) return { v: hi, note: '최고 보상기준 금액 적용(제36조⑦)' };
    if (lo && a < lo && kind !== 'hyueop' && kind !== 'sangbyeong') return { v: lo, note: '최저 보상기준 금액 적용(제36조⑦)' };
    return { v: a, note: '' };
  }
  /* 여러 장해 → 조정 등급 — 시행령 제53조② */
  function gradeAdjust(list) {
    var g = [].concat(list || []).map(function (x) { return Math.round(num(x)); }).filter(function (x) { return x >= 1 && x <= 14; }).sort(function (a, b) { return a - b; });
    if (!g.length) return null;
    var worst = g[0], c5 = g.filter(function (x) { return x <= 5; }).length, c8 = g.filter(function (x) { return x <= 8; }).length,
      c13 = g.filter(function (x) { return x <= 13; }).length, up = 0, why = '가장 심한 장해의 등급(시행령 제53조② 본문)';
    if (g.length >= 2) {
      if (c5 >= 2) { up = 3; why = '제5급 이상이 둘 이상 → 3개 등급 올림(시행령 제53조②1호)'; }
      else if (c8 >= 2) { up = 2; why = '제8급 이상이 둘 이상 → 2개 등급 올림(같은 항 2호)'; }
      else if (c13 >= 2) { up = 1; why = '제13급 이상이 둘 이상 → 1개 등급 올림(같은 항 3호)'; }
    }
    var out = worst - up;
    if (out < 1) { out = 1; why += ' · 1급을 넘으면 1급(같은 항 단서)'; }
    return { grade: out, from: g, why: why };
  }
  /* 급여 어림 (순수 로직) — 들어온 칸만큼 계산하고, 못 한 조정은 notes 에 적는다 */
  function calc(i) {
    i = i || {};
    var rows = [], notes = [], avg = num(i.avg);
    if (!avg) return { rows: rows, notes: ['1일 평균임금을 넣으면 계산합니다.'] };
    if (!num(i.maxStd) && !num(i.minStd)) notes.push('최고·최저 보상기준 금액(해마다 고용노동부 고시)을 비워 두어 제36조⑦ 조정 없이 어림했습니다.');
    /* 휴업급여 — 제52조 70% · 제54조 저소득 · 3일 이내는 지급 안 함 */
    var hA = adjAvg(i, 'hyueop'), day = won(pct(hA.v, 70)), why = '평균임금 × 70%(제52조)', lo = minStdOf(i);
    if (lo && pct(hA.v, 70) <= pct(lo, 80)) {
      var p90 = pct(hA.v, 90);
      if (p90 > pct(lo, 80)) { day = won(pct(lo, 80)); why = '저소득 — 최저 보상기준 금액 × 80%(제54조① 단서)'; }
      else {
        day = won(p90); why = '저소득 — 평균임금 × 90%(제54조① 본문)';
        var mw8 = num(i.minWageHour) * 8;
        if (mw8 && day < mw8) { day = won(mw8); why = '최저임금액(시간급 × 8, 제54조②)'; }
      }
    }
    var rest = Math.round(num(i.restDays));
    rows.push({ k: 'hyueop', n: '휴업급여 1일', v: day, law: why + (hA.note ? ' · ' + hA.note : '') });
    if (rest) rows.push({ k: 'hyueopSum', n: '휴업급여 ' + rest + '일', v: rest <= 3 ? 0 : day * rest, law: rest <= 3 ? '취업하지 못한 기간이 3일 이내면 지급하지 않음(제52조 단서)' : '1일 × 일수' });
    /* 장해급여 — 별표 2, 제57조③ */
    var g = Math.round(num(i.grade));
    if (g >= 1 && g <= 14) {
      var jA = adjAvg(i, 'janghae'), lump = won(jA.v * JANGHAE_LUMP[g - 1]);
      var how = g <= 3 ? '연금만(노동력 완전 상실 — 제57조③ 단서·시행령 제53조⑤)' : g <= 7 ? '연금·일시금 중 선택(제57조③)' : '일시금(별표 2 — 연금 없음)';
      if (g <= 7) rows.push({ k: 'janghaeP', n: '장해보상연금 제' + g + '급 (1년)', v: won(jA.v * JANGHAE_PENSION[g - 1]), law: '평균임금 × ' + JANGHAE_PENSION[g - 1] + '일(별표 2) · ' + how + (jA.note ? ' · ' + jA.note : '') });
      if (g >= 4) rows.push({ k: 'janghaeL', n: '장해보상일시금 제' + g + '급', v: lump, law: '평균임금 × ' + JANGHAE_LUMP[g - 1] + '일(별표 2) · ' + how + (jA.note ? ' · ' + jA.note : '') });
    }
    /* 상병보상연금 — 별표 4 (휴업급여 대신, 제66조①) */
    var sg = Math.round(num(i.sbGrade));
    if (sg >= 1 && sg <= 3) {
      var sA = adjAvg(i, 'sangbyeong');
      rows.push({ k: 'sangbyeong', n: '상병보상연금 제' + sg + '급 (1년)', v: won(sA.v * SANGBYEONG[sg - 1]), law: '평균임금 × ' + SANGBYEONG[sg - 1] + '일(별표 4) · 휴업급여 대신(제66조①)' + (sA.note ? ' · ' + sA.note : '') });
    }
    /* 유족급여 — 별표 3, 제62조 */
    if (i.yujokN !== '' && i.yujokN != null) {
      var n = Math.max(0, Math.round(num(i.yujokN))), yA = adjAvg(i, 'yujok'), base = yA.v * 365;
      if (n === 0) rows.push({ k: 'yujokL', n: '유족보상일시금', v: won(yA.v * 1300), law: '평균임금 × 1,300일 — 연금 수급자격자가 없을 때(제62조②·별표 3)' + (yA.note ? ' · ' + yA.note : '') });
      else {
        var ratePct = 47 + Math.min(5 * n, 20), pen = won(pct(base, ratePct));
        if (i.yujokHalf) {
          rows.push({ k: 'yujokHalfL', n: '유족 일시금(절반 선택)', v: won(yA.v * 650), law: '일시금 1,300일분의 50%(제62조③)' });
          rows.push({ k: 'yujokHalfP', n: '유족보상연금 (1년, 50% 감액)', v: won(pct(base, ratePct) / 2), law: '연금 50% 감액(제62조③)' });
        } else {
          rows.push({ k: 'yujokP', n: '유족보상연금 (1년)', v: pen, law: '평균임금 × 365 × (47% + 5% × ' + n + '명' + (5 * n > 20 ? ', 가산 최대 20%' : '') + ') — 별표 3' + (yA.note ? ' · ' + yA.note : '') });
        }
      }
    }
    /* 장례비 — 제71조 (제36조⑦ 조정 없음, 고시 최고·최저 금액) */
    if (i.funeral) {
      var f = won(adjAvg(i, 'jangrye').v * 120), fw = '평균임금 × 120일(제71조①)', fh = num(i.funeralMax), fl = num(i.funeralMin);
      if (fh && f > fh) { f = won(fh); fw += ' → 고시 최고 금액(제71조②)'; }
      else if (fl && f < fl) { f = won(fl); fw += ' → 고시 최저 금액(제71조②)'; }
      else if (!fh && !fl) fw += ' · 고시 최고·최저 금액 비움';
      rows.push({ k: 'jangrye', n: '장례비', v: f, law: fw });
    }
    notes.push('평균임금 증감(제36조③)·61세 이후 고령자 감액(제55조·별표1, 상병 별표5)·부분휴업(제53조)·연금 미리 받기(제57조④)는 넣지 않았습니다.');
    notes.push('원 미만은 버렸습니다 — 공단 실제 지급액·끝수 처리는 결정통지로 확인 [확인 필요].');
    return { rows: rows, notes: notes };
  }

  /* ══════════════════ 순수 로직 — 유족 ══════════════════ */
  var RELS = [
    { k: 'spouse', n: '배우자' }, { k: 'child', n: '자녀' }, { k: 'parent', n: '부모' },
    { k: 'grandchild', n: '손자녀' }, { k: 'grandparent', n: '조부모' }, { k: 'sibling', n: '형제자매' }
  ];
  function relName(k) { var r = RELS.filter(function (x) { return x.k === k; })[0]; return r ? r.n : ''; }
  var RANK = { spouse: 1, child: 2, parent: 3, grandchild: 4, grandparent: 5, sibling: 6 };
  /* 한 사람 → 유족보상연금 수급자격 (제63조①) */
  function pensionEligible(m) {
    m = m || {};
    if (!RANK[m.rel]) return { ok: false, why: '관계를 고르세요' };
    if (m.abroad) return { ok: false, why: '사망 당시 외국에 살던 비국민 — 제외(제63조① 괄호)' };
    if (!m.together) return { ok: false, why: '사망 당시 생계를 같이 하지 않음(제63조①)' };
    if (m.rel === 'spouse') return { ok: true, why: '배우자(제63조①)' };
    var hasAge = m.age !== '' && m.age != null && isFinite(Number(m.age)), a = Number(m.age);
    var ageOk = !hasAge ? null : (m.rel === 'parent' || m.rel === 'grandparent') ? a >= 60 : (m.rel === 'child' || m.rel === 'grandchild') ? a < 25 : (a < 19 || a >= 60);
    var rule = (m.rel === 'parent' || m.rel === 'grandparent') ? '60세 이상(1호)' : m.rel === 'child' ? '25세 미만(2호)' : m.rel === 'grandchild' ? '25세 미만(2호의2)' : '19세 미만 또는 60세 이상(3호)';
    if (ageOk) return { ok: true, why: relName(m.rel) + ' ' + rule };
    if (m.disabled) return { ok: true, why: '장애 정도 해당(제63조①4호)' };
    if (ageOk === null) return { ok: null, why: '나이를 넣으세요 — ' + rule };
    return { ok: false, why: '나이 요건 밖 — ' + rule };
  }
  /* 가족 표 → 연금 수급권자·가산 인원, 없으면 일시금 순위 (제63조③·제65조①) */
  function familyJudge(list) {
    list = [].concat(list || []).filter(function (m) { return m && RANK[m.rel]; });
    var rows = list.map(function (m, i) { return { i: i, m: m, e: pensionEligible(m) }; });
    var elig = rows.filter(function (r) { return r.e.ok === true; });
    var unknown = rows.filter(function (r) { return r.e.ok === null; }).length;
    if (elig.length) {
      var top = elig.slice().sort(function (a, b) { return RANK[a.m.rel] - RANK[b.m.rel]; })[0];
      return { mode: 'pension', rows: rows, n: elig.length, holder: relName(top.m.rel), unknown: unknown,
        text: '유족보상연금 — 받을 권리 1순위: ' + relName(top.m.rel) + '(제63조③) · 가산 대상 ' + elig.length + '명 → 급여기초연액의 ' + (47 + Math.min(5 * elig.length, 20)) + '%(별표 3)' };
    }
    if (!rows.length) return { mode: 'none', rows: rows, n: 0, unknown: 0, text: '가족을 넣으면 판단합니다.' };
    var five = { spouse: 1, child: 1, parent: 1, grandchild: 1, grandparent: 1 };
    function lumpRank(m) {
      if (m.together && five[m.rel]) return 1;
      if ((!m.together && five[m.rel]) || (m.together && m.rel === 'sibling')) return 2;
      return m.rel === 'sibling' ? 3 : 9;
    }
    var best = rows.slice().sort(function (a, b) { return (lumpRank(a.m) - lumpRank(b.m)) || (RANK[a.m.rel] - RANK[b.m.rel]); })[0];
    var same = rows.filter(function (r) { return lumpRank(r.m) === lumpRank(best.m) && r.m.rel === best.m.rel; }).length;
    return { mode: 'lump', rows: rows, n: 0, unknown: unknown, holder: relName(best.m.rel), rank: lumpRank(best.m),
      text: (unknown ? '나이를 넣지 않은 사람이 있어 확정할 수 없습니다 · ' : '') + '연금 수급자격자 없음 → 유족보상일시금(제62조②) — ' + lumpRank(best.m) + '순위 ' + relName(best.m.rel) +
        (same > 1 ? ' ' + same + '명이 똑같이 나눔' : '') + '(제65조①)' };
  }

  /* ══════════════════ 순수 로직 — 메모 글 ══════════════════ */
  function memoDeadlines(rec, hol, today) {
    var a = deadlines(rec, hol, today), b = sozoRows(rec, hol, today).filter(function (x) { return x.due; });
    if (!a.length && !b.length) return '';
    return ['🧰 산재 묶음 — 기한 (' + (today || todayStr()) + ' 계산 · 법령 기준일 ' + LAW_ASOF + ')']
      .concat(a.map(function (x) { return '· ' + x.n + ': ' + x.due + (x.rolled ? '(토·공휴일 → 다음 날)' : '') + ' — ' + x.law; }))
      .concat(b.map(function (x) { return '· ' + x.n + ' 소멸시효(' + x.years + '년): ' + x.due + ' — ' + x.law; })).join('\n');
  }
  function memoCalc(res, i) {
    if (!res || !res.rows.length) return '';
    return ['🧰 산재 묶음 — 급여 어림(1일 평균임금 ' + won(num(i.avg)).toLocaleString() + '원 · 법령 기준일 ' + LAW_ASOF + ')']
      .concat(res.rows.map(function (r) { return '· ' + r.n + ': ' + r.v.toLocaleString() + '원 — ' + r.law; }))
      .concat(res.notes.map(function (t) { return '※ ' + t; })).join('\n');
  }

  /* ══════════════════ 화면 ══════════════════ */
  var S = null;   /* { o, rec, tab, sel, famSel, showHidden, calc, fam, msg, ro } */
  var TABS = [['docs', '📋 서류'], ['due', '⏰ 기한'], ['calc', '🧮 계산'], ['fam', '👪 유족'], ['news', '📰 소식']];
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (a) {
      var v = attrs[a];
      if (v == null || v === false) return;
      if (a === 'style') e.style.cssText = v;
      else if (a === 'class') e.className = v;
      else if (a.slice(0, 2) === 'on') e.addEventListener(a.slice(2), v);
      else if (a === 'value') e.value = v;
      else if (a === 'checked') e.checked = !!v;
      else e.setAttribute(a, v === true ? '' : v);
    });
    [].concat(kids || []).forEach(function (k) { if (k != null && k !== false) e.appendChild(typeof k === 'string' || typeof k === 'number' ? document.createTextNode(String(k)) : k); });
    return e;
  }
  function css() {
    if (document.getElementById('puSjkStyle')) return;
    var s = el('style', { id: 'puSjkStyle' });
    s.textContent = [
      '.sjk-back{position:fixed;inset:0;background:rgba(20,22,28,.34);z-index:8900;display:flex;align-items:center;justify-content:center;padding:24px}',
      '.sjk-win{background:#ffffff;color:#1e293b;border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.22);width:min(980px,100%);max-height:92vh;display:flex;flex-direction:column;overflow:hidden;font-size:13px}',
      '.sjk-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e2e8f0;white-space:nowrap;flex:none}',
      '.sjk-head b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:15px}',
      '.sjk-tabs{display:flex;gap:6px;padding:8px 16px;border-bottom:1px solid #e2e8f0;overflow-x:auto;white-space:nowrap;flex:none}',
      '.sjk-tab{height:32px;padding:0 12px;border-radius:8px;border:1px solid #e2e8f0;background:#ffffff;color:#475569;cursor:pointer;font-size:13px;flex:none}',
      '.sjk-tab.on{border-color:#bfdbfe;background:#eff6ff;color:#1e40af;font-weight:700}',
      '.sjk-body{overflow:auto;padding:12px 16px;flex:1;min-height:0}',
      '.sjk-foot{display:flex;gap:8px;align-items:center;padding:8px 16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;flex:none}',
      '.sjk-fx{display:flex;align-items:center;gap:8px;flex:1;min-width:0}',
      '.sjk-fc{width:52px;flex:none}',
      '.sjk-ph{display:none}',
      '.sjk-dx{display:flex;align-items:center;gap:8px;flex:none}',
      '.sjk-foot span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sjk-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 8px}',
      '.sjk-lab{color:#64748b;font-size:12.5px;min-width:64px}',
      '.sjk-chip{height:30px;padding:0 10px;border-radius:999px;border:1px solid #e2e8f0;background:#ffffff;color:#475569;cursor:pointer;font-size:12.5px}',
      '.sjk-chip.on{border-color:#93c5fd;background:#eff6ff;color:#1e40af;font-weight:700}',
      '.sjk-btn{height:30px;padding:0 10px;border-radius:8px;border:1px solid #cbd5e1;background:#ffffff;color:#334155;cursor:pointer;font-size:12.5px;white-space:nowrap}',
      '.sjk-btn.pri{border-color:#2563eb;background:#2563eb;color:#ffffff}',
      '.sjk-btn:disabled{opacity:.45;cursor:default}',
      '.sjk-in{height:34px;border:1px solid #cbd5e1;border-radius:8px;padding:0 8px;font-size:16px;background:#ffffff;color:#1e293b;min-width:0}',
      '.sjk-tbl{border-top:1px solid #e2e8f0}',
      '.sjk-tr{display:flex;align-items:center;gap:8px;padding:6px 4px;border-bottom:1px solid #f1f5f9;white-space:nowrap}',
      '.sjk-tr.hd{color:#64748b;font-size:12px;background:#f8fafc}',
      '.sjk-tr.off{opacity:.5}',
      '.sjk-ck{width:28px;height:28px;flex:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}',   /* 누름 자리 28px — 칸 전체가 label */
      '.sjk-no{width:36px;flex:none;text-align:right;color:#64748b;font-variant-numeric:tabular-nums}',
      '.sjk-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}',
      '.sjk-law{width:230px;flex:none;overflow:hidden;text-overflow:ellipsis;color:#64748b;font-size:12px}',
      '.sjk-st{width:84px;flex:none}',
      '.sjk-amt{width:130px;flex:none;text-align:right;font-variant-numeric:tabular-nums;font-weight:700}',
      '.sjk-date{width:96px;flex:none;font-variant-numeric:tabular-nums}',
      '.sjk-left{width:64px;flex:none;text-align:right;font-variant-numeric:tabular-nums}',
      '.sjk-sub{display:none}',
      '.sjk-note{color:#92400e;font-size:12px;line-height:1.55;margin:8px 0}',
      '.sjk-box{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin:8px 0;background:#f8fafc;line-height:1.6}',
      '.sjk-selbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 8px;margin:0 0 6px;border-radius:8px;background:#eff6ff;color:#1e40af}',
      '.sjk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px 14px;margin:0 0 10px}',
      '.sjk-grid>label,.sjk-grid>.sjk-fld{display:flex;flex-direction:column;gap:3px;color:#475569;font-size:12.5px}',
      '.sjk-inl{display:inline-flex;align-items:center;gap:4px}',
      '.sjk-h{font-weight:700;margin:12px 0 6px}',
      '@media (max-width:640px){',
      '  .sjk-back{padding:0;align-items:stretch}',
      '  .sjk-win{width:100%;max-height:none;height:100%;border-radius:0}',
      '  .sjk-head,.sjk-tabs,.sjk-body,.sjk-foot{padding-left:10px;padding-right:10px}',
      '  .sjk-law,.sjk-date.wide{display:none}',
      '  .sjk-sub{display:block;color:#64748b;font-size:11.5px;overflow:hidden;text-overflow:ellipsis}',
      '  .sjk-name{white-space:nowrap}',
      '  .sjk-st{width:62px}',
      '  .sjk-amt{width:104px}',
      '  .sjk-grid{grid-template-columns:1fr}',
      '  .sjk-tr.fam{flex-wrap:wrap;row-gap:4px}',
      '  .sjk-tr.fam .sjk-fx{flex-basis:100%;padding-left:72px;flex-wrap:wrap}',
      '  .sjk-tr.fam .sjk-fc{width:auto}',
      '  .sjk-ph{display:inline}',
      '  .sjk-famh,.sjk-hh{display:none}',
      '  .sjk-tr.fam .sjk-fx .sjk-name{flex-basis:100%}',
      '  .sjk-tr.doc{flex-wrap:wrap;row-gap:4px}',
      '  .sjk-tr.doc .sjk-name .sjk-sub{display:none}',
      '  .sjk-tr.doc .sjk-dx{flex-basis:100%;min-width:0;padding-left:72px;box-sizing:border-box}',
      '  .sjk-tr.doc .sjk-dx .sjk-law{display:block;flex:1;width:auto;min-width:0}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function toast(m) { try { if (typeof root.showToast === 'function') return root.showToast(m); if (typeof root.toast === 'function') return root.toast(m); } catch (_) {} try { console.info(m); } catch (_) {} }
  function hhmm() { var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function persist(next) {
    if (S.ro) { toast('끝난 사건은 보기만 할 수 있습니다'); return false; }
    var ok = false;
    try { ok = S.o.save ? S.o.save(JSON.parse(JSON.stringify(next))) !== false : false; } catch (e) { ok = false; }
    if (ok) { S.rec = next; S.msg = '저장됨 ' + hhmm(); } else { S.msg = '⚠ 저장하지 못했습니다'; }
    return ok;
  }
  function edit(fn) { var r = normRec(JSON.parse(JSON.stringify(S.rec)), S.o.caseId); fn(r); persist(r); draw(); }
  function memo(text) {
    if (!text) { toast('붙일 내용이 없습니다'); return; }
    if (!S.o.onMemo) { toast('업무 메모 길이 없습니다'); return; }
    var ok = S.o.onMemo(text); toast(ok === false ? '❌ 메모를 붙이지 못했습니다' : '📌 업무 메모에 붙였습니다');
  }
  function chip(on, label, fn, title) { return el('button', { class: 'sjk-chip' + (on ? ' on' : ''), onclick: fn, title: title || null, disabled: S.ro || null }, label); }

  /* ── 📋 서류 ── */
  function viewDocs() {
    var r = S.rec, out = [];
    out.push(el('div', { class: 'sjk-row' }, [el('span', { class: 'sjk-lab' }, '재해')].concat(KINDS.map(function (k) {
      return chip(r.kind === k.k, k.n, function () { edit(function (x) { x.kind = x.kind === k.k ? '' : k.k; }); }, k.law);
    }))));
    if (r.kind === 'disease') {
      var sel = el('select', { class: 'sjk-in', disabled: S.ro || null, onchange: function (e) { var v = e.target.value; edit(function (x) { x.disease = v; }); } },
        [el('option', { value: '' }, '질병 갈래 고르기 (시행령 별표 3)')].concat(DISEASES.map(function (d) { var o = el('option', { value: d.k }, d.n); if (r.disease === d.k) o.selected = true; return o; })));
      out.push(el('div', { class: 'sjk-row' }, [el('span', { class: 'sjk-lab' }, '질병'), sel]));
    }
    out.push(el('div', { class: 'sjk-row' }, [el('span', { class: 'sjk-lab' }, '청구 급여')].concat(BENEFITS.map(function (b) {
      return chip(r.benefits.indexOf(b.k) >= 0, b.n, function () { edit(function (x) { var i = x.benefits.indexOf(b.k); if (i >= 0) x.benefits.splice(i, 1); else x.benefits.push(b.k); }); }, '산재보험법 ' + b.law);
    })).concat([chip(r.appeal, '⚖ 불복(심사·재심사)', function () { edit(function (x) { x.appeal = !x.appeal; }); }, '산재보험법 제103조·제106조')])));

    var list = docsFor(r, S.showHidden), p = progress(r);
    var keys = list.map(function (d) { return d.k; }), picked = keys.filter(function (k) { return S.sel[k]; });
    var allOn = keys.length > 0 && picked.length === keys.length;
    if (picked.length) {
      var day = todayStr();
      var act = function (a, label) {
        return el('button', { class: 'sjk-btn', disabled: S.ro || null, onclick: function () {
          if (!root.confirm || root.confirm(picked.length + '건을 「' + label + '」 합니다.')) { var nx = bulk(S.rec, picked, a, day); if (persist(nx)) S.sel = {}; draw(); }
        } }, label);
      };
      out.push(el('div', { class: 'sjk-selbar' }, [el('b', {}, picked.length + '건 선택'), act('got', '받음 표시'), act('sent', '제출 표시'), act('clear', '표시 지우기'),
        S.showHidden ? act('unhide', '다시 보이기') : act('hide', '목록에서 숨기기'),
        el('button', { class: 'sjk-btn', onclick: function () { S.sel = {}; draw(); } }, '선택 풀기')]));
    }
    var head = el('div', { class: 'sjk-tr hd' }, [
      el('label', { class: 'sjk-ck' }, el('input', { type: 'checkbox', checked: allOn, title: '지금 보이는 줄 모두 고르기', onchange: function (e) {
        var on = e.target.checked; S.sel = {}; if (on) keys.forEach(function (k) { S.sel[k] = 1; }); draw(); } })),
      el('span', { class: 'sjk-no' }, '№'), el('span', { class: 'sjk-name' }, '서류'),
      el('span', { class: 'sjk-dx sjk-hh' }, [el('span', { class: 'sjk-law' }, '근거'), el('span', { class: 'sjk-st' }, '받음'), el('span', { class: 'sjk-st' }, '제출')])]);
    var tbl = el('div', { class: 'sjk-tbl' }, [head]);
    list.forEach(function (d, i) {
      var tg = function (f) {
        return el('button', { class: 'sjk-btn', style: 'width:100%;padding:0 4px;' + (d[f] ? 'border-color:#86efac;background:#f0fdf4;color:#166534' : ''), disabled: S.ro || null,
          title: d[f] ? (f === 'got' ? '받은 날 ' : '제출한 날 ') + d[f] + ' — 누르면 지움' : (f === 'got' ? '받음으로 표시' : '제출로 표시'),
          onclick: function () { persist(bulk(S.rec, [d.k], d[f] ? (f === 'sent' ? 'unsent' : 'clear') : f, todayStr())); draw(); } }, d[f] ? '✓ ' + d[f].slice(5) : '—');
      };
      tbl.appendChild(el('div', { class: 'sjk-tr doc' + (d.hidden ? ' off' : '') }, [
        el('label', { class: 'sjk-ck' }, el('input', { type: 'checkbox', checked: !!S.sel[d.k], onchange: function (e) { if (e.target.checked) S.sel[d.k] = 1; else delete S.sel[d.k]; draw(); } })),
        el('span', { class: 'sjk-no' }, String(i + 1)),
        el('span', { class: 'sjk-name', title: d.n + ' — ' + d.law }, [d.n, el('span', { class: 'sjk-sub' }, d.law)]),
        el('span', { class: 'sjk-dx' }, [el('span', { class: 'sjk-law', title: d.law }, d.law),
          el('span', { class: 'sjk-st' }, tg('got')), el('span', { class: 'sjk-st' }, tg('sent'))])]));
    });
    if (!list.length) tbl.appendChild(el('div', { style: 'padding:14px;color:#64748b' }, '청구할 급여나 재해 갈래를 고르면 챙길 서류가 나옵니다.'));
    out.push(el('div', { class: 'sjk-row' }, [el('b', {}, '챙길 서류'), el('span', { style: 'color:#64748b' }, '받음 ' + p.got + ' / ' + p.n + ' · 제출 ' + p.sent + ' / ' + p.n),
      el('span', { style: 'flex:1' }), el('button', { class: 'sjk-btn', onclick: function () { S.showHidden = !S.showHidden; S.sel = {}; draw(); } }, S.showHidden ? '숨긴 서류 감추기' : '숨긴 서류 ' + r.hidden.length + ' 보기')]));
    out.push(tbl);
    var addIn = el('input', { class: 'sjk-in', placeholder: '법인 목록에 있는 서류 이름', style: 'flex:1;min-width:180px', disabled: S.ro || null });
    out.push(el('div', { class: 'sjk-row', style: 'margin-top:8px' }, [addIn, el('button', { class: 'sjk-btn', disabled: S.ro || null, onclick: function () {
      var n = String(addIn.value || '').trim(); if (!n) return;
      edit(function (x) { x.extra.push({ k: 'x' + Date.now().toString(36), n: n.slice(0, 120) }); });
    } }, '＋ 서류 더하기')]));
    out.push(el('div', { class: 'sjk-note' }, 'ⓘ 법이 정한 것은 «무엇을 적어 내야 하는지»까지입니다(예: 제41조① 소속 사업장·재해 경위·의학적 소견). 서식 이름·첨부는 근로복지공단 안내로 최종 확인하세요. 「실무 [확인 필요]」 줄은 법 조문이 아닌 실무 준비물입니다.'));
    return out;
  }

  /* ── ⏰ 기한 ── */
  function dateField(label, key, title) {
    var v = (S.rec.dates || {})[key] || '';
    return el('label', { title: title || null }, [label, el('input', { type: 'date', class: 'sjk-in', value: v, disabled: S.ro || null,
      onchange: function (e) { var x = e.target.value; edit(function (r) { if (x) r.dates[key] = x; else delete r.dates[key]; }); } })]);
  }
  function viewDue() {
    var r = S.rec, out = [], hol = S.o.holidays || [], today = todayStr();
    out.push(el('div', { class: 'sjk-grid' }, [
      dateField('보험급여 결정이 있음을 안 날', 'known', '결정 통지서를 받은 날 등 — 제103조③'),
      el('label', {}, ['판정위원회 심의를 거친 결정', el('span', { style: 'display:flex;gap:6px;align-items:center;min-height:34px' }, [
        el('input', { type: 'checkbox', checked: !!r.dates.viaBoard, disabled: S.ro || null, onchange: function (e) { var on = e.target.checked; edit(function (x) { if (on) x.dates.viaBoard = true; else delete x.dates.viaBoard; }); } }),
        '업무상질병판정위원회 — 심사 없이 바로 재심사 가능(제106조① 단서)'])]),
      dateField('심사청구서를 낸 날', 'reviewFiled', '결정 예정일 참고 — 제105조①'),
      dateField('심사 결정이 있음을 안 날', 'reviewKnown', '제106조③'),
      dateField('재심사청구서를 낸 날', 'reFiled', '재결 예정일 참고 — 제109조①'),
      dateField('재결서 정본을 송달받은 날', 'reServed', '행정소송법 제20조① 단서')]));
    var rows = deadlines(r, hol, today);
    var tbl = el('div', { class: 'sjk-tbl' }, [el('div', { class: 'sjk-tr hd' }, [el('span', { class: 'sjk-name' }, '기한'), el('span', { class: 'sjk-law' }, '근거'),
      el('span', { class: 'sjk-date' }, '마감'), el('span', { class: 'sjk-left' }, '남은 날')])]);
    rows.forEach(function (x) {
      var warn = x.left != null && x.left <= 14 && !/예정/.test(x.n);
      tbl.appendChild(el('div', { class: 'sjk-tr' }, [
        el('span', { class: 'sjk-name', title: x.n + ' — ' + x.note + ' · ' + x.law }, [x.n, el('span', { class: 'sjk-sub' }, x.law)]),
        el('span', { class: 'sjk-law', title: x.note + ' · ' + x.law }, x.law),
        el('span', { class: 'sjk-date', title: x.rolled ? '말일 ' + x.raw + '이 토·공휴일이라 다음 날(민법 제161조)' : x.note }, x.due + (x.rolled ? '*' : '')),
        el('span', { class: 'sjk-left', style: warn ? 'color:#dc2626;font-weight:700' : '' }, x.left == null ? '' : x.left < 0 ? '지남 ' + (-x.left) : 'D-' + x.left)]));
    });
    if (!rows.length) tbl.appendChild(el('div', { style: 'padding:14px;color:#64748b' }, '날짜를 넣으면 마감이 나옵니다.'));
    out.push(el('div', { class: 'sjk-h' }, '불복 기한'), tbl);
    out.push(el('div', { class: 'sjk-note' }, 'ⓘ 마감 = 그 날 + 90일(초일 불산입, 민법 제157조). 말일이 토·일·공휴일이면 다음 날(* 표시, 민법 제161조). 심사·재심사 청구는 시효 중단에서 재판상 청구로 봅니다(산재보험법 제111조①).'));

    var sz = sozoRows(r, hol, today);
    var t2 = el('div', { class: 'sjk-tbl' }, [el('div', { class: 'sjk-tr hd' }, [el('span', { class: 'sjk-name' }, '급여 · 시효 · 기산 기준일'), el('span', { class: 'sjk-law' }, '기산 예시 [확인 필요]'),
      el('span', { class: 'sjk-date' }, '만료'), el('span', { class: 'sjk-left' }, '남은 날')])]);
    sz.forEach(function (x) {
      t2.appendChild(el('div', { class: 'sjk-tr' }, [
        el('span', { class: 'sjk-name', title: x.law + ' · 기산: 권리를 행사할 수 있는 때(민법 제166조①) — 예: ' + x.hint + ' [확인 필요]' }, [x.n + ' ' + x.years + '년',
          el('input', { type: 'date', class: 'sjk-in', value: x.from, disabled: S.ro || null, style: 'margin-left:8px;height:30px', title: '기산 기준일 — 예: ' + x.hint,
            onchange: function (e) { var v = e.target.value; edit(function (q) { if (v) q.sozo[x.k] = v; else delete q.sozo[x.k]; }); } })]),
        el('span', { class: 'sjk-law', title: '실무 예시 [확인 필요] — 권리를 행사할 수 있는 때(민법 제166조①)' }, x.hint),
        el('span', { class: 'sjk-date' }, x.due ? x.due + (x.rolled ? '*' : '') : '—'),
        el('span', { class: 'sjk-left' }, x.left == null ? '' : x.left < 0 ? '지남 ' + (-x.left) : 'D-' + x.left)]));
    });
    if (!sz.length) t2.appendChild(el('div', { style: 'padding:14px;color:#64748b' }, '📋 서류 탭에서 청구할 급여를 고르면 나옵니다.'));
    out.push(el('div', { class: 'sjk-h' }, '보험급여 소멸시효 (산재보험법 제112조① — 3년, 장해·유족·장례비 5년)'), t2);
    out.push(el('div', { class: 'sjk-note' }, 'ⓘ 시효는 «권리를 행사할 수 있는 때»부터(민법 제166조①). 급여마다 기산점이 달라 기준일은 사람이 넣습니다 — 옆 예시는 실무 예시라 [확인 필요]. 만료 = 기준일부터 N년(민법 제157·160조).'));
    out.push(el('div', { class: 'sjk-row' }, [el('button', { class: 'sjk-btn pri', onclick: function () { memo(memoDeadlines(S.rec, hol, today)); } }, '📌 기한을 업무 메모에 붙이기')]));
    return out;
  }

  /* ── 🧮 계산 ── */
  function numField(label, key, ph, title) {
    return el('label', { title: title || null }, [label, el('input', { class: 'sjk-in', inputmode: 'numeric', value: S.calc[key] == null ? '' : S.calc[key], placeholder: ph || '',
      oninput: function (e) { S.calc[key] = e.target.value; }, onchange: function () { draw(); } })]);
  }
  function viewCalc() {
    var c = S.calc, out = [];
    out.push(el('div', { class: 'sjk-box' }, [el('b', {}, '평균임금 구하기 '), el('span', { style: 'color:#64748b' }, '— 3개월 임금총액 ÷ 그 기간 총일수(근로기준법 제2조①6호), 통상임금이 더 크면 통상임금(같은 조②)'),
      el('div', { class: 'sjk-grid', style: 'margin-top:6px' }, [numField('3개월 임금총액(원)', 'w3', '예: 9000000'), numField('그 기간 총일수', 'd3', '예: 92'), numField('통상임금 1일(원, 있으면)', 'ord', '')]),
      el('button', { class: 'sjk-btn', onclick: function () {
        var L = root.PuLaborCore, r;
        if (L && typeof L.averageWage === 'function') r = L.averageWage({ 기간임금총액: num(c.w3), 기간일수: num(c.d3), 통상일급: num(c.ord) });
        else { var raw = num(c.d3) ? num(c.w3) / num(c.d3) : 0; r = { 일평균임금: Math.max(raw, num(c.ord)) }; }
        if (!r || !r.일평균임금) { toast('임금총액과 일수를 넣으세요'); return; }
        c.avg = String(Math.round(r.일평균임금 * 100) / 100); draw();
      } }, '→ 1일 평균임금에 넣기')]));
    out.push(el('div', { class: 'sjk-grid' }, [
      numField('1일 평균임금(원)', 'avg', '예: 98000'),
      numField('최고 보상기준 금액(원, 고시)', 'maxStd', '해마다 고용노동부 고시', '제36조⑦⑧'),
      numField('최저 보상기준 금액(원, 고시)', 'minStd', '해마다 고용노동부 고시', '제36조⑦⑧'),
      numField('시간급 최저임금(원)', 'minWageHour', '그해 최저임금 고시', '최저임금액 = 시간급 × 8(제36조⑦)'),
      numField('휴업 일수', 'restDays', '요양으로 취업하지 못한 날수', '제52조'),
      el('label', {}, ['장해등급', (function () {
        var s = el('select', { class: 'sjk-in', onchange: function (e) { c.grade = e.target.value; draw(); } }, [el('option', { value: '' }, '—')].concat(JANGHAE_LUMP.map(function (_, i) {
          var o = el('option', { value: String(i + 1) }, '제' + (i + 1) + '급'); if (String(c.grade) === String(i + 1)) o.selected = true; return o; })));
        return s; })()]),
      numField('장해가 둘 이상이면 등급들(예: 7, 9)', 'grades', '쉼표로', '시행령 제53조②'),
      el('label', {}, ['상병보상연금 중증요양상태등급', (function () {
        var s = el('select', { class: 'sjk-in', onchange: function (e) { c.sbGrade = e.target.value; draw(); } }, [el('option', { value: '' }, '—')].concat([1, 2, 3].map(function (g) {
          var o = el('option', { value: String(g) }, '제' + g + '급'); if (String(c.sbGrade) === String(g)) o.selected = true; return o; })));
        return s; })()]),
      numField('유족보상연금 수급자격자 수(수급권자 포함)', 'yujokN', '없으면 0 — 👪 유족 탭에서 넣기', '별표 3'),
      el('div', { class: 'sjk-fld' }, ['유족 선택', el('span', { style: 'display:flex;gap:10px;align-items:center;height:34px;flex-wrap:wrap' }, [
        el('label', { class: 'sjk-inl' }, [el('input', { type: 'checkbox', checked: !!c.yujokHalf, onchange: function (e) { c.yujokHalf = e.target.checked; draw(); } }), '연금 절반 일시금(제62조③)']),
        el('label', { class: 'sjk-inl' }, [el('input', { type: 'checkbox', checked: !!c.funeral, onchange: function (e) { c.funeral = e.target.checked; draw(); } }), '장례비'])])]),
      numField('장례비 최고 금액(원, 고시)', 'funeralMax', '', '제71조②'),
      numField('장례비 최저 금액(원, 고시)', 'funeralMin', '', '제71조②')]));
    var ga = gradeAdjust(String(c.grades || '').split(/[,\s]+/));
    if (ga && ga.from.length >= 2) out.push(el('div', { class: 'sjk-box' }, ['조정 등급: 제' + ga.grade + '급 — ' + ga.why + ' ',
      el('button', { class: 'sjk-btn', onclick: function () { c.grade = String(ga.grade); draw(); } }, '장해등급에 넣기'),
      el('div', { style: 'color:#64748b;font-size:12px' }, '그 장해가 조정 등급의 다른 장해보다 명백히 낮으면 1개 등급 낮춥니다(시행령 제53조② 단서) — 담당 노무사 판단.')]));
    var res = calc(c);
    var tbl = el('div', { class: 'sjk-tbl' }, [el('div', { class: 'sjk-tr hd' }, [el('span', { class: 'sjk-name' }, '급여'), el('span', { class: 'sjk-amt' }, '금액(원)'), el('span', { class: 'sjk-law', style: 'width:360px' }, '산식 · 근거')])]);
    res.rows.forEach(function (x) {
      tbl.appendChild(el('div', { class: 'sjk-tr' }, [el('span', { class: 'sjk-name', title: x.n + ' — ' + x.law }, [x.n, el('span', { class: 'sjk-sub' }, x.law)]),
        el('span', { class: 'sjk-amt' }, x.v.toLocaleString()), el('span', { class: 'sjk-law', style: 'width:360px', title: x.law }, x.law)]));
    });
    out.push(el('div', { class: 'sjk-h' }, '어림 결과'), tbl);
    res.notes.forEach(function (t) { out.push(el('div', { class: 'sjk-note' }, 'ⓘ ' + t)); });
    out.push(el('div', { class: 'sjk-row' }, [el('button', { class: 'sjk-btn pri', onclick: function () { memo(memoCalc(calc(S.calc), S.calc)); } }, '📌 어림 결과를 업무 메모에 붙이기'),
      el('span', { style: 'color:#64748b;font-size:12px' }, '계산 칸은 저장하지 않습니다(임금 자료) — 남길 것만 메모로.')]));
    return out;
  }

  /* ── 👪 유족 ── */
  function viewFam() {
    var out = [], fam = S.fam, j = familyJudge(fam);
    var picked = fam.map(function (_, i) { return i; }).filter(function (i) { return S.famSel[i]; });
    if (picked.length) out.push(el('div', { class: 'sjk-selbar' }, [el('b', {}, picked.length + '건 선택'),
      el('button', { class: 'sjk-btn', onclick: function () { if (!root.confirm || root.confirm(picked.length + '명을 표에서 뺍니다.')) { S.fam = fam.filter(function (_, i) { return !S.famSel[i]; }); S.famSel = {}; draw(); } } }, '표에서 빼기'),
      el('button', { class: 'sjk-btn', onclick: function () { S.famSel = {}; draw(); } }, '선택 풀기')]));
    var allOn = fam.length > 0 && picked.length === fam.length;
    var tbl = el('div', { class: 'sjk-tbl' }, [el('div', { class: 'sjk-tr hd' }, [
      el('label', { class: 'sjk-ck' }, el('input', { type: 'checkbox', checked: allOn, title: '모두 고르기', onchange: function (e) { var on = e.target.checked; S.famSel = {}; if (on) fam.forEach(function (_, i) { S.famSel[i] = 1; }); draw(); } })),
      el('span', { class: 'sjk-no' }, '№'), el('span', { style: 'width:104px;flex:none' }, '관계'), el('span', { style: 'width:70px;flex:none' }, '나이'),
      el('span', { class: 'sjk-fx sjk-famh' }, [el('span', { class: 'sjk-fc', title: '사망 당시 생계를 같이 했나' }, '생계'), el('span', { class: 'sjk-fc', title: '제63조①4호 장애 정도' }, '장애'),
        el('span', { class: 'sjk-fc', title: '사망 당시 외국에 살던 비국민' }, '외국'), el('span', { class: 'sjk-name' }, '연금 수급자격')])])]);
    fam.forEach(function (m, i) {
      var e = pensionEligible(m);
      var ck = function (f, lab) { return el('label', { class: 'sjk-fc sjk-inl' }, [el('input', { type: 'checkbox', checked: !!m[f], onchange: function (ev) { m[f] = ev.target.checked; draw(); } }), el('span', { class: 'sjk-ph' }, lab)]); };
      tbl.appendChild(el('div', { class: 'sjk-tr fam' }, [
        el('label', { class: 'sjk-ck' }, el('input', { type: 'checkbox', checked: !!S.famSel[i], onchange: function (ev) { if (ev.target.checked) S.famSel[i] = 1; else delete S.famSel[i]; draw(); } })),
        el('span', { class: 'sjk-no' }, String(i + 1)),
        el('span', { style: 'width:104px;flex:none' }, (function () { var s = el('select', { class: 'sjk-in', style: 'width:100%', onchange: function (ev) { m.rel = ev.target.value; draw(); } },
          RELS.map(function (x) { var o = el('option', { value: x.k }, x.n); if (m.rel === x.k) o.selected = true; return o; })); return s; })()),
        el('span', { style: 'width:70px;flex:none' }, el('input', { class: 'sjk-in', style: 'width:100%', inputmode: 'numeric', value: m.age == null ? '' : m.age, oninput: function (ev) { m.age = ev.target.value; }, onchange: function () { draw(); } })),
        el('span', { class: 'sjk-fx' }, [ck('together', '생계'), ck('disabled', '장애'), ck('abroad', '외국'),
          el('span', { class: 'sjk-name', title: e.why, style: 'color:' + (e.ok === true ? '#166534' : e.ok === false ? '#b91c1c' : '#92400e') }, (e.ok === true ? '○ ' : e.ok === false ? '× ' : '? ') + e.why)])]));
    });
    if (!fam.length) tbl.appendChild(el('div', { style: 'padding:14px;color:#64748b' }, '「＋ 가족 더하기」로 사망 당시 가족을 넣으세요(이름은 받지 않습니다).'));
    out.push(el('div', { class: 'sjk-row' }, [el('b', {}, '사망 당시 가족'), el('span', { style: 'flex:1' }),
      el('button', { class: 'sjk-btn', onclick: function () { S.fam.push({ rel: 'spouse', age: '', together: true, disabled: false, abroad: false }); draw(); } }, '＋ 가족 더하기')]), tbl);
    out.push(el('div', { class: 'sjk-box' }, [el('b', {}, j.text),
      j.mode === 'pension' ? el('div', {}, el('button', { class: 'sjk-btn', style: 'margin-top:6px', onclick: function () { S.calc.yujokN = String(j.n); S.tab = 'calc'; draw(); } }, '→ 🧮 계산에 ' + j.n + '명 넣기')) : null,
      j.mode === 'lump' ? el('div', {}, el('button', { class: 'sjk-btn', style: 'margin-top:6px', onclick: function () { S.calc.yujokN = '0'; S.tab = 'calc'; draw(); } }, '→ 🧮 계산에 일시금으로 넣기')) : null]));
    out.push(el('div', { class: 'sjk-note' }, 'ⓘ 연금 수급자격: 사망 당시 생계를 같이 한 배우자, 60세 이상 부모·조부모, 25세 미만 자녀·손자녀, 19세 미만·60세 이상 형제자매, 장애 정도 해당자(제63조①). 받을 권리 순서는 배우자·자녀·부모·손자녀·조부모·형제자매(제63조③). 일시금 순위에서 양부모가 실부모보다 앞서고(제65조②), 유언으로 지정하면 그 지정을 따릅니다(제65조④). 생계를 같이 했는지의 기준은 대통령령 [확인 필요].'));
    out.push(el('div', { class: 'sjk-note', style: 'color:#64748b' }, '이 표는 저장하지 않습니다 — 창을 닫으면 지워집니다.'));
    out.push(el('div', { class: 'sjk-row' }, [el('button', { class: 'sjk-btn pri', disabled: !fam.length || null, onclick: function () {
      memo('🧰 산재 묶음 — 유족 판단(법령 기준일 ' + LAW_ASOF + ')\n' + j.rows.map(function (r, i) { return '· ' + (i + 1) + '. ' + relName(r.m.rel) + (r.m.age !== '' && r.m.age != null ? ' ' + r.m.age + '세' : '') + (r.m.together ? ' · 생계같이' : '') + ' → ' + (r.e.ok === true ? '연금 수급자격 ○' : r.e.ok === false ? '연금 수급자격 ×' : '확인 필요') + ' (' + r.e.why + ')'; }).join('\n') + '\n' + j.text);
    } }, '📌 유족 판단을 업무 메모에 붙이기')]));
    return out;
  }

  /* ── 📰 소식 ── */
  var NEWS = [
    { d: '2026-07-01', t: '산업재해보상보험법 현행 — 2026-02-19 공포, 2026-07-01 시행', src: '국가법령정보센터' },
    { d: '2026-07-01', t: '같은 법 시행령 현행 — 2026-06-30 공포, 2026-07-01 시행', src: '국가법령정보센터' },
    { d: '2026-02-02', t: '같은 법 시행규칙 현행 — 2026-02-02 공포·시행', src: '국가법령정보센터' },
    { d: '2027-03-30', t: '🔜 산업재해보상보험법 일부개정 시행 예정 — 2026-09-29 공포(법률 제22025호). 바뀌는 조문은 원문으로 확인 [확인 필요]', src: '국가법령정보센터' },
    { d: '2028-03-01', t: '🔜 행정소송법 일부개정 시행 예정 — 2026-03-17 공포(법률 제21461호). 제소기간 등에 닿는지 확인 [확인 필요]', src: '국가법령정보센터' }
  ];
  var LINKS = [
    { n: '국가법령정보센터 — 산업재해보상보험법', u: 'https://www.law.go.kr/법령/산업재해보상보험법' },
    { n: '근로복지공단', u: 'https://www.comwel.or.kr' },
    { n: '고용노동부', u: 'https://www.moel.go.kr' }
  ];
  function viewNews() {
    var out = [];
    out.push(el('div', { class: 'sjk-h' }, '법령 현황 (' + LAW_ASOF + ' 원문 확인)'));
    var tbl = el('div', { class: 'sjk-tbl' });
    NEWS.forEach(function (x, i) { tbl.appendChild(el('div', { class: 'sjk-tr' }, [el('span', { class: 'sjk-no' }, String(i + 1)), el('span', { class: 'sjk-date' }, x.d),
      el('span', { class: 'sjk-name', title: x.t }, x.t), el('span', { class: 'sjk-law', style: 'width:120px' }, x.src)])); });
    out.push(tbl);
    out.push(el('div', { class: 'sjk-note' }, 'ⓘ 최고·최저 보상기준 금액과 장례비 최고·최저 금액은 해마다 고용노동부가 고시합니다(제36조⑧·제71조②) — 🧮 계산 탭에 그해 고시 금액을 넣으세요.'));
    out.push(el('div', { class: 'sjk-h' }, '판례·결정례'));
    out.push(el('div', { class: 'sjk-row' }, [el('button', { class: 'sjk-btn pri', disabled: !root.PuSanjae || null, onclick: function () {
      if (root.PuSanjae) root.PuSanjae.open({ kind: 'jil', q: S.o.query || '', onAttach: S.o.onMemo ? function (t) { S.o.onMemo('⚖ 참고 사례 — ' + t); } : null });
    } }, '⚖ 판례·심사결정서·질병판정서 찾기'), el('span', { style: 'color:#64748b;font-size:12px' }, '근로복지공단 공개 자료(공공데이터포털)')]));
    out.push(el('div', { class: 'sjk-h' }, '공식 출처'));
    out.push(el('div', {}, LINKS.map(function (l) { return el('div', { style: 'margin:4px 0' }, el('a', { href: l.u, target: '_blank', rel: 'noopener', style: 'color:#1d4ed8' }, l.n + ' ›')); })));
    return out;
  }

  function draw() {
    var box = document.getElementById('puSjkBox');
    if (!S) { if (box) box.remove(); return; }
    css();
    if (!box) { box = el('div', { id: 'puSjkBox' }); document.body.appendChild(box); }
    var keepTop = 0; try { var ob = box.querySelector('.sjk-body'); if (ob) keepTop = ob.scrollTop; } catch (_) {}
    box.innerHTML = '';
    var body = el('div', { class: 'sjk-body' }, S.tab === 'due' ? viewDue() : S.tab === 'calc' ? viewCalc() : S.tab === 'fam' ? viewFam() : S.tab === 'news' ? viewNews() : viewDocs());
    var win = el('div', { class: 'sjk-win', role: 'dialog', 'aria-label': '산재 묶음' }, [
      el('div', { class: 'sjk-head' }, [el('span', {}, '🧰'), el('b', { title: S.o.title || '' }, '산재 묶음' + (S.o.title ? ' · ' + S.o.title : '')),
        S.ro ? el('span', { style: 'color:#92400e;font-size:12px' }, '끝난 사건 — 보기만') : null,
        el('span', { style: 'cursor:pointer;color:#64748b;font-size:18px', title: '닫기', onclick: close }, '✕')]),
      el('div', { class: 'sjk-tabs' }, TABS.map(function (t) { return el('button', { class: 'sjk-tab' + (S.tab === t[0] ? ' on' : ''), onclick: function () { S.tab = t[0]; S.sel = {}; S.famSel = {}; draw(); } }, t[1]); })),
      body,
      el('div', { class: 'sjk-foot' }, [el('span', {}, '법령 기준일 ' + LAW_ASOF + ' · 국가법령정보센터 원문 · 최종 판단은 담당 노무사'), el('b', {}, S.msg || '')])]);
    box.appendChild(el('div', { class: 'sjk-back', onclick: function (e) { if (e.target === e.currentTarget) close(); } }, [win]));
    try { body.scrollTop = keepTop; } catch (_) {}
  }
  function open(opts) {
    opts = opts || {};
    if (!opts.caseId) { toast('사건이 없습니다'); return; }
    var rec = null; try { rec = opts.load ? opts.load() : null; } catch (_) {}
    S = { o: opts, rec: normRec(rec, opts.caseId), tab: opts.tab || 'docs', sel: {}, famSel: {}, showHidden: false, calc: {}, fam: [], msg: '', ro: !!opts.readOnly };
    draw();
  }
  function close() { S = null; draw(); }
  function onKey(e) {
    if (!S || e.key !== 'Escape') return;
    var other = document.getElementById('puSanjaeBox'); if (other && other.firstChild) return;   /* 사례 찾기 창이 위에 떠 있으면 그쪽이 닫힌다 */
    close();
  }
  if (root.document) root.document.addEventListener('keydown', onKey);

  root.PuSanjaeKit = { open: open, close: close, LAW_ASOF: LAW_ASOF, BENEFITS: BENEFITS, KINDS: KINDS, DISEASES: DISEASES, DOCS: DOCS, RELS: RELS,
    JANGHAE_PENSION: JANGHAE_PENSION, JANGHAE_LUMP: JANGHAE_LUMP, SANGBYEONG: SANGBYEONG,
    newRec: newRec, normRec: normRec, docsFor: docsFor, progress: progress, bulk: bulk, addDays: addDays, addYearsCivil: addYearsCivil,
    rollHoliday: rollHoliday, deadlines: deadlines, sozoRows: sozoRows, calc: calc, gradeAdjust: gradeAdjust, adjAvg: adjAvg,
    pensionEligible: pensionEligible, familyJudge: familyJudge, memoDeadlines: memoDeadlines, memoCalc: memoCalc };
})(typeof window !== 'undefined' ? window : globalThis);
