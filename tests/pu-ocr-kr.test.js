'use strict';
/* 한국어 OCR 모듈(js/pu-ocr-kr.js) — 모델 없이 도는 순수 함수와 앱 배선.
 * (대표 2026-09-27 「앱 안에 넣기」 — 스캔본 58개 겨루기에서 kordoc 방식이 tesseract 보다 칸 31% 더·번호 오독 0) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const O = require('../js/pu-ocr-kr.js');
const t = O._t;
const FUND = fs.readFileSync(path.join(__dirname, '..', 'fund.html'), 'utf8');

test('글자 사전 — inference.yml 의 character_dict 목록(따옴표 벗기기)만', () => {
  const yml = 'PostProcess:\n  name: CTCLabelDecode\n  character_dict:\n  - 가\n  - \'\'\'\'\n  - "A"\n  - 1\nOther: x\n';
  assert.deepEqual(t.parseDict(yml), ['가', "'", 'A', '1']);
});

test('CTC 풀이 — 0 은 빈칸, 같은 글자 이어짐은 하나, 사전 끝 다음은 띄어쓰기', () => {
  const dict = ['가', '나'];                       // 0=빈칸 1=가 2=나 3=띄어쓰기
  const one = (c) => { const a = [0, 0, 0, 0]; a[c] = 1; return a; };
  const data = new Float32Array([].concat(one(1), one(1), one(0), one(1), one(3), one(2)));
  const r = t.ctcDecode(data, 6, 4, dict);
  assert.equal(r.text, '가가 나');
  assert.ok(r.confidence > 0.99);
  assert.equal(t.ctcDecode(new Float32Array([].concat(one(0), one(0))), 2, 4, dict), null, '다 빈칸이면 없음');
});

test('덩어리 찾기 — 확률 0.3 넘는 이어진 칸, 점수 0.6 미만은 버리고 위→아래 차례', () => {
  const w = 10, h = 6, p = new Float32Array(w * h);
  for (let y = 3; y < 5; y++) for (let x = 1; x < 5; x++) p[y * w + x] = 0.9;    // 아래 덩어리
  for (let y = 0; y < 2; y++) for (let x = 6; x < 9; x++) p[y * w + x] = 0.8;    // 위 덩어리
  for (let x = 6; x < 9; x++) p[4 * w + x] = 0.35;                                // 흐린 것 — 점수 미달
  const b = t.componentBoxes(p, w, h, 0.3, 0.6);
  assert.deepEqual(b.map((x) => [x.x1, x.y1, x.x2, x.y2]), [[6, 0, 8, 1], [1, 3, 4, 4]]);
  const s = t.scaleBoxes(b, w, h, w * 2, h * 2, 1.5);
  assert.ok(s[1].x <= 2 && s[1].w >= 8, '원래 크기로 되돌리며 가장자리를 넓힌다(unclip)');
});

test('줄로 모으기 — 세로 가운데가 반 줄 안이면 한 줄, 줄 안은 왼→오른', () => {
  const it = (text, x, y) => ({ text, x, y, w: 50, h: 20 });
  assert.equal(t.assemble([it('대표자', 200, 102), it('성명', 10, 100), it('주소', 10, 140)]), '성명 대표자\n주소');
});

test('흔한 오인 되돌리기 — 한글 앞 O→○, Δ→△, 쉼표 뒤 빈칸', () => {
  assert.equal(t.restoreSymbols('O 기금법인명'), '○ 기금법인명');
  assert.equal(t.restoreSymbols('Δ 4,000'), '△ 4,000');
  assert.equal(t.restoreSymbols('금 1, 000, 000원'), '금 1,000,000원');
});

test('잘라 높이 48 로 — 폭은 비율대로, 입력은 BGR·[-1,1]·폭 320 이상', () => {
  const W = 8, H = 4, rgba = new Uint8Array(W * H * 4).fill(255);
  const c = t.lineCrop(rgba, W, { x: 0, y: 0, w: 8, h: 4 });
  assert.equal(c.w, 96);
  const ri = t.recInput(c);
  assert.equal(ri.w, 320); assert.equal(ri.data.length, 3 * 48 * 320);
  assert.equal(ri.data[0], 1, '흰색 = 1'); assert.equal(ri.data[200], 0, '채운 폭 밖은 0');
  const s = t.inkStats(new Uint8Array([0, 0, 255, 255, 255, 255, 255, 255]));
  assert.ok(s.contrast > 200 && s.inkRatio === 0.25);
});

test('★ 모델은 «고정된 커밋» 주소 + sha256 — main 을 따라가지 않는다', () => {
  ['det', 'rec', 'dict'].forEach((k) => {
    const m = O.MODELS[k];
    assert.match(m.url, /^https:\/\/huggingface\.co\/PaddlePaddle\/[^/]+\/resolve\/[0-9a-f]{40}\//, k);
    assert.match(m.sha, /^[0-9a-f]{64}$/, k);
  });
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'js', 'pu-ocr-kr.js'), 'utf8'), /crypto\.subtle\.digest\('SHA-256'/);
});

test('★ 앱 배선 — 새 OCR 먼저, 안 되면 tesseract 로(두 곳: 서류 읽기·사업자등록증 일괄)', () => {
  assert.match(FUND, /<script src="js\/pu-ocr-kr\.js\?v=\d+"><\/script>/);
  const oc = FUND.slice(FUND.indexOf('function ocrCanvases('), FUND.indexOf('function ocrCanvases(') + 1500);
  assert.match(oc, /PuOcrKr\.recognize/);
  assert.match(oc, /_ocrTesseract\(/, '새 OCR 이 실패하거나 글이 거의 없으면 옛 방식');
  /* 한국어 OCR 에는 회색 그림을 준다(흑백 2치화는 tesseract 로 넘어갈 때만 사본으로) */
  assert.match(FUND, /var prep = isPdf \? pdfPageCanvases\(bufOrFile,2,true\) : imgCanvas\(bufOrFile,true\)/);
  assert.match(FUND, /function _binCopies\(cvs\)[\s\S]{0,200}_binarize\(c\)/);
  /* 사진첩 보관용 첫 쪽 그림(_docToImage)은 종전처럼 — 회색 선택을 안 쓴다 */
  assert.match(FUND, /return pdfPageCanvases\(new Uint8Array\(buf\),1\);/);
  /* 일괄 읽기는 «일꾼 한 번» 구조를 지킨다(fund-bizreg-bulk.test.js) — 일꾼 속을 한국어 OCR 먼저로 */
  const bw = FUND.slice(FUND.indexOf('function bulkOcrWorker('), FUND.indexOf('function bulkOcrWorker(') + 1400);
  assert.match(bw, /PuOcrKr\.ready\(/); assert.match(bw, /PuOcrKr\.recognize\(\[cv\]/);
  assert.match(bw, /viaTess\(cv\)/, '못 쓰거나 글이 없으면 그 장만 tesseract');
  assert.match(bw, /tw\|\|\(tw=_bulkTessWorker/, 'tesseract 일꾼도 한 번만');
});
