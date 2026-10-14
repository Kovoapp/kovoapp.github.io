// Prueba costo y ganancia, aumento de precios, importar desde Excel y sugerencias.
// Uso: node tests/productos.mjs [carpeta-de-capturas]
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.addInitScript(mock);
await page.goto(base);
const db = f => page.evaluate(f);
const snap = async n => { if (shots) await page.screenshot({ path: `${shots}/${n}.png`, fullPage: true }) };
const confirmar = () => page.click(".ov .chip.on");

// Alta del negocio
await page.waitForSelector("#screen-auth:not([hidden])");
await page.click("#tabSignup");
await page.fill("#aemail", "eva@almacen.com"); await page.fill("#apass", "clave1234");
await page.click("#authBtn");
await page.waitForSelector("#screen-setup:not([hidden])");
await page.fill("#sname", "Almacén Eva"); await page.fill("#sowner", "Eva");
await page.fill("#sshops input", "Centro"); await page.fill("#scodigo", "PRUEBA01");
await page.click("#screate");
await page.waitForSelector("#screen-app:not([hidden])");

// Producto con costo
await page.click("#cfg");
await page.fill("#pn", "Yerba"); await page.fill("#pp", "3000"); await page.fill("#pco", "2000");
await page.click("#padd");
await page.waitForFunction(() => document.getElementById("plist2").textContent.includes("gana 50%"));
check(await db(() => window.__SB__.__db.product_costs.length === 1 && window.__SB__.__db.product_costs[0].cost === 2000), "guarda el costo aparte del producto");
check(true, "la lista muestra el costo y cuánto gana (50%)");

// Importar desde Excel
await page.click("#pimpBtn");
await page.setInputFiles("#pimpFile", join(root, "tests/fixtures/productos.xlsx"));
await page.waitForSelector("#pimpOk");
const res = await page.textContent("#pimpRes");
check(res.includes("Encontré 3 productos: 2 nuevos y 1 que ya tenías"), "lee el Excel (con títulos más abajo) y cuenta nuevos y existentes");
check(res.includes("Fila 7 (Pasas de uva): falta el precio"), "avisa qué filas no se importan y por qué");
await snap("importar");
await page.click("#pimpOk");
await page.waitForFunction(() => window.__SB__.__db.products.length === 3);
const prods = await db(() => window.__SB__.__db.products.map(p => ({ ...p, cost: (window.__SB__.__db.product_costs.find(c => c.product_id === p.id) || {}).cost })));
const P = n => prods.find(p => p.name === n) || {};
check(P("Yerba").price === 3200 && P("Yerba").cost === 2100 && P("Yerba").code === "7790000000017", "actualiza el producto que ya existía, con su código");
check(P("Almendras peladas").unit === "kg" && P("Almendras peladas").stock === 5 && P("Almendras peladas").cost === 8000, "crea los nuevos con unidad, stock y costo");
check(P("Maní").price === 1500, 'entiende "1.500" como mil quinientos');

// Importar desde CSV
await page.click("#pimpBtn");
await page.setInputFiles("#pimpFile", { name: "lista.csv", mimeType: "text/csv", buffer: await readFile(join(root, "tests/fixtures/productos.csv")) });
await page.waitForSelector("#pimpOk");
await page.click("#pimpOk");
await page.waitForFunction(() => window.__SB__.__db.products.length === 4);
check(await db(() => window.__SB__.__db.products.find(p => p.name === "Nueces, mariposa").price === 1234.5 && window.__SB__.__db.products.find(p => p.name === "Maní").price === 1700),
  "importa CSV con punto y coma y precios con coma");

// Aumentar precios de los filtrados
await page.fill("#pf", "Man");
await page.click("#paumBtn");
await page.fill("#aumPct", "10");
check((await page.textContent("#aumAlc")).includes('al único producto que coincide con "Man"') && (await page.textContent("#aumAlc")).includes("$1.870"), "explica a qué productos se aplica y muestra un ejemplo");
await snap("aumentar");
await page.click("#aumOk"); await confirmar();
await page.waitForFunction(() => window.__SB__.__db.products.find(p => p.name === "Maní").price === 1870);
check(await db(() => window.__SB__.__db.products.find(p => p.name === "Yerba").price === 3200), "aumenta solo los filtrados y redondea a $10");
await page.fill("#pf", "");
await page.click("#paumBtn");
await page.fill("#aumPct", "10"); await page.click("#aumOk"); await confirmar();
await page.waitForFunction(() => window.__SB__.__db.products.find(p => p.name === "Yerba").price === 3520);
check(await db(() => window.__SB__.__db.product_costs.find(c => c.cost === 2310) !== undefined), "sin filtro aumenta todos, y también el costo");
await snap("productos");

// Vender y ver la ganancia
await page.click("#cfgBack");
await page.fill("#busq", "Yerba"); await page.click("#res .chip");
await page.click("#enviar");
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("anotada"));
await page.click('.tab[data-t="balance"]');
await page.waitForFunction(() => document.getElementById("bgan").textContent.includes("Ganancia"));
const gan = await page.textContent("#bgan");
check(gan.includes("$3.520") && gan.includes("$2.310") && gan.includes("$1.210") && gan.includes("52%"), "el balance muestra la ganancia del mes: vendido, costo y ganancia");
await snap("ganancia");

// Sugerencias
await page.click("#cfg");
await page.fill("#sugTxt", "Que se pueda imprimir la lista de precios");
await page.click("#sugBtn");
await page.waitForFunction(() => document.getElementById("sugMsg").textContent.includes("Gracias"));
check(await db(() => window.__SB__.__db.suggestions[0].body === "Que se pueda imprimir la lista de precios"), "manda la sugerencia");
check(await page.isHidden("#adminCard"), "un negocio común no ve las sugerencias");
await db(() => window.__SB__.__db.platform_admins.push({ user_id: "u-eva@almacen.com" }));
await page.click("#cbizSave");
await page.waitForFunction(() => document.getElementById("adminSug").textContent.includes("imprimir la lista"));
check((await page.textContent("#adminSug")).includes("Almacén Eva · eva@almacen.com"), "el administrador ve la sugerencia con el negocio y el email");
check((await page.textContent("#adminStats")).includes("1 sugerencia sin leer"), "y cuántas no leyó");
await page.click("#adminSug .linkbtn");
await page.waitForFunction(() => window.__SB__.__db.suggestions[0].done === true);
check(true, "la marca como leída");
await snap("sugerencias");

check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "sin scroll horizontal");
check(!errors.length, "sin errores en la consola " + errors.join(" | "));
await browser.close(); server.close();
if (fails.length) { console.error(fails.length + " prueba(s) fallaron"); process.exit(1) }
