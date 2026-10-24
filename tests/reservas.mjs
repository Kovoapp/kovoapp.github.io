// Prueba los turnos online: el negocio los activa en Ajustes y el cliente saca turno desde el link, sin cuenta.
// Uso: node tests/reservas.mjs [carpeta-de-capturas]
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
// Igual que en GitHub Pages: la caja en /app/ y el sitio (con /turno/) en la raíz.
const server = createServer(async (req, res) => {
  const u = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html");
  const p = u.startsWith("/app/") ? join(root, u.slice(5)) : u.startsWith("/icons/") ? join(root, u) : join(root, "sitio", u);
  try { res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(await readFile(p)) }
  catch { res.writeHead(404); res.end() }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const mock = (await readFile(join(root, "js/memoria.js"), "utf8")) + "\nwindow.__SB__ = crearMemoria();";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg) };
const browser = await chromium.launch();
const errors = [];
const nueva = async () => { const p = await browser.newPage({ viewport: { width: 390, height: 844 } }); p.on("pageerror", e => errors.push(e.message)); await p.route(/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/, r => r.abort()); return p };

// 1. El negocio activa los turnos online en Ajustes
const page = await nueva();
await page.addInitScript(mock);
await page.goto(base + "app/");
await page.click("#tabSignup");
await page.fill("#aemail", "sol@peluqueria.com"); await page.fill("#apass", "clave1234"); await page.click("#authBtn");
await page.waitForSelector("#screen-setup:not([hidden])");
await page.fill("#sname", "Peluquería Sol"); await page.fill("#sshops input", "Centro"); await page.click("#screate");
await page.waitForSelector("#screen-app:not([hidden])");
await page.click("#cfg");
check(await page.isHidden("#resWrap"), "sin turnos, no aparece lo de turnos online");
await page.check("#cturnos");
await page.waitForSelector("#resWrap:not([hidden])");
check(await page.inputValue("#rSlug") === "peluqueria-sol", "el link se arma solo con el nombre del negocio");
check(await page.$$eval("#rSemana .chip.on", l => l.map(b => b.textContent).join(",")) === "Lun,Mar,Mié,Jue,Vie,Sáb", "arranca de lunes a sábado");
await page.check("#rOn");
await page.click('#rSemana .chip:text-is("Lun")');
await page.fill("#rDesde", "10:00"); await page.fill("#rHasta", "10:15"); await page.click("#rGuardar");
check((await page.textContent("#rMsg")).includes("Revisá el horario"), "si no entra ni un turno en el horario, avisa");
await page.fill("#rHasta", "18:00"); await page.selectOption("#rMin", "45"); await page.fill("#rLug", "2");
await page.fill("#rSlug", "Peluquería Sol Centro!"); await page.click("#rGuardar");
await page.waitForSelector("#rLink:not([hidden])");
const b = await page.evaluate(() => window.__SB__.__db.businesses[0]);
check(b.reservas && b.reservas_slug === "peluqueria-sol-centro" && JSON.stringify(b.reservas_horario) === JSON.stringify({ dias: [2, 3, 4, 5, 6], desde: "10:00", hasta: "18:00", minutos: 45, lugares: 2 }), "guarda el link limpio, los días, el horario, la duración y los lugares");
check((await page.textContent("#rUrl")).endsWith("/turno/?n=peluqueria-sol-centro") && (await page.getAttribute("#rWa", "href")).startsWith("https://wa.me/?text="), "muestra el link para copiar, abrir o mandar por WhatsApp");
await page.click("#cfgBack");

// 2. El cliente saca turno desde el link (demo de peluquería, sin cuenta)
const cli = await nueva();
await cli.goto(base + "turno/?demo=peluqueria");
await cli.waitForSelector("#rForm:not([hidden])");
check((await cli.textContent("#rNom")) === "Peluquería Estilo" && await cli.isVisible("#rDemo"), "el link muestra el nombre del negocio (y el aviso de demo)");
const serv = await cli.$$eval("#rServ .chip", l => l.map(b => b.textContent));
check(serv.some(s => s.startsWith("Corte de dama") && s.includes("$12.000")) && !serv.some(s => s.startsWith("Shampoo")), "ofrece los servicios con precio, sin los productos con stock");
check(!(await cli.$$eval("#rDias .chip", l => l.map(b => b.textContent))).some(d => /^dom/i.test(d)), "no ofrece los días que no atiende");
// Llenamos los dos lugares de las 10:00 de un día que no es hoy, para ver que ese horario no se ofrece
const dm = (await cli.$$eval("#rDias .chip", l => l[1].textContent)).match(/\d+\/\d+/)[0];
const dia = await cli.evaluate(() => { const d = [...document.querySelectorAll("#rDias .chip")][1].textContent.match(/(\d+)\/(\d+)/); const db = window.__SB__.__db; const t = new Date(); for (let i = 0; i < 70; i++, t.setDate(t.getDate() + 1)) if (t.getDate() == d[1] && t.getMonth() + 1 == d[2]) break; const s = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0"); db.turnos = db.turnos.filter(x => x.day !== s); ["Uno", "Dos"].forEach(c => db.turnos.push({ id: crypto.randomUUID(), business_id: db.businesses[0].id, day: s, hora: "10:00", minutos: 30, cliente: c, estado: "pendiente" })); return s });
await cli.click(`#rDias .chip:has-text("${dm}")`);
await cli.waitForFunction(dm => document.querySelector("#rDias .chip.on").textContent.includes(dm) && document.querySelector("#rHoras .chip"), dm);
await cli.waitForSelector("#rHoras .chip");
const horas = await cli.$$eval("#rHoras .chip", l => l.map(b => b.textContent));
check(horas[0] === "09:00" && horas.includes("09:30") && !horas.includes("10:00") && horas.includes("10:30") && horas[horas.length - 1] === "18:30", "muestra los horarios libres de 30 en 30 y saca los que están llenos");
await cli.click("#rOk");
check((await cli.textContent("#rMsg")).includes("Elegí qué te querés hacer"), "pide elegir el servicio");
await cli.click('#rServ .chip:has-text("Corte de dama")');
await cli.click('#rHoras .chip:text-is("09:30")');
check((await cli.textContent("#rResumen")).includes("a las 09:30 · Corte de dama"), "resume el turno elegido");
await cli.fill("#rCli", "Ana López"); await cli.fill("#rTel", "123"); await cli.click("#rOk");
check((await cli.textContent("#rMsg")).includes("WhatsApp"), "pide un WhatsApp de verdad");
await cli.fill("#rTel", "3329 412345");
if (shots) await cli.screenshot({ path: `${shots}/reservas-cliente.png`, fullPage: true });
await cli.click("#rOk");
await cli.waitForSelector("#rListo:not([hidden])");
check((await cli.textContent("#rListoTit")) === "¡Listo, Ana!" && (await cli.textContent("#rListoTxt")).includes("a las 09:30, para Corte de dama"), "confirma el turno con día, hora y servicio");
if (shots) await cli.screenshot({ path: `${shots}/reservas-listo.png`, fullPage: true });
const t = await cli.evaluate(d => window.__SB__.__db.turnos.find(x => x.cliente === "Ana López" && x.day === d), dia);
check(t && t.origen === "online" && t.hora === "09:30" && t.servicio === "Corte de dama" && t.precio === 12000 && t.telefono === "3329 412345", "el turno queda en la agenda del negocio como online");
await cli.click("#rOtro");
await cli.waitForSelector("#rHoras .chip");
check(await cli.isVisible("#rForm"), "se puede sacar otro turno");

// 3. En la agenda del negocio se ve marcado como online
const ag = await nueva();
await ag.goto(base + "app/?demo=peluqueria");
await ag.waitForSelector("#turnos:not([hidden]) .turno");
check((await ag.textContent("#tLista")).includes("Online"), "en la agenda, el turno sacado por el link dice Online");

// 4. Un link que no existe
const mal = await nueva();
await mal.goto(base + "turno/?demo=peluqueria&n=no-existe");
await mal.waitForSelector("#rCerrado:not([hidden])");
check(true, "un link que no existe avisa que no está disponible");

check(!(await cli.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "sin scroll horizontal");
check(!errors.length, "sin errores en la consola " + errors.join(" | "));
await browser.close(); server.close();
if (fails.length) { console.error(fails.length + " prueba(s) fallaron"); process.exit(1) }
console.log("\nTodo bien");
