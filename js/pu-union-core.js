/* 푸른통합시스템 — 노사관계·단체교섭·임금협상 전용 핵심 순수 엔진
 * (브라우저 window.PuUnionCore / Node module.exports 겸용)
 *
 * 맡는 일:
 *   1. 5대 트랙(단체교섭·임금협상·창구단일화·쟁의조정/파업/부노·노사협의회/설립),
 *      8단계 표준 교섭 절차, 4대 서류군(진행·검토·체결·증빙) 및 14종 세부 서류 역할 정의
 *   2. 푸른 메일함 IMAP(/mailbox/folders · /mailbox/msgs) + POP3 지난메일(/mailbox/old/msgs)
 *      전수 평탄화 · 중복 제거 · 정밀 노사관계 메일 선별(컨설팅 인터뷰 양식 단독 오탐 차단)
 *   3. 사업장 × 연도별 교섭/노사관계 자동 그룹화, 회차 추출, 8단계 진행 자동복원(manual 칸 보존)
 *   4. 교섭창구단일화(노조법 시행령 제14조의2~10) & 노동쟁의조정(노조법 제54조) 법정기일 자동계산기,
 *      임금협상 원가/인상률 시뮬레이터
 *   5. 주민번호·연락처·이메일·계좌번호·PC 로컬 경로 2중 비식별 가림 및 CSV 수식 인젝션 방어
 *
 * ⚠ 저장소는 공개다 — 실제 고객·근로자 실명·주민번호·계좌·PC 로컬 경로를 코드에 넣지 않는다.
 */
(function (root, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.PuUnionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function () {
  'use strict';

  var DAY_MS = 86400000;
  var GARIM = '[가림]';

  /* ── 1. 표준 카탈로그 (트랙 · 8단계 · 수행유형 · 상태 · 서류 4군 14역할 · 조문검토) ── */
  var TRACKS = {
    bargain:   { code: 'bargain',   name: '단체교섭·단체협약',        short: '단체교섭',   icon: '🤝', desc: '단체협약 제·개정 본교섭, 실무교섭, 신구조문대비 검토' },
    wage:      { code: 'wage',      name: '임금협상·임단협',          short: '임금협상',   icon: '💰', desc: '연도별 임금협약, 임금인상률·원가산정, 임단협 병행교섭' },
    single_ch: { code: 'single_ch', name: '교섭창구단일화',           short: '창구단일화', icon: '📋', desc: '교섭요구사실 공고, 참여노조 확정공고, 과반수노조·공동교섭대표단' },
    dispute:   { code: 'dispute',   name: '노동쟁의·조정·파업·부노',  short: '조정·쟁의',  icon: '🚨', desc: '노동위원회 쟁의조정, 파업·쟁의행위 대응시나리오, 부당노동행위' },
    council:   { code: 'council',   name: '노사협의회·노조설립·자문', short: '노사협의회', icon: '🏛️', desc: '노사협의회 규정·정기회의, 노조규약·설립, 상호협력규정 자문' }
  };

  var TRACK_ORDER = ['bargain', 'wage', 'single_ch', 'dispute', 'council'];

  var STEPS = [
    { code: 'intake',    no: 1, short: '수임·검토',   name: '① 수임·기초검토',          desc: '위임계약·견적, 현행 단협·임협·취업규칙, 노조 현황 파악' },
    { code: 'channel',   no: 2, short: '창구단일화',  name: '② 교섭요구·창구단일화',     desc: '교섭요구 접수, 요구사실·확정공고, 교섭대표노조 확정' },
    { code: 'demand',    no: 3, short: '요구안검토',  name: '③ 요구안 접수·법리/원가검토', desc: '노조 요구안 분석, 신구조문대비표·임금원가 산정 검토' },
    { code: 'strategy',  no: 4, short: '사측안수립',  name: '④ 사측안·대응전략 수립',    desc: '사측 수정제시안, 교섭전략 시나리오 및 자문의견서 작성' },
    { code: 'negotiate', no: 5, short: '교섭진행',    name: '⑤ 본교섭·실무교섭 진행',    desc: '상견례·실무교섭·본교섭 회의록 작성 및 쟁점 조율' },
    { code: 'dispute',   no: 6, short: '조정·쟁의',   name: '⑥ 조정·쟁의·부노 대응',     desc: '노동위 쟁의조정 회의, 쟁의행위·파업 대응, 부노 방어' },
    { code: 'agree',     no: 7, short: '잠정·체결',   name: '⑦ 잠정합의·조인·체결',      desc: '잠정합의안 도출, 찬반투표, 단체·임금협약 최종 조인' },
    { code: 'close',     no: 8, short: '신고·종결',   name: '⑧ 신고·이행관리·종결',      desc: '행정관청 단체협약 신고(15일 이내), 합의사항 이행·아카이브' }
  ];

  var PERFORM_MODES = {
    direct_bargain:   { code: 'direct_bargain',   label: '직접 교섭대리·위임',      short: '교섭대리',    icon: '⚖️' },
    review_advisory:  { code: 'review_advisory',  label: '단협·임협 검토·자문',     short: '검토·자문',   icon: '🔎' },
    dispute_response: { code: 'dispute_response', label: '조정·파업·부노 대응',     short: '조정·대응',   icon: '🚨' },
    council_setup:    { code: 'council_setup',    label: '노사협의회·규정·설립 지원', short: '협의회·설립', icon: '🏛️' }
  };

  var STATUSES = {
    active:    { code: 'active',    label: '진행중',       chipCls: 'c-blue' },
    mediating: { code: 'mediating', label: '조정·분쟁중',  chipCls: 'c-amber' },
    agreed:    { code: 'agreed',    label: '타결·체결',    chipCls: 'c-green' },
    closed:    { code: 'closed',    label: '종결·아카이브', chipCls: '' }
  };

  var DOC_GROUPS = {
    progress: { code: 'progress', name: '📄 교섭 진행 서류',      short: '진행서류', chipCls: 'c-blue' },
    review:   { code: 'review',   name: '🔎 검토·자문 서류',      short: '검토서류', chipCls: 'c-amber' },
    signed:   { code: 'signed',   name: '✍️ 합의·체결·신고 서류', short: '체결서류', chipCls: 'c-green' },
    evidence: { code: 'evidence', name: '📎 증빙·참고 자료',      short: '증빙자료', chipCls: '' }
  };

  var DOC_ROLES = {
    demand_notice:    { code: 'demand_notice',    label: '교섭요구 공문',                 group: 'progress', stepCode: 'channel' },
    channel_notice:   { code: 'channel_notice',   label: '창구단일화 공고문',             group: 'progress', stepCode: 'channel' },
    mandate_contract: { code: 'mandate_contract', label: '위임장·수임계약·견적',          group: 'progress', stepCode: 'intake' },
    schedule_minutes: { code: 'schedule_minutes', label: '교섭일정·상견례·회의록',        group: 'progress', stepCode: 'negotiate' },
    dispute_doc:      { code: 'dispute_doc',      label: '쟁의조정 신청·답변·파업시나리오', group: 'progress', stepCode: 'dispute' },
    demand_review:    { code: 'demand_review',    label: '노조 요구안 검토서',            group: 'review',   stepCode: 'demand' },
    comparison_table: { code: 'comparison_table', label: '신구조문대비표·3단 비교표',     group: 'review',   stepCode: 'demand' },
    legal_opinion:    { code: 'legal_opinion',    label: '단협·임협 법률검토 의견서',      group: 'review',   stepCode: 'strategy' },
    cost_review:      { code: 'cost_review',      label: '임금인상률·원가산정 검토표',    group: 'review',   stepCode: 'demand' },
    council_review:   { code: 'council_review',   label: '노사협의회·상호협력규정·규약 검토', group: 'review', stepCode: 'strategy' },
    tentative_agree:  { code: 'tentative_agree',  label: '잠정합의서·개정합의서',          group: 'signed',   stepCode: 'agree' },
    final_cba:        { code: 'final_cba',        label: '최종 단체협약·임금협약 조인본',  group: 'signed',   stepCode: 'agree' },
    admin_report:     { code: 'admin_report',     label: '단체협약 행정관청 신고서',       group: 'signed',   stepCode: 'close' },
    record_evidence:  { code: 'record_evidence',  label: '녹취·증거·참고자료',             group: 'evidence', stepCode: 'negotiate' }
  };

  var REVIEW_STATES = {
    pending:   { code: 'pending',   label: '검토대기', chipCls: '' },
    reviewing: { code: 'reviewing', label: '검토중',   chipCls: 'c-amber' },
    replied:   { code: 'replied',   label: '회신완료', chipCls: 'c-blue' },
    final:     { code: 'final',     label: '체결확정', chipCls: 'c-green' }
  };

  var CLAUSE_CATEGORIES = {
    wage:    { code: 'wage',    label: '임금·수당' },
    hours:   { code: 'hours',   label: '근로시간·휴일·휴가' },
    hr:      { code: 'hr',      label: '인사·징계·고용안정' },
    union:   { code: 'union',   label: '조합활동·타임오프' },
    welfare: { code: 'welfare', label: '복리후생·안전' },
    etc:     { code: 'etc',     label: '총칙·기타' }
  };

  var CLAUSE_STATES = {
    pending:   { code: 'pending',   label: '검토전',   chipCls: '' },
    discussed: { code: 'discussed', label: '협의중',   chipCls: 'c-blue' },
    agreed:    { code: 'agreed',    label: '잠정합의', chipCls: 'c-green' },
    hold:      { code: 'hold',      label: '보류',     chipCls: 'c-amber' },
    rejected:  { code: 'rejected',  label: '수용불가', chipCls: 'c-red' }
  };

  /* ── 2. 기본 유틸리티 · 해시 · 날짜 ───────────────────────────────────── */
  function str(v) { return v == null ? '' : String(v).trim(); }
  function obj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o || {}, k); }
  function okId(k) { return typeof k === 'string' && !!k && k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && !/[.#$\/\[\]]/.test(k); }
  function digits(v) { return str(v).replace(/\D/g, ''); }

  function rowsOf(v) {
    var x = obj(v) && v.v !== undefined ? v.v : v;
    if (Array.isArray(x)) return x.filter(function (r) { return obj(r) && !r._deleted; });
    if (obj(x)) return Object.keys(x).map(function (k) { return x[k]; }).filter(function (r) { return obj(r) && !r._deleted; });
    return [];
  }

  function safeKey(s) {
    return str(s).replace(/[^\uAC00-\uD7A3A-Za-z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 100) || 'item';
  }

  function ymdOf(msOrStr) {
    var s = str(msOrStr);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var n = Number(msOrStr);
    if (!isFinite(n) || n <= 0 || n > 8640000000000000 - 9 * 3600000) return '';
    var d = new Date(n + 9 * 3600000);
    return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }

  function parseYmdUtcMs(ymd) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str(ymd));
    if (!m) return NaN;
    var y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
    var ms = Date.UTC(y, mo - 1, d);
    var dt = new Date(ms);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== mo || dt.getUTCDate() !== d) return NaN;
    return ms;
  }

  function addDaysYmd(ymd, deltaDays) {
    var ms = parseYmdUtcMs(ymd);
    if (!isFinite(ms)) return '';
    var dt = new Date(ms + Number(deltaDays || 0) * DAY_MS);
    return dt.toISOString().slice(0, 10);
  }

  function diffDaysYmd(targetYmd, baseYmd) {
    var t = parseYmdUtcMs(targetYmd);
    var b = parseYmdUtcMs(baseYmd || ymdOf(Date.now()));
    if (!isFinite(t) || !isFinite(b)) return null;
    return Math.round((t - b) / DAY_MS);
  }

  function parseAddrs(raw) {
    var out = [];
    var s = str(raw).toLowerCase();
    if (!s) return out;
    var re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/g;
    var m;
    while ((m = re.exec(s))) {
      if (out.indexOf(m[0]) < 0) out.push(m[0]);
    }
    return out;
  }

  function domainOf(addr) {
    var s = str(addr).toLowerCase();
    var at = s.lastIndexOf('@');
    return at >= 0 ? s.slice(at + 1) : '';
  }

  /* SHA-256 결정론적 해시 (브라우저·Node 공용) */
  var SHA256_K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8BytesOf(input) {
    var s = String(input == null ? '' : input);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) {
        var c2 = s.charCodeAt(++i);
        var u = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff));
        out.push(0xf0 | (u >> 18), 0x80 | ((u >> 12) & 0x3f), 0x80 | ((u >> 6) & 0x3f), 0x80 | (u & 0x3f));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return new Uint8Array(out);
  }

  function rotr32(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256Hex(input) {
    var msg = utf8BytesOf(input);
    var len = msg.length;
    var padLen = (((len + 9 + 63) >> 6) << 6);
    var buf = new Uint8Array(padLen);
    buf.set(msg, 0);
    buf[len] = 0x80;
    var bitHi = Math.floor((len * 8) / 4294967296) >>> 0;
    var bitLo = (len * 8) >>> 0;
    buf[padLen - 8] = (bitHi >>> 24) & 0xff;
    buf[padLen - 7] = (bitHi >>> 16) & 0xff;
    buf[padLen - 6] = (bitHi >>> 8) & 0xff;
    buf[padLen - 5] = bitHi & 0xff;
    buf[padLen - 4] = (bitLo >>> 24) & 0xff;
    buf[padLen - 3] = (bitLo >>> 16) & 0xff;
    buf[padLen - 2] = (bitLo >>> 8) & 0xff;
    buf[padLen - 1] = bitLo & 0xff;
    var H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
    var H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;
    var W = new Int32Array(64);
    for (var off = 0; off < padLen; off += 64) {
      for (var i = 0; i < 16; i++) {
        var j = off + (i << 2);
        W[i] = (buf[j] << 24) | (buf[j + 1] << 16) | (buf[j + 2] << 8) | buf[j + 3];
      }
      for (var t = 16; t < 64; t++) {
        var s0 = rotr32(W[t - 15], 7) ^ rotr32(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        var s1 = rotr32(W[t - 2], 17) ^ rotr32(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      var a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;
      for (var r = 0; r < 64; r++) {
        var S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
        var ch = (e & f) ^ ((~e) & g);
        var t1 = (h + S1 + ch + SHA256_K[r] + W[r]) | 0;
        var S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H0 = (H0 + a) | 0; H1 = (H1 + b) | 0; H2 = (H2 + c) | 0; H3 = (H3 + d) | 0;
      H4 = (H4 + e) | 0; H5 = (H5 + f) | 0; H6 = (H6 + g) | 0; H7 = (H7 + h) | 0;
    }
    return [H0, H1, H2, H3, H4, H5, H6, H7].map(function (v) {
      return ('00000000' + (v >>> 0).toString(16)).slice(-8);
    }).join('');
  }

  function safeIdPart(v) {
    var raw = str(v);
    if (!raw) return 'id';
    if (!/[.#$\/\[\]\s]/.test(raw) && raw.length <= 120) return raw;
    var cleaned = raw.replace(/[.#$\/\[\]\s]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    return (cleaned ? cleaned + '_' : 'id_') + sha256Hex(raw).slice(0, 16);
  }

  /* ── 3. 개인정보 · PC 로컬 경로 2중 비식별 가림 & CSV 수식 방어 ── */
  var EMAIL_RE = /[A-Za-z0-9._%+-]+(?:\s*@\s*)[A-Za-z0-9-]+(?:\s*\.\s*[A-Za-z0-9-]+)*\s*\.\s*[A-Za-z]{2,}/g;
  var RRN_TIGHT_RE = /(^|[^\d])(\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01]))(?:\s*[-.~–—_\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]\s*)?([1-8])\d{6}(?!\d)/g;
  var RRN_SPACED_RE = /(^|[^\d])((?:\d\s*){2}(?:0\s*[1-9]|1\s*[0-2])(?:0\s*[1-9]|[12]\s*\d|3\s*[01]))\s*[-.~–—_\s\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]\s*([1-8])(?:\s*\d){6}(?!\d)/g;
  var BIZ_RE = /(?<!\d)\d{3}-\d{2}-\d{5}(?!\d)/g;
  var TEL_SEP_RE = /(?<!\d)(?:\+82[-.\s]?)?\(?0(?:1[016789]|2|[3-6][1-5]|70)\)?(?:[-.\s]\d{3,4}[-.\s]\d{4}|[-.\s]\d{7,8})(?!\d)/g;
  var TEL_TIGHT_RE = /(?<!\d)0(?:1[016789][1-9]\d{6,7}|2[1-9]\d{6,7}|(?:[3-6][1-5]|70)[1-9]\d{6,7})(?!\d)/g;
  var ACCT_CTX_RE = /((?:계좌(?:\s*번호)?|입금(?:\s*계좌)?|통장(?:\s*번호)?|예금|(?:신한|국민|우리|하나|기업|농협|수협|부산|대구|경남|광주|전북|제주|씨티|SC제일|산업)\s*은행|우체국|새마을금고|신협|카카오\s*뱅크|토스\s*뱅크|케이\s*뱅크)(?:\s+[가-힣A-Za-z]{2,10})?\s*[:：]?\s*)(\d[\d\s.\-]{8,22}\d)(?!\d)/g;
  var ACCT_DOT_HYPHEN_RE = /(?<!\d)\d{2,6}(?:[-.]\d{2,8}){1,3}(?!\d)/g;
  var ACCT_SPACED_3_RE = /(?<!\d)(?!19\d{2}\s|20\d{2}\s)\d{2,6}\s+\d{2,6}\s+\d{4,8}(?:\s+\d{1,6})?(?!\d)/g;
  var ACCT_LONG_RE = /\b\d[\d-]{9,18}\d\b/g;
  var LOCAL_PATH_RE = /(?:[A-Za-z]:\\[^\s"'<>|]{1,220}|\/(?:Users|home)\/[^\s"'<>|]{1,220}|\\\\Users\\\\[^\s"'<>|]{1,220}|C:\\\\Users\\\\[^\s"'<>|]{1,220})/gi;

  function normUnicode(s) {
    var t = s == null ? '' : String(s);
    try { return t.normalize('NFKC'); } catch (_) { return t; }
  }

  function isAccountDigits(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (/^(19|20)\d{6}$/.test(d)) return false;
    return d.length >= 10 && d.length <= 16;
  }

  function maskPiiStrict(rawText, names, opts) {
    var o = opts || {};
    var t = normUnicode(rawText)
      .replace(LOCAL_PATH_RE, '[로컬경로]')
      .replace(RRN_TIGHT_RE, '$1' + GARIM)
      .replace(RRN_SPACED_RE, '$1' + GARIM)
      .replace(EMAIL_RE, GARIM);
    if (o.keepBizNo !== true) t = t.replace(BIZ_RE, GARIM);
    t = t
      .replace(TEL_SEP_RE, GARIM)
      .replace(TEL_TIGHT_RE, GARIM)
      .replace(ACCT_CTX_RE, function (m, prefix, accPart) {
        var d = String(accPart || '').replace(/\D/g, '');
        return (d.length >= 9 && d.length <= 16) ? (prefix + GARIM) : m;
      })
      .replace(ACCT_DOT_HYPHEN_RE, function (m) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(m)) return m;
        if (o.keepCaseNo && /^\d{4}[-.]\d{1,6}$/.test(m)) return m;
        return isAccountDigits(m) ? GARIM : m;
      })
      .replace(ACCT_SPACED_3_RE, function (m) {
        return isAccountDigits(m) ? GARIM : m;
      })
      .replace(ACCT_LONG_RE, function (m) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(m)) return m;
        if (o.keepCaseNo && /^\d{4}[-.]\d{1,6}$/.test(m)) return m;
        return isAccountDigits(m) ? GARIM : m;
      });

    var list = arr(names).map(str).filter(function (n) { return n.length >= 2; });
    list.sort(function (a, b) { return b.length - a.length; });
    list.forEach(function (nm) {
      var escNm = nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      t = t.replace(new RegExp(escNm, 'g'), GARIM);
    });
    return t;
  }

  function hasResidualPii(text) {
    var t = normUnicode(text);
    if (!t) return false;
    RRN_TIGHT_RE.lastIndex = 0;
    RRN_SPACED_RE.lastIndex = 0;
    EMAIL_RE.lastIndex = 0;
    TEL_SEP_RE.lastIndex = 0;
    TEL_TIGHT_RE.lastIndex = 0;
    LOCAL_PATH_RE.lastIndex = 0;
    if (RRN_TIGHT_RE.test(t) || RRN_SPACED_RE.test(t) || EMAIL_RE.test(t) || TEL_SEP_RE.test(t) || TEL_TIGHT_RE.test(t) || LOCAL_PATH_RE.test(t)) {
      return true;
    }
    var acctM = t.match(ACCT_DOT_HYPHEN_RE) || [];
    for (var i = 0; i < acctM.length; i++) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(acctM[i]) && !/^\d{4}[-.]\d{1,6}$/.test(acctM[i]) && isAccountDigits(acctM[i])) return true;
    }
    return false;
  }

  function csvSafeCell(val) {
    var s = String(val == null ? '' : val).replace(/\r?\n/g, ' ').trim();
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCsv(headers, rows) {
    var lines = [];
    lines.push(arr(headers).map(csvSafeCell).join(','));
    arr(rows).forEach(function (r) {
      lines.push(arr(headers).map(function (_, idx) { return csvSafeCell(r && r[idx] != null ? r[idx] : ''); }).join(','));
    });
    return '\uFEFF' + lines.join('\r\n');
  }

  /* ── 4. 노사관계·단체교섭 메일 정밀 판별 · 트랙/서류/연도/회차 추론 ── */
  var PUBLIC_DOMAINS = {
    'naver.com': 1, 'daum.net': 1, 'hanmail.net': 1, 'gmail.com': 1, 'kakao.com': 1,
    'nate.com': 1, 'yahoo.com': 1, 'hotmail.com': 1, 'outlook.com': 1, 'icloud.com': 1,
    'korea.com': 1, 'paran.com': 1, 'korea.kr': 1, 'pureun.kr': 1
  };
  var OWN_RE = /(?:^370-6@(?:daum\.net|hanmail\.net)$|@pureun\.kr$)/i;
  var NOREPLY_RE = /^(?:no[-_.]?reply|do[-_.]?not[-_.]?reply|postmaster|mailer-daemon|newsletter|marketing|webmaster)@/i;
  var BOX_KINDS = ['inbox', 'sent', 'archive', 'custom', 'tome', 'sched'];
  var SKIP_FOLDER_NAME_RE = /휴지통|스팸|정크|임시|초안|광고|뉴스레터|쇼핑|소셜|프로모션|청구서|국민건강고용산재|이력서|trash|spam|junk|draft/i;

  /* 핵심 노사관계·단체교섭 신호 (반드시 실제 노사·교섭 맥락) */
  var STRONG_UNION_RE = /단체\s*교섭|단체\s*협약|단협(?:\s*(?:안|개정|체결|검토|합의|요구|모범|신고))?|임금\s*협상|임금\s*협약|임단협|임협(?:\s*(?:안|타결|합의|요구|검토))?|교섭\s*요구(?:\s*사실|\s*공고|\s*공문)?|교섭\s*창구\s*단일화|창구\s*단일화|교섭\s*참여\s*(?:공고|노조|신청)|교섭\s*요구\s*노동조합\s*확정|교섭\s*대표\s*노조|개별\s*교섭|공정\s*대표\s*의무|노동\s*쟁의|쟁의\s*조정|조정\s*신청|쟁의\s*행위|파업\s*(?:대응|돌입|호소문|시나리오|유형|찬반)|부당\s*노동\s*행위|부노(?:\s*구제|\s*사건)?|근로시간\s*면제|타임\s*오프|노조\s*전임자|보충\s*협약|별도\s*합의서|상견례|실무\s*교섭|본\s*교섭|잠정\s*합의|조인식|노사\s*협의회(?:\s*규정|\s*회의록|\s*위원|\s*개정|\s*설치)?|상호\s*협력\s*규정|노조\s*설립|노동조합\s*(?:설립|규약|지부|분회|교섭|면담|집회|공문)|교섭\s*관련/;
  var SOFT_UNION_RE = /노조|노동\s*조합|노사\s*관계|단체\s*행동|쟁의|파업|단협|교섭|임금\s*인상률/;

  /* 오탐 배제: 단순 홍보·세금계산서·4대보험·급여대장·의무교육·일일뉴스브리핑 */
  var NOISE_RE = /수신\s*거부|unsubscribe|세금\s*계산서\s*발행|전자\s*세금\s*계산서|카드\s*명세서|요금\s*청구서|4대\s*보험\s*(?:상실|취득)|사대보험\s*(?:상실|취득)|입퇴사자\s*요청|연말\s*정산|법정\s*의무\s*교육|성희롱\s*예방\s*교육|장애인\s*인식\s*개선|개인정보\s*보호\s*교육|무료\s*특강|세미나\s*안내|일일\s*뉴스\s*브리핑|뉴스레터|주간\s*브리핑|광고\)/i;

  /* 컨설팅 인터뷰 양식 단독 오탐 차단 — 첨부에 '통합진단 인터뷰 양식_노동조합 및 근로자대표'가 끼어 오는 일반 컨설팅 메일 */
  var CONSULTING_INTERVIEW_ATT_RE = /통합\s*진단\s*인터뷰\s*양식|인터뷰\s*양식[_\s\-]*(?:노동조합|노조|근로자\s*대표|경영자|인사노무|핵심인재)/i;
  var CONSULTING_ONLY_SUBJ_RE = /석유화학산업\s*협력업체\s*컨설팅|산업\s*일자리\s*전환|일터\s*혁신\s*(?:상생)?\s*컨설팅|구조\s*혁신\s*컨설팅|컨설팅\s*(?:진행|자료\s*전달|미팅\s*일정)/i;

  /* 일반 자문·계약·공공기관 이름 배제용 */
  var EXCLUDE_ORG_RE = /푸른노무|공인노무사회|고용노동부|지방노동위원회|중앙노동위원회|근로복지공단|노사발전재단|근로자이음센터|상공회의소|중소기업중앙회|테크노파크|경제진흥원|경영자총협회|법무법인|세무법인|회계법인|국세청|홈택스/;

  function isDedicatedUnionFolder(folderName, folderSlug) {
    var s = str(folderName) + ' ' + str(folderSlug);
    return /(?:^7[._\s]*교섭|교섭\s*관련|단체\s*교섭|노사\s*관계|임단협)/i.test(s);
  }

  function isUnionRelationsMail(subject, attNames, preview, folderName) {
    var subj = str(subject);
    var atts = arr(attNames).map(str).filter(Boolean);
    var prev = str(preview);
    var inDedicated = isDedicatedUnionFolder(folderName, '');

    if (NOISE_RE.test(subj) && !/(?:단체\s*교섭|단체\s*협약|임금\s*협상|임금\s*협약|창구\s*단일화|노동\s*쟁의|쟁의\s*조정|부당\s*노동\s*행위)/.test(subj)) {
      return false;
    }

    /* 컨설팅 인터뷰 양식 단독 오탐 차단 */
    var nonInterviewAtts = atts.filter(function (nm) { return !CONSULTING_INTERVIEW_ATT_RE.test(nm); });
    var hasInterviewAtt = atts.length > nonInterviewAtts.length;
    var restHay = [subj, nonInterviewAtts.join(' '), prev].join(' ');
    if (hasInterviewAtt) {
      if (!STRONG_UNION_RE.test(restHay)) return false;
    }
    if (CONSULTING_ONLY_SUBJ_RE.test(subj) && !STRONG_UNION_RE.test(subj + ' ' + nonInterviewAtts.join(' '))) {
      return false;
    }

    var allHay = [subj, atts.join(' '), prev].join(' ');
    if (STRONG_UNION_RE.test(allHay)) return true;
    if (inDedicated && SOFT_UNION_RE.test(allHay)) return true;

    /* 첨부 없이 제목·본문에 '노동위원회' + '조정/교섭/부노/노조' 조합이 있을 때 */
    if (/노동\s*위원회/.test(allHay) && /(?:조정|교섭|노조|부노|쟁의|단체|임금\s*협)/.test(allHay)) return true;

    return false;
  }

  function inferTrack(subject, attNames, preview) {
    var hay = [str(subject), arr(attNames).join(' '), str(preview)].join(' ');
    if (/창구\s*단일화|교섭\s*요구\s*사실|교섭\s*참여\s*공고|교섭\s*요구\s*노동조합\s*확정|과반수\s*노조|공동\s*교섭\s*대표|단일화\s*공고|교섭\s*단위\s*분리/.test(hay)) {
      return 'single_ch';
    }
    if (/쟁의\s*조정|조정\s*신청|노동\s*쟁의|파업|쟁의\s*행위|부당\s*노동\s*행위|부노|직장\s*폐쇄|대체\s*근로|호소문/.test(hay)) {
      return 'dispute';
    }
    if (/노사\s*협의회|상호\s*협력\s*규정|노조\s*설립|노동조합\s*설립|노조\s*규약|고충\s*처리\s*위원/.test(hay)) {
      return 'council';
    }
    if (/임금\s*협약|임금\s*협상|임협|임단협|임금\s*인상|원가\s*산정|호봉|기본급\s*인상/.test(hay) && !/단체\s*협약\s*안|신구\s*조문/.test(hay)) {
      return 'wage';
    }
    return 'bargain';
  }

  function inferPerformMode(subject, attNames, preview, track) {
    var hay = [str(subject), arr(attNames).join(' '), str(preview)].join(' ');
    if (track === 'dispute' || /조정\s*신청|파업|쟁의\s*행위|부당\s*노동\s*행위|시나리오/.test(hay)) {
      return 'dispute_response';
    }
    if (/교섭\s*대리|대리인\s*선임|위임\s*계약|위임장|수임\s*계약|교섭\s*위임|직접\s*교섭/.test(hay)) {
      return 'direct_bargain';
    }
    if (track === 'council' && !/단체\s*교섭|임금\s*협/.test(hay)) {
      return 'council_setup';
    }
    return 'review_advisory';
  }

  function matchExplicitDocRole(primaryText, subjText, fullFileName) {
    var src = str(primaryText);
    var sb = str(subjText);
    var fn = str(fullFileName);
    if (!src) return null;

    /* ① 체결·합의·신고 서류 */
    if (/행정\s*관청\s*신고|단체\s*협약\s*신고|단협\s*신고/.test(src)) return DOC_ROLES.admin_report;
    if (/잠정\s*합의|개정\s*합의서|합의서\(최종|단협\s*개정\s*합의/.test(src) || (/합의서/.test(src) && !/검토/.test(src))) {
      return DOC_ROLES.tentative_agree;
    }
    if (/(?:최종|체결|조인|확정)\s*(?:단체\s*협약|임금\s*협약|단협|임협)|\d{4}년?도?\s*(?:임금\s*협약서|단체\s*협약서|노사\s*단체\s*협약서)/.test(src) && !/검토|초안|\(안\)/.test(src)) {
      return DOC_ROLES.final_cba;
    }

    /* ② 검토·자문 서류 */
    if (/신구\s*(?:조문|대비|대조)|조문\s*대비|3단\s*비교|대비표|대조표|비교표/.test(src)) return DOC_ROLES.comparison_table;
    if (/원가\s*산정|임금\s*인상률|소요\s*예산|인건비\s*산정|추계|시뮬레이션/.test(src)) return DOC_ROLES.cost_review;
    if (/노사\s*협의회\s*규정|상호\s*협력\s*규정|노조\s*규약|설립\s*규약/.test(src) && /검토|수정|안|개정/.test(src)) return DOC_ROLES.council_review;
    if (/요구안\s*검토|노조\s*요구안|제시안\s*검토|단체교섭\s*요구안/.test(src)) return DOC_ROLES.demand_review;
    if (/검토\s*의견|법률\s*의견|자문\s*의견|의견서|검토본|수정본|검토\s*결과|단체협약\(안\)|검토\)/.test(src) || (!fn && /검토\s*의뢰|자문\s*요청|검토\s*송부|피드백/.test(sb))) {
      return DOC_ROLES.legal_opinion;
    }

    /* ③ 진행 서류 */
    if (/창구\s*단일화|교섭\s*요구\s*사실|교섭\s*참여\s*공고|확정\s*공고|과반수\s*노조\s*공고|단일화\s*공고/.test(src)) return DOC_ROLES.channel_notice;
    if (/교섭\s*요구(?:\s*공문|\s*서|\s*의\s*건)?/.test(src) && !/검토/.test(fn || src)) return DOC_ROLES.demand_notice;
    if (/위임장|위임\s*계약|수임\s*계약|견적서|컨설팅\s*계약/.test(src)) return DOC_ROLES.mandate_contract;
    if (/조정\s*신청|쟁의\s*조정|파업|쟁의\s*행위|부당\s*노동\s*행위|시나리오|호소문|공문\(초안\)/.test(src)) return DOC_ROLES.dispute_doc;
    if (/상견례|교섭\s*일정|회의록|교섭\s*진행|실무\s*교섭|본\s*교섭|노사\s*협의회\s*회의|교섭\s*차수/.test(src)) return DOC_ROLES.schedule_minutes;

    /* ④ 증빙·참고 자료 */
    if (/녹취|문자|증거|호증|강의안|모범안|교재|판례|매뉴얼|\.(?:mp3|m4a|wav|jpg|jpeg|png)$/i.test(src)) return DOC_ROLES.record_evidence;
    return null;
  }

  function inferDocRole(fileName, subject, preview) {
    var fn = str(fileName);
    var sb = str(subject);
    var pv = str(preview);
    /* 여러 첨부파일이 섞인 메일은 제목의 다른 키워드보다 파일명 자체 역할을 먼저 판정 */
    if (fn) {
      var byFile = matchExplicitDocRole(fn, '', fn);
      if (byFile) return byFile;
    }
    var both = (fn + ' ' + sb + ' ' + pv).trim();
    return matchExplicitDocRole(both, sb, fn) || DOC_ROLES.schedule_minutes;
  }

  function extractYear(subject, attNames, dateMsOrStr) {
    var text = [str(subject), arr(attNames).join(' ')].join(' ');
    var m4 = /(?:^|[^\d])(201\d|202\d)\s*(?:년|년도|임단협|임협|단협|단체교섭|임금협상|노사|창구|조정|\.|_|\s|-)/.exec(text);
    if (m4) return m4[1];
    var mAny4 = /(?:^|[^\d])(201[5-9]|202[0-9])(?:[^\d]|$)/.exec(text);
    if (mAny4) return mAny4[1];
    var m6 = /(?:^|[^\d])(2[0-9])(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?:[^\d]|$)/.exec(text);
    if (m6) return '20' + m6[1];
    var ymd = ymdOf(dateMsOrStr);
    if (/^20\d{2}/.test(ymd)) return ymd.slice(0, 4);
    return String(new Date().getFullYear());
  }

  function extractRoundNo(subject, attNames) {
    var text = [str(subject), arr(attNames).join(' ')].join(' ');
    var m = /제?\s*(\d{1,2})\s*차\s*(?:본\s*교섭|실무\s*교섭|단체\s*교섭|임금\s*교섭|교섭|임단협|조정\s*회의|노사\s*협의회)/.exec(text);
    if (m) return Number(m[1]);
    return 0;
  }

  function normCorpName(v) {
    return str(v).normalize('NFC')
      .replace(/\(\s*구[\s.:：]+[^)]*\)/g, '')
      .replace(/농업회사법인|사회복지법인|학교법인|의료법인|사단법인|재단법인|합자회사|합명회사|유한책임회사|유한회사|주식회사|\(주\)|㈜|\(유\)|\(사\)|\(재\)|\(합\)|\(학\)/g, '')
      .replace(/Co\.?\s*,?\s*Ltd\.?|Inc\.?|Corp\.?/gi, '')
      .replace(/\s+/g, '')
      .replace(/[.,·・\-–—_'"()\[\]<>]/g, '')
      .toLowerCase();
  }

  function cleanDisplayCompany(raw) {
    return str(raw)
      .replace(/^(?:re|fw|fwd)\s*[:：]\s*/gi, '')
      .replace(/[\[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
  }

  function extractSubjectBracketCompany(subject) {
    var s = str(subject).replace(/^(?:\s*(?:re|fw|fwd)\s*[:：]\s*)+/gi, '');
    var re = /[\[\(【]\s*([^\]\)】]{2,34})\s*[\]\)】]/g;
    var m;
    while ((m = re.exec(s))) {
      var cand = str(m[1]);
      if (!cand) continue;
      if (/^(?:푸른노무법인|긴급|중요|요청|회신|재전달|공고|단협|임단협|임협|교섭|참고|첨부|안내|검토|\d{4}가단|\d+)$/i.test(cand)) continue;
      if (EXCLUDE_ORG_RE.test(cand)) continue;
      if (/^\d{4}[-.]\d{2}/.test(cand)) continue;
      return cand;
    }
    return '';
  }

  /* ── 5. 메일함 평탄화 · 업체 디렉터리 · 사업장×연도 자동 분류 ── */
  function mailFp(fromAddr, toAddrs, ts, subject, attNames) {
    var tNorm = arr(toAddrs).slice().sort().join(',');
    var sNorm = str(subject).toLowerCase().replace(/\s+/g, '');
    var aNorm = arr(attNames).slice().sort().join(',');
    var slot = ts > 0 ? String(Math.round(ts / 2000)) : '0';
    return str(fromAddr).toLowerCase() + '|' + tNorm + '|' + slot + '|' + sNorm + '|' + aNorm;
  }

  function cleanMailDisplayName(raw) {
    var s = str(raw).replace(/<[^>]*>/g, '').replace(/["']/g, '').trim();
    if (!s || /^[^@\s]+@[^@\s]+$/.test(s)) return '';
    return s.slice(0, 48);
  }

  function flattenMailbox(folders, msgsBySlug, oldMsgsMap) {
    var out = [];
    var imapFpSet = Object.create(null);

    if (obj(folders) && obj(msgsBySlug)) {
      Object.keys(folders).forEach(function (slug) {
        var f = folders[slug];
        if (!okId(slug) || !obj(f) || f.nomsg) return;
        var kind = str(f.kind || 'custom');
        if (BOX_KINDS.indexOf(kind) < 0) return;
        var fName = str(f.name || slug);
        if (kind !== 'custom' && SKIP_FOLDER_NAME_RE.test(fName)) return;
        if (kind === 'custom' && SKIP_FOLDER_NAME_RE.test(fName) && !isDedicatedUnionFolder(fName, slug)) return;

        var box = msgsBySlug[slug];
        if (!obj(box) && !Array.isArray(box)) return;
        var isSent = (kind === 'sent' || kind === 'tome' || kind === 'sched');

        Object.keys(box).forEach(function (uidKey) {
          var m = box[uidKey];
          if (!obj(m) || m._deleted) return;
          var uid = str(m.u || uidKey);
          if (!uid) return;
          var fromAddrs = parseAddrs(m.e || m.f);
          var toAddrs = parseAddrs(m.t);
          var fromAddr = fromAddrs[0] || '';
          if (!isSent && NOREPLY_RE.test(fromAddr)) return;
          var extAddrs = (isSent ? toAddrs : fromAddrs.concat(toAddrs)).filter(function (a) { return !OWN_RE.test(a); });
          var an = Array.isArray(m.an) ? m.an.map(str).filter(Boolean) : [];
          var ts = Number(m.d) || 0;
          if (ts > 0 || str(m.s)) imapFpSet[mailFp(fromAddr, toAddrs, ts, m.s, an)] = 1;
          out.push({
            key: 'i:' + slug + ':' + uid,
            slug: slug,
            folderName: fName,
            uid: uid,
            old: false,
            folderKind: kind,
            dir: isSent ? 'out' : 'in',
            ts: ts,
            date: ymdOf(ts),
            fromName: cleanMailDisplayName(m.f),
            fromAddr: fromAddr,
            toAddr: toAddrs.join(', '),
            toName: cleanMailDisplayName(m.tn) || cleanMailDisplayName(m.t),
            extAddrs: extAddrs,
            subject: str(m.s),
            preview: str(m.p),
            attCount: Number(m.a) || an.length,
            attNames: an
          });
        });
      });
    }

    var oldBox = obj(oldMsgsMap) && oldMsgsMap.v !== undefined ? oldMsgsMap.v : oldMsgsMap;
    if (obj(oldBox) || Array.isArray(oldBox)) {
      Object.keys(oldBox).forEach(function (uidKey) {
        var m = oldBox[uidKey];
        if (!obj(m) || m._deleted) return;
        var uid = str(m.u || uidKey);
        if (!uid) return;
        var fromAddrs = parseAddrs(m.e || m.f);
        var toAddrs = parseAddrs(m.t);
        var fromAddr = fromAddrs[0] || '';
        var isSent = OWN_RE.test(fromAddr);
        if (!isSent && NOREPLY_RE.test(fromAddr)) return;
        var an = Array.isArray(m.an) ? m.an.map(str).filter(Boolean) : [];
        var ts = Number(m.d) || 0;
        var fp = mailFp(fromAddr, toAddrs, ts, m.s, an);
        if ((ts > 0 || str(m.s)) && imapFpSet[fp]) return;
        var extAddrs = (isSent ? toAddrs : fromAddrs.concat(toAddrs)).filter(function (a) { return !OWN_RE.test(a); });
        out.push({
          key: 'p:' + uid,
          slug: '*old',
          folderName: '지난메일(POP3)',
          uid: uid,
          old: true,
          folderKind: 'old',
          dir: isSent ? 'out' : 'in',
          ts: ts,
          date: ymdOf(ts),
          fromName: cleanMailDisplayName(m.f),
          fromAddr: fromAddr,
          toAddr: toAddrs.join(', '),
          toName: cleanMailDisplayName(m.tn) || cleanMailDisplayName(m.t),
          extAddrs: extAddrs,
          subject: str(m.s),
          preview: str(m.p),
          attCount: Number(m.a) || an.length,
          attNames: an
        });
      });
    }

    out.sort(function (a, b) { return (b.ts - a.ts) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0); });
    return out;
  }

  function buildCompanyDirectory(companiesRaw) {
    var list = rowsOf(companiesRaw);
    var byId = Object.create(null);
    var byAddr = Object.create(null);
    var byDomain = Object.create(null);
    var byName = Object.create(null);
    var entries = [];

    list.forEach(function (co) {
      var id = str(co.id);
      var name = str(co.name);
      if (!id || !name) return;
      var norm = normCorpName(name);
      var addrs = [];
      ['email', 'primaryContactEmail', 'contactEmail', 'taxEmail'].forEach(function (f) {
        parseAddrs(co[f]).forEach(function (a) { if (addrs.indexOf(a) < 0) addrs.push(a); });
      });
      if (Array.isArray(co.contacts)) {
        co.contacts.forEach(function (ct) {
          if (obj(ct)) parseAddrs(ct.email).forEach(function (a) { if (addrs.indexOf(a) < 0) addrs.push(a); });
        });
      }
      var entry = { id: id, name: name, norm: norm, addrs: addrs, rec: co };
      byId[id] = entry;
      entries.push(entry);
      if (norm && !byName[norm]) byName[norm] = entry;
      addrs.forEach(function (a) {
        if (!OWN_RE.test(a) && !byAddr[a]) byAddr[a] = entry;
        var dom = domainOf(a);
        if (dom && !PUBLIC_DOMAINS[dom]) {
          if (!byDomain[dom]) byDomain[dom] = [];
          if (byDomain[dom].indexOf(entry) < 0) byDomain[dom].push(entry);
        }
      });
    });

    entries.sort(function (a, b) { return b.norm.length - a.norm.length; });
    return { byId: byId, byAddr: byAddr, byDomain: byDomain, byName: byName, entries: entries };
  }

  function inferCompanyFromMail(mail, dir) {
    var i;
    var addrs = arr(mail.extAddrs);

    /* 1순위: ERP 등록 이메일 정확 일치 */
    for (i = 0; i < addrs.length; i++) {
      var hitA = dir.byAddr[addrs[i]];
      if (hitA) return { companyId: hitA.id, companyName: hitA.name, matchBy: 'email' };
    }

    /* 2순위: 사설 도메인 단일 일치 */
    for (i = 0; i < addrs.length; i++) {
      var dom = domainOf(addrs[i]);
      if (dom && !PUBLIC_DOMAINS[dom] && dir.byDomain[dom] && dir.byDomain[dom].length === 1) {
        var hitD = dir.byDomain[dom][0];
        return { companyId: hitD.id, companyName: hitD.name, matchBy: 'domain' };
      }
    }

    /* 3순위: 제목 말머리 [사업장] */
    var bracketCo = extractSubjectBracketCompany(mail.subject);
    if (bracketCo) {
      var bn = normCorpName(bracketCo);
      if (bn && dir.byName[bn]) {
        return { companyId: dir.byName[bn].id, companyName: dir.byName[bn].name, matchBy: 'bracket_erp' };
      }
      return { companyId: '', companyName: cleanDisplayCompany(bracketCo), matchBy: 'bracket' };
    }

    /* 4순위: 제목 + 첨부파일명에 포함된 ERP 등록 상호명 */
    var subjAndAtt = normCorpName(str(mail.subject) + ' ' + arr(mail.attNames).join(' '));
    for (i = 0; i < dir.entries.length; i++) {
      var e = dir.entries[i];
      if (e.norm.length >= 3 && !EXCLUDE_ORG_RE.test(e.name) && subjAndAtt.indexOf(e.norm) >= 0) {
        return { companyId: e.id, companyName: e.name, matchBy: 'name_erp' };
      }
    }

    /* 5순위: 메일 발신/수신 표시명 추론 */
    var disp = mail.dir === 'out' ? str(mail.toName) : str(mail.fromName);
    disp = disp.replace(/(?:노무|인사|총무|기획|관리)?(?:팀|과|부|담당자|과장|차장|부장|대리|주임|사원|님|대표|원장|센터장|사무국장)$/g, '').trim();
    if (disp.length >= 2 && !EXCLUDE_ORG_RE.test(disp) && !/[@.]/.test(disp)) {
      var dn = normCorpName(disp);
      if (dn && dir.byName[dn]) return { companyId: dir.byName[dn].id, companyName: dir.byName[dn].name, matchBy: 'sender_erp' };
      return { companyId: '', companyName: cleanDisplayCompany(disp), matchBy: 'sender' };
    }

    return { companyId: '', companyName: '미분류 사업장', matchBy: 'none' };
  }

  function classifyMail(mailRow, dir) {
    var subj = str(mailRow && mailRow.subject);
    var atts = arr(mailRow && mailRow.attNames).map(str).filter(Boolean);
    var prev = str(mailRow && mailRow.preview);
    var folderName = str(mailRow && mailRow.folderName);
    var isUnion = isUnionRelationsMail(subj, atts, prev, folderName);
    if (!isUnion) return { isUnion: false };

    var track = inferTrack(subj, atts, prev);
    var performMode = inferPerformMode(subj, atts, prev, track);
    var year = extractYear(subj, atts, (mailRow && (mailRow.date || mailRow.ts)) || '');
    var roundNo = extractRoundNo(subj, atts);

    var docItems = [];
    if (atts.length) {
      atts.forEach(function (nm, idx) {
        var roleObj = inferDocRole(nm, subj, prev);
        docItems.push({
          idx: idx,
          fileName: nm,
          role: roleObj.code,
          roleLabel: roleObj.label,
          group: roleObj.group,
          stepCode: roleObj.stepCode
        });
      });
    } else {
      var mailRole = inferDocRole('', subj, prev);
      docItems.push({
        idx: -1,
        fileName: '',
        role: mailRole.code,
        roleLabel: mailRole.label,
        group: mailRole.group,
        stepCode: mailRole.stepCode
      });
    }

    var primaryRole = docItems[0];
    var co = dir ? inferCompanyFromMail(mailRow, dir) : { companyId: '', companyName: extractSubjectBracketCompany(subj) || '미분류 사업장', matchBy: 'none' };

    return {
      isUnion: true,
      track: track,
      performMode: performMode,
      year: year,
      roundNo: roundNo,
      docRole: primaryRole.role,
      docRoleLabel: primaryRole.roleLabel,
      docGroup: primaryRole.group,
      stepCode: primaryRole.stepCode,
      docItems: docItems,
      companyId: co.companyId,
      companyName: co.companyName,
      matchBy: co.matchBy
    };
  }

  function caseYearOf(c) {
    if (!c || typeof c !== 'object') return '';
    if (str(c.year) && /^20\d{2}$/.test(str(c.year))) return str(c.year);
    var ymd = ymdOf(c.receiveDate || c.demandDate || c.createdAt);
    return /^20\d{2}/.test(ymd) ? ymd.slice(0, 4) : '';
  }

  function buildCaseStepsDefault() {
    var out = {};
    STEPS.forEach(function (st) {
      out[st.code] = { done: false, autoDone: false, manual: false, date: '', note: '' };
    });
    return out;
  }

  function reconstructStepsFromMails(existingSteps, mailItems, docItems) {
    var base = buildCaseStepsDefault();
    var prev = obj(existingSteps) ? existingSteps : {};
    var autoMap = Object.create(null);

    arr(mailItems).forEach(function (m) {
      if (!m) return;
      var sc = str(m.stepCode);
      if (sc && (!autoMap[sc] || str(m.date) > autoMap[sc].date)) {
        autoMap[sc] = { date: str(m.date), label: str(m.subject).slice(0, 40) };
      }
      arr(m.docItems).forEach(function (di) {
        if (di && di.stepCode && (!autoMap[di.stepCode] || str(m.date) > autoMap[di.stepCode].date)) {
          autoMap[di.stepCode] = { date: str(m.date), label: str(di.fileName || m.subject).slice(0, 40) };
        }
      });
    });

    arr(docItems).forEach(function (d) {
      if (!d || d._deleted) return;
      var sc = str(d.stepCode || (DOC_ROLES[d.role] && DOC_ROLES[d.role].stepCode));
      if (sc && (!autoMap[sc] || str(d.docDate) > autoMap[sc].date)) {
        autoMap[sc] = { date: str(d.docDate), label: str(d.title || d.fileName).slice(0, 40) };
      }
    });

    STEPS.forEach(function (st) {
      var cur = obj(prev[st.code]) ? Object.assign({}, prev[st.code]) : {};
      var autoHit = autoMap[st.code];
      if (cur.manual === true) {
        base[st.code] = {
          done: !!cur.done,
          autoDone: !!autoHit,
          manual: true,
          date: str(cur.date) || (autoHit ? autoHit.date : ''),
          note: str(cur.note)
        };
      } else {
        base[st.code] = {
          done: !!cur.done || !!autoHit,
          autoDone: !!autoHit,
          manual: false,
          date: str(cur.date) || (autoHit ? autoHit.date : ''),
          note: str(cur.note) || (autoHit ? autoHit.label : '')
        };
      }
    });
    return base;
  }

  function computeProgress(steps) {
    var s = obj(steps) ? steps : {};
    var doneCount = 0;
    var lastDoneIdx = -1;
    STEPS.forEach(function (st, idx) {
      if (s[st.code] && s[st.code].done) {
        doneCount++;
        lastDoneIdx = idx;
      }
    });
    var curIdx = Math.min(STEPS.length - 1, Math.max(0, lastDoneIdx + (doneCount < STEPS.length ? 1 : 0)));
    var curStep = STEPS[curIdx];
    return {
      doneCount: doneCount,
      totalCount: STEPS.length,
      pct: Math.round((doneCount / STEPS.length) * 100),
      currentStepCode: curStep.code,
      currentStepShort: doneCount === STEPS.length ? '종결완료' : curStep.short,
      currentStepName: doneCount === STEPS.length ? '⑧ 신고·이행관리·종결 완료' : curStep.name
    };
  }

  function scanAndGroupUnionMails(flatMails, opts) {
    var o = opts || {};
    var dir = buildCompanyDirectory(o.companies);
    var existingCases = rowsOf(o.existingCases);
    var dismissedMap = obj(o.dismissed) ? o.dismissed : {};

    var caseByIdMap = Object.create(null);
    var caseIndexByKey = Object.create(null);
    var caseIndexByCoYr = Object.create(null);
    var caseIndexByMailKey = Object.create(null);

    existingCases.forEach(function (c) {
      if (!c || c._deleted) return;
      if (c.id) caseByIdMap[c.id] = c;
      var yr = caseYearOf(c);
      var coN = normCorpName(c.companyName);
      if (c.companyId && yr) caseIndexByKey[c.companyId + '|' + yr] = c;
      if (coN && yr) caseIndexByCoYr[coN + '|' + yr] = c;
      arr(c.mailLinks).forEach(function (ml) {
        var mk = obj(ml) ? ml.key : str(ml);
        if (mk) caseIndexByMailKey[mk] = c;
      });
    });

    if (obj(o.linkedMailsByCaseId)) {
      Object.keys(o.linkedMailsByCaseId).forEach(function (cid) {
        var targetCase = caseByIdMap[cid];
        if (!targetCase) return;
        rowsOf(o.linkedMailsByCaseId[cid]).forEach(function (mRec) {
          var mk = str(mRec.mailKey || mRec.key);
          if (mk) caseIndexByMailKey[mk] = targetCase;
        });
      });
    }

    var unionMails = [];
    var matchedByCaseId = Object.create(null);
    var bundleMap = Object.create(null);
    var byYear = Object.create(null);
    var byTrack = Object.create(null);
    var byDocGroup = Object.create(null);

    arr(flatMails).forEach(function (m) {
      if (!m) return;
      var cl = classifyMail(m, dir);
      if (!cl.isUnion) return;

      var row = Object.assign({}, m, {
        track: cl.track,
        performMode: cl.performMode,
        year: cl.year,
        roundNo: cl.roundNo,
        docRole: cl.docRole,
        docRoleLabel: cl.docRoleLabel,
        docGroup: cl.docGroup,
        stepCode: cl.stepCode,
        docItems: cl.docItems,
        companyId: cl.companyId,
        companyName: cl.companyName,
        matchBy: cl.matchBy
      });

      byYear[cl.year] = (byYear[cl.year] || 0) + 1;
      byTrack[cl.track] = (byTrack[cl.track] || 0) + 1;
      cl.docItems.forEach(function (di) {
        byDocGroup[di.group] = (byDocGroup[di.group] || 0) + 1;
      });

      var hitCase = caseIndexByMailKey[m.key]
        || (cl.companyId && caseIndexByKey[cl.companyId + '|' + cl.year])
        || (normCorpName(cl.companyName) && caseIndexByCoYr[normCorpName(cl.companyName) + '|' + cl.year])
        || null;

      if (hitCase) {
        row.linkedCaseId = hitCase.id;
        row.linkedCaseTitle = hitCase.title || hitCase.companyName;
        if (!matchedByCaseId[hitCase.id]) matchedByCaseId[hitCase.id] = [];
        matchedByCaseId[hitCase.id].push(row);
        unionMails.push(row);
        return;
      }

      unionMails.push(row);
      var coKey = cl.companyId ? ('id:' + cl.companyId) : ('nm:' + (normCorpName(cl.companyName) || safeKey(cl.companyName)));
      var bundleKey = coKey + '|' + cl.year;
      var dismissId = 'dis_' + sha256Hex(bundleKey).slice(0, 16);
      if (dismissedMap[dismissId] && !dismissedMap[dismissId]._deleted) return;

      if (!bundleMap[bundleKey]) {
        bundleMap[bundleKey] = {
          id: 'bun_' + sha256Hex(bundleKey).slice(0, 16),
          dismissId: dismissId,
          bundleKey: bundleKey,
          companyId: cl.companyId || '',
          companyName: cl.companyName || '미분류 사업장',
          year: cl.year,
          track: cl.track,
          performMode: cl.performMode,
          trackCounts: Object.create(null),
          mailCount: 0,
          progressDocCount: 0,
          reviewDocCount: 0,
          signedDocCount: 0,
          evidenceDocCount: 0,
          latestDate: '',
          earliestDate: '',
          suggestedTitle: '',
          mails: [],
          docs: []
        };
      }
      var b = bundleMap[bundleKey];
      b.mailCount++;
      b.mails.push(row);
      b.trackCounts[cl.track] = (b.trackCounts[cl.track] || 0) + 1;
      if (row.date && (!b.latestDate || row.date > b.latestDate)) b.latestDate = row.date;
      if (row.date && (!b.earliestDate || row.date < b.earliestDate)) b.earliestDate = row.date;
      cl.docItems.forEach(function (di) {
        if (di.group === 'progress') b.progressDocCount++;
        else if (di.group === 'review') b.reviewDocCount++;
        else if (di.group === 'signed') b.signedDocCount++;
        else b.evidenceDocCount++;
        if (di.fileName) {
          b.docs.push({
            fileName: di.fileName,
            role: di.role,
            roleLabel: di.roleLabel,
            group: di.group,
            stepCode: di.stepCode,
            docDate: row.date,
            mailKey: row.key,
            subject: maskPiiStrict(row.subject, [], { keepBizNo: true, keepCaseNo: true })
          });
        }
      });
    });

    var bundles = Object.keys(bundleMap).map(function (k) {
      var b = bundleMap[k];
      var bestTrack = b.track;
      var bestCnt = -1;
      Object.keys(b.trackCounts).forEach(function (tc) {
        if (b.trackCounts[tc] > bestCnt) { bestCnt = b.trackCounts[tc]; bestTrack = tc; }
      });
      b.track = bestTrack;
      b.performMode = inferPerformMode(b.mails.map(function (x) { return x.subject; }).join(' '), [], '', bestTrack);
      var trObj = TRACKS[bestTrack] || TRACKS.bargain;
      b.suggestedTitle = b.year + '년 ' + trObj.short;
      b.steps = reconstructStepsFromMails(null, b.mails, b.docs);
      b.progress = computeProgress(b.steps);
      return b;
    });

    bundles.sort(function (a, b) {
      return (b.latestDate || '').localeCompare(a.latestDate || '') || (b.mailCount - a.mailCount);
    });

    return {
      unionMails: unionMails,
      matchedByCaseId: matchedByCaseId,
      bundles: bundles,
      stats: {
        totalScanned: arr(flatMails).length,
        unionMailCount: unionMails.length,
        bundleCount: bundles.length,
        matchedMailCount: Object.keys(matchedByCaseId).reduce(function (acc, id) { return acc + matchedByCaseId[id].length; }, 0),
        byYear: byYear,
        byTrack: byTrack,
        byDocGroup: byDocGroup
      }
    };
  }

  /* ── 6. 법정기일 계산기 (교섭창구단일화 · 노동쟁의조정) ── */
  function calcChannelTimeline(demandDateYmd, baseTodayYmd) {
    var start = ymdOf(demandDateYmd);
    if (!start || !isFinite(parseYmdUtcMs(start))) return { ok: false, milestones: [] };
    var today = ymdOf(baseTodayYmd) || ymdOf(Date.now());

    /* 노조법 시행령 제14조의2 ~ 제14조의10 법정 일수 */
    var specs = [
      { key: 'demand',          label: '① 교섭요구 접수일',               daysOffset: 0,  legalBasis: '노조법 시행령 제14조의2' },
      { key: 'notice_end',      label: '② 교섭요구사실 공고 마감 (7일)',   daysOffset: 7,  legalBasis: '시행령 제14조의3 (접수일부터 7일간 공고·타노조 참여신청)' },
      { key: 'confirm_start',   label: '③ 교섭요구 노조 확정공고 시작',    daysOffset: 8,  legalBasis: '시행령 제14조의4 제1항 (공고기간 끝난 다음 날)' },
      { key: 'confirm_end',     label: '④ 확정공고 및 이의신청 마감 (5일)', daysOffset: 12, legalBasis: '시행령 제14조의4 제2항 (확정공고 5일간 이의 가능)' },
      { key: 'autonomy_end',    label: '⑤ 자율적 단일화 마감 (14일)',      daysOffset: 26, legalBasis: '시행령 제14조의6 (확정일로부터 14일 이내 자율 결정)' },
      { key: 'majority_notice', label: '⑥ 과반수 노조 통지 기한 (5일)',    daysOffset: 31, legalBasis: '시행령 제14조의7 제1항 (자율단일화 만료 후 5일 이내)' },
      { key: 'majority_pub',    label: '⑦ 과반수 노조 공고 마감 (5일)',    daysOffset: 36, legalBasis: '시행령 제14조의7 제2항 (통지받은 날부터 5일간 공고)' },
      { key: 'joint_rep_end',   label: '⑧ 공동교섭대표단 구성 기한 (10일)', daysOffset: 46, legalBasis: '시행령 제14조의8 (공고 만료일 다음 날부터 10일 이내)' }
    ];

    var milestones = specs.map(function (sp) {
      var date = addDaysYmd(start, sp.daysOffset);
      var dDay = diffDaysYmd(date, today);
      var state = dDay < 0 ? 'past' : (dDay <= 3 ? 'urgent' : 'upcoming');
      return {
        key: sp.key,
        label: sp.label,
        daysOffset: sp.daysOffset,
        date: date,
        dDay: dDay,
        dDayLabel: dDay === 0 ? 'D-Day' : (dDay > 0 ? ('D-' + dDay) : ('D+' + Math.abs(dDay))),
        state: state,
        legalBasis: sp.legalBasis
      };
    });

    return { ok: true, demandDate: start, today: today, milestones: milestones };
  }

  function calcDisputeTimeline(applyDateYmd, isPublicService, baseTodayYmd) {
    var start = ymdOf(applyDateYmd);
    if (!start || !isFinite(parseYmdUtcMs(start))) return { ok: false, milestones: [] };
    var today = ymdOf(baseTodayYmd) || ymdOf(Date.now());
    var periodDays = isPublicService ? 15 : 10; /* 노조법 제54조 제1항: 일반 10일 / 공익 15일 */
    var specs = [
      { key: 'apply',   label: '① 노동쟁의 조정신청 접수일', daysOffset: 0,              legalBasis: '노조법 제53조' },
      { key: 'normal',  label: '② 기본 조정기간 만료 (' + periodDays + '일)', daysOffset: periodDays, legalBasis: '노조법 제54조 제1항 (' + (isPublicService ? '공익사업 15일' : '일반사업 10일') + ')' },
      { key: 'extend',  label: '③ 합의 연장 시 최대 만료 (' + (periodDays * 2) + '일)', daysOffset: periodDays * 2, legalBasis: '노조법 제54조 제3항 (당사자 합의로 동 기간 내 연장 가능)' }
    ];
    var milestones = specs.map(function (sp) {
      var date = addDaysYmd(start, sp.daysOffset);
      var dDay = diffDaysYmd(date, today);
      var state = dDay < 0 ? 'past' : (dDay <= 3 ? 'urgent' : 'upcoming');
      return {
        key: sp.key,
        label: sp.label,
        daysOffset: sp.daysOffset,
        date: date,
        dDay: dDay,
        dDayLabel: dDay === 0 ? 'D-Day' : (dDay > 0 ? ('D-' + dDay) : ('D+' + Math.abs(dDay))),
        state: state,
        legalBasis: sp.legalBasis
      };
    });
    return { ok: true, applyDate: start, isPublicService: !!isPublicService, periodDays: periodDays, milestones: milestones };
  }

  /* ── 7. 임금협상 원가 · 인상률 시뮬레이터 ── */
  function simulateWageImpact(input) {
    var i = input || {};
    var headcount = Math.max(0, Number(i.headcount) || 0);
    var monthlyBaseTotal = Math.max(0, Number(i.monthlyBaseTotal) || 0);
    var demandRate = Math.max(0, Number(i.demandRate) || 0);
    var offerRate = Math.max(0, Number(i.offerRate) || 0);
    var agreedRate = Math.max(0, Number(i.agreedRate) || 0);
    var indirectRatio = i.indirectRatio == null ? 19.5 : Math.max(0, Number(i.indirectRatio) || 0); /* 4대보험 사업주부담 + 퇴직급여 충당금 기본 비율(%) */

    function calcScenario(ratePct) {
      var monthlyBaseDelta = Math.round(monthlyBaseTotal * (ratePct / 100));
      var annualBaseDelta = monthlyBaseDelta * 12;
      var annualTotalWithIndirect = Math.round(annualBaseDelta * (1 + indirectRatio / 100));
      var perPersonMonthly = headcount > 0 ? Math.round(monthlyBaseDelta / headcount) : 0;
      var perPersonAnnual = headcount > 0 ? Math.round(annualTotalWithIndirect / headcount) : 0;
      return {
        ratePct: ratePct,
        monthlyBaseDelta: monthlyBaseDelta,
        annualBaseDelta: annualBaseDelta,
        annualTotalWithIndirect: annualTotalWithIndirect,
        perPersonMonthly: perPersonMonthly,
        perPersonAnnual: perPersonAnnual
      };
    }

    var demand = calcScenario(demandRate);
    var offer = calcScenario(offerRate);
    var agreed = calcScenario(agreedRate);
    var annualGap = Math.max(0, demand.annualTotalWithIndirect - offer.annualTotalWithIndirect);
    var rateGapPct = Math.round((demandRate - offerRate) * 100) / 100;

    return {
      headcount: headcount,
      monthlyBaseTotal: monthlyBaseTotal,
      indirectRatio: indirectRatio,
      demand: demand,
      offer: offer,
      agreed: agreed,
      annualGap: annualGap,
      rateGapPct: rateGapPct
    };
  }

  return {
    TRACKS: TRACKS,
    TRACK_ORDER: TRACK_ORDER,
    STEPS: STEPS,
    PERFORM_MODES: PERFORM_MODES,
    STATUSES: STATUSES,
    DOC_GROUPS: DOC_GROUPS,
    DOC_ROLES: DOC_ROLES,
    REVIEW_STATES: REVIEW_STATES,
    CLAUSE_CATEGORIES: CLAUSE_CATEGORIES,
    CLAUSE_STATES: CLAUSE_STATES,
    str: str,
    obj: obj,
    arr: arr,
    has: has,
    okId: okId,
    digits: digits,
    rowsOf: rowsOf,
    safeKey: safeKey,
    safeIdPart: safeIdPart,
    sha256Hex: sha256Hex,
    ymdOf: ymdOf,
    addDaysYmd: addDaysYmd,
    diffDaysYmd: diffDaysYmd,
    parseAddrs: parseAddrs,
    domainOf: domainOf,
    normUnicode: normUnicode,
    maskPiiStrict: maskPiiStrict,
    hasResidualPii: hasResidualPii,
    csvSafeCell: csvSafeCell,
    toCsv: toCsv,
    isDedicatedUnionFolder: isDedicatedUnionFolder,
    isUnionRelationsMail: isUnionRelationsMail,
    inferTrack: inferTrack,
    inferPerformMode: inferPerformMode,
    inferDocRole: inferDocRole,
    extractYear: extractYear,
    extractRoundNo: extractRoundNo,
    normCorpName: normCorpName,
    cleanDisplayCompany: cleanDisplayCompany,
    extractSubjectBracketCompany: extractSubjectBracketCompany,
    flattenMailbox: flattenMailbox,
    buildCompanyDirectory: buildCompanyDirectory,
    inferCompanyFromMail: inferCompanyFromMail,
    classifyMail: classifyMail,
    caseYearOf: caseYearOf,
    buildCaseStepsDefault: buildCaseStepsDefault,
    reconstructStepsFromMails: reconstructStepsFromMails,
    computeProgress: computeProgress,
    scanAndGroupUnionMails: scanAndGroupUnionMails,
    calcChannelTimeline: calcChannelTimeline,
    calcDisputeTimeline: calcDisputeTimeline,
    simulateWageImpact: simulateWageImpact
  };
});
