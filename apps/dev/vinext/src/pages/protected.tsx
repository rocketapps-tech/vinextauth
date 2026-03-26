import type { GetServerSideProps } from "vinext";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // Dynamic import keeps auth.ts out of the client bundle.
  const { pagesAuth } = await import("@/auth");
  const session = await pagesAuth(ctx.req);

  if (!session) {
    return { redirect: { destination: "/", permanent: false } };
  }

  return { props: { session: JSON.parse(JSON.stringify(session)) } };
};

export default function ProtectedPage({ session }: { session: Record<string, unknown> }) {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
      <h1 style={{ borderBottom: "2px solid #333", paddingBottom: "0.5rem", marginTop: 0 }}>
        Protected Page
      </h1>
      <p>You are authenticated as:</p>
      <pre
        style={{
          background: "#f4f4f4",
          padding: "1rem",
          borderRadius: "4px",
          overflow: "auto",
          fontSize: "0.85rem",
        }}
      >
        {JSON.stringify(session, null, 2)}
      </pre>
      <a href="/">← Back to home</a>
    </main>
  );
}
