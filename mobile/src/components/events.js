// Soul Events: pieces shared by the Events tab, an event's page, the ticket and the gate scanner.
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, mediaUrl } from '../lib/api';
import { confirm } from '../lib/confirm';
import { colors, fonts, space } from '../lib/theme';

export const KIND = {
  pub: { icon: 'beer', color: colors.gold, label: 'Pub night' },
  run: { icon: 'walk', color: colors.mint, label: 'Run' },
  sport: { icon: 'trophy', color: colors.spark, label: 'Tournament' },
  music: { icon: 'musical-notes', color: colors.aura, label: 'Music' },
  social: { icon: 'people', color: colors.aura, label: 'Social' },
  workshop: { icon: 'bulb', color: colors.mint, label: 'Workshop' },
};
export const kindOf = (k) => KIND[k] || KIND.social;
const IST = { timeZone: 'Asia/Kolkata' };
export const dayText = (d) => new Date(d).toLocaleDateString('en-IN', { ...IST, weekday: 'short', day: 'numeric', month: 'short' });
export const timeText = (d) => new Date(d).toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' });
export const rupees = (n) => (Number(n) ? `₹${Number(n).toLocaleString('en-IN')}` : 'Free');

/** Badge for where someone stands with an event. */
export function statusOf(e) {
  if (e.mine?.status === 'paid') return { text: e.mine.checkedIn ? 'Checked in' : 'Ticket ready', color: colors.mint, icon: 'qr-code' };
  if (e.status === 'cancelled') return { text: 'Cancelled', color: colors.danger, icon: 'close-circle' };
  if (e.ended) return { text: 'Over', color: colors.dim, icon: 'time' };
  if (e.mine?.status === 'pending') return { text: 'Finish payment', color: colors.gold, icon: 'card' };
  if (e.status === 'closed') return { text: 'Registrations closed', color: colors.muted, icon: 'lock-closed' };
  if (e.soldOut) return { text: 'Sold out', color: colors.spark, icon: 'flame' };
  if (e.seatsLeft <= 10) return { text: `Only ${e.seatsLeft} left`, color: colors.spark, icon: 'flame' };
  return null;
}

export function EventCard({ e, onPress }) {
  const k = kindOf(e.kind); const st = statusOf(e);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={e.title}
      style={({ pressed }) => ({ borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.glass, marginBottom: space.md, opacity: pressed ? 0.9 : 1 })}>
      <View style={{ aspectRatio: 2.2, backgroundColor: colors.deep }}>
        {e.coverUrl ? <Image source={{ uri: mediaUrl(e.coverUrl) }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" />
          : (<>
            <LinearGradient colors={[`${k.color}55`, 'rgba(124,92,252,0.25)', colors.deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={k.icon} size={54} color={k.color} /></View>
          </>)}
        <LinearGradient colors={['transparent', 'rgba(8,7,13,0.85)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }} />
        <View style={{ position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(8,7,13,0.7)' }}>
          <Ionicons name={k.icon} size={12} color={k.color} />
          <Text style={{ fontFamily: fonts.mono, fontSize: 10.5, letterSpacing: 1, color: k.color, marginLeft: 5 }}>{k.label.toUpperCase()}</Text>
        </View>
        <View style={{ position: 'absolute', top: 10, right: 10, paddingHorizontal: 11, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(8,7,13,0.75)' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.text }}>{rupees(e.price)}</Text>
        </View>
        <Text numberOfLines={2} style={{ position: 'absolute', left: 14, right: 14, bottom: 10, fontFamily: fonts.displayBold, fontSize: 21, lineHeight: 25, color: '#fff' }}>{e.title}</Text>
      </View>
      <View style={{ padding: space.md }}>
        {e.tagline ? <Text numberOfLines={2} style={{ fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.muted, marginBottom: 8 }}>{e.tagline}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
          <Ionicons name="calendar-outline" size={14} color={colors.aura} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.text, marginLeft: 5, marginRight: 12 }}>{dayText(e.startsAt)} · {timeText(e.startsAt)}</Text>
          <Ionicons name="location-outline" size={14} color={colors.aura} />
          <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.text, marginLeft: 5 }}>{e.venue}, {e.city}</Text>
        </View>
        {st ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: `${st.color}66`, backgroundColor: `${st.color}18` }}>
            <Ionicons name={st.icon} size={13} color={st.color} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: st.color, marginLeft: 5 }}>{st.text}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Draws the QR from the server's rows of 0/1 (black on white, with the quiet zone scanners need). */
export function QrView({ rows, size = 240 }) {
  if (!rows?.length) return null;
  const n = rows.length; const cell = Math.floor(size / (n + 8)); const pad = cell * 4;
  return (
    <View accessibilityLabel="Ticket QR code" style={{ backgroundColor: '#fff', padding: pad, borderRadius: 18, alignSelf: 'center' }}>
      {rows.map((r, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          {[...r].map((c, j) => <View key={j} style={{ width: cell, height: cell, backgroundColor: c === '1' ? '#000' : '#fff' }} />)}
        </View>
      ))}
    </View>
  );
}

/** Starts paying for a registration. Resolves 'paid' (ticket ready), 'opened' (the payment page is open: refresh when
 *  the person comes back), or 'cancelled'. Throws with a message when payments aren't open. */
export async function startPayment(reg) {
  const r = await api(`/events/registrations/${reg.id}/pay`, { method: 'POST', body: { returnUrl: ExpoLinking.createURL('/events') } });
  if (r.mode === 'paid') return 'paid';
  if (r.mode === 'test') {
    const ok = await confirm('Test payment', `Payments are in test mode, so no money is taken. Mark ${rupees(r.amount)} as paid and get your ticket?`, { confirmText: 'Pay (test)' });
    if (!ok) return 'cancelled';
    await api(`/events/registrations/${reg.id}/test-pay`, { method: 'POST' });
    return 'paid';
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined') { window.location.href = r.url; return 'opened'; }
  await Linking.openURL(r.url);
  return 'opened';
}
