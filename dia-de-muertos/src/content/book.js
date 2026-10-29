// The Book of Memories (Libro de los Recuerdos): everything about the holiday,
// in short chapters for kids. [[word]] = tappable Spanish word. Contested ideas
// are worded carefully on purpose — see docs/research-notes.md.
export const CHAPTERS = [
  {
    id: 'que', title: { en: 'What is Día de Muertos?', es: '¿Qué es el Día de Muertos?' },
    html: {
      en: `<h3>What is Día de Muertos?</h3>
<p class="lead">[[Día de Muertos]] — the Day of the Dead — is a time when families in Mexico, and Mexican families all over the world, remember loved ones who have died.</p>
<p>Many families believe that for a short time each year, the souls of their loved ones come home to visit. So they get ready to welcome them like honored guests: they build an [[ofrenda]] with their photo, flowers, candles, water and their favorite food, and they visit, clean and decorate their graves at the [[panteón]].</p>
<p>It is a mix of feelings. People miss the ones who are gone — and they also celebrate the lives they lived, with stories, music, bright colors and good food. Sadness and happiness can be true at the same time.</p>
<div class="note"><b>Not Halloween!</b> The two holidays happen close together, but they are different. Halloween is often about being scared. Día de Muertos is about remembering, with love.</div>
<h4>Who celebrates?</h4>
<p>It is celebrated across Mexico and by Mexican and Mexican-American communities in the United States and elsewhere. It is very different from region to region and family to family — and not every Mexican family celebrates it. Some families of other faiths don't.</p>
<h4>Día de Muertos or Día de los Muertos?</h4>
<p>In Mexico, most people say <b>Día de Muertos</b>. In the United States, many say <b>Día de los Muertos</b>. Both are correct!</p>`,
      es: `<h3>¿Qué es el Día de Muertos?</h3>
<p class="lead">El [[Día de Muertos]] es cuando las familias de México, y las familias mexicanas de todo el mundo, recuerdan a sus seres queridos que ya murieron.</p>
<p>Muchas familias creen que, por un tiempo corto cada año, las almas de sus seres queridos vienen de visita. Por eso se preparan para recibirlas como invitados de honor: ponen una [[ofrenda]] con su foto, flores, velas, agua y su comida favorita, y visitan, limpian y adornan sus tumbas en el [[panteón]].</p>
<p>Es una mezcla de sentimientos. Se extraña a quienes ya no están y también se celebra la vida que vivieron, con historias, música, colores y buena comida. La tristeza y la alegría pueden estar juntas.</p>
<div class="note"><b>¡No es Halloween!</b> Las dos fiestas están cerca en el calendario, pero son distintas. Halloween muchas veces es para asustar. El Día de Muertos es para recordar con cariño.</div>
<h4>¿Quién lo celebra?</h4>
<p>Se celebra en todo México y en las comunidades mexicanas y mexicoamericanas de Estados Unidos y otros lugares. Cambia muchísimo de una región a otra y de una familia a otra, y no todas las familias mexicanas lo celebran; algunas de otras religiones no.</p>
<h4>¿Día de Muertos o Día de los Muertos?</h4>
<p>En México casi todos dicen <b>Día de Muertos</b>. En Estados Unidos muchos dicen <b>Día de los Muertos</b>. ¡Las dos formas son correctas!</p>`,
    },
  },
  {
    id: 'cuando', title: { en: 'When is it?', es: '¿Cuándo es?' },
    html: {
      en: `<h3>When is it?</h3>
<p class="lead">The main days are <b>November 1 and 2</b>.</p>
<table><tr><th>Day</th><th>In many places…</th></tr>
<tr><td>October 31</td><td>Families finish their ofrendas. In some places, the souls of children start to arrive.</td></tr>
<tr><td>November 1 — [[Todos Santos]] (All Saints' Day)</td><td>The souls of children, the [[angelitos]], are remembered.</td></tr>
<tr><td>November 2 — [[Fieles Difuntos]] (All Souls' Day)</td><td>The souls of adults are remembered. The visit ends, and families say goodbye.</td></tr></table>
<p>But dates change from town to town! Some places start on October 28 to remember people who died in accidents. In Yucatán, children are remembered on October 31. Some regions make another, smaller offering eight days later.</p>
<div class="note"><b>A new custom:</b> lately, some families set out a little ofrenda for their pets on October 27. This idea only became popular around 2019 — traditions keep growing!</div>`,
      es: `<h3>¿Cuándo es?</h3>
<p class="lead">Los días principales son el <b>1 y el 2 de noviembre</b>.</p>
<table><tr><th>Día</th><th>En muchos lugares…</th></tr>
<tr><td>31 de octubre</td><td>Las familias terminan sus ofrendas. En algunos lugares empiezan a llegar las almas de los niños.</td></tr>
<tr><td>1 de noviembre — [[Todos Santos]]</td><td>Se recuerda a las almas de los niños, los [[angelitos]].</td></tr>
<tr><td>2 de noviembre — [[Fieles Difuntos]]</td><td>Se recuerda a las almas de los adultos. Termina la visita y las familias se despiden.</td></tr></table>
<p>¡Pero las fechas cambian de pueblo en pueblo! En algunos lugares empiezan el 28 de octubre para recordar a quienes murieron en accidentes. En Yucatán, el 31 de octubre es de los niños. En algunas regiones se pone otra ofrenda pequeña ocho días después.</p>
<div class="note"><b>Una costumbre nueva:</b> últimamente algunas familias ponen una ofrendita para sus mascotas el 27 de octubre. Esta idea se hizo popular apenas hacia 2019. ¡Las tradiciones siguen creciendo!</div>`,
    },
  },
  {
    id: 'raices', title: { en: 'Where did it come from?', es: '¿De dónde viene?' },
    html: {
      en: `<h3>Where did it come from?</h3>
<p class="lead">Día de Muertos grew from two big roots that mixed together — and it kept changing, even in the last hundred years.</p>
<h4>Indigenous roots</h4>
<p>Long before the Spanish arrived, many Indigenous peoples in what is now Mexico honored their dead with offerings of food and flowers. The [[mexicas]] (Aztecs) held two feasts for the dead in their calendar, around July and August.</p>
<p>For the Mexica, where you went after death depended mostly on <b>how</b> you died. Most people went to [[Mictlán]], the place of the dead, ruled by [[Mictlantecuhtli]] and [[Mictecacíhuatl]]. It was not a place of punishment. One version of the story says the journey took four years and crossed a river with the help of a little dog.</p>
<h4>Catholic roots</h4>
<p>In the 1500s, the Spanish brought the Catholic feasts of All Saints' Day (November 1) and All Souls' Day (November 2), with prayers for the dead, candles, altars and wheat bread.</p>
<h4>A blend — and a debate</h4>
<p>After the conquest, these ways mixed. Historians still debate which parts came from where. The marigold, copal, maize foods and feeding the visiting souls have Indigenous roots; the November dates, wax candles, wheat bread and sugar figures came from Europe. Things like La Catrina (1910s) and alebrijes (1936) are more recent Mexican creations.</p>
<p>Today, many Indigenous communities — Purépecha, Maya, Nahua, Zapotec, Mixtec, Totonac and many more — keep their own ways of celebrating.</p>
<div class="note">In <b>2003</b> UNESCO named Mexico's "Indigenous festivity dedicated to the dead" a masterpiece of the heritage of humanity, and in <b>2008</b> it joined UNESCO's official list.</div>`,
      es: `<h3>¿De dónde viene?</h3>
<p class="lead">El Día de Muertos nació de dos grandes raíces que se mezclaron, y siguió cambiando, incluso en los últimos cien años.</p>
<h4>Raíces indígenas</h4>
<p>Mucho antes de que llegaran los españoles, muchos pueblos indígenas de lo que hoy es México honraban a sus muertos con ofrendas de comida y flores. Los [[mexicas]] tenían dos fiestas de muertos en su calendario, cerca de julio y agosto.</p>
<p>Para los mexicas, el lugar al que ibas al morir dependía sobre todo de <b>cómo</b> morías. La mayoría iba al [[Mictlán]], el lugar de los muertos, gobernado por [[Mictlantecuhtli]] y [[Mictecacíhuatl]]. No era un castigo. Una versión cuenta que el viaje duraba cuatro años y cruzaba un río con ayuda de un perrito.</p>
<h4>Raíces católicas</h4>
<p>En el siglo XVI, los españoles trajeron las fiestas católicas de Todos los Santos (1 de noviembre) y Fieles Difuntos (2 de noviembre), con oraciones por los difuntos, velas, altares y pan de trigo.</p>
<h4>Una mezcla… y un debate</h4>
<p>Después de la conquista, estas costumbres se mezclaron. Los historiadores todavía discuten qué parte viene de dónde. El cempasúchil, el copal, la comida de maíz y dar de comer a las almas tienen raíces indígenas; las fechas de noviembre, las velas de cera, el pan de trigo y las figuras de azúcar llegaron de Europa. Cosas como la Catrina (años 1910) y los alebrijes (1936) son creaciones mexicanas más recientes.</p>
<p>Hoy muchas comunidades indígenas —purépecha, maya, nahua, zapoteca, mixteca, totonaca y muchas más— conservan sus propias formas de celebrar.</p>
<div class="note">En <b>2003</b> la UNESCO reconoció "las fiestas indígenas dedicadas a los muertos" de México como obra maestra del patrimonio de la humanidad, y en <b>2008</b> las inscribió en su lista oficial.</div>`,
    },
  },
  {
    id: 'ofrenda', title: { en: 'The ofrenda', es: 'La ofrenda' },
    html: {
      en: `<h3>The ofrenda</h3>
<p class="lead">An [[ofrenda]] is a welcome table for the souls. There is <b>no single right way</b> to make one — every region and family does it differently.</p>
<table><tr><th>Element</th><th>What many families say it means</th></tr>
<tr><td>The photo</td><td>Shows who is being welcomed. Often the heart of the ofrenda.</td></tr>
<tr><td>[[cempasúchil]] (marigold)</td><td>Its color and strong smell guide the souls; petal paths lead from the door to the ofrenda.</td></tr>
<tr><td>Candles ([[veladoras|veladora]])</td><td>Light to guide the way. In some communities, one candle for each person.</td></tr>
<tr><td>[[copal]]</td><td>Fragrant smoke that cleans the space and guides the souls.</td></tr>
<tr><td>Water</td><td>To quench the souls' thirst after their long journey.</td></tr>
<tr><td>Salt</td><td>Purification, so the soul is not "spoiled" on its journey.</td></tr>
<tr><td>[[pan de muerto]]</td><td>A sweet bread of welcome and affection.</td></tr>
<tr><td>Sugar skulls</td><td>Often with the person's name on the forehead.</td></tr>
<tr><td>[[papel picado]]</td><td>Cut-paper banners; often said to stand for the wind.</td></tr>
<tr><td>Favorite food and drink</td><td>Whatever the person loved — mole, tamales, fruit, chocolate… even pizza!</td></tr>
<tr><td>Personal things</td><td>A hat, tools, a guitar, glasses — things that tell their story.</td></tr>
<tr><td>Toys</td><td>For the souls of children.</td></tr>
<tr><td>Cross or religious images</td><td>In many Catholic families. Other families use other things, or none.</td></tr>
<tr><td>A clay [[Xolo]] dog</td><td>A guide for the souls, from the old story of the dog that crosses the river.</td></tr>
<tr><td>The [[arco]] (arch)</td><td>Often explained as the doorway between the world of the living and the dead.</td></tr>
<tr><td>[[petate]] (palm mat)</td><td>A place for the souls to rest.</td></tr>
<tr><td>Basin, soap, towel, mirror</td><td>So the visitors can freshen up after their trip.</td></tr></table>
<h4>Levels</h4>
<p>Some ofrendas are one table; others have 2, 3 or 7 steps. People explain them differently: heaven and earth; heaven, earth and the underworld (or the Holy Trinity); or the steps of the soul's journey. These are fairly modern explanations, so there's no wrong number.</p>
<h4>The four elements</h4>
<p>A popular way to remember the parts: <b>earth</b> (food), <b>wind</b> (papel picado), <b>water</b> (a glass of water) and <b>fire</b> (candles). It's a modern teaching idea, not an ancient rule.</p>
<h4>And the food?</h4>
<p>Many families believe the souls take the <b>essence</b> of the food — its smell and steam. Afterward, families share it with relatives and neighbors.</p>`,
      es: `<h3>La ofrenda</h3>
<p class="lead">La [[ofrenda]] es una mesa de bienvenida para las almas. <b>No hay una sola forma correcta</b> de ponerla: cada región y cada familia la hace a su manera.</p>
<table><tr><th>Elemento</th><th>Lo que muchas familias dicen que significa</th></tr>
<tr><td>La foto</td><td>Muestra a quién se recibe. Muchas veces es el corazón de la ofrenda.</td></tr>
<tr><td>[[cempasúchil]]</td><td>Su color y su olor guían a las almas; los caminos de pétalos van de la puerta a la ofrenda.</td></tr>
<tr><td>[[veladoras|veladora]]</td><td>Luz para guiar el camino. En algunas comunidades, una vela por cada persona.</td></tr>
<tr><td>[[copal]]</td><td>Humo aromático que limpia el lugar y guía a las almas.</td></tr>
<tr><td>Agua</td><td>Para calmar la sed de las almas después de su largo viaje.</td></tr>
<tr><td>Sal</td><td>Purificación, para que el alma no se "corrompa" en su viaje.</td></tr>
<tr><td>[[pan de muerto]]</td><td>Pan dulce de bienvenida y cariño.</td></tr>
<tr><td>Calaveritas de azúcar</td><td>Muchas veces con el nombre de la persona en la frente.</td></tr>
<tr><td>[[papel picado]]</td><td>Banderitas de papel calado; se dice que representan el viento.</td></tr>
<tr><td>Comida y bebida favorita</td><td>Lo que le gustaba a la persona: mole, tamales, fruta, chocolate… ¡hasta pizza!</td></tr>
<tr><td>Objetos personales</td><td>Sombrero, herramientas, guitarra, lentes: cosas que cuentan su historia.</td></tr>
<tr><td>Juguetes</td><td>Para las almas de los niños.</td></tr>
<tr><td>Cruz o imágenes religiosas</td><td>En muchas familias católicas. Otras familias ponen otras cosas, o nada.</td></tr>
<tr><td>Un [[Xolo]] de barro</td><td>Guía de las almas, por la antigua historia del perro que cruza el río.</td></tr>
<tr><td>El [[arco]]</td><td>Se explica como la puerta entre el mundo de los vivos y el de los muertos.</td></tr>
<tr><td>[[petate]]</td><td>Un lugar para que las almas descansen.</td></tr>
<tr><td>Agua, jabón, toalla, espejo</td><td>Para que los visitantes se refresquen después del viaje.</td></tr></table>
<h4>Los niveles</h4>
<p>Algunas ofrendas son una mesa; otras tienen 2, 3 o 7 escalones. Se explican de distintas formas: cielo y tierra; cielo, tierra e inframundo (o la Santísima Trinidad); o los pasos del viaje del alma. Son explicaciones bastante modernas, así que no hay un número equivocado.</p>
<h4>Los cuatro elementos</h4>
<p>Una forma popular de recordar las partes: <b>tierra</b> (comida), <b>viento</b> (papel picado), <b>agua</b> (un vaso de agua) y <b>fuego</b> (velas). Es una idea moderna para enseñar, no una regla antigua.</p>
<h4>¿Y la comida?</h4>
<p>Muchas familias creen que las almas toman la <b>esencia</b> de la comida: su olor y su vapor. Después, la familia la comparte con parientes y vecinos.</p>`,
    },
  },
  {
    id: 'comida', title: { en: 'Food', es: 'La comida' },
    html: {
      en: `<h3>Food</h3>
<p class="lead">Food on the ofrenda is a gift — the favorite dishes of the person you remember.</p>
<h4>Pan de muerto</h4>
<p>A round, sweet bread, often scented with orange blossom, with dough "bones" on top and a little ball in the middle. Many say the ball is a skull (or a heart, or a tear) and the round shape is the circle of life — meanings change from place to place. Some bakers just call the ball "la nariz", the nose! Every region has its own bread: in Oaxaca, <b>pan de yema</b> often wears a little painted face; in Michoacán, families make breads shaped like people, animals and flowers.</p>
<h4>Sugar skulls</h4>
<p>Made with [[alfeñique]], a sugar paste with Arabic roots that came to Mexico from Spain. [[Toluca]] holds a famous sugar-figure fair, the Feria del Alfeñique. Today there are also chocolate and amaranth skulls.</p>
<h4>Tamales and mole</h4>
<p>[[tamales]] (from Nahuatl <i>tamalli</i>) are corn dough steamed in a leaf; in Michoacán, triangle-shaped [[corundas]] are a favorite. [[mole]] (from <i>mōlli</i>, "sauce") is a party dish made with chiles and many spices.</p>
<h4>Drinks</h4>
<p>[[atole]] (warm corn drink), [[champurrado]] (atole with chocolate), hot chocolate and [[café de olla]]. For grown-ups, some families set out whatever drink the person liked; for children, milk or juice.</p>
<h4>Sweets and fruit</h4>
<p>[[calabaza en tacha]] (candied pumpkin), oranges, mandarins, guavas, [[tejocote]]s and sugarcane — the fruit of the season.</p>
<h4>Around Mexico</h4>
<p>In Yucatán, the star dish is [[mucbipollo]], a giant tamal cooked underground. In Guatemala, families eat [[fiambre]], a huge cold salad.</p>`,
      es: `<h3>La comida</h3>
<p class="lead">La comida de la ofrenda es un regalo: los platillos favoritos de la persona que recuerdas.</p>
<h4>Pan de muerto</h4>
<p>Pan dulce y redondo, muchas veces con sabor a azahar, con "huesitos" de masa encima y una bolita al centro. Muchos dicen que la bolita es el cráneo (o un corazón, o una lágrima) y la forma redonda es el ciclo de la vida; los significados cambian de un lugar a otro. ¡Algunos panaderos le dicen a la bolita "la nariz"! Cada región tiene su pan: en Oaxaca, el <b>pan de yema</b> lleva muchas veces una carita pintada; en Michoacán se hacen panes con forma de personas, animales y flores.</p>
<h4>Calaveritas de azúcar</h4>
<p>Se hacen con [[alfeñique]], una pasta de azúcar de raíces árabes que llegó de España. En [[Toluca]] se hace la famosa Feria del Alfeñique. Hoy también hay calaveras de chocolate y de amaranto.</p>
<h4>Tamales y mole</h4>
<p>Los [[tamales]] (del náhuatl <i>tamalli</i>) son masa de maíz cocida al vapor en hoja; en Michoacán, las [[corundas]] triangulares son las favoritas. El [[mole]] (de <i>mōlli</i>, "salsa") es un platillo de fiesta hecho con chiles y muchas especias.</p>
<h4>Bebidas</h4>
<p>[[atole]], [[champurrado]], chocolate caliente y [[café de olla]]. Para los adultos, algunas familias ponen la bebida que le gustaba a la persona; para los niños, leche o jugo.</p>
<h4>Dulces y fruta</h4>
<p>[[calabaza en tacha]], naranjas, mandarinas, guayabas, [[tejocote]]s y caña: la fruta de la temporada.</p>
<h4>Por México</h4>
<p>En Yucatán, el platillo estrella es el [[mucbipollo]], un tamal gigante cocido bajo tierra. En Guatemala se come [[fiambre]], una gran ensalada fría.</p>`,
    },
  },
  {
    id: 'arte', title: { en: 'Symbols & art', es: 'Símbolos y arte' },
    html: {
      en: `<h3>Symbols & art</h3>
<h4>Calaveras</h4>
<p>[[calavera]] means skull. During Día de Muertos, skulls and skeletons ([[calaca]]s) are everywhere — and they're playful, not scary: they dance, cook, play music and wear their best clothes.</p>
<h4>La Catrina</h4>
<p>Around 1910–1913, printmaker <b>José Guadalupe Posada</b> (1852–1913) made a skeleton lady wearing nothing but a fancy French hat. Called "La Calavera [[garbancera]]", she made fun of people who pretended to be rich Europeans and hid their roots. In 1946–47, <b>Diego Rivera</b> painted her full-length in his mural <i>Dream of a Sunday Afternoon in the Alameda Central</i>, holding hands with Rivera as a boy, next to Posada and Frida Kahlo. The name <b>La Catrina</b> stuck.</p>
<h4>Calaveritas literarias</h4>
<p>Funny rhyming poems that imagine Death — "la Flaca" — coming for a living person, and teasing their habits with affection. They began in satirical newspapers in the 1800s. Today kids write them in school.</p>
<h4>Papel picado</h4>
<p>Tissue paper cut into lacy designs. In San Salvador [[Huixcolotla]], Puebla, artisans stack many sheets and cut them all at once with a chisel and mallet. Its handmade papel picado became cultural heritage of Puebla in 1998.</p>
<h4>The Xoloitzcuintle</h4>
<p>Mexico's ancient hairless dog. Its name joins Xólotl (a dog-headed god) and itzcuintli ("dog"). Dogs were sometimes buried with people as guides to Mictlán.</p>
<h4>Monarch butterflies</h4>
<p>Millions arrive in the forests of Michoacán and the State of Mexico around late October and early November. Among the Purépecha, Mazahua and Matlatzinca peoples, they are said to be — or to carry — the souls of the dead.</p>
<h4>Alebrijes</h4>
<p>Colorful fantasy creatures invented in 1936 by Pedro Linares, a papier-mâché artist in Mexico City. They're wonderful folk art — but not an old part of Día de Muertos. The movie "Coco" made them spirit guides; that's movie magic.</p>`,
      es: `<h3>Símbolos y arte</h3>
<h4>Calaveras</h4>
<p>[[calavera]] quiere decir cráneo. En Día de Muertos hay calaveras y [[calaca]]s por todas partes, y son juguetonas, no de miedo: bailan, cocinan, tocan música y se visten elegantes.</p>
<h4>La Catrina</h4>
<p>Hacia 1910–1913, el grabador <b>José Guadalupe Posada</b> (1852–1913) hizo una calavera de mujer con un elegante sombrero francés. Llamada "La Calavera [[garbancera]]", se burlaba de quienes fingían ser europeos ricos y negaban sus raíces. En 1946–47, <b>Diego Rivera</b> la pintó de cuerpo entero en su mural <i>Sueño de una tarde dominical en la Alameda Central</i>, de la mano de Rivera niño, junto a Posada y Frida Kahlo. Se quedó con el nombre de <b>La Catrina</b>.</p>
<h4>Calaveritas literarias</h4>
<p>Versos chistosos que imaginan que la Muerte —"la Flaca"— viene por una persona viva, y bromean con cariño sobre sus costumbres. Nacieron en periódicos satíricos del siglo XIX. Hoy los niños las escriben en la escuela.</p>
<h4>Papel picado</h4>
<p>Papel de China recortado con diseños calados. En San Salvador [[Huixcolotla]], Puebla, los artesanos apilan muchas hojas y las cortan todas a la vez con cincel y mazo. Su papel picado artesanal es patrimonio cultural de Puebla desde 1998.</p>
<h4>El Xoloitzcuintle</h4>
<p>El antiguo perro sin pelo de México. Su nombre une a Xólotl (un dios con cabeza de perro) e itzcuintli ("perro"). A veces se enterraba a perros junto con las personas como guías al Mictlán.</p>
<h4>Mariposas monarca</h4>
<p>Millones llegan a los bosques de Michoacán y el Estado de México entre finales de octubre y principios de noviembre. Entre los pueblos purépecha, mazahua y matlatzinca se dice que son —o llevan— las almas de los muertos.</p>
<h4>Alebrijes</h4>
<p>Criaturas fantásticas de colores inventadas en 1936 por Pedro Linares, cartonero de la Ciudad de México. Son un arte popular maravilloso, pero no son parte antigua del Día de Muertos. La película "Coco" los volvió guías de las almas: eso es magia de cine.</p>`,
    },
  },
  {
    id: 'panteon', title: { en: 'At the cemetery', es: 'En el panteón' },
    html: {
      en: `<h3>At the cemetery</h3>
<p class="lead">Families go to the [[panteón]] to clean and decorate the graves of their loved ones with marigolds, candles and sometimes food.</p>
<p>In many towns, families stay all night — the [[velación]], or vigil — keeping their loved ones company. They talk, pray, share food and listen to music. It feels like a big, warm family gathering.</p>
<h4>Famous vigils</h4>
<ul><li>Around Lake [[Pátzcuaro]], Michoacán, the [[Purépecha]] ceremony is called [[Animecha Kejtzitakua]], "offering for the souls". On the island of [[Janitzio]], the main vigil is the night of November 1 to 2.</li>
<li>In San Andrés [[Mixquic]], Mexico City, the town turns off its lights on the night of November 2 and the cemetery glows with thousands of candles: La Alumbrada.</li></ul>
<h4>Good manners</h4>
<ul><li>Speak softly near people who are praying or remembering.</li><li>Never step on graves or touch other families' offerings.</li><li>Ask before taking photos.</li><li>If a family offers you food, it's a kind gesture — a "gracias" goes a long way.</li></ul>`,
      es: `<h3>En el panteón</h3>
<p class="lead">Las familias van al [[panteón]] a limpiar y adornar las tumbas de sus seres queridos con cempasúchil, velas y a veces comida.</p>
<p>En muchos pueblos las familias se quedan toda la noche —la [[velación]]— acompañando a sus seres queridos. Platican, rezan, comparten comida y escuchan música. Parece una gran reunión familiar.</p>
<h4>Velaciones famosas</h4>
<ul><li>Alrededor del lago de [[Pátzcuaro]], Michoacán, la ceremonia [[Purépecha]] se llama [[Animecha Kejtzitakua]], "ofrenda para las ánimas". En la isla de [[Janitzio]], la velación principal es la noche del 1 al 2 de noviembre.</li>
<li>En San Andrés [[Mixquic]], Ciudad de México, el pueblo apaga sus luces la noche del 2 de noviembre y el panteón brilla con miles de velas: La Alumbrada.</li></ul>
<h4>Buenos modales</h4>
<ul><li>Habla bajito cerca de quienes rezan o recuerdan.</li><li>Nunca pises las tumbas ni toques las ofrendas de otras familias.</li><li>Pide permiso antes de tomar fotos.</li><li>Si una familia te ofrece comida, es un gesto amable: un "gracias" vale mucho.</li></ul>`,
    },
  },
  { id: 'mexico', title: { en: 'Around Mexico (map)', es: 'Por México (mapa)' }, special: 'mexico' },
  {
    id: 'mundo', title: { en: 'Around the world', es: 'Por el mundo' },
    html: {
      en: `<h3>Around the world</h3>
<p class="lead">Many places remember their dead around November 1 and 2, each in its own way.</p>
<h4>Guatemala</h4><p>In the Kaqchikel Maya towns of Sumpango and Santiago Sacatepéquez, people make giant round kites ([[barriletes]]) many meters across. Families eat [[fiambre]], a giant cold salad.</p>
<h4>Ecuador</h4><p>On November 2, families visit cemeteries and enjoy [[guaguas de pan]] — bread shaped like babies — with [[colada morada]], a thick purple fruit drink.</p>
<h4>Bolivia and Peru</h4><p>In the Andes, families set tables for the souls with [[t'antawawas]], bread babies, and bread ladders and horses to help the souls travel.</p>
<h4>The Philippines</h4><p>During Undas (November 1–2), families spend the day — sometimes the night — at the cemetery with candles and food.</p>
<h4>The United States</h4><p>Mexican-American families have celebrated for generations. In the 1970s, Chicano artists in places like East Los Angeles and San Francisco began big community celebrations with art, altars and processions. Today museums and schools across the US hold Día de los Muertos events.</p>
<h4>"Coco" (2017)</h4><p>Pixar's movie made the holiday famous worldwide. Some ideas in it are movie inventions — the marigold bridge, needing a photo to cross over, the "final death" and alebrijes as spirit guides.</p>
<div class="note">Some details in this chapter come from general knowledge and still need to be checked against sources — see the Sources page.</div>`,
      es: `<h3>Por el mundo</h3>
<p class="lead">Muchos lugares recuerdan a sus muertos cerca del 1 y 2 de noviembre, cada uno a su manera.</p>
<h4>Guatemala</h4><p>En los pueblos mayas kaqchikeles de Sumpango y Santiago Sacatepéquez se hacen [[barriletes]] gigantes de muchos metros. Las familias comen [[fiambre]], una gran ensalada fría.</p>
<h4>Ecuador</h4><p>El 2 de noviembre, las familias visitan los cementerios y comen [[guaguas de pan]] con [[colada morada]], una bebida morada y espesa.</p>
<h4>Bolivia y Perú</h4><p>En los Andes, las familias ponen mesas para las almas con [[t'antawawas]] (panes en forma de bebé), y escaleras y caballos de pan para ayudar a las almas a viajar.</p>
<h4>Filipinas</h4><p>En el Undas (1 y 2 de noviembre), las familias pasan el día —a veces la noche— en el cementerio con velas y comida.</p>
<h4>Estados Unidos</h4><p>Las familias mexicoamericanas lo celebran desde hace generaciones. En los años setenta, artistas chicanos de lugares como el Este de Los Ángeles y San Francisco empezaron grandes celebraciones comunitarias con arte, altares y procesiones. Hoy museos y escuelas de todo el país hacen eventos de Día de los Muertos.</p>
<h4>"Coco" (2017)</h4><p>La película de Pixar hizo famosa la fiesta en todo el mundo. Algunas ideas son inventos de la película: el puente de cempasúchil, necesitar una foto para cruzar, la "muerte definitiva" y los alebrijes como guías.</p>
<div class="note">Algunos datos de este capítulo vienen de conocimiento general y aún hay que comprobarlos con fuentes; mira la página de Fuentes.</div>`,
    },
  },
  {
    id: 'mitos', title: { en: 'Myths & facts', es: 'Mitos y verdades' },
    myths: [
      { m: { en: '"It\'s Mexican Halloween."', es: '"Es el Halloween mexicano."' }, f: { en: 'They\'re different holidays with different roots. Día de Muertos is about remembering with love, not being scared.', es: 'Son fiestas distintas con raíces distintas. El Día de Muertos es para recordar con cariño, no para asustar.' } },
      { m: { en: '"It\'s a 3,000-year-old Aztec festival."', es: '"Es una fiesta azteca de 3,000 años."' }, f: { en: 'It\'s a blend of Indigenous and Catholic traditions, and historians still debate the mix.', es: 'Es una mezcla de tradiciones indígenas y católicas, y los historiadores todavía discuten esa mezcla.' } },
      { m: { en: '"La Catrina is an Aztec goddess."', es: '"La Catrina es una diosa azteca."' }, f: { en: 'La Catrina was drawn by Posada around 1910–1913 and named by Diego Rivera in 1946–47.', es: 'A la Catrina la dibujó Posada hacia 1910–1913 y le puso nombre Diego Rivera en 1946–47.' } },
      { m: { en: '"An ofrenda must have 7 levels."', es: '"La ofrenda debe tener 7 niveles."' }, f: { en: 'Many ofrendas are one table. The level meanings are modern and don\'t agree.', es: 'Muchas ofrendas son una mesa. Los significados de los niveles son modernos y no coinciden.' } },
      { m: { en: '"Each papel picado color has a secret meaning."', es: '"Cada color del papel picado tiene un significado secreto."' }, f: { en: 'The color lists online contradict each other; no old rule has been found.', es: 'Las listas de internet se contradicen; no se ha encontrado una regla antigua.' } },
      { m: { en: '"Alebrijes are ancient spirit guides."', es: '"Los alebrijes son guías espirituales antiguos."' }, f: { en: 'Pedro Linares invented them in 1936. The spirit-guide idea comes from the movie "Coco".', es: 'Los inventó Pedro Linares en 1936. Lo de guías viene de la película "Coco".' } },
      { m: { en: '"All Mexicans celebrate it the same way."', es: '"Todos los mexicanos lo celebran igual."' }, f: { en: 'Every region, town and family is different — and some families don\'t celebrate.', es: 'Cada región, pueblo y familia es distinta, y algunas familias no lo celebran.' } },
      { m: { en: '"Mexico City\'s big parade is ancient."', es: '"El gran desfile de la CDMX es antiquísimo."' }, f: { en: 'It began in 2016, inspired by a scene in a James Bond movie!', es: '¡Empezó en 2016, inspirado en una escena de una película de James Bond!' } },
    ],
  },
  {
    id: 'respeto', title: { en: 'With respect', es: 'Con respeto' },
    html: {
      en: `<h3>With respect</h3>
<p class="lead">Día de Muertos is a family tradition full of love. Anyone can learn about it — here's how to join respectfully.</p>
<ul>
<li><b>Learn what things mean</b> before you use them. A sugar skull or a Catrina is not just decoration.</li>
<li><b>It's not a costume party.</b> If you join a Catrina parade, honor the tradition — no scary or silly costumes.</li>
<li><b>Go to events run by Mexican and Mexican-American communities</b>, and buy from Mexican artisans.</li>
<li><b>Say it right:</b> Día (with the accent) de Muertos — not "Día de la Muerte".</li>
<li><b>At a cemetery:</b> speak softly, don't step on graves, and ask before taking photos.</li>
<li><b>Remember that families differ.</b> Some are Catholic, some follow Indigenous traditions, some both — and some don't celebrate.</li>
</ul>
<div class="gentle"><b>If you miss someone:</b> it's okay to feel sad, happy, or both — or to feel nothing in particular. You can talk to a grown-up you trust. You can also make an ofrenda for a pet, a hero from history, or someone you admire.</div>
<h4>Make your own ofrenda</h4>
<p>From the main menu, choose <b>Make your own ofrenda</b>. You can honor a grandparent or relative, a pet, a person from history, or someone you admire. You can draw their portrait — no photos needed.</p>
<h4>Learn more</h4>
<p>Mexico's INAH and INPI, the Smithsonian's National Museum of the American Indian, the National Museum of Mexican Art in Chicago, and Mexic-Arte Museum in Austin all share materials about Día de Muertos.</p>`,
      es: `<h3>Con respeto</h3>
<p class="lead">El Día de Muertos es una tradición familiar llena de cariño. Cualquiera puede aprender sobre ella; así se participa con respeto.</p>
<ul>
<li><b>Aprende qué significa cada cosa</b> antes de usarla. Una calaverita o una Catrina no son solo adornos.</li>
<li><b>No es una fiesta de disfraces.</b> Si vas a un desfile de Catrinas, honra la tradición: nada de disfraces de miedo o de burla.</li>
<li><b>Ve a eventos de las comunidades mexicanas y mexicoamericanas</b> y cómprales a artesanos mexicanos.</li>
<li><b>Dilo bien:</b> Día de Muertos, no "Día de la Muerte".</li>
<li><b>En el panteón:</b> habla bajito, no pises las tumbas y pide permiso antes de tomar fotos.</li>
<li><b>Recuerda que cada familia es distinta.</b> Algunas son católicas, otras siguen tradiciones indígenas, otras las dos, y algunas no lo celebran.</li>
</ul>
<div class="gentle"><b>Si extrañas a alguien:</b> está bien sentir tristeza, alegría o las dos cosas, o no sentir nada en especial. Puedes platicar con un adulto de confianza. También puedes hacer una ofrenda para una mascota, un personaje de la historia o alguien a quien admires.</div>
<h4>Haz tu propia ofrenda</h4>
<p>En el menú principal elige <b>Haz tu propia ofrenda</b>. Puedes honrar a un abuelo o familiar, una mascota, un personaje de la historia o alguien a quien admires. Puedes dibujar su retrato: no hace falta ninguna foto.</p>
<h4>Para saber más</h4>
<p>El INAH y el INPI de México, el Museo Nacional del Indígena Americano del Smithsonian, el Museo Nacional de Arte Mexicano de Chicago y el Mexic-Arte Museum de Austin comparten materiales sobre el Día de Muertos.</p>`,
    },
  },
  { id: 'tarjetas', title: { en: 'Card collection', es: 'Colección de tarjetas' }, special: 'cards' },
  { id: 'glosario', title: { en: 'Glossary', es: 'Glosario' }, special: 'glossary' },
  { id: 'fuentes', title: { en: 'Sources', es: 'Fuentes' }, special: 'sources' },
];

// Mexico places for the interactive map (lon, lat) → the card they teach
export const MEXICO_PLACES = [
  { card: 'velacion', lon: -101.6, lat: 19.52, name: { en: 'Lake Pátzcuaro & Janitzio, Michoacán', es: 'Lago de Pátzcuaro y Janitzio, Michoacán' }, txt: { en: 'Purépecha vigils by candlelight — and the inspiration for Santa María del Lago.', es: 'Velaciones purépechas a la luz de las velas, e inspiración para Santa María del Lago.' } },
  { card: 'monarca', lon: -100.25, lat: 19.62, name: { en: 'Monarch Butterfly Reserve', es: 'Reserva de la Mariposa Monarca' }, txt: { en: 'Millions of monarchs arrive here around Día de Muertos.', es: 'Millones de monarcas llegan aquí cerca de Día de Muertos.' } },
  { card: 'calavera', lon: -99.66, lat: 19.29, name: { en: 'Toluca, State of Mexico', es: 'Toluca, Estado de México' }, txt: { en: 'The Feria del Alfeñique: a fair of sugar skulls and figures.', es: 'La Feria del Alfeñique: calaveritas y figuras de azúcar.' } },
  { card: 'mixquic', lon: -98.96, lat: 19.22, name: { en: 'Mixquic, Mexico City', es: 'Mixquic, Ciudad de México' }, txt: { en: 'La Alumbrada: a cemetery glowing with thousands of candles.', es: 'La Alumbrada: un panteón que brilla con miles de velas.' } },
  { card: 'papel', lon: -97.8, lat: 18.92, name: { en: 'San Salvador Huixcolotla, Puebla', es: 'San Salvador Huixcolotla, Puebla' }, txt: { en: 'The most famous papel picado town.', es: 'El pueblo más famoso del papel picado.' } },
  { card: 'huaquechula', lon: -98.55, lat: 18.77, name: { en: 'Huaquechula, Puebla', es: 'Huaquechula, Puebla' }, txt: { en: 'Giant white ofrendas, 3 to 5 meters tall.', es: 'Ofrendas blancas gigantes, de 3 a 5 metros.' } },
  { card: 'oaxaca', lon: -96.73, lat: 17.06, name: { en: 'Oaxaca', es: 'Oaxaca' }, txt: { en: 'Muerteadas with brass bands, sand carpets, pan de yema with painted faces.', es: 'Muerteadas con banda, tapetes de arena y pan de yema con carita.' } },
  { card: 'hanal', lon: -89.6, lat: 20.97, name: { en: 'Yucatán', es: 'Yucatán' }, txt: { en: 'Hanal Pixán, "food of the souls", and the underground mucbipollo.', es: 'Hanal Pixán, "comida de las almas", y el mucbipollo bajo tierra.' } },
  { card: 'xantolo', lon: -98.8, lat: 21.2, name: { en: 'The Huasteca', es: 'La Huasteca' }, txt: { en: 'Xantolo: huge flower arches and dancing huehues.', es: 'Xantolo: enormes arcos de flores y huehues que bailan.' } },
  { card: 'posada', lon: -102.29, lat: 21.88, name: { en: 'Aguascalientes', es: 'Aguascalientes' }, txt: { en: 'Birthplace of José Guadalupe Posada, with a big Festival de Calaveras.', es: 'Cuna de José Guadalupe Posada, con un gran Festival de Calaveras.' } },
  { card: 'catrinas', lon: -99.13, lat: 19.43, name: { en: 'Mexico City', es: 'Ciudad de México' }, txt: { en: 'A big parade (since 2016), giant alebrijes (since 2007), and Rivera\'s mural with La Catrina.', es: 'Un gran desfile (desde 2016), alebrijes monumentales (desde 2007) y el mural de Rivera con la Catrina.' } },
];

// a simplified outline of Mexico (lon, lat) for the cartoon map
export const MEXICO_OUTLINE = [
  [-117.1, 32.53], [-115.5, 32.65], [-114.72, 32.72], [-111.07, 31.33], [-108.21, 31.33], [-108.21, 31.78], [-106.45, 31.76],
  [-104.9, 30.6], [-104.4, 29.6], [-103.2, 28.98], [-102.4, 29.78], [-101.4, 29.77], [-100.5, 28.7], [-99.5, 27.5], [-98.3, 26.1],
  [-97.15, 25.95], [-97.7, 24.0], [-97.85, 22.2], [-97.35, 21.0], [-96.1, 19.2], [-94.4, 18.15], [-92.5, 18.65], [-91.0, 19.0],
  [-90.7, 19.35], [-90.4, 20.85], [-89.7, 21.3], [-87.5, 21.5], [-86.8, 21.15], [-87.5, 20.2], [-88.3, 18.5], [-89.15, 17.85],
  [-90.98, 17.25], [-91.4, 16.1], [-92.2, 15.0], [-92.25, 14.55], [-93.9, 15.95], [-95.2, 16.2], [-97.1, 15.85], [-99.9, 16.85],
  [-102.2, 17.95], [-104.3, 19.05], [-105.6, 20.4], [-105.25, 21.5], [-106.4, 23.2], [-107.6, 24.6], [-109.0, 25.7], [-110.9, 27.9],
  [-111.9, 28.8], [-113.2, 30.8], [-114.8, 31.6], [-114.85, 30.8], [-113.55, 28.95], [-112.27, 27.34], [-111.35, 26.0], [-110.3, 24.15],
  [-109.9, 22.9], [-110.2, 23.45], [-112.1, 24.6], [-113.6, 26.7], [-114.15, 27.95], [-115.1, 27.85], [-115.7, 30.1], [-116.6, 31.85],
];
