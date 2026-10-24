/* 푸른 캘린더 › 캡처·말로 일정 채우기 — 순수 모듈 (2026-10-15)
   ────────────────────────────────────────────────────────────────────────
   대표 지시 2026-10-15 「폰에서 내용 저장할 때 화면 캡처를 넣으면 장소·주소·시간 등을 자동으로
   넣을 수 있게」 · 「폰에서 말로 시간·장소 등 미팅 관련 사항을 저장하고 싶다」.

   ★ 캡처(사진)와 말(글자)은 «같은 엔진»이다 — 입력 → AI 가 일정 «초안»(JSON) → 사람이 눈으로 확인 → 저장.
   ★ 이 모듈은 «저장하지 않는다.» 초안을 새 일정 창(S.modal)의 칸에 채울 뿐이고,
     저장은 pu-cal.html 의 doSave() 가 한다(구글 공용 달력 길 그대로 — 마감·권한 관문도 그대로).
     ⚠ AI 가 읽은 값을 곧바로 저장하지 말 것. 시간·주소가 한 글자만 틀려도 미팅을 놓친다.
   ★ AI 의 답은 «남이 적은 글»이다 — 날짜·시각 꼴을 직접 다시 검사하고, 모르는 칸은 비워 둔다.
     못 찾은 칸을 «지어내 채우지» 않고 대표에게 «무엇을 확인해야 하는지» 말한다(missing·warns).
   ★ 서버는 새로 만들지 않았다 — 기존 판독 창구(readDoc)를 js/pu-ai-call.js 로 부른다
     (로그인 확인 · 이번 달 AI 한도 · 앱별 셈이 이미 붙어 있다. 앱 이름은 'cal').

   ⚠ 사진은 «보내기 전에» 줄인다(폰 캡처는 크다) — 저장하지 않고 메모리에서만 쓴다.
   ⚠ 글자(말)는 보내기 전에 주민등록번호 꼴을 가린다. 사진 속 번호는 프롬프트로 «옮기지 말라»고 막는다.

   tests/cal-capture.test.js 가 실제로 돌려 본다. */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuCalCapture = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  /* 서버(functions/doc-read.js APPS)의 앱 이름 — 사용량 셈이 «푸른캘린더» 칸으로 따로 쌓인다 */
  var APP = 'cal';

  var LIMIT = { title: 100, place: 200, contact: 80, note: 600, check: 80, checks: 5, drafts: 5, text: 2000, images: 3 };

  function s(v) { return v == null ? '' : String(v); }
  /* 제어문자를 걷고 한 줄로 — 칸에 들어가는 글은 «남이 적은 글»이다 */
  function oneLine(v, n) { return s(v).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
  function multiLine(v, n) {
    return s(v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, ' ')
      .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
  }

  /* 진짜 있는 날인가 — 2026-02-31 같은 것은 걸러야 한다(날짜 칸이 조용히 다음 달로 넘어간다) */
  function realDate(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s(ymd));
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  var WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  function weekdayKo(ymd) {
    if (!realDate(ymd)) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    return WEEK[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()];
  }

  /* 시각 → "HH:MM". 못 알아보면 "" (지어내지 않는다) */
  function hm(v) {
    var m = /^(\d{1,2})(?::(\d{2}))?(?::\d{2})?$/.exec(s(v).trim());
    if (!m) return '';
    var h = +m[1], mi = m[2] == null ? 0 : +m[2];
    if (h > 23 || mi > 59) return '';
    return ('0' + h).slice(-2) + ':' + ('0' + mi).slice(-2);
  }
  /* 주민등록번호 꼴(생년월일 6 + 성별 1~4 시작 7자리)을 가린다 — 말로 읽어 준 것까지 */
  function scrubText(text) {
    /* ⚠ 뒤돌아보기(?<!…)는 쓰지 않는다 — 오래된 아이폰 사파리에서 «파일 전체»가 안 읽힌다 */
    return s(text).replace(/(^|\D)\d{6}\s*[-–]?\s*[1-4]\d{6}(?!\d)/g, '$1(주민번호 가림)');
  }

  /* ══ 프롬프트 ═══════════════════════════════════════════════════════════
     오늘 날짜·요일을 «함께» 준다 — 「내일」「다음 주 화요일」을 AI 가 계산해야 하는데 오늘을 모르면
     틀린 날을 자신 있게 답한다. 대화 캡처는 «보낸 날»이 기준이라 그것도 말해 둔다. */
  var SCHEMA = '{"events":[{"title":"일정 제목","date":"YYYY-MM-DD","endDate":"","time":"HH:MM","endTime":"",'
    + '"place":"장소 이름(건물·업체)","address":"도로명 또는 지번 주소","contact":"이름 · 전화번호",'
    + '"note":"준비물·안건 한두 줄","check":["확신이 없는 점"]}],"unreadable":""}';

  function rules(today) {
    var wd = weekdayKo(today);
    return [
      '오늘은 ' + today + (wd ? '(' + wd + '요일)' : '') + '입니다.',
      '위 내용에서 «일정(약속·미팅·방문·회의)»을 뽑아 아래 JSON 한 덩어리로만 답하십시오. 설명·인사·코드블록은 쓰지 않습니다.',
      SCHEMA,
      '규칙:',
      '1. 보이지 않거나 모르는 값은 빈 문자열("")로 둡니다. 추측하거나 지어내지 않습니다.',
      '2. 날짜는 YYYY-MM-DD 입니다. 「내일」「모레」「다음 주 화요일」은 오늘 기준으로 계산합니다.'
        + ' 단 카카오톡 같은 대화 캡처에 날짜 구분선(예: 2026년 10월 14일 수요일)이 보이면 그 메시지가 온 날을 기준으로 계산합니다.',
      '3. 연도가 없으면 오늘 이후로 가장 가까운 날로 봅니다.',
      '4. 시각은 24시간 HH:MM 입니다(오후 3시 → 15:00). 말풍선 옆에 찍힌 «보낸 시각»은 약속 시각이 아닙니다 — 약속 시각이 따로 적혀 있을 때만 time 에 적습니다.',
      '5. 장소 이름(건물·업체)은 place, 주소는 address 에 나눠 적습니다. 화상회의면 링크를 place 에 그대로 적습니다.',
      '6. 전화번호는 contact 에 「이름 · 전화번호」로 적습니다.',
      '7. 일정이 여럿이면 events 에 하나씩 담고, 일정이 아니면 events 는 빈 배열로 두고 unreadable 에 이유를 한 줄로 적습니다.',
      '8. 글씨가 흐리거나 날짜·시각이 애매하면 check 에 «무엇이 확실하지 않은지»를 짧게 적습니다.',
      '9. 주민등록번호·계좌번호·비밀번호·카드번호는 어디에도 옮겨 적지 않습니다.'
    ].join('\n');
  }
  function promptForImage(today) {
    return '이것은 휴대폰 화면 캡처(문자·카카오톡·메일·공지 등)입니다.\n' + rules(today);
  }
  function promptForText(today, text) {
    return '아래는 사람이 말한 내용을 받아 적은 글입니다. 받아쓰기 오류(숫자·업체 이름·지명)가 있을 수 있으니 확실하지 않으면 check 에 적으십시오.\n'
      + rules(today) + '\n\n--- 말한 내용 ---\n' + text;
  }

  /* 📥 받은 메일 한 통 — 일정 후보함(서버)이 쓴다 (2026-10-24).
     mail: { from:'이름 <주소>', subject, ymd:'받은 날 YYYY-MM-DD', text:'본문 앞부분' }
     ★ 「내일」「다음 주 화요일」은 «메일을 받은 날»이 기준이다(오늘이 아니다) — 며칠 지난 메일을 지금 읽어도 날이 맞게.
     ★ 제출 마감·참석 요청도 일정이다(종일). 광고·뉴스·단순 안내처럼 «날짜가 걸린 할 일»이 없으면 events 는 빈 배열. */
  function promptForMail(today, mail) {
    mail = mail || {};
    var base = realDate(mail.ymd) ? mail.ymd : today;
    var wd = weekdayKo(base);
    return '아래는 받은 메일 한 통입니다. 보낸 사람 · 제목 · 본문 앞부분이 있고, 메일을 받은 날은 ' + base + (wd ? '(' + wd + '요일)' : '') + '입니다.\n'
      + '이 메일에서 «받는 사람이 챙겨야 할 일정»(참석할 행사·회의·방문, 제출·회신 마감)만 뽑으십시오. 날짜가 걸린 할 일이 없으면 events 는 빈 배열입니다.\n'
      + rules(today)
      + '\n10. 메일 속 「내일」「다음 주」 같은 말은 메일을 받은 날(' + base + ') 기준으로 계산합니다.'
      + '\n11. 보낸 사람이 담당자입니다 — contact 는 「이름 · 전화번호」로 적고, 본문에 전화번호가 없으면 「이름 · 이메일」로 적습니다.'
      + '\n12. 제출·회신 마감은 time 을 비우고 title 앞에 「[마감]」을 붙입니다.'
      + '\n13. 날짜가 바뀌었다는 안내(예: 29일에서 30일로 변경)는 «바뀐 날짜»만 일정으로 뽑고, 바뀐 사실은 note 에 적습니다.'
      + '\n\n--- 보낸 사람 ---\n' + s(mail.from) + '\n--- 제목 ---\n' + s(mail.subject) + '\n--- 본문 ---\n' + s(mail.text);
  }

  /* ══ AI 답 → 걸러낸 초안 ════════════════════════════════════════════════ */
  /* 답에서 JSON 을 꺼낸다 — 코드블록 껍데기·앞뒤 군말이 붙어도 중괄호 구간만 잘라 본다 */
  function parseJson(raw) {
    if (raw && typeof raw === 'object') return raw;
    var t = s(raw).replace(/```json|```/g, '').trim();
    if (!t) return null;
    try { return JSON.parse(t); } catch (_) { /* 아래에서 구간으로 다시 */ }
    var a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { /* 못 읽음 */ } }
    a = t.indexOf('['); b = t.lastIndexOf(']');
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { /* 못 읽음 */ } }
    return null;
  }

  function oneDraft(e, today) {
    e = (e && typeof e === 'object') ? e : {};
    var warns = [];
    var title = oneLine(e.title, LIMIT.title);
    var date = realDate(e.date) ? s(e.date) : '';
    var endDate = realDate(e.endDate) && date && e.endDate > date ? s(e.endDate) : '';
    var time = hm(e.time);
    var endTime = hm(e.endTime);
    /* 같은 날 안에서 끝이 시작보다 이르거나 같으면 AI 가 헷갈린 것이다 — 끝 시각을 버린다(저장 관문도 막는다) */
    if (endTime && time && !endDate && endTime <= time) { endTime = ''; warns.push('끝 시각이 시작보다 이르거나 같아 비웠습니다'); }
    if (endTime && !time) endTime = '';

    var name = oneLine(e.place, LIMIT.place), addr = oneLine(e.address, LIMIT.place);
    var place = name;
    if (addr) {
      if (!name) place = addr;
      else if (name.indexOf(addr) >= 0) place = name;
      else if (addr.indexOf(name) >= 0) place = addr;
      else place = (name + ' ' + addr).slice(0, LIMIT.place);
    }
    var contact = oneLine(e.contact, LIMIT.contact);
    var note = multiLine(scrubText(e.note), LIMIT.note);

    var missing = [];
    if (!title) missing.push('제목');
    if (!date) missing.push('날짜');
    if (!time) missing.push('시간');
    if (!place) missing.push('장소');
    if (date && today) {
      if (date < today) warns.push('지난 날짜(' + date + ')입니다 — 연도를 확인하세요');
      else if (date > addYears(today, 2)) warns.push('먼 날짜(' + date + ')입니다 — 연도를 확인하세요');
    }
    (Array.isArray(e.check) ? e.check : []).slice(0, LIMIT.checks).forEach(function (c) {
      var x = oneLine(c, LIMIT.check); if (x) warns.push('AI 가 확신 못 함: ' + x);
    });
    return { title: title, date: date, endDate: endDate, time: time, endTime: endTime, place: place, contact: contact, note: note, missing: missing, warns: warns };
  }
  function addYears(ymd, n) {
    var m = /^(\d{4})(-\d{2}-\d{2})$/.exec(s(ymd));
    return m ? (+m[1] + n) + m[2] : '9999-12-31';
  }
  /* 아무것도 못 건진 껍데기(제목도 날짜도 장소도 없다)는 초안이 아니다 */
  function hasSubstance(d) { return !!(d.title || d.date || d.place || d.time); }

  /* 돌려주는 것: { ok:true, drafts:[…], unreadable } | { ok:false, why } */
  function normalize(raw, today) {
    var j = parseJson(raw);
    if (j == null) return { ok: false, why: 'AI 가 일정 모양으로 답하지 않았습니다 — 다시 시도하거나 직접 적어 주세요' };
    var list = Array.isArray(j) ? j : (Array.isArray(j.events) ? j.events : (j.title || j.date ? [j] : []));
    var drafts = list.slice(0, LIMIT.drafts).map(function (e) { return oneDraft(e, today); }).filter(hasSubstance);
    return { ok: true, drafts: drafts, unreadable: oneLine(j && j.unreadable, 120) };
  }

  /* ══ 새 일정 창(S.modal)에 채운다 ═══════════════════════════════════════
     ⚠ 저장하지 않는다. 못 찾은 칸은 «건드리지 않고» 알린다 — 단 시간만은 예외:
       열 때 깔아 둔 «다음 정각»은 지어낸 값이라, 못 찾았으면 «종일»로 돌려놓고 알린다
       (틀린 시각으로 저장되는 것보다 종일로 눈에 띄는 쪽이 덜 위험하다). */
  function applyDraft(m, d) {
    var filled = [], warns = (d.warns || []).slice();
    if (!m || !d) return { filled: filled, warns: warns };
    if (d.title) { m.title = d.title; filled.push('제목'); }
    if (d.date) { m.date = d.date; m.endDate = d.endDate && d.endDate > d.date ? d.endDate : d.date; filled.push('날짜'); }
    else warns.push('날짜를 못 찾았습니다 — 지금 골라 둔 날(' + (m.date || '없음') + ') 그대로입니다');
    if (d.time) { m.timed = true; m.time = d.time; m.endTime = d.endTime || ''; filled.push('시간'); }
    else { m.timed = false; m.time = ''; m.endTime = ''; warns.push('시간을 못 찾아 «종일»로 두었습니다 — 시간이 있으면 직접 넣으세요'); }
    if (d.place) { m.place = d.place; filled.push('장소'); }
    else warns.push('장소를 못 찾았습니다');
    if (d.contact) { m.contact = d.contact; filled.push('담당자'); }
    if (d.note) {
      /* 두 번째 캡처가 첫 캡처의 메모에 «덧붙지» 않게 — 내가 넣은 메모면 갈아 끼우고, 사람이 적은 메모면 아래에 덧붙인다 */
      m.note = (!m.note || m.note === m.capNote) ? d.note : (m.note + '\n' + d.note);
      m.capNote = d.note;
      filled.push('설명');
    }
    if (!d.title) warns.unshift('제목을 못 찾았습니다 — 직접 적어 주세요');
    m.capWarn = warns;
    return { filled: filled, warns: warns };
  }

  /* 초안 한 줄 요약 — 여러 건일 때 고르는 단추 글 */
  function summary(d) {
    var when = d.date ? d.date.slice(5).replace('-', '/') + (d.time ? ' ' + d.time : '') : '날짜 미상';
    return when + ' · ' + (d.title || d.place || '제목 없음');
  }

  /* ══ AI 부르기 ══════════════════════════════════════════════════════════
     deps: { ai: PuAiCall, auth, fetch?, today:'YYYY-MM-DD', manual?: true }
     ⚠ 처음엔 manual 없이 부른다 — 이번 달 AI 한도에 걸리면 서버가 막고(overBudget),
       화면이 「그래도 읽을까요?」를 물은 뒤에만 manual:true 로 다시 부른다(대표 결정 ⓵㉮). */
  function friendly(e) {
    var st = e && e.status;
    if (e && e.overBudget) return { overBudget: true, why: s(e.message) };
    if (st === 401 || st === 403) return { why: '로그인을 확인해 주세요' };
    if (st === 429) return { why: '지금 AI 가 바쁩니다 — 잠시 뒤 다시 눌러 주세요' };
    return { why: s((e && e.message) || 'AI 를 부르지 못했습니다') };
  }
  function ask(parts, deps) {
    var ai = deps && deps.ai;
    if (!ai || !ai.ask) return Promise.resolve({ ok: false, why: '판독 준비가 되지 않았습니다' });
    /* freeFirst:false — 대화 캡처는 «누가 언제 말했나»가 뜻이라 서버가 사진을 글자로 갈음하면 안 된다 */
    return ai.ask(parts, { auth: deps.auth, fetch: deps.fetch, app: APP, manual: deps.manual === true, freeFirst: false,
      generationConfig: { temperature: 0, maxOutputTokens: 1500 } })
      .then(function (reply) { return normalize(ai.textOf(reply), deps.today); })
      .catch(function (e) { var f = friendly(e); f.ok = false; return f; });
  }
  /* images: dataURL(이미 줄인 것) 배열 */
  function readImages(images, deps) {
    var list = (Array.isArray(images) ? images : [images]).filter(Boolean).slice(0, LIMIT.images);
    if (!list.length) return Promise.resolve({ ok: false, why: '읽을 사진이 없습니다' });
    var parts = [{ text: promptForImage(deps.today) }];
    for (var i = 0; i < list.length; i++) {
      var str = s(list[i]), mt = (/^data:([^;,]+)/.exec(str) || [])[1] || 'image/jpeg';
      var b64 = str.indexOf(',') >= 0 ? str.slice(str.indexOf(',') + 1) : str;
      if (b64) parts.push({ inline_data: { mime_type: mt, data: b64 } });
    }
    if (parts.length < 2) return Promise.resolve({ ok: false, why: '읽을 사진이 없습니다' });
    return ask(parts, deps);
  }
  function readText(text, deps) {
    var t = scrubText(s(text)).trim().slice(0, LIMIT.text);
    if (!t) return Promise.resolve({ ok: false, why: '말하거나 적은 내용이 없습니다' });
    return ask([{ text: promptForText(deps.today, t) }], deps);
  }

  /* ══ 사진 줄이기 (브라우저 전용) ════════════════════════════════════════
     폰 캡처는 PNG 로 수 MB 다. 긴 변 1600px · JPEG 로 줄여 보낸다(속도·요금).
     ⚠ 저장하지 않는다 — 돌려주는 dataURL 은 부르는 쪽이 읽고 버린다. */
  function shrinkImage(file, maxSide, quality) {
    maxSide = maxSide || 1600; quality = quality || 0.85;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(s(file.type))) { reject(new Error('사진 파일이 아닙니다')); return; }
      if (typeof root.document === 'undefined' || !root.URL || !root.URL.createObjectURL) { reject(new Error('이 브라우저에서는 사진을 줄일 수 없습니다')); return; }
      var url = root.URL.createObjectURL(file), img = new root.Image();
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxSide / Math.max(w, h));
          var c = root.document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality));
        } catch (e) { reject(e); }
        finally { root.URL.revokeObjectURL(url); }
      };
      img.onerror = function () { root.URL.revokeObjectURL(url); reject(new Error('사진을 열 수 없습니다')); };
      img.src = url;
    });
  }

  /* ══ 말 듣기 — 브라우저 음성 인식(SpeechRecognition) 감싸기 ═══════════════
     Rec 를 주입받아 검사에서 가짜로 돌려 볼 수 있다.
     h: { onText(글, 끝났나), onEnd(), onError(안내글) }   돌려주는 것: { stop() } | null(지원 안 함)
     ⚠ 안 되는 기기(아이폰 홈 화면 앱 등)는 null — 부르는 쪽이 «키보드의 🎤» 안내로 물러선다. */
  var ERR_KO = {
    'not-allowed': '마이크 권한이 꺼져 있습니다 — 브라우저 설정에서 허용하거나, 키보드의 🎤 버튼으로 말해 주세요',
    'service-not-allowed': '이 기기에서는 음성 인식을 쓸 수 없습니다 — 키보드의 🎤 버튼으로 말해 주세요',
    'no-speech': '말씀이 들리지 않았습니다 — 다시 눌러 말해 주세요',
    'audio-capture': '마이크를 찾지 못했습니다',
    'network': '음성 인식 서비스에 연결하지 못했습니다 — 키보드의 🎤 버튼으로 말해 주세요',
    'aborted': ''
  };
  function speechSupported(Rec) { return !!(Rec || root.SpeechRecognition || root.webkitSpeechRecognition); }
  function listen(h, Rec) {
    Rec = Rec || root.SpeechRecognition || root.webkitSpeechRecognition;
    h = h || {};
    if (!Rec) return null;
    var r = new Rec();
    r.lang = 'ko-KR'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    r.onresult = function (ev) {
      var txt = '', fin = true;
      for (var i = 0; i < ev.results.length; i++) {
        var res = ev.results[i];
        txt += (res[0] && res[0].transcript) || '';
        if (!res.isFinal) fin = false;
      }
      if (h.onText) h.onText(txt.trim(), fin);
    };
    r.onerror = function (ev) {
      var code = s(ev && ev.error);
      var msg = Object.prototype.hasOwnProperty.call(ERR_KO, code) ? ERR_KO[code] : '음성 인식에 실패했습니다 (' + code + ')';
      if (msg && h.onError) h.onError(msg);
    };
    r.onend = function () { if (h.onEnd) h.onEnd(); };
    try { r.start(); } catch (e) { if (h.onError) h.onError('음성 인식을 시작하지 못했습니다'); return null; }
    return { stop: function () { try { r.stop(); } catch (_) { /* 이미 멈춤 */ } } };
  }

  /* 말로 받은 조각을 이어 붙인다 — 이미 있는 글 뒤에 한 칸 띄워 */
  function joinText(a, b) { a = s(a).trim(); b = s(b).trim(); return a && b ? a + ' ' + b : (a || b); }

  return {
    APP: APP, LIMIT: LIMIT,
    realDate: realDate, weekdayKo: weekdayKo, hm: hm, scrubText: scrubText,
    promptForImage: promptForImage, promptForText: promptForText, promptForMail: promptForMail,
    parseJson: parseJson, normalize: normalize, applyDraft: applyDraft, summary: summary,
    readImages: readImages, readText: readText, shrinkImage: shrinkImage,
    speechSupported: speechSupported, listen: listen, joinText: joinText, friendly: friendly
  };
});
