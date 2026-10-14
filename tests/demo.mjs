// Prueba la demo (app/?demo=...): abre sin cuenta, con datos de ejemplo, y no guarda nada en el navegador.
// Uso: node tests/demo.mjs [carpeta-de-capturas]
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

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg) };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, r => r.abort());
const snap = async n => { if (shots) await page.screenshot({ path: `${shots}/${n}.png` }) };

await page.goto(base + "?demo=kiosco");
await page.waitForSelector("#screen-app:not([hidden])");
check((await page.textContent("#bizName")) === "Kiosco La Parada", "abre directo en la caja del negocio de ejemplo, sin cuenta");
check((await page.textContent(".demo-aviso")).includes("demo con datos de ejemplo") && (await page.getAttribute(".demo-aviso a", "href")) === "./?registro", "avisa que es una demo y lleva a crear la cuenta");
check(!(await page.isHidden("#stockAviso")), "muestra el aviso de stock bajo");
await snap("demo-vender");

await page.fill("#busq", "Gaseosa"); await page.click("#res .chip");
await page.click("#enviar");
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("anotada"));
check(true, "se puede anotar una venta");
await page.click('.tab[data-t="resumen"]');
await page.waitForFunction(() => /Ventas\d+/.test(document.getElementById("cierreKpis").textContent));
const v = Number((await page.textContent("#cierreKpis")).match(/Ventas(\d+)/)[1]);
check(v >= 2 && (await page.$$("#cierreTop tr")).length === 5, "el cierre del día tiene ventas y lo más vendido");
await snap("demo-cierre");
await page.click('.tab[data-t="balance"]');
await page.waitForFunction(() => document.querySelectorAll("#mesTop tr").length === 10);
check((await page.textContent("#bgan")).includes("Ganancia"), "el balance tiene el mes completo con la ganancia");
await page.click("#cfg");
check(await page.isHidden("#planCard"), "no muestra Mi plan");
await page.click("#cfgBack");

const otra = await ctx.newPage();
await otra.goto(base);
check(await otra.evaluate(() => localStorage.length === 0), "no guarda nada en el navegador: la caja real sigue igual");
await otra.close();

for (const r of ["almacen", "dietetica", "verduleria", "carniceria"]) {
  await page.goto(base + "?demo=" + r);
  await page.waitForSelector("#screen-app:not([hidden])");
}
await page.goto(base + "?demo");
await page.waitForSelector("#screen-app:not([hidden])");
check((await page.textContent("#bizName")) === "Almacén La Esquina", "sin rubro abre el almacén, y los otros rubros también abren");
check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "sin scroll horizontal");
check(!errors.length, "sin errores en la consola " + errors.join(" | "));
await browser.close(); server.close();
if (fails.length) { console.error(fails.length + " prueba(s) fallaron"); process.exit(1) }
