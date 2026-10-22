/* Maqueta: Municipalidad de Cervantes. Sin dependencias; funciona abriendo los archivos localmente. */
(function () {
  "use strict";
  var S = window.SITE || {};
  S.social = (window.FACEBOOK && window.FACEBOOK.posts) || [];
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  function fecha(iso) {
    var p = iso.split("-");
    return parseInt(p[2], 10) + " de " + MESES[parseInt(p[1], 10) - 1] + " de " + p[0];
  }
  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(t) {
    return String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function coincide(texto, consulta) {
    var t = norm(texto);
    return norm(consulta).split(/\s+/).filter(Boolean).every(function (w) { return t.indexOf(w) !== -1; });
  }
  function parrafos(t) {
    return t.split("\n").map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
  }

  /* Imágenes que no cargan: dejan el fondo neutro en lugar del ícono roto */
  function imagenes(ctx) {
    $$("img", ctx).forEach(function (img) {
      if (img.dataset.ok) return;
      img.dataset.ok = "1";
      img.addEventListener("error", function () { img.classList.add("sin-imagen"); });
      if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) img.classList.add("sin-imagen");
    });
  }
  imagenes();

  /* Menú en celulares */
  var boton = $(".menu-boton"), nav = $("#nav");
  if (boton && nav) {
    boton.addEventListener("click", function () {
      var abierto = nav.classList.toggle("abierto");
      boton.setAttribute("aria-expanded", abierto ? "true" : "false");
    });
  }
  $$(".nav details").forEach(function (d) {
    document.addEventListener("click", function (e) { if (!d.contains(e.target)) d.removeAttribute("open"); });
  });

  /* Portada: avisos y "Esta semana" salen de las publicaciones de Facebook */
  function resumen(t, n) {
    t = t.replace(/\n/g, " ");
    return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "") + "\u2026";
  }
  var listaSemana = $("#semana");
  if (listaSemana && S.social.length) {
    var orden = S.social.slice().sort(function (a, b) { var x = a.fecha + a.id, y = b.fecha + b.id; return x < y ? 1 : x > y ? -1 : 0; });
    listaSemana.innerHTML = orden.filter(function (p) { return p.area !== "Avisos"; }).slice(0, 5).map(function (p) {
      return '<li><time datetime="' + p.fecha + '">' + fecha(p.fecha) + '</time><h3><a href="noticias.html#' + p.id + '">' +
        esc(p.titulo) + "</a></h3><p>" + esc(resumen(p.texto.split("\n")[0], 150)) + "</p></li>";
    }).join("");
    var aviso = $("#aviso");
    if (aviso) {
      var ultima = orden[0].fecha;
      var limite = new Date(ultima + "T12:00:00"); limite.setDate(limite.getDate() - 3);
      var a = orden.filter(function (p) { return p.area === "Avisos" && new Date(p.fecha + "T12:00:00") >= limite; })[0];
      if (!a) { aviso.hidden = true; }
      else {
        var lineas = a.texto.split("\n");
        $("h2", aviso).textContent = a.titulo;
        $(".aviso-texto", aviso).textContent = resumen(lineas[0], 230);
        $("a", aviso).setAttribute("href", "noticias.html#" + a.id);
        $(".fecha", aviso).textContent = "Publicado el " + fecha(a.fecha) + ".";
      }
    }
  }

  /* Buscador general de la portada */
  var indice = [];
  (S.paginas || []).forEach(function (p) { indice.push({ t: p.titulo, x: p.texto, u: p.url, tipo: "Página" }); });
  (S.telefonos || []).forEach(function (p) { indice.push({ t: p.titulo + ": " + p.numero, x: p.texto, u: "contacto.html#telefonos", tipo: "Teléfono" }); });
  (S.social || []).concat(S.posts || []).forEach(function (p) {
    indice.push({ t: p.titulo, x: p.area + " " + p.texto, u: "noticias.html#" + p.id, tipo: "Noticia, " + fecha(p.fecha) });
  });
  (S.docs || []).forEach(function (d) {
    indice.push({ t: d.tipo + (d.numero ? " " + d.numero : "") + ": " + d.asunto, x: d.nota || "", u: "boletin.html?q=" + encodeURIComponent(d.numero || d.asunto), tipo: "Boletín Oficial, " + fecha(d.fecha) });
  });
  (S.deportes || []).forEach(function (d) {
    indice.push({ t: d[0] + (d[1] ? " (" + d[1] + ")" : ""), x: [d[2], d[3], d[4]].join(" "), u: "deporte.html#escuelas", tipo: "Escuela deportiva: " + d[3] + ", " + d[4] });
  });

  var campo = $("#buscar"), lista = $("#resultados");
  if (campo && lista) {
    campo.addEventListener("input", function () {
      var q = campo.value.trim();
      if (q.length < 2) { lista.innerHTML = ""; return; }
      var r = indice.filter(function (i) { return coincide(i.t + " " + i.x, q); })
        .map(function (i, n) { return { i: i, s: (coincide(i.t, q) ? 0 : 1) * 1000 + n }; })
        .sort(function (a, b) { return a.s - b.s; }).map(function (o) { return o.i; }).slice(0, 8);
      lista.innerHTML = r.length
        ? r.map(function (i) { return '<li><a href="' + i.u + '">' + esc(i.t) + '<span class="tipo">' + esc(i.tipo) + "</span></a></li>"; }).join("")
        : '<li class="vacio">No encontramos nada con “' + esc(q) + '”. Probá con otra palabra o escribinos por WhatsApp al 2984 127886.</li>';
    });
    campo.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { var a = $("a", lista); if (a) { e.preventDefault(); window.location.href = a.getAttribute("href"); } }
    });
  }

  /* Noticias */
  var contNoticias = $("#lista-noticias");
  if (contNoticias) {
    var todas = (S.social || []).concat(S.posts || []).sort(function (a, b) { var x = a.fecha + a.id, y = b.fecha + b.id; return x < y ? 1 : x > y ? -1 : 0; });
    var area = "Todas", texto = "";
    var chips = $("#areas"), buscaN = $("#buscar-noticias"), cuenta = $("#cuenta-noticias");
    var areas = ["Todas"].concat(todas.map(function (n) { return n.area; }).filter(function (a, i, arr) { return arr.indexOf(a) === i; }).sort());
    chips.innerHTML = areas.map(function (a) { return '<button type="button" aria-pressed="' + (a === "Todas") + '">' + esc(a) + "</button>"; }).join("");
    chips.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      area = b.textContent;
      $$("button", chips).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      pintar();
    });
    buscaN.addEventListener("input", function () { texto = buscaN.value.trim(); pintar(); });

    function pintar() {
      var r = todas.filter(function (n) { return (area === "Todas" || n.area === area) && (!texto || coincide(n.titulo + " " + n.texto, texto)); });
      cuenta.textContent = r.length === 1 ? "1 publicación" : r.length + " publicaciones";
      contNoticias.innerHTML = r.map(function (n) {
        var foto = n.img ? '<img src="' + n.img + '" alt="" loading="lazy">' : "";
        var res = n.texto.split("\n")[0];
        if (res.length > 180) res = res.slice(0, 177).replace(/\s+\S*$/, "") + "…";
        return '<li class="noticia"><div class="foto">' + foto + "</div><div>" +
          '<span class="etiqueta">' + esc(n.area) + "</span>" + (n.fuente === "Facebook" ? '<span class="etiqueta fb">Facebook</span>' : "") +
          '<time class="meta" datetime="' + n.fecha + '">' + fecha(n.fecha) + "</time>" +
          '<h3><a href="#' + n.id + '">' + esc(n.titulo) + "</a></h3><p>" + esc(res) + "</p></div></li>";
      }).join("") || '<li class="noticia"><div></div><p>No hay publicaciones con ese filtro. Probá con “Todas”.</p></li>';
      imagenes(contNoticias);
    }
    pintar();

    var dlg = $("#detalle");
    function abrir(id) {
      var n = todas.filter(function (x) { return x.id === id; })[0];
      if (!n || !dlg) return;
      var gal = (n.galeria || []).map(function (g) { return '<a href="' + g + '" target="_blank" rel="noopener"><img src="' + g + '" alt="" loading="lazy"></a>'; }).join("");
      $(".contenido", dlg).innerHTML =
        (n.img ? '<img class="principal" src="' + n.img + '" alt="">' : "") +
        '<div class="cuerpo"><span class="etiqueta">' + esc(n.area) + '</span><time class="meta" datetime="' + n.fecha + '">' + fecha(n.fecha) + "</time>" +
        '<h2 class="display">' + esc(n.titulo) + "</h2>" + parrafos(n.texto) +
        (gal ? '<div class="galeria">' + gal + "</div>" : "") +
        (n.fuente === "Facebook"
          ? '<p class="nota-fuente">Publicado en la página de Facebook de la Municipalidad.' + (n.original ? ' <a href="' + n.original + '" target="_blank" rel="noopener">Ver en Facebook</a>' : "") + "</p>"
          : '<p class="nota-fuente">Publicado originalmente en municipiodecervantes.gob.ar.</p>') + "</div>";
      imagenes(dlg);
      if (!dlg.open) dlg.showModal();
      dlg.scrollTop = 0;
    }
    $(".cerrar", dlg).addEventListener("click", function () { dlg.close(); });
    dlg.addEventListener("close", function () { if (location.hash) history.replaceState(null, "", location.pathname + location.search); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    window.addEventListener("hashchange", function () { abrir(location.hash.slice(1)); });
    if (location.hash) abrir(location.hash.slice(1));
  }

  /* Boletín Oficial */
  var tabla = $("#tabla-boletin");
  if (tabla) {
    var tipoSel = $("#tipo"), anioSel = $("#anio"), qB = $("#buscar-boletin"), cuentaB = $("#cuenta-boletin");
    var docs = (S.docs || []).slice().sort(function (a, b) { var x = a.fecha + a.id, y = b.fecha + b.id; return x < y ? 1 : x > y ? -1 : 0; });
    var tipos = docs.map(function (d) { return d.tipo; }).filter(function (t, i, a) { return a.indexOf(t) === i; }).sort();
    var anios = docs.map(function (d) { return d.fecha.slice(0, 4); }).filter(function (t, i, a) { return a.indexOf(t) === i; });
    tipoSel.innerHTML = '<option value="">Todos</option>' + tipos.map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
    anioSel.innerHTML = '<option value="">Todos</option>' + anios.map(function (t) { return "<option>" + t + "</option>"; }).join("");
    var params = new URLSearchParams(location.search);
    if (params.get("q")) qB.value = params.get("q");
    function pintarB() {
      var r = docs.filter(function (d) {
        return (!tipoSel.value || d.tipo === tipoSel.value) && (!anioSel.value || d.fecha.slice(0, 4) === anioSel.value) &&
          (!qB.value.trim() || coincide([d.tipo, d.numero, d.asunto, d.nota].join(" "), qB.value.trim()));
      });
      cuentaB.textContent = r.length === 1 ? "1 documento" : r.length + " documentos";
      $("tbody", tabla).innerHTML = r.map(function (d) {
        var p = d.fecha.split("-");
        return "<tr><td class=\"num\" data-t=\"Fecha\">" + p[2] + "/" + p[1] + "/" + p[0] + '</td><td data-t="Tipo">' + esc(d.tipo) +
          (d.numero ? " " + esc(d.numero) : "") + '</td><td data-t="Asunto">' + esc(d.asunto) +
          (d.nota ? '<br><span class="nota-fuente">' + esc(d.nota) + "</span>" : "") +
          '</td><td data-t="Archivo"><a href="' + d.archivo + '" target="_blank" rel="noopener">Ver ' + (d.formato.indexOf("PDF") === 0 ? "PDF" : "imagen") + "</a>" +
          (d.paginas ? '<br><span class="nota-fuente">' + d.paginas + (d.paginas === "1" ? " página" : " páginas") + "</span>" : "") + "</td></tr>";
      }).join("") || '<tr><td colspan="4">No hay documentos con esos filtros.</td></tr>';
    }
    [tipoSel, anioSel].forEach(function (s) { s.addEventListener("change", pintarB); });
    qB.addEventListener("input", pintarB);
    pintarB();
  }

  /* Escuelas deportivas: filtros */
  var tablaD = $("#tabla-deporte");
  if (tablaD) {
    var dis = $("#disciplina"), lug = $("#lugar");
    var filas = $$("tbody tr", tablaD);
    function opciones(sel, col) {
      var v = filas.map(function (f) { return f.children[col].textContent; }).filter(function (t, i, a) { return t && a.indexOf(t) === i; }).sort();
      sel.innerHTML = '<option value="">Todas</option>' + v.map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
    }
    opciones(dis, 0); opciones(lug, 3);
    function filtrar() {
      filas.forEach(function (f) {
        f.hidden = (dis.value && f.children[0].textContent !== dis.value) || (lug.value && f.children[3].textContent !== lug.value);
      });
    }
    dis.addEventListener("change", filtrar); lug.addEventListener("change", filtrar);
  }

  /* Formularios que abren WhatsApp con el mensaje armado */
  $$("form[data-wa]").forEach(function (f) {
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var partes = $$("[data-campo]", f).map(function (c) { return c.value.trim() ? c.dataset.campo + ": " + c.value.trim() : ""; }).filter(Boolean);
      var intro = f.dataset.intro ? f.dataset.intro + "\n\n" : "";
      window.open("https://wa.me/" + f.dataset.wa + "?text=" + encodeURIComponent(intro + partes.join("\n")), "_blank", "noopener");
    });
  });
})();
