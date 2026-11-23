// Builds snake-lab.html: one self-contained file with the styles, the markup, the
// Python interpreter (shared with COLD BOOT, retold for the PIXEL-8), the lessons
// and the app. Run: node snakelab/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(here, p), 'utf8');

/** Replace `from` with `to`, insisting it occurs exactly `count` times (so a change upstream can't slip by). */
function patch(text, from, to, count = 1) {
  const n = text.split(from).length - 1;
  if (n !== count) throw new Error(`build: expected ${count} × ${JSON.stringify(from)} in python.js, found ${n}`);
  return text.split(from).join(to);
}

let py = read('../coldboot/src/code/python.js');
const PATCHES = [
  // wording: the interpreter grew up in COLD BOOT's Night School
  ['// COLD BOOT — python.js', '// Snake Lab — python.js (the interpreter from COLD BOOT, retold for the PIXEL-8)'],
  ["A Python-subset interpreter for Lyosha's Night School.", 'A Python-subset interpreter for the PIXEL-8.'],
  ["Night School's Python skips this feature.", "The PIXEL-8's Python skips this feature."],
  ['/not supported in Night School/', '/not supported in the PIXEL-8/'],
  ["not supported in Night School's Python", "not supported in the PIXEL-8's Python", 4],
  ["Lyosha's notes cover the rest.", 'The lesson card covers the rest.'],
  ['there are no files on this laptop — Lyosha keeps everything in variables', 'the PIXEL-8 has no files: keep everything in variables'],
  ['3.13 (Night School)', '3.13 (PIXEL-8)'],
  ['Count them, Rybka: every', 'Count them: every'],
  ["That's JavaScript talking, Rybka.", "That's JavaScript talking."],
  ["That's too big for this laptop. Lyosha bought it used in 2011. Try something smaller.", "That's too big for the PIXEL-8's little memory. Try something smaller."],
  ["That module isn't installed on this laptop. Night School has math, random, string, time and sys.", "That module isn't on the PIXEL-8. It has math, random, string, time and sys."],
  ["That's my bug, not yours, Rybka. Tell Lyosha which line did it.", "That's a bug in the PIXEL-8, not in your code. Try writing that line a different way."],
  ["Even Baba Valya doesn't want to read it.", 'Nobody wants to read that.'],
  ["Even Baba Valya can't do that.", "You can't split something into zero pieces."],
  ['no keyboard on this mission', 'no keyboard on the PIXEL-8', 2],
  ["// 23. Lyosha's hints", '// 23. Hints'],
  // tuples (and other Python values) built by the host pass straight through
  ['      if (isPyObject(v)) return v;\n',
    '      if (isPyObject(v)) return v;\n      if (v instanceof PyTuple || v instanceof PyFloat || v instanceof PyDict || v instanceof PySet) return v;\n'],
  // say which function an error happened in
  ['      text: message ? `${type}: ${message}` : type,\n',
    '      text: message ? `${type}: ${message}` : type,\n      where: pe.where || \'<module>\',\n'],
];
for (const [from, to, count] of PATCHES) py = patch(py, from, to, count);
const exports = (py.match(/^export (class|function) /gm) || []).length;
if (exports < 10) throw new Error('build: python.js exports changed shape');
py = py.replace(/^export (class|function) /gm, '$1 ');
py += '\nwindow.Py = { PyVM, PyTuple, PyFloat, toJS, toPy, pyRepr };\n';

const app = read('src/lessons.js') + '\n' + read('src/app.js');
for (const [name, text] of [['python.js', py], ['app', app]]) {
  if (/<\/script|<!--/i.test(text)) throw new Error(`build: ${name} contains a sequence that would break an inline <script>`);
}

const icon = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" rx="3" fill="#1f6c6a"/>' +
  '<rect x="2" y="7" width="3" height="3" fill="#46cf5b"/><rect x="5.5" y="7" width="3" height="3" fill="#46cf5b"/>' +
  '<rect x="9" y="7" width="3" height="3" fill="#b8f24b"/><rect x="11" y="2" width="3" height="3" fill="#ff4f4f"/></svg>');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Snake Lab</title>
<meta name="description" content="Learn Python by building Snake on the PIXEL-8, a tiny 16 by 16 console. One file, no install.">
<meta name="color-scheme" content="dark">
<link rel="icon" href="${icon}">
<style>
${read('src/style.css')}
</style>
</head>
<body>
${read('src/body.html')}
<noscript><p style="padding:20px">Snake Lab needs JavaScript turned on.</p></noscript>
<script type="module">
${py}
</script>
<script type="module">
${app}
</script>
</body>
</html>
`;
writeFileSync(join(here, 'snake-lab.html'), html);
console.log(`snake-lab.html: ${(html.length / 1024).toFixed(0)} KB`);
