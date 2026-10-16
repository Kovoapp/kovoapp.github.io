// Arma las páginas legales: términos y condiciones, privacidad, botón de arrepentimiento y baja
// (sitio/terminos/, sitio/privacidad/, sitio/arrepentimiento/, sitio/baja/).
// Uso: node tools/armar-legales.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL = "https://kovoapp.github.io/";
const TEL = "5493329593188";
const ACTUALIZADO = "15 de octubre de 2026";

// Datos del titular de Kovo. Si falta alguno, la página lo muestra marcado para completarlo.
const DATOS = {
  titular: "Vicente Sampol (Kovo)", // nombre completo o razón social
  cuit: "20-48162358-9",
  domicilio: "San Pedro, provincia de Buenos Aires", // ciudad y provincia, o domicilio completo
  email: "vicentesampol39@gmail.com", // para datos personales, bajas y arrepentimiento
};
const d = k => DATOS[k] ? esc(DATOS[k]) : `<mark>[falta: ${k}]</mark>`;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const wa = msg => `https://wa.me/${TEL}?text=${encodeURIComponent(msg)}`;
const contacto = () => `por email a ${DATOS.email ? `<a href="mailto:${esc(DATOS.email)}">${esc(DATOS.email)}</a>` : d("email")} o por <a href="${wa("Hola, te escribo por mi cuenta de Kovo.")}" target="_blank" rel="noopener">WhatsApp</a>`;

const PAGINAS = [
  {
    slug: "terminos", titulo: "Términos y condiciones",
    desc: "Las condiciones para usar Kovo: la prueba gratis, el precio, cómo se cobra, cómo darse de baja y qué hace y qué no hace el servicio.",
    cuerpo: () => `
<h2>1. Quién presta el servicio</h2>
<p>Kovo es una aplicación web para llevar la caja de un comercio. La presta ${d("titular")}, CUIT ${d("cuit")}, con domicilio en ${d("domicilio")} (en adelante, “Kovo”). Podés escribirnos ${contacto()}.</p>
<p>Al crear una cuenta aceptás estos términos. Si no estás de acuerdo, no uses el servicio.</p>

<h2>2. Qué es Kovo</h2>
<p>Kovo sirve para anotar ventas, la caja diaria, pagos a proveedores, el fiado, productos, stock y el balance del mes, desde el navegador del celular o la computadora. No hace falta instalar nada.</p>
<p>Kovo <b>no emite factura electrónica</b> ni reemplaza las obligaciones fiscales de tu negocio ante ARCA u otros organismos. Los tickets que imprime son comprobantes no fiscales.</p>

<h2>3. Tu cuenta</h2>
<ul>
<li>Para usar Kovo necesitás un email y una contraseña. Sos responsable de cuidar tu contraseña y de lo que se haga con tu cuenta.</li>
<li>El dueño del negocio puede invitar a cajeros y administradores. El dueño es responsable de a quién le da acceso y de lo que hagan dentro de su negocio.</li>
<li>Los datos que cargás (productos, precios, ventas, clientes del fiado, proveedores) son tuyos. Vos sos responsable de que sean correctos y de tener derecho a cargarlos.</li>
</ul>

<h2>4. Prueba gratis, precio y cobro</h2>
<ul>
<li>Cada negocio nuevo tiene <b>7 días de prueba gratis</b>, sin cargar tarjeta.</li>
<li>Después, Kovo cuesta el precio por mes que figura en <a href="../#precio">la página principal</a> al momento de suscribirte, con todas las funciones y sin límite de locales ni cajeros. Puede haber un precio de lanzamiento para el primer mes, que se aclara antes de pagar.</li>
<li>El pago se hace por <b>Mercado Pago</b>, como suscripción mensual o pagando de a un mes. Kovo no ve ni guarda los datos de tu tarjeta.</li>
<li>Si cambiamos el precio, te avisamos con al menos 30 días de anticipación. Si no estás de acuerdo, podés darte de baja antes de que se aplique.</li>
<li>Si un pago no se acredita, la caja queda en pausa: tus datos se conservan y podés volver a usarla cuando se regularice el pago.</li>
</ul>

<h2>5. Baja y arrepentimiento</h2>
<ul>
<li>Podés <b>cancelar la suscripción cuando quieras</b> desde la app (Ajustes → Plan → Cancelar suscripción), desde tu cuenta de Mercado Pago o pidiéndonoslo. Seguís usando la caja hasta el final del período que ya pagaste y no se te vuelve a cobrar. Más detalles en <a href="../baja/">Darse de baja</a>.</li>
<li>Tenés <b>10 días corridos</b> desde que contrataste para arrepentirte, sin dar explicaciones y sin costo, y te devolvemos lo que hayas pagado (artículo 34 de la Ley 24.240). Ver <a href="../arrepentimiento/">Botón de arrepentimiento</a>.</li>
</ul>

<h2>6. Funcionamiento del servicio</h2>
<ul>
<li>Hacemos lo posible para que Kovo funcione siempre, pero puede haber cortes por mantenimiento, fallas de internet o de los proveedores que usamos. Si te quedás sin conexión, la app guarda las ventas en el celular y las sube cuando vuelve.</li>
<li>Kovo es una herramienta de registro: los números que muestra dependen de lo que se cargue. Revisá tu caja como lo harías con cualquier cuaderno o planilla.</li>
<li>Podemos mejorar, cambiar o sacar funciones. Si un cambio te afecta de forma importante, te avisamos antes.</li>
</ul>

<h2>7. Uso correcto</h2>
<p>No podés usar Kovo para actividades ilegales, intentar acceder a datos de otros negocios, ni sobrecargar o dañar el servicio. Si eso pasa, podemos suspender la cuenta.</p>

<h2>8. Responsabilidad</h2>
<p>Kovo responde por el servicio que presta según la ley argentina. No responde por pérdidas que vengan de datos mal cargados, de un uso indebido de tu cuenta por alguien a quien le diste acceso, ni de cortes de servicios de terceros fuera de nuestro control.</p>

<h2>9. Tus datos</h2>
<p>Cómo tratamos tus datos personales está explicado en la <a href="../privacidad/">Política de privacidad</a>. Si te das de baja, podés pedirnos una copia de tus datos y que los borremos.</p>

<h2>10. Cambios y ley aplicable</h2>
<p>Si cambiamos estos términos, publicamos la nueva versión en esta página con su fecha, y si el cambio es importante te avisamos. Se aplica la ley de la República Argentina. Si sos consumidor, podés reclamar ante la autoridad de defensa del consumidor de tu jurisdicción o en <a href="https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario" target="_blank" rel="noopener">Defensa del Consumidor</a>.</p>`,
  },
  {
    slug: "privacidad", titulo: "Política de privacidad",
    desc: "Qué datos guarda Kovo, para qué, dónde, con quién se comparten y cómo pedir que se borren.",
    cuerpo: () => `
<h2>1. Responsable</h2>
<p>El responsable de los datos es ${d("titular")}, CUIT ${d("cuit")}, con domicilio en ${d("domicilio")}. Para cualquier consulta sobre tus datos escribinos ${contacto()}.</p>

<h2>2. Qué datos guardamos</h2>
<ul>
<li><b>De tu cuenta:</b> email, contraseña (guardada cifrada, nadie la puede leer) y el nombre que pongas.</li>
<li><b>De tu negocio:</b> nombre, locales, medios de pago, productos, precios, costos, stock, ventas, caja, pagos a proveedores y el texto del ticket.</li>
<li><b>Del fiado:</b> el nombre o apodo de los clientes a los que les fiás y lo que te deben. Estos datos los carga el comercio, que es el responsable de ellos; Kovo solo los guarda para que el comercio los use.</li>
<li><b>Del pago:</b> el estado de la suscripción y los avisos que manda Mercado Pago (número de operación, monto y fecha). No vemos ni guardamos datos de tarjetas.</li>
<li><b>En tu celular o compu:</b> la app guarda algunos datos en el navegador para funcionar sin internet y recordar tu sesión.</li>
</ul>
<p>Kovo no usa publicidad ni herramientas para seguirte en otras páginas.</p>

<h2>3. Para qué los usamos</h2>
<p>Solo para prestarte el servicio: mostrarte tu caja, calcular el cierre y el balance, cobrar la suscripción, darte soporte y avisarte cosas importantes de tu cuenta. No vendemos ni alquilamos tus datos.</p>

<h2>4. Dónde se guardan y con quién se comparten</h2>
<ul>
<li><b>Supabase</b>: base de datos e inicio de sesión. Sus servidores pueden estar fuera de Argentina; trabaja con medidas de seguridad estándar de la industria.</li>
<li><b>Mercado Pago</b>: procesa los pagos con sus propias políticas.</li>
<li><b>GitHub Pages</b>: aloja la página y la app.</li>
<li><b>Google Fonts</b>: carga las tipografías de la página.</li>
</ul>
<p>Solo compartimos datos con ellos en lo necesario para que el servicio funcione, o si una autoridad competente lo pide según la ley. Cada negocio solo puede ver sus propios datos.</p>

<h2>5. Cuánto tiempo los guardamos</h2>
<p>Mientras tengas la cuenta. Si te das de baja, los conservamos por si querés volver, salvo que nos pidas que los borremos. Los registros de pagos pueden guardarse el tiempo que exija la ley.</p>

<h2>6. Tus derechos</h2>
<p>Podés pedirnos acceder a tus datos, corregirlos, actualizarlos o borrarlos, escribiéndonos ${contacto()}. Respondemos los pedidos de acceso dentro de los 10 días corridos y los de corrección o borrado dentro de los 5 días hábiles, como indica la Ley 25.326.</p>
<p class="mu">El titular de los datos personales tiene la facultad de ejercer el derecho de acceso a los mismos en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto conforme lo establecido en el artículo 14, inciso 3 de la Ley N° 25.326. La Agencia de Acceso a la Información Pública, en su carácter de Órgano de Control de la Ley N° 25.326, tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.</p>

<h2>7. Seguridad</h2>
<p>Las conexiones van cifradas, las contraseñas se guardan cifradas y la base de datos tiene reglas para que cada negocio vea solo lo suyo. Ningún sistema es 100% seguro: si detectamos un problema que afecte tus datos, te avisamos.</p>

<h2>8. Cambios</h2>
<p>Si cambiamos esta política, publicamos la nueva versión acá con su fecha, y si el cambio es importante te avisamos.</p>`,
  },
  {
    slug: "arrepentimiento", titulo: "Botón de arrepentimiento",
    desc: "Si contrataste Kovo en los últimos 10 días, podés arrepentirte sin costo y te devolvemos lo que pagaste.",
    cuerpo: () => `
<p class="intro">Si contrataste la suscripción de Kovo hace <b>10 días corridos o menos</b>, podés arrepentirte sin dar explicaciones y sin costo. Te devolvemos todo lo que hayas pagado por el mismo medio de pago (Ley 24.240, artículo 34, y Resolución 424/2020).</p>
<div class="ctas" style="margin:28px 0">
  <a class="btn pri" href="${wa("Hola, quiero arrepentirme de la suscripción a Kovo. Mi email de la cuenta es: ")}" target="_blank" rel="noopener">Arrepentirme por WhatsApp</a>
  ${DATOS.email ? `<a class="btn sec" href="mailto:${esc(DATOS.email)}?subject=${encodeURIComponent("Arrepentimiento de la suscripción a Kovo")}&body=${encodeURIComponent("Quiero arrepentirme de la suscripción. Mi email de la cuenta es: ")}">Arrepentirme por email</a>` : d("email")}
</div>
<h2>Cómo sigue</h2>
<ul>
<li>Decinos el email con el que creaste la cuenta.</li>
<li>Dentro de las 24 horas te respondemos con un <b>código de identificación</b> de tu pedido.</li>
<li>Cancelamos la suscripción y pedimos la devolución en Mercado Pago. Los tiempos de acreditación dependen de Mercado Pago y de tu medio de pago.</li>
</ul>
<p class="mu">¿Pasaron más de 10 días? Igual podés darte de baja cuando quieras, sin costo: mirá <a href="../baja/">Darse de baja</a>. Mientras estás en los 7 días de prueba no se te cobra nada.</p>`,
  },
  {
    slug: "baja", titulo: "Darse de baja",
    desc: "Cómo cancelar la suscripción de Kovo: desde la app, desde Mercado Pago o pidiéndonoslo.",
    cuerpo: () => `
<p class="intro">Podés cancelar la suscripción <b>cuando quieras, sin costo y sin explicaciones</b>. Seguís usando la caja hasta el final del mes que ya pagaste y no se te vuelve a cobrar.</p>
<h2>Desde la app</h2>
<p>Entrá a <a href="../app/">Kovo</a> con la cuenta del dueño, tocá <b>Ajustes</b> (la tuerca de arriba a la derecha) → <b>Plan</b> → <b>Cancelar suscripción</b>.</p>
<h2>Desde Mercado Pago</h2>
<p>En tu cuenta de Mercado Pago: <b>Suscripciones</b> → Kovo → Cancelar.</p>
<h2>Pidiéndonoslo</h2>
<div class="ctas" style="margin:16px 0 28px">
  <a class="btn pri" href="${wa("Hola, quiero darme de baja de Kovo. Mi email de la cuenta es: ")}" target="_blank" rel="noopener">Pedir la baja por WhatsApp</a>
  ${DATOS.email ? `<a class="btn sec" href="mailto:${esc(DATOS.email)}?subject=${encodeURIComponent("Baja de Kovo")}&body=${encodeURIComponent("Quiero darme de baja. Mi email de la cuenta es: ")}">Pedir la baja por email</a>` : d("email")}
</div>
<p>Te respondemos con un código de identificación de tu pedido. Si además querés que borremos tus datos, decínoslo en el mismo mensaje.</p>
<p class="mu">Si contrataste hace 10 días o menos, también podés usar el <a href="../arrepentimiento/">botón de arrepentimiento</a> y te devolvemos lo que pagaste.</p>`,
  },
];

for (const p of PAGINAS) {
  const url = `${URL}${p.slug}/`;
  const html = `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(p.titulo)} · Kovo</title>
<meta name="description" content="${esc(p.desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#1b1f3b">
<link rel="icon" href="../icons/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../icons/icon-192.png?v=2">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="../estilo.css?v=4">
</head>
<body>
<!-- Generado por tools/armar-legales.mjs: cambiá los textos ahí, no acá. -->
<header id="top">
  <div class="wrap nav">
    <a class="marca" href="../"><img src="../icons/logo.svg" alt="">Kovo</a>
    <nav class="links"><a href="../guias/">Guías</a><a href="../app/?demo">Demo</a><a href="../#precio">Precio</a></nav>
    <a class="btn sec" href="../app/">Entrar</a>
  </div>
</header>

<main class="wrap">
  <article class="guia legal">
    <h1>${esc(p.titulo)}</h1>
    <p class="mu act">Última actualización: ${ACTUALIZADO}</p>
${p.cuerpo().trim()}
  </article>
</main>

${PIE("../")}
<script>
  const h = document.getElementById("top");
  addEventListener("scroll", () => h.classList.toggle("sombra", scrollY > 8), { passive: true });
</script>
</body>
</html>
`;
  mkdirSync(join(root, "sitio", p.slug), { recursive: true });
  writeFileSync(join(root, "sitio", p.slug, "index.html"), html);
  console.log("ok", p.slug);
}

// El pie con los links legales, igual en todas las páginas.
function PIE(pre) {
  return `<footer>
  <div class="wrap">
    <a class="marca" href="${pre}"><img src="${pre}icons/logo.svg" alt="">Kovo</a>
    <span>La caja de tu negocio, en el celular.</span>
    <span style="margin-left:auto;display:flex;gap:16px"><a href="${pre}guias/">Guías</a><a href="${wa("Hola, tengo una consulta sobre Kovo.")}" target="_blank" rel="noopener">WhatsApp</a><a href="${pre}app/">Entrar</a></span>
  </div>
  <div class="wrap legales"><a href="${pre}terminos/">Términos y condiciones</a><a href="${pre}privacidad/">Privacidad</a><a href="${pre}baja/">Darse de baja</a><a href="${pre}arrepentimiento/">Botón de arrepentimiento</a></div>
</footer>`;
}
