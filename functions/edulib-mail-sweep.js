"use strict";

/* 🎓 보낸 메일의 강의자료 → 강의자료 앱(/edulib) 자동 저장 + 강의 이력 (대표 지시 2026-11-21 · 2026-11-27)
   ═══════════════════════════════════════════════════════════════════════════════════════════
   2026-11-21 「메일로 보낸 강의 자료나 강의 내용의 경우 자동으로 정리해서 내용 넣을 수 있게 해달라」
   2026-11-27 「사업장에 강의를 하게 되면 메일로 보내는데, 그 메일을 자동으로 정리해서 확인하고, 새로운 강의 자료 같은 경우는
              강의 자료함에 반드시 저장해 달라. … 누가 언제 강의했는지만 간략하게 어떤 강의 내용으로 체크하게 해달라.
              어떤 강의인지 그 관련돼서는 캘린더에서도 찾아도 된다.」
     → 대표 선택: ① «모두 저장, 위험한 것만 뺌» ② 강의 이력은 «추정으로 두고 확인» ③ 지난 캘린더 강의는 «관리자 단추로 가져오기»(화면 몫)

   ■ 하는 일 — 보낸편지함·내게쓴편지함의 강의자료 첨부를
     ① 읽기 전용으로 받아 내용을 검사하고(주민번호 꼴·글자 수·압축 안 파일 이름)
     ② 종류·강의일을 화면과 «같은 규칙»(edulib-core/ — js/ 사본)으로 짐작하고, 문서의 목차·첫 글로 «자동 정리 내용»을 만들어
     ③ 자료함에 «바로 저장»한다 — 원본을 창고 edulib/{id}/{이름} 에 받은 그대로(새로 쓰기만) + 자료 기록(edulib/items, 검토 대기)
        + 내용 지문(edulib/sims, 비슷한 강의 찾기용)
     ④ 캘린더 보관함(data/gcal_archive)에서 «이 자료의 강의» 일정을 찾아 강의 이력(edulib/lectures, 추정)을 만들거나 그 기록에 자료를 잇는다
        (못 찾으면 메일 하나 = 강의 하나로 추정 기록). 강의자는 캘린더 «만든 사람 메일 → 사번» 표(data/gcal_mail_sid)로만 채운다.
     매일 19:30(index.js edulibMailSweep) · 관리자 [지금 정리](runEdulibMailSweep).

   ■ 저장하지 않는 것(«위험한 것만 뺌») — 관리자만 읽는 자동 정리함(edulib_inbox/q)에 «남김(hold)»으로 쌓아 사람이 본다
     · 이름에 명단·참석자·서명·급여·통장 같은 말(classify PII_NAME_RX · SERVER_EXCLUDE_RX) — 받지도 않는다
     · 문서 안에 주민번호 꼴 · 압축(zip) 안 파일 이름이 위와 같은 것
     · 이름에 주민번호·전화·메일 꼴이 있는 첨부는 정리함에도 올리지 않고 «뺌»으로만 센다(그 글자를 다른 자리에 옮기지 않게)
   ■ 내용을 못 읽은 것(옛 ppt·hwp·doc, zip 압축, 글자 없는 스캔 pdf)은 저장하되 «내용 자동 확인 못 함»(auto.check:'none')을 단다.
   ■ 저장하기 «전에» 파일 전체를 한 번 더 훑는다(2026-11-27 보안 검토 «중간» 두 건) —
     · 원본 바이트를 글자(latin1·UTF-16)로 읽어 주민번호 꼴을 찾는다(옛 ppt·doc 의 글, 한글 미리보기 글, 압축 안 된 PDF 글)
     · zip 꼴 문서(pptx·docx·hwpx·odp·zip)는 «모든» XML(슬라이드 노트·머리글·바닥글·각주·표)과 포함 개체(embeddings — 들어 있는 엑셀·워드)까지
     · 안을 볼 수 없는 압축(7z·rar·alz·egg)과 안을 다 풀지 못한 파일은 저장하지 않고 남긴다

   ■ 지키는 것
     1. 메일함은 읽기만 — 읽음 표시·이동·삭제 없음(mail-sync withFolder 는 readOnly).
     2. 우리가 보낸 메일만 — 보는 폴더는 «보낸편지함·내게쓴편지함» 둘뿐.
     3. «가져올지»는 기본 강의 근거(C.lectureSignal)로만 — 직원이 더한 찾을 낱말은 «종류 나누기»에만(관리자 메일함의 문을 넓히지 못하게).
     4. 같은 파일은 다시 넣지 않는다 — 자료함의 지문(sha256)·이름+크기·같은 메일의 같은 첨부. 휴지통에 간 기록도 «있는 것»으로 본다
        (사람이 지운 자료를 되살리지 않는다 — CLAUDE.md 「종료·삭제·되돌림 불변」).
     5. 모든 쓰기는 «빈 자리일 때만» — 창고는 ifGenerationMatch:0, 기록은 transaction(이미 있으면 그만둔다). 자료 열쇠는 «메일·첨부»에서
        정해진다(edu_m+열쇠) — 다시 돌아도 같은 자리라 겹치지 않는다. 사람이 «확인»한 강의 이력은 고치지 않는다.
     6. AI 를 쓰지 않는다 — 내용 정리는 문서 글자를 잘라 담을 뿐이고 밖으로 보내지 않는다. 메일 주소·전화·주민번호는 가린다.
     7. 자동 정리함·상태·본 표시는 «레코드가 아닌» 서버 전용 대기열이다(edulib_inbox — 관리자만 읽고, 화면은 못 쓴다). 지우지 않고 표시만 단다.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */

const crypto = require("crypto");
const zlib = require("zlib");
const C = require("./edulib-core/pu-edulib-classify.js");
const K = require("./edulib-core/pu-edulib-core.js");
const L = require("./edulib-core/pu-edulib-lecture.js");

const ITEMS_ROOT = "edulib/items";
const CATS_ROOT = "edulib/cats";
const SIMS_ROOT = "edulib/sims";
const LECT_ROOT = "edulib/lectures";
const INBOX_ROOT = "edulib_inbox";               /* 관리자만 읽는 자동 정리함(규칙 rules.edulib_inbox — 화면 쓰기 없음) */
const Q_ROOT = INBOX_ROOT + "/q";
const STATE_PATH = INBOX_ROOT + "/state";
const SEEN_ROOT = INBOX_ROOT + "/seen";
const CAL_MAP_PATH = "data/gcal_mail_sid";       /* 캘린더 만든이 메일 → 사번(관리자가 푸른캘린더에서 이어 둔 표) */
/* 서버가 만든 기록의 «만든 사람» — 화면 nameOf 가 «자동(메일자동정리)»로 보인다(사번이 아니다) */
const AUTO_BY = "AI-메일자동정리";
/* 저장 도장 — 화면 관문(PuOntology.VERSION · PuOntologyWrite CONTRACT_VERSION)과 같은 값. 검사가 견준다 */
const ONTOLOGY_SCHEMA = 3;
const CONTRACT_VERSION = 1;
const DEFAULT_DAYS = 14;                        /* 예약 실행 — 다음메일 IMAP 은 폴더당 최근 400통만 열어 준다. 날마다 돌면 14일이면 넉넉하다 */
const MAX_DAYS = 400;
const MAX_FILES_PER_RUN = 25;
const MAX_ATT_BYTES = 20 * 1024 * 1024;         /* 화면 «가져오기»와 같은 한도(mail-sync ATT_MAX) */
const MAX_ZIP_ENTRY_OUT = 4 * 1024 * 1024;
const MAX_ZIP_TOTAL_OUT = 16 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 600;
const SLIDE_TITLES_MAX = 15;
/* 글자를 읽어 내용을 확인할 수 있는 형식 */
const DOC_AUTO = { pptx: 1, ppsx: 1, pdf: 1, docx: 1, hwpx: 1 };
/* 강의자료지만 내용을 읽지 못하는 형식 — 저장하되 «내용 자동 확인 못 함»을 단다 */
const DOC_HUMAN = { ppt: 1, pps: 1, hwp: 1, doc: 1, show: 1, odp: 1, key: 1, zip: 1, '7z': 1, alz: 1, egg: 1, rar: 1 };
const ARCHIVE = { zip: 1, '7z': 1, alz: 1, egg: 1, rar: 1 };
const MIN_TEXT = 40;                            /* 이만큼도 글자가 안 나오면(스캔 pdf 등) 내용을 확인 못 한 것으로 본다 */
/* 안을 볼 수 없는 압축 — 저장하지 않고 남긴다(zip 만 안을 본다) */
const ARCHIVE_OPAQUE = { '7z': 1, alz: 1, egg: 1, rar: 1, show: 1, key: 1 };   /* show·key 는 안의 글을 풀어 볼 수 없는 발표 형식(재검증) */
const ZIP_LIKE = { pptx: 1, ppsx: 1, docx: 1, hwpx: 1, odp: 1, zip: 1 };
/* 강의 말이 있어도 «서류»일 수 있는 이름 — 사람이 고르기 전에 걸러 두는 길이라 화면 «가져오기»보다 넓게 뺀다 */
const SERVER_EXCLUDE_RX = /급여|임금\s?대장|명세서|원천\s?징수|통장|계좌|이력서|주민\s?등록|등본|초본|신분증|가족\s?관계|진단서|건강\s?검진|연봉|인사\s?기록|평가표|성적|합격|채점/;
/* 주민번호(외국인등록번호) 꼴 — 앞 6자리가 «날짜 꼴»이고 뒤 7자리가 1~8로 시작. 사이는 없음·빈칸·여러 대시(‐‑‒–—―−﹣－)·점 모두.
   글자는 먼저 NFKC 로 다듬는다(전각 숫자·전각 대시 → 보통 글자). 막기(test)와 가리기(scrub)가 «같은 꼴»을 쓴다. */
const RRN_SRC = "(?<!\\d)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])[ \\t\\r\\n]{0,3}[-\\u2010-\\u2015\\u2212\\uFE58\\uFE63\\uFF0D.]?[ \\t\\r\\n]{0,3}[1-8]\\d{6}(?!\\d)";
const RRN_RX = new RegExp(RRN_SRC);
const RRN_G = new RegExp(RRN_SRC, "g");
function norm(s) { s = s == null ? "" : String(s); try { return s.normalize("NFKC"); } catch (_) { return s; } }
function hasRrn(s) { return RRN_RX.test(norm(s)); }
const MAIL_RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE_RX = /(?<!\d)0\d{1,2}[-.\s)]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;
const PHONE_TEST = /(?<!\d)0\d{1,2}[-.\s)]?\d{3,4}[-.\s]?\d{4}(?!\d)/;
const MAIL_TEST = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function str(v) { return v == null ? "" : String(v); }
function sha1(s) { return crypto.createHash("sha1").update(String(s)).digest("hex"); }
function pad(n) { return n < 10 ? "0" + n : "" + n; }
/* 서울 날짜(YYYY-MM-DD) — 화면의 ymd 와 같은 «한국 날» */
function ymdSeoul(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms) + 9 * 3600 * 1000);
  if (!isFinite(d.getTime())) return "";
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}

/* 폴더마다 «보나 안 보나» — 보낸편지함·내게쓴편지함만(all). 나머지(받은·스팸·휴지통·임시·사용자 폴더)는 안 본다(no).
   ⚠ 사용자 폴더의 «우리가 보낸 메일»은 색인의 보낸이 글자로만 가릴 수 있어 믿지 않는다 — 사람이 «메일에서 찾기»로 고른다. */
function folderMode(meta) {
  const k = str(meta && meta.kind);
  return (k === "sent" || k === "tome") ? "all" : "no";
}

/* 이름에 개인정보 글자 자체(주민번호·전화·메일 꼴)가 있나 — 이런 이름은 자동 정리함에도 옮기지 않는다 */
function nameHasPiiChars(name) { return hasRrn(name) || PHONE_TEST.test(norm(name)) || MAIL_TEST.test(name); }
/* 이름이 «서류·명단» 같은가 — 저장하지 않고 정리함에 남긴다 */
function nameLooksRisky(name) { return C.PII_NAME_RX.test(name) || SERVER_EXCLUDE_RX.test(name); }

/* 첨부 하나 판정 — { ok, why:'type'|'pii', hold, cat, date, inspect }
   ok:true  → 받아서 저장(inspect:true 면 글자를 읽어 확인한다)
   why:'pii', hold:true → 받지 않고 정리함에 «남김»(사람이 본다) · hold 없음 → 뺌으로만 센다 */
function judgeAttachment(subject, name, sentDate) {
  if (!C.lectureSignal(subject, name)) return { ok: false, why: "type" };    /* 직원이 더한 낱말로는 문을 넓히지 않는다 */
  const c = C.classifyMail(subject, name, sentDate);
  if (!c) return { ok: false, why: "type" };
  const ext = C.extOf(name);
  const saveable = !!(DOC_AUTO[ext] || DOC_HUMAN[ext]);
  if (c.pii || nameLooksRisky(name) || nameHasPiiChars(name)) {
    return { ok: false, why: "pii", hold: saveable && !nameHasPiiChars(name), cat: c.cat, date: c.date };
  }
  if (!saveable) return { ok: false, why: "type" };
  return { ok: true, cat: c.cat, date: c.date, inspect: !!DOC_AUTO[ext] };
}

function seenKeyOf(slug, key, idx, name) { return sha1(slug + "|" + key + "|" + idx + "|" + name).slice(0, 24); }
/* 자료 열쇠 — «메일·첨부»에서 정해진다(다시 돌아도 같은 자리 · 같은 창고 자리) */
function itemIdOf(seenKey) { return "edu_m" + str(seenKey).replace(/[^0-9a-z]/g, "").slice(0, 24); }

/* 메일 색인(mailbox/folders · mailbox/msgs/{slug})에서 후보 첨부를 고른다 — 순수 셈(시험이 직접 부른다) */
function pickCandidates(folders, msgsBySlug, o) {
  const cutoff = Number(o.cutoff || 0);
  const out = [];
  let mails = 0;
  Object.keys(folders || {}).forEach((slug) => {
    const meta = folders[slug] || {};
    const mode = folderMode(meta);
    if (mode === "no") return;
    const msgs = (msgsBySlug && msgsBySlug[slug]) || {};
    Object.keys(msgs).forEach((key) => {
      const m = msgs[key];
      if (!m || typeof m !== "object" || m.o) return;              /* o — POP3 로 채운 지난 메일(IMAP 으로 못 연다) */
      const d = Number(m.d || 0);
      if (!d || d < cutoff) return;
      const uid = str(m.u || key);
      if (!/^\d+$/.test(uid)) return;
      const names = Array.isArray(m.an) ? m.an : [];
      if (!names.length) return;
      mails++;
      const subject = str(m.s);
      names.forEach((nm, idx) => {
        const name = str(nm);
        if (!name) return;
        const j = judgeAttachment(subject, name, ymdSeoul(d));
        out.push({ slug, key, uid, idx, name, subject, d, mailId: slug + "/" + key, folder: str(meta.name || slug),
          ok: j.ok, why: j.why || "", hold: !!j.hold, inspect: !!j.inspect, cat: j.cat || "etc", date: j.date || null, seenKey: seenKeyOf(slug, key, idx, name) });
      });
    });
  });
  out.sort((a, b) => b.d - a.d);
  return { list: out, mails };
}

/* ── 문서 글자 읽기 — pptx·docx·hwpx 는 zip 안 XML, pdf 는 pdfjs(deps.pdfText). 옛 형식(ppt·doc·hwp)은 글자 없이 넣는다 ──
   zipWalk: zip 중앙 목록을 차례로 보며 want 에 맞는 조각을 «하나씩» 풀어 onEntry(이름, 데이터|null, {enc, big})에 넘긴다(모아 쥐지 않는다).
     onEntry 가 "stop" 을 돌려주면 그만. 돌려줌 { bad 목록을 못 찾음(깨짐), truncated 한도·목록 어긋남으로 다 못 봄 }
   zipEntries: zipWalk 로 모아 배열로(요약·지문용 — 작은 한도) · namesOnly — 풀지 않고 이름만(압축 첨부 이름 검사)
   SCAN_LIM — 저장 전 검사(scanPii)는 한도를 넓혀 쓴다(큰 발표자료도 끝까지). 조각 하나는 24MB 까지(넘으면 «다 못 봄») */
const SCAN_LIM = { entries: 4000, total: 64 * 1024 * 1024, entry: 24 * 1024 * 1024 };
function zipWalk(buf, want, onEntry, lim, namesOnly) {
  const st = { bad: false, truncated: false };
  const maxEntries = (lim && lim.entries) || MAX_ZIP_ENTRIES;
  const maxTotal = (lim && lim.total) || MAX_ZIP_TOTAL_OUT;
  const maxEntry = (lim && lim.entry) || MAX_ZIP_ENTRY_OUT;
  if (!Buffer.isBuffer(buf) || buf.length < 22) { st.bad = true; return st; }
  let eocd = -1;
  for (let i = buf.length - 22, lo = Math.max(0, buf.length - 65557); i >= lo; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) { st.bad = true; return st; }         /* zip 꼴인데 목록을 못 찾음(깨짐) */
  const total = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  let used = 0, seen = 0;
  if (total > maxEntries) st.truncated = true;
  for (let n = 0; n < Math.min(total, maxEntries); n++) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) break;
    seen++;
    const flag = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const comp = buf.readUInt32LE(pos + 20);
    const fnLen = buf.readUInt16LE(pos + 28);
    const exLen = buf.readUInt16LE(pos + 30);
    const cmLen = buf.readUInt16LE(pos + 32);
    const lho = buf.readUInt32LE(pos + 42);
    const rawName = buf.subarray(pos + 46, pos + 46 + fnLen);
    const name = (flag & 0x800) ? rawName.toString("utf8") : zipNameOf(rawName, buf.subarray(pos + 46 + fnLen, pos + 46 + fnLen + exLen));
    pos += 46 + fnLen + exLen + cmLen;
    if (!want(name)) continue;
    if (namesOnly) { onEntry(name, null, {}); continue; }
    if (flag & 1) { if (onEntry(name, null, { enc: true }) === "stop") return st; continue; }   /* 암호 걸린 조각 — 풀어 볼 수 없다 */
    let data = null;
    if (lho + 30 <= buf.length && buf.readUInt32LE(lho) === 0x04034b50) {
      const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
      if (start + comp <= buf.length && comp <= maxTotal) {
        try {
          const slice = buf.subarray(start, start + comp);
          data = method === 0 ? Buffer.from(slice) : method === 8 ? zlib.inflateRawSync(slice, { maxOutputLength: maxEntry }) : null;
        } catch (_) { data = null; /* 깨진 조각·너무 큰 조각 */ }
      }
    }
    if (data) { used += data.length; if (used > maxTotal) { st.truncated = true; break; } }
    if (onEntry(name, data, {}) === "stop") return st;
  }
  if (seen < Math.min(total, maxEntries)) st.truncated = true;    /* 목록 자리가 틀렸거나 중간에 어긋났다 — 다 본 것이 아니다 */
  return st;
}
/* UTF-8 표시가 없는 zip 이름 — 윈도 탐색기·알집은 CP949(euc-kr)로 쓴다. 유니코드 경로 덧칸(0x7075)이 있으면 그것을, 없으면 euc-kr 로 푼다.
   (latin1 로 풀면 «명단»·«서명» 같은 이름 잣대가 통째로 빠진다 — 2026-11-27 보안 재검증) */
let EUCKR = null;
function zipNameOf(raw, extra) {
  for (let p = 0; p + 4 <= extra.length;) {
    const id = extra.readUInt16LE(p), sz = extra.readUInt16LE(p + 2);
    if (id === 0x7075 && sz >= 5 && p + 4 + sz <= extra.length) return extra.subarray(p + 9, p + 4 + sz).toString("utf8");
    p += 4 + sz;
  }
  if (!raw.some((b) => b >= 0x80)) return raw.toString("latin1");
  try { EUCKR = EUCKR || new TextDecoder("euc-kr"); return EUCKR.decode(raw); } catch (_) { return raw.toString("latin1"); }
}
function zipEntries(buf, want, namesOnly, lim) {
  const out = [];
  const st = zipWalk(buf, want, (name, data) => { out.push({ name, data }); }, lim, namesOnly);
  if (st.bad) out.bad = true;
  if (st.truncated) out.truncated = true;
  return out;
}
/* 압축 첨부 안 파일 이름 가운데 «서류·명단»·개인정보 글자 꼴이 있나 — 있으면 저장하지 않고 정리함에 남긴다 */
function zipRisk(buf) {
  const names = zipEntries(buf, () => true, true).map((e) => e.name.split("/").pop());
  return names.some((n) => n && (nameLooksRisky(n) || nameHasPiiChars(n)));
}
function xmlText(s) {
  return str(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => { const n = parseInt(h, 16); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; })
    .replace(/&#(\d+);/g, (m, d) => { const n = +d; return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ""; })
    .replace(/&amp;/g, "&");
}
/* XML 한 쪽에서 문단(para)마다 글 조각(run)을 이어 줄로 — 발표(a:p/a:t) · 워드(w:p/w:t) · 한글(hp:p/hp:t) */
function xmlLines(xml, paraTag, runTag) {
  const lines = [];
  const rr = new RegExp("<" + runTag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + runTag + ">", "g");
  /* 닫는 문단 태그로 잘라 조각마다 «마지막 여는 문단 태그»부터 본다 — 정규식이 문서 끝까지 거듭 훑지 않는다(닫힘 없는 여는 태그가 많아도 한 번) */
  const parts = String(xml).split("</" + paraTag + ">");
  for (let i = 0; i < parts.length - 1; i++) {
    const seg = parts[i];
    const start = Math.max(seg.lastIndexOf("<" + paraTag + " "), seg.lastIndexOf("<" + paraTag + ">"));
    if (start < 0) continue;
    const body = seg.slice(start);
    let t = "", r;
    rr.lastIndex = 0;
    while ((r = rr.exec(body))) t += xmlText(r[1].replace(/<[^>]+>/g, ""));
    t = t.replace(/\s+/g, " ").trim();
    if (t) lines.push(t);
  }
  return lines;
}
async function extractContent(name, buf, deps) {
  const ext = C.extOf(name);
  try {
    if (ext === "pptx" || ext === "ppsx") {
      const ents = zipEntries(buf, (n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
      ents.sort((a, b) => +a.name.match(/(\d+)\.xml$/)[1] - +b.name.match(/(\d+)\.xml$/)[1]);
      const slides = ents.filter((e) => e.data).map((e) => xmlLines(e.data.toString("utf8"), "a:p", "a:t"));
      return { slides, text: slides.map((l) => l.join("\n")).join("\n") };
    }
    if (ext === "docx") {
      const e = zipEntries(buf, (n) => n === "word/document.xml")[0];
      const lines = e && e.data ? xmlLines(e.data.toString("utf8"), "w:p", "w:t") : [];
      return { lines, text: lines.join("\n") };
    }
    if (ext === "hwpx") {
      const ents = zipEntries(buf, (n) => /^Contents\/section\d+\.xml$/i.test(n)).slice(0, 25);
      const lines = [];
      ents.forEach((e) => { if (e.data) xmlLines(e.data.toString("utf8"), "hp:p", "hp:t").forEach((l) => lines.push(l)); });
      return { lines, text: lines.join("\n") };
    }
    if (ext === "pdf" && deps && typeof deps.pdfText === "function") {
      const r = await deps.pdfText(buf);
      const text = str(r && r.text);
      return { lines: text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean), text, truncated: !!(r && r.truncated) };
    }
  } catch (_) {
    /* 못 읽었다 — PDF 는 글자 검사를 이 길 하나에 기대므로 «다 못 봄»(남김, 2026-11-27 보안 재검증). 그 밖(zip 꼴)은 저장 전 검사가 이미 XML 을 다 봤다 */
    return { text: "", failed: true };
  }
  return { text: "" };
}
/* ── 저장 전 «한 번 더» — 파일 전체에서 주민번호 꼴 찾기 (2026-11-27 보안 검토 «중간» — 1차·재검증) ──
   ★ 원칙: «못 보면 남긴다»(fail-closed). 볼 수 없는 것(암호·안을 못 푸는 압축·한도 넘음·깨짐)은 'unread' 로 남기고, 그림·소리·글꼴만 건너뛴다.
   rawRrn  — 바이트를 latin1·UTF-16LE(두 정렬)로 읽어 본다(옛 ppt·doc 글, 압축 안 된 PDF 글, 그 밖의 글 파일)
   cfbScan — 옛 오피스·한글(OLE 묶음 파일 CFB): 흐름(stream)을 다시 이어 붙여 하나씩 본다. 한글 본문(Section·DocInfo)은 압축을 풀어서.
             암호(EncryptedPackage·EncryptionInfo·EncryptedSummary·워드 암호 표시)·한글 암호/배포용(ViewText·머리 표시)은 'unread'
   scanPii — zip 꼴이면 조각마다(XML 은 문단·칸 끝을 줄바꿈으로 잇고 태그를 지워서, 안의 zip·CFB 는 한 겹 더), CFB 면 cfbScan, 그 밖은 rawRrn.
   돌려줌: 'rrn' 주민번호 꼴 · 'unread' 다 보지 못함 · '' 못 찾음 */
const MEDIA_RX = /\.(png|jpe?g|jfif|gif|bmp|tiff?|emf|wmf|wdp|ico|heic|webp|mp3|mp4|m4a|m4v|wav|wma|wmv|avi|mov|mpe?g|ogg|webm|mkv|flv|3gp|ttf|otf|fntdata|odttf|woff2?|eot)$/i;
const OPAQUE_RX = /\.(7z|rar|alz|egg|cab|gz|tgz|bz2|xz|show|key)$/i;   /* 안을 볼 수 없는 압축·형식 */
function rawRrn(buf) {
  if (!Buffer.isBuffer(buf) || !buf.length) return false;
  try {
    if (RRN_RX.test(buf.toString("latin1"))) return true;
    if (hasRrn(buf.toString("utf8"))) return true;
    if (hasRrn(buf.toString("utf16le"))) return true;
    if (buf.length > 1 && hasRrn(buf.subarray(1).toString("utf16le"))) return true;
  } catch (_) { /* 못 읽으면 못 찾은 것 */ }
  return false;
}
function isZipBuf(b) { return Buffer.isBuffer(b) && b.length >= 4 && b.readUInt32LE(0) === 0x04034b50; }
function isCfbBuf(b) { return Buffer.isBuffer(b) && b.length >= 512 && b.readUInt32LE(0) === 0xE011CFD0 && b.readUInt32LE(4) === 0xE11AB1A1; }
function xmlPlain(s) { return xmlText(String(s).replace(/<[^>]*\/>/g, "\n").replace(/<\/(a:p|w:p|hp:p|text:p|si|c|row|w:tc|a:tc)>/g, "\n").replace(/<[^>]+>/g, "")); }
/* CFB(복합 문서) 흐름 꺼내기 — 머리(512바이트) · FAT · 목록 · 작은 흐름(mini stream). 못 읽으면 null(깨짐) · 흐름이 모자라면 data null */
function cfbStreams(buf) {
  if (!isCfbBuf(buf)) return null;
  const sec = 1 << buf.readUInt16LE(30), mini = 1 << buf.readUInt16LE(32);
  if ((sec !== 512 && sec !== 4096) || mini !== 64) return null;
  const nFat = buf.readUInt32LE(44), dirStart = buf.readUInt32LE(48), cutoff = buf.readUInt32LE(56);
  const miniFatStart = buf.readUInt32LE(60), nMiniFat = buf.readUInt32LE(64), difStart = buf.readUInt32LE(68);
  const END = 0xFFFFFFFA, per = sec / 4, maxSecs = Math.ceil(buf.length / sec) + 1;
  if (nFat > maxSecs) return null;
  const off = (s) => (s + 1) * sec;
  const fatSecs = [];
  for (let i = 0; i < 109 && fatSecs.length < nFat; i++) fatSecs.push(buf.readUInt32LE(76 + i * 4));
  for (let d = difStart, g = 0; fatSecs.length < nFat && d < END && g <= maxSecs; g++) {
    const o = off(d); if (o + sec > buf.length) return null;
    for (let i = 0; i < per - 1 && fatSecs.length < nFat; i++) fatSecs.push(buf.readUInt32LE(o + i * 4));
    d = buf.readUInt32LE(o + sec - 4);
  }
  if (fatSecs.length < nFat) return null;
  const fat = new Uint32Array(nFat * per);
  for (let k = 0; k < fatSecs.length; k++) {
    const o = off(fatSecs[k]); if (o + sec > buf.length) return null;
    for (let i = 0; i < per; i++) fat[k * per + i] = buf.readUInt32LE(o + i * 4);
  }
  /* 큰 흐름 — FAT 사슬을 따라 이어 붙인다(size<0 이면 사슬 끝까지). 모자라면 null */
  function readBig(start, size) {
    const parts = []; let got = 0;
    for (let s = start, g = 0; s < END && g <= maxSecs && (size < 0 || got < size); g++) {
      const o = off(s); if (o >= buf.length) break;
      const p = buf.subarray(o, Math.min(o + sec, buf.length)); parts.push(p); got += p.length;
      s = s < fat.length ? fat[s] : END;
    }
    const b = Buffer.concat(parts);
    return size < 0 ? b : (b.length >= size ? b.subarray(0, size) : null);
  }
  const dir = readBig(dirStart, -1);
  const ents = [];
  for (let o = 0; o + 128 <= dir.length && ents.length < 20000; o += 128) {
    const type = dir[o + 66];
    if (type !== 1 && type !== 2 && type !== 5) continue;
    const nl = Math.min(64, dir.readUInt16LE(o + 64));
    ents.push({ name: dir.toString("utf16le", o, o + Math.max(0, nl - 2)), type, start: dir.readUInt32LE(o + 116), size: dir.readUInt32LE(o + 120) });
  }
  const root = ents.find((e) => e.type === 5);
  const ministream = root && root.size ? readBig(root.start, root.size) : Buffer.alloc(0);
  const minifatBuf = nMiniFat ? readBig(miniFatStart, nMiniFat * sec) : Buffer.alloc(0);
  const minifat = [];
  if (minifatBuf) for (let i = 0; i + 4 <= minifatBuf.length; i += 4) minifat.push(minifatBuf.readUInt32LE(i));
  function readMini(start, size) {
    if (!ministream) return null;
    const parts = []; let got = 0;
    for (let s = start, g = 0; s < END && g <= minifat.length + 1 && got < size; g++) {
      const o = s * mini; if (o + mini > ministream.length) return null;
      parts.push(ministream.subarray(o, o + mini)); got += mini;
      s = s < minifat.length ? minifat[s] : END;
    }
    const b = Buffer.concat(parts);
    return b.length >= size ? b.subarray(0, size) : null;
  }
  const streams = ents.filter((e) => e.type === 2).map((e) => ({ name: e.name, data: e.size < cutoff ? readMini(e.start, e.size) : readBig(e.start, e.size) }));
  return { streams, names: ents.map((e) => e.name), capped: ents.length >= 20000 };
}
function cfbScan(buf) {
  let cf = null;
  try { cf = cfbStreams(buf); } catch (_) { cf = null; }
  if (!cf) return rawRrn(buf) ? "rrn" : "unread";      /* 묶음을 못 풀었다 — 바이트로만 훑고, 못 찾아도 «다 못 봄» */
  let unread = !cf.streams.length || !!cf.capped;      /* 흐름이 하나도 없거나 목록이 너무 길다 — 다 본 것이 아니다 */
  if (cf.names.some((n) => /^(EncryptedPackage|EncryptionInfo|EncryptedSummary|ViewText)$/.test(n))) unread = true;   /* 암호 오피스·한글 배포용 */
  const fh = cf.streams.find((s) => s.name === "FileHeader");
  let hwpZip = false;
  if (fh && fh.data && fh.data.length >= 40 && fh.data.toString("latin1", 0, 17) === "HWP Document File") {
    const prop = fh.data.readUInt32LE(36);
    hwpZip = !!(prop & 1);
    if (prop & 6) unread = true;                       /* 한글 암호(2)·배포용(4) */
  }
  const wd = cf.streams.find((s) => s.name === "WordDocument");
  if (wd && wd.data && wd.data.length > 12 && (wd.data.readUInt16LE(10) & 0x0100)) unread = true;   /* 워드 암호(fEncrypted) */
  for (const s of cf.streams) {
    if (!s.data) { unread = true; continue; }
    let d = s.data;
    if (hwpZip && s.name !== "FileHeader" && s.name.charCodeAt(0) > 31) {
      try { d = zlib.inflateRawSync(s.data, { maxOutputLength: SCAN_LIM.entry }); }
      catch (_) { if (/^(Section\d+|DocInfo)$/.test(s.name)) { unread = true; continue; } d = s.data; }   /* 본문을 못 풀면 «다 못 봄» */
    }
    if (rawRrn(d)) return "rrn";
  }
  return unread ? "unread" : "";
}
function scanPii(buf, depth) {
  depth = depth || 0;
  if (isCfbBuf(buf)) return depth >= 2 ? (rawRrn(buf) ? "rrn" : "unread") : cfbScan(buf);
  if (!isZipBuf(buf)) return rawRrn(buf) ? "rrn" : "";
  let unread = false, found = false;
  const st = zipWalk(buf, (n) => !/\/$/.test(n) && !MEDIA_RX.test(n), (name, data, info) => {
    const n = name.toLowerCase();
    if (info.enc || !data) { unread = true; return "stop"; }  /* 암호 조각·한도 넘음·깨진 조각 — 어차피 남기므로 더 풀지 않는다 */
    if (OPAQUE_RX.test(n)) { unread = true; return "stop"; }  /* 안을 볼 수 없는 압축·형식(zip 으로 한 번 싸도 마찬가지) */
    let r;
    if (/\.(xml|rels|svg|html?|xhtml)$/.test(n)) { const u = data.toString("utf8"); r = hasRrn(xmlPlain(u)) || hasRrn(u) ? "rrn" : ""; }
    else if (isZipBuf(data)) r = depth >= 1 ? (rawRrn(data) ? "rrn" : "unread") : scanPii(data, depth + 1);
    else r = scanPii(data, depth + 1);                 /* CFB 는 cfbScan, 그 밖은 바이트 훑기 */
    if (r === "rrn") { found = true; return "stop"; }
    if (r === "unread") { unread = true; return "stop"; }
  }, SCAN_LIM);
  if (found) return "rrn";
  if (st.bad) return rawRrn(buf) ? "rrn" : "unread";   /* 깨진 zip — 바이트로만 훑고, 못 찾아도 «다 못 봄» */
  if (st.truncated) unread = true;                     /* 한도·목록 어긋남으로 뒤쪽을 다 못 봤다 */
  return unread ? "unread" : "";
}
function scrub(s) { return norm(s).replace(RRN_G, "[주민번호]").replace(MAIL_RX, "[메일]").replace(PHONE_RX, "[전화]"); }
/* 자동 정리 내용 — 발표자료는 «목차(장마다 첫 줄)», 그 밖은 첫 글. 메일 주소·전화는 가린다. 상한은 화면과 같은 K.SUMMARY_MAX */
function summarize(ex) {
  const max = K.SUMMARY_MAX || 1200;
  let out = "";
  if (ex && Array.isArray(ex.slides) && ex.slides.length) {
    const titles = [];
    ex.slides.forEach((lines) => {
      const t = (lines[0] || "").slice(0, 60);
      if (t && titles.indexOf(t) < 0 && titles.length < SLIDE_TITLES_MAX) titles.push(t);
    });
    out = "목차(" + ex.slides.length + "장): " + titles.join(" · ");
    const body = ex.slides.slice(0, 3).map((l) => l.slice(1).join(" ")).join(" ").replace(/\s+/g, " ").trim();
    if (body) out += " — " + body;
  } else if (ex && Array.isArray(ex.lines) && ex.lines.length) {
    out = ex.lines.join(" ");
  }
  return scrub(out).replace(/\s+/g, " ").trim().slice(0, max);
}
/* 내용 지문에 넣을 줄 — 화면 sigLater 와 같은 재료(슬라이드는 장마다 줄을 이어서) */
function simLines(ex) {
  if (ex && Array.isArray(ex.slides)) { const out = []; ex.slides.forEach((l) => l.forEach((x) => out.push(x))); return out; }
  return ex && Array.isArray(ex.lines) ? ex.lines : [];
}

/* 이미 있는 자료 — 지문·이름+크기·같은 메일의 같은 첨부. 휴지통 기록도 넣는다(되살리지 않게) */
function indexItems(items) {
  const idx = { sha: {}, nameSize: {}, mailFile: {}, ids: {} };
  Object.keys(items || {}).forEach((k) => addIndex(idx, k, items[k]));
  return idx;
}
function addIndex(idx, k, it) {
  if (!it || typeof it !== "object") return;
  idx.ids[k] = 1;
  if (it.sha256) idx.sha[it.sha256] = k;
  if (it.fileName) idx.nameSize[str(it.fileName).toLowerCase() + "|" + (+it.size || 0)] = k;
  const src = it.source || {};
  if (src.mailId && it.fileName) idx.mailFile[src.mailId + "|" + it.fileName] = k;
}

/* 서버가 쓰는 기록의 도장 — 화면 관문(prepareRecord)이 찍는 칸과 같은 칸(schemaVersion·contractVersion·revision·만든이·고친이) */
function stamp(rec) {
  rec.schemaVersion = ONTOLOGY_SCHEMA;
  rec.contractVersion = CONTRACT_VERSION;
  if (!rec.createdBy) rec.createdBy = AUTO_BY;
  rec.updatedBy = AUTO_BY;
  rec.revision = Math.max(1, Number(rec.revision) || 1);
  return rec;
}

/* 자료함 기록 — 화면 «가져오기»(importMailRow)와 같은 칸 + 자동 저장 표시(auto) */
function buildItem(c, got, sha256, summary, check, why, now) {
  const name = str(got.name || c.name);
  const id = itemIdOf(c.seenKey);
  const date = C.dateFromText(name.replace(/\.[^.]+$/, "")) || C.dateFromText(c.subject);
  const catByName = C.catOfText(name);
  const it = K.makeItem({
    id, fileName: name, size: got.buf.length, sha256, cat: catByName !== "etc" ? catByName : c.cat,
    lectureDate: date || ymdSeoul(c.d), dateFrom: date ? "name" : "mail", title: name.replace(/\.[^.]+$/, ""), summary,
    pii: false, status: "review", store: "cloud", storagePath: K.storagePathOf(id, name),
    source: { kind: "mail", mailId: c.mailId, mailSubject: scrub(c.subject).slice(0, 300), mailDate: ymdSeoul(c.d) },
  }, { uid: AUTO_BY }, now);
  /* auto.check — 'text' 글자를 읽어 확인함 · 'none' 내용 자동 확인 못 함(why: old-format·archive·little-text) */
  it.auto = { by: "mail", at: now, check, why: why || "" };
  return stamp(it);
}

/* 자동 정리함 한 줄 — «남김(hold)»: 저장하지 않은 까닭. 관리자가 화면에서 보고 «넣기»를 누르면 화면 «가져오기» 길로 들어간다.
   ⚠ 원본 바이트는 담지 않는다(지문·크기만). 레코드가 아닌 대기열 값이다(id·entityType 없음). */
function queueEntry(c, got, sha256, summary, now, hold) {
  const name = str((got && got.name) || c.name);
  const date = C.dateFromText(name.replace(/\.[^.]+$/, "")) || C.dateFromText(c.subject);
  const catByName = C.catOfText(name);
  const e = {
    key: c.seenKey, slug: c.slug, uid: c.uid, mailKey: c.key, mailId: c.mailId, att: name,
    subject: scrub(c.subject).slice(0, 300), d: c.d, cat: catByName !== "etc" ? catByName : c.cat,
    lectureDate: date || ymdSeoul(c.d), dateFrom: date ? "name" : "mail", summary: summary || "", sha256: sha256 || "",
    size: got && got.buf ? got.buf.length : 0, at: now
  };
  if (hold) e.hold = hold;
  return e;
}

/* ═══ 한 번 돌기 ═══
   deps: { db, download(slug, uid, name, max) → {buf,name,mime}|{gone}|{big}, upload(path, buf, mime) → {created}|{exists},
           calEvents(fromYmd, toYmd) → [일정], pdfText(buf), now(), log() }
   opts: { days, trigger('schedule'|'manual'), by, maxFiles, budgetMs } */
async function runSweep(deps, opts) {
  const o = opts || {};
  const now = typeof deps.now === "function" ? deps.now() : Date.now();
  const days = Math.max(1, Math.min(MAX_DAYS, Number(o.days) || DEFAULT_DAYS));
  const maxFiles = Math.max(1, Math.min(MAX_FILES_PER_RUN, Number(o.maxFiles) || MAX_FILES_PER_RUN));
  const deadline = now + Math.max(10000, Number(o.budgetMs) || 7 * 60 * 1000);
  const clock = typeof deps.now === "function" ? deps.now : Date.now;
  const log = typeof deps.log === "function" ? deps.log : () => {};
  const db = deps.db;
  const skipped = { seen: 0, same: 0, pii: 0, big: 0, gone: 0, type: 0, err: 0 };
  let saved = 0, unchecked = 0, held = 0, lectures = 0, tried = 0, more = false;

  const [fsnap, isnap, csnap, ssnap, qsnap, msnap] = await Promise.all([
    db.ref("mailbox/folders").once("value"), db.ref(ITEMS_ROOT).once("value"),
    db.ref(CATS_ROOT).once("value"), db.ref(SEEN_ROOT).once("value"), db.ref(Q_ROOT).once("value"), db.ref(CAL_MAP_PATH).once("value")]);
  const folders = fsnap.val() || {};
  const cats = csnap.val() || {};
  const mailMap = msnap.val() || {};
  /* 사람이 더한 강의 종류 — 화면과 같은 순서(만든 차례)로 넣어 같은 짐작을 한다 */
  C.setCustom(Object.keys(cats).map((k) => cats[k]).filter((x) => x && x.id && !x._deleted)
    .sort((a, b) => (+a.createdAt || 0) - (+b.createdAt || 0))
    .map((x) => ({ key: x.id, label: x.label, legal: x.legal, law: x.law, words: x.words })));
  const idx = indexItems(isnap.val() || {});
  const seen = ssnap.val() || {};
  const queue = qsnap.val() || {};
  const qSha = {};
  Object.keys(queue).forEach((k) => { const q = queue[k]; if (q && q.sha256 && q.hold) qSha[q.sha256] = k; });
  const cutoff = now - days * 86400000;

  const msgsBySlug = {};
  for (const slug of Object.keys(folders)) {
    if (folderMode(folders[slug]) === "no") continue;
    const ms = await db.ref("mailbox/msgs/" + slug).once("value");
    msgsBySlug[slug] = ms.val() || {};
  }
  const pick = pickCandidates(folders, msgsBySlug, { cutoff });
  const cand = pick.list;
  /* 지난번 «정리만» 하던 때(2026-11-21~26) 자동 정리함에 쌓인 줄 — 남김 표시가 없고 아직 자료함에 없는 것은 이번에 저장한다 */
  const pending = Object.keys(queue).map((k) => queue[k])
    .filter((q) => q && q.key && q.att && q.slug && q.uid && !q.hold && !q.saved && !q.same && !idx.mailFile[q.mailId + "|" + q.att])
    .map((q) => ({ slug: str(q.slug), key: str(q.mailKey), uid: str(q.uid), idx: -1, name: str(q.att), subject: str(q.subject), d: Number(q.d) || 0,
      mailId: str(q.mailId), folder: "", ok: true, why: "", inspect: !!DOC_AUTO[C.extOf(q.att)], cat: q.cat || "etc", date: null,
      seenKey: str(q.key), fromQueue: true, qsha: str(q.sha256) }));

  /* 캘린더 일정 — 저장할 것이 생길 때 «한 번» 읽는다(범위: 후보 메일 날짜 −14일 … +45일) */
  let events = null;
  async function loadEvents() {
    if (events) return events;
    events = [];
    if (typeof deps.calEvents !== "function") return events;
    const ds = [];
    /* 메일 보낸 날로만 범위를 잡는다 — 파일 이름의 옛 날짜(«2019 개정» 같은)로 몇 해치 일정을 읽지 않게 */
    pending.concat(cand.filter((c) => c.ok)).forEach((c) => ds.push(ymdSeoul(c.d)));
    const w = L.windowOf(ds);
    if (!w) return events;
    try { events = (await deps.calEvents(w.from, w.to)) || []; } catch (e) { log("edulibMailSweep 캘린더 못 읽음", String((e && e.message) || e).slice(0, 120)); events = []; }
    return events;
  }

  async function markSeen(c, why, id) {
    seen[c.seenKey] = 1;
    const v = { at: clock(), why };
    /* 같은 파일이면 그 자료 열쇠 — 칸 이름을 «id» 로 하면 서버 저장 감시가 «레코드»로 보고 공통 칸이 없다고 경고한다(2026-11-22 첫 밤 기록).
       «본 것»은 레코드가 아니라 대기열 표시다(edulib_inbox) — item 이라 부른다 */
    if (id) v.item = id;
    await db.ref(SEEN_ROOT + "/" + c.seenKey).set(v);
  }
  /* 정리함 줄에 표시만 단다(지우지 않는다 — 서버 저장 감시는 null 쓰기를 «물리 삭제»로 본다) */
  async function markQueue(c, fields) {
    if (!c.fromQueue) return;
    await db.ref(Q_ROOT + "/" + c.seenKey).update(fields);
  }
  /* 저장하지 않고 정리함에 남긴다 — 빈 자리일 때만 */
  async function hold(c, why, got, sha256) {
    held++;
    if (c.fromQueue) { await markQueue(c, { hold: why, holdAt: clock() }); await markSeen(c, "hold-" + why); return; }
    const q = queueEntry(c, got, sha256, "", clock(), why);
    const tx = await db.ref(Q_ROOT + "/" + c.seenKey).transaction((cur) => (cur ? undefined : q));
    if (tx && tx.committed) { queue[c.seenKey] = q; if (sha256) qSha[sha256] = c.seenKey; }
    await markSeen(c, "hold-" + why);
  }
  /* 강의 이력 — 맞는 캘린더 일정이 있으면 그 강의(lec_c…)에, 없으면 이 메일의 강의(lec_m…)에 자료를 잇는다.
     사람이 확인한 기록·지운 기록은 건드리지 않는다(L.linkItem 이 null). */
  async function linkLecture(it) {
    try {
      const evs = await loadEvents();
      const m = L.matchEvent(evs, L.ctxOfItem(it));
      const who = { uid: AUTO_BY };
      const src = it.source || {};
      const lid = m ? L.idOfCal(m.ev.id) : L.idOfMail(src.mailId);
      const fresh = () => (m
        ? L.fromEvent(m.ev, { mailMap, itemIds: [it.id], cat: it.cat !== "etc" ? it.cat : "", score: m.score, who, now: clock(),
          mail: { id: src.mailId, subject: src.mailSubject, date: src.mailDate } })
        : L.fromMailItem(it, { who, now: clock() }));
      const tx = await db.ref(LECT_ROOT + "/" + lid).transaction((cur) => {
        if (!cur) return stamp(fresh());
        const nx = L.linkItem(cur, it.id, who, clock());
        return nx ? stamp(nx) : undefined;
      });
      return tx && tx.committed ? 1 : 0;
    } catch (e) {
      log("edulibMailSweep 강의 이력 실패", String((e && e.message) || e).slice(0, 160));
      return 0;
    }
  }

  for (const c of pending.concat(cand)) {
    if (!c.fromQueue) {
      if (!c.ok) {
        skipped[c.why === "pii" ? "pii" : "type"]++;
        if (c.hold && !seen[c.seenKey] && !queue[c.seenKey] && !idx.mailFile[c.mailId + "|" + c.name]) await hold(c, "name", null, "");
        continue;
      }
      if (seen[c.seenKey]) { skipped.seen++; continue; }
      if (idx.mailFile[c.mailId + "|" + c.name] || queue[c.seenKey]) { skipped.same++; await markSeen(c, "have"); continue; }
    }
    if (tried >= maxFiles || clock() > deadline) { more = true; break; }
    tried++;
    try {
      const got = await deps.download(c.slug, c.uid, c.name, MAX_ATT_BYTES);
      if (!got || got.gone) { skipped.gone++; await markQueue(c, { hold: "gone", holdAt: clock() }); await markSeen(c, "gone"); continue; }
      if (got.big) { skipped.big++; await markQueue(c, { hold: "big", holdAt: clock() }); await markSeen(c, "big"); continue; }
      const buf = got.buf;
      if (!Buffer.isBuffer(buf) || !buf.length) { skipped.gone++; await markQueue(c, { hold: "gone", holdAt: clock() }); await markSeen(c, "empty"); continue; }
      const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
      const name = str(got.name || c.name);
      /* 실제로 받은 첨부 이름으로 한 번 더 판정한다 — 색인 이름(앞 60자로 찾은 것 등)과 다를 수 있다.
         지난번 정리함 줄(fromQueue)은 이름이 같아도 지금 잣대로 다시 본다(보안 검토 «낮음») */
      if (name !== c.name || c.fromQueue) {
        const j2 = judgeAttachment(c.subject, name, ymdSeoul(c.d));
        if (!j2.ok) {
          skipped[j2.why === "pii" ? "pii" : "type"]++;
          if (j2.hold) await hold(c, "name", got, sha256); else { await markQueue(c, { hold: "name", holdAt: clock() }); await markSeen(c, "name-" + (j2.why || "type")); }
          continue;
        }
      }
      /* 정리함 줄은 «정리할 때의 바로 그 파일»이어야 — 지문이 다르면 남긴다 */
      if (c.fromQueue && c.qsha && c.qsha !== sha256) { await hold(c, "diff", got, sha256); continue; }
      const sameId = idx.sha[sha256] || idx.nameSize[name.toLowerCase() + "|" + buf.length] || qSha[sha256];
      if (sameId) { skipped.same++; await markQueue(c, { same: sameId, savedAt: clock() }); await markSeen(c, "same", sameId); continue; }
      const ext = C.extOf(name);
      /* 안을 볼 수 없는 압축(7z·rar·alz·egg)은 남긴다 */
      if (ARCHIVE_OPAQUE[ext]) { skipped.pii++; await hold(c, "archive", got, sha256); continue; }
      /* zip 꼴이어야 할 문서(pptx·docx·hwpx·zip…)인데 zip 이 아니면(암호 오피스 등) 남긴다 · 암호 PDF 도 남긴다 */
      if (ZIP_LIKE[ext] && !isZipBuf(buf)) { skipped.pii++; await hold(c, "unread", got, sha256); continue; }
      if (ext === "pdf" && /\/Encrypt\b/.test(buf.toString("latin1"))) { skipped.pii++; await hold(c, "unread", got, sha256); continue; }
      /* 압축 — 안의 파일 이름이 명단·서류 같으면 남긴다(풀지 않고 이름만 본다) */
      if (ext === "zip" && zipRisk(buf)) { skipped.pii++; await hold(c, "zip-name", got, sha256); continue; }
      /* 파일 전체 — 노트·머리글·포함 개체·옛 형식 글까지 주민번호 꼴을 찾는다. 안을 다 풀지 못했으면 남긴다 */
      const deep = scanPii(buf);
      if (deep === "rrn") { skipped.pii++; await hold(c, "pii-text", got, sha256); continue; }
      if (deep === "unread") { skipped.pii++; await hold(c, "unread", got, sha256); continue; }
      const ex = DOC_AUTO[ext] ? await extractContent(name, buf, deps) : { text: "" };
      if (ext === "pdf" && (ex.failed || ex.truncated)) { skipped.pii++; await hold(c, "unread", got, sha256); continue; }
      /* 주민번호 꼴이 보이면 저장하지 않고 남긴다(글자가 적어도) */
      if (hasRrn(ex.text)) { skipped.pii++; await hold(c, "pii-text", got, sha256); continue; }
      const textLen = str(ex.text).replace(/\s+/g, "").length;
      const check = DOC_AUTO[ext] && textLen >= MIN_TEXT ? "text" : "none";
      const why = check === "text" ? "" : ARCHIVE[ext] ? "archive" : DOC_AUTO[ext] ? "little-text" : "old-format";
      const it = buildItem(c, got, sha256, check === "text" ? summarize(ex) : "", check, why, clock());
      /* ① 원본 — 창고에 받은 그대로(새로 쓰기만 · 이미 있으면 지난번에 올린 같은 자리) */
      await deps.upload(it.storagePath, buf, str(got.mime) || "application/octet-stream");
      /* ② 자료 기록 — 빈 자리일 때만 */
      const tx = await db.ref(ITEMS_ROOT + "/" + it.id).transaction((cur) => (cur ? undefined : it));
      if (!tx || !tx.committed) { skipped.same++; await markQueue(c, { saved: it.id, savedAt: clock() }); await markSeen(c, "have", it.id); continue; }
      addIndex(idx, it.id, it);
      saved++;
      if (check === "none") unchecked++;
      /* ③ 내용 지문(비슷한 강의) — 글자를 읽은 것만, 빈 자리일 때만 */
      if (check === "text") {
        try {
          const sim = stamp(K.makeSim(it.id, K.simSig(simLines(ex)), AUTO_BY, clock()));
          await db.ref(SIMS_ROOT + "/" + it.id).transaction((cur) => (cur ? undefined : sim));
        } catch (e) { log("edulibMailSweep 지문 실패", String((e && e.message) || e).slice(0, 120)); }
      }
      /* ④ 강의 이력(추정) */
      lectures += await linkLecture(it);
      await markQueue(c, { saved: it.id, savedAt: clock() });
      await markSeen(c, "saved", it.id);
    } catch (e) {
      /* 연결이 끊기는 등 «다시 하면 될 수도 있는» 실패는 seen 에 안 적는다 — 다음 번에 다시 본다 */
      skipped.err++;
      log("edulibMailSweep 첨부 실패", c.folder, String((e && e.message) || e).slice(0, 160));
    }
  }

  const result = { lastRunAt: clock(), trigger: str(o.trigger) || "schedule", by: str(o.by) || "schedule", days,
    mails: pick.mails, candidates: cand.filter((c) => c.ok).length + pending.length, tried, saved, unchecked, held, lectures,
    queued: held, more, skipped, ms: clock() - now };
  await db.ref(STATE_PATH).set(result);
  return result;
}

module.exports = {
  runSweep, pickCandidates, judgeAttachment, folderMode, extractContent, summarize, zipEntries, zipWalk, zipRisk, xmlLines, rawRrn, scanPii, cfbScan, cfbStreams,
  queueEntry, buildItem, indexItems, seenKeyOf, itemIdOf, ymdSeoul, scrub, hasRrn, stamp, simLines,
  INBOX_ROOT, Q_ROOT, STATE_PATH, SEEN_ROOT, ITEMS_ROOT, SIMS_ROOT, LECT_ROOT, CAL_MAP_PATH, AUTO_BY, ONTOLOGY_SCHEMA, CONTRACT_VERSION,
  DEFAULT_DAYS, MAX_DAYS, MAX_FILES_PER_RUN, MAX_ATT_BYTES, MIN_TEXT, DOC_AUTO, DOC_HUMAN
};
