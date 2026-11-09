-- Apply after 019, BEFORE 021. Adds the "shop" (ร้านค้า) role to user_role.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block together with
-- statements that use the new value, so this file stays alone and has no begin/commit.
-- Run it as its own statement in the SQL editor, then run 021_shops.sql.
alter type public.user_role add value if not exists 'shop';
