# MLBB Draft

**Tier list, drafter de 5v5 y tips por héroe para Mobile Legends: Bang Bang.** Sin cuenta, sin app y
sin instalar nada: abre en el celular o en la compu y arma la composición.

**→ <https://lucabaello1998.github.io/mlbb-draft/>**

![Tier list](docs/tierlist.png)

| Drafter | Héroes |
|---|---|
| ![Drafter](docs/drafter.png) | ![Héroes](docs/heroes.png) |

## Qué hace

### Tier list

S/A/B/C por héroe, con filtro por rol y buscador. Los que no están clasificados van a una quinta fila
("?"). La lista ordena por **facilidad para ganar ranked con equipo aleatorio**, no por winrate de
torneo: es una opinión curada, con fecha, que se edita en un JSON cuando cambia el parche.

### Drafter

- Dos equipos de 5 con los carriles reales (Oro, Medio, Exp, Jungla, Roam).
- Elegís el equipo activo y vas tocando héroes del pool: cada uno cae en su carril.
- **Bans**: 5 por equipo. Tocás *Banear* en un equipo y después el héroe en el pool; el baneado sale
  del pool y se ve en la fila de bans con su retrato. Se saca con la ×.
- **Bans sugeridos**: cinco candidatos para tu equipo, con el motivo escrito al lado. No es winrate ni
  una tier global: cruza tres cosas del dataset — el héroe tiene a alguno de tus picks en su lista de
  `counters` (3 puntos), es tier S o A y sigue libre (2 o 1), o sinergiza con lo que ya eligió el
  enemigo (1). Se recalcula con cada pick y cada ban.
- **Análisis en vivo**: qué héroes del pool contrarrestan a los enemigos ya elegidos, qué sinergias te
  faltan y qué carril queda vacío.
- **Ventajas de la composición**: comparación lado a lado de frontline, engage/CC, sustain, poke,
  movilidad y late game, con la conclusión escrita ("tu equipo gana en poke; el enemigo en movilidad")
  y el reparto de daño físico/mágico.
- **Ítems que pide la partida**: si el enemigo cura mucho, pide anti-curación; si tiene dos tanques,
  penetración; si escala, cerrar temprano. Categorías con ejemplos reales, no una build cerrada.
- **Copiar composición** deja el draft en texto listo para pegar en el chat del equipo, con los bans.
- El draft y los bans se guardan en el navegador: si recargás, siguen ahí.

### Héroes

**Roster completo (134 héroes)** con retrato oficial, rol y carril. 30 están **curados a mano** con
tres tips, counters y sinergias; el resto tiene la ficha básica y se completa editando el JSON. Los
que todavía no tienen tier aparecen en "Sin clasificar": preferimos decirlo antes que inventarles una
letra.

Buscador propio de la vista (nombre, rol o carril), tolerante a acentos y apóstrofes: `chang e`
encuentra a Chang'e y `yi sun shin` a Yi Sun-shin. Muestra "3 de 134" mientras filtrás. El buscador
del encabezado sigue filtrando la tier list y el pool del drafter.

## Cómo se calculan las ventajas

No hay estadísticas inventadas: cada héroe aporta a seis atributos según su **rol y sus tags**, con un
mapeo fijo y editable:

| Atributo | De dónde sale |
|---|---|
| Frontline | Tanque 3, Peleador 2, Soporte 1 |
| Engage / CC | Tanque con tag `engage` 3 (sin tag 2), Peleador con `cc` 2, Soporte/Asesino con `cc`/`engage` 1 |
| Sustain | Soporte con `heal`/`sustain` 3 (sin tag 2), cualquier héroe con `sustain` o `escudo` 2 |
| Poke | Mago con `poke`/`rango` 3 (sin tag 2), Tirador 1 |
| Movilidad | Asesino 2, más 2 si tiene `movilidad`/`dash`/`muros` |
| Late game | Tag `late game` 3, Tirador 2, resto 1 |

El total del equipo es la suma de sus cinco héroes; las barras se escalan al máximo de los dos equipos
para que la diferencia se vea. La frase del final se arma comparando los totales (diferencia de 2 o
más para marcar una ventaja).

## Arte

Los retratos que se ven son los **íconos oficiales** de cada héroe, referenciados desde el CDN de la
wiki de Mobile Legends: no se copian al repo (el arte es de Moonton), y si una imagen no carga o el CDN
cambia se usa el **SVG propio** como respaldo (`assets/heroes/*.svg`, generado con
`node scripts/generar-arte.mjs`, con el color y el glifo del rol).

El mapa de URLs vive en `data/iconos.json` y se regenera con:

```bash
node scripts/iconos-oficiales.mjs
```

El script resuelve cada héroe por la API de la wiki y descarta los ítems cuyo archivo no coincide con
el nombre pedido (mejor el glifo de categoría que el ícono de otro ítem). Los ítems de ejemplo muestran
su ícono oficial cuando existe.

> El arte y los nombres son de Moonton. Esta página es un proyecto personal sin relación con la
> empresa; si Moonton pide sacar las imágenes, se borra `data/iconos.json` y quedan los SVG propios.

## Cómo se usa un counter

Cada héroe declara a **quién le gana** (`counters`). El drafter invierte esa relación: si el enemigo
eligió a Fanny, busca los héroes que aparecen en la lista de Fanny (Khufra, Franco, Chou) y te los
sugiere, salvo que ya los hayas elegido.

## Publicar / correr local

Es un sitio estático sin build:

```bash
python -m http.server 8000
# → http://localhost:8000
```

En GitHub Pages: *Settings → Pages → Deploy from a branch → `main` / root*. No hay paso de compilación,
lo que se ve es lo que está en el repo.

**No lo abras con doble clic** (`file://`): el navegador bloquea el `fetch` del JSON y no carga nada.
El aviso de la página lo dice.

## Editar el dataset

Todo vive en [`data/heroes.json`](data/heroes.json):

```json
{
  "id": "khufra",
  "nombre": "Khufra",
  "rol": "Tank",
  "carril": "Roam",
  "dificultad": 2,
  "tier": "S",
  "tags": ["anti-dash", "engage"],
  "tips": ["…", "…", "…"],
  "counters": ["fanny", "ling"],
  "sinergias": ["valir", "beatrix"]
}
```

Antes de publicar:

```bash
node scripts/check.mjs
```

Revisa que los ids no se repitan, que los roles/carriles/tiers sean válidos, que cada héroe tenga sus
tres tips, que **cada counter y sinergia apunte a un héroe que existe**, que cada héroe tenga su retrato
y cada ícono de ítem su archivo, y que los ids que usa el JS existan en el HTML. Corre en el CI en cada
push.

## Estructura

```
index.html              tres vistas (tier list, drafter, héroes) y el modal de ficha
assets/app.js           estado, pintado, drafter y análisis (sin frameworks)
assets/style.css        tema oscuro con acento dorado
assets/heroes/*.svg     retratos de respaldo (si el CDN falla), uno por héroe
assets/items/*.svg      íconos de categoría de ítem
data/heroes.json        el dataset de héroes: la única fuente de verdad
data/items.json         categorías de ítem y cuándo usarlas
data/iconos.json        URLs de los retratos e íconos oficiales (wiki)
scripts/generar-arte.mjs      regenera los SVG de respaldo
scripts/importar-heroes.mjs   trae el roster completo (rol, carril y retrato) desde la wiki
scripts/iconos-oficiales.mjs  refresca los retratos oficiales por API
scripts/check.mjs       validación del dataset, del arte y de la maqueta
docs/                   capturas para el README
```

## Tests

```bash
node scripts/check.mjs
```

Valida el dataset (ids únicos, roles y carriles del juego, tiers S/A/B/C/?, tips sólo en los curados,
counters y sinergias que existan), que cada héroe tenga su retrato y que el JS escape todo lo que
viene del JSON. Lo corre el CI en cada push; no hay dependencias ni build.

## Límites y aviso

- **No es una herramienta oficial**: Mobile Legends: Bang Bang es una marca de Moonton. Proyecto
  personal, sin relación con la empresa.
- La tier list es una **opinión curada** con fecha, no un winrate medido. Cambia con cada parche: si
  jugás a alto nivel, ajustala.
- Los tips son de fundamentos (posicionamiento, cuándo entrar, qué evitar), justamente para que no
  envejezcan con cada ajuste de números.
- No hay builds ni emblemas: cambian demasiado seguido y una build vieja hace más daño que ayuda.
- El roster sale de la wiki, no de una API oficial. La API de MediaWiki corta en **500 categorías por
  request** y lo avisa con un `continue`: el importador parte los lotes hasta que entra todo. Sin eso,
  los últimos héroes de cada lote se perdían en silencio (Gloo, Aamon, Julian, Kalea y otros 15).
- Los héroes **sin rol publicado** (por ejemplo Noctis, marcado "Unfinished") no entran: no se les
  inventa un carril. Hoy falta sólo ese.

## Licencia

MIT (código). Los nombres de héroes y del juego pertenecen a Moonton.
