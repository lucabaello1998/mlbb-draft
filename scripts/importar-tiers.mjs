// Tiers desde cuatro fuentes públicas, con fecha y sin inventar nada.
//
// Fuentes (todas de noviembre 2026):
//   1. AxeeTech: publica un JSON embebido con los 133 héroes, su tier, rol, carril
//      y notas con winrate/banrate medidos (consenso MLBB Hub + MLCounters).
//   2. Pocket Gamer: tablas por rol con S+ a D.
//   3. Zathong: tabla S+ a D.
//   4. Esports.net: tabla por tier (más vieja, febrero 2026).
//
// Guardamos la letra de cada fuente, el consenso (promedio) y las notas medidas.
// Si un héroe no aparece en ninguna, queda "?" con `tierOrigen: "sin fuente"`.
//
// Uso: node scripts/importar-tiers.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const FUENTES = [
  { id: "axeetech", nombre: "AxeeTech (MLBB Hub + MLCounters)", url: "https://axeetech.com/mlbb-hero-tier-list/", peso: 2 },
  { id: "pocketgamer", nombre: "Pocket Gamer", url: "https://www.pocketgamer.com/mobile-legends-bang-bang/tier-list/" },
  { id: "zathong", nombre: "Zathong", url: "https://zathong.com/mobile-legends-tier-list/" },
  { id: "esportsnet", nombre: "Esports.net", url: "https://www.esports.net/wiki/guides/mlbb-tier-list/" },
];

const VALOR = { "S+": 4, S: 4, A: 3, B: 2, C: 1, D: 0 };
const LETRA = { 4: "S", 3: "A", 2: "B", 1: "C", 0: "C" };

const normalizar = (texto) =>
  String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function traer(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" } });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.text();
}

/** AxeeTech: JSON embebido con rows [{n, t, r, p, pro}] */
function leerAxeeTech(html) {
  const m = html.match(/<script type="application\/json" id="mlbt-data">([\s\S]*?)<\/script>/);
  if (!m) return { filas: [], notas: new Map(), fecha: null };
  const datos = JSON.parse(m[1]);
  const notas = new Map();
  for (const fila of datos.rows ?? []) {
    notas.set(normalizar(fila.n), (fila.pro ?? []).slice(0, 3));
  }
  return {
    filas: (datos.rows ?? []).map((f) => ({ nombre: f.n, tier: f.t })),
    notas,
    fecha: datos.upd ?? null,
  };
}

/** Pocket Gamer: tablas por rol, `<td>S+</td><td>Yin, Paquito, ...</td>`. */
function leerPocketGamer(html) {
  const filas = [];
  const re = /<td>\s*([SABCD]\+?)\s*<\/td>\s*<td>([\s\S]*?)<\/td>/g;
  let m;
  while ((m = re.exec(html))) {
    const nombres = m[2]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .split(",")
      .map((n) => n.replace(/^Celestial Empress\s*-\s*/i, "").trim())
      .filter((n) => n && n !== "-" && !/tier/i.test(n));
    for (const nombre of nombres) filas.push({ nombre, tier: m[1].toUpperCase() });
  }
  const fecha = (html.match(/Updated on ([A-Z][a-z]+ \d{1,2}(?:st|nd|rd|th)?,? \d{4})/) ?? [])[1] ?? null;
  return { filas, fecha };
}

/** Zathong: tabla S+ a D con nombres separados por coma. */
function leerZathong(html) {
  const filas = [];
  const re = /<tr>\s*<td[^>]*>\s*([SABCD]\+?)\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/g;
  let m;
  while ((m = re.exec(html))) {
    const nombres = m[2]
      .split(/<br\s*\/?>/i)[0]
      .replace(/<[^>]+>/g, "")
      .split(",")
      .map((n) => n.replace(/[’']/g, "'").replace(/\.$/, "").trim())
      .filter((n) => n && n.length > 1 && !/tier|hero/i.test(n));
    for (const nombre of nombres) filas.push({ nombre, tier: m[1].toUpperCase() });
  }
  return { filas, fecha: null };
}

/** Esports.net: tabla por tier con nombres separados por coma. */
function leerEsportsNet(html) {
  const filas = [];
  const re = /<td[^>]*>\s*<strong>\s*([SABCD]\+?)\s*<\/strong>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g;
  let m;
  while ((m = re.exec(html))) {
    const nombres = m[2]
      .replace(/<[^>]+>/g, "")
      .split(/,| and /)
      .map((n) => n.trim())
      .filter(Boolean);
    for (const nombre of nombres) filas.push({ nombre, tier: m[1].toUpperCase() });
  }
  const fecha = (html.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/) ?? [])[0] ?? null;
  return { filas, fecha };
}

const LECTORES = {
  axeetech: leerAxeeTech,
  pocketgamer: leerPocketGamer,
  zathong: leerZathong,
  esportsnet: leerEsportsNet,
};

// Alias: la clave y el valor van normalizados, como las claves del dataset.
const ALIAS = new Map([
  ["yi sunshin", "yi sun shin"],
  ["popol and kupa", "popol and kupa"],
  ["guinievere", "guinevere"],
  ["x borg", "x borg"],
]);

const dataset = JSON.parse(readFileSync(join(raiz, "data", "heroes.json"), "utf8"));
const porNombre = new Map(dataset.heroes.map((h) => [normalizar(h.nombre), h]));
const buscarHeroe = (nombre) => {
  const clave = normalizar(nombre);
  return porNombre.get(ALIAS.get(clave) ?? clave);
};

const resultado = new Map(); // id -> { fuentes, valores, notas }
const sinUsar = [];
const hoy = new Date().toISOString().slice(0, 10);

for (const fuente of FUENTES) {
  console.log(`\n${fuente.nombre}`);
  let datos = { filas: [], fecha: null, notas: new Map() };
  try {
    datos = LECTORES[fuente.id](await traer(fuente.url));
  } catch (error) {
    console.log(`  ERROR: ${error.message}`);
    continue;
  }
  let mapeadas = 0;
  for (const fila of datos.filas) {
    const heroe = buscarHeroe(fila.nombre);
    if (!heroe) {      sinUsar.push(`${fuente.id}: ${fila.nombre}`);
      continue;
    }
    mapeadas++;
    const actual = resultado.get(heroe.id) ?? { fuentes: {}, valores: [], notas: [], fechas: [] };
    actual.fuentes[fuente.id] = fila.tier;
    for (let i = 0; i < (fuente.peso ?? 1); i++) actual.valores.push(VALOR[fila.tier] ?? 2);
    const notas = datos.notas ?? new Map();
    if (notas.get(normalizar(fila.nombre))?.length) {
      actual.notas = notas.get(normalizar(fila.nombre));
    }
    if (datos.fecha) actual.fechas.push(`${fuente.nombre}: ${datos.fecha}`);
    resultado.set(heroe.id, actual);
  }
  console.log(`  filas: ${datos.filas.length} · mapeadas: ${mapeadas} · fecha: ${datos.fecha ?? "sin fecha"}`);
}

let conTier = 0;
for (const heroe of dataset.heroes) {
  const dato = resultado.get(heroe.id);
  if (!dato) {
    heroe.tier = "?";
    heroe.tierOrigen = "sin fuente";
    delete heroe.tierFuentes;
    delete heroe.metaNotas;
    continue;
  }
  // La fuente con winrate/banrate medidos manda; las editoriales corroboran.
  // Si el héroe no está ahí, se usa el consenso de las otras.
  const promedio = dato.valores.reduce((a, b) => a + b, 0) / dato.valores.length;
  const curado = heroe.curado !== false && heroe.tier !== "?";
  const medido = dato.fuentes.axeetech;
  const tierMedido = medido ? (medido === "S+" ? "S" : medido === "D" ? "C" : medido) : null;
  heroe.tier = curado ? heroe.tier : tierMedido ?? LETRA[Math.round(promedio)];
  heroe.tierOrigen = curado
    ? "curado a mano"
    : tierMedido
      ? "medido (MLBB Hub + MLCounters)"
      : `consenso de ${Object.keys(dato.fuentes).length} fuentes`;
  heroe.tierFuentes = dato.fuentes;
  // Disparidad entre las fuentes actuales (Esports.net es de febrero: no cuenta).
  const valores = Object.entries(dato.fuentes)
    .filter(([f]) => f !== "esportsnet")
    .map(([, t]) => VALOR[t] ?? 2);
  heroe.tierDisparidad = valores.length > 1 && Math.max(...valores) - Math.min(...valores) >= 2;
  if (dato.notas.length) heroe.metaNotas = dato.notas.slice(0, 4);
  else delete heroe.metaNotas;
  heroe.tierFecha = hoy;
  conTier++;
}

dataset.tierFuentes = FUENTES.map((f) => ({ nombre: f.nombre, url: f.url }));
dataset.tierActualizado = hoy;
writeFileSync(join(raiz, "data", "heroes.json"), `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

console.log(`\ncon tier: ${conTier}/${dataset.heroes.length}`);
const sinFuente = dataset.heroes.filter((h) => h.tier === "?").map((h) => h.nombre);
if (sinFuente.length) console.log(`sin fuente: ${sinFuente.join(", ")}`);
console.log(`sin mapear (${sinUsar.length}): ${sinUsar.slice(0, 20).join(", ")}`);
