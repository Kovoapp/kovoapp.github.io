// Lee planillas de productos (.xlsx de Excel o .csv) y las convierte en filas para importar.
// El .xlsx es un zip con XML adentro: se abre con lo que trae el navegador, sin librerías.

const dec = new TextDecoder();

async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf);
  let e = u8.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("no_zip");
  const n = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const files = {};
  for (let i = 0; i < n; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("no_zip");
    const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    files[dec.decode(u8.subarray(p + 46, p + 46 + nl))] = { method, size, off };
    p += 46 + nl + xl + cl;
  }
  return async name => {
    const f = files[name]; if (!f) return null;
    const start = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
    const data = u8.subarray(start, start + f.size);
    if (f.method === 0) return dec.decode(data);
    if (f.method !== 8 || typeof DecompressionStream === "undefined") throw new Error("no_zip");
    return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  };
}

const xml = t => new DOMParser().parseFromString(t, "application/xml");
const tags = (n, t) => Array.from(n.getElementsByTagNameNS("*", t));
const texto = n => tags(n, "t").map(t => t.textContent).join("");
const col = ref => { let c = 0; for (const ch of ref.replace(/\d+$/, "")) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1 };

async function leerXlsx(buf) {
  const leer = await unzip(buf);
  // Primera hoja según el libro; si no se encuentra, sheet1.
  let hoja = "xl/worksheets/sheet1.xml";
  const wb = await leer("xl/workbook.xml"), rels = await leer("xl/_rels/workbook.xml.rels");
  if (wb && rels) {
    const s = tags(xml(wb), "sheet")[0];
    const rid = s && (s.getAttribute("r:id") || Array.from(s.attributes).find(a => a.localName === "id")?.value);
    const r = rid && tags(xml(rels), "Relationship").find(x => x.getAttribute("Id") === rid);
    if (r) { const t = r.getAttribute("Target"); hoja = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "") }
  }
  const ss = await leer("xl/sharedStrings.xml");
  const strings = ss ? tags(xml(ss), "si").map(texto) : [];
  const sh = await leer(hoja);
  if (!sh) throw new Error("no_sheet");
  const filas = [];
  tags(xml(sh), "row").forEach(row => {
    const out = [];
    tags(row, "c").forEach((c, i) => {
      const ref = c.getAttribute("r"), t = c.getAttribute("t"), v = tags(c, "v")[0];
      const k = ref ? col(ref) : i;
      out[k] = t === "s" ? strings[+(v && v.textContent)] ?? ""
        : t === "inlineStr" ? texto(c)
        : t === "b" ? (v && v.textContent === "1" ? "VERDADERO" : "FALSO")
        : v ? (t === "str" || t === "e" ? v.textContent : Number(v.textContent)) : "";
    });
    for (let i = 0; i < out.length; i++) if (out[i] === undefined) out[i] = "";
    // "r" es el número de fila en Excel: las filas vacías no vienen, pero los avisos tienen que decir la fila real.
    const r = parseInt(row.getAttribute("r"), 10);
    filas[r > 0 && r <= 100000 ? r - 1 : filas.length] = out;
  });
  for (let i = 0; i < filas.length; i++) if (!filas[i]) filas[i] = [];
  return filas;
}

function leerCsv(txt) {
  txt = txt.replace(/^﻿/, "");
  const primera = txt.split(/\r?\n/)[0] || "";
  const sep = [";", "\t", ","].sort((a, b) => primera.split(b).length - primera.split(a).length)[0];
  const filas = []; let fila = [], campo = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { campo += '"'; i++ } else q = false } else campo += ch }
    else if (ch === '"') q = true;
    else if (ch === sep) { fila.push(campo); campo = "" }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; fila.push(campo); filas.push(fila); fila = []; campo = "" }
    else campo += ch;
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push(fila) }
  return filas;
}

export async function leerPlanilla(file) {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
  if (u8[0] === 0x50 && u8[1] === 0x4b) return leerXlsx(buf);
  if (/\.xls$/i.test(file.name)) throw new Error("xls_viejo");
  return leerCsv(dec.decode(buf));
}

// Números como los escribe la gente: "$ 1.500", "1.234,50", "1500.5", "12,5".
export function numero(v) {
  if (typeof v === "number") return isFinite(v) ? v : NaN;
  let s = String(v ?? "").replace(/[$\s]/g, "").replace(/^ARS/i, "");
  if (s === "") return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

const norm = s => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const CAMPOS = {
  name: ["nombre", "producto", "productos", "descripcion", "articulo", "detalle", "item"],
  price: ["precio", "precio venta", "precio de venta", "venta", "pvp", "precio final", "precio unitario", "importe"],
  cost: ["costo", "precio costo", "precio de costo", "costo unitario", "compra", "precio compra", "precio de compra"],
  code: ["codigo", "codigo de barras", "cod barras", "cod", "ean", "barcode", "sku"],
  stock: ["stock", "cantidad", "existencia", "existencias", "unidades"],
  unit: ["unidad", "se vende por", "medida"]
};

// Convierte las filas en productos. Devuelve { productos, errores } o { falta } si no hay títulos.
export function armarProductos(filas) {
  const h = filas.findIndex(f => f.some(c => CAMPOS.name.includes(norm(c))) && f.some(c => CAMPOS.price.includes(norm(c))));
  if (h < 0) return { falta: true };
  const idx = {};
  filas[h].forEach((c, i) => { const n = norm(c); for (const k in CAMPOS) if (idx[k] === undefined && CAMPOS[k].includes(n)) idx[k] = i });
  const productos = [], errores = [], vistos = new Map();
  for (let r = h + 1; r < filas.length; r++) {
    const f = filas[r], cel = k => idx[k] === undefined ? "" : f[idx[k]];
    if (f.every(c => String(c ?? "").trim() === "")) continue;
    const fila = r + 1, name = String(cel("name") ?? "").trim().replace(/\s+/g, " ");
    const price = numero(cel("price"));
    if (!name) { errores.push(`Fila ${fila}: falta el nombre`); continue }
    if (name.length > 80) { errores.push(`Fila ${fila}: el nombre es muy largo (máximo 80 letras)`); continue }
    if (!(price > 0)) { errores.push(`Fila ${fila} (${name}): falta el precio o no es un número`); continue }
    const p = { name, price: Math.round(price * 100) / 100 };
    const costTxt = cel("cost");
    if (String(costTxt ?? "").trim() !== "") {
      const c = numero(costTxt);
      if (!(c >= 0)) { errores.push(`Fila ${fila} (${name}): el costo no es un número`); continue }
      p.cost = Math.round(c * 100) / 100;
    }
    let code = cel("code");
    if (typeof code === "number") code = Number.isInteger(code) ? String(code) : String(code);
    code = String(code ?? "").trim();
    if (code) p.code = code;
    const stTxt = cel("stock");
    if (String(stTxt ?? "").trim() !== "") {
      const st = numero(stTxt);
      if (isNaN(st)) { errores.push(`Fila ${fila} (${name}): el stock no es un número`); continue }
      p.stock = Math.round(st * 1000) / 1000;
    }
    const u = norm(cel("unit"));
    if (u) p.unit = /^(kg|kilo|kilos|k|kgs|por kilo|peso)$/.test(u) ? "kg" : "u";
    const clave = code ? "c:" + code : "n:" + name.toLowerCase();
    if (vistos.has(clave)) productos[vistos.get(clave)] = p; else { vistos.set(clave, productos.length); productos.push(p) }
  }
  return { productos, errores };
}
