import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Spotify from "next-auth/providers/spotify";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { supabase } from "./lib/supabase";

const SPOTIFY_SCOPES =
  "user-top-read user-read-email playlist-modify-public";

export async function getSpotifyAccessToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .schema("next_auth")
    .from("accounts")
    .select("access_token")
    .eq("userId", userId)
    .eq("provider", "spotify")
    .maybeSingle();
  return data?.access_token ?? null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  adapter: SupabaseAdapter({
    url: process.env.SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  }),
  providers: [
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: { scope: SPOTIFY_SCOPES },
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "VibeSong AI <onboarding@resend.dev>",
      sendVerificationRequest: async ({ identifier: to, url, provider }) => {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to,
            subject: "Your VibeSong AI sign-in link",
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#080808;color:#f5f5f5;border-radius:16px;">
                <h1 style="font-size:24px;font-weight:800;margin:0 0 8px;">Your sign-in link</h1>
                <p style="color:#888;font-size:15px;margin:0 0 28px;">Click the button below to sign in to VibeSong AI. The link expires in 24 hours.</p>
                <a href="${url}" style="display:inline-block;background:#7C3AED;color:#fff;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;text-decoration:none;">Sign in to VibeSong AI</a>
                <p style="color:#555;font-size:12px;margin:28px 0 0;">If you didn't request this, you can safely ignore this email.</p>
              </div>
            `,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(`Resend error: ${JSON.stringify(body)}`);
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.spotifyConnected = Boolean(await getSpotifyAccessToken(token.sub!));
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      spotifyConnected: boolean;
    } & DefaultSession["user"];
  }
}
