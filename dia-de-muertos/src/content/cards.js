// Learning cards ("tarjetas"), drawn like Lotería cards. Found by exploring.
// Facts follow the research notes in docs/research-notes.md; contested ideas are
// worded as "many families say…" / "one version…" on purpose.
export const CATS = {
  ofrenda: { en: 'The ofrenda', es: 'La ofrenda', bg: '#ffd9ec' },
  comida: { en: 'Food', es: 'La comida', bg: '#ffe4b5' },
  simbolos: { en: 'Symbols & art', es: 'Símbolos y arte', bg: '#e8dbff' },
  historia: { en: 'History', es: 'Historia', bg: '#d7e5ff' },
  costumbres: { en: 'Customs', es: 'Costumbres', bg: '#d2f2ec' },
  lugares: { en: 'Around Mexico', es: 'Por México', bg: '#e1f3c9' },
  mundo: { en: 'Around the world', es: 'Por el mundo', bg: '#d1eefc' },
};

const c = (o) => o;

export const CARDS = [
  // ------------------------------------------------------------ the basics
  c({
    id: 'dia', cat: 'costumbres', term: 'Día de Muertos', title: 'El Día de Muertos', say: 'DEE-ah deh MWEHR-tohs',
    en: { en: 'Day of the Dead' }, pic: { prop: 'cirio', opts: { lit: true } },
    text: [
      { en: 'Día de Muertos is a time when families remember loved ones who have died — and welcome their souls home for a short visit. Families build an [[ofrenda]], visit the [[panteón]], share food and tell stories.', es: 'El Día de Muertos es cuando las familias recuerdan a sus seres queridos que ya murieron y reciben a sus almas en casa por una visita corta. Ponen una [[ofrenda]], visitan el [[panteón]], comparten comida y cuentan historias.' },
      { en: 'It mixes joy and sadness: people miss their loved ones, and they also celebrate the lives they lived.', es: 'Mezcla alegría y tristeza: se extraña a quien ya no está y también se celebra la vida que vivió.' },
    ],
    dyk: { en: 'In Mexico most people say "Día de Muertos". In the United States many say "Día de los Muertos". Both are correct!', es: 'En México casi todos dicen "Día de Muertos"; en Estados Unidos muchos dicen "Día de los Muertos". ¡Las dos formas son correctas!' },
    src: ['britannica', 'unesco', 'gob-cultura'],
  }),
  c({
    id: 'halloween', cat: 'costumbres', term: '¡No es Halloween!', title: 'La Diferencia', say: '',
    en: { en: 'It is not "Mexican Halloween"' }, pic: { prop: 'foto', opts: { portrait: 'abuelo' } },
    text: [
      { en: 'Halloween and Día de Muertos happen close together, but they are different holidays with different roots. Día de Muertos is not about being scared — it is about inviting loved ones back with love.', es: 'Halloween y el Día de Muertos están en fechas cercanas, pero son fiestas distintas con raíces distintas. El Día de Muertos no es para asustar: es para recibir con cariño a quienes amamos.' },
      { en: 'The souls are welcomed like honored guests, with their favorite food, music and flowers.', es: 'Las almas se reciben como invitados de honor, con su comida favorita, música y flores.' },
    ],
    dyk: { en: 'The only real link between the two is the calendar: Halloween is the night before All Saints\' Day (November 1).', es: 'Lo único que las une es el calendario: Halloween es la víspera del Día de Todos los Santos (1 de noviembre).' },
    src: ['smithsonian-press', 'learningforjustice'],
  }),
  c({
    id: 'fechas', cat: 'costumbres', term: 'Las fechas', title: 'El Calendario', say: '',
    en: { en: 'When is it?' }, pic: { prop: 'calendario' },
    text: [
      { en: 'The main days are **November 1** and **November 2**. In many places the souls of children ([[angelitos]]) are remembered on November 1, and adults on November 2.', es: 'Los días principales son el **1 y el 2 de noviembre**. En muchos lugares el 1 se recuerda a los niños ([[angelitos]]) y el 2 a los adultos.' },
      { en: 'Dates change from town to town. Some families start on October 28 or 31, and some regions have extra days afterward.', es: 'Las fechas cambian de un pueblo a otro. Algunas familias empiezan el 28 o el 31 de octubre, y algunas regiones tienen días extra después.' },
    ],
    dyk: { en: 'November 1 is All Saints\' Day (Todos Santos) and November 2 is All Souls\' Day (Fieles Difuntos) in the Catholic calendar.', es: 'En el calendario católico, el 1 de noviembre es Todos los Santos y el 2 es Fieles Difuntos.' },
    src: ['gob-inafed', 'cultura-cuaderno'],
  }),
  c({
    id: 'origen', cat: 'historia', term: 'Las raíces', title: 'Las Raíces', say: '',
    en: { en: 'Where did it come from?' }, pic: { prop: 'raices' },
    text: [
      { en: 'Long before the Spanish arrived, many Indigenous peoples in what is now Mexico honored their dead with offerings. After the Spanish conquest in the 1500s, those ways mixed with the Catholic feasts of All Saints and All Souls.', es: 'Mucho antes de que llegaran los españoles, muchos pueblos indígenas de lo que hoy es México honraban a sus muertos con ofrendas. Después de la conquista, en el siglo XVI, esas costumbres se mezclaron con las fiestas católicas de Todos los Santos y Fieles Difuntos.' },
      { en: 'Historians still debate which parts came from where. The marigold, copal and the idea of feeding visiting ancestors have Indigenous roots; wheat bread, wax candles and sugar figures came from Europe.', es: 'Los historiadores todavía discuten qué parte viene de dónde. El cempasúchil, el copal y la idea de dar de comer a los difuntos tienen raíces indígenas; el pan de trigo, las velas de cera y las figuras de azúcar llegaron de Europa.' },
    ],
    dyk: { en: 'Today many Indigenous communities — Purépecha, Maya, Nahua, Zapotec, Mixtec and others — celebrate it in their own ways.', es: 'Hoy muchas comunidades indígenas —purépecha, maya, nahua, zapoteca, mixteca y más— lo celebran a su manera.' },
    src: ['britannica', 'brandes', 'inpi-elementos', 'cortamortaja'],
  }),
  c({
    id: 'mictlan', cat: 'historia', term: 'Mictlán', title: 'El Mictlán', say: 'MEEKT-lahn',
    en: { en: 'The Mexica place of the dead' }, pic: { prop: 'rio' },
    text: [
      { en: 'For the [[mexicas]] (Aztecs), where you went after death depended mostly on **how** you died. Most people went to Mictlán, ruled by [[Mictlantecuhtli]] and [[Mictecacíhuatl]]. It was not a place of punishment.', es: 'Para los [[mexicas]], el lugar al que ibas al morir dependía sobre todo de **cómo** morías. La mayoría iba al Mictlán, gobernado por [[Mictlantecuhtli]] y [[Mictecacíhuatl]]. No era un castigo.' },
      { en: 'One version of the story says the journey took four years, with a river to cross. A friar who wrote it down in the 1500s said a little reddish dog helped the souls across.', es: 'Una versión cuenta que el viaje duraba cuatro años y había que cruzar un río. Un fraile que lo escribió en el siglo XVI dijo que un perrito rojizo ayudaba a las almas a cruzarlo.' },
    ],
    dyk: { en: 'The Mexica held two feasts for the dead in their own calendar, around July and August — not in November!', es: 'Los mexicas tenían dos fiestas de muertos en su calendario, cerca de julio y agosto, ¡no en noviembre!' },
    src: ['arqueologia-teyolia', 'mexicolore-mictlan', 'arqueologia-miccailhuitl'],
  }),
  c({
    id: 'unesco', cat: 'historia', term: 'Patrimonio de la Humanidad', title: 'El Patrimonio', say: 'pah-tree-MOH-nee-oh',
    en: { en: 'A treasure for all humanity' }, pic: { prop: 'globo' },
    text: [
      { en: 'In **2003**, UNESCO named Mexico\'s "Indigenous festivity dedicated to the dead" a Masterpiece of the Oral and Intangible Heritage of Humanity, and in **2008** it joined UNESCO\'s official list.', es: 'En **2003** la UNESCO reconoció "las fiestas indígenas dedicadas a los muertos" de México como Obra Maestra del Patrimonio Oral e Inmaterial de la Humanidad, y en **2008** las inscribió en su lista oficial.' },
      { en: '"Intangible" heritage means living traditions — knowledge, celebrations and skills passed down from grandparents to grandchildren.', es: 'Patrimonio "inmaterial" son las tradiciones vivas: saberes, fiestas y oficios que pasan de los abuelos a los nietos.' },
    ],
    dyk: { en: 'UNESCO lists the tradition of Mexico as a whole — not one single town.', es: 'La UNESCO reconoce la tradición de todo México, no la de un solo pueblo.' },
    src: ['unesco'],
  }),
  // ------------------------------------------------------------ the ofrenda
  c({
    id: 'ofrenda', cat: 'ofrenda', term: 'La ofrenda', title: 'La Ofrenda', say: 'oh-FREN-dah',
    en: { en: 'The offering / home altar' }, pic: { prop: 'mini-ofrenda' },
    text: [
      { en: 'An ofrenda is a welcome table for the souls. Families put out a photo, flowers, candles, water, bread and the favorite things of the person they remember.', es: 'La ofrenda es una mesa de bienvenida para las almas. Las familias ponen una foto, flores, velas, agua, pan y las cosas favoritas de la persona que recuerdan.' },
      { en: 'There is no single right way to make one. It can be one small table or many levels — every region and family does it differently.', es: 'No hay una sola forma correcta. Puede ser una mesita o muchos niveles: cada región y cada familia la hace a su manera.' },
    ],
    dyk: { en: 'Technically "ofrenda" means the offerings themselves, but people use it for the whole altar too.', es: 'En sentido estricto, "ofrenda" son las cosas que se ofrecen, pero también se le dice así a todo el altar.' },
    src: ['britannica-ofrenda', 'inpi-elementos', 'abc13'],
  }),
  c({
    id: 'foto', cat: 'ofrenda', term: 'La foto', title: 'El Retrato', say: 'lah FOH-toh',
    en: { en: 'The photo' }, pic: { prop: 'foto', opts: { portrait: 'abuelo' } },
    text: [
      { en: 'The photo shows who the ofrenda is for. It is often at the top or in the center, the heart of the altar.', es: 'La foto muestra a quién está dedicada la ofrenda. Muchas veces va arriba o en el centro: es el corazón del altar.' },
      { en: 'In some places a mirror is set so the photo can only be seen reflected — the person can be "seen", but is no longer here in body.', es: 'En algunos lugares se pone un espejo para ver la foto reflejada: la persona se "ve", pero ya no está aquí en cuerpo.' },
    ],
    dyk: { en: 'Many families avoid putting photos of living people on the ofrenda.', es: 'Muchas familias evitan poner fotos de personas vivas en la ofrenda.' },
    src: ['inpi-elementos', 'cdi-ofrendas'],
  }),
  c({
    id: 'cempasuchil', cat: 'ofrenda', term: 'Cempasúchil', title: 'El Cempasúchil', say: 'sem-pah-SOO-cheel',
    en: { en: 'Mexican marigold' }, pic: { prop: 'cempasuchil' },
    text: [
      { en: 'The name comes from Nahuatl [[cempōhualxōchitl]]: **"twenty flower"**. This bright orange flower is native to Mexico.', es: 'Su nombre viene del náhuatl [[cempōhualxōchitl]]: **"veinte flor"**. Esta flor anaranjada es originaria de México.' },
      { en: 'Its sunny color and strong smell are said to guide the souls home. Families scatter petal paths from the door — or even from the cemetery — to the ofrenda.', es: 'Se dice que su color de sol y su olor fuerte guían a las almas. Las familias hacen caminos de pétalos desde la puerta —o hasta desde el panteón— hasta la ofrenda.' },
    ],
    dyk: { en: 'Cempasúchil is also used as medicine, as a natural dye, and to keep bugs away from crops.', es: 'El cempasúchil también se usa como medicina, como tinte natural y para alejar plagas de los cultivos.' },
    src: ['semarnat-cempasuchil', 'agricultura-cempasuchil', 'npr-marigolds'],
  }),
  c({
    id: 'velas', cat: 'ofrenda', term: 'Las veladoras', title: 'La Vela', say: 'lahs beh-lah-DOH-rahs',
    en: { en: 'Candles' }, pic: { prop: 'vela', opts: { lit: true } },
    text: [
      { en: 'Light guides the souls home. A [[vela]] is a candle; a [[veladora]] is a candle in a glass; a [[cirio]] is a tall church candle.', es: 'La luz guía a las almas. Una [[vela]] es la de cera; la [[veladora]] va en un vaso; el [[cirio]] es la vela alta de iglesia.' },
      { en: 'In some communities, each candle stands for one person being remembered. Some families place four candles in a cross, for the four directions.', es: 'En algunas comunidades cada vela representa a una persona. Algunas familias ponen cuatro velas en cruz, por los cuatro rumbos.' },
    ],
    dyk: { en: 'Wax candles came with the Spanish. Before that, people used fire from pine torches called ocote.', es: 'Las velas de cera llegaron con los españoles. Antes se usaba el fuego de las rajas de ocote.' },
    src: ['cdi-ofrendas', 'inpi-elementos'],
  }),
  c({
    id: 'copal', cat: 'ofrenda', term: 'El copal', title: 'El Copal', say: 'koh-PAHL',
    en: { en: 'Copal incense' }, pic: { prop: 'copal', opts: { lit: true } },
    text: [
      { en: 'Copal is a fragrant resin from trees. It is burned in a clay [[sahumador]], and its white smoke is said to clean the space and help guide the souls.', es: 'El copal es una resina aromática de árboles. Se quema en un [[sahumador]] de barro, y se dice que su humo blanco limpia el lugar y ayuda a guiar a las almas.' },
      { en: 'Its name comes from Nahuatl copalli. It has been used in ceremonies in Mexico for a very long time.', es: 'Su nombre viene del náhuatl copalli. Se ha usado en ceremonias en México desde hace muchísimo tiempo.' },
    ],
    dyk: { en: 'Archaeologists found lots of copal in the offerings of the Templo Mayor, the great temple of Tenochtitlan.', es: 'Los arqueólogos encontraron mucho copal en las ofrendas del Templo Mayor de Tenochtitlan.' },
    src: ['arqueologia-copal', 'inpi-elementos'],
  }),
  c({
    id: 'agua', cat: 'ofrenda', term: 'El agua', title: 'El Agua', say: 'el AH-gwah',
    en: { en: 'A glass of water' }, pic: { prop: 'agua' },
    text: [
      { en: 'A glass of water is there so the souls can quench their thirst after their long journey.', es: 'El vaso de agua es para que las almas calmen la sed después de su largo viaje.' },
      { en: 'Some people also say water stands for purity and life.', es: 'Algunas personas también dicen que el agua representa la pureza y la vida.' },
    ],
    dyk: { en: 'Some families also leave a basin, soap, a towel and a mirror, so the visitors can freshen up!', es: 'Algunas familias dejan también una palangana, jabón, toalla y espejo, ¡para que los visitantes se refresquen!' },
    src: ['inpi-elementos', 'cdmx-ofrendas'],
  }),
  c({
    id: 'sal', cat: 'ofrenda', term: 'La sal', title: 'La Sal', say: 'lah SAHL',
    en: { en: 'Salt' }, pic: { prop: 'sal' },
    text: [
      { en: 'A little dish of salt is a common part of the ofrenda. It stands for purification.', es: 'Un platito de sal es parte común de la ofrenda. Representa la purificación.' },
      { en: 'A common explanation is that the salt keeps the soul from being "spoiled" on its journey there and back.', es: 'Una explicación común es que la sal protege al alma para que no se "corrompa" en su viaje de ida y vuelta.' },
    ],
    dyk: { en: 'Some families make a cross out of salt.', es: 'Algunas familias forman una cruz de sal.' },
    src: ['inpi-elementos', 'sep-ofrenda'],
  }),
  c({
    id: 'papel', cat: 'ofrenda', term: 'Papel picado', title: 'El Papel Picado', say: 'pah-PEL pee-KAH-doh',
    en: { en: 'Cut-paper banners' }, pic: { prop: 'papelito' },
    text: [
      { en: 'Papel picado is [[papel de China]] (tissue paper) cut into lacy designs. Artisans stack dozens of sheets and cut them all at once with a [[cincel]] (chisel) and a mallet.', es: 'El papel picado es [[papel de China]] recortado con diseños calados. Los artesanos apilan decenas de hojas y las cortan todas a la vez con [[cincel]] y mazo.' },
      { en: 'On the ofrenda it is often said to stand for **wind** or air — and its fluttering makes everything feel like a fiesta.', es: 'En la ofrenda se dice que representa el **viento** o el aire, y al moverse llena todo de fiesta.' },
    ],
    dyk: { en: 'San Salvador [[Huixcolotla]], Puebla, is the most famous papel picado town. Its handmade papel picado was declared cultural heritage of Puebla in 1998.', es: 'San Salvador [[Huixcolotla]], Puebla, es el pueblo más famoso del papel picado. Su papel picado artesanal fue declarado patrimonio cultural de Puebla en 1998.' },
    src: ['mexdesconocido-papel', 'milenio-papel', 'inpi-elementos'],
  }),
  c({
    id: 'colores', cat: 'simbolos', term: '¿Los colores significan algo?', title: 'Los Colores', say: '',
    en: { en: 'Do the colors have meanings?' }, pic: { prop: 'papelito', opts: { color: '#7b3fbf' } },
    text: [
      { en: 'You may read online that each papel picado color has a fixed meaning. But the lists don\'t agree with each other, and historians haven\'t found an old traditional color code.', es: 'Tal vez leas en internet que cada color del papel picado tiene un significado fijo. Pero las listas no coinciden entre sí y no se ha encontrado un código tradicional antiguo.' },
      { en: 'Families simply choose bright, happy colors — and some like purple for mourning or orange like the marigolds.', es: 'Las familias eligen colores alegres; a algunas les gusta el morado por el luto o el naranja como el cempasúchil.' },
    ],
    dyk: { en: 'Checking whether a "fact" really has a source is what historians do every day!', es: '¡Revisar si un "dato" de verdad tiene fuente es lo que hacen los historiadores todos los días!' },
    src: ['informador-colores'],
  }),
  c({
    id: 'pan', cat: 'comida', term: 'Pan de muerto', title: 'El Pan', say: 'PAHN deh MWEHR-toh',
    en: { en: 'Bread of the dead' }, pic: { prop: 'pan' },
    text: [
      { en: 'A round sweet bread, often flavored with orange blossom, with dough strips on top shaped like bones and a little ball in the middle.', es: 'Pan dulce redondo, muchas veces con sabor a azahar, con tiras de masa encima en forma de huesos y una bolita al centro.' },
      { en: 'Many people say the ball is a skull (or a heart, or a tear), the strips are bones or tears, and the round shape is the circle of life. Meanings change from place to place.', es: 'Mucha gente dice que la bolita es el cráneo (o un corazón, o una lágrima), las tiras son huesos o lágrimas y la forma redonda es el ciclo de la vida. Los significados cambian según el lugar.' },
    ],
    dyk: { en: 'Some bakers call the little ball "la nariz" — the nose! In Oaxaca, pan de yema often has a little painted face called a carita.', es: 'Algunos panaderos le dicen a la bolita "la nariz". En Oaxaca, el pan de yema lleva muchas veces una carita pintada.' },
    src: ['eluniversal-pan', 'unam-pan', 'oaxaca-caritas'],
  }),
  c({
    id: 'calavera', cat: 'comida', term: 'Calavera de azúcar', title: 'La Calavera', say: 'kah-lah-BEH-rah deh ah-SOO-kahr',
    en: { en: 'Sugar skull' }, pic: { prop: 'calavera' },
    text: [
      { en: 'Sugar skulls are made with [[alfeñique]], a sugar-paste technique with Arabic roots that came to Mexico from Spain. Mexican artisans made it their own.', es: 'Las calaveritas se hacen con [[alfeñique]], una técnica de pasta de azúcar de origen árabe que llegó de España. Los artesanos mexicanos la hicieron suya.' },
      { en: 'Names are often written on the forehead — of the person being remembered, or of friends, as a funny gift!', es: 'Muchas veces se escribe un nombre en la frente: el de la persona que se recuerda, ¡o el de un amigo, como regalo chistoso!' },
    ],
    dyk: { en: 'Toluca, in the State of Mexico, holds a famous sugar-figure fair: the Feria del Alfeñique. Today there are also skulls of chocolate and of amaranth (alegría).', es: 'En Toluca, Estado de México, se hace la famosa Feria del Alfeñique. Hoy también hay calaveras de chocolate y de amaranto (alegría).' },
    src: ['toluca-alfenique', 'agricultura-calaverita', 'brandes'],
  }),
  c({
    id: 'fruta', cat: 'comida', term: 'La fruta', title: 'La Fruta', say: 'lah FROO-tah',
    en: { en: 'Seasonal fruit' }, pic: { prop: 'fruta' },
    text: [
      { en: 'Ofrendas hold fruit of the season: oranges, mandarins, guavas, [[tejocote]]s, bananas and pieces of sugarcane ([[caña]]).', es: 'En la ofrenda va fruta de temporada: naranjas, mandarinas, guayabas, [[tejocote]]s, plátanos y trozos de [[caña]].' },
      { en: 'The fruit follows the local harvest, so it changes from region to region.', es: 'La fruta sigue la cosecha de cada lugar, así que cambia de región en región.' },
    ],
    dyk: { en: 'Oranges and sugarcane came from the Old World; tejocotes and guavas grew here long before.', es: 'Las naranjas y la caña llegaron de otros continentes; los tejocotes y las guayabas crecían aquí desde mucho antes.' },
    src: ['profeco', 'agricultura-platillos'],
  }),
  c({
    id: 'mole', cat: 'comida', term: 'Mole', title: 'El Mole', say: 'MOH-leh',
    en: { en: 'A rich chile sauce' }, pic: { prop: 'mole' },
    text: [
      { en: 'Mole (from Nahuatl mōlli, "sauce") is a celebration dish made with chiles and lots of spices, often served with chicken or turkey.', es: 'El mole (del náhuatl mōlli, "salsa") es un platillo de fiesta hecho con chiles y muchas especias, casi siempre con pollo o guajolote.' },
      { en: 'It mixes ingredients from the Americas, like chiles and cacao, with spices from other continents.', es: 'Mezcla ingredientes de América, como chile y cacao, con especias de otros continentes.' },
    ],
    dyk: { en: 'Each region has its own moles — Oaxaca alone is famous for many!', es: 'Cada región tiene sus moles; ¡Oaxaca es famosa por tener muchos!' },
    src: ['agricultura-platillos'],
  }),
  c({
    id: 'tamales', cat: 'comida', term: 'Tamales y corundas', title: 'Los Tamales', say: 'tah-MAH-lehs',
    en: { en: 'Tamales' }, pic: { prop: 'tamales' },
    text: [
      { en: 'Tamales (from Nahuatl tamalli) are corn dough steamed in a husk or leaf. Mexico\'s agriculture ministry calls them a food that "can\'t be missing" from an ofrenda.', es: 'Los tamales (del náhuatl tamalli) son masa de maíz cocida al vapor en hoja. La Secretaría de Agricultura dice que "no pueden faltar" en la ofrenda.' },
      { en: 'In Michoacán, families make [[corundas]]: triangle-shaped tamales wrapped in corn plant leaves.', es: 'En Michoacán se hacen [[corundas]]: tamales en forma de triángulo envueltos en hoja de milpa.' },
    ],
    dyk: { en: 'Many families believe the souls enjoy the steam and smell of hot food — that is why it is served fresh.', es: 'Muchas familias creen que las almas disfrutan el vapor y el olor de la comida caliente; por eso se sirve recién hecha.' },
    src: ['agricultura-platillos', 'inpi-elementos'],
  }),
  c({
    id: 'bebidas', cat: 'comida', term: 'Atole y chocolate', title: 'El Atole', say: 'ah-TOH-leh',
    en: { en: 'Warm drinks' }, pic: { prop: 'chocolate' },
    text: [
      { en: '[[atole]] is a warm, thick corn drink (from Nahuatl atōlli). With chocolate, it\'s called [[champurrado]]. Hot chocolate and [[café de olla]] are favorites too.', es: 'El [[atole]] es una bebida caliente y espesa de maíz (del náhuatl atōlli). Con chocolate se llama [[champurrado]]. El chocolate caliente y el [[café de olla]] también son favoritos.' },
      { en: 'People drank corn and cacao drinks long before the Spanish came; sugar and milk were added later.', es: 'Se tomaban bebidas de maíz y cacao mucho antes de que llegaran los españoles; el azúcar y la leche se añadieron después.' },
    ],
    dyk: { en: 'For grown-ups, some families also set out whatever drink the person liked. Children\'s ofrendas get milk, atole or juice.', es: 'Para los adultos, algunas familias ponen la bebida que le gustaba a la persona. A los niños se les pone leche, atole o jugo.' },
    src: ['elfinanciero-champurrado', 'agricultura-platillos', 'matador-bebidas'],
  }),
  c({
    id: 'calabaza', cat: 'comida', term: 'Calabaza en tacha', title: 'La Calabaza', say: 'kah-lah-BAH-sah en TAH-chah',
    en: { en: 'Candied pumpkin' }, pic: { prop: 'calabaza' },
    text: [
      { en: 'Pumpkin or squash cooked slowly in syrup of [[piloncillo]] (cane sugar) and cinnamon. It is a classic sweet on ofrendas in central Mexico.', es: 'Calabaza cocida lentamente en miel de [[piloncillo]] y canela. Es un dulce clásico de las ofrendas del centro de México.' },
      { en: 'Its name comes from the "tachos", big copper pots used in old sugar mills.', es: 'Su nombre viene de los "tachos", grandes cazos de cobre de los antiguos trapiches.' },
    ],
    dyk: { en: 'Squash has been grown in Mexico for thousands of years.', es: 'La calabaza se cultiva en México desde hace miles de años.' },
    src: ['mnd-calabaza', 'profeco'],
  }),
  c({
    id: 'terciopelo', cat: 'ofrenda', term: 'Terciopelo', title: 'El Terciopelo', say: 'tehr-see-oh-PEH-loh',
    en: { en: 'Cockscomb flower' }, pic: { prop: 'terciopelo' },
    text: [
      { en: 'A velvety, deep red-purple flower, also called mano de león ("lion\'s paw") or cresta de gallo.', es: 'Flor aterciopelada de color rojo morado, también llamada mano de león o cresta de gallo.' },
      { en: 'Its deep color is often said to stand for mourning; others say it brings comfort. Meanings vary.', es: 'Se dice que su color profundo representa el luto; otros dicen que da consuelo. Los significados varían.' },
    ],
    dyk: { en: 'White flowers like [[nube]] (baby\'s breath) are often used on children\'s ofrendas.', es: 'Las flores blancas como la [[nube]] se usan mucho en las ofrendas de los niños.' },
    src: ['agricultura-flores', 'mexdesconocido-flores'],
  }),
  c({
    id: 'arco', cat: 'ofrenda', term: 'El arco', title: 'El Arco', say: 'AHR-koh',
    en: { en: 'The flower arch' }, pic: { prop: 'arco' },
    text: [
      { en: 'Many ofrendas have an arch of reed, palm or sugarcane covered in marigolds. It is often explained as the **doorway between the world of the living and the world of the dead**.', es: 'Muchas ofrendas tienen un arco de carrizo, palma o caña cubierto de cempasúchil. Se explica como la **puerta entre el mundo de los vivos y el de los muertos**.' },
      { en: 'In the [[Purépecha]] region of Michoacán, families hang bread, fruit and sugar figures from a wooden frame.', es: 'En la región [[Purépecha]] de Michoacán, las familias cuelgan pan, fruta y figuras de azúcar de un armazón de madera.' },
    ],
    dyk: { en: 'In the Huasteca, a study counted 27 different plants used to decorate the arches!', es: 'En la Huasteca, un estudio contó ¡27 plantas distintas para adornar los arcos!' },
    src: ['etnobiologia-arcos', 'secum-ofrenda'],
  }),
  c({
    id: 'petate', cat: 'ofrenda', term: 'El petate', title: 'El Petate', say: 'peh-TAH-teh',
    en: { en: 'Woven palm mat' }, pic: { prop: 'petate' },
    text: [
      { en: 'Some families place a palm mat under the ofrenda. It is said to give the souls a place to rest after their journey.', es: 'Algunas familias ponen un petate bajo la ofrenda. Se dice que es para que las almas descansen después del viaje.' },
      { en: 'It can also serve as the tablecloth for the food.', es: 'También puede servir de mantel para la comida.' },
    ],
    dyk: { en: 'Petates have been woven in Mexico since long before the Spanish arrived.', es: 'Los petates se tejen en México desde mucho antes de la llegada de los españoles.' },
    src: ['cdi-ofrendas', 'cdmx-ofrendas'],
  }),
  c({
    id: 'lavamanos', cat: 'ofrenda', term: 'Agua, jabón y espejo', title: 'El Espejo', say: '',
    en: { en: 'Basin, soap, towel & mirror' }, pic: { prop: 'lavamanos' },
    text: [
      { en: 'Some families leave a basin of water, soap and a towel so the visiting souls can wash up after the long trip.', es: 'Algunas familias dejan agua, jabón y una toalla para que las almas se laven después del largo viaje.' },
      { en: 'A mirror sometimes reflects the photo. In Huaquechula, Puebla, the mirror is said to reflect the soul.', es: 'A veces un espejo refleja la foto. En Huaquechula, Puebla, se dice que el espejo refleja el alma.' },
    ],
    dyk: { en: 'Ofrendas treat the dead like honored guests arriving at home.', es: 'La ofrenda trata a los difuntos como invitados de honor que llegan a casa.' },
    src: ['inpi-elementos', 'cdi-ofrendas', 'mexdesconocido-huaquechula'],
  }),
  c({
    id: 'cruz', cat: 'ofrenda', term: 'La cruz', title: 'La Cruz', say: 'lah KROOS',
    en: { en: 'Cross & religious images' }, pic: { prop: 'cruz' },
    text: [
      { en: 'Many Catholic families add a cross, images of saints or the Virgin of Guadalupe, and say prayers for their loved ones.', es: 'Muchas familias católicas ponen una cruz, imágenes de santos o de la Virgen de Guadalupe, y rezan por sus seres queridos.' },
      { en: 'Crosses can be made of flowers, palm, salt or ash. Other families, of other beliefs, simply remember with love.', es: 'Las cruces pueden ser de flores, palma, sal o ceniza. Otras familias, de otras creencias, simplemente recuerdan con cariño.' },
    ],
    dyk: { en: 'In Yucatán, a green cross can stand for the sacred ceiba tree of the Maya.', es: 'En Yucatán, una cruz verde puede representar a la ceiba, árbol sagrado de los mayas.' },
    src: ['nmma-arts', 'catholic-news'],
  }),
  c({
    id: 'xolo', cat: 'simbolos', term: 'Xoloitzcuintle', title: 'El Xolo', say: 'shoh-loh-eets-KWEEN-tleh',
    en: { en: 'The Mexican hairless dog' }, pic: { char: 'chispa' },
    text: [
      { en: 'The Xolo is Mexico\'s ancient hairless dog. Its name joins [[Xólotl|Xolo]] — a dog-headed god — and itzcuintli, "dog".', es: 'El Xolo es el antiguo perro sin pelo de México. Su nombre une a Xólotl —un dios con cabeza de perro— e itzcuintli, "perro".' },
      { en: 'Dogs were sometimes buried with people as guides for the journey to [[Mictlán]]. Today many families put a clay Xolo on the ofrenda.', es: 'A veces se enterraba a perros junto con las personas para guiarlas en su viaje al [[Mictlán]]. Hoy muchas familias ponen un Xolo de barro en la ofrenda.' },
    ],
    dyk: { en: 'Clay dog figures made more than 2,000 years ago have been found in ancient tombs in western Mexico.', es: 'En tumbas antiguas del occidente de México se han encontrado figuras de perros de barro de hace más de 2,000 años.' },
    src: ['inah-xolo', 'arqueologia-perro', 'museumofthedog'],
  }),
  c({
    id: 'personales', cat: 'ofrenda', term: 'Sus cosas favoritas', title: 'Los Recuerdos', say: '',
    en: { en: 'Their favorite things' }, pic: { prop: 'guitarra' },
    text: [
      { en: 'Families add things the person loved: a hat, their tools, a musical instrument, their glasses, a book, a game.', es: 'Las familias ponen cosas que la persona quería: su sombrero, sus herramientas, un instrumento, sus lentes, un libro, un juego.' },
      { en: 'These objects make the ofrenda unique — it tells the story of one special person.', es: 'Estos objetos hacen única a la ofrenda: cuentan la historia de una persona especial.' },
    ],
    dyk: { en: 'Some ofrendas have pizza, soda or a favorite candy — whatever the person really loved!', es: 'Hay ofrendas con pizza, refresco o el dulce favorito: ¡lo que de verdad le gustaba a la persona!' },
    src: ['gob-inafed', 'smithsonian-objects'],
  }),
  c({
    id: 'favoritos', cat: 'ofrenda', term: 'Lo que más le gustaba', title: 'El Antojo', say: '',
    en: { en: 'Favorite foods' }, pic: { prop: 'pizza' },
    text: [
      { en: 'An ofrenda welcomes a real person, so it holds their real favorites. If Grandpa loved pizza and soda, those can go on the ofrenda next to the pan de muerto.', es: 'La ofrenda recibe a una persona real, así que lleva sus gustos reales. Si al abuelo le encantaban la pizza y el refresco, pueden ir junto al pan de muerto.' },
      { en: 'That is why no two ofrendas are the same.', es: 'Por eso no hay dos ofrendas iguales.' },
    ],
    dyk: { en: 'Children\'s ofrendas often have candy, milk and mild (not spicy) food.', es: 'Las ofrendas para niños suelen tener dulces, leche y comida sin chile.' },
    src: ['agricultura-platillos', 'gob-inafed'],
  }),
  c({
    id: 'juguetes', cat: 'ofrenda', term: 'Los angelitos', title: 'Los Angelitos', say: 'ahn-heh-LEE-tohs',
    en: { en: 'Remembering children' }, pic: { prop: 'juguetes' },
    text: [
      { en: 'In many places, the souls of children — the [[angelitos]] — are remembered on November 1, with toys, candy, milk and white flowers.', es: 'En muchos lugares, a las almas de los niños —los [[angelitos]]— se les recuerda el 1 de noviembre, con juguetes, dulces, leche y flores blancas.' },
      { en: 'Each family remembers its own loved ones, of every age, with tenderness.', es: 'Cada familia recuerda con ternura a sus seres queridos de todas las edades.' },
    ],
    dyk: { en: 'In some Michoacán towns, the vigil for the children has its own name: [[Kejtzitakua Zapicheri]].', es: 'En algunos pueblos de Michoacán, la velación de los niños tiene su propio nombre: [[Kejtzitakua Zapicheri]].' },
    src: ['gob-inafed', 'secum-ofrenda'],
  }),
  c({
    id: 'niveles', cat: 'ofrenda', term: 'Los niveles', title: 'Los Escalones', say: '',
    en: { en: 'Levels of the ofrenda' }, pic: { prop: 'mini-ofrenda', opts: { levels: 3 } },
    text: [
      { en: 'Some ofrendas are one table; others have 2, 3 or even 7 steps. People explain them in different ways: two levels for heaven and earth; three for heaven, earth and the underworld (or the Holy Trinity); seven for the steps of the soul\'s journey.', es: 'Algunas ofrendas son una mesa; otras tienen 2, 3 o hasta 7 escalones. Se explican de muchas formas: dos niveles por el cielo y la tierra; tres por cielo, tierra e inframundo (o la Santísima Trinidad); siete por los pasos del viaje del alma.' },
      { en: 'These explanations are fairly modern and don\'t always agree — so there is no wrong number!', es: 'Estas explicaciones son bastante modernas y no siempre coinciden, ¡así que no hay un número equivocado!' },
    ],
    dyk: { en: 'In Huaquechula, Puebla, ofrendas for people who died during the past year can be 3 to 5 meters tall!', es: 'En Huaquechula, Puebla, las ofrendas para quienes murieron ese año ¡pueden medir de 3 a 5 metros!' },
    src: ['grace-museum', 'unam-cendi', 'mexdesconocido-huaquechula'],
  }),
  c({
    id: 'elementos', cat: 'ofrenda', term: 'Los cuatro elementos', title: 'Los Elementos', say: '',
    en: { en: 'Earth, wind, water, fire' }, pic: { prop: 'elementos' },
    text: [
      { en: 'One popular way to explain an ofrenda: it holds the four elements. **Earth** is the food, **wind** is the papel picado, **water** is the glass of water, and **fire** is the candles.', es: 'Una forma popular de explicar la ofrenda: tiene los cuatro elementos. La **tierra** es la comida, el **viento** el papel picado, el **agua** el vaso de agua y el **fuego** las velas.' },
      { en: 'It\'s a helpful way to remember the parts — but it\'s a modern explanation, not an ancient rule.', es: 'Es una buena forma de recordar las partes, pero es una explicación moderna, no una regla antigua.' },
    ],
    dyk: { en: 'Some people say copal smoke is the wind, too.', es: 'Hay quien dice que el humo del copal también es el viento.' },
    src: ['grace-museum'],
  }),
  // ------------------------------------------------------------ symbols & art
  c({
    id: 'monarca', cat: 'simbolos', term: 'Mariposa monarca', title: 'La Monarca', say: 'mah-ree-POH-sah moh-NAHR-kah',
    en: { en: 'Monarch butterfly' }, pic: { prop: 'mariposa' },
    text: [
      { en: 'Every year millions of monarch butterflies fly more than 4,000 km from Canada and the US to the fir forests of Michoacán and the State of Mexico. They arrive around late October and early November.', es: 'Cada año millones de mariposas monarca vuelan más de 4,000 km desde Canadá y Estados Unidos hasta los bosques de oyamel de Michoacán y el Estado de México. Llegan entre finales de octubre y principios de noviembre.' },
      { en: 'Among the [[Purépecha]], Mazahua and Matlatzinca peoples, the monarchs are said to be — or to carry — the souls of the dead coming to visit.', es: 'Entre los pueblos [[Purépecha]], mazahua y matlatzinca se dice que las monarcas son —o llevan— las almas de los muertos que vienen de visita.' },
    ],
    dyk: { en: 'Some families say you shouldn\'t shoo away a butterfly that visits on November 1 or 2.', es: 'Algunas familias dicen que no hay que espantar a una mariposa que llega el 1 o el 2 de noviembre.' },
    src: ['semarnat-monarcas', 'inpi-mazahua', 'inah-monarca'],
  }),
  c({
    id: 'catrina', cat: 'simbolos', term: 'La Catrina', title: 'La Catrina', say: 'kah-TREE-nah',
    en: { en: 'The elegant skeleton lady' }, pic: { prop: 'catrina' },
    text: [
      { en: 'Around 1910–1913, printmaker José Guadalupe Posada made a skeleton lady wearing nothing but a fancy French hat: "La Calavera [[garbancera]]". It made fun of people who pretended to be rich Europeans and hid their roots.', es: 'Hacia 1910–1913, el grabador José Guadalupe Posada hizo una calavera de mujer con un sombrero francés muy elegante: "La Calavera [[garbancera]]". Se burlaba de quienes fingían ser europeos ricos y negaban sus raíces.' },
      { en: 'In 1946–47, Diego Rivera painted her full-length in his mural "Dream of a Sunday Afternoon in the Alameda Central" and the name **Catrina** stuck.', es: 'En 1946–47, Diego Rivera la pintó de cuerpo entero en su mural "Sueño de una tarde dominical en la Alameda Central", y se quedó con el nombre de **Catrina**.' },
    ],
    dyk: { en: 'In Rivera\'s mural she holds the hand of Rivera as a boy, walks arm-in-arm with Posada — and Frida Kahlo stands right behind them.', es: 'En el mural de Rivera, ella toma de la mano a Rivera de niño, va del brazo de Posada, ¡y Frida Kahlo está justo detrás!' },
    src: ['clark-posada', 'mexdesconocido-mural', 'britannica-catrina'],
  }),
  c({
    id: 'posada', cat: 'simbolos', term: 'José Guadalupe Posada', title: 'El Grabador', say: 'hoh-SEH gwah-dah-LOO-peh poh-SAH-dah',
    en: { en: 'The printmaker of the calaveras' }, pic: { prop: 'grabado' },
    text: [
      { en: 'Posada (born in Aguascalientes in 1852, died in Mexico City in 1913) carved thousands of pictures for cheap newspapers and broadsides — many of them lively skeletons dancing, cooking and riding bicycles.', es: 'Posada (nació en Aguascalientes en 1852 y murió en la Ciudad de México en 1913) grabó miles de imágenes para periódicos y hojas sueltas, muchas de calaveras que bailan, cocinan y andan en bicicleta.' },
      { en: 'Other writers wrote the verses printed next to his pictures. His skeletons showed that everyone — rich or poor — ends up a skull in the end.', es: 'Otros escritores hacían los versos que acompañaban sus imágenes. Sus calaveras mostraban que todos —ricos o pobres— terminamos igual.' },
    ],
    dyk: { en: 'A famous saying, "Death is democratic", is often credited to Posada — but no one has found where he said it.', es: 'La frase "La muerte es democrática" se le atribuye mucho a Posada, pero nadie ha encontrado dónde la dijo.' },
    src: ['britannica-posada', 'clark-posada', 'wiki-catrina'],
  }),
  c({
    id: 'calaveritas', cat: 'simbolos', term: 'Calaveritas literarias', title: 'La Calaverita', say: 'kah-lah-beh-REE-tahs lee-teh-RAH-ree-ahs',
    en: { en: 'Funny skull poems' }, pic: { prop: 'pergamino' },
    text: [
      { en: 'Calaveritas are short, funny rhyming poems that imagine Death (often called "la Flaca", the skinny one) coming for a **living** person — and teasing their habits with affection.', es: 'Las calaveritas son versos cortos y chistosos que imaginan que la Muerte ("la Flaca") viene por una persona **viva**, y bromean con cariño sobre sus costumbres.' },
      { en: 'They began in satirical newspapers in the 1800s. Today kids write them in school about teachers, friends and family.', es: 'Nacieron en periódicos satíricos del siglo XIX. Hoy los niños las escriben en la escuela sobre maestros, amigos y familia.' },
    ],
    dyk: { en: 'Mexico\'s education ministry holds a national calaverita contest, where students write about figures from Mexican history.', es: 'La SEP organiza un concurso nacional de calaveritas, donde los alumnos escriben sobre personajes de la historia de México.' },
    src: ['smithsonian-calaveras', 'gob-calaveras', 'sep-concurso'],
  }),
  c({
    id: 'alebrije', cat: 'simbolos', term: 'Alebrijes', title: 'El Alebrije', say: 'ah-leh-BREE-hehs',
    en: { en: 'Fantasy creatures (modern art)' }, pic: { prop: 'alebrije' },
    text: [
      { en: 'Alebrijes were invented in **1936** by Pedro Linares, a papier-mâché artist in Mexico City, after a dream he had while very sick. Oaxacan woodcarvers later made them in copal wood.', es: 'Los alebrijes los inventó en **1936** Pedro Linares, cartonero de la Ciudad de México, después de un sueño que tuvo estando muy enfermo. Después, talladores de Oaxaca los hicieron en madera de copal.' },
      { en: 'They are amazing Mexican folk art — but they are not an old part of Día de Muertos. The movie "Coco" (2017) made them spirit guides; that idea is from the film.', es: 'Son un arte popular mexicano increíble, pero no son parte antigua del Día de Muertos. La película "Coco" (2017) los volvió guías de las almas; esa idea es de la película.' },
    ],
    dyk: { en: 'Since 2007, a parade of giant alebrijes fills Mexico City every October.', es: 'Desde 2007, un desfile de alebrijes gigantes recorre la Ciudad de México cada octubre.' },
    src: ['wiki-linares', 'wiki-alebrije-parade'],
  }),
  // ------------------------------------------------------------ customs
  c({
    id: 'panteon', cat: 'costumbres', term: 'El panteón', title: 'El Panteón', say: 'pahn-teh-OHN',
    en: { en: 'At the cemetery' }, pic: { prop: 'tumba' },
    text: [
      { en: 'Families go to the cemetery to clean the graves, pull the weeds, and decorate them with marigolds, candles and sometimes a small ofrenda of food.', es: 'Las familias van al panteón a limpiar las tumbas, quitar la hierba y adornarlas con cempasúchil, velas y a veces una pequeña ofrenda de comida.' },
      { en: 'It feels like a big family gathering: people talk, eat, listen to music and greet their neighbors.', es: 'Parece una gran reunión familiar: se platica, se come, se escucha música y se saluda a los vecinos.' },
    ],
    dyk: { en: 'Good manners at a cemetery: speak softly near people who are praying, never step on graves, and ask before taking photos.', es: 'Buenos modales en el panteón: hablar bajito cerca de quien reza, no pisar las tumbas y pedir permiso antes de tomar fotos.' },
    src: ['unesco', 'oaxacaculture-respect'],
  }),
  c({
    id: 'velacion', cat: 'costumbres', term: 'La velación', title: 'La Velación', say: 'beh-lah-see-OHN',
    en: { en: 'The all-night vigil' }, pic: { prop: 'canoa' },
    text: [
      { en: 'In many towns, families stay at the grave all night with candles lit, keeping their loved ones company.', es: 'En muchos pueblos, las familias se quedan toda la noche junto a la tumba, con las velas encendidas, acompañando a sus seres queridos.' },
      { en: 'Around Lake [[Pátzcuaro]], Michoacán, the [[Purépecha]] call the ceremony [[Animecha Kejtzitakua]] — "offering for the souls". On the island of [[Janitzio]], the main vigil is the night of November 1 to 2.', es: 'Alrededor del lago de [[Pátzcuaro]], Michoacán, los [[Purépecha]] llaman a la ceremonia [[Animecha Kejtzitakua]]: "ofrenda para las ánimas". En la isla de [[Janitzio]], la velación principal es la noche del 1 al 2 de noviembre.' },
    ],
    dyk: { en: 'Families used to arrive at Janitzio by canoe, with candles lighting the dark lake.', es: 'Antes, las familias llegaban a Janitzio en canoa, con velas iluminando el lago oscuro.' },
    src: ['secum-animas', 'secum-ofrenda'],
  }),
  c({
    id: 'pedir', cat: 'costumbres', term: '¿Me da mi calaverita?', title: 'El Pedido', say: 'meh DAH mee kah-lah-beh-REE-tah',
    en: { en: '"Will you give me my little skull?"' }, pic: { char: 'nico' },
    text: [
      { en: 'From about October 31 to November 2, kids in many towns go door to door asking "¿Me da mi calaverita?" — and get candy, fruit, bread or coins.', es: 'Entre el 31 de octubre y el 2 de noviembre, en muchos pueblos los niños van de casa en casa preguntando "¿Me da mi calaverita?", y reciben dulces, fruta, pan o monedas.' },
      { en: 'Long ago they carried lanterns made from hollowed squash with a candle inside. Nobody knows exactly how the custom began.', es: 'Antes llevaban linternas hechas de chilacayote con una vela adentro. Nadie sabe con exactitud cómo empezó.' },
    ],
    dyk: { en: 'In Mixquic, kids called campaneros ring a bell, pray at ofrendas and receive bread, fruit or tamales.', es: 'En Mixquic, los niños campaneros tocan una campana, rezan ante las ofrendas y reciben pan, fruta o tamales.' },
    src: ['mexdesconocido-calaverita', 'infobae-calaverita'],
  }),
  c({
    id: 'despues', cat: 'costumbres', term: '¿Y la comida?', title: 'El Banquete', say: '',
    en: { en: 'What happens to the food?' }, pic: { prop: 'tamales' },
    text: [
      { en: 'Many families believe the souls don\'t eat the food — they take in its **essence**: the smell and the steam.', es: 'Muchas familias creen que las almas no se comen la comida: toman su **esencia**, el olor y el vapor.' },
      { en: 'When the visit ends, families share the food with relatives and neighbors. Some say it has lost its flavor!', es: 'Al terminar la visita, las familias comparten la comida con parientes y vecinos. ¡Hay quien dice que ya perdió su sabor!' },
    ],
    dyk: { en: 'In Naupan, Puebla, people set bread over hot coffee so the steam soaks it for the souls.', es: 'En Naupan, Puebla, ponen el pan sobre el café caliente para que el vapor lo empape para las almas.' },
    src: ['inpi-elementos', 'ecn-comer'],
  }),
  c({
    id: 'mascotas', cat: 'costumbres', term: 'Ofrendas para mascotas', title: 'La Mascota', say: '',
    en: { en: 'Ofrendas for pets (a new custom)' }, pic: { prop: 'plato' },
    text: [
      { en: 'Some families now make a small ofrenda for a beloved pet, with its photo, toys, food and marigolds.', es: 'Algunas familias ahora ponen una ofrenda pequeña para su mascota, con su foto, juguetes, comida y cempasúchil.' },
      { en: 'This is a **new** custom: setting aside October 27 for pets became popular only around 2019, mostly through social media.', es: 'Es una costumbre **nueva**: dedicar el 27 de octubre a las mascotas se hizo popular apenas hacia 2019, sobre todo por las redes sociales.' },
    ],
    dyk: { en: 'Traditions are alive — people keep adding new ways to remember.', es: 'Las tradiciones están vivas: la gente sigue creando nuevas formas de recordar.' },
    src: ['infobae-mascotas', 'milenio-mascotas'],
  }),
  c({
    id: 'comunitaria', cat: 'costumbres', term: 'Ofrendas comunitarias', title: 'La Comunidad', say: '',
    en: { en: 'Ofrendas for a whole town' }, pic: { prop: 'mini-ofrenda', opts: { levels: 2 } },
    text: [
      { en: 'Schools, offices, museums and town squares also set up ofrendas, often for famous people or for people the whole community misses.', es: 'Escuelas, oficinas, museos y plazas también ponen ofrendas, muchas veces para personajes famosos o para personas que toda la comunidad extraña.' },
      { en: 'Building one together is a way of learning history and sharing memories.', es: 'Hacer una juntos es una forma de aprender historia y compartir recuerdos.' },
    ],
    dyk: { en: 'UNAM, Mexico\'s national university, has held a giant "Megaofrenda" every year since 1997.', es: 'La UNAM organiza cada año, desde 1997, una gigantesca Megaofrenda.' },
    src: ['chilango-megaofrenda'],
  }),
  c({
    id: 'catrinas', cat: 'costumbres', term: 'Concurso de Catrinas', title: 'El Catrín', say: '',
    en: { en: 'Dressing up as Catrinas' }, pic: { prop: 'catrina' },
    text: [
      { en: 'Dressing up as elegant Catrinas and Catrines, with painted skull faces, is a popular **modern** festival custom — joking with death, Posada-style.', es: 'Vestirse de Catrinas y Catrines elegantes, con la cara pintada de calavera, es una costumbre **moderna** de los festivales: bromear con la muerte al estilo de Posada.' },
      { en: 'It\'s part of the celebration, not the ritual core. It\'s respectful when it honors the holiday — never as a scary or silly costume.', es: 'Es parte de la fiesta, no el centro del ritual. Es respetuoso cuando honra la tradición, nunca como disfraz de miedo o de burla.' },
    ],
    dyk: { en: 'Mexico City\'s big Day of the Dead parade only began in 2016 — inspired by a scene in a James Bond movie!', es: 'El gran desfile de Día de Muertos de la Ciudad de México empezó apenas en 2016, ¡inspirado en una escena de una película de James Bond!' },
    src: ['eluniversal-desfile', 'refinery-makeup'],
  }),
  // ------------------------------------------------------------ around Mexico
  c({
    id: 'hanal', cat: 'lugares', term: 'Hanal Pixán', title: 'El Hanal Pixán', say: 'hah-NAHL pee-SHAHN',
    en: { en: 'Yucatán: "food of the souls"' }, pic: { prop: 'mucbipollo' },
    text: [
      { en: 'In Yucatán, the Maya celebration is called Hanal Pixán: "food of the souls". Children are remembered on October 31, adults on November 1, and all souls on November 2.', es: 'En Yucatán, la celebración maya se llama Hanal Pixán: "comida de las almas". El 31 de octubre es de los niños, el 1 de noviembre de los adultos y el 2 de todas las almas.' },
      { en: 'The star dish is [[mucbipollo]]: a giant tamal wrapped in banana leaves and cooked underground in an earth oven called a pib.', es: 'El platillo estrella es el [[mucbipollo]]: un tamal gigante envuelto en hoja de plátano y cocido bajo tierra en un horno llamado pib.' },
    ],
    dyk: { en: 'Eight days later, some families make one more offering to say goodbye: the bix.', es: 'Ocho días después, algunas familias hacen otra ofrenda de despedida: el bix.' },
    src: ['merida-animas', 'poresto-bix', 'larousse-pib'],
  }),
  c({
    id: 'xantolo', cat: 'lugares', term: 'Xantolo', title: 'El Xantolo', say: 'shahn-TOH-loh',
    en: { en: 'The Huasteca celebration' }, pic: { prop: 'arco' },
    text: [
      { en: 'In the Huasteca (parts of San Luis Potosí, Hidalgo, Veracruz and nearby states), Nahua and Teenek communities celebrate Xantolo with huge flower arches and dancers called huehues ("old ones") who go from house to house.', es: 'En la Huasteca (partes de San Luis Potosí, Hidalgo, Veracruz y estados vecinos), las comunidades nahuas y teenek celebran el Xantolo con enormes arcos de flores y danzantes llamados huehues ("viejos") que van de casa en casa.' },
      { en: 'The name is usually explained as coming from Latin Sanctorum — "of the saints".', es: 'El nombre se suele explicar como venido del latín Sanctorum, "de los santos".' },
    ],
    dyk: { en: 'Some families make smaller offerings again a week and 20 days later.', es: 'Algunas familias vuelven a poner ofrendas pequeñas a los ocho y a los veinte días.' },
    src: ['milenio-xantolo', 'inpi-xantolo'],
  }),
  c({
    id: 'mixquic', cat: 'lugares', term: 'La Alumbrada', title: 'La Alumbrada', say: 'lah ah-loom-BRAH-dah',
    en: { en: 'Mixquic\'s candle-lit night' }, pic: { prop: 'velas-grupo' },
    text: [
      { en: 'In San Andrés [[Mixquic]], in Mexico City, the town turns off its streetlights on the night of November 2. The cemetery around the 16th-century church glows with thousands of candles.', es: 'En San Andrés [[Mixquic]], en la Ciudad de México, la noche del 2 de noviembre se apagan las luces del pueblo y el panteón junto a la iglesia del siglo XVI brilla con miles de velas.' },
      { en: 'It\'s called La Alumbrada: "the lighting".', es: 'Se llama La Alumbrada.' },
    ],
    dyk: { en: 'Mixquic\'s cemetery sits right beside the church, so the whole town square glows.', es: 'El panteón de Mixquic está junto a la iglesia, así que todo el centro del pueblo brilla.' },
    src: ['cronica-mixquic', 'infobae-mixquic'],
  }),
  c({
    id: 'oaxaca', cat: 'lugares', term: 'Muerteadas y tapetes', title: 'La Muerteada', say: 'mwehr-teh-AH-dahs',
    en: { en: 'Oaxaca\'s parades & sand carpets' }, pic: { prop: 'tapete' },
    text: [
      { en: 'In Oaxaca\'s Etla valley, costumed groups called [[comparsa]]s parade with brass bands through the night of November 1 to 2, acting out funny plays. This is the [[muerteada]].', es: 'En el valle de Etla, Oaxaca, grupos disfrazados llamados [[comparsa]]s desfilan con banda toda la noche del 1 al 2 de noviembre y actúan obras chistosas: es la [[muerteada]].' },
      { en: 'Oaxacan families also make tapetes de arena: pictures made of colored sand, seeds and flowers on the floor.', es: 'Las familias oaxaqueñas también hacen tapetes de arena: imágenes de arena de colores, semillas y flores en el piso.' },
    ],
    dyk: { en: 'The Isthmus Zapotec call the celebration Xandu\'.', es: 'Los zapotecos del Istmo le llaman Xandu\'.' },
    src: ['eluniversal-muerteadas', 'excelsior-tapetes', 'istmopress-xandu'],
  }),
  c({
    id: 'huaquechula', cat: 'lugares', term: 'Ofrendas monumentales', title: 'La Gran Ofrenda', say: 'wah-keh-CHOO-lah',
    en: { en: 'Huaquechula, Puebla' }, pic: { prop: 'mini-ofrenda', opts: { levels: 4, white: true } },
    text: [
      { en: 'In Huaquechula, Puebla, families who lost someone during the past year build giant white ofrendas, 3 to 5 meters tall, with the photo in the center behind a mirror.', es: 'En Huaquechula, Puebla, las familias que perdieron a alguien durante el último año ponen ofrendas blancas gigantes, de 3 a 5 metros, con la foto al centro detrás de un espejo.' },
      { en: 'They open their homes so visitors can come in and pay their respects.', es: 'Abren sus casas para que los visitantes pasen a presentar sus respetos.' },
    ],
    dyk: { en: 'Families there remember people who died in accidents on October 28.', es: 'Ahí se recuerda el 28 de octubre a quienes murieron en accidentes.' },
    src: ['mexdesconocido-huaquechula', 'excelsior-huaquechula'],
  }),
  // ------------------------------------------------------------ around the world
  c({
    id: 'guatemala', cat: 'mundo', term: 'Barriletes gigantes', title: 'El Barrilete', say: 'bah-ree-LEH-tehs',
    en: { en: 'Guatemala\'s giant kites' }, pic: { prop: 'barrilete' },
    text: [
      { en: 'In Guatemala, on November 1, the Kaqchikel Maya towns of Sumpango and Santiago Sacatepéquez make giant round kites, many meters across. They are said to carry messages to the dead.', es: 'En Guatemala, el 1 de noviembre, los pueblos mayas kaqchikeles de Sumpango y Santiago Sacatepéquez hacen barriletes gigantes de muchos metros. Se dice que llevan mensajes a los difuntos.' },
      { en: 'Families eat [[fiambre]], a huge cold salad with dozens of ingredients.', es: 'Las familias comen [[fiambre]], una gran ensalada fría con decenas de ingredientes.' },
    ],
    dyk: { en: 'In Santiago Sacatepéquez the kites fly right in the cemetery.', es: 'En Santiago Sacatepéquez los barriletes vuelan en el mismo cementerio.' },
    src: ['natgeo-guatemala'],
  }),
  c({
    id: 'andes', cat: 'mundo', term: 'Guaguas de pan', title: 'La Guagua', say: 'GWAH-gwahs deh PAHN',
    en: { en: 'Bread babies of the Andes' }, pic: { prop: 'guagua' },
    text: [
      { en: 'In Ecuador, families visit cemeteries on November 2 and enjoy [[guaguas de pan]] (bread shaped like babies) with [[colada morada]], a thick purple fruit drink.', es: 'En Ecuador, las familias visitan los cementerios el 2 de noviembre y comen [[guaguas de pan]] con [[colada morada]], una bebida morada y espesa.' },
      { en: 'In Bolivia and Peru, Andean families set tables for the souls with [[t\'antawawas]] — bread babies — plus bread ladders and horses to help the souls travel.', es: 'En Bolivia y Perú, las familias andinas ponen mesas para las almas con [[t\'antawawas]], panes en forma de bebé, y escaleras y caballos de pan para ayudar a las almas a viajar.' },
    ],
    dyk: { en: 'In the Philippines, families spend Undas (Nov 1–2) at the cemetery with candles and food.', es: 'En Filipinas, las familias pasan el Undas (1 y 2 de noviembre) en el cementerio con velas y comida.' },
    src: ['bk-andes'],
  }),
  c({
    id: 'usa', cat: 'mundo', term: 'En Estados Unidos', title: 'El Norte', say: '',
    en: { en: 'Día de los Muertos in the USA' }, pic: { prop: 'mural' },
    text: [
      { en: 'Mexican-American families have celebrated for generations. In the 1970s, Chicano artists in places like East Los Angeles and San Francisco started big community celebrations with art, altars and processions.', es: 'Las familias mexicoamericanas lo celebran desde hace generaciones. En los años setenta, artistas chicanos de lugares como el Este de Los Ángeles y San Francisco empezaron grandes celebraciones comunitarias con arte, altares y procesiones.' },
      { en: 'Today museums, schools and cities across the US hold Día de los Muertos events.', es: 'Hoy museos, escuelas y ciudades de todo Estados Unidos hacen eventos de Día de los Muertos.' },
    ],
    dyk: { en: 'Chicago\'s National Museum of Mexican Art holds one of the biggest Day of the Dead exhibitions in the US every year.', es: 'El Museo Nacional de Arte Mexicano de Chicago hace cada año una de las exposiciones de Día de Muertos más grandes de Estados Unidos.' },
    src: ['selfhelpgraphics', 'nmma-arts', 'latimes-ucla'],
  }),
  c({
    id: 'coco', cat: 'mundo', term: '"Coco" (2017)', title: 'La Película', say: '',
    en: { en: 'Movie magic vs. tradition' }, pic: { prop: 'claqueta' },
    text: [
      { en: 'Pixar\'s "Coco" made Día de Muertos famous around the world. Its team researched in Mexico for years and worked with Mexican and Mexican-American advisers.', es: '"Coco", de Pixar, hizo famoso el Día de Muertos en todo el mundo. Su equipo investigó en México durante años y trabajó con asesores mexicanos y mexicoamericanos.' },
      { en: 'Some ideas are movie inventions, not traditions: the Land of the Dead city, the marigold bridge, needing a photo to cross over, the "final death", and alebrijes as spirit guides.', es: 'Algunas ideas son inventos de la película, no tradiciones: la ciudad de los muertos, el puente de cempasúchil, necesitar una foto para cruzar, la "muerte definitiva" y los alebrijes como guías.' },
    ],
    dyk: { en: 'In 2013 Disney tried to trademark the words "Día de los Muertos". People protested, and Disney dropped the idea — a holiday belongs to the people who celebrate it.', es: 'En 2013 Disney quiso registrar como marca "Día de los Muertos". La gente protestó y Disney se echó para atrás: una tradición es de quienes la celebran.' },
    src: ['cnn-disney', 'remezcla-coco'],
  }),
  c({
    id: 'respeto', cat: 'costumbres', term: 'Con respeto', title: 'El Respeto', say: '',
    en: { en: 'Celebrating respectfully' }, pic: { prop: 'corazon' },
    text: [
      { en: 'Anyone can learn about Día de Muertos and join with respect: learn what things mean, go to events run by Mexican and Mexican-American communities, and buy from Mexican artisans.', es: 'Cualquiera puede aprender sobre el Día de Muertos y participar con respeto: entender qué significa cada cosa, ir a eventos de las comunidades mexicanas y mexicoamericanas y comprarles a artesanos mexicanos.' },
      { en: 'It is a family tradition full of love — not a costume party. And not every Mexican family celebrates it; some families of other faiths don\'t.', es: 'Es una tradición familiar llena de amor, no una fiesta de disfraces. Y no todas las familias mexicanas lo celebran; algunas de otras religiones no.' },
    ],
    dyk: { en: 'Every family remembers in its own way. You might ask a grown-up in your family about someone they remember.', es: 'Cada familia recuerda a su manera. Puedes preguntarle a alguien de tu familia sobre alguien a quien recuerde.' },
    src: ['learningforjustice', 'wdet-guide'],
  }),
];

let n = 0;
for (const card of CARDS) {
  card.num = ++n;
  card.catName = CATS[card.cat];
  card.bg = CATS[card.cat].bg;
}

export const CARD_BY_ID = Object.fromEntries(CARDS.map((x) => [x.id, x]));
