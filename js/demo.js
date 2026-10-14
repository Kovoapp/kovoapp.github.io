// Demo de Kovo (app/?demo o app/?demo=kiosco): la caja con un negocio de ejemplo, sin cuenta y sin servidor.
// Todo vive en memoria (js/memoria.js): al cerrar la pestaña se pierde y no toca los datos de nadie.
(() => {
  const NEGOCIOS = {
    almacen: ["Almacén La Esquina", [
      ["Yerba 1 kg", 4200, "u", 3000, 4], ["Fideos guiseros 500 g", 1300, "u", 850, 40], ["Arroz largo fino 1 kg", 1900, "u", 1250, 30],
      ["Leche entera 1 l", 1500, "u", 1050, 24], ["Aceite girasol 900 ml", 3100, "u", 2300, 18], ["Azúcar 1 kg", 1400, "u", 950, 25],
      ["Galletitas de agua", 1100, "u", 700, 0], ["Gaseosa cola 1,5 l", 2800, "u", 1900, 36], ["Queso cremoso", 9800, "kg", 6900, 6],
      ["Jamón cocido", 14000, "kg", 9800, 3], ["Pan francés", 2600, "kg", 1500, null], ["Huevos x 12", 3600, "u", 2700, 15]]],
    kiosco: ["Kiosco La Parada", [
      ["Alfajor triple", 1200, "u", 780, 0], ["Gaseosa 500 ml", 1800, "u", 1150, 48], ["Agua mineral 500 ml", 1200, "u", 700, 40],
      ["Chicles menta", 600, "u", 350, 60], ["Turrón", 400, "u", 230, 3], ["Caramelos x 10", 500, "u", 280, 80],
      ["Papas fritas 80 g", 2100, "u", 1400, 22], ["Barrita de cereal", 900, "u", 560, 30], ["Chocolate 25 g", 1500, "u", 980, 26],
      ["Energizante 473 ml", 3200, "u", 2200, 12], ["Galletitas rellenas", 1400, "u", 900, 20], ["Pañuelitos", 700, "u", 420, 4]]],
    dietetica: ["Dietética Natural", [
      ["Almendras", 16000, "kg", 11500, 1.5], ["Nueces mariposa", 18500, "kg", 13200, 4], ["Avena arrollada", 3200, "kg", 1900, 12],
      ["Pasas de uva", 7500, "kg", 5100, 6], ["Maní pelado", 5200, "kg", 3400, 9], ["Semillas de chía", 9800, "kg", 6600, 3],
      ["Mix frutos secos", 14500, "kg", 10100, 0], ["Harina integral", 2100, "kg", 1300, 20], ["Granola", 8900, "kg", 5900, 7],
      ["Miel 500 g", 6500, "u", 4500, 14], ["Té verde x 20", 2900, "u", 1900, 10], ["Arroz integral", 3400, "kg", 2200, 15]]],
    verduleria: ["Verdulería El Puesto", [
      ["Papa", 900, "kg", 520, 40], ["Tomate redondo", 2400, "kg", 1500, 3], ["Cebolla", 1100, "kg", 650, 25],
      ["Lechuga", 1000, "u", 550, 12], ["Banana", 2200, "kg", 1450, 18], ["Manzana roja", 2600, "kg", 1700, 14],
      ["Zanahoria", 1200, "kg", 700, 0], ["Zapallo anco", 1500, "kg", 850, 20], ["Naranja", 1600, "kg", 950, 30],
      ["Limón", 2000, "kg", 1200, 8], ["Morrón rojo", 5200, "kg", 3400, 4], ["Huevos x 12", 3600, "u", 2700, 10]]],
    carniceria: ["Carnicería Los Hermanos", [
      ["Asado", 11500, "kg", 8200, 25], ["Vacío", 13900, "kg", 9900, 2], ["Milanesa de nalga", 14500, "kg", 10200, 12],
      ["Carne picada común", 7800, "kg", 5400, 15], ["Bife de chorizo", 15900, "kg", 11400, 9], ["Matambre", 13200, "kg", 9400, 0],
      ["Pollo entero", 4300, "kg", 3000, 20], ["Pechuga", 7900, "kg", 5600, 8], ["Chorizo", 8200, "kg", 5600, 10],
      ["Morcilla", 6200, "kg", 4100, 6], ["Costilla de cerdo", 9200, "kg", 6500, 7], ["Achuras (molleja)", 16500, "kg", 11800, 3]]],
  };
  const PAGOS = ["Efectivo", "Transferencia", "QR", "Posnet"];

  const rubro = new URLSearchParams(location.search).get("demo");
  const [nombre, productos] = NEGOCIOS[rubro] || NEGOCIOS.almacen;

  // Nada de lo que hace la demo queda guardado en el navegador.
  const guardado = {};
  try {
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: k => (k in guardado ? guardado[k] : null), setItem: (k, v) => { guardado[k] = String(v) }, removeItem: k => { delete guardado[k] }
    } });
  } catch (e) { }

  const user = { id: "u-demo", email: "demo@kovo" };
  const sb = window.crearMemoria({ session: { user } }), db = sb.__db;
  const id = () => crypto.randomUUID(), dia = d => { const x = new Date(); x.setDate(x.getDate() - d); return x };
  const iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  let semilla = 7; const azar = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647;

  const b = id();
  db.businesses.push({ id: b, name: nombre, ticket_footer: "¡Gracias por su compra!", plan: "free", trial_ends_at: dia(-7).toISOString(), created_at: dia(60).toISOString(), created_by: user.id, fiado: true });
  db.members.push({ business_id: b, user_id: user.id, role: "owner", display_name: "Demo", created_at: dia(60).toISOString() });
  const local = id();
  db.shops.push({ id: local, business_id: b, name: "Local", kind: "retail", position: 1, active: true });
  PAGOS.forEach((p, i) => db.payment_methods.push({ id: id(), business_id: b, name: p, position: i + 1, active: true, wholesale: true }));
  const prods = productos.map(([name, price, unit, cost, stock], i) => {
    const p = { id: id(), business_id: b, name, price, unit, code: "77900000" + String(i + 10).padStart(5, "0"), stock, created_at: dia(60).toISOString() };
    db.products.push(p); db.product_costs.push({ product_id: p.id, business_id: b, cost });
    return p;
  });

  // Un mes de ventas: más los sábados, con los primeros productos como los más vendidos.
  for (let d = 30; d >= 0; d--) {
    const f = dia(d), n = d === 0 ? 9 : Math.round((f.getDay() === 6 ? 26 : f.getDay() === 0 ? 12 : 18) * (0.8 + azar() * 0.4));
    for (let k = 0; k < n; k++) {
      const hora = new Date(f); hora.setHours(9 + Math.floor(azar() * 11), Math.floor(azar() * 60), 0, 0);
      if (d === 0 && hora > new Date()) hora.setTime(Date.now() - (k + 1) * 9 * 60e3);
      const items = [], cuantos = 1 + Math.floor(azar() * 3);
      for (let j = 0; j < cuantos; j++) {
        const p = prods[Math.floor(Math.pow(azar(), 1.8) * prods.length)];
        if (items.some(x => x.id === p.id)) continue;
        items.push({ id: p.id, name: p.name, unit: p.unit, price: p.price, qty: p.unit === "kg" ? [250, 500, 750, 1000][Math.floor(azar() * 4)] : 1 + Math.floor(azar() * 2) });
      }
      const total = Math.round(items.reduce((a, i) => a + i.price * i.qty / (i.unit === "kg" ? 1000 : 1), 0));
      const s = { id: id(), business_id: b, shop_id: local, day: iso(f), created_at: hora.toISOString(), created_by: user.id, client_name: "", payment: PAGOS[Math.floor(Math.pow(azar(), 1.5) * PAGOS.length)], amount: total, paid_with: 0, items };
      db.sales.push(s);
      const costo = items.reduce((a, i) => a + i.qty * db.product_costs.find(c => c.product_id === i.id).cost / (i.unit === "kg" ? 1000 : 1), 0);
      db.sale_costs.push({ sale_id: s.id, business_id: b, day: s.day, base: total, cost: Math.round(costo) });
    }
    if (d % 7 === 3) db.expenses.push({ id: id(), business_id: b, shop_id: local, kind: "supplier", day: iso(f), amount: 85000 + Math.round(azar() * 40000), name: "Distribuidora del Sur", payment: "Transferencia", created_at: f.toISOString() });
  }
  db.openings.push({ business_id: b, shop_id: local, day: iso(dia(0)), amount: 20000, updated_at: new Date().toISOString() });
  // Fiado: tres clientes del barrio con su cuenta.
  [["Rosa (vecina)", [[9, 6400], [5, 3800], [2, 5200]], [[4, 6400, "Efectivo"]]],
   ["Don Julio", [[12, 12500], [6, 8300]], [[3, 10000, "Transferencia"]]],
   ["Marta", [[1, 4600]], []]].forEach(([nom, ventasF, pagosF]) => {
    const c = { id: id(), business_id: b, name: nom }; db.clients.push(c);
    ventasF.forEach(([d, amount]) => {
      const f = dia(d); f.setHours(18, 30, 0, 0); if (d === 0 && f > new Date()) f.setTime(Date.now() - 30 * 60e3);
      const s = { id: id(), business_id: b, shop_id: local, day: iso(f), created_at: f.toISOString(), created_by: user.id, client_name: nom, payment: "Fiado", amount, paid_with: 0, items: [] };
      db.sales.push(s);
      db.fiados.push({ id: id(), business_id: b, client_id: c.id, sale_id: s.id, kind: "fiado", amount, payment: null, shop_id: local, day: s.day, created_at: s.created_at, created_by: user.id });
    });
    pagosF.forEach(([d, amount, payment]) => { const f = dia(d); f.setHours(11, 0, 0, 0); db.fiados.push({ id: id(), business_id: b, client_id: c.id, sale_id: null, kind: "pago", amount, payment, shop_id: local, day: iso(f), created_at: f.toISOString(), created_by: user.id }) });
  });
  db.expenses.push({ id: id(), business_id: b, shop_id: local, kind: "withdrawal", day: iso(dia(0)), amount: 15000, name: "", payment: "Efectivo", created_at: new Date().toISOString() });

  // Sin cuenta no hay plan, ni panel, ni salir: en su lugar, un aviso para pedir la prueba.
  sb.auth.signOut = async () => { location.href = "../"; return { error: null } };
  window.__SB__ = sb;
  window.__DEMO__ = true;
  addEventListener("DOMContentLoaded", () => {
    document.documentElement.classList.add("demo");
    const a = document.createElement("div"); a.className = "demo-aviso";
    const t = document.createElement("span"); t.textContent = "Estás viendo una demo con datos de ejemplo. Probá vender, mirá el cierre y el balance: nada se guarda.";
    const l = document.createElement("a"); l.textContent = "Quiero probarlo en mi negocio";
    l.href = "./?registro";
    a.append(t, l); document.body.prepend(a);
  });
})();
