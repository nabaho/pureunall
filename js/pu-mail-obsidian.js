/* 푸른 메일 → 옵시디언 «기업별 · 사람별 · 푸른 담당자별» 정리 (대표 지시 2026-10-20)
   ═════════════════════════════════════════════════════════════════
   「푸른노무법인에서 메일로 주고 받은 자료들 모두 옵시디언에 정리 — 기업별 사람별 그리고 담당자별로.
     푸른 담당자는 푸른이알피에서 찾으면 된다」

   ★ 어디까지 담나 (대표 선택 «목록만 + 첨부 이름»)
     날짜 · 방향 · 상대 · 제목 · 첨부 «이름» · 폴더. **본문과 첨부 파일은 담지 않는다.**
     고객 임직원의 신상이 파일로 퍼지는 양을 줄이려는 것이다 — 필요한 메일만 나중에 본문을 더한다(2단계).

   ★ 누가 누구인가는 «이 앱이 이미 아는 것»을 그대로 쓴다 — 새 잣대를 만들지 않는다.
     업체 이름 · 푸른 담당자(부담당) 는 부르는 쪽(pu-cards.html)이 resolve 로 건넨다
     (사람이 이은 자문사 → 이알피 진행 건 → 기업정보함 명함 차례, mbWhoWhyOf · mbCoNameOf).
     여기는 «모아서 마크다운으로 바꾸고 폴더에 쓰는 일»만 한다. 업체를 못 찾은 주소는 «못 찾았다»고 적는다 —
     이름이 비슷하다고 짐작해 잇지 않는다.

   ★ 한 방향이다 — 옵시디언 쪽을 고쳐도 메일함에는 아무 일도 없다. 메일함은 읽기만 한다.
   ⚠ `메일/` 폴더 안은 «자동 생성»이다. 다시 내보내면 같은 이름의 파일은 덮인다(지우지는 않는다).
     손으로 쓴 메모는 이 폴더 밖에 둔다.
   ⚠ 주민번호 지우개(js/pu-rrn-mask.js)가 안 실려 있으면 «쓰기를 막는다» — work.html 의 옵시디언 내보내기와 같은 규칙. */
(function (root) {
  'use strict';

  var ROOT_DIR = '메일';
  var SUB = { co: '기업', person: '사람', owner: '담당자' };
  var NO_CO = '(업체 미확인)';
  var NO_OWNER = '(담당 미지정)';
  var CO_ROWS_MAX = 2000;       /* 한 업체 표의 줄 수 — 넘으면 최근 것만 */
  var PERSON_ROWS_MAX = 40;     /* 사람 장은 최근 것만(전체는 업체 장에 있다) */
  var UNCO_ROWS_MAX = 500;      /* «업체 미확인» 장 */
  var UNCO_PERSON_MIN = 3;      /* 업체를 못 찾은 주소는 3통 이상 오간 것만 사람 장을 만든다 — 광고·스팸 한 통짜리로 파일이 불지 않게 */

  /* ── 글자 다듬기 ── */
  function one(v) { return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* 파일 이름·[[ ]] 안에서 깨지는 글자를 걷는다(윈도 금지문자 + # ^ [ ] |) */
  function safeName(s, max) {
    var t = one(s).replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/, '').trim();
    if (t.length > (max || 80)) t = t.slice(0, max || 80).trim();
    return t || '이름없음';
  }
  function cell(s, max) {      /* 표 한 칸은 «한 줄» — | 와 줄바꿈을 걷는다 */
    var t = one(s).replace(/\|/g, '¦');
    return t.length > (max || 90) ? t.slice(0, (max || 90) - 1) + '…' : t;
  }
  function yq(v) { return JSON.stringify(one(v)); }
  function kst(ms) {
    var d = new Date(Number(ms) + 9 * 3600e3);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  }
  function addrOf(v) {
    var m = String(v == null ? '' : v).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return m ? m[0].toLowerCase() : '';
  }
  /* 같은 이름을 윈도가 «같은 파일»로 보므로 대소문자를 합쳐 겹침을 막는다 */
  function namer() {
    var used = {};
    return function (base) {
      var n = base, i = 2;
      while (used[n.toLowerCase()]) { n = base + ' (' + i + ')'; i++; }
      used[n.toLowerCase()] = 1;
      return n;
    };
  }
  function link(dir, name, alias) { return '[[' + ROOT_DIR + '/' + dir + '/' + name + '|' + one(alias || name).replace(/[|[\]]/g, ' ') + ']]'; }

  /* ── 메일 한 통 → 표준 줄 ── */
  function toItems(rows) {
    /* rows: [{d,s,e,f,t,tn,a,an,folder}] — 칸 이름은 서버(mail-box.msgRow)가 적는 그대로 */
    var seen = {}, out = [];
    (rows || []).forEach(function (r) {
      if (!r) return;
      var key = [r.d || 0, one(r.s), addrOf(r.e), one(r.t)].join('|');
      if (seen[key]) return;      /* 같은 메일이 두 폴더에 있어도 한 통으로 센다 */
      seen[key] = 1;
      out.push(r);
    });
    return out;
  }

  /* ── 핵심: 줄들 → {경로: 마크다운} ──
     opts.isInternal(addr)  우리 쪽 주소인가 (푸른 직원·우리 메일함)
     opts.resolve(addr)     {co:'업체이름'|'', owner:'푸른 담당자 이름'|'', subs:['부담당',…]}
     opts.now               생성 시각(ms) */
  function build(rows, opts) {
    opts = opts || {};
    var isInternal = opts.isInternal || function () { return false; };
    var memo = {};
    var resolve = function (a) {
      if (!memo[a]) {
        var r = {};
        try { r = (opts.resolve && opts.resolve(a)) || {}; } catch (_) { r = {}; }
        memo[a] = { co: one(r.co), owner: one(r.owner), subs: Array.isArray(r.subs) ? r.subs.map(one).filter(Boolean) : [] };
      }
      return memo[a];
    };
    var items = toItems(rows);
    var cos = {}, people = {}, internalOnly = 0, total = 0;

    items.forEach(function (r) {
      var from = addrOf(r.e);
      var out = isInternal(from);                         /* 보낸 사람이 우리 쪽이면 «보냄» */
      var peers = [];
      if (out) {
        String(r.t || '').split(',').forEach(function (x, i) {
          var a = addrOf(x);
          if (a && !isInternal(a)) peers.push({ e: a, n: i === 0 ? one(r.tn) : '' });
        });
      } else if (from) {
        peers.push({ e: from, n: one(r.f) });
      }
      total++;
      if (!peers.length) { internalOnly++; return; }
      var rec = {
        d: Number(r.d) || 0, out: out, subject: one(r.s) || '(제목 없음)',
        att: Number(r.a) || 0, names: Array.isArray(r.an) ? r.an.map(one).filter(Boolean) : [],
        folder: one(r.folder)
      };
      var coHit = {};
      peers.forEach(function (p) {
        var res = resolve(p.e);
        var co = res.co || NO_CO;
        var pe = people[p.e] || (people[p.e] = { e: p.e, names: {}, co: '', owner: '', mails: [] });
        if (p.n && p.n !== p.e) pe.names[p.n] = (pe.names[p.n] || 0) + 1;
        if (res.co) pe.co = res.co;
        if (res.owner) pe.owner = res.owner;
        pe.mails.push(rec);
        var c = cos[co] || (cos[co] = { name: co, owners: {}, subs: {}, people: {}, mails: [], known: !!res.co });
        if (res.owner) c.owners[res.owner] = (c.owners[res.owner] || 0) + 1;
        res.subs.forEach(function (s) { c.subs[s] = 1; });
        c.people[p.e] = (c.people[p.e] || 0) + 1;
        if (!coHit[co]) { coHit[co] = 1; c.mails.push({ rec: rec, peers: peers }); }
      });
    });

    /* 이름표 — 파일 이름은 한 번에 정해 두고 링크가 그것을 그대로 쓴다(어긋나면 그래프가 안 이어진다) */
    var nameCo = namer(), nameP = namer(), nameO = namer();
    var coFile = {}, ownerFile = {}, pFile = {};
    Object.keys(cos).sort().forEach(function (k) { coFile[k] = nameCo(safeName(k)); });
    function top(map) {
      var best = '', n = 0;
      Object.keys(map).forEach(function (k) { if (map[k] > n) { best = k; n = map[k]; } });
      return best;
    }
    Object.keys(cos).forEach(function (k) { cos[k].owner = top(cos[k].owners) || NO_OWNER; });
    var ownerNames = {};
    Object.keys(cos).forEach(function (k) { ownerNames[cos[k].owner] = 1; });
    Object.keys(people).forEach(function (a) { if (people[a].owner) ownerNames[people[a].owner] = 1; });
    Object.keys(ownerNames).sort().forEach(function (o) { ownerFile[o] = nameO(safeName(o)); });

    /* 사람 장을 만들 주소 — 업체를 찾은 주소 + 업체를 못 찾았어도 3통 이상 오간 주소 */
    var personKeys = Object.keys(people).filter(function (a) {
      return people[a].co || people[a].mails.length >= UNCO_PERSON_MIN;
    }).sort();
    personKeys.forEach(function (a) {
      var nm = top(people[a].names) || a;
      people[a].name = nm;
      pFile[a] = nameP(safeName(nm === a ? a : nm + ' (' + a + ')', 100));
    });
    function personLink(a) {
      if (!pFile[a]) return a;                       /* 장이 없는 주소는 글자만 — 끊긴 링크를 만들지 않는다 */
      return link(SUB.person, pFile[a], people[a].name === a ? a : people[a].name);
    }

    var files = {};
    var stamp = opts.now ? kst(opts.now) : '';
    var AUTO = '> 자동 생성(푸른 메일 → 옵시디언). **다시 내보내면 이 파일은 덮입니다 — 손으로 쓴 메모는 `' + ROOT_DIR + '/` 밖에 두세요.** 본문·첨부 파일은 담지 않았습니다.';

    function dateRange(list) {
      var ds = list.map(function (m) { return m.rec ? m.rec.d : m.d; }).filter(Boolean).sort();
      return ds.length ? [kst(ds[0]), kst(ds[ds.length - 1])] : ['', ''];
    }
    function counts(list) {
      var o = 0, i = 0;
      list.forEach(function (m) { (m.rec ? m.rec.out : m.out) ? o++ : i++; });
      return { in: i, out: o };
    }
    function attText(rec) {
      if (!rec.att && !rec.names.length) return '';
      var s = '📎' + (rec.att || rec.names.length);
      if (rec.names.length) s += ' ' + rec.names.join(', ');
      return cell(s, 70);
    }

    /* ── 기업 장 ── */
    Object.keys(cos).forEach(function (k) {
      var c = cos[k];
      var list = c.mails.slice().sort(function (a, b) { return b.rec.d - a.rec.d; });
      var cap = k === NO_CO ? UNCO_ROWS_MAX : CO_ROWS_MAX;
      var shown = list.slice(0, cap);
      var cnt = counts(list), rg = dateRange(list);
      var ppl = Object.keys(c.people).sort(function (a, b) { return c.people[b] - c.people[a]; }).slice(0, 20);
      var L = [
        '---', 'type: 메일-기업', 'company: ' + yq(k), 'owner: ' + yq(c.owner),
        'mails: ' + list.length, 'first: ' + rg[0], 'last: ' + rg[1],
        'tags: [메일, 메일/기업]', '---', '',
        '# ' + (k === NO_CO ? '업체를 못 찾은 메일' : k + ' — 오간 메일'), '', AUTO, ''
      ];
      if (k === NO_CO) L.push('> 푸른이알피·기업정보함·자문사 연결에서 업체를 못 찾은 주소입니다. 업체를 이으면 다음 내보내기부터 해당 업체 장으로 갑니다.', '');
      L.push('- 푸른 담당자: ' + (c.owner === NO_OWNER ? NO_OWNER : link(SUB.owner, ownerFile[c.owner], c.owner)) +
        (Object.keys(c.subs).length ? ' · 부담당 ' + Object.keys(c.subs).sort().join(', ') : ''));
      L.push('- 오간 메일: ' + list.length + '통 (받음 ' + cnt.in + ' · 보냄 ' + cnt.out + ')' + (rg[0] ? ' · ' + rg[0] + ' ~ ' + rg[1] : ''));
      L.push('- 오간 사람: ' + (ppl.map(personLink).join(' · ') || '없음'), '');
      L.push('## 메일 목록' + (list.length > shown.length ? ' (최근 ' + shown.length + '통만 — 나머지는 메일함에서)' : ''), '',
        '| 날짜 | 방향 | 상대 | 제목 | 첨부 | 폴더 |', '|---|---|---|---|---|---|');
      shown.forEach(function (m) {
        var who = m.peers.map(function (p) { return (people[p.e] && people[p.e].name) || p.n || p.e; });
        var peerText = who.slice(0, 2).join(', ') + (who.length > 2 ? ' 외 ' + (who.length - 2) : '');
        L.push('| ' + kst(m.rec.d) + ' | ' + (m.rec.out ? '보냄 →' : '← 받음') + ' | ' + cell(peerText, 40) + ' | ' +
          cell(m.rec.subject, 90) + ' | ' + attText(m.rec) + ' | ' + cell(m.rec.folder, 20) + ' |');
      });
      files[ROOT_DIR + '/' + SUB.co + '/' + coFile[k] + '.md'] = L.join('\n') + '\n';
    });

    /* ── 사람 장 ── */
    personKeys.forEach(function (a) {
      var p = people[a];
      var list = p.mails.slice().sort(function (x, y) { return y.d - x.d; });
      var cnt = counts(list), rg = dateRange(list);
      var L = [
        '---', 'type: 메일-사람', 'name: ' + yq(p.name), 'address: ' + yq(a), 'company: ' + yq(p.co || NO_CO),
        'owner: ' + yq(p.owner || NO_OWNER), 'mails: ' + list.length, 'last: ' + rg[1],
        'tags: [메일, 메일/사람]', '---', '', '# ' + p.name, '', AUTO, '',
        '- 주소: ' + a,
        '- 소속: ' + (p.co ? link(SUB.co, coFile[p.co], p.co) : link(SUB.co, coFile[NO_CO] || safeName(NO_CO), NO_CO)),
        '- 푸른 담당자: ' + (p.owner ? link(SUB.owner, ownerFile[p.owner], p.owner) : NO_OWNER),
        '- 오간 메일: ' + list.length + '통 (받음 ' + cnt.in + ' · 보냄 ' + cnt.out + ')' + (rg[0] ? ' · ' + rg[0] + ' ~ ' + rg[1] : ''), '',
        '## 최근 메일' + (list.length > PERSON_ROWS_MAX ? ' (최근 ' + PERSON_ROWS_MAX + '통)' : ''), '',
        '| 날짜 | 방향 | 제목 | 첨부 |', '|---|---|---|---|'
      ];
      list.slice(0, PERSON_ROWS_MAX).forEach(function (m) {
        L.push('| ' + kst(m.d) + ' | ' + (m.out ? '보냄 →' : '← 받음') + ' | ' + cell(m.subject, 90) + ' | ' + attText(m) + ' |');
      });
      files[ROOT_DIR + '/' + SUB.person + '/' + pFile[a] + '.md'] = L.join('\n') + '\n';
    });

    /* ── 푸른 담당자 장 ── */
    Object.keys(ownerFile).forEach(function (o) {
      var mine = Object.keys(cos).filter(function (k) { return cos[k].owner === o && k !== NO_CO; })
        .sort(function (a, b) { return cos[b].mails.length - cos[a].mails.length; });
      var all = [];
      mine.forEach(function (k) { cos[k].mails.forEach(function (m) { all.push({ k: k, rec: m.rec }); }); });
      all.sort(function (a, b) { return b.rec.d - a.rec.d; });
      var L = [
        '---', 'type: 메일-담당자', 'owner: ' + yq(o), 'companies: ' + mine.length, 'mails: ' + all.length,
        'tags: [메일, 메일/담당자]', '---', '', '# ' + o + ' — 담당 업체 메일', '', AUTO, ''
      ];
      if (o === NO_OWNER) L.push('> 담당자를 못 찾은 업체입니다. 푸른이알피에서 담당자를 지정하거나 메일함의 «자문사 이메일 잇기»로 이으면 다음 내보내기부터 담당자 장으로 갑니다.', '');
      L.push('- 담당 업체 ' + mine.length + '곳 · 오간 메일 ' + all.length + '통', '', '## 담당 업체', '', '| 업체 | 메일 | 최근 |', '|---|---|---|');
      mine.forEach(function (k) {
        var rg = dateRange(cos[k].mails);
        L.push('| ' + link(SUB.co, coFile[k], k) + ' | ' + cos[k].mails.length + ' | ' + rg[1] + ' |');
      });
      L.push('', '## 최근 메일 20통', '', '| 날짜 | 업체 | 방향 | 제목 |', '|---|---|---|---|');
      all.slice(0, 20).forEach(function (m) {
        L.push('| ' + kst(m.rec.d) + ' | ' + link(SUB.co, coFile[m.k], m.k) + ' | ' + (m.rec.out ? '보냄 →' : '← 받음') + ' | ' + cell(m.rec.subject, 80) + ' |');
      });
      files[ROOT_DIR + '/' + SUB.owner + '/' + ownerFile[o] + '.md'] = L.join('\n') + '\n';
    });

    /* ── 개요 ── */
    var known = Object.keys(cos).filter(function (k) { return k !== NO_CO; });
    var unC = cos[NO_CO] ? cos[NO_CO].mails.length : 0;
    var topUn = Object.keys(people).filter(function (a) { return !people[a].co; })
      .sort(function (a, b) { return people[b].mails.length - people[a].mails.length; }).slice(0, 30);
    var O = [
      '---', 'type: 메일-개요', 'generated: ' + stamp, 'tags: [메일]', '---', '', '# 메일 정리 개요', '', AUTO, '',
      '- 내보낸 시각: ' + stamp,
      '- 메일 ' + total + '통 (우리 쪽끼리 오간 ' + internalOnly + '통 제외 ' + (total - internalOnly) + '통)',
      '- 업체 ' + known.length + '곳 · 업체를 못 찾은 메일 ' + unC + '통 · 사람 장 ' + personKeys.length + '개',
      '- 업체를 못 찾은 주소는 3통 이상 오간 것만 사람 장을 만듭니다(광고·스팸 한 통짜리로 파일이 불지 않게).', '',
      '## 담당자별', '', '| 담당자 | 업체 | 메일 |', '|---|---|---|'
    ];
    Object.keys(ownerFile).sort().forEach(function (o) {
      var ks = Object.keys(cos).filter(function (k) { return cos[k].owner === o && k !== NO_CO; });
      var n = 0; ks.forEach(function (k) { n += cos[k].mails.length; });
      O.push('| ' + (o === NO_OWNER ? NO_OWNER : link(SUB.owner, ownerFile[o], o)) + ' | ' + ks.length + ' | ' + n + ' |');
    });
    if (topUn.length) {
      O.push('', '## 업체를 못 찾은 주소 (많이 오간 순 30개) — 이을 업체를 정해 주세요', '');
      topUn.forEach(function (a) { O.push('- ' + personLink(a) + ' · ' + people[a].mails.length + '통'); });
    }
    files[ROOT_DIR + '/개요.md'] = O.join('\n') + '\n';

    return { files: files, stats: { total: total, internalOnly: internalOnly, companies: known.length, unclassified: unC, people: personKeys.length, owners: Object.keys(ownerFile).length } };
  }

  /* ── 폴더에 쓰기 (크롬·엣지의 File System Access) ──
     폴더 손잡이는 work.html 의 «옵시디언 내보내기»와 «같은 자리»에 기억해 한 번만 고른다(같은 보관함).
     ⚠ IndexedDB 에 넣는 것은 손잡이뿐이고 메일 내용은 안 들어간다. */
  function supported() { return typeof root.showDirectoryPicker === 'function'; }
  function idb() {
    return new Promise(function (res, rej) {
      var q = root.indexedDB.open('work_obsidian', 1);
      q.onupgradeneeded = function (e) { e.target.result.createObjectStore('h', { keyPath: 'k' }); };
      q.onsuccess = function (e) { res(e.target.result); };
      q.onerror = function () { rej(q.error); };
    });
  }
  function getVault() {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var q = db.transaction('h', 'readonly').objectStore('h').get('vault');
        q.onsuccess = function () { res(q.result ? q.result.h : null); };
        q.onerror = function () { res(null); };
      });
    }).catch(function () { return null; });
  }
  function putVault(h) {
    return idb().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction('h', 'readwrite'); tx.objectStore('h').put({ k: 'vault', h: h });
        tx.oncomplete = function () { res(true); }; tx.onerror = function () { res(false); };
      });
    }).catch(function () { return false; });
  }
  /* 허락 — 다시 묻는 것은 «사람이 누른 순간»에만 된다(단추 안에서 부른다) */
  function permit(h) {
    if (!h || !h.queryPermission) return Promise.resolve(false);
    return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
      if (p === 'granted') return true;
      return h.requestPermission({ mode: 'readwrite' }).then(function (p2) { return p2 === 'granted'; });
    }).catch(function () { return false; });
  }
  function pickVault() {
    return getVault().then(function (h) {
      return permit(h).then(function (ok) {
        if (ok) return h;
        return root.showDirectoryPicker({ id: 'work-obsidian', mode: 'readwrite' }).then(function (nh) {
          return putVault(nh).then(function () { return nh; });
        });
      });
    });
  }
  /* 마지막 문지기 — 나가는 글자는 모두 여기를 지난다. 지우개가 없으면 던진다. */
  function scrub(text) {
    var M = root.PuRrnMask;
    if (!M || !M.maskRrnInText) throw new Error('주민번호 지우개(js/pu-rrn-mask.js)가 이 화면에 실려 있지 않습니다 — 그대로 내보내면 주민번호가 파일로 나갑니다');
    return M.maskRrnInText(String(text == null ? '' : text)).text;
  }
  function dirOf(vault, parts, cache) {
    var key = parts.join('/');
    if (cache[key]) return Promise.resolve(cache[key]);
    var p = Promise.resolve(vault);
    parts.forEach(function (name) { p = p.then(function (d) { return d.getDirectoryHandle(name, { create: true }); }); });
    return p.then(function (d) { cache[key] = d; return d; });
  }
  function writeFiles(vault, files, onProgress) {
    var paths = Object.keys(files), i = 0, cache = {};
    return Promise.resolve().then(function () {
      paths.forEach(function (p) { scrub(files[p]); });      /* 지우개가 없으면 «하나도 쓰기 전에» 멈춘다 */
    }).then(function () { return new Promise(function (resolve, reject) {
      (function next() {
        if (i >= paths.length) return resolve(paths.length);
        var path = paths[i++], parts = path.split('/'), name = parts.pop();
        dirOf(vault, parts, cache)
          .then(function (d) { return d.getFileHandle(name, { create: true }); })
          .then(function (fh) { return fh.createWritable(); })
          .then(function (w) { return Promise.resolve(w.write(scrub(files[path]))).then(function () { return w.close(); }); })
          .then(function () { if (onProgress && (i % 25 === 0 || i === paths.length)) onProgress(i, paths.length); next(); })
          .catch(reject);
      })();
    }); });
  }

  root.PuMailObsidian = {
    ROOT_DIR: ROOT_DIR, NO_CO: NO_CO, NO_OWNER: NO_OWNER,
    safeName: safeName, build: build, supported: supported,
    pickVault: pickVault, writeFiles: writeFiles, scrub: scrub
  };
})(typeof window !== 'undefined' ? window : globalThis);
