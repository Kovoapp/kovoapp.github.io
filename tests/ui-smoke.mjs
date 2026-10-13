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
  check(await page.isHidden("#adminCard"), "un negocio común no ve la administración de la app");
  // El dueño de la app ve la administración y crea códigos de alta
  await page.evaluate(() => window.__SB__.__db.platform_admins.push({ user_id: "u-ana@dietetica.com" }));
  await page.click("#cfg"); await page.click("#cbizSave");
  await page.waitForSelector("#adminCard:not([hidden])");
  check((await page.textContent("#adminBiz")).includes("Dietética Ana"), "el administrador ve la lista de negocios");
  await page.fill("#adminNote", "Dietética Sol"); await page.click("#adminNew");
  await page.waitForFunction(() => document.getElementById("adminCodes").textContent.includes("Dietética Sol"));
  check(true, "el administrador crea un código de alta");
  await snap("7-admin");
  await page.click("#cfgBack");

  const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  check(!wide, `sin scroll horizontal a ${w}px`);
  check(!errors.length, "sin errores en la consola " + errors.join(" | "));
  await page.close();
}
await browser.close(); server.close();
if (fails.length) { console.error(fails.length + " prueba(s) fallaron"); process.exit(1) }
