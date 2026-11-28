'use strict';
/* PC 카카오톡 화면·하단알림 자동 캡처 수집기(scripts/kakao-watch-agent) 단위 테스트
 * ⚠ 실제 PC 카톡·실제 사람·실제 DB를 건드리지 않고, 읽기 전용 정적 검사와 메모리 목업으로 검증한다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const AGENT_DIR = path.join(ROOT, 'scripts', 'kakao-watch-agent');

const { execFileSync } = require('node:child_process');
const { loadConfig, readLocal, writeLocal } = require(path.join(AGENT_DIR, 'config.js'));
const { createCapturer } = require(path.join(AGENT_DIR, 'capture.js'));
const { validateArchiveRecord } = require(path.join(AGENT_DIR, 'store.js'));
const { runOnce } = require(path.join(AGENT_DIR, 'run.js'));

test('capture.ps1 및 install-task.ps1 은 순수 ASCII 전용이고 카톡 조작 API를 쓰지 않는다', () => {
  for (const name of ['capture.ps1', 'install-task.ps1']) {
    const raw = fs.readFileSync(path.join(AGENT_DIR, name), 'utf8');
    assert.equal(/[^\x00-\x7F]/.test(raw), false, name + ' 에 비ASCII 문자가 있으면 PS 5.1 에서 깨집니다');
  }
  const ps = fs.readFileSync(path.join(AGENT_DIR, 'capture.ps1'), 'utf8');
  const codeOnly = ps.replace(/^\s*#.*$/gm, '');
  for (const forbidden of ['SendInput', 'PostMessage', 'SendMessage', 'SetForegroundWindow', 'mouse_event', 'keybd_event']) {
    assert.equal(codeOnly.includes(forbidden), false, '읽기 전용 감시기에 조작 API ' + forbidden + ' 이 있으면 안 됩니다');
  }
  assert.match(ps, /Remove-Item -Force -ErrorAction SilentlyContinue \$tmp/);
});

test('config.js 는 기본 시험 모드(liveEnabled: false)를 강제하고 범위를 보정한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-cfg-'));
  try {
    const empty = loadConfig(dir);
    assert.equal(empty.errors.length, 0);
    assert.equal(empty.config.liveEnabled, false);
    assert.equal(empty.config.watchPopup, true);
    assert.equal(empty.config.watchOpenRoom, true);

    fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify({
      pollSec: 999,
      maxPerRound: 0,
      rooms: [' 푸른노무법인 업무채팅방 ', ''],
    }), 'utf8');
    const clamped = loadConfig(dir);
    assert.equal(clamped.errors.length, 0);
    assert.equal(clamped.config.liveEnabled, false);
    assert.equal(clamped.config.pollSec, 60);
    assert.equal(clamped.config.maxPerRound, 1);
    assert.deepEqual(clamped.config.rooms, ['푸른노무법인 업무채팅방']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runOnce 시험 모드(dryRun)는 outbox JSON 만 쓰고 DB 를 쓰지 않는다', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-dry-'));
  try {
    let wroteDb = 0;
    const ctx = {
      dir,
      dryRun: true,
      now: () => Date.UTC(2026, 10, 28, 3, 0, 0),
      log: () => {},
      local: readLocal(dir),
      config: { liveEnabled: false, pollSec: 3, watchPopup: true, watchOpenRoom: true, rooms: ['푸른노무법인 업무채팅방'], actorSid: 'WATCH-PC', maxPerRound: 20 },
      workItemsMap: { wk1: { id: 'wk1', no: '경기2026부해3347', title: '테스트 사건', co_id: 'co1' } },
      companiesMap: { co1: { id: 'co1', name: '가나제조' } },
      store: {
        writeArchiveItem: async () => { wroteDb++; },
        writeWatcher: async () => { wroteDb++; },
      },
      capturer: {
        scan: async () => ({
          ok: true,
          ocrAvailable: true,
          kakaoRunning: true,
          locked: false,
          captures: [{
            surface: 'popup',
            title: '',
            width: 320,
            height: 110,
            hash: 'abc',
            lines: [
              { x: 10, y: 10, text: '푸른노무법인 업무채팅방' },
              { x: 10, y: 30, text: '김보람' },
              { x: 10, y: 50, text: '경기2026부해3347 시정지시서 12월 4일까지 제출' },
            ],
          }],
        }),
      },
    };
    const res = await runOnce(ctx);
    assert.equal(res.action, 'captured');
    assert.equal(res.dry, 1);
    assert.equal(wroteDb, 0, '시험 모드에서 DB 쓰기가 발생했습니다');
    const outFiles = fs.readdirSync(path.join(dir, 'outbox'));
    assert.equal(outFiles.length, 1);
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'outbox', outFiles[0]), 'utf8'));
    assert.equal(saved.entityType, 'KakaoWorkArchive');
    assert.equal(saved.workItemId, 'wk1');
    assert.equal('companyName' in saved, false);

    /* 같은 내용 재캡처 시 중복 제거로 건너뛴다 */
    const res2 = await runOnce(ctx);
    assert.equal(res2.action, 'idle');
    assert.equal(res2.dry, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runOnce 실전 모드는 OTP 차단·민감정보 가림·개인방 무시·_deleted 부활 금지를 모두 지킨다', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-live-'));
  try {
    const writtenItems = {};
    let watcherState = null;
    const deletedIdCheck = [];

    const baseCtx = {
      dir,
      dryRun: false,
      now: () => Date.UTC(2026, 10, 28, 3, 5, 0),
      log: () => {},
      local: readLocal(dir),
      config: { liveEnabled: true, pollSec: 3, watchPopup: true, watchOpenRoom: true, rooms: ['푸른노무법인 업무채팅방'], actorSid: 'WATCH-PC', maxPerRound: 20 },
      store: {
        readRooms: async () => ['푸른노무법인 업무채팅방'],
        readWorkItems: async () => ({}),
        readCompanies: async () => ({}),
        readArchiveItem: async (id) => {
          deletedIdCheck.push(id);
          return id === 'kr_deleted_sentinel' ? { id, _deleted: true } : writtenItems[id] || null;
        },
        writeArchiveItem: async (id, rec) => { writtenItems[id] = rec; },
        writeWatcher: async (obj) => { watcherState = obj; },
      },
      capturer: {
        scan: async () => ({
          ok: true,
          ocrAvailable: true,
          kakaoRunning: true,
          locked: false,
          captures: [
            {
              surface: 'popup',
              title: '',
              width: 300,
              height: 100,
              hash: 'p1',
              lines: [
                { x: 10, y: 10, text: '개인 친구방' },
                { x: 10, y: 30, text: '홍길동' },
                { x: 10, y: 50, text: '사적인 이야기' },
              ],
            },
            {
              surface: 'room',
              title: '푸른노무법인 업무채팅방',
              width: 394,
              height: 650,
              hash: 'r1',
              lines: [
                { x: 64, y: 120, text: '문자알림' },
                { x: 72, y: 150, text: '[Web발신] 카카오 인증번호 998877 타인 노출 금지' },
                { x: 306, y: 180, text: '오전 11:00' },
                { x: 64, y: 210, text: '박담당' },
                { x: 72, y: 240, text: '의뢰인 900101-1234567 계좌 110-123-456789 비번: temp9876 서류 확인' },
                { x: 306, y: 270, text: '오전 11:05' },
              ],
            },
          ],
        }),
      },
    };

    const res = await runOnce(baseCtx);
    writeLocal(dir, baseCtx.local);
    assert.equal(res.action, 'captured');
    assert.equal(res.saved, 1);
    assert.equal(res.blocked, 1);
    assert.ok(deletedIdCheck.length === 1);

    const savedRec = Object.values(writtenItems)[0];
    assert.ok(savedRec);
    assert.equal(savedRec.room, '푸른노무법인 업무채팅방');
    assert.equal(savedRec.safety, 'redacted');
    assert.ok(!/998877/.test(JSON.stringify(writtenItems)));
    assert.ok(!/900101-1234567/.test(savedRec.summary));
    assert.ok(!/110-123-456789/.test(savedRec.summary));
    assert.ok(!/temp9876/.test(savedRec.summary));
    assert.ok(watcherState);
    assert.equal(watcherState.status, 'running');
    assert.equal(watcherState.todayCount, 1);
    assert.equal(watcherState.roomCount, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('runOnce _deleted tombstone 레코드가 이미 있으면 덮어쓰지 않고 부활을 차단한다', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-del-'));
  try {
    let writeCount = 0;
    const ctx = {
      dir,
      dryRun: false,
      now: () => Date.UTC(2026, 10, 28, 3, 10, 0),
      log: () => {},
      local: readLocal(dir),
      config: { liveEnabled: true, pollSec: 3, watchPopup: true, watchOpenRoom: true, rooms: ['푸른노무법인 업무채팅방'], actorSid: 'WATCH-PC', maxPerRound: 20 },
      store: {
        readRooms: async () => ['푸른노무법인 업무채팅방'],
        readWorkItems: async () => ({}),
        readCompanies: async () => ({}),
        readArchiveItem: async (id) => ({ id, _deleted: true }),
        writeArchiveItem: async () => { writeCount++; },
        writeWatcher: async () => {},
      },
      capturer: {
        scan: async () => ({
          ok: true,
          ocrAvailable: true,
          kakaoRunning: true,
          locked: false,
          captures: [{
            surface: 'popup',
            title: '',
            width: 300,
            height: 100,
            hash: 'd1',
            lines: [
              { x: 10, y: 10, text: '푸른노무법인 업무채팅방' },
              { x: 10, y: 30, text: '김노무사' },
              { x: 10, y: 50, text: '기존에 삭제된 업무 보고 재등장' },
            ],
          }],
        }),
      },
    };
    const res = await runOnce(ctx);
    assert.equal(res.saved, 0);
    assert.equal(writeCount, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('다음 날 같은 열린 방 화면이 재캡처돼도 중복 저장되지 않고, maxPerRound 초과 행과 파일은 누락되지 않는다', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-roll-'));
  try {
    let dayNow = Date.UTC(2026, 10, 28, 3, 0, 0);
    const written = {};
    let mode = 'inferred';
    const ctx = {
      dir,
      dryRun: false,
      now: () => dayNow,
      log: () => {},
      local: readLocal(dir),
      config: { liveEnabled: true, pollSec: 3, watchPopup: true, watchOpenRoom: true, rooms: ['푸른노무법인 업무채팅방'], actorSid: 'WATCH-PC', maxPerRound: 1 },
      store: {
        readRooms: async () => ['푸른노무법인 업무채팅방'],
        readWorkItems: async () => ({}),
        readCompanies: async () => ({}),
        readArchiveItem: async (id) => written[id] || null,
        writeArchiveItem: async (id, rec) => { written[id] = rec; },
        writeWatcher: async () => {},
      },
      capturer: {
        scan: async () => ({
          ok: true,
          ocrAvailable: true,
          kakaoRunning: true,
          locked: false,
          captures: [{
            surface: 'room',
            key: 'room:0:푸른노무법인 업무채팅방',
            title: '푸른노무법인 업무채팅방',
            width: 394,
            height: 650,
            hash: mode + '-' + dayNow,
            lines: mode === 'inferred'
              ? [
                  { x: 64, y: 120, text: '김보람' },
                  { x: 72, y: 150, text: '시정지시서 확인 보고' },
                  { x: 150, y: 190, text: '시 정 지 시 서' },
                  { x: 306, y: 210, text: '오전 11:08' },
                ]
              : [
                  { x: 120, y: 100, text: '2026년 11월 27일 금요일' },
                  { x: 64, y: 130, text: '박담당' },
                  { x: 72, y: 160, text: '근로복지기금 정관 수정 완료' },
                  { x: 306, y: 180, text: '오후 3:10' },
                  { x: 120, y: 210, text: '2026년 11월 28일 토요일' },
                  { x: 64, y: 240, text: '이노무' },
                  { x: 72, y: 270, text: '취업규칙 신고 접수 완료' },
                  { x: 306, y: 290, text: '오전 10:15' },
                ],
          }],
        }),
      },
    };

    /* 1바퀴: 날짜 구분선 없는 캡처 저장 + OCR 파일명 포함 + screen-hashes 기록 */
    const r1 = await runOnce(ctx);
    assert.equal(r1.saved, 1);
    const firstRec = Object.values(written)[0];
    assert.ok(firstRec.fileNames.some((fn) => fn.includes('시정지시서')), 'OCR 추출 파일명이 fileNames에 포함되어야 합니다');
    const sh1 = JSON.parse(fs.readFileSync(path.join(dir, 'screen-hashes.json'), 'utf8'));
    assert.ok(sh1['room:0:푸른노무법인 업무채팅방']);

    /* 2바퀴(다음 날): 날짜 구분선 없는 같은 화면이 다시 캡처돼도 중복 저장되지 않음 */
    dayNow += 86400000;
    const rDup = await runOnce(ctx);
    assert.equal(rDup.saved, 0);
    assert.equal(Object.keys(written).length, 1);

    /* 3~4바퀴: 2일치 행(rows=2) 캡처 시 maxPerRound=1 로 1건씩 누락 없이 저장되고, 이월 시 screen-hashes 삭제 후 완결 시 재기록 */
    mode = 'two-days';
    const r2 = await runOnce(ctx);
    assert.equal(r2.saved, 1);
    assert.equal(Object.keys(written).length, 2);
    const screenHashesAfterDefer = JSON.parse(fs.readFileSync(path.join(dir, 'screen-hashes.json'), 'utf8'));
    assert.equal(screenHashesAfterDefer['room:0:푸른노무법인 업무채팅방'], undefined);

    const r3 = await runOnce(ctx);
    assert.equal(r3.saved, 1);
    assert.equal(Object.keys(written).length, 3);
    const screenHashesDone = JSON.parse(fs.readFileSync(path.join(dir, 'screen-hashes.json'), 'utf8'));
    assert.ok(screenHashesDone['room:0:푸른노무법인 업무채팅방']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('팝업 첫 줄만 방 이름으로 검사해 개인방 본문이 등록 방 이름과 비슷해도 차단하고, 시험 모드 지문이 실전을 가리지 않는다', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-iso-'));
  try {
    const written = {};
    const capPopupFromPersonal = {
      surface: 'popup',
      key: 'popup:1:personal',
      title: '',
      width: 300,
      height: 100,
      hash: 'pop-priv',
      lines: [
        { x: 10, y: 10, text: '홍길동 개인방' },
        { x: 10, y: 30, text: '푸른노무법인 업무채팅방' },
        { x: 10, y: 50, text: '사적인 내용 유출 테스트' },
      ],
    };
    const capAllowed = {
      surface: 'popup',
      key: 'popup:2:work',
      title: '',
      width: 300,
      height: 100,
      hash: 'pop-work',
      lines: [
        { x: 10, y: 10, text: '푸른노무법인 업무채팅방' },
        { x: 10, y: 30, text: '김보람' },
        { x: 10, y: 50, text: '시정지시서 12월 11일까지 제출 확인' },
      ],
    };
    const common = {
      dir,
      now: () => Date.UTC(2026, 10, 28, 4, 0, 0),
      log: () => {},
      local: readLocal(dir),
      config: { liveEnabled: true, pollSec: 3, watchPopup: true, watchOpenRoom: true, rooms: ['푸른노무법인 업무채팅방'], actorSid: 'WATCH-PC', maxPerRound: 20 },
      store: {
        readRooms: async () => ['푸른노무법인 업무채팅방'],
        readWorkItems: async () => ({}),
        readCompanies: async () => ({}),
        readArchiveItem: async (id) => written[id] || null,
        writeArchiveItem: async (id, rec) => { written[id] = rec; },
        writeWatcher: async () => {},
      },
      capturer: {
        scan: async () => ({ ok: true, ocrAvailable: true, kakaoRunning: true, locked: false, captures: [capPopupFromPersonal, capAllowed] }),
      },
    };

    /* 시험 모드 1회 실행 후 실전 모드 전환 시에도 실전 저장이 가려지지 않고, 개인방 팝업은 차단됨 */
    const dryRes = await runOnce(Object.assign({}, common, { dryRun: true }));
    assert.equal(dryRes.dry, 1);
    const liveRes = await runOnce(Object.assign({}, common, { dryRun: false }));
    assert.equal(liveRes.saved, 1);
    assert.ok(!/사적인 내용/.test(JSON.stringify(written)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('store.validateArchiveRecord 는 RTDB 보안규칙과 동일한 허용 키·길이·금지 필드를 강제한다', () => {
  const valid = {
    id: 'kr_abc12345',
    entityType: 'KakaoWorkArchive',
    schemaVersion: 3,
    contractVersion: 1,
    revision: 1,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    createdBy: 'WATCH-PC',
    updatedBy: 'WATCH-PC',
    originSystem: 'kakaotalk',
    originId: 'kr_abc12345',
    room: '푸른노무법인 업무채팅방',
    day: '2026-11-28',
    senders: ['김보람'],
    msgCount: 1,
    domain: 'case',
    safety: 'safe',
    redactedCount: 0,
    summary: '시정지시서 확인 보고',
    caseNos: [],
    due: '2026-12-11',
    fileNames: ['시정지시서(이미지)'],
    matchBasis: 'none',
    workItemId: '',
    workLogId: '',
    companyId: '',
    companyLinkStatus: 'pending',
    companyHint: '',
    status: 'open',
    note: '',
  };
  assert.doesNotThrow(() => validateArchiveRecord(valid.id, valid));
  assert.throws(() => validateArchiveRecord(valid.id, Object.assign({}, valid, { companyName: '불법필드' })), /companyName/);
  assert.throws(() => validateArchiveRecord(valid.id, Object.assign({}, valid, { extraUnknown: 1 })), /허용되지 않은/);
  assert.throws(() => validateArchiveRecord(valid.id, Object.assign({}, valid, { summary: '가'.repeat(401) })), /summary/);
  assert.throws(() => validateArchiveRecord(valid.id, Object.assign({}, valid, { fileNames: ['등본_900101-1234567.pdf'] })), /주민번호/);
  assert.throws(() => validateArchiveRecord(valid.id, Object.assign({}, valid, { note: '메모 900101-1234567' })), /주민번호/);
});

test('capture.ps1 실제 OCR JSON 직렬화는 lines 를 중첩 배열([[...]])이 아닌 1차원 객체 배열로 반환한다', { skip: process.platform !== 'win32' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-ps1-'));
  const img = path.join(dir, 'sample.png');
  try {
    execFileSync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-Command',
      `Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(320,100); $g = [System.Drawing.Graphics]::FromImage($b); $g.Clear([System.Drawing.Color]::White); $f = New-Object System.Drawing.Font('Malgun Gothic',18); $g.DrawString('Test 123', $f, [System.Drawing.Brushes]::Black, 10, 20); $g.Dispose(); $b.Save('${img.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()`
    ], { stdio: 'ignore' });
    const res = createCapturer().testImage(img);
    assert.equal(res.ok, true);
    assert.ok(Array.isArray(res.captures) && res.captures.length === 1);
    const lines = res.captures[0].lines;
    assert.equal(Array.isArray(lines), true);
    if (lines.length > 0) {
      assert.equal(Array.isArray(lines[0]), false, 'lines 원소가 중첩 배열이면 안 됩니다');
      assert.equal(typeof lines[0].text, 'string');
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
