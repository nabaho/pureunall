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

// ── 세그먼트 분할 ──
// 한 HWP에 서식이 여러 개 들어 있다(예: 위임약정서+위임장+취하서+동의서+CMS).
// 경계는 중앙 제목줄. 자간을 벌린 제목(위 임 장)과 서식 어미로 끝나는 제목을 모두 잡는다.
const TITLE_TAIL = /(위임장|위임계약서|약정서|동의서|신청서|청구서|진정서|취하서|확인서|확인원|신고서|계산서|보고서|합의서|경위서|의견서|보정서|각서|서약서|확약서|명세서|증명서|선정서|위임약정서|고지확인서)$/;

function isTitleLine(text) {
  const t = String(text || '').trim();
  const bare = t.replace(/\s/g, '');
  if (bare.length < 3 || bare.length > 24) return false;
  if (/[.。]$/.test(t)) return false;                 // 문장은 제목이 아니다
  if (/^제\s*\d+\s*조/.test(bare)) return false;      // 조문 머리
  const spaced = (t.length - bare.length) / bare.length >= 0.5;
  return spaced || TITLE_TAIL.test(bare);
}

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim();
}

function splitSegments(html) {
  const src = String(html || '');
  // 문자열의 모든 <p> 앞에서 자르므로 중첩된 <p>도 경계가 된다.
  // hwp2html.py가 <td> 안에 <p>를 만들지 않아(셀 여러 줄은 <br>로 연결, 1×1 레이아웃 표는 최상위 <p>로 펼침) 현무상 안전하다.
  // 다른 변환기를 붙이면 이 가정을 다시 확인해야 한다.
  const parts = src.split(/(?=<p>)/);
  const segs = [];
  let cur = null;
  for (const part of parts) {
    const m = /^<p>([\s\S]*?)<\/p>/.exec(part);
    const text = m ? stripTags(m[1]) : '';
    if (m && isTitleLine(text)) {
      cur = { title: text.replace(/\s/g, ''), html: part, index: segs.length };
      segs.push(cur);
    } else if (cur) {
      cur.html += part;
    } else {
      // 첫 제목 이전의 머리말 — 버리지 않고 보관했다가 첫 조각에 붙인다
      segs._preamble = (segs._preamble || '') + part;
    }
  }
  if (!segs.length) return [{ title: '', html: src, index: 0 }];
  if (segs._preamble) { segs[0].html = segs._preamble + segs[0].html; delete segs._preamble; }
  return segs;
}

module.exports = { normalizeForHash, formHash, shingles, similarity, clusterByContent,
                   isTitleLine, stripTags, splitSegments };
