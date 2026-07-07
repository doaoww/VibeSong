import { supabase } from "../supabase";

export interface PolarFulfillmentClaim {
  key: string;
  orderId: string | null;
  checkoutId: string | null;
  userId: string;
  productId: string;
  credits: number;
  isSubscription: boolean;
  source: string;
  eventType: string | null;
}

export async function claimPolarFulfillment(
  fulfillment: PolarFulfillmentClaim
): Promise<boolean> {
  const { error } = await supabase.from("polar_fulfillments").insert({
    idempotency_key: fulfillment.key,
    polar_order_id: fulfillment.orderId,
    polar_checkout_id: fulfillment.checkoutId,
    user_id: fulfillment.userId,
    product_id: fulfillment.productId,
    credits: fulfillment.credits,
    is_subscription: fulfillment.isSubscription,
    source: fulfillment.source,
    event_type: fulfillment.eventType,
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}
