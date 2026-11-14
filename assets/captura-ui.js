// Interfaz de "analizar captura": subir imagen, marcar las dos filas, detectar.
//
// La detección es aproximada a propósito: nunca aplica nada sola. Muestra los 10
// héroes con su nivel de confianza y un selector para corregir. Un falso
// positivo silencioso sería peor que no detectar.

import { cargarRetratos, confianza, detectarFila } from "./captura.js";

const CLAVE_CAJAS = "mlbb-captura-cajas";
// Por defecto, el layout de la pantalla de carga: aliados en una columna a la
// izquierda y enemigos en otra a la derecha. Se puede arrastrar y redimensionar.
const CAJAS_POR_DEFECTO = {
  alido: { x: 0.068, y: 0.1, w: 0.05, h: 0.73 },
  enemigo: { x: 0.868, y: 0.115, w: 0.07, h: 0.71 },
};

const LADOS = [
  { clave: "alido", titulo: "Mi equipo" },
  { clave: "enemigo", titulo: "Enemigo" },
];

const escapar = (texto) =>
  String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function leerCajas() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CLAVE_CAJAS) ?? "null");
    if (guardadas?.alido && guardadas?.enemigo) return guardadas;
  } catch {
    // Sin storage: se usan las de fábrica.
  }
  return structuredClone(CAJAS_POR_DEFECTO);
}

function guardarCajas(cajas) {
  try {
    localStorage.setItem(CLAVE_CAJAS, JSON.stringify(cajas));
  } catch {
    // Modo privado: no pasa nada, se pierde la posición.
  }
}

const ETIQUETA_CONFIANZA = {
  alta: "confiable",
  media: "revisar",
  baja: "dudoso",
  vacio: "vacío",
};

/**
 * Abre el modal de captura.
 *
 * `porId` es el Map de héroes y `aplicar(lado, ids)` recibe los 5 ids elegidos
 * por equipo (con `null` en las celdas vacías).
 */
export function abrirCaptura({ porId, aplicar }) {
  const modal = document.querySelector("#modal");
  const caja = document.querySelector("#modal-caja");
  if (!modal || !caja) return;

  const cajas = leerCajas();
  let imagen = null;
  let deteccion = { alido: [], enemigo: [] };
  let ultimoArrastre = 0;

  // Un AbortController por apertura: al cerrar se van todos los listeners y no
  // quedan handlers viejos acumulados en #modal.
  const control = new AbortController();
  const { signal } = control;

  caja.innerHTML = `
    <button class="cerrar" type="button" aria-label="Cerrar">×</button>
    <h2>Analizar captura</h2>
    <p class="aviso">
      Subí una captura de la pantalla de draft (la de carga, donde se ven los dos equipos) y acomodá los
      dos recuadros sobre las 5 fotos de cada uno: suelen ser dos columnas a los costados. Después
      revisá lo que detectó antes de aplicarlo.
    </p>
    <div class="captura-acciones">
      <label class="boton chico">
        Elegir imagen
        <input type="file" accept="image/*" id="captura-archivo" hidden>
      </label>
      <button class="boton chico" type="button" id="captura-detectar" disabled>Detectar héroes</button>
      <button class="boton secundario chico" type="button" id="captura-aplicar" disabled>Aplicar al draft</button>
    </div>
    <div class="captura-zona" id="captura-zona" hidden>
      <div class="captura-lienzo" id="captura-lienzo">
        <img id="captura-imagen" alt="Captura del draft">
        ${LADOS.map(
          (lado) => `
          <div class="captura-caja" data-lado="${lado.clave}" data-orientacion="${cajas[lado.clave].h > cajas[lado.clave].w * 1.3 ? "vertical" : "horizontal"}" style="left:${cajas[lado.clave].x * 100}%;top:${cajas[lado.clave].y * 100}%;width:${cajas[lado.clave].w * 100}%;height:${cajas[lado.clave].h * 100}%">
            <span class="captura-rotulo">${lado.titulo}</span>
            <span class="captura-divisiones" aria-hidden="true"></span>
            <span class="captura-agarre" aria-hidden="true"></span>
          </div>`,
        ).join("")}
      </div>
      <p class="meta" id="captura-estado" aria-live="polite"></p>
      <div class="captura-resultado" id="captura-resultado"></div>
    </div>
  `;

  const cerrar = () => {
    control.abort();
    modal.classList.remove("abierto");
    caja.innerHTML = "";
    imagen = null;
  };

  caja.querySelector(".cerrar").addEventListener("click", cerrar);
  modal.addEventListener(
    "click",
    (evento) => {
      // Cerrar con el fondo, pero no si el usuario acaba de arrastrar un
      // recuadro: el mouseup de un arrastre llega como click y cerraba el modal.
      if (evento.target === modal && Date.now() - ultimoArrastre > 300) cerrar();
    },
    { signal },
  );

  const archivo = caja.querySelector("#captura-archivo");
  const zona = caja.querySelector("#captura-zona");
  const lienzo = caja.querySelector("#captura-lienzo");
  const img = caja.querySelector("#captura-imagen");
  const botonDetectar = caja.querySelector("#captura-detectar");
  const botonAplicar = caja.querySelector("#captura-aplicar");
  const estadoTexto = caja.querySelector("#captura-estado");
  const resultado = caja.querySelector("#captura-resultado");

  archivo.addEventListener("change", () => {
    const elegido = archivo.files?.[0];
    if (!elegido) return;
    const lector = new FileReader();
    lector.onload = () => {
      img.onload = () => {
        zona.hidden = false;
        botonDetectar.disabled = false;
        botonAplicar.disabled = true;
        resultado.innerHTML = "";
        estadoTexto.textContent = "Acomodá los recuadros y tocá Detectar.";
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(elegido);
  });

  // --- arrastrar y redimensionar los recuadros -----------------------------
  for (const cajaLado of caja.querySelectorAll(".captura-caja")) {
    const clave = cajaLado.dataset.lado;
    let modo = null;
    let inicio = null;

    cajaLado.addEventListener("pointerdown", (evento) => {
      modo = evento.target.classList.contains("captura-agarre") ? "redimensionar" : "mover";
      inicio = {
        x: evento.clientX,
        y: evento.clientY,
        caja: { ...cajas[clave] },
        ancho: lienzo.getBoundingClientRect().width,
        alto: lienzo.getBoundingClientRect().height,
      };
      ultimoArrastre = Date.now();
      cajaLado.setPointerCapture(evento.pointerId);
      evento.preventDefault();
    });

    cajaLado.addEventListener("pointermove", (evento) => {
      if (!modo || !inicio) return;
      const dx = (evento.clientX - inicio.x) / inicio.ancho;
      const dy = (evento.clientY - inicio.y) / inicio.alto;
      const nueva = { ...inicio.caja };

      if (modo === "mover") {
        nueva.x = Math.min(Math.max(inicio.caja.x + dx, 0), 1 - inicio.caja.w);
        nueva.y = Math.min(Math.max(inicio.caja.y + dy, 0), 1 - inicio.caja.h);
      } else {
        nueva.w = Math.min(Math.max(inicio.caja.w + dx, 0.1), 1 - inicio.caja.x);
        nueva.h = Math.min(Math.max(inicio.caja.h + dy, 0.05), 1 - inicio.caja.y);
      }

      cajas[clave] = nueva;
      cajaLado.style.left = `${nueva.x * 100}%`;
      cajaLado.style.top = `${nueva.y * 100}%`;
      cajaLado.style.width = `${nueva.w * 100}%`;
      cajaLado.style.height = `${nueva.h * 100}%`;
      cajaLado.dataset.orientacion = nueva.h > nueva.w * 1.3 ? "vertical" : "horizontal";
    });

    const soltar = () => {
      if (!modo) return;
      modo = null;
      inicio = null;
      ultimoArrastre = Date.now();
      guardarCajas(cajas);
    };
    cajaLado.addEventListener("pointerup", soltar);
    cajaLado.addEventListener("pointercancel", soltar);
  }

  // --- detectar ------------------------------------------------------------
  botonDetectar.addEventListener("click", async () => {
    if (!imagen && !img.naturalWidth) return;
    botonDetectar.disabled = true;
    estadoTexto.textContent = "Detectando…";

    try {
      const { heroes } = await cargarRetratos();
      const natural = { ancho: img.naturalWidth, alto: img.naturalHeight };

      for (const lado of LADOS) {
        const cajaLado = cajas[lado.clave];
        const region = {
          x: cajaLado.x * natural.ancho,
          y: cajaLado.y * natural.alto,
          ancho: cajaLado.w * natural.ancho,
          alto: cajaLado.h * natural.alto,
        };
        deteccion[lado.clave] = detectarFila(img, region, heroes, { cantidad: 5 });
      }

      pintarResultado();
      const total = Object.values(deteccion).flat().filter((x) => x.id).length;
      estadoTexto.textContent = `${total} de 10 detectados. Revisá y corregí lo que haga falta.`;
      botonAplicar.disabled = total === 0;
    } catch (error) {
      estadoTexto.textContent = `No se pudo detectar: ${error.message}`;
    } finally {
      botonDetectar.disabled = false;
    }
  });

  function pintarResultado() {
    const opciones = (elegido) => {
      const lista = [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      return (
        `<option value="">— sin asignar —</option>` +
        lista
          .map((heroe) => `<option value="${heroe.id}"${heroe.id === elegido ? " selected" : ""}>${escapar(heroe.nombre)}</option>`)
          .join("")
      );
    };

    resultado.innerHTML = LADOS.map(
      (lado) => `
      <div class="captura-grupo">
        <h4>${lado.titulo}</h4>
        ${deteccion[lado.clave]
          .map((celda, i) => {
            const heroe = celda.id ? porId.get(celda.id) : null;
            const nivel = confianza(celda);
            return `
            <div class="captura-fila" data-nivel="${nivel}">
              <span class="captura-celda">${i + 1}</span>
              ${
                heroe
                  ? `<img class="heroe-avatar" src="assets/heroes/${encodeURIComponent(heroe.id)}.svg" alt="" width="26" height="26">`
                  : `<span class="heroe-avatar captura-vacio" aria-hidden="true"></span>`
              }
              <select data-lado="${lado.clave}" data-indice="${i}" aria-label="${lado.titulo}, celda ${i + 1}">
                ${opciones(celda.id ?? "")}
              </select>
              <span class="captura-confianza">${ETIQUETA_CONFIANZA[nivel]}${
                celda.distancia !== undefined ? ` · ${celda.distancia}` : ""
              }</span>
            </div>`;
          })
          .join("")}
      </div>`,
    ).join("");
  }

  // --- aplicar -------------------------------------------------------------
  botonAplicar.addEventListener("click", () => {
    const seleccion = { alido: [], enemigo: [] };
    for (const select of caja.querySelectorAll("#captura-resultado select")) {
      const id = select.value || null;
      if (id) seleccion[select.dataset.lado].push(id);
    }
    aplicar(seleccion);
    cerrar();
  });

  modal.classList.add("abierto");
}
