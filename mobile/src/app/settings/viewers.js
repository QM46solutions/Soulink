// Settings > Who viewed my profile (last 30 days). Free: the 3 most recent. Everyone else: Soulink Premium.
// Locked viewers come from the server only as a number, so nothing about them can leak.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../lib/api';
import { notice } from '../../lib/confirm';
import { Button, Empty, Loading, UserRow, s } from '../../components/ui';
import { Note } from '../../components/SettingsUI';
import { colors, fonts, space } from '../../lib/theme';

const ago = (iso) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m ago`; const h = Math.round(m / 60); if (h < 24) return `${h}h ago`; return `${Math.round(h / 24)}d ago`;
};

// a placeholder row that looks like a blurred person (no real data behind it)
function LockedRow({ i }) {
  const w = [120, 96, 140, 110][i % 4];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: 10, opacity: 0.55 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}>
        <LinearGradient colors={['#5b46d6', '#ff6b9d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, opacity: 0.55 }} />
      </View>
      <View style={{ marginLeft: space.md, flex: 1 }}>
        <View style={{ width: w, height: 12, borderRadius: 6, backgroundColor: 'rgba(233,231,242,0.25)' }} />
        <View style={{ width: w * 0.6, height: 10, borderRadius: 5, backgroundColor: 'rgba(233,231,242,0.12)', marginTop: 6 }} />
      </View>
      <Ionicons name="lock-closed" size={16} color={colors.dim} />
    </View>
  );
}

function PremiumCard({ locked }) {
  return (
    <View style={{ margin: space.lg, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(245,200,66,0.45)' }}>
      <LinearGradient colors={['rgba(245,200,66,0.18)', 'rgba(255,107,157,0.14)', 'rgba(124,92,252,0.14)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ padding: space.lg, alignItems: 'center' }}>
        <Ionicons name="diamond" size={26} color={colors.gold} />
        <Text style={{ fontFamily: fonts.displayBold, fontSize: 17, color: colors.text, marginTop: 6, textAlign: 'center' }}>
          {locked} more {locked === 1 ? 'person' : 'people'} viewed your profile
        </Text>
        <Text style={{ fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 4, textAlign: 'center' }}>See everyone who checked you out with Soulink Premium.</Text>
        <Button title="See all with Premium" style={{ marginTop: space.md, alignSelf: 'stretch' }}
          onPress={() => notice('Soulink Premium', 'Premium is coming soon. You will be able to unlock everyone who viewed your profile, the full match breakdown and more.')} />
      </View>
    </View>
  );
}

export default function Viewers() {
  const [d, setD] = useState(null);
  const load = useCallback(() => api('/account/viewers').then(setD).catch(() => setD({ viewers: [], total: 0, locked: 0 })), []);
  useEffect(() => { load(); }, [load]);
  if (!d) return <Loading />;
  const lockedRows = Array.from({ length: Math.min(d.locked || 0, 4) }, (_, i) => i);
  return (
    <FlatList style={s.screen} data={d.viewers} keyExtractor={(u) => u.id}
      ListHeaderComponent={d.total ? <Note>{d.total} {d.total === 1 ? 'person' : 'people'} viewed your profile in the last 30 days.{d.premium ? ' 💎 Premium: you see everyone.' : ''}</Note> : null}
      renderItem={({ item }) => (
        <UserRow user={item} nameFirst onPress={() => router.push(`/user/${item.username}`)}
          right={<Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>{ago(item.lastViewedAt)}{item.days > 1 ? ` · ${item.days} days` : ''}</Text>} />
      )}
      ListFooterComponent={d.locked ? <>{lockedRows.map((i) => <LockedRow key={i} i={i} />)}<PremiumCard locked={d.locked} /></> : null}
      ListEmptyComponent={<Empty icon="eye-outline" title="No profile views yet" text="When someone visits your profile, they show up here for 30 days." />} />
  );
}
