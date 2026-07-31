"use client";

import { useCallback, useEffect, useState } from "react";
import type { DurableDirectory } from "./domain";

const EMPTY: DurableDirectory = { organization: null, role: null, customers: [], loans: [] };
export const DURABLE_DIRECTORY_EVENT = "calculacuota:durable-directory-change";

export function notifyDurableDirectoryChanged() {
  window.dispatchEvent(new Event(DURABLE_DIRECTORY_EVENT));
}

export function useDurableDirectory() {
  const [data, setData] = useState<DurableDirectory>(EMPTY);
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/directory", { cache: "no-store" });
      const result = await response.json() as DurableDirectory & { message?: string };
      if (!response.ok) throw new Error(result.message || "No fue posible cargar los datos.");
      setData(result); setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No fue posible cargar los datos.");
    } finally { setIsReady(true); }
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => void reload(), 0);
    window.addEventListener(DURABLE_DIRECTORY_EVENT, reload);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener(DURABLE_DIRECTORY_EVENT, reload);
    };
  }, [reload]);
  return { data, error, isReady, reload };
}
