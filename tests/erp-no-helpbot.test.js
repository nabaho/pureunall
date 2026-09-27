'use strict';
/* 푸른ERP AI 도우미는 걷어냈다 (대표 지시 2026-09-27)
   「푸른이알피 도우미가 필요가 없다 삭제해라 추후에 통합시스템 전반에 대한 챗봇이 필요할 것 같다」
   ■ 지키는 것
     ⓐ 이알피 한 화면용 도우미(머리줄 🤖 단추 · 「?」 단축키 · 옆 창)는 되살리지 않는다 —
        챗봇은 나중에 «통합시스템 전반»으로 따로 만든다.
     ⓑ AI 로 보내는 길(erpAiProxyUrl)은 상담 «AI 요약»이 계속 쓴다 — 함께 지우면 요약이 멎는다. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { stripComments } = require('./strip-comments');

const app = stripComments(fs.readFileSync(path.join(__dirname, '..', 'pu-erp.html'), 'utf8'));

test('ⓐ ★ 이알피 AI 도우미가 되살아나지 않았다', () => {
  assert.ok(app.indexOf('function HelpBot(') < 0, '★ 도우미 화면이 다시 생겼습니다');
  assert.ok(app.indexOf('onHelpOpen') < 0, '★ 머리줄 도우미 단추가 다시 생겼습니다');
  assert.ok(!/e\.key !== '\?'/.test(app), '★ 「?」 단축키가 다시 생겼습니다');
  assert.ok(app.indexOf('data-tour="help"') < 0, '★ 둘러보기가 없는 단추를 가리킵니다');
});

test('ⓑ ★★ AI 요약은 그대로 프록시로 나간다 — 도우미와 함께 지우면 안 된다', () => {
  assert.match(app, /function erpAiProxyUrl\(\)/, '★★ AI 로 보내는 길까지 지웠습니다 — 상담 AI 요약이 멎습니다');
  assert.match(app, /function aiSummarize\(\)\{[\s\S]{0,800}erpAiProxyUrl\(\)/, '★★ AI 요약이 그 길을 안 씁니다');
});
