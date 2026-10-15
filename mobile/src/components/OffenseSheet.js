// Instagram-style "Report" flow for the ❗ Offense button: pick why, then a thank-you screen.
// If you already marked the post, it shows your reason and lets you take the mark back.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Overlay } from '../lib/portal';
import { api, getServer } from '../lib/api';
import { Platform } from 'react-native';
import { router } from 'expo-router';
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

export default function OffenseSheet({ visible, offended, reason, onClose, onMark, onUnmark, owner, postId, base, what = 'post' }) {
  const [step, setStep] = useState('pick'); // pick | busy | done | error
  const [error, setError] = useState(null);
  useEffect(() => { if (visible) { setStep('pick'); setError(null); } }, [visible]);
  // your own post: show how many people marked it and why (never who)
  const [stats, setStats] = useState(null);
  useEffect(() => {
    if (!visible || !owner) return;
    setStats(null);
    api(`${base || `/posts/${postId}`}/offenses`).then(setStats).catch((e) => setStats({ error: e.message }));
  }, [visible, owner, postId, base]);
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
  if (owner) {
    const total = stats?.total || 0;
    body = !stats ? <View style={{ padding: space.xxl, alignItems: 'center' }}><ActivityIndicator color={colors.aura} /></View> : (
      <View style={{ padding: space.lg }}>
        {stats.error ? <Text style={{ fontFamily: fonts.body, color: colors.danger, textAlign: 'center' }}>{stats.error}</Text> : null}
        <Text style={{ fontFamily: fonts.display, fontSize: 40, lineHeight: 46, color: total ? colors.danger : colors.text, textAlign: 'center' }}>{total}</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13.5, color: colors.muted, textAlign: 'center' }}>
          {total === 1 ? 'person has' : 'people have'} marked your {what} as offensive{stats.limit ? ` · hidden after ${stats.limit}` : ''}
        </Text>
        {stats.limit ? (
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: space.md, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min(100, (total / (stats.limit + 1)) * 100)}%`, height: 6, backgroundColor: colors.danger }} />
          </View>
        ) : null}
        <View style={{ marginTop: space.md }}>
          {OFFENSE_REASONS.filter((r) => stats.byReason?.[r.key]).map((r) => (
            <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 14.5, color: colors.text }}>{r.label}</Text>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.danger }}>{stats.byReason[r.key]}</Text>
            </View>
          ))}
        </View>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.muted, textAlign: 'center', marginTop: space.md }}>
          {total ? "You never see who marked it." : `Nobody has marked this ${what}.`} Only other people can mark your {what}s.
        </Text>
        <Pressable onPress={onClose} style={({ hovered }) => ({ marginTop: space.lg, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.08)' })}>
          <Text style={{ fontFamily: fonts.semibold, color: colors.text, fontSize: 15 }}>Close</Text>
        </Pressable>
      </View>
    );
  } else if (step === 'busy') {
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
          You marked this {what} as offensive{reason ? ` for: ${reasonLabel(reason)}` : ''}.
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
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text, paddingHorizontal: space.lg, paddingTop: space.md }}>Why are you marking this {what}?</Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 12.5, color: colors.muted, paddingHorizontal: space.lg, paddingTop: 4, paddingBottom: space.sm }}>Your mark is anonymous.</Text>
        {step === 'error' ? <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.danger, paddingHorizontal: space.lg, paddingBottom: space.sm }}>{error}</Text> : null}
        {OFFENSE_REASONS.map((r) => (
          <Pressable key={r.key} onPress={() => { if (ready()) run(() => onMark(r.key), 'done'); }}
            style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 15, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: hovered ? 'rgba(255,255,255,0.05)' : 'transparent' })}>
            <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.text }}>{r.label}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.dim} />
          </Pressable>
        ))}
        {/^(post|spark)$/i.test(what) ? (
          <Pressable onPress={() => {
            const kind = /spark/i.test(what) ? 'spark' : 'post';
            const origin = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : getServer().replace(/\/api$/, '');
            onClose(); router.push(`/copyright?url=${encodeURIComponent(`${origin}/${kind}/${postId}`)}`);
          }}
            style={({ hovered }) => ({ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 15, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: hovered ? 'rgba(255,255,255,0.05)' : 'transparent' })}>
            <Ionicons name="musical-notes-outline" size={17} color={colors.aura} style={{ marginRight: space.md }} />
            <Text style={{ flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.aura }}>It uses my copyrighted work</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.dim} />
          </Pressable>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <Pressable onPress={backdropClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', cursor: 'default' }} />
      <View style={{ backgroundColor: colors.deep, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: space.sm, paddingBottom: space.lg }}>
        <Header title={owner ? 'Offense marks' : offended && step !== 'done' ? 'Offense mark' : 'Mark as offensive'} />
        {body}
      </View>
    </Overlay>
  );
}
