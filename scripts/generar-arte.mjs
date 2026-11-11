// Genera el arte del sitio: un retrato SVG por héroe y un ícono por categoría de
// ítem. Son ilustraciones propias (formas + iniciales), no arte oficial de Moonton:
// el repo se puede publicar sin arrastrar imágenes con copyright.
//
// Uso: node scripts/generar-arte.mjs

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const datos = JSON.parse(readFileSync(join(raiz, "data/heroes.json"), "utf8"));

const COLOR_ROL = {
  Marksman: ["#f3b64a", "#8a5a12"],
  Mage: ["#7c8cff", "#2c2a7a"],
  Assassin: ["#ff6b6b", "#7a1414"],
  Fighter: ["#e07a5f", "#7a2b1a"],
  Tank: ["#4cc9a0", "#0f5a45"],
  Support: ["#c084fc", "#5b2a8a"],
};

// Glifos por rol, dibujados con paths simples (viewBox 100x100).
const GLIFOS = {
  Tank: "M50 12 82 24v26c0 20-14 33-32 38-18-5-32-18-32-38V24Z",
  Fighter: "M30 70 64 36l8-8-2-4-4-2-8 8L24 64l-4 12zM44 32l14 14",
  Assassin: "M50 10 58 40 84 50 58 60 50 90 42 60 16 50 42 40Z",
  Mage: "M50 14 60 40 88 50 60 60 50 86 40 60 12 50 40 40Z",
  Marksman: "M22 78 74 26M64 22h14v14M30 58l12 12",
  Support: "M50 82S20 62 20 42a16 16 0 0 1 30-8 16 16 0 0 1 30 8c0 20-30 40-30 40Z",
};

const iniciales = (nombre) =>
  nombre
    .split(/[\s-]+/)
    .map((parte) => parte[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function retrato(heroe) {
  const [claro, oscuro] = COLOR_ROL[heroe.rol] ?? ["#8b93a7", "#2a2f3d"];
  const glifo = GLIFOS[heroe.rol] ?? GLIFOS.Tank;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="${heroe.nombre}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${claro}"/>
      <stop offset="1" stop-color="${oscuro}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="22" fill="url(#g)"/>
  <path d="M0 78 100 26v18L0 96Z" fill="#ffffff" opacity="0.08"/>
  <g transform="translate(18 18) scale(0.64)" fill="none" stroke="#0b0d13" stroke-opacity="0.55" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
    <path d="${glifo}"/>
  </g>
  <text x="50" y="63" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="30" font-weight="800" fill="#0b0d13" fill-opacity="0.82">${iniciales(heroe.nombre)}</text>
</svg>
`;
}

// Íconos de categoría de ítem (viewBox 48x48), también propios.
const ITEMS = {
  antiheal: {
    titulo: "Anti-curación",
    path: "M24 6c7 9 11 14 11 19a11 11 0 0 1-22 0c0-5 4-10 11-19Z M9 9l30 30",
  },
  armor: {
    titulo: "Armadura",
    path: "M24 5 41 11v10c0 10-7 17-17 21-10-4-17-11-17-21V11Z M24 13v22",
  },
  magia: {
    titulo: "Resistencia mágica",
    path: "M24 5 33 19 48 24 33 29 24 43 15 29 0 24 15 19Z M24 17v14",
  },
  penetracion: {
    titulo: "Penetración",
    path: "M6 42 30 18 M26 10l12 12 M30 18l8 8 M10 34l4 4",
  },
  velocidad: {
    titulo: "Movilidad",
    path: "M8 30h18l10-14 8 6-6 8H40l-8 12H8Z",
  },
  burst: {
    titulo: "Daño explosivo",
    path: "M24 4 29 18 43 24 29 30 24 44 19 30 5 24 19 18Z M24 16v16",
  },
  sustentar: {
    titulo: "Sustain",
    path: "M24 42C10 33 6 27 6 21a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 6-4 12-12 21Z",
  },
};

function iconoItem(clave, definicion) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${definicion.titulo}">
  <rect width="48" height="48" rx="12" fill="#171b25" stroke="#2c3346"/>
  <path d="${definicion.path}" fill="none" stroke="#d4af37" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>
</svg>
`;
}

const dirHeroes = join(raiz, "assets", "heroes");
const dirItems = join(raiz, "assets", "items");
mkdirSync(dirHeroes, { recursive: true });
mkdirSync(dirItems, { recursive: true });

for (const heroe of datos.heroes) {
  writeFileSync(join(dirHeroes, `${heroe.id}.svg`), retrato(heroe), "utf8");
}

for (const [clave, definicion] of Object.entries(ITEMS)) {
  writeFileSync(join(dirItems, `${clave}.svg`), iconoItem(clave, definicion), "utf8");
}

console.log(`retratos: ${datos.heroes.length} · íconos de ítem: ${Object.keys(ITEMS).length}`);
