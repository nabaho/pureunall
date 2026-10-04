'use strict';
// ★★★ 공개 서식집(forms/*.json) 개인정보 지킴이 — 설계 2026-08-06 법인 서식집 §7 ④ «CI 에 PII 스캔»
//   forms/ 는 GitHub Pages 로 누구나 읽는다. 실린 서식마다 tools/forms_lib.js scanPii 로 다시 보고,
//   원본 경로(사건 폴더 이름 = 고객사·사람 이름)가 실렸는지, 승인(approved) 안 된 것이 실렸는지 본다.
//   아직 실린 것이 없으면(노무사 검토 전) 지나간다.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const L = require('../tools/forms_lib.js');

const DIR = path.join(__dirname, '..', 'forms');
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(n => n.endsWith('.json')) : [];

test('★★★ 실린 서식에 개인정보가 없다', () => {
  files.filter(n => n !== 'index.json').forEach(n => {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, n), 'utf8'));
    (j.forms || []).forEach(f => {
      const pii = L.scanPii(f.body || '');
      assert.deepStrictEqual(pii.map(p => p.label), [], n + ' · ' + f.id + ' ' + f.title + ' 에 개인정보 의심이 있다 — 공개 저장소다');
      assert.strictEqual(f.review && f.review.status, 'approved', n + ' · ' + f.id + ' 는 노무사 승인 전이다');
    });
  });
});

test('★★★ 원본 경로를 싣지 않는다 — 사건 폴더 이름에 고객사·사람 이름이 있다', () => {
  files.forEach(n => {
    const s = fs.readFileSync(path.join(DIR, n), 'utf8');
    assert.doesNotMatch(s, /"(file|cluster)"\s*:/, n + ' 에 원본 경로 칸이 있다');
    assert.doesNotMatch(s, /\.hwpx?\b/i, n + ' 에 한글 파일 이름이 있다');
    assert.doesNotMatch(s, /바탕 화면|OneDrive|C:\\\\|Users/, n + ' 에 PC 경로가 있다');
  });
});
