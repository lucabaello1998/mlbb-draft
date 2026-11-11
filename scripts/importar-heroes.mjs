// Importa el roster completo desde la wiki de Mobile Legends y lo mezcla con los
// héroes curados a mano.
//
// De la wiki salen nombre, rol, carril y retrato, leyendo las categorías de cada
// página ("Assassin heroes", "Jungle heroes"): el infobox se arma con una
// plantilla y no trae esos datos en el wikitext. Los 30 curados conservan tips,
// counters, sinergias y tier; los nuevos entran con `curado: false` y tier "?"
// (sin clasificar). Preferimos decir "falta curarlo" antes que inventarle una
// tier y tres tips.
//
// Uso: node scripts/importar-heroes.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const WIKI = "https://mobile-legends.fandom.com/api.php";
const AGENTE = "mlbb-draft/0.1 (+https://github.com/lucabaello1998/mlbb-draft)";
const LOTE = 50;

const ROLES = {
  "assassin heroes": "Assassin",
  "marksman heroes": "Marksman",
  "mage heroes": "Mage",
  "fighter heroes": "Fighter",
  "tank heroes": "Tank",
  "support heroes": "Support",
};

const CARRILES = {
  "gold lane heroes": "Oro",
  "mid lane heroes": "Medio",
  "exp lane heroes": "Exp",
  "jungle heroes": "Jungla",
  "roaming heroes": "Roam",
};

// Carril natural de cada rol: si el héroe tiene varias categorías de carril, gana
// la que le corresponde por rol (Chou es Fighter con Exp y Roam → Exp).
const CARRIL_NATURAL = { Marksman: "Oro", Mage: "Medio", Assassin: "Jungla", Fighter: "Exp", Tank: "Roam", Support: "Roam" };
const ORDEN_CARRILES = ["Oro", "Medio", "Exp", "Jungla", "Roam"];

const dormir = (ms) => new Promise((listo) => setTimeout(listo, ms));

async function api(parametros) {
  const url = `${WIKI}?format=json&${new URLSearchParams(parametros)}`;
  const respuesta = await fetch(url, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(30000) });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return respuesta.json();
}

function slug(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function titulosDeHeroes() {
  const titulos = [];
  let continuar = null;

  do {
    const datos = await api({
      action: "query",
      list: "categorymembers",
      cmtitle: "Category:Heroes",
      cmlimit: "500",
      cmtype: "page",
      ...(continuar ? { cmcontinue: continuar } : {}),
    });
    for (const miembro of datos.query?.categorymembers ?? []) titulos.push(miembro.title);
    continuar = datos.continue?.cmcontinue ?? null;
    await dormir(200);
  } while (continuar);

  return titulos;
}

function fichaDe(pagina) {
  const categorias = (pagina.categories ?? []).map((c) => c.title.replace("Category:", "").toLowerCase());

  const rol = categorias.map((c) => ROLES[c]).find(Boolean);
  const carriles = categorias.map((c) => CARRILES[c]).filter(Boolean);
  if (!rol || carriles.length === 0) return null;

  const natural = CARRIL_NATURAL[rol];
  const carril = carriles.includes(natural) ? natural : ORDEN_CARRILES.find((c) => carriles.includes(c));

  return {
    titulo: pagina.title,
    rol,
    carril,
    icono: pagina.thumbnail?.source ?? null,
  };
}

async function traerFichas(titulos) {
  const fichas = [];
  const descartados = [];

  for (let i = 0; i < titulos.length; i += LOTE) {
    const lote = titulos.slice(i, i + LOTE);
    const datos = await api({
      action: "query",
      prop: "categories|pageimages",
      cllimit: "500",
      piprop: "thumbnail",
      pithumbsize: "250",
      titles: lote.join("|"),
    });

    for (const pagina of Object.values(datos.query?.pages ?? {})) {
      const ficha = fichaDe(pagina);
      if (ficha) fichas.push(ficha);
      else descartados.push(pagina.title);
    }

    process.stdout.write(`  ${Math.min(i + LOTE, titulos.length)}/${titulos.length}\n`);
    await dormir(250);
  }

  return { fichas, descartados };
}

const curados = JSON.parse(readFileSync(join(raiz, "data", "heroes.json"), "utf8")).heroes;
const porId = new Map(curados.map((heroe) => [heroe.id, heroe]));

console.log("trayendo la lista de héroes…");
const titulos = await titulosDeHeroes();
console.log(`páginas en la categoría: ${titulos.length}`);

const { fichas, descartados } = await traerFichas(titulos);
console.log(`fichas de héroe: ${fichas.length}`);

const iconos = {};
for (const ficha of fichas) {
  if (ficha.icono) iconos[slug(ficha.titulo)] = ficha.icono;
}

const nuevos = fichas
  .filter((ficha) => !porId.has(slug(ficha.titulo)))
  .map((ficha) => ({
    id: slug(ficha.titulo),
    nombre: ficha.titulo,
    rol: ficha.rol,
    carril: ficha.carril,
    dificultad: 2,
    tier: "?",
    curado: false,
    tags: [],
    tips: [],
    counters: [],
    sinergias: [],
    wiki: ficha.titulo,
  }));

// Los curados conservan su orden y sus datos; si la wiki dice otro carril, manda
// el curado (está pensado para el drafter).
const salida = [
  ...curados.map((heroe) => ({ ...heroe, curado: heroe.curado ?? true })),
  ...nuevos.sort((a, b) => a.nombre.localeCompare(b.nombre)),
];

const dataset = JSON.parse(readFileSync(join(raiz, "data", "heroes.json"), "utf8"));
dataset.actualizado = new Date().toISOString().slice(0, 10);
dataset.heroes = salida;
writeFileSync(join(raiz, "data", "heroes.json"), `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

const iconosPrevios = JSON.parse(readFileSync(join(raiz, "data", "iconos.json"), "utf8"));
const iconosSalida = {
  fuente: iconosPrevios.fuente,
  actualizado: dataset.actualizado,
  heroes: { ...iconosPrevios.heroes, ...iconos },
  items: iconosPrevios.items ?? {},
};
writeFileSync(join(raiz, "data", "iconos.json"), `${JSON.stringify(iconosSalida, null, 2)}\n`, "utf8");

console.log(`\ntotal: ${salida.length} héroes (${curados.length} curados + ${nuevos.length} nuevos)`);
console.log(`retratos: ${Object.keys(iconosSalida.heroes).length}`);
console.log(`descartados (no son fichas de héroe): ${descartados.length}`);
