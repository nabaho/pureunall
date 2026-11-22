/* 📇 리멤버 → 푸른사진첩·기업정보함 — 계산 층 (대표 「반드시 자동으로」 2026-10-24, 목업 승인)
   ═══════════════════════════════════════════════════════════════════════════
   리멤버 웹이 스스로 부르는 명함 목록(api.rememberapp.co.kr/v2/stacks/list.json, snake_case)을
   기업정보함 «명함» 칸과 사진첩 «판독 결과»로 바꾸고, 지난번 어디까지 받았는지(cp, 수정 시각)로 새것을 가른다.
   브라우저·노드 둘 다에서 돈다 — 검사(tests/remember-auto.test.js)가 이 파일을 그대로 부른다.

   ★ 옛 명함은 이미 다 들어와 있다(대표 10/24) — 첫 회차는 «기준(cp)»만 잡고 아무것도 넣지 않는다.
   ★ 리멤버 쪽은 읽기만 한다. 우리 쪽도 지우지 않는다.
   ⚠ 사람 이름·회사는 리멤버가 준 그대로 — 고치지 않는다(전화번호 모양만 맞춘다). */
(function (root) {
  'use strict';

  function s(v) { return String(v == null ? '' : v).trim(); }
  function digits(v) { return s(v).replace(/\D/g, ''); }

  /* 전화 모양 — 국내 번호를 기업정보함이 쓰는 꼴(010-1234-5678 · 041-123-4567 · 02-123-4567)로 */
  function phone(o) {
    if (!o) return '';
    var raw = s(o.national_number || o.nationalNumber || o.normalized_number || o.normalizedNumber);
    var d = digits(raw);
    if (/^82/.test(d) && d.length >= 11) d = '0' + d.slice(2);
    if (!d) return '';
    if (/^02/.test(d)) return d.length === 9 ? d.replace(/^(02)(\d{3})(\d{4})$/, '$1-$2-$3') : d.replace(/^(02)(\d{4})(\d{4})$/, '$1-$2-$3');
    if (d.length === 11) return d.replace(/^(\d{3})(\d{4})(\d{4})$/, '$1-$2-$3');
    if (d.length === 10) return d.replace(/^(\d{3})(\d{3})(\d{4})$/, '$1-$2-$3');
    if (d.length === 8) return d.replace(/^(\d{4})(\d{4})$/, '$1-$2');
    return raw;
  }

  /* 리멤버 명함 묶음(stack) 하나 → 평평한 명함 */
  function fromApi(st) {
    var mc = (st && st.main_card) || {};
    var d = ((mc.data || {})['default']) || {};
    var nm = d.name || {};
    var first = s(nm.first), last = s(nm.last);
    /* 한글 이름은 성+이름을 붙인다(홍 + 길동 → 홍길동). 로마자는 띄운다 */
    var name = /[가-힣]/.test(first + last) ? (last + first) : [first, last].filter(Boolean).join(' ');
    var ad = d.address || {};
    var img = mc.image || {};
    var pic = function (o) { return (!o || o.empty) ? '' : s(o.original || o.preview); };
    var t1 = Date.parse(st && st.updated_at) || 0, t2 = Date.parse(mc.updated_at) || 0;
    return {
      rid: s(st && st.id), cid: s(mc.id),
      createdAt: s((st && st.created_at) || mc.created_at),
      requestedAt: s(mc.requested_at),
      updatedAt: Math.max(t1, t2) || 0,
      name: name, company: s(d.company), dept: s(d.department), title: s(d.position),
      mobile: phone(d.mobile), tel: phone(d.tel), fax: phone(d.fax),
      email: s(d.email), address: [s(ad['default']), s(ad.detail)].filter(Boolean).join(' '),
      front: pic(img.front), back: pic(img.back)
    };
  }

  /* 기업정보함 «명함» 칸 (PuDocRead.mapTo('cards','card') 가 아는 이름) — 빈 칸은 안 담는다 */
  function toFields(c) {
    var f = {};
    ['name', 'company', 'dept', 'title', 'mobile', 'tel', 'fax', 'email', 'address'].forEach(function (k) { if (c && s(c[k])) f[k] = s(c[k]); });
    return f;
  }

  /* 사진첩 «판독 결과» — 리멤버가 이미 읽어 준 것이라 다시 판독하지 않게 적어 둔다 */
  function readOf(c, now, by) {
    return { kind: 'card', fields: toFields(c), auto: false, via: 'remember', rid: s(c && c.rid),
      at: now || Date.now(), ack: { at: now || Date.now(), by: s(by) || '리멤버' } };
  }

  /* 이번에 다룰 명함 — cp(지난번 가장 늦은 수정 시각) 뒤에 바뀐 것만, 오래된 것부터.
     첫 회차(cp 없음)는 아무것도 다루지 않고 기준만 잡는다 — 옛 명함은 이미 다 들어와 있다. */
  function plan(cards, cp) {
    var list = (cards || []).filter(function (c) { return c && c.rid && c.updatedAt; });
    var top = list.reduce(function (m, c) { return Math.max(m, c.updatedAt); }, Number(cp) || 0);
    if (!cp) return { first: true, todo: [], cp: top };
    var todo = list.filter(function (c) { return c.updatedAt > Number(cp); })
      .sort(function (a, b) { return a.updatedAt - b.updatedAt; });
    /* 같은 묶음 번호가 두 번 오면(쪽이 밀려서) 한 번만 */
    var seen = {};
    todo = todo.filter(function (c) { if (seen[c.rid]) return false; seen[c.rid] = 1; return true; });
    return { first: false, todo: todo, cp: top };
  }

  /* 사진을 새로 올릴까 — 이 명함으로 사진을 «한 번도» 올린 적이 없을 때만.
     ★ 이미 한 번 가져온 명함은 그림이 바뀌어도(수정·서명 주소 변경) 새 사진을 쌓지 않는다 — 대표 지시 2026-11-18
       「이미 한번 가져왔던 것은 자동으로 차단해서 안 가지고 오게 해라」(예전에는 «그림이 바뀌면» 새로 올렸다). */
  function needPhoto(c, seen) {
    if (!c || !c.front) return false;
    return !(seen && seen.photo);
  }

  /* 리멤버 그림 주소는 이 집 것만 받는다 — 아무 주소나 내려받지 않게 */
  function okImageUrl(u) { return /^https:\/\/remember-cdn\.rememberapp\.co\.kr\/[^\s"'<>]+$/.test(s(u)); }

  /* ══ 한 번 가져온 것은 무조건 막는다 (대표 지시 2026-11-18) ══════════════════════════════
     「리멤버에서 가지고 오더라도 중복 명함·서류는 안 된다. 이미 한 번 가져왔던 것은 자동으로 차단」
     중복이 생기던 길 셋:
       ① 같은 묶음(rid)을 두 곳(탭·브라우저·한 탭의 두 일꾼)이 «동시에» 처리 — 읽고(seen) → 올리고 → 적는(seen) 사이가 비어 있었다
       ② 리멤버에 «같은 명함이 두 묶음(rid)» 으로 있다 — rid 가 달라 «처음 보는 명함»으로 읽혔다
       ③ 같은 그림이 다시 오거나 그림이 바뀌어 또 쌓였다
     막는 방법 — 모두 «같은 사람(이름) 잠금» 안에서 읽고 쓰므로 틈이 없다:
       · seen/{rid}   — 이 묶음으로 사진을 한 번 올렸으면 다시 안 올린다(그림이 바뀌어도)
       · pk/{사람 열쇠} — 같은 사람(휴대폰, 또는 이름+회사)이 이미 들어왔으면 사진을 안 올린다
       · fp/{그림 지문} — 같은 그림(SHA-256)이 이미 들어왔으면 사진을 안 올린다
     ⚠ 지우지 않는다 — 막으면 «올리지 않고» 결과 줄에 까닭만 적는다(사진첩 자동 삭제 금지 규칙).
     ⚠ 기업정보함(sendToCards)은 «항상» 부른다 — 사람이 같으면 빈 칸만 채우고, 거기서도 사람별 잠금이 중복을 막는다. */
  function nameKey(v) { return s(v).replace(/[\s·.,()（）\-]/g, '').toLowerCase(); }
  function coKey(v) {
    return s(v).replace(/\(주\)|㈜|주식회사|\(유\)|유한회사|\(사\)|사단법인|\(재\)|재단법인/g, '')
      .replace(/[\s·.,()（）\-]/g, '').toLowerCase();
  }
  function hash(text) {
    var t = String(text == null ? '' : text), a = 5381, b = 52711;
    for (var i = 0; i < t.length; i++) { var ch = t.charCodeAt(i); a = ((a * 33) ^ ch) >>> 0; b = ((b * 33) ^ ch) >>> 0; }
    return a.toString(36) + b.toString(36);
  }
  /* 같은 사람 열쇠 — 휴대폰이 있으면 휴대폰이 사람을 가른다. 이름+회사는 «둘째 열쇠»(번호가 한쪽에 없을 때를 위해) */
  function cardKeys(c) {
    var out = [];
    var m = digits(c && c.mobile);
    if (m.length >= 8) out.push({ k: 'm' + m, m: m, t: '' });
    var nk = nameKey(c && c.name), ck = coKey(c && c.company);
    if (nk && ck) out.push({ k: 'n' + hash(nk + '|' + ck), m: m, t: nk + '|' + ck, soft: true });
    return out;
  }
  var IMG_OK = /^data:image\/(jpeg|png|webp);base64,/;

  /* 명함 한 장 가져오기. d = { db, ROOT, withLock(path, fn), sha(dataUrl)→Promise<hex>, addPhoto(dataUrl)→Promise<{photo, pic}>,
                              sendToCards(o)→Promise }  — 화면(remember-intake.html)이 부품을 끼워 넣는다.
     돌려주는 것: { name, company, what, at, isNew, err } */
  /* 잠금 열쇠 — 기업정보함 보내기의 열쇠(PuDocFile.lockKeyOf)와 «같은 차례»: 이름 → 휴대폰 → 회사 → 묶음 번호.
     (이름이 비었다고 곧바로 묶음 번호로 가면, 번호·회사만 있는 같은 명함이 두 묶음으로 동시에 올 때 서로를 못 막는다 — 2026-11-18 검토 지적) */
  function lockKeyFor(c) {
    var nk = nameKey(c && c.name); if (nk) return 'n' + hash(nk);
    var m = digits(c && c.mobile); if (m) return 'm' + m;
    var ck = coKey(c && c.company); if (ck) return 'c' + hash(ck);
    return 'r' + hash(c && c.rid);
  }
  /* 바깥 잠금(이 계산) 안에서 안쪽 잠금(기업정보함 보내기, 최대 70초 기다림)과 사진 올리기를 한다 — 바깥 TTL 이 그보다 «길어야»
     안쪽을 기다리는 동안 바깥이 먼저 풀려 다른 곳이 끼어들지 않는다(기본 TTL 40초로는 모자란다 — 2026-11-18 검토 지적) */
  var LOCK_TTL_MS = 150000;

  function importOne(d, c, img, now) {
    var db = d.db, ROOT = d.ROOT;
    var lockKey = lockKeyFor(c);                                    /* 같은 사람은 «한 번에 한 곳만»(묶음 번호가 달라도) */
    return d.withLock(ROOT + '/lock/' + lockKey, function () {
      var seenRef = db.ref(ROOT + '/seen/' + c.rid);
      return seenRef.once('value').then(function (snap) {
        var seen = snap.val();
        var photo = seen && seen.photo ? seen.photo : null;
        var pic = null, why = '';
        var want = needPhoto(c, seen) && IMG_OK.test(String(img || ''));

        function dupClaim() {
          var keys = cardKeys(c);
          return Promise.all(keys.map(function (k) { return db.ref(ROOT + '/pk/' + k.k).once('value'); })).then(function (snaps) {
            for (var i = 0; i < keys.length; i++) {
              var rec = snaps[i].val();
              if (!rec) continue;
              if (keys[i].soft) {
                if (rec.t !== keys[i].t) continue;                                    /* 해시가 부딪힌 다른 사람 */
                if (keys[i].m && rec.m && keys[i].m !== rec.m) continue;              /* 둘 다 번호가 있는데 다르면 다른 사람 */
              }
              return rec;
            }
            return null;
          });
        }
        function decide() {
          if (!want) return Promise.resolve({ add: false, why: seen && seen.photo ? '이미 가져온 명함' : '' });
          return Promise.all([d.sha(img), dupClaim()]).then(function (g) {
            return db.ref(ROOT + '/fp/' + g[0]).once('value').then(function (f) {
              if (f.val()) return { add: false, why: '같은 그림 — 이미 가져옴', sha: g[0] };
              if (g[1]) return { add: false, why: '같은 명함 — 이미 가져옴', sha: g[0] };
              return { add: true, sha: g[0] };
            });
          });
        }
        function recordClaims(sha) {
          var u = {};
          u[ROOT + '/fp/' + sha] = { rid: c.rid, at: now, photo: photo };
          cardKeys(c).forEach(function (k) { u[ROOT + '/pk/' + k.k] = { rid: c.rid, m: k.m || '', t: k.t || '', at: now, photo: photo }; });
          /* 못 적어도 던지지 않는다 — 사진은 이미 올랐고 seen/{rid} 가 «이 묶음은 한 번 올렸다»를 지킨다 */
          return db.ref().update(u).catch(function () {});
        }

        return decide().then(function (dec) {
          why = dec.why || '';
          var step = dec.add
            ? d.addPhoto(img).then(function (r) { photo = r.photo; pic = r.pic; return recordClaims(dec.sha); })
            : Promise.resolve();
          return step.then(function () {
            var fields = toFields(c);
            if (!fields.name && !fields.company) return { what: '📇 이름·회사 없음 — 건너뜀' };
            return d.sendToCards({ kind: 'card', fields: fields, takenAt: Date.parse(c.createdAt) || now, byName: '리멤버',
              photoId: photo ? photo.id : '', photoYear: photo ? photo.year : '', photoOwner: photo ? photo.owner : '',
              full: pic ? pic.full : '', thumb: pic ? pic.thumb : '' })
              .then(function (r) {
                var filled = r && r.filled && r.filled.length;
                var what = r && r.created ? '📇 새로 넣음' : (filled ? '📇 빈 칸 채움' : '📇 이미 있음');
                var short = why.replace(/ — 이미 가져옴$/, '');
                /* 사진을 안 올린 까닭은 결과 줄에 «꼭» 남긴다 — 조용히 건너뛰면 왜 사진이 없는지 알 길이 없다 */
                if (why) what = (r && r.created) ? what + ' · 사진 안 넣음(' + short + ')' : '📇 ' + short + ' — 안 가져옴' + (filled ? ' · 빈 칸만 채움' : '');
                return { what: what, id: r && r.id };
              }, function (e) { return { what: '📇 못 넣음: ' + String((e && e.message) || e).slice(0, 40), err: true }; });
          });
        }).then(function (res) {
          var rec = { u: c.updatedAt, at: now, card: res.id || '' };
          if (c.front) rec.front = String(c.front).split('?')[0];
          if (photo) rec.photo = photo;
          if (why && !photo) rec.dup = why;
          return seenRef.set(rec).then(function () { return { name: c.name, company: c.company, what: res.what, at: now, isNew: !seen, err: !!res.err }; });
        });
      });
    }, { ttl: LOCK_TTL_MS });
  }

  var api = { phone: phone, fromApi: fromApi, toFields: toFields, readOf: readOf, plan: plan, needPhoto: needPhoto, okImageUrl: okImageUrl,
    cardKeys: cardKeys, importOne: importOne, nameKey: nameKey, coKey: coKey, hash: hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PuRemember = api;
})(typeof window !== 'undefined' ? window : globalThis);
