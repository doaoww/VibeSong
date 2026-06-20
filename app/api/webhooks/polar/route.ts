import { NextRequest, NextResponse } from "next/server";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { getProductConfig } from "../../../../lib/polar";
import { addCredits, setCredits } from "../../../../lib/db/profiles";

export const runtime = "nodejs";

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

  if (event.type === "order.created") {
    const order = event.data;

    // Only process paid orders — status can be "pending" right after checkout
    if (!order.paid) return NextResponse.json({ received: true });

    const userId = order.metadata?.userId as string | undefined;
    if (!userId) return NextResponse.json({ received: true });

    if (!order.productId) return NextResponse.json({ received: true });
    const config = getProductConfig(order.productId);
    if (!config) return NextResponse.json({ received: true });

    if (config.isSubscription) {
      // Refill to 500 credits each billing cycle (new subscription or renewal)
      await setCredits(userId, config.credits);
    } else {
      await addCredits(userId, config.credits);
    }
  }

  return NextResponse.json({ received: true });
}
