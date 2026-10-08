// Connect in two quick taps, on top of the profile (no new page, no scrolling):
//   1) Who is this person to you?  Someone I know / Someone new
//   2) What are you hoping for?    pick one → Send
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../lib/api';
import { INTENTS, intentOf } from '../lib/intents';
import { BottomSheet } from './PostSheets';
import { IntentBadge } from './Choice';
import { colors, fonts, gradients, space } from '../lib/theme';

function Who({ icon, title, text, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ hovered, pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: space.lg, paddingHorizontal: space.sm, borderRadius: 20, borderWidth: 1.5,
      borderColor: hovered ? colors.aura : colors.border, backgroundColor: pressed ? 'rgba(124,92,252,0.2)' : colors.glass, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={gradients.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <Ionicons name={icon} size={24} color="#fff" />
      </View>
      <Text style={{ fontFamily: fonts.displayBold, fontSize: 15, color: colors.text, marginTop: space.sm }}>{title}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginTop: 2, textAlign: 'center' }}>{text}</Text>
    </Pressable>
  );
}

export default function ConnectSheet({ visible, onClose, user, onSent, startStep = 1 }) {
  const [step, setStep] = useState(startStep);
  const [knows, setKnows] = useState(null);
  const [intent, setIntent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);
  useEffect(() => { if (visible) { setStep(startStep); setKnows(null); setIntent(null); setError(null); setSent(false); } }, [visible]);
  const first = (user?.displayName || user?.username || '').split(' ')[0];

  const send = async () => {
    setBusy(true); setError(null);
    try {
      await api('/connections/requests', { method: 'POST', body: { toUserId: user.id, intent, knows: knows === 'known' } });
      setSent(true); onSent?.();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const title = sent ? 'Request sent' : step === 1 ? `Connect with ${first}` : 'What are you hoping for?';
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View style={{ padding: space.lg, paddingBottom: space.xl }}>
        {sent ? (
          <View style={{ alignItems: 'center', paddingVertical: space.md }}>
            <IntentBadge intent={intentOf(intent)} size={72} />
            <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center', marginTop: space.md }}>
              {first} will see you want to connect for {intentOf(intent).label}. You'll get a notification when they answer.
            </Text>
            <Pressable onPress={onClose} style={{ marginTop: space.lg, alignSelf: 'stretch', height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
              <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>Done</Text>
            </Pressable>
          </View>
        ) : step === 1 ? (
          <>
            <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.muted, textAlign: 'center', marginBottom: space.lg }}>Who is {first} to you?</Text>
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Who icon="people" title="Someone I know" text="Friend, classmate, colleague" onPress={() => { setKnows('known'); setStep(2); }} />
              <Who icon="sparkles" title="Someone new" text="We haven't met yet" onPress={() => { setKnows('new'); setStep(2); }} />
            </View>
          </>
        ) : (
          <>
            {/* all 8 choices fit on screen: 4 per row */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {INTENTS.map((i) => {
                const on = intent === i.key;
                return (
                  <Pressable key={i.key} onPress={() => setIntent(i.key)} accessibilityState={{ selected: on }}
                    style={({ hovered }) => ({ width: '25%', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, borderRadius: 16, borderWidth: 1.5,
                      borderColor: on ? i.colors[0] : 'transparent', backgroundColor: on ? `${i.colors[0]}26` : hovered ? 'rgba(255,255,255,0.04)' : 'transparent' })}>
                    <IntentBadge intent={i} size={44} dim={!!intent && !on} />
                    <Text numberOfLines={2} style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 11.5, lineHeight: 14, color: on ? colors.text : colors.muted, marginTop: 6, textAlign: 'center' }}>{i.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {error ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.danger, textAlign: 'center', marginTop: space.md }}>{error}</Text> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: space.lg }}>
              <Pressable onPress={() => setStep(1)} hitSlop={8} accessibilityLabel="Back" style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginRight: space.sm }}>
                <Ionicons name="arrow-back" size={20} color={colors.text} />
              </Pressable>
              <Pressable onPress={send} disabled={!intent || busy} style={{ flex: 1, height: 48, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', opacity: intent ? 1 : 0.45 }}>
                <LinearGradient colors={gradients.button} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.7 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: fonts.bold, color: '#fff', fontSize: 15 }}>{intent ? `Send ${intentOf(intent).label} request` : 'Pick one to send'}</Text>}
              </Pressable>
            </View>
          </>
        )}
      </View>
    </BottomSheet>
  );
}
