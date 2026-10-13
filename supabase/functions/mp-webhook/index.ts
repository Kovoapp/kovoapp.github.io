// Recibe los avisos de Mercado Pago (suscripción creada, pagada, pausada, cancelada).
// Se publica sin verificación de JWT porque la llama Mercado Pago, no un usuario.
import { procesarAviso } from "../_shared/mp.js";

Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const out = await procesarAviso({ env: Deno.env.toObject(), fetch, url: req.url, body });
    console.log(JSON.stringify(out.body));
    return Response.json(out.body, { status: out.status });
  } catch (e) {
    // Un error hace que Mercado Pago vuelva a intentar más tarde.
    console.error(e);
    return Response.json({ error: String(e && e.message || e) }, { status: 500 });
  }
});
