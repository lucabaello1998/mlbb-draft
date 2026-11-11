// MLBB Draft: tier list, drafter y fichas, todo desde data/heroes.json.
// Sin dependencias y sin build: el mismo archivo que se sirve es el que se edita.

const CARRILES = ["Oro", "Medio", "Exp", "Jungla", "Roam"];
const TIERS = ["S", "A", "B", "C"];
const COLOR_ROL = {
  Marksman: "#e0a13a",
  Mage: "#7c8cff",
  Assassin: "#ff6b6b",
  Fighter: "#e07a5f",
  Tank: "#4cc9a0",
  Support: "#c084fc",
};

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

const iniciales = (nombre) =>
  nombre
    .split(/[\s-]+/)
    .map((parte) => parte[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function avatar(heroe, tamano = 26) {
  const color = COLOR_ROL[heroe.rol] ?? "#8b93a7";
  return `<span class="heroe-avatar" style="background:${color};width:${tamano}px;height:${tamano}px">${escapar(
    iniciales(heroe.nombre),
  )}</span>`;
}

function insignia(tier) {
  const colores = { S: "#ef4444", A: "#f59e0b", B: "#3b82f6", C: "#64748b" };
  return `<span class="insignia" style="background:${colores[tier] ?? "#64748b"}">${escapar(tier)}</span>`;
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

function pintarChips(contenedor, activo, alElegir) {
  const roles = ["", ...new Set(estado.heroes.map((h) => h.rol))];
  contenedor.innerHTML = roles
    .map(
      (rol) => `<button class="chip" type="button" data-rol="${escapar(rol)}" aria-pressed="${
        activo === rol ? "true" : "false"
      }">${rol || "Todos"}</button>`,
    )
    .join("");
  contenedor.querySelectorAll("[data-rol]").forEach((boton) => {
    boton.addEventListener("click", () => alElegir(boton.dataset.rol));
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
      <div class="tier tier-${tier.toLowerCase()}">
        <div class="tier-letra">${tier}</div>
        <div class="tier-cuerpo">
          <div class="tier-grid">
            ${grupo
              .map(
                (h) => `<button class="heroe-mini" type="button" data-heroe="${escapar(h.id)}">
                  ${avatar(h)}
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
          ${avatar(h, 32)}
          ${insignia(h.tier)}
          <span class="meta" style="margin-left:auto">${escapar(h.carril)}</span>
        </div>
        <h3>${escapar(h.nombre)}</h3>
        <div class="meta">${escapar(h.rol)} · dificultad ${"●".repeat(h.dificultad)}${"○".repeat(3 - h.dificultad)}</div>
        <div class="tags">${(h.tags ?? []).map((t) => `<span class="tag">${escapar(t)}</span>`).join("")}</div>
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
          ${heroe ? `${avatar(heroe, 22)}<span>${escapar(heroe.nombre)}</span>` : `<span class="vacio">—</span>`}
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
        ${avatar(h, 22)}<span class="nombre">${escapar(h.nombre)}</span>
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
        ${avatar(h, 22)}<span class="nombre">${escapar(h.nombre)}</span>
        <span class="rol" style="margin-left:6px">${escapar(h.carril)}</span>
      </button>`,
    )
    .join("");
  contenedor.querySelectorAll("[data-sugerido]").forEach((boton) => {
    boton.addEventListener("click", () => elegir(boton.dataset.sugerido));
  });
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
}

function composicionTexto() {
  const lineas = ["MI EQUIPO"];
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

  $("#modal-caja").innerHTML = `
    <button class="cerrar" type="button" aria-label="Cerrar">×</button>
    <div style="display:flex;align-items:center;gap:10px">
      ${avatar(heroe, 40)}
      ${insignia(heroe.tier)}
      <span class="meta">Tier ${escapar(heroe.tier)} · ${escapar(heroe.rol)} · ${escapar(heroe.carril)}</span>
    </div>
    <h2 id="modal-titulo">${escapar(heroe.nombre)}</h2>
    <div class="meta">Dificultad ${"●".repeat(heroe.dificultad)}${"○".repeat(3 - heroe.dificultad)} · ${(heroe.tags ?? [])
      .map(escapar)
      .join(" · ")}</div>
    <ul class="lista-tips">${(heroe.tips ?? []).map((t) => `<li>${escapar(t)}</li>`).join("")}</ul>
    <div class="pares">
      <div><h4>Lo contrarrestan</h4><ul>${
        (heroe.counters ?? []).map((x) => `<li>${escapar(nombre(x))}</li>`).join("") || "<li>—</li>"
      }</ul></div>
      <div><h4>Sinergiza con</h4><ul>${
        (heroe.sinergias ?? []).map((x) => `<li>${escapar(nombre(x))}</li>`).join("") || "<li>—</li>"
      }</ul></div>
    </div>
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

  const chipsRol = (contenedor, valor, setter, despues) =>
    pintarChips(contenedor, valor, (rol) => {
      setter(rol);
      pintarChips(contenedor, rol, (otro) => chipsRol(contenedor, otro, setter, despues));
      despues();
    });

  chipsRol($("#chips-rol"), estado.rol, (rol) => (estado.rol = rol), pintarTier);
  chipsRol($("#chips-pool"), estado.rolPool, (rol) => (estado.rolPool = rol), pintarPool);
  chipsRol($("#chips-heroes"), estado.rolHeroes, (rol) => (estado.rolHeroes = rol), pintarHeroes);

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
