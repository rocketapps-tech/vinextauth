import { useState, useEffect } from "react";
import { signIn } from "vinextauth/react";
import type { GetServerSideProps } from "vinext";

interface Session {
  user: { name?: string | null; email?: string | null; image?: string | null };
  expires: string;
}

interface Props {
  session: Session | null;
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // Dynamic import keeps auth.ts out of the client bundle.
  // Vite does not tree-shake getServerSideProps imports like Next.js/webpack does.
  const { pagesAuth } = await import("@/auth");
  const session = await pagesAuth(ctx.req);
  return { props: { session: session ? JSON.parse(JSON.stringify(session)) : null } };
};

export default function DevSandbox({ session }: Props) {
  const [csrfToken, setCsrfToken] = useState("");

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((data) => setCsrfToken(data.csrfToken))
      .catch(() => {});
  }, []);

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>VinextAuth — Dev Sandbox</h1>

      {/* Session state */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>
          Session{" "}
          <span style={{ color: session ? "#16a34a" : "#dc2626", fontWeight: 400 }}>
            {session ? "authenticated" : "unauthenticated"}
          </span>
        </h2>
        <pre style={styles.pre}>{JSON.stringify(session, null, 2) ?? "null"}</pre>
      </section>

      {session ? (
        /* ── Authenticated ── */
        <section style={styles.section}>
          <p style={styles.info}>
            Signed in as <strong>{session.user.email}</strong>
          </p>
          <form method="POST" action="/api/auth/signout" style={styles.row}>
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <input type="hidden" name="callbackUrl" value="/" />
            <button type="submit" style={styles.btn} disabled={!csrfToken}>
              Sign out
            </button>
          </form>
        </section>
      ) : (
        /* ── Sign in ── */
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Sign In</h2>

          {/* Credentials */}
          <div style={styles.block}>
            <h3 style={styles.blockTitle}>Credentials (dev-only)</h3>
            <p style={styles.hint}>Accepts any non-empty email/password. Returns user id: <code>dev-user-1</code>.</p>
            <form
              method="POST"
              action="/api/auth/callback/credentials"
              style={styles.form}
            >
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <input type="hidden" name="callbackUrl" value="/" />
              <input
                type="email"
                name="email"
                placeholder="Email"
                defaultValue="dev@vinext.io"
                required
                autoComplete="email"
                style={styles.input}
              />
              <input
                type="password"
                name="password"
                placeholder="Password"
                defaultValue="password"
                required
                autoComplete="current-password"
                style={styles.input}
              />
              <button type="submit" style={styles.btn} disabled={!csrfToken}>
                Sign in with Credentials
              </button>
            </form>
          </div>

          {/* OAuth */}
          <div style={styles.block}>
            <h3 style={styles.blockTitle}>OAuth</h3>
            <div style={styles.row}>
              <button style={styles.btn} onClick={() => signIn("google", { callbackUrl: "/" })}>
                Sign in with Google
              </button>
              <button style={styles.btn} onClick={() => signIn("github", { callbackUrl: "/" })}>
                Sign in with GitHub
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

const styles = {
  main: {
    fontFamily: "monospace",
    padding: "2rem",
    maxWidth: "720px",
    margin: "0 auto",
  } as React.CSSProperties,
  title: {
    borderBottom: "2px solid #333",
    paddingBottom: "0.5rem",
    marginTop: 0,
  } as React.CSSProperties,
  section: {
    marginBottom: "2rem",
  } as React.CSSProperties,
  sectionTitle: {
    marginTop: 0,
    marginBottom: "0.75rem",
  } as React.CSSProperties,
  pre: {
    background: "#f4f4f4",
    padding: "1rem",
    borderRadius: "4px",
    overflow: "auto",
    maxHeight: "200px",
    margin: 0,
    fontSize: "0.85rem",
  } as React.CSSProperties,
  info: {
    marginTop: 0,
  } as React.CSSProperties,
  block: {
    marginBottom: "1.5rem",
  } as React.CSSProperties,
  blockTitle: {
    marginTop: 0,
    marginBottom: "0.25rem",
  } as React.CSSProperties,
  hint: {
    fontSize: "0.85rem",
    color: "#555",
    marginTop: 0,
    marginBottom: "0.75rem",
  } as React.CSSProperties,
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
    maxWidth: "280px",
  } as React.CSSProperties,
  input: {
    padding: "0.4rem 0.6rem",
    fontFamily: "monospace",
    fontSize: "0.9rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
  } as React.CSSProperties,
  btn: {
    padding: "0.4rem 0.9rem",
    fontFamily: "monospace",
    fontSize: "0.9rem",
    cursor: "pointer",
  } as React.CSSProperties,
  row: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    alignItems: "center",
  } as React.CSSProperties,
};
