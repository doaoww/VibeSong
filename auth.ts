import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import Spotify from "next-auth/providers/spotify";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
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

interface NextAuthUserRow {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  password_hash: string | null;
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
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const { data: existing } = await supabase
          .schema("next_auth")
          .from("users")
          .select("id, email, name, image, password_hash")
          .eq("email", email)
          .maybeSingle<NextAuthUserRow>();

        if (existing) {
          if (!existing.password_hash) return null;
          const valid = await bcrypt.compare(password, existing.password_hash);
          if (!valid) return null;
          return {
            id: existing.id,
            email: existing.email,
            name: existing.name,
            image: existing.image,
          };
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const { data: created, error } = await supabase
          .schema("next_auth")
          .from("users")
          .insert({ email, password_hash: passwordHash })
          .select("id, email, name, image")
          .single();
        if (error || !created) return null;
        return {
          id: created.id,
          email: created.email,
          name: created.name,
          image: created.image,
        };
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
