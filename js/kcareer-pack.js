'use strict';
// 푸른노무법인 경력관리 — 제출 꾸러미(공고문 → 번호표 → 점검 → 저장) 판정
// (브라우저 window.KcareerPack / Node module.exports 겸용, DOM·브라우저 API 미사용)
//
// 대표 승인 2026-10-05 목업 ② 「제출 꾸러미 만들기」 — 「1부터하고 2도한다」.
// 2026-10-04 한국기계연구원 신청 때 손으로 한 일을 그대로 옮긴다:
//   공고문 「3. 제출서류」 줄 → 1, 2, 3 … 번호 · 「각 1부(개인별)」는 3-1, 3-2 … 사람마다
//   → 파일 이름 「3-2. 개인정보 수집·이용 동의서_박한별.pdf」 → 묶어서 zip(메일 한도 안).
(function (root) {

  /* ── 공고문에서 「제출서류」 줄 뽑기 ──
     머리: 「3. 제출서류」 「제출 서류」 「구비서류」 「제출서류 목록」
     끝:   다음 큰 머리(「4. 접수」 「Ⅳ.」 「□ 접수」 …) 또는 빈 줄 둘
     줄:   ∘ ○ ◦ · - ① 1) 가. 같은 글머리로 시작하는 줄 */
  var HEAD = /^\s*(?:[0-9IVXⅠ-Ⅹ]+[.)]\s*|[□■◆◇▣]\s*)?(?:제출\s*서류|구비\s*서류|제출\s*서류\s*목록|신청\s*서류)\s*(?:목록|안내)?\s*[:：]?\s*$/;
  var NEXT_HEAD = /^\s*(?:[0-9]+\.\s+\S|[IVXⅠ-Ⅹ]+\.\s*\S|[□■◆◇▣]\s*\S)/;
  var BULLET = /^\s*(?:[∘○◦·•‧ㆍ\-–—*※]|[①-⑳]|\(?\d{1,2}[).]|[가-하][.)])\s*/;

  function cleanLine(s) {
    return String(s == null ? '' : s).replace(BULLET, '').replace(/\s+/g, ' ').trim();
  }

  function extractRequired(text) {
    var lines = String(text == null ? '' : text).split(/\r?\n/);
    var i = -1;
    for (var k = 0; k < lines.length; k++) {
      var t = lines[k].trim();
      if (HEAD.test(t) || /^\s*\d+\.\s*제출\s*서류/.test(t)) { i = k; break; }
    }
    if (i < 0) return [];
    /* 머리가 「3. 제출서류」처럼 번호면, 더 큰 번호(「4. 접수」)가 나올 때 끝이다.
       ⚠ 「4.」 는 글머리(1. 2. …)와 모양이 같다 — 번호를 견주지 않으면 다음 절까지 서류로 읽는다 */
    var hm = lines[i].trim().match(/^(\d+)\./), headNo = hm ? parseInt(hm[1], 10) : 0;
    var out = [], blank = 0;
    for (var j = i + 1; j < lines.length; j++) {
      var raw = lines[j], t2 = raw.trim();
      if (!t2) { if (out.length && ++blank >= 2) break; continue; }
      blank = 0;
      var nm = t2.match(/^(\d+)\.\s/);
      if (nm && headNo && parseInt(nm[1], 10) > headNo) break;
      if (NEXT_HEAD.test(t2) && !BULLET.test(t2)) break;
      if (/^※/.test(t2)) continue;                         // 주의 글 — 서류가 아니다
      var c = cleanLine(t2);
      if (c && c.length <= 120) out.push(c);
    }
    return out;
  }

  /* 「각 1부」 「개인별」 「참여 … 전원」 = 사람마다 한 장 */
  var PER_PERSON = /각\s*\d*\s*부|개인별|전원|1인당|사람마다|각각/;
  function isPerPerson(line) {
    var s = String(line || '');
    if (/사업자등록증|법인\s*등기|등기부|신청서\s*\(|신청서\s*1부|서약서/.test(s) && !/개인별|전원|각\s*1부/.test(s)) return false;
    return PER_PERSON.test(s);
  }

  /* 줄 글 → 짧은 서류 이름 (괄호 안 설명·「1부」·「사본」 정리) */
  function shortTitle(line) {
    var s = String(line || '')
      .replace(/\((?:소정\s*양식|별지[^)]*|붙임[^)]*|법인\s*소속인\s*경우|개인별|참여[^)]*)\)/g, '')
      .replace(/\s*(?:각\s*)?\d+\s*부\s*/g, ' ')
      .replace(/\s*및\s*/g, ' 및 ')
      .replace(/\s+/g, ' ').trim();
    return s.replace(/[\\/:*?"<>|]/g, '·').slice(0, 60).trim();
  }

  /* 「A 1부 및 B 1부」처럼 한 줄에 두 서류 → 2-1, 2-2 로 가른다 */
  function splitAnd(line) {
    var s = String(line || '');
    var m = s.split(/\s*(?:1부)\s*및\s*/);
    if (m.length === 2 && m[1].trim()) return [m[0].trim() + ' 1부', m[1].trim()];
    return [s];
  }

  /* 번호표 짜기 — items: 공고문 줄 · people: 참여자 이름(책임자 먼저)
     ⇒ [{no:'3-2', title, who, line, perPerson}] */
  function buildPlan(items, people) {
    people = (people || []).map(function (p) { return String(p || '').trim(); }).filter(Boolean);
    var plan = [];
    (items || []).forEach(function (line, i) {
      var n = String(i + 1);
      var parts = splitAnd(line);
      var per = isPerPerson(line);
      if (per && people.length > 1) {
        people.forEach(function (p, k) { plan.push({ no: n + '-' + (k + 1), title: shortTitle(line), who: p, line: line, perPerson: true }); });
      } else if (parts.length > 1) {
        parts.forEach(function (pt, k) { plan.push({ no: n + '-' + (k + 1), title: shortTitle(pt), who: '', line: line, perPerson: false }); });
      } else {
        plan.push({ no: n, title: shortTitle(line), who: per && people.length === 1 ? people[0] : '', line: line, perPerson: per });
      }
    });
    return plan;
  }

  /* 파일 이름 — 「3-2. 개인정보 수집·이용 동의서_박한별.pdf」. 한 줄에 파일이 여럿이면 뒤에 (2) (3) */
  function fileName(row, ext, k) {
    var base = row.no + '. ' + row.title + (row.who ? '_' + row.who : '');
    if (k && k > 1) base += ' (' + k + ')';
    return base.replace(/[\\/:*?"<>|]/g, '·') + '.' + String(ext || 'pdf').toLowerCase();
  }

  /* 번호 차례 — 1 < 2 < 2-1 < 2-2 < 10 */
  function noKey(no) {
    return String(no).split('-').map(function (x) { return ('000' + (parseInt(x, 10) || 0)).slice(-3); }).join('-');
  }

  /* 점검 — 줄마다 무엇이 걸리는지. files: [{name, size, ext, pdf:{pages, encrypted, sigFields, formFields, noFontPages}}] */
  var MAIL_LIMIT = 10 * 1024 * 1024;
  function checkRow(row, files) {
    var out = [];
    if (!files || !files.length) { out.push({ level: 'miss', text: '파일 없음' }); return out; }
    files.forEach(function (f) {
      var ext = String(f.ext || '').toLowerCase();
      if (/^hwpx?$/.test(ext)) out.push({ level: 'fix', text: '한글 → PDF로 바꿈' });
      else if (!/^(pdf|jpe?g|png)$/.test(ext)) out.push({ level: 'warn', text: ext + ' 형식 — 그대로 넣음' });
      var p = f.pdf || {};
      if (p.encrypted) out.push({ level: 'warn', text: '암호 걸린 PDF' });
      if (p.sigFields) out.push({ level: 'fix', text: '서명칸 ' + p.sigFields + ' 걷어냄' });
      else if (p.formFields) out.push({ level: 'fix', text: '입력칸 ' + p.formFields + ' 걷어냄' });
      if (p.noFontPages) out.push({ level: 'fix', text: '글꼴 없는 ' + p.noFontPages + '쪽 그림으로' });
      if (p.pages === 0) out.push({ level: 'warn', text: '쪽이 없음' });
    });
    if (!out.length) out.push({ level: 'ok', text: '통과' });
    return out;
  }
  function sizeCheck(total) {
    if (total > MAIL_LIMIT) return { level: 'warn', text: '합계 ' + (total / 1048576).toFixed(1) + 'MB — 메일 일반첨부 10MB 넘음(그림을 줄이거나 나눠 보내기)' };
    return { level: 'ok', text: '합계 ' + (total / 1048576).toFixed(1) + 'MB — 메일 한도 안' };
  }

  /* 저장 자리 — 7. 컨설턴트,위원신청등/2026년/2026 한국기계연구원 고문노무사/접수서류 */
  function caseFolderName(year, title) {
    var y = String(year || '').match(/20\d{2}/); y = y ? y[0] : String(new Date().getFullYear());
    var t = String(title || '').replace(/[\\/:*?"<>|]/g, '·').replace(/^\s*20\d{2}\s*/, '').trim() || '지원';
    return { yearDir: y + '년', caseName: y + ' ' + t };
  }

  var api = {
    extractRequired: extractRequired, isPerPerson: isPerPerson, shortTitle: shortTitle,
    buildPlan: buildPlan, fileName: fileName, noKey: noKey, checkRow: checkRow, sizeCheck: sizeCheck,
    caseFolderName: caseFolderName, MAIL_LIMIT: MAIL_LIMIT
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KcareerPack = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
