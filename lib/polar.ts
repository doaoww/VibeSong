import { Polar } from "@polar-sh/sdk";

export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN!,
});

export interface ProductConfig {
  credits: number;
  isSubscription: boolean;
}

export function getProductConfig(productId: string): ProductConfig | null {
  const map: Record<string, ProductConfig> = {
    [process.env.POLAR_PRODUCT_STARTER ?? "__missing__"]: { credits: 10, isSubscription: false },
    [process.env.POLAR_PRODUCT_POPULAR ?? "__missing__"]: { credits: 50, isSubscription: false },
    [process.env.POLAR_PRODUCT_PRO ?? "__missing__"]: { credits: 500, isSubscription: false },
  };
  return map[productId] ?? null;
}

export const PACKAGE_TO_PRODUCT: Record<string, string | undefined> = {
  starter: process.env.POLAR_PRODUCT_STARTER,
  popular: process.env.POLAR_PRODUCT_POPULAR,
  pro: process.env.POLAR_PRODUCT_PRO,
};
