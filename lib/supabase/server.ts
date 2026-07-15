import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getSupabaseUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // getUser() silently refreshes an expired access token using the
        // (single-use, rotating) refresh token cookie. If the refreshed pair
        // isn't written back here, the browser keeps presenting the same
        // now-consumed refresh token on every later request; Supabase's
        // rotation reuse-detection then treats that as token theft and
        // revokes the whole session, logging the user out with no visible
        // cause. Route handlers can always write cookies, so persist them.
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
