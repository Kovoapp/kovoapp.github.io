// Lógica de las funciones de Mercado Pago. Está en JavaScript común (sin nada de Deno)
// para poder probarla con Node: tests/mp.test.mjs.
const MP = "https://api.mercadopago.com";
export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SITIO = "https://vicentesampol39-ux.github.io/caja-dieteticas/";

function clientes(env, fetchFn) {
  const leer = async r => { const t = await r.text(); try { return t ? JSON.parse(t) : null } catch { return t } };
  const mp = async (path, opts = {}) => {
    const r = await fetchFn(MP + path, {
      method: opts.method || "GET",
      headers: { Authorization: "Bearer " + env.MP_ACCESS_TOKEN, "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    const j = await leer(r);
    if (!r.ok) throw new Error(`mercadopago ${r.status}: ${(j && (j.message || j.error)) || ""}`);
    return j;
  };
  // Supabase con la clave de servicio (o con la sesión del usuario si se pasa "auth").
  const db = async (path, opts = {}) => {
    const key = opts.auth ? env.SUPABASE_ANON_KEY : env.SUPABASE_SERVICE_ROLE_KEY;
    const headers = { apikey: key, "Content-Type": "application/json" };
    if (opts.auth) headers.Authorization = opts.auth;
    else if (/^eyJ/.test(key)) headers.Authorization = "Bearer " + key; // las claves viejas son JWT
    const r = await fetchFn(env.SUPABASE_URL + path, { method: opts.method || "GET", headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const j = await leer(r);
    if (!r.ok) throw new Error(`supabase ${r.status}: ${(j && (j.message || j.msg)) || ""}`);
    return j;
  };
  return { mp, db };
}

const res = (status, body) => ({ status, body });

// La llama la app (Ajustes → Mi plan). body: { business_id, action: "suscribir" | "cancelar", payer_email? }
export async function crearSuscripcion({ env, fetch: fetchFn, authHeader, body }) {
  const { mp, db } = clientes(env, fetchFn);
  if (!env.MP_ACCESS_TOKEN) return res(500, { error: "falta_mp_access_token" });
  if (!authHeader) return res(401, { error: "sin_sesion" });
  const b = body && body.business_id;
  if (!b) return res(400, { error: "falta_negocio" });

  let user;
  try { user = await db("/auth/v1/user", { auth: authHeader }) } catch { return res(401, { error: "sin_sesion" }) }
  const rol = await db("/rest/v1/rpc/my_role", { method: "POST", auth: authHeader, body: { b } });
  if (rol !== "owner") return res(403, { error: "solo_el_duenio" });

  const [biz] = await db(`/rest/v1/businesses?id=eq.${encodeURIComponent(b)}&select=id,name,trial_ends_at,mp_preapproval_id,mp_status`);
  if (!biz) return res(404, { error: "no_existe" });

  if (body.action === "cancelar") {
    if (!biz.mp_preapproval_id) return res(400, { error: "sin_suscripcion" });
    const pre = await mp(`/preapproval/${encodeURIComponent(biz.mp_preapproval_id)}`, { method: "PUT", body: { status: "cancelled" } });
    await db("/rest/v1/rpc/mp_apply", { method: "POST", body: { p_business: b, p_preapproval: biz.mp_preapproval_id, p_status: pre.status || "cancelled", p_next: null } });
    return res(200, { ok: true });
  }

  const price = Number(await db("/rest/v1/rpc/subscription_price", { method: "POST", body: { b } }));
  const auto = { frequency: 1, frequency_type: "months", transaction_amount: price, currency_id: "ARS" };
  // Durante la prueba gratis, el primer cobro se hace cuando termina la prueba.
  if (biz.trial_ends_at && new Date(biz.trial_ends_at) - Date.now() > 10 * 60e3) auto.start_date = new Date(biz.trial_ends_at).toISOString();
  const pre = await mp("/preapproval", {
    method: "POST",
    body: {
      reason: `Caja Dietéticas · ${biz.name}`.slice(0, 120),
      external_reference: b,
      payer_email: (body.payer_email || user.email || "").trim(),
      auto_recurring: auto,
      back_url: (env.SITE_URL || SITIO) + "?suscripcion=ok",
      status: "pending",
    },
  });
  await db("/rest/v1/rpc/mp_attach", { method: "POST", body: { p_business: b, p_preapproval: pre.id, p_price: price } });
  return res(200, { init_point: pre.init_point, price });
}

// La llama Mercado Pago cada vez que cambia una suscripción o se cobra una cuota.
// No se confía en lo que dice el aviso: se vuelve a consultar a Mercado Pago con nuestra clave.
export async function procesarAviso({ env, fetch: fetchFn, url, body }) {
  const { mp, db } = clientes(env, fetchFn);
  const q = new URL(url).searchParams;
  const tipo = String((body && (body.type || body.topic)) || q.get("type") || q.get("topic") || "");
  const id = String((body && body.data && body.data.id) || q.get("data.id") || q.get("id") || "");
  if (!id) return res(200, { ignorado: "sin_id" });

  let preId;
  if (/authorized_payment/.test(tipo)) preId = (await mp(`/authorized_payments/${encodeURIComponent(id)}`)).preapproval_id;
  else if (/preapproval/.test(tipo) && !/plan/.test(tipo)) preId = id;
  else return res(200, { ignorado: tipo });
  if (!preId) return res(200, { ignorado: "sin_suscripcion" });

  const pre = await mp(`/preapproval/${encodeURIComponent(preId)}`);
  if (!pre.external_reference) return res(200, { ignorado: "sin_negocio" });
  const ok = await db("/rest/v1/rpc/mp_apply", {
    method: "POST",
    body: { p_business: pre.external_reference, p_preapproval: pre.id, p_status: pre.status, p_next: pre.next_payment_date || null },
  });
  return res(200, { ok, status: pre.status });
}
