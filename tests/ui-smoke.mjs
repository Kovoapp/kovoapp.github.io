// Recorre la app de punta a punta con datos falsos y saca capturas.
// Uso: node tests/ui-smoke.mjs [carpeta-de-capturas]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = process.argv[2];
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  const p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  try { res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(await readFile(p)) }
  catch { res.writeHead(404); res.end() }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const mock = await readFile(join(root, "tests/mock-supabase.js"), "utf8");

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg) };
const browser = await chromium.launch();
for (const [w, h, scheme] of [[390, 844, "light"], [1100, 900, "dark"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: scheme });
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(mock);
  await page.goto(base);
  const snap = async n => { if (shots) await page.screenshot({ path: `${shots}/${n}-${w}-${scheme}.png`, fullPage: true }) };

  await page.waitForSelector("#screen-auth:not([hidden])");
  await snap("1-ingreso");
  check((await page.getAttribute(".footer-note a.contacto", "href") || "").startsWith("https://wa.me/5493329593188"), "el botón Escribinos abre WhatsApp");
  await page.click("#tabSignup");
  await page.fill("#aemail", "ana@dietetica.com"); await page.fill("#apass", "clave1234");
  await page.click("#authBtn");
  await page.waitForSelector("#screen-setup:not([hidden])");
  await page.fill("#sname", "Dietética Ana"); await page.fill("#sowner", "Ana");
  await page.fill("#sshops input", "Centro"); await page.click("#saddShop");
  await page.fill("#sshops .row:nth-child(2) input", "Norte");
  await page.check("#swhole");
  await snap("2-alta");
  await page.click("#screate");
  await page.waitForFunction(() => document.getElementById("smsg").textContent.includes("código"));
  check(true, "sin código de alta no deja crear el negocio");
  await page.fill("#scodigo", "NOEXISTE"); await page.click("#screate");
  await page.waitForFunction(() => document.getElementById("smsg").textContent.includes("no existe"));
  check(true, "con un código que no existe avisa");
  await page.fill("#scodigo", "prueba01"); await page.click("#screate");
  await page.waitForSelector("#screen-app:not([hidden])");
  check(await page.textContent("#bizName") === "Dietética Ana", "muestra el nombre del negocio");
  check((await page.$$("#locales .chip")).length === 3, "ofrece los 3 locales (2 + Mayorista)");

  await page.fill("#monto", "1500"); await page.fill("#paga", "2000");
  check((await page.textContent("#vv")) === "$500", "calcula el vuelto");
  await snap("3-vender");
  await page.click("#enviar");
  await page.waitForFunction(() => document.getElementById("msg").textContent.includes("anotada"));
  check(!(await page.isHidden("#undo")), "ofrece deshacer la última venta");

  await page.click("#locales .chip:nth-child(3)");
  check(!(await page.isHidden("#cliwrap")), "Mayorista pide cliente");
  check(!(await page.$$eval("#pagos .chip", b => b.map(x => x.textContent))).includes("QR"), "Mayorista no ofrece QR");
  await page.fill("#mnuevo", "Almacén Sol"); await page.click("#madd");
  await page.fill("#monto", "20000"); await page.click("#enviar");
  await page.waitForFunction(() => document.getElementById("msg").textContent.includes("anotada"));

  await page.click('.tab[data-t="prov"]');
  await page.fill("#pnuevo", "Granos del Sur"); await page.click("#padd2");
  await page.fill("#pmonto", "900"); await page.click("#penviar");
  await page.waitForFunction(() => document.getElementById("plista").textContent.includes("Granos del Sur"));
  check(true, "anota un pago a proveedor");

  await page.click('.tab[data-t="resumen"]');
  await page.waitForFunction(() => document.getElementById("total").textContent === "$21.500");
  check(true, "el resumen suma las ventas del día");
  await snap("4-resumen");

  await page.click('.tab[data-t="balance"]');
  await page.waitForFunction(() => document.getElementById("btabla").textContent.includes("$20.600"));
  check(true, "el balance resta los egresos");
  await snap("5-balance");

  await page.click("#cfg");
  await page.click("#invCashier");
  await page.waitForSelector("#cinvites .code");
  check(true, "crea un código de invitación");
  await snap("6-ajustes");
  check(await page.isHidden("#tabs") && await page.isHidden("#balance"), "Ajustes se abre como pantalla aparte");
  await page.fill("#pie", "Gracias por venir"); await page.click("#pieSave");
  await page.waitForFunction(() => window.__SB__.__db.businesses[0].ticket_footer === "Gracias por venir");
  check(await page.$eval("#pie", e => e.closest(".card").contains(document.getElementById("anchos"))), "el mensaje y el tamaño del papel están juntos en Ticket");
  await page.goBack();
  check(await page.isHidden("#cfgbox") && !(await page.isHidden("#balance")), "el botón atrás vuelve a la caja");
  await page.click("#cfg"); await page.click("#cfgBack");
  check(await page.isHidden("#cfgbox"), "la flecha de Ajustes vuelve a la caja");
  check(await page.isHidden("#adm"), "un negocio común no ve el botón del panel de administración");
  // El dueño de la app tiene su panel en una pantalla aparte
  await page.evaluate(() => window.__SB__.__db.platform_admins.push({ user_id: "u-ana@dietetica.com" }));
  await page.click("#cfg"); await page.click("#cbizSave");
  await page.waitForSelector("#adm:not([hidden])");
  check(!(await page.$eval("#cfgbox", e => e.contains(document.getElementById("adminBiz")))), "el panel no está dentro de Ajustes");
  await page.click("#adm");
  await page.waitForFunction(() => document.getElementById("adminBiz").textContent.includes("Dietética Ana"));
  check(await page.isHidden("#cfgbox") && !(await page.isHidden("#adminbox")) && await page.isHidden("#tabs"), "el panel se abre como pantalla aparte");
  check(true, "el administrador ve la lista de negocios");
  check((await page.textContent("#adminFiltro")).includes("En prueba (1)"), "y los filtra por estado: pagando, en prueba, vencidos, gratis");
  await page.fill("#adminNote", "Dietética Sol"); await page.click("#adminNew");
  await page.waitForFunction(() => document.getElementById("adminCodes").textContent.includes("Dietética Sol"));
  check(true, "el administrador crea un código de alta");
  await snap("7-admin");
  await page.goBack();
  check(await page.isHidden("#adminbox") && !(await page.isHidden("#tabs")), "el botón atrás cierra el panel");
  // Mi plan: prueba, suscripción y vencimiento
  await page.click("#cfg");
  check((await page.textContent("#planEstado")).includes("Prueba gratis: quedan 7 días") && (await page.textContent("#planDetalle")).includes("$15.000 el primer mes y después $18.000"), "Mi plan muestra la prueba y el precio: $15.000 el primer mes y después $18.000");
  await page.click("#planBtn");
  await page.waitForFunction(() => window.__SB__.__db.fn_calls.length === 1);
  check(await page.evaluate(() => { const c = window.__SB__.__db.fn_calls[0]; return c.name === "mp-suscribir" && c.body.action === "suscribir" && c.body.business_id === window.__SB__.__db.businesses[0].id }), "Suscribirme pide el link de pago a Mercado Pago");
  await page.click("#planMes");
  await page.waitForFunction(() => window.__SB__.__db.fn_calls.length === 2);
  check(await page.evaluate(() => window.__SB__.__db.fn_calls[1].body.action === "pagar_mes"), "Pagar un mes pide el pago común de Mercado Pago (sin tarjeta de crédito)");
  await page.evaluate(() => { window.__SB__.__db.businesses[0].trial_ends_at = new Date(Date.now() - 864e5).toISOString() });
  await page.click("#cbizSave");
  await page.waitForFunction(() => document.getElementById("planEstado").textContent === "Plan vencido");
  check(await page.isDisabled("#enviar") && await page.$eval("#bloqueo", e => !e.hidden && e.textContent.includes("vencido")), "con el plan vencido no deja anotar ventas y avisa por qué");
  await page.click("#adm");
  await page.waitForFunction(() => document.getElementById("adminFiltro").textContent.includes("Vencidos (1)"));
  await page.click("#adminBiz .linkbtn"); await page.click(".ov .chip.on");
  await page.waitForFunction(() => document.getElementById("planEstado").textContent === "Acceso sin cargo");
  check(!(await page.isDisabled("#enviar")), "el administrador puede dar acceso gratis");
  await page.waitForFunction(() => document.getElementById("adminBiz").textContent.includes("Quitar acceso gratis"));
  await page.click("#adminBiz .linkbtn"); await page.click(".ov .chip.on");
  await page.waitForFunction(() => document.getElementById("planEstado").textContent === "Plan vencido");
  await page.waitForFunction(() => document.getElementById("adminBiz").textContent.includes("Dar acceso gratis"));
  await page.click("#adminBiz .linkbtn:nth-of-type(2)"); await page.click(".ov .chip.on");
  await page.waitForFunction(() => document.getElementById("planEstado").textContent === "Mes pagado");
  check(!(await page.isDisabled("#enviar")) && (await page.textContent("#planDetalle")).includes("Podés usar la caja hasta el"), "el administrador anota un mes pagado (por transferencia) y el negocio vuelve a vender");
  await page.waitForFunction(() => document.getElementById("adminBiz").textContent.includes("Pagando (hasta"));
  check(true, "y en el panel figura como pagando");
  await page.click("#admBack");
  // Ver la app como cajero y volver
  await page.click("#cfg");
  await page.click("#vistaChips .chip:nth-child(2)");
  await page.waitForSelector("#vistaBanner:not([hidden])");
  check(await page.isHidden("#tabs") && await page.isHidden("#cfgbox") && !(await page.isHidden("#venta")), "el dueño puede ver la app como la ve un cajero");
  await page.click("#cfg");
  check(await page.$$eval("#cfgbox .card.mgr", cs => cs.every(c => c.hidden)) && !(await page.isHidden("#vistaCard")), "como cajero, Ajustes no muestra lo del dueño pero deja volver");
  await page.click("#cfgBack");
  await snap("8-vista-cajero");
  await page.click("#vistaVolver");
  await page.waitForSelector("#vistaBanner", { state: "hidden" });
  check(!(await page.isHidden("#tabs")), "y volver a verla como dueño");

  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  check(!wide, `sin scroll horizontal a ${w}px`);
  check(!errors.length, "sin errores en la consola " + errors.join(" | "));
  await page.close();
}
await browser.close(); server.close();
if (fails.length) { console.error(fails.length + " prueba(s) fallaron"); process.exit(1) }
