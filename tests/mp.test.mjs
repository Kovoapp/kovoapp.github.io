// Prueba la lógica de Mercado Pago con un Mercado Pago y un Supabase falsos.
// Uso: node tests/mp.test.mjs
import { crearSuscripcion, procesarAviso } from "../supabase/functions/_shared/mp.js";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg) };
const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_x", MP_ACCESS_TOKEN: "TEST-123" };

const B = "11111111-2222-3333-4444-555555555555";
function falso({ rol = "owner", trial = Date.now() + 5 * 864e5, pre = {}, cuota = {}, intro = false, preId = "pre-9", pago = {} } = {}) {
  const calls = [];
  const biz = { id: "b1", name: "Dietética Ana", trial_ends_at: new Date(trial).toISOString(), mp_preapproval_id: preId, mp_status: "authorized" };
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
    if (url.endsWith("/rpc/mp_attach") || url.endsWith("/rpc/mp_apply") || url.endsWith("/rpc/mp_pay_month")) return ok(true);
    if (url === "https://api.mercadopago.com/checkout/preferences") return ok({ id: "pref-1", init_point: "https://mp/checkout/pref-1" });
    if (url.includes("/v1/payments/")) return ok({ id: 5, status: "approved", external_reference: "otra-cosa", transaction_amount: 15000, ...pago });
    if (url === "https://api.mercadopago.com/preapproval") return ok({ id: "pre-1", init_point: "https://mp/checkout/pre-1", status: "pending" });
    if (url.endsWith("/ajena")) return { ok: false, status: 401, text: async () => JSON.stringify({ message: "unauthorized" }) };
    if (url.endsWith("/123456")) return { ok: false, status: 404, text: async () => JSON.stringify({ message: "not found" }) };
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
{ // Pagar un mes, sin suscripción
  let f = falso();
  let out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "pagar_mes" } });
  const p = llamado(f.calls, "/checkout/preferences");
  check(out.status === 200 && out.body.init_point === "https://mp/checkout/pref-1" && !llamado(f.calls, "/preapproval"), "pagar un mes abre el pago común de Mercado Pago, no una suscripción");
  check(p.body.items[0].unit_price === 15000 && p.body.items[0].currency_id === "ARS" && p.body.external_reference === "mes:b1", "por el precio del mes, con el negocio");
  check(p.body.notification_url === "https://x.supabase.co/functions/v1/mp-webhook" && p.body.back_urls.success.includes("pago=ok"), "avisa a Kovo cuando se paga y vuelve a la caja");
  f = falso({ rol: "cashier" });
  out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "pagar_mes" } });
  check(out.status === 403 && !llamado(f.calls, "/checkout/preferences"), "un cajero no puede pagar");
  f = falso({ pago: { external_reference: "mes:" + B } });
  out = await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook?data.id=5&type=payment", body: { type: "payment", data: { id: "5" } } });
  const pm = llamado(f.calls, "/rpc/mp_pay_month");
  check(out.status === 200 && pm && pm.body.p_business === B && pm.body.p_payment === "5" && pm.body.p_amount === 15000, "un pago aprobado le suma el mes al negocio");
  check(f.calls.some(c => c.url.endsWith("/v1/payments/5") && c.headers.Authorization === "Bearer TEST-123"), "no confía en el aviso: le pregunta el pago a Mercado Pago");
  f = falso({ pago: { external_reference: "mes:" + B, status: "pending" } });
  await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook?topic=payment&id=5", body: {} });
  check(f.calls.some(c => c.url.endsWith("/v1/payments/5")) && !llamado(f.calls, "/rpc/mp_pay_month"), "un pago pendiente (por ejemplo en Rapipago) todavía no suma nada");
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
  let f = falso();
  let out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "cancelar" } });
  const put = f.calls.find(c => c.method === "PUT");
  check(out.status === 200 && put && put.url.endsWith("/preapproval/pre-9") && put.body.status === "cancelled", "cancela la suscripción en Mercado Pago");
  check(llamado(f.calls, "/rpc/mp_apply").body.p_status === "cancelled", "y lo anota en el negocio");
  f = falso({ pre: { status: "cancelled" } });
  out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "cancelar" } });
  check(out.status === 200 && !f.calls.some(c => c.method === "PUT") && llamado(f.calls, "/rpc/mp_apply").body.p_status === "cancelled", "si ya estaba cancelada en Mercado Pago, solo la anota");
  f = falso({ preId: "123456" });
  out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "cancelar" } });
  check(out.status === 200 && !f.calls.some(c => c.method === "PUT") && llamado(f.calls, "/rpc/mp_apply").body.p_status === "cancelled", "si la suscripción no existe en esta cuenta (era de prueba), la da por cancelada");
  f = falso({ preId: "ajena" });
  out = await crearSuscripcion({ env, fetch: f.fetch, authHeader: "Bearer buena", body: { business_id: "b1", action: "cancelar" } });
  check(out.status === 200 && !f.calls.some(c => c.method === "PUT") && llamado(f.calls, "/rpc/mp_apply").body.p_status === "cancelled", "y lo mismo si Mercado Pago dice que es de otra cuenta");
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
  check(out.status === 200 && !llamado(f.calls, "/rpc/mp_apply") && !llamado(f.calls, "/rpc/mp_pay_month"), "ignora pagos que no son de Kovo");
  f = falso();
  await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook", body: { type: "subscription_preapproval", data: { id: "pre-1" }, status: "authorized" } });
  check(f.calls.some(c => c.url.endsWith("/preapproval/pre-1") && c.headers.Authorization === "Bearer TEST-123"), "no confía en el aviso: vuelve a preguntarle a Mercado Pago");
}
{ // "Simular notificación" de Mercado Pago manda un id que no existe
  let f = falso();
  let out = await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook", body: { action: "updated", entity: "preapproval", type: "subscription_preapproval", data: { id: "123456" } } });
  check(out.status === 200 && !llamado(f.calls, "/rpc/mp_apply"), "un aviso de prueba con una suscripción que no existe responde bien y no toca nada");
  f = falso();
  out = await procesarAviso({ env, fetch: f.fetch, url: "https://x/functions/v1/mp-webhook?type=subscription_authorized_payment&data.id=123456", body: {} });
  check(out.status === 200 && !llamado(f.calls, "/rpc/mp_apply"), "lo mismo con una cuota que no existe");
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
