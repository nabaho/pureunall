'use strict';
/* 아주 작은 «가짜 DOM» — 포털 화면 코드를 vm 에서 «실제로» 돌려 보는 검사용 (jsdom 이 없다).
   코드가 쓰는 것만 흉내 낸다: 만들기·붙이기·글·속성·듣는이·포커스.

   ⚠ innerHTML 에 쓰거나 읽으면 «던진다» — AI 가 쓴 글이 마크업으로 읽히는 길을 검사가 막는다.
   ⚠ 글자만 찾는 검사(=「되풀이된 실수 ②」)는 템플릿 안에서 코드가 지워져도 초록이다 — 그래서 돌려 본다. */

class 가짜칸 {
  constructor(태그, 문서) {
    this.tagName = String(태그 || 'div').toUpperCase();
    this.children = [];
    this.className = '';
    this.style = {};
    this.dataset = {};
    this.title = '';
    this.href = '';
    this._글 = '';
    this._속성 = {};
    this._듣는이 = {};
    this._문서 = 문서 || null;
    this.눌림 = 0;
    this.지워짐 = false;
    this.포커스받음 = 0;
  }
  get textContent() { return this._글 + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this._글 = v == null ? '' : String(v); this.children = []; }
  set innerHTML(_v) { throw new Error('innerHTML 로 넣었다 — AI 가 쓴 글은 textContent 로만 넣는다'); }
  get innerHTML() { throw new Error('innerHTML 을 읽었다'); }
  appendChild(c) { this.children.push(c); return c; }
  setAttribute(k, v) { this._속성[k] = String(v); }
  getAttribute(k) { return this._속성[k] == null ? null : this._속성[k]; }
  addEventListener(종류, 함수) { (this._듣는이[종류] = this._듣는이[종류] || []).push(함수); }
  focus() { this.포커스받음++; if (this._문서) this._문서.activeElement = this; }
  click() { this.눌림++; }
  querySelector() { return null; }
  remove() { this.지워짐 = true; }
}

/* 아이디로 찾을 칸들을 미리 만들어 둔 가짜 문서. 만들어 달라는 것(createElement)은 새 가짜칸. */
function 가짜문서(아이디들, 타일) {
  const 문서 = { activeElement: null, _칸들: {} };
  (아이디들 || []).forEach((id) => { 문서._칸들[id] = new 가짜칸('div', 문서); });
  문서.getElementById = (id) => 문서._칸들[id] || null;
  문서.createElement = (태그) => new 가짜칸(태그, 문서);
  문서.querySelector = () => 타일 || null;
  return 문서;
}

/* 듣는이에게 이벤트를 «쏜다». preventDefault·stopPropagation 이 불렸는지 막음·멈춤 으로 남는다. */
function 발사(칸, 종류, 덧붙임) {
  const e = Object.assign({ type: 종류, target: 칸, key: '', shiftKey: false, 막음: false, 멈춤: false }, 덧붙임 || {});
  e.preventDefault = () => { e.막음 = true; };
  e.stopPropagation = () => { e.멈춤 = true; };
  (칸._듣는이[종류] || []).slice().forEach((f) => f(e));
  return e;
}

/* 자손 가운데 클래스 낱말이 있는 것들 */
function 클래스로(칸, 낱말) {
  const 모음 = [];
  (칸.children || []).forEach((c) => {
    if (String(c.className || '').split(/\s+/).indexOf(낱말) >= 0) 모음.push(c);
    클래스로(c, 낱말).forEach((x) => 모음.push(x));
  });
  return 모음;
}

module.exports = { 가짜칸, 가짜문서, 발사, 클래스로 };
