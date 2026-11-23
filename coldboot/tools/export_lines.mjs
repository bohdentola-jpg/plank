// Collect every voiced line from src/data/script/*.js → JSON on stdout.
//   node coldboot/tools/export_lines.mjs > lines.json
import { readdir } from 'node:fs/promises';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dir = fileURLToPath(new URL('../src/data/script/', import.meta.url));
const out = [];
for (const f of (await readdir(dir)).filter((f) => f.endsWith('.js')).sort()) {
  const mod = await import(pathToFileURL(join(dir, f)).href);
  for (const [id, L] of Object.entries(mod.LINES || {})) {
    if (L.silent) continue;
    out.push({ id, who: L.who, lang: L.ru ? 'ru' : 'en', text: L.ru || L.en, file: f });
    if (L.ru_f) out.push({ id: id + '_f', who: L.who, lang: 'ru', text: L.ru_f, file: f });
  }
}
process.stdout.write(JSON.stringify(out, null, 0));
