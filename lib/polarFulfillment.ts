import { addCredits, setCredits } from "./db/profiles";
import { claimPolarFulfillment } from "./db/polarFulfillments";
import { getProductConfig } from "./polar";

type MetadataValue = string | number | boolean | Date | null | undefined;

export interface PolarOrderForFulfillment {
  id?: string | null;
  paid?: boolean;
  status?: string | null;
  productId?: string | null;
  checkoutId?: string | null;
  metadata?: Record<string, MetadataValue>;
  customer?: {
    externalId?: string | null;
  } | null;
}

export type PolarFulfillmentResult =
  | { status: "fulfilled"; credits: number }
  | { status: "duplicate" }
  | { status: "ignored"; reason: string };

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getOrderUserId(order: PolarOrderForFulfillment): string | undefined {
  return (
    readString(order.metadata?.userId) ??
    readString(order.metadata?.user_id) ??
    readString(order.customer?.externalId)
  );
}

function getFulfillmentKey(order: PolarOrderForFulfillment): string | undefined {
  const checkoutId = readString(order.checkoutId);
  if (checkoutId) return `checkout:${checkoutId}`;

  const orderId = readString(order.id);
  if (orderId) return `order:${orderId}`;

  return undefined;
}

export async function fulfillPolarOrder(
  order: PolarOrderForFulfillment,
  source: string
): Promise<PolarFulfillmentResult> {
  const paid = order.paid === true || order.status === "paid";
  if (!paid) return { status: "ignored", reason: "order_not_paid" };

  const userId = getOrderUserId(order);
  if (!userId) {
    console.warn("[polar] paid order missing user id", {
      source,
      orderId: order.id ?? null,
      checkoutId: order.checkoutId ?? null,
    });
    return { status: "ignored", reason: "missing_user_id" };
  }

  const productId = readString(order.productId);
  if (!productId) {
    console.warn("[polar] paid order missing product id", {
      source,
      orderId: order.id ?? null,
      checkoutId: order.checkoutId ?? null,
      userId,
    });
    return { status: "ignored", reason: "missing_product_id" };
  }

  const config = getProductConfig(productId);
  if (!config) {
    console.warn("[polar] paid order has unknown product id", {
      source,
      orderId: order.id ?? null,
      checkoutId: order.checkoutId ?? null,
      productId,
      userId,
    });
    return { status: "ignored", reason: "unknown_product" };
  }

  const key = getFulfillmentKey(order);
  if (!key) {
    console.warn("[polar] paid order missing idempotency key", {
      source,
      productId,
      userId,
    });
    return { status: "ignored", reason: "missing_fulfillment_key" };
  }

  const claimed = await claimPolarFulfillment({
    key,
    orderId: readString(order.id) ?? null,
    checkoutId: readString(order.checkoutId) ?? null,
    userId,
    productId,
    credits: config.credits,
    isSubscription: config.isSubscription,
    source,
    eventType: source.startsWith("order.") ? source : null,
  });
  if (!claimed) return { status: "duplicate" };

  const credits = config.isSubscription
    ? await setCredits(userId, config.credits)
    : await addCredits(userId, config.credits);

  return { status: "fulfilled", credits };
}
