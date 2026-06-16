import dns from "node:dns";

export function register() {
  // This network resolves AAAA records for some hosts (e.g. Google's APIs)
  // but has no working IPv6 route, which makes Node's fetch fail with
  // ENOTFOUND. Preferring IPv4 avoids that without affecting hosts that
  // only have IPv6.
  dns.setDefaultResultOrder("ipv4first");
}
