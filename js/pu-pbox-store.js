/* P박스 무과금(₩0) 다계층 저장소 · 실시간 법령 동기화 · 보안 격리 워크스페이스 어댑터
 *
 * 계층 구조:
 * - 1계층(기본·즉시 ₩0): 브라우저 IndexedDB
 *   · 공공 코퍼스: `pu_pbox_corpus_v1` (법령 캐시 · 공식/공유 검증 판례 · 공유 삭제 묘비명 tombstone)
 *   · 개인 작업공간: `pu_pbox_workspace_v1_<uid>` (개인 로컬 수집문서 `private_docs` · 사건 프로젝트 · AI 서면 이력 — 계정별 완전 분리 · 로그아웃 시 즉시 파기)
 * - 2계층(무료 공유 $0): 서버 인증 대리인(`exports.pboxApi` + Supabase `service_role`) 또는 직원 인증 JWT 연동
 *   · 비로그인 `anon` 쓰기 전면 차단, 사용자 수집 문서는 비식별 검토 확인(`shareConfirmed`) 시에만 공유 전송
 * - 3계층(AI 합성 + 인용 검증): `PuAiCall` 우선 호출 → 오프라인/한도 시 ₩0 내장 합성 자동 폴백 + 세션 세대(sessionGen) 격리 + 실제 조문/원문 대조 검증
 */
(function (global) {
  'use strict';

  var CORPUS_DB = 'pu_pbox_corpus_v1';
  var WORKSPACE_DB = 'pu_pbox_workspace_v1';
  var WORKSPACE_DB_VERSION = 2;
  var RAW_LAW_BASE = 'https://raw.githubusercontent.com/legalize-kr/legalize-kr/main/kr/';
  var PBOX_API_URL = 'https://asia-northeast3-pureun-erp.cloudfunctions.net/pboxApi';
  var CFG_LS_KEY = 'pu_pbox_sync_cfg_v1';

  /* 노무법인 실무 최우선 오프라인 보관 팩 (본법 + 주요 시행령) */
  var CORE_PACK_TARGETS = [
    { dir: '근로기준법', file: '법률(법률).md' },
    { dir: '근로기준법', file: '시행령.md' },
    { dir: '최저임금법', file: '법률.md' },
    { dir: '근로자퇴직급여보장법', file: '법률.md' },
    { dir: '근로자퇴직급여보장법', file: '시행령.md' },
    { dir: '임금채권보장법', file: '법률.md' },
    { dir: '기간제및단시간근로자보호등에관한법률', file: '법률.md' },
    { dir: '파견근로자보호등에관한법률', file: '법률.md' },
    { dir: '남녀고용평등과일ㆍ가정양립지원에관한법률', file: '법률.md' },
    { dir: '고용상연령차별금지및고령자고용촉진에관한법률', file: '법률.md' },
    { dir: '노동조합및노동관계조정법', file: '법률(법률).md' },
    { dir: '근로자참여및협력증진에관한법률', file: '법률(법률).md' },
    { dir: '노동위원회법', file: '법률(법률).md' },
    { dir: '산업재해보상보험법', file: '법률.md' },
    { dir: '산업재해보상보험법', file: '시행령.md' },
    { dir: '산업안전보건법', file: '법률.md' },
    { dir: '중대재해처벌등에관한법률', file: '법률.md' },
    { dir: '고용보험법', file: '법률.md' },
    { dir: '채용절차의공정화에관한법률', file: '법률.md' },
    { dir: '개인정보보호법', file: '법률.md' }
  ];

  var openHandles = new Map();
  var memByUid = new Map();       // IndexedDB 없는 환경에서도 UID별 개인 문서·작업공간 완전 격리 보장
  var sessionJwtByUid = new Map();// 직원 선택적 JWT는 localStorage에 절대 영구 저장하지 않고 현재 UID 세션 메모리에만 보관
  var lastDeleteSyncPromise = Promise.resolve({ ok: true, skipped: true });
  var sessionGen = 0;             // 계정 전환·로그아웃 시 진행 중인 비동기 init/AI 응답이 타 계정에 섞이는 것을 차단

  var mem = {
    uid: 'guest',
    laws: new Map(),          // key: dir + '/' + fileName -> parsedLaw
    publicDocs: [],           // 공공 기본 코퍼스(SEED_DOCS) + 공식/사무실 공유 동기화 문서만 보관
    privateDocs: [],          // 현재 로그인 UID 전용 로컬 수집 문서 (타 계정·로그아웃 후 비노출)
    docs: [],                 // 현재 세션을 위해 계산된 publicDocs + privateDocs 중복제거 뷰
    deletedDocKeys: new Set(),// 삭제 묘비명(id 및 canonicalKey) — 동기화·재수집 시 부활 방지
    projects: [],
    threads: [],
    recents: [],
    alerts: [],
    syncMeta: {
      lastSyncAt: '',
      lastTombstoneAt: '',
      lastTombstoneKey: '',
      krTreeSha: '',
      dedupMergedTotal: 0
    }
  };

  function stripUndefined(obj) {
    var out = {};
    if (!obj || typeof obj !== 'object') return out;
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (obj[k] !== undefined && !(k === 'id' && !obj[k])) {
        out[k] = obj[k];
      }
    }
    return out;
  }

  function sanitizeUid(uid) {
    var s = String(uid || '').trim();
    if (!s || s === 'guest') return '';
    return s.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 96);
  }

  function workspaceDbNameFor(uid) {
    var clean = sanitizeUid(uid);
    return clean ? (WORKSPACE_DB + '_' + clean) : '';
  }

  function saveUidSnapshot() {
    var clean = sanitizeUid(mem.uid);
    if (!clean) return;
    memByUid.set(clean, {
      privateDocs: mem.privateDocs.slice(),
      projects: mem.projects.slice(),
      threads: mem.threads.slice(),
      recents: mem.recents.slice()
    });
  }

  function makeStaleSessionError() {
    var err = new Error('계정이 변경되었거나 로그아웃되어 이전 세션의 비동기 작업을 중단했습니다.');
    err.staleSession = true;
    return err;
  }

  /* ── IndexedDB 경량 래퍼 (연결 핸들 추적 · 닫기 후 삭제 보장) ── */
  function openDb(dbName, stores, version) {
    if (!dbName) return Promise.resolve(null);
    if (openHandles.has(dbName)) {
      return Promise.resolve(openHandles.get(dbName));
    }
    return new Promise(function (resolve) {
      if (typeof indexedDB === 'undefined' || !indexedDB.open) {
        resolve(null);
        return;
      }
      try {
        var req = indexedDB.open(dbName, version || 1);
        req.onupgradeneeded = function (ev) {
          var db = ev.target.result;
          for (var i = 0; i < stores.length; i++) {
            if (!db.objectStoreNames.contains(stores[i].name)) {
              db.createObjectStore(stores[i].name, { keyPath: stores[i].keyPath });
            }
          }
        };
        req.onsuccess = function () {
          var db = req.result;
          db.onversionchange = function () {
            try { db.close(); } catch (e) {}
            openHandles.delete(dbName);
          };
          openHandles.set(dbName, db);
          resolve(db);
        };
        req.onerror = function () { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
  }

  function closeDbByName(dbName) {
    if (!dbName) return;
    var db = openHandles.get(dbName);
    if (db) {
      try { db.close(); } catch (e) {}
      openHandles.delete(dbName);
    }
  }

  function closeAllWorkspaceHandles() {
    Array.from(openHandles.keys()).forEach(function (name) {
      if (name === WORKSPACE_DB || name.indexOf(WORKSPACE_DB + '_') === 0) {
        closeDbByName(name);
      }
    });
  }

  function deleteDbSafe(dbName) {
    if (!dbName) return Promise.resolve(false);
    closeDbByName(dbName);
    if (typeof indexedDB === 'undefined' || !indexedDB.deleteDatabase) {
      return Promise.resolve(false);
    }
    return new Promise(function (resolve) {
      try {
        var req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = function () { resolve(true); };
        req.onerror = function () { resolve(false); };
        req.onblocked = function () {
          closeDbByName(dbName);
          resolve(false);
        };
      } catch (e) {
        resolve(false);
      }
    });
  }

  function getCorpusDb() {
    return openDb(CORPUS_DB, [
      { name: 'laws', keyPath: 'cacheKey' },
      { name: 'docs', keyPath: 'id' },
      { name: 'meta', keyPath: 'key' }
    ], 1);
  }

  function getWorkspaceDbForUid(uid) {
    var dbName = workspaceDbNameFor(uid);
    if (!dbName) return Promise.resolve(null);
    return openDb(dbName, [
      { name: 'private_docs', keyPath: 'id' },
      { name: 'projects', keyPath: 'id' },
      { name: 'threads', keyPath: 'id' },
      { name: 'recents', keyPath: 'id' }
    ], WORKSPACE_DB_VERSION);
  }

  function getWorkspaceDb() {
    return getWorkspaceDbForUid(mem.uid);
  }

  function idbGetAll(dbPromise, storeName) {
    return dbPromise.then(function (db) {
      if (!db || !db.objectStoreNames.contains(storeName)) return [];
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(storeName, 'readonly');
          var req = tx.objectStore(storeName).getAll();
          req.onsuccess = function () { resolve(req.result || []); };
          req.onerror = function () { resolve([]); };
        } catch (e) { resolve([]); }
      });
    });
  }

  function idbPut(dbPromise, storeName, val) {
    return dbPromise.then(function (db) {
      if (!db || !db.objectStoreNames.contains(storeName) || !val || !val[storeKeyOf(storeName)]) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).put(val);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }

  function storeKeyOf(storeName) {
    if (storeName === 'laws') return 'cacheKey';
    if (storeName === 'meta') return 'key';
    return 'id';
  }

  function idbDelete(dbPromise, storeName, key) {
    return dbPromise.then(function (db) {
      if (!db || !db.objectStoreNames.contains(storeName) || !key) return false;
      return new Promise(function (resolve) {
        try {
          var tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).delete(key);
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { resolve(false); };
        } catch (e) { resolve(false); }
      });
    });
  }

  /* ── 설정 읽기/쓰기 (인증 JWT는 영구 저장소 localStorage에 절대 쓰지 않고 현재 로그인 UID 메모리에만 귀속) ── */
  function getConfig() {
    var cleanUid = sanitizeUid(mem.uid);
    var sessionJwt = cleanUid ? String(sessionJwtByUid.get(cleanUid) || '') : '';
    try {
      var raw = localStorage.getItem(CFG_LS_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      /* 과거 버전에 평문 저장된 토큰이 남아 있으면 즉시 걷어낸다 */
      if (parsed && (parsed.supabaseStaffJwt || parsed.supabaseAnonKey)) {
        delete parsed.supabaseStaffJwt;
        delete parsed.supabaseAnonKey;
        try { localStorage.setItem(CFG_LS_KEY, JSON.stringify(parsed)); } catch (e2) {}
      }
      return {
        supabaseUrl: String(parsed.supabaseUrl || '').trim().replace(/\/+$/, ''),
        supabaseStaffJwt: sessionJwt,
        lawOc: String(parsed.lawOc || '').trim(),
        autoSyncOnBoot: parsed.autoSyncOnBoot !== false,
        preferOfflineAi: parsed.preferOfflineAi === true
      };
    } catch (e) {
      return { supabaseUrl: '', supabaseStaffJwt: sessionJwt, lawOc: '', autoSyncOnBoot: true, preferOfflineAi: false };
    }
  }

  function saveConfig(nextCfg) {
    var cur = getConfig();
    var incoming = stripUndefined(nextCfg || {});
    var cleanUid = sanitizeUid(mem.uid);
    if (Object.prototype.hasOwnProperty.call(incoming, 'supabaseStaffJwt')) {
      var nextJwt = String(incoming.supabaseStaffJwt || '').trim();
      if (cleanUid && nextJwt) sessionJwtByUid.set(cleanUid, nextJwt);
      else if (cleanUid) sessionJwtByUid.delete(cleanUid);
    }
    var persisted = {
      supabaseUrl: incoming.supabaseUrl !== undefined ? String(incoming.supabaseUrl || '').trim().replace(/\/+$/, '') : cur.supabaseUrl,
      lawOc: incoming.lawOc !== undefined ? String(incoming.lawOc || '').trim() : cur.lawOc,
      autoSyncOnBoot: incoming.autoSyncOnBoot !== undefined ? (incoming.autoSyncOnBoot !== false) : cur.autoSyncOnBoot,
      preferOfflineAi: incoming.preferOfflineAi !== undefined ? (incoming.preferOfflineAi === true) : cur.preferOfflineAi
    };
    try { localStorage.setItem(CFG_LS_KEY, JSON.stringify(persisted)); } catch (e) {}
    return getConfig();
  }

  function hasSupabase() {
    var c = getConfig();
    return !!(c.supabaseUrl && c.supabaseStaffJwt);
  }

  function isDocTombstoned(doc) {
    if (!doc) return false;
    if (doc.id && mem.deletedDocKeys.has(String(doc.id))) return true;
    if (doc.canonicalKey && mem.deletedDocKeys.has(String(doc.canonicalKey))) return true;
    if (doc.serverCanonicalKey && mem.deletedDocKeys.has(String(doc.serverCanonicalKey))) return true;
    var E = global.PuPBoxEngine;
    if (E) {
      var ck = E.canonicalKeyOf(doc);
      if (ck && mem.deletedDocKeys.has(ck)) return true;
      if (typeof E.serverCanonicalKeyOf === 'function') {
        var sck = E.serverCanonicalKeyOf(doc, doc.ownerUid || doc.ingestedBy || mem.uid);
        if (sck && mem.deletedDocKeys.has(sck)) return true;
      }
    }
    return false;
  }

  function rebuildEffectiveDocs() {
    var E = global.PuPBoxEngine;
    var C = global.PuPBoxCorpus;
    var seedDocs = (C && C.SEED_DOCS) ? C.SEED_DOCS : [];
    var basePub = mem.publicDocs.length ? mem.publicDocs : seedDocs;
    var cleanPub = basePub.filter(function (d) { return !isDocTombstoned(d); });
    var cleanPriv = mem.privateDocs.filter(function (d) { return !isDocTombstoned(d); });
    mem.docs = E ? E.deduplicateDocs(cleanPub, cleanPriv).docs : cleanPub.concat(cleanPriv);
    return mem.docs;
  }

  /* ── 초기 부팅 및 계정 전환: 세션 세대(sessionGen) 보호 + UID별 개인 수집문서/작업공간 완전 분리 ── */
  function init(uid) {
    var myGen = ++sessionGen;
    var prevUid = mem.uid;
    var nextUid = sanitizeUid(uid) ? String(uid).trim() : 'guest';
    if (prevUid !== nextUid) {
      saveUidSnapshot();
      closeAllWorkspaceHandles();
      mem.privateDocs = [];
      mem.projects = [];
      mem.threads = [];
      mem.recents = [];
    }
    mem.uid = nextUid;

    var E = global.PuPBoxEngine;
    var C = global.PuPBoxCorpus;
    var seedDocs = (C && C.SEED_DOCS) ? C.SEED_DOCS : [];
    var idxMeta = global.PuPBoxLawIndex || {};
    if (!mem.syncMeta.krTreeSha && idxMeta.KR_TREE_SHA) {
      mem.syncMeta.krTreeSha = idxMeta.KR_TREE_SHA;
    }

    var cleanUid = sanitizeUid(nextUid);
    var hasIdb = typeof indexedDB !== 'undefined' && !!indexedDB.open;
    var wsDbPromise = cleanUid ? getWorkspaceDbForUid(nextUid) : Promise.resolve(null);

    return Promise.all([
      idbGetAll(getCorpusDb(), 'laws'),
      idbGetAll(getCorpusDb(), 'docs'),
      idbGetAll(getCorpusDb(), 'meta'),
      cleanUid ? idbGetAll(wsDbPromise, 'private_docs') : Promise.resolve([]),
      cleanUid ? idbGetAll(wsDbPromise, 'projects') : Promise.resolve([]),
      cleanUid ? idbGetAll(wsDbPromise, 'threads') : Promise.resolve([]),
      cleanUid ? idbGetAll(wsDbPromise, 'recents') : Promise.resolve([])
    ]).then(function (res) {
      /* 복원 도중 다른 계정으로 바뀌었거나 로그아웃되었다면 지연된 복원 결과를 즉시 폐기 */
      if (myGen !== sessionGen || mem.uid !== nextUid) {
        return getStateSummary();
      }

      var savedLaws = res[0] || [];
      var savedPublicDocs = res[1] || [];
      var savedMeta = res[2] || [];
      var savedPrivateDocs = res[3] || [];
      var savedProjects = res[4] || [];
      var savedThreads = res[5] || [];
      var savedRecents = res[6] || [];

      if (!hasIdb && cleanUid && memByUid.has(cleanUid)) {
        var snap = memByUid.get(cleanUid);
        savedPrivateDocs = (snap.privateDocs || []).slice();
        savedProjects = (snap.projects || []).slice();
        savedThreads = (snap.threads || []).slice();
        savedRecents = (snap.recents || []).slice();
      }

      for (var m = 0; m < savedMeta.length; m++) {
        if (savedMeta[m].key === 'syncMeta') {
          mem.syncMeta = Object.assign({}, mem.syncMeta, savedMeta[m].value || {});
        } else if (savedMeta[m].key === 'alerts') {
          mem.alerts = Array.isArray(savedMeta[m].value) ? savedMeta[m].value : [];
        } else if (savedMeta[m].key === 'deletedDocKeys' && Array.isArray(savedMeta[m].value)) {
          savedMeta[m].value.forEach(function (k) { mem.deletedDocKeys.add(k); });
        }
      }

      if (hasIdb) {
        mem.laws.clear();
        for (var i = 0; i < savedLaws.length; i++) {
          if (savedLaws[i] && savedLaws[i].cacheKey) {
            mem.laws.set(savedLaws[i].cacheKey, savedLaws[i]);
          }
        }
      }

      /* 과거 버전에 corpus DB로 잘못 들어간 로컬 개인 수집문서(userIngested)는 공통 코퍼스에서 제외 */
      var cleanSavedPublic = savedPublicDocs.filter(function (d) {
        return d && !d.userIngested && !isDocTombstoned(d);
      });
      var basePublic = !hasIdb && mem.publicDocs.length
        ? mem.publicDocs.filter(function (d) { return !d.userIngested && !isDocTombstoned(d); })
        : cleanSavedPublic;

      mem.publicDocs = E.deduplicateDocs(seedDocs, basePublic).docs;
      mem.privateDocs = cleanUid
        ? savedPrivateDocs.filter(function (d) { return !isDocTombstoned(d); })
        : [];
      rebuildEffectiveDocs();

      mem.projects = cleanUid
        ? savedProjects.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })
        : [];
      if (cleanUid) {
        var sortedInitThreads = savedThreads.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
        mem.threads = sortedInitThreads.slice(0, 60);
        if (sortedInitThreads.length > 60) {
          var initWsDb = getWorkspaceDb();
          sortedInitThreads.slice(60).forEach(function (evicted) {
            if (evicted && evicted.id) idbDelete(initWsDb, 'threads', evicted.id);
          });
        }
      } else {
        mem.threads = [];
      }
      mem.recents = cleanUid
        ? savedRecents.sort(function (a, b) { return (b.viewedAt || 0) - (a.viewedAt || 0); }).slice(0, 30)
        : [];

      if (!mem.alerts.length) {
        mem.alerts = [
          {
            id: 'init-alert-1',
            date: E.todayKstYmd(),
            kind: 'system',
            title: '국가법령 5,773편 무료 미러 연결 완료 (law.go.kr 점검 중에도 즉시 열람)',
            detail: '법제처 국가법령정보센터 시스템 점검과 무관하게 법률·시행령·시행규칙 전문 열람 및 @AI 첨부가 작동합니다.'
          },
          {
            id: 'init-alert-2',
            date: '2024-12-19',
            kind: 'prec',
            title: '대법원 전원합의체 2020다247190·2023다302838 통상임금 고정성 폐기 법리 수록',
            detail: '재직조건부·소정근로일수 이내 근무일수 조건부 정기상여금의 통상임금 산입 판례 및 2025 고용노동부 지침이 기본 코퍼스에 반영되어 있습니다.'
          }
        ];
      }

      return getStateSummary();
    });
  }

  function getStateSummary() {
    var idx = global.PuPBoxLawIndex;
    return {
      uid: mem.uid,
      sessionGen: sessionGen,
      totalNationalLaws: idx ? idx.TOTAL_FILES : 5773,
      totalLawFamilies: idx ? idx.TOTAL_FAMILIES : 3060,
      cachedLawsCount: mem.laws.size,
      docsCount: mem.docs.length,
      projectsCount: mem.projects.length,
      threadsCount: mem.threads.length,
      recentsCount: mem.recents.length,
      alertsCount: mem.alerts.length,
      supabaseConnected: hasSupabase(),
      lastSyncAt: mem.syncMeta.lastSyncAt || ''
    };
  }

  /* ── 실시간 법령 전문 가져오기 (무료·무인증 CDN + IndexedDB 영구 캐시 + 개정 감지) ── */
  function fetchLaw(dir, fileName, opts) {
    opts = opts || {};
    var fName = fileName || '법률.md';
    if (!/\.md$/.test(fName)) fName += '.md';
    var cacheKey = dir + '/' + fName;

    if (!opts.force && mem.laws.has(cacheKey)) {
      return Promise.resolve(mem.laws.get(cacheKey));
    }

    var idxList = (global.PuPBoxLawIndex && global.PuPBoxLawIndex.list) ? global.PuPBoxLawIndex.list() : [];
    var fam = idxList.find(function (x) { return x.dir === dir; }) || null;
    if (!fileName && fam && fam.primaryFile) {
      fName = fam.primaryFile;
      cacheKey = dir + '/' + fName;
      if (!opts.force && mem.laws.has(cacheKey)) {
        return Promise.resolve(mem.laws.get(cacheKey));
      }
    }

    var url = RAW_LAW_BASE + encodeURIComponent(dir) + '/' + encodeURIComponent(fName);
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('법령 원문 호출 실패 (HTTP ' + res.status + ')');
      return res.text();
    }).then(function (mdText) {
      var parsed = global.PuPBoxEngine.parseLawMarkdown(mdText, {
        dir: dir,
        fileName: fName,
        title: fam ? fam.title : dir,
        dept: fam ? fam.dept : ''
      });
      parsed.cacheKey = cacheKey;
      parsed.fetchedAt = new Date().toISOString();

      var prev = mem.laws.get(cacheKey);
      if (prev && prev.effectiveDate && parsed.effectiveDate && prev.effectiveDate !== parsed.effectiveDate) {
        addAlert({
          kind: 'law_amend',
          title: '[법령 개정 감지] ' + parsed.title + ' (' + prev.effectiveDate + ' → ' + parsed.effectiveDate + ' 시행)',
          detail: '공포번호 제' + (parsed.promulgationNo || '-') + '호 개정본이 자동 반영되었습니다.'
        });
      }

      mem.laws.set(cacheKey, parsed);
      idbPut(getCorpusDb(), 'laws', parsed);
      return parsed;
    });
  }

  /* 노무 핵심 20편 일괄 오프라인 적재 (네트워크 실패 시 거짓 lastSyncAt 갱신 금지) */
  function syncCoreLaborLaws(onProgress) {
    var total = CORE_PACK_TARGETS.length;
    var done = 0;
    var succeeded = 0;
    var idx = 0;
    var concurrency = 4;
    var errors = [];

    function worker() {
      if (idx >= total) return Promise.resolve();
      var item = CORE_PACK_TARGETS[idx++];
      return fetchLaw(item.dir, item.file, { force: false })
        .then(function () { succeeded++; })
        .catch(function (e) { errors.push(item.dir + ': ' + String((e && e.message) || e)); })
        .then(function () {
          done++;
          if (typeof onProgress === 'function') {
            onProgress({ done: done, total: total, current: item.dir + ' ' + item.file.replace(/\.md$/, '') });
          }
          return worker();
        });
    }

    var workers = [];
    for (var w = 0; w < concurrency; w++) workers.push(worker());
    return Promise.all(workers).then(function () {
      var fullOk = succeeded > 0 && errors.length === 0;
      if (fullOk) {
        mem.syncMeta.lastSyncAt = new Date().toISOString();
        idbPut(getCorpusDb(), 'meta', { key: 'syncMeta', value: mem.syncMeta });
        addAlert({
          kind: 'sync',
          title: '노무·산재 핵심 법령 ' + succeeded + '편 오프라인 전문 보관 완료',
          detail: '근로기준법·산재보험법·노조법·중대재해처벌법 등 주요 본법·시행령 조문 전체 검색이 활성화되었습니다.'
        });
      }
      return {
        ok: fullOk,
        partial: succeeded > 0 && errors.length > 0,
        total: total,
        succeeded: succeeded,
        loaded: mem.laws.size,
        errors: errors
      };
    });
  }

  /* Git 트리 SHA 비교를 통한 전 캐시 법령 누락 없는 갱신 + 실패 시 커서 보류 */
  function refreshAllCachedLaws() {
    var cachedKeys = Array.from(mem.laws.keys());
    if (!cachedKeys.length) return Promise.resolve({ refreshed: 0, failed: 0 });
    var cursor = 0;
    var refreshed = 0;
    var failed = 0;
    var concurrency = 5;

    function nextWorker() {
      if (cursor >= cachedKeys.length) return Promise.resolve();
      var ck = cachedKeys[cursor++];
      var slashIdx = ck.indexOf('/');
      var dir = slashIdx >= 0 ? ck.slice(0, slashIdx) : ck;
      var file = slashIdx >= 0 ? ck.slice(slashIdx + 1) : '법률.md';
      return fetchLaw(dir, file, { force: true })
        .then(function () { refreshed++; })
        .catch(function () { failed++; })
        .then(nextWorker);
    }

    var pool = [];
    for (var i = 0; i < Math.min(concurrency, cachedKeys.length); i++) {
      pool.push(nextWorker());
    }
    return Promise.all(pool).then(function () {
      return { refreshed: refreshed, failed: failed };
    });
  }

  function applyServerDeletedKeys(deletedKeys, latestDeletedAt, latestDeletedKey) {
    if (latestDeletedAt) {
      var nextAt = String(latestDeletedAt);
      var nextKey = latestDeletedKey ? String(latestDeletedKey) : '';
      var prevAt = String(mem.syncMeta.lastTombstoneAt || '');
      var prevKey = String(mem.syncMeta.lastTombstoneKey || '');
      if (!prevAt || nextAt > prevAt || (nextAt === prevAt && nextKey > prevKey)) {
        mem.syncMeta.lastTombstoneAt = nextAt;
        mem.syncMeta.lastTombstoneKey = nextKey;
        idbPut(getCorpusDb(), 'meta', { key: 'syncMeta', value: mem.syncMeta });
      }
    }
    if (!Array.isArray(deletedKeys) || !deletedKeys.length) return;
    var E = global.PuPBoxEngine;
    var changed = false;
    deletedKeys.forEach(function (ck) {
      if (ck && !mem.deletedDocKeys.has(ck)) {
        mem.deletedDocKeys.add(ck);
        changed = true;
      }
    });
    if (!changed) return;
    var seedIds = new Set(((global.PuPBoxCorpus && global.PuPBoxCorpus.SEED_DOCS) || []).map(function (d) { return d.id; }));
    function matchesDeletedKey(d) {
      var ck = d.canonicalKey || (E ? E.canonicalKeyOf(d) : '');
      if (ck && mem.deletedDocKeys.has(ck)) return true;
      var sck = d.serverCanonicalKey || ((E && E.serverCanonicalKeyOf) ? E.serverCanonicalKeyOf(d, d.ownerUid || d.ingestedBy || mem.uid) : '');
      return !!(sck && mem.deletedDocKeys.has(sck));
    }
    mem.publicDocs = mem.publicDocs.filter(function (d) {
      if (seedIds.has(d.id)) return true;
      if (matchesDeletedKey(d)) {
        idbDelete(getCorpusDb(), 'docs', d.id);
        return false;
      }
      return true;
    });
    var wsDb = getWorkspaceDb();
    mem.privateDocs = mem.privateDocs.filter(function (d) {
      if (matchesDeletedKey(d)) {
        idbDelete(wsDb, 'private_docs', d.id);
        return false;
      }
      return true;
    });
    saveUidSnapshot();
    idbPut(getCorpusDb(), 'meta', { key: 'deletedDocKeys', value: Array.from(mem.deletedDocKeys) });
    rebuildEffectiveDocs();
  }

  function runIncrementalSync(opts) {
    opts = opts || {};
    var errors = [];
    var summary = {
      ok: true,
      partial: false,
      treeChanged: false,
      refreshedLaws: 0,
      failedLaws: 0,
      supabasePulled: 0,
      serverPulled: 0,
      errors: errors
    };

    var pTree = fetch('https://api.github.com/repos/legalize-kr/legalize-kr/git/trees/main')
      .then(function (r) {
        if (!r.ok) throw new Error('GitHub 법령 트리 조회 실패 (HTTP ' + r.status + ')');
        return r.json();
      })
      .then(function (j) {
        if (!j || !Array.isArray(j.tree)) throw new Error('GitHub 법령 트리 응답 형식 오류');
        var kr = j.tree.find(function (t) { return t.path === 'kr'; });
        if (!kr || !kr.sha) throw new Error('kr 법령 트리 해시 누락');
        if (mem.syncMeta.krTreeSha && mem.syncMeta.krTreeSha !== kr.sha) {
          summary.treeChanged = true;
          return refreshAllCachedLaws().then(function (rf) {
            summary.refreshedLaws = rf.refreshed;
            summary.failedLaws = rf.failed;
            if (rf.failed === 0) {
              mem.syncMeta.krTreeSha = kr.sha;
            } else {
              errors.push('캐시 법령 갱신 실패 ' + rf.failed + '건');
            }
          });
        }
        mem.syncMeta.krTreeSha = kr.sha;
      })
      .catch(function (e) {
        errors.push('legalize-kr: ' + String((e && e.message) || e));
      });

    var pSupa = hasSupabase()
      ? pullFromSupabase()
          .then(function (r) { summary.supabasePulled = r.added || 0; })
          .catch(function (e) { errors.push('supabase: ' + String((e && e.message) || e)); })
      : Promise.resolve();

    var pServer = opts.callServer
      ? callServerSync(opts.auth)
          .then(function (r) {
            summary.serverPulled = (r && r.added) || 0;
            if (r && r.ok === false && Array.isArray(r.errors)) {
              r.errors.forEach(function (er) { errors.push(er); });
            }
          })
          .catch(function (e) { errors.push('server: ' + String((e && e.message) || e)); })
      : Promise.resolve();

    return Promise.all([pTree, pSupa, pServer]).then(function () {
      summary.ok = errors.length === 0 && summary.failedLaws === 0;
      summary.partial = !summary.ok && (summary.refreshedLaws > 0 || summary.supabasePulled > 0 || summary.serverPulled > 0);
      /* 모든 요청된 동기화 단계가 정상 완료되었을 때만 lastSyncAt 갱신 */
      if (summary.ok) {
        mem.syncMeta.lastSyncAt = new Date().toISOString();
        idbPut(getCorpusDb(), 'meta', { key: 'syncMeta', value: mem.syncMeta });
      }
      return summary;
    });
  }

  /* ── 문서 추가 (개인 로컬 수집문서는 현재 UID 작업공간에만 격리 · 공유 동기화 문서만 공통 코퍼스 적재) ── */
  function addDocuments(incomingList, opts) {
    opts = opts || {};
    if ((opts.expectedGen !== undefined && opts.expectedGen !== sessionGen) ||
        (opts.expectedUid !== undefined && opts.expectedUid !== mem.uid)) {
      throw makeStaleSessionError();
    }
    var E = global.PuPBoxEngine;
    var isPublicScope = opts.scope === 'public';
    var activeOwner = (opts.auth && opts.auth.currentUser && opts.auth.currentUser.uid)
      ? String(opts.auth.currentUser.uid).trim()
      : mem.uid;

    var cleanIncoming = (Array.isArray(incomingList) ? incomingList : []).filter(function (d) {
      if (!d || typeof d !== 'object') return false;
      if (String(d.body || '').trim().length < 20) return false;
      if (opts.overrideDeleted) {
        if (d.id) mem.deletedDocKeys.delete(String(d.id));
        var ck = E.canonicalKeyOf(d);
        if (ck) mem.deletedDocKeys.delete(ck);
        if (E.serverCanonicalKeyOf) {
          var sck = E.serverCanonicalKeyOf(scrubFullDocClient(d), d.ownerUid || activeOwner);
          if (sck) mem.deletedDocKeys.delete(sck);
        }
        return true;
      }
      return !isDocTombstoned(d);
    });

    var res;
    if (isPublicScope) {
      var C = global.PuPBoxCorpus;
      var basePub = mem.publicDocs.length ? mem.publicDocs : ((C && C.SEED_DOCS) ? C.SEED_DOCS : []);
      res = E.deduplicateDocs(basePub, cleanIncoming);
      mem.publicDocs = res.docs;
      var seedIds = new Set(((C && C.SEED_DOCS) || []).map(function (d) { return d.id; }));
      var toPersistPub = mem.publicDocs.filter(function (d) { return !seedIds.has(d.id) || d.dupMergedCount > 0; });
      for (var p = 0; p < toPersistPub.length; p++) {
        idbPut(getCorpusDb(), 'docs', toPersistPub[p]);
      }
    } else {
      /* 비공유/사용자 수집 문서는 현재 UID의 개인 작업공간(privateDocs / WORKSPACE_DB)에 서버 동일 canonicalKey와 함께 저장 */
      var markedPrivate = cleanIncoming.map(function (d) {
        var scrubbedForKey = scrubFullDocClient(d);
        var serverCk = (E && E.serverCanonicalKeyOf) ? E.serverCanonicalKeyOf(scrubbedForKey, activeOwner) : '';
        return Object.assign({}, d, {
          userIngested: true,
          ownerUid: mem.uid,
          sharedToOffice: opts.shareConfirmed === true,
          serverCanonicalKey: d.serverCanonicalKey || serverCk
        });
      });
      res = E.deduplicateDocs(mem.privateDocs, markedPrivate);
      mem.privateDocs = res.docs;
      saveUidSnapshot();
      var wsDb = getWorkspaceDb();
      for (var i = 0; i < mem.privateDocs.length; i++) {
        idbPut(wsDb, 'private_docs', mem.privateDocs[i]);
      }
    }

    var mergedCnt = res.stats.mergedStage1 + res.stats.mergedStage2 + res.stats.mergedStage3;
    mem.syncMeta.dedupMergedTotal = (Number(mem.syncMeta.dedupMergedTotal) || 0) + mergedCnt;
    idbPut(getCorpusDb(), 'meta', { key: 'syncMeta', value: mem.syncMeta });
    if (opts.overrideDeleted) {
      idbPut(getCorpusDb(), 'meta', { key: 'deletedDocKeys', value: Array.from(mem.deletedDocKeys) });
    }
    rebuildEffectiveDocs();

    /* 사용자 수집 문서는 비식별 결과를 확인하고 shareConfirmed === true 를 명시했을 때만 공유 서버로 전송하며, 오류를 삼키지 않고 결과/콜백 전달 */
    if (opts.shareConfirmed === true && cleanIncoming.length) {
      var pushGen = sessionGen;
      var pushUid = mem.uid;
      var incomingByPredictedKey = new Map();
      cleanIncoming.forEach(function (d) {
        var pred = (E && E.serverCanonicalKeyOf) ? E.serverCanonicalKeyOf(scrubFullDocClient(d), activeOwner) : '';
        if (pred) incomingByPredictedKey.set(pred, d.id);
      });
      res.stats.syncPromise = pushDocsToSharedServer(cleanIncoming, opts.auth, {})
        .then(function (srvRes) {
          if (pushGen === sessionGen && pushUid === mem.uid) {
            var wsDb2 = getWorkspaceDb();
            var acceptedSet = new Set(Array.isArray(srvRes && srvRes.canonicalKeys) ? srvRes.canonicalKeys : []);
            incomingByPredictedKey.forEach(function (docId, predKey) {
              var targetDoc = mem.privateDocs.find(function (x) { return x.id === docId; });
              if (!targetDoc) return;
              if (acceptedSet.has(predKey)) {
                targetDoc.serverCanonicalKey = predKey;
                targetDoc.sharedToOffice = true;
              } else if (acceptedSet.size > 0) {
                targetDoc.sharedToOffice = false;
              }
              idbPut(wsDb2, 'private_docs', targetDoc);
            });
            saveUidSnapshot();
            rebuildEffectiveDocs();
          }
          if (typeof opts.onSyncSuccess === 'function') opts.onSyncSuccess(srvRes);
          return Object.assign({ ok: true }, srvRes);
        })
        .catch(function (err) {
          if (pushGen === sessionGen && pushUid === mem.uid) {
            var wsDbErr = getWorkspaceDb();
            incomingByPredictedKey.forEach(function (docId) {
              var targetDoc = mem.privateDocs.find(function (x) { return x.id === docId; });
              if (targetDoc) {
                targetDoc.sharedToOffice = false;
                idbPut(wsDbErr, 'private_docs', targetDoc);
              }
            });
            saveUidSnapshot();
            rebuildEffectiveDocs();
          }
          if (typeof opts.onSyncError === 'function') opts.onSyncError(err);
          return { ok: false, error: String((err && err.message) || err) };
        });
    }

    return res.stats;
  }

  function deleteDocuments(ids, opts) {
    opts = opts || {};
    if ((opts.expectedGen !== undefined && opts.expectedGen !== sessionGen) ||
        (opts.expectedUid !== undefined && opts.expectedUid !== mem.uid)) {
      throw makeStaleSessionError();
    }
    var E = global.PuPBoxEngine;
    var set = new Set(ids || []);
    var seedIds = new Set(((global.PuPBoxCorpus && global.PuPBoxCorpus.SEED_DOCS) || []).map(function (d) { return d.id; }));
    var removed = 0;
    var deletedCkSet = new Set();
    var wsDb = getWorkspaceDb();
    var activeOwner = (opts.auth && opts.auth.currentUser && opts.auth.currentUser.uid)
      ? String(opts.auth.currentUser.uid).trim()
      : mem.uid;

    function recordDelete(d) {
      removed++;
      mem.deletedDocKeys.add(String(d.id));
      var ck = d.canonicalKey || (E ? E.canonicalKeyOf(d) : '');
      if (ck) {
        mem.deletedDocKeys.add(ck);
        deletedCkSet.add(ck);
      }
      var sck = d.serverCanonicalKey || ((E && E.serverCanonicalKeyOf) ? E.serverCanonicalKeyOf(scrubFullDocClient(d), d.ownerUid || d.ingestedBy || activeOwner) : '');
      if (sck) {
        mem.deletedDocKeys.add(sck);
        deletedCkSet.add(sck);
      }
    }

    mem.privateDocs = mem.privateDocs.filter(function (d) {
      if (!set.has(d.id)) return true;
      recordDelete(d);
      idbDelete(wsDb, 'private_docs', d.id);
      return false;
    });

    mem.publicDocs = mem.publicDocs.filter(function (d) {
      if (!set.has(d.id)) return true;
      if (seedIds.has(d.id)) return true; // 기본 검증 코퍼스는 보호
      recordDelete(d);
      idbDelete(getCorpusDb(), 'docs', d.id);
      return false;
    });

    var deletedCks = Array.from(deletedCkSet);
    if (removed > 0) {
      saveUidSnapshot();
      rebuildEffectiveDocs();
      idbPut(getCorpusDb(), 'meta', { key: 'deletedDocKeys', value: Array.from(mem.deletedDocKeys) });
      if (deletedCks.length && opts.auth && opts.auth.currentUser) {
        lastDeleteSyncPromise = deleteDocsFromSharedServer(deletedCks, opts.auth)
          .then(function (srvDel) {
            if (typeof opts.onSyncSuccess === 'function') opts.onSyncSuccess(srvDel);
            return Object.assign({ ok: true }, srvDel);
          })
          .catch(function (err) {
            if (typeof opts.onSyncError === 'function') opts.onSyncError(err);
            return { ok: false, error: String((err && err.message) || err) };
          });
      } else {
        lastDeleteSyncPromise = Promise.resolve({ ok: true, deleted: 0, skipped: true, deletedCks: deletedCks });
      }
    }
    return removed;
  }

  /* ── 수파베이스 직원 JWT 읽기 & 서버 대리인(`exports.pboxApi`) 공유 어댑터 ── */
  function supaStaffHeaders(cfg) {
    return {
      'Content-Type': 'application/json',
      'apikey': cfg.supabaseStaffJwt,
      'Authorization': 'Bearer ' + cfg.supabaseStaffJwt
    };
  }

  function testSupabaseConnection(customCfg) {
    var cfg = customCfg || getConfig();
    if (!cfg.supabaseUrl || !cfg.supabaseStaffJwt) {
      return Promise.reject(new Error('Supabase HTTPS URL과 직원 인증 JWT(또는 서버 대리인 연동)를 입력해 주세요.'));
    }
    if (!/^https:\/\//i.test(cfg.supabaseUrl)) {
      return Promise.reject(new Error('보안을 위해 https:// 로 시작하는 Supabase URL만 허용됩니다.'));
    }
    var url = cfg.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/pbox_documents?select=id&limit=1';
    return fetch(url, { headers: supaStaffHeaders(cfg) }).then(function (r) {
      if (!r.ok) throw new Error('수파베이스 인증·RLS 응답 오류 (HTTP ' + r.status + ')');
      return { ok: true };
    });
  }

  function scrubFullDocClient(d) {
    var E = global.PuPBoxEngine;
    if (!E) return d;
    var asArr = function (v) { return Array.isArray(v) ? v : []; };
    var rawTags = asArr(d.tags);
    var rawRefLaws = asArr(d.refLaws !== undefined ? d.refLaws : d.ref_laws);
    var rawRefCases = asArr(d.refCases !== undefined ? d.refCases : d.ref_cases);
    var rawSources = Array.isArray(d.sources) ? d.sources : ['사무실 공유 DB'];
    var combined = [
      d.body, d.title, d.summary, d.fileName, d.court, d.agency, d.caseNo || d.case_no
    ].concat(rawTags, rawRefLaws, rawRefCases, rawSources).filter(Boolean).join('\n');
    var names = E.extractPartyNames ? E.extractPartyNames(combined, d.fileName || d.title || '') : [];
    var sc = function (v) { return E.anonymizeLegalText(String(v || ''), names).text; };
    return {
      id: d.id,
      canonicalKey: d.canonicalKey || d.canonical_key || '',
      docType: d.docType || d.doc_type || 'prec_lower',
      court: sc(d.court || ''),
      agency: sc(d.agency || ''),
      caseNo: sc(d.caseNo || d.case_no || ''),
      decisionDate: d.decisionDate || d.decision_date || '',
      title: sc(d.title || ''),
      summary: sc(d.summary || ''),
      body: sc(d.body || '').trim(),
      tags: rawTags.map(sc),
      refLaws: rawRefLaws.map(sc),
      refCases: rawRefCases.map(sc),
      sources: rawSources.map(sc)
    };
  }

  function mapExternalSharedRow(row) {
    var clean = scrubFullDocClient(row);
    var isOfficial = Array.isArray(clean.sources) && clean.sources.some(function (s) {
      return /국가법령정보|근로복지공단|대법원|중앙노동위원회|고용노동부|법제처/.test(String(s));
    });
    return {
      id: clean.id || ('supa-' + clean.canonicalKey),
      canonicalKey: clean.canonicalKey,
      serverCanonicalKey: clean.canonicalKey,
      docType: clean.docType,
      court: clean.court,
      agency: clean.agency,
      caseNo: clean.caseNo,
      decisionDate: clean.decisionDate,
      title: clean.title,
      summary: clean.summary,
      body: clean.body,
      tags: clean.tags,
      refLaws: clean.refLaws,
      refCases: clean.refCases,
      sources: clean.sources,
      ingestedBy: row.ingested_by || row.ingestedBy || '',
      verified: isOfficial && clean.body.length >= 20
    };
  }

  function pullFromSupabase() {
    var cfg = getConfig();
    if (!cfg.supabaseUrl || !cfg.supabaseStaffJwt || !/^https:\/\//i.test(cfg.supabaseUrl)) {
      return Promise.resolve({ ok: true, added: 0, skipped: true });
    }
    var headers = supaStaffHeaders(cfg);
    var activeUrl = cfg.supabaseUrl + '/rest/v1/pbox_documents?select=*&deleted_at=is.null&order=decision_date.desc.nullslast&limit=500';
    var tombRpcUrl = cfg.supabaseUrl + '/rest/v1/rpc/pbox_list_tombstones';
    var PAGE_SIZE = 1000;
    var MAX_PAGES = 20;

    var pActive = fetch(activeUrl, { headers: headers }).then(function (r) {
      if (!r.ok) throw new Error('Supabase 동기화 실패 (HTTP ' + r.status + ')');
      return r.json();
    });

    function fetchTombstonePages(curTs, curKey, pageIdx, accKeys) {
      if (pageIdx >= MAX_PAGES) {
        return Promise.resolve({ keys: accKeys, latestAt: curTs, latestKey: curKey });
      }
      return fetch(tombRpcUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          since_ts: curTs || null,
          after_key: curKey || '',
          max_rows: PAGE_SIZE
        })
      }).then(function (r) {
        if (!r.ok) {
          throw new Error('Supabase 삭제 툼스톤 조회 실패 (HTTP ' + r.status + ')');
        }
        return r.json();
      }).then(function (pageRows) {
        if (!Array.isArray(pageRows)) {
          throw new Error('Supabase 삭제 툼스톤 응답 형식 오류');
        }
        var list = pageRows.filter(Boolean);
        if (!list.length) {
          return { keys: accKeys, latestAt: curTs, latestKey: curKey };
        }
        for (var i = 0; i < list.length; i++) {
          if (list[i].canonical_key) accKeys.push(list[i].canonical_key);
        }
        var lastRow = list[list.length - 1];
        var nextTs = lastRow && lastRow.deleted_at ? String(lastRow.deleted_at) : curTs;
        var nextKey = lastRow && lastRow.canonical_key ? String(lastRow.canonical_key) : '';
        var madeProgress = nextTs !== curTs || nextKey !== curKey;
        if (list.length < PAGE_SIZE || !madeProgress) {
          return { keys: accKeys, latestAt: nextTs, latestKey: nextKey };
        }
        return fetchTombstonePages(nextTs, nextKey, pageIdx + 1, accKeys);
      });
    }

    var pTomb = fetchTombstonePages(
      mem.syncMeta.lastTombstoneAt || '',
      mem.syncMeta.lastTombstoneKey || '',
      0,
      []
    );

    return Promise.all([pActive, pTomb]).then(function (pair) {
      var rows = pair[0];
      var tombRes = pair[1] || { keys: [], latestAt: '', latestKey: '' };
      if (!Array.isArray(rows)) throw new Error('Supabase 응답 JSON 배열 형식 오류');
      var arrFieldNames = ['tags', 'ref_laws', 'ref_cases', 'sources'];
      var hasBadRow = rows.some(function (r) {
        if (!r || typeof r !== 'object' || Array.isArray(r)) return true;
        if (typeof r.canonical_key !== 'string' || !r.canonical_key.trim()) return true;
        if (!r.deleted_at && (typeof r.title !== 'string' || !r.title.trim() || typeof r.body !== 'string' || !r.body.trim())) return true;
        for (var af = 0; af < arrFieldNames.length; af++) {
          var fk = arrFieldNames[af];
          if (r[fk] !== undefined && r[fk] !== null && !Array.isArray(r[fk])) return true;
        }
        return false;
      });
      if (hasBadRow) throw new Error('Supabase 공유 문서 필수 필드 또는 배열 형식 오류');
      var tombKeys = tombRes.keys.slice();
      var activeRows = [];
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i].deleted_at) {
          if (rows[i].canonical_key) tombKeys.push(rows[i].canonical_key);
        } else if (rows[i]) {
          activeRows.push(rows[i]);
        }
      }
      /* 전체 행 정규화를 먼저 마친 뒤 상태(삭제 툼스톤 및 문서 목록)에 원자적으로 반영 */
      var mappedAll = activeRows.map(mapExternalSharedRow);
      if (tombKeys.length || tombRes.latestAt) {
        applyServerDeletedKeys(tombKeys, tombRes.latestAt, tombRes.latestKey);
      }
      if (!mappedAll.length) return { ok: true, added: 0 };
      var mapped = mappedAll.filter(function (d) { return !isDocTombstoned(d); });
      var st = addDocuments(mapped, { scope: 'public', shareConfirmed: false });
      return { ok: true, added: st.added, merged: st.mergedStage1 + st.mergedStage2 + st.mergedStage3 };
    });
  }

  function pushDocsToSharedServer(docs, auth, opts) {
    var u = auth && auth.currentUser;
    if (!u || typeof u.getIdToken !== 'function') {
      return Promise.reject(new Error('사무실 공유 서버 적재를 위해 직원 로그인이 필요합니다.'));
    }
    if (!Array.isArray(docs) || !docs.length) {
      return Promise.resolve({ ok: true, pushed: 0, skipped: true });
    }
    var o = opts || {};
    /* 서버가 canonicalKey를 직접 재계산하고 소유권을 검증하므로 클라이언트는 모든 필드를 전면 비식별화하여 전달 */
    var sanitizedDocs = docs.map(function (d) {
      var clean = scrubFullDocClient(d);
      return {
        docType: clean.docType || 'internal_case',
        court: clean.court,
        agency: clean.agency,
        caseNo: clean.caseNo,
        decisionDate: clean.decisionDate || null,
        title: clean.title,
        summary: clean.summary,
        body: clean.body,
        tags: clean.tags,
        refLaws: clean.refLaws,
        refCases: clean.refCases,
        sources: clean.sources.length ? clean.sources : ['사무실 공유 (비식별 확인)']
      };
    });
    return u.getIdToken().then(function (tok) {
      return fetch(PBOX_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({
          action: 'push',
          docs: sanitizedDocs,
          restoreDeleted: o.restoreDeleted === true
        })
      });
    }).then(function (r) {
      return (r && typeof r.json === 'function' ? r.json() : Promise.resolve(null)).catch(function () { return null; }).then(function (j) {
        var hasConflict = !!(j && Array.isArray(j.conflicts) && j.conflicts.length);
        var hasTombstone = !!(j && Array.isArray(j.tombstoned) && j.tombstoned.length);
        if (!r || !r.ok || (j && j.ok === false) || hasConflict || hasTombstone) {
          var reason = (j && j.error)
            || (hasConflict ? '타인이 등록했거나 공식 수집된 문서는 덮어쓸 수 없습니다.' : '')
            || (hasTombstone ? '이미 삭제 처리된 문서는 공유 서버에 재공유할 수 없습니다.' : '')
            || ('공유 서버 적재 거부 (HTTP ' + ((r && r.status) || 0) + ')');
          throw new Error(reason);
        }
        return j || { ok: true, pushed: sanitizedDocs.length };
      });
    });
  }

  function deleteDocsFromSharedServer(canonicalKeys, auth) {
    var u = auth && auth.currentUser;
    if (!u || typeof u.getIdToken !== 'function') {
      return Promise.reject(new Error('공유 서버 삭제를 위해 직원 로그인이 필요합니다.'));
    }
    if (!Array.isArray(canonicalKeys) || !canonicalKeys.length) {
      return Promise.resolve({ ok: true, deleted: 0, skipped: true });
    }
    return u.getIdToken().then(function (tok) {
      return fetch(PBOX_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({ action: 'delete', canonicalKeys: canonicalKeys })
      });
    }).then(function (r) {
      return (r && typeof r.json === 'function' ? r.json() : Promise.resolve(null)).catch(function () { return null; }).then(function (j) {
        var hasUnmatched = !!(j && Array.isArray(j.unmatched) && j.unmatched.length);
        if (!r || !r.ok || (j && j.ok === false) || hasUnmatched) {
          throw new Error((j && j.error)
            || (hasUnmatched ? ('일부 문서는 본인 소유가 아니거나 존재하지 않아 공유 서버에서 삭제되지 않았습니다 (' + j.unmatched.length + '건 미삭제).') : '')
            || ('공유 서버 삭제 거부 또는 본인 소유 문서 아님 (HTTP ' + ((r && r.status) || 0) + ')'));
        }
        return j || { ok: true, deleted: 0 };
      });
    });
  }

  /* ── 서버 공공 API 동기화 대리인 호출 (`exports.pboxApi`) ── */
  function callServerSync(auth) {
    var cfg = getConfig();
    var u = auth && auth.currentUser;
    if (!u || !u.getIdToken) return Promise.resolve({ ok: true, added: 0, skipped: true });
    return u.getIdToken().then(function (tok) {
      function pullTombstoneRounds(curTs, curKey, roundIdx, accDocs, accErrs) {
        return fetch(PBOX_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
          body: JSON.stringify({
            action: 'pull',
            limit: roundIdx === 0 ? 300 : 1,
            sinceDeletedAt: curTs || '',
            afterDeletedKey: curKey || ''
          })
        }).then(function (r) {
          if (!r.ok) throw new Error('서버 공유문서 조회 오류 (HTTP ' + r.status + ')');
          return r.json();
        }).then(function (pullJson) {
          pullJson = pullJson || {};
          if (pullJson.ok === false) accErrs.push('공유 DB 조회 실패');
          if ((Array.isArray(pullJson.deletedKeys) && pullJson.deletedKeys.length) || pullJson.latestDeletedAt) {
            applyServerDeletedKeys(pullJson.deletedKeys || [], pullJson.latestDeletedAt || '', pullJson.latestDeletedKey || '');
          }
          if (roundIdx === 0 && Array.isArray(pullJson.docs)) {
            accDocs = accDocs.concat(pullJson.docs);
          }
          var nextTs = pullJson.latestDeletedAt || curTs;
          var nextKey = pullJson.latestDeletedKey || '';
          var progressed = nextTs !== curTs || nextKey !== curKey;
          if (pullJson.hasMoreTombstones && progressed && roundIdx < 5) {
            return pullTombstoneRounds(nextTs, nextKey, roundIdx + 1, accDocs, accErrs);
          }
          return { docs: accDocs, errors: accErrs };
        });
      }

      return Promise.all([
        fetch(PBOX_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
          body: JSON.stringify({ action: 'sync', lawOc: cfg.lawOc || '' })
        }).then(function (r) {
          if (!r.ok) throw new Error('서버 자동수집 응답 오류 (HTTP ' + r.status + ')');
          return r.json();
        }),
        pullTombstoneRounds(mem.syncMeta.lastTombstoneAt || '', mem.syncMeta.lastTombstoneKey || '', 0, [], [])
      ]);
    }).then(function (pair) {
      var syncJson = pair[0] || {};
      var pullOut = pair[1] || { docs: [], errors: [] };
      var errs = [];
      if (syncJson.ok === false) {
        errs = errs.concat(syncJson.errors && syncJson.errors.length ? syncJson.errors : ['서버 동기화 일부 실패']);
      }
      if (pullOut.errors.length) {
        errs = errs.concat(pullOut.errors);
      }
      var combined = [];
      if (Array.isArray(syncJson.docs)) combined = combined.concat(syncJson.docs.map(mapExternalSharedRow));
      if (Array.isArray(pullOut.docs)) combined = combined.concat(pullOut.docs.map(mapExternalSharedRow));
      var added = 0;
      var merged = 0;
      if (combined.length) {
        var st = addDocuments(combined, { scope: 'public', shareConfirmed: false });
        added = st.added;
        merged = st.mergedStage1 + st.mergedStage2 + st.mergedStage3;
      }
      return { ok: errs.length === 0, added: added, merged: merged, errors: errs };
    });
  }

  /* ── 최근 본 자료 · 프로젝트 · AI 작업이력 · 알림 관리 ── */
  function recordRecent(entry) {
    if (!entry || !entry.id) return;
    var item = {
      id: String(entry.id),
      kind: entry.kind || 'doc',
      title: entry.title || '',
      sub: entry.sub || '',
      lawDir: entry.lawDir || '',
      fileName: entry.fileName || '',
      viewedAt: Date.now()
    };
    mem.recents = [item].concat(mem.recents.filter(function (x) { return x.id !== item.id; })).slice(0, 30);
    saveUidSnapshot();
    idbPut(getWorkspaceDb(), 'recents', item);
  }

  function saveProject(proj, opts) {
    var now = Date.now();
    var clean = stripUndefined(proj);
    var preserveTs = !!(opts && opts.preserveUpdatedAt);
    var safeDocIds = Array.isArray(clean.docIds)
      ? clean.docIds.filter(function (x) { return x !== null && x !== undefined && String(x).trim() !== ''; }).map(String)
      : [];
    var safeLawKeys = Array.isArray(clean.lawKeys)
      ? clean.lawKeys.filter(function (x) { return x !== null && x !== undefined && String(x).trim() !== ''; }).map(String)
      : [];
    var safeDrafts = Array.isArray(clean.drafts)
      ? clean.drafts.filter(function (x) { return x && typeof x === 'object' && !Array.isArray(x); }).map(function (x) {
          var bodyTxt = String(x.answer !== undefined && x.answer !== null ? x.answer : (x.content || ''));
          return {
            id: String(x.id || ('dr-' + now + '-' + Math.random().toString(36).slice(2, 6))),
            title: String(x.title || '서면 초안'),
            answer: bodyTxt,
            content: bodyTxt,
            savedAt: Number(x.savedAt) || Number(x.createdAt) || now,
            createdAt: Number(x.createdAt) || Number(x.savedAt) || now
          };
        })
      : [];
    var existingIdx = clean.id ? mem.projects.findIndex(function (x) { return x.id === String(clean.id); }) : -1;
    var prevTs = existingIdx >= 0 ? (Number(mem.projects[existingIdx].updatedAt) || 0) : 0;
    var nextUpdatedAt = preserveTs
      ? (Number(clean.updatedAt) || Number(clean.createdAt) || now)
      : Math.max(now, prevTs + 1);
    var p = {
      id: String(clean.id || ('proj-' + now + '-' + Math.random().toString(36).slice(2, 7))),
      ownerUid: mem.uid,
      name: String(clean.name || '새 사건 프로젝트'),
      clientName: String(clean.clientName || ''),
      category: String(clean.category || '노무자문·사건'),
      note: String(clean.note || ''),
      docIds: safeDocIds,
      lawKeys: safeLawKeys,
      drafts: safeDrafts,
      createdAt: Number(clean.createdAt) || now,
      updatedAt: nextUpdatedAt
    };

    var idx = mem.projects.findIndex(function (x) { return x.id === p.id; });
    if (idx >= 0) mem.projects[idx] = p;
    else mem.projects.unshift(p);
    saveUidSnapshot();
    idbPut(getWorkspaceDb(), 'projects', p);
    return p;
  }

  function deleteProject(projId) {
    mem.projects = mem.projects.filter(function (p) { return p.id !== projId; });
    saveUidSnapshot();
    return idbDelete(getWorkspaceDb(), 'projects', projId);
  }

  function addItemsToProject(projId, docIds, lawKeys) {
    var p = mem.projects.find(function (x) { return x.id === projId; });
    if (!p) return null;
    var dSet = new Set([].concat(p.docIds || [], docIds || []).filter(Boolean));
    var lSet = new Set([].concat(p.lawKeys || [], lawKeys || []).filter(Boolean));
    p.docIds = Array.from(dSet);
    p.lawKeys = Array.from(lSet);
    p.updatedAt = Date.now();
    saveUidSnapshot();
    idbPut(getWorkspaceDb(), 'projects', p);
    return p;
  }

  function saveThread(thread) {
    var now = Date.now();
    var clean = stripUndefined(thread);
    var vfRaw = clean.verification;
    var safeVf = { items: [], verifiedCount: 0, unverifiedCount: 0, allVerified: true };
    if (vfRaw && typeof vfRaw === 'object' && !Array.isArray(vfRaw) && Array.isArray(vfRaw.items)) {
      var cleanItems = vfRaw.items
        .filter(function (it) { return it && typeof it === 'object' && !Array.isArray(it); })
        .map(function (it) {
          return {
            kind: String(it.kind || 'case'),
            raw: String(it.raw || ''),
            verified: !!it.verified,
            status: String(it.status || ''),
            matchedTitle: String(it.matchedTitle || ''),
            targetId: String(it.targetId || ''),
            lawDir: String(it.lawDir || ''),
            fileName: String(it.fileName || ''),
            articleNo: String(it.articleNo || '')
          };
        });
      var vCnt = cleanItems.filter(function (it) { return it.verified; }).length;
      var uCnt = cleanItems.length - vCnt;
      safeVf = {
        items: cleanItems,
        verifiedCount: vCnt,
        unverifiedCount: uCnt,
        allVerified: uCnt === 0
      };
    }
    var safeAttached = Array.isArray(clean.attachedTitles)
      ? clean.attachedTitles.filter(Boolean).map(String)
      : [];
    var safeRetrievedIds = Array.isArray(clean.retrievedDocIds)
      ? clean.retrievedDocIds.filter(Boolean).map(String)
      : [];
    var th = {
      id: String(clean.id || ('th-' + now + '-' + Math.random().toString(36).slice(2, 7))),
      ownerUid: mem.uid,
      title: String(clean.title || '법률 리서치 작업'),
      mode: String(clean.mode || 'auto'),
      query: String(clean.query || ''),
      answer: String(clean.answer || ''),
      engineLabel: String(clean.engineLabel || 'P박스 하이브리드 엔진'),
      verification: safeVf,
      attachedTitles: safeAttached,
      retrievedDocIds: safeRetrievedIds,
      createdAt: Number(clean.createdAt) || now,
      updatedAt: Number(clean.updatedAt) || now
    };

    var wsDb = getWorkspaceDb();
    var idx = mem.threads.findIndex(function (x) { return x.id === th.id; });
    if (idx >= 0) mem.threads[idx] = th;
    else mem.threads.unshift(th);
    if (mem.threads.length > 60) {
      var evictedThreads = mem.threads.slice(60);
      mem.threads = mem.threads.slice(0, 60);
      evictedThreads.forEach(function (evicted) {
        if (evicted && evicted.id) idbDelete(wsDb, 'threads', evicted.id);
      });
    }
    saveUidSnapshot();
    if (mem.threads.some(function (x) { return x.id === th.id; })) {
      idbPut(wsDb, 'threads', th);
    }
    return th;
  }

  /* JSON 백업 일괄 복원 (스키마 검증 + 중복 ID 정리 + 문서·사건 프로젝트·AI 작업이력 최대 60건 영구 저장소 정합 복구) */
  function importBackupData(dump, opts) {
    opts = opts || {};
    if ((opts.expectedGen !== undefined && opts.expectedGen !== sessionGen) ||
        (opts.expectedUid !== undefined && opts.expectedUid !== mem.uid)) {
      throw makeStaleSessionError();
    }
    if (!dump || typeof dump !== 'object' || Array.isArray(dump)) {
      throw new Error('올바른 P박스 백업 JSON 객체 형식이 아닙니다.');
    }
    var hasDocsKey = Object.prototype.hasOwnProperty.call(dump, 'docs');
    var hasProjectsKey = Object.prototype.hasOwnProperty.call(dump, 'projects');
    var hasThreadsKey = Object.prototype.hasOwnProperty.call(dump, 'threads');
    if (!hasDocsKey && !hasProjectsKey && !hasThreadsKey) {
      throw new Error('백업 파일에 복원할 항목(docs, projects, threads)이 없습니다.');
    }
    if ((hasDocsKey && !Array.isArray(dump.docs)) ||
        (hasProjectsKey && !Array.isArray(dump.projects)) ||
        (hasThreadsKey && !Array.isArray(dump.threads))) {
      throw new Error('백업 파일의 docs·projects·threads 필드는 배열이어야 합니다.');
    }

    var docsAdded = 0;
    var projectsRestored = 0;
    var threadsRestored = 0;

    if (Array.isArray(dump.docs) && dump.docs.length) {
      var validDocs = dump.docs.filter(function (d) { return d && typeof d === 'object' && !Array.isArray(d); });
      if (validDocs.length) {
        var st = addDocuments(validDocs, {
          expectedGen: opts.expectedGen,
          expectedUid: opts.expectedUid,
          shareConfirmed: false,
          overrideDeleted: true
        });
        docsAdded = st ? (st.added || 0) : 0;
      }
    }
    if (Array.isArray(dump.projects)) {
      var projById = new Map();
      var autoProjIdx = 0;
      dump.projects.forEach(function (p) {
        if (!p || typeof p !== 'object' || Array.isArray(p)) return;
        var key = p.id ? String(p.id) : ('__auto_proj_' + (++autoProjIdx));
        var prevProj = projById.get(key);
        if (!prevProj || (Number(p.updatedAt) || Number(p.createdAt) || 0) >= (Number(prevProj.updatedAt) || Number(prevProj.createdAt) || 0)) {
          projById.set(key, p);
        }
      });
      projById.forEach(function (p) {
        var incomingTs = Number(p.updatedAt) || Number(p.createdAt) || 0;
        var curExisting = p.id ? mem.projects.find(function (x) { return x.id === String(p.id); }) : null;
        var curExistingTs = curExisting ? (Number(curExisting.updatedAt) || Number(curExisting.createdAt) || 0) : 0;
        if (curExisting && incomingTs > 0 && curExistingTs > incomingTs) {
          return;
        }
        if (curExisting && incomingTs === 0 && curExistingTs > 0) {
          return;
        }
        saveProject(p, { preserveUpdatedAt: true });
        projectsRestored++;
      });
    }
    if (Array.isArray(dump.threads)) {
      /* 중복 ID 정리 및 기존 최신 이력 보호 후 작업이력 저장소 한도(60건)에 맞춰 시간순으로 복원 */
      var threadById = new Map();
      var autoThIdx = 0;
      dump.threads.forEach(function (t) {
        if (!t || typeof t !== 'object' || Array.isArray(t)) return;
        var key = t.id ? String(t.id) : ('__auto_th_' + (++autoThIdx));
        var prev = threadById.get(key);
        if (!prev || (Number(t.updatedAt) || Number(t.createdAt) || 0) >= (Number(prev.updatedAt) || Number(prev.createdAt) || 0)) {
          threadById.set(key, t);
        }
      });
      var sortedThreads = Array.from(threadById.values()).filter(function (t) {
        var inTs = Number(t.updatedAt) || Number(t.createdAt) || 0;
        var curTh = t.id ? mem.threads.find(function (x) { return x.id === String(t.id); }) : null;
        var curThTs = curTh ? (Number(curTh.updatedAt) || Number(curTh.createdAt) || 0) : 0;
        if (curTh && ((inTs > 0 && curThTs > inTs) || (inTs === 0 && curThTs > 0))) return false;
        return true;
      });
      sortedThreads.sort(function (a, b) { return (Number(a.updatedAt) || Number(a.createdAt) || 0) - (Number(b.updatedAt) || Number(b.createdAt) || 0); });
      if (sortedThreads.length > 60) {
        sortedThreads = sortedThreads.slice(sortedThreads.length - 60);
      }
      sortedThreads.forEach(function (t) {
        saveThread(t);
        threadsRestored++;
      });
    }
    return {
      docsAdded: docsAdded,
      projectsRestored: projectsRestored,
      threadsRestored: threadsRestored
    };
  }

  function addAlert(al) {
    var item = {
      id: 'al-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      date: global.PuPBoxEngine.todayKstYmd(),
      kind: al.kind || 'info',
      title: al.title || '',
      detail: al.detail || ''
    };
    mem.alerts = [item].concat(mem.alerts).slice(0, 40);
    idbPut(getCorpusDb(), 'meta', { key: 'alerts', value: mem.alerts });
    return item;
  }

  function preloadCitedLawsIfNeeded(answerText, idxList, skipAutoFetch) {
    if (skipAutoFetch || typeof fetch !== 'function') return Promise.resolve();
    var E = global.PuPBoxEngine;
    if (!E || typeof E.extractCitedLawTargets !== 'function') return Promise.resolve();
    var targets = E.extractCitedLawTargets(answerText, idxList).slice(0, 4);
    var missing = targets.filter(function (t) { return !mem.laws.has(t.dir + '/' + t.fileName); });
    if (!missing.length) return Promise.resolve();
    return Promise.all(missing.map(function (t) {
      return fetchLaw(t.dir, t.fileName).catch(function () { return null; });
    })).then(function () {});
  }

  /* ── AI 법률 질의·서면 생성 (세션 세대 격리 + 외부 전송 전 전면적 비식별 관문 + 서버 PuAiCall 우선 → 오프라인 ₩0 폴백 + 기계적 인용 검증) ── */
  function askLegalAi(params, extraOpts) {
    if (typeof params === 'string') {
      params = Object.assign({ query: params }, extraOpts || {});
    } else {
      params = params || {};
    }
    var reqGen = sessionGen;
    var reqUid = mem.uid;
    var snapshotDocs = mem.docs.slice();

    var E = global.PuPBoxEngine;
    var idxList = (global.PuPBoxLawIndex && global.PuPBoxLawIndex.list) ? global.PuPBoxLawIndex.list() : [];
    var loadedLaws = Array.from(mem.laws.values());
    var rawQuery = String(params.query || '').trim();
    var rawAttached = Array.isArray(params.attached) ? params.attached.slice() : [];
    var wfObj = params.workflow || null;

    /* 질문·사실관계·첨부·워크플로 전체에 대해 클라우드 전달 전 비식별화 관문 적용 */
    var combinedInput = [rawQuery, wfObj ? (wfObj.title + ' ' + wfObj.desc) : '']
      .concat(rawAttached.map(function (a) { return (a.title || '') + '\n' + (a.body || a.plainText || a.summary || ''); }))
      .join('\n');
    var promptPartyNames = E.extractPartyNames ? E.extractPartyNames(combinedInput, '') : [];
    var scrubText = function (s) {
      var out = E.anonymizeLegalText(String(s || ''), promptPartyNames).text;
      if (global.PuRrnScrub && typeof global.PuRrnScrub.scrub === 'function') {
        out = global.PuRrnScrub.scrub(out);
      }
      return out;
    };

    var query = scrubText(rawQuery);
    var attached = rawAttached.map(function (a) {
      return Object.assign({}, a, {
        title: scrubText(a.title || ''),
        caseNo: scrubText(a.caseNo || ''),
        body: scrubText(a.body || ''),
        plainText: scrubText(a.plainText || ''),
        summary: scrubText(a.summary || '')
      });
    });

    var searchRes = E.searchCorpus(query, {
      docs: snapshotDocs,
      loadedLaws: loadedLaws,
      lawIndex: idxList,
      limit: 8
    });

    var prompt = scrubText(E.buildRagPrompt({
      query: query,
      mode: params.mode || 'auto',
      workflow: wfObj,
      attached: attached,
      retrievedDocs: searchRes.docs,
      retrievedArticles: searchRes.articles
    }));

    var cfg = getConfig();
    var canUseCloudAi = !cfg.preferOfflineAi &&
      !params.forceOffline &&
      global.PuAiCall &&
      typeof global.PuAiCall.ask === 'function' &&
      params.auth &&
      params.auth.currentUser;

    function assertSameSession() {
      if (reqGen !== sessionGen || mem.uid !== reqUid) {
        throw makeStaleSessionError();
      }
    }

    function finalizeWithVerification(answerText, engineLabel) {
      assertSameSession();
      var safeAnswer = scrubText(answerText);
      return preloadCitedLawsIfNeeded(safeAnswer, idxList, params.forceOffline === true).then(function () {
        assertSameSession();
        var verification = E.verifyCitations(safeAnswer, {
          docs: snapshotDocs,
          loadedLaws: Array.from(mem.laws.values()),
          lawIndex: idxList
        });
        var threadPayload = {
          ownerUid: reqUid,
          title: (wfObj ? '[' + scrubText(wfObj.badge) + '] ' : '') + query.slice(0, 38),
          mode: params.mode || 'auto',
          query: query,
          answer: safeAnswer,
          engineLabel: engineLabel,
          verification: verification,
          attachedTitles: attached.map(function (a) { return a.title || a.caseNo; }),
          retrievedDocIds: searchRes.docs.slice(0, 5).map(function (d) { return d.id; })
        };
        if (params.threadId) threadPayload.id = String(params.threadId);
        var saved = saveThread(threadPayload);
        return {
          thread: saved,
          searchRes: searchRes,
          verification: verification
        };
      });
    }

    if (!canUseCloudAi) {
      var offlineAns = E.synthesizeOfflineAnswer({
        query: query,
        workflow: wfObj,
        attached: attached,
        retrievedDocs: searchRes.docs,
        retrievedArticles: searchRes.articles,
        retrievedLawFamilies: searchRes.lawFamilies
      });
      return finalizeWithVerification(offlineAns, '무료 내장 법률합성 엔진 (₩0 · 원문 기반)');
    }

    return global.PuAiCall.ask([{ text: prompt }], {
      auth: params.auth,
      app: 'pbox',
      manual: params.manual === true,
      generationConfig: { temperature: 0.15, maxOutputTokens: 4096 }
    }).then(function (reply) {
      assertSameSession();
      var txt = global.PuAiCall.textOf(reply);
      if (!txt) throw new Error('빈 응답');
      return finalizeWithVerification(txt, '푸른 AI 대리인 + P박스 인용검증 (원문 RAG)');
    }).catch(function (err) {
      if (err && err.staleSession) throw err;
      assertSameSession();
      var fallbackAns = E.synthesizeOfflineAnswer({
        query: query,
        workflow: wfObj,
        attached: attached,
        retrievedDocs: searchRes.docs,
        retrievedArticles: searchRes.articles,
        retrievedLawFamilies: searchRes.lawFamilies
      });
      var label = err && err.overBudget
        ? '무료 내장 법률합성 엔진 (월 AI 한도 보호 모드 · ₩0)'
        : '무료 내장 법률합성 엔진 (오프라인 자동전환 · ₩0)';
      return finalizeWithVerification(fallbackAns, label);
    });
  }

  /* ── 인증 해제(세션 만료·계정 변경) 시 개인 수집문서·작업공간·세션JWT 메모리 즉시 초기화 ── */
  function clearMemoryOnSignOut() {
    ++sessionGen;
    saveUidSnapshot();
    sessionJwtByUid.clear();
    closeAllWorkspaceHandles();
    mem.uid = 'guest';
    mem.privateDocs = [];
    mem.projects = [];
    mem.threads = [];
    mem.recents = [];
    rebuildEffectiveDocs();
  }

  /* ── 명시적 로그아웃 시 모든 열려 있는 핸들을 닫고 개인 작업공간(로컬 수집문서·세션JWT 포함) 완전 파기 ── */
  function clearWorkspaceOnLogout() {
    ++sessionGen;
    var activeDbName = workspaceDbNameFor(mem.uid);
    closeAllWorkspaceHandles();
    sessionJwtByUid.clear();
    memByUid.clear();
    mem.uid = 'guest';
    mem.privateDocs = [];
    mem.projects = [];
    mem.threads = [];
    mem.recents = [];
    rebuildEffectiveDocs();

    var targets = [WORKSPACE_DB];
    if (activeDbName) targets.push(activeDbName);

    var pEnum = (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function')
      ? indexedDB.databases().then(function (list) {
          (list || []).forEach(function (info) {
            if (info && info.name && (info.name === WORKSPACE_DB || info.name.indexOf(WORKSPACE_DB + '_') === 0)) {
              if (targets.indexOf(info.name) < 0) targets.push(info.name);
            }
          });
        }).catch(function () {})
      : Promise.resolve();

    return pEnum.then(function () {
      return Promise.all(targets.map(deleteDbSafe));
    });
  }

  if (typeof global.addEventListener === 'function') {
    global.addEventListener('storage', function (ev) {
      if (ev && ev.key === 'pu_auth_logout_at' && ev.newValue) {
        clearWorkspaceOnLogout();
      }
    });
  }

  global.PuPBoxStore = {
    CORPUS_DB: CORPUS_DB,
    WORKSPACE_DB: WORKSPACE_DB,
    CORE_PACK_TARGETS: CORE_PACK_TARGETS,
    workspaceDbNameFor: workspaceDbNameFor,
    getSessionGen: function () { return sessionGen; },
    getActiveUid: function () { return mem.uid; },
    getLastDeleteSyncResult: function () { return lastDeleteSyncPromise; },
    init: init,
    getConfig: getConfig,
    saveConfig: saveConfig,
    hasSupabase: hasSupabase,
    getStateSummary: getStateSummary,
    getDocs: function () { return mem.docs.slice(); },
    getDocById: function (id) { return mem.docs.find(function (d) { return d.id === id; }) || null; },
    getLoadedLaws: function () { return Array.from(mem.laws.values()); },
    getCachedLaw: function (dir, fileName) { return mem.laws.get(dir + '/' + (fileName || '법률.md')) || null; },
    getProjects: function () { return mem.projects.slice(); },
    getThreads: function () { return mem.threads.slice(); },
    getRecents: function () { return mem.recents.slice(); },
    getAlerts: function () { return mem.alerts.slice(); },
    fetchLaw: fetchLaw,
    syncCoreLaborLaws: syncCoreLaborLaws,
    runIncrementalSync: runIncrementalSync,
    addDocuments: addDocuments,
    deleteDocuments: deleteDocuments,
    testSupabaseConnection: testSupabaseConnection,
    pullFromSupabase: pullFromSupabase,
    pushDocsToSharedServer: pushDocsToSharedServer,
    deleteDocsFromSharedServer: deleteDocsFromSharedServer,
    recordRecent: recordRecent,
    saveProject: saveProject,
    deleteProject: deleteProject,
    addItemsToProject: addItemsToProject,
    saveThread: saveThread,
    importBackupData: importBackupData,
    addAlert: addAlert,
    askLegalAi: askLegalAi,
    clearMemoryOnSignOut: clearMemoryOnSignOut,
    clearWorkspaceOnLogout: clearWorkspaceOnLogout
  };

})(typeof window !== 'undefined' ? window : globalThis);
