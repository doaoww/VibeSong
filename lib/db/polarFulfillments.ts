import { supabase } from "../supabase";

const AUTH_FULFILLMENT_KEYS = "vibesong_polar_fulfillment_keys";
const MAX_AUTH_FULFILLMENT_KEYS = 100;

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

function isPostgrestUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  return (
    err.code === "PGRST002" ||
    err.message?.includes("schema cache") === true
  );
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function claimAuthFulfillment(fulfillment: PolarFulfillmentClaim): Promise<boolean> {
  const { data, error } = await supabase.auth.admin.getUserById(fulfillment.userId);
  if (error) throw error;
  if (!data.user) throw new Error(`Supabase auth user not found: ${fulfillment.userId}`);

  const metadata = data.user.app_metadata ?? {};
  const keys = readStringArray(metadata[AUTH_FULFILLMENT_KEYS]);
  if (keys.includes(fulfillment.key)) return false;

  const nextKeys = [...keys, fulfillment.key].slice(-MAX_AUTH_FULFILLMENT_KEYS);
  const { error: updateError } = await supabase.auth.admin.updateUserById(
    fulfillment.userId,
    {
      app_metadata: {
        ...metadata,
        [AUTH_FULFILLMENT_KEYS]: nextKeys,
      },
    }
  );
  if (updateError) throw updateError;
  return true;
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
  if (isPostgrestUnavailable(error)) return claimAuthFulfillment(fulfillment);
  throw error;
}
