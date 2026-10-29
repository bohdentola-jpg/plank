// Node resolve hook: maps the bare "three" import to the vendored copy, the
// same job the import map does in the browser.
export async function resolve(spec, ctx, next) {
  if (spec === 'three') return { url: new URL('../vendor/three.module.js', import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
