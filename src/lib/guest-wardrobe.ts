// A guest's closet lives in this browser's localStorage until they sign in
// (the auth modal then moves it into their account). Shared by the wardrobe
// page and the auth modal so they agree on the key and the format.

const KEY = 'styleiq_guest_wardrobe_ids';

/** Saved garment ids; tolerates missing or corrupted storage. */
export function readGuestWardrobe(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function writeGuestWardrobe(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    // Storage unavailable (private mode, quota) — the change just won't persist.
  }
}

export function clearGuestWardrobe() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Guests' "I wore this" history, kept for 30 days in this browser, so the
// daily suggestion can rotate for them too (signed-in users' history is on
// the server).
const WEAR_KEY = 'styleiq_guest_wear_log';
export interface GuestWear {
  garmentId: string;
  wornOn: string; // YYYY-MM-DD
}

export function readGuestWearLog(): GuestWear[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(WEAR_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    return parsed.filter(
      (w): w is GuestWear => typeof w?.garmentId === 'string' && typeof w?.wornOn === 'string' && w.wornOn >= cutoff
    );
  } catch {
    return [];
  }
}

export function addGuestWear(garmentIds: string[], wornOn: string) {
  try {
    const entries = [...readGuestWearLog(), ...garmentIds.map((garmentId) => ({ garmentId, wornOn }))];
    localStorage.setItem(WEAR_KEY, JSON.stringify(entries.slice(-300)));
  } catch {
    // Storage unavailable — history just won't persist.
  }
}
