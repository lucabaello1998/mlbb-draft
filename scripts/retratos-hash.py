"""Genera data/retratos.json: una firma visual por héroe.

El repo no guarda arte oficial de Moonton. Este script baja los retratos a una
caché local (ignorada por git), calcula una firma de 10x10 píxeles en base64 y
un dHash de 64 bits, y escribe solo los números. El navegador hace lo mismo con
el recorte de la captura y compara.

Uso: python scripts/retratos-hash.py [--forzar]
"""

import base64
import io
import json
import os
import sys
import time
import urllib.request

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(RAIZ, "scripts", ".cache", "retratos")
SALIDA = os.path.join(RAIZ, "data", "retratos.json")
LADO = 10

CABECERAS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
    ),
    "Referer": "https://mobile-legends.fandom.com/",
    "Accept": "image/avif,image/webp,image/png,*/*",
}


def descargar(url, destino):
    if os.path.exists(destino) and os.path.getsize(destino) > 1000:
        return False
    peticion = urllib.request.Request(url, headers=CABECERAS)
    with urllib.request.urlopen(peticion, timeout=30) as respuesta:
        datos = respuesta.read()
    with open(destino, "wb") as archivo:
        archivo.write(datos)
    return True


def firma(imagen):
    """10x10 RGB en base64 + dHash de 64 bits en hexadecimal."""
    rgb = imagen.convert("RGB")
    pequena = rgb.resize((LADO, LADO), Image.LANCZOS)
    crudo = bytes(pequena.tobytes())
    codificada = base64.b64encode(crudo).decode("ascii")

    gris = rgb.convert("L").resize((9, 8), Image.LANCZOS)
    pixeles = list(gris.tobytes())
    bits = 0
    for fila in range(8):
        for columna in range(8):
            izquierda = pixeles[fila * 9 + columna]
            derecha = pixeles[fila * 9 + columna + 1]
            bits = (bits << 1) | (1 if izquierda > derecha else 0)

    return {"firma": codificada, "dhash": f"{bits:016x}"}


def main():
    forzar = "--forzar" in sys.argv
    with open(os.path.join(RAIZ, "data", "iconos.json"), encoding="utf-8") as archivo:
        iconos = json.load(archivo)

    heroes = iconos.get("heroes") or {}
    os.makedirs(CACHE, exist_ok=True)

    resultado = {}
    bajados = 0
    fallidos = []

    for indice, (heroe, url) in enumerate(sorted(heroes.items()), start=1):
        destino = os.path.join(CACHE, f"{heroe}.img")
        try:
            if forzar and os.path.exists(destino):
                os.remove(destino)
            if descargar(url, destino):
                bajados += 1
                time.sleep(0.05)
            with Image.open(destino) as imagen:
                resultado[heroe] = firma(imagen)
        except Exception as error:  # noqa: BLE001 - queremos seguir con el resto
            fallidos.append((heroe, str(error)[:80]))
        if indice % 25 == 0:
            print(f"  {indice}/{len(heroes)}…")

    salida = {
        "fuente": "Firmas calculadas de los retratos de la wiki; no incluye imágenes",
        "actualizado": time.strftime("%Y-%m-%d"),
        "lado": LADO,
        "heroes": resultado,
    }
    with open(SALIDA, "w", encoding="utf-8") as archivo:
        json.dump(salida, archivo, separators=(",", ":"), ensure_ascii=False)

    print(f"Listo: {len(resultado)} héroes, {bajados} descargados")
    if fallidos:
        print(f"Fallaron {len(fallidos)}:")
        for heroe, error in fallidos[:10]:
            print(f"  - {heroe}: {error}")
    print(f"Archivo: {SALIDA} ({os.path.getsize(SALIDA) / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
