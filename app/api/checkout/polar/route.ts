import { NextRequest, NextResponse } from "next/server";
import { polar, PACKAGE_TO_PRODUCT } from "../../../../lib/polar";
import { getSupabaseUser } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getSupabaseUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { packageId } = await req.json();
  const productId = PACKAGE_TO_PRODUCT[packageId];
  if (!productId) {
    return NextResponse.json({ error: "Invalid package" }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";

  const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl: `${baseUrl}/app?payment=success`,
    externalCustomerId: user.id,
    metadata: {
      userId: user.id,
      packageId,
    },
  });

  return NextResponse.json({ url: checkout.url });
}
