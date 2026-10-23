import { clearStyleProfile } from '@/lib/style-profile';
import { clearGuestWardrobe } from '@/lib/guest-wardrobe';

// Fired on window after sign-in, registration or logout, so components that
// show who is signed in (the navbar, pages with a "Save" button) can refresh
// without a full page reload.
export const AUTH_CHANGED_EVENT = 'auth-changed';

export type AuthChangedDetail = { user: { id: string; name: string; email: string } | null };

export function notifyAuthChanged(user: AuthChangedDetail['user']) {
  window.dispatchEvent(new CustomEvent<AuthChangedDetail>(AUTH_CHANGED_EVENT, { detail: { user } }));
}

// Must match the key in src/lib/guest-wardrobe.ts (which has no clear helper
// for the wear log).
const GUEST_WEAR_LOG_KEY = 'styleiq_guest_wear_log';

/**
 * Removes everything this browser remembers about the signed-in person, so the
 * next person using it doesn't inherit their style profile or history.
 */
export function clearLocalUserState() {
  clearStyleProfile();
  clearGuestWardrobe();
  try {
    localStorage.removeItem(GUEST_WEAR_LOG_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}
