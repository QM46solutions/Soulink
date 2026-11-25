import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { confirm, notice } from '../../lib/confirm';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Button, Empty, Loading, UserRow, s } from '../../components/ui';
import { Text } from 'react-native';
import { intentOf } from '../../lib/intents';
import { colors, fonts } from '../../lib/theme';

const TITLES = { followers: 'Followers', following: 'Following', connections: 'Connections' };

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

  useEffect(() => { navigation.setOptions({ title: TITLES[type] || 'Followers' }); load(); }, [navigation, username, type, load]);

  // Followers: connect back → you become Connections
  const [backed, setBacked] = useState({});
  const connectBack = async (u) => {
    try { await api(`/connections/back/${u.id}`, { method: 'POST' }); setBacked((b) => ({ ...b, [u.id]: true })); }
    catch (e) { notice('Oops', e.message); }
  };
  // your own lists: remove someone who follows you / stop following someone (they aren't told)
  const removeFollower = async (u) => {
    if (await confirm(`Remove ${u.username}?`, "We won't tell them they were removed from your followers.", { confirmText: 'Remove', destructive: true })) {
      try { await api(`/users/${u.id}/follower`, { method: 'DELETE' }); setUsers((l) => l.filter((x) => x.id !== u.id)); }
      catch (e) { notice('Oops', e.message); }
    }
  };
  const unfollow = async (u) => {
    if (await confirm(`Unfollow ${u.username}?`, "You'll stop seeing their posts in your feed. They won't be told.", { confirmText: 'Unfollow', destructive: true })) {
      try { await api(`/users/${u.id}/follow`, { method: 'DELETE' }); setUsers((l) => l.filter((x) => x.id !== u.id)); }
      catch (e) { notice('Oops', e.message); }
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
          nameFirst
          onPress={() => router.push(`/user/${item.username}`)}
          right={type === 'connections'
            ? (item.intent ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.aura }}>{intentOf(item.intent).emoji} {intentOf(item.intent).label}</Text> : null)
            : type === 'followers' && item.mutual ? <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.mint }}>Connections</Text>
            : mine && type === 'followers' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Button title={backed[item.id] ? 'Connected' : 'Connect back'} small disabled={!!backed[item.id]} onPress={() => connectBack(item)} />
                {!backed[item.id] ? <Button title="Remove" small variant="ghost" onPress={() => removeFollower(item)} /> : null}
              </View>
            )
            : mine && type === 'following' && !item.mutual ? <Button title="Unfollow" small variant="ghost" onPress={() => unfollow(item)} /> : null}
        />
      )}
      ListEmptyComponent={<Empty icon="people-outline" title={type === 'connections' ? 'No Connections yet' : type === 'followers' ? 'No followers yet' : 'Not following anyone yet'} text={type === 'connections' ? 'People who connected with you and you connected back show up here.' : type === 'followers' ? 'Everyone who is connected to you, whether or not you connected back.' : undefined} />}
    />
  );
}
