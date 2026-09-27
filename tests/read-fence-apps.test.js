'use strict';
/* 판독으로 나가는 길 — **모든 화면**을 훑는 울타리 (대표 지시 2026-08-17 ②)
   실행: node --test tests/*.test.js · 목업 docs/mockups/read-fence-wide.html

   ⚠ 왜 이 검사가 생겼나: 울타리가 급여데이터함·사진첩 **두 앱만** 지키고 있었다.
     그 사이로 자문관리가 판독을 붙였는데 **아무도 몰랐다.** 다른 방에서 들어온 것을
     훑다가 찾았다. 앱마다 따로 지키면 새 앱은 늘 빠진다 — 그래서 여기서 통째로 훑는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = path.join(__dirname, '..');
const { stripComments } = require('./strip-comments.js');

/* 저장소 뿌리의 화면들만 본다(참고용·목업 폴더는 뺀다).
   ⚠ **주석을 걷은 사본(bare)을 함께 들고 있는다** (2026-09-08). 예전에는 원문을
     글자로 훑어서, 「PuDocRead.freeRead 를 여기서 부른다」고 «설명하는 주석»만
     써도 이 검사가 깨졌다. 주석은 아무것도 부를 수 없다 — 그런데 그 헛경보를
     끄려고 사람이 GATED 에 이름을 더하면 **울타리가 실제로 넓어진다.**
     헛경보는 울타리를 넓히는 쪽으로 사람을 떠민다. 그래서 걷고 본다.
   ⚠ 스크립트 태그는 «원문»에서 본다 — 걷개가 마크업을 손댈 일이 없게. */
function appFiles() {
  return fs.readdirSync(R)
    .filter(f => f.endsWith('.html'))
    .map(f => {
      const src = fs.readFileSync(path.join(R, f), 'utf8');
      return { name: f, src: src, bare: stripComments(src) };
    });
}

const loadsReader = a => /<script[^>]+src="js\/pu-doc-read\.js/.test(a.src);
const loadsMasker = a => /<script[^>]+src="js\/pu-rrn-mask\.js/.test(a.src);

/* 이 화면이 «사진·글을 내보내는» 판독 함수를 실제로 부르나.
   ⚠ SAFE 는 아래에 있다 — 이 함수는 검사가 돌 때 불리므로 그때는 이미 있다.

   ★★ 왜 「실었나」가 아니라 「부르나」로 보는가 (2026-09-08)
     푸른이알피가 판독 층을 싣게 됐다 — 사업자등록증 파서와 «브라우저» 판독
     (Tesseract)을 쓰려고다. 그 둘은 계산과 브라우저 안 일뿐이라 **사진도 글도
     어디로도 안 나간다.** 그런데도 「실었으면 지우개도」로 재면, 쓰지도 않을
     지우개를 싣거나 KNOWN_OPEN 에 이름을 올려야 한다 — 둘 다 나쁘다.
     ⚠ 특히 KNOWN_OPEN 에 올리는 것은 **감수 범위를 말없이 넓히는 일**이고,
       그 목록은 「늘리지 말 것」이라고 스스로 적어 두었다.
   ⚠ 이 판정은 아래 SAFE 하나에 달려 있다. SAFE 에 «내보내는» 이름을 잘못 넣으면
     이 검사와 아래 검사가 **함께** 눈을 감는다 — SAFE 에 이름을 더할 때는
     「이것이 사진이나 글을 밖으로 보내는가」만 묻는다. */
function readerCalls(a) {
  const out = [];
  const re = /PuDocRead\.(\w+)/g;
  let m;
  while ((m = re.exec(a.bare)) !== null) {
    if (SAFE.indexOf(m[1]) >= 0) continue;
    out.push({ name: m[1], at: m.index });
  }
  return out;
}

/* ⚠ **아는 채로 열어 둔 화면.** 늘리는 것은 감수 범위를 말없이 넓히는 일이라
   대표께 물어야 한다.
   · gov-consulting.html — 정부포털 사업장 정보 캡처를 **사진 그대로** 보낸다.
     가림 창도, 판독 층 문지기도 없다(문지기는 글자용이라 사진에는 안 걸린다).
     **대표 결정 2026-08-17: 「그대로 감수한다」**(넷 중 1번).
     안 고른 길: ②가림 창 붙이기 ③기계가 자동으로 가리기 ④판독 끄기.
     ⚠ 이 목록을 **늘리지 말 것.** 늘리는 것은 감수 범위를 말없이 넓히는 일이다 —
     새 화면이 필요하면 대표께 다시 물어야 한다. */
const KNOWN_OPEN = ['gov-consulting.html'];

/* ⚠ 이름을 그대로 둔다 — 「실은」이 아니라 「내보내는 판독을 부르는」으로 재지만,
   지키는 것은 같다: **사진·글을 밖으로 보내는 화면에는 지우개가 있어야 한다.** */
test('★ 판독 층을 실은 화면은 가림 층도 싣는다', () => {
  const bad = appFiles()
    .filter(a => loadsReader(a) && readerCalls(a).length && !loadsMasker(a))
    .map(a => a.name);
  const extra = bad.filter(n => KNOWN_OPEN.indexOf(n) < 0);
  assert.deepEqual(extra, [],
    '★ 판독은 하는데 주민번호 지우개가 없는 화면이 새로 생겼습니다: ' + extra.join(', ')
    + ' — js/pu-rrn-mask.js 를 함께 싣거나, 어쩔 수 없으면 KNOWN_OPEN 에 **까닭과 함께** 적으세요');
});

/* 아는 구멍이 메워졌는데 목록에 남아 있으면, 다음 사람이 「여기는 원래 여는 데」로
   읽고 또 연다. 메워졌으면 목록에서 빼라고 알린다. */
test('아는 구멍이 메워지면 목록에서 빼라고 알린다', () => {
  const apps = appFiles();
  const stale = KNOWN_OPEN.filter(n => {
    const a = apps.filter(x => x.name === n)[0];
    return !a || !loadsReader(a) || !readerCalls(a).length || loadsMasker(a);
  });
  assert.deepEqual(stale, [],
    '이 화면들은 이제 지켜집니다 — KNOWN_OPEN 에서 빼 주세요: ' + stale.join(', '));
});

/* ══════ 판독기를 부르는 곳 ══════ */

/* 사진을 안 보내는 것들 — 이 이름만 울타리 밖에서 불러도 된다.
   ⚠ 이름을 **늘어놓고 막지 않는다.** 여기 없는 것은 전부 새는 길로 본다 —
     판독 함수를 새로 만들면 이 검사가 먼저 깨진다. 그것이 의도다. */
const SAFE = ['init', 'bizNoDigits', 'bizNoValid', 'fmtBizNo', 'mapTo', 'keysFrom',
  'MODELS', 'PROMPTS', 'READ_VERSION', 'PROMPT_VERSION', 'autoOk',
  /* healRead 는 밖으로 안 보낸다 — 이미 읽어 온 답을 손보는 계산뿐이다 */
  'healRead',
  /* APP_KO 는 «이름표 표»다(2026-09-08) — 앱 이름을 한국말로 옮기는 사전뿐이고
     사진도 글도 어디로 안 보낸다. 앱별 판독 셈을 화면에 「사진첩 184」로 적는 데 쓴다.
     ⚠ 이 표를 화면 쪽에 두면 안 된다 — 사진첩 화면에 다른 앱 이름을 글자로 적으면
       「다른 앱의 클라우드 루트를 건드리지 않는다」가 걸린다(그 검사가 옳다). */
  'APP_KO',
  /* isOurs 는 «판정»뿐이다(2026-09-08) — 서식의 소속·회사 칸이 우리 법인인지 보고
     참·거짓을 돌려준다. 사진도 글도 어디로 안 보낸다. 위촉장을 거래처 자료로
     보내지 않게 막는 데 쓴다(대표 지시 「위촉장등은 보내기 필요 없다」). */
  'isOurs', 'OUR_NAMES', 'OUR_LABELS',
  /* ── 무료 판독의 «계산 조각»들 (2026-09-08) ────────────────────────────────
     사업자등록증 글자에서 칸을 뽑는 계산뿐이다. 글자를 받아 값을 돌려주고 끝난다 —
     아무것도 부르지 않고 아무 데도 안 보낸다(js/pu-doc-read.js 의 bizregParse 참고).
     ⚠ freeRead 는 **여기 없다.** 그것은 사진을 Vision 으로 보낸다 — GATED 몫이다.
       그 둘을 한 칸에 넣으면 이 울타리가 통째로 뜻을 잃는다. */
  'bizregParse', 'bizregFields', 'bizregTitle', 'bizregNo', 'bizregLooks',
  /* browserRead·browserText — Tesseract 로 **브라우저 안에서** 읽는다.
     사진이 이 컴퓨터를 떠나지 않는다. 그래서 지우개가 필요 없는 유일한 판독이다.
     ⚠ 이 둘의 «무료»는 요금이 아니라 «안 나간다»는 뜻이기도 하다 — 헷갈리지 말 것. */
  'browserRead', 'browserText'];

/* 그 앱에서 판독기를 부르는 것이 허락된 자리. 각 앱의 울타리 검사가 따로 지킨다. */
const GATED = {
  'pu-paydata.html': ['runRead', 'runSheetRead', 'readOneSum'],
  /* ⚠ freeReadTry·freeReadAsk — 무료 판독이 사진을 «우리 서버 대리인»에게 보내는
       자리다(거기서 구글 Vision 으로 간다). 가림을 «안» 거친다 — 사진첩 자동 판독이
       예전부터 원본을 그대로 보내고 있고(2026-08-17 대표 결정 「이대로 감수한다」),
       이 길은 그 감수 범위를 넓히지 않는다: 보내는 사진이 «같은 사진»이고 오히려
       Gemini 대신 글자만 뽑는 쪽으로 간다.
     ⚠ 이름을 한글로 짓지 «말 것». 아래 fnAround 의 \w 가 한글을 못 읽어 자리가
       「(모름)」이 되고, 그러면 이 목록에 적을 수가 없어 **울타리 밖**에 놓인다
       (freeReadAsk 가 처음엔 「무료판독」이었다가 그래서 이름을 바꿨다). */
  'pu-photos.html': ['startRead', 'readPhoto', 'imgChunkMakers', 'readDocChunked',
    'runReadChunks', 'textChunkMakers', 'freeReadTry', 'freeReadAsk'],
  'gov-consulting.html': ['refCapRead'],      // 아는 채로 열어 둔 곳(KNOWN_OPEN)
  /* 경력관리 — 위촉장·자격증·경력증명서를 읽는다(대표 지시 2026-09-06 「사진첩 판독기로 바꿔라」).
     ⚠ 부르는 자리는 _kcReader 하나뿐이다. 이 층을 다른 곳에서 또 부르면 여기서 걸린다 —
       그래야 «사진이 어디로 나가는지»를 한 자리에서 볼 수 있다. */
  'kcareer.html': ['_kcReader']
};

function fnAround(src, at) {
  const head = src.lastIndexOf('\nfunction ', at);
  if (head < 0) return '(모름)';
  const m = src.slice(head + 1, head + 120).match(/^function\s+(\w+)/);
  return m ? m[1] : '(모름)';
}

test('★ 판독기를 부르는 자리가 앱마다 정해진 곳뿐이다', () => {
  const bad = [];
  appFiles().forEach(a => {
    readerCalls(a).forEach(c => {
      const fn = fnAround(a.bare, c.at);
      const ok = GATED[a.name] || [];
      if (ok.indexOf(fn) < 0) bad.push(a.name + ' : ' + fn + ' → PuDocRead.' + c.name);
    });
  });
  assert.deepEqual(bad, [],
    '★ 판독기를 부르는 새 길이 생겼습니다: ' + bad.join(' / ')
    + ' — 가림을 거치게 하거나, 사진을 안 보내는 것이면 SAFE 에 이름을 더하세요');
});

/* ══════ 글자 길의 문지기 ══════ */

/* ⚠ 예전에는 `if (RM && RM.maskRrnInText)` 라 **지우개가 없으면 안 지우고 그냥
   보냈다** — 오류도 없고 아무 말도 없었다. 조용히 새는 것보다 시끄럽게 멈추는
   편이 낫다(대표 지시 2026-08-17). */
test('★ 지우개가 없으면 글자 판독을 막는다 — 그냥 보내지 않는다', () => {
  const src = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8');
  assert.match(src, /function rrnScrub\(body\)/, '지우개 판정이 한 곳에 없습니다');
  assert.match(src, /if \(!RM \|\| !RM\.maskRrnInText\) return null/,
    '★ 지우개가 없을 때 막지 않습니다');
  assert.equal(/if \(RM && RM\.maskRrnInText\) body =/.test(src), false,
    '★ 「없으면 통과」가 남아 있습니다 — 그러면 조용히 새 나갑니다');
  /* 막았으면 **까닭을 말해야** 한다 — 아무 말 없이 실패하면 왜 안 되는지 모른다. */
  assert.match(src, /NO_SCRUB/, '막은 까닭을 안 알립니다');
  assert.match(src, /가림 층을 실어 주세요/, '어떻게 고치는지가 없으면 알려도 소용없습니다');
});

test('★ 글자를 보내는 길이 모두 그 문지기를 거친다', () => {
  const src = fs.readFileSync(path.join(R, 'js', 'pu-doc-read.js'), 'utf8');
  ['readTableText', 'readDocText'].forEach(fn => {
    const m = src.match(new RegExp('function ' + fn + '\\([\\s\\S]*?\\n  \\}'));
    assert.ok(m, fn + ' 을 찾을 수 없습니다');
    assert.match(m[0], /rrnScrub\(body\)/, fn + ' 이 문지기를 안 거칩니다');
    assert.match(m[0], /body === null/, fn + ' 이 막힌 것을 안 봅니다');
  });
});
