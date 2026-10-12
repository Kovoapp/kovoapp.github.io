# Caja Dietéticas

Caja registradora para dietéticas y almacenes naturales que funciona en el celular. Cada negocio tiene su cuenta y ve solo sus datos.

**Qué hace**

- Vender: locales, carrito con productos y código de barras, vuelto, ticket impreso y "deshacer" la última venta.
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
   Si aparece el error `relation "businesses" already exists`, ya se había corrido antes. En una base nueva, corré [`supabase/reset.sql`](supabase/reset.sql) y después `schema.sql` otra vez.
3. Abrí **Project Settings → API** y copiá dos datos: **Project URL** y **anon public key**.
4. Pegalos en [`js/config.js`](js/config.js) (se puede editar directo en GitHub con el lápiz).

La "anon key" es pública por diseño. Lo que protege los datos son las reglas del archivo `schema.sql`: cada negocio solo puede leer y escribir lo suyo.

### 2. Publicar la página (GitHub Pages)

1. En este repositorio, abrí **Settings → Pages** y en **Source** elegí **GitHub Actions**.
2. Cada cambio en la rama `main` se publica solo. La dirección queda así: `https://<tu-usuario>.github.io/caja-dieteticas/`.
3. Volvé a Supabase, abrí **Authentication → URL Configuration** y poné esa dirección en **Site URL**. Así los emails de confirmación y de "olvidé la contraseña" llevan a tu página.

### 3. Probar

Entrá a la dirección, tocá **Crear cuenta**, confirmá el email y configurá tu negocio. Para sumar a un empleado: **Ajustes → Equipo → Código para cajero**, y pasale el código.

## Cómo está armada

- Página estática sin paso de compilación: `index.html`, `styles.css`, `js/app.js`.
- Supabase para usuarios y datos. Los permisos están en `supabase/schema.sql` (Row Level Security).
- `sw.js` y `manifest.webmanifest` permiten instalarla en el celular.

## Pruebas

- `supabase/tests/run.sh`: crea la base en un Postgres vacío y comprueba que un negocio no vea los datos de otro y que los cajeros no puedan hacer cosas de dueño.
- `tests/ui-smoke.mjs`: recorre la app (alta, venta, pago, resumen, balance, invitación) con datos falsos en un navegador.

Las dos corren solas en cada cambio (GitHub Actions).

## Pendiente antes de cobrar

- Cobro de la suscripción (Mercado Pago). Hoy cada negocio nuevo arranca con 30 días de prueba y el aviso aparece en la app, pero no se corta el uso.
- Términos de uso y política de privacidad.
- El ticket no es factura. La factura electrónica de ARCA (ex AFIP) es un módulo aparte.
