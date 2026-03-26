import VinextAuth from "vinext-auth";
import Google from "vinext-auth/providers/google";
import GitHub from "vinext-auth/providers/github";

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
