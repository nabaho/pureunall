'use strict';
/* 서식집 수집 — 옛 한글(HWP 3.0) 되살리기 (대표 지시 2026-09-27 「니가해라」)

   Phase 0 수집에서 90건이 NotOleFileError 로 빠졌다(전부 1996~2002년 HWP 3.0 등 비OLE 형식).
   kordoc 이 그중 84건을 읽는 것을 확인했다(평균 5,591자). 그래서 hwp2html 이 실패한 파일만
   kordoc 으로 한 번 더 읽는다.

   ■ 지키는 것
     ⓐ kordoc 은 «대체 경로»다 — hwp2html 이 성공한 파일은 건드리지 않는다(표 열 너비를 더 잘 살린다).
     ⓑ 판을 못 박고 바깥 통신을 막는다(OCR 모델 내려받기가 사건 서류를 들고 나가지 않게).
     ⓒ kordoc 의 문단·표를 hwp2html 과 «같은 모양» HTML(<p>, <table><tr><td colspan rowspan>)로 낸다 —
        뒤 단계(splitSegments·anonymize)가 두 벌을 몰라도 된다.
     ⓓ 글자는 이스케이프한다 — 원문에 <script> 가 있어도 태그가 되지 않는다.
   ⚠ 변환 함수 검사는 파이썬이 있을 때만 돈다(CI 에는 없다). 구조 검사는 늘 돈다. */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const { spawnSync } = require('child_process');

const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'tools/forms_corpus.py'), 'utf8').replace(/\r\n/g, '\n');

test('ⓐ kordoc 은 hwp2html 이 실패했을 때만 부른다', () => {
  const at = SRC.indexOf('to_html(convert(p))');
  assert.ok(at > 0, 'hwp2html 경로가 없습니다');
  const exceptAt = SRC.indexOf('except Exception', at);
  const kordocAt = SRC.indexOf('kordoc_convert(p)', at);
  assert.ok(kordocAt > exceptAt && exceptAt > at, '★ kordoc 이 기본 경로가 됐습니다 — hwp2html 실패 뒤에만 불러야 합니다');
});

test('ⓑ 판 고정·바깥 통신 차단', () => {
  assert.match(SRC, /KORDOC_PKG\s*=\s*'kordoc@\d+\.\d+\.\d+'/, '판이 고정되지 않았습니다');
  assert.match(SRC, /KORDOC_OFFLINE['"]?\s*[:=,]\s*['"]1['"]/, '바깥 통신이 열려 있습니다');
  assert.ok(!/--ocr/.test(SRC), 'OCR 을 켜면 모델을 내려받습니다');
});

function py(code, input) {
  const r = spawnSync('python', ['-c', code], { cwd: R, encoding: 'utf8', input: input || '', env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8' }) });
  if (r.error || (r.status !== 0 && /No module named|not found|not recognized/i.test(r.stderr || ''))) return null;
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.replace(/\r\n/g, '\n').trim();
}
const IMPORT = "import sys, json; sys.path.insert(0, 'tools'); import forms_corpus as F; ";

test('ⓒⓓ kordoc 문단·표 → hwp2html 과 같은 모양 HTML', (t) => {
  const blocks = [
    { type: 'heading', text: '자문계약서' },
    { type: 'paragraph', text: '가나상사 <script>x</script> & 푸른' },
    { type: 'paragraph', text: '   ' },
    /* kordoc 계약: cells 는 rows×cols 전체 격자이고, 병합에 가려진 자리에도 칸이 있다 —
       kordoc 자신의 tableToHtml 처럼 병합 범위를 세어 건너뛴다 */
    { type: 'table', table: { rows: 2, cols: 3, cells: [
      [{ text: '성명', colSpan: 1, rowSpan: 2 }, { text: '홍길동', colSpan: 2, rowSpan: 1 }, { text: '', colSpan: 1, rowSpan: 1 }],
      [{ text: '', colSpan: 1, rowSpan: 1 }, { text: '연락처', colSpan: 1, rowSpan: 1 }, { text: '줄1\n줄2', colSpan: 1, rowSpan: 1 }]
    ] } }
  ];
  const out = py(IMPORT + 'print(F.kordoc_to_html(json.loads(sys.stdin.read())))', JSON.stringify(blocks));
  if (out === null) { t.skip('python 없음'); return; }
  assert.equal(out, [
    '<p>자문계약서</p>',
    '<p>가나상사 &lt;script&gt;x&lt;/script&gt; &amp; 푸른</p>',
    '<table><tr><td rowspan="2">성명</td><td colspan="2">홍길동</td></tr><tr><td>연락처</td><td>줄1<br>줄2</td></tr></table>'
  ].join('\n'));
});

test('빈 목록·모르는 블록은 조용히 건너뛴다', (t) => {
  const out = py(IMPORT + "print(repr(F.kordoc_to_html([{'type':'image'},{'type':'table','table':{'cells':[]}}])))");
  if (out === null) { t.skip('python 없음'); return; }
  assert.equal(out, "''");
});
