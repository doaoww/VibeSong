import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Session refresh is handled server-side by middleware.ts on every
        // request (real Set-Cookie header). Letting the browser client also
        // auto-refresh writes the cookie via document.cookie instead, which
        // Safari's ITP caps to a much shorter real lifetime than the
        // Max-Age we set — that's what was logging Safari users out.
        autoRefreshToken: false,
      },
    }
  );
}
