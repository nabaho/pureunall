'use strict';
/* 뉴스레터 화면(pu-news.html)의 본 스크립트를 «통째로» vm 에 올려 화면 함수를 실제로 돌린다.
   ★ 왜 — 2026-10-11 에 받는 명단 화면을 고치다가 거르개·머리 단추를 만드는 const 들이
     «통째로 지워졌는데» 문법 검사는 통과했다. 쓰는 곳은 템플릿 안이라, 화면을 열어야만
     ReferenceError 가 난다. 글자 찾기로는 못 잡는다 — 돌려 봐야 잡힌다.
   ⚠ 파이어베이스·DOM 은 흉내만 낸다. 시작할 때 도는 코드는 막혀도 괜찮다 —
     함수 «선언»은 그 전에 다 올라간다(호이스팅). */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function 요소() {
  const el = {
    style: {}, dataset: {}, value: '', textContent: '', innerHTML: '', children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, removeEventListener() {}, appendChild(x) { return x; },
    setAttribute() {}, getAttribute() { return null; }, querySelector() { return null; },
    querySelectorAll() { return []; }, closest() { return null; }, focus() {}, scrollTo() {},
    getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; }
  };
  return el;
}

function 화면올리기(App덧) {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'pu-news.html'), 'utf8');
  const 글들 = [];
  const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g;
  let m; while ((m = re.exec(html))) 글들.push(m[1]);
  const 본 = 글들.sort((a, b) => b.length - a.length)[0];
  const 요소들 = {};
  const 문서 = {
    getElementById: (id) => (요소들[id] = 요소들[id] || 요소()),
    querySelector: () => 요소(), querySelectorAll: () => [], createElement: () => 요소(),
    addEventListener() {}, body: 요소(), documentElement: 요소(), head: 요소(), title: ''
  };
  const 빈참조 = () => ({ once: () => new Promise(() => {}), on() {}, off() {}, child: 빈참조,
    orderByKey: 빈참조, limitToLast: 빈참조, orderByChild: 빈참조, equalTo: 빈참조,
    set: async () => {}, update: async () => {}, remove: async () => {}, transaction: async () => ({}) });
  const 짐 = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    document: 문서, location: { search: '', href: 'https://x.test/pu-news.html', hash: '' },
    navigator: { userAgent: 'node' }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {}, removeEventListener() {}, getComputedStyle: () => ({}),
    fetch: () => new Promise(() => {}), alert() {}, confirm: () => true, prompt: () => null,
    URLSearchParams, Promise, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set,
    encodeURIComponent, decodeURIComponent, isNaN, parseInt, parseFloat, Intl,
    firebase: { apps: [], initializeApp: () => ({}), auth: () => ({ onAuthStateChanged() {} }),
      database: () => ({ ref: 빈참조 }), app: () => ({}) },
    PuNewsCore: require('../../js/pu-news-core.js')
  };
  짐.window = 짐; 짐.self = 짐; 짐.globalThis = 짐;
  짐.요소들 = 요소들;   /* 검사가 창 안의 글(innerHTML)을 읽을 수 있게 */
  vm.createContext(짐);
  try { vm.runInContext(본, 짐, { filename: 'pu-news.html#main' }); } catch (e) { 짐.올림오류 = e; }
  if (짐.App && App덧) Object.assign(짐.App, App덧);
  return 짐;
}

module.exports = { 화면올리기 };
