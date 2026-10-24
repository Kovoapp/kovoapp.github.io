// Página pública de turnos online: el cliente elige servicio, día y hora libre, y deja su nombre y WhatsApp.
// No tiene cuenta: todo pasa por las funciones de supabase/reservas.sql, que revisan cada pedido.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../app/js/config.js";

const $ = id => document.getElementById(id);
const fmt = n => "$" + Math.round(Number(n) || 0).toLocaleString("es-AR");
const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const fecha = s => new Date(s + "T12:00:00");
const aMin = h => { const [a, b] = h.split(":").map(Number); return a * 60 + b };
const aHora = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const largo = s => fecha(s).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
const ERR = {
  reserva_ocupado: "Ese horario se acaba de ocupar. Elegí otro.",
  reserva_horario: "Ese horario ya no está disponible. Elegí otro.",
  reserva_sin_nombre: "Escribí tu nombre.",
  reserva_sin_telefono: "Escribí tu WhatsApp con la característica, por ejemplo 3329 412345.",
  reserva_muchos: "Ya tenés dos turnos pedidos con este WhatsApp. Si necesitás otro, consultá con el negocio.",
  reserva_servicio: "Ese servicio ya no está disponible. Elegí otro.",
  reserva_cerrada: "El negocio pausó los turnos online. Consultá directamente con el negocio."
};
const errTxt = e => { const m = String((e && e.message) || e || ""); const k = Object.keys(ERR).find(k => m.includes(k)); return k ? ERR[k] : /fetch|network|load failed/i.test(m) ? "Sin conexión. Revisá internet y probá de nuevo." : "Algo salió mal. Probá de nuevo en un momento." };

const slug = new URLSearchParams(location.search).get("n") || (window.__DEMO__ ? "demo" : "");
let sb, info, servicio = null, dia = null, hora = null, pide = 0;

function chip(txt, on, fn, sub) {
  const b = document.createElement("button"); b.type = "button"; b.className = "chip" + (on ? " on" : ""); b.textContent = txt;
  if (sub) { const s = document.createElement("small"); s.textContent = sub; b.appendChild(s) }
  b.setAttribute("aria-pressed", String(!!on)); b.onclick = fn; return b;
}
function pintaServicios() {
  const box = $("rServ"); box.innerHTML = "";
  info.servicios.forEach(s => box.appendChild(chip(s.nombre, servicio === s.nombre, () => { servicio = s.nombre; pintaServicios(); resumen() }, fmt(s.precio))));
}
// Los próximos días que el negocio atiende (hasta dos meses, como mucho 21 días).
function dias() {
  const l = [], d = fecha(info.hoy);
  for (let i = 0; i <= 60 && l.length < 21; i++, d.setDate(d.getDate() + 1)) if (info.horario.dias.includes(d.getDay() || 7)) l.push(iso(d));
  return l;
}
function pintaDias() {
  const box = $("rDias"); box.innerHTML = "";
  dias().forEach(s => {
    const d = fecha(s), cab = s === info.hoy ? "Hoy" : d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", "");
    box.appendChild(chip(cab.charAt(0).toUpperCase() + cab.slice(1), dia === s, () => { dia = s; hora = null; pintaDias(); cargarHoras() }, d.getDate() + "/" + (d.getMonth() + 1)));
  });
}
async function cargarHoras() {
  const box = $("rHoras"), n = ++pide; box.innerHTML = '<div class="mu">Buscando horarios...</div>';
  const { data, error } = await sb.rpc("reservas_ocupado", { p_slug: slug, p_day: dia });
  if (n !== pide) return;
  box.innerHTML = "";
  if (error) { box.innerHTML = '<div class="mu"></div>'; box.firstChild.textContent = errTxt(error); return }
  const h = info.horario, ocup = data || [], ahora = new Date(), min = ahora.getHours() * 60 + ahora.getMinutes();
  const libres = [];
  for (let m = aMin(h.desde); m + h.minutos <= aMin(h.hasta); m += h.minutos) {
    if (dia === iso(ahora) && m <= min) continue;
    const n = ocup.filter(o => aMin(o.hora) < m + h.minutos && m < aMin(o.hora) + o.minutos).length;
    if (n < (h.lugares || 1)) libres.push(aHora(m));
  }
  if (!libres.length) { box.innerHTML = '<div class="mu">No quedan horarios libres este día. Probá con otro.</div>'; resumen(); return }
  libres.forEach(x => box.appendChild(chip(x, hora === x, () => { hora = x; cargarHorasPinta(); resumen() })));
  resumen();
}
function cargarHorasPinta() { [...$("rHoras").children].forEach(b => { const on = b.textContent === hora; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)) }) }
function resumen() {
  $("rResumen").textContent = dia && hora ? largo(dia).replace(/^./, c => c.toUpperCase()) + " a las " + hora + (servicio ? " · " + servicio : "") : "Elegí día y horario";
}
async function confirmar() {
  const cliente = $("rCli").value.trim(), tel = $("rTel").value.trim(), msg = $("rMsg");
  const di = t => { msg.classList.add("err"); msg.textContent = t };
  if (info.servicios.length && !servicio) return di("Elegí qué te querés hacer.");
  if (!dia || !hora) return di("Elegí el día y el horario.");
  if (!cliente) { $("rCli").focus(); return di(ERR.reserva_sin_nombre) }
  if (tel.replace(/\D/g, "").length < 8) { $("rTel").focus(); return di(ERR.reserva_sin_telefono) }
  $("rOk").disabled = true; msg.textContent = "";
  const { error } = await sb.rpc("reservar_turno", { p_slug: slug, p_day: dia, p_hora: hora, p_servicio: servicio || "", p_cliente: cliente, p_telefono: tel });
  $("rOk").disabled = false;
  if (error) { di(errTxt(error)); if (/ocupado|horario/.test(error.message || "")) { hora = null; cargarHoras() } return }
  $("rForm").hidden = true; $("rListo").hidden = false;
  $("rListoTit").textContent = "¡Listo, " + cliente.split(" ")[0] + "!";
  $("rListoTxt").textContent = "Tu turno en " + info.nombre + " es el " + largo(dia) + " a las " + hora + (servicio ? ", para " + servicio : "") + ".";
  window.scrollTo({ top: 0 });
}

async function boot() {
  if (window.__SB__) sb = window.__SB__;
  else { const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm"); sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } }) }
  $("rDemo").hidden = !window.__DEMO__;
  const { data, error } = slug ? await sb.rpc("reservas_info", { p_slug: slug }) : { data: null };
  $("rCarga").hidden = true;
  if (error && !data) { $("rCerrado").hidden = false; $("rCerrado").querySelector("p").textContent = errTxt(error); return }
  if (!data) { $("rCerrado").hidden = false; return }
  info = data;
  document.title = "Sacá tu turno en " + info.nombre;
  $("rNom").textContent = info.nombre; $("rSub").textContent = "Elegí el día y la hora, y listo.";
  const hayServ = info.servicios.length > 0;
  $("rServCard").hidden = !hayServ;
  $("rDiaTit").textContent = (hayServ ? "2" : "1") + ". Elegí el día y la hora";
  $("rDatTit").textContent = (hayServ ? "3" : "2") + ". Tus datos";
  $("rHoraTit").textContent = "Horarios libres";
  pintaServicios();
  dia = dias()[0] || null; pintaDias(); if (dia) cargarHoras();
  $("rForm").hidden = false;
  $("rOk").onclick = confirmar;
  ["rCli", "rTel"].forEach(id => $(id).addEventListener("input", () => { $("rMsg").textContent = "" }));
  $("rOtro").onclick = () => { hora = null; $("rListo").hidden = true; $("rForm").hidden = false; cargarHoras() };
}
boot();
