// Prueba la lógica de Mercado Pago con un Mercado Pago y un Supabase falsos.
// Uso: node tests/mp.test.mjs
import { crearSuscripcion, procesarAviso } from "../supabase/functions/_shared/mp.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg) };
const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x", MP_ACCESS_TOKEN: "TEST-123" };

function falso({ rol = "owner", trial = Date.now() + 5 * 864e5, pre = {}, cuota = {}, intro = false } = {}) {
  const calls = [];
  const biz = { id: "b1", name: "Dietética Ana", trial_ends_at: new Date(trial).toISOString(), mp_preapproval_id: "pre-9", mp_status: "authorized" };
  const fetch = async (url, opts = {}) => {
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ url, method: opts.method || "GET", body, headers: opts.headers });
    const ok = j => ({ ok: true, status: 200, text: async () => JSON.stringify(j) });
    if (url.endsWith("/auth/v1/user")) return opts.headers.Authorization === "Bearer buena" ? ok({ id: "u1", email: "ana@a.com" }) : { ok: false, status: 401, text: async () => "{}" };
    if (url.endsWith("/rpc/my_role")) return ok(rol);
    if (url.includes("/rest/v1/businesses?")) return ok([{ ...biz, intro_price: intro }]);
    if (url.includes("/rest/v1/platform_settings?")) return ok([{ regular_price: 18000 }]);
    if (url.endsWith("/rpc/mp_set_price")) return ok(null);
    if (url.endsWith("/rpc/subscription_price")) return ok(15000);
    if (url.endsWith("/rpc/mp_attach") || url.endsWith("/rpc/mp_apply")) return ok(true);
    if (url === "https://api.mercadopago.com/preapproval") return ok({ id: "pre-1", init_point: "https://mp/checkout/pre-1", status: "pending" });
    if (url.includes("/authorized_payments/")) return ok({ id: 77, preapproval_id: "pre-1", status: "scheduled", ...cuota });
    if (url.includes("/preapproval/") && opts.method === "PUT") return ok({ id: "pre-1", status: "authorized", ...(body.status ? { status: body.status } : {}) });
    if (url.includes("/preapproval/")) return ok({ auto_recurring: { transaction_amount: 15000 }, summarized: { charged_quantity: 0 }, id: "pre-1", status: "authorized", external_reference: "b1", next_payment_date: "2026-11-20T10:00:00.000-03:00", ...pre });
    throw new Error("no esperado " + url);
  };
  return { fetch, calls };
}
const llamado = (calls, fin) => calls.find(c => c.url.endsWith(fin));

{ // Suscribirse durante la prueba
  const f = falso();
  const out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "suscribir" } });
  check(out.status === 200 && out.body.init_point === "https://mp/checkout/pre-1", "devuelve el link de pago de Mercado Pago");
  const p = llamado(f.calls, "/preapproval").body;
  check(p.auto_recurring.transaction_amount === 15000 && p.auto_recurring.currency_id === "ARS" && p.auto_recurring.frequency_type === "months", "cobra $15000 por mes en pesos");
  check(p.external_reference === "b1" && p.payer_email === "ana@a.com" && p.status === "pending", "con el negocio y el email del dueño");
  check(p.auto_recurring.start_date && new Date(p.auto_recurring.start_date) > Date.now(), "el primer cobro es cuando termina la prueba");
  check(p.back_url.startsWith("https://") && p.back_url.includes("suscripcion=ok"), "vuelve a la caja después de pagar");
  check(llamado(f.calls, "/rpc/mp_attach").body.p_preapproval === "pre-1", "guarda la suscripción en el negocio");
  check(!llamado(f.calls, "/rpc/mp_attach").headers.Authorization, "con la clave nueva de servicio no manda Authorization");
}
{ // Con la prueba vencida cobra enseguida
  const f = falso({ trial: Date.now() - 864e5 });
  await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "suscribir", payer_email: "otro@mp.com" } });
  const p = llamado(f.calls, "/preapproval").body;
  check(!p.auto_recurring.start_date && p.payer_email === "otro@mp.com", "con la prueba vencida cobra enseguida y acepta otro email de Mercado Pago");
}
{ // Permisos
  let f = falso({ rol: "cashier" });
  let out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1" } });
  check(out.status === 403 && !llamado(f.calls, "/preapproval"), "un cajero no puede suscribir el negocio");
  f = falso();
  out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer mala", body: { business_id: "b1" } });
  check(out.status === 401, "sin sesión no hace nada");
}
{ // Cancelar
  const f = falso({ pre: { status: "cancelled" } });
  const out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "cancelar" } });
  const put = f.calls.find(c => c.method === "PUT");
  check(out.status === 200 && put && put.url.endsWith("/preapproval/pre-9") && put.body.status === "cancelled", "cancela la suscripción en Mercado Pago");
  check(llamado(f.calls, "/rpc/mp_apply").body.p_status === "cancelled", "y lo anota en el negocio");
}
{ // Revisar el estado sin esperar el aviso
  let f = falso();
  let out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "revisar" } });
  check(out.status === 200 && out.body.status === "authorized" && f.calls.some(c => c.url.endsWith("/preapproval/pre-9") && c.method === "GET"), "revisar le pregunta a Mercado Pago por la suscripción del negocio");
  check(llamado(f.calls, "/rpc/mp_apply").body.p_status === "authorized", "y anota lo que responde");
  f = falso({ pre: { external_reference: "otro" } });
  out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "revisar" } });
  check(out.status === 409 && !llamado(f.calls, "/rpc/mp_apply"), "no anota una suscripción de otro negocio");
  f = falso({ rol: "cashier" });
  out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "revisar" } });
  check(out.status === 403, "un cajero no puede revisar");
}
{ // Avisos de Mercado Pago
  let f = falso();
  let out = await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook", body: { type: "subscription_preapproval", data: { id: "pre-1" } } });
  let ap = llamado(f.calls, "/rpc/mp_apply").body;
  check(out.status === 200 && ap.p_business === "b1" && ap.p_status === "authorized" && ap.p_next.startsWith("2026-11-20"), "un aviso de suscripción activa el negocio hasta el próximo cobro");
  f = falso();
  await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook?type=subscription_authorized_payment&data.id=77", body: {} });
  check(f.calls.some(c => c.url.endsWith("/authorized_payments/77")) && llamado(f.calls, "/rpc/mp_apply"), "un aviso de cuota cobrada busca su suscripción y la actualiza");
  f = falso();
  out = await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook", body: { type: "payment", data: { id: "5" } } });
  check(out.status === 200 && !llamado(f.calls, "/rpc/mp_apply"), "ignora avisos que no son de suscripciones");
  f = falso();
  await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook", body: { type: "subscription_preapproval", data: { id: "pre-1" }, status: "authorized" } });
  check(f.calls.some(c => c.url.endsWith("/preapproval/pre-1") && c.headers.Authorization === "Bearer TEST-123"), "no confía en el aviso: vuelve a preguntarle a Mercado Pago");
}
{ // Precio de lanzamiento solo el primer mes
  let f = falso({ intro: true });
  await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook", body: { type: "subscription_preapproval", data: { id: "pre-1" } } });
  check(!f.calls.some(c => c.method === "PUT"), "antes del primer cobro mantiene los $15000");
  f = falso({ intro: true, cuota: { status: "processed" } });
  await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook?type=subscription_authorized_payment&data.id=77", body: {} });
  const put = f.calls.find(c => c.method === "PUT");
  check(put && put.url.endsWith("/preapproval/pre-1") && put.body.auto_recurring.transaction_amount === 18000, "cobrado el primer mes, la suscripción pasa a $18000");
  check(llamado(f.calls, "/rpc/mp_set_price") && llamado(f.calls, "/rpc/mp_set_price").body.p_price === 18000, "y lo anota en el negocio");
  f = falso({ intro: false, pre: { summarized: { charged_quantity: 3 } } });
  await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook", body: { type: "subscription_preapproval", data: { id: "pre-1" } } });
  check(!f.calls.some(c => c.method === "PUT"), "a quien ya paga el precio normal no le cambia nada");
}
if (fails.length) { console.error(fails.length + " prueba(s) fallaron"); process.exit(1) }
