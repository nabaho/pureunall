'use strict';
/* 한글 편집기 — 큰 .hwp 를 «일부만» 읽던 고장 (2026-11-08, 대표 «여전히 한글 위치나 글자 등이 이상하다»)
   ■ 무엇이었나
     한컴이 저장한 HWP 의 압축 스트림(DocInfo·BodyText/SectionN·BinData) 끝에는 8바이트 꼬리(CRC32 + 풀린 크기)가 붙어 있다.
     크롬의 DecompressionStream 은 이 꼬리를 «Junk found after end of compressed data» 로 거절하는데, 옛 `inflate` 는
     «그때까지 풀린 내용을 사용» 하며 오류를 삼켰다 → 이미 읽어 둔 첫 128KB 만 건지고 나머지는 버려졌다.
     편람(.hwp 2.5MB): 본문 2,692,248 바이트 중 131,072 바이트(4.9%)만 읽혀 문단 1,974개 중 411개, 표 279개 중 11개.
     DocInfo(글자·문단 모양 표)도 128KB 를 넘으면 잘려 글자 모양·문단 모양이 틀어지고, 큰 그림도 깨진다.
     (이 PC 바탕화면 .hwp 18,287개 중 1,279개(약 7%)가 본문 압축이 128KB 를 넘어 걸린다 — 읽기 전용 집계)
   ■ 이 검사
     ① 크롬처럼 «꼬리를 거절하고 첫 128KB 만 건네는» 가짜 해제기를 끼워 옛 함수가 정말 잘리는지(대조) 본다.
     ② 새 함수는 전부 푼다 / 꼬리가 달라도 푼다 / 잘린 압축은 던진다(일부만 돌려주지 않는다).
     ③ 자체 해제기(inflateRawJs)는 Node zlib 과 byte 단위로 같다(단계 0~9·고정 허프만·반복·난수).
     ④ 처음부터 끝까지: 꼬리 붙은 큰 HWP 를 readHwp 로 읽어 문단이 «하나도» 안 빠진다.
   node --test tests/hangul-hwp-inflate.test.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const assert = require('assert');
const { test } = require('node:test');
const { cutFn } = require('./cut-fn');
const R = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(R, 'hangul/js/hwp.js'), 'utf8').replace(/\r\n/g, '\n');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\n\s*\/\/[^\n]*/g, '\n');
const CODE = strip(SRC);

/* 크롬처럼 구는 가짜 해제기: 압축 끝 뒤에 자투리가 있으면 «이미 만든 첫 조각(128KB)만 건네고» 멈춘다.
   (실제 크롬 실측: 편람 본문 2,692,248 → 131,072 만 나옴. 자투리 없으면 전부 나온다.) */
function chromeLikeDS() {
  return class FakeDS {
    constructor(fmt) {
      if (fmt !== 'deflate-raw') throw new Error('deflate-raw 만 흉내 냅니다');
      const parts = [];
      this.writable = { getWriter: () => ({ write: async b => { parts.push(Buffer.from(b)); }, close: async () => {} }) };
      let step = 0, res = null;
      this.readable = {
        getReader: () => ({
          cancel: async () => {},
          read: async () => {
            if (!res) {
              const buf = Buffer.concat(parts);
              try { const r = zlib.inflateRawSync(buf, { info: true }); res = { out: r.buffer, junk: r.engine.bytesWritten < buf.length, bad: false }; }
              catch (e) { res = { out: Buffer.alloc(0), junk: false, bad: true }; }
            }
            if (res.bad) throw new TypeError('The compressed data is not valid');
            if (res.junk) {
              if (step++ === 0) return { done: false, value: new Uint8Array(res.out.subarray(0, 131072)) };
              throw new TypeError('Junk found after end of compressed data.');
            }
            if (step++ === 0) return { done: false, value: new Uint8Array(res.out) };
            return { done: true, value: undefined };
          },
        }),
      };
    }
  };
}
const u32 = (d, o) => (o + 4 <= d.length ? new DataView(d.buffer, d.byteOffset, d.byteLength).getUint32(o, true) : 0);
const oneLine = re => { const m = re.exec(CODE); assert.ok(m, '선언을 못 찾았습니다: ' + re); return m[0]; };
function load(DS) {
  const code = [oneLine(/const MAX_INFLATE_STREAM = [^\n]*/), oneLine(/const tooBig = [^\n]*/),
    cutFn(CODE, 'async function nativeInflate('), cutFn(CODE, 'function inflateRawJs('), cutFn(CODE, 'async function inflate(')].join('\n');
  return new Function('DecompressionStream', 'u32', code + '\nreturn { inflate, inflateRawJs, nativeInflate };')(DS || chromeLikeDS(), u32);
}
/* 옛 함수(오류를 삼키고 «그때까지 풀린 것»을 돌려줌) — 대조용 */
function loadOld() {
  const old = `async function inflate(data) {
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter();
    w.write(data).catch(() => {});
    w.close().catch(() => {});
    const reader = ds.readable.getReader(), chunks = [];
    let total = 0;
    try {
      for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); total += value.length; }
    } catch (e) { if (!total) throw e; }
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }`;
  return new Function('DecompressionStream', old + '\nreturn inflate;')(chromeLikeDS());
}

/* 모든 바이트가 쓰이는 «글 같은» 큰 자료 */
function sample(n) {
  const b = Buffer.alloc(n); let s = 99991;
  for (let i = 0; i < n; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; b[i] = (s >>> 24) % 61 + (i % 11 === 0 ? 100 : 30); }
  return b;
}
/* 한컴 꼬리: CRC32(4) + 풀린 크기(4) */
function hancomTail(src) {
  const t = Buffer.alloc(8);
  t.writeUInt32LE(zlib.crc32 ? zlib.crc32(src) : 0, 0); t.writeUInt32LE(src.length >>> 0, 4);
  return t;
}
const same = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

test('★★★ 한컴 꼬리가 붙은 큰 압축(128KB 넘게 풀림)을 «전부» 푼다', async () => {
  const src = sample(900_000);
  const packed = Buffer.concat([zlib.deflateRawSync(src), hancomTail(src)]);
  assert.ok(src.length > 131072 * 4);
  const { inflate } = load();
  const out = await inflate(new Uint8Array(packed));
  assert.strictEqual(out.length, src.length, '일부만 풀렸습니다: ' + out.length + ' / ' + src.length);
  assert.ok(same(out, src), '풀린 내용이 원본과 다릅니다');
});

test('★★ 대조: 옛 함수는 같은 자료에서 첫 128KB 만 돌려준다 — 이 검사가 헛돌지 않는다', async () => {
  const src = sample(900_000);
  const packed = Buffer.concat([zlib.deflateRawSync(src), hancomTail(src)]);
  const out = await loadOld()(new Uint8Array(packed));
  assert.strictEqual(out.length, 131072, '가짜 해제기가 크롬처럼 구는지 확인하세요(옛 함수 결과 ' + out.length + ')');
  assert.ok(out.length < src.length);
});

test('★★ 꼬리가 없는 보통 압축은 그대로 푼다', async () => {
  const src = sample(400_000);
  const { inflate } = load();
  assert.ok(same(await inflate(new Uint8Array(zlib.deflateRawSync(src))), src));
});

test('★★ 꼬리가 한컴 꼴이 아니어도(크기 값이 틀리거나 5바이트 자투리) 전부 푼다 — 자체 해제기가 받는다', async () => {
  const src = sample(500_000), z = zlib.deflateRawSync(src);
  const { inflate } = load();
  const badSize = Buffer.concat([z, Buffer.from([1, 2, 3, 4, 9, 9, 9, 9])]);
  assert.ok(same(await inflate(new Uint8Array(badSize)), src), '크기가 틀린 꼬리');
  const five = Buffer.concat([z, Buffer.from([7, 7, 7, 7, 7])]);
  assert.ok(same(await inflate(new Uint8Array(five)), src), '5바이트 자투리');
  const long = Buffer.concat([z, Buffer.alloc(300, 0xab)]);
  assert.ok(same(await inflate(new Uint8Array(long)), src), '300바이트 자투리');
});

test('★★ 잘린 압축은 던진다 — «일부만» 성공으로 돌려주지 않는다', async () => {
  const src = sample(600_000), z = zlib.deflateRawSync(src);
  const { inflate } = load();
  await assert.rejects(() => inflate(new Uint8Array(z.subarray(0, z.length - 40))), '끝이 잘린 압축을 성공으로 처리했습니다');
  await assert.rejects(() => inflate(new Uint8Array(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70]))), '압축이 아닌 자료(JPEG 머리)를 풀었다고 했습니다');
});

test('★ 작은 자료(128KB 미만)도 꼬리가 있든 없든 푼다', async () => {
  const { inflate } = load();
  for (const n of [0, 1, 100, 5000, 60_000]) {
    const src = sample(n), z = zlib.deflateRawSync(src);
    assert.ok(same(await inflate(new Uint8Array(z)), src), '꼬리 없음 ' + n);
    assert.ok(same(await inflate(new Uint8Array(Buffer.concat([z, hancomTail(src)]))), src), '꼬리 있음 ' + n);
  }
});

test('★★ 자체 해제기(inflateRawJs)는 zlib 과 byte 단위로 같다 — 단계 0~9 · 고정 허프만 · 반복 · 난수 · 빈 자료', () => {
  const { inflateRawJs } = load();
  const kinds = {
    빈: Buffer.alloc(0), 한바이트: Buffer.from([65]), 반복: Buffer.alloc(70_000, 0x61),
    글: Buffer.from('푸른노무법인 임금 퇴직금 연차 '.repeat(4000)), 샘플: sample(120_000),
    난수: (() => { const b = Buffer.alloc(40_000); let s = 7; for (let i = 0; i < b.length; i++) { s = (Math.imul(s, 69069) + 1) >>> 0; b[i] = s >>> 23; } return b; })(),
  };
  const strategies = [zlib.constants.Z_DEFAULT_STRATEGY, zlib.constants.Z_FIXED, zlib.constants.Z_HUFFMAN_ONLY, zlib.constants.Z_RLE, zlib.constants.Z_FILTERED];
  let n = 0;
  for (const [name, src] of Object.entries(kinds)) {
    for (let level = 0; level <= 9; level++) {
      for (const strategy of (level === 6 ? strategies : [zlib.constants.Z_DEFAULT_STRATEGY])) {
        const z = zlib.deflateRawSync(src, { level, strategy });
        const out = inflateRawJs(new Uint8Array(Buffer.concat([z, Buffer.from([1, 2, 3, 4, 5, 6, 7, 8])]))); // 뒤 자투리는 보지 않는다
        assert.ok(same(out, src), `${name} · 단계 ${level} · 전략 ${strategy} 에서 다릅니다 (${out.length}/${src.length})`);
        n++;
      }
    }
  }
  assert.ok(n >= 60);
});

test('★★ 자체 해제기는 깨진 자료에서 던진다 (끝없이 돌거나 엉뚱한 결과를 내지 않는다)', () => {
  const { inflateRawJs } = load();
  assert.throws(() => inflateRawJs(new Uint8Array([0xff, 0xff, 0xff])), /잘못|중간/);
  assert.throws(() => inflateRawJs(new Uint8Array(0)), /중간/);
  const z = zlib.deflateRawSync(sample(50_000));
  assert.throws(() => inflateRawJs(new Uint8Array(z.subarray(0, 100))), /중간|잘못/);
});

test('★ 일부만 돌려주는 길이 없다 — nativeInflate 는 오류를 삼키지 않는다', () => {
  const fn = cutFn(CODE, 'async function nativeInflate(');
  assert.ok(!/\btry\b/.test(fn), 'nativeInflate 가 오류를 삼키면(try) 잘린 결과가 «성공»으로 돌아갑니다');
  assert.match(cutFn(CODE, 'async function inflate('), /nativeInflate\(data\.subarray\(0, data\.length - 8\), limit\)/, '한컴 꼬리(8바이트)를 뗀 시도가 있어야 합니다');
});

/* ---- 처음부터 끝까지: 꼬리 붙은 큰 HWP 를 읽는다 ---- */
function sandbox(DS) {
  const ctx = vm.createContext({ console, TextDecoder, TextEncoder, DecompressionStream: DS, CompressionStream, Blob, Response, Uint8Array, Uint16Array, Uint32Array, DataView, setTimeout, performance, crypto: globalThis.crypto, atob, btoa, URL });
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  for (const f of ['zip', 'hwpx', 'shape', 'hwp']) vm.runInContext(fs.readFileSync(path.join(R, 'hangul/js', f + '.js'), 'utf8'), ctx, { filename: f });
  return ctx;
}
/* buildHwp(압축 안 함)로 큰 문서를 만든 뒤, DocInfo·본문을 압축하고 한컴 꼬리를 붙여 다시 싼다 */
function bigHancomLike(ctx, paras) {
  const H = ctx.PureunHwpx, K = ctx.PureunHwp;
  const blocks = [];
  for (let i = 0; i < paras; i++) blocks.push({ type: 'p', align: 'left', runs: [{ text: '제' + i + '번째 문단 푸른노무법인 임금 퇴직금 ' + '가나다라마바사'.repeat(i % 7), size: 8 + (i % 5), color: '#' + ((i * 7919) % 0xffffff).toString(16).padStart(6, '0') }] });
  const bytes = K.buildHwp({ page: H.defaultPage(), header: null, footer: null, pageNum: null, blocks });
  const files = K.readCfb(new Uint8Array(bytes));
  const out = {};
  for (const [name, data] of Object.entries(files)) {
    const buf = Buffer.from(data);
    if (name === 'DocInfo' || /^BodyText\//.test(name)) out[name] = new Uint8Array(Buffer.concat([zlib.deflateRawSync(buf), hancomTail(buf)]));
    else if (name === 'FileHeader') { const h = Buffer.from(data); h.writeUInt32LE(h.readUInt32LE(36) | 1, 36); out[name] = new Uint8Array(h); }
    else out[name] = data;
  }
  return { packed: K.writeCfb(out), docInfoSize: files.DocInfo.length, bodySize: files['BodyText/Section0'].length };
}
const arrBuf = u8 => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.length);

test('★★★ 처음부터 끝까지: 꼬리 붙은 큰 HWP(DocInfo·본문 모두 128KB 초과)를 읽어도 문단이 하나도 안 빠진다', async () => {
  const ctx = sandbox(chromeLikeDS());
  const PARAS = 3000;
  const { packed, docInfoSize, bodySize } = bigHancomLike(ctx, PARAS);
  assert.ok(docInfoSize > 131072 && bodySize > 131072 * 2, `시험 자료가 작습니다(DocInfo ${docInfoSize}, 본문 ${bodySize})`);
  const doc = await ctx.PureunHwp.readHwp(arrBuf(packed));
  assert.strictEqual(doc.blocks.length, PARAS, `문단 ${doc.blocks.length}/${PARAS} 만 읽혔습니다`);
  const text = b => b.runs.map(r => r.text || '').join('');
  assert.match(text(doc.blocks[PARAS - 1]), new RegExp('^제' + (PARAS - 1) + '번째 문단'), '마지막 문단이 다릅니다');
  assert.strictEqual(doc.skipped, 0);
  // DocInfo 끝쪽 글자 모양(색깔)도 살아 있다 — DocInfo 가 잘리면 뒤쪽 문단의 색·크기가 틀어진다
  const last = doc.blocks[PARAS - 1].runs[0];
  assert.strictEqual(last.size, 8 + ((PARAS - 1) % 5));
  assert.strictEqual(String(last.color).toLowerCase(), '#' + (((PARAS - 1) * 7919) % 0xffffff).toString(16).padStart(6, '0'));
});

test('★★ 대조: 옛 읽기는 같은 파일에서 문단 일부만 읽는다 (또는 아예 못 연다) — 처음부터 끝까지 검사가 헛돌지 않는다', async () => {
  const oldSrc = SRC.replace(/async function nativeInflate\(data, limit\) \{[\s\S]*?\n  \}\n  \/\/ RFC 1951/, `async function nativeInflate(data, limit) {
    const ds = new DecompressionStream('deflate-raw');
    const w = ds.writable.getWriter();
    w.write(data).catch(() => {});
    w.close().catch(() => {});
    const reader = ds.readable.getReader(), chunks = [];
    let total = 0;
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; chunks.push(value); total += value.length; } } catch (e) { if (!total) throw e; }
    const out = new Uint8Array(total);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }
  // RFC 1951`).replace(/async function inflate\(data, limit = MAX_INFLATE_STREAM\) \{[\s\S]*?\n  \}\n/, 'async function inflate(data, limit) { return nativeInflate(data, limit); }\n');
  assert.notStrictEqual(oldSrc, SRC, '옛 읽기로 되돌리지 못했습니다 — 이 검사의 바꿔치기를 고쳐야 합니다');
  const ctx = sandbox(chromeLikeDS());
  const { packed } = bigHancomLike(ctx, 3000);
  const ctxOld = vm.createContext(Object.assign({}, ctx)); // 같은 도구 모음
  ctxOld.window = ctxOld; ctxOld.globalThis = ctxOld; ctxOld.self = ctxOld;
  ctxOld.PureunHwp = undefined;
  vm.runInContext(oldSrc, ctxOld, { filename: 'hwp-old' });
  let blocks = 0;
  try { blocks = (await ctxOld.PureunHwp.readHwp(arrBuf(packed))).blocks.length; } catch (e) { blocks = -1; }
  assert.ok(blocks < 3000, '옛 읽기가 전부 읽었다면 이 검사는 고장을 못 잡습니다(' + blocks + ')');
});

/* ---- 압축 폭탄 막기 (2026-11-09 자동 검토 «중간»: 해제 크기 상한이 없었다) ---- */
test('★★★ 압축 폭탄: 상한을 넘으면 «바로» 던진다 — 자체 해제기로 다시 시도하지 않는다', async () => {
  const bomb = zlib.deflateRawSync(Buffer.alloc(40 * 1024 * 1024)); // 40MB 가 수십 KB 로
  assert.ok(bomb.length < 100_000, '시험 자료가 폭탄처럼 압축되지 않았습니다: ' + bomb.length);
  let made = 0;
  const Base = chromeLikeDS();
  const Counting = class extends Base { constructor(f) { super(f); made++; } };
  const { inflate } = load(Counting);
  await assert.rejects(() => inflate(new Uint8Array(bomb), 1024 * 1024), e => e && e.tooBig === true && /너무 큽니다/.test(e.message));
  assert.strictEqual(made, 1, '상한을 넘었는데 해제를 ' + made + '번 시도했습니다(한 번에 멈춰야 합니다)');
});

test('★★ 자체 해제기도 상한을 지킨다 — 상한 밖으로는 버퍼를 키우지 않는다', () => {
  const { inflateRawJs } = load();
  const bomb = zlib.deflateRawSync(Buffer.alloc(30 * 1024 * 1024));
  assert.throws(() => inflateRawJs(new Uint8Array(bomb), 2 * 1024 * 1024), e => e && e.tooBig === true);
  const ok = zlib.deflateRawSync(Buffer.alloc(1024 * 1024, 7));
  assert.strictEqual(inflateRawJs(new Uint8Array(ok), 2 * 1024 * 1024).length, 1024 * 1024, '상한 안이면 그대로 풀립니다');
});

test('★★ 상한은 실제 문서가 걸리지 않을 만큼 넉넉하다 — 한 줄기 ≥ 64MB(실측 최대 37MB), 문서 전체 ≥ 한 줄기, 1GB 미만', () => {
  const m = /const MAX_INFLATE_STREAM = ([^,]+), MAX_INFLATE_DOC = ([^;]+);/.exec(CODE);
  assert.ok(m, '상한 선언을 못 찾았습니다');
  const STREAM = eval(m[1]), DOC = eval(m[2]);
  assert.ok(STREAM >= 64 * 1024 * 1024, '정상 문서(한 줄기 37MB)가 걸립니다');
  assert.ok(DOC >= STREAM);
  assert.ok(DOC < 1024 * 1024 * 1024, '상한이 너무 큽니다');
});

test('★★ 문서 전체 상한: 줄기를 여럿으로 쪼개도 합쳐서 막는다 — 처음부터 끝까지 읽기가 거절한다', async () => {
  const smallCap = SRC.replace(/MAX_INFLATE_DOC = [^;]+;/, 'MAX_INFLATE_DOC = 300 * 1024;');
  assert.notStrictEqual(smallCap, SRC, '문서 전체 상한 선언을 못 찾았습니다');
  const ctxA = sandbox(chromeLikeDS());
  const { packed } = bigHancomLike(ctxA, 3000); // DocInfo 235KB + 본문 454KB = 690KB 로 풀림
  const ctx = vm.createContext(Object.assign({}, ctxA));
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx; ctx.PureunHwp = undefined;
  vm.runInContext(smallCap, ctx, { filename: 'hwp-small-cap' });
  await assert.rejects(() => ctx.PureunHwp.readHwp(arrBuf(packed)), e => e && e.tooBig === true, '문서 전체 상한을 넘었는데 읽혔습니다');
  const ok = await ctxA.PureunHwp.readHwp(arrBuf(packed)); // 진짜 상한(256MB)에서는 읽힘
  assert.strictEqual(ok.blocks.length, 3000);
});

/* ---- 재검증 «중간»: 자체 해제기가 «출력 길이»만 막고 버퍼를 상한 밖으로 잡던 것 (2026-11-09) ---- */
function loadSpy(log) {
  const Spy = class extends Uint8Array { constructor(a, b, c) { super(a, b, c); if (typeof a === 'number') log.push(a); } };
  const code = [oneLine(/const MAX_INFLATE_STREAM = [^\n]*/), oneLine(/const tooBig = [^\n]*/), cutFn(CODE, 'function inflateRawJs(')].join('\n');
  return new Function('Uint8Array', code + '\nreturn inflateRawJs;')(Spy);
}
const biggest = log => log.reduce((a, b) => Math.max(a, b), 0);

test('★★★ 자체 해제기는 첫 버퍼를 상한 안에서만 잡는다 — 빈 압축 뒤에 큰 자투리를 붙여도 입력 길이의 4배를 잡지 않는다', () => {
  const log = [];
  const inflateRawJs = loadSpy(log);
  const LIMIT = 5000;
  const empty = zlib.deflateRawSync(Buffer.alloc(0));
  const src = new Uint8Array(Buffer.concat([empty, Buffer.alloc(1024 * 1024, 9)])); // 입력 1MB → 옛 코드는 4MB 를 한꺼번에 잡았다
  const out = inflateRawJs(src, LIMIT);
  assert.strictEqual(out.length, 0, '빈 압축은 빈 결과');
  assert.ok(biggest(log) <= LIMIT, '버퍼를 ' + biggest(log) + ' 바이트 잡았습니다(상한 ' + LIMIT + ')');
});

test('★★ 늘릴 때도 상한을 넘지 않는다 — 두 배로 키우다 상한 밖으로 나가지 않는다', () => {
  const log = [];
  const inflateRawJs = loadSpy(log);
  const LIMIT = 5000;
  const data = Buffer.alloc(4500, 3); // 4096 으로 시작해 4500 이 되려면 늘려야 한다(옛 코드는 8192 로 키웠다)
  const out = inflateRawJs(new Uint8Array(zlib.deflateRawSync(data)), LIMIT);
  assert.strictEqual(out.length, 4500);
  assert.ok(biggest(log) <= LIMIT, '늘린 버퍼가 ' + biggest(log) + ' 바이트(상한 ' + LIMIT + ')');
});

test('★★ 상한 0(문서 전체 상한을 다 쓴 뒤)에서도 던지지 터지지 않는다', () => {
  const inflateRawJs = loadSpy([]);
  assert.throws(() => inflateRawJs(new Uint8Array(zlib.deflateRawSync(Buffer.alloc(10, 1))), 0), e => e && e.tooBig === true);
  assert.strictEqual(inflateRawJs(new Uint8Array(zlib.deflateRawSync(Buffer.alloc(0))), 0).length, 0);
});
