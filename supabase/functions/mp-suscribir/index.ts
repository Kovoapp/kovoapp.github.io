// Crea o cancela la suscripción de un negocio en Mercado Pago. La llama la app.
import { crearSuscripcion, cors } from "../_shared/mp.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const out = await crearSuscripcion({ env: Deno.env.toObject(), fetch, authHeader: req.headers.get("Authorization"), body: await req.json() });
    return Response.json(out.body, { status: out.status, headers: cors });
  } catch (e) {
    console.error(e);
    return Response.json({ error: String(e && e.message || e) }, { status: 502, headers: cors });
  }
});
