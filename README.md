# MLBB Draft

**Tier list, drafter de 5v5 y tips por héroe para Mobile Legends: Bang Bang.** Sin cuenta, sin app y
sin instalar nada: abre en el celular o en la compu y arma la composición.

**→ <https://lucabaello1998.github.io/mlbb-draft/>**

![Tier list](docs/tierlist.png)

| Drafter | Ficha de héroe |
|---|---|
| ![Drafter](docs/drafter.png) | Tocá cualquier héroe y te dice qué lo contrarresta, con quién sinergiza y tres tips concretos |

## Qué hace

### Tier list

S/A/B/C por héroe, con filtro por rol y buscador. La lista ordena por **facilidad para ganar ranked con
equipo aleatorio**, no por winrate de torneo: es una opinión curada, con fecha, que se edita en un JSON
cuando cambia el parche.

### Drafter

- Dos equipos de 5 con los carriles reales (Oro, Medio, Exp, Jungla, Roam).
- Elegís el equipo activo y vas tocando héroes del pool: cada uno cae en su carril.
- **Análisis en vivo**: qué héroes del pool contrarrestan a los enemigos ya elegidos, qué sinergias te
  faltan y qué carril queda vacío.
- **Copiar composición** deja el draft en texto listo para pegar en el chat del equipo.
- El draft se guarda en el navegador: si recargás, sigue ahí.

### Héroes

Ficha por héroe con tres tips concretos, quién lo contrarresta y con quién sinergiza. 30 héroes
curados a mano.

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
tres tips, que **cada counter y sinergia apunte a un héroe que existe** y que los ids que usa el JS
existan en el HTML. Corre en el CI en cada push.

## Estructura

```
index.html        tres vistas (tier list, drafter, héroes) y el modal de ficha
assets/app.js     estado, pintado y drafter (sin frameworks)
assets/style.css  tema oscuro con acento dorado
data/heroes.json  el dataset: la única fuente de verdad
scripts/check.mjs validación del dataset y de la maqueta
docs/             capturas para el README
```

## Límites y aviso

- **No es una herramienta oficial**: Mobile Legends: Bang Bang es una marca de Moonton. Proyecto
  personal, sin relación con la empresa.
- La tier list es una **opinión curada** con fecha, no un winrate medido. Cambia con cada parche: si
  jugás a alto nivel, ajustala.
- Los tips son de fundamentos (posicionamiento, cuándo entrar, qué evitar), justamente para que no
  envejezcan con cada ajuste de números.
- No hay builds ni emblemas: cambian demasiado seguido y una build vieja hace más daño que ayuda.

## Licencia

MIT (código). Los nombres de héroes y del juego pertenecen a Moonton.
