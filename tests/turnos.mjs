// Prueba los turnos: se activan en Ajustes, se anota la agenda, se cobra un turno en la caja y se marca quién no vino.
// Uso: node tests/turnos.mjs [carpeta-de-capturas]
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
const turnos = () => page.$$eval("#tLista .turno", l => l.map(t => t.textContent));

await page.goto(base);
await page.click("#tabSignup");
await page.fill("#aemail", "sol@peluqueria.com"); await page.fill("#apass", "clave1234"); await page.click("#authBtn");
await page.waitForSelector("#screen-setup:not([hidden])");
await page.fill("#sname", "Peluquería Sol"); await page.fill("#sshops input", "Centro"); await page.click("#screate");
await page.waitForSelector("#screen-app:not([hidden])");
check(await page.isHidden("#tabTurnos"), "sin activarlos, no aparece la pestaña Turnos");

// Un servicio cargado como producto, para que el turno traiga su precio
await page.click("#cfg");
await page.fill("#pn", "Corte de dama"); await page.fill("#pp", "12000"); await page.click("#padd");
await page.waitForFunction(() => document.getElementById("pm2").textContent.includes("agregado"));
await page.check("#cturnos");
await page.waitForSelector("#tabTurnos:not([hidden])", { state: "attached" });
check(true, "al activarlos en Ajustes aparece la pestaña Turnos");
await page.click("#cfgBack");
await page.click("#tabTurnos");
check(await page.isVisible("#turnos") && (await page.textContent("#tLista")).includes("No hay turnos"), "la agenda de hoy arranca vacía");

await page.click("#tNuevo");
await page.click("#tGuardar");
check((await page.textContent("#tMsg")).includes("nombre del cliente"), "sin cliente no se guarda");
await page.fill("#thora", "10:00"); await page.selectOption("#tdur", "45");
await page.fill("#tcli", "Ana"); await page.fill("#ttel", "3329 412345");
await page.fill("#tserv", "Corte de dama"); await page.dispatchEvent("#tserv", "change");
check(await page.inputValue("#tprecio") === "12000", "al elegir un servicio de Productos trae su precio");
await page.fill("#tatiende", "Lu"); await page.fill("#tnota", "Flequillo");
await page.click("#tGuardar");
await page.waitForFunction(() => document.querySelectorAll("#tLista .turno").length === 1);
let t = (await turnos())[0];
check(t.includes("10:00") && t.includes("a 10:45") && t.includes("Ana") && t.includes("Corte de dama") && t.includes("con Lu") && t.includes("$12.000") && t.includes("Flequillo"), "el turno aparece en la agenda con todos sus datos");
check(await page.isHidden("#tForm"), "y el formulario se cierra");

// Otro turno que se pisa con el de Ana, con la misma peluquera: avisa
await page.click("#tNuevo");
check(await page.inputValue("#thora") === "10:45", "un turno nuevo arranca cuando termina el anterior");
await page.fill("#thora", "10:30"); await page.fill("#tcli", "Juli"); await page.fill("#tatiende", "Lu");
await page.click("#tGuardar");
await page.waitForSelector(".ov");
check((await page.textContent(".ov")).includes("Se pisa con el turno de Ana"), "si se pisa con otro turno de la misma persona, avisa");
await page.click('.ov .chip:text-is("Cancelar")');
await page.fill("#tatiende", "Caro"); await page.click("#tGuardar");
await page.waitForFunction(() => document.querySelectorAll("#tLista .turno").length === 2);
check(true, "con otra peluquera se guarda sin aviso");
check((await page.textContent("#tRes")).includes("2 turnos") && (await page.textContent("#tRes")).includes("previsto $12.000"), "arriba dice cuántos turnos hay y cuánto se espera cobrar");

const wa = await page.evaluate(() => { let u = null; const o = window.open; window.open = x => { u = x }; [...document.querySelectorAll("#tLista .turno")][0].querySelector(".t-a .chip:nth-child(2)").click(); window.open = o; return u });
check(wa && wa.startsWith("https://wa.me/5493329412345?text=") && decodeURIComponent(wa).includes("Ana") && decodeURIComponent(wa).includes("Peluquería Sol") && decodeURIComponent(wa).includes("hoy a las 10:00"), "WhatsApp abre el recordatorio escrito al número de Ana");
check(!(await page.$$eval("#tLista .turno", l => l[1].textContent)).includes("WhatsApp"), "sin teléfono no ofrece WhatsApp");
await snap("turnos-agenda");

// Cobrar el turno de Ana: va a Vender con el servicio cargado
await page.click('#tLista .turno:nth-child(1) .chip:text-is("Cobrar")');
await page.waitForSelector("#venta:not([hidden])");
check((await page.textContent("#tCobro")).includes("Cobrando el turno de Ana") && await page.inputValue("#monto") === "12000" && (await page.textContent("#cart")).includes("Corte de dama"), "Cobrar lleva el servicio y el precio a la caja");
await snap("turnos-cobro");
await page.click("#enviar");
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("Venta anotada"));
check(await page.isHidden("#tCobro"), "al anotar la venta se suelta el turno");
await page.click("#tabTurnos");
await page.waitForFunction(() => document.querySelector("#tLista .turno").classList.contains("atendido"));
check((await turnos())[0].includes("Atendido") && !(await turnos())[0].includes("Cobrar"), "el turno de Ana queda atendido");
const venta = await page.evaluate(() => { const db = window.__SB__.__db; const t = db.turnos.find(x => x.cliente === "Ana"); return t.sale_id && db.sales.some(s => s.id === t.sale_id && s.amount === 12000) });
check(venta, "y unido a la venta de $12.000");

// Borrar esa venta lo vuelve a dejar pendiente
await page.click('.tab[data-t="venta"]');
await page.click("#undo"); await page.click('.ov .chip:text-is("Aceptar")');
await page.waitForFunction(() => document.getElementById("msg").textContent.includes("Venta eliminada"));
await page.click("#tabTurnos");
await page.waitForFunction(() => document.querySelector("#tLista .turno").classList.contains("pendiente"));
check(true, "si se elimina la venta, el turno vuelve a quedar pendiente");

// Soltar un cobro no anota nada
await page.click('#tLista .turno:nth-child(2) .chip:text-is("Cobrar")');
await page.click("#tCobroNo");
check(await page.isHidden("#tCobro") && await page.inputValue("#monto") === "", "Soltar deja la caja vacía");
await page.click("#tabTurnos");

// No vino, editar y borrar
await page.click('#tLista .turno:nth-child(2) .chip:text-is("No vino")');
await page.waitForFunction(() => document.querySelectorAll("#tLista .turno")[1].classList.contains("no_vino"));
check((await page.textContent("#tRes")).includes("1 turno"), "el que no vino no cuenta en el día");
await page.click('#tLista .turno:nth-child(2) [aria-label="Editar turno de Juli"]');
check(await page.isVisible("#testWrap") && await page.inputValue("#tcli") === "Juli", "Editar abre el turno con sus datos y su estado");
await page.click('#testado .chip:text-is("Pendiente")'); await page.fill("#thora", "12:00"); await page.click("#tGuardar");
await page.waitForFunction(() => [...document.querySelectorAll("#tLista .turno")].some(t => t.textContent.includes("12:00") && t.classList.contains("pendiente")));
check(true, "se cambia la hora y vuelve a pendiente");
await page.click('#tLista .turno:nth-child(2) [aria-label="Borrar turno"]'); await page.click('.ov .chip:text-is("Aceptar")');
await page.waitForFunction(() => document.querySelectorAll("#tLista .turno").length === 1);
check(true, "un turno cancelado se borra");

// Otros días
await page.click("#tNext");
check((await page.textContent("#tLista")).includes("No hay turnos") && !(await page.textContent("#tRes")).includes("(hoy)"), "Día siguiente muestra la agenda de mañana");
await page.click("#tNuevo"); await page.fill("#tcli", "Ana"); await page.dispatchEvent("#tcli", "change");
check(await page.inputValue("#ttel") === "3329 412345", "un cliente conocido trae su teléfono");
await page.click("#tGuardar");
await page.waitForFunction(() => document.querySelectorAll("#tLista .turno").length === 1);
const wa2 = await page.evaluate(() => { let u = null; const o = window.open; window.open = x => { u = x }; document.querySelector('#tLista .t-a .chip:nth-child(2)').click(); window.open = o; return u });
check(decodeURIComponent(wa2).includes("mañana a las"), "el recordatorio de un turno de mañana dice mañana");
await page.click("#tPrev");
check((await turnos()).length === 1 && (await page.textContent("#tRes")).includes("(hoy)"), "Día anterior vuelve a hoy");

// Al desactivarlos, desaparece la pestaña y vuelve a Vender
await page.click("#cfg"); await page.uncheck("#cturnos");
await page.waitForSelector("#tabTurnos[hidden]", { state: "attached" });
await page.click("#cfgBack");
check(await page.isVisible("#venta") && await page.isHidden("#turnos"), "al desactivarlos se va la pestaña y queda Vender");

const demo = await browser.newPage({ viewport: { width: 390, height: 844 } });
await demo.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, r => r.abort());
await demo.goto(base + "?demo=peluqueria");
await demo.waitForSelector("#turnos:not([hidden]) .turno");
check((await demo.$$("#tLista .turno")).length >= 6 && await demo.isHidden("#fiadoCard"), "la demo de peluquería abre en la agenda de hoy");
check(!(await demo.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "la agenda no tiene scroll horizontal");
if (shots) await demo.screenshot({ path: `${shots}/turnos-demo.png`, fullPage: true });

check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "sin scroll horizontal");
check(!errors.length, "sin errores en la consola " + errors.join(" | "));
await browser.close(); server.close();
if (fails.length) { console.error(fails.length + " prueba(s) fallaron"); process.exit(1) }
console.log("\nTodo bien");
