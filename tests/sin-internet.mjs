// Prueba vender sin internet: la venta queda en el celular, se puede borrar, y se sube sola al volver la conexión.
// También que la caja abre sin internet con lo último que se cargó.
// Uso: node tests/sin-internet.mjs [carpeta-de-capturas]
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
const memoria = await readFile(join(root, "js/memoria.js"), "utf8");

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg) };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const errors = [];
async function abrir(init) {
  const page = await ctx.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, r => r.abort());
  await page.addInitScript(memoria + "\n" + init);
  return page;
}
const snap = async (page, n) => { if (shots) await page.screenshot({ path: `${shots}/${n}.png`, fullPage: true }) };
const pend = page => page.evaluate(() => JSON.parse(localStorage.getItem("ventasPendientes") || "[]"));
const ventas = page => page.evaluate(() => window.__SB__.__db.sales.length);
async function vender(page, q) {
  await page.fill("#busq", q); await page.click("#res .chip");
  await page.click("#enviar");
}

// Con internet: alta del negocio y un producto con stock.
let page = await abrir("window.__SB__ = crearMemoria({ sinRed: () => !navigator.onLine });");
await page.goto(base);
await page.waitForSelector("#screen-auth:not([hidden])");
await page.click("#tabSignup");
await page.fill("#aemail", "eva@almacen.com"); await page.fill("#apass", "clave1234");
await page.click("#authBtn");
await page.waitForSelector("#screen-setup:not([hidden])");
await page.fill("#sname", "Almacén Eva"); await page.fill("#sowner", "Eva");
await page.fill("#sshops input", "Centro"); await page.fill("#scodigo", "PRUEBA01");
await page.click("#screate");
await page.waitForSelector("#screen-app:not([hidden])");
await page.click("#cfg");
await page.fill("#pn", "Yerba"); await page.fill("#pp", "3000"); await page.fill("#ps", "10");
await page.click("#padd");
await page.waitForFunction(() => document.getElementById("plist2").textContent.includes("Yerba"));
await page.click("#cfgBack");
check(await page.isHidden("#redAviso"), "con internet no muestra ningún aviso");

// Se corta internet.
await ctx.setOffline(true);
await page.waitForSelector("#redAviso:not([hidden])");
check((await page.textContent("#redAviso")).includes("Sin internet. Podés seguir vendiendo"), "avisa que no hay internet y que se puede seguir vendiendo");
await vender(page, "Yerb");
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("guardada en el celular"));
let p = await pend(page);
check(p.length === 1 && p[0].amount === 3000 && p[0].id && p[0].created_at && (await ventas(page)) === 0, "la venta queda guardada en el celular, con su hora, sin llegar a la base");
check((await page.textContent("#redAviso")).includes("Sin subir: 1 venta."), "el aviso cuenta las ventas sin subir");
await page.fill("#busq", "Yerb");
check((await page.textContent("#res")).includes("quedan 9 u"), "descuenta el stock en el celular");
await page.fill("#busq", "");
check(await page.isVisible("#imp"), "se puede imprimir el ticket igual");
await snap(page, "sin-internet");

// Otra venta, y la borra: se saca de las pendientes.
await vender(page, "Yerb");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("ventasPendientes") || "[]").length === 2);
await page.click("#undo"); await page.click(".ov .chip.on");
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("Venta eliminada"));
p = await pend(page);
check(p.length === 1, "eliminar la última venta la saca de las pendientes, sin internet");
await page.fill("#busq", "Yerb");
check((await page.textContent("#res")).includes("quedan 9 u"), "y devuelve el stock");
await page.fill("#busq", "");

// Vuelve internet: se sube sola.
await ctx.setOffline(false);
await page.waitForFunction(() => !localStorage.getItem("ventasPendientes"));
const s = await page.evaluate(() => window.__SB__.__db.sales);
check(s.length === 1 && s[0].id === p[0].id && s[0].created_at === p[0].created_at && s[0].amount === 3000, "al volver internet la venta se sube sola, con la hora en que se hizo");
await page.waitForSelector("#redAviso", { state: "hidden" });
check(true, "y el aviso se va");

// Si se había subido justo antes de cortarse, no se duplica.
await page.evaluate(() => localStorage.setItem("ventasPendientes", JSON.stringify(window.__SB__.__db.sales)));
await page.evaluate(() => dispatchEvent(new Event("online")));
await page.waitForFunction(() => !localStorage.getItem("ventasPendientes"));
check((await ventas(page)) === 1, "una venta que ya estaba subida no se duplica");
const uid = await page.evaluate(() => JSON.parse(localStorage.getItem("cajaGuardada")).uid);
await page.close();

// Abrir la app sin internet: usa lo último que se cargó. (En el celular la página sale de la copia
// guardada por sw.js; acá se carga del servidor de prueba y se corta "internet" desde el arranque.)
page = await abrir(`window.__corte = true; Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => !window.__corte });
window.__SB__ = crearMemoria({ session: { user: { id: ${JSON.stringify(uid)}, email: "eva@almacen.com" } }, sinRed: () => !navigator.onLine });`);
const volver = () => page.evaluate(() => { window.__corte = false; dispatchEvent(new Event("online")) });
const cortar = () => page.evaluate(() => { window.__corte = true; dispatchEvent(new Event("offline")) });
await page.goto(base);
await page.waitForSelector("#screen-app:not([hidden])");
check((await page.textContent("#bizName")) === "Almacén Eva", "sin internet, la caja abre con el negocio guardado");
await vender(page, "Yerb");
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("guardada en el celular"));
check((await pend(page)).length === 1, "y se puede vender con los productos guardados");
await volver();
await page.waitForFunction(() => !localStorage.getItem("ventasPendientes"));
check((await ventas(page)) === 1, "al volver internet se sube");

// Cerrar sesión con ventas sin subir pregunta antes.
await cortar();
await vender(page, "Yerb");
await page.waitForFunction(() => JSON.parse(localStorage.getItem("ventasPendientes") || "[]").length === 1);
await page.click("#cfg"); await page.click("#cfgbox [data-logout]");
check((await page.textContent(".ov")).includes("1 venta anotadas sin internet"), "cerrar sesión con ventas sin subir avisa que se pierden");
await page.click(".ov .chip:not(.on)");
check((await pend(page)).length === 1, "y si cancela, siguen guardadas");

check(errors.length === 0, "sin errores de JavaScript" + (errors.length ? ": " + errors.join(" | ") : ""));
await browser.close(); server.close();
if (fails.length) { console.log(`\n${fails.length} prueba(s) fallaron`); process.exit(1) }
console.log("\nTodo bien");
