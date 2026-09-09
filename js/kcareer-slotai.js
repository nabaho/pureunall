'use strict';
/* 푸른노무법인 경력관리 — 낱개 칸(인적사항) 「자리 짚기」를 AI에게 묻기
   (브라우저 window.KcareerSlotAi / Node module.exports 겸용, DOM·통신 없음 — 글자만 다룬다)

   ── 왜 만드나 (대표 물음 2026-09-09) ──
   「이력서 양식이 잘 안채워지고 자기 마음데로 입력된다. 이부분 근본적 해결하고 싶다.」

   여태 낱개 칸은 «낱말 사전 + 정규식»으로만 짚었다. 그것이 근본 한계다:
     · 기관 서식은 끝이 없다(7번 폴더에 신청서 3,691개). 사전은 늘 한 발 늦는다.
     · 낱말을 더할수록 «오인»이 늘었다 — 「소속기관」을 더하니 보통 라벨 표가 경력 목록으로
       오인돼 채울 자리 4개가 0개가 됐고(2026-09-05), 「전 화」를 더하니 아래 빈 줄에
       휴대폰이 박혔다(2026-09-07). 고치면 다른 데가 새는 짜임이었다.
     · 「이 칸이 무엇을 적는 자리인가」는 «뜻을 읽는 일»이다. 정규식이 못 하는 일을 시켰다.

   목록 표(학력·경력)는 2026-08-30 에 이미 이 길로 옮겼다(kcareer-colmap-ai.js).
   그것이 잘 되니 낱개 칸도 «같은 길»로 옮긴다. 이 파일은 그 짝이다.

   ── ★ 이 파일이 지키는 약속 ──
   ⚠★ AI 는 문서에 «한 글자도 쓰지 않는다.» 「어느 칸이 무엇인지」만 짚는다.
      값을 넣는 것은 지금까지의 결정적 코드(kcareer-formmap.apply)이고,
      그것은 «지도에 적힌 칸에만» 쓴다. 그래서 AI 가 틀려도 결과는 «빈 칸»이지
      «엉뚱한 값»이 아니다 — 그것이 「마음대로 입력된다」를 없애는 자리다.
   ⚠★ 사전이 이미 짚은 칸은 «건드리지 않는다»(mergeInto). AI 는 «모르는 칸만» 메운다.
      그래서 오늘 되는 것이 뒷걸음질할 수 없다.
   ⚠★ 개인정보는 «보내기 전에» 지운다(scrub). 이미 채워진 문서를 다시 열어도
      내 이름·전화·주민번호가 AI 에게 가지 않는다. 검사로 못박았다.
   ⚠ 주민등록번호(rrn)는 «고를 수 있는 것에 없다» — 사람이 손으로 고를 때만 나간다.
   ⚠ AI 도 틀린다. 그래서 받은 답을 반드시 검사하고(모르는 칸 번호·모르는 열쇠는 버린다),
     짚은 것은 화면(채울 곳 서랍)에 «AI가 짚었다»고 밝혀 사람이 확인하게 한다.
     의심스러우면 안 채우는 쪽이 맞다 — 잘못 낸 서류는 되돌릴 수 없다. */
(function (root) {

  var X = (typeof require === 'function' && typeof module !== 'undefined')
    ? require('./kcareer-hwpxfill.js')
    : root.KcareerHwpxFill;

  /* 고를 수 있는 열쇠 — 채우는 쪽에서 «빌려 온다».
     ⚠ 여기 손으로 적지 말 것. 목록 표 쪽(kcareer-colmap-ai.js)이 그렇게 적어 두어
       area(소재지)·degree(학위)가 어긋난 채로 남았다(2026-09-09에 고쳤다). */
  var KEYS = ((X && X.FIELD_FILL_KEYS) || []).concat(['none']);

  /* 사람에게 보일 이름 — 물음에 함께 적는다. 열쇠 이름만 보내면 AI 가 헷갈린다. */
  var 뜻 = {
    name: '한글 성명', nameHanja: '한자 성명', nameEng: '영문 성명',
    birth: '생년월일', gender: '성별',
    phone: '휴대전화', phoneWork: '직장·사무실 전화', phoneHome: '자택 전화', fax: '팩스',
    email: '이메일', emailWork: '직장 이메일',
    addr: '집 주소(현주소)', addrWork: '직장·사무실 주소',
    org: '소속·근무처 이름', dept: '부서', title: '직위·직급',
    orgTitle: '소속과 직위를 «한 칸에» 함께 적는 자리', license: '자격증·자격번호'
  };

  /* ═══ 개인정보 지우기 ═══════════════════════════════════════════════
     ⚠★ 이것이 이 파일의 «안전장치»다. 서식은 기관이 만든 공개 문서지만,
       이미 «채워 둔» 문서를 다시 열면 칸에 내 이름·전화·주민번호가 들어 있다
       (대표 화면 2026-09-09 이 바로 그 경우였다 — 세 번 채운 파일을 다시 여셨다).
     ⚠ 두 겹으로 지운다:
       ① 내 정보로 든 값을 그대로 지운다 — 무엇이 내 것인지는 우리가 안다(가장 확실하다).
       ② 꼴로 알아보는 것(주민번호·전화·이메일·긴 숫자)은 내 것이 아니어도 지운다.
     ⚠ 한 글자 값(성별 「남」)은 지우지 않는다 — 지우면 서식 글자가 뭉개져 뜻을 잃는다.
       한 글자는 그것만으로 누구인지 알 수 없으므로 지울 까닭도 없다. */
  var 가림 = '○';
  function scrub(text, own) {
    var s = String(text == null ? '' : text);
    if (!s) return '';
    /* ① 내 값 — 긴 것부터 지운다(짧은 것을 먼저 지우면 긴 것이 토막 난다) */
    var vals = [];
    Object.keys(own || {}).forEach(function (k) {
      var v = own[k];
      if (v == null) return;
      v = String(v).trim();
      if (v.length >= 2) vals.push(v);
    });
    vals.sort(function (a, b) { return b.length - a.length; });
    vals.forEach(function (v) { if (s.indexOf(v) >= 0) s = s.split(v).join(가림); });
    /* ② 꼴로 알아보는 것 */
    s = s.replace(/\d{6}\s*[-–—]\s*\d{7}/g, 가림);            /* 주민등록번호 */
    s = s.replace(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g, 가림);         /* 전화번호 */
    s = s.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, 가림);             /* 이메일 */
    s = s.replace(/\d{7,}/g, 가림);                                     /* 긴 숫자 */
    /* ③ 길면 자른다 — 물음이 길어지면 요금이고, 자리를 짚는 데 긴 글은 필요 없다 */
    if (s.length > 40) s = s.slice(0, 40) + '…';
    return s;
  }

  /* ═══ 서식의 «줄» 을 읽는다 ═══════════════════════════════════════
     칸 하나만 보내면 AI 도 못 짚는다 — 빈 칸이라 글자가 없기 때문이다.
     그 칸이 «어느 줄의 몇째 칸»인지 함께 보내야 「성 명 | [한글] | [한자] | [영문]」이
     보인다. 그래서 표를 다시 훑어 줄 글자를 모은다.
     ⚠ 훑기만 한다 — 여기서 XML 을 바꾸지 않는다. */
  function rowsOf(xml) {
    var out = {}, ti = -1;
    if (!X || !X.eachTable) return out;
    X.eachTable(String(xml == null ? '' : xml), function (tbl) {
      ti++;
      X.splitRows(tbl).forEach(function (tr, ri) {
        out[ti + ':' + ri] = X.splitCells(tr).map(function (tc) {
          return String(X.cellText(tc) || '').trim();
        });
      });
      return tbl;
    });
    return out;
  }

  /* ⚠★ 「그 표의 머리줄을 함께 보내면 좋겠다」 — 해 보고 «되돌렸다»(2026-09-09).
     빈 줄만 보내면 단서가 없어(대표 서식에서 물을 칸 21군데 중 15군데가
     「(빈칸)|(빈칸)|(빈칸)|(빈칸)」 이었다) 위로 올라가며 머리줄을 찾게 했다.
     실측 결과 «더 나빠졌다»: 도움이 된 것은 2군데뿐이고, 그 2군데에 «틀린» 머리줄이 갔다 —
     어학 표를 물으면서 학력 표의 마지막 자료 줄(「년 월 ~ 년 월 | 대학원 | …」)을
     그 표의 열 이름이라고 알려 주었다. 칸 수가 같은 줄을 찾아 올라가면 «남의 표»가 걸린다.
     ⚠ 틀린 단서는 «없는 단서보다 나쁘다» — AI 가 그 이름을 믿고 엉뚱한 값을 짚는다.
     ⚠ 제대로 하려면 병합 칸의 «진짜 열 번호»(hp:cellAddr colAddr)로 표 구역을 갈라야 한다
       (열 밀림을 고친 7fb35ba9 과 같은 뿌리). 그때까지는 «묻지 않고 비워 두는» 쪽이 맞다 —
       라벨이 없는 칸은 AI 가 none 이라 답하고, 그 결과는 «빈 칸»이지 «틀린 값»이 아니다.
     ⚠ 다시 해 볼 때는 이 주석을 먼저 읽을 것. 같은 길로 두 번 가지 말 것.

  /* ═══ 물어볼 것만 고른다 ═══════════════════════════════════════════
     ⚠ 사전이 이미 짚은 칸(guess 가 있다)은 «묻지 않는다» — 돈·시간을 아끼고,
       무엇보다 오늘 되는 것을 AI 가 바꾸지 못하게 한다.
     ⚠ 글자칸은 묻지 않는다 — 사람이 눌러 고치는 자리이지 값을 «고르는» 자리가 아니다.
     ⚠ 개수를 막는다 — 서식 하나가 수백 칸이면 물음이 길어지고 그것이 요금이다. */
  var MAX = 28;
  /* 자리 하나를 가리키는 «온전한» 이름 — 구역 + 자리 */
  function 자리이름(s) { return (s && s.sec ? s.sec + '|' : '') + (s ? s.id : ''); }
  function skeleton(xml, slots, own, opts) {
    var o = opts || {};
    /* ⚠★ 0 은 «자리가 없다»는 뜻이다 — «안 정했다»가 아니다.
       o.max > 0 으로 보면 0 이 기본값(MAX)으로 되돌아가, 여러 쪽 서식에서
       앞 쪽이 한도를 다 쓴 뒤 뒤 쪽이 다시 28개를 묻는다
       (실측 2026-09-09: 네 쪽·한도 12 에 32개를 물었다). */
    var 한도 = (typeof o.max === 'number' && o.max >= 0) ? o.max : MAX;
    var rows = rowsOf(xml), items = [], cut = 0;
    if (!한도) {
      /* 자리가 없으면 «세기만» 한다 — 조용히 빠지면 「채웠다는데 비어 있다」가 된다 */
      (slots || []).forEach(function (s2) {
        if (!s2 || s2.guess || s2.kind === '글자칸' || s2.hint === 'rrn') return;
        cut++;
      });
      return { items: [], cut: cut };
    }
    (slots || []).forEach(function (s) {
      if (!s || s.guess) return;                     /* 사전이 짚었다 — 그대로 둔다 */
      if (s.kind === '글자칸') return;
      if (s.hint === 'rrn') return;                  /* 주민번호 자리는 묻지 않는다 */
      if (items.length >= 한도) { cut++; return; }
      var line = rows[s.tbl + ':' + s.row] || [];
      items.push({
        /* ⚠ 구역 이름을 앞에 붙인다 — 자리 이름표는 구역마다 되풀이되므로
           그냥 쓰면 2쪽의 답이 1쪽의 같은 이름 칸에 얹힌다. */
        id: 자리이름(s),
        slot: s.id, sec: s.sec || '',
        at: (s.tbl + 1) + '표 ' + (s.row + 1) + '행 ' + (s.col + 1) + '열',
        col: s.col,
        left: scrub(s.left, own),
        up: scrub(s.up, own),
        text: scrub(s.text, own),
        line: line.map(function (t) { return scrub(t, own); })
      });
    });
    return { items: items, cut: cut };
  }

  /* 여러 구역(section*.xml)을 «한 번에» 묻는다 —
     ⚠ 구역마다 따로 물으면 부르는 횟수가 곱해지고 그것이 곧 요금이다.
       실제 기관 서식은 2~4쪽이 흔하다(대표 서식은 4쪽).
     ⚠ 한도는 구역을 통틀어 센다 — 구역마다 28개면 4쪽에서 112개가 된다. */
  function skeletonAll(sections, own, opts) {
    var o = opts || {};
    var 한도 = (typeof o.max === 'number' && o.max > 0) ? o.max : MAX;
    var items = [], cut = 0;
    /* ⚠ 남은 자리를 «0 으로도» 넘긴다 — skeleton 이 0 을 그대로 0 으로 읽는다 */
    (sections || []).forEach(function (sec) {
      if (!sec) return;
      var 남은 = 한도 - items.length;
      var one = skeleton(sec.xml, sec.slots, own, { max: 남은 > 0 ? 남은 : 0 });
      items = items.concat(one.items);
      cut += one.cut;
    });
    return { items: items, cut: cut };
  }

  /* ═══ 물음 ═══════════════════════════════════════════════════════ */
  function buildPrompt(skel) {
    var items = (skel && skel.items) || [];
    if (!items.length) return null;
    var 줄 = items.map(function (it, i) {
      var 보임 = (it.line || []).map(function (t, j) {
        var 글 = t || '(빈칸)';
        return (j === it.col) ? ('《' + 글 + '》') : 글;
      }).join(' | ');
      var 곁 = [];
      if (it.left) 곁.push('왼쪽 「' + it.left + '」');
      if (it.up) 곁.push('위 「' + it.up + '」');
      return '  ' + (i + 1) + ') ' + it.at
        + (보임 ? '\n     그 줄: ' + 보임 : '')
        + (곁.length ? '\n     ' + 곁.join(' · ') : '');
    }).join('\n');

    var 고를것 = KEYS.filter(function (k) { return k !== 'none'; })
      .map(function (k) { return '  ' + k + ' — ' + (뜻[k] || k); }).join('\n');

    return [
      '한국 공공기관 이력서·지원서 서식입니다. 표의 «어느 칸에 무엇을 적는 자리인지»만 골라 주세요.',
      '',
      '⚠ 값을 만들지 마세요. 우리가 값을 갖고 있습니다. 자리만 골라 주세요.',
      '⚠ 개인정보는 이미 ○ 로 지워 보냅니다.',
      '',
      '《 》 로 감싼 칸이 «묻는 칸»입니다. 나머지는 그 줄의 이웃 칸입니다.',
      '이웃 칸이 모두 비어 있어 무엇을 적는 자리인지 알 수 없으면 none 을 고르세요.',
      '',
      '묻는 칸:',
      줄,
      '',
      '고를 수 있는 것:',
      고를것,
      '  none — 위에 없거나, 우리가 채울 자리가 아닌 칸(접수번호·기관이 적는 칸·사진 자리 등)',
      '',
      '규칙:',
      '  · 확실하지 않으면 none 을 고르세요. 틀리게 넣는 것이 안 넣는 것보다 나쁩니다.',
      '  · 같은 것을 두 번 고르지 마세요.',
      '  · 위에 적힌 칸 번호(1~' + items.length + ')만 쓰세요. 없는 번호를 만들지 마세요.',
      '  · 「접수번호」·「접수시 기재」처럼 기관이 적는 칸은 none 입니다.',
      '',
      'JSON 객체 하나만 답하세요. 설명은 붙이지 마세요.',
      '예: {"1":"nameEng","2":"phoneWork","3":"none"}'
    ].join('\n');
  }

  /* ═══ 답 읽기 ═══════════════════════════════════════════════════
     ⚠ 못 알아들으면 null — 부르는 쪽이 「못 물었다」고 알고 사전으로 간다.
       «다 모르겠다»는 답({}) 과는 다르다. 그것은 정상이다.
     ⚠ 모르는 칸 번호·모르는 열쇠는 «그것만» 버린다 — 답 전체를 버리면
       한 줄 틀린 것 때문에 잘 짚은 나머지를 다 잃는다.
     ⚠ 같은 열쇠가 두 칸에 오면 «첫 칸만» — 값이 두 자리에 박히는 것을 막는다
       (목록 표에서 실제로 겪은 일이다, 2026-08-29). */
  function parseReply(text, skel) {
    var items = (skel && skel.items) || [];
    var s = String(text == null ? '' : text);
    var m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    var obj = null;
    try { obj = JSON.parse(m[0]); } catch (e) { return null; }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;

    var picks = {}, seen = {}, dropped = [];
    Object.keys(obj).forEach(function (nk) {
      var n = parseInt(String(nk).replace(/[^0-9]/g, ''), 10);
      if (!(n >= 1 && n <= items.length)) { dropped.push(nk + ' (없는 칸)'); return; }
      var k = String(obj[nk] == null ? '' : obj[nk]).trim();
      if (!k || k === 'none') return;
      if (KEYS.indexOf(k) < 0) { dropped.push(nk + ' → ' + k + ' (모르는 열쇠)'); return; }
      if (seen[k]) { dropped.push(nk + ' → ' + k + ' (이미 다른 칸에 골랐다)'); return; }
      seen[k] = true;
      picks[items[n - 1].id] = k;
    });
    return { picks: picks, dropped: dropped };
  }

  /* ═══ 지도에 얹기 ═══════════════════════════════════════════════
     ⚠★ 사전이 짚은 칸은 «절대» 덮지 않는다. AI 는 빈 자리만 메운다.
       이 빗장이 이 기능의 «뒷걸음질 금지» 장치다 — 이것을 풀면 AI 가
       오늘 잘 되는 칸을 바꿔 버릴 수 있다.
     ⚠ 얹은 칸은 ai 표시를 남긴다 — 화면이 「AI가 짚었습니다」라 밝혀
       사람이 확인하고 넘어가게 한다(확인 단계를 없애지 않는다). */
  function mergeInto(slots, picks) {
    var n = 0;
    if (!picks) return 0;
    (slots || []).forEach(function (s) {
      if (!s || s.guess) return;
      if (s.kind === '글자칸') return;
      /* ⚠ 구역까지 맞춰 찾는다 — 이름표만 보면 남의 구역 답을 얹는다 */
      var k = picks[자리이름(s)];
      if (!k || k === 'none') return;
      if (KEYS.indexOf(k) < 0) return;
      s.guess = k; s.ai = true; n++;
    });
    return n;
  }

  var api = { KEYS: KEYS, MEANING: 뜻, scrub: scrub, rowsOf: rowsOf,
              skeleton: skeleton, skeletonAll: skeletonAll, buildPrompt: buildPrompt,
              parseReply: parseReply, mergeInto: mergeInto };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerSlotAi = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
