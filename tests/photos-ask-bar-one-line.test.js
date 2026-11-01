/* 사진첩 — 판독 물음 띠를 도구줄 «안» 한 줄로 (대표 지시 2026-09-28 「이부분 한줄로 합쳐달라」)
 *
 * 띠(「🖼 한꺼번에 올린 사진 7장 · 서류입니다 · 그냥 사진」)와 찾기 줄이 두 줄을 먹었다.
 * ★ 지키는 것: ① 넓은 화면에서는 띠가 도구줄 안(차례 고르개 앞)으로 들어간다
 *   ② 폰은 날마다 뜨는 「안 읽은 서류」 띠만 안으로 든다(2026-11-01 「추천대로」).
 *      사진을 골랐거나 「서류입니까?」·한도 띠면 도구줄 위로 비킨다 — 붙박이 줄이 두꺼워지면 사진이 가린다
 *   ③ 띠의 기본 크기가 설명 길이를 안 먹는다 — 먹으면 넓은 화면에서도 둘째 줄로 떨어진다
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { cutFn } = require('./cut-fn.js');

const RAW = fs.readFileSync(path.join(__dirname, '..', 'pu-photos.html'), 'utf8');
const CSS = (RAW.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');

/* 아주 작은 DOM — 부모·자식·insertBefore·appendChild 만 */
function node(id) {
  return { id: id, parentNode: null, children: [], classList: { toggle: function () {} },
    appendChild: function (c) { return this.insertBefore(c, null); },
    insertBefore: function (c, ref) {
      if (c.parentNode) { const a = c.parentNode.children; a.splice(a.indexOf(c), 1); }
      const i = ref ? this.children.indexOf(ref) : -1;
      if (ref && i < 0) throw new Error('insertBefore: 자식이 아니다');
      if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
      c.parentNode = this; return c;
    } };
}
function world(phone, kind) {
  const ids = {};
  const mk = function (id) { return (ids[id] = node(id)); };
  const photos = mk('viewPhotos'), grid = mk('gridBar'), ask = mk('readAskBar'), sort = mk('sortSeg');
  ask.className = kind === undefined ? 'wait' : kind;
  const collect = mk('collectBar');
  photos.appendChild(collect); photos.appendChild(ask); photos.appendChild(grid);
  grid.appendChild(mk('findBar')); grid.appendChild(mk('selAllBtn')); grid.appendChild(sort);
  const side = mk('side'); mk('phoneBar'); mk('chipRow');
  side.appendChild(mk('ownerPick')); side.appendChild(mk('foldWrap'));
  side.appendChild(mk('upWrap')); side.appendChild(mk('autoNote'));
  mk('phOwner'); mk('phUpDock'); mk('phCollectDock'); mk('row2'); mk('docBtn'); mk('shareCard');
  const ctx = { $: function (id) { return ids[id] || null; }, isPhone: function () { return phone; },
    phoneFindOn: false, selected: new Set(), closePhSheet: function () {}, renderPhNeedBtn: function () {}, renderPhSummary: function () {} };
  vm.createContext(ctx);
  vm.runInContext(cutFn(RAW, 'function placeForWidth('), ctx);
  vm.runInContext(cutFn(RAW, 'function placeAskBar('), ctx);
  return { ctx: ctx, ids: ids };
}

test('★★★ 넓은 화면에서는 띠가 도구줄 «안», 차례 고르개 «앞»에 들어간다', () => {
  const w = world(false);
  w.ctx.placeForWidth();
  const g = w.ids.gridBar;
  assert.equal(w.ids.readAskBar.parentNode, g, '★★★ 띠가 도구줄 밖에 있어 두 줄을 먹습니다');
  assert.equal(g.children.indexOf(w.ids.readAskBar) + 1, g.children.indexOf(w.ids.sortSeg),
    '★ 차례 고르개 바로 앞이 아닙니다 — 고르개가 오른쪽 끝에서 밀려납니다');
});

test('★★ 폰에서 「서류입니까?」·한도 띠는 도구줄 위로 비킨다 — 한 줄에 넣으면 제목이 「🖼 한…」까지 잘린다', () => {
  ['', 'out'].forEach(function (kind) {
    const w = world(false, kind);
    w.ctx.placeForWidth();                 // 넓게 → 안으로
    w.ctx.isPhone = function () { return true; };
    w.ctx.placeForWidth();                 // 좁게 → 위로
    const p = w.ids.viewPhotos;
    assert.equal(w.ids.readAskBar.parentNode, p, '★★ 폰에서 「' + kind + '」 띠가 도구줄 안에 남아 있습니다');
    assert.equal(p.children.indexOf(w.ids.readAskBar) + 1, p.children.indexOf(w.ids.gridBar),
      '★ 도구줄 바로 위가 아닙니다');
  });
});

test('★★ 폰에서 「안 읽은 서류」 띠는 도구줄 안 — 고르면 위로 비켰다가, 풀면 돌아온다', () => {
  const w = world(true, 'wait');
  w.ctx.placeForWidth();
  assert.equal(w.ids.readAskBar.parentNode, w.ids.gridBar, '★★ 날마다 뜨는 띠가 따로 한 줄을 먹습니다');
  w.ctx.selected.add('a');
  w.ctx.placeAskBar();
  assert.equal(w.ids.readAskBar.parentNode, w.ids.viewPhotos, '★★ 고른 단추로 꽉 찬 붙박이 줄에 띠까지 얹힙니다');
  w.ctx.selected.clear();
  w.ctx.placeAskBar();
  assert.equal(w.ids.readAskBar.parentNode, w.ids.gridBar, '★ 고르기를 풀어도 안 돌아옵니다');
});

test('★★ 두 번 불러도 자리가 흔들리지 않는다 — 창 크기를 바꿀 때마다 불린다', () => {
  const w = world(false);
  w.ctx.placeForWidth(); w.ctx.placeForWidth();
  assert.equal(w.ids.gridBar.children.filter(function (c) { return c.id === 'readAskBar'; }).length, 1);
});

test('★★ 도구줄 안의 띠는 «기본 크기 0» — 설명 길이를 먹으면 넓은 화면에서도 둘째 줄로 떨어진다', () => {
  const bar = (CSS.match(/#gridBar #readAskBar\{([^}]*)\}/) || ['', ''])[1];
  assert.match(bar, /flex:\s*\d+\s+1\s+0(px)?\s*[;}]?/, '★★ 띠의 기본 크기가 0 이 아닙니다: ' + bar);
  assert.match(bar, /min-width:\s*min-content/, '★ 제목·단추까지 줄어들어 눌 수 없게 됩니다');
  const ds = CSS.match(/#gridBar #readAskBar \.d,#gridBar #readAskBar \.tly\{([^}]*)\}/);
  assert.ok(ds && /width:\s*0/.test(ds[1]),
    '★★ 설명·셈이 최소 폭에 글 전체 길이를 넣습니다 — 1100px 에서 둘째 줄로 떨어졌습니다');
});
