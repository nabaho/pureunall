'use strict';
/* 편집창 왼쪽 미리보기 — 한글 첨부가 «막다른 길»이던 것 (대표 제보 2026-09-18
   「미리보기 안되었어 어떻게 해야될지 모르겠다」)

   ■ ⚠★ 또 «길이 둘»이었다 — 한쪽만 고쳐져 있었다
     원본을 담는 길이 둘인데(앱 안 첨부 / 폴더 경로) 미리보기를 그리는 코드도 둘이다:
       ⑴ _renderFormPreview     — 앱 안 첨부(IndexedDB)
       ⑵ _renderFsFormPreview   — 폴더 경로(src:'fs')
     2026-09-12 `ac0e529e` 는 ⑵ 에만 「↗ 원본 열기」를 달았다. ⑴ 은 pdf·그림이 아니면
     「📎 이름 (미리보기 미지원 형식)」 한 줄을 띄우고 «단추가 하나도 없었다».
     그래서 대표가 실제로 겪으신 그대로 — 볼 수도 없고 할 수 있는 것도 없다.
     `136a8f4a`·`ac0e529e` 와 «같은 뿌리»다.

   ■ ⚠★ 게다가 한글은 «미지원이 아니다»
     앱에 진짜 한글 엔진(rhwp)이 있고 openOriginal 이 이미 .hwp·.hwpx 를
     openHwpViewer 로 보낸다. 엔진이 있는데 안내문만 띄우고 있었다
     (`d46e4b8` ③ 에서 오른쪽 편집기에 대해 한 번 지적된 잘못이 여기 남아 있었다).

   ■ ⚠★ 그렇다고 «저절로» 그리면 안 된다
     엔진은 7MB WASM 이다. 편집창을 여는 것만으로 받아오면 안 된다
     (CLAUDE.md 「7MB 엔진을 몰래 받아오지 말 것」). 그래서 «단추»를 준다.

   ⚠ 글자만 찾는 검사는 기능을 꺼도 통과한다 — 그래서 vm 에 올려 «돌려» 본다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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

/* 아주 작은 가짜 화면 — 그린 글(innerHTML)만 보면 된다 */
function 무대(파일) {
  const box = { innerHTML: '' };
  const 기록 = { 엔진부름: 0, pdf: 0 };
  const ctx = {
    console: { warn: function () {} },
    String: String, JSON: JSON, RegExp: RegExp,
    setTimeout: function (f) { f(); },
    document: { getElementById: function (id) { return id === 'fsPrevBox' ? box : null; } },
    escapeHtml: function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, '_'); },
    getFile: function () { return 파일; },
    getFileAsync: async function () { return 파일; },
    fileURL: function () { return 'blob:x'; },
    showPDFInline: function () { 기록.pdf++; },
    showBig: function () {},
    _jsAttr: function (s) { return String(s || ''); },
    /* ⚠ 이것들이 불리면 «7MB 엔진을 몰래 받아온» 것이다 */
    openHwpViewer: function () { 기록.엔진부름++; },
    PureunHwp: { renderPreview: function () { 기록.엔진부름++; } },
    _renderFsFormPreview: function () { throw new Error('앱 안 첨부인데 폴더 길로 샜습니다'); }
  };
  vm.createContext(ctx);
  vm.runInContext(['function _isHwpName(', 'function _renderFormPreview(']
    .map(떼기).join('\n').replace(/^(\s*)const /gm, '$1var '), ctx);
  return {
    ctx: ctx, box: box, 기록: 기록,
    그리기: function (rec) {
      ctx.__r = rec || { id: 'MF0001' };
      vm.runInContext('_renderFormPreview(__r.id, __r)', ctx);
      return box.innerHTML;
    }
  };
}

const 한글 = { id: 'MF0001', name: '권형하 컨설턴트 참석확인서.hwp', ext: 'hwp', base64: 'QUJD' };

test('★★★ 한글 첨부에 «볼 수 있는 단추»가 있다 — 여태 막다른 길이었다', () => {
  const m = 무대(한글);
  const html = m.그리기();
  assert.ok(/onclick/.test(html),
    '★ 단추가 하나도 없으면 대표님이 하실 수 있는 일이 없습니다.\n   그린 것: ' + html);
  assert.ok(/openOriginal/.test(html),
    '★ 앱에 한글 뷰어(openHwpViewer)가 있고 openOriginal 이 이미 그리로 보냅니다 —\n' +
    '   길을 새로 짜지 말고 그것을 부르세요. 그린 것: ' + html);
  /* ⚠ 단추에 «무엇이 열리는지» 적어야 한다 — 「↗ 원본 열기」는 브라우저가 못 여는
     파일을 내려받는 것처럼 읽힌다(여태 실제로 그랬다). 사람이 먼저 읽는 것은 딱지다. */
  const 딱지 = (html.match(/>([^<>]*)<\/button>/) || [])[1] || '';
  assert.ok(/한글/.test(딱지),
    '★ 한글 문서라면 단추에 그렇게 적으세요 — 「원본 열기」로는 앱 안에서 열린다는 것을\n' +
    '   알 수 없습니다. 지금 딱지: ' + JSON.stringify(딱지));
});

test('★★★ 한글은 «미지원»이라 말하지 않는다 — 엔진이 있는데 안내문만 띄우던 것', () => {
  const m = 무대(한글);
  const html = m.그리기();
  assert.ok(!/미지원/.test(html),
    '★ 한글은 이 앱이 «그릴 수 있는» 서식입니다. 미지원이라 하면 사람이 포기합니다.\n' +
    '   그린 것: ' + html);
  assert.ok(html.indexOf('참석확인서') > 0, '어느 파일인지는 밝혀야 합니다');
});

test('★★★ 편집창을 여는 것만으로 7MB 엔진을 받아오지 않는다', () => {
  /* ⚠ 이 빗장을 풀면 비용 한 줄을 고치려고 열 때마다 7MB 를 내려받는다 */
  const m = 무대(한글);
  m.그리기();
  assert.equal(m.기록.엔진부름, 0,
    '★ 그리는 순간 엔진을 부르면 안 됩니다 — 사람이 «단추를 눌렀을 때»만 부릅니다');
});

test('★★ 정말 모르는 서식도 막다른 길이 아니다 — 열기·저장 길을 준다', () => {
  const m = 무대({ id: 'X1', name: '알수없는것.zip', ext: 'zip', base64: 'QUJD' });
  const html = m.그리기();
  assert.ok(/미지원/.test(html), '이건 정말 못 그립니다 — 그렇다고 말해야 합니다');
  assert.ok(/onclick/.test(html),
    '★ 못 그리는 것과 «할 수 있는 일이 없는 것»은 다릅니다. 그린 것: ' + html);
});

test('★ pdf·그림은 하던 대로 그린다 — 되던 것이 뒷걸음질하면 안 된다', () => {
  const p = 무대({ id: 'P1', name: 'a.pdf', ext: 'pdf', base64: 'QUJD' });
  p.그리기();
  assert.equal(p.기록.pdf, 1, 'PDF 는 그대로 인라인으로 그립니다');
  const g = 무대({ id: 'G1', name: 'a.png', ext: 'png', base64: 'QUJD' });
  assert.ok(/<img/.test(g.그리기()), '그림은 그대로 보여 줍니다');
});

test('★ 폴더 경로 원본은 «폴더 길»로 보낸다 — 두 길을 섞지 않는다', () => {
  const m = 무대(한글);
  m.ctx._renderFsFormPreview = function () { m.기록.폴더길 = true; };
  m.그리기({ id: 'W1', src: 'fs', relPath: '1. 위촉장/가.hwp' });
  assert.ok(m.기록.폴더길, '폴더 경로는 그때그때 폴더에서 읽어야 합니다');
});
