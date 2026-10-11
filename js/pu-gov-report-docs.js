'use strict';
/* 컨설팅보고서 앱(gov-report.html) — 서류 관리(왼쪽 패널)·목차의 순수 함수 (브라우저 window.PuGovReportDocs / Node 겸용)
   (대표 지시 2026-10-10 「대시보드 왼쪽에 서류(페이퍼) 관리」 · 「환경설정 → 컨설팅관리 → 컨설팅 사업과 연계해 목차」
    · 설계 docs/superpowers/specs/2026-10-10-gov-report-docs-design.md · 계획 docs/superpowers/plans/2026-10-10-gov-report-docs.md)
   무엇을 지키나
     · 읽기만 한다 — 받은 값으로 사업 목록·체크표·목차를 만들 뿐 아무 데도 쓰지 않는다.
     · 서류 틀은 ERP 사업 «이름»(공백 뺀)에 낱말이 들어 있는가로 고른다 — 코드(consulting-…)는 환경마다 다르다.
       DOC_PLANS 차례가 뜻이다: 좁은 낱말이 먼저(산업일자리전환컨설팅충남 → 산업일자리).
     · ①② 자동은 정부사업일정 보고서 창이 채우는 간단형 넷(AUTO — 현장클리닉 포함, 2026-10-12)만 — 현황판 줄(buildRows)의 상태를 그대로 쓴다.
     · [확인 필요] 는 지어내지 않고 딱지로 보인다(현장클리닉 2026-04 개정 지침 대조 · 농촌융복합 양식 글자 · 연결·계약 못 찾음).
     · 제출 줄(step 'submit')에만 선택 필드 how('mail'|'platform')·steps(플랫폼 제출 순서 글)를 둘 수 있다(2026-10-11).
       how 가 없으면 정하지 않은 것이다. 화면이 서명·제출 메일 초안/체크 글에 쓴다.
     · 현장클리닉(2026-10-12)은 운영지침 공식 서식(별지11·13·14·24)으로 줄을 짰다 — 간단형이라 plat·report 줄은 서류 목차에만 나오고
       체크표 ③④⑤ 는 sign·attach·submit 줄만 읽는다(이 틀에는 sign·attach 가 없어 ③④ 는 「—」). 줄 안내 글(note)은 서식이 정한 때·기한뿐.
     · 틀의 선택 필드 chipItem(줄 id)이 있으면 목차의 ①② 보고서 상태 딱지는 그 줄에만 붙는다(현장클리닉 = result, 별지14).
       없으면 report 줄마다 붙는 기존 그대로.
     · 대형 틀(2026-10-11, 설계 2-A)은 항목마다 선택 글 steps(플랫폼 입력 순서 · plat 줄)·note(증빙·기준 안내)를 둘 수 있다.
       docsTable 은 대형이면 단계 열(cols = 항목 이름)·칸(cells)·다음 단계(next)를, trackRows 는 막힌 단계(blocked)를 돌려준다.
       간단형 출력은 그대로다(big·next 속성이 없다). 월별 서류의 달은 monthsFor(계약 기간 → 회차 날짜).
     · 목차에는 업체 이름·담당 이름·날짜·서류 이름·상태만 — 연락처·금액·보고서 본문은 담지 않는다.
     · ③④⑤ 칸·목차 딱지·현황판 줄 기록(trackRows)은 서류 진행 기록(scal_docs, pu-gov-report-track.js)을
       «받았을 때만» 계산한다 — 못 읽었으면(규칙 게시 전·권한 없음) 지금처럼 「—」. 이 모듈은 여전히 쓰지 않는다.
       (설계 docs/superpowers/specs/2026-10-10-gov-report-track-design.md)
   ⚠ 업체×사업 쌍(pairs)은 pu-gov-report-list.js candidates 와 같은 조건이다(지운 업체 뺌 · 사전진단 뺀 회차 · 해 = 첫 회차).
     한쪽만 바꾸면 체크표와 목록이 다른 업체를 센다.
   ⚠ 저장소는 공개다 — 검사는 합성 자료만 쓴다. */
(function (root) {
  var Track = (typeof module !== 'undefined' && module.exports) ? require('./pu-gov-report-track.js') : root.PuGovReportTrack;
  var NO_AGENCY = '기관 미지정';
  var UNLINKED = '정부사업일정에 사업 없음';
  var NO_PLAN = '서류 틀 없음';
  var SOURCE = '컨설팅보고서_사업별_양식·항목_정리_2026-10-09.md §2';
  var AUTO = { 'cci-north': true, 'cci-seosan': true, techguard: true, clinic: true };
  var KIND_KO = { '간단': '간단형', '대형': '대형', '없음': NO_PLAN };
  var COLS = ['①초안', '②확정', '③서명본', '④별첨', '⑤제출'];
  var TRACK_COLS = ['sign', 'attach', 'submit'];   // 체크표 ③④⑤ 칸 = 서류 틀 줄의 step
  /* gov-consulting.html CO_CORP_RE 의 줄인 꼴 — 이름 견주기에서 법인 표기를 뗀다 */
  var CORP_RE = /(주식회사|유한회사|유한책임회사|합자회사|합명회사|사단법인|재단법인|농업회사법인|영농조합법인|㈜|\(주\)|\(유\)|\(사\)|\(재\))/g;

  function str(v) { return v == null ? '' : String(v).trim(); }
  function squash(v) { return str(v).replace(/\s+/g, ''); }
  function digits(v) { return str(v).replace(/\D/g, ''); }
  function it(id, name, per, step, extra) {
    var o = { id: id, name: name, per: per, step: step };
    if (extra) { if (extra.how) o.how = extra.how; if (extra.steps) o.steps = extra.steps; if (extra.note) o.note = extra.note; if (extra.rd) o.rd = true; }
    return o;
  }
  /* 기술보호울타리 제출 순서 — 2024 «시스템 사용 매뉴얼(전문가용)» 기준 초안. [노무사 확인] — 화면이 바뀌면 고친다.
     로그인(공동인증서·통합로그인)과 «제출» 단추는 사람이 한다. 비밀번호·인증서는 다루지 않는다. */
  var TECHGUARD_STEPS = [
    '기술보호울타리에 로그인(공동인증서·통합로그인) — 사람이 합니다',
    '마이페이지 → 상담현황에서 그 기업 건을 열어 상태가 «상담중» 이후인지 확인',
    '완료보고서 작성: 지원일자(차수)·자문내용·총평(점수) 입력',
    '완료보고서(PDF) 업로드 — 신청기업에게 공개되는 문서입니다(개인 증빙은 넣지 않습니다)',
    '여비 여부 선택 → 기타 증빙서류(비공개)에 여비지급신청서 등 업로드',
    '«제출» 단추 — 사람이 누릅니다 → 상태가 «제출완료»로 바뀌었는지 확인',
    '접수 화면을 캡처해 두고, 이 칸의 «접수 확인»에 표시'
  ];

  /* 대형 사업 플랫폼 입력 순서 글 — 정리본 기준 초안 [노무사 확인]. 로그인(공동인증서·OTP)과 저장·제출 단추는 사람이 한다 */
  var PLAT_LOGIN = '플랫폼에 로그인 — 사람이 합니다(공동인증서·OTP 는 자동으로 다루지 않습니다)';
  var PLAT_SUBMIT = '저장·제출 단추 — 사람이 누릅니다';

  var DOC_PLANS = [
    { key: 'industry-cn', words: ['산업일자리전환컨설팅충남'], kind: '대형', source: SOURCE, items: [
      it('log', '수행일지', 'once', 'plat', { note: '컨설팅 수행일지 — 기본정보(사업명·수행기관·컨설턴트·기업)와 회차별 수행 내용' }),
      it('monthly', '월별 수행실적보고서', 'month', 'report', { note: '달마다 한 부' }),
      it('result', '결과보고서', 'once', 'report', { note: '컨설팅 개요 · 진단 결과·전환 과제 · 핵심 과제·KPI · 로드맵 · 기대효과 · 이행 계획 · 사후관리 방안' }),
      it('after', '사후관리 결과보고서', 'once', 'report')] },
    { key: 'cci-north', words: ['충남북부'], kind: '간단', source: SOURCE, items: [
      it('report', '결과보고서', 'once', 'report'),
      it('sign', '업체 서명본', 'once', 'sign'),
      it('attach', '산출물 별첨', 'once', 'attach'),
      it('submit', '기관 제출', 'once', 'submit', { how: 'mail' })] },
    { key: 'cci-seosan', words: ['서산'], kind: '간단', source: SOURCE, items: [
      it('visit', '방문확인서', 'round', 'report'),
      it('report', '상담·자문 결과보고서', 'once', 'report'),
      it('sign', '업체 서명본', 'once', 'sign'),
      it('attach', '산출물 별첨', 'once', 'attach'),
      it('submit', '기관 제출', 'once', 'submit', { how: 'mail' })] },
    { key: 'techguard', words: ['기술보호'], kind: '간단', source: SOURCE, items: [
      it('report', '별지11 완료보고서', 'once', 'report'),
      it('advice', '법률 자문 일지', 'round', 'attach'),
      it('pledge', '보안서약서', 'once', 'attach'),
      it('travel', '별지8 여비지급신청서', 'once', 'attach'),
      it('survey', '만족도조사', 'once', 'attach'),
      it('submit', '기관 제출(기술보호울타리)', 'once', 'submit', { how: 'platform', steps: TECHGUARD_STEPS })] },
    /* 현장클리닉 — 운영지침 공식 서식(별지11 수행계획서 · 13 변경요청서 · 14 현장지도결과서 · 24 성과추적관리결과서). 줄 id log·track·submit 은 옛 기록 그대로 */
    { key: 'clinic', words: ['현장클리닉'], kind: '간단', check: '2026-04 개정 지침 대조(별지 24)', chipItem: 'result', source: SOURCE, items: [
      it('plan', '별지11 현장클리닉 수행계획서', 'once', 'plat', { note: '클리닉위원 선정 후 7일 이내 시스템 제출 — 운영기관 승인 전에는 현장클리닉을 수행할 수 없습니다(운영지침 제22조)' }),
      it('change', '별지13 수행계획 변경요청서', 'once', 'plat', { note: '계획 일정·내용을 바꿀 때 — 기 등록된 수행일시 전에 요청(해당 없으면 「해당없음」)' }),
      it('log', '상담일지', 'round', 'report'),
      it('result', '별지14 현장지도결과서', 'once', 'report', { note: '최종 수행일로부터 14일 이내(반려 후 7일 이내 재제출) · 시스템 입력 + 별도 결과서 파일 첨부(최대 3개·30MB 이하) · 70점 미만이면 취소·사업비 미지급' }),
      it('track', '별지24 성과추적관리결과서', 'once', 'report', { note: '운영기관이 성과추적관리를 요청한 기업만 — 2026-04 개정 지침 원문 확인 필요' }),
      it('submit', '기관 제출(비즈니스지원단 시스템)', 'once', 'submit', { how: 'platform', steps: [
        '비즈니스지원단 시스템(중소벤처기업부 비즈니스지원단 사이트)에 로그인 — 사람이 합니다(인증은 자동으로 다루지 않습니다)',
        '현장클리닉 상담신청 및 현황에서 그 기업 건을 열어 수행일·시간 확인',
        '별지14 현장지도결과서 항목을 입력하고 결과서 파일을 첨부(최대 3개 · 파일당 30MB 이하)',
        '최종 수행일로부터 14일 이내인지 확인 후 «제출» 단추 — 사람이 누릅니다',
        '제출 화면(접수 상태)을 캡처해 두고 이 칸의 «접수 확인»에 표시'] })] },
    { key: 'rural', words: ['농촌융복합'], kind: '간단', check: '양식 글자', source: SOURCE, items: [
      it('plan', '사업계획서', 'once', 'report'),
      it('result', '결과보고서', 'round', 'report'),
      it('receipt', '수당 영수증·청렴서약서', 'once', 'attach'),
      it('photo', '현장 사진', 'once', 'attach')] },
    /* 이알피 이름이 「일터상생혁신컨설팅」이다(옛 「일터혁신상생컨설팅」은 숨김·합침) — 낱말 둘 다 본다 */
    { key: 'workplace', words: ['일터혁신', '일터상생혁신'], kind: '대형', criteria: 'workplace', source: SOURCE, items: [
      it('guide', '참여 안내서(서명)', 'once', 'sign', { note: '담당자 서명 후 플랫폼에 업로드' }),
      it('plan', '수행계획서', 'once', 'plat', { steps: [PLAT_LOGIN, '진단 결과 문제점·개선 필요사항 입력',
        '개선과제 최대 5개와 우선순위(공식 «개선과제명» 사용) · 선택 과제 2개(특화는 3개)',
        '과제별 수행목표·적용대상·수행내용·기대효과 · 노사참여(디자인팀 성명·부서·직급) · 연계 정부지원사업', PLAT_SUBMIT] }),
      it('round', '회차별 수행보고서+사진2장+서명지', 'round', 'plat', { steps: [PLAT_LOGIN,
        '회차 수행보고서 입력: 진단기간·참여인력·수행일시·회차·회의형태·참석자(성명·부서·직급)',
        '회의안건·주요 논의사항·기타(다음 안건 등) — «○회차 디자인팀 회의» 같은 형식적 문구는 쓰지 않습니다',
        '시작·종료 사진(타임스탬프 앱) 2장과 참석자 전원 서명지 스캔 첨부', PLAT_SUBMIT],
        note: '회의 2시간 이상 · 기업 참여 3명 이상 · 대면 70% 이상(비대면은 ZOOM 등 공식 프로그램만 — 전화·메일은 인정 안 됨)', rd: true }),
      it('kickoff', '착수보고', 'once', 'report', { note: '통합진단보고서(PPT) — 디자인팀 전원 참석' }),
      it('mid', '중간보고', 'once', 'report', { note: '통합진단보고서(PPT) — 디자인팀 전원 참석' }),
      it('final', '최종보고', 'once', 'report', { note: '통합진단보고서(PPT) — 디자인팀 전원 참석' }),
      it('follow', '이행관리 등록', 'once', 'plat', { steps: [PLAT_LOGIN, '이행관리 수행내용 등록', PLAT_SUBMIT] }),
      it('outcome', '이행결과표', 'once', 'report')] },
    { key: 'industry', words: ['산업일자리'], kind: '대형', criteria: 'industry', source: SOURCE, items: [
      it('kickoff', '착수보고서(PPT)', 'once', 'report', { note: '표준 PPT — 사업개요·컨설팅 추진 계획·운영 체계. 업로드하면 1MD 로 인정' }),
      it('plan', '수행계획서', 'once', 'report', { note: '운영기관 승인이 나야 수행을 시작합니다' }),
      it('mdlog', 'MD별 수행일지', 'round', 'report', { note: '비대면은 보고서 4MD·자료조사 2MD 까지(연속 불가)', rd: true }),
      it('final', '최종결과보고서', 'once', 'report', { note: '표준 HWP + 체크리스트: KPI 4개 이상(필수 2·선택 2) · 정부지원사업 2개 이상 연계(산업일자리전환지원금 필수) · 기업 현황 최신 연도 · 다른 보고서와 중복 금지' }),
      it('meeting', '최종보고회', 'once', 'report', { note: '최종 MD 대면 결과보고회' }),
      it('link', '연계지원사업 등록', 'once', 'plat', { steps: [PLAT_LOGIN, '수행일지·최종결과보고서 등록 확인',
        '연계지원사업 등록(산업일자리전환지원금 포함 2개 이상 — 적합·부적합 사유)', PLAT_SUBMIT] }),
      it('done', '완료보고서(요약)', 'once', 'report', { note: '운영기관·중진공 승인으로 완료' })] },
  ];
  var NONE = { key: 'none', words: [], kind: '없음', source: '', items: [] };

  /* {u, v} 를 벗기고 배열·번호 객체를 다 받는다 — 객체가 아닌 것은 버린다 */
  function rowsOf(v) {
    if (v && typeof v === 'object' && !Array.isArray(v) && v.v !== undefined) v = v.v;
    var a = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []);
    return a.filter(function (x) { return x && typeof x === 'object'; });
  }
  /* pu-gov-report-list.js list 와 같다 — id 가 있는 것만 */
  function list(v) {
    var a = Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.keys(v).map(function (k) { return v[k]; }) : []);
    return a.filter(function (x) { return x && x.id; });
  }
  function isDay(d) { return /^\d{4}-\d{2}-\d{2}$/.test(str(d)); }
  /* pu-gov-report-list.js coAtts 와 같은 차례(gov-consulting getCoAtts) */
  function coAtts(o) {
    if (!o) return [];
    if (Array.isArray(o.coAttIds)) return o.coAttIds.filter(Boolean);
    if (Array.isArray(o.defCoAtts)) return o.defCoAtts.filter(Boolean);
    if (o.coAttId) return [o.coAttId];
    if (o.defCoAtt) return [o.defCoAtt];
    return [];
  }
  function uniq(a) { var seen = {}; return a.filter(function (x) { if (!x || seen[x]) return false; seen[x] = 1; return true; }); }
  function order(t) { return (t.sortOrder != null && t.sortOrder !== '' && isFinite(+t.sortOrder)) ? +t.sortOrder : Infinity; }
  function byOrder(a, b) {
    var x = order(a), y = order(b);
    if (x !== y) return x < y ? -1 : 1;
    return str(a.name).localeCompare(str(b.name), 'ko');
  }

  function visibleTypes(biz) {
    return rowsOf(biz).filter(function (t) { return str(t.code) && str(t.name) && !t.hidden && !str(t.mergedInto); })
      .map(function (t) { return { code: str(t.code), name: str(t.name), short: str(t.short), agency: str(t.agency), sortOrder: order(t) }; })
      .sort(byOrder);
  }
  function groupByAgency(types) {
    var out = [], at = {};
    (types || []).slice().sort(byOrder).forEach(function (t) {
      var a = str(t.agency) || NO_AGENCY;
      if (!(a in at)) { at[a] = out.length; out.push({ agency: a, types: [] }); }
      out[at[a]].types.push(t);
    });
    return out;
  }
  function planFor(name) {
    var n = squash(name);
    if (!n) return NONE;
    for (var i = 0; i < DOC_PLANS.length; i++) {
      var p = DOC_PLANS[i];
      if (p.words.some(function (w) { return n.indexOf(w) >= 0; })) return p;
    }
    return NONE;
  }
  function linkOf(code, tmap, scalTypes) {
    var id = str(tmap && typeof tmap === 'object' ? tmap[code] : '');
    if (!id) return '';
    return list(scalTypes).some(function (t) { return t.id === id; }) ? id : '';
  }

  function pairs(input, typeId, year) {
    input = input || {};
    var t = list(input.types).filter(function (x) { return x.id === typeId; })[0];
    if (!t) return [];
    var names = {};
    list(input.staff).forEach(function (s) { names[s.id] = str(s.name); });
    var sc = list(input.scheds).filter(function (s) { return s.typeId === typeId && s.phase !== 'pre' && isDay(s.date); });
    var out = [];
    list(input.cos).forEach(function (co) {
      if (co.deleted || !(Array.isArray(co.types) && co.types.indexOf(typeId) >= 0)) return;
      var ds = sc.filter(function (s) { return s.coId === co.id; }).map(function (s) { return str(s.date); }).sort();
      if (!ds.length) return;
      var y = ds[0].slice(0, 4);
      if (year && y !== String(year)) return;
      var cr = co.customRounds && co.customRounds[typeId];
      var planned = (cr !== undefined && cr !== null && cr !== '') ? (+cr || 0) : (+t.rounds || 0);
      var attIds = uniq([str(co.defAtt)].concat(coAtts(co)));
      out.push({ coId: co.id, coName: str(co.name), co: co, typeId: typeId, typeName: str(t.fullName) || str(t.name),
        year: y, rid: String(typeId) + '_' + y, rounds: ds.length, planned: planned, firstDate: ds[0], lastDate: ds[ds.length - 1],
        attNames: attIds.map(function (id) { return names[id] || ''; }).filter(Boolean) });
    });
    return out.sort(function (a, b) { return a.coName.localeCompare(b.coName, 'ko'); });
  }

  function sidebarGroups(biz, tmap, input, year) {
    var linked = [], unlinked = [];
    visibleTypes(biz).forEach(function (t) {
      var p = planFor(t.name), id = linkOf(t.code, tmap, (input || {}).types);
      var item = { code: t.code, name: t.name, short: t.short, agency: t.agency, sortOrder: t.sortOrder,
        plan: p.key, kind: p.kind, typeId: id, count: id ? pairs(input, id, year).length : 0 };
      (id ? linked : unlinked).push(item);
    });
    var g = groupByAgency(linked);
    if (unlinked.length) g.push({ agency: UNLINKED, unlinked: true, types: unlinked });
    return g;
  }
  function erpTypeFor(typeId, biz, tmap) {
    if (!typeId || !tmap || typeof tmap !== 'object') return null;
    return visibleTypes(biz).filter(function (t) { return str(tmap[t.code]) === typeId; })[0] || null;
  }

  function coKey(s) { return str(s).replace(CORP_RE, '').replace(/[\s·,.\-_'"()（）]/g, '').toLowerCase(); }
  /* gov-consulting.html erpConsCode 와 같은 차례 — 코드 칸 → 사업 이름(이름·줄인 이름) */
  function enSquash(v) { return str(v).replace(/[\s()（）·,]/g, ''); }
  function consCode(c, biz) {
    c = c || {};
    var tc = c.typeCodes || {};
    var code = str(tc.consulting || tc.consult || c.typeCode);
    if (code) return code;
    var nm = enSquash(c.consultingType || c.programName || c.type);
    if (!nm) return '';
    var t = rowsOf(biz).filter(function (x) { return enSquash(x.name) === nm || enSquash(x.short) === nm; })[0];
    return t ? str(t.code) : ('name:' + nm);
  }
  /* 이 업체·이 사업의 이알피 계약 — 업체는 erpId → 사업자번호 → 이름, 사업은 코드 → 이음표. 여럿이면 늦게 시작한 것 */
  function consFor(o) {
    o = o || {};
    var co = o.co || {}, bn = digits(co.bizNo), ck = coKey(co.name), tm = o.tmap || {};
    var mine = rowsOf(o.consultings).filter(function (c) {
      if (c && c._deleted === true) return false;
      if (str(co.erpId) && str(c.id) === str(co.erpId)) return true;
      var cc = (c.company && typeof c.company === 'object') ? c.company : {};
      var cb = digits(cc.bizNo || c.bizNo);
      if (bn && cb) return bn === cb;
      return !!ck && coKey(cc.name || c.companyName) === ck;
    });
    var hit = mine.filter(function (c) { return !!o.code && consCode(c, o.biz) === o.code; });
    if (!hit.length) hit = mine.filter(function (c) { var k = consCode(c, o.biz); return !!k && !!o.typeId && str(tm[k]) === str(o.typeId); });
    hit.sort(function (a, b) { return str(b.startDate).localeCompare(str(a.startDate)); });
    return hit[0] || null;
  }
  function sidName(dir, sid) {
    var k = str(sid);
    if (!k) return '';
    var u = rowsOf(dir).filter(function (x) { return str(x.sid) === k || str(x.id) === k || str(x.empNo) === k; })[0];
    return u ? str(u.name || u.userName) : '';
  }
  function months(from, to) {
    var a = /^(\d{4})-(\d{2})/.exec(str(from)), b = /^(\d{4})-(\d{2})/.exec(str(to));
    if (!a || !b) return [];
    var y = +a[1], m = +a[2], end = (+b[1]) * 12 + (+b[2]), out = [];
    while (y * 12 + m <= end && out.length < 36) {
      out.push(y + '-' + (m < 10 ? '0' : '') + m);
      m++; if (m > 12) { m = 1; y++; }
    }
    return out;
  }
  /* 월별 서류의 달 — 계약 기간(startDate~endDate) → 없으면 회차 날짜(첫~마지막) → 없으면 [] */
  function monthsFor(cons, pair) {
    var s = str(cons && cons.startDate).slice(0, 10), e = str(cons && cons.endDate).slice(0, 10);
    var p = pair || {};
    return months(s || p.firstDate, e || p.lastDate);
  }
  function range(n) { var a = []; for (var i = 1; i <= n; i++) a.push(i + '회차'); return a; }

  var DASH = { txt: '—', key: '' };
  function chips(r) {
    var out = [DASH, DASH, DASH, DASH, DASH];
    if (!r || !r.st) return out;
    if (r.st.key === 'done') { out[0] = { txt: '✓', key: 'done' }; out[1] = { txt: r.st.label, key: 'done' }; }
    else out[0] = { txt: r.st.label, key: r.st.key };
    return out;
  }
  function docsTable(o) {
    o = o || {};
    var erp = o.erp || null, plan = planFor(erp ? erp.name : ''), auto = !!AUTO[plan.key], isBig = plan.kind === '대형';
    var byCo = {};
    (o.rows || []).forEach(function (r) { if (r && r.typeId === o.typeId) byCo[r.coId + '|' + r.year] = r; });
    var lines = o.typeId ? pairs(o.input, o.typeId, o.year).map(function (p) {
      var r = byCo[p.coId + '|' + p.year] || null;
      var cons = consFor({ consultings: o.consultings, co: p.co, code: erp ? erp.code : '', typeId: o.typeId, tmap: o.tmap, biz: o.biz });
      var cells = auto ? chips(r) : null;
      var bigRec = null, bn = 0, bms = [];
      if (isBig) {
        /* 대형 — 단계(항목)마다 칸. 기록을 못 받았으면(track 없음) 칩은 「—」, 다음 단계는 모른다 */
        bigRec = o.track ? Track.recOf(o.track, p.coId, p.rid) : null;
        bn = Math.max(+p.rounds || 0, +p.planned || 0);
        bms = monthsFor(cons, p);
        cells = Track.bigCells(plan, bigRec || {}, bn, bms, o.today).map(function (c) {
          return (bigRec || !c.chip) ? c : { id: c.id, name: c.name, step: c.step, chip: { txt: DASH.txt, key: DASH.key }, st: 'none' };
        });
      }
      /* 기록을 받았을 때만 ③④⑤ — 틀에 그 step 이 없으면 「—」(기술보호의 ③) */
      if (auto && cells && o.track) {
        var rec = Track.recOf(o.track, p.coId, p.rid), n = Math.max(+p.rounds || 0, +p.planned || 0);
        TRACK_COLS.forEach(function (s, i) { cells[2 + i] = Track.cellFor(plan, rec, s, n, o.today) || DASH; });
      }
      var line = { coId: p.coId, coName: p.coName, typeId: p.typeId, year: p.year, rid: p.rid, rounds: p.rounds, planned: p.planned,
        cells: cells, due: cons ? str(cons.endDate).slice(0, 10) : '' };
      if (isBig) line.next = bigRec ? Track.nextStage(plan, bigRec, bn, bms) : undefined;   // 간단형 줄에는 next 속성 자체가 없다
      return line;
    }) : [];
    var table = { plan: plan, auto: auto, cols: isBig ? plan.items.map(function (x) { return x.name; }) : COLS.slice(), lines: lines };
    if (isBig) table.big = true;   // 간단형·틀 없음 출력에는 big 속성이 없다
    return table;
  }

  function tocFor(o) {
    o = o || {};
    var p = o.pair || {}, erp = o.erp || null, cons = o.cons || null, r = o.row || null;
    var plan = planFor(erp ? erp.name : p.typeName), auto = !!AUTO[plan.key];
    var warn = [];
    if (!erp) warn.push('[확인 필요] 푸른이알피 사업 연결 없음');
    if (!cons) warn.push('[확인 필요] 푸른이알피 계약 못 찾음');
    var s = str(cons && cons.startDate).slice(0, 10), e = str(cons && cons.endDate).slice(0, 10);
    var period = (s || e) ? (s || '?') + ' ~ ' + (e || '?')
      : (p.firstDate ? p.firstDate + ' ~ ' + p.lastDate + ' (회차 날짜)' : '');
    var n = Math.max(+p.rounds || 0, +p.planned || 0);
    var check = plan.check ? '[확인 필요: ' + plan.check + ']' : '';
    var items = plan.items.map(function (x, i) {
      var subs = x.per === 'round' ? range(n) : (x.per === 'month' ? months(s || p.firstDate, e || p.lastDate) : []);
      var chip = (auto && x.step === 'report' && r && r.st && (!plan.chipItem || plan.chipItem === x.id)) ? { txt: r.st.label, key: r.st.key } : { txt: '—', key: '' };
      if (auto && o.rec && x.step !== 'report' && x.step !== 'plat') chip = Track.itemChip(x, o.rec, n, o.today) || chip;
      return { no: i + 1, id: x.id, name: x.name, per: x.per, step: x.step, subs: subs, chip: chip, check: check };
    });
    return { head: { coName: str(p.coName), bizName: erp ? erp.name : str(p.typeName), agency: erp ? (erp.agency || NO_AGENCY) : '',
        period: period, manager: sidName(o.dir, cons && cons.managerMain) || (p.attNames || []).join('·'), rounds: n,
        plan: plan.key, kind: plan.kind, warn: warn },
      items: items };
  }
  /* 「막힌 단계」 알림 — 현황판 줄(buildRows)이 아니라 일정 쌍(pairs)과 서류 진행 기록에서 직접 만든다(대형 사업은 줄이 없는 일이 많다).
     이알피 사업이 대형 틀로 이어지는 사업만 본다(간단형 기록은 무시). 기록을 못 받았으면(track 없음) []. 순수 함수 — 받은 값을 바꾸지 않는다.
     o = { input, year, track, biz, tmap, consultings } → [{ coId, typeId, coName, typeName, items:[{ name, note }] }] (업체 이름 → 사업 이름 차례) */
  function blockedAlerts(o) {
    o = o || {};
    if (!o.track || typeof o.track !== 'object') return [];
    var out = [];
    list((o.input || {}).types).forEach(function (t) {
      var erp = erpTypeFor(t.id, o.biz, o.tmap);
      if (!erp) return;
      var plan = planFor(erp.name);
      if (plan.kind !== '대형') return;
      pairs(o.input, t.id, o.year).forEach(function (p) {
        var cons = consFor({ consultings: o.consultings, co: p.co, code: erp.code, typeId: t.id, tmap: o.tmap, biz: o.biz });
        var n = Math.max(+p.rounds || 0, +p.planned || 0);
        var items = Track.blockedOf(plan, Track.recOf(o.track, p.coId, p.rid), n, monthsFor(cons, p));
        if (!items.length) return;
        out.push({ coId: p.coId, typeId: p.typeId, coName: p.coName, typeName: p.typeName,
          items: items.map(function (b) { return { name: str(b.name), note: str(b.note) }; }) });
      });
    });
    return out.map(function (e, i) { return { e: e, i: i }; }).sort(function (a, b) {
      return a.e.coName.localeCompare(b.e.coName, 'ko') || a.e.typeName.localeCompare(b.e.typeName, 'ko') || (a.i - b.i);
    }).map(function (x) { return x.e; });
  }
  /* 현황판 줄(buildRows)에 서류 진행 기록을 붙인다 — r.trk(③④⑤ 칸·기한·회신 날수)와 r.st.steps 의 ③④ 막대.
     (화면의 「막힌 단계」 알림은 이 줄이 아니라 blockedAlerts — 줄은 양식이 있는 사업에만 생긴다)
     간단형 셋(AUTO)과 대형 틀(r.trk.big — 막힌 단계·다음 단계, 막대 ③④ 는 끔). 기록이 없으면(못 읽음) r.trk = null, 막대 ③④ 는 끈다. 여러 번 불러도 같다 */
  function trackRows(rows, o) {
    o = o || {};
    var cos = {}, pairMemo = {};
    list((o.input || {}).cos).forEach(function (c) { cos[c.id] = c; });
    /* 현황판 줄(buildRows)에는 첫 회차 날짜가 없다 — 월별 서류의 달은 pairs(같은 조건)의 첫·마지막 회차 날짜에서 읽는다 */
    function pairOf(r) {
      var k = r.typeId + '|' + r.year;
      if (!pairMemo[k]) pairMemo[k] = pairs(o.input, r.typeId, r.year);
      return pairMemo[k].filter(function (p) { return p.coId === r.coId && p.rid === r.rid; })[0] || null;
    }
    (rows || []).forEach(function (r) {
      if (!r) return;
      var s = (r.st && r.st.steps) || [false, false, false, false];
      r.trk = null;
      if (r.st) r.st.steps = [!!s[0], !!s[1], false, false];
      if (!o.track || !r.st) return;
      var erp = erpTypeFor(r.typeId, o.biz, o.tmap), plan = planFor(erp ? erp.name : r.typeName);
      if (plan.kind === '대형') {
        var bcons = consFor({ consultings: o.consultings, co: cos[r.coId] || { id: r.coId, name: r.coName }, code: erp ? erp.code : '', typeId: r.typeId, tmap: o.tmap, biz: o.biz });
        var bn = Math.max(+r.rounds || 0, +r.maxRounds || 0), bms = monthsFor(bcons, pairOf(r)), brec = Track.recOf(o.track, r.coId, r.rid);
        r.trk = { due: bcons ? str(bcons.endDate).slice(0, 10) : '', sign: null, submit: null, waitDays: null, bar3: false, bar4: false, big: true,
          next: Track.nextStage(plan, brec, bn, bms), blocked: Track.blockedOf(plan, brec, bn, bms) };
        r.st.steps = [!!s[0], !!s[1], false, false];
        return;
      }
      if (!AUTO[plan.key]) return;
      var cons = consFor({ consultings: o.consultings, co: cos[r.coId] || { id: r.coId, name: r.coName }, code: erp ? erp.code : '',
        typeId: r.typeId, tmap: o.tmap, biz: o.biz });
      r.trk = Track.rowTrack(plan, Track.recOf(o.track, r.coId, r.rid), Math.max(+r.rounds || 0, +r.maxRounds || 0),
        cons ? str(cons.endDate).slice(0, 10) : '', o.today);
      r.st.steps = [!!s[0], !!s[1], r.trk.bar3, r.trk.bar4];
    });
    return rows;
  }
  function tocText(toc) {
    toc = toc || {};
    var h = toc.head || {}, items = toc.items || [];
    var out = ['목차 — ' + str(h.coName),
      '사업: ' + str(h.bizName) + (h.agency ? ' (' + h.agency + ')' : '') + ' · ' + (KIND_KO[h.kind] || NO_PLAN),
      '계약 기간: ' + (h.period || '—') + ' · 담당: ' + (h.manager || '—') + ' · 회차 ' + (h.rounds || 0)];
    (h.warn || []).forEach(function (w) { out.push(w); });
    if (!items.length) out.push(NO_PLAN + ' — 목차는 머리말만');
    items.forEach(function (x) {
      out.push(x.no + '. ' + x.name + ' (' + x.chip.txt + ')' + (x.check ? ' ' + x.check : ''));
      x.subs.forEach(function (s) { out.push('   - ' + s); });
    });
    return out.join('\n');
  }

  var api = { rowsOf: rowsOf, visibleTypes: visibleTypes, groupByAgency: groupByAgency, planFor: planFor, linkOf: linkOf,
    pairs: pairs, sidebarGroups: sidebarGroups, erpTypeFor: erpTypeFor, coKey: coKey, consCode: consCode, consFor: consFor,
    sidName: sidName, months: months, monthsFor: monthsFor, docsTable: docsTable, tocFor: tocFor, tocText: tocText, trackRows: trackRows, blockedAlerts: blockedAlerts,
    DOC_PLANS: DOC_PLANS, NONE: NONE, AUTO: AUTO, KIND_KO: KIND_KO, COLS: COLS,
    NO_AGENCY: NO_AGENCY, UNLINKED: UNLINKED, NO_PLAN: NO_PLAN, TRACK_COLS: TRACK_COLS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuGovReportDocs = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
