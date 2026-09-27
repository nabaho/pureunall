/* 법 개정 감시 — 우리 검토 기준이 기대는 조가 바뀌었는지 매일 본다 (2026-09-26)

   출처: legalize-kr/legalize-kr — 법제처 원문을 조문 단위 마크다운으로 git 에 담은 저장소.
         «개정 하나 = 커밋 하나» 라서 앞뒤 판을 그대로 견줄 수 있다.
   감시 목록: rules-lawwatch-laws.json — 저장소 뿌리의 연결표(js/pu-rules-lawlink.js)에서
         scripts/make-lawwatch-list.js 가 옮긴 것. 손으로 고치지 않는다.

   하루 한 번 이렇게 한다(법마다):
     ① 현행 파일 하나만 받는다(raw — 부르는 수 제한이 없다).
     ② 공포번호가 지난번과 같으면 끝. 대부분의 날은 여기서 끝난다.
     ③ 달라졌으면 그 파일의 커밋 목록을 받아(GitHub API — 시간당 60번 제한, 그래서 이때만)
        지난번 판까지 거슬러 올라가며 앞뒤 판을 견준다.
     ④ «우리가 감시하는 조» 가 바뀐 판만 사건(event)으로 남긴다. 나머지 조는 개수만 센다.
   처음 도는 날(지난번 기록이 없을 때)은 «공포됐지만 아직 시행 전» 인 판만 사건으로 남긴다 —
   이미 시행된 옛 개정까지 사건으로 쏟으면 화면이 과거 기록으로 덮인다.

   ⚠ 이 파일은 원본 자료를 고치지 않는다 — 법령 요약만 rules_mgmt/lawwatch 에 적는다.
     사업장 취업규칙에 무엇이 걸리는지는 화면(rules.html)이 자기가 가진 회차로 셈한다. */
'use strict';

const REPO = 'legalize-kr/legalize-kr';
const MAX_VERSIONS = 10;          // 한 번에 거슬러 올라가는 판 수
const MAX_TEXT = 4000;            // 조 하나의 앞뒤 글자 상한 (RTDB 에 적는 양을 묶는다)
const UA = 'pureun-erp-rules-lawwatch';

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
function parseYmd(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}
/* 「공포 후 N개월이 경과한 날」 — 초일 불산입. 6.9 공포 + 6개월 → 기간 끝 12.9 → 그 다음 날 12.10 */
function afterPeriod(prom, n, unit) {
  const d = parseYmd(prom);
  if (!d) return '';
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
  const addM = unit === '년' ? n * 12 : n;
  const last = new Date(Date.UTC(y, m + addM + 1, 0)).getUTCDate();       // 그 달의 끝날
  const end = new Date(Date.UTC(y, m + addM, Math.min(day, last)));
  end.setUTCDate(end.getUTCDate() + 1);
  return ymd(end);
}
function num(v) { return String(v == null ? '' : v).replace(/^0+(?=\d)/, ''); }

/* 마크다운 한 벌 → { front, arts:{ '54':{title,text} }, addenda:[{no,date,text}] } */
function parseLawMd(md) {
  const s = String(md || '').replace(/\r\n?/g, '\n');
  const front = {};
  let body = s;
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(s);
  if (fm) {
    fm[1].split('\n').forEach(l => {
      const k = /^([^\s:-][^:]*):\s*(.*)$/.exec(l);
      if (k) front[k[1].trim()] = k[2].trim().replace(/^'|'$/g, '');
    });
    body = s.slice(fm[0].length);
  }
  const cut = body.search(/\n## 부칙/);
  const main = cut < 0 ? body : body.slice(0, cut);
  const tail = cut < 0 ? '' : body.slice(cut);
  const arts = {};
  const re = /^#{3,6}\s*제(\d+)조(?:의(\d+))?\s*(?:\(([^)\n]*)\))?[^\n]*$/gm;
  const heads = [];
  let m;
  while ((m = re.exec(main))) heads.push({ at: m.index, end: m.index + m[0].length, art: m[1] + (m[2] ? '의' + m[2] : ''), title: (m[3] || '').trim(), line: m[0] });
  heads.forEach((h, i) => {
    const stop = i + 1 < heads.length ? heads[i + 1].at : main.length;
    let seg = main.slice(h.end, stop);
    const nextHead = seg.search(/^#{1,6}\s/m);                 // 장·절 머리는 조 본문이 아니다
    if (nextHead >= 0) seg = seg.slice(0, nextHead);
    let text = clean(seg);
    /* 「제10조 삭제 <2019.1.15>」 꼴 — 머리줄에 삭제가 붙어 본문이 비는 경우 */
    if (!text && /삭제/.test(h.line)) text = clean(h.line.replace(/^#+\s*제\d+조(?:의\d+)?\s*/, ''));
    arts[h.art] = { title: h.title, text: text };
  });
  const addenda = [];
  const ar = /^부칙\s*<제(\d+)호,\s*(\d{4})\.(\d{1,2})\.(\d{1,2})>/gm;
  const hs = [];
  while ((m = ar.exec(tail))) hs.push({ at: m.index, no: num(m[1]), date: m[2] + '-' + pad(m[3]) + '-' + pad(m[4]) });
  hs.forEach((h, i) => addenda.push({ no: h.no, date: h.date, text: clean(tail.slice(h.at, i + 1 < hs.length ? hs[i + 1].at : tail.length)) }));
  return {
    front: front,
    no: num(front['공포번호']),
    promulgated: front['공포일자'] || '',
    effective: front['시행일자'] || '',
    name: front['제목'] || '',
    lawId: front['법령ID'] || '',
    arts: arts,
    addenda: addenda
  };
}
function clean(t) {
  return String(t || '').replace(/\*\*/g, '').replace(/[ \t]+/g, ' ')
    .split('\n').map(x => x.trim()).filter(Boolean).join('\n').trim();
}

/* 부칙 제1조(시행일)에서 조마다 시행일을 읽는다.
   「이 법은 공포 후 1년이 경과한 날부터 시행한다. 다만, 제54조의 개정규정은 공포 후 6개월이 …」
   → { base:'2027-06-10', byArt:{ '54':'2026-12-10' }, unsure:[] }
   ⚠ 못 읽은 단서가 있으면 그 조를 unsure 에 넣는다 — 틀린 날짜를 자신 있게 적느니
     「부칙 확인」 이라고 드러내는 편이 낫다. */
function effectiveDates(parsed) {
  const out = { base: parsed.effective, byArt: {}, unsure: [] };
  const add = (parsed.addenda || []).find(a => a.no === parsed.no);
  if (!add) return out;
  const first = add.text.split(/\n?제2조\s*\(/)[0];
  const dateOf = (expr) => {
    let m;
    if (/공포한 날/.test(expr)) return parsed.promulgated;
    if ((m = /공포 후\s*(\d+)\s*(개월|년)이\s*경과한 날/.exec(expr))) return afterPeriod(parsed.promulgated, +m[1], m[2]);
    if ((m = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/.exec(expr))) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
    return '';
  };
  const i = first.indexOf('다만');
  if (i < 0) return out;
  const tail = first.slice(i);
  const re = /((?:제\d+조(?:의\d+)?(?:제\d+항)?(?:제\d+호)?\s*(?:ㆍ|,|및)?\s*)+)의\s*개정규정은\s*([^,.]*?)부터/g;
  let m, seen = false;
  while ((m = re.exec(tail))) {
    seen = true;
    const when = dateOf(m[2]);
    const list = [];
    m[1].replace(/제(\d+)조(?:의(\d+))?/g, (_, a, b) => { list.push(a + (b ? '의' + b : '')); return _; });
    list.forEach(a => { if (when) out.byArt[a] = when; else out.unsure.push(a); });
  }
  if (!seen) out.unsure.push('*');                       // 단서가 있는데 한 조도 못 읽었다
  return out;
}

/* 앞뒤 판을 견준다 — 감시하는 조만 글자로, 나머지는 개수만 */
function diffWatched(prev, next, watch) {
  const arts = {};
  const dates = effectiveDates(next);
  const watchSet = new Set(watch || []);
  (watch || []).forEach(a => {
    const b = (prev.arts[a] || {}).text || '', f = (next.arts[a] || {}).text || '';
    if (b === f) return;
    const kind = !b ? '신설' : (!f || /^삭제\b|^삭제\s*</.test(f)) ? '삭제' : '개정';
    const eff = dates.byArt[a] || dates.base || next.effective;
    const o = { art: a, title: (next.arts[a] || prev.arts[a] || {}).title || '', kind: kind,
      before: b.slice(0, MAX_TEXT), after: f.slice(0, MAX_TEXT), effective: eff };
    if (dates.unsure.includes(a) || (dates.unsure.includes('*'))) o.effNote = '부칙 확인';
    arts[a] = o;
  });
  let other = 0;
  const all = new Set(Object.keys(prev.arts).concat(Object.keys(next.arts)));
  all.forEach(a => {
    if (watchSet.has(a)) return;
    if (((prev.arts[a] || {}).text || '') !== ((next.arts[a] || {}).text || '')) other++;
  });
  return { arts: arts, otherChanged: other };
}

function rawUrl(ref, law) {
  return 'https://raw.githubusercontent.com/' + REPO + '/' + ref + '/kr/' +
    encodeURIComponent(law.src) + '/' + encodeURIComponent(law.file);
}
function commitsUrl(law) {
  return 'https://api.github.com/repos/' + REPO + '/commits?per_page=' + MAX_VERSIONS +
    '&path=' + encodeURIComponent('kr/' + law.src + '/' + law.file);
}

/* 기준 판 한 벌 — 감시하는 조의 제목·글자만 적어 둔다(다음 날 견줄 «앞 판»).
   ⚠ 법 전체를 적지 않는다. 민법만 1,193조다 — 우리가 보는 것은 87조뿐이다. */
function baseOf(p, watch) {
  const texts = {};
  (watch || []).forEach(a => { if (p.arts[a]) texts[a] = { t: p.arts[a].title, x: p.arts[a].text.slice(0, MAX_TEXT) }; });
  return { no: p.no, promulgated: p.promulgated, effective: p.effective, texts: texts };
}
function fromBase(b) {
  const arts = {};
  Object.keys(b.texts || {}).forEach(a => { arts[a] = { title: b.texts[a].t || '', text: b.texts[a].x || '' }; });
  return { no: b.no, promulgated: b.promulgated, effective: b.effective, arts: arts, addenda: [] };
}
/* 「<개정 2026.4.7>」 표시로 그 공포에서 바뀐 조를 찾는다 — 앞 판을 못 받았을 때만 쓴다.
   앞 글자를 모르므로 before 는 비우고 beforeUnknown 을 세운다(화면이 「법제처에서 확인」 을 띄운다). */
function markerDiff(law, head) {
  const d = parseYmd(head.promulgated);
  if (!d) return {};
  const mark = d.getUTCFullYear() + '.' + (d.getUTCMonth() + 1) + '.' + d.getUTCDate();
  const re = new RegExp('<(개정|신설)[^>]*\\b' + mark.replace(/\./g, '\\.') + '(?![\\d])');
  const dates = effectiveDates(head);
  const arts = {};
  (law.arts || []).forEach(a => {
    const x = (head.arts[a] || {}).text || '';
    const m = re.exec(x);
    if (!m) return;
    const o = { art: a, title: head.arts[a].title, kind: '개정', before: '', after: x.slice(0, MAX_TEXT),
      effective: dates.byArt[a] || dates.base || head.effective, beforeUnknown: true };
    if (dates.unsure.includes(a) || dates.unsure.includes('*')) o.effNote = '부칙 확인';
    arts[a] = o;
  });
  return arts;
}
function eventOf(law, prev, next, arts, other, nowIso, cv) {
  const effs = Object.keys(arts).map(a => arts[a].effective).filter(Boolean).sort();
  return {
    id: law.id + '_' + next.no,
    entityType: 'LegalProvision', schemaVersion: 1, contractVersion: cv, revision: 1,
    createdAt: nowIso, updatedAt: nowIso,
    sourceKind: 'legalize-kr', sourceId: law.id + '@' + next.no,
    lawKey: law.key, lawId: law.id, no: next.no, prevNo: prev ? prev.no : '',
    promulgated: next.promulgated, effective: next.effective,
    firstEffective: effs[0] || next.effective,
    arts: arts, otherChanged: other,
    url: 'https://www.law.go.kr/법령/' + encodeURIComponent(law.key)
  };
}

/* 한 번 돌기 — 받아 오는 일(fetchText·fetchJson)은 밖에서 넣는다. 그래서 검사가 가짜로 돌린다.
   base: { [법령ID]: {no, promulgated, effective, texts:{조:{t,x}}} } — 지난번에 본 판
   반환: { events:[…], base:{ 바뀐 법만 }, errors:[…], checked }

   ★ 날마다 도는 길에는 GitHub API 가 «없다» — 현행 파일 하나와 기준 판만 견준다.
     API(커밋 목록)는 «처음 도는 날, 시행 전 개정이 있는 법» 에서만 한 번 쓴다.
     실측(2026-09-26): 이 저장소는 커밋이 10만 개라 경로 이력 조회가 법에 따라
     GitHub 쪽에서 시간이 넘쳐 500 을 낸다(최저임금법이 매번 그랬다).
     그럴 때는 원문의 「<개정 날짜>」 표시로 바뀐 조만 찾는다. */
async function run(opts) {
  const list = opts.list, base = opts.base || {}, today = opts.today, nowIso = opts.nowIso;
  const cv = opts.contractVersion == null ? 1 : opts.contractVersion;
  const out = { events: [], base: {}, errors: [], checked: 0 };
  for (const law of list.laws) {
    try {
      const head = parseLawMd(await opts.fetchText(rawUrl('main', law)));
      if (!head.no) throw new Error('공포번호를 못 읽었습니다');
      if (head.lawId && num(head.lawId) !== num(law.id)) throw new Error('법령ID 가 다릅니다 — ' + head.lawId + ' (폐지된 옛 파일을 보는 것일 수 있다)');
      out.checked++;
      const b = base[law.id];
      /* 감시 조가 늘었으면(규칙이 새 조를 가리키게 됨) 기준 판에 그 조를 채워 둔다 — 사건은 아니다 */
      const missing = b && b.no === head.no && (law.arts || []).some(a => head.arts[a] && !(b.texts || {})[a]);
      if (b && b.no === head.no && !missing) continue;                     // 대부분의 날
      if (b && b.no === head.no) { out.base[law.id] = baseOf(head, law.arts); continue; }
      if (b && b.texts) {                                                   // 새 공포 — 기준 판과 견준다
        const d = diffWatched(fromBase(b), head, law.arts);
        if (Object.keys(d.arts).length) out.events.push(eventOf(law, b, head, d.arts, d.otherChanged, nowIso, cv));
        out.base[law.id] = baseOf(head, law.arts);
        continue;
      }
      /* 처음 도는 날 */
      if (!(head.effective > today)) { out.base[law.id] = baseOf(head, law.arts); continue; }
      let seeded = false;
      try {
        const commits = await opts.fetchJson(commitsUrl(law));
        if (Array.isArray(commits) && commits.length) {
          const vers = [];
          for (const c of commits.slice(0, MAX_VERSIONS)) {
            const p = parseLawMd(await opts.fetchText(rawUrl(c.sha, law)));
            if (vers.length && vers[vers.length - 1].no === p.no) continue;   // 같은 공포를 다듬은 커밋
            vers.push(p);
            if (!(p.effective > today)) break;                              // 현행 판에 닿았다
          }
          for (let i = vers.length - 1; i >= 1; i--) {
            const d = diffWatched(vers[i], vers[i - 1], law.arts);
            if (Object.keys(d.arts).length) out.events.push(eventOf(law, vers[i], vers[i - 1], d.arts, d.otherChanged, nowIso, cv));
          }
          seeded = vers.length >= 2;
        }
      } catch (e) { if (opts.onNote) opts.onNote(law.key + ': 이력 조회 실패 — ' + String(e && e.message || e).slice(0, 120)); /* 아래 표시 찾기로 */ }
      if (!seeded) {
        const arts = markerDiff(law, head);
        if (Object.keys(arts).length) out.events.push(eventOf(law, null, head, arts, 0, nowIso, cv));
      }
      out.base[law.id] = baseOf(head, law.arts);
    } catch (e) {
      out.errors.push({ law: law.key, message: String(e && e.message || e).slice(0, 200) });
    }
  }
  return out;
}

/* 한 번에 적을 묶음 — 이미 있는 사건은 덮지 않는다(사람이 보던 것이 바뀌면 안 된다) */
function updatesOf(result, existing, nowIso) {
  const upd = {};
  result.events.forEach(ev => { if (!existing || !existing[ev.id]) upd['events/' + ev.id] = ev; });
  Object.keys(result.base).forEach(id => { upd['base/' + id] = Object.assign({}, result.base[id], { checkedAt: nowIso }); });
  upd.lastRun = { at: nowIso, checked: result.checked, events: result.events.length,
    errors: result.errors.length, errorLaws: result.errors.map(e => e.law).slice(0, 10) };
  return upd;
}

module.exports = { REPO, UA, parseLawMd, effectiveDates, afterPeriod, diffWatched, baseOf, fromBase, markerDiff, eventOf, run, updatesOf, rawUrl, commitsUrl };
