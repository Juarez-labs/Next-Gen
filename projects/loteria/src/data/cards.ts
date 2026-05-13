// The 54 traditional lotería cards. Names are folk/public-domain.
// `verse` is the traditional Spanish riff the caller sings before naming the card.
// `en` is a literal-ish English translation used only when the UI is in English mode —
// the caller's audio is always Spanish (that's the whole vibe).

export type CardDef = {
  index: number;
  name: string;
  en: string;
  verse: string;
};

export const CARDS: CardDef[] = [
  { index: 0,  name: "El Gallo",        en: "The Rooster",     verse: "El que le cantó a San Pedro no le volverá a cantar." },
  { index: 1,  name: "El Diablito",     en: "The Little Devil", verse: "Pórtate bien cuatito, si no te lleva el coloradito." },
  { index: 2,  name: "La Dama",         en: "The Lady",        verse: "Puliendo el paso, por toda la calle real." },
  { index: 3,  name: "El Catrín",       en: "The Dandy",       verse: "Don Ferruco en la alameda, su bastón quería tirar." },
  { index: 4,  name: "El Paraguas",     en: "The Umbrella",    verse: "Para el sol y para el agua." },
  { index: 5,  name: "La Sirena",       en: "The Mermaid",     verse: "Con los cantos de sirena, no te vayas a marear." },
  { index: 6,  name: "La Escalera",     en: "The Ladder",      verse: "Súbeme paso a pasito, no quieras pegar brincos." },
  { index: 7,  name: "La Botella",      en: "The Bottle",      verse: "La herramienta del borracho." },
  { index: 8,  name: "El Barril",       en: "The Barrel",      verse: "Tanto bebió el albañil, que quedó como barril." },
  { index: 9,  name: "El Árbol",        en: "The Tree",        verse: "El que a buen árbol se arrima, buena sombra le cobija." },
  { index: 10, name: "El Melón",        en: "The Melon",       verse: "Me lo das o me lo quitas." },
  { index: 11, name: "El Valiente",     en: "The Brave One",   verse: "Por qué le corres cobarde, trayendo tan buen puñal." },
  { index: 12, name: "El Gorrito",      en: "The Little Bonnet", verse: "Ponle su gorrito al nene, no se nos vaya a resfriar." },
  { index: 13, name: "La Muerte",       en: "Death",           verse: "La muerte tilica y flaca." },
  { index: 14, name: "La Pera",         en: "The Pear",        verse: "El que espera, desespera." },
  { index: 15, name: "La Bandera",      en: "The Flag",        verse: "Verde, blanco y colorado, la bandera del soldado." },
  { index: 16, name: "El Bandolón",     en: "The Bandolón",    verse: "Tocando su bandolón, está el mariachi Simón." },
  { index: 17, name: "El Violoncello",  en: "The Cello",       verse: "Creciendo se fue hasta el cielo, y como no fue violín, tuvo que ser violoncello." },
  { index: 18, name: "La Garza",        en: "The Heron",       verse: "Al otro lado del río tengo mi banco de arena, donde se sienta mi chata pico de garza morena." },
  { index: 19, name: "El Pájaro",       en: "The Bird",        verse: "Tú me traes a puros brincos, como pájaro en la rama." },
  { index: 20, name: "La Mano",         en: "The Hand",        verse: "La mano de un criminal." },
  { index: 21, name: "La Bota",         en: "The Boot",        verse: "Una bota igual que la otra." },
  { index: 22, name: "La Luna",         en: "The Moon",        verse: "El farol de los enamorados." },
  { index: 23, name: "El Cotorro",      en: "The Parrot",      verse: "Cotorro cotorro saca la pata, y empiézame a platicar." },
  { index: 24, name: "El Borracho",     en: "The Drunkard",    verse: "A qué borracho tan necio, ya no lo puedo aguantar." },
  { index: 25, name: "El Negrito",      en: "The Little Black Man", verse: "El que se comió el azúcar." },
  { index: 26, name: "El Corazón",      en: "The Heart",       verse: "No me extrañes corazón, que regreso en el camión." },
  { index: 27, name: "La Sandía",       en: "The Watermelon",  verse: "La barriga que Juan tenía, era empacho de sandía." },
  { index: 28, name: "El Tambor",       en: "The Drum",        verse: "No te arrugues cuero viejo, que te quiero pa' tambor." },
  { index: 29, name: "El Camarón",      en: "The Shrimp",      verse: "Camarón que se duerme, se lo lleva la corriente." },
  { index: 30, name: "Las Jaras",       en: "The Arrows",      verse: "Las jaras del indio Adán, donde pegan, dan." },
  { index: 31, name: "El Músico",       en: "The Musician",    verse: "El músico trompas de hule, ya no me quiere tocar." },
  { index: 32, name: "La Araña",        en: "The Spider",      verse: "Atarántemela a palos, no me la dejen llegar." },
  { index: 33, name: "El Soldado",      en: "The Soldier",     verse: "Uno, dos y tres, el soldado p'al cuartel." },
  { index: 34, name: "La Estrella",     en: "The Star",        verse: "La guía de los marineros." },
  { index: 35, name: "El Cazo",         en: "The Saucepan",    verse: "El caso que te hago es poco." },
  { index: 36, name: "El Mundo",        en: "The World",       verse: "Este mundo es una bola, y nosotros un bolón." },
  { index: 37, name: "El Apache",       en: "The Apache",      verse: "¡Ah, Chihuahua! Cuánto apache con pantalón y huarache." },
  { index: 38, name: "El Nopal",        en: "The Prickly Pear", verse: "Al nopal lo van a ver, no más cuando tiene tunas." },
  { index: 39, name: "El Alacrán",      en: "The Scorpion",    verse: "El que con la cola pica, le dan una paliza." },
  { index: 40, name: "La Rosa",         en: "The Rose",        verse: "Rosita, Rosaura, ven que te quiero ahora." },
  { index: 41, name: "La Calavera",     en: "The Skull",       verse: "Al pasar por el panteón, me encontré un calaverón." },
  { index: 42, name: "La Campana",      en: "The Bell",        verse: "Tú con la campana y yo con tu hermana." },
  { index: 43, name: "El Cantarito",    en: "The Little Jug",  verse: "Tanto va el cántaro al agua, que se quiebra y te moja las naguas." },
  { index: 44, name: "El Venado",       en: "The Deer",        verse: "Saltando va buscando, pero no ve nada." },
  { index: 45, name: "El Sol",          en: "The Sun",         verse: "La cobija de los pobres." },
  { index: 46, name: "La Corona",       en: "The Crown",       verse: "El sombrero de los reyes." },
  { index: 47, name: "La Chalupa",      en: "The Canoe",       verse: "Rema que rema Lupita, sentada en su chalupita." },
  { index: 48, name: "El Pino",         en: "The Pine Tree",   verse: "Fresco y oloroso, en todo tiempo hermoso." },
  { index: 49, name: "El Pescado",      en: "The Fish",        verse: "El que por la boca muere, aunque mudo fuere." },
  { index: 50, name: "La Palma",        en: "The Palm",        verse: "Palmero, sube a la palma y bájame un coco real." },
  { index: 51, name: "La Maceta",       en: "The Flowerpot",   verse: "El que nace pa' maceta, no sale del corredor." },
  { index: 52, name: "El Arpa",         en: "The Harp",        verse: "Arpa vieja de mi suegra, ya no sirves pa' tocar." },
  { index: 53, name: "La Rana",         en: "The Frog",        verse: "Al ver a la verde rana, qué brinco pegó tu hermana." },
];

export const TOTAL_CARDS = CARDS.length;
