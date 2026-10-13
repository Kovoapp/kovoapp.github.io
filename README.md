# Caja Dietéticas

Caja registradora para dietéticas y almacenes naturales que funciona en el celular. Cada negocio tiene su cuenta y ve solo sus datos.

**Qué hace**

- Vender: locales, carrito con productos y código de barras (cámara de cualquier celular o lector de mano), vuelto, ticket impreso y "deshacer" la última venta.
- Stock opcional por producto: baja solo con cada venta, vuelve si se elimina la venta y avisa cuando no queda.
- Venta mayorista con lista de clientes.
- Caja inicial por local y efectivo esperado en caja.
- Pagos a proveedores, impuestos y retiros de caja.
- Resumen del día y balance del mes, con descarga a CSV.
- Equipo: el dueño invita cajeros con un código. Los cajeros solo ven Vender.
- Se instala en el celular como una app (sin pasar por las tiendas).

## Cómo ponerla en marcha

Hace falta una cuenta gratis en [Supabase](https://supabase.com) (la base de datos y los usuarios) y GitHub Pages (donde se publica la página).

### 1. Base de datos (Supabase)

1. Entrá a [supabase.com](https://supabase.com), creá una cuenta y un proyecto nuevo. Elegí la región São Paulo para que ande rápido desde Argentina.
2. En el proyecto, abrí **SQL Editor**, pegá todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y tocá **Run**.
   Si ya lo habías corrido antes, corré también [`supabase/stock.sql`](supabase/stock.sql), [`supabase/alta.sql`](supabase/alta.sql) y [`supabase/pagos.sql`](supabase/pagos.sql) (se pueden correr las veces que quieras).
   Si aparece el error `relation "businesses" already exists`, ya se había corrido antes. En una base nueva, corré [`supabase/reset.sql`](supabase/reset.sql) y después `schema.sql` otra vez.
3. Abrí **Project Settings → API** y copiá dos datos: **Project URL** y **anon public key**.
4. Pegalos en [`js/config.js`](js/config.js) (se puede editar directo en GitHub con el lápiz).

La "anon key" es pública por diseño. Lo que protege los datos son las reglas del archivo `schema.sql`: cada negocio solo puede leer y escribir lo suyo.

### 2. Publicar la página (GitHub Pages)

1. En este repositorio, abrí **Settings → Pages** y en **Source** elegí **GitHub Actions**.
2. Cada cambio en la rama `main` se publica solo. La dirección queda así: `https://<tu-usuario>.github.io/caja-dieteticas/`.
3. Volvé a Supabase, abrí **Authentication → URL Configuration** y poné esa dirección en **Site URL**. Así los emails de confirmación y de "olvidé la contraseña" llevan a tu página.

### 3. Vos como administrador

Para crear un negocio hace falta un **código de alta** que das vos. Creá tu cuenta en la página y después, en el SQL Editor de Supabase, corré esto con tu email:

```sql
insert into public.platform_admins (user_id) select id from auth.users where email = 'tu@email.com';
```

Desde ahí vas a ver **Ajustes → Administración de la app**: cuántos usuarios y negocios hay, y el botón para crear códigos de alta. Vos podés crear tu propio negocio sin código.

En [`js/config.js`](js/config.js) completá tu WhatsApp o email para que el botón "Escribinos" de la página les llegue a vos.

### 4. Probar

Entrá a la dirección, tocá **Crear cuenta**, confirmá el email y configurá tu negocio. Para sumar a un empleado: **Ajustes → Equipo → Código para cajero**, y pasale el código.

### 5. Cobro con Mercado Pago

Cada negocio tiene 7 días de prueba. Después tiene que suscribirse desde **Ajustes → Mi plan**: paga con Mercado Pago y se le cobra solo todos los meses. Si no paga, puede ver sus datos pero no anotar ventas. Los precios se cambian en **Administración de la app** (los primeros 10 negocios pagan $15.000 y los demás $18.000; cada uno conserva el precio con el que se suscribió).

1. **Mercado Pago:** en [Tus integraciones](https://www.mercadopago.com.ar/developers/panel/app) creá una aplicación y copiá el **Access Token** (primero el de prueba, después el de producción).
2. **Supabase → Edge Functions → Secrets:** agregá `MP_ACCESS_TOKEN` con ese token.
3. **Supabase → Account → Access Tokens:** creá un token. En GitHub, **Settings → Secrets and variables → Actions**, guardalo como `SUPABASE_ACCESS_TOKEN`. Después, en **Actions → Publicar funciones de Supabase → Run workflow**.
4. **Mercado Pago → tu aplicación → Webhooks:** URL `https://nhtbjrhdjtlrhxrlezyj.supabase.co/functions/v1/mp-webhook`, evento **Planes y suscripciones**.

Las funciones están en `supabase/functions/` y su lógica se prueba con `tests/mp.test.mjs`.

## Cómo está armada

- Página estática sin paso de compilación: `index.html`, `styles.css`, `js/app.js`.
- Supabase para usuarios y datos. Los permisos están en `supabase/schema.sql` (Row Level Security).
- `sw.js` y `manifest.webmanifest` permiten instalarla en el celular.

## Pruebas

- `supabase/tests/run.sh`: crea la base en un Postgres vacío y comprueba que un negocio no vea los datos de otro y que los cajeros no puedan hacer cosas de dueño.
- `tests/ui-smoke.mjs`: recorre la app (alta, venta, pago, resumen, balance, invitación) con datos falsos en un navegador.

- `tests/scanner.mjs`: escanea un código EAN-13 con una cámara simulada, da de alta un código nuevo, prueba el lector de mano y el stock (vender, deshacer y reponer).

Las tres corren solas en cada cambio (GitHub Actions).

## Pendiente antes de cobrar

- Términos de uso y política de privacidad.
- El ticket no es factura. La factura electrónica de ARCA (ex AFIP) es un módulo aparte.
