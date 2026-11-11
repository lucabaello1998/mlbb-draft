// MLBB Draft: tier list, drafter y fichas, todo desde data/heroes.json.
// Sin dependencias y sin build: el mismo archivo que se sirve es el que se edita.

const CARRILES = ["Oro", "Medio", "Exp", "Jungla", "Roam"];
const TIERS = ["S", "A", "B", "C", "?"];

const estado = {
  heroes: [],
  porId: new Map(),
  vista: "tier",
  rol: "",
  rolPool: "",
  rolHeroes: "",
  busqueda: "",
  activo: "alido", // qué equipo recibe el próximo pick
  alido: {}, // carril -> id
  enemigo: {},
};

const $ = (sel) => document.querySelector(sel);
const escapar = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function avatar(heroe, tamano = 40) {
  // Retrato oficial desde la wiki (no se copia al repo) y, si no está o falla el
  // CDN, el SVG propio que genera scripts/generar-arte.mjs.
  const local = `assets/heroes/${encodeURIComponent(heroe.id)}.svg`;
  const oficial = estado.iconos?.heroes?.[heroe.id];
  const src = oficial || local;
  const respaldo = oficial ? ` onerror="this.onerror=null;this.src='${local}'"` : "";
  return `<img class="heroe-avatar" src="${escapar(src)}" alt="" width="${tamano}" height="${tamano}"${respaldo}>`;
}

function insignia(tier) {
  const colores = { S: "#ef4444", A: "#f59e0b", B: "#3b82f6", C: "#64748b", "?": "#4b5563" };
  const texto = tier === "?" ? "?" : tier;
  return `<span class="insignia" title="${tier === "?" ? "Sin clasificar" : "Tier " + tier}" style="background:${colores[tier] ?? "#64748b"}">${escapar(texto)}</span>`;
}

function coincide(heroe) {
  const q = estado.busqueda.trim().toLowerCase();
  if (!q) return true;
  return [heroe.nombre, heroe.rol, heroe.carril, ...(heroe.tags ?? [])]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

// --- pintado ---------------------------------------------------------------

// Chips de filtro: se pintan UNA vez y el click sólo cambia aria-pressed. Antes
// cada click rehacía el innerHTML y, en el celular, el botón desaparecía bajo el
// dedo: había que tocar dos veces.
function montarChips(contenedor, obtener, setter, repintar) {
  const roles = ["", ...new Set(estado.heroes.map((h) => h.rol).filter(Boolean))];

  contenedor.innerHTML = roles
    .map(
      (rol) =>
        `<button class="chip" type="button" data-rol="${escapar(rol)}" aria-pressed="${
          obtener() === rol ? "true" : "false"
        }">${rol || "Todos"}</button>`,
    )
    .join("");

  contenedor.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[data-rol]");
    if (!boton) return;
    setter(boton.dataset.rol);
    for (const chip of contenedor.querySelectorAll("[data-rol]")) {
      chip.setAttribute("aria-pressed", String(chip.dataset.rol === obtener()));
    }
    repintar();
  });
}

function pintarTier() {
  const visibles = estado.heroes.filter((h) => (!estado.rol || h.rol === estado.rol) && coincide(h));
  const contenedor = $("#tiers");

  if (!visibles.length) {
    contenedor.innerHTML = `<p class="vacio">Ningún héroe coincide con el filtro.</p>`;
    return;
  }

  contenedor.innerHTML = TIERS.map((tier) => {
    const grupo = visibles.filter((h) => h.tier === tier).sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (!grupo.length) return "";
    return `
      <div class="tier tier-${tier === "?" ? "sin" : tier.toLowerCase()}">
        <div class="tier-letra">${tier === "?" ? "?" : tier}</div>
        <div class="tier-cuerpo">
          <div class="tier-grid">
            ${grupo
              .map(
                (h) => `<button class="heroe-mini" type="button" data-heroe="${escapar(h.id)}">
                  ${avatar(h, 40)}
                  <span><span class="nombre">${escapar(h.nombre)}</span><br><span class="rol">${escapar(h.rol)} · ${escapar(h.carril)}</span></span>
                </button>`,
              )
              .join("")}
          </div>
        </div>
      </div>`;
  }).join("");

  contenedor.querySelectorAll("[data-heroe]").forEach((boton) => {
    boton.addEventListener("click", () => abrirFicha(boton.dataset.heroe));
  });
}

function pintarHeroes() {
  const visibles = estado.heroes
    .filter((h) => (!estado.rolHeroes || h.rol === estado.rolHeroes) && coincide(h))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  $("#grilla-heroes").innerHTML = visibles
    .map(
      (h) => `
      <button class="tarjeta" type="button" data-heroe="${escapar(h.id)}">
        <div style="display:flex;align-items:center;gap:8px">
          ${avatar(h, 64)}
          ${insignia(h.tier)}
          <span class="meta" style="margin-left:auto">${escapar(h.carril)}</span>
        </div>
        <h3>${escapar(h.nombre)}</h3>
        <div class="meta">${escapar(h.rol)} · ${
          h.curado === false ? "sin curar" : `dificultad ${"●".repeat(h.dificultad)}${"○".repeat(3 - h.dificultad)}`
        }</div>
        <div class="tags">${(h.tags ?? []).map((t) => `<span class="tag">${escapar(t)}</span>`).join("")}${
          h.curado === false ? '<span class="tag">sin tips</span>' : ""
        }</div>
      </button>`,
    )
    .join("");

  $("#grilla-heroes").querySelectorAll("[data-heroe]").forEach((boton) => {
    boton.addEventListener("click", () => abrirFicha(boton.dataset.heroe));
  });
}

// --- drafter ---------------------------------------------------------------

function equipoActual() {
  return estado.activo === "alido" ? estado.alido : estado.enemigo;
}

function pintarSlots() {
  for (const lado of ["alido", "enemigo"]) {
    const equipo = estado[lado];
    const contenedor = $(`#slots-${lado}`);
    contenedor.innerHTML = CARRILES.map((carril) => {
      const id = equipo[carril];
      const heroe = id ? estado.porId.get(id) : null;
      return `
        <div class="slot ${heroe ? "lleno" : ""}">
          <span class="carril">${carril}</span>
          ${heroe ? `${avatar(heroe, 30)}<span>${escapar(heroe.nombre)}</span>` : `<span class="vacio">—</span>`}
          ${heroe ? `<button class="quitar" type="button" data-quitar="${lado}" data-carril="${carril}" aria-label="Quitar ${escapar(heroe.nombre)}">×</button>` : ""}
        </div>`;
    }).join("");
    $(`#conteo-${lado}`).textContent = `${Object.keys(equipo).length}/5`;
  }

  $("#equipo-alido").classList.toggle("activo", estado.activo === "alido");
  $("#equipo-enemigo").classList.toggle("activo", estado.activo === "enemigo");

  contenedorEventos();
}

function contenedorEventos() {
  document.querySelectorAll("[data-quitar]").forEach((boton) => {
    boton.addEventListener("click", () => {
      delete estado[boton.dataset.quitar][boton.dataset.carril];
      guardar();
      pintarSlots();
      pintarAnalisis();
      pintarPool();
    });
  });
}

function elegidos(lado) {
  return Object.values(estado[lado]).map((id) => estado.porId.get(id)).filter(Boolean);
}

function todosElegidos() {
  return [...elegidos("alido"), ...elegidos("enemigo")];
}

function pintarPool() {
  const usados = new Set(todosElegidos().map((h) => h.id));
  const visibles = estado.heroes
    .filter((h) => (!estado.rolPool || h.rol === estado.rolPool) && coincide(h) && !usados.has(h.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const pool = $("#pool");
  if (!visibles.length) {
    pool.innerHTML = `<p class="vacio">No quedan héroes con ese filtro.</p>`;
    return;
  }

  pool.innerHTML = visibles
    .map(
      (h) => `<button class="heroe-mini" type="button" data-elegir="${escapar(h.id)}" title="Agregar al equipo activo">
        ${avatar(h, 30)}<span class="nombre">${escapar(h.nombre)}</span>
        <span class="rol" style="margin-left:6px">${escapar(h.carril)}</span>
      </button>`,
    )
    .join("");

  pool.querySelectorAll("[data-elegir]").forEach((boton) => {
    boton.addEventListener("click", () => elegir(boton.dataset.elegir));
  });
}

function elegir(id) {
  const heroe = estado.porId.get(id);
  if (!heroe) return;

  const equipo = equipoActual();
  // Si su carril está ocupado, cae en el primero libre; si el equipo está lleno, avisa.
  const carrilLibre = equipo[heroe.carril] ? CARRILES.find((c) => !equipo[c]) : heroe.carril;
  if (!carrilLibre) {
    alert("El equipo ya tiene 5 héroes. Quitá uno para cambiarlo.");
    return;
  }

  equipo[carrilLibre] = heroe.id;
  guardar();
  pintarSlots();
  pintarAnalisis();
  pintarPool();
}

function counterDe(enemigos) {
  // `contadores` guarda quién ME contrarresta: para contrarrestar a un enemigo
  // busco los héroes que aparecen en SU lista.
  const ids = new Set();
  for (const enemigo of enemigos) {
    for (const id of enemigo.counters ?? []) ids.add(id);
  }
  return [...ids].map((id) => estado.porId.get(id)).filter(Boolean);
}

function sinergiasDe(mios) {
  const ids = new Set();
  for (const heroe of mios) {
    for (const id of heroe.sinergias ?? []) ids.add(id);
    for (const otro of mios) {
      if (otro !== heroe && (heroe.sinergias ?? []).includes(otro.id)) ids.add(otro.id);
    }
  }
  for (const otro of mios) ids.delete(otro.id);
  return [...ids].map((id) => estado.porId.get(id)).filter(Boolean);
}

function pintarSugerencias(contenedor, heroes, vacio) {
  const yaElegidos = new Set(todosElegidos().map((h) => h.id));
  const libres = heroes.filter((h) => !yaElegidos.has(h.id));
  if (!libres.length) {
    contenedor.innerHTML = `<span class="vacio">${vacio}</span>`;
    return;
  }
  contenedor.innerHTML = libres
    .map(
      (h) => `<button class="heroe-mini" type="button" data-sugerido="${escapar(h.id)}">
        ${avatar(h, 30)}<span class="nombre">${escapar(h.nombre)}</span>
        <span class="rol" style="margin-left:6px">${escapar(h.carril)}</span>
      </button>`,
    )
    .join("");
  contenedor.querySelectorAll("[data-sugerido]").forEach((boton) => {
    boton.addEventListener("click", () => elegir(boton.dataset.sugerido));
  });
}

const ATRIBUTOS = [
  { clave: "frontline", nombre: "Frontline" },
  { clave: "engage", nombre: "Engage / CC" },
  { clave: "sustain", nombre: "Sustain" },
  { clave: "poke", nombre: "Poke" },
  { clave: "movilidad", nombre: "Movilidad" },
  { clave: "late", nombre: "Late game" },
];

/**
 * Perfil de un héroe derivado de su rol y sus tags (no hay stats inventados).
 * El mapeo está documentado en el README para poder ajustarlo.
 */
function atributos(heroe) {
  const tags = (heroe.tags ?? []).map((t) => t.toLowerCase());
  const tiene = (...claves) => claves.some((clave) => tags.some((t) => t.includes(clave)));
  const a = { frontline: 0, engage: 0, sustain: 0, poke: 0, movilidad: 0, late: 1 };

  if (heroe.rol === "Tank") a.frontline = 3;
  else if (heroe.rol === "Fighter") a.frontline = 2;
  else if (heroe.rol === "Support") a.frontline = 1;

  if (heroe.rol === "Tank") a.engage = tiene("engage") ? 3 : 2;
  else if (heroe.rol === "Fighter") a.engage = tiene("cc") ? 2 : 1;
  else if ((heroe.rol === "Support" || heroe.rol === "Assassin") && tiene("cc", "engage", "anti-dash")) a.engage = 1;

  if (heroe.rol === "Support") a.sustain = tiene("heal", "sustain") ? 3 : 2;
  else if (tiene("sustain", "escudo")) a.sustain = 2;

  if (heroe.rol === "Mage") a.poke = tiene("poke", "rango") ? 3 : 2;
  else if (heroe.rol === "Marksman") a.poke = 1;

  if (heroe.rol === "Assassin") a.movilidad = 2;
  if (tiene("movilidad", "dash", "muros")) a.movilidad += 2;
  a.movilidad = Math.min(5, a.movilidad);

  if (tiene("late game")) a.late = 3;
  else if (heroe.rol === "Marksman") a.late = 2;

  return a;
}

function perfil(heroes) {
  const totales = Object.fromEntries(ATRIBUTOS.map((a) => [a.clave, 0]));
  let fisico = 0;
  let magico = 0;

  for (const heroe of heroes) {
    const props = atributos(heroe);
    for (const { clave } of ATRIBUTOS) totales[clave] += props[clave];
    if (heroe.rol === "Marksman" || heroe.rol === "Assassin" || heroe.rol === "Fighter") fisico++;
    if (heroe.rol === "Mage" || heroe.rol === "Support") magico++;
  }

  return { totales, fisico, magico, heroes: heroes.length };
}

function pintarVentajas() {
  const mio = perfil(elegidos("alido"));
  const suyo = perfil(elegidos("enemigo"));
  const contenedor = $("#ventajas");

  if (!mio.heroes && !suyo.heroes) {
    contenedor.innerHTML = `<span class="vacio">Elegí héroes para ver la comparación.</span>`;
    $("#resumen-ventajas").textContent = "";
    return;
  }

  // La barra se escala al máximo de las dos, así la diferencia se ve en todas
  // las filas (si no, 5 contra 5 se ve igual de corto que 1 contra 1).
  contenedor.innerHTML = ATRIBUTOS.map(({ clave, nombre }) => {
    const a = mio.totales[clave];
    const b = suyo.totales[clave];
    const maximo = Math.max(a, b, 1);
    const ventaja = a > b ? "a" : b > a ? "b" : "";
    return `
      <div class="fila-comp">
        <span class="nombre">${nombre}</span>
        <div class="barras">
          <i class="barra propio ${ventaja === "a" ? "gana" : ""}" style="width:${(a / maximo) * 100}%"></i>
          <i class="barra rival ${ventaja === "b" ? "gana" : ""}" style="width:${(b / maximo) * 100}%"></i>
        </div>
        <span class="valores">${a} · ${b}</span>
      </div>`;
  }).join("");

  const difs = ATRIBUTOS.map(({ clave, nombre }) => ({ nombre, dif: mio.totales[clave] - suyo.totales[clave] }));
  const aFavor = difs.filter((d) => d.dif >= 2).sort((x, y) => y.dif - x.dif).slice(0, 2);
  const enContra = difs.filter((d) => d.dif <= -2).sort((x, y) => x.dif - y.dif).slice(0, 2);

  const partes = [];
  if (aFavor.length) partes.push(`Tu equipo gana en ${aFavor.map((d) => d.nombre.toLowerCase()).join(" y ")}`);
  if (enContra.length) partes.push(`el enemigo gana en ${enContra.map((d) => d.nombre.toLowerCase()).join(" y ")}`);
  if (!partes.length) partes.push("Composiciones parejas: definí por ejecución, no por draft");

  const total = mio.fisico + mio.magico;
  const reparto = total ? ` Tu daño: ${Math.round((mio.fisico / total) * 100)}% físico / ${Math.round((mio.magico / total) * 100)}% mágico.` : "";
  $("#resumen-ventajas").textContent = partes.join("; ") + "." + reparto;
}

function pintarItems() {
  const suyo = perfil(elegidos("enemigo"));
  const contenedor = $("#items");

  if (!suyo.heroes) {
    contenedor.innerHTML = `<span class="vacio">Cargá el equipo enemigo para ver qué ítems pide la partida.</span>`;
    return;
  }

  const total = suyo.fisico + suyo.magico || 1;
  const umbrales = {
    sustain: suyo.totales.sustain >= 4,
    frontline: suyo.totales.frontline >= 5,
    fisico: suyo.fisico / total >= 0.6,
    magico: suyo.magico / total >= 0.6,
    movilidad: suyo.totales.movilidad >= 5,
    late: suyo.totales.late >= 5,
  };

  const recomendados = (estado.items ?? []).filter((item) => umbrales[item.contra]);
  if (!recomendados.length) {
    contenedor.innerHTML = `<span class="vacio">Composición enemiga equilibrada: no hay un ítem que cambie la partida por sí solo.</span>`;
    return;
  }

  contenedor.innerHTML = recomendados
    .map(
      (item) => `
      <article class="item">
        <img src="assets/items/${encodeURIComponent(item.icono)}.svg" alt="" width="40" height="40" loading="lazy">
        <div>
          <strong>${escapar(item.nombre)}</strong>
          <p class="meta">${escapar(item.cuando)}</p>
          <p class="ejemplos">${(item.ejemplos ?? [])
            .map((nombre) => {
              const icono = estado.iconos?.items?.[nombre];
              return `<span class="ejemplo">${
                icono
                  ? `<img src="${escapar(icono)}" alt="" width="22" height="22" loading="lazy" onerror="this.remove()">`
                  : ""
              }${escapar(nombre)}</span>`;
            })
            .join("")}</p>
        </div>
      </article>`,
    )
    .join("");
}

function pintarAnalisis() {
  const mios = elegidos("alido");
  const enemigos = elegidos("enemigo");

  pintarSugerencias(
    $("#sugerencias-counter"),
    counterDe(enemigos),
    enemigos.length ? "Los héroes que contrarrestan ya están en el draft." : "Elegí al menos un enemigo.",
  );
  pintarSugerencias(
    $("#sugerencias-sinergia"),
    sinergiasDe(mios),
    mios.length ? "Sin sinergias marcadas para estos picks." : "Elegí tu primer héroe.",
  );

  const faltan = CARRILES.filter((carril) => !estado.alido[carril]);
  $("#cobertura").textContent = faltan.length
    ? `Te falta cubrir: ${faltan.join(", ")}.`
    : "Carriles completos: 5/5.";

  pintarVentajas();
  pintarItems();
}

function composicionTexto() {  const lineas = ["MI EQUIPO"];
  for (const carril of CARRILES) {
    const heroe = estado.alido[carril] ? estado.porId.get(estado.alido[carril]) : null;
    lineas.push(`${carril}: ${heroe ? heroe.nombre : "—"}`);
  }
  lineas.push("", "ENEMIGO");
  for (const carril of CARRILES) {
    const heroe = estado.enemigo[carril] ? estado.porId.get(estado.enemigo[carril]) : null;
    lineas.push(`${carril}: ${heroe ? heroe.nombre : "—"}`);
  }
  return lineas.join("\n");
}

async function copiarComposicion() {
  const texto = composicionTexto();
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    // Sin permisos de portapapeles (o sin HTTPS) queda el prompt como salida.
    window.prompt("Copiá la composición:", texto);
  }
}

// --- ficha -----------------------------------------------------------------

function abrirFicha(id) {
  const heroe = estado.porId.get(id);
  if (!heroe) return;

  const nombre = (otroId) => estado.porId.get(otroId)?.nombre ?? otroId;

  const curado = heroe.curado !== false;
  const parecido = curado
    ? `<div class="pares">
      <div><h4>Lo contrarrestan</h4><ul>${
        (heroe.counters ?? []).map((x) => `<li>${escapar(nombre(x))}</li>`).join("") || "<li>—</li>"
      }</ul></div>
      <div><h4>Sinergiza con</h4><ul>${
        (heroe.sinergias ?? []).map((x) => `<li>${escapar(nombre(x))}</li>`).join("") || "<li>—</li>"
      }</ul></div>
    </div>`
    : `<p class="aviso">Ficha básica: todavía no tiene tips ni counters curados. Sumalos en
       <code>data/heroes.json</code> y la página los muestra.</p>`;

  $("#modal-caja").innerHTML = `
    <button class="cerrar" type="button" aria-label="Cerrar">×</button>
    <div style="display:flex;align-items:center;gap:10px">
      ${avatar(heroe, 96)}
      ${insignia(heroe.tier)}
      <span class="meta">${heroe.tier === "?" ? "Sin clasificar" : `Tier ${escapar(heroe.tier)}`} · ${escapar(heroe.rol)} · ${escapar(heroe.carril)}</span>
    </div>
    <h2 id="modal-titulo">${escapar(heroe.nombre)}</h2>
    <div class="meta">${
      curado
        ? `Dificultad ${"●".repeat(heroe.dificultad)}${"○".repeat(3 - heroe.dificultad)} · ${(heroe.tags ?? []).map(escapar).join(" · ")}`
        : "Ficha básica (rol y carril de la wiki)"
    }</div>
    ${(heroe.tips ?? []).length ? `<ul class="lista-tips">${heroe.tips.map((t) => `<li>${escapar(t)}</li>`).join("")}</ul>` : ""}
    ${parecido}
    <div class="botones">
      <button class="boton" type="button" id="ficha-alido">Sumar a mi equipo</button>
      <button class="boton secundario" type="button" id="ficha-enemigo">Marcar como enemigo</button>
    </div>`;

  $("#modal").classList.add("abierto");
  $("#modal-caja .cerrar").addEventListener("click", cerrarFicha);
  $("#ficha-alido").addEventListener("click", () => {
    estado.activo = "alido";
    elegir(heroe.id);
    cerrarFicha();
    mostrarVista("drafter");
  });
  $("#ficha-enemigo").addEventListener("click", () => {
    estado.activo = "enemigo";
    elegir(heroe.id);
    cerrarFicha();
    mostrarVista("drafter");
  });
  $("#modal-caja .cerrar").focus();
}

function cerrarFicha() {
  $("#modal").classList.remove("abierto");
  $("#modal-caja").innerHTML = "";
}

// --- navegación y estado ---------------------------------------------------

function mostrarVista(vista) {
  estado.vista = vista;
  for (const nombre of ["tier", "drafter", "heroes"]) {
    $(`#vista-${nombre}`).hidden = nombre !== vista;
    $(`#tab-${nombre}`).setAttribute("aria-selected", String(nombre === vista));
  }
}

function guardar() {
  try {
    localStorage.setItem("mlbb-draft", JSON.stringify({ alido: estado.alido, enemigo: estado.enemigo }));
  } catch {
    // Modo privado o sin storage: el draft vive sólo en memoria.
  }
}

function cargar() {
  try {
    const guardado = JSON.parse(localStorage.getItem("mlbb-draft") ?? "{}");
    for (const lado of ["alido", "enemigo"]) {
      for (const carril of CARRILES) {
        const id = guardado?.[lado]?.[carril];
        if (id && estado.porId.has(id)) estado[lado][carril] = id;
      }
    }
  } catch {
    // Un JSON viejo o roto no puede romper la página.
  }
}

const DEMO = {
  alido: { Oro: "miya", Medio: "valir", Exp: "chou", Jungla: "lancelot", Roam: "khufra" },
  enemigo: { Oro: "ling", Medio: "gusion", Exp: "paquito", Jungla: "fanny", Roam: "atlas" },
};

async function iniciar() {
  let actualizado = "";
  try {
    const respuesta = await fetch("data/heroes.json");
    if (!respuesta.ok) throw new Error(String(respuesta.status));
    const datos = await respuesta.json();
    estado.heroes = datos.heroes ?? [];
    actualizado = datos.actualizado ?? "";
  } catch (error) {
    $("#aviso-datos").hidden = false;
    console.error("No se pudo cargar el dataset:", error);
    return;
  }

  estado.porId = new Map(estado.heroes.map((h) => [h.id, h]));
  cargar();

  // Los ítems y los retratos oficiales son datos aparte: si faltan, el sitio
  // sigue con los glifos y los SVG propios.
  try {
    const respuesta = await fetch("data/items.json");
    if (respuesta.ok) estado.items = (await respuesta.json()).items ?? [];
  } catch {
    estado.items = [];
  }

  try {
    const respuesta = await fetch("data/iconos.json");
    if (respuesta.ok) estado.iconos = (await respuesta.json()) ?? {};
  } catch {
    estado.iconos = {};
  }

  // `?demo=1` carga un draft de ejemplo (sirve para la captura y para mostrar la
  // herramienta) y `?vista=drafter` abre esa pestaña: links que se comparten ya
  // abiertos donde importa.
  const parametros = new URLSearchParams(location.search);
  if (parametros.has("demo") && !todosElegidos().length) {
    for (const lado of ["alido", "enemigo"]) {
      for (const [carril, id] of Object.entries(DEMO[lado])) {
        if (estado.porId.has(id)) estado[lado][carril] = id;
      }
    }
  }

  const vistaInicial = parametros.get("vista");
  if (["tier", "drafter", "heroes"].includes(vistaInicial)) {
    mostrarVista(vistaInicial);
  }

  montarChips($("#chips-rol"), () => estado.rol, (rol) => (estado.rol = rol), pintarTier);
  montarChips($("#chips-pool"), () => estado.rolPool, (rol) => (estado.rolPool = rol), pintarPool);
  montarChips($("#chips-heroes"), () => estado.rolHeroes, (rol) => (estado.rolHeroes = rol), pintarHeroes);

  document.querySelectorAll("[data-vista]").forEach((boton) => {
    boton.addEventListener("click", () => mostrarVista(boton.dataset.vista));
  });

  for (const lado of ["alido", "enemigo"]) {
    $(`#equipo-${lado}`).addEventListener("click", (evento) => {
      if (evento.target.closest("[data-quitar]")) return;
      estado.activo = lado;
      pintarSlots();
    });
  }

  $("#buscador").addEventListener("input", (evento) => {
    estado.busqueda = evento.target.value;
    pintarTier();
    pintarHeroes();
    pintarPool();
  });

  $("#copiar").addEventListener("click", copiarComposicion);
  $("#limpiar").addEventListener("click", () => {
    estado.alido = {};
    estado.enemigo = {};
    guardar();
    pintarSlots();
    pintarAnalisis();
    pintarPool();
  });

  $("#modal").addEventListener("click", (evento) => {
    if (evento.target.id === "modal") cerrarFicha();
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") cerrarFicha();
  });

  $("#pie").textContent = `Datos curados a mano · actualizado ${actualizado || "—"} · ${estado.heroes.length} héroes · Mobile Legends: Bang Bang es una marca de Moonton; esta página es un proyecto personal.`;

  pintarTier();
  pintarHeroes();
  pintarSlots();
  pintarPool();
  pintarAnalisis();
}

iniciar();
