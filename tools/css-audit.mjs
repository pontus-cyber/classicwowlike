#!/usr/bin/env node
/**
 * tools/css-audit.mjs - colour literals in the UI: counts per file, the distinct palette, and a token expansion that
 * proves a token refactor changed no value. Track R step R1 (docs/reviews/ui-architecture-2026-11-12.md, section 3;
 * D119). Node 18+, no dependencies; reads files only.
 *
 * USAGE
 *   node tools/css-audit.mjs                       counts per file: src/ui/*.css and src/ui/*.js
 *   node tools/css-audit.mjs --palette [--top N]   the distinct colours of the CSS files with use counts, the forms
 *                                                  written and the properties that use them (all, or the top N)
 *   node tools/css-audit.mjs --near D              groups of near-duplicate colours in the CSS (every channel within D
 *                                                  of a neighbour, same alpha within .05), largest first
 *   node tools/css-audit.mjs --json                counts, palette and token uses as JSON
 *   node tools/css-audit.mjs --expand f.css [...]  the files as one canonical list of declarations (one per line, with
 *                                                  its selector and at-rule context), every var(--token) defined in a
 *                                                  root block of the current theme replaced by its value, and those
 *                                                  root definitions left out. Two versions whose expansions are equal
 *                                                  set the same values everywhere, including hover states, scrollbars
 *                                                  and keyframes no screenshot reaches:
 *     diff <(node tools/css-audit.mjs --expand old/style.css) <(node tools/css-audit.mjs --expand src/ui/tokens.css src/ui/style.css)
 *   --files a,b,...                                audit these files instead of src/ui/*.css and src/ui/*.js
 *
 * WHAT COUNTS AS A LITERAL
 *   CSS: hex colours (#rgb, #rgba, #rrggbb, #rrggbbaa), rgb()/rgba() and hsl()/hsla() inside declaration values
 *   (comments and selectors are skipped). JavaScript: the same patterns anywhere outside comments (string contents
 *   included, which is where colours live in the art and view modules).
 *   Root blocks: ":root", "html" and ":root[data-theme="current"]" (alone or in one selector list). Blocks of another
 *   theme (":root[data-theme="lantern"]") are not used for the expansion and are left out of it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UI = path.join(ROOT, 'src', 'ui');
const argv = process.argv.slice(2);
const has = (k) => argv.includes(k);
const val = (k, d) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const rel = (f) => path.relative(process.cwd(), f) || f;

// ------------------------------------------------------------------ CSS scanning
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])/g;
const FUNC = /\b(?:rgba?|hsla?)\(\s*[^()]*\)/g;
const LITERAL = new RegExp(`${HEX.source}|${FUNC.source}`, 'g');
const ROOT_SEL = /^(?::root|html|:root\[data-theme=["']?current["']?\])$/;
const THEME_SEL = /^:root\[data-theme=["']?[\w-]+["']?\]$/;

/** Comments blanked to spaces (same length, newlines kept), so offsets stay those of the file. */
function blankComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/**
 * Declarations of a stylesheet in order: { ctx: [at-rule and selector preludes], prop, value, vStart } (vStart is the
 * offset of the value in the file). Strings and parentheses are respected, so ";" in a data URL does not split.
 */
function declarations(cssRaw) {
  const css = blankComments(cssRaw);
  const out = []; const stack = [];
  let buf = ''; let bufStart = 0; let paren = 0; let q = null;
  const flush = () => {
    const i = buf.indexOf(':');
    if (buf.trim() && i > 0) {
      const lead = buf.length - buf.trimStart().length;
      const prop = buf.slice(0, i).trim();
      const rawVal = buf.slice(i + 1);
      const vLead = rawVal.length - rawVal.trimStart().length;
      out.push({ ctx: [...stack], prop, value: rawVal.trim(), vStart: bufStart + i + 1 + vLead, start: bufStart + lead });
    }
    buf = '';
  };
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (!buf) bufStart = i;
    if (q) { buf += c; if (c === '\\') buf += css[++i] || ''; else if (c === q) q = null; continue; }
    if (c === '"' || c === '\'') { q = c; buf += c; continue; }
    if (c === '(') paren++;
    else if (c === ')') paren--;
    if (paren > 0) { buf += c; continue; }
    if (c === '{') { stack.push(buf.replace(/\s+/g, ' ').trim()); buf = ''; continue; }
    if (c === ';') { flush(); continue; }
    if (c === '}') { flush(); stack.pop(); continue; }
    buf += c;
  }
  return out;
}

const isRootCtx = (ctx) => ctx.length === 1 && ctx[0].split(',').map((s) => s.trim()).every((s) => ROOT_SEL.test(s));
const isOtherThemeCtx = (ctx) => ctx.length === 1 && ctx[0].split(',').map((s) => s.trim()).every((s) => THEME_SEL.test(s) && !ROOT_SEL.test(s));

/** Literal colours in a CSS file's declaration values: [{ text, prop, offset }]. */
function cssLiterals(css) {
  const out = [];
  for (const d of declarations(css)) {
    for (const m of d.value.matchAll(LITERAL)) out.push({ text: m[0], prop: d.prop, offset: d.vStart + m.index, ctx: d.ctx });
  }
  return out;
}

/** Literal colours in a JavaScript file outside comments. */
function jsLiterals(js) {
  const code = js.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
  return [...code.matchAll(LITERAL)].map((m) => ({ text: m[0], prop: null, offset: m.index }));
}

// ------------------------------------------------------------------ colour values
/** [r, g, b, a] of a literal, or null. */
function rgba(text) {
  const t = text.toLowerCase();
  if (t[0] === '#') {
    let h = t.slice(1);
    if (h.length <= 4) h = [...h].map((c) => c + c).join('');
    const n = (k) => parseInt(h.slice(k, k + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1];
  }
  const m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(t);
  if (!m) return null;
  const p = m[2].split(/[\s,/]+/).filter(Boolean).map((x) => (x.endsWith('%') ? parseFloat(x) / 100 : parseFloat(x)));
  if (p.length < 3 || p.some((x) => !Number.isFinite(x))) return null; // e.g. a template literal in JavaScript
  if (m[1].startsWith('rgb')) return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  const [hh, s, l] = [p[0], p[1], p[2]]; const a = p.length > 3 ? p[3] : 1;
  const k = (n) => (n + hh / 30) % 12; const f = (n) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255), a];
}
const hex2 = (n) => n.toString(16).padStart(2, '0');
const canon = (c) => (c[3] === 1 ? `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}` : `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${c[3]})`);
/** The text a literal is compared by: hex in lower case, functions with single spaces after commas. */
const normText = (t) => (t[0] === '#' ? t.toLowerCase() : t.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\(\s+/, '(').replace(/\s+\)/, ')'));

// ------------------------------------------------------------------ files
function defaultFiles() {
  const css = fs.readdirSync(UI).filter((f) => f.endsWith('.css')).sort().map((f) => path.join(UI, f));
  const js = fs.readdirSync(UI).filter((f) => f.endsWith('.js')).sort().map((f) => path.join(UI, f));
  return [...css, ...js];
}
const files = val('--files', null) ? val('--files').split(',').map((f) => path.resolve(f)) : defaultFiles();

function audit(file) {
  const text = fs.readFileSync(file, 'utf8');
  const isCss = file.endsWith('.css');
  const lits = isCss ? cssLiterals(text) : jsLiterals(text);
  const hex = lits.filter((l) => l.text[0] === '#'); const fn = lits.filter((l) => l.text[0] !== '#');
  const out = {
    file: rel(file), lines: text.split('\n').length, literals: lits.length,
    hex: hex.length, hexDistinct: new Set(hex.map((l) => normText(l.text))).size,
    rgb: fn.length, rgbDistinct: new Set(fn.map((l) => normText(l.text))).size,
    colours: new Set(lits.map((l) => { const c = rgba(l.text); return c ? canon(c) : l.text; })).size,
  };
  if (isCss) {
    const decls = declarations(text);
    const inRoot = (d) => isRootCtx(d.ctx) || isOtherThemeCtx(d.ctx);
    out.tokenDefs = decls.filter((d) => d.prop.startsWith('--') && inRoot(d)).length;
    out.literalsInTokenDefs = decls.filter((d) => d.prop.startsWith('--') && inRoot(d)).reduce((n, d) => n + [...d.value.matchAll(LITERAL)].length, 0);
    out.varUses = [...blankComments(text).matchAll(/var\(\s*--/g)].length;
  }
  out._lits = lits;
  return out;
}

// ------------------------------------------------------------------ --expand
function expand(fileList) {
  const decls = fileList.flatMap((f) => declarations(fs.readFileSync(f, 'utf8')));
  const tokens = new Map();
  for (const d of decls) if (d.prop.startsWith('--') && isRootCtx(d.ctx)) tokens.set(d.prop, d.value);
  // a root token redefined in another block cannot be expanded to one value: refuse it
  const local = new Set(decls.filter((d) => d.prop.startsWith('--') && !isRootCtx(d.ctx) && !isOtherThemeCtx(d.ctx)).map((d) => d.prop));
  const clash = [...tokens.keys()].filter((k) => local.has(k));
  if (clash.length) { console.error(`css-audit: root tokens also set in other blocks, not expanded: ${clash.join(', ')}`); for (const k of clash) tokens.delete(k); }
  const sub = (v, depth = 0) => {
    if (depth > 20) throw new Error(`css-audit: token cycle near ${v}`);
    const r = v.replace(/var\(\s*(--[\w-]+)\s*\)/g, (m, name) => (tokens.has(name) ? sub(tokens.get(name), depth + 1) : m));
    return r;
  };
  const lines = [];
  for (const d of decls) {
    if (isOtherThemeCtx(d.ctx)) continue;
    if (d.prop.startsWith('--') && isRootCtx(d.ctx)) continue;
    const v = sub(d.value).replace(/\s+/g, ' ').replace(LITERAL, (m) => normText(m));
    lines.push(`${d.ctx.join(' > ')} { ${d.prop}: ${v} }`);
  }
  return lines.join('\n') + '\n';
}

// ------------------------------------------------------------------ main
if (has('--expand')) {
  const list = argv.filter((a) => !a.startsWith('--'));
  if (!list.length) { console.error('usage: node tools/css-audit.mjs --expand a.css [b.css ...]'); process.exit(2); }
  process.stdout.write(expand(list.map((f) => path.resolve(f))));
  process.exit(0);
}

const results = files.map(audit);
const cssResults = results.filter((r) => r.file.endsWith('.css'));

function palette() {
  const map = new Map();
  for (const r of cssResults) {
    for (const l of r._lits) {
      const c = rgba(l.text); const key = c ? canon(c) : l.text;
      const e = map.get(key) || { colour: key, rgba: c, uses: 0, forms: new Map(), props: new Map(), files: new Set() };
      e.uses++; e.files.add(r.file);
      e.forms.set(normText(l.text), (e.forms.get(normText(l.text)) || 0) + 1);
      const p = l.prop.startsWith('--') ? `${l.prop} (definition)` : l.prop;
      e.props.set(p, (e.props.get(p) || 0) + 1);
      map.set(key, e);
    }
  }
  return [...map.values()].sort((a, b) => b.uses - a.uses || a.colour.localeCompare(b.colour));
}

function near(pal, d) {
  const parent = pal.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < pal.length; i++) {
    for (let j = i + 1; j < pal.length; j++) {
      const a = pal[i].rgba; const b = pal[j].rgba;
      if (!a || !b) continue;
      if (Math.abs(a[3] - b[3]) <= 0.05 && Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2])) <= d) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  pal.forEach((e, i) => { const g = find(i); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(e); });
  return [...groups.values()].filter((g) => g.length > 1).sort((a, b) => b.length - a.length || b.reduce((n, e) => n + e.uses, 0) - a.reduce((n, e) => n + e.uses, 0));
}

if (has('--json')) {
  const pal = palette();
  console.log(JSON.stringify({
    files: results.map(({ _lits, ...r }) => r),
    palette: pal.map((e) => ({ colour: e.colour, uses: e.uses, forms: Object.fromEntries(e.forms), props: Object.fromEntries(e.props), files: [...e.files] })),
  }, null, 1));
  process.exit(0);
}

if (has('--palette')) {
  const pal = palette(); const top = Number(val('--top', pal.length));
  const total = pal.reduce((n, e) => n + e.uses, 0);
  console.log(`Palette of ${cssResults.map((r) => r.file).join(', ')}: ${pal.length} distinct colours, ${total} literals (definitions of tokens included)`);
  console.log('uses  colour                       forms                              properties');
  for (const e of pal.slice(0, top)) {
    const forms = [...e.forms].map(([f, n]) => (e.forms.size > 1 ? `${f} ×${n}` : f)).join(', ');
    const props = [...e.props].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([p, n]) => `${p} ${n}`).join(', ');
    console.log(`${String(e.uses).padStart(4)}  ${e.colour.padEnd(28)} ${forms.padEnd(34)} ${props}`);
  }
  process.exit(0);
}

if (has('--near')) {
  const d = Number(val('--near', 6)); const pal = palette();
  const groups = near(pal, d);
  console.log(`Near-duplicate groups in the CSS (every channel within ${d} of a neighbour, alpha within .05): ${groups.length} groups, ${groups.reduce((n, g) => n + g.length, 0)} colours`);
  for (const g of groups) console.log(`  ${g.map((e) => `${e.colour} ×${e.uses}`).join('  ')}`);
  process.exit(0);
}

const pad = (s, n) => String(s).padStart(n);
console.log('file                         lines  literals   hex (distinct)   rgb/hsl (distinct)   colours   token defs (literals)   var() uses');
for (const r of results) {
  const tok = r.tokenDefs !== undefined ? `${pad(r.tokenDefs, 10)} (${pad(r.literalsInTokenDefs, 4)})` : pad('', 17);
  console.log(`${r.file.padEnd(28)} ${pad(r.lines, 5)} ${pad(r.literals, 9)} ${pad(r.hex, 6)} (${pad(r.hexDistinct, 4)}) ${pad(r.rgb, 10)} (${pad(r.rgbDistinct, 4)}) ${pad(r.colours, 11)}   ${tok}   ${r.varUses !== undefined ? pad(r.varUses, 10) : ''}`);
}
const sum = (rs, k) => rs.reduce((n, r) => n + (r[k] || 0), 0);
const jsResults = results.filter((r) => !r.file.endsWith('.css'));
console.log(`CSS total: ${sum(cssResults, 'literals')} literals (${sum(cssResults, 'hex')} hex, ${sum(cssResults, 'rgb')} rgb/hsl), of which ${sum(cssResults, 'literalsInTokenDefs')} in root token definitions; ${sum(cssResults, 'varUses')} var() uses`);
console.log(`JS total: ${sum(jsResults, 'literals')} literals (${sum(jsResults, 'hex')} hex, ${sum(jsResults, 'rgb')} rgb/hsl)`);
