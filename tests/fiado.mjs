// Prueba el fiado: se activa en Ajustes, se fía con el nombre del cliente, se cobra y aparece en el resumen.
// Uso: node tests/fiado.mjs [carpeta-de-capturas]
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
const mock = (await readFile(join(root, "js/memoria.js"), "utf8")) + "\nwindow.__SB__ = crearMemoria();";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg) };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, r => r.abort());
await page.addInitScript(mock);
const snap = async n => { if (shots) await page.screenshot({ path: `${shots}/${n}.png`, fullPage: true }) };
const chipsPago = () => page.$$eval("#pagos .chip", l => l.map(b => b.textContent));
const pagar = t => page.click(`#pagos .chip:text-is("${t}")`);

await page.goto(base);
await page.click("#tabSignup");
await page.fill("#aemail", "rosa@almacen.com"); await page.fill("#apass", "clave1234"); await page.click("#authBtn");
await page.waitForSelector("#screen-setup:not([hidden])");
await page.fill("#sname", "Almacén Rosa"); await page.fill("#sshops input", "Centro"); await page.click("#screate");
await page.waitForSelector("#screen-app:not([hidden])");
check(!(await chipsPago()).includes("Fiado") && await page.isHidden("#fiadoCard"), "sin activarlo, el fiado no aparece por ningún lado");

await page.click("#cfg");
await page.check("#cfiado");
await page.waitForFunction(() => [...document.querySelectorAll("#pagos .chip")].some(b => b.textContent === "Fiado"));
check(true, "al activarlo en Ajustes, Fiado aparece como medio de pago");
await page.click("#cfgBack");
check(await page.isVisible("#fiadoCard") && (await page.textContent("#fdLista")).includes("Nadie te debe"), "y aparece la tarjeta de fiado, vacía");

await pagar("Fiado");
check(await page.isVisible("#cliwrap"), "al elegir Fiado pide el cliente");
await page.fill("#monto", "5000"); await page.click("#enviar");
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("a quién"));
check(true, "sin cliente no deja fiar");
await page.fill("#cbus", "Rosa"); await page.click("#enviar");
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("Fiado anotado a Rosa"));
check((await page.textContent("#fdTotal")) === "$5.000" && (await page.textContent("#fdLista")).includes("Rosa"), "la venta fiada suma a la cuenta de Rosa");
await pagar("Fiado"); await page.fill("#cbus", "Rosa");
check(await page.isVisible("#cdeuda") && (await page.textContent("#cdeuda")).includes("$5.000"), "al volver a fiarle, muestra cuánto debe");
await page.fill("#monto", "1500"); await page.click("#enviar");
await page.waitForFunction(() => document.getElementById("fdTotal").textContent === "$6.500");
check(true, "un segundo fiado se suma");
await snap("fiado-vender");

await page.click('#fdLista button:text-is("Cobrar")');
check(await page.inputValue("#fdMonto") === "6500", "Cobrar propone el total que debe");
await page.fill("#fdMonto", "2000"); await page.click('#fdPagos .chip:text-is("Efectivo")'); await page.click("#fdOk");
await page.waitForFunction(() => document.getElementById("fdTotal").textContent === "$4.500");
check((await page.textContent("#fdMsg")).includes("Pago de Rosa anotado"), "anota un pago parcial y baja la deuda");
check((await page.textContent("#fdMov")).includes("pagó (Efectivo)"), "el pago queda en los movimientos");

await page.evaluate(() => document.querySelector('.tab[data-t="resumen"]').click());
await page.waitForFunction(() => document.getElementById("porGrupo").textContent.includes("Cobros de fiado"));
const res = await page.textContent("#porGrupo");
check(res.includes("Fiado (2)") && res.includes("$6.500"), "en el resumen las ventas fiadas salen como un medio de pago más");
check(res.includes("Cobros de fiado (1)") && res.includes("Efectivo en caja$2.000"), "los cobros en efectivo suman al efectivo en caja");
await snap("fiado-resumen");

await page.evaluate(() => document.querySelector('.tab[data-t="venta"]').click());
await page.click("#cfg"); await page.uncheck("#cfiado");
await page.waitForFunction(() => ![...document.querySelectorAll("#pagos .chip")].some(b => b.textContent === "Fiado"));
await page.click("#cfgBack");
check(await page.isVisible("#fiadoCard"), "al desactivarlo deja de ofrecerse, pero lo que se debe sigue a la vista");

const demo = await browser.newPage({ viewport: { width: 390, height: 844 } });
await demo.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, r => r.abort());
await demo.goto(base + "?demo=almacen");
await demo.waitForSelector("#screen-app:not([hidden])");
check((await demo.textContent("#fdLista")).includes("Don Julio") && (await demo.$$eval("#pagos .chip", l => l.map(b => b.textContent))).includes("Fiado"), "la demo trae el fiado activado con clientes de ejemplo");
if (shots) await demo.screenshot({ path: `${shots}/fiado-demo.png`, fullPage: true });

check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "sin scroll horizontal");
check(!errors.length, "sin errores en la consola " + errors.join(" | "));
await browser.close(); server.close();
if (fails.length) { console.error(fails.length + " prueba(s) fallaron"); process.exit(1) }
console.log("\nTodo bien");
