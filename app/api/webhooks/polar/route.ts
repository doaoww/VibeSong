import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { fulfillPolarOrder } from "../../../../lib/polarFulfillment";

export const runtime = "nodejs";

const PAID_ORDER_EVENT_TYPES = new Set(["order.created", "order.updated", "order.paid"]);

// Polar requires raw body for signature verification — must not parse as JSON
export async function POST(req: NextRequest) {
  const body = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let event;
  try {
    event = validateEvent(body, headers, process.env.POLAR_WEBHOOK_SECRET!);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    throw err;
  }

  if (PAID_ORDER_EVENT_TYPES.has(event.type)) {
    await fulfillPolarOrder(event.data, event.type);
  }

  return NextResponse.json({ received: true });
}
