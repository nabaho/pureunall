'use strict';
/* 한글 문서 읽기를 «실제로 돌려» 본다 (대표 지시 2026-09-18
   「홍길동 컨설턴트 참석확인서.hwp … 이 서류를 못 읽는다. 읽고 내용 넣을 수 있게 해달라」)
   ────────────────────────────────────────────────────────────────────────
   ■ 뿌리가 «둘»이었다 — 하나만 고치면 아무것도 안 달라진다.
     ⑴ 한글 파일을 읽는 길이 없었다(파일 «이름»만 보고 담았다)
     ⑵ 읽어도 «비용 화면에 담을 자리»가 없었다(saveOCRRecord 에 갈래가 없어 null)
        → 「읽었지만 이 화면에 담지 못했습니다」가 됐을 것이다.
   ■ ⚠★ 주민등록번호는 «보내기 전»에 가린다 — 실측 그 서류에 그대로 적혀 있었다.
   ⚠ 글자만 찾는 검사는 기능을 꺼도 통과한다 — 그래서 vm 에 올려 돌린다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const HT = require('../js/kcareer-hwptext.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'kcareer.html'), 'utf8');

function 떼기(머리) {
  const i = SRC.indexOf(머리);
  assert.ok(i > 0, 머리 + ' 를 못 찾았습니다');
  let d = 0, started = false;
  for (let p = i; p < SRC.length; p++) {
    const c = SRC[p];
    if (c === '{') { d++; started = true; }
    else if (c === '}') { d--; if (started && d === 0) return SRC.slice(i, p + 1); }
  }
  assert.fail(머리 + ' 의 끝을 못 찾았습니다');
}
function 올리기(ctx, 머리들) {
  vm.createContext(ctx);
  vm.runInContext(머리들.map(떼기).join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return ctx;
}

/* 한 줄짜리 구역 XML — 「글자」만 들어 있으면 된다 */
function 구역(글) {
  return '<hs:sec xmlns:hp="x"><hp:p><hp:run><hp:t>' + 글 + '</hp:t></hp:run></hp:p></hs:sec>';
}

/* ══════ ① 한글 파일 → 글자 (_hwpTextOf) ══════ */

function 한글무대(opts) {
  opts = opts || {};
  const 파일 = opts.파일 || { 'Contents/section0.xml': 구역('참석확인서 홍길동 회의수당 1,600,000') };
  const 기록 = { 열린이름: null };
  const ctx = {
    console: { warn: function () {} },
    window: { KcareerHwpText: HT },
    KcareerHwpText: HT,
    PureunHwp: {},
    _rhToHwpx: async function (bytes, name) {
      기록.열린이름 = name;
      if (opts.바꾸기못함) return null;
      if (opts.터짐) throw new Error('엔진 터짐');
      return new Uint8Array([1, 2, 3]);
    },
    _loadJSZip: async function () {},
    JSZip: {
      loadAsync: async function () {
        return {
          files: 파일,
          file: function (n) { return { async: async function () { return 파일[n]; } }; }
        };
      }
    }
  };
  if (opts.엔진없음) delete ctx.PureunHwp;
  if (opts.모듈없음) { ctx.window = {}; }
  올리기(ctx, ['async function _hwpTextOf(']);
  return { ctx: ctx, 기록: 기록,
           돌리기: function (name) {
             ctx.__n = name || '참석확인서.hwp';
             return vm.runInContext('_hwpTextOf(new Uint8Array([1]), __n)', ctx);
           } };
}

test('★★★ 한글 파일에서 글자를 뽑는다 — 이것이 없어서 「못 읽는다」였다', async () => {
  const m = 한글무대();
  const t = await m.돌리기();
  assert.ok(t && t.indexOf('회의수당') >= 0, '★ 문서에 적힌 글자가 그대로 나와야 합니다');
  assert.equal(m.기록.열린이름, '참석확인서.hwp', '엔진에 «이름»을 줘야 hwp/hwpx 를 가린다');
});

test('★★★ 구역이 여럿이면 «번호 차례»로 잇는다 — 이름 순서를 믿지 않는다', async () => {
  /* ⚠ 이름으로 줄 세우면 section10 이 section2 «앞»에 온다 — 서류가 뒤죽박죽이 된다 */
  const 파일 = {
    'Contents/section10.xml': 구역('열한번째쪽입니다'),
    'Contents/section2.xml': 구역('세번째쪽입니다'),
    'Contents/section0.xml': 구역('첫번째쪽입니다'),
    'Contents/header.xml': '<x/>'
  };
  const t = await 한글무대({ 파일: 파일 }).돌리기();
  assert.deepEqual(t.split('\n'), ['첫번째쪽입니다', '세번째쪽입니다', '열한번째쪽입니다']);
});

test('★★ 글자가 «모자라면» null — 부르는 쪽이 옛 길(파일명 등록)로 물러선다', async () => {
  const t = await 한글무대({ 파일: { 'Contents/section0.xml': 구역('짧다') } }).돌리기();
  assert.equal(t, null, '⚠ 빈 글자를 AI 에 보내면 «빈 기록»이 만들어집니다');
});

test('★★ 못 열거나 터지거나 구역이 없으면 null — «조용히» 옛 길로', async () => {
  assert.equal(await 한글무대({ 바꾸기못함: true }).돌리기(), null, '엔진이 hwpx 로 못 바꿈');
  assert.equal(await 한글무대({ 터짐: true }).돌리기(), null, '엔진이 터짐 — 여기서 멈추면 안 된다');
  assert.equal(await 한글무대({ 파일: { 'Contents/header.xml': '<x/>' } }).돌리기(), null, '구역이 없음');
});

test('★★ 엔진이나 모듈이 아직 없으면 null — 화면만 열어도 7MB 를 받아오면 안 된다', async () => {
  assert.equal(await 한글무대({ 엔진없음: true }).돌리기(), null);
  assert.equal(await 한글무대({ 모듈없음: true }).돌리기(), null);
});

/* ══════ ② 글자를 AI 에게 (_aiReadText) ══════ */

function 판독무대(prompt, 답) {
  const 기록 = { 보낸것: null };
  const ctx = {
    console: { warn: function () {} },
    KcareerHwpText: HT,
    firebase: { auth: function () { return {}; } },
    kcFetch: async function () { return { ok: true }; },
    PuAiCall: {
      ask: async function (parts) { 기록.보낸것 = parts; return { 답: 답 }; },
      textOf: function (r) { return r.답; }
    }
  };
  올리기(ctx, ['async function _aiReadText(']);
  ctx.__p = prompt;
  ctx.__t = '○ 성 명 : 홍길동\n○ 주민등록번호 : 800101-1234567\n회의수당 : 400,000 x 4 = 1,600,000';
  return { ctx: ctx, 기록: 기록,
           돌리기: function () { return vm.runInContext('_aiReadText(__p, __t)', ctx); } };
}

test('★★★ 주민등록번호를 «보내기 전»에 가린다 — 회의비를 읽는 데 필요 없다', async () => {
  const m = 판독무대('이 영수증·청구서에서 비용 내역을 읽어', '{"amt":"1600000"}');
  await m.돌리기();
  const 보낸글 = m.기록.보낸것.map(function (p) { return p.text; }).join('\n');
  assert.ok(보낸글.indexOf('800101') < 0, '★★★ 주민번호가 AI 로 나갔습니다');
  assert.ok(보낸글.indexOf('1234567') < 0);
  assert.ok(보낸글.indexOf('1,600,000') > 0, '정작 읽어야 할 금액은 그대로 가야 합니다');
});

test('★★★ 주민번호를 «묻는» 화면에서는 가리지 않는다 — 그 화면은 그것을 읽어야 한다', async () => {
  const m = 판독무대('{"number":"주민번호앞7자리"}', '{"number":"800101-1"}');
  await m.돌리기();
  const 보낸글 = m.기록.보낸것.map(function (p) { return p.text; }).join('\n');
  assert.ok(보낸글.indexOf('800101-1234567') > 0, '⚠ 가리면 신분증 화면이 영영 못 읽습니다');
});

test('★★ 사전과 글자를 «함께» 보낸다 — 사전이 빠지면 아무 표나 만들어 온다', async () => {
  const m = 판독무대('(내 사전)', '{"org":"가"}');
  const r = await m.돌리기();
  assert.ok(m.기록.보낸것.length >= 2, '사전 + 글자');
  assert.equal(m.기록.보낸것[0].text, '(내 사전)');
  /* ⚠ vm 안에서 만들어진 객체라 deepEqual 로는 «모양이 같아도» 다르다고 나온다 — 값을 본다 */
  assert.equal(r.parsed.org, '가');
});

test('★★ 앞뒤에 말이 붙어 와도 JSON 만 골라 읽는다 · 표 모양이 아니면 «까닭»을 준다', async () => {
  const j = await 판독무대('사전', '네, 읽었습니다 {"org":"교육부"} 입니다').돌리기();
  assert.equal(j.parsed.org, '교육부');
  const r = await 판독무대('사전', '읽지 못했습니다').돌리기();
  assert.ok(r.err && /표 모양/.test(r.err), '⚠ null 만 돌려주면 «왜» 안 됐는지 아무도 모릅니다');
});

test('★★ 길면 잘라 보낸다 — 끝없이 보내지 않는다', async () => {
  const m = 판독무대('사전', '{"org":"가"}');
  m.ctx.__t = '가'.repeat(HT.MAX + 500);
  await m.돌리기();
  const 글 = m.기록.보낸것[1].text;
  assert.ok(글.length < HT.MAX + 300, '뚜껑이 없습니다');
  assert.ok(/여기까지만 읽었습니다/.test(글), '잘랐다고 말해야 합니다');
});

/* ══════ ③ 「읽은 것이 쓸 만한가」 (_ocrGot) ══════ */

test('★★★ 비용 서류는 «지출처가 비어도» 읽은 것으로 친다', () => {
  const ctx = 올리기({}, ['function _ocrGot(']);
  const got = function (p) { ctx.__p = p; return vm.runInContext('_ocrGot(__p)', ctx); };
  /* ⚠ 예전에는 org·title·school·name·bank·kind 여섯만 봤다 — 금액·내용을 다 읽고도
     지출처가 비면 통째로 버려져 「파일명 등록」으로 떨어졌다. */
  assert.equal(got({ date: '2026.09.18', content: '현장 컨설팅 참석', amt: '1600000', org: '' }), true);
  assert.equal(got({ amt: '1600000' }), true);
  assert.equal(got({ org: '교육부' }), true);
  assert.equal(got({ issuer: '충남경제진흥원' }), true, '증명서의 이름 칸');
  assert.equal(got({ agency: '한국능률협회' }), true, '외부기관 실적의 이름 칸');
});

test('★★ 날짜 «하나만» 으로는 읽었다고 하지 않는다 — 아무 기록도 못 만든다', () => {
  const ctx = 올리기({}, ['function _ocrGot(']);
  const got = function (p) { ctx.__p = p; return vm.runInContext('_ocrGot(__p)', ctx); };
  assert.equal(got({ date: '2026.09.18' }), false);
  assert.equal(got({}), false);
  assert.equal(got(null), false);
});

/* ══════ ④ 비용 화면에 «담는다» (saveOCRRecord) ══════ */

function 담기무대() {
  const 통 = { meetfee: [], etcfee: [], wiccok: [], cert: [] };
  const 파일들 = [];
  const ctx = {
    console: { warn: function () {} },
    Date: Date, String: String, Number: Number, Math: Math, JSON: JSON, RegExp: RegExp, parseInt: parseInt,
    get: function (k) { return 통[k] || (통[k] = []); },
    set: function (k, v) { 통[k] = v; },
    _safe: function (f) { try { return f(); } catch (e) { return null; } },
    kcIsStaff: function () { return false; },
    hasOriginal: function () { return false; },
    saveFileUnified: async function (id, f) { 파일들.push({ id: id, name: f.name, ext: f.ext }); },
    dupKey: function (r) { return (r.org || '') + '|' + (r.content || r.title || '') + '|' + (r.date || ''); },
    nextId: function (pre, store) { return pre + String((통[store] || []).length + 1).padStart(4, '0'); },
    wiccokId: function (t, y) { return t + y + '-001'; },
    splitPeriod: function () { return ['', '']; },
    termEnd: function () { return ''; },
    FORM_DEFS: {
      meetfee: { prefix: 'MF', fields: [{ key: 'date' }, { key: 'type', default: '회의' }] },
      etcfee: { prefix: 'EF', fields: [{ key: 'date' }, { key: 'type', default: '기타' }] }
    }
  };
  올리기(ctx, ['async function saveOCRRecord(']);
  return { ctx: ctx, 통: 통, 파일들: 파일들,
           담기: function (page, parsed, name) {
             ctx.__a = [page, parsed, { name: name || '참석확인서.hwp', size: 71168 }, 'hwp', 'QUJD'];
             return vm.runInContext('saveOCRRecord(__a[0],__a[1],__a[2],__a[3],__a[4])', ctx);
           } };
}

test('★★★ 회의비 화면에 «담긴다» — 여태 담을 자리가 아예 없었다(null)', async () => {
  const m = 담기무대();
  const id = await m.담기('meetfee',
    { date: '2026.09.18', type: '회의수당', content: '현장 컨설팅 참석 4개사', amt: '1,600,000', org: '충남경제진흥원' });
  assert.ok(id && String(id).indexOf('MF') === 0, '★ null 이면 「담지 못했습니다」가 됩니다 (받은 값: ' + id + ')');
  const r = m.통.meetfee[0];
  assert.equal(r.date, '2026.09.18');
  assert.equal(r.content, '현장 컨설팅 참석 4개사');
  assert.equal(r.org, '충남경제진흥원');
  assert.equal(r.year, '2026', '연도 거르개가 쓸 값');
});

test('★★★ 「회의수당」을 «칸이 아는 말»로 다듬는다 — 고르는 칸이라 목록 밖 값은 못 쓴다', async () => {
  const m = 담기무대();
  const 구분 = async function (v) {
    await m.담기('meetfee', { date: '2026.01.01', content: '내용' + v, type: v, amt: '1' });
    return m.통.meetfee[0].type;
  };
  assert.equal(await 구분('회의수당'), '회의');
  assert.equal(await 구분('강의료'), '회의');
  assert.equal(await 구분('출장여비'), '출장');
  assert.equal(await 구분('중식대'), '식대');
  assert.equal(await 구분('주차비'), '교통');
  assert.equal(await 구분('알 수 없는 말'), '기타');
});

test('★★ 구분을 못 읽으면 «서식에 적힌» 기본값을 쓴다 (회의비=회의 · 기타비용=기타)', async () => {
  const m = 담기무대();
  await m.담기('meetfee', { date: '2026.01.01', content: '가', type: '' });
  assert.equal(m.통.meetfee[0].type, '회의');
  await m.담기('etcfee', { date: '2026.01.02', content: '나', type: '' });
  assert.equal(m.통.etcfee[0].type, '기타');
  assert.ok(String(m.통.etcfee[0].id).indexOf('EF') === 0, '기타비용은 제 통·제 번호에 담긴다');
});

test('★★ 금액은 «숫자만» 남긴다 — 「1,600,000원」이 그대로면 합계를 못 센다', async () => {
  const m = 담기무대();
  await m.담기('meetfee', { date: '2026.01.01', content: '가', amt: '1,600,000원' });
  assert.equal(m.통.meetfee[0].amt, '1600000');
  await m.담기('etcfee', { date: '2026.01.01', content: '나', amt: '' });
  assert.equal(m.통.etcfee[0].amt, '');
});

test('★★ 한글 원본이 그 줄에 «붙는다» — 나중에 원본 보기로 열 수 있어야 한다', async () => {
  const m = 담기무대();
  await m.담기('meetfee', { date: '2026.09.18', content: '참석', amt: '1' }, '참석확인서.hwp');
  assert.equal(m.통.meetfee[0].fname, '참석확인서.hwp');
  assert.deepEqual(m.파일들[0], { id: m.통.meetfee[0].id, name: '참석확인서.hwp', ext: 'hwp' });
});

test('★★ 같은 비용을 두 번 넣으면 «새로 만들지 않는다»', async () => {
  const m = 담기무대();
  const 값 = { date: '2026.09.18', content: '현장 컨설팅 참석', amt: '1600000', org: '충남' };
  await m.담기('meetfee', 값);
  const 두번째 = await m.담기('meetfee', 값);
  assert.equal(m.통.meetfee.length, 1, '⚠ 같은 영수증이 두 줄로 쌓이면 안 됩니다');
  assert.ok(두번째 && 두번째.dup === true);
});

/* ══════ ⑤ 증명서 화면도 한글을 읽는다 (_cdFileBytes) ══════ */

function 증명서무대(g) {
  const 기록 = { 이름: null, 알림: [] };
  const ctx = {
    console: { warn: function () {} },
    Uint8Array: Uint8Array,
    toast: function (m) { 기록.알림.push(m); },
    b64ToAb: function () { return [1, 2, 3]; },
    fsRoot: async function () { return null; },
    getFileAsync: async function () { return g; },
    _hwpTextOf: async function (bytes, nm) { 기록.이름 = nm; return '실적증명서 충남경제진흥원 2026.09.01'; }
  };
  올리기(ctx, ['async function _cdFileBytes(']);
  ctx.__r = { id: 'CD1' };
  return { ctx: ctx, 기록: 기록,
           돌리기: function () { return vm.runInContext('_cdFileBytes(__r)', ctx); } };
}

test('★★★ 한글 증명서도 «글자»로 읽는다 — 기관이 주는 증명서는 한글 파일이 흔하다', async () => {
  const m = 증명서무대({ base64: 'QUJD', ext: 'hwp', name: '실적증명서.hwp' });
  const got = await m.돌리기();
  assert.ok(got && got.txt && got.txt.indexOf('실적증명서') === 0,
    '★ null 이면 「손으로 입력해 주세요」로 막힙니다');
  assert.equal(m.기록.이름, '실적증명서.hwp', '엔진에 이름을 줘야 hwp/hwpx 를 가린다');
  assert.ok(!got.b64, '⚠ 글자가 있으면 그림으로 보내지 않습니다');
});

test('★★ 이름이 이상해도 한글로 열어 본다 · 못 뽑으면 «까닭»을 말한다', async () => {
  const m = 증명서무대({ base64: 'QUJD', ext: 'hwpx', name: '이름없음' });
  await m.돌리기();
  assert.equal(m.기록.이름, '문서.hwpx', '⚠ 이름에 확장자가 없으면 엔진이 형식을 못 가립니다');
  const m2 = 증명서무대({ base64: 'QUJD', ext: 'hwp', name: 'a.hwp' });
  m2.ctx._hwpTextOf = async function () { return null; };
  assert.equal(await m2.돌리기(), null);
  assert.ok(/글자를 뽑지 못했습니다/.test(m2.기록.알림.join('')), '⚠ 빈 화면은 고장으로 읽힙니다');
});

test('★★ 그림·PDF 증명서는 «예전 그대로» 그림으로 간다 · DOCX 는 여전히 못 읽는다', async () => {
  const pdf = await 증명서무대({ base64: 'QUJD', ext: 'pdf', name: 'a.pdf' }).돌리기();
  assert.equal(pdf.mime, 'application/pdf');
  assert.equal(pdf.b64, 'QUJD');
  assert.ok(!pdf.txt);
  const m = 증명서무대({ base64: 'QUJD', ext: 'docx', name: 'a.docx' });
  assert.equal(await m.돌리기(), null);
  assert.ok(/DOCX/.test(m.기록.알림.join('')), '무엇이 안 되는지 말해야 합니다');
});

test('★★ 증명서 다시읽기는 «글자면 글자로» 보낸다', () => {
  assert.match(떼기('async function cdReOcr('),
    /_geminiOCR\(PAGE_OCR_PROMPT\.certdoc,\s*got\.b64,\s*got\.mime,\s*null,\s*got\.txt\)/,
    '⚠ got.txt 를 안 넘기면 뽑아 놓고 «안 쓰는» 셈입니다');
});

/* ══════ ⑥ 네 문이 «같은 한 곳»을 쓴다 ══════ */

test('★★★ 한글을 읽는 문 넷이 모두 _hwpTextOf 를 쓴다 — 갈라지면 여기선 되고 저기선 안 된다', () => {
  const 문 = ['async function ocrDrop(', 'async function reOcrForm(',
              'async function extractTextForm(', 'async function _cdFileBytes('];
  문.forEach(function (f) {
    assert.match(떼기(f), /_hwpTextOf\(/, f + ' 이 한글을 못 읽습니다');
  });
  /* 뽑는 곳은 «한 곳»이다 — 정의 하나 + 부르는 곳 넷 */
  assert.equal((SRC.match(/_hwpTextOf\(/g) || []).length, 5,
    '⚠ 한글에서 글자를 뽑는 코드를 새로 만들지 마세요 — _hwpTextOf 를 부르세요');
});

test('★★★ 한글은 «그림 사슬»로 내려가지 않는다 — Vision·Claude 에 헛돈이 나간다', () => {
  const d = 떼기('async function ocrDrop(');
  const i = d.indexOf("if(['hwp','hwpx'].includes(ext))");
  assert.ok(i > 0, '한글 갈래가 있어야 합니다');
  const 갈래 = d.slice(i, d.indexOf('\n    }', i));
  assert.match(갈래, /continue;/, '⚠ 여기서 끝내지 않으면 한글 바이트가 «그림»으로 보내집니다');
  /* ⚠★ 판독에 «뽑은 글자»를 넘겨야 한다 — 그림 자리(b64)로 넘기면 한글 파일 바이트가
     그대로 AI 에 사진으로 간다(읽히지도 않고 돈만 나간다). */
  assert.match(갈래, /_geminiOCR\(prompt,null,null,null,글\)/,
    '⚠ 한글은 «글자»로 보내야 합니다 — 다섯째 자리가 글자 자리입니다');
  /* ⚠ 못 읽었을 때 예전 길(파일명 등록)이 그대로 남아 있어야 한다 */
  assert.match(갈래, /quickParseFilename\(file\.name,page\)/,
    '⚠ 못 읽으면 예전처럼 파일명으로라도 담아야 합니다 — 되던 것이 멈추면 안 됩니다');
});

test('★★ 한글 원본도 «다른 해면 먼저 묻는» 빗장을 지난다', () => {
  const fn = 떼기('async function reOcrForm(');
  const 한글 = fn.indexOf("if(['hwp','hwpx'].indexOf(ext)>=0)");
  const 물음 = fn.indexOf('다른 해»입니다');
  assert.ok(한글 > 0 && 물음 > 한글,
    '⚠ 한글 갈래가 먼저 돌아가 버리면 잘못 붙은 원본이 한 해를 조용히 덮습니다');
  assert.ok(fn.indexOf('return _reOcrApply') < 0, '⚠ 빗장을 건너뛰는 지름길을 만들지 마세요');
});

test('★★ 「📄 원문 텍스트」는 한글이면 AI 를 «부르지 않는다» — 글자가 이미 있다', () => {
  const fn = 떼기('async function extractTextForm(');
  const 한글 = fn.indexOf("if(['hwp','hwpx'].indexOf(ext)>=0)");
  const 부름 = fn.indexOf('PuAiCall.ask');
  assert.ok(한글 > 0 && 부름 > 한글, '한글 갈래가 먼저 와야 합니다');
  assert.match(fn.slice(한글, 부름), /_fsTextShow\(box, _ht\)[\s\S]*?return;/,
    '⚠ 뽑은 글자를 바로 보여 주고 끝내야 합니다');
});
