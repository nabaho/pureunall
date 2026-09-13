/* 푸른이알피 — 서면함 층 (2026-09-13)
   대표 지시 2026-09-12 「각 직원들이 한글로 서면 작성한 것들 모두 연결 관리하고 싶다」

   ★ 이 파일이 «서면 한 장이 어디에 붙는가»를 아는 유일한 자리다.
     화면(pu-erp.html)은 여기 함수를 부르고 사람에게 물어보기만 한다.
     읽개(hwp_extract.js)가 «글자 뽑기»를 아는 유일한 자리인 것과 짝을 이룬다.

   ⚠⚠ **이름으로 맞춘 것은 «저절로» 붙지 않는다.** 온톨로지 규칙이 그렇고
     (CLAUDE.md 「이름으로 추정한 관계는 사람이 원본 ID를 확정하기 전까지 저장 대상이 아니다」),
     실제로 이 집에서 두 번 데었다 — 「천성」과 「천성가축약품」은 다른 곳이고,
     사업자번호가 같다고 통과시켰다가 자문 계약이 기금 업체에 들어갔다.
     그래서 match() 는 «권하는 것»만 돌려주고, 붙이는 것은 사람이 누른다.

   ⚠ 서면에는 주민등록번호가 들어 있다. 그래서
     ① 실시간DB 레코드는 «볼 사람 명단(who)» 을 달고 다니고
     ② 원본 파일은 올린 사람 자리에만 담긴다 — 남들은 레코드에 적힌 토큰 주소로 연다
       (창고 규칙은 실시간DB 를 못 읽어 「담당자인가」를 창고에서 판정할 수 없다).
     ③ 찾기용 본문은 «따로» 담고 길이를 자른다 — 목록 열 때마다 전문을 내려받으면
        그것이 곧 요금이다(2026-08-16·08-26 에 두 번 겪었다).

   ⚠ 명단(who)은 «서면마다 적힌 사진»이다. 사건 담당자가 바뀌어도 저절로 안 바뀐다 —
     맞추는 일은 「라」 걸음에서 만든다. 그것을 빼면 그만둔 직원이 계속 본다. */
(function (global) {
  'use strict';

  /* ── 담는 자리 ──
     ⚠⚠ **`data/` 밑이 아니다.** `data` 는 맨 위가 재무 권한 읽기(.read: FIN)이고,
       실시간DB 규칙은 위에서 허용하면 아래에서 못 막는다. 게다가 `data` 밑의
       이름 없는 자리는 «재직 직원 누구나» 읽고 쓴다($other).
       그러니 여기에 'data/' 를 붙이는 순간 서면이 통째로 열린다 —
       실제로 한 번 그렇게 적었다가 tests/rules-data-named.test.js 가 잡았다. */
  var ROOT      = 'erp_docs';        /* 본체 — 무엇·누구·어디에 붙었나 */
  var IDX_ROOT  = 'erp_doc_idx';     /* 사람별 목록 — 한 줄 그릴 것만 */
  var TEXT_ROOT = 'erp_doc_text';    /* 찾기용 본문 — 따로, 잘라서 */
  var BUCKET    = 'gs://pureun-erp-hrphotos';   /* 사진첩·서고 원본과 같은 창고 */
  var DIR       = 'erp_docs';
  var MAX_BYTES = 25 * 1024 * 1024;       /* 창고 규칙과 같은 수 */
  var TEXT_MAX  = 20000;                  /* 찾기용 본문 길이 한도 */

  var deps = { db:null, storage:null, uid:'', sid:'', name:'', isAdmin:false };
  function init(o) {
    o = o || {};
    if (o.db !== undefined) deps.db = o.db || null;
    if (o.storage !== undefined) deps.storage = o.storage || null;
    if (o.uid !== undefined) deps.uid = String(o.uid || '');
    if (o.sid !== undefined) deps.sid = String(o.sid || '');
    if (o.name !== undefined) deps.name = String(o.name || '');
    if (o.isAdmin !== undefined) deps.isAdmin = !!o.isAdmin;
    return true;
  }

  /* ══ 글자 다루기 ══════════════════════════════════════════════════════ */

  /* 한글 파일에서 뽑은 글자는 줄바꿈·공백이 제멋대로다 —
     「부해-2026-003」이 「부해- 2026-\n003」으로 오는 일이 흔하다.
     그래서 견줄 때는 «공백을 통째로 걷은 것»끼리 견준다. */
  function flat(v) { return String(v == null ? '' : v).replace(/\s+/g, '').toUpperCase(); }
  function digits(v) { return String(v == null ? '' : v).replace(/\D/g, ''); }
  function trim(v) { return String(v == null ? '' : v).trim(); }

  /* 주민등록번호가 들어 있나.
     ⚠ PuRrnSeal.looksLikeRrn 은 «칸 하나가 통째로 주민번호인가»를 본다(^…$).
       여기는 «긴 본문 속에 섞여 있나»라서 쓸 수 없다 — 같은 물음이 아니다. */
  var RRN_IN_TEXT = /\d{6}\s*[-‐-―]\s*[1-8]\d{6}/;
  function hasRrn(text) { return RRN_IN_TEXT.test(String(text == null ? '' : text)); }

  /* 본문에 적힌 사업자번호들 — 10자리로 고쳐 돌려준다 */
  function findBiznos(text) {
    var s = String(text == null ? '' : text);
    var out = [], seen = {};
    var re = /\d{3}\s*-?\s*\d{2}\s*-?\s*\d{5}/g, m;
    while ((m = re.exec(s))) {
      var d = digits(m[0]);
      if (d.length === 10 && !seen[d]) { seen[d] = 1; out.push(d); }
    }
    return out;
  }

  /* 한 사건이 가진 «번호들» — 우리 번호(부해-2026-003)와
     심급마다 적어 둔 진짜 노동위·법원 번호(충남2026부해123)를 모두 센다.
     ★ 서면에 적히는 것은 대개 «심급 번호»다. 우리 번호만 보면 거의 못 찾는다. */
  function caseNosOf(c) {
    var out = [];
    if (!c) return out;
    var push = function (v) { var t = trim(v); if (t && out.indexOf(t) < 0) out.push(t); };
    push(c.caseNo);
    (c.stages || []).forEach(function (s) { push(s && s.caseNo); });
    return out;
  }
  function contractNosOf(c) {
    var out = [];
    if (!c) return out;
    [c.contractNo, c.no, c.caseNo].forEach(function (v) {
      var t = trim(v); if (t && out.indexOf(t) < 0) out.push(t);
    });
    return out;
  }

  /* 번호 하나가 본문에 «그대로» 적혀 있나.
     ⚠ 너무 짧은 번호는 안 본다 — 「3」 같은 것이 아무 서면에나 걸린다. */
  function noInText(flatText, no) {
    var f = flat(no);
    if (f.length < 6) return false;
    return flatText.indexOf(f) >= 0;
  }

  /* ══ 어디에 붙일까 ════════════════════════════════════════════════════
     차례는 ① 사건번호 ② 사업자번호 ③ 상호 다. 뒤로 갈수록 약하다.
     ⚠ 돌려주는 것은 «권함»이다. 이 층은 아무것도 저장하지 않는다. */
  function match(text, ctx) {
    ctx = ctx || {};
    var cases = ctx.cases || [], contracts = ctx.contracts || [], companies = ctx.companies || [];
    var ft = flat(text);
    var none = { found:'', sourceKind:'', sourceId:'', companyId:'', coName:'', caseNo:'', linkBy:'', why:'', picks:[] };
    if (!ft) return none;

    /* ① 사건번호·계약번호 — 가장 확실하다. 서면에는 거의 늘 적혀 있다. */
    var byNo = [];
    cases.forEach(function (c) {
      caseNosOf(c).forEach(function (no) {
        if (noInText(ft, no)) byNo.push({ kind:'case', it:c, no:no });
      });
    });
    contracts.forEach(function (c) {
      contractNosOf(c).forEach(function (no) {
        if (noInText(ft, no)) byNo.push({ kind:'contract', it:c, no:no });
      });
    });
    /* 같은 건이 우리 번호·심급 번호 둘 다로 걸릴 수 있다 — 한 건으로 센다 */
    var seenId = {}, uniq = [];
    byNo.forEach(function (h) {
      var k = h.kind + '/' + (h.it && h.it.id);
      if (!seenId[k]) { seenId[k] = 1; uniq.push(h); }
    });
    if (uniq.length === 1) {
      var h1 = uniq[0];
      return {
        found: h1.kind, sourceKind: h1.kind, sourceId: trim(h1.it.id),
        companyId: trim(h1.it.companyId), coName: trim(h1.it.companyName || h1.it.payee),
        caseNo: h1.no, linkBy: 'no',
        why: '본문에 ' + (h1.kind === 'case' ? '사건번호' : '계약번호') + ' ' + h1.no + ' 가 적혀 있었습니다',
        picks: []
      };
    }
    if (uniq.length > 1) {
      return Object.assign({}, none, {
        linkBy: 'no',
        why: '본문에서 번호가 ' + uniq.length + '개 나왔습니다 — 어느 것인지 골라 주십시오',
        picks: uniq.map(function (h) {
          return { kind:h.kind, id:trim(h.it.id), no:h.no,
                   coName:trim(h.it.companyName || h.it.payee), title:trim(h.it.title) };
        })
      });
    }

    /* ② 사업자번호 — 업체까지는 확실하다. 사건까지는 아니다. */
    var nos = findBiznos(ft);
    var co = null, byWhat = '';
    if (nos.length) {
      for (var i = 0; i < companies.length && !co; i++) {
        /* ⚠ 칸 이름이 두 가지다 — 푸른이알피는 bizNo, 서류 등록 층은 bizno 를 쓴다.
             하나만 보면 절반이 조용히 안 걸린다. */
        var d = digits((companies[i] && (companies[i].bizNo || companies[i].bizno)) || '');
        if (d.length === 10 && nos.indexOf(d) >= 0) { co = companies[i]; byWhat = 'bizno'; }
      }
    }

    /* ③ 상호 — 가장 약하다. ⚠ 「천성」이 「천성가축약품」에 걸린다.
       그래서 두 글자짜리는 안 본다. 이것으로는 사건을 고르지 않는다. */
    if (!co) {
      var best = null;
      companies.forEach(function (c) {
        var n = flat(c && c.name);
        if (n.length < 3) return;
        if (ft.indexOf(n) < 0) return;
        if (!best || n.length > flat(best.name).length) best = c;   /* 긴 이름이 이긴다 */
      });
      if (best) { co = best; byWhat = 'name'; }
    }

    if (!co) return Object.assign({}, none, { why: '업체를 못 찾았습니다 — 붙일 곳을 골라 주십시오' });

    /* 업체를 찾았으면 그 업체의 살아 있는 사건·계약을 «후보»로 올린다.
       ⚠ 딱 하나여도 저절로 붙이지 않는다 — 업체가 맞다고 사건까지 맞는 것은 아니다. */
    var cid = trim(co.id), cname = trim(co.name);
    var mine = [];
    cases.forEach(function (c) {
      if (trim(c.companyId) === cid && cid) mine.push({ kind:'case', id:trim(c.id), no:trim(c.caseNo), coName:cname, title:trim(c.title) });
    });
    contracts.forEach(function (c) {
      if (trim(c.companyId) === cid && cid) mine.push({ kind:'contract', id:trim(c.id), no:trim(c.contractNo || c.no), coName:cname, title:trim(c.title) });
    });
    return {
      found:'company', sourceKind:'', sourceId:'', companyId:cid, coName:cname, caseNo:'',
      linkBy: byWhat,
      why: byWhat === 'bizno'
        ? '사업자번호로 «' + cname + '» 을 찾았습니다 — 어느 사건·계약인지 골라 주십시오'
        : '상호 «' + cname + '» 이 본문에 있었습니다 — 이름만으로 찾은 것이라 꼭 확인해 주십시오',
      picks: mine
    };
  }

  /* ══ 무슨 서면인가 ════════════════════════════════════════════════════
     본문 앞머리에서 «짧은 줄»에 붙은 서면 이름을 찾는다.
     못 찾으면 파일 이름에서 확장자만 뗀다 — 빈 제목보다 낫다. */
  var KIND_WORDS = [
    '구제신청', '이유서', '답변서', '준비서면', '내용증명', '의견서', '진정서',
    '고소장', '고발장', '심판청구', '재심신청', '화해조서', '합의서', '확인서',
    '사실확인서', '경위서', '위임장', '취업규칙', '근로계약서', '시정지시',
    '이의신청', '심사청구', '재심사청구', '요양신청', '보고서', '신청서', '통지서',
    '질의서', '회신', '소장', '항소이유서', '탄원서', '진술서', '자문의견서'
  ];
  function guessKind(text, fileName) {
    var lines = String(text == null ? '' : text).split(/\n/);
    var n = Math.min(lines.length, 40);
    for (var i = 0; i < n; i++) {
      var L = trim(lines[i]);
      if (!L || L.length > 40) continue;
      for (var j = 0; j < KIND_WORDS.length; j++) {
        if (L.indexOf(KIND_WORDS[j]) >= 0) return L;
      }
    }
    return trim(String(fileName == null ? '' : fileName).replace(/\.[A-Za-z0-9]{1,5}$/, ''));
  }

  /* ══ 몇 판째인가 ══════════════════════════════════════════════════════
     같은 곳에 같은 종류를 또 올리면 v2·v3 다. 덮어쓰지 않는다 —
     노무 서면은 «고친 자취»가 그 자체로 기록이다. */
  function verKeyOf(rec) {
    rec = rec || {};
    return [trim(rec.sourceKind), trim(rec.sourceId), flat(rec.kind)].join('|');
  }
  function nextVer(rows, rec) {
    var key = verKeyOf(rec), top = 0;
    (rows || []).forEach(function (r) {
      if (verKeyOf(r) !== key) return;
      var v = parseInt(r && r.ver, 10);
      if (v > top) top = v;
    });
    return top + 1;
  }

  /* ══ 목록 한 줄 ═══════════════════════════════════════════════════════
     ⚠ 목록에 필요한 것만 담는다. 본문·주소를 여기 베끼면
       목록 한 번 여는 데 서면 전부를 내려받는 셈이 된다. */
  function rowOf(rec) {
    rec = rec || {};
    return {
      id: trim(rec.id), kind: trim(rec.kind), ext: trim(rec.ext),
      coName: trim(rec.coName), caseNo: trim(rec.caseNo),
      sourceKind: trim(rec.sourceKind), sourceId: trim(rec.sourceId),
      byName: trim(rec.byName), at: rec.at || 0, ver: rec.ver || 1,
      hasRrn: !!rec.hasRrn, linkBy: trim(rec.linkBy)
    };
  }

  /* ══ 볼 사람 명단 ═════════════════════════════════════════════════════
     담당자(주·부) + 올린 사람. 관리자는 규칙이 따로 열어 주므로 안 적는다 —
     적어 두면 관리자가 바뀔 때 명단이 거짓이 된다. */
  function whoOf(uids) {
    var o = {};
    (uids || []).forEach(function (u) { var t = trim(u); if (t) o[t] = true; });
    return o;
  }

  /* ══ 담기 ═════════════════════════════════════════════════════════════ */

  function newId() {
    return 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function storage() {
    if (deps.storage) return deps.storage;
    try {
      if (global.firebase && global.firebase.app) {
        deps.storage = global.firebase.app().storage(BUCKET);
        return deps.storage;
      }
    } catch (e) { /* 꾸러미가 아직 없다 */ }
    return null;
  }

  /* 창고 자리 — 사람별로 가른다. 창고 규칙이 볼 수 있는 것은 이 «자리»뿐이다. */
  function pathOf(uid, docId, fileName) {
    var safe = String(fileName || 'file').replace(/[^\w.가-힣-]/g, '_').slice(-80);
    return DIR + '/' + trim(uid) + '/' + trim(docId) + '/' + safe;
  }

  /* 원본을 창고에 담고 «토큰 주소»를 돌려준다.
     ⚠ 서명 주소(signed URL)를 쓰지 않는다 — 그것은 시간이 지나면 죽는다.
       담당자가 반년 뒤에 열면 안 열린다. 토큰 주소는 안 죽는다.
     ⚠ 막히면 되던지지 않고 «왜»를 붙여 던진다 — 부르는 쪽이 사람에게 말한다. */
  function upload(file, docId) {
    var st = storage();
    if (!st) return Promise.reject(new Error('창고 꾸러미가 아직 안 실렸습니다'));
    if (!deps.uid) return Promise.reject(new Error('로그인 정보가 없습니다'));
    if (!file) return Promise.reject(new Error('파일이 없습니다'));
    if (file.size > MAX_BYTES) return Promise.reject(new Error('25MB 를 넘습니다 (' + Math.round(file.size / 1048576) + 'MB)'));
    var p = pathOf(deps.uid, docId, file.name);
    return st.ref(p).put(file).then(function (snap) {
      return snap.ref.getDownloadURL().then(function (url) {
        return { path: p, url: url, size: file.size };
      });
    });
  }

  /* 레코드·색인·본문을 «한 번에» 쓴다.
     ⚠ 따로 쓰면 목록에는 뜨는데 본체가 없는 유령이 남는다 — 사진첩에서 겪은 자리다. */
  function save(rec, text) {
    if (!deps.db) return Promise.reject(new Error('실시간DB 가 없습니다'));
    if (!rec || !rec.id) return Promise.reject(new Error('서면 번호가 없습니다'));
    var u = {}, row = rowOf(rec);
    u[ROOT + '/' + rec.id] = rec;
    Object.keys(rec.who || {}).forEach(function (uid) {
      u[IDX_ROOT + '/' + uid + '/' + rec.id] = row;
    });
    /* ⚠ byUid 를 본문 자리에도 적는다. 서버 규칙이 «쓰기 전» 모습만 보기 때문에
         erp_docs 를 보고 판정하면 처음 올리는 순간에 막힌다. */
    var t = trim(text);
    if (t) u[TEXT_ROOT + '/' + rec.id] = {
      t: t.slice(0, TEXT_MAX), cut: t.length > TEXT_MAX, byUid: trim(rec.byUid)
    };
    return deps.db.ref().update(u);
  }

  /* 새 서면 한 장을 짓는다 — 저장은 아직 안 한다. */
  function build(o) {
    o = o || {};
    var now = Date.now();
    return {
      id: trim(o.id) || newId(),
      entityType: 'Document',
      createdAt: now, updatedAt: now, at: now,
      kind: trim(o.kind), fileName: trim(o.fileName), ext: trim(o.ext),
      size: o.size || 0, path: trim(o.path), url: trim(o.url),
      sourceKind: trim(o.sourceKind), sourceId: trim(o.sourceId),
      companyId: trim(o.companyId), coName: trim(o.coName), caseNo: trim(o.caseNo),
      linkBy: trim(o.linkBy), ver: o.ver || 1,
      byUid: trim(o.byUid) || deps.uid, bySid: trim(o.bySid) || deps.sid,
      byName: trim(o.byName) || deps.name,
      hasRrn: !!o.hasRrn,
      who: whoOf((o.whoUids || []).concat([trim(o.byUid) || deps.uid]))
    };
  }

  /* 내 목록 — 색인 한 자리만 읽는다. 관리자는 통째로 읽는다. */
  function listMine() {
    if (!deps.db) return Promise.resolve([]);
    var where = deps.isAdmin ? IDX_ROOT : (IDX_ROOT + '/' + deps.uid);
    return deps.db.ref(where).once('value').then(function (snap) {
      var v = snap.val() || {}, out = [], seen = {};
      var eat = function (bag) {
        Object.keys(bag || {}).forEach(function (id) {
          var r = bag[id];
          if (!r || typeof r !== 'object' || seen[id]) return;
          seen[id] = 1; out.push(Object.assign({ id: id }, r));
        });
      };
      if (deps.isAdmin) Object.keys(v).forEach(function (uid) { eat(v[uid]); });
      else eat(v);
      out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
      return out;
    });
  }

  function read(docId) {
    if (!deps.db || !docId) return Promise.resolve(null);
    return deps.db.ref(ROOT + '/' + docId).once('value').then(function (s) { return s.val(); });
  }
  function readText(docId) {
    if (!deps.db || !docId) return Promise.resolve('');
    return deps.db.ref(TEXT_ROOT + '/' + docId).once('value')
      .then(function (s) { var v = s.val() || {}; return trim(v.t); })
      .catch(function () { return ''; });
  }

  /* 이미 담긴 서면을 «다른 곳에» 붙인다 — 붙일 곳을 못 찾아 남겨 둔 것을 사람이 고를 때.
     ⚠ 명단은 **더하기만** 한다(대표 결정 2026-08-28, 사진 공유와 같은 결).
       손으로 열어 둔 것이 저장 한 번에 조용히 끊기면 안 된다.
     ⚠ 원본 파일은 안 건드린다 — 옮기는 것은 «어디에 붙었나»뿐이다. */
  function reattach(rec, o) {
    if (!deps.db) return Promise.reject(new Error('실시간DB 가 없습니다'));
    if (!rec || !rec.id) return Promise.reject(new Error('서면 번호가 없습니다'));
    o = o || {};
    var next = Object.assign({}, rec, {
      sourceKind: trim(o.sourceKind), sourceId: trim(o.sourceId),
      companyId: trim(o.companyId), coName: trim(o.coName), caseNo: trim(o.caseNo),
      linkBy: trim(o.linkBy) || 'hand', ver: o.ver || rec.ver || 1,
      who: Object.assign({}, rec.who || {}, whoOf(o.whoUids || [])),
      updatedAt: Date.now()
    });
    var u = {}, row = rowOf(next);
    u[ROOT + '/' + next.id] = next;
    Object.keys(next.who).forEach(function (uid) { u[IDX_ROOT + '/' + uid + '/' + next.id] = row; });
    return deps.db.ref().update(u).then(function () { return next; });
  }

  global.PuErpDocBox = {
    init: init,
    ROOT: ROOT, IDX_ROOT: IDX_ROOT, TEXT_ROOT: TEXT_ROOT, BUCKET: BUCKET, DIR: DIR,
    MAX_BYTES: MAX_BYTES, TEXT_MAX: TEXT_MAX,
    flat: flat, digits: digits,
    hasRrn: hasRrn, findBiznos: findBiznos,
    caseNosOf: caseNosOf, contractNosOf: contractNosOf,
    match: match, guessKind: guessKind,
    verKeyOf: verKeyOf, nextVer: nextVer, rowOf: rowOf, whoOf: whoOf,
    pathOf: pathOf, newId: newId,
    build: build, upload: upload, save: save, listMine: listMine,
    read: read, readText: readText, reattach: reattach
  };
})(typeof window !== 'undefined' ? window : this);
