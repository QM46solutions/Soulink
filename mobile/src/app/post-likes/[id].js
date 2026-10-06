// Who gave a post a 👌🏻 (newest first). Opened by tapping the 👌🏻 count or "Liked by …" under a post.
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { api } from '../../lib/api';
import { Empty, ErrorText, Loading, UserRow, s } from '../../components/ui';
import { space } from '../../lib/theme';

export default function PostLikes() {
  const { id } = useLocalSearchParams();
  const [users, setUsers] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api(`/posts/${id}/likes`).then((r) => setUsers(r.users)).catch((e) => { setError(e.message); setUsers([]); }); }, [id]);
  if (!users) return <Loading />;
  return (
    <View style={s.screen}>
      <ErrorText>{error}</ErrorText>
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ paddingVertical: space.sm, flexGrow: 1 }}
        renderItem={({ item }) => <UserRow user={item} nameFirst onPress={() => router.push(`/user/${item.username}`)} />}
        ListEmptyComponent={<Empty icon="happy-outline" title="No 👌🏻 yet" text="When people give this post a 👌🏻, they show up here." />}
      />
    </View>
  );
}
