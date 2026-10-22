#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Trae las últimas publicaciones de la página de Facebook de la Municipalidad
y las suma a la sección Noticias del sitio (assets/facebook.js), igual que
hacía el plugin de Facebook del WordPress actual.

Uso:
    set FB_TOKEN=<token de página>          (Windows)
    export FB_TOKEN=<token de página>       (Linux/Mac)
    python herramientas/actualizar_facebook.py

Opciones:
    --pagina ID        ID de la página (por defecto 552581624817618)
    --cantidad N       publicaciones a pedir (por defecto 25)
    --sin-fotos        no descarga las imágenes
    --desde-archivo X  usa un JSON guardado de la Graph API en lugar de pedirlo (para pruebas)

El token es un "token de acceso de página" de larga duración con el permiso
pages_read_engagement, generado por un administrador de la página desde una
app de Meta. Programar este script cada hora (Programador de tareas de
Windows, cron o una GitHub Action) mantiene la sección al día.

Las fotos se descargan a assets/fb/ porque los enlaces de imágenes de
Facebook vencen a los pocos días.
"""
import argparse, datetime, json, os, re, sys, unicodedata, urllib.parse, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARCHIVO = os.path.join(RAIZ, "assets", "facebook.js")
CARPETA_FOTOS = os.path.join(RAIZ, "assets", "fb")
API = "https://graph.facebook.com/v21.0"
MAXIMO = 300  # publicaciones que se conservan en el sitio

AREAS = [
    ("Avisos", ["alerta", "aviso", "corte de", "atención vecinos", "atencion vecinos", "recolección", "recoleccion", "no habrá", "no habra", "suspend"]),
    ("Deporte", ["deport", "fútbol", "futbol", "handball", "vóley", "voley", "atletismo", "boxeo", "taekwondo", "básquet", "basquet", "newcom", "rally", "triatl", "polideportivo"]),
    ("Cultura", ["cultura", "taller", "museo", "orquesta", "aniversario", "festival", "peña", "biblioteca", "jineteada"]),
    ("Salud", ["salud", "hospital", "vacun", "prevención", "prevencion", "cáncer", "cancer"]),
    ("Desarrollo Social", ["desarrollo social", "anses", "auh", "plan gas", "adultos mayores", "centro infantil", "merendero"]),
    ("Obras y barrios", ["obra", "pavimento", "cordón cuneta", "cordon cuneta", "red de gas", "red de agua", "vivienda", "lotes", "ippv"]),
    ("Servicios públicos", ["limpieza", "residuos", "contenedor", "luminaria", "alumbrado", "poda"]),
    ("Gobierno", ["intendenta", "concejo", "ordenanza", "resolución", "resolucion", "convenio"]),
]


def sin_emojis(texto):
    limpio = []
    for c in texto:
        cat = unicodedata.category(c)
        if cat in ("So", "Cs", "Co") or 0xFE00 <= ord(c) <= 0xFE0F or ord(c) in (0x200D, 0x20E3):
            continue
        limpio.append(c)
    texto = "".join(limpio)
    texto = re.sub(r"[ \t]+", " ", texto)
    texto = re.sub(r" *\n *", "\n", texto)
    return re.sub(r"\n{2,}", "\n", texto).strip()


NOMBRES = ["Cervantes", "Río Negro", "Puente Cero", "Colonia Fátima", "La Defensa", "Porvenir", "Barrio Luna",
           "Ferrocarril", "Virgen de Luján", "Acceso Oeste", "Vitturini", "Municipalidad", "Concejo Deliberante",
           "Polideportivo", "Museo del Centenario", "Centro Infantil Ayelén", "Desarrollo Social", "IPPV", "ANSES",
           "AUH", "SUBE", "PAMI", "EDERSA", "Mundialito", "General Roca", "Cipolletti", "Neuquén", "Argentina",
           "Día de la Madre", "Día del Padre", "Día del Niño", "Escuela Municipal", "Claudia Montanaro"]


def oracion(texto):
    """Pasa a minúscula los títulos escritos todo en mayúsculas y recupera los nombres propios conocidos."""
    letras = [c for c in texto if c.isalpha()]
    if letras and sum(c.isupper() for c in letras) / len(letras) > 0.7:
        texto = texto.lower()
        texto = texto[0].upper() + texto[1:]
        for nombre in NOMBRES:
            texto = re.sub(re.escape(nombre.lower()), nombre, texto, flags=re.IGNORECASE)
        texto = texto[0].upper() + texto[1:]
    return texto


def titulo_y_cuerpo(mensaje):
    lineas = [l for l in mensaje.split("\n") if l.strip()]
    if not lineas:
        return "Publicación", ""
    titulo = lineas[0].strip(" .!:¡")
    if len(titulo) > 110:
        corte = re.split(r"(?<=[.!?])\s", titulo, maxsplit=1)[0]
        titulo = corte if len(corte) <= 110 else titulo[:107].rsplit(" ", 1)[0] + "…"
        cuerpo = "\n".join(lineas)
    else:
        cuerpo = "\n".join(lineas[1:]) or lineas[0]
    return oracion(titulo), cuerpo


def clasificar(texto):
    t = texto.lower()
    for area, claves in AREAS:
        if any(k in t for k in claves):
            return area
    return "Comunidad"


def fecha_local(iso):
    # created_time llega en UTC: "2026-10-21T21:30:00+0000"
    d = datetime.datetime.strptime(iso, "%Y-%m-%dT%H:%M:%S%z")
    return d.astimezone(datetime.timezone(datetime.timedelta(hours=-3))).date().isoformat()


def pedir(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def bajar_foto(url, nombre):
    os.makedirs(CARPETA_FOTOS, exist_ok=True)
    destino = os.path.join(CARPETA_FOTOS, nombre)
    if not os.path.exists(destino):
        with urllib.request.urlopen(url, timeout=30) as r, open(destino, "wb") as f:
            f.write(r.read())
    return "assets/fb/" + nombre


def fotos_de(post):
    urls = []
    for adj in (post.get("attachments") or {}).get("data", []):
        subs = (adj.get("subattachments") or {}).get("data", [])
        for s in subs or [adj]:
            src = ((s.get("media") or {}).get("image") or {}).get("src")
            if src:
                urls.append(src)
    if not urls and post.get("full_picture"):
        urls.append(post["full_picture"])
    return urls[:8]


def leer_existentes():
    if not os.path.exists(ARCHIVO):
        return []
    texto = open(ARCHIVO, encoding="utf-8").read()
    inicio = texto.index("=") + 1
    return json.loads(texto[inicio:].strip().rstrip(";"))["posts"]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pagina", default=os.environ.get("FB_PAGE_ID", "552581624817618"))
    ap.add_argument("--cantidad", type=int, default=25)
    ap.add_argument("--sin-fotos", action="store_true")
    ap.add_argument("--desde-archivo")
    a = ap.parse_args()

    if a.desde_archivo:
        respuesta = json.load(open(a.desde_archivo, encoding="utf-8"))
    else:
        token = os.environ.get("FB_TOKEN")
        if not token:
            sys.exit("Falta el token: definí la variable de entorno FB_TOKEN con el token de página.")
        campos = "id,message,created_time,permalink_url,full_picture,attachments{media,subattachments.limit(8){media}}"
        url = "%s/%s/posts?%s" % (API, a.pagina, urllib.parse.urlencode(
            {"fields": campos, "limit": a.cantidad, "access_token": token}))
        respuesta = pedir(url)

    nuevos = []
    for p in respuesta.get("data", []):
        mensaje = sin_emojis(p.get("message") or "")
        if not mensaje:
            continue  # se saltean las publicaciones sin texto (fotos de portada, etc.)
        id_post = p["id"].split("_")[-1]
        titulo, cuerpo = titulo_y_cuerpo(mensaje)
        fotos = [] if a.sin_fotos else fotos_de(p)
        locales = []
        for i, src in enumerate(fotos):
            try:
                locales.append(bajar_foto(src, "%s-%d.jpg" % (id_post, i)))
            except Exception as ex:  # una foto que falla no frena la actualización
                print("No se pudo bajar una foto de %s: %s" % (id_post, ex), file=sys.stderr)
        nuevos.append(dict(
            id="fb-" + id_post, fecha=fecha_local(p["created_time"]), area=clasificar(mensaje),
            fuente="Facebook", titulo=titulo, texto=cuerpo,
            img=locales[0] if locales else "", galeria=locales[1:],
            original=p.get("permalink_url") or "https://www.facebook.com/%s/posts/%s" % (a.pagina, id_post)))

    por_id = {x["id"]: x for x in leer_existentes()}
    for n in nuevos:
        previo = por_id.get(n["id"], {})
        if previo.get("area") and previo.get("area_fija"):
            n["area"] = previo["area"]  # respeta un área corregida a mano
        por_id[n["id"]] = {**previo, **n}
    posts = sorted(por_id.values(), key=lambda x: (x["fecha"], x["id"]), reverse=True)[:MAXIMO]

    datos = dict(pagina=a.pagina, actualizado=datetime.datetime.now().astimezone().isoformat(timespec="seconds"), posts=posts)
    with open(ARCHIVO, "w", encoding="utf-8") as f:
        f.write("/* Generado por herramientas/actualizar_facebook.py. No editar a mano. */\nwindow.FACEBOOK = ")
        json.dump(datos, f, ensure_ascii=False, indent=1)
        f.write(";\n")
    print("Listo: %d publicaciones nuevas o actualizadas, %d en total." % (len(nuevos), len(posts)))


if __name__ == "__main__":
    main()
