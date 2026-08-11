-- RUN ONCE, and only on a database that already had the old Seed Shop.
--
-- Decorations used to display from ownership alone: equip_item refused the
-- category outright and the farm shell read `category === 'decor'` with no
-- regard for the row's `equipped` column, so every decor row ever written sits
-- at equipped=false. Both sides now hang decor on that flag, which would make
-- already-bought decorations vanish from the farm on deploy. This puts them
-- back out exactly once.
--
-- Do NOT fold this into milestone18-seed-shop.sql: that file is re-runnable,
-- and re-running this one would put back every decoration a player has since
-- chosen to take off.
--
-- Order: supabase/milestone18-seed-shop.sql (or bundle-milestone16-20.sql)
-- first, so the new purchase_item/equip_item are in place, then this.

update public.shop_purchases
set equipped = true
where category = 'decor' and not equipped;
