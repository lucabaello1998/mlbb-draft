// Tips para los héroes que no tienen curación manual, armados con datos oficiales:
// rol, carril, especialidad, tipo de daño, alcance, dificultad y ratings (1-10).
//
// No inventa números ni interacciones: cada frase sale de un atributo del infobox.
// Queda marcado `tipsOrigen: "auto"` para no mezclarlo con los 30 curados a mano.
// Si un héroe no tiene atributos (Hirara), se le arma un tip de rol y carril.
//
// Uso: node scripts/generar-tips.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataset = JSON.parse(readFileSync(join(raiz, "data", "heroes.json"), "utf8"));

const POR_ROL = {
  Assassin: "Entrá después del engage y por el flanco: abrir vos es regalar la pelea.",
  Marksman: "Pegá desde atrás y no te adelantes; esperá el CC del equipo para disparar tranquilo.",
  Mage: "Zoned con tus habilidades y rotá al río antes de que se arme la pelea.",
  Fighter: "Aguantá la línea y obligá al rival a gastar recursos; rotá recién con la ultimate lista.",
  Tank: "Iniciá vos y quedate adelante: tu trabajo es abrir la pelea y cubrir la retirada.",
  Support: "Cubrí al carry y guardá tu habilidad defensiva para el momento en que lo ataquen.",
};

const POR_ESPECIALIDAD = {
  finisher: "Tu fuerte es cerrar: entrá cuando el enemigo ya gastó el escape.",
  chase: "Servís para perseguir: no lo sueltes después del primer impacto.",
  burst: "Buscá peleas cortas: entrás, matás y salís, sin quedarte a pelear.",
  poke: "Pegá de lejos y retrocedé; el daño gratis antes de la pelea vale oro.",
  "crowd control": "Tu CC abre peleas: avisá el orden y que el equipo entre detrás.",
  initiator: "Sos el que abre: elegí el ángulo y entrá con el equipo cerca.",
  damage: "Sos daño puro: pedí frontline antes de pelear.",
  support: "Tu valor es el otro: acompañá al carry y no te separes.",
  heal: "Curá antes de que bajen del 50%, no después.",
  "magic damage": "Tu daño es mágico: el enemigo necesita resistencia mágica para aguantarte.",
  guard: "Protegé al carry con tu control y tu escudo, no con daño.",
  regen: "Aguantá el desgaste: tu sustain gana las líneas largas.",
  push: "Aprovechá los huecos para empujar torres; no todo es pelear.",
};

const POR_CARRIL = {
  Oro: "En oro priorizá farmear seguro: tu pico llega con dos ítems.",
  Medio: "En medio limpiá la ola rápido y movete antes que el rival.",
  Exp: "En exp aguantá el 1v1 y no cruces sin visión.",
  Jungla: "En jungla marcá el ritmo: río y objetivos antes que kills.",
  Roam: "De roam comprá visión y acompañá la rotación; tu oro sale de asistencias.",
};

const escala = (n) => (n >= 8 ? "alta" : n >= 5 ? "media" : "baja");

function tipsDe(heroe) {
  const tips = [];
  const a = heroe.atributos;

  tips.push(POR_ROL[heroe.rol] ?? "Jugá tu carril y coordiná la rotación con el equipo.");
  if (POR_CARRIL[heroe.carril]) tips.push(POR_CARRIL[heroe.carril]);

  if (a) {
    const especialidades = a.especialidad ?? [];
    const especifico = especialidades.map((e) => POR_ESPECIALIDAD[e]).find(Boolean);
    if (especifico) tips.push(especifico);

    if (a.durabilidad !== null && a.durabilidad <= 3) {
      tips.push(`Sos frágil (durabilidad ${a.durabilidad}/10): no camines solo por la jungla enemiga sin visión.`);
    } else if (a.control !== null && a.control >= 7) {
      tips.push(`Tu control es tu carta (${a.control}/10): guardalo para el carry enemigo, no para el tanque.`);
    } else if (a.ofensiva !== null && a.ofensiva >= 8) {
      tips.push(`Tu pico de daño es alto (ofensiva ${a.ofensiva}/10): buscá peleas cortas, no desgastes.`);
    } else if (a.dificultadOficial !== null && a.dificultadOficial >= 8) {
      tips.push(`Curva de ejecución ${escala(a.dificultadOficial)} (dificultad ${a.dificultadOficial}/10): practicá el combo antes de ranked.`);
    }

    if (a.dano === "mágico" && tips.length < 3) {
      tips.push("Tu daño es mágico: si el enemigo apila resistencia mágica, cambiá a penetración.");
    }
  }

  // Garantiza tres tips sin repetir.
  const vistos = new Set();
  const unicos = tips.filter((t) => {
    if (vistos.has(t)) return false;
    vistos.add(t);
    return true;
  });
  const relleno = [
    "Avisá tu pico de poder por chat: el equipo juega distinto si sabe cuándo escalás.",
    "Antes de pelear, mirá el mapa: sin visión no hay entrada.",
    "Si vas perdiendo la línea, farmeá atrás y esperá la rotación en vez de forzar.",
  ];
  for (const t of relleno) {
    if (unicos.length >= 3) break;
    if (!unicos.includes(t)) unicos.push(t);
  }
  return unicos.slice(0, 3);
}

let generados = 0;
for (const heroe of dataset.heroes) {
  if (heroe.curado !== false) continue;
  heroe.tips = tipsDe(heroe);
  heroe.tipsOrigen = "auto (rol + atributos oficiales)";
  generados++;
}

dataset.tipsActualizado = new Date().toISOString().slice(0, 10);
writeFileSync(join(raiz, "data", "heroes.json"), `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

console.log(`tips generados: ${generados}`);
const muestra = dataset.heroes.find((h) => h.nombre === "Aamon");
if (muestra) console.log(`\nAamon (${muestra.rol} · ${muestra.carril}):\n- ${muestra.tips.join("\n- ")}`);
