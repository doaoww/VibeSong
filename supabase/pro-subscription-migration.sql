-- Pro tier moves from "500 credits/mo" back to a true unlimited subscription:
-- while pro_active is true, deductCredit() skips the balance entirely instead
-- of decrementing it. Toggled by the Polar order/subscription webhooks.
alter table public.profiles
  add column if not exists pro_active boolean not null default false;
