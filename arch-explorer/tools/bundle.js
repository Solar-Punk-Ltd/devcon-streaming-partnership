/**
 * Build one self-contained HTML file from the module graph.
 *
 * The point of the source tree is that it is modular and testable. The point
 * of the build is that the thing you hand someone is a single file they can
 * open, mail, or publish with no server and no network access at all.
 *
 * This is a deliberately small module wrapper rather than a real bundler,
 * which it can be because the source style is constrained: relative imports
 * only, named exports only, no default exports, no dynamic import, no
 * circular imports. `validate` below enforces every one of those, so an
 * unsupported form fails the build instead of producing a broken file.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateModel } from '../src/model/schema.js';
import { OBJECTS } from '../src/model/objects.js';
import { DIAGRAMS } from '../src/model/diagrams.js';
import { TOUR } from '../src/model/tour.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'src');
const ENTRY = join(SRC, 'main.js');
const OUT = join(ROOT, 'dist', 'devcon8-architecture.html');
// The artifact host supplies its own document skeleton, so that target gets
// the same styles and script with the outer document stripped off.
const OUT_FRAGMENT = join(ROOT, 'dist', 'devcon8-architecture.fragment.html');

const importRe = () => /^import\s+(?:(\*\s+as\s+\w+)|(\{[^}]*\})|(\w+))\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm;
const BARE_IMPORT_RE = /^import\s+['"][^'"]+['"];?[ \t]*$/m;
const EXPORT_FROM_RE = /^export\s+.*\bfrom\s+['"]/m;
const DEFAULT_EXPORT_RE = /^export\s+default\b/m;
const DYNAMIC_IMPORT_RE = /\bimport\s*\(/;

const key = (absolute) => relative(SRC, absolute).split('\\').join('/');

/** Reject anything the wrapper cannot faithfully reproduce. */
function validate(id, source) {
  if (EXPORT_FROM_RE.test(source)) throw new Error(`${id}: "export ... from" is not supported by the bundler`);
  if (DEFAULT_EXPORT_RE.test(source)) throw new Error(`${id}: default exports are not supported by the bundler`);
  if (DYNAMIC_IMPORT_RE.test(source)) throw new Error(`${id}: dynamic import is not supported by the bundler`);
  if (BARE_IMPORT_RE.test(source)) throw new Error(`${id}: side-effect-only imports are not supported`);

  for (const m of source.matchAll(importRe())) {
    if (m[3]) throw new Error(`${id}: default import of "${m[4]}" is not supported`);
    if (!m[4].startsWith('.')) throw new Error(`${id}: bare specifier "${m[4]}" cannot be bundled`);
    // The brace text is re-emitted verbatim into a destructuring pattern, and
    // `{ a as b }` is not one.
    if (m[2] && /\bas\b/.test(m[2])) throw new Error(`${id}: aliased import "${m[2].trim()}" is not supported`);
  }

  // An import the regex cannot match is left in the body verbatim and fails at
  // runtime rather than here. Strip the ones that did match and anything still
  // starting a line is a form this bundler does not understand. Checked on the
  // whole source rather than line by line, because a braced import may wrap.
  const unmatched = source.replace(importRe(), '');
  const stray = /^import\b.*/m.exec(unmatched);
  if (stray) throw new Error(`${id}: import form not supported by the bundler: ${stray[0].trim()}`);

  for (const m of source.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    if (/\bas\b/.test(m[1])) throw new Error(`${id}: aliased export "${m[1].trim()}" is not supported`);
  }
}

/**
 * Every name an importer asks for must actually be published.
 *
 * This is what catches the quiet failures: only the first identifier of a
 * multi-declarator export is published, and an aliased export list publishes
 * the local name. Neither produces a syntax error, both hand the importer
 * `undefined` at runtime.
 */
function checkLinkage(modules) {
  const exported = new Map([...modules].map(([id, src]) => [id, new Set(exportedNames(src))]));

  for (const [id, source] of modules) {
    const dir = dirname(join(SRC, id));
    for (const m of source.matchAll(importRe())) {
      if (!m[2]) continue;
      const target = key(resolve(dir, m[4]));
      const published = exported.get(target);
      if (!published) continue;

      for (const raw of m[2].replace(/[{}]/g, '').split(',')) {
        const name = raw.trim();
        if (name && !published.has(name)) {
          throw new Error(`${id} imports "${name}" from ${target}, which does not publish it`);
        }
      }
    }
  }
}

/** Names a module exports, so the wrapper can publish them after the body runs. */
function exportedNames(source) {
  const names = new Set();
  for (const m of source.matchAll(/^export\s+(?:const|let|var)\s+(\w+)/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export\s+(?:async\s+)?function\s*\*?\s*(\w+)/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export\s+class\s+(\w+)/gm)) names.add(m[1]);
  for (const m of source.matchAll(/^export\s*\{([^}]*)\}\s*;?[ \t]*$/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) names.add(name);
    }
  }
  return [...names];
}

function rewrite(id, source) {
  const dir = dirname(join(SRC, id));

  let body = source.replace(importRe(), (_, star, braces, _default, spec) => {
    const target = key(resolve(dir, spec));
    if (star) return `const ${star.replace(/\*\s+as\s+/, '')} = __req(${JSON.stringify(target)});`;
    return `const ${braces} = __req(${JSON.stringify(target)});`;
  });

  const names = exportedNames(source);

  // Statement-level `export` only; anything else was rejected by validate.
  body = body.replace(/^export\s*\{[^}]*\}\s*;?[ \t]*$/gm, '');
  body = body.replace(/^export\s+/gm, '');

  const publish = names.map((n) => `__exports.${n} = ${n};`).join('\n');
  return `__mods[${JSON.stringify(id)}] = function (__exports, __req) {\n${body}\n${publish}\n};`;
}

/** Depth-first walk of the import graph from the entry module. */
async function collect(entry) {
  const modules = new Map();
  const stack = [];

  const visit = async (absolute) => {
    const id = key(absolute);
    if (modules.has(id)) return;
    if (stack.includes(id)) throw new Error(`circular import: ${[...stack, id].join(' -> ')}`);

    const source = await readFile(absolute, 'utf8');
    validate(id, source);

    stack.push(id);
    for (const m of source.matchAll(importRe())) {
      await visit(resolve(dirname(absolute), m[4]));
    }
    stack.pop();

    // Recorded after its imports, so the emitted order is already topological.
    modules.set(id, source);
  };

  await visit(entry);
  return modules;
}

const CSS_LINK_RE = /[ \t]*<link rel="stylesheet" href="([^"]+)">\n?/g;
const SCRIPT_RE = /[ \t]*<script type="module" src="[^"]+"><\/script>\n?/;

async function build() {
  const check = validateModel({ objects: OBJECTS, diagrams: DIAGRAMS, tour: TOUR });
  if (!check.ok) {
    console.error(`Model is invalid, refusing to build:\n${check.errors.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }
  if (check.warnings.length) {
    console.warn(`Warnings:\n${check.warnings.map((w) => `  - ${w}`).join('\n')}`);
  }

  const modules = await collect(ENTRY);
  checkLinkage(modules);
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');

  const styles = [];
  for (const [, href] of html.matchAll(CSS_LINK_RE)) {
    styles.push(await readFile(join(ROOT, href), 'utf8'));
  }
  if (!styles.length) throw new Error('no stylesheets found in index.html');

  const runtime = [
    'const __mods = {};',
    'const __cache = {};',
    'function __req(id) {',
    '  if (__cache[id]) return __cache[id];',
    '  const exports = (__cache[id] = {});',
    '  __mods[id](exports, __req);',
    '  return exports;',
    '}',
  ].join('\n');

  const wrapped = [...modules].map(([id, source]) => rewrite(id, source)).join('\n\n');
  const script = `(function () {\n"use strict";\n${runtime}\n\n${wrapped}\n\n__req(${JSON.stringify(key(ENTRY))});\n})();`;

  const out = html
    .replace(CSS_LINK_RE, '')
    .replace('</head>', `<style>\n${styles.join('\n')}\n</style>\n</head>`)
    .replace(SCRIPT_RE, `<script>\n${script}\n</script>\n`);

  if (out.includes('<script type="module"')) throw new Error('the module script tag was not replaced');

  // Parse what is about to ship. Without this a mangled bundle exits zero and
  // the page is simply blank, which is the worst possible failure mode for a
  // build whose whole job is producing one file someone else opens.
  try {
    // eslint-disable-next-line no-new-func
    new Function(script);
  } catch (error) {
    throw new Error(`the generated bundle does not parse: ${error.message}`);
  }

  const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(out);
  if (!bodyMatch) throw new Error('could not find the body to extract for the fragment target');
  const title = /<title>([^<]*)<\/title>/.exec(out)?.[1] ?? 'Architecture explorer';
  const fragment = `<title>${title}</title>\n<style>\n${styles.join('\n')}\n</style>\n${bodyMatch[1].trim()}\n`;

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, out, 'utf8');
  await writeFile(OUT_FRAGMENT, fragment, 'utf8');

  const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
  console.log(`built ${relative(ROOT, OUT)}  ${kb} KB  ${modules.size} modules  ${styles.length} stylesheets`);
  console.log(`built ${relative(ROOT, OUT_FRAGMENT)}  (artifact target, no outer document)`);
}

build().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
