#!/usr/bin/env node
/* GitHub «Firebase 배포»(.github/workflows/firebase-deploy.yml)가 받은 서버 함수 이름을 거른다 (2026-10-31)
   대표 지시 「니가 직접 하면 안되나 아니면 한번에 하게 가능하게 하던가」 — 클라우드 방의 Claude 가 그 작업을 부를 때 쓴다.

     node scripts/firebase-deploy-check.js "collectRulesMail,collectRulesMailAsk"
       → 표준출력: functions:collectRulesMail,functions:collectRulesMailAsk   (firebase deploy --only 에 그대로)
       → 이상하면 까닭을 표준오류에 적고 종료코드 1

   ⚠ 이름은 functions/index.js 의 `exports.이름 =` 으로 «실제로 있는 것»만 받는다 — 오타 하나로 엉뚱한 배포가 되지 않게.
   ⚠ 이름 없이 «모두 올리기»는 받지 않는다 — 함수가 수십 개라 할당량에 걸린다(docs/배포-어디서-어떻게.md).
   ⚠ 이름 글자는 영문·숫자·_ 만 — 입력 글이 셸 명령으로 새지 않게(작업 파일도 env 로만 넘긴다). 한 번에 많아야 10개. */
'use strict';
const fs = require('fs');
const path = require('path');

const INDEX = path.join(__dirname, '..', 'functions', 'index.js');
const MAX = 10;

function exportsOf(src) {
  const out = new Set();
  const re = /^exports\.([A-Za-z_$][\w$]*)\s*=/gm;
  let m;
  while ((m = re.exec(String(src || '')))) out.add(m[1]);
  return out;
}

function check(raw, src) {
  const names = String(raw == null ? '' : raw).split(',').map((s) => s.trim()).filter(Boolean);
  if (!names.length) return { ok: false, why: '서버 함수 이름이 없습니다 — 이름 없이 «모두 올리기»는 받지 않습니다' };
  if (names.length > MAX) return { ok: false, why: '한 번에 ' + MAX + '개까지만 올립니다 (' + names.length + '개를 받음)' };
  const bad = names.filter((n) => !/^[A-Za-z][A-Za-z0-9_]*$/.test(n));
  if (bad.length) return { ok: false, why: '이름에 쓸 수 없는 글자가 있습니다: ' + bad.join(', ') };
  const have = exportsOf(src);
  const unknown = names.filter((n) => !have.has(n));
  if (unknown.length) return { ok: false, why: 'functions/index.js 에 없는 함수입니다: ' + unknown.join(', ') };
  const uniq = names.filter((n, i) => names.indexOf(n) === i);
  return { ok: true, names: uniq, only: uniq.map((n) => 'functions:' + n).join(',') };
}

if (require.main === module) {
  const r = check(process.argv[2], fs.readFileSync(INDEX, 'utf8'));
  if (!r.ok) { console.error('✋ ' + r.why); process.exit(1); }
  process.stdout.write(r.only);
}

module.exports = { check, exportsOf, MAX };
