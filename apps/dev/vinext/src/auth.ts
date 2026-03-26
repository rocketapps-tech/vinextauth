import VinextAuth from "vinextauth";
import Google from "vinextauth/providers/google";
import GitHub from "vinextauth/providers/github";
import Credentials from "vinextauth/providers/credentials";
import type { JWTCallbackParams, SessionCallbackParams } from "vinextauth";

type TokenExtras = { id?: string };
type SessionExtras = { id?: string };

const config = {
  secret: process.env.VINEXTAUTH_SECRET!,
  debug: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Credentials({
      async authorize(credentials) {
        // Dev-only: accept any non-empty email/password pair for quick testing
        if (credentials?.email && credentials?.password) {
          return { id: "dev-user-1", name: "Dev User", email: credentials.email };
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
