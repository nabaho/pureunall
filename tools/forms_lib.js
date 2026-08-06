'use strict';
// 서식집 — 순수 판단 로직 (Node 전용, 외부 의존 없음)
// 실행 스크립트(forms_report.js)와 테스트가 공유한다.
const crypto = require('crypto');

// ── 정규화 ──
// 태그·엔티티를 지우고 숫자를 #로 뭉갠다. 날짜·금액만 다른 같은 서식을 한 군집으로 묶기 위함.
function normalizeForHash(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\d/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

function formHash(html) {
  return crypto.createHash('md5').update(normalizeForHash(html)).digest('hex').slice(0, 10);
}

// ── 유사도 (3-gram 어절 shingle의 자카드 계수) ──
function shingles(text, k) {
  k = k || 3;
  const w = String(text || '').split(/\s+/).filter(Boolean);
  const s = new Set();
  if (w.length < k) { if (w.length) s.add(w.join(' ')); return s; }
  for (let i = 0; i + k <= w.length; i++) s.add(w.slice(i, i + k).join(' '));
  return s;
}

// 이미 생성된 shingle 집합에 대한 자카드 계수 계산 (내부용)
function jaccardSets(A, B) {
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function similarity(a, b) {
  const A = shingles(a), B = shingles(b);
  return jaccardSets(A, B);
}

// ── 군집 ──
// 1차: 정규화 해시로 완전동일 묶음. 2차: 묶음 대표끼리 유사도로 병합.
// 각 묶음 대표의 shingle 집합을 미리 생성한 후 쌍별 자카드 계수로 비교.
// shingle 재계산을 피함으로써 O(n²) 비교 성능 최적화.
function clusterByContent(items, threshold) {
  const th = threshold == null ? 0.85 : threshold;
  const byHash = new Map();
  for (const it of items) {
    const h = crypto.createHash('md5').update(String(it.text || '')).digest('hex');
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(it);
  }
  const groups = [...byHash.values()];
  const repShingles = groups.map(g => shingles(g[0].text));
  const merged = [];
  const used = new Array(groups.length).fill(false);
  for (let i = 0; i < groups.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let bucket = groups[i].slice();
    for (let j = i + 1; j < groups.length; j++) {
      if (used[j]) continue;
      if (jaccardSets(repShingles[i], repShingles[j]) >= th) {
        used[j] = true;
        bucket = bucket.concat(groups[j]);
      }
    }
    merged.push(bucket);
  }
  return merged;
}

module.exports = { normalizeForHash, formHash, shingles, similarity, clusterByContent };
