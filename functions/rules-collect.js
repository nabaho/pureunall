/* 취업규칙 모으기 — 한 회차 (설계 §4-1·§4-3·§4-5)
   부르는 쪽(index.js)이 db·bucket·fetchAtts 를 끼운다 — 그래서 검사가 가짜로 «한 회차를 실제로» 돌린다.
   ⚠ 원본 바이트는 이 함수 안에서만 산다. 담는 것은 redactOne 이 돌려준 가린 것뿐.
   ⚠ 다시 시도할 실패(연결·시간)는 seen 에 안 적는다 — 적으면 영영 다시 안 본다.
   ⚠ 겹침은 원본 지문(sha256)으로 — 답장마다 같은 파일이 붙어 온다.
   ⚠ 담는 것은 규칙 본문·신구대조표뿐(글 + 한글이면 파일). 동의서·신고서·의견청취·기타는
     근로자 이름·서명이 들거나 취업규칙 서류가 아니라 글도 파일도 안 담는다 — 보류 줄만(NO_TEXT_KINDS).
   ⚠ 사업장은 후보 목록을 «그대로» 담는다. 첫 후보를 사업장으로 고르지 않는다(확정은 사람). */
'use strict';
const crypto = require('crypto');
const P = require('./rules-collect-pick');
const X = require('./rules-collect-redact');
const MR = require('./mail-receive');
const LIB = 'rules_mgmt/library';
const FILE_KINDS = ['규칙본문', '신구대조표'];
/* 글도 안 담는 갈래 → 보류 까닭. 담는 것은 규칙본문·신구대조표뿐이다(조별 문안·우리 문안이 쓰는 것도 그 둘). */
const NAMES = '근로자 이름·서명이 든 서류';
const NO_TEXT_KINDS = {
  '기타': '취업규칙 서류가 아님(갈래 「기타」) — 담지 않음',
  '동의서': NAMES + '(동의서) — 담지 않음',
  '신고서': NAMES + '(신고서) — 담지 않음',
  '의견청취': NAMES + '(의견청취) — 담지 않음',
};

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

/* ══════ 이어 달리기 · 잠금 (2026-10-05 대표 지시 「지금까지 컨설팅했던것 모두 가지고 와라」) ══════
   밀린 메일 744통 중 701통이 지난 메일(POP3) — 목록에 첨부 표시가 없어 한 통씩 통째로 받는다(한 회차 8~10통).
   하루 한 번이면 두 달이 넘는다 → 회차가 «남은 메일 수»를 적고, 부르는 쪽(index.js)이 shouldChain 이면 다음 회차를 부른다.
   ⚠ 두 회차가 동시에 돌면 같은 메일을 둘이 받는다 — 잠금. 함수 한도(9분)보다 조금 길게 잡고, 지나면 죽은 회차로 보고 이어받는다.
   ⚠ 끝나면(터져도) 잠금을 푼다. */
const LOCK_MS = 10 * 60 * 1000;
/* ══════ 담긴 글 다시 훑기 (2026-10-05 대표 「추천대로」 — 유선 번호를 놓친 규칙본문 1건을 다시 가려 담기) ══════
   새 그물(다시 읽은 글을 한 번 더 훑기)은 «앞으로» 담는 것만 지킨다. 이미 담긴 것은 회차가 스스로 고친다.
   판(RECHECK_V)마다 한 번씩만 — 가림 규칙을 고치면 판을 올려 다시 훑게 한다.
   걸리면 글을 가려 다시 쓰고, 그 파일은 믿지 않는다(창고에서 지우고 file 을 비운다 — 글만).
   ⚠ 못 지우면 fileOrphan 에 자리를 적는다 — 이어 두면 안 되고, 자리를 잃으면 아무도 못 지운다. */
const RECHECK_V = 1;
async function heal(o, db, bucket, docs) {
  const ids = Object.keys(docs || {}).filter((id) => docs[id] && docs[id].status === '담김'
    && Number(docs[id].recheckV || 0) < RECHECK_V);
  if (!ids.length) return 0;
  const texts = (await val(db, LIB + '/text')) || {};
  const recheck = o.recheck || X.recheck;
  let n = 0;
  for (const id of ids) {
    const d = docs[id], t = texts[id];
    const P0 = LIB + '/docs/' + id + '/';
    const up = { [P0 + 'recheckV']: RECHECK_V };
    const r = t ? await recheck(t) : { leak: 0 };
    if (r.leak) {
      const now = o.now();
      const count = Object.assign({}, (d.pii && d.pii.count) || {});
      Object.keys(r.count || {}).forEach((k) => { count[k] = (count[k] || 0) + r.count[k]; });
      up[LIB + '/text/' + id] = r.text;
      up[P0 + 'textLen'] = r.text.length;
      up[P0 + 'pii/count'] = count;
      up[P0 + 'revision'] = Number(d.revision || 1) + 1;
      up[P0 + 'updatedAt'] = now;
      up[P0 + 'healedAt'] = now;
      up[P0 + 'file'] = null;
      if (d.file && d.file.path) {
        try { await bucket.file(d.file.path).delete(); }
        catch (e) { up[P0 + 'fileOrphan'] = d.file.path; }
      }
      n++;
    }
    await db.ref().update(up);
  }
  return n;
}
const MAX_CHAIN = 150;
/* 정해진 회차(30분마다 깨움)가 «돌지» 가른다 (2026-10-05 대표 「2020년 부터 찾아라」) — 작은 기록(run) 하나만 보고.
   밀린 것이 있거나 모르면 돈다(이어 달리기가 이어받는다) · 없으면 하루 한 번(새 메일) · 사흘째 0(고장)이면 하루 한 번.
   ⚠ 첫 회차를 사람·05:00 에 기대면, 신호를 못 넣는 날 수백 통이 하루를 기다린다(10-05 에 실제로 그랬다). */
const DAY_MS = 23 * 3600e3;
function shouldRunScheduled(run, now) {
  if (!run) return true;
  const stale = !(Number(run.at) > 0) || now - Number(run.at) >= DAY_MS;
  if (Number(run.zeroStreak || 0) >= 3) return stale;
  if (run.left === undefined || run.left === null) return true;
  return Number(run.left) > 0 || stale;
}            // 한 줄로 이어 달리는 회차 수 한도 — 고장 난 고리가 끝없이 돌지 않게
function shouldChain(sum, chain) {
  if (!sum || sum.skipped) return false;
  if (!(Number(sum.left) > 0) || !(Number(sum.mails) > 0)) return false;   // 다 봤거나, 한 통도 못 봤다(나아가지 않는 고리)
  if (Number(sum.retry) >= Number(sum.mails)) return false;                // 연결 실패투성이 — 지금 또 불러도 같다
  return Number(chain || 0) < MAX_CHAIN;
}
async function run(o) {
  const ref = o.db.ref(LIB + '/lock');
  if (typeof ref.transaction !== 'function') return runOnce(o);
  const now = o.now();
  const r = await ref.transaction((cur) => (cur && Number(cur.until) > now ? undefined : { until: now + LOCK_MS, at: now }));
  if (!r || !r.committed) return { skipped: 'busy', mails: 0, left: 0, retry: 0, stored: 0, held: 0, dup: 0 };
  try { return await runOnce(o); }
  finally { try { await ref.set(null); } catch (_) { /* 풀지 못하면 LOCK_MS 뒤 다음 회차가 이어받는다 */ } }
}
async function runOnce(o) {
  const t0 = o.now();
  const db = o.db, bucket = o.bucket;
  const [msgs, old, seen, docs, companies, prevRun] = await Promise.all([
    val(db, 'mailbox/msgs'), val(db, 'mailbox/old/msgs'), val(db, LIB + '/seen'),
    val(db, LIB + '/docs'), val(db, 'data/companies'), val(db, LIB + '/run'),
  ]);
  const healed = await heal(o, db, bucket, docs || {});
  const have = Object.assign({}, docs || {});
  const coIndex = MR.buildCompanyIndex(companies || {});
  const domIndex = P.buildDomainIndex(companies || {});
  /* 남은 것 «모두»를 한 번 세고(메모리 안 셈이라 싸다) 이번 몫만 자른다 — left 가 이어 달리기의 잣대다 */
  const allLeft = P.pickMails({ msgs: msgs || {}, old: old || {} }, seen || {}, 1e9);
  const picked = allLeft.slice(0, Math.max(0, Number(o.limit) || 0));
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
           → 보류 줄(까닭·셈만). 틀리게 갈랐으면 원본은 메일함에 있다.
           ★★★ 동의서·신고서·의견청취도 같다 (2026-10-04 대표 결정 「둘다 26 지움」).
           근로자 이름·서명이 든 서류다. 결정은 첫 회차 것을 «손으로» 지우는 데만 쓰였고 여기엔 안 들어와,
           10-04 새벽 회차가 신고서 1건을 또 담았다. 결정은 손이 아니라 이 자리에 둔다. */
        const HOLD = NO_TEXT_KINDS[kind];
        if (HOLD) {
          up[LIB + '/docs/' + id] = docRecord({ id, now, cv: o.contractVersion, body: Object.assign({}, common,
            { kind, sha, file: null, textLen: 0, pii: { count: r.count || {}, residual: 0 },
              status: '보류', holdWhy: HOLD }) });
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
  sum.left = Math.max(0, allLeft.length - (sum.mails - sum.retry));
  sum.healed = healed;   // 다시 시도할 것은 남은 것으로 센다
  /* 설계 §4-5 — 「담음 0, 오류 있음」이 사흘 이어지면 관리자에게 알린다(부르는 쪽이 systemAlerts 에 쓴다) */
  const bad = sum.stored === 0 && (sum.retry > 0 || sum.errors.length > 0);
  sum.zeroStreak = bad ? Number((prevRun && prevRun.zeroStreak) || 0) + 1 : 0;
  sum.alert = sum.zeroStreak >= 3;
  await db.ref(LIB + '/run').set(Object.assign({}, sum, { took: o.now() - t0 }));
  if (o.log) o.log(JSON.stringify({ mails: sum.mails, stored: sum.stored, held: sum.held, dup: sum.dup, retry: sum.retry }));
  return sum;
}
module.exports = { run, shouldChain, shouldRunScheduled, MAX_CHAIN, LOCK_MS, RECHECK_V, isRetry, errTag, LIB, FILE_KINDS, NO_TEXT_KINDS };
