// 브라우저용 path 대역 — kordoc 는 파일 경로를 CLI·MCP 에서만 쓴다
const norm = (p) => String(p).replace(/\\/g, '/');
export const join = (...a) => a.map(norm).join('/').replace(/\/+/g, '/');
export const dirname = (p) => norm(p).replace(/\/[^/]*$/, '') || '.';
export const basename = (p, e) => { const b = norm(p).split('/').pop(); return e && b.endsWith(e) ? b.slice(0, -e.length) : b; };
export const extname = (p) => { const m = /\.[^./]*$/.exec(basename(p)); return m ? m[0] : ''; };
export const resolve = (...a) => join(...a);
export const relative = (a, b) => b;
export const sep = '/';
export const isAbsolute = (p) => norm(p).startsWith('/');
export const normalize = norm;
export const parse = (p) => ({ dir: dirname(p), base: basename(p), ext: extname(p), name: basename(p, extname(p)) });
export default { join, dirname, basename, extname, resolve, relative, sep, isAbsolute, normalize, parse };
