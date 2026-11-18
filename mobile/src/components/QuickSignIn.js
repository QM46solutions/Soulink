// The "Sign in with fingerprint / face unlock" button on the welcome screen. Shows only when this phone has it
// turned on. The email box underneath stays as the fallback (and is the only way back for a new phone).
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { quickSignIn, quickSignInLabel, savedQuickSignIn } from '../lib/biometric';
import { colors, fonts, radius, space } from '../lib/theme';

export default function QuickSignIn() {
  const { signIn } = useAuth();
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { savedQuickSignIn().then(setSaved); }, []);

  const go = useCallback(async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await quickSignIn();
      await signIn(r.token, r.user); // the app moves to Home by itself
    } catch (e) {
      if (e.code === 'cancelled') { /* closed the prompt: nothing to say */ }
      else if (e.code === 'gone') { setSaved(null); setError(e.message || 'Please sign in with your email code.'); }
      else if (e.code === 'use_code') setError('Please sign in with your email code to reactivate your account.');
      else setError(e.message || "Couldn't sign in. Please try again.");
    } finally { setBusy(false); }
  }, [busy, signIn]);

  if (!saved) return error ? <Text style={{ color: colors.gold, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginBottom: space.md }}>{error}</Text> : null;

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
      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginTop: space.sm }}>{error}</Text> : null}
      <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: space.md }}>or sign in with a code</Text>
    </View>
  );
}
