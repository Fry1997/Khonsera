import type { TicketVM } from "@/components/concierge";

// On-device cache of the user's booked tickets (IndexedDB), so the Aztec is
// always reachable without signal — the "cached day" half of the offline spine
// (the service worker is the shell half). TicketVM is already JSON-serialisable
// (barcode payloads, times, platform all flow through), so we store it verbatim.
//
// One record holds the whole wallet snapshot; the offline surface groups it the
// same way the live Wallet does. Last write wins — refreshed whenever the Wallet
// or Today loads online.

const DB_NAME = "khonsera-offline";
const STORE = "wallet";
const KEY = "current";
const DB_VERSION = 1;

export type WalletSnapshot = {
  key: string;
  savedAt: string; // ISO — shown as "saved 14:32" on the offline surface
  tickets: TicketVM[];
};

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function saveWalletSnapshot(tickets: TicketVM[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const snapshot: WalletSnapshot = { key: KEY, savedAt: new Date().toISOString(), tickets };
      tx.objectStore(STORE).put(snapshot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
  db.close();
}

export async function loadWalletSnapshot(): Promise<WalletSnapshot | null> {
  const db = await openDb();
  if (!db) return null;
  const snapshot = await new Promise<WalletSnapshot | null>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as WalletSnapshot) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  db.close();
  return snapshot;
}
