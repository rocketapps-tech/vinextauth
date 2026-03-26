"use client";

import { useSession, signIn, signOut } from "vinext-auth/react";

export default function HomePage() {
  const { data: session, status } = useSession();

  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>VinextAuth — Dev Sandbox</h1>

      <section>
        <h2>Session Status: {status}</h2>
        <pre style={{ background: "#f4f4f4", padding: "1rem", borderRadius: "4px" }}>
          {JSON.stringify(session, null, 2)}
        </pre>
      </section>

      <section style={{ marginTop: "1rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {status === "authenticated" ? (
          <button onClick={() => signOut()}>Sign out</button>
        ) : (
          <>
            <button onClick={() => signIn("google")}>Sign in with Google</button>
            <button onClick={() => signIn("github")}>Sign in with GitHub</button>
            <button onClick={() => signIn("credentials", { email: "dev@vinext.io", password: "password" })}>
              Sign in with Credentials
            </button>
          </>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <a href="/protected">Go to protected page →</a>
      </section>
    </main>
  );
}
