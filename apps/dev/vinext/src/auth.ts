import VinextAuth from "vinextauth";
import Google from "vinextauth/providers/google";
import GitHub from "vinextauth/providers/github";
import Credentials from "vinextauth/providers/credentials";

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
    Credentials({
      async authorize(credentials) {
        // Dev-only: accept any email/password pair for quick testing
        if (credentials?.email && credentials?.password) {
          return { id: "dev-user-1", name: "Dev User", email: credentials.email as string };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: Record<string, unknown>; user?: { id?: string } }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }: { session: Record<string, unknown>; token: Record<string, unknown> }) {
      const s = session as { user?: { id?: string } };
      if (s.user) s.user.id = token.id as string;
      return session;
    },
  },
};

export const { GET, POST, auth, toPages, pagesAuth } = VinextAuth(config);
