import VinextAuth from "vinextauth";
import Google from "vinextauth/providers/google";
import GitHub from "vinextauth/providers/github";
import Credentials from "vinextauth/providers/credentials";
import type { JWTCallbackParams, SessionCallbackParams } from "vinextauth";

type TokenExtras = { id?: string };
type SessionExtras = { id?: string };

const config = {
  secret: process.env.VINEXTAUTH_SECRET!,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    /**
     * Credentials provider — example with hardcoded demo user.
     * In production, replace the authorize function with a real DB lookup.
     */
    Credentials({
      async authorize(credentials) {
        // Demo: accept a single hardcoded user
        if (
          credentials?.email === "demo@example.com" &&
          credentials?.password === "password123"
        ) {
          return { id: "demo-user-1", name: "Demo User", email: credentials.email };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  callbacks: {
    async jwt({ token, user }: JWTCallbackParams<TokenExtras>) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }: SessionCallbackParams<SessionExtras, TokenExtras>) {
      if (session.user) session.user.id = token.id;
      return session;
    },
  },
};

export const { GET, POST, auth, toPages, pagesAuth } = VinextAuth(config);
