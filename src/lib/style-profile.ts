// The style profile a person sets up in the Style Advisor, remembered in this
// browser so the outfit builder, quick pick and daily suggestion can
// personalize too. Only saved when the person explicitly generates their
// profile — never a pre-filled default.

export interface SavedStyleProfile {
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  underTone?: string;
  torsoLength?: string;
  bodyProportion?: string;
}

const KEY = 'styleiq_style_profile';

export function loadStyleProfile(): SavedStyleProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SavedStyleProfile) : null;
  } catch {
    return null;
  }
}

export function saveStyleProfile(profile: SavedStyleProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    // Storage unavailable (private mode etc.) — personalization just won't persist.
  }
}

export function clearStyleProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/**
 * Saves the profile in this browser and, when signed in, on the account so
 * it follows the person to other devices. Guests (401) just keep the local copy.
 */
export async function persistStyleProfile(profile: SavedStyleProfile) {
  saveStyleProfile(profile);
  try {
    await fetch('/api/user/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    });
  } catch {
    // Offline — the local copy still works and will be uploaded next sign-in.
  }
}

/**
 * After sign-in: the account's profile wins; if the account has none yet but
 * this browser does, upload the browser's one.
 */
export async function reconcileStyleProfile(accountProfile: SavedStyleProfile | null | undefined) {
  if (accountProfile && Object.keys(accountProfile).length > 0) {
    saveStyleProfile(accountProfile);
    return;
  }
  const local = loadStyleProfile();
  if (local) await persistStyleProfile(local);
}
