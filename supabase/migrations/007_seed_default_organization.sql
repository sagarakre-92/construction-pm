-- Step 3: Seed one default organization (idempotent).
-- Runs only when no organizations exist. Use a placeholder name/slug you can change later.
-- No UI changes. No membership rows yet (add in a later step if you want users to see it).

-- Customize these before running, or UPDATE after:
--   name: display name of your company/org
--   slug: URL-safe identifier (unique); used in APIs or routes later
insert into public.organizations (name, slug)
select 'My Company', 'my-company'
where not exists (select 1 from public.organizations limit 1);
