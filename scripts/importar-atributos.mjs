// Atributos oficiales de cada héroe desde el infobox de la wiki: rol, carril,
// especialidad, tipo de daño, alcance, dificultad y los ratings 1-10.
//
// Sirven para dos cosas:
//   - reemplazar la dificultad inventada (todos tenían 2) por la oficial, en escala 1-3;
//   - sacar los tags de datos reales ("físico", "melee", "chase", "finisher"...).
//
// Uso: node scripts/importar-atributos.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const WIKI = "https://mobile-legends.fandom.com/api.php";
const AGENTE = "mlbb-draft/0.1 (atributos; +https://github.com/lucabaello1998/mlbb-draft)";
const dormir = (ms) => new Promise((listo) => setTimeout(listo, ms));

async function parse(titulo) {
  const url = `${WIKI}?format=json&action=parse&prop=text&page=${encodeURIComponent(titulo)}`;
  const r = await fetch(url, { headers: { "User-Agent": AGENTE }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** Saca el valor visible de cada `data-source` del infobox. */
function infobox(html) {
  const datos = {};
  const re = /data-source="([^"]+)"[\s\S]{0,600}?class="pi-data-value[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(html))) {
    const texto = m[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&#0?39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
    if (texto && !datos[m[1]]) datos[m[1]] = texto;
  }
  return datos;
}

// Las especialidades vienen en inglés: al tag visible se traducen, pero
// `atributos.especialidad` queda en el idioma de la fuente para la lógica.
const TRADUCCION_ESPECIALIDAD = {
  finisher: "rematador",
  chase: "persecución",
  burst: "burst",
  poke: "poke",
  "crowd control": "control",
  initiator: "iniciador",
  damage: "daño",
  support: "soporte",
  heal: "curación",
  guard: "protección",
  regen: "regeneración",
  push: "empuje",
  "magic damage": "daño mágico",
  "physical damage": "daño físico",
  escape: "escape",
  "true damage": "daño verdadero",
};

const escala = (valor) => {
  const n = Number.parseInt(valor, 10);
  if (!Number.isFinite(n)) return null;
  if (n <= 3) return 1;
  if (n <= 6) return 2;
  return 3;
};

const dataset = JSON.parse(readFileSync(join(raiz, "data", "heroes.json"), "utf8"));
const tituloDe = (h) => h.wiki ?? h.nombre;

let ok = 0;
const fallas = [];

for (const [indice, heroe] of dataset.heroes.entries()) {
  const titulo = tituloDe(heroe);
  try {
    const datos = await parse(titulo);
    const caja = infobox(datos.parse?.text?.["*"] ?? "");
    if (!caja.difficulty && !caja.dmg_type) {
      fallas.push(`${heroe.nombre} (sin infobox)`);
      continue;
    }

    const especialidad = (caja.specialty ?? "")
      .split("/")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const dano = (caja.dmg_type ?? "").toLowerCase();
    const alcance = (caja.atk_type ?? "").toLowerCase();

    heroe.atributos = {
      dano: dano.startsWith("phys") ? "físico" : dano.startsWith("mag") ? "mágico" : "mixto",
      alcance: alcance.startsWith("melee") ? "melee" : alcance.startsWith("ranged") ? "ranged" : null,
      especialidad,
      durabilidad: Number(caja.durability) || null,
      ofensiva: Number(caja.offense) || null,
      control: Number(caja["control effect"]) || null,
      dificultadOficial: Number(caja.difficulty) || null,
      recurso: (caja.resource ?? "").toLowerCase() || null,
    };

    const oficial = escala(caja.difficulty);
    if (oficial) heroe.dificultad = oficial;

    // Los tags que ya escribí a mano se respetan; los oficiales se suman.
    const tags = new Set((heroe.tags ?? []).map((t) => t.toLowerCase()));
    if (heroe.atributos.dano) tags.add(heroe.atributos.dano);
    if (heroe.atributos.alcance) tags.add(heroe.atributos.alcance);
    for (const e of especialidad) tags.add(TRADUCCION_ESPECIALIDAD[e] ?? e);
    // "mágico" y "daño mágico" son lo mismo: se queda el corto.
    if (tags.has("mágico")) tags.delete("daño mágico");
    if (tags.has("físico")) tags.delete("daño físico");
    heroe.tags = [...tags];

    ok++;
  } catch (error) {
    fallas.push(`${heroe.nombre} (${error.message})`);
  }
  if ((indice + 1) % 20 === 0) process.stdout.write(`  ${indice + 1}/${dataset.heroes.length}\n`);
  await dormir(200);
}

dataset.atributosFuente = "mobile-legends.fandom.com (infobox de cada héroe)";
writeFileSync(join(raiz, "data", "heroes.json"), `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

console.log(`\ncon atributos: ${ok}/${dataset.heroes.length}`);
if (fallas.length) console.log(`fallas (${fallas.length}): ${fallas.join(", ")}`);
