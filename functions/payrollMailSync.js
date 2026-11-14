// Firebase Cloud Functions: 푸른메일함(37***@hanmail.net) IMAP 수신 → 개인정보 자체 마스킹 + 사업장별 원본 금고 자동 분배
//
// ⛔ 아직 배포하지 않는다 (2026-11-09 보안 검토 결과)
//   · functions/index.js 에 연결돼 있지 않다.
//   · 쓰는 자리 payroll_outsourcing / payroll_vault_raw 가 보안규칙(scripts/make-firebase-rules.js)과
//     온톨로지(js/pu-ontology.js)에 등록돼 있지 않다 — 등록 전에는 «주인 없는 저장 자리»다.
//   · 원본 금고(payroll_vault_raw)에 주민번호가 들어 있는 본문을 그대로 저장한다 — 봉인(rrnScrub) 설계 후에 연결할 것.
//   · 발신자 «주소 일부 일치»만으로 사업장 금고를 정한다 — 보낸 사람을 속일 수 있다.
//     연결 전에 정확한 주소 비교와 SPF/DKIM 통과 여부 확인, 미확인 건은 unclassified(검토함)로 두는 설계가 필요하다.
//   · uid 는 «메일함+UIDVALIDITY+UID» 처럼 충돌 없는 값으로 받아야 한다(여기서는 형식만 검사해 거절한다).
//   · 마스킹은 «최선의 노력»이다 — 자유 형식 글을 정규식으로 가리는 방식은 모든 모양을 증명할 수 없다.
//     연결 전에 «저장하지 않음이 기본값»인 구조(허용한 칸만 저장)로 바꾼다.
// 연결하려면 위 항목을 먼저 해결하고 이 모듈을 require('./payrollMailSync')로 연결한다.
//
// ⚠ 마스킹·사업장 매칭 규칙은 js/pu-payroll-mail-bridge.js(화면이 쓰는 원본)의 사본이다.
//   서버 배포물(functions/)은 js/ 를 가져갈 수 없어 복사해 두었다. 한쪽을 고치면 다른 쪽도 고치고
//   tests/payroll-mail-masking-parity.test.js 로 결과가 같은지 확인한다.

const admin = require('firebase-admin');

const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;      // Firebase 키로 쓸 수 있고 서로 겹치지 않는 형식만 받는다

// ── 마스킹 (브릿지와 같은 규칙) ──
function maskEmailServer(s) {
  return String(s || '').replace(/[A-Za-z0-9._%+-]+@/g, (m) => (m.length > 3 ? m.slice(0, 2) : '') + '***@');
}

const DATE_START = /^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/;

// 숫자·하이픈 «덩어리» 단위: 날짜는 그대로, 전화는 앞 마디만, 하이픈 계좌는 숫자 8개 이상이면 통째로, 하이픈 없는 10자리 이상도 통째로
function maskDigitRuns(s) {
  return s.replace(/(^|[^\d])(\d[\d-]*\d)/g, (m, pre, run) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(run)) return m;
    const digits = run.replace(/-/g, '');
    const phone = /^(0\d{1,2})-?(\d{3,4})-?(\d{4})$/.exec(run);
    if (phone && digits.length >= 9 && digits.length <= 11) return pre + phone[1] + '-****-****';
    if (run.indexOf('-') !== -1) return digits.length >= 8 ? pre + '***-****-****' : m;
    return digits.length >= 10 ? pre + '************' : m;
  });
}

// 계좌 «라벨»(은행 이름·계좌·입금 등) 바로 뒤(사이에 글자 12자까지)의 번호 덩어리는 공백·점으로 나뉘었거나 9자리여도 가린다.
// 덩어리가 날짜로 시작하면(입금: 2026-11-02 10시) 건드리지 않는다.
const ACCOUNT_LABEL = new RegExp('(계좌번호|계좌|통장|입금|송금|이체|은행|뱅크|금고|농협|국민|신한|우리|하나|기업|카카오|토스|새마을|우체국|씨티|SC제일|부산|대구|광주|전북|경남|제주)([^\\d\\n]{0,12})(\\d[\\d .-]*\\d)', 'g');
function maskAccountContext(s) {
  return s.replace(ACCOUNT_LABEL, (m, label, gap, num) => {
    if (DATE_START.test(num)) return m;
    return num.replace(/\D/g, '').length >= 8 ? label + gap + '***-****-****' : m;
  });
}

// 순서가 중요하다: 라벨 뒤 계좌 → 주민번호 → 구분자가 섞인 전화 → 숫자 덩어리
function maskPiiServer(rawText) {
  if (!rawText) return '';
  let s = maskEmailServer(rawText);
  s = maskAccountContext(s);
  s = s.replace(/(^|[^\d])(\d{6})[-\s]?([1-8]\d{6})(?!\d|-\d)/g, (m, pre) => pre + '******-*******');                  // 주민번호(생년월일까지)
  s = s.replace(/(^|[^\d-])(0\d{1,2})[-.\s](\d{3,4})[-.\s](\d{4})(?!\d|-\d)/g, (m, pre, p1) => pre + p1 + '-****-****'); // 구분자가 섞인 전화
  return maskDigitRuns(s);
}

// 한글 이름(2~4자)만 있는 말 하나: 가운데 글자를 가린다
function maskNameServer(s) {
  const t = String(s || '').trim();
  if (!/^[가-힣]{2,4}$/.test(t)) return String(s || '');
  return t.charAt(0) + '*'.repeat(t.length - 2 || 1) + (t.length > 2 ? t.charAt(t.length - 1) : '');
}

// 글 안에서 «이미 알고 있는 이름들»을 가린다
function maskNamesServer(text, names) {
  let out = String(text || '');
  (names || []).forEach((n) => {
    if (/^[가-힣]{2,4}$/.test(String(n || ''))) out = out.split(n).join(maskNameServer(n));
  });
  return out;
}

// 본문에서 «성명: 홍길동», «입사자 홍길동», «신규 입사(단시간): 김하늘» 처럼 라벨 뒤에 적힌 이름을 모두 찾는다
const NAME_LABEL_SRC = '(?:신규\\s*입사자|신규\\s*입사|입사자|퇴사자|성명|이름|파트타임|보조)(?:\\([^)]{0,10}\\))?\\s*[:：]?\\s*([가-힣]{2,4})';
const NOT_A_NAME = ['없음', '미정', '확인', '해당없음', '실무확인'];
const NOT_NAME_WORD = /신고|부탁|주민|번호|퇴사|입사|취득|상실|사직|연락|계좌|급여|보수|근태|사업장|신규|자진|안내|문의|처리|요청/;
function isNameLike(w) { return NOT_A_NAME.indexOf(w) === -1 && !NOT_NAME_WORD.test(w); }
function findNamesServer(text) {
  const found = [];
  const re = new RegExp(NAME_LABEL_SRC, 'g');
  const str = String(text || '');
  let m;
  while ((m = re.exec(str)) !== null) {
    if (isNameLike(m[1]) && found.indexOf(m[1]) === -1) found.push(m[1]);
  }
  return found;
}

// 보낸이 줄: 주소·전화·번호를 가리고, 한글 이름(2~4자)은 가운데 글자를 가린다 — 괄호 안 이름도.
// 직함(대표·과장…)과 상호처럼 보이는 말(…점·…집·…정밀·…상사 등)은 건드리지 않는다.
const TITLES = ['대표님', '대표', '사장님', '사장', '과장님', '과장', '부장님', '부장', '팀장님', '팀장', '실장님', '실장', '이사님', '이사', '사모님', '사모', '대리님', '대리', '주임님', '주임', '원장님', '원장', '담당자', '담당'];
const COMPANY_WORD = /(점|집|정밀|상사|상회|산업|공업|건설|테크|전자|식품|푸드|농장|축산|한우|식당|마트|병원|의원|약국|학원|센터|협회|조합|법인|회사|공사|컴퍼니|그룹|엔지니어링|커뮤니케이션|구조|가구|물산|유통|화학|기계|전기|통신|교육|연구소|사무소|사무실)$/;
function maskFromServer(from) {
  const titles = TITLES.join('|');
  return maskPiiServer(from)
    .replace(new RegExp('(^|[\\s"(])([가-힣]{2,4})(' + titles + ')(?=$|[\\s")<(])', 'g'), (m, pre, w, t) => pre + maskNameServer(w) + t)
    .replace(/(^|[\s"(])([가-힣]{2,4})(?=$|[\s")<(])/g, (m, pre, w) => ((TITLES.indexOf(w) !== -1 || COMPANY_WORD.test(w)) ? m : pre + maskNameServer(w)));
}

// ── 사업장 매칭 (브릿지와 같은 규칙) ──
//  ① 발신 주소(pay_mail)가 겹치는 사업장이 «하나뿐»이면 그곳, 여럿이면 그 안에서만 이름으로 고른다
//  ② 회사 형태 표기까지 그대로 «전체 이름(지점 포함)»이 글에 있으면 2000+길이, 표기(㈜·(주)·주식회사 등)를 떼고 맞으면 1000+길이
//     (글과 이름 모두에 회사 표기가 있으면 +500), 지점까지 뗀 «머리 이름»만 맞으면 길이.
//     글에 회사 표기가 있는데 이름에는 없으면(법인 아닌 같은 이름) 첫 단계(2000+)는 주지 않는다.
//     점수가 같은 사업장이 둘이면(같은 이름의 지점 둘) «못 정함». 못 찾았거나 모호하면 null.
const CORP = /\(주\)|㈜|주식회사|농업회사법인|유한회사|합자회사|재단법인|사단법인/g;
const CORP_ANY = /\(주\)|㈜|주식회사|농업회사법인|유한회사|합자회사|재단법인|사단법인/;
function rawSqueeze(s) { return String(s || '').replace(/\(주\)|㈜/g, '').replace(/[()[\]]/g, '').replace(/\s+/g, ''); }   // 회사 형태 표기(주식회사 등)는 «남긴다»
function squeeze(s) { return String(s || '').replace(CORP, '').replace(/[()[\]]/g, '').replace(/\s+/g, ''); }
function headOf(s) { return String(s || '').replace(/\(.*?\)/g, '').replace(CORP, '').replace(/\s+/g, '').trim(); }
// «고려면옥 아산점→보리촌 바지락» 처럼 이름이 바뀐 표기는 양쪽 모두를 이름으로 본다
function nameForms(c) {
  const forms = String(c.name || '').split('→');
  if (c.sort_key) forms.push(c.sort_key);
  return forms;
}

function pickCompany(mail, companies) {
  const list = Array.isArray(companies) ? companies : [];
  const m = mail || {};
  const fromLower = String(m.from || '').toLowerCase();
  const text = String(m.from || '') + ' ' + String(m.subject || '') + ' ' + String(m.body || '');
  const combinedRaw = rawSqueeze(text);
  const combined = squeeze(text);
  const textHasCorp = CORP_ANY.test(text);

  const byMail = list.filter((c) => c && c.pay_mail && fromLower.indexOf(String(c.pay_mail).toLowerCase()) !== -1);
  if (byMail.length === 1) return byMail[0];
  const pool = byMail.length > 1 ? byMail : list;

  let best = null;
  let bestScore = 0;
  let tie = false;
  for (const c of pool) {
    if (!c) continue;
    let score = 0;
    for (const form of nameForms(c)) {
      const nameHasCorp = CORP_ANY.test(form);
      const full = squeeze(form);
      const head = headOf(form);
      const raw = rawSqueeze(form);
      let sc = 0;
      if (raw.length >= 2 && combinedRaw.indexOf(raw) !== -1 && (!textHasCorp || nameHasCorp)) sc = 2000 + raw.length;     // 회사 형태 표기까지 그대로 맞음
      else if (full.length >= 2 && combined.indexOf(full) !== -1) sc = 1000 + full.length + (textHasCorp && nameHasCorp ? 500 : 0);   // 표기를 떼고 맞음
      else if (head.length >= 2 && combined.indexOf(head) !== -1) sc = head.length;                                          // 지점·표기를 뗀 머리 이름만 맞음
      if (sc > score) score = sc;
    }
    if (score > bestScore) { best = c; bestScore = score; tie = false; }
    else if (score > 0 && score === bestScore) tie = true;
  }
  return tie ? null : best;
}

// 받은 날짜의 «한국시간» 연월(YYYY_MM) — 못 읽으면 지금. 매월 1일 새벽 메일이 전월로 가지 않게 +9시간.
function monthKey(dateValue) {
  const d = dateValue ? new Date(dateValue) : new Date();
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  const kst = new Date(base.getTime() + 9 * 3600 * 1000);
  return kst.getUTCFullYear() + '_' + String(kst.getUTCMonth() + 1).padStart(2, '0');
}

// uid: 문자열이거나 유한한 정수만. null·undefined·boolean·NaN·객체는 «문자열로 바꿔 통과시키지 않고» 거절한다
function validUid(v) {
  if (typeof v === 'string') return KEY_RE.test(v) ? v : '';
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) return KEY_RE.test(String(v)) ? String(v) : '';
  return '';
}

exports.maskEmailServer = maskEmailServer;
exports.maskPiiServer = maskPiiServer;
exports.maskNameServer = maskNameServer;
exports.maskNamesServer = maskNamesServer;
exports.findNamesServer = findNamesServer;
exports.maskFromServer = maskFromServer;
exports.pickCompany = pickCompany;
exports.monthKey = monthKey;
exports.validUid = validUid;

exports.routeIncomingPureunMail = async function(mailItem, companiesMaster) {
  if (!mailItem || typeof mailItem !== 'object') throw new Error('mailItem 이 필요합니다');
  const uid = validUid(mailItem.uid);
  if (!uid) {
    throw new Error('mailItem.uid 형식이 맞지 않습니다(영문·숫자·_- 1~64자의 문자열 또는 0 이상의 정수) — 다른 메일을 덮어쓰지 않도록 거절합니다');
  }
  const master = Array.isArray(companiesMaster) ? companiesMaster.filter((c) => c && typeof c === 'object') : [];
  const attachments = Array.isArray(mailItem.attachments) ? mailItem.attachments.map(String) : [];

  const db = admin.database();
  const rawBody = String(mailItem.body || '');
  const names = findNamesServer(rawBody + '\n' + String(mailItem.subject || ''));
  const maskedBody = maskNamesServer(maskPiiServer(rawBody), names);
  const month = monthKey(mailItem.date);

  const matchedComp = pickCompany(mailItem, master);
  const matchedId = matchedComp && typeof matchedComp.id === 'string' && KEY_RE.test(matchedComp.id) ? matchedComp.id : '';
  const targetId = matchedId || 'unclassified';
  const assignedStaff = matchedId ? (matchedComp.staff || '') : '미지정(확인필요)';

  // 일반 목록·AI 가공용 (자체 마스킹본 저장 — 발신자·제목도 가려서 둔다)
  await db.ref(`payroll_outsourcing/${month}/companies/${targetId}/inbox_masked/${uid}`).set({
    uid: uid,
    from: maskFromServer(mailItem.from),
    subject: maskNamesServer(maskPiiServer(mailItem.subject || ''), names),
    receivedAt: mailItem.date || new Date().toISOString(),
    maskedBody: maskedBody,
    assignedStaff: assignedStaff,
    status: 'review'
  });

  // 권한자 전용 개인정보 원본 금고 (주민등록번호·신분증·통장사본·근태엑셀 원본 분리 보관)
  await db.ref(`payroll_vault_raw/${month}/${targetId}/${uid}`).set({
    uid: uid,
    from: String(mailItem.from || ''),
    subject: String(mailItem.subject || ''),
    rawBody: rawBody,
    attachments: attachments,
    assignedStaff: assignedStaff,
    savedAt: admin.database.ServerValue.TIMESTAMP
  });

  return { targetId, assignedStaff, month };
};
