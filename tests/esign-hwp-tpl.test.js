'use strict';
// 문서관리(docs-esign) — 근로자별로 채우기 (대표 지시 2026-09-24 「문서관리 앱에도 넣어줄수있나」)
// 순수 함수만 검사한다. doc(rhwp HwpDocument) 은 흉내(mock) 낸다 — 실제 문서는 이 PC 한글로 열어 확인했다
// (기금 회의록 #1583·경력관리 #1584 와 같은 방법).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/esign-hwp-tpl.js');

test('mk·markerAt — 표지를 만들고 알아본다', () => {
  assert.equal(T.mk('이름'), '{{이름}}');
  assert.equal(T.markerAt('{{이름}} 뒤에 다른 글'), '이름');
  assert.equal(T.markerAt('표지가 아닌 글'), null);
  assert.equal(T.markerAt('{{' + '너'.repeat(31) + '}}'), null, '30자 넘는 이름은 표지로 안 본다');
});

test('stripLinesegs — 줄 정보 태그를 걷는다(빈 태그·안 든 태그 모두)', () => {
  assert.equal(T.stripLinesegs('<hp:p><hp:linesegarray><hp:lineseg a="1"/></hp:linesegarray></hp:p>'), '<hp:p></hp:p>');
  assert.equal(T.stripLinesegs('<hp:p><hp:linesegarray/></hp:p>'), '<hp:p></hp:p>');
  assert.equal(T.stripLinesegs('<hp:p>그대로</hp:p>'), '<hp:p>그대로</hp:p>');
});

test('valuesOf — 근로자 자료·사건 정보·체불액을 표지 이름으로 옮긴다', () => {
  const person = { name: '홍길동', idNo: '9001011234567', phone: '010-1111-2222', addr: '서울시 강남구', bank: '국민 123-456', joinDate: '2024-01-02', leaveDate: '2026-08-31', consentAt: '2026-09-20T10:30:00' };
  const meta = { title: '○○건설 임금체불', company: '○○건설(주)' };
  const arrears = { month1: 1000000, month2: 2000000, month3: '', severance: 500000 };
  const v = T.valuesOf(person, meta, arrears, new Date(2026, 8, 24));
  assert.equal(v.이름, '홍길동');
  assert.equal(v.주민등록번호, '900101-1234567');
  assert.equal(v.근로자연락처, '010-1111-2222');
  assert.equal(v.주소, '서울시 강남구');
  assert.equal(v.입금계좌, '국민 123-456');
  assert.equal(v.회사명, '○○건설(주)');
  assert.equal(v.사건명, '○○건설 임금체불');
  assert.equal(v.작성일, '2026-09-20', '동의일시가 있으면 그 날짜를 쓴다');
  assert.equal(v.동의일시, '2026-09-20 10:30');
  assert.equal(v.체불임금1개월차, '1,000,000');
  assert.equal(v.체불임금2개월차, '2,000,000');
  assert.equal(v.체불임금3개월차, '', '없는 달은 빈 글 — 0원으로 지어내지 않는다');
  assert.equal(v.체불퇴직금, '500,000');
  assert.equal(v.체불총액, '3,500,000');
});

test('valuesOf — 자료가 없으면 오늘 날짜·빈 글로 채운다(지어내지 않는다)', () => {
  const v = T.valuesOf({}, {}, {}, new Date(2026, 8, 24));
  assert.equal(v.이름, '');
  assert.equal(v.작성일, '2026-09-24', '동의일시가 없으면 오늘로');
  assert.equal(v.오늘, '2026-09-24');
  assert.equal(v.체불임금1개월차, '');
  assert.equal(v.착수금, '');
  assert.equal(v.성공보수율, '');
});

// ── doc(rhwp) 흉내 — 문서를 하나의 글로 보고 searchAllText/getTextRange/getTextInCell/replaceAll 을 흉내낸다 ──
function mockDoc(text, cellHits) {
  return {
    _text: text,
    searchAllText(q) {
      const hits = []; let i = 0;
      while ((i = this._text.indexOf(q, i)) >= 0) {
        const cell = (cellHits || []).find((c) => c.at === i);
        hits.push(cell ? { sec: 0, cellContext: { parentPara: 0, ctrlIdx: 0, cellIdx: cell.cellIdx, cellPara: 0 }, charOffset: 0 }
                       : { sec: 0, para: 0, charOffset: i });
        i += q.length;
      }
      return JSON.stringify(hits);
    },
    getTextRange(sec, para, off, len) { return this._text.slice(off, off + len); },
    getTextInCell(sec, parentPara, ctrlIdx, cellIdx, cellPara, off, len) {
      const cell = (cellHits || []).find((c) => c.cellIdx === cellIdx);
      return cell ? cell.text.slice(0, len) : '';
    },
    replaceAll(from, to) {
      const n = this._text.split(from).length - 1;
      this._text = this._text.split(from).join(to);
      return JSON.stringify({ count: n });
    }
  };
}

test('markersOf — 본문에 남은 표지를 모두 찾는다', () => {
  const doc = mockDoc('위임인 {{이름}} 님, 사건명 {{사건명}} — {{이름}}은 두 번 나와도 한 가지로 센다');
  const mk = T.markersOf(doc);
  assert.deepEqual(mk, { 이름: 2, 사건명: 1 });
});

test('markersOf — 표 칸(cellContext) 안의 표지도 찾는다', () => {
  // 본문에 실제로 «{{» 가 있어야 searchAllText 가 찾는다 — 칸 안 값은 getTextInCell 로 따로 읽는다
  const doc = mockDoc('AB{{ }}', [{ at: 2, cellIdx: 5, text: '{{체불총액}}' }]);
  assert.deepEqual(T.markersOf(doc), { 체불총액: 1 });
});

test('fillDoc — 값을 채우고, 채운 개수와 남은(모르는) 표지를 돌려준다', () => {
  const doc = mockDoc('{{이름}} {{사건명}} {{모르는표지}}');
  const r = T.fillDoc(doc, T.valuesOf({ name: '홍길동' }, { title: '사건A' }, {}, new Date(2026, 8, 24)));
  assert.ok(doc._text.includes('홍길동'));
  assert.ok(doc._text.includes('사건A'));
  assert.equal(r.unknown.length, 1);
  assert.equal(r.unknown[0], '모르는표지');
  assert.ok(r.filled >= 2);
});

test('fillDoc — 빈 값은 밑줄(＿＿＿)로 남긴다 — 지어내지 않는다', () => {
  const doc = mockDoc('{{입금계좌}}');
  const r = T.fillDoc(doc, T.valuesOf({}, {}, {}));
  assert.equal(doc._text, T.BLANK);
  assert.equal(r.filled, 0, '빈 값을 넣은 것은 «채운 것»으로 세지 않는다');
});
