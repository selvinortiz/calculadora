"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  createEmptyPersistenceData,
  createLocalPersistenceKey,
  LOCAL_PERSISTENCE_EVENT,
  parseLocalPersistenceData,
  serializeLocalPersistenceData,
  type LocalPersistenceData,
} from "./local-persistence";

type CachedData = {
  data: LocalPersistenceData;
  rawValue: string | null;
};

const cache = new Map<string, CachedData>();
const serverSnapshot = createEmptyPersistenceData();

export function useLocalPersistence(scope: string) {
  const storageKey = useMemo(() => createLocalPersistenceKey(scope), [scope]);
  const [error, setError] = useState("");
  const subscribe = useCallback(
    (notify: () => void) => subscribeToStorage(storageKey, notify),
    [storageKey],
  );
  const getSnapshot = useCallback(() => readStoredData(storageKey), [storageKey]);
  const data = useSyncExternalStore(subscribe, getSnapshot, () => serverSnapshot);
  const isReady = useSyncExternalStore(subscribeToHydration, getClientReady, getServerReady);

  const updateData = useCallback(
    (updater: (current: LocalPersistenceData) => LocalPersistenceData): boolean => {
      const nextData = updater(readStoredData(storageKey));
      const rawValue = serializeLocalPersistenceData(nextData);

      try {
        window.localStorage.setItem(storageKey, rawValue);
        cache.set(storageKey, { data: nextData, rawValue });
        setError("");
        window.dispatchEvent(
          new CustomEvent(LOCAL_PERSISTENCE_EVENT, { detail: { key: storageKey } }),
        );
        return true;
      } catch {
        setError("No se pudieron guardar los datos en este navegador.");
        return false;
      }
    },
    [storageKey],
  );

  return { data, error, isReady, updateData };
}

function readStoredData(storageKey: string): LocalPersistenceData {
  try {
    const rawValue = window.localStorage.getItem(storageKey);
    const cached = cache.get(storageKey);
    if (cached?.rawValue === rawValue) return cached.data;

    const data = parseLocalPersistenceData(rawValue);
    cache.set(storageKey, { data, rawValue });
    return data;
  } catch {
    const cached = cache.get(storageKey);
    if (cached) return cached.data;
    cache.set(storageKey, { data: serverSnapshot, rawValue: null });
    return serverSnapshot;
  }
}

function subscribeToStorage(storageKey: string, notify: () => void): () => void {
  function handleStorage(event: StorageEvent) {
    if (event.key === storageKey) notify();
  }

  function handleLocalChange(event: Event) {
    const detail = (event as CustomEvent<{ key?: string }>).detail;
    if (detail?.key === storageKey) notify();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(LOCAL_PERSISTENCE_EVENT, handleLocalChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(LOCAL_PERSISTENCE_EVENT, handleLocalChange);
  };
}

function subscribeToHydration(): () => void {
  return () => undefined;
}

function getClientReady(): boolean {
  return true;
}

function getServerReady(): boolean {
  return false;
}
