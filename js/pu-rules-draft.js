/* 질문으로 바로 작성 — 고용노동부 표준취업규칙(2026)을 «답»으로 채우고 골라 한 권을 짓는다 (순수 함수 · 화면·Firebase 없음)
   대표 지시 2026-10-07 「대한민국에서 … 취업규칙시스템 모두 검토하고 … 완벽히 자동화가 되고 있는 프로그램이 있으면
   이를 벤치마킹하고 유사하게 변경 사용가능하게 해라」.

   ■ 벤치마킹한 것 — 인사관리 소프트웨어의 「3초 취업규칙」(회사 정보·근무형태를 고르면 바로 한 권),
     인사노무 앱의 「취업규칙 자동 작성」, 매개변수로 위법 문안을 «처음부터 못 쓰게» 하는 방식.
   ■ 우리 것과 다른 점 — 그들은 «만들고 끝»이다. 여기서는 만든 한 권을 곧바로 92항목 검토에 넣는다
     (rules.html takeDraft) — 만들자마자 법 개정·시행예정까지 짚는다.

   ■ 지키는 것
     ① 바탕은 표준 원문 그대로 — 답이 닿는 빈칸(○○·ㅇ·00)만 채운다. 문장을 새로 짓지 않는다.
     ② 안 쓰는 선택 조(교대·탄력·선택·간주·재량·하기휴가·상여금, 수습 0개월)는 «빼고» 번호를 다시 매긴다 —
        본문 속 «이 규칙의» 조 인용도 새 번호로 바꾼다. 법령 인용(「근로기준법」 제93조 · 동법 시행령 제14조)은 안 건드린다.
     ③ 표준의 갈래 문안(<상시 30명 이하…> · <참고: 퇴직금 제도를 운영하는 경우>)은 답으로 하나만 남긴다.
     ④ 위법이 되는 답은 받지 않는다 — 정년 60세 미만 · 8시간 근로에 휴게 1시간 미만 · 1일 8시간이 아닌 시각.
     ⑤ 못 채운 빈칸은 숨기지 않는다 — leftovers 로 돌려준다(화면이 「직접 채울 곳」으로 보인다). */
(function (global) {
  'use strict';

  var DAYS = ['월', '화', '수', '목', '금', '토', '일'];
  var DEFAULTS = {
    company: '', term: '사원', size: 10,
    probation: 3,                    // 개월 · 0 이면 수습 조를 뺀다
    leaveYears: 1, extendDays: 7,    // 휴직 기간 · 연장 승인 통보
    weekStart: '월',                // 1주의 첫날 · 근무일은 월~금, 무급휴무일은 토, 주휴일은 일(제32조①)
    start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00',
    shift: '', shiftScope: '',       // 교대 — 비면 교대 조를 뺀다 (예: 3조2교대)
    flex: { elastic: false, select: false, deemed: false, discretion: false },
    founding: '',                    // 창립기념일 「3월 2일」 — 비면 그 낱말을 뺀다
    summer: '',                      // 하기휴가 「7월 1일~8월 31일」 — 비면 조를 뺀다
    allowances: '',                  // 고정 수당 「직책수당, 자격수당」
    payDay: 25,
    bonus: false,                    // 상여금 — 없으면 조를 뺀다(있으면 비율은 직접 채운다)
    retireAge: 60,
    retirement: 'pension',           // pension(퇴직연금) · severance(퇴직금)
    effective: ''                    // 시행일 YYYY-MM-DD
  };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(s) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim()); return m ? (+m[1]) * 60 + (+m[2]) : NaN; }
  function toHm(n) { return pad2(Math.floor(n / 60)) + ':' + pad2(n % 60); }
  function merge(a) {
    var o = {}, k;
    for (k in DEFAULTS) o[k] = DEFAULTS[k];
    a = a || {};
    for (k in a) if (a[k] !== undefined && a[k] !== null) o[k] = a[k];
    var f = {}, d = DEFAULTS.flex, af = a.flex || {};
    for (k in d) f[k] = !!af[k];
    o.flex = f;
    return o;
  }

  /* 답을 먼저 거른다 — 위법이 되는 답은 «안 받는다»(④) */
  function validate(answers) {
    var a = merge(answers), why = [];
    if (!String(a.company || '').trim()) why.push('회사 이름을 적으세요');
    if (!(Number(a.size) >= 1)) why.push('상시 근로자 수를 적으세요');
    if (!(Number(a.retireAge) >= 60)) why.push('정년은 60세 이상이어야 합니다 (고령자고용법 제19조)');
    var s = toMin(a.start), e = toMin(a.end), bs = toMin(a.breakStart), be = toMin(a.breakEnd);
    if ([s, e, bs, be].some(isNaN)) why.push('시각은 09:00 꼴로 적으세요');
    else {
      if (!(bs >= s && be <= e && be > bs)) why.push('휴게시간이 근로시간 안에 있어야 합니다');
      if (be - bs < 60) why.push('8시간 근로에는 휴게 1시간 이상이 필요합니다 (근로기준법 제54조)');
      if (e - s - (be - bs) !== 480) why.push('시업~종업에서 휴게를 뺀 시간이 8시간이 아닙니다 (지금 ' + ((e - s - (be - bs)) / 60) + '시간)');
    }
    if (!(Number(a.payDay) >= 1 && Number(a.payDay) <= 31)) why.push('임금 지급일은 1~31일 사이로 적으세요');
    if (!(Number(a.probation) >= 0 && Number(a.probation) <= 12)) why.push('수습기간은 0~12개월로 적으세요');
    if (DAYS.indexOf(a.weekStart) < 0) why.push('1주의 첫날 요일을 고르세요');
    if (a.summer && !/^\s*\d{1,2}월\s*\d{1,2}일\s*~\s*\d{1,2}월\s*\d{1,2}일\s*$/.test(a.summer)) why.push('하기휴가는 「7월 1일~8월 31일」 꼴로 적으세요');
    if (a.founding && !/^\s*\d{1,2}월\s*\d{1,2}일\s*$/.test(a.founding)) why.push('창립기념일은 「3월 2일」 꼴로 적으세요');
    if (a.effective && !/^\d{4}-\d{2}-\d{2}$/.test(a.effective)) why.push('시행일은 2026-11-01 꼴로 적으세요');
    if (['pension', 'severance'].indexOf(a.retirement) < 0) why.push('퇴직급여 제도를 고르세요');
    return { ok: why.length === 0, why: why };
  }

  /* ③ 퇴직급여 갈래 — 표준의 <…> 문안을 답으로 하나만 남긴다 */
  function pickRetirement(L, a) {
    var i61 = L.findIndex(function (l) { return /^제61조\(퇴직급여제도의 설정\)/.test(l); });
    var i63 = L.findIndex(function (l) { return /^제63조\(/.test(l); });
    if (i61 < 0 || i63 < i61) throw new Error('표준 문안의 퇴직급여 자리를 못 찾았습니다');
    var R = L.slice(i61, i63);
    function at(re) { var k = R.findIndex(function (l) { return re.test(l); }); if (k < 0) throw new Error('표준 문안이 예상과 다릅니다: ' + re); return k; }
    var small = Number(a.size) <= 30, out;
    if (a.retirement === 'severance') {
      var r61 = at(/^제61조\s*\(퇴직급여제도의 설정\)\s*① 회사는 계속근로기간이 1년 미만/);
      out = [R[r61].replace(/^제61조\s*\(/, '제61조('), R[r61 + 1], R[at(/^제62조\(중간정산\)/)]];
    } else {
      var d1 = at(/^제61조\(퇴직급여제도의 설정\) ① /);
      var s1 = at(/^① 회사는 퇴직하는 사원에게 퇴직급여를 .*중소기업퇴직연금기금제도 중/);
      var c2 = at(/^② 회사는 제1항에도 불구하고/);
      var d3 = at(/^③ 확정급여형퇴직연금제도, 확정기여형퇴직연금제도의 가입대상/);
      var s3 = at(/^③ 확정급여형퇴직연금제도, 확정기여형퇴직연금제도, 중소기업퇴직연금기금제도의 가입대상/);
      var d62 = at(/^제62조\(중도인출\) ① /);
      var s62 = at(/^① 확정기여형퇴직연금제도에 가입한 사원은 .*제23조의13/);
      var c62 = at(/^② 회사는 퇴직연금의 중도인출을/);
      out = small
        ? ['제61조(퇴직급여제도의 설정) ' + R[s1], R[c2], R[s3], R[s3 + 1], R[s3 + 2], '제62조(중도인출) ' + R[s62], R[c62]]
        : [R[d1], R[c2], R[d3], R[d62], R[c62]];
    }
    return L.slice(0, i61).concat(out, L.slice(i63));
  }

  /* 본칙을 조 단위로 — 장·절 머리는 따로 둔다 */
  function units(lines) {
    var u = [], cur = null;
    lines.forEach(function (l) {
      var m = /^제(\d+)조(?:의(\d+))?\(([^)]*)\)/.exec(l);
      if (m) { cur = { art: true, num: +m[1], title: m[3], lines: [l] }; u.push(cur); return; }
      if (/^제\s*\d+\s*[장절]/.test(l) || !cur) { cur = null; u.push({ art: false, lines: [l] }); return; }
      cur.lines.push(l);
    });
    return u;
  }
  function setLine(art, re, fn) {
    var hit = false;
    art.lines = art.lines.map(function (l) { if (!hit && re.test(l)) { hit = true; return fn(l); } return l; });
    return hit;
  }

  /* 본문 속 «이 규칙의» 조 인용 — 법령 인용과 가른다(②) */
  function remapRefs(line, map, ownHead, warn) {
    var prevInternal = true;
    return line.replace(/제(\d+)조(?!\()/g, function (all, n, off, s) {
      if (ownHead && off === 0) return all;
      var before = s.slice(Math.max(0, off - 30), off).replace(/\s+$/, '');
      var internal;
      if (/(｣|」|법|령|규칙|동법|규정)$/.test(before)) internal = false;
      else if (/(및|와|과|,|또는|내지)$/.test(before)) internal = prevInternal;
      else internal = true;
      prevInternal = internal;
      if (!internal) return all;
      var to = map[+n];
      if (to === undefined) return all;
      if (to === null) { warn.push('뺀 조(옛 제' + n + '조)를 가리키는 인용이 남았습니다'); return all; }
      return '제' + to + '조';
    });
  }

  var LEFT_RE = /○○|ㅇ(?=[년개일조요시교])|(^|[^0-9])00(?=[:월일%시간])|20 년 월 일/;   // 「100일」의 00 은 빈칸이 아니다

  function build(std, answers) {
    var v = validate(answers);
    if (!v.ok) return { ok: false, why: v.why };
    var a = merge(answers);
    var text = String((std && std.text) || std || '').replace(/\r\n?/g, '\n');
    var L = text.split('\n');
    var b = L.findIndex(function (l) { return /^부\s*칙/.test(l); });
    if (b < 0) return { ok: false, why: ['표준 문안에 부칙이 없습니다'] };
    var body = pickRetirement(L.slice(0, b), a), tail = L.slice(b);
    var U = units(body), warn = [], drop = {};
    var A = {}; U.forEach(function (x) { if (x.art) A[x.num] = x; });
    var co = String(a.company).trim();

    /* ── 빈칸 채우기 (조 번호는 «표준의 번호») ── */
    [1, 2].forEach(function (n) { if (A[n]) A[n].lines = A[n].lines.map(function (l) { return l.replace(/○○주식회사/g, co); }); });
    if (A[7]) { if (+a.probation === 0) drop[7] = 1; else setLine(A[7], /ㅇ개월/, function (l) { return l.replace('ㅇ개월', a.probation + '개월'); }); }
    U.forEach(function (x) {
      if (!x.art) return;
      x.lines = x.lines.map(function (l) {
        return l.replace(/ㅇ년의 범위/g, a.leaveYears + '년의 범위').replace(/신청일부터 ㅇ일 내에/g, '신청일부터 ' + a.extendDays + '일 내에');
      });
    });
    if (A[22]) {
      if (!String(a.shift).trim()) drop[22] = 1;
      else setLine(A[22], /근무형태는/, function () {
        return '제22조(교대근로) ' + (String(a.shiftScope).trim() || '각 사원') + '의 근무형태는 ' + String(a.shift).trim() + '로 한다.';
      });
    }
    if (A[23]) {
      var w0 = DAYS.indexOf(a.weekStart), wEnd = DAYS[(w0 + 6) % 7];
      setLine(A[23], /^제23조\(근로시간\) ① /, function () {
        return '제23조(근로시간) ① 근로시간 산정을 위한 기준이 되는 1주는 제32조제1항에 따른 유급주휴일을 포함하여 '
          + a.weekStart + '요일부터 ' + wEnd + '요일까지 7일로 하고, 이 중 근무일은 월요일부터 금요일까지 5일이며, 매주 '
          + '토요일은 무급휴무일로 한다.';
      });
      var e18 = toHm(toMin(a.end) - 60);
      setLine(A[23], /^③ 1일의 근로시간/, function (l) {
        return l.replace(/00:00부터 00:00시까지 8시간/, a.start + '부터 ' + a.end + '까지 8시간')
          .replace(/00:00부터 00:00까지 7시간/, a.start + '부터 ' + e18 + '까지 7시간');
      });
    }
    if (A[24]) setLine(A[24], /^제24조\(휴게\) ① /, function (l) { return l.replace(/00:00시부터 00:00시까지/, a.breakStart + '부터 ' + a.breakEnd + '까지'); });
    if (A[25] && !a.flex.elastic) drop[25] = 1;
    if (A[26] && !a.flex.select) drop[26] = 1;
    if (A[27] && !a.flex.deemed) drop[27] = 1;
    if (A[28] && !a.flex.discretion) drop[28] = 1;
    if (A[32]) setLine(A[32], /^③ 노동절/, function () {
      return String(a.founding).trim()
        ? '③ 노동절(5월 1일)과 회사의 창립기념일인 ' + String(a.founding).trim().replace(/\s+/g, ' ') + '은 유급휴일로 한다.'
        : '③ 노동절(5월 1일)은 유급휴일로 한다.';
    });
    if (A[37]) {
      if (!String(a.summer).trim()) drop[37] = 1;
      else {
        var sm = String(a.summer).split('~').map(function (x) { return x.trim().replace(/\s+/g, ' '); });
        setLine(A[37], /00월 00일부터 00월 00일까지/, function (l) { return l.replace('00월 00일부터 00월 00일까지', sm[0] + '부터 ' + sm[1] + '까지'); });
      }
    }
    if (A[51]) {
      var al = String(a.allowances || '').split(/[,，、]/).map(function (x) { return x.trim(); }).filter(Boolean).join(', ');
      A[51].lines = A[51].lines.map(function (l) {
        return l.replace('기본급 및 ○○수당과', al ? '기본급 및 ' + al + '과' : '기본급과')
          .replace('기본급, ○○수당 등으로', al ? '기본급, ' + al + ' 등으로' : '기본급 등으로');
      });
    }
    if (A[52]) setLine(A[52], /해당 월의 00일/, function (l) { return l.replace('해당 월의 00일', '해당 월의 ' + a.payDay + '일'); });
    if (A[55] && !a.bonus) drop[55] = 1;
    if (A[60]) setLine(A[60], /만60세/, function (l) { return l.replace('만60세', '만' + a.retireAge + '세'); });

    /* ── 빼고 다시 매기기(②) ── */
    var map = {}, n = 0, dropped = [];
    U.forEach(function (x) {
      if (!x.art) return;
      if (drop[x.num]) { map[x.num] = null; dropped.push({ num: x.num, title: x.title }); return; }
      map[x.num] = ++n;
    });
    var out = [];
    U.forEach(function (x, k) {
      if (x.art && drop[x.num]) return;
      if (!x.art) {
        /* 장·절 머리 아래에 남은 조가 하나도 없으면 머리도 뺀다 */
        var rest = U.slice(k + 1), next = rest.findIndex(function (y) { return !y.art && /^제\s*\d+\s*장/.test(y.lines[0]); });
        var span = next < 0 ? rest : rest.slice(0, next);
        if (/^제\s*\d+\s*장/.test(x.lines[0]) && !span.some(function (y) { return y.art && !drop[y.num]; })) return;
        out.push(x.lines[0]); return;
      }
      x.lines.forEach(function (l, i) {
        var t = i === 0 ? l.replace(/^제\d+조/, '제' + map[x.num] + '조') : l;
        out.push(remapRefs(t, map, i === 0, warn));
      });
    });

    /* ── 부칙 시행일 ── */
    var ef = a.effective ? a.effective.split('-') : null;
    var tailOut = tail.map(function (l) {
      return ef ? l.replace(/20\s*년\s*월\s*일/, (+ef[0]) + '년 ' + (+ef[1]) + '월 ' + (+ef[2]) + '일') : l;
    });
    var all = out.concat(tailOut);
    if (a.term && a.term !== '사원') all = all.map(function (l) { return l.replace(/사원/g, a.term); });

    /* ── 못 채운 빈칸(⑤) ── */
    var left = [], curNo = '', inTail = false;
    all.forEach(function (l) {
      var m = /^제(\d+)조(?:의\d+)?\(([^)]*)\)/.exec(l);
      if (/^부\s*칙/.test(l)) { inTail = true; curNo = '부칙'; }
      if (m) curNo = (inTail ? '부칙 ' : '') + '제' + m[1] + '조(' + m[2] + ')';
      if (LEFT_RE.test(l) && left.indexOf(curNo) < 0) left.push(curNo);
    });
    return { ok: true, text: all.join('\n'), articles: n, dropped: dropped, leftovers: left, warnings: warn };
  }

  var api = { DEFAULTS: DEFAULTS, DAYS: DAYS, validate: validate, build: build, remapRefs: remapRefs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PuRulesDraft = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
