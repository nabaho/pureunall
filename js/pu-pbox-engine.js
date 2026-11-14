/* P박스 핵심 법률 엔진 (법령 마크다운 파서 · 3단계 중복제거 · 하급심 비식별 수집 · 하이브리드 검색 · 인용 검증기)
 *
 * 브라우저(window.PuPBoxEngine)와 Node 검사(require('./js/pu-pbox-engine.js')) 양쪽에서 똑같이 동작한다.
 */
(function (global) {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
   * 1. 대한민국 법령 마크다운 파서 & 시행일 판별기
   * ══════════════════════════════════════════════════════════════ */
  function todayKstYmd(nowMs) {
    var t = (typeof nowMs === 'number' ? nowMs : Date.now()) + 9 * 3600 * 1000;
    return new Date(t).toISOString().slice(0, 10);
  }

  function unescapeMd(s) {
    return String(s || '')
      .replace(/(\d+)\\\./g, '$1.')
      .replace(/\\([()[\]*_~`])/g, '$1');
  }

  function parseYamlFrontmatter(raw) {
    var text = String(raw || '').replace(/\r\n/g, '\n');
    if (text.indexOf('---\n') !== 0) return { meta: {}, body: text };
    var end = text.indexOf('\n---\n', 4);
    if (end < 0) return { meta: {}, body: text };
    var yaml = text.slice(4, end);
    var body = text.slice(end + 5);
    var meta = { departments: [], attachments: [] };
    var lines = yaml.split('\n');
    var mode = '';
    var curAtt = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!line.trim()) continue;
      if (/^소관부처:\s*$/.test(line)) { mode = 'dept'; continue; }
      if (/^첨부파일:\s*\[\]/.test(line)) { mode = ''; continue; }
      if (/^첨부파일:\s*$/.test(line)) { mode = 'att'; continue; }

      if (mode === 'dept' && /^\s*-\s+/.test(line)) {
        meta.departments.push(line.replace(/^\s*-\s+/, '').trim().replace(/^['"]|['"]$/g, ''));
        continue;
      }
      if (mode === 'att' && /^\s*-\s+/.test(line)) {
        curAtt = {};
        meta.attachments.push(curAtt);
        var kv0 = line.replace(/^\s*-\s+/, '').split(':');
        if (kv0.length >= 2) {
          curAtt[kv0[0].trim()] = kv0.slice(1).join(':').trim().replace(/^['"]|['"]$/g, '');
        }
        continue;
      }
      if (mode === 'att' && curAtt && /^\s{2,}[가-힣A-Za-z]+:/.test(line)) {
        var idx = line.indexOf(':');
        var k = line.slice(0, idx).trim();
        var v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
        curAtt[k] = v;
        continue;
      }

      mode = '';
      var colon = line.indexOf(':');
      if (colon > 0) {
        var key = line.slice(0, colon).trim();
        var val = line.slice(colon + 1).trim().replace(/^['"]|['"]$/g, '');
        if (key === '제목') meta.title = val;
        else if (key === '법령MST') meta.mst = val;
        else if (key === '법령ID') meta.lawId = val;
        else if (key === '법령구분') meta.lawKind = val;
        else if (key === '공포일자') meta.promulgationDate = val;
        else if (key === '공포번호') meta.promulgationNo = val;
        else if (key === '시행일자') meta.effectiveDate = val;
        else if (key === '상태') meta.status = val;
        else if (key === '출처') meta.sourceUrl = val;
      }
    }
    return { meta: meta, body: body };
  }

  function effectiveState(effectiveDate, refTodayYmd) {
    var eff = String(effectiveDate || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eff)) {
      return { status: 'unknown', label: eff ? ('시행 ' + eff) : '시행일 정보 없음', daysUntil: 0 };
    }
    var today = refTodayYmd || todayKstYmd();
    if (eff <= today) {
      return { status: 'enforced', label: '현행 시행중 (' + eff + ' 시행)', daysUntil: 0 };
    }
    var d1 = Date.parse(today + 'T00:00:00Z');
    var d2 = Date.parse(eff + 'T00:00:00Z');
    var diff = Math.max(1, Math.round((d2 - d1) / 86400000));
    return { status: 'upcoming', label: '시행예정 D-' + diff + ' (' + eff + ' 시행)', daysUntil: diff };
  }

  function parseLawMarkdown(rawMd, fallbackMeta, refTodayYmd) {
    fallbackMeta = fallbackMeta || {};
    var parsed = parseYamlFrontmatter(rawMd);
    var meta = parsed.meta;
    var body = parsed.body;

    var lines = body.split('\n');
    var chapters = [];
    var articles = [];
    var addendaLines = [];
    var curChapter = '';
    var curArt = null;
    var inAddenda = false;

    for (var i = 0; i < lines.length; i++) {
      var rawLine = lines[i];
      var trimmed = rawLine.trim();

      if (/^##\s+부칙/.test(trimmed)) {
        if (curArt) {
          curArt.text = unescapeMd(curArt._lines.join('\n')).trim();
          delete curArt._lines;
          articles.push(curArt);
          curArt = null;
        }
        inAddenda = true;
        addendaLines.push(trimmed.replace(/^##\s+/, ''));
        continue;
      }

      if (inAddenda) {
        addendaLines.push(unescapeMd(rawLine));
        continue;
      }

      var chapMatch = /^##\s+(제\d+장[^\n]*)/.exec(trimmed);
      if (chapMatch) {
        curChapter = chapMatch[1].trim();
        chapters.push(curChapter);
        continue;
      }

      var artMatch = /^#{3,6}\s*(제\d+조(?:의\d+)?)\s*(?:\(([^)]*)\))?(.*)$/.exec(trimmed);
      if (artMatch) {
        if (curArt) {
          curArt.text = unescapeMd(curArt._lines.join('\n')).trim();
          delete curArt._lines;
          articles.push(curArt);
        }
        var artNo = artMatch[1].trim();
        var artHeading = (artMatch[2] || '').trim();
        var rest = (artMatch[3] || '').trim();
        curArt = {
          no: artNo,
          numKey: artNo.replace(/^제|조$/g, ''),
          heading: artHeading,
          chapter: curChapter,
          _lines: rest ? [rest] : []
        };
        continue;
      }

      if (curArt) {
        curArt._lines.push(rawLine);
      }
    }

    if (curArt) {
      curArt.text = unescapeMd(curArt._lines.join('\n')).trim();
      delete curArt._lines;
      articles.push(curArt);
    }

    var cleanFullBody = unescapeMd(body).trim();
    var isRepealStub = articles.length <= 1 && /이를\s*폐지한다/.test(cleanFullBody);
    var title = meta.title || fallbackMeta.title || fallbackMeta.dir || '법령';
    var effInfo = effectiveState(meta.effectiveDate, refTodayYmd);

    return {
      id: 'law-' + (meta.lawId || fallbackMeta.dir || title) + '-' + (fallbackMeta.fileName || 'main'),
      docType: 'law',
      dir: fallbackMeta.dir || title.replace(/\s+/g, ''),
      fileName: fallbackMeta.fileName || '법률.md',
      lawId: meta.lawId || '',
      mst: meta.mst || '',
      title: title,
      lawKind: meta.lawKind || fallbackMeta.lawKind || '법령',
      departments: (meta.departments && meta.departments.length) ? meta.departments : (fallbackMeta.dept ? [fallbackMeta.dept] : []),
      promulgationDate: meta.promulgationDate || '',
      promulgationNo: meta.promulgationNo || '',
      effectiveDate: meta.effectiveDate || '',
      effectiveState: effInfo,
      sourceUrl: meta.sourceUrl || ('https://www.law.go.kr/법령/' + encodeURIComponent(title)),
      attachments: meta.attachments || [],
      chapters: chapters,
      articles: articles,
      articleCount: articles.length,
      addenda: addendaLines.join('\n').trim(),
      isRepealStub: isRepealStub,
      plainText: cleanFullBody
    };
  }

  /* ══════════════════════════════════════════════════════════════
   * 2. 3단계 정밀 중복제거 엔진 (PBoxDedup)
   * ══════════════════════════════════════════════════════════════ */
  var COURT_ALIASES = [
    [/^대법원.*|^대법$/, '대법원'],
    [/^헌법재판소.*|^헌재$/, '헌법재판소'],
    [/^중앙노동위원회.*|^중노위$/, '중앙노동위원회'],
    [/^서울지방노동위원회.*|^서울지노위$/, '서울지방노동위원회'],
    [/^고용노동부.*|^노동부.*/, '고용노동부'],
    [/^법제처.*/, '법제처'],
    [/^근로복지공단.*/, '근로복지공단'],
    [/^국가인권위원회.*|^인권위$/, '국가인권위원회'],
    [/^개인정보보호위원회.*|^개보위$/, '개인정보보호위원회'],
    [/^중앙행정심판위원회.*|^국민권익위원회.*/, '중앙행정심판위원회']
  ];

  function normalizeCourt(raw) {
    var s = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!s) return '미상기관';
    for (var i = 0; i < COURT_ALIASES.length; i++) {
      if (COURT_ALIASES[i][0].test(s)) return COURT_ALIASES[i][1];
    }
    return s.replace(/\s+/g, '');
  }

  function normalizeCaseNo(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    /* 괄호 부기, '선고', '판결', '결정', '사건', 공백 제거 */
    s = s
      .replace(/\[[^\]]*\]/g, '')
      .replace(/\((?:전원합의체|전합|산재|본소|반소|재심|초심)[^)]*\)/g, '')
      .replace(/\b(?:선고|판결|결정|재결|판정|사건|회시)\b/g, '')
      .replace(/\s+/g, '');

    /* 법원·헌재·노동위 사건번호 패턴 우선 추출 */
    var mCourt = /((?:19|20)?\d{2}[가-힣]{1,4}\d{1,8})/.exec(s);
    if (mCourt) return mCourt[1];

    /* 행정해석 문서번호 패턴 (예: 임금근로시간과-2271, 근기68207-1234) */
    var mDoc = /([가-힣A-Za-z0-9]+-[0-9가-힣A-Za-z]+)/.exec(s);
    if (mDoc) return mDoc[1];

    return s.replace(/[^0-9A-Za-z가-힣-]/g, '');
  }

  function normalizeTitle(raw) {
    return String(raw || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^0-9a-z가-힣]/g, '');
  }

  function deterministicDocHash16(title, body) {
    var str = String(title || '').trim() + '|' + String(body || '').trim().slice(0, 600);
    var h1 = 0x811c9dc5;
    var h2 = 0x9e3779b9;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 ^= (c + ((i & 0xff) << 8));
      h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
    }
    return ('00000000' + h1.toString(16)).slice(-8) + ('00000000' + h2.toString(16)).slice(-8);
  }

  function canonicalKeyOf(doc) {
    if (!doc || typeof doc !== 'object') return '';
    if (doc.docType === 'law') {
      var lid = String(doc.lawId || doc.dir || normalizeTitle(doc.title));
      var eff = String(doc.effectiveDate || '0000-00-00');
      var fn = String(doc.fileName || '법률.md');
      return 'law|' + lid + '|' + fn + '|' + eff;
    }
    var cno = normalizeCaseNo(doc.caseNo || doc.docNo || '');
    if (cno) {
      var court = normalizeCourt(doc.court || doc.agency || '');
      return 'case|' + court + '|' + cno;
    }
    return '';
  }

  /* 서버(functions/pbox-sync.js)와 바이트 단위로 동일한 공유 저장소 canonical_key 산출 (무번호 문서 삭제 동기화용) */
  function serverCanonicalKeyOf(doc, ownerUid) {
    if (!doc || typeof doc !== 'object') return '';
    var court = normalizeCourt(doc.court || doc.agency || '');
    var cno = normalizeCaseNo(doc.caseNo || doc.case_no || doc.docNo || '');
    if (cno) return 'case|' + court + '|' + cno;
    var hash = deterministicDocHash16(doc.title, doc.body);
    var cleanOwner = String(ownerUid || '').trim();
    var ownerScope = (cleanOwner && cleanOwner !== 'guest' && cleanOwner !== 'system_sync')
      ? (cleanOwner.slice(0, 48) + '|')
      : '';
    return 'hash|' + ownerScope + court + '|' + hash;
  }

  function secondaryKeyOf(doc) {
    if (!doc || doc.docType === 'law') return '';
    var t = normalizeTitle(doc.title);
    var dt = String(doc.decisionDate || '').slice(0, 10);
    var org = normalizeCourt(doc.court || doc.agency || '');
    if (t && dt && org) return 'meta|' + org + '|' + dt + '|' + t;
    return '';
  }

  function buildShingles(text) {
    var clean = String(text || '')
      .replace(/【[^】]*】/g, '')
      .replace(/\s+/g, '')
      .replace(/[^0-9a-zA-Z가-힣]/g, '');
    var set = new Set();
    if (clean.length < 16) {
      if (clean) set.add(clean);
      return set;
    }
    var k = 5;
    var total = clean.length - k + 1;
    var step = total > 500 ? Math.floor(total / 500) : 1;
    for (var i = 0; i < total; i += step) {
      set.add(clean.slice(i, i + k));
    }
    return set;
  }

  function shingleSimilarity(textA, textB) {
    var a = buildShingles(textA);
    var b = buildShingles(textB);
    if (!a.size || !b.size) return 0;
    var inter = 0;
    a.forEach(function (sh) {
      if (b.has(sh)) inter++;
    });
    var union = a.size + b.size - inter;
    return union > 0 ? inter / union : 0;
  }

  function mergeTwoDocs(target, incoming, stageLabel) {
    var out = Object.assign({}, target);
    var srcSet = new Set([].concat(target.sources || [], incoming.sources || []).filter(Boolean));
    out.sources = Array.from(srcSet);

    var tagSet = new Set([].concat(target.tags || [], incoming.tags || []).filter(Boolean));
    out.tags = Array.from(tagSet);

    var lawSet = new Set([].concat(target.refLaws || [], incoming.refLaws || []).filter(Boolean));
    out.refLaws = Array.from(lawSet);

    var caseSet = new Set([].concat(target.refCases || [], incoming.refCases || []).filter(Boolean));
    out.refCases = Array.from(caseSet);

    if (String(incoming.body || '').length > String(target.body || '').length) {
      out.body = incoming.body;
    }
    if (String(incoming.summary || '').length > String(target.summary || '').length) {
      out.summary = incoming.summary;
    }
    if (!out.decisionDate && incoming.decisionDate) out.decisionDate = incoming.decisionDate;
    if (!out.caseNo && incoming.caseNo) out.caseNo = incoming.caseNo;
    if (incoming.verified) out.verified = true;

    out.dupMergedCount = (Number(target.dupMergedCount) || 0) + 1;
    out.lastMergedStage = stageLabel;
    return out;
  }

  function deduplicateDocs(existingDocs, incomingDocs, opts) {
    opts = opts || {};
    var simThreshold = typeof opts.similarityThreshold === 'number' ? opts.similarityThreshold : 0.92;
    var result = (Array.isArray(existingDocs) ? existingDocs : []).map(function (d) {
      return Object.assign({}, d);
    });

    var byCanonical = new Map();
    var bySecondary = new Map();

    function addSecondaryIdx(sk, idx) {
      if (!sk) return;
      var arr = bySecondary.get(sk);
      if (arr) arr.push(idx);
      else bySecondary.set(sk, [idx]);
    }

    for (var i = 0; i < result.length; i++) {
      var ck = canonicalKeyOf(result[i]);
      if (ck) byCanonical.set(ck, i);
      addSecondaryIdx(secondaryKeyOf(result[i]), i);
    }

    var stats = {
      incoming: Array.isArray(incomingDocs) ? incomingDocs.length : 0,
      added: 0,
      mergedStage1: 0,
      mergedStage2: 0,
      mergedStage3: 0,
      logs: []
    };

    var list = Array.isArray(incomingDocs) ? incomingDocs : [];
    for (var j = 0; j < list.length; j++) {
      var inc = list[j];
      if (!inc || typeof inc !== 'object') continue;

      /* 1단계: 정규화 사건번호·회시문서번호·법령시행일 키 대조 */
      var cKey = canonicalKeyOf(inc);
      if (cKey && byCanonical.has(cKey)) {
        var idx1 = byCanonical.get(cKey);
        result[idx1] = mergeTwoDocs(result[idx1], inc, 'stage1_canonical');
        stats.mergedStage1++;
        stats.logs.push({ stage: 1, key: cKey, title: inc.title || inc.caseNo });
        continue;
      }

      /* 2단계: 기관 + 선고/회시일자 + 정규화 제목 대조
       * 단, 양쪽 모두 명시적 사건·문서번호(canonicalKey)가 있는데 서로 다른 번호면 별개 사건이므로 병합하지 않는다 */
      var sKey = secondaryKeyOf(inc);
      var idx2 = -1;
      if (sKey && bySecondary.has(sKey)) {
        var sCands = bySecondary.get(sKey);
        for (var sc = 0; sc < sCands.length; sc++) {
          var candIdx = sCands[sc];
          var ckCand = canonicalKeyOf(result[candIdx]);
          if (cKey && ckCand && cKey !== ckCand) continue;
          idx2 = candIdx;
          break;
        }
      }
      if (idx2 >= 0) {
        result[idx2] = mergeTwoDocs(result[idx2], inc, 'stage2_meta_title');
        if (cKey) byCanonical.set(cKey, idx2);
        stats.mergedStage2++;
        stats.logs.push({ stage: 2, key: sKey, title: inc.title });
        continue;
      }

      /* 3단계: 본문 Shingle Jaccard 유사도(>= 0.92) 병합 (법령 연혁본끼리는 별개 보존) */
      var matchedIdx3 = -1;
      var incText = (inc.summary || '') + '\n' + (inc.body || '');
      if (inc.docType !== 'law' && incText.trim().length >= 60) {
        for (var r = 0; r < result.length; r++) {
          if (result[r].docType === 'law') continue;
          /* 사건번호가 서로 뚜렷이 다른 두 별개 사건은 본문 양식이 비슷해도 합치지 않는다 */
          var ckA = canonicalKeyOf(result[r]);
          if (cKey && ckA && cKey !== ckA) continue;
          var refText = (result[r].summary || '') + '\n' + (result[r].body || '');
          if (refText.trim().length < 60) continue;
          var sim = shingleSimilarity(incText, refText);
          if (sim >= simThreshold) {
            matchedIdx3 = r;
            break;
          }
        }
      }

      if (matchedIdx3 >= 0) {
        result[matchedIdx3] = mergeTwoDocs(result[matchedIdx3], inc, 'stage3_shingle');
        if (cKey) byCanonical.set(cKey, matchedIdx3);
        addSecondaryIdx(sKey, matchedIdx3);
        stats.mergedStage3++;
        stats.logs.push({ stage: 3, key: inc.caseNo || inc.title || 'shingle', title: inc.title });
        continue;
      }

      /* 신규 문서 추가 */
      var newIdx = result.length;
      var copy = Object.assign({}, inc);
      if (!copy.id) copy.id = 'doc-' + Date.now() + '-' + j;
      if (!Array.isArray(copy.sources) || !copy.sources.length) {
        copy.sources = [copy.source || '수집 문서'];
      }
      result.push(copy);
      if (cKey) byCanonical.set(cKey, newIdx);
      addSecondaryIdx(sKey, newIdx);
      stats.added++;
    }

    return { docs: result, stats: stats };
  }

  /* ══════════════════════════════════════════════════════════════
   * 3. 하급심(1·2심)·결정서 비식별화 및 메타 자동추출 (PBoxIngest)
   * ══════════════════════════════════════════════════════════════ */
  var NON_PERSON_NAME_RE = /^(?:주식회사|유한회사|합자회사|합명회사|사단법인|재단법인|학교법인|의료법인|사회복지|법무법인|노무법인|노동조합|지회|지부|분회|위원회|중앙노동|지방노동|근로복지|공단|장관|청장|시장|군수|구청장|도지사|지사|교육감|대리인|소송대리|변호사|공인노무|노무사|대표이사|대한민국|정부|회사|사용자|사업주|참가인|보조참가|선정당사|원심판결|피고보조|원고보조|행정법원|고등법원|지방법원|대법원|헌법재판|청구취지|판결선고|항소기각|처분취소|부당해고|통상임금|평균임금|최저임금|퇴직급여|퇴직연금|산재보험|고용보험|손해배상|요양급여|장해급여|유족급여|재심판정|초심판정|취업규칙|단체협약|근로계약|근로기준|산업재해|직장내|해고무효|임금청구|체불임금|연장근로|휴일근로|연차수당|주휴수당|해고예고|육아휴직|징계해고|판결문|결정문|결정서|판정서|재결례|행정해석|유권해석)$/;
  var NON_PERSON_SUFFIX_RE = /(?:법원|위원회|공단|조합|회사|법인|부처|장관|청장|시장|군수|구청장|지청|협회|병원|의원|학교|대학|은행|보험|증권|건설|산업|전자|물산|시스템|솔루션|판결|결정|사건|처분|청구|항소|상고|취소|무효|기각|인용)$/;
  var KOREAN_SURNAME_RE = /^[김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구라민진지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편가]([가-힣]{1,2})$/;

  function isLikelyPersonName(cand) {
    var w = String(cand || '').trim();
    if (w.length < 2 || w.length > 4) return false;
    if (NON_PERSON_NAME_RE.test(w) || NON_PERSON_SUFFIX_RE.test(w)) return false;
    if (/OO|○○|\*\*/.test(w)) return false;
    return true;
  }

  function maskPersonName(nm) {
    var w = String(nm || '');
    if (!w) return w;
    return w.charAt(0) + (w.length >= 4 ? 'OOO' : 'OO');
  }

  function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  var DOUBLE_SURNAME_RE = /^(?:남궁|황보|제갈|선우|독고|사공|서문|동방)/;
  var MULTI_JOSA_SUFFIX_RE = /(?:으로부터|로부터|에게는|에서는|이라도|까지는|부터는|으로서|으로써|에게서|이라|이란|께서|에게|에서|으로|로써|로서|부터|까지|처럼|보다|하고|이나|거나|조차|마저|밖에)$/;
  var SINGLE_JOSA_SUFFIX_RE = /(?:은|는|이|가|을|를|의|도|만|와|과|랑|로|에|측)$/;

  function splitPartyNameAndJosa(rawWord, fullText) {
    var w = String(rawWord || '').trim();
    if (!w) return { stem: '', josa: '' };
    var isDouble = DOUBLE_SURNAME_RE.test(w);
    var maxNameLen = isDouble ? 4 : 3;

    var mMulti = MULTI_JOSA_SUFFIX_RE.exec(w);
    if (mMulti) {
      var stemMulti = w.slice(0, w.length - mMulti[0].length);
      if (stemMulti.length >= 2 && stemMulti.length <= maxNameLen && isLikelyPersonName(stemMulti)) {
        return { stem: stemMulti, josa: mMulti[0] };
      }
    }

    var mSingle = SINGLE_JOSA_SUFFIX_RE.exec(w);
    if (mSingle) {
      var stemSingle = w.slice(0, w.length - 1);
      if (stemSingle.length >= 3 && stemSingle.length <= maxNameLen && isLikelyPersonName(stemSingle)) {
        return { stem: stemSingle, josa: mSingle[0] };
      }
      if (stemSingle.length === 2 && KOREAN_SURNAME_RE.test(stemSingle) && isLikelyPersonName(stemSingle) && fullText) {
        var probe = new RegExp(escapeRegExp(stemSingle) + '(?:은|는|이|가|을|를|의|도|만|와|과|에게|에서|으로|\\s|[,.()\\[\\];:]|$)', 'g');
        var hits = String(fullText).match(probe);
        if (hits && hits.some(function (h) { return h !== w; })) {
          return { stem: stemSingle, josa: mSingle[0] };
        }
      }
    }

    if (w.length >= 2 && w.length <= maxNameLen && isLikelyPersonName(w)) {
      return { stem: w, josa: '' };
    }
    return { stem: '', josa: '' };
  }

  /* 본문 및 메타(파일명·제목 포함)에서 당사자 실명 사전을 먼저 뽑아 재등장 실명까지 일괄 치환한다 */
  function extractPartyNames(combinedText, fileNameHint) {
    var names = new Set();
    var src = String(combinedText || '');
    var roleRe = /(?:^|[^가-힣])(원고|피고|신청인|피신청인|청구인|피청구인|재해자|진정인|피진정인|고소인|피고인|피의자|망인|망|소외|근로자|선정자|보조참가인|참가인)(?:\s*\([가-힣0-9,\s]{1,16}\))?(?:\s*\d+\s*\.)?(?:\s*[:：]\s*|\s+)([가-힣]{2,7})(?=\s|[,\.\(\)\[\]:：/_;\-]|$)/g;
    var m;
    while ((m = roleRe.exec(src))) {
      var sp = splitPartyNameAndJosa(m[2], src);
      if (sp.stem) names.add(sp.stem);
    }

    var fn = String(fileNameHint || '').replace(/\.[A-Za-z0-9]+$/, '');
    if (fn) {
      var tokens = fn.split(/[\s_\-.,()[\]/]+/).filter(Boolean);
      for (var i = 0; i < tokens.length; i++) {
        var tk = tokens[i];
        if (tk.length === 3 && KOREAN_SURNAME_RE.test(tk) && isLikelyPersonName(tk)) {
          names.add(tk);
        }
      }
    }
    return Array.from(names).sort(function (a, b) { return b.length - a.length; });
  }

  function anonymizeLegalText(rawText, knownNames) {
    var counts = { rrn: 0, phone: 0, email: 0, account: 0, address: 0, name: 0 };
    var text = String(rawText || '');

    /* ① 주민등록번호·외국인등록번호 (하이픈 유무 모두 포함: 생년월일 6자리 + 성별코드 1~8 + 6자리) */
    text = text.replace(/(?:^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-~]\s*([1-8]\d{6})|([1-8]\d{6}))(?![\d])/g, function (m, front, backHy, backPlain) {
      var lead = m.slice(0, m.length - (front + (backHy ? m.slice(m.indexOf(front) + 6) : backPlain)).length);
      counts.rrn++;
      return lead + '******-*******';
    });

    /* ② 휴대전화 및 일반전화번호 (사건번호·법령번호와 겹치지 않는 지역/통신망 번호만) */
    text = text.replace(/\b(01[016789])(?:[-\s.](\d{3,4})[-\s.](\d{4})|(\d{7,8}))\b/g, function (_, p1) {
      counts.phone++;
      return p1 + '-****-****';
    });
    text = text.replace(/\b(0(?:2|[3-6][1-5]|70))[-\s.](\d{3,4})[-\s.](\d{4})\b/g, function (_, p1) {
      counts.phone++;
      return p1 + '-****-****';
    });

    /* ③ 이메일 주소 */
    text = text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, function () {
      counts.email++;
      return '***@***.***';
    });

    /* ④ 계좌번호 (하이픈 구분 계좌 + 은행·계좌 문맥 뒤 10~16자리 연속숫자 계좌) */
    text = text.replace(/((?:은행|계좌|계좌번호|입금계좌|예금)\s*[:：]?\s*(?:[가-힣A-Za-z]{2,10}\s+)?)(\d{2,6}[-\s]\d{2,6}[-\s]\d{2,8}|\d{10,16})\b/g, function (_, prefix) {
      counts.account++;
      return prefix + '***-***-******';
    });

    /* ⑤ 상세 동·호수 주소 (시·구·동 행정구역은 관할 판단을 위해 남기고 상세 호수만 가림) */
    text = text.replace(/(\d{1,4})동\s*(\d{1,5})호/g, function () {
      counts.address++;
      return '***동 ***호';
    });

    /* ⑥ 당사자 실명 (조사 결합 원고:가나람은 / 원고 홍길동 모두 탐지 + 사전 기반 본문 재등장 일괄 치환) */
    var dict = Array.isArray(knownNames) && knownNames.length
      ? knownNames
      : extractPartyNames(text, '');

    text = text.replace(/(^|[^가-힣])(원고|피고|신청인|피신청인|청구인|피청구인|재해자|진정인|피진정인|고소인|피고인|피의자|망인|망|소외|근로자|선정자|보조참가인|참가인)((?:\s*\([가-힣0-9,\s]{1,16}\))?(?:\s*\d+\s*\.)?(?:\s*[:：]\s*|\s+))([가-힣]{2,7})(?=\s|[,\.\(\)\[\]:：/_;\-]|$)/g, function (full, pre, role, sep, cand) {
      var sp = splitPartyNameAndJosa(cand, text);
      if (!sp.stem) return full;
      counts.name++;
      return pre + role + sep + maskPersonName(sp.stem) + sp.josa;
    });

    for (var n = 0; n < dict.length; n++) {
      var nm = dict[n];
      if (!nm || nm.length < 2) continue;
      var nameRe = new RegExp(escapeRegExp(nm), 'g');
      text = text.replace(nameRe, function () {
        counts.name++;
        return maskPersonName(nm);
      });
    }

    var totalMasked = counts.rrn + counts.phone + counts.email + counts.account + counts.address + counts.name;
    return {
      text: text,
      counts: counts,
      totalMasked: totalMasked
    };
  }

  function mergeAnonCounts(targetAnon, extraAnon) {
    if (!extraAnon || !extraAnon.counts) return;
    var keys = ['rrn', 'phone', 'email', 'account', 'address', 'name'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      targetAnon.counts[k] = (targetAnon.counts[k] || 0) + (extraAnon.counts[k] || 0);
    }
    targetAnon.totalMasked = (targetAnon.totalMasked || 0) + (extraAnon.totalMasked || 0);
  }

  function extractDateYmd(text) {
    var m1 = /(20\d{2}|19\d{2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(?:선고|자|결정|판정|회시)?/.exec(text);
    if (m1) {
      return m1[1] + '-' + String(m1[2]).padStart(2, '0') + '-' + String(m1[3]).padStart(2, '0');
    }
    var m2 = /(20\d{2}|19\d{2})-(\d{2})-(\d{2})/.exec(text);
    if (m2) return m2[0];
    return '';
  }

  function extractRulingMeta(cleanText, fileName) {
    var head = String(cleanText || '').slice(0, 3500);
    var court = '';
    var courtMatch = /(대법원|헌법재판소|[가-힣]{2,6}고등법원|특허법원|서울행정법원|[가-힣]{2,6}지방법원(?:\s*[가-힣]{2,5}지원)?|중앙노동위원회|[가-힣]{2,5}지방노동위원회|중앙행정심판위원회|근로복지공단(?:\s*산재재심사위원회)?|국가인권위원회|개인정보보호위원회|고용노동부)/.exec(head);
    if (courtMatch) court = courtMatch[1].replace(/\s+/g, ' ').trim();

    var caseNo = '';
    var caseMatch = /((?:19|20)\d{2}\s*[가-힣]{1,4}\s*\d{1,7})/.exec(head) ||
                    /(\b9\d\s*[가-힣]{1,4}\s*\d{1,7})/.exec(head) ||
                    /([가-힣]{2,12}과-\d{1,6})/.exec(head);
    if (caseMatch) caseNo = caseMatch[1].replace(/\s+/g, '');

    var decisionDate = extractDateYmd(head);

    var eventTitle = '';
    var mEvent = /사\s*건\s*[:：]?\s*(?:(?:19|20)?\d{2}\s*[가-힣]{1,4}\s*\d{1,7}\s*)?([^\n\r]{3,60})/.exec(head);
    if (mEvent) eventTitle = mEvent[1].trim();

    var baseName = String(fileName || '').replace(/\.[A-Za-z0-9]+$/, '').trim();
    var title = eventTitle
      ? ((court ? court + ' ' : '') + (caseNo ? caseNo + ' ' : '') + eventTitle)
      : (baseName || ((court || '판결·결정') + ' ' + (caseNo || '문서')));

    /* 참조 법령 조문 추출 */
    var refLawsSet = new Set();
    var lawRegex = /([가-힣ㆍ\s]{2,22}(?:법률|법|시행령|시행규칙))\s*제\s*(\d+)\s*조(?:의\s*(\d+))?/g;
    var lm;
    while ((lm = lawRegex.exec(cleanText)) && refLawsSet.size < 12) {
      var lname = lm[1].trim().replace(/\s+/g, ' ');
      if (lname.length >= 2) {
        refLawsSet.add(lname + ' 제' + lm[2] + '조' + (lm[3] ? '의' + lm[3] : ''));
      }
    }

    /* 참조 판례 사건번호 추출 */
    var refCasesSet = new Set();
    var rcRegex = /(?:대법원|헌법재판소|[가-힣]{2,6}법원)\s*\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.\s*(?:선고|자)\s*((?:19|20)?\d{2}[가-힣]{1,3}\d{1,7})/g;
    var rcm;
    while ((rcm = rcRegex.exec(cleanText)) && refCasesSet.size < 10) {
      if (rcm[1] !== caseNo) refCasesSet.add(rcm[0].replace(/\s+/g, ' ').trim());
    }

    /* 판결요지 또는 주문 요약 생성 */
    var summary = '';
    var mHold = /주\s*문\s*\n+([\s\S]{10,360}?)(?:\n\s*청\s*구\s*취\s*지|\n\s*이\s*유|\n\n)/.exec(cleanText);
    if (mHold) summary = '[주문] ' + mHold[1].replace(/\s+/g, ' ').trim();
    if (!summary) {
      summary = cleanText.replace(/\s+/g, ' ').trim().slice(0, 260);
    }

    var docType = 'internal_case';
    if (court === '대법원' || court === '헌법재판소') docType = 'prec_sc';
    else if (/법원/.test(court)) docType = 'prec_lower';
    else if (/위원회|공단/.test(court)) docType = 'dec_nlrc';
    else if (/노동부/.test(court)) docType = 'interp_moel';

    return {
      docType: docType,
      court: court || '하급심·기타기관',
      agency: court || '사무실 수집 자료',
      caseNo: caseNo,
      decisionDate: decisionDate || todayKstYmd(),
      title: title,
      summary: summary,
      refLaws: Array.from(refLawsSet),
      refCases: Array.from(refCasesSet)
    };
  }

  function ingestRawDocument(rawText, opts) {
    opts = opts || {};
    var combinedInput = [
      rawText, opts.fileName, opts.title, opts.court, opts.agency, opts.caseNo, opts.sourceLabel
    ].concat(Array.isArray(opts.tags) ? opts.tags : []).filter(Boolean).join('\n');
    var partyNames = extractPartyNames(combinedInput, opts.fileName || opts.title || '');

    var anon = anonymizeLegalText(rawText, partyNames);
    var cleanBody = anon.text.trim();
    if (cleanBody.length < 20) {
      throw new Error('추출된 본문이 비어 있거나 너무 짧습니다(20자 미만). 스캔 이미지 PDF는 텍스트(OCR) 변환 후 등록해 주세요.');
    }

    var safeFileAnim = anonymizeLegalText(opts.fileName || '', partyNames);
    mergeAnonCounts(anon, safeFileAnim);

    var meta = extractRulingMeta(cleanBody, safeFileAnim.text);

    var titleAnim = anonymizeLegalText(opts.title || meta.title, partyNames);
    var summaryAnim = anonymizeLegalText(meta.summary, partyNames);
    var srcAnim = anonymizeLegalText(opts.sourceLabel || '사무실 수집 (비식별화 완료)', partyNames);
    var courtAnim = anonymizeLegalText(opts.court || meta.court, partyNames);
    var agencyAnim = anonymizeLegalText(opts.agency || meta.agency, partyNames);
    var caseNoAnim = anonymizeLegalText(opts.caseNo || meta.caseNo, partyNames);
    mergeAnonCounts(anon, titleAnim);
    mergeAnonCounts(anon, summaryAnim);
    mergeAnonCounts(anon, srcAnim);
    mergeAnonCounts(anon, courtAnim);
    mergeAnonCounts(anon, agencyAnim);
    mergeAnonCounts(anon, caseNoAnim);

    var rawTags = Array.isArray(opts.tags) && opts.tags.length ? opts.tags : ['수집판결문', courtAnim.text].filter(Boolean);
    var cleanTags = rawTags.map(function (tg) {
      var ta = anonymizeLegalText(String(tg || ''), partyNames);
      mergeAnonCounts(anon, ta);
      return ta.text.trim();
    }).filter(Boolean);

    var cleanRefLaws = (meta.refLaws || []).map(function (rl) {
      var ra = anonymizeLegalText(String(rl || ''), partyNames);
      mergeAnonCounts(anon, ra);
      return ra.text.trim();
    }).filter(Boolean);

    var cleanRefCases = (meta.refCases || []).map(function (rc) {
      var rca = anonymizeLegalText(String(rc || ''), partyNames);
      mergeAnonCounts(anon, rca);
      return rca.text.trim();
    }).filter(Boolean);

    return {
      doc: {
        id: opts.id || ('ing-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
        docType: opts.docType || meta.docType,
        fileName: safeFileAnim.text,
        court: courtAnim.text,
        agency: agencyAnim.text,
        caseNo: caseNoAnim.text,
        decisionDate: opts.decisionDate || meta.decisionDate,
        title: titleAnim.text,
        subType: opts.subType || '비식별 수집 판결·결정문',
        tags: cleanTags,
        refLaws: cleanRefLaws,
        refCases: cleanRefCases,
        summary: summaryAnim.text,
        body: cleanBody,
        sources: [srcAnim.text],
        verified: true,
        userIngested: true,
        piiMasked: anon.totalMasked
      },
      anonymization: anon
    };
  }

  /* AI-Hub 법률/판결문 개방 데이터 JSON 또는 범용 판례 배열 JSON 일괄 변환 */
  function ingestJsonDataset(jsonInput, sourceLabel) {
    var parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
    var items = [];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed && Array.isArray(parsed.documents)) {
      items = parsed.documents;
    } else if (parsed && parsed.info && (parsed.dcss || parsed.assrs || parsed.close)) {
      items = [parsed];
    } else if (parsed && typeof parsed === 'object') {
      items = [parsed];
    }

    var outDocs = [];
    var totalMasked = 0;
    var skippedEmpty = 0;

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || typeof it !== 'object') continue;

      /* AI-Hub 판결문 표준 스키마 (info / assrs / dcss / close) 지원 */
      if (it.info && typeof it.info === 'object') {
        var inf = it.info;
        var rawParts = [];
        if (it.assrs && it.assrs.acusrAssrs) rawParts.push('【주장 요지】\n' + [].concat(it.assrs.acusrAssrs).join('\n'));
        if (it.dcss && it.dcss.courtDcss) rawParts.push('【법원의 판단】\n' + [].concat(it.dcss.courtDcss).join('\n'));
        if (it.close && it.close.cnclsns) rawParts.push('【결론·주문】\n' + [].concat(it.close.cnclsns).join('\n'));
        var combined = rawParts.join('\n\n');
        if (combined.trim().length < 20) {
          skippedEmpty++;
          continue;
        }
        var rawDate = String(inf.judmnAdjuDe || '').replace(/\./g, '-').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
        var res = ingestRawDocument(combined, {
          court: inf.courtNm || '법원',
          caseNo: inf.caseNo || '',
          decisionDate: rawDate || todayKstYmd(),
          title: [inf.courtNm, inf.caseNo, inf.caseNm].filter(Boolean).join(' '),
          docType: inf.courtNm === '대법원' ? 'prec_sc' : 'prec_lower',
          sourceLabel: sourceLabel || 'AI-Hub 법률 데이터셋'
        });
        totalMasked += res.anonymization.totalMasked;
        outDocs.push(res.doc);
        continue;
      }

      /* 일반 판례·해석례 JSON 객체 */
      var bodyText = it.body || it.content || it.판결내용 || it.판결요지 || it.회시내용 || it.결정요지 || '';
      var sumText = it.summary || it.판시사항 || it.질의요지 || '';
      var full = (sumText ? sumText + '\n\n' : '') + bodyText;
      if (full.trim().length < 20) {
        skippedEmpty++;
        continue;
      }
      var r2 = ingestRawDocument(full, {
        court: it.court || it.법원명 || it.기관명 || it.agency || '',
        caseNo: it.caseNo || it.사건번호 || it.문서번호 || '',
        decisionDate: it.decisionDate || it.선고일자 || it.회시일자 || '',
        title: it.title || it.사건명 || it.안건명 || '',
        docType: it.docType || '',
        tags: it.tags || [],
        sourceLabel: sourceLabel || '공공 JSON 데이터'
      });
      totalMasked += r2.anonymization.totalMasked;
      outDocs.push(r2.doc);
    }

    if (!outDocs.length) {
      throw new Error('JSON 파일에서 적재 가능한 본문(20자 이상)을 찾지 못했습니다.');
    }

    return { docs: outDocs, totalMasked: totalMasked, skippedEmpty: skippedEmpty };
  }

  /* ══════════════════════════════════════════════════════════════
   * 4. 하이브리드 법률 검색 · 오프라인 초안 합성 · 기계적 인용 검증기
   * ══════════════════════════════════════════════════════════════ */
  var SYNONYM_MAP = {
    '허리디스크': ['추간판탈출증', '요추', '근골격계'],
    '추간판탈출증': ['허리디스크', '요추'],
    '목디스크': ['경추', '추간판탈출증'],
    '난청': ['소음성난청', '85db', '장해급여'],
    '학폭': ['괴롭힘'],
    '괴롭힘': ['직장내괴롭힘', '제76조의2', '제76조의3', '분리조치'],
    '고정성': ['통상임금', '2020다247190', '재직조건'],
    '상여금': ['통상임금', '정기상여금', '재직조건', '근무일수'],
    'db형': ['확정급여형', '퇴직연금', '중도인출', '중간정산'],
    'dc형': ['확정기여형', '퇴직연금', '중도인출'],
    '수습': ['시용', '본채용거부', '부당해고'],
    '프리랜서': ['근로자성', '사용종속관계', '2004다29736'],
    '하청': ['사내하도급', '불법파견', '근로자파견', '2010다106436'],
    '알바': ['단시간근로자', '기간제', '상시근로자수'],
    '5인미만': ['상시근로자수', '제11조', '시행령제7조의2']
  };

  function tokenizeQuery(q) {
    var raw = String(q || '').toLowerCase().trim();
    if (!raw) return [];
    var rawTokens = raw.split(/[\s,·/()[\]"'“”‘’?!]+/).filter(Boolean);
    var out = new Set();
    for (var i = 0; i < rawTokens.length; i++) {
      var t = rawTokens[i].replace(/(?:은|는|이|가|을|를|의|에|에서|으로|로|과|와|도|만|란|이란|여부|기준|판례|법리)$/, '');
      if (t.length >= 2) out.add(t);
      if (rawTokens[i].length >= 2) out.add(rawTokens[i]);
      var syns = SYNONYM_MAP[t] || SYNONYM_MAP[rawTokens[i]];
      if (syns) {
        for (var s = 0; s < syns.length; s++) out.add(syns[s].toLowerCase());
      }
    }
    return Array.from(out);
  }

  function scoreDocument(doc, tokens, rawQueryNorm) {
    if (!tokens.length && !rawQueryNorm) return 1;
    var cno = String(doc.caseNo || '').toLowerCase().replace(/\s+/g, '');
    var title = String(doc.title || '').toLowerCase();
    var summary = String(doc.summary || '').toLowerCase();
    var body = String(doc.body || '').toLowerCase();
    var tags = (doc.tags || []).join(' ').toLowerCase();
    var refs = [].concat(doc.refLaws || [], doc.refCases || []).join(' ').toLowerCase();

    var score = 0;
    if (rawQueryNorm && cno && rawQueryNorm.indexOf(cno) >= 0) score += 120;
    if (rawQueryNorm && title.replace(/\s+/g, '').indexOf(rawQueryNorm) >= 0) score += 60;

    for (var i = 0; i < tokens.length; i++) {
      var tk = tokens[i];
      if (cno && cno.indexOf(tk) >= 0) score += 80;
      if (title.indexOf(tk) >= 0) score += 22;
      if (tags.indexOf(tk) >= 0) score += 18;
      if (refs.indexOf(tk) >= 0) score += 15;
      if (summary.indexOf(tk) >= 0) score += 10;
      if (body.indexOf(tk) >= 0) score += 5;
    }
    return score;
  }

  function searchCorpus(query, opts) {
    opts = opts || {};
    var docs = Array.isArray(opts.docs) ? opts.docs : [];
    var loadedLaws = Array.isArray(opts.loadedLaws) ? opts.loadedLaws : [];
    var lawIndex = Array.isArray(opts.lawIndex) ? opts.lawIndex : [];
    var docTypeFilter = opts.docType || 'all';
    var limit = opts.limit || 50;

    var qStr = String(query || '').trim();
    var qNorm = qStr.toLowerCase().replace(/\s+/g, '');
    var tokens = tokenizeQuery(qStr);

    var docHits = [];
    for (var i = 0; i < docs.length; i++) {
      var d = docs[i];
      if (docTypeFilter !== 'all' && d.docType !== docTypeFilter) continue;
      if (opts.court && normalizeCourt(d.court) !== normalizeCourt(opts.court)) continue;
      var sc = scoreDocument(d, tokens, qNorm);
      if (!qStr || sc > 0) {
        docHits.push({ item: d, score: sc });
      }
    }
    docHits.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(b.item.decisionDate || '').localeCompare(String(a.item.decisionDate || ''));
    });

    /* 적재된 법령 조문 검색 */
    var articleHits = [];
    if (qStr) {
      for (var l = 0; l < loadedLaws.length; l++) {
        var law = loadedLaws[l];
        if (!law || law.isRepealStub) continue;
        var lawTitleLow = String(law.title || '').toLowerCase();
        var arts = law.articles || [];
        for (var a = 0; a < arts.length; a++) {
          var art = arts[a];
          var hay = (lawTitleLow + ' ' + art.no + ' ' + (art.heading || '') + ' ' + (art.text || '')).toLowerCase();
          var asc = 0;
          if (qNorm && hay.replace(/\s+/g, '').indexOf(qNorm) >= 0) asc += 45;
          for (var t = 0; t < tokens.length; t++) {
            if (hay.indexOf(tokens[t]) >= 0) asc += (art.heading && art.heading.toLowerCase().indexOf(tokens[t]) >= 0) ? 16 : 7;
          }
          if (asc > 0) {
            articleHits.push({
              lawDir: law.dir,
              lawTitle: law.title,
              fileName: law.fileName,
              effectiveDate: law.effectiveDate,
              articleNo: art.no,
              heading: art.heading,
              snippet: String(art.text || '').slice(0, 240),
              score: asc
            });
          }
        }
      }
      articleHits.sort(function (a, b) { return b.score - a.score; });
    }

    /* 5,773개 전 법령 제목 색인 매칭 */
    var lawTitleHits = [];
    if (qStr && lawIndex.length) {
      for (var k = 0; k < lawIndex.length; k++) {
        var fam = lawIndex[k];
        var fHay = (fam.title + ' ' + fam.dir + ' ' + (fam.dept || '')).toLowerCase();
        var fNorm = fHay.replace(/\s+/g, '');
        var lsc = 0;
        if (qNorm && fNorm.indexOf(qNorm) >= 0) lsc += 50;
        for (var tkIdx = 0; tkIdx < tokens.length; tkIdx++) {
          if (fHay.indexOf(tokens[tkIdx]) >= 0 || fNorm.indexOf(tokens[tkIdx]) >= 0) lsc += 20;
        }
        if (lsc > 0) {
          lawTitleHits.push({ family: fam, score: lsc + (fam.priority ? 10 : 0) });
        }
      }
      lawTitleHits.sort(function (a, b) { return b.score - a.score; });
    }

    return {
      docs: docHits.slice(0, limit).map(function (h) { return h.item; }),
      articles: articleHits.slice(0, 20),
      lawFamilies: lawTitleHits.slice(0, 20).map(function (h) { return h.family; }),
      tokens: tokens
    };
  }

  /* AI 질의용 근거 프롬프트 조립 (환각 차단용 원문 강제 주입 + 외부 AI 전달 전 전체 민감정보 비식별 관문 통과) */
  function buildRagPrompt(params) {
    params = params || {};
    var rawQuery = String(params.query || '').trim();
    var mode = params.mode || 'auto';
    var workflow = params.workflow || null;
    var attached = Array.isArray(params.attached) ? params.attached : [];
    var retrievedDocs = Array.isArray(params.retrievedDocs) ? params.retrievedDocs : [];
    var retrievedArticles = Array.isArray(params.retrievedArticles) ? params.retrievedArticles : [];

    var combinedForNames = [rawQuery, workflow ? (workflow.title + ' ' + workflow.desc) : '']
      .concat(attached.map(function (x) { return (x.title || '') + '\n' + (x.body || x.plainText || x.summary || ''); }))
      .join('\n');
    var promptNames = extractPartyNames(combinedForNames, '');
    var scrub = function (s) { return anonymizeLegalText(String(s || ''), promptNames).text; };
    var query = scrub(rawQuery);

    var ctxLines = [];
    ctxLines.push('당신은 푸른노무법인의 법률·노무 AI 리서치 시스템 「P박스」입니다.');
    ctxLines.push('반드시 아래 [제공된 검증 원문 자료]에 있는 법령 조문·판례 사건번호·행정해석 문서번호만 인용하여 한국어로 답변하십시오.');
    ctxLines.push('원문 자료에 없는 사건번호나 문서번호를 절대 임의로 지어내지 마십시오(환각 금지). 근로기준법상 용어는 반드시 「근로자」와 「임금」을 정확히 사용하십시오.');
    if (workflow) {
      ctxLines.push('\n[선택된 전문 워크플로]: ' + scrub(workflow.title) + ' — ' + scrub(workflow.desc));
    }
    if (mode === 'draft') {
      ctxLines.push('출력 형식: 1. 사건 개요 및 핵심 쟁점, 2. 관련 법령 조문, 3. 대법원·하급심 판례 및 행정해석 법리, 4. 본 사안에의 포섭(논증), 5. 결론 및 실무 입증 체크리스트 순서로 서면 초안을 작성하십시오.');
    } else {
      ctxLines.push('출력 형식: 1. 핵심 결론 요약, 2. 근거 법령, 3. 관련 판례·유권해석 요지, 4. 실무 유의사항 순서로 명확히 정리하십시오.');
    }

    ctxLines.push('\n═══ [제공된 검증 원문 자료] ═══');
    for (var a = 0; a < attached.length; a++) {
      var att = attached[a];
      ctxLines.push('[사용자 @첨부 ' + (a + 1) + '] ' + scrub(att.title || '') + (att.caseNo ? ' (' + scrub(att.caseNo) + ')' : '') + '\n' + scrub(String(att.body || att.plainText || att.summary || '').slice(0, 2200)));
    }
    for (var r = 0; r < Math.min(retrievedArticles.length, 6); r++) {
      var art = retrievedArticles[r];
      ctxLines.push('[법령 조문 ' + (r + 1) + '] ' + art.lawTitle + ' ' + art.articleNo + (art.heading ? '(' + art.heading + ')' : '') + ' [시행 ' + (art.effectiveDate || '현행') + ']\n' + art.snippet);
    }
    for (var d = 0; d < Math.min(retrievedDocs.length, 6); d++) {
      var doc = retrievedDocs[d];
      ctxLines.push('[판례·해석 ' + (d + 1) + '] ' + scrub(doc.court || doc.agency || '') + ' ' + (doc.decisionDate || '') + ' ' + scrub(doc.caseNo || '') + ' — ' + scrub(doc.title || '') + '\n' + scrub(String(doc.body || doc.summary || '').slice(0, 1400)));
    }
    ctxLines.push('═══════════════════════════════\n');
    ctxLines.push('[사용자 질의 / 사실관계]:\n' + query);

    return ctxLines.join('\n');
  }

  /* 무료 오프라인 추출형 법률 분석·서면 합성기 (AI API 키·한도 없이도 ₩0 즉시 작동) */
  function synthesizeOfflineAnswer(params) {
    params = params || {};
    var rawQuery = String(params.query || '').trim();
    var query = anonymizeLegalText(rawQuery, extractPartyNames(rawQuery, '')).text;
    var workflow = params.workflow || null;
    var attached = Array.isArray(params.attached) ? params.attached : [];
    var docs = Array.isArray(params.retrievedDocs) ? params.retrievedDocs.slice(0, 5) : [];
    var arts = Array.isArray(params.retrievedArticles) ? params.retrievedArticles.slice(0, 5) : [];
    var fams = Array.isArray(params.retrievedLawFamilies) ? params.retrievedLawFamilies.slice(0, 4) : [];

    var lines = [];
    var headTitle = workflow ? ('### 📋 ' + workflow.title) : '### ⚖️ P박스 법률·판례·유권해석 종합 검토';
    lines.push(headTitle);
    lines.push('');
    lines.push('#### 1. 질의 요지 및 검토 방향');
    lines.push('- **검토 대상**: ' + (query.length > 180 ? query.slice(0, 180) + '…' : query));
    if (attached.length) {
      lines.push('- **@첨부 원문 반영**: ' + attached.map(function (x) { return '`' + (x.title || x.caseNo) + '`'; }).join(', '));
    }
    if (docs.length) {
      lines.push('- **핵심 판단 요약**: ' + docs[0].summary);
    } else {
      lines.push('- **핵심 판단 요약**: 관련 현행 법령 조문 및 유사 판례·행정해석의 요건사실 충족 여부를 단계별로 대조하여야 합니다.');
    }

    lines.push('');
    lines.push('#### 2. 관련 법령 및 조문 근거');
    if (arts.length) {
      for (var i = 0; i < arts.length; i++) {
        var ar = arts[i];
        lines.push('- **' + ar.lawTitle + ' ' + ar.articleNo + (ar.heading ? '(' + ar.heading + ')' : '') + '** *(시행 ' + (ar.effectiveDate || '현행') + ')*');
        lines.push('  > ' + ar.snippet.replace(/\n+/g, ' '));
      }
    } else if (fams.length) {
      for (var f = 0; f < fams.length; f++) {
        lines.push('- **' + fams[f].title + '** (' + fams[f].files.join(' · ') + ') — 오른쪽 원문 보기에서 전체 조문을 즉시 열람할 수 있습니다.');
      }
    } else if (docs.length && docs[0].refLaws && docs[0].refLaws.length) {
      for (var rl = 0; rl < docs[0].refLaws.length; rl++) {
        lines.push('- **' + docs[0].refLaws[rl] + '**');
      }
    } else {
      lines.push('- 근로기준법, 산업재해보상보험법 등 개별 노동관계법령의 강행규정 및 시행령 별표 기준을 우선 확인합니다.');
    }

    lines.push('');
    lines.push('#### 3. 대법원·하급심 판례 및 행정해석·판정례 법리');
    if (docs.length) {
      for (var d = 0; d < docs.length; d++) {
        var dc = docs[d];
        var citeHead = [dc.court || dc.agency, dc.decisionDate, dc.caseNo].filter(Boolean).join(' ');
        lines.push('- **[' + citeHead + '] ' + dc.title + '**');
        lines.push('  - ' + dc.summary);
      }
    } else {
      lines.push('- 현재 검색어와 직접 일치하는 내장 판례가 없습니다. 좌측 「국가법령 전수함」에서 조문을 열거나 「하급심·내부판결 수집함」에 관련 판결문을 추가해 대조할 수 있습니다.');
    }

    lines.push('');
    lines.push('#### 4. 실무 포섭 및 입증 체크리스트');
    lines.push('1. **처분·계약 문서 확인**: 근로계약서, 취업규칙·단체협약(시행일 기준 현행본), 임금명세서, 서면통지서 교부 여부 확인');
    lines.push('2. **사실관계 객관화**: 근무시간·업무강도·지휘감독 또는 업무상 부담 내역을 일자별·수치별로 특정');
    lines.push('3. **인용 원문 대조**: 아래 「기계적 인용 검증 결과」 배지를 눌러 판례·법령 원문 전체를 오른쪽 리더 창에서 직접 대조하십시오.');

    return lines.join('\n');
  }

  var LEADING_CITE_STOP_RE = /^(?:또한|그리고|그러나|하지만|따라서|그러므로|한편|다만|즉|특히|아울러|나아가|반면|결국|우선|먼저|예컨대|가령|혹은|또는|및|내지|현행|구|개정|신|관련|위|해당|따라|따른|의한|의하여|비추어|위반한|적용되는|규정한|대법원|판결|결정|해석|참조)$/;

  function resolveTargetLawFile(indexed, isDecree, isRule) {
    var files = (indexed && Array.isArray(indexed.files)) ? indexed.files : [];
    if (isDecree) {
      var decAlt = files.find(function (fn) { return /^시행령\(/.test(fn); });
      return (decAlt || '시행령') + '.md';
    }
    if (isRule) {
      var ruleAlt = files.find(function (fn) { return /^시행규칙\(/.test(fn); });
      return (ruleAlt || '시행규칙') + '.md';
    }
    return (indexed && indexed.primaryFile) ? indexed.primaryFile : '법률.md';
  }

  /* 띄어쓰기된 법령명('개인정보 보호법')과 하위법령('근로기준법 시행령')까지 놓치지 않고 추출하는 공통 파서 */
  function extractLawCitationsFromText(text, lawDirSet) {
    var src = String(text || '');
    var out = [];
    var artRe = /(제\s*\d+\s*조(?:\s*의\s*\d+)?)/g;
    var am;
    while ((am = artRe.exec(src))) {
      var rawArtNo = am[1].replace(/\s+/g, '');
      var endPos = am.index;
      var beforeSlice = src.slice(Math.max(0, endPos - 64), endPos);
      var tailMatch = /(?:^|[^0-9A-Za-z가-힣ㆍ])([가-힣ㆍ][가-힣ㆍ\s]{1,57})\s*$/.exec(beforeSlice);
      if (!tailMatch) continue;

      var candPhrase = tailMatch[1].trim().replace(/\s+/g, ' ');
      if (!/(?:법률|법|시행령|시행규칙|헌법)$/.test(candPhrase)) continue;

      var tokens = candPhrase.split(' ').filter(Boolean);
      if (!tokens.length) continue;

      /* 1순위: 국가법령 색인에 등록된 실제 법령명(공백 포함 최장 일치) 우선 매칭 */
      var matchedRaw = '';
      if (lawDirSet && lawDirSet.size > 0) {
        for (var sIdx = 0; sIdx < tokens.length; sIdx++) {
          var subRaw = tokens.slice(sIdx).join(' ');
          var subNorm = subRaw.replace(/\s+/g, '');
          var subBaseNorm = subNorm.replace(/(?:시행령|시행규칙)$/, '');
          if (lawDirSet.has(subNorm) || (subBaseNorm.length >= 2 && lawDirSet.has(subBaseNorm))) {
            matchedRaw = subRaw;
            break;
          }
        }
      }

      /* 2순위: 색인 미제공 또는 미등록/가공 법령명('가짜 노동 특별법 시행령', '근로기준법 시행령' 등) 추출 */
      if (!matchedRaw) {
        var cutIdx = 0;
        /* 앞쪽에 이전 절의 다른 법령 끝단어가 끼어 있으면 가장 마지막 법령 시작점 이후로 자름 */
        for (var pIdx = 0; pIdx < tokens.length - 1; pIdx++) {
          var tok = tokens[pIdx];
          var nextTok = tokens[pIdx + 1] || '';
          var isSubNext = /^(?:시행령|시행규칙)$/.test(nextTok);
          if (/(?:법률|법|시행령|시행규칙)$/.test(tok) && !isSubNext) {
            cutIdx = pIdx + 1;
          }
        }
        while (cutIdx < tokens.length - 1) {
          var w = tokens[cutIdx];
          if (LEADING_CITE_STOP_RE.test(w) || /^(?:조|항|호|목)$/.test(w) || /(?:은|는|이|가|을|를|도|만|와|과|에서|에게|으로|로써|로서|부터|까지|처럼|보다|라고|라며|상)$/.test(w)) {
            cutIdx++;
          } else {
            break;
          }
        }
        matchedRaw = tokens.slice(cutIdx).join(' ').trim();
      }

      if (matchedRaw.replace(/\s+/g, '').length < 2) continue;
      /* 단독 '시행령 제3조'처럼 본법 없이 시행령만 적힌 일반 지칭은 제외 */
      if (/^(?:법|법률|시행령|시행규칙)$/.test(matchedRaw.replace(/\s+/g, ''))) continue;

      out.push({
        rawLawName: matchedRaw,
        rawArtNo: rawArtNo
      });
    }
    return out;
  }

  /* 답변 문자열에서 인용된 현행 국가법령 목록 추출 (검증 전 조문 자동 로드용) */
  function extractCitedLawTargets(answerText, lawIndex) {
    var idxArr = Array.isArray(lawIndex) ? lawIndex : [];
    var lawDirSet = new Map();
    for (var k = 0; k < idxArr.length; k++) {
      lawDirSet.set(idxArr[k].dir, idxArr[k]);
      lawDirSet.set(idxArr[k].title.replace(/\s+/g, ''), idxArr[k]);
    }
    var cites = extractLawCitationsFromText(answerText, lawDirSet);
    var out = [];
    var seen = new Set();
    for (var i = 0; i < cites.length; i++) {
      var rawLawName = cites[i].rawLawName;
      var isDecree = /시행령$/.test(rawLawName);
      var isRule = /시행규칙$/.test(rawLawName);
      var exactNorm = rawLawName.replace(/\s+/g, '');
      var baseLawNorm = exactNorm.replace(/(?:시행령|시행규칙)$/, '');
      var indexed = lawDirSet.get(exactNorm) || lawDirSet.get(baseLawNorm);
      if (!indexed) continue;
      var targetFile = resolveTargetLawFile(indexed, isDecree, isRule);
      var cKey = indexed.dir + '/' + targetFile;
      if (seen.has(cKey)) continue;
      seen.add(cKey);
      out.push({ dir: indexed.dir, fileName: targetFile });
    }
    return out;
  }

  /* 기계적 인용 검증기 — AI 답변 속 사건번호·문서번호·법령 조문이 실제 원문 코퍼스에 존재하는지 엄격 대조 */
  function verifyCitations(answerText, opts) {
    opts = opts || {};
    var docs = Array.isArray(opts.docs) ? opts.docs : [];
    var loadedLaws = Array.isArray(opts.loadedLaws) ? opts.loadedLaws : [];
    var lawIndex = Array.isArray(opts.lawIndex) ? opts.lawIndex : [];
    var text = String(answerText || '');

    var docMap = new Map();
    var refOnlyMap = new Map();
    for (var i = 0; i < docs.length; i++) {
      var hasBody = String(docs[i].body || '').trim().length >= 20;
      var cno = normalizeCaseNo(docs[i].caseNo);
      if (cno && hasBody) docMap.set(cno, docs[i]);
      var refs = docs[i].refCases || [];
      for (var r = 0; r < refs.length; r++) {
        var rc = normalizeCaseNo(refs[r]);
        if (rc && !docMap.has(rc) && !refOnlyMap.has(rc)) {
          refOnlyMap.set(rc, { parentId: docs[i].id, parentCaseNo: docs[i].caseNo, rawRef: refs[r] });
        }
      }
    }

    var loadedByKey = new Map();
    var loadedByTitle = new Map();
    for (var l = 0; l < loadedLaws.length; l++) {
      var lw = loadedLaws[l];
      if (!lw || lw.isRepealStub) continue;
      if (lw.dir && lw.fileName) loadedByKey.set(lw.dir + '/' + lw.fileName, lw);
      if (lw.title) loadedByTitle.set(lw.title.replace(/\s+/g, ''), lw);
      if (lw.dir && (!lw.fileName || /^법률/.test(lw.fileName))) {
        loadedByTitle.set(lw.dir, lw);
      }
    }

    var lawDirSet = new Map();
    for (var k = 0; k < lawIndex.length; k++) {
      lawDirSet.set(lawIndex[k].dir, lawIndex[k]);
      lawDirSet.set(lawIndex[k].title.replace(/\s+/g, ''), lawIndex[k]);
    }

    var items = [];
    var seen = new Set();

    /* ① 판례·재결 사건번호 검출 (단자리 일련번호 2025다1 포함 · 날짜/단위 숫자 오탐 제외) */
    var caseRe = /(?:^|[^\d])((?:19|20)\d{2}\s*(?:다|두|도|누|구합|구단|가합|가단|가소|나|마|즈기|카합|카단|헌마|헌바|헌가|헌나|헌라|행심|부해|부노|차별|산재|재결)\s*\d{1,8}|(?:19|20)\d{2}[가-힣]{1,3}\d{2,8}|9\d[가-힣]{1,3}\d{1,8})(?![\d])/g;
    var cm;
    while ((cm = caseRe.exec(text))) {
      var rawCase = cm[1].replace(/\s+/g, '');
      if (/^\d{2,4}(?:년|월|일|원|명|시간|회|조|항|호|차|편|건|개|세|배|기)\d*$/.test(rawCase)) continue;
      if (seen.has('case:' + rawCase)) continue;
      seen.add('case:' + rawCase);
      var normCase = normalizeCaseNo(rawCase);
      var hitDoc = docMap.get(normCase);
      var refHit = !hitDoc ? refOnlyMap.get(normCase) : null;
      items.push({
        raw: rawCase,
        kind: 'case',
        verified: !!hitDoc,
        status: hitDoc ? 'verified' : (refHit ? 'ref_only' : 'missing'),
        targetId: hitDoc ? hitDoc.id : '',
        matchedTitle: hitDoc
          ? hitDoc.title
          : (refHit
            ? (refHit.parentCaseNo + ' 본문 내 참조판례로만 언급됨 (단독 전문 미보유 — 원문 직접 확인 필요)')
            : '내장·수집 코퍼스에 원문 미보유 (외부 선고번호 직접 확인 권장)')
      });
    }

    /* ② 행정해석 문서번호 검출 (예: 임금근로시간과-2271) */
    var interpRe = /([가-힣]{2,14}과-[0-9가-힣]{1,14})/g;
    var im;
    while ((im = interpRe.exec(text))) {
      var rawDocNo = im[1];
      if (seen.has('interp:' + rawDocNo)) continue;
      seen.add('interp:' + rawDocNo);
      var hitInterp = docMap.get(normalizeCaseNo(rawDocNo));
      items.push({
        raw: rawDocNo,
        kind: 'interp',
        verified: !!hitInterp,
        status: hitInterp ? 'verified' : 'missing',
        targetId: hitInterp ? hitInterp.id : '',
        matchedTitle: hitInterp ? hitInterp.title : '수집 코퍼스에 원문 미보유'
      });
    }

    /* ③ 법령 조문 검출 (띄어쓴 법령명 '개인정보 보호법', 하위법령 '근로기준법 시행령', 가공 법령 '가짜법' 모두 포착) */
    var lawCites = extractLawCitationsFromText(text, lawDirSet);
    for (var lc = 0; lc < lawCites.length; lc++) {
      var rawLawName = lawCites[lc].rawLawName;
      var rawArtNo = lawCites[lc].rawArtNo;
      var keyStr = rawLawName + ' ' + rawArtNo;
      if (seen.has('law:' + keyStr)) continue;
      seen.add('law:' + keyStr);

      var isDecree = /시행령$/.test(rawLawName);
      var isRule = /시행규칙$/.test(rawLawName);
      var exactNorm = rawLawName.replace(/\s+/g, '');
      var baseLawNorm = exactNorm.replace(/(?:시행령|시행규칙)$/, '');
      var indexed = lawDirSet.get(exactNorm) || lawDirSet.get(baseLawNorm) || null;
      var targetFile = resolveTargetLawFile(indexed, isDecree, isRule);

      var loaded = loadedByTitle.get(exactNorm) || null;
      if (!loaded && indexed) {
        loaded = loadedByKey.get(indexed.dir + '/' + targetFile) || null;
      }
      if (!loaded && !isDecree && !isRule) {
        loaded = loadedByTitle.get(baseLawNorm) || null;
      }

      if (loaded && Array.isArray(loaded.articles) && loaded.articles.length > 0) {
        var foundArt = loaded.articles.find(function (a) { return a.no === rawArtNo; });
        items.push({
          raw: keyStr,
          kind: 'law',
          verified: !!foundArt,
          status: foundArt ? 'verified' : 'missing_article',
          lawDir: loaded.dir,
          fileName: loaded.fileName || targetFile,
          articleNo: rawArtNo,
          matchedTitle: foundArt
            ? (loaded.title + ' ' + foundArt.no + (foundArt.heading ? '(' + foundArt.heading + ')' : '') + ' — 조문 실재 확인')
            : (loaded.title + ' 원문 내 ' + rawArtNo + ' 조문 없음 (조문 번호 오류 또는 삭제 여부 확인 필요)')
        });
      } else if (indexed) {
        var expectedBase = targetFile.replace(/\.md$/, '');
        var hasFileInFam = !Array.isArray(indexed.files) || indexed.files.some(function (fn) {
          return fn === expectedBase ||
            (isDecree && /^시행령/.test(fn)) ||
            (isRule && /^시행규칙/.test(fn)) ||
            (!isDecree && !isRule && /^법률/.test(fn));
        });
        if (!hasFileInFam) {
          items.push({
            raw: keyStr,
            kind: 'law',
            verified: false,
            status: 'missing_law',
            lawDir: indexed.dir,
            fileName: '',
            articleNo: rawArtNo,
            matchedTitle: rawLawName + ' — 해당 하위법령(시행령·시행규칙) 미존재'
          });
        } else {
          /* 조문 본문을 아직 열지 않은 상태에서는 임의 조문번호(예: 제99999조)를 검증 완료로 오판하지 않는다 */
          items.push({
            raw: keyStr,
            kind: 'law',
            verified: false,
            status: 'unfetched_law',
            lawDir: indexed.dir,
            fileName: targetFile,
            articleNo: rawArtNo,
            matchedTitle: indexed.title + (isDecree ? ' 시행령' : (isRule ? ' 시행규칙' : '')) + ' (국가법령 색인 확인 · 조문 본문 미로드 — 클릭하여 실제 조문 대조)'
          });
        }
      } else {
        items.push({
          raw: keyStr,
          kind: 'law',
          verified: false,
          status: 'missing_law',
          lawDir: '',
          fileName: '',
          articleNo: rawArtNo,
          matchedTitle: rawLawName + ' — 현행 국가법령(5,773편)에 등록되지 않은 법령명'
        });
      }
    }

    var verifiedCount = items.filter(function (x) { return x.verified; }).length;
    var unverifiedCount = items.length - verifiedCount;

    return {
      items: items,
      verifiedCount: verifiedCount,
      unverifiedCount: unverifiedCount,
      allVerified: unverifiedCount === 0
    };
  }

  global.PuPBoxEngine = {
    todayKstYmd: todayKstYmd,
    parseYamlFrontmatter: parseYamlFrontmatter,
    effectiveState: effectiveState,
    parseLawMarkdown: parseLawMarkdown,
    normalizeCourt: normalizeCourt,
    normalizeCaseNo: normalizeCaseNo,
    deterministicDocHash16: deterministicDocHash16,
    canonicalKeyOf: canonicalKeyOf,
    serverCanonicalKeyOf: serverCanonicalKeyOf,
    shingleSimilarity: shingleSimilarity,
    deduplicateDocs: deduplicateDocs,
    extractPartyNames: extractPartyNames,
    anonymizeLegalText: anonymizeLegalText,
    extractRulingMeta: extractRulingMeta,
    ingestRawDocument: ingestRawDocument,
    ingestJsonDataset: ingestJsonDataset,
    tokenizeQuery: tokenizeQuery,
    searchCorpus: searchCorpus,
    buildRagPrompt: buildRagPrompt,
    synthesizeOfflineAnswer: synthesizeOfflineAnswer,
    extractLawCitationsFromText: extractLawCitationsFromText,
    extractCitedLawTargets: extractCitedLawTargets,
    verifyCitations: verifyCitations
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = global.PuPBoxEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
