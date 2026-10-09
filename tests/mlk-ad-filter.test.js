'use strict';
// 이어 줄 메일에서 광고·반송 빼기 — node --test tests/mlk-ad-filter.test.js
//
// 대표 지시 2026-09-27: "이어 줄 메일 의 내용중에 스팸이나 광고메일도 많이 있다.
//                       이부분은 자동으로 배제 삭제했으면 좋겠다."
//
// 이 검사가 지키는 것
//   ①★ 낱말로는 «안» 가린다 — 체불·해고 상담 메일에 그 말이 그대로 나온다
//        (푸른메일함에서 이미 확인하고 못 박은 규칙과 같다)
//   ②★ 업체에 걸린 주소는 「앞으로도 아님」에 «못» 넣는다
//        — 넣으면 진짜 업체 메일이 조용히 사라지고, 안 오는 메일은 아무도 못 찾는다
//   ③  업무에 붙는 메일은 광고 표가 있어도 «안» 뺀다 (맞는 업무가 기계 판정보다 세다)
//   ④  지우지 않는다 — 「자동으로 뺀 것」 칸에 그대로 있고 풀 길이 있다
//   ⑤  양 끝 — 자리(mailno)와 구독이 «둘 다» 있다

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const W = fs.readFileSync(path.join(__dirname, '..', 'work.html'), 'utf8').replace(/\r\n/g, '\n');

function grab(name) {
  const i = W.indexOf('function ' + name + '(');
  assert.ok(i >= 0, '못 찾음: ' + name);
  let d = 0, j = i;
  for (;; j++) { if (W[j] === '{') d++; else if (W[j] === '}') { d--; if (!d) { j++; break; } } }
  return W.slice(i, j);
}
function noComment(t) {
  return t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

/* 판정 넷만 꺼낸다. 바깥 것(주소 뽑기·업체 찾기)은 흉내로 세운다 —
   그래야 「판정이 무엇을 보고 있나」만 또렷이 본다. */
function box(opt) {
  opt = opt || {};
  const b = {
    console, String, Object, Array, Boolean,
    mailno: opt.mailno || {},
    _mailAddr: f => { const m = String(f || '').match(/[\w.+-]+@[\w.-]+\.\w+/); return m ? m[0].toLowerCase() : ''; },
    mlkAddrKey: a => String(a || '').replace(/[.#$/[\]]/g, '_'),
    mlkAddrCos: f => (opt.cosOf || (() => ({ cos: [], agent: false })))(f)
  };
  vm.createContext(b);
  /* 반송 잣대는 «진짜 것»을 그대로 꺼내 쓴다 — 흉내를 내면 검사가 검사를 검사하게 된다 */
  const bot = W.match(/var MLK_BOT=[^\n]*/);
  assert.ok(bot, 'MLK_BOT 을 못 찾았습니다');
  /* 2026-10-09 — 알림 주소 앞부분·이름 있는 발송 회사·공공기관 잣대도 «진짜 것»을 꺼내 쓴다 */
  const pub = W.match(/var MAIL_PUBLIC=\{[^}]*\};/); assert.ok(pub, 'MAIL_PUBLIC 을 못 찾았습니다');
  const more = [pub[0].replace(/^var MAIL_PUBLIC=/, 'var MAIL_PUBLIC=')].concat(['MLK_NOTI', 'MLK_BULKDOM', 'MLK_PUBLIC_DOM'].map((n) => {
    const m = W.match(new RegExp('var ' + n + '=[^\\n]*')); assert.ok(m, n + ' 을 못 찾았습니다'); return m[0]; }));
  vm.runInContext([bot[0]].concat(more, [grab('mlkAuto'), grab('mlkIsNo'), grab('mlkWhyOut'), grab('mlkCanNo')]).join('\n'), b);
  return b;
}

/* 판정이 쓰는 글자 — 돌려주는 «이름표»는 빼고 본다.
   ⚠ '광고'·'반송'은 가리는 낱말이 아니라 «왜 뺐는지 적는 말»이다. 그것까지 금지하면
     화면에 이유를 못 적는데, 이유를 안 적으면 사람이 기계를 못 믿는다. */
const LABELS = ["'광고'", "'반송'", "'앞으로도 아님'", "'알림'"];   /* 「알림」 — 2026-10-09 */
function judgeSrc() {
  let t = noComment([grab('mlkAuto'), grab('mlkWhyOut'), grab('mlkIsNo')].join('\n'));
  LABELS.forEach(l => { t = t.split(l).join(' '); });
  return t;
}

/* ── ① 낱말 금지 ─────────────────────────────────────────────── */

const 광고낱말 = ['광고', '대출', '무료', '클릭', '이벤트', '당첨', '홍보', '할인', '증정',
  'unsubscribe', 'viagra', 'casino', 'promotion', '뉴스레터', 'newsletter'];

test('★ 판정 안에 낱말 목록이 없다 — 목록은 끝없이 늘고 언젠가 진짜를 잡는다', () => {
  const src = judgeSrc();
  광고낱말.forEach(w => {
    assert.equal(src.indexOf(w), -1, '낱말로 가리고 있습니다: ' + w);
  });
});

test('★★ 판정이 제목·본문을 «아예 안 본다» — 낱말 금지보다 이것이 근본이다', () => {
  const src = judgeSrc();
  ['subject', 'preview', 'body', 'text'].forEach(f => {
    assert.equal(src.indexOf(f), -1,
      '판정이 ' + f + ' 를 봅니다 — 글자를 보기 시작하면 결국 낱말 목록이 됩니다');
  });
});

test('★ 제목·본문에 광고 같은 말이 있어도 «안» 뺀다 — 상담 메일이 걸린다', () => {
  const b = box();
  ['무료 상담 요청드립니다', '대출금 압류 관련 문의', '클릭 안내 — 임금체불 진정',
   '이벤트 기간 중 해고 통보를 받았습니다'].forEach(s => {
    assert.equal(b.mlkAuto({ from: '홍길동 <hong@ganasa.co.kr>', subject: s, preview: s }), '',
      '낱말로 뺐습니다: ' + s);
  });
});

/* ── 반송·기계 발신 ──────────────────────────────────────────── */

test('반송은 뺀다 — 사람이 보낸 것이 아니라 사업장 메일일 수가 없다', () => {
  const b = box();
  ['Mail Delivery Subsystem <mailer-daemon@googlemail.com>',
   '<postmaster@daum.net>',
   'bounce@list.example.com',
   'MAILER-DAEMON@hanmail.net'].forEach(f => {
    assert.equal(b.mlkAuto({ from: f }), '반송', '반송을 못 걸렀습니다: ' + f);
  });
});

test('주소 «앞부분»만 본다 — 도메인이 같다고 뺄 수는 없다', () => {
  const b = box();
  assert.equal(b.mlkAuto({ from: '김부장 <kim@googlemail.com>' }), '',
    '같은 도메인이라고 멀쩡한 메일을 뺐습니다');
});

test('멀쩡한 업체 메일은 하나도 안 뺀다', () => {
  const b = box();
  ['가나상사 <ceo@ganasa.co.kr>', 'hr@daraindustry.com', '박과장 <park@naver.com>',
   'noreply-notice@moel.go.kr', 'admin@comwel.or.kr'].forEach(f => {
    assert.equal(b.mlkAuto({ from: f }), '', '멀쩡한 주소를 뺐습니다: ' + f);
  });
});

/* ── 서버가 적어 준 표 ───────────────────────────────────────── */

test('서버가 광고 표를 붙였으면 뺀다', () => {
  const b = box();
  assert.equal(b.mlkAuto({ from: 'news@synology.com', bulk: true }), '광고');
});

test('표가 «참»일 때만 뺀다 — 빈 값·글자를 참으로 보지 않는다', () => {
  const b = box();
  [undefined, null, false, 0, '', 'false'].forEach(v => {
    assert.equal(b.mlkAuto({ from: 'a@b.com', bulk: v }), '', 'bulk=' + JSON.stringify(v) + ' 를 참으로 봤습니다');
  });
});

/* ── 사람이 정한 주소 ────────────────────────────────────────── */

test('「앞으로도 아님」으로 정한 주소는 뺀다', () => {
  const b = box({ mailno: { 'news@synology_com': { addr: 'news@synology.com' } } });
  assert.equal(b.mlkWhyOut({ from: 'Synology Newsletter <news@synology.com>' }), '앞으로도 아님');
  assert.equal(b.mlkWhyOut({ from: 'ceo@ganasa.co.kr' }), '', '엉뚱한 주소까지 뺐습니다');
});

/* ── ②★ 가장 중요한 가드 ────────────────────────────────────── */

test('★★ 업체에 걸린 주소는 「앞으로도 아님」에 못 넣는다', () => {
  const b = box({ cosOf: () => ({ cos: ['가나상사'], agent: false }) });
  assert.equal(b.mlkCanNo('ceo@ganasa.co.kr'), false,
    '업체 주소를 「아님」으로 넣을 수 있습니다 — 진짜 업체 메일이 조용히 사라집니다');
});

test('★ 고정(한 곳까지 허용)보다 «더» 엄하다 — 한 곳이라도 걸리면 안 된다', () => {
  const b = box({ cosOf: () => ({ cos: ['가나상사'], agent: false }) });
  assert.equal(b.mlkCanNo('a@b.com'), false, '한 곳 걸린 주소를 허용했습니다');
});

test('세무·회계사무소 주소도 못 넣는다', () => {
  const b = box({ cosOf: () => ({ cos: [], agent: true }) });
  assert.equal(b.mlkCanNo('cust27@naver.com'), false, '대행 주소를 허용했습니다');
});

test('아무 업체에도 안 걸린 주소만 넣을 수 있다', () => {
  const b = box();
  assert.equal(b.mlkCanNo('news@synology.com'), true);
  assert.equal(b.mlkCanNo(''), false, '주소가 아닌 것을 허용했습니다');
});

/* ── ③ 차례 ─────────────────────────────────────────────────── */

test('★ 업무에 붙는지 «먼저» 본다 — 맞는 업무가 기계 판정보다 세다', () => {
  const src = noComment(grab('mlkScan'));
  const hit = src.indexOf('mailHit');
  const out = src.indexOf('mlkWhyOut');
  assert.ok(hit >= 0 && out > hit,
    '광고 판정이 업무 맞추기보다 먼저입니다 — 업무에 붙을 메일이 사라집니다');
});

test('사람이 손으로 이은 것·치운 것이 그보다 더 먼저다', () => {
  const src = noComment(grab('mlkScan'));
  assert.ok(src.indexOf('maillink') < src.indexOf('mlkWhyOut'),
    '사람이 정한 것보다 기계 판정이 먼저입니다');
});

/* ── ④ 지우지 않는다 ────────────────────────────────────────── */

test('뺀 것은 지우지 않고 따로 담는다', () => {
  const src = noComment(grab('mlkScan'));
  assert.ok(/out\.skip\.push/.test(src), '뺀 메일을 담아 두지 않습니다 — 그대로 사라집니다');
  assert.ok(/skip:\s*\[\]/.test(src), 'skip 칸이 없습니다');
});

test('푸는 길이 있다 — 화면에서 부를 수 있어야 한다', () => {
  assert.ok(W.indexOf('function mlkUnNo(') >= 0, '푸는 함수가 없습니다');
  assert.ok(W.indexOf('mlkUnNo(') > W.indexOf('function mlkUnNo('),
    '푸는 함수를 아무도 부르지 않습니다 — 한 번 잘못 누르면 영영 못 되돌립니다');
});

test('「자동으로 뺀 것」 칸이 화면에 있다', () => {
  assert.ok(W.indexOf("mlkTab('auto')") >= 0 || W.indexOf("mlkTab(\\'auto\\')") >= 0,
    '자동으로 뺀 것을 볼 칸이 없습니다');
  assert.ok(W.indexOf("tab==='auto'") >= 0, '그 칸을 그리는 곳이 없습니다');
});

/* ── ⑤ 양 끝 ────────────────────────────────────────────────── */

test('★ 자리와 구독이 «둘 다» 있다 — 읽기 실패는 조용하다', () => {
  assert.ok(/var mailno=\{\}/.test(W), 'mailno 자리가 없습니다');
  assert.ok(W.indexOf("watchMapChildren(NS+'/mailno'") >= 0,
    'mailno 를 구독하지 않습니다 — 적히기는 하는데 화면이 영영 못 읽습니다');
  assert.ok(W.indexOf("NS+'/mailno/'") >= 0, 'mailno 에 적는 곳이 없습니다');
});

test('고른 것을 인라인에 실어 보내지 않는다 — 따옴표가 핸들러를 깨뜨린다', () => {
  assert.ok(W.indexOf('mlkNoneSel()') >= 0, '고른 것을 읽어 가는 함수가 없습니다');
  assert.equal(W.indexOf('mlkNone('+"'"+'+JSON.stringify(picked)'), -1);
});

/* ── 알림 주소·대량 발송 회사 (대표 지시 2026-10-09 → 추천대로) ──────────────
   실측: 이어 줄 메일 87통 중 17통이 이 둘이었다. 제목·본문은 여전히 안 본다(위 ★★). */

test('기계 발신 주소(noreply·newsletter·marketing …)는 「알림」으로 뺀다', () => {
  const b = box();
  ['no-reply@claude.com', 'noreply@synology.com', 'Synology Marketing <marketing@synology.com>',
   'no-reply-accounts@hancom.com', 'newsletter@example.com'].forEach(f => {
    assert.equal(b.mlkAuto({ from: f }), '알림', '못 뺐습니다: ' + f);
  });
});

test('이름 있는 대량 발송 회사·뉴스 하위 도메인은 「광고」로 뺀다', () => {
  const b = box();
  ['인크루트 <recommend@incruit-email.com>', 'Synology Newsletter <hello@news.synology.com>', 'x@balsong.com'].forEach(f => {
    assert.equal(b.mlkAuto({ from: f }), '광고', '못 뺐습니다: ' + f);
  });
});

test('★★ 공공기관 주소는 noreply 라도 «절대» 안 뺀다 — 고용노동부·공단 알림은 일이다', () => {
  const b = box();
  ['noreply-notice@moel.go.kr', 'no-reply@comwel.or.kr', 'newsletter@kosha.or.kr', 'noreply@korea.kr'].forEach(f => {
    assert.equal(b.mlkAuto({ from: f }), '', '공공기관 메일을 뺐습니다: ' + f);
  });
});

test('★★ 업체에 걸린 주소는 noreply 라도 안 뺀다 — 고객사의 전자계약·급여 시스템 알림', () => {
  const b = box({ cosOf: () => ({ cos: ['가나상사'], agent: false }) });
  assert.equal(b.mlkAuto({ from: 'noreply@ganasa.co.kr' }), '', '업체 주소의 알림을 뺐습니다');
  const t = box({ cosOf: () => ({ cos: [], agent: true }) });
  assert.equal(t.mlkAuto({ from: 'newsletter@taxoffice.kr' }), '', '세무사무소 주소를 뺐습니다');
});

test('흔한 메일 도메인은 발송 회사가 아니다 — naver·gmail 사람 메일은 안 뺀다', () => {
  const b = box();
  ['박과장 <park@naver.com>', 'kim@gmail.com', 'lee@hanmail.net', 'news.reporter@daum.net'].forEach(f => {
    assert.equal(b.mlkAuto({ from: f }), '', '사람 메일을 뺐습니다: ' + f);
  });
});
