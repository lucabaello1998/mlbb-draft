// Verificación del dataset y de la maqueta, sin dependencias: `node scripts/check.mjs`.
//
// Lo que se rompe en silencio en un sitio de datos es el dato: un counter que
// apunta a un héroe que ya no existe, dos héroes con el mismo id, un tier que no
// es S/A/B/C o un tip vacío. También se revisa que el HTML no tenga ids repetidos
// y que las referencias locales existan.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const leer = (rel) => readFileSync(join(raiz, rel), "utf8");

let fallas = 0;
const ok = (nombre, cond, detalle = "") => {
  if (cond) console.log("  ok   ", nombre);
  else {
    fallas++;
    console.log("  FALLA", nombre, detalle ? "-> " + detalle : "");
  }
};

const datos = JSON.parse(leer("data/heroes.json"));
const heroes = datos.heroes ?? [];
const ids = new Set(heroes.map((h) => h.id));
const ROLES = new Set(["Marksman", "Mage", "Assassin", "Fighter", "Tank", "Support"]);
const CARRILES = new Set(["Oro", "Medio", "Exp", "Jungla", "Roam"]);
const TIERS = new Set(["S", "A", "B", "C"]);

console.log("== dataset ==");
ok("hay héroes", heroes.length >= 20, String(heroes.length));
ok("los ids son únicos", ids.size === heroes.length, `${ids.size} ids para ${heroes.length} héroes`);
ok("todos tienen nombre, rol, carril, tier y dificultad", heroes.every((h) =>
  h.nombre && h.rol && h.carril && h.tier && h.dificultad));
ok("los roles son los del juego", heroes.every((h) => ROLES.has(h.rol)));
ok("los carriles son los del juego", heroes.every((h) => CARRILES.has(h.carril)));
ok("los tiers son S/A/B/C", heroes.every((h) => TIERS.has(h.tier)));
ok("la dificultad va de 1 a 3", heroes.every((h) => [1, 2, 3].includes(h.dificultad)));
ok("cada héroe tiene al menos 3 tips", heroes.every((h) => (h.tips ?? []).length >= 3));
ok("ningún tip está vacío", heroes.every((h) => (h.tips ?? []).every((t) => typeof t === "string" && t.trim().length > 10)));
ok("los counters existen", heroes.every((h) => (h.counters ?? []).every((id) => ids.has(id))));
ok("las sinergias existen", heroes.every((h) => (h.sinergias ?? []).every((id) => ids.has(id))));
ok("cada rol tiene al menos 3 héroes", [...ROLES].every((rol) => heroes.filter((h) => h.rol === rol).length >= 3),
  [...ROLES].map((r) => `${r}: ${heroes.filter((h) => h.rol === r).length}`).join(" · "));
ok("cada carril tiene al menos 3 héroes", [...CARRILES].every((c) => heroes.filter((h) => h.carril === c).length >= 3));
ok("hay héroes en los cuatro tiers", [...TIERS].every((t) => heroes.some((h) => h.tier === t)));
ok("el dataset declara fecha", typeof datos.actualizado === "string" && /^\d{4}-\d{2}-\d{2}$/.test(datos.actualizado));

// Un counter que no es recíproco es sospechoso pero no un error; se informa.
const sinReciproco = [];
for (const heroe of heroes) {
  for (const otro of heroe.counters ?? []) {
    const objetivo = heroes.find((h) => h.id === otro);
    if (!objetivo) continue;
    if (!(objetivo.counters ?? []).some((x) => x === heroe.id)) {
      sinReciproco.push(`${heroe.id} -> ${otro}`);
    }
  }
}
if (sinReciproco.length) console.log(`  info   counters sin vuelta (normal): ${sinReciproco.length}`);

console.log("\n== html ==");
const html = leer("index.html");
const css = leer("assets/style.css");
const js = leer("assets/app.js");

const idsHtml = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const repetidos = idsHtml.filter((id, i) => idsHtml.indexOf(id) !== i);
ok("no hay ids repetidos", repetidos.length === 0, [...new Set(repetidos)].join(", "));

const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
const locales = [...new Set(refs)].filter((r) => !/^(?:https?:|data:|#|mailto:)/.test(r));
ok("las referencias locales existen", locales.every((r) => existsSync(join(raiz, r.split("?")[0]))), locales.join(", "));

// Los ids que el JS busca con $("#...") tienen que existir en el HTML: un typo
// deja media pantalla muerta sin que nada avise.
const buscados = [...js.matchAll(/\$\("#([a-zA-Z0-9_-]+)"\)/g)].map((m) => m[1]);
const faltantes = [...new Set(buscados)].filter((id) => !idsHtml.includes(id) && !id.startsWith("slots-") && !id.startsWith("conteo-") && !id.startsWith("equipo-") && !id.startsWith("ficha-"));
ok("los ids que usa el JS existen en el HTML", faltantes.length === 0, faltantes.join(", "));

ok("el CSS tiene las clases del drafter", [".slot", ".tier", ".heroe-mini", ".analisis"].every((c) => css.includes(c)));
ok("el JS escapa los textos que vienen del dataset", (js.match(/escapar\(/g) ?? []).length >= 20);

console.log("\n" + "=".repeat(60));
console.log(fallas === 0 ? "  Todo en orden." : `  ${fallas} problema(s).`);
process.exit(fallas === 0 ? 0 : 1);
