// The phone/email field with the round arrow button. Used on the welcome screen (mode="login")
// and on Create account (mode="signup"). Arrow or Enter → code is sent → 6-digit code screen.
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, fonts, gradients, radius, space } from '../lib/theme';

export default function ContactEntry({ mode = 'login', initialMethod = 'phone', initialValue = '' }) {
  const [method, setMethod] = useState(initialMethod);
  const [value, setValue] = useState(initialValue);
  const [noAccount, setNoAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [focused, setFocused] = useState(false);
  const isPhone = method === 'phone';
  const valid = isPhone ? value.replace(/\D/g, '').length === 10 : /\S+@\S+\.\S+/.test(value.trim());

  const submit = async () => {
    if (!valid || busy) return;
    setError(null); setNoAccount(false); setBusy(true);
    try {
      const r = await api('/auth/otp/request', { method: 'POST', body: { ...(isPhone ? { phone: value } : { email: value.trim() }), intent: mode } });
      router.push({ pathname: '/verify', params: { target: r.target, channel: r.channel, exists: r.accountExists ? '1' : '0', dev: r.devCode || '' } });
    } catch (e) {
      if (e.code === 'no_account') setNoAccount(true); else setError(e.message);
    } finally { setBusy(false); }
  };

  const swap = () => { setMethod(isPhone ? 'email' : 'phone'); setValue(''); setError(null); setNoAccount(false); };

  return (
    <View>
      <View style={{
        flexDirection: 'row', alignItems: 'center', height: 60, borderRadius: radius.pill, paddingLeft: 20, paddingRight: 6,
        backgroundColor: colors.inputBg, borderWidth: 1.5, borderColor: error ? colors.danger : focused ? colors.soul : colors.border,
        ...(Platform.OS === 'web' ? { transitionProperty: 'border-color, box-shadow', transitionDuration: '180ms', boxShadow: focused ? '0 0 0 4px rgba(124,92,252,0.18)' : 'none' } : {}),
      }}>
        {isPhone ? (
          <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: 16, marginRight: 10, paddingRight: 10, borderRightWidth: 1, borderRightColor: colors.border }}>+91</Text>
        ) : <Ionicons name="mail-outline" size={18} color={colors.muted} style={{ marginRight: 10 }} />}
        <TextInput
          key={method}
          value={value}
          onChangeText={(t) => { setValue(isPhone ? t.replace(/[^\d ]/g, '') : t); setError(null); setNoAccount(false); }}
          placeholder={isPhone ? 'Mobile number' : 'Email address'}
          placeholderTextColor={colors.dim}
          keyboardType={isPhone ? 'phone-pad' : 'email-address'}
          autoCapitalize="none"
          autoComplete={isPhone ? 'tel-national' : 'email'}
          maxLength={isPhone ? 11 : 254}
          returnKeyType="go"
          onSubmitEditing={submit}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 16, height: '100%', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) }}
          accessibilityLabel={isPhone ? 'Mobile number' : 'Email address'}
        />
        <Pressable onPress={submit} disabled={!valid || busy} accessibilityLabel="Continue"
          style={({ hovered }) => ({
            width: 48, height: 48, borderRadius: 24, overflow: 'hidden', opacity: valid ? 1 : 0.35,
            ...(Platform.OS === 'web' ? { cursor: valid ? 'pointer' : 'default', transitionProperty: 'transform, opacity', transitionDuration: '180ms' } : {}),
            transform: [{ scale: hovered && valid ? 1.08 : 1 }],
          })}>
          <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-forward" size={22} color="#fff" />}
          </LinearGradient>
        </Pressable>
      </View>

      {error ? <Text style={{ color: colors.danger, fontFamily: fonts.medium, fontSize: 13, textAlign: 'center', marginTop: space.sm }}>{error}</Text> : null}

      {noAccount ? (
        <Pressable onPress={() => router.push({ pathname: '/signup', params: { method, value } })}
          style={{ marginTop: space.md, borderWidth: 1, borderColor: 'rgba(245,200,66,0.45)', backgroundColor: 'rgba(245,200,66,0.08)', borderRadius: 16, padding: space.md }}>
          <Text style={{ color: colors.gold, fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center' }}>
            {isPhone ? 'No Soulink account uses this number yet.' : 'No Soulink account uses this email yet.'}
          </Text>
          <Text style={{ color: colors.aura, fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center', marginTop: 4 }}>Create an account with it →</Text>
        </Pressable>
      ) : null}

      <Text onPress={swap} style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13, textAlign: 'center', marginTop: space.md }}>
        {isPhone ? 'Use email instead' : 'Use phone number instead'}
      </Text>
    </View>
  );
}
