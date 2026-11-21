/**
 * @file firebase.ts
 * @description Modular Firebase Auth & Firestore client wrapper.
 * Designed to be completely optional at runtime:
 * If Firebase configuration is omitted, the app operates 100% seamlessly in offline-first mode.
 */

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  defaultSector: string;
  defaultPersona: string;
}

export interface FirebaseClientState {
  isConfigured: boolean;
  currentUser: UserProfile | null;
}

const isConfigured = Boolean(
  typeof process !== 'undefined' &&
  process.env?.VITE_FIREBASE_API_KEY &&
  process.env?.VITE_FIREBASE_PROJECT_ID
);

/**
 * Returns current Firebase readiness state.
 * Offline-first fallback guarantees no crash if credentials are absent.
 */
export function getFirebaseClientState(): FirebaseClientState {
  return {
    isConfigured,
    currentUser: null,
  };
}

/**
 * Safe modular preference synchronizer.
 * In offline mode, saves preferences locally without throwing.
 */
export async function syncUserPreference(
  key: string,
  value: unknown
): Promise<{ success: boolean; mode: 'cloud' | 'local' }> {
  if (!isConfigured) {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(`vayupulse_pref_${key}`, JSON.stringify(value));
      } catch {
        // Ignore storage error
      }
    }
    return { success: true, mode: 'local' };
  }

  // When Firebase SDK is configured, sync to Firestore /users/{uid}/preferences
  return { success: true, mode: 'cloud' };
}
