// Everyone with a face. DNA → src/people/ (buildCharacter); voice → tools/build_voice.py.
// dna: { avatar: a Microsoft Rocketbox avatar from src/people/catalog.js (baked
// looks — greyed hair, aged skin, dyed clothes — live there), sex (0 f / 1 m, read
// by the voice for Russian grammar), height (scale), tint / tintAmt (cloth colour) }

export const CAST = {
  player: {
    name: 'Rybka',
    dna: { avatar: 'Male_Adult_07', sex: 1, height: 1.0 },
  },
  dmitri: {
    name: 'Dmitri Volkov', ru: 'Дмитрий Волков',
    dna: { avatar: 'Male_Adult_05', sex: 1, height: 1.02 },  // 62, grey beard: Rocketbox m009 (hair greyed further)
  },
  nadia: {
    name: 'Nadia Sokolova', ru: 'Надежда Соколова',
    dna: { avatar: 'Female_Adult_14', sex: 0, height: 1.0 },  // 34: brunette bob, cream wrap cardigan, jeans, boots
  },
  lyosha: {
    name: 'Lyosha Orlov', ru: 'Алексей Орлов',
    dna: { avatar: 'Male_Adult_20', sex: 1, height: 1.02 },  // 26: the brown hoodie
  },
  grisha: {
    name: 'Grisha Bondarenko', ru: 'Григорий Бондаренко',
    dna: { avatar: 'Delivery_Male_01', sex: 1, height: 1.07 },  // 45, huge: beard, beanie, red flannel, boots
  },
  valya: {
    name: 'Baba Valya', ru: 'Валентина Петровна',
    dna: { avatar: 'Business_Female_02', sex: 0, height: 0.95 },  // 78: the oldest Rocketbox woman, hair whitened, skin aged; glasses
  },
  ivan: {
    name: 'Ivan Tikhonov', ru: 'Иван Тихонов',
    dna: { avatar: 'Business_Male_04', sex: 1, height: 0.99 },  // 50: shaved head, grey waistcoat, says nothing
  },

  // ---------------------------------------------------------------- Port Zarya
  pilot: {
    name: 'Captain', short: 'Pilot', color: '#9fd0ff',
    dna: { avatar: 'Pilot_Male_02', sex: 1, height: 1.0 },
  },
  okafor: {
    name: 'Mr. Grey', short: 'Mr. Grey', color: '#b8c0c8',
    dna: { avatar: 'Business_Male_05', sex: 1, height: 1.03 },  // Special Agent Okafor: suit recoloured grey
  },
  wade: {
    name: 'Wade Tolliver', short: 'Wade', color: '#ffc07a',
    dna: { avatar: 'Male_Adult_13', sex: 1, height: 1.0 },  // 56: thinning hair, sweater vest
  },
  koshkin: {
    name: 'Sasha Koshkin', short: 'Koshkin', color: '#e8d098',
    dna: { avatar: 'Male_Adult_14', sex: 1, height: 0.96 },  // 82: white hair, aged
  },
  dolly: {
    name: 'Dolly Finch', short: 'Dolly', color: '#ff9ab0',
    dna: { avatar: 'Female_Adult_02', sex: 0, height: 1.0 },  // 58: greying, aged a little
  },
  hank: {
    name: 'Hank Brubaker', short: 'Hank', color: '#ffb060',
    dna: { avatar: 'Construction_Male_02', sex: 1, height: 1.04 },  // 55: work coveralls (hard hat left off)
  },
  ruth: {
    name: 'Ruth Aqpik', short: 'Ruth', color: '#a0e0c0',
    dna: { avatar: 'Female_Adult_03', sex: 0, height: 0.94 },  // 71: grey hair, aged (the only East Asian adult woman in Rocketbox)
  },
  ray: {
    name: 'Ray Moody', short: 'Ray', color: '#c0c8ff',
    dna: { avatar: 'Male_Adult_12', sex: 1, height: 1.0 },  // 47: denim jacket
  },
  lyle: {
    name: 'Lyle Pruitt', short: 'Lyle', color: '#ffe080',
    dna: { avatar: 'Business_Male_03', sex: 1, height: 1.0 },  // 38: suit and tie
  },
  marta: {
    name: 'Chief Marta Kowalczyk', short: 'Chief', color: '#80b0ff',
    dna: { avatar: 'Security_Female_01', sex: 0, height: 1.02 },  // the chief: black uniform and cap
  },
  gideon: {
    name: 'Gideon Shaw', short: 'Shaw', color: '#d0d0d0',
    dna: { avatar: 'Business_Male_02', sex: 1, height: 1.03 },  // 40: navy suit
  },
  walt: {
    name: 'Mayor Walt Hennessey', short: 'Mayor', color: '#ffd0a0',
    dna: { avatar: 'Business_Male_07', sex: 1, height: 1.0 },  // 64: heavy, tie and jeans
  },
  halloran: {
    name: 'Cyrus Halloran', short: 'Halloran', color: '#ffffff',
    dna: { avatar: 'Male_Adult_03', sex: 1, height: 1.03 },  // 61: white hair, blazer darkened
  },
  evan: {
    name: 'Evan Pike', short: 'Evan', color: '#7fe6ff',
    dna: { avatar: 'Male_Adult_08', sex: 1, height: 1.0 },  // 28: pressed shirt
  },
  gabriel: {
    name: 'Father Gabriel', short: 'Fr. Gabriel', color: '#ffd8a0',
    dna: { avatar: 'Male_Adult_15', sex: 1, height: 1.0 },  // 54: beard; tunic and cap dyed black (cassock, skufia)
  },
  nina: {
    name: 'Nina Kowalczyk', short: 'Nina', color: '#ff80e0',
    dna: { avatar: 'Female_Adult_12', sex: 0, height: 0.97 },  // 17: hoodie
  },
  lou: {
    name: 'Lou Amarok', short: 'Lou', color: '#ffa060',
    dna: { avatar: 'Female_Adult_05', sex: 0, height: 1.02 },  // 45: black bob, jacket dyed dark green
  },
  tommy: {
    name: 'Tommy Aqpik', short: 'Tommy', color: '#80ffb0',
    dna: { avatar: 'Male_Adult_10', sex: 1, height: 1.0 },  // 24: track jacket
  },
  ellen: {
    name: 'Doc Ellen Haverford', short: 'Doc', color: '#b0ffd0',
    dna: { avatar: 'Medical_Female_02', sex: 0, height: 1.0 },  // 60: white coat, greying
  },
  pearl: {
    name: 'Pearl Jessup', short: 'Pearl', color: '#ffe0f0',
    dna: { avatar: 'Business_Female_01', sex: 0, height: 0.96 },  // 66: greying
  },
  officer: {
    name: 'Officer', short: 'Officer', color: '#c8d0a0',
    dna: { avatar: 'Police_Male_03', sex: 1, height: 1.02 },  // border service officer: dark uniform, peaked cap
  },
  guard: {
    name: 'Border Guard', short: 'Guard', color: '#c8d0a0',
    dna: { avatar: 'Military_Male_05', sex: 1, height: 1.0 },  // border guard: field uniform and cap
  },
};
