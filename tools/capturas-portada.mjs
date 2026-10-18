// Capturas de la página principal y de las páginas por rubro (sitio/img/), sacadas de la demo.
// Uso: PLAYWRIGHT_MODULE=... node tools/capturas-portada.mjs [rubro]   (con un rubro, saca solo esa captura)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const solo = process.argv[2];
const root = join(dirname(fileURLToPath(import.meta.url)), ".."), out = join(root, "sitio/img");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  const p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  try { res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(await readFile(p)) }
  catch { res.writeHead(404); res.end() }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 });
await page.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, r => r.abort());
await page.goto(base + "?demo=almacen");
await page.waitForSelector("#screen-app:not([hidden])");
await page.addStyleTag({ content: ".demo-aviso,.toast,#stockAviso,#vfwrap{display:none!important} :focus{outline:none!important}" });
const foto = async (nombre, y = 0) => {
  await page.evaluate(y => { document.activeElement && document.activeElement.blur(); scrollTo(0, y) }, y);
  await page.screenshot({ path: join(out, nombre + ".jpg"), type: "jpeg", quality: 82 });
  console.log("ok", nombre);
};
const tab = t => page.evaluate(t => document.querySelector(`.tab[data-t="${t}"]`).click(), t);

if (!solo) {
// Vender: el carrito arriba, y el cobro con el vuelto más abajo.
for (const [q, n] of [["Yerba", 1], ["Queso", 350], ["Leche", 2]]) {
  await page.fill("#busq", q); await page.click("#res .chip");
  const inp = page.locator("#cart .cq").last(); await inp.fill(String(n)); await inp.dispatchEvent("input");
}
await page.fill("#busq", "");
await page.fill("#paga", "15000"); await page.dispatchEvent("#paga", "input");
await foto("vender");
await foto("cobrar", await page.evaluate(() => document.getElementById("monto").getBoundingClientRect().top + scrollY - 260));

await tab("resumen");
await page.waitForFunction(() => document.querySelectorAll("#cierreTop tr").length > 0);
await foto("resumen");
await tab("balance");
await page.waitForFunction(() => document.querySelectorAll("#mesTop tr").length > 0);
await foto("balance");

// Sección "Probalo ahora": el cierre de caja del resumen.
await tab("resumen");
await foto("demo", await page.evaluate(() => document.getElementById("cierreTop").closest(".card").getBoundingClientRect().top + scrollY - 16));

}

// Una captura de Vender por rubro, con una venta típica en el carrito. La peluquería muestra la agenda del día.
const RUBROS = {
  almacen: [["Yerba", 1], ["Queso", 350], ["Leche", 2]],
  kiosco: [["Alfajor", 2], ["Gaseosa", 1], ["Chicles", 1]],
  dietetica: [["Almendras", 250], ["Avena", 500], ["Pasas", 200]],
  verduleria: [["Papa", 2000], ["Tomate", 1000], ["Lechuga", 1]],
  carniceria: [["Asado", 1500], ["Vacío", 1200], ["Milanesa", 800]],
  peluqueria: [],
};
for (const [slug, items] of Object.entries(RUBROS)) {
  if (solo && slug !== solo) continue;
  await page.goto(base + "?demo=" + slug);
  await page.waitForSelector("#screen-app:not([hidden])");
  if (slug === "peluqueria") await page.waitForSelector("#tLista .turno");
  await page.addStyleTag({ content: ".demo-aviso,.toast,#stockAviso,#vfwrap{display:none!important} :focus{outline:none!important}" });
  for (const [q, n] of items) {
    await page.fill("#busq", q); await page.click("#res .chip");
    const inp = page.locator("#cart .cq").last(); await inp.fill(String(n)); await inp.dispatchEvent("input");
  }
  if (items.length) await page.fill("#busq", "");
  await foto("rubro-" + slug);
}
await browser.close(); server.close();
