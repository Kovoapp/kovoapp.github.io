// Arma las páginas por rubro (sitio/kiosco/, sitio/almacen/, ...). Después: node tools/armar-sitemap.mjs
// Uso: node tools/armar-rubros.mjs   (después de cambiar los textos de abajo)
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITIO = join(dirname(fileURLToPath(import.meta.url)), "..", "sitio");
const URL = "https://kovoapp.github.io/";

const RUBROS = [
  {
    slug: "kiosco", nombre: "Kiosco", para: "kioscos", un: "un kiosco",
    titulo: "Sistema de caja para kioscos desde el celular",
    desc: "Kovo es la caja de tu kiosco en el celular: escaneás los códigos con la cámara, controlás el stock de golosinas y bebidas, y cerrás la caja de cada turno. Probá 7 días gratis.",
    h1: "La caja de tu kiosco, en el celular.",
    sub: "Escaneás con la cámara, Kovo calcula el vuelto y al final del turno sabés cuánta plata tiene que haber en la caja.",
    alt: "Venta en Kovo de un kiosco: alfajor, gaseosa y chicles con el total a cobrar",
    dolores: [
      ["Una venta atrás de otra", "Apuntás la cámara al código de barras y el producto se carga solo. Si ya tenés un lector de mano, también funciona. Kovo suma el total y te dice el vuelto."],
      ["Empleados por turno", "Cada empleado entra con su cuenta de cajero: anota ventas, pero no ve el balance ni la ganancia. Con la caja inicial y los retiros sabés cuánto efectivo tiene que haber al cambiar de turno."],
      ["Precios que suben todo el tiempo", "Subís los precios por porcentaje en un toque: todos, o solo los que buscaste, como una marca de golosinas. Kovo los redondea a $10 o a $100."],
      ["Mercadería que se termina sin avisar", "El stock se descuenta con cada venta y Kovo te avisa qué productos se están por terminar, según lo que vendés por día."],
    ],
    faq: [
      ["¿Tengo que comprar un lector de códigos?", "No. Kovo usa la cámara del celular. Si ya tenés un lector USB o Bluetooth, lo podés usar igual."],
      ["¿Puedo cargar mis productos desde una planilla?", "Sí. Subís un Excel o CSV con el nombre y el precio (y, si querés, código, costo y stock) y Kovo carga todo de una vez."],
      ["¿Cómo controlo lo que vende cada empleado?", "Cada uno entra con su cuenta de cajero. En el resumen del día ves cada venta con su hora y su local, y el cierre de caja con lo vendido y el efectivo."],
    ],
  },
  {
    slug: "almacen", nombre: "Almacén", para: "almacenes", un: "un almacén",
    titulo: "Sistema de caja y stock para almacenes",
    desc: "Kovo es la caja de tu almacén en el celular: vendés por unidad o por kilo, importás la lista del proveedor, anotás los pagos y ves cuánto ganás en el mes. Probá 7 días gratis.",
    h1: "Tu almacén ordenado, sin cuaderno ni planilla.",
    sub: "Vendés por unidad o por peso, anotás lo que le pagás a cada proveedor y al final del mes sabés cuánto ganaste.",
    alt: "Venta en Kovo de un almacén: yerba, queso cremoso por peso y leche",
    dolores: [
      ["Fiambre y queso por peso", "Los productos por kilo se venden escribiendo los gramos: 350 g de cremoso y Kovo calcula el precio. Los que van por unidad, se escanean."],
      ["Listas de precios que cambian cada semana", "Importás la lista del proveedor desde Excel y Kovo actualiza los precios de lo que ya tenías. O subís todo por porcentaje en un toque."],
      ["Pagos a proveedores mezclados con la caja", "Anotás cada pago al proveedor y queda descontado de la caja del día. En el balance del mes ves cuánto le pagaste a cada uno."],
      ["No saber cuánto te queda", "Cargás el costo de cada producto y en el balance ves cuánto vendiste, cuánto te costó y cuánto ganaste en el mes."],
    ],
    faq: [
      ["¿Puedo vender fiambre o queso por peso?", "Sí. Cargás el precio por kilo y en cada venta escribís los gramos. El stock también se lleva en kilos."],
      ["¿Puedo importar la lista de precios de mi proveedor?", "Sí, desde un Excel o CSV. Si un producto ya existe (mismo código o nombre), se actualiza el precio; si no, se crea."],
      ["¿Sirve si tengo más de un local?", "Sí. Cada local tiene su caja y en el balance ves todo junto o separado. No se cobra extra por local."],
    ],
  },
  {
    slug: "dietetica", nombre: "Dietética", para: "dietéticas", un: "una dietética",
    titulo: "Sistema de caja para dietéticas: venta a granel por kilo",
    desc: "Kovo es la caja de tu dietética en el celular: vendés a granel por gramos, cargás el costo por kilo para ver la ganancia y llevás las ventas mayoristas aparte. Probá 7 días gratis.",
    h1: "La caja de tu dietética, pensada para vender a granel.",
    sub: "Escribís los gramos y Kovo calcula el precio. Cargás el costo por kilo y ves cuánto ganás con cada producto.",
    alt: "Venta en Kovo de una dietética: almendras, avena y pasas de uva por gramos",
    dolores: [
      ["Casi todo se vende suelto", "Cargás el precio por kilo y en cada venta escribís los gramos: 250 g de almendras y Kovo calcula el precio. El stock se descuenta en kilos."],
      ["Márgenes distintos en cada producto", "Cargás el costo por kilo y en la lista ves cuánto ganás con cada producto. En el balance, la ganancia del mes."],
      ["Ventas al por mayor", "Tenés una caja mayorista aparte, con el cliente de cada venta y el total del mes por cliente."],
      ["Listas de mayoristas en Excel", "Importás la lista de tu proveedor y Kovo actualiza los precios y costos de lo que ya tenías cargado."],
    ],
    faq: [
      ["¿Puedo vender por gramos?", "Sí. Los productos por kilo se venden escribiendo los gramos, y el precio y el stock se calculan solos."],
      ["¿Puedo llevar las ventas mayoristas aparte?", "Sí. Creás un local mayorista: anotás cada venta con el cliente y el total, y en el balance ves cuánto le vendiste a cada uno."],
      ["¿Cómo sé qué productos me dejan más ganancia?", "Cargás el costo de cada producto. En la lista ves el porcentaje que ganás con cada uno y en el balance, lo más vendido y la ganancia del mes."],
    ],
  },
  {
    slug: "verduleria", nombre: "Verdulería", para: "verdulerías", un: "una verdulería",
    titulo: "Sistema de caja para verdulerías desde el celular",
    desc: "Kovo es la caja de tu verdulería en el celular: vendés por kilo o por unidad, cambiás los precios al momento y sabés cuánta plata tiene que haber en la caja. Probá 7 días gratis.",
    h1: "La caja de tu verdulería, en el celular que ya tenés.",
    sub: "Pesás en tu balanza, escribís los gramos y listo. Cambiás los precios en un segundo y cerrás la caja sin hacer cuentas.",
    alt: "Venta en Kovo de una verdulería: papa y tomate por kilo y lechuga por unidad",
    dolores: [
      ["Casi todo va por kilo", "Pesás como siempre y escribís los gramos: 2000 g de papa y Kovo calcula el precio. Lo que va por unidad, como la lechuga, se suma igual."],
      ["Precios que cambian cada semana", "Tocás el precio en la lista y lo cambiás al momento, o subís todo por porcentaje si cambió la lista del mercado."],
      ["Mucha plata en efectivo", "Anotás con cuánto abrís la caja y cada retiro. Kovo te dice cuánto efectivo tiene que haber al cerrar."],
      ["No hay compu en el puesto", "Funciona en el celular, sin instalar nada. Si se rompe el teléfono, entrás desde otro y tus ventas siguen ahí."],
    ],
    faq: [
      ["¿Se conecta con la balanza?", "No. Pesás en tu balanza de siempre y escribís los gramos en Kovo. No hace falta comprar nada."],
      ["¿Puedo anotar cobros con QR o transferencia?", "Sí. En cada venta marcás el medio de pago y en el cierre ves cuánto entró por cada uno."],
      ["¿Puedo cambiar un precio rápido?", "Sí. En la lista de productos tocás el precio y escribís el nuevo. Se actualiza para todos los que usan la caja."],
    ],
  },
  {
    slug: "carniceria", nombre: "Carnicería", para: "carnicerías", un: "una carnicería",
    titulo: "Sistema de caja para carnicerías: venta por kilo y ganancia por corte",
    desc: "Kovo es la caja de tu carnicería en el celular: vendés cada corte por kilo, subís los precios por porcentaje y ves cuánto te deja cada corte. Probá 7 días gratis.",
    h1: "La caja de tu carnicería, corte por corte.",
    sub: "Escribís los gramos de cada corte, Kovo calcula el total y al final del día tenés el cierre con lo que más se vendió.",
    alt: "Venta en Kovo de una carnicería: asado, vacío y milanesa por kilo",
    dolores: [
      ["Cada corte, por kilo", "Cargás el precio por kilo de cada corte y en la venta escribís los gramos. Kovo suma todo y calcula el vuelto."],
      ["El precio de la carne sube seguido", "Subís todos los cortes por porcentaje en un toque, o solo los que buscaste, y Kovo redondea a $10 o a $100."],
      ["Saber cuánto te deja cada corte", "Cargás el costo por kilo y en la lista ves cuánto ganás con cada corte. En el balance, la ganancia del mes."],
      ["Cerrar el día sin cuentas", "El cierre de caja te muestra lo vendido, la cantidad de ventas y los cortes que más salieron. Lo compartís por WhatsApp en un toque."],
    ],
    faq: [
      ["¿Se conecta con la balanza?", "No. Pesás en tu balanza y escribís los gramos. Si tu balanza imprime etiquetas con código, por ahora hay que cargar el peso a mano."],
      ["¿Imprime tickets?", "Sí, tickets no fiscales en una impresora térmica, con el mensaje que quieras al pie."],
      ["¿Puedo subir todos los precios juntos?", "Sí. Elegís el porcentaje, cómo redondear y si también sube el costo, y se aplica a todos los cortes o solo a los que filtraste."],
    ],
  },
];

const GENERAL = [
  ["¿Tengo que instalar algo?", "No. Kovo funciona desde el navegador del celular, la tablet o la compu. Si querés, lo agregás a la pantalla de inicio y se abre como una app."],
  ["¿Cuánto cuesta?", "$18.000 por mes, con todo incluido y sin límite de locales ni cajeros. Los primeros 10 negocios pagan $15.000 el primer mes. Tenés 7 días de prueba gratis."],
  ["¿Hace factura electrónica de ARCA?", "Todavía no. Kovo anota las ventas e imprime tickets no fiscales."],
];

const GRILLA = [
  ["Escáner con la cámara", "Apuntás al código de barras y el producto se carga solo."],
  ["Cierre de caja", "Lo vendido por medio de pago, el efectivo que tiene que haber y lo más vendido del día."],
  ["Balance del mes", "Ingresos, egresos, ganancia y lo más vendido. Ideal para el contador."],
  ["Alertas de stock", "Te avisa qué se está por terminar según lo que vendés."],
  ["Cuentas para cajeros", "Tus empleados venden, pero no ven el balance."],
  ["Tus datos, guardados", "Todo queda en la nube. Si se rompe el celular, entrás desde otro."],
];

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function pagina(r) {
  const url = URL + r.slug + "/";
  const faq = [...r.faq, ...GENERAL];
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "SoftwareApplication", name: "Kovo", applicationCategory: "BusinessApplication", operatingSystem: "Web, Android, iOS",
        description: r.desc, url, offers: { "@type": "Offer", price: "18000", priceCurrency: "ARS" } },
      { "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };
  const otros = RUBROS.filter(x => x !== r).map(x => `<a href="../${x.slug}/">${esc(x.nombre)}</a>`).join("");
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(r.titulo)} · Kovo</title>
<meta name="description" content="${esc(r.desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#2c7a4b">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(r.titulo)} · Kovo">
<meta property="og:description" content="${esc(r.desc)}">
<meta property="og:image" content="${URL}img/rubro-${r.slug}.jpg">
<link rel="icon" href="../icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../icons/icon-192.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="../estilo.css?v=3">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<!-- Generado por tools/armar-rubros.mjs: cambiá los textos ahí, no acá. -->
<header id="top">
  <div class="wrap nav">
    <a class="marca" href="../"><img src="../icons/icon.svg" alt="">Kovo</a>
    <nav class="links"><a href="#resuelve">Qué resuelve</a><a href="#precio">Precio</a><a href="#preguntas">Preguntas</a></nav>
    <a class="btn sec" href="../app/">Entrar</a>
  </div>
</header>

<main class="wrap">
  <section class="hero">
    <div>
      <span class="chip">Kovo para ${esc(r.para)}</span>
      <h1>${esc(r.h1)}</h1>
      <p class="sub">${esc(r.sub)}</p>
      <div class="ctas">
        <a class="btn pri wa" href="#" target="_blank" rel="noopener">Probá 7 días gratis</a>
        <a class="btn sec" href="../app/?demo=${r.slug}">Ver la demo de ${esc(r.un.replace(/^una? /, ""))}</a>
      </div>
      <p class="tranqui">Sin tarjeta para la prueba · Sin contrato · Cancelás cuando quieras</p>
    </div>
    <div class="tel"><img src="../img/rubro-${r.slug}.jpg" alt="${esc(r.alt)}" width="390" height="760"></div>
  </section>

  <section id="resuelve" class="mas">
    <h2>Lo que Kovo resuelve en ${esc(r.un)}</h2>
    <div class="dolores">
${r.dolores.map(([t, p]) => `      <div class="ben"><h3>${esc(t)}</h3><p>${esc(p)}</p></div>`).join("\n")}
    </div>
  </section>

  <section class="mas">
    <h2>Y además</h2>
    <div class="grilla">
${GRILLA.map(([t, p]) => `      <div class="ben"><h3>${esc(t)}</h3><p>${esc(p)}</p></div>`).join("\n")}
    </div>
  </section>

  <section id="precio" class="precio">
    <div>
      <h2>Un solo plan, con todo incluido</h2>
      <p class="mu" style="margin-top:14px;font-size:18px">Sin costos de instalación ni equipos especiales. Pagás con Mercado Pago y cancelás cuando quieras desde la app.</p>
    </div>
    <div class="tarjeta">
      <span class="lanz">Precio de lanzamiento · primeros 10 negocios</span>
      <div class="monto">$15.000 <small>el primer mes</small></div>
      <p class="despues">Después, $18.000 por mes.</p>
      <ul>
        <li>7 días de prueba gratis</li>
        <li>Locales y cajeros sin límite</li>
        <li>Todas las funciones</li>
        <li>Ayuda por WhatsApp</li>
      </ul>
      <a class="btn pri wa" href="#" target="_blank" rel="noopener">Probá 7 días gratis</a>
    </div>
  </section>

  <section id="preguntas" class="faq">
    <h2>Preguntas frecuentes</h2>
${faq.map(([q, a]) => `    <details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n")}
  </section>

  <section class="final">
    <h2>Probá Kovo en tu ${esc(r.nombre.toLowerCase())}</h2>
    <p class="mu">7 días gratis. Sin tarjeta, sin contrato.</p>
    <div class="ctas" style="justify-content:center">
      <a class="btn pri wa" href="#" target="_blank" rel="noopener">Probá 7 días gratis</a>
      <a class="btn sec" href="../app/?demo=${r.slug}">Ver la demo</a>
    </div>
    <p class="otros">Kovo también para: ${otros}</p>
  </section>
</main>

<footer>
  <div class="wrap">
    <a class="marca" href="../"><img src="../icons/icon.svg" alt="">Kovo</a>
    <span>La caja de tu negocio, en el celular.</span>
    <span style="margin-left:auto;display:flex;gap:16px"><a href="../guias/">Guías</a><a class="wa" href="#" target="_blank" rel="noopener">WhatsApp</a><a href="../app/">Entrar</a></span>
  </div>
</footer>

<script>
  const tel = "5493329593188";
  const msg = ${JSON.stringify(`Hola, tengo ${r.un} y quiero probar Kovo. ¿Me pasan un código de alta?`)};
  document.querySelectorAll("a.wa").forEach(a => a.href = "https://wa.me/" + tel + "?text=" + encodeURIComponent(msg));
  const h = document.getElementById("top");
  addEventListener("scroll", () => h.classList.toggle("sombra", scrollY > 8), { passive: true });
</script>
</body>
</html>
`;
}

for (const r of RUBROS) {
  await mkdir(join(SITIO, r.slug), { recursive: true });
  await writeFile(join(SITIO, r.slug, "index.html"), pagina(r));
}
// Para la página principal: la lista de rubros.
console.log(RUBROS.map(r => `<a class="rubro" href="${r.slug}/"><b>${r.nombre}</b><span>${r.dolores[0][0]}</span></a>`).join("\n"));
