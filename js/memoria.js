// Cliente de Supabase falso, en memoria: lo usan las pruebas y la demo (app/?demo).
// No aplica permisos: eso se prueba aparte en supabase/tests.
window.crearMemoria = (opciones = {}) => {
  const uuid = () => crypto.randomUUID();
  const db = { businesses: [], members: [], shops: [], payment_methods: [], clients: [], providers: [], products: [], sales: [], expenses: [], openings: [], invites: [], product_costs: [], sale_costs: [], fiados: [], turnos: [], suggestions: [], platform_admins: [], platform_settings: [{ id: 1, founder_price: 15000, regular_price: 18000, founder_slots: 10 }], fn_calls: [],
    signup_codes: [{ code: "PRUEBA01", note: "", created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 864e5).toISOString(), used_by: null }] };
  let session = opciones.session || null; const listeners = [];
  const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") };
  const defaults = {
    businesses: () => ({ id: uuid(), ticket_footer: "¡Gracias por su compra!", plan: "trial", trial_ends_at: new Date(Date.now() + 7 * 864e5).toISOString(), created_at: new Date().toISOString() }),
    shops: () => ({ id: uuid(), kind: "retail", position: 0, active: true }),
    payment_methods: () => ({ id: uuid(), wholesale: true, position: 0, active: true }),
    clients: () => ({ id: uuid() }), providers: () => ({ id: uuid() }), products: () => ({ id: uuid(), code: "" }),
    sales: () => ({ id: uuid(), day: today(), created_at: new Date().toISOString(), client_name: "", paid_with: 0, items: [], created_by: session && session.user.id }),
    expenses: () => ({ id: uuid(), day: today(), created_at: new Date().toISOString(), name: "", payment: "" }),
    openings: () => ({}), product_costs: () => ({}), sale_costs: () => ({}),
    fiados: () => ({ id: uuid(), kind: "pago", day: today(), created_at: new Date().toISOString(), created_by: session && session.user.id }),
    turnos: () => ({ id: uuid(), minutos: 30, telefono: "", servicio: "", precio: null, atiende: "", nota: "", estado: "pendiente", sale_id: null, created_at: new Date().toISOString(), created_by: session && session.user.id }),
    suggestions: () => ({ id: uuid(), created_at: new Date().toISOString(), done: false, user_id: session && session.user.id }), members: () => ({ created_at: new Date().toISOString(), display_name: "" }),
    signup_codes: () => ({ code: Math.random().toString(16).slice(2, 10).toUpperCase(), note: "", created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 864e5).toISOString(), used_by: null }),
    invites: () => ({ code: Math.random().toString(16).slice(2, 10).toUpperCase(), role: "cashier", created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), used_by: null })
  };
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = "select"; this.one = false; this.ord = null }
    select() { if (this.op === "select") this.op = "select"; this.ret = true; return this }
    eq(c, v) { this.f.push(r => r[c] === v); return this } gte(c, v) { this.f.push(r => r[c] >= v); return this }
    lte(c, v) { this.f.push(r => r[c] <= v); return this } gt(c, v) { this.f.push(r => r[c] > v); return this }
    is(c, v) { this.f.push(r => (r[c] ?? null) === v); return this }
    order(c, o) { this.ord = [c, !o || o.ascending !== false]; return this }
    single() { this.one = true; return this } limit(n) { this.lim = n; return this }
    insert(o) { this.op = "insert"; this.payload = o; return this } update(o) { this.op = "update"; this.payload = o; return this }
    upsert(o, opt) { this.op = "upsert"; this.payload = o; this.conf = (opt && opt.onConflict || "id").split(","); return this }
    delete() { this.op = "delete"; return this }
    run() {
      if (opciones.sinRed && opciones.sinRed()) return { data: null, error: { message: "TypeError: Failed to fetch" } };
      const T = db[this.t], m = r => this.f.every(f => f(r));
      let out;
      if (this.op === "insert") {
        const rows = [].concat(this.payload).map(o => ({ ...defaults[this.t](), ...o }));
        if (rows.some(r => r.id && T.some(x => x.id === r.id))) return { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } };
        T.push(...rows); out = rows;
        // Igual que el disparador sales_cost: guarda el costo de lo vendido.
        if (this.t === "sales") rows.forEach(s => {
          let base = 0, cost = 0, n = 0;
          (s.items || []).forEach(i => { const p = db.products.find(x => x.id === i.id), c = db.product_costs.find(x => x.product_id === i.id); if (!p || !c) return; const k = p.unit === "kg" ? 1000 : 1; base += i.qty * i.price / k; cost += i.qty * c.cost / k; n++ });
          if (n) db.sale_costs.push({ sale_id: s.id, business_id: s.business_id, day: s.day, base, cost });
        });
        // Igual que el disparador sales_fiado: una venta fiada se anota en la cuenta del cliente (y lo crea si es nuevo).
        if (this.t === "sales") for (const s of rows) {
          if (s.payment !== "Fiado") continue;
          const nom = String(s.client_name || "").trim();
          if (!nom) { T.splice(T.indexOf(s), 1); return { data: null, error: { message: "fiado_sin_cliente" } } }
          let c = db.clients.find(x => x.business_id === s.business_id && x.name === nom);
          if (!c) { c = { ...defaults.clients(), business_id: s.business_id, name: nom }; db.clients.push(c) }
          db.fiados.push({ ...defaults.fiados(), business_id: s.business_id, client_id: c.id, sale_id: s.id, kind: "fiado", amount: s.amount, payment: null, shop_id: s.shop_id, day: s.day, created_at: s.created_at, created_by: s.created_by });
        }
      }
      else if (this.op === "update") { out = T.filter(m); out.forEach(r => Object.assign(r, this.payload)) }
      else if (this.op === "upsert") { const o = this.payload, ex = T.find(r => this.conf.every(c => r[c] === o[c])); if (ex) Object.assign(ex, o); else T.push({ ...defaults[this.t](), ...o }); out = [ex || T[T.length - 1]] }
      else if (this.op === "delete") { out = T.filter(m); db[this.t] = T.filter(r => !m(r));
        if (this.t === "sales") { db.fiados = db.fiados.filter(f => !out.some(s => s.id === f.sale_id)); db.turnos.forEach(t => { if (out.some(s => s.id === t.sale_id)) t.sale_id = null }) } return { data: null, error: null, count: out.length } }
      else { out = T.filter(m).map(r => ({ ...r })); if (this.ord) { const [c, asc] = this.ord; out.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)) } if (this.lim) out = out.slice(0, this.lim) }
      out = JSON.parse(JSON.stringify(out));
      return { data: this.one ? out[0] || null : out, error: null };
    }
    then(res, rej) { try { res(this.run()) } catch (e) { rej(e) } }
  }
  const emit = (ev) => listeners.forEach(f => f(ev, session));
  return {
    __db: db,
    from: t => new Q(t),
    rpc: async (name, a) => {
      const uid = session.user.id;
      const admin = db.platform_admins.some(a => a.user_id === uid);
      if (name === "subscription_price") { const b = db.businesses.find(x => x.id === a.b); const s = db.platform_settings[0]; return { data: (b && b.price) || (db.businesses.filter(x => x.price).length < s.founder_slots ? s.founder_price : s.regular_price), error: null } }
      if (name === "admin_mark_paid") { const b = db.businesses.find(x => x.id === a.p_business); if (!admin) return { data: null, error: { message: "not_allowed" } }; const desde = Math.max(Date.now(), new Date(b.trial_ends_at || 0).getTime(), new Date(b.paid_until || 0).getTime()); b.paid_until = new Date(desde + 30 * 864e5).toISOString(); if (b.plan !== "free") b.plan = "active"; return { data: b.paid_until, error: null } }
      if (name === "admin_set_free") { const b = db.businesses.find(x => x.id === a.p_business); if (!admin) return { data: null, error: { message: "not_allowed" } }; b.plan = a.p_free ? "free" : "trial"; return { data: null, error: null } }
      if (name === "raise_prices") {
        let n = 0;
        db.products.filter(p => p.business_id === a.p_business && a.p_ids.includes(p.id)).forEach(p => { p.price = Math.max(a.p_step, Math.round(p.price * (1 + a.p_pct / 100) / a.p_step) * a.p_step); n++;
          const c = db.product_costs.find(x => x.product_id === p.id); if (a.p_cost && c) c.cost = Math.round(c.cost * (1 + a.p_pct / 100) * 100) / 100 });
        return { data: n, error: null };
      }
      if (name === "import_products") {
        let nuevos = 0, actualizados = 0;
        a.p_rows.forEach(r => {
          let p = (r.code && db.products.find(x => x.business_id === a.p_business && x.code === r.code)) || db.products.find(x => x.business_id === a.p_business && x.name.toLowerCase() === r.name.toLowerCase());
          if (p) { Object.assign(p, { name: r.name, price: r.price }, r.unit ? { unit: r.unit } : {}, r.code ? { code: r.code } : {}, r.stock !== undefined ? { stock: r.stock } : {}); actualizados++ }
          else { p = { ...defaults.products(), business_id: a.p_business, name: r.name, price: r.price, unit: r.unit || "u", code: r.code || "", stock: r.stock ?? null }; db.products.push(p); nuevos++ }
          if (r.cost !== undefined) { const c = db.product_costs.find(x => x.product_id === p.id); if (c) c.cost = r.cost; else db.product_costs.push({ product_id: p.id, business_id: a.p_business, cost: r.cost }) }
        });
        return { data: { nuevos, actualizados }, error: null };
      }
      if (name === "admin_suggestions") return { data: admin ? db.suggestions.map(x => ({ id: x.id, body: x.body, created_at: x.created_at, done: x.done, business: (db.businesses.find(b => b.id === x.business_id) || {}).name, email: String(x.user_id).replace(/^u-/, "") })) : [], error: null };
      if (name === "is_platform_admin") return { data: admin, error: null };
      if (name === "admin_user_count") return { data: admin ? new Set(db.members.map(m => m.user_id)).size : null, error: null };
      if (name === "admin_overview") return { data: admin ? db.businesses.map(b => ({ business_id: b.id, name: b.name, created_at: b.created_at, plan: b.plan, trial_ends_at: b.trial_ends_at, owner_email: b.created_by.replace(/^u-/, ""), members: db.members.filter(m => m.business_id === b.id).length, sales_30d: db.sales.filter(s => s.business_id === b.id).length, price: b.price || null, paid_until: b.paid_until || null })) : [], error: null };
      if (name === "create_business") {
        const cod = String(a.p_code || "").trim().toUpperCase(), sc = cod && db.signup_codes.find(c => c.code === cod && !c.used_by);
        if (cod && !sc) return { data: null, error: { message: "invalid_signup_code" } };
        if (!cod && !admin && db.members.some(m => m.user_id === uid && m.role === "owner")) return { data: null, error: { message: "already_owner" } };
        const b = { ...defaults.businesses(), name: a.p_name, created_by: uid }; db.businesses.push(b);
        db.members.push({ ...defaults.members(), business_id: b.id, user_id: uid, role: "owner", display_name: a.p_owner_name });
        a.p_shops.forEach((s, i) => db.shops.push({ ...defaults.shops(), business_id: b.id, name: s, position: i + 1 }));
        if (a.p_wholesale) db.shops.push({ ...defaults.shops(), business_id: b.id, name: "Mayorista", kind: "wholesale", position: 100 });
        a.p_payments.forEach((p, i) => db.payment_methods.push({ ...defaults.payment_methods(), business_id: b.id, name: p, position: i + 1, wholesale: !["QR", "Posnet", "Tarjeta"].includes(p) }));
        if (sc) sc.used_by = uid;
        return { data: b.id, error: null };
      }
      if (name === "join_business") {
        const inv = db.invites.find(i => i.code === a.p_code.toUpperCase() && !i.used_by);
        if (!inv) return { data: null, error: { message: "invalid_invite" } };
        inv.used_by = uid; db.members.push({ ...defaults.members(), business_id: inv.business_id, user_id: uid, role: inv.role, display_name: a.p_name });
        return { data: inv.business_id, error: null };
      }
    },
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: f => { listeners.push(f); return { data: { subscription: { unsubscribe() { } } } } },
      signInWithPassword: async ({ email }) => { session = { user: { id: "u-" + email, email } }; setTimeout(() => emit("SIGNED_IN")); return { data: { session }, error: null } },
      signUp: async ({ email }) => { session = { user: { id: "u-" + email, email } }; setTimeout(() => emit("SIGNED_IN")); return { data: { session }, error: null } },
      signOut: async () => { session = null; emit("SIGNED_OUT"); return { error: null } },
      resetPasswordForEmail: async () => ({ error: null }), updateUser: async () => ({ error: null })
    },
    functions: { invoke: async (name, { body }) => { db.fn_calls.push({ name, body }); return body.action === "cancelar" ? { data: { ok: true }, error: null } : { data: { init_point: "javascript:void(0)" }, error: null } } },
    channel: () => ({ on() { return this }, subscribe() { return this } })
  };
};
