/* 취업규칙 「🤖 매일 정리」 서버 일 (설계 §14 · 2026-10-31 대표 「추천대로」)
   collectRulesMail 회차 끝에 돈다(index.js rulesCollectOnce). 셈은 rules-daily-core — 화면 js/rules-v2/lib-daily.js 의 «글자 그대로» 사본이다.
     ① 처리 담당 — 서류마다 메일함과 «같은 잣대»(mail-owner whoAll)로 docs/{id}/owner 를 적는다. 바뀐 것만 쓴다.
     ② 자동 확정 — 스위치(auto/cfg)가 live 일 때만 사람 칸(human/{id})에 linkedBy:'자동' 으로 적는다. 정하지 않았으면 시범(dry) — «했을 것»만 기록.
     ③ 하루 기록 — auto/last · auto/log/{날짜}.
   ⚠ 던지지 않는다 — 매일 정리가 넘어져도 모으기는 멀쩡해야 한다(부르는 쪽도 한 번 더 감싼다).
   ⚠ 기록 먼저(last), 사람 칸 나중. 사람 칸은 트랜잭션 — 셈한 뒤 그 사이 사람이 손댔으면 쓰지 않는다.
   ⚠ 기록에 메일 주소·제목·본문을 담지 않는다(서류 id·업체 id·수·담당 이름만). 서버 로그도 같다. */
'use strict';
const D = require('./rules-daily-core/lib-daily.js');
const TD = require('./rules-daily-core/lib-tidy.js');
const MR = require('./mail-receive');
const MO = require('./mail-owner');

const LIB = 'rules_mgmt/library';
const AUTO = LIB + '/auto';
const CHUNK = 200;        // 한 번에 쓰는 줄 수 — 2026-08-16 오류 5,000건이 «한 장씩» 쓴 값이었다
const ITEMS_MAX = 200;    // 기록에 남기는 서류 줄 수

async function val(db, p) { const s = await db.ref(p).once('value'); return s.val(); }
/* 사번 꼴 맞추기 — 화면(rules-v2 sidOf)과 같다: 「p001」·「P001」 → 「P-001」 */
function sidKey(x) { return String(x || '').trim().toUpperCase().replace(/^([A-Z])-?(\d+)$/, '$1-$2'); }

/* 트랜잭션 안에서 다시 본다 — 셈한 뒤 그 사이 누가 정했거나(사람·자동 이름), 확정·「사업장 없음」이 됐거나, 되돌림 표시가 있으면 안 쓴다 */
function canWrite(cur) {
  if (!cur) return true;
  if (cur._deleted || cur.noAuto || cur.linkedBy) return false;
  const st = cur.companyLinkStatus;
  return !(st === 'linked' || st === 'not_required');
}
/* 사람 칸과 «같은 모양» — 화면 관문(gateway.save)이 적는 칸(id·entityType·revision·…)을 그대로 갖춘다 */
function humanRecord(prev, docId, link, at, cv) {
  const p = prev || {};
  return Object.assign({}, p, {
    id: docId, entityType: 'RulesDocument', schemaVersion: Number(p.schemaVersion) || 1, contractVersion: cv,
    createdAt: p.createdAt || at, updatedAt: at, revision: Number(p.revision || 0) + 1,
    createdBy: p.createdBy || D.AUTO_BY, updatedBy: D.AUTO_BY,
    companyId: String(link.companyId), companyLinkStatus: 'linked', linkedBy: D.AUTO_BY, linkedAt: at,
    auto: { why: String(link.why || ''), at: at },
  });
}

async function writeChunks(db, up) {
  const keys = Object.keys(up);
  for (let i = 0; i < keys.length; i += CHUNK) {
    const part = {};
    keys.slice(i, i + CHUNK).forEach((k) => { part[k] = up[k]; });
    await db.ref().update(part);
  }
}

/* o = { db, now, contractVersion, readCompanies?, tables?(가짜 표 — 검사용), max?, log? } */
async function runOnce(o) {
  const db = o.db, now = o.now || Date.now, at = now(), cv = o.contractVersion;
  const out = { mode: 'dry', owners: 0, plan: 0, applied: 0, would: 0, error: '' };
  try {
    const mode = D.modeOf(await val(db, AUTO + '/cfg'));
    out.mode = mode;
    if (mode === 'off') { await db.ref(AUTO + '/last').set({ at: at, mode: mode }); return out; }

    const [docs0, human0, cosRaw] = await Promise.all([val(db, LIB + '/docs'), val(db, LIB + '/human'), val(db, 'data/companies')]);
    const docs = Object.assign({}, docs0 || {}), human = Object.assign({}, human0 || {});
    const companies = MR.coList(cosRaw || {}).filter((c) => c && c.id != null);

    /* ① 처리 담당 — 메일함 화면이 그 메일에 붙이는 사람과 같은 사람(주소 → 칸 담당 차례). 매번 다시 셈해 «바뀐 것만» 쓴다 */
    const T = o.tables ? await o.tables() : await MO.loadTables(db, o.readCompanies);
    const sidByName = (T && T.sidByName) || {};
    const up = {};
    Object.keys(docs).forEach((id) => {
      const d = docs[id] || {};
      const addr = TD.addrOf(d);
      const w = addr ? MO.whoAll(addr, String((d.mail && d.mail.box) || ''), T) : { main: '', why: '' };
      const who = String(w.main || ''), why = who ? String(w.why || '') : '';
      const prev = d.owner || {};
      if (prev.at && String(prev.who || '') === who && String(prev.why || '') === why) return;
      const rec = { who: who, sid: who ? sidKey(sidByName[who] || '') : '', why: why, at: at };
      up[LIB + '/docs/' + id + '/owner'] = rec;
      docs[id] = Object.assign({}, d, { owner: rec });
    });
    await writeChunks(db, up);
    out.owners = Object.keys(up).length;

    /* ② 자동 확정 — 셈은 🧹 정리하기와 같은 판정(lib-daily plan) */
    const p = D.plan({ docs: docs, human: human }, companies, { max: o.max });
    out.plan = p.link.length;
    const items = p.link.slice(0, ITEMS_MAX).map((x) => ({ d: x.docId, c: x.companyId, w: x.why }));
    /* 기록 먼저 — 사람 칸을 쓰다 끊겨도 «무엇을 하려 했는지»가 남는다 */
    await db.ref(AUTO + '/last').set({ at: at, mode: mode, plan: p.link.length, more: p.more, skip: p.skip, items: items,
      applied: 0, done: mode !== 'live' });
    if (mode === 'live') {
      for (const x of p.link) {
        const r = await db.ref(LIB + '/human/' + x.docId).transaction((cur) => (canWrite(cur) ? humanRecord(cur, x.docId, x, at, cv) : undefined));
        if (r && r.committed) { out.applied++; human[x.docId] = r.snapshot && r.snapshot.val ? r.snapshot.val() : humanRecord(null, x.docId, x, at, cv); }
      }
      await db.ref(AUTO + '/last').update({ applied: out.applied, done: true });
    } else {
      out.would = p.link.length + p.more;
    }

    /* ③ 하루 기록 — 오늘(서울) 몫을 «다시 셈해» 덮는다(여러 회차가 돌아도 겹쳐 세지 않는다) */
    const names = {};
    Object.keys((T && T.nameBySid) || {}).forEach((k) => { names[sidKey(k)] = T.nameBySid[k]; });
    const s = D.summary({ docs: docs, human: human }, companies, { now: at, mode: mode,
      plan: mode === 'live' ? { link: [], more: 0 } : p, nameOf: (sid) => names[sidKey(sid)] || '' });
    await db.ref(AUTO + '/log/' + s.date).set(s);
  } catch (e) {
    out.error = String((e && e.message) || e).slice(0, 200);
    if (o.log) { try { o.log('실패: ' + out.error); } catch (_) { /* 로그 실패는 무시 */ } }
  }
  return out;
}

module.exports = { runOnce, canWrite, humanRecord, sidKey, LIB, AUTO };
