// The "Sign in with fingerprint / face unlock" part of the welcome screen.
// Rule: email (or phone) codes are for registration. After that, a phone with quick sign-in turned on signs in with
// the phone's own Face ID / fingerprint check, and a code is offered only as a fallback:
//   - after 3 failed or cancelled tries,
//   - when the key no longer works here (fingerprints / faces changed on the phone, switched off on the server),
//   - when the account is paused / scheduled for deletion (a code sign-in brings it back),
//   - or when someone else wants to use this phone ("Not you?").
// Phones without quick sign-in (new phone, reinstalled app, web) go straight to the code.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { quickSignIn, quickSignInLabel, savedQuickSignIn } from '../lib/biometric';
import { colors, fonts, radius, space } from '../lib/theme';

export const MAX_QUICK_TRIES = 3;

/**
 * onReady(hasQuick): called once we know whether this phone has quick sign-in (false → show the code form).
 * onNeedCode(message): called when the code fallback should appear; message (may be empty) explains why.
 */
export default function QuickSignIn({ onReady, onNeedCode }) {
  const { signIn } = useAuth();
  const [saved, setSaved] = useState(undefined); // undefined = still checking
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const tries = useRef(0);
  const autoAsked = useRef(false);

  useEffect(() => { savedQuickSignIn().then((k) => { setSaved(k); onReady?.(!!k); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fallback = useCallback((message) => { onNeedCode?.(message || ''); }, [onNeedCode]);

  const go = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await quickSignIn();
      await signIn(r.token, r.user); // the app moves to Home by itself
    } catch (e) {
      if (e.code === 'gone') { setSaved(null); fallback(e.message || 'Please sign in with your email code.'); }
      else if (e.code === 'use_code') fallback('Your account is paused or waiting to be deleted. Sign in with your email code to bring it back.');
      else {
        tries.current += 1;
        const left = MAX_QUICK_TRIES - tries.current;
        if (left <= 0) fallback(`${quickSignInLabel()} didn't work. Sign in with your email code instead.`);
        else if (e.code === 'cancelled') setError(`Tap to try again (${left} ${left === 1 ? 'try' : 'tries'} left before we ask for a code).`);
        else setError(`${e.message || "Couldn't sign in."} ${left} ${left === 1 ? 'try' : 'tries'} left before we ask for a code.`);
      }
    } finally { setBusy(false); }
  }, [busy, signIn, fallback]);

  // like a banking app: the phone's prompt opens by itself once when the screen appears
  useEffect(() => { if (saved && !autoAsked.current) { autoAsked.current = true; go(); } }, [saved]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!saved) return null;

  return (
    <View style={{ marginBottom: space.lg }}>
      <Pressable onPress={go} disabled={busy} accessibilityRole="button" accessibilityLabel={`Sign in with ${quickSignInLabel()}`}
        style={({ pressed }) => ({
          height: 56, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
          borderWidth: 1.5, borderColor: colors.aura, backgroundColor: pressed ? 'rgba(124,92,252,0.18)' : 'rgba(124,92,252,0.10)',
        })}>
        {busy ? <ActivityIndicator color={colors.aura} /> : (
          <>
            <Ionicons name="finger-print" size={22} color={colors.aura} style={{ marginRight: 10 }} />
            <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 16 }} numberOfLines={1}>
              {saved.name ? `Continue as ${saved.name}` : `Sign in with ${quickSignInLabel()}`}
            </Text>
          </>
        )}
      </Pressable>
      {error ? <Text style={{ color: colors.gold, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginTop: space.sm }}>{error}</Text> : null}
      <Pressable onPress={() => fallback('')} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.md, padding: 6 }}>
        <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 13 }}>
          Not {saved.name || 'you'}? <Text style={{ color: colors.aura, fontFamily: fonts.semibold }}>Use another account</Text>
        </Text>
      </Pressable>
    </View>
  );
}
