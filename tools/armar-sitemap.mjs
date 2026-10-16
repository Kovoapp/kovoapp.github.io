// Arma sitio/sitemap.xml y sitio/robots.txt con todas las páginas de sitio/ (menos la app).
// Uso: node tools/armar-sitemap.mjs   (después de armar-rubros.mjs o armar-guias.mjs)
import { readdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SITIO = join(dirname(fileURLToPath(import.meta.url)), "..", "sitio");
const URL = "https://appkovo.com/";
const paginas = (await readdir(SITIO, { recursive: true }))
  .filter(f => f.endsWith("index.html")).map(f => f.replace(/\\/g, "/").replace(/index\.html$/, ""))
  .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
const hoy = new Date().toISOString().slice(0, 10);
await writeFile(join(SITIO, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paginas.map(p => `  <url><loc>${URL}${p}</loc><lastmod>${hoy}</lastmod></url>`).join("\n")}
</urlset>
`);
await writeFile(join(SITIO, "robots.txt"), `User-agent: *\nDisallow: /app/\nSitemap: ${URL}sitemap.xml\n`);
console.log(paginas.length + " páginas en el sitemap");
