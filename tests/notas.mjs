// Prueba el anotador: se activa en Ajustes, se anota, se tacha, se borra y en pantallas anchas va al costado de la caja.
// Uso: node tests/notas.mjs [carpeta-de-capturas]
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
const items = () => page.$$eval("#nLista .n-item", l => l.map(x => (x.classList.contains("hecha") ? "✓ " : "") + x.textContent.trim()));

await page.goto(base);
await page.click("#tabSignup");
await page.fill("#aemail", "kiko@kiosco.com"); await page.fill("#apass", "clave1234"); await page.click("#authBtn");
await page.waitForSelector("#screen-setup:not([hidden])");
await page.fill("#sname", "Kiosco Kiko"); await page.fill("#sshops input", "Centro"); await page.click("#screate");
await page.waitForSelector("#screen-app:not([hidden])");
check(await page.isHidden("#notasCard"), "sin activarlo, el anotador no aparece");

await page.click("#cfg"); await page.check("#cnotas");
await page.waitForSelector("#notasCard:not([hidden])", { state: "attached" });
await page.click("#cfgBack");
check(await page.isVisible("#notasCard") && (await page.textContent("#nLista")).includes("No hay nada"), "al activarlo en Ajustes aparece en Vender, vacío");

await page.fill("#nNueva", "Pedir yerba"); await page.click("#nAdd");
await page.fill("#nNueva", "Llamar al de las gaseosas"); await page.press("#nNueva", "Enter");
await page.waitForFunction(() => document.querySelectorAll("#nLista .n-item").length === 2);
check(JSON.stringify(await items()) === JSON.stringify(["Pedir yerba", "Llamar al de las gaseosas"]) && await page.inputValue("#nNueva") === "", "se anota con el botón o con Enter");
await page.click("#nAdd");
check((await items()).length === 2, "vacío no anota nada");

await page.check('[aria-label="Hecho: Pedir yerba"]');
await page.waitForFunction(() => document.querySelector("#nLista .n-item:last-child").classList.contains("hecha"));
check(JSON.stringify(await items()) === JSON.stringify(["Llamar al de las gaseosas", "✓ Pedir yerba"]), "lo hecho se tacha y baja al final");
check(await page.evaluate(() => window.__SB__.__db.notas.find(n => n.texto === "Pedir yerba").hecha), "y queda guardado");
await snap("notas-celu");

await page.click("#nLimpiar"); await page.click('.ov .chip:text-is("Aceptar")');
await page.waitForFunction(() => document.querySelectorAll("#nLista .n-item").length === 1);
check(await page.isHidden("#nLimpiar"), "Borrar las hechas deja solo lo pendiente");
await page.click('#nLista [aria-label="Borrar"]');
await page.waitForFunction(() => document.getElementById("nLista").textContent.includes("No hay nada"));
check(true, "se borra una cosa suelta");

// En una pantalla ancha queda al costado de la caja, sin taparla
await page.fill("#nNueva", "Avisarle a Juan"); await page.click("#nAdd");
await page.setViewportSize({ width: 1366, height: 800 });
const lado = await page.evaluate(() => { const n = document.getElementById("notasCard").getBoundingClientRect(), c = document.getElementById("enviar").closest(".card").getBoundingClientRect(); return n.left >= c.right && n.top < 200 && n.right <= innerWidth });
check(lado, "en la compu va al costado de la caja");
await snap("notas-compu");
await page.setViewportSize({ width: 390, height: 844 });

await page.click("#cfg"); await page.uncheck("#cnotas");
await page.waitForSelector("#notasCard[hidden]", { state: "attached" });
await page.click("#cfgBack");
check(await page.isHidden("#notasCard"), "al desactivarlo desaparece");

check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "sin scroll horizontal");
check(!errors.length, "sin errores en la consola " + errors.join(" | "));
await browser.close(); server.close();
if (fails.length) { console.error(fails.length + " prueba(s) fallaron"); process.exit(1) }
console.log("\nTodo bien");
