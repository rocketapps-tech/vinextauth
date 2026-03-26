"use client";

import { useSession, signIn, signOut } from "vinext-auth/react";

export default function HomePage() {
  const { data: session, status } = useSession();

  if (status === "loading") return <p>Loading...</p>;

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: "600px", margin: "4rem auto", padding: "0 1rem" }}>
      <h1>VinextAuth — Basic Example</h1>

      {session ? (
        <div>
          <p>Signed in as <strong>{session.user?.email}</strong></p>
          <button onClick={() => signOut()}>Sign out</button>
          <br /><br />
          <a href="/protected">View protected page →</a>
        </div>
      ) : (
        <div>
          <p>You are not signed in.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: "200px" }}>
            <button onClick={() => signIn("google")}>Sign in with Google</button>
            <button onClick={() => signIn("github")}>Sign in with GitHub</button>
          </div>
        </div>
      )}
    </main>
  );
}
