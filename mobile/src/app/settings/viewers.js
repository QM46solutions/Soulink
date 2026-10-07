// Settings > Who viewed my profile (last 30 days). Blocked people never show up.
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text } from 'react-native';
import { router } from 'expo-router';
import { api } from '../../lib/api';
import { Empty, Loading, UserRow, s } from '../../components/ui';
import { Note } from '../../components/SettingsUI';
import { colors, fonts } from '../../lib/theme';

const ago = (iso) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return `${m}m ago`; const h = Math.round(m / 60); if (h < 24) return `${h}h ago`; return `${Math.round(h / 24)}d ago`;
};

export default function Viewers() {
  const [list, setList] = useState(null);
  const load = useCallback(() => api('/account/viewers').then((r) => setList(r.viewers)).catch(() => setList([])), []);
  useEffect(() => { load(); }, [load]);
  if (!list) return <Loading />;
  return (
    <FlatList style={s.screen} data={list} keyExtractor={(u) => u.id}
      ListHeaderComponent={list.length ? <Note>{list.length} {list.length === 1 ? 'person' : 'people'} viewed your profile in the last 30 days.</Note> : null}
      renderItem={({ item }) => (
        <UserRow user={item} nameFirst onPress={() => router.push(`/user/${item.username}`)}
          right={<Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.muted }}>{ago(item.lastViewedAt)}{item.days > 1 ? ` · ${item.days} days` : ''}</Text>} />
      )}
      ListEmptyComponent={<Empty icon="eye-outline" title="No profile views yet" text="When someone visits your profile, they show up here for 30 days." />} />
  );
}
