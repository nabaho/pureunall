'use strict';
/* 빈 양식 HWPX 채워 다시 묶기(js/pu-gov-report-pack.js) — 합성 HWPX 만 쓴다(공개 저장소: 실제 양식·업체 자료 금지) */
const test = require('node:test');
const assert = require('node:assert/strict');
const JSZip = require('../vendor/jszip.min.js');
const K = require('../js/pu-gov-report-pack.js');

const LS = '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" horzsize="40000"/></hp:linesegarray>';
const P = (inner) => '<hp:p id="0" paraPrIDRef="0">' + inner + LS + '</hp:p>';
const RUN = (t) => '<hp:run charPrIDRef="0"><hp:t>' + t + '</hp:t></hp:run>';
const EMPTY = '<hp:run charPrIDRef="0"/>';
const cell = (t) => '<hp:tc><hp:subList>' + P(t == null ? EMPTY : RUN(t)) + '</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/></hp:tc>';
const tbl = (...ts) => P('<hp:run><hp:tbl><hp:tr>' + ts.map(cell).join('') + '</hp:tr></hp:tbl></hp:run>');
const PIC = '<hp:pic><hc:img binaryItemIDRef="image2"/></hp:pic>';

/* 충남북부 주소 꼴의 최소 합성 양식: 표 6개(T0~T5) 다음에 문단(P6~) */
function section(withCells) {
  const d = '2025년   월   일', chk = '□방문 □서면';
  const t1 = withCells === false ? ['칸없음'] : ['업체명', null, '사업자번호', ' ', '대표자', null, '업종', null, '소재지', null,
    '근로자수', null, '담당자', null, '부서', null, '일자', '1회', d, chk, '2회', d, chk, '3회', d, chk];
  return '<hs:sec>' + tbl('제목') + tbl(...t1) + tbl(' 1. 문의', null) + tbl(' 2. 내역', '1회', null, '2회', null, '3회', null) +
    tbl(' 3. 종합', '검토', '조치', '산출물', null, null, null) + tbl(' 4. 기타', null) +
    P(EMPTY) + P(EMPTY) + P(RUN('위와 같이')) + P(EMPTY) + P(RUN(d)) + P(EMPTY) + P(EMPTY) +
    P(RUN('경영상담역      (서명)')) + P(EMPTY) + P(EMPTY) + P(RUN('(참여기업) 대표자:      (서명)')) + '</hs:sec>';
}

const report = () => ({
  company: { name: '가나상사', bizNo: '123-45-67890', ceo: '김가나', bizType: '제조업', address: '충남 천안시 가나로 1',
    workers: 12, contact: '박길동', contactTitle: '총무팀장' },
  consultant: '이푸른', writtenAt: '2025-11-20',
  rounds: [
    { date: '2025-09-04', visit: true, inquiry: '문의', diagnosis: '진단', advice: '자문1', result: '', next: '' },
    { date: '2025-10-02', visit: false, inquiry: '', diagnosis: '', advice: '자문2', result: '', next: '' },
    { date: '2025-11-06', visit: true, inquiry: '', diagnosis: '', advice: '자문3', result: '결과', next: '' },
  ],
  summary: { inquiryDiag: '진단종합', review: '검토', action: '조치', outputs: ['산출물1'], etc: '없음' },
});

const HPF = '<opf:package><opf:metadata><opf:title>지난 제목</opf:title><opf:meta name="creator" content="text">지난 사람</opf:meta></opf:metadata>' +
  '<opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>' +
  '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/>' +
  '<opf:item id="image1" href="BinData/image1.png" media-type="image/png"/>' +
  '<opf:item id="image2" href="BinData/image2.png" media-type="image/png"/>' +
  '<opf:item id="prv" href="Preview/PrvImage.png" media-type="image/png"/></opf:manifest></opf:package>';

async function makeHwpx(xml) {
  const z = new JSZip();
  /* 일부러 mimetype 을 첫 자리에 넣지 않는다 — 묶을 때 앞으로 와야 한다 */
  z.file('Contents/section0.xml', xml || section());
  z.file('Contents/header.xml', '<hh:head/>');
  z.file('Preview/PrvText.txt', '지난 글');
  z.file('Preview/PrvImage.png', new Uint8Array([137, 80, 78, 71, 1, 2, 3]));
  z.file('BinData/image1.png', new Uint8Array([1, 2, 3]));
  z.file('BinData/image2.png', new Uint8Array([4, 5, 6]));
  z.file('Contents/content.hpf', HPF);
  z.file('mimetype', 'application/hwp+zip');
  return z.generateAsync({ type: 'uint8array' });
}

test('fillHwpx: mimetype 첫 항목·무압축, 값이 들고 {{ 없음', async () => {
  const { bytes, result } = await K.fillHwpx(await makeHwpx(), 'cci-north', 'main', report(), JSZip);
  const z = await JSZip.loadAsync(bytes);
  const first = Object.keys(z.files)[0];
  assert.equal(first, 'mimetype');
  assert.equal(z.files.mimetype._data.compression.magic, '\x00\x00', 'STORE');
  assert.equal(await z.file('mimetype').async('string'), 'application/hwp+zip');
  const sec = await z.file('Contents/section0.xml').async('string');
  assert.ok(sec.includes('가나상사') && sec.includes('자문3'));
  assert.ok(!sec.includes('{{'));
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.unknown, []);
  assert.equal(result.xml, undefined);
  assert.equal(await z.file('Contents/header.xml').async('string'), '<hh:head/>', '다른 항목은 그대로');
});

test('fillHwpx: 미리보기 그림 없음 · PrvText 비움 · hpf 제목·메타 비움', async () => {
  const { bytes } = await K.fillHwpx(await makeHwpx(), 'cci-north', 'main', report(), JSZip);
  const z = await JSZip.loadAsync(bytes);
  assert.ok(!Object.keys(z.files).some((n) => /^Preview\/PrvImage/.test(n)));
  assert.equal(await z.file('Preview/PrvText.txt').async('string'), '');
  const hpf = await z.file('Contents/content.hpf').async('string');
  assert.ok(hpf.includes('<opf:title></opf:title>'));
  assert.ok(!hpf.includes('지난 제목') && !hpf.includes('지난 사람'));
  assert.ok(hpf.includes('<opf:meta name="creator" content="text"></opf:meta>'));
  assert.ok(!hpf.includes('PrvImage'));
});

test('BinData: 안 쓰는 것만 지우고 헤더가 쓰는 것은 둔다(hpf item 포함)', async () => {
  /* section 의 그림은 채울 때 걷히므로 image2 는 쓰는 곳이 없다. image1 은 header 가 쓴다고 하자 */
  const z0 = await JSZip.loadAsync(await makeHwpx(section().replace('<hs:sec>', '<hs:sec>' + PIC)));
  z0.file('Contents/header.xml', '<hh:head><hc:img binaryItemIDRef="image1"/></hh:head>');
  const { bytes } = await K.fillHwpx(await z0.generateAsync({ type: 'uint8array' }), 'cci-north', 'main', report(), JSZip);
  const z = await JSZip.loadAsync(bytes), hpf = await z.file('Contents/content.hpf').async('string');
  assert.ok(z.file('BinData/image1.png') && hpf.includes('BinData/image1.png'), '쓰는 image1 은 둔다');
  assert.ok(!z.file('BinData/image2.png'), '안 쓰는 image2 는 지운다');
  assert.ok(!hpf.includes('BinData/image2.png'));
  assert.ok(hpf.includes('Contents/section0.xml'));
});
test('checkTemplate: 칸 없는 양식 → missing, 제 양식 → 없음', async () => {
  const bad = await K.checkTemplate(await makeHwpx(section(false)), 'cci-north', 'main', JSZip);
  assert.ok(bad.missing.length > 0);
  assert.equal(bad.sections, 1);
  const ok = await K.checkTemplate(await makeHwpx(), 'cci-north', 'main', JSZip);
  assert.deepEqual(ok.missing, []);
});

test('b64 왕복은 바이트를 지킨다', () => {
  const u = new Uint8Array(20000); for (let i = 0; i < u.length; i++) u[i] = (i * 7 + 3) & 255;
  const back = K.b64ToBytes(K.bytesToB64(u));
  assert.equal(back.length, u.length);
  assert.ok(Buffer.from(back).equals(Buffer.from(u)));
});