/* 대표자와 담당자를 갈라 «각자» 보낸다 · 「따로 더한 분」이라는 새 자리
   ═══════════════════════════════════════════════════════════════════════════
   대표 지시 2026-09-09: 「사업장의 대표자와 담당자가 있다. 각자보내야되서 각자
   이메일등을 정리해야한다. 이부분 다시 검토해서 분리해라. 그리고 추후에
   기업정보함에서 추가적으로 더 관리해야될 사람들 명단도 보낼 생각이다
   이부분도 어디에 별도로 추가해야할 것인지 만들어 달라.」
   목업: docs/mockups/news-ceo-staff-split.html
   대표 결정: 대표자 주소는 «업체관리에 새 칸(ceoEmail)»을 만들어 담는다.

   ★ 왜 이 검사가 있나 — 실측 2026-09-09 로 드러난 것
     · 화면이 ceoName·ceoPhone 을 읽는데 그 칸은 사업장 375곳 «어디에도 없었다».
       그래서 대표자 열 119줄이 «모두» 「—」였다. 있는 자료(ceo, 204곳)를 못 읽었다.
     · 「대표자 이메일」 칸이 아예 없어, 대표자로 나가던 6줄은 사실 «회사 메일»이었다.
     ⇒ 이 검사가 지키는 것은 «칸 이름이 자료와 맞나»이지 «지금 몇 줄인가»가 아니다. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { stripComments } = require('./strip-comments');
const C = require('../js/pu-news-core.js');

const ROOT = path.join(__dirname, '..');
const 읽기 = (f) => stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n'));
const news = 읽기('pu-news.html');
const erp = 읽기('pu-erp.html');
const cards = 읽기('pu-cards.html');
const core = 읽기('js/pu-news-core.js');

function 집(추가) {
  return Object.assign({ id: 'c1', name: '어떤회사', status: 'active' }, 추가 || {});
}
function 명단(사업장들, 옵션) {
  const g = C.사업장에서명단(사업장들, '자문중', Object.assign({ 대표자도: true }, 옵션 || {}));
  return C.명단다듬기(g.줄들, {});
}

/* ══════ ① 대표자 «이름»은 업체관리가 쓰는 칸에서 온다 ══════ */

test('★ 대표자 이름은 업체관리의 ceo 칸에서 읽는다 — 없는 칸을 읽어 119줄이 「—」였다', () => {
  const r = 명단([집({ ceo: '김대표', primaryContactEmail: 'a@x.com', primaryContactName: '홍길동' })]);
  const 줄 = r.ok.find(x => x.email === 'a@x.com');
  assert.ok(줄, '담당자 줄이 없다');
  assert.equal(줄.대표자, '김대표',
    '업체관리의 ceo 를 못 읽었다 — CO_FIELD_LABEL 이 ceo=대표자 다. ceoName 이라는 칸은 자료에 없다');
});

test('업체관리가 대표자를 다른 이름으로 부르기 시작하면 여기서 걸린다', () => {
  /* 값이 아니라 «두 앱이 같은 칸을 보는가»를 못 박는다. */
  const m = /var CO_FIELD_LABEL = \{([\s\S]*?)\};/.exec(erp);
  assert.ok(m, '업체관리의 CO_FIELD_LABEL 을 못 찾았다');
  assert.match(m[1], /(^|[\s,{])ceo\s*:\s*'대표자'/,
    '업체관리에서 대표자 칸 이름이 바뀌었다 — 뉴스레터의 사업장에서명단도 함께 고칠 것');
  assert.match(C.사업장에서명단.toString(), /co\.ceo\b/,
    '뉴스레터가 업체관리의 ceo 칸을 안 읽는다');
});

/* ══════ ② 대표자 «주소» — 본인 칸이 회사 메일을 이긴다 ══════ */

test('★ 업체관리에 「대표자 이메일」 칸이 있다 (대표 결정 2026-09-09)', () => {
  const m = /var CO_FIELD_LABEL = \{([\s\S]*?)\};/.exec(erp);
  assert.match(m[1], /ceoEmail\s*:\s*'[^']*대표자[^']*'/,
    '업체관리에 대표자 이메일 칸이 없다 — 그 칸이 있어야 명함에서 찾은 주소를 담을 자리가 생긴다');
});

test('★ 대표자 본인 주소(ceoEmail)가 회사 메일(email)을 이긴다', () => {
  const r = 명단([집({ ceo: '김대표', ceoEmail: 'ceo@x.com', email: 'office@x.com' })]);
  const 대표줄 = r.ok.filter(x => x.누구 === '대표자');
  assert.equal(대표줄.length, 1, '대표자 줄이 하나여야 한다');
  assert.equal(대표줄[0].email, 'ceo@x.com',
    '회사 메일이 대표자 본인 주소를 이겼다 — 본인 것이 있으면 그것으로 보낸다');
});

test('본인 주소가 없으면 회사 메일로 물러서되, «회사 메일»이라고 밝힌다', () => {
  const r = 명단([집({ ceo: '김대표', email: 'office@x.com' })]);
  const 대표줄 = r.ok.find(x => x.누구 === '대표자');
  assert.equal(대표줄.email, 'office@x.com');
  assert.equal(대표줄.출처, '회사메일',
    '어디서 온 주소인지 밝히지 않으면 「대표자에게 갔다」고 잘못 읽는다');
});

test('★ 주소가 «어디서 왔나»가 명단다듬기를 지나도 살아 있다', () => {
  /* 유형을 흘려 겪은 일과 똑같은 함정이다 — 다듬은 뒤에 화면이 그것으로 딱지를 단다. */
  const r = 명단([집({ ceo: '김대표', ceoEmail: 'ceo@x.com',
                       primaryContactName: '홍길동', primaryContactEmail: 'a@x.com' })]);
  const 대표줄 = r.ok.find(x => x.누구 === '대표자');
  const 담당줄 = r.ok.find(x => x.누구 === '담당자');
  assert.equal(대표줄.출처, '본인');
  assert.ok(담당줄.출처, '담당자 줄에도 출처가 있어야 한다');
});

/* ══════ ③ 갈래(누구)로 갈라진다 ══════ */

test('★ 대표자와 담당자가 «갈래»로 갈라져 각자 한 줄이다', () => {
  const r = 명단([집({ ceo: '김대표', ceoEmail: 'ceo@x.com',
                       primaryContactName: '홍길동', primaryContactEmail: 'a@x.com' })]);
  assert.equal(r.ok.length, 2, '대표자와 담당자가 각자 한 통씩 받는다');
  assert.deepEqual(r.ok.map(x => x.누구).sort(), ['담당자', '대표자']);
});

test('갈래별로 셀 수 있다 — 화면이 표를 셋으로 가른다', () => {
  const r = 명단([집({ ceo: '김대표', ceoEmail: 'ceo@x.com', primaryContactEmail: 'a@x.com' })]);
  const n = C.누구별셈(r.ok);
  assert.equal(n.대표자, 1);
  assert.equal(n.담당자, 1);
  assert.equal(n.더한분, 0, '0인 갈래도 칸을 남긴다 — 없어진 것과 원래 없는 것은 다르다');
});

test('갈래로 거를 수 있고, 빈 값이면 전체다', () => {
  const r = 명단([집({ ceo: '김대표', ceoEmail: 'ceo@x.com', primaryContactEmail: 'a@x.com' })]);
  assert.equal(C.누구로거르기(r.ok, '대표자').length, 1);
  assert.equal(C.누구로거르기(r.ok, '').length, 2);
});

test('★ 화면이 갈래를 «명단다듬기 뒤»에 가른다 — 보내는 것과 같은 자리', () => {
  /* 두 벌로 두면 화면엔 27곳인데 113곳에 나간다.
     ⚠ 「그 낱말이 어딘가 있나」로 보면 안 된다 — 명단화면 안에서 표를 가르느라
       누구로거르기 를 이미 세 번 부른다. 걸러야 하는 자리는 «명단셈» 하나다. */
  const i = news.indexOf('function 명단셈');
  assert.ok(i >= 0, '명단셈 을 찾을 수 없다');
  const fn = news.slice(i, news.indexOf('\nfunction ', i + 10));
  assert.match(fn, /누구별셈\(d\.ok\)/, '명단셈이 갈래를 안 센다 — 칩의 숫자가 빈다');
  assert.match(fn, /누구로거르기\(d\.ok, App\.누구\)/,
    '명단셈이 갈래로 안 거른다 — 화면만 갈라지고 «보내는 것»은 안 갈라진다');
});

test('★ 사업장 명단과 「따로 더한 분」을 «한 번에» 다듬는다 — 잣대가 하나', () => {
  /* 따로 걸러 뒤에 붙이면 사업장 담당자와 같은 주소인 분이 두 통을 받고,
     수신거부한 분이 이쪽으로 새어 나간다. */
  const i = news.indexOf('function 명단셈');
  const fn = news.slice(i, news.indexOf('\nfunction ', i + 10));
  assert.match(fn, /더한분들줄로\(App\.더한분들\)/, '따로 더한 분을 안 읽는다');
  assert.match(fn, /명단다듬기\(\s*g\.줄들\.concat\(/,
    '따로 더한 분을 사업장 명단과 «함께» 안 다듬는다 — 거르는 잣대가 둘이 된다');
});

test('★ 「전체 선택」은 «제 표 안»만 고른다 — 표가 셋이 되었으므로', () => {
  /* 문서 전체를 고르면 대표자 표의 머리를 눌렀는데 담당자 113줄이 함께 골라진다.
     ⚠ 표가 하나였을 때는 문서 전체가 «맞는» 방법이었다 — 그래서 조용히 되돌아가기 쉽다. */
  const i = news.indexOf('function 전체선택');
  assert.ok(i >= 0, '전체선택 을 찾을 수 없다');
  const fn = news.slice(i, news.indexOf('\nfunction ', i + 10));
  assert.match(fn, /closest\('table'\)/,
    '전체 선택이 제 표로 좁혀지지 않는다 — 한 표의 머리가 세 표를 다 고른다');
});

test('★ 「따로 더한 분」을 읽는 곳과 쓰는 곳이 «같은 자리»다', () => {
  assert.match(news, /db\.ref\('newsletter\/더한분들'\)/,
    '읽는 곳이 없다 — 자리 이름이 어긋나면 담아도 화면에 안 나온다');
  const 쓰 = news.match(/newsletter\/더한분들\//g) || [];
  assert.ok(쓰.length >= 3,
    '넣기·빼기·동의 세 길이 다 있어야 한다 (찾은 것 ' + 쓰.length + '곳)');
});

/* ══════ ④ 「따로 더한 분」 — 새 자리 ══════ */

test('★ 따로 더한 분도 «같은» 명단다듬기를 지난다 — 잣대가 하나다', () => {
  /* 두 곳에서 다르게 거르면 한 곳에서 뺀 사람이 다른 곳에서 받는다. */
  const 줄들 = C.더한분들줄로({
    k1: { 이름: '김선임', 소속: '더바름 노무법인', 직책: '대표 노무사', 주소: 'A@x.com' },
    k2: { 이름: '박OO', 주소: '엉망주소' },
    k3: { 이름: '이OO', 주소: 'a@x.com' }          /* k1 과 같은 주소(대소문자만 다름) */
  });
  const r = C.명단다듬기(줄들, {});
  assert.equal(r.ok.length, 1, '형식틀림과 겹침이 같은 자리에서 걸러져야 한다');
  assert.equal(r.셈.주소없음, 1);
  assert.equal(r.셈.겹침, 1);
  assert.equal(r.ok[0].누구, '더한분');
});

test('따로 더한 분은 사업장 명단과 «함께» 걸러진다 — 사업장 담당자와 겹치면 빠진다', () => {
  const g = C.사업장에서명단([집({ primaryContactEmail: 'a@x.com' })], '자문중');
  const 더 = C.더한분들줄로({ k1: { 이름: '누구', 주소: 'a@x.com' } });
  const r = C.명단다듬기(g.줄들.concat(더), {});
  assert.equal(r.ok.length, 1, '같은 사람이 두 통 받으면 안 된다');
  assert.equal(r.셈.겹침, 1);
});

test('따로 더한 분은 수신거부를 «똑같이» 지킨다', () => {
  const 더 = C.더한분들줄로({ k1: { 이름: '누구', 주소: 'no@x.com' } });
  const r = C.명단다듬기(더, { 'no@x.com': 1 });
  assert.equal(r.ok.length, 0);
  assert.equal(r.셈.수신거부, 1);
});

test('★ 담은 날과 열쇠가 살아 남는다 — 손으로 빼야 빠지는 «사본»이라서', () => {
  const 줄들 = C.더한분들줄로({ k9: { 이름: '누구', 주소: 'a@x.com', 담은날: '2026-09-09' } });
  const r = C.명단다듬기(줄들, {});
  assert.equal(r.ok[0].열쇠, 'k9', '열쇠가 없으면 화면에서 «뺄» 수가 없다');
  assert.equal(r.ok[0].담은날, '2026-09-09',
    '담은 날이 없으면 언제 확인해야 하는지 알 수 없다 — 계약처럼 저절로 빠지지 않는 자리다');
});

/* ══════ ⑤ 법 — 동의가 없으면 (광고)가 저절로 켜진다 ══════ */

test('★ 「동의 아직」이 하나라도 있으면 (광고) 표기가 켜진다 (정보통신망법 50조)', () => {
  const 더한것 = { k1: { 이름: '누구', 주소: 'a@x.com', 동의: false } };
  assert.equal(C.광고표기필요한가('자문중'), false, '자문중만이면 (광고)는 안 켜진다');
  assert.equal(C.광고표기필요한가('자문중', 더한것), true,
    '거래 관계 밖 사람이 섞였는데 (광고)가 안 켜졌다 — 대표님이 잊으실 자리를 기계가 막는다');
});

test('따로 더한 분이 모두 동의를 받았으면 (광고)는 안 켜진다', () => {
  const 더한것 = { k1: { 이름: '누구', 주소: 'a@x.com', 동의: true } };
  assert.equal(C.광고표기필요한가('자문중', 더한것), false);
});

test('제목도 그 판단을 따른다 — 두 곳이 다른 말을 하면 안 된다', () => {
  const 더한것 = { k1: { 주소: 'a@x.com', 동의: false } };
  assert.match(C.제목짓기({ 제목: '주간뉴스' }, '자문중', 더한것), /^\(광고\) /);
});

/* ══════ ⑥ 명함에서 찾기 — «후보만» 돌려준다 ══════ */

test('★ 명함에서 찾은 주소를 «저절로 담지 않는다» — 후보로만 돌려준다', () => {
  /* 회사 «이름»으로 맞춘 것이라 그렇다. 이름만 보고 옮겨 자문 계약이 남의 업체에
     들어간 일이 실제로 있었다(2026-09-05). 온톨로지 규칙이기도 하다. */
  const 사업장 = [집({ name: '㈜세라컴', ceo: '이강홍' })];
  const 명함 = [{ k: 'card', c: '주식회사 세라컴', n: '이강홍', ti: '대표이사', e: 'ceo@ceracomb.com' }];
  const 찾음 = C.명함에서주소찾기(사업장, 명함, '자문중');
  assert.equal(찾음.대표자.length, 1, '대표 계열 직책 명함을 못 찾았다');
  assert.equal(찾음.대표자[0].주소, 'ceo@ceracomb.com');
  assert.equal(찾음.대표자[0].사업장, 'c1', '어느 사업장 것인지 없으면 담을 자리를 모른다');

  const r = 명단(사업장);
  assert.equal(r.ok.length, 0, '찾기만 했는데 명단에 «저절로» 들어갔다');
});

test('이미 명단에 있는 주소는 후보로 내놓지 않는다', () => {
  const 사업장 = [집({ name: '가나', ceo: '김대표', ceoEmail: 'ceo@x.com' })];
  const 명함 = [{ k: 'card', c: '가나', n: '김대표', ti: '대표이사', e: 'CEO@x.com' }];
  const 찾음 = C.명함에서주소찾기(사업장, 명함, '자문중');
  assert.equal(찾음.대표자.length, 0, '이미 있는 주소를 또 권하면 대표님이 같은 것을 두 번 담는다');
});

test('대표 계열이 아닌 명함은 «담당자» 후보로 간다', () => {
  const 사업장 = [집({ name: '가나' })];
  const 명함 = [{ k: 'card', c: '가나', n: '박과장', ti: '과장', e: 'p@x.com' }];
  const 찾음 = C.명함에서주소찾기(사업장, 명함, '자문중');
  assert.equal(찾음.대표자.length, 0);
  assert.equal(찾음.담당자.length, 1);
});

test('사업자등록증(biz) 자료는 명함이 아니다 — 사람이 아니라 회사다', () => {
  const 명함 = [{ k: 'biz', c: '가나', ceo: '김대표', e: 'x@x.com' }];
  const 찾음 = C.명함에서주소찾기([집({ name: '가나' })], 명함, '자문중');
  assert.equal(찾음.대표자.length + 찾음.담당자.length, 0);
});

/* ══════ ⑦ 화면·자리 ══════ */

test('★ 따로 더한 분을 담는 자리가 «한 곳»이다', () => {
  assert.ok(/newsletter\/더한분들/.test(news),
    '담는 자리가 코드에 없다 — 자리 이름이 흩어지면 읽는 곳과 쓰는 곳이 어긋난다');
});

test('★ 기업정보함에서 명함을 뉴스레터 명단으로 보낼 수 있다', () => {
  /* ⚠ 「그 낱말이 어딘가 있나」로 보면 안 된다 — 함수 안의 안내 글에도 그 말이 있다.
       ★ 단추(메뉴 줄)와 그것이 부르는 함수를 «짝지어» 본다. */
  assert.match(cards, /onclick="closeFolderMenu\(\);selToNewsletter\(\)"[^<]*뉴스레터 명단에 넣기/,
    '⋯ 메뉴에 「뉴스레터 명단에 넣기」 줄이 없다 — 대표 지시 2026-09-09');
  assert.match(cards, /function selToNewsletter/, '그 단추가 부를 함수가 없다');
  const i = cards.indexOf('function selToNewsletter');
  const fn = cards.slice(i, i + 2600);
  assert.match(fn, /newsletter\/더한분들/,
    '뉴스레터의 「따로 더한 분」 자리에 안 담는다 — 담는 자리가 어긋나면 아무 데도 안 나온다');
  assert.match(fn, /state\.isAdmin/,
    '대표만 쓸 수 있게 막지 않았다 — newsletter/* 는 대표 전용이라 남은 오류만 본다');
});

test('★ 대표자 «전화» 열을 만들지 않는다 — 자료에 그 칸이 없다', () => {
  /* ceoPhone 은 사업장 375곳 어디에도 없다(실측 2026-09-09). 열을 두면 늘 「—」다.
     ⚠ 이 검사는 «영영 만들지 말라»가 아니다 — 칸이 채워지면 이 검사를 지우고 열을 넣는다.
        그때 왜 지우는지 알 수 있도록 까닭을 여기 적어 둔다. */
  const 명단화면 = (news.split('function 명단화면')[1] || '').split('\nfunction ')[0];
  assert.ok(명단화면, '명단화면을 못 찾았다');
  assert.ok(!/대표전화/.test(명단화면),
    '대표자 전화 열이 다시 생겼다 — ceoPhone 이 채워졌다면 이 검사를 지우고 열을 넣을 것');
});
