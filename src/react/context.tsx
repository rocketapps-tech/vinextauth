"use client";

import React, { createContext, useContext } from "react";
import type { SessionContextValue, Session } from "../types.js";

export const SessionContext = createContext<SessionContextValue>({
  data: null,
  status: "loading",
  update: async () => null,
});

export function useSessionContext(): SessionContextValue {
  return useContext(SessionContext);
}

// Module-level fetch deduplication
let fetchPromise: Promise<Session | null> | null = null;

export async function fetchSession(basePath = "/api/auth"): Promise<Session | null> {
  if (fetchPromise) return fetchPromise;

  fetchPromise = fetch(`${basePath}/session`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json() as Record<string, unknown>;
      if (!data || !data.user) return null;
      return data as Session;
    })
    .catch(() => null)
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

export async function fetchCsrfToken(basePath = "/api/auth"): Promise<string> {
  const res = await fetch(`${basePath}/csrf`, { credentials: "same-origin" });
  const data = await res.json() as { csrfToken: string };
  return data.csrfToken ?? "";
}
