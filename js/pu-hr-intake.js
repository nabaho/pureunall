/* 메일 속 «입사·퇴사·급여자료·확인요청» 을 갈라 입퇴사 할 일로 세운다 (대표 승인 2026-10-03 ㉠)
   ═══════════════════════════════════════════════════════════════════════════
   목업: 「메일 속 입사·퇴사·급여자료가 급여데이터함 «할 일»로」 — ㉠ 급여데이터함에 둔다.

   ★ 이 모듈은 «값만» 다룬다 — 화면도 서버도 안 만진다. 그래서 실제 메일함 없이 검사한다.
     읽는 것: paydata/maillog 한 줄 (서버가 받은 메일마다 남기는 기록 — 제목·본문 앞 160자)
     사람이 남기는 것 둘:
       paydata/mailkind/{메일열쇠} — 꼬리표를 사람이 확정·고친 것
       paydata/hrtask/{할일번호}   — 할 일의 «상태»(처리함·이름·날짜 고침)

   ★ 할 일은 «저장해 두는 것»이 아니라 메일에서 «매번 다시 세는 것»이다.
     저장하는 것은 사람이 손댄 것뿐이다 — 그래서 화면을 여는 것만으로는 아무것도 안 쓴다
     (여러 사람이 같은 화면을 열어도 서로 덮지 않는다). 번호가 메일 열쇠에서 나오므로
     같은 메일은 언제 세어도 같은 할 일이 된다.

   ⚠ 이름·날짜는 «제안»이다. 급여관리에 자동으로 넣지 않는다. 주민번호는 뽑지 않는다.
   ⚠ 「짐작」은 짐작이라고 보인다 — 확실한 것만 저절로 할 일이 된다. 애매하면 묻는다.
   ⚠ 사업장은 서버가 이미 정한 companyId 만 쓴다(주소·번호로 이은 것). 이름으로 잇지 않는다. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PuHrIntake = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KINDS = [
    { key: 'in',  label: '입사' },
    { key: 'out', label: '퇴사' },
    { key: 'pay', label: '급여자료' },
    { key: 'ask', label: '확인요청' }
  ];
  var LABEL = {}; KINDS.forEach(function (k) { LABEL[k.key] = k.label; });
  var TASK_KINDS = { in: 1, out: 1 };     // 할 일이 서는 것은 입사·퇴사뿐이다

  /* ── 꼬리표 낱말 ──
     «센 말»(SURE) 은 제목에 있으면 확정이다. 본문에만 있거나 «여린 말»(WEAK) 이면 짐작으로 묻는다.
     ⚠ 퇴직소득 원천징수영수증·퇴직금 정산은 «서류 회신»이지 상실신고 할 일이 아니다 —
       「퇴직」 한 글자로 퇴사 할 일을 세우면 세무사무실 메일마다 헛 할 일이 선다.
       그래서 «퇴직»은 센 말에 없고, 서류 회신 꼴이면 퇴사를 짐작으로 내린다. */
  /* ⚠ 「신입사원」 속의 「입사」는 입사 신고가 아니다(실제로 «신입사원 평가 검토» 자문 메일에 붙었다). */
  var SURE = {
    /* ⚠ 「4대보험 '상실' / '취득' 인원」 — 따옴표로 감싼 상실·취득은 그 자체가 신고 요청이다.
         예전 꼴(「상실 인원」만)로는 이 메일에서 퇴사를 놓쳤다(검사가 잡았다 2026-10-03). */
    in:  /(?<!신)입사(?!원)|신규\s*(채용|입사)|자격\s*취득|취득\s*신고|취득\s*(인원|자)|['‘’"]취득['‘’"]|4대\s*보험[^.]{0,20}취득/,
    out: /퇴사|자격\s*상실|상실\s*신고|상실\s*(인원|자)|['‘’"]상실['‘’"]|4대\s*보험[^.]{0,20}상실|이직\s*확인서/,
    pay: /근태|출근부|출퇴근|급여\s*(자료|내역|대장|명세)|수당|일용(직|근로)?|근무\s*(표|시간|내역|일지)|스케[줄쥴]|시급/,
    ask: /확인\s*(요청|부탁)|검토\s*(요청|부탁)|정정|수정\s*(요청|부탁)|재발행|재발급|문의/
  };
  var WEAK = {
    /* ⚠ 「채용」·「신입」은 넣지 않는다 — 자문 메일(채용 공고·신입사원 평가 검토)이 다 걸린다 */
    in:  /새로\s*(오|온|들어)|들어\s*(왔|온|올)|첫\s*출근/,
    out: /그만\s*[두둔]|나가[요게기는]|나갔|퇴직|관두/
  };
  var DOC_REPLY = /원천징수|영수증|퇴직금\s*(정산|산정)|산정\s*내역|퇴직소득|명세서\s*송부|급여대장\s*송부/;
  /* 우리가 보낸 메일에 «답한» 것 — 「[RE][푸른노무법인] …중도퇴사자 ○○님 9월 급여대장」.
     퇴사는 이미 우리가 알고 처리하던 일이다. 새 할 일로 세우지 않고 묻는다. */
  var OUR_THREAD = /^\s*(\[\s*(re|fw|fwd)\s*\]|(re|fw|fwd)\s*[:：])/i;
  var OUR_NAME = /\[푸른노무법인\]/;
  var NOT_HR = /취득세|자격증\s*취득|학위\s*취득/;

  function clean(v) { return v == null ? '' : String(v); }

  /* 메일 한 줄 → { kinds:[…], guess:[…], info:[…], sure:bool }
     guess = 입사·퇴사 가운데 «짐작»인 것. 화면이 「🤖 짐작」으로 묻고, 확정 전에는 할 일이 안 선다.
     info  = 입사·퇴사 꼬리표는 붙이되 «묻지도 할 일도 안 세우는» 것 — 서류 회신·우리 메일에 단 답장.
             (실제 메일 43통 가운데 대부분이 원천징수영수증·퇴직금 산정내역 회신이었다 —
              그걸 다 「퇴사인가요?」로 물으면 사람이 «해당 없음»만 마흔 번 누른다)
     ⚠ 짐작은 «종류마다» 따로다 — 제목에 「퇴사」가 있고 본문에 「들어온」이 있으면
       퇴사는 할 일이 서고 입사만 묻는다. 한 메일을 통째로 짐작으로 내리면 확실한 퇴사까지 묻힌다.
     ⚠ 급여자료·확인요청은 꼬리표일 뿐이라(틀려도 할 일이 안 선다) 짐작으로 묻지 않는다. */
  function kindsOf(row) {
    var subj = clean(row && row.subject), body = clean(row && row.preview);
    var all = subj + ' ' + body;
    var kinds = [], guess = [];
    ['in', 'out', 'pay', 'ask'].forEach(function (k) {
      if (SURE[k].test(subj)) { kinds.push(k); return; }
      if (SURE[k].test(body) || (WEAK[k] && WEAK[k].test(all))) {
        kinds.push(k);
        if (TASK_KINDS[k]) guess.push(k);
      }
    });
    if (NOT_HR.test(all) && !/입사|퇴사|상실/.test(all)) {
      kinds = kinds.filter(function (k) { return k !== 'in'; });
      guess = guess.filter(function (k) { return k !== 'in'; });
    }
    /* 서류 회신 꼴·우리 메일에 단 답장이면 입퇴사는 «알림 꼬리표»만 — 묻지도 세우지도 않는다 */
    var info = [];
    if (DOC_REPLY.test(subj) || (OUR_THREAD.test(subj) && OUR_NAME.test(subj))) {
      info = kinds.filter(function (k) { return TASK_KINDS[k]; });
      guess = [];
    }
    return { kinds: kinds, guess: guess, info: info, sure: guess.length === 0 };
  }

  /* ── 이름 제안 ── 성씨로 시작하는 2~4글자만, 정해진 꼴에서만 집는다.
     ⚠ 넓게 잡으면 「입사 서류」의 「서류」, 「퇴사자 근로계약서」의 「근로계약」을 이름으로 집는다. */
  var SURNAME = '김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예봉경사부가복태목형계피두감음빈동온호범좌';
  var STOP = /^(입사|퇴사|입사자|퇴사자|근로자|직원|사원|대표|인원|신규|처리|신고|서류|관련|요청|부탁|확인|이번|다음|지난|금월|당월|익월|이번달|다음달|중도|명단|예정|건|자료|명세|정산|급여|임금|보험|사대|일용|현장|본사|지점|공장|매장|점장|과장|부장|차장|대리|주임|실장|팀장|이사|사장|원장|간호사|조리사|사무장|담당자|관리자|실무자|부원장|소장|국장|회장|상무|전무|감사|선생|고객|외국인|근로자분)$/;
  /* 이름은 앞이 한글이 아니어야 한다 — 「퇴사자 상실」의 「사자」, 「요양원」의 「양원」을 막는다. */
  var NAME = '(?<![가-힣])([' + SURNAME + '][가-힣]{1,3})';
  var NAME_ONLY = '[' + SURNAME + '][가-힣]{1,3}';
  /* 집는 꼴은 넷뿐이다 (실제 메일 191통으로 맞춤 2026-10-03):
     ① 「입사자 홍길동」 — 반드시 «…자» 다음, 띄어 쓰거나 쌍점. 「입사신고서」의 「신고서」를 막는다
     ② 「홍길동님」·「홍길동씨」 — 사람을 부르는 말이 붙은 것
     ③ 「홍길동 퇴사」 — 이름 다음 한 칸 띄고 바로 입사·퇴사
     ④ 「(홍길동)」·「(홍길동,김철수)」 — 제목 끝 괄호에 이름만 든 것 */
  function namesIn(text, kind) {
    var word = kind === 'out' ? '(?:퇴사|상실|그만)' : '(?:입사|취득)';
    var pats = [
      new RegExp(word + '자(?:\\s+|\\s*[:：]\\s*)' + NAME + '(?=님|씨|[^가-힣]|$)', 'g'),
      new RegExp(NAME + '(?=님|씨)', 'g'),
      new RegExp(NAME + '\\s+' + word + '(?!자)', 'g')
    ];
    var out = [];
    /* 「유정미님」 과 「유정미」 는 한 사람이다 — 부르는 말을 떼고 센다 */
    var add = function (n) {
      n = String(n || '').replace(/(님|씨)$/, '');
      if (n.length >= 2 && !STOP.test(n) && out.indexOf(n) < 0) out.push(n);
    };
    pats.forEach(function (re) {
      var m;
      while ((m = re.exec(text))) add(m[1]);
    });
    var paren = new RegExp('\\((' + NAME_ONLY + '(?:\\s*[,·]\\s*' + NAME_ONLY + ')*)\\)', 'g'), pm;
    while ((pm = paren.exec(text))) pm[1].split(/\s*[,·]\s*/).forEach(add);
    return out;
  }
  function nameOf(row, kind) {
    var co = clean(row && row.companyName).replace(/\s/g, '');
    var ns = namesIn(clean(row && row.subject) + ' ' + clean(row && row.preview), kind)
      .filter(function (n) { return !co || co.indexOf(n) < 0; });   // 사업장 이름 조각은 사람이 아니다
    if (!ns.length) return '';
    return ns.length > 3 ? ns.slice(0, 3).join('·') + ' 외 ' + (ns.length - 3) + '명' : ns.join('·');
  }

  /* ── 날짜 ── */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdOf(ms) {
    var d = new Date(Number(ms) || 0);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function okDate(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return '';
    var t = new Date(y, m - 1, d);
    return (t.getMonth() === m - 1) ? y + '-' + pad(m) + '-' + pad(d) : '';
  }
  /* 입사·퇴사 낱말이 있는 글에서만 날짜를 집는다 — 「24.10월 스케줄」 같은 것은 날이 아니다. */
  function dateOf(row, kind) {
    var text = clean(row && row.subject) + ' ' + clean(row && row.preview);
    var word = kind === 'out' ? /퇴사|상실|그만|퇴직/ : /입사|취득|신규|출근/;
    if (!word.test(text)) return '';
    var mailYmd = ymdOf(row && row.at);
    var my = Number(mailYmd.slice(0, 4)), mm = Number(mailYmd.slice(5, 7));
    /* ⚠ 받은 날에서 «60일 안»의 날짜만 믿는다. 본문에는 옛 입사일(1년 전)이 흔히 같이 적혀 있다 —
         실제로 퇴사 메일에서 지난해 입사일을 퇴사일로 집어 기한이 1년 전으로 떴다. */
    var near = function (ymd) {
      if (!ymd) return '';
      var d = Math.abs(daysLeft(ymd, Number(row && row.at) || Date.now()));
      return d <= 60 ? ymd : '';
    };
    var re1 = /(20\d{2})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})\s*일?/g, m;
    while ((m = re1.exec(text))) { var a = near(okDate(Number(m[1]), Number(m[2]), Number(m[3]))); if (a) return a; }
    var re2 = /(?:^|[^\d.])(\d{1,2})\s*(?:월\s*(\d{1,2})\s*일|[\/.](\d{1,2})(?![\d.]))/g;
    while ((m = re2.exec(text))) {
      var mo = Number(m[1]), da = Number(m[2] || m[3]);
      var y = my;
      if (mo - mm > 6) y = my - 1;        // 1월에 받은 「12/28 퇴사」 는 지난해다
      else if (mm - mo > 6) y = my + 1;   // 12월에 받은 「1/2 입사」 는 다음 해다
      var b = near(okDate(y, mo, da)); if (b) return b;
    }
    return '';
  }

  /* ── 신고 기한 (법령 원문으로 확인 2026-10-03) ──
     · 건강보험 — 취득한 날 / 잃은 날부터 «14일 이내» (국민건강보험법 제8조②·제10조②)
       ⚠ 날은 0시에 시작하므로 그날을 첫날로 센다(민법 제157조 단서) → 그날 + 13일.
       퇴사는 «사용관계가 끝난 날의 다음 날» 자격이 바뀐다(같은 법 제9조①3) → 퇴사일 + 1 이 기준.
     · 고용보험 — 사유가 생긴 달의 «다음 달 15일까지» (고용보험법 시행령 제7조①)
     · 국민연금 — 사유가 생긴 달의 «다음 달 15일까지» (국민연금법 시행규칙 제6조①)
     가장 이른 것은 늘 건강보험이다. 화면은 그것을 기한으로 보이고 나머지는 title 로 적는다. */
  function addDays(ymd, n) {
    var p = ymd.split('-').map(Number);
    return ymdOf(new Date(p[0], p[1] - 1, p[2] + n).getTime());
  }
  function next15(ymd) {
    var p = ymd.split('-').map(Number);
    return ymdOf(new Date(p[0], p[1], 15).getTime());     // 월은 0부터 — p[1] 이 곧 «다음 달»
  }
  function dueOf(kind, ymd) {
    if (!ymd) return null;
    var base = kind === 'out' ? addDays(ymd, 1) : ymd;
    return { health: addDays(base, 13), monthly: next15(base), first: addDays(base, 13) };
  }
  function daysLeft(dueYmd, nowMs) {
    if (!dueYmd) return null;
    var p = dueYmd.split('-').map(Number);
    var t = new Date(Number(nowMs) || Date.now());
    var a = Date.UTC(p[0], p[1] - 1, p[2]), b = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.round((a - b) / 864e5);
  }

  /* ── 번호 ── 메일 열쇠 + 종류. 같은 메일은 언제 세어도 같은 번호다. */
  function taskId(mailKey, kind) {
    return 'hr-' + String(mailKey || '').replace(/[.#$\[\]\/]/g, '_') + '-' + kind;
  }

  /* 사람이 확정한 꼬리표를 읽는다.
     ⚠ 파이어베이스는 빈 배열([])을 «저장하지 않는다» — 「해당 없음」을 배열로 적으면 칸이 통째로
       사라져 다시 자동 꼬리표로 돌아간다. 그래서 «글자»로 적는다: 'in,out' · 'pay' · ''(해당 없음). */
  function confirmedKinds(c) {
    if (!c) return null;
    if (typeof c.kinds === 'string') return c.kinds.split(',').filter(function (k) { return LABEL[k]; });
    if (Array.isArray(c.kinds)) return c.kinds.filter(function (k) { return LABEL[k]; });
    return null;
  }
  function kindsText(kinds) {
    return (kinds || []).filter(function (k) { return LABEL[k]; }).join(',');
  }

  /* 메일 한 줄의 «최종» 꼬리표 — 사람이 확정한 것이 이긴다. */
  function finalKinds(row, confirm) {
    var ck = confirmedKinds(confirm);
    if (ck) {
      return { kinds: ck, guess: [], info: [], sure: true, byHand: true };
    }
    var k = kindsOf(row);
    return { kinds: k.kinds, guess: k.guess, info: k.info, sure: k.sure, byHand: false };
  }

  /* 할 일 세우기.
     log      = paydata/maillog  {열쇠: 줄}
     confirms = paydata/mailkind {열쇠: {kinds:[…]}}
     states   = paydata/hrtask   {번호: {doneAt, doneBy, name, date, removed}}
     ⚠ 사업장을 모르는 메일(companyId 없음)은 세우지 않는다 — 사업장 줄에 붙일 데가 없다.
       그런 메일은 지금처럼 «메일로 온 것» 화면에서 사람이 잇는다. */
  /* 할 일을 세기 시작하는 날 — 이 기능이 생기기 2주 전(2026-09-20).
     ⚠ 그 전 메일까지 세면 이미 끝냈을 8월 일이 전부 「기한 지남」으로 떠 정작 새 일이 묻힌다.
     ⚠ «며칠 전부터»(움직이는 창)로 두지 않는다 — 그러면 안 한 일이 날짜가 지나며 조용히 사라진다. */
  var START_MS = new Date(2026, 8, 20).getTime();

  /* 「RE: …」·「[RE][푸른노무법인] …」 를 걷은 제목 — 같은 건의 답장을 한 건으로 묶는 열쇠 */
  function threadKey(subject) {
    return String(subject || '')
      .replace(/^(\s*(\[\s*(re|fw|fwd)\s*\]|(re|fw|fwd|회신|답장)\s*[:：]))+/i, '')
      .replace(/\[푸른노무법인\]/g, '').replace(/\s+/g, '').toLowerCase();
  }

  function tasksOf(log, confirms, states, nowMs, opt) {
    var out = [], seen = {};
    var since = (opt && opt.sinceMs != null) ? opt.sinceMs : START_MS;
    confirms = confirms || {}; states = states || {};
    /* 먼저 온 메일부터 센다 — 같은 건의 답장은 첫 메일의 할 일에 «답장 n» 으로 붙는다 */
    Object.keys(log || {}).sort(function (a, b) {
      return (Number((log[a] || {}).at) || 0) - (Number((log[b] || {}).at) || 0);
    }).forEach(function (key) {
      var row = log[key];
      if (!row || !row.companyId) return;
      if ((Number(row.at) || 0) < since && !confirmedKinds(confirms[key])) return;
      var fk = finalKinds(row, confirms[key]);
      fk.kinds.forEach(function (kind) {
        if (!TASK_KINDS[kind]) return;
        if (fk.guess.indexOf(kind) >= 0) return;    // 짐작은 묻기만 한다 — 할 일은 확정 뒤에
        if (fk.info.indexOf(kind) >= 0) return;     // 서류 회신은 꼬리표만
        var id = taskId(key, kind), st = states[id] || {};
        if (st.removed) return;
        var tk = String(row.companyId) + '|' + kind + '|' + threadKey(row.subject);
        if (seen[tk] && !confirmedKinds(confirms[key])) { seen[tk].replies++; return; }
        var gName = nameOf(row, kind), gDate = dateOf(row, kind);
        var name = (typeof st.name === 'string') ? st.name : gName;
        var date = st.date || gDate;
        var base = date || ymdOf(row.at);
        var due = dueOf(kind, base);
        var t = {
          id: id, mailKey: key, kind: kind, label: LABEL[kind], replies: 0,
          companyId: String(row.companyId), companyName: clean(row.companyName),
          name: name, nameGuess: typeof st.name !== 'string' && !!gName,
          date: date, dateGuess: !st.date && !!gDate, dateFromMail: !date,
          due: due, left: daysLeft(due && due.first, nowMs),
          at: Number(row.at) || 0, subject: clean(row.subject), from: clean(row.from),
          done: !!st.doneAt, doneAt: st.doneAt || 0, doneBy: clean(st.doneBy)
        };
        seen[tk] = t;
        out.push(t);
      });
    });
    out.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return String(a.due && a.due.first).localeCompare(String(b.due && b.due.first)) || (b.at - a.at);
    });
    return out;
  }

  /* 사업장별로 접어 센다 — 사업장 줄의 「입사 1 · 퇴사 2 · D-2」 */
  function byCompany(tasks) {
    var m = {};
    (tasks || []).forEach(function (t) {
      if (t.done) return;
      var c = m[t.companyId] || (m[t.companyId] = { in: 0, out: 0, left: null });
      c[t.kind]++;
      if (t.left !== null && (c.left === null || t.left < c.left)) c.left = t.left;
    });
    return m;
  }

  /* 사업장 한 곳의 이번 달 메일 — 꼬리표와 「짐작」 묻기를 붙여서 */
  function mailsOf(log, confirms, companyId, fromMs, toMs) {
    var out = [];
    confirms = confirms || {};
    Object.keys(log || {}).forEach(function (key) {
      var r = log[key];
      if (!r || String(r.companyId || '') !== String(companyId)) return;
      var at = Number(r.at) || 0;
      if (fromMs && at < fromMs) return;
      if (toMs && at >= toMs) return;
      var fk = finalKinds(r, confirms[key]);
      out.push({ key: key, at: at, from: clean(r.from), subject: clean(r.subject),
        atts: Number(r.took || r.atts || 0), kinds: fk.kinds, guess: fk.guess, info: fk.info, byHand: fk.byHand });
    });
    out.sort(function (a, b) { return b.at - a.at; });
    return out;
  }

  return {
    KINDS: KINDS, LABEL: LABEL, TASK_KINDS: TASK_KINDS,
    kindsOf: kindsOf, finalKinds: finalKinds, confirmedKinds: confirmedKinds, kindsText: kindsText,
    nameOf: nameOf, dateOf: dateOf,
    dueOf: dueOf, daysLeft: daysLeft, taskId: taskId, ymdOf: ymdOf, threadKey: threadKey, START_MS: START_MS,
    tasksOf: tasksOf, byCompany: byCompany, mailsOf: mailsOf
  };
});
