"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import type { Session, SessionContextValue } from "../types.js";
import { SessionContext, fetchSession } from "./context.js";

interface SessionProviderProps {
  children: ReactNode;
  /** Pass server-side session to avoid client waterfall */
  session?: Session | null;
  basePath?: string;
  refetchInterval?: number; // seconds
  refetchOnWindowFocus?: boolean;
}

export function SessionProvider({
  children,
  session: initialSession,
  basePath = "/api/auth",
  refetchInterval,
  refetchOnWindowFocus = true,
}: SessionProviderProps) {
  const [session, setSession] = useState<Session | null>(initialSession ?? null);
  const [status, setStatus] = useState<SessionContextValue["status"]>(
    initialSession !== undefined ? (initialSession ? "authenticated" : "unauthenticated") : "loading"
  );

  const loadSession = useCallback(async () => {
    setStatus("loading");
    const data = await fetchSession(basePath);
    setSession(data);
    setStatus(data ? "authenticated" : "unauthenticated");
  }, [basePath]);

  const update = useCallback(async (data?: Partial<Session>): Promise<Session | null> => {
    if (data) {
      const updated = session ? { ...session, ...data } : null;
      setSession(updated);
      return updated;
    }
    await loadSession();
    return session;
  }, [session, loadSession]);

  useEffect(() => {
    if (initialSession !== undefined) {
      setSession(initialSession);
      setStatus(initialSession ? "authenticated" : "unauthenticated");
      return;
    }
    loadSession();
  }, [initialSession, loadSession]);

  // Refetch on window focus
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

  // Refetch on interval
  useEffect(() => {
    if (!refetchInterval) return;
    const interval = setInterval(loadSession, refetchInterval * 1000);
    return () => clearInterval(interval);
  }, [refetchInterval, loadSession]);

  return (
    <SessionContext.Provider value={{ data: session, status, update }}>
      {children}
    </SessionContext.Provider>
  );
}

export default SessionProvider;
