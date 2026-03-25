import { createContext, useState, useCallback, useEffect, useContext } from 'react';
import { jsx } from 'react/jsx-runtime';

// src/react/provider.tsx
var SessionContext = createContext({
  data: null,
  status: "loading",
  update: async () => null
});
function useSessionContext() {
  return useContext(SessionContext);
}
var fetchPromise = null;
async function fetchSession(basePath = "/api/auth") {
  if (fetchPromise) return fetchPromise;
  fetchPromise = fetch(`${basePath}/session`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" }
  }).then(async (res) => {
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.user) return null;
    return data;
  }).catch(() => null).finally(() => {
    fetchPromise = null;
  });
  return fetchPromise;
}
async function fetchCsrfToken(basePath = "/api/auth") {
  const res = await fetch(`${basePath}/csrf`, { credentials: "same-origin" });
  const data = await res.json();
  return data.csrfToken ?? "";
}
function SessionProvider({
  children,
  session: initialSession,
  basePath = "/api/auth",
  refetchInterval,
  refetchOnWindowFocus = true
}) {
  const [session, setSession] = useState(initialSession ?? null);
  const [status, setStatus] = useState(
    initialSession !== void 0 ? initialSession ? "authenticated" : "unauthenticated" : "loading"
  );
  const loadSession = useCallback(async () => {
    setStatus("loading");
    const data = await fetchSession(basePath);
    setSession(data);
    setStatus(data ? "authenticated" : "unauthenticated");
  }, [basePath]);
  const update = useCallback(async (data) => {
    if (data) {
      const updated = session ? { ...session, ...data } : null;
      setSession(updated);
      return updated;
    }
    await loadSession();
    return session;
  }, [session, loadSession]);
  useEffect(() => {
    if (initialSession !== void 0) {
      setSession(initialSession);
      setStatus(initialSession ? "authenticated" : "unauthenticated");
      return;
    }
    loadSession();
  }, [initialSession, loadSession]);
  useEffect(() => {
    if (!refetchOnWindowFocus) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        loadSession();
      }
    };
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [refetchOnWindowFocus, loadSession]);
  useEffect(() => {
    if (!refetchInterval) return;
    const interval = setInterval(loadSession, refetchInterval * 1e3);
    return () => clearInterval(interval);
  }, [refetchInterval, loadSession]);
  return /* @__PURE__ */ jsx(SessionContext.Provider, { value: { data: session, status, update }, children });
}

// src/react/hooks.ts
function useSession() {
  return useSessionContext();
}
function signIn(provider, options, basePath = "/api/auth") {
  const callbackUrl = options?.callbackUrl ?? window.location.href;
  if (provider) {
    const url = `${basePath}/signin/${provider}?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    window.location.href = url;
  } else {
    window.location.href = `${basePath}/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }
}
async function signOut(options, basePath = "/api/auth") {
  const callbackUrl = options?.callbackUrl ?? window.location.origin;
  const csrfToken = await fetchCsrfToken(basePath);
  await fetch(`${basePath}/signout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ csrfToken, callbackUrl })
  });
  window.location.href = callbackUrl;
}

export { SessionProvider, signIn, signOut, useSession };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map