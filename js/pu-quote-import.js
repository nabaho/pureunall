/* ══ 보낸메일에서 지난 견적·계약 가져오기 — 한 번 채우기 (견적·계약 자동화 계획 1 · 작업 7) ══
   ■ 보낸메일함(mailbox/msgs/{Sent Messages-…})에서 «우리 견적서·계약서» 메일을 골라, 첨부 하나를 받아 🔒 보관함에 두고
     글자를 뽑아 AI 가 금액·기간·과업·인원을 읽게 한 뒤 「지난 견적·계약」 기록(pu_quotes·pu_quote_amt)에 넣는다.
   ■ 지키는 것
     ⓐ 같은 메일은 두 번 넣지 않는다 — srcKey(= 폴더|메일 열쇠)로 건너뛴다(다시 눌러도 안전).
     ⓑ AI 가 하루 한도에 걸리면 «그 자리에서 멈춘다» — 이미 넣은 건은 그대로, 남은 건수를 알린다.
     ⓒ 금액을 못 읽었으면 기록은 남기되 review:'check'(「확인 필요」) — 0원으로 채우지 않는다.
     ⓓ 글자만 AI 로 보낸다 — 사진·PDF 원본을 그대로 보내지 않는다. 주민번호는 PuDocRead.readTextWithPrompt 가 한 번 더 지운다.
        글자를 못 뽑은 파일(스캔본·암호 파일)은 AI 를 부르지 않고 「확인 필요」 로 남긴다 — 직원이 채운다.
     ⓔ 저장 권한이 없으면(규칙 게시 전) 그 자리에서 멈춘다 — 건마다 AI 요금을 쓰고 저장은 계속 거절되는 일을 막는다.
     ⓕ 첨부를 받는 길(readMailAttachment)은 «몇 번째 첨부»만 받는다. 메일 줄에는 이름이 최대 5개·60자로 잘려 있고
        서버의 첨부 번호와 순서가 다를 수 있다 → 받은 파일 이름이 기대한 이름과 같은지 보고, 다르면 다른 번호를 시도한다(host.fetchAtt).
   ■ 이 파일은 «판단»만 한다 — 메일·보관함·AI·저장 층은 host 가 넘긴다(그래서 시험이 가짜로 돌려 볼 수 있다). */
(function (w) {
  'use strict';

  var QUOTE_PROMPT = '이 문서는 푸른노무법인이 보낸 견적서 또는 계약서입니다. 아래 칸만 JSON 으로 답하세요. 문서에 없으면 빈 문자열.\n'
    + '{"의뢰처":"", "업무종류":"", "금액":"", "부가세":"포함|별도|", "기간":"", "과업내용":"", "직원수":""}\n'
    + '- 금액: 총액을 원 단위 숫자만(쉼표·원 빼고). 여러 안이면 첫 안.\n'
    + '- 과업내용: 150자 안으로 요약.\n'
    + '- 직원수: 의뢰처(고객사) 직원 수 숫자만.';

  var TEXT_MAX = 20000;                 /* AI 로 보내는 글자 상한 — 받는 만큼이 요금이다 */
  var EXCL_QUOTE = /비교\s*견적서?\s*(요청|작성|회신)|견적\s*(의뢰|요청)|상품\s*견적|루나랩/;
  var CONTRACT = /(자문|위임|용역|컨설팅|교육|위탁|대행)\s*계약서/;
  var NOT_CONTRACT = /근로계약서/;
  var DOC_EXT = /\.(pdf|hwp|hwpx)$/i;
  var NAME_CUT = 60;                    /* 메일 줄(an)의 첨부 이름은 60자에서 잘려 있다(functions/mail-box.js attNames) */
  var QUOTA = /한도|quota|429|RESOURCE_EXHAUSTED/i;
  var DENIED = /permission[_ ]denied/i;

  function s(v) { return String(v == null ? '' : v); }
  function nfc(v) { var t = s(v); return t.normalize ? t.normalize('NFC') : t; }

  /* 메일 줄의 첨부 이름 → 배열. 배열·«0,1,2» 열쇠 지도·JSON 글자 셋 다 받는다 */
  function namesOf(an) {
    var v = an;
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return []; } }
    if (v && !Array.isArray(v) && typeof v === 'object') v = Object.keys(v).sort(function (a, b) { return a - b; }).map(function (k) { return v[k]; });
    return Array.isArray(v) ? v.map(s).filter(Boolean) : [];
  }
  function joined(attNames) { return namesOf(attNames).join(' '); }

  /* 제목·첨부 이름에 «견적» — 단 남의 견적(비교견적 요청·견적 의뢰·물품 견적)은 제목으로 거른다 */
  function isOurQuote(subject, attNames) {
    var subj = s(subject);
    if (EXCL_QUOTE.test(subj)) return false;
    return /견적/.test(subj + ' ' + joined(attNames));
  }
  /* 「자문·위임·용역·컨설팅·교육·위탁·대행 계약서」 — 근로계약서는 아니다 */
  function isOurContract(subject, attNames) {
    var subj = s(subject);
    if (NOT_CONTRACT.test(subj)) return false;
    return CONTRACT.test(subj + ' ' + joined(attNames));
  }
  /* 한 메일이 견적도 계약서도 말하면 계약서가 이긴다(메일 하나에 기록 하나) */
  function docOf(subject, attNames) {
    if (isOurContract(subject, attNames)) return 'contract';
    if (isOurQuote(subject, attNames)) return 'quote';
    return '';
  }
  /* 이름이 60자에서 잘렸으면 확장자를 알 수 없다 — 받아 보고 정한다(지금은 후보로 둔다) */
  function okExt(name) { return DOC_EXT.test(name) || name.length >= NAME_CUT; }

  /* 받을 첨부 하나 — 문서 종류에 맞는 이름(견적/계약서)을 먼저, «푸른» 이 든 것을 먼저. 없으면 -1.
     이름이 맞는 것이 없어도 pdf·hwp·hwpx 가 있으면 그 첫 번째를 쓴다(제목이 견적이라는 말인데 첨부 이름만 다른 경우) */
  function pickAtt(attNames, doc) {
    var names = namesOf(attNames);
    var list = names.map(function (n, i) { return { n: n, i: i }; }).filter(function (x) { return okExt(x.n); });
    if (!list.length) return -1;
    var re = doc === 'contract' ? /계약서/ : /견적/;
    var named = list.filter(function (x) { return re.test(x.n); });
    var pool = named.length ? named : list;
    var mine = pool.filter(function (x) { return /푸른/.test(x.n); });
    return (mine[0] || pool[0]).i;
  }

  /* 받아 둔 메일 줄들 → 가져올 후보. 최근 것이 먼저(한도에 걸려 멈추면 최근 것이 들어가 있게).
     msg 칸: s 제목 · d 시각(ms) · t 받는 주소 · tn 받는 이름 · an 첨부 이름 · a 첨부 수 · u IMAP 번호 */
  function candidates(msgs, slug) {
    var out = [];
    Object.keys(msgs || {}).forEach(function (key) {
      var m = msgs[key] || {};
      var names = namesOf(m.an), doc = docOf(m.s, names);
      if (!doc) return;
      var uid = /^\d+$/.test(s(m.u)) && Number(m.u) > 0 ? s(m.u) : '';
      var idx = uid ? pickAtt(names, doc) : -1;      /* 번호를 모르면 첨부를 받을 수 없다 — 기록만 */
      out.push({ slug: s(slug), key: s(key), uid: uid, subject: s(m.s), date: Number(m.d) || 0,
        to: s(m.t).split(',')[0], toName: s(m.tn), doc: doc,
        attIndex: idx, attName: idx >= 0 ? names[idx] : '', attCount: Number(m.a) || names.length,
        srcKey: s(slug) + '|' + s(key) });
    });
    return out.sort(function (a, b) { return b.date - a.date; });
  }

  /* AI 답의 «금액» → 숫자 또는 null. 숫자만 받는다(「400만원」 같은 글은 못 읽은 것으로 — 추측하지 않는다) */
  function moneyOf(v) {
    var n = typeof v === 'number' ? v : (/^\d+$/.test(s(v).replace(/[,\s원₩]/g, '')) ? Number(s(v).replace(/[,\s원₩]/g, '')) : NaN);
    return isFinite(n) && n > 0 && n <= 1e11 ? Math.round(n) : null;
  }
  function vatOf(v) { var t = s(v); return /별도/.test(t) ? 'excl' : (/포함/.test(t) ? 'incl' : ''); }
  function staffOf(v) { var t = s(v).replace(/[,\s명]/g, ''); return /^\d{1,6}$/.test(t) ? Number(t) : undefined; }
  function domainOf(addr) { var m = /@([^@\s>]+)/.exec(s(addr)); return m ? m[1] : ''; }
  function trim(v) { return s(v).replace(/\s+/g, ' ').trim(); }

  /* 후보 + AI 답(없으면 null) → {rec, amt|null}.
     금액이 숫자가 아니면 amt 는 null · review 'check'. 의뢰처는 AI → 받는 이름 → 받는 주소의 도메인 순. */
  function toRecord(c, fields, fileId, now) {
    var f = fields || {};
    var Q = w.PuQuotes;
    var amount = moneyOf(f.금액);
    var type = Q.typeOf(f.업무종류);
    if (!f.업무종류 || type === 'other') type = Q.typeOf(c.subject + ' ' + c.attName);
    var rec = { doc: c.doc, type: type, co: trim(f.의뢰처) || trim(c.toName) || domainOf(c.to),
      date: Q.dateOf(c.date || now), review: amount != null ? 'ok' : 'check',
      src: { how: 'mail', slug: c.slug, key: c.key }, srcKey: c.srcKey };
    if (trim(f.과업내용)) rec.scope = trim(f.과업내용);
    if (trim(f.기간)) rec.period = trim(f.기간);
    var st = staffOf(f.직원수); if (st !== undefined) rec.staff = st;
    if (fileId) rec.fileId = fileId;
    if (c.ownerGuess) rec.ownerGuess = c.ownerGuess;
    return { rec: rec, amt: amount != null ? { amount: amount, vat: vatOf(f.부가세), owner: '' } : null };
  }

  function shortSubject(t) { t = trim(t); return t.length > 40 ? t.slice(0, 40) + '…' : t; }

  /* 하나씩 가져온다.
     host: { have(srcKey)→Promise<bool> · fetchAtt(c)→Promise<{name,type,bytes}> · store(file, c)→Promise<fileId>
             extractText(bytes, name)→Promise<string> · readText(prompt, text)→Promise<{ok,data,why}>
             save(rec, amt)→Promise<qid> · log(kind, o) · now()→ms }
     돌려주는 것: { done, skipped, failed, left, check, stopped? } */
  function runImport(list, host, onStep) {
    list = list || [];
    var res = { done: 0, skipped: 0, failed: 0, left: 0, check: 0 };
    var step = typeof onStep === 'function' ? onStep : function () {};
    var now = typeof host.now === 'function' ? host.now : Date.now;

    function stop(i, why) { res.left = list.length - i; res.stopped = why; return res; }

    function one(i) {
      if (i >= list.length) return Promise.resolve(res);
      var c = list[i];
      step((i + 1) + '/' + list.length + ' · ' + shortSubject(c.subject));
      return Promise.resolve(host.have(c.srcKey)).then(function (have) {
        if (have) { res.skipped++; return one(i + 1); }
        return prepare(c).then(function (p) {
          if (p.stop) return stop(i, p.stop);
          if (p.fail) { res.failed++; return one(i + 1); }
          var out = toRecord(c, p.fields, p.fileId, now());
          return Promise.resolve(host.save(out.rec, out.amt)).then(function (qid) {
            res.done++;
            if (out.rec.review === 'check') res.check++;
            if (typeof host.log === 'function') host.log('auto_detect', { target: s(qid), note: shortSubject(c.subject), auto: '보낸메일 가져오기' });
            return one(i + 1);
          }, function (e) {
            var msg = (e && e.message) || s(e);
            if (DENIED.test(msg)) return stop(i, '저장 권한이 없습니다 — 새 규칙(pu_quotes·pu_quote_amt)이 아직 게시되지 않았을 수 있습니다');
            res.failed++; return one(i + 1);
          });
        });
      });
    }

    /* 첨부 받기 → 🔒 저장 → 글자 뽑기 → AI. 돌려주는 것: {fields, fileId} | {fail:true} | {stop:'까닭'} */
    function prepare(c) {
      if (c.attIndex < 0) return Promise.resolve({ fields: null, fileId: '' });   /* 첨부가 없다 — 기록만(확인 필요) */
      return Promise.resolve().then(function () { return host.fetchAtt(c); }).then(function (a) {
        return Promise.resolve(host.store({ name: a.name, size: a.bytes.length, type: a.type || '', bytes: a.bytes }, c)).then(function (fileId) {
          return Promise.resolve(host.extractText(a.bytes, a.name)).then(function (t) { return trim(t) ? s(t).trim() : ''; }, function () { return ''; })
            .then(function (text) {
              if (!text) return { fields: null, fileId: fileId };       /* 글자를 못 뽑았다 — AI 를 부르지 않는다 */
              return Promise.resolve(host.readText(QUOTE_PROMPT, text.slice(0, TEXT_MAX))).then(function (r) {
                if (r && r.ok && r.data && typeof r.data === 'object') return { fields: r.data, fileId: fileId };
                var why = (r && r.why) || '';
                if (QUOTA.test(why)) return { stop: why };
                return { fields: null, fileId: fileId };                  /* 그 밖의 실패 — 기록은 남기고 확인 필요 */
              });
            });
        });
      }).catch(function (e) {
        var msg = (e && e.message) || s(e);
        if (DENIED.test(msg)) return { stop: '저장 권한이 없습니다 — 보관함(pu_docs) 규칙을 확인해 주세요' };
        if (QUOTA.test(msg)) return { stop: msg };                  /* AI 가 한도 오류를 «던지는» 경우도 멈춘다 */
        return { fail: true };
      });
    }
    return one(0);
  }

  w.PuQuoteImport = { QUOTE_PROMPT: QUOTE_PROMPT, TEXT_MAX: TEXT_MAX, NAME_CUT: NAME_CUT, isOurQuote: isOurQuote, isOurContract: isOurContract,
    docOf: docOf, pickAtt: pickAtt, namesOf: namesOf, candidates: candidates, toRecord: toRecord, runImport: runImport, nfc: nfc };
})(typeof window !== 'undefined' ? window : this);
