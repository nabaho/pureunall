'use strict';
/* program.js — «올린 판»의 광고들 → 灰度 장비의 프로그램 JSON (설계서 §7)
   광고 1건 = 프로그램 1개. 자리(area)는 화면 전체 한 칸. 순서 = 배열 순서.
   ⚠ 순수 함수 — 파일·네트워크 없음. 사진·동영상은 «장비에 올린 뒤 받은 파일 정보(uploaded)»를 받아 쓴다. */
const Core = require('../../js/pu-signboard-core.js');

/* 灰度 공식 문서 예시 값 — 장비를 읽기 전(시험 모드)의 «자리표시»일 뿐, 확정값이 아니다(assumed:true) */
const PLACEHOLDER_SCREEN = { width: 128, height: 64, assumed: true };
/* 한쪽만 적은 기간은 «먼 날짜»로 닫는다 — 공식 문서에 열린 범위 표기가 없다(설계서 §7 [확인 필요]) */
const OPEN_START = '2000-01-01';
const OPEN_END = '2099-12-31';

function toPlayControl(period) {
  const p = Core.normalizePeriod(period), pc = {};
  if (p.weekdays.length && p.weekdays.length < 7) pc.week = { enable: p.weekdays.join(',') };
  if (p.start || p.end) pc.date = [{ start: p.start || OPEN_START, end: p.end || OPEN_END }];
  if (p.times.length) pc.time = p.times.map(function (t) { return { start: t.start + ':00', end: t.end + ':00' }; });
  return Object.keys(pc).length ? pc : null;
}

function effectOf(type, speed, holdSec) { return { type: type, speed: speed, hold: Math.round(holdSec * 1000) }; }

function textItem(ad) {
  const t = ad.text;
  return { type: 'text', string: t.string, multiLine: /\n/.test(t.string), alignment: 'center', valignment: 'middle',
    font: { size: t.size, bold: t.bold, color: t.color }, effect: effectOf(t.effectType, t.effectSpeed, t.holdSec) };
}
function imageItem(ad, up) {
  const m = ad.media;
  return { type: 'image', file: up.file, fileMd5: up.md5, fileSize: up.size, fit: m.fit, effect: effectOf(m.effectType, m.effectSpeed, m.holdSec) };
}
function videoItem(ad, up) {
  return { type: 'video', aspectRatio: true, file: up.file, fileMd5: up.md5, fileSize: up.size };
}

/* 장비에 올려야 하는 파일 목록 */
function mediaNeeds(publishedAds) {
  return Core.toArr(publishedAds).map(Core.snapshotAd).filter(function (a) { return a.kind === 'image' || a.kind === 'video'; })
    .map(function (a) { return { adId: a.id, kind: a.kind, url: a.media.url, size: a.media.size, name: a.media.name || a.id }; });
}

function adToProgram(snap, screen, uploaded) {
  const ad = Core.snapshotAd(snap);
  let item;
  if (ad.kind === 'text') item = textItem(ad);
  else if (ad.kind === 'image' || ad.kind === 'video') {
    const up = uploaded && uploaded[ad.id];
    if (!up || !up.file) throw new Error('장비에 올린 파일 정보가 없습니다: ' + ad.id);
    item = ad.kind === 'image' ? imageItem(ad, up) : videoItem(ad, up);
  } else throw new Error('알 수 없는 광고 종류: ' + ad.kind);
  const program = { name: ad.title, type: 'normal', uuid: ad.id,
    area: [{ x: 0, y: 0, width: screen.width, height: screen.height, item: [item] }] };
  const pc = toPlayControl(ad.period);
  if (pc) program.playControl = pc;
  return program;
}

/* 장비 전체 교체 요청 본문 — «올린 판 = 전광판에 있어야 할 전부» */
function buildReplaceBody(publishedAds, screen, deviceId, uploaded) {
  const s = screen || PLACEHOLDER_SCREEN;
  return { method: 'replace', data: Core.toArr(publishedAds).map(function (a) { return adToProgram(a, s, uploaded); }), id: deviceId };
}

module.exports = { PLACEHOLDER_SCREEN, OPEN_START, OPEN_END, toPlayControl, adToProgram, buildReplaceBody, mediaNeeds };
