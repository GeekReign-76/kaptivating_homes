/**
 * testMode.ts
 *
 * Test mode feature flag.
 *
 * Enabled when:
 *   1. NEXT_PUBLIC_TEST_MODE=true (env — always on in that build), OR
 *   2. localStorage 'kh_test_mode' = 'true' (runtime toggle via banner)
 *
 * When active the apiClient returns mock data instead of hitting the backend.
 * The UI is otherwise identical — use this to demo or develop without a
 * live backend / Supabase connection.
 */

const STORAGE_KEY = 'kh_test_mode';

export function isTestMode(): boolean {
  if (process.env.NEXT_PUBLIC_TEST_MODE === 'true') return true;
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function enableTestMode(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, 'true');
    window.location.reload();
  }
}

export function disableTestMode(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }
}

export function toggleTestMode(): void {
  isTestMode() ? disableTestMode() : enableTestMode();
}
