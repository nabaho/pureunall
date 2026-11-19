/* ═══════════════════════════════════════════════════════════════════════
   법정교육자료함 — 강의 종류·날짜 «추정» 규칙 (대표 지시 2026-11-19)

   「내컴퓨터 및 푸른메일함 전체 찾아서 강의 종류별로 대시보드 만들고
     강의종류 및 날짜별로 정리해줘 … 가급적 원본을 유지해라」

   ★ 이 파일은 «이름과 폴더만 보고» 종류·날짜를 짐작한다. 파일 내용은 읽지 않는다.
   ★ 짐작한 값은 늘 «추정»이다 — 날짜를 찾지 못하면 null 을 돌려주고 지어내지 않는다
     (파일 수정일은 강의일이 아니다. 화면에는 따로 «파일 수정일»로만 보여 준다).
   ★ 같은 규칙을 두 곳이 쓴다 — 내 PC 훑기 스크립트(scripts/edulib-catalog.js, node)와
     자료함 화면(pu-edulib.html, 새 자료 올릴 때 칸 미리 채우기). 그래서 브라우저·node 겸용이다.
   ═══════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.PuEduLibClassify = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* 강의 종류 — 앞에 있는 것이 먼저 잡힌다. legal 은 «법정 의무교육» 여부(근거 조문은 화면 안내용).
     ⚠ 근거 조문은 2026-11-19 기준 안내 문구다. 판단 근거로 쓰기 전에 현행 원문을 다시 확인한다. */
  var CATS = [
    { key: 'sexual',     label: '직장 내 성희롱 예방',    legal: true,  law: '남녀고용평등법 제13조',
      rx: /성희롱|성폭력|성평등|성인지|sexual/i },
    { key: 'disability', label: '장애인 인식개선',        legal: true,  law: '장애인고용촉진법 제5조의2',
      rx: /장애인|장애\s?인식|인식\s?개선/i },
    { key: 'privacy',    label: '개인정보 보호',          legal: true,  law: '개인정보 보호법 제28조',
      rx: /개인정보|정보보호|privacy/i },
    { key: 'safety',     label: '산업안전보건',           legal: true,  law: '산업안전보건법 제29조',
      rx: /산업안전|안전보건|중대재해|산안법|안전교육|위험성\s?평가|msds|보건교육/i },
    { key: 'pension',    label: '퇴직연금',               legal: true,  law: '근로자퇴직급여 보장법 제32조',
      rx: /퇴직연금|퇴직급여\s?제도|\birp\b/i },
    { key: 'bullying',   label: '직장 내 괴롭힘 예방',    legal: false, law: '근로기준법 제76조의2',
      rx: /괴롭힘|직괴|갑질|bullying/i },
    { key: 'youth',      label: '청소년 노동인권',        legal: false, law: '',
      rx: /청소년|직업계고|특성화고|현장실습|노동인권/i },
    { key: 'equality',   label: '차별시정·고용평등',      legal: false, law: '',
      rx: /차별|모성|육아휴직|출산|고용평등|남녀|일[·.]?가정/i },
    { key: 'labor_rel',  label: '노사관계·단체협약',      legal: false, law: '',
      rx: /교섭|단체협약|단협|노사협의|노동조합|노조|부당노동|임단협|노사관계/i },
    { key: 'hours',      label: '근로시간·휴가·일터혁신', legal: false, law: '',
      rx: /근로시간|주\s?52|유연근무|일터\s?혁신|탄력|선택근로|연차|휴가|휴일/i },
    { key: 'wage',       label: '임금·최저임금·퇴직금',   legal: false, law: '',
      rx: /최저임금|통상임금|임금체계|임금피크|퇴직금|포괄임금|평균임금|직무급|성과급|임금/i },
    { key: 'ai',         label: 'AI 활용',                legal: false, law: '',
      rx: /(^|[^a-z])ai([^a-z]|$)|인공지능|챗gpt|chatgpt|생성형|gpt|클로드|claude|gemini|제미나이/i },
    { key: 'esop',       label: '우리사주·근로복지기금',  legal: false, law: '',
      rx: /우리사주|근로복지기금|사내근로복지|공동근로복지|복지기금/i },
    { key: 'labor_law',  label: '노동법·인사노무 실무',   legal: false, law: '',
      rx: /노동법|근로기준|인사노무|노무관리|노무실무|취업규칙|근로계약|해고|징계|인사관리|노무/i },
    { key: 'etc',        label: '기타 강의',              legal: false, law: '', rx: null }
  ];
  var BY_KEY = {};
  CATS.forEach(function (c) { BY_KEY[c.key] = c; });

  function catByKey(k) { return BY_KEY[k] || BY_KEY.etc; }

  function catOfText(s) {
    s = String(s || '');
    for (var i = 0; i < CATS.length; i++) {
      if (CATS[i].rx && CATS[i].rx.test(s)) return CATS[i];
    }
    return BY_KEY.etc;
  }

  /* 경로 조각 하나가 «강의 폴더»인가 — 강의자료 묶음으로 볼 근거 */
  var LECTURE_DIR_RX = /강의|강좌|교안|교육자료|특강|리플렛|리플릿|보수교육|예방교육|인식개선교육|보호교육|보건교육|시정교육|법정\s?의무\s?교육|노동법\s?교육|노동인권교육/;
  /* 강의가 아닌 묶음 — 회의자료·신청서·증명서·돈 자료는 자료함에 넣지 않는다 */
  var EXCLUDE_DIR_RX = /회의자료|회의록|신청서|위원\s?신청|컨설턴트|자문사관리|이수증|수료증|증명서|입금|지원금|환급|계약서|급여|임금대장|명세서|정산|견적/;
  /* 파일 이름만으로도 강의자료인 것 */
  var LECTURE_NAME_RX = /강의|강좌|교안|특강|교육자료|예방교육|인식개선교육|보호교육|보건교육|강의안|강연|ox\s?quiz|퀴즈/i;
  var EXCLUDE_NAME_RX = /이수증|수료증|증명서|신청서|견적|계약서|세금계산서|영수증|입금|정산|강사료|강사\s?확인/;
  /* 사람 이름·서명·연락처가 들어 있을 수 있는 것 — 목록엔 넣되 «원본 올리기»는 기본으로 고르지 않는다 */
  var PII_NAME_RX = /명단|서명|참석자|출석|교육일지|이수자|수강생|연락처|주민|신상|교육\s?확인서|참석\s?확인/;

  var DOC_EXT = { ppt: 1, pptx: 1, pps: 1, ppsx: 1, pdf: 1, hwp: 1, hwpx: 1, doc: 1, docx: 1, show: 1, odp: 1, key: 1, xls: 1, xlsx: 1, cell: 1, txt: 1 };
  var VIDEO_EXT = { mp4: 1, wmv: 1, avi: 1, mov: 1, mkv: 1, m4v: 1 };
  var AUDIO_EXT = { mp3: 1, m4a: 1, wav: 1 };
  var IMAGE_EXT = { jpg: 1, jpeg: 1, png: 1, gif: 1, webp: 1 };
  var ARCHIVE_EXT = { zip: 1, '7z': 1, alz: 1, egg: 1, rar: 1 };

  function extOf(name) {
    var s = String(name || ''); var i = s.lastIndexOf('.');
    return i > 0 ? s.slice(i + 1).toLowerCase() : '';
  }
  function kindOf(ext) {
    if (DOC_EXT[ext]) return 'doc';
    if (VIDEO_EXT[ext]) return 'video';
    if (AUDIO_EXT[ext]) return 'audio';
    if (IMAGE_EXT[ext]) return 'image';
    if (ARCHIVE_EXT[ext]) return 'archive';
    return 'other';
  }

  function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
  function okYmd(y, m, d) {
    return y >= 1995 && y <= 2027 && m >= 1 && m <= 12 && (!d || (d >= 1 && d <= 31));
  }

  /* 글자에서 날짜 찾기 — 찾은 만큼만(YYYY-MM-DD / YYYY-MM / YYYY). 못 찾으면 null */
  function dateFromText(s) {
    s = String(s || '');
    var m;
    m = s.match(/(20\d{2}|19\d{2})\s*[.\-_년\/ ]\s*(\d{1,2})\s*[.\-_월\/ ]\s*(\d{1,2})(?!\d)/);
    if (m && okYmd(+m[1], +m[2], +m[3])) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
    m = s.match(/(?:^|[^\d])(20\d{2})(\d{2})(\d{2})(?!\d)/);
    if (m && okYmd(+m[1], +m[2], +m[3])) return m[1] + '-' + m[2] + '-' + m[3];
    m = s.match(/(?:^|[^\d])(\d{2})[.](\d{1,2})[.](\d{1,2})(?!\d)/);
    if (m && okYmd(2000 + +m[1], +m[2], +m[3])) return (2000 + +m[1]) + '-' + pad(m[2]) + '-' + pad(m[3]);
    m = s.match(/(?:^|[^\d])([12]\d)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?!\d)/);
    if (m && okYmd(2000 + +m[1], +m[2], +m[3])) return (2000 + +m[1]) + '-' + m[2] + '-' + m[3];
    m = s.match(/(20\d{2})\s*[.\-_년]\s*(\d{1,2})\s*월?(?!\d)/);
    if (m && okYmd(+m[1], +m[2])) return m[1] + '-' + pad(m[2]);
    m = s.match(/(?:^|[^\d])(20\d{2}|19\d{2})(?!\d)/);
    if (m && okYmd(+m[1], 1)) return m[1];
    m = s.match(/(?:^|[^\d])(1\d|2[0-7])\s*년/);
    if (m) return String(2000 + +m[1]);
    return null;
  }

  function splitPath(p) {
    return String(p || '').split(/[\\/]+/).filter(function (x) { return x !== ''; });
  }

  /* 경로 하나를 판정한다.
     돌려주는 것: { tier:'A'|'B'|null, cat, catFrom, date, dateFrom, kind, ext, pii, why }
     - tier A: 강의 폴더 안(그 폴더가 «강의 묶음»)
     - tier B: 강의 폴더 밖이지만 파일 이름이 강의자료
     - null : 강의자료로 보지 않음(why 에 까닭) */
  function classifyPath(fullPath) {
    var segs = splitPath(fullPath);
    var name = segs.length ? segs[segs.length - 1] : '';
    var dirs = segs.slice(0, -1);
    var ext = extOf(name);
    var kind = kindOf(ext);
    var out = { tier: null, cat: 'etc', catFrom: null, date: null, dateFrom: null, kind: kind, ext: ext, pii: PII_NAME_RX.test(name), why: '' };

    if (/^~\$/.test(name)) { out.why = '오피스 임시파일'; return out; }
    var exDir = null;
    for (var i = 0; i < dirs.length; i++) { if (EXCLUDE_DIR_RX.test(dirs[i])) { exDir = dirs[i]; break; } }
    var inLectureDir = dirs.some(function (d) { return LECTURE_DIR_RX.test(d); });
    var nameLecture = LECTURE_NAME_RX.test(name);

    if (EXCLUDE_NAME_RX.test(name)) { out.why = '서류(증명·신청·정산)'; return out; }
    if (exDir) { out.why = '강의 아닌 폴더: ' + exDir; return out; }
    if (inLectureDir) out.tier = 'A';
    else if (nameLecture) out.tier = 'B';
    else { out.why = '강의 근거 없음'; return out; }

    /* 종류: 가장 깊은 폴더부터 올라가며 처음 잡히는 것 → 없으면 파일 이름 */
    var c = null;
    for (var j = dirs.length - 1; j >= 0; j--) {
      var cj = catOfText(dirs[j]);
      if (cj.key !== 'etc') { c = cj; out.catFrom = 'folder'; break; }
    }
    var cn = catOfText(name);
    if (!c && cn.key !== 'etc') { c = cn; out.catFrom = 'name'; }
    out.cat = (c || BY_KEY.etc).key;

    /* 날짜: 파일 이름 → 가장 깊은 폴더부터 */
    var d = dateFromText(name.replace(/\.[^.]+$/, ''));
    if (d) { out.date = d; out.dateFrom = 'name'; }
    else {
      for (var k = dirs.length - 1; k >= 0; k--) {
        var dk = dateFromText(dirs[k]);
        if (dk) { out.date = dk; out.dateFrom = 'folder'; break; }
      }
    }
    return out;
  }

  /* 메일 한 통(제목·첨부 이름)을 판정 — 첨부가 강의자료로 보이면 종류·날짜를 짐작 */
  function classifyMail(subject, attachName, sentDate) {
    var s = String(subject || '');
    var a = String(attachName || '');
    var lect = LECTURE_NAME_RX.test(s) || LECTURE_NAME_RX.test(a) || /교육/.test(s);
    if (!lect) return null;
    if (EXCLUDE_NAME_RX.test(a) || (a && kindOf(extOf(a)) === 'other')) return null;
    var c = catOfText(a); if (c.key === 'etc') c = catOfText(s);
    var d = dateFromText(a.replace(/\.[^.]+$/, '')) || dateFromText(s);
    return { cat: c.key, date: d || null, dateFrom: d ? 'name' : null, pii: PII_NAME_RX.test(a) };
  }

  return {
    CATS: CATS.map(function (c) { return { key: c.key, label: c.label, legal: c.legal, law: c.law }; }),
    catByKey: function (k) { var c = catByKey(k); return { key: c.key, label: c.label, legal: c.legal, law: c.law }; },
    catOfText: function (s) { return catOfText(s).key; },
    dateFromText: dateFromText,
    classifyPath: classifyPath,
    classifyMail: classifyMail,
    extOf: extOf,
    kindOf: kindOf
  };
});
