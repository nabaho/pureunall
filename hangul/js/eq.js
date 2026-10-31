// 한글 수식 스크립트 → MathML (화면 표시용). 저장은 스크립트 그대로
(function (g) {
  const GREEK = 'alpha:α beta:β gamma:γ delta:δ epsilon:ε zeta:ζ eta:η theta:θ iota:ι kappa:κ lambda:λ mu:μ nu:ν xi:ξ omicron:ο pi:π rho:ρ sigma:σ tau:τ upsilon:υ phi:φ chi:χ psi:ψ omega:ω';
  const greek = {};
  for (const pair of GREEK.split(' ')) { const [k, v] = pair.split(':'); greek[k] = v; greek[k.toUpperCase()] = v.toUpperCase(); }
  greek.vartheta = 'ϑ'; greek.varphi = 'ϕ'; greek.varepsilon = 'ϵ';
  // 기호 (대소문자 구분 없이)
  const SYM = {
    times: '×', divide: '÷', '+-': '±', '-+': '∓', pm: '±', mp: '∓', cdot: '·', cdots: '⋯', ldots: '…', vdots: '⋮', ddots: '⋱', inf: '∞', infty: '∞', deg: '°', angle: '∠',
    perp: '⊥', triangle: '△', therefore: '∴', because: '∵', sim: '∼', approx: '≈', equiv: '≡', neq: '≠', '!=': '≠', '<=': '≤', '>=': '≥', leq: '≤', geq: '≥', le: '≤', ge: '≥',
    '<<': '≪', '>>': '≫', '->': '→', '<-': '←', '<->': '↔', '=>': '⇒', '==>': '⇒', '<==': '⇐', rarrow: '→', larrow: '←', in: '∈', notin: '∉', owns: '∋', subset: '⊂', superset: '⊃',
    subseteq: '⊆', supseteq: '⊇', cup: '∪', cap: '∩', emptyset: '∅', forall: '∀', exist: '∃', partial: '∂', nabla: '∇', prime: '′', circ: '∘', bullet: '•', star: '★', smallsum: '∑',
    and: '∧', or: '∨', not: '¬', xor: '⊻', oplus: '⊕', otimes: '⊗', odot: '⊙', parallel: '∥', propto: '∝', '□': '□', '☐': '☐',
  };
  const BIG = { sum: '∑', prod: '∏', coprod: '∐', int: '∫', oint: '∮', dint: '∬', tint: '∭', bigcup: '⋃', bigcap: '⋂', union: '⋃', inter: '⋂', lim: 'lim', Lim: 'lim', max: 'max', min: 'min' };
  const ACCENT = { bar: '¯', hat: '^', vec: '→', dot: '˙', ddot: '¨', tilde: '~', acute: '´', grave: '`', check: 'ˇ', arch: '⌒', dyad: '↔' };
  const FUNC = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'log', 'ln', 'exp', 'det', 'mod', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'lg', 'gcd', 'lcm']);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function tokenize(src) {
    const out = [];
    const re = /\s+|"[^"]*"|[A-Za-z]+|\d+(?:\.\d+)?|<->|<=|>=|!=|->|<-|==>|<==|=>|<<|>>|\+-|-\+|[{}^_&#~`]|[\s\S]/g;
    let m;
    while ((m = re.exec(src))) { if (/^\s+$/.test(m[0])) { out.push({ t: 'ws' }); continue; } out.push({ t: 'tok', v: m[0] }); }
    return out;
  }

  function toMathML(script, opts = {}) {
    const toks = tokenize(String(script || '').replace(/\r?\n/g, ' '));
    let i = 0;
    const peek = () => { while (i < toks.length && toks[i].t === 'ws') i++; return toks[i]; };
    const next = () => { const t = peek(); i++; return t; };
    const isWord = (t, w) => t && t.t === 'tok' && t.v.toLowerCase() === w;
    // 묶음 하나 (중괄호 묶음 또는 낱말 하나)
    function atom() {
      const t = next();
      if (!t) return '<mrow/>';
      const v = t.v, lv = v.toLowerCase();
      if (v === '{') { const inner = seq('}'); return `<mrow>${inner}</mrow>`; }
      if (v === '}' ) return '';
      if (v === '~') return '<mspace width="0.3em"/>';
      if (v === '`') return '<mspace width="0.1em"/>';
      if (v[0] === '"') return `<mtext>${esc(v.slice(1, -1))}</mtext>`;
      if (/^\d/.test(v)) return `<mn>${v}</mn>`;
      if (lv === 'sqrt') return `<msqrt>${atom()}</msqrt>`;
      if (lv === 'root') { const n = atom(); if (isWord(peek(), 'of')) next(); return `<mroot>${atom()}${n}</mroot>`; }
      if (ACCENT[lv]) return `<mover accent="true">${atom()}<mo>${ACCENT[lv]}</mo></mover>`;
      if (lv === 'under' || lv === 'underline') return `<munder>${atom()}<mo>_</mo></munder>`;
      if (lv === 'rm' || lv === 'it' || lv === 'bold') { const a = atom(); return lv === 'bold' ? `<mrow style="font-weight:bold">${a}</mrow>` : lv === 'rm' ? a.replace(/<mi>/g, '<mi mathvariant="normal">') : a; }
      if (BIG[lv] !== undefined || BIG[v] !== undefined) {
        const sym = BIG[lv] || BIG[v];
        let lo = '', hi = '';
        for (;;) {
          const p = peek();
          if (isWord(p, 'from') || (p && p.v === '_')) { next(); lo = atom(); }
          else if (isWord(p, 'to') || (p && p.v === '^')) { next(); hi = atom(); }
          else break;
        }
        const op = /^[a-z]+$/.test(sym) ? `<mi>${sym}</mi>` : `<mo largeop="true">${sym}</mo>`;
        return lo && hi ? `<munderover>${op}${lo}${hi}</munderover>` : lo ? `<munder>${op}${lo}</munder>` : hi ? `<mover>${op}${hi}</mover>` : op;
      }
      if (lv === 'left') { const l = next(); const inner = seq('right'); next(); const r = next(); return `<mrow><mo stretchy="true">${esc(brk(l))}</mo>${inner}<mo stretchy="true">${esc(brk(r))}</mo></mrow>`; }
      if (/^[pbd]?matrix$|^cases$|^[lr]?pile$/.test(lv)) return table(lv);
      if (lv === 'longdiv') { const a = atom(), q = atom(), b = atom(); return longdiv(a, q, b); }
      if (lv === 'ladder') return ladder();
      if (greek[v]) return `<mi>${greek[v]}</mi>`;
      if (greek[lv] && v === lv) return `<mi>${greek[lv]}</mi>`;
      if (SYM[lv] !== undefined) return `<mo>${SYM[lv]}</mo>`;
      if (FUNC.has(lv)) return `<mi mathvariant="normal">${v}</mi>`;
      if (/^[A-Za-z]+$/.test(v)) return v.length === 1 ? `<mi>${v}</mi>` : `<mi mathvariant="italic">${v}</mi>`;
      return `<mo>${esc(v)}</mo>`;
    }
    const brk = t => (!t ? '' : { lbrace: '{', rbrace: '}', '{': '{', '}': '}', '.': '', lfloor: '⌊', rfloor: '⌋', lceil: '⌈', rceil: '⌉', '<': '⟨', '>': '⟩', line: '|', dline: '‖' }[t.v.toLowerCase()] ?? t.v);
    // 첨자: 항목 뒤 ^ _ (SUP · SUB 도)
    function item() {
      let base = atom();
      for (;;) {
        const p = peek();
        if (!p) break;
        const lv = p.v.toLowerCase();
        if (p.v === '^' || lv === 'sup') { next(); const s = atom(); const q = peek(); if (q && (q.v === '_' || q.v.toLowerCase() === 'sub')) { next(); base = `<msubsup>${base}${atom()}${s}</msubsup>`; } else base = `<msup>${base}${s}</msup>`; }
        else if (p.v === '_' || lv === 'sub') { next(); const s = atom(); const q = peek(); if (q && (q.v === '^' || q.v.toLowerCase() === 'sup')) { next(); base = `<msubsup>${base}${s}${atom()}</msubsup>`; } else base = `<msub>${base}${s}</msub>`; }
        else break;
      }
      return base;
    }
    // 이어지는 항목들 (OVER · ATOP 은 앞뒤 항목을 분수로)
    function seq(end) {
      const parts = [];
      for (;;) {
        const p = peek();
        if (!p) break;
        const lv = p.v.toLowerCase();
        if (end && (p.v === end || lv === end)) { if (end === '}') next(); break; }
        if (end === 'row' && (p.v === '&' || p.v === '#' || p.v === '}')) break;
        if (lv === 'over' || lv === 'atop') { next(); const num = parts.pop() || '<mrow/>'; parts.push(`<mfrac${lv === 'atop' ? ' linethickness="0"' : ''}>${num}${item()}</mfrac>`); continue; }
        if (p.v === '}' ) { next(); continue; }
        parts.push(item());
      }
      return parts.join('');
    }
    // 행렬류: { a & b # c & d }
    function table(kind) {
      const t = next();
      if (!t || t.v !== '{') return '';
      const rows = [[]];
      for (;;) {
        const p = peek();
        if (!p) break;
        if (p.v === '}') { next(); break; }
        if (p.v === '&') { next(); rows[rows.length - 1].push(null); continue; }
        if (p.v === '#') { next(); rows.push([]); continue; }
        const cell = seq('row');
        const r = rows[rows.length - 1];
        if (r.length && r[r.length - 1] === null) r[r.length - 1] = cell; else r.push(cell);
      }
      const al = kind === 'lpile' || kind === 'cases' ? 'left' : kind === 'rpile' ? 'right' : 'center';
      const body = `<mtable columnalign="${al}">${rows.map(r => `<mtr>${r.map(c => `<mtd>${c || ''}</mtd>`).join('')}</mtr>`).join('')}</mtable>`;
      const fence = { pmatrix: ['(', ')'], bmatrix: ['[', ']'], dmatrix: ['|', '|'], cases: ['{', ''] }[kind];
      return fence ? `<mrow><mo stretchy="true">${fence[0]}</mo>${body}<mo stretchy="true">${fence[1]}</mo></mrow>` : body;
    }
    // 나눗셈 세로식: 몫은 위, 나누는 수 ) 나뉘는 수 (윗줄)
    const longdiv = (divisor, quot, dividend) => {
      const lines = String(dividend).split(/<mo>#<\/mo>/);
      return `<mtable columnalign="right"><mtr><mtd></mtd><mtd>${quot}</mtd></mtr><mtr><mtd>${divisor}</mtd><mtd style="border-top:1px solid;border-left:1px solid;padding-left:2px">${lines[0]}</mtd></mtr>${lines.slice(1).map(l => `<mtr><mtd></mtd><mtd>${l}</mtd></mtr>`).join('')}</mtable>`;
    };
    // 사다리꼴 나눗셈(소인수 분해): 행은 #, 칸은 &
    function ladder() {
      const t = next();
      if (!t || t.v !== '{') return '';
      const rows = [[]];
      for (;;) {
        const p = peek();
        if (!p) break;
        if (p.v === '}') { next(); break; }
        if (p.v === '&') { next(); rows[rows.length - 1].push(null); continue; }
        if (p.v === '#') { next(); rows.push([]); continue; }
        const cell = seq('row');
        const r = rows[rows.length - 1];
        if (r.length && r[r.length - 1] === null) r[r.length - 1] = cell; else r.push(cell);
      }
      return `<mtable>${rows.map((r, ri) => `<mtr>${r.map((c, ci) => `<mtd style="${ci === 0 ? 'padding-right:3px' : ''}${ci === 1 && ri < rows.length - 1 ? ';border-left:1px solid' : ''}${ci >= 1 && ri < rows.length - 1 ? ';border-bottom:1px solid' : ''}">${c || ''}</mtd>`).join('')}</mtr>`).join('')}</mtable>`;
    }
    const body = seq(null);
    return `<math xmlns="http://www.w3.org/1998/Math/MathML"${opts.style ? ` style="${opts.style}"` : ''}><mrow>${body}</mrow></math>`;
  }

  g.PureunEq = { toMathML };
})(typeof window !== 'undefined' ? window : globalThis);
