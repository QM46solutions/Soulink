// "Sign in with fingerprint / face unlock" on this phone.
//
// What it is: when you turn it on, the server gives this phone a random sign-in key. The phone keeps that key in its
// secure storage (Android Keystore / iOS Keychain), locked so the phone only hands it back after the phone's own
// fingerprint / face / screen-lock check succeeds. Soulink never sees a fingerprint or a face: the phone only tells
// us "unlocked" by releasing the key. The server keeps a hash of the key, and can switch it off at any time (log out
// of other devices, account deleted, 5 wrong tries, 180 days unused).
//
// What it is NOT: it is not Soulink's face verification (that is the one-time check when you create your account).
// Unlocking with the phone's biometrics says nothing about whose face it is, so it never marks anyone as verified.
//
// If the phone's fingerprints / faces change, the OS wipes the locked key: we notice, forget it, and the person
// signs in with an email code and can turn it on again.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import { confirm } from './confirm';

const META = 'soulink.quickSignIn';          // { id, name } — not secret, readable without unlocking
const SECRET = 'soulink.quickSignIn.secret'; // the key itself, released only after the phone's biometric check
const PROMPT = 'Sign in to Soulink';

const locked = () => ({ requireAuthentication: true, authenticationPrompt: PROMPT, keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY });

/** True when this phone can lock a key behind its own fingerprint / face check. */
export function canUseQuickSignIn() {
  if (Platform.OS === 'web') return false;
  try { return !!SecureStore.canUseBiometricAuthentication?.(); } catch { return false; }
}

/** What the phone's check is called, for button text. */
export const quickSignInLabel = () => (Platform.OS === 'ios' ? 'Face ID / Touch ID' : 'fingerprint / face unlock');

/** The saved quick sign-in on this phone ({ id, name }) or null. Doesn't prompt. */
export async function savedQuickSignIn() {
  if (Platform.OS === 'web') return null;
  try { const raw = await SecureStore.getItemAsync(META); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

async function forget() {
  await SecureStore.deleteItemAsync(META).catch(() => {});
  await SecureStore.deleteItemAsync(SECRET, locked()).catch(() => {});
}

const deviceLabel = () => (Platform.OS === 'ios' ? 'iPhone' : 'Android phone');

/**
 * Turns it on for the signed-in person. The phone shows its own fingerprint / face prompt while saving
 * (Android), so turning it on also proves the person can unlock it. Throws with a readable message.
 */
export async function enableQuickSignIn(name) {
  if (!canUseQuickSignIn()) throw new Error('Set up a fingerprint or face unlock in your phone settings first.');
  const { id, secret } = await api('/auth/device-keys', { method: 'POST', body: { label: deviceLabel() } });
  try {
    await SecureStore.setItemAsync(SECRET, secret, locked());
  } catch (e) {
    await api(`/auth/device-keys/${id}`, { method: 'DELETE' }).catch(() => {}); // don't leave an unused key on the server
    throw new Error(/cancel/i.test(String(e?.message)) ? 'Cancelled. You can turn it on later in Settings.' : "Couldn't turn it on. Please try again.");
  }
  await SecureStore.setItemAsync(META, JSON.stringify({ id, name: name || '' }));
  return { id };
}

/** Turns it off on this phone (and on the server when we're signed in). */
export async function disableQuickSignIn({ remote = true } = {}) {
  const saved = await savedQuickSignIn();
  if (saved && remote) await api(`/auth/device-keys/${saved.id}`, { method: 'DELETE' }).catch(() => {});
  await forget();
}

/**
 * Asks the phone for its fingerprint / face check, then signs in with the released key.
 * Returns { token, user } or throws an Error whose .code is:
 *   'cancelled'  — the person closed the prompt (show nothing)
 *   'gone'       — key no longer usable here (phone's biometrics changed, or switched off on the server): use email
 *   'use_code'   — account paused / scheduled for deletion: an email code sign-in brings it back
 *   anything else — network etc.
 */
export async function quickSignIn() {
  const saved = await savedQuickSignIn();
  if (!saved) throw Object.assign(new Error('Not set up on this phone.'), { code: 'gone' });
  let secret;
  try {
    secret = await SecureStore.getItemAsync(SECRET, locked());
  } catch (e) {
    const msg = String(e?.message || '');
    if (/cancel/i.test(msg)) throw Object.assign(new Error(''), { code: 'cancelled' });
    // the OS invalidated the key (fingerprints / faces changed) or it can't be read any more
    await forget();
    throw Object.assign(new Error("Your phone's fingerprint / face settings changed, so quick sign-in was switched off. Please sign in with your email code."), { code: 'gone' });
  }
  if (!secret) { await forget(); throw Object.assign(new Error('Please sign in with your email code.'), { code: 'gone' }); }
  try {
    return await api('/auth/device-keys/unlock', { method: 'POST', body: { id: saved.id, secret } });
  } catch (e) {
    if (e.code === 'device_key_invalid') { await forget(); e.code = 'gone'; }
    throw e;
  }
}

const ASKED = 'soulink.quickSignIn.asked';

/**
 * After a code sign-in: offer once per phone to turn on fingerprint / face unlock for next time.
 * Only for people who finished setting up their profile, on phones that support it, and not if it's already on.
 */
export async function offerQuickSignIn(user) {
  try {
    if (!user?.onboardingDone || !canUseQuickSignIn() || (await savedQuickSignIn())) return;
    if (await SecureStore.getItemAsync(ASKED)) return;
    await SecureStore.setItemAsync(ASKED, '1');
    const yes = await confirm(
      `Sign in faster next time?`,
      `Use your phone's ${quickSignInLabel()} to sign in to Soulink instead of waiting for an email code.\n\nYour phone does the check: Soulink never sees or stores your fingerprint or face. You can turn this off any time in Settings.`,
      { confirmText: 'Turn on', cancelText: 'Not now' },
    );
    if (yes) await enableQuickSignIn(user.displayName || user.username);
  } catch { /* optional: they can turn it on in Settings › Sign-in & security */ }
}
