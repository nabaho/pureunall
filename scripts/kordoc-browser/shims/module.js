// createRequire 대역 — kordoc 는 한글(.hwp) 상자를 열 때 require("cfb") 를 쓴다.
// 브라우저에서는 묶음 안의 cfb 를 돌려준다. 다른 것(pdfjs 자산 경로 등)은 없다고 던진다(부르는 쪽이 try 로 받는다).
import * as CFB from 'cfb';
const TABLE = { cfb: CFB.default || CFB };
export function createRequire() {
  const req = function (id) {
    if (TABLE[id]) return TABLE[id];
    throw new Error('브라우저에서는 불러올 수 없는 부품: ' + id);
  };
  req.resolve = function (id) { throw new Error('브라우저에서는 경로를 찾을 수 없음: ' + id); };
  return req;
}
export default { createRequire };
