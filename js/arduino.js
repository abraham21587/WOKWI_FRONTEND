// Intérprete mínimo de C/Arduino (setup/loop, pinMode, digitalWrite, analogWrite, delay, for/while/if...)
// Conecta el texto del editor (sketch.ino) con el circuito: escribe el estado de los pines en Lab.pins,
// que sim.js lee para modelar cada pin OUTPUT como una fuente de voltaje dentro del solver DC.
(() => {
  if (typeof window === 'undefined' || !window.Lab) return;
  const $ = (s) => document.querySelector(s);
  Lab.pins = Lab.pins || {};

  // ---------- Errores y señales de control ----------
  class ArduinoSyntaxError extends Error {}
  class ArduinoRuntimeError extends Error {}
  class ReturnSignal { constructor(value) { this.value = value; } }
  class BreakSignal {}
  class ContinueSignal {}

  // ---------- Preprocesado: comentarios, #include, #define ----------
  function preprocess(src) {
    src = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');
    src = src.replace(/^[ \t]*#\s*include[^\n]*$/gm, '');
    const defines = {};
    src = src.replace(/^[ \t]*#\s*define\s+(\w+)\s+([^\n]*)$/gm, (m, name, val) => { defines[name] = val.trim(); return ''; });
    let changed = true, guard = 0;
    while (changed && guard++ < 5) {
      changed = false;
      Object.entries(defines).forEach(([name, val]) => {
        const re = new RegExp('\\b' + name + '\\b', 'g');
        if (re.test(src)) { src = src.replace(re, val); changed = true; }
      });
    }
    return src.replace(/^[ \t]*#[^\n]*$/gm, '');
  }

  // ---------- Tokenizer ----------
  const OPS2 = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>'];
  const OPS3 = ['<<=', '>>='];
  const unesc = (c) => ({ n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'", '0': '\0' })[c] ?? c;
  function tokenize(src) {
    const toks = []; let i = 0, line = 1; const n = src.length;
    const idStart = (c) => /[A-Za-z_]/.test(c), idPart = (c) => /[A-Za-z0-9_]/.test(c), digit = (c) => /[0-9]/.test(c);
    while (i < n) {
      const c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (/\s/.test(c)) { i++; continue; }
      if (digit(c) || (c === '.' && digit(src[i + 1]))) {
        let j = i;
        if (src[j] === '0' && (src[j + 1] === 'x' || src[j + 1] === 'X')) { j += 2; while (j < n && /[0-9a-fA-F]/.test(src[j])) j++; }
        else {
          while (j < n && digit(src[j])) j++;
          if (src[j] === '.') { j++; while (j < n && digit(src[j])) j++; }
          if (src[j] === 'e' || src[j] === 'E') { j++; if (src[j] === '+' || src[j] === '-') j++; while (j < n && digit(src[j])) j++; }
        }
        const raw = src.slice(i, j);
        while (j < n && /[uUlLfF]/.test(src[j])) j++;
        toks.push({ t: 'num', v: /^0[xX]/.test(raw) ? parseInt(raw, 16) : parseFloat(raw), line });
        i = j; continue;
      }
      if (c === '"') {
        let j = i + 1, s = '';
        while (j < n && src[j] !== '"') { if (src[j] === '\\') { s += unesc(src[j + 1]); j += 2; } else { s += src[j++]; } }
        toks.push({ t: 'str', v: s, line }); i = j + 1; continue;
      }
      if (c === "'") {
        let j = i + 1, ch;
        if (src[j] === '\\') { ch = unesc(src[j + 1]); j += 2; } else { ch = src[j]; j++; }
        if (src[j] === "'") j++;
        toks.push({ t: 'num', v: ch.charCodeAt(0), line }); i = j; continue;
      }
      if (idStart(c)) { let j = i + 1; while (j < n && idPart(src[j])) j++; toks.push({ t: 'id', v: src.slice(i, j), line }); i = j; continue; }
      const three = src.slice(i, i + 3); if (OPS3.includes(three)) { toks.push({ t: 'op', v: three, line }); i += 3; continue; }
      const two = src.slice(i, i + 2); if (OPS2.includes(two)) { toks.push({ t: 'op', v: two, line }); i += 2; continue; }
      toks.push({ t: 'op', v: c, line }); i++;
    }
    return toks;
  }

  // ---------- Parser (recursivo descendente) ----------
  const TYPE_KEYWORDS = new Set(['void', 'int', 'long', 'short', 'unsigned', 'signed', 'float', 'double', 'char', 'byte', 'bool', 'boolean', 'String', 'size_t', 'uint8_t', 'uint16_t', 'uint32_t', 'int8_t', 'int16_t', 'int32_t']);
  const QUALIFIERS = new Set(['const', 'static', 'volatile']);
  const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
  const LEVELS = [['||'], ['&&'], ['|'], ['^'], ['&'], ['==', '!='], ['<', '>', '<=', '>='], ['<<', '>>'], ['+', '-'], ['*', '/', '%']];

  function parseProgram(src) {
    const toks = tokenize(preprocess(src));
    let pos = 0;
    const peek = (o = 0) => toks[pos + o];
    const at = (v) => peek() && peek().v === v;
    const next = () => toks[pos++];
    const err = (msg) => { const t = peek(); throw new ArduinoSyntaxError(msg + (t ? ` cerca de '${t.v}' (línea ${t.line})` : ' al final del código')); };
    const expect = (v) => { if (!at(v)) err(`se esperaba '${v}'`); return next(); };
    const expectIdent = () => { const t = peek(); if (!t || t.t !== 'id') err('se esperaba un identificador'); return next().v; };
    const isTypeStart = () => { const t = peek(); return !!t && t.t === 'id' && (TYPE_KEYWORDS.has(t.v) || QUALIFIERS.has(t.v)); };
    const parseTypeSeq = () => { while (isTypeStart()) next(); };

    function parseArgs() {
      const args = [];
      if (at(')')) return args;
      args.push(parseAssign());
      while (at(',')) { next(); args.push(parseAssign()); }
      return args;
    }
    function parseArrayLit() {
      expect('{'); const items = [];
      if (!at('}')) { items.push(parseAssign()); while (at(',')) { next(); if (at('}')) break; items.push(parseAssign()); } }
      expect('}'); return { type: 'ArrayLit', items };
    }
    function parsePrimary() {
      const t = peek();
      if (!t) err('expresión inesperada');
      if (t.t === 'num') { next(); return { type: 'Num', value: t.v }; }
      if (t.t === 'str') { next(); return { type: 'Str', value: t.v }; }
      if (at('(')) { next(); const e = parseExpr(); expect(')'); return e; }
      if (at('{')) return parseArrayLit();
      if (t.t === 'id') { next(); return { type: 'Ident', name: t.v }; }
      err('token inesperado');
    }
    function parsePostfix() {
      let e = parsePrimary();
      for (;;) {
        if (at('(')) { next(); const args = parseArgs(); expect(')'); e = { type: 'Call', callee: e, args }; }
        else if (at('[')) { next(); const index = parseExpr(); expect(']'); e = { type: 'Index', obj: e, index }; }
        else if (at('.')) { next(); const name = expectIdent(); e = { type: 'Member', obj: e, name }; }
        else if (at('++') || at('--')) { const op = next().v; e = { type: 'Update', op, prefix: false, arg: e }; }
        else break;
      }
      return e;
    }
    function parseUnary() {
      if (at('!') || at('-') || at('+') || at('~')) { const op = next().v; return { type: 'Unary', op, arg: parseUnary() }; }
      if (at('++') || at('--')) { const op = next().v; return { type: 'Update', op, prefix: true, arg: parseUnary() }; }
      return parsePostfix();
    }
    function parseLevel(i) {
      if (i >= LEVELS.length) return parseUnary();
      let left = parseLevel(i + 1);
      while (peek() && LEVELS[i].includes(peek().v)) {
        const op = next().v, right = parseLevel(i + 1);
        left = (op === '&&' || op === '||') ? { type: 'Logical', op, left, right } : { type: 'Bin', op, left, right };
      }
      return left;
    }
    function parseTernary() {
      const c = parseLevel(0);
      if (at('?')) { next(); const a = parseAssign(); expect(':'); const b = parseAssign(); return { type: 'Cond', test: c, cons: a, alt: b }; }
      return c;
    }
    function parseAssign() {
      const left = parseTernary();
      if (peek() && ASSIGN_OPS.has(peek().v)) { const op = next().v; const value = parseAssign(); return { type: 'Assign', op, target: left, value }; }
      return left;
    }
    function parseExpr() { return parseAssign(); }
    function parseExprSeq() {
      let e = parseAssign();
      while (at(',')) { next(); e = { type: 'Seq', a: e, b: parseAssign() }; }
      return e;
    }
    function parseVarDeclRest(firstName) {
      const decls = []; let name = firstName;
      for (;;) {
        let dim = null;
        if (at('[')) { next(); dim = at(']') ? null : parseExpr(); expect(']'); }
        let init = null;
        if (at('=')) { next(); init = parseAssign(); }
        decls.push({ name, dim, init });
        if (at(',')) { next(); name = expectIdent(); continue; }
        break;
      }
      expect(';');
      return { type: 'VarDecl', decls };
    }
    function parseVarDeclStatement() { parseTypeSeq(); const name = expectIdent(); return parseVarDeclRest(name); }
    function parseBlock() {
      expect('{'); const body = [];
      while (!at('}')) body.push(parseStatement());
      expect('}');
      return { type: 'Block', body };
    }
    function parseIf() {
      next(); expect('('); const test = parseExpr(); expect(')');
      const cons = parseStatement(); let alt = null;
      if (at('else')) { next(); alt = parseStatement(); }
      return { type: 'If', test, cons, alt };
    }
    function parseFor() {
      next(); expect('(');
      let init = null;
      if (isTypeStart()) init = parseVarDeclStatement();
      else if (at(';')) next();
      else { init = { type: 'ExprStmt', expr: parseExprSeq() }; expect(';'); }
      let test = null; if (!at(';')) test = parseExpr(); expect(';');
      let update = null; if (!at(')')) update = parseExprSeq(); expect(')');
      const body = parseStatement();
      return { type: 'For', init, test, update, body };
    }
    function parseWhile() { next(); expect('('); const test = parseExpr(); expect(')'); return { type: 'While', test, body: parseStatement() }; }
    function parseDoWhile() {
      next(); const body = parseStatement();
      expect('while'); expect('('); const test = parseExpr(); expect(')'); expect(';');
      return { type: 'DoWhile', body, test };
    }
    function parseStatement() {
      if (at('{')) return parseBlock();
      if (at('if')) return parseIf();
      if (at('for')) return parseFor();
      if (at('while')) return parseWhile();
      if (at('do')) return parseDoWhile();
      if (at('return')) { next(); let value = null; if (!at(';')) value = parseExpr(); expect(';'); return { type: 'Return', value }; }
      if (at('break')) { next(); expect(';'); return { type: 'Break' }; }
      if (at('continue')) { next(); expect(';'); return { type: 'Continue' }; }
      if (at(';')) { next(); return { type: 'Empty' }; }
      if (isTypeStart()) return parseVarDeclStatement();
      const expr = parseExpr(); expect(';'); return { type: 'ExprStmt', expr };
    }
    function parseParams() {
      const params = [];
      if (at(')')) return params;
      if (at('void') && peek(1) && peek(1).v === ')') { next(); return params; }
      for (;;) {
        parseTypeSeq();
        while (at('&') || at('*')) next();
        const name = expectIdent();
        if (at('[')) { next(); if (!at(']')) parseExpr(); expect(']'); }
        params.push(name);
        if (at(',')) { next(); continue; }
        break;
      }
      return params;
    }
    function parseTopLevel() {
      parseTypeSeq();
      const name = expectIdent();
      if (at('(')) {
        next(); const params = parseParams(); expect(')');
        if (at(';')) { next(); return null; }
        return { type: 'Func', name, params, body: parseBlock() };
      }
      return { type: 'Func', __varDecl: true, decl: { ...parseVarDeclRest(name), __name: name } };
    }

    const funcs = {}, globalDecls = [];
    while (pos < toks.length) {
      if (at(';')) { next(); continue; }
      const it = parseTopLevel();
      if (!it) continue;
      if (it.__varDecl) globalDecls.push(it.decl); else funcs[it.name] = it;
    }
    return { funcs, globalDecls };
  }

  // ---------- Entorno (scopes) ----------
  class Scope {
    constructor(parent) { this.vars = new Map(); this.parent = parent; }
    declare(name, value) { this.vars.set(name, { value }); }
    find(name) { let s = this; while (s) { if (s.vars.has(name)) return s.vars.get(name); s = s.parent; } return null; }
    get(name) { const b = this.find(name); if (!b) throw new ArduinoRuntimeError('variable no declarada: ' + name); return b.value; }
    set(name, value) { const b = this.find(name); if (!b) throw new ArduinoRuntimeError('variable no declarada: ' + name); b.value = value; return value; }
  }
  function installConstants(scope) {
    const C = {
      HIGH: 1, LOW: 0, OUTPUT: 1, INPUT: 0, INPUT_PULLUP: 2, LED_BUILTIN: 13, true: 1, false: 0,
      PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: Math.PI * 2, DEG_TO_RAD: Math.PI / 180, RAD_TO_DEG: 180 / Math.PI,
      A0: 'A0', A1: 'A1', A2: 'A2', A3: 'A3', A4: 'A4', A5: 'A5',
    };
    Object.entries(C).forEach(([k, v]) => scope.declare(k, v));
  }
  const truthy = (v) => !!v;
  function applyBin(op, l, r) {
    switch (op) {
      case '+': return (typeof l === 'string' || typeof r === 'string') ? String(l) + String(r) : l + r;
      case '-': return l - r;
      case '*': return l * r;
      case '/': return (Number.isInteger(l) && Number.isInteger(r)) ? (r === 0 ? 0 : Math.trunc(l / r)) : l / r;
      case '%': return l % r;
      case '==': return l === r ? 1 : 0;
      case '!=': return l !== r ? 1 : 0;
      case '<': return l < r ? 1 : 0;
      case '>': return l > r ? 1 : 0;
      case '<=': return l <= r ? 1 : 0;
      case '>=': return l >= r ? 1 : 0;
      case '&': return l & r;
      case '|': return l | r;
      case '^': return l ^ r;
      case '<<': return l << r;
      case '>>': return l >> r;
      default: throw new ArduinoRuntimeError('operador no soportado: ' + op);
    }
  }

  // ---------- Funciones nativas (Arduino API) ----------
  const pinKey = (p) => String(p);
  function ensurePin(pin) {
    const k = pinKey(pin);
    return Lab.pins[k] || (Lab.pins[k] = { mode: null, digital: 0, pwm: null, sensedVoltage: 0, sensedDigital: 0 });
  }
  const Builtins = {
    * pinMode(interp, [pin, mode]) { ensurePin(pin).mode = mode === 1 ? 'OUTPUT' : mode === 2 ? 'INPUT_PULLUP' : 'INPUT'; },
    * digitalWrite(interp, [pin, val]) { const st = ensurePin(pin); if (!st.mode) st.mode = 'OUTPUT'; st.digital = truthy(val) ? 1 : 0; st.pwm = null; },
    * analogWrite(interp, [pin, val]) { const st = ensurePin(pin); if (!st.mode) st.mode = 'OUTPUT'; st.pwm = Math.max(0, Math.min(255, Math.round(val))); },
    * digitalRead(interp, [pin]) { return ensurePin(pin).sensedDigital; },
    * analogRead(interp, [pin]) { return Math.round((ensurePin(pin).sensedVoltage / 5) * 1023); },
    * delay(interp, [ms]) { yield { cmd: 'delay', ms: Math.max(0, Number(ms) || 0) }; },
    * delayMicroseconds(interp, [us]) { yield { cmd: 'delay', ms: Math.max(0, (Number(us) || 0) / 1000) }; },
    * millis(interp) { return Date.now() - interp.startTime; },
    * micros(interp) { return (Date.now() - interp.startTime) * 1000; },
    * map(_, [x, a, b, c, d]) { return (x - a) * (d - c) / (b - a) + c; },
    * constrain(_, [x, a, b]) { return Math.max(a, Math.min(b, x)); },
    * abs(_, [x]) { return Math.abs(x); },
    * min(_, [a, b]) { return Math.min(a, b); },
    * max(_, [a, b]) { return Math.max(a, b); },
    * pow(_, [a, b]) { return Math.pow(a, b); },
    * sqrt(_, [a]) { return Math.sqrt(a); },
    * sq(_, [a]) { return a * a; },
    * random(_, [a, b]) { return b === undefined ? Math.floor(Math.random() * a) : a + Math.floor(Math.random() * (b - a)); },
    * String(_, [x]) { return String(x); },
    * tone() {}, * noTone() {},
  };
  function* callSerial(method, args) {
    if (method === 'print') console.log(String(args[0]));
    else if (method === 'println') console.log(args.length ? String(args[0]) : '');
    return undefined;
  }

  // ---------- Evaluador ----------
  const STEP_BUDGET = 4000;
  function* evalArrayLit(node, scope, interp) {
    const arr = []; for (const it of node.items) arr.push(yield* evalExpr(it, scope, interp));
    return arr;
  }
  function* assignTo(target, value, scope, interp) {
    if (target.type === 'Ident') { scope.set(target.name, value); return value; }
    if (target.type === 'Index') {
      const arr = yield* evalExpr(target.obj, scope, interp); const idx = yield* evalExpr(target.index, scope, interp);
      arr[idx] = value; return value;
    }
    throw new ArduinoRuntimeError('asignación no soportada');
  }
  function* evalCall(node, scope, interp) {
    const args = [];
    for (const a of node.args) args.push(yield* evalExpr(a, scope, interp));
    if (node.callee.type === 'Member') {
      const objName = node.callee.obj.type === 'Ident' ? node.callee.obj.name : null;
      if (objName === 'Serial') return yield* callSerial(node.callee.name, args);
      throw new ArduinoRuntimeError('llamada no soportada: ' + objName + '.' + node.callee.name + '()');
    }
    if (node.callee.type !== 'Ident') throw new ArduinoRuntimeError('llamada no soportada');
    const name = node.callee.name;
    if (Builtins[name]) return yield* Builtins[name](interp, args);
    if (interp.funcs[name]) return yield* callUserFunc(interp.funcs[name], args, interp);
    throw new ArduinoRuntimeError('función no definida: ' + name + '()');
  }
  function* evalExpr(node, scope, interp) {
    switch (node.type) {
      case 'Num': case 'Str': return node.value;
      case 'Ident': return scope.get(node.name);
      case 'ArrayLit': return yield* evalArrayLit(node, scope, interp);
      case 'Seq': yield* evalExpr(node.a, scope, interp); return yield* evalExpr(node.b, scope, interp);
      case 'Unary': {
        const v = yield* evalExpr(node.arg, scope, interp);
        if (node.op === '!') return truthy(v) ? 0 : 1;
        if (node.op === '-') return -v;
        if (node.op === '+') return +v;
        return ~v;
      }
      case 'Update': {
        const cur = yield* evalExpr(node.arg, scope, interp);
        const nv = node.op === '++' ? cur + 1 : cur - 1;
        yield* assignTo(node.arg, nv, scope, interp);
        return node.prefix ? nv : cur;
      }
      case 'Logical': {
        const l = yield* evalExpr(node.left, scope, interp);
        if (node.op === '&&') return truthy(l) ? (truthy(yield* evalExpr(node.right, scope, interp)) ? 1 : 0) : 0;
        return truthy(l) ? 1 : (truthy(yield* evalExpr(node.right, scope, interp)) ? 1 : 0);
      }
      case 'Bin': return applyBin(node.op, yield* evalExpr(node.left, scope, interp), yield* evalExpr(node.right, scope, interp));
      case 'Cond': {
        const t = yield* evalExpr(node.test, scope, interp);
        return truthy(t) ? yield* evalExpr(node.cons, scope, interp) : yield* evalExpr(node.alt, scope, interp);
      }
      case 'Assign': {
        let v = yield* evalExpr(node.value, scope, interp);
        if (node.op !== '=') v = applyBin(node.op.slice(0, -1), yield* evalExpr(node.target, scope, interp), v);
        return yield* assignTo(node.target, v, scope, interp);
      }
      case 'Index': {
        const arr = yield* evalExpr(node.obj, scope, interp); const idx = yield* evalExpr(node.index, scope, interp);
        return arr[idx];
      }
      case 'Member': {
        const obj = yield* evalExpr(node.obj, scope, interp);
        if (node.name === 'length') return obj.length;
        return undefined;
      }
      case 'Call': return yield* evalCall(node, scope, interp);
      default: throw new ArduinoRuntimeError('expresión no soportada: ' + node.type);
    }
  }
  function* execStmt(node, scope, interp) {
    if (++interp.steps % STEP_BUDGET === 0) yield { cmd: 'tick' };
    switch (node.type) {
      case 'Block': {
        const s = new Scope(scope);
        for (const st of node.body) yield* execStmt(st, s, interp);
        return;
      }
      case 'VarDecl':
        for (const d of node.decls) {
          let val;
          if (d.init) val = d.init.type === 'ArrayLit' ? yield* evalArrayLit(d.init, scope, interp) : yield* evalExpr(d.init, scope, interp);
          else if (d.dim) val = new Array(Number(yield* evalExpr(d.dim, scope, interp)) || 0).fill(0);
          else val = 0;
          scope.declare(d.name, val);
        }
        return;
      case 'ExprStmt': yield* evalExpr(node.expr, scope, interp); return;
      case 'If': {
        const t = yield* evalExpr(node.test, scope, interp);
        if (truthy(t)) yield* execStmt(node.cons, scope, interp);
        else if (node.alt) yield* execStmt(node.alt, scope, interp);
        return;
      }
      case 'While':
        while (truthy(yield* evalExpr(node.test, scope, interp))) {
          try { yield* execStmt(node.body, scope, interp); }
          catch (e) { if (e instanceof BreakSignal) break; if (!(e instanceof ContinueSignal)) throw e; }
        }
        return;
      case 'DoWhile':
        do {
          try { yield* execStmt(node.body, scope, interp); }
          catch (e) { if (e instanceof BreakSignal) break; if (!(e instanceof ContinueSignal)) throw e; }
        } while (truthy(yield* evalExpr(node.test, scope, interp)));
        return;
      case 'For': {
        const s = new Scope(scope);
        if (node.init) yield* execStmt(node.init, s, interp);
        while (node.test ? truthy(yield* evalExpr(node.test, s, interp)) : true) {
          try { yield* execStmt(node.body, s, interp); }
          catch (e) { if (e instanceof BreakSignal) break; if (!(e instanceof ContinueSignal)) throw e; }
          if (node.update) yield* evalExpr(node.update, s, interp);
        }
        return;
      }
      case 'Return': throw new ReturnSignal(node.value ? yield* evalExpr(node.value, scope, interp) : undefined);
      case 'Break': throw new BreakSignal();
      case 'Continue': throw new ContinueSignal();
      case 'Empty': return;
      default: throw new ArduinoRuntimeError('instrucción no soportada: ' + node.type);
    }
  }
  function* callUserFunc(func, args, interp) {
    const scope = new Scope(interp.global);
    func.params.forEach((p, i) => scope.declare(p, args[i]));
    try { yield* execStmt(func.body, scope, interp); }
    catch (e) { if (e instanceof ReturnSignal) return e.value; throw e; }
    return undefined;
  }

  class Interpreter {
    constructor(program) {
      this.funcs = program.funcs;
      this.global = new Scope(null);
      installConstants(this.global);
      this.startTime = Date.now();
      this.steps = 0;
      program.globalDecls.forEach((d) => {
        const gen = execStmt(d, this.global, this);
        let r = gen.next(); while (!r.done) r = gen.next();
      });
    }
    * runSetup() { yield* callUserFunc(this.funcs.setup, [], this); }
    * runLoop() { yield* callUserFunc(this.funcs.loop, [], this); }
  }

  // ---------- Driver: conecta el intérprete con Run/Stop ----------
  let runToken = 0;
  function abort(msg) {
    runToken++;
    Lab.status('❌ ' + msg);
    Lab.running = false; Lab.pins = {}; Lab.refreshSim();
    const run = $('#btnRun'), stop = $('#btnStop');
    if (run) run.disabled = false; if (stop) stop.disabled = true;
  }
  function runGen(token, gen, onDone) {
    function step() {
      if (token !== runToken) return;
      let res;
      try { res = gen.next(); } catch (e) { abort(e.message || String(e)); return; }
      Lab.refreshSim();
      if (res.done) { if (onDone) setTimeout(onDone, 0); return; }
      const cmd = res.value;
      setTimeout(step, cmd && cmd.cmd === 'delay' ? cmd.ms : 0);
    }
    step();
  }
  function startSketch(token) {
    Lab.pins = {};
    let program;
    try { program = parseProgram(Lab.getCode()); }
    catch (e) { abort(e.message); return; }
    if (!program.funcs.setup || !program.funcs.loop) { abort('el código debe tener las funciones setup() y loop()'); return; }
    let interp;
    try { interp = new Interpreter(program); } catch (e) { abort(e.message || String(e)); return; }
    runGen(token, interp.runSetup(), function loopForever() {
      if (token !== runToken) return;
      runGen(token, interp.runLoop(), loopForever);
    });
  }

  const baseSetRunning = Lab.setRunning;
  Lab.setRunning = (r) => {
    runToken++;
    baseSetRunning(r);
    if (r) startSketch(runToken);
    else { Lab.pins = {}; Lab.refreshSim(); }
  };
})();
