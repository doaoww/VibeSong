import { NextRequest, NextResponse } from "next/server";
import { polar } from "../../../../../lib/polar";
import { fulfillPolarOrder } from "../../../../../lib/polarFulfillment";
import { getSupabaseUser } from "../../../../../lib/supabase/server";

export const runtime = "nodejs";

function metadataUserId(metadata: Record<string, unknown> | undefined): string | undefined {
  const value = metadata?.userId ?? metadata?.user_id;
  return typeof value === "string" ? value : undefined;
}

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { checkoutId } = await req.json();
  if (typeof checkoutId !== "string" || checkoutId.length === 0) {
    return NextResponse.json({ error: "checkoutId is required" }, { status: 400 });
  }

  const checkout = await polar.checkouts.get({ id: checkoutId });
  const checkoutUserId = metadataUserId(checkout.metadata) ?? checkout.externalCustomerId ?? undefined;
  if (checkoutUserId !== user.id) {
    return NextResponse.json({ error: "Checkout does not belong to this user" }, { status: 403 });
  }

  if (checkout.status !== "succeeded") {
    return NextResponse.json(
      { received: false, status: checkout.status },
      { status: 202 }
    );
  }

  const result = await fulfillPolarOrder(
    {
      id: checkout.id,
      paid: true,
      status: "paid",
      productId: checkout.productId,
      checkoutId: checkout.id,
      metadata: checkout.metadata,
      customer: { externalId: checkout.externalCustomerId },
    },
    "checkout.confirm"
  );

  return NextResponse.json({ received: true, ...result });
}
