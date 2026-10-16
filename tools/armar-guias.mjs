// Arma las guías paso a paso (sitio/guias/ y sitio/guias/<guia>/), con las capturas de sitio/img/guias/.
// Uso: node tools/armar-guias.mjs   (las capturas salen de tools/capturas-guias.mjs)
import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITIO = join(dirname(fileURLToPath(import.meta.url)), "..", "sitio");
const URL = "https://kovoapp.github.io/";

// Cada paso: [título, texto, captura (sitio/img/guias/<captura>.jpg) o null, texto alternativo].
const GUIAS = [
  {
    slug: "crear-tu-negocio", titulo: "Cómo crear tu negocio en Kovo", corto: "Crear tu negocio",
    desc: "Creá tu cuenta y dejá listo tu negocio con sus locales y medios de pago en un minuto.",
    intro: "Para empezar solo necesitás un email y una contraseña. Lo demás se puede cambiar después desde Ajustes.",
    pasos: [
      ["Creá tu cuenta", "Entrá a kovoapp.github.io/app, tocá Crear cuenta y poné tu email y una contraseña de al menos 8 caracteres. Con esa cuenta entrás desde cualquier celular o computadora.", "cuenta", "Pantalla de Kovo para crear la cuenta con email y contraseña"],
      ["Cargá los datos del negocio", "Escribí el nombre del negocio y tu nombre. Si tenés más de un local, agregalos: cada uno tiene su propia caja. Marcá los medios de pago que aceptás y tocá Crear mi negocio.", "alta", "Formulario de alta del negocio con nombre, locales y medios de pago"],
      ["Listo, ya podés vender", "Arrancás con 7 días de prueba gratis. El siguiente paso es cargar tus productos, aunque también podés anotar ventas poniendo solo el monto.", null, ""],
    ],
  },
  {
    slug: "cargar-productos", titulo: "Cómo cargar tus productos y precios", corto: "Cargar productos",
    desc: "Cargá productos uno por uno o desde una planilla de Excel, con precio por unidad o por kilo, costo, código de barras y stock.",
    intro: "Los productos que cargás aparecen en el buscador de la pantalla Vender. Están en Ajustes (el engranaje de arriba a la derecha), en la tarjeta Productos.",
    pasos: [
      ["Cargá un producto", "Poné el nombre y el precio. Elegí si se vende por unidad o por kilo: si es por kilo, el precio es el del kilo y al vender ponés los gramos. El costo es opcional, pero con él Kovo te dice cuánto ganás. El stock también es opcional: si lo cargás, se descuenta solo con cada venta.", "producto-nuevo", "Formulario de producto nuevo con nombre, precio, costo, venta por kilo y stock"],
      ["Escaneá el código de barras", "En el campo Código de barras tocá la cámara y apuntá al código, o usá un lector de mano si tenés. Después, al vender, escaneás y el producto se carga solo.", null, ""],
      ["Si tenés muchos, importalos desde Excel", "Tocá Importar desde Excel. La planilla necesita una columna Nombre y otra Precio, y puede tener Costo, Código, Stock y Unidad. Si no sabés cómo armarla, descargá la planilla de ejemplo y completala. Si un producto ya existe, se actualiza.", "importar", "Panel para importar productos desde una planilla de Excel"],
      ["Cambiá precios, costos o stock desde la lista", "En la lista tocá el precio, el costo o el stock de un producto para cambiarlo. Al lado de cada uno ves cuánto ganás en porcentaje.", "lista-productos", "Lista de productos con precio, costo, ganancia y stock"],
    ],
  },
  {
    slug: "vender", titulo: "Cómo anotar una venta y calcular el vuelto", corto: "Vender",
    desc: "Buscá o escaneá los productos, cobrá con el medio de pago que corresponda, mirá el vuelto e imprimí el ticket.",
    intro: "Todo pasa en la pantalla Vender, la primera que ves al abrir Kovo.",
    pasos: [
      ["Agregá los productos", "Escribí parte del nombre o escaneá el código con la cámara y tocá el producto. Cambiá la cantidad si llevan más de uno. En los productos por kilo, la cantidad es en gramos: 350 son 350 gramos.", "carrito", "Carrito con yerba, 350 gramos de queso y dos leches"],
      ["Elegí el medio de pago", "Tocá cómo te pagan. Si es en efectivo, poné con cuánto paga y Kovo te dice el vuelto. Si vendés algo que no está cargado, podés escribir directamente el total.", "cobrar", "Cobro en efectivo: total, paga con 15.000 y el vuelto"],
      ["Anotá la venta", "Tocá Anotar venta. Si querés, imprimí el ticket. Si te equivocaste, Eliminar la última venta la borra y devuelve el stock.", "venta-anotada", "Venta anotada con los botones para imprimir el ticket y eliminar la venta"],
    ],
  },
  {
    slug: "fiado", titulo: "Cómo anotar el fiado y cobrar lo que te deben", corto: "Fiado",
    desc: "Activá el fiado, anotá a quién le fiaste, mirá cuánto te debe cada cliente y anotá los pagos cuando te paguen.",
    intro: "El fiado viene apagado. Si en tu negocio fiás, lo prendés una vez y queda disponible para todos los que usan la caja.",
    pasos: [
      ["Activalo en Ajustes", "Entrá a Ajustes (el engranaje de arriba a la derecha) y en la tarjeta Fiado marcá Usar fiado en este negocio. Si después lo apagás, deja de aparecer, pero lo que te deben sigue a la vista.", "fiado-ajustes", "Tarjeta Fiado en Ajustes con la opción para activarlo"],
      ["Fiá una venta", "En Vender, cargá los productos o el total y elegí Fiado como medio de pago. Escribí el nombre del cliente o elegilo de la lista: si ya te debe, Kovo te muestra cuánto. Tocá Anotar venta.", "fiar", "Venta con Fiado como medio de pago, el cliente y lo que ya debe"],
      ["Mirá quién te debe", "Abajo de la pantalla Vender está la tarjeta Fiado, con el total que te deben y cuánto debe cada cliente. En Últimos movimientos ves cada fiado y cada pago con su fecha.", "fiado-lista", "Tarjeta Fiado con lo que debe cada cliente"],
      ["Anotá cuando te pagan", "Tocá Cobrar al lado del cliente, poné cuánto te paga (puede ser una parte) y cómo paga. Tocá Anotar pago y su deuda baja. Si paga en efectivo, en el resumen del día se suma al efectivo que tiene que haber en la caja.", "fiado-cobrar", "Pago de un cliente: monto, medio de pago y el botón Anotar pago"],
    ],
  },
  {
    slug: "cierre-de-caja", titulo: "Cómo hacer la caja inicial y el cierre de caja", corto: "Caja inicial y cierre",
    desc: "Anotá con cuánto abre la caja, los retiros del día, y al cerrar mirá cuánto efectivo tiene que haber y qué fue lo más vendido.",
    intro: "Con la caja inicial y los retiros anotados, Kovo te dice cuánta plata en efectivo tiene que haber en la caja al final del día.",
    pasos: [
      ["Anotá la caja inicial", "Al abrir, entrá a Caja inicial, elegí el local y poné con cuánto efectivo arranca la caja.", "caja-inicial", "Pantalla de caja inicial con el monto y la fecha"],
      ["Anotá los retiros", "Si sacás plata de la caja durante el día, anotalo en Pagos como Retiro de caja. No cuenta como gasto en el balance, pero se descuenta del efectivo.", "retiro", "Pantalla de pagos con un retiro de caja de 15.000"],
      ["Mirá el resumen del día", "En Resumen ves el total vendido, cuánto entró por cada medio de pago y, abajo, el efectivo que tiene que haber en la caja: caja inicial más ventas en efectivo menos retiros.", "resumen-dia", "Resumen del día con lo vendido por medio de pago y el efectivo en caja"],
      ["Cerrá la caja", "En la tarjeta Cierre de caja tenés lo vendido, la cantidad de ventas, el ticket promedio y lo más vendido del día. Con Compartir cierre lo mandás por WhatsApp.", "cierre", "Cierre de caja con lo vendido, cantidad de ventas, ticket promedio y lo más vendido"],
      ["Revisá el stock bajo", "Si cargaste stock, Kovo te avisa qué productos se terminaron o se terminan en una semana al ritmo que venden. Así sabés qué pedirle al proveedor.", "stock-bajo", "Lista de productos con stock bajo y para cuántos días alcanza"],
    ],
  },
  {
    slug: "invitar-cajeros", titulo: "Cómo sumar a tus empleados como cajeros", corto: "Invitar cajeros",
    desc: "Generá un código de invitación para que tus empleados vendan con su propia cuenta, sin ver el balance ni la ganancia.",
    intro: "Cada empleado entra con su propia cuenta. Los cajeros solo ven la pantalla de Vender y sus propias ventas.",
    pasos: [
      ["Generá el código", "En Ajustes, en la tarjeta Equipo, tocá Código para cajero. Copialo y mandáselo a tu empleado. Vence en 7 días y sirve una sola vez.", "equipo", "Tarjeta Equipo con un código de invitación para cajero"],
      ["Tu empleado se une", "Tu empleado entra a kovoapp.github.io/app, crea su cuenta, toca Me invitaron y pone el código y su nombre. Ya puede vender.", null, ""],
    ],
  },
  {
    slug: "aumentar-precios", titulo: "Cómo aumentar todos los precios de una vez", corto: "Aumentar precios",
    desc: "Subí los precios de todos tus productos, o solo de algunos, por porcentaje y con redondeo.",
    intro: "Cuando te llega una lista nueva del proveedor, no hace falta cambiar los precios uno por uno.",
    pasos: [
      ["Elegí qué productos aumentar", "En Ajustes, en Productos, escribí en el filtro de la lista para aumentar solo algunos (por ejemplo, una marca). Si lo dejás vacío, se aumentan todos.", null, ""],
      ["Poné el porcentaje y el redondeo", "Tocá Aumentar precios, poné el porcentaje y elegí cómo redondear el precio nuevo. Si dejás marcado Subir también el costo, la ganancia se mantiene. Abajo te muestra un ejemplo antes de aplicarlo.", "aumentar", "Panel para aumentar precios un 10% redondeando a 10 pesos"],
      ["Confirmá", "Tocá Aumentar precios y listo: los precios nuevos ya aparecen en Vender.", null, ""],
    ],
  },
  {
    slug: "balance-del-mes", titulo: "Cómo ver el balance y la ganancia del mes", corto: "Balance y ganancia",
    desc: "Mirá los ingresos y egresos del mes, la ganancia, lo más vendido y descargá todo para tu contador.",
    intro: "En Balance tenés el mes completo. Lo ven el dueño y los administradores, no los cajeros.",
    pasos: [
      ["Ingresos y egresos", "Elegí el mes y vas a ver lo que entró por cada medio de pago, los pagos a proveedores, los impuestos y el balance. Con Descargar balance del mes lo bajás en una planilla para tu contador.", "balance", "Balance del mes con los ingresos por medio de pago"],
      ["Ventas del mes", "La cantidad de ventas, el ticket promedio, el mejor día y los 10 productos que más vendiste.", "ventas-mes", "Ventas del mes con cantidad, ticket promedio, mejor día y lo más vendido"],
      ["Ganancia", "Si cargaste el costo de tus productos, Kovo te dice cuánto ganaste en el mes, en pesos y en porcentaje.", "ganancia", "Ganancia del mes: vendido, lo que costó y la ganancia"],
    ],
  },
];

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const TEL = "5493329593188";

function marco({ titulo, desc, url, img, ld, pre, cuerpo }) {
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(titulo)} · Kovo</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#1b1f3b">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(titulo)} · Kovo">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<link rel="icon" href="${pre}icons/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${pre}icons/icon-192.png?v=2">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="${pre}estilo.css?v=4">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<!-- Generado por tools/armar-guias.mjs: cambiá los textos ahí, no acá. -->
<header id="top">
  <div class="wrap nav">
    <a class="marca" href="${pre}"><img src="${pre}icons/logo.svg" alt="">Kovo</a>
    <nav class="links"><a href="${pre}guias/">Guías</a><a href="${pre}app/?demo">Demo</a><a href="${pre}#precio">Precio</a></nav>
    <a class="btn sec" href="${pre}app/">Entrar</a>
  </div>
</header>

<main class="wrap">
${cuerpo}
  <section class="final">
    <h2>¿Querés probarlo?</h2>
    <p class="mu">Mirá la demo con datos de ejemplo, o creá tu cuenta y probalo 7 días gratis.</p>
    <div class="ctas" style="justify-content:center">
      <a class="btn pri" href="${pre}app/?demo">Ver la demo</a>
      <a class="btn sec" href="${pre}app/?registro">Probá 7 días gratis</a>
    </div>
  </section>
</main>

<footer>
  <div class="wrap">
    <a class="marca" href="${pre}"><img src="${pre}icons/logo.svg" alt="">Kovo</a>
    <span>La caja de tu negocio, en el celular.</span>
    <span style="margin-left:auto;display:flex;gap:16px"><a href="${pre}guias/">Guías</a><a class="wa" href="#" target="_blank" rel="noopener">WhatsApp</a><a href="${pre}app/">Entrar</a></span>
  </div>
  <div class="wrap legales"><a href="${pre}terminos/">Términos y condiciones</a><a href="${pre}privacidad/">Privacidad</a><a href="${pre}baja/">Darse de baja</a><a href="${pre}arrepentimiento/">Botón de arrepentimiento</a></div>
</footer>

<script>
  const msg = "Hola, estuve viendo las guías de Kovo y tengo una consulta.";
  document.querySelectorAll("a.wa").forEach(a => a.href = "https://wa.me/${TEL}?text=" + encodeURIComponent(msg));
  const h = document.getElementById("top");
  addEventListener("scroll", () => h.classList.toggle("sombra", scrollY > 8), { passive: true });
</script>
</body>
</html>
`;
}

const portada = g => g.pasos.find(p => p[2])[2];

function guia(g, i) {
  const url = `${URL}guias/${g.slug}/`;
  const ld = {
    "@context": "https://schema.org", "@type": "HowTo", name: g.titulo, description: g.desc, inLanguage: "es-AR",
    step: g.pasos.map(([t, p, img], n) => ({ "@type": "HowToStep", position: n + 1, name: t, text: p, url: `${url}#paso-${n + 1}`, ...(img ? { image: `${URL}img/guias/${img}.jpg` } : {}) })),
  };
  const ant = GUIAS[i - 1], sig = GUIAS[i + 1];
  const cuerpo = `  <article class="guia">
    <nav class="miga"><a href="../">Guías</a> / ${esc(g.corto)}</nav>
    <h1>${esc(g.titulo)}</h1>
    <p class="intro">${esc(g.intro)}</p>
    <ol class="gpasos">
${g.pasos.map(([t, p, img, alt], n) => `      <li id="paso-${n + 1}"${img ? "" : ' class="solo"'}>
        <div class="gtxt"><h2>${esc(t)}</h2><p>${esc(p)}</p></div>${img ? `
        <img src="../../img/guias/${img}.jpg" alt="${esc(alt)}" loading="${n ? "lazy" : "eager"}">` : ""}
      </li>`).join("\n")}
    </ol>
    <nav class="gsig">${ant ? `<a href="../${ant.slug}/"><span>Anterior</span>${esc(ant.corto)}</a>` : "<span></span>"}${sig ? `<a class="der" href="../${sig.slug}/"><span>Siguiente</span>${esc(sig.corto)}</a>` : `<a class="der" href="../"><span>Volver</span>Todas las guías</a>`}</nav>
  </article>
`;
  return marco({ titulo: g.titulo, desc: g.desc, url, img: `${URL}img/guias/${portada(g)}.jpg`, ld, pre: "../../", cuerpo });
}

function indice() {
  const url = `${URL}guias/`, desc = "Guías paso a paso con capturas para usar Kovo: crear tu negocio, cargar productos, vender, hacer el cierre de caja, sumar cajeros y ver el balance.";
  const ld = { "@context": "https://schema.org", "@type": "ItemList", name: "Guías de Kovo", itemListElement: GUIAS.map((g, n) => ({ "@type": "ListItem", position: n + 1, url: `${url}${g.slug}/`, name: g.titulo })) };
  const cuerpo = `  <section class="guia">
    <h1>Guías de Kovo</h1>
    <p class="intro">Paso a paso y con capturas, para arrancar o para mostrarle a tu empleado. Si te queda alguna duda, escribinos por WhatsApp.</p>
    <div class="glista">
${GUIAS.map((g, n) => `      <a class="gcard" href="${g.slug}/"><img src="../img/guias/${portada(g)}.jpg" alt="" loading="lazy"><span class="gn">${n + 1}</span><b>${esc(g.corto)}</b><span>${esc(g.desc)}</span></a>`).join("\n")}
    </div>
  </section>
`;
  return marco({ titulo: "Guías paso a paso", desc, url, img: `${URL}img/guias/cierre.jpg`, ld, pre: "../", cuerpo });
}

await mkdir(join(SITIO, "guias"), { recursive: true });
await writeFile(join(SITIO, "guias", "index.html"), indice());
for (const [i, g] of GUIAS.entries()) {
  await mkdir(join(SITIO, "guias", g.slug), { recursive: true });
  await writeFile(join(SITIO, "guias", g.slug, "index.html"), guia(g, i));
}
console.log(GUIAS.length + " guías");
