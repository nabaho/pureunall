#!/usr/bin/env node
/* 파이어베이스 «규칙 배포» — 손으로 붙여넣지 않는다 (대표 지시 2026-09-03)
   「파이어베이스에 매번 내가 이렇게 반복하는것 너무 귀찮은데
     니가 연결하고 내가 확인해서 승인하는 방식을 만들 수 없나?」

   ■ 쓰는 법
       node scripts/rules-deploy.js            보여만 준다 (아무것도 안 바꾼다)
       node scripts/rules-deploy.js --deploy   실제로 올린다

   ■ 무엇을 지키나
     ⚠ 규칙은 «한 번 잘못 올리면 전부가 바뀐다». 그래서 올리기 전에 반드시
       «지금 콘솔에 있는 것»과 견주어, 사라질 것이 하나라도 있으면 «멈춘다».
       다른 세션이나 다른 사람이 콘솔에서 직접 더한 규칙을 내 파일이 모른 채 덮는 것이
       가장 위험하다 — 그것 하나를 막기 위해 이 조심이 있다.

   ■ 안전장치 넷 (2026-09-13 에 ②③④ 를 더했다)
     ① 사라지는 규칙이 있으면 멈춘다.
     ② ★ «헐거워지는» 고침은 따로 갈라 멈춘다 — 사라지는 것만 보면, 권한이 «넓어지는»
       고침이 긴 목록에 한 줄로 흘러간다. 사람은 긴 목록을 안 읽는다.
       뜻이 있어 넓히는 것이면 docs/firebase-rules-헐거워짐-승인.txt 에 적는다.
     ③ ★ 올린 뒤 «다시 읽어» 정말 그대로인지 확인한다. 맞을 때만 새 기준을 남긴다.
     ④ ★ 콘솔을 못 읽었으면 «올리지 않는다». 낡은 사본과 견주고 올리면 그 사이
       손으로 고친 것을 조용히 덮는다. 보여주기(미리보기)는 사본으로도 한다.

     ⚠ --force 같은 우회로를 만들지 말 것. 막히면 만들개(make-firebase-rules.js)를
       고치거나, 넓히는 뜻이면 승인 파일에 «옛 몸과 새 몸을 그대로» 적는다.

   ■ 왜 루트 firebase.json 을 안 건드리나
     거기에 database 를 넣으면 다른 세션이 `firebase deploy` 를 할 때 규칙까지 함께 나간다.
     그래서 규칙 전용 설정(firebase.database.json)을 따로 두고 --config 로 가리킨다. */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const GEN = path.join(ROOT, 'scripts', 'make-firebase-rules.js');
const OUT = path.join(ROOT, 'docs', 'rules-paste.json');
const ALT = path.join(ROOT, 'docs', 'firebase-rules-전체-적용본.json');
const DOCS = path.join(ROOT, 'docs');
const 승인길 = path.join(ROOT, 'docs', 'firebase-rules-헐거워짐-승인.txt');
const PROJECT = 'pureun-erp';
const INSTANCE = 'pureun-erp-default-rtdb';   /* asia-southeast1 — 앱의 databaseURL 과 같아야 한다 */
const DEPLOY = process.argv.indexOf('--deploy') >= 0;

/* ── ★ 기준은 «살아 있는 콘솔» 이다 (2026-09-03) ──
   `firebase database:get /.settings/rules` 로 콘솔의 지금 규칙을 그대로 읽는다.
   ⚠ shell:true 로 부른다 — Windows 에서 firebase 는 .cmd 다. cmd.exe 를 거치므로
     Git Bash 의 경로 변환(/.settings → C:/Program Files/...)에 걸리지 않는다.

   ★ 못 읽었을 때 «왜» 못 읽었는지까지 돌려준다 (2026-09-13).
     종전에는 모든 오류를 한 덩이로 삼켜서, 열쇠가 만료된 것과 잠깐 끊긴 것이
     화면에서 똑같아 보였다. 그러면 낡은 사본과 견주고도 그런 줄을 모른다. */
function 까닭가리기(말) {
  const s = String(말 == null ? '' : 말);
  if (/not logged in|no currently logged|Authentication Error|requires authentication|Failed to authenticate|Failed to get Firebase project|reauth|login again/i.test(s)) return '로그인';
  if (/ENOENT|not recognized|is not recognized|command not found/i.test(s)) return '없음';
  if (/PERMISSION_DENIED|permission denied|403|HTTP Error: 403/i.test(s)) return '권한';
  if (/ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|network|socket hang up/i.test(s)) return '그물';
  return '딴까닭';
}

const 까닭말 = {
  로그인: '파이어베이스 로그인이 풀렸습니다 — `firebase login` 으로 다시 들어가세요.',
  없음: 'firebase 명령을 못 찾았습니다 — `npm i -g firebase-tools` 로 넣으세요.',
  권한: '이 계정에 그 프로젝트를 읽을 권한이 없습니다 — 어느 계정인지 `firebase login:list` 로 보세요.',
  그물: '그물(네트워크)이 닿지 않았습니다 — 잠시 뒤 다시 해 보세요.',
  딴까닭: '까닭을 가리지 못했습니다 — 아래 파이어베이스가 한 말을 보세요.'
};

function readLiveRules() {
  try {
    var out = execFileSync('firebase',
      ['database:get', '/.settings/rules', '--instance', INSTANCE, '--project', PROJECT],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
        shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    if (out.charCodeAt(0) === 0xFEFF) out = out.slice(1);      /* BOM */
    var v = JSON.parse(out);
    return { rules: (v && v.rules) ? v.rules : null, ok: true, 까닭: null, 말: '' };
  } catch (e) {
    const 말 = [e && e.stderr, e && e.stdout, e && e.message]
      .map(function (x) { return String(x == null ? '' : x); }).join('\n').trim();
    return { rules: null, ok: false, 까닭: 까닭가리기(말), 말: 말.slice(0, 600) };
  }
}

/* ── 기준(대체): 마지막으로 콘솔에서 확인한 규칙 ── */
function latestSnapshot() {
  const re = /^firebase-rules-콘솔원문-(\d{4}-\d{2}-\d{2})\.json$/;
  const hits = fs.readdirSync(DOCS)
    .map((f) => ({ f: f, m: re.exec(f) }))
    .filter((x) => x.m)
    .sort((a, b) => (a.m[1] < b.m[1] ? 1 : -1));
  return hits.length ? { file: path.join(DOCS, hits[0].f), date: hits[0].m[1] } : null;
}

/* ── 구조 차이 ── */
function walk(a, b, p, out) {
  const ka = a && typeof a === 'object' ? Object.keys(a) : [];
  const kb = b && typeof b === 'object' ? Object.keys(b) : [];
  ka.filter((k) => kb.indexOf(k) < 0).sort().forEach((k) => out.gone.push(p + '/' + k));
  kb.filter((k) => ka.indexOf(k) < 0).sort().forEach((k) => out.added.push({ p: p + '/' + k, v: b[k] }));
  ka.filter((k) => kb.indexOf(k) >= 0).sort().forEach((k) => {
    const va = a[k], vb = b[k];
    if (va && vb && typeof va === 'object' && typeof vb === 'object') walk(va, vb, p + '/' + k, out);
    else if (JSON.stringify(va) !== JSON.stringify(vb)) out.changed.push({ p: p + '/' + k, a: va, b: vb });
  });
}

/* ══ ② «헐거워졌나» 가리기 ════════════════════════════════════════════
   ⚠ 두 조건 중 어느 쪽이 넓은지를 «일반적으로» 아는 방법은 없다(그걸 풀려면
     조건을 증명해야 한다). 그래서 «확실히 말할 수 있는 것만» 말하고, 나머지는
     「판단못함」이라 적어 사람 눈에 올린다 — 아는 척하지 않는 것이 요점이다.

   ★ 확실한 갈래
     · true 가 되면 넓어진 것이다 (누구나).
     · false 였다가 아니게 되면 넓어진 것이다 (아무도 → 누군가).
     · && 로 이어진 조건이 «빠지면» 넓어진 것이다. «더해지면» 좁아진 것이다.
       (A && B) 는 A 보다 좁다 — 이건 조건 속을 안 봐도 늘 맞다. */
function 조각들(s) {
  const out = [];
  let 깊이 = 0, 이번 = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') 깊이++;
    if (c === ')') 깊이--;
    if (깊이 === 0 && c === '&' && s[i + 1] === '&') { out.push(이번); 이번 = ''; i++; continue; }
    이번 += c;
  }
  out.push(이번);
  return out
    .map(function (x) { return x.trim().replace(/\s+/g, ' ').replace(/^\((.*)\)$/, '$1').trim(); })
    .filter(Boolean);
}

/* 이 자리가 «허락»을 다루는 칸인가 — .indexOn 같은 것은 넓고 좁고가 없다 */
function 허락칸인가(길) {
  const 끝 = String(길 || '').split('/').pop();
  return 끝 === '.read' || 끝 === '.write' || 끝 === '.validate';
}

function 느슨해졌나(옛, 새) {
  if (옛 === 새) return '같음';
  if (새 === true || 새 === 'true') return '헐거워짐';
  if ((옛 === false || 옛 === 'false') && !(새 === false || 새 === 'false')) return '헐거워짐';
  if (새 === false || 새 === 'false') return '조임';
  if ((옛 === true || 옛 === 'true') && !(새 === true || 새 === 'true')) return '조임';
  if (typeof 옛 !== 'string' || typeof 새 !== 'string') return '판단못함';
  const A = 조각들(옛), B = 조각들(새);
  const B가A안에 = B.every(function (x) { return A.indexOf(x) >= 0; });
  const A가B안에 = A.every(function (x) { return B.indexOf(x) >= 0; });
  if (B가A안에 && !A가B안에) return '헐거워짐';   /* 조건이 «빠졌다» */
  if (A가B안에 && !B가A안에) return '조임';       /* 조건이 «더해졌다» */
  return '판단못함';
}

/* 바뀜·새로 생김을 갈래로 나눈다.
   ⚠ «새로 생기는» 칸도 헐거워짐일 수 있다 — 없던 자리는 원래 아무도 못 읽는데,
     `.read: true` 로 태어나면 온 세상에 열린다. 그 하나만 잡는다(새 기능이
     칸을 더하는 것은 흔한 일이라 나머지는 안 막는다). */
function 갈래나누기(out) {
  const 갈래 = { 헐거워짐: [], 조임: [], 판단못함: [], 해당없음: [] };
  (out.changed || []).forEach(function (c) {
    if (!허락칸인가(c.p)) { 갈래.해당없음.push(c); return; }
    const g = 느슨해졌나(c.a, c.b);
    (갈래[g] || 갈래.판단못함).push(c);
  });
  (out.added || []).forEach(function (x) {
    if (!허락칸인가(x.p)) return;
    if (x.v === true || x.v === 'true') 갈래.헐거워짐.push({ p: x.p, a: '(없던 자리 — 아무도 못 읽음)', b: x.v, 새자리: true });
  });
  return 갈래;
}

/* ── 승인 파일 읽기 (창고 쪽과 «같은 모양»으로 적는다) ──
   [/data/companies/.read]
   왜: …
   옛: …
   새: …
   ⚠ 옛·새 «둘 다» 글자까지 맞아야 그 하나만 지나간다. --force 가 아니다. */
function 승인읽기(글) {
  const out = {};
  let 이름 = null;
  String(글 == null ? '' : 글).split(/\r?\n/).forEach(function (l) {
    const t = l.trim();
    if (!t || t.charAt(0) === '#') return;
    const 머리 = /^\[([^\]]+)\]$/.exec(t);
    if (머리) { 이름 = 머리[1].trim(); out[이름] = { 왜: '', 옛: '', 새: '' }; return; }
    if (!이름) return;
    const 칸 = /^(왜|옛|새)\s*:\s*([\s\S]*)$/.exec(t);
    if (칸) out[이름][칸[1]] = 칸[2].replace(/\s+/g, ' ').trim();
  });
  return out;
}

function 고름(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }

/* 헐거워진 것 가운데 «승인되지 않은» 것만 돌려준다 */
function 승인안된것(헐거워짐, 승인) {
  const 표 = 승인 || {};
  return (헐거워짐 || []).filter(function (c) {
    const a = 표[c.p];
    if (!a) return true;
    return 고름(a.옛) !== 고름(c.a) || 고름(a.새) !== 고름(c.b);
  });
}

function 줄여(v, n) { return String(JSON.stringify(v)).slice(0, n || 150); }

/* ── 올려도 되나 — «고르는 자리»를 화면에서 떼어 낸다.
   ⚠ 화면 속에 파묻어 두면 검사가 이 판단을 «정말 돌려» 볼 수가 없어,
     글자가 있나 없나만 세게 된다. 그건 배선이 끊겨도 통과한다. */
function 올리기막을까닭(상태) {
  const s = 상태 || {};
  if (!s.살아있는것을읽었나) {
    return { 코드: 3, 말: '「지금 콘솔에 무엇이 있는지」를 못 읽었습니다' };
  }
  if ((s.못지나갈것 || []).length) {
    return { 코드: 4, 말: '권한이 넓어지는데 승인이 없는 고침 ' + s.못지나갈것.length + '개' };
  }
  return null;
}

/* 올린 뒤 다시 읽은 것이 «올린 것»과 어긋나나 */
function 올린뒤어긋남(확인) {
  const c = 확인 || {};
  return ((c.gone || []).length + (c.added || []).length + (c.changed || []).length) > 0;
}

function main() {
  /* 1) 만들개를 돌려 새 규칙을 만든다 — 손으로 고친 JSON 은 쓰지 않는다 */
  const fresh = execFileSync(process.execPath, [GEN], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const parsed = JSON.parse(fresh);                       /* 깨진 JSON 을 올리지 않는다 */
  fs.writeFileSync(OUT, fresh, 'utf8');
  fs.writeFileSync(ALT, fresh, 'utf8');

  /* ★ 콘솔을 직접 읽는다. 못 읽으면 «왜» 못 읽었는지 크게 말하고 사본으로 물러선다. */
  const live = readLiveRules();
  let base, where;
  const 살아있는것을읽었나 = !!(live.ok && live.rules);
  if (살아있는것을읽었나) {
    base = live.rules;
    where = '살아 있는 콘솔 (지금 규칙을 직접 읽었습니다)';
  } else {
    console.log('');
    console.log('⚠⚠ 살아 있는 콘솔을 «못 읽었습니다» — ' + (까닭말[live.까닭] || live.까닭));
    if (live.말) console.log('   파이어베이스가 한 말: ' + live.말.split('\n').filter(Boolean)[0]);
    console.log('');
    const snap = latestSnapshot();
    if (!snap) {
      console.log('   그리고 기준으로 삼을 사본도 없습니다. 콘솔의 지금 규칙을');
      console.log('   docs/firebase-rules-콘솔원문-YYYY-MM-DD.json 로 저장하세요.');
      process.exit(1);
    }
    base = JSON.parse(fs.readFileSync(snap.file, 'utf8')).rules;
    where = 'docs/' + path.basename(snap.file) + ' (사본 — 그 뒤 콘솔에서 손으로 고친 것이 있으면 이 견줌이 어긋납니다)';
  }

  const out = { gone: [], added: [], changed: [] };
  walk(base, parsed.rules, '', out);
  const 갈래 = 갈래나누기(out);
  const 승인 = fs.existsSync(승인길) ? 승인읽기(fs.readFileSync(승인길, 'utf8')) : {};
  const 못지나갈것 = 승인안된것(갈래.헐거워짐, 승인);

  console.log('기준: ' + where);
  console.log('');
  console.log('■ 새로 생기는 규칙 ' + out.added.length + '개');
  out.added.forEach((x) => console.log('   + ' + x.p));
  console.log('■ 값이 바뀌는 규칙 ' + out.changed.length + '개'
    + (out.changed.length ? '  (조임 ' + 갈래.조임.length + ' · 헐거워짐 ' + 갈래.헐거워짐.filter(function (c) { return !c.새자리; }).length
        + ' · 판단못함 ' + 갈래.판단못함.length + ' · 해당없음 ' + 갈래.해당없음.length + ')' : ''));
  out.changed.forEach((c) => {
    console.log('   ~ ' + c.p);
    console.log('       전: ' + 줄여(c.a));
    console.log('       후: ' + 줄여(c.b));
  });
  console.log('■ 사라지는 규칙 ' + out.gone.length + '개');
  out.gone.forEach((p) => console.log('   - ' + p));

  /* ★ 헐거워지는 것은 «따로, 앞에» 적는다 — 긴 목록에 섞이면 아무도 못 본다 */
  if (갈래.헐거워짐.length) {
    console.log('');
    console.log('★★ 권한이 «넓어지는» 고침 ' + 갈래.헐거워짐.length + '개 — 눈으로 꼭 보세요');
    갈래.헐거워짐.forEach(function (c) {
      const 적힘 = 승인[c.p] && 고름(승인[c.p].옛) === 고름(c.a) && 고름(승인[c.p].새) === 고름(c.b);
      console.log('   ' + (적힘 ? '✔ 승인됨' : '✋ 승인 없음') + '  ' + c.p + (c.새자리 ? '  (새 자리인데 누구나 읽습니다)' : ''));
      if (적힘 && 승인[c.p].왜) console.log('       왜: ' + 승인[c.p].왜);
      console.log('       전: ' + 줄여(c.a));
      console.log('       후: ' + 줄여(c.b));
    });
  }
  if (갈래.판단못함.length) {
    console.log('');
    console.log('⚠ 넓어졌는지 좁아졌는지 «가리지 못한» 고침 ' + 갈래.판단못함.length + '개 — 막지는 않습니다. 눈으로 보세요.');
    갈래.판단못함.forEach(function (c) { console.log('   ? ' + c.p); });
  }
  console.log('');

  /* 2) ⚠ 사라질 것이 하나라도 있으면 «올리지 않는다» */
  if (out.gone.length) {
    console.log('✋ 멈췄습니다 — 위 ' + out.gone.length + '개가 사라집니다.');
    console.log('   콘솔에 있는데 만들개에는 없는 규칙입니다(누군가 콘솔에서 손으로 더했을 수 있습니다).');
    console.log('   ⚠ --force 같은 우회로를 만들지 말 것. 만들개(scripts/make-firebase-rules.js)에');
    console.log('   그 규칙을 넣은 뒤 다시 돌리세요 — 그러면 사라질 것이 0 이 됩니다.');
    process.exit(2);
  }

  /* ④★ 콘솔을 못 읽었으면 «올리지 않는다» — 사본과 견줘 「바뀔 것이 없다」여도 마찬가지다.
     ⚠ 이 빗장은 아래 「바뀔 것 없음」 지름길보다 «앞»에 있어야 한다.
       뒤에 두었더니, 사본이 우연히 만들개와 꼭 같아진 날 --deploy 가 종료코드 0 으로
       그냥 지나갔다(2026-09-13 실측). 그날 콘솔에 손으로 더해진 규칙이 있었다면
       우리는 그것을 «볼 수도 없이» 덮었을 것이다. 못 읽었다는 것은 「같다」가 아니라
       「모른다」다 — 모를 때는 안 올린다. */
  if (DEPLOY && !살아있는것을읽었나) {
    const 못읽음 = 올리기막을까닭({ 살아있는것을읽었나: false, 못지나갈것: 못지나갈것 });
    console.log('✋ 올리지 않습니다 — ' + ((못읽음 && 못읽음.말) || '콘솔을 못 읽었습니다') + '.');
    console.log('   낡은 사본과 견주고 올리면, 그 사이 손으로 고친 것을 말없이 덮습니다.');
    console.log('   ' + (까닭말[live.까닭] || ''));
    process.exit((못읽음 && 못읽음.코드) || 3);
  }

  if (!out.added.length && !out.changed.length) {
    console.log('✅ 바뀔 것이 없습니다 — 올릴 필요가 없습니다.');
    return;
  }

  if (!DEPLOY) {
    console.log('여기까지가 «보여만 주는» 단계입니다. 올리려면:');
    console.log('   node scripts/rules-deploy.js --deploy');
    return;
  }

  /* ②④ ⚠ 올려서는 «안 되는» 자리에서 멈춘다 */
  const 막힘 = 올리기막을까닭({ 살아있는것을읽었나: 살아있는것을읽었나, 못지나갈것: 못지나갈것 });
  if (막힘) {
    console.log('✋ 올리지 않습니다 — ' + 막힘.말 + '.');
    if (막힘.코드 === 3) {
      console.log('   낡은 사본과 견주고 올리면, 그 사이 손으로 고친 것을 말없이 덮습니다.');
      console.log('   ' + (까닭말[live.까닭] || ''));
    } else {
      console.log('   뜻이 있어 넓히는 것이면 docs/firebase-rules-헐거워짐-승인.txt 에 이렇게 적으세요:');
      못지나갈것.slice(0, 3).forEach(function (c) {
        console.log('');
        console.log('   [' + c.p + ']');
        console.log('   왜: (왜 넓혀도 되는지 — 다음 사람이 읽습니다)');
        console.log('   옛: ' + 고름(c.a));
        console.log('   새: ' + 고름(c.b));
      });
      console.log('');
      console.log('   ⚠ 옛·새 «둘 다» 글자까지 맞아야 그 하나만 지나갑니다. --force 를 만들지 말 것.');
    }
    process.exit(막힘.코드);
  }

  /* 3) 올린다 */
  console.log('⏳ 올리는 중… (firebase deploy --only database)');
  execFileSync('firebase',
    ['deploy', '--only', 'database', '--project', PROJECT, '--config', 'firebase.database.json'],
    { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });

  /* ③ ★ 올린 것이 «정말» 올라갔는지 다시 읽어 본다.
       맞을 때만 새 기준을 남긴다 — 기준은 «콘솔에 있는 것»이어야 뜻이 있다. */
  console.log('');
  console.log('⏳ 다시 읽어 확인하는 중…');
  const 뒤 = readLiveRules();
  if (!(뒤.ok && 뒤.rules)) {
    console.log('⚠ 올리기는 끝났는데 «다시 읽지»를 못했습니다 — ' + (까닭말[뒤.까닭] || 뒤.까닭));
    console.log('   그래서 새 기준을 남기지 않았습니다(콘솔에 있는 것을 못 봤으므로).');
    console.log('   콘솔에서 눈으로 확인한 뒤 다시 한 번 돌려 주세요: Realtime Database › 규칙');
    process.exitCode = 4;
    return;
  }
  const 확인 = { gone: [], added: [], changed: [] };
  walk(뒤.rules, parsed.rules, '', 확인);
  if (올린뒤어긋남(확인)) {
    console.log('✋ 올렸는데 콘솔이 «올린 것과 다릅니다» — 새 기준을 남기지 않았습니다.');
    확인.gone.forEach((p) => console.log('   콘솔에만 있음: ' + p));
    확인.added.forEach((x) => console.log('   콘솔에 안 올라감: ' + x.p));
    확인.changed.forEach((c) => console.log('   값이 다름: ' + c.p));
    console.log('   콘솔을 직접 보고, 무엇이 어긋났는지 확인해 주세요.');
    process.exitCode = 5;
    return;
  }
  console.log('   ✅ 콘솔이 올린 것과 같습니다.');

  /* 4) 올린 내용을 «새 기준»으로 남긴다 — 다음 번에 견줄 자리다 */
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(DOCS, 'firebase-rules-콘솔원문-' + today + '.json'), fresh, 'utf8');
  console.log('');
  console.log('✅ 올렸습니다. 새 기준을 남겼습니다 — docs/firebase-rules-콘솔원문-' + today + '.json');
}

/* ⚠ 검사가 이 파일을 실어 조각들을 따로 재 본다 — 실을 때 main 이 돌면 안 된다 */
if (require.main === module) main();

module.exports = {
  까닭가리기: 까닭가리기, 조각들: 조각들, 느슨해졌나: 느슨해졌나, 허락칸인가: 허락칸인가,
  갈래나누기: 갈래나누기, 승인읽기: 승인읽기, 승인안된것: 승인안된것, walk: walk,
  latestSnapshot: latestSnapshot, readLiveRules: readLiveRules,
  올리기막을까닭: 올리기막을까닭, 올린뒤어긋남: 올린뒤어긋남, 고름: 고름
};
