// The email/phone field with the round arrow button. Used on the welcome screen (mode="login")
// and on Create account (mode="signup"). Arrow or Enter → code is sent → 6-digit code screen.
// Sign-in: two choices, Email or Phone number; the person picks one and verifies only that one with a code. Phone
// codes are switched on by the server once MSG91 + DLT are live (GET /auth/options says so); until then the Phone
// number choice says text-message sign-in is coming soon, and only the store reviewer's test number and the team's
// test numbers get past it (the server refuses the rest). Create account: email is mandatory, so it starts with email (a phone sign-up, once SMS
// is live, adds its email as the first step of profile setup). The answer never says whether an account exists.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { colors, fonts, gradients, radius, space } from '../lib/theme';

let optionsCache = null; // { phone, email } from the server, fetched once per app launch

export default function ContactEntry({ mode = 'login', initialMethod, initialValue = '' }) {
  const [method, setMethod] = useState(initialMethod || (mode === 'login' && optionsCache?.phone ? 'phone' : 'email'));
  const [touched, setTouched] = useState(!!initialMethod);
  useEffect(() => {
    if (optionsCache) return;
    api('/auth/options').then((o) => {
      optionsCache = o;
      if (!touched && mode === 'login' && o.phone) setMethod('phone');
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [focused, setFocused] = useState(false);
  const isPhone = method === 'phone';
  const valid = isPhone ? value.replace(/\D/g, '').length === 10 : /\S+@\S+\.\S+/.test(value.trim());

  const submit = async () => {
    if (!valid || busy) return;
    setError(null); setBusy(true);
    try {
      const r = await api('/auth/otp/request', { method: 'POST', body: { ...(isPhone ? { phone: value } : { email: value.trim() }), intent: mode } });
      router.push({ pathname: '/verify', params: { target: r.target, channel: r.channel, dev: r.devCode || '' } });
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const swap = () => { setMethod(isPhone ? 'email' : 'phone'); setValue(''); setError(null); };

  const choose = (m) => { if (m === method) return; setTouched(true); setMethod(m); setValue(''); setError(null); };
  const smsOff = isPhone && !optionsCache?.phone;

  return (
    <View>
      {mode === 'login' ? (
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, marginBottom: space.md }}>
          {[{ m: 'email', label: 'Email', icon: 'mail-outline' }, { m: 'phone', label: 'Phone number', icon: 'call-outline' }].map((o) => {
            const on = method === o.m;
            return (
              <Pressable key={o.m} onPress={() => choose(o.m)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ flex: 1, height: 44, borderRadius: radius.pill, overflow: 'hidden' }}>
                {on ? <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} /> : null}
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={o.icon} size={16} color={on ? '#fff' : colors.muted} style={{ marginRight: 6 }} />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: on ? '#fff' : colors.muted }}>{o.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {mode === 'login' && smsOff ? (
        <Text style={{ fontFamily: fonts.medium, color: colors.gold, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: space.md }}>
          Sign-in by text message is coming soon. Please use email for now.
        </Text>
      ) : null}
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
          onChangeText={(t) => { setValue(isPhone ? t.replace(/[^\d ]/g, '') : t); setError(null); }}
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
          style={{ flex: 1, minWidth: 0, color: colors.text, fontFamily: fonts.medium, fontSize: 16, height: '100%', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) }}
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

      {mode !== 'login' && (optionsCache?.phone || isPhone) ? (
        <Text onPress={() => { setTouched(true); swap(); }} style={{ fontFamily: fonts.semibold, color: colors.aura, fontSize: 13, textAlign: 'center', marginTop: space.md }}>
          {isPhone ? 'Use email instead' : 'Use phone number instead'}
        </Text>
      ) : null}
    </View>
  );
}
