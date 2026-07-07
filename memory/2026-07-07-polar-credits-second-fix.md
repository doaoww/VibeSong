# Debug Report: Polar Credits Still Not Added

- Symptom: Two successful Polar payments still did not add credits after the earlier `order.paid` webhook fix.
- Evidence gathered: The local Polar SDK confirms paid orders can arrive as `order.paid`, while `order.created` may be paid or pending and `order.updated` is sent when status changes to paid. The app only handled `order.paid`, and returned `received: true` for everything else. Attempts to inspect real Polar webhook deliveries/orders with the current token failed with `403 insufficient_scope`.
- Root cause hypothesis: Production was not reliably delivering `order.paid` to this endpoint, or was delivering paid `order.created`/`order.updated` events that the app ignored. The previous code also had no idempotency guard, so safely accepting multiple paid event types required a fulfillment ledger.
- Fix: Added shared Polar fulfillment logic, idempotency via `public.polar_fulfillments`, webhook support for paid `order.created`, `order.updated`, and `order.paid`, and a verified checkout redirect confirmation path using `checkout_id={CHECKOUT_ID}`.
- Regression tests: `tests/polarWebhook.test.mjs` covers paid created/updated/paid events, pending orders, customer external-id fallback, subscriptions, and duplicate checkout protection. `tests/polarCheckout.test.mjs` covers checkout success URL and confirm-route fulfillment.
- Evidence: `node --test tests\polarWebhook.test.mjs`, `node --test tests\polarCheckout.test.mjs`, `node --test tests\*.test.mjs`, TypeScript, eslint errors-only, `git diff --check`, and `next build` pass.
- Operational note: Run `supabase/polar-fulfillments-migration.sql` in the main Supabase project before relying on idempotent fulfillment in production.
- Status: DONE_WITH_CONCERNS
