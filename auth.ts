import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Spotify from "next-auth/providers/spotify";
import Google from "next-auth/providers/google";
import Email from "next-auth/providers/email";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { supabase } from "./lib/supabase";
import { sendVerificationRequest } from "./lib/email";

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
    Email({
      from: process.env.EMAIL_FROM,
      sendVerificationRequest,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.spotifyConnected = Boolean(await getSpotifyAccessToken(user.id));
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
