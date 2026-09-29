import { useCallback, useEffect, useState } from 'react';
import { FlatList } from 'react-native';
import { api } from '../lib/api';
import { Button, Empty, Loading, UserRow, s } from '../components/ui';

export default function Blocked() {
  const [users, setUsers] = useState(null);
  const load = useCallback(async () => setUsers((await api('/blocks')).users), []);
  useEffect(() => { load().catch(() => setUsers([])); }, [load]);

  if (!users) return <Loading />;
  return (
    <FlatList
      style={s.screen}
      data={users}
      keyExtractor={(u) => u.id}
      renderItem={({ item }) => (
        <UserRow user={item} right={<Button title="Unblock" small variant="secondary" onPress={async () => { await api(`/blocks/${item.id}`, { method: 'DELETE' }); load(); }} />} />
      )}
      ListEmptyComponent={<Empty icon="ban-outline" title="You haven't blocked anyone" />}
    />
  );
}
