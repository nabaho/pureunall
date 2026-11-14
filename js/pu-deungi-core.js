/* pu-deungi-core.js — 푸른등기: 노무법인 변경등기(사원·대표사원·분사무소) 계산과 서류 내용 (2026-11-14)
   대표 지시 2026-11-14 「매번 푸른노무법인 노무사 변경될 때마다 등기를 새로 해야 한다 … 등기에서 변경되는 사람 정보만
   입력하면 모든 서류가 자동으로 한글파일로 정리되어서 나오게 하고 … 관련 필요서류 등도 체크할 수 있게」 · 「내부관리에 넣어라」
   ■ 순수 함수 — 화면·저장·네트워크 없음. 화면(pu-deungi.html)과 한글 서류(js/pu-deungi-docs.js)가 «같은 파일»을 쓴다.
     등기할 사항·정관 조문·필요서류가 두 벌이 되면 한쪽만 고쳐진다.
   ■ 근거 자료(저장소 밖 — 공개 저장소라 사람 정보는 여기에 적지 않는다):
     · 등기사항전부증명서(현재 유효사항) — «임원에 관한 사항»에 사원·출자·대표사원(주소)·분사무소가 등기된다
     · 지난 변경 서류: 2017 지분양수·대표사원 변경 총사원 동의서 / 2019 서산 분사무소 설치 / 2024 사원 입사·분사무소 이전 회의록
     · 법무사 «임원변경 등기신청 시 필요서류» 안내(2025-02-14 메일) — 필요서류 확인표의 «법무사» 줄이 이것이다
   ⚠ 주민등록번호 «뒷자리»는 저장하지 않는다 — 생년월일(앞 여섯 자리)만 저장하고, 뒷자리는 서류를 만드는 순간에만
     화면에서 받아 문서에 넣는다(rrnMap). 받지 않으면 손으로 적을 빈칸으로 둔다.
   ⚠ 법령 기한·서식 근거는 담당 법무사·노무사가 최종 확인한다 — 화면과 서류에 «확인 필요»를 숨기지 않는다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DeungiCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ── 변경 종류 — 화면의 «+ 추가» 단추와 등기할 사항이 이 표 하나를 따른다 ── */
  var TYPES = {
    join:    { label: '사원 입사',      short: '입사',     icon: '➕', group: 'member' },
    leave:   { label: '사원 퇴사',      short: '퇴사',     icon: '➖', group: 'member' },
    repIn:   { label: '대표사원 취임',  short: '대표 취임', icon: '⭐', group: 'rep' },
    repOut:  { label: '대표사원 사임',  short: '대표 사임', icon: '☆', group: 'rep' },
    addr:    { label: '사원 주소 변경', short: '주소변경', icon: '🏠', group: 'member' },
    brAdd:   { label: '분사무소 설치',  short: '분사무소 설치', icon: '🏢', group: 'branch' },
    brMove:  { label: '분사무소 이전',  short: '분사무소 이전', icon: '🚚', group: 'branch' },
    brClose: { label: '분사무소 폐지',  short: '분사무소 폐지', icon: '✖', group: 'branch' }
  };
  /* 처리 차례 — 입사를 먼저 해야 같은 건에서 «퇴사 사원 지분을 새 사원이 양수»를 잇는다 */
  var ORDER = ['join', 'leave', 'repIn', 'repOut', 'addr', 'brAdd', 'brMove', 'brClose'];
  var STATUS = { draft: '준비 중', meeting: '총회·날인', approval: '인가 신청', filed: '등기 신청', done: '등기 완료', cancelled: '취소' };
  var STATUS_ORDER = ['draft', 'meeting', 'approval', 'filed', 'done', 'cancelled'];

  /* 등기기간(일) — 2026-11-14 현행 원문 확인(국회법률정보시스템 — 국가법령정보센터는 그날 점검 중이었다):
       · 공인노무사법 시행령 제19조의6①: 분사무소 설치·이전, 등기사항 변경등기는 상법 제181조~제183조 준용,
         인가가 필요한 사항은 «인가증을 받은 날부터» 등기기간을 센다. ②: 등기신청서에 인가증을 붙인다.
       · 상법 제181조~제183조(2024. 9. 20. 전문개정, 2025. 1. 31. 시행): 본점 소재지에서 2주일 내 — 지점 소재지 등기는 없어졌다.
     ⚠ 과태료(상법 제635조)가 노무법인 사원에게 그대로 미치는지는 확인하지 못했다 — 금액을 화면에 쓰지 않는다. */
  var DEADLINE_DAYS = 14;
  var DEADLINE_NOTE = '주사무소(본점) 소재지에서 2주일 내 — 정관변경 인가가 필요한 사항은 인가증을 받은 날부터(공인노무사법 시행령 제19조의6, 상법 제183조). 분사무소 소재지 등기는 2025. 1. 31.부터 없음. 늦어질 때의 제재는 법무사 확인';
  /* 사원 요건 — 공인노무사법 제7조의3①(사원은 2명 이상의 개업노무사) · 제7조의6제1호(부족해진 날부터 3개월 안에 보충하지 않으면 인가 취소)
     · 제7조의7③(주사무소·분사무소마다 공인노무사인 사원 1명 이상 상근) */
  var LAW = {
    charter: '「공인노무사법」 제7조의4제2항',
    apply: '「공인노무사법 시행령」 제19조의3제1항 및 같은 법 시행규칙 제10조의4',
    members: '공인노무사법 제7조의3제1항 — 사원은 2명 이상의 개업노무사(부족해진 날부터 3개월 안에 보충하지 않으면 인가 취소, 제7조의6제1호)',
    office: '공인노무사법 제7조의7제3항 — 주사무소·분사무소마다 공인노무사인 사원 1명 이상 상근',
    notary: '공증인법 제66조의2 — 법인 등기에 붙이는 총회 의사록은 공증인 인증(정관변경이 따르는 분사무소 변경은 경미사항 예외가 아님)',
    fees: '등록면허세: 그 밖의 등기·분사무소 설치 건당 40,200원(지방세법 제28조제1항제6호, 대도시 분사무소 설치는 중과) + 지방교육세 20% · 등기신청수수료: 등기 목적마다 7,000원(전자신청 2,000원) — 건수·합계는 법무사 청구서로 확인'
  };

  /* ── 작은 도구 ── */
  /* ★ 주민등록번호 뒷자리 지우개 — 저장되는 «모든 글 칸»이 str·text 를 거치므로 여기 한 곳에서 지운다
     (보안 검토 2026-11-14: 메모·필요서류 메모·정관 본문에 붙여 넣은 번호가 그대로 남을 수 있었다).
     앞 6자리 + (하이픈·대시·공백 있거나 없이) 성별 자리 1~8 + 6자리 → «앞자리-_______».
     법인등록번호(161571-0000304)처럼 뒷자리가 0 으로 시작하는 것은 건드리지 않는다. */
  var RRN_RE = /(^|[^0-9])(\d{6})\s*[-–]?\s*[1-8]\d{6}(?![0-9])/g;
  function scrubRrn(s) { return String(s).replace(RRN_RE, '$1$2-_______'); }
  function str(v) { return v == null ? '' : scrubRrn(String(v).replace(/\s+/g, ' ').trim()); }
  function text(v) { return v == null ? '' : scrubRrn(String(v).replace(/\r\n?/g, '\n')); }
  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v) : 0;
    var s = String(v == null ? '' : v).replace(/[^0-9-]/g, '');
    var n = parseInt(s, 10); return isFinite(n) ? n : 0;
  }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function arr(v) {
    if (Array.isArray(v)) return v.filter(function (x) { return x != null; });
    if (v && typeof v === 'object') return Object.keys(v).sort(function (a, b) { return Number(a) - Number(b); }).map(function (k) { return v[k]; }).filter(function (x) { return x != null; });
    return [];
  }
  function won(n) { var x = num(n); return x.toLocaleString ? x.toLocaleString('ko-KR') : String(x); }
  function isDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
    var d = new Date(s + 'T00:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }
  function addDays(iso, n) {
    if (!isDate(iso)) return '';
    var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
  }
  function addMonths(iso, n) {
    if (!isDate(iso)) return '';
    var p = iso.split('-').map(Number), y = p[0], m = p[1] - 1 + n, day = p[2];
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(day, last))).toISOString().slice(0, 10);
  }
  function diffDays(a, b) { /* b − a (일) */
    if (!isDate(a) || !isDate(b)) return null;
    return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  }
  function todayIso(now) {
    var d = now ? new Date(now) : new Date();
    var k = new Date(d.getTime() + 9 * 3600000); /* 한국 시각 */
    return k.toISOString().slice(0, 10);
  }
  function koDate(iso) { if (!isDate(iso)) return '        년     월     일'; var p = iso.split('-').map(Number); return p[0] + '년 ' + p[1] + '월 ' + p[2] + '일'; }
  function dotDate(iso) { if (!isDate(iso)) return '    .    .    .'; var p = iso.split('-'); return p[0] + '. ' + p[1] + '. ' + p[2] + '.'; }
  function regDate(iso) { if (!isDate(iso)) return '    년    월    일'; var p = iso.split('-'); return p[0] + '년 ' + p[1] + '월 ' + p[2] + '일'; }
  function timeKo(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ''));
    if (!m) return '';
    var h = Number(m[1]), mi = Number(m[2]);
    return (h < 12 ? '오전 ' : '오후 ') + (h % 12 === 0 ? 12 : h % 12) + '시' + (mi ? ' ' + mi + '분' : '');
  }
  function birthOk(b) { return /^\d{6}$/.test(String(b || '')); }
  function backOk(b) { return /^[1-8]\d{6}$/.test(String(b || '')); }
  /* 주민등록번호 보이기 — mode 'mask'(등기부처럼 *******), 그 밖은 뒷자리가 있으면 전부, 없으면 손으로 적을 빈칸 */
  function rrn(m, rrnMap, mode) {
    var b = birthOk(m && m.birth) ? m.birth : '      ';
    if (mode === 'mask') return b + '-*******';
    var back = rrnMap && m && rrnMap[m.id];
    return b + '-' + (backOk(back) ? back : '_______');
  }
  function newId(prefix, now) {
    var t = (now || Date.now()).toString(36);
    var r = Math.floor(Math.random() * 1679616).toString(36);
    return (prefix || 'x') + t + r;
  }
  function particle(word, a, b) { /* 받침 따라 이/가·을/를·은/는 */
    var s = String(word || ''); var c = s.charCodeAt(s.length - 1);
    if (c < 0xAC00 || c > 0xD7A3) return s + a;
    return s + (((c - 0xAC00) % 28) ? a : b);
  }

  /* ── 출자 ── invest = { cash: 원, labor: 노무출자 여부 } */
  function normInvest(v) {
    v = v || {};
    if (v.kind) return { cash: v.kind === 'cash' ? num(v.amount) : 0, labor: v.kind === 'labor' };
    return { cash: Math.max(0, num(v.cash)), labor: v.labor === true };
  }
  function investText(iv, style) { /* style 'reg' = 등기부 말투, 'charter' = 정관 말투 */
    iv = normInvest(iv);
    var parts = [];
    if (iv.cash > 0) parts.push(style === 'reg' ? '금 ' + won(iv.cash) + '원 전부이행' : '현금 ' + won(iv.cash) + '원');
    if (iv.labor) parts.push('노무출자');
    return parts.join(style === 'reg' ? ', ' : ' 및 ') || (style === 'reg' ? '출자 없음' : '출자 없음');
  }

  /* ── 기준(현재 등기 현황) ── */
  function emptyBase() {
    return { id: 'base', entityType: 'DeungiBase', asOf: '', source: '',
      firm: { name: '푸른 노무법인', regNo: '', corpNo: '', hq: '', hqCharter: '', court: '', authority: '', approvalNo: '', phone: '' },
      members: [], branches: [], charter: '' };
  }
  function normMember(m, i) {
    m = m || {};
    return { id: str(m.id) || ('m' + (i + 1)), name: str(m.name), birth: String(m.birth || '').replace(/[^0-9]/g, '').slice(0, 6),
      addr: str(m.addr), invest: normInvest(m.invest), rep: m.rep === true, joinDate: isDate(m.joinDate) ? m.joinDate : '',
      repDate: isDate(m.repDate) ? m.repDate : '', licenseNo: str(m.licenseNo).slice(0, 20), note: str(m.note) };
  }
  function normBranch(b, i) {
    b = b || {};
    var name = str(b.name);
    return { id: str(b.id) || ('b' + (i + 1)), name: name, alias: str(b.alias) || name.replace(/분사무소$/, '지사'),
      addr: str(b.addr), charterAddr: str(b.charterAddr), since: isDate(b.since) ? b.since : '',
      no: Math.max(1, num(b.no) || (i + 1)) };
  }
  function normBase(raw) {
    var e = emptyBase(), b = raw || {}, bf = b.firm || {};
    /* 법인 칸은 «정해 둔 칸만» 받는다 — 불러온 파일의 모르는 칸이 그대로 저장되지 않게(보안 검토 2026-11-14) */
    var firm = {};
    Object.keys(e.firm).forEach(function (k) { firm[k] = str(bf[k]).slice(0, 200); });
    if (!firm.name) firm.name = e.firm.name;
    return { id: 'base', entityType: 'DeungiBase', asOf: isDate(b.asOf) ? b.asOf : '', source: str(b.source).slice(0, 300), firm: firm,
      members: arr(b.members).slice(0, 100).map(normMember), branches: arr(b.branches).slice(0, 50).map(normBranch), charter: text(b.charter).slice(0, 60000),
      history: arr(b.history).slice(-30).map(function (h) { h = h || {}; return { at: isDate(h.at) ? h.at : '', caseId: str(h.caseId).slice(0, 60), title: str(h.title).slice(0, 120), summary: str(h.summary).slice(0, 400) }; }) };
  }
  function baseProblems(base) {
    var b = normBase(base), out = [];
    if (!b.members.length) out.push('사원이 한 명도 없습니다 — «등기 현황»에서 지금 등기부의 사원을 먼저 넣으십시오.');
    b.members.forEach(function (m) {
      if (!m.name) out.push('이름이 빈 사원이 있습니다.');
      else if (!birthOk(m.birth)) out.push(m.name + ' — 생년월일(주민등록번호 앞 6자리)이 없습니다.');
    });
    if (b.members.length && !b.members.some(function (m) { return m.rep; })) out.push('대표사원이 표시된 사원이 없습니다.');
    if (!b.firm.hq) out.push('주사무소 소재지가 비어 있습니다.');
    if (!b.firm.court) out.push('관할 등기소가 비어 있습니다.');
    return out;
  }

  /* ── 등기 건 ── */
  function normChange(ch) {
    ch = ch || {};
    var t = TYPES[ch.type] ? ch.type : '';
    var o = { id: str(ch.id) || newId('c'), type: t, date: isDate(ch.date) ? ch.date : '' };
    if (t === 'join') {
      o.name = str(ch.name); o.birth = String(ch.birth || '').replace(/[^0-9]/g, '').slice(0, 6); o.addr = str(ch.addr);
      o.invest = normInvest(ch.invest); o.rep = ch.rep === true; o.license = str(ch.license);
    } else if (t === 'leave') {
      o.member = str(ch.member); o.reason = str(ch.reason) || '개인 사정';
      var sh = ch.share || {};
      o.share = { mode: ['transfer', 'refund', 'none'].indexOf(sh.mode) >= 0 ? sh.mode : 'transfer',
        to: arr(sh.to).map(function (x) { return { member: str(x && x.member), amount: num(x && x.amount) }; }).filter(function (x) { return x.member; }) };
    } else if (t === 'repIn' || t === 'repOut') {
      o.member = str(ch.member);
    } else if (t === 'addr') {
      o.member = str(ch.member); o.addr = str(ch.addr);
    } else if (t === 'brAdd') {
      o.name = str(ch.name); o.alias = str(ch.alias); o.addr = str(ch.addr); o.charterAddr = str(ch.charterAddr);
    } else if (t === 'brMove') {
      o.branch = str(ch.branch); o.addr = str(ch.addr); o.charterAddr = str(ch.charterAddr);
    } else if (t === 'brClose') {
      o.branch = str(ch.branch);
    }
    return o;
  }
  function normCase(raw) {
    var c = raw || {};
    var m = c.meeting || {}, d = c.dates || {}, ag = c.agent || {};
    var dates = {};
    ['notice', 'notarize', 'approvalApply', 'approvalGet', 'file', 'done'].forEach(function (k) { dates[k] = isDate(d[k]) ? d[k] : ''; });
    var checks = {};
    Object.keys(c.checks || {}).forEach(function (k) {
      var x = c.checks[k] || {};
      checks[k] = { ok: x.ok === true, issued: isDate(x.issued) ? x.issued : '', note: str(x.note).slice(0, 200) };
    });
    var docsOff = {};
    Object.keys(c.docsOff || {}).forEach(function (k) { if (c.docsOff[k] === true) docsOff[k] = true; });
    return {
      id: str(c.id), entityType: 'DeungiCase', title: str(c.title) || '변경등기',
      status: STATUS[c.status] ? c.status : 'draft',
      meeting: { date: isDate(m.date) ? m.date : '', time: /^\d{1,2}:\d{2}$/.test(String(m.time || '')) ? m.time : '10:00',
        endTime: /^\d{1,2}:\d{2}$/.test(String(m.endTime || '')) ? m.endTime : '', place: str(m.place) || '푸른노무법인 본 사무소',
        chair: str(m.chair), kind: m.kind === 'regular' ? 'regular' : 'temp' },
      effDate: isDate(c.effDate) ? c.effDate : '',
      changes: arr(c.changes).map(normChange).filter(function (x) { return x.type; }),
      agent: { name: str(ag.name), office: str(ag.office), phone: str(ag.phone), addr: str(ag.addr) },
      notary: str(c.notary), dates: dates, checks: checks, docsOff: docsOff,
      cost: num(c.cost), memo: text(c.memo).slice(0, 4000), applied: c.applied === true,
      baseSnap: c.applied === true && c.baseSnap ? normBase(c.baseSnap) : null,
      _deleted: c._deleted === true
    };
  }
  function meetingDate(c) { return c.meeting.date || c.effDate || ''; }
  function changeDate(c, ch) { return ch.date || c.effDate || c.meeting.date || ''; }

  /* ── 변경 반영 — 기준 + 등기 건 → 변경 뒤 모습 ──
     돌려주는 것: members(남는 사원) · left(퇴사) · branches(남는 분사무소) · closed · events(등기할 사항의 재료)
                · errors(서류를 만들면 안 되는 것) · warnings(확인할 것) · charterChanged · arts(바뀐 정관 조문 번호) */
  function applyChanges(base, cs) {
    var b = normBase(base), c = normCase(cs);
    var errors = [], warnings = [], events = [];
    var members = b.members.map(function (m) { var x = clone(m); x.before = { addr: m.addr, invest: clone(m.invest), rep: m.rep }; x.acq = []; return x; });
    var byId = {}; members.forEach(function (m) { byId[m.id] = m; });
    var branches = b.branches.map(function (x) { var y = clone(x); y.before = { addr: x.addr, charterAddr: x.charterAddr }; return y; });
    var brById = {}; branches.forEach(function (x) { brById[x.id] = x; });
    var arts = {};
    var seen = {};
    /* 이 건에서 퇴사하는 사원 — 그 사람을 다른 퇴사자의 양수인으로 고르면 출자금이 사라지거나 부푼다(기능 검증 2026-11-14) */
    var leaving = {};
    c.changes.forEach(function (ch) { if (ch.type === 'leave' && ch.member) leaving[ch.member] = true; });
    function live(id, what) {
      var m = byId[id];
      if (!m) { errors.push(what + ' — 사원을 고르십시오.'); return null; }
      if (m.gone) { errors.push(what + ' — ' + m.name + '은(는) 이미 이 건에서 퇴사합니다.'); return null; }
      return m;
    }
    ORDER.forEach(function (type) {
      c.changes.filter(function (ch) { return ch.type === type; }).forEach(function (ch) {
        var d = changeDate(c, ch), lab = TYPES[type].label;
        if (!d) warnings.push(lab + ' — 변경 연월일이 비어 있어 총회일로도 정할 수 없습니다.');
        if (type === 'join') {
          if (!ch.name) errors.push('사원 입사 — 이름을 넣으십시오.');
          if (!birthOk(ch.birth)) errors.push('사원 입사' + (ch.name ? '(' + ch.name + ')' : '') + ' — 생년월일 6자리를 넣으십시오.');
          if (!ch.addr) errors.push('사원 입사' + (ch.name ? '(' + ch.name + ')' : '') + ' — 주소를 넣으십시오.');
          if (members.some(function (m) { return m.name && m.name === ch.name && !m.gone; })) warnings.push('사원 입사 — 같은 이름(' + ch.name + ')의 사원이 이미 있습니다. 다른 사람인지 확인하십시오.');
          var nm = { id: 'new:' + ch.id, name: ch.name, birth: ch.birth, addr: ch.addr, invest: clone(ch.invest), rep: false, joinDate: d,
            repDate: '', isNew: true, before: null, acq: [], licenseNo: ch.license, change: ch.id };
          members.push(nm); byId[nm.id] = nm;
          events.push({ type: 'join', member: nm.id, date: d, change: ch.id });
          arts[5] = arts[6] = true;
          if (ch.rep) { nm.rep = true; nm.repDate = d; events.push({ type: 'repIn', member: nm.id, date: d, change: ch.id, auto: true }); }
        } else if (type === 'leave') {
          var lm = live(ch.member, '사원 퇴사'); if (!lm) return;
          if (seen['leave:' + lm.id]) { errors.push('사원 퇴사 — ' + lm.name + '이(가) 두 번 들어 있습니다.'); return; }
          seen['leave:' + lm.id] = 1;
          lm.gone = true; lm.leaveDate = d; lm.leaveReason = ch.reason;
          var iv = normInvest(lm.invest);
          var tos = [];
          if (iv.cash > 0 && ch.share.mode === 'transfer') {
            if (!ch.share.to.length) errors.push('사원 퇴사(' + lm.name + ') — 지분 금 ' + won(iv.cash) + '원을 넘겨받을 사원(양수인)을 고르십시오.');
            var sum = 0, took = {};
            ch.share.to.forEach(function (t) {
              var r = byId[t.member];
              if (!r) { errors.push('사원 퇴사(' + lm.name + ') — 양수인을 찾을 수 없습니다.'); return; }
              if (r.id === lm.id) { errors.push('사원 퇴사(' + lm.name + ') — 자기 자신에게 양도할 수 없습니다.'); return; }
              if (leaving[r.id]) { errors.push('사원 퇴사(' + lm.name + ') — ' + r.name + '은(는) 이 건에서 함께 퇴사하므로 양수인이 될 수 없습니다.'); return; }
              if (took[r.id]) { errors.push('사원 퇴사(' + lm.name + ') — 양수인 ' + r.name + '이(가) 두 줄 들어 있습니다. 금액을 한 줄로 합치십시오.'); return; }
              took[r.id] = true;
              if (t.amount <= 0) { errors.push('사원 퇴사(' + lm.name + ') — ' + r.name + '에게 넘길 금액을 넣으십시오.'); return; }
              sum += t.amount;
              r.invest = normInvest(r.invest); r.invest.cash += t.amount;
              r.acq.push({ from: lm.id, fromName: lm.name, amount: t.amount, date: d });
              tos.push({ member: r.id, name: r.name, amount: t.amount });
            });
            if (sum && sum !== iv.cash) errors.push('사원 퇴사(' + lm.name + ') — 양도 금액 합계 ' + won(sum) + '원이 출자금 ' + won(iv.cash) + '원과 다릅니다.');
          } else if (iv.cash > 0 && ch.share.mode === 'none') {
            warnings.push('사원 퇴사(' + lm.name + ') — 현금 출자 ' + won(iv.cash) + '원의 처리(양도 또는 환급)를 정하십시오.');
          }
          lm.leaveShare = { mode: iv.cash > 0 ? ch.share.mode : 'none', to: tos, cash: iv.cash, labor: iv.labor };
          events.push({ type: 'leave', member: lm.id, date: d, change: ch.id });
          if (lm.rep) { lm.rep = false; events.push({ type: 'repOut', member: lm.id, date: d, change: ch.id, auto: true, byLeave: true }); }
          arts[5] = arts[6] = true;
        } else if (type === 'repIn') {
          var rm = live(ch.member, '대표사원 취임'); if (!rm) return;
          if (rm.rep) { warnings.push('대표사원 취임 — ' + rm.name + '은(는) 이미 대표사원입니다.'); return; }
          rm.rep = true; rm.repDate = d;
          events.push({ type: 'repIn', member: rm.id, date: d, change: ch.id });
        } else if (type === 'repOut') {
          var om = live(ch.member, '대표사원 사임'); if (!om) return;
          if (!om.rep) { warnings.push('대표사원 사임 — ' + om.name + '은(는) 대표사원이 아닙니다.'); return; }
          om.rep = false;
          events.push({ type: 'repOut', member: om.id, date: d, change: ch.id });
        } else if (type === 'addr') {
          var am = live(ch.member, '사원 주소 변경'); if (!am) return;
          if (!ch.addr) { errors.push('사원 주소 변경(' + am.name + ') — 새 주소를 넣으십시오.'); return; }
          if (ch.addr === am.addr) { warnings.push('사원 주소 변경(' + am.name + ') — 새 주소가 지금 주소와 같습니다.'); return; }
          am.addr = ch.addr; am.addrDate = d;
          events.push({ type: 'addr', member: am.id, date: d, change: ch.id });
          arts[5] = true;
        } else if (type === 'brAdd') {
          if (!ch.name) errors.push('분사무소 설치 — 명칭(예: 세종분사무소)을 넣으십시오.');
          if (!ch.addr) errors.push('분사무소 설치' + (ch.name ? '(' + ch.name + ')' : '') + ' — 소재지를 넣으십시오.');
          var maxNo = branches.reduce(function (a, x) { return Math.max(a, x.no || 0); }, 0);
          var nb = { id: 'new:' + ch.id, name: ch.name, alias: ch.alias || ch.name.replace(/분사무소$/, '지사'), addr: ch.addr,
            charterAddr: ch.charterAddr, since: d, no: maxNo + 1, isNew: true, before: null };
          branches.push(nb); brById[nb.id] = nb;
          events.push({ type: 'brAdd', branch: nb.id, date: d, change: ch.id });
          arts[3] = true;
        } else if (type === 'brMove' || type === 'brClose') {
          var br = brById[ch.branch];
          if (!br) { errors.push(TYPES[type].label + ' — 분사무소를 고르십시오.'); return; }
          if (br.gone) { errors.push(TYPES[type].label + ' — ' + br.name + '은(는) 이미 이 건에서 폐지합니다.'); return; }
          if (type === 'brMove') {
            if (!ch.addr) { errors.push('분사무소 이전(' + br.name + ') — 새 소재지를 넣으십시오.'); return; }
            br.addr = ch.addr; br.charterAddr = ch.charterAddr || ''; br.moved = d;
          } else { br.gone = true; br.closeDate = d; }
          events.push({ type: type, branch: br.id, date: d, change: ch.id });
          arts[3] = true;
        }
      });
    });
    var cur = members.filter(function (m) { return !m.gone; });
    /* 출자 없는 신입 — 퇴사 사원 지분을 양수했으면 위에서 현금이 붙었다. 그래도 비면 묻는다 */
    cur.forEach(function (m) {
      var iv = normInvest(m.invest);
      if (m.isNew && !iv.cash && !iv.labor) warnings.push('사원 입사(' + (m.name || '이름 없음') + ') — 출자(현금 또는 노무출자)가 정해지지 않았습니다. 다른 사원 지분을 양수하면 퇴사 쪽에서 양수인으로 고르십시오.');
    });
    if (c.changes.length && !cur.some(function (m) { return m.rep; })) errors.push('변경 뒤 대표사원이 한 명도 남지 않습니다 — 대표사원 취임을 함께 넣으십시오.');
    if (cur.length < 2) warnings.push('변경 뒤 사원이 ' + cur.length + '명입니다 — ' + LAW.members + '.');
    var offices = 1 + branches.filter(function (x) { return !x.gone; }).length;
    if (cur.length && cur.length < offices) warnings.push('변경 뒤 사원 ' + cur.length + '명, 사무소 ' + offices + '곳(주사무소 포함)입니다 — ' + LAW.office + '.');
    /* 출자금이 바뀐 기존 사원 — 지분 양수 */
    cur.forEach(function (m) {
      if (!m.isNew && m.acq.length) { events.push({ type: 'share', member: m.id, date: m.acq[0].date }); arts[6] = true; }
    });
    var artList = Object.keys(arts).map(Number).sort(function (a, z) { return a - z; });
    return {
      base: b, c: c, members: cur, all: members, left: members.filter(function (m) { return m.gone; }),
      branches: branches.filter(function (x) { return !x.gone; }), allBranches: branches, closed: branches.filter(function (x) { return x.gone; }),
      events: events, errors: uniq(errors), warnings: uniq(warnings), charterChanged: artList.length > 0, arts: artList,
      repChanged: events.some(function (e) { return e.type === 'repIn' || e.type === 'repOut' || (e.type === 'addr' && (byId[e.member] || {}).rep); }),
      byId: byId, brById: brById
    };
  }
  function uniq(a) { var s = {}; return a.filter(function (x) { if (s[x]) return false; s[x] = 1; return true; }); }

  /* 변경 하나를 한 줄로 — 목록·의사록 요약에 쓴다 */
  function describe(ch, base, after) {
    var b = normBase(base), byId = (after && after.byId) || {};
    b.members.forEach(function (m) { if (!byId[m.id]) byId[m.id] = m; });
    var brs = (after && after.brById) || {}; b.branches.forEach(function (x) { if (!brs[x.id]) brs[x.id] = x; });
    var nm = function (id) { return (byId[id] && byId[id].name) || '(사원 미선택)'; };
    var bn = function (id) { return (brs[id] && brs[id].name) || '(분사무소 미선택)'; };
    switch (ch.type) {
      case 'join': {
        /* 퇴사 사원 지분을 양수하면 출자가 «뒤에서» 붙는다 — 반영된 모습(after)이 있으면 그것으로 보인다 */
        var nm2 = after && after.byId && after.byId['new:' + ch.id];
        return (ch.name || '(이름 없음)') + ' 입사 — ' + investText(nm2 ? nm2.invest : ch.invest, 'charter') + (ch.rep ? ' · 대표사원 취임' : '');
      }
      case 'leave': return nm(ch.member) + ' 퇴사' + (ch.share && ch.share.mode === 'transfer' && ch.share.to.length ? ' — 지분 ' + ch.share.to.map(function (t) { return nm(t.member) + ' ' + won(t.amount) + '원'; }).join(', ') + ' 양도' : ch.share && ch.share.mode === 'refund' ? ' — 지분 환급' : '');
      case 'repIn': return nm(ch.member) + ' 대표사원 취임';
      case 'repOut': return nm(ch.member) + ' 대표사원 사임';
      case 'addr': return nm(ch.member) + ' 주소 변경 → ' + (ch.addr || '(새 주소 없음)');
      case 'brAdd': return (ch.name || '(명칭 없음)') + ' 설치 — ' + (ch.addr || '(소재지 없음)');
      case 'brMove': return bn(ch.branch) + ' 이전 → ' + (ch.addr || '(새 소재지 없음)');
      case 'brClose': return bn(ch.branch) + ' 폐지';
      default: return '';
    }
  }

  /* ── 등기의 목적·사유·등기할 사항 ── */
  function purpose(after) {
    var t = {}, out = [];
    after.events.forEach(function (e) { t[e.type] = true; });
    if (t.join) out.push('사원 입사');
    if (t.leave) out.push('사원 퇴사');
    if (t.share) out.push('사원 출자 변경');
    if (t.repIn) out.push('대표사원 취임');
    if (t.repOut) out.push('대표사원 ' + (after.events.some(function (e) { return e.type === 'repOut' && !e.byLeave; }) ? '사임' : '퇴임'));
    if (t.addr && after.events.some(function (e) { return e.type === 'addr' && (after.byId[e.member] || {}).rep; })) out.push('대표사원 주소 변경');
    if (t.brAdd) out.push('분사무소 설치');
    if (t.brMove) out.push('분사무소 이전');
    if (t.brClose) out.push('분사무소 폐지');
    return out.length ? out.join(', ') + ' 등기' : '';
  }
  /* 의안 요약 — «사원 홍길동 입사, 사원 김철수 퇴사 및 분사무소 설치» */
  function summary(after) {
    var parts = [];
    after.events.forEach(function (e) {
      var m = after.byId[e.member] || {}, br = after.brById[e.branch] || {};
      if (e.type === 'join') parts.push('사원 ' + m.name + ' 입사');
      else if (e.type === 'leave') parts.push('사원 ' + m.name + ' 퇴사');
      else if (e.type === 'repIn' && !e.auto) parts.push(m.name + ' 대표사원 취임');
      else if (e.type === 'repIn' && e.auto) parts.push(m.name + ' 대표사원 취임');
      else if (e.type === 'repOut' && !e.byLeave) parts.push(m.name + ' 대표사원 사임');
      else if (e.type === 'addr') parts.push('사원 ' + m.name + ' 주소 변경');
      else if (e.type === 'brAdd') parts.push(br.name + ' 설치');
      else if (e.type === 'brMove') parts.push(br.name + ' 이전');
      else if (e.type === 'brClose') parts.push(br.name + ' 폐지');
    });
    parts = uniq(parts);
    if (parts.length <= 1) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' 및 ' + parts[parts.length - 1];
  }
  function reason(after) {
    var c = after.c, d = meetingDate(c);
    var s = (d ? koDate(d) + ' ' : '') + '임시사원총회(총사원 동의)의 결의로 ' + summary(after) + '하기로 함';
    if (after.charterChanged) s += c.dates.approvalGet ? ('. ' + koDate(c.dates.approvalGet) + ' 고용노동부 정관변경 인가를 받음') : '. 정관변경 인가(고용노동부)를 받음';
    return s + '.';
  }
  /* 등기할 사항 — 등기부 «임원에 관한 사항»·«분사무소에 관한 사항» 말투 그대로.
     rrnMap 을 주면 주민등록번호 전부(신청서·위임 서류), 안 주면 등기부처럼 가린다. */
  function regItems(after, rrnMap) {
    var out = [];
    var mode = rrnMap ? 'full' : 'mask';
    after.events.forEach(function (e) {
      var m = after.byId[e.member], br = after.brById[e.branch], d = regDate(e.date);
      if (e.type === 'join') {
        var acq = m.acq.length ? m.acq.map(function (a) {
          var lv = after.byId[a.from], part = lv && lv.leaveShare && a.amount < lv.leaveShare.cash;
          return a.fromName + ' 지분 ' + (part ? '일부' : '') + '양수';
        }).join(', ') + ' ' : '';
        out.push({ group: '사원', lines: ['사원 ' + m.name + ' ' + rrn(m, rrnMap, mode), investText(m.invest, 'reg'), d + ' ' + acq + '입사'] });
      } else if (e.type === 'leave') {
        out.push({ group: '사원', lines: ['사원 ' + m.name + ' ' + rrn(m, rrnMap, mode), d + ' 퇴사'] });
      } else if (e.type === 'share') {
        out.push({ group: '사원', lines: ['사원 ' + m.name + ' ' + rrn(m, rrnMap, mode), investText(m.invest, 'reg'),
          d + ' ' + m.acq.map(function (a) { return a.fromName; }).join(', ') + ' 지분 양수(출자 금 ' + won(normInvest(m.before.invest).cash) + '원 → 금 ' + won(normInvest(m.invest).cash) + '원)'] });
      } else if (e.type === 'repIn') {
        out.push({ group: '대표사원', lines: ['대표사원 ' + m.name + ' ' + rrn(m, rrnMap, mode) + ' ' + m.addr, d + ' 취임'] });
      } else if (e.type === 'repOut') {
        out.push({ group: '대표사원', lines: ['대표사원 ' + m.name + ' ' + rrn(m, rrnMap, mode), d + ' ' + (e.byLeave ? '퇴임' : '사임')] });
      } else if (e.type === 'addr') {
        if (m.rep && !after.events.some(function (x) { return x.type === 'repIn' && x.member === m.id; })) {
          out.push({ group: '대표사원', lines: ['대표사원 ' + m.name + ' ' + rrn(m, rrnMap, mode) + ' ' + m.addr, d + ' 주소변경'] });
        }
      } else if (e.type === 'brAdd') {
        out.push({ group: '분사무소', lines: [br.addr + '(' + br.name + ')', d + ' 설치'] });
      } else if (e.type === 'brMove') {
        out.push({ group: '분사무소', lines: [br.addr + '(' + br.name + ')', d + ' 이전'] });
      } else if (e.type === 'brClose') {
        out.push({ group: '분사무소', lines: [br.addr + '(' + br.name + ')', d + ' 폐지'] });
      }
    });
    /* 등기부 차례대로 — 사원 → 대표사원 → 분사무소 (같은 무리 안은 들어온 차례) */
    var rank = { '사원': 0, '대표사원': 1, '분사무소': 2 };
    return out.map(function (x, i) { return { x: x, i: i }; })
      .sort(function (p, q) { return (rank[p.x.group] - rank[q.x.group]) || (p.i - q.i); })
      .map(function (p) { return p.x; });
  }

  /* ── 정관 조문(제3조·제5조·제6조) ── */
  var ART_TITLE = { 3: '제3조【사무소의 소재지】', 5: '제5조【사원의 성명과 주소】', 6: '제6조【출자의 목적, 가격 및 이행】' };
  var ART_NOTE = {
    3: '분사무소 설치·이전·폐지에 따라 분사무소의 명칭 및 소재지를 변경함',
    5: '사원 입사·퇴사·주소변경에 따라 사원의 성명과 주소를 변경함',
    6: '사원 변경(입사·퇴사·지분 양수)에 따라 출자의 목적, 가격 및 이행을 변경함'
  };
  function art3(firm, branches) {
    var lines = [ART_TITLE[3], '① 회사의 주사무소는 ' + (firm.hqCharter || firm.hq || '          ') + '에 둔다.', '② 분사무소의 명칭 및 소재지는 아래와 같다.'];
    var byNo = {}, max = 0;
    branches.forEach(function (x) { if (!x.gone) { byNo[x.no] = x; max = Math.max(max, x.no); } });
    branches.forEach(function (x) { max = Math.max(max, x.no || 0); });
    for (var i = 1; i <= max; i++) {
      var x = byNo[i];
      lines.push(x ? (i + '. ' + particle(x.alias || x.name, '은', '는') + ' ' + (x.charterAddr || x.addr) + '에 둔다.') : (i + '. - 삭 제 -'));
    }
    if (!max) lines.push('(분사무소 없음)');
    return lines;
  }
  function art5(members, rrnMap) {
    var lines = [ART_TITLE[5], '회사 사원의 성명과 주소는 다음과 같다.'];
    members.forEach(function (m, i) {
      lines.push((i + 1) + '. 사원 : ' + m.name + '(' + rrn(m, rrnMap) + ')');
      lines.push('   주소 : ' + m.addr);
    });
    return lines;
  }
  function art6(members, rrnMap) {
    var lines = [ART_TITLE[6], '제2조에 게기한 목적사업을 위한 각 사원의 출자액과 이행할 내역은 다음과 같다.'];
    members.forEach(function (m, i) {
      lines.push((i + 1) + '. 사원 : ' + m.name + '(' + rrn(m, rrnMap) + ') ' + investText(m.invest, 'charter'));
    });
    return lines;
  }
  function articles(after, rrnMap) {
    var b = after.base;
    var oldBr = b.branches, newBr = after.allBranches;
    var oldM = b.members, newM = after.members;
    return {
      3: { old: art3(b.firm, oldBr), neu: art3(b.firm, newBr) },
      5: { old: art5(oldM, rrnMap), neu: art5(newM, rrnMap) },
      6: { old: art6(oldM, rrnMap), neu: art6(newM, rrnMap) }
    };
  }
  /* 신·구조문 대비 — 실제로 글이 달라진 조문만 */
  function compareRows(after, rrnMap) {
    var a = articles(after, rrnMap), out = [];
    [3, 5, 6].forEach(function (n) {
      if (a[n].old.join('\n') === a[n].neu.join('\n')) return;
      out.push({ no: n, title: ART_TITLE[n], old: a[n].old.slice(1), neu: a[n].neu.slice(1), note: ART_NOTE[n] });
    });
    return out;
  }
  /* 정관 전문 — 기준에 넣어 둔 정관 본문에서 제3·5·6조만 갈아 끼우고 개정 연혁 한 줄을 더한다 */
  var HEAD_RE = /^\s*(제\s*\d+\s*조|제\s*\d+\s*장|부\s*칙|보\s*칙)/;
  function charterFull(charterText, after, rrnMap, revDate) {
    var src = text(charterText);
    if (!src.trim()) return { text: '', replaced: [], missing: [3, 5, 6] };
    var lines = src.split('\n'), a = articles(after, rrnMap), replaced = [], missing = [];
    [3, 5, 6].forEach(function (n) {
      var re = new RegExp('^\\s*제\\s*' + n + '\\s*조(?!의)');
      var s = -1;
      for (var i = 0; i < lines.length; i++) { if (re.test(lines[i])) { s = i; break; } }
      if (s < 0) { missing.push(n); return; }
      var e = lines.length;
      for (var j = s + 1; j < lines.length; j++) { if (HEAD_RE.test(lines[j])) { e = j; break; } }
      while (e > s + 1 && !lines[e - 1].trim()) e--;
      var block = a[n].neu.slice();
      block[0] = lines[s].replace(/^(\s*제\s*\d+\s*조\s*【[^】]*】|\s*제\s*\d+\s*조\s*\([^)]*\)|\s*제\s*\d+\s*조).*$/, '$1').trim() || block[0];
      lines.splice.apply(lines, [s, e - s].concat(block));
      replaced.push(n);
    });
    if (revDate && isDate(revDate)) {
      var rev = '(' + dotDate(revDate).replace(/\.$/, '.') + ' 개정)';
      var last = -1;
      for (var k = 0; k < lines.length && k < 40; k++) { if (/\(\s*\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}\s*\.\s*(제정|개정)\s*\)/.test(lines[k])) last = k; }
      if (last >= 0 && lines.join('\n').indexOf(rev) < 0) lines.splice(last + 1, 0, rev);
    }
    return { text: lines.join('\n'), replaced: replaced, missing: missing };
  }

  /* ── 만들 서류 ── */
  var DOCS = [
    { key: 'minutes',   title: '임시사원총회 의사록',            when: 'always' },
    { key: 'consent',   title: '총사원 동의서',                  when: 'always' },
    { key: 'compare',   title: '정관 변경 신·구조문 대비표',     when: 'charter' },
    { key: 'reason',    title: '정관변경 이유서',                when: 'charter' },
    { key: 'apply',     title: '노무법인 정관 변경인가 신청서',  when: 'charter' },
    { key: 'charter',   title: '변경 정관',                      when: 'charter' },
    { key: 'roster',    title: '사원(출자자) 명부',              when: 'always' },
    { key: 'accept',    title: '취임승낙서',                     when: 'repIn' },
    { key: 'resign',    title: '대표사원 사임서',                when: 'repOut' },
    { key: 'leaveNote', title: '퇴사원(사원 퇴사 신청서)',       when: 'leave' },
    { key: 'transfer',  title: '지분 양도·양수 계약서',          when: 'transfer' },
    { key: 'poa',       title: '위임장(등기신청 대리)',          when: 'always' },
    { key: 'notaryPoa', title: '위임장(의사록 공증 촉탁)',       when: 'always' },
    { key: 'request',   title: '변경등기 신청서(법무사 확인용 초안)', when: 'always' },
    { key: 'delay',     title: '변경등기 지연 사유서',           when: 'late' },
    { key: 'checklist', title: '필요서류 확인표',                when: 'always' }
  ];
  function docPlan(after, opts) {
    opts = opts || {};
    var ev = {}; after.events.forEach(function (e) { ev[e.type] = (ev[e.type] || 0) + 1; });
    var transfer = after.left.some(function (m) { return m.leaveShare && m.leaveShare.mode === 'transfer' && m.leaveShare.to.length; });
    var dl = deadline(after, opts.today);
    var late = !!(dl && dl.overdue);
    return DOCS.map(function (d) {
      var need = d.when === 'always' || (d.when === 'charter' && after.charterChanged) ||
        (d.when === 'repIn' && ev.repIn) || (d.when === 'repOut' && after.events.some(function (e) { return e.type === 'repOut' && !e.byLeave; })) ||
        (d.when === 'leave' && ev.leave) || (d.when === 'transfer' && transfer) || (d.when === 'late' && late);
      var count = d.key === 'accept' ? (ev.repIn || 0) : d.key === 'leaveNote' ? (ev.leave || 0) :
        d.key === 'resign' ? after.events.filter(function (e) { return e.type === 'repOut' && !e.byLeave; }).length :
        d.key === 'transfer' ? after.left.filter(function (m) { return m.leaveShare && m.leaveShare.mode === 'transfer' && m.leaveShare.to.length; }).length : 1;
      return { key: d.key, title: d.title, need: !!need, count: need ? count : 0, on: !!need && !after.c.docsOff[d.key] };
    });
  }

  /* ── 기한 ── */
  function deadline(after, today) {
    var c = after.c, t = today || todayIso();
    var basis, from;
    if (after.charterChanged) { from = c.dates.approvalGet; basis = '정관변경 인가증 수령일'; }
    else { from = c.effDate || c.meeting.date; basis = '변경 연월일(총회일)'; }
    if (!isDate(from)) return { from: '', due: '', basis: basis, left: null, overdue: false, filed: !!c.dates.file, note: DEADLINE_NOTE };
    var due = addDays(from, DEADLINE_DAYS);
    var filedOn = c.dates.file;
    var ref = filedOn || t;
    var left = diffDays(ref, due);
    return { from: from, due: due, basis: basis, left: left, overdue: left != null && left < 0, filed: !!filedOn, note: DEADLINE_NOTE };
  }

  /* ── 필요서류 확인표 ──
     src: '법무사' — 법무사 «임원변경 등기신청 시 필요서류»(2025-02-14 메일) 그대로
          '서류'   — 이 앱이 만드는 서류(날인 필요)
          '지난 서류' — 지난 변경등기 때 실제로 낸 것(2011·2019 신청서 첨부서면)
          '확인 필요' — 실무상 점검 — 담당 법무사·노무사와 확인 */
  function checklist(after) {
    var c = after.c, b = after.base, out = [];
    function add(group, key, label, detail, src, months) { out.push({ group: group, key: key, label: label, detail: detail || '', src: src, months: months || 0 }); }
    var attendees = b.members;
    var nAll = attendees.length;
    var needN = Math.ceil(nAll / (after.charterChanged ? 3 : 4));
    add('법인', 'corpSeal', '법인인감도장', '등기신청서·위임장·의사록 날인', '법무사');
    add('법인', 'corpCert', '법인인감증명서 2통', '발급일로부터 3개월 이내', '법무사', 3);
    add('법인', 'charterCopy', '정관 사본(원본대조필) 1통', after.charterChanged ? '변경 정관(인가받은 것)' : '현행 정관', '법무사');
    add('법인', 'roster', '사원명부 1통', '이 앱 «사원(출자자) 명부» — 대표사원 날인', '법무사');
    if (after.charterChanged) add('법인', 'approvalCert', '인허가 증명서 — 정관변경 인가증 사본', '고용노동부(' + (b.firm.authority || '관할 지방고용노동관서') + ') 발급', '법무사');
    add('법인', 'regCert', '등기사항전부증명서(변경 전)', '지금 등기 내용 대조용', '확인 필요', 3);
    add('사원 전원', 'memberSeals', '사원 인감도장 — ' + attendees.map(function (m) { return m.name; }).join(', '), '의사록·총사원 동의서·공증용 위임장 날인', '법무사');
    add('사원 전원', 'memberCerts', '사원 인감증명서 각 2통(공증용·법원제출용)', '법무사 안내: 사원 1/4 이상(정관변경이 수반되면 1/3 이상) — 지금 ' + nAll + '명 중 최소 ' + needN + '명 · 발급 3개월 이내', '법무사', 3);
    after.events.forEach(function (e) {
      var m = after.byId[e.member] || {};
      if (e.type === 'leave') {
        add('퇴사·사임 사원', 'leaveCert:' + m.id, m.name + ' 인감증명서 2통(공증용·법원제출용)', '법무사 안내(사임 임원) · 발급 3개월 이내', '법무사', 3);
        add('퇴사·사임 사원', 'leaveSeal:' + m.id, m.name + ' 인감도장', '퇴사원·총사원 동의서 날인', '법무사');
        add('퇴사·사임 사원', 'leaveNote:' + m.id, m.name + ' 퇴사원(사원 퇴사 신청서)', '이 앱 서류 — 서명·날인', '서류');
        if (m.leaveShare && m.leaveShare.mode === 'transfer' && m.leaveShare.to.length) add('퇴사·사임 사원', 'transfer:' + m.id, m.name + ' 지분 양도·양수 계약서', '양도인·양수인 날인 — 양도 대금은 당사자 합의로 채움', '서류');
      } else if (e.type === 'repOut' && !e.byLeave) {
        add('퇴사·사임 사원', 'resignCert:' + m.id, m.name + ' 인감증명서 2통(공증용·법원제출용)', '법무사 안내(사임 임원) · 발급 3개월 이내', '법무사', 3);
        add('퇴사·사임 사원', 'resign:' + m.id, m.name + ' 대표사원 사임서', '이 앱 서류 — 인감 날인', '서류');
      } else if (e.type === 'join') {
        add('신입 사원', 'newCert:' + m.id, m.name + ' 인감증명서 2통(공증용·법원제출용)', '발급 3개월 이내 — 통수는 법무사와 확인', '지난 서류', 3);
        add('신입 사원', 'newSeal:' + m.id, m.name + ' 인감도장', '총사원 동의서 날인', '지난 서류');
        add('신입 사원', 'newResident:' + m.id, m.name + ' 주민등록표 초본(또는 등본) 1통', '2011년 사원 추가 변경등기 첨부서면 기준', '지난 서류', 3);
        add('신입 사원', 'newLicense:' + m.id, m.name + ' 공인노무사 자격·직무개시 등록 확인', '정관 제19조(개업자격을 지닌 노무사)', '확인 필요');
      } else if (e.type === 'repIn') {
        add('대표사원 취임', 'accept:' + m.id, m.name + ' 취임승낙서', '이 앱 서류 — 인감 날인', '서류');
        if (!m.isNew) add('대표사원 취임', 'repCert:' + m.id, m.name + ' 인감증명서', '취임승낙서 인감 확인용 · 발급 3개월 이내', '확인 필요', 3);
      } else if (e.type === 'brAdd' || e.type === 'brMove') {
        var br = after.brById[e.branch] || {};
        add('분사무소', 'lease:' + (br.id || e.change), (br.name || '분사무소') + ' 임대차계약서 사본', '2019년 서산 분사무소 설치 때 준비한 것', '지난 서류');
      }
    });
    if (after.events.some(function (e) { return e.type === 'repIn' || (e.type === 'repOut'); })) {
      add('대표사원 취임', 'corpSealWho', '법인인감 신고 명의(대표사원) 바꿀지', '대표사원이 바뀌면 법인인감을 다시 신고할지 법무사와 확인', '확인 필요');
    }
    add('공증', 'notary', '의사록(총사원 동의서) 인증 — 공증사무소', '공증용 위임장 · 사원 인감증명서 · 법인인감증명서 지참 · ' + LAW.notary, '법무사');
    if (after.charterChanged) {
      add('정관변경 인가', 'applyDocs', '정관변경 인가 신청', '신청서(시행규칙 별지 제26호서식) · 정관 변경 이유서 · 정관 변경안(신·구조문 대비표·변경 정관) · 사원총회 회의록 사본 → ' + (b.firm.authority || '관할 지방고용노동관서') + ' (공인노무사법 시행령 제19조의3제1항)', '서류');
      add('정관변경 인가', 'approvalGet', '정관변경 인가증 받음', '받은 날을 «진행 일정»에 적으면 등기 기한(받은 날부터 2주일)이 계산됩니다 · 등기신청서에 인가증을 붙인다(시행령 제19조의6제2항)', '서류');
    }
    add('등기 신청', 'filing', '변경등기 신청 — ' + (b.firm.court || '관할 등기소'), DEADLINE_NOTE, '확인 필요');
    add('등기 신청', 'jointFiling', '신청인(대표사원·사원 전원) 확인', '공인노무사법 시행령 제19조의5제3항 «노무법인의 등기는 사원 전원이 공동으로 신청» — 변경등기에도 그대로인지 법무사 확인', '확인 필요');
    add('등기 신청', 'fees', '등록면허세·지방교육세·등기신청수수료 납부', LAW.fees, '확인 필요');
    add('등기 후', 'regCheck', '바뀐 등기사항전부증명서 발급·대조', '등기할 사항이 그대로 올랐는지', '확인 필요');
    if (after.repChanged) add('등기 후', 'bizReg', '사업자등록 정정(대표자·주소 변경 시)', '관할 세무서 — 2017년 대표사원 변경 때 정정신청서를 냈다', '지난 서류');
    add('등기 후', 'notify', '공인노무사회·은행·거래처 등 변경 안내', '필요한 곳만 — 담당자 확인', '확인 필요');
    return out;
  }
  /* 3개월 이내 서류 — 신청일(없으면 오늘) 기준으로 지났는지 */
  function staleCheck(item, check, after, today) {
    if (!item.months || !check || !check.issued) return null;
    var ref = after.c.dates.file || today || todayIso();
    var lim = addMonths(check.issued, item.months);
    if (!lim) return null;
    var left = diffDays(ref, lim);
    return { limit: lim, left: left, stale: left != null && left < 0 };
  }
  function checkProgress(after, today) {
    var items = checklist(after), c = after.c;
    var done = 0, stale = 0;
    items.forEach(function (it) {
      var ck = c.checks[it.key];
      if (ck && ck.ok) done++;
      var s = staleCheck(it, ck, after, today);
      if (s && s.stale) stale++;
    });
    return { total: items.length, done: done, stale: stale };
  }

  /* ── 등기 완료 → 기준에 반영할 모습 ── 새 사원·분사무소에는 영구 id 를 준다(new: 접두를 벗긴다) */
  function nextBase(after, opts) {
    opts = opts || {};
    var b = after.base, c = after.c;
    var used = {};
    b.members.forEach(function (m) { used[m.id] = 1; }); b.branches.forEach(function (x) { used[x.id] = 1; });
    function fresh(prefix) { var i = 1; while (used[prefix + i]) i++; used[prefix + i] = 1; return prefix + i; }
    var members = after.members.map(function (m) {
      return { id: m.isNew ? fresh('m') : m.id, name: m.name, birth: m.birth, addr: m.addr, invest: normInvest(m.invest), rep: !!m.rep,
        joinDate: m.joinDate || '', repDate: m.repDate || '', licenseNo: m.licenseNo || '', note: m.note || '' };
    });
    var branches = after.branches.map(function (x) {
      return { id: x.isNew ? fresh('b') : x.id, name: x.name, alias: x.alias, addr: x.addr, charterAddr: x.charterAddr || '', since: x.since || '', no: x.no };
    });
    var done = c.dates.done || opts.today || todayIso();
    var hist = (b.history || []).concat([{ at: done, caseId: c.id, title: c.title, summary: summary(after) }]).slice(-30);
    var charter = b.charter ? charterFull(b.charter, Object.assign({}, after, { members: after.members }), null, c.dates.approvalGet || meetingDate(c)).text : '';
    /* ⚠ 정관 본문에 주민번호 뒷자리를 넣지 않는다 — rrnMap 없이 만들면 «앞자리-_______» 로 남는다 */
    return { id: 'base', entityType: 'DeungiBase', asOf: done, source: '등기 완료 반영 — ' + c.title,
      firm: Object.assign({}, b.firm), members: members, branches: branches, charter: charter, history: hist };
  }

  /* ── 진행 단계 — 무엇을 할 차례인가 ── */
  function nextStep(after, today) {
    var c = after.c, d = c.dates;
    if (after.errors.length) return '입력 확인 — 빨간 글을 먼저 고치십시오';
    if (!c.changes.length) return '변경 내용 넣기';
    if (!c.meeting.date) return '총회일 정하기';
    if (!d.notarize) return '서류 받기 → 사원 날인 → 의사록 공증';
    if (after.charterChanged && !d.approvalApply) return '정관변경 인가 신청';
    if (after.charterChanged && !d.approvalGet) return '정관변경 인가증 기다리기';
    if (!d.file) { var dl = deadline(after, today); return '등기 신청' + (dl && dl.due ? ' (기한 ' + dl.due + ')' : ''); }
    if (!d.done) return '등기 완료 확인';
    if (!c.applied) return '등기 현황에 반영';
    return '끝';
  }

  return {
    TYPES: TYPES, ORDER: ORDER, STATUS: STATUS, STATUS_ORDER: STATUS_ORDER, DOCS: DOCS, ART_TITLE: ART_TITLE,
    DEADLINE_DAYS: DEADLINE_DAYS, DEADLINE_NOTE: DEADLINE_NOTE, LAW: LAW,
    str: str, num: num, won: won, isDate: isDate, addDays: addDays, addMonths: addMonths, diffDays: diffDays, todayIso: todayIso,
    koDate: koDate, dotDate: dotDate, regDate: regDate, timeKo: timeKo, birthOk: birthOk, backOk: backOk, rrn: rrn, newId: newId, particle: particle,
    normInvest: normInvest, investText: investText, emptyBase: emptyBase, normBase: normBase, baseProblems: baseProblems,
    normChange: normChange, normCase: normCase, meetingDate: meetingDate, changeDate: changeDate,
    applyChanges: applyChanges, describe: describe, purpose: purpose, summary: summary, reason: reason, regItems: regItems,
    articles: articles, compareRows: compareRows, charterFull: charterFull,
    docPlan: docPlan, deadline: deadline, checklist: checklist, staleCheck: staleCheck, checkProgress: checkProgress,
    nextBase: nextBase, nextStep: nextStep
  };
});
