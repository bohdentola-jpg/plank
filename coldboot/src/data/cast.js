// Everyone with a face. DNA → human/character.js; voice → tools/build_voice.py.
// face modifiers: 'group/name': -1..1 (negative = the min target, e.g. decr/down/in)

export const CAST = {
  player: {
    name: 'Rybka',
    dna: {
      seed: 7, sex: 1, age: 31, muscle: 0.55, weight: 0.48, height: 1.0,
      ethnic: { caucasian: 0.8, african: 0.1, asian: 0.1 },
      face: { 'chin/chin-prominent': 0.2, 'nose/nose-hump': -0.2 },
      skin: { tone: 0.22, warmth: 0.55, rosy: 0.5 },
      eyes: { color: '#4a6a5a' },
      brows: { color: '#3a2618', density: 0.75, thickness: 0.5 },
      hair: { style: 'short', color: '#3a2618' },
      beard: { stubble: 0.35 },
      outfit: [
        { slot: 'top', pattern: 'knit', color: '#4a5560', thick: 0.008, hem: 'hip' },
        { slot: 'bottom', pattern: 'denim', color: '#2c3a4e', thick: 0.004 },
        { slot: 'boots', pattern: 'leather', color: '#3a2618', thick: 0.012, shaft: 0.3 },
      ],
    },
  },
  dmitri: {
    name: 'Dmitri Volkov', ru: 'Дмитрий Волков',
    dna: {
      seed: 11, sex: 1, age: 62, muscle: 0.5, weight: 0.62, height: 1.02,
      ethnic: { caucasian: 1 },
      face: {
        'nose/nose-scale-horiz': 0.35, 'nose/nose-hump': 0.4, 'nose/nose-volume': 0.3, 'chin/chin-width': 0.3,
        'eyebrows/eyebrows-trans': -0.3, 'eyes/l-eye-bag': 0.5, 'eyes/r-eye-bag': 0.5, 'head/head-fat': 0.2,
        'cheek/l-cheek-bones': 0.3, 'cheek/r-cheek-bones': 0.3,
      },
      skin: { tone: 0.16, warmth: 0.45, rosy: 0.75 },
      eyes: { color: '#5d7286' },
      brows: { color: '#8c8478', density: 0.9, thickness: 0.8 },
      hair: { style: 'swept', color: '#9a948c' },
      beard: { style: 'full', color: '#a39c92', stubble: 0.9 },
      outfit: [
        { slot: 'top', pattern: 'knit', color: '#3d4a3c', thick: 0.011, hem: 'hip', neckUp: 0.03 },
        { slot: 'bottom', pattern: 'wool', color: '#2c2a2a', thick: 0.005 },
        { slot: 'boots', pattern: 'leather', color: '#2a1e16', thick: 0.012, shaft: 0.3 },
      ],
    },
  },
  nadia: {
    name: 'Nadia Sokolova', ru: 'Надежда Соколова',
    dna: {
      seed: 23, sex: 0.02, age: 34, muscle: 0.45, weight: 0.42, height: 0.99,
      ethnic: { caucasian: 0.9, asian: 0.1 },
      face: {
        'cheek/l-cheek-bones': 0.6, 'cheek/r-cheek-bones': 0.6, 'nose/nose-point-width': -0.3, 'mouth/mouth-upperlip-volume': 0.3,
        'chin/chin-width': -0.2, 'eyes/l-eye-corner1': 0.2, 'eyes/r-eye-corner1': 0.2, 'nose/nose-scale-horiz': -0.25,
      },
      skin: { tone: 0.1, warmth: 0.4, rosy: 0.45, freckles: 0.15 },
      eyes: { color: '#6c8a9a' },
      brows: { color: '#2a1a12', density: 0.8, thickness: 0.35 },
      lips: { color: '#a85a58' },
      hair: { style: 'bun', color: '#2a1a12' },
      makeup: { eyeshadow: '#4a3436', eyeshadowAmt: 0.25 },
      outfit: [
        { slot: 'top', pattern: 'rib', color: '#d8cdb8', thick: 0.006, hem: 'hip', neckUp: 0.02 },
        { slot: 'bottom', pattern: 'denim', color: '#243042', thick: 0.004 },
        { slot: 'boots', pattern: 'leather', color: '#161210', thick: 0.008, shaft: 0.42 },
      ],
    },
  },
  lyosha: {
    name: 'Lyosha Orlov', ru: 'Алексей Орлов',
    dna: {
      seed: 31, sex: 1, age: 26, muscle: 0.3, weight: 0.3, height: 1.03,
      ethnic: { caucasian: 1 },
      face: { 'nose/nose-scale-vert': 0.3, 'chin/chin-prominent': -0.2, 'head/head-oval': 0.4, 'ears/l-ear-flap': 0.4, 'ears/r-ear-flap': 0.4 },
      skin: { tone: 0.08, warmth: 0.4, rosy: 0.6 },
      eyes: { color: '#7a6a4a' },
      brows: { color: '#5a4026', density: 0.6, thickness: 0.35 },
      hair: { style: 'messy', color: '#5a4026' },
      beard: { stubble: 0.15 },
      outfit: [
        { slot: 'top', pattern: 'fleece', color: '#5a5e66', thick: 0.012, hem: 'hip' },
        { slot: 'bottom', pattern: 'denim', color: '#3a4656', thick: 0.004 },
        { slot: 'boots', pattern: 'duck', color: '#d8d8d0', thick: 0.01, shaft: 0.08 },
      ],
    },
  },
  grisha: {
    name: 'Grisha Bondarenko', ru: 'Григорий Бондаренко',
    dna: {
      seed: 41, sex: 1, age: 45, muscle: 0.85, weight: 0.85, height: 1.06,
      ethnic: { caucasian: 1 },
      face: { 'head/head-fat': 0.5, 'neck/neck-scale-horiz': 0.6, 'nose/nose-scale-horiz': 0.5, 'chin/chin-width': 0.5, 'nose/nose-flaring': 0.4 },
      skin: { tone: 0.2, warmth: 0.55, rosy: 0.9 },
      eyes: { color: '#4a5a6a' },
      brows: { color: '#4a3020', density: 0.95, thickness: 0.7 },
      hair: { style: 'buzz', color: '#4a3020' },
      beard: { style: 'full', color: '#5a3a22', stubble: 1 },
      outfit: [
        { slot: 'top', pattern: 'plaid', color: '#7a1c1c', color2: '#141414', color3: '#c8a040', thick: 0.006, hem: 'hip' },
        { slot: 'bottom', pattern: 'duck', color: '#5a4a30', thick: 0.007 },
        { slot: 'boots', pattern: 'leather', color: '#3a2a1a', thick: 0.014, shaft: 0.32 },
      ],
    },
  },
  valya: {
    name: 'Baba Valya', ru: 'Валентина Петровна',
    dna: {
      seed: 53, sex: 0, age: 78, muscle: 0.35, weight: 0.6, height: 0.93,
      ethnic: { caucasian: 1 },
      face: { 'nose/nose-point': -0.3, 'cheek/l-cheek-volume': 0.4, 'cheek/r-cheek-volume': 0.4, 'mouth/mouth-upperlip-volume': -0.4, 'eyes/l-eye-bag': 0.6, 'eyes/r-eye-bag': 0.6 },
      skin: { tone: 0.12, warmth: 0.45, rosy: 0.7 },
      eyes: { color: '#6a7a8a' },
      brows: { color: '#b0a8a0', density: 0.5, thickness: 0.3 },
      hair: { style: 'headscarf', color: '#c8c0b8' },
      outfit: [
        { slot: 'top', pattern: 'knit', color: '#6a5a4c', thick: 0.01, hem: 'hip', fit: 0.7 },
        { slot: 'skirt', pattern: 'wool', color: '#2a2630', thick: 0.012, hem: 'calf' },
        { slot: 'bottom', pattern: 'wool', color: '#3a3438', thick: 0.004 },
        { slot: 'boots', pattern: 'wool', color: '#4a4440', thick: 0.018, shaft: 0.4 },
      ],
    },
  },
  ivan: {
    name: 'Ivan Tikhonov', ru: 'Иван Тихонов',
    dna: {
      seed: 67, sex: 1, age: 50, muscle: 0.5, weight: 0.45, height: 0.98,
      ethnic: { caucasian: 0.7, asian: 0.3 },
      face: { 'nose/nose-scale-vert': 0.2, 'chin/chin-prominent': 0.3, 'eyes/l-eye-scale': -0.2, 'eyes/r-eye-scale': -0.2, 'head/head-rectangular': 0.5 },
      skin: { tone: 0.2, warmth: 0.5, rosy: 0.35 },
      eyes: { color: '#3a2a1a' },
      brows: { color: '#2a2622', density: 0.7, thickness: 0.45 },
      hair: { style: 'short', color: '#2e2a28' },
      beard: { style: 'moustache', color: '#2e2a28', stubble: 0.5 },
      outfit: [
        { slot: 'top', pattern: 'wool', color: '#22262c', thick: 0.008, hem: 'hip', neckUp: 0.02 },
        { slot: 'bottom', pattern: 'wool', color: '#1c1c1e', thick: 0.005 },
        { slot: 'boots', pattern: 'leather', color: '#141210', thick: 0.01, shaft: 0.25 },
      ],
    },
  },
};
