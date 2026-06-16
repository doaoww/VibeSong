import dns from "node:dns";
import { createClient } from "@supabase/supabase-js";

if (typeof window !== "undefined") {
  throw new Error("lib/supabase.ts must only be imported in server-side code");
}

// Some networks resolve AAAA records for hosts like Google's APIs but have
// no working IPv6 route, which makes Node's fetch fail with ENOTFOUND.
// Preferring IPv4 avoids that without affecting IPv6-only hosts.
dns.setDefaultResultOrder("ipv4first");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
}

export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false },
});
