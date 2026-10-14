// Capturas de las guías (sitio/guias/), sacadas de la demo de la app con datos de ejemplo.
// Uso: PLAYWRIGHT_MODULE=... node tools/capturas-guias.mjs [carpeta-de-la-app] [carpeta-de-salida]
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
const root = process.argv[2] || repo, out = process.argv[3] || join(repo, "sitio/img/guias");
await mkdir(out, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  const p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  try { res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(await readFile(p)) }
  catch { res.writeHead(404); res.end() }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const ocultar = ".demo-aviso,#trialBanner,.toast,#vfwrap,#tabs{display:none!important} :focus{outline:none!important}";
async function abrir(url, init) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, r => r.abort());
  if (init) await page.addInitScript(init);
  await page.goto(base + url);
  await page.addStyleTag({ content: ocultar });
  return page;
}
// Saca la tarjeta `sel`; con `desde`/`hasta`, solo el tramo entre esos dos elementos.
const foto = async (page, sel, nombre, { desde, hasta } = {}) => {
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  const caja = page.locator(sel).first();
  if (!desde && !hasta) await caja.screenshot({ path: join(out, nombre + ".jpg"), type: "jpeg", quality: 82 });
  else {
    await caja.scrollIntoViewIfNeeded();
    const c = await caja.boundingBox(), sy = await page.evaluate(() => scrollY);
    const y0 = desde ? (await page.locator(desde).first().boundingBox()).y - 14 : c.y;
    const y1 = hasta ? (b => b.y + b.height + 16)(await page.locator(hasta).first().boundingBox()) : c.y + c.height;
    await page.screenshot({ path: join(out, nombre + ".jpg"), type: "jpeg", quality: 82, fullPage: true, clip: { x: c.x, y: y0 + sy, width: c.width, height: y1 - y0 } });
  }
  console.log("ok", nombre);
};
const tab = (page, t) => page.evaluate(t => document.querySelector(`.tab[data-t="${t}"]`).click(), t);
const ajustes = async page => { await page.click("#cfg"); await page.waitForSelector("#cfgbox:not([hidden]), #pn", { state: "visible" }) };

// 1. Crear tu negocio: una cuenta nueva, sin datos.
{
  const memoria = await readFile(join(root, "js/memoria.js"), "utf8");
  const page = await abrir("", memoria + "\nwindow.__SB__ = crearMemoria();");
  await page.waitForSelector("#screen-auth:not([hidden])");
  await page.click("#tabSignup");
  await page.fill("#aemail", "ana@almacen.com"); await page.fill("#apass", "clave1234");
  await foto(page, "#screen-auth .card", "cuenta");
  await page.click("#authBtn");
  await page.waitForSelector("#screen-setup:not([hidden])");
  await page.fill("#sname", "Almacén La Esquina"); await page.fill("#sowner", "Ana"); await page.fill("#sshops input", "Local");
  await foto(page, "#screen-setup .card", "alta");
  await page.close();
}

// El resto, con la demo del almacén.
const page = await abrir("?demo=almacen");
await page.waitForSelector("#screen-app:not([hidden])");

// 2. Cargar productos.
await ajustes(page);
await page.fill("#pn", "Salame milán"); await page.fill("#pp", "16500"); await page.fill("#pco", "11800");
await page.click('#pu .chip:has-text("Kilo")');
await page.fill("#ps", "4");
await foto(page, ".card:has(#pn)", "producto-nuevo", { hasta: "#padd" });
await page.click("#pimpBtn");
await foto(page, "#pimp", "importar");
await page.click("#pimpBtn");
await page.fill("#pf", "");
await foto(page, ".card:has(#pn)", "lista-productos", { desde: 'label[for="pf"]', hasta: "#plist2 tr:nth-child(5)" });

// 6. Aumentar precios.
await page.click("#paumBtn");
await page.fill("#aumPct", "10"); await page.dispatchEvent("#aumPct", "input");
await foto(page, "#paum", "aumentar");
await page.click("#paumBtn");

// 5. Invitar cajeros.
await page.click("#invCashier");
await page.waitForFunction(() => document.querySelector("#cinvites").textContent.trim().length > 0);
await foto(page, ".card:has(#invCashier)", "equipo");
await page.click("#cfgBack");

// 3. Vender.
await tab(page, "venta");
for (const [q, n] of [["Yerba", 1], ["Queso", 350], ["Leche", 2]]) {
  await page.fill("#busq", q); await page.click("#res .chip");
  const inp = page.locator("#cart .cq").last(); await inp.fill(String(n)); await inp.dispatchEvent("input");
}
await page.fill("#busq", "");
await foto(page, "#prodwrap", "carrito");
await page.click('#pagos .chip:has-text("Efectivo")');
await page.fill("#paga", "15000"); await page.dispatchEvent("#paga", "input");
await foto(page, "#venta .card:has(#monto)", "cobrar", { desde: 'label[for="monto"]', hasta: "#enviar" });
await page.click("#enviar");
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("anotada"));
await foto(page, "#venta .card:has(#monto)", "venta-anotada", { desde: ".cobro", hasta: "#undo" });

// 4. Caja inicial y cierre.
await tab(page, "apertura");
await page.fill("#amonto", "20000");
await foto(page, "#apertura .card:has(#amonto)", "caja-inicial");
await tab(page, "prov");
await page.click('#ptipos .chip:has-text("Retiro de caja")');
await page.fill("#pnom", "Retiro para el banco"); await page.fill("#pmonto", "15000");
await foto(page, "#prov .card:has(#pmonto)", "retiro");
await tab(page, "resumen");
await page.waitForFunction(() => document.querySelectorAll("#cierreTop tr").length > 0);
await foto(page, "#resumen .card:has(#total)", "resumen-dia");
await foto(page, "#cierreCard", "cierre");
await page.waitForSelector("#stockCard:not([hidden])");
await foto(page, "#stockCard", "stock-bajo");

// 7. Balance del mes.
await tab(page, "balance");
await page.waitForFunction(() => document.querySelectorAll("#mesTop tr").length > 0);
await foto(page, "#balance .card:has(#btabla)", "balance", { hasta: "#btabla tr:has-text('Total ingresos')" });
await foto(page, "#balance .card:has(#mesKpis)", "ventas-mes");
await foto(page, "#balance .card:has(#bgan)", "ganancia");

// 8. Fiado (la demo ya lo trae activado, con clientes que deben).
await ajustes(page);
await foto(page, "#cfgbox .card:has(#cfiado)", "fiado-ajustes");
await page.click("#cfgBack");
await tab(page, "venta");
await page.fill("#busq", "Yerba"); await page.click("#res .chip"); await page.fill("#busq", "");
await page.click('#pagos .chip:text-is("Fiado")');
await page.fill("#cbus", "Rosa (vecina)"); await page.dispatchEvent("#cbus", "input"); await page.evaluate(() => { document.getElementById("cres").hidden = true; document.getElementById("mdel").hidden = true });
await foto(page, "#venta .card:has(#monto)", "fiar", { hasta: "#enviar" });
await page.fill("#cbus", ""); await page.dispatchEvent("#cbus", "input"); await page.evaluate(() => document.getElementById("cres").hidden = true);
await foto(page, "#fiadoCard", "fiado-lista");
await page.click('#fdLista tr:has-text("Don Julio") button');
await page.fill("#fdMonto", "5000"); await page.click('#fdPagos .chip:text-is("Efectivo")');
await foto(page, "#fiadoCard", "fiado-cobrar");

await browser.close(); server.close();
