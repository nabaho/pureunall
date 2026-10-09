'use strict';
/* 문서관리 — 손보기·PDF·메일 host (설계 2026-09-29 §6·§7)
   ⓐ 편집기는 저장소 안 것만(서류가 남의 주소로 가지 않는다) ⓑ 메일 첨부는 명함첩과 같은 창고로
   ⓒ 보낸 기록은 받는 주소 없이 sentKeys 마다 ⓓ 사본은 규칙 안의 값(kind:'co', src:'upload') */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'docs-esign.html'), 'utf8').replace(/\r\n/g, '\n');
const fnOf = (sig) => { const i = H.indexOf(sig); assert.ok(i >= 0, sig + ' 가 없습니다'); return H.slice(i, H.indexOf('\n}\n', i)); };

test('ⓐ 편집기 — 저장소 안 rhwp-editor + 우리 studio, 원본 형식으로 돌려준다', () => {
  const f = fnOf('function formHwpEdit(');
  assert.match(f, /import\('\.\/vendor\/rhwp-editor\/index\.js'\)/);
  assert.match(f, /studioUrl: 'vendor\/rhwp-studio\/index\.html'/);
  assert.match(f, /fmt === 'hwpx' \? ed\.exportHwpx\(\) : ed\.exportHwp\(\)/);
  assert.ok(!/esm\.sh\/@rhwp|edwardkim\.github\.io/.test(H), '남의 주소 편집기를 부릅니다');
});
test('ⓑ 메일 — PuDocFile 을 storage 없이 init, 같은 서버 sendMail, 첨부는 putMailFile', () => {
  assert.match(H, /<script src="js\/pu-doc-file\.js\?v=\d+"><\/script>/);
  assert.match(H, /PuDocFile\.init\(\{ db: db \}\)/, 'storage 를 넘기면 첨부가 다른 창고로 가서 빠진 채 나갑니다');
  const s = fnOf('async function formMailSend(');
  assert.match(s, /PuDocFile\.putMailFile\(/);
  assert.match(s, /PuDocFile\.sendMail\(/);
  assert.match(s, /cardId: ''/);
});
test('ⓒ 보낸 기록 — sentKeys 마다 sentRecord, 받는 주소 칸 없음', () => {
  const r = fnOf('function formMailRecord(');
  assert.match(r, /PuFormCardFill\.sentKeys\(/);
  assert.match(r, /PuFormCardFill\.sentRecord\(/);
  assert.match(r, /'pucards\/sentDocs\/' \+ k/);
  assert.ok(!/\bto\s*:/.test(r), '기록에 받는 주소를 넣습니다');
});
test('ⓓ 사본 보관 — kind co · src upload (규칙 안의 값)', () => {
  const k = fnOf('function formMailKeep(');
  assert.match(k, /kind: 'co'/);
  assert.match(k, /src: 'upload'/);
  assert.match(k, /PuOfficeStore\.addCoDoc\(/);
});
test('ⓔ host 배선', () => {
  assert.match(H, /hwpEdit: formHwpEdit, hwpPdf: formHwpPdf,/);
  assert.match(H, /mail: \{ mode: formMailMode, send: formMailSend, record: formMailRecord, keep: formMailKeep, agency: formAgencyLoad, agencyCollect: formAgencyCollect \}/);
});

const CFJ = fs.readFileSync(path.join(R, 'js/pu-contract-forms.js'), 'utf8').replace(/\r\n/g, '\n');
const { stripJs } = require('./strip-comments');
const { cutFn } = require('./cut-fn');
test('ⓕ 채우기 창 — 손보기·메일 단추는 «양식 하나»일 때만, 손본 것이 받기·메일에 쓰인다', () => {
  const f = cutFn(stripJs(CFJ), 'function openFill(');
  assert.match(f, /host\.hwpEdit\(/);
  assert.match(f, /openSend\(/);
  assert.match(f, /one && host\.mail/, '묶음 채우기에도 메일 단추가 뜹니다');
  assert.match(f, /st\.edited/, '손본 바이트를 쓰지 않습니다');
});
test('ⓖ 보내기 창 — 누를 때만 보내고, 잠그고, 성공 뒤에만 기록·보관, 서버가 안 되면 메일 창', () => {
  const s = cutFn(stripJs(CFJ), 'function openSend(');
  assert.match(s, /CF\.mailDefaults\(/);
  const iSend = s.indexOf('host.mail.send('), iRec = s.indexOf('host.mail.record(');
  assert.ok(iSend > 0 && iRec > 0, '보내기·기록이 없습니다');
  const sendFn = cutFn(s, 'function send(');
  assert.ok(sendFn.indexOf('host.mail.send(') < sendFn.indexOf('after(fs'), '보내기 전에 기록합니다');
  assert.match(s, /if \(busy\) return;/, '두 번 누르기를 막지 않습니다');
  assert.match(s, /mailto:/, '서버를 못 쓸 때 메일 창으로 물러나지 않습니다');
  assert.match(s, /18 \* 1024 \* 1024/, '크기 한도를 보지 않습니다');
  assert.match(s, /host\.hwpPdf\(/);
  assert.match(s, /host\.mail\.keep\(/);
  assert.ok(!/db\.ref|changeForms/.test(s), '보내기 창이 db 를 직접 만집니다 — host 를 거칠 것');
});

/* 2026-10-03 — 미리보기·PDF 가 엔진의 「줄 다시 나누기」 때문에 머리 부분이 벌어져 보이던 것.
   한글 프로그램은 채운 파일을 바르게 보이지만, 앱의 그림 엔진은 다시 나눈 줄을 비뚤게 그린다(실제 v8 로 확인).
   그래서 «채운 문단의 줄 정보만 걷은» 사본(다시 나누기 전)을 미리보기·PDF 에 쓴다. 받기·메일 첨부 한글 파일은 그대로. */
test('ⓗ 채우기 — 다시 나누기 전 사본(preview)을 함께 돌려주고, 미리보기·PDF 가 그것을 쓴다', () => {
  const rl = fnOf('async function formRelayout(');
  assert.match(rl, /if \(keep\) keep\.preview = bytes;/);
  const fill = fnOf('async function formHwpFill(');
  assert.match(fill, /r\.preview = keep\.preview \|\| null;/);
  const f = cutFn(stripJs(CFJ), 'function openFill(');
  assert.match(f, /host\.hwpShow\(prevBox, r\.preview \|\| r\.bytes,/);
  assert.match(f, /pdfSrc: r\.preview \|\| null/);
  const s = cutFn(stripJs(CFJ), 'function openSend(');
  assert.match(s, /host\.hwpPdf\(o\.pdfSrc \|\| o\.bytes,/);
});
