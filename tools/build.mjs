#!/usr/bin/env node
/**
 * tools/build.mjs - one-file game builder. Node 18+, no dependencies.
 *
 * USAGE
 *   node tools/build.mjs                     build src/index.html -> dist/game.html
 *   node tools/build.mjs --out game.html     choose the output file (the Lead's release build)
 *   node tools/build.mjs --watch             rebuild whenever a file in src/ changes
 *   node tools/build.mjs --serve [port]      serve src/ unbundled at http://localhost:8080 (development;
 *                                            ES modules do not load from file://, the built file does)
 *   node tools/build.mjs --quiet             print errors only
 *   node tools/build.mjs --src <dir>         use another source folder (tests of the builder)
 *
 * WHAT IT DOES
 *   1. Reads src/index.html. Every <link rel="stylesheet" href="local.css"> becomes an inline <style>.
 *   2. Every <script type="module" src="..."> is an entry. The builder follows all static imports,
 *      `export ... from` and `import('literal')` inside src/ (src/ui/, src/content/, src/rules.js, ...).
 *   3. It writes one self-contained HTML file: no network requests, opens from disk (file://).
 *
 * MODULE SEMANTICS KEPT IN THE BUNDLE
 *   Each module runs in its own scope, in strict mode, in ES-module evaluation order (dependencies
 *   first). Exports are live getters; function declarations are hoisted, so import cycles work as in
 *   native ESM. Supported syntax: named / default / namespace imports, side-effect imports,
 *   `export const|let|var|function|class`, `export default`, `export { a as b }`, `export ... from`,
 *   `export *`, `export * as ns`, `import.meta.url`, and `import('./literal.js')`.
 *   Limitation: if a module reassigns an exported `let` after it has finished evaluating, importers
 *   keep the value from the end of that module's evaluation (the builder warns when this can matter).
 *
 * CHECKS (the build fails with a clear message)
 *   bare specifiers (e.g. 'node:fs'), files outside src/ or missing, named imports the target does not
 *   export, import attributes, and syntax errors in the generated bundle (compiled with node:vm).
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let SRC = path.join(ROOT, 'src');

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const opt = { out: path.join(ROOT, 'dist', 'game.html'), watch: false, serve: false, port: 8080, quiet: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--out') opt.out = path.resolve(process.cwd(), argv[++i]);
  else if (a === '--watch') opt.watch = true;
  else if (a === '--quiet') opt.quiet = true;
  else if (a === '--src') SRC = path.resolve(process.cwd(), argv[++i]);
  else if (a === '--serve') {
    opt.serve = true;
    if (argv[i + 1] && /^\d+$/.test(argv[i + 1])) opt.port = Number(argv[++i]);
  } else if (a === '--help' || a === '-h') {
    const head = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 33).join('\n');
    console.log(head.replace(/^ \* ?/gm, '').replace(/^\/\*\*|\*\/$/gm, ''));
    process.exit(0);
  } else {
    console.error(`Unknown argument: ${a} (try --help)`);
    process.exit(2);
  }
}

class BuildError extends Error {}
const fail = (msg) => { throw new BuildError(msg); };
const rel = (abs) => path.relative(ROOT, abs).split(path.sep).join('/');

// ---------------------------------------------------------------------------------------------
// Lexical masking: blank out comments, strings, template text and regex bodies (same length,
// newlines kept) so that statement scanning cannot be fooled by their contents.
// ---------------------------------------------------------------------------------------------
const KEYWORDS_BEFORE_EXPR = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await', 'extends']);

function mask(src) {
  const out = src.split('');
  const n = src.length;
  const braceStack = []; // 'b' = normal brace, 't' = template expression
  let i = 0;
  let prev = ''; // previous significant token: word, number, or punctuator
  const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' '; };
  const isIdStart = (c) => /[A-Za-z_$\u0080-￿]/.test(c);
  const isId = (c) => /[A-Za-z0-9_$\u0080-￿]/.test(c);

  function scanTemplate() { // i points just after the opening backtick
    const start = i;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { blank(start, i); i++; prev = 'tpl'; return; }
      if (c === '$' && src[i + 1] === '{') { blank(start, i); braceStack.push('t'); i += 2; prev = '{'; return; }
      i++;
    }
    blank(start, n);
  }

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { const e = src.indexOf('\n', i); const end = e < 0 ? n : e; blank(i, end); i = end; continue; }
    if (c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? n : e + 2; blank(i, end); i = end; continue; }
    if (c === '\'' || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
      blank(i + 1, j); i = j + 1; prev = 'str'; continue;
    }
    if (c === '`') { i++; scanTemplate(); continue; }
    if (c === '/') {
      const regexAllowed = prev === '' || (prev.length === 1 && '(,=:[!&|?{};+-*%<>~^'.includes(prev)) ||
        prev === '=>' || KEYWORDS_BEFORE_EXPR.has(prev);
      if (regexAllowed) {
        let j = i + 1; let inClass = false;
        while (j < n && src[j] !== '\n') {
          const ch = src[j];
          if (ch === '\\') { j += 2; continue; }
          if (ch === '[') inClass = true; else if (ch === ']') inClass = false;
          else if (ch === '/' && !inClass) break;
          j++;
        }
        blank(i + 1, j); j++;
        while (j < n && isId(src[j])) j++;
        i = j; prev = 'regex'; continue;
      }
      prev = '/'; i++; continue;
    }
    if (c === '{') { braceStack.push('b'); prev = '{'; i++; continue; }
    if (c === '}') {
      const top = braceStack.pop();
      if (top === 't') { i++; scanTemplate(); continue; }
      prev = '}'; i++; continue;
    }
    if (isIdStart(c)) { let j = i + 1; while (j < n && isId(src[j])) j++; prev = src.slice(i, j); i = j; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(d || ''))) { let j = i + 1; while (j < n && /[0-9A-Za-z_.]/.test(src[j])) j++; prev = '0'; i = j; continue; }
    if (c === '=' && d === '>') { prev = '=>'; i += 2; continue; }
    if (/\s/.test(c)) { i++; continue; }
    prev = c; i++;
  }
  return out.join('');
}

// ---------------------------------------------------------------------------------------------
// Module analysis
// ---------------------------------------------------------------------------------------------
const ID = '[A-Za-z_$\\u0080-\\uffff][A-Za-z0-9_$\\u0080-\\uffff]*';

/** Positions of `import` / `export` at statement start and depth 0. */
function topLevelKeywords(m) {
  const found = [];
  let depth = 0;
  const re = /[{}()[\]]|\b(import|export)\b/g;
  let x;
  while ((x = re.exec(m))) {
    const t = x[0];
    if (t === '{' || t === '(' || t === '[') { depth++; continue; }
    if (t === '}' || t === ')' || t === ']') { depth--; continue; }
    if (depth !== 0) continue;
    // must start a statement: previous significant char is start, ; } or a newline-only gap
    let k = x.index - 1;
    while (k >= 0 && (m[k] === ' ' || m[k] === '\t')) k--;
    const before = k < 0 ? '' : m[k];
    if (!(before === '' || before === '\n' || before === '\r' || before === ';' || before === '}')) continue;
    if (m[x.index - 1] === '.') continue;
    const after = m.slice(x.index + t.length, x.index + t.length + 20);
    if (t === 'import' && /^\s*[(.]/.test(after)) continue; // dynamic import / import.meta
    found.push({ kw: t, pos: x.index });
  }
  return found;
}

function readString(src, m, at) { // at = index of the opening quote in src
  const q = src[at];
  if (q !== '\'' && q !== '"') return null;
  let j = at + 1; let s = '';
  while (j < src.length && src[j] !== q) { if (src[j] === '\\') { s += src[j + 1]; j += 2; continue; } s += src[j]; j++; }
  return { value: s, end: j + 1 };
}

function skipWs(m, i) { while (i < m.length && /\s/.test(m[i])) i++; return i; }

function endOfStatement(src, m, i) { // after a from-clause or similar: optional ; on the same line
  let j = i;
  while (j < m.length && (m[j] === ' ' || m[j] === '\t')) j++;
  if (m[j] === ';') return j + 1;
  return i;
}

function parseSpecList(text) { // "a, b as c, default as d" -> [{imported, local}]
  return text.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const mm = s.match(new RegExp(`^(${ID}|'[^']*'|"[^"]*")(?:\\s+as\\s+(${ID}|'[^']*'|"[^"]*"))?$`));
    if (!mm) fail(`cannot read import/export list entry "${s}"`);
    const unq = (v) => v.replace(/^['"]|['"]$/g, '');
    return { imported: unq(mm[1]), local: unq(mm[2] || mm[1]) };
  });
}

/** Names bound by a destructuring pattern in masked text starting at i ({ or [). Returns {names, end}. */
function patternNames(m, i) {
  const names = [];
  const open = m[i]; const close = open === '{' ? '}' : ']';
  let j = i + 1;
  while (j < m.length) {
    j = skipWs(m, j);
    if (m[j] === close) return { names, end: j + 1 };
    if (m[j] === ',') { j++; continue; }
    if (m.startsWith('...', j)) j += 3;
    j = skipWs(m, j);
    if (m[j] === '{' || m[j] === '[') { const r = patternNames(m, j); names.push(...r.names); j = r.end; }
    else {
      const idm = new RegExp(`^(${ID})`).exec(m.slice(j));
      if (!idm) { j++; continue; }
      j += idm[1].length;
      j = skipWs(m, j);
      if (open === '{' && m[j] === ':') { // key: target
        j = skipWs(m, j + 1);
        if (m[j] === '{' || m[j] === '[') { const r = patternNames(m, j); names.push(...r.names); j = r.end; }
        else { const t = new RegExp(`^(${ID})`).exec(m.slice(j)); if (t) { names.push(t[1]); j += t[1].length; } }
      } else names.push(idm[1]);
    }
    j = skipWs(m, j);
    if (m[j] === '=') { // default value: skip to , or close at depth 0
      let depth = 0; j++;
      while (j < m.length) {
        const ch = m[j];
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) { if (depth === 0) break; depth--; }
        else if (ch === ',' && depth === 0) break;
        j++;
      }
    }
  }
  fail('unterminated destructuring pattern in export');
}

/** Declared names of `const|let|var` declarators starting at i (after the keyword). */
function declaratorNames(m, i) {
  const names = [];
  let j = i;
  for (;;) {
    j = skipWs(m, j);
    if (m[j] === '{' || m[j] === '[') { const r = patternNames(m, j); names.push(...r.names); j = r.end; }
    else {
      const idm = new RegExp(`^(${ID})`).exec(m.slice(j));
      if (!idm) fail('cannot read exported declaration name');
      names.push(idm[1]); j += idm[1].length;
    }
    // skip initializer to next top-level comma or end of statement
    let depth = 0; let sawEq = false;
    while (j < m.length) {
      const ch = m[j];
      if (ch === '=' && depth === 0 && m[j + 1] !== '=' && m[j + 1] !== '>') sawEq = true;
      if ('([{'.includes(ch)) depth++;
      else if (')]}'.includes(ch)) { if (depth === 0) return names; depth--; }
      else if (depth === 0 && ch === ';') return names;
      else if (depth === 0 && ch === ',') { j++; break; }
      else if (depth === 0 && ch === '\n' && sawEq) {
        // ASI: statement ends if the next line starts a new statement
        const rest = m.slice(j + 1).replace(/^\s+/, '');
        if (/^(export|import|const|let|var|function|class|async\s+function|if|for|while|return|\}|$)/.test(rest)) return names;
      }
      j++;
    }
    if (j >= m.length) return names;
  }
}

function analyze(file, src) {
  const m = mask(src);
  const imports = []; // {spec, names:[{imported, local}], ns, def, start, end}
  const exportsLocal = []; // {exported, local}
  const reexports = []; // {spec, names:[{imported, exported}]}
  const stars = []; // {spec, as?}
  const edits = []; // {start, end, text}
  const warnLets = [];

  for (const { kw, pos } of topLevelKeywords(m)) {
    if (kw === 'import') {
      let i = pos + 6;
      i = skipWs(m, i);
      const rec = { spec: null, names: [], ns: null, start: pos, end: 0 };
      if (src[i] === '\'' || src[i] === '"') { // side-effect import
        const s = readString(src, m, i); rec.spec = s.value; rec.end = endOfStatement(src, m, s.end);
      } else {
        const head = /^(?:(ID)\s*(?:,\s*)?)?(?:\*\s*as\s+(ID)|\{([^}]*)\})?\s*from\s*/.source.replace(/ID/g, ID);
        const hm = new RegExp(head).exec(m.slice(i));
        if (!hm) fail(`${rel(file)}: cannot read import statement near "${src.slice(pos, pos + 60).split('\n')[0]}"`);
        if (hm[1]) rec.names.push({ imported: 'default', local: hm[1] });
        if (hm[2]) rec.ns = hm[2];
        if (hm[3] !== undefined) {
          // names may contain quoted strings that were masked: re-read from the source slice
          const listStart = i + hm[0].indexOf('{');
          const listEnd = src.indexOf('}', listStart);
          rec.names.push(...parseSpecList(src.slice(listStart + 1, listEnd).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));
        }
        const q = i + hm[0].length;
        const s = readString(src, m, q);
        if (!s) fail(`${rel(file)}: import without a string specifier`);
        rec.spec = s.value; rec.end = endOfStatement(src, m, s.end);
        if (/^\s*(with|assert)\s*\{/.test(m.slice(s.end, s.end + 20))) fail(`${rel(file)}: import attributes are not supported`);
      }
      imports.push(rec);
      edits.push({ start: rec.start, end: rec.end, text: '' });
      continue;
    }
    // export
    let i = skipWs(m, pos + 6);
    const rest = m.slice(i, i + 200);
    let mm;
    if ((mm = /^default\b\s*/.exec(rest))) {
      const after = i + mm[0].length;
      const r2 = m.slice(after, after + 120);
      let dm;
      if ((dm = new RegExp(`^(async\\s+)?function\\s*\\*?\\s*(${ID})\\s*\\(`).exec(r2)) || (dm = new RegExp(`^()class\\s+(${ID})\\b`).exec(r2))) {
        exportsLocal.push({ exported: 'default', local: dm[2] });
        edits.push({ start: pos, end: after, text: '' });
      } else {
        exportsLocal.push({ exported: 'default', local: '__default__' });
        edits.push({ start: pos, end: after, text: 'const __default__ = ' });
      }
    } else if ((mm = /^(const|let|var)\b/.exec(rest))) {
      const names = declaratorNames(m, i + mm[0].length);
      for (const nm of names) exportsLocal.push({ exported: nm, local: nm });
      if (mm[1] !== 'const') warnLets.push(...names);
      edits.push({ start: pos, end: i, text: '' });
    } else if ((mm = new RegExp(`^(async\\s+)?function\\s*\\*?\\s*(${ID})`).exec(rest)) || (mm = new RegExp(`^()class\\s+(${ID})`).exec(rest))) {
      exportsLocal.push({ exported: mm[2], local: mm[2] });
      edits.push({ start: pos, end: i, text: '' });
    } else if ((mm = new RegExp(`^\\*\\s*(?:as\\s+(${ID})\\s*)?from\\s*`).exec(rest))) {
      const s = readString(src, m, i + mm[0].length);
      if (!s) fail(`${rel(file)}: export * without a specifier`);
      stars.push({ spec: s.value, as: mm[1] || null });
      edits.push({ start: pos, end: endOfStatement(src, m, s.end), text: '' });
    } else if (rest[0] === '{') {
      const close = m.indexOf('}', i);
      const list = parseSpecList(src.slice(i + 1, close).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));
      let j = skipWs(m, close + 1);
      if (m.startsWith('from', j)) {
        j = skipWs(m, j + 4);
        const s = readString(src, m, j);
        if (!s) fail(`${rel(file)}: export ... from without a specifier`);
        reexports.push({ spec: s.value, names: list.map((e) => ({ imported: e.imported, exported: e.local })) });
        edits.push({ start: pos, end: endOfStatement(src, m, s.end), text: '' });
      } else {
        for (const e of list) exportsLocal.push({ exported: e.local, local: e.imported });
        edits.push({ start: pos, end: endOfStatement(src, m, close + 1), text: '' });
      }
    } else {
      fail(`${rel(file)}: unsupported export statement near "${src.slice(pos, pos + 60).split('\n')[0]}"`);
    }
  }

  // dynamic import('literal') and import.meta
  const dyn = [];
  const reDyn = /\bimport\s*\(\s*(['"])/g; let x;
  while ((x = reDyn.exec(m))) {
    if (m[x.index - 1] === '.') continue;
    const q = x.index + x[0].length - 1;
    const s = readString(src, m, q);
    const close = skipWs(m, s.end);
    if (m[close] !== ')') { console.warn(`warning: ${rel(file)}: dynamic import with a non-literal argument is left as is`); continue; }
    dyn.push({ spec: s.value, start: x.index, end: close + 1 });
  }
  const metas = [];
  const reMeta = /\bimport\s*\.\s*meta\b/g;
  while ((x = reMeta.exec(m))) metas.push({ start: x.index, end: x.index + x[0].length });

  return { m, imports, exportsLocal, reexports, stars, edits, dyn, metas, warnLets };
}

// ---------------------------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------------------------
function resolveSpec(fromFile, spec) {
  if (!spec.startsWith('./') && !spec.startsWith('../') && !spec.startsWith('/')) {
    fail(`${rel(fromFile)}: bare import "${spec}" cannot be bundled (only relative paths inside src/)`);
  }
  const abs = spec.startsWith('/') ? path.join(SRC, spec) : path.resolve(path.dirname(fromFile), spec);
  if (!abs.startsWith(SRC + path.sep)) fail(`${rel(fromFile)}: import "${spec}" points outside src/`);
  if (!fs.existsSync(abs)) fail(`${rel(fromFile)}: import "${spec}" not found (${rel(abs)})`);
  return abs;
}

function loadGraph(entries) {
  const mods = new Map(); // abs -> {id, src, info, deps:Map(spec->abs)}
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    if (mods.has(file)) continue;
    const src = fs.readFileSync(file, 'utf8').replace(/^#!.*\n/, '\n');
    let info;
    try { info = analyze(file, src); } catch (e) { if (e instanceof BuildError && !e.message.includes(rel(file))) e.message = `${rel(file)}: ${e.message}`; throw e; }
    const deps = new Map();
    for (const s of [...info.imports.map((r) => r.spec), ...info.reexports.map((r) => r.spec), ...info.stars.map((r) => r.spec), ...info.dyn.map((r) => r.spec)]) {
      if (!deps.has(s)) deps.set(s, resolveSpec(file, s));
    }
    mods.set(file, { id: rel(file), src, info, deps });
    for (const d of deps.values()) if (!mods.has(d)) stack.push(d);
  }
  return mods;
}

/** All export names of a module, following export * (default excluded from star). */
function exportNames(mods, file, seen = new Set()) {
  const mod = mods.get(file);
  if (mod.names) return mod.names;
  if (seen.has(file)) return new Set();
  seen.add(file);
  const names = new Set(mod.info.exportsLocal.map((e) => e.exported));
  for (const r of mod.info.reexports) for (const e of r.names) names.add(e.exported);
  for (const s of mod.info.stars) {
    if (s.as) { names.add(s.as); continue; }
    for (const nm of exportNames(mods, mod.deps.get(s.spec), seen)) if (nm !== 'default') names.add(nm);
  }
  mod.names = names;
  return names;
}

// ---------------------------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------------------------
const RUNTIME = String.raw`const __bundle = (() => {
  const defs = new Map(), recs = new Map(), setters = [];
  const rec = (id) => {
    let r = recs.get(id);
    if (!r) {
      const ns = Object.create(null);
      Object.defineProperty(ns, Symbol.toStringTag, { value: 'Module' });
      r = { id, ns, gen: null, state: 0, deps: [] };
      recs.set(id, r);
    }
    return r;
  };
  const safeSet = (s) => { try { s.set(s.ns[s.name]); } catch (e) { /* binding not initialised yet (TDZ) */ } };
  const refresh = () => { for (const s of setters) safeSet(s); };
  function instantiate(id) {
    const r = rec(id);
    if (r.state) return r;
    const fn = defs.get(id);
    if (!fn) throw new Error('bundle: module not found: ' + id);
    r.state = 1;
    const link = {
      imp(dep, pairs) {
        const d = instantiate(dep); r.deps.push(dep);
        for (const [name, set] of pairs) setters.push({ ns: d.ns, name, set });
      },
      ns(dep) { r.deps.push(dep); return instantiate(dep).ns; },
      exp(getters) { for (const k in getters) Object.defineProperty(r.ns, k, { get: getters[k], enumerable: true, configurable: true }); },
      reexp(dep, map) {
        const d = instantiate(dep); r.deps.push(dep);
        for (const k in map) Object.defineProperty(r.ns, k, { get: () => d.ns[map[k]], enumerable: true, configurable: true });
      },
      star(dep, names) {
        const d = instantiate(dep); r.deps.push(dep);
        for (const k of names) if (!(k in r.ns)) Object.defineProperty(r.ns, k, { get: () => d.ns[k], enumerable: true, configurable: true });
      },
      dyn(dep) { return Promise.resolve().then(() => { evaluate(dep); return rec(dep).ns; }); },
    };
    r.gen = fn(r.ns, link);
    r.gen.next();
    r.state = 2;
    return r;
  }
  function evaluate(id) {
    const r = instantiate(id);
    if (r.state >= 3) return r.ns;
    r.state = 3;
    for (const d of r.deps) evaluate(d);
    r.gen.next();
    r.state = 4;
    refresh();
    return r.ns;
  }
  return {
    def(id, fn) { defs.set(id, fn); },
    run(id) { instantiate(id); refresh(); return evaluate(id); },
  };
})();
`;

function generateModule(mods, file) {
  const mod = mods.get(file);
  const { info, src } = mod;
  const pro = [];
  const depId = (spec) => JSON.stringify(mods.get(mod.deps.get(spec)).id);

  for (const imp of info.imports) {
    const target = mod.deps.get(imp.spec);
    const tnames = exportNames(mods, target);
    if (imp.ns) pro.push(`const ${imp.ns} = __link.ns(${depId(imp.spec)});`);
    if (imp.names.length) {
      for (const n of imp.names) {
        if (!tnames.has(n.imported)) fail(`${mod.id}: "${n.imported}" is not exported by ${mods.get(target).id}`);
      }
      pro.push(`let ${imp.names.map((n) => n.local).join(', ')};`);
      const pairs = imp.names.map((n) => `[${JSON.stringify(n.imported)}, (v) => { ${n.local} = v; }]`);
      pro.push(`__link.imp(${depId(imp.spec)}, [${pairs.join(', ')}]);`);
    } else if (!imp.ns) {
      pro.push(`__link.ns(${depId(imp.spec)});`);
    }
  }
  if (info.exportsLocal.length) {
    pro.push(`__link.exp({ ${info.exportsLocal.map((e) => `${JSON.stringify(e.exported)}: () => ${e.local}`).join(', ')} });`);
  }
  for (const r of info.reexports) {
    const tnames = exportNames(mods, mod.deps.get(r.spec));
    for (const e of r.names) if (!tnames.has(e.imported)) fail(`${mod.id}: re-exported "${e.imported}" is not exported by ${mods.get(mod.deps.get(r.spec)).id}`);
    pro.push(`__link.reexp(${depId(r.spec)}, { ${r.names.map((e) => `${JSON.stringify(e.exported)}: ${JSON.stringify(e.imported)}`).join(', ')} });`);
  }
  for (const s of info.stars) {
    if (s.as) pro.push(`__link.exp({ ${JSON.stringify(s.as)}: ((ns) => () => ns)(__link.ns(${depId(s.spec)})) });`);
    else {
      const names = [...exportNames(mods, mod.deps.get(s.spec))].filter((n) => n !== 'default');
      pro.push(`__link.star(${depId(s.spec)}, ${JSON.stringify(names)});`);
    }
  }
  if (info.metas.length) pro.push(`const __import_meta__ = { url: ${JSON.stringify('bundle:/' + mod.id)} };`);

  // apply edits (keep line count: replaced text keeps its newlines)
  const edits = [...info.edits,
    ...info.dyn.map((d) => ({ start: d.start, end: d.end, text: `__link.dyn(${depId(d.spec)})` })),
    ...info.metas.map((x) => ({ start: x.start, end: x.end, text: '__import_meta__' })),
  ].sort((a, b) => a.start - b.start);
  let body = ''; let at = 0;
  for (const e of edits) {
    if (e.start < at) continue;
    body += src.slice(at, e.start) + e.text + src.slice(e.start, e.end).replace(/[^\n]/g, '');
    at = e.end;
  }
  body += src.slice(at);

  for (const nm of info.warnLets) {
    if (!opt.quiet) console.warn(`note: ${mod.id} exports mutable binding "${nm}"; importers see its value as of the end of module evaluation`);
  }
  return `__bundle.def(${JSON.stringify(mod.id)}, function* (__ns, __link) {\n${pro.join(' ')}\nyield;\n${body}\n});\n`;
}

/** Topological order (dependencies first) for readability of the output. */
function order(mods, entries) {
  const seen = new Set(); const out = [];
  const visit = (f) => { if (seen.has(f)) return; seen.add(f); for (const d of mods.get(f).deps.values()) visit(d); out.push(f); };
  entries.forEach(visit);
  return out;
}

function gitStamp() {
  try { return execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return 'nogit'; }
}

function build() {
  const t0 = Date.now();
  const htmlPath = path.join(SRC, 'index.html');
  if (!fs.existsSync(htmlPath)) fail('src/index.html not found');
  let html = fs.readFileSync(htmlPath, 'utf8');

  // inline local stylesheets
  html = html.replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const href = (tag.match(/href=["']([^"']+)["']/) || [])[1];
    if (!href || /^[a-z]+:|^\/\//i.test(href)) fail(`index.html: stylesheet "${href}" is not a local file`);
    const css = fs.readFileSync(path.resolve(SRC, href), 'utf8');
    if (/@import|url\(\s*['"]?(?!data:)[^)'"]+/i.test(css.replace(/\/\*[\s\S]*?\*\//g, ''))) fail(`${href}: external url() or @import found; the build must not make requests`);
    return `<style>\n${css}\n</style>`;
  });

  // collect module entries
  const entryTags = [];
  html.replace(/<script\b[^>]*type=["']module["'][^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (tag, src) => { entryTags.push({ tag, src }); return tag; });
  if (!entryTags.length) fail('index.html has no <script type="module" src="..."> entry');
  const entries = entryTags.map((e) => resolveSpec(htmlPath, e.src.startsWith('.') ? e.src : './' + e.src));
  const mods = loadGraph(entries);
  const ordered = order(mods, entries);

  const stamp = `${gitStamp()} ${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}`;
  let js = `"use strict";\n// Built by tools/build.mjs (${stamp}) from ${ordered.length} modules.\n`;
  js += `const __BUILD__ = ${JSON.stringify(stamp)}; globalThis.__BUILD__ = __BUILD__;\n`;
  js += RUNTIME;
  for (const f of ordered) js += generateModule(mods, f);
  js += entries.map((e) => `__bundle.run(${JSON.stringify(mods.get(e).id)});\n`).join('');

  try { new vm.Script(js, { filename: 'bundle.js' }); } catch (e) {
    const where = (e.stack || '').split('\n').slice(0, 4).join('\n');
    fail(`generated bundle has a syntax error:\n${where}`);
  }
  const safeJs = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

  let first = true;
  for (const e of entryTags) {
    html = html.replace(e.tag, () => {
      if (!first) return '';
      first = false;
      return `<script type="module">\n${safeJs}</script>`;
    });
  }
  html = html.replace(/<head>/i, `<head>\n<meta name="build" content="${stamp}">`);
  if (/\b(src|href)=["'](https?:)?\/\//i.test(html)) fail('output references an external URL');

  fs.mkdirSync(path.dirname(opt.out), { recursive: true });
  fs.writeFileSync(opt.out, html);
  if (!opt.quiet) {
    const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
    console.log(`built ${rel(opt.out) || opt.out}: ${ordered.length} modules, ${kb} KB, ${Date.now() - t0} ms`);
  }
}

function runBuild() {
  try { build(); return true; } catch (e) {
    if (e instanceof BuildError) { console.error(`build failed: ${e.message}`); return false; }
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------
// Dev server and watch
// ---------------------------------------------------------------------------------------------
function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
  http.createServer((req, res) => {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(SRC, url === '/' ? 'index.html' : url);
    if (!file.startsWith(SRC)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(data);
    });
  }).listen(opt.port, () => console.log(`serving src/ at http://localhost:${opt.port}/ (Ctrl+C to stop)`));
}

if (opt.serve) serve();
const ok = runBuild();
if (opt.watch) {
  let timer = null;
  console.log('watching src/ ...');
  fs.watch(SRC, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(runBuild, 120); });
} else if (!opt.serve) {
  process.exit(ok ? 0 : 1);
}
