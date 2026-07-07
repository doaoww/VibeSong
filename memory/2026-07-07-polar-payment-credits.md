# Debug Report: Polar Payment Credits

- Symptom: After a successful Polar checkout, the app returned to `/app?payment=success` but the user's credit balance did not increase.
- Root cause: The webhook route only fulfilled `order.created` events. Polar's SDK marks `order.created` as possibly pending and exposes `order.paid` as the event sent when payment has actually been received.
- Fix: `app/api/webhooks/polar/route.ts` now fulfills credits from `order.paid` events, using checkout metadata `userId` with a fallback to the Polar customer external id.
- UI follow-up: `app/app/page.tsx` refreshes credits immediately and a few more times after `payment=success`, so delayed webhook delivery is reflected without a manual reload.
- Regression test: `tests/polarWebhook.test.mjs` covers one-time credit adds, subscription refills, and ignored pending `order.created` events.
- Evidence: `node --test tests\polarWebhook.test.mjs` passes; `node --test tests\*.test.mjs` passes with 160 tests.
- Status: DONE
