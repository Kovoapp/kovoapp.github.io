import { SUPABASE_URL, SUPABASE_ANON_KEY, CONTACTO_WHATSAPP, CONTACTO_EMAIL } from "./config.js";

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const TRASH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>';
const CAL = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const fmt = n => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const fs = n => (n < 0 ? "-" : "") + fmt(Math.abs(n));
const num = v => Number(v) || 0;
const sum = arr => arr.reduce((a, x) => a + num(x.amount), 0);
const hoy = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") };
const toAR = i => /^\d{4}-\d{2}-\d{2}$/.test(i || "") ? i.slice(8) + "/" + i.slice(5, 7) + "/" + i.slice(0, 4) : "";
const hora = ts => new Date(ts).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v } catch (e) { return d } },
  set(k, v) { try { localStorage.setItem(k, v) } catch (e) { } },
  del(k) { try { localStorage.removeItem(k) } catch (e) { } }
};

function errMsg(e) {
  const m = String((e && (e.message || e.error_description || e.code)) || e || "");
  if (/failed to fetch|network|load failed/i.test(m)) return "Sin conexión. Revisá internet y probá de nuevo.";
  if (/row-level security|permission|42501/i.test(m)) return "Tu usuario no tiene permiso para hacer esto. Pedíselo al dueño.";
  if (/invalid login credentials/i.test(m)) return "Email o contraseña incorrectos.";
  if (/already registered|already exists/i.test(m)) return "Ya hay una cuenta con ese email. Probá con Entrar.";
  if (/password should be at least|weak/i.test(m)) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (/email not confirmed/i.test(m)) return "Confirmá tu email: te mandamos un link a tu casilla.";
  if (/invalid_signup_code/.test(m)) return "Ese código de alta no existe, ya se usó o venció. Escribinos para pedir uno.";
  if (/invalid_invite/.test(m)) return "Ese código no existe, ya se usó o venció. Pedí uno nuevo.";
  if (/duplicate key|unique/i.test(m)) return "Ya existe uno con ese nombre o código.";
  return "Algo salió mal. Probá de nuevo en un momento.";
}
function say(id, text, isErr) { const el = $(id); el.classList.toggle("err", !!isErr); el.textContent = text; if (!isErr && text) setTimeout(() => { if (el.textContent === text) el.textContent = "" }, 2500) }
function toast(text) { const t = document.createElement("div"); t.className = "toast"; t.textContent = text; document.body.appendChild(t); setTimeout(() => t.remove(), 2600) }

function ask(msg, input, def, solo) {
  return new Promise(res => {
    const ov = document.createElement("div"); ov.className = "ov";
    const box = document.createElement("div"); box.className = "card"; box.setAttribute("role", "dialog");
    const t = document.createElement("div"); t.textContent = msg; box.appendChild(t);
    let inp = null;
    if (input) { inp = document.createElement("input"); inp.type = input === "text" ? "text" : "number"; if (input !== "text") inp.inputMode = "decimal"; inp.value = def ?? ""; inp.style.marginTop = "12px"; box.appendChild(inp) }
    const row = document.createElement("div"); row.className = "row"; row.style.marginTop = "14px";
    const fin = v => { ov.remove(); res(v) };
    if (!solo) { const no = document.createElement("button"); no.type = "button"; no.className = "chip"; no.textContent = "Cancelar"; no.onclick = () => fin(input ? null : false); row.appendChild(no) }
    const ok = document.createElement("button"); ok.type = "button"; ok.className = "chip on"; ok.textContent = "Aceptar"; ok.onclick = () => fin(input ? inp.value : true); row.appendChild(ok);
    box.appendChild(row); ov.appendChild(box); document.body.appendChild(ov);
    if (inp) { inp.focus(); inp.onkeydown = e => { if (e.key === "Enter") ok.click() } } else ok.focus();
  });
}
const aviso = m => ask(m, false, null, true);

function chips(box, items, get, set, label = v => v) {
  box.innerHTML = "";
  items.forEach(v => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip" + (get() === v ? " on" : ""); b.textContent = label(v);
    b.onclick = () => { set(v); chips(box, items, get, set, label) }; box.appendChild(b)
  });
}
function delBtn(onclick, title = "Borrar") {
  const x = document.createElement("button"); x.type = "button"; x.className = "x"; x.innerHTML = TRASH; x.title = title; x.setAttribute("aria-label", title); x.onclick = onclick; return x;
}
function td(text, cls) { const c = document.createElement("td"); if (cls) c.className = cls; if (text !== undefined) c.textContent = text; return c }
function emptyRow(table, text) { table.innerHTML = ""; const tr = document.createElement("tr"); tr.appendChild(td(text, "mu")); table.appendChild(tr) }

// Fechas dd/mm/aaaa con selector y botón "Hoy"
function isoF(id) { const m = $(id).value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return ""; const d = new Date(+m[3], +m[2] - 1, +m[1]); return d.getFullYear() == +m[3] && d.getMonth() == +m[2] - 1 && d.getDate() == +m[1] ? m[3] + "-" + m[2] + "-" + m[1] : "" }
function setF(id, iso) { $(id).value = toAR(iso) }
function isoM(id) { const m = $(id).value.match(/^(\d{2})\/(\d{4})$/); return m && +m[1] >= 1 && +m[1] <= 12 ? m[2] + "-" + m[1] : "" }
function setM(id, iso) { $(id).value = iso.slice(5, 7) + "/" + iso.slice(0, 4) }
function dateField(id, kind, cb) {
  const el = $(id);
  if (kind === "date") {
    el.inputMode = "numeric"; el.placeholder = "dd/mm/aaaa"; el.maxLength = 10; setF(id, hoy());
    el.oninput = () => { const d = el.value.replace(/\D/g, "").slice(0, 8); let o = d.slice(0, 2); if (d.length > 2) o += "/" + d.slice(2, 4); if (d.length > 4) o += "/" + d.slice(4); el.value = o; if (isoF(id)) cb() };
    el.onblur = () => { if (!isoF(id)) { setF(id, hoy()); cb() } };
  } else {
    el.inputMode = "numeric"; el.placeholder = "mm/aaaa"; el.maxLength = 7; setM(id, hoy().slice(0, 7));
    el.oninput = () => { const d = el.value.replace(/\D/g, "").slice(0, 6); let o = d.slice(0, 2); if (d.length > 2) o += "/" + d.slice(2); el.value = o; if (isoM(id)) cb() };
    el.onblur = () => { if (!isoM(id)) { setM(id, hoy().slice(0, 7)); cb() } };
  }
  const wrap = document.createElement("div"); wrap.className = "row"; wrap.style.flexWrap = "nowrap";
  el.parentNode.insertBefore(wrap, el); wrap.appendChild(el); el.style.flex = "1 1 auto"; el.style.minWidth = "0";
  const box = document.createElement("div"); box.style.cssText = "position:relative;flex:0 0 auto;display:flex";
  const b = document.createElement("button"); b.type = "button"; b.className = "chip camb"; b.innerHTML = CAL; b.style.display = "grid"; b.style.placeItems = "center"; b.title = "Elegir fecha";
  const pk = document.createElement("input"); pk.type = kind; pk.setAttribute("aria-label", "Elegir fecha"); pk.tabIndex = -1;
  pk.style.cssText = "position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;padding:0;border:0;min-height:0";
  pk.onchange = () => { if (!pk.value) return; if (kind === "date") setF(id, pk.value); else setM(id, pk.value); cb() };
  box.append(b, pk); wrap.appendChild(box);
  if (kind === "date") { const h = document.createElement("button"); h.type = "button"; h.className = "chip camb"; h.textContent = "Hoy"; h.onclick = () => { setF(id, hoy()); cb() }; wrap.appendChild(h) }
}

function downloadCsv(name, rows) {
  const q = v => typeof v === "number" ? String(v) : '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const txt = "﻿" + rows.map(r => r.map(q).join(";")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000);
}

// ---------------------------------------------------------------
// Estado
// ---------------------------------------------------------------
let sb = null, user = null;
let biz = null, role = null, members = [];
let shops = [], pays = [], clientes = [], provs = [], catalog = [];
const isMgr = () => role === "owner" || role === "admin";
const activeShops = () => shops.filter(s => s.active);
const retailShops = () => activeShops().filter(s => s.kind === "retail");
const shopName = id => (shops.find(s => s.id === id) || {}).name || "Sin local";
const isWholesale = id => (shops.find(s => s.id === id) || {}).kind === "wholesale";
const payNames = wholesale => pays.filter(p => p.active && (!wholesale || p.wholesale)).map(p => p.name);

function show(screen) {
  ["auth", "setup", "app"].forEach(s => { $("screen-" + s).hidden = s !== screen });
}

// ---------------------------------------------------------------
// Ingreso
// ---------------------------------------------------------------
let signup = false;
function authMode(s) {
  signup = s; $("tabLogin").classList.toggle("on", !s); $("tabSignup").classList.toggle("on", s);
  $("authBtn").textContent = s ? "Crear cuenta" : "Entrar"; $("apass").autocomplete = s ? "new-password" : "current-password"; $("forgot").hidden = s; say("authMsg", "");
}
$("tabLogin").onclick = () => authMode(false);
$("tabSignup").onclick = () => authMode(true);
$("authForm").onsubmit = async e => {
  e.preventDefault();
  const email = $("aemail").value.trim(), password = $("apass").value;
  if (!/^\S+@\S+\.\S+$/.test(email)) return say("authMsg", "Escribí un email válido.", true);
  if (password.length < 8) return say("authMsg", "La contraseña tiene que tener al menos 8 caracteres.", true);
  $("authBtn").disabled = true;
  try {
    const r = signup ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } })
      : await sb.auth.signInWithPassword({ email, password });
    if (r.error) throw r.error;
    if (signup && !r.data.session) say("authMsg", "Listo. Te mandamos un email para confirmar la cuenta; después volvé y tocá Entrar.");
  } catch (err) { say("authMsg", errMsg(err), true) }
  $("authBtn").disabled = false;
};
$("forgot").onclick = async () => {
  const email = $("aemail").value.trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) return say("authMsg", "Escribí tu email arriba y volvé a tocar acá.", true);
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  say("authMsg", error ? errMsg(error) : "Te mandamos un email para elegir una contraseña nueva.", !!error);
};
$$("[data-logout]").forEach(b => b.onclick = async () => { await sb.auth.signOut(); store.del("biz"); location.reload() });

// ---------------------------------------------------------------
// Alta del negocio
// ---------------------------------------------------------------
const DEFAULT_PAYS = ["Efectivo", "Transferencia", "QR", "Posnet", "Mercado Pago", "Cuenta DNI"];
let sPays = ["Efectivo", "Transferencia", "QR", "Posnet"], sPayAll = [...DEFAULT_PAYS];
function shopInput(v = "") {
  const r = document.createElement("div"); r.className = "row";
  const i = document.createElement("input"); i.placeholder = "Nombre del local"; i.value = v; i.autocomplete = "off";
  r.append(i, delBtn(() => { if ($("sshops").children.length > 1) r.remove() }, "Quitar local"));
  $("sshops").appendChild(r);
}
function renderSPays() {
  $("spays").innerHTML = "";
  sPayAll.forEach(p => {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip" + (sPays.includes(p) ? " on" : ""); b.textContent = p; b.setAttribute("aria-pressed", sPays.includes(p));
    b.onclick = () => { sPays = sPays.includes(p) ? sPays.filter(x => x !== p) : [...sPays, p]; renderSPays() };
    $("spays").appendChild(b);
  });
}
$("saddShop").onclick = () => { shopInput(); $("sshops").lastChild.querySelector("input").focus() };
$("spayAdd").onclick = () => { const v = $("spayNew").value.trim(); if (!v) return; if (!sPayAll.includes(v)) sPayAll.push(v); if (!sPays.includes(v)) sPays.push(v); $("spayNew").value = ""; renderSPays() };
$("spayNew").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); $("spayAdd").click() } };
// Links de contacto para pedir un código de alta (se configuran en js/config.js)
const msgContacto = "Hola, quiero usar la caja en mi negocio. ¿Me pasan un código de alta?";
const urlContacto = CONTACTO_WHATSAPP ? "https://wa.me/" + CONTACTO_WHATSAPP.replace(/\D/g, "") + "?text=" + encodeURIComponent(msgContacto)
  : CONTACTO_EMAIL ? "mailto:" + CONTACTO_EMAIL + "?subject=" + encodeURIComponent("Código de alta") + "&body=" + encodeURIComponent(msgContacto) : "";
document.querySelectorAll("a.contacto").forEach(a => { if (urlContacto) a.href = urlContacto; else a.replaceWith(a.textContent) });
$("setNew").onclick = () => { $("setNew").classList.add("on"); $("setJoin").classList.remove("on"); $("newForm").hidden = false; $("joinForm").hidden = true };
$("setJoin").onclick = () => { $("setJoin").classList.add("on"); $("setNew").classList.remove("on"); $("newForm").hidden = true; $("joinForm").hidden = false };
$("newForm").onsubmit = async e => {
  e.preventDefault();
  const name = $("sname").value.trim(), owner = $("sowner").value.trim();
  const shopList = [...$("sshops").querySelectorAll("input")].map(i => i.value.trim()).filter(Boolean);
  const codigo = $("scodigo").value.trim();
  if (!codigo) return say("smsg", "Escribí el código de alta que te dimos.", true);
  if (!name) return say("smsg", "Escribí el nombre del negocio.", true);
  if (!shopList.length) return say("smsg", "Agregá al menos un local.", true);
  if (!sPays.length) return say("smsg", "Elegí al menos un medio de pago.", true);
  $("screate").disabled = true;
  const ordered = sPayAll.filter(p => sPays.includes(p));
  const { data, error } = await sb.rpc("create_business", { p_name: name, p_owner_name: owner, p_shops: shopList, p_wholesale: $("swhole").checked, p_payments: ordered, p_code: codigo });
  $("screate").disabled = false;
  if (error) return say("smsg", errMsg(error), true);
  store.set("biz", data); await enter();
};
$("joinForm").onsubmit = async e => {
  e.preventDefault();
  const code = $("jcode").value.trim(), name = $("jname").value.trim();
  if (!code) return say("jmsg", "Escribí el código que te pasaron.", true);
  $("jbtn").disabled = true;
  const { data, error } = await sb.rpc("join_business", { p_code: code, p_name: name });
  $("jbtn").disabled = false;
  if (error) return say("jmsg", errMsg(error), true);
  store.set("biz", data); await enter();
};

// ---------------------------------------------------------------
// Entrada a la app
// ---------------------------------------------------------------
async function enter() {
  const { data: mem, error } = await sb.from("members").select("business_id, role, display_name, user_id").eq("user_id", user.id);
  if (error) { aviso(errMsg(error)); return }
  if (!mem || !mem.length) {
    show("setup");
    if (!$("sshops").children.length) { shopInput(); renderSPays() }
    return;
  }
  const saved = store.get("biz", "");
  const m = mem.find(x => x.business_id === saved) || mem[0];
  store.set("biz", m.business_id);
  role = m.role;
  await loadRefs(m.business_id);
  show("app");
  startApp();
  // Volviendo de Mercado Pago: el aviso de pago puede tardar unos segundos en llegar.
  if (/suscripcion=ok/.test(location.search)) {
    history.replaceState(null, "", location.pathname);
    toast("¡Gracias! Mercado Pago está confirmando tu suscripción.");
    setTimeout(reloadRefs, 6000);
  }
}

// ---------------------------------------------------------------
// Plan y suscripción (Mercado Pago)
// ---------------------------------------------------------------
const futuro = d => d && new Date(d) > Date.now();
const diasHasta = d => Math.ceil((new Date(d) - Date.now()) / 864e5);
// Igual que can_sell() en la base: prueba vigente, pago al día o acceso gratis.
const puedeVender = () => biz.plan === "free" || futuro(biz.trial_ends_at) || futuro(biz.paid_until);
const fechaCorta = d => new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "long" });
function pintaPlan() {
  const enPrueba = futuro(biz.trial_ends_at) && biz.mp_status !== "authorized" && biz.plan !== "free";
  const left = diasHasta(biz.trial_ends_at);
  $("trialBanner").hidden = !(role === "owner" && (enPrueba || !puedeVender()));
  $("trialBanner").textContent = enPrueba ? `Te quedan ${left} día${left === 1 ? "" : "s"} de prueba gratis. Para seguir después, suscribite en Ajustes → Mi plan.`
    : "Tu plan está vencido: no se pueden anotar ventas. Suscribite en Ajustes → Mi plan.";
  const ok = puedeVender();
  $("bloqueo").hidden = ok; $("enviar").disabled = !ok;
  if (!ok) $("bloqueo").textContent = role === "owner" ? "Tu plan está vencido. Para seguir anotando ventas, suscribite en Ajustes → Mi plan."
    : "La caja de este negocio está pausada. Avisale al dueño que renueve la suscripción.";
}
async function renderPlan() {
  if (role !== "owner") return;
  const { data: precio } = await sb.rpc("subscription_price", { b: biz.id });
  const $p = "$" + Number(precio || 0).toLocaleString("es-AR");
  let estado, detalle, suscribir = true, cancelar = false;
  if (biz.plan === "free") { estado = "Acceso sin cargo"; detalle = "Tu negocio usa la caja sin pagar suscripción."; suscribir = false }
  else if (biz.mp_status === "authorized") {
    estado = "Suscripción activa · " + $p + " por mes"; suscribir = false; cancelar = true;
    detalle = futuro(biz.trial_ends_at) ? "El primer cobro es el " + fechaCorta(biz.trial_ends_at) + ", cuando termina la prueba." : "Mercado Pago te cobra todos los meses de forma automática.";
  } else if (biz.mp_status === "pending") {
    estado = "Esperando la confirmación de Mercado Pago";
    detalle = "Si no terminaste el pago, podés volver a intentarlo.";
  } else if (futuro(biz.trial_ends_at)) {
    const left = diasHasta(biz.trial_ends_at);
    estado = `Prueba gratis: quedan ${left} día${left === 1 ? "" : "s"}`;
    detalle = `Después cuesta ${$p} por mes. Si te suscribís ahora, el primer cobro es cuando termina la prueba.`;
  } else if (futuro(biz.paid_until)) {
    estado = "Suscripción cancelada";
    detalle = "Podés seguir usando la caja hasta el " + fechaCorta(biz.paid_until) + ". Para seguir después, volvé a suscribirte (" + $p + " por mes).";
  } else {
    estado = "Plan vencido";
    detalle = `No se pueden anotar ventas. Suscribite por ${$p} por mes para seguir; tus datos están guardados.`;
  }
  $("planEstado").textContent = estado; $("planDetalle").textContent = detalle;
  $("planSuscribir").hidden = !suscribir; $("planCancel").hidden = !cancelar;
  if (!$("planEmail").value) $("planEmail").placeholder = user.email || "tu@email.com";
}
async function suscribir() {
  const email = $("planEmail").value.trim();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return aviso("Revisá el email de Mercado Pago.");
  $("planBtn").disabled = true; $("planBtn").textContent = "Abriendo Mercado Pago...";
  const { data, error } = await sb.functions.invoke("mp-suscribir", { body: { business_id: biz.id, action: "suscribir", payer_email: email || undefined } });
  $("planBtn").disabled = false; $("planBtn").textContent = "Suscribirme con Mercado Pago";
  if (error || !data || !data.init_point) return aviso("No se pudo conectar con Mercado Pago. Probá de nuevo en un momento.");
  location.href = data.init_point;
}
async function cancelarSuscripcion() {
  if (!await ask("¿Cancelar la suscripción? Podés seguir usando la caja hasta el fin del mes que ya pagaste.")) return;
  const { error } = await sb.functions.invoke("mp-suscribir", { body: { business_id: biz.id, action: "cancelar" } });
  if (error) return aviso("No se pudo cancelar. Probá de nuevo o cancelala desde tu cuenta de Mercado Pago.");
  toast("Suscripción cancelada"); reloadRefs();
}

async function loadRefs(b) {
  const q = t => sb.from(t).select("*").eq("business_id", b);
  const [bz, sh, pm, cl, pv, pr, mb] = await Promise.all([
    sb.from("businesses").select("*").eq("id", b).single(),
    q("shops").order("position"), q("payment_methods").order("position"),
    q("clients").order("name"), isMgr() ? q("providers").order("name") : Promise.resolve({ data: [] }),
    q("products").order("name"), q("members").order("created_at")
  ]);
  biz = bz.data; shops = sh.data || []; pays = pm.data || []; clientes = cl.data || []; provs = pv.data || []; catalog = pr.data || []; members = mb.data || [];
}

let started = false;
function startApp() {
  $("bizName").textContent = biz.name;
  document.title = biz.name + " · Caja";
  const t = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  $("hoyTxt").textContent = t.charAt(0).toUpperCase() + t.slice(1);
  const me = members.find(m => m.user_id === user.id);
  $("whoami").textContent = (me && me.display_name ? me.display_name + " · " : "") + user.email + " · " + ({ owner: "Dueño", admin: "Administrador", cashier: "Cajero" })[role];
  $("tabs").hidden = !isMgr();
  $$(".mgr").forEach(e => e.hidden = !isMgr());
  $$(".owner-only").forEach(e => e.hidden = role !== "owner");
  pintaPlan();
  if (!activeShops().find(s => s.id === local)) local = (activeShops()[0] || {}).id;
  renderLocales(); renderPagos(); renderCart(); renderClientes(); renderCatalog(); renderSettings(); pintaUndo();
  if (!started) { started = true; wireOnce() }
}

// ---------------------------------------------------------------
// Vender
// ---------------------------------------------------------------
let local = null, pago = null, cart = [], mcli = null, last = null;
let ultima = null; try { ultima = JSON.parse(store.get("ultimaVenta", "null")) } catch (e) { }

function renderLocales() {
  chips($("locales"), activeShops().map(s => s.id), () => local, v => { local = v; onLocal() }, shopName);
  onLocal(true);
}
function onLocal(quiet) {
  const may = isWholesale(local);
  $("cliwrap").hidden = !may; $("prodwrap").hidden = may;
  if (may && cart.length && !quiet) { cart = []; renderCart(); sync() }
  renderPagos();
}
function renderPagos() {
  const vis = payNames(isWholesale(local));
  if (!vis.includes(pago)) pago = vis[0];
  chips($("pagos"), vis, () => pago, v => { pago = v; calc() }); calc();
}
function calc() {
  const m = parseFloat($("monto").value) || 0, p = parseFloat($("paga").value) || 0;
  $("totv").textContent = fmt(m);
  $("cambio").hidden = !/efectivo/i.test(pago || "");
  const d = p - m, box = $("vv").parentElement, falta = p > 0 && d < 0;
  box.classList.toggle("falta", falta);
  $("vl").textContent = falta ? "Falta" : "Vuelto";
  $("vv").textContent = p > 0 ? fmt(Math.abs(d)) : "$0";
}
const lineTotal = l => l.unit === "kg" ? l.price * l.qty / 1000 : l.price * l.qty;
function sync() { $("monto").value = cart.length ? Math.round(cart.reduce((a, l) => a + lineTotal(l), 0) * 100) / 100 : ""; calc() }
// Stock: vacío (null) = no se controla. Se guarda en unidades o en kilos.
const hayStock = p => p && p.stock !== null && p.stock !== undefined;
const fmtStock = p => { const n = Math.round(num(p.stock) * 1000) / 1000; return n.toLocaleString("es-AR") + (p.unit === "kg" ? " kg" : " u") };
function addProd(p) {
  cart.push({ id: p.id, name: p.name, price: num(p.price), unit: p.unit, qty: p.unit === "kg" ? 250 : 1 }); $("busq").value = ""; renderResults(); renderCart(); sync();
  if (hayStock(p) && num(p.stock) <= 0) toast("Ojo: " + p.name + " figura sin stock");
}
// Descuenta (o devuelve) en la lista local lo mismo que descuenta la base al anotar o borrar una venta.
function moverStock(items, sgn) {
  (items || []).forEach(i => { const p = catalog.find(x => x.id === i.id); if (hayStock(p)) p.stock = num(p.stock) + sgn * (p.unit === "kg" ? i.qty / 1000 : i.qty) });
  renderCatalog();
}
function renderResults() {
  const q = $("busq").value.trim().toLowerCase(), box = $("res"); box.innerHTML = "";
  if (!q) return;
  const m = catalog.filter(p => p.name.toLowerCase().includes(q) || (p.code && p.code.includes(q))).slice(0, 8);
  if (!m.length) { box.innerHTML = '<div class="mu" style="margin-top:6px">Sin resultados</div>'; return }
  m.forEach(p => { const b = document.createElement("button"); b.type = "button"; b.className = "chip pick"; b.textContent = p.name + " · " + fmt(p.price) + (p.unit === "kg" ? " /kg" : "") + (hayStock(p) ? (num(p.stock) > 0 ? " · quedan " + fmtStock(p) : " · sin stock") : ""); if (hayStock(p) && num(p.stock) <= 0) b.classList.add("sin-stock"); b.onclick = () => addProd(p); box.appendChild(b) });
}
function enterBusq() {
  const v = $("busq").value.trim(); if (!v) return;
  const p = catalog.find(x => x.code && x.code === v); if (p) return addProd(p);
  const m = catalog.filter(x => x.name.toLowerCase().includes(v.toLowerCase()));
  if (m.length === 1) addProd(m[0]);
  else if (/^\d{6,}$/.test(v)) codigoNuevo(v);
}
function renderCart() {
  const box = $("cart"); box.innerHTML = "";
  cart.forEach((l, i) => {
    const d = document.createElement("div"); d.className = "cl";
    const n = document.createElement("span"); n.className = "cn"; n.textContent = l.name;
    const st = document.createElement("span"); st.className = "cs"; st.textContent = fmt(lineTotal(l));
    const q = document.createElement("input"); q.type = "number"; q.inputMode = "decimal"; q.value = l.qty; q.className = "cq"; q.setAttribute("aria-label", "Cantidad de " + l.name);
    q.addEventListener("wheel", () => q.blur());
    q.oninput = () => { l.qty = parseFloat(q.value) || 0; st.textContent = fmt(lineTotal(l)); sync() };
    const u = document.createElement("span"); u.className = "mu"; u.textContent = l.unit === "kg" ? "g" : "u";
    d.append(n, q, u, st, delBtn(() => { cart.splice(i, 1); renderCart(); sync() }, "Quitar"));
    box.appendChild(d);
  });
}
function chkFecha() { const d = isoF("vfecha"); $("vfnote").textContent = d && d !== hoy() ? "Ojo: esta venta se anota con fecha " + toAR(d) + ", no hoy." : "" }

async function anotarVenta() {
  const monto = parseFloat($("monto").value);
  if (!(monto > 0)) return say("msg", "Escribí el total a cobrar.", true);
  if (!local) return say("msg", "Elegí un local.", true);
  if (!puedeVender()) return say("msg", $("bloqueo").textContent, true);
  const pagaV = parseFloat($("paga").value) || 0, efectivo = /efectivo/i.test(pago);
  if (efectivo && pagaV > 0 && pagaV < monto) {
    const t = "El cliente paga " + fmt(pagaV) + " y el total es " + fmt(monto) + ": faltan " + fmt(monto - pagaV) + ". La venta no se anotó.";
    say("msg", t, true); aviso(t); return;
  }
  const may = isWholesale(local);
  if (may && !mcli) return say("msg", "Elegí un cliente de la lista.", true);
  $("enviar").disabled = true; $("imp").hidden = true;
  const row = { business_id: biz.id, shop_id: local, day: isoF("vfecha") || hoy(), client_name: may ? mcli : "", payment: pago, amount: monto, paid_with: efectivo ? pagaV : 0, items: cart.map(l => ({ id: l.id, name: l.name, qty: l.qty, unit: l.unit, price: l.price })) };
  const { data, error } = await sb.from("sales").insert(row).select().single();
  $("enviar").disabled = false;
  if (error) return say("msg", errMsg(error), true);
  say("msg", "✓ Venta anotada"); moverStock(data.items, -1);
  last = data; $("imp").hidden = false;
  ultima = { id: data.id, amount: monto, shop: shopName(local), payment: pago, at: Date.now(), items: data.items }; store.set("ultimaVenta", JSON.stringify(ultima)); pintaUndo();
  mcli = null; $("cbus").value = ""; $("cres").hidden = true; $("mdel").hidden = true;
  cart = []; renderCart(); $("monto").value = ""; $("paga").value = ""; calc();
}
function pintaUndo() {
  const b = $("undo");
  const fresh = ultima && (isMgr() || Date.now() - ultima.at < 15 * 60e3);
  if (!fresh) { b.hidden = true; return }
  b.hidden = false; b.textContent = "Eliminar la última venta (" + fmt(ultima.amount) + " · " + ultima.shop + ")";
}
async function deshacer() {
  if (!ultima) return;
  if (!await ask("¿Eliminar la última venta: " + fmt(ultima.amount) + " en " + ultima.shop + " (" + ultima.payment + ")?")) return;
  const { error, count } = await sb.from("sales").delete({ count: "exact" }).eq("id", ultima.id);
  if (error) return aviso(errMsg(error));
  if (count === 0) aviso("No se pudo eliminar: ya pasaron más de 15 minutos. Pedile al dueño que la borre desde Resumen.");
  else { say("msg", "Venta eliminada"); moverStock(ultima.items, 1) }
  ultima = null; last = null; store.del("ultimaVenta"); pintaUndo(); $("imp").hidden = true;
}

// Clientes mayoristas
function syncCli() { const v = $("cbus").value.trim(); mcli = clientes.some(c => c.name === v) ? v : null; $("mdel").hidden = !(mcli && isMgr()) }
function listaBox(box, list, query, onPick) {
  box.innerHTML = "";
  const m = list.filter(c => c.name.toLowerCase().includes(query));
  if (!m.length) { box.innerHTML = '<div class="mu" style="padding:10px">Sin resultados</div>'; box.hidden = false; return }
  m.forEach(c => { const b = document.createElement("button"); b.type = "button"; b.textContent = c.name; b.onclick = () => onPick(c); box.appendChild(b) });
  box.hidden = false;
}
function listaClis(all) { listaBox($("cres"), clientes, all ? "" : $("cbus").value.trim().toLowerCase(), c => { $("cbus").value = c.name; $("cres").hidden = true; syncCli() }) }
function renderClientes() { syncCli(); if (!$("cres").hidden) listaClis(false) }

// ---------------------------------------------------------------
// Ticket
// ---------------------------------------------------------------
let anchoTxt = store.get("ancho", "58 mm");
function aplicarAncho() {
  const w = parseInt(anchoTxt);
  let st = $("pgst"); if (!st) { st = document.createElement("style"); st.id = "pgst"; document.head.appendChild(st) }
  st.textContent = `@page{size:${w}mm auto;margin:2mm}@media print{#ticket{width:${w - 4}mm;font-size:${w < 70 ? 11 : 13}px}}`;
}
function printTicket(s) {
  const t = $("ticket"); t.innerHTML = "";
  const add = (txt, cls) => { const d = document.createElement("div"); d.textContent = txt; if (cls) d.className = cls; t.appendChild(d) };
  const row = (a, b, cls) => { const d = document.createElement("div"); d.className = "tr " + (cls || ""); const x = document.createElement("span"); x.textContent = a; const y = document.createElement("span"); y.textContent = b; d.append(x, y); t.appendChild(d) };
  const line = () => { const d = document.createElement("div"); d.className = "ts"; t.appendChild(d) };
  add(biz.name, "tc tb"); add(shopName(s.shop_id), "tc");
  add(new Date(s.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }), "tc");
  if (s.client_name) add("Cliente: " + s.client_name, "tc");
  line();
  (s.items || []).forEach(i => { row(i.name, fmt(lineTotal(i))); add("  " + (i.unit === "kg" ? i.qty + " g" : i.qty + " x " + fmt(i.price)), "tm") });
  if ((s.items || []).length) line();
  row("TOTAL", fmt(s.amount), "tb"); row("Pago", s.payment);
  if (num(s.paid_with) > 0) { row("Paga con", fmt(s.paid_with)); row("Vuelto", fmt(num(s.paid_with) - num(s.amount))) }
  if (biz.ticket_footer) { line(); add(biz.ticket_footer, "tc") }
  add("No válido como factura", "tc tm");
  window.print();
}

// ---------------------------------------------------------------
// Resumen del día
// ---------------------------------------------------------------
let ventas = [], gastosDia = [], aper = [];
const abiertos = new Set(), abiertosRes = new Set(), abiertosProv = new Set();
async function cargarResumen() {
  const dia = isoF("dia") || hoy();
  const [s, e, o] = await Promise.all([
    sb.from("sales").select("*").eq("business_id", biz.id).eq("day", dia).order("created_at", { ascending: false }),
    sb.from("expenses").select("*").eq("business_id", biz.id).eq("day", dia),
    sb.from("openings").select("*").eq("business_id", biz.id).eq("day", dia)
  ]);
  if (s.error) return aviso(errMsg(s.error));
  ventas = s.data || []; gastosDia = e.data || []; aper = o.data || [];
  pintarResumen();
}
function pintarResumen() {
  $("total").textContent = fmt(sum(ventas));
  const sd = gastosDia.filter(x => x.kind !== "withdrawal"), retiros = gastosDia.filter(x => x.kind === "withdrawal");
  const btn = k => `<button type="button" class="chip camb" data-k="${k}" style="font-size:16px;min-width:40px;min-height:36px;padding:4px 10px;margin-right:8px" aria-label="Ver por medio de pago">${abiertosRes.has(k) ? "▴" : "▾"}</button>`;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const sub = (pg, v) => `<tr><td style="padding-left:22px;color:var(--mu);font-weight:400">${esc(pg)}</td><td class="n" style="color:var(--mu)" data-label="">${fmt(v)}</td><td></td><td></td></tr>`;
  let h = `<tr class="bh"><td>Resumen del día</td><td class="n hd">Ingresos</td><td class="n hd">Egresos</td><td class="n hd">Balance</td></tr>`, ti = 0, te = 0;
  const shown = shops.filter(s => s.active || ventas.some(v => v.shop_id === s.id));
  shown.forEach(l => {
    const vl = ventas.filter(x => x.shop_id === l.id), i = sum(vl), e = sum(sd.filter(x => x.shop_id === l.id)); ti += i; te += e;
    h += `<tr class="bs"><td><span>${btn(l.id)}${esc(l.name)}</span></td><td class="n" data-label="Ingresos">${fmt(i)}</td><td class="n" data-label="Egresos">${fmt(e)}</td><td class="n" data-label="Balance">${fs(i - e)}</td></tr>`;
    if (abiertosRes.has(l.id)) payNames(l.kind === "wholesale").forEach(pg => { h += sub(pg, sum(vl.filter(x => x.payment === pg))) });
  });
  const ge = sum(sd.filter(x => !x.shop_id)); te += ge;
  if (ge) h += `<tr class="bs"><td>Egresos generales</td><td class="n" data-label="Ingresos">$0</td><td class="n" data-label="Egresos">${fmt(ge)}</td><td class="n" data-label="Balance">${fs(-ge)}</td></tr>`;
  h += `<tr class="bh"><td><span>${btn("total")}Total del día</span></td><td class="n" data-label="Ingresos">${fmt(ti)}</td><td class="n" data-label="Egresos">${fmt(te)}</td><td class="n" data-label="Balance">${fs(ti - te)}</td></tr>`;
  if (abiertosRes.has("total")) payNames(false).forEach(pg => { h += sub(pg, sum(ventas.filter(x => x.payment === pg))) });
  $("rdia").className = "bt"; $("rdia").innerHTML = h;
  $("rdia").querySelectorAll("button[data-k]").forEach(b => b.onclick = () => { const k = b.dataset.k; abiertosRes.has(k) ? abiertosRes.delete(k) : abiertosRes.add(k); pintarResumen() });

  const box = $("porGrupo"); box.innerHTML = "";
  shown.forEach(l => {
    const vs = ventas.filter(x => x.shop_id === l.id), loc = document.createElement("div"); loc.className = "loc";
    const head = document.createElement("div"); head.className = "tot";
    const hl = document.createElement("span"); const hb = document.createElement("b"); hb.textContent = l.name; const hs = document.createElement("span"); hs.className = "mu"; hs.textContent = vs.length + " venta" + (vs.length === 1 ? "" : "s");
    hl.append(hb, document.createElement("br"), hs);
    const hv = document.createElement("span"); hv.className = "big"; hv.textContent = fmt(sum(vs)); head.append(hl, hv);
    const tb = document.createElement("table");
    payNames(l.kind === "wholesale").forEach(pg => {
      const sp = vs.filter(x => x.payment === pg), key = l.id + "|" + pg, open = abiertos.has(key);
      const tr = document.createElement("tr");
      const c3 = td(); c3.style.width = "64px";
      if (sp.length) {
        const b = document.createElement("button"); b.type = "button"; b.className = "chip camb"; b.style.cssText = "min-width:48px;min-height:40px;padding:4px 12px"; b.textContent = open ? "▴" : "▾"; b.setAttribute("aria-label", "Ver ventas");
        b.onclick = () => { open ? abiertos.delete(key) : abiertos.add(key); pintarResumen() }; c3.appendChild(b);
      }
      tr.append(td(pg + (sp.length ? ` (${sp.length})` : "")), td(fmt(sum(sp)), "n"), c3); tb.appendChild(tr);
      if (open && sp.length) {
        const tr2 = document.createElement("tr"); const cell = td(); cell.colSpan = 3;
        const inner = document.createElement("table"); inner.style.cssText = "background:var(--ac2);border-radius:8px";
        sp.forEach(v => {
          const r = document.createElement("tr");
          r.append(td(hora(v.created_at) + (v.client_name ? ` · ${v.client_name}` : "") + (v.items && v.items.length ? " · " + v.items.map(i => i.name).join(", ") : "")), td(fmt(v.amount), "n"));
          const d3 = td(); d3.appendChild(delBtn(() => borrarVenta(v))); r.appendChild(d3); inner.appendChild(r);
        });
        cell.appendChild(inner); tr2.appendChild(cell); tb.appendChild(tr2);
      }
    });
    const rl = retiros.filter(x => x.shop_id === l.id), ap = aper.find(x => x.shop_id === l.id);
    if (rl.length || ap) {
      const rt = sum(rl), ini = ap ? num(ap.amount) : 0, efe = sum(vs.filter(x => /efectivo/i.test(x.payment)));
      const fila = (txt, val, color, cls) => { const r = document.createElement("tr"); if (cls) r.className = cls; const a = td(txt), b = td(val, "n"); if (color) { a.style.color = color; b.style.color = color } r.append(a, b, td()); tb.appendChild(r) };
      if (ap) fila("Caja inicial", "+" + fmt(ini));
      if (rl.length) fila(`Retiros de caja (${rl.length})`, "-" + fmt(rt), "var(--rd)");
      fila("Efectivo en caja", fmt(ini + efe - rt), null, "bs");
    }
    loc.append(head, tb); box.appendChild(loc);
  });

  const pp = gastosDia.filter(x => x.kind === "supplier");
  $("rptot").textContent = fmt(sum(pp)); $("rpcant").textContent = pp.length + " pago" + (pp.length === 1 ? "" : "s");
  const g = {}; pp.forEach(x => { (g[x.name] = g[x.name] || []).push(x) });
  const names = Object.keys(g).sort((a, b) => sum(g[b]) - sum(g[a]));
  const rpl = $("rpl"); rpl.innerHTML = "";
  if (!names.length) emptyRow(rpl, "Sin pagos a proveedores este día");
  names.forEach(n => {
    const arr = g[n], open = abiertosProv.has(n), tr = document.createElement("tr"), c1 = td();
    const b = document.createElement("button"); b.type = "button"; b.className = "chip camb"; b.style.cssText = "min-width:40px;min-height:36px;padding:4px 10px;margin-right:8px"; b.textContent = open ? "▴" : "▾"; b.setAttribute("aria-label", "Ver pagos");
    b.onclick = () => { open ? abiertosProv.delete(n) : abiertosProv.add(n); pintarResumen() };
    c1.append(b, document.createTextNode(n + (arr.length > 1 ? " (" + arr.length + ")" : "")));
    tr.append(c1, td(fmt(sum(arr)), "n")); rpl.appendChild(tr);
    if (open) arr.forEach(x => {
      const r = document.createElement("tr"); const d1 = td((x.shop_id ? shopName(x.shop_id) : "General") + " · " + x.payment); d1.style.cssText = "padding-left:22px;color:var(--mu)";
      const d2 = td(fmt(x.amount), "n"); d2.style.color = "var(--mu)"; const d3 = td(); d3.appendChild(delBtn(() => borrarGasto(x)));
      r.append(d1, d2, d3); rpl.appendChild(r);
    });
  });

  const t = $("lista"); t.innerHTML = "";
  if (!ventas.length) return emptyRow(t, "Sin ventas este día");
  ventas.forEach(v => {
    const tr = document.createElement("tr"), c3 = td();
    c3.appendChild(delBtn(() => borrarVenta(v)));
    tr.append(td(`${hora(v.created_at)} · ${shopName(v.shop_id)}` + (v.client_name ? ` (${v.client_name})` : "") + ` · ${v.payment}` + (v.items && v.items.length ? " · " + v.items.map(i => i.name).join(", ") : "")), td(fmt(v.amount), "n"), c3);
    t.appendChild(tr);
  });
}
async function borrarVenta(v) {
  if (!await ask("¿Borrar esta venta de " + fmt(v.amount) + "?")) return;
  const { error } = await sb.from("sales").delete().eq("id", v.id);
  if (error) return aviso(errMsg(error));
  refresh();
}
async function borrarGasto(x) {
  if (!await ask("¿Borrar este pago de " + fmt(x.amount) + (x.name ? " (" + x.name + ")" : "") + "?")) return;
  const { error } = await sb.from("expenses").delete().eq("id", x.id);
  if (error) return aviso(errMsg(error));
  refresh();
}

// ---------------------------------------------------------------
// Caja inicial
// ---------------------------------------------------------------
let alocal = null, adata = [];
function renderALocales() {
  if (!retailShops().find(s => s.id === alocal)) alocal = (retailShops()[0] || {}).id;
  chips($("alocales"), retailShops().map(s => s.id), () => alocal, v => { alocal = v; pintarAper() }, shopName);
}
async function cargarAper() {
  const { data, error } = await sb.from("openings").select("*").eq("business_id", biz.id).eq("day", isoF("adia") || hoy());
  if (error) return aviso(errMsg(error));
  adata = data || []; pintarAper();
}
function pintarAper() {
  const e = adata.find(x => x.shop_id === alocal);
  $("ahint").textContent = e ? "Ya cargado para " + shopName(alocal) + ": " + fmt(e.amount) + ". Al guardar se reemplaza." : "";
  const t = $("alista"); t.innerHTML = "";
  retailShops().forEach(l => {
    const x = adata.find(y => y.shop_id === l.id), tr = document.createElement("tr"), c2 = td(x ? fmt(x.amount) : "Sin cargar", "n"), c3 = td();
    if (!x) c2.style.color = "var(--mu)";
    if (x) c3.appendChild(delBtn(async () => {
      if (!await ask("¿Borrar la caja inicial de " + l.name + "?")) return;
      const { error } = await sb.from("openings").delete().eq("shop_id", l.id).eq("day", x.day);
      error ? aviso(errMsg(error)) : cargarAper();
    }));
    tr.append(td(l.name), c2, c3); t.appendChild(tr);
  });
}
async function guardarAper() {
  const v = $("amonto").value, monto = parseFloat(v);
  if (v === "" || !(monto >= 0)) return say("amsg", "Escribí el monto con el que inicia la caja.", true);
  if (!alocal) return say("amsg", "Elegí un local.", true);
  $("aenviar").disabled = true;
  const { error } = await sb.from("openings").upsert({ business_id: biz.id, shop_id: alocal, day: isoF("adia") || hoy(), amount: monto, updated_at: new Date().toISOString() }, { onConflict: "shop_id,day" });
  $("aenviar").disabled = false;
  if (error) return say("amsg", errMsg(error), true);
  say("amsg", "✓ Caja inicial guardada"); $("amonto").value = ""; cargarAper();
}

// ---------------------------------------------------------------
// Pagos (proveedores, impuestos, retiros)
// ---------------------------------------------------------------
const TIPOS = { "Proveedor": "supplier", "Impuestos": "tax", "Retiro de caja": "withdrawal" };
let ptipo = "Proveedor", plocal = null, ppago = null, pprov = null, pdata = [];
function renderPTipo() {
  const pv = ptipo === "Proveedor", ret = ptipo === "Retiro de caja";
  $("plocwrap").hidden = !(pv || ret); $("provwrap").hidden = !pv; $("detwrap").hidden = pv; $("pagowrap").hidden = ret;
  $("detlbl").textContent = ret ? "Detalle (opcional)" : "Detalle";
  $("pnom").placeholder = ret ? "Ej: Retiro para cambio" : "Ej: Ingresos Brutos";
  $("penviar").textContent = pv ? "Anotar pago a proveedor" : ret ? "Anotar retiro de caja" : "Anotar pago de impuestos";
  const opts = ret ? retailShops().map(s => s.id) : [...retailShops().map(s => s.id), "general"];
  if (!opts.includes(plocal)) plocal = opts[0];
  chips($("plocales"), opts, () => plocal, v => plocal = v, v => v === "general" ? "General" : shopName(v));
  const pn = payNames(false); if (!pn.includes(ppago)) ppago = pn[0];
  chips($("ppagos"), pn, () => ppago, v => ppago = v);
}
async function cargarProv() {
  const { data, error } = await sb.from("expenses").select("*").eq("business_id", biz.id).eq("day", isoF("pdia") || hoy()).order("created_at", { ascending: false });
  if (error) return aviso(errMsg(error));
  pdata = data || []; pintarProv();
}
function pintarProv() {
  const box = $("ptot"); box.innerHTML = "";
  const tot = (label, v) => { if (!v) return; const d = document.createElement("div"); d.className = "tot"; const b = document.createElement("b"); b.textContent = label; const s = document.createElement("span"); s.className = "big"; s.style.fontSize = "22px"; s.textContent = fmt(v); d.append(b, s); box.appendChild(d) };
  retailShops().forEach(l => tot(l.name, sum(pdata.filter(x => x.shop_id === l.id && x.kind === "supplier"))));
  tot("General", sum(pdata.filter(x => !x.shop_id && x.kind === "supplier")));
  tot("Impuestos", sum(pdata.filter(x => x.kind === "tax")));
  retailShops().forEach(l => tot("Retiro de caja – " + l.name, sum(pdata.filter(x => x.shop_id === l.id && x.kind === "withdrawal"))));
  const t = $("plista"); t.innerHTML = "";
  if (!pdata.length) return emptyRow(t, "Sin pagos este día");
  pdata.forEach(v => {
    const where = v.shop_id ? shopName(v.shop_id) : "General";
    const txt = v.kind === "tax" ? `Impuestos · ${v.name} · ${v.payment}` : v.kind === "withdrawal" ? `Retiro de caja · ${where}` + (v.name ? ` · ${v.name}` : "") : `${where} · ${v.name} · ${v.payment}`;
    const tr = document.createElement("tr"), c3 = td(); c3.appendChild(delBtn(() => borrarGasto(v)));
    tr.append(td(txt), td(fmt(v.amount), "n"), c3); t.appendChild(tr);
  });
}
async function anotarPago() {
  const ret = ptipo === "Retiro de caja", pv = ptipo === "Proveedor";
  const monto = parseFloat($("pmonto").value), name = pv ? pprov : $("pnom").value.trim();
  if (!name && !ret) return say("pmsg", pv ? "Elegí un proveedor de la lista o agregalo abajo." : "Escribí un detalle.", true);
  if (!(monto > 0)) return say("pmsg", "Escribí el monto.", true);
  $("penviar").disabled = true;
  const { error } = await sb.from("expenses").insert({
    business_id: biz.id, kind: TIPOS[ptipo], day: isoF("pdia") || hoy(), amount: monto, name: name || "",
    shop_id: ptipo === "Impuestos" || plocal === "general" ? null : plocal, payment: ret ? "Efectivo" : ppago
  });
  $("penviar").disabled = false;
  if (error) return say("pmsg", errMsg(error), true);
  say("pmsg", ret ? "✓ Retiro anotado" : "✓ Pago anotado");
  $("pmonto").value = ""; $("pnom").value = ""; pprov = null; $("pbus").value = ""; $("pres").hidden = true; $("pdel").hidden = true;
  cargarProv();
}
function syncProv() { const v = $("pbus").value.trim(); pprov = provs.some(c => c.name === v) ? v : null; $("pdel").hidden = !pprov }
function listaProvs(all) { listaBox($("pres"), provs, all ? "" : $("pbus").value.trim().toLowerCase(), c => { $("pbus").value = c.name; $("pres").hidden = true; syncProv() }) }

// ---------------------------------------------------------------
// Balance del mes
// ---------------------------------------------------------------
let bsales = [], bexp = [], balCsv = [];
function monthRange() {
  const m = isoM("bmes") || hoy().slice(0, 7), [y, mo] = m.split("-").map(Number);
  const end = new Date(y, mo, 0).getDate();
  return [m, m + "-01", m + "-" + String(end).padStart(2, "0")];
}
async function cargarBal() {
  const [, a, b] = monthRange();
  const [s, e] = await Promise.all([
    sb.from("sales").select("shop_id,payment,amount,client_name,day,created_at,items").eq("business_id", biz.id).gte("day", a).lte("day", b),
    sb.from("expenses").select("*").eq("business_id", biz.id).gte("day", a).lte("day", b)
  ]);
  if (s.error) return aviso(errMsg(s.error));
  bsales = s.data || []; bexp = e.data || []; pintarBal();
}
function pintarBal() {
  const R = retailShops();
  const shop = bsales.filter(x => !isWholesale(x.shop_id)), mayS = bsales.filter(x => isWholesale(x.shop_id));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const bc = [];
  const row = (label, tot, per, cls) => {
    bc.push([label, Math.round(tot)].concat(R.map((l, i) => per ? Math.round(per[i]) : "")));
    return `<tr class="${cls || ""}"><td>${esc(label)}</td><td class="n" data-label="Total">${fmt(tot)}</td>` + R.map((l, i) => per && R.length > 1 ? `<td class="n" data-label="${esc(l.name)}">${fmt(per[i])}</td>` : "<td></td>").join("") + "</tr>";
  };
  bc.push(["INGRESOS", "Total", ...R.map(l => l.name)]);
  let h = `<tr class="bh"><td>Ingresos</td><td class="n hd">Total</td>` + R.map(l => `<td class="n hd">${R.length > 1 ? esc(l.name) : ""}</td>`).join("") + "</tr>";
  payNames(false).forEach(pg => { const v = shop.filter(x => x.payment === pg); h += row("Caja diaria – " + pg, sum(v), R.map(l => sum(v.filter(x => x.shop_id === l.id)))) });
  const subtot = sum(shop);
  h += row("Subtotal caja diaria", subtot, R.map(l => sum(shop.filter(x => x.shop_id === l.id))), "bs");
  const may = sum(mayS);
  if (shops.some(s => s.kind === "wholesale")) h += row("Ventas mayoristas", may);
  h += row("Total ingresos", subtot + may, null, "bs");
  bc.push(["EGRESOS", "", ...R.map(() => "")]);
  h += `<tr class="bh"><td>Egresos</td><td></td>` + R.map(() => "<td></td>").join("") + "</tr>";
  const prov = bexp.filter(x => x.kind === "supplier"), imp = bexp.filter(x => x.kind === "tax"), ret = bexp.filter(x => x.kind === "withdrawal");
  h += row("Proveedores", sum(prov), R.map(l => sum(prov.filter(x => x.shop_id === l.id))));
  h += row("Impuestos", sum(imp));
  const eg = sum(prov) + sum(imp);
  h += row("Total egresos", eg, null, "bs");
  h += row("Balance (ingresos – egresos)", subtot + may - eg, null, "bh");
  h += row("Retiros de caja (no se descuentan del balance)", sum(ret), R.map(l => sum(ret.filter(x => x.shop_id === l.id))));
  balCsv = bc; $("btabla").className = "bt"; $("btabla").innerHTML = h;
  const pc = {}; mayS.forEach(x => { const k = x.client_name || "Sin cliente"; pc[k] = (pc[k] || 0) + num(x.amount) });
  const ks = Object.keys(pc).sort((a, b) => pc[b] - pc[a]);
  $("bclicard").hidden = !shops.some(s => s.kind === "wholesale");
  const t = $("bcli"); t.innerHTML = "";
  if (!ks.length) emptyRow(t, "Sin ventas mayoristas este mes");
  ks.forEach(k => { const tr = document.createElement("tr"); tr.append(td(k), td(fmt(pc[k]), "n")); t.appendChild(tr) });
}

// ---------------------------------------------------------------
// Ajustes
// ---------------------------------------------------------------
let punit = "Unidad";
function renderSettings() {
  $("cbiz").value = biz.name; $("pie").value = biz.ticket_footer || "";
  chips($("anchos"), ["58 mm", "80 mm"], () => anchoTxt, v => { anchoTxt = v; store.set("ancho", v); aplicarAncho() });
  if (!isMgr()) return;
  // Locales
  const cs = $("cshops"); cs.innerHTML = "";
  shops.forEach(s => {
    const r = document.createElement("div"); r.className = "item";
    const name = document.createElement("span"); name.className = "name"; name.textContent = s.name;
    const pill = document.createElement("span"); pill.className = "pill" + (s.active ? "" : " off"); pill.textContent = s.kind === "wholesale" ? "Mayorista" : s.active ? "Activo" : "Inactivo"; name.appendChild(pill);
    const ren = document.createElement("button"); ren.type = "button"; ren.className = "chip camb"; ren.textContent = "Renombrar";
    ren.onclick = async () => { const v = await ask("Nuevo nombre para " + s.name, "text", s.name); if (v && v.trim()) upd("shops", s.id, { name: v.trim() }) };
    const tog = document.createElement("button"); tog.type = "button"; tog.className = "chip camb"; tog.textContent = s.active ? "Desactivar" : "Activar";
    tog.onclick = () => { if (s.active && activeShops().length === 1) return aviso("Tiene que quedar al menos un local activo."); upd("shops", s.id, { active: !s.active }) };
    r.append(name, ren, tog); cs.appendChild(r);
  });
  // Medios de pago
  const cp = $("cpays"); cp.innerHTML = "";
  pays.forEach(p => {
    const r = document.createElement("div"); r.className = "item";
    const name = document.createElement("span"); name.className = "name"; name.textContent = p.name;
    const pill = document.createElement("span"); pill.className = "pill" + (p.active ? "" : " off"); pill.textContent = p.active ? "Activo" : "Inactivo"; name.appendChild(pill);
    const tog = document.createElement("button"); tog.type = "button"; tog.className = "chip camb"; tog.textContent = p.active ? "Desactivar" : "Activar";
    tog.onclick = () => { if (p.active && pays.filter(x => x.active).length === 1) return aviso("Tiene que quedar al menos un medio de pago."); upd("payment_methods", p.id, { active: !p.active }) };
    r.append(name, tog);
    if (shops.some(s => s.kind === "wholesale")) {
      const wh = document.createElement("button"); wh.type = "button"; wh.className = "chip camb"; wh.textContent = p.wholesale ? "En mayorista: sí" : "En mayorista: no";
      wh.onclick = () => upd("payment_methods", p.id, { wholesale: !p.wholesale }); r.appendChild(wh);
    }
    cp.appendChild(r);
  });
  // Equipo
  const tt = $("cteam"); tt.innerHTML = "";
  members.forEach(m => {
    const tr = document.createElement("tr");
    const nm = td((m.display_name || "Sin nombre") + (m.user_id === user.id ? " (vos)" : ""));
    const rl = td(({ owner: "Dueño", admin: "Administrador", cashier: "Cajero" })[m.role], "n");
    const c3 = td();
    if (role === "owner" && m.user_id !== user.id) {
      const sw = document.createElement("button"); sw.type = "button"; sw.className = "chip camb"; sw.textContent = m.role === "admin" ? "Pasar a cajero" : "Pasar a admin";
      sw.onclick = async () => { const { error } = await sb.from("members").update({ role: m.role === "admin" ? "cashier" : "admin" }).eq("business_id", biz.id).eq("user_id", m.user_id); error ? aviso(errMsg(error)) : reloadRefs() };
      c3.append(sw, delBtn(async () => {
        if (!await ask("¿Sacar a " + (m.display_name || "esta persona") + " del negocio? Sus ventas quedan guardadas.")) return;
        const { error } = await sb.from("members").delete().eq("business_id", biz.id).eq("user_id", m.user_id); error ? aviso(errMsg(error)) : reloadRefs();
      }, "Sacar del equipo"));
    }
    tr.append(nm, rl, c3); tt.appendChild(tr);
  });
  cargarInvites(); cargarAdmin(); renderPlan();
  // Productos
  chips($("pu"), ["Unidad", "Kilo"], () => punit, v => punit = v);
  renderCatalog();
}
async function upd(table, id, patch) {
  const { error } = await sb.from(table).update(patch).eq("id", id);
  if (error) return aviso(errMsg(error));
  reloadRefs();
}
async function reloadRefs() { await loadRefs(biz.id); startApp() }
async function cargarInvites() {
  const { data } = await sb.from("invites").select("*").eq("business_id", biz.id).is("used_by", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
  const box = $("cinvites"); box.innerHTML = "";
  (data || []).forEach(inv => {
    const r = document.createElement("div"); r.className = "item";
    const c = document.createElement("span"); c.className = "code"; c.textContent = inv.code;
    const d = document.createElement("span"); d.className = "mu"; d.style.flex = "1 1 120px"; d.textContent = (inv.role === "admin" ? "Administrador" : "Cajero") + " · vence " + new Date(inv.expires_at).toLocaleDateString("es-AR");
    const cp = document.createElement("button"); cp.type = "button"; cp.className = "chip camb"; cp.textContent = "Copiar";
    cp.onclick = async () => { const msg = `Te invito a la caja de ${biz.name}. Entrá a ${location.origin + location.pathname}, creá tu cuenta y usá el código ${inv.code}`; try { await navigator.clipboard.writeText(msg); toast("Invitación copiada") } catch (e) { aviso(msg) } };
    r.append(c, d, cp, delBtn(async () => { await sb.from("invites").delete().eq("code", inv.code); cargarInvites() }, "Anular código"));
    box.appendChild(r);
  });
}
// Administración de la app: códigos de alta y negocios. Solo para los administradores de la plataforma.
async function cargarAdmin() {
  const { data: soy } = await sb.rpc("is_platform_admin");
  $("adminCard").hidden = !soy; if (!soy) return;
  const [ov, uc, cs] = await Promise.all([sb.rpc("admin_overview"), sb.rpc("admin_user_count"),
    sb.from("signup_codes").select("*").is("used_by", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })]);
  const negocios = ov.data || [];
  const activos = negocios.filter(b => b.plan === "active").length;
  const pl = (n, uno, varios) => n + " " + (n === 1 ? uno : varios);
  $("adminStats").textContent = `${pl(uc.data ?? 0, "usuario", "usuarios")} · ${pl(negocios.length, "negocio", "negocios")} · ${activos} pagando`;
  const { data: ps } = await sb.from("platform_settings").select("*").eq("id", 1).single();
  if (ps) { $("admSlots").value = ps.founder_slots; $("admFounder").value = ps.founder_price; $("admRegular").value = ps.regular_price }
  const box = $("adminCodes"); box.innerHTML = "";
  (cs.data || []).forEach(sc => {
    const r = document.createElement("div"); r.className = "item";
    const c = document.createElement("span"); c.className = "code"; c.textContent = sc.code;
    const d = document.createElement("span"); d.className = "mu"; d.style.flex = "1 1 120px"; d.textContent = (sc.note ? sc.note + " · " : "") + "vence " + new Date(sc.expires_at).toLocaleDateString("es-AR");
    const cp = document.createElement("button"); cp.type = "button"; cp.className = "chip camb"; cp.textContent = "Copiar";
    cp.onclick = async () => { const msg = `Tu código de alta para la caja es ${sc.code}. Entrá a ${location.origin + location.pathname}, tocá "Crear cuenta" y después "Crear mi negocio". Tenés 7 días de prueba gratis.`; try { await navigator.clipboard.writeText(msg); toast("Mensaje copiado") } catch (e) { aviso(msg) } };
    r.append(c, d, cp, delBtn(async () => { await sb.from("signup_codes").delete().eq("code", sc.code); cargarAdmin() }, "Anular código"));
    box.appendChild(r);
  });
  const t = $("adminBiz"); t.innerHTML = "";
  if (!negocios.length) { t.innerHTML = '<div class="mu" style="padding:10px 0">Todavía no hay negocios</div>'; return }
  negocios.forEach(b => {
    const dias = Math.ceil((new Date(b.trial_ends_at) - Date.now()) / 864e5);
    const pagaHasta = b.paid_until && new Date(b.paid_until) > Date.now();
    const estado = b.plan === "free" ? "Gratis" : b.plan === "active" && pagaHasta ? "Pagando " + fmt(b.price)
      : b.plan === "paused" && pagaHasta ? "Canceló (usa hasta " + new Date(b.paid_until).toLocaleDateString("es-AR") + ")"
      : dias > 0 ? `Prueba: ${dias} día${dias === 1 ? "" : "s"}` : "Vencido";
    const r = document.createElement("div"); r.className = "item"; r.style.display = "block";
    const n = document.createElement("div"); n.style.fontWeight = "600"; n.textContent = b.name;
    const d = document.createElement("div"); d.className = "mu"; d.textContent = `${b.owner_email || ""} · ${estado} · ${b.sales_30d} ventas en 30 días`;
    const g = document.createElement("button"); g.type = "button"; g.className = "linkbtn"; g.style.padding = "4px 0";
    g.textContent = b.plan === "free" ? "Quitar acceso gratis" : "Dar acceso gratis";
    g.onclick = async () => {
      if (!await ask((b.plan === "free" ? "¿Quitarle el acceso gratis a " : "¿Darle acceso gratis, sin pagar, a ") + b.name + "?")) return;
      const { error } = await sb.rpc("admin_set_free", { p_business: b.business_id, p_free: b.plan !== "free" });
      if (error) return aviso(errMsg(error));
      toast("Listo"); if (b.business_id === biz.id) reloadRefs(); else cargarAdmin();
    };
    r.append(n, d, g); t.appendChild(r);
  });
}
async function invitar(rol) {
  const { error } = await sb.from("invites").insert({ business_id: biz.id, role: rol });
  if (error) return aviso(errMsg(error));
  toast("Código creado"); cargarInvites();
}
function renderCatalog() {
  const f = $("pf").value.trim().toLowerCase(), t = $("plist2");
  const list = catalog.filter(p => p.name.toLowerCase().includes(f));
  if (!list.length) return emptyRow(t, "Sin productos");
  t.innerHTML = "";
  list.forEach(p => {
    const tr = document.createElement("tr");
    const c2 = td(fmt(p.price) + (p.unit === "kg" ? " /kg" : "") + " ✎", "n"); c2.style.cursor = "pointer"; c2.title = "Cambiar precio";
    c2.onclick = async () => { const v = parseFloat(await ask("Nuevo precio de " + p.name, true, p.price)); if (v > 0) upd("products", p.id, { price: v }) };
    const cs = td((hayStock(p) ? fmtStock(p) : "—") + " ✎", "n"); cs.style.cursor = "pointer"; cs.title = "Cambiar stock";
    if (hayStock(p) && num(p.stock) <= 0) cs.classList.add("sin-stock");
    cs.onclick = async () => {
      const r = await ask("Stock de " + p.name + (p.unit === "kg" ? " (en kilos)" : " (unidades)") + ". Escribí la cantidad que hay, o +10 para sumar lo que llegó. Vacío = no controlar.", "text", hayStock(p) ? String(num(p.stock)) : "");
      if (r === null) return;
      const t = String(r).trim().replace(",", ".");
      if (t === "") return upd("products", p.id, { stock: null });
      const v = parseFloat(t); if (isNaN(v)) return aviso("Escribí un número, por ejemplo 12 o +10.");
      upd("products", p.id, { stock: /^\+/.test(t) && hayStock(p) ? num(p.stock) + v : v });
    };
    const c3 = td(); c3.appendChild(delBtn(async () => { if (await ask("¿Borrar " + p.name + "?")) { const { error } = await sb.from("products").delete().eq("id", p.id); error ? aviso(errMsg(error)) : reloadRefs() } }));
    tr.append(td(p.name + (p.code ? " · " + p.code : "")), c2, cs, c3); t.appendChild(tr);
  });
}

// ---------------------------------------------------------------
// Escáner de código de barras
// ---------------------------------------------------------------
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];
let detectorP = null;
// Usa el lector del navegador si existe (Chrome en Android); si no, uno propio que funciona en iPhone y computadoras.
function getDetector() {
  if (detectorP) return detectorP;
  detectorP = (async () => {
    if ("BarcodeDetector" in window) {
      try {
        const ok = await window.BarcodeDetector.getSupportedFormats();
        const f = FORMATS.filter(x => ok.includes(x));
        if (f.includes("ean_13")) return new window.BarcodeDetector({ formats: f });
      } catch (e) { }
    }
    if (!window.BarcodeDetectionAPI) await new Promise((res, rej) => {
      const sc = document.createElement("script"); sc.src = "vendor/barcode-detector/ponyfill.js"; sc.onload = res; sc.onerror = rej; document.head.appendChild(sc);
    });
    const api = window.BarcodeDetectionAPI;
    const wasm = new URL("vendor/barcode-detector/zxing_reader.wasm", location.href).href;
    api.prepareZXingModule({ overrides: { locateFile: (path, prefix) => path.endsWith(".wasm") ? wasm : prefix + path } });
    return new api.BarcodeDetector({ formats: FORMATS });
  })();
  detectorP.catch(() => { detectorP = null });
  return detectorP;
}
function escanear(cb) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return aviso("Este navegador no deja usar la cámara. Usá un lector de mano o escribí el código.");
  const ov = document.createElement("div"); ov.className = "scan";
  ov.innerHTML = '<div class="scan-view"><video playsinline muted autoplay></video><div class="scan-frame"></div></div><div class="scan-msg">Abriendo la cámara…</div>';
  const v = ov.querySelector("video"), msg = ov.querySelector(".scan-msg");
  const c = document.createElement("button"); c.type = "button"; c.className = "btn"; c.style.cssText = "width:auto;padding:12px 28px;margin:0"; c.textContent = "Cancelar";
  ov.appendChild(c); document.body.appendChild(ov);
  const cv = document.createElement("canvas"), ctx = cv.getContext("2d", { willReadFrequently: true });
  let stream, done = false, busy = false, timer;
  const stop = () => { done = true; clearInterval(timer); if (stream) stream.getTracks().forEach(t => t.stop()); ov.remove() };
  c.onclick = stop;
  Promise.all([
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
    getDetector()
  ]).then(async ([st, det]) => {
    if (done) { st.getTracks().forEach(t => t.stop()); return }
    stream = st; v.srcObject = st; try { await v.play() } catch (e) { }
    msg.textContent = "Apuntá al código de barras";
    timer = setInterval(async () => {
      if (busy || done || !v.videoWidth) return;
      busy = true;
      try {
        cv.width = v.videoWidth; cv.height = v.videoHeight; ctx.drawImage(v, 0, 0);
        const r = await det.detect(cv);
        if (r.length && !done) { const val = r[0].rawValue; if (navigator.vibrate) navigator.vibrate(80); stop(); cb(val) }
      } catch (e) { }
      busy = false;
    }, 250);
  }).catch(e => {
    stop();
    aviso(e && e.name === "NotAllowedError" ? "No hay permiso para usar la cámara. Activalo en la configuración del navegador para esta página."
      : e && e.name === "NotFoundError" ? "No encontramos una cámara en este dispositivo."
        : "No se pudo abrir el escáner. Revisá la conexión y probá de nuevo.");
  });
}
// Un código que no está cargado: el dueño puede darlo de alta en el momento.
async function codigoNuevo(code) {
  if (!isMgr()) { $("res").innerHTML = '<div class="mu" style="margin-top:6px">No hay un producto con el código ' + code.replace(/\D/g, "") + '. Pedile al dueño que lo cargue.</div>'; return }
  const name = await ask("El código " + code + " no está cargado. ¿Cómo se llama el producto?", "text", "");
  if (!name || !name.trim()) return;
  const price = parseFloat(await ask("Precio de " + name.trim() + " ($ por unidad)", true, ""));
  if (!(price > 0)) return;
  const { data, error } = await sb.from("products").insert({ business_id: biz.id, name: name.trim(), price, unit: "u", code }).select().single();
  if (error) return aviso(errMsg(error));
  catalog.push(data); catalog.sort((a, b) => a.name.localeCompare(b.name)); renderCatalog();
  addProd(data); toast("Producto agregado");
}

// ---------------------------------------------------------------
// Navegación y eventos
// ---------------------------------------------------------------
let tab = "venta", channel = null;
function refresh() {
  if (tab === "resumen") cargarResumen();
  else if (tab === "prov") cargarProv();
  else if (tab === "apertura") cargarAper();
  else if (tab === "balance") cargarBal();
}
function goTab(t) {
  tab = t;
  $$("#tabs .tab").forEach(x => { const on = x.dataset.t === t; x.classList.toggle("on", on); x.setAttribute("aria-current", on ? "page" : "false") });
  ["venta", "resumen", "apertura", "prov", "balance"].forEach(s => $(s).hidden = s !== t);
  if (t === "apertura") renderALocales();
  if (t === "prov") renderPTipo();
  refresh(); window.scrollTo({ top: 0 });
}
// Ajustes es una pantalla aparte: tapa la caja y las pestañas hasta que se vuelve.
let scrollCaja = 0;
function mostrarAjustes(on) {
  if (on) scrollCaja = window.scrollY;
  $("cfgbox").hidden = !on; $("screen-app").classList.toggle("en-ajustes", on);
  $("cfg").setAttribute("aria-expanded", String(on));
  window.scrollTo({ top: on ? 0 : scrollCaja });
}
function abrirAjustes() { history.pushState({ ajustes: true }, ""); mostrarAjustes(true) }
function cerrarAjustes() { if (history.state && history.state.ajustes) history.back(); else mostrarAjustes(false) }
function wireOnce() {
  document.querySelectorAll("input[type=number]").forEach(i => i.addEventListener("wheel", () => i.blur()));
  $("monto").oninput = calc; $("paga").oninput = calc;
  $("enviar").onclick = anotarVenta; $("undo").onclick = deshacer; $("imp").onclick = () => { if (last) printTicket(last) };
  $("busq").oninput = renderResults; $("busq").onkeydown = e => { if (e.key === "Enter") enterBusq() };
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) { $("bcam").hidden = false; $("pcam").hidden = false }
  // Lector de mano (USB/Bluetooth): escribe muy rápido y termina con Enter. Si no hay un campo enfocado, va al buscador.
  let burst = "", lastKey = 0;
  document.addEventListener("keydown", e => {
    if (tab !== "venta" || $("prodwrap").hidden || document.querySelector(".ov,.scan")) return;
    const el = document.activeElement, typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
    if (typing) return;
    const now = Date.now(); if (now - lastKey > 80) burst = ""; lastKey = now;
    if (/^[0-9A-Za-z]$/.test(e.key)) burst += e.key;
    else if (e.key === "Enter" && burst.length >= 6) { e.preventDefault(); $("busq").value = burst; burst = ""; enterBusq() }
  });
  $("bcam").onclick = () => escanear(v => { $("busq").value = v; enterBusq() });
  $("pcam").onclick = () => escanear(v => { $("pc").value = v });
  $("cbus").oninput = () => { syncCli(); listaClis(false) };
  $("cbtn").onclick = () => { if (!$("cres").hidden) $("cres").hidden = true; else listaClis(true) };
  $("madd").onclick = async () => {
    const n = $("mnuevo").value.trim(); if (!n) return;
    if (!clientes.some(c => c.name === n)) {
      const { data, error } = await sb.from("clients").insert({ business_id: biz.id, name: n }).select().single();
      if (error) return aviso(errMsg(error));
      clientes.push(data); clientes.sort((a, b) => a.name.localeCompare(b.name));
    }
    $("cbus").value = n; $("mnuevo").value = ""; syncCli();
  };
  $("mnuevo").onkeydown = e => { if (e.key === "Enter") $("madd").click() };
  $("mdel").onclick = async () => {
    const c = clientes.find(x => x.name === mcli);
    if (c && await ask("¿Quitar a " + mcli + " de la lista?")) {
      const { error } = await sb.from("clients").delete().eq("id", c.id);
      if (error) return aviso(errMsg(error));
      clientes = clientes.filter(x => x.id !== c.id); $("cbus").value = ""; syncCli();
    }
  };
  dateField("vfecha", "date", chkFecha);
  dateField("dia", "date", cargarResumen);
  dateField("adia", "date", cargarAper);
  dateField("pdia", "date", cargarProv);
  dateField("bmes", "month", cargarBal);
  $("csv").onclick = () => downloadCsv("ventas-" + (isoF("dia") || hoy()) + ".csv",
    [["Fecha", "Hora", "Local", "Cliente", "Medio de pago", "Monto"]].concat(ventas.slice().reverse().map(v => [toAR(v.day), hora(v.created_at), shopName(v.shop_id), v.client_name || "", v.payment, num(v.amount)])));
  $("aenviar").onclick = guardarAper;
  chips($("ptipos"), Object.keys(TIPOS), () => ptipo, v => { ptipo = v; renderPTipo() });
  $("penviar").onclick = anotarPago;
  $("pbus").oninput = () => { syncProv(); listaProvs(false) };
  $("pbtn").onclick = () => { if (!$("pres").hidden) $("pres").hidden = true; else listaProvs(true) };
  $("padd2").onclick = async () => {
    const n = $("pnuevo").value.trim(); if (!n) return;
    if (!provs.some(c => c.name === n)) {
      const { data, error } = await sb.from("providers").insert({ business_id: biz.id, name: n }).select().single();
      if (error) return aviso(errMsg(error));
      provs.push(data); provs.sort((a, b) => a.name.localeCompare(b.name));
    }
    $("pbus").value = n; $("pnuevo").value = ""; syncProv();
  };
  $("pnuevo").onkeydown = e => { if (e.key === "Enter") $("padd2").click() };
  $("pdel").onclick = async () => {
    const c = provs.find(x => x.name === pprov);
    if (c && await ask("¿Quitar a " + pprov + " de la lista?")) {
      const { error } = await sb.from("providers").delete().eq("id", c.id);
      if (error) return aviso(errMsg(error));
      provs = provs.filter(x => x.id !== c.id); $("pbus").value = ""; syncProv();
    }
  };
  $("bdl1").onclick = () => downloadCsv("balance-" + monthRange()[0] + ".csv", balCsv);
  $("bdl2").onclick = () => {
    const f = [["Tipo", "Fecha", "Hora", "Local", "Cliente / Proveedor / Detalle", "Medio de pago", "Monto", "Productos"]];
    bsales.slice().sort((a, b) => a.created_at < b.created_at ? -1 : 1).forEach(v => f.push(["Venta", toAR(v.day), hora(v.created_at), shopName(v.shop_id), v.client_name || "", v.payment, num(v.amount), (v.items || []).map(i => i.name).join(", ")]));
    bexp.forEach(v => f.push([{ supplier: "Proveedor", tax: "Impuestos", withdrawal: "Retiro de caja" }[v.kind], toAR(v.day), "", v.shop_id ? shopName(v.shop_id) : "General", v.name || "", v.payment || "", num(v.amount), ""]));
    downloadCsv("copia-seguridad-" + monthRange()[0] + ".csv", f);
  };
  $$("#tabs .tab").forEach(b => b.onclick = () => goTab(b.dataset.t));
  $("cfg").onclick = () => $("cfgbox").hidden ? abrirAjustes() : cerrarAjustes();
  $("cfgBack").onclick = cerrarAjustes;
  // El botón "atrás" del celular cierra Ajustes en vez de salir de la app.
  window.addEventListener("popstate", () => { if (!$("cfgbox").hidden) mostrarAjustes(false) });
  $("cbizSave").onclick = async () => {
    const name = $("cbiz").value.trim(); if (!name) return aviso("Escribí el nombre del negocio.");
    const { error } = await sb.from("businesses").update({ name }).eq("id", biz.id);
    if (error) return aviso(errMsg(error));
    toast("Guardado"); reloadRefs();
  };
  $("pieSave").onclick = async () => {
    const { error } = await sb.from("businesses").update({ ticket_footer: $("pie").value.trim() }).eq("id", biz.id);
    if (error) return aviso(errMsg(error));
    toast("Mensaje guardado"); reloadRefs();
  };
  $("cshopAdd").onclick = async () => {
    const n = $("cshopNew").value.trim(); if (!n) return;
    const { error } = await sb.from("shops").insert({ business_id: biz.id, name: n, kind: "retail", position: shops.length + 1 });
    if (error) return aviso(errMsg(error));
    $("cshopNew").value = ""; reloadRefs();
  };
  $("cpayAdd").onclick = async () => {
    const n = $("cpayNew").value.trim(); if (!n) return;
    const { error } = await sb.from("payment_methods").insert({ business_id: biz.id, name: n, position: pays.length + 1 });
    if (error) return aviso(errMsg(error));
    $("cpayNew").value = ""; reloadRefs();
  };
  $("planBtn").onclick = suscribir; $("planCancel").onclick = cancelarSuscripcion;
  $("admPrecios").onclick = async () => {
    const v = { founder_slots: parseInt($("admSlots").value), founder_price: parseFloat($("admFounder").value), regular_price: parseFloat($("admRegular").value) };
    if (!(v.founder_slots >= 0 && v.founder_price > 0 && v.regular_price > 0)) return aviso("Revisá los precios.");
    const { error } = await sb.from("platform_settings").update(v).eq("id", 1);
    error ? aviso(errMsg(error)) : toast("Precios guardados");
  };
  $("adminNew").onclick = async () => {
    const { error } = await sb.from("signup_codes").insert({ note: $("adminNote").value.trim() });
    if (error) return aviso(errMsg(error));
    $("adminNote").value = ""; toast("Código de alta creado"); cargarAdmin();
  };
  $("invCashier").onclick = () => invitar("cashier");
  $("invAdmin").onclick = () => invitar("admin");
  $("pf").oninput = renderCatalog;
  $("pp").addEventListener("wheel", () => $("pp").blur());
  $("padd").onclick = async () => {
    const name = $("pn").value.trim(), price = parseFloat($("pp").value), code = $("pc").value.trim(), st = $("ps").value.trim();
    if (!name || !(price > 0)) return say("pm2", "Escribí el nombre y el precio.", true);
    const { error } = await sb.from("products").insert({ business_id: biz.id, name, price, unit: punit === "Kilo" ? "kg" : "u", code, stock: st === "" ? null : parseFloat(st) });
    if (error) return say("pm2", errMsg(error), true);
    $("pn").value = ""; $("pp").value = ""; $("pc").value = ""; $("ps").value = ""; say("pm2", "✓ Producto agregado"); reloadRefs();
  };
  aplicarAncho();
  // Actualización en vivo del resumen cuando otro dispositivo anota algo
  if (isMgr() && sb.channel) {
    let t = null;
    const bump = () => { clearTimeout(t); t = setTimeout(refresh, 400) };
    channel = sb.channel("caja-" + biz.id);
    ["sales", "expenses", "openings"].forEach(tb => channel.on("postgres_changes", { event: "*", schema: "public", table: tb, filter: "business_id=eq." + biz.id }, bump));
    channel.subscribe();
  }
}

// ---------------------------------------------------------------
// Arranque
// ---------------------------------------------------------------
async function boot() {
  if (window.__SB__) sb = window.__SB__;
  else {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      document.body.innerHTML = '<div class="center"><div class="panel card"><h1 class="card-title">Falta configurar la base de datos</h1><p>Completá <code>js/config.js</code> con los datos de tu proyecto de Supabase. Los pasos están en el README.</p></div></div>';
      return;
    }
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm");
    sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  }
  const { data } = await sb.auth.getSession();
  user = data.session && data.session.user;
  if (user) await enter(); else show("auth");
  sb.auth.onAuthStateChange(async (ev, session) => {
    if (ev === "PASSWORD_RECOVERY") {
      const p = await ask("Escribí tu nueva contraseña (mínimo 8 caracteres)", "text", "");
      if (p && p.length >= 8) { const { error } = await sb.auth.updateUser({ password: p }); aviso(error ? errMsg(error) : "Contraseña cambiada.") }
    }
    const u = session && session.user;
    if (u && (!user || u.id !== user.id)) { user = u; await enter() }
    if (!u && user) { user = null; show("auth") }
  });
}
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => { });
boot();
