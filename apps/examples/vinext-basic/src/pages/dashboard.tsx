import { useState, useEffect } from "react";
import type { GetServerSideProps } from "vinext";

interface Props {
  session: {
    user: { name?: string | null; email?: string | null; image?: string | null };
    expires: string;
  };
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // Dynamic import keeps auth.ts out of the client bundle.
  // Vite does not tree-shake getServerSideProps imports like Next.js/webpack does.
  const { pagesAuth } = await import("@/auth");
  const session = await pagesAuth(ctx.req);

  if (!session) {
    return { redirect: { destination: "/", permanent: false } };
  }

  return { props: { session: JSON.parse(JSON.stringify(session)) } };
};

export default function DashboardPage({ session }: Props) {
  const [csrfToken, setCsrfToken] = useState("");

  // Same pattern as login page: fetch CSRF from the auth endpoint
  // so the cookie is set correctly by the auth handler itself.
  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((r) => r.json())
      .then((data) => setCsrfToken(data.csrfToken))
      .catch(() => {});
    // Failure is non-critical here: the user can still view the dashboard.
    // Sign out will be unavailable until CSRF loads, which is acceptable.
  }, []);

  const initials =
    session.user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <h1 style={styles.logo}>VinextAuth</h1>
          <form method="POST" action="/api/auth/signout">
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <input type="hidden" name="callbackUrl" value="/" />
            <button
              type="submit"
              disabled={!csrfToken}
              style={{
                ...styles.btnSignOut,
                opacity: csrfToken ? 1 : 0.5,
                cursor: csrfToken ? "pointer" : "not-allowed",
              }}
            >
              Sign out
            </button>
          </form>
        </header>

        {/* Success banner */}
        <div style={styles.successBanner}>
          <span style={styles.successIcon}>✓</span>
          Successfully authenticated!
        </div>

        {/* Welcome card */}
        <div style={styles.card}>
          <div style={styles.userRow}>
            <div style={styles.avatar}>{initials}</div>
            <div>
              <h2 style={styles.userName}>{session.user.name ?? "User"}</h2>
              <p style={styles.userEmail}>{session.user.email}</p>
            </div>
          </div>
          <p style={styles.welcomeText}>
            This page is protected — only accessible to authenticated users.
          </p>
        </div>

        {/* Session details */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Session Data</h3>
          <pre style={styles.pre}>{JSON.stringify(session, null, 2)}</pre>
        </div>
      </div>
    </main>
  );
}

const styles = {
  main: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    minHeight: "100vh",
    background: "#f9fafb",
    padding: "1rem",
  } as React.CSSProperties,
  container: {
    maxWidth: "640px",
    margin: "0 auto",
    paddingTop: "2rem",
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  } as React.CSSProperties,
  logo: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#111",
  } as React.CSSProperties,
  btnSignOut: {
    padding: "0.45rem 1rem",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    background: "#fff",
    fontSize: "0.9rem",
    color: "#555",
    transition: "opacity 0.15s",
  } as React.CSSProperties,
  successBanner: {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
    padding: "0.85rem 1.25rem",
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    borderRadius: "10px",
    color: "#16a34a",
    fontWeight: 600,
    fontSize: "0.95rem",
  } as React.CSSProperties,
  successIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "#16a34a",
    color: "#fff",
    fontSize: "0.7rem",
    fontWeight: 700,
    flexShrink: 0,
  } as React.CSSProperties,
  card: {
    background: "#fff",
    borderRadius: "12px",
    padding: "1.5rem",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  } as React.CSSProperties,
  cardTitle: {
    margin: "0 0 0.75rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#111",
  } as React.CSSProperties,
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1rem",
  } as React.CSSProperties,
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "#6366f1",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "1.1rem",
    flexShrink: 0,
  } as React.CSSProperties,
  userName: {
    margin: "0 0 0.2rem",
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#111",
  } as React.CSSProperties,
  userEmail: {
    margin: 0,
    fontSize: "0.85rem",
    color: "#888",
  } as React.CSSProperties,
  welcomeText: {
    margin: 0,
    color: "#555",
    fontSize: "0.95rem",
  } as React.CSSProperties,
  pre: {
    background: "#f4f4f4",
    padding: "1rem",
    borderRadius: "8px",
    overflow: "auto",
    fontSize: "0.8rem",
    margin: 0,
  } as React.CSSProperties,
};
