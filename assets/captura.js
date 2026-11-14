// Detección de héroes en una captura de draft.
//
// No hay API de MLBB: el draft pasa adentro del juego y no se puede leer. Lo que
// sí se puede es mirar la imagen. Cada retrato oficial se reduce a una firma de
// 10x10 píxeles (data/retratos.json, solo números) y el recorte de la captura se
// reduce igual: el héroe es el de menor distancia.
//
// La firma es chica a propósito: tolera escalas, bordes y compresión de la
// captura, que es justo lo que rompe un hash exacto.

const LADO = 10;
const BYTES = LADO * LADO * 3;

let cacheRetratos = null;

/** Carga (una sola vez) el índice de firmas. */
export async function cargarRetratos(url = "data/retratos.json") {
  if (cacheRetratos) return cacheRetratos;
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo cargar ${url}`);
  const datos = await respuesta.json();
  const heroes = {};
  for (const [id, valor] of Object.entries(datos.heroes ?? {})) {
    heroes[id] = { firma: base64ABytes(valor.firma), dhash: valor.dhash };
  }
  cacheRetratos = { lado: datos.lado ?? LADO, heroes };
  return cacheRetratos;
}

export function base64ABytes(texto) {
  const binario = atob(texto);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

let lienzo = null;
function lienzoDeTrabajo() {
  if (!lienzo) {
    lienzo = document.createElement("canvas");
    lienzo.width = LADO;
    lienzo.height = LADO;
  }
  return lienzo;
}

/**
 * Firma de una región de la imagen.
 *
 * Se reduce en dos pasos (40 -> 10) para que el navegador no alias el muestreo:
 * un solo salto de 2400 px a 10 px pierde justo los detalles que distinguen dos
 * retratos.
 */
export function firmaDeRegion(fuente, x, y, ancho, alto) {
  if (ancho <= 0 || alto <= 0) throw new Error("La región es vacía.");

  const intermedio = document.createElement("canvas");
  intermedio.width = 40;
  intermedio.height = 40;
  const contextoIntermedio = intermedio.getContext("2d", { willReadFrequently: true });
  contextoIntermedio.imageSmoothingEnabled = true;
  contextoIntermedio.imageSmoothingQuality = "high";
  contextoIntermedio.drawImage(fuente, x, y, ancho, alto, 0, 0, 40, 40);

  const salida = lienzoDeTrabajo();
  const contexto = salida.getContext("2d", { willReadFrequently: true });
  contexto.imageSmoothingEnabled = true;
  contexto.imageSmoothingQuality = "high";
  contexto.clearRect(0, 0, LADO, LADO);
  contexto.drawImage(intermedio, 0, 0, 40, 40, 0, 0, LADO, LADO);

  const datos = contexto.getImageData(0, 0, LADO, LADO).data;
  const firma = new Uint8Array(BYTES);
  for (let i = 0; i < LADO * LADO; i += 1) {
    firma[i * 3] = datos[i * 4];
    firma[i * 3 + 1] = datos[i * 4 + 1];
    firma[i * 3 + 2] = datos[i * 4 + 2];
  }
  return firma;
}

/** Distancia media por canal (0 = idéntico, 255 = opuesto). */
export function distancia(a, b) {
  if (a.length !== b.length) return Infinity;
  let suma = 0;
  for (let i = 0; i < a.length; i += 1) suma += Math.abs(a[i] - b[i]);
  return suma / a.length;
}

/**
 * Mejor coincidencia para una firma.
 *
 * Devuelve el ganador y el segundo, con la diferencia entre ambos: si están
 * pegados, conviene que el usuario confirme.
 */
export function mejorCoincidencia(firma, heroes, { excluir = new Set() } = {}) {
  let primero = null;
  let segundo = null;

  for (const [id, { firma: referencia }] of Object.entries(heroes)) {
    if (excluir.has(id)) continue;
    const d = distancia(firma, referencia);
    if (!primero || d < primero.distancia) {
      segundo = primero;
      primero = { id, distancia: d };
    } else if (!segundo || d < segundo.distancia) {
      segundo = { id, distancia: d };
    }
  }

  if (!primero) return null;
  return {
    id: primero.id,
    distancia: Number(primero.distancia.toFixed(1)),
    segundo: segundo ? { id: segundo.id, distancia: Number(segundo.distancia.toFixed(1)) } : null,
    // Confianza relativa: qué tan lejos quedó el segundo.
    margen: segundo ? Number((segundo.distancia - primero.distancia).toFixed(1)) : 99,
  };
}

/**
 * Detecta los héroes de una línea.
 *
 * `caja` es el rectángulo que el usuario dibujó sobre las fotos. La orientación
 * se deduce sola: si es más alta que ancha, las 5 fotos están apiladas (columna
 * de aliados/enemigos del draft); si no, van en fila (bans).
 */
export function detectarFila(fuente, caja, heroes, { cantidad = 5, recorte = 0.04 } = {}) {
  const vertical = caja.alto > caja.ancho * 1.3;
  const anchoCelda = vertical ? caja.ancho : caja.ancho / cantidad;
  const altoCelda = vertical ? caja.alto / cantidad : caja.alto;
  const resultados = [];
  const usados = new Set();

  for (let i = 0; i < cantidad; i += 1) {
    // Recorte cuadrado centrado en la celda: el retrato es cuadrado, así que
    // estirarlo a la forma de la celda (alta y angosta en las columnas) cambia
    // la firma y arruina la comparación.
    const lado = Math.min(anchoCelda, altoCelda) * 0.6;
    const x = caja.x + (vertical ? 0 : i * anchoCelda) + (anchoCelda - lado) / 2;
    const y = caja.y + (vertical ? i * altoCelda : 0) + (altoCelda - lado) / 2;

    let firma;
    try {
      firma = firmaDeRegion(fuente, x, y, lado, lado);
    } catch {
      resultados.push({ indice: i, id: null, error: "celda vacía" });
      continue;
    }

    const mejor = mejorCoincidencia(firma, heroes, { excluir: usados });
    if (mejor?.id) usados.add(mejor.id);
    resultados.push({ indice: i, ...mejor });
  }

  return resultados;
}

/** Umbrales para pintar el resultado: verde, amarillo, rojo. */
export function confianza(resultado) {
  if (!resultado?.id) return "vacio";
  if (resultado.distancia <= 28 && resultado.margen >= 6) return "alta";
  if (resultado.distancia <= 45) return "media";
  return "baja";
}
