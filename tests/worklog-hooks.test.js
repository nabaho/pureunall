'use strict';
/* 작업 기록 고리 — 계약서등관리 화면과 양식 모듈이 PuWorklog 를 부르는지 소스 글자로 확인 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { test } = require('node:test');
const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const cut = (src, head) => { const i = src.indexOf(head); assert.ok(i >= 0, head + ' 없음'); return src.slice(i, i + 2500); };
const H = read('docs-esign.html'), F = read('js/pu-contract-forms.js');
test('스크립트가 실린다', () => assert.match(H, /<script src="js\/pu-worklog\.js\?v=\d+"><\/script>/));
test('init 은 보관함과 같이', () => assert.match(cut(H, 'function officeInit'), /PuWorklog\.init\(\{ db: db, uid: curUser\.uid, name: meName\(\) \}\)/));
test('올리기', () => assert.match(cut(H, 'function archiveOriginal'), /PuWorklog\.log\('upload'/));
test('내려받기', () => assert.match(cut(H, 'function downloadOriginal'), /PuWorklog\.log\('download'/));
test('메일·받기', () => assert.match(cut(H, 'function formMailRecord'), /PuWorklog\.log\(o\.how === '받기' \? 'download' : 'mail_send'/));
test('서명 요청', () => assert.match(cut(H, 'function formSignCreate'), /PuWorklog\.log\('sign_request'/));
test('묶음', () => assert.match(cut(H, 'async function formZip'), /PuWorklog\.log\('download'/));
test('서식 저장', () => assert.match(cut(F, 'function change(fn, okMsg, undo)'), /host\.log && host\.log\('form_save'/));
test('호스트 log', () => assert.match(H, /log: function \(k, o\) \{ return PuWorklog\.log\(k, o\); \}/));
test('버전', () => assert.match(H, /pu-contract-forms\.js\?v=69/));
