import type { GetServerSideProps } from "vinext";
import { pagesAuth } from "@/auth";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await pagesAuth(ctx.req);

  if (!session) {
    return { redirect: { destination: "/api/auth/signin", permanent: false } };
  }

  return { props: { session: JSON.parse(JSON.stringify(session)) } };
};

export default function ProtectedPage({ session }: { session: Record<string, unknown> }) {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Protected Page</h1>
      <p>You are authenticated as:</p>
      <pre style={{ background: "#f4f4f4", padding: "1rem", borderRadius: "4px" }}>
        {JSON.stringify(session, null, 2)}
      </pre>
      <a href="/">← Back to home</a>
    </main>
  );
}
