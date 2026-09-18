'use strict';
/* 상태 칸은 «그것을 쓰는 컴포넌트 안»에 선언한다 (대표 화면 2026-09-18 저녁 — 환경설정이 통째로 죽었다)
   ─────────────────────────────────────────────────────────────────────────
   ■ 무엇이 있었나
     나스 설정에 「지금 상태」 칸을 붙이며 `var 진단S = useState(null)` 을 넣었다. 그런데 그 줄이
     **엉뚱한 컴포넌트(「🔬 데이터 진단」, 37,500줄께)** 에 들어갔다. 쓰는 곳은 41,000줄께의
     NasBackupSettings 였다. 배포되자 환경설정 화면 전체가 이렇게 죽었다 —
        ⚠ env/settings 렌더링 오류 — 「진단 is not defined」
     화면 하나가 아니라 **환경설정 전부**가 안 열렸다.
   ■ 까닭
     고칠 자리를 «첫 번째로 닮은 줄»로 찾았다. 이 파일에는
        var busyS = useState(false); var busy = busyS[0]; var setBusy = busyS[1];
     가 **두 곳**에 있다. 첫 번째가 남의 집이었다.
     ⚠ 이 세션에서 같은 실수를 두 번 했다 — 앞서 doRestore 를 첫 번째 것으로 잡아 2,400줄을 지웠다.
       사람이 조심하는 것으로는 안 막힌다. 기계가 막아야 한다.
   ■ 왜 다른 검사가 못 잡았나
     새로 쓴 검사들은 NasBackupSettings 를 떼어내 «쓰는 쪽»만 봤다. «선언이 그 안에 있는지»는
     아무도 안 봤다 — 코드는 문법상 멀쩡하고, 터지는 것은 화면을 그릴 때다.

   ★ 못 박는 것 — 값이 아니라 규칙이다
     `var 아무개S = useState(…)` 로 만든 상태 칸의 `set아무개` 는
     **그것을 만든 컴포넌트 안에서만** 불린다. 남의 집에서 부르면 그 화면이 죽는다.
   ⚠ 이 집의 상태 칸은 늘 이 꼴이다 — `var xS = useState(…); var x = xS[0]; var setX = xS[1];`
     그래서 «누가 주인인지»를 글자로 알 수 있다. 다른 꼴(구조분해 등)이 생기면 여기도 늘려야 한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { cutFn } = require('./cut-fn.js');
const { stripJs } = require('./strip-comments.js');

const ROOT = path.join(__dirname, '..');
const FILES = ['pu-erp.html', 'pu-cards.html', 'work.html', 'pu-photos.html'];

/* 맨 바깥 함수들을 이름과 함께 떼어 온다 (useState 를 쓰는 것만) */
function components(src) {
  const out = [];
  const re = /^function ([A-Za-z_$][\w$]*)\s*\(/gm;
  let m;
  while ((m = re.exec(src))) {
    let body;
    try { body = cutFn(src, 'function ' + m[1] + '('); } catch (_) { continue; }
    if (body && /\buseState\s*\(/.test(body)) out.push({ name: m[1], body });
  }
  return out;
}

/* 이 컴포넌트가 «만든» 상태 칸의 설정 함수 이름들
   ⚠ \b 를 한글 앞에 쓰지 말 것 — 자바스크립트의 \b 는 ASCII 기준이라 「 var set진단」 에서
     경계로 안 쳐준다. 그래서 «한글 이름의 상태 칸을 통째로 못 보는» 눈먼 검사가 된다(처음에 그랬다). */
function ownedSetters(body) {
  const out = new Set();
  /* ⚠ 선언이 «쉼표로 이어지는» 꼴도 있다 — var qs=useState(''),query=qs[0],setQuery=qs[1]
     이것을 빼면 그런 컴포넌트가 전부 거짓 경보가 된다(처음에 그랬다). */
  const 앞 = '(?:(?:var|let|const)\\s+|,\\s*)';
  const re = new RegExp('(?:^|[^\\w$가-힣])' + 앞 + 'set([A-Za-z_$가-힣][\\w$가-힣]*)\\s*=\\s*([A-Za-z_$가-힣][\\w$가-힣]*)\\s*\\[\\s*1\\s*\\]', 'g');
  let m;
  while ((m = re.exec(body))) {
    /* 그 배열이 정말 이 컴포넌트의 useState 인지 확인한다 — 아무 배열의 [1] 이 아니게 */
    if (new RegExp('(?:^|[^\\w$가-힣])' + 앞 + m[2] + '\\s*=\\s*useState\\s*\\(').test(body)) out.add(m[1]);
  }
  /* 구조분해 꼴 — var [x, setX] = useState(…) */
  const re2 = /(?:var|let|const)\s*\[[^\]]*?\bset([A-Za-z_$가-힣][\w$가-힣]*)[^\]]*?\]\s*=\s*useState\s*\(/g;
  while ((m = re2.exec(body))) out.add(m[1]);
  return out;
}

/* 남의 집에서 쓰라고 «건네준» 것은 규칙 밖이다 — 인자로 받거나 스스로 다시 만든 경우 */
function borrows(body, name) {
  return new RegExp(
    '(?:^|[^\\w$가-힣])var\\s+set' + name + '(?![\\w$가-힣])'      // 자기도 만들었다
    + '|function\\s+set' + name + '(?![\\w$가-힣])'
    + '|(?:^|[^.\\w$가-힣])set' + name + '\\s*[,)]'                  // 인자로 받아 넘긴다
  ).test(body);
}

let 본컴포넌트 = 0;

FILES.forEach(file => {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  const src = stripJs(fs.readFileSync(full, 'utf8'));   // ⚠ 주석 안의 set아무개( 를 «부름»으로 읽지 않게

  test('★★ ' + file + ' — 상태 칸의 set아무개() 는 «만든 컴포넌트 안»에서만 불린다', () => {
    const fns = components(src);
    본컴포넌트 += fns.length;
    /* ⚠ «첫 임자»를 정해 두고 견주면 안 된다 — 같은 이름(setQuery)을 저마다 «따로» 만든
       컴포넌트가 여럿이다. 그러면 둘째부터 전부 거짓 경보가 된다(처음에 그랬다).
       규칙은 「부르는 컴포넌트가 스스로 가지고 있는가」 하나다. */
    const 상태이름 = new Set();
    const 내것 = new Map();
    fns.forEach(fn => {
      const mine = ownedSetters(fn.body);
      내것.set(fn.name, mine);
      mine.forEach(n => 상태이름.add(n));
    });

    const 샌것 = [];
    fns.forEach(fn => {
      const mine = 내것.get(fn.name);
      상태이름.forEach(이름 => {
        if (mine.has(이름)) return;
        /* 앞에 점(.)이나 글자가 붙은 것은 남의 것이다 — obj.setX() 는 이 규칙과 무관하다 */
        if (!new RegExp('(?:^|[^.\\w$가-힣])set' + 이름 + '\\s*\\(').test(fn.body)) return;
        if (borrows(fn.body, 이름)) return;
        const 임자 = fns.filter(f => 내것.get(f.name).has(이름)).map(f => f.name).join(', ');
        샌것.push(fn.name + ' 이(가) set' + 이름 + '() 를 부르는데 자기 것이 아닙니다 (만든 곳: ' + 임자 + ')');
      });
    });

    assert.deepEqual(샌것, [],
      '\n★★ 아래 컴포넌트가 «자기 것이 아닌» 상태 칸을 부릅니다.\n'
      + '   문법은 멀쩡하고 배포도 되지만, 그 화면을 여는 순간 「… is not defined」로 죽습니다\n'
      + '   (2026-09-18 저녁 환경설정 전체가 그랬습니다).\n'
      + '   고치는 법: 그 상태 칸(var 이름S = useState(…); … var set이름 = 이름S[1];)을\n'
      + '   «그것을 쓰는 컴포넌트» 안으로 옮기십시오.\n'
      + '   샌 것:\n     - ' + 샌것.join('\n     - ') + '\n');
  });
});

test('★ 이 검사가 헛돌지 않는지 — 볼 컴포넌트가 실제로 있어야 한다', () => {
  assert.ok(본컴포넌트 > 50,
    '★★ 컴포넌트를 ' + 본컴포넌트 + '개밖에 못 떼어 왔습니다 — 파일 모양이 바뀌어 검사가 눈이 먼 것입니다.\n'
    + '   «통과»가 아니라 «안 보고 있는» 것이니 components() 의 찾는 법을 손봐야 합니다.');
});

test('★★ 일부러 남의 집에 선언해 보면 걸린다 — 검사가 진짜 잡는지', () => {
  const 나쁜코드 = [
    'function OtherHouse(){',
    '  var 진단S = useState(null); var 진단 = 진단S[0]; var set진단 = 진단S[1];',
    '  return null;',
    '}',
    'function NasBackupSettings(){',
    '  var busyS = useState(false); var busy = busyS[0]; var setBusy = busyS[1];',
    '  set진단({ ok:true });',
    '  return null;',
    '}',
  ].join('\n');
  const fns = components(나쁜코드);
  const 주인 = new Map();
  fns.forEach(fn => ownedSetters(fn.body).forEach(n => 주인.set(n, fn.name)));
  assert.equal(주인.get('진단'), 'OtherHouse',
    '★ 주인을 못 가린다 — 한글 이름 앞에 \\b 를 쓰면 여기서 눈이 먼다(실제로 그랬다)');
  assert.ok(!ownedSetters(fns.find(f => f.name === 'NasBackupSettings').body).has('진단'),
    '★★ 부르는 쪽이 «자기 것»으로 잘못 보이면 이 검사는 아무것도 못 잡는다');
  const nas = fns.find(f => f.name === 'NasBackupSettings');
  assert.ok(/(?:^|[^.\w$가-힣])set진단\s*\(/.test(nas.body), '★ 남의 집 것을 부르는 것을 못 본다');
  assert.ok(!borrows(nas.body, '진단'), '★ 건네받은 것으로 잘못 봐주면 이 검사는 아무것도 못 잡는다');
});
