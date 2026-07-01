import dns from "node:dns";
import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("lib/supabaseCatalog.ts must only be imported in server-side code");
}

dns.setDefaultResultOrder("ipv4first");

// Separate Supabase project from the main SUPABASE_URL — holds only the
// songs catalog. Kept independent from auth/profiles/taste/feedback (which
// live in the main project) so catalog outages/migrations never touch user data.
const catalogUrl = process.env.SUPABASE_CATALOG_URL;
const catalogServiceRoleKey = process.env.SUPABASE_CATALOG_SERVICE_ROLE_KEY;

if (!catalogUrl || !catalogServiceRoleKey) {
  throw new Error("SUPABASE_CATALOG_URL and SUPABASE_CATALOG_SERVICE_ROLE_KEY must be set");
}

export const supabaseCatalog = createClient(catalogUrl, catalogServiceRoleKey, {
  auth: { persistSession: false },
});
