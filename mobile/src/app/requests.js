import { useCallback, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { api } from '../lib/api';
import { Button, Empty, Loading, UserRow, s } from '../components/ui';
import { space } from '../lib/theme';

export default function FollowRequests() {
  const [items, setItems] = useState(null);
  const load = useCallback(async () => { setItems((await api('/users/me/follow-requests')).requests); }, []);
  useEffect(() => { load().catch(() => setItems([])); }, [load]);

  const respond = async (id, action) => {
    setItems((cur) => cur.filter((r) => r.user.id !== id)); // optimistic
    try { await api(`/users/me/follow-requests/${id}/${action}`, { method: 'POST' }); } catch { load(); }
  };

  if (!items) return <Loading />;
  return (
    <FlatList
      style={s.screen}
      data={items}
      keyExtractor={(r) => r.user.id}
      renderItem={({ item }) => (
        <UserRow
          user={item.user}
          onPress={() => router.push(`/user/${item.user.username}`)}
          right={
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button title="Confirm" small onPress={() => respond(item.user.id, 'accept')} />
              <Button title="Delete" small variant="secondary" onPress={() => respond(item.user.id, 'decline')} />
            </View>
          }
        />
      )}
      ListEmptyComponent={<Empty icon="person-add-outline" title="No pending requests" />}
    />
  );
}
