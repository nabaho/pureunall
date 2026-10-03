/* 취업규칙 모으기 — 한 회차 (설계 §4-1·§4-3·§4-5)
   부르는 쪽(index.js)이 db·bucket·fetchAtts 를 끼운다 — 그래서 검사가 가짜로 «한 회차를 실제로» 돌린다.
   ⚠ 원본 바이트는 이 함수 안에서만 산다. 담는 것은 redactOne 이 돌려준 가린 것뿐.
   ⚠ 다시 시도할 실패(연결·시간)는 seen 에 안 적는다 — 적으면 영영 다시 안 본다.
   ⚠ 겹침은 원본 지문(sha256)으로 — 답장마다 같은 파일이 붙어 온다.
   ⚠ 파일(창고)은 규칙 본문·신구대조표만 둔다. 동의서·신고서·의견청취·기타에는 도장·서명 그림이
     붙는데 kordoc 는 그림을 보지 않는다 — 글만 담고 file 은 null 로 둔다.
   ⚠ 사업장은 후보 목록을 «그대로» 담는다. 첫 후보를 사업장으로 고르지 않는다(확정은 사람). */
'use strict';
const crypto = require('crypto');
const P = require('./rules-collect-pick');
const X = require('./rules-collect-redact');
const MR = require('./mail-receive');
const LIB = 'rules_mgmt/library';
const FILE_KINDS = ['규칙본문', '신구대조표'];

const val = async (db, p) => (await db.ref(p).once('value')).val();
function isRetry(e) {
  if (!e) return false;
  if (e.status === 404 || e.status === 413) return false;
  return true;   // 연결 끊김·시간 초과·모르는 실패 — 다음 회차에 다시
}
/* 오류는 «이름표»만 남긴다 — 파서·창고 메시지가 글 조각을 인용할 수 있어 e.message 는 담지 않는다 */
function errTag(e) { return String((e && (e.code || e.name)) || '오류').slice(0, 40); }
function docRecord(o) {
  return Object.assign({
    id: o.id, entityType: 'RulesDocument', schemaVersion: 1, contractVersion: o.cv,
    createdAt: o.now, updatedAt: o.now, revision: 1,
  }, o.body);
}

async function run(o) {
  const t0 = o.now();
  const db = o.db, bucket = o.bucket;
  const [msgs, old, seen, docs, companies, prevRun] = await Promise.all([
    val(db, 'mailbox/msgs'), val(db, 'mailbox/old/msgs'), val(db, LIB + '/seen'),
    val(db, LIB + '/docs'), val(db, 'data/companies'), val(db, LIB + '/run'),
  ]);
  const have = Object.assign({}, docs || {});
  const coIndex = MR.buildCompanyIndex(companies || {});
  const domIndex = P.buildDomainIndex(companies || {});
  const picked = P.pickMails({ msgs: msgs || {}, old: old || {} }, seen || {}, o.limit);
  const sum = { seen: Object.keys(seen || {}).length, mails: 0, stored: 0, held: 0, dup: 0, retry: 0, errors: [], at: t0 };

  for (const m of picked) {
    if (o.now() - t0 > o.budgetMs) break;
    sum.mails++;
    const up = {};
    const ids = [];
    /* ★ 이 메일에서 «새로 정한 것»은 DB 에 쓰기가 성공한 뒤에야 have·sum 에 합친다.
       먼저 합쳐 두면, 중간에 터져 버려진 문서를 다음 메일이 「이미 있다」며 겹침으로 세고
       seen 에만 적어 — 그 문서는 영영 안 담긴다. */
    const staged = {};
    const c = { stored: 0, held: 0, dup: 0 };
    const has = (id) => have[id] || staged[id];
    let atts;
    try { atts = await o.fetchAtts(m); }
    catch (e) {
      if (isRetry(e)) { sum.retry++; sum.errors.push(errTag(e)); continue; }
      try {
        await db.ref().update({ [LIB + '/seen/' + m.mailKey]: { at: o.now(), docs: [], why: e.status === 404 ? '없어짐' : '너무 큼' } });
      } catch (e2) { sum.retry++; sum.errors.push(errTag(e2)); }
      continue;
    }
    const cand = P.companyCandOf(m, coIndex, domIndex);
    const mail = { src: m.src, box: m.slug || '', key: m.src === 'imap' ? m.uid : m.key,
      date: Number(m.row.d || 0), from: String(m.row.e || ''), to: String(m.row.t || ''),
      subject: String(m.row.s || '').slice(0, 200) };
    try {
      for (const a of atts || []) {
        const ext = P.wantAtt(a.name);
        if (!ext) continue;
        const now = o.now();
        const common = { name: String(a.name).slice(0, 200), mail, dir: m.dir, companyCand: cand,
          companyId: null, companyLinkStatus: 'pending' };
        if (a.tooBig) {
          const id = 'rd_big_' + crypto.createHash('sha256').update(m.mailKey + '|' + a.name).digest('hex').slice(0, 20);
          if (!has(id)) {
            up[LIB + '/docs/' + id] = docRecord({ id, now, cv: o.contractVersion, body: Object.assign({}, common,
              { kind: P.kindOf(a.name, ''), sha: '', file: null, textLen: 0, pii: { count: {}, residual: 0 },
                status: '보류', holdWhy: '20MB 넘음 — 메일에서 직접' }) });
            staged[id] = 1; c.held++;
          }
          ids.push(id);
          continue;
        }
        const sha = crypto.createHash('sha256').update(a.data).digest('hex');
        const id = P.docIdOf(sha);
        if (has(id)) { c.dup++; ids.push(id); continue; }
        const r = await X.redactOne(a.data, ext);   // impl(셋째 칸)은 검사 전용 — 여기서는 안 넘긴다
        if (!r.ok) {
          /* 무슨 까닭이든 ok:false 는 똑같이 보류 — 글·파일 아무것도 안 담는다 */
          up[LIB + '/docs/' + id] = docRecord({ id, now, cv: o.contractVersion, body: Object.assign({}, common,
            { kind: P.kindOf(a.name, ''), sha, file: null, textLen: 0, pii: { count: r.count || {}, residual: 0 },
              status: '보류', holdWhy: r.holdWhy }) });
          staged[id] = 1; c.held++; ids.push(id);
          continue;
        }
        const kind = P.kindOf(a.name, r.text);
        /* ★★★ 취업규칙 서류가 아니면 «글을 담지 않는다» (2026-10-03 첫 회차 실측).
           본문에 「취업규칙」 이 든 메일이면 첨부를 다 받으므로, 징계 통지서·회의록처럼
           근로자 이름이 그대로 든 인사 기록이 섞여 들어왔다(47건 중 23건이 「기타」).
           이름은 가리지 않기로 했으므로(헛잡기) 담는 순간 재직 직원 전체에 열린다.
           → 보류 줄(까닭·셈만). 틀리게 갈랐으면 원본은 메일함에 있다. */
        if (kind === '기타') {
          up[LIB + '/docs/' + id] = docRecord({ id, now, cv: o.contractVersion, body: Object.assign({}, common,
            { kind, sha, file: null, textLen: 0, pii: { count: r.count || {}, residual: 0 },
              status: '보류', holdWhy: '취업규칙 서류가 아님(갈래 「기타」) — 담지 않음' }) });
          staged[id] = 1; c.held++; ids.push(id);
          continue;
        }
        let file = null;
        if (r.data && FILE_KINDS.indexOf(kind) >= 0) {
          const p = 'rules_lib/' + id + '.' + ext;
          await bucket.file(p).save(Buffer.from(r.data), { contentType: 'application/octet-stream', resumable: false });
          file = { path: p, format: ext, size: r.data.length };
        }
        up[LIB + '/text/' + id] = r.text;
        up[LIB + '/docs/' + id] = docRecord({ id, now, cv: o.contractVersion, body: Object.assign({}, common,
          { kind, sha, file, textLen: r.text.length,
            pii: { count: r.count || {}, residual: 0 }, status: '담김', holdWhy: '' }) });
        staged[id] = 1; c.stored++; ids.push(id);
      }
      up[LIB + '/seen/' + m.mailKey] = { at: o.now(), docs: ids, why: ids.length ? '' : '첨부 없음' };
      await db.ref().update(up);
    } catch (e) {
      /* 창고·가리기·DB 쓰기 도중 터짐 — staged 는 버리고, seen 에 안 적어 다음 회차에 다시.
         회차 전체를 죽이지 않는다(run 기록·zeroStreak 는 계속 쓴다) */
      sum.retry++; sum.errors.push(errTag(e));
      continue;
    }
    Object.assign(have, staged);
    sum.stored += c.stored; sum.held += c.held; sum.dup += c.dup;
  }
  sum.errors = sum.errors.slice(0, 10);
  /* 설계 §4-5 — 「담음 0, 오류 있음」이 사흘 이어지면 관리자에게 알린다(부르는 쪽이 systemAlerts 에 쓴다) */
  const bad = sum.stored === 0 && (sum.retry > 0 || sum.errors.length > 0);
  sum.zeroStreak = bad ? Number((prevRun && prevRun.zeroStreak) || 0) + 1 : 0;
  sum.alert = sum.zeroStreak >= 3;
  await db.ref(LIB + '/run').set(Object.assign({}, sum, { took: o.now() - t0 }));
  if (o.log) o.log(JSON.stringify({ mails: sum.mails, stored: sum.stored, held: sum.held, dup: sum.dup, retry: sum.retry }));
  return sum;
}
module.exports = { run, isRetry, errTag, LIB, FILE_KINDS };
