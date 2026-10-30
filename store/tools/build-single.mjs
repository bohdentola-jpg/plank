// Bundle the whole store into ONE self-contained HTML file (fonts inlined,
// JS bundled) — handy for hosting anywhere or sharing as a single file.
//   node store/tools/build-single.mjs            → store/dist/3rd-rail.html
//   node store/tools/build-single.mjs --fragment → body-only fragment (no <html>/<head>)
// Needs Node 18+; fetches esbuild via npx on first run.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const fragment = process.argv.includes('--fragment');
const outDir = join(root, 'dist');
mkdirSync(outDir, { recursive: true });

const js = execFileSync('npx', ['--yes', 'esbuild@0.24.0', join(root, 'src/main.js'), '--bundle', '--format=iife', '--minify', '--target=es2020'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

let css = readFileSync(join(root, 'styles.css'), 'utf8');
css = css.replace(/url\("fonts\/([^"]+\.woff2)"\)/g, (_, f) => `url(data:font/woff2;base64,${readFileSync(join(root, 'fonts', f)).toString('base64')})`);

const html = readFileSync(join(root, 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script type="module"')).trim();
const title = '<title>3rd Rail Market</title>';
const meta = '<meta name="description" content="3RD RAIL — the shop under the city. Swipe in daily, play the minigames, find the secret stores." />';
const safeJs = js.replace(/<\/script/gi, '<\\/script');

const out = fragment
  ? `${title}\n${meta}\n<style>\n${css}\n</style>\n${body}\n<script>\n${safeJs}\n</script>\n`
  : `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n<meta name="theme-color" content="#140f26" />\n${meta}\n${title}\n<style>\n${css}\n</style>\n</head>\n<body>\n${body}\n<script>\n${safeJs}\n</script>\n</body>\n</html>\n`;

const file = join(outDir, fragment ? '3rd-rail.fragment.html' : '3rd-rail.html');
writeFileSync(file, out);
console.log(`wrote ${file} (${Math.round(out.length / 1024)} KB)`);
