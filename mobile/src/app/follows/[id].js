import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { confirm } from '../../lib/confirm';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Empty, Loading, UserRow, s } from '../../components/ui';
import { Text } from 'react-native';
import { intentOf } from '../../lib/intents';
import { colors, fonts } from '../../lib/theme';

const TITLES = { followers: 'Followers', following: 'Following', connections: 'Soul Connections' };

export default function FollowList() {
  const { id, type = 'followers', username } = useLocalSearchParams();
  const { user: me } = useAuth();
  const navigation = useNavigation();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  const mine = String(id).toLowerCase() === String(me.id).toLowerCase();

  const load = useCallback(async () => {
    try { setUsers((await api(`/users/${id}/${type}`)).users); } catch (e) { setError(e.message); }
  }, [id, type]);

  useEffect(() => { navigation.setOptions({ title: `${username} · ${TITLES[type] || 'Followers'}` }); load(); }, [navigation, username, type, load]);

  const removeFollower = async (u) => {
    if (await confirm(`Remove ${u.username}?`, "We won't tell them they were removed from your followers.", { confirmText: 'Remove', destructive: true })) {
      await api(`/users/${u.id}/follower`, { method: 'DELETE' });
      load();
    }
  };

  if (error) return <View style={s.screen}><Empty icon="lock-closed-outline" title={error} /></View>;
  if (!users) return <Loading />;
  return (
    <FlatList
      style={s.screen}
      data={users}
      keyExtractor={(u) => u.id}
      renderItem={({ item }) => (
        <UserRow
          user={item}
          onPress={() => router.push(`/user/${item.username}`)}
          right={type === 'connections'
            ? (item.intent ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.aura }}>{intentOf(item.intent).emoji} {intentOf(item.intent).label}</Text> : null)
            : mine && type === 'followers' ? <Button title="Remove" variant="secondary" small onPress={() => removeFollower(item)} /> : null}
        />
      )}
      ListEmptyComponent={<Empty icon="people-outline" title={type === 'connections' ? 'No Soul Connections yet' : type === 'followers' ? 'No followers yet' : 'Not following anyone yet'} />}
    />
  );
}
