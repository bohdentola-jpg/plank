// The field is sized per stadium. World: x across [-W/2, W/2], z along [0, L]; end zones are the first and last EZ yards.
export const FIELD = { W: 42, L: 90, EZ: 10, APRON: 3 };
export const FIELD_SIZES = { backyard: [34, 50], small: [38, 60], medium: [42, 70], large: [46, 80], mega: [48, 90] };
export function setField(w, len) { FIELD.W = w; FIELD.L = len + 2 * FIELD.EZ; return FIELD; }
export function setFieldForStadium(spec) { const [w, len] = (spec && spec.field) || FIELD_SIZES[(spec && spec.size) || 'medium'] || FIELD_SIZES.medium; return setField(w, len); }
export const playLength = () => FIELD.L - 2 * FIELD.EZ;
