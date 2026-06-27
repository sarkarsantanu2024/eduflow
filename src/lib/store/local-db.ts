"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  fetchDb, createRow, updateRow, deleteRow, saveProfile, clearInstituteData,
} from "@/features/data/actions";
import {
  EMPTY_DB, EMPTY_PROFILE,
  type Db, type Profile, type CollectionName,
} from "./types";

/**
 * Client cache for the ACTIVE institute's data, hydrated from Neon via server
 * actions. Writes are optimistic: the in-memory cache updates immediately and
 * a server action persists in the background (re-syncing on failure).
 *
 * The hook API (useCollection / useProfile / addItem / …) is unchanged, so the
 * feature screens didn't have to change — only the source of truth moved from
 * the browser to the database.
 */

// Re-export every entity type so existing `@/lib/store/local-db` imports work.
export * from "./types";

type Status = "idle" | "loading" | "ready";

let mem: Db = EMPTY_DB;
let status: Status = "idle";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setDb(next: Db) {
  mem = next;
  emit();
}

/** Fetch the active institute's data once (or again on reload). */
async function hydrate() {
  status = "loading";
  emit();
  try {
    mem = await fetchDb();
  } catch {
    mem = EMPTY_DB;
  }
  status = "ready";
  emit();
}

/** Force a fresh load from the server (e.g. after a failed write). */
export function reloadDb() {
  void hydrate();
}

/** Stable uuid usable as a DB primary key. (Legacy prefix arg is ignored.) */
export function newId(_prefix?: string): string {
  return crypto.randomUUID();
}

// ── mutations (optimistic local update + background persist) ─────────
export function addItem<T extends { id: string }>(name: CollectionName, item: T) {
  setDb({ ...mem, [name]: [item, ...(mem[name] as unknown as T[])] });
  void createRow(name, item as unknown as Record<string, unknown>).catch(reloadDb);
}

export function updateItem<T extends { id: string }>(name: CollectionName, id: string, patch: Partial<T>) {
  setDb({ ...mem, [name]: (mem[name] as unknown as T[]).map((x) => (x.id === id ? { ...x, ...patch } : x)) });
  void updateRow(name, id, patch as Record<string, unknown>).catch(reloadDb);
}

export function removeItem(name: CollectionName, id: string) {
  setDb({ ...mem, [name]: (mem[name] as { id: string }[]).filter((x) => x.id !== id) });
  void deleteRow(name, id).catch(reloadDb);
}

export function setProfile(patch: Partial<Profile>) {
  setDb({ ...mem, profile: { ...mem.profile, ...patch } });
  void saveProfile(patch).catch(reloadDb);
}

/** Clear ALL records for the active institute (keeps the institute itself). */
export function resetDb() {
  setDb({ ...EMPTY_DB, profile: mem.profile });
  void clearInstituteData().catch(reloadDb);
}

/** Sample data is disabled — every center starts with its own real data. */
export function loadSamples(_sector?: string) {
  /* no-op: dummy data removed for production */
}

// ── hooks ────────────────────────────────────────────────────────────
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapshot(): Db {
  return mem;
}

function serverSnapshot(): Db {
  return EMPTY_DB;
}

export function useDb(): Db {
  // Kick off the one-time hydration on first mount.
  useEffect(() => {
    if (status === "idle") void hydrate();
  }, []);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

export function useCollection<K extends CollectionName>(name: K): Db[K] {
  return useDb()[name];
}

export function useProfile(): Profile {
  return useDb().profile;
}

/** True once the active institute's data has finished loading from the server. */
export function useHydrated(): boolean {
  const [, force] = useState(0);
  useEffect(() => {
    const unsub = subscribe(() => force((n) => n + 1));
    if (status === "idle") void hydrate();
    return () => { unsub(); };
  }, []);
  return status === "ready";
}

// Kept for backward-compat with older imports.
export { EMPTY_PROFILE };
