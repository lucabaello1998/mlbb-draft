// Carga del draft desde una captura: se tocan los retratos y se elige el héroe.
//
// La detección automática por firma de imagen se probó contra capturas reales y
// no es confiable: el juego dibuja los íconos con otro render y un tinte azul,
// así que el parecido con el arte de la wiki no alcanza. Antes que un botón que
// se equivoca en silencio, tocar y elegir: son diez toques y no falla.

const LADOS = [
  { clave: "alido", titulo: "Mi equipo" },
  { clave: "enemigo", titulo: "Enemigo" },
];

const escapar = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function abrirCaptura({ porId, aplicar }) {
  const modal = document.querySelector("#modal");
  const caja = document.querySelector("#modal-caja");
  if (!modal || !caja) return;

  const control = new AbortController();
  const { signal } = control;

  const asignacion = { alido: [], enemigo: [] };
  let ladoActivo = "alido";

  const heroes = [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  caja.innerHTML = `
    <button class="cerrar" type="button" aria-label="Cerrar">×</button>
    <h2>Draft desde una captura</h2>
    <p class="aviso">
      Subí la captura de la pantalla de draft y tocá cada retrato para elegir el héroe. Elegí primero
      el equipo que estás cargando.
    </p>
    <div class="captura-acciones">
      <label class="boton chico">
        Elegir imagen
        <input type="file" accept="image/*" id="captura-archivo" hidden>
      </label>
      <div class="captura-equipos" role="group" aria-label="Equipo que se está cargando">
        ${LADOS.map(
          (lado) =>
            `<button class="boton chico captura-equipo" type="button" data-equipo="${lado.clave}" aria-pressed="${lado.clave === ladoActivo}">${lado.titulo}</button>`,
        ).join("")}
      </div>
      <button class="boton secundario chico" type="button" id="captura-aplicar" disabled>Aplicar al draft</button>
    </div>
    <div class="captura-zona" id="captura-zona" hidden>
      <div class="captura-lienzo" id="captura-lienzo">
        <img id="captura-imagen" alt="Captura del draft">
      </div>
      <p class="meta" id="captura-estado" aria-live="polite"></p>
      <div class="captura-elegidos" id="captura-elegidos"></div>
      <div class="captura-buscador" id="captura-buscador" hidden>
        <input type="search" id="captura-busqueda" placeholder="Buscar héroe…" aria-label="Buscar héroe">
        <div class="captura-lista" id="captura-lista"></div>
      </div>
    </div>
  `;

  const cerrar = () => {
    control.abort();
    modal.classList.remove("abierto");
    caja.innerHTML = "";
  };

  caja.querySelector(".cerrar").addEventListener("click", cerrar);
  modal.addEventListener(
    "click",
    (evento) => {
      if (evento.target === modal) cerrar();
    },
    { signal },
  );

  const archivo = caja.querySelector("#captura-archivo");
  const zona = caja.querySelector("#captura-zona");
  const img = caja.querySelector("#captura-imagen");
  const estadoTexto = caja.querySelector("#captura-estado");
  const elegidos = caja.querySelector("#captura-elegidos");
  const buscador = caja.querySelector("#captura-buscador");
  const busqueda = caja.querySelector("#captura-busqueda");
  const lista = caja.querySelector("#captura-lista");
  const botonAplicar = caja.querySelector("#captura-aplicar");

  const pintarElegidos = () => {
    elegidos.innerHTML = LADOS.map((lado) => {
      const ids = asignacion[lado.clave];
      const celdas = Array.from({ length: 5 }, (_, i) => {
        const heroe = ids[i] ? porId.get(ids[i]) : null;
        return heroe
          ? `<button class="captura-chip" type="button" data-quitar="${lado.clave}:${i}" title="Quitar ${escapar(heroe.nombre)}">
               <img class="heroe-avatar" src="assets/heroes/${encodeURIComponent(heroe.id)}.svg" alt="" width="22" height="22">
               <span>${escapar(heroe.nombre)}</span>
             </button>`
          : `<span class="captura-chip vacio">—</span>`;
      }).join("");
      return `<div class="captura-grupo-chips"><span class="rotulo">${lado.titulo}</span>${celdas}</div>`;
    }).join("");

    const total = asignacion.alido.length + asignacion.enemigo.length;
    botonAplicar.disabled = total === 0;
    estadoTexto.textContent =
      `${asignacion.alido.length}/5 aliados · ${asignacion.enemigo.length}/5 enemigos` +
      (total === 0 ? " · tocá un retrato para empezar" : "");
  };

  archivo.addEventListener("change", () => {
    const elegido = archivo.files?.[0];
    if (!elegido) return;
    const lector = new FileReader();
    lector.onload = () => {
      img.onload = () => {
        zona.hidden = false;
        pintarElegidos();
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(elegido);
  });

  for (const boton of caja.querySelectorAll(".captura-equipo")) {
    boton.addEventListener(
      "click",
      () => {
        ladoActivo = boton.dataset.equipo;
        for (const otro of caja.querySelectorAll(".captura-equipo")) {
          otro.setAttribute("aria-pressed", String(otro === boton));
        }
        buscador.hidden = true;
      },
      { signal },
    );
  }

  // Tocar la captura abre el buscador para cargar el siguiente hueco del equipo.
  img.addEventListener(
    "click",
    () => {
      if (asignacion[ladoActivo].length >= 5) {
        estadoTexto.textContent = `El equipo ${ladoActivo === "alido" ? "aliado" : "enemigo"} ya tiene 5. Quitá uno para cambiarlo.`;
        return;
      }
      buscador.hidden = false;
      busqueda.value = "";
      pintarLista("");
      busqueda.focus();
    },
    { signal },
  );

  const pintarLista = (filtro) => {
    const texto = filtro.trim().toLowerCase();
    const usados = new Set([...asignacion.alido, ...asignacion.enemigo]);
    const visibles = heroes
      .filter((heroe) => !usados.has(heroe.id))
      .filter((heroe) => !texto || heroe.nombre.toLowerCase().includes(texto) || heroe.id.includes(texto))
      .slice(0, 60);

    lista.innerHTML =
      visibles.length === 0
        ? `<p class="meta">Sin resultados.</p>`
        : visibles
            .map(
              (heroe) => `
          <button class="captura-opcion" type="button" data-heroe="${heroe.id}">
            <img class="heroe-avatar" src="assets/heroes/${encodeURIComponent(heroe.id)}.svg" alt="" width="26" height="26">
            <span>${escapar(heroe.nombre)}</span>
            <small>${escapar(heroe.carril ?? "")}</small>
          </button>`,
            )
            .join("");
  };

  busqueda.addEventListener("input", () => pintarLista(busqueda.value), { signal });

  lista.addEventListener(
    "click",
    (evento) => {
      const opcion = evento.target.closest("[data-heroe]");
      if (!opcion) return;
      asignacion[ladoActivo].push(opcion.dataset.heroe);
      buscador.hidden = true;
      pintarElegidos();
    },
    { signal },
  );

  elegidos.addEventListener(
    "click",
    (evento) => {
      const quitar = evento.target.closest("[data-quitar]");
      if (!quitar) return;
      const [lado, indice] = quitar.dataset.quitar.split(":");
      asignacion[lado].splice(Number(indice), 1);
      pintarElegidos();
    },
    { signal },
  );

  botonAplicar.addEventListener(
    "click",
    () => {
      aplicar({ alido: [...asignacion.alido], enemigo: [...asignacion.enemigo] });
      cerrar();
    },
    { signal },
  );

  modal.classList.add("abierto");
}
