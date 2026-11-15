// Service worker mínimo para el "Compartir" de Android.
//
// Cuando compartís una captura a la app instalada, Android hace un POST a
// /<scope>/compartir. GitHub Pages no ejecuta código del servidor, así que el
// service worker intercepta ese POST, guarda la imagen en la caché del
// dispositivo y redirige a la app. Nada sale del teléfono.

const CACHE = "mlbb-compartido";

// Se arma con el scope real: funciona igual en GitHub Pages que en un dominio
// propio, y también en local.
const CLAVE = new URL("captura-compartida", self.registration.scope).href;
const DESTINO = new URL("?vista=drafter&compartido=1", self.registration.scope).href;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (evento) => {
  const url = new URL(evento.request.url);
  if (evento.request.method === "POST" && url.pathname.endsWith("/compartir")) {
    evento.respondWith(guardar(evento.request));
  }
});

async function guardar(peticion) {
  try {
    const datos = await peticion.formData();
    const archivo = datos.get("captura");
    if (archivo && typeof archivo !== "string" && archivo.size > 0) {
      const cache = await caches.open(CACHE);
      await cache.put(
        CLAVE,
        new Response(archivo, {
          headers: { "content-type": archivo.type || "image/jpeg" },
        })
      );
    }
  } catch {
    // Si algo falla, igual abrimos la app para elegir la imagen a mano.
  }
  return Response.redirect(DESTINO, 303);
}
