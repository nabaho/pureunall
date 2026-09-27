const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('js/pu-obsidian.js', 'utf8');

test('옵시디언 연결은 공식 obsidian URI로 새 메모리를 연다', () => {
  assert.match(source, /obsidian:\/\/new\?name=/);
  assert.match(source, /encodeURIComponent\(n\.body\)/);
});

test('업무요약 메모리는 원본·첨부파일 없이 ERP 링크와 업무 필드를 담는다', () => {
  for (const field of ['업체', '담당자', '기한', 'ERP 원본', '업무 요약', '다음 할 일']) assert.match(source, new RegExp(field));
  assert.match(source, /원본 자료와 첨부파일은 포함하지 않습니다/);
});

test('업무요약 연결은 허용된 팔레트 색을 사용한다', () => {
  assert.match(source, /#1e40af/);
});

/* 2026-09-27 — 떠 있는 단추가 이알피 왼쪽 메뉴 맨 아래 「⚙ 환경설정」을 통째로 덮었다
   (대표 「환경관리가 사라졌다」). 이알피는 메뉴 바닥 한 줄에서 연다. */
test('★★ 이알피에서는 떠 있는 단추를 달지 않는다 — 환경설정을 덮는다', () => {
  const erp = fs.readFileSync('pu-erp.html', 'utf8');
  const flag = erp.indexOf('window.PU_OBSIDIAN_NO_FAB = true');
  const tag = erp.search(/<script src="js\/pu-obsidian\.js\?v=\d+"><\/script>/);
  assert.ok(flag > 0 && tag > flag, '★★ 공용 파일보다 먼저 「단추 달지 말라」를 알려야 합니다 — 늦으면 이미 떠 있습니다');
  assert.match(source, /function mount\(\) \{\s*if \(w\.PU_OBSIDIAN_NO_FAB\) return;/, '★★ 공용 파일이 그 신호를 안 봅니다');
});

test('★★ 이알피 메뉴 바닥에서 연다 — 환경설정 바로 위, 환경설정 권한이 없어도', () => {
  const erp = fs.readFileSync('pu-erp.html', 'utf8');
  const at = erp.indexOf("h('span', { className:'mi-text' }, '옵시디언 업무요약')");
  const env = erp.indexOf("h('span', { className:'mi-text' }, '환경설정')");
  assert.ok(at > 0, '★★ 메뉴에 옵시디언 줄이 없습니다 — 쓸 길이 사라졌습니다');
  assert.ok(env > at && env - at < 800, '★ 옵시디언 줄이 환경설정 바로 위(같은 바닥 줄)에 있지 않습니다');
  assert.ok(erp.slice(at - 600, at).includes('window.PuObsidian.show()'), '★★ 눌러도 창이 안 열립니다');
  assert.ok(erp.includes("(isMenuPermitted(CURRENT_USER, 'env/settings') || window.PuObsidian) && h('div'"),
    '★ 환경설정 권한이 없는 직원에게는 옵시디언 줄도 사라집니다');
});
