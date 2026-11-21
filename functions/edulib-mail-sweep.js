"use strict";

/* 🎓 보낸 메일의 강의자료 → 강의자료 앱(/edulib) 자동 정리 (대표 지시 2026-11-21)
   ═══════════════════════════════════════════════════════════════════════════════════════════
   「또한 메일로 보낸 강의 자료나 강의 내용의 경우 자동으로 정리해서 내용 넣을 수 있게 해달라」

   ■ 하는 일
     보낸편지함·내게쓴편지함에 붙은 강의자료 첨부 가운데 «글자를 읽어 확인할 수 있는 문서»(pptx·ppsx·docx·hwpx·글자 있는 pdf)를
       ① 원본 그대로 창고(pureun-erp-hrphotos · edulib/{id}/{원래 이름})에 복사하고
       ② 종류·강의일을 화면과 «같은 규칙»(edulib-core/pu-edulib-classify.js — js/ 사본)으로 짐작하고
       ③ 문서의 목차·첫 글을 잘라 «자동 정리 내용»(summary)으로 적어
       ④ /edulib/items/{id} 에 «검토 대기» 기록으로 «새로만» 넣는다.
     매일 19:30(index.js edulibMailSweep) · 관리자는 강의자료 앱 «메일에서 찾기»의 [지금 정리](runEdulibMailSweep).

   ■ 지키는 것
     1. 메일함은 읽기만 — 읽음 표시·이동·삭제 없음(mail-sync withFolder 는 readOnly).
     2. 받은 메일(남이 보낸 외부 교육자료)은 넣지 않는다 — 우리가 보낸 것만. 보는 폴더는 «보낸편지함·내게쓴편지함» 둘뿐이다
        (다른 폴더는 색인의 보낸이 글자만으로는 우리 것인지 믿을 수 없어 사람이 «메일에서 찾기»로 고른다).
     3. 재직 직원 모두 보는 자료함이다 — 사람이 보지 않고 넣는 것은 «내용을 읽어 확인한 문서»뿐이다.
        · 옛 형식(ppt·hwp·doc 등)·압축·글자 없는(스캔) pdf 는 내용을 확인할 수 없어 넣지 않고 «사람 확인 필요»로만 센다.
        · 이름에 명단·서명·연락처·급여·통장 같은 말, 이름·제목에 주민번호·전화·메일 꼴이 있으면 넣지 않는다.
        · 문서 안에 주민번호 꼴이 보이면 넣지 않는다. 내용 요약·메일 제목의 메일 주소·전화번호는 가린다.
     3-1. «가져올지»는 기본 강의 근거(강의·교안·교육자료… — C.lectureSignal)로만 정한다. 직원이 더한 찾을 낱말은 «종류 나누기»에만 쓴다
        — 누구나 더하는 낱말이 관리자 메일함에서 가져오는 문을 넓히지 못하게.
     4. 같은 파일은 다시 넣지 않는다 — 지문(sha256)·이름+크기·같은 메일의 같은 첨부. 휴지통에 간 기록도 «있는 것»으로 본다
        (사람이 지운 자료를 되살리지 않는다 — CLAUDE.md 「종료·삭제·되돌림 불변」).
     5. 기록 id 는 «메일·첨부»에서 정해진다(edu_m + 해시) — 다시 돌아도 같은 id·같은 창고 자리. 기록은 빈 자리일 때만 쓴다(transaction).
     6. AI 를 쓰지 않는다 — 내용 정리는 문서 글자를 잘라 담을 뿐이고 밖으로 보내지 않는다.
     7. 관리자 SDK 는 보안규칙을 건너뛴다 — 쓰기 전에 ontology-write-server.reviewRecord 를 통과해야 한다.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */

const crypto = require("crypto");
const zlib = require("zlib");
const C = require("./edulib-core/pu-edulib-classify.js");
const K = require("./edulib-core/pu-edulib-core.js");
const OntologyServerWrite = require("./ontology-write-server");

const ACTOR = "AI-메일자동정리";
const SCHEMA_VERSION = 3;                       /* 화면 관문(PuOntology.VERSION)과 같은 판 — index.js 의 다른 서버 기록과 같다 */
const ITEMS_ROOT = "edulib/items";
const CATS_ROOT = "edulib/cats";
const STATE_PATH = "edulib/sweep/state";
const SEEN_ROOT = "edulib/sweep/seen";
const DEFAULT_DAYS = 14;                        /* 예약 실행 — 다음메일 IMAP 은 폴더당 최근 400통만 열어 준다. 날마다 돌면 14일이면 넉넉하다 */
const MAX_DAYS = 400;
const MAX_FILES_PER_RUN = 25;
const MAX_ATT_BYTES = 20 * 1024 * 1024;         /* 화면 «가져오기»와 같은 한도(mail-sync ATT_MAX) */
const MAX_ZIP_ENTRY_OUT = 4 * 1024 * 1024;
const MAX_ZIP_TOTAL_OUT = 16 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 600;
const SLIDE_TITLES_MAX = 15;
/* 사람이 보지 않고 넣는 형식 — 글자를 읽어 내용을 확인할 수 있는 것만 */
const DOC_AUTO = { pptx: 1, ppsx: 1, pdf: 1, docx: 1, hwpx: 1 };
/* 강의자료일 수 있지만 내용을 확인할 수 없는 형식 — 넣지 않고 «사람 확인 필요»로 센다(관리자가 «메일에서 찾기»로 골라 가져온다) */
const DOC_HUMAN = { ppt: 1, pps: 1, hwp: 1, doc: 1, show: 1, odp: 1, key: 1, zip: 1, '7z': 1, alz: 1, egg: 1, rar: 1 };
const MIN_TEXT = 40;                            /* 이만큼도 글자가 안 나오면(스캔 pdf 등) 내용을 확인 못 한 것으로 본다 */
/* 강의 말이 있어도 «서류»일 수 있는 이름 — 사람 손 없이 넣는 길이라 화면 «가져오기»보다 넓게 뺀다 */
const SERVER_EXCLUDE_RX = /급여|임금\s?대장|명세서|원천\s?징수|통장|계좌|이력서|주민\s?등록|등본|초본|신분증|가족\s?관계|진단서|건강\s?검진|연봉|인사\s?기록|평가표|성적|합격|채점/;
const RRN_RX = /(?<!\d)\d{6}\s*-\s*[1-8]\d{6}(?!\d)/;
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

/* 첨부 하나를 자동으로 넣을 «후보»인가 — 사람 손을 거치지 않으니 화면 «가져오기»보다 좁게 본다 */
function judgeAttachment(subject, name, sentDate) {
  if (!C.lectureSignal(subject, name)) return { ok: false, why: "type" };    /* 직원이 더한 낱말로는 문을 넓히지 않는다 */
  const c = C.classifyMail(subject, name, sentDate);
  if (!c) return { ok: false, why: "type" };
  if (c.pii || SERVER_EXCLUDE_RX.test(name) || RRN_RX.test(name) || PHONE_TEST.test(name) || MAIL_TEST.test(name)) return { ok: false, why: "pii" };
  const ext = C.extOf(name);
  if (DOC_HUMAN[ext]) return { ok: false, why: "human" };
  if (!DOC_AUTO[ext]) return { ok: false, why: "type" };
  return { ok: true, cat: c.cat, date: c.date };
}

function seenKeyOf(slug, key, idx, name) { return sha1(slug + "|" + key + "|" + idx + "|" + name).slice(0, 24); }
function itemIdOf(seenKey) { return "edu_m" + sha1("edulib|" + seenKey).slice(0, 16); }

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
          ok: j.ok, why: j.why || "", cat: j.cat || "etc", date: j.date || null, seenKey: seenKeyOf(slug, key, idx, name) });
      });
    });
  });
  out.sort((a, b) => b.d - a.d);
  return { list: out, mails };
}

/* ── 문서 글자 읽기 — pptx·docx·hwpx 는 zip 안 XML, pdf 는 pdfjs(deps.pdfText). 옛 형식(ppt·doc·hwp)은 글자 없이 넣는다 ── */
function zipEntries(buf, want) {
  const out = [];
  if (!Buffer.isBuffer(buf) || buf.length < 22) return out;
  let eocd = -1;
  for (let i = buf.length - 22, lo = Math.max(0, buf.length - 65557); i >= lo; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return out;
  const total = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  let used = 0;
  for (let n = 0; n < Math.min(total, MAX_ZIP_ENTRIES) && pos + 46 <= buf.length; n++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;
    const flag = buf.readUInt16LE(pos + 8);
    const method = buf.readUInt16LE(pos + 10);
    const comp = buf.readUInt32LE(pos + 20);
    const fnLen = buf.readUInt16LE(pos + 28);
    const exLen = buf.readUInt16LE(pos + 30);
    const cmLen = buf.readUInt16LE(pos + 32);
    const lho = buf.readUInt32LE(pos + 42);
    const rawName = buf.subarray(pos + 46, pos + 46 + fnLen);
    const name = (flag & 0x800) ? rawName.toString("utf8") : rawName.toString("latin1");
    pos += 46 + fnLen + exLen + cmLen;
    if (!want(name)) continue;
    const entry = { name, data: null };
    out.push(entry);
    if (lho + 30 > buf.length || buf.readUInt32LE(lho) !== 0x04034b50) continue;
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    if (start + comp > buf.length || comp > MAX_ZIP_TOTAL_OUT) continue;
    try {
      const slice = buf.subarray(start, start + comp);
      const data = method === 0 ? Buffer.from(slice) : method === 8 ? zlib.inflateRawSync(slice, { maxOutputLength: MAX_ZIP_ENTRY_OUT }) : null;
      if (data) { used += data.length; if (used > MAX_ZIP_TOTAL_OUT) break; entry.data = data; }
    } catch (_) { /* 깨진 조각·너무 큰 조각은 건너뛴다 */ }
  }
  return out;
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
  const pr = new RegExp("<" + paraTag + "[\\s>][\\s\\S]*?</" + paraTag + ">", "g");
  const rr = new RegExp("<" + runTag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + runTag + ">", "g");
  let m;
  while ((m = pr.exec(xml))) {
    let t = "", r;
    rr.lastIndex = 0;
    while ((r = rr.exec(m[0]))) t += xmlText(r[1].replace(/<[^>]+>/g, ""));
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
      return { lines: text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean), text };
    }
  } catch (_) { /* 못 읽으면 글자 없이 넣는다 — 원본은 그대로 있다 */ }
  return { text: "" };
}
function scrub(s) { return str(s).replace(MAIL_RX, "[메일]").replace(PHONE_RX, "[전화]"); }
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

/* 이미 있는 자료 — 지문·이름+크기·같은 메일의 같은 첨부. 휴지통 기록도 넣는다(되살리지 않게) */
function indexItems(items) {
  const idx = { sha: {}, nameSize: {}, mailFile: {}, ids: {} };
  Object.keys(items || {}).forEach((k) => {
    const it = items[k];
    if (!it || typeof it !== "object") return;
    idx.ids[k] = 1;
    if (it.sha256) idx.sha[it.sha256] = k;
    if (it.fileName) idx.nameSize[str(it.fileName).toLowerCase() + "|" + (+it.size || 0)] = k;
    const src = it.source || {};
    if (src.mailId && it.fileName) idx.mailFile[src.mailId + "|" + it.fileName] = k;
  });
  return idx;
}

/* 서버가 찍는 기록 — 화면 관문(PuOntologyWrite.prepareRecord)과 같은 도장을 스스로 찍는다(검사가 «같은 결과인가»를 견준다) */
function buildRecord(c, got, sha256, summary, now) {
  const id = itemIdOf(c.seenKey);
  const name = str(got.name || c.name);
  const date = C.dateFromText(name.replace(/\.[^.]+$/, "")) || C.dateFromText(c.subject);
  const catByName = C.catOfText(name);
  const it = K.makeItem({
    id, fileName: name, size: got.buf.length, sha256, cat: catByName !== "etc" ? catByName : c.cat,
    lectureDate: date || ymdSeoul(c.d), dateFrom: date ? "name" : "mail", title: name.replace(/\.[^.]+$/, ""),
    pii: false, status: "review", store: "cloud", storagePath: K.storagePathOf(id, name), summary,
    source: { kind: "mail", mailId: c.mailId, mailSubject: scrub(c.subject).slice(0, 300), mailDate: ymdSeoul(c.d) }
  }, { uid: ACTOR }, now);
  return Object.assign(it, { schemaVersion: SCHEMA_VERSION, contractVersion: OntologyServerWrite.CONTRACT_VERSION,
    createdBy: ACTOR, updatedBy: ACTOR, revision: 1 });
}

/* ═══ 한 번 돌기 ═══
   deps: { db, download(slug, uid, name, max) → {buf,name,mime}|{gone}|{big}, saveFile(path, buf, meta) → {existed},
           pdfText(buf), now(), log() }
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
  const skipped = { seen: 0, same: 0, pii: 0, big: 0, gone: 0, type: 0, human: 0, err: 0 };
  const recent = [];
  let added = 0, tried = 0, more = false;

  const [fsnap, isnap, csnap, ssnap] = await Promise.all([
    db.ref("mailbox/folders").once("value"), db.ref(ITEMS_ROOT).once("value"),
    db.ref(CATS_ROOT).once("value"), db.ref(SEEN_ROOT).once("value")]);
  const folders = fsnap.val() || {};
  const cats = csnap.val() || {};
  /* 사람이 더한 강의 종류 — 화면과 같은 순서(만든 차례)로 넣어 같은 짐작을 한다 */
  C.setCustom(Object.keys(cats).map((k) => cats[k]).filter((x) => x && x.id && !x._deleted)
    .sort((a, b) => (+a.createdAt || 0) - (+b.createdAt || 0))
    .map((x) => ({ key: x.id, label: x.label, legal: x.legal, law: x.law, words: x.words })));
  const idx = indexItems(isnap.val() || {});
  const seen = ssnap.val() || {};
  const cutoff = now - days * 86400000;

  const msgsBySlug = {};
  for (const slug of Object.keys(folders)) {
    if (folderMode(folders[slug]) === "no") continue;
    const ms = await db.ref("mailbox/msgs/" + slug).once("value");
    msgsBySlug[slug] = ms.val() || {};
  }
  const pick = pickCandidates(folders, msgsBySlug, { cutoff });
  const cand = pick.list;

  async function markSeen(c, why, id) {
    seen[c.seenKey] = 1;
    const v = { at: clock(), why };
    if (id) v.id = id;
    await db.ref(SEEN_ROOT + "/" + c.seenKey).set(v);
  }

  for (const c of cand) {
    if (!c.ok) { skipped[c.why === "pii" ? "pii" : c.why === "human" ? "human" : "type"]++; continue; }
    if (seen[c.seenKey]) { skipped.seen++; continue; }
    if (idx.mailFile[c.mailId + "|" + c.name] || idx.ids[itemIdOf(c.seenKey)]) { skipped.same++; await markSeen(c, "have"); continue; }
    if (tried >= maxFiles || clock() > deadline) { more = true; break; }
    tried++;
    try {
      const got = await deps.download(c.slug, c.uid, c.name, MAX_ATT_BYTES);
      if (!got || got.gone) { skipped.gone++; await markSeen(c, "gone"); continue; }
      if (got.big) { skipped.big++; await markSeen(c, "big"); continue; }
      const buf = got.buf;
      if (!Buffer.isBuffer(buf) || !buf.length) { skipped.gone++; await markSeen(c, "empty"); continue; }
      const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
      const name = str(got.name || c.name);
      const sameId = idx.sha[sha256] || idx.nameSize[name.toLowerCase() + "|" + buf.length];
      if (sameId) { skipped.same++; await markSeen(c, "same", sameId); continue; }
      const ex = await extractContent(name, buf, deps);
      /* 주민번호 꼴이 보이면 먼저 뺀다(글자가 적어도) · 내용을 읽어 확인하지 못했으면(깨짐·스캔·한도 넘음) 넣지 않는다 — 사람이 «메일에서 찾기»로 고른다 */
      if (RRN_RX.test(str(ex.text))) { skipped.pii++; await markSeen(c, "pii-text"); continue; }
      if (str(ex.text).replace(/\s+/g, "").length < MIN_TEXT) { skipped.human++; await markSeen(c, "human"); continue; }
      const rec = buildRecord(c, got, sha256, summarize(ex), clock());
      const review = OntologyServerWrite.reviewRecord(rec);
      if (!review.ok) { skipped.err++; log("edulibMailSweep 기록 모양", JSON.stringify(review.issues)); continue; }
      await deps.saveFile(rec.storagePath, buf, { contentType: got.mime || "application/octet-stream", name });
      const tx = await db.ref(ITEMS_ROOT + "/" + rec.id).transaction((cur) => (cur ? undefined : rec));
      if (!tx || !tx.committed) { skipped.same++; await markSeen(c, "have", rec.id); continue; }
      idx.sha[sha256] = rec.id; idx.nameSize[name.toLowerCase() + "|" + buf.length] = rec.id; idx.ids[rec.id] = 1;
      idx.mailFile[c.mailId + "|" + name] = rec.id;
      added++;
      recent.push({ id: rec.id, at: clock() });
      await markSeen(c, "added", rec.id);
    } catch (e) {
      /* 연결이 끊기는 등 «다시 하면 될 수도 있는» 실패는 seen 에 안 적는다 — 다음 번에 다시 본다 */
      skipped.err++;
      log("edulibMailSweep 첨부 실패", c.folder, String((e && e.message) || e).slice(0, 160));
    }
  }

  const prev = (await db.ref(STATE_PATH).once("value")).val() || {};
  const keepRecent = recent.concat(Array.isArray(prev.recent) ? prev.recent : []).slice(0, 20);
  const result = { lastRunAt: clock(), trigger: str(o.trigger) || "schedule", by: str(o.by) || "schedule", days,
    mails: pick.mails, candidates: cand.filter((c) => c.ok).length, tried, added, more, skipped, recent: keepRecent,
    ms: clock() - now };
  await db.ref(STATE_PATH).set(result);
  return result;
}

module.exports = {
  runSweep, pickCandidates, judgeAttachment, folderMode, extractContent, summarize, zipEntries, xmlLines,
  buildRecord, indexItems, seenKeyOf, itemIdOf, ymdSeoul,
  ACTOR, SCHEMA_VERSION, STATE_PATH, SEEN_ROOT, ITEMS_ROOT, DEFAULT_DAYS, MAX_DAYS, MAX_FILES_PER_RUN, MAX_ATT_BYTES, MIN_TEXT, DOC_AUTO, DOC_HUMAN
};
