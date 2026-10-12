-- BORRA todas las tablas de la caja y sus datos. Usar solo en una base nueva o de prueba,
-- por ejemplo si schema.sql quedó a medias. Después correr schema.sql de nuevo.
drop table if exists public.invites, public.openings, public.expenses, public.sales, public.products,
  public.providers, public.clients, public.payment_methods, public.shops, public.members, public.businesses cascade;
drop function if exists public.create_business(text, text, text[], boolean, text[]), public.join_business(text, text),
  public.my_role(uuid), public.is_member(uuid), public.is_manager(uuid), public.shop_in_business(uuid, uuid), public.sales_stock();
