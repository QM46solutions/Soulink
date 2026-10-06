// Instagram-style "Report" flow for the ❗ Offense button: pick why, then a thank-you screen.
// If you already marked the post, it shows your reason and lets you take the mark back.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Overlay } from '../lib/portal';
import { useOpenGuard, useSafeClose } from '../lib/safeClose';
import { colors, fonts, space } from '../lib/theme';

export const OFFENSE_REASONS = [
  { key: 'dislike', label: "I just don't like it" },
  { key: 'bullying', label: 'Bullying or unwanted contact' },
  { key: 'hate', label: 'Hate speech or symbols' },
  { key: 'nudity', label: 'Nudity or sexual activity' },
  { key: 'violence', label: 'Violence or dangerous people' },
  { key: 'self_harm', label: 'Suicide, self-injury or eating disorders' },
  { key: 'scam', label: 'Scam, fraud or impersonation' },
  { key: 'false_info', label: 'False information' },
  { key: 'spam', label: 'Spam' },
  { key: 'other', label: 'Something else' },
];
export const reasonLabel = (k) => OFFENSE_REASONS.find((r) => r.key === k)?.label || 'Something else';

export default function OffenseSheet({ visible, offended, reason, onClose, onMark, onUnmark }) {
  const [step, setStep] = useState('pick'); // pick | busy | done | error
  const [error, setError] = useState(null);
  useEffect(() => { if (visible) { setStep('pick'); setError(null); } }, [visible]);
  const backdropClose = useSafeClose(visible, onClose);
  const ready = useOpenGuard(visible);
  if (!visible) return null;

  const run = async (fn, after) => {
    setStep('busy');
    try { await fn(); if (after) setStep(after); else onClose(); } catch (e) { setError(e.message); setStep('error'); }
  };

  const Header = ({ title }) => (
    <View style={{ alignItems: 'center', paddingBottom: space.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.dim, marginBottom: space.md }} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.text }}>{title}</Text>
    </View>
  );

  let body;
  if (step === 'busy') {
    body = <View style={{ padding: space.xxl, alignItems: 'center' }}><ActivityIndicator color={colors.aura} /></View>;
  } else if (step === 'done') {
    body = (
      <View style={{ alignItems: 'center', padding: space.xl }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginBottom: space.md }}>
          <Ionicons name="checkmark" size={34} color={colors.mint} />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.text, textAlign: 'center' }}>Thanks for letting us know</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.muted, textAlign: 'center', marginTop: 8 }}>
          Your mark is anonymous: the person who posted this won't see that it was you. Feedback like yours helps keep Soulink safe and kind.
        </Text>
        <Pressable onPress={onClose} style={({ hovered }) => ({ marginTop: space.lg, alignSelf: 'stretch', height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? '#8d70ff' : colors.soul })}>
          <Text style={{ fontFamily: fonts.semibold, color: '#fff', fontSize: 15 }}>Close</Text>
        </Pressable>
      </View>
    );
  } else if (offended) {
    body = (
      <View style={{ padding: space.xl }}>
        <Text style={{ fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.muted, textAlign: 'center' }}>
          You marked this post as offensive{reason ? ` for: ${reasonLabel(reason)}` : ''}.
        </Text>
        <Pressable onPress={() => { if (ready()) run(onUnmark); }} style={({ hovered }) => ({ marginTop: space.lg, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)' })}>
          <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>Remove my mark</Text>
        </Pressable>
        <Pressable onPress={onClose} style={{ marginTop: space.sm, height: 42, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fonts.body, color: colors.muted, fontSize: 15 }}>Cancel</Text>
        </Pressable>
      </View>
    );
  } else {
    body = (
      <ScrollView style={{ maxHeight: 460 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text, paddingHorizontal: space.lg, paddingTop: space.md }}>Why are you marking this post?</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, paddingHorizontal: space.lg, paddingTop: 4, paddingBottom: space.sm }}>Your mark is anonymous.</Text>
        {step === 'error' ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.danger, paddingHorizontal: space.lg, paddingBottom: space.sm }}>{error}</Text> : null}
        {OFFENSE_REASONS.map((r) => (
          <Pressable key={r.key} onPress={() => { if (ready()) run(() => onMark(r.key), 'done'); }}
            style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 15, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: hovered ? 'rgba(255,255,255,0.05)' : 'transparent' })}>
            <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text }}>{r.label}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.dim} />
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <Pressable onPress={backdropClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', cursor: 'default' }} />
      <View style={{ backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: space.sm, paddingBottom: space.lg }}>
        <Header title={offended && step !== 'done' ? 'Offense mark' : 'Mark as offensive'} />
        {body}
      </View>
    </Overlay>
  );
}
