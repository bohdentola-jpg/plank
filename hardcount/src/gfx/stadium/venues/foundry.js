// placeholder (being built)
export function paint(ctx) {
  return { surface: ctx.def.surface, pattern: 'stripes', wear: 0.3, border: 'pro',
    endzone: { style: 'solid', fill: ctx.home.colors.primary, text: [ctx.home.name.toUpperCase(), ctx.home.city.toUpperCase()], color: '#ffffff', outline: ctx.home.colors.secondary } };
}
export async function build() { return { seats: [] }; }
