// Resuelve los retratos oficiales de los héroes (y de los ítems de ejemplo) contra
// la API de la wiki de Mobile Legends y deja el mapa en data/iconos.json.
//
// Las imágenes NO se copian al repo: se apunta a su CDN. El arte es de Moonton; el
// repo sólo guarda las URLs, y el SVG propio (assets/heroes/*.svg) queda como
// respaldo si una imagen no carga o el CDN cambia.
//
// Uso: node scripts/iconos-oficiales.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const heroes = JSON.parse(readFileSync(join(raiz, "data", "heroes.json"), "utf8")).heroes;
const items = JSON.parse(readFileSync(join(raiz, "data", "items.json"), "utf8")).items;

const WIKI = "https://mobile-legends.fandom.com/api.php";
const AGENTE = "mlbb-draft/0.1 (+https://github.com/lucabaello1998/mlbb-draft)";

async function retrato(titulo) {
  const url = `${WIKI}?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=250&titles=${encodeURIComponent(titulo)}`;
  const respuesta = await fetch(url, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(20000) });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

  const datos = await respuesta.json();
  const pagina = Object.values(datos.query?.pages ?? {})[0] ?? {};
  if (!pagina.thumbnail?.source) throw new Error("sin imagen en la ficha");
  return pagina.thumbnail.source;
}

/**
 * El ícono de un ítem es el archivo `<Nombre>.png` de la wiki, no la imagen
 * principal de la página (esa suele ser una captura del efecto). Se descarta si
 * la wiki redirige a otro archivo: preferimos el glifo de categoría antes que el
 * ícono de un ítem distinto.
 */
async function iconoItem(nombre) {
  const archivo = `File:${nombre.replace(/ /g, "_")}.png`;
  const url = `${WIKI}?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=64&titles=${encodeURIComponent(archivo)}`;
  const respuesta = await fetch(url, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(20000) });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

  const datos = await respuesta.json();
  const pagina = Object.values(datos.query?.pages ?? {})[0] ?? {};
  const imagen = pagina.imageinfo?.[0]?.thumburl;
  if (!imagen) throw new Error("sin archivo con ese nombre");

  const archivoReal = decodeURIComponent(
    (new URL(imagen).pathname.split("/").find((parte) => /\.(png|jpe?g|webp)$/i.test(parte)) ?? "").toLowerCase(),
  );
  const esperado = `${nombre.replace(/ /g, "_")}.png`.toLowerCase();
  if (archivoReal !== esperado) throw new Error(`la wiki redirige a ${archivoReal || "otro archivo"}`);
  return imagen;
}

async function resolverTodo(lista, etiqueta, resolver) {
  const mapa = {};
  const faltan = [];

  for (const [indice, nombre] of lista.entries()) {
    try {
      mapa[nombre] = await resolver(nombre);
      process.stdout.write(`  ${etiqueta} ${indice + 1}/${lista.length}: ${nombre}\n`);
    } catch (error) {
      faltan.push(`${nombre} (${error.message})`);
    }
    // Sin apuro: es una API pública de una wiki.
    await new Promise((listo) => setTimeout(listo, 250));
  }

  return { mapa, faltan };
}

const nombresHeroes = heroes.map((h) => h.nombre);
const ejemplosItems = [...new Set(items.flatMap((item) => item.ejemplos ?? []))];

console.log(`héroes: ${nombresHeroes.length} · ítems de ejemplo: ${ejemplosItems.length}`);

const { mapa: mapaHeroes, faltan: faltanHeroes } = await resolverTodo(nombresHeroes, "héroe", retrato);
const { mapa: mapaItems, faltan: faltanItems } = await resolverTodo(ejemplosItems, "ítem", iconoItem);

// Las claves de héroes van por id (es lo que usa la app); las de ítems, por nombre.
const porId = {};
for (const heroe of heroes) {
  if (mapaHeroes[heroe.nombre]) porId[heroe.id] = mapaHeroes[heroe.nombre];
}

const salida = {
  fuente: "Mobile Legends Wiki (Fandom) — arte de Moonton, usado por referencia",
  actualizado: new Date().toISOString().slice(0, 10),
  heroes: porId,
  items: mapaItems,
};

writeFileSync(join(raiz, "data", "iconos.json"), `${JSON.stringify(salida, null, 2)}\n`, "utf8");

console.log(`\nresueltos: ${Object.keys(porId).length}/${heroes.length} héroes · ${Object.keys(mapaItems).length}/${ejemplosItems.length} ítems`);
if (faltanHeroes.length) console.log("sin retrato (queda el SVG propio):", faltanHeroes.join(", "));
if (faltanItems.length) console.log("ítems sin imagen:", faltanItems.join(", "));
