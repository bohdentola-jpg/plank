// Things that go in the backpack, and what they become on the ofrenda.
// prop: which 3D model shows them; card: the learning card they unlock.
export const ITEMS = {
  cempasuchil: { prop: 'cempasuchil', card: 'cempasuchil', name: { en: 'Marigolds', es: 'Cempasúchil' }, desc: { en: 'From Doña Chela\'s flower stand', es: 'Del puesto de Doña Chela' } },
  terciopelo: { prop: 'terciopelo', card: 'terciopelo', name: { en: 'Cockscomb flowers', es: 'Terciopelo' }, desc: { en: 'Velvety and deep red', es: 'Aterciopelado y rojo' } },
  nube: { prop: 'nube', card: 'terciopelo', name: { en: 'Baby\'s breath', es: 'Nube' }, desc: { en: 'Tiny white flowers', es: 'Florecitas blancas' } },
  velas: { prop: 'vela', card: 'velas', name: { en: 'Veladoras', es: 'Veladoras' }, desc: { en: 'Four candles in glass jars', es: 'Cuatro velas en vaso' } },
  copal: { prop: 'copal', card: 'copal', name: { en: 'Copal & burner', es: 'Copal y sahumador' }, desc: { en: 'Fragrant resin from Don Tomás', es: 'Resina aromática de Don Tomás' } },
  fruta: { prop: 'fruta', card: 'fruta', name: { en: 'Fruit', es: 'Fruta' }, desc: { en: 'Oranges, tejocotes, guavas, sugarcane', es: 'Naranjas, tejocotes, guayabas, caña' } },
  'calavera-blanca': { prop: 'calavera', propOpts: { plain: true }, card: 'calavera', name: { en: 'Plain sugar skull', es: 'Calaverita sin decorar' }, desc: { en: 'Ready to decorate at Tía Lucía\'s', es: 'Lista para decorar con Tía Lucía' } },
  'papel-china': { prop: 'papelito', card: null, name: { en: 'Tissue paper', es: 'Papel de China' }, desc: { en: 'For making papel picado', es: 'Para hacer papel picado' } },
  chocolate: { prop: 'chocolate', card: 'bebidas', name: { en: 'Mexican chocolate', es: 'Chocolate de mesa' }, desc: { en: 'For Abuelo\'s hot chocolate', es: 'Para el chocolate del Abuelo' } },
  pan: { prop: 'pan', card: 'pan', name: { en: 'Pan de muerto', es: 'Pan de muerto' }, desc: { en: 'You baked it with Don Ramón!', es: '¡Lo horneaste con Don Ramón!' } },
  papel: { prop: 'papel', card: 'papel', name: { en: 'Your papel picado', es: 'Tu papel picado' }, desc: { en: 'Cut with a chisel, Huixcolotla-style', es: 'Cortado con cincel, como en Huixcolotla' } },
  calavera: { prop: 'calavera', card: 'calavera', name: { en: 'Your sugar skull', es: 'Tu calaverita' }, desc: { en: 'Decorated for Abuelo', es: 'Decorada para el Abuelo' } },
};

// the market shopping list Abuela gives
export const MARKET_LIST = ['cempasuchil', 'velas', 'copal', 'fruta', 'calavera-blanca', 'papel-china'];

// things already at home, available when building the ofrenda
export const HOME_ITEMS = ['foto', 'agua', 'sal', 'tamales', 'cafe', 'guitarra', 'domino', 'lentes', 'gorra', 'dibujo', 'cruz', 'xolo', 'petate', 'arco', 'lavamanos'];

export const HOME_ITEM_TEXT = {
  foto: { name: { en: 'Abuelo\'s photo', es: 'La foto del Abuelo' } },
  agua: { name: { en: 'Glass of water', es: 'Vaso de agua' } },
  sal: { name: { en: 'Salt', es: 'Sal' } },
  tamales: { name: { en: 'Corundas', es: 'Corundas' } },
  cafe: { name: { en: 'Café de olla', es: 'Café de olla' } },
  guitarra: { name: { en: 'His guitar', es: 'Su guitarra' } },
  domino: { name: { en: 'His dominoes', es: 'Su dominó' } },
  lentes: { name: { en: 'His glasses', es: 'Sus lentes' } },
  gorra: { name: { en: 'His cap', es: 'Su gorra' } },
  dibujo: { name: { en: 'Lupita\'s drawing', es: 'El dibujo de Lupita' } },
  cruz: { name: { en: 'A cross', es: 'Una cruz' } },
  xolo: { name: { en: 'Clay Xolo', es: 'Xolo de barro' } },
  petate: { name: { en: 'Petate (mat)', es: 'Petate' } },
  arco: { name: { en: 'Marigold arch', es: 'Arco de cempasúchil' } },
  lavamanos: { name: { en: 'Basin & mirror', es: 'Agua, jabón y espejo' } },
};
