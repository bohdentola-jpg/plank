// Bundles src/ (and three.js) into two self-contained HTML files:
//   hide.html         — desktop: bigger store, shadows, bloom, full post-processing
//   hide-mobile.html  — phones: smaller store, touch controls, lighter rendering
// Usage: node build.mjs [--artifact <dir>]   (also writes headless variants for publishing)
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const ai = args.indexOf('--artifact');
const artifactDir = ai >= 0 ? args[ai + 1] : null;

const css = await readFile('src/style.css', 'utf8');
const page = await readFile('src/page.html', 'utf8');
const targets = [
  { mobile: false, out: 'hide.html', title: 'Hide' },
  { mobile: true, out: 'hide-mobile.html', title: 'Hide Mobile' },
];

for (const t of targets) {
  const r = await esbuild.build({
    entryPoints: ['src/main.js'],
    bundle: true,
    minify: true,
    format: 'iife',
    write: false,
    target: ['es2020'],
    legalComments: 'none',
    define: { __MOBILE__: String(t.mobile) },
  });
  const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const filled = page
    .replace('%%TITLE%%', () => t.title)
    .replace('%%CSS%%', () => css)
    .replace('%%PLATFORM%%', () => (t.mobile ? 'mobile' : 'desktop'))
    .replace('%%JS%%', () => js);
  const [head, body] = filled.split('<!--BODY-->');
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
${head.trim()}
</head>
<body>
${body.trim()}
</body>
</html>
`;
  await writeFile(t.out, doc);
  console.log(`${t.out}  ${(doc.length / 1024).toFixed(0)} KB`);
  if (artifactDir) {
    await mkdir(artifactDir, { recursive: true });
    await writeFile(join(artifactDir, t.out), filled.replace('<!--BODY-->', ''));
  }
}
