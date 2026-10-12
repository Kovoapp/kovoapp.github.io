// Prueba el escáner con una cámara simulada que muestra un código EAN-13.
// Uso: node tests/scanner.mjs
import { createServer } from "node:http";
import { readFile, writeFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// --- Video .y4m con un EAN-13 dibujado ---
function ean13(digits12) {
  const d = digits12.split("").map(Number);
  const check = (10 - d.reduce((a, x, i) => a + x * (i % 2 ? 3 : 1), 0) % 10) % 10;
  const code = digits12 + check;
  const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
  const G = L.map(p => p.split("").map(b => b === "1" ? "0" : "1").reverse().join(""));
  const R = L.map(p => p.split("").map(b => b === "1" ? "0" : "1").join(""));
  const parity = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"][+code[0]];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === "L" ? L : G)[+code[i]];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[+code[i]];
  bits += "101";
  return { code, bits };
}
async function makeVideo(bits) {
  const W = 640, H = 480, mod = 4, x0 = Math.floor((W - bits.length * mod) / 2);
  const y = Buffer.alloc(W * H, 235);
  for (let r = 140; r < 340; r++) for (let i = 0; i < bits.length; i++) if (bits[i] === "1") y.fill(16, r * W + x0 + i * mod, r * W + x0 + (i + 1) * mod);
  const uv = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, uv]);
  const file = join(await mkdtemp(join(tmpdir(), "scan-")), "barcode.y4m");
  await writeFile(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), ...Array(10).fill(frame)]));
  return file;
}

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".wasm": "application/wasm", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  const p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  try { res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" }); res.end(await readFile(p)) }
  catch { res.writeHead(404); res.end() }
}).listen(0);
const base = `http://localhost:${server.address().port}/`;
const mock = await readFile(join(root, "tests/mock-supabase.js"), "utf8");

const { code, bits } = ean13("779123456789");
const video = await makeVideo(bits);
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${video}`] });
const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg) };

async function openApp() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera"] });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(mock);
  await page.goto(base);
  await page.click("#tabSignup");
  await page.fill("#aemail", "ana@dietetica.com"); await page.fill("#apass", "clave1234"); await page.click("#authBtn");
  await page.waitForSelector("#screen-setup:not([hidden])");
  await page.fill("#sname", "Dietética Ana"); await page.fill("#sshops input", "Centro"); await page.click("#screate");
  await page.waitForSelector("#screen-app:not([hidden])");
  return { page, ctx, errors };
}

{ // Código cargado en Ajustes: la cámara lo encuentra y va al carrito
  const { page, ctx } = await openApp();
  await page.click("#cfg");
  await page.fill("#pn", "Almendras 500 g"); await page.fill("#pp", "9000"); await page.fill("#pc", code); await page.click("#padd");
  await page.waitForFunction(() => document.getElementById("plist2").textContent.includes("Almendras"));
  await page.click("#cfg");
  check(!(await page.isHidden("#bcam")), "muestra el botón de la cámara aunque el navegador no traiga lector");
  await page.click("#bcam");
  await page.waitForSelector(".scan");
  await page.waitForFunction(() => document.getElementById("cart").textContent.includes("Almendras"), null, { timeout: 20000 });
  check(!(await page.$(".scan")), "lee el código con la cámara y cierra el escáner");
  check((await page.inputValue("#monto")) === "9000", "suma el precio al total");
  await ctx.close();
}
{ // Código desconocido: el dueño lo da de alta y queda en el carrito
  const { page, ctx, errors } = await openApp();
  await page.click("#bcam");
  await page.waitForSelector(".ov input", { timeout: 20000 });
  check((await page.textContent(".ov")).includes(code), "avisa que el código " + code + " no está cargado");
  await page.fill(".ov input", "Nueces 250 g"); await page.click(".ov .chip.on");
  await page.waitForSelector(".ov input"); await page.fill(".ov input", "4500"); await page.click(".ov .chip.on");
  await page.waitForFunction(() => document.getElementById("cart").textContent.includes("Nueces"));
  check((await page.inputValue("#monto")) === "4500", "lo agrega al carrito con su precio");
  const saved = await page.evaluate(c => window.__SB__.__db.products.some(p => p.code === c), code);
  check(saved, "guarda el producto con su código para la próxima");
  // Lector de mano: tipea rápido y Enter, sin campo enfocado
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.type(code, { delay: 5 }); await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelectorAll("#cart .cl").length === 2);
  check(true, "el lector de mano agrega el producto sin tocar el buscador");
  check(!errors.length, "sin errores en la consola " + errors.join(" | "));
  await ctx.close();
}
await browser.close(); server.close();
if (fails.length) { console.error(fails.length + " prueba(s) fallaron"); process.exit(1) }
