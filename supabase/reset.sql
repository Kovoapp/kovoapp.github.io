-- BORRA todas las tablas de la caja y sus datos. Usar solo en una base nueva o de prueba,
-- por ejemplo si schema.sql quedó a medias. Después correr schema.sql de nuevo.
drop table if exists public.month_payments, public.suggestions, public.sale_costs, public.product_costs, public.platform_settings, public.signup_codes, public.platform_admins, public.invites, public.openings, public.expenses, public.sales, public.products,
  public.providers, public.clients, public.payment_methods, public.shops, public.members, public.businesses cascade;
drop function if exists public.create_business(text, text, text[], boolean, text[]), public.create_business(text, text, text[], boolean, text[], text),
  public.is_platform_admin(), public.admin_overview(), public.admin_user_count(), public.can_sell(uuid), public.subscription_price(uuid),
  public.mp_attach(uuid, text, numeric), public.mp_apply(uuid, text, text, timestamptz), public.admin_set_free(uuid, boolean), public.mp_set_price(uuid, numeric), public.join_business(text, text),
  public.my_role(uuid), public.is_member(uuid), public.is_manager(uuid), public.shop_in_business(uuid, uuid), public.sales_stock(), public.sales_cost(), public.product_in_business(uuid, uuid),
  public.raise_prices(uuid, uuid[], numeric, numeric, boolean), public.import_products(uuid, jsonb), public.admin_suggestions(),
  public.add_paid_month(uuid, text, numeric, boolean), public.mp_pay_month(uuid, text, numeric), public.admin_mark_paid(uuid);
